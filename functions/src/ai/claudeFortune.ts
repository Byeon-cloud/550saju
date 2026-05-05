// Migrated from geminiFortune.ts on 2026-04-19 (Sonnet 4.6 v3).
// See commit 926ead2 + docs/prd/AI프롬프트_v3_Sonnet4.6.md
// v4.2 (2026-04-19): jsonrepair + retry-once (prod Daily JSON malformation 대응)

import Anthropic from '@anthropic-ai/sdk';
import {
  DAILY_FORTUNE_SYSTEM_V3,
  DAILY_FORTUNE_USER_V3,
  parseJsonResponse,
  type ParseJsonMeta,
} from './promptsV3';

/**
 * 오늘의 운세 — Claude Sonnet 4.6
 *   v3 전환 (2026-04-19): Gemini 2.5 Pro → Sonnet 4.6.
 *   파일명 geminiFortune.ts → claudeFortune.ts 로 git mv (히스토리 보존).
 *   일일 재방문 훅. 톤 일관성·깊이 둘 다 필요.
 *
 *   v4.2 재시도 정책:
 *   1) 1차 호출 temperature 0.7 (default)
 *   2) parseJsonResponse 실패 → jsonrepair 자동 발동
 *   3) 그래도 실패 → temperature 0.5 로 1회 재호출 → 동일 파서
 *   4) 2차도 실패 → throw (클라이언트 ErrorState, 운 차감 전 단계)
 */

export interface DailyFortuneArgs {
  name: string;
  sajuData: unknown;
  /** YYYY-MM-DD */
  date: string;
  /** 월·화·수·목·금·토·일 */
  weekday: string;
  /** 오늘 천간·지지 2글자 (예: '甲子') */
  todayGanzi: string;
  jeolgi?: string;
  dayJiShen?: string[];
  dayXiongSha?: string[];
}

const MODEL = 'claude-sonnet-4-6';

export async function generateDailyFortuneAnalysis(
  apiKey: string,
  args: DailyFortuneArgs,
): Promise<unknown> {
  const anthropic = new Anthropic({ apiKey });
  const system = DAILY_FORTUNE_SYSTEM_V3;
  const user = DAILY_FORTUNE_USER_V3(args);

  // 1차 호출
  const meta1: ParseJsonMeta = { repairUsed: false };
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0.7,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text;
    const result = parseJsonResponse(text, meta1);
    if (meta1.repairUsed) console.info('[claudeFortune] jsonrepair 1차 발동 — 복구 성공');
    return result;
  } catch (e1: any) {
    console.warn('[claudeFortune] 1차 실패 → temperature 0.5 로 재시도:', e1?.message);
    // 2차 호출 — temperature 만 낮춰 sampling 변동성 감소
    const meta2: ParseJsonMeta = { repairUsed: false };
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0.5,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text;
    const result = parseJsonResponse(text, meta2);
    console.info('[claudeFortune] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
    return result;
  }
}
