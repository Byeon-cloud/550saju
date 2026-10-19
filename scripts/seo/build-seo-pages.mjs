/**
 * 검색용 정적 페이지 만들기 (2026-10-16) — 웹 빌드(npm run build) 뒤에 dist/ 에 HTML 을 쓴다. 앱 빌드(build:ait)에는 붙지 않는다.
 *
 *   /unse/2027/          2027 띠별 신년운세 모음
 *   /unse/2027/{띠}/     띠마다 한 장 (총운, 좋은 달, 조심할 달, 출생 연도별 여섯 줄)
 *   내용은 src/data/seo/tti-2027.json (scripts/seo/gen-tti-year.cjs 가 확정표로 만든 것). 네이버는 JS 를 거의 안 돌려
 *   SPA 첫 화면이 비어 보이므로 글이 HTML 에 그대로 있어야 색인된다. 화면의 버튼은 앱(SPA)으로 utm 을 달아 보낸다.
 *   /kkum/               꿈해몽 모음, /kkum/{꿈}/ 꿈마다 한 장 (2026-10-17, 시험 E10). 내용은 src/data/seo/kkum.json
 *                        (scripts/seo/gen-kkum.cjs, 목록은 kkum-symbols.cjs). 버튼은 무료 꿈해몽으로 꿈 내용을 채워 보낸다.
 *   /gunghap/            띠별 궁합표, /gunghap/{띠}-{띠}/ 78쌍 (2026-10-17, 시험 W4). 내용은 src/data/seo/gunghap.json
 *                        (scripts/seo/gen-gunghap.cjs, 관계는 계산). 버튼은 두 사람 생일 궁합(/compat)으로 보낸다.
 *   /ilju/               60일주 모음, /ilju/{slug}/ 일주마다 한 장 (2026-10-17). 확정표 scripts/seo/ilju-facts.cjs, 글 src/data/seo/ilju.json
 *   sitemap.xml 도 여기서 다시 쓴다(기존 주소 + 이 페이지들).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { skySvg, SKY_CSS } from './sky.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');

// 2026-10-19 사주500 띠 동물 그림 — 앱과 같은 원본(src/components/tti/ttiAnimalSvg.ts)을 esbuild 로 읽어 쓴다 (그림은 한 곳에서만 고친다)
const { transformSync } = await import('esbuild');
const animalJs = transformSync(fs.readFileSync(path.join(ROOT, 'src/components/tti/ttiAnimalSvg.ts'), 'utf8'), { loader: 'ts', format: 'esm' }).code;
const { ttiAnimalSvg } = await import('data:text/javascript;base64,' + Buffer.from(animalJs).toString('base64'));
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
.gr{font-weight:800;color:#7A5C2E}.gr.warn{color:#A23A2A}
.case{padding:14px 0;border-top:1px solid #E1D7C4}.case:first-child{border-top:0;padding-top:0}
.case h3{font-size:16.5px;font-weight:800;margin-bottom:3px;display:flex;justify-content:space-between;gap:10px}.case h3 .gr{font-size:14px;flex-shrink:0}
.case p{font-size:15.5px;color:#2E2720}.case a{font-size:14px;font-weight:700;color:#7A5C2E;text-decoration:none}
.txt{font-size:15.5px;color:#2E2720}.txt+.txt{margin-top:10px}
.faq dt{font-weight:800;font-size:16px;margin-top:14px}.faq dt:first-child{margin-top:0}.faq dd{font-size:15.5px;color:#2E2720;margin-top:2px}
.ani{display:flex;gap:10px;margin-bottom:8px}.ani svg{display:block}.ani-s{display:inline-block;vertical-align:-6px;margin-right:6px}.grid a svg{display:block;margin:0 auto 2px}
.links{display:flex;flex-wrap:wrap;gap:8px}.links a{background:#FFFDF8;border:1px solid #E1D7C4;border-radius:12px;padding:8px 12px;font-size:15px;font-weight:700;text-decoration:none}
`;

function page({ title, desc, canonical, body, jsonld }) {
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="naver-site-verification" content="191f536a7d2aa759d8892f3c4b69667a84b7d708">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="사주500">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og/${/\/manse\//.test(canonical) ? 'manse' : /\/kkum\//.test(canonical) ? 'dream' : /\/gunghap\//.test(canonical) ? 'compat' : /\/ilju\//.test(canonical) ? 'premium' : /\/unse\/\d{4}\//.test(canonical) ? 'tojung' : 'default'}.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700;900&display=swap">
<style>${CSS}</style>
${(Array.isArray(jsonld) ? jsonld : [jsonld]).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('')}
</head><body>
<header class="wrap top"><a class="brand" href="/">사주<b>500</b></a><a class="go" href="/?${utm('top')}">오늘의 운세 보기</a></header>
${body}
<nav class="wrap" style="margin-top:30px;font-size:14.5px;font-weight:700;display:flex;flex-wrap:wrap;gap:6px 14px"><a href="/manse/">무료 만세력</a><a href="/unse/today/">오늘의 띠별 운세</a><a href="/unse/2027/">2027년 띠별 운세</a><a href="/unse/2027/samjae/">2027년 삼재</a><a href="/unse/2027/tojeong/">2027 토정비결</a><a href="/unse/suneung/">수능 날 운세</a><a href="/gunghap/">띠별 궁합표</a><a href="/kkum/">꿈해몽 모음</a><a href="/ilju/">60일주 총정리</a></nav>
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
    return `<a href="/unse/${YEAR}/${slug}/"${z === current ? ' class="on"' : ''}>${ttiAnimalSvg(z, 28, z === current ? '#F4EFE4' : undefined, z === current ? '#1A1612' : undefined)}${name}<small>${yy.slice(0, 3).join(' ')}<br>${yy.slice(3).join(' ')}</small></a>`;
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
<div class="ani">${ttiAnimalSvg(z, 60, '#F4EFE4', '#1A1612', '#D0705E')}</div>
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
<a class="sub" href="/tojung?${utm(slug + '_mail')}#deadline-mail">출시 기념가 마감 전에 메일로 알림 받기</a>
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
    return `<div class="item"><h3><span class="ani-s">${ttiAnimalSvg(z, 26)}</span>${name}<small>${ys}년생</small></h3><p>${esc(data.tti[z].head)}</p><a class="more" href="/unse/${YEAR}/${slug}/">${name} 좋은 달과 출생 연도별 운세 보기 ›</a></div>`;
  }).join('');
  const body = `
<section class="hero"><div class="wrap">
<div class="lab">${YEAR} ${gzKo(yearGz)}(${yearGz})년</div>
<h1>${YEAR}년 띠별 신년운세</h1>
<p>${YEAR}년은 ${gzKo(yearGz)}년, 붉은 양의 해예요. 입춘(양력 2월 4일 무렵)부터 한 해가 바뀌어요. 내 띠를 눌러 자세히 보세요.</p>
</div></section>
<main class="wrap">
<section class="sec">${ttiGrid(null)}<a class="btn" style="margin-top:12px" href="/tti/${YEAR}?utm_source=seo&amp;utm_medium=organic&amp;utm_campaign=tti_board_${YEAR}">열두 띠 한 장으로 보고 가족에게 보내기</a></section>
<section class="sec"><h2><span class="seal">一</span>12띠 ${YEAR}년 총운</h2><div class="card list">${items}</div></section>
<section class="cta">
<h3>띠 운세는 같은 해에 태어난 모두의 이야기예요</h3>
<p>생일과 태어난 시간을 넣으면 내 사주로 ${YEAR}년 열두 달을 날짜까지 풀어 드려요.</p>
<a class="btn" href="/tojung?${utm('hub')}">내 생일로 ${YEAR} 신년운세 보기</a>
<a class="sub" href="/?${utm('hub_today')}">오늘의 띠 운세는 무료로 보기</a>
<a class="sub" href="/tojung?${utm('hub_mail')}#deadline-mail">출시 기념가 마감 전에 메일로 알림 받기</a>
</section>
<p class="note">띠(태어난 해의 지지)와 ${YEAR}년 ${gzKo(yearGz)}년의 관계, 태어난 해의 천간을 명리학 원리에 따라 본 참고용 풀이예요.</p>
</main>`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${YEAR}년 띠별 신년운세`, description: desc, inLanguage: 'ko', url: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE } };
  write(`unse/${YEAR}`, page({ title, desc, canonical, body, jsonld }));
}

// ── 꿈해몽 (2026-10-17, 시험 E10)
{
  const require = createRequire(import.meta.url);
  const SYMBOLS = require(path.join(ROOT, 'scripts/seo/kkum-symbols.cjs'));
  const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/seo/kkum.json'), 'utf8')).items;
  const CAT = [
    ['animal', '동물이 나오는 꿈'], ['water', '물과 관련된 꿈'], ['death', '죽음과 이별의 꿈'], ['people', '사람이 나오는 꿈'],
    ['flying', '하늘을 나는 꿈과 떨어지는 꿈'], ['chase', '쫓기는 꿈과 헤매는 꿈'], ['money', '돈과 재물의 꿈'], ['nature', '자연과 날씨 꿈'], ['other', '몸과 물건, 그 밖의 꿈'],
  ];
  const kutm = (slug) => `utm_source=seo&utm_medium=organic&utm_campaign=kkum_${slug}`;
  const grade = (g) => `<span class="gr${g === '주의' || g === '흉몽' ? ' warn' : ''}">${esc(g)}</span>`;
  const dreamLink = (sym, text, tag) => `/dream?c=${sym.cat}&amp;q=${encodeURIComponent(`${text}을 꿨어요. `)}&amp;${kutm(sym.slug + (tag ? '_' + tag : '')).replace(/&/g, '&amp;')}`;
  const syms = SYMBOLS.filter((s) => K[s.slug]);
  for (const sym of syms) {
    const x = K[sym.slug];
    const canonical = `${SITE}/kkum/${sym.slug}/`;
    const caseNames = x.cases.slice(0, 3).map((c) => c.title.replace(/ 꿈$/, '')).join(', ');
    const title = `${sym.name} 해몽 | ${caseNames} 꿈 풀이 - 사주500`;
    const desc = `${firstSentence(x.summary)} ${x.cases.map((c) => c.title).slice(0, 5).join(', ')} 등 상황별 ${x.cases.length}가지 풀이와 사주로 보는 법까지.`;
    const cases = x.cases.map((c, i) => `<div class="case"><h3>${esc(c.title)}${grade(c.grade)}</h3><p>${esc(c.text)}</p><a href="${dreamLink(sym, c.title, 'c' + (i + 1))}">이 꿈을 내 사주로 풀어 보기 ›</a></div>`).join('');
    const same = syms.filter((s) => s.cat === sym.cat && s.slug !== sym.slug);
    const others = (same.length >= 4 ? same : [...same, ...syms.filter((s) => s.cat !== sym.cat)]).slice(0, 8);
    const body = `
<section class="hero"><div class="wrap">
<div class="lab">꿈해몽</div>
<h1>${esc(sym.name)} 해몽</h1>
<p>${esc(x.summary)}</p>
</div></section>
<main class="wrap">
<section class="sec"><h2><span class="seal">一</span>${esc(sym.name)}의 뜻</h2><div class="card"><p class="lead">판정 ${grade(x.grade)}</p><p class="txt" style="margin-top:6px">${esc(x.meaning)}</p></div></section>
<section class="sec"><h2><span class="seal">二</span>상황별 ${esc(sym.name)} 풀이</h2><div class="card">${cases}</div></section>
<section class="sec"><h2><span class="seal">三</span>사주로 보면</h2><div class="card"><p class="txt">${esc(x.saju)}</p><p class="txt"><b>꿈을 꾼 날</b> ${esc(x.todo)}</p></div></section>
<section class="cta">
<h3>내가 꾼 ${esc(sym.name)}, 내 사주로는 어떻게 읽힐까요</h3>
<p>꿈 내용을 적으면 내 사주 여덟 글자와 엮어 풀어 드려요. 하루 한 번 무료예요.</p>
<a class="btn" href="${dreamLink(sym, sym.name, 'main')}">내 꿈 무료로 풀어 보기</a>
<a class="sub" href="/kkum/?${kutm(sym.slug + '_hub').replace(/&/g, '&amp;')}">다른 꿈해몽 보기</a>
</section>
<section class="sec"><h2><span class="seal">四</span>자주 묻는 질문</h2><div class="card"><dl class="faq">${x.faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl></div></section>
<section class="sec"><h2>비슷한 꿈해몽</h2><div class="links">${others.map((s) => `<a href="/kkum/${s.slug}/">${esc(s.name)}</a>`).join('')}</div></section>
<p class="note">오래 전해 온 해몽과 명리학의 오행 원리로 본 참고용 풀이예요. 같은 꿈도 꾼 사람과 요즘 형편에 따라 다르게 읽혀요.</p>
</main>`;
    const jsonld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: `${sym.name} 해몽`, description: desc, inLanguage: 'ko', mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE }, datePublished: '2026-10-17', dateModified: (x.generatedAt || '2026-10-17').slice(0, 10) },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: x.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ];
    write(`kkum/${sym.slug}`, page({ title, desc, canonical, body, jsonld }));
  }
  // 모음
  const canonical = `${SITE}/kkum/`;
  const title = '꿈해몽 모음 | 뱀 꿈, 돼지꿈, 이빨 빠지는 꿈, 똥꿈 풀이 - 사주500';
  const desc = `뱀 꿈, 돼지꿈, 이빨 빠지는 꿈, 똥꿈, 죽는 꿈, 돈 꿈까지 꿈 ${syms.length}가지를 상황별로 풀었어요. 길몽인지 흉몽인지, 꿈을 꾼 날 무엇을 하면 좋은지 알려 드려요.`;
  const cats = CAT.map(([id, label]) => {
    const list = syms.filter((s) => s.cat === id);
    if (!list.length) return '';
    return `<section class="sec"><h2>${esc(label)}</h2><div class="card list">${list.map((s) => `<div class="item"><h3>${esc(s.name)}<small>${esc(K[s.slug].grade)}</small></h3><p>${esc(firstSentence(K[s.slug].summary))}</p><a class="more" href="/kkum/${s.slug}/">${esc(s.name)} 상황별 풀이 보기 ›</a></div>`).join('')}</div></section>`;
  }).join('');
  const body = `
<section class="hero"><div class="wrap">
<div class="lab">꿈해몽</div>
<h1>꿈해몽 모음</h1>
<p>간밤에 꾼 꿈이 좋은 꿈인지 궁금할 때 찾아보세요. 꿈 ${syms.length}가지를 상황별로 풀었어요.</p>
</div></section>
<main class="wrap">
<section class="sec"><div class="links">${syms.slice(0, 12).map((s) => `<a href="/kkum/${s.slug}/">${esc(s.name)}</a>`).join('')}</div></section>
${cats}
<section class="cta">
<h3>목록에 없는 꿈도 풀어 드려요</h3>
<p>꿈 내용을 그대로 적으면 내 사주와 엮어 풀어 드려요. 하루 한 번 무료예요.</p>
<a class="btn" href="/dream?${kutm('hub').replace(/&/g, '&amp;')}">내 꿈 무료로 풀어 보기</a>
<a class="sub" href="/unse/today/?${kutm('hub_today').replace(/&/g, '&amp;')}">오늘의 띠별 운세 보기</a>
</section>
<p class="note">오래 전해 온 해몽과 명리학의 오행 원리로 본 참고용 풀이예요.</p>
</main>`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '꿈해몽 모음', description: desc, inLanguage: 'ko', url: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE } };
  write('kkum', page({ title, desc, canonical, body, jsonld }));
}

// ── 띠 궁합 (2026-10-17, 시험 W4)
{
  const require = createRequire(import.meta.url);
  const { pairs, REL_PLAIN } = require(path.join(ROOT, 'scripts/seo/gen-gunghap.cjs'));
  const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/seo/gunghap.json'), 'utf8')).items;
  const PS = pairs().filter((p) => G[p.key]);
  const gutm = (c) => `utm_source=seo&amp;utm_medium=organic&amp;utm_campaign=gunghap_${c}`;
  const nm = (z) => T[z][1];
  const keyOf = (a, b) => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? `${T[a][0]}-${T[b][0]}` : `${T[b][0]}-${T[a][0]}`);
  const yearsOf = (z) => { const o = []; for (let y = 1941; y <= 2012; y++) if (ZHI[(((y - 4) % 12) + 12) % 12] === z) o.push(y); return o; };
  const isGood = (p) => p.rels.includes('육합') || p.rels.includes('삼합');
  const isHard = (p) => p.rels.includes('충') || p.rels.includes('원진');
  const relLine = (p) => (p.a === p.b ? (p.selfHyung ? '같은 띠끼리(같은 기운이 겹쳐 고집이 부딪히기도 함)' : '같은 띠끼리(서로를 잘 알지만 같은 약점도 겹침)')
    : p.rels.length ? p.rels.map((r) => REL_PLAIN[r]).join(', ') : '특별한 관계 없음(크게 끌리지도 부딪히지도 않아 노력한 만큼 가까워짐)');
  const chips = (z, cur) => `<div class="links">${ORDER.map((x) => { const k = keyOf(z, x); return `<a href="/gunghap/${k}/"${k === cur ? ' style="background:#1A1612;color:#F4EFE4;border-color:#1A1612"' : ''}>${esc(nm(z))} ${esc(nm(x))}</a>`; }).join('')}</div>`;
  for (const p of PS) {
    const x = G[p.key];
    const na = nm(p.a); const nb = nm(p.b); const same = p.a === p.b;
    const canonical = `${SITE}/gunghap/${p.key}/`;
    const title = same ? `${na} ${na} 궁합 | 같은 ${na}끼리 연애, 결혼, 친구 궁합 - 사주500` : `${na} ${nb} 궁합 | ${na}와 ${nb} 연애, 결혼, 친구 궁합 - 사주500`;
    const yy = (z) => yearsOf(z).map((y) => String(y % 100).padStart(2, '0')).join(', ');
    const desc = `${firstSentence(x.head)} 연인과 부부로 만났을 때, 친구와 동료로 만났을 때, 잘 지내는 법까지 풀었어요. ${na}(${yy(p.a)}년생)${same ? '' : `, ${nb}(${yy(p.b)}년생)`}.`;
    const faqs = [x.faq, ...(same ? [] : [{ q: `남자 ${na} 여자 ${nb}와 남자 ${nb} 여자 ${na}는 궁합이 다른가요?`, a: '띠 궁합은 두 띠의 관계라 남녀를 바꿔도 같게 봅니다. 남녀에 따라 달라지는 부분은 두 사람의 생일과 태어난 시간으로 보는 사주 궁합에서 드러납니다.' }])];
    const body = `
<section class="hero"><div class="wrap">
<div class="ani">${ttiAnimalSvg(p.a, 56, '#F4EFE4', '#1A1612', '#D0705E')}${same ? '' : ttiAnimalSvg(p.b, 56, '#F4EFE4', '#1A1612', '#D0705E')}</div>
<div class="lab">띠 궁합</div>
<h1>${esc(na)} ${esc(nb)} 궁합</h1>
<p>${esc(x.head)}</p>
</div></section>
<main class="wrap">
<section class="sec"><h2><span class="seal">一</span>두 띠의 관계</h2><div class="card">
<div class="row"><div class="k">궁합</div><div class="v"><span class="gr${isHard(p) ? ' warn' : ''}">${esc(x.label)}</span></div></div>
<div class="row"><div class="k">관계</div><div class="v">${esc(relLine(p))}</div></div>
<div class="row"><div class="k">오행</div><div class="v">${esc(x.oheng)}</div></div>
<div class="row"><div class="k">${esc(na)}<small>출생 연도</small></div><div class="v">${yearsOf(p.a).join(', ')}년생</div></div>
${same ? '' : `<div class="row"><div class="k">${esc(nb)}<small>출생 연도</small></div><div class="v">${yearsOf(p.b).join(', ')}년생</div></div>`}
</div></section>
<section class="sec"><h2><span class="seal">二</span>연인과 부부로 만나면</h2><div class="card"><p class="txt">${esc(x.love)}</p></div></section>
<section class="sec"><h2><span class="seal">三</span>친구와 동료로 만나면</h2><div class="card"><p class="txt">${esc(x.friend)}</p></div></section>
<section class="sec"><h2><span class="seal">四</span>잘 지내는 법</h2><div class="card"><p class="txt">${esc(x.tip)}</p></div></section>
<section class="cta">
<h3>같은 띠라도 생일이 다르면 궁합이 달라요</h3>
<p>두 사람의 생일로 사주 여덟 글자를 맞춰 보면 누가 무엇을 채워 주는지, 언제 부딪히는지까지 보여요.</p>
<a class="btn" href="/compat?${gutm(p.key)}">두 사람 생일로 궁합 보기</a>
<a class="sub" href="/gunghap/?${gutm(p.key + '_hub')}">띠별 궁합표 보기</a>
</section>
<section class="sec"><h2><span class="seal">五</span>자주 묻는 질문</h2><div class="card"><dl class="faq">${faqs.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl></div></section>
<section class="sec"><h2>${esc(na)}와 다른 띠 궁합</h2>${chips(p.a, p.key)}</section>
${same ? '' : `<section class="sec"><h2>${esc(nb)}와 다른 띠 궁합</h2>${chips(p.b, p.key)}</section>`}
<p class="note">띠(태어난 해의 지지)끼리의 관계와 오행을 명리학 원리로 본 참고용 풀이예요. 띠 궁합은 태어난 해 하나만 본 큰 흐름이에요.</p>
</main>`;
    const jsonld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: `${na} ${nb} 궁합`, description: desc, inLanguage: 'ko', mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE }, datePublished: '2026-10-17', dateModified: (x.generatedAt || '2026-10-17').slice(0, 10) },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ];
    write(`gunghap/${p.key}`, page({ title, desc, canonical, body, jsonld }));
  }
  // 띠별 궁합표
  const canonical = `${SITE}/gunghap/`;
  const title = '띠별 궁합표 | 12띠 잘 맞는 띠와 부딪히는 띠 총정리 - 사주500';
  const desc = '쥐띠부터 돼지띠까지 12띠마다 잘 맞는 띠, 부딪히는 띠, 서운한 띠를 한눈에 정리했어요. 띠 궁합 78쌍의 연애, 결혼, 친구 궁합도 볼 수 있어요.';
  const secs = ORDER.map((z) => {
    const mine = ORDER.map((o) => PS.find((p) => p.key === keyOf(z, o))).filter(Boolean);
    const list = (f) => mine.filter((p) => p.a !== p.b && f(p)).map((p) => nm(p.a === z ? p.b : p.a));
    const good = list(isGood); const hard = list((p) => p.rels.includes('충')); const sad = list((p) => p.rels.includes('원진') && !p.rels.includes('충'));
    return `<section class="sec" id="${T[z][0]}"><h2><span class="seal">${z}</span>${esc(nm(z))} 궁합</h2><div class="card">
<div class="row"><div class="k">잘 맞는 띠</div><div class="v">${esc(good.join(', ') || '없음')}</div></div>
<div class="row"><div class="k">부딪히는 띠</div><div class="v">${esc(hard.join(', ') || '없음')}</div></div>
<div class="row"><div class="k">서운한 띠</div><div class="v">${esc(sad.join(', ') || '없음')}</div></div>
<div class="row"><div class="k">출생 연도</div><div class="v">${yearsOf(z).join(', ')}년생</div></div>
</div><div style="margin-top:10px">${chips(z, null)}</div></section>`;
  }).join('');
  const body = `
<section class="hero"><div class="wrap">
<div class="lab">띠 궁합</div>
<h1>띠별 궁합표</h1>
<p>내 띠를 찾아 잘 맞는 띠와 부딪히는 띠를 보세요. 띠 이름을 누르면 두 띠의 연애, 결혼, 친구 궁합이 나와요.</p>
</div></section>
<main class="wrap">
<nav class="sec"><div class="grid">${ORDER.map((z) => `<a href="#${T[z][0]}">${esc(nm(z))}</a>`).join('')}</div></nav>
${secs}
<section class="cta">
<h3>띠 궁합은 태어난 해 하나만 본 큰 흐름이에요</h3>
<p>두 사람의 생일과 태어난 시간으로 보면 누가 무엇을 채워 주는지, 언제 부딪히는지까지 보여요.</p>
<a class="btn" href="/compat?${gutm('hub')}">두 사람 생일로 궁합 보기</a>
<a class="sub" href="/unse/2027/?${gutm('hub_newyear')}">2027년 띠별 신년운세 보기</a>
</section>
<p class="note">잘 맞는 띠는 짝을 이루거나 한편이 되는 띠, 부딪히는 띠는 정면으로 맞서는 띠, 서운한 띠는 괜히 밉다가도 정이 드는 띠예요. 명리학의 지지 관계로 본 참고용 풀이예요.</p>
</main>`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '띠별 궁합표', description: desc, inLanguage: 'ko', url: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE } };
  write('gunghap', page({ title, desc, canonical, body, jsonld }));
}

// ── 60일주 (2026-10-17) — '갑자일주', '병오일주 특징' 검색
{
  const require = createRequire(import.meta.url);
  const { GAPJA, iljuFacts, OH_PLAIN, GAN_KO, ZHI_KO } = require(path.join(ROOT, 'scripts/seo/ilju-facts.cjs'));
  const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/seo/ilju.json'), 'utf8')).items;
  const iutm = (c) => `utm_source=seo&amp;utm_medium=organic&amp;utm_campaign=ilju_${c}`;
  const F = Object.fromEntries(GAPJA.map((g) => [g, iljuFacts(g)]));
  const list = GAPJA.filter((g) => J[g]);
  const SIP_PLAIN = { 비견: '나와 같은 기운', 겁재: '나와 같은 기운(경쟁)', 식신: '내가 내는 기운(재주, 여유)', 상관: '내가 내는 기운(말과 표현)', 편재: '내가 다스리는 기운(바깥 돈)', 정재: '내가 다스리는 기운(정해진 돈)', 편관: '나를 단련하는 기운', 정관: '나를 바르게 하는 기운', 편인: '나를 돕는 기운(생각)', 정인: '나를 돕는 기운(배움)' };
  for (const g of list) {
    const f = F[g]; const x = J[g];
    const name = `${f.ko}일주`;
    const canonical = `${SITE}/ilju/${f.slug}/`;
    const title = `${name} 특징 | ${name} 성격, 연애, 배우자, 직업, 잘 맞는 일주 - 사주500`;
    const desc = `${firstSentence(x.summary)} ${name}(${g})의 성격과 연애, 배우자 자리, 일과 재물, 조심할 점, 잘 맞는 일주까지 명리학으로 풀었어요.`;
    const p2 = F[f.hapPartner];
    const rows = [
      ['일간', `${GAN_KO[g[0]]}(${g[0]}), ${f.yang ? '양' : '음'}의 ${OH_PLAIN[f.ganOh]}`],
      ['일지', `${ZHI_KO[g[1]]}(${g[1]}), ${OH_PLAIN[f.zhiOh]}`],
      ['배우자 자리', `${f.spouseSip}, ${SIP_PLAIN[f.spouseSip] || ''}`],
      ['12운성', `${f.stage}, ${f.stagePlain}`],
      ['일주 신살', f.sinsal.length ? f.sinsal.join(', ') : '없음'],
      ['잘 맞는 일주', `<a href="/ilju/${p2.slug}/" style="color:#7A5C2E;font-weight:700">${esc(p2.ko)}일주</a> (천간합과 지지육합이 함께 맞는 짝)`],
      ['부딪히는 글자', `${f.chungZhiKo}(${f.chungZhi}), 이 글자가 오는 해와 달에는 큰 결정을 천천히`],
    ].map(([k, v]) => `<div class="row"><div class="k">${esc(k)}</div><div class="v">${k === '잘 맞는 일주' ? v : esc(v)}</div></div>`).join('');
    const sameGan = list.filter((y) => y[0] === g[0] && y !== g);
    const body = `
<section class="hero"><div class="wrap">
<div class="lab">일주론</div>
<h1>${esc(name)} (${g})</h1>
<p>${esc(x.summary)}</p>
</div></section>
<main class="wrap">
<section class="sec"><h2><span class="seal">一</span>${esc(name)}의 바탕</h2><div class="card">${rows}</div></section>
<section class="sec"><h2><span class="seal">二</span>성격과 장단점</h2><div class="card"><p class="txt">${esc(x.personality)}</p></div></section>
<section class="sec"><h2><span class="seal">三</span>연애와 배우자</h2><div class="card"><p class="txt">${esc(x.love)}</p></div></section>
<section class="sec"><h2><span class="seal">四</span>일과 재물</h2><div class="card"><p class="txt">${esc(x.work)}</p></div></section>
<section class="sec"><h2><span class="seal">五</span>조심할 점</h2><div class="card"><p class="txt">${esc(x.care)}</p>${x.sinsal ? `<p class="txt"><b>${esc(f.sinsal.join(', '))}</b> ${esc(x.sinsal)}</p>` : ''}</div></section>
<section class="cta">
<h3>같은 ${esc(name)}라도 태어난 달과 시간이 다르면 사주가 달라요</h3>
<p>생일과 태어난 시간을 넣으면 여덟 글자 전체로 오늘 하루를 풀어 드려요. 하루 한 번 무료예요.</p>
<a class="btn" href="/daily?${iutm(f.slug)}">내 사주로 오늘의 운세 무료로 보기</a>
<a class="sub" href="/unse/today/ilju/?${iutm(f.slug + '_today')}#${f.slug}">오늘의 ${esc(name)} 운세 보기</a>
<a class="sub" href="/daily?${iutm(f.slug + '_mail')}#daily-mail">매일 아침 ${esc(name)} 운세 메일로 받기</a>
<a class="sub" href="/premium?${iutm(f.slug + '_premium')}">평생 사주 풀이(종합사주) 보기</a>
</section>
<section class="sec"><h2><span class="seal">六</span>자주 묻는 질문</h2><div class="card"><dl class="faq">${x.faq.map((q) => `<dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd>`).join('')}</dl></div></section>
<section class="sec"><h2>같은 ${esc(GAN_KO[g[0]])}${esc(f.ganOh)} 일간의 다른 일주</h2><div class="links">${sameGan.map((y) => `<a href="/ilju/${F[y].slug}/">${esc(F[y].ko)}일주</a>`).join('')}<a href="/ilju/">60일주 전체</a></div></section>
<p class="note">일주(태어난 날의 간지)만 본 참고용 풀이예요. 사주는 태어난 해, 달, 날, 시간의 여덟 글자와 대운을 함께 봐야 정확해요.</p>
</main>`;
    const jsonld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: `${name} 특징`, description: desc, inLanguage: 'ko', mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE }, datePublished: '2026-10-17', dateModified: (x.generatedAt || '2026-10-17').slice(0, 10) },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: x.faq.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })) },
    ];
    write(`ilju/${f.slug}`, page({ title, desc, canonical, body, jsonld }));
  }
  // 60일주 모음
  const canonical = `${SITE}/ilju/`;
  const title = '60일주 총정리 | 일주별 성격, 연애, 배우자, 직업 특징 - 사주500';
  const desc = '갑자일주부터 계해일주까지 60일주의 성격과 연애, 배우자 자리, 일과 재물, 잘 맞는 일주를 명리학으로 정리했어요. 내 일주를 눌러 보세요.';
  const groups = '甲乙丙丁戊己庚辛壬癸'.split('').map((gan) => {
    const ys = list.filter((y) => y[0] === gan);
    return `<section class="sec"><h2><span class="seal">${gan}</span>${esc(GAN_KO[gan])}${esc(F[ys[0]]?.ganOh || '')} 일간</h2><div class="card list">${ys.map((y) => `<div class="item"><h3>${esc(F[y].ko)}일주<small>${y}</small></h3><p>${esc(firstSentence(J[y].summary))}</p><a class="more" href="/ilju/${F[y].slug}/">${esc(F[y].ko)}일주 특징 보기 ›</a></div>`).join('')}</div></section>`;
  }).join('');
  const body = `
<section class="hero"><div class="wrap">
<div class="lab">일주론</div>
<h1>60일주 총정리</h1>
<p>일주는 태어난 날의 간지예요. 사주에서 나 자신을 뜻하는 자리라 성격과 배우자 자리를 볼 때 가장 먼저 봐요.</p>
</div></section>
<main class="wrap">
<section class="sec"><div class="links">${list.map((y) => `<a href="/ilju/${F[y].slug}/">${esc(F[y].ko)}</a>`).join('')}</div></section>
${groups}
<section class="cta">
<h3>내 일주를 모르겠다면</h3>
<p>생일만 넣으면 내 일주와 여덟 글자로 오늘 하루를 풀어 드려요. 하루 한 번 무료예요.</p>
<a class="btn" href="/daily?${iutm('hub')}">생일 넣고 내 일주 보기</a>
<a class="sub" href="/daily?${iutm('hub_mail')}#daily-mail">매일 아침 내 일주 운세 메일로 받기</a>
</section>
<p class="note">일주만 본 참고용 풀이예요. 사주는 여덟 글자와 대운을 함께 봐야 정확해요.</p>
</main>`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '60일주 총정리', description: desc, inLanguage: 'ko', url: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE } };
  write('ilju', page({ title, desc, canonical, body, jsonld }));
}

// ── 2027 신년 시즌 검색어 (2026-10-17) — '2027 삼재', '2027 토정비결'. 겁주는 말 없이 차분하게, 내 사주로 보는 신년운세로 잇는다.
{
  const nutm = (slug) => `utm_source=seo&utm_medium=organic&utm_campaign=newyear${YEAR}_${slug}`.replace(/&/g, '&amp;');
  const tLink = (z) => `<a href="/unse/${YEAR}/${T[z][0]}/">${T[z][1]} ${YEAR}년 운세</a>`;
  const ctaNewYear = (slug) => `<section class="cta">
<h3>띠만으로는 알 수 없는 내 ${YEAR}년</h3>
<p>사람을 고르면 결제 전에 내 사주로 본 ${YEAR}년이 어떤 해인지, 힘을 줄 달과 쉬어 갈 달을 무료로 먼저 보여 드려요. 부모님 사주도 넣어 두면 함께 볼 수 있어요.</p>
<a class="btn" href="/tojung?${nutm(slug)}">내 사주로 ${YEAR} 신년운세 미리 보기</a>
<a class="sub" href="/unse/${YEAR}/?${nutm(slug + '_hub')}">${YEAR}년 띠별 신년운세 보기</a>
</section>`;

  // 삼재 — 띠 묶음(삼합)마다 세 해. 신자진 띠는 인묘진 해, 사유축 띠는 해자축 해, 인오술 띠는 신유술 해, 해묘미 띠는 사오미 해
  const SAMJAE = [
    { tti: ['亥', '卯', '未'], years: [2025, 2026, 2027] },
    { tti: ['寅', '午', '戌'], years: [2028, 2029, 2030] },
    { tti: ['巳', '酉', '丑'], years: [2031, 2032, 2033] },
    { tti: ['申', '子', '辰'], years: [2034, 2035, 2036] },
  ];
  const STEP = ['들삼재', '눌삼재', '날삼재'];
  const names = (arr) => arr.map((z) => T[z][1]).join(', ');
  {
    const canonical = `${SITE}/unse/${YEAR}/samjae/`;
    const title = `${YEAR}년 삼재 띠는 돼지띠, 토끼띠, 양띠 (날삼재) | 사주500`;
    const desc = `${YEAR}년 ${gzKo(yearGz)}년 삼재는 돼지띠, 토끼띠, 양띠의 날삼재예요. 들삼재, 눌삼재, 날삼재의 차이와 띠별 삼재 연도, ${YEAR + 1}년부터 삼재가 드는 띠까지 정리했어요.`;
    const rows = SAMJAE.map((g) => `<div class="row"><div class="k">${names(g.tti)}</div><div class="v">${g.years.map((y, i) => `${y}년 ${gzKo(gzOf(y))}(${gzOf(y)}) ${STEP[i]}`).join('<br>')}</div></div>`).join('');
    const faq = [
      { q: `${YEAR}년 삼재인 띠는 무엇인가요?`, a: `돼지띠, 토끼띠, 양띠예요. ${YEAR - 2}년 들삼재, ${YEAR - 1}년 눌삼재에 이어 ${YEAR}년이 날삼재, 곧 삼재가 끝나는 해예요.` },
      { q: '날삼재는 어떤 해인가요?', a: '삼재 세 해 가운데 마지막 해예요. 옛 풀이에서는 그동안 쌓인 짐을 내려놓고 정리하는 해로 봐요. 새로 크게 벌이는 일보다 마무리할 일을 먼저 끝내라고 권해요.' },
      { q: `${YEAR + 1}년에 삼재가 드는 띠는요?`, a: `호랑이띠, 말띠, 개띠예요. ${YEAR + 1}년 ${gzKo(gzOf(YEAR + 1))}년이 들삼재, ${YEAR + 2}년이 눌삼재, ${YEAR + 3}년이 날삼재예요.` },
      { q: '삼재에는 이사나 결혼을 피해야 하나요?', a: '삼재는 태어난 해의 띠 한 글자만 보는 풀이라 같은 띠라도 사람마다 그 해 흐름이 달라요. 큰일을 앞두고 있다면 내 사주 여덟 글자로 그 해와 그 달이 나에게 어떤지 보고 정하는 편이 좋아요.' },
    ];
    const body = `
<section class="hero"><div class="wrap">
<div class="lab">${YEAR} ${gzKo(yearGz)}년 삼재</div>
<h1>${YEAR}년 삼재는<br>돼지띠, 토끼띠, 양띠</h1>
<p>${YEAR}년은 해묘미(亥卯未) 띠가 삼재를 마치는 날삼재 해예요.</p>
</div></section>
<main class="wrap">
<section class="sec"><h2><span class="seal">一</span>삼재란</h2><div class="card">
<p class="txt">삼재(三災)는 띠를 세 개씩 묶은 무리(삼합)마다 기운이 약해진다고 보는 세 해를 이르는 옛 풀이예요. 해묘미 띠(돼지, 토끼, 양)는 사오미(巳午未) 해, 인오술 띠(호랑이, 말, 개)는 신유술(申酉戌) 해, 사유축 띠(뱀, 닭, 소)는 해자축(亥子丑) 해, 신자진 띠(원숭이, 쥐, 용)는 인묘진(寅卯辰) 해가 삼재예요.</p>
<p class="txt">세 해를 차례로 들삼재(들어오는 해), 눌삼재(머무는 해), 날삼재(나가는 해)라고 불러요.</p>
</div></section>
<section class="sec"><h2><span class="seal">二</span>띠별 삼재 연도</h2><div class="card">${rows}</div></section>
<section class="sec"><h2><span class="seal">三</span>${YEAR}년 날삼재 띠</h2><div class="card">
<p class="txt">${YEAR}년 ${gzKo(yearGz)}(${yearGz})년은 돼지띠, 토끼띠, 양띠의 날삼재예요. 옛 풀이에서는 삼재가 빠져나가는 해라 지난 두 해 동안 미뤄 둔 일을 정리하고 마무리하기 좋은 때로 봐요.</p>
<p class="txt">띠별 ${YEAR}년 흐름은 여기서 볼 수 있어요.</p>
<div class="links" style="margin-top:10px">${['亥', '卯', '未'].map(tLink).join('')}</div>
</div></section>
<section class="sec"><h2><span class="seal">四</span>내 사주로 보면</h2><div class="card">
<p class="txt">삼재는 태어난 해의 띠 한 글자만 봐요. 명리에서는 한 해 흐름을 그 해의 간지와 내 사주 여덟 글자, 특히 나에게 필요한 기운(용신)이 어떻게 만나는지로 봐요. 그래서 같은 돼지띠라도 ${YEAR}년이 힘을 줄 해인 사람도 있고 쉬어 갈 해인 사람도 있어요.</p>
</div></section>
${ctaNewYear('samjae')}
<section class="sec"><h2><span class="seal">五</span>자주 묻는 질문</h2><div class="card"><dl class="faq">${faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl></div></section>
<p class="note">삼재는 띠로 보는 옛 풀이를 소개한 참고용 글이에요. 한 해 흐름은 사람마다 사주에 따라 달라요.</p>
</main>`;
    const jsonld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: `${YEAR}년 삼재 띠`, description: desc, inLanguage: 'ko', mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE }, datePublished: '2026-10-17', dateModified: '2026-10-17' },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ];
    write(`unse/${YEAR}/samjae`, page({ title, desc, canonical, body, jsonld }));
  }

  // 토정비결 — 무엇이고, 사주 신년운세와 무엇이 다른지. 사주500 신년운세는 토정비결 괘를 쓰지 않는다고 그대로 적는다
  {
    const canonical = `${SITE}/unse/${YEAR}/tojeong/`;
    const title = `${YEAR} 토정비결과 사주 신년운세, 무엇이 다를까 | 사주500`;
    const desc = `${YEAR}년 토정비결을 찾는 분께. 토정비결이 어떤 풀이인지, 태어난 시까지 보는 사주 신년운세와 무엇이 다른지, 내 사주로 ${YEAR}년 달마다 흐름을 미리 보는 법을 정리했어요.`;
    const faq = [
      { q: '토정비결은 무엇인가요?', a: '조선 중기 토정 이지함이 지었다고 전하는 한 해 운세 풀이예요. 태어난 해, 달, 날을 음력으로 셈해 괘를 하나 뽑고, 그 괘의 글로 한 해와 달마다 흐름을 봐요.' },
      { q: '사주 신년운세는 무엇이 다른가요?', a: '사주는 태어난 해, 달, 날, 시의 여덟 글자를 써요. 그 사람에게 필요한 기운(용신)을 먼저 찾고, 그 해와 각 달의 간지가 그 기운을 돕는지 막는지로 달마다 흐름을 봐요.' },
      { q: '사주500 신년운세는 토정비결인가요?', a: `토정비결 괘를 쓰지 않는 사주 방식이에요. ${YEAR}년 열두 달의 간지와 내 사주 여덟 글자로 힘을 줄 달, 쉬어 갈 달, 좋은 날과 조심할 날 날짜를 알려 드려요.` },
      { q: '태어난 시간을 모르면요?', a: '시간을 모르면 시주(태어난 시의 두 글자)를 빼고 여섯 글자로 봐요. 한 해 흐름은 대부분 그대로 볼 수 있어요.' },
    ];
    const body = `
<section class="hero"><div class="wrap">
<div class="lab">${YEAR} ${gzKo(yearGz)}년 한 해 운세</div>
<h1>${YEAR} 토정비결과<br>사주 신년운세</h1>
<p>한 해를 미리 보는 두 가지 풀이가 어떻게 다른지 정리했어요.</p>
</div></section>
<main class="wrap">
<section class="sec"><h2><span class="seal">一</span>토정비결</h2><div class="card">
<p class="txt">토정비결은 태어난 해, 달, 날을 음력으로 셈해 괘를 뽑고 그 괘의 글로 한 해를 보는 옛 풀이예요. 새해가 되면 집안 어른들이 한 해 운을 볼 때 많이 찾았어요.</p>
</div></section>
<section class="sec"><h2><span class="seal">二</span>사주 신년운세</h2><div class="card">
<p class="txt">사주 신년운세는 태어난 시까지 여덟 글자를 써요. 그 사람에게 필요한 기운을 먼저 찾고, ${YEAR}년 ${gzKo(yearGz)}년과 열두 달의 간지가 그 기운을 돕는지 막는지 봐서 달마다 흐름을 읽어요. 같은 해에 태어난 사람도 태어난 달, 날, 시가 다르면 풀이가 달라져요.</p>
</div></section>
<section class="sec"><h2><span class="seal">三</span>사주500 신년운세로 보는 것</h2><div class="card">
<div class="row"><div class="k">한 해</div><div class="v">${YEAR}년이 내 사주에 어떤 해인지, 일, 돈, 사람, 건강의 흐름</div></div>
<div class="row"><div class="k">열두 달</div><div class="v">달마다 힘을 줄지 쉬어 갈지, 그 달에 할 일</div></div>
<div class="row"><div class="k">날짜</div><div class="v">달마다 좋은 날과 조심할 날, 한 해 꼭 기억할 날</div></div>
</div></section>
${ctaNewYear('tojeong')}
<section class="sec"><h2><span class="seal">四</span>자주 묻는 질문</h2><div class="card"><dl class="faq">${faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl></div></section>
<section class="sec"><h2>함께 보면 좋은 글</h2><div class="links"><a href="/unse/${YEAR}/samjae/">${YEAR}년 삼재 띠</a><a href="/unse/${YEAR}/">${YEAR}년 띠별 신년운세</a></div></section>
<p class="note">토정비결은 옛 풀이를 소개한 내용이고, 사주500의 신년운세는 사주 여덟 글자로 봐요.</p>
</main>`;
    const jsonld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: `${YEAR} 토정비결과 사주 신년운세`, description: desc, inLanguage: 'ko', mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE }, datePublished: '2026-10-17', dateModified: '2026-10-17' },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ];
    write(`unse/${YEAR}/tojeong`, page({ title, desc, canonical, body, jsonld }));
  }
}

// ── 수능 날 운세 (2026-10-17) — 2027학년도 수능 2026-11-19(목) 정유일. 띠와 그날 지지의 관계, 문창귀인 일간은 계산(표)으로만.
//   결과를 약속하지 않는다. 수험생과 부모가 찾는 말이라 합격이직운(/topic/exam)과 무료 오늘의 운세로 잇는다.
{
  const D = { y: 2026, m: 11, d: 19, week: '목', gz: '丁酉' };
  const dz = D.gz[1];
  const LIU = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const SAMHAP = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];
  const CHUNG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
  const HAE = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
  const PA = { 子: '酉', 酉: '子', 卯: '午', 午: '卯', 辰: '丑', 丑: '辰', 未: '戌', 戌: '未', 寅: '亥', 亥: '寅', 巳: '申', 申: '巳' };
  const MUNCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
  const GAN_NAME = { 甲: '갑목', 乙: '을목', 丙: '병화', 丁: '정화', 戊: '무토', 己: '기토', 庚: '경금', 辛: '신금', 壬: '임수', 癸: '계수' };
  const rel = (z) => {
    if (z === dz) return ['같은 기운', '그날 지지와 띠가 같아요. 같은 글자가 겹치면 스스로를 다그치기 쉬우니, 평소 풀던 속도를 그대로 지키면 좋아요.'];
    if (LIU[z] === dz) return ['짝이 맞는 날', '그날 지지와 띠가 짝(육합)을 이뤄요. 마음이 덜 흔들리고 흐름이 순한 편이에요.'];
    if (SAMHAP.some((g) => g.includes(z) && g.includes(dz))) return ['같은 편 기운', '그날 지지와 띠가 한 무리(삼합)예요. 힘이 모이는 쪽이라 아는 문제를 끝까지 밀고 가기 좋아요.'];
    if (CHUNG[z] === dz) return ['부딪히는 날', '그날 지지와 띠가 마주 부딪혀요(충). 긴장이 커지기 쉬우니 전날 일찍 자고, 쉬는 시간마다 숨을 고르면 좋아요.'];
    if (HAE[z] === dz) return ['살짝 엇갈리는 날', '그날 지지와 띠가 서로 거슬려요(해). 답안 옮겨 적기와 수험표, 신분증을 한 번 더 확인하면 좋아요.'];
    if (PA[z] === dz) return ['살짝 어긋나는 날', '그날 지지와 띠가 조금 어긋나요(파). 시간 배분을 미리 정해 두고 그대로 지키면 좋아요.'];
    return ['무난한 날', '그날 지지와 띠 사이에 크게 걸리는 관계가 없어요. 준비한 만큼 그대로 보면 돼요.'];
  };
  const mcGan = Object.keys(MUNCHANG).filter((g) => MUNCHANG[g] === dz);
  const sutm = (slug) => `utm_source=seo&utm_medium=organic&utm_campaign=suneung2026_${slug}`.replace(/&/g, '&amp;');
  const canonical = `${SITE}/unse/suneung/`;
  const title = `2027학년도 수능 날 운세 (11월 19일 ${gzKo(D.gz)}일), 띠별 흐름과 합격운 | 사주500`;
  const desc = `2027학년도 수능은 2026년 11월 19일 목요일 ${gzKo(D.gz)}(${D.gz})일이에요. 띠마다 그날 흐름과 시험 전 챙길 것, 이날이 문창귀인 날인 사람, 내 사주로 보는 합격운까지 정리했어요.`;
  const rows = ORDER.map((z) => {
    const [label, text] = rel(z);
    return `<div class="row"><div class="k">${T[z][1]}<small>${esc(label)}</small></div><div class="v">${esc(text)}</div></div>`;
  }).join('');
  const faq = [
    { q: '2027학년도 수능은 언제인가요?', a: `2026년 11월 19일 목요일이에요. 간지로는 ${gzKo(D.gz)}(${D.gz})일이에요.` },
    { q: '문창귀인이 뭔가요?', a: '사주에서 공부와 글, 시험을 돕는다고 보는 별이에요. 태어난 날의 천간(일간)마다 정해진 지지가 있어서, 그 지지가 든 날을 문창귀인 날로 봐요.' },
    { q: '부딪히는 날이면 시험을 망치나요?', a: '그렇게 보지 않아요. 띠 하나로 보는 흐름이라 같은 띠라도 사람마다 달라요. 긴장이 커지기 쉬운 날이니 잠과 식사를 평소대로 지키라는 뜻으로 읽으면 돼요.' },
    { q: '내 사주로 합격운을 더 자세히 볼 수 있나요?', a: '합격이직운에서 내 사주의 시험 기운, 합격하기 좋은 때, 면접에 강한 시간까지 볼 수 있어요. 오늘의 운세는 하루 한 번 무료예요.' },
  ];
  const body = `
<section class="hero"><div class="wrap">
<div class="lab">2027학년도 수능</div>
<h1>수능 날은<br>11월 19일 ${gzKo(D.gz)}일</h1>
<p>2026년 11월 19일 목요일, ${gzKo(D.gz)}(${D.gz})일이에요. 띠마다 그날 흐름과 시험 전에 챙길 것을 정리했어요.</p>
</div></section>
<main class="wrap">
<section class="sec"><h2><span class="seal">一</span>수능 날의 기운</h2><div class="card">
<p class="txt">${gzKo(D.gz)}일은 천간 丁(정화, 촛불처럼 밝게 비추는 불)과 지지 酉(유금, 가을의 단단한 쇠)로 이뤄진 날이에요. 차분하게 집중하고 꼼꼼하게 마무리하는 데 힘이 실리는 날로 봐요.</p>
<p class="txt">일간이 ${mcGan.map((g) => `${g}(${GAN_NAME[g]})`).join('이나 ')}인 사람에게는 이날 지지 ${dz}가 문창귀인이에요. 공부와 시험을 돕는 별이 드는 날이에요.</p>
</div></section>
<section class="sec"><h2><span class="seal">二</span>띠별 수능 날 흐름</h2><div class="card"><p class="txt">올해 수험생은 대부분 2008년생 쥐띠이고, 재수생은 2007년생 돼지띠가 많아요. 띠는 입춘(2월 4일 무렵)에 바뀌어서 1월생과 2월 초에 태어난 사람은 앞 해의 띠로 봐요.</p>${rows}</div></section>
<section class="cta">
<h3>우리 아이, 내 사주로 보는 합격운</h3>
<p>띠는 태어난 해 한 글자만 봐요. 합격이직운에서 사주 여덟 글자로 시험 기운, 합격하기 좋은 때, 면접에 강한 시간까지 풀어 드려요. 수험생 사주를 넣어 부모님이 대신 볼 수도 있어요.</p>
<a class="btn" href="/topic/exam?${sutm('main')}">내 사주로 합격운 보기</a>
<a class="sub" href="/daily?${sutm('daily')}">수능 날 오늘의 운세 무료로 보기</a>
</section>
<section class="sec"><h2><span class="seal">三</span>자주 묻는 질문</h2><div class="card"><dl class="faq">${faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl></div></section>
<p class="note">띠와 그날 간지의 관계로 본 참고용 흐름이에요. 시험 결과는 그동안의 준비가 정해요. 수험생 모두 준비한 만큼 보길 바라요.</p>
</main>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: '2027학년도 수능 날 운세', description: desc, inLanguage: 'ko', mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: '사주500', url: SITE }, datePublished: '2026-10-17', dateModified: '2026-10-17' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
  write('unse/suneung', page({ title, desc, canonical, body, jsonld }));
}

// ── 무료 만세력 (2026-10-18 v2) — '만세력'은 운세 쪽에서 검색이 가장 많은 말 중 하나. 오너: "퀄리티 좋으면 바이럴, 심혈을 기울여 보자"
//   이 페이지에서 바로 입력 → /manse/view (ManseQuickPage) 가 계산하고 보관함에 저장한 뒤 사주 카드로. 입력 화면을 한 번 더 거치지 않는다.
//   머리 그림은 조선 천문도(천상열차분야지도)처럼 28수와 12지지가 도는 별자리 판을 직접 그린 SVG(저작권 걱정 없음, 파일 0).
//   사주500 만세력이 맞추는 것(코드 기준): 서울 기준 30분 시간 보정(timeCorrection.ts, 시 경계 :30), 옛 서머타임 1948~1951, 1955~1960, 1987~1988,
//   한국 음력(koreanLunar.ts, 한국천문연구원 자료 기반). 이 문구를 바꾸려면 계산 코드와 같이 본다.
{
  const mutm = (slug) => `utm_source=seo&utm_medium=organic&utm_campaign=manse_${slug}`;
  const canonical = `${SITE}/manse/`;
  const title = '무료 만세력, 생년월일로 사주 여덟 글자 보기 (시간 보정, 한국 음력) | 사주500';
  const desc = '생년월일과 태어난 시간만 넣으면 사주 여덟 글자와 오행, 지금 대운까지 바로 보여 드려요. 서울 기준 30분 시간 보정, 옛 서머타임, 한국천문연구원 자료로 만든 한국 음력까지 맞춰 계산해요. 무료예요.';

  // 별자리 판 (결정적 난수 — 빌드마다 같은 그림)
  const sky = skySvg();

  // 예시 만세력 — 1993-05-14 06:30 양력 여성 (앱 사주 카드 계산과 같음: 癸酉 丁巳 乙未 己卯, 오행 목2 화2 토2 금1 수1)
  const OHC = { 목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82' };
  const ex = [
    ['시주', '己', '토', '기', '卯', '목', '묘'],
    ['일주', '乙', '목', '을', '未', '토', '미'],
    ['월주', '丁', '화', '정', '巳', '화', '사'],
    ['년주', '癸', '수', '계', '酉', '금', '유'],
  ];
  const cell = (h, oh, k, me) => `<div class="mc${me ? ' me' : ''}" style="--c:${OHC[oh]}"><b>${h}</b><span>${k}, ${oh}</span></div>`;
  const sample = `<div class="mtable">${ex.map(([lab, g, go, gk, z, zo, zk]) => `<div class="mcol"><div class="mlab">${lab}</div>${cell(g, go, gk, lab === '일주')}${cell(z, zo, zk)}</div>`).join('')}</div>`;

  const look = [
    ['일간', '일주의 위 글자예요. 나를 나타내는 글자라, 이 글자를 기준으로 나머지 일곱 글자와의 관계(십성)를 봐요.'],
    ['오행 균형', '나무, 불, 흙, 쇠, 물이 몇 개씩 있는지 봐요. 많은 기운은 잘 쓰는 힘, 없는 기운은 채우면 좋은 힘으로 읽어요.'],
    ['대운', '10년마다 바뀌는 큰 흐름이에요. 지금 몇 살부터 몇 살까지의 대운인지 보면 요즘 흐름을 짐작할 수 있어요.'],
    ['올해 운', `해마다 들어오는 글자(세운)예요. 2026년은 병오(丙午)년, 2027년은 정미(丁未)년이에요.`],
  ].map(([k, v]) => `<div class="row"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('');
  const rows = [
    ['년주', '태어난 해의 간지예요. 띠가 여기서 나와요. 집안과 어린 시절의 자리로 봐요.'],
    ['월주', '태어난 달의 간지예요. 계절의 기운이라 사주에서 힘이 가장 커요. 부모와 사회의 자리로 봐요.'],
    ['일주', '태어난 날의 간지예요. 위 글자(일간)가 바로 나 자신이고, 아래 글자는 배우자의 자리예요.'],
    ['시주', '태어난 시의 간지예요. 자녀와 앞날의 자리로 봐요. 태어난 시간을 모르면 비워 두고 여섯 글자로 봐요.'],
  ].map(([k, v]) => `<div class="row"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('');
  const faq = [
    { q: '만세력이 뭔가요?', a: '태어난 해, 달, 날, 시를 60갑자 간지로 바꿔 적어 둔 달력이에요. 네 기둥마다 위아래 두 글자씩, 모두 여덟 글자가 나와서 사주팔자라고 불러요.' },
    { q: '왜 시가 바뀌는 때를 30분 늦춰 보나요?', a: '한국 표준시는 동경 135도를 기준으로 하는데 서울은 동경 127도쯤이라 해가 실제로 30분쯤 늦게 떠요. 그래서 시가 바뀌는 때를 30분 늦춰 봐요. 예를 들어 새벽 3시 30분부터 인시예요.' },
    { q: '서머타임 때 태어났으면 어떻게 하나요?', a: '1948~1951년, 1955~1960년, 1987~1988년 여름에는 시계를 한 시간 앞당겼어요. 이때 태어났다면 따로 고치지 않아도 사주500이 한 시간을 되돌려 계산해요.' },
    { q: '음력 생일도 되나요?', a: '돼요. 음력 생일은 한국천문연구원 자료로 만든 한국 음력 달력으로 양력 날짜를 찾은 뒤 계산해요. 중국 음력과 하루 다른 달이 있어서, 중국 음력을 쓰는 만세력과 일주가 달라질 수 있어요.' },
    { q: '태어난 시간을 모르면요?', a: '시간을 몰라요에 표시하면 시주를 빼고 여섯 글자로 보여 드려요.' },
    { q: '넣은 생일은 어디에 저장되나요?', a: '이 기기의 보관함에 저장돼요. 다음에 오면 홈에서 바로 내 사주로 오늘의 운세를 볼 수 있고, 보관함에서 언제든 지울 수 있어요.' },
    { q: '정말 무료인가요?', a: '만세력은 무료예요. 오늘의 운세와 꿈해몽도 하루 한 번 무료로 볼 수 있어요.' },
  ];
  const seg = (name, opts, def) => `<div class="seg" role="radiogroup">${opts.map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}"${v === def ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div>`;
  const pageCss = `
.mhero{position:relative;overflow:hidden;background:#15110E;color:#F4EFE4;padding:34px 0 120px}
.mhero .sky{position:absolute;width:560px;height:560px;right:-150px;top:-90px;opacity:.95}
${SKY_CSS}
.mhero .wrap{position:relative}.mhero .lab{font-size:14px;font-weight:700;color:#D2B477}
.mhero h1{font-family:'Noto Serif KR',serif;font-size:30px;line-height:1.38;margin:8px 0 10px;letter-spacing:-.02em;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.mhero p{font-size:15.5px;color:#E4DCCD;max-width:330px;text-shadow:0 1px 8px rgba(0,0,0,.7)}
.mform{margin-top:-96px;position:relative}
.mform form{background:#FFFDF8;border:1px solid #E1D7C4;border-radius:16px;padding:20px 18px 16px;box-shadow:0 14px 34px rgba(26,22,18,.16)}
.mform h2{font-family:'Noto Serif KR',serif;font-size:20px;margin-bottom:12px}
.mform .f{margin-top:12px}.mform .f>span{display:block;font-size:14px;font-weight:700;color:#4B4238;margin-bottom:6px}
.mform .f small{font-weight:500;color:#6F6557}
.mform input[type=text],.mform input[type=tel],.mform input[type=time]{width:100%;height:50px;border:1px solid #D9CDB8;border-radius:12px;padding:0 14px;font-size:17px;background:#fff;color:#1A1612;font-family:inherit}
.mform input#mb{letter-spacing:.08em;font-variant-numeric:tabular-nums}
.seg{display:flex;gap:6px}.seg label{flex:1;position:relative}.seg input{position:absolute;opacity:0;pointer-events:none}
.seg span{display:block;text-align:center;height:44px;line-height:42px;border:1px solid #D9CDB8;border-radius:12px;font-size:15px;font-weight:700;color:#4B4238;background:#fff;cursor:pointer}
.seg input:checked+span{background:#1A1612;border-color:#1A1612;color:#F4EFE4}
.seg input:focus-visible+span{outline:2px solid #B8965A;outline-offset:2px}
.mform .tr{display:flex;gap:8px;align-items:center}.mform .tr input[type=time]{flex:1}
.mform .chk{display:flex;align-items:center;gap:6px;font-size:14.5px;font-weight:700;color:#4B4238;white-space:nowrap}
.mform .chk input{width:20px;height:20px;accent-color:#1A1612}
.mform input:disabled{background:#F1ECE2;color:#A69C8E}
.mform .err{min-height:20px;margin-top:10px;font-size:14px;font-weight:700;color:#A23A2A}
.mform button{width:100%;height:56px;border:0;border-radius:14px;background:linear-gradient(180deg,#D2B477 0%,#B8965A 100%);color:#17110A;font-size:17px;font-weight:800;margin-top:4px;cursor:pointer;font-family:inherit}
.mform .note2{font-size:13px;color:#6F6557;text-align:center;margin-top:10px}
.mtable{display:flex;gap:6px}.mcol{flex:1;display:flex;flex-direction:column;gap:6px}
.mlab{text-align:center;font-size:13px;font-weight:700;color:#6F6557}
.mc{border-radius:12px;background:var(--c);color:#fff;text-align:center;padding:10px 0 8px}
.mc b{display:block;font-family:'Noto Serif KR',serif;font-size:30px;line-height:1.1}.mc span{font-size:12.5px;opacity:.9}
.mc.me{box-shadow:0 0 0 3px #FFFDF8,0 0 0 5px #B8965A}
.excap{font-size:13.5px;color:#6F6557;margin-top:10px}
@media (max-width:420px){.mhero .sky{width:460px;height:460px;right:-170px;top:-60px;opacity:.7}.mhero h1{font-size:27px}}
`;
  const script = `<script>(function(){var f=document.getElementById('mf');if(!f)return;var e=document.getElementById('mferr');
var tu=f.querySelector('input[name=tu]'),tt=f.querySelector('input[name=t]');tu.addEventListener('change',function(){tt.disabled=tu.checked;if(tu.checked)tt.value='';});
f.querySelector('#mb').addEventListener('input',function(ev){ev.target.value=ev.target.value.replace(/[^0-9]/g,'').slice(0,8);});
f.addEventListener('submit',function(ev){ev.preventDefault();e.textContent='';
var b=f.b.value.replace(/[^0-9]/g,'');if(b.length!==8){e.textContent='생년월일 8자리를 넣어 주세요. 예: 19930514';f.b.focus();return;}
var y=+b.slice(0,4),m=+b.slice(4,6),d=+b.slice(6,8),now=new Date().getFullYear();var c=(f.querySelector('input[name=c]:checked')||{}).value||'solar';
if(y<1900||y>now||m<1||m>12||d<1||d>31){e.textContent='날짜를 다시 확인해 주세요.';f.b.focus();return;}
if(c==='solar'){var dt=new Date(y,m-1,d);if(dt.getMonth()!==m-1||dt.getDate()!==d){e.textContent='없는 날짜예요. 다시 확인해 주세요.';f.b.focus();return;}}else if(d>30){e.textContent='음력은 30일까지 있어요.';f.b.focus();return;}
var g=(f.querySelector('input[name=g]:checked')||{}).value;if(!g){e.textContent='성별을 골라 주세요.';return;}
var t='';if(!tu.checked){if(!tt.value){e.textContent='태어난 시각을 넣거나 시간을 몰라요에 표시해 주세요.';tt.focus();return;}t=tt.value.replace(':','');}
var r=(f.querySelector('input[name=r]:checked')||{}).value||'self';var n=(f.n.value||'').trim().slice(0,12);
var d={b:b,c:c,g:g,r:r,t:t,n:n};var q='';
try{sessionStorage.setItem('saju500:manse_form',JSON.stringify(d));}catch(_){q='b='+b+'&c='+c+'&g='+g+'&r='+r+(t?'&t='+t:'')+(n?'&n='+encodeURIComponent(n):'')+'&';}
location.href='/manse/view?'+q+'${mutm('form')}';});})();</script>`;
  const body = `<style>${pageCss}</style>
<section class="mhero">${sky}<div class="wrap">
<div class="lab">무료 만세력</div>
<h1>생년월일만 넣으면<br>사주 여덟 글자가<br>바로 펼쳐져요</h1>
<p>서울 기준 30분 시간 보정, 옛 서머타임, 한국 음력까지 맞춰 계산해요.</p>
</div></section>
<main class="wrap">
<section class="mform"><form id="mf" novalidate autocomplete="off">
<h2>내 만세력 펼치기</h2>
<div class="f"><span>누구의 만세력인가요</span>${seg('r', [['self', '나'], ['family', '가족'], ['friend', '친구'], ['lover', '연인']], 'self')}</div>
<div class="f"><span>이름 <small>(선택, 비워 두면 '나')</small></span><input type="text" name="n" maxlength="12" placeholder="이름이나 별명"></div>
<div class="f"><span>성별</span>${seg('g', [['f', '여성'], ['m', '남성']], '')}</div>
<div class="f"><span>생년월일 8자리</span><input type="tel" id="mb" name="b" inputmode="numeric" maxlength="8" placeholder="예: 19930514"></div>
<div class="f">${seg('c', [['solar', '양력'], ['lunar', '음력'], ['leap', '음력 윤달']], 'solar')}</div>
<div class="f"><span>태어난 시각</span><div class="tr"><input type="time" name="t"><label class="chk"><input type="checkbox" name="tu">시간을 몰라요</label></div></div>
<p class="err" id="mferr" role="alert"></p>
<button type="submit">만세력 펼치기</button>
<p class="note2">무료예요. 생일은 이 기기의 보관함에만 저장되고 언제든 지울 수 있어요.</p>
</form></section>
<section class="sec"><h2><span class="seal">一</span>이렇게 나와요</h2><div class="card">${sample}
<p class="excap">예시: 1993년 5월 14일 오전 6시 30분(양력, 여성). 금테를 두른 일주의 위 글자 乙(을목)이 나예요. 오행은 나무 2, 불 2, 흙 2, 쇠 1, 물 1이에요.</p>
<p class="txt" style="margin-top:10px">실제 결과에는 십성, 지장간, 12운성, 신살, 지금 대운과 올해 운까지 한 장에 나오고, 이미지로 저장하거나 친구에게 보낼 수 있어요.</p>
</div></section>
<section class="sec"><h2><span class="seal">二</span>사주500 만세력이 맞추는 세 가지</h2><div class="card">
<p class="txt"><b>태어난 시각 30분 보정.</b> 한국 표준시와 서울의 실제 해 시간은 30분쯤 차이가 나요. 시가 바뀌는 때를 30분 늦춰 봐서, 새벽 3시 30분부터 인시로 계산해요.</p>
<p class="txt"><b>옛 서머타임.</b> 1948~1951년, 1955~1960년, 1987~1988년 여름에 태어났다면 시계가 한 시간 빨랐던 것을 되돌려 계산해요.</p>
<p class="txt"><b>한국 음력.</b> 음력 생일은 한국천문연구원 자료로 만든 한국 음력 달력으로 바꿔요. 중국 음력과 하루씩 다른 달이 있어서 이걸 맞추지 않으면 일주가 하루 밀릴 수 있어요.</p>
</div></section>
<section class="sec"><h2><span class="seal">三</span>만세력에서 꼭 볼 네 가지</h2><div class="card">${look}</div></section>
<section class="sec"><h2><span class="seal">四</span>네 기둥 읽는 법</h2><div class="card">${rows}
<p class="txt" style="margin-top:12px">위 글자는 천간 열 가지, 아래 글자는 지지 열두 가지예요. 글자마다 나무, 불, 흙, 쇠, 물 다섯 기운(오행) 중 하나를 띠어요.</p>
</div></section>
<section class="sec"><h2><span class="seal">五</span>자주 묻는 질문</h2><div class="card"><dl class="faq">${faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl></div></section>
<section class="sec"><h2>함께 보면 좋은 글</h2><div class="links"><a href="/ilju/">60일주 총정리</a><a href="/unse/today/">오늘의 띠별 운세</a><a href="/unse/${YEAR}/">${YEAR}년 띠별 운세</a><a href="/gunghap/">띠별 궁합표</a><a href="/kkum/">꿈해몽 모음</a></div></section>
<p class="note">같은 날 태어나도 태어난 시와 음력 계산에 따라 글자가 달라질 수 있어요. 시간과 음력 여부를 정확히 넣을수록 좋아요.</p>
</main>${script}`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: '사주500 무료 만세력', url: canonical, applicationCategory: 'LifestyleApplication', operatingSystem: 'Web', inLanguage: 'ko', offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' }, description: desc },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
  write('manse', page({ title, desc, canonical, body, jsonld }));
}

// ── sitemap (앱 주요 주소 + 이 페이지들)
const today = new Date().toISOString().slice(0, 10);
const appUrls = [['/', '1.0'], ['/daily', '0.9'], ['/dream', '0.9'], ['/premium', '0.9'], ['/tojung', '0.9'], ['/compat', '0.8'], ['/topic/love', '0.8'], ['/topic/wealth', '0.8'], ['/topic/reunion', '0.8'], ['/topic/exam', '0.8'], ['/topic/marriage', '0.7'], ['/topic/career', '0.7'], ['/terms', '0.3'], ['/privacy', '0.3']];
const urls = [...appUrls.map(([u, p]) => ({ u, p })), { u: '/unse/today/', p: '0.9' }, { u: '/unse/today/ilju/', p: '0.8' }, ...out.map((u) => ({ u, p: u === `/unse/${YEAR}/` || u === '/unse/suneung/' || u === '/manse/' || u === '/kkum/' || u === '/gunghap/' || u === '/ilju/' ? '0.9' : u.startsWith('/kkum/') || u.startsWith('/gunghap/') || u.startsWith('/ilju/') ? '0.7' : '0.8' }))]; // /unse/today/ 는 함수가 매일 그린다(renderTtiToday)
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(({ u, p }) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><priority>${p}</priority></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);
console.log(`검색용 페이지 ${out.length}개, sitemap ${urls.length}개 주소`);
