import { useState, useRef, useEffect, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { getMyProfile } from '@/services/storage/localStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { generateChatAnswer } from '@/services/ai/reportGenerator';
import { hasFreePass, useFreePass } from '@/services/storage/dailyFreePass';
import { getChatCredits, useChatCredit, addChatCredits } from '@/services/storage/chatCredit';
import { spendBalance } from '@/services/storage/localStore';
import {
  getChatRooms, getChatRoom, createChatRoom, addChatMessage, completeChatRoom,
  type ChatRoom, type ChatMessage,
} from '@/services/storage/chatStore';
import { useToast } from '@/components/common/Toast';
import type { SajuData } from '@/types/saju';

/* ─── 시간대 인사 ─── */
function getTimeContext() {
  const h = new Date().getHours();
  if (h < 5) return { slot: 'latenight' as const, greeting: '이 늦은 밤, 마음에 무언가 담긴 게 있으시군요.', tip: '새벽의 고요한 기운 속에서는 직감이 가장 또렷해요.', headerBg: '#0F1D35' };
  if (h < 7) return { slot: 'dawn' as const, greeting: '이른 아침이네요. 오늘 하루, 어떤 기운이 기다리고 있을까요?', tip: '해가 뜨기 전의 시간은 계획을 세우기에 가장 좋습니다.', headerBg: '#1B2A4A' };
  if (h < 12) return { slot: 'morning' as const, greeting: '좋은 아침이에요! 오늘의 운세가 궁금하신가요?', tip: '오전의 양(陽) 기운은 새로운 시작에 유리해요.', headerBg: '#1B2A4A' };
  if (h < 14) return { slot: 'noon' as const, greeting: '점심시간이에요. 잠깐 쉬면서 사주 이야기 나눠볼까요?', tip: '정오(正午)는 화(火) 기운이 가장 강한 시간이에요.', headerBg: '#1B2A4A' };
  if (h < 18) return { slot: 'afternoon' as const, greeting: '오후의 여유로운 시간, 궁금한 점을 물어보세요.', tip: '오후는 금(金) 기운으로 판단력이 좋아지는 시간이에요.', headerBg: '#1B2A4A' };
  if (h < 21) return { slot: 'evening' as const, greeting: '하루가 저물어가네요. 오늘은 어떤 하루였나요?', tip: '저녁의 수(水) 기운은 자기 성찰에 적합해요.', headerBg: '#1B2A4A' };
  return { slot: 'night' as const, greeting: '고요한 밤이에요. 편하게 이야기해주세요.', tip: '밤의 기운 속에서는 내면의 목소리가 더 잘 들립니다.', headerBg: '#0F1D35' };
}

function getSuggestedQuestions(hasProfile: boolean) {
  const h = new Date().getHours();
  const base = hasProfile
    ? ['올해 나에게 가장 좋은 달은?', '내 사주에서 가장 강한 기운은?', '지금 시기에 주의할 점이 있을까?']
    : ['사주명리학이 뭔가요?', '오행이 뭔지 쉽게 알려주세요', '올해 운세가 궁금해요'];
  if (h < 7) return [...base.slice(0, 2), '오늘 아침 중요한 일이 있는데 괜찮을까요?'];
  if (h < 12) return [...base.slice(0, 2), '오늘 하루 운세가 궁금해요'];
  if (h < 18) return [...base.slice(0, 2), '오후에 중요한 미팅이 있는데 어떨까요?'];
  if (h < 22) return [...base.slice(0, 2), '내일은 어떤 하루가 될까요?'];
  return [...base.slice(0, 2), '잠이 안 오는데, 마음이 좀 복잡해요'];
}

/* ─── 메인 컴포넌트 ─── */
export function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  usePageTitle('사주대화');
  const navigate = useNavigate();

  // roomId 없으면 → 대화방 목록
  // roomId 있으면 → 대화 뷰
  if (!roomId) return <ChatRoomList />;
  return <ChatView roomId={roomId} />;
}

/* ============================================================
   대화방 목록
   ============================================================ */
function ChatRoomList() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const myProfile = useMemo(() => getMyProfile(), []);
  const hasProfile = !!myProfile;
  const userName = myProfile?.name || '';

  useEffect(() => { setRooms(getChatRooms()); }, []);

  function startNewChat() {
    const name = userName || new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    const room = createChatRoom(name);
    navigate(`/chat/${room.id}`);
  }

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="px-5 pt-4 space-y-4">
        <FadeIn>
          <h1 className="text-display text-text-primary">사주대화</h1>
          <p className="text-caption text-text-muted mt-1">정통 명리학 기반 1:1 상담</p>
        </FadeIn>

        {/* 새 대화 시작 */}
        <FadeIn delay={0.03}>
          <motion.button whileTap={{ scale: 0.98 }} onClick={startNewChat}
            className="card-gold w-full text-left py-5 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(201,169,110,0.15)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-h2 text-text-primary">새 대화 시작하기</p>
                <p className="text-caption text-text-muted mt-0.5">
                  {hasProfile ? `${userName}님의 사주로 상담합니다` : '사주를 등록하면 더 정확해요'}
                </p>
              </div>
            </div>
          </motion.button>
        </FadeIn>

        {/* 대화방 목록 */}
        {rooms.length > 0 && (
          <FadeIn delay={0.06}>
            <p className="text-label text-text-hint font-bold mb-2">이전 대화</p>
            <div className="space-y-2">
              {rooms.map((room) => (
                <motion.button key={room.id} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/chat/${room.id}`)}
                  className={`card w-full text-left py-3.5 px-4 ${room.completed ? 'opacity-70' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: room.completed ? '#E8E0D410' : 'rgba(201,169,110,0.08)' }}>
                      {room.completed ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5">
                          <path d="M21 12a9 9 0 01-9 9c-1.5 0-2.9-.4-4.1-1L3 21l1.1-4.1A9 9 0 1121 12z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-h3 text-text-primary truncate">{room.name}</p>
                        {room.completed && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-border-light text-text-hint flex-shrink-0">상담 완료</span>
                        )}
                      </div>
                      <p className="text-caption text-text-muted truncate">{room.lastMessage || '대화를 시작해보세요'}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] text-text-hint">
                        {new Date(room.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-[9px] text-text-disabled">
                        {room.messages.length}회
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </FadeIn>
        )}

        {rooms.length === 0 && (
          <FadeIn delay={0.06}>
            <div className="text-center py-10">
              <p className="text-body-sm text-text-muted">아직 대화가 없어요</p>
              <p className="text-caption text-text-hint mt-1">새 대화를 시작해보세요</p>
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   대화 뷰
   ============================================================ */
function ChatView({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showWrapUp, setShowWrapUp] = useState(false);
  const toast = useToast();
  const timeCtx = useMemo(() => getTimeContext(), []);

  // 사주 프로필
  const myProfile = useMemo(() => getMyProfile(), []);
  const sajuData: SajuData | undefined = myProfile?.sajuData;
  const hasProfile = !!myProfile;
  const userName = myProfile?.name || '';
  const ilgan = myProfile?.sajuData.pillars[2]?.천간 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';

  const suggestedQuestions = useMemo(() => getSuggestedQuestions(hasProfile), [hasProfile]);

  // 대화방 로드
  useEffect(() => {
    const room = getChatRoom(roomId);
    if (room) {
      setIsCompleted(!!room.completed);
      if (room.messages.length > 0) {
        setMessages(room.messages);
        // 마무리 버튼 표시 여부
        const userMsgCount = room.messages.filter(m => m.role === 'user').length;
        if (userMsgCount >= 5 && !room.completed) setShowWrapUp(true);
        return;
      }
    }
    // 빈 방이면 웰컴 메시지
    const welcomeContent = hasProfile
      ? `${userName}님, ${timeCtx.greeting}\n\n${ilgan}(${oheng}) 일간이시네요. ${timeCtx.tip}\n\n궁금한 점이 있으시면 편하게 물어보세요.`
      : `${timeCtx.greeting}\n\n정통 명리학에 기반해 사주 상담을 도와드립니다.\n\n${timeCtx.tip}\n\n아래 질문을 탭하거나, 궁금한 걸 직접 물어보세요.`;
    const welcomeMsg: ChatMessage = {
      id: 'welcome', role: 'assistant', content: welcomeContent, keywords: suggestedQuestions, timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMsg]);
    addChatMessage(roomId, welcomeMsg);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 스크롤 하단
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  // 메시지 전송
  async function sendMessage(text: string) {
    if (!text.trim() || isLoading || isCompleted) return;

    // 대화권 체크
    const userMsgCount = messages.filter(m => m.role === 'user').length;
    if (userMsgCount === 0 && hasFreePass('chat')) {
      useFreePass('chat');
    } else {
      if (getChatCredits() > 0) {
        useChatCredit();
      } else {
        toast.show('대화권이 없어요. 1운으로 3회 대화할 수 있어요', 'info');
        setShowBuyCredits(true);
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(36), role: 'user', content: text.trim(), timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    addChatMessage(roomId, userMsg);
    setInputText('');
    setIsLoading(true);

    try {
      const history = messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }));
      const result = await generateChatAnswer(text.trim(), sajuData, history);

      const aiMsg: ChatMessage = {
        id: Date.now().toString(36) + '_ai', role: 'assistant', content: result.answer,
        keywords: result.keywords || ['더 자세히 알려줘', '다른 질문할게', '오늘 운세 알려줘'],
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      addChatMessage(roomId, aiMsg);

      // 5회 교환 후 마무리 버튼 표시
      if (userMsgCount + 1 >= 5) setShowWrapUp(true);
    } catch {
      const aiMsg: ChatMessage = {
        id: Date.now().toString(36) + '_ai', role: 'assistant',
        content: `${timeCtx.greeting}\n\n잠시 연결이 불안정해요. 다시 한번 물어봐주세요.`,
        keywords: ['다시 질문할게'],
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      addChatMessage(roomId, aiMsg);
    } finally {
      setIsLoading(false);
    }
  }

  // 마무리
  async function wrapUp() {
    setIsLoading(true);
    try {
      const history = messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }));
      const result = await generateChatAnswer('[WRAP_UP] 지금까지의 대화를 마무리해주세요.', sajuData, history);
      const wrapMsg: ChatMessage = {
        id: 'wrap_' + Date.now().toString(36), role: 'assistant', content: result.answer,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, wrapMsg]);
      addChatMessage(roomId, wrapMsg);
      completeChatRoom(roomId);
      setIsCompleted(true);
      setShowWrapUp(false);
    } catch {
      toast.show('마무리 요약 생성에 실패했어요', 'warning');
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F5F8' }}>
      {/* 헤더 */}
      <div className="flex-shrink-0 px-5 pt-safe-top" style={{ background: timeCtx.headerBg }}>
        <div className="flex items-center justify-between h-[56px]">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate('/chat')} className="w-8 h-8 flex items-center justify-center -ml-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8D5A8" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div>
              <h1 className="text-h3 text-white font-bold">사주대화</h1>
              <p className="text-[9px] text-white/40 -mt-0.5">{isCompleted ? '상담 완료' : '정통 명리학 기반 상담'}</p>
            </div>
          </div>
          {hasProfile && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-[10px] text-white/40">{ilgan}{oheng}</span>
            </div>
          )}
        </div>
        <div className="h-px bg-white/10" />
      </div>

      {/* 채팅 영역 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%]">
                <div className="rounded-2xl px-4 py-3 text-[14px] leading-relaxed"
                  style={msg.role === 'user'
                    ? { background: '#C9A96E', color: '#1B2A4A', borderBottomRightRadius: 4 }
                    : { background: '#FFFFFF', color: '#1B2A4A', borderBottomLeftRadius: 4, border: '1px solid #E2E5EC', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'} text-text-hint`}>
                  {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>

                {/* 키워드 + 마무리 버튼 */}
                {msg.role === 'assistant' && msg.keywords && msg.keywords.length > 0 && !isCompleted && (
                  <div className="space-y-2 mt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {msg.keywords.map(kw => (
                        <motion.button key={kw} whileTap={{ scale: 0.95 }} onClick={() => sendMessage(kw)}
                          className="px-3 py-1.5 rounded-full text-[12px] font-medium"
                          style={{ background: 'rgba(201,169,110,0.08)', color: '#8B7A5E', border: '1px solid rgba(201,169,110,0.2)' }}>
                          {kw}
                        </motion.button>
                      ))}
                    </div>
                    {showWrapUp && msg.id === messages[messages.length - 1]?.id && (
                      <motion.button initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        whileTap={{ scale: 0.95 }} onClick={wrapUp}
                        className="w-full py-2.5 rounded-xl text-[12px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                        사주 상담 마무리하기
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* 로딩 */}
          {isLoading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 flex items-center gap-2"
                style={{ background: '#FFFFFF', border: '1px solid #E2E5EC', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {['命', '理', '학'].map((char, i) => (
                  <motion.span key={i} className="text-[13px] font-bold" style={{ color: '#C9A96E' }}
                    animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }}>{char}</motion.span>
                ))}
                <motion.span className="text-[11px] text-text-hint ml-1"
                  animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.6 }}>분석 중...</motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 사주 미등록 CTA */}
        {!hasProfile && messages.length <= 1 && (
          <FadeIn delay={0.3}>
            <button onClick={() => navigate('/input')} className="card-gold w-full text-left">
              <p className="text-[13px] font-semibold text-text-primary">내 사주를 먼저 등록하면 더 정확해요</p>
              <p className="text-[11px] mt-1 text-text-muted">생년월일시 입력 후 대화하면, 사주 원국에 기반한 맞춤 상담을 받을 수 있습니다.</p>
            </button>
          </FadeIn>
        )}

        {/* 완료 후 안내 */}
        {isCompleted && (
          <FadeIn delay={0.2}>
            <div className="text-center py-4 space-y-3">
              <p className="text-caption text-text-hint">이 상담은 마무리됐어요</p>
              <button onClick={() => {
                const name = userName || new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
                const room = createChatRoom(name);
                navigate(`/chat/${room.id}`, { replace: true });
              }}
                className="px-6 py-2.5 rounded-xl text-caption font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                새 대화 시작하기
              </button>
            </div>
          </FadeIn>
        )}
      </div>

      {/* 대화권 구매 배너 */}
      {showBuyCredits && (
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-gold-solid)', border: '1px solid rgba(201,169,110,0.2)' }}>
            <p className="text-h3 text-text-primary">대화권이 모두 소진됐어요</p>
            <p className="text-caption text-text-muted mt-1">1운(500원)으로 3회 추가 대화할 수 있어요</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => {
                if (spendBalance(1)) { addChatCredits(3); toast.show('대화권 3회가 추가됐어요!', 'success'); setShowBuyCredits(false); }
                else { toast.show('잔액이 부족해요', 'warning'); navigate('/charge'); }
              }} className="flex-1 py-3 rounded-xl text-caption font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                1운으로 구매하기
              </button>
              <button onClick={() => setShowBuyCredits(false)} className="px-4 py-3 rounded-xl text-caption text-text-muted bg-bg-surface">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 입력 */}
      {!isCompleted && (
        <div className="flex-shrink-0 px-4 pb-[calc(84px+env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2 rounded-2xl p-2"
            style={{ background: '#FFFFFF', border: '1px solid #E2E5EC', boxShadow: '0 -2px 8px rgba(0,0,0,0.04)' }}>
            <textarea ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="궁금한 점을 물어보세요..." rows={1}
              className="flex-1 bg-transparent text-text-primary text-[14px] placeholder-text-hint resize-none outline-none px-2 py-2 max-h-[100px]"
              style={{ scrollbarWidth: 'none' }} />
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
              style={{ background: inputText.trim() ? '#C9A96E' : '#E2E5EC', opacity: inputText.trim() ? 1 : 0.5 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={inputText.trim() ? '#FFF' : '#8892A4'} strokeWidth="2" strokeLinecap="round" />
                <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke={inputText.trim() ? '#FFF' : '#8892A4'} strokeWidth="2" strokeLinejoin="round" fill="none" />
              </svg>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
