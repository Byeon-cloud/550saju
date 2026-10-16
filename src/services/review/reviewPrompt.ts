/**
 * 별점 요청 (2026-10-17, 시험 E12 · 앱인토스 전용)
 *
 *   토스 미니앱 별점은 토스 안 검색 순위와 스토어 신뢰에 붙는다. 앱인토스 SDK `Review.request()` 가 토스 앱의 별점 창을 띄운다
 *   (토스 5.253.0 이상, 창을 띄울지는 토스가 정한다). 결과를 읽는 중에 띄우면 화면을 가려 낮은 별점이 나오므로
 *   '결과를 보고 홈으로 돌아온 순간'에만 묻는다.
 *
 *   후보: 이번 세션에 유료 콘텐츠를 샀거나(content_purchase) 유료 결과를 봤을 때, 또는 결과를 세 번 넘게 본 사람이 결과를 봤을 때.
 *   묻는 횟수: 60일에 한 번, 기기마다 평생 세 번. 웹 빌드에서는 아무것도 하지 않는다(웹은 별점 창이 없다).
 *   보상을 주고 별점을 받는 건 하지 않는다(앱 마켓 정책 위반).
 */
import { isAppsInToss } from '@/services/payment/iapService';

const LS_KEY = 'saju500:review_prompt:v1';
const SS_KEY = 'saju500:review_candidate';
const GAP_MS = 60 * 864e5;
const MAX_ASKS = 3;
const PAID_RESULT = new Set(['premium', 'topic']);

type State = { results: number; asks: number; lastAsk: number };

function read(): State {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return { results: Number(s.results) || 0, asks: Number(s.asks) || 0, lastAsk: Number(s.lastAsk) || 0 };
  } catch { return { results: 0, asks: 0, lastAsk: 0 }; }
}
function write(s: State): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}
function markCandidate(): void {
  try { sessionStorage.setItem(SS_KEY, '1'); } catch { /* noop */ }
}

/** analytics.trackEvent 가 부른다 — content_result, content_purchase 만 본다 */
export function noteReviewSignal(eventName: string, params?: Record<string, string | number>): void {
  if (!isAppsInToss()) return;
  if (eventName === 'content_purchase') { markCandidate(); return; }
  if (eventName !== 'content_result') return;
  const s = read();
  s.results += 1;
  write(s);
  if (PAID_RESULT.has(String(params?.type || '')) || s.results >= 3) markCandidate();
}

/** 홈 화면이 열릴 때 부른다 — 조건이 맞으면 토스 별점 창을 한 번 띄운다 */
export async function maybeAskReview(): Promise<void> {
  if (!isAppsInToss()) return;
  try {
    if (sessionStorage.getItem(SS_KEY) !== '1') return;
    sessionStorage.removeItem(SS_KEY);
  } catch { return; }
  const s = read();
  if (s.asks >= MAX_ASKS || Date.now() - s.lastAsk < GAP_MS) return;
  const { trackEvent } = await import('@/services/analytics');
  try {
    const mod: any = await import('@apps-in-toss/web-framework');
    const req = mod?.Review?.request;
    if (typeof req !== 'function' || (typeof req.isSupported === 'function' && !req.isSupported())) {
      trackEvent('review_request', { result: 'unsupported' });
      return;
    }
    s.asks += 1;
    s.lastAsk = Date.now();
    write(s);
    await req();
    trackEvent('review_request', { result: 'shown', n: s.asks });
  } catch (e: any) {
    trackEvent('review_request', { result: 'error', msg: String(e?.message || e).slice(0, 60) });
  }
}
