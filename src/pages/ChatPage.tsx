import { useState, useRef, useEffect, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { getMyProfile, getReports } from '@/services/storage/localStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { generateChatAnswer } from '@/services/ai/reportGenerator';
import { stripMd } from '@/utils/format';
import { hasFreePass, useFreePass } from '@/services/storage/dailyFreePass';
import { getChatCredits, useChatCredit, addChatCredits } from '@/services/storage/chatCredit';
import { spendBalance, getBalance } from '@/services/storage/localStore';
import {
  getChatRooms, getChatRoom, createChatRoom, addChatMessage, completeChatRoom, updateRoomName,
  type ChatRoom, type ChatMessage,
} from '@/services/storage/chatStore';
import { useToast } from '@/components/common/Toast';
import type { SajuData } from '@/types/saju';

/* ─── 시간대 인사 ─── */
function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return { label: '고요한 새벽', greeting: '이 늦은 밤, 마음에 무언가 담긴 게 있으시군요.\n편하게 이야기해주세요.', headerBg: '#0F1D35' };
  if (h < 7) return { label: '이른 아침', greeting: '이른 아침이네요.\n오늘 하루의 기운을 미리 확인해볼까요?', headerBg: '#1B2A4A' };
  if (h < 12) return { label: '좋은 아침', greeting: '좋은 아침이에요!\n오늘 궁금한 점이 있으시면 편하게 물어보세요.', headerBg: '#1B2A4A' };
  if (h < 14) return { label: '점심시간', greeting: '점심시간, 잠깐의 여유를 내셨군요.\n편하게 이야기해주세요.', headerBg: '#1B2A4A' };
  if (h < 18) return { label: '오후의 여유', greeting: '오후의 여유로운 시간이에요.\n궁금한 점이 있으시면 물어보세요.', headerBg: '#1B2A4A' };
  if (h < 21) return { label: '저녁 시간', greeting: '하루가 저물어가네요.\n오늘 하루를 돌아보며 이야기 나눠볼까요.', headerBg: '#1B2A4A' };
  return { label: '고요한 밤', greeting: '고요한 밤이에요.\n밤의 직감은 낮보다 예리하니, 편하게 이야기해주세요.', headerBg: '#0F1D35' };
}

/* 추천 주제 — 시간대+프로필에 따라 */
function getSuggestedTopics(hasProfile: boolean) {
  const h = new Date().getHours();
  if (hasProfile) {
    if (h < 7) return ['오늘 중요한 일이 있는데 어떨까요?', '요즘 고민이 있어요', '올해 운세가 궁금해요'];
    if (h < 12) return ['오늘 하루 운세가 궁금해요', '이직을 고민하고 있어요', '연애운이 궁금해요'];
    if (h < 18) return ['오후에 미팅이 있는데 잘 될까요?', '재테크 시기가 궁금해요', '건강이 걱정돼요'];
    if (h < 22) return ['내일은 어떤 하루가 될까요?', '요즘 관계가 좀 복잡해요', '올해 남은 기간 운세'];
    return ['잠이 안 오는데 고민이 있어요', '올해 인연이 올까요?', '마음이 좀 복잡해요'];
  }
  return ['올해 운세가 궁금해요', '내 연애 스타일이 궁금해요', '사주로 뭘 알 수 있나요?'];
}

/* 자동 대화방 이름 */
function autoRoomName(text: string): string {
  if (/이직|퇴사|취업|직장|직업|승진|면접/.test(text)) return '이직·직장 상담';
  if (/연애|사랑|썸|이별|전 ?애인|인연|결혼|궁합/.test(text)) return '연애 상담';
  if (/돈|재물|투자|재테크|부업|사업/.test(text)) return '재물 상담';
  if (/건강|피곤|아프|스트레스|불안|잠/.test(text)) return '고민 상담';
  if (/운세|올해|내년|이번 ?달/.test(text)) return '운세 상담';
  return text.slice(0, 18) + (text.length > 18 ? '...' : '');
}

/* 대화 중 콘텐츠 추천 매핑 */
interface ContentRecommendation {
  type: 'topic' | 'compat' | 'tojung' | 'daeun' | 'monthly';
  path: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
}

function getContentRecommendation(allUserTexts: string, msgCount: number): ContentRecommendation | null {
  if (msgCount < 2) return null;

  // 3회마다 한 번씩만 추천 (대화 흐름 방해 방지)
  if (msgCount % 3 !== 0) return null;

  if (/궁합|상대방|남자친구|여자친구|배우자|커플/.test(allUserTexts))
    return { type: 'compat', path: '/compat', title: '궁합 분석 해보는 거 어때요?', desc: '두 사람의 사주를 비교해서 성격·소통·감정 궁합을 점수로', icon: '合', color: '#E91E63' };

  if (/이직|취업|직장|직업|승진|적성/.test(allUserTexts))
    return { type: 'topic', path: '/topic/career', title: '취업·이직운 심층분석 추천드려요', desc: '이직 타이밍, 맞는 업종, 면접 유리한 날까지 상세 분석', icon: '事', color: '#1565C0' };

  if (/연애|사랑|썸|이별|인연/.test(allUserTexts))
    return { type: 'topic', path: '/topic/love', title: '연애운 심층분석을 받아보시겠어요?', desc: '이상형, 인연 시기, 연애 패턴까지 깊이 있게', icon: '愛', color: '#E91E63' };

  if (/돈|재물|투자|재테크|사업/.test(allUserTexts))
    return { type: 'topic', path: '/topic/wealth', title: '재물운 심층분석이 도움될 거예요', desc: '돈 흐름, 투자 적기, 새는 돈 패턴까지', icon: '財', color: '#C9A96E' };

  if (/건강|피곤|아프/.test(allUserTexts))
    return { type: 'topic', path: '/topic/health', title: '건강운 심층분석을 추천합니다', desc: '오행별 취약 장기, 주의 시기, 체질 분석', icon: '健', color: '#2E7D32' };

  if (/결혼|배우자|혼인/.test(allUserTexts))
    return { type: 'topic', path: '/topic/marriage', title: '결혼운 심층분석 보시겠어요?', desc: '결혼 적기, 배우자 성향, 결혼 후 생활까지', icon: '婚', color: '#E91E63' };

  if (/올해|내년|2026|대운/.test(allUserTexts))
    return { type: 'tojung', path: '/tojung', title: '토정비결로 올해를 더 자세히 보시겠어요?', desc: '2026년 월별 운세 + 전통 해석', icon: '卜', color: '#C9A96E' };

  if (/대운|10년|흐름|시기/.test(allUserTexts))
    return { type: 'daeun', path: '/daeun', title: '대운 해설을 받아보시는 건 어떨까요?', desc: '10년 단위 운의 흐름, 지금이 어떤 시기인지', icon: '運', color: '#1B2A4A' };

  // 기본 — 5회 이후에 월별운세 추천
  if (msgCount >= 5)
    return { type: 'monthly', path: '/monthly', title: '월별 운세도 확인해보세요', desc: '2026년 12개월 흐름을 한눈에', icon: '月', color: '#4A5568' };

  return null;
}

/* ─── 태극 아바타 ─── */
function TaegukAvatar({ size = 32 }: { size?: number }) {
  const s = size * 0.5;
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 mt-1"
      style={{ width: size, height: size, background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.12)' }}>
      <svg width={s} height={s} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" stroke="#C9A96E" strokeWidth="1" fill="none" opacity="0.4" />
        <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#C9A96E" fillOpacity="0.5" />
        <circle cx="12" cy="7" r="2" fill="#C9A96E" />
        <circle cx="12" cy="17" r="2" fill="#C9A96E" fillOpacity="0.3" stroke="#C9A96E" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

/* ============================================================
   메인
   ============================================================ */
export function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  usePageTitle('사주대화');
  if (!roomId) return <ChatRoomList />;
  return <ChatView roomId={roomId} />;
}

/* ============================================================
   A. 대화방 목록 — 바로 대화 시작 + 이전 대화 리스트
   ============================================================ */
function ChatRoomList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [showChargeConfirm, setShowChargeConfirm] = useState(false);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const myProfile = useMemo(() => getMyProfile(), []);
  const hasProfile = !!myProfile;
  const userName = myProfile?.name || '';
  const timeCtx = useMemo(() => getTimeGreeting(), []);
  const suggestedTopics = useMemo(() => getSuggestedTopics(hasProfile), [hasProfile]);

  // 프로필 목록 (중복 제거)
  const profiles = useMemo(() => {
    const all = getReports();
    const seen = new Map<string, any>();
    for (const r of all) {
      if (r.contentType === 'compat' || r.input?.relation === 'compat') continue;
      if (r.name?.includes('×') || r.name?.includes('x')) continue;
      if (!r.input?.birthYear || !r.sajuData?.pillars?.length) continue;
      const key = `${r.name}_${r.input.birthYear}_${r.input.birthMonth}_${r.input.birthDay}`;
      if (!seen.has(key)) seen.set(key, r);
    }
    return Array.from(seen.values());
  }, []);

  useEffect(() => { setRooms(getChatRooms()); }, []);

  function startNewChat(profileOverride?: any) {
    const profile = profileOverride || myProfile;
    const name = profile?.name || new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    const room = createChatRoom(name);
    // 프로필 정보를 state로 전달 → ChatView에서 사용
    navigate(`/chat/${room.id}`, { state: { profile } });
  }

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      {/* 분위기 헤더 */}
      <div className="px-5 pt-5 pb-6 relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${timeCtx.headerBg} 0%, ${timeCtx.headerBg}E0 100%)` }}>
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #C9A96E, transparent 70%)' }} />
        <div className="flex items-center gap-3 mb-3">
          <TaegukAvatar size={40} />
          <div>
            <p className="text-[10px] text-white/30">{timeCtx.label}</p>
            <h1 className="text-h2 text-white">사주 상담</h1>
          </div>
        </div>
        {hasProfile ? (
          <p className="text-[13px] text-white/60 leading-relaxed">{userName}님, {timeCtx.greeting.split('\n')[0]}</p>
        ) : (
          <p className="text-[13px] text-white/60 leading-relaxed">{timeCtx.greeting.split('\n')[0]}</p>
        )}
      </div>

      <div className="px-5 pt-4 space-y-5">
        {/* 새 대화 시작 */}
        <FadeIn delay={0.03}>
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => profiles.length > 1 ? setShowProfilePicker(true) : startNewChat()}
            className="w-full rounded-2xl py-5 px-5 text-left"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)', boxShadow: '0 4px 16px rgba(201,169,110,0.3)' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 12a9 9 0 01-9 9c-1.5 0-2.9-.4-4.1-1L3 21l1.1-4.1A9 9 0 1121 12z" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </div>
              <div>
                <p className="text-[16px] font-bold text-white">새 대화 시작하기</p>
                <p className="text-[11px] text-white/70 mt-0.5">{profiles.length > 1 ? '누구의 사주로 상담할지 선택하세요' : '편하게 아무거나 물어보세요'}</p>
              </div>
            </div>
          </motion.button>
        </FadeIn>

        {/* 프로필 선택 모달 */}
        <AnimatePresence>
          {showProfilePicker && (
            <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowProfilePicker(false)} />
              <motion.div className="relative w-full max-w-[520px] rounded-t-3xl overflow-hidden"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{ background: 'var(--bg-card)' }}>
                <div className="px-5 pt-5 pb-2">
                  <p className="text-h2 text-text-primary">누구의 사주로 상담할까요?</p>
                  <p className="text-caption text-text-muted mt-1">선택한 사주 데이터를 기반으로 대화해요</p>
                </div>
                <div className="px-5 pb-6 space-y-2 max-h-[50vh] overflow-y-auto">
                  {profiles.map((p: any) => {
                    const pIlgan = p.sajuData?.pillars?.[2]?.천간 || '';
                    const pOheng = pIlgan ? CHEONGAN_OHENG[pIlgan] : '';
                    const isMe = !p.input?.relation || p.input.relation === '본인' || p.input.relation === 'self';
                    return (
                      <motion.button key={p.id} whileTap={{ scale: 0.97 }}
                        onClick={() => { setShowProfilePicker(false); startNewChat(p); }}
                        className={`w-full card text-left py-4 px-4 ${isMe ? 'border-l-4 border-l-brand-gold' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: isMe ? 'rgba(27,42,74,0.08)' : 'rgba(201,169,110,0.08)' }}>
                            <span className="text-h3 font-bold" style={{ color: isMe ? '#1B2A4A' : '#C9A96E' }}>{p.name?.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-h3 text-text-primary">{p.name}</p>
                              {isMe && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-navy text-white">나</span>}
                            </div>
                            <p className="text-caption text-text-muted">{pIlgan ? `${pIlgan}(${pOheng}) 일간` : '사주 정보'}</p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 오늘 이런 거 물어보면 어때요? */}
        <FadeIn delay={0.06}>
          <p className="text-[11px] text-text-hint font-semibold mb-2">이런 거 물어보면 어때요?</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedTopics.map((topic, i) => (
              <motion.button key={i} whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.04 }}
                onClick={() => {
                  const room = createChatRoom(autoRoomName(topic));
                  navigate(`/chat/${room.id}`, { state: { prefill: topic } });
                }}
                className="px-3 py-2 rounded-full text-[11px] font-medium"
                style={{ background: '#F5F0E8', color: '#8B7A5E', border: '1px solid #E8E0D4' }}>
                {topic}
              </motion.button>
            ))}
          </div>
        </FadeIn>

        {/* 이전 대화 */}
        {rooms.length > 0 && (
          <FadeIn delay={0.1}>
            <p className="text-[11px] text-text-hint font-semibold mb-2">이전 대화</p>
            <div className="space-y-2">
              {rooms.map((room) => (
                <motion.button key={room.id} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/chat/${room.id}`)}
                  className={`card w-full text-left py-3 px-4 ${room.completed ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <TaegukAvatar size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-text-primary truncate">{room.name}</p>
                        {room.completed && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-border-light text-text-hint flex-shrink-0">완료</span>}
                      </div>
                      <p className="text-[11px] text-text-muted truncate mt-0.5">{room.lastMessage || '대화를 시작해보세요'}</p>
                    </div>
                    <div className="flex-shrink-0 text-right pl-2">
                      <p className="text-[10px] text-text-hint">{new Date(room.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </FadeIn>
        )}

        {/* 대화권 상태 */}
        <FadeIn delay={0.12}>
          {(() => {
            const hasFree = hasFreePass('chat');
            const credits = getChatCredits();
            const totalRemaining = (hasFree ? 1 : 0) + credits;
            return (
              <div className="card py-3.5 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: totalRemaining > 0 ? 'rgba(201,169,110,0.1)' : 'rgba(211,47,47,0.08)' }}>
                      <span className="text-[14px] font-black" style={{ color: totalRemaining > 0 ? '#C9A96E' : '#D32F2F' }}>
                        {totalRemaining}
                      </span>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-text-primary">
                        {totalRemaining > 0 ? `대화 ${totalRemaining}회 가능` : '대화권이 없어요'}
                      </p>
                      <p className="text-[10px] text-text-hint">
                        {hasFree ? `무료 1회${credits > 0 ? ` + ${credits}회` : ''}` : credits > 0 ? `${credits}회 남음` : '1운으로 3회 충전'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowChargeConfirm(true)}
                    className="px-4 py-2 rounded-xl text-[11px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)', color: '#FFF' }}>
                    충전하기
                  </button>
                </div>
              </div>
            );
          })()}
        </FadeIn>
      </div>

      {/* 대화권 충전 확인 팝업 */}
      <AnimatePresence>
        {showChargeConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowChargeConfirm(false)} />
            <motion.div
              className="relative w-full max-w-[320px] rounded-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              style={{ background: 'var(--bg-card)', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
            >
              <div className="px-5 pt-6 pb-2 text-center">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.12), rgba(201,169,110,0.04))' }}>
                  <span className="text-[24px] font-black text-brand-gold">運</span>
                </div>
                <p className="text-[16px] font-bold text-text-primary">대화권 충전</p>
                <p className="text-[12px] text-text-muted mt-1">1운으로 대화 3회를 추가해요</p>
              </div>
              <div className="px-5 py-3">
                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(201,169,110,0.05)' }}>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-secondary">현재 잔액</span>
                    <span className="font-bold text-brand-gold">{getBalance()}운</span>
                  </div>
                  <div className="flex justify-between text-[11px] mt-1.5">
                    <span className="text-text-secondary">차감</span>
                    <span className="font-bold text-func-danger">-1운</span>
                  </div>
                  <div className="flex justify-between text-[11px] mt-1.5 pt-1.5 border-t border-border-light">
                    <span className="text-text-secondary">추가 대화</span>
                    <span className="font-bold text-brand-gold">+3회</span>
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button onClick={() => setShowChargeConfirm(false)}
                  className="flex-1 py-3 rounded-xl text-[12px] font-semibold text-text-muted bg-bg-surface border border-border-light">취소</button>
                <button onClick={() => {
                  if (spendBalance(1)) {
                    addChatCredits(3);
                    toast.show('대화권 3회가 추가됐어요!', 'success');
                    setShowChargeConfirm(false);
                  } else {
                    toast.show('잔액이 부족해요', 'warning');
                    setShowChargeConfirm(false);
                    navigate('/charge', { state: { message: '사주대화에 1운이 필요해요' } });
                  }
                }}
                  className="flex-1 py-3 rounded-xl text-[12px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>충전하기</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   B. 대화 뷰
   ============================================================ */
function ChatView({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [roomNameSet, setRoomNameSet] = useState(false);
  const toast = useToast();
  const timeCtx = useMemo(() => getTimeGreeting(), []);

  // state로 전달된 프로필 우선, 없으면 내 프로필
  const stateProfile = (location.state as any)?.profile;
  const myProfile = useMemo(() => stateProfile || getMyProfile(), [stateProfile]);
  const sajuData: SajuData | undefined = myProfile?.sajuData;
  const hasProfile = !!myProfile;
  const userName = myProfile?.name || '';
  const ilgan = myProfile?.sajuData?.pillars?.[2]?.천간 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';

  // 대화방 로드
  useEffect(() => {
    const room = getChatRoom(roomId);
    if (room) {
      setIsCompleted(!!room.completed);
      if (room.messages.length > 0) {
        setMessages(room.messages);
        setRoomNameSet(true);
        const userCount = room.messages.filter(m => m.role === 'user').length;
        if (userCount >= 5 && !room.completed) setShowWrapUp(true);
        return;
      }
    }

    // 빈 방 → 웰컴 메시지
    const personalGreeting = hasProfile
      ? `${userName}님, ${timeCtx.greeting}`
      : `${timeCtx.greeting}\n\n사주를 등록하면 더 정확한 맞춤 상담을 받을 수 있어요.`;

    const defaultQuestions = hasProfile
      ? ['올해 나에게 가장 좋은 달은?', '내 사주에서 강한 기운은?', '요즘 고민이 있어요']
      : ['내 연애 스타일이 궁금해요', '올해 운세가 궁금해요', '사주로 뭘 알 수 있나요?'];

    const welcomeMsg: ChatMessage = {
      id: 'welcome', role: 'assistant', content: personalGreeting,
      keywords: defaultQuestions, timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMsg]);
    addChatMessage(roomId, welcomeMsg);

    // state로 전달된 prefill이 있으면 입력창에 미리 채우기 (유저가 직접 전송)
    const state = window.history.state?.usr as any;
    if (state?.prefill) {
      setInputText(state.prefill);
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  // AI 응답 대기 중 페이지 이탈 방지
  useEffect(() => {
    if (!isLoading) return;
    const handleBeforeNav = (_e: PopStateEvent) => {
      // 뒤로가기 차단하고 안내
      if (isLoading) {
        window.history.pushState(null, '', window.location.href);
        toast.show('답변을 기다리고 있어요. 잠시만요!', 'info');
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handleBeforeNav);
    return () => window.removeEventListener('popstate', handleBeforeNav);
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading || isCompleted) return;

    const userMsgCount = messages.filter(m => m.role === 'user').length;
    if (userMsgCount === 0 && hasFreePass('chat')) {
      useFreePass('chat');
    } else {
      if (getChatCredits() > 0) { useChatCredit(); }
      else { setShowBuyCredits(true); return; }
    }

    if (!roomNameSet) {
      updateRoomName(roomId, autoRoomName(text.trim()));
      setRoomNameSet(true);
      // 프로모션 이벤트: 첫 대화 메시지
      import('@/services/toss/tossPromotion').then(m => m.triggerPromotionEvent(m.PROMO_EVENTS.CHAT_START));
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

  // 콘텐츠 추천
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  const allUserTexts = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
  const contentRec = getContentRecommendation(allUserTexts, userMsgCount);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F5F8' }}>
      {/* 헤더 */}
      <div className="flex-shrink-0 px-4 pt-safe-top" style={{ background: timeCtx.headerBg }}>
        <div className="flex items-center justify-between h-[52px]">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/chat')} className="w-8 h-8 flex items-center justify-center -ml-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8D5A8" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <TaegukAvatar size={28} />
            <div>
              <h1 className="text-[14px] text-white font-bold">사주 상담</h1>
              <p className="text-[9px] text-white/35">{isCompleted ? '상담 완료' : hasProfile ? `${ilgan}(${oheng}) 일간` : '정통 명리학 기반'}</p>
            </div>
          </div>
          {/* 잔여 대화권 — 탭하면 충전 팝업 */}
          {!isCompleted && (() => {
            const hasFree = hasFreePass('chat');
            const credits = getChatCredits();
            const total = (hasFree ? 1 : 0) + credits;
            return (
              <button onClick={() => setShowBuyCredits(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-[10px] font-bold" style={{ color: total > 0 ? '#E8D5A8' : '#FF6B6B' }}>
                  {total > 0 ? `${total}회` : '0회'}
                </span>
                <span className="text-[9px] text-white/40">충전</span>
              </button>
            );
          })()}
        </div>
        <div className="h-px bg-white/8" />
      </div>

      {/* 채팅 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-2'}`}>
              {msg.role === 'assistant' && <TaegukAvatar />}
              <div className={`max-w-[80%] ${msg.role === 'user' ? '' : 'flex-1'}`}>
                <div className="rounded-2xl px-4 py-3 text-[14px] leading-[1.7]"
                  style={msg.role === 'user'
                    ? { background: '#C9A96E', color: '#FFFFFF', borderBottomRightRadius: 4 }
                    : { background: '#FFFFFF', color: '#1B2A4A', borderBottomLeftRadius: 4, border: '1px solid #E8E0D4', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                  <p className="whitespace-pre-line">{stripMd(msg.content)}</p>
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

        {/* 콘텐츠 추천 카드 */}
        {contentRec && !isCompleted && (
          <FadeIn delay={0.3}>
            <button onClick={() => navigate(contentRec.path)}
              className="w-full rounded-2xl p-4 text-left flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.06), rgba(201,169,110,0.02))', border: '1px solid rgba(201,169,110,0.18)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${contentRec.color}12` }}>
                <span className="text-[15px] font-black" style={{ color: contentRec.color }}>{contentRec.icon}</span>
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-bold text-text-primary">{contentRec.title}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{contentRec.desc} · 1운</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </FadeIn>
        )}

        {/* 사주 미등록 */}
        {!hasProfile && messages.length <= 1 && (
          <FadeIn delay={0.3}>
            <button onClick={() => navigate('/input')} className="card-gold w-full text-left">
              <p className="text-[12px] font-semibold text-text-primary">내 사주를 등록하면 더 정확해요</p>
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

      {/* 대화권 구매 팝업 */}
      <AnimatePresence>
        {showBuyCredits && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-shrink-0 px-4 pb-2"
          >
            <div className="rounded-2xl p-4" style={{ background: '#FFFCF5', border: '1px solid rgba(201,169,110,0.2)' }}>
              <p className="text-[14px] font-bold text-text-primary">대화권 충전</p>
              <p className="text-[12px] text-text-muted mt-1">1운으로 대화 3회를 추가할 수 있어요</p>
              <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(201,169,110,0.06)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary">현재 잔액</span>
                  <span className="text-[11px] font-bold text-brand-gold">{getBalance()}운</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-text-secondary">차감</span>
                  <span className="text-[11px] font-bold text-func-danger">-1운</span>
                </div>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-border-light">
                  <span className="text-[11px] text-text-secondary">추가 대화</span>
                  <span className="text-[11px] font-bold text-brand-gold">+3회</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => {
                  if (spendBalance(1)) { addChatCredits(3); toast.show('대화권 3회가 추가됐어요!', 'success'); setShowBuyCredits(false); }
                  else { toast.show('잔액이 부족해요', 'warning'); navigate('/charge', { state: { message: '사주대화에 1운이 필요해요' } }); }
                }} className="flex-1 py-3 rounded-xl text-[12px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>1운으로 충전하기</button>
                <button onClick={() => setShowBuyCredits(false)} className="px-4 py-3 rounded-xl text-[12px] text-text-muted bg-bg-surface border border-border-light">취소</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 입력 */}
      {!isCompleted && (
        <div className="flex-shrink-0 px-4 pb-[calc(84px+env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2 rounded-2xl p-2"
            style={{ background: '#FFFFFF', border: '1px solid #E8E0D4', boxShadow: '0 -2px 8px rgba(0,0,0,0.03)' }}>
            <textarea value={inputText} onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); } }}
              placeholder="편하게 물어보세요..." rows={1}
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
