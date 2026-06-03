// scripts/preview-prod.mjs
// Claude Code 미리보기에서 production URL 을 띄우기 위한 redirect 서버.
// localhost:3000/<path> → https://appintoss-saju.web.app/<path> 302 redirect.
// 사용처: .claude/launch.json 의 "Preview Production" config.
//
// 실행: node scripts/preview-prod.mjs
// 또는: npm run preview:prod

import http from 'http';

const PORT = Number(process.env.PORT) || 3000;
const TARGET = 'https://appintoss-saju.web.app';

const server = http.createServer((req, res) => {
  const url = `${TARGET}${req.url}`;
  res.writeHead(302, {
    Location: url,
    'Cache-Control': 'no-store',
  });
  res.end(`Redirecting to ${url}`);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[preview-prod] Redirecting http://localhost:${PORT}/* → ${TARGET}/*`);
});
