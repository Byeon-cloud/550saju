/**
 * 매일 아침 일주 운세 메일 받기 (2026-10-17, 시험 E15 · 웹 전용)
 *
 *   앱인토스는 토스 알림(DailyNotiButton, 매일 9시)이 같은 일을 한다. 웹은 메일로 보낸다.
 *   서버: functions/src/ilju/iljuDaily.ts (생일로 일주를 계산해 dailyMailSubs/{uid} 에 메일과 일주만 남긴다).
 *   매일 아침 7시, 60일주별로 하루 한 번 만든 글을 보낸다(사람마다 AI 를 부르지 않아 구독자가 늘어도 원가가 그대로다).
 */
import { useEffect, useState } from 'react';
import { EmailDomainPicks } from '@/components/common/EmailDomainPicks';
import { httpsCallable } from 'firebase/functions';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';
import { isAppsInToss } from '@/services/payment/iapService';
import { isAppintosBuild } from '@/lib/env';
import { HJ, SERIF } from '@/components/hanji/Hanji';

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const LS_DONE = 'saju500:daily_mail_done';

export function DailyMailSignup({ prefill, source = 'daily', style, compact = false }: {
  prefill?: { birth?: string; calendar?: 'solar' | 'lunar'; name?: string };
  source?: string;
  style?: React.CSSProperties;
  /** 2026-10-17 홈 한 줄 — 앱의 DailyNotiButton slim 과 같은 자리. 누르면 펼쳐진다 */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [email, setEmail] = useState('');
  const [birth, setBirth] = useState(prefill?.birth || '');
  const [calendar, setCalendar] = useState<'solar' | 'lunar'>(prefill?.calendar || 'solar');
  const [agree, setAgree] = useState(false);
  const [adAgree, setAdAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(() => { try { return localStorage.getItem(LS_DONE); } catch { return null; } });
  const [err, setErr] = useState('');
  useEffect(() => { if (prefill?.birth && !birth) setBirth(prefill.birth); }, [prefill?.birth]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (window.location.hash !== '#daily-mail') return;
    const t = window.setTimeout(() => document.getElementById('daily-mail')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
    return () => window.clearTimeout(t);
  }, []);
  if (isAppintosBuild || isAppsInToss()) return null; // 웹 전용 (앱 번들을 브라우저로 열어도 숨김)
  if (compact && done) return null; // 이미 받고 있으면 홈에는 굳이 다시 보이지 않는다
  if (compact && !open) {
    return (
      <button type="button" onClick={() => { setOpen(true); import('@/services/analytics').then((a) => a.trackEvent('cta_click', { label: '아침 운세 메일 펼치기', page: window.location.pathname })).catch(() => {}); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', minHeight: 44, padding: '10px 12px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left', ...style }}>
        <span aria-hidden="true" style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 900, color: HJ.ink }}>日</span>
        <span>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: HJ.ink2 }}>아침 7시마다 내 일주 운세를 메일로 받아 볼까요?</span>
          <span style={{ display: 'block', fontSize: 13, color: HJ.mute, marginTop: 2 }}>무료예요. 메일 아래 버튼 하나로 바로 그만 받을 수 있어요</span>
        </span>
        <span aria-hidden="true" style={{ color: HJ.mute }}>›</span>
      </button>
    );
  }
  const birthOk = /^\d{8}$/.test(birth);
  const ok = EMAIL_RE.test(email.trim()) && birthOk && agree;

  async function submit() {
    if (!ok || busy) return;
    setBusy(true); setErr('');
    try {
      await ensureFunctionsTarget();
      const fn = httpsCallable<any, { ok: boolean; iljuKo: string }>(functions, 'subscribeDailyMail', { timeout: 30000 });
      const r = await fn({ email: email.trim(), birth, calendar, name: prefill?.name || '', consent: true, adConsent: adAgree, source });
      const label = `${r.data.iljuKo} 일주`;
      setDone(label);
      try { localStorage.setItem(LS_DONE, label); } catch { /* noop */ }
      import('@/services/analytics').then((a) => a.trackEvent('mail_subscribe', { source: `daily_${source}` })).catch(() => {});
    } catch (e: any) {
      setErr(String(e?.message || '').replace(/^.*?:\s*/, '') || '신청하지 못했어요. 잠시 뒤 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', height: 48, borderRadius: 12, border: `1px solid ${HJ.line}`, padding: '0 14px', fontSize: 16, background: '#fff', color: HJ.ink };
  return (
    <div id="daily-mail" style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px 16px 18px', ...style }}>
      <p style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: HJ.ink }}>아침 7시마다 내 일주 운세를 메일로 보내 드려요</p>
      {done ? (
        <p style={{ fontSize: 15, color: HJ.ink2, lineHeight: 1.75, marginTop: 8 }}>
          {done}로 신청했어요. 확인 메일을 보냈어요. 내일 아침부터 보내 드려요.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 14.5, color: HJ.mute, lineHeight: 1.7, marginTop: 6 }}>
            태어난 날의 간지(일주)로 그날 하루를 짧게 풀어 드려요. 무료이고, 그만 받고 싶으면 메일 아래 버튼 하나면 돼요.
          </p>
          <input type="email" inputMode="email" autoComplete="email" placeholder="메일 주소" aria-label="운세 받을 메일 주소"
            value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, marginTop: 12 }} />
          <EmailDomainPicks value={email} onPick={setEmail} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input inputMode="numeric" placeholder="생년월일 8자리 (예: 19640315)" aria-label="생년월일 8자리"
              value={birth} onChange={(e) => setBirth(e.target.value.replace(/\D/g, '').slice(0, 8))} style={{ ...inputStyle, flex: 1 }} />
            <button type="button" onClick={() => setCalendar(calendar === 'solar' ? 'lunar' : 'solar')} aria-label="양력 음력 바꾸기"
              style={{ width: 72, height: 48, borderRadius: 12, border: `1px solid ${HJ.line}`, background: '#fff', fontWeight: 700, fontSize: 15, color: HJ.ink }}>
              {calendar === 'solar' ? '양력' : '음력'}
            </button>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: 13.5, color: HJ.ink2, lineHeight: 1.6, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
            <span>(필수) 아침 운세 메일을 받으려고 메일 주소와 일주(생일로 계산)를 맡겨요. 생일 전체는 남기지 않고, 메일 안의 수신 거부로 언제든 그만 받을 수 있어요.</span>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8, fontSize: 13.5, color: HJ.ink2, lineHeight: 1.6, cursor: 'pointer' }}>
            <input type="checkbox" checked={adAgree} onChange={(e) => setAdAgree(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
            <span>(선택) 2027 신년운세 출시 기념가 마감(11월 30일)과 할인 소식도 받을래요. 광고성 정보예요.</span>
          </label>
          {err && <p style={{ fontSize: 13.5, color: HJ.seal, marginTop: 8 }}>{err}</p>}
          <button type="button" onClick={submit} disabled={!ok || busy}
            style={{ width: '100%', marginTop: 12, minHeight: 48, borderRadius: 12, border: `1px solid ${HJ.ink}`, background: ok ? HJ.ink : 'transparent', color: ok ? '#F4EFE4' : HJ.mute, fontWeight: 800, fontSize: 15.5 }}>
            {busy ? '신청하는 중이에요' : '무료로 받아 보기'}
          </button>
        </>
      )}
    </div>
  );
}
