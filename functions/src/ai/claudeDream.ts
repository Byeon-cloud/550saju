// Migrated from geminiDream.ts on 2026-04-19 (Sonnet 4.6 v3).
// See commit 926ead2 + docs/prd/AI프롬프트_v3_Sonnet4.6.md

import { realName } from '../shared/personName';
import { TONE_FINAL_CHECK, READING_VOICE_BLOCK } from './promptsV3';
import { createClaude, CLAUDE_MODEL } from '../shared/claudeClient';
import { sanitizeAiOutput, lifeTimelineFactsText, sajuCoreFactsText, ganziKo, natalRelationsText } from './sajuFacts';
import { kstNow, kstNowDate } from '../utils/kstTime';
// 2026-10-22 — 오늘 일진과 이달 월주를 서버가 계산하고, 신살은 확정표만 쓰게(점검 P0-5)
import { Solar } from 'lunar-javascript';
import { myeongriSinsalText } from './sinsal';
import {
  DREAM_FREE_SYSTEM_V3,
  DREAM_FREE_USER_WITH_SAJU_V3,
  DREAM_FREE_USER_NO_SAJU_V3,
  DREAM_FREE_USER_GROUP_A_V3,
  DREAM_FREE_USER_GROUP_B_V3,
  DREAM_DEEP_SYSTEM_V3,
  DREAM_DEEP_USER_V3,
  SELF_REVIEW_V3,
  parseJsonResponse,
  type ParseJsonMeta,
} from './promptsV3';
import { logAnthropicUsage } from '../shared/aiUsageLog';
import { repairAniraSentences } from '../shared/toneRepair';

/**
 * 꿈해몽 — Claude Sonnet 4.6
 *   v3 전환 (2026-04-19): Gemini 2.5 Pro → Sonnet 4.6.
 *   파일명도 geminiDream.ts → claudeDream.ts 로 git mv (히스토리 보존).
 *   Opus 는 비용 문제로 보류, Haiku 는 퍼널 품질 문제로 제외.
 */

interface DreamSajuContext {
  name: string;
  yearGanzi: string;
  monthGanzi: string;
  dayGanzi: string;
  timeGanzi: string;
  ilgan: string;
  ilganOheng: string;
  ohengDistribution: Record<string, number>;
  yongsin?: string;
  currentDaeun?: string;
  /** 심층용 풀 데이터 (십성·지장간·용신·대운3년) */
  fullSajuData?: unknown;
}

export interface DreamFreeArgs {
  /** 사주 컨텍스트 (없으면 무사주 버전으로 호출) */
  saju?: DreamSajuContext;
  dreamContent: string;
  category: string;
  userConcern?: string;
}

export interface DreamDeepArgs {
  /** 심층은 사주 필수 */
  saju: DreamSajuContext;
  dreamContent: string;
  category: string;
  /** 무료 결과 요약 (방향 일관성 검증용) */
  freeResultSummary: { title: string; verdict: string; symbols: string[] };
}

const MODEL = CLAUDE_MODEL.sonnet;

/**
 * 2026-05-27 v8 — 2-그룹 병렬용 빌더.
 *   GROUP A = 무료 4섹션 (§01~§04), GROUP B = 잠금 5섹션 (§05~§09).
 *   각자 ~5000 토큰 → 병렬 max(A, B) ≈ 30-45초 (단일 60-90초 → 50% 단축).
 *   사주 없으면 GROUP B 생략 (잠금은 사주 기반이라).
 */
export type DreamFreeGroupId = 'A' | 'B';

export function buildDreamFreeGroupCall(args: DreamFreeArgs, group: DreamFreeGroupId): {
  system: string; user: string; model: string; maxTokens: number;
} {
  const system = DREAM_FREE_SYSTEM_V3;
  if (!args.saju) {
    // 사주 없으면 단일 callable fallback 사용 (Group B 없음)
    const user = DREAM_FREE_USER_NO_SAJU_V3({
      dreamContent: args.dreamContent,
      userConcern: args.userConcern,
      category: args.category,
    }) + dreamTodayBlock() + dreamFieldRules(false); // 2026-10-22 — 사주 없어도 오늘 날짜, 일진, 남은 요일과 칸별 규칙(점검 P0-5)
    return { system, user, model: MODEL, maxTokens: 14000 };
  }
  const headerData = {
    name: realName(args.saju.name) || '사용자',
    yearGanzi: args.saju.yearGanzi,
    monthGanzi: args.saju.monthGanzi,
    dayGanzi: args.saju.dayGanzi,
    timeGanzi: args.saju.timeGanzi,
    ilgan: args.saju.ilgan,
    ilganOheng: args.saju.ilganOheng,
    ohengDistribution: args.saju.ohengDistribution,
    yongsin: args.saju.yongsin,
    currentDaeun: args.saju.currentDaeun,
    dreamContent: args.dreamContent,
    userConcern: args.userConcern,
    category: args.category,
  };
  // 2026-10-15 품질 점검 — 앱 기본 경로(이 2그룹)에 짚기 블록과 십성 정보가 빠져 '인성이 천간에 없다'(년간 癸 편인) 같은 오류가 났다.
  //   두 그룹 모두 원국 확정표, 짚기 시기표와 규칙은 sajuTone 이 있는 A 에만(한 편에 한 번), B 는 짚기 질문 금지.
  const facts = dreamFactsBlock(args.saju);
  // 2026-10-22 — 두 그룹 모두 신살 확정표, 오늘과 이번 주, 칸별 규칙. 다가올 달 월주는 잠금 칸 그룹(B)에만(무료 칸이 달 이야기를 하지 않게)(점검 P0-5)
  const common = dreamSinsalBlock(args.saju) + dreamTodayBlock(args.saju);
  const user = group === 'A'
    ? DREAM_FREE_USER_GROUP_A_V3(headerData) + facts + dreamTimelineBlock(args.saju) + common + dreamFieldRules(true)
    : DREAM_FREE_USER_GROUP_B_V3(headerData) + facts + common + dreamUpcomingMonthsBlock(args.saju) + dreamFieldRules(true)
      + "\n→ 이 그룹에서는 '혹시 ~했나요?' 같은 짚기 질문을 쓰지 않는다(다른 그룹이 한 번 했다).";
  // 그룹별 토큰 분할 (2026-05-27 v10 — 안전 복원):
  //   v9 의 5500/5000 은 AI 가 JSON 못 끝내고 잘림 → 파싱 실패 → callable 폴백 → 1분 대기 회귀.
  //   A=7500 (무료 4섹션 + 충분한 안전 마진) · B=7000 (잠금 5섹션 + 안전 마진).
  //   문의 길이는 prompt 의 글자수 제한으로 잡고, maxTokens 는 safety net 으로.
  const maxTokens = group === 'A' ? 7500 : 7000;
  return { system, user, model: MODEL, maxTokens };
}

/**
 * 무료 꿈해몽 호출 파라미터 빌드 (system·user·model·maxTokens).
 * 스트리밍 SSE(generateDreamFreeStream)와 callable 이 동일 파라미터 공유 —
 * 프롬프트·모델·출력 100% 동일, 전송 방식만 다름 (콘텐츠 변경 위험 0).
 */
/** 2026-10-14 — 요즘 짚기 근거 (짚어 주는 풀이). 꿈 인자에는 간지 문자열만 오므로 원국 네 기둥을 다시 세워 계산한다.
 *  태어난 해를 모르면 지난 해 목록은 빠지고, 지금 대운, 올해, 최근 석 달만 들어간다. */
/** 꿈해몽은 간지 글자만 받는다 → 기둥을 다시 세워 원국 확정표(십성, 지지 속 글자, 기둥 자리 뜻)를 만든다 */
// 2026-10-22 — 원국 다시 세우기를 한 곳으로 모으고 available: true 를 붙인다. 신살 계산(sinsal.ts)은 available 이 없는 기둥을 건너뛴다(점검 P0-5)
const dreamPillar = (gz: string) => (gz && gz.length >= 2 && !gz.includes('미상') ? { 천간: gz[0], 지지: gz[1], available: true } : { available: false });
function dreamSajuData(saju: DreamSajuContext): any {
  const full: any = saju.fullSajuData;
  if (full?.pillars) return full;
  const yong = String(saju.yongsin || '').match(/[목화토금수]/)?.[0];
  return {
    pillars: [dreamPillar(saju.yearGanzi), dreamPillar(saju.monthGanzi), dreamPillar(saju.dayGanzi), dreamPillar(saju.timeGanzi)],
    myeongriAnalysis: yong ? { 용신: yong } : {},
    currentDaeun: saju.currentDaeun && /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(saju.currentDaeun) ? { 간지: saju.currentDaeun.slice(0, 2) } : undefined,
  };
}

function dreamFactsBlock(saju: DreamSajuContext): string {
  try {
    return sajuCoreFactsText(dreamSajuData(saju));
  } catch { return ''; }
}

function dreamTimelineBlock(saju: DreamSajuContext): string {
  try {
    const sd = dreamSajuData(saju);
    const tl = lifeTimelineFactsText(sd, kstNowDate());
    if (!tl) return '';
    return `

${tl}
→ 짚기 자리: sajuTone 첫머리에서 위 표의 최근 석 달이나 이번 달 가운데 원국 지지 자리(월지, 일지, 년지, 시지)와 합충이 걸린 달 하나로 '요즘 짚기'를 한 번 한다. 일간만 걸린 달은 그런 달이 없을 때만 고른다. 영역은 그 자리의 영역 하나만 묻고 '일터나 관계'처럼 둘을 묶지 않는다. 물음표로 끝나는 질문 한 문장으로 묻는다(꼴: '지난 N월부터 [그 자리의 영역 하나]에서 [장면 하나]이 이어졌나요?'). '마음에 걸린 관계나 일이 하나쯤 있었을 것입니다'처럼 누구에게나 맞는 단정으로 쓰지 않는다. 다음 문장에서 그달 들어온 글자가 원국 어느 자리를 쳤는지 근거를 대고, 그 마음이 꿈에 어떤 모습으로 나왔는지 잇는다. 다른 필드에서는 다시 묻지 않는다.${READING_VOICE_BLOCK}`;
  } catch { return ''; }
}

/* 2026-10-22 (2차) — 짚기가 '지난 8월 이후 마음에 걸린 관계나 일이 하나쯤 있었을 것'처럼 묻지 않는 단정으로 나와 질문 꼴과 한 자리를 못박음 */
/* 2026-10-22 — 같은 10월 22일(己巳일)을 꿈해몽은 '오늘 들어오는 戊土'(이달 월주 戊戌)로 쓰고, 목요일 생성분에 '이번 주 월요일, 수요일'
 *   할 일을 정했다(점검 P0-5). 오늘 날짜, 요일, 일진, 이달 월주, 이번 주 남은 날을 서버가 한국 시간으로 계산해 넣는다.
 *   일진은 오늘의 운세(클라 dayInfo, hookFacts)와 같은 계산(Solar.fromYmd → getDayInGanZhi), 월주는 절기 기준(getMonthInGanZhiExact). */
const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];
const JIE_KO: Record<string, string> = {
  立春: '입춘', 惊蛰: '경칩', 驚蟄: '경칩', 清明: '청명', 立夏: '입하', 芒种: '망종', 芒種: '망종',
  小暑: '소서', 立秋: '입추', 白露: '백로', 寒露: '한로', 立冬: '입동', 大雪: '대설', 小寒: '소한',
};
const md = (d: Date) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;

function dreamTodayBlock(saju?: DreamSajuContext): string {
  try {
    const n = kstNow();
    const today = new Date(Date.UTC(n.year, n.month - 1, n.day));
    const w = today.getUTCDay();
    const dayGz = Solar.fromYmd(n.year, n.month, n.day).getLunar().getDayInGanZhi();
    const noon = Solar.fromYmdHms(n.year, n.month, n.day, 12, 0, 0).getLunar();
    const monthGz = noon.getMonthInGanZhiExact();
    let monthTurn = '';
    try {
      const jie = noon.getNextJie(true);
      const js = jie.getSolar();
      const nextGz = Solar.fromYmdHms(js.getYear(), js.getMonth(), js.getDay(), 23, 59, 0).getLunar().getMonthInGanZhiExact();
      const jn = JIE_KO[jie.getName()];
      if (nextGz && nextGz !== monthGz) monthTurn = `. ${js.getMonth()}월 ${js.getDay()}일${jn ? ` ${jn}` : ''}부터 ${nextGz}(${ganziKo(nextGz)})월로 바뀐다`;
    } catch { /* 절기 경계는 덧붙임 정보 */ }
    // 한 주는 월요일부터 일요일까지. 일요일이면 남은 날이 없다
    const rest: string[] = [];
    for (let k = 1; w !== 0 && w + k <= 7; k++) {
      const d = new Date(Date.UTC(n.year, n.month - 1, n.day + k));
      rest.push(`${WEEK_KO[d.getUTCDay()]}(${md(d)})`);
    }
    const tomorrow = new Date(Date.UTC(n.year, n.month - 1, n.day + 1));
    const sd = saju ? dreamSajuData(saju) : null;
    const rel = sd ? [natalRelationsText(dayGz, sd, '오늘 일진'), natalRelationsText(monthGz, sd, '이달 월주')].filter(Boolean).join('\n') : '';
    return `

## 오늘과 이번 주 (서버 계산, 한국 시간 기준)
- 오늘: ${n.year}년 ${n.month}월 ${n.day}일 ${WEEK_KO[w]}요일
- 오늘 일진: ${dayGz}(${ganziKo(dayGz)})일
- 이달 월주: ${monthGz}(${ganziKo(monthGz)})월${monthTurn}
- 내일: ${md(tomorrow)} ${WEEK_KO[tomorrow.getUTCDay()]}요일
- 이번 주 남은 날: ${rest.length ? rest.join(', ') : '없음(오늘 일요일로 이번 주가 끝난다. 할 일은 다음 주 날짜로 정한다)'}
${rel ? `${rel}\n` : ''}→ '오늘'이라고 쓸 때는 오늘 일진 ${dayGz}만 쓴다. 오늘 들어오는 글자는 ${dayGz[0]}와 ${dayGz[1]} 두 글자다.
→ '이달'이라고 쓸 때는 이달 월주 ${monthGz}만 쓴다. 두 간지를 서로 바꿔 쓰지 않는다.
→ 요일이나 날짜를 붙여 할 일을 정할 때는 오늘, 내일, 이번 주 남은 날, 다음 주 날짜만 쓴다. 이미 지난 요일에는 할 일을 정하지 않는다.`;
  } catch { return ''; }
}

/** 2026-10-22 — 잠금 lockedTimeline 의 달 고르기 근거. 이번 달부터 석 달 월주와 원국 관계(점검 P0-5, 7-5). 무료 칸 그룹(A)에는 넣지 않는다 */
function dreamUpcomingMonthsBlock(saju: DreamSajuContext): string {
  try {
    const n = kstNow();
    const sd = dreamSajuData(saju);
    const lines: string[] = [];
    for (let i = 0; i < 3; i++) {
      const y = n.year + Math.floor((n.month - 1 + i) / 12);
      const m = ((n.month - 1 + i) % 12) + 1;
      const gz = Solar.fromYmd(y, m, 15).getLunar().getEightChar().getMonth(); // 각 달 15일 = 절기 경계 피함(sajuFacts 와 같은 기준)
      const t = natalRelationsText(gz, sd, `${y}년 ${m}월 월주${i === 0 ? '(이번 달)' : ''}`);
      if (t) lines.push(t);
    }
    if (!lines.length) return '';
    return `

## 다가올 달 월주 (서버 계산. lockedTimeline 의 달은 이 표에서만 고른다)
${lines.join('\n')}`;
  } catch { return ''; }
}

/** 2026-10-22 — '도화살처럼 인연이 모이는 戌월'처럼 원국에 없는 신살을 지어냈다(점검 P0-5). sinsal.ts 확정 결과만 넘긴다 */
function dreamSinsalBlock(saju: DreamSajuContext): string {
  try {
    const t = myeongriSinsalText(dreamSajuData(saju).pillars || []);
    if (!t) return '';
    return `${t}→ 신살 이름은 위 목록에 있는 것만, 그 신살이 앉은 원국 글자와 함께 쓴다. 오늘 일진이나 달 간지에는 신살 이름을 붙이지 않는다. 목록이 전부 '없음'이면 신살 이름을 쓰지 않는다.`;
  } catch { return ''; }
}

/* 2026-10-22 — 칸별 규칙(점검 P0-5, 7-5). 스키마 본문은 promptsV3.ts 라 이 파일에서는 user 끝에 덧붙여 스키마 설명을 좁힌다. 필드 이름은 그대로.
 *   ① narrative 에 손님이 적지 않은 장면(거울 11번)을 보탬 ② symbols 5개를 채우려 꿈에 없는 상징을 만듦
 *   ③ 무료 sajuTone, todayConnection, sajuConnection 이 대운과 달을 다 풀어 1운 잠금과 차이가 없었다 → 대운과 달별 시기는 잠금 full 로.
 *   같은 1콜 안에서 칸만 옮기는 것이라 원가와 결제 동작(재호출 0, 화면 이동 0)은 그대로다. */
function dreamFieldRules(hasSaju: boolean): string {
  const common = `

## 칸별 지킬 것 (서버 규칙. 위 스키마 설명과 어긋나면 이 규칙을 따른다. 이번 응답에 없는 칸의 규칙은 건너뛴다)
1. narrative: 손님이 '꿈 내용'에 적은 장면만 다시 말한다. 적지 않은 장소, 물건(거울 같은 것), 개수, 사람을 보태지 않는다. 적힌 꿈이 짧으면 장면은 짧게 말하고, 남은 분량은 그 장면이 이 사람에게 뜻하는 바로 채운다.
2. symbols: 꿈 내용에 실제로 나온 것만 2~4개 고른다. 스키마에 적힌 5개는 이 규칙으로 바꾼다. keyword 는 꿈 내용에 나온 말로 쓴다. 꿈에 나오지 않은 물건이나 장면은 상징으로 만들지 않는다. oheng 은 전통 해석이 분명한 상징에만 적고, 분명하지 않으면 빈 문자열("")로 둔다.
3. 한자: 한 칸(필드 하나)에 한자 표기는 세 번까지 쓴다. 붙어 있는 간지 두 글자는 한 번으로 센다. 그 밖에는 한글 읽기나 쉬운 말(흙 기운, 물 기운)로 쓴다.`;
  if (!hasSaju) return `${common}
4. 신살 이름은 쓰지 않는다(사주 정보가 없어 계산할 수 없다).`;
  return `${common}
4. 신살: 신살 이름은 '명리 신살' 목록에 있는 것만 쓴다.
5. 무료 칸과 잠금 칸을 나눈다.
   - 무료로 보이는 칸: title, verdict, keywords, narrative, sajuTone, todayConnection, quoteInterpretations, symbols, ohengComparison, sajuConnection, interpretation, timeline, actionAdvice, luckyProfile, 잠금 다섯 칸의 teaser 와 intro, lockedWarnList.warns 첫째 detail.
   - 무료로 보이는 칸은 꿈 장면 풀이, 원국 글자와 꿈의 연결, 오늘 하루와 이번 주 남은 날까지만 쓴다.
   - 대운 이름과 대운 풀이, 앞으로 어느 달에 무엇을 할지 같은 달별 시기는 잠금 본문에만 쓴다: lockedDayganRead.full, lockedOhengFlow.full, lockedTimeline.full, lockedWarnList.warns 둘째와 셋째 detail, lockedAction 의 doList 와 dontList.
   - sajuTone 첫머리의 요즘 짚기 한 번은 그대로 둔다. sajuTone, sajuConnection.publicText, interpretation.future 는 일간, 원국 글자, 오늘 일진, 이번 주 남은 날로 쓰고 분량 하한은 그대로 지킨다.
6. lockedTimeline: monthMarks 에 1을 두는 달은 '다가올 달 월주' 표의 달 가운데 1~2개만 고른다. teaser 는 고른 달을 숫자로 말하는 한 문장으로 쓴다(꼴: '이 꿈이 가리키는 달은 N월과 N월입니다.'). 그 달에 할 일과 까닭은 full 에만 쓴다.`;
}

export function buildDreamFreeCall(args: DreamFreeArgs): {
  system: string; user: string; model: string; maxTokens: number;
} {
  const system = DREAM_FREE_SYSTEM_V3;
  const user = args.saju
    ? DREAM_FREE_USER_WITH_SAJU_V3({
        name: realName(args.saju.name) || '사용자',
        yearGanzi: args.saju.yearGanzi,
        monthGanzi: args.saju.monthGanzi,
        dayGanzi: args.saju.dayGanzi,
        timeGanzi: args.saju.timeGanzi,
        ilgan: args.saju.ilgan,
        ilganOheng: args.saju.ilganOheng,
        ohengDistribution: args.saju.ohengDistribution,
        yongsin: args.saju.yongsin,
        currentDaeun: args.saju.currentDaeun,
        dreamContent: args.dreamContent,
        userConcern: args.userConcern,
        category: args.category,
      }) + dreamFactsBlock(args.saju) + dreamTimelineBlock(args.saju)
        // 2026-10-22 — 신살 확정표, 오늘과 이번 주, 다가올 달 월주, 칸별 규칙(점검 P0-5)
        + dreamSinsalBlock(args.saju) + dreamTodayBlock(args.saju) + dreamUpcomingMonthsBlock(args.saju) + dreamFieldRules(true)
    : DREAM_FREE_USER_NO_SAJU_V3({
        dreamContent: args.dreamContent,
        userConcern: args.userConcern,
        category: args.category,
      }) + dreamTodayBlock() + dreamFieldRules(false); // 2026-10-22 — 점검 P0-5
  return { system, user, model: MODEL, maxTokens: 14000 };
}

/** 무료 꿈해몽 — 사주 있으면 withSaju, 없으면 noSaju */
export async function generateDreamFree(apiKey: string, args: DreamFreeArgs): Promise<unknown> {
  const anthropic = createClaude(apiKey);
  const { system, user } = buildDreamFreeCall(args);

  // ── 단일 호출 (작동 검증본 — 2그룹 분할은 무료 콘텐츠 누락 회귀로 롤백) ──
  // max_tokens 14000: 잠금 본문(lockedXxx.full)까지 무료 호출에서 전부 생성.
  // 블러잠금 SSOT — 결제 시 재호출 0, 블러만 제거. 느려도 콘텐츠 정확성 우선.
  const meta1: ParseJsonMeta = { repairUsed: false };
  try {
    const _t1 = Date.now(); // C7
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 14000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user + TONE_FINAL_CHECK }],
    });
    logAnthropicUsage('dream', MODEL, msg, _t1, 'callable'); // C7 best-effort (truncated·cache 포함)
    const text = (msg.content[0] as { type: string; text: string }).text;
    const result = parseJsonResponse(text, meta1);
    if (meta1.repairUsed) console.info('[claudeDreamFree] jsonrepair 1차 발동 — 복구 성공');
    await repairAniraSentences(apiKey, result, 'dream'); // 2026-10-22 — 'X가 아니라 Y' 문장만 고쳐 끼움(점검 P0-1, 실패하면 원문)
    return sanitizeAiOutput(result);
  } catch (e1: any) {
    console.warn('[claudeDreamFree] 1차 실패 → 재시도:', e1?.message);
    const meta2: ParseJsonMeta = { repairUsed: false };
    const _t2 = Date.now(); // C7
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 14000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user + TONE_FINAL_CHECK }],
    });
    logAnthropicUsage('dream', MODEL, msg, _t2, 'callable'); // C7 best-effort (truncated·cache 포함)
    const text = (msg.content[0] as { type: string; text: string }).text;
    const result = parseJsonResponse(text, meta2);
    console.info('[claudeDreamFree] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
    await repairAniraSentences(apiKey, result, 'dream');
    return sanitizeAiOutput(result);
  }
}

/** 심층 꿈해몽 (유료 1운) — 1차 생성 후 2차 자기 리뷰 */
export async function generateDreamDeep(apiKey: string, args: DreamDeepArgs): Promise<unknown> {
  const anthropic = createClaude(apiKey);
  const system = DREAM_DEEP_SYSTEM_V3;
  const user = DREAM_DEEP_USER_V3({
    name: realName(args.saju.name) || '사용자',
    sajuData: args.saju.fullSajuData ?? args.saju,
    dreamContent: args.dreamContent,
    category: args.category,
    freeResultSummary: args.freeResultSummary,
  }) + dreamSinsalBlock(args.saju) + dreamTodayBlock(args.saju); // 2026-10-22 — 옛 심층 경로도 오늘 일진, 남은 요일, 신살 확정표를 같게(점검 P0-5)

  // 1차 생성 (파싱 실패 시 1회 재시도)
  let firstText: string;
  let firstJson: unknown;
  try {
    const meta1: ParseJsonMeta = { repairUsed: false };
    const _t1 = Date.now(); // C7
    const first = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16384,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user + TONE_FINAL_CHECK }],
    });
    logAnthropicUsage('deepDream', MODEL, first, _t1, 'callable'); // C7 best-effort (truncated·cache 포함)
    firstText = (first.content[0] as { type: string; text: string }).text;
    firstJson = parseJsonResponse(firstText, meta1);
    if (meta1.repairUsed) console.info('[claudeDreamDeep] 1차 jsonrepair 발동');
  } catch (e1: any) {
    console.warn('[claudeDreamDeep] 1차 실패 → 재시도:', e1?.message);
    const meta2: ParseJsonMeta = { repairUsed: false };
    const _t2 = Date.now(); // C7
    const retry = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16384,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user + TONE_FINAL_CHECK }],
    });
    logAnthropicUsage('deepDream', MODEL, retry, _t2, 'callable'); // C7 best-effort (truncated·cache 포함)
    firstText = (retry.content[0] as { type: string; text: string }).text;
    firstJson = parseJsonResponse(firstText, meta2);
    console.info('[claudeDreamDeep] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
  }

  // 2차 자기 리뷰
  const _t3 = Date.now(); // C7
  const review = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system,
    messages: [
      { role: 'user', content: user },
      { role: 'assistant', content: firstText },
      {
        role: 'user',
        content: SELF_REVIEW_V3({
          original: firstJson,
          kind: 'dream-deep',
          freeResult: args.freeResultSummary,
        }),
      },
    ],
  });
  logAnthropicUsage('deepDream', MODEL, review, _t3, 'callable'); // C7 best-effort (truncated·cache 포함)
  const reviewText = (review.content[0] as { type: string; text: string }).text;
  try {
    return sanitizeAiOutput(parseJsonResponse(reviewText));
  } catch {
    // 리뷰 파싱 실패 시 1차 결과 반환 (안전 fallback)
    return sanitizeAiOutput(firstJson); // 2026-10-13 — 리뷰 실패 폴백도 같은 정리기(가운뎃점, 씨, 줄표, 외래어)
  }
}
