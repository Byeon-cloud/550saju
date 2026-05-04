// ChatNewPage — #51 Sprint 2 (B 화면 · /chat/new)
// 스펙: docs/mockups/사주500_UI개편_06_사주대화.md §4
//
// 골격: TopBar 56 ← → ProfileSelector 리스트 → "+ 새 사주 추가" CTA
// 프로필 탭 → createChatRoom + navigate(/chat/:newId, { state: { profile } })

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  getProfiles,
  type SajuProfile,
} from '@/services/storage/localStore';
import {
  createChatRoom,
} from '@/services/storage/chatStore';
import { CHEONGAN_OHENG, OHENG_MAP } from '@/constants/oheng';
import { C } from './_shared';

export function ChatNewPage() {
  usePageTitle('대화할 사주 선택');
  const navigate = useNavigate();
  const profiles = useMemo(() => getProfiles(), []);

  function startWith(profile: SajuProfile) {
    const room = createChatRoom(profile.name);
    navigate(`/chat/${room.id}`, { state: { profile } });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.paper,
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
      }}
    >
      <Header title="사주 선택" />

      <div
        className="mx-auto"
        style={{ maxWidth: 520, padding: '20px 16px 0' }}
      >
        {profiles.length === 0 ? (
          <FadeIn>
            <ProfileEmpty
              onAdd={() =>
                navigate('/input?from=chat&new=1', { replace: false })
              }
            />
          </FadeIn>
        ) : (
          <>
            <FadeIn>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.ink,
                  margin: '4px 0 14px',
                  letterSpacing: '-0.01em',
                }}
              >
                누구의 사주로 대화할까요?
              </h2>
              <p
                style={{
                  fontSize: 12,
                  color: C.inkSoft,
                  margin: '0 0 14px',
                }}
              >
                선택한 사주 데이터를 기반으로 풀이해드릴게요
              </p>
            </FadeIn>

            <FadeIn delay={0.04}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
                role="list"
              >
                {profiles.map((p) => (
                  <ProfileRow
                    key={p.id}
                    profile={p}
                    onSelect={() => startWith(p)}
                  />
                ))}
              </div>
            </FadeIn>
          </>
        )}
      </div>

      {/* 하단 fixed: + 새 사주 추가 (스펙 §4-2) */}
      {profiles.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: C.paper,
            borderTop: `1px solid ${C.line}`,
            padding: '14px 16px',
            paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
            zIndex: 50,
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/input?from=chat&new=1')}
            style={{
              width: '100%',
              maxWidth: 520,
              margin: '0 auto',
              display: 'block',
              height: 52,
              background: C.surface,
              color: C.goldDeep,
              border: `1px solid ${C.goldLine}`,
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + 새 사주 추가
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ProfileRow
 * ═════════════════════════════════════════════════════════════════ */
function ProfileRow({
  profile,
  onSelect,
}: {
  profile: SajuProfile;
  onSelect: () => void;
}) {
  const ilgan = profile.sajuData?.pillars?.[2]?.천간 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
  const ohengColor = (oheng && OHENG_MAP[oheng]?.color) || C.goldDeep;
  const ohengHanja = (oheng && OHENG_MAP[oheng]?.hanja) || ' ';
  const relation = profile.relation || '본인';
  const isMe = relation === '본인' || relation === 'self';
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      role="listitem"
      style={{
        width: '100%',
        background: C.surface,
        border: `1px solid ${isMe ? C.gold : C.line}`,
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: 999,
          background: `${ohengColor}22`,
          border: `1px solid ${ohengColor}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontWeight: 700,
          color: ohengColor,
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        {ohengHanja}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginBottom: 2,
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
            {profile.name}
          </span>
          {isMe ? (
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 800,
                background: C.ink,
                color: C.paper,
              }}
            >
              나
            </span>
          ) : (
            <span style={{ fontSize: 11, color: C.mute }}>{relation}</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: C.mute, lineHeight: 1.45 }}>
          {profile.input.birthYear}.
          {String(profile.input.birthMonth).padStart(2, '0')}.
          {String(profile.input.birthDay).padStart(2, '0')}
          {ilgan && ` · 일간 ${ilgan}(${oheng})`}
        </div>
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={C.mute}
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 빈 상태 — 프로필 0개 (스펙 §4-3)
 * ═════════════════════════════════════════════════════════════════ */
function ProfileEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '64px 20px 40px',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 72,
          height: 72,
          margin: '0 auto 16px',
          background: C.goldSoft,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.goldDeep,
          fontSize: 32,
          fontWeight: 700,
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        命
      </div>
      <p
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: C.ink,
          margin: '0 0 6px',
        }}
      >
        사주를 먼저 등록해주세요
      </p>
      <p
        style={{
          fontSize: 13,
          color: C.inkSoft,
          lineHeight: 1.55,
          margin: '0 0 24px',
        }}
      >
        사주팔자 정보가 있어야 개인화된 풀이가 가능해요
      </p>
      <button
        type="button"
        onClick={onAdd}
        style={{
          minWidth: 240,
          height: 52,
          background: C.ink,
          color: C.paper,
          border: 'none',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        사주팔자 입력하기
      </button>
    </div>
  );
}

export default ChatNewPage;
