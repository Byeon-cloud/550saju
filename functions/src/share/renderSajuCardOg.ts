/**
 * #saju-card-share Stage 4 · /saju-card/:profileId SSR OG 엔드포인트
 *
 * 근거: docs/prd/P2_Path_E_티켓_트래커.md E32 + #saju-card-share Stage 3
 *
 * 동작:
 *   - 봇 UA (카카오톡/페이스북/트위터/슬랙 등)
 *     → 서버 SSR OG 메타 HTML. og:image 는 동적 PNG 엔드포인트 참조.
 *   - 사람 UA → /index.html self-fetch (SPA 가 클라이언트에서 SajuCardPage 라우트 처리)
 *
 * 데이터 한계:
 *   - 프로필은 localStorage 전용 (Firestore 미저장) → 서버는 profileId 만으로 정보 조회 불가.
 *   - 해결: 공유 URL 에 query string 으로 name(n) + ilju(i) 전달
 *     예: /saju-card/abc123?n=%ED%99%8D%EA%B8%B8%EB%8F%99&i=%E8%BE%9B%E4%BA%A5
 *   - profileId 는 SPA 진입 후 본인 카드 매칭용 (다른 사람 클릭 시 fallback /storage)
 *   - 2026-10-26 — n(이름)은 더 쓰지 않는다. 10-15 부터 공유 링크에 이름을 넣지 않아 새 링크는 모두 이름이 비어 있었고,
 *     그때 제목이 '내님의 사주 카드'(띄어쓰기도 틀린 말)로 나가 그림('나의 사주 카드')과 달랐다. 옛 링크의 n 도 아무 글자나
 *     넣을 수 있는 값이라 제목과 그림 모두 '나의 사주 카드'로 맞춘다. i 는 60갑자 일주만 받는다(renderSajuCardOgImage.sajuCardIlju).
 *
 * Firebase Hosting 설정 필요 (firebase.json):
 *   rewrites:
 *     - { source: "/api/saju-card-og.png", function: "renderSajuCardOgImage" }
 *     - { source: "/saju-card/**", function: "renderSajuCardOg" }
 *     - { source: "/share/**", function: "renderShareOg" }
 *     - { source: "**", destination: "/index.html" }
 *
 * 보존:
 *   - E32 renderShareOg 패턴 그대로 차용 (BOT_UA_RE / escapeHtml / self-fetch fallback)
 *   - E32 함수 자체는 변경 0
 */

import { onRequest } from 'firebase-functions/v2/https';
import { sajuCardIlju, iljuKoOf } from './renderSajuCardOgImage';

/** 봇 UA 식별 — 주요 messenger/SNS 크롤러 (E32 와 동일 정규식) */
const BOT_UA_RE = /bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|linkedinbot|kakaotalk|telegrambot|discordbot|whatsapp|line-poker|google|bing|yandex|baidu/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** /saju-card/:profileId 경로에서 profileId 추출 */
function extractProfileId(path: string): string | null {
  const m = path.match(/^\/saju-card\/([A-Za-z0-9_\-:.]{4,128})\/?$/);
  return m ? m[1] : null;
}

/** 봇 대상 SSR HTML — ilju(검증된 60갑자 일주) 로 만든 OG 메타 */
function buildBotHtml(params: {
  origin: string;
  profileId: string;
  ilju: string;
}): string {
  const { origin, profileId, ilju } = params;
  const shareUrl = `${origin}/saju-card/${profileId}`;

  // 동적 OG PNG URL — 2026-10-26 그림 주소는 ?i=일주 하나만(그림 쪽 캐시 주소와 같게). 일주가 없으면 정적 무료 만세력 그림
  const ogImage = ilju
    ? `${origin}/api/saju-card-og.png?i=${encodeURIComponent(ilju)}`
    : `${origin}/og/manse.jpg`;

  // 카피 — 2026-10-26 그림(renderSajuCardOgImage)과 같은 제목. 예전 설명의 '(500원~)'은 1운 기본 리포트(07-01 폐기) 시절 값이라 뺐다
  const title = '나의 사주 카드';
  const description = ilju
    ? `${iljuKoOf(ilju)}(${ilju}) 일주의 사주 카드예요. 생일만 넣으면 내 사주 카드도 무료로 만들어요.`
    : '사주 여덟 글자와 오행을 한 장에 담은 사주 카드예요. 생일만 넣으면 내 사주 카드도 무료로 만들어요.';

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
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ko_KR">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">

<!-- 카카오톡 스크랩용 -->
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

export const renderSajuCardOg = onRequest(
  { timeoutSeconds: 10, memory: '256MiB', cors: true, invoker: 'public' },
  async (req, res) => {
    try {
      const ua = String(req.headers['user-agent'] || '');
      const path = req.path || req.url || '';
      const profileId = extractProfileId(path.split('?')[0]);

      // profileId 형식이 잘못된 경우: 404
      if (!profileId) {
        res.status(404).send('Not Found');
        return;
      }

      const origin = `https://${req.hostname}`;
      const ilju = sajuCardIlju(req.query.i); // 2026-10-26 — n 은 읽지 않는다(위 머리말)

      // 봇: SSR OG HTML
      if (BOT_UA_RE.test(ua)) {
        res.set('Content-Type', 'text/html; charset=utf-8');
        // 5분 CDN edge cache — 같은 주소면 캐시 hit
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.status(200).send(buildBotHtml({ origin, profileId, ilju }));
        return;
      }

      // 사람: SPA index.html self-fetch (E32 패턴)
      try {
        const indexRes = await fetch(`${origin}/index.html`, {
          headers: { 'User-Agent': 'renderSajuCardOg/1.0 (self-fetch)' },
        });
        const html = await indexRes.text();
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).send(html);
      } catch (err: any) {
        console.error('[renderSajuCardOg] index.html self-fetch 실패:', err);
        res.redirect(302, `${origin}/?_sajuCardFallback=${profileId}`);
      }
    } catch (err: any) {
      console.error('[renderSajuCardOg] 에러:', err);
      res.status(500).send('Internal Server Error');
    }
  },
);
