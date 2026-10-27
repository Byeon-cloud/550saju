/**
 * 첫 화면 시안 (2026-10-27, 오너 확인 전 · dev 전용 ?hero2) — 사주를 넣은 손님에게 그림 위에 내 여덟 글자를 오행 색 칸으로.
 *   지인 VOC '초반에 시각적으로 잡아끄는 게 필요하다'. 칸 색은 SajuMiniCard OHENG_BOX 와 같다.
 */
import type { SajuData, OhengType } from '@/types/saju';
import { HJ } from '@/components/hanji/Hanji';
import { moVars } from '@/components/motion/Motion';

const SERIF = "'Noto Serif KR', 'Apple SD Gothic Neo', serif";
const BOX: Record<OhengType, { bg: string; fg: string; line: string }> = {
  목: { bg: '#4E7A57', fg: '#FFFFFF', line: '#4E7A57' },
  화: { bg: '#B04A38', fg: '#FFFFFF', line: '#B04A38' },
  토: { bg: '#B07F38', fg: '#FFFFFF', line: '#B07F38' },
  금: { bg: '#FFFFFF', fg: '#1A1612', line: '#9C9488' },
  수: { bg: '#1A1612', fg: '#FFFFFF', line: '#1A1612' },
};
const ORDER: Array<{ pos: 'time' | 'day' | 'month' | 'year'; label: string }> = [
  { pos: 'time', label: '시' }, { pos: 'day', label: '일' }, { pos: 'month', label: '월' }, { pos: 'year', label: '년' },
];

export function HeroPillars({ sajuData, name }: { sajuData: SajuData; name: string }) {
  const by = new Map(sajuData.pillars.map((p) => [p.position, p]));
  const day = by.get('day');
  return (
    <div style={{ background: 'rgba(255,253,248,.9)', border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '12px 12px 10px', boxShadow: '0 6px 18px rgba(26,22,18,.12)' }}>
      <div className="flex items-baseline justify-between" style={{ padding: '0 4px 8px' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: HJ.ink }}>{name} 님의 여덟 글자</span>
        {day && <span style={{ fontSize: 13, color: HJ.mute }}>{day.천간}{day.지지}일에 태어났어요</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {ORDER.map((o, i) => {
          const p = by.get(o.pos);
          const isDay = o.pos === 'day';
          if (!p || !p.available) {
            return (
              <div key={o.pos} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: HJ.mute, fontWeight: 700 }}>{o.label}</span>
                <span style={{ width: '100%', height: 104, borderRadius: 10, border: `1.5px dashed ${HJ.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: HJ.mute, textAlign: 'center', lineHeight: 1.4 }}>시간<br />모름</span>
              </div>
            );
          }
          const g = BOX[p.천간오행];
          const j = BOX[p.지지오행];
          return (
            <div key={o.pos} className="mo-rise" style={{ ...moVars({ i }), display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: isDay ? HJ.ink : HJ.mute, fontWeight: 800 }}>{isDay ? '일 (나)' : o.label}</span>
              <span style={{ width: '100%', height: 50, borderRadius: 10, background: g.bg, color: g.fg, boxShadow: `inset 0 0 0 1px ${g.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 26, fontWeight: 900, outline: isDay ? `2px solid ${HJ.ink}` : undefined, outlineOffset: 2 }}>
                {p.천간}
              </span>
              <span style={{ width: '100%', height: 50, borderRadius: 10, background: j.bg, color: j.fg, boxShadow: `inset 0 0 0 1px ${j.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 26, fontWeight: 900 }}>
                {p.지지}
              </span>
              <span style={{ fontSize: 13, color: HJ.ink2 }}>{p.천간읽기}{p.지지읽기}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
