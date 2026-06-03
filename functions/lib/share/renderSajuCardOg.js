"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSajuCardOg = void 0;
const https_1 = require("firebase-functions/v2/https");
/** 봇 UA 식별 — 주요 messenger/SNS 크롤러 (E32 와 동일 정규식) */
const BOT_UA_RE = /bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|linkedinbot|kakaotalk|telegrambot|discordbot|whatsapp|line-poker|google|bing|yandex|baidu/i;
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/** /saju-card/:profileId 경로에서 profileId 추출 */
function extractProfileId(path) {
    const m = path.match(/^\/saju-card\/([A-Za-z0-9_\-:.]{4,128})\/?$/);
    return m ? m[1] : null;
}
/** 봇 대상 SSR HTML — name + ilju query 로 개인화된 OG 메타 */
function buildBotHtml(params) {
    const { origin, profileId, name, ilju } = params;
    const shareUrl = `${origin}/saju-card/${profileId}`;
    // 동적 OG PNG URL — name/ilju 그대로 query 전달
    const ogImageQuery = new URLSearchParams();
    if (name)
        ogImageQuery.set('n', name);
    if (ilju)
        ogImageQuery.set('i', ilju);
    const ogImage = `${origin}/api/saju-card-og.png${ogImageQuery.toString() ? '?' + ogImageQuery.toString() : ''}`;
    // 카피 — Stage 3 buildShareTextAndUrl 과 일관
    const safeName = name || '내';
    const title = `${safeName}님의 사주 카드`;
    const description = `${ilju ? `일주 ${ilju} · ` : ''}사주500 에서 풀이 받기 (500원~)`;
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
exports.renderSajuCardOg = (0, https_1.onRequest)({ timeoutSeconds: 10, memory: '256MiB', cors: true, invoker: 'public' }, async (req, res) => {
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
        const name = String(req.query.n || '').slice(0, 40);
        const ilju = String(req.query.i || '').slice(0, 4);
        // 봇: SSR OG HTML
        if (BOT_UA_RE.test(ua)) {
            res.set('Content-Type', 'text/html; charset=utf-8');
            // 5분 CDN edge cache — name+ilju 가 같으면 same URL 으로 캐시 hit
            res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
            res.status(200).send(buildBotHtml({ origin, profileId, name, ilju }));
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
        }
        catch (err) {
            console.error('[renderSajuCardOg] index.html self-fetch 실패:', err);
            res.redirect(302, `${origin}/?_sajuCardFallback=${profileId}`);
        }
    }
    catch (err) {
        console.error('[renderSajuCardOg] 에러:', err);
        res.status(500).send('Internal Server Error');
    }
});
//# sourceMappingURL=renderSajuCardOg.js.map