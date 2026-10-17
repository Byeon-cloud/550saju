/**
 * 생일 달 카드 (2026-10-17, 단골 장치 2번) — 생일이 있는 달 내내 홈에 보여 주고 종합사주 또는 신년운세로 잇는다.
 *
 *   음력 생일은 올해 양력 날짜로 바꿔(koreanLunar.ts) 그 달에 보인다. AI 를 부르지 않는다.
 *   문장은 그 사람 사주의 사실(일주, 지금 대운)만 쓴다. 11월부터 2월까지는 신년운세, 그 밖에는 종합사주로.
 *   QA: 주소에 ?_birthday 를 붙이면 생일 달이 아니어도 보인다.
 */
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GhostButton, SERIF, HJ } from '@/components/hanji/Hanji';
import { krLunarToSolar } from '@/services/saju/koreanLunar';
import type { SajuData } from '@/types/saju';

const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const ko = (g: string) => (g && g.length >= 2 ? `${GAN_KO[g[0]] || ''}${ZHI_KO[g[1]] || ''}` : '');

/** 올해 생일의 양력 월과 일 (음력 생일은 올해 음력 날짜를 양력으로) */
function birthdayThisYear(input: any, year: number): { month: number; day: number; lunar: boolean } | null {
  if (!input?.birthMonth || !input?.birthDay) return null;
  const lunar = input.calendarType === 'lunar' || input.calendarType === 'lunar_leap';
  if (!lunar) return { month: input.birthMonth, day: input.birthDay, lunar: false };
  const s = krLunarToSolar(year, input.birthMonth, input.birthDay, false) || krLunarToSolar(year, input.birthMonth, 29, false);
  return s ? { month: s.month, day: s.day, lunar: true } : null;
}

export function BirthdayMonth({ sajuData, name, premiumPrice, newYearPrice }: {
  sajuData: SajuData | null | undefined; name: string; premiumPrice: number; newYearPrice: number;
}) {
  const navigate = useNavigate();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.getDate();
  const force = typeof window !== 'undefined' && window.location.search.includes('_birthday');
  const bd = useMemo(() => birthdayThisYear((sajuData as any)?.input, year), [sajuData, year]);
  const visible = !!bd && (force || bd.month === month);
  const newYearSeason = month >= 11 || month <= 2;

  useEffect(() => {
    if (!visible) return;
    import('@/services/analytics').then((a) => a.trackEvent('birthday_card_view', { m: month, ny: newYearSeason ? 1 : 0 })).catch(() => {});
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !bd) return null;
  const day = sajuData?.pillars?.[2];
  const ilju = day?.천간 && day?.지지 ? `${day.천간}${day.지지}` : '';
  const dw = sajuData?.currentDaeun;
  const passed = bd.month === month && bd.day < today;
  const title = passed ? `${name} 님, 이번 달 생일을 축하해요` : `${name} 님, ${bd.month}월 ${bd.day}일 생일을 미리 축하해요`;

  return (
    <div style={{ padding: '28px 16px 0' }}>
      <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '18px 18px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: HJ.mute }}>
          생일 달이에요{bd.lunar ? ` (음력 생일, 올해 양력 ${bd.month}월 ${bd.day}일)` : ''}
        </p>
        <h2 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1.45, marginTop: 4, color: HJ.ink }}>{title}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: HJ.ink2, marginTop: 10 }}>
          {ilju ? `${ko(ilju)}(${ilju}) 일주로 태어난 날이에요. ` : ''}
          {dw?.간지 ? `지금은 ${ko(dw.간지)} 대운(${dw.시작나이}~${dw.끝나이}세)을 지나는 중이에요. ` : ''}
          생일 무렵에 지난 1년을 돌아보고 다음 1년을 정해 두면 좋아요.
        </p>
        {newYearSeason ? (
          <GhostButton style={{ marginTop: 14 }} sub={`${newYearPrice}운`}
            onClick={() => {
              import('@/services/analytics').then((a) => a.trackEvent('birthday_card_click', { to: 'tojung' })).catch(() => {});
              navigate('/tojung?from=birthday');
            }}>
            다음 1년, 2027 신년운세로 보기
          </GhostButton>
        ) : (
          <GhostButton style={{ marginTop: 14 }} sub={`${premiumPrice}운`}
            onClick={() => {
              import('@/services/analytics').then((a) => a.trackEvent('birthday_card_click', { to: 'premium' })).catch(() => {});
              navigate('/premium?from=birthday');
            }}>
            내 사주 처음부터 끝까지 보기
          </GhostButton>
        )}
      </div>
    </div>
  );
}
