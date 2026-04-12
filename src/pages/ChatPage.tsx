import { useState, useRef, useEffect, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { getReports } from '@/services/storage/localStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { generateChatAnswer } from '@/services/ai/reportGenerator';
import { hasFreePass, useFreePass } from '@/services/storage/dailyFreePass';
import { getChatCredits, useChatCredit, addChatCredits } from '@/services/storage/chatCredit';
import { spendBalance } from '@/services/storage/localStore';
import { useToast } from '@/components/common/Toast';
import type { SajuData } from '@/types/saju';

/* ============================================================
   시간대별 인사 시스템
   ============================================================ */
function getTimeContext() {
  const h = new Date().getHours();
  if (h >= 0 && h < 5)
    return {
      slot: 'latenight' as const,
      greeting: '이 늦은 밤, 마음에 무언가 담긴 게 있으시군요.',
      tip: '새벽의 고요한 기운 속에서는 직감이 가장 또렷해요.',
      bg: '#F4F5F8', headerBg: '#0F1D35',
    };
  if (h < 7)
    return {
      slot: 'dawn' as const,
      greeting: '이른 아침이네요. 오늘 하루, 어떤 기운이 기다리고 있을까요?',
      tip: '해가 뜨기 전의 시간은 계획을 세우기에 가장 좋습니다.',
      bg: '#F4F5F8', headerBg: '#1B2A4A',
    };
  if (h < 12)
    return {
      slot: 'morning' as const,
      greeting: '좋은 아침이에요! 오늘의 운세가 궁금하신가요?',
      tip: '오전의 양(陽) 기운은 새로운 시작에 유리해요.',
      bg: '#F4F5F8', headerBg: '#1B2A4A',
    };
  if (h < 14)
    return {
      slot: 'noon' as const,
      greeting: '점심시간이에요. 잠깐 쉬면서 사주 이야기 나눠볼까요?',
      tip: '정오(正午)는 화(火) 기운이 가장 강한 시간이에요.',
      bg: '#F4F5F8', headerBg: '#1B2A4A',
    };
  if (h < 18)
    return {
      slot: 'afternoon' as const,
      greeting: '오후의 여유로운 시간, 궁금한 점을 물어보세요.',
      tip: '오후는 신(申)시 — 금(金) 기운으로 판단력이 좋아지는 시간이에요.',
      bg: '#F4F5F8', headerBg: '#1B2A4A',
    };
  if (h < 21)
    return {
      slot: 'evening' as const,
      greeting: '하루가 저물어가네요. 오늘은 어떤 하루였나요?',
      tip: '저녁의 수(水) 기운은 자기 성찰에 적합해요.',
      bg: '#F4F5F8', headerBg: '#1B2A4A',
    };
  return {
    slot: 'night' as const,
    greeting: '고요한 밤이에요. 편하게 이야기해주세요.',
    tip: '밤의 기운 속에서는 내면의 목소리가 더 잘 들립니다.',
    bg: '#F4F5F8', headerBg: '#0F1D35',
  };
}

/** 첫 진입 시 추천 질문 (시간대별) */
function getSuggestedQuestions(hasProfile: boolean) {
  const h = new Date().getHours();
  const base = hasProfile
    ? [
        '올해 나에게 가장 좋은 달은?',
        '내 사주에서 가장 강한 기운은?',
        '지금 시기에 주의할 점이 있을까?',
      ]
    : [
        '사주명리학이 뭔가요?',
        '오행이 뭔지 쉽게 알려주세요',
        '올해 운세가 궁금해요',
      ];

  // 시간대별 추가 질문
  if (h < 7) return [...base.slice(0, 2), '오늘 아침 중요한 일이 있는데 괜찮을까요?'];
  if (h < 12) return [...base.slice(0, 2), '오늘 하루 운세가 궁금해요'];
  if (h < 18) return [...base.slice(0, 2), '오후에 중요한 미팅이 있는데 어떨까요?'];
  if (h < 22) return [...base.slice(0, 2), '내일은 어떤 하루가 될까요?'];
  return [...base.slice(0, 2), '잠이 안 오는데, 마음이 좀 복잡해요'];
}

/* ============================================================
   타입
   ============================================================ */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  keywords?: string[];
  timestamp: Date;
}

/* ============================================================
   메인 컴포넌트
   ============================================================ */
export function ChatPage() {
  usePageTitle('사주대화');
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const toast = useToast();

  const timeCtx = useMemo(() => getTimeContext(), []);

  // 사주 데이터 (최근 리포트에서 가져옴)
  const latestReport = useMemo(() => getReports()[0] || null, []);
  const sajuData: SajuData | undefined = latestReport?.sajuData;
  const hasProfile = !!latestReport;

  const userName = latestReport?.name || '';
  const ilgan = latestReport?.sajuData.pillars[2]?.천간 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';

  const suggestedQuestions = useMemo(() => getSuggestedQuestions(hasProfile), [hasProfile]);

  // 첫 진입 시 AI 웰컴 메시지
  useEffect(() => {
    const welcomeContent = hasProfile
      ? `${userName}님, ${timeCtx.greeting}\n\n${ilgan}(${oheng}) 일간이시네요. ${timeCtx.tip}\n\n궁금한 점이 있으시면 편하게 물어보세요.`
      : `${timeCtx.greeting}\n\n정통 명리학에 기반해 사주 상담을 도와드립니다.\n\n${timeCtx.tip}\n\n아래 질문을 탭하거나, 궁금한 걸 직접 물어보세요.`;

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: welcomeContent,
      keywords: suggestedQuestions,
      timestamp: new Date(),
    }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 스크롤 자동 하단
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // 메시지 전송
  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    // 1. 매일 무료 1회 체크 (첫 메시지 + 아직 무료 미사용)
    if (chatCount === 0 && hasFreePass('chat')) {
      useFreePass('chat');
    }
    // 2. 무료 소진 + 대화권 확인
    else {
      if (getChatCredits() > 0) {
        useChatCredit();
      } else {
        // 대화권 없음 → 구매 안내
        toast.show('대화권이 없어요. 1운으로 3회 대화할 수 있어요', 'info');
        setShowBuyCredits(true);
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(36),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await generateChatAnswer(text.trim(), sajuData, history);

      const aiMsg: ChatMessage = {
        id: Date.now().toString(36) + '_ai',
        role: 'assistant',
        content: result.answer,
        keywords: result.keywords || ['더 자세히 알려줘', '다른 질문할게', '오늘 운세 알려줘'],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setChatCount(result.todayCount);
    } catch {
      // 데모 폴백 — 시간대 반영
      const demoAnswers = getDemoAnswer(text.trim(), timeCtx.slot, hasProfile, userName, ilgan, oheng);
      const aiMsg: ChatMessage = {
        id: Date.now().toString(36) + '_ai',
        role: 'assistant',
        content: demoAnswers.answer,
        keywords: demoAnswers.keywords,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setChatCount((c) => c + 1);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  // 무료: 1일 1회 (자정 리셋)
  // 유료: 대화권 (1운 = 3회)
  const hasDailyFree = hasFreePass('chat');
  const credits = getChatCredits();
  const remaining = hasDailyFree ? 1 : credits;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: timeCtx.bg }}>
    {/* 밝은 배경 + 네이비 헤더 조합 — 가독성 확보 */}

      {/* ====== 헤더 — 네이비 (앱인토스: 뒤로가기는 토스 제공) ====== */}
      <div className="flex-shrink-0 px-5 pt-safe-top" style={{ background: timeCtx.headerBg }}>
        <div className="flex items-center justify-between h-[56px]">
          <div className="flex items-center gap-2.5">
            {/* 로고 태극 미니 */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(201,169,110,0.12)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="11" stroke="#E8D5A8" strokeWidth="1" fill="none" opacity="0.5" />
                <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#E8D5A8" fillOpacity="0.6" />
                <circle cx="12" cy="7" r="2" fill="#C9A96E" />
                <circle cx="12" cy="17" r="2" fill="#E8D5A8" fillOpacity="0.4" stroke="#C9A96E" strokeWidth="0.6" />
              </svg>
            </div>
            <div>
              <h1 className="text-h3 text-white font-bold">사주대화</h1>
              <p className="text-[9px] text-white/40 -mt-0.5">정통 명리학 기반 상담</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 사주 프로필 칩 */}
            {hasProfile && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: 'rgba(201,169,110,0.2)', color: '#E8D5A8' }}>
                  {userName.charAt(0)}
                </div>
                <span className="text-[10px] text-white/40">{ilgan}{oheng}</span>
              </div>
            )}
            {/* 잔여 횟수 */}
            {remaining > 0 ? (
              <span className="text-[10px] text-white/30 px-2 py-1 rounded-full border border-white/8">
                {hasDailyFree ? '무료 1회' : credits > 0 ? `${credits}회` : '0회'}
              </span>
            ) : (
              <button
                onClick={() => navigate('/charge')}
                className="text-[10px] font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(201,169,110,0.2)', color: '#E8D5A8' }}
              >
                충전
              </button>
            )}
          </div>
        </div>

        {/* 헤더 하단 구분선 */}
        <div className="h-px bg-white/10" />
      </div>

      {/* ====== 채팅 영역 ====== */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
                {/* 메시지 버블 */}
                <div
                  className="rounded-2xl px-4 py-3 text-[14px] leading-relaxed"
                  style={
                    msg.role === 'user'
                      ? { background: '#C9A96E', color: '#1B2A4A', borderBottomRightRadius: 4 }
                      : { background: '#FFFFFF', color: '#1B2A4A', borderBottomLeftRadius: 4, border: '1px solid #E2E5EC', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }
                  }
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>

                {/* 시간 */}
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'} text-text-hint`}>
                  {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>

                {/* 키워드 추천 */}
                {msg.role === 'assistant' && msg.keywords && msg.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.keywords.map((kw) => (
                      <motion.button
                        key={kw}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => sendMessage(kw)}
                        className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
                        style={{
                          background: 'rgba(201,169,110,0.08)',
                          color: '#8B7A5E',
                          border: '1px solid rgba(201,169,110,0.2)',
                        }}
                      >
                        {kw}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* 로딩 — 한자 타이핑 인디케이터 */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-2"
                style={{ background: '#FFFFFF', border: '1px solid #E2E5EC', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                {['命', '理', '학'].map((char, i) => (
                  <motion.span
                    key={i}
                    className="text-[13px] font-bold"
                    style={{ color: '#C9A96E' }}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }}
                  >
                    {char}
                  </motion.span>
                ))}
                <motion.span
                  className="text-[11px] text-text-hint ml-1"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: 0.6 }}
                >
                  분석 중...
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 사주 미등록 시 CTA */}
        {!hasProfile && messages.length <= 1 && (
          <FadeIn delay={0.3}>
            <button
              onClick={() => navigate('/input')}
              className="card-gold w-full text-left"
            >
              <p className="text-[13px] font-semibold text-text-primary">
                내 사주를 먼저 등록하면 더 정확해요
              </p>
              <p className="text-[11px] mt-1 text-text-muted">
                생년월일시 입력 후 대화하면, 사주 원국에 기반한 맞춤 상담을 받을 수 있습니다.
              </p>
            </button>
          </FadeIn>
        )}

        {/* 기술 각주 */}
        {messages.length <= 1 && (
          <p className="text-[9px] text-text-disabled text-center mt-4 px-4 leading-relaxed">
            정통 명리학 원전과 방대한 해석 자료를 최신 언어모델로 체계화하여 제공해요.
            참고용이며 중요한 결정은 전문가와 상담하세요.
          </p>
        )}
      </div>

      {/* 대화권 구매 배너 */}
      {showBuyCredits && (
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-gold-solid)', border: '1px solid rgba(201,169,110,0.2)' }}>
            <p className="text-h3 text-text-primary">대화권이 모두 소진됐어요</p>
            <p className="text-caption text-text-muted mt-1">1운(500원)으로 3회 추가 대화할 수 있어요</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  if (spendBalance(1)) {
                    addChatCredits(3);
                    toast.show('대화권 3회가 추가됐어요!', 'success');
                    setShowBuyCredits(false);
                  } else {
                    toast.show('잔액이 부족해요', 'warning');
                    navigate('/charge');
                  }
                }}
                className="flex-1 py-3 rounded-xl text-caption font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}
              >
                1운으로 구매하기
              </button>
              <button onClick={() => setShowBuyCredits(false)} className="px-4 py-3 rounded-xl text-caption text-text-muted bg-bg-surface">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== 입력 영역 ====== */}
      {/* 입력 — TabBar 위에 위치 */}
      <div className="flex-shrink-0 px-4 pb-[calc(84px+env(safe-area-inset-bottom))]">
        <div
          className="flex items-end gap-2 rounded-2xl p-2"
          style={{ background: '#FFFFFF', border: '1px solid #E2E5EC', boxShadow: '0 -2px 8px rgba(0,0,0,0.04)' }}
        >
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="궁금한 점을 물어보세요..."
            rows={1}
            className="flex-1 bg-transparent text-text-primary text-[14px] placeholder-text-hint resize-none outline-none px-2 py-2 max-h-[100px]"
            style={{ scrollbarWidth: 'none' }}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: inputText.trim() ? '#C9A96E' : '#E2E5EC',
              opacity: inputText.trim() ? 1 : 0.5,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke={inputText.trim() ? '#FFF' : '#8892A4'} strokeWidth="2" strokeLinecap="round" />
              <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke={inputText.trim() ? '#FFF' : '#8892A4'} strokeWidth="2" strokeLinejoin="round" fill="none" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   데모 폴백 답변 (API 미연결 시)
   시간대 + 사주 데이터 반영
   ============================================================ */
function getDemoAnswer(
  question: string,
  timeSlot: string,
  hasProfile: boolean,
  name: string,
  ilgan: string,
  oheng: string,
): { answer: string; keywords: string[] } {
  const timePrefix = {
    latenight: '이 늦은 시간에 대화하시는 걸 보니, 마음에 담아둔 게 있으신 것 같아요.\n\n',
    dawn: '새벽에 일어나셨군요. 이른 아침의 기운이 맑습니다.\n\n',
    morning: '좋은 아침이에요!\n\n',
    noon: '점심시간, 잠깐의 여유를 내셨군요.\n\n',
    afternoon: '',
    evening: '하루를 정리하는 시간이네요.\n\n',
    night: '고요한 밤, 편안한 마음으로 이야기 나눠요.\n\n',
  }[timeSlot] || '';

  const profileContext = hasProfile
    ? `${name}님의 ${ilgan}(${oheng}) 일간을 기준으로 보면, `
    : '';

  // 키워드 매칭
  if (question.includes('운세') || question.includes('오늘')) {
    return {
      answer: `${timePrefix}${profileContext}오늘은 소통의 기운이 강한 날입니다.\n\n특히 오전 시간대에 중요한 연락이나 대화를 나누면 좋은 결과로 이어질 가능성이 높습니다. 다만 오후에는 급한 결정보다는 한 번 더 생각해보는 여유가 필요해요.\n\n${hasProfile ? `${ilgan}(${oheng}) 일간이신 분들은 특히 오늘 인간관계에서 좋은 에너지를 받을 수 있습니다.` : '사주를 등록하시면 더 정확한 맞춤 운세를 알려드릴 수 있어요.'}`,
      keywords: ['이번 주는 어때?', '직장운도 알려줘', '연애운이 궁금해'],
    };
  }

  if (question.includes('직업') || question.includes('이직') || question.includes('직장')) {
    return {
      answer: `${timePrefix}${profileContext}직업과 관련한 질문이시군요.\n\n${hasProfile ? `${ilgan}(${oheng}) 일간의 특성상, 혼자 깊이 파고드는 작업보다는 사람들과 협업하는 환경에서 강점이 발휘됩니다. 다만 현재 대운의 흐름을 보면, 급격한 변화보다는 내실을 다지는 시기에 가까워요.` : '사주 원국을 보면 적성에 맞는 직종과 이직 타이밍을 더 정확하게 알려드릴 수 있습니다.'}\n\n혹시 구체적으로 이직을 고민하고 계신 건가요, 아니면 현재 직장에서의 방향이 궁금하신 건가요?`,
      keywords: ['이직 타이밍이 궁금해', '적성에 맞는 직업은?', '올해 직장운은?'],
    };
  }

  if (question.includes('연애') || question.includes('사랑') || question.includes('썸')) {
    return {
      answer: `${timePrefix}${profileContext}연애에 대한 이야기네요.\n\n${hasProfile ? `${ilgan}(${oheng}) 일간은 감정을 쉽게 드러내지 않는 편이지만, 한번 마음을 주면 깊고 진실된 관계를 만들어가는 타입입니다. 올해는 특히 6~8월 사이에 인연의 기운이 강해지는 시기가 있어요.` : '사주를 등록하시면 연애 스타일, 이상형, 좋은 만남의 시기까지 알려드릴 수 있어요.'}\n\n지금 누군가를 만나고 계신가요?`,
      keywords: ['궁합이 궁금해', '좋은 만남의 시기는?', '연애 스타일을 알려줘'],
    };
  }

  if (question.includes('사주') && (question.includes('뭐') || question.includes('뭔'))) {
    return {
      answer: `${timePrefix}사주명리학(四柱命理學)은 동양의 전통 학문이에요.\n\n태어난 연(年)·월(月)·일(日)·시(時), 이 네 기둥(四柱)에 담긴 천간(天干)과 지지(地支)의 조합으로 사람의 타고난 기질과 운의 흐름을 읽습니다.\n\n미신이 아니라, 음양오행이라는 자연철학에 기반한 체계적인 분석법이에요. 적천수(滴天髓), 자평진전(子平眞詮) 같은 수백 년 된 고전 이론에 뿌리를 두고 있습니다.\n\n쉽게 말하면 — 나의 "에너지 설계도"를 읽는 거예요.`,
      keywords: ['오행이 뭐야?', '내 사주를 분석해줘', '사주로 뭘 알 수 있어?'],
    };
  }

  if (question.includes('오행') || question.includes('五行')) {
    return {
      answer: `${timePrefix}오행(五行)은 우주 만물을 이루는 다섯 가지 에너지예요.\n\n목(木) — 성장, 시작의 에너지. 봄의 기운.\n화(火) — 확산, 표현의 에너지. 여름의 기운.\n토(土) — 중재, 안정의 에너지. 환절기의 기운.\n금(金) — 수렴, 결단의 에너지. 가을의 기운.\n수(水) — 지혜, 유연함의 에너지. 겨울의 기운.\n\n이 다섯 가지가 서로 돕고(生) 견제하며(剋) 균형을 이루는 것이 오행의 핵심입니다. ${hasProfile ? `${name}님은 ${oheng} 기운이 일간이에요.` : '사주를 등록하면 나의 오행 분포를 정확히 알 수 있어요.'}`,
      keywords: ['내 오행 분포가 궁금해', '부족한 오행은?', '오행 보충하는 법?'],
    };
  }

  if (question.includes('돈') || question.includes('재물') || question.includes('투자') || question.includes('재테크')) {
    return {
      answer: `${timePrefix}${profileContext}재물에 대한 고민이시군요.\n\n${hasProfile ? `${ilgan}(${oheng}) 일간은 식신생재(食神生財)의 기운이 있어서, "내가 만든 것의 가치를 인정받아서 버는 방식"이 가장 자연스럽습니다. 한 방보다는 꾸준한 성과 축적형이에요.\n\n재테크는 안정적인 장기 투자가 맞고, 남의 말에 쉽게 흔들리면 안 됩니다.` : '사주를 등록하시면 재물운의 강약과 돈을 버는 스타일, 투자 성향까지 알려드릴 수 있어요.'}\n\n혹시 투자를 고민 중이신 건가요, 아니면 지출 관리가 궁금하신 건가요?`,
      keywords: ['올해 재물운은?', '투자해도 될까?', '돈 모으는 방법은?'],
    };
  }

  if (question.includes('건강') || question.includes('아프') || question.includes('피곤') || question.includes('잠')) {
    return {
      answer: `${timePrefix}${profileContext}건강이 걱정되시는군요.\n\n${hasProfile ? `${ilgan}(${oheng}) 일간 기준으로 보면, ${oheng === '목' ? '간과 눈' : oheng === '화' ? '심장과 혈액순환' : oheng === '토' ? '위장과 소화' : oheng === '금' ? '폐와 호흡기' : '신장과 방광'} 쪽을 특히 신경 쓰셔야 해요.\n\n지금 시기에는 무리하기보다 충분한 휴식과 수분 섭취가 가장 중요해요.` : '사주를 등록하시면 오행별 취약 장기와 건강 관리법을 알려드릴 수 있어요.'}\n\n혹시 구체적으로 불편한 곳이 있으신가요?`,
      keywords: ['오행별 건강 관리법', '운동은 뭐가 좋을까?', '스트레스 해소법'],
    };
  }

  if (question.includes('고민') || question.includes('힘들') || question.includes('불안') || question.includes('걱정')) {
    return {
      answer: `${timePrefix}마음이 무거우신 것 같아요. 먼저 이렇게 말씀해주셔서 감사합니다.\n\n${hasProfile ? `${name}님의 사주를 보면, 지금은 에너지가 내면으로 수렴되는 시기예요. 불안한 건 약해서가 아니라, 다음 단계를 준비하는 과정입니다.\n\n적천수에서 "내면이 고요할 때 진짜 힘이 자란다"고 했어요. 지금 느끼는 감정은 자연스러운 흐름이에요.` : '마음이 복잡할 때 사주를 보면 "지금이 왜 이런 시기인지"를 이해하는 데 도움이 돼요.'}\n\n괜찮으시다면, 어떤 부분이 가장 마음에 걸리세요?`,
      keywords: ['지금 시기가 왜 힘든 건지', '언제쯤 나아질까', '마음을 편하게 하는 법'],
    };
  }

  // 기본 응답
  return {
    answer: `${timePrefix}${profileContext}좋은 질문이에요.\n\n${hasProfile ? `${name}님, ` : ''}명리학에서는 "질문 자체에 이미 답이 들어있다"고 해요. 지금 이 질문을 하셨다는 건, 어떤 변화의 기운을 이미 감지하고 계신 거예요.\n\n조금 더 구체적으로 여쭤봐도 될까요? 직업, 연애, 재물, 건강 — 어떤 부분이 가장 궁금하세요?`,
    keywords: ['올해 운세가 궁금해', '내 성격을 알고 싶어', '요즘 고민이 있어'],
  };
}
