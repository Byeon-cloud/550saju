/**
 * 광고, 작가용 토스 앱 링크 만들기 (2026-10-25, 시험 E39, E37)
 *
 *   메타 광고나 인플루언서 스토리에서 토스 앱의 사주500 이 바로 열리게 하려면 https 공유 링크가 필요하다.
 *   그 링크는 앱인토스 SDK getTossShareLink 로 앱 안에서만 만들 수 있다(웹이나 서버에서는 못 만든다).
 *   그래서 내 정보의 버전을 다섯 번 누르면 열리는 개발자 시트에 이 칸을 둔다. 오너가 만들어 카카오톡 '나에게'로 보내면 된다.
 *   링크 끝에 utm 꼬리표가 붙고, 앱은 열릴 때 getSchemeUri 로 꼬리표를 읽어 기록한다(services/analytics.ts).
 *   링크를 만드는 것뿐이라 돈이나 잔액과 상관이 없다.
 */
import { useState } from 'react';
import { isAppsInToss } from '@/services/payment/iapService';

const PRESETS = [
  { label: '메타 광고 → 종합사주', path: '/premium', source: 'meta', content: 'V4_toss', campaign: 'e39' },
  { label: '메타 광고 → 2027 신년운세', path: '/tojung', source: 'meta', content: 'NY_toss', campaign: 'e39' },
  { label: '작가 스토리 → 종합사주', path: '/premium', source: 'creator', content: '', campaign: 'e37' },
];
const TAG_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function TossLinkMaker({ onToast, colors }: { onToast: (msg: string, kind: 'success' | 'warning') => void; colors: { gold: string; ink: string; paper: string } }) {
  const [pick, setPick] = useState(0);
  const [tag, setTag] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const p = PRESETS[pick];

  const make = async () => {
    if (busy) return;
    const content = p.content || tag.trim();
    if (!TAG_RE.test(content)) { onToast('꼬리표는 영어, 숫자, 밑줄로 적어 주세요(예: kim_story1)', 'warning'); return; }
    if (!isAppsInToss()) { onToast('토스 앱 안에서만 만들 수 있어요', 'warning'); return; }
    setBusy(true);
    try {
      const { getTossShareLink, share } = await import('@apps-in-toss/web-framework');
      const qs = new URLSearchParams({ utm_source: p.source, utm_medium: 'paid', utm_campaign: p.campaign, utm_content: content });
      const url = await getTossShareLink(`intoss://saju-500${p.path}?${qs.toString()}`, 'https://saju500.app/og-image.png');
      setLink(String(url || ''));
      try { await share({ message: String(url || '') }); } catch { /* 공유 창을 닫아도 링크는 화면에 남는다 */ }
    } catch (e: any) {
      onToast(`링크를 만들지 못했어요: ${String(e?.message || e).slice(0, 60)}`, 'warning');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <p className="text-[13.5px] font-bold mb-2" style={{ color: colors.gold }}>광고, 작가용 토스 링크 만들기</p>
      <p className="text-[13px] mb-2" style={{ color: 'rgba(248,245,238,0.6)' }}>
        누르면 토스 앱으로 바로 열리는 링크가 만들어지고 공유 창이 떠요. 카카오톡 '나에게'로 보내 광고나 스토리에 넣으세요.
      </p>
      <div className="flex flex-col gap-2 mb-2">
        {PRESETS.map((x, i) => (
          <button key={x.label} type="button" onClick={() => { setPick(i); setLink(''); }}
            className="w-full py-2 rounded-xl text-[13px] font-bold"
            style={{ background: pick === i ? colors.gold : 'rgba(255,255,255,0.1)', color: pick === i ? colors.ink : colors.paper }}>
            {x.label}
          </button>
        ))}
      </div>
      {!p.content && (
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="작가 꼬리표 (예: kim_story1)" aria-label="작가 꼬리표"
          className="w-full rounded-xl text-[14px] mb-2" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.08)', color: colors.paper, border: '1px solid rgba(255,255,255,0.2)' }} />
      )}
      <button type="button" onClick={make} disabled={busy}
        className="w-full py-3 rounded-xl text-[13px] font-bold"
        style={{ background: colors.gold, color: colors.ink, opacity: busy ? 0.5 : 1 }}>
        {busy ? '만드는 중' : '링크 만들기'}
      </button>
      {link && (
        <p className="text-[13px] mt-2" style={{ color: colors.paper, wordBreak: 'break-all', userSelect: 'all' }}>{link}</p>
      )}
    </div>
  );
}
