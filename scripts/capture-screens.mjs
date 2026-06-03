#!/usr/bin/env node
/**
 * 사주500 모든 라우트 자동 캡처 → docs/design/screenshots/*.png
 *
 * 사용법:
 *   1. 다른 터미널에서 npm run dev (localhost:3000)
 *   2. node scripts/capture-screens.mjs
 *
 * 산출물:
 *   docs/design/screenshots/{name}.png  (모바일 사이즈 390×844, deviceScaleFactor 2)
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, '..', 'docs', 'design', 'screenshots');

// 사주 sample data를 localStorage에 미리 주입 → /result, /daeun 등이 빈 화면 안 되게
const SAMPLE_BALANCE = JSON.stringify({ paid: 1000, bonus: 0, reward: 0 });
const SAMPLE_PROFILE = JSON.stringify([{
  id: 'sample-prof-1',
  name: '준기',
  input: { birthYear: 1998, birthMonth: 3, birthDay: 3, birthHour: 5, birthMin: 0, gender: 'M' },
  relation: '본인',
  createdAt: new Date().toISOString(),
}]);

const ROUTES = [
  // Free
  { path: '/',                name: '01-home' },
  { path: '/daily',           name: '02-daily' },
  { path: '/dream',           name: '03-dream' },
  { path: '/chat',            name: '04-chat-list' },
  { path: '/chat/new',        name: '05-chat-new' },

  // Funnel
  { path: '/input',           name: '06-input' },
  { path: '/loading',         name: '07-loading' },

  // Topics (10)
  { path: '/topic/love',      name: '10-topic-love' },
  { path: '/topic/marriage',  name: '11-topic-marriage' },
  { path: '/topic/reunion',   name: '12-topic-reunion' },
  { path: '/topic/wealth',    name: '13-topic-wealth' },
  { path: '/topic/exam',      name: '14-topic-exam' },
  { path: '/topic/business',  name: '15-topic-business' },
  { path: '/topic/career',    name: '16-topic-career' },
  { path: '/topic/health',    name: '17-topic-health' },
  { path: '/topic/move',      name: '18-topic-move' },
  { path: '/topic/study',     name: '19-topic-study' },

  // Premium / Extensions
  { path: '/premium',         name: '20-premium' },
  { path: '/daeun',           name: '21-daeun' },
  { path: '/monthly',         name: '22-monthly' },
  { path: '/compat',          name: '23-compat' },
  { path: '/tojung',          name: '24-tojung' },

  // Storage / Account
  { path: '/storage',         name: '30-storage' },
  { path: '/charge',          name: '31-charge' },
  { path: '/my',              name: '32-my' },

  // Share / SajuCard
  { path: '/share/sample123', name: '40-share' },

  // Static
  { path: '/events',          name: '50-events' },
  { path: '/terms',           name: '51-terms' },
  { path: '/privacy',         name: '52-privacy' },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`📸 캡처 디렉토리: ${OUT_DIR}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  // localStorage 미리 주입 (모든 라우트 공통)
  await context.addInitScript((vals) => {
    try {
      localStorage.setItem('saju500_balance_v2', vals.balance);
      localStorage.setItem('saju500_profiles_v1', vals.profiles);
    } catch {}
  }, { balance: SAMPLE_BALANCE, profiles: SAMPLE_PROFILE });

  const page = await context.newPage();

  let ok = 0, fail = 0;
  for (const r of ROUTES) {
    const url = `http://localhost:3000${r.path}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500); // 애니메이션 대기 (networkidle 대신 domcontentloaded — /my, /events Cloud Functions polling 우회)
      await page.screenshot({
        path: join(OUT_DIR, `${r.name}.png`),
        fullPage: true,
      });
      console.log(`✓ ${r.name}  ${r.path}`);
      ok++;
    } catch (e) {
      console.log(`✗ ${r.name}  ${r.path}  — ${e.message.split('\n')[0]}`);
      fail++;
    }
  }

  await browser.close();
  console.log(`\n완료: ${ok}개 성공, ${fail}개 실패`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
