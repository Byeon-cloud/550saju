// Tier B — 7일 완주 토스포인트 100원 풀스크린 모달
// 스펙: 09_이벤트_v4.md §8 · 핸드오버 §1-D-9
// 내용: 네잎클로버 SVG + 한자카드 天乙貴人 + "토스포인트 100원" + 3초 자동 닫기
// 폴백(운 2) 시: 제목 "운 2 지급 (토스포인트는 잠시 후)" · 설명 문구 교체

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type TierBKind = 'tosspoint' | 'un_fallback';

export interface TierBModalProps {
  open: boolean;
  kind: TierBKind;
  onClose: () => void;
  autoCloseMs?: number; // 기본 3000
}

export function TierBModal({ open, kind, onClose, autoCloseMs = 3000 }: TierBModalProps) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [open, autoCloseMs, onClose]);

  const title = kind === 'tosspoint'
    ? '토스포인트 100원 지급'
    : '운 2 지급 (토스포인트는 잠시 후)';
  const sub = kind === 'tosspoint'
    ? '토스 앱에서 확인해주세요'
    : '토스포인트 지급에 일시 문제가 있어 운 2로 먼저 드려요';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="tier-b-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="fixed inset-0 z-[110] flex items-center justify-center px-6"
          style={{ background: 'rgba(15,13,10,0.78)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[340px] rounded-3xl px-7 py-9 text-center"
            style={{
              background: 'linear-gradient(135deg, #FFFEF9 0%, #F5EADB 100%)',
              border: '1px solid rgba(184,150,90,0.35)',
              boxShadow: '0 24px 72px rgba(0,0,0,0.4), 0 0 0 1px rgba(232,217,184,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 네잎클로버 SVG */}
            <div className="flex justify-center">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
                <path
                  d="M32 14 C28 8, 18 8, 18 18 C18 24, 24 26, 32 26 C40 26, 46 24, 46 18 C46 8, 36 8, 32 14 Z"
                  fill="#B8965A" opacity="0.9"
                />
                <path
                  d="M14 32 C8 28, 8 18, 18 18 C24 18, 26 24, 26 32 C26 40, 24 46, 18 46 C8 46, 8 36, 14 32 Z"
                  fill="#B8965A" opacity="0.75"
                />
                <path
                  d="M32 50 C28 56, 18 56, 18 46 C18 40, 24 38, 32 38 C40 38, 46 40, 46 46 C46 56, 36 56, 32 50 Z"
                  fill="#B8965A" opacity="0.75"
                />
                <path
                  d="M50 32 C56 28, 56 18, 46 18 C40 18, 38 24, 38 32 C38 40, 40 46, 46 46 C56 46, 56 36, 50 32 Z"
                  fill="#B8965A" opacity="0.9"
                />
                <circle cx="32" cy="32" r="3" fill="#9A7D47" />
              </svg>
            </div>

            {/* 한자카드 */}
            <div className="mt-4 inline-block px-4 py-1.5 rounded-md"
              style={{
                background: '#1A1A1A', color: '#E8D9B8',
                fontFamily: "'Noto Serif KR', serif", fontWeight: 700,
                letterSpacing: '0.1em', fontSize: 13,
              }}>
              天乙貴人
            </div>

            {kind === 'tosspoint' ? (
              <>
                <div className="mt-5 text-[48px] font-extrabold leading-none"
                  style={{ color: '#1A1A1A', fontFamily: "'Noto Serif KR', serif" }}>
                  100
                </div>
                <div className="mt-1 text-[14px] font-semibold" style={{ color: '#8C6D3D' }}>{/* SSOT gold-deep — D1 fix (2026-04-23) */}
                  원 토스포인트
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 text-[40px] font-extrabold leading-none"
                  style={{ color: '#1A1A1A', fontFamily: "'Noto Serif KR', serif" }}>
                  운 2
                </div>
                <div className="mt-1 text-[13px] font-semibold" style={{ color: '#9A3D1A' }}>
                  임시 폴백 지급
                </div>
              </>
            )}

            <p className="mt-4 text-[13px] font-semibold leading-[1.6]" style={{ color: '#1A1A1A' }}>
              {title}
            </p>
            <p className="mt-1 text-[13.5px] leading-[1.55]" style={{ color: '#6B5F4E' }}>
              {sub}
            </p>

            <button type="button" onClick={onClose}
              className="mt-6 w-full h-[48px] rounded-xl font-semibold text-[14px] transition"
              style={{ background: '#1A1A1A', color: '#F8F5EE' }}>
              확인
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default TierBModal;
