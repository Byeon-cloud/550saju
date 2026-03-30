import { Solar, type EightChar, type Lunar } from 'lunar-javascript';
import type { SajuInput, SajuData, Pillar, OhengDistribution, SipSung, JiJangGan, UnYoung, DaeUn, NaPeum, SinSal, GongMang } from '@/types/saju';
import { CHEONGAN_OHENG, JIJI_OHENG, CHEONGAN_KO, JIJI_KO, CHEONGAN_EUMYANG, JIJI_EUMYANG } from '@/constants/oheng';

/**
 * lunar-javascript를 사용하여 사주 전체 데이터를 계산합니다.
 */
export function calculateSaju(input: SajuInput): SajuData {
  const solar = input.hasBirthTime
    ? Solar.fromYmdHms(input.birthYear, input.birthMonth, input.birthDay, input.birthHour!, input.birthMinute!, 0)
    : Solar.fromYmd(input.birthYear, input.birthMonth, input.birthDay);

  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();

  const pillars = extractPillars(ec, input.hasBirthTime);
  const elements = calculateElements(pillars);
  const sipsung = extractSipsung(ec, input.hasBirthTime);
  const jijanggan = extractJijanggan(ec, input.hasBirthTime);
  const unyoung12 = extractUnyoung12(ec, input.hasBirthTime);
  const daeun = extractDaeun(ec, input.gender === 'male' ? 1 : 0);
  const napeum = extractNapeum(ec, input.hasBirthTime);
  const gilsin = extractSinsal(lunar.getDayJiShen(), 'gilsin');
  const hyungsal = extractSinsal(lunar.getDayXiongSha(), 'hyungsal');
  const gongmang = extractGongmang(lunar);
  const currentDaeun = findCurrentDaeun(daeun, input.birthYear);

  return {
    input,
    pillars,
    elements,
    sipsung,
    jijanggan,
    unyoung12,
    daeun,
    napeum,
    gilsin,
    hyungsal,
    gongmang,
    currentDaeun,
    yearlyUn: getYearlyUn(new Date().getFullYear()),
    띠: lunar.getYearShengXiao(),
  };
}

function extractPillars(ec: EightChar, hasBirthTime: boolean): Pillar[] {
  const positions = ['year', 'month', 'day', 'time'] as const;
  const ganFns = [() => ec.getYearGan(), () => ec.getMonthGan(), () => ec.getDayGan(), () => ec.getTimeGan()];
  const zhiFns = [() => ec.getYearZhi(), () => ec.getMonthZhi(), () => ec.getDayZhi(), () => ec.getTimeZhi()];

  return positions.map((pos, i) => {
    const available = pos !== 'time' || hasBirthTime;
    const gan = available ? ganFns[i]() : '';
    const zhi = available ? zhiFns[i]() : '';

    return {
      position: pos,
      천간: gan,
      지지: zhi,
      천간읽기: gan ? (CHEONGAN_KO[gan] ?? gan) : '',
      지지읽기: zhi ? (JIJI_KO[zhi] ?? zhi) : '',
      천간오행: gan ? CHEONGAN_OHENG[gan] : '토',
      지지오행: zhi ? JIJI_OHENG[zhi] : '토',
      천간음양: gan ? CHEONGAN_EUMYANG[gan] : '양',
      지지음양: zhi ? JIJI_EUMYANG[zhi] : '양',
      available,
    } as Pillar;
  });
}

function calculateElements(pillars: Pillar[]): OhengDistribution {
  const dist: OhengDistribution = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const p of pillars) {
    if (!p.available) continue;
    if (p.천간오행) dist[p.천간오행]++;
    if (p.지지오행) dist[p.지지오행]++;
  }
  return dist;
}

function extractSipsung(ec: EightChar, hasBirthTime: boolean): SipSung[] {
  const result: SipSung[] = [
    { position: '년간', 글자: ec.getYearGan(), 십성: ec.getYearShiShenGan(), 십성한자: '', 의미: '' },
    { position: '월간', 글자: ec.getMonthGan(), 십성: ec.getMonthShiShenGan(), 십성한자: '', 의미: '' },
    { position: '일간', 글자: ec.getDayGan(), 십성: '일주', 십성한자: '日主', 의미: '나 자신' },
    { position: '년지', 글자: ec.getYearZhi(), 십성: ec.getYearShiShenZhi().join('/'), 십성한자: '', 의미: '' },
    { position: '월지', 글자: ec.getMonthZhi(), 십성: ec.getMonthShiShenZhi().join('/'), 십성한자: '', 의미: '' },
    { position: '일지', 글자: ec.getDayZhi(), 십성: ec.getDayShiShenZhi().join('/'), 십성한자: '', 의미: '' },
  ];
  if (hasBirthTime) {
    result.push(
      { position: '시간', 글자: ec.getTimeGan(), 십성: ec.getTimeShiShenGan(), 십성한자: '', 의미: '' },
      { position: '시지', 글자: ec.getTimeZhi(), 십성: ec.getTimeShiShenZhi().join('/'), 십성한자: '', 의미: '' },
    );
  }
  return result;
}

function extractJijanggan(ec: EightChar, hasBirthTime: boolean): JiJangGan[] {
  const result: JiJangGan[] = [
    { 지지: ec.getYearZhi(), 지장간: ec.getYearHideGan(), 십성: [] },
    { 지지: ec.getMonthZhi(), 지장간: ec.getMonthHideGan(), 십성: [] },
    { 지지: ec.getDayZhi(), 지장간: ec.getDayHideGan(), 십성: [] },
  ];
  if (hasBirthTime) {
    result.push({ 지지: ec.getTimeZhi(), 지장간: ec.getTimeHideGan(), 십성: [] });
  }
  return result;
}

function extractUnyoung12(ec: EightChar, hasBirthTime: boolean): UnYoung[] {
  const result: UnYoung[] = [
    { position: '년지', 운성: ec.getYearDiShi(), 운성한자: '', 의미: '' },
    { position: '월지', 운성: ec.getMonthDiShi(), 운성한자: '', 의미: '' },
    { position: '일지', 운성: ec.getDayDiShi(), 운성한자: '', 의미: '' },
  ];
  if (hasBirthTime) {
    result.push({ position: '시지', 운성: ec.getTimeDiShi(), 운성한자: '', 의미: '' });
  }
  return result;
}

function extractDaeun(ec: EightChar, genderFlag: number): DaeUn[] {
  const yun = ec.getYun(genderFlag);
  const daYuns = yun.getDaYun();

  return daYuns.map((d, i) => ({
    순번: i + 1,
    시작나이: d.getStartAge(),
    끝나이: d.getEndAge(),
    천간: d.getGanZhi().charAt(0),
    지지: d.getGanZhi().charAt(1),
    간지: d.getGanZhi(),
    isCurrent: false,
  }));
}

function findCurrentDaeun(daeunList: DaeUn[], birthYear: number): DaeUn | undefined {
  const currentAge = new Date().getFullYear() - birthYear;
  const found = daeunList.find(d => currentAge >= d.시작나이 && currentAge <= d.끝나이);
  if (found) found.isCurrent = true;
  return found;
}

function extractNapeum(ec: EightChar, hasBirthTime: boolean): NaPeum[] {
  const result: NaPeum[] = [
    { position: '년주', 납음: ec.getYearNaYin(), 납음한자: '', 의미: '' },
    { position: '월주', 납음: ec.getMonthNaYin(), 납음한자: '', 의미: '' },
    { position: '일주', 납음: ec.getDayNaYin(), 납음한자: '', 의미: '' },
  ];
  if (hasBirthTime) {
    result.push({ position: '시주', 납음: ec.getTimeNaYin(), 납음한자: '', 의미: '' });
  }
  return result;
}

function extractSinsal(list: string[], type: 'gilsin' | 'hyungsal'): SinSal[] {
  return list.map(name => ({
    이름: name,
    이름한자: name,
    의미: '',
    type,
  }));
}

function extractGongmang(lunar: Lunar): GongMang[] {
  return [
    { 기준: '년주', 순: '', 공망: lunar.getYearXunKong(), 의미: '' },
    { 기준: '일주', 순: '', 공망: lunar.getDayXunKong(), 의미: '' },
  ];
}

function getYearlyUn(year: number): { 천간: string; 지지: string; 간지: string } {
  const solar = Solar.fromYmd(year, 6, 1);
  const lunar = solar.getLunar();
  const yearGan = lunar.getYearGan();
  const yearZhi = lunar.getYearZhi();
  return { 천간: yearGan, 지지: yearZhi, 간지: `${yearGan}${yearZhi}` };
}
