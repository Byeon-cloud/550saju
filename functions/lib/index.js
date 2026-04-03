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
exports.grantShareReward = exports.grantPurchase = exports.generateDream = exports.generateChatAnswer = exports.generateDailyFortune = exports.generateReport = exports.loginWithToss = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const claudeReport_1 = require("./ai/claudeReport");
const geminiFortune_1 = require("./ai/geminiFortune");
const geminiChat_1 = require("./ai/geminiChat");
const geminiDream_1 = require("./ai/geminiDream");
const tossAuth_1 = require("./auth/tossAuth");
admin.initializeApp();
const db = admin.firestore();
const ANTHROPIC_KEY = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
const GEMINI_KEY = (0, params_1.defineSecret)('GEMINI_API_KEY');
const TOSS_CLIENT_ID = (0, params_1.defineSecret)('TOSS_CLIENT_ID');
const TOSS_CLIENT_SECRET = (0, params_1.defineSecret)('TOSS_CLIENT_SECRET');
// 개발 중: 인증 없이도 동작
// 런칭 시: DEV_MODE = false
/**
 * 토스 로그인 — authorizationCode → Firebase Custom Token
 */
exports.loginWithToss = (0, https_1.onCall)({ secrets: [TOSS_CLIENT_ID, TOSS_CLIENT_SECRET], timeoutSeconds: 15, memory: '256MiB' }, async (request) => {
    const { authorizationCode } = request.data;
    if (!authorizationCode)
        throw new https_1.HttpsError('invalid-argument', 'authorizationCode 필요');
    try {
        const result = await (0, tossAuth_1.exchangeTossToken)(authorizationCode, TOSS_CLIENT_ID.value(), TOSS_CLIENT_SECRET.value());
        return result;
    }
    catch (error) {
        console.error('[loginWithToss]', error);
        throw new https_1.HttpsError('internal', `로그인 실패: ${error.message}`);
    }
});
const DEV_MODE = true;
/**
 * 사주 리포트 생성 — Claude Sonnet 4.6
 */
exports.generateReport = (0, https_1.onCall)({ secrets: [ANTHROPIC_KEY], timeoutSeconds: 60, memory: '512MiB' }, async (request) => {
    const { sajuData, situation, reportType } = request.data;
    if (!sajuData)
        throw new https_1.HttpsError('invalid-argument', '사주 데이터가 없습니다');
    const uid = request.auth?.uid || 'anonymous';
    // 런칭 시 잔액 차감 활성화
    if (!DEV_MODE && request.auth) {
        const cost = reportType === 'premium' ? 10 : 1;
        const userRef = db.collection('users').doc(uid);
        await db.runTransaction(async (tx) => {
            const userDoc = await tx.get(userRef);
            const balance = userDoc.data()?.balance ?? 0;
            if (balance < cost)
                throw new https_1.HttpsError('failed-precondition', '운이 부족합니다');
            tx.update(userRef, {
                balance: admin.firestore.FieldValue.increment(-cost),
                totalSpent: admin.firestore.FieldValue.increment(cost),
            });
        });
    }
    try {
        const result = await (0, claudeReport_1.generateSajuReport)(ANTHROPIC_KEY.value(), sajuData, situation, reportType || 'basic');
        // Firestore에 리포트 저장
        const reportRef = db.collection('reports').doc();
        await reportRef.set({
            uid,
            ...result,
            type: reportType || 'basic',
            aiModel: 'claude-sonnet-4-6',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            shareEnabled: false,
        });
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
exports.generateDailyFortune = (0, https_1.onCall)({ secrets: [GEMINI_KEY], timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
    const { answers, timeSlot, sajuSummary } = request.data;
    const result = await (0, geminiFortune_1.generateDailyFortuneAI)(GEMINI_KEY.value(), answers || [], timeSlot || 'morning', sajuSummary);
    return result;
});
/**
 * AI 대화 — Gemini 2.5 Pro
 */
exports.generateChatAnswer = (0, https_1.onCall)({ secrets: [GEMINI_KEY], timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
    const { question, sajuData, chatHistory, timeSlot } = request.data;
    if (!question)
        throw new https_1.HttpsError('invalid-argument', '질문이 없습니다');
    const result = await (0, geminiChat_1.generateChatAnswerAI)(GEMINI_KEY.value(), question, sajuData, chatHistory || [], timeSlot);
    return result;
});
/**
 * 꿈해몽 — Gemini 2.5 Flash (무료)
 */
exports.generateDream = (0, https_1.onCall)({ secrets: [GEMINI_KEY], timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
    const { category, dreamText, sajuData } = request.data;
    if (!category)
        throw new https_1.HttpsError('invalid-argument', '카테고리가 없습니다');
    const result = await (0, geminiDream_1.generateDreamInterpretation)(GEMINI_KEY.value(), category, dreamText || '', sajuData);
    return result;
});
/**
 * IAP 상품 지급 — 앱인토스 결제 후 서버 검증
 */
exports.grantPurchase = (0, https_1.onCall)({ timeoutSeconds: 10, memory: '256MiB' }, async (request) => {
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
 * 공유 리워드 지급 — 0.5운, 1일 2회 제한
 */
exports.grantShareReward = (0, https_1.onCall)({ timeoutSeconds: 10, memory: '256MiB' }, async (request) => {
    const uid = request.auth?.uid || (DEV_MODE ? 'anonymous' : null);
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', '로그인 필요');
    const today = new Date().toISOString().split('T')[0];
    const logs = await db.collection(`users/${uid}/shareLogs`)
        .where('date', '==', today).get();
    if (logs.size >= 2)
        return { success: false, message: '오늘 한도 초과' };
    await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await tx.get(userRef);
        const data = userDoc.data() || {};
        // reward 유형으로 적립 (환불 불가)
        tx.update(userRef, {
            'balance.reward': (data.balance?.reward ?? 0) + 0.5,
        });
    });
    await db.collection(`users/${uid}/shareLogs`).add({
        date: today, reward: 0.5, type: 'share',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, reward: 0.5 };
});
//# sourceMappingURL=index.js.map