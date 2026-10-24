/**
 * 친구 초대 (2026-10-18, 오너: "공유해 준 사람에게 확실히 보상, 무한 적립과 어뷰징은 막고, 누가 몇 명 데려왔는지 완벽하게 추적")
 *
 *   흐름
 *   1) 초대하는 사람: getMyReferral → 초대 코드(6자). 모든 보내기 링크에 inv={코드}가 붙는다.
 *   2) 받은 사람이 링크로 들어오면 recordReferralVisit → referralVisits/{uid} 에 '누른 시각, 그때 새 계정이었는지, 처음 보는 기기였는지'를 서버 시각으로 남긴다.
 *   3) 받은 사람이 사주를 넣고 로그인(앱 토스, 웹 카카오, 네이버, 구글, 애플)하면 completeReferral
 *      → 로그인 계정 하나당 평생 한 번(referrals/{신원 키}) 두 사람에게 운을 적립 대기(rewardGrants)로 넣는다.
 *   4) 받은 사람이 처음 결제하면 referralOnPurchase 가 초대한 사람에게 추가 보상을 넣는다.
 *   5) claimRewards 가 적립 대기를 한 번에 받아 간다(기기 잔액에 더한다, 클라 addRewardBalance).
 *
 *   어뷰징 방어
 *   - 보상은 로그인한 '진짜 한 사람'(토스 로그인 = 본인 확인된 토스 회원, 웹 소셜 로그인)에게만. 신원 키 하나당 평생 한 번.
 *   - 링크를 누를 때 이미 있던 계정, 이미 보던 기기는 '새 손님'이 아니다(기존 손님 끼리 주고받기 차단).
 *   - 자기 초대 차단(같은 uid, 같은 신원, 같은 기기).
 *   - 상한: 초대한 사람 한 달 monthlyCap 명, 평생 lifetimeCap 명. 서비스 전체 하루 globalDailyUn 운. 넘으면 backofficeAlerts 에 남긴다.
 *   - 금액과 상한은 config/referral 문서로 바꾼다(배포 없이). enabled:false 면 전부 멈춘다.
 *
 *   추적: referralCodes/{코드} 에 visits(들어온 새 손님), qualified(인정된 친구), purchased(결제한 친구), earnedUn(초대한 사람이 받은 운).
 *   달별 referralCodes/{코드}/months/{YYYY-MM}. 어드민 스크립트 scripts/ops/referral_report.cjs.
 *   모든 문서는 서버 전용(규칙에 없음 = 클라이언트 읽기, 쓰기 금지). 클라이언트는 이 함수들로만.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { randomBytes, createHash } from 'crypto';

const TOSS_MTLS_CERT = defineSecret('TOSS_MTLS_CERT');
const TOSS_MTLS_KEY = defineSecret('TOSS_MTLS_KEY');

interface ReferralConfig {
  enabled: boolean;
  /** 받은 사람(친구)에게 */
  inviteeUn: number;
  /** 초대한 사람에게, 친구 한 명이 인정될 때마다 */
  referrerUn: number;
  /** 친구가 처음 purchaseMinPaidUn(유료 운) 이상 충전하면 초대한 사람에게 더 주는 운 — 1운 충전으로 받아 가는 차익을 막으려고 4운 묶음부터 */
  purchaseBonusUn: number;
  purchaseMinPaidUn: number;
  /** 결제 보너스는 며칠 뒤 받을 수 있나 (환불 대비 보류) */
  purchaseHoldDays: number;
  /** 초대한 사람 한 명이 보상받는 친구 수 상한 */
  monthlyCap: number;
  lifetimeCap: number;
  /** 서비스 전체 하루 초대 보상 운 상한 (넘으면 지급 멈추고 경보) */
  globalDailyUn: number;
  /** 링크를 누른 뒤 며칠 안에 인정돼야 하나 */
  windowDays: number;
  /** '새 계정' 판정 여유(분): 계정이 링크를 누르기 이 시간 전보다 먼저 있었으면 기존 손님 */
  newSlackMin: number;
}
const DEFAULT_CFG: ReferralConfig = {
  enabled: true,
  // 2026-10-18 리서치(받는 사람 혜택이 더 데려온다, 결제 조건 보상이 남는다) 반영: 친구 3, 초대한 사람 2, 친구 첫 충전(4운 묶음 이상) 때 초대한 사람 5
  inviteeUn: 3,
  referrerUn: 2,
  purchaseBonusUn: 5,
  purchaseMinPaidUn: 3,
  purchaseHoldDays: 7,
  monthlyCap: 10,
  lifetimeCap: 50,
  globalDailyUn: 300,
  windowDays: 30,
  newSlackMin: 30,
};

const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SOCIAL = ['google.com', 'oidc.kakao', 'oidc.naver', 'apple.com'];
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const kstMonth = () => kstDay().slice(0, 7);
const db = () => admin.firestore();
const FV = admin.firestore.FieldValue;

async function loadCfg(): Promise<ReferralConfig> {
  try {
    const s = await db().doc('config/referral').get();
    return { ...DEFAULT_CFG, ...((s.data() as Partial<ReferralConfig>) || {}) };
  } catch {
    return DEFAULT_CFG;
  }
}
function newCode(): string {
  const b = randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ABC[b[i] % CODE_ABC.length];
  return s;
}
const validCode = (c: unknown): c is string => typeof c === 'string' && /^[A-Z2-9]{6}$/.test(c);
const validDevice = (d: unknown): d is string => typeof d === 'string' && /^[0-9a-f]{32,128}$/.test(d.trim().toLowerCase());
const hashOf = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24);
const clean = (v: unknown, max: number) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/** 로그인한 진짜 한 사람의 신원 키 (없으면 null = 익명) */
async function identityOf(uid: string): Promise<{ key: string; kind: 'toss' | 'social'; tossKey?: string } | null> {
  if (uid.startsWith('toss_')) return { key: `toss:${uid.slice(5)}`, kind: 'toss', tossKey: uid.slice(5) };
  // 앱 익명 계정이 토스 회원 확인을 마친 경우 (verifyTossIdentity, 계정은 그대로)
  try {
    const t = await db().doc(`referralTossIds/${uid}`).get();
    const k = t.exists ? String(t.data()?.userKey || '') : '';
    if (k) return { key: `toss:${k}`, kind: 'toss', tossKey: k };
  } catch { /* 없음 */ }
  try {
    const u = await admin.auth().getUser(uid);
    const p = u.providerData.find((x) => SOCIAL.includes(x.providerId));
    if (p) return { key: `${p.providerId}:${p.uid}`, kind: 'social' };
  } catch { /* 아래로 */ }
  // 웹 네이버 로그인(2026-10-19)은 맞춤 토큰이라 providerData 가 비어 있다 → users.naverId (auth/naverAuth.ts)
  try {
    const d = await db().doc(`users/${uid}`).get();
    const nid = d.exists ? String((d.data() as any)?.naverId || '') : '';
    return nid ? { key: `naver:${nid}`, kind: 'social' } : null;
  } catch {
    return null;
  }
}
async function accountCreatedMs(uid: string): Promise<number> {
  try {
    const u = await admin.auth().getUser(uid);
    return Date.parse(u.metadata.creationTime) || 0;
  } catch {
    return 0;
  }
}
function grant(tx: admin.firestore.Transaction, uid: string, amount: number, kind: string, code: string, extra: Record<string, unknown> = {}) {
  const ref = db().collection(`rewardGrants/${uid}/items`).doc();
  tx.set(ref, { amount, kind, code, claimed: false, at: FV.serverTimestamp(), ...extra });
}
/** 결제 장부 문서가 환불, 부분 환불 검토, 취소 상태인가 (payment/autoGrantRules.ledgerRowOf 의 refunded 와 같은 기준) */
function paymentRefunded(d: Record<string, any> | undefined): boolean {
  if (!d) return false;
  return ['refunded', 'partial_refund_review', 'cancelled'].includes(String(d.status || '')) || !!d.refundedAt || !!d.portoneCancelledAt;
}
function alert(kind: string, detail: Record<string, unknown>) {
  db().collection('backofficeAlerts').add({ kind, ...detail, at: FV.serverTimestamp(), source: 'referral' }).catch(() => undefined);
}

/** 내 초대 코드와 성과 */
export const getMyReferral = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const cfg = await loadCfg();
    const deviceId = validDevice(request.data?.deviceId) ? String(request.data.deviceId).trim().toLowerCase() : '';
    const name = clean(request.data?.name, 12);
    const idxRef = db().doc(`referralByUid/${uid}`);
    let code = '';
    const idx = await idxRef.get();
    if (idx.exists) code = String(idx.data()?.code || '');
    // 앱에서 익명 uid 가 바뀐 경우: 같은 기기(기기 여권에 두 uid 가 함께 있음)의 예전 코드를 이어받는다
    if (!code && deviceId) {
      const old = await db().collection('referralCodes').where('deviceId', '==', deviceId).limit(1).get();
      if (!old.empty) {
        const prevUid = String(old.docs[0].data().uid || '');
        const dev = await db().doc(`devices/${deviceId}`).get();
        const uids = Object.keys((dev.data()?.uids || {}) as Record<string, unknown>);
        if (prevUid && uids.includes(prevUid) && uids.includes(uid)) {
          code = old.docs[0].id;
          await old.docs[0].ref.update({ uid, prevUids: FV.arrayUnion(prevUid), movedAt: FV.serverTimestamp() });
          await idxRef.set({ code, at: FV.serverTimestamp() });
        }
      }
    }
    if (!code) {
      for (let i = 0; i < 6 && !code; i++) {
        const c = newCode();
        try {
          await db().doc(`referralCodes/${c}`).create({
            uid, deviceId: deviceId || null, name: name || '', createdAt: FV.serverTimestamp(),
            visits: 0, qualified: 0, purchased: 0, earnedUn: 0,
          });
          code = c;
        } catch { /* 같은 코드가 있으면 다시 */ }
      }
      if (!code) throw new HttpsError('internal', '잠시 뒤 다시 시도해 주세요');
      await idxRef.set({ code, at: FV.serverTimestamp() });
    }
    const snap = await db().doc(`referralCodes/${code}`).get();
    const d = snap.data() || {};
    if (name && d.name !== name) await snap.ref.update({ name }).catch(() => undefined);
    const month = await db().doc(`referralCodes/${code}/months/${kstMonth()}`).get();
    return {
      code,
      enabled: cfg.enabled,
      stats: {
        visits: Number(d.visits) || 0,
        qualified: Number(d.qualified) || 0,
        purchased: Number(d.purchased) || 0,
        earnedUn: Number(d.earnedUn) || 0,
        monthQualified: Number(month.data()?.qualified) || 0,
      },
      rules: {
        inviteeUn: cfg.inviteeUn, referrerUn: cfg.referrerUn, purchaseBonusUn: cfg.purchaseBonusUn,
        purchaseMinTotalUn: cfg.purchaseMinPaidUn === 3 ? 4 : cfg.purchaseMinPaidUn, purchaseHoldDays: cfg.purchaseHoldDays, monthlyCap: cfg.monthlyCap, lifetimeCap: cfg.lifetimeCap,
      },
    };
  },
);

/** 초대 링크로 들어온 사람 — 누른 시각과 새 손님 여부를 서버 시각으로 남긴다 (처음 누른 링크만) */
export const recordReferralVisit = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const code = String(request.data?.code || '').toUpperCase();
    if (!validCode(code)) return { ok: false, reason: 'bad_code' };
    const cfg = await loadCfg();
    const codeRef = db().doc(`referralCodes/${code}`);
    const c = await codeRef.get();
    if (!c.exists) return { ok: false, reason: 'bad_code' };
    const cd = c.data() || {};
    const referrerName = String(cd.name || '');
    if (cd.uid === uid) return { ok: false, reason: 'self', referrerName };
    const visitRef = db().doc(`referralVisits/${uid}`);
    const prev = await visitRef.get();
    if (prev.exists) return { ok: true, first: false, isNew: !!prev.data()?.isNew && !prev.data()?.completedBy, referrerName: prev.data()?.code === code ? referrerName : '', inviteeUn: cfg.inviteeUn };

    const now = Date.now();
    // 링크로 들어오면 30분, 코드를 직접 넣으면 하루 (처음 쓰는 날 넣으면 인정)
    const slack = (request.data?.manual ? 1440 : cfg.newSlackMin) * 60e3;
    const createdMs = await accountCreatedMs(uid);
    const accountNew = createdMs > 0 && createdMs >= now - slack;
    const deviceId = validDevice(request.data?.deviceId) ? String(request.data.deviceId).trim().toLowerCase() : '';
    let deviceNew: boolean | null = null;
    if (deviceId) {
      if (cd.deviceId && cd.deviceId === deviceId) return { ok: false, reason: 'self', referrerName };
      // 기기 여권 devices/{deviceId}.uids 는 {uid: 등록 시각} 맵 — 가장 이른 등록이 이 기기를 처음 본 때
      const dev = await db().doc(`devices/${deviceId}`).get();
      const times = Object.values((dev.data()?.uids || {}) as Record<string, any>).map((t) => t?.toMillis?.() || 0).filter((x) => x > 0);
      const first = times.length ? Math.min(...times) : 0;
      deviceNew = !dev.exists || first === 0 || first >= now - slack;
    }
    const ipRaw = String(request.rawRequest?.headers?.['x-forwarded-for'] || request.rawRequest?.ip || '').split(',')[0].trim();
    const isNew = accountNew && deviceNew !== false;
    await visitRef.create({
      code, referrerUid: cd.uid || '', at: FV.serverTimestamp(), atMs: now,
      accountNew, deviceNew, isNew, plat: clean(request.data?.plat, 8) || '', deviceHash: deviceId ? hashOf(deviceId) : null,
      ipHash: ipRaw ? hashOf(ipRaw) : null, src: clean(request.data?.src, 24) || '', manual: !!request.data?.manual,
    }).catch(() => undefined);
    if (isNew) {
      await codeRef.update({ visits: FV.increment(1), lastVisitAt: FV.serverTimestamp() }).catch(() => undefined);
      await db().doc(`referralCodes/${code}/months/${kstMonth()}`).set({ visits: FV.increment(1) }, { merge: true }).catch(() => undefined);
    }
    return { ok: true, first: true, isNew, referrerName, inviteeUn: cfg.inviteeUn, referrerUn: cfg.referrerUn };
  },
);

/** 받은 사람이 사주를 넣고 로그인한 뒤 — 두 사람 보상 (신원 하나당 평생 한 번) */
export const completeReferral = onCall(
  { timeoutSeconds: 20, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const cfg = await loadCfg();
    if (!cfg.enabled) return { status: 'disabled' };

    // 1) 링크를 누른 기록 — 지금 계정, 또는 토스 로그인 전 익명 계정(소유 증명 토큰)
    let visitUid = uid;
    let visit = await db().doc(`referralVisits/${uid}`).get();
    if (!visit.exists && typeof request.data?.anonIdToken === 'string') {
      try {
        const dec = await admin.auth().verifyIdToken(request.data.anonIdToken, true);
        if (dec.firebase?.sign_in_provider === 'anonymous' && dec.uid !== uid) {
          visitUid = dec.uid;
          visit = await db().doc(`referralVisits/${dec.uid}`).get();
        }
      } catch { /* 토큰이 틀리면 기록 없음으로 */ }
    }
    if (!visit.exists) return { status: 'no_visit' };
    const v = visit.data() || {};
    if (v.completedBy) return { status: 'used' };
    if (!v.isNew) return { status: 'not_new' };
    if (Date.now() - (Number(v.atMs) || 0) > cfg.windowDays * 864e5) return { status: 'expired' };

    // 2) 로그인한 진짜 한 사람
    const id = await identityOf(uid);
    if (!id) return { status: 'need_login' };
    if (id.kind === 'toss' && id.tossKey) {
      // 예전부터 토스 로그인하던 손님(users/toss_{키} 가 링크를 누르기 전부터 있음)은 기존 손님
      const u = await db().doc(`users/toss_${id.tossKey}`).get();
      const created = u.data()?.createdAt?.toMillis?.() || 0;
      if (created && created < (Number(v.atMs) || 0) - cfg.newSlackMin * 60e3) return { status: 'not_new' };
    }

    // 3) 사주를 넣었는지 (서버 미러 state/profiles)
    let hasSaju = false;
    for (const u of [uid, visitUid]) {
      const p = await db().doc(`users/${u}/state/profiles`).get();
      const items: any[] = Array.isArray(p.data()?.items) ? p.data()!.items : [];
      if (items.some((x) => Number(x?.input?.birthYear) > 1900)) { hasSaju = true; break; }
    }
    if (!hasSaju) return { status: 'no_saju' };

    const code = String(v.code || '');
    const codeRef = db().doc(`referralCodes/${code}`);
    const monthRef = db().doc(`referralCodes/${code}/months/${kstMonth()}`);
    const dayRef = db().doc(`referralDaily/${kstDay()}`);
    // 문서 이름은 신원 키의 해시 (토스 키, 소셜 계정 번호를 그대로 남기지 않는다)
    const idRef = db().doc(`referrals/${hashOf(id.key)}`);

    const visitRef = db().doc(`referralVisits/${visitUid}`);
    const result = await db().runTransaction(async (tx) => {
      const [idSnap, codeSnap, monthSnap, daySnap, visitSnap] = await Promise.all([tx.get(idRef), tx.get(codeRef), tx.get(monthRef), tx.get(dayRef), tx.get(visitRef)]);
      if (idSnap.exists || visitSnap.data()?.completedBy) return { status: 'used' as const };
      if (!codeSnap.exists) return { status: 'no_visit' as const };
      const cd = codeSnap.data() || {};
      const referrerUid = String(cd.uid || '');
      if (!referrerUid || referrerUid === uid || referrerUid === visitUid) return { status: 'self' as const };
      const refId = await identityOf(referrerUid);
      if (refId && refId.key === id.key) return { status: 'self' as const };

      const dayUn = Number(daySnap.data()?.un) || 0;
      const needed = cfg.inviteeUn + cfg.referrerUn;
      if (dayUn + needed > cfg.globalDailyUn) {
        alert('referral_global_cap', { day: kstDay(), dayUn, cap: cfg.globalDailyUn });
        return { status: 'paused' as const };
      }
      const monthQ = Number(monthSnap.data()?.qualified) || 0;
      const lifeQ = Number(cd.qualified) || 0;
      const referrerCapped = monthQ >= cfg.monthlyCap || lifeQ >= cfg.lifetimeCap;

      tx.create(idRef, { code, referrerUid, inviteeUid: uid, visitUid, kind: id.kind, at: FV.serverTimestamp(), referrerCapped });
      tx.update(visitRef, { completedBy: uid, completedAt: FV.serverTimestamp() });
      grant(tx, uid, cfg.inviteeUn, 'invitee', code);
      let paid = cfg.inviteeUn;
      if (!referrerCapped) {
        grant(tx, referrerUid, cfg.referrerUn, 'referrer', code, { friendKind: id.kind });
        paid += cfg.referrerUn;
        tx.update(codeRef, { qualified: FV.increment(1), earnedUn: FV.increment(cfg.referrerUn), lastQualifiedAt: FV.serverTimestamp() });
        tx.set(monthRef, { qualified: FV.increment(1), earnedUn: FV.increment(cfg.referrerUn) }, { merge: true });
      } else {
        tx.update(codeRef, { cappedFriends: FV.increment(1) });
      }
      tx.set(dayRef, { un: FV.increment(paid), qualified: FV.increment(1) }, { merge: true });
      return { status: 'granted' as const, inviteeUn: cfg.inviteeUn, referrerCapped, referrerName: String(cd.name || '') };
    });
    return result;
  },
);

/**
 * 앱: 토스 회원 확인 (계정은 바꾸지 않는다) — appLogin() 의 authorizationCode 로 서버가 토스에 물어 userKey 를 받는다.
 *   referralTossIds/{uid} = 이 익명 계정은 토스 회원 {userKey} 가 쓰고 있다. 한 토스 회원이 여러 익명 계정에 붙어도
 *   보상은 referrals/toss:{userKey} 한 번뿐이다.
 */
export const verifyTossIdentity = onCall(
  { secrets: [TOSS_MTLS_CERT, TOSS_MTLS_KEY], timeoutSeconds: 20, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const code = String(request.data?.authorizationCode || '');
    if (!code) throw new HttpsError('invalid-argument', '토스 로그인을 다시 눌러 주세요');
    try {
      const { fetchTossUserKey } = await import('../auth/tossAuth');
      const userKey = await fetchTossUserKey(code, TOSS_MTLS_CERT.value(), TOSS_MTLS_KEY.value());
      await db().doc(`referralTossIds/${uid}`).set({ userKey: String(userKey), at: FV.serverTimestamp() }, { merge: true });
      return { ok: true };
    } catch (e: any) {
      console.warn('[verifyTossIdentity]', e?.message || e);
      throw new HttpsError('internal', '토스 확인에 실패했어요. 잠시 뒤 다시 눌러 주세요');
    }
  },
);

/** 적립 대기 운을 받아 간다 — 앱을 열 때와 돌아올 때. 같은 기기의 예전 익명 uid 몫도 (기기 여권) */
export const claimRewards = onCall(
  { timeoutSeconds: 20, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const uids = [uid];
    const deviceId = validDevice(request.data?.deviceId) ? String(request.data.deviceId).trim().toLowerCase() : '';
    if (deviceId) {
      const dev = await db().doc(`devices/${deviceId}`).get();
      const list = Object.keys((dev.data()?.uids || {}) as Record<string, unknown>);
      if (list.includes(uid)) list.filter((x) => x !== uid).slice(-10).forEach((x) => uids.push(x));
    }
    let total = 0;
    const kinds: Record<string, number> = {};
    for (const u of uids) {
      const q = await db().collection(`rewardGrants/${u}/items`).where('claimed', '==', false).limit(30).get();
      for (const doc of q.docs) {
        if (total >= 100) break; // 한 번에 100운까지 (안전장치)
        if ((Number(doc.data()?.availableAtMs) || 0) > Date.now()) continue; // 보류 중 (결제 보너스 7일)
        let got = 0;
        try {
          got = await db().runTransaction(async (tx) => {
            const s = await tx.get(doc.ref);
            if (!s.exists || s.data()?.claimed) return 0;
            const g = s.data() || {};
            // 10-24 검수 — 친구 첫 결제 보상은 그 결제가 환불, 취소됐으면 주지 않고 닫는다 (결제번호가 남은 적립만, referralOnPurchase)
            if (g.kind === 'purchase' && typeof g.payerUid === 'string' && g.payerUid && typeof g.paymentId === 'string' && g.paymentId) {
              const pay = await tx.get(db().doc(`users/${g.payerUid}/payments/${g.paymentId}`));
              if (pay.exists && paymentRefunded(pay.data())) {
                const bonus = Math.max(0, Number(g.amount) || 0);
                tx.update(doc.ref, { claimed: true, revoked: 'refund', revokedAt: FV.serverTimestamp() });
                if (g.code) tx.set(db().doc(`referralCodes/${g.code}`), { purchased: FV.increment(-1), earnedUn: FV.increment(-bonus), purchaseRevoked: FV.increment(1) }, { merge: true });
                return 0;
              }
            }
            const amt = Math.max(0, Math.min(50, Number(g.amount) || 0));
            tx.update(doc.ref, { claimed: true, claimedAt: FV.serverTimestamp(), claimedByUid: uid });
            return amt;
          });
        } catch (e: any) {
          console.warn('[claimRewards] 적립 하나 건너뜀(다음에 다시)', u.slice(0, 8), e?.message || e);
          continue;
        }
        if (got > 0) {
          total += got;
          const k = String(doc.data()?.kind || 'etc');
          kinds[k] = (kinds[k] || 0) + got;
        }
      }
    }
    // 로그인한 계정(소셜 등, 토큰이 익명이 아님)은 서버가 users/{uid}.balance 에서 운을 깎는다(computeBalanceDeduction).
    //   기기 잔액에만 더하면 받은 운을 쓸 때 '운이 부족합니다'가 난다 → 서버 장부에도 같이 넣는다. 익명은 서버가 깎지 않으니 넣지 않는다
    //   (넣으면 서버가 기기보다 커져 syncFromCloud 가 한 번 더 채운다).
    const anon = String(request.auth?.token?.firebase?.sign_in_provider || '').includes('anonymous');
    if (total > 0 && !anon) {
      try {
        const userRef = db().doc(`users/${uid}`);
        await db().runTransaction(async (tx) => {
          const u = await tx.get(userRef);
          const bal = u.data()?.balance;
          if (typeof bal === 'number') tx.set(userRef, { balance: { paid: bal, bonus: 0, reward: total } }, { merge: true });
          else tx.set(userRef, { balance: { reward: FV.increment(total) } }, { merge: true });
        });
      } catch (e: any) {
        console.error('[claimRewards] 서버 잔액 반영 실패', uid, total, e?.message);
        alert('referral_server_balance_fail', { uid, total });
      }
    }
    return { amount: total, kinds, serverCredited: !anon };
  },
);

/**
 * 결제 확정 뒤 (grantPurchase, confirmPortonePayment) — 받은 사람의 첫 결제면 초대한 사람에게 추가 보상.
 *   돈을 낸 결제라 계정을 찍어 내 얻을 수 없다. 그래도 새 손님으로 들어온 기록(isNew)과 상한은 본다. 실패해도 결제에 영향 없음.
 *   10-24 검수 — 결제번호(ref.paymentId)를 적립과 referralPurchases 에 남긴다. 받을 때(claimRewards) 그 결제가 환불, 취소됐으면 주지 않는다
 *   (보류 7일과 환불 기한 7일이 같아 보류만으로는 환불을 막지 못했다). 결제번호가 없는 옛 적립은 예전처럼 준다.
 */
export async function referralOnPurchase(uid: string, paidUn: number, totalUn: number, ref?: { paymentId?: string }): Promise<void> {
  try {
    if (!uid || uid === 'anonymous' || !(paidUn > 0)) return;
    const visit = await db().doc(`referralVisits/${uid}`).get();
    if (!visit.exists) return;
    const v = visit.data() || {};
    if (!v.isNew || !v.code) return;
    const cfg = await loadCfg();
    if (!cfg.enabled) return;
    if (Date.now() - (Number(v.atMs) || 0) > 90 * 864e5) return; // 링크를 누른 뒤 90일 안 첫 결제만
    const code = String(v.code);
    const codeRef = db().doc(`referralCodes/${code}`);
    const monthRef = db().doc(`referralCodes/${code}/months/${kstMonth()}`);
    const dayRef = db().doc(`referralDaily/${kstDay()}`);
    const once = db().doc(`referralPurchases/${uid}`);
    const bonus = cfg.purchaseBonusUn;
    if (paidUn < cfg.purchaseMinPaidUn) return; // 1운 충전은 보너스 없음. 나중에 4운 묶음 이상을 처음 충전하면 그때 준다
    const paymentId = typeof ref?.paymentId === 'string' && ref.paymentId ? ref.paymentId.slice(0, 120) : null;
    await db().runTransaction(async (tx) => {
      const [o, c, m, d] = await Promise.all([tx.get(once), tx.get(codeRef), tx.get(monthRef), tx.get(dayRef)]);
      if (o.exists || !c.exists) return;
      const referrerUid = String(c.data()?.uid || '');
      tx.create(once, { code, referrerUid, paidUn, totalUn, bonus, paymentId, at: FV.serverTimestamp() });
      if (!referrerUid || referrerUid === uid) return;
      if ((Number(m.data()?.purchased) || 0) >= cfg.monthlyCap) return;
      if ((Number(d.data()?.un) || 0) + bonus > cfg.globalDailyUn) { alert('referral_global_cap', { day: kstDay(), at: 'purchase' }); return; }
      grant(tx, referrerUid, bonus, 'purchase', code, { paidUn, availableAtMs: Date.now() + cfg.purchaseHoldDays * 864e5, ...(paymentId ? { payerUid: uid, paymentId } : {}) });
      tx.update(codeRef, { purchased: FV.increment(1), earnedUn: FV.increment(bonus) });
      tx.set(monthRef, { purchased: FV.increment(1), earnedUn: FV.increment(bonus) }, { merge: true });
      tx.set(dayRef, { un: FV.increment(bonus), purchased: FV.increment(1) }, { merge: true });
    });
  } catch (e: any) {
    console.warn('[referralOnPurchase] 건너뜀', e?.message || e);
  }
}

/** 탈퇴 파기 — 이 사람의 초대 코드, 누른 기록, 토스 회원 확인, 받지 않은 적립. 인정 기록(referrals, 해시 이름)은 다시 받기 방지로 남기고 uid 만 지운다 */
export async function purgeReferralOf(uid: string): Promise<void> {
  const d = db();
  const idx = await d.doc(`referralByUid/${uid}`).get();
  const code = idx.exists ? String(idx.data()?.code || '') : '';
  if (code) await d.doc(`referralCodes/${code}`).set({ uid: '', name: '', deviceId: null, purgedAt: FV.serverTimestamp() }, { merge: true });
  await Promise.all([
    d.doc(`referralByUid/${uid}`).delete(),
    d.doc(`referralVisits/${uid}`).delete(),
    d.doc(`referralTossIds/${uid}`).delete(),
  ]);
  for (;;) {
    const q = await d.collection(`rewardGrants/${uid}/items`).limit(300).get();
    if (q.empty) break;
    const b = d.batch();
    q.docs.forEach((x) => b.delete(x.ref));
    await b.commit();
  }
  for (const f of ['inviteeUid', 'referrerUid']) {
    const q = await d.collection('referrals').where(f, '==', uid).limit(300).get();
    if (q.empty) continue;
    const b = d.batch();
    q.docs.forEach((x) => b.update(x.ref, { [f]: '' }));
    await b.commit();
  }
}

/**
 * 기기에서 준 출석 운을 로그인 계정의 서버 장부에도 (2026-10-18)
 *   로그인한 계정은 서버가 users/{uid}.balance 에서 깎는데, 출석 0.1운과 3일 연속 1운은 기기 잔액에만 들어가
 *   그 운으로 콘텐츠를 열면 '운이 부족합니다'가 났다. 서버가 직접 확인한 만큼만 넣는다.
 *   - daily: 하루(KST) 한 번 0.1운, 달마다 31번까지
 *   - streak3: 서버 출석 기록(users/{uid}/attendance/{날짜})으로 오늘 포함 3일 연속이고, 앞 이틀에 받은 적이 없을 때 1운
 *   익명 계정은 서버가 깎지 않으니 넣지 않는다.
 */
export const creditLocalReward = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    if (String(request.auth?.token?.firebase?.sign_in_provider || '').includes('anonymous')) return { ok: false, reason: 'anon' };
    const kind = String(request.data?.kind || '');
    const day = kstDay();
    const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
    const userRef = db().doc(`users/${uid}`);
    let amount = 0;
    let key = '';
    if (kind === 'daily') { amount = 0.1; key = `daily_${day}`; }
    else if (kind === 'streak3') {
      const days = [day, addDays(day, -1), addDays(day, -2)];
      const snaps = await Promise.all(days.map((d) => db().doc(`users/${uid}/attendance/${d}`).get()));
      if (!snaps.every((x) => x.exists)) return { ok: false, reason: 'not_yet' };
      const prev = await Promise.all([1, 2].map((n) => db().doc(`users/${uid}/rewardClaims/streak3_${addDays(day, -n)}`).get()));
      if (prev.some((x) => x.exists)) return { ok: false, reason: 'too_soon' };
      amount = 1; key = `streak3_${day}`;
    } else return { ok: false, reason: 'bad_kind' };
    const claimRef = db().doc(`users/${uid}/rewardClaims/${key}`);
    const monthRef = db().doc(`users/${uid}/rewardClaims/dailyMonth_${day.slice(0, 7)}`);
    const r = await db().runTransaction(async (tx) => {
      const [c, m, u] = await Promise.all([tx.get(claimRef), tx.get(monthRef), tx.get(userRef)]);
      if (c.exists) return { ok: false, reason: 'already' };
      if (kind === 'daily' && (Number(m.data()?.n) || 0) >= 31) return { ok: false, reason: 'month_cap' };
      tx.create(claimRef, { kind, amount, at: FV.serverTimestamp(), source: 'local_reward_mirror' });
      if (kind === 'daily') tx.set(monthRef, { n: FV.increment(1) }, { merge: true });
      const bal = u.data()?.balance;
      if (typeof bal === 'number') tx.set(userRef, { balance: { paid: bal, bonus: 0, reward: amount } }, { merge: true });
      else tx.set(userRef, { balance: { reward: FV.increment(amount) } }, { merge: true });
      return { ok: true, amount };
    });
    return r;
  },
);

