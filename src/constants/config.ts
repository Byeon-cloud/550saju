/**
 * 앱인토스 + 서비스 설정 상수
 * 콘솔에서 발급받은 ID를 여기서 중앙 관리
 */

// ─── 광고 그룹 ID ───
export const AD_BANNER_GROUP_ID = 'ait.v2.live.e64deec6a7444898';
export const AD_REWARDED_GROUP_ID = 'ait.v2.live.3ce03ae6e7f441c2';

// ─── 공유 리워드 ───
export const SHARE_REWARD_MODULE_ID = '0a21ea14-951b-4abb-8484-aaf61b0123b8';

// ─── 프로모션 ───
export const PROMOTION_CODE_LIVE = '01KN9V82GYJZ5C1S3KP4HQA6AY';
export const PROMOTION_CODE_TEST = 'TEST_01KN9V82GYJZ5C1S3KP4HQA6AY';

// ─── 앱 딥링크 ───
export const TOSS_SCHEME = 'intoss://saju500';
export const TOSS_SCHEME_PRIVATE = 'intoss-private://saju500';

// ─── GA4 ───
export const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID || 'G-83SPVQBTKV';
