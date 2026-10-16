// 2026-07-03: 런타임 Node 20 → 22 (firebase.json "runtime": "nodejs22" · Node 20 은 2026-10-30 지원 종료).
//   CLI 는 소스 해시만 비교해 런타임 변경만으론 전 함수를 skip — 이 주석이 해시를 바꿔 재배포를 트리거함.
import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { guardCallable, guardHttp, GEN_LIMIT_MESSAGE } from './shared/genGuard'; // 2026-10-14 익명 생성 하루 상한
import { defineSecret } from 'firebase-functions/params';
import { logAiFailure } from './shared/aiFailureLog';
import { createClaude, CLAUDE_MODEL, CONVERSATIONAL } from './shared/claudeClient';
import { fsSafe, setReportSafe } from './shared/firestoreSafe';
import { logAnthropicUsage } from './shared/aiUsageLog'; // C7 원가 기록 (fire-and-forget · 생성 로직 무관)
import { writeGroupProgress } from './shared/progressWrite'; // 점진 로딩 — 그룹별 증분 write(best-effort·머니 무관)
import { kstNow } from './utils/kstTime';
/** 2026-10-10 — 스트림 완료본도 콜러블과 같은 정리(출처·한자·보장·시각·가운뎃점) — 여러 번 걸어도 같은 결과 */
const cleanAiOut = async <T,>(v: T): Promise<T> => (await import('./ai/sajuFacts')).sanitizeAiOutput(v);
// AI 모듈은 호출 시 동적 import — 초기화 타임아웃 방지

// ── 하반기 시작 이벤트 세일 (pricing.ts SSOT 와 동기) — 서버가 직접 KST 세일 계산(클라 미신뢰).
//    차감액이 클라 actualPrice 와 항상 일치 → 로컬/Firestore 잔액 정합 + 세일종료(7/15) 자동 정가복귀.
const HALF_EVENT_END_MS = Date.UTC(2026, 6, 15, 14, 59, 59); // 2026-07-15 23:59:59 KST
const onHalfEvent = (): boolean => Date.now() <= HALF_EVENT_END_MS;
const premiumCost = (): number => (onHalfEvent() ? 5 : 10);
const monthlyCost = (): number => (onHalfEvent() ? 5 : 7);
const weeklyCost = (): number => 3; // 2026-10-15 정가 5 → 3운 (클라 getWeeklyPrice 와 일치)
// 2026-10-14 주제운과 궁합 가격 (클라 src/constants/pricing.ts TOPIC_PRICING_RAW, PRODUCT_COST 와 일치).
//   예전 서버는 주제를 가리지 않고 1운만 깎았다(재회운 3운 때도). 로그인 계정만 서버 차감한다.
const TOPIC_COST: Record<string, number> = { love: 4, wealth: 4, marriage: 4, reunion: 5, exam: 5, career: 3, business: 3 };
const topicCost = (topicId: string): number => TOPIC_COST[String(topicId)] ?? 1;
const COMPAT_COST = 3;
// 신년운세: 정가 9운, 2026-11-30 23:59 KST 까지 얼리버드 7운 (클라 getTojungPrice 와 같은 날짜)
const TOJUNG_LAUNCH_END_MS = Date.UTC(2026, 10, 30, 14, 59, 59);
const tojungCost = (): number => (Date.now() <= TOJUNG_LAUNCH_END_MS ? 7 : 9);
const lazyClaudeDaeun = () => import('./ai/claudeDaeun');
const lazyClaudeMonthly = () => import('./ai/claudeMonthly');
const lazyClaudeWeekly = () => import('./ai/claudeWeekly');
const lazyClaudeCompat = () => import('./ai/claudeCompat');
const lazyClaudeTojung = () => import('./ai/claudeTojung');
const lazyClaudeFortune = () => import('./ai/claudeFortune');
// 사주대화 — 2026-04-21 모델 재할당: Gemini 2.5 Pro → Claude Sonnet 4.6
//   gemini* 파일 5종 (Chat·Dream·Fortune·Tojung·Topic) 2026-05-05 dead code 제거
const lazyClaudeChat = () => import('./ai/claudeChat');
const lazyClaudeDream = () => import('./ai/claudeDream');
const lazyClaudeTopic = () => import('./ai/claudeTopic');
const lazyTossAuth = () => import('./auth/tossAuth');

admin.initializeApp();
const db = admin.firestore();

const ANTHROPIC_KEY = defineSecret('ANTHROPIC_API_KEY');
// 2026-09-03 제거: GEMINI_KEY orphan — 전 AI 함수가 Claude 이관 완료로 Gemini 미사용(어떤 secrets:[] 에도 미바인딩).
//   시크릿 자체는 GCP Secret Manager 에서 별도 정리(disable). 코드상 죽은 선언만 제거.
const TOSS_MTLS_CERT = defineSecret('TOSS_MTLS_CERT');
const TOSS_MTLS_KEY = defineSecret('TOSS_MTLS_KEY');
const TOSS_DECRYPT_KEY = defineSecret('TOSS_DECRYPT_KEY');
const TOSS_DECRYPT_AAD = defineSecret('TOSS_DECRYPT_AAD');
const PORTONE_V2_API_SECRET = defineSecret('PORTONE_V2_API_SECRET');
const MAIL_APP_PASSWORD = defineSecret('MAIL_APP_PASSWORD'); // 2026-10-17 PDF 메일 (mailPdf.ts 와 같은 이름, nodemailer 를 모든 함수에 싣지 않으려고 여기서 따로 선언)

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

// 2026-06-22 엔드게임 P1 — 익명→토스 안정 uid 보관함 병합 (uid 회전 CS 근절용). 클라 플래그 OFF 시 미호출.
export { mergeAnonIntoToss } from './auth/mergeAccount';

const DEV_MODE = false;

/**
 * AI 실패 시 서버 환불 헬퍼 — 차감했던 운을 되돌려 줌.
 * 악의적 환불 어뷰징을 막기 위해 반드시 "차감이 실제로 일어난 경우"에만 호출해야 함.
 *  → 호출부에서 deducted > 0 조건으로 가드.
 */
async function refundBalance(uid: string, deducted: number, reason: string): Promise<void> {
  if (!uid || deducted <= 0) return;
  try {
    // 2026-05-28 — balance schema 통일. 객체(paid/bonus/reward) 가 있으면 paid 에 환불, 숫자면 통합 환불.
    //   결제분만 환불 가능 (paid 우선) — 무료 보너스 환불은 어뷰징 위험.
    const userRef = db.collection('users').doc(uid);
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(userRef);
      const data = doc.data() || {};
      const bal = data.balance;
      const updates: Record<string, any> = {
        totalSpent: admin.firestore.FieldValue.increment(-deducted),
        lastRefundAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRefundReason: reason,
      };
      if (typeof bal === 'object' && bal !== null) {
        updates['balance.paid'] = admin.firestore.FieldValue.increment(deducted);
      } else {
        updates.balance = admin.firestore.FieldValue.increment(deducted);
      }
      tx.update(userRef, updates);
    });
    console.log(`[refundBalance] uid=${uid} amount=${deducted} reason=${reason}`);
  } catch (refundErr: any) {
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
function computeBalanceDeduction(data: any, cost: number): { totalBefore: number; updates: Record<string, any> } | null {
  const bal = data?.balance;
  if (typeof bal === 'object' && bal !== null) {
    const reward = Number(bal.reward) || 0;
    const bonus = Number(bal.bonus) || 0;
    const paid = Number(bal.paid) || 0;
    const total = reward + bonus + paid;
    if (total < cost) return null;
    let rem = cost;
    const dr = Math.min(rem, reward); rem -= dr;
    const db_ = Math.min(rem, bonus); rem -= db_;
    const dp = rem;
    const updates: Record<string, any> = {
      totalSpent: admin.firestore.FieldValue.increment(cost),
    };
    if (dr > 0) updates['balance.reward'] = admin.firestore.FieldValue.increment(-dr);
    if (db_ > 0) updates['balance.bonus'] = admin.firestore.FieldValue.increment(-db_);
    if (dp > 0) updates['balance.paid'] = admin.firestore.FieldValue.increment(-dp);
    return { totalBefore: total, updates };
  }
  const num = typeof bal === 'number' ? bal : 0;
  if (num < cost) return null;
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
export const warmupGenerateReport = onCall(
  { timeoutSeconds: 10, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
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
/** 점진 표시 좌표 id — 클라 crypto.randomUUID / 'pg_' 폴백 형식만 허용 */
function safeProgressId(v: unknown): string | undefined {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : undefined;
}

export const generatePremiumReportStream = onRequest(
  {
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 540, // SSE 장기 연결 — 9분 (Cloud Run 최대)
    memory: '1GiB',
    minInstances: 0, // 2026-06-15→2026-09-03 비용 fix: 1→0. 상시대기 5함수(스트리밍) 월 ~₩9~10만원 → 제거. cold start 는 로딩 UX 로 흡수.
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
    if (!(await guardHttp(req, uid === 'anonymous' ? null : uid, isAnonymous, 'premium'))) {
      sendEvent('error', { message: GEN_LIMIT_MESSAGE }); res.end(); return;
    }

    // 잔액 차감 (premium · 하반기 세일 자동반영) — 실명 로그인만
    let deductedAmount = 0;
    if (!DEV_MODE && uid !== 'anonymous' && !isAnonymous) {
      const cost = premiumCost();
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        try {
          // 2026-05-28 — schema 통일 helper (객체/숫자 양쪽 지원)
          await db.runTransaction(async (tx) => {
            const doc = await tx.get(userRef);
            const result = computeBalanceDeduction(doc.data(), cost);
            if (!result) throw new Error('운이 부족합니다');
            tx.update(userRef, result.updates);
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
    // 🚨 2026-06-22 — SSE heartbeat. start 후 첫 그룹 도착(25~80s)까지 무음이면 모바일/토스 웹뷰·프록시·
    //   Cloud Run idle-timeout(흔히 30~60s)이 연결을 '조용히' 끊어 클라가 무한로딩. 12초마다 ': hb' 코멘트
    //   를 흘려 무음구간을 없애 끊김 자체를 예방한다. (클라 SSE 파서는 코멘트 라인을 무시 → 안전)
    // 2026-06-24 — iOS WKWebView/토스 웹뷰는 SSE 스트림을 더 공격적으로 버퍼링/조기종료(P99 iOS 150s vs AND 22s).
    //   12s→5s 로 촘촘히 흘려 클라 reader 에 더 자주 닿게 + idle-timeout 방어 마진 확대.
    const heartbeat = setInterval(() => { try { res.write(': hb\n\n'); } catch { /* 연결 종료됨 */ } }, 5000);
    // 2026-07-01 — A 분할(원국·천간지지) + D(십성·용신) 4그룹 병렬. 벽시계 단축(병목 A 14K→8K).
    const groups: Array<'A' | 'D' | 'B' | 'C'> = ['A', 'D', 'B', 'C'];
    const results: Record<string, any> = {};

    try {
      const mod = await import('./ai/claudePremium');
      const apiKey = ANTHROPIC_KEY.value();

      // 각 그룹 병렬 호출 — Promise.all 대신 개별 then 으로 도착 즉시 송출
      // 2026-10-08 원가 — 4그룹이 같은 시스템 프롬프트(~2.6만 토큰)를 동시에 보내 매번 넷 다 '캐시 쓰기'(1.25배)·읽기 0 (실측 ~1,600원/건).
      //   A 가 먼저 캐시하도록 D·B·C 를 5초 늦게 출발 → 캐시 읽기(0.1배)로 건당 ~600원 절감. 내용 불변.
      const groupPromises = groups.map(async (g) => {
        if (g !== 'A') await new Promise((r) => setTimeout(r, 5000));
        const t0 = Date.now();
        try {
          const result = await mod.generateGroup(apiKey, sajuData, g, situation);
          results[g] = result;
          sendEvent('group', {
            group: g,
            // 2026-10-09 — C 에 §09 서버 주제 점수 포함 (점진 화면에서 숫자가 나중에 바뀌지 않게)
            data: g === 'C' ? { ...result, topicBaseScores: mod.computeTopicBaseScores(sajuData) } : result,
            elapsedMs: Date.now() - t0,
          });
        } catch (e: any) {
          sendEvent('groupError', { group: g, message: e.message || 'unknown' });
          throw e;
        }
      });

      await Promise.all(groupPromises);
      clearInterval(heartbeat);

      // 모든 그룹 완료 → merge + Firestore 저장
      const merged = {
        tier: 'premium' as const,
        ...results.A,
        ...results.D,
        ...results.B,
        ...results.C,
        sections: [
          ...(results.A?.sections || []),
          ...(results.D?.sections || []),
          ...(results.B?.sections || []),
        ],
        sectionConclusions: {
          ...(results.A?.sectionConclusions || {}),
          ...(results.D?.sectionConclusions || {}),
          ...(results.B?.sectionConclusions || {}),
          ...(results.C?.sectionConclusions || {}),
        },
        // 2026-09-17 — 주제 추천 점수 SSOT (주제분석 computeTopicBaseScore 와 동일 값 · AI 0). callable 경로와 동일.
        topicBaseScores: mod.computeTopicBaseScores(sajuData),
      };

      // Firestore 저장 (best-effort)
      const reportRef = db.collection('reports').doc();
      try {
        await reportRef.set({
          uid,
          type: 'premium',
          aiModel: CLAUDE_MODEL.opus,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
          shareEnabled: false,
        });
      } catch {
        // silent — 저장 실패해도 사용자에겐 결과 전달
      }
      // 2026-06-18 결과복구 — content+사주를 별도 best-effort write (색인예외 필드 'recovery').
      //   메타 저장과 분리돼 실패해도 영향 0. 생성 중 앱 종료로 클라가 결과 못 받았을 때
      //   부팅에서 recoverPremiumResult 로 끌어와 복원 (재생성 0). 미저장 시 자동환불로 degrade.
      try { await reportRef.set({ recovery: JSON.stringify({ content: merged, sajuData }) }, { merge: true }); } catch { /* 색인/용량 초과 — 복구 미지원 */ }

      sendEvent('done', { reportId: reportRef.id, content: await cleanAiOut(merged) });
      res.end();
    } catch (error: any) {
      clearInterval(heartbeat);
      console.error('generatePremiumReportStream error:', error);
      logAiFailure({ type: 'premium', stage: 'stream', message: error?.message || 'unknown', uid });
      // 환불
      if (deductedAmount > 0) {
        await refundBalance(uid, deductedAmount, 'generatePremiumReportStream failed');
      }
      sendEvent('error', { message: error?.message || 'AI 분석 실패' });
      res.end();
    }
  }
);

/* 2026-10-14 — 1운 기본 리포트(basic) 생성 경로 제거: generateReportStream(SSE) 삭제, generateReport 는 종합사주(premium) 전용.
   1운 리포트는 실사용자에게 판매된 적 없는 상품(07-01 폐기). claudeReport.ts 도 삭제 */

/**
 * 종합사주 생성 (callable) — 앱인토스 경로. 웹은 generatePremiumReportStream(SSE).
 *   2026-10-14 — premium 전용. 그 밖의 reportType 은 차감 전에 거절 (예전엔 basic 으로 빠져 1운 리포트를 만들었다)
 */
export const generateReport = onCall(
  // 2026-05-29 PM 비용 fix — minInstances: 1→0. 1GiB 상시대기 (월 ₩12K) → 0. cold start UX 로 흡수.
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'premium'); // 익명 하루 상한 (genGuard)
    const { sajuData, situation, reportType } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');
    if (reportType !== 'premium') throw new HttpsError('invalid-argument', '종합사주만 만들 수 있어요');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;  // 환불용 차감 기록

    // 런칭 시 잔액 차감 — 실명 로그인 유저만 (익명 유저는 Firestore 문서 없음)
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const cost = premiumCost();
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        // 2026-05-28 — schema 통일 helper
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const result = computeBalanceDeduction(doc.data(), cost);
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, result.updates);
        });
        deductedAmount = cost;
      }
    }

    try {
      console.log('[generateReport] Starting Claude call... reportType=premium');
      let result: any;
      {
        const premMod = await import('./ai/claudePremium');
        // 2026-10-09 — 점진 표시 (앱인토스 callable 경로): progressId 가 오면 그룹 완성마다 progress/{id} 에 write → 앱이 구독해
        //   도착한 섹션부터 보여주고 나머지는 스켈레톤. 결과 전달·차감·환불 경로는 그대로 (write 는 best-effort).
        const progressId = safeProgressId(request.data?.progressId);
        const { writeGroupProgress, setProgressMeta } = await import('./shared/progressWrite');
        if (progressId && uid !== 'anonymous') await setProgressMeta(db, progressId, uid, { type: 'premium', total: 4 });
        result = await premMod.generatePremiumReport(
          ANTHROPIC_KEY.value(),
          sajuData,
          situation,
          progressId && uid !== 'anonymous' ? (g, data) => writeGroupProgress(db, progressId, uid, g, data) : undefined,
        );
      }
      console.log('[generateReport] Claude response received, keys:', Object.keys(result?.content || {}));

      // Firestore에 리포트 저장 (content는 큰 JSON이라 별도 저장)
      const reportRef = db.collection('reports').doc();
      try {
        await reportRef.set({
          uid,
          type: 'premium',
          aiModel: CLAUDE_MODEL.opus,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
          shareEnabled: false,
        });
        console.log('[generateReport] Firestore saved');
      } catch (fsErr: any) {
        console.error('[generateReport] Firestore save failed:', fsErr.message);
      }
      // 2026-06-18 결과복구 — content+사주 별도 best-effort write (메타 저장과 분리, 색인예외 필드).
      try { await reportRef.set({ recovery: JSON.stringify({ content: result.content, sajuData }) }, { merge: true }); } catch { /* 색인/용량 초과 — 복구 미지원 */ }

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
    await guardCallable(request, 'daily'); // 익명 하루 상한 (genGuard)
    const { name, sajuData, date, weekday, todayGanzi, jeolgi, dayJiShen, dayXiongSha } = request.data || {};
    if (!sajuData || !date || !todayGanzi) {
      throw new HttpsError('invalid-argument', '사주, 날짜, 오늘 간지가 필요합니다');
    }

    const uid = request.auth?.uid;

    // 당일 캐시 확인 (실명 유저만)
    // 2026-09-17 — 캐시 키에 사주 8글자 포함. 기존 키(uid+날짜)는 사주와 무관해서, 본인 운세를 받은 뒤
    //   가족 사주로 1운을 내고 SSE 가 끊겨 이 callable 로 폴백되면 **본인 운세가 반환**됐다(유료화로 돈 문제).
    const dailyCacheId = `${date}_${buildSajuKey(sajuData)}`;
    if (uid && !request.auth?.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const cacheRef = db.collection('users').doc(uid).collection('dailyFortune').doc(dailyCacheId);
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

      // 캐싱 (실명 유저만) — 키 = 날짜 + 사주 8글자 (위 조회와 동일)
      if (uid && !request.auth?.token?.firebase?.sign_in_provider?.includes('anonymous')) {
        const cacheRef = db.collection('users').doc(uid).collection('dailyFortune').doc(dailyCacheId);
        await cacheRef.set({
          content: fsSafe(result),
          aiModel: CLAUDE_MODEL.sonnet,
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
  crime: '타인에게 해를 끼치거나 법을 어기는 일에 대한 상담은 어렵습니다. 범죄신고 112, 사이버범죄 118 로 문의해 주세요.',
  investment: '사주는 특정 종목과 번호를 예측하지 않습니다. 재물운의 흐름과 시기는 안내드릴 수 있습니다. 금융투자의 결과는 본인 책임이며, 전문가 자문을 권해드립니다.',
  medical_legal: '의료와 법률 단정은 사주의 영역이 아닙니다. 사주는 가능성과 흐름을 보는 도구입니다. 확정 진단은 해당 분야 전문가의 진단과 자문을 권해드립니다.',
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
function buildSajuKey(sajuData: any): string {
  try {
    const p = sajuData?.pillars || [];
    const ch = (i: number) => {
      const pillar = p[i];
      if (!pillar || pillar.available === false) return 'XX';
      return `${pillar.천간 || 'X'}${pillar.지지 || 'X'}`;
    };
    return `${ch(0)}${ch(1)}${ch(2)}${ch(3)}`;
  } catch {
    return 'XXXXXXXX';
  }
}

export const generateDailyFortuneStream = onRequest(
  {
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    minInstances: 0, // 2026-06-15→2026-09-03 비용 fix: 1→0. 상시대기 5함수(스트리밍) 월 ~₩9~10만원 → 제거. cold start 는 로딩 UX 로 흡수.
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
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

    const sendEvent = (event: string, data: any) => {
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
      } catch { /* anonymous */ }
    }

    const {
      name, sajuData, date, weekday, todayGanzi, jeolgi, dayJiShen, dayXiongSha,
      baseScores100, tomorrowGanzi, tomorrowDate,
    } = req.body || {};

    if (!sajuData || !date || !todayGanzi) {
      sendEvent('error', { message: '사주, 날짜, 오늘 간지가 필요합니다' });
      res.end();
      return;
    }
    if (!(await guardHttp(req, uid === 'anonymous' ? null : uid, isAnonymous, 'daily'))) {
      sendEvent('error', { message: GEN_LIMIT_MESSAGE }); res.end(); return;
    }

    sendEvent('start', { ts: Date.now() });

    // ── L1 · Shared Cache 조회 (uid 무관 by 8글자 + 날짜) ──
    // 2026-10-04 v6→v7 — 만나는 사람 글자 확정값·용어 주어 금지·성별 해석 프롬프트 개편 (옛 공유캐시 재사용 방지)
    // 2026-10-08 v9 — A2·B Sonnet 승격 + 오행 관계·시간대 확정표 (오너: 무료여도 고퀄리티 명리 해석)
    const SCHEMA_VERSION = 'v14'; // v14 — nextHooks(다음 주제·사주대화 질문)
    // v13 // v13 — 어조 점검 예시를 내용 없는 패턴(OO)으로 (v12 패널: ✓예시 '돈이 새는 날'을 3/6명이 복사)
    // v12 // 10-08 단정 어조(~하기 쉬워요·~할 수 있어요 금지)·무색무취 문장 금지 / 10-09 출력 직전 어조 점검(user 끝)
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
          // 사용 마커 (2026-06-12 어드민 '오늘의 운세' 집계) — 익명 포함 · fire-and-forget.
          //   기존엔 공유캐시 히트 시 기록 0 + 익명 제외 → 어드민 오늘운세 0건의 원인.
          if (uid !== 'anonymous') {
            db.doc(`users/${uid}/dailyFortune/${date}`)
              .set({ servedAt: admin.firestore.FieldValue.serverTimestamp(), via: 'shared' }, { merge: true })
              .catch(() => { /* noop */ });
          }
          sendEvent('done', { result: await cleanAiOut(content), cached: true, cacheLevel: 'shared' });
          res.end();
          return;
        }
      }
    } catch (e: any) {
      console.warn('[dailyFortuneStream] shared cache check failed:', e?.message);
    }

    // ── L2 · Haiku 3-way 병렬 + 강력 sanity check + Sonnet fallback (v6.5) ──
    // 실측: Haiku 단일 = 60s (출력 8800자 / ~100 tok/s)
    // 3-way 병렬: max(A1=5s, A2=18s, B=18s) ≈ 18s
    // 각 그룹 sanity check (글자수 + 핵심 필드) → 누락 시 Sonnet 단일 fallback
    try {
      const {
        DAILY_FORTUNE_SYSTEM_V3,
        DAILY_FORTUNE_USER_V3,
        DAILY_FORTUNE_USER_V3_GROUP_A1,
        DAILY_FORTUNE_USER_V3_GROUP_A2,
        DAILY_FORTUNE_USER_V3_GROUP_B,
        parseJsonResponse,
        TONE_FINAL_CHECK,
      } = await import('./ai/promptsV3');
      const { applyDailyMeetGlyphs, sanitizeAiOutput, todayHourWindows } = await import('./ai/sajuFacts');
      const hourWin = todayHourWindows(String(date || ''), sajuData);
      /* 2026-10-08 — 그룹별 모델: A1(헤더·점수 · 첫 화면 ~5초)은 Haiku 유지, 해석 본문 A2·시간대/사람/행운 B 는 Sonnet.
       *   A/B 시식(같은 사주·같은 날): Haiku 는 명리 용어 주어·병렬 그룹 간 시간대 모순·처방형 미신·성별 설명 문장이 남고,
       *   Sonnet 은 일상어 장면·일관성이 뚜렷이 우수. 원가 ~190→~320원/건 (공유 캐시라 같은 사주·같은 날은 1회만). */
      const GROUP_MODEL: Record<'A1' | 'A2' | 'B', string> = { A1: CLAUDE_MODEL.haiku, A2: CLAUDE_MODEL.sonnet, B: CLAUDE_MODEL.sonnet };
      const anthropic = createClaude(ANTHROPIC_KEY.value());
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

      /* 2026-10-08 — Sonnet 승격 후 A2·B 가 각 ~70s → 앱(09-17 번들 포함)의 90초 SSE 폴백 한계에 근접.
       *   서버에서 A2 = A2a(본문·사주 톤) + A2b(기둥별·분야별 풀이), B = B1(시간대·할 일) + B2(사람·행운·내일)로 반씩 병렬 생성해
       *   클라에는 기존과 똑같이 'A1'·'A2'·'B' 3개 group 이벤트로 보낸다 (클라 변경 0 · 본문은 A2a 가 'A2' 로 실시간 스트리밍).
       *   Sonnet 4호출은 같은 시스템 프롬프트 → A2a 가 먼저 캐시를 쓰고 나머지는 4초 뒤 출발해 캐시 읽기. */
      type DailySub = 'A1' | 'A2a' | 'A2b' | 'B1' | 'B2';
      const SUB_MODEL: Record<DailySub, string> = {
        A1: GROUP_MODEL.A1, A2a: GROUP_MODEL.A2, A2b: GROUP_MODEL.A2, B1: GROUP_MODEL.B, B2: GROUP_MODEL.B,
      };
      const SUB_KEYS: Record<Exclude<DailySub, 'A1'>, string[]> = {
        A2a: ['todayNarrative', 'sajuTone'],
        A2b: ['pillarMessages', 'ohengDistribution', 'todayOhengEmphasis', 'subScoreReasons'],
        B1: ['timeSlots', 'hourlyPeak', 'hourlyAvoid', 'doList', 'dontList'],
        B2: ['meetPeople', 'luckyProfile', 'dailyQuote', 'tomorrow', 'nextHooks'],
      };
      const subOnly = (sub: Exclude<DailySub, 'A1'>) =>
        `\n\n## ⚡⚡ 이번 호출의 최종 출력 범위 (위 스키마 중 이 키들만): ${SUB_KEYS[sub].join(', ')}\n` +
        `이 키들만 담은 JSON 객체 하나만 출력. 다른 키는 다른 호출이 쓰므로 출력 금지. 위 '오늘 시간대와 오행 관계 확정표'를 그대로 따를 것.`;

      /* 2026-10-15 프롬프트 캐싱 — 짝 호출(A2a와 A2b, B1과 B2)은 같은 사용자 프롬프트(userA2, userB, 1건 약 8,500토큰)에
       *   출력 범위(subOnly)만 다르다. 공유 부분을 캐시 블록으로 떼어 먼저 출발한 호출이 쓰고 늦게 출발한 호출이 5% 값으로 읽는다.
       *   운영 실측(5.5 전환 뒤): Sonnet 호출 1건 약 65원 중 캐시 밖 입력 24원. 글은 그대로(블록만 나눔). */
      const runSub = async (sub: DailySub, userPrompt: string, maxTokens: number, streamAs: 'A1' | 'A2' | 'B' | null, delayMs = 0, suffix = '') => {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        const groupModel = SUB_MODEL[sub];
        const tg0 = Date.now();
        let accumulated = '';
        let chunkCount = 0;
        const stream = anthropic.messages.stream({
          model: groupModel,
          // 2026-10-14 — 본문(Sonnet)은 생각 켬 + medium (같은 사주 A/B: 29초→14초, 장면 묘사 유지). 머리(Haiku)는 생각 끔 기본값
          ...(groupModel === CLAUDE_MODEL.sonnet ? CONVERSATIONAL : {}),
          max_tokens: maxTokens,
          system: [{
            type: 'text',
            text: system,
            // 2026-10-08 — 1h TTL(쓰기 2배)은 하루 수 건 트래픽에선 재사용이 거의 없어 손해 → 기본 5분(쓰기 1.25배)
            cache_control: { type: 'ephemeral' },
          }],
          messages: [{
            role: 'user',
            content: suffix
              ? [
                  { type: 'text', text: userPrompt, cache_control: { type: 'ephemeral' } },
                  { type: 'text', text: suffix + TONE_FINAL_CHECK },
                ]
              : userPrompt + TONE_FINAL_CHECK,
          }],
        });
        for await (const event of stream as any) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            accumulated += event.delta.text;
            chunkCount++;
            if (streamAs) sendEvent('chunk', { group: streamAs, delta: event.delta.text, totalChars: accumulated.length, chunkIdx: chunkCount });
          }
        }
        // C7 원가 기록 — 루프 종료 시점엔 finalMessage 가 즉시 resolve(usage·stop_reason). 실패해도 생성 흐름 영향 0.
        try { logAnthropicUsage('daily', groupModel, await stream.finalMessage(), tg0, 'stream'); } catch { /* best-effort */ }
        const elapsedMs = Date.now() - tg0;
        let parsed: any = {};
        try {
          parsed = parseJsonResponse(accumulated, { repairUsed: false }) || {};
        } catch (parseErr: any) {
          console.error(`[dailyFortuneStream] ${sub} parse FAILED:`, parseErr?.message);
          parsed = {};
        }
        console.log(`[dailyFortuneStream] ${sub} complete`, { model: groupModel, chars: accumulated.length, elapsedMs, keys: Object.keys(parsed || {}).join(',') });
        return { parsed: (parsed && typeof parsed === 'object') ? parsed : {}, elapsedMs };
      };

      const pA1 = runSub('A1', userA1, 1500, 'A1').then((r) => {
        const data = sanitizeAiOutput(r.parsed);
        sendEvent('group', { group: 'A1', data, elapsedMs: r.elapsedMs });
        return data;
      });
      const pA2 = Promise.all([
        runSub('A2a', userA2, 4000, 'A2', 0, subOnly('A2a')),
        runSub('A2b', userA2, 4000, null, 4000, subOnly('A2b')),
      ]).then(([x, y]) => {
        const data = sanitizeAiOutput({ ...y.parsed, ...x.parsed });
        sendEvent('group', { group: 'A2', data, elapsedMs: Math.max(x.elapsedMs, y.elapsedMs + 4000) });
        return data;
      });
      const pB = Promise.all([
        runSub('B1', userB, 4000, 'B', 4000, subOnly('B1')),
        // B2 는 B1 의 캐시가 쓰인 뒤(응답 시작 뒤) 출발해야 읽는다 — 2.5초 늦춤 (B 묶음은 화면에서 마지막에 오는 부분)
        runSub('B2', userB, 4000, null, 6500, subOnly('B2')),
      ]).then(([x, y]) => {
        let data: any = { ...y.parsed, ...x.parsed };
        // 2026-10-04 — 만나는 사람 글자 = 용신·희신·기신 확정값 (예시 복사 방지) / 10-08 시간대 서버 확정값
        data = applyDailyMeetGlyphs(data, sajuData);
        if (hourWin.peak && data?.hourlyPeak) data.hourlyPeak.range = hourWin.peak;
        if (hourWin.avoid && data?.hourlyAvoid) data.hourlyAvoid.range = hourWin.avoid;
        // 2026-10-09 — 다음 콘텐츠 연결(주제 1 + 사주대화 질문 3) 정리 (허용 id·길이)
        if (data?.nextHooks && typeof data.nextHooks === 'object') {
          const okIds = ['love', 'wealth', 'career', 'health', 'exam', 'reunion', 'marriage'];
          const tp = data.nextHooks.topic;
          data.nextHooks = {
            topic: tp && okIds.includes(tp.id) && typeof tp.hook === 'string' ? { id: tp.id, hook: String(tp.hook).replace(/<[^>]+>/g, '').trim().slice(0, 90) } : null,
            chatQuestions: (Array.isArray(data.nextHooks.chatQuestions) ? data.nextHooks.chatQuestions : [])
              .filter((q: any) => typeof q === 'string' && q.trim()).slice(0, 3).map((q: string) => q.replace(/<[^>]+>/g, '').trim().slice(0, 60)),
          };
        }
        data = sanitizeAiOutput(data);
        sendEvent('group', { group: 'B', data, elapsedMs: Math.max(x.elapsedMs + 4000, y.elapsedMs + 6500) });
        return data;
      });
      const [resA1, resA2, resB] = await Promise.all([pA1, pA2, pB]);

      const a1: any = (resA1 && typeof resA1 === 'object') ? resA1 : {};
      const a2: any = (resA2 && typeof resA2 === 'object') ? resA2 : {};
      const b: any = (resB && typeof resB === 'object') ? resB : {};

      // 강력한 sanity check (글자수 + 핵심 필드)
      const a1OK = !!(a1.title && a1.subScores && a1.subScoreOneLines &&
                       Object.keys(a1.subScoreOneLines).length >= 4);
      const a2OK = !!(a2.todayNarrative && a2.todayNarrative.length >= 600 &&
                       a2.pillarMessages && a2.subScoreReasons);
      const bOK = !!(Array.isArray(b.timeSlots) && b.timeSlots.length >= 3 &&
                      Array.isArray(b.doList) && b.doList.length >= 2 &&
                      b.luckyProfile && Object.keys(b.luckyProfile).length >= 4);
      console.log(`[dailyFortuneStream] sanity: A1=${a1OK} A2=${a2OK} B=${bOK}`);

      let merged: any = { ...a1, ...a2, ...b };

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
          model: CLAUDE_MODEL.sonnet,
          max_tokens: 8000,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } as any }],
          messages: [{ role: 'user', content: fbUser + TONE_FINAL_CHECK }],
        });
        for await (const event of fbStream as any) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            fbAcc += event.delta.text;
            sendEvent('chunk', { group: 'fallback', delta: event.delta.text, totalChars: fbAcc.length });
          }
        }
        // C7 원가 기록 — 루프 종료 시점엔 finalMessage 가 즉시 resolve(usage·stop_reason). 실패해도 생성 흐름 영향 0.
        try { logAnthropicUsage('daily', CLAUDE_MODEL.sonnet, await fbStream.finalMessage(), tFb, 'fallback'); } catch { /* best-effort */ }
        try {
          const fbParsed: any = parseJsonResponse(fbAcc, { repairUsed: false }) || {};
          // 정상 그룹은 유지, 누락된 부분만 Sonnet 결과로 채움
          merged = {
            ...fbParsed,
            ...(a1OK ? a1 : {}),
            ...(a2OK ? a2 : {}),
            ...(bOK ? b : {}),
          };
          console.log(`[dailyFortuneStream] Sonnet fallback complete (${Date.now() - tFb}ms) → ${Object.keys(fbParsed).length} keys`);
        } catch (e: any) {
          console.error('[dailyFortuneStream] Sonnet fallback parse failed:', e?.message);
        }
      }

      merged = sanitizeAiOutput(applyDailyMeetGlyphs(merged, sajuData)); // 폴백 경로 포함 최종 정리
      console.log('[dailyFortuneStream] complete', {
        totalElapsedMs: Date.now() - t0,
        sajuKey,
        finalKeys: Object.keys(merged).length,
        model: 'A1 haiku, A2/B sonnet (+ sonnet-fallback)',
      });

      // ── L1 · Shared Cache 저장 (uid 무관) ──
      try {
        await sharedCacheRef.set({
          content: fsSafe(merged),
          aiModel: 'haiku-a1+sonnet-a2b',
          schemaVersion: SCHEMA_VERSION,
          sajuKey,
          date,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[dailyFortuneStream] shared cache saved key=${sharedCacheKey}`);
      } catch (e: any) {
        console.warn('[dailyFortuneStream] shared cache save failed:', e?.message);
      }

      // 사용 마커 (2026-06-12 어드민 집계) — 익명 포함. legacy 콘텐츠 캐시와 별개 (plain date 문서).
      if (uid !== 'anonymous') {
        db.doc(`users/${uid}/dailyFortune/${date}`)
          .set({ servedAt: admin.firestore.FieldValue.serverTimestamp(), via: 'stream' }, { merge: true })
          .catch(() => { /* noop */ });
      }

      // 유저별 캐시 (legacy v5 호환 — 기존 구독/저장 로직 유지)
      if (uid !== 'anonymous' && !isAnonymous) {
        try {
          const userCacheRef = db.doc(`users/${uid}/dailyFortune/${date}_${SCHEMA_VERSION}`);
          await userCacheRef.set({
            content: fsSafe(merged),
            aiModel: 'haiku-a1+sonnet-a2b',
            schemaVersion: SCHEMA_VERSION,
            sharedKey: sharedCacheKey,
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (e: any) {
          console.warn('[dailyFortuneStream] user cache save failed:', e?.message);
        }
      }

      sendEvent('done', {
        result: await cleanAiOut(merged),
        cached: false,
        cacheLevel: 'miss',
        elapsedMs: Date.now() - t0,
      });
    } catch (e: any) {
      console.error('[dailyFortuneStream] FAILED:', e?.message, e);
      sendEvent('error', { message: e?.message || '오늘의 운세 생성 실패' });
    }

    res.end();
  },
);

export const generateChatAnswer = onCall(
  // 2026-04-21 사주대화 Sonnet 4.6 전환 → secrets 키도 ANTHROPIC_KEY 로 교체
  // 2026-05-29 PM 비용 fix — minInstances: 1→0. 512MiB 상시대기 (월 ₩7K) → 0. cold start UX 로 흡수.
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 120, memory: '512MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'chat'); // 익명 하루 상한 (genGuard)
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
    await guardCallable(request, 'dream'); // 익명 하루 상한 (genGuard)
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
 *   쿼터: 월별 이용일 집계만 (Firestore users/{uid}/dreamQuota/{YYYY-MM}, KST). 차단 없음(2026-09-17). 익명 uid 는 미적용.
 *   2026-09-17 — 꿈해몽 '하루 1회 무료, 이후 1운' 정책: 클라가 1운 차감 후 생성하면 `paid: true` 를 보낸다.
 *   유료 생성은 쿼터에서 제외(1운 낸 꿈이 8일째부터 거부되던 문제). 차감은 클라 기준이라 위조 가능하지만
 *   이 쿼터는 웹 로그인 유저 한정 비용 가드일 뿐이라 허용한다.
 */
export const generateDreamFree = onCall(
  // minInstances: 0 — warm 비용 대신 로딩 UX 로 Cold start 흡수 (feedback_quality_over_speed 원칙)
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'dream'); // 익명 하루 상한 (genGuard)
    const { saju, dreamContent, category, userConcern, paid } = request.data || {};
    if (!category) throw new HttpsError('invalid-argument', '카테고리가 없습니다');

    const uid = request.auth?.uid;
    if (uid && paid !== true && !request.auth?.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      // 쿼터 체크 — 월 7일 상한 (KST 기준 · 1운 유료 생성은 제외)
      const kn = kstNow();
      const yyyymm = `${kn.year}-${String(kn.month).padStart(2, '0')}`;
      const quotaRef = db.collection('users').doc(uid).collection('dreamQuota').doc(yyyymm);
      const today = `${yyyymm}-${String(kn.day).padStart(2, '0')}`;
      await db.runTransaction(async (tx) => {
        const q = await tx.get(quotaRef);
        const data = q.data() || { monthCount: 0, lastDate: null };
        // 2026-09-17 — 월 7일 차단 제거: 약관 제5조 '꿈해몽 하루 1회 무료(이후 1운)'와 충돌했고, 차단 시
        //   클라가 1운 흐름으로도 넘어가지 못했다. 무료 1일 1회는 클라 무료권이 강제한다. 집계(monthCount)만 유지.
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

/* ══════════════════════════════════════════════════════════════════
 * generateDreamFreeStream — SSE 스트리밍 (오늘의 운세 패턴)
 *
 * callable generateDreamFree 와 프롬프트·모델·출력 100% 동일 (전송만 SSE).
 * 쿼터(월 7회) 체크도 동일. 무료라 잔액 차감 없음.
 * 클라가 partial-json 점진 렌더 → 첫 글자 빠르게, 내용 차오름 (저퀄·깨짐 0).
 * ⚠️ 쪼개기 X (구 2그룹 분할 회귀 교훈) — 단일 호출 그대로 스트리밍만.
 * ═════════════════════════════════════════════════════════════════ */
export const generateDreamFreeStream = onRequest(
  {
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    minInstances: 0, // 2026-06-15→2026-09-03 비용 fix: 1→0. 상시대기 5함수(스트리밍) 월 ~₩9~10만원 → 제거. cold start 는 로딩 UX 로 흡수.
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let uid: string | undefined;
    let isAnon = true;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
        uid = decoded.uid;
        isAnon = decoded.firebase?.sign_in_provider === 'anonymous';
      } catch { /* anonymous */ }
    }

    const { saju, dreamContent, category, userConcern, paid } = req.body || {};
    if (!category) { sendEvent('error', { message: '카테고리가 없습니다' }); res.end(); return; }
    if (!(await guardHttp(req, uid ?? null, isAnon, 'dream'))) { sendEvent('error', { message: GEN_LIMIT_MESSAGE }); res.end(); return; }

    // 쿼터 체크 (월 7일 · KST) — callable 과 동일. 1운 유료 생성(paid)은 제외.
    if (uid && !isAnon && paid !== true) {
      try {
        const kn = kstNow();
        const yyyymm = `${kn.year}-${String(kn.month).padStart(2, '0')}`;
        const quotaRef = db.collection('users').doc(uid).collection('dreamQuota').doc(yyyymm);
        const today = `${yyyymm}-${String(kn.day).padStart(2, '0')}`;
        await db.runTransaction(async (tx) => {
          const q = await tx.get(quotaRef);
          const data = q.data() || { monthCount: 0, lastDate: null };
          // 2026-09-17 — 월 7일 차단 제거 (callable 과 동일 · 집계만 유지)
          const inc = data.lastDate === today ? 0 : 1;
          tx.set(quotaRef, {
            monthCount: data.monthCount + inc,
            lastDate: today,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        });
      } catch (qErr: any) {
        sendEvent('error', { message: qErr?.message || '쿼터 확인 실패', code: 'quota' });
        res.end();
        return;
      }
    }

    sendEvent('start', { ts: Date.now() });

    try {
      const { buildDreamFreeCall, buildDreamFreeGroupCall } = await lazyClaudeDream();
      const { parseJsonResponse, TONE_FINAL_CHECK } = await import('./ai/promptsV3');
      const anthropic = createClaude(ANTHROPIC_KEY.value());
      const t0 = Date.now();

      // 2026-05-27 v8 — 2-그룹 병렬 (사주 있을 때만, 없으면 단일 호출)
      const hasSaju = !!saju;
      if (hasSaju) {
        console.log('[dreamFreeStream] 2-group parallel mode');

        const runGroup = async (group: 'A' | 'B'): Promise<{ group: 'A' | 'B'; parsed: any; elapsedMs: number }> => {
          // 2026-10-15 — 두 그룹이 같은 시스템 프롬프트(약 1만 토큰대)를 캐시 없이 각자 정가로 보냈다(꿈해몽 1건 195원).
          //   A 가 캐시를 쓰고, 잠금 칸인 B 는 3초 늦게 출발해 캐시로 읽는다.
          if (group === 'B') await new Promise((r) => setTimeout(r, 3000));
          const tg0 = Date.now();
          const { system, user, model, maxTokens } = buildDreamFreeGroupCall(
            { saju, dreamContent: dreamContent || '', category, userConcern },
            group,
          );
          const runStream = async (): Promise<string> => {
            let acc = '';
            let idx = 0;
            const _t0 = Date.now(); // C7
            const stream = anthropic.messages.stream({
              model, max_tokens: maxTokens,
              system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
              messages: [{ role: 'user', content: user + TONE_FINAL_CHECK }],
            });
            for await (const event of stream as any) {
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                acc += event.delta.text;
                idx++;
                // 그룹 식별자 포함해서 emit (client 가 머지)
                sendEvent('chunk', { group, delta: event.delta.text, totalChars: acc.length, chunkIdx: idx });
              }
            }
            // C7 원가 기록 — 루프 종료 시점엔 finalMessage 가 즉시 resolve(usage·stop_reason). 실패해도 생성 흐름 영향 0.
            try { logAnthropicUsage('dream', model, await stream.finalMessage(), _t0, 'stream'); } catch { /* best-effort */ }
            return acc;
          };
          let text = await runStream();
          let parsed: any;
          try {
            parsed = parseJsonResponse(text, { repairUsed: false });
          } catch (e1: any) {
            console.warn(`[dreamFreeStream:${group}] 1차 파싱 실패 → 재시도:`, e1?.message);
            sendEvent('retry', { group, reason: 'parse_fail' });
            text = await runStream();
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
        sendEvent('done', { content: await cleanAiOut(merged), elapsedMs: totalMs, mode: '2-group-parallel' });
        res.end();
        return;
      }

      // 사주 없음 → 단일 호출 fallback (callable 과 동일)
      console.log('[dreamFreeStream] no saju → single-call mode');
      const { system, user, model, maxTokens } = buildDreamFreeCall({
        saju, dreamContent: dreamContent || '', category, userConcern,
      });
      const runStream = async (): Promise<string> => {
        let acc = '';
        let idx = 0;
        const _t0 = Date.now(); // C7
        const stream = anthropic.messages.stream({
          model, max_tokens: maxTokens, system,
          messages: [{ role: 'user', content: user + TONE_FINAL_CHECK }],
        });
        for await (const event of stream as any) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            acc += event.delta.text;
            idx++;
            sendEvent('chunk', { delta: event.delta.text, totalChars: acc.length, chunkIdx: idx });
          }
        }
        // C7 원가 기록 — 루프 종료 시점엔 finalMessage 가 즉시 resolve(usage·stop_reason). 실패해도 생성 흐름 영향 0.
        try { logAnthropicUsage('dream', model, await stream.finalMessage(), _t0, 'stream'); } catch { /* best-effort */ }
        return acc;
      };
      let text = await runStream();
      let parsed: any;
      try {
        parsed = parseJsonResponse(text, { repairUsed: false });
      } catch (e1: any) {
        console.warn('[dreamFreeStream] 1차 파싱 실패 → 재시도:', e1?.message);
        sendEvent('retry', { reason: 'parse_fail' });
        text = await runStream();
        parsed = parseJsonResponse(text, { repairUsed: false });
      }
      console.log(`[dreamFreeStream] single-call done in ${Date.now() - t0}ms`);
      sendEvent('done', { content: await cleanAiOut(parsed), elapsedMs: Date.now() - t0, mode: 'single-call' });
      res.end();
    } catch (error: any) {
      console.error('generateDreamFreeStream error:', error);
      sendEvent('error', { message: error?.message || '꿈해몽 생성 실패' });
      res.end();
    }
  }
);

/**
 * 꿈해몽 심층 (신규 v3, 유료 1운) — Claude Sonnet 4.6 + 2차 자기 리뷰.
 */
export const generateDreamDeep = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'dreamDeep'); // 익명 하루 상한 (genGuard)
    const { saju, dreamContent, category, freeResultSummary } = request.data || {};
    if (!saju) throw new HttpsError('invalid-argument', '사주 데이터가 필요합니다');

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
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
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
      await setReportSafe(reportRef, {
        uid, type: 'deepDream', content: result,
        aiModel: CLAUDE_MODEL.sonnet,
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
          amount: ({ 1: 500, 3: 1500, 5: 2500, 10: 5000 } as Record<number, number>)[paidUn] ?? paidUn * 500,
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
    await guardCallable(request, 'daeun'); // 익명 하루 상한 (genGuard)
    const { sajuData } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

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
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, result.updates);
        });
        deductedAmount = 1;
      }
    }

    try {
      const { generateDaeunAnalysis } = await lazyClaudeDaeun();
      const result = await generateDaeunAnalysis(ANTHROPIC_KEY.value(), sajuData);
      const reportRef = db.collection('reports').doc();
      await setReportSafe(reportRef, {
        uid, type: 'daeun', content: result,
        aiModel: CLAUDE_MODEL.sonnet,
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
    await guardCallable(request, 'monthly'); // 익명 하루 상한 (genGuard)
    // 2026-06-30 재작업 — 단일월 심층. monthInfo = 클라가 lunar 로 계산한 선택월 정보
    //   { year, month, label, wolGanji, yearGanji }. 서버는 간지 추측 X (만세력 정확성).
    const { sajuData, monthInfo, progressId } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    const authUid = request.auth?.uid; // 점진 progress rules 매칭용 (익명도 실제 uid)
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        // 2026-05-28 — schema 통일 helper
        // 2026-07-01 월운 — 서버가 직접 세일 계산(monthlyCost): 하반기 이벤트 5운(7/15까지)·이후 정가 7운.
        //   클라 getMonthlyPrice().actualPrice 와 동일 로직 → 로컬/Firestore 잔액 정합(over/under-charge 0).
        const cost = monthlyCost();
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const result = computeBalanceDeduction(doc.data(), cost);
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, result.updates);
        });
        deductedAmount = cost;
      }
    }

    try {
      const { generateMonthlyFortune } = await lazyClaudeMonthly();
      // 점진 로딩 — progressId 있으면 M1/M2 분할 + 그룹 완성 시 progress 증분 write. 없으면 기존 단일 콜(FULL).
      //   두 경로 모두 머지본을 그대로 반환(머니 경로·저장·환불 무변경).
      const result = await generateMonthlyFortune(
        ANTHROPIC_KEY.value(), sajuData, monthInfo,
        progressId ? (key, data) => { void writeGroupProgress(db, progressId, authUid, key, data); } : undefined,
      );
      const reportRef = db.collection('reports').doc();
      await setReportSafe(reportRef, {
        uid, type: 'monthly', content: result,
        // 선택월 메타 — 보관함 재진입·구분용 (monthInfo 없으면 result 의 year/month 폴백)
        targetYear: monthInfo?.year ?? result?.year ?? null,
        targetMonth: monthInfo?.month ?? result?.month ?? null,
        aiModel: CLAUDE_MODEL.sonnet,
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
 * ⚡ 월별 운세 초안 (draft·1차만) — async 2차리뷰용. 로딩 반토막.
 *   차감은 여기서 1회(monthlyCost). 1차 결과를 즉시 반환(유저 조기 열람) + 리포트에 draft:true 저장.
 *   2차 보정은 generateMonthlyRefine(백그라운드·무차감)에서.
 */
export const generateMonthlyDraft = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'monthly'); // 익명 하루 상한 (genGuard)
    const { sajuData, monthInfo } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const cost = monthlyCost(); // 하반기 이벤트 반영 (generateMonthly 와 동일 로직)
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const result = computeBalanceDeduction(doc.data(), cost);
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, result.updates);
        });
        deductedAmount = cost;
      }
    }

    try {
      const cm = await lazyClaudeMonthly();
      const draft = await cm.generateMonthlyDraft(ANTHROPIC_KEY.value(), sajuData, monthInfo);
      const reportRef = db.collection('reports').doc();
      await setReportSafe(reportRef, {
        uid, type: 'monthly', content: draft, draft: true,
        targetYear: monthInfo?.year ?? draft?.year ?? null,
        targetMonth: monthInfo?.month ?? draft?.month ?? null,
        aiModel: CLAUDE_MODEL.sonnet,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { reportId: reportRef.id, content: draft };
    } catch (error: any) {
      console.error('generateMonthlyDraft error:', error);
      await refundBalance(uid, deductedAmount, 'generateMonthlyDraft failed');
      throw new HttpsError('internal', `월별 운세(초안) 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * ⚡ 월별 운세 보정 (refine·2차만) — async 2차리뷰 백그라운드. 🛡️ 무차감.
 *   draft 를 받아 자가 점검·보정 → 최종본. 실패해도 draft 반환(유저는 이미 draft 봤음·환불 X).
 *   같은 reportId 리포트를 최종본으로 갱신(draft:false).
 */
export const generateMonthlyRefine = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'monthly'); // 익명 하루 상한 (genGuard)
    const { sajuData, monthInfo, draft, reportId } = request.data;
    if (!sajuData || !draft) throw new HttpsError('invalid-argument', '보정할 데이터가 없습니다');
    try {
      const cm = await lazyClaudeMonthly();
      const refined = await cm.generateMonthlyRefine(ANTHROPIC_KEY.value(), sajuData, monthInfo, draft);
      if (reportId && typeof reportId === 'string') {
        try {
          await setReportSafe(db.collection('reports').doc(reportId),
            { content: refined, draft: false, refinedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true },
          );
        } catch { /* 갱신 실패 무해 — 클라가 자체 저장 */ }
      }
      return { content: refined };
    } catch (error: any) {
      // best-effort — 2차 실패 시 draft 그대로(무해·무차감이라 환불 대상 아님).
      console.warn('generateMonthlyRefine 실패(draft 유지):', error?.message);
      return { content: draft };
    }
  }
);

/**
 * 주간운세 (이번 주 7일) — Claude Sonnet 4.6
 * 2026-06-29 NEW (5운). weekDays = 클라(WeeklyPage)가 lunar-javascript 로 계산한 7일 일진.
 */
export const generateWeekly = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'weekly'); // 익명 하루 상한 (genGuard)
    const { sajuData, weekDays } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        // 2026-07-01 주간 — 서버가 직접 세일 계산(weeklyCost): 하반기 이벤트 3운(7/15까지)·이후 정가 5운.
        //   클라 getWeeklyPrice().actualPrice 와 동일 로직 → 로컬/Firestore 잔액 정합(over/under-charge 0).
        const cost = weeklyCost();
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const result = computeBalanceDeduction(doc.data(), cost);
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, result.updates);
        });
        deductedAmount = cost;
      }
    }

    try {
      const { generateWeeklyFortune } = await lazyClaudeWeekly();
      const result = await generateWeeklyFortune(ANTHROPIC_KEY.value(), sajuData, weekDays);
      const reportRef = db.collection('reports').doc();
      await setReportSafe(reportRef, {
        uid, type: 'weekly', content: result,
        aiModel: CLAUDE_MODEL.sonnet,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { reportId: reportRef.id, content: result };
    } catch (error: any) {
      console.error('generateWeekly error:', error);
      await refundBalance(uid, deductedAmount, 'generateWeekly failed');
      throw new HttpsError('internal', `주간운세 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * ⚡ 주간운세 초안 (draft·1차만) — async 2차리뷰용. 로딩 반토막. 차감 1회(weeklyCost).
 */
export const generateWeeklyDraft = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'weekly'); // 익명 하루 상한 (genGuard)
    const { sajuData, weekDays } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const cost = weeklyCost(); // 하반기 이벤트 반영 (generateWeekly 와 동일)
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const result = computeBalanceDeduction(doc.data(), cost);
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, result.updates);
        });
        deductedAmount = cost;
      }
    }

    try {
      const cw = await lazyClaudeWeekly();
      const draft = await cw.generateWeeklyDraft(ANTHROPIC_KEY.value(), sajuData, weekDays);
      const reportRef = db.collection('reports').doc();
      await setReportSafe(reportRef, {
        uid, type: 'weekly', content: draft, draft: true,
        aiModel: CLAUDE_MODEL.sonnet,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { reportId: reportRef.id, content: draft };
    } catch (error: any) {
      console.error('generateWeeklyDraft error:', error);
      await refundBalance(uid, deductedAmount, 'generateWeeklyDraft failed');
      throw new HttpsError('internal', `주간운세(초안) 실패: ${error.message || 'unknown'}`);
    }
  }
);

/**
 * ⚡ 주간운세 보정 (refine·2차만) — async 2차리뷰 백그라운드. 🛡️ 무차감.
 *   실패해도 draft 반환(유저는 이미 draft 봤음·환불 X). 같은 reportId 최종본 갱신.
 */
export const generateWeeklyRefine = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'weekly'); // 익명 하루 상한 (genGuard)
    const { sajuData, weekDays, draft, reportId } = request.data;
    if (!sajuData || !draft) throw new HttpsError('invalid-argument', '보정할 데이터가 없습니다');
    try {
      const cw = await lazyClaudeWeekly();
      const refined = await cw.generateWeeklyRefine(ANTHROPIC_KEY.value(), sajuData, weekDays, draft);
      if (reportId && typeof reportId === 'string') {
        try {
          await setReportSafe(db.collection('reports').doc(reportId),
            { content: refined, draft: false, refinedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true },
          );
        } catch { /* 갱신 실패 무해 */ }
      }
      return { content: refined };
    } catch (error: any) {
      console.warn('generateWeeklyRefine 실패(draft 유지):', error?.message);
      return { content: draft };
    }
  }
);

/**
 * 궁합 분석 — Claude Sonnet 4.6
 */
export const generateCompatibility = onCall(
  { secrets: [ANTHROPIC_KEY], timeoutSeconds: 300, memory: '1GiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    await guardCallable(request, 'compat'); // 익명 하루 상한 (genGuard)
    const { sajuData1, sajuData2, relation } = request.data;
    if (!sajuData1 || !sajuData2) throw new HttpsError('invalid-argument', '두 사람의 사주 데이터가 필요합니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        // 2026-05-28 — schema 통일 helper
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const result = computeBalanceDeduction(doc.data(), COMPAT_COST);
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, result.updates);
        });
        deductedAmount = COMPAT_COST;
      }
    }

    try {
      const { generateCompatibilityAnalysis } = await lazyClaudeCompat();
      const result = await generateCompatibilityAnalysis(
        ANTHROPIC_KEY.value(), sajuData1, sajuData2, relation || '연인'
      );
      const reportRef = db.collection('reports').doc();
      await setReportSafe(reportRef, {
        uid, type: 'compatibility', content: result,
        aiModel: CLAUDE_MODEL.sonnet,
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
    await guardCallable(request, 'newyear'); // 익명 하루 상한 (genGuard)
    const { sajuData } = request.data;
    if (!sajuData) throw new HttpsError('invalid-argument', '사주 데이터가 없습니다');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        // 2026-05-28 — schema 통일 helper
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const result = computeBalanceDeduction(doc.data(), tojungCost()); // 2026-10-15 정가 9운, 얼리버드 7운
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, result.updates);
        });
        deductedAmount = tojungCost();
      }
    }

    try {
      const { generateTojungBigyeol } = await lazyClaudeTojung();
      // 2026-10-09 — 점진 표시: progressId 가 오면 그룹(총평·1~6월·7~12월) 완성마다 progress/{id} write (best-effort)
      const progressId = safeProgressId(request.data?.progressId);
      const { writeGroupProgress, setProgressMeta } = await import('./shared/progressWrite');
      if (progressId && uid !== 'anonymous') await setProgressMeta(db, progressId, uid, { type: 'tojung', total: 3 });
      const result = await generateTojungBigyeol(
        ANTHROPIC_KEY.value(),
        sajuData,
        progressId && uid !== 'anonymous' ? (g, data) => writeGroupProgress(db, progressId, uid, g, data) : undefined,
      );
      const reportRef = db.collection('reports').doc();
      await setReportSafe(reportRef, {
        uid, type: 'tojung', content: result,
        aiModel: CLAUDE_MODEL.opus, // 2026-10-14 — 신년운세는 Opus 인데 이름표가 sonnet 이었다
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

    // 2026-05-28 — schema 통일. 객체면 reward bucket, 숫자면 통합 증액.
    await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(uid);
      const doc = await tx.get(userRef);
      const bal = doc.data()?.balance;
      if (typeof bal === 'object' && bal !== null) {
        tx.update(userRef, { 'balance.reward': admin.firestore.FieldValue.increment(1) });
      } else {
        tx.update(userRef, { balance: admin.firestore.FieldValue.increment(1) });
      }
    });

    await db.collection(`users/${uid}/shareLogs`).add({
      date: today, reward: 1, type: 'share',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, reward: 1, dailyRemaining: 3 - dailyLogs.size - 1 };
  }
);

/* 2026-10-14 — 웹 토스페이먼츠 승인 함수(confirmPayment) 제거. 웹 결제는 포트원(confirmPortonePayment). 이전 'toss' 결제 기록은 users/{uid}/payments 에 그대로 보존 */

/**
 * confirmPortonePayment — 포트원 V2 웹 실결제 검증·지급 (2026-07-02 선구현)
 *
 * 흐름: 클라 PortOne.requestPayment 완료 → paymentId 전달 → 서버가 포트원 조회 API로
 *   결제 사실·금액·상태를 직접 확인 후 지급. (클라 신고 금액은 참고용 — 진실은 포트원 API)
 *
 * 머니세이프: confirmPayment(E13)와 동일 상태머신 —
 *   pending → confirmed | failed | needs_reconciliation. confirmed 만 중복 차단.
 *
 * 추가 방어 (토스 대비 강화):
 *   ① uid 바인딩 — paymentId 접두사(uid 앞 8자) + customData.uid 이중 확인
 *      (남의 paymentId 를 자기 계정에 컨펌하는 공격 차단)
 *   ② LIVE 채널 게이트 — channel.type !== 'LIVE' 면 지급 거부
 *      (테스트 결제로 실제 운을 적립하는 사고 원천 차단 · 심사용 결제창과 공존 안전)
 *
 * 활성화: PG 계약 승인 후 PORTONE_V2_API_SECRET 실키 교체 + 클라 VITE_PORTONE_LIVE=1.
 *   그 전엔 시크릿이 PENDING 이라 호출돼도 포트원 인증 실패 → failed (지급 불가) — 무해.
 */
export const confirmPortonePayment = onCall(
  { secrets: [PORTONE_V2_API_SECRET], timeoutSeconds: 15, memory: '256MiB', cors: true },
  async (request) => {
    const { paymentId, amount } = request.data;
    if (!paymentId || typeof paymentId !== 'string' || !amount) {
      throw new HttpsError('invalid-argument', '필수 파라미터 누락');
    }

    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인 필요');

    // 방어 ① — paymentId 는 클라가 `${uid8}_...` 로 생성. 다른 계정 결제 컨펌 시도 차단.
    if (!paymentId.startsWith(uid.slice(0, 8))) {
      throw new HttpsError('permission-denied', '본인 결제만 확인할 수 있어요');
    }

    // 1. E13 · 중복 지급 방지 — confirmed/needs_reconciliation 차단, pending/failed 재시도 허용
    const paymentRef = db.collection(`users/${uid}/payments`).doc(paymentId);
    const existing = await paymentRef.get();
    if (existing.exists) {
      const s = existing.data()?.status;
      if (s === 'confirmed') {
        return { success: true, message: '이미 처리된 결제예요' };
      }
      if (s === 'needs_reconciliation') {
        throw new HttpsError('failed-precondition', '결제가 승인됐지만 지급이 완료되지 않았어요. 고객센터로 문의해주세요.');
      }
    }

    // 2. 금액 → 패키지 사전 검증 (최종 검증은 포트원 API 응답 금액으로 재수행)
    const pkg = PACKAGE_MAP[amount];
    if (!pkg) throw new HttpsError('invalid-argument', `유효하지 않은 금액: ${amount}`);

    // 3. E13 · pending 선기록
    await paymentRef.set({
      type: 'charge', orderId: paymentId, amount,
      packageName: pkg.name,
      paidUn: pkg.paidUn, bonusUn: pkg.bonusUn,
      pgProvider: 'portone',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 4. 포트원 V2 결제 조회 API — 결제 사실·상태·금액을 서버가 직접 확인
    const apiSecret = PORTONE_V2_API_SECRET.value();
    let pay: any;
    try {
      const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
        method: 'GET',
        headers: { Authorization: `PortOne ${apiSecret}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error('[confirmPortonePayment] 포트원 조회 실패:', res.status, errBody);
        await paymentRef.update({
          status: 'failed',
          failReason: (errBody as any)?.message || `portone_http_${res.status}`,
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        throw new HttpsError('internal', '결제 확인에 실패했어요. 다시 시도해주세요.');
      }
      pay = await res.json();
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      console.error('[confirmPortonePayment] 네트워크 에러:', err);
      await paymentRef.update({
        status: 'failed',
        failReason: 'network_error: ' + (err.message || 'unknown'),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new HttpsError('internal', '결제 확인 중 네트워크 오류가 발생했어요.');
    }

    // 5. 결제 검증 — 상태 PAID + 금액 일치 + uid 바인딩(customData) + LIVE 채널
    const failVerify = async (reason: string, userMsg: string) => {
      console.error('[confirmPortonePayment] 검증 실패:', reason, { paymentId, uid });
      await paymentRef.update({
        status: 'failed', failReason: reason,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new HttpsError('failed-precondition', userMsg);
    };

    if (pay?.status !== 'PAID') {
      await failVerify(`status_${pay?.status || 'unknown'}`, '결제가 완료되지 않았어요. 다시 시도해주세요.');
    }
    const apiAmount = pay?.amount?.total;
    if (apiAmount !== amount || !PACKAGE_MAP[apiAmount]) {
      await failVerify(`amount_mismatch_${apiAmount}_vs_${amount}`, '결제 금액이 일치하지 않아요. 고객센터로 문의해주세요.');
    }
    if (pay?.currency && pay.currency !== 'KRW') {
      await failVerify(`currency_${pay.currency}`, '지원하지 않는 통화예요.');
    }
    // 방어 ① 이중 확인 — 클라가 customData 에 넣은 uid 와 호출자 일치
    try {
      const cd = typeof pay?.customData === 'string' ? JSON.parse(pay.customData) : pay?.customData;
      if (cd?.uid && cd.uid !== uid) {
        await failVerify('customdata_uid_mismatch', '본인 결제만 확인할 수 있어요.');
      }
    } catch { /* customData 파싱 실패는 무시 (prefix 검증이 1차 방어) */ }
    // 방어 ② — 테스트 채널 결제는 절대 지급하지 않음
    if (pay?.channel?.type !== 'LIVE') {
      await failVerify(`channel_${pay?.channel?.type || 'unknown'}`, '테스트 결제는 충전되지 않아요.');
    }

    // 6. Firestore 트랜잭션 — 잔액 지급 + pending → confirmed (confirmPayment 동일)
    const totalUn = pkg.paidUn + pkg.bonusUn;
    try {
      await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await tx.get(userRef);
        const data = userDoc.data() || {};

        // 2026-10-16 — update() 는 users/{uid} 문서가 없는 계정(웹 익명)에서 NOT_FOUND → 돈은 나가고 운은 안 들어가
        //   needs_reconciliation 으로 빠진다(6월 IAP 19건과 같은 원인). grantPurchase 처럼 set(merge) 로 문서가 없어도 만든다.
        tx.set(userRef, {
          balance: {
            paid: (data.balance?.paid ?? 0) + pkg.paidUn,
            bonus: (data.balance?.bonus ?? 0) + pkg.bonusUn,
          },
          totalCharged: admin.firestore.FieldValue.increment(pkg.paidUn),
        }, { merge: true });

        tx.update(paymentRef, {
          unChange: totalUn,
          portoneStatus: pay.status,
          portoneMethod: pay?.method?.type || null,
          portoneChannel: pay?.channel?.type || null,
          status: 'confirmed',
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    } catch (err: any) {
      // E13 · 포트원은 PAID 인데 DB 실패 — 수동 복구 대상
      console.error('[confirmPortonePayment] needs_reconciliation:', err);
      await paymentRef.update({
        status: 'needs_reconciliation',
        failReason: 'db_transaction_failed: ' + (err.message || 'unknown'),
        portoneStatus: pay.status,
        portoneApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new HttpsError('internal', '결제는 승인됐지만 지급 중 오류가 발생했어요. 고객센터에 문의해주세요.');
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

    /* 🚨 2026-07-29 — GET 방식 지원 추가. 공식 문서는 콜백을 **GET·POST 둘 다** 규정하는데
     *   (GET: `$callback_url?userKey=$userKey&referrer=$referrer`), 구 코드는 POST 외 전부 405 로
     *   반려해 콘솔이 GET 으로 설정돼 있으면 콜백이 100% 실패했다. body → query 폴백을 둔다. */
    if (req.method !== 'POST' && req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      const src: any = req.method === 'GET' ? req.query : (req.body ?? {});
      const userKey = src?.userKey ?? (req.query as any)?.userKey;
      const referrer = String(src?.referrer ?? (req.query as any)?.referrer ?? 'UNLINK');
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

        /* 🚨 2026-07-29 referrer 3종 분기 (구 코드는 전부 동일 처리 = 과처리).
         *   정본: "UNLINK(토스 설정→연결 끊기) → 미니앱은 **로그아웃 처리**해야 함" /
         *         WITHDRAWAL_TERMS(약관 철회) · WITHDRAWAL_TOSS(토스 회원 탈퇴) = 탈퇴 의사.
         *   구 코드는 UNLINK 에도 Auth disabled + 5일 삭제 예약을 걸어, **유료 리포트를 보유한 유저가
         *   연결만 끊었다가 계정이 잠기고 데이터가 삭제 예약**되는 과처리였다.
         *   → UNLINK 는 토스 연동만 해제(재연결 가능·구매 데이터 보존), 탈퇴 2종만 비활성화+파기 예약. */
        const isWithdrawal = referrer === 'WITHDRAWAL_TERMS' || referrer === 'WITHDRAWAL_TOSS';

        await userDoc.ref.update({
          status: 'disconnected',
          disconnectReferrer: referrer,
          disconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
          // 토스 연동 해제 — 재로그인 시 새로 매칭되도록 키를 비운다 (UNLINK·탈퇴 공통)
          tossUserKey: admin.firestore.FieldValue.delete(),
          ...(isWithdrawal
            // 탈퇴: 5일 후 파기 예약 (개인정보보호법)
            //   파기는 purgeWithdrawnUsers(매일 04:20 KST)가 한다 (2026-10-14)
            ? { deleteScheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }
            : {}),
        });

        if (isWithdrawal) {
          // Firebase Auth 계정 비활성화 — 탈퇴 의사가 있을 때만
          try {
            await admin.auth().updateUser(uid, { disabled: true });
          } catch {
            console.warn(`[disconnectToss] Auth 비활성화 실패: ${uid}`);
          }
        }

        console.log(`[disconnectToss] 처리 완료: ${uid} (${referrer}, ${isWithdrawal ? '탈퇴=비활성화+파기예약' : '연결해제=계정유지'})`);
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
    await guardCallable(request, 'topic'); // 익명 하루 상한 (genGuard)
    const { topicId, sajuData, baseScore, partnerInfo, extraInfo } = request.data;
    if (!topicId || !sajuData) throw new HttpsError('invalid-argument', 'topicId, sajuData 필요');

    const uid = request.auth?.uid || 'anonymous';
    let deductedAmount = 0;

    // 잔액 차감 — 실명 유저만 (익명 유저는 Firestore 문서 없음)
    if (!DEV_MODE && request.auth && !request.auth.token?.firebase?.sign_in_provider?.includes('anonymous')) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const cost = topicCost(topicId);
        // 2026-05-28 — schema 통일 helper
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const result = computeBalanceDeduction(doc.data(), cost);
          if (!result) throw new HttpsError('failed-precondition', '운이 부족합니다');
          tx.update(userRef, result.updates);
        });
        deductedAmount = cost;
      }
    }

    try {
      const { generateTopicAnalysisAI } = await lazyClaudeTopic();
      const result = await generateTopicAnalysisAI(ANTHROPIC_KEY.value(), topicId, sajuData, baseScore, partnerInfo, extraInfo);

      const reportRef = db.collection('reports').doc();
      try { // 2026-10-14 — 사본 저장 실패가 생성 실패와 환불이 되지 않게 (스트림 경로와 같게)
        await reportRef.set({
          uid, topicId, ...fsSafe(result), type: 'topic',
          // 2026-06-12 — 소분류 분포용 입력 메타 (loveStatus/bizStatus 등 + 상대방 유무)
          inputMeta: { hasPartner: !!partnerInfo, ...(extraInfo && typeof extraInfo === 'object' ? extraInfo : {}) },
          aiModel: CLAUDE_MODEL.sonnet,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (fsErr: any) {
        console.warn(`[topic:${topicId}] Firestore 저장 실패:`, fsErr?.message);
      }

      return { reportId: reportRef.id, content: result };
    } catch (error: any) {
      console.error('generateTopicAnalysis error:', error);
      await refundBalance(uid, deductedAmount, 'generateTopicAnalysis failed');
      throw new HttpsError('internal', `분석 실패: ${error.message || 'unknown'}`);
    }
  }
);

/* ══════════════════════════════════════════════════════════════════
 * generateTopicAnalysisStream — SSE 스트리밍 (오늘의 운세 패턴 적용)
 *
 * callable generateTopicAnalysis 와 프롬프트·모델·출력 100% 동일.
 * 차이는 전송 방식만: await → messages.stream() → chunk 이벤트 점진 송출.
 * 클라가 partial-json 으로 점진 렌더 → 첫 글자 ~5-10s, 내용 차오름 (저퀄·깨짐 0).
 * 잔액 차감/환불/Firestore 저장은 callable 과 동일 로직.
 * 2차 자기리뷰는 stream 경로 미적용 (TOPIC_SELF_REVIEW 기본 OFF 정책 일치).
 * ═════════════════════════════════════════════════════════════════ */
export const generateTopicAnalysisStream = onRequest(
  {
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    minInstances: 0, // 2026-06-15→2026-09-03 비용 fix: 1→0. 상시대기 5함수(스트리밍) 월 ~₩9~10만원 → 제거. cold start 는 로딩 UX 로 흡수.
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();
    const sendEvent = (event: string, data: any) => {
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
      } catch { /* anonymous */ }
    }

    const { topicId, sajuData, baseScore, partnerInfo, extraInfo } = req.body || {};
    if (!topicId || !sajuData) {
      sendEvent('error', { message: 'topicId, sajuData 필요' });
      res.end();
      return;
    }
    if (!(await guardHttp(req, uid === 'anonymous' ? null : uid, isAnonymous, 'topic'))) {
      sendEvent('error', { message: GEN_LIMIT_MESSAGE }); res.end(); return;
    }

    // 잔액 차감 (1운) — callable 과 동일 (실명 유저만)
    let deductedAmount = 0;
    if (!DEV_MODE && uid !== 'anonymous' && !isAnonymous) {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        try {
          // 2026-05-28 — schema 통일 helper
          const cost = topicCost(topicId);
          await db.runTransaction(async (tx) => {
            const doc = await tx.get(userRef);
            const result = computeBalanceDeduction(doc.data(), cost);
            if (!result) throw new Error('운이 부족합니다');
            tx.update(userRef, result.updates);
          });
          deductedAmount = cost;
        } catch (e: any) {
          sendEvent('error', { message: e.message || '잔액 차감 실패' });
          res.end();
          return;
        }
      }
    }

    sendEvent('start', { ts: Date.now() });

    try {
      const { buildTopicCall, enforceTopicBaseScore, runTopicGeneration } = await lazyClaudeTopic();
      const call = buildTopicCall(topicId, sajuData, baseScore, partnerInfo, extraInfo);
      // 2026-10-09 — 상황별 섹션 제목을 먼저 보냄 → 앱 로딩 스켈레톤이 서버와 같은 제목 (구버전 앱은 무시)
      sendEvent('outline', { headings: call.sections });
      const anthropic = createClaude(ANTHROPIC_KEY.value());
      const t0 = Date.now();
      // 2026-10-08 — 생성은 claudeTopic.runTopicGeneration 공용 (callable 폴백과 같은 코드 · 시스템 프롬프트 캐시).
      //   재회운은 본문(아래 chunk 로 실시간)과 카드 데이터(병렬)를 나눠 생성 → 클라 계약(start·chunk·retry·done) 그대로.
      //   파싱 실패 재생성·사주 산출 점수 강제는 기존과 동일.
      let parsed: any = await runTopicGeneration(anthropic, call, 'stream', {
        onDelta: (delta, totalChars, chunkIdx) => sendEvent('chunk', { delta, totalChars, chunkIdx }),
        onRetry: (reason) => {
          console.warn(`[topicStream:${topicId}] 1차 파싱 실패 → 재시도`);
          sendEvent('retry', { reason });
        },
      });
      // 사주 산출 점수 강제 (callable 과 동일 · 종합사주 추천 카드 점수와 일치 보장)
      parsed = enforceTopicBaseScore(parsed, call.effectiveBaseScore, partnerInfo?.name);

      // Firestore 저장 (callable 과 동일 구조)
      const reportRef = db.collection('reports').doc();
      try {
        await reportRef.set({
          uid, topicId, ...fsSafe(parsed), type: 'topic',
          inputMeta: { hasPartner: !!partnerInfo, ...(extraInfo && typeof extraInfo === 'object' ? extraInfo : {}) },
          aiModel: CLAUDE_MODEL.sonnet,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (fsErr: any) {
        console.warn(`[topicStream:${topicId}] Firestore 저장 실패:`, fsErr?.message);
      }

      console.log(`[topicStream:${topicId}] done in ${Date.now() - t0}ms`);
      sendEvent('done', { reportId: reportRef.id, content: await cleanAiOut(parsed), elapsedMs: Date.now() - t0 });
      res.end();
    } catch (error: any) {
      console.error('generateTopicAnalysisStream error:', error);
      if (deductedAmount > 0) {
        await refundBalance(uid, deductedAmount, 'generateTopicAnalysisStream failed');
      }
      sendEvent('error', { message: error?.message || '분석 실패' });
      res.end();
    }
  }
);

/* ─── 이벤트 탭 v4.1 (2026-04-21) ───
 * 근거: 사주500_UI개편_09_이벤트_v4.md + appintos_PC핸드오버_이벤트v4_GO_v1.md
 * STUB 모드: APPINTOS_MTLS_CERT/KEY 미주입 시 자동 stub. 심사 후 Secrets 주입으로 LIVE 전환.
 */
export { markAttendance } from './attendance/markAttendance';
export { onInviteReceived } from './invite/onInviteReceived';

/* ─── 웹 단독 출시 — 회원탈퇴 (2026-06-03) ───
 * 근거: docs/법적요건_웹출시.md §4 (개인정보보호법 제21조·제36조).
 * Firestore 유저 개인정보 삭제 + Auth 계정 삭제. payments 는 전자상거래법 5년 보존.
 */
export { deleteAccount } from './auth/deleteAccount';
export { purgeWithdrawnUsers } from './auth/purgeWithdrawn'; // 2026-10-14 토스 탈퇴 5일 뒤 개인정보 파기 (payments 보존)
export { syncPortoneCancellations } from './payment/portoneCancelSync'; // 2026-10-16 포트원에서 취소된 웹 결제 → 결제 기록 refunded + 운 회수 지시(balanceAdjustments)
export { renderTtiToday } from './seo/ttiTodayPage'; // 2026-10-17 오늘의 띠별 운세 공개 검색 페이지 /unse/today/ (시험 E9)
export { ensureTtiFortune } from './tti/ttiFortune'; // 2026-10-15 띠별 오늘의 운세 (하루 한 번 미리 생성, 화면은 읽기만)

// CS 보상 운 지급 (디바이스ID 장부 · 2026-06-11) — 운영: Firebase Console compensations/{deviceId}
export { claimCompensation } from './admin/claimCompensation';
export { recoverTopicResult } from './topic/recoverTopicResult';
export { recoverPremiumResult } from './premium/recoverPremiumResult';
// 2026-08-07 — IAP 주문 이력 기반 잔액 복구 (기기 초기화로 운이 사라진 CS 대응)
export { recoverIapOrders } from './payment/recoverIapOrders';
export { registerDevicePassport } from './storage/devicePassport';
export { auditOrphanAccounts } from './storage/orphanAudit'; // 2026-10-04 매일 갈라진 계정 점검·빠진 기록 보충
export { restoreLibrary } from './storage/restoreLibrary';
// 어드민 CS 지급 (2026-06-12) — /admin 'CS 지급' 탭에서 디바이스 ID 로 즉시 장부 기록 (오너 전용)
export { adminGrantCompensation } from './admin/adminGrantCompensation';
// 유입/구매 폭증 서버 집계 (2026-06-27) — onRequest+secret(INFLOW_KEY). source·plat·시간대·구매 분해 JSON.
export { adminInflowReport } from './admin/inflowReport';
export { adminAiUsageReport } from './admin/aiUsageReport';

/* ─── LIVE BEST 실시간 집계 (2026-06-02 · D3 정식 구현) ─── */
export { recordTopicView, aggregateTopicTop5 } from './livebest/topicViews';

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
    secrets: [MAIL_APP_PASSWORD], // 2026-10-17 PDF 메일 (시크릿 v5). 이 시크릿을 지우면 모든 함수 배포가 실패하니 지우지 말 것
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
