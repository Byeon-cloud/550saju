/**
 * 궁합 화면의 '상대에게 생일 넣어 달라고 보내기'와 '보낸 궁합 초대장' (2026-10-18, 시험 E21)
 *   상대 생일을 몰라도 궁합을 시작할 수 있게. 상대가 답하면 두 사람 모두 무료 점수와 한 줄 풀이를 보고,
 *   나는 여기서 바로 전체 풀이(3운)로 갈 수 있다. 상대 생년월일은 나에게 오지 않는다(서버가 생년월일 없는 사주만 준다).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HJ, SERIF } from '@/components/hanji/Hanji';
import { useToast } from '@/components/common/Toast';
import { spendBalance, markPendingSpend } from '@/services/storage/localStore';
import { PRODUCT_COST } from '@/constants/pricing';
import { createCompatInvite, listMyCompatInvites, hasSentCompatInvite, type MyInvite } from '@/services/share/compatInvite';

export function CompatInviteBox({ me, relation }: { me: any | null; relation: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<MyInvite[]>([]);
  const cost = (PRODUCT_COST as any)?.compatibility ?? 3;

  useEffect(() => {
    if (!hasSentCompatInvite()) return;
    listMyCompatInvites(true).then((r) => {
      setItems(r.items || []);
      const fresh = (r.items || []).filter((x) => x.fresh);
      if (fresh.length) toast.show(`${fresh[0].n2 || '상대'} 님이 생일을 넣었어요. 궁합 ${fresh[0].score}점이에요`, 'success');
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (busy) return;
    if (!me?.sajuData) { toast.show('먼저 왼쪽에서 내 사주를 골라 주세요', 'info'); return; }
    setBusy(true);
    try {
      const id = await createCompatInvite({ name: me.name || '나', sajuData: me.sajuData, relation: relation || '' });
      const { shareCompatInviteLink } = await import('@/utils/share');
      const via = await shareCompatInviteLink({ id, n1: me.name || '나' });
      if (via === 'clipboard') toast.show('링크를 복사했어요. 카카오톡이나 문자에 붙여 넣어 보내세요', 'success');
      setItems((prev) => [{ id, rel: relation || '', status: 'open' as const, n2: '', score: null, head: '', good: [], care: [], createdAtMs: Date.now(), other: null, fresh: false }, ...prev].slice(0, 10));
    } catch (e: any) {
      toast.show(String(e?.message || '').includes('오늘은') ? '오늘은 더 보낼 수 없어요. 내일 다시 보내 주세요' : '링크를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요', 'warning');
    } finally {
      setBusy(false);
    }
  }

  // 2026-10-26 — 두 번 누름 막기. 화면 전환 애니메이션(0.12초) 동안 이 버튼이 남아 눌려서 3운이 두 번 빠지고
  //   두 번째 3운은 돌아오지 않았다. 충전에 다녀와 다시 누를 수 있게 1초 뒤 푼다
  const fullBusyRef = useRef(false);
  function full(it: MyInvite) {
    if (fullBusyRef.current) return;
    if (!me?.sajuData || !it.other) { toast.show('먼저 왼쪽에서 내 사주를 골라 주세요', 'info'); return; }
    fullBusyRef.current = true;
    setTimeout(() => { fullBusyRef.current = false; }, 1000);
    if (!spendBalance(cost)) {
      navigate('/charge', { state: { from: 'compat', message: `궁합 분석에 ${cost}운이 필요해요`, returnTo: window.location.pathname + window.location.search } });
      return;
    }
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'compat', amount: cost, via: 'cjoin_sender' })).catch(() => {});
    // 2026-10-26 — 장부 id 를 결과 화면에 넘긴다 (결과 화면은 이 장부가 있을 때만 생성하고 이 건만 정리한다)
    const pendingId = markPendingSpend('compat', cost);
    const n2 = it.n2 || it.other?.input?.name || '상대';
    navigate('/compat/result', { state: { person1: me, person2: { id: `cj_${it.id}`, name: n2, sajuData: it.other, input: it.other?.input || { name: n2 } }, relation: it.rel || relation || '연인', cost, pendingId } });
  }

  return (
    <div className="space-y-3">
      <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px 18px' }}>
        <p style={{ fontSize: 15.5, fontWeight: 700, color: HJ.ink }}>상대 생일을 모르세요?</p>
        <p style={{ fontSize: 14, color: HJ.mute, lineHeight: 1.65, marginTop: 4 }}>
          링크를 보내면 상대가 직접 생일을 넣어요. 두 분 모두 궁합 점수와 한 줄 풀이를 무료로 보고, 상대 생일은 나에게 보이지 않아요.
        </p>
        <button type="button" onClick={send} disabled={busy}
          style={{ marginTop: 12, width: '100%', height: 48, borderRadius: 12, border: `1px solid ${HJ.ink}`, background: 'transparent', color: HJ.ink, fontSize: 15.5, fontWeight: 700 }}>
          {busy ? '링크를 만드는 중이에요' : '상대에게 생일 넣어 달라고 보내기'}
        </button>
      </div>
      {items.length > 0 && (
        <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '6px 16px' }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: HJ.mute, padding: '10px 0 4px' }}>보낸 궁합 초대장</p>
          {items.map((it, i) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: i ? `1px solid ${HJ.line}` : 0 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: HJ.ink }}>
                  {it.status === 'answered' ? `${it.n2 || '상대'} 님` : '답을 기다리는 중'}{it.rel ? `, ${it.rel}` : ''}
                </p>
                {it.status === 'answered' && it.head && <p style={{ fontSize: 13.5, color: HJ.mute, marginTop: 2 }}>{it.head}</p>}
              </div>
              {it.status === 'answered' && it.score != null && (
                <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 900, color: HJ.ink }}>{it.score}<small style={{ fontSize: 13, marginLeft: 2 }}>점</small></span>
              )}
              {it.status === 'answered' && (
                <button type="button" onClick={() => full(it)} style={{ fontSize: 14, fontWeight: 700, color: HJ.goldText, background: 'none', border: 0, padding: '0 8px', minHeight: 44 /* 2026-10-26 누르는 칸 44px (예전 약 33px) */ }}>
                  전체 풀이 {cost}운
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
