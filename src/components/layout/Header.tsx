import { useNavigate } from 'react-router-dom';
import { IconBack } from '@/components/brand/Icons';
import { isAppintosBuild } from '@/lib/env';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

/**
 * 앱인토스 환경 감지 (2026-04-21 P0-C · env.ts 통합):
 * - `isAppintosBuild` — VITE_BUILD_TARGET=appintos 또는 InTossApp UA
 * - legacy: TossApp UA · intoss:// 스킴 · `<meta name="apps-in-toss">` 태그
 * 셋 중 하나라도 true 면 네이티브 뒤로가기가 있다고 판단, showBack=false.
 */
const IS_APPS_IN_TOSS = isAppintosBuild || (typeof navigator !== 'undefined' && (
  navigator.userAgent.includes('TossApp') ||
  window.location.href.includes('intoss://') ||
  !!document.querySelector('meta[name="apps-in-toss"]')
));

export function Header({ title, showBack = !IS_APPS_IN_TOSS, right }: HeaderProps) {
  const navigate = useNavigate();

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
