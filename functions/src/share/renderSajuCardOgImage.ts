/**
 * #saju-card-share Stage 4 · /api/saju-card-og.png 동적 OG 이미지
 *
 * 입력: query string `n` (name) + `i` (ilju 한자 2글자)
 * 출력: 1200×630 PNG (카톡/페이스북/트위터 권장 카드형 사이즈)
 *
 * 의존성:
 *   - puppeteer-core + @sparticuz/chromium (#61 PDF 서버 인프라 재사용)
 *   - 동적 import 로 모듈 미설치 시 graceful 503 (PDF 와 동일 패턴)
 *
 * 캐시 전략:
 *   - HTTP `Cache-Control: public, max-age=86400, s-maxage=86400` (24h CDN edge)
 *   - 동일 query → 동일 URL → CDN hit (Firebase Hosting CDN 자동 캐싱)
 *   - 동적 PNG 의 의도된 휘발성 (24h 후 재생성) — Storage 영구 캐시는 v2 백로그
 *
 * 한자 폰트 fallback 0:
 *   - Noto Serif KR Google Fonts CDN (preconnect + display=swap)
 *   - networkidle0 + document.fonts.ready 대기 (puppeteer #61 패턴 차용)
 *
 * 디자인 (1200×630):
 *   - 배경 SSOT paper #F8F5EE
 *   - 좌측: SAJU 500 로고 + 타이틀 + 부제 + CTA 카피
 *   - 우측: 일주 한자 큰 박스 (오행 컬러 배경)
 *   - 푸터: 도메인
 */

import { onRequest } from 'firebase-functions/v2/https';

/* ══════════════════════════════════════════════════════════════════
 * 천간 → 오행 컬러 매핑 (SSOT 정렬)
 * ═════════════════════════════════════════════════════════════════ */
const GAN_OHENG_COLOR: Record<string, { color: string; oheng: string }> = {
  甲: { color: '#2D8A4E', oheng: '목' }, 乙: { color: '#2D8A4E', oheng: '목' },
  丙: { color: '#D32F2F', oheng: '화' }, 丁: { color: '#D32F2F', oheng: '화' },
  戊: { color: '#F57F17', oheng: '토' }, 己: { color: '#F57F17', oheng: '토' },
  庚: { color: '#757575', oheng: '금' }, 辛: { color: '#757575', oheng: '금' },
  壬: { color: '#1565C0', oheng: '수' }, 癸: { color: '#1565C0', oheng: '수' },
};

/* ══════════════════════════════════════════════════════════════════
 * 안전 이스케이프
 * ═════════════════════════════════════════════════════════════════ */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ══════════════════════════════════════════════════════════════════
 * 1200×630 OG HTML 템플릿
 * ═════════════════════════════════════════════════════════════════ */
function buildOgHtml(name: string, ilju: string): string {
  const gan = ilju.charAt(0);
  const meta = GAN_OHENG_COLOR[gan];
  const accentColor = meta?.color ?? '#B8965A';
  const ohengLabel = meta?.oheng ?? '';

  const safeName = name || '나';
  const safeIlju = ilju || '命';
  const subline = ohengLabel
    ? `일주 ${esc(ilju)}, ${esc(ohengLabel)} 일간`
    : '사주 카드, 정통 명리학';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&family=Noto+Sans+KR:wght@500;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1200px;
    height: 630px;
    background: #F8F5EE;
    font-family: 'Noto Sans KR', system-ui, sans-serif;
    color: #1A1A1A;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .frame {
    width: 1200px;
    height: 630px;
    padding: 56px 64px;
    display: flex;
    align-items: stretch;
    gap: 56px;
    position: relative;
  }
  /* 골드 인너 보더 */
  .frame::before {
    content: '';
    position: absolute;
    inset: 24px;
    border: 1px solid rgba(184,150,90,0.45);
    border-radius: 18px;
    pointer-events: none;
  }

  .left {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 8px 0;
  }
  .logo {
    font-family: 'Noto Serif KR', serif;
    font-weight: 700;
    font-size: 22px;
    color: #B8965A;
    letter-spacing: 0.3em;
  }
  .title-block {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pill {
    align-self: flex-start;
    background: rgba(184,150,90,0.12);
    border: 1px solid rgba(184,150,90,0.4);
    color: #8C6D3D;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .title {
    font-family: 'Noto Serif KR', serif;
    font-weight: 700;
    font-size: 56px;
    line-height: 1.18;
    color: #1A1A1A;
    letter-spacing: -0.01em;
  }
  .title em {
    font-style: normal;
    color: ${accentColor};
  }
  .subline {
    font-family: 'Noto Serif KR', serif;
    font-size: 21px;
    color: #3D3D3D;
    line-height: 1.5;
    letter-spacing: -0.005em;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: #1A1A1A;
    color: #F8F5EE;
    padding: 14px 24px;
    border-radius: 12px;
    font-size: 18px;
    font-weight: 700;
    align-self: flex-start;
    letter-spacing: -0.005em;
  }
  .cta .arrow {
    color: #B8965A;
    font-size: 20px;
    font-weight: 700;
  }

  .right {
    width: 340px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
  }
  .ilju-box {
    width: 280px;
    height: 320px;
    border-radius: 22px;
    background: ${accentColor}10;
    border: 2px solid ${accentColor}55;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .ilju-char {
    font-family: 'Noto Serif KR', serif;
    font-weight: 900;
    font-size: 200px;
    line-height: 0.9;
    color: ${accentColor};
    letter-spacing: -0.04em;
  }
  .ilju-label {
    position: absolute;
    top: 18px;
    left: 0;
    right: 0;
    text-align: center;
    font-family: 'Noto Serif KR', serif;
    font-size: 13px;
    font-weight: 700;
    color: ${accentColor};
    letter-spacing: 0.2em;
  }
  .domain {
    position: absolute;
    bottom: 36px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 13px;
    color: rgba(122,114,105,0.85);
    letter-spacing: 0.08em;
    font-weight: 500;
  }
</style>
</head>
<body>
<div class="frame">
  <div class="left">
    <div class="logo">SAJU 500</div>
    <div class="title-block">
      <span class="pill">사주 카드</span>
      <h1 class="title">
        <em>${esc(safeName)}</em>님의<br>
        사주 카드를 받아보세요
      </h1>
      <p class="subline">${subline}<br>500원에 만나는 정통 명리학 풀이</p>
    </div>
    <div class="cta">
      카드 보러 가기<span class="arrow">→</span>
    </div>
  </div>

  <div class="right">
    <div class="ilju-box">
      <div class="ilju-label">日 主</div>
      <div class="ilju-char">${esc(safeIlju.charAt(0))}</div>
    </div>
    <div style="font-family: 'Noto Serif KR', serif; font-size: 18px; color: #3D3D3D; letter-spacing: 0.04em;">
      ${esc(safeIlju)}
    </div>
  </div>

  <div class="domain">saju500.app</div>
</div>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════════════════════
 * Puppeteer 동적 import — #61 PDF 서버와 동일 패턴
 * ═════════════════════════════════════════════════════════════════ */
async function loadPuppeteer(): Promise<{ launch: () => Promise<any> } | null> {
  try {
    const [puppeteerCore, chromium] = await Promise.all([
      import('puppeteer-core' as any),
      import('@sparticuz/chromium' as any),
    ]);
    const chrome = (chromium as any).default ?? chromium;
    const launch = async () => {
      const executablePath = await chrome.executablePath();
      return puppeteerCore.launch({
        args: chrome.args,
        defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
        executablePath,
        headless: 'shell',
      });
    };
    return { launch };
  } catch (err: any) {
    console.warn('[renderSajuCardOgImage] puppeteer 미설치:', err?.message);
    return null;
  }
}

/** HTML → 1200×630 PNG Buffer */
async function htmlToPngBuffer(html: string): Promise<Buffer> {
  const pup = await loadPuppeteer();
  if (!pup) throw new Error('PNG 엔진 준비 안 됨');

  const browser = await pup.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    // 폰트 paint 완료 대기
    await page.evaluateHandle('document.fonts.ready');

    const buf: Buffer = await page.screenshot({
      type: 'png',
      omitBackground: false,
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    return buf;
  } finally {
    try { await browser.close(); } catch { /* noop */ }
  }
}

/** 정적 placeholder PNG (puppeteer 미설치 fallback) — 사주500 정사각 로고만 */
function placeholderPngRedirect(origin: string, res: any): void {
  // 빌드 시점 정적 자산 사용 — `/og-image.png` 가 dist 에 있다고 가정
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.redirect(302, `${origin}/og-image.png`);
}

export const renderSajuCardOgImage = onRequest(
  {
    timeoutSeconds: 60,
    memory: '1GiB',
    minInstances: 0,
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
    try {
      const name = String(req.query.n || '').slice(0, 40);
      const ilju = String(req.query.i || '').slice(0, 4);
      const origin = `https://${req.hostname}`;

      const html = buildOgHtml(name, ilju);

      let buf: Buffer;
      try {
        buf = await htmlToPngBuffer(html);
      } catch (err: any) {
        console.warn('[renderSajuCardOgImage] 동적 생성 실패, placeholder fallback:', err?.message);
        placeholderPngRedirect(origin, res);
        return;
      }

      if (!buf || buf.length < 1024) {
        placeholderPngRedirect(origin, res);
        return;
      }

      // 24h CDN edge cache — 동일 (n,i) 조합은 hit
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).send(buf);
    } catch (err: any) {
      console.error('[renderSajuCardOgImage] 에러:', err);
      // 에러 시에도 placeholder 로 fallback (OG 미리보기 깨짐 방지)
      try {
        const origin = `https://${req.hostname}`;
        placeholderPngRedirect(origin, res);
      } catch {
        res.status(500).send('Internal Server Error');
      }
    }
  },
);
