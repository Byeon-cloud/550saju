import type { DaeUn } from '@/types/saju';
import { CHEONGAN_OHENG, OHENG_MAP } from '@/constants/oheng';

interface DaeunTimelineProps { daeunList: DaeUn[] }

export function DaeunTimeline({ daeunList }: DaeunTimelineProps) {
  return (
    <div className="space-y-0">
      {daeunList.map((d, i) => {
        const oheng = CHEONGAN_OHENG[d.천간];
        const info = oheng ? OHENG_MAP[oheng] : null;
        return (
          <div key={i} className="flex items-stretch">
            <div className="flex flex-col items-center w-7 shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full mt-1 transition-all ${
                d.isCurrent
                  ? 'ring-4 ring-brand-accent/20'
                  : ''
              }`} style={{
                background: d.isCurrent
                  ? 'linear-gradient(135deg, var(--brand-gold), var(--brand-accent))'
                  : 'var(--border-main)',
              }} />
              {i < daeunList.length - 1 && (
                <div className="w-px flex-1" style={{ background: 'var(--border-subtle)' }} />
              )}
            </div>
            <div className={`flex-1 pb-3 pl-1.5 ${d.isCurrent ? '' : 'opacity-60'}`}>
              <div className={`rounded-xl px-3 py-2.5 ${
                d.isCurrent ? 'card-gold' : ''
              }`} style={d.isCurrent ? {} : { background: 'var(--bg-card)', boxShadow: 'var(--shadow-soft)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[17px] font-black" style={{ color: info?.colorDark || 'var(--text-primary)' }}>
                      {d.간지}
                    </span>
                    {d.isCurrent && (
                      <span className="badge badge-gold text-[9px]">현재 대운</span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {d.시작나이}~{d.끝나이}세
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
