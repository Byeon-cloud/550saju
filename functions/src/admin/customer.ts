/**
 * adminLookup — 고객 찾기 (2026-10-19, 오너 전용)
 *   CS 문의에 온 무엇이든(회원 ID, 토스 기기 ID, 이메일, 결제번호, 초대 코드, 토스 회원 번호) 넣으면
 *   그 사람의 계정 카드를 돌려준다: 웹인지 앱인지, 로그인 방식, 결제와 환불, 쓴 운과 풀이, AI 실패, 보상 내역, 최근 행동.
 *   운을 넣을지, 얼마를 넣을지는 이 카드의 사실을 보고 정한다(보상 기준은 관리자 화면 'CS 운 넣기' 설명).
 *   읽기만 한다. 결제와 기록을 바꾸지 않는다.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertOwner } from './owner';
import { kstDayOf } from './stats';

const tsMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'string') return Date.parse(v) || 0;
  if (typeof v === 'number') return v;
  return 0;
};

type Kind = 'uid' | 'device' | 'email' | 'payment' | 'invite' | 'tossKey' | 'unknown';
function detect(q: string): Kind {
  if (q.includes('@')) return 'email';
  if (/^[0-9a-f]{32,128}$/i.test(q)) return 'device';
  if (/^[A-Z2-9]{6}$/.test(q)) return 'invite';
  if (/^toss_/.test(q)) return 'uid';
  if (/^\d{4,20}$/.test(q)) return 'tossKey';
  if (/^[A-Za-z0-9]{20,40}$/.test(q)) return 'uid';
  if (/[_-]/.test(q) && q.length >= 12) return 'payment';
  return 'unknown';
}

async function resolveUids(q: string, kind: Kind): Promise<{ uids: string[]; devices: string[]; note: string }> {
  const db = admin.firestore();
  const uids = new Set<string>();
  const devices = new Set<string>();
  let note = '';
  if (kind === 'uid') uids.add(q);
  if (kind === 'tossKey') uids.add(`toss_${q}`);
  if (kind === 'device') {
    const dev = q.toLowerCase();
    devices.add(dev);
    const s = await db.collection('devices').doc(dev).get();
    if (s.exists) {
      const d = s.data() as any;
      const list = Object.entries(d.uids || {}).sort((a: any, b: any) => tsMs(b[1]) - tsMs(a[1])).map(([u]) => u);
      if (d.lastUid) uids.add(String(d.lastUid));
      list.slice(0, 6).forEach((u) => uids.add(u));
      if (list.length > 1) note = `이 기기에 계정이 ${list.length}개 있었어요(저장소가 비워질 때마다 새 계정). 최근 것부터 보여 줘요.`;
    } else note = '기기 등록부에 없는 기기예요(아주 예전 버전이거나 웹). 보상은 이 기기 ID 로 넣어도 앱을 열면 받아요.';
  }
  if (kind === 'email') {
    try { const u = await admin.auth().getUserByEmail(q.toLowerCase()); uids.add(u.uid); } catch { /* 로그인 계정 아님 */ }
    for (const col of ['emailLeads', 'dailyMailSubs']) {
      const s = await db.collection(col).where('email', '==', q.toLowerCase()).limit(5).get().catch(() => null);
      s?.docs.forEach((d) => uids.add(d.id));
    }
  }
  if (kind === 'invite') {
    const s = await db.collection('referralCodes').doc(q).get();
    if (s.exists && (s.data() as any).uid) uids.add(String((s.data() as any).uid));
  }
  if (kind === 'payment' || kind === 'unknown') {
    const s = await db.collectionGroup('payments').where('orderId', '==', q).limit(5).get().catch(() => null);
    s?.docs.forEach((d) => { const u = d.ref.parent.parent?.id; if (u) uids.add(u); });
    if (!uids.size && kind === 'payment') {
      // 포트원 결제번호는 '회원 ID 앞 8자_묶음_시각_난수' — 앞 8자로 찾지는 않는다(여러 명이 겹칠 수 있음). 안내만.
      note = '이 결제번호로 된 결제 기록이 없어요. 결제창만 열고 끝났거나, 결제 확인 전에 끊겼을 수 있어요.';
    }
  }
  return { uids: [...uids].slice(0, 6), devices: [...devices], note };
}

async function card(uid: string) {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const [authUser, userSnap, mirror, pays, lib, reps, fails, evs, refBy, lead, mailSub, compUid, devs, compLog] = await Promise.all([
    admin.auth().getUser(uid).catch(() => null),
    userRef.get(),
    userRef.collection('state').doc('balance').get().catch(() => null),
    userRef.collection('payments').get().catch(() => null),
    userRef.collection('reports').select('contentType', 'type', 'spentUn', 'createdAt', 'name', 'topicId').get().catch(() => null),
    db.collection('reports').where('uid', '==', uid).select('type', 'topicId', 'generatedAt', 'recovery', 'aiModel').limit(200).get().catch(() => null),
    db.collection('aiFailures').where('uid', '==', uid).limit(30).get().catch(() => null),
    // 최근 것부터 (색인 analytics uid+ts). 색인이 아직 없으면 순서 없이 400건
    db.collection('analytics').where('uid', '==', uid).orderBy('ts', 'desc').select('name', 'day', 'ts', 'plat', 'props', 'utm', 'did').limit(300).get()
      .catch(() => db.collection('analytics').where('uid', '==', uid).select('name', 'day', 'ts', 'plat', 'props', 'utm', 'did').limit(400).get().catch(() => null)),
    db.collection('referralByUid').doc(uid).get().catch(() => null),
    db.collection('emailLeads').doc(uid).get().catch(() => null),
    db.collection('dailyMailSubs').doc(uid).get().catch(() => null),
    db.collection('compensations').doc(uid).get().catch(() => null),
    db.collection('devices').where('lastUid', '==', uid).limit(5).get().catch(() => null),
    db.collection('compensationLog').where('uids', 'array-contains', uid).limit(30).get().catch(() => null),
  ]);
  const u = userSnap.exists ? (userSnap.data() as any) : null;
  const providers = (authUser?.providerData || []).map((p) => p.providerId);
  const isToss = uid.startsWith('toss_');
  const login = isToss ? '토스 로그인' : providers.length ? providers.map((p) => (p === 'google.com' ? '구글' : p === 'oidc.kakao' ? '카카오' : p === 'oidc.naver' ? '네이버' : p)).join(', ') : '로그인 안 함(익명)';

  const evRows = (evs?.docs || []).map((d) => d.data() as any).sort((a, b) => tsMs(b.ts) - tsMs(a.ts));
  const plats = new Set(evRows.map((e) => (e.plat === 'ait' ? '앱' : '웹')));
  const firstUtm = [...evRows].reverse().find((e) => e.utm?.source)?.utm || null;
  const deviceKeys = new Set<string>((devs?.docs || []).map((d) => d.id));
  // 보상은 기기 ID 로 넣었을 수도 있다 — 이 계정의 기기들 장부도 본다
  const compDev = await Promise.all([...deviceKeys].map((k) => db.collection('compensations').doc(k).get().catch(() => null)));
  const comps = [compUid, ...compDev].filter((s) => s && s.exists).map((s) => {
    const c = s!.data() as any;
    return { key: s!.id, amount: Number(c.amount) || 0, claimed: !!c.claimed, note: c.note || '', reason: c.reason || '', at: tsMs(c.updatedAt) || tsMs(c.createdAt), claimedAt: tsMs(c.claimedAt) };
  });

  const payments = (pays?.docs || []).map((d) => {
    const p = d.data() as any;
    return {
      id: d.id, plat: p.pgProvider === 'iap' ? '앱' : '웹', amount: Number(p.amount) || 0, status: String(p.status || ''),
      un: (Number(p.paidUn) || 0) + (Number(p.bonusUn) || 0), at: tsMs(p.confirmedAt) || tsMs(p.createdAt),
      refundedAt: tsMs(p.refundedAt), recovered: !!p.recoveredFromIapHistory, fail: String(p.failReason || p.reconcileNote || '').slice(0, 120),
    };
  }).sort((a, b) => b.at - a.at);

  const library = (lib?.docs || []).map((d) => {
    const r = d.data() as any;
    return { id: d.id, type: String(r.contentType || r.type || ''), topic: r.topicId || '', un: Number(r.spentUn) || 0, at: tsMs(r.createdAt), name: String(r.name || '').slice(0, 12) };
  }).sort((a, b) => b.at - a.at).slice(0, 40);
  const generated = (reps?.docs || []).map((d) => {
    const r = d.data() as any;
    return { id: d.id, type: String(r.type || ''), topic: r.topicId || '', at: tsMs(r.generatedAt), recovery: !!r.recovery };
  }).sort((a, b) => b.at - a.at).slice(0, 40);
  const aiFails = (fails?.docs || []).map((d) => {
    const f = d.data() as any;
    return { day: f.day, type: f.type, stage: f.stage, message: String(f.message || '').slice(0, 160) };
  });
  const bal = mirror?.exists ? (mirror.data() as any) : null;
  const ref = refBy?.exists ? (refBy.data() as any) : null;
  return {
    uid,
    login,
    email: authUser?.email || (lead?.exists ? (lead.data() as any).email : '') || (mailSub?.exists ? (mailSub.data() as any).email : '') || '',
    createdAt: tsMs(authUser?.metadata?.creationTime) || tsMs(u?.createdAt),
    lastSignInAt: tsMs(authUser?.metadata?.lastSignInTime),
    lastSeenDay: evRows[0]?.day || '',
    plats: [...plats],
    firstSource: firstUtm ? `${firstUtm.source}${firstUtm.medium ? ` / ${firstUtm.medium}` : ''}${firstUtm.campaign ? ` / ${firstUtm.campaign}` : ''}` : '',
    status: u?.status || '',
    serverTotals: u ? { charged: Number(u.totalCharged) || 0, spent: Number(u.totalSpent) || 0 } : null,
    deviceBalance: bal ? { paid: Number(bal.paid) || 0, bonus: Number(bal.bonus) || 0, reward: Number(bal.reward) || 0, at: tsMs(bal.updatedAt) } : null,
    devices: [...deviceKeys],
    payments,
    library,
    generated,
    aiFails,
    compensations: comps,
    grantLog: (compLog?.docs || []).map((d) => { const c = d.data() as any; return { at: tsMs(c.at), amount: Number(c.amount) || 0, reason: c.reason || '', note: c.note || '', target: c.target || '' }; }).sort((a, b) => b.at - a.at),
    referralCode: ref?.code || '',
    recent: evRows.slice(0, 30).map((e) => ({ day: e.day, at: tsMs(e.ts), name: e.name, plat: e.plat === 'ait' ? '앱' : '웹', detail: String(e.props?.type || e.props?.page_path || e.props?.label || e.props?.amount || '').slice(0, 40) })),
  };
}

export const adminLookup = onCall(
  { timeoutSeconds: 60, memory: '512MiB', cors: true },
  async (request) => {
    assertOwner(request);
    let q = String(request.data?.q || '').trim();
    // 메일 제목을 통째로 붙여 넣어도 된다: '사주500 문의 [회원ID:xxxx]'
    const m = q.match(/회원\s*ID\s*[:：]\s*([A-Za-z0-9_-]+)/);
    if (m) q = m[1];
    if (!q || q.length > 200) throw new HttpsError('invalid-argument', '찾을 값을 넣어 주세요');
    const kind = detect(q);
    const { uids, devices, note } = await resolveUids(q, kind);
    const cards: Awaited<ReturnType<typeof card>>[] = [];
    for (const uid of uids) {
      // 없는 회원 ID 는 건너뛴다(결제도 기록도 계정도 없으면)
      const c = await card(uid);
      if (!c.createdAt && !c.payments.length && !c.recent.length && !c.library.length && !c.compensations.length) continue;
      cards.push(c);
    }
    return { q, kind, devices, note, cards, today: kstDayOf(Date.now()) };
  },
);
