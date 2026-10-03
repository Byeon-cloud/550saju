/**
 * 기기 여권 클라 — 부팅 시 deviceId→uid 등록 + uid 회전 감지 시 보관함 자동 복원
 *   (2026-08-13 · CS "운·보관함 전부 초기화" 재발 대응 · 서버 registerDevicePassport 짝)
 *
 * 동작:
 *   1) 앱인토스에서만 (getDeviceId 는 토스 SDK 전용 — 웹은 no-op)
 *   2) 매 부팅 서버에 (deviceId, uid) 등록 — 6h throttle 로 과호출 방지
 *   3) 서버가 "이 기기의 직전 uid" 를 발견하면 보관함을 자동 이관 → 클라는 서버에서 내려받아
 *      localStorage 복원 + 안내 플래그 기록 (다음 렌더에서 토스트)
 *
 * 실패는 전부 조용히 삼킨다 — 여권은 안전망이지 부팅 크리티컬 패스가 아니다.
 */

const THROTTLE_KEY = 'saju500:passport_at';
const NOTICE_KEY = 'saju500:passport_recovered'; // 복원 건수 — UI 토스트용
const SEEDED_KEY = 'saju500:balance_seeded'; // (구) 영구 플래그 — 2026-10-03 부팅 단위로 교체, 남은 값은 정리
let seededThisBoot = false; // 이번 부팅에 잔액 미러로 seed 했는가 — IAP 복구 이중가산 방지
try { localStorage.removeItem(SEEDED_KEY); } catch { /* noop */ }
const PROFILES_BACKFILL_KEY = 'saju500:profiles_mirror_v1'; // 기존 유저 사주원국 미러 1회 백필
const SEED_PENDING_KEY = 'saju500:seed_pending'; // seed 미완(가드/네트워크) — 다음 부팅 재시도
const THROTTLE_MS = 6 * 60 * 60 * 1000; // 6h

export async function runDevicePassportCheck(): Promise<void> {
  try {
    await runDevicePassportCheckInner();
  } finally {
    // 저장소가 빈 부팅에서 보류했던 잔액 미러 push 해제 (여권이 끝났거나 실행되지 않음)
    try { (await import('@/services/storage/localStore')).releaseBalanceMirror(); } catch { /* noop */ }
  }
}

async function runDevicePassportCheckInner(): Promise<void> {
  try {
    const { isAppsInToss } = await import('@/services/payment/iapService');
    if (!isAppsInToss()) return;

    // throttle — 등록은 하루 몇 번이면 충분 (회전 감지는 부팅 직후 1회가 핵심).
    //   단 seed 재시도 대기(SEED_PENDING) 상태면 throttle 무시 — 잔액 복원이 우선.
    try {
      const pendingRetry = localStorage.getItem(SEED_PENDING_KEY) === '1';
      const last = Number(localStorage.getItem(THROTTLE_KEY) || 0);
      if (!pendingRetry && Date.now() - last < THROTTLE_MS) return;
    } catch { /* storage 접근 불가 시에도 진행 */ }

    const mod: any = await import('@apps-in-toss/web-framework');
    const deviceId: string | undefined = mod?.getDeviceId?.();
    if (!deviceId) return;

    const { ensureAuth } = await import('@/services/auth/authService');
    await ensureAuth();
    const { auth } = await import('@/services/auth/firebase');
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app } = await import('@/services/auth/firebase');
    // 기존 유저 사주원국 미러 백필 (1회) — 미러는 프로필을 쓸 때만 생겨서, 기존 유저는 영영 백업이 없었다
    try {
      if (!localStorage.getItem(PROFILES_BACKFILL_KEY)) {
        const store = await import('@/services/storage/localStore');
        const profs = store.getProfiles();
        if (profs.length > 0) {
          const s = await import('@/services/storage/firestoreSync');
          await s.pushProfilesMirror(profs);
        }
        localStorage.setItem(PROFILES_BACKFILL_KEY, '1');
      }
    } catch { /* 다음 부팅 재시도 */ }

    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'registerDevicePassport');
    // 토스 익명키 — '미니앱 × 토스 계정' 고유값. 기기가 바뀌어도 같은 사람을 잇는다 (2026-09-27).
    const anonKey = await getTossAnonKey(mod);
    const r: any = await fn(anonKey ? { deviceId, anonKey } : { deviceId });

    try { localStorage.setItem(THROTTLE_KEY, String(Date.now())); } catch { /* noop */ }

    const migrated = (Number(r?.data?.migratedReports) || 0) + (Number(r?.data?.migratedChats) || 0);
    const rotated = !!r?.data?.rotated;
    const mirrorReady = !!r?.data?.mirrorReady;
    const profilesRestored = Number(r?.data?.profilesRestored) || 0;
    const sync = await import('@/services/storage/firestoreSync');

    // (0) 사주원국 복원 — 서버가 옛 계정 목록을 합쳐줬으면 로컬로 병합 (없는 것만 추가)
    if (profilesRestored > 0 || rotated) {
      try {
        const items = await sync.pullProfilesMirror(uid);
        if (items.length) {
          const store = await import('@/services/storage/localStore');
          store.mergeProfiles(items);
        }
      } catch { /* noop — 리포트 복원 경로가 인물도 함께 복원한다 */ }
    }

    // (a) 보관함 복원 — 서버가 옛 uid 리포트를 이 uid 로 이관했을 때
    if (migrated > 0) {
      await sync.syncFromCloud(uid, { reportsOnly: true });
      try { localStorage.setItem(NOTICE_KEY, String(migrated)); } catch { /* noop */ }
      console.info(`[기기여권] uid 회전 감지 — 보관함 ${migrated}건 자동 복원`);
    }

    // (b) 잔액 seed — 🚨 리포트 유무와 독립 (P0 fix). 회전이거나 미러 준비됐거나, 재시도 대기 상태면 시도.
    //   무료 위주 유저(리포트 백업 0건)도 잔액이 복원돼야 한다. seedBalanceFromMirror 내부 가드로 안전.
    const pending = (() => { try { return localStorage.getItem(SEED_PENDING_KEY) === '1'; } catch { return false; } })();
    if (rotated || mirrorReady || pending) {
      try {
        const mirror = await sync.pullBalanceMirror(uid);
        if (mirror && !mirror.migratedFromUid) {
          // 옛 계정에서 온 미러가 아님(이 기기의 기본값 등) — seed 할 재료가 아니다. 재시도 루프도 끝낸다.
          try { localStorage.removeItem(SEED_PENDING_KEY); } catch { /* noop */ }
        } else if (mirror) {
          const store = await import('@/services/storage/localStore');
          if (store.seedBalanceFromMirror(mirror)) {
            seededThisBoot = true;
            try { localStorage.removeItem(SEED_PENDING_KEY); } catch { /* noop */ }
            console.info(`[기기여권] 잔액 스냅샷 복원 — paid ${mirror.paid} · bonus ${mirror.bonus} · reward ${mirror.reward}`);
          } else if (store.getBalance() > 1) {
            // 이미 의미있는 잔액 보유(정상 소비/충전 재개) → 재시도 무의미, 종결 (무한 재호출 방지)
            try { localStorage.removeItem(SEED_PENDING_KEY); } catch { /* noop */ }
          } else {
            // 잔액 아직 무의미인데 못 넣음(일시적) → 다음 부팅 재시도 표식
            try { localStorage.setItem(SEED_PENDING_KEY, '1'); } catch { /* noop */ }
          }
        } else if (rotated) {
          // 회전인데 미러 pull 실패(네트워크) → 재시도 대기
          try { localStorage.setItem(SEED_PENDING_KEY, '1'); } catch { /* noop */ }
        }
      } catch {
        try { localStorage.setItem(SEED_PENDING_KEY, '1'); } catch { /* noop */ }
      }
    }
  } catch {
    // 조용히 — 다음 부팅에 재시도
  }
}

/** 토스 익명키 조회 — 3.x `User.getAnonymousKey`(throw) 우선, 없으면 구 `getAnonymousKey`. 3초 타임아웃. */
async function getTossAnonKey(mod: any): Promise<string | undefined> {
  // 전체 대기 예산 3초 하나 — 여권(잔액·보관함 복원)을 늦추지 않도록
  const withTimeout = <T,>(p: Promise<T>): Promise<T | undefined> =>
    Promise.race([p, new Promise<undefined>((res) => setTimeout(() => res(undefined), 3000))]);
  if (typeof mod?.User?.getAnonymousKey === 'function') {
    try {
      const res: any = await withTimeout(mod.User.getAnonymousKey());
      if (res?.hash) return String(res.hash);
    } catch { /* 미지원 앱 버전 등 */ }
    return undefined; // 신 API 가 있는 SDK 면 구 API 재시도로 대기를 늘리지 않는다
  }
  try {
    if (typeof mod?.getAnonymousKey === 'function') {
      const res: any = await withTimeout(mod.getAnonymousKey());
      if (res && typeof res === 'object' && res.hash) return String(res.hash);
    }
  } catch { /* noop */ }
  return undefined;
}

/** 이번 부팅에서 잔액이 미러로 seed 됐는가 — IAP 복구의 로컬 이중가산 방지용 */
export function wasBalanceSeededFromMirror(): boolean {
  return seededThisBoot;
}

/** 복원 안내 플래그 소비 (토스트 1회 노출용) — 없으면 0 */
export function consumePassportRecoveredNotice(): number {
  try {
    const v = Number(localStorage.getItem(NOTICE_KEY) || 0);
    if (v > 0) localStorage.removeItem(NOTICE_KEY);
    return v;
  } catch {
    return 0;
  }
}
