// 만세력 30-TC 러너 — 실제 calculator.ts 를 esbuild 번들 후 Node 실행 (브라우저 캐시 무관).
import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, '_calc.bundle.mjs');

await esbuild.build({
  entryPoints: [path.join(root, 'src/services/saju/calculator.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: out,
  alias: { '@': path.join(root, 'src') },
  logLevel: 'error',
});

const { calculateSaju } = await import(pathToFileURL(out).href);

// 30 다양한 사주 (연/월/일/시 분산 — 일간 10종·계절 4종·시간유무 커버)
const TC = [
  ['TC01',1990,5,15,12,0,true],   ['TC02',1985,1,3,2,0,true],    ['TC03',1978,11,22,8,0,true],
  ['TC04',1995,8,9,16,0,true],    ['TC05',2000,2,29,22,0,true],  ['TC06',1969,7,7,6,0,true],
  ['TC07',1982,12,25,0,0,true],   ['TC08',1991,3,21,10,0,true],  ['TC09',1975,9,30,14,0,true],
  ['TC10',1988,6,18,18,0,true],   ['TC11',1963,4,4,20,0,true],   ['TC12',1999,10,10,4,0,true],
  ['TC13',1972,2,14,12,0,true],   ['TC14',1986,8,28,8,0,true],   ['TC15',1993,1,17,16,0,true],
  ['TC16',1980,5,5,2,0,true],     ['TC17',1977,11,11,22,0,true], ['TC18',1996,7,23,6,0,true],
  ['TC19',1968,3,8,10,0,true],    ['TC20',1984,9,15,14,0,true],  ['TC21',1992,12,1,18,0,true],
  ['TC22',1965,6,6,12,0,true],    ['TC23',1989,2,2,8,0,true],    ['TC24',1974,10,29,0,0,true],
  ['TC25',1997,4,19,20,0,true],   ['TC26',1981,8,13,4,0,true],   ['TC27',1970,1,25,16,0,true],
  ['TC28',1994,7,4,10,0,true],    ['TC29',1979,11,9,14,0,true],  ['TC30',1987,5,28,-1,0,false], // 시간 미입력
];

const strengthCount = {}, gyeokCount = {};
let zeroGwanWithFire = 0;
console.log('TC    | 8자                 | 일간 | 강약       | 격국            | 십성분포(비식재관인)');
console.log('-'.repeat(110));
for (const [name,y,mo,d,h,mi,hasTime] of TC) {
  const input = { birthYear:y, birthMonth:mo, birthDay:d, birthHour: hasTime?h:undefined, birthMinute: hasTime?mi:undefined, hasBirthTime:hasTime, gender:'male', name, calendarType:'solar' };
  let sd;
  try { sd = calculateSaju(input); } catch(e){ console.log(name, 'ERROR', e.message); continue; }
  const m = sd.myeongriAnalysis;
  const p = sd.pillars.map(x=>`${x.천간||'·'}${x.지지||'·'}`).join(' ');
  const dist = m.십성분포; const ds = `비${dist.비겁} 식${dist.식상} 재${dist.재성} 관${dist.관성} 인${dist.인성}`;
  strengthCount[m.일간강약]=(strengthCount[m.일간강약]||0)+1;
  const gk = m.격국.split('(')[0];
  gyeokCount[gk]=(gyeokCount[gk]||0)+1;
  console.log(`${name} | ${p.padEnd(19)} | ${(m.일간||'?').padEnd(3)} | ${(m.일간강약||'?').padEnd(9)} | ${(m.격국||'?').slice(0,14).padEnd(14)} | ${ds}`);
}
console.log('\n=== 강약 분포 (degenerate면 버그) ===', strengthCount);
console.log('=== 격국 분포 (종격 비율 과하면 버그) ===', gyeokCount);
fs.unlinkSync(out);
