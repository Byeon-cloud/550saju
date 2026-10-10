import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getProfiles, type SajuProfile } from '@/services/storage/localStore';
import { CHEONGAN_OHENG, OHENG_MAP } from '@/constants/oheng';
import { calculateSaju } from '@/services/saju/calculator';
import { formatBirthHourShort } from '@/utils/saju-format';

interface ProfilePickerProps {
  /** 선택 완료 시 콜백 — 선택된 프로필 전달 */
  onSelect: (profile: SajuProfile) => void;
  /** "새 사주 입력" 클릭 시 */
  onNew: () => void;
  /** 타이틀 */
  title?: string;
}

/**
 * 프로필 선택 컴포넌트 (Stage 7e+ : StoragePage ProfileCard 디자인 통일)
 *  - 좌측 일주 심볼 (56×56) 오행 컬러 배경 + 천간/지지 흰 한자 + 우상단 오행 한자 뱃지
 *  - 본문: 이름 + 본인/관계 뱃지 + 생년월일(양/음/윤) + 시간 + 일간/오행
 *  - StoragePage 의 ProfileCard 와 톤 동일 (swipe·delete·edit 만 제외)
 */
export function ProfilePicker({ onSelect, onNew, title = '누구의 사주를 볼까요?' }: ProfilePickerProps) {
  const profiles = useMemo(() => getProfiles(), []);

  if (profiles.length === 0) {
    return null; // 부모에서 처리
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 className="text-display text-text-primary">{title}</h2>
        <p className="text-body-sm text-text-muted" style={{ marginTop: 4 }}>
          이전에 분석한 사주를 선택하거나, 새로 입력할 수 있어요.
        </p>
      </div>

      {/* 기존 프로필 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {profiles.map((p) => (
          <ProfileCardCompact key={p.id} profile={p} onSelect={() => onSelect(p)} />
        ))}
      </div>

      {/* 새 사주 입력 — 점선 카드 (스토리지 톤 일관) */}
      <button
        type="button"
        onClick={onNew}
        style={{
          width: '100%',
          minHeight: 92,
          background: '#FFFFFF',
          border: '2px dashed rgba(184,150,90,0.40)',
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            borderRadius: 12,
            background: 'rgba(184,150,90,0.10)',
            border: '2px dashed rgba(184,150,90,0.40)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8C6D3D" strokeWidth="2.4" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
            새 사주 입력하기
          </p>
          <p style={{ fontSize: 12, color: '#7A7269', marginTop: 2 }}>
            새로운 사람의 사주를 분석해요
          </p>
        </div>
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * ProfileCardCompact — StoragePage 디자인 통일 (swipe/edit/trash 제외)
 * ────────────────────────────────────────────────────────────────── */
function ProfileCardCompact({
  profile,
  onSelect,
}: {
  profile: SajuProfile;
  onSelect: () => void;
}) {
  // sajuData 가 없으면 즉시 계산 (모든 카드에 일주·오행 컬러 보장)
  const lazySajuData = useMemo(() => {
    if (profile.sajuData) return profile.sajuData;
    try {
      return calculateSaju(profile.input);
    } catch {
      return null;
    }
  }, [profile]);
  const ilgan = lazySajuData?.pillars?.[2]?.천간 || '';
  const ilji = lazySajuData?.pillars?.[2]?.지지 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
  const ohengColor = (oheng && OHENG_MAP[oheng]?.color) || '#8C6D3D';
  const ohengHanja = (oheng && OHENG_MAP[oheng]?.hanja) || ' ';
  const relation = profile.relation || profile.input.relation || '본인';
  const isMe = relation === '본인' || relation === 'self';

  const cal = profile.input.calendarType || 'solar';
  const calLabel = cal === 'lunar' ? '음' : cal === 'lunar_leap' ? '윤' : '양';
  const hasTime = profile.input.hasBirthTime && profile.input.birthHour !== undefined;
  const hourLabel = hasTime
    ? formatBirthHourShort(profile.input.birthHour, profile.input.birthMinute)
    : '시간 모름';

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      aria-label={`${profile.name} 선택`}
      style={{
        position: 'relative',
        height: 116,
        background: '#FFFFFF',
        border: `1px solid ${isMe ? '#B8965A' : '#E5DFD0'}`,
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {/* 좌 일주 심볼 — 오행 컬러 + 천간/지지 + 우상단 오행 뱃지 */}
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          flexShrink: 0,
          borderRadius: 12,
          background: ilgan ? ohengColor : 'rgba(140,109,61,0.13)',
          border: `2px solid ${ilgan ? ohengColor : 'rgba(184,150,90,0.40)'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Noto Serif KR', serif",
          color: ilgan ? '#FFFFFF' : '#8C6D3D',
          lineHeight: 0.96,
          boxShadow: `0 4px 10px ${ohengColor}33`,
          position: 'relative',
        }}
      >
        {ilgan ? (
          <>
            <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.02em' }}>{ilgan}</span>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.02em', marginTop: 1 }}>
              {ilji}
            </span>
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -4,
                fontSize: 9,
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: 999,
                background: '#FFFFFF',
                color: ohengColor,
                border: `1.5px solid ${ohengColor}`,
                lineHeight: 1.2,
                letterSpacing: '0.04em',
              }}
            >
              {ohengHanja}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 22, fontWeight: 700 }}>{ohengHanja || '命'}</span>
        )}
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: '#1A1A1A',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.01em',
            }}
          >
            {profile.name}
          </span>
          {isMe ? (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                background: '#8C6D3D',
                color: '#F8F5EE',
                letterSpacing: '0.04em',
              }}
            >
              본인
            </span>
          ) : (
            <span
              style={{
                fontSize: 10.5,
                color: '#8C6D3D',
                fontWeight: 700,
                padding: '1px 7px',
                background: 'rgba(184,150,90,0.14)',
                borderRadius: 999,
                letterSpacing: '0.02em',
              }}
            >
              {relation}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#7A7269', lineHeight: 1.5 }}>
          {profile.input.birthYear}.
          {String(profile.input.birthMonth).padStart(2, '0')}.
          {String(profile.input.birthDay).padStart(2, '0')} ({calLabel}), {hourLabel}
        </div>
        {ilgan && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#8C6D3D',
              marginTop: 2,
              letterSpacing: '0.02em',
            }}
          >
            일간 {ilgan}, {oheng}
          </div>
        )}
      </div>

      {/* 우 화살표 */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8B8070"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ flexShrink: 0 }}
        aria-hidden
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </motion.button>
  );
}
