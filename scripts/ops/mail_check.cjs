/* 회사 메일함(info@juulabel.com) 읽기 전용 확인 (2026-10-26, 오너 '메일 오면 바로바로 확인')
 *   사용: firebase functions:secrets:access MAIL_APP_PASSWORD --project appintoss-saju | node scripts/ops/mail_check.cjs [검색어] [일수] [--body 번호]
 *   --body 번호: 목록의 [번호] 메일 본문 글자(앞 3,000자)를 찍는다. 첨부는 읽지 않는다.
 *   구글 IMAP 에 앱 비밀번호로 붙어 최근 메일의 보낸 사람, 제목, 날짜만 찍는다(본문과 비밀번호는 찍지 않는다).
 *   검색어를 주면 보낸 사람이나 제목에 그 말이 든 메일만(예: portone). 읽음 표시를 바꾸지 않게 EXAMINE(읽기 전용)으로 연다. */
const tls = require('tls');

const USER = 'info@juulabel.com';
const argv = process.argv.slice(2);
const bi = argv.indexOf('--body');
const BODY = bi >= 0 && /^\d+$/.test(argv[bi + 1] || '') ? argv[bi + 1] : '';
if (bi >= 0) argv.splice(bi, 2);
const [query = '', daysArg = '7'] = argv;
const days = Math.max(1, Math.min(60, Number(daysArg) || 7));

/** 메일 한 통(원문)에서 읽을 글자만: text/plain 부분 우선, 없으면 text/html 에서 태그를 걷어 낸다 */
function plainText(raw) {
  const src = raw.replace(/^\* \d+ FETCH[^\r\n]*\r\n/, '');
  const parts = [];
  const walk = (chunk) => {
    const sep = chunk.search(/\r?\n\r?\n/);
    const head = sep >= 0 ? chunk.slice(0, sep) : '';
    const body = sep >= 0 ? chunk.slice(sep).replace(/^\r?\n\r?\n/, '') : chunk;
    // 2026-10-26 머리글은 줄 단위로 읽는다(서명 줄의 h=...:content-type:... 을 형식으로 잘못 읽어 본문이 비던 것)
    const lines = head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/);
    const field = (name) => (lines.find((l) => l.toLowerCase().startsWith(`${name}:`)) || '').slice(name.length + 1).trim();
    const ctLine = field('content-type');
    const ct = (ctLine.split(';')[0] || 'text/plain').trim() || 'text/plain';
    const bd = (ctLine.match(/boundary="?([^";]+)"?/i) || [])[1];
    if (/multipart\//i.test(ct) && bd) {
      body.split(`--${bd}`).slice(1).forEach((p) => { if (!p.startsWith('--')) walk(p.replace(/^\r?\n/, '')); });
      return;
    }
    const cs = (ctLine.match(/charset="?([^";]+)"?/i) || [])[1] || 'utf-8';
    const enc = field('content-transfer-encoding').toLowerCase();
    let buf;
    if (enc === 'base64') buf = Buffer.from(body.replace(/\s+/g, ''), 'base64');
    else if (enc === 'quoted-printable') buf = Buffer.from(body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_m, x) => String.fromCharCode(parseInt(x, 16))), 'binary');
    else buf = Buffer.from(body, 'binary');
    let text;
    try { text = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { text = buf.toString('utf8'); }
    parts.push({ ct: ct.toLowerCase(), text });
  };
  walk(Buffer.from(src, 'utf8').toString('binary'));
  const plain = parts.find((p) => p.ct === 'text/plain');
  if (plain) return plain.text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const html = parts.find((p) => p.ct === 'text/html');
  return html ? html.text.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim() : '';
}

function since(d) {
  const t = new Date(Date.now() - d * 864e5);
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][t.getUTCMonth()];
  return `${t.getUTCDate()}-${m}-${t.getUTCFullYear()}`;
}
/** =?UTF-8?B?...?= 같은 머리글을 읽을 수 있게 */
function decodeWords(s) {
  return s.replace(/\?=\s+=\?/g, '?==?').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, txt) => {
    try {
      const buf = enc.toUpperCase() === 'B' ? Buffer.from(txt, 'base64') : Buffer.from(txt.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16))), 'binary');
      return new TextDecoder(/utf-?8/i.test(cs) ? 'utf-8' : cs).decode(buf);
    } catch { return txt; }
  }).replace(/\s+/g, ' ').trim();
}

(async () => {
  const pass = require('fs').readFileSync(0, 'utf8').replace(/\s+/g, '');
  if (pass.length < 12) { console.error('비밀번호를 받지 못했어요'); process.exit(1); }
  const sock = tls.connect(993, 'imap.gmail.com', { servername: 'imap.gmail.com' });
  let buf = '';
  let seq = 0;
  const waiters = [];
  sock.on('data', (d) => {
    buf += d.toString('utf8');
    while (waiters.length) {
      const w = waiters[0];
      const re = new RegExp(`(^|\\r\\n)${w.tag} (OK|NO|BAD)[^\\r\\n]*\\r\\n`);
      const m = buf.match(re);
      if (!m) break;
      const end = m.index + m[0].length;
      const out = buf.slice(0, end);
      buf = buf.slice(end);
      waiters.shift();
      if (m[2] !== 'OK') w.reject(new Error(`${w.cmdName} 실패: ${m[0].trim().slice(0, 120)}`));
      else w.resolve(out);
    }
  });
  const cmd = (line, cmdName = line.split(' ')[0]) => new Promise((resolve, reject) => {
    const tag = `a${++seq}`;
    waiters.push({ tag, resolve, reject, cmdName });
    sock.write(`${tag} ${line}\r\n`);
  });
  await new Promise((r) => sock.once('data', r)); // 인사말
  await cmd(`LOGIN ${USER} ${pass}`, 'LOGIN');
  await cmd('EXAMINE INBOX');
  const sr = await cmd(`SEARCH SINCE ${since(days)}`, 'SEARCH');
  const all = ((sr.match(/\* SEARCH([^\r\n]*)/) || [])[1] || '').trim().split(/\s+/).filter(Boolean).slice(-300);
  const rows = [];
  if (all.length) {
    const fr = await cmd(`FETCH ${all.join(',')} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`, 'FETCH');
    for (const b of fr.split(/\r\n(?=\* \d+ FETCH)/)) {
      if (!/FETCH/.test(b)) continue;
      const h = (k) => decodeWords(((b.match(new RegExp(`\\r?\\n${k}: ([^\\r\\n]*(?:\\r\\n[ \\t][^\\r\\n]*)*)`, 'i')) || [])[1] || ''));
      rows.push({ no: (b.match(/\* (\d+) FETCH/) || [])[1] || '?', date: h('Date'), from: h('From'), subject: h('Subject') });
    }
  }
  // 검색어는 받아 온 머리글에서 거른다(IMAP 검색은 한글을 그대로 못 받는다)
  const q = query.toLowerCase();
  const hits = (q ? rows.filter((r) => `${r.from} ${r.subject}`.toLowerCase().includes(q)) : rows).slice(-30);
  console.log(`받은 메일함, 최근 ${days}일${query ? `, '${query}'` : ''}: ${hits.length}통`);
  for (const r of hits) console.log(`- [${r.no}] ${r.date.slice(0, 31)} | ${r.from.slice(0, 60)} | ${r.subject.slice(0, 90)}`);
  if (BODY) {
    const raw = await cmd(`FETCH ${BODY} (BODY.PEEK[]<0.200000>)`, 'FETCH');
    console.log(`\n본문 [${BODY}]\n${plainText(raw).slice(0, 3000)}`);
  }
  await cmd('LOGOUT').catch(() => {});
  sock.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
