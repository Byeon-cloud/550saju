/**
 * AILoading — Tier B (3~10초) 섹션 점진 노출 디자인
 *
 * 변경 (Stage 7e-9):
 *   - 단순 progress 회전 → 섹션 카드 점진 ✓ 패턴
 *   - 사용자가 "분석 진행 단계" 를 시각적으로 추적 가능
 *   - 마지막 섹션은 스켈레톤 유지 (도착 직전 느낌)
 *
 * 실제 streaming X — 시각 효과만 (Sonnet 단일 응답이라).
 * 7개 컨텐츠 (오늘운세/대운/월운/궁합/토정/꿈/주제) 공통 사용.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SajuData } from '@/types/saju';
import { LOADING_TIPS } from '@/constants/loadingTips';

// 2026-05-05 SSOT 통합 — LoadingPage 와 같은 풀 (`src/constants/loadingTips.ts`) 소비
const TIPS = LOADING_TIPS;

/** 2026-05-04 mockup A "사주 미니카드" 진본 패턴 — 진입 즉시 사주 8자 노출 (데이터는 도착·AI 가 풀이 추가 중) */
export interface AILoadingPillar {
  label: '시' | '일' | '월' | '년';
  gan: string;
  ji: string;
}

interface Props {
  name?: string;
  type?: string;
  /** 섹션 라벨 배열 (Tier B 점진 ✓) — 4~5개 권장 */
  steps?: string[];
  premiumNote?: string;
  estimatedSeconds?: number;
  /**
   * 사주 데이터 (선택) — 전달되면 mockup A 다크 베이지 미니카드를 진입 즉시 표시
   * "내 사주 데이터는 이미 도착했고, 풀이가 추가되는 중" 시각적 약속
   * 호출처는 selected.sajuData 그대로 넘기면 됨 (내부에서 [시,일,월,년] 변환)
   */
  sajuData?: SajuData;
  /**
   * Streaming progress (2026-05-06) — 서버 SSE chunk 도달 시 정직한 progress.
   * 전달되면 timer 기반 단계 진행 X, chunk 기반 동적 progress 사용.
   */
  streamProgress?: { chunks: number; chars: number; elapsedMs: number } | null;
}

const C = {
  paper: '#F8F5EE',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.10)',
  goldLine: 'rgba(184,150,90,0.40)',
  positive: '#4E7A57',
  line: '#E5DFD0',
} as const;

export function AILoading({
  name = '',
  type = '분석',
  steps,
  premiumNote,
  estimatedSeconds = 12,
  sajuData,
  streamProgress,
}: Props) {
  // SajuData (year·month·day·time) → mockup 표기 순서 (시·일·월·년) 변환
  const pillars: AILoadingPillar[] | null = useMemo(() => {
    if (!sajuData?.pillars || sajuData.pillars.length < 4) return null;
    const [y, m, d, t] = sajuData.pillars;
    if (!t?.available) {
      // 시주 미입력 — 시 자리는 "?"
      return [
        { label: '시', gan: '?', ji: '?' },
        { label: '일', gan: d.천간, ji: d.지지 },
        { label: '월', gan: m.천간, ji: m.지지 },
        { label: '년', gan: y.천간, ji: y.지지 },
      ];
    }
    return [
      { label: '시', gan: t.천간, ji: t.지지 },
      { label: '일', gan: d.천간, ji: d.지지 },
      { label: '월', gan: m.천간, ji: m.지지 },
      { label: '년', gan: y.천간, ji: y.지지 },
    ];
  }, [sajuData]);
  const iljuLabel = useMemo(() => {
    if (!sajuData?.pillars?.[2]) return undefined;
    const day = sajuData.pillars[2];
    return `${day.천간읽기 ?? ''}${day.지지읽기 ?? ''}(${day.천간}${day.지지}) 일주`;
  }, [sajuData]);
  const [tipIndex, setTipIndex] = useState(0);
  const [doneCount, setDoneCount] = useState(0); // 완료된 섹션 수
  const [elapsed, setElapsed] = useState(0);

  const sections = steps && steps.length > 0
    ? steps
    : ['사주 데이터 분석', '오행 흐름 읽기', '맞춤 해석 작성', '결과 정리'];

  // 랜덤 셔플 팁
  const shuffledTips = useMemo(() => {
    const arr = [...TIPS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  useEffect(() => {
    const tipTimer = setInterval(() => setTipIndex(i => (i + 1) % shuffledTips.length), 4000);
    const clockTimer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => {
      clearInterval(tipTimer);
      clearInterval(clockTimer);
    };
  }, [shuffledTips.length]);

  // Streaming progress 기반 단계 진행 (2026-05-06)
  // streamProgress 있으면 chunk 기반 정직한 흐름, 없으면 timer 기반 fallback
  useEffect(() => {
    if (streamProgress) {
      // chunk 기반 — chars 가 일정 비율 도달 시 단계 완료
      // 7000 max_tokens 기준 평균 4000자 응답 추정 → chars 가 (sections.length+1) 단계로 분배
      const expectedChars = 4000;
      const ratio = Math.min(1, streamProgress.chars / expectedChars);
      const newDone = Math.min(sections.length - 1, Math.floor(ratio * sections.length));
      setDoneCount(newDone);
      return;
    }
    // streamProgress 없을 때 — timer 기반 fallback (callable 호출 등)
    const sectionInterval = Math.max(1500, (estimatedSeconds * 1000) / Math.max(1, sections.length));
    const sectionTimer = setInterval(
      () => setDoneCount(d => Math.min(d + 1, sections.length - 1)),
      sectionInterval,
    );
    return () => clearInterval(sectionTimer);
  }, [estimatedSeconds, sections.length, streamProgress]);

  const currentTip = shuffledTips[tipIndex];
  // overallProgress — streaming 일 땐 chars 비율 직접 사용, 아니면 doneCount 기반
  // 2026-10-09 — timer 모드는 경과 시간으로도 계속 차오르게 (단계가 다 찬 뒤 링이 멈춰 '멈춘 것 같은' 구간 제거).
  //   estimatedSeconds 시점 ~80% · 1.5배 ~88% · 2배 ~92% · 95% 상한.
  const timeProgress = 15 + 80 * (1 - Math.exp(-elapsed / Math.max(8, estimatedSeconds * 0.6)));
  const overallProgress = streamProgress
    ? Math.min(95, (streamProgress.chars / 4000) * 80 + 15)
    : Math.min(95, Math.max((doneCount / sections.length) * 100 + 15, timeProgress));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center px-6 pt-12 pb-10 overflow-y-auto"
      style={{ background: 'var(--bg-page-gradient)' }}
    >
      {/* 헤더 — name + type */}
      <div className="text-center mb-5">
        <p style={{ fontSize: 13, color: C.mute, marginBottom: 4 }}>
          풀이를 쓰는 중
        </p>
        <p
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 18,
            fontWeight: 800,
            color: C.ink,
            letterSpacing: '-0.005em',
          }}
        >
          {name ? `${name} 님의 ` : ''}
          <span style={{ color: C.goldDeep }}>{type}</span> 준비 중
        </p>
      </div>

      {/* mockup A "사주 미니카드" 진본 — 진입 즉시 사주 8자 노출 (데이터 도착 시각적 약속) */}
      {pillars && pillars.length === 4 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[340px] mb-5 rounded-2xl"
          style={{
            background: 'linear-gradient(180deg, #1A1612 0%, #0F0C09 100%)',
            color: '#F8F5EE',
            padding: '14px 16px',
          }}
        >
          {iljuLabel && (
            <>
              <div
                style={{
                  fontSize: 13,
                  letterSpacing: '0.1em',
                  color: 'rgba(248,245,238,0.55)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {name ? `${name} 님 사주` : '내 사주'}
              </div>
              <div
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 13,
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {iljuLabel}
              </div>
            </>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              marginTop: iljuLabel ? 10 : 0,
            }}
          >
            {pillars.map((p) => (
              <div
                key={p.label}
                style={{
                  background: 'rgba(248,245,238,0.06)',
                  borderRadius: 10,
                  padding: '8px 4px',
                  textAlign: 'center',
                  border: '1px solid rgba(232,217,184,0.18)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(248,245,238,0.55)',
                    fontWeight: 700,
                  }}
                >
                  {p.label}
                </div>
                <div
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#E8D9B8',
                    margin: '2px 0',
                  }}
                >
                  {p.gan}
                </div>
                <div
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#c9bda0',
                  }}
                >
                  {p.ji}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 태극 원형 — 진행 progress */}
      <motion.div
        className="w-16 h-16 mb-6 relative"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="36" stroke={C.gold} strokeWidth="2" opacity="0.18" />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke={C.goldDeep}
            strokeWidth="2.5"
            strokeDasharray="226"
            strokeDashoffset={226 - (226 * overallProgress) / 100}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            transform="rotate(-90 40 40)"
          />
          <circle cx="40" cy="22" r="5" fill={C.gold} />
          <circle cx="40" cy="58" r="5" fill="#1A1612" />
        </svg>
      </motion.div>

      {/* Tier B 핵심 — 섹션 점진 카드 */}
      <div
        className="w-full max-w-[340px] mb-6 rounded-2xl"
        style={{
          background: C.surface,
          border: `1px solid ${C.goldLine}`,
          padding: '14px 16px',
          boxShadow: '0 4px 16px rgba(184,150,90,0.10)',
        }}
      >
        {sections.map((label, i) => {
          const isDone = i < doneCount;
          const isActive = i === doneCount;
          const isWaiting = i > doneCount;
          return (
            <motion.div
              key={`${label}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: i < sections.length - 1 ? `1px dotted ${C.line}` : 'none',
              }}
            >
              {/* 좌측 상태 마커 */}
              <div
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isDone ? C.positive : isActive ? C.goldSoft : '#F5F0E8',
                  border: `1.5px solid ${isDone ? C.positive : isActive ? C.gold : C.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isActive ? (
                  <motion.div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: C.gold,
                    }}
                    animate={{ scale: [0.6, 1.0, 0.6], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : null}
              </div>
              {/* 라벨 + 진행률 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: isActive ? 800 : isDone ? 600 : 500,
                    color: isWaiting ? C.mute : C.ink,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {label}
                </div>
                {/* 활성 섹션 — 진행 바 (가짜 streaming 시각) */}
                {isActive && (
                  <div
                    style={{
                      marginTop: 4,
                      height: 3,
                      background: 'rgba(184,150,90,0.12)',
                      borderRadius: 0, // 2026-10-13 v9 — 둥근 진행바 금지
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      style={{
                        height: '100%',
                        background: C.goldDeep,
                        borderRadius: 0,
                      }}
                      animate={{ width: ['10%', '85%', '60%', '90%'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                )}
                {/* 대기 섹션 — 스켈레톤 */}
                {isWaiting && (
                  <div
                    style={{
                      marginTop: 4,
                      height: 3,
                      background: 'rgba(0,0,0,0.04)',
                      borderRadius: 0,
                    }}
                  />
                )}
                {/* 완료 섹션 — 도착 표시 */}
                {isDone && (
                  <div
                    style={{
                      fontSize: 13,
                      color: C.positive,
                      fontWeight: 600,
                      marginTop: 2,
                      letterSpacing: '0.04em',
                    }}
                  >
                    완료
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 카테고리별 팁 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          className="text-center px-5 py-3 rounded-2xl max-w-[320px]"
          style={{
            background: C.goldSoft,
            border: `1px solid rgba(184,150,90,0.18)`,
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <p
            style={{
              fontSize: 13,
              color: C.goldDeep,
              fontWeight: 800,
              letterSpacing: '0.16em',
              marginBottom: 4,
            }}
          >
            {currentTip.category}
          </p>
          <p style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.6 }}>{currentTip.text}</p>
        </motion.div>
      </AnimatePresence>

      {/* 프리미엄 안내 */}
      {premiumNote && (() => {
        const notes = premiumNote.split('|');
        const noteIdx = Math.floor(elapsed / 5) % notes.length;
        return (
          <AnimatePresence mode="wait">
            <motion.p
              key={noteIdx}
              className="text-[13px] text-center leading-relaxed mt-3 px-4 max-w-[280px]"
              style={{ color: C.goldDeep, fontStyle: 'normal' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              {notes[noteIdx]}
            </motion.p>
          </AnimatePresence>
        );
      })()}

      {/* 예상 소요 시간 */}
      <p
        style={{
          fontSize: 13,
          color: C.mute,
          marginTop: 12,
          letterSpacing: '0.04em',
        }}
      >
        {/* 시간 약속 워딩 제거 (2026-05-06) — 못 지키면 안 좋아. 대신 진행 상태 텍스트 */}
        {!streamProgress && estimatedSeconds >= 40 && elapsed > estimatedSeconds
          ? '마지막까지 꼼꼼히 다듬고 있어요'
          : elapsed > 30
          ? '꼼꼼히 풀이하고 있어요'
          : elapsed > 10
            ? '사주를 깊게 살펴보고 있어요'
            : '잠시만 기다려주세요'}
      </p>
    </div>
  );
}
