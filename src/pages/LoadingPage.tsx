import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSajuContext } from '@/contexts/SajuContext';
import { generateReport } from '@/services/ai/reportGenerator';

const STEPS = [
  '만세력을 계산하고 있어요...',
  '사주의 구조를 분석하고 있어요...',
  '오행의 균형을 살펴보고 있어요...',
  '십성과 격국을 판단하고 있어요...',
  '대운의 흐름을 읽고 있어요...',
  '리포트를 작성하고 있어요...',
];

/** 사주 꿀팁 — 랜덤으로 표시 */
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
  { category: '실생활 활용', text: '식신(食神)이 강한 사람은 요리에 재능이 있어요. 직접 만든 음식이 스트레스 해소에도 좋습니다.' },
  { category: '사주500 가이드', text: '결과 리포트의 점수는 절대값이 아니에요. 내 사주 구조 안에서의 상대적 강약을 보여줍니다.' },
  { category: '사주500 가이드', text: '시간을 모를 때는 6글자로 분석하지만, 시간을 알면 8글자 분석이 가능해서 훨씬 정밀해져요.' },
  { category: '사주500 가이드', text: '같은 날 태어나도 시간에 따라 사주가 완전히 달라져요. 출생 시간이 그만큼 중요합니다.' },
  { category: '사주500 가이드', text: '대운은 10년 단위로 바뀌는 큰 흐름이에요. 지금 내가 어떤 대운에 있는지 꼭 확인해보세요.' },
  { category: '명리학 상식', text: '적천수(滴天髓)는 "하늘의 정수가 한 방울씩 떨어진다"는 뜻이에요. 명리학의 바이블입니다.' },
  { category: '명리학 상식', text: '음양오행은 2,500년 전부터 내려온 동양 자연철학이에요. 미신이 아닌 체계적 분석 도구입니다.' },
  { category: '명리학 상식', text: '격국(格局)은 사주의 "성격 유형"과 비슷해요. MBTI처럼, 사주에도 분류 체계가 있습니다.' },
  { category: '명리학 상식', text: '12운성은 에너지의 생로병사를 나타내요. "사(死)"는 실제 죽음이 아니라 에너지의 수렴 단계입니다.' },
  { category: '재미 상식', text: '한국에서 사주를 가장 많이 보는 시기는 새해 1월과 결혼 시즌인 5~6월이에요.' },
  { category: '재미 상식', text: '조선시대에는 혼인 전 반드시 사주를 교환했어요. "사주단자"라 불렀습니다.' },
  { category: '재미 상식', text: '같은 시간에 태어난 쌍둥이도 운명이 달라질 수 있어요. 후천적 선택이 그만큼 중요합니다.' },
  { category: '재미 상식', text: '사주에서 "재성"이 강하다고 반드시 부자가 되는 건 아니에요. 돈과의 "인연"이 강하다는 뜻이에요.' },
];

export function LoadingPage() {
  const navigate = useNavigate();
  const { sajuData, situation } = useSajuContext();
  const [step, setStep] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const called = useRef(false);

  // 랜덤 순서로 셔플
  const shuffledTips = useMemo(() => {
    const arr = [...TIPS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  useEffect(() => {
    if (!sajuData) {
      navigate('/', { replace: true });
      return;
    }

    // 스텝 진행
    const stepInterval = setInterval(() => {
      setStep((p) => (p < STEPS.length - 1 ? p + 1 : p));
    }, 2500);

    // 팁 진행 — 5초마다 교체
    const tipInterval = setInterval(() => {
      setTipIndex((p) => (p + 1) % shuffledTips.length);
    }, 5000);

    // AI 리포트 생성 호출 (1회만)
    if (!called.current) {
      called.current = true;
      callGenerateReport();
    }

    async function callGenerateReport() {
      try {
        const result = await generateReport(sajuData!, situation || undefined);
        navigate(`/result/${result.reportId}`, { replace: true });
      } catch (err) {
        console.warn('[LoadingPage] 서버 호출 실패, 로컬 fallback:', err);
        setError('분석 서버 연결 중... 잠시만 기다려주세요.');
        setTimeout(() => {
          navigate('/result/local', { replace: true });
        }, 2000);
      }
    }

    return () => {
      clearInterval(stepInterval);
      clearInterval(tipInterval);
    };
  }, [navigate, sajuData, situation, shuffledTips]);

  const progress = ((step + 1) / STEPS.length) * 100;
  const currentTip = shuffledTips[tipIndex];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg-page-gradient)' }}>

      {/* 태극 로고 회전 */}
      <motion.div
        className="mb-8"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      >
        <svg width="80" height="80" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="11" stroke="#1B2A4A" strokeWidth="1" fill="none" opacity="0.3" />
          <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#1B2A4A" />
          <circle cx="12" cy="7" r="2" fill="#C9A96E" />
          <circle cx="12" cy="17" r="2" fill="#1B2A4A" stroke="#C9A96E" strokeWidth="0.8" />
        </svg>
      </motion.div>

      {/* 분석 단계 텍스트 */}
      <div className="h-7 relative w-full max-w-[300px]">
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            className="text-h3 text-text-primary text-center absolute inset-0"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            {STEPS[step]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-[280px] h-1 bg-border-light rounded-full mt-6 overflow-hidden">
        <motion.div
          className="h-full bg-brand-gold rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {error && (
        <p className="text-caption text-func-warning mt-4 text-center">{error}</p>
      )}

      {/* 사주 꿀팁 카드 */}
      <div className="mt-10 w-full max-w-[320px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tipIndex}
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

      <p className="text-[10px] text-text-disabled mt-6">약 15~20초 소요</p>
    </div>
  );
}
