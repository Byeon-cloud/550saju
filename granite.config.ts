import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'saju-500',
  brand: {
    // 2026-06-11 브랜드 확정: "사주500" (띄어쓰기 없음).
    // ⚠️ 토스 콘솔 등록 이름과 정확히 일치해야 함 (불일치 시 심사 반려 — 2026-05-09 전례).
    //    콘솔 이름도 "사주500" 으로 변경 필요.
    displayName: '사주500',
    primaryColor: '#B8965A',
    icon: 'https://saju500.app/logo.png',
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'vite',
      // 2026-05-09: 앱인토스 심사 fix — `--mode ait` 로 빌드 시 토스페이먼츠 PG SDK 가 stub 으로 대체됨.
      // (vite.config.ts 의 alias 분기 — 외부 PG SDK 가 번들에 포함되면 정책 위반)
      build: 'vite build --mode ait',
    },
  },
  permissions: [
    { name: 'clipboard', access: 'read' },
    { name: 'clipboard', access: 'write' },
  ],
});
