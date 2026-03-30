import type { JiJangGan } from '@/types/saju';
import { CHEONGAN_OHENG, CHEONGAN_KO, OHENG_MAP } from '@/constants/oheng';

interface JijangganVisProps {
  jijangganList: JiJangGan[];
  labels: string[];
}

/** 지장간 시각화 — 각 지지 안에 숨어있는 천간들을 보여줌 */
export function JijangganVis({ jijangganList, labels }: JijangganVisProps) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${jijangganList.length}, 1fr)` }}>
      {jijangganList.map((jj, idx) => (
        <div key={idx} className="rounded-brand-md overflow-hidden"
          style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-soft)' }}>
          {/* 지지 라벨 */}
          <div className="text-center py-1.5"
            style={{ background: 'var(--bg-surface)' }}>
            <p className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
              {labels[idx]}
            </p>
            <p className="text-[14px] font-black" style={{ color: 'var(--text-primary)' }}>
              {jj.지지}
            </p>
          </div>
          {/* 지장간 목록 */}
          <div className="flex flex-col gap-1 p-2">
            {jj.지장간.map((g, i) => {
              const oheng = CHEONGAN_OHENG[g];
              const info = oheng ? OHENG_MAP[oheng] : null;
              const ko = CHEONGAN_KO[g] || g;
              return (
                <div key={i} className="flex items-center justify-between px-2 py-1 rounded-md"
                  style={{ background: info ? `${info.colorLight}80` : 'var(--bg-surface)' }}>
                  <span className="text-[13px] font-black" style={{ color: info?.colorDark }}>
                    {g}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: info?.color || 'var(--text-muted)' }}>
                    {ko}·{oheng || ''}
                  </span>
                </div>
              );
            })}
            {jj.지장간.length === 0 && (
              <p className="text-[10px] text-center py-2" style={{ color: 'var(--text-hint)' }}>—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
