/**
 * 브랜드 픽토그램 중앙 레지스트리 — 모든 페이지/컴포넌트의 유일한 진입점.
 *
 * 왜 필요한가
 *   - 이모지 대체. 한자↔픽토그램↔카피 3중 조화 (브랜드픽토그램_시스템.md)
 *   - 도메인별 분산된 아이콘을 하나의 key 문자열로 조회
 *   - 스타일 규칙 일관성: viewBox 24x24, stroke 1.5, fillOpacity 0.12~0.18
 *
 * 사용 예
 *   <Pictogram k="dream:water" size={28} color="#1565C0" />
 *   <Pictogram k="topic:love" />
 *   <Pictogram k="concern:career" size={32} className="opacity-80" />
 *
 * 스타일 규칙: /docs/prd/브랜드픽토그램_시스템.md
 */

import type { ComponentType } from 'react';
import { DREAM_ICONS, type DreamCategory } from './DreamIcons';
import { TOPIC_ICONS, type TopicKey } from './TopicIcons';
import { CONCERN_ICONS, type ConcernKey } from './ConcernIcons';
import { OHENG_ICONS } from './OhengIcons';
import { GAEWOON_ICONS, type GaewoonKey } from './GaewoonIcons';
import { IconLucky, IconCompass, IconDreamEmpty } from './DreamIcons';

interface PictogramProps {
  size?: number;
  color?: string;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// UI 보조 픽토그램 (lucky/compass/letter 등 공통)
// ─────────────────────────────────────────────────────────────

const UI_ICONS = {
  lucky: IconLucky,
  compass: IconCompass,
} as const;

type UiKey = keyof typeof UI_ICONS;

// ─────────────────────────────────────────────────────────────
// 오행 Key 매핑 (목/화/토/금/수 + wood/fire/earth/metal/water)
// ─────────────────────────────────────────────────────────────

const OHENG_REGISTRY = {
  wood: OHENG_ICONS.wood,
  fire: OHENG_ICONS.fire,
  earth: OHENG_ICONS.earth,
  metal: OHENG_ICONS.metal,
  water: OHENG_ICONS.water,
} as const;

type OhengKey = keyof typeof OHENG_REGISTRY;

// ─────────────────────────────────────────────────────────────
// 통합 Key Type
// ─────────────────────────────────────────────────────────────

export type PictogramKey =
  | `dream:${DreamCategory}`
  | `dream:empty`
  | `topic:${TopicKey}`
  | `topic:letter`
  | `concern:${ConcernKey}`
  | `oheng:${OhengKey}`
  | `gaewoon:${GaewoonKey}`
  | `ui:${UiKey}`;

// ─────────────────────────────────────────────────────────────
// Registry Map
// ─────────────────────────────────────────────────────────────

const PICTOGRAM_MAP: Partial<Record<PictogramKey, ComponentType<PictogramProps>>> = {};

// dream:* 등록
(Object.keys(DREAM_ICONS) as DreamCategory[]).forEach((k) => {
  PICTOGRAM_MAP[`dream:${k}` as PictogramKey] = DREAM_ICONS[k];
});
PICTOGRAM_MAP['dream:empty'] = IconDreamEmpty as unknown as ComponentType<PictogramProps>;

// topic:* 등록
(Object.keys(TOPIC_ICONS) as TopicKey[]).forEach((k) => {
  PICTOGRAM_MAP[`topic:${k}` as PictogramKey] = TOPIC_ICONS[k];
});

// concern:* 등록
(Object.keys(CONCERN_ICONS) as ConcernKey[]).forEach((k) => {
  PICTOGRAM_MAP[`concern:${k}` as PictogramKey] = CONCERN_ICONS[k];
});

// oheng:* 등록
(Object.keys(OHENG_REGISTRY) as OhengKey[]).forEach((k) => {
  PICTOGRAM_MAP[`oheng:${k}` as PictogramKey] = OHENG_REGISTRY[k];
});

// gaewoon:* 등록
(Object.keys(GAEWOON_ICONS) as GaewoonKey[]).forEach((k) => {
  PICTOGRAM_MAP[`gaewoon:${k}` as PictogramKey] = GAEWOON_ICONS[k];
});

// ui:* 등록
(Object.keys(UI_ICONS) as UiKey[]).forEach((k) => {
  PICTOGRAM_MAP[`ui:${k}` as PictogramKey] = UI_ICONS[k];
});

// ─────────────────────────────────────────────────────────────
// Pictogram 컴포넌트 — 모든 페이지의 유일한 진입점
// ─────────────────────────────────────────────────────────────

interface PictogramComponentProps extends PictogramProps {
  /** 도메인:ID 형태 key. 예: "dream:water", "topic:love", "concern:career" */
  k: PictogramKey;
  /** 미등록 key에 대한 fallback. 기본은 null (렌더 안 함) */
  fallback?: ComponentType<PictogramProps> | null;
}

export function Pictogram({ k, fallback = null, ...props }: PictogramComponentProps) {
  const Icon = PICTOGRAM_MAP[k];
  if (!Icon) {
    if (import.meta.env.DEV) {
      console.warn(`[Pictogram] 등록되지 않은 key: ${k}`);
    }
    if (fallback) {
      const Fallback = fallback;
      return <Fallback {...props} />;
    }
    return null;
  }
  return <Icon {...props} />;
}

/** 개별 컴포넌트 직접 import 경로 — 성능 최적화 필요 시 사용 */
export { DREAM_ICONS, TOPIC_ICONS, CONCERN_ICONS, OHENG_ICONS, GAEWOON_ICONS };
export type { DreamCategory, TopicKey, ConcernKey, GaewoonKey };
