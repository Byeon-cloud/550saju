import Anthropic from '@anthropic-ai/sdk';
import { TONE_FINAL_CHECK } from './promptsV3';
import { MYEONGRI_GROUNDS_BLOCK, GOOSEBUMP_BLOCK } from './promptsV3';
import { kstNow } from '../utils/kstTime';
import { logAnthropicUsage } from '../shared/aiUsageLog';

/**
 * 사주 리포트 — Claude Opus 4.6 (기본, 프리미엄 품질)
 *
 * 모델 정책 (CLAUDE.md + 전략기획서 v3.1):
 *   - 메인: claude-opus-4-6  (기본 — 500원 핵심 유료 상품 품질 유지)
 *   - 검증: claude-sonnet-4-6 (A/B 비교, 선택적 2차 자기 리뷰)
 *   - 보조: claude-haiku-4-5-20251001 (일일운세·꿈해몽 등 경량)
 *
 * ⚠️ PD 결단: 퀄리티 다운그레이드 절대 불가.
 *   Sonnet 전환은 반드시 A/B 비교 후 품질 벤치 통과 시에만.
 *   환경변수 SAJU_REPORT_MODEL 로 런타임 오버라이드 가능 (A/B 테스트용).
 *
 * 핵심 유료 상품. 명리학 정통 분석 프레임워크 적용.
 * 격국→용신→각 영역 해석 순서로 구조화.
 */
const DEFAULT_REPORT_MODEL = 'claude-opus-4-6';

const GROUP_FOCUS: Record<ReportGroup, string> = {
  A: '\n\n## 이번 호출 범위\n위 출력 형식(JSON)에 명시된 필드 **만** 생성하세요 (정체성·구조 그룹: summary·structure·personality·social 섹션 + analysisBase). 다른 섹션·필드는 절대 출력하지 마세요. STEP1~5 분석은 전부 수행하되 결과는 이 그룹 필드에만 담습니다.',
  B: '\n\n## 이번 호출 범위\n위 출력 형식(JSON)에 명시된 필드 **만** 생성하세요 (현실 영역 그룹: career·wealth·love·health 섹션 + scores·careerFit·relationshipMap·wealthFlow). 다른 섹션·필드는 절대 출력하지 마세요. STEP1~5 분석은 전부 수행하되 결과는 이 그룹 필드에만 담습니다.',
  C: '\n\n## 이번 호출 범위\n위 출력 형식(JSON)에 명시된 필드 **만** 생성하세요 (시간·실천 그룹: 올해·대운·인생과제·개운법 섹션 + luckyProfile·monthlyFortune·health 5장기). 다른 섹션·필드는 절대 출력하지 마세요. STEP1~5 분석은 전부 수행하되 결과는 이 그룹 필드에만 담습니다.',
};

/** 사주 8글자 정통 순서대로 섹션 머지 (그룹 도착 순서 무관) */
const SECTION_ORDER = [
  'summary', 'structure', 'personality', 'social',
  'career', 'wealth', 'love', 'health',
  'daeun', 'mission', 'luck', // year는 동적 id라 별도 처리
];

async function callReportGroup(
  anthropic: Anthropic,
  model: string,
  sajuData: any,
  situation: any,
  group: ReportGroup,
): Promise<any> {
  const systemPrompt = buildSystemPrompt(sajuData, group);
  const userPrompt = buildUserPrompt(sajuData, situation) + GROUP_FOCUS[group];
  const call = async (temperature?: number) => {
    const _t0 = Date.now(); // C7 — 토큰 로깅용 (생성 로직 무관)
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 7000, // 그룹당 4섹션+부가 필드 — 16384 단일 → 3분할
      ...(temperature != null ? { temperature } : {}),
      // 프롬프트 캐싱 — 시스템(프레임워크+스키마)은 호출마다 동일 → 캐시 hit 시 TTFT·비용 절감 (품질 무관)
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt + TONE_FINAL_CHECK }],
    });
    logAnthropicUsage('report', model, msg, _t0); // C7 best-effort (truncated·cache 포함 · callable/stream 공용이라 via 미지정)
    return (msg.content[0] as any).text as string;
  };
  // 3그룹 병렬 + Promise.all 은 한 그룹만 파싱 실패해도 리포트 전체가 죽음.
  // → 그룹별 파싱 실패 시 temperature 0.3 으로 1회 재시도 (단일 호출 대비 견고성 회복).
  try {
    return parseJsonResponse(await call());
  } catch (e1: any) {
    console.warn(`[claudeReport:group${group}] 1차 파싱 실패 → 재시도:`, e1?.message);
    return parseJsonResponse(await call(0.3));
  }
}

/**
 * 사주 리포트 생성 — Opus 4.6 + 3그룹 병렬 분할 (종합사주와 동일 패턴).
 *  · 단일 16384 콜(~60-90s) → 3 그룹 7000 병렬(~25-35s, 가장 긴 그룹 시간)
 *  · 모든 그룹 동일 모델·동일 분석 프레임워크 → 퀄리티·통일성 유지
 *  · 클라이언트/SSE/배포 변경 0 — 기존 callable 경로가 그대로 빨라짐
 */
export async function generateSajuReport(apiKey: string, sajuData: any, situation: any, _reportType: string): Promise<any> {
  const anthropic = new Anthropic({ apiKey });
  const model = process.env.SAJU_REPORT_MODEL || DEFAULT_REPORT_MODEL;

  const t0 = Date.now();
  const [groupA, groupB, groupC] = await Promise.all([
    callReportGroup(anthropic, model, sajuData, situation, 'A'),
    callReportGroup(anthropic, model, sajuData, situation, 'B'),
    callReportGroup(anthropic, model, sajuData, situation, 'C'),
  ]);
  console.log(`[claudeReport] 3-group parallel done in ${Date.now() - t0}ms`);

  // ── 섹션 머지 (정통 순서로 정렬, year 동적 id 포함) ──
  const allSections = [
    ...(Array.isArray(groupA?.sections) ? groupA.sections : []),
    ...(Array.isArray(groupB?.sections) ? groupB.sections : []),
    ...(Array.isArray(groupC?.sections) ? groupC.sections : []),
  ];
  const yearSection = allSections.find((s: any) => /^year\d{4}$/.test(String(s?.id)));
  const orderedSections = [
    ...SECTION_ORDER.slice(0, 8) // summary..health
      .map((id) => allSections.find((s: any) => s?.id === id))
      .filter(Boolean),
    ...(yearSection ? [yearSection] : []),
    ...SECTION_ORDER.slice(8) // daeun, mission, luck
      .map((id) => allSections.find((s: any) => s?.id === id))
      .filter(Boolean),
  ];

  const merged = {
    sections: orderedSections,
    // A
    analysisBase: groupA?.analysisBase,
    // B
    scores: groupB?.scores,
    careerFit: groupB?.careerFit,
    relationshipMap: groupB?.relationshipMap,
    wealthFlow: groupB?.wealthFlow,
    // C
    luckyProfile: groupC?.luckyProfile,
    monthlyFortune: groupC?.monthlyFortune,
    health: groupC?.health,
    summary: orderedSections?.[0]?.content?.slice(0, 100) + '...',
  };

  return { content: merged };
}

/**
 * 그룹별 외부 호출 (SSE 엔드포인트가 그룹 도착 즉시 송출하기 위함).
 * generateSajuReport 와 동일 프롬프트·모델·재시도 로직 — 그룹 1개만.
 */
export async function generateReportGroup(
  apiKey: string,
  sajuData: any,
  situation: any,
  group: ReportGroup,
): Promise<any> {
  const anthropic = new Anthropic({ apiKey });
  const model = process.env.SAJU_REPORT_MODEL || DEFAULT_REPORT_MODEL;
  return callReportGroup(anthropic, model, sajuData, situation, group);
}

/**
 * 3 그룹 결과 머지 — generateSajuReport 와 동일 머지 로직.
 * SSE 가 그룹별 도착 후 최종 머지에 사용.
 */
export function mergeReportGroups(groupA: any, groupB: any, groupC: any): any {
  const allSections = [
    ...(Array.isArray(groupA?.sections) ? groupA.sections : []),
    ...(Array.isArray(groupB?.sections) ? groupB.sections : []),
    ...(Array.isArray(groupC?.sections) ? groupC.sections : []),
  ];
  const yearSection = allSections.find((s: any) => /^year\d{4}$/.test(String(s?.id)));
  const orderedSections = [
    ...SECTION_ORDER.slice(0, 8)
      .map((id) => allSections.find((s: any) => s?.id === id))
      .filter(Boolean),
    ...(yearSection ? [yearSection] : []),
    ...SECTION_ORDER.slice(8)
      .map((id) => allSections.find((s: any) => s?.id === id))
      .filter(Boolean),
  ];
  return {
    sections: orderedSections,
    analysisBase: groupA?.analysisBase,
    scores: groupB?.scores,
    careerFit: groupB?.careerFit,
    relationshipMap: groupB?.relationshipMap,
    wealthFlow: groupB?.wealthFlow,
    luckyProfile: groupC?.luckyProfile,
    monthlyFortune: groupC?.monthlyFortune,
    health: groupC?.health,
    summary: orderedSections?.[0]?.content?.slice(0, 100) + '...',
  };
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

export type ReportGroup = 'A' | 'B' | 'C';

/**
 * 그룹별 출력 스키마 (3그룹 병렬 분할 — 종합사주와 동일 패턴).
 *  A = 정체성·구조 (summary·structure·personality·social + analysisBase)
 *  B = 현실 영역  (career·wealth·love·health 섹션 + scores·careerFit·relationshipMap·wealthFlow)
 *  C = 시간·실천  (year·daeun·mission·luck + luckyProfile·monthlyFortune·health 5장기)
 * 같은 분석 프레임워크(STEP1~5)를 각 그룹이 독립적으로 수행 → 머지.
 */
function groupSchema(group: ReportGroup, year: number): string {
  if (group === 'A') {
    return `{
  "sections": [
    {"id": "summary", "title": "종합 진단", "keyInsight": "이 사주를 관통하는 핵심 한 줄. 읽는 사람이 '어 이거 나인데?' 하고 소름 돋을 문장. 🚨 보일러플레이트 금지 — 사주 8글자 specific 호명 1회 이상.", "content": "500자 이상. 격국+용신+핵심 특징 명확히. '이 사주는 O격에 신강/신약하며, 용신은 O입니다' 로 시작하되, 교과서가 아니라 이 사람만의 이야기처럼 풀어줘. 🚨 사주 specific 데이터 (예: '재성 N개', '도화살', '인성 3개') 직접 호명 mandatory."},
    {"id": "structure", "title": "격국과 일간 분석", "keyInsight": "이 사주의 구조적 핵심을 비유로 한 줄 표현", "content": "500자 이상. STEP1~3의 분석 과정을 쉬운 비유로 풀어 설명. '당신의 사주는 마치 ~와 같다' 식의 비유 적극 활용. 전문용어(득령/투간/통근)를 쓰되 괄호 안에 쉬운 설명 병기."},
    {"id": "personality", "title": "성격과 기질", "keyInsight": "이 사람의 성격 본질을 꿰뚫는 한 줄 — 소름 돋게", "content": "400자 이상. 일간+격국 기반 성격. 소름포인트 필수: 구체적 일상 행동 묘사 → 사주 근거 연결."},
    {"id": "social", "title": "대인관계", "keyInsight": "이 사람의 관계 패턴을 한 줄로 정의", "content": "400자 이상. 비겁/관성/식상 구조에서 파생되는 관계 패턴. 어떤 타입과 충돌하고, 어떤 타입에게 끌리는지 사주 근거로."}
  ],
  "analysisBase": {
    "격국": "O격",
    "일간강약": "신강/신약/중화",
    "용신": "O행",
    "용신근거": "한 줄 설명",
    "희신": "용신을 생하는 오행",
    "기신": "용신을 극하는 오행"
  }
}`;
  }
  if (group === 'B') {
    return `{
  "sections": [
    {"id": "career", "title": "직업과 적성", "keyInsight": "이 사람이 빛나는 직업 환경을 한 줄로", "content": "400자 이상. 용신 오행과 연결되는 구체적 직업군 + '왜 이 직업이 맞는지' 사주 근거. 현실적 진로 조언."},
    {"id": "wealth", "title": "재물운", "keyInsight": "이 사람의 돈과의 관계를 한 줄로 — 벌기vs모으기 핵심", "content": "400자 이상. 재성의 위치/강약 + 겁재/식상과의 상호작용. 돈이 새는 구멍과 증식 시기."},
    {"id": "love", "title": "애정운", "keyInsight": "연애/결혼 패턴의 핵심을 한 줄로 — 왜 그런 사람에게 끌리는지", "content": "400자 이상. 일지(배우자궁)의 오행/십성이 배우자 성향을 결정. 연애 패턴의 사주 근거."},
    {"id": "health", "title": "건강운", "keyInsight": "건강에서 가장 주의할 한 가지", "content": "400자 이상. 오행 과부족 → 취약 장기. 용신 오행이 약해지는 시기의 건강 주의. 구체적 생활습관."}
  ],
  "scores": {"career": 0-100, "love": 0-100, "wealth": 0-100, "social": 0-100, "health": 0-100, "potential": 0-100},
  "careerFit": [{"job": "직업명", "score": 0-100, "reason": "사주 근거"}, "...5개"],
  "relationshipMap": {
    "work": {"score": 0-100, "keyword": "한마디"},
    "friend": {"score": 0-100, "keyword": "한마디"},
    "lover": {"score": 0-100, "keyword": "한마디"}
  },
  "wealthFlow": {
    "earning": {"score": 0-100, "style": "벌기 스타일", "interpretation": "이 점수의 의미 — 일간·재성 카운트 등 사주 specific 인용 60~80자", "action": "실천 조언 — 일간 호명 포함 50~70자"},
    "spending": {"score": 0-100, "style": "쓰기 스타일", "interpretation": "이 점수의 의미 — 일간·비겁 카운트 등 사주 specific 인용 60~80자", "action": "실천 조언 — 일간 호명 포함 50~70자"},
    "saving": {"score": 0-100, "style": "모으기 스타일", "interpretation": "이 점수의 의미 — 일간·식상 카운트 등 사주 specific 인용 60~80자", "action": "실천 조언 — 일간 호명 포함 50~70자"}
  }
}`;
  }
  // group C
  return `{
  "sections": [
    {"id": "year${year}", "title": "${year}년 운세", "keyInsight": "${year}년 전체를 관통하는 키워드 한 줄", "content": "500자 이상. ⚠️ 현재 시제 엄격 구분. 세운 간지와 원국의 상호작용, 용신과의 관계. 상반기/하반기 흐름 차이."},
    {"id": "daeun", "title": "대운 흐름", "keyInsight": "지금 인생에서 어떤 시기인지 한 줄 정의", "content": "400자 이상. 현재 대운의 의미, 이전 대운과의 변화, 다음 대운 전환점. ⚠️ 이전·현재·다음 대운의 간지는 프롬프트의 '대운 흐름' 목록에 적힌 간지를 그대로 인용 — 임의 생성·순서 swap 절대 금지. 흐름 데이터가 없으면 현재 대운만 다루고 이전/다음 간지는 언급하지 말 것."},
    {"id": "mission", "title": "인생 과제", "keyInsight": "이 사람이 평생 씨름할 근본 과제 한 줄", "content": "400자 이상. 격국/용신에서 파생되는 근본적 과제. 기신을 다루는 구체적 방법."},
    {"id": "luck", "title": "개운법", "keyInsight": "가장 효과적인 개운 행동 한 가지", "content": "400자 이상. ⚠️ 반드시 용신 오행에서 파생! 색상/방위/음식/직업환경/행동습관을 용신 기반으로 구체적으로."}
  ],
  "luckyProfile": {
    "colors": ["#hex1", "#hex2"], "colorNames": ["색상명1", "색상명2"],
    "numbers": ["숫자1", "숫자2"], "direction": "방위", "day": "요일",
    "foods": ["음식1", "음식2", "음식3"], "element": "용신 오행"
  },
  "monthlyFortune": [{"month": 1, "score": 0-100}, "...12개월"],
  "health": {
    "wood": {"detail": "간·담·눈·근육 — 일간(예: 갑(甲)) 호명 + 목 N자 인용 60~80자"},
    "fire": {"detail": "심장·소장·혈관 — 일간 호명 + 화 N자 인용 60~80자"},
    "earth": {"detail": "비장·위·소화 — 일간 호명 + 토 N자 인용 60~80자"},
    "metal": {"detail": "폐·대장·피부 — 일간 호명 + 금 N자 인용 60~80자"},
    "water": {"detail": "신장·방광·뼈 — 일간 호명 + 수 N자 인용 60~80자"}
  }
}`;
}

/** 시스템 프롬프트 — 명리학 분석 프레임워크(공유) + 그룹별 출력 스키마 */
function buildSystemPrompt(sajuData: any, group: ReportGroup): string {
  const now = kstNow();
  const year = now.year;
  const month = now.month;

  return `당신은 사주500 명리학 해석가입니다.
${MYEONGRI_GROUNDS_BLOCK}
${GOOSEBUMP_BLOCK}

명리학(命理學) 깊이 있는 해석 — 자평진전·적천수·궁통보감 6대 원전 정통.
"자평진전", "적천수", "궁통보감", "연해자평", "명리약언", "삼명통회" 6대 원전에 정통한 전문가로서,
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
## 🚨 보일러플레이트 절대 금지 (2026-05-05 audit · 회귀 금지)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

동적 작용해야 하는 콘텐츠 = 사주 8글자마다 매번 다른 문장.

❌ 'X한 사람이에요' 류 일반론 — 같은 십성 분포면 누구나 똑같은 결과 나오는 문장 금지.
❌ '리더십이 강합니다' / '재물 흐름이 좋습니다' (근거 없는 일반론).
✅ 사주 글자 직접 호명 — '신금 두 개', '병화 일간', '축미충', '인성 3개', '겁재 두 개' 등.
✅ 개수·자리·신살 등 8글자에서 도출되는 specific 데이터를 반드시 1회 이상 인용.

각 section.content 의 첫 1~2문장에 사주 8글자 중 specific 데이터(글자명·개수·자리·신살명) 1회 이상 직접 호명 mandatory.

## 톤 룰
- 외계어 X · 일상어 O · 결론 직접 말하기.
- 한자 등장 시 괄호 풀이 강제: "병화(丙火, 밝고 활달한 성격)".
- ❌ "병화(丙火)" 단독 (사주 모르는 사람 멈춤).
- ❌ "병화(丙火, 라는 뜻)" (추상적 회피).
- 첫 문장은 결론 (비유로 시작 X).
- strong 강조는 일상 결론 한 줄에만 (한자 X).
- 마무리는 긍정·격려.

## 🚨🚨 어조 규칙 (2026-06-24 · 인플루언서 피드백 — 출력 본문 전체에 절대 준수)
1. 애매·면피 표현 전면 금지: "~일 수 있습니다 / ~인 편입니다 / ~경향이 있습니다 / ~듯합니다 / ~것 같습니다 / ~수도 있습니다" 류 0건. 모든 문장을 확신 있는 단정형으로 끝낸다.
2. 단정형으로 말한다: "당신은 ~한 사람입니다." "이 시기는 ~한 때입니다." (추측·완곡 X)
3. 과거 적중(소름 훅)을 섞는다: "혹시 예전에 ~한 일이 있지 않았나요?" "유독 ~할 때 ~하지 않으셨나요?" — 독자가 "어? 내 얘기네?" 하게.
4. 솔루션은 명령형: "앞으로는 이렇게 하세요." "~는 피하고 ~를 선택하세요." (애매한 권유 X, 분명한 지시 O)
5. 루즈함 차단: 같은 메시지를 앞·중간·끝에서 반복 금지. 각 단락은 새 정보. 구구절절·동어반복 금지.

## 🚨🚨 사주 '메커니즘 나열' 금지 (2026-06-02 — "너무 어렵다" 피드백 · 회귀 금지)
유저는 "왜 그런지의 명리학 원리"를 안 궁금해합니다. "나한테 뭐가 일어나는지"만 궁금합니다.
한자를 괄호로 풀어도, 간지끼리 상호작용을 기계적으로 나열하면 똑같이 떨어집니다.
❌ 절대 금지 (실제 떨어진 예시):
- ❌ "정미일이 현재 대운인 정사운과 천간이 겹치는 순간이 되기 때문입니다"
- ❌ "미토가 원국 인성과 만나면서 토기운을 강화시킵니다"
- ❌ "월지 인목과 시지 신금의 인신충이 정화의 영향으로 조화로워집니다"
✅ 올바른 방식 (근거 짧게 1번 → 즉시 "쉽게 말하면/즉," + 일상 결론):
- ✅ "그동안 쌓아온 게 결실로 이어지기 쉬운 흐름이에요. (사주로 보면 큰 흐름과 기운이 같은 방향이라 그래요.)"
규칙 (위반 = reject + 재작성):
1. 메커니즘(간지 겹침·충/합/형/해·대운-세운 관계·오행 강화)을 쓸 거면 한 문장 안에서 끝내고, 바로 "쉽게 말하면/즉," + 일상 의미를 붙인다.
2. 메커니즘 문장이 일상어 풀이 없이 2문장 이상 연속 = 무조건 reject.
3. 근거 < 결론. 의심되면 메커니즘 빼고 일상 결론만 남겨라.
4. 출력 전 자기검사: "사주 모르는 친구가 읽으면 이해할까?" No 면 일상어로 풀어 다시 써라.

## 🚨 example 사용 룰 (회귀 금지)
프롬프트 안의 예시 사주 글자(甲木·壬水·정관·축미충 등)는 example 입니다.
실제 사용자에게는 그 사람의 실제 8글자를 인용하세요.
같은 사주가 두 번 분석되면 같은 결과여야 하지만 (결정론), 다른 사주는 완전히 다른 어휘로 출력.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 출력 형식 (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${groupSchema(group, year)}

## ⚠️ 작성 규칙
1. 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로.
2. 각 section의 content는 단락을 나눠 가독성 있게. 한 문단 3줄 이내.
3. 한자가 나오면 반드시 한국어 읽기를 병기: "정관(正官)" 식으로.
4. '${year}년 운세' 섹션은 반드시 현재 ${month}월 기준으로 시제 구분.
5. analysisBase는 반드시 채우세요 — 프론트엔드에서 격국/용신 배지로 표시합니다.
6. luckyProfile의 모든 항목은 용신 오행에서 파생되어야 합니다. 용신이 목이면 색상=초록, 방위=동, 음식=신맛 등.
7. careerFit의 reason에 사주 근거를 한 줄로 적으세요.
8. wealthFlow의 interpretation/action 과 health.{wood,fire,earth,metal,water}.detail 은 반드시 사주 8글자를 직접 호명하세요. 예: "갑(甲) 일간이 재성 2개로 받쳐주는 안정적 수입 구조" / "을(乙) 일간이 화 0자라 심장·혈관에 부담이 갈 수 있어요". 같은 점수라도 일간 오행·십성 카운트가 다르면 문장이 달라야 합니다 — 일반론 금지.

JSON만 출력하세요. 코드블록 없이.`;
}

function buildUserPrompt(sajuData: any, situation?: any): string {
  const p = sajuData.pillars || [];
  const now = kstNow();
  const month = now.month;
  const year = now.year;
  const dateStr = `${year}년 ${month}월 ${now.day}일`;

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
  ${hchText}${ma.용신 ? `

## 용신·희신·기신 (SSOT · 결정론 산출 — luckyProfile/개운법은 이 값 그대로 사용, 재계산 금지)
용신 ${ma.용신} · 희신 ${ma.희신 || '-'} · 기신 ${ma.기신 || '-'} [${ma.용신근거 || ''}]
  ※ 행운 색·방위·음식·숫자는 전부 이 용신(${ma.용신}) 오행 하나로 도출 (일간/결손/대운 오행 아님).` : ''}`;
  }

  // ── 대운 ──
  // 2026-06-24 — 대운 전체 흐름을 명시(이전/현재/다음 간지+나이). 기존엔 currentDaeun 1개만 줘서
  //   AI 가 이전/다음 대운 간지를 데이터 없이 추측하다 뒤바꾸던 버그(차트는 맞는데 본문이 swap) fix.
  //   sajuData.daeun(전체 배열)이 있으면 결정론적으로 전달 → AI 가 추측·swap 불가.
  //   claudePremium.ts buildSajuBaseBlock 패턴 복제(필드명: 간지/시작나이/끝나이/isCurrent).
  const daeunList: any[] = Array.isArray(sajuData.daeun) ? sajuData.daeun : [];
  const curIdx = daeunList.findIndex((dd: any) => dd.isCurrent || dd.현재);
  const daeunAge = (dd: any) =>
    (dd?.시작나이 != null && dd?.끝나이 != null) ? `${dd.시작나이}세~${dd.끝나이}세` : (dd?.나이범위 || '');
  const daeunFlow = daeunList.length > 0
    ? daeunList.map((dd: any, i: number) => `- ${daeunAge(dd)} ${dd.간지}${i === curIdx ? ' ← 현재 대운' : ''}`).join('\n')
    : '';
  const prevDae = curIdx > 0 ? daeunList[curIdx - 1] : null;
  const nextDae = (curIdx >= 0 && curIdx < daeunList.length - 1) ? daeunList[curIdx + 1] : null;
  // 폴백: daeun 배열이 없으면 currentDaeun 단건만 정확히 (이전/다음은 언급 지시 안 함)
  const currentDaeun = sajuData.currentDaeun;
  const currentDaeunText = currentDaeun
    ? `${currentDaeun.간지} (${currentDaeun.시작나이}세~${currentDaeun.끝나이}세)`
    : '미상';
  const daeunText = daeunFlow
    ? `${daeunFlow}\n${curIdx >= 0
        ? `→ 이전 대운=${prevDae ? `${prevDae.간지}(${daeunAge(prevDae)})` : '없음'} · 현재 대운=${daeunList[curIdx].간지}(${daeunAge(daeunList[curIdx])}) · 다음 대운=${nextDae ? `${nextDae.간지}(${daeunAge(nextDae)})` : '없음'}. 이 간지·순서를 절대 바꾸지 말 것 — 이전/다음 대운 간지를 임의로 만들거나 뒤바꾸지 말고 위 목록 그대로 인용.`
        : `→ 현재 대운=${currentDaeunText}`}`
    : `${currentDaeunText}\n→ 전체 대운 흐름 데이터 없음. 현재 대운만 위 간지 그대로 인용하고, 이전/다음 대운 간지는 임의로 만들지 말 것(언급 생략).`;

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

## 대운 흐름 (大運 · 10년 단위 · 나이는 만 나이 기준)
${daeunText}

## 공망 (空亡)
${gongmangText || '미상'}

${situation?.concern ? `## 현재 고민/관심사\n${situation.concern}` : ''}`;
}
