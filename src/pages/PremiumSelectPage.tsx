// PremiumSelectPage — 종합 사주 시작 페이지 (정가 10운, 2026-06-15 까지 런칭 세일 5운)
// 흐름:
//   /premium → ProfilePicker → CTA → spendBalance(actualPrice) → /loading?type=premium → /result/{id}
//   ✓ 잔액 충분: 차감 후 결과 페이지
//   ✗ 잔액 부족: 부족 안내 (충전 직접 유도 UI 는 토스 정책 회피로 제거)

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getPremiumPrice } from '@/constants/pricing';
import {
  getProfiles,
  getBalance,
  spendBalance,
  generateId,
  type SajuProfile,
} from '@/services/storage/localStore';
import { useSajuContext } from '@/contexts/SajuContext';
import { calculateSaju } from '@/services/saju/calculator';

/** 종합 사주 hero 톤 — ExtensionHero 와 동일한 디자인 패턴 (gradient + 한자 워터마크 + seal + crumb + tier) */
const PREMIUM_HERO_GRAD = 'linear-gradient(135deg,#C9A968 0%,#A8804A 60%,#7A5C30 100%)';

export function PremiumSelectPage() {
  usePageTitle('종합 사주 풀이');
  const navigate = useNavigate();
  const toast = useToast();
  const sajuCtx = useSajuContext();

  const profiles = useMemo(() => getProfiles(), []);
  const [selected, setSelected] = useState<SajuProfile | null>(null);
  const [balance] = useState<number>(getBalance());

  function startPremium() {
    if (!selected) {
      toast.show('사주를 먼저 선택해주세요', 'info');
      return;
    }
    const sajuData =
      (selected as any).sajuData || calculateSaju(selected.input as any);
    if (!sajuData) {
      toast.show('사주 계산 실패. 다시 시도해주세요', 'warning');
      return;
    }
    // 2026-05-28 PM — SSOT 가격 사용 (10운 정가, 5운 세일 ~2026-06-15)
    const premiumPricing = getPremiumPrice();
    const spent = spendBalance(premiumPricing.actualPrice);
    if (!spent) {
      toast.show('잔액이 부족해요', 'warning');
      navigate(`/charge?need=${premiumPricing.actualPrice}`);
      return;
    }
    toast.show(`${premiumPricing.actualPrice}운 차감 (잔액 ${getBalance()}운) — 종합 사주 시작`, 'success');
    sajuCtx.setInput(selected.input as any);
    sajuCtx.setSajuData(sajuData);
    // Phase 4 (2026-05-27) — LoadingPage 우회, 결과 페이지 직진 + fresh SSE
    const newId = generateId();
    navigate(`/result/${newId}?fresh=1&type=premium`, { replace: true });
  }

  // 등록된 사주 0건 → 입력 페이지로 유도
  if (profiles.length === 0) {
    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="종합 사주" />
        <div className="px-5 pt-8 text-center space-y-4">
          <p className="text-h2 text-text-primary">먼저 사주를 입력해주세요</p>
          <p className="text-body-sm text-text-muted">
            사주 데이터가 있어야 종합 사주를 볼 수 있어요.
          </p>
          <Button
            onClick={() => navigate('/input?from=home_body_premium')}
            variant="gold"
            size="lg"
            fullWidth
          >
            사주 입력하러 가기
          </Button>
        </div>
      </div>
    );
  }

  // 2026-05-28 PM — SSOT 가격 (10운 정가, 5운 세일)
  const premiumPriceInfo = getPremiumPrice();
  const premiumPrice = premiumPriceInfo.actualPrice;
  const enough = balance >= premiumPrice;

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="종합 사주" />

      {/* Hero — ExtensionHero 패턴 통일 (gradient + 한자 워터마크 + seal + crumb + tier 칩) */}
      <FadeIn>
        <header
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '18px 20px 28px',
            color: '#FFFFFF',
            background: PREMIUM_HERO_GRAD,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: -18,
              bottom: -40,
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 220,
              fontWeight: 900,
              color: 'rgba(255,255,255,0.07)',
              lineHeight: 1,
              pointerEvents: 'none',
              letterSpacing: '-0.05em',
            }}
          >
            命
          </span>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: 18,
              top: 18,
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.30)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 22,
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            命
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.78,
              marginBottom: 8,
              position: 'relative',
              letterSpacing: '0.02em',
            }}
          >
            사주 500 · 종합 사주
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              fontSize: 12,
              opacity: 0.92,
              flexWrap: 'wrap',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <span
              style={{
                background: 'rgba(255,255,255,0.22)',
                padding: '3px 10px',
                borderRadius: 100,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              종합 사주
            </span>
            {/* 2026-05-28 PM — 세일 chip (10운 → 5운 런칭 세일 ~ 2026-06-15) */}
            {(() => {
              const p = getPremiumPrice();
              if (p.isOnSale && p.salePrice != null) {
                return (
                  <>
                    <span style={{ background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: 100, fontSize: 10, textDecoration: 'line-through', opacity: 0.7 }}>
                      {p.regularPrice}운
                    </span>
                    <span style={{ background: 'rgba(244,209,102,0.30)', color: '#F4D166', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 800 }}>
                      {p.salePrice}운 · {p.saleBadge}
                    </span>
                  </>
                );
              }
              return (
                <span style={{ background: 'rgba(255,255,255,0.14)', padding: '3px 10px', borderRadius: 100, fontSize: 10 }}>
                  {p.regularPrice}운
                </span>
              );
            })()}
            <span
              style={{
                background: 'rgba(255,255,255,0.14)',
                padding: '3px 10px',
                borderRadius: 100,
                fontSize: 10,
              }}
            >
              한국 명리학 6대 원전 기반
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 24,
              fontWeight: 700,
              marginTop: 14,
              letterSpacing: '-0.02em',
              lineHeight: 1.4,
              position: 'relative',
            }}
          >
            한 사주의 결을<br />처음부터 끝까지 풀어드립니다
          </h1>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, position: 'relative' }}>
            원국·천간지지·십성·용신·대운·연운·신살·관계·주제·실천 — 10 섹션 깊이 풀이.
          </div>
        </header>
      </FadeIn>

      <div className="px-5 pt-5 space-y-5">
        {/* 잔액 — 표시만 (충전 직접 유도 버튼 제거: 토스 정책 회피) */}
        <FadeIn delay={0.03}>
          <div
            className="py-3 px-4 rounded-xl flex items-center justify-between"
            style={{
              background: enough ? 'rgba(46,125,50,0.06)' : 'rgba(198,40,40,0.06)',
              border: `1px solid ${enough ? 'rgba(46,125,50,0.20)' : 'rgba(198,40,40,0.20)'}`,
            }}
          >
            <p className="text-caption text-text-muted">내 잔액</p>
            <p
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: enough ? '#2e7d32' : '#c62828',
                fontFeatureSettings: "'tnum'",
              }}
            >
              {balance}운
            </p>
          </div>
        </FadeIn>

        {/* 프로필 선택 */}
        <FadeIn delay={0.05}>
          <ProfilePicker
            onSelect={(p) => setSelected(p)}
            onNew={() => navigate('/input?from=home_body_premium&new=1')}
            title="누구의 사주를 풀어볼까요?"
          />
        </FadeIn>

        {/* 선택된 프로필 표시 */}
        {selected && (
          <FadeIn delay={0.1}>
            <div className="card-gold py-3 px-4 flex items-center justify-between">
              <p className="text-body-sm text-text-primary">
                <span className="font-bold">{selected.name}</span>님 선택됨
              </p>
              <button
                onClick={() => setSelected(null)}
                className="text-caption text-text-muted"
              >
                변경
              </button>
            </div>
          </FadeIn>
        )}
      </div>

      {/* 하단 sticky CTA — 부족 시에만 충전 안내 (직접 충전 페이지 버튼은 제거) */}
      {selected && (
        <div className="sticky-cta-bottom">
          <Button
            onClick={startPremium}
            variant="gold"
            size="lg"
            fullWidth
          >
            {enough
              ? premiumPriceInfo.isOnSale && premiumPriceInfo.salePrice != null
                ? `종합 사주 시작 (${premiumPrice}운 · ${premiumPriceInfo.saleBadge})`
                : `종합 사주 시작 (${premiumPrice}운)`
              : `잔액 부족 (${balance}/${premiumPrice}운)`}
          </Button>
        </div>
      )}
    </div>
  );
}
