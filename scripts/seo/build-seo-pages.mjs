/**
 * 검색용 정적 페이지 만들기 (2026-10-16) — 웹 빌드(npm run build) 뒤에 dist/ 에 HTML 을 쓴다. 앱 빌드(build:ait)에는 붙지 않는다.
 *
 *   /unse/2027/          2027 띠별 신년운세 모음
 *   /unse/2027/{띠}/     띠마다 한 장 (총운, 좋은 달, 조심할 달, 출생 연도별 여섯 줄)
 *   내용은 src/data/seo/tti-2027.json (scripts/seo/gen-tti-year.cjs 가 확정표로 만든 것). 네이버는 JS 를 거의 안 돌려
 *   SPA 첫 화면이 비어 보이므로 글이 HTML 에 그대로 있어야 색인된다. 화면의 버튼은 앱(SPA)으로 utm 을 달아 보낸다.
 *   sitemap.xml 도 여기서 다시 쓴다(기존 주소 + 이 페이지들).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://saju500.app';
const YEAR = 2027;
const data = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/seo/tti-${YEAR}.json`), 'utf8'));

const ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const T = {
  子: ['rat', '쥐띠'], 丑: ['ox', '소띠'], 寅: ['tiger', '호랑이띠'], 卯: ['rabbit', '토끼띠'], 辰: ['dragon', '용띠'], 巳: ['snake', '뱀띠'],
  午: ['horse', '말띠'], 未: ['goat', '양띠'], 申: ['monkey', '원숭이띠'], 酉: ['rooster', '닭띠'], 戌: ['dog', '개띠'], 亥: ['pig', '돼지띠'],
};
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN_KO = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const gzOf = (y) => GAN[(((y - 4) % 10) + 10) % 10] + ZHI[(((y - 4) % 12) + 12) % 12];
const gzKo = (gz) => GAN_KO[gz[0]] + ZHI_KO[gz[1]];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstSentence = (s) => (String(s).match(/^.*?(니다|요)\./) || [s])[0];
const utm = (slug) => `utm_source=seo&utm_medium=organic&utm_campaign=tti${YEAR}_${slug}`;
const yearGz = data.yearGz; // 丁未

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#F4EFE4;color:#1A1612;font-family:Pretendard,-apple-system,sans-serif;line-height:1.75;-webkit-text-size-adjust:100%;word-break:keep-all}
a{color:inherit}
.wrap{max-width:560px;margin:0 auto;padding:0 18px}
.top{display:flex;align-items:center;justify-content:space-between;height:56px}
.brand{font-family:'Noto Serif KR',serif;font-weight:900;font-size:19px;text-decoration:none}.brand b{color:#8C6D3D}
.top a.go{font-size:14px;font-weight:700;color:#4B4238;text-decoration:none}
.hero{background:linear-gradient(180deg,rgba(26,22,18,.55),rgba(26,22,18,.86) 55%,#1A1612),url('/art/inwang.webp') 30% 35%/cover no-repeat,#1A1612;color:#F4EFE4;padding:34px 0 30px}
.hero .lab{font-size:14px;color:#CFC6B6;font-weight:700}
.hero h1{font-family:'Noto Serif KR',serif;font-weight:700;font-size:30px;line-height:1.35;letter-spacing:-.03em;margin:8px 0 10px}
.hero p{font-size:15px;color:#E4DCCD}
.sec{padding:26px 0 6px}
.sec h2{font-family:'Noto Serif KR',serif;font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px;margin-bottom:12px}
.seal{display:inline-grid;place-items:center;width:28px;height:28px;border:1.6px solid #A23A2A;color:#A23A2A;border-radius:4px;font-family:'Noto Serif KR',serif;font-weight:900;font-size:15px;flex-shrink:0}
.card{background:#FFFDF8;border:1px solid #E1D7C4;border-radius:14px;padding:16px 18px}
.lead{font-family:'Noto Serif KR',serif;font-size:17px;font-weight:600;line-height:1.75}
.row{display:flex;gap:12px;padding:12px 0;border-top:1px solid #E1D7C4}.row:first-child{border-top:0;padding-top:0}
.row .k{width:92px;flex-shrink:0;font-weight:800;font-size:15px}
.row .k small{display:block;font-weight:500;font-size:13px;color:#6F6557}
.row .v{flex:1;font-size:15.5px;color:#2E2720}
.cta{margin:26px 0 8px;background:#1A1612;color:#F4EFE4;border-radius:16px;padding:20px}
.cta h3{font-family:'Noto Serif KR',serif;font-size:18px;font-weight:700;margin-bottom:6px}
.cta p{font-size:14.5px;color:#CFC6B6;margin-bottom:14px}
.btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:13px;background:linear-gradient(180deg,#D2B477,#B8965A);color:#17110A;font-weight:800;font-size:16px;text-decoration:none}
.sub{display:block;text-align:center;margin-top:12px;font-size:14.5px;font-weight:700;color:#E4DCCD;text-decoration:underline}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.grid a{display:block;background:#FFFDF8;border:1px solid #E1D7C4;border-radius:12px;padding:10px 6px;text-align:center;text-decoration:none;font-weight:700;font-size:15px}
.grid a small{display:block;font-weight:500;font-size:13px;color:#6F6557;font-variant-numeric:tabular-nums}
.grid a.on{background:#1A1612;color:#F4EFE4;border-color:#1A1612}.grid a.on small{color:#CFC6B6}
.list .item{padding:16px 0;border-top:1px solid #E1D7C4}.list .item:first-child{border-top:0}
.list h3{font-size:17px;font-weight:800;margin-bottom:4px}.list h3 small{font-weight:500;font-size:13.5px;color:#6F6557;margin-left:6px}
.list p{font-size:15.5px;color:#2E2720}.list a.more{font-size:14.5px;font-weight:700;color:#7A5C2E}
.note{font-size:13.5px;color:#6F6557;margin-top:18px}
.foot{margin-top:34px;border-top:1px solid #E1D7C4;padding:16px 0 30px;text-align:center;font-size:12px;color:#A69C8E;line-height:1.7}
.foot a{color:#A69C8E;margin:0 6px;text-decoration:none}.foot a.b{font-weight:700}
`;

function page({ title, desc, canonical, body, jsonld }) {
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="사주500">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700;900&display=swap">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head><body>
<header class="wrap top"><a class="brand" href="/">사주<b>500</b></a><a class="go" href="/?${utm('top')}">오늘의 운세 보기</a></header>
${body}
<footer class="wrap foot">
<div><a href="/terms">이용약관</a><a class="b" href="/privacy">개인정보처리방침</a><a href="/business">사업자정보</a></div>
<div>주라벨 주식회사 | 대표 변준기 | 사업자등록번호 228-88-03113 | 통신판매업 제 2025-부산사하-0235호 | info@juulabel.com</div>
<div>© ${new Date().getFullYear()} 사주500</div>
</footer>
</body></html>`;
}

function ttiGrid(current) {
  return `<div class="grid">${ORDER.map((z) => {
    const [slug, name] = T[z];
    const yy = Object.keys(data.tti[z].years).map((y) => String(Number(y) % 100).padStart(2, '0'));
    return `<a href="/unse/${YEAR}/${slug}/"${z === current ? ' class="on"' : ''}>${name}<small>${yy.slice(0, 3).join(' ')}<br>${yy.slice(3).join(' ')}</small></a>`;
  }).join('')}</div>`;
}

const out = [];
function write(rel, html) {
  const dir = path.join(DIST, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  out.push(`/${rel}/`);
}

// ── 띠마다 한 장
for (const z of ORDER) {
  const [slug, name] = T[z];
  const t = data.tti[z];
  const m = data.months[z];
  const canonical = `${SITE}/unse/${YEAR}/${slug}/`;
  const yearsHtml = Object.entries(t.years).map(([y, s]) => {
    const gz = gzOf(Number(y));
    return `<div class="item"><h3>${y}년생 ${name}<small>${gzKo(gz)}(${gz})생, ${YEAR}년 만 ${YEAR - Number(y)}세</small></h3><p>${esc(s)}</p></div>`;
  }).join('');
  const title = `${YEAR}년 ${name} 운세 | ${gzKo(yearGz)}년 ${name} 신년운세, 출생 연도별 - 사주500`;
  const desc = `${YEAR}년 ${gzKo(yearGz)}년 ${name} 신년운세. ${firstSentence(t.head)} 좋은 달은 ${m.good.join(', ') || '없음'}, 조심할 달은 ${m.care.join(', ') || '없음'}. ${Object.keys(t.years).map((y) => `${String(Number(y) % 100).padStart(2, '0')}년생`).join(', ')} 운세까지.`;
  const body = `
<section class="hero"><div class="wrap">
<div class="lab">${YEAR} ${gzKo(yearGz)}(${yearGz})년 신년운세</div>
<h1>${YEAR}년 ${name} 운세</h1>
<p>입춘(양력 2월 4일 무렵)부터 ${YEAR + 1}년 입춘 전까지, ${name}의 한 해 흐름이에요.</p>
</div></section>
<main class="wrap">
<section class="sec"><h2><span class="seal">一</span>${name} 총운</h2><div class="card"><p class="lead">${esc(t.head)}</p></div></section>
<section class="sec"><h2><span class="seal">二</span>좋은 달과 조심할 달</h2><div class="card">
<div class="row"><div class="k">좋은 달<small>${m.good.join(', ') || '특별히 없음'}</small></div><div class="v">${esc(t.good)}</div></div>
<div class="row"><div class="k">조심할 달<small>${m.care.join(', ') || '특별히 없음'}</small></div><div class="v">${esc(t.care)}</div></div>
</div></section>
<section class="sec"><h2><span class="seal">三</span>출생 연도별 ${YEAR}년 운세</h2><div class="card list">${yearsHtml}</div></section>
<section class="cta">
<h3>같은 ${name}라도 생일과 태어난 시간에 따라 한 해가 달라요</h3>
<p>내 사주 여덟 글자로 ${YEAR}년 열두 달을 날짜까지 풀어 드려요.</p>
<a class="btn" href="/tojung?${utm(slug)}">내 생일로 ${YEAR} 신년운세 보기</a>
<a class="sub" href="/?${utm(slug + '_today')}">오늘의 ${name} 운세는 무료로 보기</a>
</section>
<section class="sec"><h2>다른 띠 ${YEAR}년 운세</h2>${ttiGrid(z)}</section>
<p class="note">이 풀이는 띠(태어난 해의 지지)와 ${YEAR}년 ${gzKo(yearGz)}년의 관계, 태어난 해의 천간을 명리학 원리에 따라 본 참고용 풀이예요. 달은 절기 기준이라 양력 4~8일 무렵에 바뀌어요.</p>
</main>`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'Article', headline: `${YEAR}년 ${name} 운세`, description: desc, inLanguage: 'ko', mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE }, datePublished: '2026-10-16', dateModified: data.generatedAt?.slice(0, 10) || '2026-10-16' };
  write(`unse/${YEAR}/${slug}`, page({ title, desc, canonical, body, jsonld }));
}

// ── 모음
{
  const canonical = `${SITE}/unse/${YEAR}/`;
  const title = `${YEAR}년 띠별 운세 | ${gzKo(yearGz)}년 신년운세 12띠 총정리 - 사주500`;
  const desc = `${YEAR}년은 ${gzKo(yearGz)}(${yearGz})년, 붉은 양의 해예요. 쥐띠부터 돼지띠까지 12띠의 ${YEAR}년 총운과 좋은 달, 조심할 달, 출생 연도별 운세를 한 번에 볼 수 있어요.`;
  const items = ORDER.map((z) => {
    const [slug, name] = T[z];
    const ys = Object.keys(data.tti[z].years).map((y) => `${String(Number(y) % 100).padStart(2, '0')}`).join(', ');
    return `<div class="item"><h3>${name}<small>${ys}년생</small></h3><p>${esc(data.tti[z].head)}</p><a class="more" href="/unse/${YEAR}/${slug}/">${name} 좋은 달과 출생 연도별 운세 보기 ›</a></div>`;
  }).join('');
  const body = `
<section class="hero"><div class="wrap">
<div class="lab">${YEAR} ${gzKo(yearGz)}(${yearGz})년</div>
<h1>${YEAR}년 띠별 신년운세</h1>
<p>${YEAR}년은 ${gzKo(yearGz)}년, 붉은 양의 해예요. 입춘(양력 2월 4일 무렵)부터 한 해가 바뀌어요. 내 띠를 눌러 자세히 보세요.</p>
</div></section>
<main class="wrap">
<section class="sec">${ttiGrid(null)}</section>
<section class="sec"><h2><span class="seal">一</span>12띠 ${YEAR}년 총운</h2><div class="card list">${items}</div></section>
<section class="cta">
<h3>띠 운세는 같은 해에 태어난 모두의 이야기예요</h3>
<p>생일과 태어난 시간을 넣으면 내 사주로 ${YEAR}년 열두 달을 날짜까지 풀어 드려요.</p>
<a class="btn" href="/tojung?${utm('hub')}">내 생일로 ${YEAR} 신년운세 보기</a>
<a class="sub" href="/?${utm('hub_today')}">오늘의 띠 운세는 무료로 보기</a>
</section>
<p class="note">띠(태어난 해의 지지)와 ${YEAR}년 ${gzKo(yearGz)}년의 관계, 태어난 해의 천간을 명리학 원리에 따라 본 참고용 풀이예요.</p>
</main>`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${YEAR}년 띠별 신년운세`, description: desc, inLanguage: 'ko', url: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE } };
  write(`unse/${YEAR}`, page({ title, desc, canonical, body, jsonld }));
}

// ── sitemap (앱 주요 주소 + 이 페이지들)
const today = new Date().toISOString().slice(0, 10);
const appUrls = [['/', '1.0'], ['/daily', '0.9'], ['/dream', '0.9'], ['/premium', '0.9'], ['/tojung', '0.9'], ['/compat', '0.8'], ['/topic/love', '0.8'], ['/topic/wealth', '0.8'], ['/topic/reunion', '0.8'], ['/topic/exam', '0.8'], ['/topic/marriage', '0.7'], ['/topic/career', '0.7'], ['/terms', '0.3'], ['/privacy', '0.3']];
const urls = [...appUrls.map(([u, p]) => ({ u, p })), ...out.map((u) => ({ u, p: u === `/unse/${YEAR}/` ? '0.9' : '0.8' }))];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(({ u, p }) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><priority>${p}</priority></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);
console.log(`검색용 페이지 ${out.length}개, sitemap ${urls.length}개 주소`);
