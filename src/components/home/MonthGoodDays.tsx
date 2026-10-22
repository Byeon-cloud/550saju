/**
 * 이번 달 좋은 날 (2026-10-17, 단골 장치 1번) — 매달 1~7일 홈에 내 사주로 고른 이번 달 좋은 날을 보여 주고 월운세로 잇는다.
 *
 *   날짜는 services/saju/monthDayPicks.ts(서버 월운세와 같은 채점)로 고른다 → 월운세 결과의 '좋은 날'과 같다.
 *   AI 를 부르지 않는다. 오늘 이후 날만 최대 3개, 남은 날이 없으면 숨긴다.
 *   QA: 주소에 ?_monthpicks 를 붙이면 8일 이후에도 보인다.
 */
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GhostButton, SERIF, HJ } from '@/components/hanji/Hanji';
import { monthGoodDays } from '@/services/saju/monthDayPicks';
import type { SajuData } from '@/types/saju';

const SHOW_UNTIL_DAY = 7;

export function MonthGoodDays({ sajuData, name, price, profileId, source = 'home', padding = '28px 16px 0' }: {
  sajuData: SajuData | null | undefined; name: string; price: number; profileId?: string; source?: string; padding?: string;
}) {
  const navigate = useNavigate();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.getDate();
  const force = typeof window !== 'undefined' && window.location.search.includes('_monthpicks');
  const days = useMemo(() => monthGoodDays(year, month, sajuData).filter((d) => d.day >= today).slice(0, 3), [year, month, today, sajuData]);
  const visible = (force || today <= SHOW_UNTIL_DAY) && days.length > 0;

  useEffect(() => {
    if (!visible) return;
    import('@/services/analytics').then((a) => a.trackEvent('month_picks_view', { n: days.length, day: today, src: source })).catch(() => {});
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;
  return (
    <div style={{ padding }}>
      <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '18px 18px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: HJ.mute }}>{month}월이 시작됐어요</p>
        <h2 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1.45, marginTop: 4, color: HJ.ink }}>
          {name} 님의 {month}월 좋은 날
        </h2>
        <div style={{ marginTop: 12, borderTop: `1px solid ${HJ.line}` }}>
          {days.map((d) => (
            <div key={d.date} style={{ display: 'flex', gap: 14, padding: '11px 2px', borderBottom: `1px solid ${HJ.line}` }}>
              <span style={{ flexShrink: 0, minWidth: 92, fontSize: 15.5, fontWeight: 700, color: HJ.ink }}>
                {month}월 {d.day}일 {d.week}요일
              </span>
              <span style={{ fontSize: 14.5, lineHeight: 1.6, color: HJ.ink2 }}>{d.reason}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: HJ.mute, marginTop: 10 }}>
          내 사주에 필요한 기운과 그날의 간지를 맞춰 골랐어요. 달력에 적어 두면 좋아요.
        </p>
        <GhostButton style={{ marginTop: 12 }} sub={`${price}운`}
          onClick={() => {
            import('@/services/analytics').then((a) => {
              a.trackEvent('month_picks_click', { day: today, src: source });
              // 2026-10-23 1.6.3 P1-4 — 오늘의 운세 결과의 연결 카드 공통 측정
              if (source === 'daily') a.trackEvent('bridge_click', { from: 'daily', to: 'monthly', pos: 'month_picks' });
            }).catch(() => {});
            navigate(`/monthly?from=${source}_month_picks${profileId ? `&profileId=${encodeURIComponent(profileId)}` : ''}`);
          }}>
          좋은 날에 할 일과 조심할 날까지 보기
        </GhostButton>
      </div>
    </div>
  );
}
