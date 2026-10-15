import { Component, type ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 앱 전체 에러 바운더리
 * 렌더링 에러 발생 시 크래시 대신 안내 화면
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    // 청크 로드 실패가 여기까지 도달한 경우(lazyWithReload 미경유 경로) — 화이트/에러 대신 1회 자동 리로드.
    //   배포로 옛 청크가 사라졌을 때 새 index.html(no-cache)을 다시 받으면 정상화. 세션당 1회로 루프 방지.
    const msg = String(error?.message || '') + ' ' + String((error as { name?: string })?.name || '');
    const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\d]+ failed|dynamically imported module/i.test(msg);
    // 진단 비콘 — 어떤 에러가 화면을 깨는지 실데이터로 파악(추측 종결). fire-and-forget.
    import('@/services/analytics')
      .then(({ trackEvent }) => trackEvent('client_error', { msg: msg.slice(0, 120), chunk: isChunkError ? 1 : 0, path: (typeof location !== 'undefined' ? location.pathname : '') }))
      .catch(() => { /* noop */ });
    if (isChunkError) {
      try {
        if (!sessionStorage.getItem('saju500:chunk_reloaded')) {
          sessionStorage.setItem('saju500:chunk_reloaded', '1');
          window.location.reload();
        }
      } catch { /* sessionStorage 불가 — 아래 안내 UI 로 폴백 */ }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg-page-gradient)' }}>
          <div className="w-16 h-16 rounded-2xl bg-func-danger/10 flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B04A38" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-h2 text-text-primary mb-2">화면을 여는 중에 문제가 생겼어요</h2>
          <p className="text-body-sm text-text-muted mb-6">홈에서 다시 열어 주세요.</p>
          {/* ErrorBoundary 는 클래스 컴포넌트 (Hook 불가) — React state corrupt 가능성 → 의도적 풀 리로드 */}
          {/* 2026-10-15 — 디버그용 원본 오류 문구 노출 제거 (영문 기술 문구가 사용자에게 보였다). 원문은 componentDidCatch 로그로 */}
          <Button onClick={() => window.location.assign('/')}>홈으로 돌아가기</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
