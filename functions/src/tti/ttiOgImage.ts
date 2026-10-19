/**
 * 오늘의 띠별 운세 미리보기 그림 (2026-10-19) — https://saju500.app/og/tti/{YYYY-MM-DD}.jpg
 *
 *   카톡, 스레드 같은 곳에 링크를 보내면 미리보기에 그날 열두 띠 표(사주500 띠 그림, 좋음/보통/조심, 한 문장)가 그대로 보이게.
 *   /unse/today/ 의 og:image 와 앱 토스 공유 링크의 그림이 이 주소다. 오너(10-19): 한 캡처에 다 담기는 게 퍼지는 이유.
 *   ttiFortune/{날짜} 문서를 읽어 크롬(puppeteer, PDF 와 같은 엔진)으로 1200x630 JPEG. 날짜별 주소라 CDN 이 하루 캐시한다.
 *   문서가 없는 날이면 기본 그림(/og/tti.jpg)으로 돌린다. 판정(좋음/보통/조심)과 짧은 문장은 화면(TtiBoardPage)과 같은 규칙.
 */
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { branchRelations, TTI_NAME, ttiFactsTable } from './ttiFortune';
import { ttiAnimalSvg } from './ttiAnimalSvg';

const ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

type Mark = '좋음' | '보통' | '조심';
/** 화면 dayTone 과 같은 규칙: 좋은 관계(육합, 삼합)와 나쁜 관계(충, 형, 원진, 해)가 겹치면 보통(巳申 형합 등),
 *  아니면 충 > 형 > 원진 > 해 > 육합 > 삼합 > 같은 띠 > 무난 */
function tone(dayZhi: string, ji: string): { mark: Mark; line: string; mixed?: boolean } {
  const r = branchRelations(dayZhi, ji);
  const bad = r.some((x) => ['충', '형', '원진', '해'].includes(x));
  const good = r.some((x) => ['육합', '삼합'].includes(x));
  if (bad && good) return { mark: '보통', line: '좋은 일과 걸리는 일이 함께 오는 날이에요', mixed: true };
  if (r.includes('충')) return { mark: '조심', line: '정면으로 부딪히기 쉬운 날이에요' };
  if (r.includes('형')) return { mark: '조심', line: '서로 깎이기 쉬운 날이에요' };
  if (r.includes('원진')) return { mark: '조심', line: '괜히 서운해지기 쉬운 날이에요' };
  if (r.includes('해')) return { mark: '조심', line: '은근히 어긋나기 쉬운 날이에요' };
  if (r.includes('육합')) return { mark: '좋음', line: '사람과 잘 맞는 날이에요' };
  if (r.includes('삼합')) return { mark: '좋음', line: '일이 맞물려 풀리는 날이에요' };
  if (r.some((x) => x.startsWith('같은 띠'))) return { mark: '보통', line: '했던 일을 다시 하게 되는 날이에요' };
  return { mark: '보통', line: '큰 탈 없이 흘러가는 날이에요' };
}
/** 화면 shortFromHead 와 같은 규칙 */
function shortFromHead(head: string): string | null {
  const m = head.match(/^(.*?날)입니다\./);
  if (!m) return null;
  const s = m[1].replace(/^오늘\s*\S+띠는\s*/, '').replace(/^[가-힣]\([^)]*\)일과\s*/, '').trim();
  if (s.length < 6 || s.length > 18 || /[一-鿿()]|합충|육합|삼합|원진|충|형살/.test(s)) return null;
  return `${s}이에요`;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const BG: Record<Mark, [string, string]> = { 좋음: ['#F4ECD8', '#DCCBA6'], 보통: ['#FFFDF8', '#E1D7C4'], 조심: ['#F8EAE5', '#E6C6BC'] };
const MC: Record<Mark, string> = { 좋음: '#1A1612', 보통: '#8A8174', 조심: '#A23A2A' };

function buildHtml(dateKey: string, dayGz: string, tti: Record<string, { head?: string; short?: string }>): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const wd = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const gzKo = `${GAN_KO[dayGz[0]] || ''}${ZHI_KO[dayGz[1]] || ''}`;
  const cells = ORDER.map((z) => {
    const t = tone(dayGz[1], z);
    // 관계가 겹치는 날은 AI 문장이 한쪽만 말할 수 있어 계산 문장으로 (표시와 문장이 반대로 찍히지 않게)
    const line = t.mixed ? t.line : ((tti[z]?.short || '').trim() || shortFromHead((tti[z]?.head || '').trim()) || t.line);
    const [bg, bd] = BG[t.mark];
    return `<div class="c" style="background:${bg};border-color:${bd}"><b class="mk" style="color:${MC[t.mark]}">${t.mark}</b>${ttiAnimalSvg(z, 58)}<div class="nm">${TTI_NAME[z]}</div><div class="ln">${esc(line)}</div></div>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#F4EFE4;font-family:Pretendard,sans-serif;color:#1A1612;word-break:keep-all}
.w{display:flex;height:630px;padding:24px 26px 24px 34px;gap:26px}
.l{width:300px;display:flex;flex-direction:column}
.br{font-family:'Noto Serif KR',serif;font-weight:900;font-size:34px}.br b{color:#8C6D3D}
.sl{margin-top:44px;width:74px;height:74px;border:3px solid #A23A2A;color:#A23A2A;border-radius:8px;display:grid;place-items:center;font-family:'Noto Serif KR',serif;font-weight:900;font-size:30px;line-height:1;text-align:center}
h1{margin-top:22px;font-family:'Noto Serif KR',serif;font-weight:700;font-size:52px;line-height:1.25;letter-spacing:-.03em}
.dt{margin-top:18px;font-size:26px;color:#4B4238;font-weight:600}
.ft{margin-top:auto;font-size:21px;color:#6F6557;line-height:1.5}
.g{flex:1;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:10px}
.c{position:relative;border:1.5px solid;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 8px 10px;text-align:center}
.c svg{display:block}
.mk{position:absolute;top:8px;right:12px;font-size:19px;font-weight:800}
.nm{margin-top:4px;font-family:'Noto Serif KR',serif;font-size:23px;font-weight:700}
.ln{margin-top:4px;font-size:18.5px;font-weight:700;line-height:1.3;color:#2E2720}
</style></head><body><div class="w">
<div class="l"><div class="br">사주<b>500</b></div><div class="sl">${dayGz}</div><h1>오늘의<br>띠별 운세</h1>
<div class="dt">${m}월 ${d}일 ${wd}요일<br>${gzKo}(${dayGz})일</div><div class="ft">띠를 눌러 좋은 시간까지<br>무료로 보세요</div></div>
<div class="g">${cells}</div></div></body></html>`;
}

async function loadPuppeteer(): Promise<{ launch: () => Promise<any> } | null> {
  try {
    const [puppeteerCore, chromium] = await Promise.all([import('puppeteer-core' as any), import('@sparticuz/chromium' as any)]);
    const chrome = (chromium as any).default ?? chromium;
    return {
      launch: async () => puppeteerCore.launch({
        args: chrome.args, defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
        executablePath: await chrome.executablePath(), headless: 'shell',
      }),
    };
  } catch (err: any) {
    console.warn('[ttiOgImage] puppeteer 없음:', err?.message);
    return null;
  }
}

export const ttiOgImage = onRequest({ timeoutSeconds: 60, memory: '1GiB', minInstances: 0, maxInstances: 3, invoker: 'public' }, async (req, res) => {
  const fallback = () => { res.set('Cache-Control', 'public, max-age=600, s-maxage=600'); res.redirect(302, 'https://saju500.app/og/tti.jpg'); };
  try {
    const m = String(req.path || '').match(/(\d{4}-\d{2}-\d{2})/);
    if (!m) { fallback(); return; }
    const dateKey = m[1];
    // 오늘 앞뒤 이틀만 그린다(아무 날짜나 넣어 크롬을 돌리게 하지 않게). 그 밖은 기본 그림
    const dayMs = Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(dayMs) || Math.abs(dayMs) > 2 * 864e5) { fallback(); return; }
    const snap = await admin.firestore().doc(`ttiFortune/${dateKey}`).get();
    const doc = snap.exists ? (snap.data() as any) : null;
    // 10-19 검토: 문서가 아직 없을 때 기본 그림(302)을 주면 호스팅 캐시 규칙 때문에 하루 내내 기본 그림이 남는다
    //   → 문서가 없어도 그날 일진과 띠 관계로 계산한 표를 그린다(좋음/보통/조심과 계산 문장은 그대로 맞다)
    const dayGz = String(doc?.dayGz || ttiFactsTable(dateKey).dayGz);
    const html = buildHtml(dateKey, dayGz, doc?.tti || {});
    const pup = await loadPuppeteer();
    if (!pup) { res.set('Retry-After', '60'); res.status(503).send('busy'); return; }
    let buf: Buffer | null = null;
    for (let attempt = 0; attempt < 2 && !buf; attempt++) {
      const browser = await pup.launch();
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.evaluateHandle('document.fonts.ready');
        const out = await page.screenshot({ type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1200, height: 630 } });
        if (out && out.length >= 2048) buf = Buffer.from(out); // puppeteer 23 은 Uint8Array — 그대로 보내면 JSON 숫자 목록이 나간다
      } catch (e: any) {
        console.warn('[ttiOgImage] 그리기 실패', attempt, e?.message);
      } finally {
        try { await browser.close(); } catch { /* noop */ }
      }
    }
    // 두 번 다 실패하면 503 (캐시에 남지 않게 기본 그림 302 를 쓰지 않는다)
    if (!buf) { res.set('Retry-After', '60'); res.status(503).send('busy'); return; }
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(buf);
  } catch (err: any) {
    console.error('[ttiOgImage]', err?.message);
    // 예상 못 한 오류도 503 — 기본 그림 302 는 호스팅 캐시 규칙 때문에 하루 남는다
    try { res.set('Retry-After', '60'); res.status(503).send('busy'); } catch { /* noop */ }
  }
});
