/**
 * E32 · /share/* SSR OG 엔드포인트
 *
 * 2026-05-28 PM v3 — type-aware 재작성
 *   · URL 패턴 확장:
 *     - /share/daily/:id     → 오늘의 운세
 *     - /share/dream/:id     → 꿈해몽
 *     - /share/topic/:tid/:id → 주제운 (tid = love/wealth/career/...)
 *     - /share/premium/:id   → 종합사주
 *     - /share/:id (레거시)  → 기본 사주 결과
 *   · 콘텐츠별 OG title/description/image 분기
 *   · "잠금 해제 →" commercial 카피 박멸 → 정직·명리학적 톤
 *
 * 근거: docs/prd/P2_Path_E_티켓_트래커.md E32 + 프리미엄_티저블러.md
 *
 * 동작:
 *   - 봇 UA (카카오톡·페이스북·트위터·슬랙·디스코드·라인·텔레그램 등)
 *     → 콘텐츠 타입별 OG 메타 HTML 반환
 *   - 사람 UA → Firebase Hosting 의 index.html self-fetch (SPA 클라 라우팅)
 *
 * Firebase Hosting 설정:
 *   rewrites:
 *     - { source: "/share/**", function: "renderShareOg" }
 *     - { source: "**", destination: "/index.html" }
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/** 봇 UA 식별 — 주요 messenger/SNS 크롤러 */
const BOT_UA_RE = /bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|linkedinbot|kakaotalk|telegrambot|discordbot|whatsapp|line-poker|google|bing|yandex|baidu/i;

// 2026-10-17 — result, compat, monthly, tojung, weekly, daeun 추가. 공유 모달(ShareModal)은 종류 없이 /share/result/{id} 를 만드는데
//   여기서 모양을 몰라 웹 링크가 전부 404 였다(월운세, 신년운세, 주간운세, 궁합, 대운). 앱 안 링크는 SPA 라우트라 괜찮았다.
type ShareType = 'daily' | 'dream' | 'topic' | 'premium' | 'result' | 'compat' | 'monthly' | 'tojung' | 'weekly' | 'daeun';

interface ParsedShare {
  type: ShareType;
  reportId: string;
  topicId?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const TOPIC_RE = /^[a-z]{3,16}$/;

/**
 * /share/... 경로 파싱.
 *   /share/daily/{id}        → { type: 'daily', reportId }
 *   /share/dream/{id}        → { type: 'dream', reportId }
 *   /share/topic/{tid}/{id}  → { type: 'topic', topicId, reportId }
 *   /share/premium/{id}      → { type: 'premium', reportId }
 *   /share/{id}              → { type: 'result', reportId } (레거시)
 */
function parseSharePath(path: string): ParsedShare | null {
  // /share/topic/{tid}/{id}
  let m = path.match(/^\/share\/topic\/([a-z]{3,16})\/([A-Za-z0-9_-]{4,64})\/?$/);
  if (m) return { type: 'topic', topicId: m[1], reportId: m[2] };
  // /share/{type}/{id}
  m = path.match(/^\/share\/(daily|dream|premium|result|compat|monthly|tojung|weekly|daeun)\/([A-Za-z0-9_-]{4,64})\/?$/);
  if (m) return { type: m[1] as ShareType, reportId: m[2] };
  // /share/{id} (레거시)
  m = path.match(/^\/share\/([A-Za-z0-9_-]{4,64})\/?$/);
  if (m && ID_RE.test(m[1])) return { type: 'result', reportId: m[1] };
  return null;
}

/** 토픽 ID → 한국어 라벨 (서버 SSOT — client TOPIC_REGISTRY 와 일치) */
const TOPIC_LABEL_MAP: Record<string, string> = {
  love: '연애운',
  reunion: '재회운',
  marriage: '결혼운',
  wealth: '재물운',
  exam: '합격 이직운',
  business: '사업운',
  health: '건강운',
  move: '이사 이동운',
  study: '학업운',
  career: '직업운',
};

/** 콘텐츠 타입별 OG 메타 SSOT — 정직·초대형 톤.
 *  2026-05-29 H4 fix — 콘텐츠별 OG PNG(og-daily/dream/topic/premium.png) 미존재(404 깨짐) →
 *    현존 og-image.png 1종으로 폴백. (Phase 2: 콘텐츠별 동적 OG PNG 생성)
 *  설명도 share.ts 초대형 카피와 일관 ("당신도 받아보세요" — 받는 사람 본인 사주가 주인공). */
const OG_IMAGE_FALLBACK = '/og-image.png';
const TYPE_TITLE: Record<string, [string, string]> = {
  compat: ['궁합', '두 사람의 사주로 궁합을 봤어요. 점수와 총평을 볼 수 있어요.'],
  monthly: ['월운세', '이번 달 흐름을 사주로 날짜까지 봤어요. 내 한 달도 사주로 확인해 보세요.'],
  tojung: ['신년운세', '새해 열두 달을 사주로 봤어요. 내 새해 운세도 확인해 보세요.'],
  weekly: ['주간운세', '이번 주 흐름을 사주로 봤어요. 내 한 주도 확인해 보세요.'],
  daeun: ['대운', '십 년마다 바뀌는 큰 흐름을 사주로 봤어요. 내 대운도 확인해 보세요.'],
};
function getOgMeta(parsed: ParsedShare, compat?: CompatShareDoc | null): { title: string; description: string; image: string } {
  const { type, topicId } = parsed;
  if (type === 'compat' && compat) {
    return {
      title: `${compat.n1} 님과 ${compat.n2} 님의 궁합 ${compat.score}점 | 사주500`,
      description: compat.head || '두 사람의 사주로 궁합을 봤어요. 점수와 총평을 볼 수 있어요.',
      image: OG_IMAGE_FALLBACK,
    };
  }
  if (TYPE_TITLE[type]) return { title: `${TYPE_TITLE[type][0]} | 사주500`, description: TYPE_TITLE[type][1], image: OG_IMAGE_FALLBACK };
  switch (type) {
    case 'daily':
      return {
        title: '오늘의 운세 — 사주500',
        description: '오늘의 운세를 사주로 받아봤어요. 당신의 오늘도 무료로 확인해보세요.',
        image: OG_IMAGE_FALLBACK,
      };
    case 'dream':
      return {
        title: '꿈해몽 — 사주500',
        description: '간밤의 꿈을 사주로 풀어봤어요. 당신의 꿈도 무료로 해몽받아보세요.',
        image: OG_IMAGE_FALLBACK,
      };
    case 'topic': {
      const label = (topicId && TOPIC_LABEL_MAP[topicId]) || '주제 분석';
      return {
        title: `${label} — 사주500`,
        description: `${label}을 사주로 깊이 있게 봤어요. 당신의 ${label}도 사주로 확인해보세요.`,
        image: OG_IMAGE_FALLBACK,
      };
    }
    case 'premium':
      return {
        title: '종합사주 — 사주500',
        description: '평생 사주를 정통 명리학으로 풀어봤어요. 당신의 사주도 만나보세요.',
        image: OG_IMAGE_FALLBACK,
      };
    default:
      return {
        title: '사주500 — 정통 명리학 AI 사주 풀이',
        description: '500원에 만나는 정통 사주 풀이. 당신의 사주도 받아보세요.',
        image: OG_IMAGE_FALLBACK,
      };
  }
}

/** 봇 대상 SSR HTML — 콘텐츠 타입별 OG 메타 */
interface CompatShareDoc { n1: string; n2: string; score: number; head?: string }
async function readCompatShare(id: string): Promise<CompatShareDoc | null> {
  try {
    const snap = await admin.firestore().doc(`compatShares/${id}`).get();
    if (!snap.exists) return null;
    const d = snap.data() as any;
    return { n1: String(d.n1 || '나'), n2: String(d.n2 || '상대'), score: Number(d.score) || 0, head: String(d.head || '') };
  } catch { return null; }
}

function buildBotHtml(params: { origin: string; parsed: ParsedShare; compat?: CompatShareDoc | null }): string {
  const { origin, parsed } = params;
  const meta = getOgMeta(parsed, params.compat);
  const shareUrl = `${origin}${
    parsed.type === 'result'
      ? `/share/${parsed.reportId}`
      : parsed.type === 'topic'
        ? `/share/topic/${parsed.topicId}/${parsed.reportId}`
        : `/share/${parsed.type}/${parsed.reportId}`
  }`;
  // og:image — 콘텐츠별 정적 이미지 (Phase 2: 동적 PNG)
  // Phase 1 fallback — 콘텐츠별 OG 이미지 미존재 시 default /og-image.png
  const ogImage = `${origin}${meta.image}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="사주500">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta property="og:title" content="${escapeHtml(meta.title)}">
<meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="600">
<meta property="og:locale" content="ko_KR">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(meta.title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">

<!-- 카카오톡 스크랩용 -->
<meta property="kakao:title" content="${escapeHtml(meta.title)}">
<meta property="kakao:description" content="${escapeHtml(meta.description)}">
</head>
<body>
<h1>${escapeHtml(meta.title)}</h1>
<p>${escapeHtml(meta.description)}</p>
<p><a href="${escapeHtml(shareUrl)}">사주500 에서 보기</a></p>
</body>
</html>`;
}

export const renderShareOg = onRequest(
  { timeoutSeconds: 10, memory: '256MiB', cors: true, invoker: 'public' },
  async (req, res) => {
    try {
      const ua = String(req.headers['user-agent'] || '');
      const path = req.path || req.url || '';
      const parsed = parseSharePath(path);

      // 패턴 매치 안 됨 → 404
      if (!parsed) {
        res.status(404).send('Not Found');
        return;
      }

      // ID/topicId 형식 한 번 더 검증 (defensive)
      if (!ID_RE.test(parsed.reportId)) {
        res.status(404).send('Not Found');
        return;
      }
      if (parsed.topicId && !TOPIC_RE.test(parsed.topicId)) {
        res.status(404).send('Not Found');
        return;
      }

      const origin = `https://${req.hostname}`;

      // 봇: SSR OG HTML
      if (BOT_UA_RE.test(ua)) {
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600'); // 5분 CDN 캐시
        const compat = parsed.type === 'compat' ? await readCompatShare(parsed.reportId) : null;
        res.status(200).send(buildBotHtml({ origin, parsed, compat }));
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
        res.redirect(302, `${origin}/?_shareFallback=${parsed.reportId}`);
      }
    } catch (err: any) {
      console.error('[renderShareOg] 에러:', err);
      res.status(500).send('Internal Server Error');
    }
  }
);
