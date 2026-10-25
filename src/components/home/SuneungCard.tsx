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
import { getProfiles } from '@/services/storage/localStore';
import type { SajuData } from '@/types/saju';

const EXAM = { y: 2026, m: 11, d: 19, key: '2026-11-19', gz: '丁酉', ko: '정유' };
const SHOW_FROM = '2026-11-01';
/** 일간별 문창귀인 지지 */
const MUNCHANG: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };

/** 2026-10-26 — 이미 넣어 둔 수험생 나이(16~22세) 자녀 사주. 본인 사주는 빼고, 여럿이면 가장 최근에 넣은 사주 */
function findExamChild(thisYear: number, ownId?: string): { id: string } | null {
  try {
    const at = (v: string | number | undefined) => (typeof v === 'number' ? v : Date.parse(String(v || '')) || 0);
    const kids = getProfiles().filter((p) => {
      if (!p?.id || p.relation === '본인' || (ownId && p.id === ownId)) return false;
      const by = Number(p.input?.birthYear) || 0;
      const age = thisYear - by;
      return by > 0 && age >= 16 && age <= 22;
    });
    kids.sort((a, b) => at(b.createdAt) - at(a.createdAt));
    return kids[0] || null;
  } catch { return null; }
}

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
    // 2026-10-25 — 부모는 자녀 사주부터 넣게 한다. 예전엔 바로 주제운으로 가서, 프로필이 본인 하나면 부모 사주가 자동으로 골라진 채
    //   '합격이직운 분석하기 5운'이 떠 부모가 자기 합격운을 살 수 있었다. 저장 뒤 그 자녀가 골라진 채로 돌아온다 (InputPage returnTo).
    if (who === 'parent') {
      // 2026-10-26 — 자녀 사주(16~22세)를 이미 넣어 뒀으면 그 사주가 골라진 채로 바로 간다. 없을 때만 입력 화면으로
      const child = findExamChild(Number(today.slice(0, 4)) || new Date().getFullYear(), profileId);
      if (child) {
        navigate('/topic/exam?from=suneung', { state: { profileId: child.id } });
        return;
      }
      navigate('/input?new=1', { state: { returnTo: '/topic/exam?from=suneung', relation: '가족', hint: '합격운을 볼 자녀의 사주 정보를 넣어 주세요' } });
      return;
    }
    navigate('/topic/exam?from=suneung', profileId ? { state: { profileId } } : undefined);
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
