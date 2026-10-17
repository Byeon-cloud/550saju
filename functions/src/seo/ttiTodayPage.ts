/**
 * 오늘의 띠별 운세 공개 페이지 (2026-10-17, 검색 유입 시험 E9) — https://saju500.app/unse/today/
 *
 *   서버가 하루 한 번 만드는 ttiFortune/{날짜}(ttiFortune.ts)를 검색엔진이 읽는 HTML 로 그린다. 네이버는 JS 를 거의 돌리지 않아
 *   SPA 로는 색인되지 않는다. 신문 '오늘의 띠별 운세' 를 찾는 검색 수요를 앱(오늘의 운세, 사주 입력)으로 잇는 것이 목적.
 *   오늘 문서가 아직 없으면 어제 문서를 보여 준다. CDN 캐시 30분.
 */
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

const ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const NAME: Record<string, string> = { 子: '쥐띠', 丑: '소띠', 寅: '호랑이띠', 卯: '토끼띠', 辰: '용띠', 巳: '뱀띠', 午: '말띠', 未: '양띠', 申: '원숭이띠', 酉: '닭띠', 戌: '개띠', 亥: '돼지띠' };
const SLUG: Record<string, string> = { 子: 'rat', 丑: 'ox', 寅: 'tiger', 卯: 'rabbit', 辰: 'dragon', 巳: 'snake', 午: 'horse', 未: 'goat', 申: 'monkey', 酉: 'rooster', 戌: 'dog', 亥: 'pig' };
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const SITE = 'https://saju500.app';
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kstKey = (offsetDays = 0) => new Date(Date.now() + 9 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);
const utm = (c: string) => `utm_source=seo&utm_medium=organic&utm_campaign=tti_today_${c}`;

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{background:#F4EFE4;color:#1A1612;font-family:Pretendard,-apple-system,sans-serif;line-height:1.75;word-break:keep-all;-webkit-text-size-adjust:100%}a{color:inherit}
.wrap{max-width:560px;margin:0 auto;padding:0 18px}.top{display:flex;align-items:center;justify-content:space-between;height:56px}.brand{font-family:'Noto Serif KR',serif;font-weight:900;font-size:19px;text-decoration:none}.brand b{color:#8C6D3D}.top a.go{font-size:14px;font-weight:700;color:#4B4238;text-decoration:none}
.hero{background:linear-gradient(180deg,rgba(26,22,18,.55),rgba(26,22,18,.86) 55%,#1A1612),url('/art/inwang.webp') 30% 35%/cover no-repeat,#1A1612;color:#F4EFE4;padding:32px 0 28px}.hero .lab{font-size:14px;color:#CFC6B6;font-weight:700}.hero h1{font-family:'Noto Serif KR',serif;font-weight:700;font-size:29px;line-height:1.35;letter-spacing:-.03em;margin:8px 0 10px}.hero p{font-size:15px;color:#E4DCCD}
.jump{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0 6px}.jump a{display:block;text-align:center;background:#FFFDF8;border:1px solid #E1D7C4;border-radius:12px;padding:9px 4px;font-weight:700;font-size:15px;text-decoration:none}
.tti{background:#FFFDF8;border:1px solid #E1D7C4;border-radius:14px;padding:16px 18px;margin-top:14px;scroll-margin-top:12px}.tti h2{font-family:'Noto Serif KR',serif;font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px}
.seal{display:inline-grid;place-items:center;width:28px;height:28px;border:1.6px solid #A23A2A;color:#A23A2A;border-radius:4px;font-family:'Noto Serif KR',serif;font-weight:900;font-size:15px}
.head{font-family:'Noto Serif KR',serif;font-size:16.5px;font-weight:600;line-height:1.7;margin:10px 0 6px}.yr{display:flex;gap:12px;padding:9px 0;border-top:1px solid #EFE8DA}.yr b{width:62px;flex-shrink:0;font-size:15px}.yr span{flex:1;font-size:15px;color:#2E2720}
.cta{margin:22px 0 8px;background:#1A1612;color:#F4EFE4;border-radius:16px;padding:20px}.cta h3{font-family:'Noto Serif KR',serif;font-size:18px;font-weight:700;margin-bottom:6px}.cta p{font-size:14.5px;color:#CFC6B6;margin-bottom:14px}
.btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:13px;background:linear-gradient(180deg,#D2B477,#B8965A);color:#17110A;font-weight:800;font-size:16px;text-decoration:none}.sub{display:block;text-align:center;margin-top:12px;font-size:14.5px;font-weight:700;color:#E4DCCD;text-decoration:underline}
.note{font-size:13.5px;color:#6F6557;margin-top:18px}.foot{margin-top:30px;border-top:1px solid #E1D7C4;padding:16px 0 30px;text-align:center;font-size:12px;color:#A69C8E;line-height:1.7}.foot a{color:#A69C8E;margin:0 6px;text-decoration:none}.foot a.b{font-weight:700}`;

function render(doc: any, dateKey: string, isToday: boolean): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const wd = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const gz = String(doc.dayGz || '');
  const gzKo = gz ? `${GAN_KO[gz[0]] || ''}${ZHI_KO[gz[1]] || ''}` : '';
  const dayLabel = `${m}월 ${d}일 ${wd}요일${gz ? `, ${gzKo}(${gz})일` : ''}`;
  const title = `오늘의 띠별 운세 ${m}월 ${d}일 | 쥐띠부터 돼지띠까지 출생 연도별 - 사주500`;
  const desc = `${y}년 ${dayLabel} 띠별 운세. 쥐띠, 소띠, 호랑이띠, 토끼띠, 용띠, 뱀띠, 말띠, 양띠, 원숭이띠, 닭띠, 개띠, 돼지띠의 오늘 운세와 출생 연도별 한 줄, 좋은 시간을 매일 아침 새로 풀어요.`;
  const blocks = ORDER.map((z) => {
    const t = doc.tti?.[z] || {};
    const years = Object.entries(t.years || {}).sort(([a], [b]) => Number(a) - Number(b))
      .map(([yr, line]) => `<div class="yr"><b>${String(Number(yr) % 100).padStart(2, '0')}년생</b><span>${esc(line)}</span></div>`).join('');
    return `<section class="tti" id="${SLUG[z]}"><h2><span class="seal">${z}</span>${NAME[z]} 오늘의 운세</h2>${t.head ? `<p class="head">${esc(t.head)}</p>` : ''}${years}</section>`;
  }).join('');
  const jsonld = { '@context': 'https://schema.org', '@type': 'Article', headline: `오늘의 띠별 운세 ${m}월 ${d}일`, description: desc, inLanguage: 'ko', datePublished: dateKey, dateModified: dateKey, mainEntityOfPage: `${SITE}/unse/today/`, publisher: { '@type': 'Organization', name: '사주500', url: SITE } };
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}/unse/today/">
<meta property="og:type" content="article"><meta property="og:site_name" content="사주500"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}/unse/today/"><meta property="og:image" content="${SITE}/og/tti.jpg">
<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700;900&display=swap">
<style>${CSS}</style><script type="application/ld+json">${JSON.stringify(jsonld)}</script></head><body>
<header class="wrap top"><a class="brand" href="/?${utm('top')}">사주<b>500</b></a><a class="go" href="/?${utm('top_go')}">내 사주로 보기</a></header>
<section class="hero"><div class="wrap"><div class="lab">${esc(dayLabel)}</div><h1>오늘의 띠별 운세</h1><p>${isToday ? '매일 아침 새로 풀어요.' : '오늘 풀이를 준비하는 중이라 어제 풀이를 보여 드려요.'} 내 띠를 눌러 출생 연도별 한 줄을 보세요.</p></div></section>
<main class="wrap">
<nav class="jump">${ORDER.map((z) => `<a href="#${SLUG[z]}">${NAME[z]}</a>`).join('')}</nav>
${blocks}
<section class="cta"><h3>같은 띠라도 생일과 태어난 시간에 따라 하루가 달라요</h3><p>생일을 넣으면 내 사주로 오늘 하루를 풀어 드려요. 하루 한 번 무료예요.</p>
<a class="btn" href="/daily?${utm('daily')}">내 사주로 오늘의 운세 보기</a><a class="sub" href="/unse/today/ilju/?${utm('ilju')}">태어난 날로 보는 오늘의 일주별 운세</a><a class="sub" href="/daily?${utm('mail')}#daily-mail">매일 아침 내 일주 운세 메일로 받기 (무료)</a><a class="sub" href="/unse/2027/?${utm('newyear')}">2027년 띠별 신년운세 보기</a></section>
<p class="note">띠(태어난 해의 지지)와 오늘 일진의 관계, 태어난 해의 천간을 명리학 원리로 본 참고용 풀이예요.</p>
</main>
<nav class="wrap" style="margin-top:26px;font-size:14.5px;font-weight:700;display:flex;flex-wrap:wrap;gap:6px 14px"><a href="/unse/2027/">2027년 띠별 운세</a><a href="/gunghap/">띠별 궁합표</a><a href="/kkum/">꿈해몽 모음</a></nav>
<footer class="wrap foot"><div><a href="/terms">이용약관</a><a class="b" href="/privacy">개인정보처리방침</a><a href="/business">사업자정보</a></div>
<div>주라벨 주식회사 | 대표 변준기 | 사업자등록번호 228-88-03113 | 통신판매업 제 2025-부산사하-0235호 | info@juulabel.com</div><div>© ${y} 사주500</div></footer>
</body></html>`;
}

export const renderTtiToday = onRequest({ memory: '256MiB', maxInstances: 5, timeoutSeconds: 20 }, async (req, res) => {
  try {
    const db = admin.firestore();
    const today = kstKey(0);
    let snap = await db.doc(`ttiFortune/${today}`).get();
    let key = today;
    let isToday = true;
    if (!snap.exists || !snap.data()?.tti) {
      key = kstKey(-1); isToday = false;
      snap = await db.doc(`ttiFortune/${key}`).get();
    }
    if (!snap.exists || !snap.data()?.tti) {
      res.status(503).set('Cache-Control', 'no-store').send('잠시 뒤 다시 열어 주세요');
      return;
    }
    res.set('Cache-Control', isToday ? 'public, max-age=600, s-maxage=1800' : 'public, max-age=120, s-maxage=300');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(render(snap.data(), key, isToday));
  } catch (e: any) {
    console.error('[renderTtiToday]', e?.message || e);
    res.status(500).set('Cache-Control', 'no-store').send('잠시 뒤 다시 열어 주세요');
  }
});
