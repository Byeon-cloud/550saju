/**
 * compatRecents — 궁합 최근 상대방 저장소 (P2-3)
 *
 * 근거:
 *   - `docs/prd/P2_Path_E_티켓_트래커.md` P2-3
 *   - 인수인계 §7.P2-3 "궁합 상대방 정보 매번 입력. 재활용 안 됨."
 *
 * Phase 1 (클라이언트 only · localStorage):
 *   - CompatibilityPage 하단 "이 사람 저장" 별도 체크박스 생략.
 *     이유: 상대방 입력 시 `saveProfileDirect` 가 이미 profiles 배열에 자동 저장.
 *     UX 병목은 "재활용 안 됨" 이므로 → **최근 3명 quick-pick** 으로 해결.
 *   - handleSubmit 시 person2.id 를 recents 에 push (MRU · 최대 3)
 *   - picker slot=2 진입 시 recents 를 상단 chips 로 노출 → 탭 한번에 선택
 *
 * Phase 2 (서버 이관 · TODO):
 *   - Firestore `users/{uid}/partners/{pid}` 컬렉션 (인수인계 §7.P2-3 §2)
 *   - 멀티 디바이스 동기화 + Relationship 태그 (연인/썸/이별 등)
 */

const KEY = 'saju500:compat_recents:v1';
const MAX_RECENTS = 3;

interface RecentsData {
  schemaVersion: 1;
  partnerIds: string[]; // MRU: 앞쪽이 가장 최근
}

function readRaw(): RecentsData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { schemaVersion: 1, partnerIds: [] };
    const parsed = JSON.parse(raw) as RecentsData;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.partnerIds)) {
      return { schemaVersion: 1, partnerIds: [] };
    }
    return parsed;
  } catch {
    return { schemaVersion: 1, partnerIds: [] };
  }
}

function writeRaw(data: RecentsData): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* noop */
  }
}

/**
 * 최근 상대방 id 목록 (MRU · 최대 3).
 * @param validIds 현재 존재하는 프로필 id 집합. 넘기면 삭제된 프로필은 자동 필터링.
 */
export function getRecentPartnerIds(validIds?: Set<string>): string[] {
  const raw = readRaw();
  if (!validIds) return raw.partnerIds.slice(0, MAX_RECENTS);
  const filtered = raw.partnerIds.filter((id) => validIds.has(id));
  // 필터링으로 변화가 있으면 저장소 정리 (다음 조회 비용 절감)
  if (filtered.length !== raw.partnerIds.length) {
    writeRaw({ schemaVersion: 1, partnerIds: filtered });
  }
  return filtered.slice(0, MAX_RECENTS);
}

/**
 * 상대방을 최근 목록 상단에 추가. 이미 있으면 중복 제거 후 상단으로 이동.
 * @param partnerId 궁합 상대방 프로필 id (person2)
 */
export function addRecentPartner(partnerId: string): void {
  if (!partnerId) return;
  const raw = readRaw();
  const dedup = raw.partnerIds.filter((id) => id !== partnerId);
  const next = [partnerId, ...dedup].slice(0, MAX_RECENTS);
  writeRaw({ schemaVersion: 1, partnerIds: next });
}

/**
 * 특정 상대방을 최근 목록에서 제거 (프로필 삭제 시 호출 용도).
 */
export function removeRecentPartner(partnerId: string): void {
  const raw = readRaw();
  const next = raw.partnerIds.filter((id) => id !== partnerId);
  if (next.length !== raw.partnerIds.length) {
    writeRaw({ schemaVersion: 1, partnerIds: next });
  }
}
