/**
 * localStorage → Firestore 동기화
 *
 * 멀티 디바이스 지원:
 * - 앱인토스에서 저장한 데이터를 웹에서도 볼 수 있게
 * - 로그인 시 localStorage 데이터를 Firestore에 업로드
 * - Firestore 데이터를 localStorage에 다운로드
 *
 * 호출 시점:
 * - 로그인 성공 직후 syncToCloud()
 * - 앱 시작 시 syncFromCloud()
 */

import { doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc, arrayUnion, query, where } from 'firebase/firestore';
import { db, auth } from '@/services/auth/firebase';
import { getReports, saveReport, generateId, mergeProfiles, profilesFromReports, getDeletedReportIds, getDeletedProfileKeys, type LocalReport, type SajuProfile } from './localStore';
import { type BalanceDetail } from './localStore';
import { mergeRestoredChatRooms, getDeletedChatIds, type ChatRoom } from './chatStore';
import { isAppintosBuild } from '@/lib/env';

/**
 * 로컬 → 클라우드 동기화
 * 로그인 후 로컬에만 있는 데이터를 Firestore에 업로드
 */
export async function syncToCloud(uid: string): Promise<boolean> {
  try {
    const batch = writeBatch(db);

    // 1. 유저 문서 동기화 (잔액 제외)
    // 2026-05-29 보안 — 기존: 신규 유저 시 localStorage 잔액(조작 가능)을 Firestore 에 그대로 업로드 →
    //   콘솔로 부풀린 잔액이 서버에 박히는 구멍. 수정: 클라이언트는 금전 필드(balance/total*)를 절대 안 씀.
    //   서버 잔액은 결제(confirmPayment/grantPurchase, Admin SDK)만 기록 = 단일 진실원천.
    //   (firestore.rules 도 금전 필드 클라 write 차단 — 이중 방어)
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // 신규 유저 — 비금전 필드만 생성 (잔액은 서버가 결제 시 Admin SDK 로 기록)
      batch.set(userRef, {
        createdAt: new Date(),
        lastActiveAt: new Date(),
      });
    } else {
      batch.update(userRef, { lastActiveAt: new Date() });
    }

    // 2. 리포트 동기화 — 내용(aiResult)까지 백업.
    //   2026-06-19 CRITICAL fix — 기존: 제목·사주·날짜만 올려서, 기기 저장소 비워지면 복원 시 '빈 껍데기'
    //     → "결제했는데 결과 안 보임 / 내역 사라짐" 유료 콘텐츠 유실. 이제 aiResult 까지 백업/복원.
    //   큰 JSON 은 문자열(aiResultJson)로 — Firestore 색인 1500byte 한계 회피 (색인예외 필드).
    const localReports = getReports();
    for (const report of localReports) {
      const reportRef = doc(db, `users/${uid}/reports`, report.id);
      const existing = await getDoc(reportRef);
      const contentMissing = !existing.exists() || existing.data().aiResultJson == null;
      // 2026-10-17 — 예전 궁합 백업에는 상대방이 빠져 있다 → 로컬에 있으면 채워 올린다
      const partnerMissing = !!report.partner && existing.exists() && existing.data().partnerJson == null;
      if (partnerMissing && !contentMissing) {
        batch.set(reportRef, extraFields(report), { merge: true });
      } else if (!existing.exists() || (report.aiResult && contentMissing)) {
        batch.set(reportRef, {
          name: report.name,
          input: plainCopy(report.input),
          sajuData: plainCopy(report.sajuData),
          situation: report.situation || null,
          createdAt: report.createdAt,
          contentType: report.contentType ?? null,
          type: report.type ?? null,
          profileId: report.profileId ?? null,
          ...extraFields(report),
          ...(report.aiResult ? { aiResultJson: JSON.stringify(report.aiResult) } : {}),
        }, { merge: true });
      }
    }

    await batch.commit();
    return true;
  } catch (err) {
    console.warn('[Sync] 클라우드 업로드 실패:', err);
    return false;
  }
}

/** Firestore 는 undefined 필드가 있으면 쓰기 전체를 거절한다 → JSON 왕복으로 걷어 낸다 (2026-10-17 백업이 조용히 실패하던 원인 후보) */
function plainCopy<T>(v: T): T | null {
  if (v == null) return null;
  try { return JSON.parse(JSON.stringify(v)) as T; } catch { return null; }
}
/** 궁합 상대방과 관계 — 예전 백업은 이 둘을 빼먹어서 복원한 궁합의 상대 칸에 내 사주가 들어갔다 (2026-10-17) */
function extraFields(report: LocalReport): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (report.partner) { try { out.partnerJson = JSON.stringify(report.partner); } catch { /* noop */ } }
  if (report.relation) out.relation = report.relation;
  return out;
}
function readExtraFields(data: Record<string, any>): Partial<LocalReport> {
  const out: Partial<LocalReport> = {};
  if (typeof data.partnerJson === 'string') { try { out.partner = JSON.parse(data.partnerJson); } catch { /* noop */ } }
  if (typeof data.relation === 'string' && data.relation) out.relation = data.relation;
  return out;
}

// P0-1 (2026-06-22) — 부팅 동기화 'uid당 1회' module-level 가드.
//   useAuth() 가 여러 컴포넌트(StoragePage/MyPage/Admin 등)에서 호출 + React.StrictMode 이중마운트로
//   같은 uid 가 인스턴스 수만큼 sync 발화하던 비용 낭비(Firestore read/write 중복) 차단.
const _bootSyncedUids = new Set<string>();

/**
 * 부팅 시 1회 동기화 — 복원(reports 만)→백업. 익명 포함. 같은 uid 는 페이지 로드당 1회만.
 *   복원 먼저 → 백업 순서(서버 데이터를 로컬에 채운 뒤 로컬을 서버에 올림).
 *   잔액 복원은 reportsOnly 로 끔(이미 쓴 운 부활 과복원 방지).
 */
export async function bootSync(uid: string): Promise<void> {
  if (!uid || _bootSyncedUids.has(uid)) return;
  _bootSyncedUids.add(uid);
  try {
    await syncFromCloud(uid, { reportsOnly: true });
    await syncToCloud(uid);
  } catch {
    // 무해 — 다음 페이지 로드에서 재시도(_bootSyncedUids 는 로드마다 초기화)
  }
}

/**
 * 클라우드 → 로컬 동기화
 * Firestore에 있는 데이터를 localStorage에 다운로드
 */
export async function syncFromCloud(uid: string, opts?: { reportsOnly?: boolean }): Promise<void> {
  try {
    // 1. 클라우드 리포트 → 로컬에 없는 것만 추가
    const reportsSnap = await getDocs(collection(db, `users/${uid}/reports`));
    const localReports = getReports();
    const localIds = new Set(localReports.map(r => r.id));
    // twin 잉여 차단 (2026-08-13 · 이중저장 버그의 기존 피해 방어) — 과거 restoreLibrary 버그로
    //   같은 리포트가 base36 + auto-id 두 문서로 서버에 남아있다 (74유저·113건 실측). 서버 정리 전까지
    //   다운로드 단계에서 거른다. 🚨 지문 = contentType + 분단위 + 내용 크기 버킷.
    //   내용 크기까지 보는 이유: twin 은 복사본이라 크기가 같지만, 같은 분에 생성된 '서로 다른' 정당한
    //   리포트(같은 종류 연속 구매)는 내용이 달라 크기가 다르다 → 오탐으로 진짜 데이터를 버리는 것을 방지.
    const lenOf = (r: LocalReport): number => { try { return JSON.stringify(r.aiResult ?? '').length; } catch { return 0; } };
    const fpOf = (ct: unknown, iso: unknown, len: number): string | null =>
      iso ? `${ct ?? 'report'}@${String(iso).slice(0, 16)}@${Math.round(len / 800)}` : null; // ~0.8KB 버킷
    const localFps = new Set(
      localReports.map(r => fpOf(r.contentType, typeof r.createdAt === 'string' ? r.createdAt : new Date(r.createdAt).toISOString(), lenOf(r))).filter(Boolean),
    );
    // 삭제 기록 (2026-10-03) — 이 기기에서 지운 id + 서버 삭제 장부(다른 기기·저장소 초기화 대비)의 id·지문은 내려받지 않는다
    const deletedIds = getDeletedReportIds();
    const deletedFps = new Set<string>();
    try {
      const del = await getDoc(doc(db, `users/${uid}/state`, 'deleted'));
      const d = del.exists() ? (del.data() as any) : null;
      (Array.isArray(d?.reportIds) ? d.reportIds : []).forEach((x: unknown) => typeof x === 'string' && deletedIds.add(x));
      (Array.isArray(d?.fingerprints) ? d.fingerprints : []).forEach((x: unknown) => typeof x === 'string' && deletedFps.add(x));
    } catch { /* 장부 없음 — 로컬 기록만으로 */ }

    // 로컬이 비어있으면(회전 직후) twin 두 벌이 모두 클라우드에서 내려오므로,
    //   base36(클라 정본)을 먼저 처리하도록 정렬 — auto-id 사본이 지문에 걸려 걸러진다.
    const addedReports: LocalReport[] = []; // 이번 동기화로 새로 내려온 리포트 — 사주원국 복원용
    const ordered = [...reportsSnap.docs].sort((a, b) => {
      const aB36 = /^m[a-z0-9]{9,16}$/.test(a.id) ? 0 : 1;
      const bB36 = /^m[a-z0-9]{9,16}$/.test(b.id) ? 0 : 1;
      return aB36 - bB36;
    });
    ordered.forEach((docSnap) => {
      if (!localIds.has(docSnap.id)) {
        if (deletedIds.has(docSnap.id)) return; // 유저가 지운 결과 — 되살리지 않음
        const data = docSnap.data();
        const cloudLen = data.aiResultJson ? String(data.aiResultJson).length : 0;
        const fp = fpOf(data.contentType, data.createdAt, cloudLen);
        if (fp && deletedFps.has(fp)) return; // 지운 결과의 쌍둥이 사본
        if (fp && localFps.has(fp)) return; // 같은 리포트의 다른 id 사본 — 내려받지 않음
        if (fp) localFps.add(fp); // 이번에 추가하는 문서도 지문 등록 — 같은 배치의 twin 차단
        // 2026-06-19 — 내용(aiResult) 복원 (문자열 → 파싱). 없으면(구 백업) undefined → 빈 껍데기지만 기존과 동일.
        let aiResult: unknown = undefined;
        try { if (data.aiResultJson) aiResult = JSON.parse(data.aiResultJson); } catch { /* noop */ }
        const restored = {
          id: docSnap.id,
          name: data.name,
          input: data.input,
          sajuData: data.sajuData,
          situation: data.situation,
          createdAt: data.createdAt,
          contentType: data.contentType ?? undefined,
          type: data.type ?? undefined,
          profileId: data.profileId ?? undefined,
          spentUn: typeof data.spentUn === 'number' ? data.spentUn : undefined,
          ...readExtraFields(data),
          aiResult,
        } as LocalReport;
        saveReport(restored);
        addedReports.push(restored);
      }
    });

    // 사주대화 복원 (2026-10-04) — 저장소 초기화·계정 회전 후 서버 백업에서 없는 대화방만 되받는다
    try {
      const chats = await pullChatRooms(uid);
      if (chats.length) mergeRestoredChatRooms(chats);
    } catch { /* noop */ }

    // 사주원국 복원 (2026-09-27) — 새로 내려온 리포트의 인물을 프로필 목록에 합친다.
    //   '이번에 새로 받은 리포트'만 보므로, 유저가 지운 프로필(리포트는 이미 로컬에 있음)은 되살아나지 않는다.
    if (addedReports.length > 0) mergeProfiles(profilesFromReports(addedReports));

    // P0-1 (2026-06-22) — 부팅/익명 복원은 reports 만 한다. 잔액 복원은 spend 가 로컬 전용인 현 구조에서
    //   '클라우드>로컬 이면 보강'이 이미 써버린 운을 부활시키는 과복원 위험 → spend 서버화 전까진 끈다.
    if (opts?.reportsOnly) return;

    // 2. 클라우드 잔액 → 로컬에 반영
    // 2026-05-28 — 무조건 덮어쓰기 제거. 어뷰징 방지 (로컬에서 차감 후 sync 시 복원되는 무한충전 차단).
    //   정책: 클라우드 잔액이 로컬보다 많을 때만 (= 다른 디바이스 충전 흔적) 차이만큼 보강.
    //   로컬보다 적으면 무시 (= 이미 차감했는데 서버는 미반영된 경우 — 클라가 진실).
    //   숫자 schema(legacy)는 객체로 변환해서 비교.
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const cloudBalanceRaw = userDoc.data().balance as BalanceDetail | number | undefined;
      const cloudBalance: BalanceDetail | null = (() => {
        if (cloudBalanceRaw == null) return null;
        if (typeof cloudBalanceRaw === 'number') return { paid: cloudBalanceRaw, bonus: 0, reward: 0 };
        return cloudBalanceRaw;
      })();
      if (cloudBalance) {
        try {
          const localRaw = localStorage.getItem('saju500_balance_v2');
          const local: BalanceDetail = localRaw ? JSON.parse(localRaw) : { paid: 0, bonus: 0, reward: 0 };
          const cloudTotal = (cloudBalance.paid || 0) + (cloudBalance.bonus || 0) + (cloudBalance.reward || 0);
          const localTotal = (local.paid || 0) + (local.bonus || 0) + (local.reward || 0);
          // 클라우드가 더 많으면 다른 디바이스 충전분 → 차이만큼 paid 에 보강
          if (cloudTotal > localTotal) {
            const diff = cloudTotal - localTotal;
            local.paid = (local.paid || 0) + diff;
            localStorage.setItem('saju500_balance_v2', JSON.stringify(local));
          }
          // 로컬이 더 많으면 (클라가 차감, 서버 미반영) — 무시. 다음 차감 시 서버에도 반영됨.
        } catch (parseErr) {
          // 파싱 실패 시 안전하게 클라우드 잔액으로 초기화
          localStorage.setItem('saju500_balance_v2', JSON.stringify(cloudBalance));
        }
      }
    }

    // 3. 2026-10-21 — 로그아웃 직전 스냅샷으로 되살리기. 로그아웃은 이 기기 잔액을 지우고 그 값을 이 계정 사본에 남긴다(MyPage onLogout).
    //   서버 잔액에 없던 몫(예전 보상 등)도 다시 로그인하면 돌아오게, 기기 잔액이 스냅샷보다 적을 때만 모자란 만큼 채운다.
    //   로그인한 계정만, 스냅샷은 한 번 쓰면 표시를 지운다(되풀이 채우기 방지).
    if (auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.uid === uid) {
      const snap = await getDoc(doc(db, `users/${uid}/state`, 'balance')).catch(() => null);
      const m = snap?.exists() ? (snap.data() as Record<string, unknown>) : null;
      if (m && m.logoutAt) {
        const localRaw = localStorage.getItem('saju500_balance_v2');
        const local: BalanceDetail = localRaw ? JSON.parse(localRaw) : { paid: 0, bonus: 0, reward: 0 };
        const want = { paid: Math.max(0, Number(m.paid) || 0), bonus: Math.max(0, Number(m.bonus) || 0), reward: Math.max(0, Number(m.reward) || 0) };
        const localTotal = (local.paid || 0) + (local.bonus || 0) + (local.reward || 0);
        const wantTotal = want.paid + want.bonus + want.reward;
        if (wantTotal > localTotal + 1e-6) {
          // 스냅샷은 로그아웃 순간의 이 계정 잔액 전부(서버 잔액 포함)라 칸별로 그대로 되돌린다(칸마다 큰 값을 고르면 합이 부풀 수 있다)
          localStorage.setItem('saju500_balance_v2', JSON.stringify(want));
          try { window.dispatchEvent(new Event('saju500:balance-changed')); } catch { /* noop */ }
        }
        await setDoc(doc(db, `users/${uid}/state`, 'balance'), { logoutAt: null }, { merge: true }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[Sync] 클라우드 다운로드 실패:', err);
  }
}

/**
 * 보관함 서버 복원 (2026-06-19) — 기기 저장소가 비워져 보관함이 사라진 경우,
 *   서버(users/{uid}/reports 백업 + top-level reports 생성원본)에서 내용까지 끌어와 복원.
 *   @returns 복원된 리포트 수.
 */
export async function restoreLibraryFromServer(): Promise<number> {
  try {
    const [{ getFunctions, httpsCallable }, { app }, { ensureAuth }] = await Promise.all([
      import('firebase/functions'),
      import('@/services/auth/firebase'),
      import('@/services/auth/authService'),
    ]);
    await ensureAuth();
    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'restoreLibrary');
    const r = await fn({});
    const reports = ((r?.data as { reports?: unknown[] })?.reports ?? []) as Array<Record<string, unknown>>;
    const localReports = getReports();
    // twin 지문 필터 (2026-08-13) — 서버가 이미 dedupe 하지만 ±60s 경계 누락 대비 이중 방어.
    //   contentType + 분단위 + 내용 크기 버킷 (같은 분 다른 리포트 오탐 방지, syncFromCloud 와 동일 규칙).
    const lenOf = (ai: unknown) => { try { return JSON.stringify(ai ?? '').length; } catch { return 0; } };
    const fpOf = (ct: unknown, iso: unknown, len: number): string | null =>
      iso ? `${ct ?? 'report'}@${String(iso).slice(0, 16)}@${Math.round(len / 800)}` : null;
    const localFps = new Set(
      localReports.map((x) => fpOf(x.contentType, typeof x.createdAt === 'string' ? x.createdAt : new Date(x.createdAt).toISOString(), lenOf(x.aiResult))).filter(Boolean),
    );
    let n = 0;
    for (const rep of reports) {
      if (!rep || !rep.aiResult) continue;
      // 2026-10-17 — 이미 보관함에 있어도 본문이 비어 있으면(옛 백업에서 내려온 빈 기록) 서버 본문으로 채운다
      const local = rep.id ? localReports.find((x) => x.id === rep.id) : undefined;
      if (local && local.aiResult) continue; // 이미 보관함에 있으면 skip
      const fp = fpOf(rep.contentType, rep.createdAt, lenOf(rep.aiResult));
      if (!local && fp && localFps.has(fp)) continue; // 같은 리포트의 다른 id 사본 — 재저장 안 함
      if (fp) localFps.add(fp);
      const t = rep.type === 'free' ? 'free' : 'paid';
      const hasPillars = (x: unknown) => !!(x as any)?.pillars?.length;
      saveReport({
        id: (rep.id as string) || generateId(),
        name: (local?.name && local.name !== '복원된 분석' ? local.name : (rep.name as string)) || '복원된 분석',
        input: ((local?.input as any)?.birthYear ? local!.input : (rep.input ?? {})) as LocalReport['input'],
        sajuData: (hasPillars(local?.sajuData) ? local!.sajuData : (rep.sajuData ?? {})) as LocalReport['sajuData'],
        situation: rep.situation as LocalReport['situation'],
        type: t,
        contentType: rep.contentType as LocalReport['contentType'],
        aiResult: rep.aiResult,
        profileId: rep.profileId as string | undefined,
        spentUn: typeof rep.spentUn === 'number' ? rep.spentUn : undefined,
        ...readExtraFields(rep),
        createdAt: (rep.createdAt as string) || new Date().toISOString(),
      });
      n++;
    }
    return n;
  } catch (err) {
    console.warn('[restoreLibrary] 실패:', err);
    return 0;
  }
}

/**
 * 단건 서버 백업 (2026-06-22 P0-2) — 결과(aiResult 보유) 영속 '즉시' users/{uid}/reports 에 업서트.
 *   휘발성 localStorage 가 비워져도 restoreLibrary/syncFromCloud 가 본문까지 복원 →
 *   "결제했는데 결과 사라짐" 근본 차단. 익명 uid 도 firestore.rules 가 본인 reports write 허용.
 *   localStorage quota 실패와 무관하게 진본을 서버에 먼저 확보하는 게 핵심. fire-and-forget.
 */
export async function backupReport(report: LocalReport): Promise<void> {
  try {
    if (!report || !report.id || !report.aiResult) return; // 본문 있는 것만 (빈 셸 백업 방지)
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const reportRef = doc(db, `users/${uid}/reports`, report.id);
    await setDoc(reportRef, {
      name: report.name,
      input: plainCopy(report.input),
      sajuData: plainCopy(report.sajuData),
      situation: report.situation ?? null,
      createdAt: report.createdAt,
      contentType: report.contentType ?? null,
      type: report.type ?? null,
      profileId: report.profileId ?? null,
      spentUn: typeof report.spentUn === 'number' ? report.spentUn : null,
      ...extraFields(report),
      aiResultJson: JSON.stringify(report.aiResult),
      backedUpAt: new Date(),
    }, { merge: true });
  } catch (err) {
    console.warn('[backupReport] 실패:', err);
  }
}

/**
 * 잔액 미러 push — users/{uid}/state/balance 스냅샷 (2026-08-13 · 기기 여권 잔액 복원)
 *   운 잔액은 localStorage 단일 진본이라 저장소 초기화 시 리워드 운까지 영구 소실됐다.
 *   모든 잔액 변경을 여기로 미러링 → uid 회전 시 기기 여권(devicePassport)이 이 문서를
 *   새 uid 로 복사, 클라가 '부팅 시 키 부재'일 때만 1회 seed 한다.
 *   ⚠️ users 문서의 금전 필드(balance 등)는 rules 로 클라 차단 유지 — 미러는 별도 서브컬렉션
 *   (state/balance) 이며 '클라 자기신고 스냅샷' 성격. 서버 지급 판정(grantPurchase 등)에는 절대 안 쓴다.
 */
export async function pushBalanceMirror(detail: BalanceDetail, opts?: { logout?: boolean }): Promise<boolean> {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    await setDoc(doc(db, `users/${uid}/state`, 'balance'), {
      paid: Math.max(0, Number(detail.paid) || 0),
      bonus: Math.max(0, Number(detail.bonus) || 0),
      reward: Math.max(0, Number(detail.reward) || 0),
      updatedAt: new Date(),
      // 2026-10-21 — 로그아웃 직전 스냅샷 표시. 다시 로그인하면 이 값으로 기기 잔액을 되살린다(syncFromCloud).
      //   평소 저장은 이 표시를 건드리지 않는다(늦게 도착한 저장이 표시를 지우면 되살리기가 빠진다)
      ...(opts?.logout ? { logoutAt: new Date() } : {}),
    }, { merge: true });
    return true;
  } catch { return false; /* 다음 잔액 변경에서 재시도 */ }
}

/**
 * 결과 삭제를 서버에 반영 (2026-10-03) — 지운 결과가 부팅 동기화·기기 여권 복원으로 되살아나던 버그.
 *   ① 이 계정의 같은 결과 사본(같은 id + 같은 종류·생성시각의 쌍둥이 사본) 삭제
 *   ② 삭제 장부 users/{uid}/state/deleted 에 id·지문 기록 — 다른 기기/저장소 초기화 뒤에도 다시 내려받지 않고,
 *      서버 기기 여권도 옛 계정에서 복사해 오지 않는다.
 */
export async function deleteReportRemote(report: LocalReport): Promise<void> {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid || !report?.id) return;
    const iso = typeof report.createdAt === 'string' ? report.createdAt : new Date(report.createdAt as number).toISOString();
    let len = 0;
    try { len = JSON.stringify(report.aiResult ?? '').length; } catch { /* noop */ }
    const fp = `${report.contentType ?? 'report'}@${iso.slice(0, 16)}@${Math.round(len / 800)}`;
    await setDoc(doc(db, `users/${uid}/state`, 'deleted'), {
      reportIds: arrayUnion(report.id),
      fingerprints: arrayUnion(fp),
      updatedAt: new Date(),
    }, { merge: true });
    await deleteDoc(doc(db, `users/${uid}/reports`, report.id));
    // 쌍둥이 사본 (과거 이중저장 버그로 auto-id 사본이 남아 있을 수 있다)
    try {
      const twins = await getDocs(query(collection(db, `users/${uid}/reports`), where('createdAt', '==', report.createdAt)));
      for (const t of twins.docs) {
        const data = t.data() as any;
        if ((data.contentType ?? 'report') !== (report.contentType ?? 'report')) continue;
        await deleteDoc(t.ref);
      }
    } catch { /* 쌍둥이 정리 실패는 무해 — 지문 장부가 재다운로드를 막는다 */ }
  } catch (err) {
    console.warn('[deleteReportRemote] 실패:', err);
  }
}

/**
 * 사주원국 미러 push (2026-09-27) — 프로필은 로컬 전용이라 저장소가 비면 복원 불가였다.
 *   users/{uid}/state/profiles 에 목록을 스냅샷(사주 계산값 제외 — 복원 시 재계산). 실패는 다음 쓰기에서 재시도.
 */
export async function pushProfilesMirror(profiles: SajuProfile[]): Promise<void> {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    // 2026-10-23 — 웹 로그인 계정은 이 페이지에서 그 계정 사본을 먼저 읽어 합친 뒤에만 덮어쓴다.
    //   그전엔 로그인 직후 보관함 복원이 인물을 합치며 프로필을 쓰면 2초 뒤 이 기기 목록만으로 계정 사본을 덮어써,
    //   다른 기기에서 넣은 가족 사주(보관함 기록이 없는 사람)가 사본에서도 지워졌다.
    if (await isWebAccount(uid)) {
      const r = await pullAccountProfilesOnce(uid);
      if (!r.ok) return; // 계정 사본을 못 읽었으면 덮어쓰지 않는다 (다음 쓰기에서 다시)
      if (auth.currentUser?.uid !== uid) return;
      profiles = (await import('./localStore')).getProfiles(); // 합친 뒤의 목록으로
      // 2026-10-24 — 로그아웃이 기기 프로필을 비운 직후 예약된 쓰기가 터지면 계정 사본이 빈 목록으로 덮였다.
      //   기기 목록이 비었는데 계정 사본에 이 기기가 지우지 않은 사람이 있으면 쓰지 않는다
      if (!profiles.length) {
        const del = getDeletedProfileKeys();
        if (r.remoteKeys.some((k) => !del.has(k))) return;
      }
    }
    const items = (profiles || []).slice(0, 100).map((p) => ({
      id: p.id,
      name: p.name ?? '',
      input: p.input ?? null,
      relation: p.relation ?? null,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date(p.createdAt as number).toISOString(),
    }));
    // Firestore 는 undefined 를 거부 — JSON 왕복으로 제거
    const clean = JSON.parse(JSON.stringify(items));
    // 지운 인물 키 동반 (2026-10-03) — 기기 여권이 다른 계정 목록을 합칠 때 되살리지 않도록
    const deletedKeys = Array.from(getDeletedProfileKeys()).slice(-500);
    await setDoc(doc(db, `users/${uid}/state`, 'profiles'), { items: clean, count: clean.length, deletedKeys, updatedAt: new Date() });
  } catch { /* noop */ }
}

/** 사주원국 미러 pull — 기기 여권 복원 후 병합용 (없으면 빈 배열) */
export async function pullProfilesMirror(uid: string): Promise<any[]> {
  try { return await readProfilesMirror(uid); } catch { return []; }
}

/** 미러 읽기 본체 — 서버 삭제 장부(deletedKeys)에 있는 인물은 뺀다. 읽기 실패는 던진다(빈 사본과 구분하려고) */
async function readProfilesMirror(uid: string): Promise<any[]> {
  const snap = await getDoc(doc(db, `users/${uid}/state`, 'profiles'));
  const data = snap.exists() ? (snap.data() as any) : null;
  const items = Array.isArray(data?.items) ? data.items : [];
  const deleted = new Set<string>(Array.isArray(data?.deletedKeys) ? data.deletedKeys : []);
  return items.filter((p: any) => !deleted.has(profileMirrorKey(p)));
}

/** 삭제 장부와 같은 키 (이름_년_월_일) */
function profileMirrorKey(p: any): string {
  return `${p?.name}_${p?.input?.birthYear}_${p?.input?.birthMonth}_${p?.input?.birthDay}`;
}

/* ── 로그인 계정의 사주원국 사본 합치기 (2026-10-23, 웹만) ──
 *   부팅 때 restoreProfilesIfEmpty 는 로그인 전 새 익명 uid 의 빈 사본을 읽어서, 다른 기기에서 넣은 가족 사주
 *   (보관함 기록이 없는 사람)는 로그인해도 이 기기에 돌아오지 않았다. 로그인 계정은 페이지마다 한 번 그 계정 사본을 읽어
 *   이 기기에 없는 사람만 합친다(mergeProfiles: 이미 있는 사람은 덮어쓰지 않고, 이 기기에서 지운 사람은 되살리지 않는다).
 *   앱인토스는 기기 여권(devicePassport)이 같은 일을 하므로 하지 않는다. */
const _accountProfilePull = new Map<string, Promise<{ ok: boolean; added: number; remoteKeys: string[] }>>();

/** 웹이고 익명이 아닌 지금 로그인 계정인가 */
async function isWebAccount(uid: string): Promise<boolean> {
  if (isAppintosBuild) return false;
  const u = auth.currentUser;
  if (!u || u.isAnonymous || u.uid !== uid) return false;
  try {
    const { isAppsInToss } = await import('@/services/payment/iapService');
    return !isAppsInToss();
  } catch { return false; }
}

function pullAccountProfilesOnce(uid: string): Promise<{ ok: boolean; added: number; remoteKeys: string[] }> {
  const cur = _accountProfilePull.get(uid);
  if (cur) return cur;
  const run = (async () => {
    try {
      const items = await readProfilesMirror(uid);
      const remoteKeys = items.map((p: any) => profileMirrorKey(p));
      if (!items.length) return { ok: true, added: 0, remoteKeys };
      const store = await import('./localStore');
      return { ok: true, added: store.mergeProfiles(items), remoteKeys };
    } catch {
      _accountProfilePull.delete(uid); // 읽기 실패 — 다음 호출에서 다시 읽는다
      return { ok: false, added: 0, remoteKeys: [] };
    }
  })();
  _accountProfilePull.set(uid, run);
  return run;
}

/** 로그인 성공 직후(웹) — 로그인한 계정의 사주원국 사본을 이 기기 프로필에 합친다. 합친 사람 수 반환 */
export async function mergeAccountProfiles(uid: string): Promise<number> {
  try {
    if (!uid || !(await isWebAccount(uid))) return 0;
    return (await pullAccountProfilesOnce(uid)).added;
  } catch { return 0; }
}

/** 로컬에 사주가 하나도 없는데 서버 미러에는 있으면 되살린다 (2026-10-14).
 *  기기 여권은 계정이 바뀐 경우만 복원해서, 계정은 그대로인데 저장소만 비워진 경우(웹뷰 정리 등)엔
 *  기존 유저가 홈에서 '내 사주 넣기'를 다시 보게 됐다. 로컬이 비었을 때만 한 번 읽는다(문서 1건). */
export async function restoreProfilesIfEmpty(): Promise<number> {
  try {
    const store = await import('./localStore');
    if (store.getProfiles().length > 0 || store.getMyProfile()) return 0;
    const { ensureAuth } = await import('@/services/auth/authService');
    await ensureAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) return 0;
    const items = await pullProfilesMirror(uid);
    if (!items.length) return 0;
    return store.mergeProfiles(items);
  } catch { return 0; }
}

/* ── 사주대화 서버 백업 (2026-10-04) ── */
const CHAT_SIG_KEY = 'saju500:chat_mirror_sig';
const chatSig = (r: ChatRoom): string =>
  `${r.updatedAt}|${r.messages?.length ?? 0}|${r.name}|${r.profileId ?? ''}|${r.completed ? 1 : 0}`;

/** 바뀐 대화방만 users/{uid}/chats/{roomId} 로 업로드 (서명 비교 — 계정이 바뀌면 전부 다시) */
export async function pushChatMirror(rooms: ChatRoom[]): Promise<void> {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid || !Array.isArray(rooms)) return;
    let store: { uid?: string; sigs?: Record<string, string> } = {};
    try { store = JSON.parse(localStorage.getItem(CHAT_SIG_KEY) || '{}'); } catch { /* noop */ }
    const sigs: Record<string, string> = store.uid === uid ? (store.sigs || {}) : {};
    for (const r of rooms) {
      if (!r?.id) continue;
      const s = chatSig(r);
      if (sigs[r.id] === s) continue;
      let json = JSON.stringify(r);
      // 문서 1MB 한도 — 결과 원문(fullResult)이 크면 그것만 빼고 대화는 반드시 보존
      if (json.length > 900_000 && r.contentContext) {
        json = JSON.stringify({ ...r, contentContext: { ...r.contentContext, fullResult: undefined } });
      }
      await setDoc(doc(db, `users/${uid}/chats`, r.id), { roomJson: json, updatedAt: r.updatedAt, v: 1 });
      sigs[r.id] = s;
    }
    localStorage.setItem(CHAT_SIG_KEY, JSON.stringify({ uid, sigs }));
  } catch { /* noop — 다음 변경에서 재시도 */ }
}

/** 서버 백업 대화방 (서버 삭제 장부·이 기기 삭제 기록 제외) */
export async function pullChatRooms(uid: string): Promise<ChatRoom[]> {
  try {
    const snap = await getDocs(collection(db, `users/${uid}/chats`));
    if (snap.empty) return [];
    const deleted = getDeletedChatIds();
    try {
      const del = await getDoc(doc(db, `users/${uid}/state`, 'deleted'));
      const ids = del.exists() ? (del.data() as any)?.chatIds : null;
      if (Array.isArray(ids)) ids.forEach((x: unknown) => typeof x === 'string' && deleted.add(x));
    } catch { /* noop */ }
    const out: ChatRoom[] = [];
    snap.forEach((d) => {
      if (deleted.has(d.id)) return;
      try { const r = JSON.parse((d.data() as any).roomJson); if (r?.id) out.push(r); } catch { /* 손상 문서 무시 */ }
    });
    return out;
  } catch { return []; }
}

/** 대화방 삭제를 서버에 반영 — 백업 문서 삭제 + 삭제 장부 기록 */
export async function deleteChatRemote(id: string): Promise<void> {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid || !id) return;
    await setDoc(doc(db, `users/${uid}/state`, 'deleted'), { chatIds: arrayUnion(id), updatedAt: new Date() }, { merge: true });
    await deleteDoc(doc(db, `users/${uid}/chats`, id));
  } catch { /* noop */ }
}

/** 잔액 미러 pull — 기기 여권 seed 용 (없으면 null) */
export async function pullBalanceMirror(uid: string): Promise<{ paid: number; bonus: number; reward: number; migratedFromUid?: string } | null> {
  try {
    const snap = await getDoc(doc(db, `users/${uid}/state`, 'balance'));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    return {
      paid: Math.max(0, Number(d.paid) || 0),
      bonus: Math.max(0, Number(d.bonus) || 0),
      reward: Math.max(0, Number(d.reward) || 0),
      // 옛 계정에서 이관돼 온 미러인지 — 아니면 이 기기가 방금 올린 기본값일 수 있다 (seed 금지)
      migratedFromUid: typeof d.migratedFromUid === 'string' ? d.migratedFromUid : undefined,
    };
  } catch { return null; }
}
