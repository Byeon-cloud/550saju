import { useEffect, useRef, useState } from 'react';
import { isAppintosBuild } from '@/lib/env';
import { AD_BANNER_GROUP_ID } from '@/constants/config';

/**
 * AdSlot — 앱인토스 배너 광고 래퍼 (#ad-sdk-wire · 2026-06-02 SDK API 정합 재작성)
 *
 * 2026-06-02 fix — 광고가 전혀 안 뜨던 버그:
 *   ① TossAds.initialize() 선행 호출 누락 (SDK 필수) → attachBanner 무동작
 *   ② attachBanner 옵션 shape 오류 — 에러 콜백은 callbacks.onAdFailedToRender/onNoFill 인데
 *      기존 코드는 존재하지 않는 top-level onError 전달
 *   → initialize 1회(모듈 캐시) 후 attachBanner({ variant, callbacks }) 정상 호출.
 *
 * 동작 조건:
 *  - 앱인토스 빌드(isAppintosBuild)에서만 (웹/PC 는 렌더 0)
 *  - 무료 콘텐츠 페이지에서만 호출자가 마운트 (자체 게이트 X — 호출자 책임)
 *  - 광고 없음(no-fill)/실패 시 → silent hide (placeholder 노출 X)
 *  - unit prop 미지정 시 기본 그룹ID = `AD_BANNER_GROUP_ID` (ait.v2.live.e64deec6a7444898)
 */
interface AdSlotProps {
  unit?: string;
  className?: string;
  /** 컨테이너 최소 높이 (SDK 로드 전 layout shift 완화용, default 90) */
  minHeight?: number;
}

/** 광고 측정 (C4 · 2026-06-10) — fire-and-forget. 실패해도 광고 동작·UX 영향 0 */
function trackAd(name: 'ad_impression' | 'ad_click' | 'ad_nofill' | 'ad_fail', unit: string) {
  import('@/services/analytics').then((a) => a.trackEvent(name, { unit })).catch(() => {});
}

// SDK initialize 1회만 (모듈 캐시) — 배너 여러 개여도 init 1번.
let adsInitPromise: Promise<boolean> | null = null;
function ensureAdsInitialized(mod: any): Promise<boolean> {
  if (adsInitPromise) return adsInitPromise;
  adsInitPromise = new Promise<boolean>((resolve) => {
    const TossAds = mod?.TossAds;
    if (!TossAds?.attachBanner) { resolve(false); return; }
    /* 🚨 2026-07-29 — 공식 규정: "광고 SDK 초기화를 호출하기 **전에 반드시 지원 여부를 확인**해야 해요."
     *   배너 API 는 토스앱 5.241.0 이상 지원이며, 미만에서는 "빈 화면이 노출될 수 있으니 반드시 예외 처리".
     *   구 코드는 `typeof initialize !== 'function'` 을 "init 불필요 버전"으로 낙관 처리(=true 반환)했는데,
     *   이는 지원 확인이 아니라 추측이었고 구버전에서 빈 배너 박스가 남는 원인이 될 수 있었다.
     *   isSupported() 가 있으면 그 판정을 우선하고, 없으면 기존 휴리스틱으로 폴백한다. */
    if (typeof TossAds.isSupported === 'function') {
      try {
        if (!TossAds.isSupported()) { resolve(false); return; } // 미지원 → 슬롯 자체를 숨김
      } catch { resolve(false); return; }
    }
    if (typeof TossAds.initialize !== 'function') { resolve(true); return; } // init 불필요 버전
    let settled = false;
    const done = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };
    try {
      TossAds.initialize({
        callbacks: {
          onInitialized: () => done(true),
          onInitializationFailed: () => done(false),
        },
      });
    } catch { done(false); return; }
    // 콜백이 안 오는(이미 init된) 경우 대비 fallback
    setTimeout(() => done(true), 1500);
  });
  return adsInitPromise;
}


/* ─── 웹 = 구글 애드센스 (2026-06-12) ───
 *   앱인토스 광고 자리에 웹에선 AdSense. VITE_ADSENSE_CLIENT(ca-pub-...) + VITE_ADSENSE_SLOT
 *   없으면 렌더 0 (현행 유지) — 준기 애드센스 승인 후 .env 만 채우면 켜짐. */
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined;
let adsenseScriptLoaded = false;

function WebAdSlot({ unit, className, minHeight = 90 }: AdSlotProps) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return;
    if (!adsenseScriptLoaded) {
      adsenseScriptLoaded = true;
      const sc = document.createElement('script');
      sc.async = true;
      sc.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      sc.crossOrigin = 'anonymous';
      document.head.appendChild(sc);
    }
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      trackAd('ad_impression', unit || 'adsense');
    } catch { trackAd('ad_fail', unit || 'adsense'); }
  }, [unit]);
  if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return null;
  return (
    <ins
      ref={ref}
      className={`adsbygoogle ${className || ''}`}
      style={{ display: 'block', minHeight }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

export function AdSlot({
  unit = AD_BANNER_GROUP_ID,
  className = '',
  minHeight = 90,
}: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef(false);
  const destroyRef = useRef<(() => void) | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!isAppintosBuild) return;
    if (attachedRef.current || !containerRef.current) return;
    let cancelled = false;

    import('@apps-in-toss/web-framework')
      .then(async (mod: any) => {
        const TossAds = mod?.TossAds;
        if (!TossAds?.attachBanner) { setHidden(true); return; }

        // 규정 2단계: "배너 광고를 **부착하기 전에 반드시** 지원 여부를 확인해야 해요." (초기화 전 확인과 별개)
        if (typeof TossAds.isSupported === 'function') {
          let supported = false;
          try { supported = !!TossAds.isSupported(); } catch { supported = false; }
          if (!supported) { setHidden(true); return; } // 5.241.0 미만 등 → 빈 박스 대신 슬롯 숨김
        }

        const ok = await ensureAdsInitialized(mod);
        if (cancelled || !containerRef.current) return;
        if (!ok) { setHidden(true); return; }

        try {
          const result = TossAds.attachBanner(unit, containerRef.current, {
            variant: 'card',
            callbacks: {
              // 측정 콜백 (C4) — silent-hide 동작은 그대로 (setHidden 로직 무변경)
              onAdImpression: () => { trackAd('ad_impression', unit); },
              onAdClicked: () => { trackAd('ad_click', unit); },
              onAdFailedToRender: () => { trackAd('ad_fail', unit); if (!cancelled) setHidden(true); },
              onNoFill: () => { trackAd('ad_nofill', unit); if (!cancelled) setHidden(true); },
            },
          });
          attachedRef.current = true;
          destroyRef.current = result?.destroy ?? null;
        } catch {
          if (!cancelled) setHidden(true);
        }
      })
      .catch(() => { if (!cancelled) setHidden(true); });

    return () => {
      cancelled = true;
      try { destroyRef.current?.(); } catch { /* noop */ }
      destroyRef.current = null;
      attachedRef.current = false;
    };
  }, [unit]);

  // 비-앱인토스 빌드는 렌더 0
  if (!isAppintosBuild) return <WebAdSlot unit={unit} className={className} minHeight={minHeight} />;
  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      role="complementary"
      aria-label="광고 영역"
      className={className}
      style={{ width: '100%', minHeight, borderRadius: 12 }}
    />
  );
}
