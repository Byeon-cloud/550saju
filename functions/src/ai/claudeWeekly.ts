import Anthropic from '@anthropic-ai/sdk';
import { MYEONGRI_GROUNDS_BLOCK } from './promptsV3';
import { kstNowDate } from '../utils/kstTime';

/**
 * 주간운세 (이번 주 7일) — Claude Sonnet 4.6
 * 2026-06-29 NEW 출시 (5운). 오늘운세(1일)·월운(12개월 거시)와 시간 해상도로 분리된 "이번 주 7일 미시 흐름".
 *
 * weekDays = 클라(WeeklyPage)가 lunar-javascript 로 계산한 이번 주 월~일 7일:
 *   [{ day:'월', date:'6/30', ganji:'갑자', ganjiRead:'갑자' }, ...7]
 *   → 서버가 일진 간지를 추측하지 않고 정확한 간지를 그대로 AI 에 주입(만세력 정확성 보장).
 *
 * 퀄리티 레버(준기 결정): 1차 생성 → 2차 자기리뷰(체크리스트 자가 보정) → 반환.
 */
export async function generateWeeklyFortune(apiKey: string, sajuData: any, weekDays?: any[]): Promise<any> {
  const anthropic = new Anthropic({ apiKey });
  const days = Array.isArray(weekDays) && weekDays.length === 7 ? weekDays : fallbackWeek();
  const prompt = buildPrompt(sajuData, days);

  // ── 1차 생성 ──
  const first = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 12000,
    temperature: 0.1, // 결정론적 — 같은 사주 + 같은 주 = 같은 결과
    messages: [{ role: 'user', content: prompt }],
  });
  const firstText = (first.content[0] as any).text;

  // ── 2차 자기리뷰 (퀄리티 레버) ──
  const review = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 12000,
    temperature: 0.1,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: firstText },
      { role: 'user', content: buildReviewPrompt(days) },
    ],
  });
  const reviewText = (review.content[0] as any).text;

  const jsonMatch = reviewText.match(/\{[\s\S]*\}/) || firstText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON 파싱 실패');
  return JSON.parse(jsonMatch[0]);
}

/** weekDays 누락 시 폴백 — 구매일 전날부터 7일(요일 라벨만, 간지 미상). 정상 경로는 항상 클라가 7일 간지 동봉. */
function fallbackWeek(): any[] {
  const base = kstNowDate(); // KST 오늘(UTC 필드에 KST 값) — 서버 UTC 라도 날짜 안 밀림
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const out: any[] = [];
  for (let i = -1; i <= 5; i++) { // -1=어제(구매 전날) ~ +5 → 총 7일
    const d = new Date(base.getTime() + i * 86400000);
    out.push({ day: WD[d.getUTCDay()], date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, ganji: '미상', ganjiRead: '' });
  }
  return out;
}

function buildPrompt(d: any, days: any[]): string {
  const p = d.pillars || [];
  const labels = ['년주', '월주', '일주', '시주'];
  let pillarsText = '';
  p.forEach((x: any, i: number) => {
    if (x.available !== false) pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`;
  });
  const el = d.elements || {};
  const sipsung = d.sipsung?.map((s: any) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
  const ilgan = p[2]?.천간 || '미상';

  const weekTable = days
    .map((x) => `- ${x.day}요일 ${x.date}: 일진 ${x.ganji}(${x.ganjiRead || ''})`)
    .join('\n');
  const rangeStr = `${days[0]?.date} ~ ${days[6]?.date}`;

  return `당신은 사주500 명리학 해석가. ${MYEONGRI_GROUNDS_BLOCK}

주간운세 — 사주 원국 일간과 앞으로 7일 일진(日辰)의 충/합에서 추출한 진짜 근거.

⚠️ 운세 기간: ${rangeStr} (구매일 전날부터 7일 · 아래 '7일 일진' 표의 날짜·요일·간지를 그대로 사용)
- 이미 지난 날은 과거형, 오늘 이후는 미래형으로.

## 사주 원국
${pillarsText}일간: ${ilgan}

## 오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
## 십성: ${sipsung || '미상'}

## 이번 주 7일 일진 (정확 계산 — 이 간지를 그대로 인용, 절대 임의로 바꾸지 말 것)
${weekTable}

## 이름: ${d.input?.name || '미상'}, 성별: ${d.input?.gender === 'male' ? '남' : '여'}

## 출력 (JSON만, 코드블록 없이)
⚠️ **점수 룰 (PD 결단)**: 모든 score 는 5의 배수만 반복 금지. 67·73·81·88 처럼 자연수. 7일 score 가 전부 다른 값이어야 함(평평한 그래프 X — 요일별 일진에 따라 굴곡).

🚨 **톤 룰 (외계어 X · 일상어 O)**
❌ 금지: 시적 비유 폭격('한낮의 태양' 류), 문어체('결'·'자리'·'형국' 한 문단 2회 이내), 모호/중의 표현, 한자 폭격.
✅ 각 문장 = 일상어 결론 먼저. 사주 근거는 두 번째 문장부터, 한자는 1회만 + 즉시 일상어 풀이.
🚨 **독자 = 사주를 1도 모르는 일반인.** 명리 용어(십성·격국·충·합 등)를 문장의 주어/핵심으로 쓰지 말 것 — 주어는 항상 '쉬운 일상 결론'. 괄호 한자는 한 body 당 2개 이하(누적 금지). 누가 읽어도 한 번에 이해되는 짧고 단호한 문장으로.

🚨 **한자 풀이 강제**: 한자 등장 시 괄호 안에 실제 일상어 풀이.
✅ '갑자일(甲子日, 새 출발 기운이 강한 날)' / '신금(辛金, 깔끔하고 단정한 성격)' / '자오충(子午沖, 마음이 들뜨고 충돌이 잦은 자리)'
❌ '갑자일(甲子日)' 단독 / '(라는 뜻)' 같은 회피 금지.

🚨 **어조 (인플루언서 피드백)**
1. 면피·애매 표현 0건('~일 수 있습니다 / ~인 편입니다 / ~듯합니다' 금지). 단정형으로.
2. 단정형: "이번 주는 ~한 때입니다." "수요일은 ~하세요."
3. 소름 훅 1회: "혹시 최근에 ~하지 않으셨나요?"
4. 명령형 솔루션: "수요일엔 ~를 피하세요." (애매한 권유 X)
5. 동어반복 금지 — 7일이 서로 다른 정보.

🚨 **보일러플레이트 절대 금지** — 7일 각 body 는 그날 일진 간지 × 일간(${ilgan}) 충/합·생극을 직접 호명. 근거 없는 일반론('좋은 날입니다') 금지.
✅ 예: '수요일 갑자일(甲子日) — 일간 ${ilgan}과 만나 ~한 기운', '금요일 일진과 일지가 충돌해 ~'.

🚨 **example 룰**: 위 예시의 간지(갑자·신금 등)는 example. 실제로는 ## 사주 원국 의 진짜 8글자 + ## 7일 일진 의 진짜 간지를 인용. '{유저명}' 은 진짜 이름으로. 같은 사주+같은 주 = 같은 결과.

{
  "keywords": ["#이번주키워드1","#키워드2","#키워드3"],
  "weekHeadline": "이번 주를 한 줄로 (25자 이내, 일상어 결론 + 후크)",
  "weekTheme": "180자 이상. 이번 주 핵심 테마. 🚨 왜 이런 주인지 — 이번 주 일진 전반 흐름 + 일간 ${ilgan} 기준 specific 호명 (보일러플레이트 금지).",
  "bestDay": "요일(월~일 중)",
  "cautionDay": "요일(월~일 중)",
  "keyDays": [
    {"day":"요일","date":"M/D","type":"best 또는 caution","reason":"80자 이상 · 🚨 해당일 일진 간지 × 일간 ${ilgan} 직접 호명 + 구체 행동"}
  ],
  "dailyBreakdown": [
    {"day":"월","date":"M/D","ganji":"해당일 일진 간지(위 표 그대로)","score":1-100,"tone":"한 줄 요약(15자 이내)","body":"150자 이상 · 🚨 그날 일진 간지 × 일간 ${ilgan} 충/합 직접 호명","action":"오늘의 구체 행동팁 1가지"}
  ],
  "weekLesson": "150자 이상. 이번 주 전체를 관통하는 교훈 + 실천 1가지(명령형)."
}

⚠️ keyDays 는 2~3개, dailyBreakdown 은 위 '7일 일진' 표 순서대로 7개 전부(첫날=구매 전날). score 는 dailyBreakdown 7일 곡선이 굴곡지게. 마크다운 서식(**볼드** 등) 절대 금지 — 순수 한국어.`;
}

function buildReviewPrompt(days: any[]): string {
  return `위에서 네가 만든 주간운세 JSON 을 아래 체크리스트로 자가 점검하고, 어긴 부분을 모두 고쳐 **최종 JSON 만** 다시 출력하라 (코드블록·설명 없이 JSON 만).

체크리스트:
1. dailyBreakdown 이 정확히 7개(월~일)이고, 각 day/date/ganji 가 위 '7일 일진' 표와 100% 일치하는가? (간지 임의 변경 0)
2. 각 dailyBreakdown.body 가 그날 일진 간지 × 일간 충/합을 직접 호명했는가? 근거 없는 일반론 0건?
3. 면피·애매 표현('~일 수 있습니다 / ~인 편입니다 / ~듯합니다 / ~경향') 0건? 전부 단정형?
4. 한자 등장 시 괄호 일상어 풀이 동반? '(라는 뜻)' 류 회피 0건?
5. 글자수 floor 충족? (weekTheme 180자+, 각 body 150자+, weekLesson 150자+, keyDays reason 80자+)
6. score 7일이 5의 배수 반복 없이 서로 다른 자연수로 굴곡지는가?
7. weekHeadline 이 일상어 결론 + 후크인가? 시적 비유·외계어 0건?
8. bestDay/cautionDay 가 월~일 중 하나이고 dailyBreakdown 점수와 모순 없는가?

고칠 게 없으면 그대로, 있으면 보정해서 최종 JSON 출력.`;
}
