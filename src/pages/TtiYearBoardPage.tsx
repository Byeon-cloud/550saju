/**
 * 2027 띠별 신년운세 한 장 (2026-10-19) — /tti/2027
 *
 *   오늘의 띠별 운세 한 장(/tti)과 같은 판. 11월부터 신년 성수기에 50~60대가 가족 단톡방에 돌리고,
 *   '내 사주로 보는 2027 신년운세'(유료)로 이어지는 입구. 입력 0, AI 비용 0.
 *   좋음/보통/조심은 2027년 해 지지 未(양)와 띠의 관계 계산, 한 문장은 검색 페이지 글(src/data/seo/tti-2027.json, 사람이 손본 글)의
 *   첫 문장에 있는 말로만 정했다(아래 SHORT). 띠를 누르면 총운, 좋은 달, 조심할 달.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { HJ, SERIF, Seal, GoldCta } from '@/components/hanji/Hanji';
import { TtiAnimal } from '@/components/tti/TtiAnimal';
import { TtiBoardCard, shareBoard, type BoardRow } from '@/components/tti/TtiBoardCard';
import { useToast } from '@/components/common/Toast';
import { trackEvent } from '@/services/analytics';
import { getTojungPrice } from '@/constants/pricing';
import { TTI, ttiYears, dayTone, getMyTti, setMyTti } from '@/services/tti/ttiFortune';
import Y2027 from '@/data/seo/tti-2027.json';

const YEAR = 2027;
const YEAR_GZ = '丁未';
/** 칸 한 문장 — 각 띠 2027년 글 첫 문장의 말로만 (지어내지 않음) */
const SHORT: Record<string, string> = {
  子: '괜히 서운해지기 쉬운 해예요',
  丑: '정면으로 부딪히는 해예요',
  寅: '큰 굴곡 없이 흘러가는 해예요',
  卯: '일이 맞물려 풀리는 해예요',
  辰: '부딪힐 일 없이 가는 해예요',
  巳: '큰 굴곡 없이 지나는 해예요',
  午: '사람과 인연이 잘 맞는 해예요',
  未: '같은 일이 되풀이되기 쉬운 해예요',
  申: '특별히 부딪힐 일 없는 해예요',
  酉: '무난하고 평탄한 해예요',
  戌: '마찰과 서류 실수를 조심할 해예요',
  亥: '힘을 합치면 잘 풀리는 해예요',
};
const SLUG: Record<string, string> = { 子: 'rat', 丑: 'ox', 寅: 'tiger', 卯: 'rabbit', 辰: 'dragon', 巳: 'snake', 午: 'horse', 未: 'goat', 申: 'monkey', 酉: 'rooster', 戌: 'dog', 亥: 'pig' };

type YearData = { months: Record<string, { good: string[]; care: string[] }>; tti: Record<string, { head: string; good: string; care: string; years: Record<string, string> }> };
const DATA = Y2027 as unknown as YearData;

export function TtiYearBoardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [sel, setSel] = useState<string | null>(() => getMyTti()?.ji ?? null);
  const [busy, setBusy] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const price = getTojungPrice();

  const rows: BoardRow[] = TTI.map(({ ji, name }) => ({
    ji, name, mark: dayTone(YEAR_GZ, ji).mark, line: SHORT[ji],
    years: ttiYears(ji).map((yy) => String(yy % 100).padStart(2, '0')).join(' '),
  }));

  const pick = (ji: string) => {
    setSel((cur) => (cur === ji ? null : ji));
    trackEvent('tti_open', { tti: ji, src: 'board2027' });
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await shareBoard({
        boardEl: boardRef.current, inAppPath: '/tti/2027', ogImage: 'https://saju500.app/og/tojung.jpg',
        message: `${YEAR}년 띠별 신년운세예요. 우리 가족 띠는 어떤 해인지 한번 보세요`,
        fileName: `${YEAR}_띠별_신년운세.png`,
        webUrl: `https://saju500.app/tti/${YEAR}?utm_source=share&utm_medium=image&utm_campaign=tti_board_${YEAR}`, type: 'tti_board_2027',
      });
      if (r.message && !r.canceled) toast.show(r.message, r.ok ? 'success' : 'warning');
    } catch {
      toast.show('보내기를 열지 못했어요. 화면을 캡처해서 보내도 돼요', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const selRow = sel ? rows.find((r) => r.ji === sel) : null;
  const t = sel ? DATA.tti?.[sel] : null;
  const mo = sel ? DATA.months?.[sel] : null;

  return (
    <div style={{ background: HJ.paper, minHeight: '100vh', paddingBottom: 112, color: HJ.ink }}>
      <Header title={`${YEAR} 띠별 신년운세`} />

      <TtiBoardCard ref={boardRef} seal={<Seal size={36} fontSize={15} stamp>{YEAR_GZ}</Seal>}
        title={`${YEAR}년 띠별 신년운세`} sub="정미년, 붉은 양의 해" rows={rows} sel={sel} onPick={pick}
        foot={`입춘(${YEAR}년 2월 4일)부터 한 해가 바뀌어요. 그 전 생일은 앞 해 띠`} />

      <div ref={detailRef} style={{ padding: '0 12px', scrollMarginTop: 72 }}>
        {selRow && t ? (
          <div className="mo-unroll" key={selRow.ji} style={{ marginTop: 12, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '14px 16px' }}>
            <div className="flex items-center" style={{ gap: 10 }}>
              <TtiAnimal ji={selRow.ji} size={34} />
              <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700 }}>{YEAR}년 {selRow.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: HJ.mute, fontVariantNumeric: 'tabular-nums' }}>{selRow.years}년생</span>
            </div>
            <p style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, lineHeight: 1.7, marginTop: 10 }}>{t.head}</p>
            <div style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.65, color: HJ.ink2 }}>
              <div><b style={{ color: HJ.ink }}>좋은 달</b> {(mo?.good || []).join(', ') || '특별히 없음'}</div>
              <div style={{ marginTop: 2 }}>{t.good}</div>
              <div style={{ marginTop: 8 }}><b style={{ color: '#A23A2A' }}>조심할 달</b> {(mo?.care || []).join(', ') || '특별히 없음'}</div>
              <div style={{ marginTop: 2 }}>{t.care}</div>
            </div>
            <button type="button" className="w-full"
              onClick={() => {
                setMyTti(selRow.ji);
                trackEvent('cta_click', { label: '2027 한 장에서 태어난 해별로', page: '/tti/2027' });
                if (typeof window !== 'undefined' && !/TossApp/.test(navigator.userAgent) && import.meta.env.VITE_BUILD_TARGET !== 'appintos') {
                  window.location.href = `/unse/${YEAR}/${SLUG[selRow.ji]}/`;
                } else navigate('/');
              }}
              style={{ marginTop: 10, padding: '10px 0 2px', fontSize: 14.5, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
              {selRow.name} 태어난 해별 {YEAR}년 운세 보기 ›
            </button>
          </div>
        ) : (
          <p style={{ textAlign: 'center', fontSize: 14, color: HJ.mute, marginTop: 12 }}>띠를 누르면 좋은 달과 조심할 달이 나와요</p>
        )}

        {/* 2026-10-21 — 광고 손님 대부분이 이 화면에서 띠 표만 보고 나갔다(메타 V3, 사주 입력 3.5%).
         *   내 사주 입구를 표 바로 아래로 올리고 무료 미리 보기를 앞세운다(미리 보기는 좋은 달, 조심할 달, 기억할 날 수를 무료로 보여 준다) */}
        <button type="button" className="w-full text-left mo-press"
          onClick={() => { trackEvent('cta_click', { label: '2027 한 장에서 신년운세', page: '/tti/2027' }); navigate('/tojung'); }}
          style={{ marginTop: 16, borderRadius: 16, padding: '15px 15px', background: HJ.ink, color: '#F1ECE1', border: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Seal size={30} fontSize={16}>歲</Seal>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: SERIF, fontSize: 16.5, fontWeight: 700 }}>내 생일로 보는 {YEAR}년</span>
            <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.5, color: '#D9CFBE', marginTop: 2 }}>띠가 같아도 생일마다 좋은 달이 달라요. 좋은 달과 조심할 달은 무료로 미리 볼 수 있어요</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#D2B477', flexShrink: 0 }}>미리 보기 ›</span>
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: HJ.mute, marginTop: 6 }}>날짜까지 다 보는 {YEAR} 신년운세는 {price.actualPrice}운이에요</p>

        <GoldCta style={{ marginTop: 18 }} onClick={share}>{busy ? '준비 중이에요' : '가족 단톡방에 보내기'}</GoldCta>
        <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 8 }}>화면을 그대로 캡처해서 보내도 돼요</p>
      </div>
    </div>
  );
}
