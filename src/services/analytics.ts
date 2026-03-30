/**
 * GA4 이벤트 추적
 * Phase 1-C에서 구현
 */

export function trackEvent(eventName: string, params?: Record<string, string | number>) {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', eventName, params);
  }
}

export function trackPageView(pagePath: string) {
  trackEvent('page_view', { page_path: pagePath });
}
