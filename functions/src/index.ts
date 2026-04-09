import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
// AI 모듈은 호출 시 동적 import — 초기화 타임아웃 방지
const lazyClaudeReport = () => import('./ai/claudeReport');
const lazyClaudeDaeun = () => import('./ai/claudeDaeun');
const lazyClaudeMonthly = () => import('./ai/claudeMonthly');
const lazyClaudeCompat = () => import('./ai/claudeCompat');
const lazyGeminiTojung = () => import('./ai/geminiTojung');
const lazyGeminiFortune = () => import('./ai/geminiFortune');
const lazyGeminiChat = () => import('./ai/geminiChat');
const lazyGeminiDream = () => import('./ai/geminiDream');
const lazyTossAuth = () => import('./auth/tossAuth');

admin.initializeApp();
const db = admin.firestore();

const ANTHROPIC_KEY = defineSecret('ANTHROPIC_API_KEY');
const GEMINI_KEY = defineSecret('GEMINI_API_KEY');
const TOSS_MTLS_CERT = defineSecret('TOSS_MTLS_CERT');
const TOSS_MTLS_KEY = defineSecret('TOSS_MTLS_KEY');
const TOSS_DECRYPT_KEY = defineSecret('TOSS_DECRYPT_KEY');
const TOSS_DECRYPT_AAD = defineSecret('TOSS_DECRYPT_AAD');
const TOSS_PAYMENTS_SECRET = defineSecret('TOSS_PAYMENTS_SECRET_KEY');

/** 금액 → 패키지 매핑 (서버에서 검증용) */
const PACKAGE_MAP: Record<number, { name: string; paidUn: number; bonusUn: number }> = {
  500:  { name: '한 번만',     paidUn: 1,  bonusUn: 0 },
  1500: { name: '좀 더 보자',  paidUn: 3,  bonusUn: 1 },
  2500: { name: '제대로 보자', paidUn: 5,  bonusUn: 2 },
  5000: { name: '올해 다 보자', paidUn: 10, bonusUn: 5 },
};
const TOSS_DISCONNECT_AUTH = defineSecret('TOSS_DISCONNECT_AUTH');

// 개발 중: 인증 없이도 동작
// 런칭 시: DEV_MODE = false

/**
 * 토스 로그인 — authorizationCode → Firebase Custom Token
 */
export const loginWithToss = onCall(
  {
    secrets: [TOSS_MTLS_CERT, TOSS_MTLS_KEY, TOSS_DECRYPT_KEY, TOSS_DECRYPT_AAD],
    timeoutSeconds: 15,
    memory: '256MiB',
  },
  async (request) => {
    const { authorizationCode } = request.data;
    if (!authorizationCode) throw new HttpsError('invalid-argument', 'authorizationCode 필요');

    try {
      const { exchangeTossToken } = await lazyTossAuth();
      const result = await exchangeTossToken(
        authorizationCode,
        TOSS_MTLS_CERT.value(),
        TOSS_MTLS_KEY.value(),
        TOSS_DECRYPT_KEY.value(),
        TOSS_DECRYPT_AAD.value(),
      );
      return result;
    } catch (error: any) {
      console.error('[loginWithToss]', error);
      throw new HttpsError('internal', `로그인 실패: ${error.message}`);
    }
  }
);
const DEV_MODE = false;

/**
 * 사주 리포트 생성 — Claude Sonnet 4.6
 */
export const generateReport = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB' },
  async (request) => {
    const { sajuData, situation, reportType } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';

    // 런칭 시 잔액 차감 활성화
    if (!DEV_MODE && request.auth) {
      const cost = reportType === 'premium' ? 10 : 1;
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        const balance = userDoc.data()?.balance ?? 0;
        if (balance < cost) throw new HttpsError('failed-precondition', '운이 부족합니다');
        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-cost),
          totalSpent: admin.firestore.FieldValue.increment(cost),
        });
      });
    }

    try {
      const { generateSajuReport } = await lazyClaudeReport();
      const result = await generateSajuReport(
        ANTHROPIC_KEY.value(),
        sajuData,
        situation,
        reportType || 'basic',
      );

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
    } catch (error: any) {
      console.error('generateReport error:', error);
      throw new HttpsError('internal', `AI 분석 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 오늘의 운세 — Gemini 2.5 Flash (무료)
 */
export const generateDailyFortune = onCall(
  { secrets: [GEMINI_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const { answers, timeSlot, sajuSummary } = request.data;

    const { generateDailyFortuneAI } = await lazyGeminiFortune();
    const result = await generateDailyFortuneAI(
      GEMINI_KEY.value(),
      answers || [],
      timeSlot || 'morning',
      sajuSummary,
    );

    return result;
  }
);

/**
 * AI 대화 — Gemini 2.5 Pro
 */
export const generateChatAnswer = onCall(
  { secrets: [GEMINI_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const { question, sajuData, chatHistory, timeSlot } = request.data;
    if (!question) throw new HttpsError('invalid-argument', '질문이 없습니다');

    const { generateChatAnswerAI } = await lazyGeminiChat();
    const result = await generateChatAnswerAI(
      GEMINI_KEY.value(),
      question,
      sajuData,
      chatHistory || [],
      timeSlot,
    );

    return result;
  }
);

/**
 * 꿈해몽 — Gemini 2.5 Flash (무료)
 */
export const generateDream = onCall(
  { secrets: [GEMINI_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const { category, dreamText, sajuData } = request.data;
    if (!category) throw new HttpsError('invalid-argument', '카테고리가 없습니다');

    const { generateDreamInterpretation } = await lazyGeminiDream();
    const result = await generateDreamInterpretation(
      GEMINI_KEY.value(),
      category,
      dreamText || '',
      sajuData,
    );

    return result;
  }
);

/**
 * IAP 상품 지급 — 앱인토스 결제 후 서버 검증
 */
export const grantPurchase = onCall(
  { timeoutSeconds: 10, memory: '256MiB' },
  async (request) => {
    const { orderId, sku, paidUn, bonusUn } = request.data;
    if (!orderId || !sku || !paidUn) {
      throw new HttpsError('invalid-argument', '필수 파라미터 누락');
    }

    const uid = request.auth?.uid;
    if (!uid && !DEV_MODE) throw new HttpsError('unauthenticated', '로그인 필요');

    const effectiveUid = uid || 'anonymous';
    const paymentRef = db.collection(`users/${effectiveUid}/payments`).doc(orderId);
    const existing = await paymentRef.get();
    if (existing.exists) return { success: true, message: '이미 지급됨' };

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
  }
);

/**
 * 대운 해설 — Claude Sonnet 4.6
 */
export const generateDaeun = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB' },
  async (request) => {
    const { sajuData } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    if (!DEV_MODE && request.auth) {
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        const balance = userDoc.data()?.balance ?? 0;
        if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-1),
          totalSpent: admin.firestore.FieldValue.increment(1),
        });
      });
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
    } catch (error: any) {
      console.error('generateDaeun error:', error);
      throw new HttpsError('internal', `대운 분석 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 2026 월별 운세 — Claude Sonnet 4.6
 */
export const generateMonthly = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB' },
  async (request) => {
    const { sajuData } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    if (!DEV_MODE && request.auth) {
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        const balance = userDoc.data()?.balance ?? 0;
        if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-1),
          totalSpent: admin.firestore.FieldValue.increment(1),
        });
      });
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
    } catch (error: any) {
      console.error('generateMonthly error:', error);
      throw new HttpsError('internal', `월별 운세 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 궁합 분석 — Claude Sonnet 4.6
 */
export const generateCompatibility = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB' },
  async (request) => {
    const { sajuData1, sajuData2, relation } = request.data;
    if (!sajuData1 || !sajuData2) throw new HttpsError('invalid-argument', '두 사람의 사주 데이터가 필요합니다');

    const uid = request.auth?.uid || 'anonymous';
    if (!DEV_MODE && request.auth) {
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        const balance = userDoc.data()?.balance ?? 0;
        if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-1),
          totalSpent: admin.firestore.FieldValue.increment(1),
        });
      });
    }

    try {
      const { generateCompatibilityAnalysis } = await lazyClaudeCompat();
      const result = await generateCompatibilityAnalysis(
        ANTHROPIC_KEY.value(), sajuData1, sajuData2, relation || '연인'
      );
      const reportRef = db.collection('reports').doc();
      await reportRef.set({
        uid, type: 'compatibility', content: result,
        aiModel: 'claude-sonnet-4-6',
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { reportId: reportRef.id, content: result };
    } catch (error: any) {
      console.error('generateCompatibility error:', error);
      throw new HttpsError('internal', `궁합 분석 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 토정비결 — Gemini 2.5 Pro
 */
export const generateTojung = onCall(
  { secrets: [GEMINI_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const { sajuData } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    if (!DEV_MODE && request.auth) {
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef);
        const balance = userDoc.data()?.balance ?? 0;
        if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-1),
          totalSpent: admin.firestore.FieldValue.increment(1),
        });
      });
    }

    try {
      const { generateTojungBigyeol } = await lazyGeminiTojung();
      const result = await generateTojungBigyeol(GEMINI_KEY.value(), sajuData);
      const reportRef = db.collection('reports').doc();
      await reportRef.set({
        uid, type: 'tojung', content: result,
        aiModel: 'gemini-2.5-pro',
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { reportId: reportRef.id, content: result };
    } catch (error: any) {
      console.error('generateTojung error:', error);
      throw new HttpsError('internal', `토정비결 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 공유 리워드 지급 — 1운, 1일 1회 제한
 */
export const grantShareReward = onCall(
  { timeoutSeconds: 10, memory: '256MiB' },
  async (request) => {
    const uid = request.auth?.uid || (DEV_MODE ? 'anonymous' : null);
    if (!uid) throw new HttpsError('unauthenticated', '로그인 필요');

    const today = new Date().toISOString().split('T')[0];
    const logs = await db.collection(`users/${uid}/shareLogs`)
      .where('date', '==', today).get();

    if (logs.size >= 1) return { success: false, message: '오늘은 이미 공유 보상을 받았어요' };

    await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await tx.get(userRef);
      const data = userDoc.data() || {};
      // reward 유형으로 적립 (환불 불가)
      tx.update(userRef, {
        'balance.reward': (data.balance?.reward ?? 0) + 1,
      });
    });

    await db.collection(`users/${uid}/shareLogs`).add({
      date: today, reward: 1, type: 'share',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, reward: 1 };
  }
);

/**
 * 토스페이먼츠 결제 확인 — 웹 PG 결제 승인 + 잔액 지급
 */
export const confirmPayment = onCall(
  { secrets: [TOSS_PAYMENTS_SECRET], timeoutSeconds: 15, memory: '256MiB' },
  async (request) => {
    const { paymentKey, orderId, amount } = request.data;
    if (!paymentKey || !orderId || !amount) {
      throw new HttpsError('invalid-argument', '필수 파라미터 누락');
    }

    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인 필요');

    // 1. 중복 지급 방지
    const paymentRef = db.collection(`users/${uid}/payments`).doc(orderId);
    const existing = await paymentRef.get();
    if (existing.exists) return { success: true, message: '이미 처리된 결제예요' };

    // 2. 금액 → 패키지 검증
    const pkg = PACKAGE_MAP[amount];
    if (!pkg) throw new HttpsError('invalid-argument', `유효하지 않은 금액: ${amount}`);

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
      throw new HttpsError('internal', `결제 승인 실패: ${errBody.message || confirmRes.status}`);
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
  }
);

/**
 * 토스 연결 끊기 콜백 — 유저 탈퇴 처리
 * 토스가 POST로 호출. Basic Auth (base64 인코딩) 검증.
 * body: { userKey: number, referrer: 'UNLINK' | 'WITHDRAWAL_TERMS' | 'WITHDRAWAL_TOSS' }
 */
export const disconnectToss = onRequest(
  { secrets: [TOSS_DISCONNECT_AUTH], timeoutSeconds: 120, memory: '512MiB' },
  async (req, res) => {
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
        } catch (e) {
          console.warn(`[disconnectToss] Auth 비활성화 실패: ${uid}`);
        }

        console.log(`[disconnectToss] 유저 비활성화 완료: ${uid} (${referrer})`);
      } else {
        console.warn(`[disconnectToss] 유저 못 찾음: userKey=${userKey}`);
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[disconnectToss] 에러:', error);
      res.status(500).json({ error: error.message });
    }
  }
);
