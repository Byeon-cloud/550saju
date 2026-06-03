// 그날의 일진(日辰, 일주 干支) 계산 — "오늘의 기운" 콘텐츠의 명리학적 근거.
// 표준 율리우스일(JDN) 공식 사용: 일간 = (JDN+9)%10, 일지 = (JDN+1)%12.
// ※ v1. 준기(명리 전문)가 실제 만세력과 1회 대조 권장.

const GAN = [
  { ko: "갑", han: "甲", oh: "목" },
  { ko: "을", han: "乙", oh: "목" },
  { ko: "병", han: "丙", oh: "화" },
  { ko: "정", han: "丁", oh: "화" },
  { ko: "무", han: "戊", oh: "토" },
  { ko: "기", han: "己", oh: "토" },
  { ko: "경", han: "庚", oh: "금" },
  { ko: "신", han: "辛", oh: "금" },
  { ko: "임", han: "壬", oh: "수" },
  { ko: "계", han: "癸", oh: "수" },
];
const JI = [
  { ko: "자", han: "子", animal: "쥐" },
  { ko: "축", han: "丑", animal: "소" },
  { ko: "인", han: "寅", animal: "호랑이" },
  { ko: "묘", han: "卯", animal: "토끼" },
  { ko: "진", han: "辰", animal: "용" },
  { ko: "사", han: "巳", animal: "뱀" },
  { ko: "오", han: "午", animal: "말" },
  { ko: "미", han: "未", animal: "양" },
  { ko: "신", han: "申", animal: "원숭이" },
  { ko: "유", han: "酉", animal: "닭" },
  { ko: "술", han: "戌", animal: "개" },
  { ko: "해", han: "亥", animal: "돼지" },
];

function toJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
    Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export interface DayGanji {
  ko: string; // "갑자"
  han: string; // "甲子"
  ganOh: string; // 일간 오행 "목"
  animal: string; // 띠 "쥐"
}

/** 특정 양력 날짜(y,m,d)의 일주(日柱 干支) */
export function dayGanjiOf(y: number, m: number, d: number): DayGanji {
  const jdn = toJDN(y, m, d);
  const g = GAN[((jdn + 9) % 10 + 10) % 10];
  const j = JI[((jdn + 1) % 12 + 12) % 12];
  return { ko: g.ko + j.ko, han: g.han + j.han, ganOh: g.oh, animal: j.animal };
}

/** KST 기준 그날의 일진 */
export function dayGanjiKST(now = new Date()): DayGanji {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return dayGanjiOf(kst.getUTCFullYear(), kst.getUTCMonth() + 1, kst.getUTCDate());
}

/** 연주(年柱) 간지 — 갑자=4AD 기준. ※입춘 경계는 무시(골격용 근사). */
export function yearGanjiOf(y: number): { ko: string; han: string; animal: string } {
  const g = GAN[((y - 4) % 10 + 10) % 10];
  const j = JI[((y - 4) % 12 + 12) % 12];
  return { ko: g.ko + j.ko, han: g.han + j.han, animal: j.animal };
}

/** KST 기준 날짜/요일/계절 컨텍스트 */
export function dateContextKST(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const wd = weekdays[kst.getUTCDay()];
  const season = m <= 2 || m === 12 ? "겨울" : m <= 5 ? "봄" : m <= 8 ? "여름" : "가을";
  return { y, m, d, weekday: wd, season, dateStr: `${y}년 ${m}월 ${d}일 (${wd})` };
}
