// MyPage v2 — Sprint 2 #53 전면 재설계 (2026-04-23)
// 스펙: docs/mockups/사주500_UI개편_04_내정보.md §0~§14
// 변경: ProfileHeader(140px+"命" 워터마크) + LoginModal(80vh 시트) + ContactSheet + AppMeta(5탭 디버그)
// 보존: MENU_ITEMS_AIT/WEB 분기 로직 (Sprint 1 — 삭제 금지)
// 광고 없음 (탐색 페이지 블랙리스트 §0-8)

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getBalance } from '@/services/storage/localStore';
import { isAppsInToss } from '@/services/payment/iapService';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Header } from '@/components/layout/Header';
// Stage 7e-5: ProfileHeader 만세력 요약 통합
import { calculateSaju } from '@/services/saju/calculator';
import { getIljuMeaning } from '@/constants/iljuMeaning';
import type { OhengType } from '@/types/saju';

/* ─ SSOT 토큰 — PC_인수인계 §5 (2026-04-23) ─ */
const C = {
  paper:    '#F8F5EE',
  ink:      '#1A1A1A',
  inkSoft:  '#3D3D3D',
  mute:     '#7A7269',
  gold:     '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  line:     '#E5DFD0',
  danger:   '#C0392B',
} as const;
const SERIF = "'Noto Serif KR', serif";
const APP_VERSION = '1.0.0';
const BUILD_DATE = '20260423';
const CONTACT_EMAIL = 'info@juulabel.com';
const KAKAO_CHANNEL_URL = 'https://open.kakao.com/o/pa01C1ri';

/* ─ 메뉴 정의 (Sprint 1 보존 — 분기 로직 삭제 금지) ─
   앱인토스: 5개 (운충전·결제내역·고객문의·이용약관·개인정보)
   웹앱: 6개 (분석기록 추가 — §4-3: 앱인토스만 삭제, 웹은 유지)             */
type MenuItem = { id: string; label: string; path: string; icon: string };

// Stage 7e-4: 고객문의 제거, 이용약관/개인정보처리방침은 footer 영역으로 이동
const MENU_ITEMS_AIT: MenuItem[] = [
  { id: 'charge',  label: '운 충전',         path: '/charge',  icon: 'wallet'       },
  { id: 'billing', label: '결제·사용 내역',   path: '/billing', icon: 'receipt'      },
];

const MENU_ITEMS_WEB: MenuItem[] = [
  { id: 'storage', label: '분석 기록',        path: '/storage', icon: 'archive'      },
  ...MENU_ITEMS_AIT,
];

/* ══════════════════════════════════════════
   메인 페이지
══════════════════════════════════════════ */
export function MyPage() {
  usePageTitle('내 정보');
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, isLoggedIn, user, login } = useAuth();
  const toast = useToast();
  const inAppsInToss = useMemo(() => isAppsInToss(), []);
  const MENU_ITEMS = inAppsInToss ? MENU_ITEMS_AIT : MENU_ITEMS_WEB;

  const [balance, setBalance] = useState(0);
  const [showContact, setShowContact] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  /* 잔액 동기화 */
  useEffect(() => {
    setBalance(getBalance());
  }, [location.pathname]);

  /* 비로그인 → 로그인 모달 즉시 노출 (§2-1) */
  useEffect(() => {
    if (!loading && !isLoggedIn) {
      setShowLoginModal(true);
    } else {
      setShowLoginModal(false);
    }
  }, [loading, isLoggedIn]);

  const onMenuClick = (item: MenuItem) => {
    if (item.id === 'contact') { setShowContact(true); return; }
    if (item.path) navigate(item.path);
  };

  const onCloseLoginModal = () => {
    setShowLoginModal(false);
    navigate(-1); // 모달 닫기 = 직전 탭 복귀 (§2-1)
  };

  if (loading) return null;

  return (
    <div style={{ background: C.paper, minHeight: '100vh', paddingBottom: 96 }}>
      <Header title="내 정보" />

      <div className="mx-auto px-4 pt-4" style={{ maxWidth: 520 }}>

        {/* ── ProfileHeader (§3) ── */}
        {isLoggedIn && user ? (
          <ProfileHeader user={user} balance={balance} />
        ) : (
          /* 비로그인 skeleton — 로그인 모달이 위에 뜨므로 시각적 자리만 */
          <div className="rounded-2xl mb-4" style={{ height: 140, background: C.goldSoft }} />
        )}

        {/* Stage 7e-5: ProfileHeader 가 만세력 요약 + 사주 카드 진입을 모두 흡수 */}

        {/* ── MenuList (§4) ── */}
        <div className="rounded-2xl overflow-hidden mb-3"
          style={{ background: '#FFFFFF', border: `1px solid ${C.line}` }}>
          {MENU_ITEMS.map((item, idx) => (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onMenuClick(item)}
              className="w-full flex items-center gap-3 px-5 text-left"
              style={{
                height: 60,
                borderBottom: idx < MENU_ITEMS.length - 1 ? `1px solid ${C.line}` : 'none',
                background: 'transparent',
              }}
            >
              <MenuIcon name={item.icon} />
              <span className="flex-1 text-[16px] font-semibold" style={{ color: C.ink }}>
                {item.label}
              </span>
              <ChevronRightIcon />
            </motion.button>
          ))}
        </div>

        {/* ── AppMeta (§8) ── */}
        <AppMeta toast={toast} />

        {/* 2026-05-04 가독성 보강: opacity 0.65 (실효 7~8px) → 1.0 + 12px (60대+ 가독)
         *  법적 링크는 WCAG AA 준수. 본문보다 작되 명확히 보이게. */}
        <div
          className="flex items-center justify-center gap-3 mt-3"
          style={{ fontSize: 12, color: C.mute, opacity: 0.85 }}
        >
          <button
            type="button"
            onClick={() => navigate('/terms')}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            이용약관
          </button>
          <span style={{ opacity: 0.4 }}>·</span>
          <button
            type="button"
            onClick={() => navigate('/privacy')}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            개인정보처리방침
          </button>
          <span style={{ opacity: 0.4 }}>·</span>
          <button
            type="button"
            onClick={() => setShowContact(true)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            고객문의
          </button>
        </div>

        {/* ── 웹앱 전용 — 로그아웃·회원탈퇴 (앱인토스 비노출, §4-3) ── */}
        {!inAppsInToss && isLoggedIn && (
          <div className="flex items-center justify-center gap-5 py-2 mt-1">
            <button type="button"
              onClick={() => toast.show('로그아웃 기능은 준비 중입니다', 'info')}
              className="text-[12px]" style={{ color: C.mute, opacity: 0.7 }}>
              로그아웃
            </button>
            <span style={{ color: C.line, fontSize: 11 }}>|</span>
            <button type="button"
              onClick={() => toast.show('회원탈퇴 기능은 준비 중입니다', 'info')}
              className="text-[12px]" style={{ color: C.mute, opacity: 0.7 }}>
              회원탈퇴
            </button>
          </div>
        )}
      </div>

      {/* ── LoginModal (§2-2) ── */}
      <LoginModal
        open={showLoginModal}
        onClose={onCloseLoginModal}
        toast={toast}
        onLogin={login}
      />

      {/* ── ContactSheet (§4-4) ── */}
      <ContactSheet
        open={showContact}
        onClose={() => setShowContact(false)}
        userId={user?.uid}
        toast={toast}
      />
    </div>
  );
}


/** 본인 프로필 자동 식별 — relation 우선순위 + 없으면 첫 번째 */
function findMyProfile():
  | {
      id: string;
      name: string;
      input: { birthYear: number; birthMonth: number; birthDay: number; hasBirthTime?: boolean };
    }
  | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('saju500_profiles');
    if (!raw) return null;
    const list: any[] = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return null;
    const MY_KEYWORDS = ['본인', '나', '저', 'me'];
    const mine = list.find((p) => p.relation && MY_KEYWORDS.includes(String(p.relation)));
    return mine || list[0];
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════
   Stage 7e-5 ProfileHeader — 만세력 요약 통합 카드
   · 본인 사주 데이터(localStorage)를 즉시 계산 → 일주/오행/정체성/별명/4주 요약 노출
   · 사주 입력 안 된 경우: 기존 단순 헤더 (사주 입력하기 CTA)
   · 클릭 시 사주 카드 페이지로 진입
══════════════════════════════════════════ */
const OHENG_HEX_MY: Record<OhengType, string> = {
  목: '#2D8A4E', 화: '#D32F2F', 토: '#E8B82A', 금: '#4A4A4A', 수: '#1565E0',
};
const OHENG_HAN_MY: Record<OhengType, string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};
const OHENG_BOX_MY: Record<OhengType, { bg: string; fg: string; outline: string }> = {
  목: { bg: '#2D8A4E', fg: '#FFFFFF', outline: '#1B5E2C' },
  화: { bg: '#D32F2F', fg: '#FFFFFF', outline: '#9B1B1B' },
  토: { bg: '#E8B82A', fg: '#FFFFFF', outline: '#B85A0E' },
  금: { bg: '#FFFFFF', fg: '#1A1A1A', outline: '#9C9C9C' },
  수: { bg: '#1A1A1A', fg: '#FFFFFF', outline: '#3D3D3D' },
};

function ProfileHeader({ user, balance }: { user: any; balance: number }) {
  const navigate = useNavigate();
  const myProfile = useMemo(() => findMyProfile(), []);
  // Stage 7e-7: "사주500 회원님" 어색 워딩 폐지 — 우선순위:
  //   1. user.displayName (소셜 로그인 시)
  //   2. myProfile.name (사주 입력 시)
  //   3. fallback "님" 빠진 단순 인사
  const name = user?.displayName || myProfile?.name || '';
  const sajuSummary = useMemo(() => {
    if (!myProfile?.input) return null;
    try {
      const data = (myProfile as any).sajuData || calculateSaju(myProfile.input as any);
      const ilgan = data?.pillars?.[2]?.천간 || '';
      const ilji = data?.pillars?.[2]?.지지 || '';
      const dayOheng = (data?.pillars?.[2]?.천간오행 || '토') as OhengType;
      const ilju = ilgan + ilji;
      const meaning = getIljuMeaning(ilju);
      // Stage 7e-7: 출생정보 + 학술 라벨 (사주카드 L1 톤 통일)
      const i = myProfile.input as any;
      const birthYMD = `${i.birthYear}.${String(i.birthMonth).padStart(2, '0')}.${String(i.birthDay).padStart(2, '0')}`;
      const calLabel = i.calendarType === 'lunar' || i.calendarType === 'lunar_leap' ? '음력' : '양력';
      const hourLabel = i.hasBirthTime
        ? `${i.birthHour}시${(i.birthMinute ?? 0) > 0 ? `${i.birthMinute}분` : ''}`
        : '시간 모름';
      const GAN_KO: Record<string, string> = {
        甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
        己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
      };
      const ZHI_KO: Record<string, string> = {
        子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
        午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
      };
      const ilganKo = GAN_KO[ilgan] || '';
      const iljiKo = ZHI_KO[ilji] || '';
      const academicLabel = ilganKo && iljiKo ? `${ilganKo}(${ilgan}) 일간 · ${iljiKo}(${ilji}) 일지` : '';
      return {
        ilgan, ilji, ilju, dayOheng,
        identity: meaning?.identity || '',
        personality: meaning?.personality || '',
        pillars: data?.pillars || [],
        birthLine: `${calLabel} ${birthYMD} · ${hourLabel}`,
        academicLabel,
      };
    } catch { return null; }
  }, [myProfile]);

  // 사주 입력 안 된 경우 — fallback 헤더 (Stage 7e-7: 워딩 자연스럽게)
  if (!myProfile || !sajuSummary) {
    const greeting = name ? `${name}님` : '환영합니다';
    return (
      <div className="relative overflow-hidden rounded-2xl mb-4"
        style={{ padding: '18px 20px', background: C.goldSoft, boxSizing: 'border-box' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: C.gold }}>
            <span
              aria-hidden
              style={{
                fontFamily: SERIF, fontSize: 24, fontWeight: 900,
                color: '#FFFFFF', letterSpacing: '0.04em', lineHeight: 1,
              }}
            >
              命
            </span>
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="text-[18px] font-bold leading-tight truncate" style={{ color: C.ink, fontFamily: SERIF }}>
              {greeting}
            </div>
            <div className="text-[11px]" style={{ color: C.mute }}>
              사주를 입력하면 만세력 카드를 만들어드려요
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/input?from=my')}
            style={{
              background: C.goldDeep, color: C.paper, border: 'none', borderRadius: 999,
              padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >
            사주 입력 →
          </button>
        </div>
      </div>
    );
  }

  // Stage 7e-7: 사주 요약 카드 (대형, 임팩트 ↑)
  // 좌: 큰 일주 박스 (오행 컬러 fill, 흰 한자) — 만세력 톤
  // 우: 정체성 + 풀이 + 4주 미니 + 잔여 운
  const accentColor = OHENG_HEX_MY[sajuSummary.dayOheng];
  const ilboBox = OHENG_BOX_MY[sajuSummary.dayOheng];
  return (
    <button
      type="button"
      onClick={() => navigate(`/saju-card/${encodeURIComponent(myProfile.id)}`)}
      className="w-full text-left relative overflow-hidden rounded-2xl mb-4"
      style={{
        padding: '20px 18px 16px',
        background: `linear-gradient(135deg, #FFFFFF 0%, ${C.goldSoft} 50%, ${accentColor}1F 100%)`,
        border: `1.5px solid ${accentColor}55`,
        cursor: 'pointer',
        boxShadow: `0 8px 24px ${accentColor}1F, 0 2px 6px rgba(0,0,0,0.04)`,
      }}
    >
      {/* 우하단 일지 한자 워터마크 (큰 사이즈) */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: -28,
          bottom: -52,
          fontFamily: SERIF,
          fontSize: 220,
          fontWeight: 900,
          color: accentColor,
          opacity: 0.07,
          lineHeight: 0.85,
          letterSpacing: '-0.04em',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {sajuSummary.ilji || '命'}
      </span>
      {/* 좌상단 오행 컬러 halo */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: -60,
          top: -60,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}1F 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* 상단 row: name + 잔여 운 */}
      <div className="flex items-center justify-between mb-1 relative">
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em' }}>
          {name ? `${name}님` : '나의 사주'}
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{
            background: '#FFFFFF',
            border: `1px solid rgba(184,150,90,0.40)`,
            boxShadow: '0 2px 4px rgba(184,150,90,0.10)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.gold }} />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: C.goldDeep }}>
            잔여 운 {balance}운
          </span>
        </div>
      </div>

      {/* Stage 7e-7: 출생정보 한 줄 (사주카드 L1 톤) */}
      {sajuSummary.birthLine && (
        <div
          className="relative"
          style={{
            fontSize: 11,
            color: C.mute,
            fontWeight: 600,
            letterSpacing: '0.02em',
            marginBottom: 14,
          }}
        >
          {sajuSummary.birthLine}
        </div>
      )}

      {/* 메인 row — 큰 일주 박스 + 정체성 */}
      <div className="flex items-center gap-5 relative">
        {/* 좌: 일주 박스 (오행 컬러 fill + 흰 한자) — 강한 임팩트 */}
        <div className="flex flex-col items-center" style={{ flexShrink: 0 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: accentColor,
              letterSpacing: '0.18em',
              marginBottom: 6,
              padding: '2px 8px',
              border: `1.2px solid ${accentColor}77`,
              borderRadius: 999,
              background: '#FFFFFF',
            }}
          >
            日柱 · 나
          </div>
          <div
            style={{
              width: 76,
              height: 96,
              background: ilboBox.bg,
              border: `2.5px solid ${C.gold}`,
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: SERIF,
              color: ilboBox.fg,
              boxShadow: `0 0 0 3px rgba(184,150,90,0.18), 0 8px 22px ${accentColor}66`,
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: '0.02em' }}>
              {sajuSummary.ilgan || '命'}
            </span>
            <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: '0.02em', marginTop: 2 }}>
              {sajuSummary.ilji || ''}
            </span>
          </div>
        </div>

        {/* 우: 학술 라벨 + 정체성 + personality + 4주 미니 */}
        <div className="flex-1 min-w-0">
          {/* Stage 7e-7: 학술 라벨 (사주카드 L1 톤) */}
          {sajuSummary.academicLabel && (
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 11,
                fontWeight: 700,
                color: accentColor,
                letterSpacing: '0.04em',
                marginBottom: 4,
              }}
            >
              {sajuSummary.academicLabel}
            </div>
          )}
          {sajuSummary.identity && (
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 16,
                fontWeight: 800,
                color: C.ink,
                lineHeight: 1.4,
                letterSpacing: '-0.005em',
                marginBottom: 6,
              }}
            >
              {sajuSummary.identity}
            </div>
          )}
          {sajuSummary.personality && (
            <div
              style={{
                display: 'inline-block',
                fontSize: 10.5,
                color: accentColor,
                fontWeight: 800,
                letterSpacing: '0.02em',
                padding: '3px 9px',
                background: '#FFFFFF',
                border: `1px solid ${accentColor}66`,
                borderRadius: 999,
                marginBottom: 10,
              }}
            >
              {sajuSummary.personality}
            </div>
          )}
          {/* 4주 오행 미니 — 더 큰 박스 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 5,
              maxWidth: 200,
            }}
          >
            {[3, 2, 1, 0].map((idx) => {
              const p = sajuSummary.pillars[idx];
              const labelKo = ['년', '월', '일', '시'][idx];
              const isDay = idx === 2;
              if (!p?.available) {
                return (
                  <div
                    key={idx}
                    style={{
                      height: 36,
                      border: `1px dashed ${C.line}`,
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.6)',
                      fontSize: 9,
                      color: C.mute,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {labelKo}
                  </div>
                );
              }
              const ohengType = p.천간오행 as OhengType;
              const pBox = OHENG_BOX_MY[ohengType];
              return (
                <div
                  key={idx}
                  style={{
                    height: 36,
                    background: pBox.bg,
                    color: pBox.fg,
                    border: isDay ? `2px solid ${C.gold}` : `1.2px solid ${pBox.outline}`,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: SERIF,
                    fontSize: 18,
                    fontWeight: 900,
                    lineHeight: 1,
                    boxShadow: isDay ? `0 2px 8px ${C.gold}55` : '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {p.천간}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 푸터: 진입 CTA */}
      <div
        className="flex items-center justify-end relative"
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px dotted rgba(184,150,90,0.40)`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            fontWeight: 800,
            color: C.goldDeep,
            letterSpacing: '0.04em',
          }}
        >
          내 사주 카드 자세히 보기
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: C.goldDeep,
              color: C.paper,
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            →
          </span>
        </div>
      </div>
    </button>
  );
}

void OHENG_HAN_MY; // 향후 오행 라벨 노출 여지 보존

/* ══════════════════════════════════════════
   LoginModal — §2-2 (80vh 풀스크린 시트)
══════════════════════════════════════════ */
function LoginModal({ open, onClose, toast, onLogin }: {
  open: boolean;
  onClose: () => void;
  toast: ReturnType<typeof useToast>;
  onLogin: (provider?: 'kakao' | 'naver' | 'apple') => Promise<any>;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleLogin = async (provider: 'kakao' | 'naver' | 'apple') => {
    if (busy) return;
    setBusy(true);
    try {
      await onLogin(provider);
      onClose(); // 성공 시 모달 닫기
    } catch (err: any) {
      // Apple Service ID 미설정 시 Firebase가 auth/operation-not-supported-in-this-environment 등 반환
      const code: string = err?.code || '';
      if (provider === 'apple' && (code.includes('operation-not-supported') || code.includes('configuration-not-found'))) {
        toast.show('Apple 로그인은 곧 활성화됩니다', 'info');
      } else {
        toast.show('로그인에 실패했어요. 다시 시도해 주세요.', 'warning');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 딤드 배경 */}
          <motion.div
            key="login-dim"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* 시트 본체 — 80vh, radius-top 24 */}
          <motion.div
            key="login-sheet"
            className="fixed bottom-0 inset-x-0 z-50 flex flex-col"
            style={{
              height: '80vh',
              background: C.paper,
              borderRadius: '24px 24px 0 0',
              maxWidth: 520,
              margin: '0 auto',
              padding: '24px 24px 40px',
              overflow: 'hidden',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            {/* 닫기 버튼 */}
            <button type="button" onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(0,0,0,0.06)' }}
              aria-label="닫기">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={C.inkSoft} strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* 상단 심볼 */}
            <div className="flex justify-center mb-5 mt-2">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: C.goldSoft }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                  stroke={C.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  <circle cx="12" cy="16" r="1.5" fill={C.gold} />
                </svg>
              </div>
            </div>

            {/* 헤더 (§2-2) */}
            <h1 className="text-center text-[22px] font-bold leading-[1.35] mb-2"
              style={{ color: C.ink, fontFamily: SERIF }}>
              내 사주를 안전하게<br />보관해요
            </h1>
            <p className="text-center text-[14px] leading-[1.6] mb-8" style={{ color: C.mute }}>
              로그인하면 운 잔액·풀이 기록·결제 내역을<br />안전하게 관리할 수 있어요
            </p>

            {/* CTA 버튼 3개 (§2-2) */}
            <div className="flex flex-col gap-3 flex-1">
              {/* 카카오 — signIn('kakao') 실제 연결 */}
              <button type="button"
                onClick={() => handleLogin('kakao')}
                disabled={busy}
                className="w-full flex items-center justify-center gap-3 rounded-2xl font-semibold text-[16px]"
                style={{ height: 52, background: '#FEE500', color: C.ink, opacity: busy ? 0.6 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={C.ink} aria-hidden>
                  <path d="M12 3C6.477 3 2 6.477 2 10.9c0 2.789 1.698 5.24 4.29 6.73l-.89 3.27 3.78-2.49A11.5 11.5 0 0 0 12 18.8c5.523 0 10-3.477 10-7.9C22 6.477 17.523 3 12 3z" />
                </svg>
                카카오 계속하기
              </button>

              {/* 네이버 — signIn('naver') 실제 연결 */}
              <button type="button"
                onClick={() => handleLogin('naver')}
                disabled={busy}
                className="w-full flex items-center justify-center gap-3 rounded-2xl font-semibold text-[16px]"
                style={{ height: 52, background: '#03C75A', color: '#fff', opacity: busy ? 0.6 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <text x="3" y="18" fontSize="16" fontWeight="900" fill="#fff">N</text>
                </svg>
                네이버 계속하기
              </button>

              {/* Apple — OAuthProvider('apple.com') 정식 연결 (#auth-apple) */}
              <button type="button"
                onClick={() => handleLogin('apple')}
                disabled={busy}
                className="w-full flex items-center justify-center gap-3 rounded-2xl font-semibold text-[16px]"
                style={{ height: 52, background: C.ink, color: '#fff', opacity: busy ? 0.6 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.44c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.39-1.32 2.76-2.53 3.95zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Apple 계속하기
              </button>
            </div>

            {/* 하단 동의 캡션 (§2-2) */}
            <p className="text-center text-[11px] mt-5 leading-[1.6]" style={{ color: C.mute }}>
              로그인하면{' '}
              <button type="button" className="underline" onClick={() => navigate('/terms')}>이용약관</button>
              {', '}
              <button type="button" className="underline" onClick={() => navigate('/privacy')}>개인정보처리방침</button>
              에 동의한 것으로 간주합니다.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════
   ContactSheet — §4-4 (고객문의 바텀 시트)
══════════════════════════════════════════ */
function ContactSheet({ open, onClose, userId, toast: _toast }: {
  open: boolean;
  onClose: () => void;
  userId?: string;
  toast: ReturnType<typeof useToast>;
}) {
  const subject = encodeURIComponent(`사주500 문의${userId ? ` [회원ID:${userId}]` : ''}`);
  const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${subject}`;

  const onMail = () => {
    const a = document.createElement('a');
    a.href = mailtoUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onClose();
  };

  const onKakao = () => {
    window.open(KAKAO_CHANNEL_URL, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="contact-dim"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="contact-sheet"
            className="fixed bottom-0 inset-x-0 z-50"
            style={{
              background: C.paper,
              borderRadius: '20px 20px 0 0',
              maxWidth: 520,
              margin: '0 auto',
              padding: '24px 24px 48px',
            }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <h3 className="text-[18px] font-bold mb-1" style={{ color: C.ink, fontFamily: SERIF }}>
              어떻게 문의할까요?
            </h3>
            <p className="text-[12px] mb-5" style={{ color: C.mute }}>{CONTACT_EMAIL}</p>

            <div className="flex flex-col gap-2.5">
              <button type="button" onClick={onMail}
                className="w-full flex items-center gap-3 px-5 rounded-xl"
                style={{ height: 56, background: '#FFFFFF', border: `1px solid ${C.line}` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke={C.gold} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M2 8l10 6 10-6" />
                </svg>
                <span className="text-[15px] font-semibold" style={{ color: C.ink }}>메일 보내기</span>
              </button>

              {/* 카카오 오픈채팅 — 즉시 상담 */}
              <button type="button" onClick={onKakao}
                className="w-full flex items-center gap-3 px-5 rounded-xl"
                style={{ height: 56, background: '#FFFFFF', border: `1px solid ${C.line}` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke={C.gold} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-[15px] font-semibold" style={{ color: C.ink }}>카카오 오픈채팅</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════
   AppMeta — §8 (버전·빌드 + 5탭 디버그 시트)
══════════════════════════════════════════ */
function AppMeta({ toast: _toast }: { toast: ReturnType<typeof useToast> }) {
  const [tapCount, setTapCount] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  const onTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= 5) {
      setTapCount(0);
      setShowDebug(true);
    }
  };

  return (
    <>
      <button type="button" onClick={onTap}
        className="w-full text-center py-5 select-none"
        aria-label="앱 버전 정보">
        <span className="text-[11px]" style={{ color: C.mute }}>
          사주500 v{APP_VERSION} · 빌드 {BUILD_DATE}
        </span>
      </button>

      {/* 디버그 시트 (5탭 활성) */}
      <AnimatePresence>
        {showDebug && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDebug(false)}
            />
            <motion.div
              className="fixed bottom-0 inset-x-0 z-50"
              style={{
                background: C.ink,
                borderRadius: '16px 16px 0 0',
                maxWidth: 520, margin: '0 auto',
                padding: '20px 24px 48px',
              }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              <p className="text-[12px] font-bold mb-3" style={{ color: C.gold }}>디버그 정보 (개발자 전용)</p>
              {[
                `버전: v${APP_VERSION}`,
                `빌드: ${BUILD_DATE}`,
                `환경: ${typeof window !== 'undefined' && (window as any).__APPINTOSS__ ? '앱인토스' : '웹앱'}`,
                `UA: ${typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) + '…' : 'N/A'}`,
                `시각: ${new Date().toISOString()}`,
              ].map((line, i) => (
                <p key={i} className="text-[11px] mb-1" style={{ color: 'rgba(248,245,238,0.65)' }}>{line}</p>
              ))}
              <button type="button" onClick={() => setShowDebug(false)}
                className="mt-4 w-full py-3 rounded-xl text-[14px] font-bold"
                style={{ background: 'rgba(255,255,255,0.1)', color: C.paper }}>
                닫기
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ══════════════════════════════════════════
   인라인 SVG 아이콘 (lucide 의존성 없음)
══════════════════════════════════════════ */
function MenuIcon({ name }: { name: string }) {
  const s = {
    width: 22, height: 22,
    fill: 'none' as const,
    stroke: C.mute,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'wallet': return (
      <svg viewBox="0 0 24 24" {...s}>
        <rect x="2" y="6" width="20" height="14" rx="2" />
        <path d="M2 10h20M16 15h2" />
      </svg>
    );
    case 'receipt': return (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1z" />
        <path d="M8 8h8M8 12h8M8 16h4" />
      </svg>
    );
    case 'mail': return (
      <svg viewBox="0 0 24 24" {...s}>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M2 8l10 6 10-6" />
      </svg>
    );
    case 'file-text': return (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    );
    case 'shield-check': return (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
    case 'archive': return (
      <svg viewBox="0 0 24 24" {...s}>
        <rect x="2" y="4" width="20" height="5" rx="1" />
        <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
        <path d="M10 13h4" />
      </svg>
    );
    default: return null;
  }
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={C.mute} strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default MyPage;
