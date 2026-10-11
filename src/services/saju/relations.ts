/**
 * #saju-card-share · Stage 1 — 사주 8글자 관계(合·沖·刑·破·害·怨嗔·空亡) 종합 계산기
 *
 * 만세력 카드용 — 4기둥 8글자 사이의 관계 (만세력 표준 표기 항목 보강).
 *
 * ⚠️ 보존 원칙:
 *   - 기존 calculator.ts 의 detectHyungChungHap() 결과는 그대로 (PremiumResult 등에서 사용)
 *   - 본 모듈은 카드용 추가 분석 — 삼합·반합·방합·파·해·원진·천간충까지 확장 (calculator.ts는 천간합/지지육합/지지충/지지형만)
 *   - 공망(空亡)은 lunar-javascript 가 이미 계산 — `gongmang` 배열 그대로 받아 카드 표시용 정제
 *
 * 출력은 `Relation` 객체 배열 — 카드의 "관계 표" 영역에 그대로 렌더 가능.
 */

import type { Pillar, GongMang } from '@/types/saju';

/* ══════════════════════════════════════════════════════════════════
 * 1. 천간 — 합 / 충
 * ═════════════════════════════════════════════════════════════════ */

/** 천간 오합(五合) — 5쌍, 결과 오행 */
const CHEONGAN_HAP: Array<[string, string, string]> = [
  ['甲', '己', '土'],
  ['乙', '庚', '金'],
  ['丙', '辛', '水'],
  ['丁', '壬', '木'],
  ['戊', '癸', '火'],
];

/** 천간 충(沖) — 4쌍 (방위 충돌) */
const CHEONGAN_CHUNG: Array<[string, string]> = [
  ['甲', '庚'],
  ['乙', '辛'],
  ['丙', '壬'],
  ['丁', '癸'],
];

/* ══════════════════════════════════════════════════════════════════
 * 2. 지지 — 육합·삼합·반합·방합 / 충·형·파·해·원진
 * ═════════════════════════════════════════════════════════════════ */

/** 지지 육합(六合) — 6쌍, 결과 오행 */
const JIJI_YUKHAP: Array<[string, string, string]> = [
  ['子', '丑', '土'],
  ['寅', '亥', '木'],
  ['卯', '戌', '火'],
  ['辰', '酉', '金'],
  ['巳', '申', '水'],
  ['午', '未', '火'], // 일부 학파 '土'
];

/** 지지 삼합(三合) — 4그룹 (생·왕·묘 3字 모두) */
const JIJI_SAMHAP: Array<{ chars: [string, string, string]; oheng: string; name: string }> = [
  { chars: ['申', '子', '辰'], oheng: '水', name: '신자진 수국(水局)' },
  { chars: ['巳', '酉', '丑'], oheng: '金', name: '사유축 금국(金局)' },
  { chars: ['寅', '午', '戌'], oheng: '火', name: '인오술 화국(火局)' },
  { chars: ['亥', '卯', '未'], oheng: '木', name: '해묘미 목국(木局)' },
];

/** 지지 방합(方合) — 4방위 그룹 (계절합) */
const JIJI_BANGHAP: Array<{ chars: [string, string, string]; oheng: string; name: string }> = [
  { chars: ['寅', '卯', '辰'], oheng: '木', name: '인묘진 동방 목(東方木)' },
  { chars: ['巳', '午', '未'], oheng: '火', name: '사오미 남방 화(南方火)' },
  { chars: ['申', '酉', '戌'], oheng: '金', name: '신유술 서방 금(西方金)' },
  { chars: ['亥', '子', '丑'], oheng: '水', name: '해자축 북방 수(北方水)' },
];

/** 지지 충(六沖) — 6쌍 */
const JIJI_CHUNG: Array<[string, string]> = [
  ['子', '午'], ['丑', '未'], ['寅', '申'],
  ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
];

/** 지지 형(刑) — 삼형살 + 자형 */
const JIJI_HYUNG: Array<[string, string, string]> = [
  ['寅', '巳', '무은지형'], ['巳', '申', '무은지형'], ['寅', '申', '무은지형'],
  ['丑', '未', '무례지형'], ['未', '戌', '무례지형'], ['丑', '戌', '무례지형'],
  ['子', '卯', '상형'],
  ['辰', '辰', '자형'], ['午', '午', '자형'], ['酉', '酉', '자형'], ['亥', '亥', '자형'],
];

/** 지지 파(破) — 6쌍 (균열·불협화음) */
const JIJI_PA: Array<[string, string]> = [
  ['子', '酉'], ['卯', '午'], ['辰', '丑'],
  ['戌', '未'], ['寅', '亥'], ['巳', '申'],
];

/** 지지 해(害)·육해(六害) — 6쌍 (시기·원망) */
const JIJI_HAE: Array<[string, string]> = [
  ['子', '未'], ['丑', '午'], ['寅', '巳'],
  ['卯', '辰'], ['申', '亥'], ['酉', '戌'],
];

/** 지지 원진(怨嗔) — 6쌍 (속앓이·미움) */
const JIJI_WONJIN: Array<[string, string]> = [
  ['子', '未'], ['丑', '午'], ['寅', '酉'],
  ['卯', '申'], ['辰', '亥'], ['巳', '戌'],
];

/* ══════════════════════════════════════════════════════════════════
 * 출력 타입
 * ═════════════════════════════════════════════════════════════════ */

export type RelationType =
  | '천간합' | '천간충'
  | '육합' | '삼합' | '반합' | '방합'
  | '지지충' | '형' | '파' | '해' | '원진'
  | '공망';

export interface Relation {
  /** 관계 종류 */
  type: RelationType;
  /** 한자 표기 */
  hanja: string;
  /** 관여한 글자 — 한자 */
  chars: string[];
  /** 관여한 위치 — '년주' | '월주' | '일주' | '시주' (또는 '년/일주' 등) */
  positions: string[];
  /** 결합 결과 오행 (합 계열만) */
  resultOheng?: string;
  /** 짧은 설명 */
  desc: string;
  /** 길흉 분류 — '길' | '흉' | '중성' */
  goodBad: '길' | '흉' | '중성';
}

/* ══════════════════════════════════════════════════════════════════
 * 헬퍼
 * ═════════════════════════════════════════════════════════════════ */

const PILLAR_LABELS = ['년주', '월주', '일주', '시주'] as const;

interface IndexedChar {
  char: string;
  pillarIdx: number;     // 0-3
  pillarLabel: string;   // '년주' 등
  channel: '간' | '지';  // 천간 or 지지
}

/** 4기둥 → 천간/지지 인덱스 배열 (available 필터) */
function indexChars(pillars: Pillar[]): { gan: IndexedChar[]; zhi: IndexedChar[] } {
  const gan: IndexedChar[] = [];
  const zhi: IndexedChar[] = [];
  pillars.forEach((p, i) => {
    if (!p.available) return;
    if (p.천간) {
      gan.push({ char: p.천간, pillarIdx: i, pillarLabel: PILLAR_LABELS[i], channel: '간' });
    }
    if (p.지지) {
      zhi.push({ char: p.지지, pillarIdx: i, pillarLabel: PILLAR_LABELS[i], channel: '지' });
    }
  });
  return { gan, zhi };
}

/** 두 글자 쌍 매칭 — 순서 무관 */
function pairMatches(a: string, b: string, pair: [string, string]): boolean {
  return (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0]);
}

/* ══════════════════════════════════════════════════════════════════
 * 메인 계산기
 * ═════════════════════════════════════════════════════════════════ */

/** 천간 관계 — 합·충 */
function detectCheonganRelations(gan: IndexedChar[]): Relation[] {
  const out: Relation[] = [];

  for (let i = 0; i < gan.length; i++) {
    for (let j = i + 1; j < gan.length; j++) {
      const a = gan[i];
      const b = gan[j];

      // 천간 합
      for (const [g1, g2, oheng] of CHEONGAN_HAP) {
        if (pairMatches(a.char, b.char, [g1, g2])) {
          out.push({
            type: '천간합',
            hanja: '天干合',
            chars: [a.char, b.char],
            positions: [`${a.pillarLabel}간`, `${b.pillarLabel}간`],
            resultOheng: oheng,
            desc: `${a.char}${b.char}합 → ${oheng}`,
            goodBad: '길',
          });
        }
      }

      // 천간 충
      for (const pair of CHEONGAN_CHUNG) {
        if (pairMatches(a.char, b.char, pair)) {
          out.push({
            type: '천간충',
            hanja: '天干沖',
            chars: [a.char, b.char],
            positions: [`${a.pillarLabel}간`, `${b.pillarLabel}간`],
            desc: `${a.char}${b.char}충: 방위 충돌`,
            goodBad: '흉',
          });
        }
      }
    }
  }
  return out;
}

/** 지지 관계 — 육합·삼합·반합·방합·충·형·파·해·원진 */
function detectJijiRelations(zhi: IndexedChar[]): Relation[] {
  const out: Relation[] = [];
  const charSet = new Set(zhi.map((z) => z.char));
  const findChars = (targets: string[]): IndexedChar[] =>
    zhi.filter((z) => targets.includes(z.char));

  // 삼합 (3字 모두) / 반합 (2字)
  for (const sh of JIJI_SAMHAP) {
    const present = sh.chars.filter((c) => charSet.has(c));
    if (present.length === 3) {
      const matched = findChars(sh.chars);
      out.push({
        type: '삼합',
        hanja: '三合',
        chars: present,
        positions: matched.map((m) => `${m.pillarLabel}지`),
        resultOheng: sh.oheng,
        desc: `${sh.name}`,
        goodBad: '길',
      });
    } else if (present.length === 2) {
      // 반합 — 왕지(子午卯酉) 포함 여부에 따라 강도가 다르지만, 일단 검출만
      const wangji = sh.chars[1]; // 가운데 자리 = 왕지
      if (present.includes(wangji)) {
        const matched = findChars(present);
        out.push({
          type: '반합',
          hanja: '半合',
          chars: present,
          positions: matched.map((m) => `${m.pillarLabel}지`),
          resultOheng: sh.oheng,
          desc: `${present.join('')} 반합 → ${sh.oheng}`,
          goodBad: '길',
        });
      }
    }
  }

  // 방합 (3字 모두)
  for (const bh of JIJI_BANGHAP) {
    const present = bh.chars.filter((c) => charSet.has(c));
    if (present.length === 3) {
      const matched = findChars(bh.chars);
      out.push({
        type: '방합',
        hanja: '方合',
        chars: present,
        positions: matched.map((m) => `${m.pillarLabel}지`),
        resultOheng: bh.oheng,
        desc: `${bh.name}`,
        goodBad: '길',
      });
    }
  }

  // 쌍 단위 관계 — 육합 / 충 / 파 / 해 / 원진 / 형
  for (let i = 0; i < zhi.length; i++) {
    for (let j = i + 1; j < zhi.length; j++) {
      const a = zhi[i];
      const b = zhi[j];

      // 육합
      for (const [c1, c2, oheng] of JIJI_YUKHAP) {
        if (pairMatches(a.char, b.char, [c1, c2])) {
          out.push({
            type: '육합',
            hanja: '六合',
            chars: [a.char, b.char],
            positions: [`${a.pillarLabel}지`, `${b.pillarLabel}지`],
            resultOheng: oheng,
            desc: `${a.char}${b.char}합 → ${oheng}`,
            goodBad: '길',
          });
        }
      }

      // 충
      for (const pair of JIJI_CHUNG) {
        if (pairMatches(a.char, b.char, pair)) {
          out.push({
            type: '지지충',
            hanja: '地支沖',
            chars: [a.char, b.char],
            positions: [`${a.pillarLabel}지`, `${b.pillarLabel}지`],
            desc: `${a.char}${b.char}충: 변동과 갈등`,
            goodBad: '흉',
          });
        }
      }

      // 형
      for (const [c1, c2, name] of JIJI_HYUNG) {
        if (pairMatches(a.char, b.char, [c1, c2])) {
          out.push({
            type: '형',
            hanja: '刑',
            chars: [a.char, b.char],
            positions: [`${a.pillarLabel}지`, `${b.pillarLabel}지`],
            desc: `${a.char}${b.char}형: ${name}`,
            goodBad: '흉',
          });
        }
      }

      // 파
      for (const pair of JIJI_PA) {
        if (pairMatches(a.char, b.char, pair)) {
          out.push({
            type: '파',
            hanja: '破',
            chars: [a.char, b.char],
            positions: [`${a.pillarLabel}지`, `${b.pillarLabel}지`],
            desc: `${a.char}${b.char}파: 결렬과 균열`,
            goodBad: '흉',
          });
        }
      }

      // 해(육해)
      for (const pair of JIJI_HAE) {
        if (pairMatches(a.char, b.char, pair)) {
          out.push({
            type: '해',
            hanja: '害',
            chars: [a.char, b.char],
            positions: [`${a.pillarLabel}지`, `${b.pillarLabel}지`],
            desc: `${a.char}${b.char}해: 시기와 원망`,
            goodBad: '흉',
          });
        }
      }

      // 원진
      for (const pair of JIJI_WONJIN) {
        if (pairMatches(a.char, b.char, pair)) {
          out.push({
            type: '원진',
            hanja: '怨嗔',
            chars: [a.char, b.char],
            positions: [`${a.pillarLabel}지`, `${b.pillarLabel}지`],
            desc: `${a.char}${b.char}원진: 속앓이와 미움`,
            goodBad: '흉',
          });
        }
      }
    }
  }

  return out;
}

/** 공망 — lunar-javascript 가 이미 계산해둔 결과를 카드용 Relation 으로 정제 */
function buildGongmangRelations(gongmang: GongMang[] | undefined, pillars: Pillar[]): Relation[] {
  if (!gongmang || gongmang.length === 0) return [];
  const out: Relation[] = [];

  // gongmang 의 각 항목은 보통 "X X" 형태 (지지 두 글자) — 4기둥 지지 중 일치하는 것 찾기
  for (const g of gongmang) {
    const raw = String(g.공망 || '').trim();
    if (!raw) continue;
    // "戌亥" / "戌 亥" / "戌, 亥" 등 다양한 표기 지원
    const targets = raw.split(/[,\s]+/).filter(Boolean);
    if (targets.length === 0) continue;

    const matched: Array<{ pillar: string; char: string }> = [];
    pillars.forEach((p, i) => {
      if (!p.available) return;
      if (targets.includes(p.지지)) {
        matched.push({ pillar: PILLAR_LABELS[i], char: p.지지 });
      }
    });

    if (matched.length > 0) {
      out.push({
        type: '공망',
        hanja: '空亡',
        chars: matched.map((m) => m.char),
        positions: matched.map((m) => `${m.pillar}지`),
        desc: `${g.기준 || ''} 기준 공망: ${targets.join(', ')} 자리에 해당`,
        goodBad: '흉',
      });
    } else {
      // 사주 안에 공망 글자 자체는 없지만 표기는 노출
      out.push({
        type: '공망',
        hanja: '空亡',
        chars: targets,
        positions: [g.기준 || '—'],
        desc: `${g.기준 || ''} 기준 공망: ${targets.join(', ')} (사주 내 미발현)`,
        goodBad: '중성',
      });
    }
  }

  return out;
}

/* ══════════════════════════════════════════════════════════════════
 * Public API
 * ═════════════════════════════════════════════════════════════════ */

export interface RelationsAnalysis {
  /** 천간 합·충 */
  cheongan: Relation[];
  /** 지지 — 합 계열 (육합·삼합·반합·방합) */
  jijiHap: Relation[];
  /** 지지 — 충돌 계열 (충·형·파·해·원진) */
  jijiClash: Relation[];
  /** 공망 — lunar 가 계산한 표준값 정제 */
  gongmang: Relation[];
  /** 전체 합산 (카드 한 곳에 묶어서 보여줄 때) */
  all: Relation[];
}

/**
 * 사주 4기둥 + 공망 → 전 관계 분석.
 *  ※ 입력: SajuData.pillars + SajuData.gongmang (calculator.ts 결과 그대로)
 *  ※ 출력: 카드용 Relation 배열 4분류
 */
export function analyzeRelations(
  pillars: Pillar[],
  gongmang?: GongMang[],
): RelationsAnalysis {
  const { gan, zhi } = indexChars(pillars);

  const cheongan = detectCheonganRelations(gan);
  const jijiAll = detectJijiRelations(zhi);
  const jijiHap = jijiAll.filter((r) =>
    r.type === '육합' || r.type === '삼합' || r.type === '반합' || r.type === '방합',
  );
  const jijiClash = jijiAll.filter((r) =>
    r.type === '지지충' || r.type === '형' || r.type === '파' || r.type === '해' || r.type === '원진',
  );
  const gongmangRel = buildGongmangRelations(gongmang, pillars);

  return {
    cheongan,
    jijiHap,
    jijiClash,
    gongmang: gongmangRel,
    all: [...cheongan, ...jijiHap, ...jijiClash, ...gongmangRel],
  };
}
