/**
 * 로그인 직후 잔액 맞추기 (2026-10-24 검수로 useAuth 에서 옮김)
 *
 * syncAfterLogin: 서버에서 보관함과 잔액을 맞추고(syncFromCloud 전체, 로그아웃 스냅샷 되살리기 포함), 그다음 확인이 끊긴 웹 결제와
 *   서버가 자동으로 채운 웹 결제를 이 기기에 넣는다(balanceAdjust.resumePortonePayments. 웹 화면, 로그인 계정만, 앱인토스에서는 그 안에서 아무것도 하지 않는다).
 *   결제 넣기가 잔액 맞추기보다 먼저 돌면 로그아웃 스냅샷 되살리기가 그 운을 덮을 수 있어 순서를 지킨다(noteLoginBalanceSync).
 *
 * 네이버 로그인 (웹, 맞춤 토큰): 로그인은 /auth/naver 화면에서 끝나고 보던 화면을 새로 연다. 새 페이지에는 login() 이나
 *   리다이렉트 결과가 없어 syncAfterLogin 이 돌지 않았다(로그아웃 뒤 네이버로 다시 들어오면 기기 잔액이 0으로 남음, 10-19부터).
 *   그래서 콜백 화면이 새로 열기 직전에 탭 저장소(sessionStorage)에 표시를 남기고(markLoginSyncPending),
 *   새 페이지의 useAuth 가 그 계정으로 로그인된 것을 보면 표시를 지우고 한 번 부른다(takeLoginSyncPending).
 */
const LOGIN_SYNC_PENDING_KEY = 'saju500:login_sync_uid';

export function syncAfterLogin(uid: string): void {
  Promise.all([import('@/services/storage/firestoreSync'), import('@/services/storage/balanceAdjust')])
    .then(([{ syncFromCloud, syncToCloud }, adj]) => {
      syncToCloud(uid);
      const done = syncFromCloud(uid);
      adj.noteLoginBalanceSync(done);
      return done.then(() => adj.resumePortonePayments());
    })
    .catch(() => { /* 무해 — 다음 페이지 로드에서 다시 */ });
}

/** 로그인을 끝낸 화면이 보던 화면을 새로 열기 직전 (네이버 콜백) */
export function markLoginSyncPending(uid: string): void {
  try { if (uid) sessionStorage.setItem(LOGIN_SYNC_PENDING_KEY, uid); } catch { /* noop */ }
}

/** 이 계정으로 표시가 남아 있으면 지우고 true (한 번만) */
export function takeLoginSyncPending(uid: string): boolean {
  try {
    if (!uid || sessionStorage.getItem(LOGIN_SYNC_PENDING_KEY) !== uid) return false;
    sessionStorage.removeItem(LOGIN_SYNC_PENDING_KEY);
    return true;
  } catch { return false; }
}
