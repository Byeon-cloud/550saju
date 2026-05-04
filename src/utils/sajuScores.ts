/**
 * 주제별 점수 산출 — 명리학적 가중치 기반
 *
 * ★ 통일성 정책 ★
 *  - 프리미엄 결과의 §09 "주제별 한눈에"
 *  - 주제별 1운 결과지 (TopicAnalysisPage / SubjectPage 등)
 *  모든 곳에서 본 함수 한 곳을 호출 → 동일 사주가 어디서 봐도 같은 점수.
 *
 * 산출 로직:
 *  1. 사주 8글자 → 일간 오행 + 십성 분포 산출
 *  2. 6 주제별 가중치 합산 (career/love/wealth/social/health/potential)
 *  3. ranking + scaling — 가장 강한 주제 90~98, 가장 약 35~55, spread 보장
 *
 * AI 가 별도 scores 를 주면 그것 우선 (단 spread 미달 시 보정).
 */
import type { SajuData, OhengType } from '@/types/saju';

interface ScoresInput {
  sajuData: SajuData;
  aiScores?: Record<string, number>;
}

interface SipDist {
  // 5분류 합계 (집계용)
  비겁: number;
  식상: number;
  재성: number;
  관성: number;
  인성: number;
  // 10분류 세분 (정/편 음양 구분 — 자평진전 격국론 정통)
  비견: number;  // 같은 음양
  겁재: number;  // 다른 음양 (양 vs 음)
  식신: number;  // 같은 음양
  상관: number;  // 다른 음양
  편재: number;  // 같은 음양
  정재: number;  // 다른 음양
  편관: number;  // 같은 음양 (七殺)
  정관: number;  // 다른 음양
  편인: number;  // 같은 음양
  정인: number;  // 다른 음양
}

/**
 * 십성 분포 계산 — 음양 구분 10분류 (자평진전 정통)
 *
 * 정통 정의:
 *  · 일간과 오행 같음 + 음양 같음 → 비견 (같은 결의 자리)
 *  · 일간과 오행 같음 + 음양 다름 → 겁재 (경쟁의 자리)
 *  · 일간이 생(生)하는 오행 + 음양 같음 → 식신
 *  · 일간이 생하는 오행 + 음양 다름 → 상관
 *  · 일간이 극(剋)하는 오행 + 음양 같음 → 편재
 *  · 일간이 극하는 오행 + 음양 다름 → 정재
 *  · 일간을 극하는 오행 + 음양 같음 → 편관 (칠살)
 *  · 일간을 극하는 오행 + 음양 다름 → 정관
 *  · 일간을 생하는 오행 + 음양 같음 → 편인
 *  · 일간을 생하는 오행 + 음양 다름 → 정인
 */
function computeSipDist(sajuData: SajuData): SipDist {
  const dayPillar = sajuData.pillars[2];
  const dayOheng = (dayPillar?.천간오행 ?? '토') as OhengType;
  const dayYinYang = dayPillar?.천간음양 || '양'; // '양' or '음'
  const SS: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const SG: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
  const dist: SipDist = {
    비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0,
    비견: 0, 겁재: 0, 식신: 0, 상관: 0,
    편재: 0, 정재: 0, 편관: 0, 정관: 0, 편인: 0, 정인: 0,
  };
  for (const p of sajuData.pillars) {
    if (!p.available) continue;
    // 천간 (음양 정보 직접 사용)
    if (p.천간오행) {
      classifySipsung(dist, dayOheng, dayYinYang, p.천간오행 as OhengType, p.천간음양 || '양', SS, SG);
    }
    // 지지 (음양 정보 직접 사용)
    if (p.지지오행) {
      classifySipsung(dist, dayOheng, dayYinYang, p.지지오행 as OhengType, p.지지음양 || '양', SS, SG);
    }
  }
  return dist;
}

/** 단일 오행+음양 → 십성 정확 분류 (10분류 + 5집계 동시 카운트) */
function classifySipsung(
  dist: SipDist,
  dayOheng: OhengType,
  dayYinYang: string,
  targetOheng: OhengType,
  targetYinYang: string,
  SS: Record<OhengType, OhengType>,
  SG: Record<OhengType, OhengType>,
): void {
  const sameYY = dayYinYang === targetYinYang;
  if (targetOheng === dayOheng) {
    // 비겁 — 비견(같음) / 겁재(다름)
    dist.비겁++;
    if (sameYY) dist.비견++;
    else dist.겁재++;
  } else if (SS[dayOheng] === targetOheng) {
    // 식상 — 식신(같음) / 상관(다름)
    dist.식상++;
    if (sameYY) dist.식신++;
    else dist.상관++;
  } else if (SG[dayOheng] === targetOheng) {
    // 재성 — 편재(같음) / 정재(다름)
    dist.재성++;
    if (sameYY) dist.편재++;
    else dist.정재++;
  } else if (SG[targetOheng] === dayOheng) {
    // 관성 — 편관 칠살(같음) / 정관(다름)
    dist.관성++;
    if (sameYY) dist.편관++;
    else dist.정관++;
  } else if (SS[targetOheng] === dayOheng) {
    // 인성 — 편인(같음) / 정인(다름)
    dist.인성++;
    if (sameYY) dist.편인++;
    else dist.정인++;
  }
}

/** 신살 발현 검사 (가산점) — Saju에 도화/문창/천을귀인 등 있는지 */
function hasShinsalGroup(sajuData: SajuData, names: string[]): boolean {
  const all = [...(sajuData.gilsin || []), ...(sajuData.hyungsal || [])];
  return all.some((s) => names.some((n) => s.이름?.includes(n) || s.이름한자?.includes(n)));
}

export type TopicKey = 'career' | 'love' | 'wealth' | 'social' | 'health' | 'potential';

/**
 * 주제별 명리학 raw 점수 (가산점 합 — spread 전)
 */
function computeRaw(sajuData: SajuData): Record<TopicKey, number> {
  const e = sajuData.elements as Record<OhengType, number>;
  const dayOheng = (sajuData.pillars[2]?.천간오행 ?? '토') as OhengType;
  const sip = computeSipDist(sajuData);

  // 일간 강약 — 비겁+인성 vs 식상+재성+관성
  const bodyStrong = sip.비겁 + sip.인성;
  const bodyWeak = sip.식상 + sip.재성 + sip.관성;
  const balanceFactor = 1 - Math.abs(bodyStrong - bodyWeak) / Math.max(bodyStrong + bodyWeak, 1);
  // 0 (극단 신강/신약) ~ 1 (균형)

  // 신살 가산점
  const hasMunchang = hasShinsalGroup(sajuData, ['문창귀인', '文昌貴人', '학당귀인', '學堂貴人']);
  const hasCheonul = hasShinsalGroup(sajuData, ['천을귀인', '天乙貴人']);
  const hasDohwa = hasShinsalGroup(sajuData, ['도화살', '桃花殺', '홍염살', '紅艶殺']);
  const hasYeokma = hasShinsalGroup(sajuData, ['역마살', '驛馬殺']);
  const hasBaekho = hasShinsalGroup(sajuData, ['백호살', '白虎殺', '괴강', '魁罡']);
  const hasGongmang = (sajuData.gongmang || []).length > 0;

  // 주제별 raw 점수 (0~100 베이스, 각 주제마다 다른 가중치)
  // career: 관성 (자리) + 식상 (표현) + 문창귀인 + 천을귀인 + 신강
  const career =
    50 +
    sip.관성 * 5 +
    sip.식상 * 3 +
    (hasMunchang ? 12 : 0) +
    (hasCheonul ? 8 : 0) +
    (bodyStrong >= 4 ? 6 : 0) -
    (sip.식상 >= 2 && sip.관성 >= 1 ? 5 : 0); // 상관견관 — 직장에서 답답함

  // love: 일지 오행 + 재성 + 도화/홍염
  const dayJiOheng = (sajuData.pillars[2]?.지지오행 ?? '토') as OhengType;
  const love =
    50 +
    sip.재성 * 5 +
    Number(e[dayJiOheng] ?? 0) * 2 +
    (hasDohwa ? 14 : 0) +
    (sip.재성 === 0 ? -10 : 0) +
    balanceFactor * 8;

  // wealth: 재성 + 식상 (재원) + 토 (쌓이는 자리) - 비겁(겁재)
  const wealth =
    50 +
    sip.재성 * 6 +
    sip.식상 * 4 +
    Number(e['토'] ?? 0) * 2 +
    (sip.비겁 >= 2 && sip.재성 >= 1 ? -10 : 0) + // 겁재가 정재 침
    (hasGongmang ? -3 : 0);

  // social: 비겁 + 인성 — 다른 주제 (1~2 십성) 와 동등하게 (이전: 3개 십성 합산으로 항상 과대평가)
  // 가족관계가 항상 90+ 나오던 버그 수정
  const social =
    50 +
    sip.비겁 * 3 +
    sip.인성 * 2 +
    (hasDohwa ? 6 : 0) +
    balanceFactor * 5;

  // health: 일간 균형 + 무한 영(0)자 페널티 + 백호살 페널티
  const zeroCount = Object.values(e).filter((v) => Number(v) === 0).length;
  const health =
    50 +
    balanceFactor * 25 -
    zeroCount * 8 +
    (sip.인성 >= 2 ? 5 : 0) +
    (hasBaekho ? -8 : 0);

  // potential: 용신/희신 (인성·식상) + 역마 + 문창
  const potential =
    50 +
    sip.인성 * 3 +
    sip.식상 * 3 +
    (hasMunchang ? 10 : 0) +
    (hasYeokma ? 6 : 0) +
    balanceFactor * 8;

  void dayOheng;

  return {
    career: Math.max(20, Math.min(100, career)),
    love: Math.max(20, Math.min(100, love)),
    wealth: Math.max(20, Math.min(100, wealth)),
    social: Math.max(20, Math.min(100, social)),
    health: Math.max(20, Math.min(100, health)),
    potential: Math.max(20, Math.min(100, potential)),
  };
}

/**
 * spread 강제 — ranking 기반 scaling (2026-05 균형 조정)
 *  · 이전: 1등 90~98, 6등 38~48 — 너무 극단치 (모든 사주가 90+ 1개, 40 1개 강제)
 *  · 이후: 1등 78~88, 6등 48~58 — 자연스러운 분포
 *  · 단조성 유지 — raw 순서대로 spread 적용
 */
function applySpread(raw: Record<TopicKey, number>): Record<TopicKey, number> {
  const entries = (Object.entries(raw) as Array<[TopicKey, number]>);
  // raw 점수 내림차순 정렬
  entries.sort((a, b) => b[1] - a[1]);
  const RANK_RANGES: Array<[number, number]> = [
    [78, 88],  // 1등 — 강점이지만 100점 만점이 아닌 현실 점수
    [70, 80],  // 2등
    [62, 72],  // 3등
    [55, 65],  // 4등
    [50, 60],  // 5등
    [45, 55],  // 6등 — 약점이지만 절망적이지 않게
  ];
  const out: Record<TopicKey, number> = { career: 0, love: 0, wealth: 0, social: 0, health: 0, potential: 0 };
  // 같은 raw 점수 인접한 그룹은 같은 ranking
  for (let i = 0; i < entries.length; i++) {
    const [key, rawScore] = entries[i];
    const [lo, hi] = RANK_RANGES[i] || [38, 48];
    // raw 비율 (해당 range 안에서 rawScore 비례) — raw 가 60이면 mid, 80이면 high
    // 단순 균등: 등급 중앙값 ± (raw-50)/10
    const midRange = (lo + hi) / 2;
    const offset = Math.max(-5, Math.min(5, (rawScore - 50) / 5));
    out[key] = Math.max(lo, Math.min(hi, Math.round(midRange + offset)));
  }
  return out;
}

/**
 * 최종 산출 — AI scores 우선 + spread 보장
 *  · AI scores 가 너무 극단적 (max≥95 또는 min≤40) 이면 raw 재산출 (현실적 범위 강제)
 *  · 이전: AI 가 가족관계 98 / 직업 44 같이 극단치 그대로 노출 → 이상함
 */
export function computeTopicScores({ sajuData, aiScores }: ScoresInput): Record<TopicKey, number> {
  // AI scores 가 있을 때 — 극단치 검사 후 사용
  if (aiScores) {
    const vals = (['career', 'love', 'wealth', 'social', 'health', 'potential'] as TopicKey[])
      .map((k) => Number(aiScores[k] ?? 0))
      .filter((v) => v > 0);
    if (vals.length >= 5) {
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      // 극단치 (>92 or <40) 또는 spread 너무 작음 (<20) 또는 너무 큼 (>50) → raw 재산출
      const tooExtreme = max > 92 || min < 40;
      const badSpread = (max - min) < 20 || (max - min) > 50;
      if (!tooExtreme && !badSpread) {
        return {
          career: Number(aiScores.career ?? 70),
          love: Number(aiScores.love ?? 70),
          wealth: Number(aiScores.wealth ?? 70),
          social: Number(aiScores.social ?? 70),
          health: Number(aiScores.health ?? 70),
          potential: Number(aiScores.potential ?? 70),
        };
      }
    }
  }
  // AI scores 없거나 극단치 → raw 산출 + spread 강제 (78~88 / 45~55 범위)
  const raw = computeRaw(sajuData);
  return applySpread(raw);
}
