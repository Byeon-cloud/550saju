/**
 * 첫 오늘의 운세 기념 종합사주 반값 (2026-10-19, 오너 아이디어 + 결제창 마찰 해결)
 *
 *   왜: 최근 14일 홈에서 가장 많이 누른 건 무료 오늘의 운세(약 400번)인데 그 세션에서 결제로 간 건 0번이었다.
 *   무엇: 이 기기에서 오늘의 운세 결과를 처음 받은 순간부터 24시간, 종합사주를 5운(정가 10운)으로. 종합사주를 산 적 없는 사람만,
 *         기기마다 평생 한 번. 정가 10운으로 20일 넘게 판 상품이라 할인 표시 가능(공정위 고시).
 *   운이 모자란 사람: 오늘의 운세 카드 → 충전 화면에 2,500원(5+2운)이 미리 골라져 있고, 결제하면 종합사주 화면으로 돌아와 '바로 시작'.
 *   서버: 로그인 계정은 서버도 운을 깎는다 → 요청에 offer 를 붙이고, 서버는 계정마다 한 번만 5운으로 깎는다(index.ts).
 *   기록: daily_offer_start, daily_offer_view, daily_offer_click, content_purchase {type: premium, offer: first_daily}.
 *   끄기: OFFER.enabled = false.
 */
export const OFFER = { enabled: true, price: 5, hours: 24, id: 'first_daily' } as const;
const KEY = 'saju500:offer:first_daily';
const USE_KEY = 'saju500:premium_offer_spent'; // 이번 종합사주 생성이 반값으로 산 것인지 (생성 요청에 붙인다)

type State = { startedAt: number; until: number; used: boolean };

function read(): State | null {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && typeof s.until === 'number' ? s : null; } catch { return null; }
}
function write(s: State): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
}

/** 이 기기에서 종합사주를 산 적이 있나 (보관함 기준) */
function boughtPremium(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i) || '';
      if (!/report/i.test(k)) continue;
      const raw = localStorage.getItem(k) || '';
      if (raw.includes('"contentType":"premium"') || raw.includes('"type":"premium"')) return true;
    }
  } catch { /* noop */ }
  return false;
}

/** 오늘의 운세 결과를 받았을 때 부른다 — 처음이면 24시간 혜택을 연다 */
export function startFirstDailyOffer(): boolean {
  if (!OFFER.enabled || read() || boughtPremium()) return false;
  const now = Date.now();
  write({ startedAt: now, until: now + OFFER.hours * 3600e3, used: false });
  import('@/services/analytics').then((a) => a.trackEvent('daily_offer_start', {})).catch(() => {});
  try { window.dispatchEvent(new Event('saju500:offer-change')); } catch { /* noop */ }
  return true;
}

/** 지금 반값인가 */
export function firstDailyOfferActive(): boolean {
  if (!OFFER.enabled) return false;
  const s = read();
  return !!s && !s.used && Date.now() < s.until && !boughtPremium();
}

/** 남은 시간 글자: '23시간 10분 남았어요' */
export function firstDailyOfferLeft(): string {
  const s = read();
  if (!s) return '';
  const ms = Math.max(0, s.until - Date.now());
  const h = Math.floor(ms / 3600e3); const m = Math.floor((ms % 3600e3) / 60e3);
  return h > 0 ? `${h}시간 ${m}분 남았어요` : `${m}분 남았어요`;
}

/** 반값으로 운을 깎은 직후 부른다 (다시 반값이 되지 않게, 서버 요청에 표시가 붙게) */
export function markFirstDailyOfferUsed(): void {
  const s = read();
  if (s) write({ ...s, used: true });
  try { sessionStorage.setItem(USE_KEY, JSON.stringify({ id: OFFER.id, at: Date.now() })); } catch { /* noop */ }
}

/** 종합사주 생성 요청에 붙일 표시 — 반값으로 산 뒤 30분 안의 요청에만 (스트림이 실패해 다시 부르는 요청에도 붙게 지우지 않는다.
 *  서버는 계정마다 한 번만 반값으로 깎는다) */
export function takePremiumOfferFlag(): string | undefined {
  try {
    const v = JSON.parse(sessionStorage.getItem(USE_KEY) || 'null');
    return v && Date.now() - Number(v.at) < 30 * 60e3 ? String(v.id) : undefined;
  } catch { return undefined; }
}
