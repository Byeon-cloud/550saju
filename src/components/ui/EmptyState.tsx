// v4.1 공용 — 빈 상태 일관화.
// 기존 components/common/EmptyState 와 이름 동일하나 모듈 경로로 분리.
// 기존: common/EmptyState (actionLabel / onAction flat)
// 신규: ui/EmptyState (action 객체 · v4.1 스펙)

import type { ReactNode } from 'react';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** 아이콘 노드 (예: <Sparkles className="..." />). */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center py-12 px-5 ${className}`}>
      {icon ? (
        <div className="w-14 h-14 rounded-full bg-gold-brown-soft/40 flex items-center justify-center text-gold-brown">
          {icon}
        </div>
      ) : null}
      <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm text-gray-700 leading-[1.7] max-w-[320px]">{description}</p>
      ) : null}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 h-[52px] px-6 rounded-xl bg-gold-brown text-white text-base font-semibold hover:bg-gold-brown-dark transition"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export default EmptyState;
