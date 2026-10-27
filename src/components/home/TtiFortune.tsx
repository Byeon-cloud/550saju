/**
 * 띠별 오늘의 운세 (2026-10-15 · 1.5.6) — 띠를 누르면 바로 읽힌다 (입력 0)
 *   혜택탭으로 들어온 50~60대가 생년월일 입력 앞에서 나가던 문제 → 신문 띠별 운세처럼 한 번 누르면 끝.
 *
 *   흐름 (10-15 오너: '한 줄 보고 끝이면 전환이 안 된다')
 *     띠 표 → 띠 카드(띠 한 줄 + 연도별 한 줄) → 내 해를 누르면 '내 운세' 칸
 *       (오늘 한 줄, 좋은 시간, 조심할 시간, 이번 달 띠 운)
 *       → 생일을 넣으면 열리는 것(실제 오늘의 운세 항목만: 돈 흐름, 끌어주는 사람, 할 일과 피할 일, 행운 색과 방위)
 *       → [생일 넣고 무료로 보기] → 내년 띠 운 맛보기 → 신년운세
 *     가족 칸(사주 있는 사람)은 읽기만 + 가족 생일 넣기, 나와 궁합 보기.
 *   내 해는 기기에만 기억하고, 홈은 그 해로 세대를 알아 고민 목록을 맞춘다.
 *   2026-10-23 1.6.3 P1-10 — 생일 넣는 길을 회색 글자 한 줄에서 테두리 있는 흰 카드 버튼으로(금색 아님),
 *     띠 아래 숫자는 행운 숫자로 읽혀서 '숫자는 태어난 해예요' 한 줄과 14px 진한 글자로.
 *     측정: tti_view {src, ab?}, tti_input {src, step, ab?} (ab = 고른 해의 연령대)
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { HJ, SERIF, Seal, GoldCta, Redact } from '@/components/hanji/Hanji';
import { TtiAnimal } from '@/components/tti/TtiAnimal';
import { ageBandOfYear, trackEvent } from '@/services/analytics';
import { hasFreePass, subscribeFreePass } from '@/services/storage/dailyFreePass';
import { currentSajuMonth, monthDayLabel } from '@/services/saju/hookFacts';
import { DailyNotiButton } from '@/components/common/DailyNotiButton';
import {
  TTI, ttiName, ttiYears, yearLabel, fallbackHead, fallbackYearLine, loadTtiDay, getMyTti, setMyTti,
  goodHourOf, badHour, monthTtiLine, yearTtiLine, type TtiDay,
} from '@/services/tti/ttiFortune';

const GAN_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const ZHI_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const yearKo = (y: number): string => GAN_KO[(((y - 4) % 10) + 10) % 10] + ZHI_KO[(((y - 4) % 12) + 12) % 12];

/** 생일을 넣으면 열리는 것 — 오늘의 운세 결과에 실제로 있는 항목만 (미끼 금지) */
const LOCKED = ['오늘 돈 흐름', '나를 끌어주는 사람', '오늘 할 일과 피할 일', '행운의 색과 방위'];

export function TtiFortune({ today, dayGz, dayKo, src, onYearPick, onInput, newYear, onNewYear, compatPrice, onCompat }: {
  /** YYYY-MM-DD (KST) */
  today: string;
  /** 오늘 일진 한자 두 글자 */
  dayGz: string;
  /** 오늘 일진 한글 (임술) */
  dayKo: string;
  /** 홈 첫 화면(hero) 또는 가족 띠 칸(family) */
  src: 'hero' | 'family';
  onYearPick?: (year: number | undefined) => void;
  /** 생일 넣기 (hero: 내 사주, family: 가족 사주) — 고른 해가 있으면 넘겨 생년월일 앞 네 자리를 채운다 */
  onInput: (year?: number) => void;
  /** 내년 신년운세 맛보기 */
  newYear?: { year: number; gz: string; ko: string; price: number; badge?: string };
  onNewYear?: () => void;
  compatPrice?: number;
  onCompat?: () => void;
}) {
  const navigate = useNavigate();
  const mine = getMyTti();
  const hero = src === 'hero';
  const [sel, setSel] = useState<string | null>(hero ? mine?.ji ?? null : null);
  const [myYear, setMyYear] = useState<number | undefined>(hero ? mine?.year : undefined);
  const [showOthers, setShowOthers] = useState(false);
  /** 내 해를 기억해 둔 재방문자는 띠 표를 접고 내 운세 칸부터 */
  const [gridOpen, setGridOpen] = useState(() => !(hero && mine?.ji && mine?.year));
  const [day, setDay] = useState<TtiDay | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /** 오늘의 운세 무료 한 번(기기 하루 1회)이 남았는지 — 다 썼으면 '무료'라고 말하지 않는다 (2026-10-15) */
  const [freeDaily, setFreeDaily] = useState(() => hasFreePass('daily'));
  useEffect(() => subscribeFreePass(() => setFreeDaily(hasFreePass('daily'))), []);

  useEffect(() => {
    let alive = true;
    loadTtiDay(today).then((d) => { if (alive) setDay(d && (!d.dayGz || d.dayGz === dayGz) ? d : null); });
    return () => { alive = false; };
  }, [today, dayGz]);
  /** 고른 해로 본 연령대 (사주 없는 첫 화면은 프로필 연령대가 없어서 이걸로 나눠 본다) */
  const abOf = (y?: number): Record<string, string> => { const ab = y ? ageBandOfYear(y) : undefined; return ab ? { ab } : {}; };
  // 띠 표 화면 진입 한 번 (입력 시작 비율의 분모)
  useEffect(() => {
    trackEvent('tti_view', { src, ...abOf(hero ? mine?.year : undefined) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (ji: string) => {
    const next = sel === ji ? null : ji;
    setSel(next);
    setShowOthers(false);
    if (!next) return;
    trackEvent('tti_open', { tti: ji, src });
    // 2026-10-25 — 내 해를 고른 뒤 배우자 띠 등을 둘러보면, 예전엔 저장해 둔 내 해를 지우고(setMyTti(ji)) 제목은 '64년생 용띠'로 남아
    //   아래 '쥐띠 오늘의 운세'와 어긋났다. 내 해는 pickYear 에서만 저장하고, 둘러볼 때는 제목만 고른 띠에 맞춘다.
    if (hero) {
      if (!myYear) setMyTti(ji);
      onYearPick?.(myYear && ttiYears(ji).includes(myYear) ? myYear : undefined);
    }
    // 카드가 화면 아래에 열리면 보이게
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };
  const pickYear = (ji: string, y: number) => {
    setMyYear(y);
    setMyTti(ji, y);
    setShowOthers(false);
    setGridOpen(false);
    trackEvent('tti_year', { year: y, src });
    onYearPick?.(y);
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const goInput = (step: string) => { trackEvent('tti_input', { src, step, ...abOf(hero ? myYear : undefined) }); onInput(hero && myYear && sel && ttiYears(sel).includes(myYear) ? myYear : undefined); };

  const t = sel ? day?.tti?.[sel] : null;
  const head = (t?.head && t.head.trim()) || (sel ? fallbackHead(dayGz, sel) : '');
  const lineOf = (y: number) => (t?.years?.[String(y)] || '').trim() || fallbackYearLine(dayGz, y);
  const years = sel ? ttiYears(sel) : [];
  const chosen = hero && sel && myYear && years.includes(myYear) ? myYear : null;
  const month = currentSajuMonth(today);
  const monthLabel = `${month.ko}월`;

  const yearRow = (y: number, i: number, clickable: boolean) => {
    const style = {
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', width: '100%',
      borderTop: i === 0 ? 0 : `1px solid ${HJ.line}`, background: 'transparent',
    } as const;
    const inner = (
      <>
        <span style={{ width: 58, flexShrink: 0, fontSize: 14.5, fontWeight: 800, color: HJ.ink, lineHeight: 1.6 }}>{yearLabel(y)}</span>
        <span style={{ flex: 1, fontSize: 15, lineHeight: 1.6, color: HJ.ink2 }}>{lineOf(y)}</span>
        {clickable && <span aria-hidden="true" style={{ fontSize: 15, color: HJ.mute, lineHeight: 1.6 }}>›</span>}
      </>
    );
    return clickable
      ? <button key={y} type="button" onClick={() => pickYear(sel!, y)} className="text-left" style={style}>{inner}</button>
      : <div key={y} style={style}>{inner}</div>;
  };

  return (
    <div>
      {/* ── 띠 표 (내 해를 고른 뒤에는 접는다) ── */}
      {!gridOpen && sel ? (
        <div className="flex items-center" style={{ gap: 8 }}>
          <button type="button" onClick={() => setGridOpen(true)}
            style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0, padding: '8px 0' }}>
            다른 띠 보기 ›
          </button>
        </div>
      ) : (
      <>
      {/* 2026-10-23 P1-10 — 띠 아래 숫자가 행운 숫자처럼 보여서 (40~60대 점검) */}
      <p style={{ fontSize: 13, lineHeight: 1.5, color: HJ.mute, margin: '0 2px 8px' }}>숫자는 태어난 해예요. 1984년생은 84를 찾으세요.</p>
      <div className="grid grid-cols-4 gap-2">
        {TTI.map(({ ji, name }) => {
          const on = sel === ji;
          const yy = ttiYears(ji).map((y) => String(y % 100).padStart(2, '0'));
          return (
            <button key={ji} type="button" onClick={() => pick(ji)} aria-pressed={on}
              style={{
                minHeight: 80, borderRadius: 12, padding: '9px 4px 8px',
                background: on ? HJ.ink : HJ.card, color: on ? '#F1ECE1' : HJ.ink,
                border: `1px solid ${on ? HJ.ink : HJ.line}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
              {/* 2026-10-19 사주500 띠 그림 (고른 칸은 먹 바탕이라 그림을 종이색으로 뒤집는다) */}
              <TtiAnimal ji={ji} size={26} ink={on ? '#F1ECE1' : undefined} paper={on ? HJ.ink : undefined} />
              <span style={{ fontFamily: SERIF, fontSize: name.length > 3 ? 14.5 : 16, fontWeight: 700, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{name}</span>
              {/* 출생 연도 여섯(1941~2012년생)을 두 줄에 셋씩 — 2000년대생까지 다 보이게(10-16 오너: 07년생 빠짐, 29~40년생 줄은 빼고 여섯) */}
              {/* 10-23 P1-10 — 14px, 보조색보다 진하게 (13px #6F6557 은 50~60대에게 흐렸다) */}
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: on ? '#E2D9C8' : HJ.ink2, textAlign: 'center', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {yy.slice(0, 3).join(' ')}<br />{yy.slice(3).join(' ')}
              </span>
            </button>
          );
        })}
      </div>
      </>
      )}
      {/* 2026-10-19 열두 띠를 폰 한 화면에 — 가족 단톡방에 캡처해 보내기 좋게 (/tti) */}
      {gridOpen && (
        <button type="button" onClick={() => { trackEvent('cta_click', { label: '열두 띠 한 장으로', page: '/', src }); navigate('/tti'); }}
          className="w-full" style={{ marginTop: 8, padding: '8px 0', fontSize: 14.5, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
          열두 띠 한 장으로 보고 가족에게 보내기 ›
        </button>
      )}

      {/* 띠를 아직 안 고른 첫 화면 — 금색 버튼은 띠 카드 안에서만, 여기는 테두리 있는 흰 카드 버튼 (2026-10-23 P1-10, 글자 링크 한 줄은 50~60대가 지나쳤다) */}
      {hero && !sel && <InputCardBtn free={freeDaily} onClick={() => goInput('grid')} style={{ marginTop: 14 }} />}

      {sel && (
        <div ref={cardRef} style={{ marginTop: 12, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '16px 16px 14px', scrollMarginTop: 72 }}>
          <div className="flex items-center gap-2.5">
            <TtiAnimal ji={sel} size={36} />
            <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700 }}>{ttiName(sel)} 오늘의 운세</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: HJ.mute }}>{dayKo}일</span>
          </div>
          <p style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 600, lineHeight: 1.65, marginTop: 12, color: HJ.ink }}>{head}</p>

          {chosen ? (
            <>
              {/* ── 내 운세 칸 ── */}
              <div style={{ marginTop: 14, background: HJ.hanji, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '14px 14px 6px' }}>
                <div className="flex items-baseline" style={{ gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: HJ.ink }}>{yearLabel(chosen)} {ttiName(sel)}</span>
                  <span style={{ fontSize: 13, color: HJ.mute }}>{yearKo(chosen)}생 (내 해)</span>
                  {/* 2026-10-25 tap-pad — 누르는 칸 44px (글자 13px에 padding 4px 이라 약 27px 이었다) */}
                  <button type="button" className="tap-pad" onClick={() => { setMyYear(undefined); setMyTti(sel); onYearPick?.(undefined); }}
                    style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 600, color: HJ.ink2, background: 'transparent', border: 0, padding: '4px 0 4px 12px', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    해 바꾸기
                  </button>
                </div>
                <p style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, lineHeight: 1.6, marginTop: 8, color: HJ.ink }}>{lineOf(chosen)}</p>
                <dl style={{ marginTop: 10 }}>
                  <Fact k="좋은 시간">{goodHourOf(sel)}</Fact>
                  {badHour(sel) && <Fact k="조심할 시간">{badHour(sel)}</Fact>}
                  <Fact k="이번 달">{monthTtiLine(month.gz, sel, monthLabel)} <span style={{ color: HJ.mute }}>({monthDayLabel(month.lastDay)}까지)</span></Fact>
                </dl>
              </div>
              {/* 2026-10-27 내 해를 고른 첫 화면 손님에게 아침 9시 알림 (앱만, 동의했으면 숨김) — 다음 날 다시 오게 */}
              {hero && <DailyNotiButton variant="tti" className="mt-3" />}

              {/* ── 생일을 넣으면 열리는 것 ── */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 700, color: HJ.ink }}>생일을 넣으면 이만큼 더 보여요</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                  {LOCKED.map((l, i) => (
                    <li key={l} className="flex items-center" style={{ gap: 10, padding: '10px 0', borderTop: i === 0 ? 0 : `1px solid ${HJ.line}` }}>
                      <span style={{ flex: 1, fontSize: 15, color: HJ.ink2 }}>{l}</span>
                      <Redact w={92} lock={false} />
                    </li>
                  ))}
                </ul>
                <GoldCta style={{ marginTop: 12 }} onClick={() => goInput('panel')} sub={freeDaily ? '무료' : '1운'}>
                  {freeDaily ? '생일 넣고 무료로 보기' : '생일 넣고 오늘 운세 보기'}
                </GoldCta>
                <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 8 }}>
                  {freeDaily ? '오늘 한 번은 결제 없이 열려요. 생일은 한 번 넣으면 계속 써요' : '오늘 무료 한 번은 이미 썼어요. 내일 다시 무료로 열려요'}
                </p>
              </div>

              {/* ── 내년 띠 운 맛보기 → 신년운세 ── */}
              {newYear && onNewYear && (
                <button type="button" onClick={() => { trackEvent('tti_newyear', { tti: sel }); onNewYear(); }} className="w-full text-left"
                  style={{ marginTop: 16, background: HJ.ink, color: '#F1ECE1', borderRadius: 14, padding: '14px 14px 13px', border: 0, display: 'block' }}>
                  <span className="flex items-center" style={{ gap: 8 }}>
                    <Seal size={26} fontSize={14}>歲</Seal>
                    <span style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 700 }}>{newYear.year}년 {newYear.ko}년, {ttiName(sel)}는?</span>
                  </span>
                  <span style={{ display: 'block', fontSize: 14.5, lineHeight: 1.6, color: '#E2D9C8', marginTop: 8 }}>
                    {yearTtiLine(newYear.gz, sel, `${newYear.year}년 ${newYear.ko}년`)}
                  </span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#D2B477', marginTop: 8, textAlign: 'right' }}>
                    달마다 좋은 날까지 신년운세 {newYear.badge ? `${newYear.badge} ` : ''}{newYear.price}운 ›
                  </span>
                </button>
              )}

              {/* ── 다른 해 ── */}
              <button type="button" onClick={() => setShowOthers((v) => !v)} className="w-full"
                style={{ marginTop: 12, padding: 10, fontSize: 14.5, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
                {showOthers ? '다른 해 접기' : `${ttiName(sel)} 다른 해도 보기 ›`}
              </button>
              {showOthers && <div>{years.filter((y) => y !== chosen).map((y, i) => yearRow(y, i, true))}</div>}
            </>
          ) : (
            <>
              {hero && (
                <p style={{ fontSize: 14.5, fontWeight: 700, color: HJ.goldText, marginTop: 14 }}>
                  태어난 해를 누르면 내 운세를 자세히 보여 드려요
                </p>
              )}
              <div style={{ marginTop: hero ? 4 : 10 }}>{years.map((y, i) => yearRow(y, i, hero))}</div>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: HJ.mute, marginTop: 8 }}>
                양력 2월 4일 무렵(입춘) 전에 태어났다면 앞 해의 띠로 보세요.
              </p>
              {hero && <InputCardBtn free={freeDaily} onClick={() => goInput('card')} style={{ marginTop: 12 }} />}
              {!hero && (
                <div className="grid grid-cols-2 gap-2" style={{ marginTop: 12 }}>
                  <SubBtn onClick={() => goInput('family')} t="가족 생일 넣고" s={freeDaily ? '오늘 운세 무료로 보기 ›' : '오늘 운세 1운으로 보기 ›'} />
                  {onCompat && <SubBtn onClick={() => { trackEvent('tti_compat', { tti: sel }); onCompat(); }} t="나와 궁합" s={`잘 맞는 점과 부딪히는 점 ${compatPrice ?? ''}운 ›`} />}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex" style={{ gap: 10, padding: '9px 0', borderTop: `1px solid ${HJ.line}` }}>
      <dt style={{ width: 74, flexShrink: 0, fontSize: 14, fontWeight: 800, color: HJ.ink, lineHeight: 1.55 }}>{k}</dt>
      <dd style={{ flex: 1, margin: 0, fontSize: 14.5, lineHeight: 1.55, color: HJ.ink2 }}>{children}</dd>
    </div>
  );
}

/** 생일 넣기 카드 버튼 (2026-10-23 P1-10) — 흰 카드에 먹 테두리, 금색 아님.
 *  '무료예요'는 오늘의 운세 무료 한 번이 남았을 때만 (10-15 규칙: 다 썼으면 무료라고 말하지 않는다).
 *  '매일 아침 따로 알려 드려요'는 넣지 않는다 — 9시 알림은 가족 사주를 따로 보내지 않는다. */
function InputCardBtn({ free, onClick, style }: { free: boolean; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left mo-press"
      style={{ display: 'flex', alignItems: 'center', gap: 10, background: HJ.card, border: `1.5px solid ${HJ.ink}`, borderRadius: 14, padding: '14px 14px 13px 16px', ...style }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, lineHeight: 1.55, color: HJ.ink, wordBreak: 'keep-all' }}>
          내 생일을 넣으면 오늘 좋은 시간까지 볼 수 있어요. 가족 생일도 넣어 둘 수 있어요.{free ? ' 무료예요.' : ''}
        </span>
        <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.5, color: HJ.mute, marginTop: 4 }}>태어난 시간을 몰라도 돼요</span>
      </span>
      <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 700, color: HJ.ink, flexShrink: 0 }}>›</span>
    </button>
  );
}

function SubBtn({ onClick, t, s }: { onClick: () => void; t: string; s: string }) {
  return (
    <button type="button" onClick={onClick} className="text-left"
      style={{ background: HJ.paper, border: `1px solid ${HJ.line}`, borderRadius: 12, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: SERIF, fontSize: 15.5, fontWeight: 700, color: HJ.ink }}>{t}</span>
      <span style={{ fontSize: 13.5, lineHeight: 1.45, color: HJ.ink2 }}>{s}</span>
    </button>
  );
}
