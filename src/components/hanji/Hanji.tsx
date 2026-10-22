/**
 * 한지(韓紙) 디자인 부품 — 2026-10-10 v9 (전 화면 공용)
 *   근거 시안: docs/mockups/사주500_v9_고서시안.html · 규칙: src/styles/hanji.css 머리말
 *   - 금색 = 누르는 곳(주 버튼)에만 · 색은 먹·종이 · 붉은 낙관은 작게
 *   - 잠긴 내용은 가짜 글자를 흐리게 하지 않는다 → <Redact/> 가림막 (결제 후 다른 말이 나오는 미끼 금지)
 */
import type { CSSProperties, ReactNode } from 'react';
import '@/styles/hanji.css';
import { moVars, useCountUp } from '@/components/motion/Motion';

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

export function Seal({ children, size = 34, fontSize, stamp, delay }: {
  children: ReactNode; size?: number; fontSize?: number;
  /** 2026-10-18 도장 찍듯 등장 (motion.css mo-stamp) */ stamp?: boolean; delay?: number;
}) {
  return (
    <span className={`hj-seal${stamp ? ' mo-stamp' : ''}`}
      style={{ width: size, height: size, fontSize: fontSize ?? Math.round(size * 0.36), ...(stamp && delay ? moVars({ d: delay }) : null) }}>
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

/** 사주가 아직 없을 때 — 왜 필요한지 한 줄 + 바로 넣는 버튼 하나 (2026-10-11 빈 화면 7곳 통일) */
export function NeedSaju({ mark, title = '먼저 사주를 넣어 주세요', desc, cta = '사주 넣으러 가기', onClick }: {
  mark: string; title?: string; desc: ReactNode; cta?: string; onClick: () => void;
}) {
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '44px 20px 120px', textAlign: 'center' }}>
      <Seal size={58} fontSize={28}>{mark}</Seal>
      <h2 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, color: HJ.ink, marginTop: 18, lineHeight: 1.4 }}>{title}</h2>
      <p style={{ fontSize: 15.5, lineHeight: 1.7, color: HJ.ink2, marginTop: 10 }}>{desc}</p>
      <div style={{ marginTop: 28 }}>
        <GoldCta onClick={onClick} sub="1분이면 끝나요">{cta}</GoldCta>
      </div>
    </div>
  );
}

/* ═══ 2026-10-11 고서 문서 부품 — 왼쪽 색 띠 상자, 알약 배지, 슬라이더 게이지 대체 (규칙은 hanji.css '고서 문서 부품' 머리말) ═══
 *   gold = 프리미엄(월운세, 신년운세 7운 · 종합사주 10운) 감지금니 양식 */

/** 결(結) 한 줄 풀이 — 사방 두 줄 테두리 + 판심 제목 + 문장 끝 낙관 */
export function Verdict({ label = '한 줄 풀이', children, html, seal, refText, gold, style }: {
  label?: ReactNode; children?: ReactNode; html?: string; seal?: string; refText?: ReactNode; gold?: boolean; style?: CSSProperties;
}) {
  return (
    <div className={`hj-verdict mo-ink${gold ? ' gold' : ''}`} style={style}>
      <Pansim>{label}</Pansim>
      <p className="vt">
        {html != null ? <span dangerouslySetInnerHTML={{ __html: html }} /> : children}
        {seal && <Seal size={24} fontSize={13} stamp delay={520}>{seal}</Seal>}
      </p>
      {refText && <p className="vref">{refText}</p>}
    </div>
  );
}

/** 주(註) — 위아래 두 줄 괘선. 덧붙이는 풀이, 실천, 안내 */
export function Note({ label, mark, children, html, gold, style }: {
  label?: ReactNode; mark?: string; children?: ReactNode; html?: string; gold?: boolean; style?: CSSProperties;
}) {
  return (
    <div className={`hj-note${gold ? ' gold' : ''}`} style={style}>
      {label != null && <div className="nl">{mark && <Seal size={22} fontSize={12}>{mark}</Seal>}{label}</div>}
      {html != null ? <div className="nb" dangerouslySetInnerHTML={{ __html: html }} /> : <div className="nb">{children}</div>}
    </div>
  );
}

/** 宜忌 — 책력의 '할 일(宜) / 삼갈 일(忌)' 표기로 좋은 점과 조심할 점 */
export function YiGi({ good = [], bad = [], goodLabel = '살릴 점', badLabel = '조심할 점', html, style }: {
  good?: string[]; bad?: string[]; goodLabel?: string; badLabel?: string; html?: boolean; style?: CSSProperties;
}) {
  const g = good.filter(Boolean);
  const b = bad.filter(Boolean);
  if (!g.length && !b.length) return null;
  const item = (t: string, i: number) => (html ? <li key={i} dangerouslySetInnerHTML={{ __html: t }} /> : <li key={i}>{t}</li>);
  return (
    <div className="hj-yigi" style={style}>
      {g.length > 0 && (
        <div className="grp yi">
          <div className="side"><b>宜</b><small>{goodLabel}</small></div>
          <ul>{g.map(item)}</ul>
        </div>
      )}
      {b.length > 0 && (
        <div className="grp gi">
          <div className="side"><b>忌</b><small>{badLabel}</small></div>
          <ul>{b.map(item)}</ul>
        </div>
      )}
    </div>
  );
}

/** 칸 — 두 줄 테두리 작은 칸 (수치, 시기). tone: good 송록 / warn 석간주 */
export function Cell({ label, value, tone, big, style }: {
  label: ReactNode; value: ReactNode; tone?: 'default' | 'good' | 'warn'; big?: boolean; style?: CSSProperties;
}) {
  return (
    <div className="hj-cell" style={style}>
      <span className="k">{label}</span>
      <span className={`v${big ? ' big' : ''}${tone && tone !== 'default' ? ` ${tone}` : ''}`}>{value}</span>
    </div>
  );
}

/** 장부 — 이름칸(작은 붉은 한자) + 내용 줄 */
export function Ledger({ rows, style }: {
  rows: { mark?: string; label: ReactNode; value: ReactNode; swatch?: string }[]; style?: CSSProperties;
}) {
  return (
    <div className="hj-ledger" style={style}>
      {rows.map((r, i) => (
        <div className="row" key={i}>
          <span className="k">{r.mark && <b>{r.mark}</b>}{r.label}</span>
          <span className="v">{r.swatch && <i className="sw" style={{ background: r.swatch }} />}{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** 고르기 칸 — 가로 장부 칸, 고른 칸만 먹 바탕 (아이콘 붙은 알약 토글 대체, 2026-10-23 1.6.3 P1-11) */
export function Choice<T extends string>({ options, value, onChange, ariaLabel, style }: {
  options: { v: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; ariaLabel?: string; style?: CSSProperties;
}) {
  return (
    <div className="hj-choice" role="group" aria-label={ariaLabel} style={style}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

/** 눈금 — 원고지 열 칸 점수 (동그란 손잡이 슬라이더 대체). 단계: 보강기 ~54 / 안정기 55~84 / 상승기 85~ */
export function Grade({ label, score, unit = '점', phrase, foot, gold }: {
  label: ReactNode; score: number; unit?: string; phrase?: ReactNode; foot?: ReactNode; gold?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const band = pct >= 85 ? 2 : pct >= 55 ? 1 : 0;
  const shown = useCountUp(pct); // 2026-10-18 숫자가 차오르고 칸이 하나씩 찬다 (motion.css mo-fill)
  return (
    <div className={`hj-grade${gold ? ' gold' : ''}`}>
      <div className="top">
        <span className="lb">{label}</span>
        <span className="num" style={{ fontVariantNumeric: 'tabular-nums' }} aria-label={`${pct}${unit}`}>{shown}<small>{unit}</small></span>
      </div>
      <div className="cells" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ ['--f' as string]: `${Math.max(0, Math.min(1, (pct - i * 10) / 10)) * 100}%`, ['--n' as string]: i } as CSSProperties} />
        ))}
      </div>
      <div className="scale">
        {['보강기', '안정기', '상승기'].map((t, i) => <span key={t} className={i === band ? 'on' : undefined}>{t}</span>)}
      </div>
      {phrase && <p className="ph">{phrase}</p>}
      {foot && <p className="ft">{foot}</p>}
    </div>
  );
}

/** 제첨 — 네모 딱지 (유형 이름, 단계) */
export function Tag({ children, seal, gold, onInk, style }: { children: ReactNode; seal?: boolean; gold?: boolean; onInk?: boolean; style?: CSSProperties }) {
  return <span className={`hj-tag${seal ? ' seal' : ''}${gold ? ' gold' : ''}${onInk ? ' on-ink' : ''}`} style={style}>{children}</span>;
}

/** 카드 제목 앞 작은 낙관 (옅은 색 둥근 한자 타일 대체) */
export function Mark({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span className="hj-mark" aria-hidden="true" style={style}>{children}</span>;
}
