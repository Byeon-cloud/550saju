/**
 * 오늘의 운세 → 종합사주 반값 카드 (2026-10-19) — services/offers/firstDailyOffer.ts
 *   오늘의 운세 첫 단락 바로 아래(위치 top)와 결과 끝(end)에 같은 카드. 누르면 그 사람으로 종합사주 화면.
 *   운이 모자라면 종합사주 화면이 충전으로 보낼 때 2,500원(5+2운)이 미리 골라지고, 결제 뒤 돌아와 바로 시작한다.
 *   디자인: 프리미엄이라 금선 두 줄 허용(v9 규칙). 버튼만 금색.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HJ, SERIF, GoldCta } from '@/components/hanji/Hanji';
import { firstDailyOfferActive, firstDailyOfferLeft, OFFER } from '@/services/offers/firstDailyOffer';
import { getBalance } from '@/services/storage/localStore';

export function FirstDailyOfferCard({ profileId, name, pos }: { profileId?: string; name?: string; pos: 'top' | 'end' }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(() => firstDailyOfferActive());
  const [left, setLeft] = useState(() => firstDailyOfferLeft());
  const seen = useRef(false);
  useEffect(() => {
    const sync = () => { setActive(firstDailyOfferActive()); setLeft(firstDailyOfferLeft()); };
    const t = window.setInterval(sync, 30000);
    window.addEventListener('saju500:offer-change', sync);
    return () => { window.clearInterval(t); window.removeEventListener('saju500:offer-change', sync); };
  }, []);
  useEffect(() => {
    if (!active || seen.current) return;
    seen.current = true;
    import('@/services/analytics').then((a) => a.trackEvent('daily_offer_view', { pos })).catch(() => {});
  }, [active, pos]);
  if (!active) return null;
  const short = getBalance() < OFFER.price;
  const go = () => {
    import('@/services/analytics').then((a) => a.trackEvent('daily_offer_click', { pos, short: short ? 1 : 0 })).catch(() => {});
    navigate(`/premium?${profileId ? `profileId=${encodeURIComponent(profileId)}&` : ''}from=daily_offer`);
  };
  return (
    <div style={{ margin: pos === 'top' ? '18px 0 6px' : '6px 16px 22px', padding: 3, border: `1px solid ${HJ.gold}`, borderRadius: 14, background: HJ.paper }}>
      <div style={{ border: `1px solid ${HJ.gold}`, borderRadius: 11, padding: '16px 16px 14px', background: '#FFFDF8' }}>
        <p style={{ fontSize: 13.5, color: HJ.mute, margin: 0 }}>첫 오늘의 운세 기념, {left}</p>
        <p style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: HJ.ink, margin: '6px 0 0', lineHeight: 1.45 }}>
          {name ? `${name} 님의` : '내'} 사주 전체를 종합사주로 볼까요?
        </p>
        <p style={{ fontSize: 15, color: HJ.ink2, lineHeight: 1.7, margin: '8px 0 0' }}>
          오늘의 운세는 오늘 하루를 봐요. 종합사주는 타고난 성향, 일과 돈, 사람, 지금 지나는 대운까지 열 장으로 풀어요.
          지금은 <b>{OFFER.price}운</b>이에요 <span style={{ color: HJ.mute }}>(정가 10운)</span>.
        </p>
        <GoldCta style={{ marginTop: 14 }} onClick={go}>종합사주 {OFFER.price}운에 보기</GoldCta>
        {short && (
          <p style={{ fontSize: 13.5, color: HJ.mute, textAlign: 'center', margin: '8px 0 0', lineHeight: 1.6 }}>
            운이 없어도 괜찮아요. 2,500원을 충전하면 바로 시작하고 2운이 남아요.
          </p>
        )}
      </div>
    </div>
  );
}
