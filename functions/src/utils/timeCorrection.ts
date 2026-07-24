/**
 * 한국 진태양시(眞太陽時) 보정
 *
 * 명리학적 근거:
 *   한국 표준시는 동경 135°(일본 아카시) 기준이지만,
 *   서울의 실제 경도는 127.5° 부근 → 30분 어긋남.
 *   사주 명리는 출생 순간의 천체 운행(태양시)을 기준 → 보정 필수.
 *
 * 보정 공식:
 *   진태양시 = KST - 30 분 (업계 표준 관행 — 경계 = 시계 :30 · 2026-07-14 기준 확정)
 *   경도 실측은 -32분이나 대중 만세력 정합을 위해 -30분 고정 (클라와 동일 유지)
 *
 * 서머타임(일광절약시간제) 한국 적용 기간:
 *   1948-06-01 00:00 ~ 1948-09-13 00:00 (KST+1)
 *   1949-04-03 00:00 ~ 1949-09-11 00:00
 *   1950-04-01 00:00 ~ 1950-09-10 00:00
 *   1951-05-06 00:00 ~ 1951-09-09 00:00
 *   1955-05-05 00:00 ~ 1955-09-09 00:00 (시작일자 학자별 약간 상이)
 *   1956-05-20 00:00 ~ 1956-09-30 00:00
 *   1957-05-05 00:00 ~ 1957-09-22 00:00
 *   1958-05-04 00:00 ~ 1958-09-21 00:00
 *   1959-05-03 00:00 ~ 1959-09-20 00:00
 *   1960-05-01 00:00 ~ 1960-09-18 00:00
 *   1987-05-10 02:00 ~ 1987-10-11 03:00 (서울올림픽 · 2026-07-14 구현 추가)
 *   1988-05-08 02:00 ~ 1988-10-09 03:00
 *   서머타임 기간엔 KST 가 +1 시간 앞섬 → 진태양시로 환산하려면 -1시간 더 빼야 함
 *
 * 출처:
 *   - 홍성민 「현대 한국 명리학」 (석사학위 논문)
 *   - 박재완 『명리요강』 시간 보정 단원
 *   - 김만태 「현대 한국 명리학의 학술적 정립」
 *
 * 사용:
 *   const corrected = correctKoreanSolarTime(1985, 3, 15, 11, 50);
 *   // → [1985, 3, 15, 11, 20, 0]  (30분 보정)
 *   Solar.fromYmdHms(...corrected);
 */

/** 서머타임 기간 (KST 기준 시작/끝) — Date.parse 가능 ISO 형식 */
interface DstRange {
  startUtc: number; // unix ms (KST 기준 → UTC = KST - 9h)
  endUtc: number;
}

const KOREAN_DST_RANGES: DstRange[] = [
  // 1948-06-01 00:00 KST ~ 1948-09-13 00:00 KST
  { startUtc: Date.UTC(1948, 4, 31, 15, 0), endUtc: Date.UTC(1948, 8, 12, 15, 0) },
  // 1949-04-03 ~ 1949-09-11
  { startUtc: Date.UTC(1949, 3, 2, 15, 0),  endUtc: Date.UTC(1949, 8, 10, 15, 0) },
  // 1950-04-01 ~ 1950-09-10
  { startUtc: Date.UTC(1950, 2, 31, 15, 0), endUtc: Date.UTC(1950, 8, 9, 15, 0) },
  // 1951-05-06 ~ 1951-09-09
  { startUtc: Date.UTC(1951, 4, 5, 15, 0),  endUtc: Date.UTC(1951, 8, 8, 15, 0) },
  // 1955-05-05 ~ 1955-09-09
  { startUtc: Date.UTC(1955, 4, 4, 15, 0),  endUtc: Date.UTC(1955, 8, 8, 15, 0) },
  // 1956-05-20 ~ 1956-09-30
  { startUtc: Date.UTC(1956, 4, 19, 15, 0), endUtc: Date.UTC(1956, 8, 29, 15, 0) },
  // 1957-05-05 ~ 1957-09-22
  { startUtc: Date.UTC(1957, 4, 4, 15, 0),  endUtc: Date.UTC(1957, 8, 21, 15, 0) },
  // 1958-05-04 ~ 1958-09-21
  { startUtc: Date.UTC(1958, 4, 3, 15, 0),  endUtc: Date.UTC(1958, 8, 20, 15, 0) },
  // 1959-05-03 ~ 1959-09-20
  { startUtc: Date.UTC(1959, 4, 2, 15, 0),  endUtc: Date.UTC(1959, 8, 19, 15, 0) },
  // 1960-05-01 ~ 1960-09-18
  { startUtc: Date.UTC(1960, 3, 30, 15, 0), endUtc: Date.UTC(1960, 8, 17, 15, 0) },
  // 🚨 2026-07-14 추가 — 1987·1988 서울올림픽 서머타임 (PRD §4.2 스펙에 있었으나 구현 누락).
  //   87·88년 여름 출생자의 시주가 1시간 어긋나던 정확도 버그 fix (클라와 동일 유지).
  // 1987-05-10 02:00 ~ 1987-10-11 03:00 KST
  { startUtc: Date.UTC(1987, 4, 9, 17, 0),  endUtc: Date.UTC(1987, 9, 10, 18, 0) },
  // 1988-05-08 02:00 ~ 1988-10-09 03:00 KST
  { startUtc: Date.UTC(1988, 4, 7, 17, 0),  endUtc: Date.UTC(1988, 9, 8, 18, 0) },
];

/**
 * 한국에서 출생한 사람의 KST → 진태양시 보정
 * @returns [year, month, day, hour, minute, second]
 */
export function correctKoreanSolarTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number = 0,
): [number, number, number, number, number, number] {
  // KST 시각을 UTC milliseconds 로 환산 (KST = UTC + 9h)
  const kstAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  // 입력 시각이 KST 라면 실제 UTC 는 -9h
  const realUtcMs = kstAsUtc - 9 * 60 * 60 * 1000;

  // 1단계: 서머타임 기간이면 -1 시간 더 (KST 가 +1 앞서 있었으므로)
  // 🚨 2026-07-14 기준 확정 (준기 결정) — 업계 표준 -30분 고정 (경계 = 시계 :30).
  //   클라 src/services/saju/timeCorrection.ts 와 반드시 동일 값 유지 (상세 근거는 클라 파일 헤더).
  let totalOffsetMin = -30; // 기본 진태양시 보정
  for (const dst of KOREAN_DST_RANGES) {
    if (realUtcMs >= dst.startUtc && realUtcMs < dst.endUtc) {
      totalOffsetMin -= 60;
      break;
    }
  }

  // 2단계: 보정된 시각으로 환산 (총 분 단위 가산)
  const correctedKstMs = kstAsUtc + totalOffsetMin * 60 * 1000;
  const d = new Date(correctedKstMs);
  // UTC getter 로 호출 (Date.UTC 로 만든 ms 라 UTC getter 가 KST 값 반환)
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  ];
}

/**
 * 디버그용 — 보정 적용 여부 + 적용 정보 반환
 */
export function inspectKoreanSolarTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number = 0,
): {
  original: [number, number, number, number, number, number];
  corrected: [number, number, number, number, number, number];
  offsetMin: number;
  isDst: boolean;
} {
  const kstAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const realUtcMs = kstAsUtc - 9 * 60 * 60 * 1000;

  let isDst = false;
  for (const dst of KOREAN_DST_RANGES) {
    if (realUtcMs >= dst.startUtc && realUtcMs < dst.endUtc) {
      isDst = true;
      break;
    }
  }

  const offsetMin = isDst ? -90 : -30;
  return {
    original: [year, month, day, hour, minute, second],
    corrected: correctKoreanSolarTime(year, month, day, hour, minute, second),
    offsetMin,
    isDst,
  };
}
