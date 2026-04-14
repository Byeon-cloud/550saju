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
exports.generateTopicAnalysis = exports.disconnectToss = exports.confirmPayment = exports.grantShareReward = exports.generateTojung = exports.generateCompatibility = exports.generateMonthly = exports.generateDaeun = exports.grantPurchase = exports.generateDream = exports.generateChatAnswer = exports.generateDailyFortune = exports.generateReport = exports.loginWithToss = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
// AI 모듈은 호출 시 동적 import — 초기화 타임아웃 방지
const lazyClaudeReport = () => Promise.resolve().then(() => __importStar(require('./ai/claudeReport')));
const lazyClaudeDaeun = () => Promise.resolve().then(() => __importStar(require('./ai/claudeDaeun')));
const lazyClaudeMonthly = () => Promise.resolve().then(() => __importStar(require('./ai/claudeMonthly')));
const lazyClaudeCompat = () => Promise.resolve().then(() => __importStar(require('./ai/claudeCompat')));
const lazyGeminiTojung = () => Promise.resolve().then(() => __importStar(require('./ai/geminiTojung')));
const lazyGeminiFortune = () => Promise.resolve().then(() => __importStar(require('./ai/geminiFortune')));
const lazyGeminiChat = () => Promise.resolve().then(() => __importStar(require('./ai/geminiChat')));
const lazyGeminiDream = () => Promise.resolve().then(() => __importStar(require('./ai/geminiDream')));
const lazyGeminiTopic = () => Promise.resolve().then(() => __importStar(require('./ai/geminiTopic')));
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
 * 사주 리포트 생성 — Claude Sonnet
 */
exports.generateReport = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 1, cors: true, invoker: 'public' }, async (request) => {
    const { sajuData, situation, reportType } = request.data;
    if (!sajuData)
        throw new https_1.HttpsError('invalid-argument', '사주 데이터가 없습니다');
    const uid = request.auth?.uid || 'anonymous';
    // 런칭 시 잔액 차감 — 실명 로그인 유저만 (익명 유저는 Firestore 문서 없음)
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const cost = reportType === 'premium' ? 10 : 1;
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const balance = doc.data()?.balance ?? 0;
                if (balance < cost)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(-cost),
                    totalSpent: admin.firestore.FieldValue.increment(cost),
                });
            });
        }
    }
    try {
        console.log('[generateReport] Starting Claude call...');
        const mod = await lazyClaudeReport();
        console.log('[generateReport] Module loaded, calling API...');
        const result = await mod.generateSajuReport(ANTHROPIC_KEY.value(), sajuData, situation, reportType || 'basic');
        console.log('[generateReport] Claude response received, keys:', Object.keys(result?.content || {}));
        // Firestore에 리포트 저장 (content는 큰 JSON이라 별도 저장)
        const reportRef = db.collection('reports').doc();
        try {
            await reportRef.set({
                uid,
                type: reportType || 'basic',
                aiModel: 'claude-sonnet-4-6',
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
        throw new https_1.HttpsError('internal', `AI 분석 실패: ${error.message || 'unknown'}`);
    }
});
/**
 * 오늘의 운세 — Gemini 2.5 Flash (무료)
 */
exports.generateDailyFortune = (0, https_1.onCall)({ secrets: [GEMINI_KEY], timeoutSeconds: 120, memory: '512MiB', minInstances: 1, cors: true, invoker: 'public' }, async (request) => {
    const { answers, timeSlot, sajuSummary, userConcern } = request.data;
    try {
        console.log('[generateDailyFortune] Starting Gemini call...');
        const { generateDailyFortuneAI } = await lazyGeminiFortune();
        const result = await generateDailyFortuneAI(GEMINI_KEY.value(), answers || [], timeSlot || 'morning', sajuSummary, userConcern || '');
        console.log('[generateDailyFortune] Success, keys:', Object.keys(result || {}));
        return result;
    }
    catch (error) {
        console.error('[generateDailyFortune] FAILED:', error.message, error.stack);
        throw new https_1.HttpsError('internal', `오늘의 운세 생성 실패: ${error.message || 'unknown'}`);
    }
});
/**
 * AI 대화 — Gemini 2.5 Pro
 */
exports.generateChatAnswer = (0, https_1.onCall)({ secrets: [GEMINI_KEY], timeoutSeconds: 120, memory: '512MiB', minInstances: 1, cors: true, invoker: 'public' }, async (request) => {
    const { question, sajuData, chatHistory, timeSlot } = request.data;
    if (!question)
        throw new https_1.HttpsError('invalid-argument', '질문이 없습니다');
    const { generateChatAnswerAI } = await lazyGeminiChat();
    const result = await generateChatAnswerAI(GEMINI_KEY.value(), question, sajuData, chatHistory || [], timeSlot);
    return result;
});
/**
 * 꿈해몽 — Gemini 2.5 Pro
 * mode: 'deep' → 사주 연계 심층 해몽 (유료 1운), 기본 → 무료 해몽
 */
exports.generateDream = (0, https_1.onCall)({ secrets: [GEMINI_KEY], timeoutSeconds: 120, memory: '512MiB', minInstances: 1, cors: true, invoker: 'public' }, async (request) => {
    const { category, dreamText, sajuData, mode } = request.data;
    if (!category)
        throw new https_1.HttpsError('invalid-argument', '카테고리가 없습니다');
    try {
        const mod = await lazyGeminiDream();
        // 유료 심층 해몽 — 사주 연계 프리미엄 분석
        if (mode === 'deep') {
            if (!sajuData)
                throw new https_1.HttpsError('invalid-argument', '사주 데이터가 필요합니다');
            console.log('[generateDream:deep] Starting, category:', category);
            const result = await mod.generateDeepDreamInterpretation(GEMINI_KEY.value(), category, dreamText || '', sajuData);
            console.log('[generateDream:deep] Success, title:', result?.title, 'score:', result?.overallScore);
            return result;
        }
        // 무료 기본 해몽
        console.log('[generateDream] Starting, category:', category, 'dreamText length:', (dreamText || '').length);
        const result = await mod.generateDreamInterpretation(GEMINI_KEY.value(), category, dreamText || '', sajuData);
        console.log('[generateDream] Success, title:', result?.title);
        return result;
    }
    catch (error) {
        console.error('[generateDream] FAILED:', error.message, error.stack);
        throw new https_1.HttpsError('internal', `꿈해몽 생성 실패: ${error.message || 'unknown'}`);
    }
});
/**
 * IAP 상품 지급 — 앱인토스 결제 후 서버 검증
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
    if (existing.exists)
        return { success: true, message: '이미 지급됨' };
    const totalUn = paidUn + (bonusUn || 0);
    await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(effectiveUid);
        const userDoc = await tx.get(userRef);
        const data = userDoc.data() || {};
        // 유형별 잔액 관리
        tx.update(userRef, {
            'balance.paid': (data.balance?.paid ?? 0) + paidUn,
            'balance.bonus': (data.balance?.bonus ?? 0) + (bonusUn || 0),
            totalCharged: admin.firestore.FieldValue.increment(paidUn),
        });
        tx.set(paymentRef, {
            type: 'charge', orderId, sku,
            paidUn, bonusUn: bonusUn || 0,
            unChange: totalUn,
            pgProvider: 'iap', status: 'completed',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
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
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const balance = doc.data()?.balance ?? 0;
                if (balance < 1)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(-1),
                    totalSpent: admin.firestore.FieldValue.increment(1),
                });
            });
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
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const balance = doc.data()?.balance ?? 0;
                if (balance < 1)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(-1),
                    totalSpent: admin.firestore.FieldValue.increment(1),
                });
            });
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
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const balance = doc.data()?.balance ?? 0;
                if (balance < 1)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(-1),
                    totalSpent: admin.firestore.FieldValue.increment(1),
                });
            });
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
        throw new https_1.HttpsError('internal', `궁합 분석 실패: ${error.message || 'unknown'}`);
    }
});
/**
 * 토정비결 — Gemini 2.5 Pro
 */
exports.generateTojung = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { sajuData } = request.data;
    if (!sajuData)
        throw new https_1.HttpsError('invalid-argument', '사주 데이터가 없습니다');
    const uid = request.auth?.uid || 'anonymous';
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const balance = doc.data()?.balance ?? 0;
                if (balance < 1)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(-1),
                    totalSpent: admin.firestore.FieldValue.increment(1),
                });
            });
        }
    }
    try {
        const { generateTojungBigyeol } = await lazyGeminiTojung();
        const result = await generateTojungBigyeol(ANTHROPIC_KEY.value(), sajuData);
        const reportRef = db.collection('reports').doc();
        await reportRef.set({
            uid, type: 'tojung', content: result,
            aiModel: 'gemini-2.5-pro',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { reportId: reportRef.id, content: result };
    }
    catch (error) {
        console.error('generateTojung error:', error);
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
    await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        tx.update(userRef, {
            balance: admin.firestore.FieldValue.increment(1),
        });
    });
    await db.collection(`users/${uid}/shareLogs`).add({
        date: today, reward: 1, type: 'share',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, reward: 1, dailyRemaining: 3 - dailyLogs.size - 1 };
});
/**
 * 토스페이먼츠 결제 확인 — 웹 PG 결제 승인 + 잔액 지급
 */
exports.confirmPayment = (0, https_1.onCall)({ secrets: [TOSS_PAYMENTS_SECRET], timeoutSeconds: 15, memory: '256MiB', cors: true }, async (request) => {
    const { paymentKey, orderId, amount } = request.data;
    if (!paymentKey || !orderId || !amount) {
        throw new https_1.HttpsError('invalid-argument', '필수 파라미터 누락');
    }
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', '로그인 필요');
    // 1. 중복 지급 방지
    const paymentRef = db.collection(`users/${uid}/payments`).doc(orderId);
    const existing = await paymentRef.get();
    if (existing.exists)
        return { success: true, message: '이미 처리된 결제예요' };
    // 2. 금액 → 패키지 검증
    const pkg = PACKAGE_MAP[amount];
    if (!pkg)
        throw new https_1.HttpsError('invalid-argument', `유효하지 않은 금액: ${amount}`);
    // 3. 토스페이먼츠 결제 승인 API
    const secretKey = TOSS_PAYMENTS_SECRET.value();
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
        throw new https_1.HttpsError('internal', `결제 승인 실패: ${errBody.message || confirmRes.status}`);
    }
    const tossResult = await confirmRes.json();
    // 4. Firestore 트랜잭션 — 잔액 지급 + 결제 기록
    const totalUn = pkg.paidUn + pkg.bonusUn;
    await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await tx.get(userRef);
        const data = userDoc.data() || {};
        tx.update(userRef, {
            'balance.paid': (data.balance?.paid ?? 0) + pkg.paidUn,
            'balance.bonus': (data.balance?.bonus ?? 0) + pkg.bonusUn,
            totalCharged: admin.firestore.FieldValue.increment(pkg.paidUn),
        });
        tx.set(paymentRef, {
            type: 'charge', orderId, amount,
            packageName: pkg.name,
            paidUn: pkg.paidUn, bonusUn: pkg.bonusUn,
            unChange: totalUn,
            pgProvider: 'toss',
            pgPaymentKey: paymentKey,
            tossStatus: tossResult.status,
            tossMethod: tossResult.method,
            status: 'completed',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
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
 * 주제별 심층분석 — Gemini 2.5 Flash (1운)
 * 10개 주제: love/wealth/career/marriage/business/health/reunion/study/social/moving
 */
exports.generateTopicAnalysis = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const { topicId, sajuData, baseScore, partnerInfo, extraInfo } = request.data;
    if (!topicId || !sajuData)
        throw new https_1.HttpsError('invalid-argument', 'topicId, sajuData 필요');
    const uid = request.auth?.uid || 'anonymous';
    // 잔액 차감 — 실명 유저만 (익명 유저는 Firestore 문서 없음)
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                const bal = doc.data()?.balance ?? 0;
                if (bal < 1)
                    throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
                tx.update(userRef, { balance: admin.firestore.FieldValue.increment(-1), totalSpent: admin.firestore.FieldValue.increment(1) });
            });
        }
    }
    try {
        const { generateTopicAnalysisAI } = await lazyGeminiTopic();
        const result = await generateTopicAnalysisAI(ANTHROPIC_KEY.value(), topicId, sajuData, baseScore, partnerInfo, extraInfo);
        const reportRef = db.collection('reports').doc();
        await reportRef.set({
            uid, topicId, ...result, type: 'topic',
            aiModel: 'gemini-2.5-flash',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { reportId: reportRef.id, content: result };
    }
    catch (error) {
        console.error('generateTopicAnalysis error:', error);
        throw new https_1.HttpsError('internal', `분석 실패: ${error.message || 'unknown'}`);
    }
});
//# sourceMappingURL=index.js.map