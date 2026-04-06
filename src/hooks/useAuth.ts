import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, signIn, checkRedirectResult, type WebLoginProvider } from '@/services/auth/authService';

const DEV_MODE = false;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!DEV_MODE);
  const [devLoggedIn] = useState(DEV_MODE);

  useEffect(() => {
    if (DEV_MODE) return;
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
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
      import('@/services/storage/firestoreSync').then(({ syncFromCloud, syncToCloud }) => {
        syncToCloud(u.uid);
        syncFromCloud(u.uid);
      });
    } catch {
      // 로그인 취소/실패 — 무시
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
