import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { Button } from '@/components/common/Button';
import { BannerAd as BannerAdLazy } from '@/components/ads/BannerAd';
import { getReports, spendBalance, saveReport, generateId, type LocalReport } from '@/services/storage/localStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { usePageTitle } from '@/hooks/usePageTitle';
import { hasFreePass, useFreePass } from '@/services/storage/dailyFreePass';
import { useToast } from '@/components/common/Toast';
import { generateDailyFortune } from '@/services/ai/reportGenerator';
import { stripMd } from '@/utils/format';

// ─── 시간대 감지 (7단계) ───
type TimeSlot = 'latenight' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

function getTimeSlot(): TimeSlot {
  const h = new Date().getHours();
  if (h >= 0 && h < 5) return 'latenight';
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 12) return 'morning';
  if (h >= 12 && h < 14) return 'noon';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 21) return 'evening';
  return 'night';
}

const TIME_CONTEXT: Record<TimeSlot, { greeting: string; tone: string; label: string; sub: string }> = {
  latenight: {
    greeting: '이 늦은 밤, 마음에 무언가 남았군요',
    tone: '이 시간까지 고민하고 계신다면, 꽤 중요한 문제인 것 같아요. 차분히 풀어볼게요.',
    label: '자시(子時)',
    sub: '수(水)의 기운이 가장 깊은 시간',
  },
  dawn: {
    greeting: '이른 아침이에요. 하루의 시작을 함께할게요',
    tone: '동이 트기 전, 차분한 에너지가 흐르고 있어요. 오늘의 방향을 잡아볼게요.',
    label: '인시(寅時)',
    sub: '목(木)의 기운이 움트는 시간',
  },
  morning: {
    greeting: '좋은 아침이에요!',
    tone: '하루를 시작하는 양(陽)의 기운이 가장 좋은 시간이에요.',
    label: '오전',
    sub: '새로운 시작에 유리한 시간대',
  },
  noon: {
    greeting: '점심시간이네요. 잠깐 쉬면서 봐요',
    tone: '정오의 화(火) 기운이 가장 강한 시간. 직감이 또렷해져요.',
    label: '오시(午時)',
    sub: '화(火)의 기운이 절정인 시간',
  },
  afternoon: {
    greeting: '오후의 기운을 읽어볼게요',
    tone: '하루의 후반부, 남은 시간을 어떻게 쓸지 함께 봐요.',
    label: '오후',
    sub: '금(金)의 수렴 기운으로 판단력이 좋아지는 시간',
  },
  evening: {
    greeting: '오늘 하루 수고하셨어요',
    tone: '하루를 마무리하는 시간이에요. 내일을 위한 기운도 함께 볼게요.',
    label: '저녁',
    sub: '하루를 돌아보기에 좋은 시간',
  },
  night: {
    greeting: '고요한 밤이에요. 편안하게 봐요',
    tone: '밤에 보는 운세는 더 솔직해져요. 마음 깊은 곳의 이야기를 해볼까요.',
    label: '해시(亥時)',
    sub: '수(水)의 기운이 시작되는 시간',
  },
};

// ─── 고민 영역 칩 (1단계 선택 UI용) ───
const CONCERN_CHIPS = [
  { id: 'career',  label: '이직 · 진로',   icon: '事' },
  { id: 'love',    label: '연애 · 관계',   icon: '愛' },
  { id: 'wealth',  label: '재정 · 투자',   icon: '財' },
  { id: 'health',  label: '체력 · 건강',   icon: '健' },
  { id: 'people',  label: '인간관계',       icon: '人' },
  { id: 'general', label: '전반적인 흐름',  icon: '運' },
];

// ─── 결과 데이터 (시간대+이전 데이터 반영) ───
function getFortuneResult(slot: TimeSlot, hasHistory: boolean, ilgan?: string, ilganOheng?: string, recentReport?: any) {
  const timeAdvice: Record<TimeSlot, string> = {
    latenight: '이 시간까지 깨어 계신 당신에게 — 지금 떠오르는 생각을 메모해두세요. 새벽의 직감이 가장 정확해요.',
    dawn: '이른 아침의 기운이 맑습니다. 오늘 가장 중요한 일을 오전에 배치하세요.',
    morning: '오전 중으로 가장 중요한 결정을 내리세요. 오늘은 직감이 논리보다 정확한 날입니다.',
    noon: '점심 후에는 급한 결정을 피하세요. 오후 3시 이후에 중요한 대화를 나누면 좋습니다.',
    afternoon: '오후에는 사람과의 소통에서 기회가 옵니다. 미뤄둔 연락이 있다면 지금 하세요.',
    evening: '오늘의 에너지를 내일로 연결하세요. 저녁에 계획을 세우면 내일 실행력이 2배가 됩니다.',
    night: '밤의 직감을 믿으세요. 지금 떠오르는 아이디어를 적어두면 내일 빛을 발해요.',
  };

  // 날짜 + 사주 데이터 기반 맞춤 점수
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
  const ilganSeed = ilgan ? ilgan.charCodeAt(0) : 0;
  const seed = (n: number) => ((dayOfYear * 7919 + n * 104729 + ilganSeed * 31) % 100);
  const s = (n: number, min: number, max: number) => min + (seed(n) % (max - min + 1));

  // 사주 오행 기반 보정 — 해당 오행이 강하면 관련 운세 점수 UP
  const elements = recentReport?.sajuData?.elements;
  const ohengBonus = (key: string) => elements ? Math.min(10, (elements[key as keyof typeof elements] || 0) * 2) : 0;

  const loveScore = Math.min(98, s(1, 55, 90) + ohengBonus('화'));
  const careerScore = Math.min(98, s(2, 50, 88) + ohengBonus('금') + ohengBonus('토'));
  const wealthScore = Math.min(98, s(3, 45, 85) + ohengBonus('토'));
  const healthScore = Math.min(98, s(4, 55, 90) - (elements ? Object.values(elements).filter(v => v === 0).length * 5 : 0));
  const avgScore = Math.round((loveScore + careerScore + wealthScore + healthScore) / 4);

  const grade = avgScore >= 85 ? 'S' : avgScore >= 75 ? 'A' : avgScore >= 65 ? 'B' : 'C';
  const gradeLabels: Record<string, Record<string, string>> = {
    S: { default: '최고의 하루', latenight: '새벽의 축복', night: '밤의 기적' },
    A: { default: '좋은 하루', latenight: '새벽의 선물', night: '밤의 지혜' },
    B: { default: '무난한 하루', latenight: '차분한 새벽', night: '고요한 밤' },
    C: { default: '조심할 하루', latenight: '신중한 새벽', night: '돌아보는 밤' },
  };
  const gradeLabel = gradeLabels[grade]?.[slot] || gradeLabels[grade]?.default || '오늘의 운세';
  const gradeColor = grade === 'S' ? '#C9A96E' : grade === 'A' ? '#2D8A4E' : grade === 'B' ? '#2D4470' : '#D32F2F';

  const personalTouch = ilgan
    ? `${ilgan} 일간인 당신에게 오늘은 특히 ${s(5, 0, 1) ? '행동력' : '판단력'}이 빛나는 날이에요.`
    : '';

  const summaries = [
    '소통과 관계에서 기회가 오는 날입니다. 중요한 연락은 오전에 먼저 하세요.',
    '새로운 시작의 기운이 강한 날입니다. 미루던 일을 시작하기 좋아요.',
    '재물의 흐름이 좋은 날입니다. 소비보다 투자에 눈을 돌려보세요.',
    '건강 에너지가 충만한 날입니다. 운동이나 야외활동을 추천해요.',
    '직관이 또렷한 날입니다. 고민하던 문제의 답이 떠오를 수 있어요.',
    '인간관계에서 뜻밖의 도움이 올 수 있는 날이에요.',
  ];

  return {
    grade,
    gradeLabel,
    gradeColor,
    summary: hasHistory
      ? `${TIME_CONTEXT[slot].tone}\n\n${ilganOheng ? `${ilgan}(${ilganOheng}) 일간인 ${recentReport!.name}님에게 ` : ''}${summaries[dayOfYear % summaries.length]}\n\n${personalTouch}${elements ? `\n\n오행 흐름: 오늘은 ${['목', '화', '토', '금', '수'][dayOfYear % 5]}(${['木', '火', '土', '金', '水'][dayOfYear % 5]})의 기운이 강한 날이에요. ${(elements as Record<string, number>)[['목', '화', '토', '금', '수'][dayOfYear % 5]] > 2 ? '사주와 공명하는 날이라 평소보다 에너지가 좋습니다.' : '사주에 부족한 기운을 보충하기 좋은 날이에요.'}` : ''}`
      : `${TIME_CONTEXT[slot].tone}\n\n${summaries[dayOfYear % summaries.length]}\n\n사주를 등록하면 오행의 흐름에 맞춘 더 정확한 맞춤 운세를 받을 수 있어요.`,
    scores: [
      { label: '연애운', score: loveScore, color: '#C9A96E' },
      { label: '직장운', score: careerScore, color: '#2D4470' },
      { label: '재물운', score: wealthScore, color: '#D4A843' },
      { label: '건강운', score: healthScore, color: '#2E7D32' },
    ],
    lucky: {
      color: ['파란색', '초록색', '흰색', '노란색', '검은색', '보라색', '분홍색'][dayOfYear % 7],
      colorHex: ['#1565C0', '#2D8A4E', '#FFFFFF', '#F57F17', '#212121', '#7B1FA2', '#E91E63'][dayOfYear % 7],
      number: s(6, 1, 9),
      direction: ['동쪽', '서쪽', '남쪽', '북쪽'][dayOfYear % 4],
      item: ['은 액세서리', '가죽 소품', '나무 재질 물건', '물병', '수정 장식'][dayOfYear % 5],
      food: ['해산물', '닭고기', '콩나물국', '녹차', '견과류', '검은깨죽'][dayOfYear % 6],
    },
    advice: timeAdvice[slot],
  };
}

export function DailyFortunePage() {
  usePageTitle('오늘의 운세');
  const navigate = useNavigate();
  const toast = useToast();
  const [showResult, setShowResult] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<LocalReport | null>(null);
  const [profileSelected, setProfileSelected] = useState(false);
  // 새 단순화 UX: 고민 영역 칩 선택 + 자유 입력
  const [selectedConcern, setSelectedConcern] = useState<string>('');
  const [userConcern, setUserConcern] = useState('');

  const timeSlot = useMemo(() => getTimeSlot(), []);
  const ctx = TIME_CONTEXT[timeSlot];

  // 프로필 목록 (중복 제거)
  const profiles = useMemo(() => {
    const all = getReports();
    const seen = new Map<string, LocalReport>();
    for (const r of all) {
      if (r.contentType === 'compat' || r.input?.relation === 'compat') continue;
      if (r.name?.includes('×') || r.name?.includes('x')) continue;
      if (!r.input?.birthYear) continue;
      const key = `${r.name}_${r.input.birthYear}_${r.input.birthMonth}_${r.input.birthDay}`;
      if (!seen.has(key)) seen.set(key, r);
    }
    return Array.from(seen.values());
  }, []);

  // 단일 프로필이면 자동 선택
  const recentReport = selectedProfile;
  const hasHistory = !!recentReport;
  const ilgan = recentReport?.sajuData?.pillars?.[2]?.천간;
  const ilganOheng = ilgan ? CHEONGAN_OHENG[ilgan] : undefined;

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState('');

  const localResult = useMemo(() => getFortuneResult(timeSlot, hasHistory, ilgan, ilganOheng, recentReport), [timeSlot, hasHistory, ilgan, ilganOheng, recentReport]);

  // AI 결과를 UI 형식으로 변환 (scores 객체→배열, grade 등)
  const normalizedAiResult = useMemo(() => {
    if (!aiResult) return null;
    const gradeColor = aiResult.grade === 'S' ? '#C9A96E' : aiResult.grade === 'A' ? '#2D8A4E' : aiResult.grade === 'B' ? '#2D4470' : '#D32F2F';
    return {
      ...aiResult,
      gradeColor,
      scores: Array.isArray(aiResult.scores) ? aiResult.scores : [
        { label: '연애운', score: aiResult.scores?.love ?? 70, color: '#C9A96E' },
        { label: '직장운', score: aiResult.scores?.career ?? 70, color: '#2D4470' },
        { label: '재물운', score: aiResult.scores?.wealth ?? 70, color: '#D4A843' },
        { label: '건강운', score: aiResult.scores?.health ?? 70, color: '#2E7D32' },
      ],
      lucky: {
        color: aiResult.lucky?.color ?? localResult.lucky.color,
        colorHex: aiResult.lucky?.colorHex ?? localResult.lucky.colorHex,
        number: aiResult.lucky?.number ?? localResult.lucky.number,
        direction: aiResult.lucky?.direction ?? localResult.lucky.direction,
        item: aiResult.lucky?.item ?? localResult.lucky.item,
        food: aiResult.lucky?.food ?? localResult.lucky.food,
      },
    };
  }, [aiResult, localResult]);

  // AI 로딩 중이면 결과 안 보여줌 (로딩 화면이 대신 표시됨)
  const result = aiLoading ? null : (normalizedAiResult || localResult);
  const isOtherPerson = recentReport && recentReport.input.relation && recentReport.input.relation !== '본인' && recentReport.input.relation !== 'self';
  const targetName = recentReport?.name || '';

  // 단일 프로필 자동 선택
  if (!profileSelected && profiles.length === 1) {
    setSelectedProfile(profiles[0]);
    setProfileSelected(true);
  }

  async function submitFortune() {
    // 과금: 무료 1회 → 이후 1운
    if (hasFreePass('daily')) {
      useFreePass('daily');
    } else if (spendBalance(1)) {
      toast.show('1운이 차감됐어요', 'info');
    } else {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '오늘의 운세에 1운이 필요해요' } });
      return;
    }

    // AI 로딩 시작 — 결과는 AI 완료 후에만 표시
    setAiLoading(true);
    setShowResult(true); // 로딩 화면 전환

    // 프로모션 이벤트
    import('@/services/toss/tossPromotion').then(m => m.triggerPromotionEvent(m.PROMO_EVENTS.DAILY_FORTUNE)).catch(() => {});

    // 보관함에 저장
    if (selectedProfile) {
      saveReport({ id: generateId(), name: selectedProfile.name, input: selectedProfile.input, sajuData: selectedProfile.sajuData, type: 'free', contentType: 'daily', createdAt: new Date().toISOString() });
    }

    const concernIdx = CONCERN_CHIPS.findIndex(c => c.id === selectedConcern);
    const answersArr = [concernIdx >= 0 ? concernIdx : 5];
    try {
      const sajuSummary = selectedProfile?.sajuData ? {
        ilgan: selectedProfile.sajuData.pillars?.[2]?.천간 || '',
        oheng: ilganOheng || '',
        name: selectedProfile.name || '',
      } : undefined;

      const aiData = await generateDailyFortune(answersArr, timeSlot, sajuSummary, userConcern || undefined);
      if (aiData) setAiResult(aiData);
    } catch (e: any) {
      console.error('[DailyFortune] AI 호출 실패:', e);
      setAiError(e?.message || 'AI 서버 연결 실패');
    } finally {
      setAiLoading(false);
    }
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const timeStr = today.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  // 프로필 미선택 → 선택 화면
  if (!profileSelected && profiles.length > 0) {
    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <div className="px-5 pt-6 space-y-5">
          <FadeIn>
            <h1 className="text-display text-text-primary">누구의 운세를{'\n'}확인할까요?</h1>
            <p className="text-body-sm text-text-muted mt-2">이전에 입력한 사주를 선택하거나, 사주 없이 진행할 수 있어요.</p>
          </FadeIn>

          <div className="space-y-2">
            {profiles.map((r) => {
              const il = r.sajuData?.pillars?.[2]?.천간 || '';
              const oh = il ? CHEONGAN_OHENG[il] : '';
              const rel = r.input.relation || '본인';
              return (
                <motion.button
                  key={r.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedProfile(r); setProfileSelected(true); }}
                  className="card w-full text-left py-4 px-4"
                >
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
                      <p className="text-caption text-text-muted">
                        {il ? `${il}(${oh}) 일간` : '사주 정보'}
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <button
            onClick={() => { setSelectedProfile(null); setProfileSelected(true); }}
            className="w-full card text-center py-5 border-2 border-dashed border-border"
          >
            <p className="text-h3 text-text-muted">사주 없이 일반 운세 보기</p>
          </button>

          <button
            onClick={() => navigate('/input?new=1')}
            className="w-full text-center text-caption text-brand-gold font-semibold py-2"
          >
            새 사주 입력하기
          </button>
        </div>
      </div>
    );
  }

  // AI 로딩 중 → 풀스크린 로딩 (early return)
  if (aiLoading) {
    return (
      <AILoading
        name={hasHistory ? recentReport!.name : ''}
        type="오늘의 운세"
        steps={['오행의 흐름을 읽고 있어요', '사주와 오늘 날의 관계를 분석하고 있어요', '맞춤 운세를 작성하고 있어요']}
      />
    );
  }

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="px-5 pt-4 space-y-5">

        {/* 시간대별 인사 */}
        <FadeIn>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-caption font-semibold text-brand-gold">{ctx.label}</span>
            <span className="text-caption text-text-hint">·</span>
            <p className="text-caption text-text-muted">{dateStr} {timeStr}</p>
          </div>
          <h1 className="text-display text-text-primary">{ctx.greeting}</h1>
          <p className="text-caption text-text-hint mt-1">{ctx.sub}</p>
          {hasHistory && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-brand-gold/8 border border-brand-gold/15">
              <div className="w-4 h-4 rounded-full bg-brand-gold/20 flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
              </div>
              <p className="text-caption text-brand-navy">
                {recentReport!.name}님의 사주({ilgan}{ilganOheng ? ` ${ilganOheng}` : ''} 일간) 기반 맞춤 운세
              </p>
            </div>
          )}
        </FadeIn>

        <AnimatePresence mode="wait">
          {!showResult ? (
            isOtherPerson ? (
            /* ====== 타인 → 서술형 1페이지 ====== */
            <motion.div key="other-input" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div className="space-y-5">
                <div className="card-navy py-5 px-5">
                  <h2 className="text-h1 text-white leading-snug">{targetName}님에 대해{'\n'}알려주세요</h2>
                  <p className="text-body-sm text-white/50 mt-2">
                    {targetName}님이 요즘 어떤 고민을 하고 있는지, 알고 있는 범위에서 적어주세요.
                  </p>
                </div>

                <textarea
                  value={userConcern}
                  onChange={(e) => setUserConcern(e.target.value)}
                  placeholder={`예: ${targetName}님이 이직을 고민하고 있어요 / 연애 문제로 힘들어해요...`}
                  maxLength={300}
                  rows={5}
                  className="input-field w-full !rounded-2xl resize-none text-body"
                  style={{ paddingTop: 16, paddingBottom: 16, minHeight: 150 }}
                />

                <div className="flex gap-2">
                  <Button fullWidth size="lg" variant="gold" onClick={submitFortune}>운세 보기</Button>
                  <button onClick={submitFortune} className="flex-shrink-0 px-5 py-3.5 rounded-xl text-body-sm font-semibold text-text-muted bg-bg-surface">건너뛰기</button>
                </div>

                <div className="card-gold py-4 px-4">
                  <p className="text-body-sm text-text-primary font-semibold">더 정확한 운세는 {targetName}님이 직접 확인하면 좋아요</p>
                  <p className="text-caption text-text-muted mt-1">사주500을 공유하면 {targetName}님도 직접 운세를 볼 수 있어요</p>
                  <button onClick={async () => { const { shareResult } = await import('@/utils/share'); shareResult({ name: targetName, reportId: 'daily' }); }}
                    className="mt-2 text-caption text-brand-gold font-bold">{targetName}님에게 공유하기 →</button>
                </div>
              </div>
            </motion.div>
            ) : (
            /* ====== 본인 → 단순화된 단일 화면 (고민 영역 + 자유 입력) ====== */
            <motion.div key="concern-input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <div className="space-y-5">
                <div className="card-navy py-5 px-5">
                  <h2 className="text-h1 text-white leading-snug">
                    {ctx.greeting}
                  </h2>
                  <p className="text-caption text-white/50 mt-2">{ctx.sub}</p>
                </div>

                {/* 고민 영역 칩 */}
                <div>
                  <p className="text-h3 text-text-primary mb-3">요즘 가장 신경 쓰이는 영역은?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {CONCERN_CHIPS.map((chip, i) => (
                      <motion.button
                        key={chip.id}
                        whileTap={{ scale: 0.93 }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setSelectedConcern(prev => prev === chip.id ? '' : chip.id)}
                        className={`card py-3.5 px-3 flex flex-col items-center gap-1 transition-all ${
                          selectedConcern === chip.id ? 'border-2 border-brand-gold' : ''
                        }`}
                        style={selectedConcern === chip.id ? { background: 'rgba(201,169,110,0.06)' } : {}}
                      >
                        <span className="text-[17px] font-black text-brand-gold">{chip.icon}</span>
                        <p className="text-[11px] text-text-primary font-medium text-center leading-tight">{chip.label}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* 자유 입력 */}
                <div>
                  <p className="text-h3 text-text-primary mb-2">구체적으로 궁금한 게 있다면 <span className="text-text-hint font-normal text-caption">(선택)</span></p>
                  <textarea
                    value={userConcern}
                    onChange={(e) => setUserConcern(e.target.value)}
                    placeholder="예: 오늘 면접이 있는데 잘 될까요?&#10;이번 달 재테크 타이밍이 궁금해요..."
                    maxLength={300} rows={3}
                    className="input-field w-full !rounded-2xl resize-none text-body"
                    style={{ paddingTop: 14, paddingBottom: 14, minHeight: 90 }}
                  />
                </div>

                <div className="flex gap-2">
                  <Button fullWidth size="lg" variant="gold" onClick={submitFortune}>운세 보기</Button>
                  <button onClick={submitFortune} className="flex-shrink-0 px-5 py-3.5 rounded-xl text-body-sm font-semibold text-text-muted bg-bg-surface">건너뛰기</button>
                </div>
              </div>
            </motion.div>
            )
          ) : result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              {/* AI 에러 시 에러+폴백 표시 */}
              {!aiLoading && aiError && !aiResult && (
                <div className="card py-3 px-4 flex items-center justify-between" style={{ background: 'rgba(211,47,47,0.04)', border: '1px solid rgba(211,47,47,0.12)' }}>
                  <div>
                    <p className="text-caption text-func-danger font-semibold">AI 맞춤 분석에 실패했어요</p>
                    <p className="text-[10px] text-text-hint mt-0.5">기본 운세를 보여드리고 있어요</p>
                  </div>
                  <button onClick={async () => {
                    setAiError('');
                    setAiLoading(true);
                    try {
                      const concernIdx = CONCERN_CHIPS.findIndex(c => c.id === selectedConcern);
                      const answersArr = [concernIdx >= 0 ? concernIdx : 5];
                      const sajuSummary = selectedProfile?.sajuData ? { ilgan: selectedProfile.sajuData.pillars?.[2]?.천간 || '', oheng: ilganOheng || '', name: selectedProfile.name || '' } : undefined;
                      const aiData = await generateDailyFortune(answersArr, timeSlot, sajuSummary, userConcern || undefined);
                      if (aiData) setAiResult(aiData);
                    } catch (e: any) { setAiError(e?.message || '재시도 실패'); }
                    finally { setAiLoading(false); }
                  }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white" style={{ background: '#C9A96E' }}>
                    재시도
                  </button>
                </div>
              )}

              {/* 등급 카드 */}
              <div className="card-navy text-center py-8">
                <motion.div
                  className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-3"
                  style={{ background: result.gradeColor + '25' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                >
                  <span className="text-4xl font-black text-white">{result.grade}</span>
                </motion.div>
                <p className="text-h2" style={{ color: result.gradeColor }}>{result.gradeLabel}</p>
                <p className="text-caption text-white/40 mt-1">{dateStr}</p>
              </div>

              {/* 요약 */}
              <div className="card">
                <p className="text-body text-text-secondary leading-relaxed whitespace-pre-line">
                  {stripMd(result.summary)}
                </p>
              </div>

              {/* 점수 */}
              <div className="grid grid-cols-4 gap-2">
                {result.scores.map((s: any, i: number) => (
                  <motion.div
                    key={s.label}
                    className="card text-center py-3 space-y-1.5"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                  >
                    <div className="w-2 h-2 rounded-full mx-auto" style={{ background: s.color }} />
                    <div className="relative w-full h-1.5 bg-border-light rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: s.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${s.score}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
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
                    { label: '컬러', value: result.lucky.color, hex: result.lucky.colorHex },
                    { label: '숫자', value: String(result.lucky.number) },
                    { label: '방위', value: result.lucky.direction },
                    { label: '아이템', value: result.lucky.item },
                    { label: '음식', value: result.lucky.food },
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
                <p className="text-body text-text-primary leading-relaxed">
                  {stripMd(result.advice)}
                </p>
              </div>

              {/* 사주 연계 — 있을 때만 */}
              {hasHistory && (
                <div className="card">
                  <p className="text-h3 text-text-primary mb-3">내 사주와 오늘의 기운</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-2 flex-shrink-0" />
                      <p className="text-body-sm text-text-secondary leading-relaxed">
                        {ilgan}({ilganOheng}) 일간인 {recentReport!.name}님에게 오늘은
                        {result.scores[0].score > 75 ? ' 연애운이 특히 좋은 날이에요.' : result.scores[1].score > 75 ? ' 직장에서 좋은 소식이 있을 수 있어요.' : ' 안정적인 하루가 될 거예요.'}
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-2 flex-shrink-0" />
                      <p className="text-body-sm text-text-secondary leading-relaxed">
                        오행 기준으로 오늘은 {['목(木)', '화(火)', '토(土)', '금(金)', '수(水)'][new Date().getDay() % 5]} 기운이 강해요.
                        {recentReport!.sajuData.elements ? (() => {
                          const todayOheng = ['목', '화', '토', '금', '수'][new Date().getDay() % 5] as string;
                          const myVal = (recentReport!.sajuData.elements as any)[todayOheng] || 0;
                          return myVal >= 2
                            ? ' 사주와 공명하는 날이라 에너지가 좋아요.'
                            : ' 평소 부족한 기운을 보충하기 좋은 날이에요.';
                        })() : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 오늘의 시간대별 흐름 */}
              <div className="card">
                <p className="text-h3 text-text-primary mb-3">시간대별 흐름</p>
                <div className="space-y-2">
                  {[
                    { time: '오전', desc: '양(陽) 기운이 강해 새로운 시작에 유리해요', score: Math.min(98, result.scores[1].score + 5) },
                    { time: '오후', desc: '금(金) 기운으로 판단력과 결정력이 좋아져요', score: result.scores[2].score },
                    { time: '저녁', desc: '수(水) 기운이 내면 성찰과 휴식에 적합해요', score: Math.min(98, result.scores[3].score + 3) },
                  ].map((slot) => (
                    <div key={slot.time} className="flex items-center gap-3 py-2">
                      <span className="text-label text-brand-gold w-10 flex-shrink-0">{slot.time}</span>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-border-light overflow-hidden mb-1">
                          <motion.div className="h-full rounded-full bg-brand-gold" initial={{ width: 0 }} animate={{ width: `${slot.score}%` }} transition={{ duration: 1 }} />
                        </div>
                        <p className="text-caption text-text-muted">{slot.desc}</p>
                      </div>
                      <span className="text-label text-text-primary w-8 text-right">{slot.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="space-y-3">
                <Button variant="gold" fullWidth size="lg" onClick={() => navigate('/input')}>
                  {hasHistory ? '더 깊은 분석 보러 가기' : '내 사주도 분석해보기'}
                </Button>
                <p className="text-center text-tiny text-text-hint">1운(500원) · 12가지 심층 분석</p>

                <button
                  onClick={async () => {
                    const shareData = {
                      title: '오늘의 운세 — 사주500',
                      text: `${targetName || '내'} 운세 등급 ${result.grade}등급! 오늘 하루의 운세가 궁금하다면?`,
                      url: `${window.location.origin}/daily`,
                    };
                    try {
                      if (navigator.share) {
                        await navigator.share(shareData);
                        toast.show('공유 완료!', 'success');
                      } else {
                        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
                        toast.show('링크가 복사됐어요!', 'success');
                      }
                    } catch {
                      try {
                        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
                        toast.show('링크가 복사됐어요!', 'success');
                      } catch {
                        toast.show('공유에 실패했어요', 'warning');
                      }
                    }
                  }}
                  className="w-full py-3 rounded-xl text-caption font-bold"
                  style={{ background: '#C9A96E20', color: '#C9A96E' }}
                >
                  친구에게 공유하기
                </button>
                {/* 배너 광고 — 앱인토스에서만 */}
                <BannerAdLazy className="mt-3" />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
