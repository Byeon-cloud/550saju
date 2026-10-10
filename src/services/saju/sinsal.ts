/**
 * #saju-card-share · Stage 1 — 신살(神煞) 종합 계산기
 *
 * 만세력 카드용 — 12신살 + 길성귀인 + 보조 신살 통합 계산.
 *
 * ⚠️ 보존 원칙:
 *   - 기존 calculator.ts 의 lunar.getDayJiShen() / getDayXiongSha() 결과는 그대로 유지 (PremiumResult 등 다른 곳에서 사용)
 *   - 본 모듈은 카드용 추가 분석 — 사주 데이터 자체를 변경하지 않음 (read-only)
 *   - lunar-javascript 미사용 — 이미 계산된 pillars(천간/지지) 만 받아서 순수 함수로 매핑
 *
 * 12신살 (年支 또는 日支 기준 — 본 모듈은 일지 기준):
 *   겁살·재살·천살·지살·년살(도화)·월살·망신·장성·반안·역마·육해·화개
 *
 * 길성 귀인:
 *   - 천을귀인(天乙貴人): 일간 → 지지 매핑 (가장 강력한 길성)
 *   - 문창귀인(文昌貴人): 일간 → 지지 (학문·시험 길성)
 *   - 월덕귀인(月德貴人): 월지 → 천간 (덕성)
 *   - 천덕귀인(天德貴人): 월지 → 천간/지지 (덕성)
 *   - 금여성(金輿星): 일간 → 지지 (배우자 인연)
 *   - 태극귀인(太極貴人): 일간 → 지지 (불사·치유)
 *
 * 보조 신살:
 *   - 홍염살(紅艶殺): 일간 → 지지 (도화의 강력 버전 · 매력)
 *   - 괴강살(魁罡殺): 일주 자체 (庚辰·庚戌·壬辰·戊戌·壬戌)
 *   - 현침살(懸針殺): 글자 자체 (甲卯午辛申)
 *   - 백호대살(白虎大殺): 일주/년주 (甲辰乙未丙戌丁丑戊辰壬戌癸丑)
 */

import type { Pillar } from '@/types/saju';

/* ══════════════════════════════════════════════════════════════════
 * 12신살 표 — 일지 또는 년지의 삼합 그룹 기준
 * ═════════════════════════════════════════════════════════════════ */

/** 삼합(三合) 그룹 4종 — 12신살 기준점 */
const SANHAP_GROUPS: Record<string, string> = {
  // 申子辰 = 水局
  申: 'sin', 子: 'sin', 辰: 'sin',
  // 巳酉丑 = 金局
  巳: 'geum', 酉: 'geum', 丑: 'geum',
  // 寅午戌 = 火局
  寅: 'hwa', 午: 'hwa', 戌: 'hwa',
  // 亥卯未 = 木局
  亥: 'mok', 卯: 'mok', 未: 'mok',
};

/** 12신살 매핑표 (그룹별 12지지 순서) */
const SHIPISINSAL_MAP: Record<string, Record<string, string>> = {
  // 水局(申子辰)
  sin: {
    巳: '겁살', 午: '재살', 未: '천살', 申: '지살', 酉: '도화살', 戌: '월살',
    亥: '망신살', 子: '장성살', 丑: '반안살', 寅: '역마살', 卯: '육해살', 辰: '화개살',
  },
  // 金局(巳酉丑)
  geum: {
    寅: '겁살', 卯: '재살', 辰: '천살', 巳: '지살', 午: '도화살', 未: '월살',
    申: '망신살', 酉: '장성살', 戌: '반안살', 亥: '역마살', 子: '육해살', 丑: '화개살',
  },
  // 火局(寅午戌)
  hwa: {
    亥: '겁살', 子: '재살', 丑: '천살', 寅: '지살', 卯: '도화살', 辰: '월살',
    巳: '망신살', 午: '장성살', 未: '반안살', 申: '역마살', 酉: '육해살', 戌: '화개살',
  },
  // 木局(亥卯未)
  mok: {
    申: '겁살', 酉: '재살', 戌: '천살', 亥: '지살', 子: '도화살', 丑: '월살',
    寅: '망신살', 卯: '장성살', 辰: '반안살', 巳: '역마살', 午: '육해살', 未: '화개살',
  },
};

const SHIPISINSAL_HANJA: Record<string, string> = {
  겁살: '劫殺', 재살: '災殺', 천살: '天殺', 지살: '地殺',
  도화살: '桃花殺', 월살: '月殺', 망신살: '亡身殺', 장성살: '將星殺',
  반안살: '攀鞍殺', 역마살: '驛馬殺', 육해살: '六害殺', 화개살: '華蓋殺',
};

const SHIPISINSAL_MEAN: Record<string, string> = {
  겁살: '재물과 건강 손실의 위험을 알리는 살. 방심하지 말고 단단히 지킬 때',
  재살: '큰 변화와 이동의 시기. 위기와 기회가 동시에 오는 살',
  천살: '하늘이 내리는 시험. 인내와 성찰로 단련되는 시기',
  지살: '이사 이동과 환경 변화. 새 출발의 신호',
  도화살: '매력, 인기, 이성운. 사람을 끌어당기는 자석 같은 별',
  월살: '소모와 답답함의 시기. 휴식과 정비가 필요한 별',
  망신살: '체면과 자존심에 흠이 갈 수 있는 별. 절제와 신중함이 약',
  장성살: '권위와 리더십의 별. 무리를 이끄는 힘',
  반안살: '안정과 풍요의 별. 자리 잡고 꽃피우는 시기',
  역마살: '이동, 여행, 외국 인연의 별. 한곳에 머물지 않는 결',
  육해살: '관계 갈등과 소송의 위험. 인간관계 정리가 필요한 별',
  화개살: '예술, 종교, 철학의 별. 깊은 사유와 영감의 결',
};

/* ══════════════════════════════════════════════════════════════════
 * 길성 귀인 (天乙·文昌·月德·天德·金輿·太極)
 * ═════════════════════════════════════════════════════════════════ */

/** 천을귀인(天乙貴人) — 일간 → 지지 2개 */
const CHEONUL_MAP: Record<string, string[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  辛: ['寅', '午'],
  壬: ['巳', '卯'], 癸: ['巳', '卯'],
};

/** 문창귀인(文昌貴人) — 일간 → 지지 1개 */
const MUNCHANG_MAP: Record<string, string> = {
  甲: '巳', 乙: '午', 丙: '申', 戊: '申',
  丁: '酉', 己: '酉', 庚: '亥', 辛: '子',
  壬: '寅', 癸: '卯',
};

/** 월덕귀인(月德貴人) — 월지 그룹 → 천간 */
const WOLDUEK_MAP: Record<string, string> = {
  // 寅午戌(火局) → 丙
  寅: '丙', 午: '丙', 戌: '丙',
  // 申子辰(水局) → 壬
  申: '壬', 子: '壬', 辰: '壬',
  // 巳酉丑(金局) → 庚
  巳: '庚', 酉: '庚', 丑: '庚',
  // 亥卯未(木局) → 甲
  亥: '甲', 卯: '甲', 未: '甲',
};

/** 천덕귀인(天德貴人) — 월지 → 천간 또는 지지 */
const CHEONDUEK_MAP: Record<string, string> = {
  寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲',
  申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚',
};

/** 금여성(金輿星) — 일간 → 지지 1개 (배우자 인연) */
const GEUMYEO_MAP: Record<string, string> = {
  甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未',
  己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅',
};

/** 태극귀인(太極貴人) — 일간 → 지지 2개 */
const TAEGEUK_MAP: Record<string, string[]> = {
  甲: ['子', '午'], 乙: ['子', '午'],
  丙: ['卯', '酉'], 丁: ['卯', '酉'],
  戊: ['辰', '戌'], 己: ['辰', '戌'],
  庚: ['寅', '申'], 辛: ['寅', '申'],
  壬: ['巳', '亥'], 癸: ['巳', '亥'],
};

/* ══════════════════════════════════════════════════════════════════
 * 보조 신살 (紅艶·魁罡·懸針·白虎)
 * ═════════════════════════════════════════════════════════════════ */

/** 홍염살(紅艶殺) — 일간 → 지지 (도화의 강력 버전) */
const HONGYEOM_MAP: Record<string, string[]> = {
  甲: ['午'], 乙: ['午'],
  丙: ['寅'], 丁: ['未'],
  戊: ['辰'], 己: ['辰'],
  庚: ['戌'], 辛: ['酉'],
  壬: ['子', '申'], 癸: ['子', '申'],
};

/** 괴강살(魁罡殺) — 일주 한자 자체 (5종) */
const GOEGANG_ILJU = new Set(['庚辰', '庚戌', '壬辰', '戊戌', '壬戌']);

/** 현침살(懸針殺) — 날카로운 글자 (甲·卯·午·辛·申) */
const HYEONCHIM_CHARS = new Set(['甲', '卯', '午', '辛', '申']);

/** 백호대살(白虎大殺) — 7종 일주/년주/월주 */
const BAEKHO_GANJI = new Set(['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑']);

/* ══════════════════════════════════════════════════════════════════
 * 출력 타입
 * ═════════════════════════════════════════════════════════════════ */

export interface SinsalHit {
  /** 신살 이름 한국어 (예: "도화살") */
  name: string;
  /** 신살 한자 (예: "桃花殺") */
  hanja: string;
  /** 어느 위치(년/월/일/시) 어느 글자에 떨어졌는가 */
  positions: Array<{ pillar: '년주' | '월주' | '일주' | '시주'; char: string }>;
  /** 길성/흉성/중성 */
  category: 'gilsin' | 'hyungsal' | 'neutral';
  /** 짧은 설명 */
  meaning: string;
}

export interface SinsalAnalysis {
  /** 12신살 — 일지 기준 매핑 (4기둥 각 지지에 대해) */
  shipiSinsal: SinsalHit[];
  /** 길성 귀인 — 천을·문창·월덕·천덕·금여·태극 */
  gilsongGwiin: SinsalHit[];
  /** 보조 신살 — 홍염·괴강·현침·백호 */
  bojo: SinsalHit[];
}

/* ══════════════════════════════════════════════════════════════════
 * 메인 계산기
 * ═════════════════════════════════════════════════════════════════ */

const PILLAR_LABELS: Array<'년주' | '월주' | '일주' | '시주'> = ['년주', '월주', '일주', '시주'];

/**
 * 12신살 계산 — 일지 기준.
 *  ※ 일부 명리학파는 년지 기준 — 본 구현은 가장 일반적인 일지 기준 채택.
 */
function compute12Sinsal(pillars: Pillar[]): SinsalHit[] {
  const dayZhi = pillars[2]?.지지;
  if (!dayZhi) return [];
  const group = SANHAP_GROUPS[dayZhi];
  if (!group) return [];
  const map = SHIPISINSAL_MAP[group];
  if (!map) return [];

  const hits: SinsalHit[] = [];
  // 신살명 → 발견된 위치들 (같은 신살이 여러 기둥에 있을 수 있음)
  const byName = new Map<string, Array<{ pillar: '년주' | '월주' | '일주' | '시주'; char: string }>>();

  pillars.forEach((p, i) => {
    if (!p.available || !p.지지) return;
    const sinsalName = map[p.지지];
    if (!sinsalName) return;
    const list = byName.get(sinsalName) ?? [];
    list.push({ pillar: PILLAR_LABELS[i], char: p.지지 });
    byName.set(sinsalName, list);
  });

  for (const [name, positions] of byName) {
    hits.push({
      name,
      hanja: SHIPISINSAL_HANJA[name] || name,
      positions,
      // 12신살 카테고리 — 통설 기준
      category: ['도화살', '장성살', '반안살', '화개살'].includes(name)
        ? 'gilsin'
        : ['겁살', '재살', '천살', '망신살', '월살', '육해살'].includes(name)
        ? 'hyungsal'
        : 'neutral',
      meaning: SHIPISINSAL_MEAN[name] || '',
    });
  }
  return hits;
}

/** 길성 귀인 6종 계산 */
function computeGilsongGwiin(pillars: Pillar[]): SinsalHit[] {
  const hits: SinsalHit[] = [];
  const dayGan = pillars[2]?.천간 ?? '';
  const monthZhi = pillars[1]?.지지 ?? '';

  const findPositionsByZhi = (targets: string[]) => {
    const out: Array<{ pillar: '년주' | '월주' | '일주' | '시주'; char: string }> = [];
    pillars.forEach((p, i) => {
      if (p.available && targets.includes(p.지지)) {
        out.push({ pillar: PILLAR_LABELS[i], char: p.지지 });
      }
    });
    return out;
  };
  const findPositionsByGan = (targets: string[]) => {
    const out: Array<{ pillar: '년주' | '월주' | '일주' | '시주'; char: string }> = [];
    pillars.forEach((p, i) => {
      if (p.available && targets.includes(p.천간)) {
        out.push({ pillar: PILLAR_LABELS[i], char: p.천간 });
      }
    });
    return out;
  };

  // 천을귀인
  if (dayGan && CHEONUL_MAP[dayGan]) {
    const positions = findPositionsByZhi(CHEONUL_MAP[dayGan]);
    if (positions.length) {
      hits.push({
        name: '천을귀인',
        hanja: '天乙貴人',
        positions,
        category: 'gilsin',
        meaning: '가장 강력한 길성. 위기 시 도움 받는 인연과 귀인 운',
      });
    }
  }

  // 문창귀인
  if (dayGan && MUNCHANG_MAP[dayGan]) {
    const positions = findPositionsByZhi([MUNCHANG_MAP[dayGan]]);
    if (positions.length) {
      hits.push({
        name: '문창귀인',
        hanja: '文昌貴人',
        positions,
        category: 'gilsin',
        meaning: '학문, 시험, 문서 운. 두뇌 회전이 빠르고 글재주가 있음',
      });
    }
  }

  // 월덕귀인 (월지 → 천간)
  if (monthZhi && WOLDUEK_MAP[monthZhi]) {
    const positions = findPositionsByGan([WOLDUEK_MAP[monthZhi]]);
    if (positions.length) {
      hits.push({
        name: '월덕귀인',
        hanja: '月德貴人',
        positions,
        category: 'gilsin',
        meaning: '품성이 어질고 덕이 있어 주변의 신뢰를 받음',
      });
    }
  }

  // 천덕귀인 (월지 → 천간/지지 둘 다 검사)
  if (monthZhi && CHEONDUEK_MAP[monthZhi]) {
    const target = CHEONDUEK_MAP[monthZhi];
    const ganHits = findPositionsByGan([target]);
    const zhiHits = findPositionsByZhi([target]);
    const positions = [...ganHits, ...zhiHits];
    if (positions.length) {
      hits.push({
        name: '천덕귀인',
        hanja: '天德貴人',
        positions,
        category: 'gilsin',
        meaning: '하늘이 내린 덕. 큰 화를 면하고 음덕을 받음',
      });
    }
  }

  // 금여성
  if (dayGan && GEUMYEO_MAP[dayGan]) {
    const positions = findPositionsByZhi([GEUMYEO_MAP[dayGan]]);
    if (positions.length) {
      hits.push({
        name: '금여성',
        hanja: '金輿星',
        positions,
        category: 'gilsin',
        meaning: '배우자 인연과 풍요 운. 좋은 짝과 안락한 가정',
      });
    }
  }

  // 태극귀인
  if (dayGan && TAEGEUK_MAP[dayGan]) {
    const positions = findPositionsByZhi(TAEGEUK_MAP[dayGan]);
    if (positions.length) {
      hits.push({
        name: '태극귀인',
        hanja: '太極貴人',
        positions,
        category: 'gilsin',
        meaning: '큰 깨달음과 치유의 별. 종교, 철학, 의료에 인연',
      });
    }
  }

  return hits;
}

/** 보조 신살 — 홍염·괴강·현침·백호 */
function computeBojoSinsal(pillars: Pillar[]): SinsalHit[] {
  const hits: SinsalHit[] = [];
  const dayGan = pillars[2]?.천간 ?? '';

  // 홍염살 (일간 → 지지)
  if (dayGan && HONGYEOM_MAP[dayGan]) {
    const targets = HONGYEOM_MAP[dayGan];
    const positions: SinsalHit['positions'] = [];
    pillars.forEach((p, i) => {
      if (p.available && targets.includes(p.지지)) {
        positions.push({ pillar: PILLAR_LABELS[i], char: p.지지 });
      }
    });
    if (positions.length) {
      hits.push({
        name: '홍염살',
        hanja: '紅艶殺',
        positions,
        category: 'neutral',
        meaning: '강력한 매력과 이성 운. 도화살의 짙은 버전',
      });
    }
  }

  // 괴강살 — 일주 자체 (드물게 년주/월주에도 있을 수 있어 4기둥 검사)
  pillars.forEach((p, i) => {
    if (!p.available) return;
    const ganji = `${p.천간}${p.지지}`;
    if (GOEGANG_ILJU.has(ganji)) {
      hits.push({
        name: '괴강살',
        hanja: '魁罡殺',
        positions: [{ pillar: PILLAR_LABELS[i], char: ganji }],
        category: 'neutral',
        meaning: '대길대흉의 별. 강한 카리스마와 양 극단의 결과',
      });
    }
  });

  // 현침살 — 글자(甲卯午辛申) 빈도
  const hyeonchimPositions: SinsalHit['positions'] = [];
  pillars.forEach((p, i) => {
    if (!p.available) return;
    if (HYEONCHIM_CHARS.has(p.천간)) {
      hyeonchimPositions.push({ pillar: PILLAR_LABELS[i], char: p.천간 });
    }
    if (HYEONCHIM_CHARS.has(p.지지)) {
      hyeonchimPositions.push({ pillar: PILLAR_LABELS[i], char: p.지지 });
    }
  });
  if (hyeonchimPositions.length >= 2) {
    hits.push({
      name: '현침살',
      hanja: '懸針殺',
      positions: hyeonchimPositions,
      category: 'hyungsal',
      meaning: '날카로운 직관과 예리한 분석. 의료, 법조, 언론 적성, 다만 말이 날카로워 인간관계 주의',
    });
  }

  // 백호대살 (4기둥 검사)
  pillars.forEach((p, i) => {
    if (!p.available) return;
    const ganji = `${p.천간}${p.지지}`;
    if (BAEKHO_GANJI.has(ganji)) {
      hits.push({
        name: '백호대살',
        hanja: '白虎大殺',
        positions: [{ pillar: PILLAR_LABELS[i], char: ganji }],
        category: 'hyungsal',
        meaning: '큰 사고와 돌발 변화의 별. 근거리 안전과 건강 주의',
      });
    }
  });

  return hits;
}

/**
 * 만세력 카드용 신살 종합 분석.
 *  ※ 입력: SajuData.pillars (이미 lunar-javascript 로 계산된 4기둥)
 *  ※ 출력: 카드 표시용 정제된 신살 리스트
 */
export function analyzeSinsal(pillars: Pillar[]): SinsalAnalysis {
  return {
    shipiSinsal: compute12Sinsal(pillars),
    gilsongGwiin: computeGilsongGwiin(pillars),
    bojo: computeBojoSinsal(pillars),
  };
}
