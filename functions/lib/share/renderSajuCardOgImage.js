"use strict";
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
 * 디자인 (1200×630, 2026-10-19 v9):
 *   - 종이 #F4EFE4 바탕, 먹 두 줄 테두리(사주쌍변)
 *   - 왼쪽: 사주500, 'OO 님의 사주 카드', 일주와 일간 오행, '생일만 넣으면 내 사주 카드도 무료로'
 *   - 오른쪽: 일주 두 글자 칸(전통 오행색) + 일주 지지의 사주500 띠 그림
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSajuCardOgImage = void 0;
const https_1 = require("firebase-functions/v2/https");
const personName_1 = require("../shared/personName");
const ttiAnimalSvg_1 = require("../tti/ttiAnimalSvg");
/* ══════════════════════════════════════════════════════════════════
 * 천간 → 오행 컬러 매핑 (SSOT 정렬)
 * ═════════════════════════════════════════════════════════════════ */
/* 2026-10-19 v9 수묵 고서로 다시 그림 — 예전 그림은 영문 'SAJU 500', 옛 원색(#2D8A4E 등), 알약 표시, 화살표가 남아 있었다.
 *   오행 색은 전통 안료(송록, 석간주, 황토, 은회, 쪽빛), 일주 지지의 사주500 띠 그림(tti/ttiAnimalSvg)을 함께. */
const GAN_OHENG_COLOR = {
    甲: { color: '#4E7A57', oheng: '나무' }, 乙: { color: '#4E7A57', oheng: '나무' },
    丙: { color: '#B04A38', oheng: '불' }, 丁: { color: '#B04A38', oheng: '불' },
    戊: { color: '#B07F38', oheng: '흙' }, 己: { color: '#B07F38', oheng: '흙' },
    庚: { color: '#7D7870', oheng: '쇠' }, 辛: { color: '#7D7870', oheng: '쇠' },
    壬: { color: '#3E5F82', oheng: '물' }, 癸: { color: '#3E5F82', oheng: '물' },
};
const GAN_KO = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function buildOgHtml(name, ilju) {
    const gan = ilju.charAt(0);
    const zhi = ilju.charAt(1);
    const meta = GAN_OHENG_COLOR[gan];
    const color = meta?.color ?? '#1A1612';
    const realNm = (0, personName_1.realName)(name);
    const safeName = esc(realNm || '나');
    const iljuKo = `${GAN_KO[gan] || ''}${ZHI_KO[zhi] || ''}`;
    const animal = zhi ? (0, ttiAnimalSvg_1.ttiAnimalSvg)(zhi, 92) : '';
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
<h1>${realNm ? `${safeName} 님의` : '나의'}<br>사주 카드</h1>
<div class="sub">${iljuKo ? `${iljuKo}(${esc(ilju)}) 일주, ${meta?.oheng ?? ''} 기운의 일간` : '사주 여덟 글자와 오행, 지금 대운'}</div>
<div class="ft">생일만 넣으면 내 사주 카드도 무료로 만들어요</div></div>
<div class="r"><div class="box"><span>${esc(gan) || '命'}</span><span>${esc(zhi)}</span></div><div class="an">${animal}</div></div>
</div></body></html>`;
}
/* ══════════════════════════════════════════════════════════════════
 * Puppeteer 동적 import — #61 PDF 서버와 동일 패턴
 * ═════════════════════════════════════════════════════════════════ */
async function loadPuppeteer() {
    try {
        const [puppeteerCore, chromium] = await Promise.all([
            Promise.resolve(`${'puppeteer-core'}`).then(s => __importStar(require(s))),
            Promise.resolve(`${'@sparticuz/chromium'}`).then(s => __importStar(require(s))),
        ]);
        const chrome = chromium.default ?? chromium;
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
    }
    catch (err) {
        console.warn('[renderSajuCardOgImage] puppeteer 미설치:', err?.message);
        return null;
    }
}
/** HTML → 1200×630 PNG Buffer */
async function htmlToPngBuffer(html) {
    const pup = await loadPuppeteer();
    if (!pup)
        throw new Error('PNG 엔진 준비 안 됨');
    const browser = await pup.launch();
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
        // 폰트 paint 완료 대기
        await page.evaluateHandle('document.fonts.ready');
        const buf = await page.screenshot({
            type: 'png',
            omitBackground: false,
            clip: { x: 0, y: 0, width: 1200, height: 630 },
        });
        return buf;
    }
    finally {
        try {
            await browser.close();
        }
        catch { /* noop */ }
    }
}
/** 정적 placeholder PNG (puppeteer 미설치 fallback) — 사주500 정사각 로고만 */
function placeholderPngRedirect(origin, res) {
    // 빌드 시점 정적 자산 사용 — `/og-image.png` 가 dist 에 있다고 가정
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.redirect(302, `${origin}/og-image.png`);
}
exports.renderSajuCardOgImage = (0, https_1.onRequest)({
    timeoutSeconds: 60,
    memory: '1GiB',
    minInstances: 0,
    cors: true,
    invoker: 'public',
}, async (req, res) => {
    try {
        const name = String(req.query.n || '').slice(0, 40);
        const ilju = String(req.query.i || '').slice(0, 4);
        const origin = `https://${req.hostname}`;
        const html = buildOgHtml(name, ilju);
        let buf;
        try {
            buf = await htmlToPngBuffer(html);
        }
        catch (err) {
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
    }
    catch (err) {
        console.error('[renderSajuCardOgImage] 에러:', err);
        // 에러 시에도 placeholder 로 fallback (OG 미리보기 깨짐 방지)
        try {
            const origin = `https://${req.hostname}`;
            placeholderPngRedirect(origin, res);
        }
        catch {
            res.status(500).send('Internal Server Error');
        }
    }
});
//# sourceMappingURL=renderSajuCardOgImage.js.map