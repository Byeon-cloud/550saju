/**
 * 한지(韓紙) 디자인 부품 — 2026-10-10 v9 (전 화면 공용)
 *   근거 시안: docs/mockups/사주500_v9_고서시안.html · 규칙: src/styles/hanji.css 머리말
 *   - 금색 = 누르는 곳(주 버튼)에만 · 색은 먹·종이 · 붉은 낙관은 작게
 *   - 잠긴 내용은 가짜 글자를 흐리게 하지 않는다 → <Redact/> 가림막 (결제 후 다른 말이 나오는 미끼 금지)
 */
import type { CSSProperties, ReactNode } from 'react';
import '@/styles/hanji.css';

export const HJ = {
  paper: '#F4EFE4',
  paper2: '#EBE3D3',
  card: '#FFFDF8',
  hanji: '#F5EEDF',
  ink: '#1A1612',
  ink2: '#4B4238',
  mute: '#6F6557',
  line: '#E1D7C4',
  gold: '#B8965A',
  goldText: '#7A5C2E',
  seal: '#A23A2A',
} as const;
export const SERIF = "'Noto Serif KR', serif";

/** 그림 — 공유마당 저작권 만료 저작물 (정선 「개화사」「인왕제색도」, 김홍도 「금강사군첩 · 장안사」) */
export const ART = {
  gaehwasa: '/art/gaehwasa.webp',
  jangansa: '/art/jangansa.webp',
  inwang: '/art/inwang.webp',
  /** 사주책 표지 — 훈민정음 해례본 영인본 표지(서울대 규장각, 퍼블릭 도메인)를 각색: 제목 글자와 소장 딱지를 지우고 황갈색으로 */
  gobook: '/art/gobook.webp',
} as const;
/** 콘텐츠 머리 공통 배경 — 먹 + 정선 「인왕제색도」 (주제별 색 그라데이션 대체 · 전 콘텐츠 같은 머리) */
export const INK_HERO_BG = "linear-gradient(180deg, rgba(26,22,18,.55) 0%, rgba(26,22,18,.82) 45%, #1A1612 100%), url('/art/inwang.webp') 30% 35% / cover no-repeat, #1A1612";
export const ART_CREDIT = '그림: 정선 「개화사」「인왕제색도」, 김홍도 「금강사군첩」 중 장안사 (공유마당 저작권 만료 저작물). 책 표지: 훈민정음 해례본 영인본 표지 (서울대 규장각, 퍼블릭 도메인)를 고쳐 씀';

export function GoldCta({ children, sub, onClick, disabled, ariaLabel, style }: {
  children: ReactNode; sub?: ReactNode; onClick?: () => void; disabled?: boolean; ariaLabel?: string; style?: CSSProperties;
}) {
  return (
    <button type="button" className="hj-cta" onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={style}>
      <span>{children}</span>
      {sub != null && <small>{sub}</small>}
    </button>
  );
}

export function GhostButton({ children, sub, onClick, onInk, ariaLabel, style }: {
  children: ReactNode; sub?: ReactNode; onClick?: () => void; onInk?: boolean; ariaLabel?: string; style?: CSSProperties;
}) {
  return (
    <button type="button" className={`hj-ghost${onInk ? ' on-ink' : ''}`} onClick={onClick} aria-label={ariaLabel} style={style}>
      <span>{children}</span>
      {sub != null && <small>{sub}</small>}
    </button>
  );
}

export function Seal({ children, size = 34, fontSize }: { children: ReactNode; size?: number; fontSize?: number }) {
  return (
    <span className="hj-seal" style={{ width: size, height: size, fontSize: fontSize ?? Math.round(size * 0.36) }}>
      {children}
    </span>
  );
}

export function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size + 1} viewBox="0 0 11 12" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="1" y="5" width="9" height="6" rx="1.5" />
      <path d="M3 5V3.5a2.5 2.5 0 015 0V5" />
    </svg>
  );
}

/** 잠긴 내용 자리 — 폭만 있는 가림막 + '잠김' */
export function Redact({ w = 120, lock = true }: { w?: number; lock?: boolean }) {
  return (
    <>
      <span className="hj-redact" style={{ width: w }} aria-label="잠긴 내용" />
      {lock && <span className="hj-lock"><LockIcon />잠김</span>}
    </>
  );
}

const HANJA_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export function hanjaNum(n: number): string { return HANJA_NUM[n - 1] || String(n); }

/** 섹션 머리 — 一 오늘의 결 · 日柱 */
export function SectionHead({ no, title, han, right, style }: { no?: number; title: ReactNode; han?: string; right?: ReactNode; style?: CSSProperties }) {
  return (
    <div className="hj-shead" style={style}>
      {no != null && <span className="no">{hanjaNum(no)}</span>}
      <span className="ti">{title}</span>
      {han && <span className="hj">{han}</span>}
      {right}
    </div>
  );
}

function Eomi({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 16 9" aria-hidden="true">
      <path d={up ? 'M0 9h16V4.8L8 0 0 4.8z' : 'M0 0h16v4.2L8 9 0 4.2z'} fill="#4B4238" />
    </svg>
  );
}
export function Pansim({ children }: { children: ReactNode }) {
  return <div className="hj-pansim"><Eomi />{children}<Eomi up /></div>;
}

/** 고서 한 쪽 — 광곽 테두리 + 판심 제목 */
export function Gwang({ title, children, style, bodyStyle }: { title?: ReactNode; children: ReactNode; style?: CSSProperties; bodyStyle?: CSSProperties }) {
  return (
    <div className="hj-gwang" style={style}>
      {title != null && <Pansim>{title}</Pansim>}
      <div style={{ padding: '14px 16px 16px', ...bodyStyle }}>{children}</div>
    </div>
  );
}

/** 콘텐츠 머리 그림띠 — 아래로 종이색으로 녹아든다 (글자는 그림 위에 올리지 않는다) */
export function ArtStrip({ src, height = 150, position = '40% 25%', size = '140% auto' }: { src: string; height?: number; position?: string; size?: string }) {
  return (
    <div aria-hidden="true" style={{ position: 'relative', height, backgroundImage: `url(${src})`, backgroundRepeat: 'no-repeat', backgroundPosition: position, backgroundSize: size, backgroundColor: HJ.paper2 }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(244,239,228,.35) 0%, rgba(244,239,228,0) 35%, rgba(244,239,228,.8) 78%, ${HJ.paper} 100%)` }} />
    </div>
  );
}

/** 고서 선장본 — 실제 옛 책 표지 사진(각색본) 위 제목 쪽지에 사용자 제목을 얹는다 (2026-10-11, CSS 로 그린 책 대체) */
export function GoBook({ title }: { title: string }) {
  return (
    <div className="hj-book" aria-hidden="true">
      <div className="pages" />
      <img className="cover-img" src={ART.gobook} alt="" draggable={false} />
      <div className="slip"><b>{title}</b></div>
    </div>
  );
}
