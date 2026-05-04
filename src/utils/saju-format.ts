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

const HOUR_BRANCH_TABLE: Array<{ start: number; end: number; ko: string; hanja: string }> = [
  { start: 23, end: 1,  ko: '자시', hanja: '子時' },
  { start: 1,  end: 3,  ko: '축시', hanja: '丑時' },
  { start: 3,  end: 5,  ko: '인시', hanja: '寅時' },
  { start: 5,  end: 7,  ko: '묘시', hanja: '卯時' },
  { start: 7,  end: 9,  ko: '진시', hanja: '辰時' },
  { start: 9,  end: 11, ko: '사시', hanja: '巳時' },
  { start: 11, end: 13, ko: '오시', hanja: '午時' },
  { start: 13, end: 15, ko: '미시', hanja: '未時' },
  { start: 15, end: 17, ko: '신시', hanja: '申時' },
  { start: 17, end: 19, ko: '유시', hanja: '酉時' },
  { start: 19, end: 21, ko: '술시', hanja: '戌時' },
  { start: 21, end: 23, ko: '해시', hanja: '亥時' },
];

export function getHourBranch(hour: number, minute = 0): HourBranch | null {
  if (hour === undefined || hour === null || hour < 0 || hour > 23) return null;
  // 자시 (23시~1시) 처리
  for (const row of HOUR_BRANCH_TABLE) {
    const inRange = row.start === 23
      ? (hour === 23 || hour < 1)
      : (hour >= row.start && hour < row.end);
    if (inRange) {
      // 자시는 23:00~01:00, 다른 시간은 일반 형식
      const startStr = String(row.start).padStart(2, '0') + ':00';
      const endStr = String(row.end).padStart(2, '0') + ':00';
      const range = row.start === 23 ? '23:00~01:00' : `${startStr}~${endStr}`;
      void minute;
      return { ko: row.ko, hanja: row.hanja, startHour: row.start, endHour: row.end, range };
    }
  }
  return null;
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
  return `${timeStr} · ${branch.ko}(${branch.hanja}, ${branch.range})`;
}

/** Stage 7e-6: 짧은 시간 라벨 (보관함 등) — 분 0 이면 시간만 */
export function formatBirthHourShort(hour?: number, minute?: number): string {
  if (hour === undefined || hour === null) return '시간 모름';
  const branch = getHourBranch(hour, minute);
  const hasMinute = (minute ?? 0) > 0;
  const timeStr = hasMinute
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : `${hour}시`;
  if (!branch) return timeStr;
  return `${timeStr} · ${branch.ko}`;
}
