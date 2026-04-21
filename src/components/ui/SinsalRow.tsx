// v4.1 공용 — 신살(神殺) 한 줄 카드.
// 한자 병기는 선택 (hover 또는 작은 회색 글씨).

export interface SinsalRowProps {
  /** 한글 이름 (예: "도화살"). */
  name: string;
  /** 괄호 한자 (예: "桃花"). 없어도 됨. */
  hanja?: string;
  /** 한 줄 풀이 (30~40자 권장). */
  short: string;
  className?: string;
}

export function SinsalRow({ name, hanja, short, className = '' }: SinsalRowProps) {
  return (
    <li
      className={`flex items-baseline gap-3 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0 ${className}`}
    >
      <span className="flex items-baseline gap-1 min-w-[84px]">
        <span className="text-base font-semibold text-ink">{name}</span>
        {hanja ? <span className="text-xs text-gray-500">({hanja})</span> : null}
      </span>
      <span className="text-sm text-gray-700 leading-6">{short}</span>
    </li>
  );
}

export default SinsalRow;
