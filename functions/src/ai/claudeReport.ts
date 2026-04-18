import Anthropic from '@anthropic-ai/sdk';

/**
 * 사주 리포트 — Claude Opus 4.6 (기본, 프리미엄 품질)
 *
 * 모델 정책 (CLAUDE.md + 전략기획서 v3.1):
 *   - 메인: claude-opus-4-6  (기본 — 500원 핵심 유료 상품 품질 유지)
 *   - 검증: claude-sonnet-4-6 (A/B 비교, 선택적 2차 자기 리뷰)
 *   - 보조: claude-haiku-4-5-20251001 (일일운세·꿈해몽 등 경량)
 *
 * ⚠️ 준기 지시: 퀄리티 다운그레이드 절대 불가.
 *   Sonnet 전환은 반드시 A/B 비교 후 품질 벤치 통과 시에만.
 *   환경변수 SAJU_REPORT_MODEL 로 런타임 오버라이드 가능 (A/B 테스트용).
 *
 * 핵심 유료 상품. 명리학 정통 분석 프레임워크 적용.
 * 격국→용신→각 영역 해석 순서로 구조화.
 */
const DEFAULT_REPORT_MODEL = 'claude-opus-4-6';

export async function generateSajuReport(apiKey: string, sajuData: any, situation: any, _reportType: string): Promise<any> {
  const anthropic = new Anthropic({ apiKey });
  const model = process.env.SAJU_REPORT_MODEL || DEFAULT_REPORT_MODEL;

  const systemPrompt = buildSystemPrompt(sajuData);
  const userPrompt = buildUserPrompt(sajuData, situation);

  const msg = await anthropic.messages.create({
    model,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = (msg.content[0] as any).text;
  const parsed = parseJsonResponse(text);

  return { content: { ...parsed, summary: parsed.sections?.[0]?.content?.slice(0, 100) + '...' } };
}

/** JSON 파싱 — 코드블록 제거 + 재시도 로직 */
function parseJsonResponse(text: string): any {
  // 1차: 코드블록(```json ... ```) 제거
  let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();

  // 2차: JSON 객체 추출
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`JSON 파싱 실패: 응답에서 JSON 객체를 찾을 수 없습니다. 응답 앞 200자: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e1) {
    // 3차: 흔한 JSON 오류 보정 (trailing comma, 제어문자)
    const sanitized = jsonMatch[0]
      .replace(/,\s*([}\]])/g, '$1')           // trailing comma
      .replace(/[\x00-\x1f\x7f]/g, (ch) =>     // 제어문자 이스케이프
        ch === '\n' ? '\\n' : ch === '\t' ? '\\t' : ch === '\r' ? '' : ''
      );
    try {
      return JSON.parse(sanitized);
    } catch (e2) {
      throw new Error(`JSON 파싱 실패 (보정 후에도 실패): ${(e2 as Error).message}. 응답 앞 300자: ${text.slice(0, 300)}`);
    }
  }
}

/** 시스템 프롬프트 — 명리학 분석 프레임워크 + 출력 규칙 (고정) */
function buildSystemPrompt(sajuData: any): string {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  return `당신은 명리학(命理學) 40년 대가입니다.
"자평진전", "적천수", "궁통보감", "연해자평", "명리정종", "삼명통회" 6대 원전에 정통한 전문가로서,
정통 명리학 분석 프레임워크에 따라 체계적으로 사주를 해석합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⭐ 분석 프레임워크 — 반드시 이 순서로 사고하고, 결론을 각 섹션에 반영하세요
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 1. 일간 강약(身强/身弱) 정밀 판단
- 득령(得令): 월지가 일간을 생(生)하거나 같은 오행인가? → 사주 강약의 40%를 결정
- 득지(得地): 일간이 지지에 통근(通根)하는가? (지장간 속에 일간과 같은 글자나 일간을 생하는 글자가 있는지 확인)
- 득세(得勢): 천간에 비겁/인성이 투출(透出)하여 일간을 돕는가?
→ 3가지 중 2가지 이상 충족 = 신강, 1가지 이하 = 신약
⚠️ 반드시 지장간까지 확인! 겉으로는 약해 보여도 지장간에 뿌리가 있으면 다름

### STEP 2. 격국(格局) 판단
"자평진전"의 정통 격국 판단법:
1) 월지 지장간의 본기(本氣)가 천간에 투출(透干)했는지 확인
2) 투출했으면 그것이 격국 → 예: 월지 子水 본기 壬水가 천간에 壬이 있으면 편인격
3) 본기가 투출 안 했으면 중기(中氣) → 여기(餘氣) 순서로 투출 확인
4) 아무것도 투출 안 했으면 월지 본기 자체로 격국 결정
→ 격국명: 정관격/편관격/정인격/편인격/식신격/상관격/정재격/편재격 중 판단
⚠️ 비견격/겁재격은 특수격. 월지 본기가 비겁인 경우 "건록격" 또는 "양인격"으로 분류

### STEP 3. 용신(用神) 도출
"적천수"와 "궁통보감"을 참고하여:
- 신강한 사주: 식상/재성/관성 중 원국에 있으면서 일간을 설기(洩氣)하는 오행 = 용신
- 신약한 사주: 인성/비겁 중 일간을 보호하는 오행 = 용신
- 중화 근처: 가장 부족한 오행이나, 격국을 성격(成格)시키는 오행 = 용신
→ 용신이 원국에 이미 있으면 길(吉), 대운/세운에서 와야 하면 시기별 기복
→ 모든 개운법/직업/색상/방향 추천은 반드시 용신 오행에서 파생되어야 함
→ 희신(喜神) = 용신을 생하는 오행, 기신(忌神) = 용신을 극하는 오행 반드시 명시

### STEP 4. 각 영역 해석 — 용신 기반
모든 해석에 반드시 다음 형식으로 근거를 제시:
"[사주 요소] 때문에 → [구체적 성향/사건]이 나타납니다"

예시:
✗ "당신은 리더십이 강합니다" (근거 없음 — 이런 식으로 쓰지 마세요)
✓ "일간 甲木이 신강하고 비견이 2개나 있어, 자기 주장이 강하고 독립심이 높습니다. 다만 편관이 없어 통제력은 약한 편이라, 조직보다는 프리랜서형 업무에서 빛을 발합니다."

### STEP 5. "소름 포인트" — 구체적 행동 패턴 적중
각 섹션에 최소 1개, 일상 행동/경험을 사주 근거로 정확히 짚어주세요:
✓ "결정을 내릴 때 머리로는 답을 알면서도 마음이 안 따라주는 경험이 많으셨을 거예요 — 일간 壬水가 편인 아래 갇혀있어서..."
✓ "주변에서 '너 왜 그렇게 참아?'란 말 자주 들으시죠 — 정관 2개가 일간을 압박하니까..."
✓ "돈을 벌어도 모으기가 어렵다고 느끼실 거예요 — 재성은 있는데 겁재가 옆에서 다 빼가는 구조..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 출력 형식 (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "sections": [
    {"id": "summary", "title": "종합 진단", "keyInsight": "이 사주를 관통하는 핵심 한 줄. 읽는 사람이 '어 이거 나인데?' 하고 소름 돋을 문장.", "content": "500자 이상. 격국+용신+핵심 특징 명확히. '이 사주는 O격에 신강/신약하며, 용신은 O입니다' 로 시작하되, 교과서가 아니라 이 사람만의 이야기처럼 풀어줘."},
    {"id": "structure", "title": "격국과 일간 분석", "keyInsight": "이 사주의 구조적 핵심을 비유로 한 줄 표현", "content": "500자 이상. STEP1~3의 분석 과정을 쉬운 비유로 풀어 설명. '당신의 사주는 마치 ~와 같다' 식의 비유 적극 활용. 전문용어(득령/투간/통근)를 쓰되 괄호 안에 쉬운 설명 병기."},
    {"id": "personality", "title": "성격과 기질", "keyInsight": "이 사람의 성격 본질을 꿰뚫는 한 줄 — 소름 돋게", "content": "400자 이상. 일간+격국 기반 성격. 소름포인트 필수: 구체적 일상 행동 묘사 → 사주 근거 연결."},
    {"id": "social", "title": "대인관계", "keyInsight": "이 사람의 관계 패턴을 한 줄로 정의", "content": "400자 이상. 비겁/관성/식상 구조에서 파생되는 관계 패턴. 어떤 타입과 충돌하고, 어떤 타입에게 끌리는지 사주 근거로."},
    {"id": "career", "title": "직업과 적성", "keyInsight": "이 사람이 빛나는 직업 환경을 한 줄로", "content": "400자 이상. 용신 오행과 연결되는 구체적 직업군 + '왜 이 직업이 맞는지' 사주 근거. 현실적 진로 조언."},
    {"id": "wealth", "title": "재물운", "keyInsight": "이 사람의 돈과의 관계를 한 줄로 — 벌기vs모으기 핵심", "content": "400자 이상. 재성의 위치/강약 + 겁재/식상과의 상호작용. 돈이 새는 구멍과 증식 시기."},
    {"id": "love", "title": "애정운", "keyInsight": "연애/결혼 패턴의 핵심을 한 줄로 — 왜 그런 사람에게 끌리는지", "content": "400자 이상. 일지(배우자궁)의 오행/십성이 배우자 성향을 결정. 연애 패턴의 사주 근거."},
    {"id": "health", "title": "건강운", "keyInsight": "건강에서 가장 주의할 한 가지", "content": "400자 이상. 오행 과부족 → 취약 장기. 용신 오행이 약해지는 시기의 건강 주의. 구체적 생활습관."},
    {"id": "year${year}", "title": "${year}년 운세", "keyInsight": "${year}년 전체를 관통하는 키워드 한 줄", "content": "500자 이상. ⚠️ 현재 ${month}월 기준 시제 엄격 구분. 세운 간지와 원국의 상호작용, 용신과의 관계. 상반기/하반기 흐름 차이."},
    {"id": "daeun", "title": "대운 흐름", "keyInsight": "지금 인생에서 어떤 시기인지 한 줄 정의", "content": "400자 이상. 현재 대운의 의미, 이전 대운과의 변화, 다음 대운 전환점."},
    {"id": "mission", "title": "인생 과제", "keyInsight": "이 사람이 평생 씨름할 근본 과제 한 줄", "content": "400자 이상. 격국/용신에서 파생되는 근본적 과제. 기신을 다루는 구체적 방법."},
    {"id": "luck", "title": "개운법", "keyInsight": "가장 효과적인 개운 행동 한 가지", "content": "400자 이상. ⚠️ 반드시 용신 오행에서 파생! 색상/방위/음식/직업환경/행동습관을 용신 기반으로 구체적으로."}
  ],
  "analysisBase": {
    "격국": "O격",
    "일간강약": "신강/신약/중화",
    "용신": "O행",
    "용신근거": "한 줄 설명",
    "희신": "용신을 생하는 오행",
    "기신": "용신을 극하는 오행"
  },
  "scores": {"career": 0-100, "love": 0-100, "wealth": 0-100, "social": 0-100, "health": 0-100, "potential": 0-100},
  "luckyProfile": {
    "colors": ["#hex1", "#hex2"], "colorNames": ["색상명1", "색상명2"],
    "numbers": [숫자1, 숫자2], "direction": "방위", "day": "요일",
    "foods": ["음식1", "음식2", "음식3"], "element": "용신 오행"
  },
  "careerFit": [{"job": "직업명", "score": 0-100, "reason": "사주 근거"}, ...5개],
  "monthlyFortune": [{"month": 1, "score": 0-100}, ...12개월],
  "relationshipMap": {
    "work": {"score": 0-100, "keyword": "한마디"},
    "friend": {"score": 0-100, "keyword": "한마디"},
    "lover": {"score": 0-100, "keyword": "한마디"}
  },
  "wealthFlow": {
    "earning": {"score": 0-100, "style": "벌기 스타일"},
    "spending": {"score": 0-100, "style": "쓰기 스타일"},
    "saving": {"score": 0-100, "style": "모으기 스타일"}
  }
}

## ⚠️ 작성 규칙
1. 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로.
2. 각 section의 content는 단락을 나눠 가독성 있게. 한 문단 3줄 이내.
3. 한자가 나오면 반드시 한국어 읽기를 병기: "정관(正官)" 식으로.
4. '${year}년 운세' 섹션은 반드시 현재 ${month}월 기준으로 시제 구분.
5. analysisBase는 반드시 채우세요 — 프론트엔드에서 격국/용신 배지로 표시합니다.
6. luckyProfile의 모든 항목은 용신 오행에서 파생되어야 합니다. 용신이 목이면 색상=초록, 방위=동, 음식=신맛 등.
7. careerFit의 reason에 사주 근거를 한 줄로 적으세요.

JSON만 출력하세요. 코드블록 없이.`;
}

function buildUserPrompt(sajuData: any, situation?: any): string {
  const p = sajuData.pillars || [];
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const dateStr = `${year}년 ${month}월 ${today.getDate()}일`;

  // ── 사주 원국 (시일월년 순서 — 전통 명리학 표기) ──
  const labels = ['년주', '월주', '일주', '시주'];
  let pillarsText = '';
  // 전통 순서: 시주 → 일주 → 월주 → 년주
  const order = p[3]?.available ? [3, 2, 1, 0] : [2, 1, 0];
  for (const i of order) {
    const x = p[i];
    if (x?.available !== false) {
      pillarsText += `  ${labels[i]}: ${x.천간}(${x.천간읽기}, ${x.천간오행}) ${x.지지}(${x.지지읽기}, ${x.지지오행})\n`;
    }
  }

  // ── 오행 분포 ──
  const el = sajuData.elements || {};
  const elText = Object.entries(el)
    .map(([k, v]) => `${k}: ${v}개${v === 0 ? ' ⚠️없음' : (v as number) >= 4 ? ' ⚠️과다' : ''}`)
    .join(', ');

  // ── 십성 배치 (전체) ──
  const sipsung = sajuData.sipsung || [];
  const sipsungText = sipsung
    .map((s: any) => `${s.position}: ${s.글자}(${s.십성})`)
    .join('\n  ');

  // ── 지장간 ──
  const jijanggan = sajuData.jijanggan || [];
  const jijangganText = jijanggan
    .map((j: any) => `${j.지지}: [${j.지장간.join(', ')}] → 십성: [${j.십성.join(', ')}]`)
    .join('\n  ');

  // ── 12운성 ──
  const unyoung = sajuData.unyoung12 || [];
  const unyoungText = unyoung
    .map((u: any) => `${u.position}: ${u.운성}`)
    .join(', ');

  // ── 명리학 분석 데이터 ──
  const ma = sajuData.myeongriAnalysis;
  let myeongriSection = '';
  if (ma) {
    const distText = `비겁: ${ma.십성분포.비겁}, 식상: ${ma.십성분포.식상}, 재성: ${ma.십성분포.재성}, 관성: ${ma.십성분포.관성}, 인성: ${ma.십성분포.인성}`;
    const hchText = ma.형충합?.length > 0
      ? ma.형충합.map((h: any) => `${h.positions.join('↔')}: ${h.desc}`).join('\n  ')
      : '원국 내 형충합 없음';

    myeongriSection = `
## 명리학 핵심 분석 참고 데이터
일간: ${ma.일간} (${ma.일간오행})
월령(月令): ${ma.월령} (${ma.월령오행}) → 득령 ${ma.득령 ? '✓ (월지가 일간을 돕는 계절)' : '✗ (월지가 일간을 돕지 않는 계절)'}
일간 강약 경향: ${ma.일간강약} [${ma.강약근거}]
  ※ 이 경향은 참고용. 반드시 지장간 본기/여기 + 통근 여부까지 종합하여 직접 판단하세요.

## 십성 5분류 분포
${distText}
  → 비겁+인성(일간 도움) vs 식상+재성+관성(일간 소모) 비율을 반드시 확인

## 형충합(刑沖合) 관계
  ${hchText}`;
  }

  // ── 대운 ──
  const currentDaeun = sajuData.currentDaeun;
  const daeunText = currentDaeun
    ? `${currentDaeun.간지} (${currentDaeun.시작나이}세~${currentDaeun.끝나이}세)`
    : '미상';

  // ── 공망 ──
  const gongmang = sajuData.gongmang || [];
  const gongmangText = gongmang
    .map((g: any) => `${g.기준}: ${g.공망}`)
    .join(', ');

  return `아래 사주 원국을 분석해주세요. 현재 날짜: ${dateStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 사주 원국 (四柱原局)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${pillarsText}
일간(日干, 나 자신): ${p[2]?.천간 || '미상'}(${p[2]?.천간읽기 || ''}, ${p[2]?.천간오행 || ''})
생년월일: ${sajuData.input?.birthYear}/${sajuData.input?.birthMonth}/${sajuData.input?.birthDay}
성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}
${sajuData.띠 ? `띠: ${sajuData.띠}` : ''}

## 오행 분포 (五行分布)
${elText}

## 십성 배치 (十星配置)
  ${sipsungText}

## 지장간 (支藏干) — 숨은 기운
  ${jijangganText}

## 12운성 (十二運星) — 일간의 기세
${unyoungText}
${myeongriSection}

## 현재 대운 (大運)
${daeunText}

## 공망 (空亡)
${gongmangText || '미상'}

${situation?.concern ? `## 현재 고민/관심사\n${situation.concern}` : ''}`;
}
