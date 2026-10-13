// Phase A (#54) — extracted from ResultPage.tsx (lines 926-2277)
// 5 inline visuals + SectionVis dispatcher + ReportSection wrapper
// 0 behavior change vs original

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CHEONGAN_OHENG, CHEONGAN_KO, CHEONGAN_EUMYANG, JIJI_OHENG, JIJI_KO } from '@/constants/oheng';
import { LuckyProfile } from '@/components/saju/LuckyProfile';
import { MonthlyFortune } from '@/components/saju/MonthlyFortune';
import { RelationshipMap } from '@/components/saju/RelationshipMap';
import { WealthFlow } from '@/components/saju/WealthFlow';
import { Pictogram } from '@/components/brand/PictogramRegistry';
import { stripMd } from '@/utils/format';
import type { OhengType, Pillar, JiJangGan } from '@/types/saju';
import {
  EC, EHAN, OHENG_TO_ELEM, OHENG_KR_LABEL,
  type ElemKey, type V4Elements,
} from './_data';
import { LocalFadeIn } from './_atoms';

// ─── Inline visuals ───
export function OhengFlowVis({ elements, hasBirthTime }: { elements: V4Elements; hasBirthTime: boolean }) {
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#6b5b47', marginBottom: 4 }}>
        ▎오행 상생상극: 이 사주의 핵심 구조
      </div>
      <div style={{ fontSize: 12, color: '#a0937f', marginBottom: 10, lineHeight: 1.5 }}>
        <span style={{ color: '#4E7A57', fontWeight: 700 }}>상생(→생→)</span>은 기운을 키워주고, <span style={{ color: '#A23A2A', fontWeight: 700 }}>상극(→극→)</span>은 기운을 억제해요
      </div>
      <div
        className="flex items-center justify-center gap-1 flex-wrap"
        style={{ fontSize: 13, color: '#8b7e6f', marginBottom: 8 }}
      >
        <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.wood.light, color: EC.wood.dark }}>
          木 목 {elements.wood}
        </span>
        <span className="font-bold" style={{ color: '#A23A2A' }}>→극→</span>
        <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.earth.light, color: EC.earth.dark }}>
          土 토(나) {elements.earth}
        </span>
        <span>→생→</span>
        <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.metal.light, color: EC.metal.dark }}>
          金 금 {elements.metal}
        </span>
      </div>
      <div className="text-center px-2" style={{ fontSize: 13, color: '#a0937f', marginBottom: 10 }}>
        강한 목이 토(나)를 압박하고, 토가 낳은 금(식신)은 약한 구조
      </div>
      <div
        className="p-3 rounded-xl text-center"
        style={{ background: '#F6E5E0', border: '1px dashed #ef9a9a', fontSize: 13 }}
      >
        <div className="font-bold" style={{ color: '#A23A2A', marginBottom: 4 }}>
          火 2026년 해결책: 화(火) 기운 유입!
        </div>
        <div
          className="flex items-center justify-center gap-1 flex-wrap"
          style={{ color: '#8b7e6f' }}
        >
          <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.wood.light, color: EC.wood.dark }}>
            목
          </span>
          <span>→생→</span>
          <span
            className="px-2 py-1 rounded-lg font-bold"
            style={{ background: EC.fire.light, color: EC.fire.dark, border: '2px solid ' + EC.fire.main }}
          >
            火 화
          </span>
          <span>→생→</span>
          <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.earth.light, color: EC.earth.dark }}>
            토(나) ↑
          </span>
        </div>
        <div style={{ color: '#8A6226', marginTop: 4 }}>목에서 화, 화에서 토로 이어지며 압박이 풀려요</div>
        {hasBirthTime && (
          <div style={{ color: '#8b7e6f', marginTop: 4, fontSize: 12 }}>
            시주 납음이 노중화(炉中火)예요. 내면에 숨겨진 화의 씨앗이 있었어요.
          </div>
        )}
      </div>
      {/* 쉽게 말하면 */}
      <div className="mt-3 p-3 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#3949ab', marginBottom: 6 }}>쉽게 말하면?</p>
        <div style={{ fontSize: 13, color: '#5c6bc0', lineHeight: 1.7 }}>
          <p>• <b>상생(→생→)</b>: A가 B에게 기운을 주는 관계예요. 자연스럽게 도움이 되는 흐름</p>
          <p>• <b>상극(→극→)</b>: A가 B를 누르는 관계예요. 압박이 되지만, 성장의 원동력이기도 해요</p>
          <p style={{ marginTop: 6, fontWeight: 600, color: '#3949ab' }}>
            위에서 가장 강한 오행이 나(토)를 극하고 있으면 → 외부 압박과 스트레스가 큰 구조예요.
            해결책 영역의 오행이 중간에서 기운을 전달해주면 이 압박이 풀려요!
          </p>
        </div>
      </div>
    </div>
  );
}

export function JijangganVisComp({ jijanggan, pillars, hasBirthTime }: {
  jijanggan: JiJangGan[]; pillars: Pillar[]; hasBirthTime: boolean;
}) {
  // ─── 중국어→한국어 십성 변환 (lunar-javascript는 中文 반환) ───
  const cnToKr: Record<string, string> = {
    '比肩': '비견', '劫財': '겁재', '食神': '식신', '傷官': '상관',
    '偏財': '편재', '正財': '정재', '偏官': '편관', '七殺': '편관',
    '正官': '정관', '偏印': '편인', '正印': '정인', '日主': '일주',
  };
  function toKrSipsung(raw: string): string {
    return cnToKr[raw] ?? raw;
  }

  // ─── 캐시 데이터 십성 누락 시 일간 기준 직접 계산 ───
  const SANGSAENG: Record<string, string> = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  const SANGGEUK: Record<string, string> = { '목': '토', '토': '수', '수': '화', '화': '금', '금': '목' };
  const dayGan = pillars[2]?.천간 ?? '';
  const dayOheng = CHEONGAN_OHENG[dayGan] ?? '토';
  const dayEumyang = CHEONGAN_EUMYANG[dayGan] ?? '양';

  function calcSipsung(targetGan: string): string {
    const tOheng = CHEONGAN_OHENG[targetGan];
    const tEumyang = CHEONGAN_EUMYANG[targetGan];
    if (!tOheng || !tEumyang) return '';
    const samePolarity = dayEumyang === tEumyang;
    if (dayOheng === tOheng) return samePolarity ? '비견' : '겁재';
    if (SANGSAENG[dayOheng] === tOheng) return samePolarity ? '식신' : '상관';
    if (SANGSAENG[tOheng] === dayOheng) return samePolarity ? '편인' : '정인';
    if (SANGGEUK[dayOheng] === tOheng) return samePolarity ? '편재' : '정재';
    if (SANGGEUK[tOheng] === dayOheng) return samePolarity ? '편관' : '정관';
    return '';
  }

  // ─── 한국어 조사 헬퍼 ───
  function josa(word: string, withBatchim: string, withoutBatchim: string): string {
    const last = word.charAt(word.length - 1);
    const code = last.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      return (code - 0xAC00) % 28 !== 0 ? withBatchim : withoutBatchim;
    }
    return withoutBatchim;
  }

  // ─── 일간 오행별 특성 사전 — 사주마다 다른 내용 생성 ───
  const OHENG_NATURE: Record<OhengType, { noun: string; adj: string; energy: string }> = {
    목: { noun: '나무', adj: '성장하는', energy: '생명력' },
    화: { noun: '불꽃', adj: '열정적인', energy: '표현력' },
    토: { noun: '대지', adj: '안정적인', energy: '포용력' },
    금: { noun: '쇠', adj: '단단한', energy: '결단력' },
    수: { noun: '물', adj: '유연한', energy: '지혜' },
  };

  function getSipsungPersonalized(sip: string): { voice: string; trait: string } | null {
    const me = OHENG_NATURE[dayOheng as OhengType] || OHENG_NATURE['토'];
    const n = me.noun;
    const e = me.energy;
    // 조사: 이/가, 을/를, 은/는
    const nGa = josa(n, '이', '가'); // 나무가, 불꽃이, 쇠가, 물이
    const nReul = josa(n, '을', '를'); // 나무를, 불꽃을, 쇠를, 물을
    const eGa = josa(e, '이', '가');
    const eReul = josa(e, '을', '를');
    const ohGa = josa(dayOheng, '이', '가');
    const ohReul = josa(dayOheng, '을', '를');

    const map: Record<string, { voice: string; trait: string }> = {
      비견: {
        voice: `"${n}${nGa} ${n}${nReul} 만남: 같이 가자"`,
        trait: `같은 ${dayOheng} 기운의 만남. ${me.adj} ${e}${eGa} 두 배가 되지만, 같은 자원을 나누는 구조라 협력과 배분의 지혜가 동시에 필요해요`,
      },
      겁재: {
        voice: `"내 ${e}${eReul} 빼앗기면 안 돼"`,
        trait: `${n}의 반대 극성 기운: ${e}${eReul} 지키려는 강한 방어본능. 승부욕이 강하고, 위기 상황에서 오히려 진가를 발휘하는 편이에요`,
      },
      식신: {
        voice: `"${n}에서 태어난 것을 세상에 보여주고 싶어"`,
        trait: `${dayOheng}${ohGa} 자연스럽게 만들어내는 기운. 창작, 요리, 표현 등 무언가를 만들어내는 활동에서 기쁨과 충만함을 느끼는 구조예요`,
      },
      상관: {
        voice: `"${n}의 틀을 깨고 새로운 형태를 만들겠어"`,
        trait: `${dayOheng}${ohGa} 크게 분출되는 기운. 기존 질서에 의문을 던지고, 남들이 생각 못한 방식으로 혁신하는 반골 기질이에요`,
      },
      편재: {
        voice: `"${n}${nGa} 지배하는 영역에서 기회를 잡자"`,
        trait: `${dayOheng}${ohGa} 억누르는 대상: 적극적 재물 추구 기운. 투자 감각이 있고, 기회를 포착하면 과감하게 움직이는 행동파예요`,
      },
      정재: {
        voice: `"${n}의 힘으로 꾸준히 쌓아가자"`,
        trait: `${dayOheng}${ohGa} 안정적으로 관리하는 재물 기운. 저축과 계획적 소비 성향이 강하고, 빠른 수익보다 꾸준한 축적을 선호해요`,
      },
      편관: {
        voice: `"${n}${nReul} 단련시키는 압박: 대충은 절대 안 돼"`,
        trait: `${dayOheng}${ohReul} 극(剋)하는 기운: 외부 압박과 규율이 나를 단련시키는 구조. 스트레스가 되지만 이것이 성장의 원동력이에요`,
      },
      정관: {
        voice: `"${n}${nReul} 올바르게 다듬는 힘: 제대로 해야 해"`,
        trait: `${dayOheng}${ohReul} 규제하는 정통 질서의 힘. 규칙과 책임감을 중시하고, 사회적 인정과 신뢰를 얻는 데 유리한 구조예요`,
      },
      편인: {
        voice: `"${n}에게 영감을 주는 독특한 감각"`,
        trait: `${dayOheng}${ohReul} 생(生)해주는 비정통 기운. 직감이 강하고, 남들과 다른 시각으로 문제를 풀어내는 독창적 사고의 소유자예요`,
      },
      정인: {
        voice: `"${n}${nReul} 키워주는 근본적인 배움의 힘"`,
        trait: `${dayOheng}${ohReul} 생(生)해주는 정통 학습의 기운. 학문, 지식, 자격에 끌리고, 공부할수록 내면이 단단해지는 구조예요`,
      },
      일주: {
        voice: '"나 자신의 근본 기운"',
        trait: `${dayOheng} 일간(${dayGan}): ${me.adj} ${e}${eGa} 내 본질. 모든 판단과 행동의 출발점이 되는 핵심 기운이에요`,
      },
    };
    return map[sip] ?? null;
  }

  // ─── 포지션별 의미 ───
  const posContext: Record<string, { role: string; desc: string }> = {
    '년지': { role: '어린 시절의 나', desc: '부모와 조상에게서 물려받은 기질' },
    '년지+월지': { role: '성장기의 나', desc: '타고난 기질 + 사회적 성격' },
    '월지': { role: '사회에서의 나', desc: '직장과 대인관계에서 보이는 모습' },
    '일지': { role: '진짜 나의 본질', desc: '가장 솔직한 내면, 배우자궁' },
    '시지': { role: '말년의 나', desc: '나이 들수록 드러나는 성향, 자녀궁' },
  };

  // ─── 데이터 빌드 ───
  interface JjEntry { hanja: string; kr: string; elemKey: ElemKey; sipsung: string; meaning: { voice: string; trait: string } | null }
  interface JjCard { hanja: string; elemKey: ElemKey; posKey: string; posLabel: string; role: string; roleDesc: string; entries: JjEntry[]; isCore?: boolean }

  function buildEntries(jj: JiJangGan): JjEntry[] {
    return jj.지장간.map((g, gi) => {
      const gOheng = CHEONGAN_OHENG[g];
      const gElem = gOheng ? OHENG_TO_ELEM[gOheng] : 'earth' as ElemKey;
      const gKr = CHEONGAN_KO[g] ?? g;
      const rawSip = jj.십성[gi] ?? '';
      // 십성 데이터 없으면 일간 기준으로 직접 계산 (캐시된 구 데이터 대응)
      const sip = rawSip ? toKrSipsung(rawSip) : calcSipsung(g);
      return { hanja: g, kr: gKr, elemKey: gElem, sipsung: sip, meaning: getSipsungPersonalized(sip) };
    });
  }

  const cards: JjCard[] = [];
  const yearJj = jijanggan[0]; const monthJj = jijanggan[1]; const dayJj = jijanggan[2];
  const timeJj = hasBirthTime && jijanggan[3] ? jijanggan[3] : null;

  if (yearJj && monthJj && yearJj.지지 === monthJj.지지) {
    const zhiOheng = JIJI_OHENG[yearJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
    const kr = JIJI_KO[yearJj.지지] ?? yearJj.지지; const pos = '년지+월지';
    cards.push({ hanja: yearJj.지지, elemKey, posKey: pos, posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext[pos]?.role ?? pos, roleDesc: posContext[pos]?.desc ?? '', entries: buildEntries(yearJj) });
  } else {
    if (yearJj) {
      const zhiOheng = JIJI_OHENG[yearJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
      const kr = JIJI_KO[yearJj.지지] ?? yearJj.지지;
      cards.push({ hanja: yearJj.지지, elemKey, posKey: '년지', posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext['년지'].role, roleDesc: posContext['년지'].desc, entries: buildEntries(yearJj) });
    }
    if (monthJj) {
      const zhiOheng = JIJI_OHENG[monthJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
      const kr = JIJI_KO[monthJj.지지] ?? monthJj.지지;
      cards.push({ hanja: monthJj.지지, elemKey, posKey: '월지', posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext['월지'].role, roleDesc: posContext['월지'].desc, entries: buildEntries(monthJj) });
    }
  }
  if (dayJj) {
    const zhiOheng = JIJI_OHENG[dayJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
    const kr = JIJI_KO[dayJj.지지] ?? dayJj.지지;
    cards.push({ hanja: dayJj.지지, elemKey, posKey: '일지', posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext['일지'].role, roleDesc: posContext['일지'].desc, entries: buildEntries(dayJj), isCore: true });
  }
  if (timeJj) {
    const zhiOheng = JIJI_OHENG[timeJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
    const kr = JIJI_KO[timeJj.지지] ?? timeJj.지지;
    cards.push({ hanja: timeJj.지지, elemKey, posKey: '시지', posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext['시지'].role, roleDesc: posContext['시지'].desc, entries: buildEntries(timeJj) });
  }

  // ─── 종합 해석 ───
  const allSipsung = cards.flatMap(c => c.entries.map(e => e.sipsung)).filter(s => s && s !== '일주' && s !== '');
  const sipsungCounts: Record<string, number> = {};
  allSipsung.forEach(s => { sipsungCounts[s] = (sipsungCounts[s] || 0) + 1; });
  const topSipsung = Object.entries(sipsungCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const summaryParts = topSipsung.map(([sip, count]) => {
    const m = getSipsungPersonalized(sip);
    return m ? `${m.voice}: ${m.trait.split('.')[0]} (${sip}${count >= 2 ? ' x' + count + ', 특히 강함' : ''})` : null;
  }).filter(Boolean);

  // 일지의 핵심 목소리
  const dayCard = cards.find(c => c.isCore);
  const dayVoices = dayCard?.entries.filter(e => e.meaning).map(e => e.meaning!.voice).join(' + ') ?? '';

  // ─── 성격 구성도 데이터 (5대 카테고리) ───
  const sipCategoryMap: Record<string, string> = {
    비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
    편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성',
    편인: '인성', 정인: '인성',
  };
  const catColors: Record<string, { main: string; light: string; label: string }> = {
    비겁: { main: '#4E7A57', light: '#E7EFE6', label: '자아/독립' },
    식상: { main: '#B04A38', light: '#F6E5E0', label: '표현/창작' },
    재성: { main: '#B07F38', light: '#F5EBD9', label: '재물/실리' },
    관성: { main: '#7D7870', light: '#EEECE8', label: '사회/직위' },
    인성: { main: '#3E5F82', light: '#E4EAF1', label: '학문/배움' },
  };
  const catCounts: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  allSipsung.forEach(s => { const cat = sipCategoryMap[s]; if (cat) catCounts[cat]++; });
  const catTotal = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="my-4 rounded-2xl overflow-hidden" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      {/* Section header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(180deg, #B8965A, #B8965A)' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#3D3427', letterSpacing: '-0.3px' }}>지장간: 내 안의 숨은 성격들</span>
        </div>
        <p style={{ fontSize: 13, color: '#a0937f', lineHeight: 1.7, marginLeft: 11 }}>
          각 기둥 속에 <b style={{ color: '#6b5b47' }}>2~3개의 숨은 성격</b>이 있어요.<br />
          겉으로 안 보이지만 내면에서 끊임없이 영향을 주는 목소리들이에요.
        </p>
      </div>

      {/* 성격 구성도 (Personality Composition Bar) */}
      <div className="mx-4 mb-3 p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#B8965A', marginBottom: 8, letterSpacing: '0.5px' }}>
          성격 구성도
        </p>
        {/* Horizontal stacked bar */}
        <div className="flex rounded-full overflow-hidden" style={{ height: 14 }}>
          {Object.entries(catCounts).map(([cat, cnt]) => {
            const pct = (cnt / catTotal) * 100;
            if (pct === 0) return null;
            return (
              <div key={cat} style={{ width: `${pct}%`, background: catColors[cat].main, minWidth: pct > 0 ? 8 : 0, transition: 'width 0.5s ease' }} />
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2.5">
          {Object.entries(catCounts).map(([cat, cnt]) => {
            const pct = Math.round((cnt / catTotal) * 100);
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <div style={{ width: 8, height: 8, borderRadius: 2, background: catColors[cat].main, opacity: cnt > 0 ? 1 : 0.25 }} />
                <span style={{ fontSize: 12, color: cnt > 0 ? '#6b5b47' : '#c4bab0', fontWeight: cnt > 0 ? 600 : 400 }}>
                  {cat}<span style={{ fontSize: 12, color: '#a0937f', marginLeft: 2 }}>{catColors[cat].label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: catColors[cat].main, marginLeft: 3 }}>{pct}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 나의 내면 요약 */}
      {summaryParts.length > 0 && (
        <div className="mx-4 mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(184,150,90,0.2)' }}>
          <div className="px-4 py-2.5" style={{ background: 'linear-gradient(135deg, #F5F0E8 0%, #EDE5D5 100%)' }}>
            <p style={{ fontSize: 13.5, fontWeight: 800, color: '#B8965A', letterSpacing: '-0.2px' }}>나의 내면 요약</p>
          </div>
          <div className="px-4 py-3 space-y-2.5" style={{ background: 'linear-gradient(180deg, #FDFBF7, #faf7f2)' }}>
            {summaryParts.map((part, i) => (
              <p key={i} style={{ fontSize: 13.5, color: '#4a3f33', lineHeight: 1.75, wordBreak: 'keep-all' }}>{part}</p>
            ))}
            {dayVoices && (
              <div className="flex items-start gap-2 mt-1 pt-2.5" style={{ borderTop: '1px dashed #e0d8cc' }}>
                <div style={{ width: 3, minHeight: 20, borderRadius: 2, background: '#B8965A', marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: '#6b5b47', lineHeight: 1.65 }}>
                  특히 <b style={{ color: '#B8965A' }}>일지(본질)</b>에서 {dayVoices} 목소리가 가장 강하게 작동해요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 카드 리스트 (세로) */}
      <div className="px-4 pb-1 space-y-3">
        {cards.map((card, ci) => {
          const ec = EC[card.elemKey];
          return (
            <div key={ci} className="rounded-xl overflow-hidden" style={{
              border: card.isCore ? '2px solid #B8965A' : `1px solid ${ec.med}`,
              boxShadow: card.isCore ? '0 2px 12px rgba(184,150,90,0.15)' : '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              {/* 카드 헤더 */}
              <div className="flex items-center gap-3 px-3.5 py-3" style={{
                background: card.isCore
                  ? 'linear-gradient(135deg, #F7F1E6 0%, #EDE2CF 50%, #E8DABE 100%)'
                  : `linear-gradient(135deg, ${ec.light} 0%, ${ec.light}ee 60%, ${ec.med}44 100%)`,
              }}>
                <div className="flex-shrink-0 flex items-center justify-center" style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: card.isCore ? 'linear-gradient(135deg, #B8965A, #b8965a)' : `linear-gradient(135deg, ${ec.main}, ${ec.dark})`,
                  boxShadow: card.isCore ? '0 2px 8px rgba(184,150,90,0.3)' : `0 2px 6px ${ec.main}33`,
                }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{card.hanja}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#3D3427' }}>{card.posKey}</span>
                    {card.isCore && (
                      <span style={{
                        fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.5px',
                        background: 'linear-gradient(135deg, #B8965A, #b8965a)',
                        borderRadius: 6, padding: '2px 8px',
                        boxShadow: '0 1px 4px rgba(184,150,90,0.3)',
                      }}>핵심</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: '#8b7e6f', marginTop: 1 }}>{card.role}: {card.roleDesc}</p>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: card.isCore ? '#B8965A' : ec.main,
                  background: card.isCore ? 'rgba(184,150,90,0.1)' : `${ec.light}`,
                  borderRadius: 6, padding: '2px 7px',
                  border: card.isCore ? '1px solid rgba(184,150,90,0.25)' : `1px solid ${ec.med}`,
                }}>{card.posLabel}</span>
              </div>
              {/* 숨은 성격 목록 */}
              <div className="px-3.5 py-2.5 space-y-0" style={{ background: '#fff' }}>
                {card.entries.map((e, ei) => {
                  const eec = EC[e.elemKey];
                  return (
                    <div key={ei} className="flex items-start gap-3 py-2.5" style={{
                      // 2026-05-28 — 좌측 strip 제거 (균일 list AI 손톱 디자인 티). bullet 한자 컬러로 톤 표현.
                      paddingLeft: 10,
                      ...(ei < card.entries.length - 1 ? { borderBottom: '1px solid #f5f0e8' } : {}),
                    }}>
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{
                        background: `linear-gradient(135deg, ${eec.light}, ${eec.med}44)`,
                        border: `1px solid ${eec.med}`,
                      }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: eec.dark }}>{e.hanja}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#3D3427' }}>{e.kr}</span>
                          {e.sipsung && (
                            <span style={{
                              fontSize: 12, fontWeight: 700, color: eec.dark,
                              background: `linear-gradient(135deg, ${eec.light}, ${eec.med}55)`,
                              borderRadius: 5, padding: '1.5px 6px',
                              border: `1px solid ${eec.med}88`,
                            }}>{e.sipsung}</span>
                          )}
                        </div>
                        {e.meaning ? (
                          <div style={{ marginTop: 4 }}>
                            <div className="flex items-start gap-0" style={{ marginBottom: 3 }}>
                              <div style={{ width: 2, minHeight: 14, borderRadius: 1, background: '#B8965A', marginTop: 3, marginRight: 6, flexShrink: 0 }} />
                              <p style={{ fontSize: 13, color: '#B8965A', fontWeight: 700, lineHeight: 1.5, fontStyle: 'normal' }}>{e.meaning.voice}</p>
                            </div>
                            <p style={{ fontSize: 13, color: '#6b5b47', lineHeight: 1.65 }}>{e.meaning.trait}</p>
                          </div>
                        ) : e.sipsung ? (
                          <p style={{ fontSize: 13, color: '#8b7e6f', marginTop: 3 }}>{e.sipsung} 기운</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 해석 가이드 */}
      <div className="mx-4 mt-3 mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #e8e0d4' }}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'linear-gradient(135deg, #faf5eb, #f3eadb)', borderBottom: '1px solid #e8e0d4' }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: 'linear-gradient(135deg, #B8965A, #b8965a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 800 }}>?</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#B8965A' }}>이렇게 읽어요</span>
        </div>
        <div className="px-3.5 py-3 space-y-2" style={{ background: '#fff' }}>
          <p style={{ fontSize: 13, color: '#6b5b47', lineHeight: 1.75 }}>
            각 칸마다 2~3개의 숨은 성격이 있어요. 예를 들어 한 칸에 "제대로 해야 해" + "더 배우고 싶어"가 같이 있으면, <b style={{ color: '#3D3427' }}>완벽주의와 학습욕이 동시에 작동</b>하는 성격이에요.
          </p>
          <div className="flex items-start gap-2 pt-1" style={{ borderTop: '1px dashed #e8e0d4' }}>
            <div style={{ width: 3, minHeight: 28, borderRadius: 2, background: '#B8965A', marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: '#6b5b47', lineHeight: 1.75 }}>
              <b style={{ color: '#B8965A' }}>일지 = 진짜 나</b> (가장 중요), 년지 = 어릴 때 모습, 시지 = 나이 들수록 나타나는 모습이에요. 같은 십성이 여러 칸에 반복되면 그 성향이 특히 강해요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CareerFitVis({ aiCareerFit, dayOheng, elements, sipDist }: {
  aiCareerFit?: { job: string; score: number; reason?: string }[];
  dayOheng: OhengType;
  elements: V4Elements;
  sipDist?: { 비겁: number; 식상: number; 재성: number; 관성: number; 인성: number };
}) {
  // 사주 기반 직업 추천 생성 (AI 결과 없을 때 + AI 결과 보강)
  function generateFromSaju(): { job: string; score: number; reason: string; basis: string }[] {
    const dist = sipDist || { 비겁: 2, 식상: 2, 재성: 2, 관성: 2, 인성: 2 };
    const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    const pct = {
      비겁: Math.round((dist.비겁 / total) * 100),
      식상: Math.round((dist.식상 / total) * 100),
      재성: Math.round((dist.재성 / total) * 100),
      관성: Math.round((dist.관성 / total) * 100),
      인성: Math.round((dist.인성 / total) * 100),
    };

    // 일간 오행 × 십성 조합별 초구체적 직업 매핑
    const CAREER_BY_SIPSUNG: Record<string, Record<OhengType, { job: string; reason: string }>> = {
      식상: {
        목: { job: '교육 콘텐츠 크리에이터 (유튜브/클래스101)', reason: '목 일간의 식상 = 나무가 꽃을 피우듯 지식을 콘텐츠로 변환하는 능력. 성장을 가르치는 교육 분야에서 표현력이 극대화' },
        화: { job: '영상 PD / 숏폼 콘텐츠 디렉터', reason: '화 일간의 식상 = 불꽃이 빛으로 변하듯 시각적 표현에 천부적 감각. 미디어와 영상 분야에서 창작 기운이 크게 살아남' },
        토: { job: '요식업 프랜차이즈 오너 / 쿠킹클래스 운영', reason: '토 일간의 식상 = 대지가 열매를 맺듯 음식과 맛 관련 창작에 강점. 외식업과 푸드테크에서 안정적 수익 구조 설계 능력' },
        금: { job: '보석감정사 / 귀금속 디자이너', reason: '금 일간의 식상 = 쇠를 다듬어 작품으로 만드는 정교함. 정밀 공예와 디자인 분야에서 섬세한 표현력 발휘' },
        수: { job: '데이터 기반 마케팅 전략가', reason: '수 일간의 식상 = 물이 흘러가며 길을 만들듯 자료에서 핵심을 뽑아내는 능력. 분석+표현 융합형 직무에 최적' },
      },
      재성: {
        목: { job: '친환경 부동산 투자 컨설턴트', reason: '목 일간이 토를 극해 재성 = 성장 기운으로 부동산과 토지를 관리. ESG, 녹색 건축 분야에서 투자 안목이 뛰어남' },
        화: { job: '핀테크 자산관리 플래너 (로보어드바이저)', reason: '화 일간이 금을 극해 재성 = 열정적 판단력으로 금융 자산을 다루는 능력. IT+금융 융합 분야에서 빠른 의사결정이 강점' },
        토: { job: '수산물 유통/해외 무역 사업가', reason: '토 일간이 수를 극해 재성 = 안정적 관리력으로 유통과 물류를 장악. 실물 거래에서 꼼꼼한 관리 능력이 수익으로 연결' },
        금: { job: '임업/목재 가공 스타트업 대표', reason: '금 일간이 목을 극해 재성 = 원재료를 가공해 가치를 만드는 구조. 제조, 가공, 원자재 분야에서 수익 창출 능력' },
        수: { job: '전기차/신기운 투자 애널리스트', reason: '수 일간이 화를 극해 재성 = 냉정한 분석력으로 기운 시장을 읽는 능력. 신기술 투자에서 리스크 관리 탁월' },
      },
      관성: {
        목: { job: '국가직 7급 교육행정 사무관', reason: '목 일간의 관성(금) = 나무를 다듬는 가위. 교육과 환경 분야 공직에서 조직력과 성장 마인드가 어울림' },
        화: { job: '소방방재청 안전정책 기획관', reason: '화 일간의 관성(수) = 불을 제어하는 물의 힘. 안전, 방재, 위기관리 분야 공직에서 열정과 규율의 균형이 강점' },
        토: { job: '도시계획 전문 건축행정 공무원', reason: '토 일간의 관성(목) = 땅 위에 나무를 심는 구조. 국토, 건축, 도시계획 분야에서 안정적 관리와 성장 비전 양립' },
        금: { job: '검찰/금융감독원 조사관', reason: '금 일간의 관성(화) = 불에 단련되는 쇠. 법집행과 금융감독 분야에서 날카로운 분석력과 강한 추진력 발휘' },
        수: { job: '과학기술정보통신부 R&D 정책관', reason: '수 일간의 관성(토) = 물길을 잡아주는 제방. 기술정책과 연구관리 분야에서 깊은 전문성과 체계적 관리력 병행' },
      },
      인성: {
        목: { job: '대학교수 (교육학/심리학 전공)', reason: '목 일간의 인성(수) = 나무에게 물을 주는 근원. 교육과 연구 분야에서 학문적 깊이와 성장 지향성이 조화' },
        화: { job: 'AI/머신러닝 연구원 (네이버/카카오급)', reason: '화 일간의 인성(목) = 불꽃에 장작을 더하듯 끊임없이 배우는 기운. 첨단 기술 연구에서 열정+학습력 극대화' },
        토: { job: '한의사 / 전통의학 연구자', reason: '토 일간의 인성(화) = 대지를 데우는 햇볕. 전통 지식을 현대에 접목하는 분야에서 깊은 이해력과 실용성 발휘' },
        금: { job: '특허 전문 변리사 / 기술거래사', reason: '금 일간의 인성(토) = 쇠의 원광석. 기술과 지식재산 분야에서 정밀한 분석력과 체계적 학습 능력이 강점' },
        수: { job: '빅데이터 사이언티스트 (삼성SDS급)', reason: '수 일간의 인성(금) = 물을 정화하는 금속. 데이터와 통계 기반 연구에서 깊이 있는 분석력과 논리적 사고력 발휘' },
      },
      비겁: {
        목: { job: '에듀테크 스타트업 CEO (클래스101 유형)', reason: '목 일간의 비겁 = 나무가 숲을 이루듯 교육 플랫폼을 키우는 리더십. 성장 분야에서 독립적 사업 능력' },
        화: { job: 'SaaS/앱 서비스 스타트업 창업 CEO', reason: '화 일간의 비겁 = 불꽃이 불꽃을 만나 더 크게 타오르듯, IT 서비스 분야에서 폭발적 추진력으로 시장 개척' },
        토: { job: '부동산 개발/시행 법인 대표', reason: '토 일간의 비겁 = 대지가 넓어지듯 부동산과 건설 분야에서 안정적이면서도 확장하는 사업 구조에 적합' },
        금: { job: '법무법인/세무법인 공동대표', reason: '금 일간의 비겁 = 쇠가 모여 강해지듯 전문직 파트너십 구조에서 날카로운 경쟁력 발휘' },
        수: { job: '지식 플랫폼/온라인 교육 운영자', reason: '수 일간의 비겁 = 물이 모여 강을 이루듯 지식과 정보 기반 플랫폼에서 깊이와 규모를 동시에 확보' },
      },
    };

    const careers: { job: string; score: number; reason: string; basis: string }[] = [];

    // 십성 분포 기반 추천 — 일간 오행별 초구체적 직업
    const sipEntries = [
      { key: '식상' as const, count: dist.식상, pctVal: pct.식상, base: 70 },
      { key: '재성' as const, count: dist.재성, pctVal: pct.재성, base: 68 },
      { key: '관성' as const, count: dist.관성, pctVal: pct.관성, base: 66 },
      { key: '인성' as const, count: dist.인성, pctVal: pct.인성, base: 65 },
      { key: '비겁' as const, count: dist.비겁, pctVal: pct.비겁, base: 64 },
    ].sort((a, b) => b.pctVal - a.pctVal);

    for (const entry of sipEntries) {
      if (entry.pctVal >= 20 && careers.length < 5) {
        const careerInfo = CAREER_BY_SIPSUNG[entry.key]?.[dayOheng];
        if (careerInfo) {
          careers.push({
            job: careerInfo.job,
            score: Math.min(95, entry.base + entry.pctVal),
            reason: careerInfo.reason,
            basis: `${entry.key} ${entry.count}개 (${entry.pctVal}%)`,
          });
        }
      }
    }

    // 최소 3개 보장 — 오행 강약 기반 추가
    if (careers.length < 3) {
      const elemArr = Object.entries(elements) as [ElemKey, number][];
      const strongElem = elemArr.reduce((a, b) => a[1] > b[1] ? a : b);
      const ELEM_TO_OHENG = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' } as Record<ElemKey, OhengType>;
      const ohKey = ELEM_TO_OHENG[strongElem[0]];
      // 강한 오행 기반 보조 직업
      const OHENG_SUB: Record<OhengType, { job: string; reason: string }[]> = {
        목: [
          { job: '환경/ESG 전문 컨설턴트', reason: `목 기운이 강해(${strongElem[1]}%) 성장과 환경 분야에서 자연스러운 적성. 지속가능성 분야에서 장기적 커리어 유망` },
          { job: '인테리어/공간 디자이너', reason: '목의 창조 기운이 공간 설계에서 발현. 나무, 식물, 자연소재를 활용한 디자인에 감각이 있어요' },
        ],
        화: [
          { job: 'UX/UI 디자이너 (토스/배민급)', reason: `화 기운이 강해(${strongElem[1]}%) 시각적 표현과 사용자 경험 설계에 뛰어난 감각. 디지털 디자인 분야 천직` },
          { job: '퍼포먼스 마케터 (CPA/ROAS 전문)', reason: '화의 확산 기운이 마케팅에서 발현. 데이터 기반 광고 최적화에서 빠른 판단력 발휘' },
        ],
        토: [
          { job: '프로젝트 매니저(PM) / 스크럼마스터', reason: `토 기운이 강해(${strongElem[1]}%) 사람과 일을 조율하는 능력 탁월. 팀을 안정적으로 이끄는 관리형 리더` },
          { job: '공인중개사 / 자산관리 전문가', reason: '토의 안정 기운이 부동산과 자산 분야에서 발현. 장기적 자산 설계에 강점' },
        ],
        금: [
          { job: 'CPA 세무사 / 관세사', reason: `금 기운이 강해(${strongElem[1]}%) 숫자와 규칙에 정확한 분석력. 회계, 세무, 관세 분야에서 꼼꼼함이 무기` },
          { job: '의료기기/바이오 전문 영업 (메드트로닉급)', reason: '금의 정밀 기운이 의료 분야에서 발현. 전문 지식 기반 B2B 영업에 강점' },
        ],
        수: [
          { job: '심리상담사 / 코칭 전문가 (ICF 인증)', reason: `수 기운이 강해(${strongElem[1]}%) 깊은 안목과 공감 능력. 상담과 코칭 분야에서 신뢰감 있는 전문가` },
          { job: '국제무역/수출입 스페셜리스트', reason: '수의 유통 기운이 무역에서 발현. 해외 시장 분석과 글로벌 네트워킹에 재능' },
        ],
      };
      const subs = OHENG_SUB[ohKey] || OHENG_SUB['토'];
      for (const sub of subs) {
        if (careers.length < 5) {
          careers.push({ job: sub.job, score: Math.min(82, 58 + strongElem[1]), reason: sub.reason, basis: `${ohKey} 오행 ${strongElem[1]}%` });
        }
      }
    }

    return careers.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  const fits = (aiCareerFit && aiCareerFit.length > 0)
    ? aiCareerFit.sort((a, b) => b.score - a.score).map((cf) => ({
        label: cf.job,
        score: cf.score,
        reason: cf.reason || '',
        basis: '',
      }))
    : generateFromSaju().map(cf => ({
        label: cf.job,
        score: cf.score,
        reason: cf.reason,
        basis: cf.basis,
      }));

  if (fits.length === 0) return null;

  const SCORE_COLORS = ['#B8965A', '#4E7A57', '#3E5F82', '#B07F38', '#7D7870'];
  const topFit = fits[0];
  const strongFields = fits.filter(f => f.score >= 75);
  const weakFields = fits.filter(f => f.score < 55);

  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#6b5b47', marginBottom: 4 }}>▎직업 적성 매칭도</div>
      <p style={{ fontSize: 12, color: '#8b7e6f', marginBottom: 12, lineHeight: 1.5 }}>
        일간 오행({dayOheng}), 십성 분포, 오행 밸런스를 종합 분석하여 적합한 직업을 도출했어요
      </p>

      {/* 종합 해석 */}
      <div className="mb-4 p-3.5 rounded-xl" style={{ background: 'linear-gradient(135deg, #f5f0e8, #ede5d5)', border: '1px solid rgba(184,150,90,0.25)' }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#B8965A', marginBottom: 4 }}>나의 직업 성향 요약</p>
        <p style={{ fontSize: 13.5, color: '#6b5b47', lineHeight: 1.7 }}>
          <b>{topFit.label}</b> 분야와 궁합이 가장 좋아요 ({topFit.score}%).
          {strongFields.length > 1 && <> <b>{strongFields.slice(1).map(f => f.label).join(', ')}</b> 분야도 잘 맞는 편이에요.</>}
          {weakFields.length > 0 && <> 반면 <b>{weakFields.map(f => f.label).join(', ')}</b>은 기운 소모가 클 수 있어요, 못한다는 게 아니라 더 힘이 드는 방향이에요.</>}
        </p>
      </div>

      {/* 직업 카드 */}
      <div className="space-y-3">
        {fits.map((f, i) => {
          const color = SCORE_COLORS[i % SCORE_COLORS.length];
          const isTop = f.score >= 80;
          const isWeak = f.score < 55;
          return (
            <div key={i} className="rounded-xl overflow-hidden" style={{
              border: isTop ? `2px solid ${color}40` : `1px solid #e8e0d4`,
            }}>
              {/* 바 영역 */}
              <div className="p-3" style={{ background: isTop ? `${color}08` : '#fff' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                    <span style={{ fontSize: 13.5, fontWeight: 900, color }}>{i + 1}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#6b5b47', flex: 1 }}>{f.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color }}>{f.score}%</span>
                </div>
                <div className="rounded-full overflow-hidden mb-2" style={{ height: 8, background: '#efe8db' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${f.score}%`,
                    background: `linear-gradient(90deg, ${color}80, ${color})`,
                    transition: 'width 1s ease',
                  }} />
                </div>
                {/* 점수 범위 해석 */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="rounded-full px-2 py-0.5" style={{
                    fontSize: 12, fontWeight: 700,
                    background: isTop ? `${color}15` : isWeak ? '#fff3e0' : '#EEECE8',
                    color: isTop ? color : isWeak ? '#8A6226' : '#7D7870',
                  }}>
                    {isTop ? '천직 수준' : isWeak ? '기운 소모 큼' : f.score >= 65 ? '충분히 적합' : '보조 적성'}
                  </span>
                  {f.basis && (
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 12, fontWeight: 600, background: '#f5f0e8', color: '#B8965A' }}>
                      {f.basis}
                    </span>
                  )}
                </div>
                {/* 사주 근거 */}
                {f.reason && (
                  <div className="p-2.5 rounded-lg" style={{ background: '#faf7f2', border: '1px dashed #e8e0d4' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 2 }}>왜 이 직업이 나왔을까?</p>
                    <p style={{ fontSize: 13, color: '#6b5b47', lineHeight: 1.7 }}>{f.reason}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 해석 가이드 */}
      <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#F5EBD9', border: '1px solid #ffe082' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#B07F38', marginBottom: 3 }}>이렇게 읽어요</p>
        <p style={{ fontSize: 12, color: '#8b7e6f', lineHeight: 1.6 }}>
          점수 기준: 80% 이상 = 사주의 기운 흐름과 가장 잘 맞는 '천직' 수준.
          65~79% = 타고난 적성이 충분히 있어 잘 해낼 수 있는 분야.
          55~64% = 노력하면 되지만 기운이 더 드는 방향.
          55% 미만 = 이 방향보다 더 맞는 길이 있다는 신호.
          <b style={{ color: '#6b5b47' }}> 점수는 일간 오행({dayOheng}), 십성 분포, 오행 밸런스를 종합 산출한 결과예요.</b>
        </p>
      </div>
    </div>
  );
}

export function HealthVis({ elements, dayOheng, dayGan, aiHealth, pillars: _pillars }: {
  elements: V4Elements; dayOheng: OhengType; pillars: Pillar[];
  /** 일간 한자 (예: '甲'·'乙'). 사주 specific 인용에 사용 */
  dayGan?: string;
  /** AI 응답의 health 필드 — 있으면 detail 우선 사용 */
  aiHealth?: { wood?: { detail?: string }; fire?: { detail?: string }; earth?: { detail?: string }; metal?: { detail?: string }; water?: { detail?: string } };
}) {
  // 일간 한자 → 한글 음 매핑
  const GAN_TO_KR_LOCAL: Record<string, string> = {
    甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
    己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
  };
  const ganKr = dayGan ? (GAN_TO_KR_LOCAL[dayGan] || dayGan) : '';
  const ganRef = dayGan ? `${ganKr}(${dayGan}) 일간` : `${dayOheng} 일간`;

  // 오행<->장기 매핑 (동의보감 기준)
  const HEALTH_MAP: Record<ElemKey, { organ: string; detail: string; strong: string; weak: string; fix: string }> = {
    wood: {
      organ: '간(肝), 담, 눈, 근육',
      detail: '해독 능력, 시력, 근육의 유연성을 관장',
      strong: '스트레스가 간에 쌓이기 쉬움. 분노 조절과 충분한 수면, 음주 절제가 핵심이에요',
      weak: '눈이 쉽게 피로하고 근육이 뻣뻣해질 수 있어요. 스트레칭, 녹색 채소, 간 해독에 신경 쓰세요',
      fix: '산책과 등산(목 기운 보충), 녹색 채소와 쑥차, 새벽 기상 습관',
    },
    fire: {
      organ: '심장(心), 소장, 혈관, 혀',
      detail: '혈액순환, 체온 조절, 정신 건강을 관장',
      strong: '심장에 부담이 갈 수 있어요. 과로와 과열 주의, 시원한 음식과 명상으로 열을 식히세요',
      weak: '혈액순환이 약하고 수족 냉증이 올 수 있어요. 유산소 운동과 따뜻한 차(생강과 계피)를 추천해요',
      fix: '유산소 운동(달리기와 자전거), 쓴맛 음식(커피와 미역), 충분한 수면',
    },
    earth: {
      organ: '비장(脾), 위(胃), 소화기, 입',
      detail: '소화 흡수, 면역력, 기운 전환을 관장',
      strong: '과식과 폭식 주의. 위산 과다나 소화불량이 올 수 있어요. 규칙적 식사와 가벼운 식단이 중요해요',
      weak: '소화력이 약해 체력이 금방 떨어질 수 있어요. 따뜻한 음식, 잡곡밥, 규칙적 식사 시간이 핵심이에요',
      fix: '규칙적 식사, 단맛 음식(꿀과 고구마), 복부 마사지와 산책',
    },
    metal: {
      organ: '폐(肺), 대장, 코, 피부',
      detail: '호흡기, 면역 방어, 피부 건강을 관장',
      strong: '피부 건조함이나 호흡기 과민 반응에 주의. 보습과 환기를 신경 쓰고, 매운 음식을 줄이세요',
      weak: '감기에 자주 걸리고 피부 트러블이 생기기 쉬워요. 호흡 운동, 환절기 마스크 착용, 보습 케어가 필수예요',
      fix: '심호흡과 단전호흡, 매운맛 적정 섭취(무, 배, 도라지), 공기청정기 활용',
    },
    water: {
      organ: '신장(腎), 방광, 귀, 뼈',
      detail: '생명력의 근원, 체력, 생식기능, 뼈 건강을 관장',
      strong: '부종이나 냉증이 올 수 있어요. 땀을 흘리는 운동과 따뜻하게 유지하는 습관이 중요해요',
      weak: '체력이 쉽게 바닥나고 허리와 무릎이 약해질 수 있어요. 수분 섭취, 하체 운동, 검은깨와 검은콩이 도움돼요',
      fix: '수영과 하체 운동, 짠맛 적정 섭취(해산물과 미역), 족욕과 반신욕',
    },
  };

  // 오행 수치로 상태 판단
  const items = (['wood', 'fire', 'earth', 'metal', 'water'] as ElemKey[]).map(elem => {
    const val = elements[elem];
    const info = HEALTH_MAP[elem];
    let status: string;
    let statusColor: string;
    let advice: string;
    let level: number; // 0~4

    // AI 응답에 detail 이 있으면 모든 분기에서 우선 사용
    const aiDetail = aiHealth?.[elem]?.detail?.trim();
    // 사주 specific 접두 — "{ganRef}이 ${oheng} ${val}자라"
    const ohengKr = ({ wood: '목', fire: '화', earth: '토', metal: '금', water: '수' } as const)[elem];
    const ganPrefix = dayGan ? `${ganRef}이 ${ohengKr} ${val}자, ` : '';

    if (val === 0) {
      status = '없음'; statusColor = '#A23A2A';
      advice = aiDetail || `${ganPrefix}${info.weak}`;
      level = 0;
    } else if (val <= 10) {
      status = '약함'; statusColor = '#8A6226';
      advice = aiDetail || `${ganPrefix}${info.weak}`;
      level = 1;
    } else if (val <= 25) {
      status = '양호'; statusColor = '#4E7A57';
      advice = aiDetail || `${ganPrefix}균형 잡힌 상태예요. ${info.fix.split(',')[0]}으로 유지하세요`;
      level = 3;
    } else if (val <= 35) {
      status = '강함'; statusColor = '#3E5F82';
      advice = aiDetail || `${ganPrefix}기운이 충분해요. 다만 과하면 ${info.organ.split(', ')[0]}에 부담이 갈 수 있으니 적당히 조절하세요`;
      level = 4;
    } else {
      status = '과다'; statusColor = '#A23A2A';
      advice = aiDetail || `${ganPrefix}${info.strong}`;
      level = 4;
    }

    return { elem, organ: info.organ, detail: info.detail, status, statusColor, advice, fix: info.fix, level, val };
  });

  // 가장 취약한 장기 + 가장 과한 장기
  const weakest = items.reduce((a, b) => a.val < b.val ? a : b);
  const strongest = items.reduce((a, b) => a.val > b.val ? a : b);

  // 일간 오행 특성에 따른 추가 조언
  const dayHealthTip: Record<OhengType, string> = {
    목: '목 일간은 스트레스를 간에 쌓는 경향이 있어요. 분노를 참기보다 적절히 표현하고, 간 건강을 위해 음주를 절제하세요',
    화: '화 일간은 심장과 혈관에 열이 몰리기 쉬워요. 과로와 흥분을 피하고, 충분한 수면으로 심장에 휴식을 주세요',
    토: '토 일간은 위장이 예민한 편이에요. 불규칙한 식사가 가장 큰 적이고, 정해진 시간에 따뜻한 식사를 하면 컨디션이 좋아져요',
    금: '금 일간은 호흡기와 피부가 약점이에요. 환절기 감기와 피부 건조에 특히 주의하고, 보습과 실내 환기를 습관화하세요',
    수: '수 일간은 신장과 허리에 주의가 필요해요. 장시간 앉아있기를 피하고, 하체 운동과 충분한 수분 섭취가 건강의 핵심이에요',
  };

  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#6b5b47', marginBottom: 4 }}>
        ▎오행별 건강 분석
      </div>
      <p style={{ fontSize: 12, color: '#a0937f', marginBottom: 12, lineHeight: 1.5 }}>
        오행 분포를 기반으로 장기별 강약을 분석했어요. 부족한 오행의 장기를 의식적으로 관리하면 건강을 지킬 수 있어요.
      </p>

      {/* 종합 진단 */}
      <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.25)' }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#B8965A', marginBottom: 4 }}>종합 건강 진단</p>
        <p style={{ fontSize: 13.5, color: '#6b5b47', lineHeight: 1.7 }}>
          가장 주의할 장기는 <b style={{ color: '#A23A2A' }}>{weakest.organ}</b>({EHAN[weakest.elem]}, {weakest.status})이에요.
          {strongest.val > 35 && <> 반면 <b style={{ color: '#3E5F82' }}>{strongest.organ}</b>({EHAN[strongest.elem]})은 기운이 과해 부담이 갈 수 있어요.</>}
        </p>
        <p style={{ fontSize: 13, color: '#8b7e6f', marginTop: 6, lineHeight: 1.6 }}>
          {dayHealthTip[dayOheng]}
        </p>
      </div>

      {/* 장기별 카드 */}
      <div className="space-y-2.5">
        {items.map((it, i) => {
          const ec = EC[it.elem];
          const isAlert = it.val === 0 || it.val > 35;
          return (
            <div key={i} className="rounded-xl overflow-hidden" style={{
              border: isAlert ? `2px solid ${it.statusColor}40` : `1px solid ${ec.med}`,
            }}>
              {/* 헤더 */}
              <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: ec.light }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: ec.dark }}>{EHAN[it.elem]}</span>
                <div className="flex-1">
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#6b5b47' }}>{it.organ}</span>
                  <p style={{ fontSize: 12, color: '#a0937f' }}>{it.detail}</p>
                </div>
                <div className="text-center">
                  <span style={{ fontSize: 13, fontWeight: 900, color: it.statusColor }}>{it.status}</span>
                  <div className="flex gap-0.5 mt-1">
                    {[1,2,3,4].map(n => (
                      <div key={n} className="rounded-sm" style={{
                        width: 10, height: 4,
                        background: n <= it.level ? it.statusColor : '#e8e0d4',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
              {/* 상세 */}
              <div className="px-3 py-2.5" style={{ background: '#fff' }}>
                <p style={{ fontSize: 13, color: '#6b5b47', lineHeight: 1.7 }}>{it.advice}</p>
                <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${ec.med}` }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: ec.dark, marginBottom: 2 }}>보완법</p>
                  <p style={{ fontSize: 12, color: '#8b7e6f', lineHeight: 1.6 }}>{it.fix}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * GaewoonVis — 2026-05-05 동적화 (audit 1 P1)
 *  - 이전: 하드코딩 "수·금" 모든 유저 동일 출력
 *  - 이후: elements (오행 카운트) 기반 가장 약한 오행 1·2위 자동 도출 → 5 case 분기
 */
export function GaewoonVis({ elements }: { elements?: V4Elements }) {
  // 약한 오행 top-2 추출 (props 없으면 fallback "수·금" 유지)
  type OhengKey = '목' | '화' | '토' | '금' | '수';
  const KO_TO_EN: Record<OhengKey, keyof V4Elements> = {
    목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water',
  };
  const orderedWeak: OhengKey[] = (() => {
    if (!elements) return ['수', '금'];
    const counts: Array<[OhengKey, number]> = (['목', '화', '토', '금', '수'] as OhengKey[]).map(
      (k) => [k, Number(elements[KO_TO_EN[k]] ?? 0)],
    );
    counts.sort((a, b) => a[1] - b[1]);
    return [counts[0][0], counts[1][0]];
  })();
  const w1 = orderedWeak[0];
  const w2 = orderedWeak[1];

  // 오행별 개운법 매핑 — 5 × 4 카테고리
  const PROFILE: Record<OhengKey, { color: string; direction: string; food: string; exercise: string }> = {
    목: {
      color: '초록과 연두',
      direction: '동쪽',
      food: '잎채소, 견과, 곡물',
      exercise: '등산, 정원 가꾸기, 산책',
    },
    화: {
      color: '빨강과 주황',
      direction: '남쪽',
      food: '매운맛, 따뜻한 음식, 생강',
      exercise: '댄스, 요가, 유산소 운동',
    },
    토: {
      color: '노랑과 베이지',
      direction: '중앙',
      food: '단맛, 곡물, 뿌리채소',
      exercise: '도예, 정원, 산책',
    },
    금: {
      color: '흰색과 은색',
      direction: '서쪽',
      food: '매운맛, 견과, 하얀 음식',
      exercise: '서예, 미니멀 정리, 홈트',
    },
    수: {
      color: '검정과 남색',
      direction: '북쪽',
      food: '해산물, 검은깨, 짠맛',
      exercise: '수영, 반신욕, 낚시',
    },
  };
  const p1 = PROFILE[w1];
  const p2 = PROFILE[w2];

  const items: Array<{ id: 'color' | 'direction' | 'food' | 'exercise'; label: string; desc: string }> = [
    { id: 'color', label: '색상', desc: `${p1.color}(${w1}) + ${p2.color}(${w2})` },
    { id: 'direction', label: '방위', desc: `${p1.direction}(${w1}), ${p2.direction}(${w2}) 방향에 자리잡기` },
    { id: 'food', label: '음식', desc: `${p1.food}(${w1}) + ${p2.food}(${w2})` },
    { id: 'exercise', label: '운동', desc: `${p1.exercise}(${w1}) 우선, ${p2.exercise}(${w2}) 보조` },
  ];
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#6b5b47', marginBottom: 10 }}>
        ▎개운법 한눈에: 약한 기질 {w1}, {w2} 보강
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.id} className="p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Pictogram k={`gaewoon:${it.id}`} size={22} color="#6b5b47" />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: '#6b5b47' }}>{it.label}</span>
            </div>
            <div style={{ fontSize: 13, color: '#6b5b47', fontWeight: 500, lineHeight: 1.5 }}>{it.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── SectionVis dispatcher (PRD v2: 12섹션 + 4개 신규 시각화) ───
export function SectionVis({ type, elements, hasBirthTime, jijanggan, pillars, aiResult }: {
  type: string;
  elements: V4Elements;
  hasBirthTime: boolean;
  jijanggan: JiJangGan[];
  pillars: Pillar[];
  aiResult?: any;
}) {
  if (type === 'oheng_structure') return <OhengFlowVis elements={elements} hasBirthTime={hasBirthTime} />;
  if (type === 'jijanggan') return <JijangganVisComp jijanggan={jijanggan} pillars={pillars} hasBirthTime={hasBirthTime} />;
  if (type === 'career_fit') {
    const dOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const myeongri = (aiResult as any)?.analysisBase;
    const sipDistData = myeongri?.십성분포;
    return <CareerFitVis aiCareerFit={aiResult?.careerFit} dayOheng={dOheng} elements={elements} sipDist={sipDistData} />;
  }
  if (type === 'health_oheng') {
    const dOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const dGan = pillars[2]?.천간 ?? '';
    return <HealthVis elements={elements} dayOheng={dOheng} dayGan={dGan} aiHealth={(aiResult as any)?.health} pillars={pillars} />;
  }
  if (type === 'gaewoon') return <GaewoonVis elements={elements} />;
  // PRD v2 신규 시각화 — AI 결과가 있을 때만 표시
  if (type === 'luckyProfile') return aiResult?.luckyProfile ? <LuckyProfile data={aiResult.luckyProfile} /> : null;
  if (type === 'monthlyFortune') return aiResult?.monthlyFortune ? <MonthlyFortune data={aiResult.monthlyFortune} /> : null;
  if (type === 'relationshipMap') return aiResult?.relationshipMap ? <RelationshipMap data={aiResult.relationshipMap} /> : null;
  if (type === 'wealthFlow') {
    if (!aiResult?.wealthFlow) return null;
    const dayGanWF = pillars[2]?.천간 ?? '';
    const sipDistWF = (aiResult as any)?.analysisBase?.십성분포;
    return <WealthFlow
      data={aiResult.wealthFlow}
      dayGan={dayGanWF}
      jaeCount={sipDistWF?.재성}
      sikCount={sipDistWF?.식상}
      biCount={sipDistWF?.비겁}
    />;
  }
  if (type === 'challenge_vis') {
    // 인생과제 — VS 비율 분석 (실제 사주 오행 분포 기반 십성 비율)
    const dOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const dElem = OHENG_TO_ELEM[dOheng];
    const ecC = EC[dElem];
    const SYM_C: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
    const NAT_C: Record<OhengType, string> = { 목: '성장하는 나무', 화: '타오르는 불꽃', 토: '묵직한 대지', 금: '단단한 쇠', 수: '흐르는 물' };

    // ── 십성 → 오행 매핑 (V4Elements 영문 키 기준) ──
    // 비겁=나, 식상=내가 생, 재성=내가 극, 관성=나를 극, 인성=나를 생
    const SS_MAP: Record<OhengType, Record<string, ElemKey>> = {
      목: { 비겁: 'wood', 식상: 'fire', 재성: 'earth', 관성: 'metal', 인성: 'water' },
      화: { 비겁: 'fire', 식상: 'earth', 재성: 'metal', 관성: 'water', 인성: 'wood' },
      토: { 비겁: 'earth', 식상: 'metal', 재성: 'water', 관성: 'wood', 인성: 'fire' },
      금: { 비겁: 'metal', 식상: 'water', 재성: 'wood', 관성: 'fire', 인성: 'earth' },
      수: { 비겁: 'water', 식상: 'wood', 재성: 'fire', 관성: 'earth', 인성: 'metal' },
    };
    const ssm = SS_MAP[dOheng];
    const el = elements || { wood: 2, fire: 2, earth: 2, metal: 1, water: 1 };
    const getScore = (cats: string[]) => cats.reduce((s, c) => s + (el[ssm[c]] || 0), 0);
    const calcPct = (sA: string[], sB: string[]): number => {
      const a = getScore(sA), b = getScore(sB), t = a + b;
      if (t === 0) return 50;
      return Math.max(15, Math.min(85, Math.round((a / t) * 100)));
    };

    interface VsTheme {
      labelA: string; labelB: string;
      sideA: string[]; sideB: string[];
      tip: string;
      vH: string; // A쪽이 높을 때 해석
      vL: string; // B쪽이 높을 때 해석
    }

    const CM: Record<OhengType, { coreQ: string; summary: string; themes: VsTheme[] }> = {
      목: {
        coreQ: '어떻게 하면 곧게 자라면서도 부러지지 않을 수 있을까?',
        summary: '목(木) 일간의 인생 과제는 "성장과 유연성의 균형"입니다. 나무는 위로 뻗으려 하지만, 바람에 흔들리지 못하면 부러져요.',
        themes: [
          { labelA: '고집', labelB: '유연성',
            sideA: ['비겁', '인성'], sideB: ['관성', '식상', '재성'],
            tip: '일주일에 한 번, 내 의견과 반대되는 입장을 의도적으로 생각해보세요',
            vH: '자기 주장이 강한 사주예요. 내 생각이 틀릴 수도 있다는 가능성을 열어두는 것이 성장의 열쇠입니다.',
            vL: '유연하게 대처하는 힘이 있지만, 때로는 소신을 더 강하게 밀어붙여도 괜찮아요. 흔들리지 않는 중심이 필요해요.' },
          { labelA: '독립', labelB: '협력',
            sideA: ['비겁'], sideB: ['재성', '관성', '식상'],
            tip: '프로젝트마다 1명 이상 파트너를 만들어보세요. 혼자보다 빨라요',
            vH: '독립심이 강한 사주예요. 혼자 다 하려 하지 말고, 도움을 요청하는 것은 약함이 아니라 지혜임을 기억하세요.',
            vL: '협력을 잘하는 사주지만, 자기 결정권을 더 챙겨도 괜찮아요. 주도권을 잡는 연습이 필요해요.' },
          { labelA: '성급함', labelB: '인내',
            sideA: ['식상', '비겁'], sideB: ['인성', '관성', '재성'],
            tip: '중요한 결정은 최소 하루 묵혔다가 하세요. 48시간 규칙이 효과적',
            vH: '행동력은 빠르지만 조급해질 수 있는 사주예요. 뿌리를 깊이 내린 나무가 가장 오래 서 있어요. 의도적으로 천천히.',
            vL: '신중한 편이지만, 때로는 빠른 결단이 기회를 만들어요. 70% 확신이면 움직이세요. 완벽한 타이밍은 없어요.' },
        ],
      },
      화: {
        coreQ: '이 뜨거운 기운을 태워버리지 않고, 어디에 비출 것인가?',
        summary: '화(火) 일간의 인생 과제는 "열정의 방향 설정과 기운 분배"입니다. 불꽃은 밝지만, 조절 없이 타면 스스로 꺼져요.',
        themes: [
          { labelA: '열정', labelB: '절제',
            sideA: ['비겁', '식상'], sideB: ['관성', '인성', '재성'],
            tip: '번아웃 전조 증상(수면 장애, 의욕 저하)을 체크리스트로 만들어 관리하세요',
            vH: '열정이 넘치는 사주예요. 100%로 달리다 갑자기 0%가 되는 경향을 주의하세요. 70%가 가장 오래 가는 속도예요.',
            vL: '자기 조절력이 좋은 사주예요. 하지만 가끔은 열정을 더 풀어줘도 괜찮아요. 안전지대를 벗어나보세요.' },
          { labelA: '표현', labelB: '절제',
            sideA: ['식상', '비겁'], sideB: ['관성', '인성'],
            tip: '화가 날 때 10초 세고 말하는 습관. 메신저는 작성 후 5분 뒤 전송',
            vH: '표현욕이 강한 사주예요. 한 마디가 관계를 태울 수 있으니, 말하기 전 한 박자 쉬는 게 핵심이에요.',
            vL: '절제력이 있는 사주예요. 하지만 속 얘기를 더 꺼내는 연습도 필요해요. 침묵이 항상 답은 아니에요.' },
          { labelA: '즉흥', labelB: '계획',
            sideA: ['식상', '비겁'], sideB: ['재성', '관성', '인성'],
            tip: '분기별 목표 1개만 정해두세요. 나머지는 거기에 맞춰서 움직이면 돼요',
            vH: '즉흥적 기운이 강한 사주예요. 방향만 정하면 그 기운이 레이저가 돼요. 전략이 불꽃의 방향을 잡아줘요.',
            vL: '계획적인 사주지만, 가끔 직감을 믿고 뛰어드는 용기도 필요해요. 모든 걸 계획할 순 없어요.' },
        ],
      },
      토: {
        coreQ: '안정을 지키면서도 어떻게 앞으로 나아갈 수 있을까?',
        summary: '토(土) 일간의 인생 과제는 "안정 추구와 변화 수용의 균형"입니다. 대지는 든든하지만, 움직이지 않으면 새싹도 못 틔워요.',
        themes: [
          { labelA: '안정', labelB: '변화',
            sideA: ['비겁', '인성'], sideB: ['식상', '재성', '관성'],
            tip: '3개월에 1번은 새로운 것을 시도하세요. 새 취미, 새 모임, 새 루트',
            vH: '안정 지향 사주예요. 익숙한 환경에 머물려는 본능이 강하지만, 의식적으로 작은 변화를 시도해야 성장해요.',
            vL: '변화를 잘 수용하는 사주예요. 하지만 기본 토대를 더 단단히 다져두세요. 뿌리 없는 변화는 표류예요.' },
          { labelA: '포용', labelB: '경계',
            sideA: ['비겁', '인성'], sideB: ['관성', '재성', '식상'],
            tip: '부탁받으면 바로 대답하지 말고 "생각해볼게"라고 하세요',
            vH: '모두를 품으려는 사주예요. 정작 나를 잃기 쉬우니, NO라고 말하는 것도 사랑이에요.',
            vL: '적절한 경계가 있는 사주예요. 하지만 마음의 벽을 조금 낮춰도 괜찮아요. 신뢰는 열어야 시작돼요.' },
          { labelA: '신중', labelB: '결단',
            sideA: ['비겁', '인성'], sideB: ['식상', '관성', '재성'],
            tip: '작은 결정(메뉴, 옷)부터 5초 안에 고르는 연습을 하세요. 결단 근육이 커져요',
            vH: '신중하지만 결정이 느린 사주예요. 70% 확신이면 움직이세요. 기회는 기다려주지 않아요.',
            vL: '결단력이 있는 사주예요. 하지만 중요한 결정은 하루 더 생각해도 늦지 않아요. 신중함도 무기예요.' },
        ],
      },
      금: {
        coreQ: '완벽을 추구하면서도 어떻게 자신과 타인을 용서할 수 있을까?',
        summary: '금(金) 일간의 인생 과제는 "완벽주의와 유연함의 균형"입니다. 쇠는 날카롭고 정확하지만, 유연하지 못하면 깨져요.',
        themes: [
          { labelA: '완벽', labelB: '유연',
            sideA: ['비겁', '관성'], sideB: ['식상', '재성', '인성'],
            tip: '완벽하지 않아도 마감을 지키세요. 수정은 나중에 해도 돼요',
            vH: '완벽을 추구하는 사주예요. 80%면 일단 내보내세요. Done is better than perfect. 완벽은 적의 이름이에요.',
            vL: '유연한 사주지만, 디테일에 좀 더 신경쓰면 결과물의 질이 크게 달라져요. 마무리 한 끗이 중요해요.' },
          { labelA: '이성', labelB: '감성',
            sideA: ['비겁', '관성'], sideB: ['식상', '인성', '재성'],
            tip: '하루 1번, 가까운 사람에게 감정을 표현하는 연습을 하세요',
            vH: '이성적 판단이 강한 사주예요. 옳은 말보다 따뜻한 말이 필요한 순간을 놓치지 마세요. 관계는 논리가 아니에요.',
            vL: '감성적인 면이 있는 사주예요. 중요한 순간엔 감정보다 이성적 판단을 믿으세요. 냉정함이 때로는 친절이에요.' },
          { labelA: '집착', labelB: '놓아줌',
            sideA: ['비겁', '인성'], sideB: ['식상', '재성', '관성'],
            tip: '분기 1회, "이제 그만둘 것" 리스트를 만들어보세요. 놓아야 새것이 들어와요',
            vH: '한번 잡으면 안 놓는 사주예요. 손해가 분명하면 빨리 놓는 것도 용기입니다. 집착은 기회비용이에요.',
            vL: '놓아줄 줄 아는 사주예요. 하지만 정말 중요한 것엔 끈기를 더 발휘하세요. 포기가 습관이 되면 안 돼요.' },
        ],
      },
      수: {
        coreQ: '깊이 생각하면서도 어떻게 결정적 순간에 행동할 수 있을까?',
        summary: '수(水) 일간의 인생 과제는 "깊이와 방향성의 균형"입니다. 물은 깊고 유연하지만, 방향 없이 흐르면 고여서 썩어요.',
        themes: [
          { labelA: '생각', labelB: '행동',
            sideA: ['인성', '비겁'], sideB: ['식상', '재성', '관성'],
            tip: '아이디어가 떠오르면 48시간 안에 첫 행동 1개를 실행하세요',
            vH: '분석형 사주예요. 생각의 30%에서 행동을 시작하세요. 완벽한 계획은 없어요. 움직이면서 수정하세요.',
            vL: '실행력이 좋은 사주예요. 가끔은 한 발 물러서 깊이 생각해보세요. 방향이 속도보다 더 중요해요.' },
          { labelA: '적응', labelB: '정체성',
            sideA: ['비겁', '식상'], sideB: ['인성', '관성', '재성'],
            tip: '나의 핵심 가치 3개를 정하고 적어두세요. 결정이 흔들릴 때 기준이 돼요',
            vH: '적응력이 강한 사주예요. 하지만 "나는 누구인가"의 중심축을 잡아야 흔들리지 않아요. 유연함에도 뿌리가 필요해요.',
            vL: '중심이 뚜렷한 사주예요. 때로는 유연하게 방향을 틀어보세요. 물은 돌아가야 바다에 닿아요.' },
          { labelA: '깊이', labelB: '넓이',
            sideA: ['비겁', '인성'], sideB: ['식상', '재성', '관성'],
            tip: '전공 외 관심 분야 1개를 매년 정해서 가볍게 공부하세요. T자형 인재가 목표',
            vH: '한 우물형 사주예요. 전문성은 강하지만 시야가 좁아질 수 있어요. 관련 분야 1~2개를 함께 보면 시야가 넓어져요.',
            vL: '넓게 보는 힘이 있는 사주예요. 하지만 하나를 깊이 파는 집중력을 키우면 전문가가 돼요. 넓이만으론 부족해요.' },
        ],
      },
    };

    const data = CM[dOheng] || CM['토'];

    return (
      <div className="my-4">
        <p style={{ fontSize: 13, color: '#8b7e6f', marginBottom: 14, lineHeight: 1.6 }}>
          {dOheng}({SYM_C[dOheng]}) 일간의 오행 분포에서 십성 비율을 분석하여, 성향의 편향과 핵심 과제를 도출했어요.
        </p>

        {/* 핵심 질문 — 네이비 카드 */}
        <div className="rounded-xl p-4 mb-4" style={{ background: 'linear-gradient(135deg, #1A1612, #2A231C)', boxShadow: '0 2px 12px rgba(40,28,14,0.15)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: ecC.main, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${ecC.main}55` }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{SYM_C[dOheng]}</span>
            </div>
            <div>
              <p style={{ fontSize: 12, color: '#E8D5A8', fontWeight: 600 }}>{NAT_C[dOheng]}의 과제</p>
              <p style={{ fontSize: 13, color: '#fff', fontWeight: 800, marginTop: 1 }}>{dOheng} 일간의 핵심 질문</p>
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(232,213,168,0.2)' }}>
            <p style={{ fontSize: 14, color: '#E8D5A8', fontWeight: 700, lineHeight: 1.7, fontStyle: 'normal' }}>
              "{data.coreQ}"
            </p>
          </div>
        </div>

        {/* 종합 요약 */}
        <div className="p-3.5 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.25)' }}>
          <p style={{ fontSize: 13.5, color: '#6b5b47', lineHeight: 1.75, fontWeight: 500 }}>{data.summary}</p>
        </div>

        {/* 3대 과제 카드 — VS 비율 바 */}
        <div className="space-y-3">
          {data.themes.map((t, i) => {
            const pctA = calcPct(t.sideA, t.sideB);
            const pctB = 100 - pctA;
            const aWins = pctA >= 55;
            const bWins = pctB >= 55 + 1; // pctA <= 44
            const verdict = aWins ? t.vH : bWins ? t.vL
              : `${t.labelA}와 ${t.labelB}가 비교적 균형 잡혀 있어요. 어느 쪽이든 발휘할 수 있는 유연함이 강점이지만, 상황에 따라 한쪽으로 기울 수 있으니 주의하세요.`;

            return (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8e0d4', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                {/* 과제 헤더 */}
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: i === 0 ? 'linear-gradient(135deg, rgba(184,150,90,0.1), rgba(140,109,61,0.15))' : '#faf7f2' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: i === 0 ? 'linear-gradient(135deg, #B8965A, #b8965a)' : 'rgba(184,150,90,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: i === 0 ? '0 2px 6px rgba(184,150,90,0.3)' : 'none',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: i === 0 ? '#fff' : '#B8965A' }}>{i + 1}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#3D3427', flex: 1 }}>{t.labelA} vs {t.labelB}</span>
                  {i === 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#B8965A', background: 'rgba(184,150,90,0.12)', borderRadius: 6, padding: '2px 8px' }}>
                      핵심 과제
                    </span>
                  )}
                </div>

                <div className="px-4 py-3 space-y-3" style={{ background: '#fff' }}>
                  {/* VS 비율 바 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontSize: 13.5, fontWeight: aWins ? 800 : 500, color: aWins ? ecC.main : '#a0937f' }}>
                        {t.labelA} {pctA}%
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: bWins ? 800 : 500, color: bWins ? ecC.main : '#a0937f' }}>
                        {pctB}% {t.labelB}
                      </span>
                    </div>
                    <div className="flex rounded-full overflow-hidden" style={{ height: 12, background: '#e8e0d4' }}>
                      <div style={{
                        width: `${pctA}%`,
                        background: aWins
                          ? `linear-gradient(90deg, ${ecC.main}, ${ecC.main}CC)`
                          : !bWins ? `linear-gradient(90deg, #B8965A, #B8965AAA)` : '#d4cbb8',
                        transition: 'width 0.8s ease',
                        borderRight: '2px solid #fff',
                      }} />
                      <div style={{
                        width: `${pctB}%`,
                        background: bWins
                          ? `linear-gradient(90deg, ${ecC.main}CC, ${ecC.main})`
                          : !aWins ? `linear-gradient(90deg, #B8965AAA, #B8965A)` : '#d4cbb8',
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                    {/* 우세 표시 */}
                    <div className="mt-1.5">
                      {(aWins || bWins) ? (
                        <div className="flex items-center gap-1.5">
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: ecC.main }} />
                          <span style={{ fontSize: 12, color: ecC.main, fontWeight: 700 }}>
                            {aWins ? t.labelA : t.labelB} 쪽으로 기울어진 사주
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8965A' }} />
                          <span style={{ fontSize: 12, color: '#B8965A', fontWeight: 700 }}>양쪽 균형형 사주</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 사주 분석 (개인 해석) */}
                  <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #1A1612, #2A231C)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#E8D5A8', marginBottom: 4 }}>나의 사주 분석</p>
                    <p style={{ fontSize: 13.5, color: '#fff', lineHeight: 1.75 }}>{verdict}</p>
                  </div>

                  {/* 실천 방법 */}
                  <div className="p-3 rounded-lg" style={{ background: '#faf7f2', border: '1px dashed #d4cbb8' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#B8965A', marginBottom: 3 }}>실천 방법</p>
                    <p style={{ fontSize: 13, color: '#6b5b47', lineHeight: 1.65 }}>{t.tip}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  if (type === 'daeun_vis') {
    // 대운 흐름 도식화 — 상세풀이 섹션 안에서 렌더링
    // SectionVis는 sajuData에 직접 접근 불가 — pillars 정보로 간접 표시
    // 대운 데이터가 없어도 일간 오행별 대운 가이드를 보여줌
    const dOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const dElem = OHENG_TO_ELEM[dOheng];
    const ec = EC[dElem];

    const DAEUN_GUIDE: Record<OhengType, { now: string; tip: string; seasons: { elem: string; meaning: string }[] }> = {
      목: {
        now: '목 일간은 금(관성) 대운에서 가장 큰 시련과 성장을 겪고, 수(인성) 대운에서 학습과 지원을 받아요.',
        tip: '현재 대운의 오행이 나를 돕는지(인성과 비겁), 도전하는지(관성과 재성)를 파악하는 게 핵심이에요.',
        seasons: [
          { elem: '목 대운', meaning: '비겁: 독립과 경쟁 심화, 자아 확립기' },
          { elem: '화 대운', meaning: '식상: 표현과 창작 폭발, 재능 개화기' },
          { elem: '토 대운', meaning: '재성: 재물 기회, 적극적 투자 시기' },
          { elem: '금 대운', meaning: '관성: 시련과 성장, 사회적 압박기' },
          { elem: '수 대운', meaning: '인성: 학습과 귀인, 내면 충전기' },
        ],
      },
      화: {
        now: '화 일간은 수(관성) 대운에서 가장 큰 시련과 성장을 겪고, 목(인성) 대운에서 기운을 충전받아요.',
        tip: '화 일간은 기운 소모가 빠르므로, 대운 흐름에 따라 의식적으로 페이스 조절이 필요해요.',
        seasons: [
          { elem: '화 대운', meaning: '비겁: 열정 배가, 경쟁과 독립 강화기' },
          { elem: '토 대운', meaning: '식상: 안정적 표현, 결과물 축적기' },
          { elem: '금 대운', meaning: '재성: 재물 기회, 정밀한 판단 필요' },
          { elem: '수 대운', meaning: '관성: 감정 통제 시련, 성숙기' },
          { elem: '목 대운', meaning: '인성: 학습과 성장, 기운 보충기' },
        ],
      },
      토: {
        now: '토 일간은 목(관성) 대운에서 외부 압박이 강해지고, 화(인성) 대운에서 안정적 지원을 받아요.',
        tip: '토 일간은 변화에 느리므로, 관성과 식상 대운에서 의식적으로 움직여야 정체를 피할 수 있어요.',
        seasons: [
          { elem: '토 대운', meaning: '비겁: 안정 강화, 자기 영역 확립기' },
          { elem: '금 대운', meaning: '식상: 표현력 향상, 정리와 정돈기' },
          { elem: '수 대운', meaning: '재성: 유동적 재물, 투자 기회기' },
          { elem: '목 대운', meaning: '관성: 변화 압박, 성장통 시기' },
          { elem: '화 대운', meaning: '인성: 열정 충전, 배움과 귀인기' },
        ],
      },
      금: {
        now: '금 일간은 화(관성) 대운에서 가장 강한 단련을 받고, 토(인성) 대운에서 기반이 단단해져요.',
        tip: '금 일간은 완벽주의 때문에 관성 대운에서 특히 스트레스를 받아요. 유연함을 연습하세요.',
        seasons: [
          { elem: '금 대운', meaning: '비겁: 경쟁 심화, 전문성 승부기' },
          { elem: '수 대운', meaning: '식상: 지혜 표현, 창작과 소통기' },
          { elem: '목 대운', meaning: '재성: 재물 확장, 새 기회 포착기' },
          { elem: '화 대운', meaning: '관성: 뜨거운 단련, 변혁과 성장기' },
          { elem: '토 대운', meaning: '인성: 안정적 학습, 기반 축적기' },
        ],
      },
      수: {
        now: '수 일간은 토(관성) 대운에서 방향이 잡히면서도 압박을 느끼고, 금(인성) 대운에서 지혜가 깊어져요.',
        tip: '수 일간은 생각이 많아 행동이 늦어지기 쉬워요. 재성과 비겁 대운에서 과감하게 움직이세요.',
        seasons: [
          { elem: '수 대운', meaning: '비겁: 유연함 극대화, 경쟁과 적응기' },
          { elem: '목 대운', meaning: '식상: 성장 기운 분출, 창작기' },
          { elem: '화 대운', meaning: '재성: 열정적 재물 추구, 투자기' },
          { elem: '토 대운', meaning: '관성: 방향 설정 시련, 구조화기' },
          { elem: '금 대운', meaning: '인성: 깊은 학습, 지혜 축적기' },
        ],
      },
    };

    const guide = DAEUN_GUIDE[dOheng] || DAEUN_GUIDE['토'];
    const SEASON_COLORS = [ec.main, '#B04A38', '#B07F38', '#7D7870', '#3E5F82'];

    return (
      <div className="my-4 rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e0d4' }}>
        <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #1A1612, #2A231C)' }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: '#E8D5A8' }}>대운 흐름 해석 가이드</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{dOheng} 일간이 각 대운에서 겪는 기운 변화</p>
        </div>

        <div className="p-4 space-y-3" style={{ background: '#faf7f2' }}>
          {/* 핵심 해석 */}
          <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.25)' }}>
            <p style={{ fontSize: 13.5, color: '#6b5b47', lineHeight: 1.75 }}>{guide.now}</p>
            <p style={{ fontSize: 13, color: '#B8965A', marginTop: 6, lineHeight: 1.6 }}>{guide.tip}</p>
          </div>

          {/* 오행별 대운 의미 */}
          <p style={{ fontSize: 12, fontWeight: 700, color: '#B8965A', marginBottom: -4 }}>오행별 대운이 나에게 주는 의미</p>
          <div className="space-y-2">
            {guide.seasons.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${SEASON_COLORS[i]}15`,
                  border: `2px solid ${SEASON_COLORS[i]}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: SEASON_COLORS[i] }}>{s.elem.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#3D3427' }}>{s.elem}</span>
                  <p style={{ fontSize: 13, color: '#6b5b47', lineHeight: 1.5, marginTop: 1 }}>{s.meaning}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 읽기 가이드 */}
          <div className="p-2.5 rounded-lg" style={{ background: '#f5f0e8', border: '1px dashed #d4cbb8' }}>
            <p style={{ fontSize: 12, color: '#8b7e6f', lineHeight: 1.6 }}>
              위쪽 <b style={{ color: '#6b5b47' }}>대운 타임라인</b>에서 현재 대운의 오행을 확인하고, 이 가이드와 대조하면 지금 시기의 의미를 정확히 알 수 있어요.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// ─── ReportSection ───
export interface SectionData {
  id: string;
  icon: string;
  title: string;
  keyInsight?: string;
  content: string;
  visual?: string;
}

export function ReportSection({ section, index, elements, hasBirthTime, jijanggan, pillars, aiResult }: {
  section: SectionData;
  index: number;
  elements: V4Elements;
  hasBirthTime: boolean;
  jijanggan: JiJangGan[];
  pillars: Pillar[];
  aiResult?: any;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <LocalFadeIn delay={index * 50}>
      <div className="card overflow-hidden !p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-3 p-4 text-left transition-colors duration-200 ${
            expanded ? 'bg-bg-surface' : 'bg-white'
          }`}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(184,150,90,0.1)' }}>
            <div className="w-2 h-2 rounded-full bg-brand-gold" />
          </div>
          <span className="flex-1 text-h3 text-text-primary">{section.title}</span>
          <span className={`text-brand-gold text-sm transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="px-4 pb-4"
          >
            {/* 소름 포인트 — keyInsight 골드 하이라이트 */}
            {section.keyInsight && (
              <div className="mb-4 hj-note">
                <p className="nb" style={{ fontWeight: 700 }}>{section.keyInsight}</p>
              </div>
            )}
            <div className="text-body-sm text-text-secondary whitespace-pre-line leading-relaxed">
              {stripMd(section.content)}
            </div>
            {section.visual && (
              <div className="mt-4">
                <SectionVis
                  type={section.visual}
                  elements={elements}
                  hasBirthTime={hasBirthTime}
                  jijanggan={jijanggan}
                  pillars={pillars}
                  aiResult={aiResult}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </LocalFadeIn>
  );
}


