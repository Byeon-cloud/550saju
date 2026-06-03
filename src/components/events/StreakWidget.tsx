// StreakWidget — 블록 2. 3일 연속 이동윈도우 도트 3칸.
// 스펙: 09_이벤트_v4.md §3 · 핸드오버 §1-C-7 block 2

import { useMemo } from 'react';

export interface StreakWidgetProps {
  /** 0~3. 0=idle/리셋, 1=오늘 체크, 2=어제+오늘, 3=그제·어제·오늘 (달성). */
  streak: number;
  /** 어제 출석 있었는데 오늘 미체크 등 끊김 감지 플래그 */
  missedYesterday?: boolean;
  /** Day 3 달성 순간 1.2s 펄스 — 부모가 true 1회 전달 시 강조 */
  pulsing?: boolean;
}

interface DotState {
  label: string;
  state: 'done' | 'today' | 'pending' | 'missed';
}

/** 이동윈도우 라벨 규칙 (v4 §3):
 *  streak ∈ {0}: [오늘, 내일, 모레] — 모두 pending
 *  streak == 1: [오늘, 내일, 모레] — 오늘만 done
 *  streak == 2: [어제, 오늘, 내일] — 어제·오늘 done, 내일 pending
 *  streak == 3: [그제, 어제, 오늘] — 모두 done (달성 직후 0.8초 노출 후 리셋)
 */
function computeDots(streak: number, missedYesterday: boolean): DotState[] {
  if (missedYesterday && streak <= 1) {
    // 끊김: 어제 자리가 missed
    return [
      { label: '어제', state: 'missed' },
      { label: '오늘', state: streak >= 1 ? 'done' : 'today' },
      { label: '내일', state: 'pending' },
    ];
  }
  if (streak <= 1) {
    return [
      { label: '오늘', state: streak === 1 ? 'done' : 'today' },
      { label: '내일', state: 'pending' },
      { label: '모레', state: 'pending' },
    ];
  }
  if (streak === 2) {
    return [
      { label: '어제', state: 'done' },
      { label: '오늘', state: 'done' },
      { label: '내일', state: 'pending' },
    ];
  }
  // streak >= 3 (달성)
  return [
    { label: '그제', state: 'done' },
    { label: '어제', state: 'done' },
    { label: '오늘', state: 'done' },
  ];
}

function statusCopy(streak: number, missedYesterday: boolean): string {
  if (missedYesterday && streak <= 1) return '어제는 빠졌어요 · 오늘부터 다시 시작';
  if (streak === 0) return '오늘 결과 하나 보면 시작돼요';
  if (streak === 1) return '이틀만 더 이어지면 운 1';
  if (streak === 2) return '내일까지 이어지면 운 1 받아요';
  return '운 1 지급 완료 · 다시 이어가봐요';
}

export function StreakWidget({ streak, missedYesterday = false, pulsing = false }: StreakWidgetProps) {
  const dots = useMemo(() => computeDots(streak, missedYesterday), [streak, missedYesterday]);
  const status = statusCopy(streak, missedYesterday);

  return (
    <section
      className="mx-4 mt-4 rounded-2xl px-[18px] py-[18px]"
      style={{ background: '#FFFFFF', border: '1px solid #EDEAE0', boxShadow: '0 1px 2px rgba(47,42,35,0.04)' }}
    >
      <header className="flex items-center gap-2.5 mb-1">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="#B8965A" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <h3 className="text-[16px] font-bold" style={{ color: '#1D2D4A', fontFamily: "'Noto Serif KR', serif" }}>
          3일 연속 출석
        </h3>
      </header>
      <p className="text-[12px] mb-4" style={{ color: '#8A7F6E', lineHeight: 1.5 }}>
        3일 이어서 출석하면 운 1. 중간에 빠지면 리셋돼요.
      </p>

      {/* 도트 3칸 */}
      <div className="flex gap-2.5 mb-3 justify-center">
        {dots.map((dot, idx) => (
          <DotCell key={idx} dot={dot} pulsing={pulsing && dot.state === 'done'} />
        ))}
      </div>

      <p className="text-[13px] text-center font-medium" style={{ color: '#9A7D47' }}>
        {status}
      </p>
    </section>
  );
}

function DotCell({ dot, pulsing }: { dot: DotState; pulsing: boolean }) {
  const base = 'flex-1 max-w-[100px] h-[60px] rounded-xl flex flex-col items-center justify-center gap-1 transition-all';
  const style: React.CSSProperties =
    dot.state === 'done'
      ? { border: '2px solid #B8965A', background: '#B8965A', color: '#fff',
          boxShadow: pulsing ? '0 0 0 4px rgba(184,150,90,0.35)' : '0 2px 6px rgba(184,150,90,0.2)',
          animation: pulsing ? 'streak-pulse 1.2s ease-out 1' : 'none' }
      : dot.state === 'today'
        ? { border: '2px solid #9A7D47', background: '#F5EADB' }
        : dot.state === 'missed'
          ? { border: '2px solid #C0392B', background: '#FFFFFF', opacity: 0.55 }
          : { border: '2px dashed #E5DFD0', background: '#FFFFFF' };

  return (
    <div className={base} style={style}>
      <span className="text-[10px] font-medium"
        style={{ color: dot.state === 'done' ? '#fff' : dot.state === 'today' ? '#1D2D4A' : '#8A7F6E' }}>
        {dot.label}
      </span>
      {dot.state === 'done' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : dot.state === 'missed' ? (
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#C0392B' }} />
      ) : (
        <div className="w-1.5 h-1.5 rounded-full"
          style={{ background: dot.state === 'today' ? '#9A7D47' : '#E5DFD0' }} />
      )}
      <style>{`
        @keyframes streak-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(184,150,90,0.25); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default StreakWidget;
