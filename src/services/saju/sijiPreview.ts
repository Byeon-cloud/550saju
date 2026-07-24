/**
 * 시지(時支) 실시간 미리보기 SSOT — 입력한 시계 시각 → 진태양시 보정(-30분) 후 시(時) 판정.
 *
 * 2026-07 분 단위 입력 도입과 함께 신설. 본인(InputPage)·상대방(TopicAnalysisPage) 공용.
 *  · calculateSaju / 서버 computePartnerPillars 와 동일한 correctKoreanSolarTime 사용
 *  · lunar-javascript 시지 규칙(보정된 '시' 기준 (h+1)/2)과 동일 → 실제 계산 결과와 정확히 일치
 *    (기준 v2 · -30분: 경계 = 시계 :30 정각 — "3:30 → 인시" 경계 포함 재검증 2026-07-14)
 *  · lunar 무의존 순수 모듈 (번들 안전)
 */
import { correctKoreanSolarTime, inspectKoreanSolarTime } from './timeCorrection';

/** 12지지 (시지 인덱스 0=子 순) */
export const SIJI_TABLE: { hanja: string; ko: string }[] = [
  { hanja: '子', ko: '자시' }, { hanja: '丑', ko: '축시' }, { hanja: '寅', ko: '인시' },
  { hanja: '卯', ko: '묘시' }, { hanja: '辰', ko: '진시' }, { hanja: '巳', ko: '사시' },
  { hanja: '午', ko: '오시' }, { hanja: '未', ko: '미시' }, { hanja: '申', ko: '신시' },
  { hanja: '酉', ko: '유시' }, { hanja: '戌', ko: '술시' }, { hanja: '亥', ko: '해시' },
];

/** 숫자 코어 — 시계 시각(연월일+시분) → 보정 후 시지. 범위 밖이면 null */
export function sijiForClock(
  year: number, month: number, day: number, hour: number, minute: number,
): { hanja: string; ko: string } | null {
  if (!year || !month || !day) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const [, , , ch] = correctKoreanSolarTime(year, month, day, hour, minute, 0);
  const idx = Math.floor((ch + 1) / 2) % 12; // 子23~1, 丑1~3, 寅3~5 …
  return SIJI_TABLE[idx] ?? null;
}

/** 문자열 래퍼 — birthDate 'YYYY-M-D' + birthTime 'HH:MM' (InputPage 용) */
export function previewSiji(birthDate: string, birthTime: string): { hanja: string; ko: string } | null {
  const dm = birthDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const tm = birthTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) return null;
  return sijiForClock(Number(dm[1]), Number(dm[2]), Number(dm[3]), Number(tm[1]), Number(tm[2]));
}

/**
 * 시진 밴드 선택(정확 분 모름 — "시(時)만 아세요" fallback) → 저장할 대표 클럭 시각.
 *
 * 🚨 2026-07-14 · 87/88 서머타임 추가에 따른 앵커 보정 — 밴드 대표시각(중앙 클럭값)은
 *   평시 -30분 보정 후에도 선택한 시진 안에 안착하지만(午 12:00 → 11:30 → 午),
 *   서머타임 기간 출생은 -90분이라 직전 시진으로 밀린다(午 12:00 → 10:30 → 巳)
 *   → "午 선택 → 巳 계산" 모순. DST 기간이면 중앙값 +60분(다음 정시)으로 저장해
 *   보정 후 다시 선택 시진 중앙(-30)에 안착시킨다 (午 → 13:00 → 11:30 → 午).
 *   자시(0시)도 동일: DST 시 01:00 → 23:30 전날 → 자시 유지 + 일주=입력일(crossedMidnight).
 */
export function bandCenterHourForDate(
  year: number, month: number, day: number, centerHour: number,
): number {
  try {
    const { isDst } = inspectKoreanSolarTime(year, month, day, centerHour, 0);
    return isDst ? (centerHour + 1) % 24 : centerHour;
  } catch {
    return centerHour;
  }
}
