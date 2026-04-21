// HomePage v3 (2026-04-21 D-1 P1-7)
// 사양: docs/사주500_UI개편_01_홈.md + 목업 사주500_UI개편_목업_홈_v3.html
// 구조: BalanceBar → Profile → Pillar Daily/Dream → Premium 10운 → Topic 1운
//       → Why 3카드 → Caption 4카드 → Review 16개 캐러셀 → footer

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useActiveProfile, useTodayHeadline } from '@/hooks/useHomeData';
import { HOME_REVIEWS } from '@/constants/reviews';

/* 목업 그대로 HEX (tailwind 토큰과 별도 — 홈 전용 테마) */
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  gray500: '#6B6B6B',
  grayLine: '#E5DFD0',
  gold: '#B8965A',
  goldDark: '#7F6B4E',
  goldSoft: '#F0E8D9',
  goldShimmer: '#E8D9B8',
} as const;

const SERIF = "'Noto Serif KR', serif";

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

  const displayName = name || '사용자';
  const todayStr = useMemo(() => getTodayStr(), []);
  const reviewDoubled = useMemo(() => [...HOME_REVIEWS, ...HOME_REVIEWS], []);

  const go = (path: string) => () => navigate(path);

  return (
    <div style={{ background: C.paper, minHeight: '100vh', paddingBottom: 24 }}>
      {/* ─── 현재 활성 프로필 (ProfileSwitcher) ─── */}
      <button
        type="button"
        onClick={() => hasProfile ? navigate('/storage') : navigate('/input')}
        className="mx-4 mt-3 w-[calc(100%-32px)] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
        style={{ background: C.goldSoft }}
        aria-label={hasProfile ? '프로필 전환' : '사주 입력하기'}
      >
        <span className="text-[11.5px] font-medium" style={{ color: C.inkSoft }}>
          {hasProfile ? '지금 보는 사주 →' : '사주 없음 →'}
        </span>
        <span className="flex-1 text-left text-sm font-bold truncate" style={{ color: C.ink }}>
          {hasProfile ? displayName : '사주를 입력하고 시작하세요'}
        </span>
        <span className="text-xs" style={{ color: C.goldDark }}>▼</span>
      </button>

      {/* ─── Pillar 1 · 오늘의 운세 ─── */}
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
        {/* 태그 */}
        <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{ background: 'rgba(248,245,238,0.18)', color: C.paper, backdropFilter: 'blur(8px)' }}>
          <span className="w-1 h-1 rounded-full" style={{ background: C.goldShimmer, boxShadow: '0 0 0 2px rgba(232,217,184,0.25)' }} />
          오늘 1회 무료
        </div>
        {/* 날짜 */}
        <div className="text-[12px] font-medium" style={{ opacity: 0.85 }}>{todayStr}</div>
        {/* 타이틀 + 힌트 */}
        <div className="mt-3">
          <h2 className="text-[26px] font-extrabold leading-[1.28] tracking-[-0.02em]" style={{ fontFamily: SERIF }}>
            {hasProfile ? `${displayName}님의 오늘` : '오늘의 기운을 먼저 받아보세요'}
          </h2>
          <p className="mt-2 text-[13.5px] leading-[1.6] font-medium max-w-[320px]" style={{ opacity: 0.92 }}>
            {hasProfile ? todayHint : '사주만 입력하면 매일 하루 한 장 무료로 받을 수 있어요.'}
          </p>
        </div>
        {/* 심볼 */}
        <span className="absolute -bottom-7 -left-3 text-[140px] font-black leading-none pointer-events-none"
          style={{ opacity: 0.1, fontFamily: SERIF }}>火</span>
      </motion.button>

      {/* ─── Pillar 2 · 꿈해몽 ─── */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        onClick={go('/dream')}
        className="relative mx-4 mt-3 w-[calc(100%-32px)] rounded-[20px] px-[22px] py-5 text-left overflow-hidden"
        style={{ height: 210, background: C.ink, color: C.paper }}
      >
        {/* 별 배경 */}
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
      </motion.button>

      {/* ─── 프리미엄 10운 (비즈니스 메인) ─── */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        onClick={go('/storage')}
        className="relative mx-4 mt-6 w-[calc(100%-32px)] rounded-[18px] px-[22px] pt-[22px] pb-5 text-left overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2520 60%, #1a1a1a 100%)',
          color: C.paper,
          border: '1px solid rgba(184,150,90,0.4)',
        }}
      >
        {/* 라디얼 장식 */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at 85% 30%, rgba(232,217,184,0.22) 0%, transparent 55%),
                       radial-gradient(ellipse at 10% 90%, rgba(184,150,90,0.18) 0%, transparent 55%)`,
        }} />
        {/* 리본 */}
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
        {/* 큰 한자 */}
        <span className="absolute right-[-8px] top-[14px] text-[148px] font-black leading-none pointer-events-none"
          style={{ color: C.gold, opacity: 0.12, fontFamily: SERIF }}>命</span>
        {/* 타이틀 */}
        <h2 className="mt-6 text-[24px] font-extrabold leading-[1.3] tracking-[-0.01em] relative" style={{ fontFamily: SERIF }}>
          당신의 <em className="not-italic" style={{ color: C.goldShimmer }}>사주 전체</em>를<br />한 편으로 풀어드립니다
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-[1.65] max-w-[290px] relative" style={{ opacity: 0.88 }}>
          천간·지지·대운·십성·신살까지 — 한 권의 풀이로 {hasProfile ? `${displayName}님` : '당신'}을 처음부터 끝까지 읽어냅니다.
        </p>
        <div className="mt-3.5 flex gap-1.5 flex-wrap relative">
          {['10섹션 구성', '1만 4천 자', 'A4 PDF 저장'].map((f) => (
            <span key={f} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ border: '1px solid rgba(232,217,184,0.28)', color: C.goldShimmer, background: 'rgba(232,217,184,0.06)' }}>
              {f}
            </span>
          ))}
        </div>
        <div className="mt-4 pt-3.5 flex items-center justify-between relative"
          style={{ borderTop: '1px solid rgba(232,217,184,0.18)' }}>
          <span className="text-[12px]" style={{ color: 'rgba(248,245,238,0.7)' }}>
            한 번 열면 내내 열려있어요
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] font-bold px-4 py-2 rounded-full"
            style={{ background: C.goldShimmer, color: C.ink }}>
            10운으로 시작 →
          </span>
        </div>
      </motion.button>

      {/* ─── 주제별 1운 ─── */}
      <div className="relative mx-4 mt-3.5 w-[calc(100%-32px)] rounded-2xl p-5"
        style={{ background: C.goldSoft }}>
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold mb-2.5"
          style={{ background: C.gold, color: C.paper }}>
          1운
        </span>
        <h2 className="text-[20px] font-bold tracking-[-0.01em]" style={{ color: C.ink, fontFamily: SERIF }}>
          궁금한 주제 하나, 깊게
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-[1.55]" style={{ color: C.inkSoft }}>
          연애·재물·직업·건강·공부 — 한 주제를 골라 집중해서 풀어드려요
        </p>
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {[
            { id: 'love', label: '연애' },
            { id: 'wealth', label: '재물' },
            { id: 'career', label: '직업' },
          ].map((t) => (
            <button key={t.id} type="button" onClick={() => navigate(`/topic/${t.id}`)}
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: C.ink, color: C.paper }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Why-Saju500 3카드 ─── */}
      <div className="relative mx-4 mt-5 w-[calc(100%-32px)] rounded-[20px] px-5 py-[22px] overflow-hidden"
        style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}>
        <div className="absolute top-0 inset-x-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, ${C.gold} 0%, ${C.goldShimmer} 50%, ${C.gold} 100%)` }} />
        <h3 className="text-center text-[18px] font-bold tracking-[-0.01em]" style={{ color: C.ink, fontFamily: SERIF }}>
          왜 사주500인가요
        </h3>
        <p className="text-center mt-1 text-[13px]" style={{ color: C.inkSoft }}>
          사주는 흐름을 읽는 하루 지도입니다
        </p>
        <div className="grid grid-cols-3 gap-2 mt-[18px]">
          {[
            { kanji: '易', h: '전통 그대로', sub: '천간·지지·신살\n제대로 해석' },
            { kanji: '筆', h: '사람처럼 쓴 글', sub: 'AI 같지 않은\n사주의 언어로' },
            { kanji: '銀', h: '무료부터 시작', sub: '필요한 만큼만\n부담 없이' },
          ].map((c) => (
            <div key={c.kanji} className="text-center px-2 py-3 rounded-[14px] relative"
              style={{ background: C.goldSoft }}>
              <div className="text-[34px] font-black leading-none mb-1"
                style={{ color: C.goldDark, fontFamily: SERIF }}>{c.kanji}</div>
              <div className="text-[13px] font-bold" style={{ color: C.ink }}>{c.h}</div>
              <div className="text-[11.5px] leading-[1.4] whitespace-pre-line mt-0.5" style={{ color: C.inkSoft }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Caption grid 4카드 ─── */}
      <div className="mx-4 mt-5.5 text-[17px] font-bold tracking-[-0.01em]" style={{ color: C.ink, fontFamily: SERIF }}>
        더 알아볼 주제
      </div>
      <div className="grid grid-cols-2 gap-2.5 mx-4 mt-2.5">
        {[
          { id: 'daeun',  kanji: '運', h: '대운 10년 흐름', sub: '앞으로의 10년 주기 기운', strip: '#3B7A4B', path: '/daeun' },
          { id: 'wolun',  kanji: '月', h: '월운 이번 달',   sub: '이번 달 재물·연애·일',   strip: '#B5441F', path: '/monthly' },
          { id: 'gung',   kanji: '合', h: '궁합 보기',      sub: '두 사람 사주 궁합',     strip: '#9C5A8A', path: '/compat' },
          { id: 'tojeong',kanji: '歲', h: '토정비결',       sub: '올해 1년 흐름',          strip: '#2F4B7C', path: '/tojung' },
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
            <h3 className="relative text-[15.5px] font-bold" style={{ color: C.ink }}>{c.h}</h3>
            <p className="relative text-[11.5px] leading-[1.45] mt-1" style={{ color: C.inkSoft }}>{c.sub}</p>
            <span className="absolute bottom-3 right-3 text-[10.5px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: C.goldDark, background: C.goldSoft }}>
              1운
            </span>
          </motion.button>
        ))}
      </div>

      {/* ─── Review carousel (16개, 우→좌 자동) ─── */}
      <div className="mx-4 mt-7 text-[17px] font-bold tracking-[-0.01em]" style={{ color: C.ink, fontFamily: SERIF }}>
        먼저 써본 분들의 말
      </div>
      <div className="mt-3 overflow-hidden pb-2"
        style={{ maskImage: 'linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)' }}>
        <div className="flex gap-3 px-4 review-scroll">
          {reviewDoubled.map((r, i) => (
            <div key={i} className="min-w-[280px] max-w-[280px] h-[112px] rounded-2xl p-4"
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

      {/* ─── Footer ─── */}
      <div className="text-center mt-6 pt-4.5 pb-2 text-[11.5px]" style={{ color: C.gray500, fontFamily: SERIF }}>
        사주500 · 무료로 시작 · 필요한 만큼 1운
      </div>

      {/* Review scroll keyframes (prefers-reduced-motion 존중) */}
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
      `}</style>
    </div>
  );
}

export default HomePage;
