// HomePage v9 (2026-10-10) — 수묵·고서 시안 적용 (docs/mockups/사주500_v9_고서시안.html)
//   순서 (2026-10-14 홈 강조 개편, 시안 artifact 2zsAF1fJrFmpcHzQE3mrA3 → 2026-10-23 1.6.3 P1-3 고민을 종합사주 위로):
//         오늘 예고(히어로) → 고민(2026-10-26 히어로 바로 아래, 위 두 개 카드 + 아홉 칸 격자, 접지 않음)
//         → 철 따라 카드(월초 좋은 날, 생일 달, 수능, 초대) → 오늘 무료(먹 꿈, 한지 대화, 만세력) → 가족 띠
//         → 사주책(종합사주) → 신년운세(그림 띠) → 기간별(달력 장 두 장) → 실시간 인기 → 실제 후기(있을 때만) → 다른 점(먹 띠) → 푸터
//   10-26 근거: 오너 주변 피드백 '홈에서 뭘 어떻게 눌러야 할지, 뭐부터 볼지 모르겠다', '고민 더 보기가 안 보인다'.
//     첫 화면의 주 버튼(오늘 운세 전부 열기)에만 빛이 세 번 지나가고 멈춘다(GoldCta sheen). 고민 칸은 보일 때 한 번 차례로 떠오른다.
//   P1-3 근거: 충전이 가장 잘 되는 주제운이 띠 표, 종합사주, 기간별 아래에 있었다(docs/strategy/2026-10-22_UIUX_콘텐츠_점검.md 5-3).
//     종합사주 카드 첫 문장은 일주 고정 문구(iljuMeaning.ts, 5월생에게 '겨울')를 빼고 만세력 사실(premiumStory.ts)로.
//   원칙
//   - 화면의 사주 문장은 전부 hookFacts(만세력 계산 사실)에서 온다. AI 가 정하는 값(가장 좋은 날·점수)은 미리 말하지 않는다.
//   - 잠긴 내용은 가짜 글자 블러가 아니라 가림막(<Redact/>) — 결제 후 다른 말이 나오는 미끼 금지.
//   - 금색은 누르는 곳에만 · 색은 먹·종이 · 글자는 그림 위에 올리지 않는다 (가독성).
//   - 후기는 실제 구매자 후기(노출 동의 + 오너 승인)만. 없으면 섹션째 숨김 (구 HOME_REVIEWS 시드는 노출 중단).

import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { kstToday } from '@/utils/kstDate';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import { LegalFooter } from '@/components/layout/LegalFooter';
import { useActiveProfile, useTodayHeadline } from '@/hooks/useHomeData';
import { MonthGoodDays } from '@/components/home/MonthGoodDays';
import { BirthdayMonth } from '@/components/home/BirthdayMonth';
import { SuneungCard } from '@/components/home/SuneungCard';
import { InviteWelcomeCard } from '@/components/invite/InviteWelcomeCard';
import { InviteRow } from '@/components/invite/InviteRow';
import { WebIntro } from '@/components/home/WebIntro';
import { TOPIC_REGISTRY, type TopicId } from '@/constants/topics';
import { getTopicPrice, getPremiumPrice, getMonthlyPrice, getWeeklyPrice, getTojungPrice, PRODUCT_COST } from '@/constants/pricing';
import { hasFreePass, subscribeFreePass } from '@/services/storage/dailyFreePass';
import { getReports } from '@/services/storage/localStore';
import { getPublicReviews, type PublicReview } from '@/services/reviews';
import { getTopicTop5 } from '@/services/liveBest';
import {
  todayHook, todayHourWindows, windowAhead, kstNowHM, todayGz, weekFact, nextMonthFact, yearFact, yearGz, persona, monthDayLabel, josa, STAR_LUCK,
  type WeekFact, type MonthFact,
} from '@/services/saju/hookFacts';
import { premiumStory } from '@/services/saju/premiumStory';
import { isAppsInToss } from '@/services/payment/iapService';
import { isAppintosBuild } from '@/lib/env';
import { genOfAge, worryRows, worryGroupOrder, WORRY_GROUP_LABEL, type WorryRow } from '@/services/saju/worryTopics';
import { trackEvent } from '@/services/analytics';
import { realName } from '@/utils/personName';
import type { SajuData } from '@/types/saju';
import { TtiFortune } from '@/components/home/TtiFortune';
import { DailyNotiButton } from '@/components/common/DailyNotiButton';
import { DailyMailSignup, mailPrefillOf } from '@/components/daily/DailyMailSignup';
import { getMyTti, ttiOfYear, ttiName, yearLabel } from '@/services/tti/ttiFortune';
import { MotionScope, moVars } from '@/components/motion/Motion';
import {
  HJ, SERIF, ART, ART_CREDIT, GoldCta, Seal, Redact, Gwang, GoBook, hanjaNum,
} from '@/components/hanji/Hanji';

/** 웹 홈 화면 앱 안내 (2026-10-23) — 앱 빌드에는 코드째 넣지 않는다. 못 불러오면 그 칸만 빈다 */
import { HeroPillars } from '@/components/home/HeroPillars';
const HomePwaSlot = import.meta.env.VITE_BUILD_TARGET !== 'appintos'
  ? lazy(() => import('@/components/pwa/HomePwaSlot').then((m) => ({ default: m.HomePwaSlot })).catch(() => ({ default: () => null })))
  : null;

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

/** 2026-10-18 홈 첫 화면 움직임(오늘 간지 도장, 제목 먹 스밈, 밑줄 붓질)은 앱을 연 뒤 처음 한 번만 */
let homeHeroSeen = false;

export function HomePage() {
  usePageTitle('정통 명리학 사주 풀이');
  const [heroMo] = useState(() => { const v = !homeHeroSeen; homeHeroSeen = true; return v; });
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
  // 2026-10-17 웹 홈의 아침 일주 운세 메일 한 줄 (앱은 같은 자리에 토스 9시 알림) — 활성 사주 생일로 미리 채운다
  const mailPrefill = mailPrefillOf((profile as any)?.input, name);

  // 부팅 자동환불·보상·복구 안내 (App 이 플래그 저장 → 홈에서 1회)
  useEffect(() => {
    try {
      const n = localStorage.getItem('saju500:refund_notice');
      if (n) { localStorage.removeItem('saju500:refund_notice'); toast.show(`이전에 생성 중 앱이 닫혀 결과를 받지 못한 ${n}운을 돌려드렸어요`, 'success'); }
      // 2026-10-18 친구 초대 보상 받음 안내 (App 부팅의 claimInviteRewards 가 남긴 것)
      import('@/services/referral/referral').then(({ takeInviteNotice }) => {
        const n = takeInviteNotice();
        if (n && n.amount > 0) toast.show(n.kinds?.invitee ? `친구 초대 선물 ${n.amount}운을 받았어요` : `친구 초대 보상 ${n.amount}운을 받았어요. 친구가 사주를 넣었어요`, 'success');
      }).catch(() => {});
      const comp = localStorage.getItem('saju500:comp_notice');
      if (comp) { localStorage.removeItem('saju500:comp_notice'); toast.show(`고객센터 보상 ${comp}운이 적립됐어요. 불편을 드려 죄송합니다`, 'success'); }
      // 2026-10-15 — 음력 생일 계산 정정(계산 기준 v4) 안내 한 번
      const lunarFix = localStorage.getItem('saju500:lunar_fix_notice');
      if (lunarFix) { localStorage.removeItem('saju500:lunar_fix_notice'); toast.show('음력 생일을 양력으로 바꿔 계산하도록 바로잡았어요. 음력으로 넣은 사주가 새로 계산됐어요', 'info'); }
      const lunarKr = localStorage.getItem('saju500:lunar_kr_notice');
      if (lunarKr && !lunarFix) { localStorage.removeItem('saju500:lunar_kr_notice'); toast.show('음력 생일을 한국 음력 달력에 맞춰 다시 계산했어요. 태어난 날이 하루 어긋나던 달이라 사주가 새로 바뀌었어요', 'info'); }
      const prem = localStorage.getItem('saju500:premium_recovered');
      if (prem) { localStorage.removeItem('saju500:premium_recovered'); toast.show('이전에 받지 못한 종합사주 결과를 보관함에 저장했어요', 'success'); }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 2026-10-17 결과를 보고 홈으로 돌아온 순간에만 토스 별점 창 (앱인토스만, 60일 한 번, 평생 세 번 — reviewPrompt.ts)
  useEffect(() => {
    const t = window.setTimeout(() => { import('@/services/review/reviewPrompt').then((m) => m.maybeAskReview()).catch(() => {}); }, 900);
    return () => window.clearTimeout(t);
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
  // 2026-10-25 — 사주대화 카드도 오늘 무료 질문이 남았을 때만 '무료'라고 쓴다 (10-15 규칙: 다 썼으면 무료라고 말하지 않는다)
  const [chatFree, setChatFree] = useState(() => hasFreePass('chat'));
  useEffect(() => {
    const refresh = () => { setToday(kstToday()); setDailyFree(hasFreePass('daily')); setDreamFree(hasFreePass('dream')); setChatFree(hasFreePass('chat')); };
    refresh();
    return subscribeFreePass(refresh);
  }, []);

  const [reviews, setReviews] = useState<PublicReview[]>([]);
  useEffect(() => {
    let alive = true;
    getPublicReviews(10).then((r) => { if (alive) setReviews(r); }).catch(() => {});
    return () => { alive = false; };
  }, []);
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
      // 2026-10-25 이미 지난 '조심할 시간'은 첫 줄에 쓰지 않는다(오전 11시에 '오전 7시 반~9시 반에는 미루세요'가 보이던 것)
      const w = todayHourWindows(today, sajuData);
      const nowHM = kstNowHM();
      const todayShow: 'avoid' | 'peak' | null = !w ? null : windowAhead(w.avoid, nowHM) ? 'avoid' : windowAhead(w.peak, nowHM) ? 'peak' : null;
      return {
        todayShow,
        today: todayHook(sajuData, today),
        week: weekFact(sajuData, today),
        month: nextMonthFact(sajuData, today),
        year: yearFact(sajuData, NEW_YEAR_TARGET),
        persona: persona(sajuData),
      };
    } catch { return null; }
  }, [hasSaju, sajuData, today]);
  /** 종합사주 카드 첫 문장 — 만세력 사실(빠진 오행, 원국의 충 등)과 대운 사실. 종합사주 고르기 화면과 같은 문장 (2026-10-23 P1-3) */
  const story = useMemo(() => {
    if (!hasSaju || !sajuData) return null;
    const nm = realName(name);
    return premiumStory(sajuData, nm ? `${nm} 님` : '', Number(today.slice(0, 4)));
  }, [hasSaju, sajuData, name, today]);
  /** 시주까지 있는 사주인지 (시간 모름이면 여섯 글자) */
  const hasTime = !!(sajuData?.pillars?.[3] && sajuData.pillars[3].available !== false && sajuData.input?.hasBirthTime);
  /** 첫 화면 둘째 줄이 다음 대운 연도를 이미 말했으면 대운 띠 문장에서 그 연도를 되풀이하지 않는다 */
  const nextYearSaid = !!(story?.secondKind === 'bring' && facts?.persona?.nextYear && story.second?.includes(`${facts.persona.nextYear}년`));
  const tg = useMemo(() => todayGz(today), [today]);
  const ny = useMemo(() => yearGz(NEW_YEAR_TARGET), []);
  const gotDaily = hasSaju && receivedDailyToday(profile, today);
  const birthYear = hasSaju ? Number((profile as any)?.input?.birthYear) || undefined : ttiYear;
  const age = birthYear ? Number(today.slice(0, 4)) - birthYear : null;
  /** young 34세까지, mid 35~49세, senior 50세부터, null 모름 */
  const gen = genOfAge(age);

  const premium = getPremiumPrice().actualPrice;
  const weekly = getWeeklyPrice().actualPrice;
  const monthly = getMonthlyPrice().actualPrice;
  const tojungInfo = getTojungPrice();
  const tojung = tojungInfo.actualPrice;
  const compat = PRODUCT_COST.compatibility;

  /** 올해가 아닌 날짜엔 '내년 ' — '2월'만 쓰면 올해 2월로 읽힌다 */
  const yr = (dateKey: string) => (Number(dateKey.slice(0, 4)) > Number(today.slice(0, 4)) ? '내년 ' : '');
  const goTopic = (id: string) => navigate(`/topic/${id}`, profileId ? { state: { profileId } } : undefined);
  /* 고민 목록 (2026-10-23 P1-3, 10-26 전부 펼침) — 나이대별 순서, 앞 두 개는 카드, 나머지 아홉은 세 칸 격자.
   *   사주 카드 아래 다음 단계 칸의 고민 두 개와 같은 목록(worryTopics.ts).
   *   측정: home_topic_click {topic, pos: top|grid(10-25까지 more), rank, gen, has}, home_premium_click {pos, has} */
  const worries = useMemo(() => worryRows(hasSaju ? sajuData : null, today, gen, compat), [hasSaju, sajuData, today, gen, compat]);
  const evGen = gen ?? 'none';
  const goWorry = (r: WorryRow, pos: 'top' | 'grid', rank: number) => {
    trackEvent('home_topic_click', { topic: r.key, pos, rank, gen: evGen, has: hasSaju ? 1 : 0 });
    if (r.key === 'compat') navigate('/compat');
    else goTopic(r.key);
  };
  const goPremium = (pos: 'book' | 'card' | 'cta') => {
    trackEvent('home_premium_click', { pos, has: hasSaju ? 1 : 0 });
    navigate('/premium');
  };
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
  /** 고민별 운세 값 범위 (머리와 바로 가기에 같이 쓴다) */
  const worryNums = worries.map((r) => parseInt(r.price, 10)).filter((n) => Number.isFinite(n));
  const worryRange = worryNums.length
    ? (Math.min(...worryNums) === Math.max(...worryNums) ? `${worryNums[0]}운` : `${Math.min(...worryNums)}~${Math.max(...worryNums)}운`)
    : '1운부터';
  const periodFrom = `${Math.min(weekly, monthly)}운부터`;
  /** 오늘 아직 무료로 남은 것 (매일 무료 머리 한 줄) */
  const freeLeft = [dailyFree && '오늘의 운세', dreamFree && '꿈해몽', chatFree && '사주대화 첫 질문'].filter((x): x is string => !!x);

  return (
    <div style={{ background: HJ.paper, minHeight: '100vh', paddingBottom: 112, color: HJ.ink }}>

      {/* 2026-10-18 초대 링크로 처음 온 친구(사주 없음) — 맨 위에 초대 선물 안내 */}
      {!hasSaju && <InviteWelcomeCard padding="14px 16px 0" />}
      {/* ━━━ 1. 오늘 예고 ━━━ */}
      <section style={{ position: 'relative' }}>
        <div aria-hidden="true" style={{
          // 사주 없는 첫 화면은 띠 표와 운세 카드가 한 화면에 들어오게 그림을 낮춘다 (2026-10-15)
          height: hasSaju ? 330 : 214, position: 'relative', backgroundColor: '#ECE4D3',
          backgroundImage: `url(${ART.gaehwasa})`, backgroundRepeat: 'no-repeat', backgroundSize: '128% auto', backgroundPosition: '40% 0',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(244,239,228,.0) 0%, rgba(244,239,228,0) 48%, rgba(244,239,228,.85) 82%, ${HJ.paper} 100%)` }} />
        </div>
        {/* 2026-10-27 지인 VOC '첫 화면에 눈을 잡아끄는 게 없다' → 사주를 넣은 손님은 그림 위에 내 여덟 글자를 오행 색 칸으로 */}
        {hasSaju && sajuData && (
          <div style={{ position: 'absolute', top: 18, left: 16, right: 16 }}>
            <HeroPillars sajuData={sajuData as SajuData} name={displayName} />
          </div>
        )}
        <div style={{ position: 'relative', marginTop: -64, padding: '0 22px' }}>
          <div className="flex items-center gap-2" style={{ fontSize: 14, color: HJ.ink2, fontWeight: 600 }}>
            <Seal size={36} stamp={heroMo} delay={80}>{tg.gz}</Seal>
            <span>{todayLabel(today)}, {hasSaju ? `${displayName} 님 오늘의 운세` : `오늘은 ${tg.ko}일`}</span>
          </div>

          {hasSaju ? (
            gotDaily ? (
              <>
                <h1 className={heroMo ? 'mo-ink' : undefined} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, lineHeight: 1.42, letterSpacing: '-.03em', marginTop: 14 }}>
                  {todayLine}
                </h1>
                <GoldCta style={{ marginTop: 18 }} onClick={() => navigate('/daily')}>오늘 운세 다시 보기</GoldCta>
                <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 10 }}>오늘 받은 풀이를 그대로 다시 열어요</p>
                <DailyNotiButton variant="slim" className="mt-1" />
                <DailyMailSignup compact prefill={mailPrefill} source="home" style={{ marginTop: 4 }} />
              </>
            ) : (
              <>
                {facts?.today && facts.todayShow === 'avoid' ? (
                  <h1 className={heroMo ? 'mo-ink' : undefined} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 29, lineHeight: 1.38, letterSpacing: '-.03em', marginTop: 14 }}>
                    {facts.today.avoid}에는<br />
                    <span className={heroMo ? 'mo-brush' : undefined} style={{ backgroundImage: 'linear-gradient(transparent 70%, rgba(184,150,90,.34) 70%)' }}>큰 결정을 미루세요.</span>
                  </h1>
                ) : facts?.today && facts.todayShow === 'peak' ? (
                  <h1 className={heroMo ? 'mo-ink' : undefined} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 29, lineHeight: 1.38, letterSpacing: '-.03em', marginTop: 14 }}>
                    {facts.today.peak}{josa(facts.today.peak, '이', '가')}<br />
                    <span className={heroMo ? 'mo-brush' : undefined} style={{ backgroundImage: 'linear-gradient(transparent 70%, rgba(184,150,90,.34) 70%)' }}>오늘 가장 좋은 시간이에요.</span>
                  </h1>
                ) : (
                  <h1 className={heroMo ? 'mo-ink' : undefined} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, lineHeight: 1.45, letterSpacing: '-.02em', marginTop: 14 }}>
                    {todayLine}
                  </h1>
                )}
                {facts?.today && facts.todayShow === 'avoid' && (
                  <div style={{ marginTop: 16, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 12, padding: '13px 15px', fontSize: 15, lineHeight: 1.65, color: HJ.ink2 }}>
                    <b style={{ color: HJ.ink }}>가장 좋은 시간은 {facts.today.peak}</b>이에요.
                    {' '}오늘 할 일과 피할 일도 같이 확인해 보세요.
                  </div>
                )}
                {facts?.today && facts.todayShow === 'peak' && (
                  <div style={{ marginTop: 16, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 12, padding: '13px 15px', fontSize: 15, lineHeight: 1.65, color: HJ.ink2 }}>
                    중요한 연락과 결정은 이때로 미뤄 보세요. 오늘 할 일과 피할 일도 같이 확인해 보세요.
                  </div>
                )}
                <GoldCta style={{ marginTop: 16 }} onClick={() => navigate('/daily')} sub={dailyFree ? '무료' : '1운'} sheen>
                  오늘 운세 전부 열기
                </GoldCta>
                <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 10 }}>
                  {dailyFree ? '오늘 1회 무료, 결제 없이 바로 열려요' : '오늘 무료 1회는 썼어요, 두 번째부터 1운'}
                </p>
                <DailyNotiButton variant="slim" className="mt-1" />
                <DailyMailSignup compact prefill={mailPrefill} source="home" style={{ marginTop: 4 }} />
              </>
            )
          ) : (
            <>
              {/* 2026-10-15 — 혜택탭 50~60대가 입력 앞에서 나가던 문제: 띠만 누르면 바로 읽히게 (신문 띠별 운세) */}
              <h1 className={heroMo ? 'mo-ink' : undefined} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 27, lineHeight: 1.4, letterSpacing: '-.03em', marginTop: 14 }}>
                {ttiYear ? (
                  <>{yearLabel(ttiYear)} {ttiName(ttiOfYear(ttiYear))},<br />
                    <span className={heroMo ? 'mo-brush' : undefined} style={{ backgroundImage: 'linear-gradient(transparent 70%, rgba(184,150,90,.34) 70%)' }}>오늘 운세예요.</span></>
                ) : (
                  <>내 띠를 누르면<br />
                    <span className={heroMo ? 'mo-brush' : undefined} style={{ backgroundImage: 'linear-gradient(transparent 70%, rgba(184,150,90,.34) 70%)' }}>오늘 운세가 바로 보여요.</span></>
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

      {/* 2026-10-23 웹 홈 화면 앱(PWA) 안내 한 자리 — 아이폰 홈 화면 앱 로그인 전 '로그인하면 이어져요', 다시 온 휴대폰 손님에게 홈 화면에 추가.
           첫 화면 아래, 아침 운세 메일 줄 다음. 앱 빌드와 토스 안에서는 아무것도 그리지 않는다 (components/pwa/HomePwaSlot) */}
      {HomePwaSlot && <Suspense fallback={null}><HomePwaSlot /></Suspense>}

      {/* 2026-10-27 지인 VOC '홈에 콘텐츠는 많은데 뭐가 뭔지 구분이 안 간다, 가격은 얼마냐' → 첫 화면 바로 아래에 홈 목차 한 줄(값은 운으로).
           덩어리마다 같은 먹 도장 글자를 머리에도 달아 목차와 본문이 이어지게 한다. 누르면 그 덩어리로 내려간다 */}
      <QuickNav items={[
        { mark: '心', label: '고민별', price: worryRange, to: 'home-topics' },
        { mark: '日', label: '매일 무료', price: '무료', to: 'home-free' },
        { mark: '命', label: '종합사주', price: `${premium}운`, to: 'home-premium' },
        { mark: '歲', label: '신년운세', price: `${tojung}운`, to: 'home-newyear' },
        { mark: '月', label: '주간 월간', price: periodFrom, to: 'home-period' },
      ]} />

      {/* ━━━ 2. 고민 (주제운) — 2026-10-26 오너 '고민 더 보기가 안 보여 다른 주제운을 못 만난다, 홈에서 뭐부터 볼지 모르겠다'
           → 오늘 운세 바로 아래로 올리고 접지 않는다. 나이대별 위 두 개는 사실 한 줄이 붙은 카드, 나머지 아홉은 세 칸 격자 ━━━ */}
      {/* 2026-10-27 2차 VOC '구분선 말고는 뭐가 바뀐지 모르겠다, 고민별이 무난하다' → 짙은 한지 바탕 띠로 덩어리를 가르고,
           위 두 칸은 그 별이 들어오기까지 남은 날을 큰 숫자로, 나머지는 사람과 인연, 돈과 일, 몸과 생활 세 묶음에 칸마다 보는 것 한 줄 */}
      <Band tone="deep">
        <SecTitle id="home-topics" rule={false} mark="心" k="고민별 운세" h="어떤 고민이 있으세요?" price={worryRange}
          d={hasSaju ? `${displayName} 님 사주에서 날짜가 먼저 잡히는 고민부터 보여 드려요` : '연애, 돈, 일 가운데 고민 하나를 골라 깊게 풀어요'} />
        <MotionScope style={{ margin: '0 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {worries.slice(0, 2).map((r, i) => (
              <TopicCard key={r.key} i={i} hz={r.hz} t={r.t} s={r.s} price={r.price} days={r.days} onClick={() => goWorry(r, 'top', i + 1)} />
            ))}
          </div>
          {worryGroupOrder(gen).map((g) => {
            const items = worries.slice(2).filter((r) => r.group === g);
            if (!items.length) return null;
            const cols = items.length === 4 ? 2 : Math.min(items.length, 3);
            return (
              <div key={g} style={{ marginTop: 18 }}>
                <div className="flex items-center gap-2.5" style={{ padding: '0 2px 8px' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: HJ.ink, whiteSpace: 'nowrap' }}>{WORRY_GROUP_LABEL[g]}</span>
                  <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'rgba(26,22,18,.18)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 }}>
                  {items.map((r) => {
                    const rank = worries.indexOf(r) + 1;
                    return <TopicTile key={r.key} i={rank - 1} hz={r.hz} t={r.t} short={r.short} price={r.price} onClick={() => goWorry(r, 'grid', rank)} />;
                  })}
                </div>
              </div>
            );
          })}
        </MotionScope>
        <p style={{ margin: '14px 22px 0', fontSize: 13.5, color: HJ.ink2, lineHeight: 1.6, wordBreak: 'keep-all' }}>
          누르면 바로 결제되지 않아요. 무엇을 풀어 드리는지 먼저 보여 드려요.
        </p>
      </Band>

      {/* 2026-10-27 시기 카드와 초대는 머리 없이 고민과 무료 사이에 떠 있어 '뭐가 뭔지' 헷갈렸다 → '이번 달 소식과 혜택' 한 덩어리로 묶는다.
           카드가 하나도 안 그려지면 머리도 숨긴다 (SeasonGroup) */}
      {hasSaju && (
        <SeasonGroup>
          {/* 2026-10-17 월초(1~7일) 이번 달 좋은 날 — 월운세와 같은 채점, AI 0원 */}
          <MonthGoodDays sajuData={sajuData as any} name={displayName} price={monthly} profileId={profileId} />
          {/* 2026-10-17 생일 달 — 종합사주 또는 신년운세(11~2월) */}
          <BirthdayMonth sajuData={sajuData as any} name={displayName} premiumPrice={premium} newYearPrice={tojung} />
          {/* 2026-10-17 수능 시즌(11/1~11/19) — 40~59세는 자녀 합격운, 17~21세는 내 합격운 */}
          <SuneungCard sajuData={sajuData as any} name={displayName} age={age} today={today} price={getTopicPrice('exam' as TopicId).actualPrice} profileId={profileId} />
          {/* 2026-10-18 친구 초대 — 초대받은 친구는 받기 카드, 사주를 넣은 사람은 초대 한 줄 */}
          <InviteWelcomeCard padding="0" />
          <InviteRow />
        </SeasonGroup>
      )}
      {/* 2026-10-17 웹 전용 첫 손님 소개 (앱 빌드와 토스 안에서는 안 보임) */}
      {!hasSaju && <WebIntro premiumPrice={premium} />}

      {/* ━━━ 3. 오늘 무료 (꿈은 먹 카드, 대화는 한지 카드 — 명암으로 바로 갈리게)
           2026-10-27 지인 VOC '기능은 좋은데 배치가 제각각이라 헷갈린다' → 모든 덩어리가 같은 머리(작은 분류 + 제목)로 시작한다 ━━━ */}
      <SecTitle id="home-free" mark="日" k="매일 무료" h="오늘 무료로 볼 수 있어요" price="무료"
        d={freeLeft.length
          ? `오늘 아직 무료로 남은 것: ${freeLeft.join(', ')}. 만세력은 언제나 무료예요.`
          : '오늘 무료는 다 썼어요. 내일 다시 무료로 열리고, 만세력은 언제나 무료예요.'} />
      <div style={{ padding: '0 16px' }}>
        <div className="grid grid-cols-2 gap-2.5">
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
            <span style={{ fontSize: 14, fontWeight: 800, color: HJ.ink }}>{chatFree ? '첫 질문 무료 ›' : '1운에 질문 세 번 ›'}</span>
          </button>
        </div>
        {/* 2026-10-18 무료 만세력 입구 — 홈에 없어서 '내 정보', '보관함'으로만 들어갔다. 토스 검색 키워드 '만세력'과 짝 */}
        <button type="button" className="w-full text-left mo-press"
          onClick={() => {
            import('@/services/analytics').then((a) => a.trackEvent('cta_click', { label: '홈 무료 만세력', page: '/' })).catch(() => {});
            navigate(hasSaju && profileId ? `/saju-card/${encodeURIComponent(profileId)}` : '/input?from=manse');
          }}
          style={{ marginTop: 10, borderRadius: 16, padding: '14px 15px', background: HJ.card, border: `1px solid ${HJ.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Seal size={32} fontSize={18}>曆</Seal>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: HJ.ink }}>{hasSaju ? '내 만세력' : '무료 만세력'}</span>
            <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.5, color: HJ.ink2, marginTop: 2 }}>사주 여덟 글자와 오행, 지금 대운을 한 장으로</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: HJ.ink, flexShrink: 0 }}>무료 ›</span>
        </button>
      </div>

      {/* ━━━ 2-1. 가족 띠 운세 (사주 있는 사람) — 배우자, 자녀, 부모님 띠도 오늘 운세를 한 번에 ━━━ */}
      {hasSaju && (
        <Band tone="deep">
          <SecTitle rule={false} mark="家" k="띠별 오늘의 운세" h="가족 띠도 오늘 운세를 볼 수 있어요" price="무료" />
          <div style={{ margin: '0 16px' }}>
            {/* 2026-10-25 가족 생일 넣기는 관계 '가족'으로 시작 (예전엔 '본인'이라 본인 교체 창이 떴다) */}
            <TtiFortune today={today} dayGz={tg.gz} dayKo={tg.ko} src="family"
              onInput={() => navigate('/input?new=1&from=daily', { state: { relation: '가족' } })} compatPrice={compat} onCompat={() => navigate('/compat')} />
          </div>
        </Band>
      )}

      {/* ━━━ 4. 사주책 (종합사주) — 오너가 좋다고 한 책, 대운 띠, 목차 그대로 ━━━ */}
      {/* 2026-10-27 가장 큰 풀이라 먹 바탕에 금선 두 줄(프리미엄 예외)로 다른 덩어리와 확실히 가른다 */}
      <Band tone="ink" gold>
      <SecTitle id="home-premium" rule={false} dark mark="命" k="평생 한 번 읽는 종합사주" h="타고난 성격부터 10년 대운까지" price={`${premium}운`}
        d="내 사주 전체를 열 장으로 풀어 드리는 가장 긴 풀이예요" />
      {/* 2026-10-15 오너: 책을 눌러도 종합사주로 — 책 그림, 소개, 대운 띠, 목차 어디를 눌러도 같은 곳으로 */}
      <button type="button" onClick={() => goPremium('book')} aria-label="종합사주 보기"
        style={{ display: 'block', width: 'calc(100% - 32px)', margin: '0 16px', padding: 0, border: 0, borderRadius: '20px 20px 0 0', height: 318, position: 'relative', overflow: 'hidden', background: '#E9E0CD', cursor: 'pointer' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${ART.jangansa})`, backgroundSize: 'cover', backgroundPosition: '40% 55%', opacity: 0.42 }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 55%, rgba(233,224,205,0) 30%, rgba(233,224,205,.7) 100%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)' }}>
          <GoBook title={facts?.persona ? `${facts.persona.dayGz}命書` : '四柱命書'} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontSize: 13, color: HJ.ink2, fontWeight: 600 }}>
          {/* 10-23 — 시간을 모르면 여섯 글자 (아래 첫 문장이 '여섯 글자'라고 말해 한 카드 안에서 어긋났다) */}
          {facts?.persona ? `${displayName}, ${facts.persona.birthYearGz}生: ${hasTime ? '8' : '6'}글자로 엮은 열 장` : '태어난 날과 시간으로 엮는 열 장'}
        </div>
      </button>
      <section style={{ margin: '0 16px', background: HJ.card, border: `1px solid ${HJ.line}`, borderTop: 0, borderRadius: '0 0 20px 20px', padding: 18 }}>
        <div role="link" tabIndex={0} aria-label="종합사주 자세히 보기" style={{ cursor: 'pointer' }}
          onClick={() => goPremium('card')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goPremium('card'); } }}>
        {/* 2026-10-23 P1-3 — 첫 문장은 만세력 사실. 예전 일주 고정 문구는 5월생에게 '겨울 밤하늘의 별'이라고 했다.
             둘째 줄은 빠진 오행이 대운으로 들어올 때만 (지금 대운과 다음 10년은 아래 대운 띠가 이미 말한다) */}
        {story ? (
          <>
            <p style={{ fontFamily: SERIF, fontSize: 19.5, fontWeight: 700, lineHeight: 1.5, letterSpacing: '-.02em', wordBreak: 'keep-all' }}>
              {story.first}
            </p>
            {story.secondKind === 'bring' && story.second && (
              <p style={{ fontSize: 15, color: HJ.ink2, marginTop: 6, lineHeight: 1.65, wordBreak: 'keep-all' }}>{story.second}</p>
            )}
            <p style={{ fontSize: 14, color: HJ.mute, marginTop: 6, lineHeight: 1.6 }}>
              {story.dayGz}일주에서 시작해 돈, 사랑, 일, 건강까지 열 장으로 풀어요.
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
                {facts.persona.nextYear && !nextYearSaid ? <>, 다음 10년이 바뀌는 해는 <b style={{ color: HJ.ink }}>{facts.persona.nextYear}년</b>이에요.</> : '이에요.'}
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
          보관함에서 다시 볼 수 있고 PDF로 저장할 수 있어요. 다 읽고 궁금한 건 바로 물어보세요.
        </p>
        <GoldCta style={{ marginTop: 14 }} onClick={() => goPremium('cta')} sub={`${premium}운`}>
          {hasSaju ? '내 종합사주 보기' : '종합사주 보기'}
        </GoldCta>
      </section>
      </Band>

      {/* ━━━ 4. 신년운세 (그림 띠) — 2026-10-27 다른 덩어리처럼 머리를 단다 ━━━ */}
      <SecTitle id="home-newyear" rule={false} mark="歲" k={`${NEW_YEAR_TARGET} 신년운세`} h={`${NEW_YEAR_TARGET}년, 달마다 미리 보기`} price={`${tojung}운`}
        d={`${NEW_YEAR_TARGET}년 열두 달을 달마다 좋은 날까지 풀어요`} />
      <button type="button" onClick={() => navigate('/tojung')} className="text-left"
        style={{ display: 'block', margin: '0 16px', width: 'calc(100% - 32px)', borderRadius: 18, overflow: 'hidden', position: 'relative', border: 0, background: HJ.ink, color: '#F1ECE1', padding: 0 }}>
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
      {/* 2026-10-19 열두 띠 2027년 한 장 (가족 단톡방용, 무료) → 내 사주 신년운세로 */}
      <button type="button" onClick={() => { import('@/services/analytics').then((a) => a.trackEvent('cta_click', { label: '홈 2027 띠 한 장', page: '/' })).catch(() => {}); navigate('/tti/2027'); }}
        className="w-full" style={{ marginTop: 6, padding: '8px 16px', fontSize: 14.5, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
        열두 띠 {NEW_YEAR_TARGET}년 운세 한 장으로 보기 ›
      </button>

      {/* ━━━ 5. 기간별 (달력 장 두 장 — 큰 숫자로 읽기 전에 보이게) ━━━ */}
      <Band tone="deep">
      <SecTitle id="home-period" rule={false} mark="月" k="기간별 운세" h="이번 주와 다음 달" price={periodFrom}
        d={`날마다 좋은 일과 조심할 일을 미리 봐요. 주간운세 ${weekly}운, 월운세 ${monthly}운`} />
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
      </Band>

      {/* ━━━ 6-1. 지금 많이 보는 풀이 (실제 집계만 · 3개 미만이면 숨김) ━━━ */}
      {liveBest.length >= 3 && (
        <>
          <SecTitle rule={false} mark="衆" k="실시간 인기" h="지금 많이 보는 풀이" />
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
        <Band tone="deep">
          <SecTitle rule={false} mark="言" k="먼저 본 사람들" h="읽어본 사람들이 남긴 말" />
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
        </Band>
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
        {/* 웹은 아래 LegalFooter 가 같은 줄을 그린다(두 번 보이던 것). 앱은 LegalFooter 가 없어 여기서 그린다 */}
        {(isAppintosBuild || isAppsInToss()) && <p style={{ marginTop: 6, fontSize: 13.5, color: HJ.mute }}>© 2026 사주500</p>}
      </div>
      <LegalFooter />
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}.home-season>div{padding:0 16px!important}.home-season>div+div{padding-top:10px!important}`}</style>
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

/** 덩어리 머리 — 2026-10-27 지인 VOC '구분이 안 간다' → 위에 고서 장 구분선(두 줄), 왼쪽 먹 도장 글자(홈 목차와 같은 글자),
 *  오른쪽 값, 아래 한 줄 설명. 금색 없이 먹과 종이만 */
function SecTitle({ k, h, mark, price, d, id, rule = true, dark = false }: { k: string; h: string; mark?: string; price?: string; d?: string; id?: string; rule?: boolean; dark?: boolean }) {
  return (
    <div id={id} style={{ margin: rule ? '34px 16px 0' : '0 16px', padding: rule ? '20px 6px 14px' : '24px 6px 14px', borderTop: rule ? '3px double rgba(26,22,18,.3)' : undefined, scrollMarginTop: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {mark && <InkMark size={38} fontSize={21} invert={dark}>{mark}</InkMark>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#B9AF9E' : HJ.mute }}>{k}</div>
          <h2 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.38, marginTop: 2, wordBreak: 'keep-all', color: dark ? '#F4EFE4' : HJ.ink }}>{h}</h2>
        </div>
        {price && <span style={{ alignSelf: 'flex-end', fontSize: 14, fontWeight: 800, color: dark ? '#F1ECE1' : HJ.ink, whiteSpace: 'nowrap', paddingBottom: 3 }}>{price}</span>}
      </div>
      {d && <p style={{ fontSize: 14, color: dark ? '#CFC6B6' : HJ.ink2, lineHeight: 1.6, marginTop: 10, wordBreak: 'keep-all' }}>{d}</p>}
    </div>
  );
}

/** 덩어리 바탕 띠 (2026-10-27) — 같은 종이 위에 흰 카드만 이어져 덩어리가 안 갈렸다. 짙은 한지, 먹(종합사주는 금선 두 줄) */
const HJ_DEEP = '#EBE3D2';
function Band({ tone, gold, children }: { tone: 'deep' | 'ink'; gold?: boolean; children: ReactNode }) {
  const ink = tone === 'ink';
  const edge = gold ? '3px double rgba(184,150,90,.8)' : `1px solid ${ink ? HJ.ink : 'rgba(26,22,18,.1)'}`;
  return (
    <div style={{ marginTop: 34, background: ink ? HJ.ink : HJ_DEEP, padding: '0 0 30px', borderTop: edge, borderBottom: edge }}>
      {children}
    </div>
  );
}

/** 먹 도장 글자 칸 (덩어리 머리와 홈 목차) — 주제 칸의 먹 테두리, 위 두 고민의 빨간 도장과 다르게 먹을 채운다 */
function InkMark({ children, size, fontSize, invert }: { children: ReactNode; size: number; fontSize: number; invert?: boolean }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 6, background: invert ? '#F4EFE4' : HJ.ink, color: invert ? HJ.ink : '#F1ECE1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize, fontWeight: 900, flexShrink: 0 }}>
      {children}
    </span>
  );
}

/** 홈 목차 한 줄 (2026-10-27) — 무엇이 있고 얼마인지 한눈에, 누르면 그 덩어리로 내려간다 */
function QuickNav({ items }: { items: Array<{ mark: string; label: string; price: string; to: string }> }) {
  const go = (to: string, label: string) => {
    trackEvent('cta_click', { label: `홈 목차 ${label}`, page: '/' });
    const el = document.getElementById(to);
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { el.scrollIntoView(); }
  };
  return (
    <nav aria-label="홈 목차" style={{ margin: '22px 16px 0', background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '12px 4px 10px' }}>
      {/* 2026-10-27 오너: 원화 표기(1운은 500원)는 굳이 넣지 않는다 — 원화는 충전 화면에서만 (4월 방침 그대로) */}
      <div style={{ padding: '0 12px 8px', fontSize: 14, fontWeight: 800, color: HJ.ink }}>사주500에서 볼 수 있는 것</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it, i) => (
          <button key={it.to} type="button" onClick={() => go(it.to, it.label)} className="mo-press"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '6px 2px', minHeight: 88, background: 'transparent', border: 0, borderLeft: i ? `1px solid ${HJ.line}` : 0 }}>
            <InkMark size={34} fontSize={19}>{it.mark}</InkMark>
            <span style={{ fontSize: 13, fontWeight: 700, color: HJ.ink, lineHeight: 1.25, wordBreak: 'keep-all', textAlign: 'center' }}>{it.label}</span>
            <span style={{ fontSize: 13, color: HJ.ink2, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{it.price}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/** '이번 달 소식' 묶음 — 안의 카드는 날짜, 생일, 나이에 따라 스스로 숨는다. 하나도 안 그려지면 머리도 숨긴다 */
function SeasonGroup({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [has, setHas] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setHas(el.childElementCount > 0);
    check();
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true });
    return () => mo.disconnect();
  }, []);
  return (
    <>
      {has && <SecTitle rule={false} mark="今" k="이번 달 소식과 혜택" h="지금 챙겨 볼 것" />}
      <div ref={ref} className="home-season">{children}</div>
    </>
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

/** 고민 위 두 개 — 한 줄 카드 (빨간 도장, 2026-10-23 P1-3). i 는 보일 때 차례로 떠오르는 순서 */
function TopicCard({ hz, t, s, price, days, onClick, i = 0 }: { hz: string; t: string; s: string; price: string; days?: number | null; onClick: () => void; i?: number }) {
  // 2026-10-27 별이 들어오기까지 남은 날(hookFacts 계산)을 오른쪽에 큰 숫자로. 사실이 없으면 값만
  const hasDays = typeof days === 'number' && days >= 0 && days <= 400;
  return (
    <button type="button" onClick={onClick} className="w-full text-left mo-press mo-rise"
      style={{ ...moVars({ i }), display: 'flex', gap: 14, alignItems: 'center', background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 16, padding: '15px 16px', minHeight: 86 }}>
      <SealBox size={44} fontSize={24}>{hz}</SealBox>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: HJ.ink, lineHeight: 1.35 }}>{t}</span>
        <span style={{ display: 'block', fontSize: 14.5, lineHeight: 1.5, color: HJ.ink2, marginTop: 3, wordBreak: 'keep-all' }}>{s}</span>
      </span>
      {hasDays ? (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, paddingLeft: 10, borderLeft: `1px solid ${HJ.line}` }}>
          <span style={{ fontSize: 13, color: HJ.mute, fontWeight: 700 }}>{days === 0 ? '오늘부터' : '남은 날'}</span>
          {days !== 0 && (
            <span style={{ fontFamily: SERIF, fontWeight: 900, color: HJ.ink, lineHeight: 1.05 }}>
              <span style={{ fontSize: 30 }}>{days}</span><span style={{ fontSize: 14, fontWeight: 700 }}>일</span>
            </span>
          )}
          <span style={{ fontSize: 13.5, fontWeight: 800, color: HJ.ink2, marginTop: 2, whiteSpace: 'nowrap' }}>{price} ›</span>
        </span>
      ) : (
        <span style={{ fontSize: 15, fontWeight: 800, color: HJ.ink, whiteSpace: 'nowrap' }}>{price} ›</span>
      )}
    </button>
  );
}

/** 고민 나머지 아홉 — 세 칸 격자 한 칸 (먹 테두리 도장, 2026-10-26 '고민 더 보기' 대신 전부 보이게) */
function TopicTile({ hz, t, short, price, onClick, i }: { hz: string; t: string; short?: string; price: string; onClick: () => void; i: number }) {
  return (
    <button type="button" onClick={onClick} className="mo-press mo-rise"
      style={{ ...moVars({ i }), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 5, minHeight: 132, padding: '14px 6px 12px', background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, textAlign: 'center' }}>
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 5, boxShadow: `inset 0 0 0 1.5px ${HJ.ink}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 19, fontWeight: 900, color: HJ.ink }}>{hz}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: HJ.ink, lineHeight: 1.3, wordBreak: 'keep-all' }}>{t}</span>
      {short && <span style={{ fontSize: 13, color: HJ.ink2, lineHeight: 1.4, wordBreak: 'keep-all', flex: 1 }}>{short}</span>}
      <span style={{ fontSize: 13, fontWeight: 800, color: HJ.ink }}>{price}</span>
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
