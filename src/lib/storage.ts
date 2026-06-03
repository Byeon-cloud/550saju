// v4.1 · P0-1 민감 필드 sessionStorage 이주 (2026-04-21 D-1)
// 근거: PC_PASTE_BUNDLE_specs.md 결정 1 + audit_60 §4-06
// 정책: 이름·생년월일·시간 같은 개인정보는 세션 단위(sessionStorage)만 보관.
//       브라우저 종료 시 자동 삭제. Firestore가 진본 스토리지.

/** 민감 데이터 포함 키 — sessionStorage로 라우팅됨. */
export const SENSITIVE_KEYS = [
  'saju500_reports',     // 리포트 전체 (input.name·birthYear·Month·Day·Hour 포함)
  'saju500_profiles',    // 프로필 배열 (name·input 포함)
  'saju500_my_profile',  // 본인 프로필 ID (프로필 참조 링크라 민감)
] as const;

export type SensitiveKey = (typeof SENSITIVE_KEYS)[number];

function pickStore(key: string): Storage {
  return (SENSITIVE_KEYS as readonly string[]).includes(key) ? sessionStorage : localStorage;
}

/** JSON 포장 setItem. 민감 키면 sessionStorage, 나머지는 localStorage. */
export function setStorage<T>(key: string, value: T): void {
  pickStore(key).setItem(key, JSON.stringify(value));
}

/** JSON 복원 getItem. 없으면 null. */
export function getStorage<T>(key: string): T | null {
  const raw = pickStore(key).getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 양쪽 스토리지에서 모두 삭제 (잔존 데이터 정리). */
export function removeStorage(key: string): void {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

/* ─── v1 마이그레이션 ───
 * 기존 유저가 localStorage에 담아둔 민감 필드를 sessionStorage로 1회 옮김.
 * 옮긴 후 localStorage에서 삭제. 플래그로 2회 실행 방지.
 */
const MIGRATION_FLAG = 'saju500_storage_migrated_v1';

export function migrateStorageV1(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  let moved = 0;
  for (const key of SENSITIVE_KEYS) {
    const v = localStorage.getItem(key);
    if (v) {
      sessionStorage.setItem(key, v);
      localStorage.removeItem(key);
      moved++;
    }
  }
  localStorage.setItem(MIGRATION_FLAG, 'true');
  if (moved > 0) {
    console.info(`[storage] v1 migrated: ${moved} sensitive key(s) → sessionStorage`);
  }
}
