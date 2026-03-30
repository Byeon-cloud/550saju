/** 숫자를 원화 형식으로 포맷 */
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

/** 운(運) 잔액 포맷 */
export function formatUn(un: number): string {
  return `${un}운`;
}

/** 날짜를 YYYY.MM.DD 형식으로 포맷 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

/** 생년월일 포맷 */
export function formatBirthDate(year: number, month: number, day: number): string {
  return `${year}년 ${month}월 ${day}일`;
}

/** 나이 계산 (만 나이) */
export function calculateAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}
