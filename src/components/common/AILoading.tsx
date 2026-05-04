/**
 * AILoading — Tier B (3~10초) 섹션 점진 노출 디자인
 *
 * 변경 (Stage 7e-9):
 *   - 단순 progress 회전 → 섹션 카드 점진 ✓ 패턴
 *   - 사용자가 "분석 진행 단계" 를 시각적으로 추적 가능
 *   - 마지막 섹션은 스켈레톤 유지 (도착 직전 느낌)
 *
 * 실제 streaming X — 시각 효과만 (Sonnet 단일 응답이라).
 * 7개 컨텐츠 (오늘운세/대운/월운/궁합/토정/꿈/주제) 공통 사용.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TIPS: { category: string; text: string }[] = [
  { category: '오행 꿀팁', text: '목(木)이 강한 사람은 아침형 인간이 많아요. 새벽에 일찍 일어나는 습관이 잘 맞습니다.' },
  { category: '오행 꿀팁', text: '화(火)가 부족하면 적극성이 떨어질 수 있어요. 빨간 소품을 가까이 두면 기운 보충에 도움이 됩니다.' },
  { category: '오행 꿀팁', text: '토(土)는 안정과 중재의 에너지예요. 토가 강한 사람은 중재자 역할에 타고난 능력이 있어요.' },
  { category: '오행 꿀팁', text: '금(金)이 강하면 결단력이 뛰어나지만, 너무 강하면 고집으로 나타날 수 있어요.' },
  { category: '오행 꿀팁', text: '수(水)는 지혜와 유연함. 부족하면 물을 많이 마시고 수영을 하는 것만으로도 보충이 됩니다.' },
  { category: '오행 꿀팁', text: '오행이 골고루 갖춰진 사주는 전체의 10% 미만이에요. 부족한 걸 보충하는 게 핵심이에요.' },
  { category: '알쓸사잡', text: '사주의 "사(四)"는 네 기둥, "주(柱)"는 기둥이라는 뜻이에요. 태어난 년·월·일·시 각각 하나의 기둥입니다.' },
  { category: '알쓸사잡', text: '천간(天干)은 하늘의 기운, 지지(地支)는 땅의 기운. 이 둘이 만나 하나의 기둥을 이루어요.' },
  { category: '알쓸사잡', text: '일간(日干)은 "나 자신"을 뜻해요. 나머지 7글자는 나를 둘러싼 환경과 관계입니다.' },
  { category: '알쓸사잡', text: '60갑자는 천간 10개와 지지 12개의 조합이에요. 60년이 지나면 같은 간지가 돌아옵니다.' },
  { category: '알쓸사잡', text: '도화살은 "매력의 별"이에요. 흉살이 아니라, 사람을 끌어당기는 에너지입니다.' },
  { category: '실생활 활용', text: '중요한 면접이나 미팅은 오전에 잡으세요. 양(陽)의 기운이 강한 시간대가 발표력을 높여줍니다.' },
  { category: '실생활 활용', text: '잠이 잘 안 올 때는 북쪽으로 머리를 두고 자 보세요. 수(水) 기운의 방위라 안정에 도움이 됩니다.' },
  { category: '실생활 활용', text: '새 프로젝트는 월초보다 월중에 시작하는 게 유리해요. 기운이 안정된 시기이기 때문이에요.' },
  { category: '명리학 상식', text: '"명리(命理)"에서 명은 하늘이 준 몫, 리는 그것이 흐르는 이치예요. 둘을 함께 살피는 학문입니다.' },
  { category: '명리학 상식', text: '음양오행은 2,500년 전부터 내려온 동양 자연철학이에요. 미신이 아닌 체계적 분석 도구입니다.' },
  { category: '명리학 상식', text: '12운성은 에너지의 생로병사를 나타내요. "사(死)"는 실제 죽음이 아니라 에너지의 수렴 단계입니다.' },
  { category: '재미 상식', text: '같은 시간에 태어난 쌍둥이도 운명이 달라질 수 있어요. 후천적 선택이 그만큼 중요합니다.' },
  { category: '재미 상식', text: '띠는 음력 1월 1일이 아니라 절기의 "입춘"을 기준으로 바뀌어요.' },
  { category: '사주500 가이드', text: '결과 리포트의 점수는 절대값이 아니에요. 내 사주 구조 안에서의 상대적 강약을 보여줍니다.' },
  { category: '사주500 가이드', text: '같은 날 태어나도 시간에 따라 사주가 완전히 달라져요. 출생 시간이 그만큼 중요합니다.' },
  { category: '사주500 가이드', text: '대운은 10년 단위로 바뀌는 큰 흐름이에요. 지금 내가 어떤 대운에 있는지 꼭 확인해보세요.' },
];

interface Props {
  name?: string;
  type?: string;
  /** 섹션 라벨 배열 (Tier B 점진 ✓) — 4~5개 권장 */
  steps?: string[];
  premiumNote?: string;
  estimatedSeconds?: number;
}

const C = {
  paper: '#F8F5EE',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.10)',
  goldLine: 'rgba(184,150,90,0.40)',
  positive: '#2D8A4E',
  line: '#E5DFD0',
} as const;

export function AILoading({
  name = '',
  type = '분석',
  steps,
  premiumNote,
  estimatedSeconds = 12,
}: Props) {
  const [tipIndex, setTipIndex] = useState(0);
  const [doneCount, setDoneCount] = useState(0); // 완료된 섹션 수
  const [elapsed, setElapsed] = useState(0);

  const sections = steps && steps.length > 0
    ? steps
    : ['사주 데이터 분석', '오행 흐름 읽기', '맞춤 해석 작성', '결과 정리'];

  // 랜덤 셔플 팁
  const shuffledTips = useMemo(() => {
    const arr = [...TIPS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  useEffect(() => {
    // Stage 7e-9: 섹션 점진 ✓ — 분석 시간대 균등 분배
    //   예상 시간 12s / 섹션 4개 = 3s per section, 마지막은 도착 직전 ~80% 유지
    const sectionInterval = Math.max(1500, (estimatedSeconds * 1000) / Math.max(1, sections.length));
    const tipTimer = setInterval(() => setTipIndex(i => (i + 1) % shuffledTips.length), 4000);
    const sectionTimer = setInterval(
      () => setDoneCount(d => Math.min(d + 1, sections.length - 1)),
      sectionInterval,
    );
    const clockTimer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => {
      clearInterval(tipTimer);
      clearInterval(sectionTimer);
      clearInterval(clockTimer);
    };
  }, [estimatedSeconds, sections.length, shuffledTips.length]);

  const currentTip = shuffledTips[tipIndex];
  const overallProgress = Math.min(95, (doneCount / sections.length) * 100 + 15);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center px-6 pt-12 pb-10 overflow-y-auto"
      style={{ background: 'var(--bg-page-gradient)' }}
    >
      {/* 헤더 — name + type */}
      <div className="text-center mb-5">
        <p style={{ fontSize: 11, color: C.mute, letterSpacing: '0.16em', marginBottom: 4 }}>
          AI ANALYZING
        </p>
        <p
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 18,
            fontWeight: 800,
            color: C.ink,
            letterSpacing: '-0.005em',
          }}
        >
          {name ? `${name}님의 ` : ''}
          <span style={{ color: C.goldDeep }}>{type}</span> 준비 중
        </p>
      </div>

      {/* 태극 원형 — 진행 progress */}
      <motion.div
        className="w-16 h-16 mb-6 relative"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="36" stroke={C.gold} strokeWidth="2" opacity="0.18" />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke={C.goldDeep}
            strokeWidth="2.5"
            strokeDasharray="226"
            strokeDashoffset={226 - (226 * overallProgress) / 100}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            transform="rotate(-90 40 40)"
          />
          <circle cx="40" cy="22" r="5" fill={C.gold} />
          <circle cx="40" cy="58" r="5" fill="#1B2A4A" />
        </svg>
      </motion.div>

      {/* Tier B 핵심 — 섹션 점진 카드 */}
      <div
        className="w-full max-w-[340px] mb-6 rounded-2xl"
        style={{
          background: C.surface,
          border: `1px solid ${C.goldLine}`,
          padding: '14px 16px',
          boxShadow: '0 4px 16px rgba(184,150,90,0.10)',
        }}
      >
        {sections.map((label, i) => {
          const isDone = i < doneCount;
          const isActive = i === doneCount;
          const isWaiting = i > doneCount;
          return (
            <motion.div
              key={`${label}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: i < sections.length - 1 ? `1px dotted ${C.line}` : 'none',
              }}
            >
              {/* 좌측 상태 마커 */}
              <div
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isDone ? C.positive : isActive ? C.goldSoft : '#F5F0E8',
                  border: `1.5px solid ${isDone ? C.positive : isActive ? C.gold : C.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isActive ? (
                  <motion.div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: C.gold,
                    }}
                    animate={{ scale: [0.6, 1.0, 0.6], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : null}
              </div>
              {/* 라벨 + 진행률 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: isActive ? 800 : isDone ? 600 : 500,
                    color: isWaiting ? C.mute : C.ink,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {label}
                </div>
                {/* 활성 섹션 — 진행 바 (가짜 streaming 시각) */}
                {isActive && (
                  <div
                    style={{
                      marginTop: 4,
                      height: 3,
                      background: 'rgba(184,150,90,0.12)',
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      style={{
                        height: '100%',
                        background: `linear-gradient(90deg, ${C.gold}, ${C.goldDeep})`,
                        borderRadius: 999,
                      }}
                      animate={{ width: ['10%', '85%', '60%', '90%'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                )}
                {/* 대기 섹션 — 스켈레톤 */}
                {isWaiting && (
                  <div
                    style={{
                      marginTop: 4,
                      height: 3,
                      background: 'rgba(0,0,0,0.04)',
                      borderRadius: 999,
                    }}
                  />
                )}
                {/* 완료 섹션 — 도착 표시 */}
                {isDone && (
                  <div
                    style={{
                      fontSize: 10,
                      color: C.positive,
                      fontWeight: 600,
                      marginTop: 2,
                      letterSpacing: '0.04em',
                    }}
                  >
                    완료
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 카테고리별 팁 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          className="text-center px-5 py-3 rounded-2xl max-w-[320px]"
          style={{
            background: C.goldSoft,
            border: `1px solid rgba(184,150,90,0.18)`,
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <p
            style={{
              fontSize: 10,
              color: C.goldDeep,
              fontWeight: 800,
              letterSpacing: '0.16em',
              marginBottom: 4,
            }}
          >
            {currentTip.category}
          </p>
          <p style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6 }}>{currentTip.text}</p>
        </motion.div>
      </AnimatePresence>

      {/* 프리미엄 안내 */}
      {premiumNote && (() => {
        const notes = premiumNote.split('|');
        const noteIdx = Math.floor(elapsed / 5) % notes.length;
        return (
          <AnimatePresence mode="wait">
            <motion.p
              key={noteIdx}
              className="text-[11px] text-center leading-relaxed mt-3 px-4 max-w-[280px]"
              style={{ color: C.goldDeep, fontStyle: 'italic' }}
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
      <p
        style={{
          fontSize: 10,
          color: C.mute,
          marginTop: 12,
          letterSpacing: '0.04em',
        }}
      >
        {elapsed > estimatedSeconds + 5
          ? '거의 다 됐어요. 조금만 더 기다려주세요'
          : elapsed > estimatedSeconds * 0.7
            ? '꼼꼼히 풀이하고 있어요'
            : `약 ${estimatedSeconds}초 소요`}
      </p>
    </div>
  );
}
