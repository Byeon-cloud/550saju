import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { LockedCard } from '@/components/common/LockedCard';
import { TimelineSwipe, type TimelineStep } from '@/components/common/TimelineSwipe';
import { SymbolDragMap, type SymbolItem } from '@/components/common/SymbolDragMap';
import { Flippable } from '@/components/common/Flippable';
import { TopicCTAGrid, type TopicItem } from '@/components/common/TopicCTAGrid';
import { SajuMiniCard, type PillarData } from '@/components/saju/SajuMiniCard';
import { OhengCompareBar } from '@/components/saju/OhengCompareBar';
import {
  Pictogram,
  type DreamCategory,
  type PictogramKey,
  type TopicKey,
} from '@/components/brand/PictogramRegistry';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/common/Toast';
import {
  spendBalance,
  getProfiles,
  saveReport,
  generateId,
  type SajuProfile,
} from '@/services/storage/localStore';
import {
  generateDreamFree,
  generateDreamDeepV3,
} from '@/services/ai/reportGenerator';
import { stripMd } from '@/utils/format';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import type { OhengType } from '@/types/saju';

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
  { id: 'animal', label: '동물이 나오는 꿈', color: '#2D8A4E', examples: '뱀, 개, 고양이, 돼지, 호랑이', hot: true },
  { id: 'water', label: '물과 관련된 꿈', color: '#1565C0', examples: '바다, 강, 비, 홍수, 수영', hot: true },
  { id: 'death', label: '죽음 · 이별의 꿈', color: '#7B1FA2', examples: '누군가 죽는 꿈, 장례식, 이별' },
  { id: 'flying', label: '하늘을 나는 꿈', color: '#0288D1', examples: '날기, 떨어지기, 높은 곳' },
  { id: 'money', label: '돈 · 재물의 꿈', color: '#C9A96E', examples: '돈 줍기, 복권, 금, 보석', hot: true },
  { id: 'people', label: '사람이 나오는 꿈', color: '#E91E63', examples: '가족, 연인, 낯선 사람, 유명인' },
  { id: 'chase', label: '쫓기는 꿈', color: '#D32F2F', examples: '쫓기기, 도망, 숨기, 위험' },
  { id: 'nature', label: '자연 · 날씨 꿈', color: '#F57F17', examples: '꽃, 산, 불, 지진, 눈' },
  { id: 'other', label: '직접 적을게요', color: '#4A5568', examples: '위 항목에 없는 꿈을 자유롭게' },
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
  S: '#C9A96E',
  A: '#A08B6A',
  B: '#2D4470',
  C: '#8F6B4E',
  D: '#8F1F1C',
};

type Phase = 'category' | 'detail' | 'result' | 'deepLoading' | 'deepResult';

export function DreamPage() {
  usePageTitle('꿈해몽');
  const navigate = useNavigate();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('category');
  const [selectedCategory, setSelectedCategory] = useState<DreamCategory | null>(null);
  const [dreamText, setDreamText] = useState('');
  const [concern, setConcern] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [deepResult, setDeepResult] = useState<any>(null);
  const [apiError, setApiError] = useState('');
  const isAnalyzingRef = useRef(false);
  const isDeepAnalyzingRef = useRef(false);

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
    setApiError('');

    try {
      const categoryLabel = DREAM_CATEGORIES.find((c) => c.id === selectedCategory)?.label || '기타';
      const fullText = [dreamText, concern ? `\n현재 고민: ${concern}` : ''].filter(Boolean).join('');
      const saju = profile?.sajuData ? buildSajuContext(profile) : undefined;

      const result = await generateDreamFree({
        saju,
        dreamContent: fullText,
        category: categoryLabel,
        userConcern: concern || undefined,
      });
      setAiResult(result);

      // 보관함 저장 (무료)
      try {
        saveReport({
          id: generateId(),
          name: profile?.name || '꿈해몽',
          input: (profile?.input ?? {}) as any,
          sajuData: (profile?.sajuData ?? {}) as any,
          type: 'free',
          contentType: 'dream',
          createdAt: new Date().toISOString(),
          aiResult: result,
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
        setApiError(e?.message || 'AI 서버 연결에 실패했어요');
      }
      setAiResult(null);
    } finally {
      setIsLoading(false);
      setPhase('result');
      isAnalyzingRef.current = false;
    }
  }

  /* ─── 심층 해몽 (generateDreamDeep · Sonnet 4.6 v3 + 2차 리뷰) ─── */
  async function startDeepAnalysis() {
    if (isDeepAnalyzingRef.current) return;
    if (!profile?.sajuData) {
      toast.show('먼저 사주를 분석해주세요', 'warning');
      navigate('/input');
      return;
    }
    if (!aiResult) {
      toast.show('무료 해석을 먼저 진행해주세요', 'warning');
      return;
    }
    isDeepAnalyzingRef.current = true;

    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '심층 해몽에 1운이 필요해요' } });
      isDeepAnalyzingRef.current = false;
      return;
    }
    toast.show('1운이 차감됐어요', 'info');
    setPhase('deepLoading');

    try {
      const categoryLabel = DREAM_CATEGORIES.find((c) => c.id === selectedCategory)?.label || '기타';
      const fullText = [dreamText, concern ? `\n현재 고민: ${concern}` : ''].filter(Boolean).join('');
      const saju = buildSajuContext(profile);

      const freeSummary = {
        title: aiResult?.title ?? '',
        verdict: aiResult?.verdict ?? '',
        symbols: Array.isArray(aiResult?.symbols)
          ? aiResult.symbols.slice(0, 5).map((s: any) => s?.keyword ?? '')
          : [],
      };

      const { reportId, content } = await generateDreamDeepV3({
        saju,
        dreamContent: fullText,
        category: categoryLabel,
        freeResultSummary: freeSummary,
      });

      setDeepResult(content);

      try {
        saveReport({
          id: reportId ?? generateId(),
          name: profile.name || '심층 해몽',
          input: profile.input,
          sajuData: profile.sajuData,
          type: 'paid',
          contentType: 'deepDream',
          aiResult: content,
          createdAt: new Date().toISOString(),
        });
      } catch {
        /* 보관함 실패는 무시 */
      }
      setPhase('deepResult');
    } catch (e: any) {
      console.error('[DreamPage:deep] API 실패:', e);
      // 환불은 서버 트랜잭션 롤백에 위임
      toast.show('분석에 실패했어요. 잔액은 자동으로 복구돼요.', 'warning');
      setPhase('result');
    } finally {
      isDeepAnalyzingRef.current = false;
    }
  }

  function reset() {
    setPhase('category');
    setSelectedCategory(null);
    setDreamText('');
    setConcern('');
    setAiResult(null);
    setDeepResult(null);
    setApiError('');
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
            <FreeResultView
              key="result"
              result={aiResult}
              profile={profile}
              hasSaju={hasSaju}
              onDeepAnalysis={startDeepAnalysis}
              onTopicTap={(tid) => navigate(`/topic/${tid}`)}
              onFullReport={() => navigate('/result/latest')}
              onInputSaju={() => navigate('/input')}
              onReset={reset}
            />
          )}

          {phase === 'deepLoading' && (
            <motion.div key="deepLoading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AILoading
                name={profile?.name ?? '당신'}
                type="심층 해몽"
                steps={[
                  '대운·세운을 교차하고 있어요',
                  '오행 메시지를 풀고 있어요',
                  '2차 자기 리뷰로 다듬고 있어요',
                ]}
              />
            </motion.div>
          )}

          {phase === 'deepResult' && deepResult && (
            <DeepResultView
              key="deep"
              result={deepResult}
              profile={profile}
              onReset={reset}
            />
          )}
        </AnimatePresence>
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
              background: 'radial-gradient(circle, #C9A96E, transparent 70%)',
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
              ? 'AI가 분석 중이에요...'
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
 * 오류 화면 (generateDreamFree 실패)
 * ═════════════════════════════════════════════════════════════════ */
function ErrorView({ apiError, onBack }: { apiError: string; onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="card-navy-v4" style={{ padding: 32, textAlign: 'center' }}>
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'rgba(211,47,47,0.15)' }}
        >
          <Pictogram k="dream:empty" size={32} color="#E55050" />
        </div>
        <p className="sec-title-lg" style={{ color: '#F5EFE0' }}>해석에 실패했어요</p>
        <p className="text-body-sm" style={{ color: 'rgba(245,239,224,0.6)', marginTop: 8 }}>
          {apiError || 'AI 서버가 일시적으로 바빠요. 잠시 후 다시 시도해주세요.'}
        </p>
      </div>
      <Button fullWidth size="lg" onClick={onBack}>다시 시도하기</Button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 무료 결과 — 사주연동 12섹션 / 무연동 9섹션
 * ═════════════════════════════════════════════════════════════════ */
function FreeResultView({
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
  const gradeColor = GRADE_V4[grade] ?? '#A08B6A';
  const title: string = stripMd(String(result?.title ?? '꿈 해석'));
  const verdict: string = stripMd(String(result?.verdict ?? ''));
  const keywords: string[] = Array.isArray(result?.keywords) ? result.keywords.slice(0, 5) : [];
  const narrative: string = stripMd(String(result?.narrative ?? ''));
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
                style={{ background: 'rgba(201,169,110,0.2)' }}
              >
                <Pictogram k="ui:lucky" size={22} color="#E8D5A8" />
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
            <p className="text-body-md" style={{ color: 'var(--text-primary)' }}>{narrative}</p>
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
                    stroke="#C9A96E"
                    fill="#C9A96E"
                    fillOpacity={0.22}
                    strokeWidth={2}
                    dot={{ fill: '#C9A96E', r: 3 }}
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

      {/* S8: 심층 해석 2~3단락 */}
      {interpretation && (
        <FadeIn delay={0.28}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>심층 해석</p>
            <div className="space-y-4">
              {interpretation?.psychological && (
                <div>
                  <p className="sec-meta" style={{ marginBottom: 4 }}>심리적 의미</p>
                  <p className="text-body-lg" style={{ color: 'var(--text-primary)' }}>
                    {stripMd(String(interpretation.psychological))}
                  </p>
                </div>
              )}
              {interpretation?.lifestyle && (
                <div>
                  <p className="sec-meta" style={{ marginBottom: 4 }}>생활 조언</p>
                  <p className="text-body-lg" style={{ color: 'var(--text-primary)' }}>
                    {stripMd(String(interpretation.lifestyle))}
                  </p>
                </div>
              )}
              {hasSaju && interpretation?.future && (
                <div>
                  <p className="sec-meta" style={{ marginBottom: 4 }}>앞으로 며칠</p>
                  <p className="text-body-lg" style={{ color: 'var(--text-primary)' }}>
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
                  border: '0.5px solid rgba(201,169,110,0.22)',
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

      <FadeIn delay={0.48}>
        <section
          className="card-navy-v4"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(201,169,110,0.2)' }}
            >
              <Pictogram k="ui:lucky" size={22} color="#E8D5A8" />
            </div>
            <div>
              <p className="sec-title" style={{ color: '#F5EFE0' }}>사주 리포트 10섹션 종합</p>
              <p className="text-body-sm" style={{ color: 'rgba(245,239,224,0.7)', marginTop: 4 }}>
                오늘 꿈보다 10배 깊은 분석. 성격·대인·직업·재물·애정·건강까지.
              </p>
            </div>
          </div>
          <button className="cta-gold" onClick={onFullReport}>
            사주 리포트 받기 (500원)
          </button>
        </section>
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
  const gradeColor = GRADE_V4[grade] ?? '#A08B6A';
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

function LuckyColorCard({
  color,
  height,
}: {
  color: any;
  height?: number;
}) {
  const hex = typeof color?.hex === 'string' ? color.hex : '#C9A96E';
  const name = typeof color?.name === 'string' ? color.name : '골드';
  const reason = typeof color?.reason === 'string' ? stripMd(color.reason) : '';
  return (
    <Flippable
      height={height ?? 144}
      ariaLabel={`행운의 색 — ${name}`}
      front={
        <div
          style={{
            height: '100%',
            padding: 14,
            borderRadius: 14,
            background: '#FFFFFF',
            border: '0.5px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
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
          />
          <p className="sec-title" style={{ fontSize: 15 }}>{name}</p>
          <p className="sec-caption" style={{ fontSize: 10 }}>탭해서 이유 보기</p>
        </div>
      }
      back={
        <div
          style={{
            height: '100%',
            padding: 14,
            borderRadius: 14,
            background: 'var(--bg-cream)',
            border: '0.5px solid rgba(201,169,110,0.25)',
          }}
        >
          <p className="sec-meta" style={{ color: 'var(--brand-gold)', marginBottom: 6 }}>
            왜 이 색인가
          </p>
          <p className="text-body-sm" style={{ color: 'var(--text-primary)' }}>
            {reason || '이 색은 오늘 당신의 흐름과 가장 공명하는 기운입니다.'}
          </p>
        </div>
      }
    />
  );
}

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
    <Flippable
      height={144}
      ariaLabel={`${title} — ${value}`}
      front={
        <div
          style={{
            height: '100%',
            padding: 14,
            borderRadius: 14,
            background: '#FFFFFF',
            border: '0.5px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <p className="sec-meta" style={{ color: 'var(--brand-gold)' }}>{title}</p>
          <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>
            {value}
          </p>
          <p className="sec-caption" style={{ fontSize: 10, marginTop: 'auto' }}>
            탭해서 이유 보기
          </p>
        </div>
      }
      back={
        <div
          style={{
            height: '100%',
            padding: 14,
            borderRadius: 14,
            background: 'var(--bg-cream)',
            border: '0.5px solid rgba(201,169,110,0.25)',
          }}
        >
          <p className="sec-meta" style={{ color: 'var(--brand-gold)', marginBottom: 6 }}>
            {title}의 이유
          </p>
          <p className="text-body-sm" style={{ color: 'var(--text-primary)' }}>
            {reason || '사주와 오늘 흐름이 공명하는 지점입니다.'}
          </p>
        </div>
      }
    />
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
 * 주제 CTA 4카드 (IX-5)
 * ═════════════════════════════════════════════════════════════════ */
const DREAM_TOPIC_ITEMS: TopicItem[] = [
  { id: 'love', title: '연애·결혼', desc: '이 꿈이 애정운에 주는 신호', price: '1운 (500원)', color: '#E91E63' },
  { id: 'wealth', title: '재물·투자', desc: '재물 흐름과 기회의 방향', price: '1운 (500원)', color: '#C9A96E' },
  { id: 'career', title: '취업·커리어', desc: '일·성장의 리듬 분석', price: '1운 (500원)', color: '#1565C0' },
  { id: 'health', title: '건강·활력', desc: '컨디션과 체력의 포인트', price: '1운 (500원)', color: '#2D8A4E' },
];

