// Phase B (#54) — UI Chrome 4종
// Phase D (#54) — BlurredSection 추가 (PremiumResult 재사용 위해 inline → 본 파일로 이동)
// 스펙: docs/mockups/사주500_UI개편_03_결과.md §4 §6 §7 §14 §3-5 §12

import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShareModal } from '@/components/share/ShareModal';
import { isAppintosBuild } from '@/lib/env';
import { isStandaloneDisplay } from '@/lib/displayMode';
import { AD_BANNER_GROUP_ID } from '@/constants/config';
import { AdSlot } from '@/components/ads/AdSlot';
// 2026-05-29 H1 fix — 업셀 "종합 10운" 하드코딩 → SSOT 세일가 반영 (런칭세일 중 5운).
// 2026-06-29 — report 업셀 "주제별 1운" 하드코딩 → SSOT 최저가 파생 (love/wealth/reunion 3운과 모순 제거).
import { getPremiumPrice, getTopicPrice } from '@/constants/pricing';
import { listTopics } from '@/constants/topics';

/** 홈 화면 앱으로 열렸나 (2026-10-23, 토스 안과 앱 빌드는 false) — 결제 막대의 아래 여백만 바꾼다 */
const STANDALONE_DISPLAY = isStandaloneDisplay();

/* ══════════════════════════════════════════════════════════════════
 * SSOT 토큰 (D1 정렬)
 * ═════════════════════════════════════════════════════════════════ */
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#6F6557',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  goldLine: 'rgba(184,150,90,0.40)',
  line: '#E5DFD0',
  surface: '#FFFFFF',
} as const;

/* ══════════════════════════════════════════════════════════════════
 * §4 PaywallBar — sticky 72px · L2 끝 도달 시 slide-up
 * - 무료(tier='free') + 잠금(locked) 일 때만 노출
 * - 스크롤 viewport 높이의 60% 초과 시 등장 (L2 본문 끝 근사)
 * - 닫기 불가 (스펙 §4)
 * ═════════════════════════════════════════════════════════════════ */
export interface PaywallBarProps {
  tier: 'free' | 'paid';
  locked: boolean;
  /** 10운 충전 또는 결제 모듈 진입 */
  onUnlock: () => void;
  /** 카피 — "10운" / "1운" 등 가변 */
  costLabel?: string;
}

export function PaywallBar({
  tier,
  locked,
  onUnlock,
  costLabel = '10운', // 2026-04-27 4 패키지 정정: 10운 → 15운 (p15 = 10본+5보너스)
}: PaywallBarProps) {
  const [visible, setVisible] = useState(false);
  const enabled = tier === 'free' && locked;

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }
    const onScroll = () => {
      const y = window.scrollY;
      const trigger = window.innerHeight * 0.6;
      setVisible(y > trigger);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="paywall-bar"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          role="region"
          aria-label="유료 풀이 안내"
          style={{
            position: 'fixed',
            // TabBar 높이만큼 위. 2026-10-23 — 홈 화면 앱에서는 아래 홈 막대 여백만큼 더 올린다 (웹 브라우저는 그대로 64)
            bottom: STANDALONE_DISPLAY ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 64,
            left: 0,
            right: 0,
            height: 72,
            background: C.ink,
            color: C.paper,
            zIndex: 60,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              maxWidth: 520,
              margin: '0 auto',
              height: '100%',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.paper,
                  letterSpacing: '-0.01em',
                }}
              >
                더 깊게 보고 싶다면
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(248,245,238,0.6)',
                  marginTop: 2,
                }}
              >
                {costLabel}으로 모든 풀이가 열려요
              </div>
            </div>
            <button
              type="button"
              onClick={onUnlock}
              aria-label={`${costLabel} 결제하고 풀이 열기`}
              style={{
                height: 44,
                padding: '0 20px',
                background: C.paper,
                color: C.ink,
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              열어보기
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §14 ShareSheet — Sprint 1 ShareModal 래퍼
 * - Web Share API + 클립보드 복사 + 카카오 SDK + 이미지 캡처는 ShareModal 내부 보유
 * - 본 wrapper는 prop forward 만 (P2-1 블러 공유 경계 보존)
 * ═════════════════════════════════════════════════════════════════ */
export interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  reportId: string;
  topScore?: { label: string; score: number };
}

export function ShareSheet(props: ShareSheetProps) {
  return <ShareModal {...props} />;
}

/* ══════════════════════════════════════════════════════════════════
 * §6 UpsellCard — 88px · gold-brown-soft · 유료 결과에만 1개
 * - ContentType별 카피 매핑
 * - 무료 결과는 PaywallBar가 그 역할 (§6: 유료 결과에만 노출)
 * ═════════════════════════════════════════════════════════════════ */
export type UpsellContentType =
  | 'topic'
  | 'premium'
  | 'daewoon'
  | 'wolun'
  | 'gunghap'
  | 'tojeong'
  | 'dream_paid'
  | 'report'; // 일반 사주 리포트 유료 → 주제별 추가 구매

interface UpsellCopy {
  title: string;
  /** 가격 라벨 — "프리미엄 10운" / "1운" 등 */
  cost: string;
  /** 클릭 시 이동 경로 */
  path: string;
}

const UPSELL_COPY: Record<UpsellContentType, UpsellCopy> = {
  topic: {
    title: '한 주제 끝냈으니, 사주 전체도 볼래요?',
    cost: '종합 10운',
    path: '/charge?need=10',
  },
  premium: {
    title: '지금 풀이, 사주대화로 바로 질문해보기',
    cost: '대화권',
    path: '/chat/new',
  },
  daewoon: {
    title: '사주 전체 흐름도 이어서 보세요',
    cost: '종합 10운',
    path: '/charge?need=10',
  },
  wolun: {
    title: '사주 전체 흐름도 이어서 보세요',
    cost: '종합 10운',
    path: '/charge?need=10',
  },
  gunghap: {
    title: '사주 전체 흐름도 이어서 보세요',
    cost: '종합 10운',
    path: '/charge?need=10',
  },
  tojeong: {
    title: '사주 전체 흐름도 이어서 보세요',
    cost: '종합 10운',
    path: '/charge?need=10',
  },
  dream_paid: {
    title: '꿈 경향의 뿌리, 사주로 더 깊게',
    cost: '종합 10운',
    path: '/charge?need=10',
  },
  report: {
    // cost 는 SSOT 최저가로 런타임 파생 (아래 costLabel 계산부) — 여기 값은 fallback/표식용.
    title: '주제별 심층 풀이도 이어서 받아보세요',
    cost: '주제별',
    path: '/topic',
  },
};

export interface UpsellCardProps {
  contentType: UpsellContentType;
  /** 클릭 핸들러 — undefined 면 기본 path로 navigate */
  onTap?: () => void;
}

export function UpsellCard({ contentType, onTap }: UpsellCardProps) {
  const copy = UPSELL_COPY[contentType];
  const navigate = useNavigate();
  // 종합사주 업셀("종합 10운")은 SSOT 세일가로 표기. 세일 중: "종합 10운 → 5운".
  const pp = getPremiumPrice();
  let costLabel: string;
  if (copy.cost.includes('종합')) {
    costLabel =
      pp.isOnSale && pp.salePrice != null
        ? `종합 ${pp.regularPrice}운 → ${pp.salePrice}운`
        : `종합 ${pp.regularPrice}운`;
  } else if (copy.cost.includes('주제별')) {
    // report 업셀 → /topic 허브 (특정 토픽 아님). 가격 혼재(현 1~3운) → SSOT 최저가 시작가 표기.
    const minTopicPrice = Math.min(
      ...listTopics().map((t) => getTopicPrice(t.id).actualPrice),
    );
    costLabel = `주제별 ${minTopicPrice}운부터`;
  } else {
    costLabel = copy.cost;
  }

  function handleTap() {
    if (onTap) onTap();
    // 2026-05-04 앱인토스 정책 — window.location.href → SPA navigate
    else navigate(copy.path);
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-label={`${copy.title} (${costLabel})`}
      style={{
        width: '100%',
        minHeight: 88,
        background: C.goldSoft,
        border: `1px solid ${C.goldLine}`,
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: C.ink,
            letterSpacing: '-0.01em',
            lineHeight: 1.4,
          }}
        >
          {copy.title}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 13.5,
            fontWeight: 700,
            color: C.goldDeep,
          }}
        >
          {costLabel}
        </div>
      </div>
      <div
        style={{
          height: 36,
          padding: '0 14px',
          background: 'transparent',
          border: `1px solid ${C.goldDeep}`,
          borderRadius: 10,
          color: C.goldDeep,
          fontSize: 13,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        }}
      >
        보기 →
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §7 AdBanner — 90px · build='appintos' && tier='free' 조건만
 * - locked 와 무관 (블러 상태에서도 노출 OK, 유료 페이지만 차단)
 * - 본 컴포넌트가 자체 조건 분기 — 호출처는 무조건 mount
 * - 실제 SDK 연결은 별도 티켓 (#ad-sdk-wire)
 * ═════════════════════════════════════════════════════════════════ */
export interface AdBannerProps {
  tier: 'free' | 'paid';
  /** 블러 잠금 상태 — 광고 노출 자체는 허용 (스펙 §7), 향후 정책 확장용 prop */
  locked: boolean;
}

export function AdBanner({ tier, locked: _locked }: AdBannerProps) {
  // 자체 조건 분기 — 유료 페이지면 렌더 0, 웹앱 빌드면 렌더 0
  if (tier !== 'free') return null;
  if (!isAppintosBuild) return null;

  // #ad-sdk-wire: TossAds.attachBanner SDK 정식 연결
  // SDK 로드/attach 실패 시 silent fallback (AdSlot 자체 처리)
  return <AdSlot unit={AD_BANNER_GROUP_ID} minHeight={90} />;
}

/* ══════════════════════════════════════════════════════════════════
 * Phase D · BlurredSection — L3·L4 잠금 + 해제 애니메이션
 * - 스펙 §3-5: filter blur(6px) + pointer-events:none + 중앙 오버레이
 * - 스펙 §12: opacity 1→0 600ms · L3·L4 translate-y · Lock→Unlock 120deg 회전 400ms
 *
 * Phase D' 작업 0 (2026-04-26):
 *   "한 주제만 먼저 볼래요 (1운)" Ghost CTA 제거 — 10운 결제했는데 또 1운 추가 결제 = UX 모순.
 *   단일 Primary "10운으로 해제하기" 만 유지. ContentType 별 free → paid 1운/10운 분기는
 *   resolveUnlockTarget()이 외부에서 해결.
 * ═════════════════════════════════════════════════════════════════ */
export interface BlurredSectionProps {
  locked: boolean;
  /** Primary "10운으로 해제하기" 콜백 — 단일 CTA */
  onUnlock: () => void;
  /** Primary 카피 — 기본 "10운으로 해제하기" (2026-04-27 4 패키지 정정: p15 = 10본+5보너스) */
  primaryLabel?: string;
  children: ReactNode;
}

export function BlurredSection({
  locked,
  onUnlock,
  primaryLabel = '10운으로 해제하기',
  children,
}: BlurredSectionProps) {
  return (
    <div style={{ position: 'relative' }}>
      {/* 본문 — locked 시 blur + opacity 감소 */}
      <motion.div
        animate={{
          filter: locked ? 'blur(6px)' : 'blur(0px)',
          opacity: locked ? 0.55 : 1,
        }}
        initial={false}
        transition={{
          filter: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        }}
        style={{ pointerEvents: locked ? 'none' : 'auto' }}
        aria-hidden={locked || undefined}
      >
        {children}
      </motion.div>

      {/* 오버레이 — locked 시 노출. exit 시 Lock→Unlock 120deg 회전 페이드아웃 */}
      <AnimatePresence>
        {locked && (
          <motion.div
            key="blur-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: 60,
              background:
                'linear-gradient(180deg, rgba(248,245,238,0.88) 0%, rgba(248,245,238,0.94) 60%)',
              borderRadius: 16,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 320,
                textAlign: 'center',
                padding: '20px',
              }}
            >
              <motion.div
                key="lock-icon"
                initial={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 120, opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  width: 32,
                  height: 32,
                  margin: '0 auto 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.goldDeep,
                }}
                aria-hidden
              >
                <LockSvg />
              </motion.div>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.ink,
                  margin: '0 0 6px',
                  letterSpacing: '-0.01em',
                }}
              >
                여기서부터 더 깊은 풀이
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: C.inkSoft,
                  lineHeight: 1.55,
                  margin: '0 0 18px',
                }}
              >
                전체 해석은 프리미엄에서 볼 수 있어요
              </p>
              <button
                type="button"
                onClick={onUnlock}
                style={{
                  width: '100%',
                  height: 52,
                  background: C.ink,
                  color: C.paper,
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {primaryLabel}
              </button>
              {/* Phase D' 작업 0: "한 주제만 먼저 볼래요 (1운)" Ghost CTA 제거됨 */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LockSvg() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Phase D · resolveUnlockTarget — ContentType별 결제 경로 분기
 * ═════════════════════════════════════════════════════════════════ */
export type UnlockContentKey =
  | 'report'         // 1운 사주 리포트
  | 'premium'        // 15운 종합 사주 (10본 + 5보너스 = 5,000원)
  | 'topic'          // 1운 주제별
  | 'dream_free'     // 1운 꿈해몽 유료
  | 'daewoon'        // 1운 대운
  | 'wolun'          // 1운 월운
  | 'gunghap'        // 1운 궁합
  | 'tojeong';       // 1운 토정비결

/**
 * locked 결과를 풀어주는 결제 경로 + 비용 라벨 (PaywallBar / BlurredSection 공용)
 *
 * 2026-04-27 4 패키지 정정: 프리미엄 redirect → p15 자동 선택 (need=10).
 *   - 실제 차감: paidUn 10운 (서버 generateReport 에서 차감)
 *   - 결제액: 5,000원 = 15운 (10본 + 5보너스)
 *   - costLabel "15운" — 마케팅 표기, 5운 보너스 포함 사실 강조
 */
export function resolveUnlockTarget(
  key: UnlockContentKey,
  redirectPath?: string,
): { route: string; costLabel: string } {
  const NEED: Record<UnlockContentKey, number> = {
    report: 1,
    premium: 15, // 2026-04-27 정정: 10 → 15 (p15 패키지 = 10본 + 5보너스)
    topic: 1,
    dream_free: 1,
    daewoon: 1,
    wolun: 1,
    gunghap: 1,
    tojeong: 1,
  };
  const need = NEED[key];
  const r = redirectPath
    ? `&redirect=${encodeURIComponent(redirectPath)}`
    : '';
  return {
    route: `/charge?need=${need}${r}`,
    costLabel: `${need}운`,
  };
}
