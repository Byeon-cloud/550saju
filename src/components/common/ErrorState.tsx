import { motion } from 'framer-motion';
import type { KeyboardEvent } from 'react';

interface ErrorStateProps {
  title?: string;
  /** v4.1 표준 서브텍스트 */
  subtitle?: string;
  /** 레거시 별칭 — subtitle 과 동일 */
  description?: string;
  /** 재시도 콜백 → cta-gold 버튼 */
  onRetry?: () => void;
  /** 뒤로가기 콜백 → cta-ghost 버튼 (옵션) */
  onBack?: () => void;
  /** 재시도 버튼 문구 */
  retryLabel?: string;
  /** 뒤로가기 버튼 문구 */
  backLabel?: string;
  /**
   * "운은 차감되지 않았습니다" 안내 표시 여부.
   * 유료 엔드포인트 실패 시 true (서버 트랜잭션 롤백 보증).
   */
  showRefundNote?: boolean;
}

/**
 * 에러 화면 공용 컴포넌트 (v4.1 스펙).
 *   근거: docs/prd/오늘의운세_v4_CTA확장.md §10, docs/prd/꿈해몽_v4_재설계.md §10+
 *   - card-navy-v4 금지 → card-primary 중앙 정렬
 *   - 인라인 SVG 알럿 삼각형 — PictogramRegistry 의 ui:alert 와 동일 디자인.
 *     (번들 경량화 위해 Pictogram import 안 함)
 *   - CTA: cta-gold (재시도) + cta-ghost (뒤로가기, 옵션)
 */
export function ErrorState({
  title = '해석을 가져오지 못했어요',
  subtitle,
  description,
  onRetry,
  onBack,
  retryLabel = '다시 시도',
  backLabel = '뒤로가기',
  showRefundNote = true,
}: ErrorStateProps) {
  const sub = subtitle ?? description ?? '잠시 후 다시 시도해주세요';

  function handleKey(
    e: KeyboardEvent<HTMLButtonElement>,
    fn?: () => void,
  ) {
    if ((e.key === 'Enter' || e.key === ' ') && fn) {
      e.preventDefault();
      fn();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-primary"
      style={{
        padding: 32,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <motion.div
        animate={{ x: [0, -3, 3, -3, 3, 0] }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'rgba(184,150,90,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--brand-gold)',
          marginBottom: 2,
        }}
        aria-hidden="true"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3.5 22 20.5H2L12 3.5Z" />
          <line x1="12" y1="10" x2="12" y2="14.5" />
          <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
        </svg>
      </motion.div>

      <h3 className="sec-title-lg">{title}</h3>
      <p className="text-body-md" style={{ color: 'var(--text-secondary)', maxWidth: 320 }}>
        {sub}
      </p>
      {showRefundNote && (
        <p
          className="text-body-sm"
          style={{
            color: 'var(--text-muted)',
            maxWidth: 320,
            marginTop: -4,
          }}
        >
          운은 차감되지 않았습니다.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 12 }}>
        {onRetry && (
          <button
            className="cta-gold"
            onClick={onRetry}
            onKeyDown={(e) => handleKey(e, onRetry)}
            aria-label={retryLabel}
          >
            {retryLabel}
          </button>
        )}
        {onBack && (
          <button
            className="cta-ghost"
            onClick={onBack}
            onKeyDown={(e) => handleKey(e, onBack)}
            aria-label={backLabel}
          >
            {backLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}
