/**
 * E32 · /share/:id SSR OG 엔드포인트
 *
 * 근거: docs/prd/P2_Path_E_티켓_트래커.md E32 + 프리미엄_티저블러.md
 *
 * 동작:
 *   - 봇 UA (카카오톡·페이스북·트위터·슬랙·디스코드·라인·텔레그램 등)
 *     → 서버가 생성한 OG 메타 HTML 반환. 블러 티저 OG 이미지 + "잠금 해제 →" 카피.
 *   - 사람 UA → Firebase Hosting 의 index.html 을 self-fetch 해서 그대로 전달
 *     (SPA 는 클라이언트에서 `/share/:id` 라우트를 처리).
 *
 * 주의:
 *   - og:image 는 현재 정적 자산 `/og-image.png` (공용) 을 참조.
 *     Phase 2: 리포트별 동적 OG PNG 를 Storage 에 캐싱 (TODO).
 *   - 봇 판별은 UA 문자열만 사용 (IP/헤더 기반 고도화 생략).
 *
 * Firebase Hosting 설정 필요:
 *   rewrites:
 *     - { source: "/share/**", function: "renderShareOg" }
 *     - { source: "**", destination: "/index.html" }  // SPA 폴백
 */

import { onRequest } from 'firebase-functions/v2/https';

/** 봇 UA 식별 — 주요 messenger/SNS 크롤러 */
const BOT_UA_RE = /bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|linkedinbot|kakaotalk|telegrambot|discordbot|whatsapp|line-poker|google|bing|yandex|baidu/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * /share/:id 경로에서 id 추출.
 * Hosting rewrite 가 붙인 원본 경로는 req.path 로 들어옴.
 */
function extractReportId(path: string): string | null {
  const m = path.match(/^\/share\/([A-Za-z0-9_-]{4,64})\/?$/);
  return m ? m[1] : null;
}

/** 봇 대상 SSR HTML — 블러 티저 OG 메타 */
function buildBotHtml(params: { origin: string; reportId: string }): string {
  const { origin, reportId } = params;
  const shareUrl = `${origin}/share/${reportId}`;
  // 티저 고정 카피 — `src/utils/share.ts` shareResult 와 일관
  const title = '사주 결과 — 잠금 해제하고 전체 보기 →';
  const description = '500원에 만나는 정통 명리학. 잠금 해제하면 12개 섹션 전체를 볼 수 있어요.';
  // 정적 OG 이미지 (현재 index.html 과 동일 리소스). Phase 2 동적 OG 전환 예정.
  const ogImage = `${origin}/og-image.png`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="사주500">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="600">
<meta property="og:locale" content="ko_KR">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">

<!-- 카카오톡 스크랩용 (일반 OG 태그로 충분하지만 명시적 타이틀) -->
<meta property="kakao:title" content="${escapeHtml(title)}">
<meta property="kakao:description" content="${escapeHtml(description)}">
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(shareUrl)}">사주500 에서 전체 보기</a></p>
</body>
</html>`;
}

export const renderShareOg = onRequest(
  { timeoutSeconds: 10, memory: '256MiB', cors: true, invoker: 'public' },
  async (req, res) => {
    try {
      const ua = String(req.headers['user-agent'] || '');
      const path = req.path || req.url || '';
      const reportId = extractReportId(path);

      // 리포트 ID 형식 잘못된 경우: SPA 가 알아서 404 처리하도록 넘김
      if (!reportId) {
        res.status(404).send('Not Found');
        return;
      }

      const origin = `https://${req.hostname}`;

      // 봇: SSR OG HTML
      if (BOT_UA_RE.test(ua)) {
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600'); // 5분 CDN 캐시
        res.status(200).send(buildBotHtml({ origin, reportId }));
        return;
      }

      // 사람: SPA index.html self-fetch
      // (firebase.json `/share/**` rewrite 때문에 직접 /share/:id 는 SPA 로 안 떨어짐.
      //  따라서 /index.html 을 명시적으로 가져와서 그대로 전달.)
      try {
        const indexRes = await fetch(`${origin}/index.html`, {
          headers: { 'User-Agent': 'renderShareOg/1.0 (self-fetch)' },
        });
        const html = await indexRes.text();
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).send(html);
      } catch (err: any) {
        console.error('[renderShareOg] index.html self-fetch 실패:', err);
        // 최후 폴백: SPA 홈으로 이동
        res.redirect(302, `${origin}/?_shareFallback=${reportId}`);
      }
    } catch (err: any) {
      console.error('[renderShareOg] 에러:', err);
      res.status(500).send('Internal Server Error');
    }
  }
);
