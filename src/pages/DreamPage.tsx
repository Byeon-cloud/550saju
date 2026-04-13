import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BannerAd } from '@/components/ads/BannerAd';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';
import { usePageTitle } from '@/hooks/usePageTitle';
// 꿈해몽은 무료 — 결과에서 사주 연계 심층 해몽(1운)만 유료
import { spendBalance } from '@/services/storage/localStore';
import { useToast } from '@/components/common/Toast';

/**
 * 꿈해몽 페이지 — 무료 서비스
 *
 * 플로우:
 * 1. 꿈 카테고리 선택 (빠른 진입)
 * 2. 꿈 내용 텍스트 입력 (상세)
 * 3. AI 해몽 결과
 *
 * 설계 포인트:
 * - 카테고리 선택으로 진입 장벽 낮춤
 * - 텍스트 입력은 선택사항 (카테고리만으로도 결과 제공)
 * - 결과에서 "더 정확한 분석" → 사주 풀이 유도
 */

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

// 카테고리별 해석 데이터 (실제 운영 시 Gemini Flash API로 대체)
const DREAM_RESULTS: Record<string, { title: string; interpretation: string; luckyAction: string; category: string }> = {
  animal: {
    title: '동물이 나오는 꿈',
    interpretation: '동물이 나오는 꿈은 본능적 욕구와 숨겨진 감정을 반영합니다.\n\n뱀은 전통적으로 재물운, 개는 충성과 우정, 고양이는 직관과 독립심, 돼지는 풍요와 행운을 상징합니다.\n\n꿈에서 동물이 친근하게 다가왔다면 긍정적 에너지가 들어오고 있다는 신호이고, 도망가거나 공격적이었다면 현재 삶에서 억누르고 있는 감정이 있을 수 있어요.\n\n명리학에서 동물은 12지지(地支)와 연결됩니다. 호랑이(인寅), 뱀(사巳), 말(오午) — 각각의 오행 에너지가 지금 당신에게 필요한 기운을 알려줍니다.',
    luckyAction: '꿈에 나온 동물과 관련된 오행의 색상을 오늘 소지하면 좋습니다.',
    category: '본능/재물',
  },
  water: {
    title: '물과 관련된 꿈',
    interpretation: '물은 동양 철학에서 수(水)의 기운 — 지혜, 감정, 유연함을 상징합니다.\n\n맑은 물은 마음의 평화와 좋은 소식, 탁한 물은 감정적 혼란이나 건강 주의를 의미해요. 바다는 무의식의 깊이, 강은 인생의 흐름, 비는 정화와 새로운 시작을 뜻합니다.\n\n홍수 꿈은 감정이 터져 나오려는 신호이지만, 동시에 "큰 변화가 온다"는 긍정적 해석도 있어요. 물이 집 안으로 들어오는 꿈은 재물이 들어온다는 전통적 해석이 있습니다.\n\n현재 수(水) 기운이 부족하다면, 이 꿈이 보충 신호일 수 있어요.',
    luckyAction: '오늘 물을 평소보다 많이 마시고, 파란색 소품을 가까이 두세요.',
    category: '감정/변화',
  },
  death: {
    title: '죽음 · 이별의 꿈',
    interpretation: '죽음이나 이별의 꿈은 대부분 "끝"이 아니라 "전환"을 의미합니다. 놀라지 않으셔도 돼요.\n\n명리학의 12운성에서 "사(死)"는 실제 죽음이 아니라 에너지가 내면으로 수렴되는 단계입니다. 지금까지의 방식이 끝나고 새로운 단계가 시작됩니다.\n\n누군가가 죽는 꿈은 그 사람과의 관계가 변하거나, 자신 안에서 그 사람이 상징하는 특성이 사라지고 있다는 뜻이에요. 장례식 꿈은 오히려 "정리"와 "새 출발"의 좋은 신호입니다.\n\n이 꿈을 꿨다면 현재 인생에서 "놓아야 할 것"이 있는지 돌아보세요.',
    luckyAction: '오래된 물건 하나를 정리하거나, 미뤄둔 연락을 오늘 해보세요.',
    category: '전환/성장',
  },
  flying: {
    title: '하늘을 나는 꿈',
    interpretation: '하늘을 나는 꿈은 자유에 대한 갈망과 성취 욕구를 반영합니다.\n\n높이 날수록 야망이 크고, 가볍게 떠오르는 느낌이었다면 현재 일이 순조롭게 풀릴 조짐이에요. 떨어지는 꿈은 불안감을 나타내지만, "떨어져도 다시 날아오른다"면 회복탄력성이 강하다는 뜻입니다.\n\n명리학에서 "비(飛)"의 기운은 목(木)의 상승 에너지와 연결됩니다. 봄의 나무처럼 위를 향해 뻗어나가는 기운이 지금 당신에게 있어요.\n\n이 시기에 새로운 프로젝트나 도전을 시작하면 좋은 결과를 얻을 가능성이 높습니다.',
    luckyAction: '오늘 하루, 평소 안 하던 새로운 것 하나를 시도해보세요.',
    category: '성취/자유',
  },
  money: {
    title: '돈 · 재물의 꿈',
    interpretation: '돈이 나오는 꿈은 단순히 "돈이 들어온다"가 아니라, 에너지의 흐름을 보여줍니다.\n\n돈을 줍는 꿈은 뜻밖의 기회, 돈을 잃는 꿈은 오히려 "낡은 것을 버리고 새 것을 얻는다"는 긍정적 해석이 있어요. 복권에 당첨되는 꿈은 현재 기대하고 있는 일이 잘 될 가능성을 암시합니다.\n\n명리학에서 재성(財星)의 에너지는 "통제할 수 있는 것"을 의미합니다. 꿈에서 돈을 잘 관리하고 있었다면 현재 재물운이 상승 중이고, 돈이 손에서 빠져나갔다면 지출 관리에 주의가 필요해요.\n\n금(金)과 토(土) 기운을 보충하면 재물운에 도움이 됩니다.',
    luckyAction: '오늘은 충동 구매를 피하고, 가계부를 한 번 확인해보세요.',
    category: '재물/기회',
  },
  people: {
    title: '사람이 나오는 꿈',
    interpretation: '꿈에 나타난 사람은 대부분 "그 사람 자체"가 아니라 당신 안의 어떤 측면을 상징합니다.\n\n가족은 안정감과 뿌리, 연인은 감정적 욕구, 낯선 사람은 아직 발견하지 못한 자신의 모습, 유명인은 당신이 되고 싶은 이상을 나타내요.\n\n명리학에서 사주의 각 기둥은 관계를 상징합니다 — 년주는 조상/사회, 월주는 부모/직장, 일주는 나/배우자, 시주는 자녀/미래. 꿈에 나온 사람이 어떤 관계인지에 따라 해석이 달라집니다.\n\n꿈에서 그 사람과 대화를 나눴다면, 대화 내용이 지금 당신에게 필요한 메시지일 수 있어요.',
    luckyAction: '꿈에 나온 사람에게 오늘 안부 연락을 해보세요.',
    category: '관계/내면',
  },
  chase: {
    title: '쫓기는 꿈',
    interpretation: '쫓기는 꿈은 현실에서 피하고 있는 문제가 있다는 무의식의 신호입니다.\n\n쫓아오는 존재는 "직면해야 할 것"을 상징해요. 사람이라면 인간관계 문제, 동물이라면 본능적 두려움, 정체불명이라면 막연한 불안감이에요.\n\n중요한 건 꿈의 결말입니다. 도망에 성공했다면 현재 문제를 피하고 있지만 괜찮은 상태, 잡혔다면 "이제 직면할 때가 됐다"는 뜻, 돌아서서 맞섰다면 곧 해결의 실마리를 찾게 될 거예요.\n\n명리학에서 칠살(七殺)의 에너지와 관련됩니다 — 압박이지만 동시에 추진력과 돌파력을 주는 기운이에요.',
    luckyAction: '미뤄둔 일 중 가장 꺼리던 것을 오늘 하나만 처리해보세요.',
    category: '불안/돌파',
  },
  nature: {
    title: '자연 · 날씨 꿈',
    interpretation: '자연과 날씨는 당신의 내면 상태를 가장 직접적으로 보여주는 꿈의 언어입니다.\n\n꽃은 새로운 시작과 아름다운 인연, 산은 목표와 도전, 불은 열정과 변화, 지진은 근본적 변화, 눈은 정화와 새 출발을 의미해요.\n\n오행과 직접 연결됩니다 — 꽃/나무는 목(木), 불은 화(火), 산/흙은 토(土), 비/강은 수(水). 꿈에 나온 자연 요소가 현재 부족하거나 과잉인 오행을 알려주고 있을 수 있어요.\n\n날씨가 맑았다면 마음이 정리되고 있는 좋은 시기, 폭풍이었다면 감정의 격변기이지만 지나면 더 맑아질 거예요.',
    luckyAction: '오늘 잠깐이라도 자연 속에서 시간을 보내보세요.',
    category: '내면/오행',
  },
  other: {
    title: '꿈 해석',
    interpretation: '모든 꿈에는 의미가 있습니다.\n\n꿈은 낮 동안 처리하지 못한 감정과 생각이 무의식에서 정리되는 과정이에요. 기억나는 장면, 느꼈던 감정, 등장한 상징물 — 이 세 가지가 해석의 열쇠입니다.\n\n명리학에서는 꿈도 "기운의 흐름"으로 봅니다. 오늘 밤 꿈에 나온 요소들이 지금 당신의 오행 에너지가 어떤 상태인지를 알려주는 신호일 수 있어요.\n\n사주를 등록하시면 오행 분포에 맞춘 더 정확한 꿈 해석을 받을 수 있습니다.',
    luckyAction: '꿈 내용을 메모해두면 패턴을 발견할 수 있어요.',
    category: '종합',
  },
};

function getDreamResult(categoryId: string | null) {
  return DREAM_RESULTS[categoryId || 'other'] || DREAM_RESULTS.other;
}

type Phase = 'category' | 'detail' | 'result';

export function DreamPage() {
  usePageTitle('꿈해몽');
  const navigate = useNavigate();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('category');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dreamText, setDreamText] = useState('');
  const [concern, setConcern] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 꿈해몽은 처음엔 무료 → 결과에서 "사주 연계 심층 해몽(1운)" 유도

  function selectCategory(id: string) {
    setSelectedCategory(id);
    // 모든 카테고리 선택 시 자동으로 detail 단계로 이동 (300ms 딜레이 — 선택 시각 피드백 후)
    setTimeout(() => setPhase('detail'), 300);
  }

  const [aiResult, setAiResult] = useState<{ title: string; interpretation: string; luckyAction: string; category: string } | null>(null);
  const [apiError, setApiError] = useState('');

  async function analyze() {
    setIsLoading(true);
    setApiError('');
    try {
      const { generateDream } = await import('@/services/ai/reportGenerator');
      const { getReports: fetchReports } = await import('@/services/storage/localStore');
      const latestReport = fetchReports().find((r: any) => !r.input?.relation || r.input.relation === '본인') || null;
      const categoryLabel = DREAM_CATEGORIES.find(c => c.id === selectedCategory)?.label || '기타';

      const fullText = [dreamText, concern ? `\n현재 고민: ${concern}` : ''].filter(Boolean).join('');
      const result = await generateDream(
        categoryLabel,
        fullText,
        latestReport?.sajuData,
      );
      setAiResult(result);
      // 보관함 저장
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
    }
  }

  // AI 결과만 사용 — 실패 시 에러 표시 (가짜 데이터 안 보여줌)
  const dreamResult = aiResult;

  function reset() {
    setPhase('category');
    setSelectedCategory(null);
    setDreamText('');
  }

  return (
    <div className="min-h-screen bg-bg-page">
      <Header title="꿈해몽" />

      <div className="px-5 pt-4 pb-[120px]">
        <AnimatePresence mode="wait">

          {/* ====== Phase 1: 카테고리 선택 ====== */}
          {phase === 'category' && (
            <motion.div
              key="category"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <FadeIn>
                {/* 분위기 있는 헤더 */}
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
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => selectCategory(cat.id)}
                    className={`card w-full text-left py-4 px-4 transition-all ${
                      selectedCategory === cat.id
                        ? 'border-2 border-brand-gold shadow-glow'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${cat.color}12` }}>
                        <span className="text-[15px] font-black" style={{ color: cat.color }}>{cat.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-h3 text-text-primary">{cat.label}</p>
                          {cat.hot && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold text-func-danger bg-func-danger/10">HOT</span>
                          )}
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
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <FadeIn>
                {/* 선택된 카테고리 표시 */}
                {selectedCategory && selectedCategory !== 'other' && (() => {
                  const cat = DREAM_CATEGORIES.find(c => c.id === selectedCategory);
                  return cat ? (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${cat.color}15` }}>
                        <span className="text-[13px] font-black" style={{ color: cat.color }}>{cat.icon}</span>
                      </div>
                      <span className="text-caption font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                      <button onClick={() => setPhase('category')} className="ml-auto text-caption text-text-hint">변경</button>
                    </div>
                  ) : null;
                })()}
                <h2 className="text-display text-text-primary">꿈의 내용을{'\n'}자유롭게 적어주세요</h2>
                <p className="text-body text-text-muted mt-3 leading-relaxed">
                  더 자세히 적을수록 정확한 해몽이 가능해요.{'\n'}
                  건너뛰고 바로 결과를 볼 수도 있어요.
                </p>
              </FadeIn>

              <div className="space-y-5">
                <div>
                  <p className="text-h3 text-text-primary mb-3">꿈 내용</p>
                  <textarea
                    value={dreamText}
                    onChange={(e) => setDreamText(e.target.value)}
                    placeholder="예: 큰 뱀이 집 안으로 들어와서 소파 위에 또아리를 틀고 있었는데, 무섭지는 않았어요..."
                    maxLength={300}
                    className="input-field w-full !h-32 !rounded-2xl resize-none text-body"
                    style={{ paddingTop: 16, paddingBottom: 16 }}
                  />
                  <p className="text-right text-caption text-text-hint mt-1">{dreamText.length}/300</p>
                </div>

                <div>
                  <p className="text-h3 text-text-primary mb-2">
                    요즘 머릿속에서 떠나지 않는 게 있다면
                  </p>
                  <p className="text-body-sm text-text-muted mb-3 leading-relaxed">
                    걱정되는 일, 고민, 최근 겪은 사건 등을 적어주시면{'\n'}꿈과 연결해서 더 정확하게 해석해드려요.
                  </p>
                  <textarea
                    value={concern}
                    onChange={(e) => setConcern(e.target.value)}
                    placeholder="예: 이직을 고민하고 있어요 / 연인과 다퉜어요 / 시험을 앞두고 있어요..."
                    maxLength={200}
                    className="input-field w-full !h-28 !rounded-2xl resize-none text-body"
                    style={{ paddingTop: 16, paddingBottom: 16 }}
                  />
                  <p className="text-right text-caption text-text-hint mt-1">{concern.length}/200</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ====== Phase 3: 결과 ====== */}
          {phase === 'result' && !isLoading && !dreamResult && (
            /* API 실패 → 에러 표시 + 재시도 */
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="card-navy py-8 px-5 text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(211,47,47,0.15)' }}>
                  <span style={{ fontSize: 28 }}>😔</span>
                </div>
                <p className="text-h2 text-white">해석에 실패했어요</p>
                <p className="text-body-sm text-white/50 mt-2 leading-relaxed">
                  AI 서버가 일시적으로 바빠요.{'\n'}잠시 후 다시 시도해주세요.
                </p>
                {apiError && (
                  <p className="text-[10px] text-white/25 mt-3 font-mono">{apiError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button fullWidth size="lg" variant="gold" onClick={() => { setPhase('detail'); setApiError(''); }}>
                  다시 시도하기
                </Button>
                <button onClick={() => { setPhase('category'); setSelectedCategory(null); setDreamText(''); setApiError(''); }}
                  className="flex-shrink-0 px-5 py-3.5 rounded-xl text-body-sm font-semibold text-text-muted bg-bg-surface">
                  처음부터
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'result' && !isLoading && dreamResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* 헤더 + 판정 */}
              <FadeIn>
                <div className="card-navy py-6 px-5">
                  <p className="text-label text-white/40">꿈해몽 결과</p>
                  <h2 className="text-h1 text-white mt-1">{dreamResult.title}</h2>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="badge-gold text-tiny">{dreamResult.category}</span>
                    {(dreamResult as any).relatedOheng && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-white/70">
                        {(dreamResult as any).relatedOheng} 기운
                      </span>
                    )}
                  </div>
                  {/* 판정 점수 */}
                  {(dreamResult as any).verdict && (
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                      <p className="text-body-sm text-white/80 font-semibold">{(dreamResult as any).verdict}</p>
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

              {/* 꿈 상징 분석 카드 */}
              {(dreamResult as any).symbols?.length > 0 && (
                <FadeIn delay={0.04}>
                  <div className="card">
                    <p className="text-h3 text-text-primary mb-3">꿈 속 핵심 상징</p>
                    <div className="space-y-2">
                      {(dreamResult as any).symbols.map((sym: any, i: number) => {
                        const ohengIcon: Record<string, string> = { 목: '🌿', 화: '🔥', 토: '⛰️', 금: '✨', 수: '💧' };
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
                            <span style={{ fontSize: 20 }}>{ohengIcon[sym.oheng] || '🔮'}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-label font-bold text-text-primary">{sym.keyword}</span>
                                <span className="text-[9px] text-text-hint px-1.5 py-0.5 rounded bg-bg-surface">{sym.oheng}</span>
                              </div>
                              <p className="text-caption text-text-secondary mt-0.5">{sym.meaning}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 해몽 해석 */}
              <FadeIn delay={0.06}>
                <div className="card">
                  <p className="text-h3 text-text-primary mb-3">상세 해석</p>
                  <p className="text-body-sm text-text-secondary leading-[1.8] whitespace-pre-line">
                    {dreamResult.interpretation}
                  </p>
                </div>
              </FadeIn>

              {/* 오늘의 행동 조언 */}
              <FadeIn delay={0.1}>
                <div className="card-gold">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 18 }}>🍀</span>
                    <p className="text-h3 text-text-primary">오늘의 행동 조언</p>
                  </div>
                  <p className="text-body-sm text-text-primary leading-relaxed font-medium">
                    {dreamResult.luckyAction}
                  </p>
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

              <FadeIn delay={0.15}>
                <div className="card-gold">
                  <p className="text-h3 text-text-primary">내 사주와 연계해서 더 깊게 해석받기</p>
                  <p className="text-body-sm text-text-muted mt-1 leading-relaxed">
                    같은 꿈이라도 사주의 오행 분포에 따라 해석이 완전히 달라져요.{'\n'}
                    내 사주 원국에 맞춘 심층 해몽을 받아보세요.
                  </p>
                  <Button variant="gold" fullWidth size="lg" className="mt-3" onClick={async () => {
                    // 사주 데이터 확인
                    const { getReports: fetchReports } = await import('@/services/storage/localStore');
                    const myReport = fetchReports().find((r: any) => !r.input?.relation || r.input.relation === '본인');
                    if (!myReport?.sajuData) {
                      toast.show('먼저 사주를 분석해주세요', 'warning');
                      navigate('/input');
                      return;
                    }
                    if (!spendBalance(1)) {
                      toast.show('잔액이 부족해요', 'warning');
                      navigate('/charge', { state: { message: '심층 해몽에 1운이 필요해요' } });
                      return;
                    }
                    toast.show('사주 연계 심층 해몽을 분석하고 있어요...', 'info');
                    try {
                      const { generateDream } = await import('@/services/ai/reportGenerator');
                      const categoryLabel = DREAM_CATEGORIES.find(c => c.id === selectedCategory)?.label || '기타';
                      const fullText = [dreamText, concern ? `\n현재 고민: ${concern}` : '', '\n\n[심층 분석 요청] 사주 원국의 오행 분포와 연계하여 이 꿈이 가진 의미를 더 깊이 해석해주세요.'].join('');
                      const result = await generateDream(categoryLabel, fullText, myReport.sajuData);
                      if (result) setAiResult(result);
                      toast.show('심층 해몽이 완성됐어요!', 'success');
                    } catch {
                      // 실패 시 환불
                      const { addRewardBalance } = await import('@/services/storage/localStore');
                      addRewardBalance(1);
                      toast.show('분석에 실패했어요. 1운이 환불됐어요.', 'warning');
                    }
                  }}>
                    사주 연계 심층 해몽 (1운)
                  </Button>
                </div>
              </FadeIn>

              {/* 배너 광고 — 앱인토스에서만 */}
              <BannerAd className="mt-3" />

              <button onClick={reset} className="w-full text-center text-caption text-text-muted mt-2">
                다른 꿈 해몽하기
              </button>
            </motion.div>
          )}

          {/* ====== 로딩 — 한자 해석 애니메이션 ====== */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 space-y-6"
            >
              {/* 한자 3글자 순차 등장 */}
              <div className="flex items-center gap-4">
                {[
                  { char: '夢', label: '꿈' },
                  { char: '解', label: '해석' },
                  { char: '釋', label: '풀이' },
                ].map(({ char, label }, i) => (
                  <motion.div
                    key={i}
                    className="flex flex-col items-center gap-1"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: [0, 1, 0.6, 1], y: 0 }}
                    transition={{ delay: i * 0.4, duration: 0.6, repeat: Infinity, repeatDelay: 1.6 }}
                  >
                    <span className="text-4xl font-black" style={{ color: '#C9A96E' }}>{char}</span>
                    <span className="text-[9px] text-text-hint">{label}</span>
                  </motion.div>
                ))}
              </div>
              <motion.p
                className="text-body-sm text-text-muted"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                꿈의 의미를 명리학으로 풀어보고 있어요
              </motion.p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* CTA — 카테고리/상세 단계에서만 표시 */}
      {/* 카테고리 선택 후 자동 이동 — 별도 CTA 불필요 */}

      {phase === 'detail' && (
        <div className="sticky-cta-bottom">
          <Button fullWidth size="lg" onClick={analyze}>
            해몽 결과 보기
          </Button>
        </div>
      )}
    </div>
  );
}
