import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, signIn } from '@/services/auth/authService';

// 개발 중: true → 로그인 없이 모든 페이지 접근
// 런칭 시: false → 실제 로그인 필요
const DEV_MODE = false;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!DEV_MODE);
  const [devLoggedIn, setDevLoggedIn] = useState(DEV_MODE);

  useEffect(() => {
    if (DEV_MODE) return;
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async () => {
    try {
      const u = await signIn();
      import('@/services/storage/firestoreSync').then(({ syncFromCloud, syncToCloud }) => {
        syncToCloud(u.uid);
        syncFromCloud(u.uid);
      });
    } catch {
      setDevLoggedIn(true);
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
