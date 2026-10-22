/**
 * 토스애즈 전환 추적(토스 픽셀) — 앱인토스 미니앱 전용 (2026-10-22)
 *
 *   토스애즈 E29 는 결제를 잴 수 없는 채로 클릭만 사서 5.9만 원을 쓰고 결제 0 이었다(docs/marketing/2026-10-22_토스애즈_손실_회고.md).
 *   '구매 유도하기' 목표는 상품 조회(PRODUCT_VIEW), 장바구니(ADD_TO_CART), 구매(PURCHASE, 금액)가 있어야 켤 수 있다.
 *   앱인토스 공식 문서(가이드 > 마케팅 > 토스애즈 픽셀 연동)가 미니앱 웹 환경에서 이 스크립트를 쓰라고 안내한다.
 *
 *   켜는 조건: 앱 번들(isAppintosBuild) + .env VITE_TOSS_PIXEL_CODE(토스애즈 광고 도구 > 전환 및 추적 연동의 코드 ID).
 *   웹 빌드에서는 analytics.ts 가 이 파일을 부르지 않는다(웹 광고는 adPixels.ts).
 *   보내는 것: 화면 보기, 유료 풀이 화면 열기, 충전 화면, 결제창 열기, 결제 완료(금액, 주문번호), 첫 결제, 사주 입력, 토스 로그인.
 *   이름, 생년월일, 출생시간, 메일 주소는 보내지 않는다. 처리방침 6-2 와 같은 목록이다(PrivacyPage.tsx).
 *
 *   tcid(토스 광고 클릭 표시)가 주소에서 빠지면 전환이 안 잡힌다. 앱이 뜰 때 주소나 실행 스킴(getSchemeUri)에서 tcid 를 읽어 두고,
 *   스크립트가 뜬 뒤 첫 호출 전에 주소에 다시 붙인다.
 */
import { isAppintosBuild } from '@/lib/env';

const CODE = (import.meta.env.VITE_TOSS_PIXEL_CODE as string | undefined) || '';
const SDK = 'https://static.toss.im/lex/v1.js';
const TCID_KEY = 'saju500:tcid';
const FIRST_KEY = 'saju500:tp_first_purchase';

type Call = (px: any) => void;
let state: 'idle' | 'loading' | 'on' | 'off' = 'idle';
const queue: Call[] = [];

export const TOSS_PIXEL_ON = isAppintosBuild && !!CODE;
const OPTOUT_KEY = 'saju500:tp_optout';

function isOwner(): boolean {
  try { return localStorage.getItem('saju500:internal') === '1'; } catch { return false; }
}

/** 내 정보의 '광고 성과 측정 끄기'(처리방침 6-2 의 거부 방법) */
export function tossPixelOptedOut(): boolean {
  try { return localStorage.getItem(OPTOUT_KEY) === '1'; } catch { return false; }
}
export function setTossPixelOptOut(off: boolean): void {
  try { if (off) localStorage.setItem(OPTOUT_KEY, '1'); else localStorage.removeItem(OPTOUT_KEY); } catch { /* noop */ }
  if (off) queue.length = 0;
}

/** 앱이 뜰 때 한 번 — 주소, 없으면 실행 스킴에서 tcid 를 읽어 세션에 둔다 */
async function rememberTcid(): Promise<void> {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('tcid');
    if (fromUrl) { sessionStorage.setItem(TCID_KEY, fromUrl); return; }
    const mod: any = await import('@apps-in-toss/web-framework');
    const uri: string = typeof mod?.getSchemeUri === 'function' ? (mod.getSchemeUri() || '') : '';
    const qi = uri.indexOf('?');
    const t = new URLSearchParams(qi >= 0 ? uri.slice(qi + 1) : '').get('tcid');
    if (t) sessionStorage.setItem(TCID_KEY, t);
  } catch { /* noop */ }
}

/** 첫 호출 전에 tcid 가 주소에 없으면 붙인다(경로, 다른 꼬리표, # 는 그대로) */
function restoreTcid(): void {
  try {
    const t = sessionStorage.getItem(TCID_KEY);
    if (!t) return;
    const u = new URL(window.location.href);
    if (u.searchParams.get('tcid')) return;
    u.searchParams.set('tcid', t);
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
  } catch { /* noop */ }
}

function flush(): void {
  const w = window as any;
  if (typeof w.TossPixel !== 'function') return;
  restoreTcid();
  const px = w.TossPixel(CODE);
  while (queue.length) {
    const fn = queue.shift()!;
    try { fn(px); } catch { /* 광고 추적 실패는 화면과 무관 */ }
  }
}

function load(): boolean {
  if (state === 'on' || state === 'loading') return true;
  if (state === 'off') return false;
  if (!isAppintosBuild || !CODE || typeof window === 'undefined' || isOwner() || tossPixelOptedOut()) { state = 'off'; return false; }
  state = 'loading';
  void rememberTcid().finally(() => {
    const s = document.createElement('script');
    s.src = SDK;
    s.onload = () => { state = 'on'; flush(); };
    s.onerror = () => { state = 'off'; queue.length = 0; }; // 스크립트가 안 떠도 앱은 그대로
    document.head.appendChild(s);
  });
  return true;
}

function call(fn: Call): void {
  if (tossPixelOptedOut() || !load()) return;
  queue.push(fn);
  if (state === 'on') flush();
}

/** 앱 시작 때 한 번 불러 스크립트를 미리 띄운다(첫 화면 보기보다 먼저 tcid 를 잡으려고) */
export function initTossPixel(): void { load(); }

// 유료 풀이 화면(결제 전 상품 화면으로 본다)
const PAID_TYPES = new Set(['premium', 'topic', 'tojung', 'compat', 'monthly', 'weekly', 'daeun']);
const lastSent: Record<string, number> = {};

/** analytics.trackEvent 에서 부른다 — 우리 이벤트 이름을 토스 픽셀 표준 이벤트로 */
export function tossPixelEvent(name: string, params?: Record<string, string | number>): void {
  if (!isAppintosBuild || !CODE) return;
  const now = Date.now();
  const key = name === 'content_open' ? `${name}:${params?.type || ''}` : name;
  // 충전 화면은 진입 기록이 두 번 난다(경로 파생 + 화면 마운트) → 같은 이벤트는 3초 안에 한 번만(결제 완료는 예외)
  if (name !== 'charge_complete' && now - (lastSent[key] || 0) < 3000) return;
  lastSent[key] = now;
  const amount = Number(params?.amount) || 0;
  switch (name) {
    case 'page_view': {
      const path = String(params?.page_path || window.location.pathname);
      if (/^\/manse\/view/.test(path)) return; // 생일이 주소에 들어가는 화면은 보내지 않는다
      call((px) => px.pageView({ custom_param1: path.slice(0, 60) }));
      return;
    }
    case 'content_open': {
      const type = String(params?.type || '');
      if (!PAID_TYPES.has(type)) return;
      call((px) => px.productView({ product_id: type, custom_param1: type }));
      return;
    }
    case 'charge_open':
      call((px) => px.addToCart({ custom_param1: String(params?.source || '') }));
      return;
    case 'pay_sheet_open':
      call((px) => px.initiateCheckout({ revenue: amount || undefined, currency: 'KRW', custom_param1: String(params?.package || '') }));
      return;
    case 'charge_complete': {
      if (!amount) return;
      const order = String(params?.order || '');
      const pkg = String(params?.package || '');
      const base = { order_id: order || undefined, revenue: amount, currency: 'KRW', total_quantity: 1, products: [{ product_id: pkg || 'un', price: amount, quantity: 1 }] };
      call((px) => px.purchase({ ...base, event_id: order ? `p_${order}` : undefined }));
      let first = false;
      try { first = !localStorage.getItem(FIRST_KEY); if (first) localStorage.setItem(FIRST_KEY, '1'); } catch { /* noop */ }
      if (first) call((px) => px.firstPurchase({ ...base, event_id: order ? `f_${order}` : undefined }));
      return;
    }
    case 'profile_created':
      call((px) => px.custom('SAJU_INPUT', { custom_param1: String(params?.from || params?.relation || '') }));
      return;
    case 'login_success':
      call((px) => px.signIn({ custom_param1: String(params?.provider || '') }));
      return;
    default:
  }
}
