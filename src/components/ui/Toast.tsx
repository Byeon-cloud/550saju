// v4.1 공용 — 토스트 표시.
// Presentation only. 표시/소멸 제어는 상위 컴포넌트 or ToastProvider(별도)가 담당.

import type { ReactNode } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  type?: ToastType;
  title: string;
  description?: string;
  /** 우측 액션 (예: "재개"). */
  action?: { label: string; onClick: () => void };
  /** X 버튼 핸들러 (있으면 닫기 가능). */
  onClose?: () => void;
  className?: string;
}

const ACCENT: Record<ToastType, { ring: string; bar: string; ic: ReactNode }> = {
  info: { ring: 'border-info/30', bar: 'bg-info', ic: <Dot color="#5A7A8C" /> },
  success: { ring: 'border-success/40', bar: 'bg-success', ic: <Check color="#5E8C5A" /> },
  warning: { ring: 'border-warning/40', bar: 'bg-warning', ic: <Dot color="#B08950" /> },
  error: { ring: 'border-error/40', bar: 'bg-error', ic: <Dot color="#8B4A3A" /> },
};

export function Toast({
  type = 'info',
  title,
  description,
  action,
  onClose,
  className = '',
}: ToastProps) {
  const tone = ACCENT[type];
  return (
    <div
      role="status"
      className={`relative flex items-start gap-3 bg-paper border ${tone.ring} rounded-xl p-4 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.12)] ${className}`}
    >
      <div className={`w-1 self-stretch rounded-full ${tone.bar}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mt-1 text-xs text-gray-700 leading-5">{description}</p>
        ) : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="text-sm font-semibold text-gold-brown hover:text-gold-brown-dark"
        >
          {action.label}
        </button>
      ) : null}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="토스트 닫기"
          className="text-gray-500 hover:text-ink text-sm px-2"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block w-2 h-2 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function Check({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4 4 10-10"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Toast;
