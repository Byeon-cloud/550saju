// 조선 천문도(천상열차분야지도) 느낌의 별자리 판 (2026-10-18). 28수 고리와 12지지 고리, 별과 별자리 선.
//   직접 그린 SVG 라 저작권 걱정이 없고 파일도 0. 결정적 난수라 빌드마다 같은 그림이 나온다.
//   쓰는 곳: 검색 페이지 /manse/ 머리(build-seo-pages.mjs), 공유 미리보기 그림 manse(scripts/og/make-og.cjs).
export function skySvg() {
  let seed = 1395; // 천상열차분야지도를 새긴 해
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const SU = '角亢氐房心尾箕斗牛女虛危室壁奎婁胃昴畢觜參井鬼柳星張翼軫';
  const ZH = '子丑寅卯辰巳午未申酉戌亥';
  const P = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [+(r * Math.cos(a)).toFixed(1), +(r * Math.sin(a)).toFixed(1)]; };
  const ring1 = [...SU].map((ch, i) => {
    const deg = i * 360 / 28;
    const [x1, y1] = P(172, deg); const [x2, y2] = P(193, deg); const [tx, ty] = P(182.5, deg + 360 / 56);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text x="${tx}" y="${ty}" transform="rotate(${(deg + 360 / 56).toFixed(1)} ${tx} ${ty})">${ch}</text>`;
  }).join('');
  const ring2 = [...ZH].map((ch, i) => {
    const deg = i * 30;
    const [x1, y1] = P(132, deg); const [x2, y2] = P(150, deg); const [tx, ty] = P(141, deg + 15);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text x="${tx}" y="${ty}" transform="rotate(${deg + 15} ${tx} ${ty})">${ch}</text>`;
  }).join('');
  const stars = [];
  for (let i = 0; i < 170; i++) {
    const r = Math.sqrt(rnd()) * 126; const a = rnd() * 360; const [x, y] = P(r, a);
    stars.push({ x, y, s: +(0.5 + rnd() * rnd() * 1.9).toFixed(2), o: +(0.35 + rnd() * 0.6).toFixed(2) });
  }
  const lines = [];
  for (let k = 0; k < 13; k++) {
    let cur = stars[Math.floor(rnd() * stars.length)];
    const used = new Set([cur]); const pts = [cur];
    for (let j = 0; j < 3 + Math.floor(rnd() * 3); j++) {
      const next = stars.filter((s) => !used.has(s)).map((s) => [s, (s.x - cur.x) ** 2 + (s.y - cur.y) ** 2]).sort((p, q) => p[1] - q[1])[0];
      if (!next || next[1] > 900) break;
      used.add(next[0]); pts.push(next[0]); cur = next[0];
    }
    if (pts.length > 2) lines.push(`<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}"/>`);
  }
  return `<svg class="sky" viewBox="-200 -200 400 400" aria-hidden="true" focusable="false">
<g class="ring r1">${'<circle r="193"/><circle r="172"/>'}${ring1}</g>
<g class="ring r2">${'<circle r="150"/><circle r="132"/>'}${ring2}</g>
<g class="guide"><circle r="58" stroke-dasharray="2 4"/><circle r="104"/><circle cx="16" cy="-6" r="102" stroke-dasharray="1 5"/></g>
<g class="const">${lines.join('')}</g>
<g class="stars">${stars.map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.s}" opacity="${s.o}"/>`).join('')}</g>
<circle class="pole" r="2.6"/>
</svg>`;
}

/** 색과 천천히 도는 움직임. 움직임 줄이기를 켠 기기에서는 멈춘다 */
export const SKY_CSS = `.sky .ring circle,.sky .ring line,.sky .guide circle{fill:none;stroke:rgba(210,180,119,.42);stroke-width:.7}
.sky .ring text{fill:rgba(236,226,206,.78);font-family:'Noto Serif KR',serif;font-size:9.5px;text-anchor:middle;dominant-baseline:middle}
.sky .r2 text{font-size:11px;fill:rgba(210,180,119,.95)}
.sky .const polyline{fill:none;stroke:rgba(236,226,206,.35);stroke-width:.6}
.sky .stars circle{fill:#F4EFE4}.sky .pole{fill:#D2B477}
.sky .r1{animation:mspin 360s linear infinite}.sky .r2{animation:mspin 520s linear infinite reverse}.sky .const,.sky .stars{animation:mspin 900s linear infinite}
@keyframes mspin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sky g{animation:none!important}}`;
