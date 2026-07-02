/**
 * 시지(時支) 실시간 미리보기 SSOT — 입력한 시계 시각 → 진태양시 보정(-32분) 후 시(時) 판정.
 *
 * 2026-07 분 단위 입력 도입과 함께 신설. 본인(InputPage)·상대방(TopicAnalysisPage) 공용.
 *  · calculateSaju / 서버 computePartnerPillars 와 동일한 correctKoreanSolarTime 사용
 *  · lunar-javascript 시지 규칙(보정된 '시' 기준 (h+1)/2)과 동일 → 실제 계산 결과와 정확히 일치
 *    (getTimeZhi 11케이스 전수 교차검증 완료 — "3:30 → 축시" 경계 포함)
 *  · lunar 무의존 순수 모듈 (번들 안전)
 */
import { correctKoreanSolarTime } from './timeCorrection';

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
