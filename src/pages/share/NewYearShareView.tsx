/**
 * 받은 신년운세 미리 보기 (2026-10-18) — /share/newyear/{id}
 *
 *   보낸 사람이 '이 미리 보기 보내기'로 서버에 남긴 표(그 해 판정, 좋은 달, 조심할 달, 꼭 기억할 날 첫 날)를
 *   보낸 사람 화면의 미리 보기 카드와 같은 문장으로 보여 주고, 받는 사람을 '내 새해도 무료로 미리 보기'로 잇는다.
 *   웹에서는 띠별 신년운세 검색 페이지(/unse/{연도}/)도 잇는다(앱 번들에는 그 정적 페이지가 없다).
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { GoldCta, GhostButton, INK_HERO_BG, SERIF, HJ } from '@/components/hanji/Hanji';
import { isAppsInToss } from '@/services/payment/iapService';
import { isAppintosBuild } from '@/lib/env';
import { ROLE_PLAIN, yearSentence, months, topic } from '@/components/newyear/NewYearPreviewCard';
import { ganziKo } from '@/services/saju/newYearPreview';
import type { NewYearShareDoc } from '@/services/share/newYearShare';
import { realName } from '@/utils/personName';

export function NewYearShareView({ data }: { data: NewYearShareDoc }) {
  const navigate = useNavigate();
  const inToss = isAppintosBuild || isAppsInToss();
  useEffect(() => {
    import('@/services/analytics').then((a) => a.trackEvent('share_view', { type: 'newyear' })).catch(() => {});
  }, []);
  const utm = (c: string) => `utm_source=share&utm_medium=newyear&utm_campaign=${c}`;
  // 2026-10-26 — 보낸 사람 이름은 realName 을 거친다. 무료 만세력 프로필 이름 '나' 와 이름이 없을 때 서버가 넣던 '보낸 분' 이
  //   그대로 '나 님의 2027년', '보낸 분 님에게' 로 나갔다. 부를 이름이 없으면 '님' 없이 쓴다.
  const nm = realName(data.name === '보낸 분' ? '' : data.name);

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', gap: 14, padding: '12px 2px', borderBottom: `1px solid ${HJ.line}` }}>
      <span style={{ flexShrink: 0, minWidth: 96, fontSize: 15, fontWeight: 700, color: HJ.ink }}>{label}</span>
      <span style={{ fontSize: 15.5, lineHeight: 1.6, color: HJ.ink2 }}>{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: HJ.paper }}>
      <div className="h-safe-top" />
      <div style={{ background: INK_HERO_BG, color: '#F4EFE4', padding: '30px 20px 26px' }}>
        <p style={{ fontSize: 14, color: '#CFC6B6', fontWeight: 700 }}>받은 신년운세 미리 보기</p>
        <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, lineHeight: 1.4, margin: '8px 0 0', wordBreak: 'keep-all' }}>
          {nm ? `${nm} 님의 ` : ''}{data.y} {ganziKo(data.gz)}({data.gz})년
        </h1>
      </div>

      <div className="px-5 pt-5 pb-10 space-y-5">
        <FadeIn>
          <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '18px 18px 14px' }}>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, color: HJ.ink2 }}>
              {data.y}년은 {nm ? `${nm} 님에게` : '보낸 사람에게'} {yearSentence(data.verdict)}
            </p>
            {data.g && data.b && ROLE_PLAIN[data.r1] && ROLE_PLAIN[data.r2] && (
              <p style={{ fontSize: 13.5, lineHeight: 1.7, color: HJ.mute, marginTop: 6 }}>
                {data.gz[0]}({data.g}){topic(data.g)} {ROLE_PLAIN[data.r1]}이고, {data.gz[1]}({data.b}){topic(data.b)} {ROLE_PLAIN[data.r2]}이에요.
              </p>
            )}
            <div style={{ marginTop: 12, borderTop: `1px solid ${HJ.line}` }}>
              {data.good.length > 0 && <Row label={data.goodLabel === '도움 기운이 들어오는 달' ? '도움이 오는 달' : '좋은 달'} value={months(data.good)} />}
              <Row label="조심할 달" value={data.hard.length ? months(data.hard) : '크게 조심할 달은 없어요'} />
              {data.km > 0 && data.kd > 0 && <Row label="꼭 기억할 날" value={`${data.km}월 ${data.kd}일${data.kn > 1 ? ` 외 ${data.kn - 1}일` : ''}`} />}
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: HJ.mute, marginTop: 10 }}>
              {nm ? `${nm} 님` : '보낸 사람'} 사주로 계산한 표예요. 같은 해라도 사람마다 좋은 달이 달라요.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.06}>
          <div className="space-y-3 pt-1">
            <GoldCta sub="무료" onClick={() => navigate(`/tojung?${utm('newyear_view')}`)}>
              내 {data.y}년도 미리 보기
            </GoldCta>
            <GhostButton sub="하루 한 번 무료" onClick={() => navigate(`/daily?${utm('newyear_view_daily')}`)}>
              내 사주로 오늘의 운세 보기
            </GhostButton>
            {!inToss && (
              <a href={`/unse/${data.y}/?${utm('newyear_view_tti')}`}
                style={{ display: 'block', textAlign: 'center', fontSize: 14.5, fontWeight: 700, color: HJ.goldText, padding: '6px 0' }}>
                {data.y}년 띠별 신년운세 보기
              </a>
            )}
          </div>
        </FadeIn>

        <p style={{ fontSize: 13, color: HJ.mute, textAlign: 'center', lineHeight: 1.7 }}>
          보낸 사람이 입력한 이름과 미리 보기 표만 담겨 있어요. 생일과 사주는 담기지 않아요.
        </p>
      </div>
    </div>
  );
}
