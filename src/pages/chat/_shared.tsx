// chat/_shared.tsx — #51 Sprint 2 공유 토큰/컴포넌트/헬퍼
// 스펙: docs/mockups/사주500_UI개편_06_사주대화.md
// 환율: 1운 = 3대화권 (project_un_conversion_ratios.md SSOT)
// UX 라이팅 (§15): "AI"/모델명 금지 · "사주"/"사주풀이"로 일원화 · 스트리밍 금지

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  spendBalance,
  getBalance,
  addPaidBalance,
} from '@/services/storage/localStore';
import {
  getChatCredits,
  addChatCredits,
  convertChatCreditsToUn,
  CREDITS_PER_UN,
} from '@/services/storage/chatCredit';
import { useToast } from '@/components/common/Toast';
import { hasFreePass } from '@/services/storage/dailyFreePass';

/* ══════════════════════════════════════════════════════════════════
 * SSOT 토큰 (D1 fix)
 * ═════════════════════════════════════════════════════════════════ */
export const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  goldLine: 'rgba(184,150,90,0.40)',
  line: '#E5DFD0',
  surface: '#FFFFFF',
  bubbleBg: '#FFFFFF',
  bubbleUser: '#1A1A1A',
  danger: '#C0392B',
  warnBeige: '#F0ECE1',
} as const;

export const SHARE_MODULE_ID = '0a21ea14-951b-4abb-8484-aaf61b0123b8';

/* ══════════════════════════════════════════════════════════════════
 * 시간대 인사 (보존)
 * ═════════════════════════════════════════════════════════════════ */
export interface TimeGreeting {
  label: string;
  greeting: string;
}

export function getTimeGreeting(): TimeGreeting {
  const h = new Date().getHours();
  if (h < 5)
    return {
      label: '고요한 새벽',
      greeting:
        '이 늦은 밤, 마음에 무언가 담긴 게 있으시군요. 편하게 이야기해주세요.',
    };
  if (h < 7)
    return {
      label: '이른 아침',
      greeting: '이른 아침이네요. 오늘 하루의 기운을 미리 살펴볼까요?',
    };
  if (h < 12)
    return {
      label: '좋은 아침',
      greeting:
        '좋은 아침이에요. 궁금한 점이 있으시면 편하게 물어보세요.',
    };
  if (h < 14)
    return {
      label: '점심시간',
      greeting: '점심시간, 잠깐의 여유를 내셨군요. 편하게 이야기해주세요.',
    };
  if (h < 18)
    return {
      label: '오후의 여유',
      greeting:
        '오후의 여유로운 시간이에요. 궁금한 점이 있으시면 물어보세요.',
    };
  if (h < 21)
    return {
      label: '저녁 시간',
      greeting:
        '하루가 저물어가네요. 오늘 하루를 돌아보며 이야기 나눠볼까요.',
    };
  return {
    label: '고요한 밤',
    greeting:
      '고요한 밤이에요. 밤의 직감은 낮보다 예리하니, 편하게 이야기해주세요.',
  };
}

/* ══════════════════════════════════════════════════════════════════
 * TaegukAvatar — 사주풀이 화자 아바타
 * ═════════════════════════════════════════════════════════════════ */
export function TaegukAvatar({ size = 32 }: { size?: number }) {
  const s = size * 0.5;
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 999,
        background: C.goldSoft,
        border: `1px solid ${C.goldLine}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden
    >
      <svg width={s} height={s} viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="11"
          stroke={C.gold}
          strokeWidth="1"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z"
          fill={C.gold}
          fillOpacity="0.55"
        />
        <circle cx="12" cy="7" r="2" fill={C.gold} />
        <circle
          cx="12"
          cy="17"
          r="2"
          fill={C.gold}
          fillOpacity="0.3"
          stroke={C.gold}
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 총 대화권 (무료 패스 + 결제 크레딧)
 * ═════════════════════════════════════════════════════════════════ */
export function getTotalTickets(): {
  free: number;
  paid: number;
  total: number;
} {
  const free = hasFreePass('chat') ? 1 : 0;
  const paid = getChatCredits();
  return { free, paid, total: free + paid };
}

/* ══════════════════════════════════════════════════════════════════
 * ConvertUnModal — 운 ↔ 대화권 양방향 변환 (스펙 §5)
 *  - default 모드: 슬라이더로 변환량 선택
 *  - quotaExceeded 모드: 자발적 충전 vs 한도 소진 분기 카피 (P2-4 보존)
 *  - 운도 대화권도 0 → 충전/공유 안내
 *  - 역변환(대화권 → 운): 3단위 단위 환원, reward bucket (Sprint 1 #33 보존)
 * ═════════════════════════════════════════════════════════════════ */
export interface ConvertUnModalProps {
  open: boolean;
  /** quota_exceeded: 한도 소진 후 자동 모달 ("오늘 무료 한도 다 썼어요") */
  mode: 'default' | 'quota_exceeded';
  redirectPath?: string; // /charge 이동 시 redirect 파라미터
  onClose: () => void;
  /** 충전 성공 시 호출 (UI 갱신용) */
  onConverted: () => void;
}

export function ConvertUnModal({
  open,
  mode,
  redirectPath,
  onClose,
  onConverted,
}: ConvertUnModalProps) {
  const navigate = useNavigate();
  const toast = useToast();

  const [unBalance, setUnBalance] = useState(() => getBalance());
  const [credits, setCredits] = useState(() => getChatCredits());
  const [amount, setAmount] = useState(1); // 변환할 운

  // open 시마다 잔액 동기화
  useMemo(() => {
    if (open) {
      const ub = getBalance();
      setUnBalance(ub);
      setCredits(getChatCredits());
      setAmount(Math.max(1, Math.min(1, ub)));
    }
  }, [open]);

  const maxConvertible = Math.floor(unBalance);
  const safeAmount = Math.max(1, Math.min(amount, Math.max(1, maxConvertible)));
  const ticketsGain = safeAmount * CREDITS_PER_UN;

  const reverseBlocks = Math.floor(credits / CREDITS_PER_UN);
  const canReverse = reverseBlocks > 0;

  const noBalance = unBalance <= 0 && credits <= 0;

  function handleConvertForward() {
    if (unBalance < safeAmount) {
      toast.show('잔액이 부족해요', 'warning');
      return;
    }
    if (!spendBalance(safeAmount)) {
      toast.show('잔액 차감에 실패했어요', 'warning');
      return;
    }
    // 측정 — 운 차감 성공 직후 (C1 · fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'chat', amount: safeAmount })).catch(() => {});
    // 2026-06-18 머니세이프 — 차감과 대화권 적립을 원자적으로. 적립 실패(용량초과 등) 시 차감한 운 즉시 복구.
    try {
      addChatCredits(ticketsGain);
    } catch {
      addPaidBalance(safeAmount, 0);
      toast.show('전환에 실패해서 운을 돌려드렸어요. 다시 시도해주세요.', 'warning');
      return;
    }
    toast.show(
      `${safeAmount}운을 대화권 ${ticketsGain}개로 바꿨어요`,
      'success',
    );
    onConverted();
    onClose();
  }

  function handleConvertReverse() {
    const result = convertChatCreditsToUn();
    if (result) {
      toast.show(
        `대화권 ${result.credits}개를 ${result.un}운으로 바꿨어요`,
        'success',
      );
      onConverted();
      onClose();
    } else {
      toast.show('환원할 대화권이 부족해요', 'warning');
    }
  }

  function handleGoCharge() {
    const target = redirectPath
      ? `/charge?need=1&redirect=${encodeURIComponent(redirectPath)}`
      : '/charge?need=1';
    onClose();
    navigate(target);
  }

  // 헤더 카피 (P2-4 분기 보존)
  const title =
    mode === 'quota_exceeded'
      ? noBalance
        ? '운도 대화권도 없어요'
        : '오늘 무료 한도를 다 썼어요'
      : noBalance
      ? '대화권을 채워볼까요?'
      : '운을 대화권으로 바꿀까요?';

  const subtitle =
    mode === 'quota_exceeded' && !noBalance
      ? '1운으로 대화 3회를 이어갈 수 있어요. 아니면 내일 다시 만나요.'
      : noBalance
      ? '운을 충전하거나 친구에게 공유하고 받을 수 있어요.'
      : '슬라이더로 변환할 운의 수를 정해주세요.';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(15,13,10,0.6)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            key="panel"
            initial={{ y: 240 }}
            animate={{ y: 0 }}
            exit={{ y: 240 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: C.paper,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: '24px 24px 16px',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                background: C.line,
                margin: '0 auto 18px',
              }}
            />
            <h3
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: C.ink,
                margin: '0 0 6px',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: 13,
                color: C.inkSoft,
                lineHeight: 1.6,
                margin: '0 0 16px',
              }}
            >
              {subtitle}
            </p>

            {/* 잔액 카드 */}
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.line}`,
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 16,
              }}
            >
              <Row label="현재 운" value={`${unBalance}운`} />
              <Row label="현재 대화권" value={`${credits}개`} />
            </div>

            {/* 정방향 변환 (운 → 대화권) */}
            {!noBalance && unBalance > 0 && (
              <>
                <div
                  style={{
                    background: C.goldSoft,
                    borderRadius: 12,
                    padding: '14px 16px',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: C.inkSoft }}>
                      변환할 운
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: C.goldDeep,
                      }}
                    >
                      {safeAmount}운 → {ticketsGain}대화권
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, maxConvertible)}
                    value={safeAmount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    aria-label="변환할 운 수"
                    style={{
                      width: '100%',
                      accentColor: C.gold,
                      cursor: 'pointer',
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      color: C.mute,
                      marginTop: 4,
                    }}
                  >
                    <span>1</span>
                    <span>{Math.max(1, maxConvertible)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleConvertForward}
                  style={{
                    width: '100%',
                    height: 54,
                    // 2026-10-10 v9 — 운을 쓰는 주 버튼은 금색 (한지 GoldCta 와 같은 결)
                    background: 'linear-gradient(180deg, #D2B477 0%, #B8965A 100%)',
                    color: '#17110A',
                    border: 'none',
                    borderRadius: 14,
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: 'pointer',
                    marginBottom: 8,
                    boxShadow: '0 10px 22px rgba(140,109,61,.26), inset 0 1px 0 rgba(255,255,255,.45)',
                  }}
                >
                  {safeAmount}운 → {ticketsGain}대화권 바꾸기
                </button>
              </>
            )}

            {/* 역변환 (대화권 → 운, 3단위) */}
            {canReverse && (
              <button
                type="button"
                onClick={handleConvertReverse}
                style={{
                  width: '100%',
                  height: 44,
                  background: C.goldSoft,
                  color: C.goldDeep,
                  border: `1px solid ${C.goldLine}`,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                대화권 {reverseBlocks * CREDITS_PER_UN}개 → {reverseBlocks}운으로
                되돌리기
              </button>
            )}

            {/* 잔액 0 → 충전 안내 (스펙 §5-2) */}
            {noBalance && (
              <button
                type="button"
                onClick={handleGoCharge}
                style={{
                  width: '100%',
                  height: 52,
                  background: C.ink,
                  color: C.paper,
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                운 충전하기
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                height: 44,
                background: 'transparent',
                color: C.inkSoft,
                border: 'none',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {mode === 'quota_exceeded' && noBalance
                ? '내일 다시 올게요'
                : '취소'}
            </button>

            {/* 환원 정책 미주 — Sprint 1 #33 보존 */}
            {canReverse && (
              <p
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: C.mute,
                  textAlign: 'center',
                  lineHeight: 1.55,
                }}
              >
                환원된 운은 결제 환불 대상이 아니에요 (어뷰징 방지)
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
      }}
    >
      <span style={{ fontSize: 13.5, color: C.inkSoft }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
        {value}
      </span>
    </div>
  );
}
