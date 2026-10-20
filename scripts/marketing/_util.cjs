/* 마케팅 수집기 공통 도우미 (2026-10-20) */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'docs/marketing/data');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* 0.3~0.5초 사이로 쉰다 */
const pause = () => sleep(300 + Math.floor(Math.random() * 200));

/* 한국 시각 날짜 */
function kstDate(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}
const stamp = (d = new Date()) => kstDate(d).replace(/-/g, '');

function ensureDir() { fs.mkdirSync(OUT_DIR, { recursive: true }); }
function writeJson(name, obj) {
  ensureDir();
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return p;
}
/* 엑셀에서 한글이 안 깨지도록 UTF-8 BOM + CRLF */
function writeCsv(name, header, rows) {
  ensureDir();
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
  return p;
}

/* data 폴더에서 접두어가 같은 가장 최근 파일 */
function latest(prefix, ext = '.json') {
  if (!fs.existsSync(OUT_DIR)) return null;
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith(prefix) && f.endsWith(ext)).sort();
  return files.length ? path.join(OUT_DIR, files[files.length - 1]) : null;
}

module.exports = { ROOT, OUT_DIR, sleep, pause, kstDate, stamp, writeJson, writeCsv, latest };
