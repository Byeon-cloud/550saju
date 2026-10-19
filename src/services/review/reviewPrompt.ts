/**
 * 별점 요청 (2026-10-17, 시험 E12 · 앱인토스 전용)
 *
 *   토스 미니앱 별점은 토스 안 검색 순위와 스토어 신뢰에 붙는다. 앱인토스 SDK `Review.request()` 가 토스 앱의 별점 창을 띄운다
 *   (토스 5.253.0 이상, 창을 띄울지는 토스가 정한다). 결과를 읽는 중에 띄우면 화면을 가려 낮은 별점이 나오므로
 *   '결과를 보고 홈으로 돌아온 순간'에만 묻는다.
 *
 *   후보: 이번 세션에 유료 콘텐츠를 샀거나(content_purchase) 유료 결과를 봤을 때, 또는 결과를 세 번 넘게 본 사람이 결과를 봤을 때.
 *   묻는 횟수: 60일에 한 번, 기기마다 평생 세 번. 웹 빌드에서는 아무것도 하지 않는다(웹은 별점 창이 없다).
 *
 *   2026-10-19 (오너: 앱에서는 토스 '이용 후기 남기기' 별점으로 모으자. 별점과 리뷰가 토스 추천 미니앱 선정 기준):
 *   - 결과 끝 후기 카드(ReviewAsk)는 앱에서 토스 별점 창을 여는 버튼이 된다 → askTossReview('result')
 *   - 자동으로 묻는 때를 넓힌다: 유료 결과 전부(신년운세, 월운세, 주간운세, 궁합, 대운, 꿈 깊은 풀이 포함), 또는 결과 두 번째부터.
 *     30일에 한 번, 평생 네 번(토스도 피로도를 따로 막는다).
 *   - 토스 가이드: 리뷰 노출 여부로 보상이나 다음 화면을 정하지 않는다, 남겼는지 알 수 없다(알려 주지 않음), 같은 세션 반복 금지.
 *     '만족하셨나요?'로 걸러 좋은 사람만 보내는 방식은 쓰지 않는다(리뷰 선별 유도).
 *   보상을 주고 별점을 받는 건 하지 않는다(앱 마켓 정책 위반).
 */
import { isAppsInToss } from '@/services/payment/iapService';

const LS_KEY = 'saju500:review_prompt:v1';
const SS_KEY = 'saju500:review_candidate';
const GAP_MS = 30 * 864e5;
const MAX_ASKS = 4;
const PAID_RESULT = new Set(['premium', 'topic', 'tojung', 'monthly', 'weekly', 'compat', 'daeun', 'deepDream']);
const ASKED_SESSION = 'saju500:review_asked_session';

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
  if (PAID_RESULT.has(String(params?.type || '')) || s.results >= 2) markCandidate();
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
  try { if (sessionStorage.getItem(ASKED_SESSION) === '1') return; } catch { /* noop */ }
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
    try { sessionStorage.setItem(ASKED_SESSION, '1'); } catch { /* noop */ }
    await req();
    trackEvent('review_request', { result: 'shown', n: s.asks });
  } catch (e: any) {
    trackEvent('review_request', { result: 'error', msg: String(e?.message || e).slice(0, 60) });
  }
}

/** 토스 별점 창을 지금 쓸 수 있나 (앱 안 + 토스 5.253.0 이상) */
export async function tossReviewSupported(): Promise<boolean> {
  if (!isAppsInToss()) return false;
  try {
    const mod: any = await import('@apps-in-toss/web-framework');
    const req = mod?.Review?.request;
    if (typeof req !== 'function') return false;
    return typeof req.isSupported === 'function' ? !!req.isSupported() : true;
  } catch { return false; }
}

/** 사람이 버튼을 눌러 여는 토스 별점 창 (결과 끝 카드). 같은 세션에서는 자동으로 다시 묻지 않는다 */
export async function askTossReview(src: string): Promise<'shown' | 'unsupported' | 'error'> {
  const { trackEvent } = await import('@/services/analytics');
  try {
    const mod: any = await import('@apps-in-toss/web-framework');
    const req = mod?.Review?.request;
    if (typeof req !== 'function') { trackEvent('review_request', { result: 'unsupported', src }); return 'unsupported'; }
    try { sessionStorage.setItem(ASKED_SESSION, '1'); } catch { /* noop */ }
    const s = read(); s.lastAsk = Date.now(); write(s); // 자동 요청은 30일 쉰다 (버튼 요청은 횟수에 넣지 않는다)
    await req();
    trackEvent('review_request', { result: 'shown', src });
    return 'shown';
  } catch (e: any) {
    trackEvent('review_request', { result: 'error', src, msg: String(e?.code || e?.message || e).slice(0, 60) });
    return 'error';
  }
}
