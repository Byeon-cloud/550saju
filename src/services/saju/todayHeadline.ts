/**
 * 홈 '오늘의 운세' 한 줄 — 사주 기반 결정론 (2026-10-03)
 *
 * 배경: 홈 카드가 사주와 무관한 고정 5문장을 날짜로 돌리고 있었다(Phase 2 stub) —
 *   보일러플레이트 박멸 원칙 위반이자 매일 보는 첫 화면이 "아무나 같은 말".
 * 해법: 오늘 일진(日辰) 천간이 이 사람 일간에게 어떤 십성인지 + 일진 지지가 일지와 충(沖)인지로 문장을 고른다.
 *   같은 사람·같은 날이면 항상 같은 문장, 사람·날짜가 바뀌면 근거와 함께 달라진다. AI 호출 0.
 *   (그날 오늘의 운세를 이미 받았다면 홈 훅이 AI 결과 한 줄을 우선 쓴다 — 여기는 그 전의 기본값)
 */
import { Solar } from 'lunar-javascript';
import { CHEONGAN_OHENG, CHEONGAN_EUMYANG, CHEONGAN_KO, JIJI_KO } from '@/constants/oheng';

export type SipsungKo = '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인';

/** 오행 상생(내가 낳는 것) · 상극(내가 이기는 것) */
const GENERATES: Record<string, string> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
const CONTROLS: Record<string, string> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };

/** 일간(dayGan) 기준으로 다른 천간(other)의 십성 */
export function sipsungOf(dayGan: string, other: string): SipsungKo | null {
  const me = CHEONGAN_OHENG[dayGan];
  const ot = CHEONGAN_OHENG[other];
  if (!me || !ot) return null;
  const same = CHEONGAN_EUMYANG[dayGan] === CHEONGAN_EUMYANG[other];
  if (me === ot) return same ? '비견' : '겁재';
  if (GENERATES[me] === ot) return same ? '식신' : '상관';
  if (CONTROLS[me] === ot) return same ? '편재' : '정재';
  if (CONTROLS[ot] === me) return same ? '편관' : '정관';
  if (GENERATES[ot] === me) return same ? '편인' : '정인';
  return null;
}

/** 지지 육충 */
const CHUNG = new Set(['子午', '午子', '丑未', '未丑', '寅申', '申寅', '卯酉', '酉卯', '辰戌', '戌辰', '巳亥', '亥巳']);

/** 'YYYY-MM-DD'(KST) → 그날 일진 한자 간지 (예: '丙午'). 실패 시 '' */
export function dayPillarOf(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    const ec = Solar.fromYmd(y, m, d).getLunar().getEightChar();
    return `${ec.getDayGan()}${ec.getDayZhi()}`;
  } catch {
    return '';
  }
}

const LINES: Record<SipsungKo, (g: string, n: string) => string> = {
  비견: (g, n) => `오늘 ${g}일은 ${n}님과 같은 기운이 겹치는 날이에요. 내 뜻을 밀고 나가기 좋지만, 돈 거래는 한 번 더 확인하세요.`,
  겁재: (g, n) => `오늘 ${g}일은 ${n}님 기운을 나눠 가져가는 날이에요. 지출과 약속이 새기 쉬우니 큰 결제는 내일로 미뤄도 좋아요.`,
  식신: (g, n) => `오늘 ${g}일은 ${n}님 기운이 밖으로 술술 흘러나가는 날이에요. 미뤄둔 글과 기획처럼 손으로 만드는 일을 시작해보세요.`,
  상관: (g) => `오늘 ${g}일은 말과 생각이 날카롭게 서는 날이에요. 아이디어는 적어두되, 윗사람에게 하는 말은 한 박자 늦추세요.`,
  편재: (g, n) => `오늘 ${g}일은 ${n}님이 움직이는 돈의 흐름을 잡는 날이에요. 작은 기회는 잡되 큰 베팅은 피하세요.`,
  정재: (g) => `오늘 ${g}일은 성실하게 쌓는 재물이 들어오는 날이에요. 가계부 정리와 저축처럼 꾸준한 일에 힘을 쓰세요.`,
  편관: (g, n) => `오늘 ${g}일은 바깥 압박이 ${n}님을 누르기 쉬운 날이에요. 일정을 하나 덜어내고 몸부터 챙기세요.`,
  정관: (g) => `오늘 ${g}일은 질서와 책임이 맞물리는 날이에요. 미뤄둔 서류와 연락을 처리하면 깔끔하게 마무리돼요.`,
  편인: (g) => `오늘 ${g}일은 감이 예민해지고 생각이 깊어지는 날이에요. 결정보다 공부와 탐색에 시간을 쓰면 얻는 게 커요.`,
  정인: (g) => `오늘 ${g}일은 도움과 배움이 들어오는 날이에요. 조언을 구하거나 배우는 일에 시간을 써보세요.`,
};

/**
 * @param dayGan 일간(한자) · @param dayJi 일지(한자, 없으면 충 판정 생략)
 * @param todayGanzi 오늘 일진 한자 간지 · @param name 표시 이름
 * @returns 한 줄 문장. 판정 불가면 ''
 */
export function buildTodayHeadline(dayGan: string, dayJi: string | undefined, todayGanzi: string, name: string): string {
  if (!dayGan || todayGanzi.length < 2) return '';
  const tg = todayGanzi[0];
  const tj = todayGanzi[1];
  const sip = sipsungOf(dayGan, tg);
  if (!sip) return '';
  const ko = `${CHEONGAN_KO[tg] ?? ''}${JIJI_KO[tj] ?? ''}`;
  const g = ko ? `${ko}(${todayGanzi})` : todayGanzi;
  const n = name || '오늘의 나';
  let line = LINES[sip](g, n);
  // 일진 지지가 일지와 충이면 변동 주의 한 줄 — 십성 문장과 겹치지 않는 축(이동·변동)만 덧붙인다
  if (dayJi && CHUNG.has(`${dayJi}${tj}`)) {
    line += ' 일지와 부딪히는(충) 날이라 이동과 약속 변경은 여유 있게 잡으세요.';
  }
  return line;
}
