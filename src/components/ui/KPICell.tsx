// v4.1 공용 — 히어로 신뢰 KPI 셀. 숫자/라벨 2줄.

export interface KPICellProps {
  /** 큰 숫자/값 (예: "1.5%", "2,800자"). */
  value: string;
  /** 아래 설명 라벨. */
  label: string;
  className?: string;
}

export function KPICell({ value, label, className = '' }: KPICellProps) {
  return (
    <div className={`text-center ${className}`}>
      <div className="text-2xl font-bold text-ink leading-tight">{value}</div>
      <div className="mt-1 text-xs text-gray-500 leading-5">{label}</div>
    </div>
  );
}

export default KPICell;
