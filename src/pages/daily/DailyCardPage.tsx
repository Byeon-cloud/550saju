/**
 * 오늘 운세 한 장 (2026-10-19) — /daily/card (오늘의 운세 결과의 '친구에게 공유하기'에서 연다)
 *
 *   오너(10-19): 사주 카드가 퍼진 이유는 한 캡처. 오늘의 운세 결과는 길어서 캡처 한 장에 담기지 않는다.
 *   그래서 결과의 핵심만 폰 한 화면에: 이름, 날짜, 일진, 제목과 한 줄, 네 영역 점수, 좋은 때와 조심할 때, 할 일과 피할 일, 행운.
 *   결과 화면(목업)은 그대로 두고 이 화면으로 보낸다. 값은 결과에 있는 것만(지어내지 않음). 결과가 없으면 /daily 로.
 *   보내기: 앱은 토스 공유 링크(받는 사람은 자기 오늘의 운세로), 웹은 이 판 이미지.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { HJ, SERIF, Seal, GoldCta } from '@/components/hanji/Hanji';
import { shareBoard } from '@/components/tti/TtiBoardCard';
import { useToast } from '@/components/common/Toast';
import { trackEvent } from '@/services/analytics';
import { stripMd } from '@/utils/format';

export interface DailyCardState { result: any; name: string; dateLabel: string; ganzi: string; ganziKo: string; savedReport?: any }

const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const plain = (t: unknown): string => stripMd(String(t ?? '')).replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^<>]*>/g, '').trim();
const AREAS: Array<{ key: string; nm: string; han: string }> = [
  { key: 'wealth', nm: '재물', han: '財' }, { key: 'love', nm: '관계', han: '緣' },
  { key: 'career', nm: '일', han: '業' }, { key: 'health', nm: '건강', han: '身' },
];

export function DailyCardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const st = (useLocation().state || null) as DailyCardState | null;
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!st?.result) navigate('/daily', { replace: true }); }, [st, navigate]);
  if (!st?.result) return null;

  const r = st.result;
  const name = (st.name || '').trim() || '나';
  const title = plain(r.title) || '오늘의 운세';
  const head = plain(r.scoreHeadline || r.headline || r.myToday);
  const score = (k: string): string => {
    const v = Number(r?.subScores?.[k]);
    return r?.subScores?.[k] === undefined || r?.subScores?.[k] === null || !Number.isFinite(v) ? '' : (Math.max(0, Math.min(100, v)) / 10).toFixed(1);
  };
  const hasScores = AREAS.some((a) => score(a.key));
  const peak = plain(r?.hourlyPeak?.range);
  const avoid = plain(r?.hourlyAvoid?.range);
  const firstAct = (list: any): string => {
    const d = Array.isArray(list) ? list[0] : null;
    return plain(typeof d === 'string' ? d : d?.action);
  };
  const doOne = firstAct(r.doList);
  const dontOne = firstAct(r.dontList);
  const lp = r?.luckyProfile || {};
  const lucky: Array<{ k: string; v: string; hex?: string }> = [
    { k: '색', v: plain(lp?.color?.name), hex: typeof lp?.color?.hex === 'string' ? lp.color.hex : undefined },
    { k: '숫자', v: plain(lp?.number?.value ?? lp?.number) },
    { k: '방위', v: plain(lp?.direction?.value ?? lp?.direction) },
  ].filter((x) => x.v);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await shareBoard({
        boardEl: cardRef.current, inAppPath: '/daily', ogImage: 'https://saju500.app/og/daily.jpg',
        message: `${name} 님의 오늘 운세예요. 내 사주로도 무료로 볼 수 있어요`,
        fileName: `오늘의_운세_${name}.png`,
        webUrl: 'https://saju500.app/daily?utm_source=share&utm_medium=image&utm_campaign=daily_card', type: 'daily_card',
      });
      if (res.message && !res.canceled) toast.show(res.message, res.ok ? 'success' : 'warning');
    } catch {
      toast.show('보내기를 열지 못했어요. 화면을 캡처해서 보내도 돼요', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ k, children, warn }: { k: string; children: React.ReactNode; warn?: boolean }) => (
    <div className="flex" style={{ gap: 10, padding: '7px 0', borderTop: `1px solid ${HJ.line}` }}>
      <span style={{ width: 70, flexShrink: 0, fontSize: 14, fontWeight: 800, color: warn ? '#A23A2A' : HJ.ink }}>{k}</span>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 600, lineHeight: 1.45, color: '#2E2720' }}>{children}</span>
    </div>
  );

  return (
    <div style={{ background: HJ.paper, minHeight: '100vh', paddingBottom: 112, color: HJ.ink }}>
      <Header title="오늘 운세 한 장" />

      {/* ── 한 장 (캡처, 보내기 대상) ── */}
      <div ref={cardRef} style={{ background: HJ.paper, padding: '6px 12px 4px' }}>
        <div className="mo-ink" style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '14px 16px 10px' }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            {st.ganzi && <Seal size={36} fontSize={15} stamp>{st.ganzi}</Seal>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: HJ.ink2 }}>{name} 님 오늘의 운세</div>
              <div style={{ fontSize: 13.5, color: HJ.mute, marginTop: 1 }}>{st.dateLabel}{st.ganzi?.length === 2 ? `, ${GAN_KO[st.ganzi[0]] || ''}${ZHI_KO[st.ganzi[1]] || ''}(${st.ganzi})일` : ''}</div>
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 900, color: HJ.ink, flexShrink: 0 }}>
              사주<span style={{ color: '#8C6D3D' }}>500</span>
            </div>
          </div>

          <h1 style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-.02em', marginTop: 12 }}>{title}</h1>
          {head && <p style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.55, color: '#2E2720', marginTop: 6 }}>{head}</p>}

          {hasScores && (
            <div className="grid grid-cols-4" style={{ gap: 6, marginTop: 12 }}>
              {AREAS.map((a) => (
                <div key={a.key} style={{ background: HJ.paper, border: `1px solid ${HJ.line}`, borderRadius: 12, padding: '7px 2px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: HJ.mute }}>{a.nm}</div>
                  <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 900, color: HJ.ink, lineHeight: 1.2 }}>{score(a.key) || '—'}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {peak && <Row k="좋은 때">{peak}</Row>}
            {avoid && <Row k="조심할 때" warn>{avoid}</Row>}
            {doOne && <Row k="할 일">{doOne}</Row>}
            {dontOne && <Row k="피할 일" warn>{dontOne}</Row>}
            {lucky.length > 0 && (
              <Row k="행운">
                {lucky.map((l, i) => (
                  <span key={l.k} style={{ whiteSpace: 'nowrap' }}>
                    {i > 0 && ', '}
                    {l.hex && <span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: l.hex, border: `1px solid ${HJ.line}`, marginRight: 4, verticalAlign: -1 }} />}
                    {l.k} {l.v}
                  </span>
                ))}
              </Row>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 12px' }}>
        <GoldCta style={{ marginTop: 16 }} onClick={share}>{busy ? '준비 중이에요' : '가족, 친구에게 보내기'}</GoldCta>
        <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 8 }}>화면을 그대로 캡처해서 보내도 돼요</p>
        <button type="button" className="w-full"
          onClick={() => {
            trackEvent('cta_click', { label: '오늘 한 장에서 결과로', page: '/daily/card' });
            // 10-19 검토: 뒤로 가기만 하면 /daily 가 고르는 화면으로 열렸다 → 오늘 기록을 넘겨 결과로 바로
            if (st.savedReport) navigate('/daily', { replace: true, state: { savedResult: st.result, savedReport: st.savedReport } });
            else navigate(-1);
          }}
          style={{ marginTop: 10, padding: '10px 0', fontSize: 14.5, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
          오늘 운세 전체로 돌아가기 ›
        </button>
      </div>
    </div>
  );
}
