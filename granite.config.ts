import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'saju-500',
  brand: {
    // ⚠️ 토스 콘솔 "앱 정보 등록" 이름과 정확히 일치해야 함 (불일치 시 심사 반려).
    // 2026-06-12 임시: 콘솔 등록명이 아직 "사주 500"(공백 有) — 앱정보 수정("사주500") 승인 전이라
    //   이번 출시는 "사주 500" 으로 맞춤. 콘솔 이름 변경 승인 후 "사주500" 으로 되돌릴 것.
    displayName: '사주 500',
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
