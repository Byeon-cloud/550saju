/**
 * 홈 화면 앱 전용 뒤로 버튼 (2026-10-23)
 *
 *   홈 화면에 추가한 사주500(홈 화면 앱)에는 브라우저 뒤로 버튼이 없다. 탭 바를 숨기는 화면(주제운 등)에서
 *   머리에 뒤로 버튼이 없으면 갇힌다. 웹 브라우저에서는 그리지 않아 보이는 모습이 그대로다.
 *   토스 앱 안은 토스 내비 바에 뒤로가 있어 숨긴다(hasNativeNavBack — 중복 뒤로 버튼은 토스 심사 반려 전례).
 */
import { useNavigate } from 'react-router-dom';
import { hasNativeNavBack } from '@/lib/env';
import { isStandaloneDisplay } from '@/lib/displayMode';

/** 지금 화면에 이 버튼이 보이나 (머리 배치를 맞출 때) */
export const standaloneBackVisible = (): boolean => !hasNativeNavBack && isStandaloneDisplay();

export function StandaloneBackButton({ onInk = false, style }: { onInk?: boolean; style?: React.CSSProperties }) {
  const navigate = useNavigate();
  if (!standaloneBackVisible()) return null;
  const goBack = () => {
    // 홈 화면 앱을 이 화면에서 바로 열었으면 돌아갈 곳이 없다 → 홈으로 (react-router 가 history.state.idx 에 순번을 둔다)
    const idx = Number((window.history.state as { idx?: number } | null)?.idx || 0);
    if (idx > 0) navigate(-1);
    else navigate('/', { replace: true });
  };
  const color = onInk ? '#F5EDDF' : '#1A1612';
  return (
    <button type="button" onClick={goBack} aria-label="뒤로"
      style={{ width: 44, height: 44, marginLeft: -10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, cursor: 'pointer', flexShrink: 0, ...style }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}
