/**
 * /auth/naver — 웹 네이버 로그인 돌아오는 곳 (2026-10-19, services/auth/authService.ts finishNaverLogin)
 *   네이버가 code 와 state 를 붙여 돌려보내면 서버(loginWithNaver)로 로그인을 마치고, 누르기 전에 보던 화면으로 새로 연다
 *   (새로 열어야 충전 화면의 '로그인하고 결제' 이어 하기가 그대로 동작한다).
 */
import { useEffect, useState } from 'react';
import { HJ, SERIF } from '@/components/hanji/Hanji';
import { usePageTitle } from '@/hooks/usePageTitle';

export function NaverCallbackPage() {
  usePageTitle('네이버 로그인');
  const [fail, setFail] = useState<{ msg: string; back: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      try {
        const { finishNaverLogin } = await import('@/services/auth/authService');
        const { returnTo } = await finishNaverLogin(params);
        // 로그인 성공 기록이 저장될 틈을 준다 (바로 새로 열면 기록이 사라졌다, 10-19 첫 성공 때 확인)
        await new Promise((r) => setTimeout(r, 900));
        if (alive) window.location.replace(returnTo);
      } catch (e: any) {
        const code = String(e?.code || 'error');
        const msg = String(e?.message || '').replace(/^Firebase:\s*/, '');
        import('@/services/analytics').then((a) => a.trackEvent('login_fail', { provider: 'naver', via: 'redirect', code: code.slice(0, 60), msg: msg.slice(0, 180) })).catch(() => {});
        const back = typeof e?.returnTo === 'string' ? e.returnTo : '/my';
        if (code === 'naver/access_denied') { window.location.replace(back); return; }
        if (alive) setFail({ msg: code.startsWith('naver/') ? msg : '네이버 로그인을 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.', back });
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: HJ.paper, padding: 24 }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        {!fail ? (
          <>
            <p style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: HJ.ink }}>네이버로 로그인하는 중이에요</p>
            <p style={{ fontSize: 15, color: HJ.mute, marginTop: 8, lineHeight: 1.6 }}>잠시만 기다려 주세요.</p>
          </>
        ) : (
          <>
            <p style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: HJ.ink }}>로그인하지 못했어요</p>
            <p style={{ fontSize: 15, color: HJ.ink2, marginTop: 8, lineHeight: 1.6 }}>{fail.msg}</p>
            <button type="button" onClick={() => window.location.replace(fail.back)}
              style={{ marginTop: 20, width: '100%', height: 52, borderRadius: 14, border: `1px solid ${HJ.ink}`, background: 'transparent', color: HJ.ink, fontSize: 16, fontWeight: 700 }}>
              돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
