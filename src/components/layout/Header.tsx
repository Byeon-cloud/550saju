import { useNavigate } from 'react-router-dom';
import { IconBack } from '@/components/brand/Icons';
import { hasNativeNavBack } from '@/lib/env';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

/**
 * 앱인토스 = 토스 내비바에 뒤로가기가 항상 있음 → 자체 뒤로가기는 **강제로** 숨긴다.
 * 판정 SSOT: env.ts `hasNativeNavBack` (빌드 타깃 · TossApp UA · intoss:// · meta 태그).
 * `showBack` 을 명시로 true 넘겨도 앱인토스에선 안 뜬다 (2026-09-16 토스 심사 반려 대응).
 */
export function Header({ title, showBack: showBackProp = true, right }: HeaderProps) {
  const navigate = useNavigate();
  const showBack = showBackProp && !hasNativeNavBack;

  return (
    <header
      className="sticky top-0 z-20 flex items-center h-header px-4 bg-white/90 backdrop-blur-xl border-b border-border-light"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          className="w-11 h-11 flex items-center justify-center -ml-2 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="뒤로가기"
        >
          <IconBack size={20} />
        </button>
      ) : <div className="w-11" />}
      {title && (
        <h1 className="flex-1 text-center text-h2 text-text-primary truncate">{title}</h1>
      )}
      {right ? (
        <div className="w-11 h-11 flex items-center justify-end">{right}</div>
      ) : <div className="w-11" />}
    </header>
  );
}
