/**
 * 꿈 종류 → 주제 추천 매핑 (2026-09-17 오너 결정)
 *
 *   결과 하단 '상담 이어가기' 근처에 카드 1장 (+ 보조 주제가 있으면 작은 링크 1개). 잠금 해제 여부와 무관하게 노출.
 *   - 주제 라벨·한자·색 = TOPIC_REGISTRY (src/constants/topics.ts) SSOT
 *   - 가격 = getTopicPrice + formatPriceLabel (src/constants/pricing.ts) SSOT — 여기서 숫자 하드코딩 금지
 *   - 카피 = 해요체 일상어 · 이모지 금지 · "이 꿈이 왜 그 주제로 이어지는지" 한 호흡
 *   - 삭제된 레거시 추천 그리드(_FreeResultView_legacy · DREAM_TOPIC_ITEMS)는 되살리지 않는다.
 */
import { TOPIC_REGISTRY, type TopicId } from '@/constants/topics';
import { getTopicPrice, formatPriceLabel } from '@/constants/pricing';

interface DreamTopicRule {
  primary: TopicId;
  copy: string;
  secondary?: { id: TopicId; lead: string };
}

/** DreamPage DREAM_CATEGORIES id → 추천 주제 (id 가 없거나 모르면 other 규칙) */
const DREAM_TOPIC_RULES: Record<string, DreamTopicRule> = {
  money: {
    primary: 'wealth',
    copy: '돈이 오가는 꿈은 재물이 움직이기 시작했다는 신호로 풀어요. 돈이 들어오고 나가는 시기를 내 사주로 짚어보세요.',
  },
  people: {
    primary: 'love',
    copy: '꿈에 나온 사람은 요즘 마음이 머무는 관계를 비춰요. 내 사주에서 인연이 어떻게 이어지는지 살펴보세요.',
    secondary: { id: 'marriage', lead: '결혼 시기가 궁금하다면' },
  },
  death: {
    primary: 'reunion',
    copy: '죽음이나 이별의 꿈은 끝보다 관계가 새로 정리되는 신호로 읽혀요. 멀어진 인연이 다시 닿을 수 있는지 확인해보세요.',
  },
  chase: {
    primary: 'exam',
    copy: '쫓기는 꿈은 결과를 기다리거나 마감을 앞둔 압박과 자주 겹쳐요. 합격과 이직이 풀리는 시기를 사주로 짚어보세요.',
    secondary: { id: 'career', lead: '일의 방향 자체가 고민이라면' },
  },
  water: {
    primary: 'wealth',
    copy: '꿈풀이에서 물은 재물이 흘러드는 길로 읽혀요. 돈이 모이는 때와 새기 쉬운 때를 이어서 확인해보세요.',
    secondary: { id: 'health', lead: '몸 상태가 신경 쓰인다면' },
  },
  flying: {
    primary: 'career',
    copy: '하늘을 나는 꿈은 지금 자리보다 한 단계 위를 바라보는 마음과 닿아 있어요. 일이 뻗어갈 방향을 사주로 살펴보세요.',
  },
  animal: {
    primary: 'love',
    copy: '동물이 나오는 꿈은 가까운 관계에서 오는 기운으로 자주 풀이돼요. 요즘 연애가 어디로 가고 있는지 이어서 보세요.',
  },
  nature: {
    primary: 'health',
    copy: '자연과 날씨의 꿈은 몸과 마음의 상태를 비추는 경우가 많아요. 사주로 보는 건강 흐름을 함께 확인해보세요.',
  },
  other: {
    primary: 'love',
    copy: '꿈이 남긴 여운이 사람과 관계 쪽으로 이어진다면, 내 사주의 연애 흐름을 함께 살펴보세요.',
  },
};

export interface DreamTopicRec {
  id: TopicId;
  label: string;
  kanji: string;
  color: string;
  /** formatPriceLabel 결과 (예: "3운") */
  price: string;
  copy: string;
  secondary?: { id: TopicId; label: string; price: string; lead: string };
}

/** 꿈 카테고리 id → 추천 카드 데이터 (라벨·한자·색·가격 전부 SSOT 파생) */
export function getDreamTopicRec(categoryId: string | null | undefined): DreamTopicRec {
  const rule = DREAM_TOPIC_RULES[categoryId || ''] || DREAM_TOPIC_RULES.other;
  const meta = TOPIC_REGISTRY[rule.primary];
  const rec: DreamTopicRec = {
    id: meta.id,
    label: meta.label,
    kanji: meta.kanji,
    color: meta.color,
    price: formatPriceLabel(getTopicPrice(meta.id)),
    copy: rule.copy,
  };
  if (rule.secondary) {
    const sub = TOPIC_REGISTRY[rule.secondary.id];
    rec.secondary = {
      id: sub.id,
      label: sub.label,
      price: formatPriceLabel(getTopicPrice(sub.id)),
      lead: rule.secondary.lead,
    };
  }
  return rec;
}
