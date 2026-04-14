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
const https = __importStar(require("https"));
const crypto = __importStar(require("crypto"));
/**
 * 토스 로그인 토큰 교환 (mTLS 적용)
 *
 * 흐름:
 * 1. 클라이언트: appLogin() → authorizationCode + referrer 받음
 * 2. 이 함수: authorizationCode → 토스 API에서 accessToken 교환 (mTLS)
 * 3. accessToken으로 유저 정보 조회 → AES-256-GCM 복호화
 * 4. Firebase Custom Token 생성 → 클라이언트에 반환
 * 5. 클라이언트: signInWithCustomToken(customToken)
 */
const TOSS_API_BASE = 'https://apps-in-toss-api.toss.im';
const TOSS_TOKEN_URL = `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`;
const TOSS_USER_URL = `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/login-me`;
/**
 * mTLS를 사용하는 fetch 헬퍼
 * cert/key PEM을 secrets에서 받아 https.Agent에 적용
 */
function createMtlsAgent(certPem, keyPem) {
    return new https.Agent({
        cert: certPem,
        key: keyPem,
        rejectUnauthorized: true,
    });
}
/**
 * AES-256-GCM 복호화
 * 토스가 유저 정보를 암호화해서 보내는데, 복호화 키로 풀어야 함
 */
function decryptUserData(encryptedData, decryptionKey, aad) {
    try {
        const buffer = Buffer.from(encryptedData, 'base64');
        // IV(12) + ciphertext + authTag(16)
        const iv = buffer.subarray(0, 12);
        const authTag = buffer.subarray(buffer.length - 16);
        const ciphertext = buffer.subarray(12, buffer.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(decryptionKey, 'base64'), iv);
        decipher.setAuthTag(authTag);
        decipher.setAAD(Buffer.from(aad, 'utf8'));
        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        return JSON.parse(decrypted.toString('utf8'));
    }
    catch (e) {
        console.error('[decryptUserData] 복호화 실패:', e);
        return {};
    }
}
async function exchangeTossToken(authorizationCode, mtlsCert, mtlsKey, decryptionKey, decryptionAad) {
    // mTLS agent — 토스 API 호출 시 필수
    const agent = createMtlsAgent(mtlsCert, mtlsKey);
    const fetchOptions = { agent };
    // 1. authorizationCode → accessToken (POST, JSON)
    const tokenRes = await fetch(TOSS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            authorizationCode,
            referrer: 'DEFAULT',
        }),
        ...fetchOptions,
    });
    if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`토스 토큰 교환 실패: ${tokenRes.status} - ${errText}`);
    }
    const tokenData = await tokenRes.json();
    if (tokenData.resultType !== 'SUCCESS' || !tokenData.success) {
        throw new Error(`토스 토큰 교환 실패: ${tokenData.error?.reason || 'unknown'}`);
    }
    const { accessToken } = tokenData.success;
    // 2. accessToken → 유저 정보 (GET)
    const userRes = await fetch(TOSS_USER_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        ...fetchOptions,
    });
    if (!userRes.ok) {
        throw new Error(`토스 유저 정보 조회 실패: ${userRes.status}`);
    }
    const userData = await userRes.json();
    if (userData.resultType !== 'SUCCESS' || !userData.success) {
        throw new Error(`토스 유저 정보 실패: ${userData.error?.reason || 'unknown'}`);
    }
    const { userKey } = userData.success;
    // 암호화된 유저 데이터 복호화
    let userName = '';
    let userBirthday = '';
    let userGender = '';
    if (userData.success.encryptedUserData && decryptionKey && decryptionAad) {
        const decrypted = decryptUserData(userData.success.encryptedUserData, decryptionKey, decryptionAad);
        userName = decrypted.name || '';
        userBirthday = decrypted.birthday || '';
        userGender = decrypted.gender || '';
    }
    else {
        // 암호화 안 된 경우 (테스트/샌드박스)
        userName = userData.success.name || '';
        userBirthday = userData.success.birthday || '';
        userGender = userData.success.gender || '';
    }
    // 3. Firebase UID 매핑 — toss_{userKey}
    const uid = `toss_${userKey}`;
    // 4. Firestore에 유저 생성/업데이트
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        await userRef.set({
            provider: 'toss',
            tossUserKey: userKey,
            name: userName,
            birthday: userBirthday,
            gender: userGender,
            balance: 0,
            totalCharged: 0,
            totalSpent: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    else {
        await userRef.update({
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            name: userName || undefined,
        });
    }
    // 5. Firebase Custom Token 생성
    const customToken = await admin.auth().createCustomToken(uid, {
        provider: 'toss',
        tossUserKey: userKey,
    });
    return { customToken, uid };
}
//# sourceMappingURL=tossAuth.js.map