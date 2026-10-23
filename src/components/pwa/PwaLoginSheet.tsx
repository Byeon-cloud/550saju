/**
 * 홈 화면 앱 안내에서 쓰는 로그인 시트와 로그인 상태 (2026-10-23, 웹 전용)
 *
 *   로그인 시트는 기존 WebLoginSheet 를 그대로 쓴다. useAuth 는 시트를 처음 열 때만 붙인다
 *   (홈에는 이미 useAuth 가 하나 돌고 있어 리다이렉트 결과 읽기를 겹쳐 부르지 않으려고).
 *   로그인 상태는 onIdTokenChanged 로 본다. 익명 계정에 소셜 계정을 '연결'하면 uid 가 그대로라
 *   onAuthStateChanged 는 다시 오지 않지만 토큰은 바뀐다.
 */
import { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/services/auth/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import { WebLoginSheet } from '@/components/auth/WebLoginSheet';

/** 익명이 아닌 계정으로 로그인했나. null = 아직 모름(첫 상태 확인 전) */
export function useRealLoginState(): [boolean | null, (v: boolean) => void] {
  const [state, setState] = useState<boolean | null>(() => (auth.currentUser ? !auth.currentUser.isAnonymous : null));
  useEffect(() => {
    let alive = true;
    const off = onIdTokenChanged(auth, (u) => { if (alive) setState(!!u && !u.isAnonymous); });
    // 첫 확인이 늦으면(익명 로그인 전) 저장된 로그인 복원이 끝난 뒤의 값으로
    auth.authStateReady?.().then(() => { if (alive) setState(!!auth.currentUser && !auth.currentUser.isAnonymous); }).catch(() => { /* noop */ });
    return () => { alive = false; off(); };
  }, []);
  return [state, setState];
}

export function PwaLoginSheet({ open, onClose, onSuccess, title, desc }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: [string, string];
  desc?: [string, string];
}) {
  const toast = useToast();
  const { login } = useAuth();
  return (
    <WebLoginSheet open={open} onClose={onClose} onSuccess={onSuccess} toast={toast} onLogin={login} title={title} desc={desc} />
  );
}
