import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, signIn, checkRedirectResult, ensureAuth, maybeUpgradeToTossIdentity, type WebLoginProvider } from '@/services/auth/authService';

const DEV_MODE = false;

/**
 * 로그인 직후 — 서버에서 보관함과 잔액을 맞추고(syncFromCloud), 그다음 확인이 끊긴 웹 결제와 서버가 자동으로 채운 웹 결제를 이 기기에 넣는다
 *   (2026-10-24, balanceAdjust.resumePortonePayments. 웹 화면, 로그인 계정만 — 앱인토스에서는 그 안에서 아무것도 하지 않는다).
 *   결제 넣기가 잔액 맞추기보다 먼저 돌면 로그아웃 스냅샷 되살리기가 그 운을 덮을 수 있어 순서를 지킨다.
 */
function syncAfterLogin(uid: string): void {
  Promise.all([import('@/services/storage/firestoreSync'), import('@/services/storage/balanceAdjust')])
    .then(([{ syncFromCloud, syncToCloud }, adj]) => {
      syncToCloud(uid);
      const done = syncFromCloud(uid);
      adj.noteLoginBalanceSync(done);
      return done.then(() => adj.resumePortonePayments());
    })
    .catch(() => { /* 무해 — 다음 페이지 로드에서 다시 */ });
}

/** 로그인 계정의 사주원국 사본 합치기 (웹만 — 앱인토스 판정은 firestoreSync.mergeAccountProfiles 안에서) */
function mergeAccountProfilesLater(uid: string): void {
  import('@/services/storage/firestoreSync')
    .then(({ mergeAccountProfiles }) => mergeAccountProfiles(uid))
    .then((n) => { if (n > 0) console.info(`[Sync] 로그인 계정 사주원국 ${n}명 합침`); })
    .catch(() => { /* 무해 — 다음 페이지 로드에서 다시 */ });
}

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
          .then((n) => {
            // 2026-10-19 — 말없이 잔액이 줄면 놀란다. 거둔 만큼 알린다 (토스 앱 결제 환불도 이제 거둔다)
            if (n > 0) window.dispatchEvent(new CustomEvent('saju500:toast', { detail: { text: `환불된 결제의 운 ${n}운(보너스 포함)을 잔액에서 뺐어요`, type: 'info' } }));
          })
          .catch(() => { /* 무해 — 다음 부팅에서 재시도 */ });
        // P1 엔드게임 — 익명→토스 안정 uid 승격(플래그 OFF 기본, 내부에서 게이팅).
        maybeUpgradeToTossIdentity().catch(() => { /* 무해 — 익명 유지 */ });
        // 2026-10-23 — 웹 로그인 계정(구글, 카카오, 네이버 맞춤 토큰 모두 여기로 온다): 그 계정의 사주원국 사본을 이 기기에 합친다.
        //   부팅 복원(restoreProfilesIfEmpty)은 로그인 전 익명 계정의 빈 사본을 읽어 가족 사주가 돌아오지 않았다. 웹만, 계정당 페이지 한 번.
        if (!u.isAnonymous) mergeAccountProfilesLater(u.uid);
      }
    });

    // 모바일 리다이렉트 로그인 복귀 처리
    checkRedirectResult().then((u) => {
      if (u) {
        syncAfterLogin(u.uid);
        mergeAccountProfilesLater(u.uid);
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
      syncAfterLogin(u.uid);
      // 익명 연결(uid 그대로)은 onAuthChange 가 다시 오지 않아 여기서도 부른다 (계정당 한 번이라 겹쳐도 한 번 읽음)
      mergeAccountProfilesLater(u.uid);
      return u;
    } catch (err: any) {
      // 2026-10-19 — 스스로 닫은 것은 조용히, 팝업 막힘 같은 실패는 시트가 안내하도록 넘긴다(그전엔 전부 삼켜서 눌러도 아무 일이 없어 보였다)
      const code: string = err?.code || '';
      if (/popup-closed-by-user|cancelled-popup-request|user-cancelled/.test(code) || err?.message === '로그인 화면으로 이동해요') return null;
      // msg: 오류 문장 앞부분(10-19 네이버 invalid-credential 원인 진단 — 코드만으로는 제공자 쪽 이유를 모른다)
      import('@/services/analytics').then((a) => a.trackEvent('login_fail', { provider: String(provider || ''), via: 'popup', code: (code || String(err?.message || 'error')).slice(0, 60), msg: String(err?.message || '').replace(/^Firebase:\s*/, '').slice(0, 180) })).catch(() => {});
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
