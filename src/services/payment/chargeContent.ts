/**
 * 충전하러 온 콘텐츠 (2026-10-22 ChargePage 에서 옮김) — 충전 화면 요약과 기본 묶음, 그리고 서버가 '운이 부족합니다'로 막았을 때
 * 모자란 운을 계산하는 데 같이 쓴다(balanceReconcile.ts). 값(cost)은 pricing.ts 의 지금 가격.
 */
import { PRODUCT_COST, getPremiumPrice, getTojungPrice, getTopicPrice, getMonthlyPrice, getWeeklyPrice } from '@/constants/pricing';
import { TOPIC_REGISTRY, normalizeTopicId } from '@/constants/topics';
import { kstToday } from '@/utils/kstDate';

/**
 * 무엇을 보러 충전하러 왔나 (2026-10-22, 1.6.3 P1-1)
 *   맨 위 요약('2027 신년운세에 7운이 필요해요')과 기본으로 골라 둔 묶음 설명('2027 신년운세 한 번')에 콘텐츠 이름을 쓰려고.
 *   예전엔 메시지 없이 ?need= 만 오면 '이 풀이에 7운이 필요해요'로만 나왔다.
 *   찾는 순서: ?src= (tojung, premium, topic:love 또는 love, compat, monthly, weekly, dream, chat, daily, daeun)
 *     → 돌아갈 경로(/tojung, /premium, /result, /topic/연애 id, /compat, /share/cjoin, /monthly, /weekly, /dream, /chat, /daily, /daeun)
 *     → 메시지 속 이름. 값(cost)은 pricing.ts 의 지금 가격이라 신년운세가 12월 1일 9운이 되어도 맞다.
 */
export type ChargeContent = { key: string; name: string; cost: number };
function newYearTargetYear(): number {
  const [y, m] = kstToday().split('-').map(Number);
  return m >= 10 ? y + 1 : y; // TojungPage newYearTarget, 서버 tojungTargetYear 와 같은 규칙
}
export function chargeContentByKey(raw: string | null | undefined): ChargeContent | null {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  switch (k) {
    case 'tojung': case 'newyear': return { key: 'tojung', name: `${newYearTargetYear()} 신년운세`, cost: getTojungPrice().actualPrice };
    case 'premium': case 'result': case 'report': return { key: 'premium', name: '종합사주', cost: getPremiumPrice().actualPrice };
    case 'compat': case 'cjoin': return { key: 'compat', name: '궁합', cost: PRODUCT_COST.compatibility };
    case 'monthly': return { key: 'monthly', name: '월운세', cost: getMonthlyPrice().actualPrice };
    case 'weekly': return { key: 'weekly', name: '주간운세', cost: getWeeklyPrice().actualPrice };
    case 'dream': return { key: 'dream', name: '꿈해몽 깊은 풀이', cost: 1 };
    case 'chat': return { key: 'chat', name: '사주대화', cost: 1 };
    case 'daily': return { key: 'daily', name: '오늘의 운세', cost: 1 };
    case 'daeun': return { key: 'daeun', name: '대운 해설', cost: PRODUCT_COST.daeun };
    default: break;
  }
  const t = normalizeTopicId(k.startsWith('topic:') || k.startsWith('topic/') ? k.slice(6) : k);
  return t ? { key: `topic:${t}`, name: TOPIC_REGISTRY[t].label, cost: getTopicPrice(t).actualPrice } : null;
}
export function resolveChargeContent(src: string | null | undefined, path: string | null | undefined, message: string | null | undefined): ChargeContent | null {
  const bySrc = chargeContentByKey(src);
  if (bySrc) return bySrc;
  const p = path || '';
  const tm = p.match(/^\/topic\/([a-z_]+)/);
  if (tm) return chargeContentByKey(tm[1]);
  const pm = p.match(/^\/(tojung|premium|result|compat|monthly|weekly|dream|chat|daily|daeun)\b/);
  if (pm) return chargeContentByKey(pm[1]);
  if (/^\/share\/cjoin\b/.test(p)) return chargeContentByKey('compat');
  const m = message || '';
  if (/신년운세/.test(m)) return chargeContentByKey('tojung');
  if (/종합사주/.test(m)) return chargeContentByKey('premium');
  if (/궁합/.test(m)) return chargeContentByKey('compat');
  if (/월운세/.test(m)) return chargeContentByKey('monthly');
  if (/주간운세/.test(m)) return chargeContentByKey('weekly');
  return null;
}
