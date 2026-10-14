/**
 * 띠별 오늘의 운세 (2026-10-15 · 1.5.6) — 띠를 누르면 바로 읽힌다 (입력 0)
 *   혜택탭으로 들어온 50~60대가 생년월일 입력 앞에서 나가던 문제 → 신문 띠별 운세처럼 한 번 누르면 끝.
 *   내 해를 누르면 표시해 두고(기기에만), 홈은 그 해로 세대를 알아 고민 목록을 맞춘다.
 */
import { useEffect, useRef, useState } from 'react';
import { HJ, SERIF, Seal } from '@/components/hanji/Hanji';
import { trackEvent } from '@/services/analytics';
import {
  TTI, ttiName, ttiYears, yearLabel, fallbackHead, fallbackYearLine, loadTtiDay, getMyTti, setMyTti, type TtiDay,
} from '@/services/tti/ttiFortune';

export function TtiFortune({ today, dayGz, dayKo, src, preselect, onYearPick }: {
  /** YYYY-MM-DD (KST) */
  today: string;
  /** 오늘 일진 한자 두 글자 */
  dayGz: string;
  /** 오늘 일진 한글 (임술) */
  dayKo: string;
  /** 기록용 — 홈 첫 화면(hero) 또는 가족 띠 영역(family) */
  src: 'hero' | 'family';
  /** 처음 열어 둘 띠 (없으면 기기에 기억한 띠) */
  preselect?: string | null;
  onYearPick?: (year: number) => void;
}) {
  const mine = getMyTti();
  const [sel, setSel] = useState<string | null>(preselect ?? (src === 'hero' ? mine?.ji ?? null : null));
  const [myYear, setMyYear] = useState<number | undefined>(mine?.year);
  const [day, setDay] = useState<TtiDay | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadTtiDay(today).then((d) => { if (alive) setDay(d && (!d.dayGz || d.dayGz === dayGz) ? d : null); });
    return () => { alive = false; };
  }, [today, dayGz]);

  const pick = (ji: string) => {
    const next = sel === ji ? null : ji;
    setSel(next);
    if (!next) return;
    trackEvent('tti_open', { tti: ji, src });
    if (src === 'hero') setMyTti(ji, myYear && ttiYears(ji).includes(myYear) ? myYear : undefined);
    // 카드가 화면 아래에 열리면 보이게 (첫 화면에서 띠 표가 화면을 다 쓰는 폰)
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };
  const pickYear = (ji: string, y: number) => {
    const next = myYear === y ? undefined : y;
    setMyYear(next);
    setMyTti(ji, next);
    if (next) { trackEvent('tti_year', { year: next, src }); onYearPick?.(next); }
  };

  const t = sel ? day?.tti?.[sel] : null;
  const head = (t?.head && t.head.trim()) || (sel ? fallbackHead(dayGz, sel) : '');

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {TTI.map(({ ji, name }) => {
          const on = sel === ji;
          return (
            <button key={ji} type="button" onClick={() => pick(ji)} aria-pressed={on}
              style={{
                minHeight: 74, borderRadius: 12, padding: '9px 4px 8px',
                background: on ? HJ.ink : HJ.card, color: on ? '#F1ECE1' : HJ.ink,
                border: `1px solid ${on ? HJ.ink : HJ.line}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
              <span style={{ fontFamily: SERIF, fontSize: name.length > 3 ? 14.5 : 16, fontWeight: 700, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{name}</span>
              {/* 출생 연도 넷을 두 줄에 둘씩 — 칸마다 줄바꿈이 들쭉날쭉하지 않게 */}
              <span style={{ fontSize: 13, lineHeight: 1.35, color: on ? '#CFC6B6' : HJ.mute, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {(() => { const yy = ttiYears(ji).slice(1, 5).map((y) => String(y % 100).padStart(2, '0')); return <>{yy.slice(0, 2).join(' ')}<br />{yy.slice(2).join(' ')}</>; })()}
              </span>
            </button>
          );
        })}
      </div>

      {sel && (
        <div ref={cardRef} style={{ marginTop: 12, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '16px 16px 12px', scrollMarginBottom: 24 }}>
          <div className="flex items-center gap-2.5">
            <Seal size={34} fontSize={18}>{sel}</Seal>
            <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700 }}>{ttiName(sel)} 오늘의 운세</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: HJ.mute }}>{dayKo}일</span>
          </div>
          <p style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 600, lineHeight: 1.65, marginTop: 12, color: HJ.ink }}>{head}</p>
          {src === 'hero' && <p style={{ fontSize: 13, color: HJ.mute, marginTop: 12 }}>태어난 해를 누르면 다음에도 바로 보여 드려요</p>}
          <div style={{ marginTop: 6 }}>
            {ttiYears(sel).map((y, i) => {
              const line = (t?.years?.[String(y)] || '').trim() || fallbackYearLine(dayGz, y);
              // 가족 칸은 읽기만 (일반 줄) — 가족 띠의 해를 눌러 '내 해'가 바뀌면 안 된다
              const on = src === 'hero' && myYear === y;
              const rowStyle = {
                display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 8px', margin: '0 -8px', width: 'calc(100% + 16px)',
                borderTop: i === 0 ? 0 : `1px solid ${HJ.line}`, background: on ? HJ.hanji : 'transparent', borderRadius: on ? 10 : 0,
              } as const;
              const inner = (
                <>
                  <span style={{ width: 58, flexShrink: 0, fontSize: 14.5, fontWeight: 800, color: HJ.ink, lineHeight: 1.6 }}>
                    {yearLabel(y)}
                    {on && <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: HJ.goldText }}>내 해</span>}
                  </span>
                  <span style={{ flex: 1, fontSize: 15, lineHeight: 1.6, color: HJ.ink2 }}>{line}</span>
                </>
              );
              return src === 'hero' ? (
                <button key={y} type="button" onClick={() => pickYear(sel, y)} aria-pressed={on} className="w-full text-left" style={rowStyle}>{inner}</button>
              ) : (
                <div key={y} style={rowStyle}>{inner}</div>
              );
            })}
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: HJ.mute, marginTop: 10 }}>
            양력 2월 4일 무렵(입춘) 전에 태어났다면 앞 해의 띠로 보세요.
          </p>
        </div>
      )}
    </div>
  );
}
