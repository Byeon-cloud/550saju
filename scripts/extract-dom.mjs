#!/usr/bin/env node
/**
 * 페이지 DOM 트리 → Figma 노드 변환용 JSON 추출
 *
 * 추출 정보:
 *   - tag, x, y, width, height
 *   - 배경색 (있을 때만)
 *   - radius
 *   - text content (leaf 텍스트만)
 *   - 색상, 폰트 size/weight (text node)
 *   - hierarchical tree
 *
 * 필터:
 *   - 안 보이는 요소 (display:none, opacity 0, size 0) 제외
 *   - 의미 없는 wrapper div (배경색·radius·텍스트 없는) 평탄화
 */

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'docs', 'design', 'dom-trees');

const SAMPLE_BALANCE = JSON.stringify({ paid: 1000, bonus: 0, reward: 0 });
const SAMPLE_PROFILE = JSON.stringify([{
  id: 'sample-prof-1',
  name: '준기',
  input: { birthYear: 1998, birthMonth: 3, birthDay: 3, birthHour: 5, birthMin: 0, gender: 'M' },
  relation: '본인',
  createdAt: new Date().toISOString(),
}]);

const ROUTES = [
  { path: '/', name: '01-home' },
];

const EXTRACT_FN = `
(() => {
  function rgbToObj(rgb) {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return null;
    const m = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return {
      r: parseInt(m[1]) / 255,
      g: parseInt(m[2]) / 255,
      b: parseInt(m[3]) / 255,
      a: m[4] ? parseFloat(m[4]) : 1,
    };
  }

  function extract(el, parentRect) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return null;

    // leaf text? 자식 요소 없고 텍스트 있는 경우
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .filter(Boolean)
      .join(' ');
    const hasOnlyTextChildren = el.children.length === 0 && directText.length > 0;

    const bg = rgbToObj(cs.backgroundColor);
    const color = rgbToObj(cs.color);
    const radius = parseFloat(cs.borderRadius) || 0;
    const tag = el.tagName.toLowerCase();

    // node 정보
    const node = {
      tag,
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      bg,
      radius,
      text: hasOnlyTextChildren ? directText.slice(0, 200) : null,
      color: hasOnlyTextChildren ? color : null,
      fontSize: hasOnlyTextChildren ? parseFloat(cs.fontSize) : null,
      fontWeight: hasOnlyTextChildren ? (parseInt(cs.fontWeight) || 400) : null,
      children: [],
    };

    // 자식 재귀
    for (const child of el.children) {
      const c = extract(child, rect);
      if (c) node.children.push(c);
    }

    // 의미 있는 노드인지: 텍스트 / 배경색 / radius / 자식 2+
    const meaningful = node.text || node.bg || node.radius > 0 || node.children.length >= 2;
    if (!meaningful && node.children.length === 1) {
      // wrapper div 평탄화
      return node.children[0];
    }
    return meaningful || node.children.length > 0 ? node : null;
  }

  const root = document.body;
  const tree = extract(root, root.getBoundingClientRect());
  return tree;
})()
`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await ctx.addInitScript((v) => {
    try {
      localStorage.setItem('saju500_balance_v2', v.balance);
      localStorage.setItem('saju500_profiles_v1', v.profiles);
    } catch {}
  }, { balance: SAMPLE_BALANCE, profiles: SAMPLE_PROFILE });

  const page = await ctx.newPage();
  for (const r of ROUTES) {
    await page.goto(`http://localhost:3000${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const tree = await page.evaluate(EXTRACT_FN);
    await writeFile(join(OUT_DIR, `${r.name}.json`), JSON.stringify(tree, null, 2));
    console.log(`✓ ${r.name}.json (${countNodes(tree)} nodes)`);
  }
  await browser.close();
}

function countNodes(t) {
  if (!t) return 0;
  return 1 + (t.children || []).reduce((s, c) => s + countNodes(c), 0);
}

main().catch(e => { console.error(e); process.exit(1); });
