import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { BannerAd as BannerAdLazy } from '@/components/ads/BannerAd';
import { getReports, spendBalance, saveReport, generateId, type LocalReport } from '@/services/storage/localStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { usePageTitle } from '@/hooks/usePageTitle';
import { hasFreePass, useFreePass } from '@/services/storage/dailyFreePass';
import { useToast } from '@/components/common/Toast';
import { generateDailyFortune } from '@/services/ai/reportGenerator';

type TimeSlot = 'latenight' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

function getTimeSlot(): TimeSlot {
  const h = new Date().getHours();
  if (h < 5) return 'latenight';
  if (h < 7) return 'dawn';
  if (h < 12) return 'morning';
  if (h < 14) return 'noon';
  if (h < 18) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

const TIME_CONTEXT: Record<TimeSlot, { greeting: string; label: string; sub: string }> = {
  latenight: { greeting: '이 늦은 밤, 마음에 무언가 남았군요', label: '자시(子時)', sub: '수(水)의 기운이 가장 깊은 시간' },
  dawn:      { greeting: '이른 아침이에요. 하루의 시작을 함께할게요', label: '인시(寅時)', sub: '목(木)의 기운이 움트는 시간' },
  morning:   { greeting: '좋은 아침이에요!', label: '오전', sub: '새로운 시작에 유리한 시간대' },
  noon:      { greeting: '점심시간이네요. 잠깐 쉬면서 봐요', label: '오시(午時)', sub: '화(火)의 기운이 절정인 시간' },
  afternoon: { greeting: '오후의 기운을 읽어볼게요', label: '오후', sub: '금(金)의 수렴 기운으로 판단력이 좋아지는 시간' },
  evening:   { greeting: '오늘 하루 수고하셨어요', label: '저녁', sub: '하루를 돌아보기에 좋은 시간' },
  night:     { greeting: '고요한 밤이에요. 편안하게 봐요', label: '해시(亥時)', sub: '수(水)의 기운이 시작되는 시간' },
};

/* ─── 로컬 폴백 결과 (AI 실패 시) ─── */
function getLocalResult(_slot: TimeSlot, ilgan?: string, ilganOheng?: string) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
  const seed = ilgan ? ilgan.charCodeAt(0) : 0;
  const s = (n: number, min: number, max: number) => min + ((dayOfYear * 7919 + n * 104729 + seed * 31) % (max - min + 1));

  const loveScore = s(1, 50, 95);
  const careerScore = s(2, 45, 92);
  const wealthScore = s(3, 45, 90);
  const healthScore = s(4, 55, 95);
  const avg = Math.round((loveScore + careerScore + wealthScore + healthScore) / 4);
  const grade = avg >= 85 ? 'S' : avg >= 75 ? 'A' : avg >= 65 ? 'B' : 'C';

  const summaries = [
    '소통과 관계에서 기회가 오는 날입니다. 중요한 연락은 오전에 먼저 하세요.',
    '새로운 시작의 기운이 강한 날입니다. 미루던 일을 시작하기 좋아요.',
    '재물의 흐름이 좋은 날입니다. 소비보다 투자에 눈을 돌려보세요.',
    '직관이 또렷한 날입니다. 고민하던 문제의 답이 떠오를 수 있어요.',
    '인간관계에서 뜻밖의 도움이 올 수 있는 날이에요.',
  ];

  const gradeLabels: Record<string, string> = { S: '최고의 하루', A: '좋은 하루', B: '무난한 하루', C: '조심할 하루' };
  const gradeColors: Record<string, string> = { S: '#C9A96E', A: '#2D8A4E', B: '#2D4470', C: '#D32F2F' };

  return {
    grade,
    gradeLabel: gradeLabels[grade],
    gradeColor: gradeColors[grade],
    summary: summaries[dayOfYear % summaries.length] + (ilgan ? `\n\n${ilgan}(${ilganOheng}) 일간인 당신에게 오늘 특히 좋은 시간대예요.` : ''),
    scores: [
      { label: '연애운', score: loveScore, color: '#C9A96E' },
      { label: '직장운', score: careerScore, color: '#2D4470' },
      { label: '재물운', score: wealthScore, color: '#D4A843' },
      { label: '건강운', score: healthScore, color: '#2E7D32' },
    ],
    lucky: {
      color: ['파란색','초록색','흰색','노란색','검은색','보라색','분홍색'][dayOfYear % 7],
      colorHex: ['#1565C0','#2D8A4E','#FFFFFF','#F57F17','#212121','#7B1FA2','#E91E63'][dayOfYear % 7],
      number: s(6, 1, 9),
      direction: ['동쪽','서쪽','남쪽','북쪽'][dayOfYear % 4],
      item: ['은 액세서리','가죽 소품','나무 재질 물건','물병','수정 장식'][dayOfYear % 5],
      food: ['해산물','닭고기','콩나물국','녹차','견과류'][dayOfYear % 5],
    },
    advice: '지금 이 순간에 집중하는 것이 오늘 가장 좋은 운을 만드는 방법이에요.',
  };
}

export function DailyFortunePage() {
  usePageTitle('오늘의 운세');
  const navigate = useNavigate();
  const toast = useToast();

  const timeSlot = useMemo(() => getTimeSlot(), []);
  const ctx = TIME_CONTEXT[timeSlot];

  const profiles = useMemo(() => {
    const all = getReports();
    const seen = new Map<string, LocalReport>();
    for (const r of all) {
      const key = `${r.name}_${r.input.birthYear}_${r.input.birthMonth}_${r.input.birthDay}`;
      if (!seen.has(key)) seen.set(key, r);
    }
    return Array.from(seen.values());
  }, []);

  const [selectedProfile, setSelectedProfile] = useState<LocalReport | null>(null);
  const [profileSelected, setProfileSelected] = useState(profiles.length === 0);
  const [concern, setConcern] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const ilgan = selectedProfile?.sajuData.pillars[2]?.천간;
  const ilganOheng = ilgan ? CHEONGAN_OHENG[ilgan] : undefined;
  const localResult = useMemo(() => getLocalResult(timeSlot, ilgan, ilganOheng), [timeSlot, ilgan, ilganOheng]);
  const result = aiResult || localResult;

  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  async function submitFortune() {
    if (hasFreePass('daily')) {
      useFreePass('daily');
    } else if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '오늘의 운세에 1운이 필요해요' } });
      return;
    }

    setShowResult(true);

    if (selectedProfile) {
      saveReport({ id: generateId(), name: selectedProfile.name, input: selectedProfile.input, sajuData: selectedProfile.sajuData, type: 'free' as any, createdAt: Date.now(), contentType: 'daily' as any });
    }

    try {
      setAiLoading(true);
      const sajuSummary = selectedProfile?.sajuData ? {
        ilgan: selectedProfile.sajuData.pillars[2]?.천간 || '',
        oheng: ilganOheng || '',
        name: selectedProfile.name || '',
      } : undefined;
      const aiData = await generateDailyFortune([], timeSlot, sajuSummary, concern || undefined);
      if (aiData) setAiResult({
        ...aiData,
        gradeColor: aiData.grade === 'S' ? '#C9A96E' : aiData.grade === 'A' ? '#2D8A4E' : aiData.grade === 'B' ? '#2D4470' : '#D32F2F',
        scores: [
          { label: '연애운', score: aiData.scores?.love ?? 70, color: '#C9A96E' },
          { label: '직장운', score: aiData.scores?.career ?? 70, color: '#2D4470' },
          { label: '재물운', score: aiData.scores?.wealth ?? 70, color: '#D4A843' },
          { label: '건강운', score: aiData.scores?.health ?? 70, color: '#2E7D32' },
        ],
      });
    } catch (e) {
      console.warn('[DailyFortune] AI 실패, 로컬 결과 사용:', e);
    } finally {
      setAiLoading(false);
    }
  }

  /* ── 프로필 선택 화면 ── */
  if (!profileSelected && profiles.length > 0) {
    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <div className="px-5 pt-6 space-y-5">
          <FadeIn>
            <h1 className="text-display text-text-primary">누구의 운세를{'\n'}확인할까요?</h1>
            <p className="text-body-sm text-text-muted mt-2">사주를 선택하거나, 사주 없이 진행할 수 있어요.</p>
          </FadeIn>
          <div className="space-y-2">
            {profiles.map((r) => {
              const il = r.sajuData.pillars[2]?.천간 || '';
              const oh = il ? CHEONGAN_OHENG[il] : '';
              const rel = r.input.relation || '본인';
              return (
                <motion.button key={r.id} whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedProfile(r); setProfileSelected(true); }}
                  className="card w-full text-left py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: rel === '본인' ? 'rgba(27,42,74,0.08)' : 'rgba(201,169,110,0.08)' }}>
                      <span className="text-h3 font-bold" style={{ color: rel === '본인' ? '#1B2A4A' : '#C9A96E' }}>
                        {r.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-h3 text-text-primary">{r.name}</p>
                        <span className="text-caption text-text-hint">{rel}</span>
                      </div>
                      <p className="text-caption text-text-muted">{il ? `${il}(${oh}) 일간` : '사주 정보'}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                  </div>
                </motion.button>
              );
            })}
          </div>
          <button onClick={() => { setSelectedProfile(null); setProfileSelected(true); }}
            className="w-full card text-center py-5 border-2 border-dashed border-border">
            <p className="text-h3 text-text-muted">사주 없이 일반 운세 보기</p>
          </button>
          <button onClick={() => navigate('/input?new=1')}
            className="w-full text-center text-caption text-brand-gold font-semibold py-2">
            새 사주 입력하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="px-5 pt-4 space-y-5">

        {/* 시간대 인사 */}
        <FadeIn>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-caption font-semibold text-brand-gold">{ctx.label}</span>
            <span className="text-caption text-text-hint">·</span>
            <p className="text-caption text-text-muted">{dateStr}</p>
          </div>
          <h1 className="text-display text-text-primary">{ctx.greeting}</h1>
          <p className="text-caption text-text-hint mt-1">{ctx.sub}</p>
          {selectedProfile && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-brand-gold/8 border border-brand-gold/15">
              <div className="w-4 h-4 rounded-full bg-brand-gold/20 flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
              </div>
              <p className="text-caption text-brand-navy">
                {selectedProfile.name}님의 사주({ilgan}{ilganOheng ? ` ${ilganOheng}` : ''} 일간) 기반 맞춤 운세
              </p>
            </div>
          )}
        </FadeIn>

        <AnimatePresence mode="wait">
          {!showResult ? (
            /* ── 입력 화면: 고민 1줄 ── */
            <motion.div key="input" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div className="space-y-4">
                <div className="card-navy py-5 px-5">
                  <h2 className="text-h1 text-white leading-snug">오늘 가장 마음에{'\n'}걸리는 게 있나요?</h2>
                  <p className="text-body-sm text-white/50 mt-2">구체적으로 적을수록 맞춤 운세가 나와요. 건너뛰어도 됩니다.</p>
                </div>
                <textarea
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                  placeholder="예: 오늘 중요한 발표가 있어요 / 연인과 다퉜어요 / 이직 고민 중이에요..."
                  maxLength={200}
                  rows={4}
                  className="input-field w-full !rounded-2xl resize-none text-body"
                  style={{ paddingTop: 16, paddingBottom: 16, minHeight: 120 }}
                />
                <div className="flex gap-2">
                  <Button fullWidth size="lg" variant="gold" onClick={submitFortune}>운세 보기</Button>
                  <button onClick={submitFortune}
                    className="flex-shrink-0 px-5 py-3.5 rounded-xl text-body-sm font-semibold text-text-muted bg-bg-surface">
                    건너뛰기
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── 결과 화면 ── */
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="space-y-4">

              {aiLoading && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="w-4 h-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
                  <span className="text-caption text-text-muted">AI가 맞춤 운세를 분석하고 있어요...</span>
                </div>
              )}

              {/* 등급 카드 */}
              <div className="card-navy text-center py-8">
                <motion.div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-3"
                  style={{ background: (result.gradeColor || '#C9A96E') + '25' }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}>
                  <span className="text-4xl font-black text-white">{result.grade}</span>
                </motion.div>
                <p className="text-h2" style={{ color: result.gradeColor || '#C9A96E' }}>{result.gradeLabel}</p>
                <p className="text-caption text-white/40 mt-1">{dateStr}</p>
              </div>

              {/* 요약 */}
              <div className="card">
                <p className="text-body text-text-secondary leading-relaxed whitespace-pre-line">{result.summary}</p>
              </div>

              {/* 점수 */}
              <div className="grid grid-cols-4 gap-2">
                {result.scores.map((s: any, i: number) => (
                  <motion.div key={s.label} className="card text-center py-3 space-y-1.5"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}>
                    <div className="w-2 h-2 rounded-full mx-auto" style={{ background: s.color }} />
                    <div className="relative w-full h-1.5 bg-border-light rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: s.color }}
                        initial={{ width: 0 }} animate={{ width: `${s.score}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                    <p className="text-h3" style={{ color: s.color }}>{s.score}</p>
                    <p className="text-tiny text-text-muted">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* 행운 아이템 */}
              <div className="card-gold">
                <h3 className="text-h3 text-text-primary mb-3">오늘의 행운</h3>
                <div className="grid grid-cols-3 gap-y-4 gap-x-3">
                  {[
                    { label: '컬러', value: result.lucky?.color, hex: result.lucky?.colorHex },
                    { label: '숫자', value: String(result.lucky?.number ?? '') },
                    { label: '방위', value: result.lucky?.direction },
                    { label: '아이템', value: result.lucky?.item },
                    { label: '음식', value: result.lucky?.food },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      {item.hex && (
                        <div className="w-6 h-6 rounded-full mx-auto mb-1 shadow-sm border border-white/50"
                          style={{ background: item.hex }} />
                      )}
                      <p className="text-h3 text-text-primary">{item.value}</p>
                      <p className="text-tiny text-text-muted mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 시간대별 조언 */}
              <div className="card-emphasis">
                <p className="text-label text-brand-gold mb-2">{ctx.label}의 조언</p>
                <p className="text-body text-text-primary leading-relaxed">{result.advice}</p>
              </div>

              {/* CTA */}
              <div className="space-y-3">
                <Button variant="gold" fullWidth size="lg" onClick={() => navigate('/input')}>
                  {selectedProfile ? '더 깊은 분석 보러 가기' : '내 사주도 분석해보기'}
                </Button>
                <p className="text-center text-tiny text-text-hint">1운(500원) · 12가지 심층 분석</p>
                <BannerAdLazy className="mt-3" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
