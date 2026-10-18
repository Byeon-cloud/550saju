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
import { TtiAnimal } from '@/components/tti/TtiAnimal';
import { TtiBoardCard, shareBoard } from '@/components/tti/TtiBoardCard';
import { DailyNotiButton } from '@/components/common/DailyNotiButton';
import { useToast } from '@/components/common/Toast';
import { trackEvent } from '@/services/analytics';
import { kstToday } from '@/utils/kstDate';
import { todayGz } from '@/services/saju/hookFacts';
import {
  TTI, ttiYears, loadTtiDay, fallbackHead, goodHourOf, badHour, dayTone, setMyTti, getMyTti, type TtiDay,
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
    const message = `${dateLabel} 오늘의 띠별 운세예요. 우리 가족 띠도 한번 보세요`;
    try {
      const r = await shareBoard({
        boardEl: boardRef.current, inAppPath: '/tti', ogImage: 'https://saju500.app/og/tti.jpg', message,
        fileName: `오늘의_띠별_운세_${today.replace(/-/g, '')}.png`,
        webUrl: 'https://saju500.app/tti?utm_source=share&utm_medium=image&utm_campaign=tti_board', type: 'tti_board',
      });
      if (r.message && !r.canceled) toast.show(r.message, r.ok ? 'success' : 'warning');
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
      <TtiBoardCard ref={boardRef} seal={<Seal size={36} fontSize={15} stamp>{tg.gz}</Seal>}
        title="오늘의 띠별 운세" sub={`${dateLabel}, ${tg.ko}(${tg.gz})일`} rows={rows} sel={sel} onPick={pick} />

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
        <button type="button" className="w-full" onClick={() => { trackEvent('cta_click', { label: '오늘 띠 한 장에서 2027', page: '/tti' }); navigate('/tti/2027'); }}
          style={{ marginTop: 6, padding: '8px 0', fontSize: 14.5, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
          2027년 띠별 신년운세도 한 장으로 보기 ›
        </button>
        {/* 2026-10-19 띠 운세를 보러 온 사람이 내일도 오게 — 아침 9시 알림 (앱에서만, 동의하면 숨김) */}
        <DailyNotiButton variant="slim" className="mt-3" />

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
