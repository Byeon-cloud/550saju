// Migrated from geminiDream.ts on 2026-04-19 (Sonnet 4.6 v3).
// See commit 926ead2 + docs/prd/AI프롬프트_v3_Sonnet4.6.md

import Anthropic from '@anthropic-ai/sdk';
import {
  DREAM_FREE_SYSTEM_V3,
  DREAM_FREE_USER_WITH_SAJU_V3,
  DREAM_FREE_USER_NO_SAJU_V3,
  DREAM_DEEP_SYSTEM_V3,
  DREAM_DEEP_USER_V3,
  SELF_REVIEW_V3,
  parseJsonResponse,
  type ParseJsonMeta,
} from './promptsV3';

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

const MODEL = 'claude-sonnet-4-6';

/** 무료 꿈해몽 — 사주 있으면 withSaju, 없으면 noSaju */
export async function generateDreamFree(apiKey: string, args: DreamFreeArgs): Promise<unknown> {
  const anthropic = new Anthropic({ apiKey });
  const system = DREAM_FREE_SYSTEM_V3;
  const user = args.saju
    ? DREAM_FREE_USER_WITH_SAJU_V3({
        name: args.saju.name,
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
      })
    : DREAM_FREE_USER_NO_SAJU_V3({
        dreamContent: args.dreamContent,
        userConcern: args.userConcern,
        category: args.category,
      });

  // 1차 호출 (temperature 0.7)
  const meta1: ParseJsonMeta = { repairUsed: false };
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0.1,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text;
    const result = parseJsonResponse(text, meta1);
    if (meta1.repairUsed) console.info('[claudeDreamFree] jsonrepair 1차 발동 — 복구 성공');
    return result;
  } catch (e1: any) {
    console.warn('[claudeDreamFree] 1차 실패 → temperature 0.5 로 재시도:', e1?.message);
    const meta2: ParseJsonMeta = { repairUsed: false };
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0.05,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text;
    const result = parseJsonResponse(text, meta2);
    console.info('[claudeDreamFree] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
    return result;
  }
}

/** 심층 꿈해몽 (유료 1운) — 1차 생성 후 2차 자기 리뷰 */
export async function generateDreamDeep(apiKey: string, args: DreamDeepArgs): Promise<unknown> {
  const anthropic = new Anthropic({ apiKey });
  const system = DREAM_DEEP_SYSTEM_V3;
  const user = DREAM_DEEP_USER_V3({
    name: args.saju.name,
    sajuData: args.saju.fullSajuData ?? args.saju,
    dreamContent: args.dreamContent,
    category: args.category,
    freeResultSummary: args.freeResultSummary,
  });

  // 1차 생성 (파싱 실패 시 temperature 0.5 로 1회 재시도)
  let firstText: string;
  let firstJson: unknown;
  try {
    const meta1: ParseJsonMeta = { repairUsed: false };
    const first = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16384,
      temperature: 0.1,
      system,
      messages: [{ role: 'user', content: user }],
    });
    firstText = (first.content[0] as { type: string; text: string }).text;
    firstJson = parseJsonResponse(firstText, meta1);
    if (meta1.repairUsed) console.info('[claudeDreamDeep] 1차 jsonrepair 발동');
  } catch (e1: any) {
    console.warn('[claudeDreamDeep] 1차 실패 → 재시도:', e1?.message);
    const meta2: ParseJsonMeta = { repairUsed: false };
    const retry = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16384,
      temperature: 0.05,
      system,
      messages: [{ role: 'user', content: user }],
    });
    firstText = (retry.content[0] as { type: string; text: string }).text;
    firstJson = parseJsonResponse(firstText, meta2);
    console.info('[claudeDreamDeep] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
  }

  // 2차 자기 리뷰
  const review = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16384,
    temperature: 0.1, // 결정론적
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
  const reviewText = (review.content[0] as { type: string; text: string }).text;
  try {
    return parseJsonResponse(reviewText);
  } catch {
    // 리뷰 파싱 실패 시 1차 결과 반환 (안전 fallback)
    return firstJson;
  }
}
