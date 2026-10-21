// PremiumSelectPage — 종합 사주 시작 페이지 (정가 10운, 2026-06-15 까지 런칭 세일 5운)
// 흐름:
//   /premium → ProfilePicker → CTA → spendBalance(actualPrice) → /result/{id}?fresh=1&type=premium
//   ✓ 잔액 충분: 차감 후 결과 페이지 (fresh SSE)
//   ✗ 잔액 부족: 부족 안내 (충전 직접 유도 UI 는 토스 정책 회피로 제거)

import { useState, useMemo } from 'react';
import { INK_HERO_BG, GoldCta, GhostButton, Seal, SectionHead, HJ, SERIF, hanjaNum } from '@/components/hanji/Hanji';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { firstDailyOfferActive, firstDailyOfferEligible, markFirstDailyOfferUsed, OFFER as FIRST_DAILY_OFFER } from '@/services/offers/firstDailyOffer';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSeoMeta } from '@/hooks/useSeoMeta';
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

import { realName } from '@/utils/personName';
export function PremiumSelectPage() {
  usePageTitle('종합사주');
  useSeoMeta({
    description: '10개 운으로 보는 인생 전체 풀이. 정통 명리학 6대 원전 기반 종합사주 프리미엄 리포트, 사주500.',
  });
  const navigate = useNavigate();
  const toast = useToast();
  const sajuCtx = useSajuContext();

  const profiles = useMemo(() => getProfiles(), []);
  // 2026-10-19 — ?profileId= 로 오면 그 사람을 미리 고른다 (오늘의 운세 반값 카드, 충전 뒤 돌아오기). ?autostart=1 이면 '바로 시작' 안내
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<SajuProfile | null>(() => {
    const id = searchParams.get('profileId');
    return id ? (getProfiles().find((x) => x.id === id) || null) : null;
  });
  const autostart = searchParams.get('autostart') === '1';
  const [balance] = useState<number>(getBalance());
  // 2026-10-21 — 광고 손님 9명이 생일을 넣자마자 5,000원 충전 화면으로 가서 아무도 결제하지 않았다(풀이를 한 줄도 못 봄).
  //   처음인 손님은 운이 모자랄 때 바로 충전으로 보내지 않고, 무료 오늘의 운세(받으면 24시간 반값)와 지금 보기 중 고르게 한다
  const [gate, setGate] = useState(() =>
    searchParams.get('gate') === '1' && !!selected && getBalance() < getPremiumPrice().actualPrice && firstDailyOfferEligible());

  function goCharge() {
    if (!selected) return;
    const premiumPricing = getPremiumPrice();
    // 10-19 — 충전을 마치면 이 사람으로 돌아와 '바로 시작' (반값이면 need=5 → 2,500원 묶음이 미리 골라진다)
    navigate(`/charge?need=${premiumPricing.actualPrice}`, { state: { message: `종합사주에 ${premiumPricing.actualPrice}운이 필요해요`, returnTo: `/premium?profileId=${encodeURIComponent(selected.id)}&autostart=1` } });
  }

  function startPremium() {
    if (!selected) {
      toast.show('사주를 먼저 선택해주세요', 'info');
      return;
    }
    if (getBalance() < getPremiumPrice().actualPrice && firstDailyOfferEligible()) {
      setGate(true);
      return;
    }
    // 🚨 2026-07-14 기준 v2 — 유료 생성은 반드시 '현행 기준' 재계산 우선. 저장 캐시(sajuData)는
    //   옛 기준(-32분·서머타임 누락·자시 일주) 계산본일 수 있어 폴백으로만 사용.
    let sajuData: any = null;
    try { sajuData = selected.input ? calculateSaju(selected.input as any) : null; } catch { /* 폴백으로 */ }
    if (!sajuData) sajuData = (selected as any).sajuData || null;
    if (!sajuData) {
      toast.show('사주 계산 실패. 다시 시도해주세요', 'warning');
      return;
    }
    // 2026-05-28 PM — SSOT 가격 사용 (10운 정가, 5운 세일 ~2026-06-15)
    const premiumPricing = getPremiumPrice();
    const spent = spendBalance(premiumPricing.actualPrice);
    if (!spent) {
      toast.show('잔액이 부족해요', 'warning');
      goCharge();
      return;
    }
    // 10-19 — 첫 오늘의 운세 반값으로 샀으면 표시 (다시 반값 안 되게, 서버 요청에 offer 가 붙게)
    const usedOffer = premiumPricing.actualPrice === FIRST_DAILY_OFFER.price && firstDailyOfferActive();
    if (usedOffer) markFirstDailyOfferUsed();
    // 측정 — 운 차감 성공 직후 (C1 · fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'premium', amount: premiumPricing.actualPrice, ...(usedOffer ? { offer: FIRST_DAILY_OFFER.id } : {}) })).catch(() => {});
    // P0 CS — 생성 중 앱 종료 시 운 소실 방지 (결과 저장/에러환불 시 해제, 미해제 시 부팅 자동환불)
    import('@/services/storage/localStore').then(m => m.markPendingSpend('premium', premiumPricing.actualPrice)).catch(() => {});

    toast.show(`${premiumPricing.actualPrice}운 차감 (잔액 ${getBalance()}운): 종합사주를 시작해요`, 'success');
    sajuCtx.setInput(selected.input as any);
    sajuCtx.setSajuData(sajuData);
    // Phase 4 (2026-05-27) — LoadingPage 우회, 결과 페이지 직진 + fresh SSE
    const newId = generateId();
    navigate(`/result/${newId}?fresh=1&type=premium`, { replace: true });
  }

  // 등록된 사주 0건 → 무엇을 받는지 먼저 보여 주고 입력으로 (2026-10-20 — 메타 광고 V4 가 처음 온 사람을 이 화면으로 보낸다.
  //   예전에는 '먼저 사주를 넣어 주세요' 한 줄뿐이라 광고에서 본 '열 장'이 무엇인지 알 수 없었다)
  if (profiles.length === 0) {
    const p = getPremiumPrice();
    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="종합사주" />
        <PremiumIntro
          price={p.regularPrice}
          offerPrice={FIRST_DAILY_OFFER.enabled ? FIRST_DAILY_OFFER.price : null}
          onStart={() => navigate('/input?from=home_body_premium')}
          onDaily={() => navigate('/daily?from=premium_intro')}
        />
      </div>
    );
  }

  // 2026-05-28 PM — SSOT 가격 (10운 정가, 5운 세일)
  const premiumPriceInfo = getPremiumPrice();
  const premiumPrice = premiumPriceInfo.actualPrice;
  const enough = balance >= premiumPrice;

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="종합사주" />

      {/* Hero — ExtensionHero 패턴 통일 (gradient + 한자 워터마크 + seal + crumb + tier 칩) */}
      <FadeIn>
        <header
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '18px 20px 28px',
            color: '#FFFFFF',
            background: INK_HERO_BG, // 2026-10-10 v9 먹 머리 (구 PREMIUM_HERO_GRAD)
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'none', // 2026-10-10 v9 — 큰 한자 워터마크 제거
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
              fontSize: 13,
              opacity: 0.78,
              marginBottom: 8,
              position: 'relative',
              letterSpacing: '0.02em',
            }}
          >
            평생 한 번 읽는 종합사주
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              fontSize: 13.5,
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
                borderRadius: 2,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              종합사주
            </span>
            {/* 2026-05-28 PM — 세일 chip (10운 → 5운 런칭 세일 ~ 2026-06-15) */}
            {(() => {
              const p = getPremiumPrice();
              if (p.isOnSale && p.salePrice != null) {
                return (
                  <>
                    <span style={{ background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: 2, fontSize: 13, textDecoration: 'line-through', opacity: 0.7 }}>
                      {p.regularPrice}운
                    </span>
                    <span style={{ background: 'rgba(244,209,102,0.30)', color: '#F4D166', padding: '3px 10px', borderRadius: 2, fontSize: 13, fontWeight: 800 }}>
                      {p.saleBadge} {p.salePrice}운
                    </span>
                  </>
                );
              }
              return (
                <span style={{ background: 'rgba(255,255,255,0.14)', padding: '3px 10px', borderRadius: 2, fontSize: 13 }}>
                  {p.regularPrice}운
                </span>
              );
            })()}
            <span
              style={{
                background: 'rgba(255,255,255,0.14)',
                padding: '3px 10px',
                borderRadius: 2,
                fontSize: 13,
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
            한 사주의 기운을<br />처음부터 끝까지 풀어 드려요
          </h1>
          <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 4, position: 'relative' }}>
            원국, 천간과 지지, 십성, 용신, 대운, 연운, 신살, 관계, 주제, 실천까지 열 장으로 깊이 풀어요.
          </div>
        </header>
      </FadeIn>

      <div className="px-5 pt-5 space-y-5">
        {/* 잔액 — 표시만 (충전 직접 유도 버튼 제거: 토스 정책 회피) */}
        <FadeIn delay={0.03}>
          <div
            className="py-3 px-4 rounded-xl flex items-center justify-between"
            style={{
              background: '#FFFDF8',
              border: '1px solid #E1D7C4',
            }}
          >
            <p className="text-caption text-text-muted">내 잔액</p>
            <p
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: enough ? '#1A1612' : '#A23A2A',
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
                {realName(selected.name) ? <><span className="font-bold">{realName(selected.name)}</span> 님 선택됨</> : <><span className="font-bold">내 사주</span> 선택됨</>}
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
          {autostart && enough && (
            <p style={{ fontSize: 14.5, fontWeight: 700, color: '#1A1A1A', textAlign: 'center', margin: '0 0 8px' }}>충전됐어요. 아래를 누르면 바로 풀어 드려요.</p>
          )}
          <Button
            onClick={startPremium}
            variant="gold"
            size="lg"
            fullWidth
            sub={enough
              ? premiumPriceInfo.isOnSale && premiumPriceInfo.salePrice != null
                ? `${premiumPriceInfo.saleBadge} ${premiumPrice}운`
                : `${premiumPrice}운`
              : `지금 ${balance}운`}
          >
            {enough ? '종합사주 시작하기' : '운을 채우고 시작하기'}
          </Button>
        </div>
      )}

      {/* 2026-10-21 — 처음인 손님의 결제 전 갈림길 (위 startPremium 설명) */}
      {gate && selected && (
        <div role="dialog" aria-modal="true" onClick={() => setGate(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 520, background: HJ.paper, borderRadius: '20px 20px 0 0', padding: '22px 20px 30px' }}>
            <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: HJ.ink }}>처음이라면 무료로 먼저 받아 보세요</div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2, marginTop: 8 }}>
              오늘의 운세를 무료로 받으면 24시간 동안 종합사주를 {FIRST_DAILY_OFFER.price}운에 볼 수 있어요. 지금 바로 보려면 {premiumPrice}운이에요.
            </p>
            <GoldCta style={{ marginTop: 16 }} sub="하루 한 번 무료"
              onClick={() => navigate(`/daily?profileId=${encodeURIComponent(selected.id)}&from=premium_gate`)}>
              무료 오늘의 운세 받기
            </GoldCta>
            <GhostButton style={{ marginTop: 10 }} sub={`${premiumPrice}운`} onClick={() => { setGate(false); goCharge(); }}>
              지금 종합사주 보기
            </GhostButton>
          </div>
        </div>
      )}
    </div>
  );
}

/* 종합사주 열 장 — 결과 화면(PremiumResult.tsx CollapsibleSection 의 title, hint)과 같은 말. 장을 바꾸면 여기도 같이 */
const CHAPTERS: [string, string][] = [
  ['원국', '태어난 해, 달, 날, 시의 여덟 글자'],
  ['천간과 지지', '위로 드러난 마음과 아래에 깔린 본능'],
  ['십성', '사람과 돈, 일을 대하는 방식 열 가지'],
  ['용신과 조후', '내 사주에 모자라 채워야 할 색, 방위, 계절, 습관'],
  ['대운', '10년마다 바뀌는 큰 운과 지금 지나는 대운'],
  ['연운', '올해와 다가오는 해의 흐름'],
  ['신살', '사주에 자리한 신살과 그 쓰임'],
  ['내 사주의 기운', '여덟 글자를 한 줄로, 강점 세 가지와 조심할 점 세 가지'],
  ['여섯 영역 한눈에', '재물, 사랑, 직업, 건강, 인간관계, 학업'],
  ['실천', '오늘부터 바꾸어 볼 다섯 가지'],
];

/** 사주를 아직 넣지 않은 사람에게 — 무엇을 받는지, 얼마인지, 무료로 먼저 맛보는 길 */
function PremiumIntro({ price, offerPrice, onStart, onDaily }: { price: number; offerPrice: number | null; onStart: () => void; onDaily: () => void }) {
  return (
    <div>
      <header style={{ padding: '26px 20px 28px', color: '#F4EFE4', background: INK_HERO_BG }}>
        <div style={{ fontSize: 13.5, color: '#CFC6B6', fontWeight: 700 }}>종합사주는 평생 한 번 읽으면 돼요</div>
        <h1 style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 700, lineHeight: 1.4, marginTop: 8, letterSpacing: '-0.02em' }}>
          타고난 성격부터 10년 대운까지<br />열 장으로 풀어 드려요
        </h1>
        <p style={{ fontSize: 15, color: '#E4DCCD', marginTop: 8, lineHeight: 1.7 }}>
          생일과 태어난 시간으로 내 사주를 처음부터 끝까지 봐요. {price}운이에요.
        </p>
      </header>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 20px 120px' }}>
        {/* 2026-10-21 — 처음 온 광고 손님에게는 무료를 앞에 (생일을 넣자마자 5,000원 화면으로 간 9명이 모두 나감) */}
        {offerPrice != null ? (
          <>
            <p style={{ fontSize: 15, color: HJ.ink, lineHeight: 1.7, marginBottom: 12 }}>
              처음이라면 오늘의 운세를 먼저 무료로 받아 보세요. 받은 뒤 24시간 동안은 종합사주를 {offerPrice}운에 볼 수 있어요.
            </p>
            <GoldCta onClick={onDaily} sub="하루 한 번 무료">무료 오늘의 운세부터 받기</GoldCta>
            <GhostButton style={{ marginTop: 10 }} onClick={onStart} sub={`${price}운`}>바로 종합사주 시작하기</GhostButton>
          </>
        ) : (
          <GoldCta onClick={onStart} sub="1분이면 끝나요">생일 넣고 시작하기</GoldCta>
        )}
        <SectionHead title="열 장에 이런 걸 풀어 드려요" style={{ marginTop: 28 }} />
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {CHAPTERS.map(([t, d], i) => (
            <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: `1px solid ${HJ.line}` }}>
              <Seal size={26} fontSize={13}>{hanjaNum(i + 1)}</Seal>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: HJ.ink }}>{t}</div>
                <div style={{ fontSize: 14.5, color: HJ.ink2, lineHeight: 1.6, marginTop: 2 }}>{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
