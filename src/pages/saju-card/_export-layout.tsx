/**
 * 사주 카드 공유 이미지 (export 전용 배치) — v2, 2026-10-15
 *
 * 왜 다시 짰나: v1 은 1080px 캔버스에 11~18px 글자로 짜여 있어, 받은 사람 폰(화면 폭 약 360px)에서
 *   3분의 1로 줄어 글자가 4~6px 로 보였다. v2 는 폰에서 보이는 크기 그대로(정사각 360, 세로 360x640,
 *   카톡 400x210) 짜고 캡처할 때 3배(EXPORT_SCALE)로 찍어 1080x1080, 1080x1920, 1200x630 을 만든다.
 *   그래서 여기 적은 글자 크기가 받은 사람이 실제로 보는 크기다(보조 13px, 본문 15px 이상).
 *   목업: docs/mockups/사주카드_공유이미지_v2_목업.html
 *
 * 담는 것
 *  · 정사각: 이름, 일주, 한 줄 풀이(평범한 설명 문장), 성향 세 낱말, 여덟 글자와 십성
 *  · 세로: 위 + 일주 한자 머리, 운의 흐름 세 칸(지금 대운, 올해, 이번 달), 천을귀인(있는 사람만)과 신살 세 줄
 *  · 카톡: 이름, 일주, 한 줄, 여덟 글자
 * 빼는 것(v9 고서 규칙): 큰 한자 워터마크, 색 그라데이션, 알약 배지, 금색 버튼 모양(이미지 속 버튼은 눌리지 않는다),
 *   12운성, 시적인 별칭(사주 카드 화면에는 그대로), 앱에서 만든 이미지의 웹 주소.
 *
 * html2canvas 주의: outline, 흐린 그림자는 쓰지 않는다(내 일간 칸 표시는 바깥 테두리 상자로).
 */

import type { CSSProperties } from 'react';
import type { OhengType, Pillar, SajuData, SajuInput } from '@/types/saju';
import type { IljuAnimal } from '@/constants/iljuAnimal';
import type { SinsalHit } from '@/services/saju/sinsal';
import { getGwiinMeta } from './_gwiin_seal';
import { yearGanji, monthGanji } from './_flow_table';
import { findCurrentDaeun } from '@/services/saju/daeunCurrent';
import { getIljuMeaning } from '@/constants/iljuMeaning';
import { isAppintosBuild } from '@/lib/env';

export type ExportMode = 'instagram-1x1' | 'instagram-9x16' | 'kakao-share';

export interface ExportLayoutSpec {
  width: number;
  height: number;
}

/** 결과 이미지 크기 (px) */
export const EXPORT_SPECS: Record<ExportMode, ExportLayoutSpec> = {
  'instagram-1x1':  { width: 1080, height: 1080 },
  'instagram-9x16': { width: 1080, height: 1920 },
  'kakao-share':    { width: 1200, height: 630 },
};
/** 짜는 크기 (CSS px, 폰에서 보이는 크기). 캡처는 EXPORT_SCALE 배 */
export const EXPORT_CSS: Record<ExportMode, ExportLayoutSpec> = {
  'instagram-1x1':  { width: 360, height: 360 },
  'instagram-9x16': { width: 360, height: 640 },
  'kakao-share':    { width: 400, height: 210 },
};
export const EXPORT_SCALE = 3;

const SERIF = "'Noto Serif KR', 'Apple SD Gothic Neo', serif";
const SANS = "'Pretendard', 'Noto Sans KR', system-ui, sans-serif";

const INK = '#1A1612';
const PAPER = '#F4EFE4';
const MUTE = '#6F6557';
const LINE = '#E1D7C4';
const SEAL = '#A23A2A';

/** 기둥 칸 — 전통 오방색 (금은 흰 칸, 수는 먹 칸) */
const CELL: Record<OhengType, { bg: string; fg: string; border: string }> = {
  목: { bg: '#4E7A57', fg: '#FFFFFF', border: '#4E7A57' },
  화: { bg: '#B04A38', fg: '#FFFFFF', border: '#B04A38' },
  토: { bg: '#B07F38', fg: '#FFFFFF', border: '#B07F38' },
  금: { bg: '#FFFFFF', fg: INK, border: '#CFC6B6' },
  수: { bg: INK, fg: '#FFFFFF', border: INK },
};

/** 이미지 아래 출처 표기 — 앱(토스)에서 만든 이미지엔 웹 주소를 찍지 않는다 */
const BRAND_LINE = isAppintosBuild ? '사주500에서 내 사주 보기' : '사주500  saju500.app';

const SIP_KO: Record<string, string> = {
  比肩: '비견', 劫財: '겁재', 劫财: '겁재', 食神: '식신', 傷官: '상관', 伤官: '상관',
  偏財: '편재', 偏财: '편재', 正財: '정재', 正财: '정재', 七殺: '편관', 七杀: '편관', 偏官: '편관',
  正官: '정관', 偏印: '편인', 枭神: '편인', 正印: '정인',
};
const sipKo = (s?: string): string => {
  const first = String(s || '').split('/')[0].trim();
  return SIP_KO[first] || first.replace(/\(.*\)$/, '');
};

/* ══════════════════════════════════════════════════════════════════
 * Public
 * ═════════════════════════════════════════════════════════════════ */

export interface SajuCardExportLayoutProps {
  mode: ExportMode;
  name: string;
  ilju: string;
  iljuKo: string;
  animal: IljuAnimal | null;
  dayOheng: OhengType;
  sajuData: SajuData;
  input: SajuInput;
  /** 천을귀인 등 대표 귀인 (있는 사람만) */
  primaryGwiin?: SinsalHit | null;
  /** 길성과 흉살 1~3개 */
  keySinsals?: SinsalHit[];
  birthLabel: string;
}

export function SajuCardExportLayout(props: SajuCardExportLayoutProps) {
  if (props.mode === 'kakao-share') return <KakaoLayout {...props} />;
  if (props.mode === 'instagram-9x16') return <StoryLayout {...props} />;
  return <FeedLayout {...props} />;
}

/* ══════════════════════════════════════════════════════════════════
 * 부품
 * ═════════════════════════════════════════════════════════════════ */

function shell(mode: ExportMode, padding: string, extra: CSSProperties = {}): CSSProperties {
  const { width, height } = EXPORT_CSS[mode];
  return {
    width, height, padding, boxSizing: 'border-box', background: PAPER, color: INK,
    fontFamily: SANS, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    wordBreak: 'keep-all', ...extra,
  };
}

/** 고서 표지의 위아래 두 줄 선 */
function DoubleRule() {
  return <div style={{ borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${INK}`, height: 4 }} />;
}

/** 작은 낙관 */
function Seal({ size = 34 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0, border: `2px solid ${SEAL}`, borderRadius: 4, color: SEAL,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: SERIF, fontWeight: 900, fontSize: Math.round(size * 0.32), lineHeight: 1.05,
    }}>
      <span>사주</span><span>五百</span>
    </div>
  );
}

function monthLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}. ${d.getMonth() + 1}.`;
}

/** 한 줄 풀이 — 평범한 설명 문장(줄바꿈은 띄어쓰기로) */
function plainLine(ilju: string): { line: string; keys: string } {
  const m = getIljuMeaning(ilju);
  return { line: (m?.description || '').replace(/\s*\n\s*/g, ' ').trim(), keys: m?.personality || '' };
}

/** 여덟 글자 — 시, 일, 월, 년 순 */
function EightChars({ pillars, sipsung, cell, gap = 6, withSip = true }: {
  pillars: Pillar[];
  sipsung: Array<{ position: string; 십성: string }>;
  cell: number;
  gap?: number;
  withSip?: boolean;
}) {
  const order = [3, 2, 1, 0];
  const heads = ['시', '일', '월', '년'];
  const ganKeys = ['년간', '월간', '일간', '시간'];
  const zhiKeys = ['년지', '월지', '일지', '시지'];
  const sip = (idx: number, ch: 'gan' | 'zhi') =>
    sipKo(sipsung?.find((s) => s.position === (ch === 'gan' ? ganKeys[idx] : zhiKeys[idx]))?.십성);
  const fs = Math.round(cell * 0.6);

  const box = (char: string | undefined, oh: OhengType | undefined, me: boolean, missing: boolean) => {
    const c = oh ? CELL[oh] : { bg: '#FFFFFF', fg: MUTE, border: LINE };
    const inner = (
      <div style={{
        height: cell, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: missing ? 'transparent' : c.bg, color: missing ? MUTE : c.fg,
        border: missing ? `1px dashed ${MUTE}` : `1px solid ${c.border}`, boxSizing: 'border-box',
        fontFamily: SERIF, fontWeight: 900, fontSize: missing ? Math.round(cell * 0.32) : fs, lineHeight: 1,
      }}>
        {missing ? '모름' : char}
      </div>
    );
    // 내 일간 칸 — 바깥 테두리 상자 (outline 은 html2canvas 가 못 그린다)
    return me
      ? <div style={{ border: `2px solid ${INK}`, borderRadius: 8, padding: 2, margin: -4 }}>{inner}</div>
      : inner;
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap, marginBottom: 4 }}>
        {heads.map((h) => <div key={h} style={{ textAlign: 'center', fontSize: 13, color: MUTE }}>{h}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', columnGap: gap, rowGap: gap }}>
        {order.map((idx) => {
          const p = pillars[idx];
          const missing = !p || (p as any).available === false || !p.천간;
          return <div key={`g${idx}`}>{box(p?.천간, p?.천간오행 as OhengType, idx === 2, missing)}</div>;
        })}
        {order.map((idx) => {
          const p = pillars[idx];
          const missing = !p || (p as any).available === false || !p.지지;
          return <div key={`z${idx}`}>{box(p?.지지, p?.지지오행 as OhengType, false, missing)}</div>;
        })}
      </div>
      {withSip && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap, marginTop: 3 }}>
          {order.map((idx) => {
            const p = pillars[idx];
            const missing = !p || (p as any).available === false || !p.천간;
            const txt = missing ? '' : idx === 2 ? `나, ${sip(idx, 'zhi')}` : [sip(idx, 'gan'), sip(idx, 'zhi')].filter(Boolean).join(', ');
            return <div key={`s${idx}`} style={{ textAlign: 'center', fontSize: 13, color: MUTE, whiteSpace: 'nowrap' }}>{txt}</div>;
          })}
        </div>
      )}
    </div>
  );
}

/** 운의 흐름 세 칸 — 지금 대운, 올해, 이번 달 */
function FlowRow({ sajuData, birthYear }: { sajuData: SajuData; birthYear: number }) {
  const now = new Date();
  const dy = sajuData.daeun ? findCurrentDaeun(sajuData.daeun, birthYear) : undefined;
  const yg = yearGanji(now.getFullYear());
  const mg = monthGanji(now.getFullYear(), now.getMonth() + 1);
  const items = [
    dy?.간지 ? { h: '지금 대운', g: dy.간지, k: dy.시작년도 && dy.끝년도 ? `${dy.시작년도}~${dy.끝년도}` : `${dy.시작나이}세부터` } : null,
    yg ? { h: '올해', g: yg.ganji, k: `${now.getFullYear()}년` } : null,
    mg ? { h: '이번 달', g: mg.ganji, k: `${now.getMonth() + 1}월` } : null,
  ].filter(Boolean) as Array<{ h: string; g: string; k: string }>;
  if (!items.length) return null;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, textAlign: 'center',
      borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: '8px 0',
    }}>
      {items.map((x) => (
        <div key={x.h}>
          <div style={{ fontSize: 13, color: MUTE }}>{x.h}</div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 20, lineHeight: 1.35 }}>{x.g}</div>
          <div style={{ fontSize: 13, color: MUTE }}>{x.k}</div>
        </div>
      ))}
    </div>
  );
}

/** 신살 뜻 — 첫 마디만, 마침표 없이 */
function shortMeaning(m: string): string {
  const first = String(m || '').split(/[.。]\s*/)[0].trim();
  return first.length > 24 ? first.slice(0, first.lastIndexOf(',', 24) > 8 ? first.lastIndexOf(',', 24) : 24) : first;
}

/* ══════════════════════════════════════════════════════════════════
 * 정사각 360 x 360 (→ 1080 x 1080)
 * ═════════════════════════════════════════════════════════════════ */

function FeedLayout({ name, ilju, iljuKo, sajuData, primaryGwiin }: SajuCardExportLayoutProps) {
  const { line, keys } = plainLine(ilju);
  const gwiin = primaryGwiin ? getGwiinMeta(primaryGwiin.name) : null;
  return (
    <div style={shell('instagram-1x1', '22px 22px 18px')}>
      <DoubleRule />
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, color: MUTE }}>{name ? `${name} 님은` : '이 사주는'}</div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, lineHeight: 1.3 }}>{iljuKo}({ilju}) 일주</div>
        </div>
        <Seal />
      </div>
      {line && <div style={{ fontSize: 15, lineHeight: 1.6, marginTop: 8 }}>{line}</div>}
      {(keys || gwiin) && (
        <div style={{ fontSize: 13, color: MUTE, marginTop: 2 }}>
          {[keys, gwiin ? `${gwiin.name}이 있는 사주` : ''].filter(Boolean).join(', ')}
        </div>
      )}
      <div style={{ marginTop: 'auto' }}>
        <EightChars pillars={sajuData.pillars} sipsung={sajuData.sipsung} cell={44} />
      </div>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTE }}>
        <span>{BRAND_LINE}</span><span>{monthLabel()}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 세로 360 x 640 (→ 1080 x 1920)
 * ═════════════════════════════════════════════════════════════════ */

function StoryLayout({ name, ilju, iljuKo, sajuData, input, primaryGwiin, keySinsals = [] }: SajuCardExportLayoutProps) {
  const { line, keys } = plainLine(ilju);
  const gwiin = primaryGwiin ? getGwiinMeta(primaryGwiin.name) : null;
  const rows: Array<{ k: string; v: string }> = [];
  if (primaryGwiin) rows.push({ k: gwiin?.name || primaryGwiin.name, v: shortMeaning(gwiin?.meaning || primaryGwiin.meaning) });
  for (const s of keySinsals) {
    if (rows.length >= 3) break;
    if (rows.some((r) => r.k === s.name)) continue;
    const v = shortMeaning(s.meaning);
    if (v) rows.push({ k: s.name, v });
  }
  return (
    <div style={shell('instagram-9x16', '24px 22px 18px')}>
      <DoubleRule />
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 13, color: MUTE }}>{name ? `${name} 님의 사주 카드` : '사주 카드'}</div>
        <Seal />
      </div>
      <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 64, lineHeight: 1.05, marginTop: 4 }}>{ilju}</div>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, lineHeight: 1.3, marginTop: 4 }}>{iljuKo} 일주</div>
      {line && <div style={{ fontSize: 15, lineHeight: 1.6, marginTop: 8 }}>{line}</div>}
      {keys && <div style={{ fontSize: 13, color: MUTE }}>{keys}</div>}

      <div style={{ marginTop: 16 }}>
        <EightChars pillars={sajuData.pillars} sipsung={sajuData.sipsung} cell={44} />
      </div>
      <div style={{ marginTop: 14 }}>
        <FlowRow sajuData={sajuData} birthYear={input.birthYear} />
      </div>
      {rows.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.55 }}>
          {rows.map((r, i) => (
            <div key={r.k} style={{ padding: '7px 0', borderTop: i === 0 ? 0 : `1px solid ${LINE}` }}>
              <b style={{ fontWeight: 700 }}>{r.k}</b> {r.v}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTE }}>
        <span>{BRAND_LINE}</span><span>{monthLabel()}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 카톡 미리보기 400 x 210 (→ 1200 x 630). 말풍선에서 더 작게 보여 글자를 가장 적게
 * ═════════════════════════════════════════════════════════════════ */

function KakaoLayout({ name, ilju, iljuKo, sajuData }: SajuCardExportLayoutProps) {
  const { line } = plainLine(ilju);
  return (
    <div style={shell('kakao-share', '18px 20px', { flexDirection: 'row', gap: 18 })}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ fontSize: 13, color: MUTE }}>{name ? `${name} 님의 사주 카드` : '사주 카드'}</div>
        <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 52, lineHeight: 1.05, marginTop: 6 }}>{ilju}</div>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 20, lineHeight: 1.3 }}>{iljuKo} 일주</div>
        {line && <div style={{ fontSize: 15, lineHeight: 1.45, marginTop: 'auto' }}>{line}</div>}
      </div>
      <div style={{ width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <EightChars pillars={sajuData.pillars} sipsung={sajuData.sipsung} cell={32} gap={4} withSip={false} />
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: MUTE }}>
          <span>사주500</span><Seal size={28} />
        </div>
      </div>
    </div>
  );
}
