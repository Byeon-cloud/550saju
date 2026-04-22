import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── 카테고리별 팁 (다양하고 풍성하게) ───
const TIPS: { category: string; text: string }[] = [
  // 오행 꿀팁
  { category: '오행 꿀팁', text: '목(木)이 강한 사람은 아침형 인간이 많아요. 새벽에 일찍 일어나는 습관이 잘 맞습니다.' },
  { category: '오행 꿀팁', text: '화(火)가 부족하면 적극성이 떨어질 수 있어요. 빨간 소품을 가까이 두면 기운 보충에 도움이 됩니다.' },
  { category: '오행 꿀팁', text: '토(土)는 안정과 중재의 에너지예요. 토가 강한 사람은 중재자 역할에 타고난 능력이 있어요.' },
  { category: '오행 꿀팁', text: '금(金)이 강하면 결단력이 뛰어나지만, 너무 강하면 고집으로 나타날 수 있어요.' },
  { category: '오행 꿀팁', text: '수(水)는 지혜와 유연함. 부족하면 물을 많이 마시고 수영을 하는 것만으로도 보충이 됩니다.' },
  { category: '오행 꿀팁', text: '목(木)이 부족한 사람은 녹색 식물을 가까이 두면 자연스럽게 에너지가 보충돼요.' },
  { category: '오행 꿀팁', text: '화(火)가 강한 사람은 열정적이지만 화를 잘 내기도 해요. 수(水)로 균형을 맞춰보세요.' },
  { category: '오행 꿀팁', text: '오행이 골고루 갖춰진 사주는 전체의 10% 미만이에요. 부족한 걸 보충하는 게 핵심이에요.' },
  { category: '오행 꿀팁', text: '토(土)가 없는 사주는 중심을 잡기 어려울 수 있어요. 노란색 소품이나 흙 관련 취미가 도움돼요.' },
  { category: '오행 꿀팁', text: '금(金) 기운이 부족하면 정리정돈이 어렵고 우유부단할 수 있어요. 흰색 옷이 보충에 좋습니다.' },
  { category: '오행 꿀팁', text: '수(水) 기운이 넘치면 생각이 너무 많아질 수 있어요. 화(火) 기운으로 행동력을 높이세요.' },
  { category: '오행 꿀팁', text: '목(木)은 봄, 화(火)는 여름, 토(土)는 환절기, 금(金)은 가을, 수(水)는 겨울의 기운이에요.' },

  // 알쓸사잡
  { category: '알쓸사잡', text: '사주의 "사(四)"는 네 기둥, "주(柱)"는 기둥이라는 뜻이에요. 태어난 년·월·일·시 각각 하나의 기둥입니다.' },
  { category: '알쓸사잡', text: '천간(天干)은 하늘의 기운, 지지(地支)는 땅의 기운. 이 둘이 만나 하나의 기둥을 이루어요.' },
  { category: '알쓸사잡', text: '일간(日干)은 "나 자신"을 뜻해요. 나머지 7글자는 나를 둘러싼 환경과 관계입니다.' },
  { category: '알쓸사잡', text: '십성(十星)은 나와 세상의 관계를 보여줘요. 비견, 식신, 재성, 관성, 인성 — 각각의 역할이 다릅니다.' },
  { category: '알쓸사잡', text: '지장간은 겉으로 안 보이는 숨은 성격이에요. 표면과 다른 내면의 에너지를 품고 있죠.' },
  { category: '알쓸사잡', text: '60갑자는 천간 10개와 지지 12개의 조합이에요. 60년이 지나면 같은 간지가 돌아옵니다.' },
  { category: '알쓸사잡', text: '년주는 조상과 사회적 환경, 월주는 부모와 성장기, 일주는 나 자신, 시주는 자녀와 노년을 뜻해요.' },
  { category: '알쓸사잡', text: '도화살은 "매력의 별"이에요. 흉살이 아니라, 사람을 끌어당기는 에너지입니다.' },
  { category: '알쓸사잡', text: '역마살이 있으면 이동이 잦고 해외와 인연이 깊어요. 한곳에 머무는 게 답답할 수 있어요.' },
  { category: '알쓸사잡', text: '사주에서 "편(偏)"은 나쁜 게 아니에요. 비정통적이고 독창적이라는 뜻에 가깝습니다.' },

  // 실생활 활용
  { category: '실생활 활용', text: '중요한 면접이나 미팅은 오전에 잡으세요. 양(陽)의 기운이 강한 시간대가 발표력을 높여줍니다.' },
  { category: '실생활 활용', text: '잠이 잘 안 올 때는 북쪽으로 머리를 두고 자 보세요. 수(水) 기운의 방위라 안정에 도움이 됩니다.' },
  { category: '실생활 활용', text: '새 프로젝트는 월초보다 월중에 시작하는 게 유리해요. 기운이 안정된 시기이기 때문이에요.' },
  { category: '실생활 활용', text: '식신(食神)이 강한 사람은 요리에 재능이 있어요. 직접 만든 음식이 스트레스 해소에도 좋습니다.' },
  { category: '실생활 활용', text: '스트레스를 받을 때 자신의 부족한 오행 색상의 옷을 입으면 기운이 보충돼요.' },
  { category: '실생활 활용', text: '연인과 다투었다면 서로의 일간 오행이 상극인지 확인해보세요. 이해의 폭이 넓어져요.' },
  { category: '실생활 활용', text: '이사할 때 방향도 중요해요. 부족한 오행의 방위로 이동하면 기운이 보충됩니다.' },
  { category: '실생활 활용', text: '화(火)가 부족한 사람은 남쪽 자리에 앉는 것만으로도 에너지가 충전돼요.' },
  { category: '실생활 활용', text: '숫자도 오행이 있어요. 1·6은 수, 2·7은 화, 3·8은 목, 4·9는 금, 5·10은 토.' },
  { category: '실생활 활용', text: '중요한 계약은 일진이 좋은 날을 고르세요. 천간이 내 일간과 상생하는 날이 유리해요.' },

  // 명리학 상식
  { category: '명리학 상식', text: '"명리(命理)"에서 명은 하늘이 준 몫, 리는 그것이 흐르는 이치예요. 둘을 함께 살피는 학문입니다.' },
  { category: '명리학 상식', text: '음양오행은 2,500년 전부터 내려온 동양 자연철학이에요. 미신이 아닌 체계적 분석 도구입니다.' },
  { category: '명리학 상식', text: '격국(格局)은 사주의 "성격 유형"과 비슷해요. MBTI처럼, 사주에도 분류 체계가 있습니다.' },
  { category: '명리학 상식', text: '12운성은 에너지의 생로병사를 나타내요. "사(死)"는 실제 죽음이 아니라 에너지의 수렴 단계입니다.' },
  { category: '명리학 상식', text: '공망은 "비어있는 공간"이에요. 집착을 버리면 오히려 자유로운 영역이 됩니다.' },
  { category: '명리학 상식', text: '납음(納音)은 사주의 가장 근본적인 에너지예요. 60갑자 각각에 고유한 소리가 있습니다.' },
  { category: '명리학 상식', text: '삼합(三合)은 세 지지가 만나 하나의 강한 오행을 만드는 거예요. 인오술은 화의 삼합입니다.' },
  { category: '명리학 상식', text: '방합(方合)은 같은 방위의 세 지지가 모여 더 강한 힘을 만들어요. 인묘진은 동방 목의 방합.' },
  { category: '명리학 상식', text: '형충파해는 지지 사이의 갈등 관계예요. 충(沖)은 정면 대립, 형(刑)은 자기 갈등에 가까워요.' },
  { category: '명리학 상식', text: '자평명리학의 "자평"은 당나라 서자평에서 유래했어요. 일간 중심 분석법을 확립한 인물이에요.' },

  // 재미 상식
  { category: '재미 상식', text: '한국에서 사주를 가장 많이 보는 시기는 새해 1월과 결혼 시즌인 5~6월이에요.' },
  { category: '재미 상식', text: '조선시대에는 혼인 전 반드시 사주를 교환했어요. "사주단자"라 불렀습니다.' },
  { category: '재미 상식', text: '같은 시간에 태어난 쌍둥이도 운명이 달라질 수 있어요. 후천적 선택이 그만큼 중요합니다.' },
  { category: '재미 상식', text: '사주에서 "재성"이 강하다고 반드시 부자가 되는 건 아니에요. 돈과의 "인연"이 강하다는 뜻이에요.' },
  { category: '재미 상식', text: '세종대왕도 사주를 중시했어요. 과거 시험 날짜도 일진을 보고 정했습니다.' },
  { category: '재미 상식', text: '중국, 일본, 베트남에도 사주 문화가 있지만 한국 명리학이 가장 체계적이라는 평가를 받아요.' },
  { category: '재미 상식', text: '사주를 볼 때 양력이 아닌 음력으로 봐야 한다는 건 오해예요. 절기 기준의 만세력이 정확합니다.' },
  { category: '재미 상식', text: '띠는 음력 1월 1일이 아니라 절기의 "입춘"을 기준으로 바뀌어요.' },
  { category: '재미 상식', text: '일주(日柱) 60가지 중 가장 인기 있는 건 "경진일주"예요. 리더십과 재물운이 강하다고 알려져 있어요.' },
  { category: '재미 상식', text: '한국에서 가장 많이 태어난 시간대는 오전 9시~11시예요. 사시(巳時)에 해당합니다.' },
  { category: '재미 상식', text: '사주에서 가장 귀한 별은 "천을귀인"이에요. 어려울 때 도움을 주는 사람이 나타나는 에너지예요.' },
  { category: '재미 상식', text: '편인이 강한 사람은 독특한 취미를 가지는 경우가 많아요. 마니아 기질이라고 볼 수 있어요.' },

  // 연애/궁합
  { category: '연애 꿀팁', text: '일간 오행이 상생하는 커플은 자연스럽게 서로를 도와주는 관계가 돼요.' },
  { category: '연애 꿀팁', text: '도화살이 일지(배우자 궁)에 있으면 배우자가 매력적일 확률이 높아요.' },
  { category: '연애 꿀팁', text: '정관이 있는 사주는 안정적인 연애를 선호하고, 편관이 있으면 자극적인 관계에 끌려요.' },
  { category: '연애 꿀팁', text: '식신이 강한 사람은 데이트에서 맛집 탐방이 최고의 코스예요. 음식으로 사랑을 표현합니다.' },
  { category: '연애 꿀팁', text: '비견이 많은 사주끼리 만나면 주도권 다툼이 생기기 쉬워요. 양보가 관계의 열쇠입니다.' },

  // 재물 팁
  { category: '재물 꿀팁', text: '정재는 월급형 재물, 편재는 사업/투자형 재물이에요. 내 재성을 알면 돈 버는 방식이 보여요.' },
  { category: '재물 꿀팁', text: '식신생재 구조는 재능으로 돈을 버는 최고의 사주 구조 중 하나예요.' },
  { category: '재물 꿀팁', text: '겁재가 강하면 돈이 들어와도 나가는 구멍이 있어요. 자동이체 저축이 최고의 해법이에요.' },
  { category: '재물 꿀팁', text: '재성이 없다고 돈을 못 버는 게 아니에요. 대운에서 재성이 오면 재물운이 열립니다.' },

  // 사주500 가이드
  { category: '사주500 가이드', text: '결과 리포트의 점수는 절대값이 아니에요. 내 사주 구조 안에서의 상대적 강약을 보여줍니다.' },
  { category: '사주500 가이드', text: '시간을 모를 때는 6글자로 분석하지만, 시간을 알면 8글자 분석이 가능해서 훨씬 정밀해져요.' },
  { category: '사주500 가이드', text: '같은 날 태어나도 시간에 따라 사주가 완전히 달라져요. 출생 시간이 그만큼 중요합니다.' },
  { category: '사주500 가이드', text: '대운은 10년 단위로 바뀌는 큰 흐름이에요. 지금 내가 어떤 대운에 있는지 꼭 확인해보세요.' },
  { category: '사주500 가이드', text: '심층 분석은 주제별로 더 깊이 들어가요. 궁금한 주제가 있다면 도전해보세요.' },
  { category: '사주500 가이드', text: '궁합은 연인뿐 아니라 친구, 동료, 가족 관계도 분석할 수 있어요.' },
  { category: '사주500 가이드', text: '토정비결은 조선시대부터 내려온 전통 운세법이에요. 주역 64괘로 1년을 풀어줍니다.' },
];

interface Props {
  name?: string;
  type?: string;
  steps?: string[];
  /** 프리미엄 분석일 때 하단에 표시할 안내 메시지 */
  premiumNote?: string;
  /** 예상 소요 시간 (초) — 기본 20 */
  estimatedSeconds?: number;
}

export function AILoading({ name = '', type = '분석', steps, premiumNote, estimatedSeconds = 20 }: Props) {
  const [tipIndex, setTipIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const defaultSteps = [
    '사주 데이터를 분석하고 있어요',
    '오행의 흐름을 읽고 있어요',
    '맞춤 해석을 작성하고 있어요',
  ];
  const loadingSteps = steps || defaultSteps;

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
    const tipTimer = setInterval(() => setTipIndex(i => (i + 1) % shuffledTips.length), 4000);
    const stepTimer = setInterval(() => setStepIndex(i => Math.min(i + 1, loadingSteps.length - 1)), 8000);
    const clockTimer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { clearInterval(tipTimer); clearInterval(stepTimer); clearInterval(clockTimer); };
  }, []);

  const progress = Math.min(((stepIndex + 1) / loadingSteps.length) * 100, 95);
  const currentTip = shuffledTips[tipIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8" style={{ background: 'var(--bg-page-gradient)' }}>
      {/* 이름 + 타입 */}
      <p className="text-caption text-text-muted mb-6">{name ? `${name}님의 ` : ''}{type}을 준비하고 있어요</p>

      {/* 태극 원형 로딩 */}
      <motion.div
        className="w-20 h-20 mb-6 relative"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="38" stroke="#B8965A" strokeWidth="2" opacity="0.2" />
          <circle cx="40" cy="40" r="38" stroke="#B8965A" strokeWidth="2.5"
            strokeDasharray="239" strokeDashoffset={239 - (239 * progress / 100)}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
          <circle cx="40" cy="20" r="6" fill="#B8965A" />
          <circle cx="40" cy="60" r="6" fill="#1B2A4A" />
        </svg>
      </motion.div>

      {/* 진행 단계 */}
      <AnimatePresence mode="wait">
        <motion.p
          key={stepIndex}
          className="text-h3 text-text-primary text-center mb-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          {loadingSteps[stepIndex]}...
        </motion.p>
      </AnimatePresence>

      {/* 프로그레스 바 */}
      <div className="w-48 h-1.5 bg-border-light rounded-full overflow-hidden mb-8">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #B8965A, #8C6D3D)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      {/* 카테고리별 팁 — 기다리는 동안 읽을거리 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          className="text-center px-6 py-4 rounded-2xl max-w-[300px]"
          style={{ background: 'rgba(184,150,90,0.06)', border: '1px solid rgba(184,150,90,0.1)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-caption text-brand-gold font-semibold mb-1">{currentTip.category}</p>
          <p className="text-body-sm text-text-secondary leading-relaxed">{currentTip.text}</p>
        </motion.div>
      </AnimatePresence>

      {/* 프리미엄 안내 — 짧은 문장 번갈아 표시 */}
      {premiumNote && (() => {
        const notes = premiumNote.split('|');
        const noteIdx = Math.floor(elapsed / 5) % notes.length;
        return (
          <AnimatePresence mode="wait">
            <motion.p
              key={noteIdx}
              className="text-[11px] text-center leading-relaxed mt-4 px-4 max-w-[280px]"
              style={{ color: '#A08B6A' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              {notes[noteIdx]}
            </motion.p>
          </AnimatePresence>
        );
      })()}

      {/* 예상 소요 시간 */}
      <p className="text-[10px] text-text-hint mt-3">
        {elapsed > estimatedSeconds
          ? '거의 다 됐어요. 조금만 더 기다려주세요.'
          : elapsed > estimatedSeconds * 0.6
            ? '꼼꼼하게 풀이하고 있어요. 잠시만요.'
            : `약 ${estimatedSeconds}~${estimatedSeconds + 10}초 소요`}
      </p>
    </div>
  );
}
