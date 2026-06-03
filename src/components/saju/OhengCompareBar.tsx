import { motion } from 'framer-motion';
import type { OhengType } from '@/types/saju';

interface OhengCompareBarProps {
  /** 주 분포 (필수) — 예: 사주 오행 분포 */
  primary: Record<OhengType, number>;
  /** 보조 분포 (선택) — 있으면 2개 바 겹침 표시 */
  secondary?: Record<OhengType, number>;
  /** 주 라벨 (예: '내 사주') */
  primaryLabel?: string;
  /** 보조 라벨 (예: '꿈') */
  secondaryLabel?: string;
  /** 오늘 강세 오행 (1개 포인트 표시) */
  todayEmphasis?: OhengType;
}

const OHENG_COLORS: Record<OhengType, string> = {
  목: '#2D8A4E',
  화: '#D32F2F',
  토: '#E8B82A',
  금: '#4A4A4A',
  수: '#1565E0',
};

const OHENG_LIST: OhengType[] = ['목', '화', '토', '금', '수'];

/**
 * 오행 가로 바 (.oheng-row) — 5줄.
 * - primary 만: 단일 바.
 * - primary + secondary: 2개 바 중첩 (사주 vs 꿈 비교).
 * - todayEmphasis: 해당 오행에 골드 테두리 하이라이트.
 * 진입 시 좌→우 0.7s 애니메이션.
 */
export function OhengCompareBar({
  primary,
  secondary,
  primaryLabel = '내 사주',
  secondaryLabel = '꿈',
  todayEmphasis,
}: OhengCompareBarProps) {
  const primaryMax = Math.max(...Object.values(primary), 1);
  const secondaryMax = secondary ? Math.max(...Object.values(secondary), 1) : primaryMax;
  const globalMax = Math.max(primaryMax, secondaryMax);

  return (
    <div>
      {secondary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: 'var(--brand-gold)', borderRadius: 2 }} />
            <span style={{ color: 'var(--text-muted)' }}>{primaryLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: 'var(--brand-navy)', borderRadius: 2 }} />
            <span style={{ color: 'var(--text-muted)' }}>{secondaryLabel}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OHENG_LIST.map((oh) => {
          const pVal = primary[oh] ?? 0;
          const sVal = secondary?.[oh] ?? 0;
          const pct = Math.round((pVal / globalMax) * 100);
          const sPct = Math.round((sVal / globalMax) * 100);
          const emphasized = todayEmphasis === oh;
          return (
            <div
              key={oh}
              className="oheng-row"
              style={{
                padding: emphasized ? '4px 6px' : 0,
                borderRadius: 8,
                background: emphasized ? `${OHENG_COLORS[oh]}10` : 'transparent',
                border: emphasized ? `1px solid ${OHENG_COLORS[oh]}55` : 'none',
              }}
            >
              <div className="oheng-row-label" style={{ color: OHENG_COLORS[oh] }}>
                {oh}
                {emphasized && (
                  <span
                    style={{
                      fontSize: 9,
                      marginLeft: 4,
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: OHENG_COLORS[oh],
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    오늘
                  </span>
                )}
              </div>
              <div className="oheng-row-track" style={{ position: 'relative' }}>
                <motion.div
                  className="oheng-row-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    background: secondary ? 'var(--brand-gold)' : OHENG_COLORS[oh],
                    opacity: secondary ? 0.85 : 1,
                  }}
                />
                {secondary && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${sPct}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      height: 4,
                      background: 'var(--brand-navy)',
                      borderRadius: 2,
                      transform: 'translateY(-50%)',
                    }}
                  />
                )}
              </div>
              <div className="oheng-row-value">
                {secondary ? `${pVal}/${sVal}` : pVal}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
