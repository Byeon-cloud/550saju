// 🚨 2026-06-22 P0-4 — sessionStorage 라우팅 '폐기'.
//   구정책(2026-04-21): 이름·생년월일 등 개인정보 포함 키(reports/profiles/my_profile)를
//     sessionStorage 로 라우팅 → 브라우저/탭 닫으면 자동 삭제(휘발). "Firestore 가 진본" 전제였으나,
//     실제론 익명 유저 서버 백업이 안 돌아 그 전제가 깨져 있었고(useAuth P0-1 에서 수정),
//     결과적으로 sessionStorage 휘발이 "결제했는데 보관함 사라짐"의 직접 원인이 됨.
//   신정책: 영구보관 대상(reports/profiles/my_profile)은 'localStorage(캐시) + Firestore(진본 백업)'.
//     → 본 모듈의 sessionStorage 라우팅은 폐기하고, 과거 sessionStorage 에 갇힌 데이터는 흡수 회수한다.
//   안전성: setStorage/getStorage 는 코드베이스 호출처 0건(정의만 존재) → 라우팅 변경 영향 없음.

/** @deprecated 2026-06-22 — sessionStorage 라우팅 폐기. 항상 localStorage 사용. */
export const SENSITIVE_KEYS = [] as const;

/** 과거 sessionStorage 로 라우팅됐던 영구보관 키 (흡수 회수 대상). */
const LEGACY_SESSION_KEYS = [
  'saju500_reports',     // 리포트 전체 (보관함)
  'saju500_profiles',    // 프로필 배열
  'saju500_my_profile',  // 본인 프로필 ID
] as const;

export type SensitiveKey = (typeof LEGACY_SESSION_KEYS)[number];

/** JSON 포장 setItem — 항상 localStorage (영구보관). */
export function setStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/** JSON 복원 getItem. 없으면 null. */
export function getStorage<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 양쪽 스토리지에서 모두 삭제 (sessionStorage 잔존분까지 정리). */
export function removeStorage(key: string): void {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

/* ─── 마이그레이션 (2026-06-22 방향 반전) ───
 * 구버전은 localStorage→sessionStorage 로 '이동'시켜 보관함 휘발을 유발했다(폐기).
 * 신버전은 과거 sessionStorage 에 갇힌 영구보관 키를 localStorage 로 '흡수' 회수한다(1회).
 * localStorage 가 우선(이미 있으면 덮어쓰지 않음). 함수명은 호출부(main.tsx) 호환 위해 유지.
 */
const MIGRATION_FLAG = 'saju500_storage_migrated_v2';

export function migrateStorageV1(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  try {
    let recovered = 0;
    for (const key of LEGACY_SESSION_KEYS) {
      const fromSession = sessionStorage.getItem(key);
      if (fromSession && !localStorage.getItem(key)) {
        localStorage.setItem(key, fromSession); // 갇힌 데이터 회수
        recovered++;
      }
      if (fromSession) sessionStorage.removeItem(key); // 휘발 경로 정리
    }
    localStorage.setItem(MIGRATION_FLAG, 'true');
    if (recovered > 0) {
      console.info(`[storage] v2 흡수: ${recovered} key(s) session→local 회수`);
    }
  } catch {
    // private mode 등 storage 불가 환경 — 조용히 무시
  }
}
