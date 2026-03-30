import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';

const QUESTIONS = [
  { q: '오늘 아침 기분이 어떤가요?', options: ['상쾌해요', '보통이에요', '무거워요'] },
  { q: '요즘 가장 신경 쓰이는 건?', options: ['일/공부', '사람관계', '돈', '건강', '연애'] },
  { q: '오늘 하루 바라는 건?', options: ['좋은 소식', '평온한 하루', '새로운 만남', '성취감'] },
];

const FORTUNE = {
  grade: '상', emoji: '🌟', title: '새로운 시작의 기운',
  content: `오늘은 목(木)의 기운이 강하게 작용하는 날입니다. 새로운 시작에 유리한 에너지가 감돌고 있어요.\n\n특히 오전 중에 떠오르는 아이디어나 영감을 놓치지 마세요. 평소와 다른 루트로 출퇴근하거나, 새로운 카페를 방문하는 것만으로도 좋은 기운을 받을 수 있습니다.\n\n대인관계에서는 솔직한 소통이 열쇠입니다. 오늘은 용기 내어 속마음을 표현해보세요.`,
  lucky: { color: '초록색', number: 3, direction: '동쪽' },
};

export function DailyFortunePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  function selectAnswer(answer: string) {
    setAnswers([...answers, answer]);
    setTimeout(() => setStep(step + 1), 300);
  }

  const showResult = step >= QUESTIONS.length;

  return (
    <div className="page-container min-h-screen flex flex-col">
      {!showResult ? (
        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <FadeIn>
                <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--brand-accent)' }}>
                  {step + 1}/{QUESTIONS.length}
                </p>
                <h2 className="text-h1 mb-6" style={{ color: 'var(--text-primary)' }}>{QUESTIONS[step].q}</h2>
                <div className="flex flex-col gap-2.5">
                  {QUESTIONS[step].options.map((opt) => (
                    <button key={opt} onClick={() => selectAnswer(opt)}
                      className="card text-left text-[14px] font-bold hover:shadow-brand-lg transition-all"
                      style={{ color: 'var(--text-primary)' }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </FadeIn>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="flex-1">
          <FadeIn>
            <div className="text-center pt-6 mb-6">
              <span className="text-[48px]">{FORTUNE.emoji}</span>
              <p className="text-h1 mt-3" style={{ color: 'var(--text-primary)' }}>{FORTUNE.title}</p>
              <span className="badge badge-gold mt-2">오늘의 운세: {FORTUNE.grade}</span>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="card mb-4">
              <p className="text-[13px] leading-[1.85] whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                {FORTUNE.content}
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.25}>
            <div className="card mb-6">
              <p className="text-[13px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>오늘의 행운 포인트</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: '행운색', val: FORTUNE.lucky.color },
                  { label: '행운 숫자', val: FORTUNE.lucky.number },
                  { label: '행운 방향', val: FORTUNE.lucky.direction },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[10px]" style={{ color: 'var(--text-hint)' }}>{item.label}</p>
                    <p className="text-[14px] font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{item.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.35}>
            <div className="card-gold text-center py-6 mb-4">
              <p className="text-h2" style={{ color: 'var(--text-primary)' }}>더 깊이 알고 싶다면</p>
              <p className="text-[12px] mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
                AI가 분석하는 극상 사주 풀이, 단 550원
              </p>
              <Button variant="gold" onClick={() => navigate('/input')}>내 사주 보러 가기</Button>
            </div>
          </FadeIn>
        </motion.div>
      )}
    </div>
  );
}
