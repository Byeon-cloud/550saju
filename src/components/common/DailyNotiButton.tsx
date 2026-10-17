/**
 * DailyNotiButton — 매일 아침 운세 알림 동의 버튼 (2026-06-13 · 앱인토스 전용)
 *
 * 기능성 정기 푸시의 앱 쪽: 콘솔 알림 동의문('오늘의 운세 매일 오전 9시 알림', termsId 130317)에
 * 사용자 동의를 받는 토스 동의 창을 띄운다. 동의한 사람에게만 매일 9시 '오늘의 운세가 준비됐어요.' 푸시가 간다.
 *
 * - SDK: requestNotificationAgreement({ options: { templateCode }, onEvent, onError })
 *   onEvent type: newAgreement | alreadyAgreed | agreementRejected. 실기기 반환값은 함수가 아닐 수 있어 cleanup 은 try 로
 * - templateCode 는 스마트발송 템플릿 코드(동의문 코드 아님) — VITE_TOSS_NOTI_TEMPLATE_CODE (비우면 비노출)
 * - 동의하면 기기에 기록해 다시 권하지 않는다
 *
 * 2026-10-16 (1.5.8) — 알림은 돈이 들지 않는 재방문 장치라 자리를 늘림:
 *   variant 'card'    오늘의 운세 고르는 화면 위 (동의 뒤엔 '받고 있어요' 한 줄)
 *   variant 'closing' 오늘의 운세를 다 읽은 끝 ('내일 아침 9시에 알려 드릴까요?', 동의 뒤엔 숨김)
 *   variant 'slim'    홈 첫 화면 한 줄 (동의 뒤엔 숨김)
 *   v9 규칙대로 금색을 빼고 먹과 종이 색만 쓴다(금색은 누르는 주 버튼에만).
 */
import { useState } from 'react';
import { isAppintosBuild } from '@/lib/env';
import { useToast } from '@/components/common/Toast';
import { HJ, SERIF } from '@/components/hanji/Hanji';

const TEMPLATE_CODE = import.meta.env.VITE_TOSS_NOTI_TEMPLATE_CODE as string | undefined;
const AGREED_KEY = 'saju500:daily_noti_agreed';

type Variant = 'card' | 'closing' | 'slim';

const COPY: Record<Variant, { title: string; sub: string }> = {
  card: { title: '아침 9시마다 그날 운세를 알려 드릴까요?', sub: '무료예요. 필요 없으면 언제든 끌 수 있어요' },
  closing: { title: '내일 운세도 아침 9시에 알려 드릴까요?', sub: '무료예요. 토스 알림으로 보내 드리고, 언제든 끌 수 있어요' },
  slim: { title: '아침 9시마다 그날 운세를 알려 드릴까요?', sub: '무료예요. 필요 없으면 언제든 끌 수 있어요' },
};

export function DailyNotiButton({ className, variant = 'card' }: { className?: string; variant?: Variant }) {
  const toast = useToast();
  const [agreed, setAgreed] = useState(() => {
    try { return localStorage.getItem(AGREED_KEY) === '1'; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);

  if (!isAppintosBuild || !TEMPLATE_CODE) return null;
  if (agreed && variant !== 'card') return null;

  const markAgreed = () => {
    try { localStorage.setItem(AGREED_KEY, '1'); } catch { /* noop */ }
    setAgreed(true);
  };

  const onAsk = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const mod: any = await import('@apps-in-toss/web-framework');
      const fn = mod?.requestNotificationAgreement;
      if (typeof fn !== 'function') {
        toast.show('토스 앱을 최신 버전으로 업데이트하면 알림을 받을 수 있어요', 'info');
        setBusy(false);
        return;
      }
      const cleanup = fn({
        options: { templateCode: TEMPLATE_CODE },
        onEvent: ({ type }: { type: string }) => {
          try { cleanup?.(); } catch { /* noop */ }
          setBusy(false);
          if (type === 'newAgreement') {
            markAgreed();
            toast.show('내일 아침부터 운세 알림을 보내 드릴게요', 'success');
          } else if (type === 'alreadyAgreed') {
            markAgreed();
            toast.show('이미 알림을 받고 계세요', 'info');
          } else {
            toast.show('알림은 언제든 다시 신청할 수 있어요', 'info');
          }
          import('@/services/analytics').then((a) => a.trackEvent('noti_agree', { result: type, src: variant })).catch(() => {});
        },
        onError: () => {
          try { cleanup?.(); } catch { /* noop */ }
          setBusy(false);
          toast.show('잠시 후 다시 시도해 주세요', 'warning');
        },
      });
    } catch {
      setBusy(false);
      toast.show('잠시 후 다시 시도해 주세요', 'warning');
    }
  };

  if (agreed) {
    return (
      <div className={className} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 12, background: HJ.card, border: `1px solid ${HJ.line}`,
        fontSize: 14, fontWeight: 600, color: HJ.ink2,
      }}>
        <span style={{ fontFamily: SERIF, fontWeight: 900, color: HJ.ink }}>日</span>
        매일 아침 9시, 운세 알림을 받고 있어요
      </div>
    );
  }

  if (variant === 'slim') {
    return (
      <button type="button" onClick={onAsk} disabled={busy} className={className} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
        minHeight: 44, padding: '10px 12px', background: 'transparent', border: 0,
        gap: 10, textAlign: 'left', cursor: busy ? 'wait' : 'pointer',
      }}>
        <span aria-hidden="true" style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 900, color: HJ.ink }}>日</span>
        <span>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: HJ.ink2 }}>{COPY.slim.title}</span>
          <span style={{ display: 'block', fontSize: 13, color: HJ.mute, marginTop: 2 }}>{COPY.slim.sub}</span>
        </span>
        <span aria-hidden="true" style={{ color: HJ.mute }}>›</span>
      </button>
    );
  }

  const copy = COPY[variant];
  return (
    <button type="button" onClick={onAsk} disabled={busy} className={className} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      width: '100%', padding: '14px 16px', borderRadius: 12, cursor: busy ? 'wait' : 'pointer',
      background: HJ.card, border: `1px solid ${HJ.line}`, textAlign: 'left',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0, border: `1px solid ${HJ.line}`, background: HJ.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: SERIF, fontSize: 17, fontWeight: 900, color: HJ.ink,
        }}>日</span>
        <span>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: HJ.ink }}>{copy.title}</span>
          <span style={{ display: 'block', fontSize: 13, color: HJ.mute, marginTop: 2 }}>{copy.sub}</span>
        </span>
      </span>
      <span aria-hidden="true" style={{ fontSize: 18, color: HJ.mute }}>›</span>
    </button>
  );
}
