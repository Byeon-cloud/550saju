/**
 * #saju-card-share Stage 5-2 · 만세력 자세히 보기 — 두산 패턴 100% 정렬
 *
 * 직전 디자인 (Stage 4-3): 작은 박스(44~50px) + 행마다 라벨 + 정보 분산
 * 본 디자인 (Stage 5-2): 두산 진본 100% 정렬
 *   - 8글자 박스 75~85px (모바일 4 컬럼 fit) — height 일주 95 / 그 외 85
 *   - 한자 38~44pt (가독성 ↑)
 *   - 강한 채도 + 흰 한자 + 외곽선 (두산 그대로)
 *   - 단일 표 (시/일/월/년 = 4 컬럼) — 헤더 → 관계 → 천간십성 → 천간(大) → 지지(大) → 지지십성 → 지장간(3행) → 12운성 → 12신살 → 납음
 *   - 정보 토글 (십성/지장간/12운성/12신살/납음) — 상단 chip
 *   - 합·충·형·공망 매트릭스 — 노란 하이라이트 배경 (C.goldSoft) + 화살표 시각
 *   - 신살 4 컬럼 표 — 시/일/월/년 컬럼별 길성/중성/흉살 칸 분리
 *
 * 원칙:
 *   - SSOT 톤 (베이지+잉크+골드) — 8글자 박스만 강한 5 오행 원색
 *   - 머스타드 #B8965A 0건 + 이모지 0건
 *   - 데이터 0 변경 (calculator/sinsal/relations 그대로)
 */

import { useState, useMemo } from 'react';
import type { SajuData, OhengType, SajuInput } from '@/types/saju';
import type { SinsalAnalysis } from '@/services/saju/sinsal';
import { analyzeRelations, type RelationsAnalysis } from '@/services/saju/relations';
import { lookupSipsung } from '@/constants/sipsungColor';

/** lunar-javascript 간체 → 정체 (만세력 표 표시용 · 12운성·납음에 나오는 글자만) */
const SIMP_TO_TRAD: Record<string, string> = {
  绝: '絶', 长: '長', 临: '臨', 带: '帶', 禄: '祿', 养: '養', 头: '頭', 剑: '劍', 锋: '鋒', 炉: '爐', 涧: '澗',
  蜡: '蠟', 杨: '楊', 雳: '靂', 灯: '燈', 驿: '驛', 钗: '釵', 钏: '釧', 旁: '傍',
};
function toTraditional(s: string): string {
  return s ? s.replace(/[绝长临带禄养头剑锋炉涧蜡杨雳灯驿钗钏旁]/g, (c) => SIMP_TO_TRAD[c] || c) : s;
}


const C = {
  paper: '#F8F5EE',
  paperSoft: '#FBF8F1',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.10)',
  goldSoftStrong: 'rgba(184,150,90,0.18)',
  goldLine: 'rgba(184,150,90,0.40)',
  cardLine: 'rgba(184,150,90,0.18)',
  highlight: '#FFF6D9',           // 두산 노란 하이라이트
  highlightLine: '#E8C870',
  line: '#E5DFD0',
  danger: '#C04D4D',
  dangerSoft: 'rgba(192,77,77,0.08)',
  positive: '#4E7A57',
  positiveSoft: 'rgba(78,122,87,0.08)',
} as const;

const SERIF = "'Noto Serif KR', serif";

const OHENG_BOX_DETAIL: Record<OhengType, { bg: string; fg: string; outline: string }> = {
  목: { bg: '#4E7A57', fg: '#FFFFFF', outline: '#1B5E2C' },
  화: { bg: '#B04A38', fg: '#FFFFFF', outline: '#9B1B1B' },
  토: { bg: '#B07F38', fg: '#FFFFFF', outline: '#C9A030' },
  금: { bg: '#FFFFFF', fg: '#1A1A1A', outline: '#9C9C9C' },
  수: { bg: '#1A1A1A', fg: '#FFFFFF', outline: '#3D3D3D' },
};

const OHENG_HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
const OHENG_HEX: Record<OhengType, string> = {
  목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82',
};

const SHIPISINSAL_HANJA: Record<string, string> = {
  겁살: '劫殺', 재살: '災殺', 천살: '天殺', 지살: '地殺',
  도화살: '桃花殺', 월살: '月殺', 망신살: '亡身殺', 장성살: '將星殺',
  반안살: '攀鞍殺', 역마살: '驛馬殺', 육해살: '六害殺', 화개살: '華蓋殺',
};

/* ══════════════════════════════════════════════════════════════════
 * Public API
 * ═════════════════════════════════════════════════════════════════ */

export interface DetailsTableProps {
  sajuData: SajuData;
  /** Stage 7b: 신살 표/매트릭스/요약 모두 제거 — 만세력 단일 표만 유지.
   *  prop 은 외부 호환성 위해 보존하되 내부 미사용. */
  input?: SajuInput;
  lunar?: { year: number; month: number; day: number; isLeap: boolean } | null;
  sinsalAnalysis: SinsalAnalysis | null;
  relationsAnalysis?: RelationsAnalysis | null;
  onMoreDaeun?: () => void;
  onMoreMonthly?: () => void;
}

export function SajuDetailsTable({
  sajuData,
  input,
  lunar,
  sinsalAnalysis,
  relationsAnalysis,
  onMoreDaeun,
  onMoreMonthly,
}: DetailsTableProps) {
  // Stage 7b: 출생정보(A) / 요약(C) / 합충형공망(D) / 신살(E) 모두 제거
  // 만세력 단일 표(B) + 운의 흐름(F) 만 노출
  void input;
  void lunar;
  // 2026-10-04 — 호출부가 relationsAnalysis 를 안 넘겨(7b 매트릭스 폐지 잔재) '관계' 행이 항상 '— — — —' 였음.
  //   안 넘어오면 여기서 계산 (卯酉충 같은 합·충이 표에 표시되도록).
  const computedRel = useMemo<RelationsAnalysis | null>(() => {
    try { return analyzeRelations(sajuData.pillars, (sajuData as any).gongmang); } catch { return null; }
  }, [sajuData]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <SectionB_ManseTable
        sajuData={sajuData}
        sinsalAnalysis={sinsalAnalysis}
        relationsAnalysis={relationsAnalysis ?? computedRel}
      />
      <SectionF_FlowLinks onMoreDaeun={onMoreDaeun} onMoreMonthly={onMoreMonthly} />
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════
 * [B] 만세력 표 — 두산 단일 표 (큰 박스 + 토글)
 * ═════════════════════════════════════════════════════════════════ */

type ToggleKey = 'sipsung' | 'jjg' | 'unyung' | 'shipi' | 'napeum' | 'rel';

const TOGGLE_LABELS: Array<{ key: ToggleKey; ko: string; han: string }> = [
  { key: 'rel',     ko: '관계',    han: '關係' },
  { key: 'sipsung', ko: '십성',    han: '十神' },
  { key: 'jjg',     ko: '지장간',  han: '支藏干' },
  { key: 'unyung',  ko: '12운성',  han: '運星' },
  { key: 'shipi',   ko: '12신살',  han: '神煞' },
  { key: 'napeum',  ko: '납음',    han: '納音' },
];

function SectionB_ManseTable({
  sajuData,
  sinsalAnalysis,
  relationsAnalysis,
}: {
  sajuData: SajuData;
  sinsalAnalysis: SinsalAnalysis | null;
  relationsAnalysis: RelationsAnalysis | null;
}) {
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    rel: true,
    sipsung: true,
    jjg: true,
    unyung: true,
    shipi: true,
    napeum: true,
  });
  const flip = (k: ToggleKey) => setToggles((t) => ({ ...t, [k]: !t[k] }));

  const order = [3, 2, 1, 0]; // 시 → 일 → 월 → 년 (좌→우)
  const labelsHanja = ['時柱', '日柱', '月柱', '年柱'];
  const labelsKo = ['시주', '일주', '월주', '년주'];
  const pillarKey = ['시', '일', '월', '년']; // 관계 lookup용

  // 십성 lookup (천간/지지)
  const ganKeys = ['년간', '월간', '일간', '시간'];
  const zhiKeys = ['년지', '월지', '일지', '시지'];
  const sipsungArr = sajuData.sipsung || [];
  const pickSipsung = (idx: number, ch: 'gan' | 'zhi') => {
    const key = ch === 'gan' ? ganKeys[idx] : zhiKeys[idx];
    const found = sipsungArr.find((s) => s.position === key);
    return found?.십성 || '';
  };

  // 지장간
  const jjgArr = sajuData.jijanggan || [];
  const pickJijanggan = (zhi: string) => {
    const found = jjgArr.find((j) => j.지지 === zhi);
    return { chars: found?.지장간 || [], sipsungs: found?.십성 || [] };
  };

  // 12운성 (한글 + 한자) — lunar-javascript 가 한자로 반환하면 한글로 정규화
  const UNYUNG_HANJA_TO_KO: Record<string, string> = {
    '長生': '장생', '沐浴': '목욕', '冠帶': '관대', '冠带': '관대',
    '臨官': '건록', '临官': '건록', '建祿': '건록', '建禄': '건록',
    '帝旺': '제왕', '衰': '쇠', '病': '병', '死': '사',
    '墓': '묘', '絶': '절', '絕': '절', '绝': '절', '胎': '태', '養': '양', '养': '양', '长生': '장생',
  };
  const UNYUNG_KO_TO_HANJA: Record<string, string> = {
    '장생': '長生', '목욕': '沐浴', '관대': '冠帶', '건록': '建祿', '제왕': '帝旺',
    '쇠': '衰', '병': '病', '사': '死', '묘': '墓', '절': '絶', '태': '胎', '양': '養',
  };
  const unyungArr = sajuData.unyoung12 || [];
  const pickUnyung = (idx: number) => {
    const found = unyungArr.find((u) => u.position === zhiKeys[idx]);
    const raw = found?.운성 || '';
    const rawHan = found?.운성한자 || '';
    // 정규화 — raw 가 한자면 한글로, 한글이면 hanja 보강
    const ko = UNYUNG_HANJA_TO_KO[raw] || UNYUNG_HANJA_TO_KO[rawHan] || raw;
    // 2026-10-04 — 표시 한자는 정체 SSOT 우선 (lunar 간체 '绝'이 한글 없이 그대로 노출되던 문제)
    const han = UNYUNG_KO_TO_HANJA[ko] || toTraditional(rawHan || raw);
    return { ko, han };
  };

  // 12신살
  const shipi = sinsalAnalysis?.shipiSinsal ?? [];
  const pickShipi = (idx: number) => {
    const pillarLabel = labelsKo[order.indexOf(idx)] || labelsKo[idx];
    const found = shipi.find((h) => h.positions.some((p) => p.pillar === pillarLabel));
    return found?.name || '';
  };

  // 납음 (한글 + 한자) — lunar-javascript 가 한자만 반환하면 한글 음으로 정규화
  // 60갑자 납음오행 한자 → 한글 음
  const NAPEUM_HANJA_TO_KO: Record<string, string> = {
    '海中金': '해중금', '炉中火': '노중화', '爐中火': '노중화',
    '大林木': '대림목', '路傍土': '노방토', '路旁土': '노방토',
    '剑锋金': '검봉금', '劍鋒金': '검봉금', '山头火': '산두화', '山頭火': '산두화',
    '涧下水': '간하수', '澗下水': '간하수', '城头土': '성두토', '城頭土': '성두토',
    '白蜡金': '백랍금', '白蠟金': '백랍금', '杨柳木': '양류목', '楊柳木': '양류목',
    '泉中水': '천중수', '井泉水': '정천수', '屋上土': '옥상토',
    '霹雳火': '벽력화', '霹靂火': '벽력화', '松柏木': '송백목',
    '长流水': '장류수', '長流水': '장류수', '沙中金': '사중금',
    '山下火': '산하화', '平地木': '평지목', '壁上土': '벽상토',
    '金箔金': '금박금', '覆灯火': '복등화', '覆燈火': '복등화',
    '天河水': '천하수', '大驿土': '대역토', '大驛土': '대역토',
    '钗钏金': '차천금', '釵釧金': '차천금', '桑柘木': '상자목',
    '大溪水': '대계수', '沙中土': '사중토', '天上火': '천상화',
    '石榴木': '석류목', '大海水': '대해수',
  };
  const napeumArr = sajuData.napeum || [];
  const pickNapeum = (idx: number) => {
    const expectedPos = labelsKo[order.indexOf(idx)];
    const found = napeumArr.find((n) => n.position === expectedPos);
    const raw = found?.납음 || '';
    const rawHan = found?.납음한자 || '';
    // raw 가 한자면 한글로 정규화
    const ko = NAPEUM_HANJA_TO_KO[raw] || NAPEUM_HANJA_TO_KO[rawHan] || raw;
    // 2026-10-04 — 간체(城头土·剑锋金)가 그대로 노출되던 문제 → 정체로 표시
    const han = toTraditional(rawHan || (NAPEUM_HANJA_TO_KO[raw] ? raw : ''));
    return { ko, han };
  };

  // 관계 라벨 (각 기둥 → 어떤 합/충에 참여했는지 abbreviation)
  const relPerPillar: string[] = useMemo(() => {
    if (!relationsAnalysis) return ['', '', '', ''];
    const buckets: Set<string>[] = [new Set(), new Set(), new Set(), new Set()];
    const bumpRel = (positions: string[], symbol: string) => {
      for (const pos of positions) {
        // pos 예: "년간", "월지", "일주" 등
        const k = pos.charAt(0); // "년", "월", "일", "시"
        const pIdx = pillarKey.indexOf(k);
        if (pIdx >= 0) buckets[pIdx].add(symbol);
      }
    };
    for (const r of relationsAnalysis.cheongan) {
      bumpRel(r.positions, r.type === '천간합' ? '합' : '충');
    }
    for (const r of relationsAnalysis.jijiHap) {
      bumpRel(r.positions, '합');
    }
    for (const r of relationsAnalysis.jijiClash) {
      const sym = r.type === '지지충' ? '충' : r.type === '형' ? '형' : r.type === '파' ? '파' : r.type === '해' ? '해' : '원';
      bumpRel(r.positions, sym);
    }
    // pillarKey 순서 [시,일,월,년] → display order [시,일,월,년] 맞춤 reorder
    const displayIdx = [0, 1, 2, 3].map((i) => order.indexOf(i)); // 'order = 시,일,월,년 idx'
    void displayIdx;
    // pillarKey '시'/'일'/'월'/'년' index = 0/1/2/3
    // display order = pillarKey 그대로 [시,일,월,년]
    return [0, 1, 2, 3].map((i) => Array.from(buckets[i]).join(', '));
  }, [relationsAnalysis]);
  // relPerPillar[0] = 시주, [1] = 일주, [2] = 월주, [3] = 년주

  // Stage 7e-6: 오행 카운트 (天干 + 地支 분포) — 만세력 표 위 노출
  const ohengCount = useMemo(() => {
    const dist: Record<OhengType, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    for (const p of sajuData.pillars) {
      if (!p.available) continue;
      if (p.천간오행) dist[p.천간오행 as OhengType]++;
      if (p.지지오행) dist[p.지지오행 as OhengType]++;
    }
    return dist;
  }, [sajuData]);
  const ohengTopKey: OhengType | null = useMemo(() => {
    let best: OhengType | null = null;
    let bestVal = 0;
    (['목', '화', '토', '금', '수'] as OhengType[]).forEach((o) => {
      if (ohengCount[o] > bestVal) {
        bestVal = ohengCount[o];
        best = o;
      }
    });
    return best;
  }, [ohengCount]);

  return (
    <DetailCard title="만세력" hanja="萬歲曆">
      {/* Stage 7e-6: 오행 카운트 요약 (만세력 위) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 8px 10px',
          marginBottom: 10,
          borderBottom: `1px dotted ${C.cardLine}`,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.goldDeep, letterSpacing: '0.16em' }}>
            오행 분포
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['목', '화', '토', '금', '수'] as OhengType[]).map((o) => {
            const v = ohengCount[o];
            const isZero = v === 0;
            const isTop = o === ohengTopKey && v > 0;
            return (
              <div
                key={o}
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: 4,
                  padding: '3px 9px',
                  background: isTop ? `${OHENG_HEX[o]}1A` : isZero ? '#F5F0E8' : '#FFFFFF',
                  border: `1.2px solid ${isTop ? OHENG_HEX[o] : isZero ? C.line : `${OHENG_HEX[o]}55`}`,
                  borderRadius: 999,
                  fontSize: 13.5,
                  fontWeight: isTop ? 900 : 700,
                  letterSpacing: '0.02em',
                }}
              >
                <span style={{ fontFamily: SERIF, color: OHENG_HEX[o], fontWeight: 800 }}>{OHENG_HAN[o]}</span>
                <span style={{ color: isZero ? C.mute : C.ink, fontFeatureSettings: '"tnum"' }}>
                  {v}
                </span>
                <span style={{ fontSize: 12, color: C.mute, fontWeight: 600 }}>{o}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 토글 chip 바 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5,
          padding: '2px 0 10px',
          borderBottom: `1px dotted ${C.cardLine}`,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 12, color: C.mute, alignSelf: 'center', marginRight: 4, letterSpacing: '0.04em' }}>
          정보
        </span>
        {TOGGLE_LABELS.map((t) => {
          const on = toggles[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => flip(t.key)}
              style={{
                padding: '7px 10px',
                minHeight: 34,
                background: on ? C.goldSoftStrong : '#FFFFFF',
                border: `1px solid ${on ? C.gold : C.line}`,
                borderRadius: 999,
                fontSize: 13,
                fontWeight: on ? 800 : 600,
                color: on ? C.goldDeep : C.mute,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                lineHeight: 1.2,
              }}
              aria-pressed={on}
            >
              {t.ko}
              <span style={{ fontSize: 12, marginLeft: 3, opacity: 0.6, fontFamily: SERIF, fontWeight: 500 }}>{t.han}</span>
            </button>
          );
        })}
      </div>

      {/* Stage 7e: minWidth/overflowX 제거 — 모바일 360~390px 폭 안에서 자연 fit */}
      <div>
        <table
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: '3px 3px',
            fontSize: 13,
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: 54 }} />
            <col />
            <col />
            <col />
            <col />
          </colgroup>

          {/* 헤더 — 시·일·월·년 (한글 큼 + 한자 부기) */}
          <thead>
            <tr>
              <th style={thLabel}></th>
              {order.map((idx, i) => {
                const isDay = idx === 2;
                return (
                  <th
                    key={`th-${i}`}
                    style={{
                      ...thHead,
                      background: isDay ? C.goldSoftStrong : C.paperSoft,
                      border: isDay ? `1.5px solid ${C.gold}` : `1px solid ${C.line}`,
                      color: isDay ? C.goldDeep : C.mute,
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '0.04em' }}>
                      {labelsKo[i]}
                      {isDay && <span style={{ marginLeft: 3, fontSize: 12, color: C.gold }}>(나)</span>}
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 12, marginTop: 2, fontWeight: 600, opacity: 0.75 }}>
                      {labelsHanja[i]}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* 관계 라벨 (toggle: rel) */}
            {toggles.rel && (
              <Row label="관계" hanja="關係">
                {order.map((idx, i) => {
                  // idx 0=년 1=월 2=일 3=시 → relPerPillar[3-idx]?
                  // pillarKey [시,일,월,년] = [3,2,1,0] in idx order → relPerPillar index is by pillarKey
                  // pillarKey index for idx=3(시)=0, idx=2(일)=1, idx=1(월)=2, idx=0(년)=3
                  const pIdx = idx === 3 ? 0 : idx === 2 ? 1 : idx === 1 ? 2 : 3;
                  const sym = relPerPillar[pIdx];
                  return (
                    <td key={i} style={{ ...tdCell, background: sym ? C.highlight : C.surface, borderColor: sym ? C.highlightLine : C.line }}>
                      <span style={{ fontSize: 13, color: sym ? C.goldDeep : C.mute, fontWeight: 700, letterSpacing: '0.04em' }}>
                        {sym || '—'}
                      </span>
                    </td>
                  );
                })}
              </Row>
            )}

            {/* 천간 십성 (toggle) */}
            {toggles.sipsung && (
              <Row label="십성" hanja="十神">
                {order.map((idx, i) => {
                  const isDay = idx === 2;
                  const sipsung = isDay ? '日主' : pickSipsung(idx, 'gan');
                  return <SipsungCell key={i} value={sipsung} isDay={isDay} />;
                })}
              </Row>
            )}

            {/* 천간 박스 (大) — 두산 메인 */}
            <Row label="천간" hanja="天干" big>
              {order.map((idx, i) => {
                const p = sajuData.pillars[idx];
                if (!p?.available) return <BigEmptyCell key={i} />;
                return (
                  <BigCharCell
                    key={i}
                    ch={p.천간}
                    chRead={p.천간읽기}
                    oheng={p.천간오행 as OhengType}
                    isDay={idx === 2}
                  />
                );
              })}
            </Row>

            {/* 지지 박스 (大) */}
            <Row label="지지" hanja="地支" big>
              {order.map((idx, i) => {
                const p = sajuData.pillars[idx];
                if (!p?.available) return <BigEmptyCell key={i} />;
                return (
                  <BigCharCell
                    key={i}
                    ch={p.지지}
                    chRead={p.지지읽기}
                    oheng={p.지지오행 as OhengType}
                    isDay={idx === 2}
                  />
                );
              })}
            </Row>

            {/* 지지 십성 (toggle) */}
            {toggles.sipsung && (
              <Row label="십성" hanja="十神">
                {order.map((idx, i) => {
                  const sipsung = pickSipsung(idx, 'zhi');
                  return <SipsungCell key={i} value={sipsung} isDay={idx === 2} />;
                })}
              </Row>
            )}

            {/* 지장간 (toggle) — 3행 정/중/여기 */}
            {toggles.jjg && (
              <Row label="지장간" hanja="支藏干">
                {order.map((idx, i) => {
                  const p = sajuData.pillars[idx];
                  if (!p?.available) return <EmptyCell key={i} />;
                  const { chars, sipsungs } = pickJijanggan(p.지지);
                  return (
                    <td key={i} style={tdCell}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {chars.length > 0 ? (
                          chars.slice(0, 3).map((ch, j) => {
                            const sipRaw = sipsungs[j] || '';
                            const sipFirst = String(sipRaw).split('/')[0].trim();
                            // 십성 한자 → 한국어 (사용자 친화)
                            const sipKo = SIPSUNG_HANJA_TO_KO[sipFirst] || sipFirst;
                            return (
                              <div
                                key={j}
                                style={{
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  gap: 3,
                                  lineHeight: 1.2,
                                }}
                              >
                                <span style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '0.02em' }}>
                                  {ch}
                                </span>
                                {sipKo && (
                                  <span style={{ fontSize: 12, color: C.mute, letterSpacing: '0.02em' }}>
                                    {sipKo.slice(0, 2)}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: 10, color: C.mute }}>—</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </Row>
            )}

            {/* 12운성 (toggle) — 한글 12pt + 한자 8pt */}
            {toggles.unyung && (
              <Row label="12운성" hanja="運星">
                {order.map((idx, i) => {
                  const u = pickUnyung(idx);
                  if (!u.ko) return <td key={i} style={tdCell}>—</td>;
                  return (
                    <td key={i} style={tdCell}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontSize: 13.5, color: C.inkSoft, fontWeight: 700, lineHeight: 1.1 }}>{u.ko}</span>
                        {u.han && (
                          <span style={{ fontFamily: SERIF, fontSize: 12, color: C.mute, fontWeight: 500, opacity: 0.85 }}>
                            {u.han}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </Row>
            )}

            {/* 12신살 (toggle) — 한글 12pt + 한자 8pt */}
            {toggles.shipi && (
              <Row label="12신살" hanja="神煞">
                {order.map((idx, i) => {
                  const s = pickShipi(idx);
                  if (!s) return <td key={i} style={tdCell}>—</td>;
                  const han = SHIPISINSAL_HANJA[s] || '';
                  return (
                    <td key={i} style={tdCell}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontSize: 13.5, color: C.inkSoft, fontWeight: 700, lineHeight: 1.1 }}>
                          {s.replace('살', '')}
                        </span>
                        {han && (
                          <span style={{ fontSize: 12, color: C.mute, fontFamily: SERIF, fontWeight: 500, opacity: 0.85 }}>
                            {han}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </Row>
            )}

            {/* 납음 (toggle) — 한글 + 한자 */}
            {toggles.napeum && (
              <Row label="납음" hanja="納音">
                {order.map((idx, i) => {
                  const np = pickNapeum(idx);
                  if (!np.ko) return <td key={i} style={tdCell}>—</td>;
                  return (
                    <td key={i} style={tdCell}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 700, lineHeight: 1.1 }}>{np.ko}</span>
                        {np.han && (
                          <span style={{ fontFamily: SERIF, fontSize: 12, color: C.mute, fontWeight: 500, opacity: 0.85 }}>
                            {np.han}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </Row>
            )}
          </tbody>
        </table>
      </div>
    </DetailCard>
  );
}

const thLabel: React.CSSProperties = {
  width: 54,
  padding: '6px 4px',
  background: 'transparent',
  border: 'none',
};
const thHead: React.CSSProperties = {
  padding: '8px 4px',
  borderRadius: 8,
  textAlign: 'center',
  verticalAlign: 'middle',
};
const tdCell: React.CSSProperties = {
  padding: '6px 3px',
  textAlign: 'center',
  background: C.surface,
  border: `1px solid ${C.line}`,
  borderRadius: 6,
  verticalAlign: 'middle',
};

function Row({
  label,
  hanja,
  big,
  children,
}: {
  label: string;
  hanja: string;
  big?: boolean;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        style={{
          width: 54,
          padding: big ? '6px 6px 6px 0' : '5px 6px 5px 0',
          whiteSpace: 'nowrap',
          textAlign: 'right',
          verticalAlign: 'middle',
        }}
      >
        <div style={{ fontSize: big ? 13 : 13, fontWeight: 800, color: C.goldDeep, letterSpacing: '0.02em', lineHeight: 1.1 }}>
          {label}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: big ? 12 : 12, color: C.mute, marginTop: 2, opacity: 0.8 }}>{hanja}</div>
      </td>
      {children}
    </tr>
  );
}

function BigCharCell({
  ch,
  chRead,
  oheng,
  isDay,
}: {
  ch: string;
  chRead: string;
  oheng: OhengType;
  isDay: boolean;
}) {
  const style = OHENG_BOX_DETAIL[oheng];
  return (
    <td style={{ padding: '3px 2px', background: 'transparent', border: 'none', verticalAlign: 'middle' }}>
      <div
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: 76,
          margin: '0 auto',
          height: isDay ? 78 : 68,
          background: style.bg,
          color: style.fg,
          border: isDay ? `3px solid ${C.gold}` : `1.5px solid ${style.outline}`,
          borderRadius: 9,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF,
          letterSpacing: '0.02em',
          boxShadow: isDay ? `0 4px 12px ${C.gold}44` : '0 2px 5px rgba(0,0,0,0.10)',
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: isDay ? 36 : 30,
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: '-0.01em',
          }}
        >
          {ch}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            opacity: 0.85,
            letterSpacing: '0.04em',
          }}
        >
          {OHENG_HAN[oheng]}
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.mute, marginTop: 3, textAlign: 'center', fontWeight: 600 }}>
        {chRead}
      </div>
    </td>
  );
}

function BigEmptyCell() {
  return (
    <td style={{ padding: '3px 2px', background: 'transparent', border: 'none' }}>
      <div
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: 76,
          margin: '0 auto',
          height: 68,
          border: `1.5px dashed ${C.line}`,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.mute,
          fontSize: 12,
          fontStyle: 'italic',
          background: C.paperSoft,
        }}
      >
        시간 모름
      </div>
    </td>
  );
}

// 한자 → 한국어 매핑 (sipsung 데이터가 한자로 들어올 때 한글로 변환)
// 정자/약자 모두 지원 (lunar-javascript 가 simplified Chinese 반환할 수 있음)
const SIPSUNG_HANJA_TO_KO: Record<string, string> = {
  '比肩': '비견', '劫財': '겁재', '劫财': '겁재', '比劫': '비견',
  '食神': '식신', '傷官': '상관', '伤官': '상관',
  '正財': '정재', '正财': '정재', '偏財': '편재', '偏财': '편재',
  '正官': '정관', '偏官': '편관', '七殺': '편관', '七杀': '편관',
  '正印': '정인', '偏印': '편인',
};

function SipsungCell({ value, isDay }: { value: string; isDay: boolean }) {
  if (!value) return <td style={tdCell}>—</td>;
  const isMaster = isDay;
  const first = String(value).split('/')[0].trim();
  // 한자→한글 변환 + 한글로 통일
  const koreanFirst = SIPSUNG_HANJA_TO_KO[first] || first;
  const meta = lookupSipsung(koreanFirst);
  const color = isDay ? C.goldDeep : meta?.color ?? C.mute;
  // 표시 — 한국어 BIG (사용자 친화) + 한자 SMALL (전문성)
  const text = isMaster ? '일간(나)' : koreanFirst.slice(0, 4);
  const hanja = isMaster ? '日主' : meta?.hanja || '';
  return (
    <td
      style={{
        ...tdCell,
        background: isDay ? C.goldSoftStrong : C.surface,
        borderColor: isDay ? C.gold : C.line,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: '0.02em', lineHeight: 1.1 }}>
          {text}
        </span>
        {hanja && (
          <span style={{ fontSize: 12, color: isDay ? C.gold : C.mute, fontFamily: SERIF, fontWeight: 600, opacity: 0.85 }}>
            {hanja}
          </span>
        )}
      </div>
    </td>
  );
}

function EmptyCell() {
  return (
    <td style={tdCell}>
      <span style={{ fontSize: 10, color: C.mute, fontStyle: 'italic' }}>—</span>
    </td>
  );
}


/* ══════════════════════════════════════════════════════════════════
 * [F] 운의 흐름 진입 링크
 * ═════════════════════════════════════════════════════════════════ */
function SectionF_FlowLinks({
  onMoreDaeun,
  onMoreMonthly,
}: {
  onMoreDaeun?: () => void;
  onMoreMonthly?: () => void;
}) {
  if (!onMoreDaeun && !onMoreMonthly) return null;
  return (
    <DetailCard title="운의 흐름 자세히" hanja="運勢">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {onMoreDaeun && (
          <button
            type="button"
            onClick={onMoreDaeun}
            style={linkBtnStyle}
          >
            대운 자세히 보기 (10년 단위)
            <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 900, color: C.gold }}>→</span>
          </button>
        )}
        {onMoreMonthly && (
          <button
            type="button"
            onClick={onMoreMonthly}
            style={linkBtnStyle}
          >
            월운 자세히 보기 (12개월)
            <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 900, color: C.gold }}>→</span>
          </button>
        )}
      </div>
    </DetailCard>
  );
}

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  background: '#FFFFFF',
  border: `1px solid ${C.goldLine}`,
  borderRadius: 10,
  fontSize: 13.5,
  fontWeight: 700,
  color: C.goldDeep,
  cursor: 'pointer',
  letterSpacing: '0.02em',
  width: '100%',
  textAlign: 'left',
};

/* ══════════════════════════════════════════════════════════════════
 * 공통 DetailCard
 * ═════════════════════════════════════════════════════════════════ */
function DetailCard({
  title,
  hanja,
  children,
}: {
  title: string;
  hanja: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.cardLine}`,
        borderRadius: 14,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: `1px dotted ${C.cardLine}`,
        }}
      >
        <span style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 800, color: C.goldDeep }}>
          {title}
        </span>
        <span style={{ fontSize: 13, color: C.mute, fontFamily: SERIF }}>{hanja}</span>
      </div>
      {children}
    </div>
  );
}
