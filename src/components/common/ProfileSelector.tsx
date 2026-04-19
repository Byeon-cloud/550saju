import { useState, useMemo, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SajuProfile } from '@/services/storage/localStore';

interface ProfileSelectorProps {
  /** 저장된 프로필 전체 */
  profiles: SajuProfile[];
  /** 현재 선택 ID */
  selectedId: string | null;
  /** 선택 변경 */
  onChange: (id: string) => void;
  /** 새 사주 입력 이동 (e.g. navigate('/input?new=1')) */
  onCreateNew: () => void;
  /** 라벨 (기본 "누구의 운세를 볼까요") */
  title?: string;
}

/**
 * 프로필 선택 카드 (Daily / Dream 공용).
 *  - 0개: 입력 CTA만
 *  - 1개: 자동 선택 + 컴팩트 배지
 *  - 2+: 접혀있다가 탭하면 펼침 (다른 프로필 선택 + 새 사주 추가)
 */
export function ProfileSelector({
  profiles,
  selectedId,
  onChange,
  onCreateNew,
  title = '누구의 사주로 볼까요',
}: ProfileSelectorProps) {
  const [expanded, setExpanded] = useState(false);

  const selected = useMemo(
    () => profiles.find((p) => p.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  // 프로필 0개 — 입력 CTA만
  if (profiles.length === 0) {
    return (
      <div className="card-navy-v4">
        <p className="sec-title" style={{ color: '#F5EFE0' }}>
          아직 저장된 사주가 없어요
        </p>
        <p className="text-body-sm" style={{ color: 'rgba(245,239,224,0.7)', marginTop: 6 }}>
          생년월일만 있으면 1분. 무료입니다.
        </p>
        <button className="cta-gold" onClick={onCreateNew} style={{ marginTop: 12 }}>
          사주 무료 입력 →
        </button>
      </div>
    );
  }

  // 프로필 1개 — 컴팩트 배지 (다른 프로필 없으니 펼칠 필요 X)
  if (profiles.length === 1) {
    const p = profiles[0];
    return (
      <div
        className="card-primary"
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}
      >
        <Avatar name={p.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="sec-meta" style={{ color: 'var(--brand-gold)' }}>
            {p.relation === '본인' || !p.relation ? '내 사주' : p.relation}
          </p>
          <p className="sec-title" style={{ fontSize: 15 }}>{p.name}</p>
        </div>
        <button
          className="sec-caption"
          onClick={onCreateNew}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '6px 10px',
            borderRadius: 8,
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          + 새 사주
        </button>
      </div>
    );
  }

  // 프로필 2+ — 접힘/펼침
  function handleKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded((v) => !v);
    }
  }

  return (
    <div>
      {/* 헤더 (선택된 프로필 + 펼침 버튼) */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={handleKey}
        aria-expanded={expanded}
        aria-label={`${title} — 현재 ${selected?.name ?? '미선택'}`}
        className="card-primary w-full"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          textAlign: 'left',
          border: expanded ? '2px solid var(--brand-gold)' : '0.5px solid var(--border-default)',
          cursor: 'pointer',
        }}
      >
        {selected ? <Avatar name={selected.name} /> : <Avatar name="?" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="sec-meta" style={{ color: 'var(--brand-gold)' }}>
            {selected
              ? selected.relation === '본인' || !selected.relation
                ? '내 사주'
                : selected.relation
              : '선택해 주세요'}
          </p>
          <p className="sec-title" style={{ fontSize: 15 }}>
            {selected?.name ?? `저장된 프로필 ${profiles.length}개`}
          </p>
        </div>
        <span
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
          aria-hidden="true"
        >
          ▾
        </span>
      </motion.button>

      {/* 펼침 — 프로필 목록 + 새 사주 CTA */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {profiles.map((p) => {
                const isSelected = p.id === selectedId;
                return (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onChange(p.id);
                      setExpanded(false);
                    }}
                    className="card-primary w-full"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      textAlign: 'left',
                      border: isSelected
                        ? '1.5px solid var(--brand-gold)'
                        : '0.5px solid var(--border-default)',
                      background: isSelected ? 'var(--bg-cream)' : '#FFFFFF',
                    }}
                    aria-label={`${p.name}${isSelected ? ' 선택됨' : ' 선택하기'}`}
                  >
                    <Avatar name={p.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="sec-meta" style={{ color: 'var(--brand-gold)' }}>
                        {p.relation === '본인' || !p.relation ? '내 사주' : p.relation}
                      </p>
                      <p className="text-body-md" style={{ fontWeight: 700 }}>
                        {p.name}
                      </p>
                      <p className="sec-caption" style={{ fontSize: 11 }}>
                        {formatBirth(p.input)}
                      </p>
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 900,
                          color: 'var(--brand-gold)',
                        }}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    )}
                  </motion.button>
                );
              })}
              <button
                onClick={() => {
                  setExpanded(false);
                  onCreateNew();
                }}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: '1.5px dashed var(--border-default)',
                  background: 'transparent',
                  color: 'var(--brand-gold)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + 새 사주 입력
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        background: 'rgba(201,169,110,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--brand-gold)' }}>
        {(name?.charAt(0) ?? '?').slice(0, 1)}
      </span>
    </div>
  );
}

function formatBirth(input: any): string {
  if (!input) return '';
  const y = input.birthYear;
  const m = input.birthMonth;
  const d = input.birthDay;
  if (!y) return '';
  return `${y}.${String(m ?? 1).padStart(2, '0')}.${String(d ?? 1).padStart(2, '0')}`;
}
