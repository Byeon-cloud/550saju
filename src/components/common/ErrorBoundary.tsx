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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-h2 text-text-primary mb-2">오류가 발생했습니다</h2>
          <p className="text-body-sm text-text-muted mb-2">잠시 후 다시 시도해주세요</p>
          {/* ErrorBoundary 는 클래스 컴포넌트 (Hook 불가) — React state corrupt 가능성 → 의도적 풀 리로드 */}
          {/* 2026-05-07 — 디버그용 에러 메시지 노출 (출시 후 제거) */}
          {this.state.error?.message && (
            <p className="text-tiny text-text-hint mb-6 max-w-[300px] break-all" style={{ fontFamily: 'monospace', fontSize: 10 }}>
              {String(this.state.error.message).slice(0, 200)}
            </p>
          )}
          {!this.state.error?.message && <div className="mb-6" />}
          <Button onClick={() => window.location.assign('/')}>홈으로 돌아가기</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
