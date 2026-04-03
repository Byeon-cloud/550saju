import type { OhengDistribution, OhengType } from '@/types/saju';
import { OHENG_MAP } from '@/constants/oheng';

interface HealthVisProps {
  elements: OhengDistribution;
}

const HEALTH: { oheng: OhengType; organ: string }[] = [
  { oheng: '목', organ: '간/담/눈/신경' },
  { oheng: '화', organ: '심장/소장/혈액' },
  { oheng: '토', organ: '비장/위/소화' },
  { oheng: '금', organ: '폐/대장/피부' },
  { oheng: '수', organ: '신장/방광/뼈' },
];

function getStatus(count: number): { label: string; color: string; bg: string } {
  if (count === 0) return { label: '부족 — 보완 필요', color: 'var(--oheng-fire)', bg: 'var(--oheng-fire-light)' };
  if (count >= 4) return { label: '과다 — 조절 필요', color: 'var(--oheng-earth)', bg: 'var(--oheng-earth-light)' };
  return { label: '양호', color: 'var(--oheng-wood)', bg: 'var(--oheng-wood-light)' };
}

export function HealthVis({ elements }: HealthVisProps) {
  return (
    <div className="space-y-2">
      {HEALTH.map(({ oheng, organ }) => {
        const count = elements[oheng] || 0;
        const info = OHENG_MAP[oheng];
        const st = getStatus(count);
        return (
          <div key={oheng} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-soft)' }}>
            <span className="text-[14px] font-black" style={{ color: info.color }}>{info.hanja}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold" style={{ color: info.colorDark }}>
                  {info.hanja}{oheng}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {organ}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: st.bg, color: st.color }}>
              {st.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
