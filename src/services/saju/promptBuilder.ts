import type { SajuData, Situation } from '@/types/saju';
import { SYSTEM_PROMPT } from '@/constants/prompts';
import { CHEONGAN_KO, JIJI_KO, OHENG_MAP } from '@/constants/oheng';

export interface PromptPayload {
  systemPrompt: string;
  userPrompt: string;
}

export function buildPrompt(sajuData: SajuData, situation?: Situation): PromptPayload {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(sajuData, situation),
  };
}

function buildUserPrompt(data: SajuData, situation?: Situation): string {
  const input = data.input;
  const lines: string[] = [];

  lines.push('## 기본 정보');
  lines.push(`- 생년월일: ${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일 (양력)`);
  lines.push(`- 성별: ${input.gender === 'male' ? '남' : '여'}`);
  lines.push(`- 출생시간: ${input.hasBirthTime ? `${input.birthHour}시 ${input.birthMinute}분` : '모름 (시주 제외하고 분석)'}`);
  if (data.띠) lines.push(`- 띠: ${data.띠}`);

  lines.push('');
  lines.push(`## 사주 원국 ${!input.hasBirthTime ? '(시주 제외)' : ''}`);
  lines.push('');
  lines.push(formatPillarsTable(data));

  lines.push('');
  lines.push('## 납음');
  for (const n of data.napeum) {
    lines.push(`- ${n.position}: ${n.납음}`);
  }

  lines.push('');
  lines.push('## 십성 배치');
  for (const s of data.sipsung) {
    lines.push(`- ${s.position}: ${s.글자} → ${s.십성}`);
  }

  lines.push('');
  lines.push('## 지장간');
  for (const j of data.jijanggan) {
    lines.push(`- ${j.지지}: ${j.지장간.join(', ')}`);
  }

  lines.push('');
  lines.push('## 12운성');
  for (const u of data.unyoung12) {
    lines.push(`- ${u.position}: ${u.운성}`);
  }

  lines.push('');
  lines.push('## 오행 분포');
  for (const [key, val] of Object.entries(data.elements)) {
    const info = OHENG_MAP[key as keyof typeof OHENG_MAP];
    lines.push(`- ${key}(${info.hanja}): ${val}`);
  }

  if (data.currentDaeun) {
    lines.push('');
    lines.push('## 현재 대운');
    lines.push(`- ${data.currentDaeun.간지} (${data.currentDaeun.시작나이}~${data.currentDaeun.끝나이}세)`);
  }

  if (data.yearlyUn) {
    lines.push('');
    lines.push(`## ${new Date().getFullYear()}년 세운`);
    lines.push(`- ${data.yearlyUn.간지}`);
  }

  lines.push('');
  lines.push('## 신살');
  if (data.gilsin.length > 0) {
    lines.push('### 길신');
    for (const g of data.gilsin) lines.push(`- ${g.이름}`);
  }
  if (data.hyungsal.length > 0) {
    lines.push('### 흉살');
    for (const h of data.hyungsal) lines.push(`- ${h.이름}`);
  }

  lines.push('');
  lines.push('## 공망');
  for (const g of data.gongmang) {
    lines.push(`- ${g.기준} 공망: ${g.공망}`);
  }

  if (situation) {
    lines.push('');
    lines.push('## 사용자 상황');
    if (situation.loveStatus) lines.push(`- 연애 상태: ${situation.loveStatus}`);
    if (situation.jobStatus) lines.push(`- 직업 상태: ${situation.jobStatus}`);
    if (situation.concern) lines.push(`- 고민: ${situation.concern}`);
  }

  lines.push('');
  lines.push('위 데이터를 바탕으로 10개 섹션의 사주 풀이를 작성해주세요.');
  if (!input.hasBirthTime) {
    lines.push('시주를 모르므로 시주 관련 해석은 하지 마세요.');
  }

  return lines.join('\n');
}

function formatPillarsTable(data: SajuData): string {
  const available = data.pillars.filter(p => p.available);
  const header = '|        | ' + available.map(p => {
    const posName = { year: '년주', month: '월주', day: '일주', time: '시주' }[p.position];
    return posName;
  }).join(' | ') + ' |';

  const divider = '|--------|' + available.map(() => '---------|').join('');

  const ganRow = '| 천간   | ' + available.map(p =>
    `${p.천간}(${CHEONGAN_KO[p.천간] ?? p.천간}${OHENG_MAP[p.천간오행]?.hanja ?? ''})`
  ).join(' | ') + ' |';

  const zhiRow = '| 지지   | ' + available.map(p =>
    `${p.지지}(${JIJI_KO[p.지지] ?? p.지지}${OHENG_MAP[p.지지오행]?.hanja ?? ''})`
  ).join(' | ') + ' |';

  return [header, divider, ganRow, zhiRow].join('\n');
}
