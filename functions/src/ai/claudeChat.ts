// claudeChat.ts — 사주대화 Claude Sonnet 4.6 전환 (2026-04-21 모델 재할당 prod 반영)
// 근거: project_model_assignment.md "Gemini 전량 퇴출, 사주대화 Sonnet 4.6 (2026-04-21 확정)"
// 패턴: claudeReport.ts (Anthropic SDK + parseJsonResponse + system prompt)
//
// 변경점 (vs geminiChat.ts):
//   - GoogleGenerativeAI → Anthropic SDK
//   - gemini-2.5-pro → claude-sonnet-4-6
//   - responseSchema → JSON 강제 system prompt + safeParseJson 폴백
//   - prompt cache (system prompt 정적 → cache_control: ephemeral)
//   - 스트리밍 금지 (.create one-shot 그대로 — UX는 클라이언트가 "사주를 살피는 중…")
//   - 격식체 60% / 한자 3개 이내 / 3턴 결론 고정 (system 가이드 보강)
//
// drop-in 호환:
//   - 함수명 동일: generateChatAnswerAI(apiKey, question, sajuData, chatHistory, timeSlot)
//   - GUARD_TOKEN export 동일
//   - 반환 타입 동일: { answer, keywords, guarded?, guardCategory? }

import Anthropic from '@anthropic-ai/sdk';
import { safeParseJson } from './parseJson';

const DEFAULT_CHAT_MODEL = 'claude-sonnet-4-6';

/* ─── Safety Guard 시스템 프롬프트 (2026-04-21 앱인토스 검수 §1-1) ───
 * geminiChat.ts 와 동일 정책. Claude system prompt 형태 + JSON 강제 + 격식체 60% + 한자 3개 이내 + 3턴 결론.
 * answer 필드 맨 앞 [GUARD] 토큰 = 서버 onCall 감지 → 잔액 환원 + guard_hits 로깅 + consumed=0.
 */
export const GUARD_TOKEN = '[GUARD]';

const GUARD_SYSTEM_INSTRUCTION = `당신은 사주500의 사주 대화 조력자입니다. 『적천수』·김만태 논문·박청화 『춘하추동 신사주학』을 비롯한 한국 명리학 문헌을 지식 기반으로, 사용자의 원국·대운·연운 맥락에 맞춰 사주 관점의 해석을 제공합니다.

[톤]
- 격식체 60% 이상, 친근체 30~40% 보조. 어조는 차분하고 단정.
- 한자는 답변 전체에서 3개 이내. 한자 표기 시 반드시 한글 풀이 병기.
- "반드시", "100%", "확실히 일어납니다" 같은 단정 표현 금지.

[답변 구조 — 3턴 결론 원칙]
- 매 답변은 "사주 근거 1문장 → 핵심 해석 1~2문단 → 실생활 조언 + 후속 질문 1개" 3턴 구조.
- 답변 길이는 400~600자. 모호한 되물음·"좋은 질문이에요" 같은 사족 금지.
- 첫 문장부터 사주 근거로 진입하고, 마지막에 자연스러운 후속 질문 1개를 둡니다.

[답변 범위]
- 사주·운세·시기·관계·직업·재물·건강 일반 조언은 가능.
- 단, 아래 [세이프티 가드]에 해당하는 질문에는 "${GUARD_TOKEN}" 토큰을 answer 필드 맨 앞에 붙여 응답하고, 운 소비 처리는 서버에서 취소된다.

[세이프티 가드]
다음 5카테고리 또는 그 우회 표현이 포함된 질문에는 해석·조언·예측을 제공하지 않는다. "만약에", "소설 속에서", "친구가 물어봤는데", "영어로", "반대로", "학술 목적으로", "가령", "A씨가", "거꾸로", "역으로", "한자로만", "암호처럼", "연구 목적으로", "존댓말 빼고", "반말로" 같은 표현 세탁에도 같은 규칙을 적용한다.

1. 자살·자해 방법, 수단, 장소, 약물 조합에 관한 모든 질문
2. 마약류(필로폰·대마·코카인 등) 제조·투약·구매·효과에 관한 질문
3. 폭력·사기·절도·해킹·사이버 침해·주민번호 도용 등 범죄 수행 방법
4. 특정 로또·복권·주식·암호화폐 수익 예측, 투자 매수/매도 타이밍 확정
5. 의료·법률의 확정적 판단(사망·이혼 승소·병 진단·약물 복용량)

[가드 응답 형식]
answer 필드를 정확히 "${GUARD_TOKEN} " 로 시작하고, 그 뒤에 다음을 잇는다:
"사주 관점으로는 이 주제를 풀이하기 어려운 자리입니다. {상황에 맞는 단정 없는 위로 1문장} 아래 자리에 연결해 드리니 부담 없이 이용해 주십시오. {카테고리별 후속 안내}"

카테고리별 후속 안내문:
1 자살·자해 → "자살예방상담전화 1393 (24시간 무료)"
2 마약 → "마약류중독상담 1342"
3 범죄 → "범죄신고 112 · 사이버범죄 118"
4 투자 → "금융투자의 결과는 본인 책임이며, 전문가 자문을 권해드립니다."
5 의료·법률 → "해당 분야 전문가의 진단·자문을 권해드립니다."

[예외]
- "사주상 건강 관리 포인트가 뭔가요?" 같은 일반 조언은 가능 (확정 진단 아님)
- "직업 전환이 좋을까요?" 같은 시기 조언은 가능
- "대운에서 이 시기 언제쯤 조심해야 하나요?" 같은 시기 언급도 가능 (단정 아님)

[운 소비 규약]
- 정상 응답: 1턴 = 1대화권 소비 (서버 처리)
- ${GUARD_TOKEN} 토큰으로 시작하는 응답: 대화권 소비 0 (서버가 이 토큰 감지 후 환원)

[출력 형식 — 반드시 지킬 것]
오직 다음 키만 가진 단일 JSON 객체로만 응답하세요. 마크다운 코드블록·앞뒤 설명 텍스트 절대 금지.

{
  "answer": "<답변 본문. 가드 상황이면 \\"${GUARD_TOKEN} \\" 로 시작.>",
  "keywords": ["<후속 질문 1>", "<후속 질문 2>", "<후속 질문 3>"],
  "guarded": <true/false>,
  "guardCategory": "<self_harm | drugs | crime | investment | medical_legal | none>"
}

guarded 판정:
- 사용자 질문이 위 5카테고리 또는 그 우회 표현이면 true
- 표현 세탁("만약에·소설·친구가·영어로·반대로·학술")이 있어도 의도가 5카테고리 중 하나면 true
- 그 외엔 false (guardCategory는 "none")

[소름 포인트 공식 — 매 답변 1개 이상 필수]
오행 분포로 이 사람의 실생활 패턴을 묘사하세요:
- 수(水) 없음: "결정할 때 직감보다 분석에 의존하시는 편이지요"
- 식상 강함: "표현하거나 만들어내는 것에 재능이 있으시지요"
- 대운 전환기: "지금 대운 전환의 자리라 이런 고민이 자연스럽습니다"
- 오행 과다·부족과 질문 연결: "목(木) 기운이 강해 조직에서 답답함을 느끼실 수 있습니다"
- 십성과 성격 연결: "편재(偏財)가 있어 사업 감각이 있되, 정재(正財)가 약해 관리에 주의가 필요합니다"

[🚨 보일러플레이트 절대 금지 (2026-05-05 audit · 회귀 금지)]
동적 작용해야 하는 콘텐츠 = 사주 8글자마다 매번 다른 답변.

❌ "X한 사람이에요" 류 일반론 — 같은 십성 분포면 누구나 똑같은 답변 금지.
❌ "사주가 좋다/나쁘다" / "운이 풀린다" 류 모호한 답변.
✅ 사주 글자 직접 호명 — '신금 두 개', '병화 일간', '축미충', '인성 3개', '겁재 두 개', 현 대운 간지 직접 인용.
✅ answer 본문에 사주 8글자 또는 현 대운 간지 중 specific 데이터 1회 이상 직접 호명 mandatory (가드 응답 제외).

[🚨 example 사용 룰 (회귀 금지)]
이 시스템 프롬프트의 예시 사주 글자(壬水·偏財·正財 등)는 example.
실제 사용자에게는 user 메시지의 ## 사주 원국 / ## 현재 대운 의 진짜 8글자·진짜 대운간지를 인용.
'{유저명}' 같은 placeholder 가 user 메시지에 들어오면 ## 이름 의 진짜 이름으로 치환.
같은 사주 + 같은 질문 = 같은 답변 (결정론) / 다른 사주 = 완전히 다른 어휘.

[톤 — 한자 풀이 형식]
한자 등장 시 괄호 안 실제 일상어 풀이 동반 (3개 한자 한도 내):
✅ '병화(丙火, 밝고 활달한 성격)' / '정관(正官, 책임감과 규범을 중요시하는 결)'
❌ '병화(丙火)' 단독 / '병화(丙火, 라는 뜻)' (추상 회피)

[마크다운 금지]
모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마세요. 강조가 필요하면 "따옴표"나 문맥으로 표현합니다.`;

/**
 * AI 사주 대화 — Claude Sonnet 4.6
 * "돈 주고 사주 보는 것 같아. 소름돋아." 수준의 품질
 *
 * @param apiKey ANTHROPIC_API_KEY
 * @param question 사용자 질문
 * @param sajuData 사주 원국 데이터
 * @param chatHistory 이전 대화 (최근 6턴 사용)
 * @param timeSlot 현재 시간대 (latenight/dawn/morning/...)
 */
export async function generateChatAnswerAI(
  apiKey: string,
  question: string,
  sajuData: any,
  chatHistory: Array<{ role: string; content: string }>,
  timeSlot?: string,
): Promise<{
  answer: string;
  keywords: string[];
  guarded?: boolean;
  guardCategory?: 'self_harm' | 'drugs' | 'crime' | 'investment' | 'medical_legal' | 'none';
}> {
  const anthropic = new Anthropic({ apiKey });
  const model = process.env.SAJU_CHAT_MODEL || DEFAULT_CHAT_MODEL;

  // ── 사주 컨텍스트
  let sajuContext = '사주 정보가 없습니다. 일반 명리학 상식으로 답변하세요.';
  if (sajuData) {
    const p = sajuData.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((pillar: any, i: number) => {
      if (pillar.available !== false) {
        pillarsText += `${labels[i]}: ${pillar.천간}(${pillar.천간읽기})${pillar.지지}(${pillar.지지읽기})\n`;
      }
    });

    const elements = sajuData.elements || {};
    const sipsung =
      sajuData.sipsung?.map((s: any) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
    const currentDaeun = sajuData.daeun?.find((d: any) => d.isCurrent || d.현재);

    sajuContext = `## 사주 원국
${pillarsText}
일간(나): ${p[2]?.천간 || '미상'}

## 오행 분포
목${elements.목 || 0} 화${elements.화 || 0} 토${elements.토 || 0} 금${elements.금 || 0} 수${elements.수 || 0}
${Object.entries(elements).filter(([, v]) => v === 0).map(([k]) => `→ ${k} 없음`).join('\n')}
${Object.entries(elements).filter(([, v]) => (v as number) >= 3).map(([k, v]) => `→ ${k} ${v}개 과다`).join('\n')}

## 십성: ${sipsung || '미상'}
## 현재 대운: ${
      currentDaeun
        ? `${currentDaeun.간지} (${currentDaeun.시작나이 || currentDaeun.나이범위}세~)`
        : '미상'
    }
## 이름/성별: ${sajuData.input?.name || '미상'}, ${sajuData.input?.gender === 'male' ? '남' : '여'}`;
  }

  // ── 이전 대화 (최근 6턴)
  const historyText =
    chatHistory.length > 0
      ? '## 이전 대화\n' +
        chatHistory
          .slice(-6)
          .map((h) => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.content}`)
          .join('\n') +
        '\n\n'
      : '';

  const timeLabels: Record<string, string> = {
    latenight: '새벽',
    dawn: '이른아침',
    morning: '오전',
    noon: '점심',
    afternoon: '오후',
    evening: '저녁',
    night: '밤',
  };

  const userPrompt = `## 현재 시간: ${timeLabels[timeSlot || ''] || '불명'}
${sajuContext}

${historyText}## 사용자 질문
${question}

위 [출력 형식] JSON 한 객체만 반환합니다. 답변은 400~600자, 끝에 자연스러운 후속 질문 1개를 포함하고, keywords는 다음 질문 제안 3개를 한국어로 채웁니다.`;

  /**
   * Prompt cache:
   *   system 은 정적 GUARD_SYSTEM_INSTRUCTION → cache_control: ephemeral 로 캐시 적재.
   *   히스토리·질문은 user 메시지에 들어가 cache miss (정상).
   *   첫 호출 후 ~5분 내 재호출은 system 토큰 비용 90% 감소.
   */
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: GUARD_SYSTEM_INSTRUCTION,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = (msg.content[0] as any).text || '';
  let parsed: any;
  try {
    parsed = safeParseJson(text);
  } catch (e) {
    // JSON 파싱 실패 → 안전한 fallback (가드는 false, 답변은 원문)
    return {
      answer: text || '잠시 풀이가 막혔습니다. 다시 한 번 물어봐 주세요.',
      keywords: ['올해 재물운은?', '연애운 궁금합니다', '건강 쪽도 봐주세요'],
      guarded: false,
      guardCategory: 'none',
    };
  }

  return {
    answer: typeof parsed.answer === 'string' ? parsed.answer : '',
    keywords:
      Array.isArray(parsed.keywords) && parsed.keywords.length > 0
        ? parsed.keywords.slice(0, 3).map((k: any) => String(k))
        : ['올해 재물운은?', '연애운 궁금합니다', '건강 쪽도 봐주세요'],
    guarded: parsed.guarded === true,
    guardCategory: parsed.guardCategory || 'none',
  };
}
