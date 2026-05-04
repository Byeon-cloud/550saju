/**
 * HomePageV5 — Path A/B/C/D 분기 홈 (2026-04-22)
 *
 * 근거:
 *   - PC_인수인계_2026_04_21_단일본.md §3~§4 (Path 판별 · Path별 스택 SSOT)
 *   - docs/prd/홈v5_Path분기_레이아웃diff.md v3 §2 (Path 스택) · §7 (구현 스케치)
 *
 * 판별:
 *   useUserPath() → { path: 'A' | 'B' | 'C' | 'D', hasSaju, hasPaidAny, hasPaid5000, ready }
 *
 * 배포:
 *   env flag VITE_HOME_V5_ENABLED (기본 OFF → App.tsx 에서 HomePage 로 fallback)
 *
 * 자체 결정 (준기 override 가능 — diff v3 §11):
 *   (a) env flag 기본값 OFF (1% ramp 전까지 QA 전용)
 *   (b) price-intro 블록 = 미니멀 텍스트 3줄 (Path B·C 상단)
 *   (c) Storage-Chat = inline card (Path D 사이드바 X)
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useActiveProfile, useTodayHeadline } from '@/hooks/useHomeData';
import { useUserPath, type UserPath } from '@/hooks/useUserPath';
import { HOME_REVIEWS } from '@/constants/reviews';
// 프리미엄 카드 클릭 → /premium (ProfilePicker + 10운 차감 + /loading)

/* ────────────────────────────────────────────────────────────
 * 디자인 토큰 (PC 인수인계 §5 SSOT)
 * ──────────────────────────────────────────────────────────── */
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  gray500: '#6B6B6B',
  grayLine: '#E5DFD0',
  gold: '#B8965A',
  goldDark: '#8C6D3D',
  goldSoft: '#F8F5EE',
  goldShimmer: '#E8D9B8',
  mute: '#7A7269',
} as const;

const SERIF = "'Noto Serif KR', serif";

/* ────────────────────────────────────────────────────────────
 * 유틸
 * ──────────────────────────────────────────────────────────── */
function getTodayStr(): string {
  const d = new Date();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${weekday}요일`;
}

/* ────────────────────────────────────────────────────────────
 * Daily copy variant (diff v3 §3)
 * ──────────────────────────────────────────────────────────── */
const DAILY_CTA_BY_PATH: Record<UserPath, string> = {
  A: '사주를 입력하고 오늘 기운 받기 →',
  B: '주제별로 더 깊게 →',
  C: '오늘도 열려있어요',
  D: '오늘 한 줄 기록 →',
};

/* ════════════════════════════════════════════════════════════
 * 블록 render 함수들
 * ════════════════════════════════════════════════════════════ */

function ProfileSwitcher({ displayName, hasProfile, onClick }: { displayName: string; hasProfile: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  );
}

function PriceIntro() {
  // 자체 결정: 미니멀 텍스트 3줄 (diff v3 §11 (b))
  return (
    <div className="mx-4 mt-4 w-[calc(100%-32px)] rounded-xl px-4 py-3.5" style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}>
      <p className="text-[12px] font-bold" style={{ color: C.goldDark, fontFamily: SERIF }}>가격 안내</p>
      <p className="text-[12.5px] mt-1 leading-[1.55]" style={{ color: C.inkSoft }}>
        풀이는 운(運) 단위로 사용합니다. 종합 사주 = 10운. 필요한 만큼만 충전.
      </p>
      <p className="text-[11.5px] mt-1.5" style={{ color: C.mute }}>
        무료 일일 패스: 오늘 운세 · 꿈해몽 · 대화 1회.
      </p>
    </div>
  );
}

function PillarDaily({ path, displayName, todayStr, todayHint, hasProfile, onClick }: {
  path: UserPath;
  displayName: string;
  todayStr: string;
  todayHint: string;
  hasProfile: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="relative mx-4 mt-4 w-[calc(100%-32px)] rounded-[20px] px-[22px] py-5 text-left overflow-hidden"
      style={{ height: 210, background: 'linear-gradient(135deg, #B5441F 0%, #7B2E15 100%)', color: C.paper }}
    >
      <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
        style={{ background: 'rgba(248,245,238,0.18)', color: C.paper, backdropFilter: 'blur(8px)' }}>
        <span className="w-1 h-1 rounded-full" style={{ background: C.goldShimmer }} />
        오늘 1회 무료
      </div>
      <div className="text-[12px] font-medium" style={{ opacity: 0.85 }}>{todayStr}</div>
      <div className="mt-3">
        <h2 className="text-[26px] font-extrabold leading-[1.28] tracking-[-0.02em]" style={{ fontFamily: SERIF }}>
          {hasProfile ? `${displayName}님의 오늘` : '오늘의 기운을 먼저 받아보세요'}
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.6] font-medium max-w-[320px]" style={{ opacity: 0.92 }}>
          {hasProfile ? todayHint : '사주만 입력하면 매일 하루 한 장 무료로 받을 수 있어요.'}
        </p>
        <p className="mt-2 text-[12px] font-bold" style={{ color: C.goldShimmer }}>{DAILY_CTA_BY_PATH[path]}</p>
      </div>
      <span className="absolute -bottom-7 -left-3 text-[140px] font-black leading-none pointer-events-none"
        style={{ opacity: 0.1, fontFamily: SERIF }}>火</span>
    </motion.button>
  );
}

function PillarDream({ displayName, hasProfile, onClick }: { displayName: string; hasProfile: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
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
    </motion.button>
  );
}

function Premium10un({ displayName, hasProfile, onClick }: { displayName: string; hasProfile: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
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
  );
}

function Topic5({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  // Stage 7e-7: 5 → 10 카테고리 확장 (전체 SSOT 노출)
  const TOPICS = [
    { id: 'love',     label: '연애',     color: '#C88A95' },
    { id: 'reunion',  label: '재회',     color: '#D89A8A' },
    { id: 'marriage', label: '결혼',     color: '#C97B95' },
    { id: 'wealth',   label: '재물',     color: '#B8965A' },
    { id: 'exam',     label: '합격·이직', color: '#5A6FA8' },
    { id: 'business', label: '사업',     color: '#A37A2E' },
    { id: 'health',   label: '건강',     color: '#6FA08C' },
    { id: 'move',     label: '이사·이동', color: '#4F8A8B' },
    { id: 'study',    label: '학업',     color: '#9C5A8A' },
    { id: 'career',   label: '직업',     color: '#5A7CA8' },
  ];
  return (
    <div className="mx-4 mt-4 w-[calc(100%-32px)]">
      <p className="text-[14px] font-bold mb-2" style={{ color: C.ink, fontFamily: SERIF }}>주제별 1운</p>
      <div className="grid grid-cols-5 gap-1.5">
        {TOPICS.map((t) => (
          <button key={t.id} type="button" onClick={() => navigate(`/topic/${t.id}`)}
            className="h-[76px] rounded-xl flex flex-col items-center justify-center"
            style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}>
            <span className="w-2 h-2 rounded-full mb-1" style={{ background: t.color }} />
            <span className="text-[11px] font-bold text-center px-1 leading-tight" style={{ color: C.ink }}>{t.label}</span>
            <span className="text-[9.5px] mt-0.5" style={{ color: C.mute }}>1운</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Extensions4({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  // 인수인계 §5 확장 4색
  const EXT = [
    { id: 'daeun',   kanji: '運', h: '대운 10년 흐름', sub: '앞으로의 10년 기운',   strip: '#3B7A4B', path: '/daeun',   price: '3운' },
    { id: 'wolun',   kanji: '月', h: '월운 이번 달',   sub: '재물·연애·일 흐름',    strip: '#B5441F', path: '/monthly', price: '2운' },
    { id: 'gung',    kanji: '合', h: '궁합 보기',      sub: '두 사람 사주 궁합',    strip: '#9C5A8A', path: '/compat',  price: '2운' },
    { id: 'tojeong', kanji: '歲', h: '토정비결',       sub: '올해 1년 흐름',         strip: '#2F4B7C', path: '/tojung',  price: '3운' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 mx-4 mt-4">
      {EXT.map((c) => (
        <motion.button
          key={c.id}
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(c.path)}
          className="relative h-[120px] px-4 py-3.5 rounded-[14px] text-left overflow-hidden"
          style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}
        >
          <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l" style={{ background: c.strip }} />
          <span className="absolute right-[-6px] top-[-10px] text-[78px] font-black leading-none"
            style={{ opacity: 0.14, color: c.strip, fontFamily: SERIF }}>{c.kanji}</span>
          <h3 className="relative text-[15.5px] font-bold" style={{ color: C.ink }}>{c.h}</h3>
          <p className="relative text-[11.5px] leading-[1.45] mt-1" style={{ color: C.inkSoft }}>{c.sub}</p>
          <span className="absolute bottom-3 right-3 text-[10.5px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: C.goldDark, background: C.goldSoft }}>
            {c.price}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

function InputCTA({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate('/input')}
      className="mx-4 mt-4 w-[calc(100%-32px)] h-[56px] rounded-full text-[15px] font-extrabold"
      style={{ background: `linear-gradient(135deg, ${C.goldShimmer}, ${C.gold})`, color: C.ink }}
    >
      사주 입력하고 시작하기 →
    </motion.button>
  );
}

function StorageChatInline({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  // 자체 결정: inline card (diff v3 §11 (c))
  return (
    <div className="mx-4 mt-4 w-[calc(100%-32px)] rounded-xl px-4 py-4"
      style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}>
      <p className="text-[13px] font-bold" style={{ color: C.ink, fontFamily: SERIF }}>보관함 · 사주대화</p>
      <p className="text-[12px] mt-1 leading-[1.5]" style={{ color: C.inkSoft }}>
        지금까지 받은 풀이 {/* TODO: count 주입 */}와 오늘의 대화 1회가 기다려요.
      </p>
      <div className="flex gap-2 mt-2.5">
        <button type="button" onClick={() => navigate('/storage')}
          className="flex-1 h-[36px] rounded-full text-[12px] font-semibold"
          style={{ background: C.goldSoft, color: C.goldDark }}>
          보관함 열기 →
        </button>
        <button type="button" onClick={() => navigate('/chat')}
          className="flex-1 h-[36px] rounded-full text-[12px] font-semibold"
          style={{ background: C.ink, color: C.paper }}>
          대화 시작 →
        </button>
      </div>
    </div>
  );
}

function EventTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button type="button" onClick={() => navigate('/events')}
      className="mx-4 mt-3 w-[calc(100%-32px)] h-[52px] rounded-xl flex items-center justify-between px-4"
      style={{ background: C.goldSoft, border: `1px solid ${C.grayLine}` }}>
      <span className="text-[13px] font-bold" style={{ color: C.goldDark }}>이번 주 이벤트 · 프로모</span>
      <span className="text-[11px]" style={{ color: C.goldDark }}>→</span>
    </button>
  );
}

function TojungAnchor({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const year = new Date().getFullYear();
  return (
    <button type="button" onClick={() => navigate('/tojung')}
      className="mx-4 mt-4 w-[calc(100%-32px)] rounded-[14px] px-4 py-4 text-left relative overflow-hidden"
      style={{ background: '#FFFFFF', border: `1px solid ${C.grayLine}` }}>
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: '#2F4B7C' }} />
      <span className="absolute right-[-6px] top-[-10px] text-[78px] font-black leading-none"
        style={{ opacity: 0.12, color: '#2F4B7C', fontFamily: SERIF }}>歲</span>
      <h3 className="text-[14.5px] font-bold" style={{ color: C.ink }}>{year} 토정비결</h3>
      <p className="text-[11.5px] mt-1" style={{ color: C.inkSoft }}>올해 1년을 한 장으로 봐두세요</p>
    </button>
  );
}

function Why3({ displayName: _displayName }: { displayName: string }) {
  return (
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
  );
}

function ReviewCarousel({ reviewDoubled }: { reviewDoubled: typeof HOME_REVIEWS }) {
  return (
    <>
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
    </>
  );
}

function HomeFooter() {
  return (
    <div className="text-center mt-6 pt-4.5 pb-2 text-[11.5px]" style={{ color: C.gray500, fontFamily: SERIF }}>
      사주500 · 무료로 시작 · 필요한 만큼 1운
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
 * HomePageV5 본체
 * ════════════════════════════════════════════════════════════ */
export function HomePageV5() {
  usePageTitle('사주500 · 무료로 시작');
  const navigate = useNavigate();
  const { name, hasProfile } = useActiveProfile();
  const todayHint = useTodayHeadline();
  const { path, ready } = useUserPath();

  const displayName = name || '사용자';
  const todayStr = useMemo(() => getTodayStr(), []);
  const reviewDoubled = useMemo(() => [...HOME_REVIEWS, ...HOME_REVIEWS], []);

  const goProfile = () => (hasProfile ? navigate('/storage') : navigate('/input'));
  const goDaily = () => navigate('/daily');
  const goDream = () => navigate('/dream');
  // 프리미엄 10운 카드 클릭 — 다른 콘텐츠 (오늘운세 / 주제별 / 토정비결) 와 동일 패턴
  //   /premium 페이지에서 ProfilePicker → 10운 차감 → /loading?type=premium
  const go10un = () => {
    navigate('/premium');
  };

  // ready=false 는 skeleton 대신 Path A 로 렌더 (useUserPath 반환 규약)
  // 판별 완료 후 stack 합성
  const stack: string[] = useMemo(() => {
    switch (path) {
      case 'A': return ['profile', 'daily', 'dream', 'input-cta', 'review', 'why'];
      case 'B': return ['profile', 'price-intro', 'daily', 'dream', '10un', 'topic-5', 'review', 'why'];
      case 'C': return ['profile', 'daily', 'dream', 'extensions-4', 'topic-5', '10un', 'event-tab', 'review'];
      case 'D': return ['profile', 'extensions-4', 'storage-chat', 'event-tab', 'daily', 'tojung-anchor'];
    }
  }, [path]);

  return (
    <div style={{ background: C.paper, minHeight: '100vh', paddingBottom: 24 }} data-home-path={path} data-home-ready={ready ? '1' : '0'} data-home-version="v5">
      {stack.map((block) => {
        switch (block) {
          case 'profile':       return <ProfileSwitcher key={block} displayName={displayName} hasProfile={hasProfile} onClick={goProfile} />;
          case 'price-intro':   return <PriceIntro key={block} />;
          case 'daily':         return <PillarDaily key={block} path={path} displayName={displayName} todayStr={todayStr} todayHint={todayHint} hasProfile={hasProfile} onClick={goDaily} />;
          case 'dream':         return <PillarDream key={block} displayName={displayName} hasProfile={hasProfile} onClick={goDream} />;
          case '10un':          return <Premium10un key={block} displayName={displayName} hasProfile={hasProfile} onClick={go10un} />;
          case 'topic-5':       return <Topic5 key={block} navigate={navigate} />;
          case 'extensions-4':  return <Extensions4 key={block} navigate={navigate} />;
          case 'input-cta':     return <InputCTA key={block} navigate={navigate} />;
          case 'storage-chat':  return <StorageChatInline key={block} navigate={navigate} />;
          case 'event-tab':     return <EventTab key={block} navigate={navigate} />;
          case 'tojung-anchor': return <TojungAnchor key={block} navigate={navigate} />;
          case 'why':           return <Why3 key={block} displayName={displayName} />;
          case 'review':        return <ReviewCarousel key={block} reviewDoubled={reviewDoubled} />;
          default: return null;
        }
      })}
      <HomeFooter />

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

export default HomePageV5;
