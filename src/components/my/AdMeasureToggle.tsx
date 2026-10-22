/**
 * 광고 성과 측정 끄기 (2026-10-22, 앱 전용) — 처리방침 6-2 의 거부 방법.
 *   토스 픽셀(src/services/ads/tossPixel.ts)을 켠 앱 번들에서만 보인다. 끄면 이 기기에서는 토스에 아무것도 보내지 않는다.
 */
import { useState } from 'react';
import { HJ, SERIF } from '@/components/hanji/Hanji';
import { TOSS_PIXEL_ON, tossPixelOptedOut, setTossPixelOptOut } from '@/services/ads/tossPixel';

export function AdMeasureToggle({ style }: { style?: React.CSSProperties }) {
  const [off, setOff] = useState(() => tossPixelOptedOut());
  if (!TOSS_PIXEL_ON) return null;
  const flip = () => { const next = !off; setTossPixelOptOut(next); setOff(next); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '14px 16px', ...style }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: SERIF, fontSize: 15.5, fontWeight: 700, color: HJ.ink }}>광고 성과 측정 {off ? '꺼짐' : '켜짐'}</p>
        <p style={{ fontSize: 13.5, color: HJ.mute, lineHeight: 1.65, marginTop: 4 }}>
          토스 광고를 보고 온 분이 결제까지 했는지 토스에 알려요. 이름, 생일, 메일 주소는 보내지 않아요. 꺼도 서비스는 그대로 쓸 수 있어요.
        </p>
      </div>
      <button type="button" onClick={flip} aria-pressed={!off}
        style={{ minWidth: 64, minHeight: 44, borderRadius: 12, border: `1px solid ${HJ.ink}`, background: 'transparent', color: HJ.ink, fontWeight: 800, fontSize: 15 }}>
        {off ? '켜기' : '끄기'}
      </button>
    </div>
  );
}
