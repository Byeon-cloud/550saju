/* 회사 메일함(info@juulabel.com) 읽기 전용 확인 (2026-10-26, 오너 '메일 오면 바로바로 확인')
 *   사용: firebase functions:secrets:access MAIL_APP_PASSWORD --project appintoss-saju | node scripts/ops/mail_check.cjs [검색어] [일수]
 *   구글 IMAP 에 앱 비밀번호로 붙어 최근 메일의 보낸 사람, 제목, 날짜만 찍는다(본문과 비밀번호는 찍지 않는다).
 *   검색어를 주면 보낸 사람이나 제목에 그 말이 든 메일만(예: portone). 읽음 표시를 바꾸지 않게 EXAMINE(읽기 전용)으로 연다. */
const tls = require('tls');

const USER = 'info@juulabel.com';
const [query = '', daysArg = '7'] = process.argv.slice(2);
const days = Math.max(1, Math.min(60, Number(daysArg) || 7));

function since(d) {
  const t = new Date(Date.now() - d * 864e5);
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][t.getUTCMonth()];
  return `${t.getUTCDate()}-${m}-${t.getUTCFullYear()}`;
}
/** =?UTF-8?B?...?= 같은 머리글을 읽을 수 있게 */
function decodeWords(s) {
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, txt) => {
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
  const crit = query ? `SINCE ${since(days)} OR FROM "${query}" SUBJECT "${query}"` : `SINCE ${since(days)}`;
  const sr = await cmd(`SEARCH ${crit}`, 'SEARCH');
  const ids = ((sr.match(/\* SEARCH([^\r\n]*)/) || [])[1] || '').trim().split(/\s+/).filter(Boolean).slice(-30);
  console.log(`받은 메일함, 최근 ${days}일${query ? `, '${query}'` : ''}: ${ids.length}통`);
  if (ids.length) {
    const fr = await cmd(`FETCH ${ids.join(',')} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`, 'FETCH');
    const blocks = fr.split(/\r\n(?=\* \d+ FETCH)/);
    for (const b of blocks) {
      const h = (k) => decodeWords(((b.match(new RegExp(`\\r?\\n${k}: ([^\\r\\n]*(?:\\r\\n[ \\t][^\\r\\n]*)*)`, 'i')) || [])[1] || ''));
      if (!/FETCH/.test(b)) continue;
      console.log(`- ${h('Date').slice(0, 31)} | ${h('From').slice(0, 60)} | ${h('Subject').slice(0, 90)}`);
    }
  }
  await cmd('LOGOUT').catch(() => {});
  sock.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
