import { useNavigate } from 'react-router-dom';
import { IconBack } from '@/components/brand/Icons';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

/**
 * 앱인토스 환경 감지:
 * - 앱인토스 WebView에서는 토스가 네이티브 네비바(뒤로가기)를 제공
 * - 웹 배포 시에는 자체 뒤로가기 표시
 * - user-agent에 'TossApp'이 포함되거나 intoss:// 스킴으로 진입하면 앱인토스
 */
const IS_APPS_IN_TOSS = typeof navigator !== 'undefined' && (
  navigator.userAgent.includes('TossApp') ||
  window.location.href.includes('intoss://') ||
  !!document.querySelector('meta[name="apps-in-toss"]')
);

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
