/**
 * 오늘의 띠별 운세 한 장 (2026-10-19) — /tti
 *
 *   오너(10-19): 사주 카드가 퍼진 이유는 한 캡처에 다 담기고 읽기 쉬워서. 같은 원칙으로
 *   50~60대가 가족 단톡방에 돌리는 신문 '오늘의 띠별 운세'를 폰 한 화면에 열두 띠가 다 들어가게 만든다.
 *   캡처 한 장에 날짜, 일진, 출처(사주500)가 같이 찍힌다. 입력 0, AI 추가 비용 0(서버가 하루 한 번 만든 문서를 읽기만).
 *
 *   줄마다: 띠, 출생 연도, 오늘 한 문장(서버 short, 없으면 관계 계산 문장), 좋음/보통/조심(일진과 띠의 관계 계산).
 *   줄을 누르면 표 아래에 그 띠의 자세한 한 줄과 좋은 시간. 보내기: 앱은 토스 공유 링크, 웹은 표 이미지.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { HJ, SERIF, Seal, GoldCta } from '@/components/hanji/Hanji';
import { moVars } from '@/components/motion/Motion';
import { TtiAnimal } from '@/components/tti/TtiAnimal';
import { useToast } from '@/components/common/Toast';
import { trackEvent } from '@/services/analytics';
import { kstToday } from '@/utils/kstDate';
import { todayGz } from '@/services/saju/hookFacts';
import { isAppsInToss } from '@/services/payment/iapService';
import {
  TTI, ttiYears, loadTtiDay, fallbackHead, goodHourOf, badHour, dayTone, setMyTti, getMyTti, type TtiDay, type DayMark,
} from '@/services/tti/ttiFortune';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** 서버 한 줄(head)의 첫 문장에서 짧은 말만 — '오늘 쥐띠는 인(寅)일과 부딪힘 없이 무난한 날입니다.' → '부딪힘 없이 무난한 날이에요'.
 *  한자, 명리 용어가 남거나 길면 쓰지 않는다(관계 계산 문장으로). 서버 short 가 있으면 이건 안 쓴다 */
function shortFromHead(head: string): string | null {
  const m = head.match(/^(.*?날)입니다\./);
  if (!m) return null;
  const s = m[1].replace(/^오늘\s*\S+띠는\s*/, '').replace(/^[가-힣]\([^)]*\)일과\s*/, '').trim();
  if (s.length < 6 || s.length > 18 || /[一-鿿()]|합충|육합|삼합|원진|충|형살/.test(s)) return null;
  return `${s}이에요`;
}
const MARK_COLOR: Record<DayMark, string> = { 좋음: HJ.ink, 보통: HJ.mute, 조심: '#A23A2A' };
/** 칸 바탕 — 좋은 날은 따뜻한 종이, 조심할 날은 옅은 낙관 빛 (금색은 버튼에만이라 쓰지 않는다) */
const CELL_TONE: Record<DayMark, { bg: string; line: string }> = {
  좋음: { bg: '#F4ECD8', line: '#DCCBA6' },
  보통: { bg: '#FFFDF8', line: '#E1D7C4' },
  조심: { bg: '#F8EAE5', line: '#E6C6BC' },
};

export function TtiBoardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const today = kstToday();
  const tg = useMemo(() => todayGz(today), [today]);
  const [day, setDay] = useState<TtiDay | null>(null);
  const [sel, setSel] = useState<string | null>(() => getMyTti()?.ji ?? null);
  const [busy, setBusy] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadTtiDay(today).then((d) => { if (alive) setDay(d && (!d.dayGz || d.dayGz === tg.gz) ? d : null); });
    return () => { alive = false; };
  }, [today, tg.gz]);

  const [y, m, d] = today.split('-').map(Number);
  const dateLabel = `${m}월 ${d}일 ${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}요일`;

  const rows = TTI.map(({ ji, name }) => {
    const tone = dayTone(tg.gz, ji);
    const short = (day?.tti?.[ji]?.short || '').trim() || shortFromHead((day?.tti?.[ji]?.head || '').trim());
    return { ji, name, mark: tone.mark, line: short || tone.line, years: ttiYears(ji).map((yy) => String(yy % 100).padStart(2, '0')).join(' ') };
  });

  const pick = (ji: string) => {
    setSel((cur) => (cur === ji ? null : ji));
    trackEvent('tti_open', { tti: ji, src: 'board' });
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    trackEvent('cta_click', { label: '띠별 운세 한 장 보내기', page: '/tti' });
    try {
      if (isAppsInToss()) {
        // 앱(토스)은 이미지를 바로 보낼 수 없어 토스 공유 링크 (사주 카드와 같은 방식)
        const { share: tossShare, getTossShareLink } = await import('@apps-in-toss/web-framework');
        const link = await getTossShareLink('intoss://saju-500/tti', 'https://saju500.app/og/tti.jpg');
        await tossShare({ message: [`${dateLabel} 오늘의 띠별 운세예요. 우리 가족 띠도 한번 보세요`, link].join('\n') });
        trackEvent('share_complete', { type: 'tti_board', method: 'toss_share', rewarded: 0 });
        return;
      }
      const { captureSajuCardAsBlob, shareSajuCardImage } = await import('@/components/saju-card/SajuCardExport');
      const blob = await captureSajuCardAsBlob({ element: boardRef.current ?? undefined, scale: 3, backgroundColor: HJ.paper });
      const r = await shareSajuCardImage(
        blob,
        `오늘의_띠별_운세_${today.replace(/-/g, '')}.png`,
        `${dateLabel} 오늘의 띠별 운세예요. 우리 가족 띠도 한번 보세요`,
        'https://saju500.app/tti?utm_source=share&utm_medium=image&utm_campaign=tti_board',
        'tti_board',
      );
      if (r.via !== 'canceled') toast.show(r.message, r.ok ? 'success' : 'warning');
    } catch {
      toast.show('보내기를 열지 못했어요. 화면을 캡처해서 보내도 돼요', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const selRow = sel ? rows.find((r) => r.ji === sel) : null;
  const selHead = sel ? ((day?.tti?.[sel]?.head || '').trim() || fallbackHead(tg.gz, sel)) : '';

  return (
    <div style={{ background: HJ.paper, minHeight: '100vh', paddingBottom: 112, color: HJ.ink }}>
      <Header title="오늘의 띠별 운세" />

      {/* ── 한 장 (캡처, 보내기 대상) ── */}
      <div ref={boardRef} style={{ background: HJ.paper, padding: '6px 12px 4px' }}>
        <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '12px 14px 8px' }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <Seal size={36} fontSize={15} stamp>{tg.gz}</Seal>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>오늘의 띠별 운세</div>
              <div style={{ fontSize: 13.5, color: HJ.ink2, marginTop: 2 }}>{dateLabel}, {tg.ko}({tg.gz})일</div>
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 900, color: HJ.ink, flexShrink: 0 }}>
              사주<span style={{ color: '#8C6D3D' }}>500</span>
            </div>
          </div>

          {/* 3 x 4 칸 (10-19 오너: 우리 스타일 동물 그림, 좋은지 조심할지 바로, 한 문장은 눈에 잘 띄게) */}
          <div className="grid grid-cols-3" style={{ gap: 5, marginTop: 8 }}>
            {rows.map((r, i) => {
              const tone = CELL_TONE[r.mark];
              return (
                <button key={r.ji} type="button" onClick={() => pick(r.ji)} className="mo-rise"
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

          {/* 출처는 머리의 '사주500' 하나로 (10-19 오너: 아래 주소 줄은 필요 없다) */}
          <div style={{ paddingTop: 8, fontSize: 13, color: HJ.mute, textAlign: 'center' }}>
            양력 2월 4일 무렵(입춘) 전에 태어났다면 앞 해의 띠로 보세요
          </div>
        </div>
      </div>

      {/* ── 고른 띠 자세히 (캡처 밖) ── */}
      <div ref={detailRef} style={{ padding: '0 12px', scrollMarginTop: 72 }}>
        {selRow ? (
          <div className="mo-unroll" key={selRow.ji} style={{ marginTop: 12, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '14px 16px' }}>
            <div className="flex items-center" style={{ gap: 10 }}>
              <TtiAnimal ji={selRow.ji} size={34} />
              <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700 }}>{selRow.name} 오늘의 운세</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: HJ.mute, fontVariantNumeric: 'tabular-nums' }}>{selRow.years}년생</span>
            </div>
            <p style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, lineHeight: 1.65, marginTop: 10 }}>{selHead}</p>
            <div style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.6, color: HJ.ink2 }}>
              <div><b style={{ color: HJ.ink }}>좋은 시간</b> {goodHourOf(selRow.ji)}</div>
              {badHour(selRow.ji) && <div><b style={{ color: HJ.ink }}>조심할 시간</b> {badHour(selRow.ji)}</div>}
            </div>
            <button type="button" className="w-full"
              onClick={() => { setMyTti(selRow.ji); trackEvent('cta_click', { label: '띠 한 장에서 태어난 해별로', page: '/tti' }); navigate('/'); }}
              style={{ marginTop: 10, padding: '10px 0 2px', fontSize: 14.5, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
              {selRow.name} 태어난 해별 운세 보기 ›
            </button>
          </div>
        ) : (
          <p style={{ textAlign: 'center', fontSize: 14, color: HJ.mute, marginTop: 12 }}>띠를 누르면 자세한 운세와 좋은 시간이 나와요</p>
        )}

        <GoldCta style={{ marginTop: 16 }} onClick={share}>
          {busy ? '준비 중이에요' : '가족 단톡방에 보내기'}
        </GoldCta>
        <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 8 }}>화면을 그대로 캡처해서 보내도 돼요</p>

        <button type="button" className="w-full text-left mo-press"
          onClick={() => { trackEvent('cta_click', { label: '띠 한 장에서 내 사주로', page: '/tti' }); navigate('/input?from=daily'); }}
          style={{ marginTop: 18, borderRadius: 16, padding: '14px 15px', background: HJ.card, border: `1px solid ${HJ.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Seal size={30} fontSize={16}>日</Seal>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: SERIF, fontSize: 16.5, fontWeight: 700, color: HJ.ink }}>띠 말고 내 사주로 보기</span>
            <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.5, color: HJ.ink2, marginTop: 2 }}>생일을 넣으면 나만의 오늘 운세와 좋은 시간을 알려 드려요</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: HJ.ink, flexShrink: 0 }}>›</span>
        </button>
      </div>
    </div>
  );
}
