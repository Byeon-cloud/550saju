/**
 * 개발 서버 전용 화면 점검 보조 (2026-10-13).
 * 자동 점검 창이 가려지면 브라우저가 requestAnimationFrame 을 멈춰 화면 전환 애니메이션이 끝나지 않는다.
 * localStorage '__qa_raf' = '1' 일 때만 rAF 를 타이머로 대신 돌린다. 배포 빌드에서는 import.meta.env.DEV 가 false 라 통째로 빠진다.
 * 반드시 main.tsx 의 첫 import 로 둔다(애니메이션 라이브러리가 rAF 를 붙잡기 전에 실행되어야 함).
 */
if (import.meta.env.DEV) {
  try {
    if (localStorage.getItem('__qa_raf') === '1') {
      const w = window as unknown as { requestAnimationFrame: unknown; cancelAnimationFrame: unknown };
      w.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16);
      w.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
    }
  } catch { /* 저장소 막힘 — 무시 */ }
}
export {};
