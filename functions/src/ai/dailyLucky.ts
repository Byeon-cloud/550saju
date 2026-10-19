/**
 * 오늘의 운세 행운 (2026-10-19) — AI 대신 코드로 채운다.
 *
 *   왜: 행운의 색, 방위, 숫자, 음식, 글자는 규칙상 '원국 용신 오행 하나'로만 정해진다(LUCKY_SSOT_BLOCK). 다섯 벌뿐인 답을
 *   AI 가 매번 다시 쓰면서 같은 용신인데 색 이름과 색값이 달라지고(초록 #4CAF50, 검정·남색 #1B2A4A 등), 가운뎃점이 섞였고,
 *   화면에 안 나오는 이유 문장(항목마다 60자 이상)까지 생성하고 있었다. 오너(10-19): 같은 일주나 같은 용신이면 똑같은 것이 사실이니
 *   지어내지 말고 고정한다.
 *   - 색, 방위, 숫자: 용신마다 하나로 고정 (색은 v9 전통 안료 톤)
 *   - 음식, 글자: 같은 오행 안에서 날짜마다 돌린다 (매일 똑같은 음식이 나오지 않게, 다른 오행으로는 절대 안 바뀜)
 *   - 시간: 서버 시간 확정표의 가장 좋은 때(todayHourWindows.peak)
 *   이유(reason)는 화면에 쓰이지 않아 짧은 고정 문장만 둔다.
 */

type O = '목' | '화' | '토' | '금' | '수';

const TABLE: Record<O, { color: { name: string; hex: string }; direction: string; number: string; foods: string[]; glyphs: string[]; taste: string }> = {
  목: { color: { name: '초록', hex: '#4E7A57' }, direction: '동', number: '3, 8', taste: '신맛', foods: ['나물 비빔밥', '유자차', '매실차', '시금치 무침', '쑥떡', '푸른 채소 샐러드', '오이 무침'], glyphs: ['甲', '乙', '寅', '卯'] },
  화: { color: { name: '빨강과 주황', hex: '#B04A38' }, direction: '남', number: '2, 7', taste: '쓴맛', foods: ['녹차', '도라지 무침', '쑥국', '아메리카노', '쌈 채소', '홍삼차', '구운 고기'], glyphs: ['丙', '丁', '巳', '午'] },
  토: { color: { name: '노랑과 황토', hex: '#B07F38' }, direction: '중앙', number: '5, 10', taste: '단맛', foods: ['단호박죽', '고구마', '대추차', '꿀차', '옥수수', '호박전', '찹쌀떡'], glyphs: ['戊', '己', '辰', '戌', '丑', '未'] },
  금: { color: { name: '흰색과 은색', hex: '#A9A49C' }, direction: '서', number: '4, 9', taste: '매운맛', foods: ['생강차', '무생채', '배숙', '콩나물국', '마늘 요리', '양파 볶음', '도라지차'], glyphs: ['庚', '辛', '申', '酉'] },
  수: { color: { name: '검정과 남색', hex: '#3E5F82' }, direction: '북', number: '1, 6', taste: '짠맛', foods: ['미역국', '검은콩', '구운 김', '된장국', '두부 조림', '해산물 요리', '블루베리'], glyphs: ['壬', '癸', '亥', '子'] },
};

const toO = (v: unknown): O | null => {
  const s = String(v || '');
  if (/목|木/.test(s)) return '목';
  if (/화|火/.test(s)) return '화';
  if (/토|土/.test(s)) return '토';
  if (/금|金/.test(s)) return '금';
  if (/수|水/.test(s)) return '수';
  return null;
};

/** 날짜 문자열로 고르는 순번 (같은 날 같은 용신이면 늘 같은 값) */
function dayIndex(date: string, n: number, salt = 0): number {
  let h = salt;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) % 100003;
  return n ? h % n : 0;
}

export function dailyLuckyProfile(sajuData: any, date: string, peakRange: string): Record<string, any> | null {
  const o = toO(sajuData?.myeongriAnalysis?.용신);
  if (!o) return null;
  const t = TABLE[o];
  const g1 = t.glyphs[dayIndex(date, t.glyphs.length, 7)];
  const g2 = t.glyphs[(t.glyphs.indexOf(g1) + 1) % t.glyphs.length];
  const [ga, gb] = t.glyphs.indexOf(g1) < t.glyphs.indexOf(g2) ? [g1, g2] : [g2, g1]; // 표 순서대로(甲 卯, 卯 甲 아님)
  const why = `이 사주에 필요한 ${o}(${({ 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' } as const)[o]}) 기운`;
  return {
    color: { name: t.color.name, hex: t.color.hex, reason: `${why}의 색이에요.` },
    direction: { value: t.direction, reason: `${why}의 방위예요.` },
    ...(peakRange ? { time: { range: peakRange, reason: '오늘 시간표에서 가장 좋은 때예요.' } } : {}),
    number: { value: t.number, reason: `${why}의 숫자예요.` },
    food: { name: t.foods[dayIndex(date, t.foods.length, 3)], reason: `${why}을 돋우는 ${t.taste} 음식이에요.` },
    glyph: { value: `${ga} ${gb}`, reason: `${why}을 나타내는 글자예요.` },
  };
}
