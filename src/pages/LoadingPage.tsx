/**
 * LoadingPage v2 — 3-tier 의식형 로딩 (PRD: docs/prd/로딩전략.md)
 *
 * 변경 (2026-04-22):
 *  - v1: 단일 step counter + tip card → 사주아이식 회전 spinner 만 노출.
 *  - v2: 3-tier (만세력 추출 → 사주 원국 → AI 해석) 단계 전환 +
 *        실제 sajuData.pillars 즉시 노출 (干/支 오행 컬러 분리) +
 *        REPORT_SECTIONS 12 섹션 스켈레톤 + 회전 카피 + tip card.
 *  - 스트리밍은 미적용(서버 generateReport 가 단일 호출). 시각적 연출만.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSajuContext } from '@/contexts/SajuContext';
import { generateReport } from '@/services/ai/reportGenerator';
import { saveReport, generateId } from '@/services/storage/localStore';
import { CHEONGAN_OHENG, JIJI_OHENG, OHENG_MAP } from '@/constants/oheng';
import { REPORT_SECTIONS } from '@/constants/pricing';
import type { OhengType } from '@/types/saju';

/** 단계 정의 — PRD §2.1 */
const STAGES = [
  { id: 1, label: '당신의 시간을 읽고 있어요', target: 33 },
  { id: 2, label: '사주가 모이고 있어요', target: 66 },
  { id: 3, label: '당신의 이야기를 적는 중이에요', target: 95 },
] as const;

/** 단계별 회전 카피 — PRD §4.1 */
const ROTATING_COPY: Record<number, string[]> = {
  1: [
    '잠시만요. 우주의 배열을 맞추는 중이에요.',
    '시간을 되돌려 당신이 태어난 순간을 보고 있어요.',
    '한국 진태양시(127.5°)로 보정하고 있어요.',
  ],
  2: [
    '천간과 지지가 만나는 자리를 보고 있어요.',
    '오행의 균형을 재고 있어요.',
    '십성의 자리를 확인 중이에요.',
  ],
  3: [
    '당신의 기질을 헤아리는 중…',
    '대인관계의 결을 보고 있어요…',
    '재물의 흐름을 추적 중…',
    '애정의 파동을 읽고 있어요…',
    '올해의 운을 가늠 중이에요…',
    '개운의 실마리를 찾는 중…',
  ],
};

/** 사주 꿀팁 — 3단계 동안 회전 (PRD §2.2.3 보조) */
const TIPS = [
  { category: '알쓸사잡', text: '사주의 "사(四)"는 네 기둥, "주(柱)"는 기둥이라는 뜻이에요. 태어난 년·월·일·시를 각각 하나의 기둥으로 봅니다.' },
  { category: '알쓸사잡', text: '천간(天干)은 하늘의 기운, 지지(地支)는 땅의 기운. 이 둘이 만나 하나의 기둥을 이루어요.' },
  { category: '알쓸사잡', text: '일간(日干)은 "나 자신"을 뜻해요. 나머지 7글자는 나를 둘러싼 환경과 관계입니다.' },
  { category: '오행 꿀팁', text: '목(木)이 강한 사람은 아침형 인간이 많아요. 새벽에 일찍 일어나는 습관이 잘 맞습니다.' },
  { category: '오행 꿀팁', text: '화(火)가 부족하면 적극성이 떨어질 수 있어요. 빨간 소품을 가까이 두면 기운 보충에 도움이 됩니다.' },
  { category: '오행 꿀팁', text: '토(土)는 안정과 중재의 에너지예요. 토가 강한 사람은 중재자 역할에 타고난 능력이 있어요.' },
  { category: '오행 꿀팁', text: '금(金)이 강하면 결단력이 뛰어나지만, 너무 강하면 고집으로 나타날 수 있어요.' },
  { category: '오행 꿀팁', text: '수(水)는 지혜와 유연함. 부족하면 물을 많이 마시고 수영을 하는 것만으로도 보충이 됩니다.' },
  { category: '실생활 활용', text: '중요한 면접이나 미팅은 오전에 잡으세요. 양(陽)의 기운이 강한 시간대가 발표력을 높여줍니다.' },
  { category: '실생활 활용', text: '잠이 잘 안 올 때는 북쪽 머리를 두고 자 보세요. 수(水) 기운의 방위라 안정에 도움이 됩니다.' },
  { category: '실생활 활용', text: '새 프로젝트는 월초보다 월중에 시작하는 게 유리해요. 기운이 안정된 시기이기 때문이에요.' },
  { category: '사주500 가이드', text: '결과 리포트의 점수는 절대값이 아니에요. 내 사주 구조 안에서의 상대적 강약을 보여줍니다.' },
  { category: '사주500 가이드', text: '시간을 모를 때는 6글자로 분석하지만, 시간을 알면 8글자 분석이 가능해서 훨씬 정밀해져요.' },
  { category: '사주500 가이드', text: '같은 날 태어나도 시간에 따라 사주가 완전히 달라져요. 출생 시간이 그만큼 중요합니다.' },
  { category: '사주500 가이드', text: '대운은 10년 단위로 바뀌는 큰 흐름이에요. 지금 내가 어떤 대운에 있는지 꼭 확인해보세요.' },
  { category: '명리학 상식', text: '음양오행은 2,500년 전부터 내려온 동양 자연철학이에요. 미신이 아닌 체계적 분석 도구입니다.' },
  { category: '명리학 상식', text: '격국(格局)은 사주의 "성격 유형"과 비슷해요. MBTI처럼, 사주에도 분류 체계가 있습니다.' },
];

// 2026-05-04 reportType 분기 — premium 60-120s vs basic 15-30s 페이싱 차이
//   basic (15-30s):   2.5s + 4.0s + ∞ → 빠른 페이싱 (stage 3 에서 5-10s 정도 머묾)
//   premium (60-120s): 6.0s + 9.0s + ∞ → 느린 페이싱 (stage 3 에서 45-100s · "멈춘 듯" 체감 완화)
const STAGE_DURATIONS_BASIC = [2500, 4000, 0];
const STAGE_DURATIONS_PREMIUM = [6000, 9000, 0];

export function LoadingPage() {
  const navigate = useNavigate();
  const { sajuData, situation } = useSajuContext();
  // Stage 7e-9: URL query ?type=premium 받으면 종합 사주 (10운 차감은 호출자가 수행)
  const reportType: 'basic' | 'premium' = (() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('type') === 'premium' ? 'premium' : 'basic';
    } catch { return 'basic'; }
  })();
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [copyIdx, setCopyIdx] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [sectionDoneCount, setSectionDoneCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const called = useRef(false);

  // 팁 셔플
  const shuffledTips = useMemo(() => {
    const arr = [...TIPS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  // 사주 4기둥 (전통 순서: 시→일→월→년)
  const pillarsForDisplay = useMemo(() => {
    if (!sajuData) return [];
    return [...sajuData.pillars].reverse();
  }, [sajuData]);

  // SSE 모드 여부 — 활성화 시 artificial timer 끄고 실제 그룹 도착에 맞춰 진행도 push
  const useStreamRef = useRef(false);
  useEffect(() => {
    if (!sajuData) {
      navigate('/', { replace: true });
      return;
    }

    // SSE 모드 결정 — 한 번만
    useStreamRef.current =
      reportType === 'premium' &&
      import.meta.env.VITE_USE_PREMIUM_STREAM === 'true';

    // ─ 단계 1 → 2 → 3 자동 전환 (SSE 모드는 onStart/onGroup 으로 stage 직접 push)
    // 2026-05-04 reportType 별 페이싱 분기 — premium 은 stage 3에서 1-2분 머무므로 단계 길이 ↑
    const STAGE_DURATIONS = reportType === 'premium' ? STAGE_DURATIONS_PREMIUM : STAGE_DURATIONS_BASIC;
    const t1 = !useStreamRef.current ? setTimeout(() => setStage(2), STAGE_DURATIONS[0]) : null;
    const t2 = !useStreamRef.current ? setTimeout(() => setStage(3), STAGE_DURATIONS[0] + STAGE_DURATIONS[1]) : null;

    // ─ 회전 카피 — 3.5s 간격
    const copyTimer = setInterval(() => setCopyIdx(p => p + 1), 3500);

    // ─ 팁 회전 — 5s 간격
    const tipTimer = setInterval(() => setTipIdx(p => (p + 1) % shuffledTips.length), 5000);

    // ─ 단계 3 진입 후 섹션 스켈레톤 점진적 채움
    //  · SSE 모드: artificial timer X — 실제 SSE group 도착에 맞춰 sectionDoneCount push
    //  · callable 모드: 30s 정도 걸리므로 12 sections × 2.5s = 30s 매핑
    const sectionTimer = !useStreamRef.current
      ? setInterval(() => {
          setSectionDoneCount(prev => Math.min(prev + 1, REPORT_SECTIONS.length - 2));
        }, 2400)
      : null;

    if (!called.current) {
      called.current = true;
      callGenerateReport();
    }

    async function callGenerateReport() {
      // T1+T2 SSE — env flag 활성 시 그룹별 실제 진행도 매칭
      // 실패 시 자동으로 기존 callable 폴백 (배포 순서 무관 안전)
      const useStream = useStreamRef.current;

      if (useStream) {
        try {
          const { generatePremiumReportStream } = await import('@/services/ai/reportGenerator');
          let streamSucceeded = false;
          // 실제 그룹 도착에 맞춘 진행도 매핑 (12 섹션 기준)
          // Group A (§01-§04) → 4 sections done
          // Group B (§05-§07) → 8 sections done (cumulative)
          // Group C (§08-§10) → 12 sections done (전체)
          const groupArrivals: Record<string, boolean> = { A: false, B: false, C: false };
          const updateProgress = () => {
            let count = 0;
            if (groupArrivals.A) count = 4;
            if (groupArrivals.B) count = Math.max(count, 8);
            if (groupArrivals.C) count = REPORT_SECTIONS.length;
            // 도착 순서 무관 — 가장 큰 인덱스로 push (역행 방지)
            setSectionDoneCount(prev => Math.max(prev, count));
          };
          await new Promise<void>((resolve, reject) => {
            generatePremiumReportStream(sajuData!, situation || undefined, {
              onStart: () => {
                setStage(2);
                // 시작 즉시 1~2 섹션은 채움 (만세력·시각화)
                setSectionDoneCount(prev => Math.max(prev, 2));
              },
              onGroup: (group, _data, elapsedMs) => {
                console.log(`[LoadingPage] Group ${group} arrived in ${elapsedMs}ms`);
                groupArrivals[group] = true;
                updateProgress();
                setStage(3);
              },
              onDone: (result) => {
                saveReport({
                  id: result.reportId || generateId(),
                  name: sajuData!.input?.name || '나',
                  input: sajuData!.input as any,
                  sajuData: sajuData!,
                  type: 'paid',
                  contentType: 'report',
                  createdAt: new Date().toISOString(),
                  aiResult: { ...(result.content as any), tier: 'premium' as const },
                });
                import('@/services/toss/tossPromotion').then(m => m.triggerPromotionEvent(m.PROMO_EVENTS.FIRST_SAJU));
                navigate(`/result/${result.reportId}`, { replace: true });
                streamSucceeded = true;
                resolve();
              },
              onError: (msg) => {
                console.warn('[LoadingPage] SSE 실패 → callable 폴백:', msg);
                reject(new Error(msg));
              },
            }).catch(reject);
          });
          if (streamSucceeded) return;
        } catch (sseErr) {
          console.warn('[LoadingPage] SSE 처리 중 예외 → callable 폴백:', sseErr);
          // → 아래 callable 폴백 진행
        }
      }

      // 기본 경로 — callable generateReport (basic + premium 모두)
      try {
        const result = await generateReport(sajuData!, situation || undefined, reportType);
        saveReport({
          id: result.reportId || generateId(),
          name: sajuData!.input?.name || '나',
          input: sajuData!.input as any,
          sajuData: sajuData!,
          type: 'paid',
          contentType: 'report',
          createdAt: new Date().toISOString(),
          // premium 표식 보존 (ResultPage 의 isPremiumLayout 판단)
          aiResult: reportType === 'premium'
            ? { ...(result.content as any), tier: 'premium' as const }
            : result.content,
        });
        import('@/services/toss/tossPromotion').then(m => m.triggerPromotionEvent(m.PROMO_EVENTS.FIRST_SAJU));
        navigate(`/result/${result.reportId}`, { replace: true });
      } catch (err) {
        console.warn('[LoadingPage] 서버 호출 실패:', err);
        // ⚠️ 환불은 서버(Cloud Function)에서 처리됨 — 클라이언트 직접 환불 금지 (보안)
        // ⚠️ /result/local 폴백 절대 X — 옛날 legacy layout 노출 방지 (사용자 강력 요청)
        // 에러 메시지만 표시 → 사용자가 직접 홈/입력으로 이동
        setError('분석에 실패했어요. 잔액은 자동으로 복구돼요. 잠시 후 다시 시도해주세요.');
      }
    }

    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      clearInterval(copyTimer);
      clearInterval(tipTimer);
      if (sectionTimer) clearInterval(sectionTimer);
    };
  }, [navigate, sajuData, situation, shuffledTips, reportType]);

  if (!sajuData) return null;

  const stageMeta = STAGES[stage - 1];
  const currentCopyPool = ROTATING_COPY[stage] || [];
  const currentCopy = currentCopyPool[copyIdx % currentCopyPool.length];
  const currentTip = shuffledTips[tipIdx];
  // Stage 7e-6: stage 3 에서 sectionDoneCount 따라 progress 점진 증가 (66→95%)
  const progress = stage < 3
    ? stageMeta.target
    : Math.min(95, 66 + Math.round((sectionDoneCount / Math.max(1, REPORT_SECTIONS.length - 2)) * 29));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center px-5 pt-12 pb-8 overflow-y-auto"
      style={{ background: 'var(--bg-page-gradient)' }}>

      {/* ===== 상단 단계 인디케이터 ===== */}
      <div className="flex items-center gap-2 mb-6">
        {STAGES.map(s => (
          <div key={s.id} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <motion.div
                animate={{
                  scale: stage === s.id ? 1.1 : 1,
                  backgroundColor: stage >= s.id ? '#B8965A' : 'rgba(184,150,90,0.15)',
                }}
                transition={{ duration: 0.4 }}
                className="w-6 h-6 rounded-full flex items-center justify-center"
              >
                <span className={`text-[10px] font-bold ${stage >= s.id ? 'text-white' : 'text-text-disabled'}`}>{s.id}</span>
              </motion.div>
            </div>
            {s.id < 3 && (
              <div className="w-8 h-px" style={{ background: stage > s.id ? '#B8965A' : 'rgba(184,150,90,0.2)' }} />
            )}
          </div>
        ))}
      </div>

      {/* ===== 단계 카피 ===== */}
      <div className="h-7 relative w-full max-w-[320px] mb-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={`stage-${stage}`}
            className="text-h3 text-text-primary text-center absolute inset-0"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            {stageMeta.label}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ===== 회전 보조 카피 ===== */}
      <div className="h-5 relative w-full max-w-[320px] mb-5">
        <AnimatePresence mode="wait">
          <motion.p
            key={`copy-${stage}-${copyIdx}`}
            className="text-caption text-text-muted text-center absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {currentCopy}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ===== 단계별 메인 시각화 ===== */}
      <div className="w-full max-w-[340px] mb-5">
        <AnimatePresence mode="wait">
          {stage === 1 && (
            <motion.div
              key="stage-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl px-5 py-6 text-center"
              style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
            >
              <p className="text-caption text-text-hint mb-2">입력 시각</p>
              <p className="text-body text-text-secondary">
                {sajuData.input.birthYear}년 {sajuData.input.birthMonth}월 {sajuData.input.birthDay}일
                {sajuData.input.hasBirthTime ? ` ${sajuData.input.birthHour}시` : ''}
              </p>
              <div className="my-3 flex items-center justify-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 rounded-full border-2 border-brand-gold border-t-transparent"
                />
                <span className="text-caption text-brand-gold">한국 진태양시 보정 중…</span>
              </div>
              <p className="text-caption text-text-hint">표준시 135° → 서울 127.5°</p>
            </motion.div>
          )}

          {stage >= 2 && (
            <motion.div
              key="pillars"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl px-3 py-4"
              style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex gap-1.5">
                {pillarsForDisplay.map((p: any, i: number) => {
                  const posLabels = ['시', '일', '월', '년'];
                  if (p?.available === false) {
                    return (
                      <div key={i} className="flex-1 rounded-lg border border-dashed border-border py-3 text-center bg-bg-surface">
                        <p className="text-[9px] text-text-hint">{posLabels[i]}주</p>
                        <p className="text-[10px] text-text-disabled mt-1">미입력</p>
                      </div>
                    );
                  }
                  const ganOheng = p?.천간 ? CHEONGAN_OHENG[p.천간] as OhengType : null;
                  const jiOheng = p?.지지 ? JIJI_OHENG[p.지지] as OhengType : null;
                  const ganColor = ganOheng ? OHENG_MAP[ganOheng]?.color : '#888';
                  const jiColor = jiOheng ? OHENG_MAP[jiOheng]?.color : '#888';
                  const isMe = i === 1;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        // Stage 7e-9: Tier C 보강 — 한자 호흡 효과 (각 기둥 다른 phase)
                        scale: [1, 1.04, 1],
                      }}
                      transition={{
                        duration: 0.5,
                        delay: i * 0.12,
                        scale: {
                          duration: 3.2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: i * 0.4 + 0.5,
                        },
                      }}
                      className={`flex-1 rounded-lg py-3 text-center ${isMe ? 'border-2 border-brand-gold' : 'border border-border-light'}`}
                      style={{
                        background: isMe ? 'rgba(184,150,90,0.06)' : 'transparent',
                        boxShadow: isMe ? '0 4px 14px rgba(184,150,90,0.18)' : 'none',
                      }}
                    >
                      <p className={`text-[10px] ${isMe ? 'text-brand-gold font-bold' : 'text-text-hint'}`}>
                        {posLabels[i]}주
                      </p>
                      <p className="text-h2 mt-1 leading-tight">
                        <span style={{ color: ganColor, fontWeight: 800 }}>{p?.천간 || '·'}</span>
                      </p>
                      <p className="text-h2 leading-tight">
                        <span style={{ color: jiColor, fontWeight: 800 }}>{p?.지지 || '·'}</span>
                      </p>
                    </motion.div>
                  );
                })}
              </div>
              {stage === 2 && (
                <p className="text-caption text-text-muted text-center mt-3">
                  오행 배치 분석 중…
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stage 7e-7-rev: 사용자 지시 — 프리미엄(10운) 형태 유지. 10 섹션 스켈레톤 복원.
          (LoadingPage 는 프리미엄/일반 사주풀이 흐름에만 진입 — 오늘운세/주제 등은 AILoading 사용) */}
      <AnimatePresence>
        {stage === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-[340px] mb-5 rounded-2xl px-4 py-4"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="grid grid-cols-2 gap-1.5">
              {REPORT_SECTIONS.slice(0, 10).map((section, i) => {
                const done = i < sectionDoneCount;
                const active = i === sectionDoneCount;
                return (
                  <div key={section.id} className="flex items-center gap-1.5 py-1">
                    <motion.div
                      animate={{
                        backgroundColor: done ? '#B8965A' : active ? 'rgba(184,150,90,0.4)' : 'rgba(184,150,90,0.15)',
                      }}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    />
                    <span className={`text-[10px] truncate ${done ? 'text-text-secondary' : active ? 'text-brand-gold font-semibold' : 'text-text-disabled'}`}>
                      {section.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 진행바 ===== */}
      <div className="w-[280px] h-1 bg-border-light rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-brand-gold rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {error && (
        <div className="mt-6 mx-auto max-w-[340px] px-5">
          <div
            className="rounded-2xl px-5 py-5 text-center"
            style={{
              background: 'rgba(198,40,40,0.05)',
              border: '1px solid rgba(198,40,40,0.30)',
            }}
          >
            <div
              className="mx-auto mb-3"
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(198,40,40,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 18, fontWeight: 900, color: '#c62828',
              }}
            >
              !
            </div>
            <p className="text-body-sm font-bold mb-1" style={{ color: '#c62828' }}>분석에 실패했어요</p>
            <p className="text-caption mb-4" style={{ color: '#7A7269', lineHeight: 1.6 }}>
              잠시 후 다시 시도해 주세요.<br />
              차감된 운은 자동으로 복구됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/', { replace: true })}
                className="flex-1 h-11 rounded-xl text-caption font-semibold"
                style={{ background: '#FFFFFF', border: '1px solid #E5DFD0', color: '#1A1A1A' }}
              >
                홈으로
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 h-11 rounded-xl text-caption font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #B8965A, #8C6D3D)',
                  color: '#fff',
                }}
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 사주 꿀팁 카드 ===== */}
      <div className="mt-8 w-full max-w-[320px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tipIdx}
            className="rounded-2xl px-5 py-4"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-[10px] font-semibold text-brand-gold mb-1.5">{currentTip.category}</p>
            <p className="text-body-sm text-text-secondary leading-relaxed">
              {currentTip.text}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 2026-05-04 정직화: 표기 vs 실제 mismatch 수정 — premium 은 Opus + 16-24k tokens 라 60-120초.
       *  유저를 속이지 않게 reportType 분기 표기. */}
      <p className="text-[10px] text-text-disabled mt-5">
        {reportType === 'premium'
          ? '약 60~120초 소요 · 10섹션 깊이 풀이'
          : '약 15~30초 소요'}
      </p>
    </div>
  );
}
