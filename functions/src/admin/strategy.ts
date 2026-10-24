/**
 * 관리자 '전략 성과' 판 (2026-10-24, 오너 지시 '어떤 전략은 며칠 했고 효율은 어땠는지')
 *
 *   시험 목록: mktExperiments/{E번호}
 *     기본 칸(name, hypothesis, channel, start, end, status, costNote, target, next, now)은
 *     scripts/ops/experiments_sync.cjs 가 docs/marketing/experiments.json 에서 덮어쓴다.
 *     관리자 화면에서 고친 값은 edit 칸에만 남긴다(동기화가 지우지 않게). 화면은 edit 를 기본 칸 위에 얹어 보여 준다.
 *   광고비 장부: adSpend/{날짜}_{채널} — { day, channel, amount, imp?, clk?, note?, source: naver_api|meta_report|manual }
 *     네이버는 scripts/ops/ad_spend_sync.cjs 가 API 로, 메타와 토스애즈는 화면이나 스크립트로 넣는다.
 *   유입, 사주 입력, 충전 화면, 결제, 매출은 하루 요약(statsDaily.channels, 기기의 그날 첫 출처)을 화면이 더한다.
 *   여기 함수들은 장부를 읽고 쓰기만 한다. 셋 다 오너 전용.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertOwner } from './owner';
import { kstToday, addDays } from './stats';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHANNEL_RE = /^[a-z0-9_]{2,24}$/;
const EXP_ID_RE = /^E\d{1,3}[a-z]?$/;
const STATUSES = ['준비', '대기', '진행', '멈춤', '종료', '기각'];

const tsMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v;
  return 0;
};
const str = (v: unknown, max: number): string => String(v ?? '').slice(0, max);

/** 시험 목록과 광고비 장부 (days: 장부를 거슬러 읽을 날 수, 기본 180) */
export const adminStrategyData = onCall({ timeoutSeconds: 60, memory: '256MiB', cors: true }, async (request) => {
  assertOwner(request);
  const db = admin.firestore();
  const back = Math.max(30, Math.min(400, Number(request.data?.days) || 180));
  const from = addDays(kstToday(), -(back - 1));
  const [expSnap, spendSnap] = await Promise.all([
    db.collection('mktExperiments').get(),
    db.collection('adSpend').where('day', '>=', from).get(),
  ]);
  const experiments = expSnap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id,
      name: str(x.name, 120), hypothesis: str(x.hypothesis, 400), channel: str(x.channel, 24), metricKey: str(x.metricKey, 40),
      start: str(x.start, 10), end: str(x.end, 10), status: str(x.status, 20), costNote: str(x.costNote, 200),
      target: str(x.target, 200), next: str(x.next, 400), now: str(x.now, 200), order: Number(x.order) || 0,
      // 화면에서 고치지 않은 칸은 null (빈 글자 '' 는 '지웠다'는 뜻이라 구분한다)
      edit: x.edit ? {
        status: x.edit.status === undefined ? null : str(x.edit.status, 40), end: x.edit.end === undefined ? null : str(x.edit.end, 10),
        note: str(x.edit.note, 400), at: tsMs(x.edit.at),
      } : null,
      syncedAt: tsMs(x.syncedAt),
    };
  });
  const spend = spendSnap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id, day: str(x.day, 10), channel: str(x.channel, 24), amount: Math.round(Number(x.amount) || 0),
      imp: Number(x.imp) || 0, clk: Number(x.clk) || 0, note: str(x.note, 120), source: str(x.source, 20), updatedAt: tsMs(x.updatedAt),
    };
  }).sort((a, b) => (a.day === b.day ? a.channel.localeCompare(b.channel) : a.day.localeCompare(b.day)));
  return { from, to: kstToday(), experiments, spend };
});

/** 광고비 한 줄 넣기, 고치기, 지우기 — { day, channel, amount, note?, imp?, clk? } 또는 { day, channel, remove: true } */
export const adminSetAdSpend = onCall({ timeoutSeconds: 30, memory: '256MiB', cors: true }, async (request) => {
  const by = assertOwner(request);
  const day = String(request.data?.day || '');
  const channel = String(request.data?.channel || '').trim().toLowerCase();
  if (!DAY_RE.test(day) || day > kstToday()) throw new HttpsError('invalid-argument', '날짜는 오늘이나 그 전, YYYY-MM-DD 로 넣어 주세요');
  if (!CHANNEL_RE.test(channel)) throw new HttpsError('invalid-argument', '채널은 영어 소문자, 숫자, 밑줄로 넣어 주세요(예: meta, naver, tossads)');
  const ref = admin.firestore().doc(`adSpend/${day}_${channel}`);
  if (request.data?.remove === true) {
    const old = await ref.get();
    await ref.delete();
    await admin.firestore().collection('adminAudit').add({
      at: admin.firestore.FieldValue.serverTimestamp(), by, action: 'ad_spend_remove', target: `${day}_${channel}`, amount: Number(old.data()?.amount) || 0,
    });
    return { ok: true, removed: true };
  }
  const amount = Number(request.data?.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) throw new HttpsError('invalid-argument', '금액은 0원부터 1,000만 원까지예요');
  const imp = Math.max(0, Math.round(Number(request.data?.imp) || 0));
  const clk = Math.max(0, Math.round(Number(request.data?.clk) || 0));
  await ref.set({
    day, channel, amount: Math.round(amount),
    ...(imp ? { imp } : {}), ...(clk ? { clk } : {}),
    note: str(request.data?.note, 120), source: 'manual', by,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

/** 시험 상태, 끝난 날, 메모 고치기 — { id, status?, end?, note? }. 새 시험은 { id, create: { name, channel?, start } } */
export const adminSetExperiment = onCall({ timeoutSeconds: 30, memory: '256MiB', cors: true }, async (request) => {
  const by = assertOwner(request);
  const id = String(request.data?.id || '').trim();
  if (!EXP_ID_RE.test(id)) throw new HttpsError('invalid-argument', '시험 번호는 E 다음 숫자예요(예: E38)');
  const ref = admin.firestore().doc(`mktExperiments/${id}`);
  const snap = await ref.get();
  const create = request.data?.create;
  if (!snap.exists) {
    if (!create || !String(create.name || '').trim()) throw new HttpsError('not-found', '없는 시험이에요. 새로 만들려면 이름이 필요해요');
    const start = String(create.start || '');
    const channel = String(create.channel || '').trim().toLowerCase();
    if (start && !DAY_RE.test(start)) throw new HttpsError('invalid-argument', '시작 날짜는 YYYY-MM-DD 로 넣어 주세요');
    if (channel && !CHANNEL_RE.test(channel)) throw new HttpsError('invalid-argument', '채널은 영어 소문자, 숫자, 밑줄로 넣어 주세요');
    await ref.set({
      name: str(create.name, 120).trim(), hypothesis: str(create.hypothesis, 400), channel, start, end: '', status: start ? '진행' : '준비',
      costNote: str(create.costNote, 200), target: str(create.target, 200), next: '', now: '', order: 0, createdBy: by,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true, created: true };
  }
  const edit: Record<string, unknown> = { at: admin.firestore.FieldValue.serverTimestamp(), by };
  if (request.data?.status !== undefined) {
    const s = String(request.data.status);
    if (s && !STATUSES.includes(s)) throw new HttpsError('invalid-argument', `상태는 ${STATUSES.join(', ')} 중 하나예요`);
    edit.status = s;
  }
  if (request.data?.end !== undefined) {
    const e = String(request.data.end);
    if (e && !DAY_RE.test(e)) throw new HttpsError('invalid-argument', '끝난 날은 YYYY-MM-DD 로 넣어 주세요');
    edit.end = e;
  }
  if (request.data?.note !== undefined) edit.note = str(request.data.note, 400);
  await ref.set({ edit }, { merge: true });
  return { ok: true };
});
