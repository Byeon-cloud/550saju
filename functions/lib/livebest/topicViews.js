"use strict";
/**
 * LIVE BEST 실시간 집계 (2026-06-02 · Sprint2 D3 "임시구현 금지, 정식 구현")
 *
 *  · recordTopicView (callable) — 결과 페이지 도달 시 조회 1건 기록.
 *      어뷰징 방어: uid+topicId 24h 쿨다운 (1인 1주제 하루 1카운트).
 *      시간 버킷(YYYYMMDDHH)별 increment → liveBestCounts/{topicId}.buckets.{hour}.
 *  · aggregateTopicTop5 (scheduled · 매시) — 최근 24h 버킷 합산 → 랭킹 → liveBestCache/top5 캐시.
 *      48h 초과 버킷은 prune (문서 비대화 방지).
 *
 *  데이터 (functions 전용 · 클라 직접 접근 차단):
 *   - liveBestCounts/{topicId}   { buckets: {hourKey: n}, updatedAt }
 *   - liveBestCooldown/{uid_topicId} { at }
 *   - liveBestCache/top5         { ids[], counts{}, totalViews, updatedAt }  ← 클라 read-only
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateTopicTop5 = exports.recordTopicView = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
// 랭킹 대상 id 화이트리스트 (HomePage LIVE BEST 풀과 동일 키)
const RANKABLE_IDS = new Set([
    'premium', 'daily', 'dream',
    'love', 'reunion', 'marriage', 'wealth', 'exam',
    'business', 'health', 'move', 'study', 'career',
]);
const DAY_MS = 24 * 60 * 60 * 1000;
/** UTC 시간 버킷 키 'YYYYMMDDHH' (집계는 상대 비교라 TZ 무관). */
function hourKey(d) {
    return d.toISOString().slice(0, 13).replace(/[-T:]/g, '');
}
function hourKeyToMillis(hk) {
    const y = +hk.slice(0, 4), mo = +hk.slice(4, 6) - 1, d = +hk.slice(6, 8), h = +hk.slice(8, 10);
    return Date.UTC(y, mo, d, h);
}
/* ───────────────────────────────────────────────────────────
 * recordTopicView — 조회 1건 기록 (fire&forget · 비로그인/쿨다운은 조용히 skip)
 * ─────────────────────────────────────────────────────────── */
exports.recordTopicView = (0, https_1.onCall)({ timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const uid = request.auth?.uid;
    // 비로그인은 카운트 X (throw 하지 않음 — 클라가 fire&forget)
    if (!uid)
        return { counted: false, reason: 'unauthenticated' };
    const topicId = String(request.data?.topicId || '').trim();
    if (!RANKABLE_IDS.has(topicId))
        throw new https_1.HttpsError('invalid-argument', 'invalid topicId');
    const db = admin.firestore();
    const cooldownRef = db.doc(`liveBestCooldown/${uid}_${topicId}`);
    const countRef = db.doc(`liveBestCounts/${topicId}`);
    const now = Date.now();
    return await db.runTransaction(async (tx) => {
        const cd = await tx.get(cooldownRef);
        const lastAt = cd.exists ? (cd.data()?.at?.toMillis?.() ?? 0) : 0;
        if (now - lastAt < DAY_MS)
            return { counted: false, reason: 'cooldown' };
        tx.set(cooldownRef, { at: admin.firestore.FieldValue.serverTimestamp(), topicId });
        tx.set(countRef, {
            buckets: { [hourKey(new Date(now))]: admin.firestore.FieldValue.increment(1) },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { counted: true };
    });
});
/* ───────────────────────────────────────────────────────────
 * aggregateTopicTop5 — 매시 실행: 최근 24h 합산 → 랭킹 → 캐시 (+48h prune)
 * ─────────────────────────────────────────────────────────── */
exports.aggregateTopicTop5 = (0, scheduler_1.onSchedule)({
    schedule: 'every 60 minutes',
    timeoutSeconds: 120,
    memory: '256MiB',
    minInstances: 0,
    region: 'us-central1',
}, async () => {
    const db = admin.firestore();
    const now = Date.now();
    const cutoff24 = now - DAY_MS;
    const cutoff48 = now - 2 * DAY_MS;
    const snaps = await db.collection('liveBestCounts').get();
    const ranked = [];
    for (const doc of snaps.docs) {
        const topicId = doc.id;
        if (!RANKABLE_IDS.has(topicId))
            continue;
        const buckets = doc.data()?.buckets || {};
        let sum24 = 0;
        const pruned = {};
        let needsPrune = false;
        for (const [hk, cntRaw] of Object.entries(buckets)) {
            const cnt = Number(cntRaw) || 0;
            const t = hourKeyToMillis(hk);
            if (t >= cutoff48)
                pruned[hk] = cnt;
            else
                needsPrune = true;
            if (t >= cutoff24)
                sum24 += cnt;
        }
        ranked.push({ topicId, count: sum24 });
        // 48h 초과 버킷 정리 (race window 무시 가능 — 저빈도)
        if (needsPrune) {
            try {
                await doc.ref.update({ buckets: pruned });
            }
            catch { /* noop */ }
        }
    }
    ranked.sort((a, b) => b.count - a.count);
    const top = ranked.filter((r) => r.count > 0).slice(0, 8);
    await db.doc('liveBestCache/top5').set({
        ids: top.map((r) => r.topicId),
        counts: Object.fromEntries(top.map((r) => [r.topicId, r.count])),
        totalViews: ranked.reduce((s, r) => s + r.count, 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
});
//# sourceMappingURL=topicViews.js.map