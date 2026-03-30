import { motion } from 'framer-motion';
import type { Pillar, SipSung, JiJangGan } from '@/types/saju';
import { CHEONGAN_OHENG, JIJI_OHENG, OHENG_MAP } from '@/constants/oheng';

interface PillarCardProps {
  pillar: Pillar;
  index: number;
  isMe?: boolean;
  sipsung?: SipSung[];
  jijanggan?: JiJangGan;
  totalPillars: number;
}

const POS = {
  year: { ko: '년주', hanja: '年柱', desc: '조상·사회' },
  month: { ko: '월주', hanja: '月柱', desc: '부모·직장' },
  day: { ko: '일주', hanja: '日柱', desc: '본인·배우자' },
  time: { ko: '시주', hanja: '時柱', desc: '자녀·노후' },
} as const;

export function PillarCard({ pillar, index, isMe, sipsung, jijanggan, totalPillars }: PillarCardProps) {
  const pos = POS[pillar.position];
  const ganOheng = CHEONGAN_OHENG[pillar.천간];
  const jiOheng = JIJI_OHENG[pillar.지지];
  const ganInfo = ganOheng ? OHENG_MAP[ganOheng] : null;
  const jiInfo = jiOheng ? OHENG_MAP[jiOheng] : null;
  const ganSipsung = sipsung?.find((s) => s.글자 === pillar.천간 && s.position.includes('간'));
  const is4 = totalPillars === 4;
  const hz = is4 ? 'text-[30px]' : 'text-[38px]';

  if (!pillar.available) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1"
      >
        <div className="rounded-[18px] border-2 border-dashed overflow-hidden relative"
          style={{ borderColor: 'var(--border-main)', background: 'var(--bg-surface)', minHeight: 210 }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-warm)' }}>
              <span className="text-lg opacity-50">🕐</span>
            </div>
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-hint)' }}>출생시간</span>
            <span className="text-[10px]" style={{ color: 'var(--text-hint)' }}>미입력</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 relative"
    >
      {isMe && (
        <div className="absolute -top-2.5 inset-x-0 flex justify-center z-10">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--brand-gold), var(--brand-accent))' }}>
            ★ 나
          </span>
        </div>
      )}

      <div className="rounded-[18px] overflow-hidden"
        style={{ boxShadow: isMe ? 'var(--shadow-glow)' : 'var(--shadow-card)', border: isMe ? '1.5px solid var(--border-gold)' : '1px solid var(--border-subtle)' }}>

        {/* 위치 라벨 */}
        <div className="px-2 pt-2.5 pb-1 text-center" style={{ background: 'var(--bg-card-alt)' }}>
          <p className="text-[10px] font-bold tracking-wide" style={{ color: ganInfo?.colorDark || 'var(--text-secondary)' }}>
            {pos.ko} <span className="opacity-60">{pos.hanja}</span>
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-hint)' }}>{pos.desc}</p>
        </div>

        {/* 천간 */}
        <div className="py-3 text-center"
          style={{ background: ganInfo ? `linear-gradient(180deg, ${ganInfo.colorLight}80, ${ganInfo.colorLight}40)` : 'var(--bg-surface)' }}>
          <p className={`${hz} font-black leading-none`} style={{ color: ganInfo?.colorDark }}>
            {pillar.천간}
          </p>
          <p className="text-[11px] font-bold mt-1.5" style={{ color: ganInfo?.color }}>
            {pillar.천간읽기} · {ganOheng}
          </p>
          {ganSipsung && (
            <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-[2px] rounded-full"
              style={{ background: `${ganInfo?.color}15`, color: ganInfo?.colorDark }}>
              {ganSipsung.십성}
            </span>
          )}
        </div>

        {/* 구분선 */}
        <div className="divider-gradient" />

        {/* 지지 */}
        <div className="py-3 text-center"
          style={{ background: jiInfo ? `linear-gradient(180deg, ${jiInfo.colorLight}40, ${jiInfo.colorLight}80)` : 'var(--bg-surface)' }}>
          <p className={`${hz} font-black leading-none`} style={{ color: jiInfo?.colorDark }}>
            {pillar.지지}
          </p>
          <p className="text-[11px] font-bold mt-1.5" style={{ color: jiInfo?.color }}>
            {pillar.지지읽기} · {jiOheng}
          </p>
          {jijanggan && jijanggan.지장간.length > 0 && (
            <div className="flex justify-center gap-1 mt-1.5 flex-wrap px-1">
              {jijanggan.지장간.map((g, i) => {
                const gOheng = CHEONGAN_OHENG[g];
                const gInfo = gOheng ? OHENG_MAP[gOheng] : null;
                return (
                  <span key={i} className="text-[9px] font-bold px-1.5 py-[2px] rounded-full"
                    style={{ background: `${gInfo?.color || jiInfo?.color}15`, color: gInfo?.colorDark || jiInfo?.colorDark }}>
                    {g}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
