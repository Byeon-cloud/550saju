import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BannerAd } from '@/components/ads/BannerAd';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { usePageTitle } from '@/hooks/usePageTitle';
import { spendBalance } from '@/services/storage/localStore';
import { useToast } from '@/components/common/Toast';
import { stripMd } from '@/utils/format';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

const DREAM_CATEGORIES = [
  { id: 'animal', label: '동물이 나오는 꿈', icon: '獸', color: '#2D8A4E', examples: '뱀, 개, 고양이, 돼지, 호랑이', hot: true },
  { id: 'water', label: '물과 관련된 꿈', icon: '水', color: '#1565C0', examples: '바다, 강, 비, 홍수, 수영', hot: true },
  { id: 'death', label: '죽음 · 이별의 꿈', icon: '別', color: '#7B1FA2', examples: '누군가 죽는 꿈, 장례식, 이별' },
  { id: 'flying', label: '하늘을 나는 꿈', icon: '飛', color: '#0288D1', examples: '날기, 떨어지기, 높은 곳' },
  { id: 'money', label: '돈 · 재물의 꿈', icon: '財', color: '#C9A96E', examples: '돈 줍기, 복권, 금, 보석', hot: true },
  { id: 'people', label: '사람이 나오는 꿈', icon: '人', color: '#E91E63', examples: '가족, 연인, 낯선 사람, 유명인' },
  { id: 'chase', label: '쫓기는 꿈', icon: '逃', color: '#D32F2F', examples: '쫓기기, 도망, 숨기, 위험' },
  { id: 'nature', label: '자연 · 날씨 꿈', icon: '山', color: '#F57F17', examples: '꽃, 산, 불, 지진, 눈' },
  { id: 'other', label: '직접 적을게요', icon: '筆', color: '#4A5568', examples: '위 항목에 없는 꿈을 자유롭게' },
];

const OHENG_COLORS: Record<string, string> = { 목: '#2D8A4E', 화: '#D32F2F', 토: '#F57F17', 금: '#757575', 수: '#1565C0' };
const OHENG_ICONS: Record<string, string> = { 목: '🌿', 화: '🔥', 토: '⛰️', 금: '✨', 수: '💧' };
const GRADE_COLORS: Record<string, string> = { S: '#C9A96E', A: '#2D8A4E', B: '#1565C0', C: '#F57F17', D: '#D32F2F' };

type Phase = 'category' | 'detail' | 'result' | 'deepLoading' | 'deepResult';

export function DreamPage() {
  usePageTitle('꿈해몽');
  const navigate = useNavigate();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('category');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dreamText, setDreamText] = useState('');
  const [concern, setConcern] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [aiResult, setAiResult] = useState<any>(null);
  const [deepResult, setDeepResult] = useState<any>(null);
  const [apiError, setApiError] = useState('');
  // 더블클릭 가드 — 무료 해몽 + 심층 해몽 분리
  const isAnalyzingRef = useRef(false);
  const isDeepAnalyzingRef = useRef(false);

  function selectCategory(id: string) {
    setSelectedCategory(id);
    setTimeout(() => setPhase('detail'), 300);
  }

  // 무료 해몽 분석
  async function analyze() {
    // 더블클릭 가드 — 무료여도 토큰 리소스 보호
    if (isAnalyzingRef.current || isLoading) return;
    isAnalyzingRef.current = true;

    setIsLoading(true);
    setApiError('');
    try {
      const { generateDream } = await import('@/services/ai/reportGenerator');
      const { getReports: fetchReports } = await import('@/services/storage/localStore');
      const latestReport = fetchReports().find((r: any) => !r.input?.relation || r.input.relation === '본인') || null;
      const categoryLabel = DREAM_CATEGORIES.find(c => c.id === selectedCategory)?.label || '기타';
      const fullText = [dreamText, concern ? `\n현재 고민: ${concern}` : ''].filter(Boolean).join('');
      const result = await generateDream(categoryLabel, fullText, latestReport?.sajuData);
      setAiResult(result);
      try {
        const { saveReport, generateId, getReports: fetchRpts } = await import('@/services/storage/localStore');
        const latestRpt = fetchRpts().find((r: any) => !r.input?.relation || r.input.relation === '본인') || null;
        saveReport({ id: generateId(), name: latestRpt?.name || '꿈해몽', input: latestRpt?.input || {} as any, sajuData: latestRpt?.sajuData || {} as any, type: 'free', contentType: 'dream', createdAt: new Date().toISOString() });
      } catch { /* 무시 */ }
    } catch (e: any) {
      console.error('[DreamPage] API 실패:', e);
      setApiError(e?.message || 'AI 서버 연결에 실패했어요');
      setAiResult(null);
    } finally {
      setIsLoading(false);
      setPhase('result');
      isAnalyzingRef.current = false;
    }
  }

  // 유료 심층 해몽 분석 (1운)
  async function startDeepAnalysis() {
    // 더블클릭 가드 — 1운 중복 차감 차단
    if (isDeepAnalyzingRef.current) return;
    isDeepAnalyzingRef.current = true;

    const { getReports: fetchReports } = await import('@/services/storage/localStore');
    const myReport = fetchReports().find((r: any) => !r.input?.relation || r.input.relation === '본인');
    if (!myReport?.sajuData) {
      toast.show('먼저 사주를 분석해주세요', 'warning');
      navigate('/input');
      isDeepAnalyzingRef.current = false;
      return;
    }
    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '심층 해몽에 1운이 필요해요' } });
      isDeepAnalyzingRef.current = false;
      return;
    }
    toast.show('1운이 차감됐어요', 'info');
    setPhase('deepLoading');

    try {
      const { generateDeepDream } = await import('@/services/ai/reportGenerator');
      const categoryLabel = DREAM_CATEGORIES.find(c => c.id === selectedCategory)?.label || '기타';
      const fullText = [dreamText, concern ? `\n현재 고민: ${concern}` : ''].filter(Boolean).join('');
      const result = await generateDeepDream(categoryLabel, fullText, myReport.sajuData);
      setDeepResult(result);
      // 보관함 저장
      try {
        const { saveReport, generateId } = await import('@/services/storage/localStore');
        saveReport({ id: generateId(), name: myReport.name || '심층 해몽', input: myReport.input, sajuData: myReport.sajuData, type: 'paid', contentType: 'deepDream', aiResult: result, createdAt: new Date().toISOString() });
      } catch { /* 무시 */ }
      setPhase('deepResult');
    } catch (e: any) {
      console.error('[DreamPage:deep] API 실패:', e);
      // 환불은 서버(Cloud Function) 트랜잭션 롤백에 위임 — 클라이언트 직접 환불 금지 (보안)
      toast.show('분석에 실패했어요. 잔액은 자동으로 복구돼요.', 'warning');
      setPhase('result');
    } finally {
      isDeepAnalyzingRef.current = false;
    }
  }

  const dreamResult = aiResult;

  function reset() {
    setPhase('category');
    setSelectedCategory(null);
    setDreamText('');
    setConcern('');
    setDeepResult(null);
    setAiResult(null);
  }

  // circumference for score ring
  const CIRC = 2 * Math.PI * 52;

  return (
    <div className="min-h-screen bg-bg-page">
      <Header title="꿈해몽" />

      <div className="px-5 pt-4 pb-[120px]">
        <AnimatePresence mode="wait">

          {/* ====== Phase 1: 카테고리 선택 ====== */}
          {phase === 'category' && (
            <motion.div key="category" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <FadeIn>
                <div className="card-navy py-6 px-5 mb-5 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-[0.05]"
                    style={{ background: 'radial-gradient(circle, #C9A96E, transparent 70%)' }} />
                  <p className="text-[10px] text-white/30 mb-2">꿈해몽</p>
                  <h2 className="text-display text-white leading-snug">간밤에 어떤 꿈을{'\n'}꾸셨나요?</h2>
                  <p className="text-body-sm text-white/45 mt-2">
                    가장 가까운 항목을 선택하거나,{'\n'}직접 적어주시면 해석해드릴게요.
                  </p>
                </div>
              </FadeIn>
              <div className="space-y-2">
                {DREAM_CATEGORIES.map((cat, i) => (
                  <motion.button key={cat.id} whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    onClick={() => selectCategory(cat.id)}
                    className={`card w-full text-left py-4 px-4 transition-all ${selectedCategory === cat.id ? 'border-2 border-brand-gold shadow-glow' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}12` }}>
                        <span className="text-[15px] font-black" style={{ color: cat.color }}>{cat.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-h3 text-text-primary">{cat.label}</p>
                          {cat.hot && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold text-func-danger bg-func-danger/10">HOT</span>}
                        </div>
                        <p className="text-caption text-text-hint mt-0.5">{cat.examples}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ====== Phase 2: 상세 입력 ====== */}
          {phase === 'detail' && (
            <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <FadeIn>
                {selectedCategory && selectedCategory !== 'other' && (() => {
                  const cat = DREAM_CATEGORIES.find(c => c.id === selectedCategory);
                  return cat ? (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}15` }}>
                        <span className="text-[13px] font-black" style={{ color: cat.color }}>{cat.icon}</span>
                      </div>
                      <span className="text-caption font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                      <button onClick={() => setPhase('category')} className="ml-auto text-caption text-text-hint">변경</button>
                    </div>
                  ) : null;
                })()}
                <h2 className="text-display text-text-primary">꿈의 내용을{'\n'}자유롭게 적어주세요</h2>
                <p className="text-body text-text-muted mt-3 leading-relaxed">
                  더 자세히 적을수록 정확한 해몽이 가능해요.{'\n'}건너뛰고 바로 결과를 볼 수도 있어요.
                </p>
              </FadeIn>
              <div className="space-y-5">
                <div>
                  <p className="text-h3 text-text-primary mb-3">꿈 내용</p>
                  <textarea value={dreamText} onChange={(e) => setDreamText(e.target.value)}
                    placeholder="예: 큰 뱀이 집 안으로 들어와서 소파 위에 또아리를 틀고 있었는데, 무섭지는 않았어요..."
                    maxLength={300} className="input-field w-full !h-32 !rounded-2xl resize-none text-body" style={{ paddingTop: 16, paddingBottom: 16 }} />
                  <p className="text-right text-caption text-text-hint mt-1">{dreamText.length}/300</p>
                </div>
                <div>
                  <p className="text-h3 text-text-primary mb-2">요즘 머릿속에서 떠나지 않는 게 있다면</p>
                  <p className="text-body-sm text-text-muted mb-3 leading-relaxed">
                    걱정되는 일, 고민, 최근 겪은 사건 등을 적어주시면{'\n'}꿈과 연결해서 더 정확하게 해석해드려요.
                  </p>
                  <textarea value={concern} onChange={(e) => setConcern(e.target.value)}
                    placeholder="예: 이직을 고민하고 있어요 / 연인과 다퉜어요 / 시험을 앞두고 있어요..."
                    maxLength={200} className="input-field w-full !h-28 !rounded-2xl resize-none text-body" style={{ paddingTop: 16, paddingBottom: 16 }} />
                  <p className="text-right text-caption text-text-hint mt-1">{concern.length}/200</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ====== 무료 결과: API 실패 ====== */}
          {phase === 'result' && !isLoading && !dreamResult && (
            <motion.div key="error" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="card-navy py-8 px-5 text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(211,47,47,0.15)' }}>
                  <span style={{ fontSize: 28 }}>😔</span>
                </div>
                <p className="text-h2 text-white">해석에 실패했어요</p>
                <p className="text-body-sm text-white/50 mt-2 leading-relaxed">AI 서버가 일시적으로 바빠요.{'\n'}잠시 후 다시 시도해주세요.</p>
                {apiError && <p className="text-[10px] text-white/25 mt-3 font-mono">{apiError}</p>}
              </div>
              <div className="flex gap-2">
                <Button fullWidth size="lg" variant="gold" onClick={() => { setPhase('detail'); setApiError(''); }}>다시 시도하기</Button>
                <button onClick={() => { setPhase('category'); setSelectedCategory(null); setDreamText(''); setApiError(''); }}
                  className="flex-shrink-0 px-5 py-3.5 rounded-xl text-body-sm font-semibold text-text-muted bg-bg-surface">처음부터</button>
              </div>
            </motion.div>
          )}

          {/* ====== 무료 결과 ====== */}
          {phase === 'result' && !isLoading && dreamResult && (
            <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* 헤더 + 판정 */}
              <FadeIn>
                <div className="card-navy py-6 px-5">
                  <p className="text-label text-white/40">꿈해몽 결과</p>
                  <h2 className="text-h1 text-white mt-1">{dreamResult.title}</h2>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="badge-gold text-tiny">{dreamResult.category}</span>
                  </div>
                  {(dreamResult as any).verdict && (
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                      <p className="text-body-sm text-white/80 font-semibold">{stripMd((dreamResult as any).verdict)}</p>
                      {(dreamResult as any).verdictScore != null && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <div className="h-full rounded-full" style={{
                              width: `${(dreamResult as any).verdictScore}%`,
                              background: (dreamResult as any).verdictScore >= 70 ? '#C9A96E' : (dreamResult as any).verdictScore >= 40 ? '#A8B1C1' : '#FF6B6B',
                            }} />
                          </div>
                          <span className="text-[11px] font-bold text-brand-gold-light">{(dreamResult as any).verdictScore}점</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </FadeIn>

              {/* 꿈 상징 카드 */}
              {(dreamResult as any).symbols?.length > 0 && (
                <FadeIn delay={0.04}>
                  <div className="card">
                    <p className="text-h3 text-text-primary mb-3">꿈 속 핵심 상징</p>
                    <div className="space-y-2">
                      {(dreamResult as any).symbols.map((sym: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
                          <span style={{ fontSize: 20 }}>{OHENG_ICONS[sym.oheng] || '🔮'}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-label font-bold text-text-primary">{sym.keyword}</span>
                              <span className="text-[9px] text-text-hint px-1.5 py-0.5 rounded bg-bg-surface">{sym.oheng}</span>
                            </div>
                            <p className="text-caption text-text-secondary mt-0.5">{stripMd(sym.meaning)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 해석 */}
              <FadeIn delay={0.06}>
                <div className="card">
                  <p className="text-h3 text-text-primary mb-3">상세 해석</p>
                  <p className="text-body-sm text-text-secondary leading-[1.8] whitespace-pre-line">{stripMd(dreamResult.interpretation)}</p>
                </div>
              </FadeIn>

              {/* 행동 조언 */}
              <FadeIn delay={0.1}>
                <div className="card-gold">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 18 }}>🍀</span>
                    <p className="text-h3 text-text-primary">오늘의 행동 조언</p>
                  </div>
                  <p className="text-body-sm text-text-primary leading-relaxed font-medium">{stripMd(dreamResult.luckyAction)}</p>
                </div>
              </FadeIn>

              {/* 고민 연결 */}
              {concern && (
                <FadeIn delay={0.12}>
                  <div className="card">
                    <p className="text-h3 text-text-primary mb-2">현재 고민과의 연결</p>
                    <p className="text-body-sm text-text-secondary leading-relaxed">
                      적어주신 고민과 이 꿈을 연결해보면, 무의식이 현재 상황에 대한 신호를 보내고 있을 가능성이 높아요.
                      꿈에서 느꼈던 감정이 현실의 감정과 연결되어 있다면, 그 감정에 솔직해지는 것이 첫 번째 단계예요.
                    </p>
                  </div>
                </FadeIn>
              )}

              {/* 심층 해몽 CTA */}
              <FadeIn delay={0.15}>
                <div className="card-gold">
                  <p className="text-h3 text-text-primary">내 사주와 연계해서 더 깊게 해석받기</p>
                  <p className="text-body-sm text-text-muted mt-1 leading-relaxed">
                    같은 꿈이라도 사주의 오행 분포에 따라 해석이 완전히 달라져요.{'\n'}
                    레이더 차트, 오행 매핑, 럭키 프로필까지 포함된 프리미엄 분석을 받아보세요.
                  </p>
                  <Button variant="gold" fullWidth size="lg" className="mt-3" onClick={startDeepAnalysis}>
                    사주 연계 심층 해몽 (1운)
                  </Button>
                </div>
              </FadeIn>

              <BannerAd className="mt-3" />
              <button onClick={reset} className="w-full text-center text-caption text-text-muted mt-2">다른 꿈 해몽하기</button>
            </motion.div>
          )}

          {/* ====== 무료 로딩 ====== */}
          {isLoading && (
            <AILoading type="꿈해몽" steps={['꿈의 상징을 분석하고 있어요', '명리학과 연결하고 있어요', '맞춤 해몽을 작성하고 있어요']} />
          )}

          {/* ====== 심층 해몽 로딩 ====== */}
          {phase === 'deepLoading' && (
            <AILoading type="사주 연계 심층 해몽" steps={['꿈 상징을 오행으로 분류하고 있어요', '사주 원국과 교차 분석 중...', '5축 점수를 계산하고 있어요', '오행 메시지를 해석하고 있어요']} />
          )}

          {/* ====== 심층 해몽 결과 (프리미엄 UI) ====== */}
          {phase === 'deepResult' && deepResult && (
            <motion.div key="deepResult" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

              {/* 헤더: 점수 링 + 등급 뱃지 */}
              <FadeIn>
                <div className="card py-6 px-5 text-center" style={{ borderTop: `3px solid ${GRADE_COLORS[deepResult.grade] || '#C9A96E'}` }}>
                  <p className="text-caption text-text-muted mb-1">사주 연계 심층 해몽</p>
                  <h2 className="text-h1 text-text-primary">{deepResult.title}</h2>

                  {/* 점수 링 */}
                  <div className="relative w-28 h-28 mx-auto mt-4">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="#E8E0D4" strokeWidth="8" />
                      <motion.circle cx="60" cy="60" r="52" fill="none"
                        stroke={GRADE_COLORS[deepResult.grade] || '#C9A96E'} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={CIRC}
                        initial={{ strokeDashoffset: CIRC }}
                        animate={{ strokeDashoffset: CIRC * (1 - (deepResult.overallScore || 0) / 100) }}
                        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[28px] font-black" style={{ color: GRADE_COLORS[deepResult.grade] || '#C9A96E' }}>{deepResult.overallScore}</span>
                      <span className="text-[10px] text-text-muted">점</span>
                    </div>
                  </div>

                  {/* 등급 + 판정 */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className="text-[13px] font-black px-3 py-1 rounded-full text-white"
                      style={{ background: GRADE_COLORS[deepResult.grade] || '#C9A96E' }}>
                      {deepResult.grade}등급
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(201,169,110,0.1)', color: '#A08B6A', border: '1px solid rgba(201,169,110,0.2)' }}>
                      {deepResult.category}
                    </span>
                  </div>
                  {deepResult.verdict && (
                    <p className="text-body-sm text-text-secondary mt-3 font-medium">{stripMd(deepResult.verdict)}</p>
                  )}
                </div>
              </FadeIn>

              {/* 키워드 태그 */}
              {deepResult.keywords?.length > 0 && (
                <FadeIn delay={0.03}>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {deepResult.keywords.map((kw: string, i: number) => (
                      <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(201,169,110,0.1)', color: '#A08B6A', border: '1px solid rgba(201,169,110,0.2)' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </FadeIn>
              )}

              {/* 5축 레이더 차트 */}
              {deepResult.subScores && (
                <FadeIn delay={0.06}>
                  <div className="card">
                    <p className="text-h3 text-text-primary mb-1">꿈이 보내는 신호</p>
                    <p className="text-caption text-text-hint mb-3">5가지 운세 영역별 신호 강도</p>
                    <div className="h-52 -mx-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={[
                          { name: '재물운', score: deepResult.subScores.재물운 || 0 },
                          { name: '애정운', score: deepResult.subScores.애정운 || 0 },
                          { name: '건강운', score: deepResult.subScores.건강운 || 0 },
                          { name: '성장운', score: deepResult.subScores.성장운 || 0 },
                          { name: '경고신호', score: deepResult.subScores.경고신호 || 0 },
                        ]}>
                          <PolarGrid strokeOpacity={0.15} />
                          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                          <Radar dataKey="score" stroke="#C9A96E" fill="#C9A96E" fillOpacity={0.2} strokeWidth={2}
                            dot={{ r: 3, fill: '#C9A96E', strokeWidth: 0 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* 점수 범례 */}
                    <div className="grid grid-cols-5 gap-1 mt-2">
                      {Object.entries(deepResult.subScores).map(([k, v]) => (
                        <div key={k} className="text-center">
                          <p className="text-[13px] font-black text-brand-gold">{v as number}</p>
                          <p className="text-[9px] text-text-hint">{k}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 꿈 속 상징 → 오행 매핑 */}
              {deepResult.symbols?.length > 0 && (
                <FadeIn delay={0.1}>
                  <div className="card">
                    <p className="text-h3 text-text-primary mb-3">꿈 속 상징 × 오행 분석</p>
                    <div className="space-y-2.5">
                      {deepResult.symbols.map((sym: any, i: number) => (
                        <motion.div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                          style={{ background: `${OHENG_COLORS[sym.oheng] || '#C9A96E'}08`, border: `1px solid ${OHENG_COLORS[sym.oheng] || '#C9A96E'}20` }}
                          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${OHENG_COLORS[sym.oheng] || '#C9A96E'}15` }}>
                            <span style={{ fontSize: 20 }}>{OHENG_ICONS[sym.oheng] || '🔮'}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-label font-bold text-text-primary">{sym.keyword}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                style={{ background: OHENG_COLORS[sym.oheng] || '#999' }}>{sym.oheng}(五行)</span>
                            </div>
                            <p className="text-caption text-text-secondary mt-1 leading-relaxed">{stripMd(sym.meaning)}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 사주 연결 분석 — 핵심 차별화 */}
              {deepResult.sajuConnection && (
                <FadeIn delay={0.15}>
                  <div className="card py-5 px-5" style={{ borderLeft: '4px solid #C9A96E', background: 'rgba(201,169,110,0.04)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[13px] font-black text-brand-gold">命</span>
                      <p className="text-h3 text-text-primary">사주 원국 × 꿈 연결 분석</p>
                    </div>
                    <p className="text-body-sm text-text-secondary leading-[1.8] whitespace-pre-line">{stripMd(deepResult.sajuConnection)}</p>
                  </div>
                </FadeIn>
              )}

              {/* 오행 메시지 */}
              {deepResult.ohengMessage && (
                <FadeIn delay={0.18}>
                  <div className="card py-4 px-5" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(201,169,110,0.2)' }}>
                    <p className="text-caption text-brand-gold font-semibold mb-1">오행이 보내는 메시지</p>
                    <p className="text-body-sm text-text-primary leading-relaxed font-medium">{stripMd(deepResult.ohengMessage)}</p>
                  </div>
                </FadeIn>
              )}

              {/* 상세 해석 */}
              <FadeIn delay={0.2}>
                <div className="card">
                  <p className="text-h3 text-text-primary mb-3">심층 해석</p>
                  <p className="text-body-sm text-text-secondary leading-[1.8] whitespace-pre-line">{stripMd(deepResult.interpretation)}</p>
                </div>
              </FadeIn>

              {/* 앞으로의 전망 */}
              {deepResult.timeline && (
                <FadeIn delay={0.25}>
                  <div className="card py-5 px-5" style={{ borderLeft: '4px solid #7B1FA2' }}>
                    <p className="text-h3 text-text-primary mb-2">앞으로의 전망</p>
                    <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{stripMd(deepResult.timeline)}</p>
                  </div>
                </FadeIn>
              )}

              {/* 럭키 프로필 */}
              {deepResult.luckyProfile && (
                <FadeIn delay={0.28}>
                  <div className="card">
                    <p className="text-h3 text-text-primary mb-3">행운 프로필</p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* 색상 */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-surface">
                        <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: deepResult.luckyProfile.colorHex || '#C9A96E' }} />
                        <div>
                          <p className="text-[9px] text-text-hint">행운의 색</p>
                          <p className="text-label font-bold text-text-primary">{deepResult.luckyProfile.color}</p>
                        </div>
                      </div>
                      {/* 숫자 */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-surface">
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.1)' }}>
                          <span className="text-[14px] font-black text-brand-gold">{deepResult.luckyProfile.number}</span>
                        </div>
                        <div>
                          <p className="text-[9px] text-text-hint">행운의 숫자</p>
                          <p className="text-label font-bold text-text-primary">{deepResult.luckyProfile.number}</p>
                        </div>
                      </div>
                      {/* 방위 */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-surface">
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(21,101,192,0.1)' }}>
                          <span className="text-[14px]">🧭</span>
                        </div>
                        <div>
                          <p className="text-[9px] text-text-hint">행운의 방위</p>
                          <p className="text-label font-bold text-text-primary">{deepResult.luckyProfile.direction}</p>
                        </div>
                      </div>
                      {/* 보충 오행 */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-surface">
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                          style={{ background: `${OHENG_COLORS[deepResult.luckyProfile.element] || '#C9A96E'}15` }}>
                          <span style={{ fontSize: 18 }}>{OHENG_ICONS[deepResult.luckyProfile.element] || '🔮'}</span>
                        </div>
                        <div>
                          <p className="text-[9px] text-text-hint">보충 오행</p>
                          <p className="text-label font-bold text-text-primary">{deepResult.luckyProfile.element}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 행동 조언 */}
              <FadeIn delay={0.3}>
                <div className="card-gold">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 18 }}>🍀</span>
                    <p className="text-h3 text-text-primary">사주 기반 행동 조언</p>
                  </div>
                  <p className="text-body-sm text-text-primary leading-relaxed font-medium">{stripMd(deepResult.luckyAction)}</p>
                </div>
              </FadeIn>

              {/* CTA */}
              <FadeIn delay={0.35}>
                <div className="space-y-3">
                  <Button onClick={reset} variant="gold" size="lg" fullWidth>다른 꿈 해몽하기</Button>
                  <Button onClick={() => navigate('/')} variant="secondary" size="lg" fullWidth>홈으로</Button>
                </div>
              </FadeIn>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {phase === 'detail' && (
        <div className="sticky-cta-bottom">
          <Button fullWidth size="lg" onClick={analyze}>해몽 결과 보기</Button>
        </div>
      )}
    </div>
  );
}
