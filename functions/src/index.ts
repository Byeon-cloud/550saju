import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
// AI 모듈은 호출 시 동적 import — 초기화 타임아웃 방지
const lazyClaudeReport = () => import('./ai/claudeReport');
const lazyClaudeDaeun = () => import('./ai/claudeDaeun');
const lazyClaudeMonthly = () => import('./ai/claudeMonthly');
const lazyClaudeCompat = () => import('./ai/claudeCompat');
const lazyClaudeTojung = () => import('./ai/claudeTojung');
const lazyClaudeFortune = () => import('./ai/claudeFortune');
const lazyGeminiChat = () => import('./ai/geminiChat');
const lazyClaudeDream = () => import('./ai/claudeDream');
const lazyClaudeWeekly = () => import('./ai/claudeWeekly');
const lazyClaudeTopic = () => import('./ai/claudeTopic');
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
// Gen 2 Functions — cors: true 로 비인증 호출 허용 (Firebase SDK가 자체 인증 처리)
export const loginWithToss = onCall(
  {
    secrets: [TOSS_MTLS_CERT, TOSS_MTLS_KEY, TOSS_DECRYPT_KEY, TOSS_DECRYPT_AAD],
    timeoutSeconds: 15,
    memory: '256MiB',
    cors: true,
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
 * AI 실패 시 서버 환불 헬퍼 — 차감했던 운을 되돌려 줌.
 * 악의적 환불 어뷰징을 막기 위해 반드시 "차감이 실제로 일어난 경우"에만 호출해야 함.
 *  → 호출부에서 deducted > 0 조건으로 가드.
 */
async function refundBalance(uid: string, deducted: number, reason: string): Promise<void> {
  if (!uid || deducted <= 0) return;
  try {
    await db.collection('users').doc(uid).update({
      balance: admin.firestore.FieldValue.increment(deducted),
      totalSpent: admin.firestore.FieldValue.increment(-deducted),
      lastRefundAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRefundReason: reason,
    });
    console.log(`[refundBalance] uid=${uid} amount=${deducted} reason=${reason}`);
  } catch (refundErr: any) {
    // 환불 실패해도 원래 오류는 그대로 던져야 하므로 로그만 남김
    console.error(`[refundBalance] 환불 실패 uid=${uid} amount=${deducted}: ${refundErr?.message || refundErr}`);
  }
}

/**
 * 사주 리포트 생성 — Claude Opus 4.6 (env SAJU_REPORT_MODEL로 오버라이드 가능)
 */
export const generateReport = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 1, cors: true, invoker: 'public' },
  async (request) => {
    const { sajuData, situation, reportType } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;  // 환불용 차감 기록

    // 런칭 시 잔액 차감 — 실명 로그인 유저만 (익명 유저는 Firestore 문서 없음)
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const cost = reportType === 'premium' ? 10 : 1;
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const balance = doc.data()?.balance ?? 0;
          if (balance < cost) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, {
            balance: admin.firestore.FieldValue.increment(-cost),
            totalSpent: admin.firestore.FieldValue.increment(cost),
          });
        });
        deductedAmount = cost;
      }
    }

    try {
      console.log('[generateReport] Starting Claude call...');
      const mod = await lazyClaudeReport();
      console.log('[generateReport] Module loaded, calling API...');
      const result = await mod.generateSajuReport(
        ANTHROPIC_KEY.value(),
        sajuData,
        situation,
        reportType || 'basic',
      );
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
      } catch (fsErr: any) {
        console.error('[generateReport] Firestore save failed:', fsErr.message);
      }

      console.log('[generateReport] Returning result');
      return { reportId: reportRef.id, ...result };
    } catch (error: any) {
      console.error('generateReport error:', error);
      // 서버 환불 — 차감한 잔액을 되돌려 줌 (AI/Firestore 실패 시)
      await refundBalance(uid, deductedAmount, 'generateReport failed');
      throw new HttpsError('internal', `AI 분석 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 오늘의 운세 — Claude Sonnet 4.6 (v3 스키마).
 *   입력: { name, sajuData, date, weekday, todayGanzi, jeolgi?, dayJiShen?, dayXiongSha? }
 *   출력: v3 DailyFortune JSON (AI프롬프트_v3 §5 참조).
 *   쿼터: 일 1회 캐시 (Firestore users/{uid}/dailyFortune/{YYYY-MM-DD}).
 */
export const generateDailyFortune = onCall(
  // minInstances: 0 — warm 비용 대신 로딩 UX 로 Cold start 흡수 (feedback_quality_over_speed 원칙)
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const { name, sajuData, date, weekday, todayGanzi, jeolgi, dayJiShen, dayXiongSha } = request.data || {};
    if (!sajuData || !date || !todayGanzi) {
      throw new HttpsError('invalid-argument', '사주·날짜·오늘 간지가 필요합니다');
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
    } catch (error: any) {
      console.error('[generateDailyFortune] FAILED:', error.message, error.stack);
      throw new HttpsError('internal', `오늘의 운세 생성 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * AI 대화 — Gemini 2.5 Pro
 */
export const generateChatAnswer = onCall(
  { secrets: [GEMINI_KEY], timeoutSeconds: 120, memory: '512MiB', minInstances: 1, cors: true, invoker: 'public' },
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
 * 꿈해몽 (통합 레거시 엔드포인트) — Claude Sonnet 4.6.
 *   mode: 'deep' → generateDreamDeep, 기본 → generateDreamFree.
 *   Phase C 에서 클라이언트를 신규 엔드포인트(generateDreamFree/Deep)로 마이그레이션 후 이 통합 엔드포인트는 삭제 예정.
 */
export const generateDream = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 180, memory: '1GiB', minInstances: 1, cors: true, invoker: 'public' },
  async (request) => {
    const { category, dreamText, sajuData, mode, saju, freeResultSummary, userConcern } = request.data || {};
    if (!category) throw new HttpsError('invalid-argument', '카테고리가 없습니다');

    try {
      const mod = await lazyClaudeDream();

      if (mode === 'deep') {
        if (!sajuData && !saju) throw new HttpsError('invalid-argument', '사주 데이터가 필요합니다');
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
    } catch (error: any) {
      console.error('[generateDream] FAILED:', error.message, error.stack);
      throw new HttpsError('internal', `꿈해몽 생성 실패: ${error.message || 'unknown'}`);
    }
  }
);

/** 레거시 sajuData 객체 → v3 DreamSajuContext 변환 (best-effort). */
function buildLegacySajuContext(sajuData: any): any {
  if (!sajuData) return undefined;
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
export const generateDreamFree = onCall(
  // minInstances: 0 — warm 비용 대신 로딩 UX 로 Cold start 흡수 (feedback_quality_over_speed 원칙)
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const { saju, dreamContent, category, userConcern } = request.data || {};
    if (!category) throw new HttpsError('invalid-argument', '카테고리가 없습니다');

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
          throw new HttpsError('resource-exhausted', '이번 달 꿈해몽 무료 쿼터가 소진됐어요');
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
    } catch (error: any) {
      console.error('[generateDreamFree] FAILED:', error.message);
      throw new HttpsError('internal', `꿈해몽 무료 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 꿈해몽 심층 (신규 v3, 유료 1운) — Claude Sonnet 4.6 + 2차 자기 리뷰.
 */
export const generateDreamDeep = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const { saju, dreamContent, category, freeResultSummary } = request.data || {};
    if (!saju) throw new HttpsError('invalid-argument', '사주 데이터가 필요합니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const balance = doc.data()?.balance ?? 0;
          if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, {
            balance: admin.firestore.FieldValue.increment(-1),
            totalSpent: admin.firestore.FieldValue.increment(1),
          });
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
    } catch (error: any) {
      console.error('[generateDreamDeep] FAILED:', error.message);
      await refundBalance(uid, deductedAmount, 'generateDreamDeep failed');
      throw new HttpsError('internal', `꿈해몽 심층 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 주간 흐름 (신규 v3, 유료 1운) — Claude Sonnet 4.6 + 2차 자기 리뷰.
 */
export const generateWeeklyFortune = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const { name, sajuData, monday, weekdays } = request.data || {};
    if (!sajuData || !monday || !Array.isArray(weekdays) || weekdays.length !== 7) {
      throw new HttpsError('invalid-argument', '사주·월요일·7일 요일 데이터가 필요합니다');
    }

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const balance = doc.data()?.balance ?? 0;
          if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, {
            balance: admin.firestore.FieldValue.increment(-1),
            totalSpent: admin.firestore.FieldValue.increment(1),
          });
        });
        deductedAmount = 1;
      }
    }

    try {
      const { generateWeeklyFortuneAnalysis } = await lazyClaudeWeekly();
      const result = await generateWeeklyFortuneAnalysis(ANTHROPIC_KEY.value(), {
        name: name || '사용자',
        sajuData,
        monday,
        weekdays,
      });

      const reportRef = db.collection('reports').doc();
      await reportRef.set({
        uid, type: 'weekly', content: result,
        aiModel: 'claude-sonnet-4-6',
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { reportId: reportRef.id, content: result };
    } catch (error: any) {
      console.error('[generateWeeklyFortune] FAILED:', error.message);
      await refundBalance(uid, deductedAmount, 'generateWeeklyFortune failed');
      throw new HttpsError('internal', `주간 흐름 분석 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * IAP 상품 지급 — 앱인토스 결제 후 서버 검증
 */
export const grantPurchase = onCall(
  { timeoutSeconds: 10, memory: '256MiB', cors: true },
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
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const { sajuData } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const balance = doc.data()?.balance ?? 0;
          if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, {
            balance: admin.firestore.FieldValue.increment(-1),
            totalSpent: admin.firestore.FieldValue.increment(1),
          });
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
    } catch (error: any) {
      console.error('generateDaeun error:', error);
      await refundBalance(uid, deductedAmount, 'generateDaeun failed');
      throw new HttpsError('internal', `대운 분석 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 2026 월별 운세 — Claude Sonnet 4.6
 */
export const generateMonthly = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const { sajuData } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const balance = doc.data()?.balance ?? 0;
          if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, {
            balance: admin.firestore.FieldValue.increment(-1),
            totalSpent: admin.firestore.FieldValue.increment(1),
          });
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
    } catch (error: any) {
      console.error('generateMonthly error:', error);
      await refundBalance(uid, deductedAmount, 'generateMonthly failed');
      throw new HttpsError('internal', `월별 운세 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 궁합 분석 — Claude Sonnet 4.6
 */
export const generateCompatibility = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const { sajuData1, sajuData2, relation } = request.data;
    if (!sajuData1 || !sajuData2) throw new HttpsError('invalid-argument', '두 사람의 사주 데이터가 필요합니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const balance = doc.data()?.balance ?? 0;
          if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, {
            balance: admin.firestore.FieldValue.increment(-1),
            totalSpent: admin.firestore.FieldValue.increment(1),
          });
        });
        deductedAmount = 1;
      }
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
      await refundBalance(uid, deductedAmount, 'generateCompatibility failed');
      throw new HttpsError('internal', `궁합 분석 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 토정비결 — Claude Sonnet 4.6
 */
export const generateTojung = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const { sajuData } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const balance = doc.data()?.balance ?? 0;
          if (balance < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, {
            balance: admin.firestore.FieldValue.increment(-1),
            totalSpent: admin.firestore.FieldValue.increment(1),
          });
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
    } catch (error: any) {
      console.error('generateTojung error:', error);
      await refundBalance(uid, deductedAmount, 'generateTojung failed');
      throw new HttpsError('internal', `토정비결 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * 공유 리워드 지급 — 1운, 1일 1회 제한
 */
export const grantShareReward = onCall(
  { timeoutSeconds: 10, memory: '256MiB', cors: true },
  async (request) => {
    const uid = request.auth?.uid || (DEV_MODE ? 'anonymous' : null);
    if (!uid) throw new HttpsError('unauthenticated', '로그인 필요');

    const today = new Date().toISOString().split('T')[0];

    // 일일 3회 제한만 (월 제한 없음 — 바이럴 극대화)
    const dailyLogs = await db.collection(`users/${uid}/shareLogs`)
      .where('date', '==', today).get();
    if (dailyLogs.size >= 3) return { success: false, message: '오늘 공유 보상은 3회까지예요' };

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
  }
);

/**
 * 토스페이먼츠 결제 확인 — 웹 PG 결제 승인 + 잔액 지급
 */
export const confirmPayment = onCall(
  { secrets: [TOSS_PAYMENTS_SECRET], timeoutSeconds: 15, memory: '256MiB', cors: true },
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

/**
 * 주제별 심층분석 — Claude Sonnet 4.6 (1운)
 * 10개 주제: love/wealth/career/marriage/business/health/reunion/study/social/moving
 */
export const generateTopicAnalysis = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const { topicId, sajuData, baseScore, partnerInfo, extraInfo } = request.data;
    if (!topicId || !sajuData) throw new HttpsError('invalid-argument', 'topicId, sajuData 필요');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;

    // 잔액 차감 — 실명 유저만 (익명 유저는 Firestore 문서 없음)
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const bal = doc.data()?.balance ?? 0;
          if (bal < 1) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, { balance: admin.firestore.FieldValue.increment(-1), totalSpent: admin.firestore.FieldValue.increment(1) });
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
    } catch (error: any) {
      console.error('generateTopicAnalysis error:', error);
      await refundBalance(uid, deductedAmount, 'generateTopicAnalysis failed');
      throw new HttpsError('internal', `분석 실패: ${error.message || 'unknown'}`);
    }
  }
);
