import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// 2026-05-29 — 앱 버전 SSOT = package.json. 빌드 시 주입 → MyPage 등에 자동 반영 (드리프트 박멸).
import pkg from './package.json';

// 빌드 타겟 분기 (2026-05-09 — 앱인토스 심사 반려 fix)
// `vite build --mode ait` 또는 `process.env.BUILD_TARGET=ait` 일 때:
// 토스페이먼츠 PG SDK 를 stub 으로 대체 (번들에서 완전 제거).
// 기본 (web): 토스페이먼츠 SDK 정상 import.

export default defineConfig(({ mode }) => {
  const isAitBuild = mode === 'ait' || process.env.BUILD_TARGET === 'ait';
  // 빌드 식별자 — 빌드마다 실제 시각 주입 (디버그 시트에서 새 코드 적용 여부 확인용)
  const buildId = new Date().toISOString().replace('T', ' ').slice(0, 16);

  return {
  plugins: [react()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    // Array form 으로 specific alias 먼저 매칭. (object 면 '@' 가 먼저 매칭되어 '@/services/...' 가 안 잡힘)
    alias: [
      // 앱인토스 빌드: 토스페이먼츠 SDK + tossPayments.ts 자체를 stub 으로 대체.
      // 외부 PG SDK 가 번들에 포함되면 앱인토스 정책 위반 → 심사 반려.
      ...(isAitBuild ? [
        { find: '@/services/payment/tossPayments', replacement: path.resolve(__dirname, './src/stubs/tossPaymentsStub.ts') },
        { find: '@tosspayments/tosspayments-sdk', replacement: path.resolve(__dirname, './src/stubs/tossPaymentsSdkStub.ts') },
      ] : []),
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    host: true,
  },
  optimizeDeps: {
    // @apps-in-toss/web-framework 는 정상 번들 (dist-web/index.js = 웹 번들).
    // 구: exclude 했으나 그 결과 런타임에 bare 모듈명 해석 실패 → IAP·공유·광고 전부 죽음.
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      // @apps-in-toss/web-framework 는 번들에 포함 (external 시 런타임 해석 실패).
      //   /config 서브패스만 external — granite.config.ts(Node)용이라 앱 번들과 무관.
      external: ['@apps-in-toss/web-framework/config'],
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
          'vendor-lunar': ['lunar-javascript'],
        },
      },
    },
  },
  };
});
