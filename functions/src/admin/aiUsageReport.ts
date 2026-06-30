/**
 * adminAiUsageReport (2026-06-30) — aiUsage 토큰 소비 집계 (토큰 폭증 진단용).
 *   GET ?key=<INFLOW_KEY>&days=N  →  콘텐츠타입별·모델별·일자별 토큰/호출/실패/추정비용.
 *   읽기 전용(Firestore aiUsage 집계) · AI 호출 0.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

const INFLOW_KEY = defineSecret('INFLOW_KEY');

/** 모델별 $/1M (in/out) — 상대 비교용 근사치 */
function rate(model: string): { i: number; o: number } {
  const m = (model || '').toLowerCase();
  if (m.includes('opus')) return { i: 5, o: 25 };
  if (m.includes('sonnet')) return { i: 3, o: 15 };
  if (m.includes('flash')) return { i: 0.3, o: 2.5 };
  if (m.includes('gemini')) return { i: 1.25, o: 10 };
  return { i: 3, o: 15 };
}

export const adminAiUsageReport = onRequest(
  { secrets: [INFLOW_KEY], cors: true, invoker: 'public', memory: '512MiB', timeoutSeconds: 120 },
  async (req, res) => {
    if (req.query.key !== INFLOW_KEY.value()) { res.status(403).send('forbidden'); return; }
    const db = admin.firestore();
    const daysBack = Math.min(7, Math.max(1, Number(req.query.days) || 2));
    const base = new Date(Date.now() + 9 * 3600 * 1000); // KST
    const days: string[] = [];
    for (let i = 0; i < daysBack; i++) days.push(new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10));

    const snap = await db.collection('aiUsage').where('day', 'in', days).get();
    const byType: Record<string, any> = {};
    const byModel: Record<string, any> = {};
    const byTypeDay: Record<string, any> = {};
    let totIn = 0, totOut = 0, totCost = 0, calls = 0, fails = 0;

    snap.forEach((doc) => {
      const e = doc.data() as any;
      const iT = Number(e.inputTokens) || 0, oT = Number(e.outputTokens) || 0;
      const r = rate(e.model);
      const cost = (iT / 1e6) * r.i + (oT / 1e6) * r.o;
      const ok = e.ok !== false;
      totIn += iT; totOut += oT; totCost += cost; calls++; if (!ok) fails++;
      const tk = e.type || '?';
      byType[tk] = byType[tk] || { calls: 0, fail: 0, inTok: 0, outTok: 0, cost: 0 };
      byType[tk].calls++; if (!ok) byType[tk].fail++; byType[tk].inTok += iT; byType[tk].outTok += oT; byType[tk].cost += cost;
      const mk = e.model || '?';
      byModel[mk] = byModel[mk] || { calls: 0, inTok: 0, outTok: 0, cost: 0 };
      byModel[mk].calls++; byModel[mk].inTok += iT; byModel[mk].outTok += oT; byModel[mk].cost += cost;
      const tdk = `${e.day}|${tk}`;
      byTypeDay[tdk] = byTypeDay[tdk] || { calls: 0, cost: 0 };
      byTypeDay[tdk].calls++; byTypeDay[tdk].cost += cost;
    });

    // ── 실패 추적 (2026-07-01) — 클라 ai_error(analytics) + 서버 aiFailures ──
    const aiErrors: Record<string, any> = {};
    try {
      const errSnap = await db.collection('analytics').where('name', '==', 'ai_error').limit(2000).get();
      errSnap.forEach((doc) => {
        const e = doc.data() as any;
        if (!days.includes(e.day)) return;
        const p = e.props || {};
        const k = `${e.day}|${p.type || '?'}|${p.mode || '?'}`;
        aiErrors[k] = aiErrors[k] || { count: 0, reasons: {} };
        aiErrors[k].count++;
        const rsn = String(p.reason || '(reason 없음·구버전)').slice(0, 90);
        aiErrors[k].reasons[rsn] = (aiErrors[k].reasons[rsn] || 0) + 1;
      });
    } catch (e: any) { aiErrors['_queryError'] = String(e?.message || e); }

    const serverFails: Record<string, any> = {};
    try {
      const fSnap = await db.collection('aiFailures').where('day', 'in', days).get();
      fSnap.forEach((doc) => {
        const e = doc.data() as any;
        const k = `${e.day}|${e.type || '?'}|${e.stage || '?'}`;
        serverFails[k] = serverFails[k] || { count: 0, samples: [] };
        serverFails[k].count++;
        if (serverFails[k].samples.length < 3) serverFails[k].samples.push(String(e.message || '').slice(0, 140));
      });
    } catch (e: any) { serverFails['_queryError'] = String(e?.message || e); }

    const r2 = (o: any) => { for (const k in o) o[k].cost = Math.round(o[k].cost * 1000) / 1000; return o; };
    res.json({
      days, totalDocs: snap.size, totalCalls: calls, failCalls: fails,
      totalInputTokens: totIn, totalOutputTokens: totOut,
      estTotalCostUsd: Math.round(totCost * 100) / 100,
      byType: r2(byType), byModel: r2(byModel), byTypeDay: r2(byTypeDay),
      aiErrors, serverFails,
    });
  }
);
