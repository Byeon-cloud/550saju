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
import { ttiAnimalSvg } from '../tti/ttiAnimalSvg';

/* ══════════════════════════════════════════════════════════════════
 * 천간 → 오행 컬러 매핑 (SSOT 정렬)
 * ═════════════════════════════════════════════════════════════════ */
/* 2026-10-19 v9 수묵 고서로 다시 그림 — 예전 그림은 영문 'SAJU 500', 옛 원색(#2D8A4E 등), 알약 표시, 화살표가 남아 있었다.
 *   오행 색은 전통 안료(송록, 석간주, 황토, 은회, 쪽빛), 일주 지지의 사주500 띠 그림(tti/ttiAnimalSvg)을 함께. */
const GAN_OHENG_COLOR: Record<string, { color: string; oheng: string }> = {
  甲: { color: '#4E7A57', oheng: '나무' }, 乙: { color: '#4E7A57', oheng: '나무' },
  丙: { color: '#B04A38', oheng: '불' }, 丁: { color: '#B04A38', oheng: '불' },
  戊: { color: '#B07F38', oheng: '흙' }, 己: { color: '#B07F38', oheng: '흙' },
  庚: { color: '#7D7870', oheng: '쇠' }, 辛: { color: '#7D7870', oheng: '쇠' },
  壬: { color: '#3E5F82', oheng: '물' }, 癸: { color: '#3E5F82', oheng: '물' },
};
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildOgHtml(name: string, ilju: string): string {
  const gan = ilju.charAt(0);
  const zhi = ilju.charAt(1);
  const meta = GAN_OHENG_COLOR[gan];
  const color = meta?.color ?? '#1A1612';
  const safeName = esc((name || '').trim() || '나');
  const iljuKo = `${GAN_KO[gan] || ''}${ZHI_KO[zhi] || ''}`;
  const animal = zhi ? ttiAnimalSvg(zhi, 92) : '';
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#F4EFE4;font-family:Pretendard,sans-serif;color:#1A1612;word-break:keep-all}
.w{position:absolute;inset:26px;border:2px solid #1A1612;outline:1px solid #1A1612;outline-offset:-8px;border-radius:6px;display:flex;padding:56px 64px;gap:48px}
.l{flex:1;display:flex;flex-direction:column}
.br{font-family:'Noto Serif KR',serif;font-weight:900;font-size:36px}.br b{color:#8C6D3D}
h1{margin-top:58px;font-family:'Noto Serif KR',serif;font-weight:700;font-size:60px;line-height:1.3;letter-spacing:-.03em}
.sub{margin-top:18px;font-size:28px;color:#4B4238;font-weight:600}
.ft{margin-top:auto;font-size:24px;color:#6F6557}
.r{width:330px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.box{width:250px;height:300px;border-radius:18px;background:${color};color:#FFFDF8;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Noto Serif KR',serif;font-weight:900;font-size:112px;line-height:1.02;box-shadow:0 0 0 6px #F4EFE4,0 0 0 8px #B8965A}
.an{margin-top:18px}
.an svg{display:block}
</style></head><body><div class="w">
<div class="l"><div class="br">사주<b>500</b></div>
<h1>${safeName} 님의<br>사주 카드</h1>
<div class="sub">${iljuKo ? `${iljuKo}(${esc(ilju)}) 일주, ${meta?.oheng ?? ''} 기운의 일간` : '사주 여덟 글자와 오행, 지금 대운'}</div>
<div class="ft">생일만 넣으면 내 사주 카드도 무료로 만들어요</div></div>
<div class="r"><div class="box"><span>${esc(gan) || '命'}</span><span>${esc(zhi)}</span></div><div class="an">${animal}</div></div>
</div></body></html>`;
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
      res.status(200).send(Buffer.from(buf)); // 2026-10-19 puppeteer 23 은 Uint8Array 를 돌려줘서 그대로 보내면 JSON 숫자 목록이 나갔다
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
