declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    static fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): Solar;
    getLunar(): Lunar;
  }

  export class Lunar {
    getEightChar(): EightChar;
    getYearGan(): string;
    getYearZhi(): string;
    getYearShengXiao(): string;
    getDayJiShen(): string[];
    getDayXiongSha(): string[];
    getYearXunKong(): string;
    getDayXunKong(): string;
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
    getStartAge(): number;
    getEndAge(): number;
    getGanZhi(): string;
  }
}
