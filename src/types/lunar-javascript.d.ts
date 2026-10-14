declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    static fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): Solar;
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    toYmd(): string;
  }

  /** 음력 달 — 윤달은 음수 month (2026-10-15 음력 입력 양력 변환) */
  export class LunarMonth {
    static fromYm(year: number, month: number): LunarMonth | null;
    getDayCount(): number;
  }

  export class LunarYear {
    static fromYear(year: number): LunarYear;
    /** 그해 윤달 (없으면 0) */
    getLeapMonth(): number;
  }

  export class Lunar {
    /** 음력 날짜 → Lunar (윤달은 음수 month). 그 달에 없는 날이면 throw */
    static fromYmd(year: number, month: number, day: number): Lunar;
    getSolar(): Solar;
    getEightChar(): EightChar;
    getYearGan(): string;
    getYearZhi(): string;
    getYearShengXiao(): string;
    /** 입춘 기준 띠 — 연주 지지와 일치 (2026-10-13 calculator v3) */
    getYearShengXiaoExact(): string;
    getDayJiShen(): string[];
    getDayXiongSha(): string[];
    getYearXunKong(): string;
    getDayXunKong(): string;
    /** 일진 간지 (예: "甲子") — 날짜 기반, 시간 보정 불필요 (2026-06-29 주간운세) */
    getDayInGanZhi(): string;
    /** 월간지 (예: "甲午") — 절입 날짜 기준(시각 무시). 절기 시각까지 맞추려면 getMonthInGanZhiExact */
    getMonthInGanZhi(): string;
    /** 연 간지 — ⚠️ 설날(음력 1월 1일) 기준. 사주의 세운은 입춘 기준이므로 getYearInGanZhiExact 를 쓴다 */
    getYearInGanZhi(): string;
    /** 절기(입춘·절입 시각) 기준 정확한 간지 — 2026-10-10 hookFacts 사용 */
    getYearInGanZhiExact(): string;
    getMonthInGanZhiExact(): string;
    getTimeInGanZhi(): string;
  }

  export class EightChar {
    getYearGan(): string;
    getYearZhi(): string;
    getMonthGan(): string;
    getMonthZhi(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getTimeGan(): string;
    getTimeZhi(): string;

    getYearShiShenGan(): string;
    getMonthShiShenGan(): string;
    getTimeShiShenGan(): string;
    getYearShiShenZhi(): string[];
    getMonthShiShenZhi(): string[];
    getDayShiShenZhi(): string[];
    getTimeShiShenZhi(): string[];

    getYearHideGan(): string[];
    getMonthHideGan(): string[];
    getDayHideGan(): string[];
    getTimeHideGan(): string[];

    getYearDiShi(): string;
    getMonthDiShi(): string;
    getDayDiShi(): string;
    getTimeDiShi(): string;

    getYearNaYin(): string;
    getMonthNaYin(): string;
    getDayNaYin(): string;
    getTimeNaYin(): string;

    getYun(gender: number): Yun;
  }

  export class Yun {
    getDaYun(): DaYunItem[];
  }

  export interface DaYunItem {
    /** 시작나이 — 세는나이(虚岁) 기준. 연나이로 비교 금지 (2026-07 현재 대운 off-by-one fix) */
    getStartAge(): number;
    getEndAge(): number;
    /** 대운 시작·끝 실제 연도 — 현재 대운 판정은 이걸로 (나이 규약 무관) */
    getStartYear(): number;
    getEndYear(): number;
    getGanZhi(): string;
  }
}
