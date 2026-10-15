// HomePage v9 (2026-10-10) — 수묵·고서 시안 적용 (docs/mockups/사주500_v9_고서시안.html)
//   순서 (2026-10-14 홈 강조 개편, 시안 artifact 2zsAF1fJrFmpcHzQE3mrA3): 오늘 예고(히어로) → 오늘 무료(먹 꿈, 한지 대화)
//         → 사주책(종합사주) → 신년운세(그림 띠) → 기간별(달력 장 두 장) → 고민(연애 D-day, 빨간 도장 셋, 목록)
//         → 실시간 인기 → 실제 후기(있을 때만) → 다른 점(먹 띠) → 푸터
//   원칙
//   - 화면의 사주 문장은 전부 hookFacts(만세력 계산 사실)에서 온다. AI 가 정하는 값(가장 좋은 날·점수)은 미리 말하지 않는다.
//   - 잠긴 내용은 가짜 글자 블러가 아니라 가림막(<Redact/>) — 결제 후 다른 말이 나오는 미끼 금지.
//   - 금색은 누르는 곳에만 · 색은 먹·종이 · 글자는 그림 위에 올리지 않는다 (가독성).
//   - 후기는 실제 구매자 후기(노출 동의 + 오너 승인)만. 없으면 섹션째 숨김 (구 HOME_REVIEWS 시드는 노출 중단).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { kstToday } from '@/utils/kstDate';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import { LegalFooter } from '@/components/layout/LegalFooter';
import { useActiveProfile, useTodayHeadline } from '@/hooks/useHomeData';
import { listTopics, TOPIC_REGISTRY, type TopicId } from '@/constants/topics';
import { getTopicPrice, getPremiumPrice, getMonthlyPrice, getWeeklyPrice, getTojungPrice, PRODUCT_COST } from '@/constants/pricing';
import { hasFreePass, subscribeFreePass } from '@/services/storage/dailyFreePass';
import { getReports } from '@/services/storage/localStore';
import { getPublicReviews, type PublicReview } from '@/services/reviews';
import { getTopicTop5 } from '@/services/liveBest';
import {
  todayHook, todayGz, weekFact, nextMonthFact, loveDday, yearFact, yearGz, loveStars, wealthStars,
  examFact, spouseSeatFact, persona, monthDayLabel, josa, nextStarMonth, STAR_LUCK,
  type WeekFact, type MonthFact,
} from '@/services/saju/hookFacts';
import type { SajuData } from '@/types/saju';
import { TtiFortune } from '@/components/home/TtiFortune';
import { getMyTti, ttiOfYear, ttiName, yearLabel } from '@/services/tti/ttiFortune';
import {
  HJ, SERIF, ART, ART_CREDIT, GoldCta, Seal, Redact, Gwang, GoBook, hanjaNum,
} from '@/components/hanji/Hanji';

/** 신년운세 대상 연도 — 10월부터 내년 (TojungPage·서버와 같은 규칙) */
const NEW_YEAR_TARGET = (() => {
  const d = new Date(Date.now() + 9 * 3600e3);
  return d.getUTCMonth() + 1 >= 10 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
})();

function todayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 ${wd}요일`;
}

/** 오늘 이 사람의 오늘의 운세를 이미 받았는지 (홈 훅과 같은 판정) */
function receivedDailyToday(profile: any, today: string): boolean {
  try {
    const pid = profile?.id;
    const bk = profile?.input ? `${profile.name}_${profile.input.birthYear}_${profile.input.birthMonth}_${profile.input.birthDay}` : '';
    return getReports().some((r: any) => {
      if (r?.contentType !== 'daily' || r?.aiResult?.__partial || r?.aiResult?.__fortuneDate !== today) return false;
      if (pid && r.profileId === pid) return true;
      return !!bk && `${r.name}_${r.input?.birthYear}_${r.input?.birthMonth}_${r.input?.birthDay}` === bk;
    });
  } catch { return false; }
}

export function HomePage() {
  usePageTitle('정통 명리학 사주 풀이');
  useSeoMeta({
    description:
      '600년 명리학 6대 원전 기반 사주 풀이. 500원으로 만나는 깊이 있는 사주, 오늘의 운세와 꿈해몽 매일 1회 무료, 10가지 주제별 분석과 종합사주, 궁합, 신년운세.',
  });
  const navigate = useNavigate();
  const toast = useToast();
  const { name, hasProfile, profile } = useActiveProfile();
  const todayLine = useTodayHeadline(profile, name);
  const displayName = name || '나';
  const sajuData = (profile?.sajuData || null) as SajuData | null;
  const hasSaju = !!(hasProfile && sajuData?.pillars?.[2]?.천간);
  const profileId = (profile as any)?.id as string | undefined;

  // 부팅 자동환불·보상·복구 안내 (App 이 플래그 저장 → 홈에서 1회)
  useEffect(() => {
    try {
      const n = localStorage.getItem('saju500:refund_notice');
      if (n) { localStorage.removeItem('saju500:refund_notice'); toast.show(`이전에 생성 중 앱이 닫혀 결과를 받지 못한 ${n}운을 돌려드렸어요`, 'success'); }
      const comp = localStorage.getItem('saju500:comp_notice');
      if (comp) { localStorage.removeItem('saju500:comp_notice'); toast.show(`고객센터 보상 ${comp}운이 적립됐어요. 불편을 드려 죄송합니다`, 'success'); }
      // 2026-10-15 — 음력 생일 계산 정정(계산 기준 v4) 안내 한 번
      const lunarFix = localStorage.getItem('saju500:lunar_fix_notice');
      if (lunarFix) { localStorage.removeItem('saju500:lunar_fix_notice'); toast.show('음력 생일을 양력으로 바꿔 계산하도록 바로잡았어요. 음력으로 넣은 사주가 새로 계산됐어요', 'info'); }
      const prem = localStorage.getItem('saju500:premium_recovered');
      if (prem) { localStorage.removeItem('saju500:premium_recovered'); toast.show('이전에 받지 못한 종합사주 결과를 보관함에 저장했어요', 'success'); }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 다른 화면의 '주제별 운세 더 보기'(/#home-topics) 진입 시 고민 섹션으로
  useEffect(() => {
    if (window.location.hash !== '#home-topics') return;
    const t = setTimeout(() => document.getElementById('home-topics')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
    return () => clearTimeout(t);
  }, []);

  // 날짜·무료 패스 — 자정(KST)·다른 화면 사용·앱 복귀 때 다시 계산
  const [today, setToday] = useState(() => kstToday());
  const [dailyFree, setDailyFree] = useState(() => hasFreePass('daily'));
  const [dreamFree, setDreamFree] = useState(() => hasFreePass('dream'));
  useEffect(() => {
    const refresh = () => { setToday(kstToday()); setDailyFree(hasFreePass('daily')); setDreamFree(hasFreePass('dream')); };
    refresh();
    return subscribeFreePass(refresh);
  }, []);

  const [reviews, setReviews] = useState<PublicReview[]>([]);
  useEffect(() => {
    let alive = true;
    getPublicReviews(10).then((r) => { if (alive) setReviews(r); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const [showAllTopics, setShowAllTopics] = useState(false);
  /* 세대 (2026-10-15 오너: 20대 취준생 말투만 있으면 50~60대의 재취업, 창업, 재혼, 새 출발이 빠진다)
   *   나이 근거: 사주가 있으면 출생 연도, 없으면 띠 운세에서 고른 '내 해'. 둘 다 없으면 누구에게나 맞는 말. */
  const [ttiYear, setTtiYear] = useState<number | undefined>(() => getMyTti()?.year);

  /* 지금 많이 보는 풀이 — 서버 매시 집계(최근 24시간 실제 조회, 1인 1주제 하루 1회)만. 숫자는 보여 주지 않고 순서만.
   *   예전 홈은 데이터가 모자라면 종합사주 1위 고정 + 날짜 셔플로 채웠다(가짜 순위) → 3개 미만이면 섹션을 숨긴다. */
  const [liveIds, setLiveIds] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    getTopicTop5(1).then((c) => { if (alive) setLiveIds(c?.ids ?? []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  /* ── 사실 계산 (사주 있을 때만 · 결정론) ── */
  const facts = useMemo(() => {
    if (!hasSaju || !sajuData) return null;
    try {
      return {
        today: todayHook(sajuData, today),
        week: weekFact(sajuData, today),
        month: nextMonthFact(sajuData, today),
        love: loveDday(sajuData, today),
        year: yearFact(sajuData, NEW_YEAR_TARGET),
        loveStars: loveStars(sajuData),
        wealth: wealthStars(sajuData),
        exam: examFact(sajuData),
        spouse: spouseSeatFact(sajuData),
        persona: persona(sajuData),
      };
    } catch { return null; }
  }, [hasSaju, sajuData, today]);
  const wealthMonth = useMemo(() => (hasSaju && sajuData ? nextStarMonth(sajuData, today, ['재성']) : null), [hasSaju, sajuData, today]);
  const examMonth = useMemo(() => (hasSaju && sajuData ? nextStarMonth(sajuData, today, ['관성', '인성']) : null), [hasSaju, sajuData, today]);
  const tg = useMemo(() => todayGz(today), [today]);
  const ny = useMemo(() => yearGz(NEW_YEAR_TARGET), []);
  const gotDaily = hasSaju && receivedDailyToday(profile, today);
  const birthYear = hasSaju ? Number((profile as any)?.input?.birthYear) || undefined : ttiYear;
  const age = birthYear ? Number(today.slice(0, 4)) - birthYear : null;
  /** young 34세까지, mid 35~49세, senior 50세부터, null 모름 */
  const gen: 'young' | 'mid' | 'senior' | null = age == null ? null : age >= 50 ? 'senior' : age >= 35 ? 'mid' : 'young';

  const premium = getPremiumPrice().actualPrice;
  const weekly = getWeeklyPrice().actualPrice;
  const monthly = getMonthlyPrice().actualPrice;
  const tojungInfo = getTojungPrice();
  const tojung = tojungInfo.actualPrice;
  const compat = PRODUCT_COST.compatibility;

  /** 올해가 아닌 날짜엔 '내년 ' — '2월'만 쓰면 올해 2월로 읽힌다 */
  const yr = (dateKey: string) => (Number(dateKey.slice(0, 4)) > Number(today.slice(0, 4)) ? '내년 ' : '');
  const goTopic = (id: string) => navigate(`/topic/${id}`, profileId ? { state: { profileId } } : undefined);
  const liveBest = liveIds.map((id) => {
    if (id === 'premium') return { id, label: '종합사주', sub: '타고난 성격부터 10년 대운까지', price: `${premium}운`, go: () => navigate('/premium') };
    if (id === 'daily') return { id, label: '오늘의 운세', sub: '오늘 좋은 시간과 조심할 일, 하루 한 번 무료', price: dailyFree ? '무료' : '1운', go: () => navigate('/daily') };
    if (id === 'dream') return { id, label: '꿈해몽', sub: '어젯밤 꾼 꿈 풀이, 하루 한 번 무료', price: dreamFree ? '무료' : '1운', go: () => navigate('/dream') };
    const t = (TOPIC_REGISTRY as Record<string, { label: string; subCopy: string } | undefined>)[id];
    return t ? { id, label: t.label, sub: t.subCopy, price: `${getTopicPrice(id as TopicId).actualPrice}운`, go: () => goTopic(id) } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 5);
  /** '다른 점' 예시 — 이 사람 실제 날짜가 있으면 그걸로 (없으면 보기 값) */
  const whyExample = `${facts?.month ? `${facts.month.month.calMonth}월` : '11월'}, ${facts?.week ? `${Number(facts.week.date.slice(8))}일 ${facts.week.weekday}요일` : '18일 일요일'}, ${facts?.today ? facts.today.peak.split('~')[0] : '저녁 7시 반'}`;
  const withPid = (path: string) => (profileId ? `${path}${path.includes('?') ? '&' : '?'}profileId=${encodeURIComponent(profileId)}` : path);

  return (
    <div style={{ background: HJ.paper, minHeight: '100vh', paddingBottom: 112, color: HJ.ink }}>

      {/* ━━━ 1. 오늘 예고 ━━━ */}
      <section style={{ position: 'relative' }}>
        <div aria-hidden="true" style={{
          // 사주 없는 첫 화면은 띠 표와 운세 카드가 한 화면에 들어오게 그림을 낮춘다 (2026-10-15)
          height: hasSaju ? 330 : 214, position: 'relative', backgroundColor: '#ECE4D3',
          backgroundImage: `url(${ART.gaehwasa})`, backgroundRepeat: 'no-repeat', backgroundSize: '128% auto', backgroundPosition: '40% 0',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(244,239,228,.0) 0%, rgba(244,239,228,0) 48%, rgba(244,239,228,.85) 82%, ${HJ.paper} 100%)` }} />
        </div>
        <div style={{ position: 'relative', marginTop: -64, padding: '0 22px' }}>
          <div className="flex items-center gap-2" style={{ fontSize: 14, color: HJ.ink2, fontWeight: 600 }}>
            <Seal size={36}>{tg.gz}</Seal>
            <span>{todayLabel(today)}, {hasSaju ? `${displayName} 님 오늘의 운세` : `오늘은 ${tg.ko}일`}</span>
          </div>

          {hasSaju ? (
            gotDaily ? (
              <>
                <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, lineHeight: 1.42, letterSpacing: '-.03em', marginTop: 14 }}>
                  {todayLine}
                </h1>
                <GoldCta style={{ marginTop: 18 }} onClick={() => navigate('/daily')}>오늘 운세 다시 보기</GoldCta>
                <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 10 }}>오늘 받은 풀이를 그대로 다시 열어요</p>
              </>
            ) : (
              <>
                {facts?.today ? (
                  <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 29, lineHeight: 1.38, letterSpacing: '-.03em', marginTop: 14 }}>
                    {facts.today.avoid}에는<br />
                    <span style={{ background: 'linear-gradient(transparent 70%, rgba(184,150,90,.34) 70%)' }}>큰 결정을 미루세요.</span>
                  </h1>
                ) : (
                  <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, lineHeight: 1.45, letterSpacing: '-.02em', marginTop: 14 }}>
                    {todayLine}
                  </h1>
                )}
                {facts?.today && (
                  <div style={{ marginTop: 16, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 12, padding: '13px 15px', fontSize: 15, lineHeight: 1.65, color: HJ.ink2 }}>
                    <b style={{ color: HJ.ink }}>가장 좋은 시간은 {facts.today.peak}</b>이에요.
                    {' '}오늘 할 일과 피할 일도 같이 확인해 보세요.
                  </div>
                )}
                <GoldCta style={{ marginTop: 16 }} onClick={() => navigate('/daily')} sub={dailyFree ? '무료' : '1운'}>
                  오늘 운세 전부 열기
                </GoldCta>
                <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 10 }}>
                  {dailyFree ? '오늘 1회 무료, 결제 없이 바로 열려요' : '오늘 무료 1회는 썼어요, 두 번째부터 1운'}
                </p>
              </>
            )
          ) : (
            <>
              {/* 2026-10-15 — 혜택탭 50~60대가 입력 앞에서 나가던 문제: 띠만 누르면 바로 읽히게 (신문 띠별 운세) */}
              <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 27, lineHeight: 1.4, letterSpacing: '-.03em', marginTop: 14 }}>
                {ttiYear ? (
                  <>{yearLabel(ttiYear)} {ttiName(ttiOfYear(ttiYear))},<br />
                    <span style={{ background: 'linear-gradient(transparent 70%, rgba(184,150,90,.34) 70%)' }}>오늘 운세예요.</span></>
                ) : (
                  <>내 띠를 누르면<br />
                    <span style={{ background: 'linear-gradient(transparent 70%, rgba(184,150,90,.34) 70%)' }}>오늘 운세가 바로 보여요.</span></>
                )}
              </h1>
              <div style={{ marginTop: 16 }}>
                <TtiFortune today={today} dayGz={tg.gz} dayKo={tg.ko} src="hero" onYearPick={setTtiYear}
                  onInput={(y) => navigate(`/input?from=daily${y ? `&y=${y}` : ''}`)}
                  newYear={{ year: NEW_YEAR_TARGET, gz: ny.gz, ko: ny.ko, price: tojung, badge: tojungInfo.launch?.badge }}
                  onNewYear={() => navigate('/tojung')} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* ━━━ 2. 오늘 무료 (꿈은 먹 카드, 대화는 한지 카드 — 명암으로 바로 갈리게) ━━━ */}
      <div style={{ padding: '32px 16px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: HJ.mute, padding: '0 6px' }}>오늘 무료로 볼 수 있어요</div>
        <div className="grid grid-cols-2 gap-2.5" style={{ marginTop: 10 }}>
          <button type="button" onClick={() => navigate('/dream')} className="text-left"
            style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '16px 15px', minHeight: 200, background: HJ.ink, color: '#F1ECE1', display: 'flex', flexDirection: 'column', gap: 8, border: 0 }}>
            <svg width="70" height="70" viewBox="0 0 70 70" aria-hidden="true" style={{ position: 'absolute', right: 8, top: 10 }}>
              <path d="M44 12a24 24 0 1 0 14 40A20 20 0 1 1 44 12z" fill="none" stroke={HJ.gold} strokeWidth="1.6" />
            </svg>
            <Seal size={32} fontSize={18}>夢</Seal>
            <span style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, lineHeight: 1.35, marginTop: 4 }}>어젯밤 꿈,<br />무슨 뜻일까</span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, color: '#CFC6B6', flex: 1 }}>어젯밤 꾼 꿈을 적어 보세요</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#D2B477' }}>꿈해몽 {dreamFree ? '무료' : '1운'} ›</span>
          </button>
          <button type="button" onClick={() => navigate('/chat')} className="text-left"
            style={{ borderRadius: 16, padding: '16px 15px', minHeight: 200, background: HJ.card, border: `1px solid ${HJ.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Seal size={32} fontSize={18}>問</Seal>
            <span style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, lineHeight: 1.35, marginTop: 4, color: HJ.ink }}>
              {gen === 'young' ? <>“이직해도<br />될까요?”</> : gen === 'mid' ? <>“지금 옮겨도<br />될까요?”</> : <>“새로 시작해도<br />될까요?”</>}
            </span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, color: HJ.ink2, flex: 1 }}>고민을 물어보면 내 사주로 답해 드려요</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: HJ.ink }}>첫 질문 무료 ›</span>
          </button>
        </div>
      </div>

      {/* ━━━ 2-1. 가족 띠 운세 (사주 있는 사람) — 배우자, 자녀, 부모님 띠도 오늘 운세를 한 번에 ━━━ */}
      {hasSaju && (
        <>
          <SecTitle k="띠별 오늘의 운세" h="가족 띠도 오늘 운세를 볼 수 있어요" />
          <div style={{ margin: '0 16px' }}>
            <TtiFortune today={today} dayGz={tg.gz} dayKo={tg.ko} src="family"
              onInput={() => navigate('/input?new=1&from=daily')} compatPrice={compat} onCompat={() => navigate('/compat')} />
          </div>
        </>
      )}

      {/* ━━━ 3. 사주책 (종합사주) — 오너가 좋다고 한 책, 대운 띠, 목차 그대로 ━━━ */}
      <SecTitle k="평생 한 번 읽는 종합사주" h="타고난 성격부터 10년 대운까지" />
      {/* 2026-10-15 오너: 책을 눌러도 종합사주로 — 책 그림, 소개, 대운 띠, 목차 어디를 눌러도 같은 곳으로 */}
      <button type="button" onClick={() => navigate('/premium')} aria-label="종합사주 보기"
        style={{ display: 'block', width: 'calc(100% - 32px)', margin: '0 16px', padding: 0, border: 0, borderRadius: '20px 20px 0 0', height: 318, position: 'relative', overflow: 'hidden', background: '#E9E0CD', cursor: 'pointer' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${ART.jangansa})`, backgroundSize: 'cover', backgroundPosition: '40% 55%', opacity: 0.42 }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 55%, rgba(233,224,205,0) 30%, rgba(233,224,205,.7) 100%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)' }}>
          <GoBook title={facts?.persona ? `${facts.persona.dayGz}命書` : '四柱命書'} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontSize: 13, color: HJ.ink2, fontWeight: 600 }}>
          {facts?.persona ? `${displayName}, ${facts.persona.birthYearGz}生: 8글자로 엮은 열 장` : '태어난 날과 시간으로 엮는 열 장'}
        </div>
      </button>
      <section style={{ margin: '0 16px', background: HJ.card, border: `1px solid ${HJ.line}`, borderTop: 0, borderRadius: '0 0 20px 20px', padding: 18 }}>
        <div role="link" tabIndex={0} aria-label="종합사주 자세히 보기" style={{ cursor: 'pointer' }}
          onClick={() => navigate('/premium')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/premium'); } }}>
        {facts?.persona?.identity ? (
          <>
            <p style={{ fontFamily: SERIF, fontSize: 19.5, fontWeight: 700, lineHeight: 1.5, letterSpacing: '-.02em' }}>
              {displayName} 님은 <span style={{ color: HJ.goldText }}>{facts.persona.identity}</span>{josa(facts.persona.identity, '으로', '로')} 태어났어요.
            </p>
            <p style={{ fontSize: 14, color: HJ.mute, marginTop: 6, lineHeight: 1.6 }}>
              {facts.persona.dayGz}일주에서 시작해 돈, 사랑, 일, 건강까지 열 장으로 풀어요.
            </p>
          </>
        ) : (
          <p style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, lineHeight: 1.5 }}>
            태어난 날의 8글자에서 시작해 돈, 사랑, 일, 건강까지 열 장으로 풀어요.
          </p>
        )}

        {facts?.persona && facts.persona.daeun.length >= 4 && (
          <div style={{ marginTop: 16 }}>
            <div className="flex justify-between" style={{ fontSize: 14, fontWeight: 800 }}>
              10년마다 바뀌는 운 <span style={{ color: HJ.mute, fontWeight: 600, fontSize: 13 }}>지금과 다음</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${facts.persona.daeun.length}, 1fr)`, gap: 3, marginTop: 10 }}>
              {facts.persona.daeun.map((d, i) => {
                const now = i === facts.persona!.currentIdx;
                const nx = i === facts.persona!.currentIdx + 1;
                return (
                  <div key={i} style={{
                    textAlign: 'center', padding: '7px 0 6px', borderRadius: 6, fontSize: 13,
                    background: now ? HJ.ink : HJ.paper, color: now ? '#D8CDB9' : HJ.mute,
                    outline: nx ? `1.5px dashed ${HJ.gold}` : undefined, outlineOffset: -1.5,
                  }}>
                    <b style={{ display: 'block', fontFamily: SERIF, fontSize: 14.5, color: now ? '#FFF8EA' : HJ.ink2, fontWeight: 700, lineHeight: 1.2 }}>{d.gz}</b>
                    {d.age}세
                  </div>
                );
              })}
            </div>
            {facts.persona.current && (
              <p style={{ fontSize: 15, color: HJ.ink2, marginTop: 10, lineHeight: 1.65 }}>
                지금은 <b style={{ color: HJ.ink }}>{facts.persona.current.gz} 대운</b>({facts.persona.current.from}~{facts.persona.current.to}세)
                {facts.persona.nextYear ? <>, 다음 10년이 바뀌는 해는 <b style={{ color: HJ.ink }}>{facts.persona.nextYear}년</b>이에요.</> : '이에요.'}
                {' '}인생에서 가장 좋은 10년은 <Redact w={92} />
              </p>
            )}
          </div>
        )}

        <Gwang title={facts?.persona ? `${facts.persona.dayGz}命書 目次` : '命書 目次'} style={{ marginTop: 16 }} bodyStyle={{ padding: '4px 14px 8px' }}>
          <TocRow no={1} t="진짜 강점 3, 빠지기 쉬운 함정 3" pv={hasSaju ? <>첫 번째 함정: <Redact w={110} /></> : '내 사주가 자꾸 되풀이하는 습관'} />
          <TocRow no={2} t="돈, 사랑, 일, 건강, 사람, 공부 점수" pv={hasSaju ? <>가장 강한 영역 <Redact w={44} lock={false} /> 가장 약한 영역 <Redact w={44} /></> : '여섯 영역의 강약을 한눈에'} />
          <TocRow no={3} t="나에게 부족한 기운과 채우는 법" pv="색, 방위, 계절, 습관까지" />
          <TocRow no={4} t="오늘부터 바꿀 다섯 가지" pv="읽고 끝나지 않게 할 일로 정리해 드려요" />
          <p style={{ fontSize: 13.5, color: HJ.mute, textAlign: 'center', padding: '10px 0 2px' }}>원국, 십성, 대운, 신살, 올해 흐름까지 여섯 장이 더 있어요</p>
        </Gwang>
        </div>
        <p style={{ marginTop: 14, fontSize: 13.5, color: HJ.ink2, lineHeight: 1.6, textAlign: 'center', wordBreak: 'keep-all' }}>
          한 번 사면 평생 보관하고 PDF로 저장할 수 있어요. 다 읽고 궁금한 건 바로 물어보세요.
        </p>
        <GoldCta style={{ marginTop: 14 }} onClick={() => navigate('/premium')} sub={`${premium}운`}>
          {hasSaju ? '내 종합사주 보기' : '종합사주 보기'}
        </GoldCta>
      </section>

      {/* ━━━ 4. 신년운세 (그림 띠) ━━━ */}
      <button type="button" onClick={() => navigate('/tojung')} className="text-left"
        style={{ display: 'block', margin: '14px 16px 0', width: 'calc(100% - 32px)', borderRadius: 18, overflow: 'hidden', position: 'relative', border: 0, background: HJ.ink, color: '#F1ECE1', padding: 0 }}>
        <div aria-hidden="true" style={{ height: 168, backgroundImage: `url(${ART.inwang})`, backgroundSize: '190% auto', backgroundPosition: '30% 40%', backgroundRepeat: 'no-repeat' }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(26,22,18,.9) 0%, rgba(26,22,18,.6) 62%, rgba(26,22,18,.25) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <div className="flex items-center gap-2">
            <Seal size={28} fontSize={15}>歲</Seal>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#D2B477' }}>{NEW_YEAR_TARGET} 신년운세, {ny.ko}년</span>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1.4 }}>
            {facts?.year?.cat
              ? <>{NEW_YEAR_TARGET}년에는<br />{STAR_LUCK[facts.year.cat]}{josa(STAR_LUCK[facts.year.cat], '이', '가')} 들어와요</>
              : <>{NEW_YEAR_TARGET}년은 나에게<br />어떤 해일까요</>}
          </div>
          <div style={{ fontSize: 14, color: '#E2D9C8' }}>달마다 좋은 날까지 알려 드려요 <b style={{ color: '#F1ECE1' }}>{tojung}운 ›</b></div>
          {tojungInfo.launch && <div style={{ fontSize: 13, color: '#D2B477' }}>{tojungInfo.launch.badge} 가격, {tojungInfo.launch.note}</div>}
        </div>
      </button>

      {/* ━━━ 5. 기간별 (달력 장 두 장 — 큰 숫자로 읽기 전에 보이게) ━━━ */}
      <SecTitle k="기간별 운세" h="이번 주와 다음 달 미리 보기" />
      <div className="grid grid-cols-2 gap-2.5" style={{ margin: '0 16px' }}>
        <button type="button" onClick={() => navigate('/weekly', profileId ? { state: { profileId } } : undefined)} className="text-left"
          style={{ borderRadius: 14, background: HJ.card, border: `1px solid ${HJ.line}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
          <CalHead l="週 이번 주" r={`${weekly}운`} />
          <span style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {facts?.week ? (
              <>
                <span className="flex items-center gap-2.5">
                  <span style={{ width: 56, height: 56, borderRadius: 28, boxShadow: `inset 0 0 0 2px ${HJ.seal}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 30, fontWeight: 900, color: HJ.seal, flexShrink: 0 }}>
                    {Number(facts.week.date.slice(8))}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.45, color: HJ.ink }}>{facts.week.weekday}요일<br /><span style={{ fontFamily: SERIF }}>{facts.week.gz}일</span></span>
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: HJ.ink2, marginTop: 4 }}>{weekLine(facts.week)}</span>
              </>
            ) : (
              <>
                <span style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 900, lineHeight: 1, color: HJ.ink }}>7<span style={{ fontSize: 18 }}>일</span></span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: HJ.ink2 }}>오늘부터 7일, 날마다 좋은 일과 조심할 일을 알려 드려요</span>
              </>
            )}
          </span>
        </button>
        <button type="button" onClick={() => navigate(withPid(facts?.month ? `/monthly?month=${facts.month.month.start.slice(0, 7)}` : '/monthly'))} className="text-left"
          style={{ borderRadius: 14, background: HJ.card, border: `1px solid ${HJ.line}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
          <CalHead l="月 다음 달" r={`${monthly}운`} />
          <span style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {facts?.month ? (
              <>
                <span style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 900, lineHeight: 1, color: HJ.ink }}>
                  {facts.month.month.calMonth}<span style={{ fontSize: 20 }}>월</span>
                </span>
                <span style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 700, color: HJ.ink }}>{yr(facts.month.month.start)}{facts.month.month.gz}월, {monthDayLabel(facts.month.month.start)}부터</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: HJ.ink2 }}>{monthLine(facts.month)}</span>
              </>
            ) : (
              <>
                <span style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 900, lineHeight: 1, color: HJ.ink }}>한 달</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: HJ.ink2 }}>원하는 달 하나의 돈, 일, 사람 흐름을 깊게 풀어요</span>
              </>
            )}
          </span>
        </button>
      </div>

      {/* ━━━ 6. 고민 (주제운) — 많이 찾는 셋은 빨간 도장, 나머지는 먹 테두리 ━━━ */}
      <div id="home-topics" style={{ scrollMarginTop: 72 }}>
        <SecTitle k="요즘 많이 찾는 고민" h="어떤 고민이 있으세요?" />
      </div>
      <div style={{ margin: '0 16px' }}>
        <button type="button" onClick={() => goTopic('love')} className="w-full text-left"
          style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: 16 }}>
          <SealBox size={52} fontSize={28}>{TOPIC_REGISTRY.love.kanji}</SealBox>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: HJ.ink }}>연애운</span>
            <span style={{ display: 'block', fontSize: 14.5, lineHeight: 1.55, color: HJ.ink2, marginTop: 4 }}>
              {facts?.love ? '새 인연이 들어오는 날까지' : facts ? '사주에 있는 연인의 별' : '새 인연이 들어오는 날을 D-day로 알려 드려요'}
            </span>
            <span className="flex justify-between items-baseline" style={{ marginTop: 6 }}>
              <span style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 900, color: HJ.seal, lineHeight: 1.1 }}>
                {facts?.love ? `D-${facts.love.days}` : facts ? `${facts.loveStars.count}개` : 'D-?'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: HJ.ink }}>{getTopicPrice('love').actualPrice}운 ›</span>
            </span>
            {facts?.love && (
              <span style={{ display: 'block', fontSize: 13.5, color: HJ.mute, marginTop: 4 }}>
                {yr(facts.love.month.start)}{monthDayLabel(facts.love.month.start)}부터 연인의 별이 들어와요
              </span>
            )}
          </span>
        </button>
        <div className="grid grid-cols-2 gap-2.5" style={{ marginTop: 10 }}>
          <button type="button" onClick={() => goTopic('wealth')} className="text-left"
            style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: 15, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 168 }}>
            <SealBox size={40} fontSize={22}>{TOPIC_REGISTRY.wealth.kanji}</SealBox>
            <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: HJ.ink }}>재물운</span>
            {wealthMonth ? (
              <>
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: HJ.ink2 }}>재물의 별이 들어오는 달</span>
                <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 900, color: HJ.seal, lineHeight: 1.1, flex: 1 }}>
                  {yr(wealthMonth.month.start)}{wealthMonth.month.calMonth}<span style={{ fontSize: 15 }}>월</span>
                </span>
              </>
            ) : (
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: HJ.ink2, flex: 1 }}>돈이 <b style={{ color: HJ.ink }}>들어오는 달</b>과 새는 곳</span>
            )}
            <span style={{ fontSize: 14, fontWeight: 800, textAlign: 'right', color: HJ.ink }}>{getTopicPrice('wealth').actualPrice}운 ›</span>
          </button>
          <button type="button" onClick={() => goTopic('reunion')} className="text-left"
            style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: 15, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 168 }}>
            <SealBox size={40} fontSize={22}>{TOPIC_REGISTRY.reunion.kanji}</SealBox>
            <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: HJ.ink }}>재회운</span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, color: HJ.ink2, flex: 1 }}>그 사람과 <b style={{ color: HJ.ink }}>다시 연락이 닿을 때</b>를 두 사람 사주로 봐요</span>
            <span style={{ fontSize: 14, fontWeight: 800, textAlign: 'right', color: HJ.ink }}>{getTopicPrice('reunion').actualPrice}운 ›</span>
          </button>
        </div>
        <div style={{ marginTop: 10, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, overflow: 'hidden' }}>
          {/* 2026-10-15 세대별 — 50대부터는 재취업, 창업, 재혼, 건강을 앞에. 나이를 모르면 누구에게나 맞는 말 */}
          {(() => {
            const em = examMonth ? `${yr(examMonth.month.start)}${examMonth.month.calMonth}월` : '';
            const rows: Array<{ key: string; hz: string; t: string; s: string; price: string; go: () => void }> = [];
            const topicRow = (id: TopicId, t: string, s2: string) => ({ key: id, hz: TOPIC_REGISTRY[id].kanji, t, s: s2, price: `${getTopicPrice(id).actualPrice}운`, go: () => goTopic(id) });
            const exam = gen === 'senior'
              ? topicRow('exam', '재취업 이직운', em ? `일자리의 별이 ${em}에 들어와요` : '다시 일을 구하거나 옮기기 좋은 달')
              : gen === 'mid'
                ? topicRow('exam', '이직운', em ? `옮길 자리의 별이 ${em}에 들어와요` : '옮기기 좋은 달과 버텨야 할 때')
                : gen === 'young'
                  ? topicRow('exam', '합격 이직운', em ? `시험과 자리의 별이 ${em}에 들어와요` : '합격 소식이 오는 달과 면접 보기 좋은 날')
                  : topicRow('exam', '합격 이직운', em ? `시험과 자리의 별이 ${em}에 들어와요` : '시험, 취업, 이직, 다시 일할 때가 풀리는 달');
            const business = topicRow('business', gen === 'senior' ? '창업운' : '사업운', gen === 'senior' ? '가게나 내 일을 차리기 좋은 때' : '내 일을 시작하거나 넓히기 좋은 때');
            const marriage = gen === 'senior'
              ? topicRow('marriage', '결혼, 재혼운', '다시 함께할 사람이 들어오는 해')
              : topicRow('marriage', '결혼운', facts ? facts.spouse : '결혼하기 좋은 해와 배우자 성향');
            const compatRow = { key: 'compat', hz: '合', t: '궁합', s: gen === 'senior' ? '배우자, 자녀와 잘 맞는 점과 부딪히는 점' : '잘 맞는 점과 자주 부딪히는 점', price: `${compat}운`, go: () => navigate('/compat') };
            const health = topicRow('health', '건강운', '약한 곳과 조심할 달');
            const main = gen === 'senior' ? [exam, business, marriage, compatRow, health]
              : gen === 'young' ? [exam, compatRow, marriage]
              : [exam, business, compatRow, marriage];
            rows.push(...main);
            if (showAllTopics) {
              const shown = new Set(main.map((r) => r.key));
              for (const id of ['career', 'business', 'health', 'move', 'study'] as TopicId[]) {
                if (!shown.has(id)) rows.push(topicRow(id, TOPIC_REGISTRY[id].label, TOPIC_REGISTRY[id].subCopy));
              }
            }
            return rows.map((r, i) => (
              <TopicLine key={r.key} hz={r.hz} t={r.t} s={r.s} price={r.price} onClick={r.go} last={i === rows.length - 1} />
            ));
          })()}
        </div>
      </div>
      {!showAllTopics && (
        <button type="button" onClick={() => setShowAllTopics(true)}
          style={{ display: 'block', width: 'calc(100% - 32px)', margin: '10px 16px 0', padding: 14, fontSize: 15, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
          고민 {listTopics().length}가지 전부 보기 ›
        </button>
      )}

      {/* ━━━ 6-1. 지금 많이 보는 풀이 (실제 집계만 · 3개 미만이면 숨김) ━━━ */}
      {liveBest.length >= 3 && (
        <>
          <SecTitle k="실시간 인기" h="지금 많이 보는 풀이" />
          <ol style={{ margin: '0 16px', borderTop: `1px solid ${HJ.line}`, listStyle: 'none', padding: 0 }}>
            {liveBest.map((it, i) => (
              <li key={it.id} style={{ borderBottom: `1px solid ${HJ.line}` }}>
                <button type="button" onClick={it.go} className="w-full text-left flex items-center gap-3" style={{ padding: '14px 2px', minHeight: 56, background: 'transparent', border: 0 }}>
                  <span style={{ fontFamily: SERIF, fontWeight: 900, color: HJ.seal, width: 18, flexShrink: 0 }}>{hanjaNum(i + 1)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: SERIF, fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', color: HJ.ink }}>{it.label}</span>
                    <span style={{ display: 'block', fontSize: 13.5, color: HJ.mute, marginTop: 2, lineHeight: 1.5 }}>{it.sub}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: HJ.ink, whiteSpace: 'nowrap' }}>{it.price}</span>
                </button>
              </li>
            ))}
          </ol>
          <p style={{ margin: '8px 22px 0', fontSize: 13, color: HJ.mute, lineHeight: 1.5 }}>최근 24시간 동안 실제로 열어 본 순서예요. 한 사람이 같은 풀이를 여러 번 열어도 하루 한 번으로 세요.</p>
        </>
      )}

      {/* ━━━ 7. 실제 후기 (승인된 것만 · 없으면 숨김) ━━━ */}
      {reviews.length > 0 && (
        <>
          <SecTitle k="먼저 본 사람들" h="읽어본 사람들이 남긴 말" />
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar" style={{ padding: '0 16px 4px' }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ flex: '0 0 270px', background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 13, color: HJ.goldText, fontWeight: 800 }} aria-label={`별점 ${r.rating}점`}>
                  {'★'.repeat(r.rating)}<span style={{ color: HJ.line }}>{'★'.repeat(5 - r.rating)}</span>
                </div>
                <p style={{ fontSize: 15.5, lineHeight: 1.65, marginTop: 8, color: HJ.ink }}>“{r.text}”</p>
                <p style={{ fontSize: 13, color: HJ.mute, marginTop: 10 }}>{reviewByline(r)}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ━━━ 8. 사주500이 다른 점 (먹 띠) ━━━ */}
      <section id="voices-section" style={{ margin: '36px 0 0', background: HJ.ink, color: '#F1ECE1', padding: '30px 22px 32px', scrollMarginTop: 72 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#D2B477' }}>사주500이 다른 점</div>
        <h2 style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 700, lineHeight: 1.38, letterSpacing: '-.025em', marginTop: 6 }}>
          <span style={{ color: '#D2B477' }}>언제</span> 좋아지는지까지<br />알려 드려요
        </h2>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Why no={1} b="날짜와 시간까지 알려 드려요">
            운이 좋아지는 달, 조심해야 할 날, 좋은 시간대를 <span style={{ color: '#F1ECE1' }}>{whyExample}</span>처럼 콕 집어 드려요.
          </Why>
          <Why no={2} b="내 사주를 근거로 풀어요">
            누구에게나 해당되는 뻔한 말은 쓰지 않아요. <span style={{ color: '#F1ECE1' }}>왜 그렇게 보는지</span> 내 사주 글자로 보여 드려요.
          </Why>
          <Why no={3} b="읽다가 궁금하면 바로 물어보세요">
            풀이를 읽다가 생긴 궁금증은 사주대화에서 이어서 물어볼 수 있어요.
          </Why>
        </div>
      </section>

      {/* ━━━ 푸터 ━━━ */}
      <div style={{ margin: '26px 16px 0', textAlign: 'center' }}>
        <div className="flex items-center justify-center gap-3" style={{ fontSize: 13.5, color: HJ.mute }}>
          <button className="tap-pad" type="button" onClick={() => navigate('/my')}>내 정보</button>
          <span style={{ color: HJ.line }}>|</span>
          <button className="tap-pad" type="button" onClick={() => navigate('/charge')}>충전</button>
          <span style={{ color: HJ.line }}>|</span>
          <button className="tap-pad" type="button" onClick={() => navigate('/storage')}>보관함</button>
        </div>
        <p style={{ marginTop: 12, fontSize: 13.5, color: HJ.mute, lineHeight: 1.6 }}>{ART_CREDIT}</p>
        <p style={{ marginTop: 6, fontSize: 13.5, color: HJ.mute }}>© 2026 사주500</p>
      </div>
      <LegalFooter />
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </div>
  );
}

/* ─── 작은 부품 (홈 전용) ─── */
/** 후기 아래 한 줄 (2026-10-15) — 무료로도 볼 수 있는 오늘의 운세, 꿈해몽 후기에는 '구매자'라고 쓰지 않는다.
 *  상품명은 지금 이름으로 맞춘다(예전에 저장된 '월간 운세' 등). */
const REVIEW_PAID_TYPES = new Set(['premium', 'topic', 'tojung', 'monthly', 'weekly', 'compat']);
const REVIEW_LABEL: Record<string, string> = {
  premium: '종합사주', tojung: '신년운세', monthly: '월운세', weekly: '주간운세', compat: '궁합', daily: '오늘의 운세', dream: '꿈해몽',
};
function reviewByline(r: PublicReview): string {
  const label = REVIEW_LABEL[r.contentType] || r.contentLabel;
  const who = REVIEW_PAID_TYPES.has(r.contentType) ? '구매자' : '이용자';
  return `${label} ${who}${r.month ? ` (${r.month}월)` : ''}`;
}

function SecTitle({ k, h }: { k: string; h: string }) {
  return (
    <div style={{ padding: '34px 22px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: HJ.mute }}>{k}</div>
      <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.4, marginTop: 4 }}>{h}</h2>
    </div>
  );
}

/** 이번 주 하루 — 구조 사실을 생활 말로 (hookFacts.weekFact 의 kind 기준, 사실과 다른 말 금지) */
function weekLine(w: WeekFact): string {
  switch (w.kind) {
    case 'love-hap': return '이번 주 인연운이 가장 좋은 날이에요';
    case 'star-hap': { const l = w.cat ? STAR_LUCK[w.cat] : '운'; return `이번 주 ${l}${josa(l, '이', '가')} 가장 좋은 날이에요`; }
    case 'love': return '연애운이 들어오는 날이에요';
    case 'ji-hap': return '가까운 사람과 마음이 잘 맞는 날이에요';
    case 'ji-chung': return '이번 주 가장 조심해야 하는 날이에요';
    default: return w.text;
  }
}
/** 다음 달 — 구조 사실을 생활 말로 (hookFacts.nextMonthFact 의 kind 기준) */
function monthLine(m: MonthFact): string {
  const l = m.cat ? STAR_LUCK[m.cat] : '';
  switch (m.kind) {
    case 'samhap': return '1년에 한 번, 사주에 기운이 크게 모이는 달이에요';
    case 'ji-hap': return '가까운 사람과 일이 잘 풀리는 달이에요';
    case 'ji-chung': return '큰 변화가 오는 달이에요. 미리 준비하면 좋아요';
    case 'star-hap': return `${l}${josa(l, '이', '가')} 크게 열리는 달이에요`;
    case 'yongsin': return '내 사주에 가장 필요한 기운이 들어오는 달이에요';
    case 'star': return `${l}${josa(l, '이', '가')} 들어오는 달이에요`;
    default: return m.title;
  }
}

/** 달력 장 머리 (먹 띠) */
function CalHead({ l, r }: { l: string; r: string }) {
  return (
    <span style={{ height: 32, background: HJ.ink, color: '#F1ECE1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 13, fontWeight: 800 }}>
      <span>{l}</span><span style={{ color: '#D2B477' }}>{r}</span>
    </span>
  );
}

/** 빨간 도장 칸 (많이 찾는 고민) */
function SealBox({ children, size, fontSize }: { children: ReactNode; size: number; fontSize: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 6, background: HJ.seal, color: HJ.paper, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize, fontWeight: 900, flexShrink: 0, boxShadow: 'inset 0 0 0 1.5px rgba(244,239,228,.25)' }}>
      {children}
    </span>
  );
}

/** 고민 목록 한 줄 (먹 테두리 도장) */
function TopicLine({ hz, t, s, price, onClick, last }: { hz: string; t: string; s: string; price: string; onClick: () => void; last?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left flex items-center gap-3"
      style={{ padding: '13px 15px', borderBottom: last ? 0 : '1px solid #EDE6D8', background: 'transparent', minHeight: 60 }}>
      <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 5, boxShadow: `inset 0 0 0 1.5px ${HJ.ink}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 17, fontWeight: 900, color: HJ.ink, flexShrink: 0 }}>{hz}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: HJ.ink }}>{t}</span>
        <span style={{ display: 'block', fontSize: 13.5, color: HJ.mute, lineHeight: 1.5, marginTop: 1 }}>{s}</span>
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, color: HJ.ink, whiteSpace: 'nowrap' }}>{price}</span>
    </button>
  );
}

/** '다른 점' 한 줄 (먹 띠 위) */
function Why({ no, b, children }: { no: number; b: string; children: ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 900, color: '#D2B477', width: 22, flexShrink: 0 }}>{hanjaNum(no)}</span>
      <span>
        <b style={{ display: 'block', fontSize: 16 }}>{b}</b>
        <span style={{ display: 'block', marginTop: 4, fontSize: 14.5, lineHeight: 1.65, color: '#CFC6B6' }}>{children}</span>
      </span>
    </div>
  );
}

function TocRow({ no, t, pv }: { no: number; t: string; pv: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 6, padding: '11px 0', borderBottom: '1px solid rgba(92,78,60,.2)' }}>
      <span style={{ fontFamily: SERIF, fontWeight: 900, color: HJ.seal, fontSize: 14, paddingTop: 1 }}>{hanjaNum(no)}</span>
      <span>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: HJ.ink, lineHeight: 1.5 }}>{t}</span>
        <span style={{ display: 'block', fontSize: 14, color: HJ.ink2, marginTop: 2, lineHeight: 1.55 }}>{pv}</span>
      </span>
    </div>
  );
}

export default HomePage;
