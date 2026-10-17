/**
 * 초대받은 친구 카드 (2026-10-18) — 친구 초대 링크로 처음 들어온 사람에게만 보인다 (홈, 오늘의 운세 결과, 초대 화면).
 *
 *   1) 사주가 없으면: 사주 넣기로
 *   2) 사주가 있으면: 앱은 '토스로 확인하고 받기'(계정은 그대로, 토스 회원인지만), 웹은 소셜 로그인 시트 → completeInvite
 *   결과는 서버가 정한다(신원 하나당 한 번, 새 손님만, 상한). 인정되면 바로 적립을 받아 잔액에 더한다.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoldCta, SERIF, HJ } from '@/components/hanji/Hanji';
import { useToast } from '@/components/common/Toast';
import { isAppintosBuild } from '@/lib/env';
import { isAppsInToss } from '@/services/payment/iapService';
import { getProfiles } from '@/services/storage/localStore';
import { inviteWelcomeVisible, pendingInvite, completeInvite, verifyTossForInvite, type CompleteStatus } from '@/services/referral/referral';
import { WebLoginSheet } from '@/components/auth/WebLoginSheet';
import { useAuth } from '@/hooks/useAuth';

const MSG: Partial<Record<CompleteStatus, string>> = {
  not_new: '이미 사주500을 쓰던 분은 초대 보상을 받을 수 없어요',
  used: '이 계정은 이미 초대 보상을 받았어요',
  self: '내 초대 링크로는 받을 수 없어요',
  expired: '초대 링크를 누른 지 30일이 지나 받을 수 없어요',
  no_saju: '내 사주를 먼저 넣어 주세요',
  paused: '오늘 초대 보상이 모두 나갔어요. 내일 다시 눌러 주세요',
  disabled: '지금은 초대 보상을 쉬고 있어요',
  no_visit: '초대 기록을 찾지 못했어요. 잠시 뒤 다시 눌러 주세요',
  error: '잠시 뒤 다시 눌러 주세요',
};

export function InviteWelcomeCard({ padding }: { padding?: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { login } = useAuth();
  const inApp = isAppintosBuild || isAppsInToss();
  const [visible, setVisible] = useState(inviteWelcomeVisible());
  const [busy, setBusy] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const p = pendingInvite();
  const hasSaju = getProfiles().length > 0;
  const un = p?.inviteeUn || 3;

  // 부팅 때 서버 기록이 끝나면 보이게 (App 의 captureInvite 가 조금 늦게 끝난다)
  useEffect(() => {
    if (visible) return;
    const t = window.setInterval(() => { if (inviteWelcomeVisible()) { setVisible(true); window.clearInterval(t); } }, 1500);
    const stop = window.setTimeout(() => window.clearInterval(t), 15000);
    return () => { window.clearInterval(t); window.clearTimeout(stop); };
  }, [visible]);
  useEffect(() => {
    if (visible) import('@/services/analytics').then((a) => a.trackEvent('inv_welcome_view', { hasSaju: hasSaju ? 1 : 0 })).catch(() => {});
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !p) return null;

  async function finish() {
    setBusy(true);
    const r = await completeInvite();
    setBusy(false);
    if (r.status === 'granted') {
      toast.show(`${r.inviteeUn || un}운을 받았어요.${r.referrerName ? ` ${r.referrerName} 님에게도 운을 드렸어요` : ''}`, 'success');
      setVisible(false);
      return;
    }
    if (r.status === 'need_login') { toast.show(inApp ? '토스 확인을 다시 눌러 주세요' : '로그인을 다시 해 주세요', 'info'); return; }
    toast.show(MSG[r.status] || MSG.error!, 'info');
    if (!['error', 'paused', 'no_visit', 'no_saju'].includes(r.status)) setVisible(false);
  }

  async function onClaim() {
    if (busy) return;
    import('@/services/analytics').then((a) => a.trackEvent('inv_welcome_click', { app: inApp ? 1 : 0 })).catch(() => {});
    if (!hasSaju) { navigate('/input?from=daily'); return; }
    if (inApp) {
      setBusy(true);
      const ok = await verifyTossForInvite();
      setBusy(false);
      if (!ok) { toast.show('토스 확인이 끝나지 않았어요. 다시 눌러 주세요', 'info'); return; }
      await finish();
      return;
    }
    const { auth } = await import('@/services/auth/firebase');
    if (auth.currentUser && !auth.currentUser.isAnonymous) { await finish(); return; }
    setShowLogin(true);
  }

  return (
    <div style={{ padding: padding ?? '0' }}>
      <div style={{ background: HJ.card, border: `1px solid ${HJ.gold}`, borderRadius: 14, padding: '18px 18px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: HJ.goldText }}>친구 초대로 오셨어요</p>
        <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, lineHeight: 1.45, marginTop: 4, color: HJ.ink }}>
          {p.referrerName ? `${p.referrerName} 님이 보낸 선물 ${un}운` : `초대 선물 ${un}운`}
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2, marginTop: 8 }}>
          {hasSaju
            ? (inApp ? `토스로 확인하면 ${un}운을 바로 드려요. 토스 회원인지만 확인하고 다른 정보는 받지 않아요.` : `로그인하면 ${un}운을 바로 드려요. 기록도 계정에 지켜져요.`)
            : `내 사주를 넣고 ${inApp ? '토스로 확인' : '로그인'}하면 ${un}운을 드려요. 오늘의 운세는 무료예요.`}
        </p>
        <GoldCta style={{ marginTop: 14 }} onClick={onClaim} disabled={busy}>
          {busy ? '확인하는 중이에요' : hasSaju ? (inApp ? `토스로 확인하고 ${un}운 받기` : `로그인하고 ${un}운 받기`) : '내 사주 넣기'}
        </GoldCta>
      </div>
      {!inApp && (
        <WebLoginSheet
          open={showLogin}
          onClose={() => setShowLogin(false)}
          onSuccess={() => { setShowLogin(false); finish(); }}
          toast={toast}
          onLogin={login}
          title={['로그인하고', `${un}운 받기`]}
          desc={['한 사람에 한 번만 드리려고 로그인을 받아요', '로그인하면 기록도 계정에 지켜져요']}
        />
      )}
    </div>
  );
}
