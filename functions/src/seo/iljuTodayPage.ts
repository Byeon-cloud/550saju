/**
 * 오늘의 일주별 운세 공개 페이지 (2026-10-17) — https://saju500.app/unse/today/ilju/
 *
 *   아침 메일(ilju/iljuDaily.ts)용으로 매일 만드는 60일주 오늘 운세를 검색 페이지로도 보여 준다(추가 AI 원가 0).
 *   '갑자일주 오늘의 운세'처럼 찾는 사람을 무료 오늘의 운세와 아침 메일 신청으로 잇는다.
 *   오늘 문서가 아직 없으면 어제 문서. 둘 다 없으면 503(검색엔진은 다시 온다). CDN 캐시 30분.
 */
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

const GAN = '甲乙丙丁戊己庚辛壬癸'.split('');
const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const GAN_RO: Record<string, string> = { 甲: 'gap', 乙: 'eul', 丙: 'byeong', 丁: 'jeong', 戊: 'mu', 己: 'gi', 庚: 'gyeong', 辛: 'sin', 壬: 'im', 癸: 'gye' };
const ZHI_RO: Record<string, string> = { 子: 'ja', 丑: 'chuk', 寅: 'in', 卯: 'myo', 辰: 'jin', 巳: 'sa', 午: 'o', 未: 'mi', 申: 'sin', 酉: 'yu', 戌: 'sul', 亥: 'hae' };
const GAN_OH: Record<string, string> = { 甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수' };
const GAPJA = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);
const ko = (gz: string) => (GAN_KO[gz[0]] || '') + (ZHI_KO[gz[1]] || '');
const slug = (gz: string) => `${GAN_RO[gz[0]]}-${ZHI_RO[gz[1]]}`;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const SITE = 'https://saju500.app';
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kstKey = (o = 0) => new Date(Date.now() + 9 * 3600e3 + o * 864e5).toISOString().slice(0, 10);
const utm = (c: string) => `utm_source=seo&amp;utm_medium=organic&amp;utm_campaign=ilju_today_${c}`;

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{background:#F4EFE4;color:#1A1612;font-family:Pretendard,-apple-system,sans-serif;line-height:1.75;word-break:keep-all;-webkit-text-size-adjust:100%}a{color:inherit}
.wrap{max-width:560px;margin:0 auto;padding:0 18px}.top{display:flex;align-items:center;justify-content:space-between;height:56px}.brand{font-family:'Noto Serif KR',serif;font-weight:900;font-size:19px;text-decoration:none}.brand b{color:#8C6D3D}.top a.go{font-size:14px;font-weight:700;color:#4B4238;text-decoration:none}
.hero{background:linear-gradient(180deg,rgba(26,22,18,.55),rgba(26,22,18,.86) 55%,#1A1612),url('/art/inwang.webp') 30% 35%/cover no-repeat,#1A1612;color:#F4EFE4;padding:32px 0 28px}.hero .lab{font-size:14px;color:#CFC6B6;font-weight:700}.hero h1{font-family:'Noto Serif KR',serif;font-weight:700;font-size:28px;line-height:1.35;margin:8px 0 10px}.hero p{font-size:15px;color:#E4DCCD}
.jump{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 4px}.jump a{background:#FFFDF8;border:1px solid #E1D7C4;border-radius:10px;padding:6px 9px;font-size:14px;font-weight:700;text-decoration:none}
.grp{margin-top:22px}.grp h2{font-family:'Noto Serif KR',serif;font-size:19px;font-weight:700;display:flex;align-items:center;gap:10px;margin-bottom:8px}
.seal{display:inline-grid;place-items:center;width:28px;height:28px;border:1.6px solid #A23A2A;color:#A23A2A;border-radius:4px;font-family:'Noto Serif KR',serif;font-weight:900;font-size:15px}
.ij{background:#FFFDF8;border:1px solid #E1D7C4;border-radius:14px;padding:14px 16px;margin-top:10px;scroll-margin-top:12px}.ij h3{font-size:16.5px;font-weight:800}.ij h3 a{font-size:13.5px;font-weight:700;color:#7A5C2E;text-decoration:none;margin-left:8px}
.ij .hd{font-family:'Noto Serif KR',serif;font-size:16px;font-weight:600;margin:4px 0}.ij p{font-size:15px;color:#2E2720}.ij .meta{font-size:14px;color:#4B4238;margin-top:6px}
.cta{margin:24px 0 8px;background:#1A1612;color:#F4EFE4;border-radius:16px;padding:20px}.cta h3{font-family:'Noto Serif KR',serif;font-size:18px;font-weight:700;margin-bottom:6px}.cta p{font-size:14.5px;color:#CFC6B6;margin-bottom:14px}
.btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:13px;background:linear-gradient(180deg,#D2B477,#B8965A);color:#17110A;font-weight:800;font-size:16px;text-decoration:none}.sub{display:block;text-align:center;margin-top:12px;font-size:14.5px;font-weight:700;color:#E4DCCD;text-decoration:underline}
.note{font-size:13.5px;color:#6F6557;margin-top:18px}.foot{margin-top:30px;border-top:1px solid #E1D7C4;padding:16px 0 30px;text-align:center;font-size:12px;color:#A69C8E;line-height:1.7}.foot a{color:#A69C8E;margin:0 6px;text-decoration:none}.foot a.b{font-weight:700}`;

function render(doc: any, dateKey: string, isToday: boolean): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const wd = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const gz = String(doc.dayGz || '');
  const dayLabel = `${m}월 ${d}일 ${wd}요일${gz ? `, ${ko(gz)}(${gz})일` : ''}`;
  const title = `오늘의 일주별 운세 ${m}월 ${d}일 | 갑자일주부터 계해일주까지 60일주 - 사주500`;
  const desc = `${y}년 ${dayLabel} 60일주별 오늘의 운세. 태어난 날의 간지(일주)로 오늘 하루의 흐름, 좋은 시간, 조심할 일을 매일 아침 새로 풀어요.`;
  const groups = GAN.map((g) => {
    const items = GAPJA.filter((x) => x[0] === g && doc.ilju?.[x]);
    if (!items.length) return '';
    return `<section class="grp"><h2><span class="seal">${g}</span>${GAN_KO[g]}${GAN_OH[g]} 일간</h2>${items.map((x) => {
      const e = doc.ilju[x];
      return `<div class="ij" id="${slug(x)}"><h3>${ko(x)}일주 (${x})<a href="/ilju/${slug(x)}/?${utm(slug(x) + '_profile')}">일주 특징 ›</a></h3><p class="hd">${esc(e.head)}</p><p>${esc(e.body)}</p><p class="meta">좋은 시간 <b>${esc(e.hour)}</b><br>조심할 일 ${esc(e.care)}</p></div>`;
    }).join('')}</section>`;
  }).join('');
  const jsonld = { '@context': 'https://schema.org', '@type': 'Article', headline: `오늘의 일주별 운세 ${m}월 ${d}일`, description: desc, inLanguage: 'ko', datePublished: dateKey, dateModified: dateKey, mainEntityOfPage: `${SITE}/unse/today/ilju/`, publisher: { '@type': 'Organization', name: '사주500', url: SITE } };
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}/unse/today/ilju/">
<meta property="og:type" content="article"><meta property="og:site_name" content="사주500"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}/unse/today/ilju/"><meta property="og:image" content="${SITE}/og/daily.jpg">
<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700;900&display=swap">
<style>${CSS}</style><script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script></head><body>
<header class="wrap top"><a class="brand" href="/?${utm('top')}">사주<b>500</b></a><a class="go" href="/daily?${utm('top_go')}">내 사주로 보기</a></header>
<section class="hero"><div class="wrap"><div class="lab">${esc(dayLabel)}</div><h1>오늘의 일주별 운세</h1><p>${isToday ? '매일 아침 새로 풀어요.' : '오늘 풀이를 준비하는 중이라 어제 풀이를 보여 드려요.'} 태어난 날의 간지(일주)를 눌러 오늘 하루를 보세요.</p></div></section>
<main class="wrap">
<nav class="jump">${GAPJA.filter((x) => doc.ilju?.[x]).map((x) => `<a href="#${slug(x)}">${ko(x)}</a>`).join('')}</nav>
${groups}
<section class="cta"><h3>같은 일주라도 태어난 달과 시간이 다르면 하루가 달라요</h3><p>생일을 넣으면 내 사주 여덟 글자로 오늘 하루를 풀어 드려요. 하루 한 번 무료예요.</p>
<a class="btn" href="/daily?${utm('daily')}">내 사주로 오늘의 운세 보기</a><a class="sub" href="/daily?${utm('mail')}#daily-mail">매일 아침 내 일주 운세 메일로 받기 (무료)</a><a class="sub" href="/ilju/?${utm('hub')}">내 일주 특징 보기</a></section>
<p class="note">일주(태어난 날의 간지)와 오늘 일진의 관계(십성, 지지의 합과 충)를 명리학 원리로 본 참고용 풀이예요. 일주를 모르면 생일을 넣어 확인해 보세요.</p>
</main>
<nav class="wrap" style="margin-top:26px;font-size:14.5px;font-weight:700;display:flex;flex-wrap:wrap;gap:6px 14px"><a href="/unse/today/">오늘의 띠별 운세</a><a href="/unse/2027/">2027년 띠별 운세</a><a href="/gunghap/">띠별 궁합표</a><a href="/kkum/">꿈해몽 모음</a><a href="/ilju/">60일주 총정리</a></nav>
<footer class="wrap foot"><div><a href="/terms">이용약관</a><a class="b" href="/privacy">개인정보처리방침</a><a href="/business">사업자정보</a></div>
<div>주라벨 주식회사 | 대표 변준기 | 사업자등록번호 228-88-03113 | 통신판매업 제 2025-부산사하-0235호 | info@juulabel.com</div><div>© ${y} 사주500</div></footer>
</body></html>`;
}

export const renderIljuToday = onRequest({ memory: '256MiB', maxInstances: 5, timeoutSeconds: 20 }, async (req, res) => {
  try {
    const db = admin.firestore();
    let key = kstKey(0); let isToday = true;
    let snap = await db.doc(`iljuDaily/${key}`).get();
    const ok = (s: FirebaseFirestore.DocumentSnapshot) => s.exists && Object.keys((s.data() as any)?.ilju || {}).length >= 30;
    if (!ok(snap)) { key = kstKey(-1); isToday = false; snap = await db.doc(`iljuDaily/${key}`).get(); }
    if (!ok(snap)) { res.status(503).set('Retry-After', '3600').set('Cache-Control', 'no-store').send('오늘 일주 운세를 준비하고 있어요. 잠시 뒤 다시 열어 주세요'); return; }
    res.set('Cache-Control', isToday ? 'public, max-age=600, s-maxage=1800' : 'public, max-age=120, s-maxage=300');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(render(snap.data(), key, isToday));
  } catch (e: any) {
    console.error('[renderIljuToday]', e?.message || e);
    res.status(500).set('Cache-Control', 'no-store').send('잠시 뒤 다시 열어 주세요');
  }
});
