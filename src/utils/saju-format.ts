/**
 * #saju-card-share Stage 7b · 사주 카드 공통 포매터
 *
 * - 만 나이 / 세는 나이 계산 (한국 사주 도메인 friendly)
 * - 시간 범위 표기 ("05:00 → 묘시" → "05:00 (묘시 卯時, 05:00~07:00)")
 * - 음력/양력 라벨
 */

/** 만 나이 (생일 기준 +1) */
export function getManAge(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  now: Date = new Date(),
): number {
  let age = now.getFullYear() - birthYear;
  const m = now.getMonth() + 1 - birthMonth;
  if (m < 0 || (m === 0 && now.getDate() < birthDay)) age--;
  return Math.max(0, age);
}

/** 세는 나이 (출생 시 1세, 1월 1일마다 +1, 한국 전통 + 사주 도메인 표준) */
export function getKoreanAge(birthYear: number, now: Date = new Date()): number {
  return Math.max(1, now.getFullYear() - birthYear + 1);
}

/** 시지 (子丑寅卯辰巳午未申酉戌亥) — 시간(0~23) 입력 시 시지 한자/한국어/범위 반환 */
export interface HourBranch {
  /** 시지 한국어 (예: "묘시") */
  ko: string;
  /** 시지 한자 (예: "卯時") */
  hanja: string;
  /** 범위 시작 시간 (예: 5) */
  startHour: number;
  /** 범위 끝 시간 (예: 7) */
  endHour: number;
  /** "05:00~07:00" 형식 범위 */
  range: string;
}

// 지지 순서 고정 인덱스: 0=子 … 11=亥
const HOUR_BRANCH_TABLE: Array<{ ko: string; hanja: string }> = [
  { ko: '자시', hanja: '子時' },
  { ko: '축시', hanja: '丑時' },
  { ko: '인시', hanja: '寅時' },
  { ko: '묘시', hanja: '卯時' },
  { ko: '진시', hanja: '辰時' },
  { ko: '사시', hanja: '巳時' },
  { ko: '오시', hanja: '午時' },
  { ko: '미시', hanja: '未時' },
  { ko: '신시', hanja: '申時' },
  { ko: '유시', hanja: '酉時' },
  { ko: '술시', hanja: '戌時' },
  { ko: '해시', hanja: '亥時' },
];

export function getHourBranch(hour: number, minute = 0): HourBranch | null {
  if (hour === undefined || hour === null || hour < 0 || hour > 23) return null;
  // 🚨 2026-07-14 기준 v2 — 시(時) 경계 = 시계 :30 (진태양시 -30분). calculateSaju/sijiPreview 와 동일 판정.
  //   구버전은 분을 무시하고 :00 경계로 분류해, 홀수시 :00~:29 출생(하루의 25%)의 라벨이
  //   실제 계산 시주와 한 칸 어긋났다 (예: 05:10 → 계산 寅 vs 라벨 卯). 이제 -30 시프트로 일치.
  //   (서머타임 연도는 날짜가 없어 근사 — 시주 계산 자체는 calculateSaju 가 정확 처리)
  const total = ((hour * 60 + (minute || 0)) - 30 + 1440) % 1440;
  const sh = Math.floor(total / 60);
  const zhi = Math.floor((sh + 1) / 2) % 12;
  const row = HOUR_BRANCH_TABLE[zhi];
  // 시계 기준 경계 라벨: 자시 23:30~01:29, 축시 01:30~03:29, … (입력 픽커와 동일 표기)
  const startClock = zhi === 0 ? 23 : zhi * 2 - 1;
  const endClock = (startClock + 2) % 24;
  const range = `${String(startClock).padStart(2, '0')}:30~${String(endClock).padStart(2, '0')}:29`;
  return { ko: row.ko, hanja: row.hanja, startHour: startClock, endHour: endClock, range };
}

/** Stage 7e-6: 시간 라벨 — 분 0 처리 (입력 페이지에 분 필드 없을 때 정확한 표기)
 *  · minute 0 (or undefined): "5시 · 묘시(卯時, 05:00~07:00)"
 *  · minute > 0:               "05:30 · 묘시(卯時, 05:00~07:00)"
 */
export function formatBirthHour(hour?: number, minute?: number): string {
  if (hour === undefined || hour === null) return '시간 모름';
  const branch = getHourBranch(hour, minute);
  const hasMinute = (minute ?? 0) > 0;
  const timeStr = hasMinute
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : `${hour}시`;
  if (!branch) return timeStr;
  return `${timeStr}, ${branch.ko}(${branch.hanja}, ${branch.range})`;
}

/** Stage 7e-6: 짧은 시간 라벨 (보관함 등) — 분 0 이면 시간만 */
export function formatBirthHourShort(hour?: number, minute?: number): string {
  if (hour === undefined || hour === null) return '시간 모름';
  const branch = getHourBranch(hour, minute);
  const hasMinute = (minute ?? 0) > 0;
  // 2026-06-02 — 밴드 입력(분 X)이면 대표시각("12시") 숨기고 시(時) 이름만 (11:41 입력자 혼란 방지).
  if (!hasMinute) return branch ? branch.ko : `${hour}시`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return branch ? `${timeStr}, ${branch.ko}` : timeStr;
}
