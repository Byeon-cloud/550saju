/**
 * KST 날짜 헬퍼 SSOT (2026-07-03)
 *
 * 배경: `new Date().toISOString().slice(0,10)` 은 **UTC** 날짜 — 한국 유저가
 *   자정~오전 9시(KST) 사이에 쓰면 "어제"로 판정된다.
 *   실제 CS: "공유 리워드가 다음날 안 들어와요" (일 3회 리셋이 KST 오전 9시에야 됨),
 *   일일 무료패스도 아침에 안 풀리는 동일 클래스.
 *
 * 일 단위 리셋·시드·키가 필요한 모든 곳은 이 헬퍼만 쓸 것. (서버는 utils/kstTime.ts)
 */

/** 오늘 날짜 'YYYY-MM-DD' — KST 기준 */
export function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
