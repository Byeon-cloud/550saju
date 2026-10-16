/**
 * 띠별 오늘의 운세 (2026-10-15 · 1.5.6)
 *
 *   서버 ensureTtiFortune 이 하루 한 번 ttiFortune/{YYYY-MM-DD} 를 만든다(12띠 x 출생 연도 6개).
 *   화면은 읽기만 한다. 문서가 아직 없거나 줄이 빠졌으면 같은 근거(오늘 일진과 띠의 관계, 천간 십성)로
 *   계산한 문장을 대신 보여 준다 — 빈 칸은 나가지 않는다.
 *   관계표와 시간표는 서버 functions/src/tti/ttiFortune.ts 와 같다 (한쪽을 바꾸면 둘 다).
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };

export const TTI: Array<{ ji: string; name: string }> = [
  { ji: '子', name: '쥐띠' }, { ji: '丑', name: '소띠' }, { ji: '寅', name: '호랑이띠' }, { ji: '卯', name: '토끼띠' },
  { ji: '辰', name: '용띠' }, { ji: '巳', name: '뱀띠' }, { ji: '午', name: '말띠' }, { ji: '未', name: '양띠' },
  { ji: '申', name: '원숭이띠' }, { ji: '酉', name: '닭띠' }, { ji: '戌', name: '개띠' }, { ji: '亥', name: '돼지띠' },
];
export const ttiName = (ji: string): string => TTI.find((t) => t.ji === ji)?.name ?? '';

const yearGz = (y: number): string => GAN[(((y - 4) % 10) + 10) % 10] + ZHI[(((y - 4) % 12) + 12) % 12];
/** 띠마다 출생 연도 6개 (1941~2012) — 서버와 같은 범위. 10-16 오너 지시로 29~40년생 줄은 뺐다 */
export function ttiYears(ji: string): number[] {
  const out: number[] = [];
  for (let y = 1941; y <= 2012; y++) if (yearGz(y)[1] === ji) out.push(y);
  return out;
}
export const ttiOfYear = (y: number): string => yearGz(y)[1];
/** '48년생', '08년생' — 신문 띠별 운세 표기 */
export const yearLabel = (y: number): string => `${String(y % 100).padStart(2, '0')}년생`;

/* ── 관계표 (서버와 같음) ── */
const CHUNG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const HAP6: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const HAE: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
const WONJIN: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '酉', 酉: '寅', 卯: '申', 申: '卯', 辰: '亥', 亥: '辰', 巳: '戌', 戌: '巳' };
const HYUNG = new Set(['寅巳', '巳寅', '巳申', '申巳', '寅申', '申寅', '丑戌', '戌丑', '戌未', '未戌', '丑未', '未丑', '子卯', '卯子']);
const SAMHAP: string[][] = [['申', '子', '辰'], ['亥', '卯', '未'], ['寅', '午', '戌'], ['巳', '酉', '丑']];
const HOUR_LABEL: Record<string, string> = {
  子: '밤 11시 반부터 새벽 1시 반', 丑: '새벽 1시 반부터 3시 반', 寅: '새벽 3시 반부터 5시 반', 卯: '아침 5시 반부터 7시 반',
  辰: '아침 7시 반부터 9시 반', 巳: '오전 9시 반부터 11시 반', 午: '낮 11시 반부터 1시 반', 未: '오후 1시 반부터 3시 반',
  申: '오후 3시 반부터 5시 반', 酉: '저녁 5시 반부터 7시 반', 戌: '저녁 7시 반부터 9시 반', 亥: '밤 9시 반부터 11시 반',
};
const AWAKE = ['辰', '巳', '午', '未', '申', '酉', '戌', '卯'];

function goodHour(ji: string): string {
  const cands = [HAP6[ji], ...(SAMHAP.find((g) => g.includes(ji)) || []).filter((z) => z !== ji)];
  return HOUR_LABEL[AWAKE.find((z) => cands.includes(z)) || cands[0]];
}

/** 문서가 없을 때 띠 한 줄 — 서버와 같은 근거, 정해 둔 문장 */
export function fallbackHead(dayGz: string, ji: string): string {
  const t = dayGz[1];
  const nm = ttiName(ji);
  const day = `${ZHI_KO[t]}(${t})일`;
  let s: string;
  if (CHUNG[ji] === t) s = `오늘 ${nm}는 ${day}과 정면으로 부딪히는 날입니다. 계약과 먼 길은 하루 미루세요.`;
  else if (HAP6[ji] === t) s = `오늘 ${nm}는 ${day}과 짝을 이루는 날입니다. 만날 사람을 만나기 좋습니다.`;
  else if (t !== ji && SAMHAP.some((g) => g.includes(t) && g.includes(ji))) s = `오늘 ${nm}는 ${day}과 한 무리로 묶여 일이 맞물려 풀리는 날입니다.`;
  else if (HYUNG.has(ji + t)) s = `오늘 ${nm}는 ${day}과 서로 깎이는 날입니다. 서류와 발밑을 한 번 더 살피세요.`;
  else if (HAE[ji] === t) s = `오늘 ${nm}는 ${day}과 은근히 어긋나는 날입니다. 섭섭한 말은 하루 묵혀 두세요.`;
  else if (WONJIN[ji] === t) s = `오늘 ${nm}는 ${day}과 괜히 서운해지는 날입니다. 말은 부드럽게 고르세요.`;
  else if (t === ji) s = `오늘 ${nm}는 같은 띠의 날이라 고집이 세지는 날입니다. 남의 말을 한 번 더 들어 보세요.`;
  else s = `오늘 ${nm}는 크게 부딪히는 것 없이 무난한 날입니다.`;
  return `${s} ${goodHour(ji)} 사이가 가장 좋습니다.`;
}

/* 천간 십성 (태어난 해 천간 기준, 오늘 천간) */
const GAN_OH: Record<string, string> = { 甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수' };
const GEN: Record<string, string> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
const CTRL: Record<string, string> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
const YANG = new Set(['甲', '丙', '戊', '庚', '壬']);
function tenGod(me: string, other: string): string {
  const d = GAN_OH[me]; const o = GAN_OH[other];
  if (!d || !o) return '';
  const same = YANG.has(me) === YANG.has(other);
  if (d === o) return same ? '비견' : '겁재';
  if (GEN[d] === o) return same ? '식신' : '상관';
  if (CTRL[d] === o) return same ? '편재' : '정재';
  if (CTRL[o] === d) return same ? '편관' : '정관';
  return same ? '편인' : '정인';
}
const SIP_LINE: Record<string, string> = {
  비견: '내 몫을 분명히 챙기면 좋은 날입니다. 같이 하는 일은 말로 정리해 두세요.',
  겁재: '나가는 돈이 생기기 쉬운 날입니다. 큰 지출은 하루 미루세요.',
  식신: '먹을 복과 여유가 있는 날입니다. 가까운 사람과 밥 한 끼 하세요.',
  상관: '말이 앞서기 쉬운 날입니다. 하고 싶은 말은 한 번 고르고 하세요.',
  편재: '바깥에서 뜻밖의 일거리나 돈 이야기가 생기는 날입니다.',
  정재: '살림과 돈 정리를 하기 좋은 날입니다. 통장을 한 번 살펴보세요.',
  편관: '일이 몰려 피곤한 날입니다. 하나씩 차례로 처리하세요.',
  정관: '맡은 일에서 인정받는 날입니다. 약속한 일부터 끝내세요.',
  편인: '혼자 생각할 때 답이 보이는 날입니다. 큰 결정은 하룻밤 두고 보세요.',
  정인: '어른이나 믿을 만한 사람의 도움이 따르는 날입니다. 서류는 한 번 더 확인하세요.',
};
export function fallbackYearLine(dayGz: string, year: number): string {
  return SIP_LINE[tenGod(yearGz(year)[0], dayGz[0])] || '';
}

export interface TtiDay {
  date: string;
  dayGz: string;
  tti: Record<string, { head: string; years: Record<string, string> }>;
}

const mem: Record<string, Promise<TtiDay | null>> = {};
/** 오늘 문서 — 없거나 읽기 실패면 null (화면은 계산 문장으로) */
export function loadTtiDay(dateKey: string): Promise<TtiDay | null> {
  if (!mem[dateKey]) {
    mem[dateKey] = getDoc(doc(db, 'ttiFortune', dateKey))
      .then((snap) => {
        const d = snap.exists() ? (snap.data() as any) : null;
        return d?.tti ? ({ date: dateKey, dayGz: String(d.dayGz || ''), tti: d.tti } as TtiDay) : null;
      })
      .catch(() => null);
  }
  return mem[dateKey];
}

/* ── 내 띠, 내 해 (기기에만 · 다음에 열면 바로 보이게) ── */
const MY_KEY = 'saju500:my_tti';
export function getMyTti(): { ji: string; year?: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(MY_KEY) || 'null');
    return v && typeof v.ji === 'string' && ZHI.includes(v.ji) ? { ji: v.ji, year: Number(v.year) || undefined } : null;
  } catch { return null; }
}
export function setMyTti(ji: string, year?: number): void {
  try { localStorage.setItem(MY_KEY, JSON.stringify({ ji, ...(year ? { year } : {}) })); } catch { /* noop */ }
}

/** 띠별 조심할 시간 (충 시진, 깨어 있는 때만) */
export function badHour(ji: string): string | null {
  const c = CHUNG[ji];
  return AWAKE.includes(c) ? HOUR_LABEL[c] : null;
}
export const goodHourOf = goodHour;

type Rel = '충' | '형' | '원진' | '해' | '육합' | '삼합' | '같은 띠' | '무난';
/** 기간(달, 해)의 지지와 띠의 관계 하나 — 부딪힘을 먼저 알린다 */
function mainRel(br: string, ji: string): Rel {
  if (CHUNG[ji] === br) return '충';
  if (HYUNG.has(ji + br)) return '형';
  if (WONJIN[ji] === br) return '원진';
  if (HAE[ji] === br) return '해';
  if (HAP6[ji] === br) return '육합';
  if (br !== ji && SAMHAP.some((g) => g.includes(br) && g.includes(ji))) return '삼합';
  if (br === ji) return '같은 띠';
  return '무난';
}

/** 이번 달(절기 달) 띠 운 한 줄 — label 예: '이번 달(무술월)' */
export function monthTtiLine(monthGz: string, ji: string, label: string): string {
  const nm = ttiName(ji);
  switch (mainRel(monthGz[1], ji)) {
    case '충': return `${label}은 ${nm}와 정면으로 부딪히는 달입니다. 이사, 계약, 큰돈 쓰는 일은 서두르지 마세요.`;
    case '형': return `${label}은 ${nm}와 서로 깎이는 달입니다. 서류와 몸을 한 번 더 챙기세요.`;
    case '원진': return `${label}은 ${nm}에게 괜히 서운한 일이 생기는 달입니다. 섭섭한 말은 하루 묵혔다가 하세요.`;
    case '해': return `${label}은 ${nm}와 은근히 어긋나는 달입니다. 가까운 사람에게 하는 말을 아끼세요.`;
    case '육합': return `${label}은 ${nm}와 짝이 맞는 달입니다. 사람 덕을 보고, 미뤄 둔 약속이 잘 풀립니다.`;
    case '삼합': return `${label}은 ${nm}와 한 무리로 묶이는 달입니다. 여럿이 함께 하는 일이 잘 맞물립니다.`;
    case '같은 띠': return `${label}은 ${nm}와 같은 띠의 달이라 고집이 세집니다. 혼자 정하지 말고 한 번 더 물어보세요.`;
    default: return `${label}은 ${nm}에게 크게 부딪히는 것 없는 무난한 달입니다.`;
  }
}

/** 내년 띠 운 한 줄 — label 예: '2027년 정미년' (신년운세로 잇는 맛보기) */
export function yearTtiLine(yearGzStr: string, ji: string, label: string): string {
  const nm = ttiName(ji);
  switch (mainRel(yearGzStr[1], ji)) {
    case '충': return `${label}은 ${nm}와 정면으로 부딪히는 해입니다. 이사나 일의 큰 변화가 따르니 언제 움직일지 달마다 미리 보세요.`;
    case '형': return `${label}은 ${nm}와 서로 깎이는 해입니다. 서류와 다툼, 몸을 다른 해보다 꼼꼼히 챙기세요.`;
    case '원진': return `${label}은 ${nm}에게 괜히 서운한 일이 생기는 해입니다. 마음 상하는 일은 길게 끌지 마세요.`;
    case '해': return `${label}은 ${nm}와 은근히 어긋나는 해입니다. 가까운 사람과의 오해를 조심하세요.`;
    case '육합': return `${label}은 ${nm}와 짝이 맞는 해입니다. 사람 덕으로 일이 풀립니다.`;
    case '삼합': return `${label}은 ${nm}와 한 무리로 묶이는 해입니다. 함께 하는 일과 사람 사이가 잘 맞물립니다.`;
    case '같은 띠': return `${label}은 ${nm}의 해입니다. 한 해 동안 변화가 많아 달마다 흐름을 알아 두면 좋습니다.`;
    default: return `${label}은 ${nm}에게 크게 부딪히는 것 없는 무난한 해입니다. 그래도 좋은 달과 조심할 달은 따로 있습니다.`;
  }
}
