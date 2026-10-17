/**
 * 홈의 친구 초대 한 줄 (2026-10-18) — 사주를 넣은 사람에게. 누르면 /invite. 금액은 서버 규칙(없으면 기본값)
 */
import { useNavigate } from 'react-router-dom';
import { HJ } from '@/components/hanji/Hanji';
import { cachedInviteRules, inviteWelcomeVisible } from '@/services/referral/referral';

export function InviteRow({ padding = '20px 16px 0' }: { padding?: string }) {
  const navigate = useNavigate();
  if (inviteWelcomeVisible()) return null; // 초대받은 친구에게는 받기 카드가 먼저
  const r = cachedInviteRules() || { referrerUn: 2, inviteeUn: 3 };
  const both = r.referrerUn === r.inviteeUn ? `두 분 모두 ${r.referrerUn}운씩` : `나 ${r.referrerUn}운, 친구 ${r.inviteeUn}운`;
  return (
    <div style={{ padding }}>
      <button type="button" className="text-left w-full"
        onClick={() => {
          import('@/services/analytics').then((a) => a.trackEvent('cta_click', { label: '홈 친구 초대', page: '/' })).catch(() => {});
          navigate('/invite');
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '14px 16px' }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: HJ.ink }}>친구에게 알려 주고 운 받기</span>
          <span style={{ display: 'block', fontSize: 13.5, color: HJ.mute, marginTop: 2 }}>친구가 사주를 넣으면 {both} 드려요</span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: HJ.goldText, flexShrink: 0 }}>초대하기</span>
      </button>
    </div>
  );
}
