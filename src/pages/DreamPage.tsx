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
import { Pictogram, type DreamCategory, type PictogramKey } from '@/components/brand/PictogramRegistry';

/**
 * 꿈 카테고리 — 이모지 제거, 브랜드 픽토그램으로 대체.
 * id는 PictogramRegistry의 dream:* key와 1:1 매핑.
 * 브랜드픽토그램_시스템.md 참조.
 */
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

const OHENG_COLORS: Record<string, string> = { 목: '#2D8A4E', 화: '#D32F2F', 토: '#F57F17', 금: '#757575', 수: '#1565C0' };
/** 한글 오행 → 픽토그램 key (음영/형태 일관성 유지) */
const OHENG_PICTOGRAM_KEY: Record<string, PictogramKey> = {
  목: 'oheng:wood',
  화: 'oheng:fire',
  토: 'oheng:earth',
  금: 'oheng:metal',
  수: 'oheng:water',
};
// 브랜드 컬러 (Deep Navy + Gold) — 오행 원색 금지
const GRADE_COLORS: Record<string, string> = { S: '#C9A96E', A: '#A08B6A', B: '#2D4470', C: '#8F6B4E', D: '#8F1F1C' };

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
      const { getProfiles } = await import('@/services/storage/localStore');
      const latestReport = getProfiles().find((p: any) => !p.relation || p.relation === '본인') || null;
      const categoryLabel = DREAM_CATEGORIES.find(c => c.id === selectedCategory)?.label || '기타';
      const fullText = [dreamText, concern ? `\n현재 고민: ${concern}` : ''].filter(Boolean).join('');
      const result = await generateDream(categoryLabel, fullText, latestReport?.sajuData);
      setAiResult(result);
      try {
        const { saveReport, generateId, getProfiles: fetchProfiles } = await import('@/services/storage/localStore');
        const latestRpt = fetchProfiles().find((p: any) => !p.relation || p.relation === '본인') || null;
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

    const { getProfiles } = await import('@/services/storage/localStore');
    const myReport = getProfiles().find((p: any) => !p.relation || p.relation === '본인');
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
    <div className="min-h-screen bg-hanji">
      <Header title="꿈해몽" />

      <div className="px-5 pt-6 pb-[120px] relative">
        <AnimatePresence mode="wait">

          {/* ====== Phase 1: 카테고리 선택 ====== */}
          {phase === 'category' && (
            <motion.div key="category" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <FadeIn>
                <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
                  꿈해몽
                </p>
                <h2 className="text-editorial-display mt-2" style={{ color: 'var(--ink-black)', fontSize: 30 }}>
                  간밤에 어떤 꿈을<br/>꾸셨나요
                </h2>
                <div className="gold-hairline !my-4">
                  <span className="gold-hairline-symbol">◇</span>
                </div>
                <p className="font-serif-ko text-[14px] leading-[1.85]" style={{ color: 'var(--ink-muted)' }}>
                  가장 가까운 항목을 선택하거나,<br/>직접 적어주시면 해석해드릴게요.
                </p>
              </FadeIn>

              <div className="gold-hairline !my-5">
                <span className="gold-hairline-symbol">꿈의 분류</span>
              </div>

              <div className="space-y-2">
                {DREAM_CATEGORIES.map((cat, i) => (
                  <motion.button key={cat.id} whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    onClick={() => selectCategory(cat.id)}
                    className="w-full text-left py-4 px-4 transition-all relative"
                    style={{
                      background: selectedCategory === cat.id ? 'var(--hanji-cream-deep)' : 'var(--hanji-cream-soft)',
                      border: selectedCategory === cat.id
                        ? `1.5px solid ${cat.color}`
                        : '1px solid rgba(165,155,141,0.2)',
                      borderRadius: '3px',
                      boxShadow: selectedCategory === cat.id ? `0 2px 12px ${cat.color}20` : 'none'
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 flex items-center justify-center flex-shrink-0"
                        style={{ background: `${cat.color}10`, borderRadius: '3px', border: `0.5px solid ${cat.color}30` }}>
                        <Pictogram k={`dream:${cat.id}`} size={22} color={cat.color} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-editorial-h2" style={{ color: 'var(--ink-black)', fontSize: 15 }}>{cat.label}</p>
                          {cat.hot && (
                            <span className="px-1.5 py-0.5 font-serif-ko text-[9px] font-bold text-white"
                              style={{ background: 'var(--seal-red)', borderRadius: '2px', letterSpacing: '0.1em' }}>
                              인기
                            </span>
                          )}
                        </div>
                        <p className="text-caption mt-0.5 font-serif-ko" style={{ color: 'var(--ink-muted)' }}>{cat.examples}</p>
                      </div>
                      <span className="font-serif-ko text-[16px]" style={{ color: cat.color, opacity: 0.6 }}>›</span>
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
                    <div className="flex items-center gap-2 mb-5 py-2.5 px-3"
                      style={{ background: `${cat.color}08`, borderLeft: `2px solid ${cat.color}`, borderRadius: '2px' }}>
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                        style={{ background: `${cat.color}15`, borderRadius: '2px' }}>
                        <Pictogram k={`dream:${cat.id}`} size={18} color={cat.color} />
                      </div>
                      <span className="font-serif-ko text-[13px] font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                      <button onClick={() => setPhase('category')}
                        className="ml-auto text-caption font-serif-ko"
                        style={{ color: 'var(--ink-muted)' }}>변경</button>
                    </div>
                  ) : null;
                })()}

                <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
                  꿈 내용
                </p>
                <h2 className="text-editorial-display mt-2" style={{ color: 'var(--ink-black)' }}>
                  꿈의 내용을<br/>자유롭게 적어주세요
                </h2>
                <div className="gold-hairline !my-4">
                  <span className="gold-hairline-symbol">◇</span>
                </div>
                <p className="font-serif-ko text-[14px] leading-[1.85]" style={{ color: 'var(--ink-muted)' }}>
                  더 자세히 적을수록 정확한 해몽이 가능해요.<br/>건너뛰고 바로 결과를 볼 수도 있어요.
                </p>
              </FadeIn>

              <div className="space-y-5">
                <div>
                  <p className="font-serif-ko text-[14px] font-semibold mb-2" style={{ color: 'var(--ink-black)' }}>
                    꿈 내용
                  </p>
                  <textarea value={dreamText} onChange={(e) => setDreamText(e.target.value)}
                    placeholder="예: 큰 뱀이 집 안으로 들어와서 소파 위에 또아리를 틀고 있었는데, 무섭지는 않았어요..."
                    maxLength={300}
                    className="w-full font-serif-ko resize-none text-[14px] leading-[1.85]"
                    style={{
                      padding: '16px',
                      minHeight: 128,
                      background: 'var(--hanji-cream-soft)',
                      border: '1px solid rgba(165,155,141,0.25)',
                      borderRadius: '3px',
                      color: 'var(--ink-soft)',
                      outline: 'none'
                    }} />
                  <p className="text-right text-[11px] mt-1 font-serif-ko" style={{ color: 'var(--ink-faint)' }}>{dreamText.length}/300</p>
                </div>
                <div>
                  <p className="font-serif-ko text-[14px] font-semibold mb-1" style={{ color: 'var(--ink-black)' }}>
                    요즘 머릿속에서 떠나지 않는 게 있다면
                  </p>
                  <p className="font-serif-ko text-[12px] leading-[1.7] mb-2" style={{ color: 'var(--ink-muted)' }}>
                    걱정되는 일, 고민, 최근 겪은 사건 등을 적어주시면<br/>꿈과 연결해서 더 정확하게 해석해드려요.
                  </p>
                  <textarea value={concern} onChange={(e) => setConcern(e.target.value)}
                    placeholder="예: 이직을 고민하고 있어요 / 연인과 다퉜어요 / 시험을 앞두고 있어요..."
                    maxLength={200}
                    className="w-full font-serif-ko resize-none text-[14px] leading-[1.85]"
                    style={{
                      padding: '16px',
                      minHeight: 112,
                      background: 'var(--hanji-cream-soft)',
                      border: '1px solid rgba(165,155,141,0.25)',
                      borderRadius: '3px',
                      color: 'var(--ink-soft)',
                      outline: 'none'
                    }} />
                  <p className="text-right text-[11px] mt-1 font-serif-ko" style={{ color: 'var(--ink-faint)' }}>{concern.length}/200</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ====== 무료 결과: API 실패 ====== */}
          {phase === 'result' && !isLoading && !dreamResult && (
            <motion.div key="error" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="card-editorial !py-10 text-center">
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'rgba(184,50,45,0.08)', borderRadius: '50%', border: '1px solid rgba(184,50,45,0.2)' }}>
                  <Pictogram k="dream:empty" size={32} color="#B8322D" />
                </div>
                <p className="font-serif-ko text-[22px] font-semibold" style={{ color: 'var(--ink-black)' }}>해석에 실패했어요</p>
                <p className="font-serif-ko text-[13px] mt-2 leading-[1.85]" style={{ color: 'var(--ink-muted)' }}>
                  AI 서버가 일시적으로 바빠요.<br/>잠시 후 다시 시도해주세요.
                </p>
                {apiError && <p className="text-[10px] mt-3 font-mono" style={{ color: 'var(--ink-faint)' }}>{apiError}</p>}
              </div>
              <div className="flex gap-2">
                <Button fullWidth size="lg" variant="gold" onClick={() => { setPhase('detail'); setApiError(''); }}>다시 시도하기</Button>
                <button onClick={() => { setPhase('category'); setSelectedCategory(null); setDreamText(''); setApiError(''); }}
                  className="flex-shrink-0 px-5 py-3.5 font-serif-ko text-[13px] font-semibold"
                  style={{ color: 'var(--ink-muted)', background: 'rgba(165,155,141,0.08)', borderRadius: '3px' }}>
                  처음부터
                </button>
              </div>
            </motion.div>
          )}

          {/* ====== 무료 결과 ====== */}
          {phase === 'result' && !isLoading && dreamResult && (
            <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* 헤더 + 판정 */}
              <FadeIn>
                <div className="card-editorial !py-8 !px-6 relative">
                  <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
                    오늘 밤 꿈 해석
                  </p>
                  <h2 className="font-serif-ko text-[24px] leading-[1.4] font-semibold mt-2"
                    style={{ color: 'var(--ink-black)', letterSpacing: '-0.02em' }}>
                    {dreamResult.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="font-serif-ko text-[11px] font-semibold px-2 py-1"
                      style={{
                        background: 'rgba(201,169,110,0.15)',
                        color: 'var(--brand-gold-light)',
                        border: '0.5px solid rgba(201,169,110,0.3)',
                        borderRadius: '2px',
                        letterSpacing: '0.05em'
                      }}>
                      {dreamResult.category}
                    </span>
                  </div>
                  {(dreamResult as any).verdict && (
                    <div className="mt-4 pt-3 flex items-center justify-between"
                      style={{ borderTop: '0.5px solid rgba(201,169,110,0.25)' }}>
                      <p className="font-serif-ko text-[13px] font-semibold italic" style={{ color: 'var(--ink-soft)' }}>
                        {stripMd((dreamResult as any).verdict)}
                      </p>
                      {(dreamResult as any).verdictScore != null && (
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                          <div className="w-20 h-[3px] overflow-hidden"
                            style={{ background: 'rgba(165,155,141,0.18)', borderRadius: '2px' }}>
                            <div className="h-full" style={{
                              width: `${(dreamResult as any).verdictScore}%`,
                              background: (dreamResult as any).verdictScore >= 70 ? '#C9A96E' : (dreamResult as any).verdictScore >= 40 ? '#A08B6A' : '#8F6B4E',
                              borderRadius: '2px'
                            }} />
                          </div>
                          <span className="font-serif-ko text-[12px] font-bold" style={{ color: 'var(--brand-gold)' }}>
                            {(dreamResult as any).verdictScore}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </FadeIn>

              {/* 꿈 상징 카드 */}
              {(dreamResult as any).symbols?.length > 0 && (
                <FadeIn delay={0.04}>
                  <div className="card-editorial">
                    <div className="gold-hairline !mt-0 !mb-4">
                      <span className="gold-hairline-symbol">꿈 속 핵심 상징</span>
                    </div>
                    <div className="space-y-2.5">
                      {(dreamResult as any).symbols.map((sym: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3"
                          style={{
                            background: `${OHENG_COLORS[sym.oheng] || '#C9A96E'}06`,
                            borderLeft: `2px solid ${OHENG_COLORS[sym.oheng] || '#C9A96E'}`,
                            borderRadius: '2px'
                          }}>
                          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                            style={{ background: `${OHENG_COLORS[sym.oheng] || '#C9A96E'}15`, borderRadius: '2px' }}>
                            <Pictogram k={OHENG_PICTOGRAM_KEY[sym.oheng] || 'ui:lucky'} size={20} color={OHENG_COLORS[sym.oheng] || '#C9A96E'} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-serif-ko text-[14px] font-semibold" style={{ color: 'var(--ink-black)' }}>{sym.keyword}</span>
                              <span className="font-serif-ko text-[9px] px-1.5 py-0.5"
                                style={{ color: 'var(--ink-faint)', background: 'rgba(165,155,141,0.12)', borderRadius: '2px' }}>
                                {sym.oheng}
                              </span>
                            </div>
                            <p className="text-caption mt-1 leading-[1.75]" style={{ color: 'var(--ink-muted)' }}>{stripMd(sym.meaning)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 해석 */}
              <FadeIn delay={0.06}>
                <div className="card-editorial">
                  <div className="gold-hairline !mt-0 !mb-4">
                    <span className="gold-hairline-symbol">상세 해석</span>
                  </div>
                  <p className="text-editorial-quote drop-cap whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>
                    {stripMd(dreamResult.interpretation)}
                  </p>
                </div>
              </FadeIn>

              {/* 행동 조언 */}
              <FadeIn delay={0.1}>
                <div className="relative py-6 px-6"
                  style={{
                    background: 'linear-gradient(135deg, rgba(201,169,110,0.08) 0%, rgba(253,248,238,0.6) 100%)',
                    borderLeft: '3px solid var(--brand-gold)',
                    borderRadius: '2px'
                  }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Pictogram k="ui:lucky" size={18} color="#C9A96E" />
                    <p className="font-serif-ko text-[14px] font-semibold" style={{ color: 'var(--brand-gold)', letterSpacing: '0.02em' }}>
                      오늘의 행동 조언
                    </p>
                  </div>
                  <p className="font-serif-ko text-[15px] leading-[1.85] font-medium" style={{ color: 'var(--ink-black)' }}>
                    {stripMd(dreamResult.luckyAction)}
                  </p>
                </div>
              </FadeIn>

              {/* 고민 연결 */}
              {concern && (
                <FadeIn delay={0.12}>
                  <div className="card-editorial">
                    <div className="gold-hairline !mt-0 !mb-4">
                      <span className="gold-hairline-symbol">현재 고민과의 연결</span>
                    </div>
                    <p className="font-serif-ko text-[14px] leading-[1.85]" style={{ color: 'var(--ink-soft)' }}>
                      적어주신 고민과 이 꿈을 연결해보면, 무의식이 현재 상황에 대한 신호를 보내고 있을 가능성이 높아요.
                      꿈에서 느꼈던 감정이 현실의 감정과 연결되어 있다면, 그 감정에 솔직해지는 것이 첫 번째 단계예요.
                    </p>
                  </div>
                </FadeIn>
              )}

              {/* 심층 해몽 CTA */}
              <FadeIn delay={0.15}>
                <div className="card-editorial !py-7 !px-6 relative"
                  style={{ background: 'linear-gradient(180deg, rgba(45,68,112,0.06) 0%, var(--hanji-cream-soft) 100%)' }}>
                  <p className="text-editorial-caption" style={{ color: 'var(--brand-navy, #2D4470)' }}>
                    사주 연계 심층 해몽
                  </p>
                  <p className="font-serif-ko text-[17px] font-semibold mt-2" style={{ color: 'var(--ink-black)' }}>
                    내 사주와 연계해서 더 깊게 해석받기
                  </p>
                  <p className="font-serif-ko text-[13px] mt-2 leading-[1.85]" style={{ color: 'var(--ink-muted)' }}>
                    같은 꿈이라도 사주의 오행 분포에 따라 해석이 완전히 달라져요.<br/>
                    레이더 차트, 오행 매핑, 럭키 프로필까지 포함된 프리미엄 분석.
                  </p>
                  <Button variant="gold" fullWidth size="lg" className="mt-4" onClick={startDeepAnalysis}>
                    사주 연계 심층 해몽 (1운)
                  </Button>
                </div>
              </FadeIn>

              <BannerAd className="mt-3" />
              <button onClick={reset}
                className="w-full text-center font-serif-ko text-[12px] mt-2"
                style={{ color: 'var(--ink-muted)', letterSpacing: '0.08em' }}>
                다른 꿈 해몽하기
              </button>
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

              {/* 헤더: 점수 링 + 등급 뱃지 — 편집자적 */}
              <FadeIn>
                <div className="card-editorial !py-8 text-center relative">
                  <p className="text-editorial-caption mt-1" style={{ color: 'var(--brand-gold)' }}>
                    심층 해몽 · 사주 연계
                  </p>
                  <h2 className="font-serif-ko text-[22px] font-semibold mt-2 leading-[1.4]"
                    style={{ color: 'var(--ink-black)', letterSpacing: '-0.02em' }}>
                    {deepResult.title}
                  </h2>

                  {/* 점수 링 */}
                  <div className="relative w-32 h-32 mx-auto mt-6">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(165,155,141,0.18)" strokeWidth="6" />
                      <circle cx="60" cy="60" r="56" fill="none" stroke={GRADE_COLORS[deepResult.grade] || '#C9A96E'}
                        strokeWidth="0.5" strokeDasharray="2 3" opacity="0.4" />
                      <motion.circle cx="60" cy="60" r="52" fill="none"
                        stroke={GRADE_COLORS[deepResult.grade] || '#C9A96E'} strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={CIRC}
                        initial={{ strokeDashoffset: CIRC }}
                        animate={{ strokeDashoffset: CIRC * (1 - (deepResult.overallScore || 0) / 100) }}
                        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-serif-ko font-black leading-none"
                        style={{ color: GRADE_COLORS[deepResult.grade] || '#C9A96E', fontSize: 38, letterSpacing: '-0.02em' }}>
                        {deepResult.overallScore}
                      </span>
                      <span className="font-serif-ko text-[10px] mt-1" style={{ color: 'var(--ink-faint)', letterSpacing: '0.15em' }}>
                        점
                      </span>
                    </div>
                  </div>

                  {/* 등급 + 판정 */}
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <span className="font-serif-ko text-[13px] font-bold px-3 py-1 text-white"
                      style={{ background: GRADE_COLORS[deepResult.grade] || '#C9A96E', borderRadius: '2px', letterSpacing: '0.08em' }}>
                      {deepResult.grade}등급
                    </span>
                    <span className="font-serif-ko text-[11px] font-semibold px-2.5 py-1"
                      style={{
                        background: 'rgba(201,169,110,0.08)',
                        color: 'var(--brand-gold)',
                        border: '0.5px solid rgba(201,169,110,0.3)',
                        borderRadius: '2px'
                      }}>
                      {deepResult.category}
                    </span>
                  </div>
                  {deepResult.verdict && (
                    <p className="font-serif-ko text-[14px] mt-4 font-medium italic leading-[1.7]"
                      style={{ color: 'var(--ink-soft)' }}>
                      「 {stripMd(deepResult.verdict)} 」
                    </p>
                  )}
                </div>
              </FadeIn>

              {/* 키워드 태그 */}
              {deepResult.keywords?.length > 0 && (
                <FadeIn delay={0.03}>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {deepResult.keywords.map((kw: string, i: number) => (
                      <span key={i} className="font-serif-ko text-[11px] font-semibold px-2.5 py-1"
                        style={{
                          background: 'var(--hanji-cream-deep)',
                          color: 'var(--brand-gold)',
                          border: '0.5px solid rgba(201,169,110,0.3)',
                          borderRadius: '2px'
                        }}>
                        # {kw}
                      </span>
                    ))}
                  </div>
                </FadeIn>
              )}

              {/* 5축 레이더 차트 */}
              {deepResult.subScores && (
                <FadeIn delay={0.06}>
                  <div className="card-editorial">
                    <div className="gold-hairline !mt-0 !mb-2">
                      <span className="gold-hairline-symbol">꿈이 보내는 신호</span>
                    </div>
                    <p className="text-caption font-serif-ko mb-3 text-center" style={{ color: 'var(--ink-faint)' }}>
                      5가지 운세 영역별 신호 강도
                    </p>
                    <div className="h-52 -mx-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={[
                          { name: '재물운', score: deepResult.subScores.재물운 || 0 },
                          { name: '애정운', score: deepResult.subScores.애정운 || 0 },
                          { name: '건강운', score: deepResult.subScores.건강운 || 0 },
                          { name: '성장운', score: deepResult.subScores.성장운 || 0 },
                          { name: '경고신호', score: deepResult.subScores.경고신호 || 0 },
                        ]}>
                          <PolarGrid strokeOpacity={0.15} stroke="#C9A96E" />
                          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#2E2A25', fontFamily: 'Noto Serif KR, serif' }} />
                          <Radar dataKey="score" stroke="#C9A96E" fill="#C9A96E" fillOpacity={0.22} strokeWidth={2}
                            dot={{ r: 3, fill: '#B8322D', strokeWidth: 0 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* 점수 범례 */}
                    <div className="grid grid-cols-5 gap-1 mt-3 pt-3"
                      style={{ borderTop: '0.5px solid rgba(201,169,110,0.2)' }}>
                      {Object.entries(deepResult.subScores).map(([k, v]) => (
                        <div key={k} className="text-center">
                          <p className="font-serif-ko text-[15px] font-black" style={{ color: 'var(--brand-gold)' }}>{v as number}</p>
                          <p className="font-serif-ko text-[9px] mt-0.5" style={{ color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>{k}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 꿈 속 상징 → 오행 매핑 */}
              {deepResult.symbols?.length > 0 && (
                <FadeIn delay={0.1}>
                  <div className="card-editorial">
                    <div className="gold-hairline !mt-0 !mb-4">
                      <span className="gold-hairline-symbol">꿈 속 상징 × 오행 분석</span>
                    </div>
                    <div className="space-y-2.5">
                      {deepResult.symbols.map((sym: any, i: number) => (
                        <motion.div key={i} className="flex items-start gap-3 p-3"
                          style={{
                            background: `${OHENG_COLORS[sym.oheng] || '#C9A96E'}06`,
                            borderLeft: `2px solid ${OHENG_COLORS[sym.oheng] || '#C9A96E'}`,
                            borderRadius: '2px'
                          }}
                          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}>
                          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                            style={{ background: `${OHENG_COLORS[sym.oheng] || '#C9A96E'}15`, borderRadius: '2px' }}>
                            <Pictogram k={OHENG_PICTOGRAM_KEY[sym.oheng] || 'ui:lucky'} size={22} color={OHENG_COLORS[sym.oheng] || '#C9A96E'} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-serif-ko text-[14px] font-semibold" style={{ color: 'var(--ink-black)' }}>{sym.keyword}</span>
                              <span className="font-serif-ko text-[9px] font-bold px-1.5 py-0.5 text-white"
                                style={{ background: OHENG_COLORS[sym.oheng] || '#999', borderRadius: '2px', letterSpacing: '0.05em' }}>
                                {sym.oheng}
                              </span>
                            </div>
                            <p className="font-serif-ko text-[13px] mt-1 leading-[1.75]" style={{ color: 'var(--ink-muted)' }}>
                              {stripMd(sym.meaning)}
                            </p>
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
                  <div className="relative py-6 px-6"
                    style={{
                      background: 'linear-gradient(135deg, rgba(201,169,110,0.06) 0%, var(--hanji-cream-soft) 100%)',
                      borderLeft: '3px solid var(--brand-gold)',
                      borderRadius: '2px'
                    }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand-gold)' }} />
                      <p className="font-serif-ko text-[15px] font-semibold" style={{ color: 'var(--ink-black)' }}>
                        사주 원국 × 꿈 연결 분석
                      </p>
                    </div>
                    <p className="font-serif-ko text-[14px] leading-[1.9] whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>
                      {stripMd(deepResult.sajuConnection)}
                    </p>
                  </div>
                </FadeIn>
              )}

              {/* 오행 메시지 */}
              {deepResult.ohengMessage && (
                <FadeIn delay={0.18}>
                  <div className="py-5 px-5 relative"
                    style={{
                      background: 'linear-gradient(135deg, var(--hanji-cream-deep) 0%, #E5D9BE 100%)',
                      border: '1px solid rgba(201,169,110,0.3)',
                      borderRadius: '2px'
                    }}>
                    <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
                      오행이 보내는 메시지
                    </p>
                    <p className="font-serif-ko text-[14px] leading-[1.85] font-medium mt-2" style={{ color: 'var(--ink-black)' }}>
                      {stripMd(deepResult.ohengMessage)}
                    </p>
                  </div>
                </FadeIn>
              )}

              {/* 상세 해석 */}
              <FadeIn delay={0.2}>
                <div className="card-editorial">
                  <div className="gold-hairline !mt-0 !mb-4">
                    <span className="gold-hairline-symbol">심층 해석</span>
                  </div>
                  <p className="text-editorial-quote drop-cap whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>
                    {stripMd(deepResult.interpretation)}
                  </p>
                </div>
              </FadeIn>

              {/* 앞으로의 전망 */}
              {deepResult.timeline && (
                <FadeIn delay={0.25}>
                  <div className="py-5 px-5"
                    style={{
                      background: 'var(--hanji-cream-soft)',
                      borderLeft: '3px solid var(--brand-navy)',
                      border: '1px solid rgba(45,68,112,0.15)',
                      borderLeftWidth: '3px',
                      borderRadius: '2px'
                    }}>
                    <p className="text-editorial-caption" style={{ color: 'var(--brand-navy)' }}>
                      앞으로의 전망
                    </p>
                    <p className="font-serif-ko text-[14px] leading-[1.85] mt-2 whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>
                      {stripMd(deepResult.timeline)}
                    </p>
                  </div>
                </FadeIn>
              )}

              {/* 럭키 프로필 */}
              {deepResult.luckyProfile && (
                <FadeIn delay={0.28}>
                  <div className="card-editorial">
                    <div className="gold-hairline !mt-0 !mb-4">
                      <span className="gold-hairline-symbol">행운 프로필</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* 색상 */}
                      <div className="flex items-center gap-3 p-3"
                        style={{ background: 'var(--hanji-cream-deep)', borderRadius: '2px', border: '0.5px solid rgba(201,169,110,0.2)' }}>
                        <div className="w-9 h-9 flex-shrink-0 relative"
                          style={{ background: deepResult.luckyProfile.colorHex || '#C9A96E', borderRadius: '2px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
                          <div className="absolute inset-1 border border-white/20" style={{ borderRadius: '1px' }} />
                        </div>
                        <div>
                          <p className="font-serif-ko text-[10px]" style={{ color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>행운의 색</p>
                          <p className="font-serif-ko text-[13px] font-bold" style={{ color: 'var(--ink-black)' }}>{deepResult.luckyProfile.color}</p>
                        </div>
                      </div>
                      {/* 숫자 */}
                      <div className="flex items-center gap-3 p-3"
                        style={{ background: 'var(--hanji-cream-deep)', borderRadius: '2px', border: '0.5px solid rgba(201,169,110,0.2)' }}>
                        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center"
                          style={{ background: 'rgba(201,169,110,0.15)', borderRadius: '2px', border: '0.5px solid rgba(201,169,110,0.3)' }}>
                          <span className="font-serif-ko text-[16px] font-black" style={{ color: 'var(--brand-gold)' }}>{deepResult.luckyProfile.number}</span>
                        </div>
                        <div>
                          <p className="font-serif-ko text-[10px]" style={{ color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>행운의 숫자</p>
                          <p className="font-serif-ko text-[13px] font-bold" style={{ color: 'var(--ink-black)' }}>{deepResult.luckyProfile.number}</p>
                        </div>
                      </div>
                      {/* 방위 */}
                      <div className="flex items-center gap-3 p-3"
                        style={{ background: 'var(--hanji-cream-deep)', borderRadius: '2px', border: '0.5px solid rgba(201,169,110,0.2)' }}>
                        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center"
                          style={{ background: 'rgba(21,101,192,0.1)', borderRadius: '2px' }}>
                          <Pictogram k="ui:compass" size={18} color="#1565C0" />
                        </div>
                        <div>
                          <p className="font-serif-ko text-[10px]" style={{ color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>행운의 방위</p>
                          <p className="font-serif-ko text-[13px] font-bold" style={{ color: 'var(--ink-black)' }}>{deepResult.luckyProfile.direction}</p>
                        </div>
                      </div>
                      {/* 보충 오행 */}
                      <div className="flex items-center gap-3 p-3"
                        style={{ background: 'var(--hanji-cream-deep)', borderRadius: '2px', border: '0.5px solid rgba(201,169,110,0.2)' }}>
                        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center"
                          style={{ background: `${OHENG_COLORS[deepResult.luckyProfile.element] || '#C9A96E'}15`, borderRadius: '2px' }}>
                          <Pictogram k={OHENG_PICTOGRAM_KEY[deepResult.luckyProfile.element] || 'ui:lucky'} size={20} color={OHENG_COLORS[deepResult.luckyProfile.element] || '#C9A96E'} />
                        </div>
                        <div>
                          <p className="font-serif-ko text-[10px]" style={{ color: 'var(--ink-faint)', letterSpacing: '0.1em' }}>보충 오행</p>
                          <p className="font-serif-ko text-[13px] font-bold" style={{ color: 'var(--ink-black)' }}>{deepResult.luckyProfile.element}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 행동 조언 */}
              <FadeIn delay={0.3}>
                <div className="relative py-6 px-6"
                  style={{
                    background: 'linear-gradient(135deg, rgba(201,169,110,0.08) 0%, rgba(253,248,238,0.6) 100%)',
                    borderLeft: '3px solid var(--brand-gold)',
                    borderRadius: '2px'
                  }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Pictogram k="ui:lucky" size={18} color="#C9A96E" />
                    <p className="font-serif-ko text-[14px] font-semibold" style={{ color: 'var(--brand-gold)', letterSpacing: '0.05em' }}>
                      사주 기반 행동 조언
                    </p>
                  </div>
                  <p className="font-serif-ko text-[15px] leading-[1.85] font-medium" style={{ color: 'var(--ink-black)' }}>
                    {stripMd(deepResult.luckyAction)}
                  </p>
                </div>
              </FadeIn>

              {/* CTA */}
              <FadeIn delay={0.35}>
                <div className="space-y-3">
                  <div className="gold-hairline">
                    <span className="gold-hairline-symbol">◈</span>
                  </div>
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
