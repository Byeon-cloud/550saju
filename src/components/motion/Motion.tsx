/**
 * 움직임 부품 (2026-10-18) — 규칙과 모양은 src/styles/motion.css, 기획은 docs/design/2026-10-18_움직임_기획.md
 *
 *   MotionScope  화면 아래쪽 칸은 보일 때 움직이게 (.mo-on). 관찰을 못 하면 바로 켠다(내용은 늘 보임).
 *   useCountUp   점수 숫자가 0에서 차오른다. 숨은 탭에서 rAF 가 멈춰도 1.2초 뒤엔 최종값으로 맞춘다.
 *   moVars       --i, --d 같은 CSS 변수를 style 로 넘기는 도우미.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function moVars(v: { i?: number; d?: number; to?: string; n?: number }): CSSProperties {
  const s: Record<string, string | number> = {};
  if (v.i != null) s['--i'] = v.i;
  if (v.d != null) s['--d'] = `${v.d}ms`;
  if (v.n != null) s['--n'] = v.n;
  if (v.to) s['--mo-to'] = v.to;
  return s as CSSProperties;
}

export function MotionScope({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`mo-scope${on ? ' mo-on' : ''} ${className}`} style={style}>{children}</div>;
}

/** 0 → target 으로 차오르는 숫자. 처음 그릴 때와 target 이 바뀔 때 한 번 */
export function useCountUp(target: number, ms = 750): number {
  const [v, setV] = useState(() => (reduced() ? target : 0));
  useEffect(() => {
    if (reduced() || !Number.isFinite(target)) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const safety = setTimeout(() => { cancelAnimationFrame(raf); setV(target); }, ms + 450);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [target, ms]);
  return v;
}
