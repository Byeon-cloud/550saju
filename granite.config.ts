/**
 * 앱인토스 프로젝트 설정 — SDK 2.x
 * @see https://developers-apps-in-toss.toss.im/
 *
 * 빌드: npx ait build
 * 테스트: 샌드박스 앱에서 intoss://saju500
 * 배포: npx ait deploy --api-key {KEY}
 */
// @apps-in-toss/web-framework
export default {
  appName: 'saju500',
  brand: {
    displayName: '사주500',
    primaryColor: '#C9A96E',
    icon: 'https://appintoss-saju.web.app/logo.png', // 앱 아이콘은 콘솔에서 별도 업로드
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'vite',
      build: 'tsc -b && vite build',
    },
  },
  outdir: 'dist',
  permissions: [
    { name: 'clipboard', access: 'read' },
    { name: 'clipboard', access: 'write' },
  ],
  webViewProps: {
    type: 'partner',
    bounces: true,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
  },
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
  },
};
