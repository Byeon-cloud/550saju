/**
 * auditOrphanAccounts — 매일 새벽 '같은 사람의 갈라진 계정' 전수 점검 + 빠진 기록 자동 보충
 *   (2026-10-04 · 오너 지시 "기록소실 절대 없게. 과거 유저들도 체크해서 없게")
 *
 * 배경: 익명 uid 는 웹뷰 저장소에 묶여 있어 저장소가 비면 새 uid 가 된다. 부팅 시 기기 여권
 *   (registerDevicePassport)이 1차로 잇지만, 여권 도입(08-13) 전 회전·부팅 중 호출 실패 등
 *   여권이 못 잇는 경우가 남는다. 10-04 수동 전수 점검에서 4명 123건을 찾아 복구했다 — 그 점검을 매일 자동화.
 *
 * 강한 연결 (같은 묶음 → 리포트 + 사주대화 전부 보충):
 *   A. devices/{deviceId}.uids        — 같은 기기 (여권 등록부, 08-13~)
 *   B. compensations.claimedByUid     — 어드민 확정 (기기 → 옛 uid)
 *   C. 같은 결제 orderId 가 여러 uid 에 — IAP 이력 복구로 생긴 같은 결제자
 * 약한 연결 (D — 그 사람 본인 사주 결과만, 대화 X):
 *   D. 같은 '본인' 사주 — 이름+생년월일+성별+태어난 시각+양음력이 모두 같고 두 계정 모두 relation '본인'.
 *      가족이 남의 사주를 '본인'으로 넣은 경우(엄마 폰에 딸 사주) 두 사람이 잘못 묶일 수 있어
 *      ① 옛 계정 마지막 활동이 새 계정 첫 활동 이전(사용 기간 비중첩 — 회전의 특징)일 때만,
 *      ② 그 사람 사주로 만든 결과만 옮긴다 (최악의 경우에도 본인 사주 결과 — 남의 대화·남의 결과는 절대 안 넘어감).
 *
 * 보충 규칙 (복사만 · 파괴 0):
 *   - 대상 = 최근 30일 안에 활동한 계정 (옛 계정은 다시 쓰일 일이 없어 채우지 않음)
 *   - 대상에 없는 것만 create (같은 id / 같은 종류+생성 분 지문 skip) — 덮어쓰기 불가
 *   - 유저가 지운 결과·대화(state/deleted 장부의 id·지문)는 어느 계정에서도 다시 채우지 않음
 *   - 잔액은 건드리지 않음 (복제 위험 — 잔액은 기기 여권의 같은 기기 미러 경로만)
 *   - 상한: 실행당 복사 2,000건 · 묶음당 계정 12개 초과는 비정상으로 보고 건너뜀
 *   - 실행 결과는 ops/orphanAudit_{KST날짜} 에 기록 (사후 감사용)
 */
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const db = admin.firestore();
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 30 * DAY_MS;
const MAX_COPIES_PER_RUN = 2000;
const MAX_UIDS_PER_GROUP = 12;

type RepMeta = { id: string; ct: string; at: string; who: string | null; copied: boolean };

/** 그 사람(사주 주인) 식별 키 — 이름+생년월일+성별+시각+양음력 */
function personKey(name: unknown, input: any): string | null {
  if (!input || !name || !input.birthYear) return null;
  const t = input.hasBirthTime ? `${input.birthHour}:${input.birthMinute ?? ''}` : 'x';
  return `${name}|${input.birthYear}-${input.birthMonth}-${input.birthDay}|${input.gender || ''}|${t}|${input.calendarType || ''}`;
}
const tsIso = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (typeof v === 'number') return new Date(v).toISOString();
  return '';
};
const fp = (ct: string, at: string) => `${ct}@${at.slice(0, 16)}`;

export async function runOrphanAudit(): Promise<Record<string, number>> {
  // 1) 전 계정 리포트 메타 (본문 제외)
  const reps = await db.collectionGroup('reports')
    .select('name', 'input', 'contentType', 'createdAt', 'restoredFrom', 'migratedFromUid').get();
  const byUid = new Map<string, RepMeta[]>();
  const selfOf = new Map<string, Set<string>>(); // 본인 키 → uids
  for (const d of reps.docs) {
    const parent = d.ref.parent.parent;
    if (!parent || parent.parent?.id !== 'users') continue; // top-level reports 제외
    const uid = parent.id;
    const f = d.data() as any;
    const who = personKey(f.name, f.input);
    if (!byUid.has(uid)) byUid.set(uid, []);
    byUid.get(uid)!.push({ id: d.id, ct: f.contentType || 'report', at: tsIso(f.createdAt), who, copied: !!(f.restoredFrom || f.migratedFromUid) });
    if (who && f.input?.relation === '본인') { if (!selfOf.has(who)) selfOf.set(who, new Set()); selfOf.get(who)!.add(uid); }
  }

  // 2) 활동 시점 + 강한 연결 (union-find)
  const parentOf = new Map<string, string>();
  const find = (x: string): string => { if (!parentOf.has(x)) parentOf.set(x, x); let r = x; while (parentOf.get(r) !== r) r = parentOf.get(r)!; parentOf.set(x, r); return r; };
  const union = (x: string, y: string) => { const a = find(x), b = find(y); if (a !== b) parentOf.set(a, b); };
  const lastSeen = new Map<string, number>();
  const firstSeen = new Map<string, number>(); // 복사본 제외 — 그 계정이 '직접' 처음 쓰인 시점
  const seen = (uid: string, iso: string, first = true) => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return;
    lastSeen.set(uid, Math.max(lastSeen.get(uid) || 0, t));
    if (first) firstSeen.set(uid, Math.min(firstSeen.get(uid) ?? Infinity, t));
  };

  const devs = await db.collection('devices').select('uids').get();
  const devUids = new Map<string, string[]>();
  for (const d of devs.docs) {
    if (/^e2e/.test(d.id)) continue; // 테스트 기기
    const m = ((d.data() as any).uids || {}) as Record<string, any>;
    const u = Object.keys(m);
    devUids.set(d.id, u);
    u.forEach((x) => seen(x, tsIso(m[x]), false)); // 여권 시각은 매 부팅 갱신 → 마지막 활동으로만
    for (let i = 1; i < u.length; i++) union(u[0], u[i]);
  }
  const comps = await db.collection('compensations').select('claimedByUid').get();
  for (const d of comps.docs) {
    const cu = (d.data() as any).claimedByUid as string | undefined;
    if (!cu) continue;
    for (const x of devUids.get(d.id) || []) union(cu, x);
  }
  const pays = await db.collectionGroup('payments').select('orderId').get();
  const byOrder = new Map<string, Set<string>>();
  for (const d of pays.docs) {
    const parent = d.ref.parent.parent;
    if (!parent || parent.parent?.id !== 'users') continue;
    const oid = ((d.data() as any).orderId as string) || d.id;
    if (!byOrder.has(oid)) byOrder.set(oid, new Set());
    byOrder.get(oid)!.add(parent.id);
  }
  for (const s of byOrder.values()) { const u = [...s]; for (let i = 1; i < u.length; i++) union(u[0], u[i]); }
  for (const [uid, list] of byUid) list.forEach((r) => seen(uid, r.at, !r.copied));
  try {
    const us = await db.collection('users').select('lastActiveAt').get();
    us.docs.forEach((d) => seen(d.id, tsIso((d.data() as any).lastActiveAt), false));
  } catch { /* noop */ }

  const now = Date.now();
  const isActive = (u: string) => now - (lastSeen.get(u) || 0) < ACTIVE_WINDOW_MS;
  const stat = { groups: 0, targets: 0, copiedReports: 0, copiedChats: 0, selfLinks: 0, copiedSelfReports: 0, skippedLarge: 0 };
  let budget = MAX_COPIES_PER_RUN;

  const ledgerCache = new Map<string, { ids: string[]; fps: string[]; chats: string[] }>();
  const ledgerOf = async (u: string) => {
    const hit = ledgerCache.get(u);
    if (hit) return hit;
    let v = { ids: [] as string[], fps: [] as string[], chats: [] as string[] };
    try {
      const dl = await db.doc(`users/${u}/state/deleted`).get();
      const dd = dl.exists ? (dl.data() as any) : null;
      const str = (a: any): string[] => (Array.isArray(a) ? a.filter((x: any) => typeof x === 'string') : []);
      v = { ids: str(dd?.reportIds), fps: str(dd?.fingerprints).map((x) => x.split('@').slice(0, 2).join('@')), chats: str(dd?.chatIds) };
    } catch { /* noop */ }
    ledgerCache.set(u, v);
    return v;
  };

  /** src 의 리포트 중 대상에 없는 것만 create. filter 로 옮길 범위 제한 */
  const copyReports = async (src: string, t: string, haveIds: Set<string>, haveFps: Set<string>,
    del: { ids: Set<string>; fps: Set<string> }, filter: (r: RepMeta) => boolean, via: string): Promise<number> => {
    const need = (byUid.get(src) || []).filter((r) => {
      if (!filter(r)) return false;
      const k = fp(r.ct, r.at);
      if (haveIds.has(r.id) || haveFps.has(k) || del.ids.has(r.id) || del.fps.has(k)) return false;
      haveIds.add(r.id); haveFps.add(k); return true;
    }).slice(0, budget);
    let n = 0;
    for (let i = 0; i < need.length; i += 100) {
      const snaps = await db.getAll(...need.slice(i, i + 100).map((r) => db.doc(`users/${src}/reports/${r.id}`)));
      for (const s of snaps) {
        if (!s.exists) continue;
        try {
          await db.doc(`users/${t}/reports/${s.id}`).create({
            ...s.data(), restoredFrom: src, restoredVia: via, restoredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          n++; budget--;
        } catch { /* 이미 있음(경합) — skip */ }
      }
    }
    return n;
  };

  // 3) 강한 연결 묶음 — 리포트 + 사주대화 전부
  const groups = new Map<string, Set<string>>();
  for (const uid of parentOf.keys()) { const r = find(uid); if (!groups.has(r)) groups.set(r, new Set()); groups.get(r)!.add(uid); }
  for (const set of groups.values()) {
    if (set.size < 2 || budget <= 0) continue;
    if (set.size > MAX_UIDS_PER_GROUP) { stat.skippedLarge++; continue; }
    stat.groups++;
    const uids = [...set];
    const targets = uids.filter(isActive);
    if (targets.length === 0) continue;
    const del = { ids: new Set<string>(), fps: new Set<string>(), chats: new Set<string>() };
    for (const u of uids) { const l = await ledgerOf(u); l.ids.forEach((x) => del.ids.add(x)); l.fps.forEach((x) => del.fps.add(x)); l.chats.forEach((x) => del.chats.add(x)); }
    for (const t of targets) {
      if (budget <= 0) break;
      stat.targets++;
      const have = byUid.get(t) || [];
      const haveIds = new Set(have.map((r) => r.id));
      const haveFps = new Set(have.map((r) => fp(r.ct, r.at)));
      for (const src of uids) {
        if (src === t || budget <= 0) continue;
        stat.copiedReports += await copyReports(src, t, haveIds, haveFps, del, () => true, 'orphan-audit-daily');
      }
      try {
        const tChats = new Set((await db.collection(`users/${t}/chats`).listDocuments()).map((r) => r.id));
        for (const src of uids) {
          if (src === t || budget <= 0) continue;
          const refs = (await db.collection(`users/${src}/chats`).listDocuments())
            .filter((r) => !tChats.has(r.id) && !del.chats.has(r.id)).slice(0, Math.min(100, budget));
          if (refs.length === 0) continue;
          for (const s of await db.getAll(...refs)) {
            if (!s.exists) continue;
            try {
              await db.doc(`users/${t}/chats/${s.id}`).create({ ...s.data(), restoredFrom: src });
              tChats.add(s.id); stat.copiedChats++; budget--;
            } catch { /* exists */ }
          }
        }
      } catch { /* noop */ }
    }
  }

  // 4) 약한 연결(D) — 같은 본인 사주 + 사용 기간 비중첩일 때, 그 사람 사주 결과만 옛 → 새 계정
  for (const [who, set] of selfOf) {
    if (set.size < 2 || budget <= 0) continue;
    if (set.size > MAX_UIDS_PER_GROUP) { stat.skippedLarge++; continue; }
    const uids = [...set];
    for (const t of uids) {
      if (!isActive(t) || budget <= 0) continue;
      const tFirst = firstSeen.get(t);
      if (tFirst === undefined) continue;
      for (const src of uids) {
        if (src === t || find(src) === find(t) || budget <= 0) continue; // 강한 연결이면 3)에서 이미 처리
        if ((lastSeen.get(src) || 0) > tFirst + DAY_MS) continue; // 두 계정이 동시에 쓰였다 → 다른 사람일 수 있음
        stat.selfLinks++;
        const have = byUid.get(t) || [];
        const haveIds = new Set(have.map((r) => r.id));
        const haveFps = new Set(have.map((r) => fp(r.ct, r.at)));
        const ls = await ledgerOf(src);
        const lt = await ledgerOf(t);
        const del = { ids: new Set([...ls.ids, ...lt.ids]), fps: new Set([...ls.fps, ...lt.fps]) };
        stat.copiedSelfReports += await copyReports(src, t, haveIds, haveFps, del, (r) => r.who === who, 'orphan-audit-daily-self');
      }
    }
  }
  return stat;
}

export const auditOrphanAccounts = onSchedule(
  {
    schedule: 'every day 04:10',
    timeZone: 'Asia/Seoul',
    timeoutSeconds: 540,
    memory: '512MiB',
    minInstances: 0,
    region: 'us-central1',
  },
  async () => {
    const started = Date.now();
    try {
      const stat = await runOrphanAudit();
      const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      await db.doc(`ops/orphanAudit_${day}`).set({ ...stat, ms: Date.now() - started, at: admin.firestore.FieldValue.serverTimestamp() });
      console.log('[orphanAudit]', JSON.stringify(stat));
    } catch (e: any) {
      console.error('[orphanAudit] 실패:', e?.message || e);
    }
  },
);
