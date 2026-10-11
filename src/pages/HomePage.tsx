// HomePage v9 (2026-10-10) — 수묵·고서 시안 적용 (docs/mockups/사주500_v9_고서시안.html)
//   순서: 오늘 예고(히어로) → 신년운세(제철) → 가까운 날→먼 날(주·월·인연 D-day) → 오늘 무료(꿈·대화)
//         → 사주책(종합사주) → 고민(주제운) → 실제 후기(있을 때만) → 강점 → 푸터
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
import { getTopicPrice, getPremiumPrice, getMonthlyPrice, getWeeklyPrice, PRODUCT_COST } from '@/constants/pricing';
import { hasFreePass, subscribeFreePass } from '@/services/storage/dailyFreePass';
import { getReports } from '@/services/storage/localStore';
import { getPublicReviews, type PublicReview } from '@/services/reviews';
import {
  todayHook, todayGz, weekFact, nextMonthFact, loveDday, yearFact, yearGz, loveStars, wealthStars,
  examFact, spouseSeatFact, persona, monthDayLabel, josa,
} from '@/services/saju/hookFacts';
import { CHEONGAN_KO, JIJI_KO } from '@/constants/oheng';
import type { SajuData } from '@/types/saju';
import {
  HJ, SERIF, ART, ART_CREDIT, GoldCta, GhostButton, Seal, Redact, Gwang, GoBook, hanjaNum,
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
function readingOf(ch: string): string { return CHEONGAN_KO[ch] || JIJI_KO[ch] || ''; }

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

/** 고민 문장 — 주제 SSOT(라벨·한자·경로)에 '사람이 실제로 하는 질문'만 얹는다 */
const CONCERN_Q: Record<TopicId, string> = {
  love: '그 사람, 내 사람일까',
  reunion: '헤어진 그 사람, 다시 올까',
  exam: '이번엔 붙을까, 옮겨도 될까',
  wealth: '왜 돈이 안 모일까',
  marriage: '이 사람과 결혼해도 될까',
  career: '지금 일, 계속해도 될까',
  business: '시작해도 될까, 넓혀도 될까',
  health: '요즘 몸이 보내는 신호',
  move: '옮기면 나아질까',
  study: '공부가 잘 붙는 때는 언제일까',
};

export function HomePage() {
  usePageTitle('사주500, 무료로 시작');
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
  const tg = useMemo(() => todayGz(today), [today]);
  const ny = useMemo(() => yearGz(NEW_YEAR_TARGET), []);
  const gotDaily = hasSaju && receivedDailyToday(profile, today);
  const dayGan = String(sajuData?.pillars?.[2]?.천간 || '');

  const premium = getPremiumPrice().actualPrice;
  const weekly = getWeeklyPrice().actualPrice;
  const monthly = getMonthlyPrice().actualPrice;
  const tojung = PRODUCT_COST.tojung;
  const compat = PRODUCT_COST.compatibility;

  /** 올해가 아닌 날짜엔 '내년 ' — '2월'만 쓰면 올해 2월로 읽힌다 */
  const yr = (dateKey: string) => (Number(dateKey.slice(0, 4)) > Number(today.slice(0, 4)) ? '내년 ' : '');
  const goTopic = (id: string) => navigate(`/topic/${id}`, profileId ? { state: { profileId } } : undefined);
  const withPid = (path: string) => (profileId ? `${path}${path.includes('?') ? '&' : '?'}profileId=${encodeURIComponent(profileId)}` : path);

  return (
    <div style={{ background: HJ.paper, minHeight: '100vh', paddingBottom: 112, color: HJ.ink }}>

      {/* ━━━ 1. 오늘 예고 ━━━ */}
      <section style={{ position: 'relative' }}>
        <div aria-hidden="true" style={{
          height: 330, position: 'relative', backgroundColor: '#ECE4D3',
          backgroundImage: `url(${ART.gaehwasa})`, backgroundRepeat: 'no-repeat', backgroundSize: '128% auto', backgroundPosition: '40% 0',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(244,239,228,.0) 0%, rgba(244,239,228,0) 48%, rgba(244,239,228,.85) 82%, ${HJ.paper} 100%)` }} />
        </div>
        <div style={{ position: 'relative', marginTop: -64, padding: '0 22px' }}>
          <div className="flex items-center gap-2" style={{ fontSize: 14, color: HJ.ink2, fontWeight: 600 }}>
            <Seal size={36}>{tg.gz}</Seal>
            <span>{todayLabel(today)}, {hasSaju ? `${displayName}님의 오늘` : `오늘은 ${tg.ko}일`}</span>
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
                    {facts.today.avoid},<br />
                    <span style={{ background: 'linear-gradient(transparent 70%, rgba(184,150,90,.34) 70%)' }}>큰 결정은 미루세요.</span>
                  </h1>
                ) : (
                  <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, lineHeight: 1.45, letterSpacing: '-.02em', marginTop: 14 }}>
                    {todayLine}
                  </h1>
                )}
                {facts?.today && (
                  <div style={{ marginTop: 16, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 12, padding: '13px 15px', fontSize: 15, lineHeight: 1.65, color: HJ.ink2 }}>
                    <b style={{ color: HJ.ink }}>가장 좋은 시간은 {facts.today.peak}</b>이에요.
                    {' '}이 시간에 할 일, 만나면 좋은 사람은 오늘 운세에 있어요.
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
              <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, lineHeight: 1.4, letterSpacing: '-.03em', marginTop: 14 }}>
                태어난 날만 넣으면,<br />
                <span style={{ background: 'linear-gradient(transparent 70%, rgba(184,150,90,.34) 70%)' }}>오늘 내 하루가 보여요.</span>
              </h1>
              <p style={{ marginTop: 12, fontSize: 15.5, lineHeight: 1.7, color: HJ.ink2 }}>
                몇 시에 움직이고 몇 시에 쉬어야 하는지, 오늘 만나면 좋은 사람까지 내 사주로 짚어 드려요.
              </p>
              <GoldCta style={{ marginTop: 18 }} onClick={() => navigate('/input?from=daily')} sub="무료">
                내 사주 넣고 오늘 운세 보기
              </GoldCta>
              <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 10 }}>결제 없이 바로, 한 번 넣으면 계속 써요</p>
            </>
          )}
        </div>
      </section>

      {/* ━━━ 2. 신년운세 (10월~ 내년) ━━━ */}
      <section style={{ margin: '30px 16px 0', borderRadius: 18, overflow: 'hidden', background: HJ.ink, color: '#EFE6D6' }}>
        <div aria-hidden="true" style={{ height: 140, position: 'relative', backgroundImage: `url(${ART.inwang})`, backgroundSize: '190% auto', backgroundPosition: '30% 40%', backgroundRepeat: 'no-repeat' }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(26,22,18,.05) 0%, rgba(26,22,18,.4) 55%, ${HJ.ink} 100%)` }} />
        </div>
        <div style={{ padding: '0 20px 20px', marginTop: -34, position: 'relative' }}>
          <div className="flex items-end gap-2.5">
            <b style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 42, lineHeight: 0.9, color: '#FBF4E6' }}>{ny.gz}</b>
            <span style={{ fontSize: 14, color: '#C9BDAA', paddingBottom: 3 }}>{NEW_YEAR_TARGET}년 {ny.ko}년</span>
          </div>
          {facts?.year?.star ? (
            <>
              <h2 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1.42, marginTop: 12 }}>
                {NEW_YEAR_TARGET}년, {displayName}님에게<br />{facts.year.star}이 들어옵니다
              </h2>
              <p style={{ fontSize: 15, color: '#D3C7B4', lineHeight: 1.7, marginTop: 8 }}>
                {ny.ko}년의 {facts.year.ch}({readingOf(facts.year.ch)}){josa(readingOf(facts.year.ch), '은', '는')} {displayName}님({dayGan})에게 {facts.year.star}이에요.
                {' '}열두 달 흐름과 달마다 좋은 날까지 짚어 드려요.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1.42, marginTop: 12 }}>
                {NEW_YEAR_TARGET}년, 나에게는<br />어떤 해일까요
              </h2>
              <p style={{ fontSize: 15, color: '#D3C7B4', lineHeight: 1.7, marginTop: 8 }}>
                {ny.ko}년이 내 사주에 무엇을 들이는지, 열두 달 흐름과 달마다 좋은 날까지 짚어 드려요.
              </p>
            </>
          )}
          <GhostButton onInk style={{ marginTop: 16 }} onClick={() => navigate('/tojung')} sub={`${tojung}운`}>
            {NEW_YEAR_TARGET} 신년운세 보기
          </GhostButton>
        </div>
      </section>

      {/* ━━━ 3. 가까운 날 → 먼 날 ━━━ */}
      <SecTitle k="가까운 날부터 먼 날까지" h={hasSaju ? `${displayName}님 운, 기간별로` : '내 운, 기간별로'} />
      <div style={{ margin: '0 16px', background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 18 }}>
        <LadderRow hz="週" k={facts?.week ? `이번 주 ${facts.week.weekday}요일(${Number(facts.week.date.slice(8))}일) ${facts.week.gz}일` : '이번 주 7일'}
          t={facts?.week ? facts.week.text : '오늘부터 7일, 하루씩 짚어 드려요'}
          price={`${weekly}운`} onClick={() => navigate('/weekly', profileId ? { state: { profileId } } : undefined)} />
        <LadderRow hz="月"
          k={facts?.month ? `${yr(facts.month.month.start)}${facts.month.month.calMonth}월 ${facts.month.gzKo}월(${facts.month.month.gz})` : '원하는 달 하나'}
          t={facts?.month ? `${facts.month.title}${facts.month.once ? ' — 1년에 한 번' : ''}` : '그 달의 돈, 일, 사람 흐름을 깊게'}
          price={`${monthly}운`}
          onClick={() => navigate(withPid(facts?.month ? `/monthly?month=${facts.month.month.start.slice(0, 7)}` : '/monthly'))} />
        {facts?.love && (
          <LadderRow hz={TOPIC_REGISTRY.love.kanji}
            k={`${yr(facts.love.month.start)}${monthDayLabel(facts.love.month.start)}부터 D-${facts.love.days}`}
            t={facts.love.hap ? '연인의 별이 짝(合)으로 들어오는 달' : '연인의 별이 들어오는 달'}
            price={`연애운 ${getTopicPrice('love').actualPrice}운`} onClick={() => goTopic('love')} last />
        )}
      </div>

      {/* ━━━ 4. 오늘 무료 ━━━ */}
      <div className="grid grid-cols-2 gap-2.5" style={{ margin: '12px 16px 0' }}>
        <MiniCard f={dreamFree ? '오늘 무료' : '1운'} h={<>어젯밤 꿈,<br />무슨 뜻일까</>} s="꿈 단어만 적으면 내 사주로 풀어요" go="꿈 풀기" onClick={() => navigate('/dream')} />
        <MiniCard f="오늘 1번 무료" h={<>내 사주에게<br />직접 물어보기</>} s={'"그 사람 연락 올까요?" 같은 질문도'} go="물어보기" onClick={() => navigate('/chat')} />
      </div>

      {/* ━━━ 5. 사주책 (종합사주) ━━━ */}
      <SecTitle k="평생 한 번 읽는 종합사주" h={hasSaju ? `${displayName}님 인생이 한 권에` : '내 인생이 한 권에'} />
      <div style={{ margin: '0 16px', borderRadius: '20px 20px 0 0', height: 318, position: 'relative', overflow: 'hidden', background: '#E9E0CD' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${ART.jangansa})`, backgroundSize: 'cover', backgroundPosition: '40% 55%', opacity: 0.42 }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 55%, rgba(233,224,205,0) 30%, rgba(233,224,205,.7) 100%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)' }}>
          <GoBook title={facts?.persona ? `${facts.persona.dayGz}命書` : '四柱命書'} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontSize: 13, color: HJ.ink2, fontWeight: 600 }}>
          {facts?.persona ? `${displayName}, ${facts.persona.birthYearGz}生 — 8글자로 엮은 열 장` : '태어난 날과 시간으로 엮는 열 장'}
        </div>
      </div>
      <section style={{ margin: '0 16px', background: HJ.card, border: `1px solid ${HJ.line}`, borderTop: 0, borderRadius: '0 0 20px 20px', padding: 18 }}>
        {facts?.persona?.identity ? (
          <>
            <p style={{ fontFamily: SERIF, fontSize: 19.5, fontWeight: 700, lineHeight: 1.5, letterSpacing: '-.02em' }}>
              {displayName}님은 <span style={{ color: HJ.goldText }}>{facts.persona.identity}</span>{josa(facts.persona.identity, '으로', '로')} 태어났어요.
            </p>
            <p style={{ fontSize: 14, color: HJ.mute, marginTop: 6, lineHeight: 1.6 }}>
              {facts.persona.dayGz}일주 — 이 한 줄에서 시작해 돈, 사랑, 일, 건강까지 열 장으로 풀어요.
            </p>
          </>
        ) : (
          <p style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, lineHeight: 1.5 }}>
            태어난 날의 8글자에서 시작해 돈, 사랑, 일, 건강까지, 열 장으로 처음부터 끝까지 풀어요.
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
          <TocRow no={1} t="진짜 강점 3, 빠지기 쉬운 함정 3" pv={hasSaju ? <>첫 번째 함정 — <Redact w={110} /></> : '내 사주가 반복하는 패턴'} />
          <TocRow no={2} t="돈, 사랑, 일, 건강, 사람, 공부 점수" pv={hasSaju ? <>가장 강한 영역 <Redact w={44} lock={false} /> 가장 약한 영역 <Redact w={44} /></> : '여섯 영역의 강약을 한눈에'} />
          <TocRow no={3} t="나에게 부족한 기운과 채우는 법" pv="색, 방위, 계절, 습관까지" />
          <TocRow no={4} t="오늘부터 바꿀 다섯 가지" pv="읽고 끝나지 않게, 할 일로 정리해 드려요" />
          <p style={{ fontSize: 13.5, color: HJ.mute, textAlign: 'center', padding: '10px 0 2px' }}>+ 원국, 십성, 대운, 신살, 올해 흐름 등 여섯 장 더</p>
        </Gwang>
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 14 }}>
          {['한 번 사면 평생 보관', 'PDF로 저장', '다 읽고 궁금한 건 바로 질문'].map((t) => (
            <span key={t} style={{ fontSize: 13, color: HJ.ink2, background: HJ.paper, borderRadius: 999, padding: '6px 11px', fontWeight: 600 }}>{t}</span>
          ))}
        </div>
        <GoldCta style={{ marginTop: 14 }} onClick={() => navigate('/premium')} sub={`${premium}운`}>
          {hasSaju ? '내 사주책 펼치기' : '내 사주책 만들기'}
        </GoldCta>
        <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 9 }}>
          열 장 한 권, 장마다 {Math.round((premium / 10) * 10) / 10}운 꼴
        </p>
      </section>

      {/* ━━━ 6. 고민 (주제운) ━━━ */}
      <div id="home-topics" style={{ scrollMarginTop: 72 }}>
        <SecTitle k="요즘 많이 찾는 고민" h="지금 마음에 걸리는 게 있다면" />
      </div>
      <div className="flex flex-col gap-2.5" style={{ margin: '0 16px' }}>
        <ConcernCard id="love" q={CONCERN_Q.love} b="연애운: 인연이 오는 달과 알아보는 법" onClick={() => goTopic('love')}
          fact={facts ? <>
            {facts.loveStars.count > 0
              ? <>연인의 별이 <b style={{ color: HJ.ink }}>{facts.loveStars.count}개({facts.loveStars.chars.join('')})</b> 있어요. </>
              : <>사주에 연인의 별이 드러나 있지 않아요. </>}
            {facts.love && <><b style={{ color: HJ.ink }}>{yr(facts.love.month.start)}{facts.love.month.calMonth}월</b>에 {facts.loveStars.count > 0 ? '하나가 더' : '그 별이'} 들어와요.</>}
          </> : undefined} />
        <ConcernCard id="reunion" q={CONCERN_Q.reunion} b="재회운: 재회 가능성 판정과 연락할 달" onClick={() => goTopic('reunion')}
          factTag="함께 넣으면" fact={<>그 사람 생일을 넣으면 <b style={{ color: HJ.ink }}>두 사주를 같이</b> 놓고, 다시 닿는 달을 짚어 드려요.</>} />
        <ConcernCard id="exam" q={CONCERN_Q.exam} b="합격 이직운: 결과가 나오는 달" onClick={() => goTopic('exam')}
          fact={facts ? <>{facts.exam}</> : undefined} />
        <ConcernRow id="wealth" q={CONCERN_Q.wealth}
          b={facts ? (facts.wealth.count > 0
            ? `재물의 별 ${facts.wealth.count}개, ${facts.wealth.pyeon && !facts.wealth.jeong ? '큰돈이 오가는 별(편재)' : facts.wealth.jeong && !facts.wealth.pyeon ? '꾸준히 쌓는 별(정재)' : '쌓는 별과 오가는 별이 함께'}`
            : '재물의 별이 들어오는 때와 새는 곳') : '재물운: 새는 구멍과 들어오는 시기'}
          price={`${getTopicPrice('wealth').actualPrice}운`} onClick={() => goTopic('wealth')} />
        <ConcernRow hz="合" q="그 사람과 나, 잘 맞을까" b="궁합: 두 사람 8글자를 겹쳐 봐요" price={`${compat}운`} onClick={() => navigate('/compat')} />
        <ConcernRow id="marriage" q={CONCERN_Q.marriage} b={facts ? facts.spouse : '결혼운: 결혼 적기와 배우자 성향'} price={`${getTopicPrice('marriage').actualPrice}운`} onClick={() => goTopic('marriage')} />
        {showAllTopics && (['career', 'business', 'health', 'move', 'study'] as TopicId[]).map((id) => (
          <ConcernRow key={id} id={id} q={CONCERN_Q[id]} b={`${TOPIC_REGISTRY[id].label}: ${TOPIC_REGISTRY[id].subCopy}`} price={`${getTopicPrice(id).actualPrice}운`} onClick={() => goTopic(id)} />
        ))}
      </div>
      {!showAllTopics && (
        <button type="button" onClick={() => setShowAllTopics(true)}
          style={{ display: 'block', width: 'calc(100% - 32px)', margin: '10px 16px 0', padding: 14, fontSize: 15, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
          고민 {listTopics().length}가지 전부 보기 ›
        </button>
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
                <p style={{ fontSize: 13, color: HJ.mute, marginTop: 10 }}>구매자, {r.contentLabel}{r.month ? ` ${r.month}월` : ''}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ━━━ 8. 강점 — 확인 가능한 사실만 ━━━ */}
      <div id="voices-section" style={{ scrollMarginTop: 72 }}>
        <SecTitle k="사주500을 고르는 이유" h="제대로 본 사주는, 다릅니다" />
      </div>
      <p style={{ margin: '-4px 22px 0', fontSize: 15, color: HJ.ink2, lineHeight: 1.65 }}>600년 원전 명리학의 깊이 그대로, 문턱은 500원으로.</p>
      <ul style={{ margin: '12px 16px 0', borderTop: `1px solid ${HJ.line}`, listStyle: 'none', padding: 0 }}>
        {[
          ['태어난 시간을 30분 단위로 보정해요.', '서울과 표준시의 차이까지 맞춰 8글자를 세웁니다.'],
          ['달과 시간대는 만세력으로 계산해요.', '오늘의 일진, 이번 달 간지를 내 8글자와 직접 맞춰 봅니다.'],
          ['한 번 산 풀이는 평생 보관돼요.', '보관함에서 다시 열 때 운이 들지 않아요.'],
        ].map(([b, s], i) => (
          <li key={i} className="flex gap-3" style={{ padding: '14px 2px', borderBottom: `1px solid ${HJ.line}`, fontSize: 15, lineHeight: 1.6 }}>
            <span style={{ fontFamily: SERIF, fontWeight: 900, color: HJ.seal, width: 18, flexShrink: 0 }}>{hanjaNum(i + 1)}</span>
            <span><b style={{ fontWeight: 800 }}>{b}</b> <span style={{ color: HJ.ink2 }}>{s}</span></span>
          </li>
        ))}
      </ul>

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
function SecTitle({ k, h }: { k: string; h: string }) {
  return (
    <div style={{ padding: '34px 22px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: HJ.mute }}>{k}</div>
      <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.4, marginTop: 4 }}>{h}</h2>
    </div>
  );
}

function HzBox({ children, size = 44 }: { children: ReactNode; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 10, border: `1.5px solid ${HJ.ink}`, display: 'grid', placeItems: 'center', fontFamily: SERIF, fontWeight: 900, fontSize: Math.round(size * 0.43), flexShrink: 0, color: HJ.ink }}>
      {children}
    </span>
  );
}

function LadderRow({ hz, k, t, price, onClick, last }: { hz: string; k: string; t: string; price: string; onClick: () => void; last?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left"
      style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 12, alignItems: 'center', padding: 16, borderBottom: last ? 0 : `1px solid ${HJ.line}`, background: 'transparent' }}>
      <HzBox>{hz}</HzBox>
      <span>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: HJ.mute }}>{k}</span>
        <span style={{ display: 'block', fontFamily: SERIF, fontSize: 16.5, fontWeight: 700, lineHeight: 1.45, marginTop: 2, letterSpacing: '-.02em', color: HJ.ink }}>{t}</span>
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, color: HJ.goldText, whiteSpace: 'nowrap' }}>{price} ›</span>
    </button>
  );
}

function MiniCard({ f, h, s, go, onClick }: { f: string; h: ReactNode; s: string; go: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left" style={{ background: HJ.card, borderRadius: 16, padding: '16px 14px 14px', border: `1px solid ${HJ.line}` }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: HJ.goldText }}>{f}</div>
      <div style={{ fontSize: 16.5, fontWeight: 800, marginTop: 6, lineHeight: 1.38, letterSpacing: '-.02em', color: HJ.ink }}>{h}</div>
      <div style={{ fontSize: 13.5, color: HJ.mute, marginTop: 6, lineHeight: 1.5 }}>{s}</div>
      <div style={{ marginTop: 12, fontSize: 14.5, fontWeight: 800, color: HJ.ink }}>{go} ›</div>
    </button>
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

function ConcernCard({ id, q, b, fact, factTag = '내 사주', onClick }: { id: TopicId; q: string; b: string; fact?: ReactNode; factTag?: string; onClick: () => void }) {
  const price = getTopicPrice(id).actualPrice;
  return (
    <button type="button" onClick={onClick} className="w-full text-left" style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '16px 16px 14px' }}>
      <span className="flex items-start gap-3">
        <HzBox size={40}>{TOPIC_REGISTRY[id].kanji}</HzBox>
        <span>
          <span style={{ display: 'block', fontFamily: SERIF, fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.4, color: HJ.ink }}>{q}</span>
          <span style={{ display: 'block', fontSize: 13.5, color: HJ.mute, marginTop: 3 }}>{b}</span>
        </span>
      </span>
      {fact && (
        <span style={{ display: 'block', marginTop: 12, background: HJ.paper, borderRadius: 10, padding: '10px 12px', fontSize: 14.5, lineHeight: 1.65, color: HJ.ink2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: HJ.goldText, marginRight: 6 }}>{factTag}</span>{fact}
        </span>
      )}
      <span className="flex justify-between items-center" style={{ marginTop: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: HJ.ink }}>{price}운</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: HJ.goldText }}>{TOPIC_REGISTRY[id].label} 보기 ›</span>
      </span>
    </button>
  );
}

function ConcernRow({ id, hz, q, b, price, onClick }: { id?: TopicId; hz?: string; q: string; b: string; price: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left flex items-center gap-3" style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '14px 16px' }}>
      <HzBox size={40}>{hz || (id ? TOPIC_REGISTRY[id].kanji : '')}</HzBox>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: SERIF, fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.4, color: HJ.ink }}>{q}</span>
        <span style={{ display: 'block', fontSize: 13.5, color: HJ.mute, marginTop: 3, lineHeight: 1.5 }}>{b}</span>
      </span>
      <span style={{ fontSize: 15, fontWeight: 800, color: HJ.ink, whiteSpace: 'nowrap' }}>{price}</span>
    </button>
  );
}

export default HomePage;
