// Migrated from geminiDream.ts on 2026-04-19 (Sonnet 4.6 v3).
// See commit 926ead2 + docs/prd/AI프롬프트_v3_Sonnet4.6.md

import { realName } from '../shared/personName';
import { TONE_FINAL_CHECK, READING_VOICE_BLOCK } from './promptsV3';
import { createClaude, CLAUDE_MODEL } from '../shared/claudeClient';
import { sanitizeAiOutput, lifeTimelineFactsText, sajuCoreFactsText } from './sajuFacts';
import { kstNowDate } from '../utils/kstTime';
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
    });
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
  const user = group === 'A'
    ? DREAM_FREE_USER_GROUP_A_V3(headerData) + facts + dreamTimelineBlock(args.saju)
    : DREAM_FREE_USER_GROUP_B_V3(headerData) + facts + "\n→ 이 그룹에서는 '혹시 ~했나요?' 같은 짚기 질문을 쓰지 않는다(다른 그룹이 한 번 했다).";
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
function dreamFactsBlock(saju: DreamSajuContext): string {
  try {
    const full: any = saju.fullSajuData;
    if (full?.pillars) return sajuCoreFactsText(full);
    const toP = (gz: string) => (gz && gz.length >= 2 && !gz.includes('미상') ? { 천간: gz[0], 지지: gz[1] } : { available: false });
    const yong = String(saju.yongsin || '').match(/[목화토금수]/)?.[0];
    return sajuCoreFactsText({
      pillars: [toP(saju.yearGanzi), toP(saju.monthGanzi), toP(saju.dayGanzi), toP(saju.timeGanzi)],
      myeongriAnalysis: yong ? { 용신: yong } : {},
    });
  } catch { return ''; }
}

function dreamTimelineBlock(saju: DreamSajuContext): string {
  try {
    const full: any = saju.fullSajuData;
    const toP = (gz: string) => (gz && gz.length >= 2 && !gz.includes('미상') ? { 천간: gz[0], 지지: gz[1] } : { available: false });
    const sd = full?.pillars ? full : {
      pillars: [toP(saju.yearGanzi), toP(saju.monthGanzi), toP(saju.dayGanzi), toP(saju.timeGanzi)],
      currentDaeun: saju.currentDaeun && /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(saju.currentDaeun) ? { 간지: saju.currentDaeun.slice(0, 2) } : undefined,
    };
    const tl = lifeTimelineFactsText(sd, kstNowDate());
    if (!tl) return '';
    return `

${tl}
→ 짚기 자리: sajuTone 첫머리에서 위 표의 최근 석 달이나 이번 달로 '요즘 짚기'를 한 번 한다(요즘 어느 영역에 마음이 쓰였는지, 그 마음이 꿈에 어떤 모습으로 나왔는지). 다른 필드에서는 다시 묻지 않는다.${READING_VOICE_BLOCK}`;
  } catch { return ''; }
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
    : DREAM_FREE_USER_NO_SAJU_V3({
        dreamContent: args.dreamContent,
        userConcern: args.userConcern,
        category: args.category,
      });
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
  });

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
