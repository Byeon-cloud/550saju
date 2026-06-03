// v4.1 공용 컴포넌트 barrel.
// 페이지는 `@/components/ui`에서 import.
// 기존 `@/components/common/*` 는 legacy 호환용.

export { Heading } from './Heading';
export type { HeadingLevel, HeadingProps } from './Heading';

export { CTABlock } from './CTABlock';
export type { CTABlockVariant, CTABlockProps } from './CTABlock';

export { EmptyState } from './EmptyState';
export type { EmptyStateAction, EmptyStateProps } from './EmptyState';

export { Toast } from './Toast';
export type { ToastType, ToastProps } from './Toast';

export { LoadingSkeleton } from './LoadingSkeleton';
export type { SkeletonVariant, LoadingSkeletonProps } from './LoadingSkeleton';

export { AIProgressLoader } from './AIProgressLoader';
export type { AIStage, AIProgressLoaderProps } from './AIProgressLoader';

export { KPICell } from './KPICell';
export type { KPICellProps } from './KPICell';

export { SinsalRow } from './SinsalRow';
export type { SinsalRowProps } from './SinsalRow';

export { ProductCard } from './ProductCard';
export type { ProductTier, ProductCardProps } from './ProductCard';

export { ReviewCard } from './ReviewCard';
export type { ReviewCardProps } from './ReviewCard';

export { ReasonRow } from './ReasonRow';
export type { ReasonRowProps } from './ReasonRow';
