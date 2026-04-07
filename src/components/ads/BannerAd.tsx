import { useEffect, useRef } from 'react';
import { isAppsInToss } from '@/services/payment/iapService';
import { AD_BANNER_GROUP_ID } from '@/constants/config';

interface Props {
  className?: string;
}

/**
 * 배너 광고 — 앱인토스에서만 표시
 * 무료 콘텐츠(오늘운세, 꿈해몽) 결과 페이지에 사용
 */
export function BannerAd({ className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef(false);

  useEffect(() => {
    if (!isAppsInToss() || attachedRef.current || !containerRef.current) return;

    const sdkName = '@apps-in-toss/' + 'web-framework';
    import(/* @vite-ignore */ sdkName).then((mod: any) => {
      const TossAds = mod.TossAds;
      if (!TossAds?.attachBanner || !containerRef.current) return;

      try {
        TossAds.attachBanner(AD_BANNER_GROUP_ID, containerRef.current, {
          onError: () => {
            if (containerRef.current) containerRef.current.style.display = 'none';
          },
        });
        attachedRef.current = true;
      } catch {
        // 광고 로드 실패 — 숨김
        if (containerRef.current) containerRef.current.style.display = 'none';
      }
    }).catch(() => {});
  }, []);

  // 웹에서는 렌더링 안 함
  if (!isAppsInToss()) return null;

  return <div ref={containerRef} className={`w-full min-h-[50px] ${className}`} />;
}
