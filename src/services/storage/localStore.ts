/**
 * 로컬 스토리지 기반 데이터 저장
 *
 * 운(運) 잔액 구조:
 * - paid: 결제로 충전한 운 (환불 가능)
 * - bonus: 충전 보너스 운 (환불 불가)
 * - reward: 공유/이벤트 리워드 운 (환불 불가)
 *
 * 사용 순서: reward → bonus → paid (유저에게 유리하게)
 * 환불 시: paid만 환불 대상
 *
 * ⚠ 2026-04-22 storage 통일:
 *   REPORTS / PROFILES / MY_PROFILE 모두 localStorage 사용 (이전엔 sessionStorage 였음).
 *   탭/창 닫혀도 데이터 유지. "보관함 빈 채로 보이던 버그" 해소.
 *   기존 sessionStorage 잔류 데이터는 첫 호출 시 1회 자동 마이그레이션 후 삭제.
 */

import type { SajuData, SajuInput, Situation } from '@/types/saju';
import { calculateSaju, CALC_STANDARD_VERSION } from '@/services/saju/calculator';
import { refreshCurrentDaeun } from '@/services/saju/daeunCurrent';
import { stripDotsDeep } from '@/utils/noDot';

export type ContentType = 'report' | 'daily' | 'dream' | 'deepDream' | 'daeun' | 'monthly' | 'weekly' | 'compat' | 'tojung' | 'topic';

export interface LocalReport {
  id: string;
  name: string;
  input: SajuInput;
  sajuData: SajuData;
  situation?: Situation;
  createdAt: string | number;
  /** 'free' = 무료 사주팔자, 'paid' = 상세 분석(1운) */
  type?: 'free' | 'paid';
  /** 콘텐츠 분류 */
  contentType?: ContentType;
  /** AI 결과 원문 (ResultPage 등에서 사용) */
  aiResult?: any;
  /** 토픽 결과의 대상 프로필 ID — 보관함 삭제 시 topic_<id>_<profileId> 캐시 동반 제거용 (2026-06-17) */
  profileId?: string;
  /**
   * 종합 사주 schema 버전 — claudePremium.ts 의 응답 구조 변경 추적용.
   *  v1: 기존 (sections, summary, sectionConclusions[] 배열)
   *  v2: 2026-04 신규 8 필드 (lifeEdge, sipCluster, shinsalCards, rel6Cards,
   *      actionList, monthlyInsight, sectionConclusions{} 객체, topicMini)
   * 표식만 — 자동 재호출은 안 함. UI 에서 "새 풀이 받기" 안내용.
   */
  schemaVersion?: 'v1' | 'v2';
  /** 이 기록을 만들 때 실제로 낸 운 (2026-10-15~). 보관함 'N운 사용' 표시는 이 값이 있으면 이 값,
   *  없는 옛 기록은 지금 가격(pricing.ts)으로 보여 준다. 무료로 본 기록은 0 또는 비움. */
  spentUn?: number;
}

/** 사주 프로필 — 리포트와 독립적으로 저장 (삭제해도 프로필 유지) */
export interface SajuProfile {
  id: string;
  name: string;
  input: SajuInput;
  sajuData: SajuData;
  relation?: string;
  createdAt: string | number;
}

/** 운 잔액 유형별 구조 */
export interface BalanceDetail {
  paid: number;    // 결제 운 (환불 가능)
  bonus: number;   // 보너스 운 (환불 불가)
  reward: number;  // 리워드 운 (환불 불가, 공유/이벤트)
}

const REPORTS_KEY = 'saju500_reports';
const BALANCE_KEY = 'saju500_balance_v2';
const BALANCE_LEGACY_KEY = 'saju500_balance';
const MY_PROFILE_KEY = 'saju500_my_profile';
const PROFILES_KEY = 'saju500_profiles';

// ─── 1회 sessionStorage → localStorage 마이그레이션 ───
// 2026-04-22 이전 버전 사용자 데이터 보존. 모듈 로드 시 1회 실행.
let _migrated = false;
function migrateSessionToLocal(): void {
  if (_migrated) return;
  _migrated = true;
  if (typeof window === 'undefined') return;
  try {
    const keys = [REPORTS_KEY, MY_PROFILE_KEY, PROFILES_KEY];
    for (const k of keys) {
      const fromSession = sessionStorage.getItem(k);
      if (fromSession && !localStorage.getItem(k)) {
        localStorage.setItem(k, fromSession);
      }
      if (fromSession) sessionStorage.removeItem(k);
    }
  } catch {
    // private mode 등 storage 불가 환경 — 조용히 무시
  }
}
migrateSessionToLocal();

// ─── 프로필 변경 알림 (2026-10-14) ───
//   홈은 본인 사주를 화면이 열릴 때 한 번만 읽었다. 기기 여권과 서버 미러 복원이 부팅 뒤에 프로필을 채워도
//   홈이 그대로 '내 사주 넣기'에 머물렀다(오너 제보: 기존 유저에게도 사주 입력 안내). 쓰기마다 알린다.
export const PROFILES_CHANGED_EVENT = 'saju500:profiles-changed';
let profilesEventQueued = false;
function emitProfilesChanged(): void {
  if (typeof window === 'undefined' || profilesEventQueued) return;
  profilesEventQueued = true;
  queueMicrotask(() => {
    profilesEventQueued = false;
    try { window.dispatchEvent(new Event(PROFILES_CHANGED_EVENT)); } catch { /* noop */ }
  });
}

// ─── 리포트 ───

export function saveReport(report: LocalReport): void {
  // 🚨 P0-2 (2026-06-22) — 결과(aiResult 보유)는 'localStorage 저장보다 먼저' 서버에 단건 백업.
  //   localStorage quota 초과로 아래 저장이 실패해도 서버엔 진본이 남아 restoreLibrary 로 복원 가능.
  //   익명 uid 포함 fire-and-forget (firestore.rules 가 본인 reports write 허용). 호출부 9곳 무수정.
  if (report.aiResult) {
    import('./firestoreSync').then((m) => m.backupReport(report)).catch(() => { /* 무해 */ });
  }
  const reports = getReports();
  // 2026-05-27 fix — 동일 id 중복 저장 버그 (꿈해몽 free → paid 잠금해제 시
  //   free 레코드 + paid 레코드 2개 생성됨). 동일 id 있으면 제거 후 prepend
  //   → "create or update" 표준 시맨틱. 보관함 중복 표시 방지.
  const dupIdx = reports.findIndex((r) => r.id === report.id);
  if (dupIdx >= 0) reports.splice(dupIdx, 1);
  reports.unshift(report);
  if (reports.length > 500) reports.pop(); // 유료 리포트 영구 보관 (localStorage ~2.5MB)
  emitProfilesChanged(); // 본인 사주는 리포트에서도 찾는다 (저장 실패 분기도 아래에서 같은 목록을 다시 쓴다)
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch (e) {
    // 2026-05-29 — 용량초과(QuotaExceededError) 가드. 무가드 시 "돈 내고 결과 유실" 발생.
    //   전략: 방금 저장할 report 는 무조건 보존 + 무료/에페메럴(daily·dream) 오래된 것부터 제거 → 재시도.
    //   2026-09-18 — daily·dream 에도 결제분(1운 오늘의 운세 · 잠금해제 꿈해몽)이 생김 → 결제분은 에페메럴 취급 X,
    //   무료 기록을 모두 비운 뒤에만 최후수단으로 제거 (서버 단건 백업은 위에서 이미 발사됨).
    const EPHEMERAL = new Set(['daily', 'dream']);
    const isPaidRecord = (r: LocalReport) => r.type === 'paid' || !!r.aiResult?.__unlocked;
    let working = reports.slice();
    for (let attempt = 0; attempt < 8; attempt++) {
      // 1순위: 무료 에페메럴(현재 report·결제분 제외) 가장 오래된 것
      // 2순위: 그 밖의 무료 기록 가장 오래된 것
      // 최후수단: 가장 오래된 비-현재 레코드 (기존 동작 — 새 결과 저장 자체가 실패하는 것보다 나음)
      const evictIdx = (() => {
        for (let i = working.length - 1; i > 0; i--) {
          if (working[i].id !== report.id && EPHEMERAL.has(working[i].contentType ?? '') && !isPaidRecord(working[i])) return i;
        }
        for (let i = working.length - 1; i > 0; i--) {
          if (working[i].id !== report.id && !isPaidRecord(working[i])) return i;
        }
        for (let i = working.length - 1; i > 0; i--) {
          if (working[i].id !== report.id) return i;
        }
        return -1;
      })();
      if (evictIdx === -1) break;
      working.splice(evictIdx, 1);
      try {
        localStorage.setItem(REPORTS_KEY, JSON.stringify(working));
        return; // 성공
      } catch { /* 계속 제거 */ }
    }
    throw e; // 끝내 실패 → 호출부가 사용자에게 경고 (결과는 화면엔 떠 있음)
  }
}

export function getReports(): LocalReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getReport(id: string): LocalReport | null {
  const found = getReports().find(r => r.id === id) || null;
  // 2026-07 fix — 저장 리포트의 stale 현재대운 재계산 (대운 타임라인 등 시각화용. AI 본문은 불변)
  if (found?.sajuData) refreshCurrentDaeun(found.sajuData as SajuData);
  // 2026-10-11 — 예전 풀이의 가운뎃점은 보여 줄 사본에서만 뺀다 (보관함 원본 불변)
  return found?.aiResult ? { ...found, aiResult: stripDotsDeep(found.aiResult, found.name) } : found;
}

/**
 * 리포트(이용기록) 삭제 — 프로필(사주정보)과 독립.
 * ⚠ NO-CASCADE: 같은 사람의 프로필은 절대 함께 삭제하지 않는다.
 *   (정책: project_storage_data_model.md — "사주 정보 vs 이용기록 별도 테이블. cascade delete 금지")
 *   유저가 분석 1회를 지워도 본인 사주 자체는 마이/홈에 그대로 유지되어야 한다.
 */
export function deleteReport(id: string): void {
  const all = getReports();
  const target = all.find(r => r.id === id);
  const reports = all.filter(r => r.id !== id);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));

  // 2026-10-03 — 지운 결과가 다음 실행에 되살아나던 버그(로컬만 삭제 → 부팅 동기화가 서버 사본을 다시 내려받음).
  //   삭제 기록을 남기고 서버 사본(쌍둥이 사본 포함)도 지운다. 개인정보처리방침 '기록 삭제 시 함께 제거'와 정합.
  pushTombstone(DELETED_REPORTS_KEY, id);
  if (target) {
    import('./firestoreSync').then((m) => m.deleteReportRemote(target)).catch(() => { /* 다음 삭제·동기화에서 재시도 불가 — 로컬 기록이 재다운로드를 막는다 */ });
  }

  // 2026-06-17 — 토픽 결과 삭제 시 topic_<topicId>_<profileId>[_partner] 결과 캐시도 동반 제거.
  //   (기존: deleteReport 가 보관함 list 만 지워 캐시가 남음 → 재방문 시 구매 없이 옛 결과 노출 = 매출 누수 + 깨진 캐시 고착)
  const topicId: string | undefined = (target as any)?.aiResult?.topicId;
  if (target?.contentType === 'topic' && topicId) {
    // profileId: 신규 리포트는 저장됨 / 구버전은 이름+생일로 프로필 역추적
    let profileId: string | undefined = target.profileId;
    if (!profileId) {
      const prof = getProfiles().find(p =>
        p.name === target.name &&
        (p.input as any)?.birthYear === (target.input as any)?.birthYear &&
        (p.input as any)?.birthMonth === (target.input as any)?.birthMonth &&
        (p.input as any)?.birthDay === (target.input as any)?.birthDay,
      );
      profileId = prof?.id;
    }
    if (profileId) {
      const exact = `topic_${topicId}_${profileId}`;
      for (const store of [localStorage, sessionStorage]) {
        try {
          const doomed: string[] = [];
          for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (!k) continue;
            // 솔로(정확히 일치) + 파트너 변형(_파트너명 suffix) 둘 다 제거
            if (k === exact || k.startsWith(`${exact}_`)) doomed.push(k);
          }
          doomed.forEach(k => store.removeItem(k));
        } catch { /* noop */ }
      }
    }
  }
}

/**
 * 캐시된 분석 결과 조회 — 같은 사람 + 같은 콘텐츠 타입이면 기존 결과 반환
 * 사주는 확정된 데이터이므로 같은 사람에 대한 분석은 항상 같은 결과여야 함
 */
export function getCachedResult(name: string, birthYear: number, birthMonth: number, birthDay: number, contentType: ContentType): LocalReport | null {
  const reports = getReports();
  return reports.find(r =>
    r.contentType === contentType &&
    r.aiResult && // AI 결과가 저장된 것만
    r.name === name &&
    r.input?.birthYear === birthYear &&
    r.input?.birthMonth === birthMonth &&
    r.input?.birthDay === birthDay
  ) || null;
}

// ─── 내 프로필 (본인 사주 고정) ───

/** 본인 프로필 조회 — pinned ID 우선, 없으면 relation '본인' 자동 탐색+고정 */
export function getMyProfile(): LocalReport | null {
  const myId = localStorage.getItem(MY_PROFILE_KEY);
  if (myId) {
    const report = getReport(myId);
    if (report) return report;
    // 2026-10-07 — 사주 등록은 05-07 부터 '프로필만' 저장이라 본인 id 가 리포트에 없다 → 프로필에서 찾는다.
    //   기존엔 여기서 null → 호출부가 '가장 최근 프로필'로 폴백해, 친구·상대 사주를 추가한 유저에게
    //   홈 인사·오늘의 한 줄·궁합 '나' 칸이 상대방으로 바뀌어 나갔다 (10-07 궁합 공개 QA 에서 발견).
    try {
      const prof = getProfiles().find((p) => p.id === myId);
      if (prof) return prof as unknown as LocalReport;
    } catch { /* noop */ }
  }
  // 본인(relation '본인') 프로필 우선
  const owner = findExistingOwnerProfile();
  if (owner) {
    localStorage.setItem(MY_PROFILE_KEY, owner.id);
    return owner as unknown as LocalReport;
  }
  // fallback: relation이 '본인'이거나 미지정인 첫 번째 리포트
  const reports = getReports();
  const found = reports.find(r =>
    !r.input?.relation || r.input.relation === '본인' || r.input.relation === 'self'
  ) || null;
  if (found) localStorage.setItem(MY_PROFILE_KEY, found.id);
  return found;
}

/** 본인 프로필 고정.
 *  2026-05-28 PM — uniqueness 강제: 다른 본인 프로필이 있으면 자동 '가족' 강등.
 *  (silent demotion 은 강제 정합성 회복용 — 명시적 confirm modal 통과 후 호출되는 가정) */
export function setMyProfile(reportId: string): void {
  localStorage.setItem(MY_PROFILE_KEY, reportId);
  emitProfilesChanged();
  // 다른 '본인' 프로필 자동 강등 — uniqueness 강제
  try {
    const reports = getReports();
    let changed = false;
    for (const r of reports) {
      if (r.id !== reportId && r.input?.relation === '본인') {
        r.input.relation = '가족';
        changed = true;
      }
    }
    if (changed) localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));

    // saveProfileDirect 가 별도로 관리하는 profiles 도 동기화
    const profiles = getProfiles();
    let pChanged = false;
    for (const p of profiles) {
      if (p.id !== reportId && p.relation === '본인') {
        p.relation = '가족';
        pChanged = true;
      }
    }
    if (pChanged) writeProfiles(profiles);
  } catch { /* noop */ }
}

/** 본인 사주가 이미 있는지 확인. relation === '본인' 인 첫 번째 프로필 반환. */
export function findExistingOwnerProfile(): SajuProfile | null {
  try {
    const profiles = getProfiles();
    return profiles.find(p => p.relation === '본인') || null;
  } catch { return null; }
}

/** 특정 프로필의 relation 만 변경 (본인 → 가족 강등 등). 리포트도 동기화. */
export function updateProfileRelation(profileId: string, newRelation: string): void {
  try {
    const profiles = getProfiles();
    const target = profiles.find(p => p.id === profileId);
    if (target) {
      target.relation = newRelation as any;
      writeProfiles(profiles);
    }
    // 같은 ID 의 리포트도 동기화
    const reports = getReports();
    const r = reports.find(x => x.id === profileId);
    if (r?.input) {
      r.input.relation = newRelation as any;
      localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    }
  } catch { /* noop */ }
}

/** 본인 중복 마이그레이션 (앱 시작 시 1회 실행).
 *  본인 라벨 N명 → 활성 myProfile 만 본인 유지, 나머지는 '가족' 으로 강등.
 *  2026-05-28 PM — 출시 전 cleanup. */
/**
 * 보관함 twin 잉여 1회 정리 (2026-08-13 · restoreLibrary 이중저장 버그의 기존 피해 청소)
 *   같은 리포트가 base36(클라 정본) + auto-id(복원 사본) 두 건으로 저장된 유저가 74명 실측.
 *   판정: contentType·type 동일 + 생성시각 120초 이내 + auto-id 형식 → auto-id 쪽 제거.
 *   서버 원본은 건드리지 않는다(다운로드 차단은 syncFromCloud 지문 필터가 담당).
 */
export function dedupeTwinReports(): { removed: number } {
  const DONE_KEY = 'saju500:twin_dedup_v1';
  try {
    if (localStorage.getItem(DONE_KEY)) return { removed: 0 };
    const reports = getReports();
    const isAuto = (id: string) => /^[A-Za-z0-9]{20}$/.test(id);
    const isB36 = (id: string) => /^m[a-z0-9]{9,16}$/.test(id);
    const ts = (r: LocalReport) => new Date(r.createdAt).getTime() || 0;
    const lenOf = (r: LocalReport) => { try { return JSON.stringify(r.aiResult ?? '').length; } catch { return 0; } };
    const b36s = reports.filter((r) => isB36(r.id));
    const removeIds = new Set<string>();
    for (const cand of reports.filter((r) => isAuto(r.id))) {
      const cl = lenOf(cand);
      const twin = b36s.find((b) => {
        if ((b.contentType ?? 'report') !== (cand.contentType ?? 'report')) return false;
        if ((b.type ?? 'paid') !== (cand.type ?? 'paid')) return false;
        if (Math.abs(ts(b) - ts(cand)) > 120_000) return false;
        // 내용 크기 10% 이내 — 같은 분 '다른' 리포트(내용 상이 → 크기 상이) 오탐 방지
        const bl = lenOf(b);
        if (cl > 0 && bl > 0 && Math.abs(bl - cl) / Math.max(bl, cl) > 0.10) return false;
        return true;
      });
      if (twin) removeIds.add(cand.id);
    }
    if (removeIds.size > 0) {
      const kept = reports.filter((r) => !removeIds.has(r.id));
      localStorage.setItem(REPORTS_KEY, JSON.stringify(kept));
    }
    localStorage.setItem(DONE_KEY, '1');
    return { removed: removeIds.size };
  } catch { return { removed: 0 }; }
}

export function migrateOwnerDuplicates(): { migrated: number } {
  try {
    const myId = localStorage.getItem(MY_PROFILE_KEY);
    const profiles = getProfiles();
    const owners = profiles.filter(p => p.relation === '본인');
    if (owners.length <= 1) return { migrated: 0 };
    // myId 우선, 없으면 가장 최근(profiles[0]) 만 본인
    const keepId = myId && owners.some(p => p.id === myId) ? myId : owners[0].id;
    let migrated = 0;
    for (const p of profiles) {
      if (p.id !== keepId && p.relation === '본인') {
        p.relation = '가족' as any;
        migrated++;
      }
    }
    writeProfiles(profiles);
    // 리포트도 동기화
    const reports = getReports();
    for (const r of reports) {
      if (r.id !== keepId && r.input?.relation === '본인') {
        r.input.relation = '가족' as any;
      }
    }
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    return { migrated };
  } catch { return { migrated: 0 }; }
}

// ─── 잔액 (유형별) ───

/**
 * 부팅 시 잔액 키 부재 여부 (2026-08-13 · 기기 여권 잔액 복원용)
 *   getBalanceDetail 의 레거시 폴백이 키를 즉시 만들어버려, "저장소가 비워진 직후" 신호가
 *   소실된다. 모듈 첫 로드 시점에 미리 기록해 여권 seed 의 판단 근거로 쓴다.
 *   (키 부재 = 새 기기 또는 저장소 초기화 — 이때만 서버 미러로 1회 seed 허용)
 */
const BALANCE_KEY_ABSENT_AT_BOOT = (() => {
  try { return !localStorage.getItem('saju500_balance_v2'); } catch { return false; }
})();
export function wasBalanceKeyAbsentAtBoot(): boolean {
  return BALANCE_KEY_ABSENT_AT_BOOT;
}

/**
 * 잔액 미러 push (디바운스 2s · fire-and-forget)
 *   운 잔액은 localStorage 단일 진본이라 저장소가 비워지면 리워드로 모은 운까지 영구 소실됐다.
 *   모든 잔액 변경을 users/{uid}/state/balance 에 스냅샷으로 미러링 → 기기 여권이 uid 회전 시
 *   이 미러를 새 uid 로 복사, 클라가 키 부재일 때 1회 seed 한다. (rules: state 서브컬렉션 owner 허용)
 *   실패는 무해 — 다음 변경에서 재시도된다.
 */
let mirrorTimer: ReturnType<typeof setTimeout> | null = null;
// 🚨 2026-10-03 경합 fix — 저장소가 빈 부팅(키 부재)에서 첫 화면이 만든 기본 잔액(1운)을 서버에 먼저 올리면,
//   기기 여권이 옛 계정 잔액을 복사하지 못하고 그 기본값을 '복원'했다. 여권이 끝날 때까지 push 를 보류한다.
let mirrorHeld = BALANCE_KEY_ABSENT_AT_BOOT;
let heldDetail: BalanceDetail | null = null;
if (mirrorHeld) setTimeout(() => releaseBalanceMirror(), 45000); // 안전장치 — 여권이 안 돌아도(웹 등) 45초 뒤 해제
/** 기기 여권 종료 시 호출 — 보류한 잔액 미러를 (현재 값으로) 올린다 */
export function releaseBalanceMirror(): void {
  if (!mirrorHeld) return;
  mirrorHeld = false;
  if (heldDetail) { const d = getBalanceDetail(); heldDetail = null; pushBalanceMirrorDebounced(d); }
}
function pushBalanceMirrorDebounced(detail: BalanceDetail): void {
  if (mirrorHeld) { heldDetail = detail; return; }
  if (mirrorTimer) clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => {
    mirrorTimer = null;
    import('./firestoreSync').then((m) => m.pushBalanceMirror(detail)).catch(() => { /* noop */ });
  }, 2000);
}

/**
 * 서버 미러 값으로 잔액 1회 seed (기기 여권 전용)
 *   가드: ① 부팅 시 키가 없었을 때만 ② 현재 잔액이 레거시 시드(paid≤1·bonus0·reward0) 수준일 때만
 *   ③ 미러 합계 상한(어뷰징 방어). 성공 시 true — 호출측이 IAP 복구의 로컬 이중가산을 막는 데 쓴다.
 */
export function seedBalanceFromMirror(mirror: { paid?: number; bonus?: number; reward?: number }): boolean {
  try {
    // 🚨 가드 핵심 = '현재 잔액이 무의미할 때만' + 상한. (BALANCE_KEY_ABSENT_AT_BOOT 을 하드 요건으로
    //   두면 재시도 부팅에선 이미 키가 생겨 영영 seed 불가 → 재시도가 막힌다. 트리거 자체가
    //   서버 회전 판정에 게이트돼 있고, 아래 무의미-잔액 가드로 정상 유저 덮어쓰기를 막으므로 안전.)
    const cur = getBalanceDetail();
    if ((cur.paid ?? 0) > 1 || (cur.bonus ?? 0) > 0 || (cur.reward ?? 0) > 0) return false; // 이미 의미있는 잔액
    const p = Math.max(0, Number(mirror.paid) || 0);
    const b = Math.max(0, Number(mirror.bonus) || 0);
    const r = Math.max(0, Number(mirror.reward) || 0);
    if (p + b + r <= 0) return false;
    if (p + b + r > 300) return false; // 비정상 미러 — seed 거부 (수동 CS 로)
    setBalanceDetail({ paid: p, bonus: b, reward: r });
    return true;
  } catch { return false; }
}

function getBalanceDetail(): BalanceDetail {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    if (raw) return JSON.parse(raw);

    // 레거시 마이그레이션: 기존 단일 잔액 → paid로 이전
    const legacy = Number(localStorage.getItem(BALANCE_LEGACY_KEY)) || 1;
    const detail: BalanceDetail = { paid: legacy, bonus: 0, reward: 0 };
    setBalanceDetail(detail);
    localStorage.removeItem(BALANCE_LEGACY_KEY);
    return detail;
  } catch {
    return { paid: 1, bonus: 0, reward: 0 };
  }
}

function setBalanceDetail(detail: BalanceDetail): void {
  localStorage.setItem(BALANCE_KEY, JSON.stringify(detail));
  // 잔액 미러 — 모든 변경을 서버 스냅샷으로 (2026-08-13 기기 여권 · 소실 복원용)
  pushBalanceMirrorDebounced(detail);
}

/** 총 잔액 (모든 유형 합산) */
export function getBalance(): number {
  const d = getBalanceDetail();
  return Math.round((d.paid + d.bonus + d.reward) * 10) / 10;
}

/** 유형별 잔액 조회 */
export function getBalanceBreakdown(): BalanceDetail {
  return getBalanceDetail();
}

/** 환불 가능한 금액 (paid만) */
export function getRefundableBalance(): number {
  return getBalanceDetail().paid;
}

/**
 * 운 충전 (결제)
 * @param paidUn 결제 운
 * @param bonusUn 보너스 운
 */
export function addPaidBalance(paidUn: number, bonusUn: number): void {
  const d = getBalanceDetail();
  d.paid += paidUn;
  d.bonus += bonusUn;
  setBalanceDetail(d);
}

/** 리워드 운 적립 (공유/이벤트) */
export function addRewardBalance(amount: number): void {
  const d = getBalanceDetail();
  d.reward = Math.round((d.reward + amount) * 10) / 10;
  setBalanceDetail(d);
}

/**
 * 운 사용 (서비스 이용)
 * 사용 순서: reward → bonus → paid (유저에게 유리)
 * 모든 유형의 운을 자유롭게 사용 가능 (프리미엄 포함)
 *
 * @returns 사용 성공 여부
 */
export function spendBalance(amount: number): boolean {
  const d = getBalanceDetail();
  const total = d.paid + d.bonus + d.reward;
  if (total < amount) return false;

  let remaining = amount;

  // 1. reward 먼저
  const fromReward = Math.min(d.reward, remaining);
  d.reward = Math.round((d.reward - fromReward) * 10) / 10;
  remaining -= fromReward;

  // 2. bonus
  if (remaining > 0) {
    const fromBonus = Math.min(d.bonus, remaining);
    d.bonus = Math.round((d.bonus - fromBonus) * 10) / 10;
    remaining -= fromBonus;
  }

  // 3. paid
  if (remaining > 0) {
    d.paid = Math.round((d.paid - remaining) * 10) / 10;
  }

  setBalanceDetail(d);
  return true;
}

/**
 * 실패 환불 — 차감했던 운을 paid 로 '되돌려준다' (AI 생성 실패 등 우리 책임).
 *
 * 🚨 2026-06-22 CRITICAL money fix
 *   기존 구현이 환불인데 paid 에서 '빼고' 있었음(`d.paid - refundable`). 게다가 결제 직후엔
 *   spendBalance 로 paid 가 이미 0이라 `min(0, n)=0` → 환불 0운인데 호출부는 "n운 돌려드렸어요"
 *   안내 → 유저는 운 잃고 메시지만 받음. 전 호출처(ResultPage·Topic·Tojung·Monthly·Daeun·
 *   Compat·Loading)가 전부 '돌려주기' 의미라 subtract 로 쓰는 정당한 곳 0건 → 더하기로 교정.
 *   서버 refundBalance(balance.paid +increment) 와도 정합 → 동일기기 syncFromCloud 는
 *   cloud==local 이라 no-op (이중환불 없음).
 * @returns 실제 돌려준 운
 */
export function refundBalance(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const d = getBalanceDetail();
  d.paid = Math.round((d.paid + amount) * 10) / 10;
  setBalanceDetail(d);
  return amount;
}

/**
 * 결제 취소로 지급했던 운 회수 (2026-10-16 — 포트원 취소 → 서버 balanceAdjustments → balanceAdjust.ts 가 호출).
 *   결제분은 paid 에서, 보너스는 bonus 에서 빼고, 그 칸이 모자라면 나머지 칸(reward 포함)에서 뺀다. 0 아래로는 내리지 않는다.
 * @returns 실제로 뺀 운
 */
export function reclaimBalance(paidUn: number, bonusUn: number): number {
  const d = getBalanceDetail();
  const r1 = (n: number) => Math.round(n * 10) / 10;
  let short = 0;
  const takeP = Math.min(d.paid, Math.max(0, paidUn)); d.paid = r1(d.paid - takeP); short += Math.max(0, paidUn) - takeP;
  const takeB = Math.min(d.bonus, Math.max(0, bonusUn)); d.bonus = r1(d.bonus - takeB); short += Math.max(0, bonusUn) - takeB;
  let taken = takeP + takeB;
  for (const k of ['bonus', 'paid', 'reward'] as const) {
    if (short <= 0) break;
    const t = Math.min(d[k], short); d[k] = r1(d[k] - t); short -= t; taken += t;
  }
  setBalanceDetail(d);
  return r1(taken);
}

/** 단순 잔액 설정 (레거시 호환, paid로 설정) */
export function setBalance(balance: number): void {
  const d = getBalanceDetail();
  d.paid = balance;
  setBalanceDetail(d);
}

// ─── 유틸 ───

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── 프로필 (리포트와 독립) ───

/** 저장된 프로필 목록 조회 — 없으면 기존 리포트에서 마이그레이션 */
export function getProfiles(): SajuProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const profiles: SajuProfile[] = JSON.parse(raw);
      // 🚨 2026-07-14 계산 기준 버전 마이그레이션 (구 '용신 게이트 + 간지 보호' 대체 — 준기 기준 v2 결정)
      //   저장된 sajuData.calcVersion 이 현행 CALC_STANDARD_VERSION 과 다르면 stale 캐시 → 무조건 재계산·덮어쓰기.
      //   구 가드("간지 1글자라도 다르면 보존")는 '의도치 않은 calculator 드리프트' 방어용이었는데,
      //   기준을 의도적으로 바꾼 지금은 정반대로 작동한다 — 바로잡혀야 할 프로필(자시·:30 경계·87/88 서머타임)
      //   일수록 옛 틀린 간지를 영구 보존해버림. 의도된 기준 변경은 버전 스탬프로 구분한다:
      //   · calcVersion 일치 = 현행 기준 계산본 → 유지
      //   · calcVersion 불일치/부재 = 옛 기준 → fresh 로 교체 (일주·시주가 달라져도 그게 정정임)
      //   향후 산출 규칙 변경 시 CALC_STANDARD_VERSION +1 만 하면 전 프로필 자동 정정.
      let migrated = false;
      for (const p of profiles) {
        if (p?.input?.birthYear && (p.sajuData as any)?.calcVersion !== CALC_STANDARD_VERSION) {
          try {
            const oldVer = Number((p.sajuData as any)?.calcVersion) || 0;
            const fresh = calculateSaju(p.input);
            if (fresh?.pillars?.length) {
              p.sajuData = fresh; migrated = true;
              // 2026-10-15 v4 — 음력 생일을 양력으로 잘못 계산하던 사주가 바뀐 사람에게 홈에서 한 번 알린다
              if (oldVer < 4 && String(p.input.calendarType || '').startsWith('lunar')) {
                try { localStorage.setItem('saju500:lunar_fix_notice', p.name || '1'); } catch { /* noop */ }
              }
            }
          } catch { /* 재계산 실패 시 기존 sajuData 유지 (다음 로드에서 재시도) */ }
        }
      }
      if (migrated) {
        try { writeProfiles(profiles); } catch { /* noop */ }
      }
      // 2026-07 fix — 저장 시점의 stale 현재대운(isCurrent) 을 오늘 기준으로 재계산.
      //   해가 바뀌어 대운이 넘어가도 저장 플래그가 영구 신뢰되던 문제 차단 (in-memory only).
      for (const p of profiles) refreshCurrentDaeun(p?.sajuData as SajuData | undefined);
      return profiles;
    }
    // 마이그레이션: 기존 리포트에서 프로필 추출 (중복 제거)
    const reports = getReports();
    const seen = new Map<string, SajuProfile>();
    for (const r of reports) {
      if (!r.input?.birthYear || !r.name) continue;
      if (r.contentType === 'compat') continue;
      if (r.name?.includes('\u00d7') || r.name?.includes('x')) continue;
      const key = `${r.name}_${r.input.birthYear}_${r.input.birthMonth}_${r.input.birthDay}`;
      if (!seen.has(key)) {
        seen.set(key, {
          id: r.id,
          name: r.name,
          input: r.input,
          sajuData: r.sajuData,
          relation: r.input?.relation,
          createdAt: r.createdAt,
        });
      }
    }
    const profiles = Array.from(seen.values());
    if (profiles.length > 0) {
      writeProfiles(profiles);
    }
    return profiles;
  } catch { return []; }
}

/** 프로필 직접 저장 — 리포트 생성 없이 프로필만 저장/업데이트 */
export function saveProfileDirect(profile: SajuProfile): void {
  const profiles = getProfiles();
  const key = `${profile.name}_${profile.input.birthYear}_${profile.input.birthMonth}_${profile.input.birthDay}`;
  dropTombstone(DELETED_PROFILES_KEY, key); // 지웠던 인물을 다시 등록하면 삭제 기록 해제
  const idx = profiles.findIndex(p =>
    `${p.name}_${p.input.birthYear}_${p.input.birthMonth}_${p.input.birthDay}` === key
  );
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.unshift(profile);
  }
  writeProfiles(profiles);
}

/**
 * 프로필(사주정보) 삭제 — 이용기록과 독립.
 * ⚠ NO-CASCADE: 해당 인물의 과거 분석 리포트는 절대 함께 삭제하지 않는다.
 *   (정책: project_storage_data_model.md — "사주 정보 vs 이용기록 별도 테이블. cascade delete 금지")
 *   본인 프로필을 지우더라도 결제하여 받은 분석 결과는 보관함에 그대로 남는다.
 */
export function deleteProfile(profileId: string): void {
  const all = getProfiles();
  const target = all.find(p => p.id === profileId);
  // 삭제 기록 — 복원 병합(리포트·서버 미러)이 지운 인물을 되살리지 않도록 (2026-10-03)
  if (target) pushTombstone(DELETED_PROFILES_KEY, profileKey(target));
  writeProfiles(all.filter(p => p.id !== profileId));
}

/* 삭제 기록(tombstone) — 지운 결과·인물이 동기화/복원으로 되살아나지 않게 (2026-10-03) */
const DELETED_REPORTS_KEY = 'saju500_deleted_report_ids';
const DELETED_PROFILES_KEY = 'saju500_deleted_profile_keys';
const TOMBSTONE_CAP = 500;
function readTombstones(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
function pushTombstone(key: string, value: string): void {
  try {
    const list = readTombstones(key).filter((x) => x !== value);
    list.push(value);
    localStorage.setItem(key, JSON.stringify(list.slice(-TOMBSTONE_CAP)));
  } catch { /* noop */ }
}
function dropTombstone(key: string, value: string): void {
  try {
    const list = readTombstones(key);
    if (list.includes(value)) localStorage.setItem(key, JSON.stringify(list.filter((x) => x !== value)));
  } catch { /* noop */ }
}
export function getDeletedReportIds(): Set<string> { return new Set(readTombstones(DELETED_REPORTS_KEY)); }
export function getDeletedProfileKeys(): Set<string> { return new Set(readTombstones(DELETED_PROFILES_KEY)); }

/* ─────────────────────────────────────────────────────────────
 * 사주원국(프로필) 서버 미러 + 복원 병합 (2026-09-27)
 *   CS "사주원국 기록이 사라졌어요" — 프로필은 localStorage 에만 있어 저장소가 비면 복원 불가였다
 *   (리포트는 서버 백업이 있었지만 프로필은 0). 모든 프로필 쓰기에 서버 미러(state/profiles)를 동반하고,
 *   기기 여권이 옛 계정 미러를 합쳐주면 여기서 로컬로 병합한다. 병합은 '없는 것만 추가'.
 * ──────────────────────────────────────────────────────────── */
function profileKey(p: { name?: string; input?: Partial<SajuInput> | null }): string {
  return `${p.name}_${p.input?.birthYear}_${p.input?.birthMonth}_${p.input?.birthDay}`;
}

let profilesMirrorTimer: ReturnType<typeof setTimeout> | null = null;
function writeProfiles(profiles: SajuProfile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  emitProfilesChanged();
  if (profilesMirrorTimer) clearTimeout(profilesMirrorTimer);
  profilesMirrorTimer = setTimeout(() => {
    profilesMirrorTimer = null;
    import('./firestoreSync').then((m) => m.pushProfilesMirror(profiles)).catch(() => { /* noop */ });
  }, 2000);
}

/** 리포트에서 프로필 후보 추출 (getProfiles 초기 마이그레이션과 같은 규칙) */
export function profilesFromReports(reports: LocalReport[]): SajuProfile[] {
  const seen = new Map<string, SajuProfile>();
  for (const r of reports) {
    if (!r?.input?.birthYear || !r.name) continue;
    if (r.contentType === 'compat') continue;
    if (r.name.includes('×') || r.name.includes('x')) continue;
    const k = profileKey(r);
    if (!seen.has(k)) {
      seen.set(k, { id: r.id, name: r.name, input: r.input, sajuData: r.sajuData, relation: r.input?.relation, createdAt: r.createdAt });
    }
  }
  return Array.from(seen.values());
}

/** 복원 프로필 병합 — 이름+생년월일 기준으로 없는 것만 추가. 추가 수 반환. */
export function mergeProfiles(
  incoming: Array<{ id?: string; name?: string; input?: SajuInput | null; sajuData?: SajuData; relation?: string | null; createdAt?: string | number }>,
): number {
  try {
    const current = getProfiles();
    const keys = new Set(current.map(profileKey));
    const deleted = getDeletedProfileKeys(); // 유저가 지운 인물은 복원하지 않는다
    const hasSelf = current.some((p) => !p.relation || p.relation === '본인');
    let added = 0;
    for (const p of incoming || []) {
      if (!p?.name || !p.input?.birthYear) continue;
      const k = profileKey(p);
      if (keys.has(k) || deleted.has(k)) continue;
      let sajuData = p.sajuData;
      if (!sajuData?.pillars?.length || (sajuData as any)?.calcVersion !== CALC_STANDARD_VERSION) {
        try { sajuData = calculateSaju(p.input); } catch { /* 재계산 실패 시 원본 유지 */ }
      }
      if (!sajuData?.pillars?.length) continue;
      // '본인'은 1명만 (InputPage 정책) — 이미 본인이 있으면 복원분은 가족으로
      const rel = p.relation ?? p.input?.relation ?? undefined;
      const relation = rel === '본인' && hasSelf ? '가족' : rel;
      current.push({
        id: p.id || generateId(),
        name: p.name,
        input: relation && p.input.relation !== relation ? { ...p.input, relation } : p.input,
        sajuData,
        relation,
        createdAt: p.createdAt ?? new Date().toISOString(),
      });
      keys.add(k);
      added++;
    }
    if (added > 0) writeProfiles(current);
    return added;
  } catch {
    return 0;
  }
}

/* ─────────────────────────────────────────────────────────────
 * Pending Spend 장부 — 2026-06-11 P0 CS fix (권민주님 제보).
 * 문제: 운 차감 → AI 생성 중 앱 강제종료 → 결과 미저장인데 운만 소실.
 * 해결: 차감 직후 pending 마킹 → 결과 저장 성공 시 clear →
 *       재접속 시 5분 경과한 미완료 pending 발견하면 자동 환불 + 안내.
 * 환불은 paid 버킷(가장 유리)으로. localStorage 키: saju500:pending_spends
 * ──────────────────────────────────────────────────────────── */
const PENDING_SPENDS_KEY = 'saju500:pending_spends';
// 2026-10-04 5분 → 12분: 재회운은 생성 ~222초 + 마감 300초 + 서버 완성본 대기(최대 330초)라, 5분이면
//   아직 생성 중인 결제가 자동환불돼 '결과도 받고 환불도 받는' 누수가 생겼다. 실패 건 환불은 7분 늦어질 뿐.
export const PENDING_EXPIRE_MS = 12 * 60 * 1000;

interface PendingSpend { id: string; type: string; amount: number; ts: number; }

function readPendingSpends(): PendingSpend[] {
  try { return JSON.parse(localStorage.getItem(PENDING_SPENDS_KEY) || '[]'); } catch { return []; }
}
function writePendingSpends(list: PendingSpend[]): void {
  try { localStorage.setItem(PENDING_SPENDS_KEY, JSON.stringify(list)); } catch { /* noop */ }
}

/** 차감 직후 호출 — 생성 중 이탈 대비 마킹. 반환된 id 로 완료 시 clear. */
/** 미해결 pending 차감 목록 조회 (토픽 결과 복구 트리거 판단용 — 2026-06-17) */
export function getPendingSpends(): Array<{ id: string; type: string; amount: number; ts: number }> {
  return readPendingSpends();
}

export function markPendingSpend(type: string, amount: number): string {
  const id = `${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  const list = readPendingSpends();
  list.push({ id, type, amount, ts: Date.now() });
  writePendingSpends(list.slice(-20)); // 안전 상한
  return id;
}

/** 결과 저장 성공 시 호출 — 장부에서 제거. */
export function clearPendingSpend(id: string): void {
  writePendingSpends(readPendingSpends().filter(p => p.id !== id));
}

/**
 * 부팅 시 호출 — 만료된 pending(=생성 중 앱 종료로 결과 못 받은 차감)을 자동 환불.
 * 반환: 환불된 총 운 (0이면 없음 — 호출부에서 toast 안내).
 */
export function reconcilePendingSpends(): number {
  const list = readPendingSpends();
  if (list.length === 0) return 0;
  const now = Date.now();
  const expired = list.filter(p => now - p.ts > PENDING_EXPIRE_MS);
  if (expired.length === 0) return 0;
  const total = expired.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (total > 0) {
    addPaidBalance(total, 0); // 가장 유리한 paid 버킷으로 복구
    try {
      import('@/services/analytics').then(a =>
        a.trackEvent('reward_earned', { kind: 'auto_refund', amount: total })).catch(() => {});
    } catch { /* noop */ }
  }
  writePendingSpends(list.filter(p => now - p.ts <= PENDING_EXPIRE_MS));
  console.info(`[pendingSpend] 자동 환불: ${total}운 (${expired.length}건: 생성 중 이탈 복구)`);
  return total;
}

/**
 * CS 보상 동반 정리 (2026-06-11) — 잘못 생성된 주제 결과를 보관함·캐시에서 제거.
 * claimCompensation 의 wipeTopics 수령 시 호출 (예: ['love','marriage']).
 * 해당 topicId 의 보관함 리포트 + topic_{id}_* 캐시(local/session 양쪽) 삭제.
 */
export function removeTopicReports(topicIds: string[]): number {
  if (!Array.isArray(topicIds) || topicIds.length === 0) return 0;
  let removed = 0;
  try {
    const reports = getReports();
    const keep = reports.filter((r: any) => {
      const tid = r?.aiResult?.topicId;
      const isTarget = r?.contentType === 'topic' && tid && topicIds.includes(tid);
      if (isTarget) removed++;
      return !isTarget;
    });
    if (removed > 0) {
      localStorage.setItem(REPORTS_KEY, JSON.stringify(keep));
      try { sessionStorage.setItem(REPORTS_KEY, JSON.stringify(keep)); } catch { /* noop */ }
    }
  } catch { /* noop */ }
  // topic_{id}_* 결과 캐시 제거 (양쪽 스토리지)
  for (const store of [localStorage, sessionStorage]) {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i) || '';
        if (topicIds.some(t => k.startsWith(`topic_${t}_`))) doomed.push(k);
      }
      doomed.forEach(k => store.removeItem(k));
    } catch { /* noop */ }
  }
  console.info(`[removeTopicReports] ${topicIds.join(',')} 정리: 리포트 ${removed}건`);
  return removed;
}

/** type prefix 로 pending 일괄 해제 — cross-page 플로우(종합사주: 차감→로딩→결과)용 */
export function clearPendingSpendByType(typePrefix: string): void {
  writePendingSpends(readPendingSpends().filter(p => !p.type.startsWith(typePrefix)));
}
