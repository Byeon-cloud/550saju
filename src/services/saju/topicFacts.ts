/**
 * 주제 하나의 '내 사주 사실' 한 줄과 남은 날 (2026-10-27) — 홈 고민 칸(worryRows)과 같은 계산을 결과 끝 카드에서도 쓴다.
 *   사실이 있는 주제(연애, 재물, 합격 이직, 결혼 배우자 자리)만 돌려주고, 나머지는 null(받을 내용만 보여 준다).
 *   만세력 계산(hookFacts)만 쓴다. AI 가 정하는 값은 미리 말하지 않는다.
 */
import type { SajuData } from '@/types/saju';
import { PRODUCT_COST } from '@/constants/pricing';
import { kstToday } from '@/utils/kstDate';
import { genOfAge, worryRows } from './worryTopics';

export interface TopicFact {
  /** 사실 문장 ('12월 7일부터 연인의 별이 들어와요') */
  line: string;
  /** 그 달까지 남은 날 (없으면 null) */
  days: number | null;
}

export function topicFactOf(s: SajuData | null | undefined, topicId: string, today: string = kstToday()): TopicFact | null {
  if (!s || !Array.isArray(s.pillars) || !s.pillars.length) return null;
  try {
    const by = Number(s.input?.birthYear);
    const age = Number.isFinite(by) && by > 1900 ? Number(today.slice(0, 4)) - by : null;
    const row = worryRows(s, today, genOfAge(age), PRODUCT_COST.compatibility).find((r) => r.key === topicId);
    if (!row) return null;
    if (row.days != null) return { line: row.s, days: row.days };
    if (topicId === 'marriage' && row.s && !row.s.startsWith('결혼하기 좋은 해와')) return { line: row.s, days: null }; // 배우자 자리 사실
    return null;
  } catch {
    return null;
  }
}
