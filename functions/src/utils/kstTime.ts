/**
 * 한국시간(KST) 기준 "현재 시각" — 2026-06-30.
 *
 * ⚠️ Cloud Functions 는 UTC 로 동작한다. 서버에서 `new Date()` 로 "올해 / 이번 달 / 오늘" 같은
 *    현재시각 framing 을 만들면 KST 0~9시 구간에 하루·한 달·한 해가 밀린다(UTC = KST - 9h).
 *    사주 콘텐츠의 시제(과거/현재/미래)·세운(올해 간지)·일진(오늘) framing 은 전부 KST 기준이어야
 *    하므로, 서버의 현재시각 로직은 반드시 이 헬퍼를 사용한다.
 *
 * 원국(연/월/일/시주)은 유저 입력 생년월일 + 진태양시 보정으로 계산되어 이 헬퍼와 무관(타임존 안전).
 */
export interface KstNow {
  year: number;
  month: number; // 1~12
  day: number;   // 1~31
  hour: number;  // 0~23 (KST)
}

/** KST 현재 연·월·일·시. UTC epoch 에 +9h 후 UTC getter 로 읽어 KST 값을 얻는다. */
export function kstNow(): KstNow {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
  };
}

/** KST 현재 날짜의 Date 객체(자정 기준, UTC 필드에 KST 값). 날짜 산술용. */
export function kstNowDate(): Date {
  const n = kstNow();
  return new Date(Date.UTC(n.year, n.month - 1, n.day));
}
