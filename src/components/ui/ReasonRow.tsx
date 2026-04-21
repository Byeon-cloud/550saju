// v4.1 공용 — 홈 §7 "왜 사주500" 해자 요소.
// icon prop은 ReactNode (호출부가 lucide <Icon /> 또는 커스텀 SVG 주입).

import type { ReactNode } from 'react';

export interface ReasonRowProps {
  icon?: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function ReasonRow({ icon, title, description, className = '' }: ReasonRowProps) {
  return (
    <li className={`flex gap-4 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-gold-brown-soft/40 flex items-center justify-center flex-shrink-0 text-gold-brown">
        {icon ?? <DefaultIcon />}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-gray-700 leading-[1.7]">{description}</p>
      </div>
    </li>
  );
}

function DefaultIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default ReasonRow;
