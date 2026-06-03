import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/common/Button';
import { isAppsInToss } from '@/services/payment/iapService';
import {
  canEarnShareReward,
  claimShareReward,
} from '@/services/share/shareReward';
import { shareResult } from '@/utils/share';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  reportId: string;
  topScore?: { label: string; score: number };
}

/**
 * 공유 모달
 *
 * 앱인토스: contactsViral SDK → 공유 리워드 1운 (하루 3회)
 * 웹: Web Share API (카카오/인스타 등) → 리워드 없음
 * 웹 폴백: 클립보드 복사 → 리워드 없음
 */
export function ShareModal({ isOpen, onClose, name, reportId, topScore }: ShareModalProps) {
  const [phase, setPhase] = useState<'ready' | 'copied' | 'shared'>('ready');
  const [rewardAmount, setRewardAmount] = useState(0);
  const inToss = isAppsInToss();

  async function handleShare() {
    try {
      const success = await shareResult({ name, reportId, topScore });

      if (success) {
        // 앱인토스에서만 리워드
        if (inToss && canEarnShareReward()) {
          const earned = claimShareReward();
          setRewardAmount(earned);
          try {
            const { auth } = await import('@/services/auth/firebase');
            if (auth.currentUser) {
              const { getFunctions, httpsCallable } = await import('firebase/functions');
              const { app } = await import('@/services/auth/firebase');
              await httpsCallable(getFunctions(app, 'us-central1'), 'grantShareReward')({});
            }
          } catch { /* 무시 */ }
        }
        setPhase('shared');
        return;
      }
    } catch {
      // Web Share API 실패
    }

    // 웹 폴백 → 클립보드 복사
    await copyToClipboard();
  }

  async function copyToClipboard() {
    const url = `${window.location.origin}/share/${reportId}`;
    const text = `${name}님의 사주 결과 — 사주500\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setPhase('copied');
    } catch {
      // clipboard도 실패하면 강제로 textarea 사용
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setPhase('copied');
    }
  }

  // 모달 닫을 때 상태 초기화
  function handleClose() {
    setPhase('ready');
    setRewardAmount(0);
    onClose();
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            className="relative w-full max-w-[340px]"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="rounded-3xl overflow-hidden"
              style={{ background: 'var(--bg-card)', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

              {/* 프리뷰 카드 */}
              <div className="px-5 pt-6 pb-5" style={{ background: 'linear-gradient(135deg, #1B2A4A, #243656)' }}>
                <div className="text-center">
                  <p className="text-[10px] text-white/30 mb-1">사주500 분석 결과</p>
                  <p className="text-h1 text-white">{name}님의 사주</p>
                  {topScore && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <div className="px-3 py-1 rounded-full" style={{ background: 'rgba(184,150,90,0.15)' }}>
                        <span className="text-caption text-brand-gold-light font-bold">
                          {topScore.label} {topScore.score}점
                        </span>
                      </div>
                    </div>
                  )}
                  {/* P2-1 · 블러 티저 프리뷰 — 자물쇠 + "잠금 해제 → 전체 보기" CTA */}
                  <div className="mt-4 px-4 py-3 rounded-xl relative" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="space-y-1.5" style={{ filter: 'blur(4px)' }}>
                      <div className="h-2.5 w-3/4 mx-auto rounded bg-white/15" />
                      <div className="h-2.5 w-full rounded bg-white/10" />
                      <div className="h-2.5 w-2/3 mx-auto rounded bg-white/12" />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ filter: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8D5A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 018 0v4" />
                      </svg>
                      <p className="text-[10px] font-bold" style={{ color: '#E8D5A8' }}>
                        잠금 해제하고 전체 보기 →
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 하단 액션 */}
              <div className="px-5 py-5">
                {phase === 'ready' && (
                  <>
                    {/* 앱인토스에서만 리워드 안내 */}
                    {inToss && canEarnShareReward() && (
                      <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(184,150,90,0.08)', border: '1px solid rgba(184,150,90,0.12)' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #B8965A, #8C6D3D)' }}>
                          <span className="text-[8px] font-black text-white">運</span>
                        </div>
                        <p className="text-caption text-text-primary">
                          공유하면 <span className="font-bold text-brand-gold">1운</span> 적립!
                        </p>
                      </div>
                    )}

                    <Button fullWidth size="lg" variant="gold" onClick={handleShare}>
                      친구에게 공유하기
                    </Button>

                    {/* 웹에서는 복사 버튼도 별도로 */}
                    {!inToss && (
                      <button onClick={copyToClipboard}
                        className="w-full text-center text-caption text-brand-gold font-semibold mt-3 py-1">
                        링크 복사하기
                      </button>
                    )}

                    <button onClick={handleClose}
                      className="w-full text-center text-caption text-text-muted mt-2 py-1">
                      닫기
                    </button>
                  </>
                )}

                {phase === 'copied' && (
                  <div className="text-center py-2">
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                      style={{ background: 'rgba(184,150,90,0.1)' }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8965A" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </motion.div>
                    <p className="text-h3 text-text-primary">링크가 복사됐어요</p>
                    <p className="text-caption text-text-muted mt-1">카카오톡, 인스타 등에 붙여넣기 하세요</p>
                    <Button fullWidth size="lg" onClick={handleClose} className="mt-4">확인</Button>
                  </div>
                )}

                {phase === 'shared' && (
                  <div className="text-center py-2">
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
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
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-caption text-brand-gold font-bold mt-1"
                      >
                        +{rewardAmount}운 적립되었어요
                      </motion.p>
                    )}
                    <Button fullWidth size="lg" onClick={handleClose} className="mt-4">확인</Button>
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
