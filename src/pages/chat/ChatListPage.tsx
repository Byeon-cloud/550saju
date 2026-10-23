// ChatListPage — #51 Sprint 2 (A 화면 · /chat)
// 스펙: docs/mockups/사주500_UI개편_06_사주대화.md §1·§2·§3
//
// 골격: TopBar 56 → 인사(이름 + 오늘 무료) → TicketBalanceBanner 64 → 대화 목록(없으면 질문 버튼 세 개) → ConvertUnModal
// "+" 버튼 → /chat/new (B 화면)
// 카드 탭 → /chat/:sessionId (C 화면)
// 2026-10-23 1.6.3 P1-10 (점검 문서 5-9) — 무료 첫 질문을 쓰지 않고 나가는 손님:
//   인사는 '서윤 님 사주로 무엇이든 물어보세요. 첫 질문은 오늘 무료예요.', 빈 화면은 나이대별 질문 버튼 세 개(누르면 바로 보낸다),
//   대화권 문구는 '두 번째 질문부터는 1운에 세 번 물을 수 있어요'. 측정: chat_view, chat_starter_click.

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useActiveProfile } from '@/hooks/useHomeData';
import {
  getChatRooms,
  deleteChatRoom,
  createChatRoom,
  setChatRoomProfileId,
  CHATS_CHANGED_EVENT,
  type ChatRoom,
} from '@/services/storage/chatStore';
import { getProfiles } from '@/services/storage/localStore';
import { CREDITS_PER_UN } from '@/services/storage/chatCredit';
import { subscribeFreePass } from '@/services/storage/dailyFreePass';
import { genOfAge } from '@/services/saju/worryTopics';
import { getMyTti } from '@/services/tti/ttiFortune';
import { trackEvent } from '@/services/analytics';
import { kstToday } from '@/utils/kstDate';
import { realName } from '@/utils/personName';
import { HJ, SERIF } from '@/components/hanji/Hanji';
import {
  C,
  ConvertUnModal,
  getTimeGreeting,
  getTotalTickets,
  TaegukAvatar,
  chatStarterQuestions,
  CHAT_PENDING_ASK_KEY,
  type ChatGen,
} from './_shared';

/** 1운으로 묻는 횟수를 우리말로 (3 → '세 번') */
const TIMES_WORD = ['', '한', '두', '세', '네', '다섯', '여섯'];
const perUnTimes = `${TIMES_WORD[CREDITS_PER_UN] || CREDITS_PER_UN} 번`;

export function ChatListPage() {
  usePageTitle('사주대화');
  const navigate = useNavigate();
  const toast = useToast();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [tickets, setTickets] = useState(() => getTotalTickets());
  const [convertOpen, setConvertOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatRoom | null>(null);

  const timeCtx = useMemo(() => getTimeGreeting(), []);

  /* 첫 화면 사람과 나이대 — 홈과 같은 활성 사주(본인 우선). 사주가 없으면 띠 표에서 고른 해 */
  const { profile: active, name: activeName, hasProfile } = useActiveProfile();
  const hasSaju = !!(hasProfile && (active as any)?.sajuData?.pillars?.[2]?.천간);
  const who = realName(activeName);
  const today = kstToday();
  const gen: ChatGen = useMemo(() => {
    const by = hasSaju ? Number((active as any)?.input?.birthYear) || undefined : getMyTti()?.year;
    return genOfAge(by ? Number(today.slice(0, 4)) - by : null) ?? 'young';
  }, [hasSaju, active, today]);
  const starters = useMemo(() => chatStarterQuestions(gen, Number(today.slice(5, 7))), [gen, today]);

  // 첫 화면 진입 한 번 (첫 질문 비율의 분모)
  useEffect(() => {
    let rooms = 0;
    try { rooms = getChatRooms().length; } catch { /* noop */ }
    trackEvent('chat_view', { has: hasSaju ? 1 : 0, rooms: rooms > 0 ? 1 : 0, free: getTotalTickets().free > 0 ? 1 : 0, gen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 질문 버튼 — 사주가 있으면 그 사주로 새 방을 열어 바로 보낸다. 없으면 생일을 넣고 돌아와 보낸다 */
  function ask(i: number) {
    const q = starters[i];
    if (!q) return;
    trackEvent('chat_starter_click', { i, gen, has: hasSaju ? 1 : 0 });
    if (!hasSaju || !active) {
      try { sessionStorage.setItem(CHAT_PENDING_ASK_KEY, JSON.stringify({ q, at: Date.now() })); } catch { /* noop */ }
      navigate('/input?from=chat&new=1');
      return;
    }
    const room = createChatRoom(active.name);
    setChatRoomProfileId(room.id, active.id);
    navigate(`/chat/${room.id}`, { state: { profile: active, autoAsk: q } });
  }

  // 2026-09-17 — 입력 복귀 경로: /input?from=chat 저장 후 /chat?profileId=… 로 오는데 목록이 파라미터를 무시해
  //   방금 등록한 사주로 대화를 시작할 수 없었음 → 그 사주로 새 방을 열어 바로 진입.
  //   2026-10-23 — 사주 없이 질문 버튼을 눌렀다면 그 질문을 바로 보낸다(30분 안에 돌아온 경우만)
  const [searchParams] = useSearchParams();
  const profileStartRef = useRef(false);
  useEffect(() => {
    const pid = searchParams.get('profileId');
    if (!pid || profileStartRef.current) return;
    profileStartRef.current = true;
    const profile = getProfiles().find((p) => p.id === pid);
    if (!profile) return;
    let autoAsk: string | undefined;
    try {
      const raw = sessionStorage.getItem(CHAT_PENDING_ASK_KEY);
      if (raw) {
        sessionStorage.removeItem(CHAT_PENDING_ASK_KEY);
        const p = JSON.parse(raw);
        if (typeof p?.q === 'string' && p.q.trim() && Date.now() - Number(p.at || 0) < 30 * 60 * 1000) autoAsk = p.q.trim();
      }
    } catch { /* noop */ }
    const room = createChatRoom(profile.name);
    setChatRoomProfileId(room.id, profile.id);
    navigate(`/chat/${room.id}`, { replace: true, state: { profile, ...(autoAsk ? { autoAsk } : {}) } });
  }, [searchParams, navigate]);

  function reloadAll() {
    setRooms(getChatRooms());
    setTickets(getTotalTickets());
  }

  useEffect(() => {
    reloadAll();
    // 2026-10-17 — 서버에서 대화가 뒤늦게 내려와도 바로 보이게
    const onChange = () => setRooms(getChatRooms());
    window.addEventListener(CHATS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHATS_CHANGED_EVENT, onChange);
  }, []);

  // 무료권 변화(자정 KST 넘김·앱 복귀·다른 화면 사용) 시 잔여 대화권 배너 재계산
  useEffect(() => subscribeFreePass(() => setTickets(getTotalTickets())), []);

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteChatRoom(pendingDelete.id);
    toast.show('대화가 삭제됐어요', 'info');
    setPendingDelete(null);
    reloadAll();
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.paper,
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
      }}
    >
      {/* §2 TopBar (56) — Header + 우측 "+" 버튼 */}
      <Header
        title="사주대화"
        right={
          <button
            type="button"
            onClick={() => navigate('/chat/new')}
            aria-label="새 대화 시작"
            style={{
              width: 40,
              height: 40,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.ink,
            }}
          >
            <PlusIcon />
          </button>
        }
      />

      {/* §3 인사 헤더 — 2026-10-23 P1-10: 누구 사주로 묻는지와 오늘 무료를 먼저 (예전: '이 늦은 밤, 마음에 무언가 담긴 게 있으시군요') */}
      <FadeIn>
        <div
          style={{
            padding: '16px 20px 12px',
            background: C.paper,
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: C.mute,
              fontWeight: 600,
              margin: 0,
            }}
          >
            {timeCtx.label}
          </p>
          <p
            style={{
              fontFamily: SERIF,
              fontSize: 19,
              fontWeight: 700,
              color: HJ.ink,
              lineHeight: 1.45,
              letterSpacing: '-.02em',
              marginTop: 6,
              wordBreak: 'keep-all',
            }}
          >
            {hasSaju
              ? `${who ? `${who} 님` : '내'} 사주로 무엇이든 물어보세요.`
              : '생일을 넣으면 내 사주로 무엇이든 물어볼 수 있어요.'}
          </p>
          <p style={{ fontSize: 15, color: HJ.ink2, lineHeight: 1.6, marginTop: 4, wordBreak: 'keep-all' }}>
            {tickets.free > 0 ? '첫 질문은 오늘 무료예요.' : '오늘 무료 질문은 이미 썼어요. 내일 다시 무료로 물을 수 있어요.'}
          </p>
        </div>
      </FadeIn>

      {/* §2 TicketBalanceBanner (64) */}
      <FadeIn delay={0.04}>
        <TicketBalanceBanner
          tickets={tickets}
          onCharge={() => setConvertOpen(true)}
        />
      </FadeIn>

      <div
        className="mx-auto"
        style={{ maxWidth: 520, padding: '0 16px' }}
      >
        {/* §3 대화 목록 */}
        {rooms.length === 0 ? (
          <FadeIn delay={0.08}>
            <ListEmpty questions={starters} onAsk={ask} hasSaju={hasSaju} onStart={() => navigate('/chat/new')} />
          </FadeIn>
        ) : (
          <FadeIn delay={0.08}>
            <div
              style={{
                marginTop: 16,
                background: C.surface,
                border: `1px solid ${C.line}`,
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {rooms.map((room, idx) => (
                <SessionCard
                  key={room.id}
                  room={room}
                  isLast={idx === rooms.length - 1}
                  onOpen={() => navigate(`/chat/${room.id}`)}
                  onAskDelete={() => setPendingDelete(room)}
                />
              ))}
            </div>
          </FadeIn>
        )}
      </div>

      {/* 충전 모달 */}
      <ConvertUnModal
        open={convertOpen}
        mode="default"
        onClose={() => setConvertOpen(false)}
        onConverted={reloadAll}
      />

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            key="del-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPendingDelete(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 130,
              background: 'rgba(15,13,10,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 320,
                background: C.paper,
                borderRadius: 20,
                padding: '24px 24px 20px',
                textAlign: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.ink,
                  margin: '0 0 8px',
                }}
              >
                "{pendingDelete.name}" 대화를 삭제할까요?
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: C.inkSoft,
                  lineHeight: 1.55,
                  margin: '0 0 20px',
                }}
              >
                삭제한 대화는 복구할 수 없어요. 사주 정보는 그대로 남아요.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  style={{
                    flex: 1,
                    height: 48,
                    background: C.surface,
                    color: C.inkSoft,
                    border: `1px solid ${C.line}`,
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  style={{
                    flex: 1,
                    height: 48,
                    background: C.danger,
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  삭제하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §2 TicketBalanceBanner (64px)
 * ═════════════════════════════════════════════════════════════════ */
function TicketBalanceBanner({
  tickets,
  onCharge,
}: {
  tickets: { free: number; paid: number; total: number };
  onCharge: () => void;
}) {
  const noTickets = tickets.total <= 0;
  return (
    // 2026-10-23 v9 — 상태 표시는 먹과 종이 (금색은 누르는 주 버튼에만)
    <div
      style={{
        margin: '8px 16px 0',
        minHeight: 64,
        background: noTickets ? C.warnBeige : HJ.card,
        borderRadius: 12,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: `1px solid ${HJ.line}`,
      }}
      role="status"
      aria-live="polite"
    >
      {/* 좌측 아이콘 */}
      <div
        aria-hidden
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 999,
          background: '#FFFFFF',
          border: `1px solid ${HJ.line}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: HJ.ink,
        }}
      >
        <ChatIcon size={16} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {noTickets ? (
          <>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: C.ink,
                margin: 0,
              }}
            >
              대화권이 없어요
            </p>
            <p style={{ fontSize: 13, color: C.mute, margin: '2px 0 0' }}>
              운으로 바꾸면 이어서 질문할 수 있어요
            </p>
          </>
        ) : (
          <>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: C.ink,
                margin: 0,
              }}
            >
              대화권 {tickets.total}개
              {tickets.free > 0 && (
                <span
                  style={{
                    // v9: 보조 글자 13px 이상, 상태 표시는 먹색(금색은 누르는 버튼에만)
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#6F6557',
                    marginLeft: 6,
                  }}
                >
                  무료 {tickets.free}회 포함
                </span>
              )}
            </p>
            <p style={{ fontSize: 13.5, color: HJ.ink2, lineHeight: 1.5, margin: '2px 0 0', wordBreak: 'keep-all' }}>
              두 번째 질문부터는 1운에 {perUnTimes} 물을 수 있어요
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onCharge}
        style={{
          height: noTickets ? 36 : 32,
          padding: noTickets ? '0 14px' : '0 12px',
          background: noTickets ? C.ink : 'transparent',
          color: noTickets ? C.paper : HJ.ink,
          border: noTickets ? 'none' : `1px solid ${HJ.ink}`,
          borderRadius: 8,
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {noTickets ? '운으로 바꾸기' : '충전'}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §3-1 SessionCard (80px)
 * ═════════════════════════════════════════════════════════════════ */
function SessionCard({
  room,
  isLast,
  onOpen,
  onAskDelete,
}: {
  room: ChatRoom;
  isLast: boolean;
  onOpen: () => void;
  onAskDelete: () => void;
}) {
  const updated = new Date(room.updatedAt);
  const dateStr = updated.toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  });
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: C.danger,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 24,
        }}
      >
        <TrashIcon color="#FFFFFF" />
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) onAskDelete();
        }}
        onClick={onOpen}
        style={{
          position: 'relative',
          height: 80,
          background: C.surface,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: isLast ? 'none' : `1px solid ${C.line}`,
          cursor: 'pointer',
          opacity: room.completed ? 0.6 : 1,
        }}
      >
        <TaegukAvatar size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: C.ink,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {room.name}
            </span>
            {room.completed && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.mute,
                  background: C.line,
                  padding: '2px 5px',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                완료
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: C.mute,
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {room.lastMessage || '대화를 시작해보세요'}
          </div>
        </div>
        <span
          style={{
            fontSize: 13,
            color: C.mute,
            flexShrink: 0,
          }}
        >
          {dateStr}
        </span>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §3-2 빈 상태 — 2026-10-23 P1-10: 나이대별 질문 버튼 세 개 (누르면 바로 보낸다)
 *   예전: '아직 대화가 없어요 / 보관된 사주로 질문을 시작해보세요' + 금색 '새 대화 시작하기'
 *   직접 쓰기는 먹 테두리 버튼 (금색은 누르는 주 버튼에만, 여기서는 질문 버튼이 주 행동)
 * ═════════════════════════════════════════════════════════════════ */
function ListEmpty({
  questions,
  onAsk,
  hasSaju,
  onStart,
}: {
  questions: string[];
  onAsk: (i: number) => void;
  hasSaju: boolean;
  onStart: () => void;
}) {
  return (
    <section
      style={{
        marginTop: 16,
        padding: '4px 16px 16px',
        background: HJ.card,
        border: `1px solid ${HJ.line}`,
        borderRadius: 16,
      }}
    >
      <p style={{ fontSize: 13.5, fontWeight: 700, color: HJ.mute, margin: '12px 0 2px' }}>
        {hasSaju ? '질문을 누르면 바로 물어봐요' : '질문을 고르면 생일을 넣은 뒤 바로 물어봐요'}
      </p>
      {questions.map((q, i) => (
        <button
          key={q}
          type="button"
          onClick={() => onAsk(i)}
          className="w-full text-left mo-press"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: 56,
            padding: '14px 0',
            background: 'transparent',
            border: 0,
            borderTop: i ? `1px solid ${HJ.line}` : 0,
            cursor: 'pointer',
          }}
        >
          <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: HJ.ink, lineHeight: 1.5, wordBreak: 'keep-all' }}>{q}</span>
          <span aria-hidden="true" style={{ fontSize: 18, fontWeight: 700, color: HJ.ink, flexShrink: 0 }}>›</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onStart}
        className="mo-press"
        style={{
          width: '100%',
          minHeight: 50,
          marginTop: 6,
          background: 'transparent',
          color: HJ.ink,
          border: `1.5px solid ${HJ.ink}`,
          borderRadius: 12,
          fontSize: 15.5,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        다른 질문 직접 쓰기
      </button>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 아이콘
 * ═════════════════════════════════════════════════════════════════ */
function PlusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ChatIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 01-9 9c-1.5 0-2.9-.4-4.1-1L3 21l1.1-4.1A9 9 0 1121 12z" />
    </svg>
  );
}
function TrashIcon({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}

export default ChatListPage;
