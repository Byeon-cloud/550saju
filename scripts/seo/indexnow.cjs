/* IndexNow 로 새 페이지 알리기 (2026-10-17) — 사용: node scripts/seo/indexnow.cjs [주소 ...]
 *   주소를 안 주면 dist/sitemap.xml 의 전부. 네이버(2023-07부터 지원)와 빙에 직접 보낸다(다른 IndexNow 검색엔진과도 공유된다).
 *   열쇠는 공개 파일(public/{key}.txt, 사이트 루트에 올라가 있어야 함)이라 비밀이 아니다. 키 값은 scripts/seo/indexnow.key.
 *   구글은 IndexNow 를 받지 않는다 → 서치 콘솔 등록(오너 로그인)이 따로 필요. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const KEY = fs.readFileSync(path.join(__dirname, 'indexnow.key'), 'utf8').trim();
const HOST = 'saju500.app';
const ENDPOINTS = ['https://searchadvisor.naver.com/indexnow', 'https://www.bing.com/indexnow'];
let urls = process.argv.slice(2);
if (!urls.length) {
  const xml = fs.readFileSync(path.join(ROOT, 'dist/sitemap.xml'), 'utf8');
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
(async () => {
  const check = await fetch(`https://${HOST}/${KEY}.txt`);
  const body = (await check.text()).trim();
  if (check.status !== 200 || body !== KEY) { console.log('열쇠 파일이 사이트에 없음', check.status); process.exit(1); }
  for (const ep of ENDPOINTS) {
    for (let i = 0; i < urls.length; i += 1000) {
      const urlList = urls.slice(i, i + 1000);
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }) });
      console.log(ep, `${urlList.length}개`, r.status, (await r.text()).slice(0, 120).replace(/\s+/g, ' '));
    }
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
