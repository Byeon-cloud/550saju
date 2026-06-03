// scripts/preview-prod-local.mjs
// Production 빌드 (dist/web) 를 localhost:3000 에서 정적 서빙.
// 코드는 100% production 과 동일 (vite build → ait build 결과 그대로).
// Cloud Functions 호출은 us-central1 production 으로 감.
// SPA fallback: React Router routes (/daily 등) → index.html 반환.
//
// 실행: npm run preview:prod

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// 1순위: 현재 cwd 의 dist/web (메인 repo · 일반 사용)
// 2순위: 메인 repo 절대 경로 (worktree 에서 호출 시 fallback)
const CANDIDATES = [
  path.resolve(__dirname, '..', 'dist', 'web'),
  'D:/550saju/dist/web',
];
const DIST = CANDIDATES.find((p) => fs.existsSync(p)) || CANDIDATES[0];
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
};

if (!fs.existsSync(DIST)) {
  console.error(`[preview-prod] ERROR: ${DIST} 없음. 먼저 빌드해주세요:`);
  console.error(`  cd "${path.resolve(__dirname, '..')}"`);
  console.error(`  npm run build && npx ait build`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  } catch {
    pathname = '/';
  }
  // 보안: ../ 차단
  if (pathname.includes('..')) {
    res.writeHead(400); res.end('Bad request'); return;
  }
  let filePath = path.join(DIST, pathname);
  // 디렉터리 → index.html
  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch { /* not exists, will try SPA fallback below */ }

  // SPA fallback: 파일 없으면 index.html 반환 (React Router)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500); res.end('Server error: ' + err.message); return;
    }
    // 2026-05-07 — 빌드 후 옛 chunk 캐시 문제 방지 (dev/preview 환경에서만)
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[preview-prod] Serving production build`);
  console.log(`  Source: ${DIST}`);
  console.log(`  URL:    http://localhost:${PORT}/`);
  console.log(`  Note:   Cloud Functions 호출은 production us-central1 으로 갑니다.`);
});
