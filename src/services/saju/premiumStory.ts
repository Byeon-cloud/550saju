/**
 * 종합사주 결제 앞 화면의 '이 사람 이야기' 두 줄 (2026-10-22 P1-2, 점검 문서 4-2의 4번, 3-1의 22번)
 *
 *   원칙 — hookFacts 와 같다. 만세력 계산으로 정해지는 사실만 말하고 AI 는 부르지 않는다(원가 0).
 *     첫 줄: 원국 사실 (빠진 오행 > 원국 안의 충 > 가장 많은 오행 > 다섯 기운이 다 있음 > 시간 모름의 여섯 글자 > 태어난 일주)
 *     둘째 줄: 대운 사실 (빠진 오행이 지금이나 다음 대운에 들어옴 > 지금 대운과 다음 10년이 열리는 해)
 *     잠긴 줄(인생에서 가장 좋은 10년)은 화면이 <Redact/> 로 그린다. 결과 화면 대운 장의 가장 높은 10년과 같은 자리다.
 *   일주 고정 문구(iljuMeaning.ts)는 쓰지 않는다. 태어난 달과 어긋나는 말(5월생에게 '겨울')이 나와서다(점검 3-1의 22번).
 *   같은 사주, 같은 해 = 늘 같은 문장.
 */
import { persona, josa, ganziKo } from './hookFacts';
import { CHEONGAN_OHENG, JIJI_OHENG, JIJI_KO } from '@/constants/oheng';
import type { SajuData, OhengType } from '@/types/saju';

const ORDER: OhengType[] = ['목', '화', '토', '금', '수'];
const OH_WORD: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
const OH_HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
const COUNT_WORD = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟'];
const POS_WORD: Record<string, string> = { 년지: '해', 월지: '달', 일지: '날', 시지: '시' };

export interface PremiumStory {
  /** 원국 사실 한 줄 */
  first: string;
  /** 대운 사실 한 줄 (없을 수 있음) */
  second: string | null;
  /** 둘째 줄 종류 — bring: 빠진 오행이 대운으로 들어옴, daeun: 지금 대운과 다음 10년이 열리는 해(홈은 대운 띠에 같은 말이 있어 뺀다) */
  secondKind: 'bring' | 'daeun' | null;
  /** 일주 간지 (目次 판심 제목용) */
  dayGz: string;
}

/** 대운 간지에 이 오행이 들어 있나 (천간이나 지지) */
function gzHas(gz: string, oh: OhengType): boolean {
  return CHEONGAN_OHENG[gz[0]] === oh || JIJI_OHENG[gz[1]] === oh;
}

/**
 * @param s   사주 (현행 계산 기준으로 다시 계산한 것을 넘긴다)
 * @param who 부를 이름 + ' 님' (예: '서윤 님'). 부를 이름이 없으면 '' → '내 여덟 글자', 주어 생략
 * @param thisYear 올해 (KST)
 */
export function premiumStory(s: SajuData, who: string, thisYear: number): PremiumStory | null {
  try {
    const p = persona(s);
    if (!p) return null;
    const hasTime = s.pillars?.[3]?.available !== false && !!s.input?.hasBirthTime;
    const chars = hasTime ? '여덟 글자' : '여섯 글자';
    const mine = who ? `${who} ${chars}` : `내 ${chars}`;
    const subj = who ? `${who}은 ` : '';
    const el = s.elements || ({} as Record<OhengType, number>);

    // 지금 대운부터 뒤로 (지금 대운이 없으면 첫 대운부터)
    const from = p.currentIdx >= 0 ? p.currentIdx : 0;
    const ahead = p.daeun.slice(from).filter((d) => !d.year || d.year + 9 >= thisYear);

    let first = '';
    let second: string | null = null;
    let secondKind: 'bring' | 'daeun' | null = null;

    // 1) 빠진 오행 — 시간을 모르면 시주에 있을 수 있어 말하지 않는다
    if (hasTime) {
      const missing = ORDER.filter((o) => (el[o] ?? 0) === 0);
      if (missing.length) {
        // 들어오는 대운은 지금이나 다음 대운까지만 말한다 (20년 뒤 이야기는 지금 대운 줄이 더 쓸모 있다)
        const near = ahead.slice(0, p.currentIdx >= 0 ? 2 : 1);
        const bring = missing
          .map((o) => ({ o, d: near.find((d) => gzHas(d.gz, o)) }))
          .filter((x) => !!x.d);
        const yong = s.myeongriAnalysis?.용신;
        const pick = bring[0]?.o ?? (yong && missing.includes(yong) ? yong : missing[0]);
        const w = OH_WORD[pick];
        first = `${mine}에는 ${w}(${OH_HAN[pick]})${josa(w, '이', '가')} 하나도 없어요.`;
        const d = bring.find((x) => x.o === pick)?.d;
        if (d) {
          if (p.currentIdx >= 0 && d === p.daeun[p.currentIdx]) second = `지금 지나는 ${d.gz}(${ganziKo(d.gz)}) 대운에 그 ${w}${josa(w, '이', '가')} 들어와 있어요.`;
          else if (d.year) second = `${d.year}년부터 그 ${w}${josa(w, '이', '가')} 들어오는 10년이 열려요.`;
          if (second) secondKind = 'bring';
        }
      }
    }

    // 2) 원국 안의 충 — 태어난 날이 걸린 것 먼저
    if (!first) {
      const rel = (s.myeongriAnalysis?.형충합 || []).filter((r) => r?.type === '충' && r.target === '지지' && r.positions?.length === 2);
      const c = rel.find((r) => r.positions.includes('일지')) || rel.find((r) => r.positions.includes('월지')) || rel[0];
      const a = c ? POS_WORD[c.positions[0]] : '';
      const b = c ? POS_WORD[c.positions[1]] : '';
      if (c && a && b) {
        // 10-24 검수 — 충 두 글자는 관례 순서(子丑寅卯辰巳午未申酉戌亥)로: 묘유충, 축미충 (서버 jiPair 와 같게)
        const ORD = '子丑寅卯辰巳午未申酉戌亥';
        const [x, y] = [c.chars[0], c.chars[1]].sort((p, q) => ORD.indexOf(p) - ORD.indexOf(q));
        const ko = `${JIJI_KO[x] || ''}${JIJI_KO[y] || ''}`;
        first = `${subj}태어난 ${a}${josa(a, '과', '와')} ${b}의 글자가 ${x}${y}(${ko})${josa(ko, '으로', '로')} 부딪혀 있어요.`;
      }
    }

    // 3) 가장 많은 오행 (셋 이상이고 혼자 가장 많을 때만)
    if (!first) {
      const sorted = ORDER.map((o) => ({ o, n: el[o] ?? 0 })).sort((x, y) => y.n - x.n);
      if (sorted[0].n >= 3 && sorted[0].n > sorted[1].n) {
        const w = OH_WORD[sorted[0].o];
        first = `${mine} 가운데 ${w}(${OH_HAN[sorted[0].o]})${josa(w, '이', '가')} ${COUNT_WORD[sorted[0].n]} 개로 가장 많아요.`;
      }
    }

    // 4) 다섯 기운이 다 있을 때
    const missingAll = ORDER.filter((o) => (el[o] ?? 0) === 0);
    if (!first && missingAll.length === 0) first = `${mine}에는 나무, 불, 흙, 쇠, 물 다섯 기운이 모두 들어 있어요.`;
    // 5) 시간을 몰라 여섯 글자만 볼 때 빠진 오행 (여섯 글자에 대한 사실로만 말한다)
    if (!first && !hasTime && missingAll.length) {
      const w = OH_WORD[missingAll[0]];
      first = `${who ? `${who} ` : ''}태어난 시간을 뺀 여섯 글자에는 ${w}(${OH_HAN[missingAll[0]]})${josa(w, '이', '가')} 없어요.`;
    }
    // 6) 남은 경우 — 태어난 일주
    if (!first) first = `${subj}${p.dayGz}일에 태어났어요.`;

    // 둘째 줄 기본 — 지금 대운과 다음 10년이 열리는 해
    if (!second) {
      const cur = p.currentIdx >= 0 ? p.daeun[p.currentIdx] : undefined;
      if (cur && p.nextYear) second = `지금은 ${cur.gz}(${ganziKo(cur.gz)}) 대운이고, ${p.nextYear}년에 다음 10년이 열려요.`;
      else if (cur) second = `지금은 ${cur.gz}(${ganziKo(cur.gz)}) 대운을 지나고 있어요.`;
      else if (p.daeun[0]?.year && p.daeun[0].year > thisYear) second = `첫 대운은 ${p.daeun[0].year}년에 시작돼요.`;
      if (second) secondKind = 'daeun';
    }

    return { first, second, secondKind, dayGz: p.dayGz };
  } catch {
    return null;
  }
}
