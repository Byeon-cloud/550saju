/**
 * 친구에게 사주500 알리기 (2026-10-14 · 공유 리워드 종료)
 *
 *   앱인토스 '공유 리워드'(contactsViral)가 2026-10-23 종료된다(토스 10월 2주 공지). 그 뒤로는 지급 요청이 처리되지 않고,
 *   미니앱 안의 진입 버튼, 안내 화면, 연동 코드를 직접 지우고 검수 배포해야 한다.
 *   → 친구 초대는 결과 공유(utils/share)와 같은 보상 없는 토스 공유(공유 링크 + 공유 시트)로 바꾼다.
 *     share() 는 실제로 보냈는지 알려 주지 않아서 운을 붙이면 누르기만 해도 쌓인다 → 보상 없음.
 *   대체할 토스 Viral SDK(캠페인형)는 10월 말~11월 초 공개 예정 — 나오면 콘솔 캠페인과 함께 다시 붙인다.
 *   이전 공유 보상 기록(장부 invite / share)은 이벤트 탭 '받은 운' 내역에 그대로 남는다.
 */

/** 측정 — fire-and-forget */
function track(name: string, params?: Record<string, string | number>) {
  import('@/services/analytics').then((a) => a.trackEvent(name, params)).catch(() => {});
}

/** 친구에게 보내는 말 (보내는 사람이 친구에게 하는 말이라 반말). 2026-10-18 친구 초대 보상이 생겨 받는 운을 적는다 */
const inviteText = (n?: number) => (n && n > 0
  ? `사주500에서 내 사주를 봤어. 이 링크로 들어와서 생일을 넣으면 너도 ${n}운을 받아. 오늘의 운세는 무료야`
  : '사주500에서 내 사주를 봤어. 생일만 넣으면 오늘의 운세는 무료야');

/** 공유 시트를 연다. 보낸 것으로 확인되면 onShared, 취소나 실패면 onCancel */
export async function shareInvite(opts?: { onShared?: () => void; onCancel?: () => void; inviteeUn?: number }): Promise<void> {
  track('share_click', { type: 'invite', page: typeof window !== 'undefined' ? window.location.pathname : '' });
  const INVITE_TEXT = inviteText(opts?.inviteeUn);
  const { isAppsInToss } = await import('@/services/payment/iapService');
  if (isAppsInToss()) {
    try {
      const { share, getTossShareLink } = await import('@apps-in-toss/web-framework');
      const { withInv, ensureInviteCode } = await import('@/services/referral/referral');
      await ensureInviteCode();
      const link = await getTossShareLink(`intoss://saju-500${withInv('/?ref=share')}`, 'https://saju500.app/og-image.png');
      await share({ message: `${INVITE_TEXT}\n${link}` });
      track('share_complete', { type: 'invite', method: 'toss_share', rewarded: 0 });
      opts?.onShared?.();
    } catch {
      opts?.onCancel?.();
    }
    return;
  }
  // 웹
  const { withInv, ensureInviteCode } = await import('@/services/referral/referral');
  await ensureInviteCode();
  const url = withInv(`${window.location.origin}/?ref=share`);
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: '사주500', text: INVITE_TEXT, url });
      track('share_complete', { type: 'invite', method: 'web_share', rewarded: 0 });
      opts?.onShared?.();
    } catch {
      opts?.onCancel?.();
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${INVITE_TEXT}\n${url}`);
    track('share_complete', { type: 'invite', method: 'clipboard', rewarded: 0 });
    opts?.onShared?.();
  } catch {
    opts?.onCancel?.();
  }
}
