// 만세력 — 사주팔자 8글자 + 십성 + 오행 분포 + 괴강 등 (lunar-javascript)
// 사주500 본체와 같은 엔진 + 진태양시 -32분 보정.
import { Solar } from "npm:lunar-javascript@1.7.3";

const KOREAN_DST: Array<[number, number]> = [
  [Date.UTC(1948, 4, 31, 15), Date.UTC(1948, 8, 12, 15)],
  [Date.UTC(1949, 3, 2, 15), Date.UTC(1949, 8, 10, 15)],
  [Date.UTC(1950, 2, 31, 15), Date.UTC(1950, 8, 9, 15)],
  [Date.UTC(1951, 4, 5, 15), Date.UTC(1951, 8, 8, 15)],
  [Date.UTC(1955, 4, 4, 15), Date.UTC(1955, 8, 8, 15)],
  [Date.UTC(1956, 4, 19, 15), Date.UTC(1956, 8, 29, 15)],
  [Date.UTC(1957, 4, 4, 15), Date.UTC(1957, 8, 21, 15)],
  [Date.UTC(1958, 4, 3, 15), Date.UTC(1958, 8, 20, 15)],
  [Date.UTC(1959, 4, 2, 15), Date.UTC(1959, 8, 19, 15)],
  [Date.UTC(1960, 3, 30, 15), Date.UTC(1960, 8, 17, 15)],
];

// KST → 진태양시 보정 (-32분, 서머타임이면 -1h 추가)
function correctKST(y: number, mo: number, d: number, h: number, mi: number) {
  let utc = Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600_000;
  if (KOREAN_DST.some(([s, e]) => utc >= s && utc < e)) utc -= 3600_000;
  utc -= 32 * 60_000;
  const k = new Date(utc + 9 * 3600_000);
  return [k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate(), k.getUTCHours(), k.getUTCMinutes()];
}

const GAN_OH: Record<string, string> = { "甲": "목", "乙": "목", "丙": "화", "丁": "화", "戊": "토", "己": "토", "庚": "금", "辛": "금", "壬": "수", "癸": "수" };
const ZHI_OH: Record<string, string> = { "子": "수", "丑": "토", "寅": "목", "卯": "목", "辰": "토", "巳": "화", "午": "화", "未": "토", "申": "금", "酉": "금", "戌": "토", "亥": "수" };
const GAN_KO: Record<string, string> = { "甲": "갑", "乙": "을", "丙": "병", "丁": "정", "戊": "무", "己": "기", "庚": "경", "辛": "신", "壬": "임", "癸": "계" };
const ZHI_KO: Record<string, string> = { "子": "자", "丑": "축", "寅": "인", "卯": "묘", "辰": "진", "巳": "사", "午": "오", "未": "미", "申": "신", "酉": "유", "戌": "술", "亥": "해" };
const SIP_KO: Record<string, string> = { "比肩": "비견", "劫财": "겁재", "劫財": "겁재", "食神": "식신", "伤官": "상관", "傷官": "상관", "偏财": "편재", "偏財": "편재", "正财": "정재", "正財": "정재", "偏官": "편관", "七杀": "편관", "正官": "정관", "偏印": "편인", "正印": "정인" };
const GWIGANG = new Set(["戊戌", "庚辰", "庚戌", "壬辰", "壬戌"]);
const BAEKHO = new Set(["甲辰", "乙未", "丙戌", "丁丑", "戊辰", "壬戌", "癸丑"]);

function ko(gz: string) { return (GAN_KO[gz[0]] ?? "") + (ZHI_KO[gz[1]] ?? ""); }

export interface SajuResult {
  pillars: { year: string; month: string; day: string; time: string | null };
  dayMaster: string; // 일간 한글
  summary: string; // 프롬프트에 넣을 한국어 요약 (간지 포함)
  anonSummary: string; // 식별정보(간지·생년) 뺀 익명 요약 — 유명인 환각 방지용
}

export function computeSaju(
  y: number, mo: number, d: number, hour: number | null, minute: number | null,
): SajuResult {
  const hasTime = hour != null;
  const [cy, cm, cd, ch, cmin] = hasTime
    ? correctKST(y, mo, d, hour!, minute ?? 0)
    : [y, mo, d, 12, 0];
  const solar = hasTime ? Solar.fromYmdHms(cy, cm, cd, ch, cmin, 0) : Solar.fromYmd(y, mo, d);
  const ec = solar.getLunar().getEightChar();

  const yGz = ec.getYear(), mGz = ec.getMonth(), dGz = ec.getDay(), tGz = ec.getTime();
  const dayGan = ec.getDayGan();

  // 십성 집계 (천간 년/월/시 + 모든 지장간)
  const sip: Record<string, number> = {};
  const addSip = (raw: string | string[]) => {
    (Array.isArray(raw) ? raw : [raw]).forEach((s) => {
      const k = SIP_KO[s]; if (k) sip[k] = (sip[k] ?? 0) + 1;
    });
  };
  addSip(ec.getYearShiShenGan()); addSip(ec.getMonthShiShenGan()); addSip(ec.getTimeShiShenGan());
  addSip(ec.getYearShiShenZhi()); addSip(ec.getMonthShiShenZhi()); addSip(ec.getDayShiShenZhi());
  if (hasTime) addSip(ec.getTimeShiShenZhi());

  // 오행 집계 (8글자)
  const oh: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const chars = [yGz, mGz, dGz].concat(hasTime ? [tGz] : []);
  chars.forEach((gz) => { oh[GAN_OH[gz[0]]]++; oh[ZHI_OH[gz[1]]]++; });

  // 신강/신약 힌트
  const support = (sip["비견"] ?? 0) + (sip["겁재"] ?? 0) + (sip["정인"] ?? 0) + (sip["편인"] ?? 0);
  const drain = (sip["식신"] ?? 0) + (sip["상관"] ?? 0) + (sip["편재"] ?? 0) + (sip["정재"] ?? 0) + (sip["정관"] ?? 0) + (sip["편관"] ?? 0);
  const strength = support > drain + 1 ? "신강(자기 기운 강함)" : drain > support + 1 ? "신약(주변에 기운 빼앗김)" : "중화에 가까움";

  // 없는 십성
  const allSip = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"];
  const missing = allSip.filter((s) => !sip[s]);
  const sipStr = allSip.filter((s) => sip[s]).map((s) => `${s}${sip[s]}`).join(", ");
  const ohStr = Object.entries(oh).map(([k, v]) => `${k}${v}`).join(" ");

  const sinsal: string[] = [];
  if (GWIGANG.has(dGz)) sinsal.push("괴강(극단적 기질·카리스마·고집)");
  if (BAEKHO.has(dGz)) sinsal.push("백호(강렬·사고수술 주의)");

  const summary = `사주팔자: ${ko(yGz)}(${yGz})년 ${ko(mGz)}(${mGz})월 ${ko(dGz)}(${dGz})일${hasTime ? ` ${ko(tGz)}(${tGz})시` : " (시간모름)"}
일간(나): ${GAN_KO[dayGan]}(${dayGan}) — ${GAN_OH[dayGan]} 일간
오행 분포: ${ohStr} ${oh["수"] === 0 ? "(수 없음)" : ""}${oh["목"] === 0 ? "(목 없음)" : ""}${oh["화"] === 0 ? "(화 없음)" : ""}${oh["금"] === 0 ? "(금 없음)" : ""}${oh["토"] === 0 ? "(토 없음)" : ""}
십성 분포: ${sipStr}
없는 십성: ${missing.length ? missing.join(", ") : "없음"}
강약: ${strength}
${sinsal.length ? "신살: " + sinsal.join(", ") : ""}`;

  // 익명 요약 — 간지/생년 등 식별정보 제거, 십성·오행만 (유명인 환각 방지)
  const anonSummary = `일간(나): ${GAN_KO[dayGan]} 일간(${GAN_OH[dayGan]} 기운)${hasTime ? "" : " (출생시각 모름)"}
오행 분포: ${ohStr}${missing.length === 0 ? "" : ""}
십성 분포: ${sipStr}
없는 십성: ${missing.length ? missing.join(", ") : "없음"}
강약: ${strength}
${sinsal.length ? "특징: " + sinsal.join(", ") : ""}`;

  return {
    pillars: { year: ko(yGz), month: ko(mGz), day: ko(dGz), time: hasTime ? ko(tGz) : null },
    dayMaster: GAN_KO[dayGan],
    summary,
    anonSummary,
  };
}
