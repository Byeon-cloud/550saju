/**
 * 웹 홈 화면 추가(PWA) 도우미 (2026-10-23) — 웹 전용. 앱 빌드와 토스 안에서는 아무것도 하지 않는다.
 *
 *   1) 어느 기기, 어느 브라우저인지 (안내 문구를 고르려고)
 *   2) 안드로이드 크롬 계열의 설치 창(beforeinstallprompt)을 한 번 잡아 두었다가 버튼으로 연다
 *   3) 서로 다른 날 몇 번 왔는지 (홈 안내 칸은 두 번째 날부터)
 *   4) 홈 화면 앱으로 열 때마다 pwa_open (세션당 한 번, first = 이 저장 공간에서 처음)
 *
 *   서비스 워커는 넣지 않는다(배포 뒤 옛 화면이 남는 위험). 설치 조건은 manifest 와 아이콘만으로 채운다.
 *   리스너는 main.tsx 가 웹 빌드에서만 initPwa() 로 단다(App.tsx 는 건드리지 않음).
 */
import { useEffect, useState } from 'react';
import { isAppintosBuild, hasNativeNavBack } from '@/lib/env';
import { inAppBrowserName } from '@/utils/inAppBrowser';
import { isStandaloneDisplay, isIosDevice, isAndroidDevice } from '@/lib/displayMode';

export { isStandaloneDisplay, isIosDevice, isAndroidDevice, isIosStandalone } from '@/lib/displayMode';

/** 웹에서만 (앱 빌드, 토스 앱 안, 토스 내비 바가 있는 곳은 전부 제외) */
export function pwaWebAllowed(): boolean {
  if (import.meta.env.VITE_BUILD_TARGET === 'appintos') return false;
  if (isAppintosBuild || hasNativeNavBack) return false;
  if (typeof navigator === 'undefined' || /TossApp/i.test(navigator.userAgent || '')) return false;
  return true;
}

export type A2hsPlatform =
  | 'toss'            // 앱인토스 (아무것도 보이지 않는다)
  | 'standalone'      // 이미 홈 화면 앱으로 열려 있다
  | 'in_app'          // 인스타그램, 카카오톡 같은 앱 안 브라우저
  | 'ios_safari'
  | 'ios_other'       // 아이폰 크롬, 엣지, 구글 앱 등
  | 'android_chrome'
  | 'android_samsung' // 삼성 인터넷
  | 'android_other'
  | 'desktop';

export function a2hsPlatform(): A2hsPlatform {
  if (!pwaWebAllowed()) return 'toss';
  if (isStandaloneDisplay()) return 'standalone';
  const ua = navigator.userAgent || '';
  if (inAppBrowserName(ua)) return 'in_app';
  if (isIosDevice(ua)) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|Whale|YaBrowser|DuckDuckGo|GSA\//i.test(ua)) return 'ios_other';
    return 'ios_safari';
  }
  if (isAndroidDevice(ua)) {
    if (/SamsungBrowser/i.test(ua)) return 'android_samsung';
    if (/Chrome\/\d+/i.test(ua) && !/EdgA|OPR\/|Firefox|YaBrowser|Whale|UCBrowser|MiuiBrowser|HuaweiBrowser|DuckDuckGo/i.test(ua)) return 'android_chrome';
    return 'android_other';
  }
  return 'desktop';
}

export const isMobileA2hsPlatform = (p: A2hsPlatform): boolean =>
  p === 'ios_safari' || p === 'ios_other' || p === 'android_chrome' || p === 'android_samsung' || p === 'android_other';

/* ── 설치 창 (안드로이드 크롬, 삼성 인터넷, PC 크롬과 엣지만 보낸다. 사파리는 없다) ── */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};
let deferredPrompt: InstallPromptEvent | null = null;
const promptSubs = new Set<() => void>();
const notifyPrompt = () => { promptSubs.forEach((fn) => { try { fn(); } catch { /* noop */ } }); };

export const hasInstallPrompt = (): boolean => !!deferredPrompt;

/** 설치 창을 잡거나 쓰면 알린다. 돌려받은 함수로 그만 듣는다 */
export function subscribeInstallPrompt(fn: () => void): () => void {
  promptSubs.add(fn);
  return () => { promptSubs.delete(fn); };
}

/** 내 정보 '홈 화면에 추가하기' 항목을 보일까: 웹 휴대폰 브라우저와 앱 안 브라우저, PC 는 설치 창을 잡았을 때만. 이미 홈 화면 앱이면 숨김 */
export function a2hsMenuVisible(): boolean {
  const p = a2hsPlatform();
  if (p === 'toss' || p === 'standalone') return false;
  if (p === 'desktop') return hasInstallPrompt();
  return true;
}

/** 설치 창을 잡았는지 바뀔 때마다 다시 그린다 */
export function useInstallPromptReady(): boolean {
  const [ready, setReady] = useState(hasInstallPrompt);
  useEffect(() => {
    const fn = () => setReady(hasInstallPrompt());
    promptSubs.add(fn);
    fn();
    return () => { promptSubs.delete(fn); };
  }, []);
  return ready;
}

function track(name: string, props: Record<string, string | number>): void {
  import('@/services/analytics').then((a) => a.trackEvent(name, props)).catch(() => { /* noop */ });
}

/** 잡아 둔 설치 창을 연다. 설치 창은 한 번만 쓸 수 있어 열고 나면 비운다 */
export async function runInstallPrompt(src: string): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferredPrompt;
  if (!e) {
    track('a2hs_prompt_result', { outcome: 'unavailable', src, plat: a2hsPlatform() });
    return 'unavailable';
  }
  deferredPrompt = null;
  notifyPrompt();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    const outcome = choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
    if (outcome === 'accepted') markInstalled();
    track('a2hs_prompt_result', { outcome, src, plat: a2hsPlatform() });
    return outcome;
  } catch {
    track('a2hs_prompt_result', { outcome: 'error', src, plat: a2hsPlatform() });
    return 'unavailable';
  }
}

/* ── 저장 (전부 try/catch — 저장이 막혀도 화면은 그대로) ── */
const DAYS_KEY = 'saju500:a2hs:days';            // { first, last, n } 서로 다른 날 몇 번 왔나 (KST)
const CARD_CLOSED_KEY = 'saju500:a2hs:card_closed'; // 홈 안내 칸을 닫은 시각
const INSTALLED_KEY = 'saju500:a2hs:installed';  // 이 브라우저에서 설치를 마쳤다 (안드로이드 설치 창, appinstalled)
const PWA_SEEN_KEY = 'saju500:pwa:seen';         // 이 저장 공간에서 홈 화면 앱으로 연 적이 있다
const PWA_SESSION_KEY = 'saju500:pwa:open';      // 이번 세션에 pwa_open 을 남겼다
const CARD_SNOOZE_MS = 30 * 24 * 3600e3;

function kstDay(): string {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}

function noteVisitDay(): void {
  try {
    const today = kstDay();
    const raw = localStorage.getItem(DAYS_KEY);
    const v = raw ? JSON.parse(raw) as { first?: string; last?: string; n?: number } : {};
    if (v.last === today) return;
    localStorage.setItem(DAYS_KEY, JSON.stringify({ first: v.first || today, last: today, n: (Number(v.n) || 0) + 1 }));
  } catch { /* noop */ }
}

/** 서로 다른 날 몇 번 왔나 (오늘 포함) */
export function visitDayCount(): number {
  try { return Number(JSON.parse(localStorage.getItem(DAYS_KEY) || '{}').n) || 0; } catch { return 0; }
}

function markInstalled(): void {
  try { localStorage.setItem(INSTALLED_KEY, String(Date.now())); } catch { /* noop */ }
}

/** 홈 안내 칸을 보여 줄까: 휴대폰 브라우저, 두 번째 날부터, 닫은 지 30일 지남, 설치 기록 없음 */
export function a2hsCardEligible(): boolean {
  if (!isMobileA2hsPlatform(a2hsPlatform())) return false;
  if (visitDayCount() < 2) return false;
  try {
    if (localStorage.getItem(INSTALLED_KEY)) return false;
    const closed = Number(localStorage.getItem(CARD_CLOSED_KEY) || 0);
    if (closed && Date.now() - closed < CARD_SNOOZE_MS) return false;
  } catch { /* 저장을 못 읽으면 보여 준다 */ }
  return true;
}

export function closeA2hsCard(): void {
  try { localStorage.setItem(CARD_CLOSED_KEY, String(Date.now())); } catch { /* noop */ }
}

function trackPwaOpen(): void {
  try {
    if (sessionStorage.getItem(PWA_SESSION_KEY)) return;
    sessionStorage.setItem(PWA_SESSION_KEY, '1');
  } catch { /* 세션 저장이 막혀도 기록은 남긴다 */ }
  let first = 0;
  try {
    if (!localStorage.getItem(PWA_SEEN_KEY)) { first = 1; localStorage.setItem(PWA_SEEN_KEY, String(Date.now())); }
  } catch { /* noop */ }
  track('pwa_open', { first, os: isIosDevice() ? 'ios' : isAndroidDevice() ? 'android' : 'other' });
}

let inited = false;
/** main.tsx 가 웹 빌드에서 한 번 부른다 */
export function initPwa(): void {
  if (inited || typeof window === 'undefined') return;
  inited = true;
  if (!pwaWebAllowed()) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // 크롬이 스스로 띄우는 설치 막대 대신 안내 시트의 버튼으로 연다
    deferredPrompt = e as InstallPromptEvent;
    notifyPrompt();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markInstalled();
    notifyPrompt();
    track('a2hs_prompt_result', { outcome: 'installed', src: 'event', plat: a2hsPlatform() });
  });
  noteVisitDay();
  if (isStandaloneDisplay()) trackPwaOpen();
}
