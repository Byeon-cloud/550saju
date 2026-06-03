#!/usr/bin/env node
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'docs', 'design', 'screenshots');

const ROUTES = [
  { path: '/my',     name: '32-my' },
  { path: '/events', name: '50-events' },
];

const SAMPLE_BALANCE = JSON.stringify({ paid: 1000, bonus: 0, reward: 0 });
const SAMPLE_PROFILE = JSON.stringify([{
  id: 'sample-prof-1',
  name: '준기',
  input: { birthYear: 1998, birthMonth: 3, birthDay: 3, birthHour: 5, birthMin: 0, gender: 'M' },
  relation: '본인',
  createdAt: new Date().toISOString(),
}]);

(async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript((v) => {
    try {
      localStorage.setItem('saju500_balance_v2', v.balance);
      localStorage.setItem('saju500_profiles_v1', v.profiles);
    } catch {}
  }, { balance: SAMPLE_BALANCE, profiles: SAMPLE_PROFILE });
  const page = await ctx.newPage();

  for (const r of ROUTES) {
    try {
      await page.goto(`http://localhost:3000${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: join(OUT, `${r.name}.png`), fullPage: true });
      console.log('✓', r.name);
    } catch (e) {
      console.log('✗', r.name, e.message.split('\n')[0]);
    }
  }
  await browser.close();
})();
