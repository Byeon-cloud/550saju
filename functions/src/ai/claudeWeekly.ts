import Anthropic from '@anthropic-ai/sdk';
import {
  WEEKLY_FORTUNE_SYSTEM_V3,
  WEEKLY_FORTUNE_USER_V3,
  SELF_REVIEW_V3,
  parseJsonResponse,
} from './promptsV3';

/**
 * 주간 흐름 — Claude Sonnet 4.6 (신규 500원 단품).
 *   생성 + 2차 자기 리뷰 (고가치 응답).
 *   입력: 사주 + 이번 주 요일별 간지.
 */

export interface WeeklyFortuneArgs {
  name: string;
  sajuData: unknown;
  /** 이번 주 시작일 (월요일 기준, YYYY-MM-DD) */
  monday: string;
  /** 7일 요일별 간지 */
  weekdays: Array<{ date: string; weekday: string; ganzi: string }>;
}

const MODEL = 'claude-sonnet-4-6';

export async function generateWeeklyFortuneAnalysis(
  apiKey: string,
  args: WeeklyFortuneArgs,
): Promise<unknown> {
  const anthropic = new Anthropic({ apiKey });
  const system = WEEKLY_FORTUNE_SYSTEM_V3;
  const user = WEEKLY_FORTUNE_USER_V3(args);

  // 1차 생성
  const first = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const firstText = (first.content[0] as { type: string; text: string }).text;
  const firstJson = parseJsonResponse(firstText);

  // 2차 자기 리뷰
  const review = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system,
    messages: [
      { role: 'user', content: user },
      { role: 'assistant', content: firstText },
      {
        role: 'user',
        content: SELF_REVIEW_V3({ original: firstJson, kind: 'weekly' }),
      },
    ],
  });
  const reviewText = (review.content[0] as { type: string; text: string }).text;
  try {
    return parseJsonResponse(reviewText);
  } catch {
    return firstJson;
  }
}
