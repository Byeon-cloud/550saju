/**
 * 웹 문의 보내기 (2026-10-19) — 서버 submitInquiry(functions/src/support/inquiry.ts).
 *   회원 ID 는 서버가 로그인 정보로 붙이고, 여기서는 기기, 보던 화면, 최근 화면, 잔액, 보던 결과, 브라우저를 붙인다.
 *   이름, 생년월일 같은 사주 정보는 보내지 않는다(고객 카드에서 회원 ID 로 본다).
 */
import { getBalanceBreakdown } from '@/services/storage/localStore';
import { inAppBrowserName } from '@/utils/inAppBrowser';

export type InquiryCategory = 'pay_missing' | 'ai_fail' | 'lost' | 'refund' | 'other';
export const INQUIRY_CATEGORIES: { v: InquiryCategory; label: string }[] = [
  { v: 'pay_missing', label: '결제했는데 운이 안 들어왔어요' },
  { v: 'ai_fail', label: '풀이가 안 나오거나 이상해요' },
  { v: 'lost', label: '기록이나 운이 사라졌어요' },
  { v: 'refund', label: '환불하고 싶어요' },
  { v: 'other', label: '그 밖의 문의' },
];

declare const __APP_VERSION__: string;

export async function sendInquiry(input: { category: InquiryCategory; message: string; email?: string; reportId?: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const [{ getFunctions, httpsCallable }, { app, auth }, { ensureAuth }] = await Promise.all([
      import('firebase/functions'), import('@/services/auth/firebase'), import('@/services/auth/authService'),
    ]);
    await ensureAuth();
    let history: string[] = [];
    try { history = JSON.parse(sessionStorage.getItem('saju500:paths') || '[]'); } catch { /* noop */ }
    let utm = '';
    try { utm = sessionStorage.getItem('saju500:utm') || ''; } catch { /* noop */ }
    const ua = navigator.userAgent;
    const browser = /SamsungBrowser/.test(ua) ? '삼성 인터넷' : /CriOS|Chrome/.test(ua) ? '크롬' : /Safari/.test(ua) ? '사파리' : /Firefox|FxiOS/.test(ua) ? '파이어폭스' : '기타';
    const os = /iPhone|iPad/.test(ua) ? '아이폰' : /Android/.test(ua) ? '안드로이드' : /Windows/.test(ua) ? '윈도' : /Mac OS/.test(ua) ? '맥' : '';
    const meta = {
      did: (() => { try { return localStorage.getItem('saju500:did') || ''; } catch { return ''; } })(),
      path: window.location.pathname,
      referrer: document.referrer || '',
      utm,
      history,
      balance: getBalanceBreakdown(),
      reportId: input.reportId || '',
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
      browser: `${os} ${browser}`.trim(),
      inApp: inAppBrowserName() || '',
      loggedIn: !!auth.currentUser && !auth.currentUser.isAnonymous,
    };
    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'submitInquiry');
    await fn({ category: input.category, message: input.message, email: input.email || '', meta });
    import('@/services/analytics').then((a) => a.trackEvent('inquiry_sent', { category: input.category })).catch(() => {});
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message || '');
    return { ok: false, message: /오늘은|메일 주소|조금만 더/.test(msg) ? msg : '지금은 보내지 못했어요. 잠시 뒤 다시 눌러 주세요' };
  }
}
