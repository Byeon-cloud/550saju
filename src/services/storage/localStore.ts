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

export type ContentType = 'report' | 'daily' | 'dream' | 'deepDream' | 'daeun' | 'monthly' | 'compat' | 'tojung' | 'topic';

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
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch (e) {
    // 2026-05-29 — 용량초과(QuotaExceededError) 가드. 무가드 시 "돈 내고 결과 유실" 발생.
    //   전략: 방금 저장할 report 는 무조건 보존 + 무료/에페메럴(daily·dream) 오래된 것부터 제거 → 재시도.
    const EPHEMERAL = new Set(['daily', 'dream']);
    let working = reports.slice();
    for (let attempt = 0; attempt < 8; attempt++) {
      // 1순위: 에페메럴(현재 report 제외) 가장 오래된 것 제거, 없으면 가장 오래된 비-현재 레코드 제거
      const evictIdx = (() => {
        for (let i = working.length - 1; i > 0; i--) {
          if (working[i].id !== report.id && EPHEMERAL.has(working[i].contentType ?? '')) return i;
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
  return getReports().find(r => r.id === id) || null;
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
    if (pChanged) localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
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
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
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
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
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
    if (raw) return JSON.parse(raw);
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
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    }
    return profiles;
  } catch { return []; }
}

/** 프로필 직접 저장 — 리포트 생성 없이 프로필만 저장/업데이트 */
export function saveProfileDirect(profile: SajuProfile): void {
  const profiles = getProfiles();
  const key = `${profile.name}_${profile.input.birthYear}_${profile.input.birthMonth}_${profile.input.birthDay}`;
  const idx = profiles.findIndex(p =>
    `${p.name}_${p.input.birthYear}_${p.input.birthMonth}_${p.input.birthDay}` === key
  );
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.unshift(profile);
  }
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

/**
 * 프로필(사주정보) 삭제 — 이용기록과 독립.
 * ⚠ NO-CASCADE: 해당 인물의 과거 분석 리포트는 절대 함께 삭제하지 않는다.
 *   (정책: project_storage_data_model.md — "사주 정보 vs 이용기록 별도 테이블. cascade delete 금지")
 *   본인 프로필을 지우더라도 결제하여 받은 분석 결과는 보관함에 그대로 남는다.
 */
export function deleteProfile(profileId: string): void {
  const profiles = getProfiles().filter(p => p.id !== profileId);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

/* ─────────────────────────────────────────────────────────────
 * Pending Spend 장부 — 2026-06-11 P0 CS fix (권민주님 제보).
 * 문제: 운 차감 → AI 생성 중 앱 강제종료 → 결과 미저장인데 운만 소실.
 * 해결: 차감 직후 pending 마킹 → 결과 저장 성공 시 clear →
 *       재접속 시 5분 경과한 미완료 pending 발견하면 자동 환불 + 안내.
 * 환불은 paid 버킷(가장 유리)으로. localStorage 키: saju500:pending_spends
 * ──────────────────────────────────────────────────────────── */
const PENDING_SPENDS_KEY = 'saju500:pending_spends';
const PENDING_EXPIRE_MS = 5 * 60 * 1000; // 5분 — 정상 생성(최대 ~2분)보다 충분히 김

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
  console.info(`[pendingSpend] 자동 환불: ${total}운 (${expired.length}건 — 생성 중 이탈 복구)`);
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
  console.info(`[removeTopicReports] ${topicIds.join(',')} 정리 — 리포트 ${removed}건`);
  return removed;
}

/** type prefix 로 pending 일괄 해제 — cross-page 플로우(종합사주: 차감→로딩→결과)용 */
export function clearPendingSpendByType(typePrefix: string): void {
  writePendingSpends(readPendingSpends().filter(p => !p.type.startsWith(typePrefix)));
}
