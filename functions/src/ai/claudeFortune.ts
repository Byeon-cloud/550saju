// Migrated from geminiFortune.ts on 2026-04-19 (Sonnet 4.6 v3).
// See commit 926ead2 + docs/prd/AI프롬프트_v3_Sonnet4.6.md

import Anthropic from '@anthropic-ai/sdk';
import {
  DAILY_FORTUNE_SYSTEM_V3,
  DAILY_FORTUNE_USER_V3,
  parseJsonResponse,
} from './promptsV3';

/**
 * 오늘의 운세 — Claude Sonnet 4.6
 *   v3 전환 (2026-04-19): Gemini 2.5 Pro → Sonnet 4.6.
 *   파일명 geminiFortune.ts → claudeFortune.ts 로 git mv (히스토리 보존).
 *   일일 재방문 훅. 톤 일관성·깊이 둘 다 필요.
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

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  return parseJsonResponse(text);
}
