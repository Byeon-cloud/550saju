/**
 * 띠별 운세 한 장 판 (2026-10-19) — 오늘의 띠별 운세(/tti)와 2027 띠별 신년운세(/tti/2027)가 같이 쓴다.
 *   3 x 4 칸: 사주500 띠 그림, 띠 이름, 좋음/보통/조심(칸 바탕색), 한 문장(굵게). 폰 한 화면(탭 바 위)에 다 들어가게 맞춘 크기.
 *   출처는 머리의 '사주500' 하나(오너: 아래 주소 줄 필요 없음). 캡처, 이미지 보내기 대상은 이 판 전체.
 */
import { forwardRef, type ReactNode } from 'react';
import { HJ, SERIF } from '@/components/hanji/Hanji';
import { moVars } from '@/components/motion/Motion';
import { TtiAnimal } from '@/components/tti/TtiAnimal';
import type { DayMark } from '@/services/tti/ttiFortune';

export const MARK_COLOR: Record<DayMark, string> = { 좋음: HJ.ink, 보통: HJ.mute, 조심: '#A23A2A' };
/** 칸 바탕 — 좋음은 따뜻한 종이, 조심은 옅은 낙관 빛 (금색은 버튼에만이라 쓰지 않는다) */
export const CELL_TONE: Record<DayMark, { bg: string; line: string }> = {
  좋음: { bg: '#F4ECD8', line: '#DCCBA6' },
  보통: { bg: '#FFFDF8', line: '#E1D7C4' },
  조심: { bg: '#F8EAE5', line: '#E6C6BC' },
};

export interface BoardRow { ji: string; name: string; mark: DayMark; line: string; years: string }

export const TtiBoardCard = forwardRef<HTMLDivElement, {
  seal: ReactNode; title: string; sub: string; rows: BoardRow[]; sel: string | null; onPick: (ji: string) => void; foot?: string;
}>(function TtiBoardCard({ seal, title, sub, rows, sel, onPick, foot }, ref) {
  return (
    <div ref={ref} style={{ background: HJ.paper, padding: '6px 12px 4px' }}>
      <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '12px 14px 8px' }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          {seal}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>{title}</div>
            <div style={{ fontSize: 13.5, color: HJ.ink2, marginTop: 2 }}>{sub}</div>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 900, color: HJ.ink, flexShrink: 0 }}>
            사주<span style={{ color: '#8C6D3D' }}>500</span>
          </div>
        </div>

        <div className="grid grid-cols-3" style={{ gap: 5, marginTop: 8 }}>
          {rows.map((r, i) => {
            const tone = CELL_TONE[r.mark];
            return (
              <button key={r.ji} type="button" onClick={() => onPick(r.ji)} className="mo-rise"
                aria-pressed={sel === r.ji} aria-label={`${r.name} ${r.mark}, ${r.line}`}
                style={{
                  ...moVars({ i, d: 80 }),
                  position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '5px 4px 7px', borderRadius: 12, textAlign: 'center',
                  background: tone.bg, border: `${sel === r.ji ? 2 : 1}px solid ${sel === r.ji ? HJ.ink : tone.line}`,
                }}>
                <span style={{ position: 'absolute', top: 5, right: 7, fontSize: 13, fontWeight: 800, color: MARK_COLOR[r.mark] }}>{r.mark}</span>
                <TtiAnimal ji={r.ji} size={40} />
                <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: HJ.ink, marginTop: 2, whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: '#2E2720', marginTop: 3, wordBreak: 'keep-all' }}>{r.line}</span>
              </button>
            );
          })}
        </div>

        <div style={{ paddingTop: 8, fontSize: 13, color: HJ.mute, textAlign: 'center' }}>
          {foot ?? '양력 2월 4일 무렵(입춘) 전에 태어났다면 앞 해의 띠로 보세요'}
        </div>
      </div>
    </div>
  );
});

/** 판 보내기 — 앱(토스)은 토스 공유 링크, 웹은 판 이미지(없으면 링크). 성공 문구는 돌려준다 */
export async function shareBoard(opts: {
  boardEl: HTMLElement | null; inAppPath: string; ogImage: string; message: string; fileName: string; webUrl: string; type: string;
}): Promise<{ ok: boolean; message?: string; canceled?: boolean }> {
  const { isAppsInToss } = await import('@/services/payment/iapService');
  const { trackEvent } = await import('@/services/analytics');
  trackEvent('cta_click', { label: `${opts.type} 보내기`, page: window.location.pathname });
  if (isAppsInToss()) {
    // 앱(토스)은 이미지를 바로 보낼 수 없어 토스 공유 링크 (사주 카드와 같은 방식)
    const { share, getTossShareLink } = await import('@apps-in-toss/web-framework');
    const link = await getTossShareLink(`intoss://saju-500${opts.inAppPath}`, opts.ogImage);
    await share({ message: [opts.message, link].join('\n') });
    trackEvent('share_complete', { type: opts.type, method: 'toss_share', rewarded: 0 });
    return { ok: true };
  }
  const { captureSajuCardAsBlob, shareSajuCardImage } = await import('@/components/saju-card/SajuCardExport');
  const blob = await captureSajuCardAsBlob({ element: opts.boardEl ?? undefined, scale: 3, backgroundColor: HJ.paper });
  const r = await shareSajuCardImage(blob, opts.fileName, opts.message, opts.webUrl, opts.type);
  return { ok: r.ok, message: r.message, canceled: r.via === 'canceled' };
}
