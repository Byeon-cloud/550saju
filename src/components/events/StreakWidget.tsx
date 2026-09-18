// StreakWidget — 블록 2. 3일 연속 이동윈도우 도트 3칸.
// 스펙: 09_이벤트_v4.md §3 · 핸드오버 §1-C-7 block 2
//
// 2026-09-17 — 기기 장부(dailyReward.getAttendanceSnapshot) 기준으로 재작성.
//   구 동작: 서버 STUB streak 를 읽어 오늘 미출석인데 '오늘' 칸이 체크되고, 끊긴 연속에도
//   "내일까지 이어지면 운 1" 이 뜨고, 실제 운 1 을 받은 날엔 달성 표시가 안 나왔다.

import { useMemo } from 'react';
import type { AttendanceSnapshot } from '@/services/storage/dailyReward';

export interface StreakWidgetProps {
  /** 기기 출석 스냅샷 */
  snapshot: AttendanceSnapshot;
  /** 3일 달성(운 1 지급) 날 1.2s 펄스 — 부모가 true 1회 전달 시 강조 */
  pulsing?: boolean;
}

interface DotState {
  label: string;
  state: 'done' | 'today' | 'pending' | 'missed';
}

const dot = (label: string, state: DotState['state']): DotState => ({ label, state });

/** 이동윈도우 라벨 규칙 (v4 §3) — 3일 보상 사이클에서 채운 칸(streak3Filled) 기준:
 *  오늘 출석함   1칸: [오늘✓, 내일, 모레]  2칸: [어제✓, 오늘✓, 내일]  3칸: [그제✓, 어제✓, 오늘✓] (운 1 지급일)
 *  어제까지 이어짐 1칸: [어제✓, 오늘, 내일]  2칸: [그제✓, 어제✓, 오늘]  0칸: [오늘, 내일, 모레] (어제 3일째 달성 → 새 사이클)
 *  끊김: [어제✗, 오늘, 내일] · 기록 없음: [오늘, 내일, 모레]
 */
function computeDots(s: AttendanceSnapshot): DotState[] {
  const pos = s.streak3Filled;
  if (s.attendedToday) {
    if (pos <= 1) return [dot('오늘', 'done'), dot('내일', 'pending'), dot('모레', 'pending')];
    if (pos === 2) return [dot('어제', 'done'), dot('오늘', 'done'), dot('내일', 'pending')];
    return [dot('그제', 'done'), dot('어제', 'done'), dot('오늘', 'done')];
  }
  if (s.alive) {
    if (pos === 1) return [dot('어제', 'done'), dot('오늘', 'today'), dot('내일', 'pending')];
    if (pos === 2) return [dot('그제', 'done'), dot('어제', 'done'), dot('오늘', 'today')];
    return [dot('오늘', 'today'), dot('내일', 'pending'), dot('모레', 'pending')];
  }
  if (s.broken) return [dot('어제', 'missed'), dot('오늘', 'today'), dot('내일', 'pending')];
  return [dot('오늘', 'today'), dot('내일', 'pending'), dot('모레', 'pending')];
}

function statusCopy(s: AttendanceSnapshot): string {
  const pos = s.streak3Filled;
  if (s.attendedToday) {
    if (pos <= 1) return '이틀만 더 이어지면 운 1';
    if (pos === 2) return '내일까지 이어지면 운 1 받아요';
    return s.streak3PaidToday
      ? `${s.streak}일 연속 · 오늘 운 1 받았어요`
      : `${s.streak}일 연속 출석 중이에요`;
  }
  if (s.alive) {
    if (pos === 1) return '오늘 이어가면 내일 운 1 받을 수 있어요';
    if (pos === 2) return '오늘 결과 하나 보면 운 1 받아요';
    return '오늘 결과 하나 보면 다음 3일이 시작돼요';
  }
  if (s.broken) return '어제는 빠졌어요 · 오늘부터 다시 시작';
  return '오늘 결과 하나 보면 시작돼요';
}

export function StreakWidget({ snapshot, pulsing = false }: StreakWidgetProps) {
  const dots = useMemo(() => computeDots(snapshot), [snapshot]);
  const status = statusCopy(snapshot);

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
        {snapshot.streak > 0 ? (
          <span className="ml-auto text-[12px] font-semibold" style={{ color: '#8C6D3D' }}>
            {snapshot.streak}일 연속
          </span>
        ) : null}
      </header>
      <p className="text-[12px] mb-4" style={{ color: '#8A7F6E', lineHeight: 1.5 }}>
        3일 이어서 출석할 때마다 운 1. 하루 빠지면 처음부터 다시 세요.
      </p>

      {/* 도트 3칸 */}
      <div className="flex gap-2.5 mb-3 justify-center">
        {dots.map((d, idx) => (
          <DotCell key={idx} dot={d} pulsing={pulsing && d.state === 'done'} />
        ))}
      </div>

      <p className="text-[13px] text-center font-medium" style={{ color: '#9A7D47' }} aria-live="polite">
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
      <span className="text-[11px] font-medium"
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
