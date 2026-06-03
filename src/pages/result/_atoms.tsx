// Phase A (#54) — extracted from ResultPage.tsx (lines 729-925)
// Atoms: useLocalInView, AnimNum, LocalFadeIn, ScoreRing, PillarCard
// 0 behavior change vs original

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as React from 'react';
import { EC, type V4Pillar } from './_data';

// ─── Utility sub-components ───

export function useLocalInView(threshold = 0.15): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, visible];
}

export function AnimNum({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const [ref, vis] = useLocalInView(0.3);
  const ran = useRef(false);
  useEffect(() => {
    if (!vis || ran.current) return;
    ran.current = true;
    const t0 = performance.now();
    const go = (now: number) => {
      const p = Math.min((now - t0) / 1200, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(go);
    };
    requestAnimationFrame(go);
  }, [vis, target]);
  return <span ref={ref}>{val}</span>;
}

export function LocalFadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [ref, v] = useLocalInView(0.1);
  return (
    <div
      ref={ref}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? 'translateY(0)' : 'translateY(20px)',
        transition: `all 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── ScoreRing ───
export function ScoreRing({ label, score, color, delay = 0, topicId }: {
  label: string; score: number; color: string; delay?: number; topicId?: string;
}) {
  const [ref, v] = useLocalInView(0.3);
  const r = 32;
  const c = 2 * Math.PI * r;
  const navigate = useNavigate();
  return (
    <div ref={ref} className="flex flex-col items-center gap-1"
      onClick={topicId ? () => navigate(`/topic/${topicId}`, { state: { baseScore: score } }) : undefined}
      style={topicId ? { cursor: 'pointer' } : {}}>
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f0ebe3" strokeWidth="4.5" />
          <circle
            cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="4.5"
            strokeLinecap="round" strokeDasharray={c}
            strokeDashoffset={v ? c * (1 - score / 100) : c}
            style={{ transition: `stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) ${delay}ms` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold" style={{ color, fontSize: 16 }}>
            {v ? <AnimNum target={score} /> : 0}
          </span>
        </div>
      </div>
      <span style={{ color: '#8b7e6f', fontSize: 11 }}>{label}</span>
      {topicId && <span style={{ color, fontSize: 9, fontWeight: 700, marginTop: -2 }}>심층분석 →</span>}
    </div>
  );
}

// ─── PillarCard ───
export function PillarCard({ p, index, total }: { p: V4Pillar; index: number; total: number }) {
  if (p.empty) {
    return (
      <div
        className="relative flex flex-col items-center rounded-2xl overflow-hidden"
        style={{
          animation: `cardReveal 0.8s ease ${index * 180}ms both`,
          border: '2px dashed #d4ccc0',
          background: '#faf7f2',
        }}
      >
        <div className="w-full pt-6 pb-2 px-2 text-center">
          <div style={{ fontSize: 11, color: '#a0937f', fontWeight: 600 }}>
            {p.label} <span style={{ color: '#c9b99a' }}>{p.sub}</span>
          </div>
          <div style={{ fontSize: 10, color: '#c9b99a', marginBottom: 8 }}>{p.desc}</div>
          <div style={{ fontSize: 28, color: '#d4ccc0', fontWeight: 900 }}>?</div>
          <div style={{ fontSize: 10, color: '#c9b99a', marginTop: 4 }}>미입력</div>
        </div>
        <div className="w-full h-px" style={{ background: '#e8e0d4' }} />
        <div className="w-full py-2 px-2 text-center">
          <div style={{ fontSize: 28, color: '#d4ccc0', fontWeight: 900 }}>?</div>
          <div style={{ fontSize: 10, color: '#c9b99a', marginTop: 4 }}>미입력</div>
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(250,247,242,0.6)' }}
        >
          <div className="text-center px-2">
            <div style={{ fontSize: 14, fontWeight: 900, color: '#a0937f' }}>時</div>
            <div style={{ fontSize: 9, color: '#a0937f', marginTop: 4, lineHeight: 1.4, fontWeight: 600 }}>
              출생시간<br />미입력
            </div>
          </div>
        </div>
      </div>
    );
  }

  const gc = EC[p.gE];
  const jc = EC[p.jE];
  const isNarrow = total === 4;
  const hanjaSize = isNarrow ? 34 : 42;

  return (
    <div
      className="relative flex flex-col items-center rounded-2xl overflow-hidden"
      style={{
        animation: `cardReveal 0.8s ease ${index * 180}ms both`,
        background: p.isMe ? 'linear-gradient(180deg, #1B2A4A, #243656)' : '#FFFFFF',
        border: p.isMe ? '2px solid #B8965A' : '1px solid #E2E5EC',
        boxShadow: p.isMe ? '0 4px 20px rgba(184,150,90,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* 오행 색상 띠 (나 제외) — 직관적 오행 구분 */}
      {!p.isMe && (
        <div className="w-full h-[4px]" style={{ background: gc.main }} />
      )}

      {/* 기둥 라벨 */}
      <div className="w-full pt-3 pb-1 px-2 text-center"
        style={{ background: p.isMe ? 'rgba(184,150,90,0.15)' : '#F8F9FB' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: p.isMe ? '#E8D5A8' : '#8892A4' }}>
          {p.label} {p.sub}
        </div>
        <div style={{ fontSize: 9, color: p.isMe ? 'rgba(255,255,255,0.4)' : '#A8B1C1' }}>{p.desc}</div>
        {p.isMe && (
          <div className="inline-block rounded-full mt-1 px-2 py-0.5"
            style={{ background: '#B8965A', fontSize: 9, fontWeight: 800, color: '#fff' }}>
            나
          </div>
        )}
      </div>

      {/* 천간 */}
      <div className="w-full py-3 px-2 text-center">
        <div style={{ fontSize: hanjaSize, fontWeight: 900, lineHeight: 1, color: p.isMe ? '#FFFFFF' : gc.dark }}>
          {p.gH}
        </div>
        <div className="flex items-center justify-center gap-1 mt-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: gc.main }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: p.isMe ? '#E8D5A8' : gc.main }}>{p.gKr} · {p.gM}</span>
        </div>
        <div className="inline-block rounded-full mt-1.5"
          style={{ padding: '2px 8px', background: p.isMe ? 'rgba(255,255,255,0.1)' : gc.main + '12', color: p.isMe ? '#E8D5A8' : gc.dark, fontSize: 10, fontWeight: 600 }}>
          {p.gSip}
        </div>
      </div>

      {/* 구분선 */}
      <div className="w-10 h-px mx-auto" style={{ background: p.isMe ? 'rgba(184,150,90,0.3)' : '#E2E5EC' }} />

      {/* 지지 */}
      <div className="w-full py-3 px-2 text-center">
        <div style={{ fontSize: hanjaSize, fontWeight: 900, lineHeight: 1, color: p.isMe ? '#FFFFFF' : jc.dark }}>
          {p.jH}
        </div>
        <div className="flex items-center justify-center gap-1 mt-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: jc.main }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: p.isMe ? '#E8D5A8' : jc.main }}>{p.jKr} · {p.jM}</span>
        </div>
        <div className="inline-block rounded-full mt-1.5"
          style={{ padding: '2px 8px', background: p.isMe ? 'rgba(255,255,255,0.1)' : jc.main + '12', color: p.isMe ? '#E8D5A8' : jc.dark, fontSize: 10, fontWeight: 600 }}>
          {p.jSip}
        </div>
      </div>
    </div>
  );
}

