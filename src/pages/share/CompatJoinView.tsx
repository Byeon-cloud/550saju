/**
 * 받은 궁합 초대장 (2026-10-18, 시험 E21) — /share/cjoin/{id}
 *
 *   보낸 사람 이름과 관계만 보이고, 내 생일을 넣으면 서버가 규칙 계산으로 궁합 점수와 잘 맞는 점, 부딪히는 점을 만든다(AI 없음).
 *   두 사람 모두 무료로 본다. 전체 풀이(3운)는 지금 궁합 결과 화면으로 보낸다(상대 사주는 생년월일 없이 서버가 넘겨준다).
 *   내 생일은 보낸 사람에게 보이지 않는다. 초대 링크(inv)로 처음 온 사람이면 아래에 친구 초대 선물 카드도 보인다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { GoldCta, GhostButton, SectionHead, INK_HERO_BG, SERIF, HJ } from '@/components/hanji/Hanji';
import { useToast } from '@/components/common/Toast';
import { getProfiles, getMyProfile, spendBalance, markPendingSpend } from '@/services/storage/localStore';
import { PRODUCT_COST } from '@/constants/pricing';
import { getCompatInvite, answerCompatInvite, type InviteView, type QuickCompat } from '@/services/share/compatInvite';
import { InviteWelcomeCard } from '@/components/invite/InviteWelcomeCard';

import { realName } from '@/utils/personName';
export function CompatJoinView({ id }: { id: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const profiles = useMemo(() => getProfiles(), []);
  const preId = (location.state as any)?.profileId as string | undefined;
  const [pick, setPick] = useState<string>(() => preId || (getMyProfile() as any)?.id || profiles[0]?.id || '');
  const [view, setView] = useState<InviteView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuickCompat | null>(null);
  const [other, setOther] = useState<any>(null);
  const cost = (PRODUCT_COST as any)?.compatibility ?? 3;

  useEffect(() => {
    import('@/services/analytics').then((a) => a.trackEvent('share_view', { type: 'cjoin' })).catch(() => {});
    getCompatInvite(id).then((v) => {
      setView(v);
      if (v?.result) setResult(v.result);
      if (v?.other) setOther(v.other);
    }).catch(() => setView(null)).finally(() => setLoaded(true));
  }, [id]);

  const me = profiles.find((p) => p.id === pick) || null;

  async function answer() {
    if (!me || busy) return;
    setBusy(true);
    try {
      const r = await answerCompatInvite(id, me.name || '나', me.sajuData);
      if (r.ok && r.result) {
        setResult(r.result);
        setOther(r.other || null);
        import('@/services/analytics').then((a) => a.trackEvent('cjoin_answer', { score: r.result!.score })).catch(() => {});
      } else {
        const msg: Record<string, string> = { self: '내가 보낸 초대장이에요', taken: '이미 다른 분이 답한 초대장이에요', gone: '기한이 지난 초대장이에요', no_saju: '사주를 다시 골라 주세요' };
        toast.show(msg[r.reason || ''] || '잠시 뒤 다시 눌러 주세요', 'info');
      }
    } catch {
      toast.show('잠시 뒤 다시 눌러 주세요', 'warning');
    } finally {
      setBusy(false);
    }
  }

  // 2026-10-26 — 두 번 누름 막기. 화면 전환 애니메이션(0.12초) 동안 이 화면이 남아 눌려서 3운이 두 번 빠지고
  //   두 번째 3운은 돌아오지 않았다(궁합 화면의 isSubmittingRef 와 같은 막기). 충전에 다녀와 다시 누를 수 있게 1초 뒤 푼다
  const fullBusyRef = useRef(false);
  function fullReading() {
    if (!me || !other || fullBusyRef.current) return;
    fullBusyRef.current = true;
    setTimeout(() => { fullBusyRef.current = false; }, 1000);
    if (!spendBalance(cost)) {
      navigate('/charge', { state: { from: 'compat', message: `궁합 전체 풀이에 ${cost}운이 필요해요`, returnTo: `/share/cjoin/${id}` } });
      return;
    }
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'compat', amount: cost, via: 'cjoin' })).catch(() => {});
    // 2026-10-26 — 장부 id 를 결과 화면에 넘긴다 (결과 화면은 이 장부가 있을 때만 생성하고 이 건만 정리한다)
    const pendingId = markPendingSpend('compat', cost);
    const n1 = realName(view?.n1) || realName(other?.input?.name) || '상대';
    navigate('/compat/result', {
      state: {
        person1: me,
        person2: { id: `cj_${id}`, name: n1, sajuData: other, input: other?.input || { name: n1 } },
        relation: view?.rel || '연인',
        cost,
        pendingId,
      },
    });
  }

  if (!loaded) return <div className="min-h-screen" style={{ background: HJ.paper }} />;
  const n1 = view?.n1 || '';
  const relText = view?.rel ? `${view.rel} 사이 ` : '';

  return (
    <div className="min-h-screen" style={{ background: HJ.paper }}>
      <div className="h-safe-top" />
      <div style={{ background: INK_HERO_BG, color: '#F4EFE4', padding: '30px 20px 26px' }}>
        <p style={{ fontSize: 14, color: '#CFC6B6', fontWeight: 700 }}>받은 궁합 초대장</p>
        <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 25, lineHeight: 1.45, margin: '8px 0 6px', wordBreak: 'keep-all' }}>
          {view?.ok ? `${realName(n1) ? `${realName(n1)} 님이` : '친구가'} 두 분 ${relText}궁합을 보고 싶어 해요` : '궁합 초대장을 찾지 못했어요'}
        </h1>
        {view?.ok && !result && <p style={{ fontSize: 15, color: '#E4DCCD', lineHeight: 1.6 }}>내 사주를 고르면 두 분 모두 궁합 점수와 한 줄 풀이를 무료로 봐요. 내 생일은 {realName(n1) ? `${realName(n1)} 님에게` : '상대에게'} 보이지 않아요.</p>}
      </div>

      <div className="px-5 pt-5 pb-12 space-y-5">
        {!view?.ok && (
          <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px 18px', fontSize: 15, color: HJ.ink2, lineHeight: 1.7 }}>
            기한(30일)이 지났거나 지워진 초대장이에요. 궁합은 내 사주로 직접 볼 수 있어요.
            <GhostButton style={{ marginTop: 12 }} sub={`${cost}운`} onClick={() => navigate('/compat')}>궁합 보러 가기</GhostButton>
          </div>
        )}

        {view?.ok && view.mine && !result && (
          <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px 18px', fontSize: 15, color: HJ.ink2, lineHeight: 1.7 }}>
            내가 보낸 초대장이에요. 상대가 생일을 넣으면 궁합 화면에서 알려 드려요.
          </div>
        )}

        {view?.ok && !view.mine && !result && view.status === 'answered' && (
          <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px 18px', fontSize: 15, color: HJ.ink2, lineHeight: 1.7 }}>
            이미 다른 분이 답한 초대장이에요.
            <GhostButton style={{ marginTop: 12 }} sub={`${cost}운`} onClick={() => navigate('/compat')}>내 궁합 보러 가기</GhostButton>
          </div>
        )}

        {view?.ok && !view.mine && !result && view.status === 'open' && (
          <FadeIn>
            <SectionHead no={1} title="내 사주 고르기" />
            {profiles.length > 0 ? (
              <div className="space-y-2">
                {profiles.slice(0, 6).map((p) => (
                  <button key={p.id} type="button" onClick={() => setPick(p.id)} className="w-full text-left"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: HJ.card, borderRadius: 12, padding: '13px 16px',
                      border: `1px solid ${pick === p.id ? HJ.ink : HJ.line}` }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700, color: HJ.ink }}>{p.name}</span>
                    <span style={{ fontSize: 13.5, color: HJ.mute }}>{(p as any).relation || ''}{pick === p.id ? ', 선택됨' : ''}</span>
                  </button>
                ))}
                <button type="button" onClick={() => navigate('/input?new=1', { state: { returnTo: `/share/cjoin/${id}` } })}
                  style={{ fontSize: 14.5, fontWeight: 700, color: HJ.goldText, padding: '8px 2px', background: 'none', border: 0 }}>
                  다른 생일 넣기
                </button>
                <GoldCta style={{ marginTop: 8 }} sub="무료" onClick={answer} disabled={busy || !me}>
                  {busy ? '궁합을 보는 중이에요' : `${me?.name || '내'} 님 사주로 궁합 보기`}
                </GoldCta>
              </div>
            ) : (
              <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px 18px' }}>
                <p style={{ fontSize: 15, color: HJ.ink2, lineHeight: 1.7 }}>생년월일만 넣으면 돼요. 넣은 생일은 이 기기에 저장되고, {realName(n1) ? `${realName(n1)} 님에게는` : '상대에게는'} 보이지 않아요.</p>
                <GoldCta style={{ marginTop: 12 }} sub="무료" onClick={() => navigate('/input?new=1', { state: { returnTo: `/share/cjoin/${id}` } })}>내 생일 넣기</GoldCta>
              </div>
            )}
          </FadeIn>
        )}

        {result && (
          <FadeIn>
            <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '20px 18px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13.5, color: HJ.mute, fontWeight: 700 }}>{view?.mine ? `${view?.n2 || '상대'} 님과의 궁합` : `${realName(n1) ? `${realName(n1)} 님과의` : '친구와의'} 궁합`}</p>
              <p style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 900, color: HJ.ink, lineHeight: 1.2, marginTop: 4 }}>
                {result.score}<span style={{ fontSize: 20, marginLeft: 3 }}>점</span>
              </p>
              <p style={{ fontSize: 15.5, color: HJ.ink2, lineHeight: 1.65, marginTop: 6 }}>{result.head}</p>
            </div>
            <div style={{ marginTop: 14 }}>
              <SectionHead no={1} title="잘 맞는 점" />
              <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '6px 16px' }}>
                {result.good.map((g, i) => <p key={i} style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2, padding: '9px 0', borderTop: i ? `1px solid ${HJ.line}` : 0 }}>{g}</p>)}
              </div>
            </div>
            {result.care.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <SectionHead no={2} title="부딪히는 점" />
                <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '6px 16px' }}>
                  {result.care.map((g, i) => <p key={i} style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2, padding: '9px 0', borderTop: i ? `1px solid ${HJ.line}` : 0 }}>{g}</p>)}
                </div>
              </div>
            )}
            <p style={{ fontSize: 13.5, color: HJ.mute, lineHeight: 1.7, marginTop: 12 }}>
              두 분의 태어난 날 기운과 띠, 오행으로 계산한 점수예요. 전체 풀이에서는 성격, 가치관, 소통, 감정, 미래 다섯 가지 점수와 앞으로 1~3년 흐름, 구체적인 조언까지 볼 수 있어요.
            </p>
            <div className="space-y-3" style={{ marginTop: 14 }}>
              {other && me && <GoldCta sub={`${cost}운`} onClick={fullReading}>두 분 전체 궁합 풀이 보기</GoldCta>}
              <GhostButton sub="하루 한 번 무료" onClick={() => navigate('/daily?utm_source=share&utm_medium=cjoin&utm_campaign=cjoin_daily')}>내 사주로 오늘의 운세 보기</GhostButton>
            </div>
          </FadeIn>
        )}

        <InviteWelcomeCard />
      </div>
    </div>
  );
}
