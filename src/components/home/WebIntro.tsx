/**
 * 웹 첫 손님 소개 (2026-10-17, 오너: 앱과 웹은 차이점이 필요) — 사주가 없는 웹 방문자에게만 띠 표 아래에 보인다.
 *
 *   앱인토스 손님은 토스 안에서 짧게 보고 띠 표로 바로 들어가지만, 웹 손님은 검색이나 카톡 링크로 처음 와서
 *   여기가 무엇을 하는 곳인지부터 알아야 입력한다. 앱 빌드와 토스 안에서는 렌더하지 않는다.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoldCta, SERIF, HJ } from '@/components/hanji/Hanji';
import { isAppintosBuild } from '@/lib/env';
import { isAppsInToss } from '@/services/payment/iapService';

export function WebIntro({ premiumPrice }: { premiumPrice: number }) {
  const navigate = useNavigate();
  const show = !isAppintosBuild && !isAppsInToss();
  useEffect(() => {
    if (!show) return;
    import('@/services/analytics').then((a) => a.trackEvent('web_intro_view', {})).catch(() => {});
  }, [show]);
  if (!show) return null;

  const Row = ({ k, v }: { k: string; v: string }) => (
    <div style={{ display: 'flex', gap: 14, padding: '12px 2px', borderBottom: `1px solid ${HJ.line}` }}>
      <span style={{ flexShrink: 0, width: 96, fontSize: 15, fontWeight: 700, color: HJ.ink }}>{k}</span>
      <span style={{ fontSize: 15, lineHeight: 1.65, color: HJ.ink2 }}>{v}</span>
    </div>
  );

  return (
    <div style={{ padding: '28px 16px 0' }}>
      <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '18px 18px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: HJ.mute }}>처음 오셨나요</p>
        <h2 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1.45, marginTop: 4, color: HJ.ink }}>사주500은 이런 곳이에요</h2>
        <div style={{ marginTop: 10, borderTop: `1px solid ${HJ.line}` }}>
          <Row k="오늘의 운세" v="생년월일만 넣으면 내 사주 여덟 글자로 오늘 하루를 풀어 드려요. 하루 한 번 무료예요." />
          <Row k="꿈해몽, 사주대화" v="꿈 내용이나 고민을 적으면 내 사주와 엮어 답해 드려요. 이것도 하루 한 번 무료예요." />
          <Row k="종합사주, 신년운세" v={`타고난 성격부터 10년 대운, 2027년 달마다 흐름까지 깊게 풀어 드려요. 종합사주는 ${premiumPrice}운, 신년운세는 결제 전에 무료로 미리 볼 수 있어요.`} />
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: HJ.mute, marginTop: 10 }}>
          사주는 명리학 고전의 원리로 계산하고, 음력 생일은 한국천문연구원 자료로 만든 한국 음력 달력으로 바꿔요. 입력한 생일은 이 기기에 저장되고, 로그인하면 계정에 지켜 둘 수 있어요.
        </p>
        <GoldCta style={{ marginTop: 14 }} sub="무료" onClick={() => {
          import('@/services/analytics').then((a) => a.trackEvent('cta_click', { label: '웹 소개 시작하기', page: '/' })).catch(() => {});
          navigate('/input?from=web_intro');
        }}>
          내 사주 넣고 오늘의 운세 보기
        </GoldCta>
      </div>
    </div>
  );
}
