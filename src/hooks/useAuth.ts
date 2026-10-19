import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, signIn, checkRedirectResult, ensureAuth, maybeUpgradeToTossIdentity, type WebLoginProvider } from '@/services/auth/authService';

const DEV_MODE = false;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!DEV_MODE);
  const [devLoggedIn] = useState(DEV_MODE);
  // 익명 → 소셜 '연결'은 uid 와 User 객체가 그대로라 onAuthStateChanged 도 setUser 도 다시 그리지 않는다 → 직접 한 번 다시 그린다 (2026-10-16)
  const [, setTick] = useState(0);

  useEffect(() => {
    if (DEV_MODE) return;
    // 익명 로그인 자동 수행 → Cloud Functions 호출 가능하게
    ensureAuth();

    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
      // 🚨 P0-1 (2026-06-22) — 익명 포함 '모든' 유저: uid 잡히는 즉시 서버 백업/복원.
      //   기존엔 명시 로그인(아래 login·checkRedirectResult)에서만 sync 가 돌아, 앱 기본인
      //   '익명' 유저는 백업/복원이 영영 안 돌았음(6/19 백업·restoreLibrary 가 데드코드화).
      //   → 토스 웹뷰가 localStorage 비우면 서버에 원본 0 → "내역 사라짐/흰 화면" 확정.
      //   bootSync 가 module-level 가드로 'uid당 1회'(다중 hook 인스턴스·StrictMode 중복 차단) +
      //   복원(reports only)→백업 순서 보장. 잔액 복원은 OFF(이미 쓴 운 부활 과복원 방지).
      if (u) {
        import('@/services/storage/firestoreSync')
          .then(({ bootSync }) => bootSync(u.uid))
          .catch(() => { /* 무해 — 다음 페이지 로드에서 재시도 */ });
        // 2026-10-16 — 결제 취소(환불)로 회수할 운이 있으면 기기 잔액에서 뺀다 (서버 balanceAdjustments)
        import('@/services/storage/balanceAdjust')
          .then(({ applyBalanceAdjustments }) => applyBalanceAdjustments(u.uid))
          .catch(() => { /* 무해 — 다음 부팅에서 재시도 */ });
        // P1 엔드게임 — 익명→토스 안정 uid 승격(플래그 OFF 기본, 내부에서 게이팅).
        maybeUpgradeToTossIdentity().catch(() => { /* 무해 — 익명 유지 */ });
      }
    });

    // 모바일 리다이렉트 로그인 복귀 처리
    checkRedirectResult().then((u) => {
      if (u) {
        import('@/services/storage/firestoreSync').then(({ syncFromCloud, syncToCloud }) => {
          syncToCloud(u.uid);
          syncFromCloud(u.uid);
        });
      }
    });

    return unsubscribe;
  }, []);

  /** 로그인 — provider를 지정하지 않으면 로그인 선택 모달용 */
  const login = useCallback(async (provider?: WebLoginProvider) => {
    try {
      const u = await signIn(provider);
      setUser(u);
      setTick((n) => n + 1);
      import('@/services/storage/firestoreSync').then(({ syncFromCloud, syncToCloud }) => {
        syncToCloud(u.uid);
        syncFromCloud(u.uid);
      });
      return u;
    } catch (err: any) {
      // 2026-10-19 — 스스로 닫은 것은 조용히, 팝업 막힘 같은 실패는 시트가 안내하도록 넘긴다(그전엔 전부 삼켜서 눌러도 아무 일이 없어 보였다)
      const code: string = err?.code || '';
      if (/popup-closed-by-user|cancelled-popup-request|user-cancelled/.test(code) || err?.message === '로그인 화면으로 이동해요') return null;
      import('@/services/analytics').then((a) => a.trackEvent('login_fail', { provider: String(provider || ''), via: 'popup', code: (code || String(err?.message || 'error')).slice(0, 60) })).catch(() => {});
      throw err;
    }
  }, []);

  const devLogin = login;

  return {
    user,
    loading,
    isLoggedIn: DEV_MODE || !!user || devLoggedIn,
    login,
    devLogin,
  };
}
