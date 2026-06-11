"use strict";
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
exports.fixPayDatesOnce = exports.generatePremiumPdf = exports.renderSajuCardOgImage = exports.renderSajuCardOg = exports.renderShareOg = exports.aggregateTopicTop5 = exports.recordTopicView = exports.claimCompensation = exports.deleteAccount = exports.onInviteReceived = exports.markAttendance = exports.generateTopicAnalysisStream = exports.generateTopicAnalysis = exports.disconnectToss = exports.confirmPayment = exports.grantShareReward = exports.generateTojung = exports.generateCompatibility = exports.generateMonthly = exports.generateDaeun = exports.grantPurchase = exports.generateDreamDeep = exports.generateDreamFreeStream = exports.generateDreamFree = exports.generateDream = exports.generateChatAnswer = exports.generateDailyFortuneStream = exports.generateDailyFortune = exports.generateReport = exports.generateReportStream = exports.generatePremiumReportStream = exports.warmupGenerateReport = exports.loginWithToss = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
// AI 모듈은 호출 시 동적 import — 초기화 타임아웃 방지
const lazyClaudeReport = () => Promise.resolve().then(() => __importStar(require('./ai/claudeReport')));
const lazyClaudeDaeun = () => Promise.resolve().then(() => __importStar(require('./ai/claudeDaeun')));
const lazyClaudeMonthly = () => Promise.resolve().then(() => __importStar(require('./ai/claudeMonthly')));
const lazyClaudeCompat = () => Promise.resolve().then(() => __importStar(require('./ai/claudeCompat')));
const lazyClaudeTojung = () => Promise.resolve().then(() => __importStar(require('./ai/claudeTojung')));
const lazyClaudeFortune = () => Promise.resolve().then(() => __importStar(require('./ai/claudeFortune')));
// 사주대화 — 2026-04-21 모델 재할당: Gemini 2.5 Pro → Claude Sonnet 4.6
//   gemini* 파일 5종 (Chat·Dream·Fortune·Tojung·Topic) 2026-05-05 dead code 제거
const lazyClaudeChat = () => Promise.resolve().then(() => __importStar(require('./ai/claudeChat')));
const lazyClaudeDream = () => Promise.resolve().then(() => __importStar(require('./ai/claudeDream')));
const lazyClaudeTopic = () => Promise.resolve().then(() => __importStar(require('./ai/claudeTopic')));
const lazyTossAuth = () => Promise.resolve().then(() => __importStar(require('./auth/tossAuth')));
admin.initializeApp();
const db = admin.firestore();
const ANTHROPIC_KEY = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
const GEMINI_KEY = (0, params_1.defineSecret)('GEMINI_API_KEY');
const TOSS_MTLS_CERT = (0, params_1.defineSecret)('TOSS_MTLS_CERT');
const TOSS_MTLS_KEY = (0, params_1.defineSecret)('TOSS_MTLS_KEY');
const TOSS_DECRYPT_KEY = (0, params_1.defineSecret)('TOSS_DECRYPT_KEY');
const TOSS_DECRYPT_AAD = (0, params_1.defineSecret)('TOSS_DECRYPT_AAD');
const TOSS_PAYMENTS_SECRET = (0, params_1.defineSecret)('TOSS_PAYMENTS_SECRET_KEY');
/** 금액 → 패키지 매핑 (서버에서 검증용) */
const PACKAGE_MAP = {
    500: { name: '한 번만', paidUn: 1, bonusUn: 0 },
    1500: { name: '좀 더 보자', paidUn: 3, bonusUn: 1 },
    2500: { name: '제대로 보자', paidUn: 5, bonusUn: 2 },
    5000: { name: '올해 다 보자', paidUn: 10, bonusUn: 5 },
};
const TOSS_DISCONNECT_AUTH = (0, params_1.defineSecret)('TOSS_DISCONNECT_AUTH');
// 개발 중: 인증 없이도 동작
// 런칭 시: DEV_MODE = false
/**
 * 토스 로그인 — authorizationCode → Firebase Custom Token
 */
// Gen 2 Functions — cors: true 로 비인증 호출 허용 (Firebase SDK가 자체 인증 처리)
exports.loginWithToss = (0, https_1.onCall)({
    secrets: [TOSS_MTLS_CERT, TOSS_MTLS_KEY, TOSS_DECRYPT_KEY, TOSS_DECRYPT_AAD],
    timeoutSeconds: 15,
    memory: '256MiB',
    cors: true,
}, async (request) => {
    const { authorizationCode } = request.data;
    if (!authorizationCode)
        throw new https_1.HttpsError('invalid-argument', 'authorizationCode 필요');
    try {
        const { exchangeTossToken } = await lazyTossAuth();
        const result = await exchangeTossToken(authorizationCode, TOSS_MTLS_CERT.value(), TOSS_MTLS_KEY.value(), TOSS_DECRYPT_KEY.value(), TOSS_DECRYPT_AAD.value());
        return result;
    }
    catch (error) {
        console.error('[loginWithToss]', error);
        throw new https_1.HttpsError('internal', `로그인 실패: ${error.message}`);
    }
});
const DEV_MODE = false;
/**
 * AI 실패 시 서버 환불 헬퍼 — 차감했던 운을 되돌려 줌.
 * 악의적 환불 어뷰징을 막기 위해 반드시 "차감이 실제로 일어난 경우"에만 호출해야 함.
 *  → 호출부에서 deducted > 0 조건으로 가드.
 */
async function refundBalance(uid, deducted, reason) {
    if (!uid || deducted <= 0)
        return;
    try {
        // 2026-05-28 — balance schema 통일. 객체(paid/bonus/reward) 가 있으면 paid 에 환불, 숫자면 통합 환불.
        //   결제분만 환불 가능 (paid 우선) — 무료 보너스 환불은 어뷰징 위험.
        const userRef = db.collection('users').doc(uid);
        await db.runTransaction(async (tx) => {
            const doc = await tx.get(userRef);
            const data = doc.data() || {};
            const bal = data.balance;
            const updates = {
                totalSpent: admin.firestore.FieldValue.increment(-deducted),
                lastRefundAt: admin.firestore.FieldValue.serverTimestamp(),
                lastRefundReason: reason,
            };
            if (typeof bal === 'object' && bal !== null) {
                updates['balance.paid'] = admin.firestore.FieldValue.increment(deducted);
            }
            else {
                updates.balance = admin.firestore.FieldValue.increment(deducted);
            }
            tx.update(userRef, updates);
        });
        console.log(`[refundBalance] uid=${uid} amount=${deducted} reason=${reason}`);
    }
    catch (refundErr) {
        // 환불 실패해도 원래 오류는 그대로 던져야 하므로 로그만 남김
        console.error(`[refundBalance] 환불 실패 uid=${uid} amount=${deducted}: ${refundErr?.message || refundErr}`);
    }
}
/**
 * 2026-05-28 — balance schema 통일 헬퍼.
 * 클라이언트 충전(confirmPayment/grantPurchase)은 `balance.paid` `balance.bonus` 객체 schema 사용.
 * 그러나 기존 generate* 함수들은 `balance` 가 숫자라고 가정 → 첫 결제 후 분석 시 schema 충돌.
 * 이 헬퍼가 양쪽 schema 안전 처리:
 *   - 객체면 paid+bonus+reward 합으로 비교 + reward→bonus→paid 순 차감 (localStore SSOT 일치)
 *   - 숫자면 그대로 비교 + 통합 차감 (legacy 데이터 호환)
 */
function computeBalanceDeduction(data, cost) {
    const bal = data?.balance;
    if (typeof bal === 'object' && bal !== null) {
        const reward = Number(bal.reward) || 0;
        const bonus = Number(bal.bonus) || 0;
        const paid = Number(bal.paid) || 0;
        const total = reward + bonus + paid;
        if (total < cost)
            return null;
        let rem = cost;
        const dr = Math.min(rem, reward);
        rem -= dr;
        const db_ = Math.min(rem, bonus);
        rem -= db_;
        const dp = rem;
        const updates = {
            totalSpent: admin.firestore.FieldValue.increment(cost),
        };
        if (dr > 0)
            updates['balance.reward'] = admin.firestore.FieldValue.increment(-dr);
        if (db_ > 0)
            updates['balance.bonus'] = admin.firestore.FieldValue.increment(-db_);
        if (dp > 0)
            updates['balance.paid'] = admin.firestore.FieldValue.increment(-dp);
        return { totalBefore: total, updates };
    }
    const num = typeof bal === 'number' ? bal : 0;
    if (num < cost)
        return null;
    return {
        totalBefore: num,
        updates: {
            balance: admin.firestore.FieldValue.increment(-cost),
            totalSpent: admin.firestore.FieldValue.increment(cost),
        },
    };
}
/**
 * T4 · Pre-warming · generateReport 인스턴스 깨우기
 *  · InputPage 의 폼이 valid 가 되는 순간 백그라운드로 ping → 인스턴스 warm 상태 확보
 *  · idempotent · auth 불필요 · 단순 200 응답만
 *
 * 2026-05-29 PM 비용 fix — minInstances: 1→0.
 *   기존: 항상 256MiB 컨테이너 24h idle (월 ₩5K~).
 *   런칭 전 트래픽 0 인 상태에서 warm 의미 없음. 호출 시 cold start (1~3s) 흡수.
 */
exports.warmupGenerateReport = (0, https_1.onCall)({ timeoutSeconds: 10, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' }, async () => {
    return { ok: true, ts: Date.now() };
});
/**
 * T1 · Streaming SSE · 프리미엄 리포트 그룹 단위 점진 송출
 *  · onRequest (HTTP) — SSE 응답 (text/event-stream)
 *  · 각 그룹 (A/B/C) 완료 시점에 즉시 송출 → 클라이언트가 progressive 렌더
 *  · 첫 그룹 ~25-30s 도착, 전체 ~30-35s 완료 (T2 병렬 결합)
 *  · Opus 4.6 단일 모델 — 퀄리티·통일성 보장
 *  · 인증: Authorization: Bearer <Firebase ID Token>
 *  · 잔액 차감 + 환불 + Firestore 저장은 generateReport 와 동일 패턴
 */
exports.generatePremiumReportStream = (0, https_1.onRequest)({
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 540, // SSE 장기 연결 — 9분 (Cloud Run 최대)
    memory: '1GiB',
    minInstances: 0, // 2026-05-29 PM 비용 fix — 1GiB 상시대기 (월 ₩12K) → 0. cold start UX 로 흡수.
    cors: true,
    invoker: 'public',
}, async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    // SSE 헤더
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Cloud Run buffer 비활성
        'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    // 인증 — Firebase ID Token 검증
    let uid = 'anonymous';
    let isAnonymous = true;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const decoded = await admin.auth().verifyIdToken(token);
            uid = decoded.uid;
            isAnonymous = decoded.firebase?.sign_in_provider === 'anonymous';
        }
        catch {
            // 토큰 invalid — anonymous 처리
        }
    }
    const { sajuData, situation } = req.body || {};
    if (!sajuData) {
        sendEvent('error', { message: '사주 데이터가 없습니다' });
        res.end();
        return;
    }
    // 잔액 차감 (premium = 10운) — 실명 로그인만
    let deductedAmount = 0;
    if (!DEV_MODE && uid !== 'anonymous' && !isAnonymous) {
        const cost = 10;
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            try {
                // 2026-05-28 — schema 통일 helper (객체/숫자 양쪽 지원)
                await db.runTransaction(async (tx) => {
                    const doc = await tx.get(userRef);
                    const result = computeBalanceDeduction(doc.data(), cost);
                    if (!result)
                        throw new Error('운이 부족합니다');
                    tx.update(userRef, result.updates);
                });
                deductedAmount = cost;
            }
            catch (e) {
                sendEvent('error', { message: e.message || '잔액 차감 실패' });
                res.end();
                return;
            }
        }
    }
    // T1 · 3 그룹 병렬 + 각 그룹 완료 시점에 SSE 송출
    sendEvent('start', { ts: Date.now() });
    const groups = ['A', 'B', 'C'];
    const results = {};
    try {
        const mod = await Promise.resolve().then(() => __importStar(require('./ai/claudePremium')));
        const apiKey = ANTHROPIC_KEY.value();
        // 각 그룹 병렬 호출 — Promise.all 대신 개별 then 으로 도착 즉시 송출
        const groupPromises = groups.map(async (g) => {
            const t0 = Date.now();
            try {
                const result = await mod.generateGroup(apiKey, sajuData, g, situation);
                results[g] = result;
                sendEvent('group', {
                    group: g,
                    data: result,
                    elapsedMs: Date.now() - t0,
                });
            }
            catch (e) {
                sendEvent('groupError', { group: g, message: e.message || 'unknown' });
                throw e;
            }
        });
        await Promise.all(groupPromises);
        // 모든 그룹 완료 → merge + Firestore 저장
        const merged = {
            tier: 'premium',
            ...results.A,
            ...results.B,
            ...results.C,
            sections: [
                ...(results.A?.sections || []),
                ...(results.B?.sections || []),
            ],
            sectionConclusions: {
                ...(results.A?.sectionConclusions || {}),
                ...(results.B?.sectionConclusions || {}),
                ...(results.C?.sectionConclusions || {}),
            },
        };
        // Firestore 저장 (best-effort)
        const reportRef = db.collection('reports').doc();
        try {
            await reportRef.set({
                uid,
                type: 'premium',
                aiModel: 'claude-opus-4-6',
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                shareEnabled: false,
            });
        }
        catch {
            // silent — 저장 실패해도 사용자에겐 결과 전달
        }
        sendEvent('done', { reportId: reportRef.id, content: merged });
        res.end();
    }
    catch (error) {
        console.error('generatePremiumReportStream error:', error);
        // 환불
        if (deductedAmount > 0) {
            await refundBalance(uid, deductedAmount, 'generatePremiumReportStream failed');
        }
        sendEvent('error', { message: error?.message || 'AI 분석 실패' });
        res.end();
    }
});
/* ══════════════════════════════════════════════════════════════════
 * generateReportStream — 1운 리포트 SSE 스트리밍 (Phase 1 · 2026-05-27)
 *
 * 종합사주 SSE 와 동일 패턴: 3 그룹(A·B·C) 병렬 호출 + 도착 즉시 송출.
 * callable generateReport 와 프롬프트·모델·머지 100% 동일 (전송만 SSE).
 * 클라가 첫 그룹 도착(~25-30s) 시 결과 페이지 진입 → 점진 렌더 가능.
 *
 * 잔액 차감 1운 (premium 의 10운 과 차이) · 환불·Firestore 저장은 callable 과 동일.
 * ═════════════════════════════════════════════════════════════════ */
exports.generateReportStream = (0, https_1.onRequest)({
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 540,
    memory: '1GiB',
    minInstances: 0, // 2026-05-29 PM 비용 fix — 1GiB 상시대기 (월 ₩12K) → 0. cold start UX 로 흡수.
    cors: true,
    invoker: 'public',
}, async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    let uid = 'anonymous';
    let isAnonymous = true;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const decoded = await admin.auth().verifyIdToken(token);
            uid = decoded.uid;
            isAnonymous = decoded.firebase?.sign_in_provider === 'anonymous';
        }
        catch { /* anonymous */ }
    }
    const { sajuData, situation } = req.body || {};
    if (!sajuData) {
        sendEvent('error', { message: '사주 데이터가 없습니다' });
        res.end();
        return;
    }
    // 잔액 차감 (1운 · basic 1운 리포트)
    let deductedAmount = 0;
    if (!DEV_MODE && uid !== 'anonymous' && !isAnonymous) {
        const cost = 1;
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            try {
                // 2026-05-28 — schema 통일 helper
                await db.runTransaction(async (tx) => {
                    const doc = await tx.get(userRef);
                    const result = computeBalanceDeduction(doc.data(), cost);
                    if (!result)
                        throw new Error('운이 부족합니다');
                    tx.update(userRef, result.updates);
                });
                deductedAmount = cost;
            }
            catch (e) {
                sendEvent('error', { message: e.message || '잔액 차감 실패' });
                res.end();
                return;
            }
        }
    }
    sendEvent('start', { ts: Date.now() });
    const groups = ['A', 'B', 'C'];
    const results = {};
    try {
        const mod = await Promise.resolve().then(() => __importStar(require('./ai/claudeReport')));
        const apiKey = ANTHROPIC_KEY.value();
        // 그룹별 병렬 — 도착 즉시 송출 (Promise.all 대신 then 패턴)
        const groupPromises = groups.map(async (g) => {
            const t0 = Date.now();
            try {
                const result = await mod.generateReportGroup(apiKey, sajuData, situation, g);
                results[g] = result;
                sendEvent('group', { group: g, data: result, elapsedMs: Date.now() - t0 });
            }
            catch (e) {
                sendEvent('groupError', { group: g, message: e.message || 'unknown' });
                throw e;
            }
        });
        await Promise.all(groupPromises);
        const merged = mod.mergeReportGroups(results.A, results.B, results.C);
        // Firestore 저장 (callable 과 동일 패턴)
        const reportRef = db.collection('reports').doc();
        try {
            await reportRef.set({
                uid,
                type: 'basic',
                aiModel: 'claude-opus-4-6',
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                shareEnabled: false,
            });
        }
        catch { /* silent */ }
        sendEvent('done', { reportId: reportRef.id, content: merged });
        res.end();
    }
    catch (error) {
        console.error('generateReportStream error:', error);
        if (deductedAmount > 0) {
            await refundBalance(uid, deductedAmount, 'generateReportStream failed');
        }
        sendEvent('error', { message: error?.message || 'AI 분석 실패' });
        res.end();
    }
});
/**
 * 사주 리포트 생성 — Claude Opus 4.6 (env SAJU_REPORT_MODEL로 오버라이드 가능)
 */
exports.generateReport = (0, https_1.onCall)(
// 2026-05-29 PM 비용 fix — minInstances: 1→0. 1GiB 상시대기 (월 ₩12K) → 0. cold start UX 로 흡수.
{ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { sajuData, situation, reportType } = request.data;
    if (!sajuData)
        throw new https_1.HttpsError('invalid-argument', '사주 데이터가 없습니다');
    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0; // 환불용 차감 기록
    // 런칭 시 잔액 차감 — 실명 로그인 유저만 (익명 유저는 Firestore 문서 없음)
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const cost = reportType === 'premium' ? 10 : 1;
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            // 2026-05-28 — schema 통일 helper
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const result = computeBalanceDeduction(doc.data(), cost);
                if (!result)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, result.updates);
            });
            deductedAmount = cost;
        }
    }
    try {
        console.log(`[generateReport] Starting Claude call... reportType=${reportType}`);
        // ✅ 핵심 수정 (2026-05) — reportType 별 정확한 분기
        //   premium → generatePremiumReport (T2 병렬 + lifeEdge/sipCluster/shinsalCards/rel6Cards/topicMini/monthlyInsight 풀 schema)
        //   basic   → generateSajuReport    (1운 기본 schema)
        // 이전 버그: 무조건 generateSajuReport 호출 → premium 결제 시에도 basic schema 반환 → 클라 PremiumResult 렌더 깨짐
        let result;
        if (reportType === 'premium') {
            const premMod = await Promise.resolve().then(() => __importStar(require('./ai/claudePremium')));
            result = await premMod.generatePremiumReport(ANTHROPIC_KEY.value(), sajuData, situation);
        }
        else {
            const mod = await lazyClaudeReport();
            result = await mod.generateSajuReport(ANTHROPIC_KEY.value(), sajuData, situation, reportType || 'basic');
        }
        console.log('[generateReport] Claude response received, keys:', Object.keys(result?.content || {}));
        // Firestore에 리포트 저장 (content는 큰 JSON이라 별도 저장)
        const reportRef = db.collection('reports').doc();
        try {
            await reportRef.set({
                uid,
                type: reportType || 'basic',
                aiModel: 'claude-opus-4-6',
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                shareEnabled: false,
            });
            console.log('[generateReport] Firestore saved');
        }
        catch (fsErr) {
            console.error('[generateReport] Firestore save failed:', fsErr.message);
        }
        console.log('[generateReport] Returning result');
        return { reportId: reportRef.id, ...result };
    }
    catch (error) {
        console.error('generateReport error:', error);
        // 서버 환불 — 차감한 잔액을 되돌려 줌 (AI/Firestore 실패 시)
        await refundBalance(uid, deductedAmount, 'generateReport failed');
        throw new https_1.HttpsError('internal', `AI 분석 실패: ${error.message || 'unknown'}`);
    }
});
/**
 * 오늘의 운세 — Claude Sonnet 4.6 (v3 스키마).
 *   입력: { name, sajuData, date, weekday, todayGanzi, jeolgi?, dayJiShen?, dayXiongSha? }
 *   출력: v3 DailyFortune JSON (AI프롬프트_v3 §5 참조).
 *   쿼터: 일 1회 캐시 (Firestore users/{uid}/dailyFortune/{YYYY-MM-DD}).
 */
exports.generateDailyFortune = (0, https_1.onCall)(
// minInstances: 0 — warm 비용 대신 로딩 UX 로 Cold start 흡수 (feedback_quality_over_speed 원칙)
{ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { name, sajuData, date, weekday, todayGanzi, jeolgi, dayJiShen, dayXiongSha } = request.data || {};
    if (!sajuData || !date || !todayGanzi) {
        throw new https_1.HttpsError('invalid-argument', '사주·날짜·오늘 간지가 필요합니다');
    }
    const uid = request.auth?.uid;
    // 당일 캐시 확인 (실명 유저만)
    if (uid && !request.auth?.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const cacheRef = db.collection('users').doc(uid).collection('dailyFortune').doc(date);
        const cached = await cacheRef.get();
        if (cached.exists) {
            const d = cached.data();
            if (d?.content) {
                console.log(`[generateDailyFortune] cache hit uid=${uid} date=${date}`);
                return d.content;
            }
        }
    }
    try {
        console.log('[generateDailyFortune] Starting Sonnet 4.6 call...');
        const { generateDailyFortuneAnalysis } = await lazyClaudeFortune();
        const result = await generateDailyFortuneAnalysis(ANTHROPIC_KEY.value(), {
            name: name || '사용자',
            sajuData,
            date,
            weekday: weekday || '',
            todayGanzi,
            jeolgi,
            dayJiShen,
            dayXiongSha,
        });
        // 캐싱 (실명 유저만)
        if (uid && !request.auth?.token?.firebase?.sign_in_provider?.includes('anonymous')) {
            const cacheRef = db.collection('users').doc(uid).collection('dailyFortune').doc(date);
            await cacheRef.set({
                content: result,
                aiModel: 'claude-sonnet-4-6',
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return result;
    }
    catch (error) {
        console.error('[generateDailyFortune] FAILED:', error.message, error.stack);
        throw new https_1.HttpsError('internal', `오늘의 운세 생성 실패: ${error.message || 'unknown'}`);
    }
});
/** 키워드 1차 필터 (Layer 1) — 사주 도메인 false positive 방지 위해 의도 결합형.
 *  "단명" 단독은 사주 용어라 매칭 X, "단명.*편한|나아|좋|차라리|어차피" 같이 결합해야만 발동. */
const GUARD_KEYWORDS = [
    // 자살·자해
    { re: /죽는\s*법|죽는\s*방법|자살|안\s*아프게\s*(죽|가)|목숨\s*끊|삶을\s*(끝|마)|살기\s*싫|단명.*(편한|나아|좋|차라리|어차피)|몇\s*살에\s*죽|언제\s*죽/, cat: 'self_harm' },
    // 마약
    { re: /필로폰|코카인|대마.*(제조|효과)|methamphetamine|cocaine|마약.*(구|만드)/i, cat: 'drugs' },
    // 범죄
    { re: /들키지\s*않고|보험금\s*사기|주민번호\s*도용|해킹|위조|사기.*(유리|성공)/, cat: 'crime' },
    // 투자
    { re: /로또.*번호|복권.*번호|주식.*(대박|급등|예측|찍어|뭐\s*사)|코인.*(대박|예측|찍)/, cat: 'investment' },
    // 의료·법률 단정
    { re: /암.*(확정|걸리는지)|이혼.*(100%|확실)|승소.*확실/, cat: 'medical_legal' },
];
/** 카테고리별 가드 응답 (핫라인 안내 포함). */
const GUARD_RESPONSE = {
    self_harm: '사주는 결정된 운명을 알려주는 도구가 아닙니다. 지금 마음이 많이 힘드시면 자살예방상담전화 1393(24시간), 정신건강상담 1577-0199에 연락해 주세요. 사주 상담은 다음 기회에 다시 찾아주시면 좋겠습니다.',
    drugs: '사주 상담은 약물 관련 정보를 제공하지 않습니다. 마약류중독상담 1342로 연결해 드립니다.',
    crime: '타인에게 해를 끼치거나 법을 어기는 일에 대한 상담은 어렵습니다. 범죄신고 112 · 사이버범죄 118 로 문의해 주세요.',
    investment: '사주는 특정 종목·번호를 예측하지 않습니다. 재물운의 흐름과 시기는 안내드릴 수 있습니다. 금융투자의 결과는 본인 책임이며, 전문가 자문을 권해드립니다.',
    medical_legal: '의료·법률 단정은 사주의 영역이 아닙니다. 사주는 가능성과 흐름을 보는 도구입니다. 확정 진단은 해당 분야 전문가의 진단·자문을 권해드립니다.',
};
/** 키워드 1차 필터 — 매칭 시 카테고리 반환, 미매칭 시 null. */
function detectByKeyword(question) {
    for (const { re, cat } of GUARD_KEYWORDS) {
        if (re.test(question))
            return cat;
    }
    return null;
}
/** guard_hits 로깅 (실패해도 응답은 정상 반환). source=keyword|llm */
async function logGuardHit(args) {
    try {
        await db.collection('guard_hits').add({
            uid: args.uid,
            category: args.category,
            source: args.source,
            rawInput: String(args.question).slice(0, 500),
            modelResponse: (args.modelResponse ?? '').slice(0, 1000),
            at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (e) {
        console.warn('[generateChatAnswer] guard_hits 로깅 실패:', e?.message);
    }
}
/* ══════════════════════════════════════════════════════════════════
 * generateDailyFortuneStream — SSE 무료 오늘운세 v6 (2026-05-06)
 *
 * 4-stack 최적화:
 *   L1 · Shared Cache by (사주 8글자 + 날짜) — uid 무관
 *        쌍둥이/같은 사주 패턴/재방문 모두 cache hit. pre-gen 노쇼 비용 0.
 *        first-paint <1s · full <1s 모두 cache hit 시.
 *   L2 · Parallel Group A/B — 같은 SYSTEM 공유 (caching) + 두 USER 병렬 호출
 *        Group A (priority): §01 본문 + §02 점수 → 첫 paint 5~8s
 *        Group B (rest):     §03~§07 행동/럭키/내일
 *        max(A,B) ≈ 15~25s · 단일 호출 30~60s 대비 40~60% 단축
 *   L4 · Streaming chunks — Group A 진행 중에도 partial JSON 노출 (Progressive Render)
 *
 * 흐름:
 *   1. 인증 (Bearer optional)
 *   2. shared cache hit by (8글자_날짜) → 즉시 'done'
 *   3. cache miss → Group A·B 병렬 호출 시작
 *   4. 각 group chunk 마다 'chunk' (group:'A'|'B' 표식) — Progressive Render
 *   5. 각 group 완료 시 'group' 이벤트 (early phase transition trigger)
 *   6. 둘 다 완료 → merge → shared cache 저장 → 'done'
 * ═════════════════════════════════════════════════════════════════ */
/** 사주 8글자 키 추출 — pillars 0~3 의 천간/지지 합. 시간 미입력은 'XX'. */
function buildSajuKey(sajuData) {
    try {
        const p = sajuData?.pillars || [];
        const ch = (i) => {
            const pillar = p[i];
            if (!pillar || pillar.available === false)
                return 'XX';
            return `${pillar.천간 || 'X'}${pillar.지지 || 'X'}`;
        };
        return `${ch(0)}${ch(1)}${ch(2)}${ch(3)}`;
    }
    catch {
        return 'XXXXXXXX';
    }
}
exports.generateDailyFortuneStream = (0, https_1.onRequest)({
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    minInstances: 0, // 2026-05-29 PM 비용 fix — 1GiB 상시대기 (월 ₩12K) → 0. cold start UX 로 흡수.
    cors: true,
    invoker: 'public',
}, async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    // 인증 (optional — anonymous 도 통과)
    let uid = 'anonymous';
    let isAnonymous = true;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const decoded = await admin.auth().verifyIdToken(token);
            uid = decoded.uid;
            isAnonymous = decoded.firebase?.sign_in_provider === 'anonymous';
        }
        catch { /* anonymous */ }
    }
    const { name, sajuData, date, weekday, todayGanzi, jeolgi, dayJiShen, dayXiongSha, baseScores100, tomorrowGanzi, tomorrowDate, } = req.body || {};
    if (!sajuData || !date || !todayGanzi) {
        sendEvent('error', { message: '사주·날짜·오늘 간지가 필요합니다' });
        res.end();
        return;
    }
    sendEvent('start', { ts: Date.now() });
    // ── L1 · Shared Cache 조회 (uid 무관 by 8글자 + 날짜) ──
    const SCHEMA_VERSION = 'v6';
    const sajuKey = buildSajuKey(sajuData);
    const sharedCacheKey = `${sajuKey}_${date}_${SCHEMA_VERSION}`;
    const sharedCacheRef = db.doc(`sharedDailyFortune/${sharedCacheKey}`);
    try {
        const cached = await sharedCacheRef.get();
        if (cached.exists) {
            const d = cached.data();
            const content = d?.content;
            // v6 검증 — Group A·B 둘 다 머지된 풀 결과
            const isV6 = content && content.todayNarrative && content.subScores
                && Array.isArray(content.meetPeople) && content.luckyProfile;
            if (content && isV6) {
                console.log(`[dailyFortuneStream] L1 SHARED HIT key=${sharedCacheKey}`);
                sendEvent('done', { result: content, cached: true, cacheLevel: 'shared' });
                res.end();
                return;
            }
        }
    }
    catch (e) {
        console.warn('[dailyFortuneStream] shared cache check failed:', e?.message);
    }
    // ── L2 · Haiku 3-way 병렬 + 강력 sanity check + Sonnet fallback (v6.5) ──
    // 실측: Haiku 단일 = 60s (출력 8800자 / ~100 tok/s)
    // 3-way 병렬: max(A1=5s, A2=18s, B=18s) ≈ 18s
    // 각 그룹 sanity check (글자수 + 핵심 필드) → 누락 시 Sonnet 단일 fallback
    try {
        const { default: Anthropic } = await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')));
        const { DAILY_FORTUNE_SYSTEM_V3, DAILY_FORTUNE_USER_V3, DAILY_FORTUNE_USER_V3_GROUP_A1, DAILY_FORTUNE_USER_V3_GROUP_A2, DAILY_FORTUNE_USER_V3_GROUP_B, parseJsonResponse, } = await Promise.resolve().then(() => __importStar(require('./ai/promptsV3')));
        const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY.value() });
        const system = DAILY_FORTUNE_SYSTEM_V3;
        const userA1 = DAILY_FORTUNE_USER_V3_GROUP_A1({
            name: name || '사용자', sajuData, date, weekday: weekday || '',
            todayGanzi, jeolgi, baseScores100,
        });
        const userA2 = DAILY_FORTUNE_USER_V3_GROUP_A2({
            name: name || '사용자', sajuData, date, weekday: weekday || '',
            todayGanzi, jeolgi, dayJiShen, dayXiongSha, baseScores100,
        });
        const userB = DAILY_FORTUNE_USER_V3_GROUP_B({
            name: name || '사용자', sajuData, date, weekday: weekday || '',
            todayGanzi, jeolgi, dayJiShen, dayXiongSha, tomorrowGanzi, tomorrowDate,
        });
        const t0 = Date.now();
        const runGroup = async (groupId, userPrompt, maxTokens) => {
            const tg0 = Date.now();
            let accumulated = '';
            let chunkCount = 0;
            const stream = anthropic.messages.stream({
                model: 'claude-haiku-4-5', // Haiku 4.5 — 그룹별 병렬
                max_tokens: maxTokens,
                temperature: 0.4,
                system: [{
                        type: 'text',
                        text: system,
                        cache_control: { type: 'ephemeral', ttl: '1h' },
                    }],
                messages: [{ role: 'user', content: userPrompt }],
            });
            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    accumulated += event.delta.text;
                    chunkCount++;
                    sendEvent('chunk', {
                        group: groupId,
                        delta: event.delta.text,
                        totalChars: accumulated.length,
                        chunkIdx: chunkCount,
                    });
                }
            }
            const elapsedMs = Date.now() - tg0;
            console.log(`[dailyFortuneStream] Group ${groupId} complete`, {
                chunks: chunkCount,
                chars: accumulated.length,
                elapsedMs,
            });
            let parsed = {};
            try {
                parsed = parseJsonResponse(accumulated, { repairUsed: false }) || {};
            }
            catch (parseErr) {
                console.error(`[dailyFortuneStream] Group ${groupId} parse FAILED:`, parseErr?.message);
                parsed = {};
            }
            const keyCount = parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0;
            console.log(`[dailyFortuneStream] Group ${groupId} → ${keyCount} keys: [${Object.keys(parsed || {}).join(', ')}]`);
            sendEvent('group', { group: groupId, data: parsed, elapsedMs });
            return parsed;
        };
        // 3-way 병렬 실행
        const [resA1, resA2, resB] = await Promise.all([
            runGroup('A1', userA1, 1500),
            runGroup('A2', userA2, 5000),
            runGroup('B', userB, 5000),
        ]);
        const a1 = (resA1 && typeof resA1 === 'object') ? resA1 : {};
        const a2 = (resA2 && typeof resA2 === 'object') ? resA2 : {};
        const b = (resB && typeof resB === 'object') ? resB : {};
        // 강력한 sanity check (글자수 + 핵심 필드)
        const a1OK = !!(a1.title && a1.subScores && a1.subScoreOneLines &&
            Object.keys(a1.subScoreOneLines).length >= 4);
        const a2OK = !!(a2.todayNarrative && a2.todayNarrative.length >= 600 &&
            a2.pillarMessages && a2.subScoreReasons);
        const bOK = !!(Array.isArray(b.timeSlots) && b.timeSlots.length >= 3 &&
            Array.isArray(b.doList) && b.doList.length >= 2 &&
            b.luckyProfile && Object.keys(b.luckyProfile).length >= 4);
        console.log(`[dailyFortuneStream] sanity: A1=${a1OK} A2=${a2OK} B=${bOK}`);
        let merged = { ...a1, ...a2, ...b };
        // 한 그룹이라도 누락 → Sonnet 단일-호출 fallback
        if (!a1OK || !a2OK || !bOK) {
            console.warn('[dailyFortuneStream] missing fields → Sonnet 단일 fallback');
            const fbUser = DAILY_FORTUNE_USER_V3({
                name: name || '사용자', sajuData, date, weekday: weekday || '',
                todayGanzi, jeolgi, dayJiShen, dayXiongSha,
                baseScores100, tomorrowGanzi, tomorrowDate,
            });
            const tFb = Date.now();
            let fbAcc = '';
            const fbStream = anthropic.messages.stream({
                model: 'claude-sonnet-4-6',
                max_tokens: 8000,
                temperature: 0.4,
                system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }],
                messages: [{ role: 'user', content: fbUser }],
            });
            for await (const event of fbStream) {
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    fbAcc += event.delta.text;
                    sendEvent('chunk', { group: 'fallback', delta: event.delta.text, totalChars: fbAcc.length });
                }
            }
            try {
                const fbParsed = parseJsonResponse(fbAcc, { repairUsed: false }) || {};
                // 정상 그룹은 유지, 누락된 부분만 Sonnet 결과로 채움
                merged = {
                    ...fbParsed,
                    ...(a1OK ? a1 : {}),
                    ...(a2OK ? a2 : {}),
                    ...(bOK ? b : {}),
                };
                console.log(`[dailyFortuneStream] Sonnet fallback complete (${Date.now() - tFb}ms) → ${Object.keys(fbParsed).length} keys`);
            }
            catch (e) {
                console.error('[dailyFortuneStream] Sonnet fallback parse failed:', e?.message);
            }
        }
        console.log('[dailyFortuneStream] complete', {
            totalElapsedMs: Date.now() - t0,
            sajuKey,
            finalKeys: Object.keys(merged).length,
            model: 'claude-haiku-4-5 + sonnet-fallback',
        });
        // ── L1 · Shared Cache 저장 (uid 무관) ──
        try {
            await sharedCacheRef.set({
                content: merged,
                aiModel: 'claude-haiku-4-5',
                schemaVersion: SCHEMA_VERSION,
                sajuKey,
                date,
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[dailyFortuneStream] shared cache saved key=${sharedCacheKey}`);
        }
        catch (e) {
            console.warn('[dailyFortuneStream] shared cache save failed:', e?.message);
        }
        // 유저별 캐시 (legacy v5 호환 — 기존 구독/저장 로직 유지)
        if (uid !== 'anonymous' && !isAnonymous) {
            try {
                const userCacheRef = db.doc(`users/${uid}/dailyFortune/${date}_${SCHEMA_VERSION}`);
                await userCacheRef.set({
                    content: merged,
                    aiModel: 'claude-haiku-4-5',
                    schemaVersion: SCHEMA_VERSION,
                    sharedKey: sharedCacheKey,
                    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            catch (e) {
                console.warn('[dailyFortuneStream] user cache save failed:', e?.message);
            }
        }
        sendEvent('done', {
            result: merged,
            cached: false,
            cacheLevel: 'miss',
            elapsedMs: Date.now() - t0,
        });
    }
    catch (e) {
        console.error('[dailyFortuneStream] FAILED:', e?.message, e);
        sendEvent('error', { message: e?.message || '오늘의 운세 생성 실패' });
    }
    res.end();
});
exports.generateChatAnswer = (0, https_1.onCall)(
// 2026-04-21 사주대화 Sonnet 4.6 전환 → secrets 키도 ANTHROPIC_KEY 로 교체
// 2026-05-29 PM 비용 fix — minInstances: 1→0. 512MiB 상시대기 (월 ₩7K) → 0. cold start UX 로 흡수.
{ secrets: [ANTHROPIC_KEY], timeoutSeconds: 120, memory: '512MiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { question, sajuData, chatHistory, timeSlot } = request.data;
    if (!question)
        throw new https_1.HttpsError('invalid-argument', '질문이 없습니다');
    const uid = request.auth?.uid ?? null;
    const q = String(question);
    // ─── Layer 1: 키워드 1차 필터 (AI 호출 전) ───
    const kwCat = detectByKeyword(q);
    if (kwCat) {
        const answer = GUARD_RESPONSE[kwCat];
        await logGuardHit({ uid, question: q, category: kwCat, source: 'keyword', modelResponse: answer });
        console.info(`[generateChatAnswer] Layer1 keyword GUARD — cat=${kwCat} uid=${uid ?? 'anon'}`);
        return {
            answer,
            keywords: [],
            consumed: 0,
            guard: true,
            guardCategory: kwCat,
            guardSource: 'keyword',
        };
    }
    // ─── Layer 2: AI 호출 + guarded 필드 / [GUARD] 토큰 검사 ───
    //   2026-04-21 모델 재할당: Gemini 2.5 Pro → Claude Sonnet 4.6
    const { generateChatAnswerAI, GUARD_TOKEN } = await lazyClaudeChat();
    const raw = await generateChatAnswerAI(ANTHROPIC_KEY.value(), q, sajuData, chatHistory || [], timeSlot);
    const rawAnswer = raw?.answer ?? '';
    const llmSaidGuarded = raw?.guarded === true;
    const tokenGuarded = rawAnswer.trimStart().startsWith(GUARD_TOKEN);
    const isGuarded = llmSaidGuarded || tokenGuarded;
    if (isGuarded) {
        const cleaned = rawAnswer.replace(GUARD_TOKEN, '').trim();
        const cat = raw?.guardCategory ??
            inferGuardCategoryFromText(cleaned) ??
            'medical_legal';
        const finalAnswer = cleaned || GUARD_RESPONSE[cat];
        await logGuardHit({ uid, question: q, category: cat, source: 'llm', modelResponse: finalAnswer });
        console.info(`[generateChatAnswer] Layer2 LLM GUARD — cat=${cat} uid=${uid ?? 'anon'}`);
        return {
            answer: finalAnswer,
            keywords: raw.keywords ?? [],
            consumed: 0,
            guard: true,
            guardCategory: cat,
            guardSource: 'llm',
        };
    }
    return {
        answer: rawAnswer,
        keywords: raw.keywords ?? [],
        consumed: 1,
        guard: false,
    };
});
/** Layer 2 보조 — LLM이 guardCategory 안 채운 경우 응답 본문에서 카테고리 추론. */
function inferGuardCategoryFromText(text) {
    if (/1393|자살예방/.test(text))
        return 'self_harm';
    if (/1342|마약류/.test(text))
        return 'drugs';
    if (/112|118|범죄신고|사이버범죄/.test(text))
        return 'crime';
    if (/금융투자|종목|복권|로또/.test(text))
        return 'investment';
    if (/전문가.*(자문|진단)|의료|법률/.test(text))
        return 'medical_legal';
    return null;
}
/**
 * 꿈해몽 (통합 레거시 엔드포인트) — Claude Sonnet 4.6.
 *   mode: 'deep' → generateDreamDeep, 기본 → generateDreamFree.
 *   Phase C 에서 클라이언트를 신규 엔드포인트(generateDreamFree/Deep)로 마이그레이션 후 이 통합 엔드포인트는 삭제 예정.
 */
exports.generateDream = (0, https_1.onCall)(
// minInstances: 0 — Phase C 이후 client 호출 0건 (legacy dispatch, dead code).
// D7 백로그: wrapper + endpoint 자체 제거 예정. 영향 분석 후.
{ secrets: [ANTHROPIC_KEY], timeoutSeconds: 180, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { category, dreamText, sajuData, mode, saju, freeResultSummary, userConcern } = request.data || {};
    if (!category)
        throw new https_1.HttpsError('invalid-argument', '카테고리가 없습니다');
    try {
        const mod = await lazyClaudeDream();
        if (mode === 'deep') {
            if (!sajuData && !saju)
                throw new https_1.HttpsError('invalid-argument', '사주 데이터가 필요합니다');
            const deep = await mod.generateDreamDeep(ANTHROPIC_KEY.value(), {
                saju: saju ?? buildLegacySajuContext(sajuData),
                dreamContent: dreamText || '',
                category,
                freeResultSummary: freeResultSummary ?? { title: '', verdict: '', symbols: [] },
            });
            return deep;
        }
        const free = await mod.generateDreamFree(ANTHROPIC_KEY.value(), {
            saju: saju ?? (sajuData ? buildLegacySajuContext(sajuData) : undefined),
            dreamContent: dreamText || '',
            category,
            userConcern,
        });
        return free;
    }
    catch (error) {
        console.error('[generateDream] FAILED:', error.message, error.stack);
        throw new https_1.HttpsError('internal', `꿈해몽 생성 실패: ${error.message || 'unknown'}`);
    }
});
/** 레거시 sajuData 객체 → v3 DreamSajuContext 변환 (best-effort). */
function buildLegacySajuContext(sajuData) {
    if (!sajuData)
        return undefined;
    const pillars = sajuData?.pillars ?? [];
    const dayPillar = pillars[2] ?? {};
    const ohengDist = sajuData?.ohengDistribution ?? sajuData?.elements ?? {};
    return {
        name: sajuData?.name ?? '사용자',
        yearGanzi: pillars[0]?.간지 ?? '',
        monthGanzi: pillars[1]?.간지 ?? '',
        dayGanzi: pillars[2]?.간지 ?? '',
        timeGanzi: pillars[3]?.간지 ?? '',
        ilgan: dayPillar?.천간 ?? '',
        ilganOheng: dayPillar?.천간오행 ?? '',
        ohengDistribution: ohengDist,
        yongsin: sajuData?.yongsin,
        currentDaeun: sajuData?.currentDaeun?.간지,
        fullSajuData: sajuData,
    };
}
/**
 * 꿈해몽 무료 (신규 v3 엔드포인트) — Claude Sonnet 4.6.
 *   쿼터: 일 1회 + 월 7회 상한 (Firestore users/{uid}/dreamQuota/{YYYY-MM}).
 */
exports.generateDreamFree = (0, https_1.onCall)(
// minInstances: 0 — warm 비용 대신 로딩 UX 로 Cold start 흡수 (feedback_quality_over_speed 원칙)
{ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { saju, dreamContent, category, userConcern } = request.data || {};
    if (!category)
        throw new https_1.HttpsError('invalid-argument', '카테고리가 없습니다');
    const uid = request.auth?.uid;
    if (uid && !request.auth?.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        // 쿼터 체크 — 월 7회 상한
        const yyyymm = new Date().toISOString().slice(0, 7);
        const quotaRef = db.collection('users').doc(uid).collection('dreamQuota').doc(yyyymm);
        const today = new Date().toISOString().slice(0, 10);
        await db.runTransaction(async (tx) => {
            const q = await tx.get(quotaRef);
            const data = q.data() || { monthCount: 0, lastDate: null };
            if (data.monthCount >= 7) {
                throw new https_1.HttpsError('resource-exhausted', '이번 달 꿈해몽 무료 쿼터가 소진됐어요');
            }
            const inc = data.lastDate === today ? 0 : 1;
            tx.set(quotaRef, {
                monthCount: data.monthCount + inc,
                lastDate: today,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
    }
    try {
        const { generateDreamFree: run } = await lazyClaudeDream();
        const result = await run(ANTHROPIC_KEY.value(), {
            saju,
            dreamContent: dreamContent || '',
            category,
            userConcern,
        });
        return result;
    }
    catch (error) {
        console.error('[generateDreamFree] FAILED:', error.message);
        throw new https_1.HttpsError('internal', `꿈해몽 무료 실패: ${error.message || 'unknown'}`);
    }
});
/* ══════════════════════════════════════════════════════════════════
 * generateDreamFreeStream — SSE 스트리밍 (오늘의 운세 패턴)
 *
 * callable generateDreamFree 와 프롬프트·모델·출력 100% 동일 (전송만 SSE).
 * 쿼터(월 7회) 체크도 동일. 무료라 잔액 차감 없음.
 * 클라가 partial-json 점진 렌더 → 첫 글자 빠르게, 내용 차오름 (저퀄·깨짐 0).
 * ⚠️ 쪼개기 X (구 2그룹 분할 회귀 교훈) — 단일 호출 그대로 스트리밍만.
 * ═════════════════════════════════════════════════════════════════ */
exports.generateDreamFreeStream = (0, https_1.onRequest)({
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    minInstances: 0, // 2026-05-29 PM 비용 fix — 1GiB 상시대기 (월 ₩12K) → 0. cold start UX 로 흡수.
    cors: true,
    invoker: 'public',
}, async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    let uid;
    let isAnon = true;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        try {
            const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
            uid = decoded.uid;
            isAnon = decoded.firebase?.sign_in_provider === 'anonymous';
        }
        catch { /* anonymous */ }
    }
    const { saju, dreamContent, category, userConcern } = req.body || {};
    if (!category) {
        sendEvent('error', { message: '카테고리가 없습니다' });
        res.end();
        return;
    }
    // 쿼터 체크 (월 7회) — callable 과 동일
    if (uid && !isAnon) {
        try {
            const yyyymm = new Date().toISOString().slice(0, 7);
            const quotaRef = db.collection('users').doc(uid).collection('dreamQuota').doc(yyyymm);
            const today = new Date().toISOString().slice(0, 10);
            await db.runTransaction(async (tx) => {
                const q = await tx.get(quotaRef);
                const data = q.data() || { monthCount: 0, lastDate: null };
                if (data.monthCount >= 7) {
                    throw new Error('이번 달 꿈해몽 무료 쿼터가 소진됐어요');
                }
                const inc = data.lastDate === today ? 0 : 1;
                tx.set(quotaRef, {
                    monthCount: data.monthCount + inc,
                    lastDate: today,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            });
        }
        catch (qErr) {
            sendEvent('error', { message: qErr?.message || '쿼터 확인 실패', code: 'quota' });
            res.end();
            return;
        }
    }
    sendEvent('start', { ts: Date.now() });
    try {
        const { default: Anthropic } = await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')));
        const { buildDreamFreeCall, buildDreamFreeGroupCall } = await lazyClaudeDream();
        const { parseJsonResponse } = await Promise.resolve().then(() => __importStar(require('./ai/promptsV3')));
        const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY.value() });
        const t0 = Date.now();
        // 2026-05-27 v8 — 2-그룹 병렬 (사주 있을 때만, 없으면 단일 호출)
        const hasSaju = !!saju;
        if (hasSaju) {
            console.log('[dreamFreeStream] 2-group parallel mode');
            const runGroup = async (group) => {
                const tg0 = Date.now();
                const { system, user, model, maxTokens } = buildDreamFreeGroupCall({ saju, dreamContent: dreamContent || '', category, userConcern }, group);
                const runStream = async (temperature) => {
                    let acc = '';
                    let idx = 0;
                    const stream = anthropic.messages.stream({
                        model, max_tokens: maxTokens, temperature, system,
                        messages: [{ role: 'user', content: user }],
                    });
                    for await (const event of stream) {
                        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                            acc += event.delta.text;
                            idx++;
                            // 그룹 식별자 포함해서 emit (client 가 머지)
                            sendEvent('chunk', { group, delta: event.delta.text, totalChars: acc.length, chunkIdx: idx });
                        }
                    }
                    return acc;
                };
                let text = await runStream(0.7);
                let parsed;
                try {
                    parsed = parseJsonResponse(text, { repairUsed: false });
                }
                catch (e1) {
                    console.warn(`[dreamFreeStream:${group}] 1차 파싱 실패 → temp 0.5 재시도:`, e1?.message);
                    sendEvent('retry', { group, reason: 'parse_fail' });
                    text = await runStream(0.5);
                    parsed = parseJsonResponse(text, { repairUsed: false });
                }
                const elapsedMs = Date.now() - tg0;
                console.log(`[dreamFreeStream:${group}] done in ${elapsedMs}ms`);
                // 그룹 완료 즉시 emit (client 가 빠르게 도착하는 그룹부터 머지)
                sendEvent('group', { group, data: parsed, elapsedMs });
                return { group, parsed, elapsedMs };
            };
            // 병렬 실행 — Promise.all (둘 다 완료될 때까지 대기)
            const [groupA, groupB] = await Promise.all([runGroup('A'), runGroup('B')]);
            // 머지 — A + B 통합 결과
            const merged = { ...groupA.parsed, ...groupB.parsed };
            const totalMs = Date.now() - t0;
            console.log(`[dreamFreeStream] both groups done in ${totalMs}ms (A=${groupA.elapsedMs}ms, B=${groupB.elapsedMs}ms)`);
            sendEvent('done', { content: merged, elapsedMs: totalMs, mode: '2-group-parallel' });
            res.end();
            return;
        }
        // 사주 없음 → 단일 호출 fallback (callable 과 동일)
        console.log('[dreamFreeStream] no saju → single-call mode');
        const { system, user, model, maxTokens } = buildDreamFreeCall({
            saju, dreamContent: dreamContent || '', category, userConcern,
        });
        const runStream = async (temperature) => {
            let acc = '';
            let idx = 0;
            const stream = anthropic.messages.stream({
                model, max_tokens: maxTokens, temperature, system,
                messages: [{ role: 'user', content: user }],
            });
            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    acc += event.delta.text;
                    idx++;
                    sendEvent('chunk', { delta: event.delta.text, totalChars: acc.length, chunkIdx: idx });
                }
            }
            return acc;
        };
        let text = await runStream(0.7);
        let parsed;
        try {
            parsed = parseJsonResponse(text, { repairUsed: false });
        }
        catch (e1) {
            console.warn('[dreamFreeStream] 1차 파싱 실패 → temp 0.5 재시도:', e1?.message);
            sendEvent('retry', { reason: 'parse_fail' });
            text = await runStream(0.5);
            parsed = parseJsonResponse(text, { repairUsed: false });
        }
        console.log(`[dreamFreeStream] single-call done in ${Date.now() - t0}ms`);
        sendEvent('done', { content: parsed, elapsedMs: Date.now() - t0, mode: 'single-call' });
        res.end();
    }
    catch (error) {
        console.error('generateDreamFreeStream error:', error);
        sendEvent('error', { message: error?.message || '꿈해몽 생성 실패' });
        res.end();
    }
});
/**
 * 꿈해몽 심층 (신규 v3, 유료 1운) — Claude Sonnet 4.6 + 2차 자기 리뷰.
 */
exports.generateDreamDeep = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { saju, dreamContent, category, freeResultSummary } = request.data || {};
    if (!saju)
        throw new https_1.HttpsError('invalid-argument', '사주 데이터가 필요합니다');
    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            // 2026-05-28 — schema 통일 helper
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const result = computeBalanceDeduction(doc.data(), 1);
                if (!result)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, result.updates);
            });
            deductedAmount = 1;
        }
    }
    try {
        const { generateDreamDeep: run } = await lazyClaudeDream();
        const result = await run(ANTHROPIC_KEY.value(), {
            saju,
            dreamContent: dreamContent || '',
            category: category || '기타',
            freeResultSummary: freeResultSummary ?? { title: '', verdict: '', symbols: [] },
        });
        const reportRef = db.collection('reports').doc();
        await reportRef.set({
            uid, type: 'deepDream', content: result,
            aiModel: 'claude-sonnet-4-6',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { reportId: reportRef.id, content: result };
    }
    catch (error) {
        console.error('[generateDreamDeep] FAILED:', error.message);
        await refundBalance(uid, deductedAmount, 'generateDreamDeep failed');
        throw new https_1.HttpsError('internal', `꿈해몽 심층 실패: ${error.message || 'unknown'}`);
    }
});
// 2026-05-05 주간운세 (generateWeeklyFortune) 제거 — 클라이언트 폐지 결정 (reportGenerator.ts:200 주석)
// 서버 함수만 살아있던 dead code → Cloud Function 비용 절감 + 명리학 mandate 일관성
/**
 * IAP 상품 지급 — 앱인토스 결제 후 서버 검증
 *
 * E13 · 결제 원자성 (2026-04-22)
 * IAP 는 Toss SDK 가 이미 결제 승인을 완료한 후 호출되므로 외부 API 단계가 없음.
 * status 전이: pending → confirmed | needs_reconciliation
 *   - pending: 트랜잭션 직전 선기록 (DB 실패 시 감사 추적)
 *   - confirmed: 잔액 증가 성공
 *   - needs_reconciliation: SDK 는 결제 완료 응답했으나 DB 실패 → 수동 복구
 * 중복 지급 방지: status === 'confirmed' 만 차단.
 */
exports.grantPurchase = (0, https_1.onCall)({ timeoutSeconds: 10, memory: '256MiB', cors: true }, async (request) => {
    const { orderId, sku, paidUn, bonusUn } = request.data;
    if (!orderId || !sku || !paidUn) {
        throw new https_1.HttpsError('invalid-argument', '필수 파라미터 누락');
    }
    const uid = request.auth?.uid;
    if (!uid && !DEV_MODE)
        throw new https_1.HttpsError('unauthenticated', '로그인 필요');
    const effectiveUid = uid || 'anonymous';
    const paymentRef = db.collection(`users/${effectiveUid}/payments`).doc(orderId);
    const existing = await paymentRef.get();
    if (existing.exists) {
        const s = existing.data()?.status;
        if (s === 'confirmed' || s === 'completed')
            return { success: true, message: '이미 지급됨' };
        if (s === 'needs_reconciliation') {
            throw new https_1.HttpsError('failed-precondition', '결제가 완료됐지만 지급이 완료되지 않았어요. 고객센터로 문의해주세요.');
        }
        // pending 은 재시도 허용
    }
    const totalUn = paidUn + (bonusUn || 0);
    // E13 · pending 선기록
    await paymentRef.set({
        type: 'charge', orderId, sku,
        paidUn, bonusUn: bonusUn || 0,
        pgProvider: 'iap',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    try {
        await db.runTransaction(async (tx) => {
            const userRef = db.collection('users').doc(effectiveUid);
            const userDoc = await tx.get(userRef);
            const data = userDoc.data() || {};
            // 2026-06-12 P0 fix — 익명 유저는 users/{uid} 문서가 없어 update()가 NOT_FOUND
            //   → 결제 19건 전부 needs_reconciliation 으로 빠지던 원인. set(merge)로 문서 없어도 생성.
            tx.set(userRef, {
                balance: {
                    paid: (data.balance?.paid ?? 0) + paidUn,
                    bonus: (data.balance?.bonus ?? 0) + (bonusUn || 0),
                },
                totalCharged: admin.firestore.FieldValue.increment(paidUn),
            }, { merge: true });
            tx.update(paymentRef, {
                unChange: totalUn,
                // 2026-06-12 — IAP 도 매출(KRW) 집계되도록 amount 기록 (paidUn→정가 매핑)
                amount: { 1: 500, 3: 1500, 5: 2500, 10: 5000 }[paidUn] ?? paidUn * 500,
                status: 'confirmed',
                confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
    }
    catch (err) {
        console.error('[grantPurchase] needs_reconciliation (IAP 완료 + DB 실패):', err);
        await paymentRef.update({
            status: 'needs_reconciliation',
            failReason: 'db_transaction_failed: ' + (err.message || 'unknown'),
        });
        throw new https_1.HttpsError('internal', '결제는 완료됐지만 지급 중 오류가 발생했어요. 고객센터에 문의해주세요.');
    }
    return { success: true };
});
/**
 * 대운 해설 — Claude Sonnet 4.6
 */
exports.generateDaeun = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { sajuData } = request.data;
    if (!sajuData)
        throw new https_1.HttpsError('invalid-argument', '사주 데이터가 없습니다');
    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            // 2026-05-28 — schema 통일 helper
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const result = computeBalanceDeduction(doc.data(), 1);
                if (!result)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, result.updates);
            });
            deductedAmount = 1;
        }
    }
    try {
        const { generateDaeunAnalysis } = await lazyClaudeDaeun();
        const result = await generateDaeunAnalysis(ANTHROPIC_KEY.value(), sajuData);
        const reportRef = db.collection('reports').doc();
        await reportRef.set({
            uid, type: 'daeun', content: result,
            aiModel: 'claude-sonnet-4-6',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { reportId: reportRef.id, content: result };
    }
    catch (error) {
        console.error('generateDaeun error:', error);
        await refundBalance(uid, deductedAmount, 'generateDaeun failed');
        throw new https_1.HttpsError('internal', `대운 분석 실패: ${error.message || 'unknown'}`);
    }
});
/**
 * 2026 월별 운세 — Claude Sonnet 4.6
 */
exports.generateMonthly = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { sajuData } = request.data;
    if (!sajuData)
        throw new https_1.HttpsError('invalid-argument', '사주 데이터가 없습니다');
    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            // 2026-05-28 — schema 통일 helper
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const result = computeBalanceDeduction(doc.data(), 1);
                if (!result)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, result.updates);
            });
            deductedAmount = 1;
        }
    }
    try {
        const { generateMonthlyFortune } = await lazyClaudeMonthly();
        const result = await generateMonthlyFortune(ANTHROPIC_KEY.value(), sajuData);
        const reportRef = db.collection('reports').doc();
        await reportRef.set({
            uid, type: 'monthly', content: result,
            aiModel: 'claude-sonnet-4-6',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { reportId: reportRef.id, content: result };
    }
    catch (error) {
        console.error('generateMonthly error:', error);
        await refundBalance(uid, deductedAmount, 'generateMonthly failed');
        throw new https_1.HttpsError('internal', `월별 운세 실패: ${error.message || 'unknown'}`);
    }
});
/**
 * 궁합 분석 — Claude Sonnet 4.6
 */
exports.generateCompatibility = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { sajuData1, sajuData2, relation } = request.data;
    if (!sajuData1 || !sajuData2)
        throw new https_1.HttpsError('invalid-argument', '두 사람의 사주 데이터가 필요합니다');
    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            // 2026-05-28 — schema 통일 helper
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const result = computeBalanceDeduction(doc.data(), 1);
                if (!result)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, result.updates);
            });
            deductedAmount = 1;
        }
    }
    try {
        const { generateCompatibilityAnalysis } = await lazyClaudeCompat();
        const result = await generateCompatibilityAnalysis(ANTHROPIC_KEY.value(), sajuData1, sajuData2, relation || '연인');
        const reportRef = db.collection('reports').doc();
        await reportRef.set({
            uid, type: 'compatibility', content: result,
            aiModel: 'claude-sonnet-4-6',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { reportId: reportRef.id, content: result };
    }
    catch (error) {
        console.error('generateCompatibility error:', error);
        await refundBalance(uid, deductedAmount, 'generateCompatibility failed');
        throw new https_1.HttpsError('internal', `궁합 분석 실패: ${error.message || 'unknown'}`);
    }
});
/**
 * 토정비결 — Claude Sonnet 4.6
 */
exports.generateTojung = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { sajuData } = request.data;
    if (!sajuData)
        throw new https_1.HttpsError('invalid-argument', '사주 데이터가 없습니다');
    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            // 2026-05-28 — schema 통일 helper
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const result = computeBalanceDeduction(doc.data(), 1);
                if (!result)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, result.updates);
            });
            deductedAmount = 1;
        }
    }
    try {
        const { generateTojungBigyeol } = await lazyClaudeTojung();
        const result = await generateTojungBigyeol(ANTHROPIC_KEY.value(), sajuData);
        const reportRef = db.collection('reports').doc();
        await reportRef.set({
            uid, type: 'tojung', content: result,
            aiModel: 'claude-sonnet-4-6',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { reportId: reportRef.id, content: result };
    }
    catch (error) {
        console.error('generateTojung error:', error);
        await refundBalance(uid, deductedAmount, 'generateTojung failed');
        throw new https_1.HttpsError('internal', `토정비결 실패: ${error.message || 'unknown'}`);
    }
});
/**
 * 공유 리워드 지급 — 1운, 1일 1회 제한
 */
exports.grantShareReward = (0, https_1.onCall)({ timeoutSeconds: 10, memory: '256MiB', cors: true }, async (request) => {
    const uid = request.auth?.uid || (DEV_MODE ? 'anonymous' : null);
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', '로그인 필요');
    const today = new Date().toISOString().split('T')[0];
    // 일일 3회 제한만 (월 제한 없음 — 바이럴 극대화)
    const dailyLogs = await db.collection(`users/${uid}/shareLogs`)
        .where('date', '==', today).get();
    if (dailyLogs.size >= 3)
        return { success: false, message: '오늘 공유 보상은 3회까지예요' };
    // 2026-05-28 — schema 통일. 객체면 reward bucket, 숫자면 통합 증액.
    await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const doc = await tx.get(userRef);
        const bal = doc.data()?.balance;
        if (typeof bal === 'object' && bal !== null) {
            tx.update(userRef, { 'balance.reward': admin.firestore.FieldValue.increment(1) });
        }
        else {
            tx.update(userRef, { balance: admin.firestore.FieldValue.increment(1) });
        }
    });
    await db.collection(`users/${uid}/shareLogs`).add({
        date: today, reward: 1, type: 'share',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, reward: 1, dailyRemaining: 3 - dailyLogs.size - 1 };
});
/**
 * 토스페이먼츠 결제 확인 — 웹 PG 결제 승인 + 잔액 지급
 *
 * E13 · 결제 원자성 (2026-04-22)
 * status 전이: pending → confirmed | failed | needs_reconciliation
 *   - pending: Toss 승인 API 호출 직전 기록 (감사 추적용 선기록)
 *   - confirmed: Toss 승인 + Firestore 잔액 증가 모두 성공
 *   - failed: Toss 승인 실패 (유저 취소/카드사 거절 등). 동일 orderId 재시도 가능
 *   - needs_reconciliation: Toss 는 승인됐으나 DB 트랜잭션 실패 → 수동 복구 대상
 * 중복 지급 방지: status === 'confirmed' 만 차단 (pending/failed 는 재시도 허용).
 * 근거: docs/prd/P2_Path_E_티켓_트래커.md E13.
 */
exports.confirmPayment = (0, https_1.onCall)({ secrets: [TOSS_PAYMENTS_SECRET], timeoutSeconds: 15, memory: '256MiB', cors: true }, async (request) => {
    const { paymentKey, orderId, amount } = request.data;
    if (!paymentKey || !orderId || !amount) {
        throw new https_1.HttpsError('invalid-argument', '필수 파라미터 누락');
    }
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', '로그인 필요');
    // 1. E13 · 중복 지급 방지 — confirmed/needs_reconciliation 만 차단
    // pending·failed 는 재시도 허용 (유저가 같은 orderId 로 돌아오는 경우)
    const paymentRef = db.collection(`users/${uid}/payments`).doc(orderId);
    const existing = await paymentRef.get();
    if (existing.exists) {
        const s = existing.data()?.status;
        if (s === 'confirmed') {
            return { success: true, message: '이미 처리된 결제예요' };
        }
        if (s === 'needs_reconciliation') {
            throw new https_1.HttpsError('failed-precondition', '결제가 승인됐지만 지급이 완료되지 않았어요. 고객센터로 문의해주세요.');
        }
        // status === 'pending' | 'failed' | undefined → 재시도 허용, 아래로 진행
    }
    // 2. 금액 → 패키지 검증
    const pkg = PACKAGE_MAP[amount];
    if (!pkg)
        throw new https_1.HttpsError('invalid-argument', `유효하지 않은 금액: ${amount}`);
    // 3. E13 · pending 레코드 선기록 — 감사 추적용 (Toss 승인 전)
    await paymentRef.set({
        type: 'charge', orderId, amount,
        packageName: pkg.name,
        paidUn: pkg.paidUn, bonusUn: pkg.bonusUn,
        pgProvider: 'toss',
        pgPaymentKey: paymentKey,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    // 4. 토스페이먼츠 결제 승인 API
    const secretKey = TOSS_PAYMENTS_SECRET.value();
    let tossResult;
    try {
        const confirmRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentKey, orderId, amount }),
        });
        if (!confirmRes.ok) {
            const errBody = await confirmRes.json().catch(() => ({}));
            console.error('[confirmPayment] 토스 승인 실패:', errBody);
            // E13 · pending → failed 전이 (재시도 가능)
            await paymentRef.update({
                status: 'failed',
                failReason: errBody.message || `http_${confirmRes.status}`,
                failedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            throw new https_1.HttpsError('internal', `결제 승인 실패: ${errBody.message || confirmRes.status}`);
        }
        tossResult = await confirmRes.json();
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        // 네트워크/타임아웃
        console.error('[confirmPayment] 네트워크 에러:', err);
        await paymentRef.update({
            status: 'failed',
            failReason: 'network_error: ' + (err.message || 'unknown'),
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        throw new https_1.HttpsError('internal', `결제 승인 실패: ${err.message || '네트워크 오류'}`);
    }
    // 5. Firestore 트랜잭션 — 잔액 지급 + pending → confirmed 전이
    const totalUn = pkg.paidUn + pkg.bonusUn;
    try {
        await db.runTransaction(async (tx) => {
            const userRef = db.collection('users').doc(uid);
            const userDoc = await tx.get(userRef);
            const data = userDoc.data() || {};
            tx.update(userRef, {
                'balance.paid': (data.balance?.paid ?? 0) + pkg.paidUn,
                'balance.bonus': (data.balance?.bonus ?? 0) + pkg.bonusUn,
                totalCharged: admin.firestore.FieldValue.increment(pkg.paidUn),
            });
            tx.update(paymentRef, {
                unChange: totalUn,
                tossStatus: tossResult.status,
                tossMethod: tossResult.method,
                status: 'confirmed',
                confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
    }
    catch (err) {
        // E13 · Toss 는 승인됐는데 DB 트랜잭션 실패 — 수동 복구 필요
        console.error('[confirmPayment] needs_reconciliation (토스 승인 + DB 실패):', err);
        await paymentRef.update({
            status: 'needs_reconciliation',
            failReason: 'db_transaction_failed: ' + (err.message || 'unknown'),
            tossStatus: tossResult.status,
            tossMethod: tossResult.method,
            tossApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        throw new https_1.HttpsError('internal', '결제는 승인됐지만 지급 중 오류가 발생했어요. 고객센터에 문의해주세요.');
    }
    return { success: true, message: `${totalUn}운이 충전됐어요!`, totalUn, paidUn: pkg.paidUn, bonusUn: pkg.bonusUn };
});
/**
 * 토스 연결 끊기 콜백 — 유저 탈퇴 처리
 * 토스가 POST로 호출. Basic Auth (base64 인코딩) 검증.
 * body: { userKey: number, referrer: 'UNLINK' | 'WITHDRAWAL_TERMS' | 'WITHDRAWAL_TOSS' }
 */
exports.disconnectToss = (0, https_1.onRequest)({ secrets: [TOSS_DISCONNECT_AUTH], timeoutSeconds: 120, memory: '512MiB' }, async (req, res) => {
    // Basic Auth 검증 — 토스가 콘솔 입력값을 base64로 인코딩해서 보냄
    const authHeader = req.headers.authorization;
    const expected = `Basic ${Buffer.from(TOSS_DISCONNECT_AUTH.value()).toString('base64')}`;
    if (!authHeader || authHeader !== expected) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        const { userKey, referrer } = req.body;
        if (!userKey) {
            res.status(400).json({ error: 'userKey 필요' });
            return;
        }
        console.log(`[disconnectToss] 연결 끊기 요청: userKey=${userKey}, referrer=${referrer}`);
        // tossUserKey로 저장된 Firebase 유저 찾기
        const usersSnap = await db.collection('users')
            .where('tossUserKey', '==', userKey)
            .limit(1)
            .get();
        if (!usersSnap.empty) {
            const userDoc = usersSnap.docs[0];
            const uid = userDoc.id;
            // 유저 데이터 비활성화 (5일 후 삭제 예약 — 개인정보보호법)
            await userDoc.ref.update({
                status: 'disconnected',
                disconnectReferrer: referrer || 'UNLINK',
                disconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
                deleteScheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            });
            // Firebase Auth 계정 비활성화
            try {
                await admin.auth().updateUser(uid, { disabled: true });
            }
            catch (e) {
                console.warn(`[disconnectToss] Auth 비활성화 실패: ${uid}`);
            }
            console.log(`[disconnectToss] 유저 비활성화 완료: ${uid} (${referrer})`);
        }
        else {
            console.warn(`[disconnectToss] 유저 못 찾음: userKey=${userKey}`);
        }
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[disconnectToss] 에러:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * 주제별 심층분석 — Claude Sonnet 4.6 (1운)
 * 10개 주제: love/wealth/career/marriage/business/health/reunion/study/social/moving
 */
exports.generateTopicAnalysis = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { topicId, sajuData, baseScore, partnerInfo, extraInfo } = request.data;
    if (!topicId || !sajuData)
        throw new https_1.HttpsError('invalid-argument', 'topicId, sajuData 필요');
    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    // 잔액 차감 — 실명 유저만 (익명 유저는 Firestore 문서 없음)
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            // 2026-05-28 — schema 통일 helper
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const result = computeBalanceDeduction(doc.data(), 1);
                if (!result)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, result.updates);
            });
            deductedAmount = 1;
        }
    }
    try {
        const { generateTopicAnalysisAI } = await lazyClaudeTopic();
        const result = await generateTopicAnalysisAI(ANTHROPIC_KEY.value(), topicId, sajuData, baseScore, partnerInfo, extraInfo);
        const reportRef = db.collection('reports').doc();
        await reportRef.set({
            uid, topicId, ...result, type: 'topic',
            aiModel: 'claude-sonnet-4-6',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { reportId: reportRef.id, content: result };
    }
    catch (error) {
        console.error('generateTopicAnalysis error:', error);
        await refundBalance(uid, deductedAmount, 'generateTopicAnalysis failed');
        throw new https_1.HttpsError('internal', `분석 실패: ${error.message || 'unknown'}`);
    }
});
/* ══════════════════════════════════════════════════════════════════
 * generateTopicAnalysisStream — SSE 스트리밍 (오늘의 운세 패턴 적용)
 *
 * callable generateTopicAnalysis 와 프롬프트·모델·출력 100% 동일.
 * 차이는 전송 방식만: await → messages.stream() → chunk 이벤트 점진 송출.
 * 클라가 partial-json 으로 점진 렌더 → 첫 글자 ~5-10s, 내용 차오름 (저퀄·깨짐 0).
 * 잔액 차감/환불/Firestore 저장은 callable 과 동일 로직.
 * 2차 자기리뷰는 stream 경로 미적용 (TOPIC_SELF_REVIEW 기본 OFF 정책 일치).
 * ═════════════════════════════════════════════════════════════════ */
exports.generateTopicAnalysisStream = (0, https_1.onRequest)({
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    minInstances: 0, // 2026-05-29 PM 비용 fix — 1GiB 상시대기 (월 ₩12K) → 0. cold start UX 로 흡수.
    cors: true,
    invoker: 'public',
}, async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    // 인증 (Bearer optional — 익명도 통과)
    let uid = 'anonymous';
    let isAnonymous = true;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        try {
            const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
            uid = decoded.uid;
            isAnonymous = decoded.firebase?.sign_in_provider === 'anonymous';
        }
        catch { /* anonymous */ }
    }
    const { topicId, sajuData, baseScore, partnerInfo, extraInfo } = req.body || {};
    if (!topicId || !sajuData) {
        sendEvent('error', { message: 'topicId·sajuData 필요' });
        res.end();
        return;
    }
    // 잔액 차감 (1운) — callable 과 동일 (실명 유저만)
    let deductedAmount = 0;
    if (!DEV_MODE && uid !== 'anonymous' && !isAnonymous) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            try {
                // 2026-05-28 — schema 통일 helper
                await db.runTransaction(async (tx) => {
                    const doc = await tx.get(userRef);
                    const result = computeBalanceDeduction(doc.data(), 1);
                    if (!result)
                        throw new Error('운이 부족합니다');
                    tx.update(userRef, result.updates);
                });
                deductedAmount = 1;
            }
            catch (e) {
                sendEvent('error', { message: e.message || '잔액 차감 실패' });
                res.end();
                return;
            }
        }
    }
    sendEvent('start', { ts: Date.now() });
    try {
        const { default: Anthropic } = await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')));
        const { buildTopicCall } = await lazyClaudeTopic();
        const { parseJsonResponse } = await Promise.resolve().then(() => __importStar(require('./ai/promptsV3')));
        const { system, prompt, model, maxTokens } = buildTopicCall(topicId, sajuData, baseScore, partnerInfo, extraInfo);
        const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY.value() });
        const t0 = Date.now();
        const runStream = async (temperature) => {
            let acc = '';
            let chunkIdx = 0;
            const stream = anthropic.messages.stream({
                model,
                max_tokens: maxTokens,
                temperature,
                system,
                messages: [{ role: 'user', content: prompt }],
            });
            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    acc += event.delta.text;
                    chunkIdx++;
                    sendEvent('chunk', { delta: event.delta.text, totalChars: acc.length, chunkIdx });
                }
            }
            return acc;
        };
        // 1차 스트리밍 (파싱 실패 시 temp 낮춰 1회 재시도 — callable 과 동일)
        let firstText = await runStream(0.1);
        let parsed;
        try {
            parsed = parseJsonResponse(firstText, { repairUsed: false });
        }
        catch (e1) {
            console.warn(`[topicStream:${topicId}] 1차 파싱 실패 → 재시도:`, e1?.message);
            sendEvent('retry', { reason: 'parse_fail' });
            firstText = await runStream(0.05);
            parsed = parseJsonResponse(firstText, { repairUsed: false });
        }
        // Firestore 저장 (callable 과 동일 구조)
        const reportRef = db.collection('reports').doc();
        try {
            await reportRef.set({
                uid, topicId, ...parsed, type: 'topic',
                aiModel: 'claude-sonnet-4-6',
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch (fsErr) {
            console.warn(`[topicStream:${topicId}] Firestore 저장 실패:`, fsErr?.message);
        }
        console.log(`[topicStream:${topicId}] done in ${Date.now() - t0}ms`);
        sendEvent('done', { reportId: reportRef.id, content: parsed, elapsedMs: Date.now() - t0 });
        res.end();
    }
    catch (error) {
        console.error('generateTopicAnalysisStream error:', error);
        if (deductedAmount > 0) {
            await refundBalance(uid, deductedAmount, 'generateTopicAnalysisStream failed');
        }
        sendEvent('error', { message: error?.message || '분석 실패' });
        res.end();
    }
});
/* ─── 이벤트 탭 v4.1 (2026-04-21) ───
 * 근거: 사주500_UI개편_09_이벤트_v4.md + appintos_PC핸드오버_이벤트v4_GO_v1.md
 * STUB 모드: APPINTOS_MTLS_CERT/KEY 미주입 시 자동 stub. 심사 후 Secrets 주입으로 LIVE 전환.
 */
var markAttendance_1 = require("./attendance/markAttendance");
Object.defineProperty(exports, "markAttendance", { enumerable: true, get: function () { return markAttendance_1.markAttendance; } });
var onInviteReceived_1 = require("./invite/onInviteReceived");
Object.defineProperty(exports, "onInviteReceived", { enumerable: true, get: function () { return onInviteReceived_1.onInviteReceived; } });
/* ─── 웹 단독 출시 — 회원탈퇴 (2026-06-03) ───
 * 근거: docs/법적요건_웹출시.md §4 (개인정보보호법 제21조·제36조).
 * Firestore 유저 개인정보 삭제 + Auth 계정 삭제. payments 는 전자상거래법 5년 보존.
 */
var deleteAccount_1 = require("./auth/deleteAccount");
Object.defineProperty(exports, "deleteAccount", { enumerable: true, get: function () { return deleteAccount_1.deleteAccount; } });
// CS 보상 운 지급 (디바이스ID 장부 · 2026-06-11) — 운영: Firebase Console compensations/{deviceId}
var claimCompensation_1 = require("./admin/claimCompensation");
Object.defineProperty(exports, "claimCompensation", { enumerable: true, get: function () { return claimCompensation_1.claimCompensation; } });
/* ─── LIVE BEST 실시간 집계 (2026-06-02 · D3 정식 구현) ─── */
var topicViews_1 = require("./livebest/topicViews");
Object.defineProperty(exports, "recordTopicView", { enumerable: true, get: function () { return topicViews_1.recordTopicView; } });
Object.defineProperty(exports, "aggregateTopicTop5", { enumerable: true, get: function () { return topicViews_1.aggregateTopicTop5; } });
/* ─── E32 · 공유 비회원 OG SSR (2026-04-22) ───
 * 근거: docs/prd/P2_Path_E_티켓_트래커.md E32 + 프리미엄_티저블러.md
 * Firebase Hosting 설정: { source: "/share/**", function: "renderShareOg" } → 이 함수로 라우팅.
 * 봇 UA 는 OG HTML, 사람 UA 는 index.html self-fetch 로 SPA 전달.
 */
var renderShareOg_1 = require("./share/renderShareOg");
Object.defineProperty(exports, "renderShareOg", { enumerable: true, get: function () { return renderShareOg_1.renderShareOg; } });
/* ─── #saju-card-share Stage 4 · 사주 카드 OG SSR (2026-04-27) ───
 * 만세력 카드 카톡 공유 시 미리보기 이미지 노출. E32 패턴 응용.
 *  - renderSajuCardOg: /saju-card/:profileId 봇 UA 시 SSR OG 메타 HTML
 *  - renderSajuCardOgImage: /api/saju-card-og.png?n=&i= 동적 1200×630 PNG (puppeteer + Noto Serif KR)
 *
 * Firebase Hosting 설정 필요 (firebase.json rewrites — 순서 중요):
 *   { source: "/api/saju-card-og.png", function: "renderSajuCardOgImage" }
 *   { source: "/saju-card/**",         function: "renderSajuCardOg" }
 *   { source: "/share/**",             function: "renderShareOg" }
 *   { source: "**",                    destination: "/index.html" }
 */
var renderSajuCardOg_1 = require("./share/renderSajuCardOg");
Object.defineProperty(exports, "renderSajuCardOg", { enumerable: true, get: function () { return renderSajuCardOg_1.renderSajuCardOg; } });
var renderSajuCardOgImage_1 = require("./share/renderSajuCardOgImage");
Object.defineProperty(exports, "renderSajuCardOgImage", { enumerable: true, get: function () { return renderSajuCardOgImage_1.renderSajuCardOgImage; } });
/* ─── #61 · 프리미엄 PDF 다운로드 (2026-04-27) ───
 * 5,000원(10운) 결제 후 PremiumResult 7섹션을 A4 PDF 로 다운로드.
 *  - puppeteer-core + @sparticuz/chromium · Noto Serif KR Google Fonts CDN
 *  - 검증: auth.uid + (reportId.uid 일치) + payments confirmed 5000원 1건 이상
 *  - Storage 업로드 + 24h Signed URL 반환
 */
const lazyPremiumPdf = () => Promise.resolve().then(() => __importStar(require('./pdf/generatePremiumPdf')));
// region 미지정 = us-central1 (다른 함수와 일치)
// asia-northeast3 는 client functionsClient.ts 가 us-central1 고정이라 미사용 — 추후 멀티리전 분리 시 검토
exports.generatePremiumPdf = (0, https_1.onCall)({
    timeoutSeconds: 120,
    memory: '1GiB',
    minInstances: 0,
    cors: true,
    invoker: 'public',
}, async (request) => {
    try {
        const { handleGeneratePremiumPdf } = await lazyPremiumPdf();
        return await handleGeneratePremiumPdf(request, db);
    }
    catch (err) {
        if (err?.code)
            throw err; // HttpsError 통과
        console.error('[generatePremiumPdf] 예외:', err);
        throw new https_1.HttpsError('internal', `PDF 생성 실패: ${err?.message || 'unknown'}`);
    }
});
var fixPayDatesOnce_1 = require("./admin/fixPayDatesOnce");
Object.defineProperty(exports, "fixPayDatesOnce", { enumerable: true, get: function () { return fixPayDatesOnce_1.fixPayDatesOnce; } });
//# sourceMappingURL=index.js.map