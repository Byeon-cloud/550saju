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
exports.exchangeTossToken = exchangeTossToken;
const admin = __importStar(require("firebase-admin"));
/**
 * 토스 로그인 토큰 교환
 *
 * 흐름:
 * 1. 클라이언트: appLogin() → authorizationCode 받음
 * 2. 이 함수: authorizationCode → 토스 API에서 accessToken 교환
 * 3. accessToken으로 유저 정보 조회
 * 4. Firebase Custom Token 생성 → 클라이언트에 반환
 * 5. 클라이언트: signInWithCustomToken(customToken)
 *
 * @see https://developers-apps-in-toss.toss.im/
 */
const TOSS_TOKEN_URL = 'https://oauth2.toss.im/token';
const TOSS_USER_URL = 'https://oauth2.toss.im/me';
async function exchangeTossToken(authorizationCode, clientId, clientSecret) {
    // 1. authorizationCode → accessToken
    const tokenRes = await fetch(TOSS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: authorizationCode,
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });
    if (!tokenRes.ok) {
        throw new Error(`토스 토큰 교환 실패: ${tokenRes.status}`);
    }
    const tokenData = await tokenRes.json();
    // 2. accessToken → 유저 정보
    const userRes = await fetch(TOSS_USER_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
        throw new Error(`토스 유저 정보 조회 실패: ${userRes.status}`);
    }
    const userInfo = await userRes.json();
    // 3. Firebase UID 매핑 — toss:{sub}
    const uid = `toss_${userInfo.sub}`;
    // 4. Firestore에 유저 생성/업데이트
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        // 신규 유저
        await userRef.set({
            provider: 'toss',
            tossId: userInfo.sub,
            name: userInfo.name || '',
            phone: userInfo.phone_number || '',
            balance: { paid: 0, bonus: 0, reward: 0 },
            totalCharged: 0,
            totalSpent: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    else {
        // 기존 유저 — 마지막 활동 시간 갱신
        await userRef.update({
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    // 5. Firebase Custom Token 생성
    const customToken = await admin.auth().createCustomToken(uid, {
        provider: 'toss',
        tossId: userInfo.sub,
    });
    return { customToken, uid };
}
//# sourceMappingURL=tossAuth.js.map