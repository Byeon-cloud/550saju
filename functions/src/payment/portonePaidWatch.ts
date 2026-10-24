/**
 * watchPortonePaid — 돈은 나갔는데 운이 안 들어간 웹 결제를 찾아 알리고, 조건이 맞으면 한 번만 채워 넣는다
 *   (2026-10-23 읽기와 알림, 2026-10-24 자동 채우기 오너 승인 '자동채우기도 ㄱㄱ')
 *
 * 왜: 웹 결제(포트원)는 손님 화면이 confirmPortonePayment 를 불러야 운이 들어간다. 모바일은 결제창이 다른 화면으로 넘어갔다가
 *   /charge?portone_pid=… 로 돌아와서야 부르는데, 돌아온 화면의 로그인 계정이 결제한 계정과 다르면(uid 앞 8자 대조에서 거부),
 *   돌아오지 못했으면(창을 닫음, 통신 끊김), 확인이 실패했으면 포트원에는 PAID 인데 우리 장부에는 confirmed 가 없다.
 *
 * 하는 일 (10분마다):
 *   1. 포트원에서 결제 완료(PAID)된 실결제를 찾는다. 조회 시작은 48시간 전, 감시가 멈췄다 돌아왔으면 마지막으로 끝까지 본 시각
 *      (config/portoneWatchState.lastOkAt) 1시간 앞부터(최대 14일). 테스트 채널 결제는 뺀다. 취소된 결제는 상태가 바뀌어 조회에서 빠진다.
 *   2. 결제 뒤 10분이 안 된 결제는 건너뛴다(손님 화면이 아직 확인 중일 수 있다).
 *   3. 우리 장부(users/{uid}/payments/{paymentId}, 이관 사본은 payments.orderId 색인)에 지급 기록이 없으면
 *      backofficeAlerts/portone_unconfirmed_{paymentId} 에 한 번 남기고 오너 메일을 보낸다.
 *   4. 자동 채우기 (config/portoneAutoGrant { enabled, maxPerRun, dailyCapWon }, 문서가 없으면 켜짐, 5건, 5만 원):
 *      결제 뒤 20분이 지났고 autoGrantRules.decideAutoGrant 의 조건을 전부 맞으면, 포트원을 한 번 더 조회해 확인 규칙 그대로
 *      공용 함수 grantPortonePayment(grantedBy 'watch') 로 넣는다. 손님 화면 확인과 동시에 와도 그 트랜잭션이 한 번만 넣는다.
 *      넣으면 경보에 autoGrantedAt, 오너 메일 '자동으로 넣었어요'. 하나라도 애매하면 넣지 않고 이유를 적어 알린다(그 결제는 다시 보지 않는다).
 *      손님 기기에는 결제 문서의 deviceCreditPending 으로, 로그인한 웹 기기가 열릴 때 한 기기에만 들어간다(grantPortone.ts).
 *   5. 앞서 알린 결제가 나중에 손님 화면에서 확인됐으면 그 경보에 resolvedAt 을 적고 메일에 같이 알린다(두 번 넣지 않게).
 *
 * 메일 (10-24 검수): 보낼 내용을 경보 문서(mail, mailPending)에 먼저 적고, 보내기에 성공하면 mailedAt 을 적는다.
 *   실패하면 다음 실행이 mailPending 인 경보를 모아 다시 보낸다(실패 뒤 3시간 간격, 하루 8번 이하).
 * 조회 실패 (10-24 검수): 포트원 조회가 실패하면 backofficeAlerts/portone_watch_fail_{한국 시각 YYYYMMDDHH} 에 시간당 한 번 남기고,
 *   목록 조회가 1시간 넘게 연달아 실패하면 오너 메일 한 통. 다시 돌면 회복 알림 한 통.
 *
 *   로컬 확인: scripts/ops/portone_paid_check.cjs (같은 대조와 자동 채우기 대상, 읽기만)
 */
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { MAIL_APP_PASSWORD, FROM_ADDR, mailTransport } from '../pdf/mailPdf';
import { OWNER_EMAILS, OWNER_UIDS } from '../admin/owner';
import { PACKAGE_MAP } from '../shared/chargePackages';
import { grantPortonePayment } from './grantPortone';
import {
  AUTO_GRANT_MIN_AGE_MS, decideAutoGrant, normalizeAutoGrantConfig, ledgerRowOf, kstDay, watchLookbackFrom,
  type AutoGrantConfig, type LedgerRow,
} from './autoGrantRules';

const PORTONE_V2_API_SECRET = defineSecret('PORTONE_V2_API_SECRET');
const GRACE_MS = 10 * 60 * 1000; // 결제 뒤 이 시간 안은 손님 화면이 아직 확인 중일 수 있다
const MAIL_RETRY_MS = 3 * 3600 * 1000; // 메일이 실패하면 이만큼 뒤에 다시 (하루 8번 이하)
const FAIL_MAIL_AFTER_MS = 60 * 60 * 1000; // 목록 조회가 이만큼 연달아 실패하면 오너 메일
const STATE_DOC = 'config/portoneWatchState';
const AUTO_GRANT_CFG_DOC = 'config/portoneAutoGrant';

const FV = () => admin.firestore.FieldValue;
const kstText = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const kstHourId = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 13).replace(/[-T]/g, '');
const tsMs = (v: any): number => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'string' ? Date.parse(v) || 0 : typeof v === 'number' ? v : 0);
const won = (n: number) => `${Number(n || 0).toLocaleString('ko-KR')}원`;

type MailKind = 'granted' | 'blocked' | 'fresh' | 'resolved' | 'notice';

const STATUS_TEXT: Record<string, string> = {
  none: '장부에 기록 없음(확인 요청이 오지 않았거나, 돌아온 화면의 계정이 달라 거부됨)',
  pending: '확인 중 멈춤(pending)',
  failed: '확인 실패(failed)',
  needs_reconciliation: '포트원 승인 뒤 지급 중 오류(needs_reconciliation)',
};

function customDataUid(p: any): string {
  let cd: any = p?.customData;
  try { if (typeof cd === 'string') cd = JSON.parse(cd); } catch { cd = null; }
  return typeof cd?.uid === 'string' ? cd.uid : '';
}

/** 이 결제의 우리 장부 전부 — 결제한 계정의 문서와, 기기 이관과 결제 이력 복구로 다른 계정에 옮겨진 사본 (같은 문서는 한 번만) */
async function ledgerRowsOf(db: admin.firestore.Firestore, uid: string, paymentId: string): Promise<Array<LedgerRow & { at: number }>> {
  const rows = new Map<string, LedgerRow & { at: number }>();
  const add = (path: string, where: string, x: Record<string, any>) => {
    rows.set(path, { ...ledgerRowOf(where, x), at: tsMs(x.lastAttemptAt) || tsMs(x.createdAt) });
  };
  if (uid) {
    const d = await db.doc(`users/${uid}/payments/${paymentId}`).get();
    if (d.exists) add(d.ref.path, uid, d.data() || {});
  }
  // payments.orderId 는 COLLECTION_GROUP 색인이 있다
  const g = await db.collectionGroup('payments').where('orderId', '==', paymentId).limit(5).get();
  for (const d of g.docs) add(d.ref.path, d.ref.parent.parent?.id || '', d.data() || {});
  return [...rows.values()];
}

/** 메일에 적을 장부 요약 — 지급 기록이 하나라도 있으면 confirmed, 없으면 가장 나중 기록의 상태 */
function ledgerSummary(rows: Array<LedgerRow & { at: number }>): { status: string; failReason: string; where: string; grantedBy: string } {
  const g = rows.find((r) => r.granted);
  if (g) return { status: 'confirmed', failReason: '', where: g.where, grantedBy: g.grantedBy || '' };
  if (!rows.length) return { status: 'none', failReason: '', where: '', grantedBy: '' };
  const last = [...rows].sort((a, b) => b.at - a.at)[0];
  return { status: last.status, failReason: last.failReason, where: last.where, grantedBy: '' };
}

/** 연락 메일(구글, 카카오 선택 동의, 웹 네이버는 users.naverEmail, 오너 메일함으로만 보낸다)과 Auth 계정 여부 */
async function contactOf(db: admin.firestore.Firestore, uid: string, p: any): Promise<{ contact: string; authExists: boolean | null }> {
  let contact = '연락 메일 없음';
  let authExists: boolean | null = uid ? null : false;
  if (uid) {
    try {
      const au = await admin.auth().getUser(uid);
      authExists = true;
      const mail = au.email || au.providerData.map((x) => x.email).find(Boolean);
      if (mail) contact = `연락 메일 ${mail}`;
    } catch (e: any) {
      authExists = e?.code === 'auth/user-not-found' ? false : null;
    }
    if (contact === '연락 메일 없음') {
      const u = await db.doc(`users/${uid}`).get().catch(() => null);
      const nv = u?.data()?.naverEmail;
      if (nv) contact = `연락 메일 ${nv}(네이버)`;
    }
  }
  const payerMail = String(p?.customer?.email || '');
  if (contact === '연락 메일 없음' && payerMail && !/@saju500\.app$/i.test(payerMail)) contact = `연락 메일 ${payerMail}(결제창)`;
  return { contact, authExists };
}

/** 결제 뒤 오너가 이 회원에게 운을 넣은 기록 (관리자 '고객 찾기와 운 넣기' → compensationLog, compensations) */
async function ownerGrantAfter(db: admin.firestore.Firestore, uid: string, paidMs: number): Promise<string | false | null> {
  try {
    const [logs, comp] = await Promise.all([
      db.collection('compensationLog').where('uids', 'array-contains', uid).limit(50).get(),
      db.doc(`compensations/${uid}`).get(),
    ]);
    for (const d of logs.docs) {
      const c = d.data() || {};
      const at = tsMs(c.at);
      if (at && at >= paidMs - 60e3) return `${String(c.reason || 'other')} ${Number(c.amount) || 0}운, ${kstText(at)}`;
    }
    const c = comp.exists ? comp.data() || {} : null;
    const cAt = c ? tsMs(c.updatedAt) || tsMs(c.createdAt) : 0;
    if (c && cAt >= paidMs - 60e3) return `보상 장부 ${Number(c.amount) || 0}운, ${kstText(cAt)}`;
    return false;
  } catch {
    return null;
  }
}

async function fetchPortone(key: string, url: string): Promise<{ ok: true; body: any } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { headers: { Authorization: `PortOne ${key}` } });
    if (!res.ok) return { ok: false, error: `http ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}` };
    return { ok: true, body: await res.json() };
  } catch (e: any) {
    return { ok: false, error: `fetch ${String(e?.message || e).slice(0, 200)}` };
  }
}

/** 포트원 조회 실패 — 시간당 한 번 경보 문서 (목록이든 단건이든) */
async function noteWatchFail(db: admin.firestore.Firestore, now: number, stage: 'list' | 'one', detail: string): Promise<void> {
  await db.collection('backofficeAlerts').doc(`portone_watch_fail_${kstHourId(now)}`)
    .create({ kind: 'portone_watch_fail', stage, detail: detail.slice(0, 300), at: FV().serverTimestamp() })
    .catch(() => undefined); // 이번 시간에 이미 남김
}

/** 메일 보내기 (보낼 수 있는 시점인지는 부르는 쪽이 본다) */
async function sendOwnerMail(subject: string, text: string): Promise<boolean> {
  try {
    await mailTransport().sendMail({
      from: `"사주500 경보" <${FROM_ADDR}>`,
      to: [...OWNER_EMAILS, FROM_ADDR].join(','),
      subject,
      text,
    });
    return true;
  } catch (e: any) {
    console.error('[watchPortonePaid] 메일 실패', e?.message || e);
    return false;
  }
}

/** 경보에 보낼 메일 내용을 적어 둔다 (보내기에 성공하면 flushAlertMail 이 mailedAt 을 적고 지운다) */
async function queueMail(ref: admin.firestore.DocumentReference, kind: MailKind, text: string, extra: Record<string, unknown> = {}): Promise<void> {
  await ref.set({ ...extra, mail: { [kind]: text }, mailPending: true }, { merge: true });
}

/** mailPending 인 경보를 모아 한 통으로 보낸다. 성공하면 mailedAt, 실패하면 다음 실행에 다시 (실패 뒤 3시간 간격) */
async function flushAlertMail(db: admin.firestore.Firestore, now: number, cfg: AutoGrantConfig, mailBlocked: boolean): Promise<'sent' | 'none' | 'failed' | 'waiting'> {
  const snap = await db.collection('backofficeAlerts').where('mailPending', '==', true).limit(100).get();
  if (snap.empty) return 'none';
  if (mailBlocked) return 'waiting';
  const sec: Record<MailKind, string[]> = { granted: [], blocked: [], fresh: [], resolved: [], notice: [] };
  const sentKinds = new Map<string, string[]>();
  for (const d of snap.docs) {
    const m = (d.data()?.mail || {}) as Partial<Record<MailKind, string>>;
    const kinds: MailKind[] = [];
    if (m.granted) kinds.push('granted');
    if (m.blocked) kinds.push('blocked');
    if (m.notice) kinds.push('notice');
    // 첫 알림이 아직 안 갔는데 그사이 운이 들어갔으면 둘 다 보낼 일이 없다
    if (m.resolved && !m.fresh) kinds.push('resolved');
    // 자동으로 넣었거나 못 넣은 알림이 같이 가면 첫 알림은 그 안에 담긴다
    if (m.fresh && !m.granted && !m.blocked && !m.resolved) kinds.push('fresh');
    for (const k of kinds) sec[k].push(String(m[k]));
    sentKinds.set(d.id, kinds);
  }
  const parts: string[] = [];
  const subj: string[] = [];
  if (sec.granted.length) {
    subj.push(`자동으로 넣은 웹 결제 ${sec.granted.length}건`);
    parts.push(`자동으로 넣었어요. 포트원에는 결제 완료인데 확인 화면이 끊겨 운이 들어가지 않은 결제를, 확인 규칙 그대로 한 번만 넣었어요.\n\n${sec.granted.join('\n\n')}`);
    parts.push([
      '알아 둘 것',
      '- 서버 잔액에 넣었어요. 손님 기기에는 로그인한 채로 사주500 웹을 다시 열면 들어가요. 따로 넣지 마세요.',
      '- 잘못 넣었다면 포트원 콘솔에서 결제를 취소하면 운도 거둬요.',
      '- 자동 채우기 끄기: Firestore config/portoneAutoGrant 에 enabled: false',
    ].join('\n'));
  }
  if (sec.blocked.length) {
    subj.push(`직접 확인할 웹 결제 ${sec.blocked.length}건`);
    parts.push(`자동으로 넣지 못했어요. 직접 확인해 주세요.\n\n${sec.blocked.join('\n\n')}`);
    parts.push([
      '할 일',
      '- 관리자 \'고객 찾기와 운 넣기\'에서 회원 ID 로 찾아 결제 장부를 보고, 받은 운이 없으면 사유 \'결제 누락\'에 이 결제번호를 골라(또는 붙여 넣어) 그 묶음만큼 넣어 주세요. 그러면 손님 기기가 다시 확인해도 두 번 들어가지 않아요.',
      '- 운을 넣지 않고 돌려주려면 포트원 콘솔에서 결제를 취소하면 돼요.',
      '- 이 결제는 자동으로 다시 넣지 않아요.',
    ].join('\n'));
  }
  if (sec.fresh.length) {
    subj.push(`운이 안 들어간 웹 결제 ${sec.fresh.length}건`);
    parts.push(`포트원에는 결제 완료인데 운이 들어가지 않은 웹 결제예요(결제 뒤 10분 지남).\n\n${sec.fresh.join('\n\n')}`);
    parts.push(cfg.enabled
      ? [
        '다음',
        '- 결제 뒤 20분이 지나도 손님 화면이 확인하지 못하면, 조건을 맞춰 본 뒤 자동으로 넣고 다시 알려요. 못 넣으면 이유를 적어 다시 알려요.',
        '- 직접 처리하려면 그 전에 경보 문서 backofficeAlerts/portone_unconfirmed_{결제번호} 에 manualHandled: true 를 적어 주세요.',
      ].join('\n')
      : [
        '할 일 (자동 채우기가 꺼져 있어요)',
        '- 관리자 \'고객 찾기와 운 넣기\'에서 회원 ID 로 찾아 결제 장부를 보고, 받은 운이 없으면 사유 \'결제 누락\'에 이 결제번호를 골라(또는 붙여 넣어) 그 묶음만큼 넣어 주세요. 그러면 손님 기기가 다시 확인해도 두 번 들어가지 않아요.',
        '- 운을 넣지 않고 돌려주려면 포트원 콘솔에서 결제를 취소하면 돼요.',
        '- 기록: backofficeAlerts portone_unconfirmed_{결제번호}',
      ].join('\n'));
  }
  if (sec.resolved.length) {
    subj.push(`운이 들어간 웹 결제 ${sec.resolved.length}건`);
    parts.push(`앞서 알린 결제 중 이제 운이 들어간 것\n${sec.resolved.join('\n')}`);
  }
  if (sec.notice.length) {
    subj.push('결제 감시 알림');
    parts.push(sec.notice.join('\n\n'));
  }

  const batch = db.batch();
  if (!parts.length) {
    // 보낼 것이 없는 경보(첫 알림 전에 해결)는 표시만 내린다
    for (const d of snap.docs) batch.set(d.ref, { mailPending: false, mail: FV().delete() }, { merge: true });
    await batch.commit();
    return 'none';
  }
  const ok = await sendOwnerMail(`[사주500 경보] ${subj.join(', ')}`, parts.join('\n\n'));
  for (const d of snap.docs) {
    const kinds = sentKinds.get(d.id) || [];
    if (ok) batch.set(d.ref, { mailPending: false, mailedAt: FV().serverTimestamp(), ...(kinds.length ? { mailedKinds: FV().arrayUnion(...kinds) } : {}), mail: FV().delete() }, { merge: true });
    else batch.set(d.ref, { mailTries: FV().increment(1), mailLastTryAt: FV().serverTimestamp() }, { merge: true });
  }
  await batch.commit();
  return ok ? 'sent' : 'failed';
}

export interface WatchRunResult {
  listOk: boolean;
  items: number;
  checked: number;
  young: number;
  freshAlerts: number;
  granted: number;
  blocked: number;
  resolved: number;
  mail: string;
}

/** 감시 한 번 (onSchedule 과 시험이 같이 쓴다) */
export async function runPortonePaidWatch(key: string, now: number = Date.now()): Promise<WatchRunResult> {
  const db = admin.firestore();
  const stateRef = db.doc(STATE_DOC);
  const state = ((await stateRef.get().catch(() => null))?.data() || {}) as Record<string, any>;
  const cfg = normalizeAutoGrantConfig((await db.doc(AUTO_GRANT_CFG_DOC).get().catch(() => null))?.data());
  const mailBlocked = !!state.mailFailAt && now - Number(state.mailFailAt) < MAIL_RETRY_MS;
  const out: WatchRunResult = { listOk: false, items: 0, checked: 0, young: 0, freshAlerts: 0, granted: 0, blocked: 0, resolved: 0, mail: '' };

  // 메일 보내기 결과로 실패 표시를 고친다
  const finishMail = async (statePatch: Record<string, unknown>) => {
    const r = await flushAlertMail(db, now, cfg, mailBlocked).catch((e) => { console.error('[watchPortonePaid] 메일 모으기 실패', e?.message || e); return 'failed' as const; });
    out.mail = r;
    const patch: Record<string, unknown> = { ...statePatch, updatedAt: FV().serverTimestamp() };
    if (r === 'sent') patch.mailFailAt = null;
    if (r === 'failed') patch.mailFailAt = now;
    await stateRef.set(patch, { merge: true }).catch(() => undefined);
  };

  // 1. 포트원 결제 완료 목록
  const fromMs = watchLookbackFrom(now, state.lastOkAt);
  const maxPages = now - fromMs > 49 * 3600e3 ? 30 : 10;
  const items: any[] = [];
  let listError = '';
  for (let page = 0; page < maxPages; page++) {
    const body = { page: { number: page, size: 100 }, filter: { isTest: false, timestampType: 'STATUS_CHANGED_AT', from: new Date(fromMs).toISOString(), until: new Date(now).toISOString(), status: ['PAID'] } };
    const r = await fetchPortone(key, 'https://api.portone.io/payments?requestBody=' + encodeURIComponent(JSON.stringify(body)));
    if (!r.ok) { listError = r.error; break; }
    const got = r.body?.items || [];
    items.push(...got);
    if (got.length < 100) break;
    if (page === maxPages - 1) console.warn('[watchPortonePaid] 조회 쪽수 상한에 닿음', items.length);
  }

  if (listError) {
    // 2. 목록 조회 실패 — 시간당 경보 한 번, 1시간 넘게 이어지면 오너 메일 한 통 (이번 실행은 결제를 보지 못한다)
    console.error('[watchPortonePaid] 조회 실패', listError);
    await noteWatchFail(db, now, 'list', listError);
    const failSince = Number(state.failSince) || now;
    const patch: Record<string, unknown> = { failSince, lastFailAt: now, lastFailDetail: listError.slice(0, 300) };
    let failMailFailed = false;
    if (now - failSince >= FAIL_MAIL_AFTER_MS && !state.failMailedAt && !mailBlocked) {
      const ok = await sendOwnerMail('[사주500 경보] 포트원 결제 감시가 1시간 넘게 조회에 실패하고 있어요', [
        `포트원 결제 목록 조회가 ${kstText(failSince)}(한국 시각)부터 실패하고 있어요. 그동안 결제는 됐는데 운이 안 들어간 웹 결제를 찾지 못하고, 자동 채우기도 멈춰 있어요.`,
        `마지막 오류: ${listError.slice(0, 200)}`,
        '포트원 콘솔의 API 키(PORTONE_V2_API_SECRET)와 포트원 상태를 확인해 주세요. 다시 돌면 그 사이 결제까지 거슬러 확인하고 알려요.',
        `기록: backofficeAlerts portone_watch_fail_{한국 시각 YYYYMMDDHH}, ${STATE_DOC}`,
      ].join('\n\n'));
      if (ok) patch.failMailedAt = now;
      else failMailFailed = true;
    }
    // 쌓인 경보 메일은 그대로 다시 보내 본다 (방금 메일이 실패했으면 이번엔 쉰다)
    const r = await flushAlertMail(db, now, cfg, mailBlocked || failMailFailed).catch(() => 'failed' as const);
    out.mail = r;
    if (failMailFailed || r === 'failed') patch.mailFailAt = now;
    else if (r === 'sent' || patch.failMailedAt) patch.mailFailAt = null;
    await stateRef.set({ ...patch, updatedAt: FV().serverTimestamp() }, { merge: true }).catch(() => undefined);
    return out;
  }
  out.listOk = true;
  out.items = items.length;

  // 목록 조회가 다시 돌면 회복 알림 (실패 메일을 보냈던 경우만)
  if (state.failSince && state.failMailedAt) {
    const ref = db.collection('backofficeAlerts').doc(`portone_watch_recovered_${kstHourId(now)}`);
    await ref.set({ kind: 'portone_watch_recovered', failSince: Number(state.failSince), at: FV().serverTimestamp() }, { merge: true }).catch(() => undefined);
    await queueMail(ref, 'notice', `포트원 결제 감시가 다시 돌아요. ${kstText(Number(state.failSince))}부터 ${kstText(now)}까지 실패했고, 그 사이 결제는 이번에 거슬러 확인했어요(한국 시각).`).catch(() => undefined);
  }

  // 자동 채우기 하루 합계 (읽지 못하면 이번 실행은 자동 채우기를 쉰다)
  const day = kstDay(now);
  const dailyRef = db.doc(`portoneAutoGrantDaily/${day}`);
  let grantedTodayWon = 0;
  let capKnown = true;
  try {
    const s = await dailyRef.get();
    grantedTodayWon = Number(s.data()?.won) || 0;
  } catch { capKnown = false; }
  let grantedThisRun = 0;
  let itemErrors = 0;

  for (const p of items) {
    const paymentId: string = String(p?.id || '');
    if (!paymentId || p.status !== 'PAID') continue;
    if (p.channel?.type && p.channel.type !== 'LIVE') continue; // 테스트 채널 결제는 confirm 도 감시도 지급하지 않는다
    const paidMs = Date.parse(p.paidAt || p.statusChangedAt || '') || 0;
    if (!paidMs || now - paidMs < GRACE_MS) { out.young++; continue; }
    out.checked++;
    try {
      const listUid = customDataUid(p);
      const uid: string = listUid && paymentId.startsWith(listUid.slice(0, 8)) ? listUid : '';
      const amount = Number(p.amount?.total || 0);

      const alertRef = db.collection('backofficeAlerts').doc(`portone_unconfirmed_${paymentId}`);
      const prev = await alertRef.get();
      let a: Record<string, any> = prev.exists ? prev.data() || {} : {};
      if (a.resolvedAt || a.autoGrantedAt) continue; // 이미 운이 들어갔거나 자동으로 넣음

      const rows = await ledgerRowsOf(db, uid, paymentId);
      const led = ledgerSummary(rows);
      if (led.status === 'confirmed') {
        if (prev.exists) {
          // 10-24 검수 — 오너가 관리자 '결제 누락'에 결제번호를 넣어 처리한 결제는 grantedBy 'owner' (adminGrantCompensation)
          const byOwner = led.grantedBy === 'owner';
          await queueMail(alertRef, 'resolved', byOwner
            ? `결제번호 ${paymentId} (${won(amount)}) — 앞서 알린 결제인데 관리자 화면에서 결제 누락으로 넣었어요. 따로 넣지 마세요.`
            : `결제번호 ${paymentId} (${won(amount)}) — 앞서 알린 결제인데 이제 운이 들어갔어요. 따로 넣지 마세요.`, {
            resolvedAt: FV().serverTimestamp(), resolvedNote: byOwner ? '앞서 알린 뒤 오너가 관리자 화면에서 결제 누락으로 넣음' : '앞서 알린 뒤 손님 화면에서 확인돼 운이 들어감',
          });
          out.resolved++;
        }
        continue;
      }

      const mm = (await db.collection('portoneUidMismatch').doc(paymentId).get().catch(() => null));
      const mmd = mm?.exists ? mm.data() || null : null;
      let contactInfo: { contact: string; authExists: boolean | null } | null = null;
      const getContact = async () => (contactInfo ??= await contactOf(db, uid, p));
      const who = uid ? `회원 ID ${uid}${OWNER_UIDS.includes(uid) ? ' (오너 계정)' : ''}` : `회원 ID 앞 8자 ${paymentId.slice(0, 8)} (결제 정보에 회원 ID 없음)`;
      const describe = async () => {
        const lines = [
          `결제번호 ${paymentId}`,
          `  ${won(amount)}, ${String(p.orderName || '')}, 결제 ${kstText(paidMs)}(한국 시각), ${p.method?.type || ''}${p.method?.provider ? ` ${p.method.provider}` : ''}`,
          `  ${who}, ${(await getContact()).contact}`,
          `  우리 장부: ${STATUS_TEXT[led.status] || led.status}${led.failReason ? `, 사유 ${led.failReason.slice(0, 80)}` : ''}${led.where && led.where !== uid ? `, 기록 위치 ${led.where}` : ''}`,
        ];
        if (mmd) lines.push(`  돌아온 화면의 계정이 달라 확인이 거부됨: 그 계정 앞 8자 ${mmd.callerUid8}${mmd.callerAnon ? '(익명, 로그인이 풀린 채 돌아옴)' : ''}`);
        return lines.join('\n');
      };

      // 3. 첫 알림 (결제당 한 번)
      if (!prev.exists) {
        const text = await describe();
        try {
          await alertRef.create({
            kind: 'portone_paid_unconfirmed', paymentId, amount,
            uidPrefix: uid ? uid.slice(0, 8) : paymentId.slice(0, 8),
            paidAt: new Date(paidMs).toISOString(),
            ledgerStatus: led.status, failReason: led.failReason.slice(0, 120),
            uidMismatchCallerUid8: mmd?.callerUid8 || null,
            mail: { fresh: text }, mailPending: true,
            at: FV().serverTimestamp(),
          });
          out.freshAlerts++;
          a = {};
        } catch { continue; } // 같은 시각에 다른 실행이 먼저 남겼다
      }

      // 4. 자동 채우기
      if (!cfg.enabled || !capKnown) continue;
      if (a.manualHandled || a.autoGrantBlockedAt) continue; // 오너가 직접 처리하기로 했거나, 이미 못 넣는다고 알린 결제
      if (now - paidMs < AUTO_GRANT_MIN_AGE_MS) continue; // 손님 화면이 확인할 시간
      if (grantedThisRun >= cfg.maxPerRun) continue; // 다음 실행에

      // 지급 직전 포트원을 한 번 더 조회한다 (그사이 취소됐을 수 있다)
      const one = await fetchPortone(key, `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`);
      if (!one.ok) { await noteWatchFail(db, now, 'one', `${paymentId.slice(0, 8)} ${one.error}`); continue; }
      const pay = one.body || {};
      const freshUid = customDataUid(pay);
      const freshAmount = Number(pay?.amount?.total);
      const { authExists } = freshUid === uid && uid ? await getContact() : await contactOf(db, freshUid, pay);
      const ownerGrant = freshUid ? await ownerGrantAfter(db, freshUid, paidMs) : false;
      const decision = decideAutoGrant({
        now, paymentId,
        fresh: { status: pay?.status, channelType: pay?.channel?.type, currency: pay?.currency, amount: freshAmount, customDataUid: freshUid },
        listAmount: amount, listCustomDataUid: listUid, paidMs,
        packageAmounts: Object.keys(PACKAGE_MAP).map(Number),
        authExists, ledger: rows, manualHandled: !!a.manualHandled, ownerGrantAfterPay: ownerGrant,
        grantedTodayWon, grantedThisRun, cfg,
      });
      if (!decision.ok) {
        if (decision.final) {
          const text = `${await describe()}\n  자동으로 넣지 않은 이유:\n${decision.reasons.map((r) => `    - ${r}`).join('\n')}`;
          await queueMail(alertRef, 'blocked', text, { autoGrantBlockedAt: FV().serverTimestamp(), autoGrantBlocked: decision.reasons });
          out.blocked++;
        }
        continue;
      }

      const pkg = PACKAGE_MAP[freshAmount];
      let r: { granted: boolean; totalUn: number };
      try {
        r = await grantPortonePayment({ uid: decision.uid, paymentId, pay, pkg, amount: freshAmount, grantedBy: 'watch' });
      } catch (e: any) {
        // 지급 트랜잭션 실패 — 아무것도 넣지 않았다. 경보에 적고 다음 실행에 다시
        console.error('[watchPortonePaid] 자동 지급 실패', paymentId.slice(0, 8), e?.message || e);
        await alertRef.set({ autoGrantLastError: String(e?.message || e).slice(0, 200), autoGrantLastErrorAt: FV().serverTimestamp() }, { merge: true }).catch(() => undefined);
        continue;
      }
      if (!r.granted) {
        // 그사이 손님 화면에서 확인돼 운이 들어갔다
        await queueMail(alertRef, 'resolved', `결제번호 ${paymentId} (${won(amount)}) — 앞서 알린 결제인데 이제 운이 들어갔어요. 따로 넣지 마세요.`, {
          resolvedAt: FV().serverTimestamp(), resolvedNote: '자동 지급 직전에 손님 화면에서 확인돼 운이 들어감',
        });
        out.resolved++;
        continue;
      }
      grantedThisRun++;
      grantedTodayWon += freshAmount;
      out.granted++;
      await dailyRef.set({ won: FV().increment(freshAmount), count: FV().increment(1), updatedAt: FV().serverTimestamp() }, { merge: true }).catch(() => undefined);
      const c = await getContact();
      const text = [
        `결제번호 ${paymentId}`,
        `  ${won(freshAmount)}, 묶음 '${pkg.name}' ${r.totalUn}운(결제 ${pkg.paidUn}운, 보너스 ${pkg.bonusUn}운), 결제 ${kstText(paidMs)}(한국 시각), ${pay?.method?.type || ''}${pay?.method?.provider ? ` ${pay.method.provider}` : ''}`,
        `  회원 ID ${decision.uid}${OWNER_UIDS.includes(decision.uid) ? ' (오너 계정)' : ''}, ${c.contact}`,
        `  넣기 전 우리 장부: ${STATUS_TEXT[led.status] || led.status}${led.failReason ? `, 사유 ${led.failReason.slice(0, 80)}` : ''}`,
      ].join('\n');
      await queueMail(alertRef, 'granted', text, { autoGrantedAt: FV().serverTimestamp(), autoGrantedUid: decision.uid, autoGrantedUn: r.totalUn, autoGrantedWon: freshAmount });
    } catch (e: any) {
      itemErrors++;
      console.error('[watchPortonePaid] 결제 하나 처리 실패', paymentId.slice(0, 8), e?.message || e);
    }
  }

  console.log(`[watchPortonePaid] 조회 ${kstText(fromMs)}부터, PAID ${items.length}건, 확인 ${out.checked}건, 10분 안 ${out.young}건, 새 경보 ${out.freshAlerts}건, 자동 지급 ${out.granted}건, 못 넣음 ${out.blocked}건, 해결 ${out.resolved}건, 오류 ${itemErrors}건`);
  // 5. 끝까지 봤으면 그 시각을 남긴다 (다음에 멈췄다 돌아오면 여기서부터 거슬러 본다). 실패 연속 기록은 지운다
  const statePatch: Record<string, unknown> = { failSince: null, failMailedAt: null };
  if (!itemErrors) statePatch.lastOkAt = now;
  await finishMail(statePatch);
  return out;
}

export const watchPortonePaid = onSchedule(
  { schedule: 'every 10 minutes', timeZone: 'Asia/Seoul', secrets: [PORTONE_V2_API_SECRET, MAIL_APP_PASSWORD], timeoutSeconds: 180, memory: '256MiB', retryCount: 0 },
  async () => {
    await runPortonePaidWatch(PORTONE_V2_API_SECRET.value());
  },
);
