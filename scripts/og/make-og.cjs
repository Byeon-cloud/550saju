/**
 * 공유 미리보기 그림 만들기 (2026-10-17) — 콘텐츠마다 1200x630 PNG 를 public/og/ 에 쓴다.
 *
 *   예전 og-image.png 는 옛 디자인(남색, 옛 앱 화면, '500원 한 번이면 끝')이라 지금 화면과 맞지 않았다.
 *   v9 수묵 고서: 먹 바탕 + 정선 「인왕제색도」(공유마당 저작권 만료), 명조 제목, 작은 낙관. 알약 배지와 장식 기호는 쓰지 않는다.
 *   로컬 크롬으로 찍는다:  node scripts/og/make-og.cjs   (CHROME 환경 변수로 경로를 바꿀 수 있다)
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(__dirname, '../../functions/node_modules/puppeteer-core'));

const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'public/og');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ART = 'file:///' + path.join(ROOT, 'public/art/inwang.webp').replace(/\\/g, '/');

const CARDS = [
  { id: 'default', seal: '命', kicker: '사주500', title: '내 사주 여덟 글자로 읽는\n오늘과 한 해', sub: '오늘의 운세와 꿈해몽은 하루 한 번 무료예요' },
  { id: 'daily', seal: '日', kicker: '오늘의 운세', title: '내 사주로 본\n오늘 하루', sub: '좋은 시간과 피할 일까지, 하루 한 번 무료예요' },
  { id: 'dream', seal: '夢', kicker: '꿈해몽', title: '간밤 꿈을\n내 사주로 풀었어요', sub: '같은 꿈도 사주에 따라 다르게 읽혀요' },
  { id: 'compat', seal: '合', kicker: '궁합', title: '두 사람 사주로 본\n궁합 이야기', sub: '잘 맞는 점과 부딪히는 점을 알려 드려요' },
  { id: 'premium', seal: '命', kicker: '종합사주', title: '타고난 성격부터\n10년 대운까지', sub: '내 사주를 처음부터 끝까지 읽어 드려요' },
  { id: 'tojung', seal: '歲', kicker: '2027 신년운세', title: '정미년 열두 달을\n내 사주로 미리 봐요', sub: '힘을 줄 달과 쉬어 갈 달, 꼭 기억할 날까지' },
  { id: 'monthly', seal: '月', kicker: '월운세', title: '한 달 흐름을\n날짜까지 미리 봐요', sub: '좋은 날과 조심할 날을 알려 드려요' },
  { id: 'weekly', seal: '週', kicker: '주간운세', title: '이번 주 7일을\n내 사주로 봐요', sub: '중요한 약속을 언제 잡을지 알려 드려요' },
  { id: 'tti', seal: '支', kicker: '띠별 운세', title: '띠만 눌러도\n오늘 운세가 보여요', sub: '가족 띠도 함께 볼 수 있어요' },
];

const html = (c) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700;900&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:Pretendard,sans-serif;word-break:keep-all}
.c{position:relative;width:1200px;height:630px;color:#F4EFE4;
 background:linear-gradient(90deg,rgba(26,22,18,.94) 0%,rgba(26,22,18,.84) 46%,rgba(26,22,18,.45) 100%),url('${ART}') 70% 40%/cover no-repeat,#1A1612}
.in{position:absolute;left:84px;top:78px;right:84px;bottom:70px;display:flex;flex-direction:column}
.brand{font-family:'Noto Serif KR',serif;font-weight:900;font-size:34px;letter-spacing:-.02em}
.brand b{color:#D2B477}
.kick{margin-top:56px;font-size:30px;font-weight:700;color:#D9CFBE}
h1{margin-top:14px;font-family:'Noto Serif KR',serif;font-weight:700;font-size:74px;line-height:1.28;letter-spacing:-.035em;white-space:pre-line}
.sub{margin-top:auto;font-size:30px;color:#E4DCCD}
.seal{position:absolute;right:84px;top:72px;width:92px;height:92px;border:4px solid #B5463A;color:#C9594C;border-radius:10px;display:grid;place-items:center;font-family:'Noto Serif KR',serif;font-weight:900;font-size:54px;background:rgba(26,22,18,.35)}
.rule{width:64px;height:3px;background:#B8965A;margin-top:26px}
</style></head><body><div class="c"><div class="in">
<div class="brand">사주<b>500</b></div>
<div class="kick">${c.kicker}</div>
<h1>${c.title}</h1>
<div class="rule"></div>
<div class="sub">${c.sub}</div>
</div><div class="seal">${c.seal}</div></div></body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  for (const c of CARDS) {
    const file = path.join(OUT, `_${c.id}.html`);
    fs.writeFileSync(file, html(c));
    await page.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, `${c.id}.jpg`), type: 'jpeg', quality: 86 });
    // 기본 그림은 예전 이름(og-image.png)에도 덮어쓴다 — 이미 배포된 앱 번들과 페이지가 이 이름을 쓴다
    if (c.id === 'default') await page.screenshot({ path: path.join(ROOT, 'public/og-image.png'), type: 'png' });
    fs.unlinkSync(file);
    console.log('og', c.id);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
