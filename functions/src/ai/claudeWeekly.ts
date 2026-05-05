import Anthropic from '@anthropic-ai/sdk';
import {
  WEEKLY_FORTUNE_SYSTEM_V3,
  WEEKLY_FORTUNE_USER_V3,
  SELF_REVIEW_V3,
  parseJsonResponse,
  type ParseJsonMeta,
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

  // 1차 생성 (파싱 실패 시 temperature 0.5 로 1회 재시도)
  let firstText: string;
  let firstJson: unknown;
  try {
    const meta1: ParseJsonMeta = { repairUsed: false };
    const first = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16384,
      temperature: 0.7,
      system,
      messages: [{ role: 'user', content: user }],
    });
    firstText = (first.content[0] as { type: string; text: string }).text;
    firstJson = parseJsonResponse(firstText, meta1);
    if (meta1.repairUsed) console.info('[claudeWeekly] 1차 jsonrepair 발동');
  } catch (e1: any) {
    console.warn('[claudeWeekly] 1차 실패 → 재시도:', e1?.message);
    const meta2: ParseJsonMeta = { repairUsed: false };
    const retry = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16384,
      temperature: 0.5,
      system,
      messages: [{ role: 'user', content: user }],
    });
    firstText = (retry.content[0] as { type: string; text: string }).text;
    firstJson = parseJsonResponse(firstText, meta2);
    console.info('[claudeWeekly] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
  }

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
