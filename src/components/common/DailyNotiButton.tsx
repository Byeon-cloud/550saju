/**
 * DailyNotiButton — 매일 아침 운세 알림 동의 버튼 (2026-06-13 · 앱인토스 전용)
 *
 * 기능성 스마트발송 체인의 클라 측: 콘솔 알림 동의문("오늘의 운세 매일 알림" · 매일 9시)에
 * 유저 동의를 받는 토스 SDK 동의창 호출. 동의자에게만 "운세 도착" 정기 푸시가 발송됨.
 *
 * - SDK: requestNotificationAgreement({ options: { templateCode }, onEvent, onError })
 *   onEvent type: newAgreement | alreadyAgreed | agreementRejected · cleanup 반환(호출 필수)
 * - templateCode 는 콘솔 동의문 상세의 코드 — VITE_TOSS_NOTI_TEMPLATE_CODE (비우면 비노출 · 안전)
 * - 동의 완료 시 localStorage 플래그로 상태 칩 전환 (재진입 시 중복 유도 X)
 */
import { useState } from 'react';
import { isAppintosBuild } from '@/lib/env';
import { useToast } from '@/components/common/Toast';

const TEMPLATE_CODE = import.meta.env.VITE_TOSS_NOTI_TEMPLATE_CODE as string | undefined;
const AGREED_KEY = 'saju500:daily_noti_agreed';

const C = { gold: '#B8965A', goldDeep: '#8C6D3D', ink: '#1A1A1A', mute: '#6F6557' } as const;

export function DailyNotiButton({ className }: { className?: string }) {
  const toast = useToast();
  const [agreed, setAgreed] = useState(() => {
    try { return localStorage.getItem(AGREED_KEY) === '1'; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);

  if (!isAppintosBuild || !TEMPLATE_CODE) return null;

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
            toast.show('내일 아침부터 운세 알림을 보내드릴게요', 'success');
          } else if (type === 'alreadyAgreed') {
            markAgreed();
            toast.show('이미 알림을 받고 계세요', 'info');
          } else {
            toast.show('알림은 언제든 다시 신청할 수 있어요', 'info');
          }
          import('@/services/analytics').then((a) => a.trackEvent('noti_agree', { result: type })).catch(() => {});
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
        padding: '10px 14px', borderRadius: 12,
        background: 'rgba(184,150,90,0.08)', border: '1px solid rgba(184,150,90,0.22)',
        fontSize: 13.5, fontWeight: 600, color: C.goldDeep,
      }}>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 900 }}>日</span>
        매일 아침 9시, 운세 알림을 받고 있어요
      </div>
    );
  }

  return (
    <button type="button" onClick={onAsk} disabled={busy} className={className} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      width: '100%', padding: '13px 16px', borderRadius: 14, cursor: busy ? 'wait' : 'pointer',
      background: '#FFFFFF', border: `1px solid rgba(184,150,90,0.35)`,
      boxShadow: '0 2px 10px rgba(26,26,26,0.05)', textAlign: 'left',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: 'rgba(184,150,90,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Noto Serif KR', serif", fontSize: 16, fontWeight: 900, color: C.goldDeep,
        }}>日</span>
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: C.ink }}>매일 아침 운세 알림 받기</span>
          <span style={{ display: 'block', fontSize: 13, color: C.mute, marginTop: 1 }}>아침 9시, 오늘의 운세가 도착해요</span>
        </span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#B9B2A8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}
