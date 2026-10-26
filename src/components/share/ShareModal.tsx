import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/common/Button';
import { isAppsInToss } from '@/services/payment/iapService';
import { shareResult } from '@/utils/share';
import { withInv } from '@/services/referral/referral';
import { realName } from '@/utils/personName';

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
 * 앱인토스: 토스 공유 링크 + 공유 시트 / 웹: Web Share API, 안 되면 클립보드 복사
 * 2026-10-14 — 공유 보상(1운) 종료. 앱인토스 공유 리워드 서비스가 10-23 종료되고 share() 는 실제 전송을 알려 주지 않는다 (services/share/invite.ts)
 * 2026-10-26 v9 정리
 *   - 미리 보기의 '잠금 풀고 전체 보기' 는 지킬 수 없는 약속이었다(받은 사람은 보낸 사람 풀이를 못 열고 SharePage 초대 화면을 본다).
 *     → 실제로 일어나는 일 한 줄로. 점수 알약 표시도 글자 한 줄로.
 *   - 먹 머리의 작은 글씨 흰색 30%(대비 약 2.7:1) → #CFC6B6. 글자 버튼 높이 약 27px → 44px 이상, 금색 글자 버튼 → 먹.
 *   - 이름은 realName (무료 만세력 프로필 이름 '나' 가 '나 님의 사주'로 나가지 않게).
 *   - 앱 안에서 토스 공유가 실패하면 예전엔 클립보드로 미니앱 주소(친구가 못 여는 주소)를 복사하고 '복사됐어요'라고 했다
 *     → 앱에서는 복사하지 않고 다시 눌러 달라고 알린다. 웹 복사 주소도 공유 시트와 같은 공개 주소(https://saju500.app/share/result/..).
 */
export function ShareModal({ isOpen, onClose, name, reportId, topScore }: ShareModalProps) {
  const [phase, setPhase] = useState<'ready' | 'copied' | 'shared'>('ready');
  const [failed, setFailed] = useState(false);
  const inToss = isAppsInToss();
  const who = realName(name);

  async function handleShare() {
    setFailed(false);
    try {
      const success = await shareResult({ name, reportId, topScore });

      if (success) {
        setPhase('shared');
        return;
      }
    } catch {
      // Web Share API 실패
    }

    // 앱: 토스 공유가 안 열렸으면 복사하지 않는다 (미니앱 주소는 친구가 못 연다)
    if (inToss) {
      setFailed(true);
      return;
    }
    // 웹 폴백 → 클립보드 복사
    await copyToClipboard();
  }

  async function copyToClipboard() {
    // 공유 시트(shareResult)와 같은 공개 주소. 받은 사람은 보낸 사람 풀이가 아니라 초대 화면을 본다 (utils/share.ts getShareCopy)
    const url = withInv(`https://saju500.app/share/result/${reportId}?ref=share`);
    const text = `사주500에서 사주 풀이를 봤어요. 내 사주를 넣으면 같은 풀이를 볼 수 있어요\n${url}`;
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
    setFailed(false);
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
              <div className="px-5 pt-6 pb-5" style={{ background: 'linear-gradient(135deg, #1A1612, #2A231C)' }}>
                <div className="text-center">
                  <p className="text-[13px] mb-1" style={{ color: '#CFC6B6' }}>사주500 분석 결과</p>
                  <p className="text-h1 text-white">{who ? `${who} 님의 사주` : '내 사주'}</p>
                  {topScore && (
                    <p className="mt-3 text-[15px] font-bold" style={{ color: '#E4DCCD' }}>
                      {topScore.label} {topScore.score}점
                    </p>
                  )}
                  {/* 2026-10-26 — 받은 사람에게 실제로 보이는 것 (SharePage 초대 화면) */}
                  <p className="mt-4 text-[14px] leading-relaxed" style={{ color: '#CFC6B6' }}>
                    받은 사람은 자기 사주를 넣고 같은 풀이를 볼 수 있어요
                  </p>
                </div>
              </div>

              {/* 하단 액션 */}
              <div className="px-5 py-5">
                {phase === 'ready' && (
                  <>
                    <Button fullWidth size="lg" variant="gold" onClick={handleShare}>
                      친구에게 공유하기
                    </Button>

                    {failed && (
                      <p className="text-center text-[13px] text-text-secondary mt-3" role="status">
                        공유 창을 열지 못했어요. 잠시 뒤 다시 눌러 주세요
                      </p>
                    )}

                    {/* 웹에서는 복사 버튼도 별도로 */}
                    {!inToss && (
                      <button type="button" onClick={copyToClipboard}
                        className="w-full min-h-[44px] text-center text-[14px] text-text-primary font-semibold mt-2 py-2">
                        링크 복사하기
                      </button>
                    )}

                    <button type="button" onClick={handleClose}
                      className="w-full min-h-[44px] text-center text-[14px] text-text-muted mt-1 py-2">
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
                      style={{ background: 'rgba(26,22,18,0.06)' }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A1612" strokeWidth="2.5" strokeLinecap="round">
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
                      style={{ background: 'rgba(78,122,87,0.1)' }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4E7A57" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </motion.div>
                    <p className="text-h3 text-text-primary">공유했어요</p>
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
