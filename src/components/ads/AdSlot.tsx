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

// SDK initialize 1회만 (모듈 캐시) — 배너 여러 개여도 init 1번.
let adsInitPromise: Promise<boolean> | null = null;
function ensureAdsInitialized(mod: any): Promise<boolean> {
  if (adsInitPromise) return adsInitPromise;
  adsInitPromise = new Promise<boolean>((resolve) => {
    const TossAds = mod?.TossAds;
    if (!TossAds?.attachBanner) { resolve(false); return; }
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

        const ok = await ensureAdsInitialized(mod);
        if (cancelled || !containerRef.current) return;
        if (!ok) { setHidden(true); return; }

        try {
          const result = TossAds.attachBanner(unit, containerRef.current, {
            variant: 'card',
            callbacks: {
              onAdFailedToRender: () => { if (!cancelled) setHidden(true); },
              onNoFill: () => { if (!cancelled) setHidden(true); },
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
  if (!isAppintosBuild) return null;
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
