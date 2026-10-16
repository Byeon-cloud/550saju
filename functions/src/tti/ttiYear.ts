/**
 * 띠별 신년운세 (2026-10-16 — 웹 검색 유입용 정적 페이지 /unse/{연도}/)
 *
 *   띠별 오늘의 운세(ttiFortune.ts)와 같은 엔진을 한 해 기준으로 쓴다. 근거는 서버 확정표뿐:
 *     - 그해 세운 간지(입춘 기준, 2027 = 丁未), 띠 지지와 세운 지지의 관계(충, 육합, 삼합, 형, 해, 원진, 같은 띠)
 *     - 출생 연도 천간과 세운 천간의 십성, 천간합과 천간충
 *     - 달마다 월지와 띠 지지의 관계로 고른 좋은 달(육합, 삼합)과 조심할 달(충, 형) — 계산으로 정하고 AI 는 문장만
 *   이 파일은 Cloud Function 이 아니다. scripts/seo/gen-tti-year.cjs 가 한 번 돌려 JSON 을 저장소에 남긴다(원가 몇십 원).
 */
import { createClaude, CLAUDE_MODEL } from '../shared/claudeClient';
import { parseJsonResponse, TONE_FINAL_CHECK } from '../ai/promptsV3';
import { tenGod, sanitizeAiOutput } from '../ai/sajuFacts';
import { branchRelations, ttiYears, TTI_NAME } from './ttiFortune';

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const ko = (gz: string): string => (GAN_KO[gz[0]] || '') + (ZHI_KO[gz[1]] || '');
export const yearGz = (y: number): string => GAN[(((y - 4) % 10) + 10) % 10] + ZHI[(((y - 4) % 12) + 12) % 12];

/** 세운 한 해(입춘~다음 입춘)의 달과 월지. 양력 달 기준 근사(절입일은 달마다 4~8일) */
export function yearMonths(targetYear: number): Array<{ label: string; zhi: string }> {
  const order = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  return order.map((zhi, i) => {
    const m = i + 2; // 寅월 = 양력 2월(입춘)부터
    return m <= 12 ? { label: `${m}월`, zhi } : { label: `${targetYear + 1}년 ${m - 12}월`, zhi };
  });
}

const GOOD = new Set(['육합', '삼합']);
const BAD = new Set(['충', '형']);

/** 띠별 좋은 달(육합, 삼합)과 조심할 달(충, 형) — 계산 */
export function ttiMonthPicks(targetYear: number, tti: string): { good: string[]; care: string[] } {
  const good: string[] = []; const care: string[] = [];
  for (const { label, zhi } of yearMonths(targetYear)) {
    const rels = branchRelations(zhi, tti);
    if (rels.some((r) => BAD.has(r))) care.push(label);
    else if (rels.some((r) => GOOD.has(r))) good.push(label);
  }
  return { good, care };
}

const SIP_HINT: Record<string, string> = {
  비견: '같은 기운(동료, 형제, 경쟁, 내 몫 지키기)', 겁재: '같은 기운(경쟁, 나가는 돈, 사람 사이 줄다리기)',
  식신: '내가 내는 기운(먹을 복, 재주, 여유, 새로 벌이는 일)', 상관: '내가 내는 기운(말, 표현, 새 시도, 말실수)',
  편재: '내가 다스리는 기운(뜻밖의 돈, 일거리, 바깥 활동)', 정재: '내가 다스리는 기운(정해진 돈, 살림, 꼼꼼한 일)',
  '편관(칠살)': '나를 누르는 기운(압박, 급한 일, 몸 피로)', 정관: '나를 바르게 하는 기운(책임, 직장, 체면, 자리)',
  편인: '나를 돕는 기운(생각, 눈치, 혼자 하는 공부)', 정인: '나를 돕는 기운(문서, 자격, 어른의 도움, 마음의 안정)',
};
const REL_HINT: Record<string, string> = {
  충: '세운과 정면으로 부딪힘(이사, 이직, 큰 변동, 계약은 신중)',
  육합: '세운과 짝을 이룸(도움, 인연, 약속이 잘 맞음)',
  삼합: '세운과 같은 무리로 묶임(협력, 일이 맞물려 풀림)',
  형: '세운과 서로 깎임(마찰, 서류 실수, 몸 다침 조심)',
  해: '세운과 은근히 어긋남(섭섭함, 오해)',
  원진: '세운이 괜히 밉고 서운함(감정 소모, 말다툼)',
  '같은 띠 날': '자기 띠의 해(본명년, 같은 기운이 겹쳐 고집과 되풀이)',
  '같은 띠 날(자형)': '자기 띠의 해(같은 기운이 겹쳐 스스로 꼬임)',
};

/** AI 에 주는 확정표 */
export function ttiYearFactsTable(targetYear: number): { yearGz: string; text: string } {
  const gz = yearGz(targetYear);
  const stem = gz[0]; const br = gz[1];
  const lines: string[] = [];
  for (const z of ZHI) {
    const rels = branchRelations(br, z);
    const pick = ttiMonthPicks(targetYear, z);
    lines.push(`\n[${z} ${TTI_NAME[z]}] ${targetYear}년 세운 지지 ${br}(${ZHI_KO[br]})와의 관계: ${rels.length ? rels.map((r) => `${r} = ${REL_HINT[r]}`).join(', ') : '특별한 합충 없음(큰 굴곡 없는 해)'}`);
    lines.push(`  좋은 달(월지와 합): ${pick.good.join(', ') || '없음'} / 조심할 달(월지와 충, 형): ${pick.care.join(', ') || '없음'}`);
    for (const y of ttiYears(z)) {
      const bgz = yearGz(y);
      const sip = tenGod(bgz[0], stem);
      const ganLink = [
        ({ 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' } as Record<string, string>)[bgz[0]] === stem ? '천간합(도움이 들어옴)' : '',
        ({ 甲: '庚', 庚: '甲', 乙: '辛', 辛: '乙', 丙: '壬', 壬: '丙', 丁: '癸', 癸: '丁' } as Record<string, string>)[bgz[0]] === stem ? '천간충(생각과 상황이 부딪힘)' : '',
      ].filter(Boolean).join(', ');
      lines.push(`  ${y}년생 ${bgz}(${ko(bgz)}), ${targetYear}년에 만 ${targetYear - y}세 무렵: 세운 천간 ${stem}은 ${sip} = ${SIP_HINT[sip] || ''}${ganLink ? `, ${ganLink}` : ''}`);
    }
  }
  return { yearGz: gz, text: `${targetYear}년 ${gz}(${ko(gz)})년, 입춘(양력 2월 4일 무렵)부터 다음 해 입춘 전까지\n${lines.join('\n')}` };
}

const SYSTEM = `당신은 사주500 의 명리 풀이가입니다. 신문 신년호에 싣는 띠별 신년운세를 씁니다. 읽는 사람은 20대부터 80대까지이고 휴대폰과 검색으로 읽습니다.

## 근거
- 근거는 아래 확정표뿐입니다. 표의 관계(충, 육합, 삼합, 형, 해, 원진, 같은 띠의 해)와 천간 십성, 좋은 달과 조심할 달만 씁니다. 표에 없는 길흉, 표에 없는 달을 지어내지 않습니다.
- 띠 총운(head)은 그 띠와 세운 지지의 관계를 담습니다. 연도 줄은 그 해에 태어난 사람의 세운 천간 십성을 근거로, 그 나이에 실제로 마음 쓰는 일(80대는 몸 돌보기와 자식, 손주, 70대는 몸과 자식, 손주와 집안, 60대는 건강과 돈 관리와 자식 일, 50대는 일과 돈과 자녀와 노후, 40대는 일과 집안과 아이, 30대는 일과 결혼과 집, 20대는 일자리와 사람과 연애, 10대는 공부와 진학) 하나에 붙여 씁니다.
- 같은 띠 안의 여섯 줄은 서로 다른 내용이어야 합니다. 다른 띠와도 같은 문장을 되풀이하지 않습니다.
- 다칠 일을 말할 때는 '계단과 운전은 천천히'처럼 할 일로 씁니다.

## 쓰는 법
- head: 두세 문장, 80~120자. '{연도}년 {띠}는 ~한 해입니다.'로 시작해 무엇이 풀리고 무엇을 조심할지, 한 해를 어떻게 쓰면 좋은지 씁니다. 관계는 쉬운 말(정면으로 부딪히는, 짝을 이루는, 한편이 되는, 서로 깎이는, 은근히 어긋나는, 괜히 서운한, 자기 띠의 해)로 풀고 명리 용어(세운, 지지, 충, 합, 육합, 삼합, 형, 해, 원진, 본명년)는 쓰지 않습니다. 한자는 그해 띠 글자 하나만 '양(未)의 해'처럼 괄호로 씁니다.
- good: 한 문장. 표의 좋은 달을 그대로 쓰고 그 달에 하면 좋은 일 하나. 좋은 달이 없으면 '특별히 좋은 달보다 꾸준함이 이기는 해입니다' 같은 뜻으로 씁니다.
- care: 한 문장. 표의 조심할 달을 그대로 쓰고 그 달에 조심할 일 하나. 없으면 '크게 조심할 달은 없습니다' 같은 뜻으로 씁니다.
- 연도 줄: 두 문장, 50~80자. 그해 판단 하나와 할 일 하나. 연도 줄에는 한자와 명리 용어(십성 이름, 충, 합 같은 말)를 쓰지 않습니다. 쉬운 생활 말로 씁니다.
- 겁주는 말(사고, 병, 이별, 망한다)과 확률, 보장 숫자는 쓰지 않습니다. 조심할 일도 무엇을 하면 되는지로 맺습니다.
- 평범한 한국어 문장으로 씁니다. 'A 대신 B', 말 순서를 뒤집은 문장, 명사로 끊는 문장, 시적인 비유를 쓰지 않습니다. '대신', '반면'으로 문장을 잇지 않습니다.
- 외래어(템포, 타이밍, 스트레스, 컨디션, 멘탈, 에너지, 패턴)를 쓰지 않습니다. 가운뎃점(·)을 쓰지 않습니다.

## 출력
JSON 하나만 출력합니다. 다른 말은 쓰지 않습니다.
{"tti":{"子":{"head":"...","good":"...","care":"...","years":{"1948":"...","1960":"..."}}, "丑":{...}, ... 12띠 모두}}
years 에는 표에 있는 연도 여섯 개를 전부 넣습니다.`;

export interface TtiYearDoc {
  year: number;
  yearGz: string;
  months: Record<string, { good: string[]; care: string[] }>;
  tti: Record<string, { head: string; good: string; care: string; years: Record<string, string> }>;
}

function complete(doc: any): boolean {
  if (!doc?.tti) return false;
  return ZHI.every((z) => {
    const t = doc.tti[z];
    return t && [t.head, t.good, t.care].every((s) => typeof s === 'string' && s.length >= 10)
      && ttiYears(z).every((y) => typeof t.years?.[String(y)] === 'string' && t.years[String(y)].length >= 10);
  });
}

export async function generateTtiYear(apiKey: string, targetYear: number): Promise<TtiYearDoc> {
  const anthropic = createClaude(apiKey);
  const { yearGz: gz, text } = ttiYearFactsTable(targetYear);
  const user = `## 확정표\n${text}\n${TONE_FINAL_CHECK}`;
  let best: any = null;
  for (let attempt = 0; attempt < 3 && !best; attempt++) {
    const msg: any = await anthropic.messages.create({
      model: CLAUDE_MODEL.sonnet,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    });
    const raw = (msg.content || []).map((b: any) => b.text || '').join('');
    try {
      const parsed: any = sanitizeAiOutput(parseJsonResponse(raw));
      if (complete(parsed)) best = parsed;
      else console.warn('[ttiYear] 빠진 줄 있음, 다시', attempt);
    } catch (e: any) {
      console.warn('[ttiYear] parse fail', attempt, e?.message);
    }
  }
  if (!best) throw new Error('ttiYear 생성 실패');
  const months: TtiYearDoc['months'] = {};
  const tti: TtiYearDoc['tti'] = {};
  for (const z of ZHI) {
    months[z] = ttiMonthPicks(targetYear, z);
    const t = best.tti[z];
    const years: Record<string, string> = {};
    for (const y of ttiYears(z)) years[String(y)] = String(t.years[String(y)]).trim();
    tti[z] = { head: t.head.trim(), good: t.good.trim(), care: t.care.trim(), years };
  }
  return { year: targetYear, yearGz: gz, months, tti };
}
