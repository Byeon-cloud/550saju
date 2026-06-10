/**
 * 이벤트 추적 — GA4 (gtag) + Firestore 이벤트 로그 (어드민 대시보드용).
 *
 * 2026-05-29 — 어드민 대시보드(/admin)가 in-app 으로 퍼널·인기·체류를 보려면 쿼리 가능한
 *   데이터가 필요. GA4 는 외부(analytics.google.com)에서만 보이므로, 핵심 이벤트를
 *   Firestore `analytics/{autoId}` 에 경량 append (name, uid, sessionId, ts, props).
 *   비용: 이벤트당 1 write (출시 초기 저트래픽 OK). fire-and-forget — 실패해도 UX 영향 0.
 */

/** GA4 (외부 대시보드용 — 유입경로·유저플로우·체류시간) */
export function trackEvent(eventName: string, params?: Record<string, string | number>) {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', eventName, params);
  }
  // Firestore 경량 로그 (in-app 어드민용) — 핵심 이벤트만
  logToFirestore(eventName, params);
}

export function trackPageView(pagePath: string) {
  trackEvent('page_view', { page_path: pagePath });
  // 2026-05-29 — 경로에서 콘텐츠 진입/결과 자동 파생 (어드민 퍼널·인기 — 페이지 수정 0).
  const t = contentTypeFromPath(pagePath);
  if (t) trackEvent('content_open', { type: t });
  if (/^\/result\b/.test(pagePath)) trackEvent('content_result', { type: 'premium' });
  if (/^\/charge\b/.test(pagePath)) trackEvent('charge_open', {});
}

function contentTypeFromPath(p: string): string | null {
  if (/^\/daily\b/.test(p)) return 'daily';
  if (/^\/dream\b/.test(p)) return 'dream';
  if (/^\/topic\b/.test(p)) return 'topic';
  if (/^\/premium\b/.test(p)) return 'premium';
  if (/^\/chat\b/.test(p)) return 'chat';
  return null;
}

/* ─── Firestore 이벤트 로그 (어드민 대시보드 소스) ─── */

// 세션 식별 (같은 방문 묶기) — sessionStorage
function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('saju500:sid');
    if (!sid) {
      sid = `${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
      sessionStorage.setItem('saju500:sid', sid);
    }
    return sid;
  } catch {
    return 'nosession';
  }
}

// 어드민 집계에 의미있는 이벤트만 Firestore 에 기록 (노이즈·비용 절감)
const FIRESTORE_TRACKED = new Set<string>([
  'app_open',
  'page_view',
  'content_open',       // {type: daily|dream|topic|premium|chat}
  'content_result',     // {type} — 결과 도달 (퍼널)
  'topic_select',       // {topic}
  'charge_open',        // 충전 페이지 진입
  'charge_complete',    // {amount, package}
  'share_click',        // {type}
  'reward_earned',      // {kind, amount}
  // 대시보드 v2 (2026-06-10) — 콘텐츠 구매 + AI 품질 + 광고
  'content_purchase',   // {type, amount(운), topic?} — 운 차감 성공 직후
  'ai_done',            // {type, ms, mode: sse|callable}
  'ai_error',           // {type, mode}
  'ad_impression',      // {unit}
  'ad_click',           // {unit}
  'ad_nofill',          // {unit}
  'ad_fail',            // {unit}
]);

/* ─── UTM/유입 채널 (C5 · 2026-06-10) ───
 *   첫 진입 시 location.search 의 utm_source/utm_medium/utm_campaign + ref 를 sessionStorage 에
 *   저장 → 세션 내 모든 Firestore 이벤트에 utm 첨부 (있을 때만). fire-and-forget. */
const UTM_KEY = 'saju500:utm';

function captureUtm(): void {
  try {
    if (sessionStorage.getItem(UTM_KEY)) return; // 세션 최초 1회만 (이후 내부 네비게이션은 무시)
    const q = new URLSearchParams(window.location.search);
    const source = q.get('utm_source') || q.get('ref') || '';
    const medium = q.get('utm_medium') || '';
    const campaign = q.get('utm_campaign') || '';
    if (!source && !medium && !campaign) return;
    sessionStorage.setItem(UTM_KEY, JSON.stringify({
      ...(source ? { source } : {}),
      ...(medium ? { medium } : {}),
      ...(campaign ? { campaign } : {}),
    }));
  } catch { /* noop */ }
}

function getUtm(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(UTM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// 모듈 init 시 1회 캡처 (SSR 안전 가드)
if (typeof window !== 'undefined') captureUtm();

function logToFirestore(eventName: string, params?: Record<string, string | number>) {
  if (!FIRESTORE_TRACKED.has(eventName)) return;
  // 동적 import — analytics 가 firebase 를 직접 끌고 오지 않게 (번들 분리 + 실패 무해)
  import('@/services/auth/firebase')
    .then(async ({ db }) => {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const uid = getAuth().currentUser?.uid ?? null;
      const utm = getUtm();
      await addDoc(collection(db, 'analytics'), {
        name: eventName,
        uid,
        sid: getSessionId(),
        props: params ?? {},
        ...(utm ? { utm } : {}), // 유입 채널 (있을 때만 — C5)
        ts: serverTimestamp(),
        // 날짜 버킷 (집계 쿼리 효율) — KST 기준 YYYY-MM-DD
        day: kstDay(),
      });
    })
    .catch(() => { /* fire-and-forget */ });
}

function kstDay(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 콘텐츠 진입/결과 추적 헬퍼 (페이지에서 호출) */
export function trackContentOpen(type: string) { trackEvent('content_open', { type }); }
export function trackContentResult(type: string) { trackEvent('content_result', { type }); }
