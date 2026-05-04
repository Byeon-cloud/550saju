// HomePage v4.2 (2026-04-22 PM) — v4.1 + 통일 개편 (준기 8 결정 반영)
// 사양: docs/mockups/사주500_UI개편_목업_홈_v4.html + Cowork 세션 14 교정 + PM 8 결정
// 순서: ProfileSwitcher → [01]오늘운세 → [02]꿈해몽 → [03]프리미엄 → [05]확장4
//       → [07]후기16 → [04]주제10 → [08]3차별성 → [09]해시태그22 → [06inline]상담anchor → [10]Footer
// #49 (2026-04-23): 후기16 위치 이동 — 확장4 직후, 주제10 앞
// PM 변경 포인트 (2026-04-22 준기 결정):
//  - 주제 5 → 10 (연애·재회·결혼·재물·합격이직·사업·건강·이사이동·학업·직업)
//    + 인기 딱지 (연애·재회·합격이직), 추천 딱지 (사업·재물)
//  - 사주대화 [06] 카드 제거 → 푸터 직전 1줄 인라인 anchor 로 대체
//    카피: "심층적인 상담이 필요한 날엔? → 사주 상담하러 가기"
//  - [08] 철학 단일 Pillar → 3 차별성 인포그래픽 (어려운 한자 No / 6대 원전 기반 / 모순 없는 풀이)
//    멘트 던지지 말고 도식화. 이모지 절대 X (SVG + 한자 + 컬러칩만).
// 기존 v4.1 교정 (유지):
//  - "오늘의 운세" 이름 강조 과잉 제거 / "처음부터 끝까지 읽어드립니다" / "가족·지인 재조회"
//  - "AI 같지 않은" 카피 제거 / "광고는 있지만" 후기 치환

import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useActiveProfile, useTodayHeadline } from '@/hooks/useHomeData';
import { HOME_REVIEWS } from '@/constants/reviews';
import { listTopics } from '@/constants/topics'; // 10주제 SSOT (id/한자/컬러/딱지/path)
// 프리미엄 카드 클릭 → /premium (ProfilePicker + 10운 차감 + /loading)

/* SSOT 디자인 토큰 — PC_인수인계 §5 기준 (2026-04-22) */
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  gray500: '#6B6B6B',
  grayLine: '#E5DFD0',
  gold: '#B8965A',
  goldDark: '#8C6D3D',           // SSOT gold-deep — D1 fix (2026-04-23)
  /** 2026-05-04 신규: h2 헤드라인 강조 색 (PremiumResult 본문 strong 과 통일 · 가독성 ↑) */
  goldHi: '#A37A2E',
  goldSoft: 'rgba(184,150,90,0.14)', // SSOT soft gold — D1 fix (2026-04-23)
  goldShimmer: '#E8D9B8',
} as const;

const SERIF = "'Noto Serif KR', serif";

/* 주제 10색 — @/constants/topics SSOT 참조 (TOPIC_REGISTRY[id].color).
   (구 inline TOPIC_COLORS 는 2026-04-22 SSOT 일원화 이후 제거) */

/* 확장 4색 */
const EXT_COLORS = {
  daeun:   '#3B7A4B', // 대운 運
  monthly: '#B5441F', // 월운 月
  compat:  '#9C5A8A', // 궁합 合
  tojung:  '#2F4B7C', // 토정비결 歲
} as const;

// 2026-05-04 dead code 제거 — HASHTAGS 22개 + @ts-expect-error 함께 정리 (Top 5 로 완전 대체됨).

function getTodayStr(): string {
  const d = new Date();
  const weekday = ['일','월','화','수','목','금','토'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${weekday}요일`;
}

export function HomePage() {
  usePageTitle('사주500 · 무료로 시작');
  const navigate = useNavigate();
  const { name, hasProfile } = useActiveProfile();
  const todayHint = useTodayHeadline();

  /** DEEP DIVE 10주제 가로 스크롤 ref — 우측 화살표 버튼이 살짝 밀어줌 (60대+ 가로스크롤 affordance) */
  const deepDiveScrollRef = useRef<HTMLDivElement>(null);
  const scrollDeepDiveRight = () => {
    deepDiveScrollRef.current?.scrollBy({ left: 158, behavior: 'smooth' });
  };

  const displayName = name || '사용자';
  const todayStr = useMemo(() => getTodayStr(), []);
  const reviewDoubled = useMemo(() => [...HOME_REVIEWS, ...HOME_REVIEWS], []);

  /**
   * 지금 인기 Top 5 (2026-05-04 + UX 보강)
   *  - 1위 = 종합사주(10운, 가장 비싼 상품) 고정
   *  - 2~5위 = 날짜 시드 기반 셔플 (같은 날엔 같은 순서 · 새로고침해도 동일 → 거짓 들통 방지)
   *  - 매일 자정 시드 변경 → 새로운 순위처럼 보임
   *  - 트래픽 쌓이면 Cloud Function 실시간 집계로 교체 (Sprint 2 §11 D3)
   */
  const liveBestTop5 = useMemo(() => {
    type LiveBestItem = { rank: number; label: string; sub: string; path: string; heat: 'HOT' | 'NEW' | '' };
    const FIXED_TOP1: LiveBestItem = { rank: 1, label: '종합 사주', sub: '10섹션 깊이 풀이 · 10운', path: '/premium', heat: 'HOT' };
    const POOL: Omit<LiveBestItem, 'rank'>[] = [
      { label: '오늘의 운세',   sub: '매일 1회 무료',         path: '/daily',          heat: 'HOT' },
      { label: '재물운',         sub: '돈·실리·재물 흐름',     path: '/topic/wealth',   heat: 'HOT' },
      { label: '연애운',         sub: '만남·관계·인연 흐름',   path: '/topic/love',     heat: '' },
      { label: '대운 흐름',      sub: '60년 인생 큰 강줄기',   path: '/daeun',          heat: 'NEW' },
      { label: '꿈 해몽',        sub: '오늘 꾼 꿈의 의미',     path: '/dream',          heat: '' },
      { label: '결혼운',         sub: '인연 시기와 배우자 결', path: '/topic/marriage', heat: '' },
      { label: '직업운',         sub: '커리어·승진·평생 결',   path: '/topic/career',   heat: '' },
      { label: '재회운',         sub: '헤어진 사람과의 흐름',   path: '/topic/reunion',  heat: 'NEW' },
      { label: '월별 운세',      sub: '12개월 좋은 달·조심할 달', path: '/monthly',     heat: '' },
      { label: '토정비결',       sub: '주역 64괘로 한 해',     path: '/tojung',         heat: '' },
    ];
    // 날짜 기반 시드 셔플 — 같은 날 새로고침 시 동일 순서 보장 (거짓 들통 방지)
    const today = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (let i = 0; i < today.length; i++) seed = (seed * 31 + today.charCodeAt(i)) % 2147483647;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const shuffled = [...POOL];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const rest: LiveBestItem[] = shuffled.slice(0, 4).map((p, i) => ({ ...p, rank: i + 2 }));
    return [FIXED_TOP1, ...rest];
  }, []);

  const go = (path: string) => () => navigate(path);
  // 프리미엄 클릭 → /premium (ProfilePicker + 10운 차감 + /loading)
  const goPremium = () => {
    navigate('/premium');
  };

  return (
    <div style={{ background: C.paper, minHeight: '100vh', paddingBottom: 32 }}>

      {/* ─── [00] ProfileSwitcher ─── */}
      <button
        type="button"
        onClick={() => hasProfile ? navigate('/storage') : navigate('/input')}
        className="mx-4 mt-3 w-[calc(100%-32px)] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
        style={{ background: C.goldSoft }}
        aria-label={hasProfile ? '프로필 전환' : '사주 입력하기'}
      >
        <span className="text-[11.5px] font-medium" style={{ color: C.inkSoft }}>
          {hasProfile ? '지금 보는 사주 →' : '처음 시작하기 →'}
        </span>
        <span className="flex-1 text-left text-sm font-bold truncate" style={{ color: C.ink }}>
          {hasProfile ? displayName : '사주를 입력하고 시작하세요'}
        </span>
        <span className="text-xs" style={{ color: C.goldDark }}>▼</span>
      </button>

      {/* ─── [01] Pillar 1 · 오늘의 운세 ─── */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        onClick={go('/daily')}
        className="relative mx-4 mt-4 w-[calc(100%-32px)] rounded-[20px] px-[22px] py-5 text-left overflow-hidden"
        style={{
          height: 210,
          background: 'linear-gradient(135deg, #B5441F 0%, #7B2E15 100%)',
          color: C.paper,
        }}
      >
        <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{ background: 'rgba(248,245,238,0.18)', color: C.paper, backdropFilter: 'blur(8px)' }}>
          <span className="w-1 h-1 rounded-full" style={{ background: C.goldShimmer, boxShadow: '0 0 0 2px rgba(232,217,184,0.25)' }} />
          오늘 1회 무료
        </div>
        <div className="text-[12px] font-medium" style={{ opacity: 0.85 }}>{todayStr}</div>
        <div className="mt-3">
          <h2 className="text-[26px] font-extrabold leading-[1.28] tracking-[-0.02em]" style={{ fontFamily: SERIF }}>
            오늘의 운세
          </h2>
          <p className="mt-2 text-[13.5px] leading-[1.6] font-medium max-w-[320px]" style={{ opacity: 0.92 }}>
            {hasProfile ? todayHint : '사주만 입력하면 매일 하루 한 장 무료로 받을 수 있어요.'}
          </p>
        </div>
        <span className="absolute -bottom-7 -left-3 text-[140px] font-black leading-none pointer-events-none"
          style={{ opacity: 0.1, fontFamily: SERIF }}>火</span>
      </motion.button>

      {/* ─── [02] Pillar 2 · 꿈해몽 ─── */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        onClick={go('/dream')}
        className="relative mx-4 mt-3 w-[calc(100%-32px)] rounded-[20px] px-[22px] py-5 text-left overflow-hidden"
        style={{ height: 210, background: C.ink, color: C.paper }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          opacity: 0.18,
          backgroundImage: `
            radial-gradient(circle at 20% 30%, #fff 0.6px, transparent 1px),
            radial-gradient(circle at 70% 50%, #fff 0.8px, transparent 1px),
            radial-gradient(circle at 40% 70%, #fff 0.5px, transparent 1px),
            radial-gradient(circle at 85% 20%, #fff 0.7px, transparent 1px),
            radial-gradient(circle at 15% 85%, #fff 0.6px, transparent 1px)
          `,
        }} />
        <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{ background: 'rgba(248,245,238,0.18)', color: C.paper, backdropFilter: 'blur(8px)' }}>
          <span className="w-1 h-1 rounded-full" style={{ background: C.goldShimmer }} />
          오늘 1회 무료
        </div>
        <h2 className="mt-7 text-[26px] font-extrabold leading-[1.28] tracking-[-0.02em]" style={{ fontFamily: SERIF }}>
          어젯밤 꿈,<br />내 사주로 풀어드려요
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.6] font-medium" style={{ opacity: 0.92 }}>
          꿈 단어를 적으면 {hasProfile ? `${displayName}님` : '여러분'} 사주에 맞춰 해석해드려요
        </p>
        <span className="absolute -bottom-6 right-2 text-[120px] font-black leading-none pointer-events-none"
          style={{ opacity: 0.08, color: C.goldShimmer, fontFamily: SERIF }}>夢</span>
      </motion.button>

      {/* ─── [03] 프리미엄 15운 (비즈니스 메인 — 2026-04-27 4 패키지 정정: 10본+5보너스) ─── */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        onClick={goPremium}
        className="relative mx-4 mt-6 w-[calc(100%-32px)] rounded-[18px] px-[22px] pt-[22px] pb-5 text-left overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2520 60%, #1a1a1a 100%)',
          color: C.paper,
          border: '1px solid rgba(184,150,90,0.4)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at 85% 30%, rgba(232,217,184,0.22) 0%, transparent 55%),
                       radial-gradient(ellipse at 10% 90%, rgba(184,150,90,0.18) 0%, transparent 55%)`,
        }} />
        <div className="flex items-center gap-1.5 relative z-10">
          <span className="text-[10.5px] font-extrabold px-2.5 py-1 rounded-full tracking-[0.05em]"
            style={{ background: `linear-gradient(135deg, ${C.goldShimmer}, ${C.gold})`, color: C.ink }}>
            PREMIUM
          </span>
          <span className="text-[11px] font-bold px-2 py-1 rounded-full"
            style={{ color: C.goldShimmer, border: '1px solid rgba(232,217,184,0.4)' }}>
            10운
          </span>
        </div>
        <span className="absolute right-[-8px] top-[14px] text-[148px] font-black leading-none pointer-events-none"
          style={{ color: C.gold, opacity: 0.12, fontFamily: SERIF }}>命</span>
        <h2 className="mt-6 text-[24px] font-extrabold leading-[1.3] tracking-[-0.01em] relative" style={{ fontFamily: SERIF }}>
          당신의 <em className="not-italic" style={{ color: C.goldShimmer }}>사주 전체</em>를<br />처음부터 끝까지 읽어드립니다
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-[1.65] max-w-[300px] relative" style={{ opacity: 0.88 }}>
          천간·지지·대운·십성·신살 — 한 권의 깊이로 {hasProfile ? `${displayName}님` : '당신'}의 삶을 정리해드립니다.
        </p>
        <div className="mt-3.5 flex gap-1.5 flex-wrap relative">
          {['10개 섹션 완전 분석', '가족·지인 사주도 함께', 'PDF로 보관'].map((f) => (
            <span key={f} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ border: '1px solid rgba(232,217,184,0.28)', color: C.goldShimmer, background: 'rgba(232,217,184,0.06)' }}>
              {f}
            </span>
          ))}
        </div>
        <div className="mt-4 pt-3.5 flex items-center justify-between relative"
          style={{ borderTop: '1px solid rgba(232,217,184,0.18)' }}>
          <span className="text-[12px]" style={{ color: 'rgba(248,245,238,0.7)' }}>
            한 번 결제하면 보관함에서 언제든 다시 보기
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] font-bold px-4 py-2 rounded-full"
            style={{ background: C.goldShimmer, color: C.ink }}>
            10운으로 시작 →
          </span>
        </div>
      </motion.button>

      {/* ─── [05] 더 알아볼 주제 · 확장 4종 ─── */}
      <div className="mx-4 mt-6 flex items-baseline justify-between">
        <h3 className="text-[17px] font-bold tracking-[-0.01em]" style={{ color: C.ink, fontFamily: SERIF }}>
          더 알아볼 주제
        </h3>
        <span className="text-[11.5px]" style={{ color: C.gray500 }}>
          대운·월운·궁합·토정비결
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mx-4 mt-2.5">
        {[
          { id: 'daeun',  kanji: '運', h: '대운 10년 흐름', sub: '앞으로의 10년 주기 기운', strip: EXT_COLORS.daeun,   path: '/daeun' },
          { id: 'wolun',  kanji: '月', h: '월운 이번 달',   sub: '이번 달 재물·연애·일',   strip: EXT_COLORS.monthly, path: '/monthly' },
          { id: 'gung',   kanji: '合', h: '궁합 보기',      sub: '두 사람 사주 궁합',      strip: EXT_COLORS.compat,  path: '/compat' },
          { id: 'tojeong',kanji: '歲', h: '토정비결',       sub: '올해 1년 흐름',          strip: EXT_COLORS.tojung,  path: '/tojung' },
        ].map((c) => (
          <motion.button
            key={c.id}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={go(c.path)}
            className="relative h-[120px] px-4 py-3.5 rounded-[14px] text-left overflow-hidden"
            style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}
          >
            <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
              style={{ background: c.strip }} />
            <span className="absolute right-[-6px] top-[-10px] text-[78px] font-black leading-none"
              style={{ opacity: 0.14, color: c.strip, fontFamily: SERIF }}>{c.kanji}</span>
            <h4 className="relative text-[15.5px] font-bold" style={{ color: C.ink }}>{c.h}</h4>
            <p className="relative text-[11.5px] leading-[1.45] mt-1" style={{ color: C.inkSoft }}>{c.sub}</p>
            <span className="absolute bottom-3 right-3 text-[10.5px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: C.goldDark, background: C.goldSoft }}>
              1운
            </span>
          </motion.button>
        ))}
      </div>

      {/* ─── [04] 궁금한 주제 하나, 깊게 · 주제 10종 가로 스크롤 (2026-05-04 swap: DEEP DIVE 위로) ─── */}
      <div className="mx-4 mt-9">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-extrabold tracking-[0.15em]" style={{ color: C.goldDark }}>DEEP DIVE</span>
          <span className="flex-1 h-[1px]" style={{ background: `linear-gradient(90deg, ${C.grayLine}, transparent)` }} />
          <span className="text-[10.5px] font-bold" style={{ color: C.gray500 }}>10주제 · 1운씩</span>
        </div>
        <h2 className="mt-1.5 text-[20px] font-extrabold tracking-[-0.015em] leading-[1.3]" style={{ color: C.ink, fontFamily: SERIF }}>
          진짜 궁금한 한 가지, <span style={{ color: C.goldHi }}>깊게 파보세요</span>
        </h2>
      </div>
      <p className="mx-4 mt-2 text-[13px] leading-[1.6]" style={{ color: C.inkSoft }}>
        연애·재회·결혼·재물·합격이직·사업·건강·이사·학업·직업 — <strong style={{ color: C.ink }}>한 주제만 1운</strong>으로 끝까지 풀어드려요.
      </p>
      {/* 2026-05-04 우측 화살표 button — 60대+ 가로 스크롤 affordance */}
      <div className="relative mt-3">
        <div
          ref={deepDiveScrollRef}
          className="overflow-x-auto pb-2 no-scrollbar"
          style={{ scrollSnapType: 'x mandatory' }}
        >
        <div className="flex gap-2.5 px-4" style={{ width: 'max-content' }}>
          {/* 10주제 SSOT 소비 — @/constants/topics (순서/한자/컬러/딱지/subCopy/path 모두 SSOT) */}
          {listTopics().map((t) => (
            <motion.button
              key={t.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={go(t.path)}
              className="relative min-w-[148px] h-[168px] rounded-[16px] px-4 py-4 text-left overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: `1px solid ${C.grayLine}`,
                scrollSnapAlign: 'start',
              }}
              aria-label={`${t.label} 분석으로 이동`}
            >
              <span className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: t.color }} />
              <span className="absolute right-[-10px] bottom-[-20px] text-[104px] font-black leading-none"
                style={{ opacity: 0.1, color: t.color, fontFamily: SERIF }}>{t.kanji}</span>
              {/* 인기/추천 딱지 — 우상단 (이모지 X · 텍스트만) */}
              {t.badge && (
                <span
                  className="absolute top-2 right-2 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-[4px] tracking-[0.06em]"
                  style={{
                    color: '#FFFFFF',
                    background: t.color,
                    letterSpacing: '0.04em',
                  }}
                >
                  {t.badge}
                </span>
              )}
              <div className="relative">
                <div className="text-[11px] font-bold tracking-[0.04em]" style={{ color: t.color }}>
                  {t.kanji}
                </div>
                <h4 className="mt-1 text-[17px] font-extrabold" style={{ color: C.ink, fontFamily: SERIF }}>
                  {t.label}
                </h4>
                <p className="mt-1.5 text-[11.5px] leading-[1.45]" style={{ color: C.inkSoft }}>
                  {t.subCopy}
                </p>
              </div>
              <span className="absolute bottom-3 left-4 text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                style={{ color: C.goldDark, background: C.goldSoft }}>
                1운
              </span>
            </motion.button>
          ))}
          <div className="min-w-[16px]" />
        </div>
        </div>
        {/* 우측 화살표 버튼 — 60대+ 가로 스크롤 affordance · 카드 1개 분량(158px) 부드럽게 이동 */}
        <button
          type="button"
          aria-label="다른 주제 더 보기"
          onClick={scrollDeepDiveRight}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.96)',
            border: `1px solid ${C.grayLine}`,
            boxShadow: `0 4px 12px rgba(184,150,90,0.20), 0 0 0 4px rgba(255,255,255,0.45)`,
            zIndex: 2,
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.goldHi} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* ─── [07] Reviews 16 (우→좌 자동 캐러셀) · 2026-05-04 swap: DEEP DIVE 다음 ─── */}
      <div id="voices-section" className="mx-4 mt-9 scroll-mt-24">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-extrabold tracking-[0.15em]" style={{ color: C.goldDark }}>VOICES</span>
          <span className="flex-1 h-[1px]" style={{ background: `linear-gradient(90deg, ${C.grayLine}, transparent)` }} />
        </div>
        <h2 className="mt-1.5 text-[20px] font-extrabold tracking-[-0.015em] leading-[1.3]" style={{ color: C.ink, fontFamily: SERIF }}>
          먼저 받아본 분들이 <span style={{ color: C.goldHi }}>남긴 한 줄</span>
        </h2>
      </div>
      <div className="mt-3 overflow-hidden pb-2"
        style={{ maskImage: 'linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)' }}>
        <div className="flex gap-3 px-4 review-scroll">
          {reviewDoubled.map((r, i) => (
            <div key={i} className="min-w-[280px] max-w-[280px] h-[116px] rounded-2xl p-4"
              style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}>
              <div className="text-[11.5px] font-semibold mb-1.5" style={{ color: C.goldDark }}>
                {r.age} {r.gender}
              </div>
              <div className="text-[13px] leading-[1.6] font-medium line-clamp-3" style={{ color: C.ink }}>
                {r.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── [06inline] 사주대화 anchor (2026-05-04: VOICES 밑으로 이동 + 키움 + 줄바꿈) ─── */}
      <div className="mx-4 mt-7 text-center">
        <button
          type="button"
          onClick={go('/chat')}
          className="inline-flex flex-col items-center gap-1.5 px-5 py-3.5 rounded-2xl transition-colors"
          style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.grayLine; }}
        >
          <span className="text-[14px] font-medium" style={{ color: C.gray500 }}>
            심층적인 상담이 필요한 날엔?
          </span>
          <span className="text-[17px] font-extrabold tracking-[-0.01em]"
            style={{ color: C.goldHi, fontFamily: SERIF }}>
            사주 상담하러 가기 →
          </span>
        </button>
      </div>

      {/* ─── [08] 3 차별성 인포그래픽 (PM 결정 #7 · 사주대화 카드 제거 + 철학 → 차별성 도식화) ─── */}
      {/*  멘트 던지지 말고 도식화. 이모지 X. SVG 아이콘 + 한자 + 컬러 칩만 사용.  */}
      <div className="mx-4 mt-9 w-[calc(100%-32px)]">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[10px] font-extrabold tracking-[0.15em]" style={{ color: C.goldDark }}>WHY 500</span>
          <span className="flex-1 h-[1px]" style={{ background: `linear-gradient(90deg, ${C.grayLine}, transparent)` }} />
        </div>
        <h2 className="mb-3 text-[20px] font-extrabold tracking-[-0.015em] leading-[1.3]"
          style={{ color: C.ink, fontFamily: SERIF }}>
          사주500이 <span style={{ color: C.goldHi }}>남다른 세 가지</span>
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {/* Card 1 — 어려운 한자 No (한자 X 도식) */}
          <div className="relative rounded-[14px] p-3.5 text-center overflow-hidden"
            style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}>
            <div className="relative h-[52px] flex items-center justify-center mb-2">
              <span className="text-[40px] font-black leading-none"
                style={{ color: C.ink, opacity: 0.18, fontFamily: SERIF }}>難</span>
              <svg viewBox="0 0 56 56" className="absolute inset-0 m-auto" width="56" height="56" aria-hidden="true">
                <line x1="8" y1="8" x2="48" y2="48" stroke={C.gold} strokeWidth="3" strokeLinecap="round" />
                <line x1="48" y1="8" x2="8" y2="48" stroke={C.gold} strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h4 className="text-[12.5px] font-extrabold leading-[1.3]"
              style={{ color: C.ink, fontFamily: SERIF }}>
              어려운 한자 No
            </h4>
            <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: C.inkSoft }}>
              쉬운 한국어로<br />풀어드려요
            </p>
          </div>

          {/* Card 2 — 6대 원전 기반 (책 6권 스택 SVG) */}
          <div className="relative rounded-[14px] p-3.5 text-center overflow-hidden"
            style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}>
            <div className="relative h-[52px] flex items-center justify-center mb-2">
              <svg viewBox="0 0 56 52" width="56" height="52" aria-hidden="true">
                {/* 6 stacked horizontal book bars */}
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const y = 6 + i * 7;
                  const w = 36 + ((i % 2) * 6);
                  const x = (56 - w) / 2;
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={y}
                      width={w}
                      height={4}
                      rx="1"
                      fill={C.gold}
                      opacity={0.25 + i * 0.12}
                    />
                  );
                })}
              </svg>
              <span className="absolute -bottom-1 right-1 text-[14px] font-black leading-none"
                style={{ color: C.goldDark, opacity: 0.85, fontFamily: SERIF }}>典</span>
            </div>
            <h4 className="text-[12.5px] font-extrabold leading-[1.3]"
              style={{ color: C.ink, fontFamily: SERIF }}>
              6대 원전 기반
            </h4>
            <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: C.inkSoft }}>
              전통 명리학<br />그대로
            </p>
          </div>

          {/* Card 3 — 단 500원, 깊이는 만 원짜리 */}
          <div className="relative rounded-[14px] p-3.5 text-center overflow-hidden"
            style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}>
            <div className="relative h-[52px] flex items-center justify-center mb-2">
              <svg viewBox="0 0 56 52" width="56" height="52" aria-hidden="true">
                {/* 동전 stack — 가성비 상징 */}
                <ellipse cx="28" cy="40" rx="18" ry="4" fill={C.gold} opacity="0.25" />
                <ellipse cx="28" cy="34" rx="18" ry="4" fill={C.gold} opacity="0.45" />
                <ellipse cx="28" cy="28" rx="18" ry="4" fill={C.gold} opacity="0.65" />
                <ellipse cx="28" cy="22" rx="18" ry="4" fill={C.gold} opacity="0.85" />
                <text x="28" y="25" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF" fontFamily={SERIF}>500</text>
              </svg>
            </div>
            <h4 className="text-[12.5px] font-extrabold leading-[1.3]"
              style={{ color: C.ink, fontFamily: SERIF }}>
              단 500원의 깊이
            </h4>
            <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: C.inkSoft }}>
              점집 50,000원<br />그 깊이 그대로
            </p>
          </div>
        </div>
      </div>

      {/* ─── [09] 실시간 Best Top 5 — CTA 직접 연결 ─── */}
      <div className="mx-4 mt-9">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[10px] font-extrabold tracking-[0.15em]" style={{ color: C.goldDark }}>LIVE BEST</span>
          <span className="flex-1 h-[1px]" style={{ background: `linear-gradient(90deg, ${C.grayLine}, transparent)` }} />
          <span className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: '#D32F2F' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#D32F2F', boxShadow: '0 0 0 2px rgba(211,47,47,0.18)' }} />
            오늘
          </span>
        </div>
        <h2 className="mb-3 text-[20px] font-extrabold tracking-[-0.015em] leading-[1.3]" style={{ color: C.ink, fontFamily: SERIF }}>
          오늘 가장 많이 보는 <span style={{ color: C.goldHi }}>Top 5</span>
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          {liveBestTop5.map((item) => (
            <button
              key={item.rank}
              type="button"
              onClick={go(item.path)}
              className="flex items-center gap-3 px-3 py-3 rounded-[12px] text-left transition-colors"
              style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.grayLine; }}
            >
              <span
                className="flex items-center justify-center font-extrabold"
                style={{
                  width: 26, height: 26, borderRadius: 6,
                  fontSize: 13, fontFamily: SERIF,
                  background: item.rank <= 3
                    ? `linear-gradient(135deg, #E8D9B8, ${C.goldDark})`
                    : C.goldSoft,
                  color: item.rank <= 3 ? '#1a1a1a' : C.goldDark,
                  flexShrink: 0,
                }}
              >
                {item.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold" style={{ color: C.ink, fontFamily: SERIF }}>{item.label}</span>
                  {item.heat === 'HOT' && (
                    <span className="text-[9px] font-extrabold px-1.5 rounded" style={{ background: '#D32F2F', color: '#fff' }}>HOT</span>
                  )}
                  {item.heat === 'NEW' && (
                    <span className="text-[9px] font-extrabold px-1.5 rounded" style={{ background: '#2D8A4E', color: '#fff' }}>NEW</span>
                  )}
                </div>
                <div className="text-[11.5px] mt-0.5" style={{ color: C.inkSoft }}>{item.sub}</div>
              </div>
              <span className="text-[14px] font-bold" style={{ color: C.goldDark, flexShrink: 0 }}>→</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── [10] Footer ─── */}
      <div className="mx-4 mt-5 pt-5 border-t text-center"
        style={{ borderColor: C.grayLine }}>
        <div className="text-[13.5px] font-bold tracking-[-0.01em]" style={{ color: C.ink, fontFamily: SERIF }}>
          사주500
        </div>
        <div className="mt-1 text-[11.5px]" style={{ color: C.gray500 }}>
          무료로 시작 · 필요한 만큼 1운
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-[11px]"
          style={{ color: C.gray500 }}>
          <button type="button" onClick={go('/my')}>내정보</button>
          <span style={{ color: C.grayLine }}>|</span>
          <button type="button" onClick={go('/charge')}>충전</button>
          <span style={{ color: C.grayLine }}>|</span>
          <button type="button" onClick={go('/storage')}>보관함</button>
        </div>
        <div className="mt-3 text-[10.5px]" style={{ color: C.gray500 }}>
          © 2026 사주500
        </div>
      </div>

      {/* Review scroll + 가로 스크롤바 숨김 (prefers-reduced-motion 존중) */}
      <style>{`
        @keyframes home-review-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .review-scroll {
          animation: home-review-scroll 90s linear infinite;
          width: max-content;
        }
        @media (prefers-reduced-motion: reduce) {
          .review-scroll { animation: none; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default HomePage;
