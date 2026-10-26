/**
 * #saju-card-share Stage 4 · /api/saju-card-og.png 동적 OG 이미지
 *
 * 입력: query string `i` (일주 한자 2글자, 60갑자만). `n`(이름)은 2026-10-26 부터 쓰지 않는다(아래 '입력 잠금').
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
 * 입력 잠금 (2026-10-26):
 *   예전엔 아무 n(40자), i(4자)나 받아 그 글자를 그대로 그림에 쓰고, 주소가 다를 때마다 크롬을 새로 띄웠다. 주소를 바꿔 가며 부르면
 *   비용이 늘고(인스턴스 20개까지), 아무 글자로 'OO 님의 사주 카드' 그림을 saju500.app 주소로 만들 수 있었다.
 *   - i 는 60갑자 일주만 받는다. 틀리거나 없으면 정적 그림(/og/manse.jpg)으로 보낸다(크롬 안 띄움).
 *   - n 은 쓰지 않는다(10-15 부터 공유 링크에 이름을 넣지 않음). 그림 제목은 늘 '나의 사주 카드'.
 *   - 주소는 ?i=일주 하나로 모은다. 다른 값(n, ref, 아무 값)이 붙으면 그 주소로 보내서 CDN 캐시가 일주 60개로 끝난다.
 *   - 그린 그림은 인스턴스 안에 일주별로 들고 있고, 같은 일주를 동시에 부르면 한 번만 그린다.
 *   - 인스턴스 최대 3개, 한 인스턴스 동시 요청 4개 (ttiOgImage 와 같은 상한).
 *
 * 한자 폰트 fallback 0:
 *   - Noto Serif KR Google Fonts CDN (preconnect + display=swap)
 *   - networkidle0 + document.fonts.ready 대기 (puppeteer #61 패턴 차용)
 *
 * 디자인 (1200×630, 2026-10-19 v9):
 *   - 종이 #F4EFE4 바탕, 먹 두 줄 테두리(사주쌍변)
 *   - 왼쪽: 사주500, 'OO 님의 사주 카드', 일주와 일간 오행, '생일만 넣으면 내 사주 카드도 무료로'
 *   - 오른쪽: 일주 두 글자 칸(전통 오행색) + 일주 지지의 사주500 띠 그림
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

const GAN_ORDER = '甲乙丙丁戊己庚辛壬癸';
const ZHI_ORDER = '子丑寅卯辰巳午未申酉戌亥';

/** 2026-10-26 — 60갑자 일주면 그 두 글자, 아니면 ''. 천간과 지지의 음양이 같아야 한다(甲子 O, 甲丑 X). renderSajuCardOg 도 같이 쓴다. */
export function sajuCardIlju(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  if (s.length !== 2) return '';
  const g = GAN_ORDER.indexOf(s.charAt(0));
  const z = ZHI_ORDER.indexOf(s.charAt(1));
  return g >= 0 && z >= 0 && g % 2 === z % 2 ? s : '';
}

/** 일주 한글 읽기 (辛亥 → 신해) */
export function iljuKoOf(ilju: string): string {
  return `${GAN_KO[ilju.charAt(0)] || ''}${ZHI_KO[ilju.charAt(1)] || ''}`;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildOgHtml(ilju: string): string {
  const gan = ilju.charAt(0);
  const zhi = ilju.charAt(1);
  const meta = GAN_OHENG_COLOR[gan];
  const color = meta?.color ?? '#1A1612';
  const iljuKo = iljuKoOf(ilju);
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
<h1>나의<br>사주 카드</h1>
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

/** 정적 그림으로 보내기 (틀린 입력, puppeteer 미설치, 그리기 실패)
 *  2026-10-26 — 옛 디자인 /og-image.png 대신 v9 무료 만세력 그림(public/og/manse.jpg, 1200×630).
 *  run.app 주소로 바로 불러도 다시 이 함수로 돌아오지 않게 사이트 절대 주소로 보낸다(ttiOgImage 와 같은 방식). */
function placeholderPngRedirect(res: any, maxAge = 3600): void {
  res.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`);
  res.redirect(302, 'https://saju500.app/og/manse.jpg');
}

/** 일주별로 그린 그림 (인스턴스 안, 최대 60개) + 같은 일주를 동시에 그리지 않게 진행 중인 것 */
const pngByIlju = new Map<string, Buffer>();
const drawing = new Map<string, Promise<Buffer>>();
function iljuPng(ilju: string): Promise<Buffer> {
  const hit = pngByIlju.get(ilju);
  if (hit) return Promise.resolve(hit);
  let p = drawing.get(ilju);
  if (!p) {
    p = htmlToPngBuffer(buildOgHtml(ilju))
      .then((b) => {
        const buf = Buffer.from(b); // 2026-10-19 puppeteer 23 은 Uint8Array 를 돌려줘서 그대로 보내면 JSON 숫자 목록이 나갔다
        if (buf.length >= 1024) pngByIlju.set(ilju, buf);
        return buf;
      })
      .finally(() => { drawing.delete(ilju); });
    drawing.set(ilju, p);
  }
  return p;
}

export const renderSajuCardOgImage = onRequest(
  {
    timeoutSeconds: 60,
    memory: '1GiB',
    minInstances: 0,
    maxInstances: 3, // 2026-10-26 — 예전엔 상한이 없어 기본 20개까지 떴다
    concurrency: 4, // 2026-10-26 — 한 인스턴스(1GiB)가 크롬을 수십 개 띄우지 않게
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
    try {
      // 2026-10-26 입력 잠금 — 60갑자 일주가 아니면 크롬을 띄우지 않고 정적 그림으로
      const ilju = sajuCardIlju(req.query.i);
      if (!ilju) {
        placeholderPngRedirect(res, 86400);
        return;
      }
      // 주소를 ?i=일주 하나로 모은다 (옛 링크의 n, 아무 값이 붙은 주소는 여기서 걸러 CDN 캐시가 일주 60개로 끝나게)
      const keys = Object.keys(req.query || {});
      if (keys.length !== 1 || keys[0] !== 'i') {
        res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        res.redirect(301, `/api/saju-card-og.png?i=${encodeURIComponent(ilju)}`);
        return;
      }

      let buf: Buffer;
      try {
        buf = await iljuPng(ilju);
      } catch (err: any) {
        console.warn('[renderSajuCardOgImage] 동적 생성 실패, placeholder fallback:', err?.message);
        placeholderPngRedirect(res);
        return;
      }

      if (!buf || buf.length < 1024) {
        placeholderPngRedirect(res);
        return;
      }

      // 24h CDN edge cache — 같은 일주는 hit
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).send(buf);
    } catch (err: any) {
      console.error('[renderSajuCardOgImage] 에러:', err);
      // 에러 시에도 placeholder 로 fallback (OG 미리보기 깨짐 방지)
      try {
        placeholderPngRedirect(res);
      } catch {
        res.status(500).send('Internal Server Error');
      }
    }
  },
);
