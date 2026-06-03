/**
 * DailyRewardBadge — 데일리 리워드 배지 (P2-5)
 *
 * 근거: `docs/prd/P2_Path_E_티켓_트래커.md` P2-5 · 인수인계 §7.P2-5
 *
 * 3가지 상태:
 *   1. 미수령           → "오늘의 리워드 / 하루 한 번 0.1운" + [받기] CTA
 *   2. 수령 완료        → "오늘 0.1운 받았어요 · 내일 다시 만나요"
 *   3. 월 한도 초과     → "이번 달 리워드 다 모았어요"
 *
 * 설계 원칙:
 *   - 이모지 절대 금지 (2026-04-22 준기 재확인 · SVG/한자/컬러칩만 허용)
 *   - 한자·이모지 최소 (한자노출_정책.md — 유저 출력물은 한자 금지 기본)
 *   - SSOT 컬러 `--gold #B8965A` 사용
 *   - 접근성: aria-live · 44×44 터치 영역 보장
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  claimDailyReward,
  getDailyRewardState,
  DAILY_REWARD_UN,
} from '@/services/storage/dailyReward';
import { useToast } from '@/components/common/Toast';

interface DailyRewardBadgeProps {
  className?: string;
}

export function DailyRewardBadge({ className = '' }: DailyRewardBadgeProps) {
  const [state, setState] = useState(() => getDailyRewardState());
  const [pressed, setPressed] = useState(false);
  const toast = useToast();

  function handleClaim() {
    if (state.claimedToday || state.monthReachedLimit || pressed) return;
    setPressed(true);
    const ok = claimDailyReward();
    if (ok) {
      toast.show(`+${DAILY_REWARD_UN}운이 지갑에 들어왔어요`, 'success');
      setState(getDailyRewardState());
    } else {
      // 경합/예외
      toast.show('이미 오늘 받으셨어요', 'info');
      setState(getDailyRewardState());
    }
  }

  // 1. 월 한도 초과
  if (state.monthReachedLimit) {
    return (
      <div
        className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${className}`}
        style={{ background: 'rgba(184,150,90,0.08)', border: '1px solid rgba(184,150,90,0.25)' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#B8965A' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-bold text-text-primary">이번 달 리워드 다 모았어요</p>
          <p className="text-caption text-text-muted mt-0.5">다음 달 1일부터 다시 열려요</p>
        </div>
      </div>
    );
  }

  // 2. 수령 완료
  if (state.claimedToday) {
    return (
      <div
        className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${className}`}
        style={{ background: 'rgba(184,150,90,0.08)', border: '1px solid rgba(184,150,90,0.20)' }}
        aria-live="polite"
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#B8965A' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-bold text-text-primary">
            오늘 {DAILY_REWARD_UN}운 받았어요
          </p>
          <p className="text-caption text-text-muted mt-0.5">내일 다시 만나요</p>
        </div>
      </div>
    );
  }

  // 3. 미수령 — 수령 CTA
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={handleClaim}
      aria-label={`데일리 리워드 ${DAILY_REWARD_UN}운 받기`}
      className={`rounded-2xl px-4 py-3 flex items-center gap-3 w-full text-left ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(184,150,90,0.14), rgba(184,150,90,0.06))',
        border: '1px solid rgba(184,150,90,0.35)',
        minHeight: 56,
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#B8965A' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 3v4M8 3v4M2 11h20" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-bold text-text-primary">오늘의 리워드</p>
        <p className="text-caption text-text-muted mt-0.5">
          하루 한 번 {DAILY_REWARD_UN}운 드려요
        </p>
      </div>
      <div
        className="px-3 py-2 rounded-xl text-caption font-bold text-white flex-shrink-0"
        style={{ background: '#B8965A', minWidth: 56, textAlign: 'center' }}
      >
        받기
      </div>
    </motion.button>
  );
}
