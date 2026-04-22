// Firebase Functions 공통 클라이언트
// 근거: 2026-04-22 준기 QA — emulator 죽어도 ChatPage/DailyFortune 결과 보이게.
//
// 정책:
//   1. .env.local 의 VITE_USE_FUNCTIONS_EMULATOR=true 일 때만 emulator 시도.
//   2. 그 경우에도 localhost:5001 ping (800ms) → 살아있으면 연결, 죽었으면 prod fallback.
//   3. prod 빌드 (import.meta.env.DEV === false) 에서는 무조건 prod Functions.
//   4. ping 결과는 모듈 내 Promise 로 1회만 캐싱 (재호출 비용 0).

import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { app } from '@/services/auth/firebase';

const REGION = 'us-central1';
const functions = getFunctions(app, REGION);

let _readyPromise: Promise<void> | null = null;

/**
 * 첫 호출 전 await 로 emulator 연결 가능 여부 확인.
 * - 플래그 OFF / prod 빌드: 즉시 resolve (prod Functions 사용)
 * - 플래그 ON + ping 성공: emulator 연결
 * - 플래그 ON + ping 실패: prod fallback + 콘솔 경고
 */
export function ensureFunctionsTarget(): Promise<void> {
  if (_readyPromise) return _readyPromise;
  _readyPromise = (async () => {
    const useEmulator =
      import.meta.env.DEV &&
      import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true';

    if (!useEmulator) return;

    // emulator 플래그 켜진 경우만 ping (no-cors 라 응답 type 은 opaque 이지만,
    // fetch 자체가 throw 안 하면 포트가 살아있다고 판단)
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 800);
      await fetch('http://localhost:5001/', {
        method: 'GET',
        mode: 'no-cors',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      connectFunctionsEmulator(functions, 'localhost', 5001);
      // eslint-disable-next-line no-console
      console.info('[functions] emulator connected → localhost:5001');
    } catch {
      // eslint-disable-next-line no-console
      console.warn(
        '[functions] emulator localhost:5001 unreachable — falling back to prod Functions'
      );
    }
  })();
  return _readyPromise;
}

export { functions };
