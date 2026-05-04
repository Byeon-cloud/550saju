import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { Button } from '@/components/common/Button';
import { BannerAd as BannerAdLazy } from '@/components/ads/BannerAd';
import { getProfiles, spendBalance, saveReport, generateId, type SajuProfile } from '@/services/storage/localStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { usePageTitle } from '@/hooks/usePageTitle';
import { hasFreePass, useFreePass } from '@/services/storage/dailyFreePass';
import { useToast } from '@/components/common/Toast';
import { generateDailyFortune } from '@/services/ai/reportGenerator';
import { stripMd } from '@/utils/format';
import { Pictogram, type ConcernKey } from '@/components/brand/PictogramRegistry';

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

// ─── 고민 영역 칩 (1단계 선택 UI용) — 이모지 제거, 브랜드 픽토그램 사용
//    id는 PictogramRegistry의 concern:* key와 1:1 매핑 (브랜드픽토그램_시스템.md)
const CONCERN_CHIPS: Array<{ id: ConcernKey; label: string }> = [
  { id: 'career',  label: '이직 · 진로'   },
  { id: 'love',    label: '연애 · 관계'   },
  { id: 'wealth',  label: '재정 · 투자'   },
  { id: 'health',  label: '체력 · 건강'   },
  { id: 'people',  label: '인간관계'       },
  { id: 'general', label: '전반적인 흐름'  },
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
  // 브랜드 컬러 — Deep Navy + Gold (오행 초록/빨강 금지)
  const gradeColor = grade === 'S' ? '#C9A96E' : grade === 'A' ? '#A08B6A' : grade === 'B' ? '#2D4470' : '#8F6B4E';

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
      { label: '재물운', score: wealthScore, color: '#A08B6A' },
      { label: '건강운', score: healthScore, color: '#6B8E4E' },
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
  const [selectedProfile, setSelectedProfile] = useState<SajuProfile | null>(null);
  const [profileSelected, setProfileSelected] = useState(false);
  // 새 단순화 UX: 고민 영역 칩 선택 + 자유 입력
  const [selectedConcern, setSelectedConcern] = useState<string>('');
  const [userConcern, setUserConcern] = useState('');

  const timeSlot = useMemo(() => getTimeSlot(), []);
  const ctx = TIME_CONTEXT[timeSlot];

  // 프로필 목록 (독립 저장소)
  const profiles = useMemo(() => getProfiles(), []);

  // 단일 프로필이면 자동 선택
  const recentReport = selectedProfile;
  const hasHistory = !!recentReport;
  const ilgan = recentReport?.sajuData?.pillars?.[2]?.천간;
  const ilganOheng = ilgan ? CHEONGAN_OHENG[ilgan] : undefined;

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState('');
  // 더블클릭 가드 — InputPage 패턴 (ref로 렌더 전 차단)
  const isSubmittingRef = useRef(false);

  const localResult = useMemo(() => getFortuneResult(timeSlot, hasHistory, ilgan, ilganOheng, recentReport), [timeSlot, hasHistory, ilgan, ilganOheng, recentReport]);

  // AI 결과를 UI 형식으로 변환 (scores 객체→배열, grade 등)
  const normalizedAiResult = useMemo(() => {
    if (!aiResult) return null;
    const gradeColor = aiResult.grade === 'S' ? '#C9A96E' : aiResult.grade === 'A' ? '#A08B6A' : aiResult.grade === 'B' ? '#2D4470' : '#8F6B4E';
    return {
      ...aiResult,
      gradeColor,
      scores: Array.isArray(aiResult.scores) ? aiResult.scores : [
        { label: '연애운', score: aiResult.scores?.love ?? 70, color: '#C9A96E' },
        { label: '직장운', score: aiResult.scores?.career ?? 70, color: '#2D4470' },
        { label: '재물운', score: aiResult.scores?.wealth ?? 70, color: '#A08B6A' },
        { label: '건강운', score: aiResult.scores?.health ?? 70, color: '#6B8E4E' },
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
    // 더블클릭 가드 — 연타 시 중복 과금 차단
    if (isSubmittingRef.current || aiLoading) return;
    isSubmittingRef.current = true;

    // 과금: 무료 1회 → 이후 1운
    if (hasFreePass('daily')) {
      useFreePass('daily');
    } else if (spendBalance(1)) {
      toast.show('1운이 차감됐어요', 'info');
    } else {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '오늘의 운세에 1운이 필요해요' } });
      isSubmittingRef.current = false;
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
      isSubmittingRef.current = false;
    }
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const timeStr = today.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  // 프로필 미선택 → 선택 화면
  if (!profileSelected && profiles.length > 0) {
    return (
      <div className="min-h-screen pb-tab-safe bg-hanji">
        <div className="px-5 pt-8 space-y-6 relative">
          <FadeIn>
            <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
              오늘의 운세
            </p>
            <h1 className="text-editorial-display mt-2" style={{ color: 'var(--ink-black)' }}>
              누구의 운을<br/>살펴볼까요
            </h1>
            <div className="gold-hairline !my-4">
              <span className="gold-hairline-symbol">◈</span>
            </div>
            <p className="text-body-sm" style={{ color: 'var(--ink-muted)' }}>
              이전에 입력한 사주를 선택하거나, 사주 없이도 볼 수 있어요.
            </p>
          </FadeIn>

          <div className="space-y-2.5">
            {profiles.map((r) => {
              const il = r.sajuData?.pillars?.[2]?.천간 || '';
              const oh = il ? CHEONGAN_OHENG[il] : '';
              const rel = r.input.relation || '본인';
              return (
                <motion.button
                  key={r.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedProfile(r); setProfileSelected(true); }}
                  className="card-editorial w-full text-left !py-4 !px-4 transition-all hover:shadow-lg"
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 font-serif-ko"
                      style={{
                        background: rel === '본인'
                          ? 'linear-gradient(135deg, #2E2A25 0%, #1A1A1F 100%)'
                          : 'linear-gradient(135deg, #C9A96E 0%, #A08B6A 100%)',
                        boxShadow: '0 2px 6px rgba(27,22,15,0.15)'
                      }}>
                      <span className="text-[20px] font-bold text-white">
                        {r.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-editorial-h2" style={{ color: 'var(--ink-black)' }}>{r.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-serif-ko"
                          style={{ background: 'rgba(201,169,110,0.12)', color: 'var(--brand-gold)' }}>
                          {rel}
                        </span>
                      </div>
                      <p className="text-caption font-serif-ko mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                        {il ? `${il}(${oh}) 일간` : '사주 정보'}
                      </p>
                    </div>
                    <span className="font-serif-ko text-[18px]" style={{ color: 'var(--brand-gold)' }}>›</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <button
            onClick={() => { setSelectedProfile(null); setProfileSelected(true); }}
            className="w-full text-center py-5 relative"
            style={{
              background: 'transparent',
              border: '1.5px dashed rgba(165,155,141,0.4)',
              borderRadius: '4px'
            }}
          >
            <p className="text-editorial-h2" style={{ color: 'var(--ink-muted)' }}>사주 없이 일반 운세 보기</p>
          </button>

          <button
            onClick={() => navigate('/input?new=1')}
            className="w-full text-center font-serif-ko font-semibold py-2"
            style={{ color: 'var(--brand-gold)', fontSize: 13, letterSpacing: '0.05em' }}
          >
            + 새 사주 입력하기
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
    <div className="min-h-screen pb-tab-safe bg-hanji">
      <div className="px-5 pt-6 space-y-6 relative">

        {/* 시간대별 인사 — 편집자적 헤더 (한자 걷어냄) */}
        <FadeIn>
          <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
            {ctx.label} · 오늘의 운
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>
            {dateStr} · {timeStr}
          </p>

          <h1 className="text-editorial-display mt-4" style={{ color: 'var(--ink-black)' }}>
            {ctx.greeting}
          </h1>

          <div className="gold-hairline !mt-4 !mb-2">
            <span className="gold-hairline-symbol">◇</span>
          </div>

          <p className="font-serif-ko text-[14px]" style={{ color: 'var(--ink-soft)', letterSpacing: '0.01em' }}>
            {ctx.sub}
          </p>

          {hasHistory && (
            <div className="mt-3 px-4 py-2.5 rounded-sm flex items-center gap-2"
              style={{
                background: 'rgba(201,169,110,0.08)',
                borderLeft: '2px solid var(--brand-gold)'
              }}>
              <p className="text-caption font-serif-ko" style={{ color: 'var(--ink-soft)' }}>
                <b style={{ color: 'var(--ink-black)' }}>{recentReport!.name}</b>님의 {ilgan}({ilganOheng}) 일간 기반 맞춤 풀이
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
                <div className="card-editorial !py-6 !px-6">
                  <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
                    다른 사람의 오늘
                  </p>
                  <h2 className="text-editorial-display mt-2" style={{ color: 'var(--ink-black)', fontSize: 26 }}>
                    {targetName}님의<br/>요즘을 알려주세요
                  </h2>
                  <div className="mt-3 h-px" style={{ background: 'linear-gradient(90deg, rgba(201,169,110,0.4), transparent)' }} />
                  <p className="font-serif-ko text-[13px] mt-3" style={{ color: 'var(--ink-muted)' }}>
                    {targetName}님이 요즘 무엇을 고민하시는지 알고 있는 범위에서.
                  </p>
                </div>

                <textarea
                  value={userConcern}
                  onChange={(e) => setUserConcern(e.target.value)}
                  placeholder={`예: ${targetName}님이 이직을 고민하고 있어요 / 연애 문제로 힘들어해요...`}
                  maxLength={300}
                  rows={5}
                  className="w-full font-serif-ko resize-none text-[14px] leading-[1.85]"
                  style={{
                    padding: '16px',
                    minHeight: 150,
                    background: 'var(--hanji-cream-soft)',
                    border: '1px solid rgba(165,155,141,0.25)',
                    borderRadius: '4px',
                    color: 'var(--ink-soft)',
                    outline: 'none'
                  }}
                />

                <div className="flex gap-2">
                  <Button fullWidth size="lg" variant="gold" onClick={submitFortune} disabled={aiLoading} loading={aiLoading}>운세 보기</Button>
                  <button onClick={submitFortune} disabled={aiLoading}
                    className="flex-shrink-0 px-5 py-3.5 font-serif-ko text-[13px] font-semibold disabled:opacity-50"
                    style={{ color: 'var(--ink-muted)', background: 'rgba(165,155,141,0.08)', borderRadius: '4px' }}>
                    건너뛰기
                  </button>
                </div>

                <div className="card-editorial !py-4 !px-5">
                  <p className="font-serif-ko text-[14px] font-semibold" style={{ color: 'var(--ink-black)' }}>
                    더 정확한 풀이는 {targetName}님 본인이 직접.
                  </p>
                  <p className="text-caption mt-1" style={{ color: 'var(--ink-muted)' }}>
                    사주500을 공유하면 {targetName}님도 직접 운세를 볼 수 있어요
                  </p>
                  <button onClick={async () => { const { shareResult } = await import('@/utils/share'); shareResult({ name: targetName, reportId: 'daily' }); }}
                    className="mt-2 font-serif-ko text-caption font-bold" style={{ color: 'var(--brand-gold)' }}>
                    {targetName}님에게 공유하기 →
                  </button>
                </div>
              </div>
            </motion.div>
            ) : (
            /* ====== 본인 → 단순화된 단일 화면 (고민 영역 + 자유 입력) ====== */
            <motion.div key="concern-input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <div className="space-y-5">

                {/* 시간대 톤 카드 — 명조체 pull-quote */}
                <div className="relative py-6 px-6"
                  style={{
                    background: 'var(--hanji-cream-soft)',
                    borderLeft: '3px solid var(--brand-gold)',
                    borderRadius: '2px',
                    boxShadow: '0 2px 10px rgba(27,22,15,0.05)'
                  }}>
                  <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
                    {ctx.label}
                  </p>
                  <h2 className="font-serif-ko text-[18px] leading-[1.6] font-semibold mt-2"
                    style={{ color: 'var(--ink-black)', letterSpacing: '-0.01em' }}>
                    {ctx.tone}
                  </h2>
                </div>

                {/* 고민 영역 칩 — 편집자적 */}
                <div>
                  <div className="gold-hairline !mt-0 !mb-4">
                    <span className="gold-hairline-symbol">요즘 가장 신경 쓰이는 영역</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {CONCERN_CHIPS.map((chip, i) => {
                      const active = selectedConcern === chip.id;
                      return (
                        <motion.button
                          key={chip.id}
                          whileTap={{ scale: 0.93 }}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => setSelectedConcern(prev => prev === chip.id ? '' : chip.id)}
                          className="py-4 px-2 flex flex-col items-center gap-1.5 transition-all relative"
                          style={{
                            background: active ? 'var(--hanji-cream-deep)' : 'var(--hanji-cream-soft)',
                            border: active ? '1.5px solid var(--brand-gold)' : '1px solid rgba(165,155,141,0.2)',
                            borderRadius: '4px',
                            boxShadow: active ? '0 2px 8px rgba(201,169,110,0.2)' : 'none'
                          }}
                        >
                          <Pictogram k={`concern:${chip.id}`} size={22} color={active ? '#B8322D' : '#C9A96E'} />
                          <p className="font-serif-ko text-[11px] font-medium text-center leading-tight"
                            style={{ color: active ? 'var(--ink-black)' : 'var(--ink-soft)' }}>
                            {chip.label}
                          </p>
                          {active && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                              style={{ background: 'var(--seal-red)' }} />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* 자유 입력 */}
                <div>
                  <div className="gold-hairline !mt-0 !mb-3">
                    <span className="gold-hairline-symbol">구체적으로 궁금한 것 <span className="font-normal opacity-70">(선택)</span></span>
                  </div>
                  <textarea
                    value={userConcern}
                    onChange={(e) => setUserConcern(e.target.value)}
                    placeholder="예: 오늘 면접이 있는데 잘 될까요?&#10;이번 달 재테크 타이밍이 궁금해요..."
                    maxLength={300} rows={3}
                    className="w-full font-serif-ko resize-none text-[14px] leading-[1.85]"
                    style={{
                      padding: '14px 16px',
                      minHeight: 96,
                      background: 'var(--hanji-cream-soft)',
                      border: '1px solid rgba(165,155,141,0.25)',
                      borderRadius: '4px',
                      color: 'var(--ink-soft)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div className="flex gap-2">
                  <Button fullWidth size="lg" variant="gold" onClick={submitFortune} disabled={aiLoading} loading={aiLoading}>운세 보기</Button>
                  <button onClick={submitFortune} disabled={aiLoading}
                    className="flex-shrink-0 px-5 py-3.5 font-serif-ko text-[13px] font-semibold disabled:opacity-50"
                    style={{ color: 'var(--ink-muted)', background: 'rgba(165,155,141,0.08)', borderRadius: '4px' }}>
                    건너뛰기
                  </button>
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
                <div className="py-3 px-4 flex items-center justify-between"
                  style={{ background: 'rgba(184,50,45,0.06)', border: '1px solid rgba(184,50,45,0.2)', borderRadius: '4px' }}>
                  <div>
                    <p className="text-caption font-serif-ko font-semibold" style={{ color: 'var(--seal-red)' }}>AI 맞춤 분석에 실패했어요</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>기본 운세를 보여드리고 있어요</p>
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
                    className="px-3 py-1.5 text-[11px] font-bold text-white font-serif-ko"
                    style={{ background: 'var(--brand-gold)', borderRadius: '3px' }}>
                    재시도
                  </button>
                </div>
              )}

              {/* ===== 등급 카드 — 밝은 크림 + 골드 ===== */}
              <div className="card-editorial text-center !py-10 relative">
                <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
                  오늘의 운
                </p>

                <motion.div
                  className="relative w-32 h-32 mx-auto mt-4 flex items-center justify-center"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                >
                  <svg viewBox="0 0 140 140" className="absolute inset-0 w-full h-full" style={{ opacity: 0.5 }}>
                    <circle cx="70" cy="70" r="66" fill="none" stroke={result.gradeColor} strokeWidth="0.5" strokeDasharray="2 4" />
                    <circle cx="70" cy="70" r="58" fill="none" stroke={result.gradeColor} strokeWidth="1" />
                  </svg>
                  <span className="font-serif-ko font-black leading-none"
                    style={{
                      fontSize: 88,
                      color: result.gradeColor,
                      textShadow: `0 2px 18px ${result.gradeColor}40`,
                      letterSpacing: '-0.02em'
                    }}>
                    {result.grade}
                  </span>
                </motion.div>

                <p className="font-serif-ko text-[22px] mt-3 font-semibold"
                  style={{ color: 'var(--ink-black)', letterSpacing: '-0.01em' }}>
                  {result.gradeLabel}
                </p>
                <p className="text-[10px] mt-2 font-serif-ko" style={{ color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>
                  {dateStr}
                </p>
              </div>

              {/* ===== 요약 — 편집자적 명조체 본문 ===== */}
              <div className="card-editorial relative">
                <div className="gold-hairline !mt-0 !mb-4">
                  <span className="gold-hairline-symbol">풀이</span>
                </div>
                <p className="text-editorial-quote drop-cap whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>
                  {stripMd(result.summary)}
                </p>
                {/* 하단 서명 */}
                <div className="flex items-center justify-end mt-4 pt-3"
                  style={{ borderTop: '0.5px solid rgba(201,169,110,0.2)' }}>
                  <span className="font-serif-ko text-[10px]" style={{ color: 'var(--ink-faint)', letterSpacing: '0.18em' }}>
                    사주500
                  </span>
                </div>
              </div>

              {/* ===== 점수 — 편집자적 막대 차트 ===== */}
              <div className="card-editorial">
                <div className="gold-hairline !mt-0 !mb-5">
                  <span className="gold-hairline-symbol">점수</span>
                </div>
                <div className="space-y-4">
                  {result.scores.map((s: any, i: number) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      className="relative"
                    >
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="font-serif-ko text-[14px] font-semibold" style={{ color: 'var(--ink-black)' }}>
                          {s.label}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-serif-ko text-[20px] font-bold" style={{ color: s.color }}>
                            {s.score}
                          </span>
                          <span className="text-[10px] font-serif-ko" style={{ color: 'var(--ink-faint)' }}>/100</span>
                        </div>
                      </div>
                      <div className="relative h-[3px] w-full overflow-hidden"
                        style={{ background: 'rgba(165,155,141,0.18)', borderRadius: '2px' }}>
                        <motion.div
                          className="absolute top-0 left-0 h-full"
                          style={{ background: `linear-gradient(90deg, ${s.color}, ${s.color}CC)`, borderRadius: '2px' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${s.score}%` }}
                          transition={{ delay: 0.5 + i * 0.1, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* ===== 행운 — 편집자적 그리드 ===== */}
              <div className="card-editorial relative">
                <div className="gold-hairline !mt-0 !mb-5">
                  <span className="gold-hairline-symbol">오늘의 행운</span>
                </div>
                <div className="grid grid-cols-3 gap-y-5 gap-x-2">
                  {[
                    { label: '컬러', value: result.lucky.color, hex: result.lucky.colorHex },
                    { label: '숫자', value: String(result.lucky.number) },
                    { label: '방위', value: result.lucky.direction },
                    { label: '아이템', value: result.lucky.item },
                    { label: '음식', value: result.lucky.food },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      {item.hex ? (
                        <div className="w-10 h-10 mx-auto mb-2 relative"
                          style={{ background: item.hex, borderRadius: '2px', boxShadow: `0 2px 10px ${item.hex}30, inset 0 1px 0 rgba(255,255,255,0.3)` }}>
                          <div className="absolute inset-1 border border-white/20" style={{ borderRadius: '1px' }} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 mx-auto mb-2 flex items-center justify-center"
                          style={{
                            background: 'var(--hanji-cream-deep)',
                            borderRadius: '50%',
                            border: '0.5px solid rgba(201,169,110,0.3)'
                          }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-gold)' }} />
                        </div>
                      )}
                      <p className="font-serif-ko text-[14px] font-semibold" style={{ color: 'var(--ink-black)' }}>
                        {item.value}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===== 시간대별 조언 — 명조체 인용 ===== */}
              <div className="relative py-6 px-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(201,169,110,0.08) 0%, rgba(253,248,238,0.6) 100%)',
                  borderLeft: '3px solid var(--brand-gold)',
                  borderRadius: '2px'
                }}>
                <span className="absolute -top-2 left-4 font-serif-ko text-[34px] leading-none"
                  style={{ color: 'var(--brand-gold)', opacity: 0.5 }}>"</span>
                <p className="text-editorial-caption" style={{ color: 'var(--brand-gold)' }}>
                  {ctx.label}의 조언
                </p>
                <p className="font-serif-ko text-[15px] leading-[1.85] mt-2 italic" style={{ color: 'var(--ink-black)' }}>
                  {stripMd(result.advice)}
                </p>
              </div>

              {/* ===== 사주 연계 — 편집자적 ===== */}
              {hasHistory && (
                <div className="card-editorial">
                  <div className="gold-hairline !mt-0 !mb-4">
                    <span className="gold-hairline-symbol">내 사주와 오늘</span>
                  </div>
                  <div className="space-y-3 relative">
                    <p className="font-serif-ko text-[14px] leading-[1.85]" style={{ color: 'var(--ink-soft)' }}>
                      <b style={{ color: 'var(--ink-black)' }}>{ilgan}({ilganOheng}) 일간</b>인 {recentReport!.name}님에게 오늘은
                      {result.scores[0].score > 75 ? ' 연애운이 특히 좋은 날이에요.' : result.scores[1].score > 75 ? ' 직장에서 좋은 소식이 있을 수 있어요.' : ' 안정적인 하루가 될 거예요.'}
                    </p>
                    <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.3), transparent)' }} />
                    <p className="font-serif-ko text-[14px] leading-[1.85]" style={{ color: 'var(--ink-soft)' }}>
                      오늘은 <b style={{ color: 'var(--ink-black)' }}>{['목', '화', '토', '금', '수'][new Date().getDay() % 5]}</b> 기운이 강한 날.
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
              )}

              {/* ===== 오늘의 시간대별 흐름 ===== */}
              <div className="card-editorial">
                <div className="gold-hairline !mt-0 !mb-5">
                  <span className="gold-hairline-symbol">시간대별 흐름</span>
                </div>
                <div className="space-y-4">
                  {[
                    { time: '오전', desc: '새로운 시작에 유리한 양(陽)의 에너지', score: Math.min(98, result.scores[1].score + 5) },
                    { time: '오후', desc: '판단력과 결정력이 또렷해지는 시간', score: result.scores[2].score },
                    { time: '저녁', desc: '내면 성찰과 휴식에 적합한 시간', score: Math.min(98, result.scores[3].score + 3) },
                  ].map((slot) => (
                    <div key={slot.time} className="flex items-start gap-3">
                      <span className="font-serif-ko text-[13px] font-semibold flex-shrink-0 w-10 pt-0.5" style={{ color: 'var(--ink-black)' }}>{slot.time}</span>
                      <div className="flex-1">
                        <div className="h-[3px] overflow-hidden mb-1.5"
                          style={{ background: 'rgba(165,155,141,0.18)', borderRadius: '2px' }}>
                          <motion.div className="h-full"
                            style={{ background: 'linear-gradient(90deg, var(--brand-gold), var(--brand-gold-light))', borderRadius: '2px' }}
                            initial={{ width: 0 }} animate={{ width: `${slot.score}%` }} transition={{ duration: 1 }} />
                        </div>
                        <p className="text-caption" style={{ color: 'var(--ink-muted)' }}>{slot.desc}</p>
                      </div>
                      <span className="font-serif-ko text-[14px] font-bold w-8 text-right flex-shrink-0" style={{ color: 'var(--brand-gold)' }}>
                        {slot.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===== CTA ===== */}
              <div className="space-y-3">
                <div className="gold-hairline">
                  <span className="gold-hairline-symbol">◈</span>
                </div>
                <Button variant="gold" fullWidth size="lg" onClick={() => navigate('/input')}>
                  {hasHistory ? '더 깊은 분석 보러 가기' : '내 사주도 분석해보기'}
                </Button>
                <p className="text-center text-[11px] font-serif-ko" style={{ color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>
                  1운(500원) · 12가지 심층 분석
                </p>

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
                  className="w-full py-3 font-serif-ko text-[12px] font-bold"
                  style={{
                    background: 'rgba(201,169,110,0.1)',
                    color: 'var(--brand-gold)',
                    border: '0.5px solid rgba(201,169,110,0.3)',
                    borderRadius: '3px',
                    letterSpacing: '0.08em'
                  }}
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
