// Tier A — 1운 지급 알림 토스트 (streak 3일 · 초대 · 공유 공통)
// 스펙: 09_이벤트_v4.md §8 · 핸드오버 §1-D-8
// 1.2초 자동 사라짐 + slide-in from top

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TierAToastProps {
  open: boolean;
  message?: string;             // 기본 "운 1 들어왔어요"
  amount?: number;
  onClose: () => void;
  durationMs?: number;          // 기본 1200
}

export function TierAToast({
  open,
  message,
  amount = 1,
  onClose,
  durationMs = 1200,
}: TierAToastProps) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  const label = message ?? `운 ${amount} 들어왔어요`;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="tier-a-toast"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed top-4 inset-x-0 z-[100] flex justify-center px-4 pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-3 rounded-full shadow-lg pointer-events-auto"
            style={{
              background: '#1A1A1A',
              color: '#F8F5EE',  // SSOT paper — D1 fix (2026-04-23)
              border: '1px solid rgba(184,150,90,0.4)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#E8D9B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-[13px] font-semibold">{label}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default TierAToast;
