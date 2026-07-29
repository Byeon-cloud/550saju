/**
 * 앱인토스 + 서비스 설정 상수
 * 콘솔에서 발급받은 ID를 여기서 중앙 관리
 */

/* ─── 광고 그룹 ID ───
 * 🚨 2026-07-29 — 테스트 ID 분기 도입. 토스 정책 명문:
 *   "개발 단계에서는 반드시 테스트용 광고 ID를 사용해요.
 *    **실제 광고 ID로 테스트하면 정책 위반으로 간주해 불이익**을 받을 수 있어요."
 *   기존엔 `ait.v2.live.*` 를 하드코딩해 QR 테스트에서도 라이브 광고가 노출·집계됐다
 *   (SSP 제재: 누적 단계식, 중대 위반은 즉시 30일/영구 + 부당 수익 환수 대상).
 * 사용법: QA·QR 테스트 빌드는 `.env` 에 VITE_AD_TEST=1 → 테스트 ID 로 자동 전환.
 *   출시 빌드는 비워둘 것(=라이브). 회귀 금지: 라이브 ID 로 테스트하지 말 것. */
const AD_TEST_MODE = import.meta.env.VITE_AD_TEST === '1';

export const AD_BANNER_GROUP_ID = AD_TEST_MODE
  ? 'ait-ad-test-banner-id'
  : 'ait.v2.live.e64deec6a7444898';
export const AD_REWARDED_GROUP_ID = AD_TEST_MODE
  ? 'ait-ad-test-rewarded-id'
  : 'ait.v2.live.3ce03ae6e7f441c2';

// ─── 공유 리워드 ───
export const SHARE_REWARD_MODULE_ID = '0a21ea14-951b-4abb-8484-aaf61b0123b8';

// ─── 프로모션 ───
export const PROMOTION_CODE_LIVE = '01KN9V82GYJZ5C1S3KP4HQA6AY';
export const PROMOTION_CODE_TEST = 'TEST_01KN9V82GYJZ5C1S3KP4HQA6AY';

// ─── 앱 딥링크 ───
export const TOSS_SCHEME = 'intoss://saju-500';
export const TOSS_SCHEME_PRIVATE = 'intoss-private://saju500';

// ─── GA4 ───
export const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID || 'G-83SPVQBTKV';
