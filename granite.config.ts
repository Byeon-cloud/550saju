import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'saju-500',
  brand: {
    // ⚠️ 토스 콘솔 "앱 정보 등록" 이름과 정확히 일치해야 함 (불일치 시 심사 반려).
    // 2026-06-13 확정: 앱정보 수정 승인 완료 — 콘솔 등록명 = "사주500" (공백 없음 · 브랜드 확정안).
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
