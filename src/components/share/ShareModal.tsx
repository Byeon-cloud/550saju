import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/common/Button';
import {
  canEarnShareReward,
  claimShareReward,
  getRemainingShareRewards,
} from '@/services/share/shareReward';
import { shareResult } from '@/utils/share';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  reportId: string;
  /** 점수 요약 (공유 카드에 표시) */
  topScore?: { label: string; score: number };
}

/**
 * 공유 모달 — 리워드 안내 + 공유 채널 선택
 *
 * UX 흐름:
 * 1. 모달 오픈 → 리워드 안내 ("공유하면 1운 적립!")
 * 2. 공유 버튼 클릭 → Web Share API 호출
 * 3. 공유 완료 → 리워드 적립 → 성공 토스트
 */
export function ShareModal({ isOpen, onClose, name, reportId, topScore }: ShareModalProps) {
  const [shared, setShared] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const hasReward = canEarnShareReward();
  const remaining = getRemainingShareRewards();

  async function handleShare() {
    let success = await shareResult({ name, reportId, topScore });

    // 공유 실패 시 클립보드 복사로 폴백
    if (!success) {
      try {
        const url = `${window.location.origin}/share/${reportId}`;
        await navigator.clipboard.writeText(url);
        success = true;
      } catch { /* 무시 */ }
    }

    if (success) {
      if (hasReward) {
        const earned = claimShareReward();
        setRewardAmount(earned);
        try {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const { app } = await import('@/services/auth/firebase');
          const fns = getFunctions(app, 'us-central1');
          await httpsCallable(fns, 'grantShareReward')({});
        } catch (e) {
          console.warn('[ShareReward] 서버 기록 실패:', e);
        }
      }
      setShared(true);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative w-full max-w-[340px]"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="rounded-3xl overflow-hidden"
              style={{ background: 'var(--bg-card)', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

              {/* 상단 — 프리뷰 카드 (네이비 배경) */}
              <div className="px-5 pt-6 pb-5" style={{ background: 'linear-gradient(135deg, #1B2A4A, #243656)' }}>
                <div className="text-center">
                  <p className="text-[10px] text-white/30 mb-1">사주500 분석 결과</p>
                  <p className="text-h1 text-white">{name}님의 사주</p>
                  {topScore && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <div className="px-3 py-1 rounded-full" style={{ background: 'rgba(201,169,110,0.15)' }}>
                        <span className="text-caption text-brand-gold-light font-bold">
                          {topScore.label} {topScore.score}점
                        </span>
                      </div>
                    </div>
                  )}
                  {/* 블러 영역 — 궁금증 유발 */}
                  <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="space-y-1.5" style={{ filter: 'blur(4px)' }}>
                      <div className="h-2.5 w-3/4 mx-auto rounded bg-white/15" />
                      <div className="h-2.5 w-full rounded bg-white/10" />
                      <div className="h-2.5 w-2/3 mx-auto rounded bg-white/12" />
                    </div>
                    <p className="text-[10px] text-white/40 mt-2" style={{ filter: 'none' }}>
                      전체 결과는 사주500에서 확인하세요
                    </p>
                  </div>
                </div>
              </div>

              {/* 하단 — 공유 액션 */}
              <div className="px-5 py-5">
                {!shared ? (
                  <>
                    {/* 리워드 안내 */}
                    {hasReward && (
                      <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.12)' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                          <span className="text-[8px] font-black text-white">運</span>
                        </div>
                        <p className="text-caption text-text-primary">
                          공유하면 <span className="font-bold text-brand-gold">1운</span> 적립!
                          <span className="text-text-hint"> 새 친구에게 공유할 때마다 받아요</span>
                        </p>
                      </div>
                    )}

                    <Button fullWidth size="lg" variant="gold" onClick={handleShare}>
                      친구에게 공유하기
                    </Button>

                    <button onClick={onClose}
                      className="w-full text-center text-caption text-text-muted mt-3 py-1">
                      닫기
                    </button>
                  </>
                ) : (
                  /* 공유 완료 */
                  <div className="text-center py-2">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                      style={{ background: 'rgba(46,125,50,0.1)' }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </motion.div>
                    <p className="text-h3 text-text-primary">공유 완료!</p>
                    {rewardAmount > 0 && (
                      <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-caption text-brand-gold font-bold mt-1"
                      >
                        +{rewardAmount}운 적립되었어요
                      </motion.p>
                    )}
                    <Button fullWidth size="lg" onClick={onClose} className="mt-4">
                      확인
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
