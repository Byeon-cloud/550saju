import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  transparent?: boolean;
}

export function Header({ title, showBack = true, right, transparent = false }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={`sticky top-0 z-20 flex items-center h-12 px-4 transition-all ${
        transparent
          ? 'bg-transparent'
          : 'bg-white/70 backdrop-blur-2xl border-b border-brand-border-light'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center -ml-2 text-brand-text-secondary hover:text-brand-text transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : <div className="w-10" />}
      {title && (
        <h1 className="flex-1 text-center text-[15px] font-bold text-brand-text truncate">{title}</h1>
      )}
      {right ? (
        <div className="w-10 flex items-center justify-end">{right}</div>
      ) : <div className="w-10" />}
    </header>
  );
}
