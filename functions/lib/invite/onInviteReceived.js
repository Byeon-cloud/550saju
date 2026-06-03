"use strict";
/**
 * onInviteReceived — 친구 초대 수신 콜백.
 *   근거: 09_이벤트_v4.md §5 · 핸드오버 §1-B-5
 *
 *   - callable · 인증 필수
 *   - 하루 3회 한도 · 초대당 운 1 지급
 *   - idempotencyKey = `invite_${date}_${inviteId}` (동일 inviteId 재청구 차단)
 *   - 자기 수신 루프 방어: 동일 receiver ID 중복 차단
 *
 *   앱인토스 SDK ShareReward 콜백이 이 함수를 호출. 실 통합은 심사 후.
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
exports.onInviteReceived = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
function kstToday() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
}
const DAILY_INVITE_CAP = 3;
exports.onInviteReceived = (0, https_1.onCall)({ timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', '로그인 필요');
    const { inviteId, receiver } = (request.data ?? {});
    if (!inviteId) {
        throw new https_1.HttpsError('invalid-argument', 'inviteId 필요');
    }
    const db = admin.firestore();
    const today = kstToday();
    const idempotencyKey = `invite_${today}_${inviteId}`;
    const claimRef = db.doc(`users/${uid}/rewardClaims/${idempotencyKey}`);
    const inviteRef = db.doc(`users/${uid}/inviteEvents/${today}`);
    const userRef = db.doc(`users/${uid}`);
    return db.runTransaction(async (tx) => {
        // 1. 멱등성 — 동일 inviteId 재청구 차단
        const existing = await tx.get(claimRef);
        if (existing.exists) {
            return { granted: false, reason: 'already_claimed' };
        }
        // 2. 일 3회 cap
        const inviteSnap = await tx.get(inviteRef);
        const inviteData = (inviteSnap.exists ? inviteSnap.data() : {});
        const dailyCount = inviteData?.dailyCount ?? 0;
        const invites = inviteData?.invites ?? [];
        if (dailyCount >= DAILY_INVITE_CAP) {
            return { granted: false, reason: 'daily_cap', dailyCount };
        }
        // 3. 자기 수신 루프 — 동일 receiver 중복 차단
        if (receiver && invites.some((x) => x.receiver === receiver)) {
            return { granted: false, reason: 'duplicate_receiver', dailyCount };
        }
        // 4. 지급
        const userSnap = await tx.get(userRef);
        const prevBalance = (userSnap.exists && userSnap.data()?.unBalance) ?? 0;
        tx.set(claimRef, {
            type: 'invite',
            amount: 1,
            currency: 'UN',
            cycle: today,
            inviteId,
            idempotencyKey,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(userRef, { unBalance: prevBalance + 1 }, { merge: true });
        tx.set(inviteRef, {
            dateKey: today,
            dailyCount: dailyCount + 1,
            invites: [...invites, { inviteId, receiver: receiver ?? null, at: admin.firestore.Timestamp.now() }],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { granted: true, dailyCount: dailyCount + 1, idempotencyKey };
    });
});
//# sourceMappingURL=onInviteReceived.js.map