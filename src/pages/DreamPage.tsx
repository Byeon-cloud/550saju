import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { AdSlot } from '@/components/ads/AdSlot';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { LockedCard } from '@/components/common/LockedCard';
import { ErrorState } from '@/components/common/ErrorState';
import { TimelineSwipe, type TimelineStep } from '@/components/common/TimelineSwipe';
import { SymbolDragMap, type SymbolItem } from '@/components/common/SymbolDragMap';
// Flippable 제거 (2026-04-22): LuckyColor/StatCard 정적화 — DailyFortunePage 와 통일.
import { TopicCTAGrid, type TopicItem } from '@/components/common/TopicCTAGrid';
// Phase D'-3 Bundle 2 (#54) — mockup 진본 시각 정렬 (FreeUpsellCard 단일 CTA)
import { FreeUpsellCard } from './free/_chrome';
import { SajuMiniCard, type PillarData } from '@/components/saju/SajuMiniCard';
import { OhengCompareBar } from '@/components/saju/OhengCompareBar';
import {
  Pictogram,
  type DreamCategory,
  type PictogramKey,
  type TopicKey,
} from '@/components/brand/PictogramRegistry';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import { useToast } from '@/components/common/Toast';
import {
  spendBalance,
  getBalance,
  getProfiles,
  getReport,
  saveReport,
  generateId,
  markPendingSpend,
  clearPendingSpend,
  type SajuProfile,
} from '@/services/storage/localStore';
import {
  generateDreamFree,
  // generateDreamDeepV3 — 2026-05-27 블러잠금 SSOT 정석화로 사용 제거 (AI 재호출 0). legacy import 보존.
  generateDreamDeepV3 as _generateDreamDeepV3,
} from '@/services/ai/reportGenerator';
import { stripMd } from '@/utils/format';
import { TOPIC_REGISTRY } from '@/constants/topics';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import type { OhengType } from '@/types/saju';
// v5 mockup (잠금 5섹션 + 아코디언 + 도식화 + 블러잠금 SSOT) — 2026-05-27 복원
import { DreamMockupView } from './dream/DreamMockupView';

/**
 * AI V3 schema → DreamMockupView v5 schema 어댑터 (2026-05-27).
 *   V3 prompt 가 출력하는 narrative / sajuTone / todayConnection / verdict / symbols[].meaningWithSaju
 *   를 v5 mockup 이 읽는 firstImpression / worryConnection / quoteInterpretations / dreamQuote /
 *   symbols[].meaning 로 매핑. lockedXxx 는 양쪽 schema 가 동일하라 그대로 사용.
 */
function adaptDreamResult(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const r: any = { ...raw };
  if (!r.firstImpression && typeof r.narrative === 'string' && r.narrative.length > 0) {
    r.firstImpression = { narrative: r.narrative, strongImages: r.keywords || [] };
  }
  if (!r.worryConnection && typeof r.todayConnection === 'string' && r.todayConnection.length > 0) {
    r.worryConnection = { narrative: r.todayConnection };
  }
  if (!r.dreamQuote && typeof r.verdict === 'string' && r.verdict.length > 0) {
    r.dreamQuote = r.verdict;
  }
  if (!Array.isArray(r.quoteInterpretations) && typeof r.sajuTone === 'string' && r.sajuTone.length > 50) {
    r.quoteInterpretations = [{
      quote: r.title || '꿈',
      highlight: '',
      tag: '사주 관점',
      interp: r.sajuTone,
    }];
  }
  if (Array.isArray(r.symbols)) {
    const ohengKanji: Record<string, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
    r.symbols = r.symbols.map((s: any) => ({
      ...s,
      meaning: s?.meaning || s?.meaningWithSaju || '',
      kanji: s?.kanji || (s?.oheng ? ohengKanji[s.oheng] : ''),
    }));
  }
  return r;
}

/**
 * 꿈해몽 v4 (2026-04-19)
 *   PRD: docs/prd/꿈해몽_v4_재설계.md + 디자인시스템_v4.md
 *   - 사주연동 12섹션 / 무연동 9섹션 분기
 *   - 블러잠금 4구간(L1~L4) — LockedCard 사용
 *   - P0 인터랙션: IX-1(SajuMiniCard 플립) · IX-2(SymbolDragMap)
 *                 · IX-3(TimelineSwipe) · IX-5(TopicCTAGrid)
 *   - Sonnet 4.6 v3 콜러블: generateDreamFree / generateDreamDeep
 *   - 데이터 흐름 유지: spendBalance / saveReport / 서버 dreamQuota
 */

/* ─── 카테고리 ─── */
const DREAM_CATEGORIES: Array<{
  id: DreamCategory;
  label: string;
  color: string;
  examples: string;
  hot?: boolean;
}> = [
  // 2026-05-04 SSOT 정렬 — 5오행 컬러 (목/화/토/금/수) + brand-gold 만 사용. 자유 hex 제거.
  // 木=#2D8A4E 火=#D32F2F 土=#E8B82A 金=#4A4A4A 水=#1565E0 brand-gold=#B8965A
  { id: 'animal', label: '동물이 나오는 꿈', color: '#2D8A4E', examples: '뱀, 개, 고양이, 돼지, 호랑이', hot: true },
  { id: 'water', label: '물과 관련된 꿈', color: '#1565C0', examples: '바다, 강, 비, 홍수, 수영', hot: true },
  { id: 'death', label: '죽음 · 이별의 꿈', color: '#4A4A4A', examples: '누군가 죽는 꿈, 장례식, 이별' },
  { id: 'flying', label: '하늘을 나는 꿈', color: '#1565C0', examples: '날기, 떨어지기, 높은 곳' },
  { id: 'money', label: '돈 · 재물의 꿈', color: '#B8965A', examples: '돈 줍기, 복권, 금, 보석', hot: true },
  { id: 'people', label: '사람이 나오는 꿈', color: '#D32F2F', examples: '가족, 연인, 낯선 사람, 유명인' },
  { id: 'chase', label: '쫓기는 꿈', color: '#D32F2F', examples: '쫓기기, 도망, 숨기, 위험' },
  { id: 'nature', label: '자연 · 날씨 꿈', color: '#F57F17', examples: '꽃, 산, 불, 지진, 눈' },
  { id: 'other', label: '직접 적을게요', color: '#7A7269', examples: '위 항목에 없는 꿈을 자유롭게' },
];

const OHENG_PICTOGRAM_KEY: Record<OhengType, PictogramKey> = {
  목: 'oheng:wood',
  화: 'oheng:fire',
  토: 'oheng:earth',
  금: 'oheng:metal',
  수: 'oheng:water',
};

/** v4 등급 팔레트 (디자인시스템_v4 §3.3 — A 초록·D 빨강 금지) */
const GRADE_V4: Record<string, string> = {
  S: '#B8965A',
  A: '#8C6D3D',
  B: '#2D4470',
  C: '#8F6B4E',
  D: '#8F1F1C',
};

type Phase = 'category' | 'detail' | 'result' | 'deepLoading' | 'deepResult';

export function DreamPage() {
  usePageTitle('꿈해몽');
  useSeoMeta({
    description: '꿈의 의미를 명리학으로 무료로 풀이해드려요. 길몽·흉몽 해석부터 오늘의 조언까지, 사주500 꿈해몽.',
  });
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { mark } = useAttendanceOnResult();
  // 2026-05-28 — 보관함에서 진입 시 savedResult/savedReport 받아 result phase 즉시 복원.
  //   state 는 React Router strict mode 등에서 끊길 수 있어 ?reportId URL 폴백도 지원.
  const stateNav = location.state as { savedResult?: any; savedReport?: any } | undefined;
  const reportIdFromUrl = searchParams.get('reportId');
  // URL reportId 있으면 localStorage 에서 보고서 직접 로드 (state 손실 대비 폴백)
  const reportFromUrl = useMemo(() => {
    if (!reportIdFromUrl) return null;
    try { return getReport(reportIdFromUrl); } catch { return null; }
  }, [reportIdFromUrl]);
  const navState = stateNav?.savedReport
    ? stateNav
    : (reportFromUrl ? { savedResult: reportFromUrl.aiResult, savedReport: reportFromUrl } : undefined);
  const [phase, setPhase] = useState<Phase>(navState?.savedReport ? 'result' : 'category');
  // 2026-05-29 — 출시 프로모션 10원: 무료 꿈해몽 결과 도달도 첫 콘텐츠 인정 (코드 단위 dedupe · 앱인토스 only).
  useEffect(() => {
    if (phase === 'result' || phase === 'deepResult') {
      import('@/services/toss/tossPromotion').then(m => m.grantLaunchPromotion());
      // 2026-06-02 — 출석 적립 + 일일/연속 보상 자동 지급 (콘텐츠 이용 시, 클라 잔액 적립)
      import('@/services/storage/dailyReward').then(m => m.processAttendanceRewards());
      // LIVE BEST 조회 기록 (24h 디듀프)
      import('@/services/liveBest').then(m => m.recordTopicView('dream')).catch(() => {});
    }
  }, [phase]);
  // 보관함 복원 시 user input 도 함께 (aiResult.__userInput) 복원
  const _restoredInput = navState?.savedReport?.aiResult?.__userInput as { dreamText?: string; concern?: string; category?: string } | undefined;
  // category 라벨 → id 역추적 (예: "물과 관련된 꿈" → "water")
  const _restoredCategoryId = _restoredInput?.category
    ? (DREAM_CATEGORIES.find((c) => c.label === _restoredInput.category)?.id ?? null)
    : null;
  const [selectedCategory, setSelectedCategory] = useState<DreamCategory | null>(_restoredCategoryId);
  const [dreamText, setDreamText] = useState(_restoredInput?.dreamText ?? '');
  const [concern, setConcern] = useState(_restoredInput?.concern ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiResult, setAiResult] = useState<any>(navState?.savedResult ?? null);
  // 보관함 진입 시: type='paid' OR aiResult.__unlocked 면 잠금 해제 상태로 복원
  const [unlocked, setUnlocked] = useState(() => {
    const r = navState?.savedReport;
    if (!r) return false;
    return r.type === 'paid' || !!(r.aiResult?.__unlocked);
  }); // 블러잠금 해제 state (AI 재호출 0)
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false); // 1운 차감 확인 모달
  const [unlockBurst, setUnlockBurst] = useState(false); // 잠금 해제 시각 효과 (사라랄)
  const [apiError, setApiError] = useState('');
  const isAnalyzingRef = useRef(false);
  const isDeepAnalyzingRef = useRef(false);
  // 보관함 진입 시 기존 rid 를 보관 (1운 결제 시 동일 레코드 갱신)
  const currentReportIdRef = useRef<string | null>(navState?.savedReport?.id ?? null);

  const profile: SajuProfile | null = useMemo(
    () => getProfiles().find((p) => !p.relation || p.relation === '본인') || null,
    [],
  );
  const hasSaju = !!profile?.sajuData?.pillars?.length;

  function selectCategory(id: DreamCategory) {
    setSelectedCategory(id);
    setTimeout(() => setPhase('detail'), 300);
  }

  /* ─── 무료 해몽 (generateDreamFree · Sonnet 4.6 v3) ─── */
  async function analyze() {
    if (isAnalyzingRef.current || isLoading) return;
    isAnalyzingRef.current = true;
    setIsLoading(true);
    setIsStreaming(true);
    setApiError('');
    // 2026-05-27 v10 — aiResult 를 빈 객체로 미리 초기화 → DreamMockupView 가 isLoading=false 즉시
    //   렌더 가능 (skeleton 시각). 이전엔 aiResult=null 이면 null && DreamMockupView = 미렌더.
    setAiResult({});
    setPhase('result');

    try {
      const categoryLabel = DREAM_CATEGORIES.find((c) => c.id === selectedCategory)?.label || '기타';
      const fullText = [dreamText, concern ? `\n현재 고민: ${concern}` : ''].filter(Boolean).join('');
      const saju = profile?.sajuData ? buildSajuContext(profile) : undefined;

      // 2026-05-27 — SSE 스트리밍 (오늘의 운세 패턴): partial 도달 시 isLoading=false → 결과 페이지 즉시 노출.
      //   HEAD 디자인 그대로 (result.narrative/symbols/lockedXxx 직접 읽기). 단지 전송 방식만 SSE.
      //   substantive content (narrative ≥100자) 도착 시 로딩 → 결과 전이.
      //   SSE 실패 시 callable 폴백 (프롬프트·모델 100% 동일).
      let result: any;
      try {
        const { generateDreamFreeStream } = await import('@/services/ai/reportGenerator');
        let firstPaintDone = false;
        let latestPartial: any = null; // 2026-06-02 — 타임아웃 시 저장용 최신 partial
        const t0 = Date.now();
        result = await new Promise<any>((resolve, reject) => {
          // 2026-06-02 fix — 기존: 타임아웃이 setIsLoading(false) 만 하고 Promise 를 끝내지 않아,
          //   iOS 백그라운드 등으로 SSE 가 죽으면 await 영구 hang → setAiResult/saveReport 미실행
          //   → 스켈레톤 무한 + 보관함 저장 0. 수정: 받은 partial 있으면 resolve(저장 진입), 없으면 reject(→ callable 폴백).
          const safetyId = setTimeout(() => {
            if (!firstPaintDone) { firstPaintDone = true; setIsLoading(false); }
            if (latestPartial && latestPartial.title) resolve(latestPartial);
            else reject(new Error('dream stream timeout'));
          }, 60_000);
          generateDreamFreeStream(
            { saju, dreamContent: fullText, category: categoryLabel, userConcern: concern || undefined },
            {
              onStart: () => console.log('[dream SSE] start'),
              onPartial: ({ partial, totalChars }) => {
                try {
                  if (!partial || typeof partial !== 'object') return;
                  setAiResult({ ...partial });
                  latestPartial = partial; // 타임아웃 시 저장용 보존
                  // 2026-05-27 v10 — 첫 paint 매우 공격적:
                  //   narrative 50자 OR title+verdict 둘 다 도착 OR 10초 timeout.
                  //   결과창 진입 후 skeleton 으로 미도착 섹션 채워줌.
                  const narLen = typeof partial.narrative === 'string' ? partial.narrative.length : 0;
                  const verdictLen = typeof partial.verdict === 'string' ? partial.verdict.length : 0;
                  const hasTitle = typeof partial.title === 'string' && partial.title.length > 5;
                  const elapsed = Date.now() - t0;
                  const ready = narLen >= 50 || (hasTitle && verdictLen >= 30) || elapsed >= 10_000;
                  if (!firstPaintDone && ready) {
                    firstPaintDone = true;
                    clearTimeout(safetyId);
                    console.log(`[dream] 첫 paint (${elapsed}ms, ${totalChars}자, narLen=${narLen}, title=${hasTitle})`);
                    setIsLoading(false);
                  }
                } catch (err) { console.warn('[dream onPartial guard]', err); }
              },
              onGroup: ({ group, data, elapsedMs }) => {
                // 그룹 완전 도착 — 머지된 데이터로 즉시 갱신 (partial 보다 정확)
                console.log(`[dream] Group ${group} 완료 (${elapsedMs}ms)`);
                if (!firstPaintDone && group === 'A') {
                  firstPaintDone = true;
                  clearTimeout(safetyId);
                  console.log(`[dream] 첫 paint (Group A done · ${Date.now() - t0}ms)`);
                  setIsLoading(false);
                }
                // 그룹 완료 데이터로 갱신 (partial-json 보다 정확한 fully-parsed JSON)
                setAiResult((prev: any) => ({ ...(prev || {}), ...(data || {}) }));
                latestPartial = { ...(latestPartial || {}), ...(data || {}) };
              },
              onDone: ({ content }) => {
                clearTimeout(safetyId);
                console.log(`[dream SSE] done (${Date.now() - t0}ms)`);
                resolve(content);
              },
              onError: (msg, code) => {
                clearTimeout(safetyId);
                reject(Object.assign(new Error(msg), { code }));
              },
            },
          ).catch((e) => { clearTimeout(safetyId); reject(e); });
        });
      } catch (streamErr: any) {
        if (streamErr?.code === 'quota' || String(streamErr?.message).includes('쿼터')) {
          throw streamErr;
        }
        console.warn('[dream] SSE 실패 → callable 폴백:', streamErr?.message);
        result = await generateDreamFree({
          saju, dreamContent: fullText, category: categoryLabel, userConcern: concern || undefined,
        });
      }

      // 필수 필드 검증 — fallback 렌더 금지 (PRD §10.7)
      if (!result || typeof result !== 'object' || !result.title) {
        throw new Error('응답 데이터 형식이 올바르지 않아요');
      }

      setAiResult(result);

      // 이벤트 v4 · 출석 마커 (KST 당일 1회)
      mark().catch(() => {/* non-blocking */});

      // 보관함 저장 (무료) — 잠금 해제 시 같은 레코드를 갱신하도록 id 보관
      try {
        const rid = generateId();
        currentReportIdRef.current = rid;
        // 2026-05-28 — user input (꿈주제·꿈내용·고민) 도 함께 저장 → 보관함 재진입 시 입력 echo 복원
        const categoryLabelForSave = DREAM_CATEGORIES.find((c) => c.id === selectedCategory)?.label || '기타';
        saveReport({
          id: rid,
          name: profile?.name || '꿈해몽',
          input: (profile?.input ?? {}) as any,
          sajuData: (profile?.sajuData ?? {}) as any,
          type: 'free',
          contentType: 'dream',
          createdAt: new Date().toISOString(),
          aiResult: { ...result, __userInput: { dreamText, concern, category: categoryLabelForSave } },
        });
      } catch {
        /* 보관함 실패는 무시 */
      }
    } catch (e: any) {
      console.error('[DreamPage:free] API 실패:', e);
      // 쿼터 소진 전용 메시지
      if (e?.code === 'resource-exhausted' || String(e?.message).includes('쿼터')) {
        setApiError('이번 달 꿈해몽 무료 쿼터가 소진됐어요. 다음 달에 다시 만나요.');
      } else {
        // 2026-05-29 — e.message(영문 기술오류) 노출 금지. 항상 친절 카피.
        setApiError('꿈을 살피는 데 잠시 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
      }
      setAiResult(null);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setPhase('result');
      isAnalyzingRef.current = false;
    }
  }

  /* ─── 잠금 해제 (블러잠금 SSOT — AI 재호출 0, 페이지 전환 0) ───
   *   CLAUDE.md 정책: "spendBalance(1) → setUnlocked(true). AI 재호출/페이지전환 제거"
   *   2026-05-27 v11: 확인 모달 + 잠금 해제 애니메이션 (사라랄 효과) 추가. */
  async function startDeepAnalysis() {
    if (isDeepAnalyzingRef.current || unlocked) return;
    if (!profile?.sajuData) {
      toast.show('먼저 사주를 분석해주세요', 'warning');
      navigate('/input');
      return;
    }
    if (!aiResult) {
      toast.show('무료 해석을 먼저 진행해주세요', 'warning');
      return;
    }
    // 잔액 사전 체크 — 부족하면 충전 페이지로
    const currentBalance = getBalance();
    if (currentBalance < 1) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '심층 해몽에 1운이 필요해요' } });
      return;
    }
    // 확인 모달 (앱인토스 정책: window.confirm 금지 → 커스텀 modal state)
    setShowUnlockConfirm(true);
  }

  /** 확인 모달 OK 시 실제 차감 + 잠금 해제 */
  async function confirmDeepUnlock() {
    setShowUnlockConfirm(false);
    if (isDeepAnalyzingRef.current || unlocked) return;
    if (!profile?.sajuData || !aiResult) return;
    isDeepAnalyzingRef.current = true;
    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '심층 해몽에 1운이 필요해요' } });
      isDeepAnalyzingRef.current = false;
      return;
    }
    // 측정 — 운 차감 성공 직후 (C1 · fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'dream', amount: 1 })).catch(() => {});
    // 2026-06-18 머니세이프 — 차감 후 보관함 저장 실패(용량초과 등) 시 부팅 reconcile 이 5분 후 자동환불.
    //   저장 성공 시 아래에서 clearPendingSpend 로 해제. (정상 경로는 동기 실행이라 즉시 해제됨)
    const dreamPendingId = markPendingSpend('dream', 1);
    // 잠금 해제 시각 효과 (사라랄) — body 에 일시 클래스 추가 → CSS 애니메이션
    setUnlockBurst(true);
    setTimeout(() => setUnlockBurst(false), 1500);
    toast.show('잠금이 풀렸어요 · 1운 차감', 'success');
    setUnlocked(true);
    // 보관함 동일 레코드 갱신 (__unlocked 플래그 + type='paid' 로 전환) — 재진입 시 잠금 해제 상태 유지
    try {
      const rid = currentReportIdRef.current;
      if (rid) {
        saveReport({
          id: rid,
          name: profile.name || '꿈해몽',
          input: profile.input,
          sajuData: profile.sajuData,
          type: 'paid',
          contentType: 'dream',
          aiResult: { ...aiResult, __unlocked: true, __userInput: aiResult?.__userInput || { dreamText, concern, category: DREAM_CATEGORIES.find((c) => c.id === selectedCategory)?.label || '기타' } },
          createdAt: new Date().toISOString(),
        });
        clearPendingSpend(dreamPendingId); // 잠금해제 영속 완료 → 자동환불 대상 제외
      }
    } catch { /* noop — 저장 실패 시 pending 유지 → 부팅 reconcile 자동환불 */ }
    isDeepAnalyzingRef.current = false;
  }

  // @ts-expect-error legacy — DeepResultView 와 함께 dead code (블러잠금 SSOT 후)
  function reset() {
    setPhase('category');
    setSelectedCategory(null);
    setDreamText('');
    setConcern('');
    setAiResult(null);
    setUnlocked(false);
    currentReportIdRef.current = null;
    setApiError('');
  }

  // 2026-05-27 — 사주 없으면 꿈해몽 진입 차단. AI 가 사주와 꿈을 교차 해석하는 게 핵심이라
  //   사주 없는 상태로 일반 꿈풀이만 보여주는 건 PD 정책 위배 (유료 결제 유도 unlocked 5섹션도 사주 기반).
  if (!hasSaju) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
        <Header title="꿈해몽" />
        <div className="px-5 pt-12 pb-[120px] mx-auto text-center" style={{ maxWidth: 520 }}>
          <div style={{
            display: 'inline-flex', width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(184,150,90,0.12)', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <span aria-hidden style={{
              fontFamily: "'Noto Serif KR', serif", fontSize: 36, fontWeight: 900,
              color: '#B8965A', lineHeight: 1,
            }}>夢</span>
          </div>
          <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>
            먼저 사주를 입력해주세요
          </h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#5C4A2E', marginBottom: 28, wordBreak: 'keep-all' }}>
            꿈해몽은 <strong style={{ color: '#1a1a1a' }}>사주와 꿈을 교차해 해석</strong>합니다.<br />
            일간·오행·대운이 있어야 깊이 있는 풀이가 가능해요.
          </p>
          <button
            type="button"
            onClick={() => navigate('/input?from=dream')}
            style={{
              background: '#B8965A', color: '#F8F5EE', border: 'none',
              borderRadius: 999, padding: '14px 28px', fontSize: 14, fontWeight: 800,
              cursor: 'pointer', minHeight: 44,
            }}
          >
            사주 입력하러 가기 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <Header title="꿈해몽" />
      <div className="px-5 pt-4 pb-[120px] mx-auto" style={{ maxWidth: 520 }}>
        <AnimatePresence mode="wait">
          {phase === 'category' && (
            <CategoryPhase
              key="category"
              selectedId={selectedCategory}
              onSelect={selectCategory}
            />
          )}

          {phase === 'detail' && (
            <DetailPhase
              key="detail"
              categoryId={selectedCategory}
              dreamText={dreamText}
              concern={concern}
              onDreamChange={setDreamText}
              onConcernChange={setConcern}
              onBack={() => setPhase('category')}
              onSubmit={analyze}
              submitting={isLoading}
            />
          )}

          {phase === 'result' && isLoading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AILoading
                name={profile?.name ?? '당신'}
                type="꿈해몽"
                sajuData={profile?.sajuData}
                steps={[
                  '꿈 속 상징을 추출하고 있어요',
                  '오행 관계를 분석하고 있어요',
                  hasSaju ? '사주 원국과 교차하고 있어요' : '심층 해석을 작성하고 있어요',
                ]}
              />
            </motion.div>
          )}

          {phase === 'result' && !isLoading && !aiResult && (
            <ErrorView key="error" apiError={apiError} onBack={() => setPhase('detail')} />
          )}

          {phase === 'result' && !isLoading && aiResult && (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <DreamMockupView
                result={adaptDreamResult(aiResult)}
                profile={profile}
                hasSaju={hasSaju}
                category={DREAM_CATEGORIES.find((c) => c.id === selectedCategory)?.label || '기타'}
                dreamText={dreamText}
                concern={concern}
                unlocked={unlocked}
                isStreaming={isStreaming}
                onUnlock={startDeepAnalysis}
                onShare={async () => {
                  // 2026-05-28 PM — 결과 페이지 공유 = OG 바이럴 (보상 X). shareResult 사용.
                  const { shareResult } = await import('@/utils/share');
                  await shareResult({
                    type: 'dream',
                    name: profile?.name || '나',
                    reportId: new Date().toISOString().slice(0, 10),
                  });
                }}
                onChat={async () => {
                  // 새 채팅방 생성 후 /chat/{id} 진입 — ChatSessionPage 가 contentContext 받음
                  // 2026-05-28 PM — contentContext 영구 저장 (보관함 재진입에도 복원)
                  const { createChatRoom } = await import('@/services/storage/chatStore');
                  const ctx = {
                    type: 'dream' as const,
                    label: '꿈해몽',
                    category: DREAM_CATEGORIES.find((c) => c.id === selectedCategory)?.label || '기타',
                    dreamText,
                    concern,
                    fullResult: aiResult,
                  };
                  const room = createChatRoom(profile?.name || '나', 'free', ctx);
                  navigate(`/chat/${room.id}`, {
                    state: {
                      profile,
                      contentContext: ctx,
                    },
                  });
                }}
              />
              {/* 2026-05-28 — 무료 꿈해몽 결과 하단 광고. 1운 결제로 unlock 시 자동 숨김. */}
              {!unlocked && (
                <div style={{ padding: '0 16px 24px' }}>
                  <AdSlot />
                </div>
              )}
            </motion.div>
          )}

          {/* 2026-05-27 — deepLoading/deepResult phase 제거 (블러잠금 SSOT).
              결제 = 같은 result phase 에서 unlocked=true 로 블러만 해제. 페이지 전환 0. */}
        </AnimatePresence>

        {/* 1운 차감 확인 모달 (앱인토스 정책: window.confirm 금지) */}
        {showUnlockConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(10, 12, 22, 0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px', animation: 'fadeIn .2s ease both',
            }}
            onClick={() => setShowUnlockConfirm(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 16, maxWidth: 380, width: '100%',
                padding: '24px 22px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                animation: 'modalPop .25s cubic-bezier(.34,1.56,.64,1) both',
              }}
            >
              <div style={{
                fontFamily: "'Noto Serif KR', serif", fontSize: 17, fontWeight: 700,
                color: '#1a1a1a', marginBottom: 8, letterSpacing: '-0.01em',
              }}>
                1운으로 잠금을 풀까요?
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#5C4A2E', marginBottom: 18, wordBreak: 'keep-all' }}>
                일간 연동·오행 흐름·꿈의 경고·예고 시기·실천 처방
                <strong style={{ color: '#1a1a1a' }}> 다섯 섹션</strong>이 즉시 열려요.<br />
                현재 잔액 <b style={{ color: '#B8965A' }}>{getBalance()}운</b> → 차감 후 <b>{getBalance() - 1}운</b>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowUnlockConfirm(false)}
                  style={{
                    flex: 1, height: 48, border: '1px solid #E5DFD0', background: '#fff',
                    borderRadius: 100, fontSize: 14, fontWeight: 700, color: '#5C4A2E', cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmDeepUnlock}
                  style={{
                    flex: 1.5, height: 48, border: 'none',
                    background: 'linear-gradient(135deg, #E8D9B8, #B8965A)',
                    color: '#1a1a1a', borderRadius: 100, fontSize: 14, fontWeight: 800,
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(184,150,90,0.35)',
                  }}
                >
                  1운으로 풀기
                </button>
              </div>
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes modalPop { from { transform: scale(.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
              `}} />
            </div>
          </div>
        )}

        {/* 잠금 해제 시각 효과 (사라랄) — 1.5초간 골드 burst overlay */}
        {unlockBurst && (
          <div
            aria-hidden
            style={{
              position: 'fixed', inset: 0, zIndex: 99, pointerEvents: 'none',
              background: 'radial-gradient(circle at center, rgba(232,217,184,0.25), transparent 70%)',
              animation: 'burstFlash 1.5s ease-out both',
            }}
          >
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes burstFlash {
                0% { opacity: 0; transform: scale(.8); }
                30% { opacity: 1; transform: scale(1.05); }
                100% { opacity: 0; transform: scale(1.2); }
              }
            `}} />
          </div>
        )}

        {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) */}
        <div className="mt-10 text-center space-y-1">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반
          </p>
          <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>
            사주는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Phase 1: 카테고리 선택
 * ═════════════════════════════════════════════════════════════════ */
function CategoryPhase({
  selectedId,
  onSelect,
}: {
  selectedId: DreamCategory | null;
  onSelect: (id: DreamCategory) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      <FadeIn>
        <div className="card-navy-v4" style={{ position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 128,
              height: 128,
              borderRadius: 64,
              opacity: 0.05,
              background: 'radial-gradient(circle, #B8965A, transparent 70%)',
            }}
          />
          <p className="sec-meta" style={{ color: 'rgba(245,239,224,0.5)' }}>꿈해몽</p>
          <h2 className="sec-title-lg" style={{ color: '#F5EFE0', marginTop: 6 }}>
            간밤에 어떤 꿈을<br />꾸셨나요?
          </h2>
          <p className="text-body-md" style={{ color: 'rgba(245,239,224,0.6)', marginTop: 8 }}>
            가장 가까운 항목을 선택하거나,<br />직접 적어주시면 해석해드릴게요.
          </p>
        </div>
      </FadeIn>
      <div className="space-y-2">
        {DREAM_CATEGORIES.map((cat, i) => {
          const active = selectedId === cat.id;
          return (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onSelect(cat.id)}
              className="card-primary w-full text-left"
              style={{
                border: active ? '2px solid var(--brand-gold)' : '0.5px solid var(--border-default)',
                padding: 16,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${cat.color}14` }}
                >
                  <Pictogram k={`dream:${cat.id}`} size={22} color={cat.color} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="sec-title" style={{ fontSize: 15 }}>{cat.label}</p>
                    {cat.hot && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: 3,
                          color: '#D32F2F',
                          background: 'rgba(211,47,47,0.1)',
                        }}
                      >
                        HOT
                      </span>
                    )}
                  </div>
                  <p className="sec-caption" style={{ marginTop: 2 }}>{cat.examples}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Phase 2: 상세 입력
 * ═════════════════════════════════════════════════════════════════ */
function DetailPhase({
  categoryId,
  dreamText,
  concern,
  onDreamChange,
  onConcernChange,
  onBack,
  onSubmit,
  submitting,
}: {
  categoryId: DreamCategory | null;
  dreamText: string;
  concern: string;
  onDreamChange: (v: string) => void;
  onConcernChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const cat = DREAM_CATEGORIES.find((c) => c.id === categoryId);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      <FadeIn>
        {cat && cat.id !== 'other' && (
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${cat.color}15` }}
            >
              <Pictogram k={`dream:${cat.id}`} size={18} color={cat.color} />
            </div>
            <span className="sec-meta" style={{ color: cat.color }}>{cat.label}</span>
            <button onClick={onBack} className="ml-auto sec-caption">변경</button>
          </div>
        )}
        <h2 className="sec-title-lg">꿈의 내용을<br />자유롭게 적어주세요</h2>
        <p className="text-body-md" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
          더 자세히 적을수록 정확한 해몽이 가능해요.<br />건너뛰고 바로 결과를 볼 수도 있어요.
        </p>
      </FadeIn>
      <div className="space-y-4">
        <div>
          <p className="sec-title" style={{ marginBottom: 10 }}>꿈 내용</p>
          <textarea
            value={dreamText}
            onChange={(e) => onDreamChange(e.target.value)}
            placeholder="예: 큰 뱀이 집 안으로 들어와 소파 위에 또아리를 틀고 있었는데 무섭지 않았어요..."
            maxLength={300}
            className="w-full text-body-md"
            style={{
              height: 128,
              padding: 16,
              borderRadius: 16,
              border: '1px solid var(--border-default)',
              background: '#FFFFFF',
              resize: 'none',
            }}
          />
          <p className="sec-caption" style={{ textAlign: 'right', marginTop: 4 }}>{dreamText.length}/300</p>
        </div>
        <div>
          <p className="sec-title" style={{ marginBottom: 6 }}>요즘 머릿속에서 떠나지 않는 게 있다면</p>
          <p className="text-body-sm" style={{ color: 'var(--text-muted)', marginBottom: 10 }}>
            걱정·고민·최근 겪은 사건을 적어주시면 꿈과 연결해 더 정확하게 해석해드려요.
          </p>
          <textarea
            value={concern}
            onChange={(e) => onConcernChange(e.target.value)}
            placeholder="예: 이직을 고민하고 있어요 / 연인과 다퉜어요 / 시험을 앞두고 있어요..."
            maxLength={200}
            className="w-full text-body-md"
            style={{
              height: 112,
              padding: 16,
              borderRadius: 16,
              border: '1px solid var(--border-default)',
              background: '#FFFFFF',
              resize: 'none',
            }}
          />
          <p className="sec-caption" style={{ textAlign: 'right', marginTop: 4 }}>{concern.length}/200</p>
        </div>
        <div style={{ marginTop: 8 }}>
          <button
            className="cta-gold"
            onClick={onSubmit}
            disabled={submitting || dreamText.trim().length === 0}
            aria-label="꿈 해석 받기"
          >
            {submitting
              ? '꿈을 살피는 중이에요...'
              : dreamText.trim().length === 0
                ? '꿈 내용을 적어주세요'
                : '꿈 해석 받기'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 오류 화면 (generateDreamFree 실패) — v4.1 ErrorState 공용
 * ═════════════════════════════════════════════════════════════════ */
function ErrorView({ apiError, onBack }: { apiError: string; onBack: () => void }) {
  // 쿼터 소진은 운 차감 자체가 없으므로 refund 안내 불필요
  const isQuotaExhausted =
    apiError.includes('쿼터') || apiError.includes('resource-exhausted');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ErrorState
        title={isQuotaExhausted ? '이번 달 무료 쿼터가 소진됐어요' : '해석을 가져오지 못했어요'}
        subtitle={
          isQuotaExhausted
            ? '다음 달에 다시 만나요. 그동안은 사주 리포트로 더 깊은 분석도 가능해요.'
            : apiError || '잠시 후 다시 시도해주세요'
        }
        onRetry={isQuotaExhausted ? undefined : onBack}
        onBack={onBack}
        retryLabel="다시 시도"
        backLabel="꿈 다시 적기"
        showRefundNote={!isQuotaExhausted}
      />
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 무료 결과 — 사주연동 12섹션 / 무연동 9섹션
 * ═════════════════════════════════════════════════════════════════ */
// @ts-expect-error 2026-05-27 — DreamMockupView 로 대체 (legacy 보존, 향후 dead code sweep 대상)
function _FreeResultView_legacy({
  result,
  profile,
  hasSaju,
  onDeepAnalysis,
  onTopicTap,
  onFullReport,
  onInputSaju,
  onReset,
}: {
  result: any;
  profile: SajuProfile | null;
  hasSaju: boolean;
  onDeepAnalysis: () => void;
  onTopicTap: (topicId: TopicKey) => void;
  onFullReport: () => void;
  onInputSaju: () => void;
  onReset: () => void;
}) {
  const score: number = Math.max(0, Math.min(100, Number(result?.score ?? 0)));
  const grade: string = String(result?.grade ?? 'B').toUpperCase();
  const gradeColor = GRADE_V4[grade] ?? '#8C6D3D';
  const title: string = stripMd(String(result?.title ?? '꿈 해석'));
  const verdict: string = stripMd(String(result?.verdict ?? ''));
  const keywords: string[] = Array.isArray(result?.keywords) ? result.keywords.slice(0, 5) : [];
  const narrative: string = stripMd(String(result?.narrative ?? ''));
  const sajuTone: string = stripMd(String(result?.sajuTone ?? '')); // v4.1 신규
  const todayConnection: string = stripMd(String(result?.todayConnection ?? '')); // v4.1 신규
  const symbols: any[] = Array.isArray(result?.symbols) ? result.symbols.slice(0, 5) : [];
  const radarScores = result?.radarScores;
  const ohengComparison = result?.ohengComparison;
  const ohengDistribution = result?.ohengDistribution; // no-saju 전용
  const sajuConnection = result?.sajuConnection;
  const interpretation = result?.interpretation;
  const timeline = result?.timeline;
  const actionAdvice = result?.actionAdvice;
  const luckyColor = result?.luckyProfile?.color;

  const pillars = useMemo<PillarData[]>(
    () => (profile?.sajuData?.pillars ? buildPillars(profile) : []),
    [profile],
  );

  const radarData = useMemo(() => {
    if (!radarScores) return null;
    return [
      { axis: '재물운', value: Number(radarScores?.재물운 ?? 0) },
      { axis: '애정운', value: Number(radarScores?.애정운 ?? 0) },
      { axis: '건강운', value: Number(radarScores?.건강운 ?? 0) },
      { axis: '성장운', value: Number(radarScores?.성장운 ?? 0) },
      { axis: '경고신호', value: Number(radarScores?.경고신호 ?? 0) },
    ];
  }, [radarScores]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* S1: 판정 카드 */}
      <FadeIn>
        <section className="card-primary" style={{ padding: 24 }}>
          <div className="flex items-center gap-4">
            <ScoreDonut score={score} color={gradeColor} />
            <div className="flex-1 min-w-0">
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: `${gradeColor}18`,
                  color: gradeColor,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                }}
              >
                {grade}등급
              </div>
              <p className="sec-title-lg" style={{ marginTop: 6 }}>{title}</p>
            </div>
          </div>
          {verdict && (
            <p className="text-body-lg" style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
              {verdict}
            </p>
          )}
          {keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {keywords.map((kw, i) => (
                <span key={i} className="chip-v4">{kw}</span>
              ))}
            </div>
          )}
        </section>
      </FadeIn>

      {/* S2: 사주 미니 카드 OR 사주 연동 제안 */}
      {hasSaju && pillars.length === 4 && (
        <FadeIn delay={0.04}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 4 }}>
              {profile?.name ?? '당신'}님의 사주
            </p>
            <p className="sec-caption" style={{ marginBottom: 14 }}>
              각 기둥을 탭하면 이 꿈과의 연결이 보여요
            </p>
            <SajuMiniCard pillars={pillars} />
          </section>
        </FadeIn>
      )}

      {!hasSaju && (
        <FadeIn delay={0.04}>
          <section className="card-navy-v4">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(184,150,90,0.2)' }}
              >
                <Pictogram k="ui:saju" size={22} color="#E8D5A8" />
              </div>
              <div>
                <p className="sec-title" style={{ color: '#F5EFE0' }}>
                  사주 연동 시 10배 깊어져요
                </p>
                <p className="text-body-sm" style={{ color: 'rgba(245,239,224,0.7)', marginTop: 6 }}>
                  생년월일만 입력하면 이 꿈을 당신 사주와 교차 분석할 수 있어요. 무료입니다.
                </p>
              </div>
            </div>
            <button onClick={onInputSaju} className="cta-gold" style={{ marginTop: 14 }}>
              사주 무료 입력 →
            </button>
          </section>
        </FadeIn>
      )}

      {/* S3: 꿈 장면 재구성 */}
      {narrative && (
        <FadeIn delay={0.08}>
          <section className="card-secondary">
            <p className="sec-meta" style={{ marginBottom: 6 }}>꿈을 다시 봅니다</p>
            <p
              className="text-body-md"
              style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}
            >
              {narrative}
            </p>
          </section>
        </FadeIn>
      )}

      {/* S3.5: 사주 × 꿈 톤 (v4.1 신규 · 사주 있을 때만) */}
      {hasSaju && sajuTone && (
        <FadeIn delay={0.1}>
          <section className="card-accent">
            <p className="sec-meta" style={{ marginBottom: 6 }}>이 꿈의 톤</p>
            <p
              className="text-body-lg"
              style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}
            >
              {sajuTone}
            </p>
          </section>
        </FadeIn>
      )}

      {/* S3.6: 오늘과의 연결 (v4.1 신규 · 사주 있을 때만) */}
      {hasSaju && todayConnection && (
        <FadeIn delay={0.11}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 10 }}>꿈과 오늘의 기운 연결</p>
            <p
              className="text-body-lg"
              style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}
            >
              {todayConnection}
            </p>
          </section>
        </FadeIn>
      )}

      {/* S4: 꿈 속 핵심 상징 (IX-2 드래그/탭) */}
      {symbols.length > 0 && (
        <FadeIn delay={0.12}>
          <SymbolDragMap symbols={buildSymbolItems(symbols, hasSaju)} />
        </FadeIn>
      )}

      {/* S5: 오행 대조 / 분포 */}
      {hasSaju && ohengComparison && (
        <FadeIn delay={0.16}>
          <section className="card-secondary">
            <p className="sec-title" style={{ marginBottom: 6 }}>꿈 속 오행 vs 내 사주 오행</p>
            <p className="sec-caption" style={{ marginBottom: 14 }}>
              {stripMd(String(ohengComparison?.insight ?? ''))}
            </p>
            <OhengCompareBar
              primary={toOhengDist(ohengComparison?.sajuDistribution)}
              secondary={toOhengDist(ohengComparison?.dreamDistribution)}
              primaryLabel="내 사주"
              secondaryLabel="꿈"
            />
          </section>
        </FadeIn>
      )}

      {!hasSaju && ohengDistribution && (
        <FadeIn delay={0.16}>
          <section className="card-secondary">
            <p className="sec-title" style={{ marginBottom: 14 }}>꿈 속 오행 분포</p>
            <OhengCompareBar primary={toOhengDist(ohengDistribution)} primaryLabel="꿈" />
          </section>
        </FadeIn>
      )}

      {/* S6: 5축 레이더 (saju 있을 때만 PRD 명시) */}
      {hasSaju && radarData && (
        <FadeIn delay={0.2}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>꿈이 보내는 5가지 신호</p>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E2E5EC" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{
                      fontSize: 13,
                      fill: '#1B2A4A',
                      fontFamily: 'Pretendard Variable, Pretendard, sans-serif',
                    }}
                  />
                  <Radar
                    dataKey="value"
                    stroke="#B8965A"
                    fill="#B8965A"
                    fillOpacity={0.22}
                    strokeWidth={2}
                    dot={{ fill: '#B8965A', r: 3 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </FadeIn>
      )}

      {/* S7: 사주 원국 × 꿈 연결 + L1 잠금 */}
      {hasSaju && sajuConnection?.publicText && (
        <FadeIn delay={0.24}>
          <section className="card-accent">
            <p className="sec-title" style={{ marginBottom: 10 }}>내 사주와 이 꿈의 연결</p>
            <p className="text-body-lg" style={{ color: 'var(--text-primary)' }}>
              {stripMd(String(sajuConnection.publicText))}
            </p>
          </section>
          {sajuConnection?.lockedPreview && (
            <div style={{ marginTop: 10 }}>
              <LockedCard
                title={stripMd(String(sajuConnection.lockedPreview))}
                subtitle="대운·세운 흐름까지 이어서 보세요"
                ctaText="사주 리포트로 전체 보기 (500원)"
                onUnlock={onFullReport}
              />
            </div>
          )}
        </FadeIn>
      )}

      {/* S8: 심층 해석 — v4.1 1500자+ 대응 레이아웃 (3단락 × 500자+) */}
      {interpretation && (
        <FadeIn delay={0.28}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 18 }}>심층 해석</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {interpretation?.psychological && (
                <div>
                  <p className="sec-meta" style={{ marginBottom: 6, color: 'var(--brand-gold)' }}>
                    심리적 의미
                  </p>
                  <p
                    className="text-body-lg"
                    style={{
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-line',
                      lineHeight: 1.75,
                    }}
                  >
                    {stripMd(String(interpretation.psychological))}
                  </p>
                </div>
              )}
              {interpretation?.lifestyle && (
                <div>
                  <p className="sec-meta" style={{ marginBottom: 6, color: 'var(--brand-gold)' }}>
                    생활 조언
                  </p>
                  <p
                    className="text-body-lg"
                    style={{
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-line',
                      lineHeight: 1.75,
                    }}
                  >
                    {stripMd(String(interpretation.lifestyle))}
                  </p>
                </div>
              )}
              {hasSaju && interpretation?.future && (
                <div>
                  <p className="sec-meta" style={{ marginBottom: 6, color: 'var(--brand-gold)' }}>
                    앞으로 며칠
                  </p>
                  <p
                    className="text-body-lg"
                    style={{
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-line',
                      lineHeight: 1.75,
                    }}
                  >
                    {stripMd(String(interpretation.future))}
                  </p>
                </div>
              )}
            </div>
          </section>
        </FadeIn>
      )}

      {/* S9: 타임라인 3컷 (IX-3) + L2 잠금 (사주연동만) */}
      {hasSaju && timeline && (
        <FadeIn delay={0.32}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>앞으로의 전망</p>
            <TimelineSwipe
              steps={buildTimelineSteps(timeline)}
              onLockedTap={onDeepAnalysis}
              lockedCta="1주일 흐름 열기 (1운)"
            />
          </section>
        </FadeIn>
      )}

      {/* S10: 행동 조언 1공개 + 2잠금 (L3) */}
      {actionAdvice?.public && (
        <FadeIn delay={0.36}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>오늘의 행동 조언</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: 'var(--bg-cream)',
                  border: '0.5px solid rgba(184,150,90,0.22)',
                }}
              >
                <p className="sec-meta" style={{ marginBottom: 4, color: 'var(--brand-gold)' }}>
                  {stripMd(String(actionAdvice.public?.title ?? '조언 1'))}
                </p>
                <p className="text-body-md" style={{ color: 'var(--text-primary)' }}>
                  {stripMd(String(actionAdvice.public?.body ?? ''))}
                </p>
              </div>
              {Array.isArray(actionAdvice?.lockedTitles) &&
                actionAdvice.lockedTitles.slice(0, 2).map((lt: string, i: number) => (
                  <LockedCard
                    key={i}
                    title={stripMd(String(lt))}
                    subtitle={i === 0 ? '사주 용신을 활용하는 구체적 방법' : '주의해야 할 사람·상황'}
                    ctaText={i === 0 ? '전체 조언 열기 (1운)' : '추가 조언 보기 (1운)'}
                    onUnlock={onDeepAnalysis}
                  />
                ))}
            </div>
          </section>
        </FadeIn>
      )}

      {/* S11: 행운 프로필 — 색 공개 + 3잠금 (L4) */}
      <FadeIn delay={0.4}>
        <section className="card-primary">
          <p className="sec-title" style={{ marginBottom: 14 }}>오늘의 행운 프로필</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {/* 1. 색 — 무료 공개 */}
            <LuckyColorCard color={luckyColor} />
            {/* 2/3/4 — 잠금 */}
            <LockedCard
              title="행운의 숫자"
              subtitle="오늘 당신에게 맞는 숫자"
              ctaText="숫자 보기 (1운)"
              onUnlock={onDeepAnalysis}
              height={144}
            />
            <LockedCard
              title="행운의 방위"
              subtitle="어디로 향해야 할지"
              ctaText="방위 보기 (1운)"
              onUnlock={onDeepAnalysis}
              height={144}
            />
            <LockedCard
              title={hasSaju ? '보충 오행' : '사주 입력 후 열림'}
              subtitle={hasSaju ? '부족한 기운을 채우는 법' : '먼저 사주를 등록해주세요'}
              ctaText={hasSaju ? '오행 보기 (1운)' : '사주 입력하기'}
              onUnlock={hasSaju ? onDeepAnalysis : onInputSaju}
              height={144}
            />
          </div>
        </section>
      </FadeIn>

      {/* S12: 주제 CTA 4카드 (IX-5) + 풀 리포트 */}
      <FadeIn delay={0.44}>
        <TopicCTAGrid
          meta="더 깊이 알고 싶다면"
          title="주제별 심층 분석"
          topics={DREAM_TOPIC_ITEMS}
          onTopicTap={onTopicTap}
        />
      </FadeIn>

      {/* Phase D'-3 Bundle 2 — FreeUpsellCard 정렬 (단일 CTA, 작업 0 정책) */}
      <FadeIn delay={0.48}>
        <FreeUpsellCard
          title="꿈 패턴의 뿌리, 사주로 더 깊게"
          desc="오늘 꿈의 결을 사주 전체에서 풀어드립니다. 성격·대인·직업·재물·애정·건강까지."
          ctaLabel="사주 전체로"
          /* 2026-05-29 H1 — costLabel 제거 → FreeUpsellCard SSOT 기본값(세일가) 사용 */
          onTap={onFullReport}
        />
      </FadeIn>

      {/* 다시 시작 */}
      <div style={{ marginTop: 6 }}>
        <button className="cta-ghost" onClick={onReset}>처음부터 다시</button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 심층 결과 (유료 1운 · Sonnet + 2차 리뷰)
 * ═════════════════════════════════════════════════════════════════ */
// @ts-expect-error 블러잠금 SSOT 후 dead code (legacy 보존)
function DeepResultView({
  result,
  profile,
  onReset,
}: {
  result: any;
  profile: SajuProfile | null;
  onReset: () => void;
}) {
  const title = stripMd(String(result?.title ?? '심층 해석'));
  const verdict = stripMd(String(result?.verdict ?? ''));
  const grade = String(result?.grade ?? 'A').toUpperCase();
  const gradeColor = GRADE_V4[grade] ?? '#8C6D3D';
  const score = Math.max(0, Math.min(100, Number(result?.overallScore ?? 0)));
  const sajuConnection = stripMd(String(result?.sajuConnection ?? ''));
  const interpretation = stripMd(String(result?.interpretation ?? ''));
  const timeline = stripMd(String(result?.timeline ?? ''));
  const ohengMessage = stripMd(String(result?.ohengMessage ?? ''));
  const luckyAction = stripMd(String(result?.luckyAction ?? ''));
  const luckyProfile = result?.luckyProfile;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <FadeIn>
        <section className="card-accent">
          <div className="flex items-center gap-4">
            <ScoreDonut score={score} color={gradeColor} />
            <div className="flex-1 min-w-0">
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: `${gradeColor}18`,
                  color: gradeColor,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                심층 · {grade}등급
              </span>
              <p className="sec-title-lg" style={{ marginTop: 6 }}>{title}</p>
            </div>
          </div>
          {verdict && (
            <p className="text-body-lg" style={{ color: 'var(--text-primary)', marginTop: 14 }}>
              {verdict}
            </p>
          )}
        </section>
      </FadeIn>

      {sajuConnection && (
        <FadeIn delay={0.04}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 10 }}>
              {profile?.name ?? '당신'}님 사주와 꿈의 교차
            </p>
            <p className="text-body-lg" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
              {sajuConnection}
            </p>
          </section>
        </FadeIn>
      )}

      {ohengMessage && (
        <FadeIn delay={0.08}>
          <section className="card-secondary">
            <p className="sec-meta" style={{ marginBottom: 6 }}>오행이 보내는 메시지</p>
            <p className="text-body-md" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
              {ohengMessage}
            </p>
          </section>
        </FadeIn>
      )}

      {interpretation && (
        <FadeIn delay={0.12}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 10 }}>심층 해석</p>
            <p className="text-body-lg" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
              {interpretation}
            </p>
          </section>
        </FadeIn>
      )}

      {timeline && (
        <FadeIn delay={0.16}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 10 }}>앞으로의 흐름</p>
            <p className="text-body-lg" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
              {timeline}
            </p>
          </section>
        </FadeIn>
      )}

      {luckyProfile && (
        <FadeIn delay={0.2}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>나만의 행운 프로필</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {luckyProfile?.color && (
                <LuckyColorCard color={luckyProfile.color} height={144} />
              )}
              {luckyProfile?.number != null && (
                <LuckyStatCard
                  title="행운의 숫자"
                  value={String(luckyProfile.number)}
                  reason={stripMd(String(luckyProfile?.numberReason ?? ''))}
                />
              )}
              {luckyProfile?.direction && (
                <LuckyStatCard
                  title="행운의 방위"
                  value={String(luckyProfile.direction)}
                  reason={stripMd(String(luckyProfile?.directionReason ?? ''))}
                />
              )}
              {luckyProfile?.element && (
                <LuckyStatCard
                  title="보충 오행"
                  value={String(luckyProfile.element)}
                  reason={stripMd(String(luckyProfile?.elementReason ?? ''))}
                />
              )}
            </div>
          </section>
        </FadeIn>
      )}

      {luckyAction && (
        <FadeIn delay={0.24}>
          <section className="card-accent">
            <p className="sec-meta" style={{ marginBottom: 6 }}>오늘~이번 주 실천</p>
            <p className="text-body-lg" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
              {luckyAction}
            </p>
          </section>
        </FadeIn>
      )}

      <button className="cta-ghost" onClick={onReset} style={{ marginTop: 6 }}>처음으로</button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 작은 UI 파츠
 * ═════════════════════════════════════════════════════════════════ */

function ScoreDonut({ score, color }: { score: number; color: string }) {
  const size = 88;
  const strokeWidth = 8;
  const r = size / 2 - strokeWidth;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(27,42,74,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: '-0.03em' }}>
          {score}
        </span>
        <span className="sec-caption" style={{ fontSize: 10 }}>점</span>
      </div>
    </div>
  );
}

/**
 * LuckyColorCard v2 (2026-04-22) — DreamPage.
 * Flippable 제거. DailyFortunePage 와 동일한 정적 1면 카드로 통일.
 * 근거: 탭-숨김 패턴이 모바일에서 발견율 낮고, "이유" 가 가장 신뢰감 주는 정보라 숨기지 않는다.
 */
function LuckyColorCard({ color }: { color: any; height?: number }) {
  const hex = typeof color?.hex === 'string' ? color.hex : '#B8965A';
  const name = typeof color?.name === 'string' ? color.name : '골드';
  const reason = typeof color?.reason === 'string' ? stripMd(color.reason) : '';
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: '#FFFFFF',
        border: '0.5px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      aria-label={`행운의 색 — ${name}`}
    >
      <p className="sec-meta" style={{ color: 'var(--brand-gold)' }}>행운의 색</p>
      <div
        style={{
          width: '100%',
          height: 44,
          borderRadius: 8,
          background: hex,
          border: '0.5px solid rgba(27,42,74,0.1)',
        }}
        aria-hidden
      />
      <p className="sec-title" style={{ fontSize: 15, margin: 0 }}>{name}</p>
      <p
        className="text-body-sm"
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {reason || `${name} — 오늘 당신의 흐름과 가장 공명하는 결입니다.`}
      </p>
    </div>
  );
}

/** LuckyStatCard v2 — DreamPage. Flippable 제거 · DailyFortunePage 와 정렬. */
function LuckyStatCard({
  title,
  value,
  reason,
}: {
  title: string;
  value: string;
  reason: string;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: '#FFFFFF',
        border: '0.5px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
      aria-label={`${title} — ${value}`}
    >
      <p className="sec-meta" style={{ color: 'var(--brand-gold)' }}>{title}</p>
      <p
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: 'var(--text-primary)',
          marginTop: 2,
          marginBottom: 4,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      <p
        className="text-body-sm"
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {reason || `${title} ${value} — 사주와 오늘 흐름이 만나는 지점입니다.`}
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 헬퍼 — AI 응답 → Phase A 컴포넌트 어댑터
 * ═════════════════════════════════════════════════════════════════ */

/** profile.sajuData.pillars ([년,월,일,시]) → SajuMiniCard용 4기둥 [시,일,월,년] */
function buildPillars(profile: SajuProfile): PillarData[] {
  const raw = profile.sajuData?.pillars ?? [];
  const labels: Array<'년' | '월' | '일' | '시'> = ['년', '월', '일', '시'];
  const ordered: PillarData[] = raw.map((p: any, i: number) => ({
    label: labels[i] ?? '년',
    gan: String(p?.천간 ?? ''),
    ji: String(p?.지지 ?? ''),
    ohengGan: (p?.천간오행 ?? '토') as OhengType,
    ohengJi: (p?.지지오행 ?? '토') as OhengType,
    ganRead: p?.천간읽기 ? String(p.천간읽기) : undefined,
    jiRead: p?.지지읽기 ? String(p.지지읽기) : undefined,
    shipsin: p?.십성 ?? undefined,
    unavailable: p?.available === false,
  }));
  // 전통 순서: 시→일→월→년 (reverse)
  return [...ordered].reverse();
}

/** AI 응답의 symbols 5개 → SymbolDragMap SymbolItem[] */
function buildSymbolItems(symbols: any[], hasSaju: boolean): SymbolItem[] {
  return symbols.slice(0, 5).map((s, i) => {
    const oheng = normalizeOheng(s?.oheng);
    const pictogram = normalizePictogram(s?.pictogram, oheng);
    const meaning = stripMd(String(hasSaju ? s?.meaningWithSaju ?? s?.meaning ?? '' : s?.meaning ?? ''));
    return {
      id: `sym-${i}`,
      keyword: String(s?.keyword ?? `상징${i + 1}`),
      pictogram,
      correctOheng: oheng,
      meaning: meaning || `${String(s?.keyword ?? '상징')}은 오행 ${oheng}(${ohengHanja(oheng)}) 기운에 연결됩니다.`,
    };
  });
}

/** AI 응답의 timeline (today / in3days / [1주후 잠금]) → TimelineStep[3] */
function buildTimelineSteps(timeline: any): TimelineStep[] {
  const today = timeline?.today ?? {};
  const in3 = timeline?.in3days ?? {};
  return [
    {
      label: '오늘',
      title: stripMd(String(today?.title ?? '바로 지금')),
      body: stripMd(String(today?.body ?? '')),
    },
    {
      label: '3일 후',
      title: stripMd(String(in3?.title ?? '이어지는 흐름')),
      body: stripMd(String(in3?.body ?? '')),
    },
    {
      label: '1주 후',
      title: '한 주 뒤의 전망',
      body: '',
      locked: true,
    },
  ];
}

function toOhengDist(d: any): Record<OhengType, number> {
  const safe = (v: any) => Math.max(0, Number(v ?? 0));
  return {
    목: safe(d?.목),
    화: safe(d?.화),
    토: safe(d?.토),
    금: safe(d?.금),
    수: safe(d?.수),
  };
}

function normalizeOheng(v: any): OhengType {
  const s = String(v ?? '').trim();
  if (s === '목' || s === '화' || s === '토' || s === '금' || s === '수') return s as OhengType;
  return '토';
}

function normalizePictogram(raw: any, oheng: OhengType): PictogramKey {
  const s = String(raw ?? '').trim();
  // AI 응답이 'ui:water' 같은 유효 key 면 그대로, 아니면 오행 picto 로 폴백
  if (s.startsWith('dream:') || s.startsWith('ui:') || s.startsWith('oheng:')) {
    return s as PictogramKey;
  }
  return OHENG_PICTOGRAM_KEY[oheng];
}

function ohengHanja(oheng: OhengType): string {
  const m: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  return m[oheng];
}

/** DreamSajuContext 빌더 — 무료/심층 양쪽에서 사용 */
function buildSajuContext(profile: SajuProfile): any {
  const p = profile.sajuData?.pillars ?? [];
  const day = p[2] ?? {};
  const ohengDist = (profile.sajuData as any)?.ohengDistribution
    ?? (profile.sajuData as any)?.elements
    ?? {};
  const currentDaeun = (profile.sajuData as any)?.currentDaeun?.간지;
  const ganzi = (x: any): string =>
    x ? `${x?.천간 ?? ''}${x?.지지 ?? ''}` : '';
  return {
    name: profile.name,
    yearGanzi: ganzi(p[0]),
    monthGanzi: ganzi(p[1]),
    dayGanzi: ganzi(p[2]),
    timeGanzi: ganzi(p[3]),
    ilgan: day?.천간 ?? '',
    ilganOheng: day?.천간오행 ?? '',
    ohengDistribution: ohengDist,
    currentDaeun,
    fullSajuData: profile.sajuData,
  };
}

/* ══════════════════════════════════════════════════════════════════
 * 주제 CTA 4카드 (IX-5) — 2026-04-22 SSOT v1 정렬
 * - SSOT: src/constants/topics.ts · TOPIC_REGISTRY
 * - '연애·결혼' 혼합 라벨 → SSOT 단일 주제 (모순 방지 · love/marriage 별도 주제)
 * - 하드코딩 컬러 (#E91E63·#1565C0·#2D8A4E) → TOPIC_REGISTRY SSOT 컬러
 * - '1운 (500원)' → '1운' (원화 노출 ChargePage 로 집중)
 * ═════════════════════════════════════════════════════════════════ */
const DREAM_TOPIC_ITEMS: TopicItem[] = [
  {
    id: 'love',
    title: TOPIC_REGISTRY.love.label,
    desc: '이 꿈이 애정운에 주는 신호',
    price: '1운',
    color: TOPIC_REGISTRY.love.color,
  },
  {
    id: 'wealth',
    title: TOPIC_REGISTRY.wealth.label,
    desc: '재물 흐름과 기회의 방향',
    price: '1운',
    color: TOPIC_REGISTRY.wealth.color,
  },
  {
    id: 'career',
    title: TOPIC_REGISTRY.career.label,
    desc: '일·성장의 리듬 분석',
    price: '1운',
    color: TOPIC_REGISTRY.career.color,
  },
  {
    id: 'health',
    title: TOPIC_REGISTRY.health.label,
    desc: '컨디션과 체력의 포인트',
    price: '1운',
    color: TOPIC_REGISTRY.health.color,
  },
];

