import { Component, type ReactNode } from 'react';

interface FallbackSection { id?: string; title?: string; content?: string }
interface Props { children: ReactNode; fallbackSections?: FallbackSection[] }
interface State { hasError: boolean }

/**
 * 결과 렌더 전용 에러 바운더리 (2026-06-24 · CS CRITICAL fix)
 *
 * 배경: 종합사주(프리미엄) 결과 렌더가 AI 응답의 '타입 어긋남'(SSE partial JSON 등 — `?.` 가 막지 못하는
 *   잘못된 타입)으로 sub-component 한 곳에서라도 throw 하면, 글로벌 ErrorBoundary 가 "오류 발생 → 홈으로"
 *   로 보내 **결제한 결과가 통째로 사라지고 환불도 없던** 치명적 CS ("결제했는데 결과 안 보임 + 앱이 제대로
 *   작동하지 않는다는 알림") 의 구조적 원인.
 *
 * 이 바운더리: 결과 렌더만 로컬 캐치 →
 *   (1) "결과는 안전하게 저장됨" 안내 (홈 강제이동 0 · 결제 유실 0)
 *   (2) 섹션 본문을 '글'로라도 보여줌 (유저는 결제한 풀이를 읽을 수 있음 — 화면 꾸미기만 실패)
 *   (3) 진짜 크래시 원인을 client_error 비콘으로 기록 (어떤 필드가 깨는지 실데이터 — 토스 트래킹 fix 후 가시화)
 */
export class ResultErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    try {
      // 진단 비콘 — 어떤 AI 필드가 결과 화면을 깨는지 실데이터로 파악 (추측 종결).
      import('@/services/analytics')
        .then(({ trackEvent }) => trackEvent('client_error', {
          msg: ('premium_render: ' + String(error?.message || '')).slice(0, 120),
          chunk: 0,
          path: (typeof location !== 'undefined' ? location.pathname : ''),
        }))
        .catch(() => { /* noop */ });
    } catch { /* noop */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // 섹션 본문을 평문으로 추출 (HTML 태그 제거 — 폴백은 가독성 우선)
    const secs = (this.props.fallbackSections || [])
      .filter((s) => s && (s.title || s.content))
      .map((s) => ({
        title: String(s.title || '').replace(/<[^>]*>/g, '').trim(),
        body: String(s.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      }))
      .filter((s) => s.title || s.body);

    return (
      <div style={{ padding: '20px 18px' }}>
        <div style={{ background: '#FFF8E8', border: '1px solid #E8D9B5', borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#5C4A2E', marginBottom: 4 }}>결과는 안전하게 저장돼 있어요</div>
          <div style={{ fontSize: 13.5, color: '#8C6D3D', lineHeight: 1.6 }}>
            화면을 꾸미는 중 일부 문제가 생겨, 우선 풀이를 글로 보여드려요. 결제하신 운은 그대로예요.
          </div>
        </div>

        {secs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {secs.map((s, i) => (
              <div key={i}>
                {s.title && (
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#1A1A1A', marginBottom: 7 }}>{s.title}</div>
                )}
                {s.body && (
                  <div style={{ fontSize: 13, color: '#3A3A3A', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{s.body}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#8C6D3D', textAlign: 'center', padding: '28px 0' }}>
            잠시 후 다시 시도하면 결과를 다시 불러올 수 있어요.
          </div>
        )}

        <button
          type="button"
          onClick={() => { try { window.location.reload(); } catch { /* noop */ } }}
          style={{ marginTop: 22, width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: '#B8965A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          다시 불러오기
        </button>
      </div>
    );
  }
}
