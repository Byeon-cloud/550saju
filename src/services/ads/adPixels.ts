/**
 * 웹 광고 전환 추적 (2026-10-19) — 유료광고(메타, 네이버 검색광고, 구글 애즈)가 '누가 결제까지 갔는지'를 광고 쪽에서 보게.
 *
 *   웹에서만 켠다. 앱 번들(isAppintosBuild)과 토스 안(isAppsInToss)에서는 아무것도 불러오지 않는다
 *   (앱인토스 혼입 금지, 외부 스크립트와 iframe 금지).
 *   번호는 .env — VITE_META_PIXEL_ID, VITE_NAVER_WA_ID, VITE_GADS_ID(AW-...), VITE_GADS_PURCHASE_LABEL. 비어 있으면 그 광고는 건너뛴다.
 *   보내는 것: 화면 보기, 사주 입력(Lead), 결과 받음(ViewContent), 충전 화면(InitiateCheckout), 충전 완료(Purchase, 금액).
 *   이름, 생년월일 같은 개인정보는 보내지 않는다(금액과 콘텐츠 종류만). 켤 때 개인정보처리방침의 행태정보 항목을 같이 켠다.
 */
import { isAppintosBuild } from '@/lib/env';

const META_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined) || '';
const NAVER_WA = (import.meta.env.VITE_NAVER_WA_ID as string | undefined) || '';
const GADS_ID = (import.meta.env.VITE_GADS_ID as string | undefined) || '';
const GADS_PURCHASE = (import.meta.env.VITE_GADS_PURCHASE_LABEL as string | undefined) || '';

let state: 'idle' | 'on' | 'off' = 'idle';

function inTossWebview(): boolean {
  try { return navigator.userAgent.includes('TossApp'); } catch { return false; } // iapService.isAppsInToss 와 같은 판정
}

function loadScript(src: string): void {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** 한 번만. 웹이 아니거나 번호가 하나도 없으면 꺼 둔다 */
export function initAdPixels(): boolean {
  if (state !== 'idle') return state === 'on';
  if (isAppintosBuild || typeof window === 'undefined' || inTossWebview() || !(META_ID || NAVER_WA || GADS_ID)) {
    state = 'off';
    return false;
  }
  const w = window as any;
  if (META_ID && !w.fbq) {
    const fbq: any = function (...args: unknown[]) { fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args); };
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
    w.fbq = fbq; w._fbq = fbq;
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
    w.fbq('init', META_ID);
  }
  if (NAVER_WA) {
    w.wcs_add = w.wcs_add || {};
    w.wcs_add.wa = NAVER_WA;
    loadScript('https://wcs.naver.net/wcslog.js');
  }
  if (GADS_ID) {
    w.dataLayer = w.dataLayer || [];
    if (!w.gtag) w.gtag = function () { w.dataLayer.push(arguments); };
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GADS_ID)}`);
    w.gtag('js', new Date());
    w.gtag('config', GADS_ID, { send_page_view: false }); // 주소를 자동으로 보내지 않는다(전환만)
  }
  state = 'on';
  return true;
}

/** 네이버 공통 스크립트가 늦게 뜨면 잠깐 기다렸다가 보낸다 */
function naver(fn: (wcs: any) => void, tries = 0): void {
  const w = window as any;
  if (w.wcs && typeof w.wcs_do === 'function') { try { fn(w.wcs); } catch { /* noop */ } return; }
  if (tries < 20) setTimeout(() => naver(fn, tries + 1), 250);
}

/** analytics.trackEvent 에서 부른다 — 우리 이벤트 이름을 광고 쪽 표준 이벤트로 */
const lastSent: Record<string, number> = {};

export function adEvent(name: string, params?: Record<string, string | number>): void {
  // 2026-10-21 — 오너 기기(관리자 화면을 연 기기, analytics 의 internal 표시와 같은 기준)는 광고 학습에 섞이지 않게 보내지 않는다
  try { if (localStorage.getItem('saju500:internal') === '1') return; } catch { /* noop */ }
  if (state === 'off' || (state === 'idle' && !initAdPixels())) return;
  const w = window as any;
  const amount = Number(params?.amount) || 0;
  // 10-19 검토: 충전 화면은 진입 기록이 두 번 난다(경로 파생 + 화면 마운트) → 같은 이벤트는 3초 안에 한 번만 (결제 완료는 금액이 있어 예외)
  const now = Date.now();
  if (name !== 'charge_complete' && now - (lastSent[name] || 0) < 3000) return;
  lastSent[name] = now;
  // 무료 만세력 바로 보기 주소(/manse/view?b=생일...)는 광고 쪽으로 보내지 않는다(픽셀이 주소를 그대로 수집함)
  if (name === 'page_view' && /^\/manse\/view/.test(window.location.pathname)) return;
  try {
    switch (name) {
      case 'page_view':
        w.fbq?.('track', 'PageView');
        naver(() => w.wcs_do());
        break;
      case 'profile_created':
        w.fbq?.('track', 'Lead', { content_name: 'saju_input' });
        naver((wcs) => w.wcs_do({ cnv: wcs.cnv('2', '0') })); // 2 = 회원가입(사주 입력으로 씀)
        break;
      case 'content_result':
        w.fbq?.('track', 'ViewContent', { content_type: String(params?.type || 'result') });
        break;
      case 'charge_open':
        w.fbq?.('track', 'InitiateCheckout');
        break;
      case 'charge_complete':
        if (!amount) break;
        w.fbq?.('track', 'Purchase', { value: amount, currency: 'KRW' });
        naver((wcs) => w.wcs_do({ cnv: wcs.cnv('1', String(amount)) })); // 1 = 구매 완료
        if (GADS_ID && GADS_PURCHASE) w.gtag?.('event', 'conversion', { send_to: `${GADS_ID}/${GADS_PURCHASE}`, value: amount, currency: 'KRW' });
        break;
      default:
    }
  } catch { /* 광고 추적 실패는 화면과 무관 */ }
}
