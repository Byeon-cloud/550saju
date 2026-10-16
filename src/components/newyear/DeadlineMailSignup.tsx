/**
 * 신년운세 마감 전 알림 받기 (2026-10-17, 시험 E14 · 웹 전용)
 *
 *   출시 기념가(11월 30일까지)가 끝나기 전 11월 28일에 메일 한 통을 보낸다. 서버: functions/src/mail/marketingMail.ts.
 *   광고성 정보라 수신 동의(필수 체크)를 받고, 신청하면 바로 '동의 확인' 메일이 간다. 11월 28일부터는 보이지 않는다.
 *   앱인토스 빌드에서는 그리지 않는다(앱 사용자는 화면 안 마감 표시로 알린다, pricing.ts).
 */
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';
import { isAppsInToss } from '@/services/payment/iapService';
import { HJ, SERIF } from '@/components/hanji/Hanji';

const SHOW_UNTIL = '2026-11-27';
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export function DeadlineMailSignup({ source = 'tojung' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  if (isAppsInToss() || kstDay() > SHOW_UNTIL) return null;
  const valid = EMAIL_RE.test(email.trim());

  async function submit() {
    if (!valid || !agree || busy) return;
    setBusy(true); setErr('');
    try {
      await ensureFunctionsTarget();
      const fn = httpsCallable<{ email: string; consent: boolean; source: string }, { ok: boolean }>(functions, 'subscribeMarketingMail', { timeout: 30000 });
      await fn({ email: email.trim(), consent: true, source: `newyear_${source}` });
      setDone(true);
      import('@/services/analytics').then((a) => a.trackEvent('mail_subscribe', { source })).catch(() => {});
    } catch (e: any) {
      setErr(String(e?.message || '').replace(/^.*?:\s*/, '') || '신청하지 못했어요. 잠시 뒤 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="deadline-mail" style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px 16px 18px' }}>
      <p style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: HJ.ink }}>출시 기념가가 끝나기 전에 알려 드릴까요</p>
      {done ? (
        <p style={{ fontSize: 15, color: HJ.ink2, lineHeight: 1.75, marginTop: 8 }}>
          신청했어요. 확인 메일을 보냈어요. 11월 28일에 한 번 더 알려 드릴게요.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 14.5, color: HJ.mute, lineHeight: 1.7, marginTop: 6 }}>
            출시 기념가는 11월 30일까지예요. 11월 28일에 메일 한 통만 보내 드려요.
          </p>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="메일 주소"
            aria-label="알림 받을 메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', marginTop: 12, height: 48, borderRadius: 12, border: `1px solid ${HJ.line}`, padding: '0 14px', fontSize: 16, background: '#fff', color: HJ.ink }}
          />
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: 13.5, color: HJ.ink2, lineHeight: 1.6, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
            <span>(필수) 사주500 신년운세와 할인 소식 메일(광고성 정보)을 받는 데 동의해요. 메일 안의 수신 거부로 언제든 그만 받을 수 있어요.</span>
          </label>
          {err && <p style={{ fontSize: 13.5, color: HJ.seal, marginTop: 8 }}>{err}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!valid || !agree || busy}
            style={{ width: '100%', marginTop: 12, minHeight: 48, borderRadius: 12, border: `1px solid ${HJ.ink}`, background: valid && agree ? HJ.ink : 'transparent', color: valid && agree ? '#F4EFE4' : HJ.mute, fontWeight: 800, fontSize: 15.5 }}
          >
            {busy ? '신청하는 중이에요' : '알림 받기'}
          </button>
        </>
      )}
    </div>
  );
}
