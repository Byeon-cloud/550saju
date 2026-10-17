/**
 * 수능 시즌 카드 (2026-10-17) — 2026-11-01 ~ 11-19(2027학년도 수능 날) 홈에 보여 주고 합격이직운으로 잇는다.
 *
 *   나이로 갈라 쓴다. 40~59세는 수험생 부모로 보고 '자녀 사주로 합격운', 17~21세는 수험생 본인으로 보고 '내 합격운'.
 *   그 밖의 나이에는 그리지 않는다. 사실은 계산으로만 쓴다: 수능 날 정유(丁酉)일의 酉 는 일간 丁, 己 의 문창귀인.
 *   검색 페이지 /unse/suneung/ 와 같은 날, 같은 표. QA: 주소에 ?_suneung 을 붙이면 기간이 아니어도 보인다.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GhostButton, SERIF, HJ } from '@/components/hanji/Hanji';
import type { SajuData } from '@/types/saju';

const EXAM = { y: 2026, m: 11, d: 19, key: '2026-11-19', gz: '丁酉', ko: '정유' };
const SHOW_FROM = '2026-11-01';
/** 일간별 문창귀인 지지 */
const MUNCHANG: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };

export function SuneungCard({ sajuData, name, age, today, price, profileId }: {
  sajuData: SajuData | null | undefined; name: string; age: number | null; today: string; price: number; profileId?: string;
}) {
  const navigate = useNavigate();
  const force = typeof window !== 'undefined' && window.location.search.includes('_suneung');
  const inSeason = today >= SHOW_FROM && today <= EXAM.key;
  const who: 'parent' | 'student' | null = age == null ? null : age >= 40 && age <= 59 ? 'parent' : age >= 17 && age <= 21 ? 'student' : null;
  const visible = !!who && (force || inSeason);
  const dLeft = Math.round((Date.UTC(EXAM.y, EXAM.m - 1, EXAM.d) - Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)))) / 86400000);

  useEffect(() => {
    if (!visible) return;
    import('@/services/analytics').then((a) => a.trackEvent('suneung_card_view', { who: who || '' })).catch(() => {});
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !who) return null;
  const dayGan = sajuData?.pillars?.[2]?.천간 || '';
  const munchang = who === 'student' && MUNCHANG[dayGan] === EXAM.gz[1];
  const when = dLeft > 0 ? `수능까지 ${dLeft}일 남았어요` : dLeft === 0 ? '오늘이 수능 날이에요' : '';

  const go = () => {
    import('@/services/analytics').then((a) => a.trackEvent('suneung_card_click', { who })).catch(() => {});
    navigate('/topic/exam?from=suneung', who === 'student' && profileId ? { state: { profileId } } : undefined);
  };

  return (
    <div style={{ padding: '28px 16px 0' }}>
      <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '18px 18px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: HJ.mute }}>{when || '2027학년도 수능'}</p>
        <h2 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1.45, marginTop: 4, color: HJ.ink }}>
          {who === 'parent' ? '수험생 자녀가 있다면 합격운을 미리 봐 두세요' : `${name} 님, 내 사주로 보는 합격운`}
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: HJ.ink2, marginTop: 10 }}>
          {`수능은 11월 19일 목요일 ${EXAM.ko}(${EXAM.gz})일이에요. `}
          {who === 'parent'
            ? '자녀 생일을 넣으면 시험 기운과 합격하기 좋은 때, 면접에 강한 시간까지 자녀 사주로 풀어 드려요.'
            : munchang
              ? `이날은 ${name} 님 사주에서 공부와 시험을 돕는 문창귀인이 드는 날이에요. 시험 기운과 합격하기 좋은 때까지 풀어 드려요.`
              : '내 사주로 시험 기운과 합격하기 좋은 때, 면접에 강한 시간까지 풀어 드려요.'}
        </p>
        <GhostButton style={{ marginTop: 14 }} sub={`${price}운`} onClick={go}>
          {who === 'parent' ? '자녀 사주로 합격운 보기' : '내 합격운 보기'}
        </GhostButton>
      </div>
    </div>
  );
}
