import { useState, useRef } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { Pictogram, type PictogramKey } from '@/components/brand/PictogramRegistry';
import type { OhengType } from '@/types/saju';

export interface SymbolItem {
  id: string;
  /** 상징 텍스트 (예: '물') */
  keyword: string;
  /** 픽토그램 key (예: 'ui:water') */
  pictogram: PictogramKey;
  /** 정답 오행 */
  correctOheng: OhengType;
  /** 정답 리빌 시 표시될 해석 (200자 이상) */
  meaning: string;
}

interface SymbolDragMapProps {
  symbols: SymbolItem[];
  /** 5개 모두 배치 완료 시 콜백 */
  onComplete?: (userAnswers: Record<string, OhengType>, allCorrect: boolean) => void;
}

const OHENG_LIST: OhengType[] = ['목', '화', '토', '금', '수'];
const OHENG_COLORS: Record<OhengType, string> = {
  목: '#4E7A57',
  화: '#B04A38',
  토: '#B07F38',
  금: '#7D7870',
  수: '#3E5F82',
};

/**
 * IX-2 상징 × 오행 드래그 매핑.
 * 드래그 못 하는 환경(키보드·reduced-motion)에서는 **탭 모드 자동 폴백** — 상징 탭 후 오행 버튼 선택.
 */
export function SymbolDragMap({ symbols, onComplete }: SymbolDragMapProps) {
  const [userMap, setUserMap] = useState<Record<string, OhengType>>({});
  const [revealed, setRevealed] = useState(false);
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const slotRefs = useRef<Record<OhengType, HTMLDivElement | null>>({
    목: null, 화: null, 토: null, 금: null, 수: null,
  });

  const allPlaced = Object.keys(userMap).length === symbols.length;

  function assign(symbolId: string, oheng: OhengType) {
    const next = { ...userMap, [symbolId]: oheng };
    setUserMap(next);
    setSelectedSymbolId(null);
    if (Object.keys(next).length === symbols.length) {
      const allCorrect = symbols.every((s) => next[s.id] === s.correctOheng);
      onComplete?.(next, allCorrect);
    }
  }

  function handleDragEnd(symbolId: string, _: unknown, info: PanInfo) {
    // 가장 가까운 오행 슬롯 찾기
    const point = { x: info.point.x, y: info.point.y };
    let nearest: OhengType | null = null;
    let minDist = Infinity;
    for (const oh of OHENG_LIST) {
      const el = slotRefs.current[oh];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const d = Math.hypot(point.x - cx, point.y - cy);
      if (d < minDist && d < 100) {
        minDist = d;
        nearest = oh;
      }
    }
    if (nearest) assign(symbolId, nearest);
  }

  if (revealed) {
    return (
      <div className="card-primary">
        <p className="sec-meta" style={{ color: 'var(--brand-gold)' }}>AI는 이렇게 봤어요</p>
        <p className="sec-title" style={{ marginBottom: 12 }}>꿈 속 핵심 상징 5가지</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {symbols.map((s) => {
            const correct = userMap[s.id] === s.correctOheng;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  background: 'var(--bg-card)',
                  borderRadius: 12,
                  border: `0.5px solid ${correct ? '#4E7A5733' : '#A23A2A33'}`,
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${OHENG_COLORS[s.correctOheng]}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Pictogram k={s.pictogram} size={20} color={OHENG_COLORS[s.correctOheng]} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{s.keyword}</span>
                    <span
                      style={{
                        fontSize: 13, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: `${OHENG_COLORS[s.correctOheng]}15`,
                        color: OHENG_COLORS[s.correctOheng],
                      }}
                    >
                      {s.correctOheng}({s.correctOheng === '목' ? '木' : s.correctOheng === '화' ? '火' : s.correctOheng === '토' ? '土' : s.correctOheng === '금' ? '金' : '水'})
                    </span>
                    {correct ? (
                      <span style={{ fontSize: 13, color: '#4E7A57', fontWeight: 700 }}>맞음</span>
                    ) : (
                      <span style={{ fontSize: 13, color: '#6F6557', fontWeight: 700 }}>
                        (선택: {userMap[s.id]})
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                    {s.meaning}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="card-primary">
      <p className="sec-title" style={{ marginBottom: 4 }}>꿈 속 핵심 상징</p>
      <p className="sec-caption" style={{ marginBottom: 16 }}>
        {selectedSymbolId
          ? '어떤 오행에 연결되는지 선택해 주세요'
          : '5가지 상징을 오행에 연결해 주세요 (드래그 또는 탭)'}
      </p>

      {/* 상단 상징 영역 */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
          padding: '12px 0', marginBottom: 16,
        }}
      >
        {symbols.map((s) => {
          const placed = userMap[s.id];
          return (
            <motion.button
              key={s.id}
              drag={!placed}
              dragSnapToOrigin
              dragConstraints={{ top: -200, bottom: 200, left: -200, right: 200 }}
              onDragEnd={(e, info) => handleDragEnd(s.id, e, info)}
              whileTap={{ scale: 0.97 }}
              whileDrag={{ scale: 1.08, zIndex: 10 }}
              onClick={() => {
                if (placed) return;
                setSelectedSymbolId(selectedSymbolId === s.id ? null : s.id);
              }}
              style={{
                width: 64, height: 72, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                background: placed ? 'var(--bg-cream)' : '#FFFFFF',
                border: `1.5px solid ${placed ? `${OHENG_COLORS[placed]}66` : selectedSymbolId === s.id ? 'var(--brand-gold)' : 'var(--border-default)'}`,
                borderRadius: 12, cursor: placed ? 'default' : 'grab',
                opacity: placed ? 0.5 : 1,
              }}
              aria-label={`${s.keyword} ${placed ? `, ${placed}에 배치됨` : '탭하여 선택'}`}
            >
              <Pictogram k={s.pictogram} size={24} color={placed ? OHENG_COLORS[placed] : '#1A1612'} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{s.keyword}</span>
            </motion.button>
          );
        })}
      </div>

      {/* 하단 오행 슬롯 */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
        }}
      >
        {OHENG_LIST.map((oh) => {
          const count = Object.values(userMap).filter((v) => v === oh).length;
          return (
            <div
              key={oh}
              ref={(el) => { slotRefs.current[oh] = el; }}
              role={selectedSymbolId ? 'button' : undefined}
              tabIndex={selectedSymbolId ? 0 : -1}
              onClick={() => selectedSymbolId && assign(selectedSymbolId, oh)}
              onKeyDown={(e) => {
                if (selectedSymbolId && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  assign(selectedSymbolId, oh);
                }
              }}
              style={{
                padding: '12px 4px', textAlign: 'center', borderRadius: 10,
                background: `${OHENG_COLORS[oh]}10`,
                border: `1.5px ${selectedSymbolId ? 'dashed' : 'solid'} ${selectedSymbolId ? OHENG_COLORS[oh] : `${OHENG_COLORS[oh]}44`}`,
                cursor: selectedSymbolId ? 'pointer' : 'default',
                minHeight: 52,
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 800, color: OHENG_COLORS[oh] }}>{oh}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {count > 0 ? `${count}개` : '비어있음'}
              </p>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {allPlaced && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => setRevealed(true)}
            className="cta-gold"
            style={{ width: '100%', marginTop: 16 }}
          >
            해석 보기
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
