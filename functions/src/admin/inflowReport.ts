/**
 * adminInflowReport — 유입/구매 폭증 서버 집계 (2026-06-27)
 *
 * analytics 컬렉션을 KST day 로 긁어 source·plat·시간대·구매 분해해서 JSON 반환.
 * 어드민/오너 진단용. onRequest + secret(INFLOW_KEY) 가드 (URL ?key= 또는 헤더 x-inflow-key).
 *
 * 호출: GET https://<region>-appintoss-saju.cloudfunctions.net/adminInflowReport?key=<INFLOW_KEY>&days=2026-06-26,2026-06-27
 *   (days 생략 시 어제·오늘 KST)
 *
 * ※ 토스-내부 유입(discovery/검색/추천)은 utm 자체가 없어 'toss_app(untagged)' 까지만.
 *   정확한 토스 내부 출처는 토스 개발자 콘솔 통계가 authoritative.
 */
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const INFLOW_KEY = defineSecret('INFLOW_KEY');
const db = admin.firestore();

const PURCHASE = new Set(['content_purchase', 'charge_complete']);

function kstDay(addDays = 0): string {
  const t = new Date(Date.now() + 9 * 3600e3 + addDays * 86400e3);
  return t.toISOString().slice(0, 10);
}

export const adminInflowReport = onRequest(
  { region: 'us-central1', secrets: [INFLOW_KEY], cors: true, memory: '512MiB' },
  async (req, res) => {
    try {
      const key = (req.query.key as string) || req.get('x-inflow-key') || '';
      if (!key || key !== INFLOW_KEY.value()) { res.status(403).json({ error: 'forbidden' }); return; }

      const daysParam = (req.query.days as string) || '';
      const days = daysParam
        ? daysParam.split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)).slice(0, 10)
        : [kstDay(-1), kstDay(0)];
      if (!days.length) { res.status(400).json({ error: 'no valid days' }); return; }

      const snap = await db.collection('analytics').where('day', 'in', days).get();

      const platDevices: Record<string, Set<string>> = {};
      const sourceDevices: Record<string, Set<string>> = {};
      const sourceSessions: Record<string, Set<string>> = {};
      const purchaseBySource: Record<string, number> = {};
      const purchaseByPlat: Record<string, number> = {};
      const purchaseByName: Record<string, number> = {};
      const purchaseByHour: Record<string, number> = {};
      const devicesByDay: Record<string, Set<string>> = {};
      let purchaseTotal = 0; let internalSkipped = 0;

      snap.forEach((doc) => {
        const e = doc.data() as any;
        if (e.internal) { internalSkipped++; return; } // 오너 기기 제외
        const plat = e.plat || 'unknown';
        const did = e.did || e.uid || e.sid || 'unknown';
        const sid = e.sid || did;
        const source = (e.utm && e.utm.source) ? e.utm.source : (plat === 'ait' ? 'toss_app(untagged)' : 'direct(web)');
        const day = e.day || days[0];

        (platDevices[plat] ??= new Set()).add(did);
        (sourceDevices[source] ??= new Set()).add(did);
        (sourceSessions[source] ??= new Set()).add(sid);
        (devicesByDay[day] ??= new Set()).add(did);

        if (PURCHASE.has(e.name)) {
          purchaseTotal++;
          purchaseBySource[source] = (purchaseBySource[source] ?? 0) + 1;
          purchaseByPlat[plat] = (purchaseByPlat[plat] ?? 0) + 1;
          purchaseByName[e.name] = (purchaseByName[e.name] ?? 0) + 1;
          let hour = '??';
          try {
            const ms = e.ts?.toMillis ? e.ts.toMillis() : (e.ts?._seconds ? e.ts._seconds * 1000 : null);
            if (ms) hour = new Date(ms + 9 * 3600e3).toISOString().slice(0, 13).replace('T', ' ');
          } catch { /* noop */ }
          purchaseByHour[hour] = (purchaseByHour[hour] ?? 0) + 1;
        }
      });

      const sizeMap = (m: Record<string, Set<string>>) =>
        Object.fromEntries(Object.entries(m).map(([k, s]) => [k, s.size]));
      const sortedEntries = (o: Record<string, number>) =>
        Object.entries(o).sort((a, b) => b[1] - a[1]);

      res.json({
        days,
        totalDocs: snap.size,
        internalSkipped,
        platDevices: sizeMap(platDevices),
        sourceBreakdown: Object.fromEntries(
          Object.keys(sourceDevices).map((s) => [s, {
            devices: sourceDevices[s].size,
            sessions: sourceSessions[s]?.size ?? 0,
            purchases: purchaseBySource[s] ?? 0,
          }]).sort((a: any, b: any) => b[1].devices - a[1].devices),
        ),
        purchaseTotal,
        purchaseByName: Object.fromEntries(sortedEntries(purchaseByName)),
        purchaseBySource: Object.fromEntries(sortedEntries(purchaseBySource)),
        purchaseByPlat: Object.fromEntries(sortedEntries(purchaseByPlat)),
        purchaseByHourKST: Object.fromEntries(Object.entries(purchaseByHour).sort()),
        devicesByDay: sizeMap(devicesByDay),
        note: 'toss_app(untagged)=토스내부(추천/검색) or 무태그 딥링크. direct(web)=웹 무태그. 정확한 토스내부 출처는 토스 콘솔 통계.',
      });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  },
);
