import { useEffect, useRef, useState } from 'react';
import { isAppintosBuild } from '@/lib/env';
import { AD_BANNER_GROUP_ID } from '@/constants/config';

/**
 * AdSlot — 앱인토스 광고 SDK 래퍼 (#ad-sdk-wire)
 *
 * 호출 조건:
 *  - 앱인토스 빌드(`isAppintosBuild === true`)에서만 컨테이너 마운트
 *  - 무료 컨텐츠(tier='free') 페이지에서만 호출자가 마운트 (자체 게이트 X — 호출자 책임)
 *
 * SDK 로드/attach 실패 시 → silent fallback (placeholder 표시 안 함, 컨테이너만 hide)
 *
 * unit prop 미지정 시 기본 그룹ID = `AD_BANNER_GROUP_ID` (ait.v2.live.e64deec6a7444898)
 */
interface AdSlotProps {
  unit?: string;
  className?: string;
  /** 컨테이너 최소 높이 (SDK 로드 전 layout shift 완화용, default 90) */
  minHeight?: number;
}

export function AdSlot({
  unit = AD_BANNER_GROUP_ID,
  className = '',
  minHeight = 90,
}: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!isAppintosBuild) return;
    if (attachedRef.current || !containerRef.current) return;

    let cancelled = false;
    const sdkName = '@apps-in-toss/' + 'web-framework';

    import(/* @vite-ignore */ sdkName)
      .then((mod: any) => {
        if (cancelled || !containerRef.current) return;
        const TossAds = mod?.TossAds;
        if (!TossAds?.attachBanner) {
          // SDK 버전 호환성 미달 — silent fallback
          setHidden(true);
          return;
        }
        try {
          TossAds.attachBanner(unit, containerRef.current, {
            onError: () => {
              if (cancelled) return;
              setHidden(true);
            },
          });
          attachedRef.current = true;
        } catch {
          setHidden(true);
        }
      })
      .catch(() => {
        // SDK 미설치/로드 실패 — silent fallback (placeholder 노출 X)
        if (!cancelled) setHidden(true);
      });

    return () => {
      cancelled = true;
    };
  }, [unit]);

  // 비-앱인토스 빌드는 렌더 0
  if (!isAppintosBuild) return null;
  // SDK 로드 실패 시 렌더 0 (silent)
  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      role="complementary"
      aria-label="광고 영역"
      className={className}
      style={{
        width: '100%',
        minHeight,
        borderRadius: 12,
      }}
    />
  );
}
