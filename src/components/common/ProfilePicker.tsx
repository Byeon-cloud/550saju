import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getProfiles, type SajuProfile } from '@/services/storage/localStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';

interface ProfilePickerProps {
  /** 선택 완료 시 콜백 — 선택된 프로필 전달 */
  onSelect: (profile: SajuProfile) => void;
  /** "새 사주 입력" 클릭 시 */
  onNew: () => void;
  /** 타이틀 */
  title?: string;
}

/**
 * 프로필 선택 컴포넌트
 * 저장된 프로필이 있으면 목록에서 선택
 * 없으면 새로 입력
 */
export function ProfilePicker({ onSelect, onNew, title = '누구의 사주를 볼까요?' }: ProfilePickerProps) {
  const profiles = useMemo(() => getProfiles(), []);

  if (profiles.length === 0) {
    // 분석한 사주가 없으면 바로 새 입력으로
    return null; // 부모에서 처리
  }

  return (
    <div className="space-y-4">
      <h2 className="text-display text-text-primary">{title}</h2>
      <p className="text-body-sm text-text-muted">이전에 분석한 사주를 선택하거나, 새로 입력할 수 있어요.</p>

      {/* 기존 프로필 목록 */}
      <div className="space-y-2">
        {profiles.map((p) => {
          const ilgan = p.sajuData.pillars[2]?.천간 || '';
          const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
          const relation = p.relation || p.input.relation || '본인';
          return (
            <motion.button
              key={p.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(p)}
              className="card w-full text-left py-4 px-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: relation === '본인' ? 'rgba(27,42,74,0.08)' : 'rgba(184,150,90,0.08)' }}>
                  <span className="text-h3 font-bold" style={{ color: relation === '본인' ? '#1B2A4A' : '#B8965A' }}>
                    {p.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-h3 text-text-primary">{p.name}</p>
                    <span className="text-[10px] text-text-hint">{relation}</span>
                  </div>
                  <p className="text-caption text-text-muted">
                    {p.input.birthYear}.{String(p.input.birthMonth).padStart(2,'0')}.{String(p.input.birthDay).padStart(2,'0')}
                    {ilgan ? ` · ${ilgan}(${oheng}) 일간` : ''}
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* 새 사주 입력 */}
      <button
        onClick={onNew}
        className="w-full card text-left py-4 px-4 border-2 border-dashed border-border"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-dashed border-text-hint">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div>
            <p className="text-h3 text-text-primary">새 사주 입력하기</p>
            <p className="text-caption text-text-muted">새로운 사람의 사주를 분석해요</p>
          </div>
        </div>
      </button>
    </div>
  );
}
