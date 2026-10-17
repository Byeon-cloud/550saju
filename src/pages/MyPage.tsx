// MyPage v2 — Sprint 2 #53 전면 재설계 (2026-04-23)
// 스펙: docs/mockups/사주500_UI개편_04_내정보.md §0~§14
// 변경: ProfileHeader(140px+"命" 워터마크) + LoginModal(80vh 시트) + ContactSheet + AppMeta(5탭 디버그)
// 보존: MENU_ITEMS_AIT/WEB 분기 로직 (Sprint 1 — 삭제 금지)
// 광고: 페이지 맨 아래 1개 (AdSlot · 앱인토스 빌드 한정 · 2026-05-05 정책 변경 — 준기 결정)

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getBalance, addPaidBalance } from '@/services/storage/localStore';
import { isAppsInToss } from '@/services/payment/iapService';
import { isAppintosBuild } from '@/lib/env';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getHourBranch } from '@/utils/saju-format';
import { Header } from '@/components/layout/Header';
// Stage 7e-5: ProfileHeader 만세력 요약 통합
import { calculateSaju } from '@/services/saju/calculator';
import { analyzeSinsal } from '@/services/saju/sinsal';
import { getIljuMeaning } from '@/constants/iljuMeaning';
import type { OhengType } from '@/types/saju';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_BANNER_GROUP_ID } from '@/constants/config';
// 웹 단독 출시 법적 컴플라이언스 (앱인토스 비노출)
import { LegalFooter } from '@/components/layout/LegalFooter';
import { DailyMailSignup } from '@/components/daily/DailyMailSignup';
import { useActiveProfile } from '@/hooks/useHomeData';
import { ConsentModal, type ConsentResult } from '@/components/auth/ConsentModal';
import { WebLoginSheet } from '@/components/auth/WebLoginSheet';
import { hasConsentRecord, saveConsent } from '@/services/auth/consent';
import { signOut } from '@/services/auth/authService';
import { Modal } from '@/components/common/Modal';
import { callDeleteAccount } from '@/services/auth/deleteAccount';

/* ─ SSOT 토큰 — PC_인수인계 §5 (2026-04-23) ─ */
const C = {
  paper:    '#F8F5EE',
  ink:      '#1A1A1A',
  inkSoft:  '#3D3D3D',
  mute:     '#6F6557',
  gold:     '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  line:     '#E5DFD0',
  danger:   '#C0392B',
} as const;
const SERIF = "'Noto Serif KR', serif";
// 2026-05-29 — 버전 SSOT = package.json (vite define 주입). 하드코딩 드리프트 박멸.
declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
// vite define 으로 빌드마다 실제 시각 자동 주입 (디버그 시트에서 새 코드 적용 확인용)
declare const __APP_BUILD_ID__: string;
const BUILD_DATE =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
const CONTACT_EMAIL = 'info@juulabel.com';
const KAKAO_CHANNEL_URL = 'https://open.kakao.com/o/pa01C1ri';

/* ─ 메뉴 정의 (Sprint 1 보존 — 분기 로직 삭제 금지) ─
   앱인토스: 5개 (운충전·결제내역·고객문의·이용약관·개인정보)
   웹앱: 6개 (분석기록 추가 — §4-3: 앱인토스만 삭제, 웹은 유지)             */
type MenuItem = { id: string; label: string; path: string; icon: string };

// Stage 7e-4: 고객문의 제거, 이용약관/개인정보처리방침은 footer 영역으로 이동
const MENU_ITEMS_AIT: MenuItem[] = [
  { id: 'charge',  label: '운 충전',         path: '/charge',  icon: 'wallet'       },
  // 2026-09-16 제거: '결제·사용 내역' → '/billing' 라우트·페이지·데이터가 전부 없어 404(NotFound)로 떨어졌음.
  //   토스 심사 재제출 전 깨진 메뉴 차단. 내역 페이지를 실제로 만들 때 App.tsx 라우트와 함께 복귀할 것.
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
  // 혼용 금지 (2026-06-11) — 빌드타임(isAppintosBuild) OR 런타임(isAppsInToss) 둘 중 하나라도
  //   앱인토스면 앱 UX. ait 번들은 빌드 레벨에서 웹 전용 UI(동의모달·로그아웃·탈퇴) 차단.
  const inAppsInToss = useMemo(() => isAppintosBuild || isAppsInToss(), []);
  // 2026-06-12 fix — 익명 세션(부팅 자동 로그인)이 '로그인됨'으로 취급돼 로그인 모달을 건너뛰고
  //   동의 모달부터 뜨던 버그. 웹은 진짜 계정(비익명)만 로그인으로 인정. 앱인토스는 토스 신원 우산 유지.
  const realLoggedIn = isLoggedIn && (inAppsInToss || (!!user && !user.isAnonymous));
  const MENU_ITEMS = inAppsInToss ? MENU_ITEMS_AIT : MENU_ITEMS_WEB;
  // 2026-10-17 웹 내 정보의 아침 일주 운세 메일 (앱은 그리지 않음, 토스 9시 알림이 같은 역할)
  const { profile: activeProfile, name: activeName } = useActiveProfile();
  const mailPrefill = (() => {
    const inp: any = (activeProfile as any)?.input;
    if (!inp?.birthYear) return undefined;
    const p2 = (n: number) => String(n).padStart(2, '0');
    return { birth: `${inp.birthYear}${p2(inp.birthMonth)}${p2(inp.birthDay)}`, calendar: (inp.calendarType === 'lunar' ? 'lunar' : 'solar') as 'solar' | 'lunar', name: activeName || '' };
  })();

  const [balance, setBalance] = useState(0);
  const [showContact, setShowContact] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // 웹 단독 출시 — 개인정보 동의 모달 + 회원탈퇴 (앱인토스 비노출)
  const [showConsent, setShowConsent] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  /* 잔액 동기화 */
  useEffect(() => {
    setBalance(getBalance());
  }, [location.pathname]);

  /* 웹 전용 — 로그인 직후 동의 이력 없으면 동의 모달 노출 (앱인토스는 토스 동의 우산) */
  useEffect(() => {
    if (inAppsInToss) return;
    if (loading || !realLoggedIn || !user?.uid) { setShowConsent(false); return; }
    let cancelled = false;
    hasConsentRecord(user.uid).then((has) => {
      if (!cancelled && !has) setShowConsent(true);
    });
    return () => { cancelled = true; };
  }, [inAppsInToss, loading, realLoggedIn, user?.uid]);

  const onConsentAgree = async (result: ConsentResult) => {
    if (user?.uid) await saveConsent(user.uid, result);
    setShowConsent(false);
  };

  const onLogout = async () => {
    try {
      // 2026-10-17 — 서버에 다 올린 뒤 이 기기 보관함을 비운다 (남겨 두면 다음 익명 계정이 다시 올려 섞였다). 다시 로그인하면 서버에서 돌아온다
      try {
        const uid = user?.uid;
        const backedUp = uid ? await (await import('@/services/storage/firestoreSync')).syncToCloud(uid) : false;
        if (backedUp) (await import('@/services/storage/localStore')).clearLocalLibrary();
      } catch { /* 백업이 실패하면 지우지 않는 편이 안전 — 그대로 로그아웃 */ }
      await signOut();
      toast.show('로그아웃 됐어요', 'info');
    } catch {
      toast.show('로그아웃에 실패했어요. 다시 시도해 주세요.', 'warning');
    }
  };

  const onWithdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      await callDeleteAccount();
      // 2026-10-17 — 탈퇴하면 이 기기의 보관함, 사주, 대화, 운 잔액도 지운다 (서버는 purgeUser 가 파기)
      try { (await import('@/services/storage/localStore')).clearLocalLibrary({ withBalance: true }); } catch { /* noop */ }
      await signOut();
      setShowWithdraw(false);
      toast.show('회원탈퇴가 완료됐어요', 'info');
      navigate('/', { replace: true });
    } catch (e: any) {
      toast.show('회원탈퇴에 실패했어요. 잠시 후 다시 시도해 주세요.', 'warning');
    } finally {
      setWithdrawing(false);
    }
  };

  /* 비로그인 → 로그인 모달 즉시 노출 (§2-1) — 웹 전용.
   *  2026-10-15 — 앱인토스는 토스 로그인만 허용. 익명 로그인이 늦거나 실패하면 앱에서 카카오, 네이버, 구글, Apple
   *  시트가 뜨던 구멍 → 앱 빌드와 토스 안에서는 절대 열지 않는다 (렌더도 아래에서 게이트). */
  useEffect(() => {
    if (inAppsInToss) { setShowLoginModal(false); return; }
    if (!loading && !realLoggedIn) {
      setShowLoginModal(true);
    } else {
      setShowLoginModal(false);
    }
  }, [inAppsInToss, loading, realLoggedIn]);

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
        {realLoggedIn && user ? (
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

        {!inAppsInToss && <DailyMailSignup prefill={mailPrefill} source="my" style={{ marginBottom: 12 }} />}

        {/* ── AppMeta (§8) ── */}
        <AppMeta toast={toast} />

        {/* 2026-05-04 가독성 보강: opacity 0.65 (실효 7~8px) → 1.0 + 12px (60대+ 가독)
         *  법적 링크는 WCAG AA 준수. 본문보다 작되 명확히 보이게. */}
        {/* 2026-06-02 — 고객문의 prominent 승격 (준기 "눈에 확 띄게").
            작은 법적 링크 행에서 분리 → 독립 골드 버튼. */}
        <button
          type="button"
          onClick={() => setShowContact(true)}
          className="w-full flex items-center justify-center gap-2 mt-5"
          style={{
            padding: '15px 16px',
            borderRadius: 14,
            background: '#FFFDF8', // 2026-10-13 v9 — 보조 버튼은 먹선(금색은 주 버튼에만), 그라데이션과 그림자 제거
            border: '1px solid rgba(26,22,18,0.28)',
            color: '#1A1612',
            fontSize: 16,
            fontWeight: 800,
            fontFamily: SERIF,
            cursor: 'pointer',
          }}
          aria-label="고객문의: 궁금한 점이나 문제를 알려주세요"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          고객문의
        </button>

        <div
          className="flex items-center justify-center gap-3 mt-4"
          style={{ fontSize: 13.5, color: C.mute, opacity: 0.85 }}
        >
          <button
            type="button"
            className="tap-pad"
            onClick={() => navigate('/terms')}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            이용약관
          </button>
          <span aria-hidden="true" style={{ width: 1, height: 11, background: 'currentColor', opacity: 0.3 }} />
          <button
            type="button"
            className="tap-pad"
            onClick={() => navigate('/privacy')}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            개인정보처리방침
          </button>
        </div>

        {/* 2026-06-03 웹 단독 출시 — 로그아웃 + 회원탈퇴 복원 (웹 전용, 앱인토스 비노출).
            근거: docs/법적요건_웹출시.md §4 (개인정보보호법 제21조 회원탈퇴 경로 필수). */}
        {!inAppsInToss && realLoggedIn && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              type="button"
              onClick={onLogout}
              style={{ background: 'transparent', border: 'none', color: C.mute, fontSize: 13.5, cursor: 'pointer' }}
            >
              로그아웃
            </button>
            <span style={{ color: C.line }}>|</span>
            <button
              type="button"
              onClick={() => setShowWithdraw(true)}
              style={{ background: 'transparent', border: 'none', color: C.danger, fontSize: 13.5, cursor: 'pointer' }}
            >
              회원탈퇴
            </button>
          </div>
        )}

        {/* ── 배너광고 — 페이지 맨 아래 (앱인토스 빌드 한정 · silent fallback) ── */}
        <div className="mt-4">
          <AdSlot unit={AD_BANNER_GROUP_ID} minHeight={90} />
        </div>

        {/* ── 웹 단독 출시 사업자 신원정보 푸터 (앱인토스 비노출) ── */}
        <LegalFooter />
      </div>

      {/* ── LoginModal (§2-2) — 웹 전용 (앱인토스는 토스 로그인만) ── */}
      {!inAppsInToss && (
        <WebLoginSheet
          open={showLoginModal}
          onClose={onCloseLoginModal}
          toast={toast}
          onLogin={login}
        />
      )}

      {/* ── ContactSheet (§4-4) ── */}
      <ContactSheet
        open={showContact}
        onClose={() => setShowContact(false)}
        userId={user?.uid}
        toast={toast}
      />

      {/* ── 웹 전용 개인정보 동의 모달 (첫 로그인 · 앱인토스 비노출) ── */}
      <ConsentModal open={showConsent} onAgree={onConsentAgree} />

      {/* ── 회원탈퇴 확인 Modal (되돌릴 수 없음) ── */}
      <Modal isOpen={showWithdraw} onClose={() => !withdrawing && setShowWithdraw(false)} title="회원탈퇴">
        <p className="text-body-sm text-text-secondary leading-relaxed mb-2">
          탈퇴하면 사주 분석 기록, 프로필, 대화 기록이 모두 삭제되며 되돌릴 수 없어요.
        </p>
        <p className="text-caption text-text-muted leading-relaxed mb-5">
          단, 전자상거래법에 따라 결제 기록은 5년 동안 따로 보관해요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowWithdraw(false)}
            disabled={withdrawing}
            className="flex-1 rounded-xl font-semibold"
            style={{ height: 48, background: '#FFFFFF', border: `1px solid ${C.line}`, color: C.ink, fontSize: 15 }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onWithdraw}
            disabled={withdrawing}
            className="flex-1 rounded-xl font-semibold"
            style={{ height: 48, background: C.danger, color: '#FFFFFF', fontSize: 15, opacity: withdrawing ? 0.6 : 1 }}
          >
            {withdrawing ? '처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </Modal>
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
  목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82',
};
const OHENG_HAN_MY: Record<OhengType, string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};
const OHENG_BOX_MY: Record<OhengType, { bg: string; fg: string; outline: string }> = {
  목: { bg: '#4E7A57', fg: '#FFFFFF', outline: '#1B5E2C' },
  화: { bg: '#B04A38', fg: '#FFFFFF', outline: '#9B1B1B' },
  토: { bg: '#B07F38', fg: '#FFFFFF', outline: '#B85A0E' },
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
      // 2026-07-14 기준 v2 — 내정보 카드는 라이브 만세력이므로 항상 '현행 기준' 재계산 우선.
      //   (getMyProfile 은 박제 리포트를 반환 → 그 캐시는 옛 기준일 수 있음. 폴백으로만 사용)
      let data: any = null;
      try { data = calculateSaju(myProfile.input as any); } catch { /* 폴백 */ }
      if (!data) data = (myProfile as any).sajuData || null;
      if (!data) return null;
      const ilgan = data?.pillars?.[2]?.천간 || '';
      const ilji = data?.pillars?.[2]?.지지 || '';
      const dayOheng = (data?.pillars?.[2]?.천간오행 || '토') as OhengType;
      const ilju = ilgan + ilji;
      const meaning = getIljuMeaning(ilju);
      // Stage 7e-7: 출생정보 + 학술 라벨 (사주카드 L1 톤 통일)
      const i = myProfile.input as any;
      const birthYMD = `${i.birthYear}.${String(i.birthMonth).padStart(2, '0')}.${String(i.birthDay).padStart(2, '0')}`;
      const calLabel = i.calendarType === 'lunar' || i.calendarType === 'lunar_leap' ? '음력' : '양력';
      // 2026-06-02 — 밴드 입력(분 X)이라 "11시" 대신 시(時) 이름만. 분 있으면 정확 시각 병기.
      const hourLabel = i.hasBirthTime
        ? ((i.birthMinute ?? 0) > 0
            ? `${i.birthHour}시 ${i.birthMinute}분, ${getHourBranch(i.birthHour, i.birthMinute)?.ko ?? ''}`.trim()
            : (getHourBranch(i.birthHour, 0)?.ko ?? `${i.birthHour}시`))
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
      // 2026-05-28 PM v5 — 일주명 정확화 (user 지적: 일간·일지·일주 헷갈림 박멸).
      //   일주(日柱) = 일간 + 일지 한쌍. "병자(丙子) 일주" 가 정확한 표기.
      //   "병(丙) 일간 · 자(子) 일지" 보다 일주명 우선 노출 → 사용자 정체성 = 일주명.
      const iljuNameKo = ilganKo && iljiKo ? `${ilganKo}${iljiKo}` : ''; // "병자"
      const academicLabel = iljuNameKo ? `${iljuNameKo}(${ilgan}${ilji}) 일주` : '';

      // 2026-05-28 PM v2 — viral 카드 업그레이드: 8글자 + 오행 + 십성 + 격국 + 신살 + 공망 + 현재 대운/세운
      //   참고: 사람들이 인스타·X·스레드에 자기 사주 캡쳐 공유 → 명리학 좀 아는 사람도 알아볼 수 있는 정보 풍부 카드
      const pillarsRaw = data?.pillars || [];
      // 2026-05-28 PM v7 — 십성 한자(번·간체 혼용 from lunar-javascript) → 한국어 매핑.
      //   lunar-javascript 가 偏印/劫财/正官/正财/伤官/比肩 등 간체+번체 혼용 반환 → 한국어 정통명 통일.
      const SIPSUNG_KO: Record<string, string> = {
        比肩: '비견',
        劫财: '겁재', 劫財: '겁재',
        食神: '식신',
        伤官: '상관', 傷官: '상관',
        偏财: '편재', 偏財: '편재',
        正财: '정재', 正財: '정재',
        七杀: '편관', 七殺: '편관', 偏官: '편관',
        正官: '정관',
        偏印: '편인', 枭神: '편인', 梟神: '편인',
        正印: '정인',
      };
      function toSipsungKo(raw: string): string {
        if (!raw) return '';
        // "편관/정관" 처럼 / 로 multiple 일 때 첫 번째 매핑
        const first = raw.split('/')[0].trim();
        return SIPSUNG_KO[first] || first;
      }
      // 2026-05-28 PM v4 — 십성 데이터는 별도 sipsung 배열에 position 형식으로 저장됨.
      //   position: '년간/월간/일간/시간' (천간) · '년지/월지/일지/시지' (지지).
      //   idx 0=년주, 1=월주, 2=일주, 3=시주.
      const sipsungArr = ((data as any)?.sipsung as Array<{ position: string; 십성: string }>) || [];
      const POSITION_PREFIX = ['년', '월', '일', '시'];
      function getSipsungLabel(idx: number, slot: '천간' | '지지'): string {
        const prefix = POSITION_PREFIX[idx];
        if (!prefix) return '';
        const target = `${prefix}${slot === '천간' ? '간' : '지'}`;
        const found = sipsungArr.find(s => s.position === target);
        if (!found?.십성) return '';
        // 일주(idx=2)·천간(slot='천간') 은 '나' 라벨로 노출 (sipsung 값 = '일주')
        if (idx === 2 && slot === '천간') return '일간';
        // 한자(간체/번체) → 한국어 정통명 (편인·정관·겁재·식신 등)
        return toSipsungKo(found.십성);
      }

      const ohengCount: Record<'목' | '화' | '토' | '금' | '수', number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
      for (const p of pillarsRaw) {
        if (p?.천간오행) ohengCount[p.천간오행 as keyof typeof ohengCount]++;
        if (p?.지지오행) ohengCount[p.지지오행 as keyof typeof ohengCount]++;
      }

      // 격국 — '판정 보류' 등 fallback 은 hide. 실제 격국명만 노출.
      const gyeokgukRaw = (data as any)?.myeongriAnalysis?.격국 || '';
      const gyeokguk = /판정\s*보류|미정|없음|unknown/i.test(gyeokgukRaw) ? '' : gyeokgukRaw;
      // 일간 강약 (신강/신약/중화) — 친근한 한국어
      const ganGangYak = (data as any)?.myeongriAnalysis?.일간강약 || '';

      // 2026-05-28 PM v6 — 지장간(支藏干) + 12운성(運星) derive (만세력 reference 수준).
      const jijangganArr = ((data as any)?.jijanggan as Array<{ 지지: string; 지장간: string[] }>) || [];
      const unyoung12Arr = ((data as any)?.unyoung12 as Array<{ position: string; 운성: string }>) || [];
      function getJijanggan(idx: number): string {
        const p = pillarsRaw[idx];
        if (!p?.지지) return '';
        const found = jijangganArr.find(j => j.지지 === p.지지);
        return found?.지장간 ? found.지장간.join('') : '';
      }
      // 12운성 한자 → 한글 매핑 (lunar-javascript 가 간체/번체 혼용 반환 → 둘 다 처리)
      //   12 stages: 長生→沐浴→冠帶→臨官(=建祿)→帝旺→衰→病→死→墓→絕→胎→養
      const UNYOUNG_KO: Record<string, string> = {
        // 번체
        長生: '장생', 沐浴: '목욕', 冠帶: '관대', 建祿: '건록', 臨官: '건록',
        帝旺: '제왕', 衰: '쇠', 病: '병', 死: '사', 墓: '묘', 絕: '절', 胎: '태', 養: '양',
        // 간체 (lunar-javascript 실제 반환값 — 临官·养·绝 등)
        长生: '장생', 冠带: '관대', 建禄: '건록', 临官: '건록',
        绝: '절', 养: '양',
      };
      function getUnyoung(idx: number): string {
        // calculator 의 position 은 '년지/월지/일지/시지' 형식
        const POS_KO = ['년지', '월지', '일지', '시지'];
        const target = POS_KO[idx];
        const found = unyoung12Arr.find(u => u.position === target);
        const raw = found?.운성 || '';
        return UNYOUNG_KO[raw] || raw; // 한자면 한글로, 매핑 없으면 raw
      }

      // 2026-05-28 PM v4 — 신살 길성 우선 정렬 + 살 후순위 (사용자가 "흉살만" 보고 걱정 X).
      //   sinsal.ts 의 analyzeSinsal: gilsongGwiin (천을귀인 등) · shipiSinsal (12신살) · bojo (홍염·괴강 등).
      //   정렬: (1) gilsongGwiin (천을·문창·월덕·천덕·태극·금여) (2) 12신살 중 길성 (도화·장성·반안·화개)
      //        (3) bojo (홍염 등) (4) 12신살 중 살 (겁살·재살·천살·망신·월살·육해)
      let knownSinsal: Array<{ name: string; hanja: string; category: string }> = [];
      try {
        const sinsalResult = analyzeSinsal(pillarsRaw);
        const gilSorted: typeof sinsalResult.gilsongGwiin = [];
        const neuSorted: typeof sinsalResult.gilsongGwiin = [];
        const hyungSorted: typeof sinsalResult.gilsongGwiin = [];
        // Priority order
        for (const h of sinsalResult.gilsongGwiin) gilSorted.push(h);
        for (const h of sinsalResult.shipiSinsal) {
          if (h.category === 'gilsin') gilSorted.push(h);
          else if (h.category === 'neutral') neuSorted.push(h);
          else hyungSorted.push(h);
        }
        for (const h of sinsalResult.bojo) {
          if (h.category === 'gilsin') gilSorted.push(h);
          else hyungSorted.push(h);
        }
        const seen = new Set<string>();
        for (const h of [...gilSorted, ...neuSorted, ...hyungSorted]) {
          if (!h?.name || seen.has(h.name)) continue;
          seen.add(h.name);
          knownSinsal.push({ name: h.name, hanja: h.hanja || '', category: h.category });
          if (knownSinsal.length >= 4) break;
        }
      } catch { /* noop */ }

      // 공망 (일주 기준) — 한글 reading 병기
      const gongmangArr = ((data as any)?.gongmang as Array<{ 기준: string; 공망: string }>) || [];
      const ilGongmangRaw = gongmangArr.find(g => g.기준 === '일주' || g.기준 === '日柱') || gongmangArr[0];
      // hanja → hangul reading helper (ZHI_KO 매핑 활용)
      function gongmangHangul(hanja: string): string {
        return hanja.split('').map(c => ZHI_KO[c] || c).join('');
      }
      const ilGongmang = ilGongmangRaw ? {
        공망: ilGongmangRaw.공망,
        hangul: gongmangHangul(ilGongmangRaw.공망),
      } : null;
      // 현재 대운
      const currentDaeun = (data as any)?.currentDaeun as { 시작나이: number; 끝나이: number; 간지: string; 천간: string; 지지: string } | undefined;
      // 현재 세운 (올해 운)
      const yearlyUn = (data as any)?.yearlyUn as { 천간: string; 지지: string; 간지: string } | undefined;
      const currentYear = new Date().getFullYear();
      // 대운 천간 → 십성 (대략적 — 일간 기준)
      // 일간이 ilgan, 대운 천간이 currentDaeun.천간 → 십성 계산 (간단 매핑 X · 그대로 표시)

      return {
        ilgan, ilji, ilju, dayOheng,
        identity: meaning?.identity || '',
        personality: meaning?.personality || '',
        pillars: pillarsRaw,
        birthLine: `${calLabel} ${birthYMD}, ${hourLabel}`,
        academicLabel,
        ohengCount,
        getSipsungLabel,
        getJijanggan,
        getUnyoung,
        // viral 신규 필드
        gyeokguk,
        ganGangYak,
        knownSinsal,
        ilGongmang,
        currentDaeun,
        yearlyUn,
        currentYear,
      };
    } catch { return null; }
  }, [myProfile]);

  // 사주 입력 안 된 경우 — fallback 헤더 (Stage 7e-7: 워딩 자연스럽게)
  if (!myProfile || !sajuSummary) {
    const greeting = name ? `${name} 님` : '반가워요';
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
            <div className="text-[13px]" style={{ color: C.mute }}>
              사주를 입력하면 만세력 카드를 만들어드려요
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/input?from=my')}
            style={{
              background: C.goldDeep, color: C.paper, border: 'none', borderRadius: 999,
              padding: '8px 14px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
            }}
          >
            사주 입력 ›
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
        background: '#FFFDF8', // 2026-10-13 v9 — 3색 그라데이션 대신 종이 한 장
        border: `1.5px solid ${accentColor}55`,
        cursor: 'pointer',
        boxShadow: `0 8px 24px ${accentColor}1F, 0 2px 6px rgba(0,0,0,0.04)`,
      }}
    >
      {/* 우하단 일지 한자 워터마크 (큰 사이즈) */}
      <span
        aria-hidden
        style={{
          display: 'none', // 2026-10-10 v9 — 큰 한자 워터마크 제거
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
          background: 'none', // 2026-10-13 v9 — 모서리 빛번짐 제거
          pointerEvents: 'none',
        }}
      />

      {/* 상단 row: name + 잔여 운 */}
      <div className="flex items-center justify-between mb-1 relative">
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em' }}>
          {name ? `${name} 님` : '나의 사주'}
        </div>
        {/* 2026-10-15 — 알약 배지(흰 바탕, 금색 점과 금색 글자) → 먹 글자만 (금색은 누르는 버튼에만) */}
        <div style={{ fontSize: 14, fontWeight: 700, color: C.mute }}>
          남은 운 <b style={{ fontWeight: 800, color: C.ink }}>{balance}운</b>
        </div>
      </div>

      {/* Stage 7e-7: 출생정보 한 줄 (사주카드 L1 톤) */}
      {sajuSummary.birthLine && (
        <div
          className="relative"
          style={{
            fontSize: 13.5,
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
              fontSize: 13,
              fontWeight: 800,
              color: accentColor,
              letterSpacing: '0.04em',
              marginBottom: 6,
            }}
          >
            나의 일주
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
                fontSize: 13,
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
                fontSize: 14,
                color: C.ink,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              {sajuSummary.personality}
            </div>
          )}
          {/* 2026-05-28 PM viral 업그레이드: 4기둥 8글자 + 십성 + 오행 분포.
              user: "사람들이 사주 캡쳐해서 자랑함, 정보 풍부해야 viral". */}
        </div>
      </div>

      {/* 4기둥 (8글자) — 시·일·월·년 columns + 천간(top) + 지지(bottom) + 십성 라벨 */}
      <div
        className="relative"
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px dotted rgba(184,150,90,0.40)`,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
        }}
      >
        {[3, 2, 1, 0].map((idx) => {
          const p = sajuSummary.pillars[idx];
          const labelKo = ['년주', '월주', '일주', '시주'][idx];
          const isDay = idx === 2;
          if (!p?.available) {
            return (
              <div key={idx} style={{ textAlign: 'center', opacity: 0.4 }}>
                <div style={{ fontSize: 13, color: C.mute, marginBottom: 4 }}>{labelKo}</div>
                <div style={{ height: 60, border: `1px dashed ${C.line}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.mute }}>—</div>
              </div>
            );
          }
          const ganOheng = p.천간오행 as OhengType;
          const jiOheng = p.지지오행 as OhengType;
          const ganBox = OHENG_BOX_MY[ganOheng];
          const jiBox = OHENG_BOX_MY[jiOheng];
          const ganSip = sajuSummary.getSipsungLabel(idx, '천간');
          const jiSip = sajuSummary.getSipsungLabel(idx, '지지');
          return (
            <div key={idx} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
                color: isDay ? C.goldDeep : C.mute, marginBottom: 4,
              }}>
                {labelKo}{isDay ? ' 나' : ''}
              </div>
              {/* 천간 십성 */}
              {ganSip && (
                <div style={{ fontSize: 13, color: ganBox.outline, fontWeight: 700, marginBottom: 3, opacity: 0.92 }}>
                  {ganSip}
                </div>
              )}
              {/* 천간 박스 */}
              <div style={{
                height: 36,
                background: ganBox.bg, color: ganBox.fg,
                border: isDay ? `1.8px solid ${C.gold}` : `1.2px solid ${ganBox.outline}`,
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SERIF, fontSize: 22, fontWeight: 900, lineHeight: 1,
                boxShadow: isDay ? `0 2px 6px ${C.gold}44` : '0 1px 2px rgba(0,0,0,0.05)',
                marginBottom: 4,
              }}>
                {p.천간}
              </div>
              {/* 지지 박스 */}
              <div style={{
                height: 36,
                background: jiBox.bg, color: jiBox.fg,
                border: isDay ? `1.8px solid ${C.gold}` : `1.2px solid ${jiBox.outline}`,
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SERIF, fontSize: 22, fontWeight: 900, lineHeight: 1,
                boxShadow: isDay ? `0 2px 6px ${C.gold}44` : '0 1px 2px rgba(0,0,0,0.05)',
              }}>
                {p.지지}
              </div>
              {/* 지지 십성 */}
              {jiSip && (
                <div style={{ fontSize: 13, color: jiBox.outline, fontWeight: 700, marginTop: 3, opacity: 0.92 }}>
                  {jiSip}
                </div>
              )}
              {/* 2026-05-28 PM v6 — 지장간 (지지 안에 숨은 천간 3개) */}
              {(() => {
                const jjg = sajuSummary.getJijanggan(idx);
                return jjg ? (
                  <div style={{
                    marginTop: 4,
                    fontFamily: SERIF,
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#5C4A2E',
                    letterSpacing: '0.02em',
                  }}>{jjg}</div>
                ) : null;
              })()}
              {/* 2026-05-28 PM v6 — 12운성 (지지 운기 단계: 장생/제왕/묘 등) */}
              {(() => {
                const uy = sajuSummary.getUnyoung(idx);
                return uy ? (
                  <div style={{
                    marginTop: 3,
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.mute,
                    background: 'rgba(184,150,90,0.10)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    display: 'inline-block',
                  }}>{uy}</div>
                ) : null;
              })()}
            </div>
          );
        })}
      </div>

      {/* 오행 분포 — 5 badges */}
      <div
        className="relative"
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {(['목', '화', '토', '금', '수'] as const).map((oh) => {
          const count = sajuSummary.ohengCount[oh];
          const box = OHENG_BOX_MY[oh];
          const isStrong = count >= 3;
          const isMissing = count === 0;
          const hanja = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' }[oh];
          return (
            <div
              key={oh}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '4px 6px',
                background: '#FFFFFF',
                border: `1.5px solid ${isStrong ? box.outline : isMissing ? C.line : `${box.outline}55`}`,
                borderRadius: 2,
                opacity: isMissing ? 0.5 : 1,
              }}
            >
              <span style={{
                fontFamily: SERIF, fontSize: 13, fontWeight: 900, color: box.outline,
                lineHeight: 1,
              }}>{hanja}</span>
              <span style={{
                fontSize: 13.5, fontWeight: 800, color: '#1A1A1A',
                fontFeatureSettings: '"tnum"',
              }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* 2026-05-28 PM viral v2 — 명리학적 깊이 (격국 + 신살 + 공망) */}
      {(sajuSummary.gyeokguk || sajuSummary.knownSinsal.length > 0 || sajuSummary.ilGongmang) && (
        <div
          className="relative"
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px dotted rgba(184,150,90,0.40)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: C.goldDeep, letterSpacing: '0.12em' }}>
            명리학적 흐름
          </div>
          {/* 2026-05-28 PM v5 — 정확한 명리학 용어: 일주 / 일간 / 일지 / 일간 강약 구분 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, color: C.mute, fontWeight: 700, minWidth: 44 }}>일주</span>
            <span style={{
              fontSize: 14, fontWeight: 800, color: '#1A1A1A',
            }}>
              {sajuSummary.ilgan && sajuSummary.ilji ? `${({ 甲:'갑', 乙:'을', 丙:'병', 丁:'정', 戊:'무', 己:'기', 庚:'경', 辛:'신', 壬:'임', 癸:'계' } as any)[sajuSummary.ilgan] || ''}${({ 子:'자', 丑:'축', 寅:'인', 卯:'묘', 辰:'진', 巳:'사', 午:'오', 未:'미', 申:'신', 酉:'유', 戌:'술', 亥:'해' } as any)[sajuSummary.ilji] || ''}` : ''}
              <span style={{ marginLeft: 4, fontFamily: SERIF, fontSize: 13.5, fontWeight: 600, opacity: 0.72 }}>
                ({sajuSummary.ilgan}{sajuSummary.ilji})
              </span>
            </span>
          </div>
          {sajuSummary.gyeokguk && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, color: C.mute, fontWeight: 700, minWidth: 44 }}>격국</span>
              <span style={{
                fontSize: 14, fontWeight: 800, color: '#1A1A1A',
              }}>{sajuSummary.gyeokguk}</span>
            </div>
          )}
          {sajuSummary.ganGangYak && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, color: C.mute, fontWeight: 700, minWidth: 44 }}>일간 강약</span>
              <span style={{
                fontSize: 14, fontWeight: 700, color: '#1A1A1A',
              }}>{sajuSummary.ganGangYak}</span>
            </div>
          )}
          {sajuSummary.knownSinsal.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, color: C.mute, fontWeight: 700, minWidth: 44 }}>신살</span>
              {/* 2026-10-15 — 종류별 색 바탕 알약 → 글자만 (길성 송록, 흉살 석간주, 그 밖 먹), 쉼표로 나열 */}
              <div style={{ flex: 1, fontSize: 14, lineHeight: 1.6 }}>
                {sajuSummary.knownSinsal.slice(0, 4).map((s, i) => {
                  const isGil = s.category === 'gilsin';
                  const isHyung = s.category === 'hyungsal';
                  const color = isGil ? '#4E7A57' : isHyung ? '#B04A38' : C.ink;
                  return (
                    <span key={i} style={{ fontWeight: 700, color }}>
                      {i > 0 && <span style={{ color: C.mute, fontWeight: 400 }}>, </span>}
                      {s.name}
                      {s.hanja && s.hanja !== s.name && (
                        <span style={{ marginLeft: 3, fontSize: 13, opacity: 0.72, fontWeight: 600 }}>({s.hanja})</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {sajuSummary.ilGongmang && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13.5, color: C.mute, fontWeight: 700, minWidth: 44 }}>공망</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                {sajuSummary.ilGongmang.hangul}
                <span style={{ marginLeft: 4, fontFamily: SERIF, fontSize: 13.5, fontWeight: 600, color: '#6F6557' }}>
                  ({sajuSummary.ilGongmang.공망})
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* viral v2 — 현재 흐름 (대운 + 세운) */}
      {(sajuSummary.currentDaeun || sajuSummary.yearlyUn) && (
        <div
          className="relative"
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px dotted rgba(184,150,90,0.40)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: C.goldDeep, letterSpacing: '0.12em' }}>
            지금 흐르는 흐름
          </div>
          {(() => {
            // 한자 간지 → 한글 reading
            const GAN_KO_local: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
            const ZHI_KO_local: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
            const toHangulGanji = (gan: string, ji: string) => `${GAN_KO_local[gan] || ''}${ZHI_KO_local[ji] || ''}`;
            return (
              <>
                {sajuSummary.currentDaeun && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, color: C.mute, fontWeight: 700, minWidth: 44 }}>대운</span>
                    <span style={{ fontSize: 13.5, color: '#3D3427', fontWeight: 600 }}>
                      {sajuSummary.currentDaeun.시작나이}~{sajuSummary.currentDaeun.끝나이}세
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>
                      {toHangulGanji(sajuSummary.currentDaeun.천간, sajuSummary.currentDaeun.지지)}
                      <span style={{ marginLeft: 4, fontFamily: SERIF, fontSize: 13.5, opacity: 0.72, fontWeight: 600 }}>
                        ({sajuSummary.currentDaeun.간지})
                      </span>
                    </span>
                  </div>
                )}
                {sajuSummary.yearlyUn && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, color: C.mute, fontWeight: 700, minWidth: 44 }}>세운</span>
                    <span style={{ fontSize: 13.5, color: '#3D3427', fontWeight: 600 }}>
                      {sajuSummary.currentYear}년
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>
                      {toHangulGanji(sajuSummary.yearlyUn.천간, sajuSummary.yearlyUn.지지)}
                      <span style={{ marginLeft: 4, fontFamily: SERIF, fontSize: 13.5, opacity: 0.72, fontWeight: 600 }}>
                        ({sajuSummary.yearlyUn.간지})
                      </span>
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

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
            fontSize: 13.5,
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

  /* 🚨 2026-07-29 — 외부 이동은 앱인토스에서 SDK openURL 을 경유한다.
   *   토스 웹뷰는 window.open(팝업)·비-http 스킴(a[href=mailto]) 인터셉트가 보장되지 않아
   *   무동작할 수 있는데, 이 두 경로가 곧 **필수 메뉴 '고객문의'** 라 먹통이면 심사 지적 직결.
   *   openURL 은 "지정한 URL 을 기기 기본 브라우저나 연결된 앱에서" 열어주므로 카톡·메일앱으로 정상 전달.
   *   웹(비-앱인토스)에서는 기존 동작을 그대로 쓴다. 실패 시에도 기존 경로로 폴백. */
  const openExternal = async (url: string, fallback: () => void) => {
    try {
      const { isAppsInToss } = await import('@/services/payment/iapService');
      if (isAppsInToss()) {
        const mod: any = await import('@apps-in-toss/web-framework');
        if (typeof mod.openURL === 'function') {
          await mod.openURL(url);
          return;
        }
      }
    } catch { /* 폴백으로 */ }
    fallback();
  };

  const onMail = () => {
    void openExternal(mailtoUrl, () => {
      const a = document.createElement('a');
      a.href = mailtoUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    onClose();
  };

  const onKakao = () => {
    void openExternal(KAKAO_CHANNEL_URL, () => {
      window.open(KAKAO_CHANNEL_URL, '_blank', 'noopener,noreferrer');
    });
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
            <p className="text-[13.5px] mb-5" style={{ color: C.mute }}>{CONTACT_EMAIL}</p>

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

/* CS 고객센터 코드 (2026-06-12 · 2026-08-13 보안 수정) — 회원 ID(uid) 표시 (탭하면 복사).
   고객이 문의 시 이 코드를 불러주면 어드민 'CS 지급' 탭에서 즉시 운 보상 가능(uid 키 지원).
   ⚠️ 2026-08-13 — 기존엔 raw deviceId 를 클립보드에 복사했는데, deviceId 는 기기 여권(자동복구)의
   트리거 키라 유출 시 타인 보관함(PII)+잔액 탈취에 악용될 수 있었다. uid 로 교체:
   uid 는 passport 트리거가 아니고 firestore.rules 가 읽기를 막아 유출돼도 무해하며,
   이미 문의 메일 제목([회원ID:...])에 노출되는 값이라 CS 워크플로 그대로. deviceId 는 기기 내부 전용. */
function CsCode({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    import('@/services/payment/iapService').then(async ({ isAppsInToss }) => {
      if (!isAppsInToss()) return;
      try {
        const { auth } = await import('@/services/auth/firebase');
        const uid = auth.currentUser?.uid;
        if (uid) setCode(uid);
      } catch { /* noop */ }
    }).catch(() => { /* noop */ });
  }, []);
  if (!code) return null;
  const short = `${code.slice(0, 6)}...${code.slice(-4)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.show('고객센터 코드가 복사됐어요', 'success');
    } catch {
      toast.show('복사에 실패했어요, 길게 눌러 직접 복사해 주세요', 'warning');
    }
  };
  return (
    <button type="button" onClick={copy} className="w-full text-center pb-4 select-none" aria-label="고객센터 코드 복사">
      <span className="text-[13px]" style={{ color: C.mute }}>
        고객센터 코드 <span style={{ fontFamily: 'monospace' }}>{short}</span> 탭하면 복사
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════
   AppMeta — §8 (버전·빌드 + 5탭 디버그 시트)
══════════════════════════════════════════ */
function AppMeta({ toast: _toast }: { toast: ReturnType<typeof useToast> }) {
  // QA 전용 도구 노출 플래그 — .env VITE_DEBUG_TOOLS=1 인 빌드에서만 true (출시본 기본 OFF)
  const DEBUG_TOOLS = import.meta.env.VITE_DEBUG_TOOLS === '1';
  const [tapCount, setTapCount] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [promoBusy, setPromoBusy] = useState(false);

  // 프로모션 TEST 호출 — 토스 콘솔 "시작하기" 활성화용. 디버그 시트(버전 5탭)에서만 노출.
  //
  // 🚨 2026-07-29 수정 — 이전엔 grantLaunchPromotion()(=LIVE 경로)을 불러서, 라벨은 "TEST"인데
  //   `.env VITE_PROMO_LIVE=1` 때문에 **실제 LIVE 코드로 실지급(50원 차감)** 이 나갔다.
  //   정작 공식 문서가 요구하는 `TEST_{promotionCode}` 호출은 한 번도 수행되지 않아
  //   콘솔에서 "프로모션 시작하기" 를 누를 수 없는 상태였다.
  //   → test7DayPromotion 은 LIVE 플래그와 무관하게 항상 TEST_ 코드를 쓴다.
  //   현재 대상: 7일 완주 100원 (출시 50원 TEST_01KYM4… 는 2026-10 프로모션 종료로 제거)
  const runPromoTest = async () => {
    if (promoBusy) return;
    setPromoBusy(true);
    try {
      const m = await import('@/services/toss/tossPromotion');
      const r = await m.test7DayPromotion();
      const label = '7일 완주';
      _toast.show(
        r.ok
          ? `${label} TEST 호출 성공: 콘솔에서 "시작하기" 가능`
          : `${label} TEST 실패: ${m.describePromoFailure(r.reason)}`,
        r.ok ? 'success' : 'warning',
      );
    } catch (e: any) {
      _toast.show(`예외: ${e?.message || 'unknown'}`, 'warning');
    } finally {
      setPromoBusy(false);
    }
  };

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
        <span className="text-[13px]" style={{ color: C.mute }}>
          사주500 v{APP_VERSION} 빌드 {BUILD_DATE}
        </span>
      </button>
      <CsCode toast={_toast} />

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
              <p className="text-[13.5px] font-bold mb-3" style={{ color: C.gold }}>디버그 정보 (개발자 전용)</p>
              {[
                `버전: v${APP_VERSION}`,
                `빌드: ${BUILD_DATE}`,
                `환경: ${typeof window !== 'undefined' && (window as any).__APPINTOSS__ ? '앱인토스' : '웹앱'}`,
                `UA: ${typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) + '…' : 'N/A'}`,
                `시각: ${new Date().toISOString()}`,
              ].map((line, i) => (
                <p key={i} className="text-[13px] mb-1" style={{ color: 'rgba(248,245,238,0.65)' }}>{line}</p>
              ))}
              {/* 🚨 2026-07-29 — 무료 운 충전은 빌드 플래그로 차단 (기본 OFF = 출시본 미포함).
                  이전엔 게이트가 '버전 5탭' 뿐이라 **누구나 열어 100운(=5만원 상당)을 무한 획득**할 수 있었다.
                  우리 유료 콘텐츠는 로컬 잔액으로 결제되므로 곧 매출 구멍. 주석은 "출시 후 비노출"이라
                  적혀 있었으나 실제 차단 코드가 없었다.
                  QA 시엔 .env 에 VITE_DEBUG_TOOLS=1 을 켠 로컬 빌드를 쓰거나, 어드민에서 운을 지급한다.
                  ⚠️ 회귀 금지: 이 플래그 없이 잔액 증감 버튼을 노출하지 말 것. */}
              {DEBUG_TOOLS && (
                <>
                  <p className="text-[13.5px] font-bold mt-5 mb-2" style={{ color: C.gold }}>테스트 운 충전 (QA 전용)</p>
                  <p className="text-[13px] mb-2" style={{ color: 'rgba(248,245,238,0.5)' }}>
                    현재 {getBalance()}운, 누를 때마다 +100운 (로컬). VITE_DEBUG_TOOLS=1 빌드에서만 노출.
                  </p>
                  <button type="button"
                    onClick={() => { addPaidBalance(100, 0); _toast.show(`+100운 충전 (현재 ${getBalance()}운)`, 'success'); }}
                    className="w-full py-3 rounded-xl text-[13px] font-bold mb-4"
                    style={{ background: C.gold, color: C.ink }}>
                    테스트 운 +100
                  </button>
                </>
              )}

              <p className="text-[13.5px] font-bold mt-2 mb-2" style={{ color: C.gold }}>프로모션 TEST 호출 (출시 전)</p>
              <p className="text-[13px] mb-3" style={{ color: 'rgba(248,245,238,0.5)' }}>
                TEST_ 코드로 호출돼요 (실지급 아님). 콘솔 "시작하기" 활성화 조건, 
                각 1회 호출 후 콘솔에서 상태 확인. ⚠️ 토스앱(QR)에서만 동작.
              </p>
              <div className="flex gap-2 mb-3">
                <button type="button" disabled={promoBusy}
                  onClick={() => runPromoTest()}
                  className="flex-1 py-3 rounded-xl text-[13px] font-bold"
                  style={{ background: C.gold, color: C.ink, opacity: promoBusy ? 0.5 : 1 }}>
                  7일 완주 100원
                </button>
              </div>
              <button type="button" onClick={() => setShowDebug(false)}
                className="mt-1 w-full py-3 rounded-xl text-[14px] font-bold"
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
