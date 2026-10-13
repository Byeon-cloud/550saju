// ChatListPage — #51 Sprint 2 (A 화면 · /chat)
// 스펙: docs/mockups/사주500_UI개편_06_사주대화.md §1·§2·§3
//
// 골격: TopBar 56 → TicketBalanceBanner 64 → 대화 목록 → ConvertUnModal
// "+" 버튼 → /chat/new (B 화면)
// 카드 탭 → /chat/:sessionId (C 화면)

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  getChatRooms,
  deleteChatRoom,
  createChatRoom,
  setChatRoomProfileId,
  type ChatRoom,
} from '@/services/storage/chatStore';
import { getProfiles } from '@/services/storage/localStore';
import { CREDITS_PER_UN } from '@/services/storage/chatCredit';
import { subscribeFreePass } from '@/services/storage/dailyFreePass';
import {
  C,
  ConvertUnModal,
  getTimeGreeting,
  getTotalTickets,
  TaegukAvatar,
} from './_shared';

export function ChatListPage() {
  usePageTitle('사주대화');
  const navigate = useNavigate();
  const toast = useToast();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [tickets, setTickets] = useState(() => getTotalTickets());
  const [convertOpen, setConvertOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatRoom | null>(null);

  const timeCtx = useMemo(() => getTimeGreeting(), []);

  // 2026-09-17 — 입력 복귀 경로: /input?from=chat 저장 후 /chat?profileId=… 로 오는데 목록이 파라미터를 무시해
  //   방금 등록한 사주로 대화를 시작할 수 없었음 → 그 사주로 새 방을 열어 바로 진입.
  const [searchParams] = useSearchParams();
  const profileStartRef = useRef(false);
  useEffect(() => {
    const pid = searchParams.get('profileId');
    if (!pid || profileStartRef.current) return;
    profileStartRef.current = true;
    const profile = getProfiles().find((p) => p.id === pid);
    if (!profile) return;
    const room = createChatRoom(profile.name);
    setChatRoomProfileId(room.id, profile.id);
    navigate(`/chat/${room.id}`, { replace: true, state: { profile } });
  }, [searchParams, navigate]);

  function reloadAll() {
    setRooms(getChatRooms());
    setTickets(getTotalTickets());
  }

  useEffect(() => {
    reloadAll();
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

      {/* §3 인사 헤더 — 시간대 인사 (몰입 톤) */}
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
              letterSpacing: '0.04em',
            }}
          >
            {timeCtx.label}
          </p>
          <p
            style={{
              fontSize: 13.5,
              color: C.inkSoft,
              lineHeight: 1.55,
              marginTop: 6,
            }}
          >
            {timeCtx.greeting}
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
            <ListEmpty onStart={() => navigate('/chat/new')} />
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
                삭제한 대화는 복구할 수 없어요. 사주 정보는 그대로 유지됩니다.
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
    <div
      style={{
        margin: '8px 16px 0',
        height: 64,
        background: noTickets ? C.warnBeige : C.goldSoft,
        borderRadius: 12,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: `1px solid ${noTickets ? C.line : C.goldLine}`,
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
          background: noTickets ? '#FFFFFF' : C.goldSoft,
          border: `1px solid ${noTickets ? C.line : C.goldLine}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.goldDeep,
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
            <p style={{ fontSize: 13, color: C.inkSoft, margin: '2px 0 0' }}>
              1운 → {CREDITS_PER_UN}대화권으로 바꿀 수 있어요
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
          color: noTickets ? C.paper : C.goldDeep,
          border: noTickets ? 'none' : `1px solid ${C.goldLine}`,
          borderRadius: 999,
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
 * §3-2 빈 상태
 * ═════════════════════════════════════════════════════════════════ */
function ListEmpty({ onStart }: { onStart: () => void }) {
  return (
    <div
      style={{
        marginTop: 24,
        textAlign: 'center',
        padding: '48px 24px',
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          margin: '0 auto 14px',
          background: C.goldSoft,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.goldDeep,
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        言
      </div>
      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: C.ink,
          margin: '0 0 6px',
        }}
      >
        아직 대화가 없어요
      </p>
      <p
        style={{
          fontSize: 13,
          color: C.inkSoft,
          lineHeight: 1.55,
          margin: '0 0 18px',
        }}
      >
        보관된 사주로 질문을 시작해보세요
      </p>
      <button
        type="button"
        onClick={onStart}
        style={{
          minWidth: 200,
          height: 52,
          background: 'linear-gradient(180deg, #D2B477 0%, #B8965A 100%)',
          color: '#17110A',
          border: 'none',
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 800,
          boxShadow: '0 8px 18px rgba(140,109,61,.22)',
          cursor: 'pointer',
        }}
      >
        새 대화 시작하기
      </button>
    </div>
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
