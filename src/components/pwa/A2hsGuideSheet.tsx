/**
 * 홈 화면에 추가하는 법 안내 시트 (2026-10-23, 웹 전용 — 앱 빌드와 토스 안에서는 그리지 않는다)
 *
 *   열리는 곳: 내 정보 '홈 화면에 추가하기', 홈의 다시 온 손님 안내 칸, /my?a2hs=1
 *   기기별로 다르게:
 *   - 아이폰 사파리: 공유 버튼 그림과 세 단계 (iOS 26 은 주소창 옆 점 세 개 버튼 다음 공유)
 *   - 아이폰 다른 브라우저: 같은 세 단계, 목록에 없으면 사파리로
 *   - 앱 안 브라우저(인스타그램, 카카오톡 등): 사파리나 크롬으로 열기 (기존 '기본 브라우저로 열기' 그대로)
 *   - 안드로이드 크롬 계열: 잡아 둔 설치 창이 있으면 버튼 하나, 없으면 메뉴에서 추가하는 순서
 *   - PC: 설치 창이 있으면 버튼, 없으면 휴대폰에서 다시 열라는 안내
 *   로그인 전이면 맨 위에 '먼저 로그인하면 운과 보관함이 홈 화면 앱에서도 그대로 보여요' (아이폰은 저장 공간이 따로라 특히 중요)
 */
import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HJ, SERIF, GoldCta, GhostButton } from '@/components/hanji/Hanji';
import { useToast } from '@/components/common/Toast';
import { inAppBrowserName, openInExternalBrowser } from '@/utils/inAppBrowser';
import { a2hsPlatform, pwaWebAllowed, runInstallPrompt, useInstallPromptReady, isAndroidDevice, type A2hsPlatform } from '@/lib/pwa';
import { PwaLoginSheet, useRealLoginState } from '@/components/pwa/PwaLoginSheet';

function track(name: string, props: Record<string, string | number>): void {
  import('@/services/analytics').then((a) => a.trackEvent(name, props)).catch(() => { /* noop */ });
}

/* ── 그림 (실제 화면의 버튼 모양, 먹 한 색) ── */
const ico = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: HJ.ink, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
/** iOS 공유 버튼 (네모에서 위로 나가는 화살표) */
export function IosShareIcon() {
  return (
    <svg {...ico}>
      <path d="M8.5 9.5H7a1.5 1.5 0 0 0-1.5 1.5v8.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V11A1.5 1.5 0 0 0 17 9.5h-1.5" />
      <path d="M12 2.8v11.4" />
      <path d="M8.6 6.2 12 2.8l3.4 3.4" />
    </svg>
  );
}
/** iOS 26 사파리 주소창 옆 점 세 개 버튼 */
function IosMoreIcon() {
  return (
    <svg {...ico}>
      <circle cx="12" cy="12" r="9.2" />
      <circle cx="7.8" cy="12" r="1" fill={HJ.ink} stroke="none" />
      <circle cx="12" cy="12" r="1" fill={HJ.ink} stroke="none" />
      <circle cx="16.2" cy="12" r="1" fill={HJ.ink} stroke="none" />
    </svg>
  );
}
/** 홈 화면에 추가 (네모 안 더하기) */
function AddSquareIcon() {
  return (
    <svg {...ico}>
      <rect x="4" y="4" width="16" height="16" rx="3.2" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}
/** 안드로이드 크롬 메뉴 (세로 점 세 개) */
function KebabIcon() {
  return (
    <svg {...ico}>
      <circle cx="12" cy="5.5" r="1.3" fill={HJ.ink} stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill={HJ.ink} stroke="none" />
      <circle cx="12" cy="18.5" r="1.3" fill={HJ.ink} stroke="none" />
    </svg>
  );
}
/** 삼성 인터넷 메뉴 (줄 세 개) */
function MenuLinesIcon() {
  return (
    <svg {...ico}>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

function IconKey({ children }: { children: ReactNode }) {
  return (
    <span style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${HJ.line}`, background: HJ.card, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </span>
  );
}

type Step = { t: string; s?: string; icons?: ReactNode[] };

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14 }}>
      {steps.map((st, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 14px', borderTop: i ? `1px solid ${HJ.line}` : 0 }}>
          <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 900, color: HJ.ink, width: 16, flexShrink: 0, lineHeight: 1.5 }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, lineHeight: 1.55, color: HJ.ink, wordBreak: 'keep-all' }}>{st.t}</span>
            {st.s && <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.6, color: HJ.mute, marginTop: 3, wordBreak: 'keep-all' }}>{st.s}</span>}
          </span>
          {st.icons && st.icons.length > 0 && (
            <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {st.icons.map((ic, k) => <IconKey key={k}>{ic}</IconKey>)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

const STEPS: Partial<Record<A2hsPlatform, Step[]>> = {
  ios_safari: [
    { t: '사파리 아래쪽 공유 버튼을 눌러요', s: 'iOS 26 은 주소창 옆 점 세 개 버튼을 누른 뒤 공유를 눌러요. 아이패드는 위쪽에 있어요.', icons: [<IosShareIcon key="s" />, <IosMoreIcon key="m" />] },
    { t: '홈 화면에 추가를 골라요', s: '안 보이면 목록을 위로 밀어 올려 보세요.', icons: [<AddSquareIcon key="a" />] },
    { t: '오른쪽 위 추가를 눌러요', s: '홈 화면에 생긴 사주500 아이콘으로 열면 돼요.' },
  ],
  ios_other: [
    { t: '주소창 오른쪽 공유 버튼을 눌러요', s: '크롬은 주소창 오른쪽에, 다른 브라우저는 메뉴 안에 있어요.', icons: [<IosShareIcon key="s" />] },
    { t: '홈 화면에 추가를 골라요', s: '목록에 없으면 사파리에서 saju500.app 을 열어 주세요.', icons: [<AddSquareIcon key="a" />] },
    { t: '추가를 눌러요', s: '홈 화면에 생긴 사주500 아이콘으로 열면 돼요.' },
  ],
  android_chrome: [
    { t: '크롬 오른쪽 위 점 세 개 메뉴를 눌러요', icons: [<KebabIcon key="k" />] },
    { t: '홈 화면에 추가를 골라요', s: '앱 설치라고 보일 때도 있어요.', icons: [<AddSquareIcon key="a" />] },
    { t: '추가나 설치를 눌러요', s: '홈 화면에 생긴 사주500 아이콘으로 열면 돼요.' },
  ],
  android_samsung: [
    { t: '아래쪽 메뉴 버튼을 눌러요', s: '줄 세 개 모양 버튼이에요.', icons: [<MenuLinesIcon key="l" />] },
    { t: '현재 페이지 추가를 누르고 홈 화면을 골라요', icons: [<AddSquareIcon key="a" />] },
    { t: '추가를 눌러요', s: '홈 화면에 생긴 사주500 아이콘으로 열면 돼요.' },
  ],
  android_other: [
    { t: '브라우저 메뉴를 눌러요', icons: [<KebabIcon key="k" />] },
    { t: '홈 화면에 추가를 골라요', s: '메뉴에 없으면 크롬에서 saju500.app 을 열어 주세요.', icons: [<AddSquareIcon key="a" />] },
    { t: '추가를 눌러요', s: '홈 화면에 생긴 사주500 아이콘으로 열면 돼요.' },
  ],
};

export function A2hsGuideSheet({ open, onClose, src }: { open: boolean; onClose: () => void; src: 'my' | 'home' | 'link' }) {
  const toast = useToast();
  const allowed = pwaWebAllowed();
  const [plat, setPlat] = useState<A2hsPlatform>(() => (allowed ? a2hsPlatform() : 'toss'));
  const promptReady = useInstallPromptReady();
  const [loggedIn, setLoggedIn] = useRealLoginState();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMounted, setLoginMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const inAppName = plat === 'in_app' ? inAppBrowserName() : null;

  useEffect(() => {
    if (!open || !allowed) return;
    const p = a2hsPlatform();
    setPlat(p);
    track('a2hs_guide_open', { src, plat: p });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!allowed) return null;

  const openLogin = () => { setLoginMounted(true); setLoginOpen(true); };
  const onPrompt = async () => {
    if (busy) return;
    setBusy(true);
    const r = await runInstallPrompt(`guide_${src}`);
    setBusy(false);
    if (r === 'accepted') { toast.show('홈 화면에 사주500을 추가했어요', 'success'); onClose(); }
  };
  const isAndroid = plat === 'android_chrome' || plat === 'android_samsung' || plat === 'android_other';
  const isIos = plat === 'ios_safari' || plat === 'ios_other';

  return (
    <>
      <AnimatePresence>
        {open && !loginOpen && (
          <>
            <motion.div key="a2hs-dim" className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.div key="a2hs-sheet" role="dialog" aria-modal="true" aria-label="홈 화면에 추가하는 법"
              className="fixed bottom-0 inset-x-0 z-50 flex flex-col"
              style={{
                maxHeight: '88vh', background: HJ.paper, color: HJ.ink, borderRadius: '24px 24px 0 0', maxWidth: 520, margin: '0 auto',
                padding: '24px 20px calc(28px + env(safe-area-inset-bottom))', overflowX: 'hidden', overflowY: 'auto',
              }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
              <button type="button" onClick={onClose} aria-label="닫기"
                className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full" style={{ background: 'transparent' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={HJ.ink2} strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 44 }}>
                <img src="/icons/apple-touch-icon-180.png" alt="" width={48} height={48} style={{ borderRadius: 11, border: `1px solid ${HJ.line}`, flexShrink: 0 }} />
                <h2 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-.02em' }}>
                  홈 화면에 사주500을<br />추가해요
                </h2>
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: HJ.ink2, marginTop: 10 }}>
                홈 화면의 사주500 아이콘을 누르면 주소를 넣지 않아도 바로 열려요.
              </p>

              {loggedIn === false && (
                <div style={{ marginTop: 16, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '14px 14px 12px' }}>
                  <p style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.6, color: HJ.ink, wordBreak: 'keep-all' }}>
                    먼저 로그인하면 운과 보관함이 홈 화면 앱에서도 그대로 보여요
                  </p>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: HJ.mute, marginTop: 4, wordBreak: 'keep-all' }}>
                    {isIos
                      ? '아이폰은 홈 화면 앱과 사파리가 기록을 따로 보관해요. 홈 화면 앱에서 같은 계정으로 로그인하면 이어져요.'
                      : '로그인해 두면 기기를 바꾸거나 브라우저 기록을 지워도 운과 보관함이 남아요.'}
                  </p>
                  <GhostButton style={{ marginTop: 10 }} onClick={openLogin}>로그인하기</GhostButton>
                </div>
              )}

              <div style={{ marginTop: 18 }}>
                {plat === 'standalone' && (
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2 }}>지금 홈 화면 앱으로 열려 있어요.</p>
                )}

                {plat === 'in_app' && (
                  <>
                    <p style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2, wordBreak: 'keep-all' }}>
                      {inAppName && inAppName !== '앱' ? `${inAppName} 안에서는` : '이 앱 안 화면에서는'} 홈 화면에 추가할 수 없어요.
                      {' '}{isAndroidDevice() ? '크롬' : '사파리'}에서 열면 추가할 수 있어요.
                    </p>
                    <GhostButton style={{ marginTop: 12 }} onClick={() => {
                      if (!openInExternalBrowser()) toast.show('오른쪽 위 메뉴에서 다른 브라우저로 열기를 눌러 주세요', 'info');
                    }}>
                      기본 브라우저로 열기
                    </GhostButton>
                    <p style={{ fontSize: 13.5, lineHeight: 1.6, color: HJ.mute, marginTop: 8, textAlign: 'center' }}>
                      열리지 않으면 오른쪽 위 메뉴에서 다른 브라우저로 열기를 눌러 주세요
                    </p>
                  </>
                )}

                {isIos && <Steps steps={STEPS[plat] || []} />}

                {isAndroid && promptReady && (
                  <>
                    <GoldCta onClick={onPrompt} disabled={busy}>홈 화면에 추가하기</GoldCta>
                    <p style={{ fontSize: 13.5, lineHeight: 1.6, color: HJ.mute, marginTop: 8, textAlign: 'center' }}>
                      누르면 뜨는 창에서 추가나 설치를 눌러 주세요
                    </p>
                  </>
                )}
                {isAndroid && !promptReady && <Steps steps={STEPS[plat] || []} />}

                {plat === 'desktop' && (promptReady ? (
                  <GoldCta onClick={onPrompt} disabled={busy}>이 컴퓨터에 설치하기</GoldCta>
                ) : (
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2, wordBreak: 'keep-all' }}>
                    휴대폰에서 saju500.app 을 열고 내 정보의 홈 화면에 추가하기를 눌러 주세요.
                  </p>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {loginMounted && (
        <PwaLoginSheet
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={() => { setLoggedIn(true); setLoginOpen(false); }}
          title={['로그인하고', '홈 화면에 추가해요']}
          desc={['로그인하면 운과 보관함이', '홈 화면 앱에서도 그대로 보여요']}
        />
      )}
    </>
  );
}
