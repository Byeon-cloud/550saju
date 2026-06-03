"use strict";
/**
 * claimStreakReward — 내부 함수 (markAttendance 내부에서만 호출).
 *   근거: 09_이벤트_v4.md §3 · 핸드오버 §1-B-3
 *
 *   - idempotency: `streak_{uid}_{startDate}` rewardClaims 문서
 *   - 성공 시 users/{uid}/unBalance +1 (+ rewardClaims 기록)
 *   - 반환: granted boolean + claimId
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
exports.claimStreakReward = claimStreakReward;
const admin = __importStar(require("firebase-admin"));
/**
 * 3일 연속 출석 달성 시 운 1 지급.
 * 반드시 Firestore 트랜잭션 안에서만 rewardClaims + unBalance 동시 변경.
 */
async function claimStreakReward(db, uid, streakStartDate, streakEndDate) {
    const claimId = `streak_${uid}_${streakStartDate}`;
    const claimRef = db.doc(`users/${uid}/rewardClaims/${claimId}`);
    const userRef = db.doc(`users/${uid}`);
    return db.runTransaction(async (tx) => {
        const existing = await tx.get(claimRef);
        if (existing.exists) {
            return { granted: false, claimId, reason: 'already_claimed' };
        }
        const userSnap = await tx.get(userRef);
        const prevBalance = (userSnap.exists && userSnap.data()?.unBalance) ?? 0;
        tx.set(claimRef, {
            type: 'attendance_streak3',
            amount: 1,
            currency: 'UN',
            cycle: `${streakStartDate}_${streakEndDate}`,
            idempotencyKey: claimId,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(userRef, { unBalance: prevBalance + 1 }, { merge: true });
        return { granted: true, claimId };
    });
}
//# sourceMappingURL=claimStreakReward.js.map