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
// 사주대화 — 2026-04-21 모델 재할당: Gemini 2.5 Pro → Claude Sonnet 4.6
//   gemini* 파일 5종 (Chat·Dream·Fortune·Tojung·Topic) 2026-05-05 dead code 제거
const lazyClaudeChat = () => import('./ai/claudeChat');
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
 * T4 · Pre-warming · generateReport 인스턴스 깨우기
 *  · InputPage 의 폼이 valid 가 되는 순간 백그라운드로 ping → 인스턴스 warm 상태 확보
 *  · 콜드스타트 1~3s 완전 제거
 *  · idempotent · auth 불필요 · 단순 200 응답만
 *  · 같은 generateReport 함수와 동일 region/메모리 → instance affinity 활용
 */
export const warmupGenerateReport = onCall(
  { timeoutSeconds: 10, memory: '256MiB', minInstances: 1, cors: true, invoker: 'public' },
  async () => {
    return { ok: true, ts: Date.now() };
  }
);

/**
 * T1 · Streaming SSE · 프리미엄 리포트 그룹 단위 점진 송출
 *  · onRequest (HTTP) — SSE 응답 (text/event-stream)
 *  · 각 그룹 (A/B/C) 완료 시점에 즉시 송출 → 클라이언트가 progressive 렌더
 *  · 첫 그룹 ~25-30s 도착, 전체 ~30-35s 완료 (T2 병렬 결합)
 *  · Opus 4.6 단일 모델 — 퀄리티·통일성 보장
 *  · 인증: Authorization: Bearer <Firebase ID Token>
 *  · 잔액 차감 + 환불 + Firestore 저장은 generateReport 와 동일 패턴
 */
export const generatePremiumReportStream = onRequest(
  {
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 540, // SSE 장기 연결 — 9분 (Cloud Run 최대)
    memory: '1GiB',
    minInstances: 1,
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
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

    const sendEvent = (event: string, data: any) => {
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
      } catch {
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
          await db.runTransaction(async (tx) => {
            const doc = await tx.get(userRef);
            const balance = doc.data()?.balance ?? 0;
            if (balance < cost) {
              throw new Error('운이 부족합니다');
            }
            tx.update(userRef, {
              balance: admin.firestore.FieldValue.increment(-cost),
              totalSpent: admin.firestore.FieldValue.increment(cost),
            });
          });
          deductedAmount = cost;
        } catch (e: any) {
          sendEvent('error', { message: e.message || '잔액 차감 실패' });
          res.end();
          return;
        }
      }
    }

    // T1 · 3 그룹 병렬 + 각 그룹 완료 시점에 SSE 송출
    sendEvent('start', { ts: Date.now() });
    const groups: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
    const results: Record<string, any> = {};

    try {
      const mod = await import('./ai/claudePremium');
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
        } catch (e: any) {
          sendEvent('groupError', { group: g, message: e.message || 'unknown' });
          throw e;
        }
      });

      await Promise.all(groupPromises);

      // 모든 그룹 완료 → merge + Firestore 저장
      const merged = {
        tier: 'premium' as const,
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
      } catch {
        // silent — 저장 실패해도 사용자에겐 결과 전달
      }

      sendEvent('done', { reportId: reportRef.id, content: merged });
      res.end();
    } catch (error: any) {
      console.error('generatePremiumReportStream error:', error);
      // 환불
      if (deductedAmount > 0) {
        await refundBalance(uid, deductedAmount, 'generatePremiumReportStream failed');
      }
      sendEvent('error', { message: error?.message || 'AI 분석 실패' });
      res.end();
    }
  }
);

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
      console.log(`[generateReport] Starting Claude call... reportType=${reportType}`);
      // ✅ 핵심 수정 (2026-05) — reportType 별 정확한 분기
      //   premium → generatePremiumReport (T2 병렬 + lifeEdge/sipCluster/shinsalCards/rel6Cards/topicMini/monthlyInsight 풀 schema)
      //   basic   → generateSajuReport    (1운 기본 schema)
      // 이전 버그: 무조건 generateSajuReport 호출 → premium 결제 시에도 basic schema 반환 → 클라 PremiumResult 렌더 깨짐
      let result: any;
      if (reportType === 'premium') {
        const premMod = await import('./ai/claudePremium');
        result = await premMod.generatePremiumReport(
          ANTHROPIC_KEY.value(),
          sajuData,
          situation,
        );
      } else {
        const mod = await lazyClaudeReport();
        result = await mod.generateSajuReport(
          ANTHROPIC_KEY.value(),
          sajuData,
          situation,
          reportType || 'basic',
        );
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
 * AI 대화 — Gemini 2.5 Pro + Safety Guard 이중 안전망 (P0-B · 2026-04-21)
 *   근거: PC_PATCH_B_CHAT_SAFETY_GUARD.md + 앱인토스 검수 §1-1
 *
 *   **2-layer 방어:**
 *   Layer 1: 키워드 1차 필터 (AI 호출 전, 확정 차단)
 *     → 자살/마약/범죄/투기/의료법률 단정 표현 정규식 매칭 시 즉시 가드 응답
 *   Layer 2: AI 응답 후 guarded 필드 + [GUARD] 토큰 검사
 *     → Gemini responseSchema의 `guarded:true` 또는 answer 시작 `[GUARD]`
 *
 *   한쪽이 놓쳐도 다른 쪽이 잡는 구조. 특히 자살 카테고리 0% 미달 필수.
 */

type GuardCategory = 'self_harm' | 'drugs' | 'crime' | 'investment' | 'medical_legal';

/** 키워드 1차 필터 (Layer 1) — 사주 도메인 false positive 방지 위해 의도 결합형.
 *  "단명" 단독은 사주 용어라 매칭 X, "단명.*편한|나아|좋|차라리|어차피" 같이 결합해야만 발동. */
const GUARD_KEYWORDS: Array<{ re: RegExp; cat: GuardCategory }> = [
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
const GUARD_RESPONSE: Record<GuardCategory, string> = {
  self_harm: '사주는 결정된 운명을 알려주는 도구가 아닙니다. 지금 마음이 많이 힘드시면 자살예방상담전화 1393(24시간), 정신건강상담 1577-0199에 연락해 주세요. 사주 상담은 다음 기회에 다시 찾아주시면 좋겠습니다.',
  drugs: '사주 상담은 약물 관련 정보를 제공하지 않습니다. 마약류중독상담 1342로 연결해 드립니다.',
  crime: '타인에게 해를 끼치거나 법을 어기는 일에 대한 상담은 어렵습니다. 범죄신고 112 · 사이버범죄 118 로 문의해 주세요.',
  investment: '사주는 특정 종목·번호를 예측하지 않습니다. 재물운의 흐름과 시기는 안내드릴 수 있습니다. 금융투자의 결과는 본인 책임이며, 전문가 자문을 권해드립니다.',
  medical_legal: '의료·법률 단정은 사주의 영역이 아닙니다. 사주는 가능성과 흐름을 보는 도구입니다. 확정 진단은 해당 분야 전문가의 진단·자문을 권해드립니다.',
};

/** 키워드 1차 필터 — 매칭 시 카테고리 반환, 미매칭 시 null. */
function detectByKeyword(question: string): GuardCategory | null {
  for (const { re, cat } of GUARD_KEYWORDS) {
    if (re.test(question)) return cat;
  }
  return null;
}

/** guard_hits 로깅 (실패해도 응답은 정상 반환). source=keyword|llm */
async function logGuardHit(args: {
  uid: string | null;
  question: string;
  category: string;
  source: 'keyword' | 'llm';
  modelResponse?: string;
}): Promise<void> {
  try {
    await db.collection('guard_hits').add({
      uid: args.uid,
      category: args.category,
      source: args.source,
      rawInput: String(args.question).slice(0, 500),
      modelResponse: (args.modelResponse ?? '').slice(0, 1000),
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e: any) {
    console.warn('[generateChatAnswer] guard_hits 로깅 실패:', e?.message);
  }
}

export const generateChatAnswer = onCall(
  // 2026-04-21 사주대화 Sonnet 4.6 전환 → secrets 키도 ANTHROPIC_KEY 로 교체
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 120, memory: '512MiB', minInstances: 1, cors: true, invoker: 'public' },
  async (request) => {
    const { question, sajuData, chatHistory, timeSlot } = request.data;
    if (!question) throw new HttpsError('invalid-argument', '질문이 없습니다');

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
        keywords: [] as string[],
        consumed: 0,
        guard: true,
        guardCategory: kwCat,
        guardSource: 'keyword' as const,
      };
    }

    // ─── Layer 2: AI 호출 + guarded 필드 / [GUARD] 토큰 검사 ───
    //   2026-04-21 모델 재할당: Gemini 2.5 Pro → Claude Sonnet 4.6
    const { generateChatAnswerAI, GUARD_TOKEN } = await lazyClaudeChat();
    const raw = await generateChatAnswerAI(
      ANTHROPIC_KEY.value(),
      q,
      sajuData,
      chatHistory || [],
      timeSlot,
    );

    const rawAnswer: string = raw?.answer ?? '';
    const llmSaidGuarded = raw?.guarded === true;
    const tokenGuarded = rawAnswer.trimStart().startsWith(GUARD_TOKEN);
    const isGuarded = llmSaidGuarded || tokenGuarded;

    if (isGuarded) {
      const cleaned = rawAnswer.replace(GUARD_TOKEN, '').trim();
      const cat: GuardCategory =
        (raw?.guardCategory as GuardCategory) ??
        (inferGuardCategoryFromText(cleaned) as GuardCategory) ??
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
        guardSource: 'llm' as const,
      };
    }

    return {
      answer: rawAnswer,
      keywords: raw.keywords ?? [],
      consumed: 1,
      guard: false,
    };
  }
);

/** Layer 2 보조 — LLM이 guardCategory 안 채운 경우 응답 본문에서 카테고리 추론. */
function inferGuardCategoryFromText(text: string): GuardCategory | null {
  if (/1393|자살예방/.test(text)) return 'self_harm';
  if (/1342|마약류/.test(text)) return 'drugs';
  if (/112|118|범죄신고|사이버범죄/.test(text)) return 'crime';
  if (/금융투자|종목|복권|로또/.test(text)) return 'investment';
  if (/전문가.*(자문|진단)|의료|법률/.test(text)) return 'medical_legal';
  return null;
}

/**
 * 꿈해몽 (통합 레거시 엔드포인트) — Claude Sonnet 4.6.
 *   mode: 'deep' → generateDreamDeep, 기본 → generateDreamFree.
 *   Phase C 에서 클라이언트를 신규 엔드포인트(generateDreamFree/Deep)로 마이그레이션 후 이 통합 엔드포인트는 삭제 예정.
 */
export const generateDream = onCall(
  // minInstances: 0 — Phase C 이후 client 호출 0건 (legacy dispatch, dead code).
  // D7 백로그: wrapper + endpoint 자체 제거 예정. 영향 분석 후.
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 180, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
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
 *
 * E13 · 결제 원자성 (2026-04-22)
 * IAP 는 Toss SDK 가 이미 결제 승인을 완료한 후 호출되므로 외부 API 단계가 없음.
 * status 전이: pending → confirmed | needs_reconciliation
 *   - pending: 트랜잭션 직전 선기록 (DB 실패 시 감사 추적)
 *   - confirmed: 잔액 증가 성공
 *   - needs_reconciliation: SDK 는 결제 완료 응답했으나 DB 실패 → 수동 복구
 * 중복 지급 방지: status === 'confirmed' 만 차단.
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
    if (existing.exists) {
      const s = existing.data()?.status;
      if (s === 'confirmed' || s === 'completed') return { success: true, message: '이미 지급됨' };
      if (s === 'needs_reconciliation') {
        throw new HttpsError('failed-precondition', '결제가 완료됐지만 지급이 완료되지 않았어요. 고객센터로 문의해주세요.');
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
        tx.update(userRef, {
          'balance.paid': (data.balance?.paid ?? 0) + paidUn,
          'balance.bonus': (data.balance?.bonus ?? 0) + (bonusUn || 0),
          totalCharged: admin.firestore.FieldValue.increment(paidUn),
        });
        tx.update(paymentRef, {
          unChange: totalUn,
          status: 'confirmed',
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    } catch (err: any) {
      console.error('[grantPurchase] needs_reconciliation (IAP 완료 + DB 실패):', err);
      await paymentRef.update({
        status: 'needs_reconciliation',
        failReason: 'db_transaction_failed: ' + (err.message || 'unknown'),
      });
      throw new HttpsError('internal', '결제는 완료됐지만 지급 중 오류가 발생했어요. 고객센터에 문의해주세요.');
    }

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
export const confirmPayment = onCall(
  { secrets: [TOSS_PAYMENTS_SECRET], timeoutSeconds: 15, memory: '256MiB', cors: true },
  async (request) => {
    const { paymentKey, orderId, amount } = request.data;
    if (!paymentKey || !orderId || !amount) {
      throw new HttpsError('invalid-argument', '필수 파라미터 누락');
    }

    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인 필요');

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
        throw new HttpsError('failed-precondition', '결제가 승인됐지만 지급이 완료되지 않았어요. 고객센터로 문의해주세요.');
      }
      // status === 'pending' | 'failed' | undefined → 재시도 허용, 아래로 진행
    }

    // 2. 금액 → 패키지 검증
    const pkg = PACKAGE_MAP[amount];
    if (!pkg) throw new HttpsError('invalid-argument', `유효하지 않은 금액: ${amount}`);

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
    let tossResult: any;
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
        throw new HttpsError('internal', `결제 승인 실패: ${errBody.message || confirmRes.status}`);
      }
      tossResult = await confirmRes.json();
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      // 네트워크/타임아웃
      console.error('[confirmPayment] 네트워크 에러:', err);
      await paymentRef.update({
        status: 'failed',
        failReason: 'network_error: ' + (err.message || 'unknown'),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new HttpsError('internal', `결제 승인 실패: ${err.message || '네트워크 오류'}`);
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
    } catch (err: any) {
      // E13 · Toss 는 승인됐는데 DB 트랜잭션 실패 — 수동 복구 필요
      console.error('[confirmPayment] needs_reconciliation (토스 승인 + DB 실패):', err);
      await paymentRef.update({
        status: 'needs_reconciliation',
        failReason: 'db_transaction_failed: ' + (err.message || 'unknown'),
        tossStatus: tossResult.status,
        tossMethod: tossResult.method,
        tossApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new HttpsError(
        'internal',
        '결제는 승인됐지만 지급 중 오류가 발생했어요. 고객센터에 문의해주세요.'
      );
    }

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

/* ─── 이벤트 탭 v4.1 (2026-04-21) ───
 * 근거: 사주500_UI개편_09_이벤트_v4.md + appintos_PC핸드오버_이벤트v4_GO_v1.md
 * STUB 모드: APPINTOS_MTLS_CERT/KEY 미주입 시 자동 stub. 심사 후 Secrets 주입으로 LIVE 전환.
 */
export { markAttendance } from './attendance/markAttendance';
export { onInviteReceived } from './invite/onInviteReceived';

/* ─── E32 · 공유 비회원 OG SSR (2026-04-22) ───
 * 근거: docs/prd/P2_Path_E_티켓_트래커.md E32 + 프리미엄_티저블러.md
 * Firebase Hosting 설정: { source: "/share/**", function: "renderShareOg" } → 이 함수로 라우팅.
 * 봇 UA 는 OG HTML, 사람 UA 는 index.html self-fetch 로 SPA 전달.
 */
export { renderShareOg } from './share/renderShareOg';

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
export { renderSajuCardOg } from './share/renderSajuCardOg';
export { renderSajuCardOgImage } from './share/renderSajuCardOgImage';

/* ─── #61 · 프리미엄 PDF 다운로드 (2026-04-27) ───
 * 5,000원(10운) 결제 후 PremiumResult 7섹션을 A4 PDF 로 다운로드.
 *  - puppeteer-core + @sparticuz/chromium · Noto Serif KR Google Fonts CDN
 *  - 검증: auth.uid + (reportId.uid 일치) + payments confirmed 5000원 1건 이상
 *  - Storage 업로드 + 24h Signed URL 반환
 */
const lazyPremiumPdf = () => import('./pdf/generatePremiumPdf');

// region 미지정 = us-central1 (다른 함수와 일치)
// asia-northeast3 는 client functionsClient.ts 가 us-central1 고정이라 미사용 — 추후 멀티리전 분리 시 검토
export const generatePremiumPdf = onCall(
  {
    timeoutSeconds: 120,
    memory: '1GiB',
    minInstances: 0,
    cors: true,
    invoker: 'public',
  },
  async (request) => {
    try {
      const { handleGeneratePremiumPdf } = await lazyPremiumPdf();
      return await handleGeneratePremiumPdf(request as any, db);
    } catch (err: any) {
      if (err?.code) throw err; // HttpsError 통과
      console.error('[generatePremiumPdf] 예외:', err);
      throw new HttpsError('internal', `PDF 생성 실패: ${err?.message || 'unknown'}`);
    }
  },
);
