/**
 * WebLoginSheet — 웹 전용 소셜 로그인 시트 (앱인토스는 토스 로그인만, 이 시트를 열지 않는다)
 *  2026-10-16 MyPage 의 LoginModal 을 옮김. 충전 화면이 결제 전에 같은 시트로 로그인을 받는다.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { useToast } from '@/components/common/Toast';
import { inAppBrowserName, openInExternalBrowser } from '@/utils/inAppBrowser';
import { isIosStandalone } from '@/lib/displayMode';
import { authDomainIsSelf } from '@/services/auth/firebase';

const C = {
  paper:    '#F8F5EE',
  ink:      '#1A1A1A',
  inkSoft:  '#3D3D3D',
  mute:     '#6F6557',
  gold:     '#B8965A',
  goldSoft: 'rgba(184,150,90,0.14)',
} as const;
const SERIF = "'Noto Serif KR', serif";

/* ══════════════════════════════════════════
   WebLoginSheet — 웹 로그인 시트 (MyPage 에서 옮김 2026-10-16, 충전 화면도 같이 쓴다)
══════════════════════════════════════════ */
export function WebLoginSheet({ open, onClose, toast, onLogin, title, desc, onSuccess }: {
  open: boolean;
  onClose: () => void;
  toast: ReturnType<typeof useToast>;
  onLogin: (provider?: 'kakao' | 'naver' | 'apple' | 'google') => Promise<any>;
  /** 제목 두 줄 (기본: 내 사주를 안전하게 / 보관해요) */
  title?: [string, string];
  desc?: [string, string];
  /** 로그인이 실제로 끝났을 때 (익명이 아닌 계정이 됐을 때). 없으면 onClose */
  onSuccess?: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  // 2026-10-19 — 인스타그램, 카카오톡 같은 앱 안 화면에서는 구글이 로그인을 막는다 → 구글 버튼을 숨기고 안내를 한 줄 둔다
  const inApp = inAppBrowserName();
  // 2026-10-23 — 아이폰 홈 화면 앱인데 사이트 주소가 saju500.app 이 아니면(web.app 등) 로그인 결과가 돌아오지 않는다 → 버튼 대신 안내
  //   10-24 검수 — 앱 빌드에서는 분기와 문구가 통째로 빠지게 빌드 상수를 앞에 둔다
  const standaloneBlocked = import.meta.env.VITE_BUILD_TARGET !== 'appintos' && isIosStandalone() && !authDomainIsSelf;

  const handleLogin = async (provider: 'kakao' | 'naver' | 'apple' | 'google') => {
    if (busy) return;
    setBusy(true);
    try {
      await onLogin(provider);
      // 로그인 함수는 실패를 삼킨다 — 실제로 익명이 아닌 계정이 됐는지로 판정 (2026-10-16)
      const { auth } = await import('@/services/auth/firebase');
      if (auth.currentUser && !auth.currentUser.isAnonymous) { (onSuccess || onClose)(); }
    } catch (err: any) {
      // Apple Service ID 미설정 시 Firebase가 auth/operation-not-supported-in-this-environment 등 반환
      const code: string = err?.code || '';
      if (code === 'saju500/standalone-host') {
        toast.show('홈 화면 앱에서는 이 주소로 로그인할 수 없어요. 사파리에서 saju500.app 으로 열어 주세요', 'info');
      } else if (provider === 'apple' && (code.includes('operation-not-supported') || code.includes('configuration-not-found'))) {
        toast.show('지금은 Apple 로그인을 쓸 수 없어요. 다른 방법으로 로그인해 주세요', 'info');
      } else if (code.includes('popup-blocked')) {
        toast.show('로그인 창이 열리지 않았어요. 버튼을 한 번 더 눌러 주세요', 'warning');
      } else if (inApp && (code.includes('operation-not-supported') || code.includes('web-storage-unsupported') || code.includes('network-request-failed'))) {
        toast.show(`${inApp} 안에서는 로그인이 안 될 때가 있어요. 오른쪽 위 메뉴에서 다른 브라우저로 열어 주세요`, 'warning');
      } else {
        toast.show('로그인에 실패했어요. 다시 시도해 주세요.', 'warning');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 딤드 배경 */}
          <motion.div
            key="login-dim"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* 시트 본체 — 80vh, radius-top 24 */}
          <motion.div
            key="login-sheet"
            className="fixed bottom-0 inset-x-0 z-50 flex flex-col"
            style={{
              height: '80vh',
              background: C.paper,
              borderRadius: '24px 24px 0 0',
              maxWidth: 520,
              margin: '0 auto',
              padding: '24px 24px 40px',
              // 2026-10-21 — 키 작은 화면(인스타그램 안 등)에서 아래 약관 문구가 잘려 넘치면 스크롤
              overflowX: 'hidden',
              overflowY: 'auto',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            {/* 닫기 버튼 */}
            <button type="button" onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(0,0,0,0.06)' }}
              aria-label="닫기">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={C.inkSoft} strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* 상단 심볼 */}
            <div className="flex justify-center mb-5 mt-2">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: C.goldSoft }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                  stroke={C.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  <circle cx="12" cy="16" r="1.5" fill={C.gold} />
                </svg>
              </div>
            </div>

            {/* 헤더 (§2-2) */}
            <h1 className="text-center text-[22px] font-bold leading-[1.35] mb-2"
              style={{ color: C.ink, fontFamily: SERIF }}>
              {(title || ['내 사주를 안전하게', '보관해요'])[0]}<br />{(title || ['내 사주를 안전하게', '보관해요'])[1]}
            </h1>
            <p className="text-center text-[14px] leading-[1.6] mb-8" style={{ color: C.mute }}>
              {(desc || ['로그인하면 운 잔액, 풀이 기록, 결제 내역을', '안전하게 관리할 수 있어요'])[0]}<br />{(desc || ['로그인하면 운 잔액, 풀이 기록, 결제 내역을', '안전하게 관리할 수 있어요'])[1]}
            </p>

            {standaloneBlocked && (
              <div className="flex flex-col gap-3 flex-1">
                <p className="text-center text-[15px] leading-[1.7]" style={{ color: C.ink }}>
                  홈 화면 앱에서는 이 주소로 로그인할 수 없어요.<br />사파리에서 saju500.app 으로 열고 로그인해 주세요.
                </p>
                <p className="text-center text-[13px] leading-[1.6]" style={{ color: C.mute }}>
                  사파리에서 saju500.app 을 연 뒤 홈 화면에 다시 추가하면 새 아이콘에서는 로그인할 수 있어요
                </p>
              </div>
            )}

            {/* 카카오, 네이버, 구글 (Apple 은 Firebase 에 설정이 없어 눌러도 실패 → 2026-10-16 숨김) */}
            {!standaloneBlocked && <div className="flex flex-col gap-3 flex-1">
              {/* 카카오 — signIn('kakao') 실제 연결 */}
              <button type="button"
                onClick={() => handleLogin('kakao')}
                disabled={busy}
                className="w-full flex items-center justify-center gap-3 rounded-2xl font-semibold text-[16px]"
                style={{ height: 52, background: '#FEE500', color: C.ink, opacity: busy ? 0.6 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={C.ink} aria-hidden>
                  <path d="M12 3C6.477 3 2 6.477 2 10.9c0 2.789 1.698 5.24 4.29 6.73l-.89 3.27 3.78-2.49A11.5 11.5 0 0 0 12 18.8c5.523 0 10-3.477 10-7.9C22 6.477 17.523 3 12 3z" />
                </svg>
                카카오 로그인
              </button>

              {/* 네이버 — signIn('naver') 실제 연결. 10-19 네이버 검수용으로 공식 N 모양과 '네이버 로그인' 문구(버튼 가이드) */}
              <button type="button"
                onClick={() => handleLogin('naver')}
                disabled={busy}
                className="w-full flex items-center justify-center gap-3 rounded-2xl font-semibold text-[16px]"
                style={{ height: 52, background: '#03C75A', color: '#fff', opacity: busy ? 0.6 : 1 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                  <path d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845Z" />
                </svg>
                네이버 로그인
              </button>

              {/* 구글 — GoogleAuthProvider (2026-06-12 추가 — 모달에 구글만 빠져 있던 것). 앱 안 화면에서는 숨김(10-19) */}
              {!inApp && <button type="button"
                onClick={() => handleLogin('google')}
                disabled={busy}
                className="w-full flex items-center justify-center gap-3 rounded-2xl font-semibold text-[16px]"
                style={{ height: 52, background: '#FFFFFF', color: C.ink, border: '1px solid rgba(26,26,26,0.15)', opacity: busy ? 0.6 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v2.98h3.87c2.26-2.09 3.55-5.17 3.55-8.8z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.93l-3.87-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.07A11.99 11.99 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.64H1.29a11.99 11.99 0 0 0 0 10.72l3.98-3.07z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.94 1.19 15.23 0 12 0A11.99 11.99 0 0 0 1.29 6.64l3.98 3.07C6.22 6.86 8.87 4.75 12 4.75z" />
                </svg>
                구글 로그인
              </button>}
              {inApp && (
                <>
                  <p className="text-center text-[13px] leading-[1.6] mt-1" style={{ color: C.mute }}>
                    구글 계정은 {inApp} 안에서 로그인할 수 없어요
                  </p>
                  {/* 2026-10-21 — 메뉴를 찾지 못하는 손님용. 막힌 곳(아이폰 인스타그램 등)은 위 안내대로 오른쪽 위 메뉴 */}
                  <button type="button"
                    onClick={() => { if (!openInExternalBrowser()) toast.show('오른쪽 위 메뉴에서 다른 브라우저로 열기를 눌러 주세요', 'info'); }}
                    className="w-full rounded-2xl font-semibold text-[15px]"
                    style={{ height: 48, background: 'transparent', color: C.ink, border: '1px solid rgba(26,26,26,0.2)' }}>
                    기본 브라우저로 열기
                  </button>
                  <p className="text-center text-[13px] leading-[1.6]" style={{ color: C.mute }}>
                    열리지 않으면 오른쪽 위 메뉴에서 다른 브라우저로 열기를 눌러 주세요
                  </p>
                </>
              )}

            </div>}

            {/* 하단 동의 캡션 (§2-2) */}
            <p className="text-center text-[13px] mt-5 leading-[1.6]" style={{ color: C.mute }}>
              로그인하면{' '}
              <button type="button" className="underline tap-pad" onClick={() => navigate('/terms')}>이용약관</button>
              과{' '}
              <button type="button" className="underline tap-pad" onClick={() => navigate('/privacy')}>개인정보처리방침</button>
              에 동의한 것으로 봐요.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
