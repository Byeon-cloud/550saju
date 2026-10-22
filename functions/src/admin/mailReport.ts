/**
 * 관리자 '메일' 판 (2026-10-22, 오너 지시 '이메일로 무료로 날려 주는 것 어드민에서 파악')
 *
 *   아침 운세 메일(ilju/iljuDaily.ts, 웹 전용)과 광고성 소식 동의(mail/marketingMail.ts)를 한 화면에서 본다.
 *   원본: dailyMailSubs(구독), emailLeads(광고성 동의), dailyMailLog/{날짜}(보낸 수), analytics(신청 칸 기록, 메일 링크 utm_source=email),
 *         users/{uid}/payments(구독자 결제)
 *   구독자는 많아야 1,500명(iljuDaily MAX_SUBS)이라 화면을 열 때 바로 계산한다. 메일 주소는 화면에 보내지 않는다(숫자만).
 */
import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { assertOwner, OWNER_UIDS } from './owner';
import { kstDayOf, kstToday, addDays } from './stats';

const tsMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v) || 0;
  return 0;
};

const FUNNEL = ['mail_signup_view', 'mail_signup_open', 'mail_signup_submit', 'mail_subscribe', 'mail_signup_fail'] as const;

type Day = {
  day: string;
  views: number; opens: number; submits: number; subs: number; fails: number; // 신청 칸 (기기 수)
  newSubs: number; unsubs: number; newAdConsent: number; // 서버 장부
  sent: number; failed: number; skipped: number; // 보낸 메일
  clickers: number; results: number; chargeOpen: number; payers: number; revenue: number; // 메일 링크로 온 사람
};

export const adminMailReport = onCall({ timeoutSeconds: 120, memory: '512MiB', cors: true }, async (request) => {
  assertOwner(request);
  const db = admin.firestore();
  const want = Math.max(7, Math.min(90, Number(request.data?.days) || 30));
  const today = kstToday();
  const from = addDays(today, -(want - 1));
  const days: string[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) days.push(d);
  const row = new Map<string, Day>(days.map((d) => [d, {
    day: d, views: 0, opens: 0, submits: 0, subs: 0, fails: 0, newSubs: 0, unsubs: 0, newAdConsent: 0,
    sent: 0, failed: 0, skipped: 0, clickers: 0, results: 0, chargeOpen: 0, payers: 0, revenue: 0,
  }]));
  const inRange = (d: string) => row.has(d);

  const [subsSnap, leadsSnap, logSnaps, funnelSnap, emailSnap] = await Promise.all([
    db.collection('dailyMailSubs').get(),
    db.collection('emailLeads').get(),
    db.getAll(...days.map((d) => db.doc(`dailyMailLog/${d}`))),
    db.collection('analytics').where('name', 'in', [...FUNNEL]).get(),
    db.collection('analytics').where('utm.source', '==', 'email').get(),
  ]);

  // 구독 장부
  const bySource: Record<string, { all: number; active: number }> = {};
  const byAge: Record<string, number> = {};
  let active = 0; let withdrawn = 0;
  const subs: { uid: string; consentMs: number; active: boolean }[] = [];
  for (const s of subsSnap.docs) {
    const d = s.data() as any;
    if (OWNER_UIDS.includes(s.id)) continue;
    const src = String(d.source || '-');
    bySource[src] = bySource[src] || { all: 0, active: 0 };
    bySource[src].all += 1;
    if (d.active) { active += 1; bySource[src].active += 1; } else withdrawn += 1;
    const y = Number(d.birthYear) || 0;
    if (y) { const age = new Date().getFullYear() - y; const g = age < 20 ? '10대' : age < 30 ? '20대' : age < 40 ? '30대' : age < 50 ? '40대' : age < 60 ? '50대' : '60대 이상'; byAge[g] = (byAge[g] || 0) + 1; }
    const cd = String(d.consentDay || '');
    if (inRange(cd)) row.get(cd)!.newSubs += 1;
    const wd = d.withdrawnAt ? kstDayOf(tsMs(d.withdrawnAt)) : '';
    if (!d.active && inRange(wd)) row.get(wd)!.unsubs += 1;
    subs.push({ uid: s.id, consentMs: tsMs(d.consentAt) || Date.parse(`${cd}T00:00:00+09:00`) || 0, active: !!d.active });
  }
  let adConsent = 0; let adWithdrawn = 0;
  const leadSource: Record<string, number> = {};
  for (const l of leadsSnap.docs) {
    const d = l.data() as any;
    if (OWNER_UIDS.includes(l.id)) continue;
    if (d.marketingConsent) adConsent += 1; else if (d.marketingWithdrawnAt) adWithdrawn += 1;
    const src = String(d.lastSource || '-');
    leadSource[src] = (leadSource[src] || 0) + 1;
    const cd = String(d.marketingConsentDay || '');
    if (d.marketingConsent && inRange(cd)) row.get(cd)!.newAdConsent += 1;
  }

  // 보낸 메일
  logSnaps.forEach((s) => {
    if (!s.exists) return;
    const d = s.data() as any;
    const r = row.get(s.id);
    if (!r) return;
    r.sent = Number(d.sent) || 0; r.failed = Number(d.failed) || 0; r.skipped = Number(d.skipped) || 0;
  });

  // 신청 칸 기록 (기기 수, 오너 기기 제외)
  const seen = new Map<string, Set<string>>();
  const failWhy: Record<string, number> = {};
  const funnelSource: Record<string, Record<string, number>> = {};
  for (const e of funnelSnap.docs) {
    const d = e.data() as any;
    if (d.internal || !inRange(String(d.day || ''))) continue;
    const who = String(d.did || d.uid || e.id);
    const key = `${d.day}|${d.name}`;
    const set = seen.get(key) || new Set<string>();
    if (set.has(who)) continue;
    set.add(who); seen.set(key, set);
    const r = row.get(d.day)!;
    const name = String(d.name);
    if (name === 'mail_signup_view') r.views += 1;
    else if (name === 'mail_signup_open') r.opens += 1;
    else if (name === 'mail_signup_submit') r.submits += 1;
    else if (name === 'mail_signup_fail') { r.fails += 1; const w = String(d.props?.why || 'unknown').slice(0, 30); failWhy[w] = (failWhy[w] || 0) + 1; }
    else if (name === 'mail_subscribe') {
      const src = String(d.props?.source || '');
      if (!src.startsWith('daily_')) continue; // 신년운세 마감 알림(mail_subscribe) 은 따로
      r.subs += 1;
    }
    const src = String(d.props?.source || '-').replace(/^daily_/, '');
    funnelSource[src] = funnelSource[src] || {};
    funnelSource[src][name] = (funnelSource[src][name] || 0) + 1;
  }

  // 메일 링크로 온 사람 (utm_source=email)
  const clickSets = new Map<string, Set<string>>();
  const resultSets = new Map<string, Set<string>>();
  const chargeSets = new Map<string, Set<string>>();
  const payerSets = new Map<string, Set<string>>();
  const byCampaign: Record<string, number> = {};
  const campSeen = new Set<string>();
  for (const e of emailSnap.docs) {
    const d = e.data() as any;
    const day = String(d.day || '');
    if (d.internal || !inRange(day)) continue;
    const who = String(d.did || d.uid || e.id);
    const add = (m: Map<string, Set<string>>) => { const s = m.get(day) || new Set<string>(); s.add(who); m.set(day, s); };
    add(clickSets);
    const camp = String(d.utm?.campaign || '-');
    if (!campSeen.has(`${camp}|${who}`)) { campSeen.add(`${camp}|${who}`); byCampaign[camp] = (byCampaign[camp] || 0) + 1; }
    if (d.name === 'content_result') add(resultSets);
    if (d.name === 'charge_open') add(chargeSets);
    if (d.name === 'charge_complete') { add(payerSets); row.get(day)!.revenue += Number(d.props?.amount) || 0; }
  }
  for (const [day, s] of clickSets) row.get(day)!.clickers = s.size;
  for (const [day, s] of resultSets) row.get(day)!.results = s.size;
  for (const [day, s] of chargeSets) row.get(day)!.chargeOpen = s.size;
  for (const [day, s] of payerSets) row.get(day)!.payers = s.size;

  // 구독자 결제 (신청한 뒤 결제 장부, 상태 confirmed)
  let subPayers = 0; let subRevenue = 0; let subOrders = 0;
  for (const s of subs.slice(0, 1500)) {
    const pays = await db.collection(`users/${s.uid}/payments`).where('status', '==', 'confirmed').get().catch(() => null);
    if (!pays) continue;
    let paid = false;
    for (const p of pays.docs) {
      const d = p.data() as any;
      const at = tsMs(d.confirmedAt) || tsMs(d.createdAt);
      if (!at || at < s.consentMs) continue;
      subOrders += 1; subRevenue += Number(d.amount) || 0; paid = true;
    }
    if (paid) subPayers += 1;
  }

  return {
    from, to: today,
    totals: { subscribers: active + withdrawn, active, withdrawn, adConsent, adWithdrawn, subPayers, subOrders, subRevenue },
    bySource, byAge, leadSource, funnelSource, failWhy, byCampaign,
    days: days.map((d) => row.get(d)!),
  };
});
