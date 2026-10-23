import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
// 2026-05-29 — 앱 버전 SSOT = package.json. 빌드 시 주입 → MyPage 등에 자동 반영 (드리프트 박멸).
import pkg from './package.json';

import aitDevtools from "@apps-in-toss/devtools/unplugin";

// 빌드 타겟 분기 (2026-05-09 — 앱인토스 심사 반려 fix)
// `vite build --mode ait` 또는 `process.env.BUILD_TARGET=ait` 일 때:
// 외부 PG SDK(포트원)를 stub 으로 대체 (번들에서 완전 제거). 토스페이먼츠는 2026-10-14 코드째 제거.

export default defineConfig(({ mode }) => {
  const isAitBuild = mode === 'ait' || process.env.BUILD_TARGET === 'ait';
  // 빌드 식별자 — 빌드마다 실제 시각 주입 (디버그 시트에서 새 코드 적용 여부 확인용)
  const buildId = new Date().toISOString().replace('T', ' ').slice(0, 16);

  // 2026-10-18 — index.html 은 웹과 앱이 같이 쓴다. 웹 전용 애드센스 로더가 6월부터 .ait 에도 들어가 있었다
  //   (앱 광고는 TossAds 만, 로더가 recaptcha, sodar iframe 을 만들어 앱인토스 iframe 금지에 걸릴 수 있음). 앱 빌드에서만 뺀다.
  // 2026-10-23 — 웹 홈 화면 추가(PWA) 태그도 앱 빌드에서 뺀다. 토스 안에서 '홈 화면에 추가'는 토스 밖으로 나가는 길이라
  //   심사 반려 위험이 있다. manifest 링크, apple-touch-icon, apple-mobile-web-app-* 를 지우고(속성 순서와 따옴표가 달라도 잡는다)
  //   theme-color 는 앱이 쓰던 예전 값으로 되돌린다. 하나라도 남으면 빌드를 멈춘다.
  //   public 에서 복사된 manifest.json, 아이콘 파일도 빌드가 끝난 뒤 앱 결과물에서 지운다(closeBundle).
  let aitOutDir = '';
  const stripWebOnlyHtml = {
    name: 'saju500-strip-web-only-html',
    configResolved(c: { root: string; build: { outDir: string } }) {
      aitOutDir = path.resolve(c.root, c.build.outDir);
    },
    transformIndexHtml(html: string) {
      const out = html
        .replace(/<!-- Google AdSense[^\n]*-->\s*/g, '')
        .replace(/<script[^>]*googlesyndication\.com[^>]*><\/script>\s*/g, '')
        .replace(/<!-- 웹 홈 화면 추가[^\n]*-->\s*/g, '')
        .replace(/<link\b(?=[^>]*\brel\s*=\s*["']?(?:manifest|apple-touch-icon(?:-precomposed)?|apple-touch-startup-image)["'\s>])[^>]*>\s*/gi, '')
        .replace(/<meta\b(?=[^>]*\bname\s*=\s*["']?(?:apple-mobile-web-app-[a-z-]+|mobile-web-app-capable)["'\s>])[^>]*>\s*/gi, '')
        .replace(/(<meta\b[^>]*\bname\s*=\s*["']theme-color["'][^>]*\bcontent\s*=\s*["'])[^"']*(["'])/i, '$1#F4F5F8$2');
      if (/rel\s*=\s*["']?(?:manifest|apple-touch-icon)|apple-mobile-web-app-|mobile-web-app-capable/i.test(out)) {
        throw new Error('[saju500] 앱 빌드 index.html 에 홈 화면 추가 태그가 남았어요 (vite.config.ts stripWebOnlyHtml)');
      }
      return out;
    },
    closeBundle() {
      if (!aitOutDir) return;
      for (const rel of ['manifest.json', 'apple-touch-icon.png', 'apple-touch-icon-precomposed.png', 'icons']) {
        try { fs.rmSync(path.join(aitOutDir, rel), { recursive: true, force: true }); } catch { /* 없으면 그대로 */ }
      }
    },
  };

  return {
  plugins: [aitDevtools.vite(), react(), ...(isAitBuild ? [stripWebOnlyHtml] : [])],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
    __APP_VERSION__: JSON.stringify(pkg.version),
    // 2026-06-11 — 빌드타임 타깃 확정 주입 (혼용 금지 게이트의 근거값).
    //   기존엔 미주입 → src/lib/env.ts 가 항상 'webapp' 폴백 + 런타임 UA 에만 의존했음.
    //   ait 빌드 = 'appintos' 확정 → 웹 전용 UI(동의모달·LegalFooter·회원탈퇴)가 앱 번들에서 빌드 레벨 차단.
    'import.meta.env.VITE_BUILD_TARGET': JSON.stringify(isAitBuild ? 'appintos' : 'webapp'),
  },
  resolve: {
    // Array form 으로 specific alias 먼저 매칭. (object 면 '@' 가 먼저 매칭되어 '@/services/...' 가 안 잡힘)
    alias: [
      // 앱인토스 빌드: 외부 PG SDK(포트원)를 stub 으로 대체.
      // 외부 PG SDK 가 번들에 포함되면 앱인토스 정책 위반 → 심사 반려.
      //   2026-06-17 — 포트원(@portone) 추가 누락으로 .ait 에 포함 → 토스 반려. 토스페이먼츠와 동일 처리.
      ...(isAitBuild ? [
        { find: '@/services/payment/portonePayment', replacement: path.resolve(__dirname, './src/stubs/portonePaymentStub.ts') },
        { find: '@portone/browser-sdk/v2', replacement: path.resolve(__dirname, './src/stubs/portoneSdkStub.ts') },
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
