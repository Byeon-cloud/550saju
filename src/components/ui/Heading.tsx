// v4.1 공용 공용컴포넌트 — 페이지·섹션 타이틀 일관화.
// 사양: docs/design_system_v4_consolidated.md §2

import type { ReactNode } from 'react';

export type HeadingLevel = 1 | 2 | 3;

export interface HeadingProps {
  /** h1 (페이지) · h2 (섹션) · h3 (서브섹션). 기본 2. */
  level?: HeadingLevel;
  /** 위쪽 eyebrow 라벨 (예: "무료 풀이"). */
  eyebrow?: string;
  /** 타이틀 문구. */
  title: string;
  /** 타이틀 아래 서술 (선택). */
  description?: string;
  /** 우측에 붙일 액션 요소 (예: 뱃지, 링크). */
  trailing?: ReactNode;
  className?: string;
}

const SIZE_MAP: Record<HeadingLevel, string> = {
  1: 'text-3xl leading-10',
  2: 'text-2xl leading-9',
  3: 'text-xl leading-8',
};

export function Heading({
  level = 2,
  eyebrow,
  title,
  description,
  trailing,
  className = '',
}: HeadingProps) {
  const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');
  return (
    <header className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <span className="block text-xs font-semibold text-gold-brown uppercase tracking-[0.12em]">
              {eyebrow}
            </span>
          ) : null}
          <Tag className={`mt-1 font-bold text-ink ${SIZE_MAP[level]}`}>{title}</Tag>
          {description ? (
            <p className="mt-2 text-sm text-gray-700 leading-[1.7]">{description}</p>
          ) : null}
        </div>
        {trailing ? <div className="flex-shrink-0">{trailing}</div> : null}
      </div>
    </header>
  );
}

export default Heading;
