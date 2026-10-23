/**
 * 나이대별 고민 목록 (2026-10-15 세대별 → 2026-10-23 1.6.3 P1-3 한 곳으로)
 *
 *   홈 고민 블록(위 두 개 + 고민 더 보기)과 사주 카드 아래 다음 단계 칸(위 두 개)이 같은 말, 같은 사실을 쓴다.
 *   나이: 34세까지 young, 35~49세 mid, 50세부터 senior(재취업, 창업, 재혼, 건강을 앞에), 모르면 null(누구에게나 맞는 말).
 *   줄 아래 사실 문장은 hookFacts(만세력 계산)에서만 온다. AI 가 정하는 값은 미리 말하지 않는다.
 */
import { TOPIC_REGISTRY, type TopicId } from '@/constants/topics';
import { getTopicPrice } from '@/constants/pricing';
import { loveDday, nextStarMonth, spouseSeatFact, monthDayLabel } from './hookFacts';
import type { SajuData } from '@/types/saju';

export type Gen = 'young' | 'mid' | 'senior' | null;

/** 나이(올해 - 출생 연도)로 세대 */
export function genOfAge(age: number | null | undefined): Gen {
  if (age == null || !Number.isFinite(age)) return null;
  return age >= 50 ? 'senior' : age >= 35 ? 'mid' : 'young';
}

export interface WorryRow {
  /** 주제 id, 또는 궁합 */
  key: TopicId | 'compat';
  /** 도장 글자 */
  hz: string;
  /** 줄 제목 */
  t: string;
  /** 줄 아래 한 줄 (사실 또는 받을 내용) */
  s: string;
  /** '4운' */
  price: string;
}

const ORDER: Record<'young' | 'mid' | 'senior' | 'any', Array<TopicId | 'compat'>> = {
  senior: ['exam', 'business', 'marriage', 'compat', 'health', 'wealth', 'love', 'reunion', 'career', 'move', 'study'],
  mid: ['exam', 'wealth', 'business', 'compat', 'marriage', 'love', 'reunion', 'career', 'health', 'move', 'study'],
  young: ['love', 'exam', 'reunion', 'wealth', 'compat', 'marriage', 'career', 'business', 'health', 'move', 'study'],
  any: ['love', 'exam', 'reunion', 'wealth', 'compat', 'marriage', 'career', 'business', 'health', 'move', 'study'],
};

/**
 * 세대 순서대로 고민 전부. 앞 두 개가 '위 두 개'다.
 * @param s 사주 (없으면 사실 없이 받을 내용만)
 * @param today YYYY-MM-DD (KST)
 * @param compatPrice 궁합 운
 */
export function worryRows(s: SajuData | null | undefined, today: string, gen: Gen, compatPrice: number): WorryRow[] {
  const thisYear = Number(today.slice(0, 4));
  const yr = (dk: string) => (Number(dk.slice(0, 4)) > thisYear ? '내년 ' : '');
  const safe = <T,>(f: () => T): T | null => { try { return s ? f() : null; } catch { return null; } };
  const em = safe(() => nextStarMonth(s as SajuData, today, ['관성', '인성']));
  const emText = em ? `${yr(em.month.start)}${em.month.calMonth}월` : '';
  const row = (id: TopicId, t: string, sub: string): WorryRow => ({ key: id, hz: TOPIC_REGISTRY[id].kanji, t, s: sub, price: `${getTopicPrice(id).actualPrice}운` });

  const make = (key: TopicId | 'compat'): WorryRow => {
    switch (key) {
      case 'exam':
        if (gen === 'senior') return row('exam', '재취업 이직운', emText ? `일자리의 별이 ${emText}에 들어와요` : '다시 일을 구하거나 옮기기 좋은 달');
        if (gen === 'mid') return row('exam', '이직운', emText ? `옮길 자리의 별이 ${emText}에 들어와요` : '옮기기 좋은 달과 버텨야 할 때');
        if (gen === 'young') return row('exam', '합격 이직운', emText ? `시험과 자리의 별이 ${emText}에 들어와요` : '합격 소식이 오는 달과 면접 보기 좋은 날');
        return row('exam', '합격 이직운', emText ? `시험과 자리의 별이 ${emText}에 들어와요` : '시험, 취업, 이직, 다시 일할 때가 풀리는 달');
      case 'love': {
        const love = safe(() => loveDday(s as SajuData, today));
        return row('love', '연애운', love ? `${yr(love.month.start)}${monthDayLabel(love.month.start)}부터 연인의 별이 들어와요` : '새 인연이 들어오는 달을 짚어요');
      }
      case 'wealth': {
        const wm = safe(() => nextStarMonth(s as SajuData, today, ['재성']));
        return row('wealth', '재물운', wm ? `재물의 별이 ${yr(wm.month.start)}${wm.month.calMonth}월에 들어와요` : '돈이 들어오는 달과 새는 곳');
      }
      case 'reunion':
        return row('reunion', '재회운', '그 사람과 다시 연락이 닿을 때를 두 사람 사주로 봐요');
      case 'business':
        return gen === 'senior'
          ? row('business', '창업운', '가게나 내 일을 차리기 좋은 때')
          : row('business', '사업운', '내 일을 시작하거나 넓히기 좋은 때');
      case 'marriage':
        return gen === 'senior'
          ? row('marriage', '결혼, 재혼운', '다시 함께할 사람이 들어오는 해')
          : row('marriage', '결혼운', safe(() => spouseSeatFact(s as SajuData)) || '결혼하기 좋은 해와 배우자 성향');
      case 'compat':
        return { key: 'compat', hz: '合', t: '궁합', s: gen === 'senior' ? '배우자, 자녀와 잘 맞는 점과 부딪히는 점' : '잘 맞는 점과 자주 부딪히는 점', price: `${compatPrice}운` };
      case 'health':
        return row('health', '건강운', '약한 곳과 조심할 달');
      default:
        return row(key, TOPIC_REGISTRY[key].label, TOPIC_REGISTRY[key].subCopy);
    }
  };

  return ORDER[gen ?? 'any'].map(make);
}
