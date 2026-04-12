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
  getChatRooms, getChatRoom, createChatRoom, addChatMessage, completeChatRoom, updateRoomName,
  type ChatRoom, type ChatMessage, type ChatCategory,
} from '@/services/storage/chatStore';
import { useToast } from '@/components/common/Toast';
import type { SajuData } from '@/types/saju';

/* ─── 카테고리 설정 ─── */
const CATEGORIES: { id: ChatCategory; label: string; icon: string; color: string; desc: string }[] = [
  { id: 'love', label: '연애', icon: '愛', color: '#E91E63', desc: '인연·썸·이별·궁합' },
  { id: 'career', label: '직장', icon: '事', color: '#1565C0', desc: '이직·적성·승진' },
  { id: 'wealth', label: '재물', icon: '財', color: '#C9A96E', desc: '돈·투자·사업' },
  { id: 'free', label: '자유', icon: '話', color: '#4A5568', desc: '뭐든 물어보세요' },
];

const CATEGORY_WELCOME: Record<ChatCategory, { greeting: string; questions: string[] }> = {
  love: {
    greeting: '마음에 담아둔 사람이 있으신가요?\n사주로 인연의 흐름을 읽어볼게요.',
    questions: ['올해 좋은 인연이 올까요?', '지금 만나는 사람이랑 잘 될까요?', '전 애인이 자꾸 생각나요'],
  },
  career: {
    greeting: '직장 고민이 있으시군요.\n사주에서 지금이 어떤 시기인지 봐드릴게요.',
    questions: ['올해 이직해도 괜찮을까요?', '지금 직장에서 계속 버텨야 할까요?', '나한테 맞는 직업이 뭘까요?'],
  },
  wealth: {
    greeting: '돈 이야기, 솔직하게 해봐요.\n사주가 말하는 재물의 흐름을 알려드릴게요.',
    questions: ['올해 재물운이 어때요?', '투자해도 될 시기인가요?', '돈이 자꾸 새는 느낌이에요'],
  },
  free: {
    greeting: '',  // 시간대별 인사 사용
    questions: [],
  },
};

/* 시간대 인사 (자유 대화용) */
function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return '이 늦은 밤, 마음에 무언가 담긴 게 있으시군요.\n새벽의 고요한 기운 속에서 이야기 나눠볼까요.';
  if (h < 7) return '이른 아침이네요.\n오늘 하루의 기운을 미리 확인해볼까요?';
  if (h < 12) return '좋은 아침이에요!\n오전의 양(陽) 기운과 함께 궁금한 걸 물어보세요.';
  if (h < 14) return '점심시간, 잠깐의 여유를 내셨군요.\n편하게 이야기해주세요.';
  if (h < 18) return '오후의 여유로운 시간이에요.\n궁금한 점이 있으시면 편하게 물어보세요.';
  if (h < 21) return '하루가 저물어가네요.\n오늘 하루를 돌아보며 이야기 나눠볼까요.';
  return '고요한 밤이에요.\n밤의 직감은 낮보다 예리하니, 편하게 이야기해주세요.';
}

/* 자동 이름 추출 */
function autoRoomName(text: string): string {
  if (/이직|퇴사|취업|직장|직업|승진|면접/.test(text)) return '이직·직장 상담';
  if (/연애|사랑|썸|이별|전 ?애인|인연|결혼/.test(text)) return '연애 상담';
  if (/돈|재물|투자|재테크|부업|사업/.test(text)) return '재물 상담';
  if (/건강|피곤|아프|스트레스|불안|잠/.test(text)) return '고민 상담';
  if (/운세|올해|내년|이번 ?달/.test(text)) return '운세 상담';
  return text.slice(0, 18) + (text.length > 18 ? '...' : '');
}

/* 심층분석 추천 토픽 매핑 */
function getRelatedTopic(text: string): { id: string; label: string } | null {
  if (/연애|사랑|썸|이별|인연|결혼/.test(text)) return { id: 'love', label: '연애운 심층분석' };
  if (/이직|취업|직장|직업|승진/.test(text)) return { id: 'career', label: '취업·이직운 심층분석' };
  if (/돈|재물|투자|재테크|사업/.test(text)) return { id: 'wealth', label: '재물운 심층분석' };
  if (/건강|피곤|아프/.test(text)) return { id: 'health', label: '건강운 심층분석' };
  if (/결혼|배우자/.test(text)) return { id: 'marriage', label: '결혼운 심층분석' };
  return null;
}

/* ─── 태극 아바타 SVG ─── */
function TaegukAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
      style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.15)' }}>
      <svg width="16" height="16" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" stroke="#C9A96E" strokeWidth="1" fill="none" opacity="0.4" />
        <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#C9A96E" fillOpacity="0.5" />
        <circle cx="12" cy="7" r="2" fill="#C9A96E" />
        <circle cx="12" cy="17" r="2" fill="#C9A96E" fillOpacity="0.3" stroke="#C9A96E" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

/* ============================================================
   메인 — roomId로 분기
   ============================================================ */
export function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  usePageTitle('사주대화');
  if (!roomId) return <ChatRoomList />;
  return <ChatView roomId={roomId} />;
}

/* ============================================================
   A. 대화방 목록 — 분위기 있는 진입
   ============================================================ */
function ChatRoomList() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const myProfile = useMemo(() => getMyProfile(), []);
  const hasProfile = !!myProfile;
  const userName = myProfile?.name || '';
  const ilgan = myProfile?.sajuData.pillars[2]?.천간 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';

  useEffect(() => { setRooms(getChatRooms()); }, []);

  function startChat(category: ChatCategory) {
    const catLabel = CATEGORIES.find(c => c.id === category)?.label || '대화';
    const name = category === 'free'
      ? (userName || new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }))
      : `${catLabel} 상담`;
    const room = createChatRoom(name, category);
    navigate(`/chat/${room.id}`);
  }

  const h = new Date().getHours();
  const timeLabel = h < 5 ? '고요한 새벽' : h < 7 ? '이른 아침' : h < 12 ? '좋은 아침' : h < 14 ? '점심시간' : h < 18 ? '오후의 여유' : h < 21 ? '저녁 시간' : '고요한 밤';

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      {/* 분위기 헤더 */}
      <div className="px-5 pt-5 pb-6 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #1B2A4A 0%, #0F1D35 100%)' }}>
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #C9A96E, transparent 70%)' }} />
        <p className="text-[10px] text-white/30 mb-2">{timeLabel}</p>
        <h1 className="text-h1 text-white leading-snug">
          {hasProfile
            ? `${ilgan}(${oheng}) 일간\n${userName}님의 대화방`
            : '마음 속 이야기를\n들려주세요'}
        </h1>
        <p className="text-caption text-white/40 mt-2">정통 명리학 기반 1:1 사주 상담</p>
      </div>

      <div className="px-5 pt-4 space-y-5">
        {/* 카테고리 선택 */}
        <FadeIn delay={0.03}>
          <p className="text-label text-text-hint font-bold mb-2">어떤 이야기가 궁금하세요?</p>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((cat, i) => (
              <motion.button key={cat.id} whileTap={{ scale: 0.92 }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => startChat(cat.id)}
                className="card py-4 flex flex-col items-center gap-1.5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: `${cat.color}12` }}>
                  <span className="text-[18px] font-black" style={{ color: cat.color }}>{cat.icon}</span>
                </div>
                <p className="text-[12px] font-bold text-text-primary">{cat.label}</p>
                <p className="text-[9px] text-text-hint leading-tight text-center">{cat.desc}</p>
              </motion.button>
            ))}
          </div>
        </FadeIn>

        {/* 이전 대화 */}
        {rooms.length > 0 && (
          <FadeIn delay={0.08}>
            <p className="text-label text-text-hint font-bold mb-2">이전 대화</p>
            <div className="space-y-2">
              {rooms.map((room) => {
                const catInfo = CATEGORIES.find(c => c.id === room.category);
                return (
                  <motion.button key={room.id} whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/chat/${room.id}`)}
                    className={`card w-full text-left py-3.5 px-4 ${room.completed ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: room.completed ? '#F0EBE310' : `${catInfo?.color || '#C9A96E'}10` }}>
                        {room.completed
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                          : <span className="text-[14px] font-black" style={{ color: catInfo?.color || '#C9A96E' }}>{catInfo?.icon || '話'}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-body-sm font-semibold text-text-primary truncate">{room.name}</p>
                          {room.completed && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-border-light text-text-hint flex-shrink-0">완료</span>}
                        </div>
                        <p className="text-[11px] text-text-muted truncate mt-0.5">{room.lastMessage || '대화를 시작해보세요'}</p>
                      </div>
                      <div className="flex-shrink-0 text-right pl-2">
                        <p className="text-[10px] text-text-hint">{new Date(room.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</p>
                        <p className="text-[9px] text-text-disabled">{Math.floor(room.messages.filter(m => m.role === 'user').length)}회</p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </FadeIn>
        )}

        {/* 안내 문구 */}
        <p className="text-[9px] text-text-disabled text-center px-4 leading-relaxed pt-2">
          매일 1회 무료 · 추가 대화 1운(500원)=3회
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   B. 대화 뷰 — 아바타, 맞춤 웰컴, 심층분석 유도
   ============================================================ */
function ChatView({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [category, setCategory] = useState<ChatCategory>('free');
  const [roomNameSet, setRoomNameSet] = useState(false);
  const toast = useToast();

  const myProfile = useMemo(() => getMyProfile(), []);
  const sajuData: SajuData | undefined = myProfile?.sajuData;
  const hasProfile = !!myProfile;
  const userName = myProfile?.name || '';
  const ilgan = myProfile?.sajuData.pillars[2]?.천간 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';

  // 대화방 로드
  useEffect(() => {
    const room = getChatRoom(roomId);
    if (room) {
      setIsCompleted(!!room.completed);
      setCategory(room.category || 'free');
      if (room.messages.length > 0) {
        setMessages(room.messages);
        setRoomNameSet(true);
        const userCount = room.messages.filter(m => m.role === 'user').length;
        if (userCount >= 5 && !room.completed) setShowWrapUp(true);
        return;
      }
    }

    // 빈 방 → 카테고리별 웰컴 메시지
    const cat = room?.category || 'free';
    const catWelcome = CATEGORY_WELCOME[cat];
    const baseGreeting = catWelcome.greeting || getTimeGreeting();
    const personalGreeting = hasProfile
      ? `${userName}님, ${baseGreeting}`
      : baseGreeting;

    const defaultQuestions = catWelcome.questions.length > 0
      ? catWelcome.questions
      : hasProfile
        ? ['올해 나에게 가장 좋은 달은?', '내 사주에서 가장 강한 기운은?', '요즘 고민이 있어요']
        : ['내 연애 스타일이 궁금해요', '올해 운세가 궁금해요', '사주명리학이 뭔가요?'];

    const welcomeMsg: ChatMessage = {
      id: 'welcome', role: 'assistant', content: personalGreeting,
      keywords: defaultQuestions, timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMsg]);
    addChatMessage(roomId, welcomeMsg);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  // 메시지 전송
  async function sendMessage(text: string) {
    if (!text.trim() || isLoading || isCompleted) return;

    const userMsgCount = messages.filter(m => m.role === 'user').length;
    if (userMsgCount === 0 && hasFreePass('chat')) {
      useFreePass('chat');
    } else {
      if (getChatCredits() > 0) { useChatCredit(); }
      else { setShowBuyCredits(true); return; }
    }

    // 첫 메시지로 대화방 이름 자동 설정
    if (!roomNameSet) {
      const autoName = autoRoomName(text.trim());
      updateRoomName(roomId, autoName);
      setRoomNameSet(true);
    }

    const userMsg: ChatMessage = { id: Date.now().toString(36), role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    addChatMessage(roomId, userMsg);
    setInputText('');
    setIsLoading(true);

    try {
      const history = messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }));
      const result = await generateChatAnswer(text.trim(), sajuData, history);
      const aiMsg: ChatMessage = {
        id: Date.now().toString(36) + '_ai', role: 'assistant', content: result.answer,
        keywords: result.keywords || ['더 자세히 알려줘', '다른 질문할게'],
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      addChatMessage(roomId, aiMsg);
      if (userMsgCount + 1 >= 5) setShowWrapUp(true);
    } catch {
      const aiMsg: ChatMessage = {
        id: Date.now().toString(36) + '_ai', role: 'assistant',
        content: '잠시 연결이 불안정해요. 다시 한번 물어봐주세요.',
        keywords: ['다시 질문할게'], timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      addChatMessage(roomId, aiMsg);
    } finally { setIsLoading(false); }
  }

  async function wrapUp() {
    setIsLoading(true);
    try {
      const history = messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }));
      const result = await generateChatAnswer('[WRAP_UP] 지금까지의 대화를 마무리해주세요.', sajuData, history);
      const wrapMsg: ChatMessage = { id: 'wrap_' + Date.now().toString(36), role: 'assistant', content: result.answer, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, wrapMsg]);
      addChatMessage(roomId, wrapMsg);
      completeChatRoom(roomId);
      setIsCompleted(true);
      setShowWrapUp(false);
    } catch { toast.show('마무리 요약 생성에 실패했어요', 'warning'); }
    finally { setIsLoading(false); }
  }

  // 심층분석 추천 (3번째 AI 응답마다)
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  const allUserTexts = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
  const relatedTopic = getRelatedTopic(allUserTexts);
  const showTopicCard = relatedTopic && userMsgCount >= 3 && userMsgCount % 3 === 0 && !isCompleted;

  const headerBg = (() => {
    const h = new Date().getHours();
    return (h < 5 || h >= 21) ? '#0F1D35' : '#1B2A4A';
  })();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F5F8' }}>
      {/* 헤더 */}
      <div className="flex-shrink-0 px-4 pt-safe-top" style={{ background: headerBg }}>
        <div className="flex items-center justify-between h-[52px]">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/chat')} className="w-8 h-8 flex items-center justify-center -ml-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8D5A8" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <TaegukAvatar />
            <div>
              <h1 className="text-[14px] text-white font-bold">사주 상담</h1>
              <p className="text-[9px] text-white/35">{isCompleted ? '상담 완료' : hasProfile ? `${ilgan}(${oheng}) 일간` : '정통 명리학 기반'}</p>
            </div>
          </div>
        </div>
        <div className="h-px bg-white/8" />
      </div>

      {/* 채팅 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-2'}`}>
              {/* AI 아바타 */}
              {msg.role === 'assistant' && <TaegukAvatar />}

              <div className={`max-w-[80%] ${msg.role === 'user' ? '' : 'flex-1'}`}>
                <div className="rounded-2xl px-4 py-3 text-[14px] leading-[1.7]"
                  style={msg.role === 'user'
                    ? { background: '#C9A96E', color: '#FFFFFF', borderBottomRightRadius: 4 }
                    : { background: '#FFFFFF', color: '#1B2A4A', borderBottomLeftRadius: 4, border: '1px solid #E8E0D4', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
                <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'} text-text-disabled`}>
                  {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>

                {/* 키워드 + 마무리 */}
                {msg.role === 'assistant' && msg.keywords && msg.keywords.length > 0 && !isCompleted && (
                  <div className="space-y-2 mt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {msg.keywords.map(kw => (
                        <motion.button key={kw} whileTap={{ scale: 0.95 }} onClick={() => sendMessage(kw)}
                          className="px-3 py-1.5 rounded-full text-[11px] font-medium"
                          style={{ background: '#F5F0E8', color: '#8B7A5E', border: '1px solid #E8E0D4' }}>
                          {kw}
                        </motion.button>
                      ))}
                    </div>
                    {showWrapUp && idx === messages.length - 1 && (
                      <div className="flex gap-2">
                        <button onClick={() => setShowWrapUp(false)}
                          className="flex-1 py-2 rounded-xl text-[11px] font-semibold text-text-muted bg-bg-surface border border-border-light">
                          계속 대화하기
                        </button>
                        <button onClick={wrapUp}
                          className="flex-1 py-2 rounded-xl text-[11px] font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                          상담 마무리하기
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* 로딩 */}
          {isLoading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start gap-2">
              <TaegukAvatar />
              <div className="rounded-2xl px-4 py-3 flex items-center gap-2"
                style={{ background: '#FFFFFF', border: '1px solid #E8E0D4' }}>
                {['命', '理', '학'].map((c, i) => (
                  <motion.span key={i} className="text-[13px] font-bold" style={{ color: '#C9A96E' }}
                    animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }}>{c}</motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 심층분석 추천 카드 */}
        {showTopicCard && relatedTopic && (
          <FadeIn delay={0.3}>
            <button onClick={() => navigate(`/topic/${relatedTopic.id}`)}
              className="w-full rounded-2xl p-3.5 text-left flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.08), rgba(201,169,110,0.03))', border: '1px solid rgba(201,169,110,0.2)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,169,110,0.12)' }}>
                <span className="text-[13px] font-black text-brand-gold">深</span>
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-bold text-text-primary">{relatedTopic.label}</p>
                <p className="text-[10px] text-text-muted">대화보다 더 깊은 분석이 필요하다면 · 1운</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </FadeIn>
        )}

        {/* 사주 미등록 */}
        {!hasProfile && messages.length <= 1 && (
          <FadeIn delay={0.3}>
            <button onClick={() => navigate('/input')} className="card-gold w-full text-left">
              <p className="text-[12px] font-semibold text-text-primary">내 사주를 먼저 등록하면 더 정확해요</p>
              <p className="text-[10px] mt-1 text-text-muted">생년월일시 입력 후 맞춤 상담을 받아보세요</p>
            </button>
          </FadeIn>
        )}

        {/* 완료 */}
        {isCompleted && (
          <FadeIn delay={0.2}>
            <div className="text-center py-4 space-y-3">
              <p className="text-[11px] text-text-hint">이 상담은 마무리됐어요</p>
              <button onClick={() => { const room = createChatRoom(userName || '새 대화'); navigate(`/chat/${room.id}`, { replace: true }); }}
                className="px-6 py-2.5 rounded-xl text-[12px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>새 대화 시작하기</button>
            </div>
          </FadeIn>
        )}
      </div>

      {/* 대화권 구매 */}
      {showBuyCredits && (
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="rounded-2xl p-4" style={{ background: '#FFFCF5', border: '1px solid rgba(201,169,110,0.2)' }}>
            <p className="text-[14px] font-bold text-text-primary">오늘의 대화가 도움이 됐다면</p>
            <p className="text-[12px] text-text-muted mt-1">1운으로 3회 더 이야기할 수 있어요</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => {
                if (spendBalance(1)) { addChatCredits(3); toast.show('대화권 3회 추가!', 'success'); setShowBuyCredits(false); }
                else { toast.show('잔액이 부족해요', 'warning'); navigate('/charge'); }
              }} className="flex-1 py-3 rounded-xl text-[12px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>1운으로 계속하기</button>
              <button onClick={() => setShowBuyCredits(false)} className="px-4 py-3 rounded-xl text-[12px] text-text-muted bg-bg-surface">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 입력 */}
      {!isCompleted && (
        <div className="flex-shrink-0 px-4 pb-[calc(84px+env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2 rounded-2xl p-2"
            style={{ background: '#FFFFFF', border: '1px solid #E8E0D4', boxShadow: '0 -2px 8px rgba(0,0,0,0.03)' }}>
            <textarea value={inputText} onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); } }}
              placeholder="궁금한 점을 물어보세요..." rows={1}
              className="flex-1 bg-transparent text-text-primary text-[14px] placeholder-text-hint resize-none outline-none px-2 py-2 max-h-[100px]"
              style={{ scrollbarWidth: 'none' }} />
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: inputText.trim() ? '#C9A96E' : '#E8E0D4', opacity: inputText.trim() ? 1 : 0.5 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={inputText.trim() ? '#FFF' : '#A8B1C1'} strokeWidth="2" strokeLinecap="round" />
                <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke={inputText.trim() ? '#FFF' : '#A8B1C1'} strokeWidth="2" strokeLinejoin="round" fill="none" />
              </svg>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
