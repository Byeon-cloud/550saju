/**
 * DarkHeader — 검정 골드 sticky 헤더 (PremiumResult 패턴 통일)
 *
 * 사용처:
 *  - DailyFortunePage 결과 (FREE · 7섹션 일일 풀이)
 *  - DreamPage 결과 (FREE · 4섹션 무료 풀이)
 *  - 향후 다른 결과 페이지에 일관성 적용
 *
 * 디자인 SSOT: PremiumResult 의 PremiumDarkHeader (ResultPage.tsx:76)
 *  - 검정 그라디언트 (#1a1a1a → #2a2520)
 *  - 골드 underline border-bottom (rgba(212,175,55,0.3))
 *  - 좌: ← 뒤로 / 중: title + sub / 우: tier chip
 *  - position: sticky, top: 0, zIndex: 50
 */

import { useNavigate } from 'react-router-dom';
import { hasNativeNavBack } from '@/lib/env';

interface DarkHeaderProps {
  /** 메인 타이틀 (예: "이혜지 님의 오늘의 운세") */
  title: string;
  /** 부제 (예: "FREE · 7섹션 일일 풀이") */
  subtitle: string;
  /** 우측 chip 텍스트 (예: "무료" / "10운" / "1운") */
  chip?: string;
  /** chip 스타일 — 'gold' (default 골드 그라디언트) / 'free' (백금 silver) */
  chipVariant?: 'gold' | 'free';
  /** 뒤로가기 핸들러 (생략 시 window.history.back()) */
  onBack?: () => void;
}

export function DarkHeader({ title, subtitle, chip, chipVariant = 'gold', onBack }: DarkHeaderProps) {
  const navigate = useNavigate();
  const handleBack = onBack || (() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  });

  const chipStyle = chipVariant === 'free'
    ? {
        background: 'linear-gradient(135deg, rgba(232,217,184,0.20) 0%, rgba(184,150,90,0.30) 100%)',
        color: '#E8D9B8',
        border: '1px solid rgba(232,217,184,0.40)',
      }
    : {
        background: 'linear-gradient(135deg, #E8D9B8 0%, #B8965A 100%)',
        color: '#1a1a1a',
        border: 'none',
      };

  return (
    <header
      style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2520 100%)',
        color: '#fff',
        padding: '14px 20px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid rgba(212,175,55,0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* 앱인토스: 토스 내비바 뒤로가기와 중복 → 숨김 (2026-09-16 심사 반려 · env.ts hasNativeNavBack) */}
      {!hasNativeNavBack && (
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            opacity: 0.85,
            fontSize: 22,
            lineHeight: 1,
            padding: '4px 6px',
            cursor: 'pointer',
          }}
        >
          ←
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 0,
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#E8D9B8',
            marginTop: 2,
            letterSpacing: '0.05em',
          }}
        >
          {subtitle}
        </div>
      </div>
      {chip && (
        <div
          style={{
            ...chipStyle,
            fontSize: 10,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 100,
            letterSpacing: '0.08em',
            flexShrink: 0,
          }}
        >
          {chip}
        </div>
      )}
    </header>
  );
}
