/**
 * 신년운세 무료 미리 보기 카드 (2026-10-17) — 사람을 고르면 결제 버튼 위에 보인다.
 *
 *   그 해가 내 사주에 어떤 해인지(세운 판정), 도움이 큰 달과 부담이 큰 달, 한 해 꼭 기억할 날 가운데 첫 날.
 *   계산은 services/saju/newYearPreview.ts(서버 신년운세와 같은 계산) → 결제 뒤 풀이와 어긋나지 않는다. AI 0원.
 *   2026-10-18 '이 미리 보기 보내기' — 받는 사람은 /share/newyear/{id} 에서 같은 표를 본다(NewYearShareView). 생일과 사주는 보내지 않는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { GhostButton, HJ, SERIF } from '@/components/hanji/Hanji';
import { useToast } from '@/components/common/Toast';
import { newYearPreview, ganziKo } from '@/services/saju/newYearPreview';
import type { SajuData } from '@/types/saju';

export const ROLE_PLAIN: Record<string, string> = {
  용신: '나에게 필요한 기운', 희신: '도움이 되는 기운', 기신: '부담이 되는 기운', 중립: '크게 상관없는 기운',
};

export function yearSentence(verdict: string): string {
  switch (verdict) {
    case '도움 기운이 강한 해': return '도움 기운이 강하게 들어오는 해예요. 미뤄 둔 일을 시작하기 좋아요.';
    case '도움과 부담이 섞인 해': return '도움과 부담이 함께 오는 해예요. 어느 달에 힘을 줄지가 중요해요.';
    case '도움 기운이 들어오는 해': return '도움 기운이 들어오는 해예요. 좋은 달에 맞춰 움직이면 힘을 덜 들이고 갈 수 있어요.';
    case '부담 기운이 강한 해': return '부담 기운이 강한 해예요. 그래서 힘을 줄 달과 쉬어 갈 달을 미리 알아 두면 좋아요.';
    default: return '크게 기울지 않는 무난한 해예요. 달마다 흐름을 보고 움직이면 좋아요.';
  }
}
export const months = (arr: number[]) => arr.map((m) => `${m}월`).join(', ');
/** 오행 이름 뒤 은/는 (목, 금은 받침이 있다) */
export const topic = (o: string) => (o === '목' || o === '금' ? '은' : '는');

export function NewYearPreviewCard({ year, name, sajuData }: { year: number; name: string; sajuData: SajuData | null | undefined }) {
  const pv = useMemo(() => newYearPreview(year, sajuData), [year, sajuData]);
  const boxRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!pv) return;
    // 사람을 고르면 카드가 결제 버튼 아래에 가려져 있었다 → 화면 가운데로
    const t = window.setTimeout(() => boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    import('@/services/analytics').then((a) => a.trackEvent('tojung_preview_view', { y: year, v: pv.year?.verdict || '' })).catch(() => {});
    return () => window.clearTimeout(t);
  }, [pv]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pv || !pv.year) return null;
  const { yearGz, year: yv, goodMonths, goodLabel, hardMonths, keyDates } = pv;
  const first = keyDates[0];

  async function send() {
    if (sending || !pv?.year) return;
    setSending(true);
    try {
      const { createNewYearShareId } = await import('@/services/share/newYearShare');
      const id = await createNewYearShareId({
        name, y: year, gz: yearGz, verdict: yv.verdict, g: yv.g, b: yv.b, r1: yv.r1, r2: yv.r2,
        good: goodMonths, goodLabel, hard: hardMonths, km: first?.m || 0, kd: first?.d || 0, kn: keyDates.length,
      }, `${name}-${year}-${yearGz}-${goodMonths.join('.')}-${hardMonths.join('.')}`);
      const { shareNewYearLink } = await import('@/utils/share');
      const via = await shareNewYearLink({ id, name, year });
      if (via === 'clipboard') toast.show('링크를 복사했어요. 카카오톡이나 문자에 붙여 넣어 보내세요', 'success');
    } catch (e) {
      console.warn('[newyear] 보내기 링크 실패', e);
      toast.show('링크를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요', 'warning');
    } finally {
      setSending(false);
    }
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', gap: 14, padding: '11px 2px', borderBottom: `1px solid ${HJ.line}` }}>
      <span style={{ flexShrink: 0, minWidth: 96, fontSize: 14.5, fontWeight: 700, color: HJ.ink }}>{label}</span>
      <span style={{ fontSize: 15, lineHeight: 1.6, color: HJ.ink2 }}>{value}</span>
    </div>
  );

  return (
    <div ref={boxRef} style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '18px 18px 16px', marginBottom: 120 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: HJ.mute }}>무료 미리 보기</p>
      <h3 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, lineHeight: 1.45, marginTop: 4, color: HJ.ink }}>
        {name} 님의 {year} {ganziKo(yearGz)}({yearGz})년
      </h3>
      <p style={{ fontSize: 15, lineHeight: 1.75, color: HJ.ink2, marginTop: 8 }}>
        {year}년은 {name} 님에게 {yearSentence(yv.verdict)}
      </p>
      <p style={{ fontSize: 13.5, lineHeight: 1.7, color: HJ.mute, marginTop: 6 }}>
        {yearGz[0]}({yv.g}){topic(yv.g)} {ROLE_PLAIN[yv.r1]}이고, {yearGz[1]}({yv.b}){topic(yv.b)} {ROLE_PLAIN[yv.r2]}이에요.
      </p>
      <div style={{ marginTop: 12, borderTop: `1px solid ${HJ.line}` }}>
        {goodMonths.length > 0 && <Row label={goodLabel === '도움 기운이 강한 달' ? '힘을 줄 달' : '도움이 오는 달'} value={months(goodMonths)} />}
        <Row label="쉬어 갈 달" value={hardMonths.length ? months(hardMonths) : '크게 조심할 달은 없어요'} />
        {first && <Row label="꼭 기억할 날" value={`${first.m}월 ${first.d}일${keyDates.length > 1 ? ` 외 ${keyDates.length - 1}일` : ''}`} />}
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.7, color: HJ.mute, marginTop: 10 }}>
        달마다 할 일, 좋은 날과 조심할 날 날짜, 결정하기 좋은 때는 {year} 신년운세에서 볼 수 있어요.
      </p>
      <GhostButton style={{ marginTop: 12 }} onClick={send}>
        {sending ? '링크를 만드는 중이에요' : '이 미리 보기 보내기'}
      </GhostButton>
      <p style={{ fontSize: 13, color: HJ.mute, textAlign: 'center', marginTop: 6 }}>생일과 사주는 보내지 않아요</p>
    </div>
  );
}
