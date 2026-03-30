import type { SinSal } from '@/types/saju';

interface SinsalCardProps {
  title: string;
  items: SinSal[];
  variant: 'gilsin' | 'hyungsal';
}

export function SinsalCard({ title, items, variant }: SinsalCardProps) {
  if (items.length === 0) return null;
  const isGood = variant === 'gilsin';

  return (
    <div className="rounded-[16px] p-4" style={{
      background: isGood ? 'var(--oheng-wood-bg)' : 'var(--oheng-fire-bg)',
      border: `1px solid ${isGood ? 'var(--oheng-wood-light)' : 'var(--oheng-fire-light)'}`,
    }}>
      <p className="text-[13px] font-bold mb-3" style={{ color: isGood ? 'var(--oheng-wood)' : 'var(--oheng-fire)' }}>
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: 'rgba(255,255,255,0.7)',
              color: isGood ? '#2B7A40' : '#C43C3C',
            }}>
            {item.이름}
          </span>
        ))}
      </div>
    </div>
  );
}
