/**
 * 홈의 홈 화면 앱 안내 한 자리 (2026-10-23, 웹 전용 — 앱 빌드와 토스 안에서는 아무것도 그리지 않는다)
 *
 *   자리는 첫 화면(오늘 예고) 바로 아래, 아침 운세 메일 줄 다음. 첫 화면 위에는 끼우지 않는다.
 *   1) 아이폰 홈 화면 앱으로 열었고 로그인 전: '사파리에서 넣은 사주와 운은 로그인하면 이어져요' + 로그인 (닫으면 7일 안 보임)
 *      홈 화면 앱은 사파리와 저장 공간이 따로라(추가할 때 쿠키만 따라온다) 처음 열면 사주와 운이 비어 보인다.
 *   2) 휴대폰 브라우저로 다시 온 손님(서로 다른 날 두 번째부터): 홈 화면에 추가 안내 칸 (닫으면 30일 안 보임)
 *      홈 화면 앱, 앱 안 브라우저, PC 에서는 안 보인다.
 */
import { useCallback, useRef, useState } from 'react';
import { HJ, SERIF, GoldCta } from '@/components/hanji/Hanji';
import {
  pwaWebAllowed, isIosStandalone, a2hsPlatform, a2hsCardEligible, closeA2hsCard, visitDayCount,
  runInstallPrompt, useInstallPromptReady, type A2hsPlatform,
} from '@/lib/pwa';
import { A2hsGuideSheet } from '@/components/pwa/A2hsGuideSheet';
import { PwaLoginSheet, useRealLoginState } from '@/components/pwa/PwaLoginSheet';

function track(name: string, props: Record<string, string | number>): void {
  import('@/services/analytics').then((a) => a.trackEvent(name, props)).catch(() => { /* noop */ });
}

/** 한 화면에 한 번, 절반 넘게 보였을 때 */
function useSeenOnce(onSeen: () => void) {
  const done = useRef(false);
  return useCallback((el: HTMLElement | null) => {
    if (!el || done.current) return;
    if (typeof IntersectionObserver === 'undefined') { done.current = true; onSeen(); return; }
    const io = new IntersectionObserver((ents) => {
      if (done.current || !ents.some((e) => e.isIntersecting)) return;
      done.current = true;
      io.disconnect();
      onSeen();
    }, { threshold: 0.5 });
    io.observe(el);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function CloseX({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      style={{ position: 'absolute', top: 4, right: 4, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, cursor: 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={HJ.mute} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

export function HomePwaSlot() {
  const [mode] = useState<'login' | 'card' | 'none'>(() => {
    if (!pwaWebAllowed()) return 'none';
    if (isIosStandalone()) return 'login';
    return a2hsCardEligible() ? 'card' : 'none';
  });
  if (mode === 'login') return <StandaloneLoginNotice />;
  if (mode === 'card') return <A2hsHomeCard />;
  return null;
}

/* ── 1) 아이폰 홈 화면 앱, 로그인 전 ── */
const NOTICE_CLOSED_KEY = 'saju500:pwa:login_notice_closed';
const NOTICE_SNOOZE_MS = 7 * 24 * 3600e3;

function StandaloneLoginNotice() {
  const [loggedIn, setLoggedIn] = useRealLoginState();
  const [closed, setClosed] = useState(() => {
    try { const t = Number(localStorage.getItem(NOTICE_CLOSED_KEY) || 0); return !!t && Date.now() - t < NOTICE_SNOOZE_MS; } catch { return false; }
  });
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMounted, setLoginMounted] = useState(false);
  const seenRef = useSeenOnce(() => track('pwa_login_notice', { act: 'view' }));

  if (closed || loggedIn !== false) return null; // 로그인하면 사라진다 (null = 아직 확인 전이라 그리지 않는다)
  return (
    <div style={{ padding: '20px 16px 0' }}>
      <div ref={seenRef} style={{ position: 'relative', background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px 16px 14px' }}>
        <CloseX label="안내 닫기" onClick={() => {
          try { localStorage.setItem(NOTICE_CLOSED_KEY, String(Date.now())); } catch { /* noop */ }
          track('pwa_login_notice', { act: 'close' });
          setClosed(true);
        }} />
        <h2 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, lineHeight: 1.5, color: HJ.ink, paddingRight: 34, wordBreak: 'keep-all' }}>
          사파리에서 넣은 사주와 운은 로그인하면 이어져요
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2, marginTop: 6, wordBreak: 'keep-all' }}>
          홈 화면 앱은 사파리와 기록을 따로 보관해요. 사파리에서 로그인한 계정과 같은 계정으로 로그인해 주세요.
        </p>
        <GoldCta style={{ marginTop: 12 }} onClick={() => {
          track('pwa_login_notice', { act: 'login' });
          setLoginMounted(true);
          setLoginOpen(true);
        }}>
          로그인하고 이어 보기
        </GoldCta>
      </div>
      {loginMounted && (
        <PwaLoginSheet
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={() => { setLoginOpen(false); setLoggedIn(true); }}
          title={['사파리에서 쓰던 기록을', '이어서 볼 수 있어요']}
          desc={['사파리에서 로그인한 계정으로 로그인하면', '사주와 운, 보관함이 돌아와요']}
        />
      )}
    </div>
  );
}

/* ── 2) 다시 온 손님에게 홈 화면에 추가 안내 ── */
function A2hsHomeCard() {
  const [plat] = useState<A2hsPlatform>(() => a2hsPlatform());
  const [hidden, setHidden] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const promptReady = useInstallPromptReady();
  const isAndroid = plat === 'android_chrome' || plat === 'android_samsung' || plat === 'android_other';
  const seenRef = useSeenOnce(() => track('a2hs_card_view', { plat, days: visitDayCount() }));

  if (hidden) return null;
  const how = isAndroid
    ? (plat === 'android_samsung' ? '아래쪽 메뉴에서 현재 페이지 추가를 누르면 돼요.' : '크롬 메뉴에서 홈 화면에 추가를 누르면 돼요.')
    : '공유 버튼에서 홈 화면에 추가를 누르면 돼요.';

  return (
    <div style={{ padding: '20px 16px 0' }}>
      <div ref={seenRef} style={{ position: 'relative', background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '14px 14px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <CloseX label="홈 화면 추가 안내 닫기" onClick={() => {
          closeA2hsCard();
          track('a2hs_card_close', { plat });
          setHidden(true);
        }} />
        <img src="/icons/apple-touch-icon-180.png" alt="" width={44} height={44} style={{ borderRadius: 10, border: `1px solid ${HJ.line}`, flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0, paddingRight: 30 }}>
          <p style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 700, lineHeight: 1.5, color: HJ.ink, wordBreak: 'keep-all' }}>
            홈 화면에 두면 바로 열 수 있어요
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: HJ.mute, marginTop: 2, wordBreak: 'keep-all' }}>{how}</p>
          <button type="button"
            onClick={async () => {
              if (isAndroid && promptReady) {
                track('a2hs_card_click', { plat, act: 'prompt' });
                const r = await runInstallPrompt('home_card');
                if (r === 'accepted') { setHidden(true); return; }
                if (r === 'unavailable') setGuideOpen(true);
                return;
              }
              track('a2hs_card_click', { plat, act: 'guide' });
              setGuideOpen(true);
            }}
            style={{ marginTop: 8, padding: '6px 0', minHeight: 36, background: 'transparent', border: 0, fontSize: 15, fontWeight: 800, color: HJ.ink, cursor: 'pointer' }}>
            {isAndroid && promptReady ? '홈 화면에 추가하기 ›' : '추가하는 방법 보기 ›'}
          </button>
        </div>
      </div>
      <A2hsGuideSheet open={guideOpen} onClose={() => setGuideOpen(false)} src="home" />
    </div>
  );
}
