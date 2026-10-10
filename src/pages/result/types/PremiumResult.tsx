// PremiumResult — Phase D'-2 프리미엄 10섹션 (목업 v2 진본 정렬)
// 스펙: docs/mockups/사주500_UI개편_목업_결과프리미엄_v2.html (2411L) — 카피·디자인 디테일 직접 참조
//       docs/mockups/사주500_UI개편_03_결과.md §9 (스펙 골격)
//
// 10섹션 (목업 v2 진본):
//   §0  HeroCard (命 워터마크 + 일간 배지) — 페이지 최상단
//   01. 원국 (原局) — 태어난 순간 하늘과 땅이 그려낸 여덟 글자 + 오행 레이더 + 인생의 결 5카드
//   02. 천간지지 (天干地支) — 위로 드러난 마음과 아래에 깔린 본능
//   03. 십성 (十神) — 관계와 욕망을 그리는 열 개의 키 (도넛 차트)
//   04. 용신·조후 (用神·調候) — 사주가 가장 갈증을 느끼는 것 ★ 신규
//   05. 대운 (大運) — 10년 단위로 흐르는 인생의 큰 강줄기 (60년 가로선 + 인생단계 3카드)
//   06. 연운 (年運) — 올해의 흐름 (12개월 grid + 시기별 경고)
//   07. 신살 (神殺) — 길신·흉살 (3 tier + 풀이)
//   08. 관계의 결 (六親) — 부모·형제·배우자·자녀·친구·상사
//   09. 주제별 한눈에 (主題) — 연애·재물·취업·공부·인간관계 5 점수
//   10. 실천 (實踐) — 분기별 손에 잡히는 액션
//   ─ Upsell (사주대화 진입 CTA) + PDF + ReportSources fine-print
//
// 섹션간 32px + divider 1px gray-line opacity 0.5 · 글자수 노출 금지
// _data/_atoms/_visuals 무수정 (Phase D' 원칙)

import { Solar } from 'lunar-javascript';
import { hanjaNum } from '@/components/hanji/Hanji';
import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { getTopicPrice, formatPriceLabel } from '@/constants/pricing';
import { getProfiles, type LocalReport, type SajuProfile } from '@/services/storage/localStore';
import { TOPIC_IDS, TOPIC_REGISTRY, type TopicId } from '@/constants/topics';
import type { OhengType, SajuData } from '@/types/saju';
import { stripMd, sanitizeAiText } from '@/utils/format';
// 2026-05-29 — AI 가 강조 태그를 빠뜨려도 강조 보장 (본문 자동 강조). sanitizeAiText 와 함께 사용.
import { autoEmphasize } from '@/utils/emphasis';
import { getHourBranch } from '@/utils/saju-format';
import { LocalFadeIn } from '../_atoms';
import { PREMIUM_MOCKUP_CSS } from './_premiumMockupStyle';
import {
  EC, EHAN, EKR,
  type ElemKey, type V4Pillar, type V4Daeun, type V4SinSal,
} from '../_data';
// #61 · 프리미엄 PDF 다운로드 버튼 (paid + unlocked 컨텍스트에서만 마운트)
// PDF 는 result-footer 의 버튼에 인라인 wired (handlePdf). PdfDownloadButton 컴포넌트는 미사용 —
// 그 안의 a[download] 방식은 토스 웹뷰에서 무동작으로 판명(2026-07-03 CS)이라 import 하지 않는다.
// 재사용하려면 반드시 services/pdf/nativePdfViewer 의 tryOpenNativePdf → window.open 폴백 순서로 쓸 것.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ShareModal } from '@/components/share/ShareModal';
import { generatePremiumPdf, type PdfProfile } from '@/services/pdf/premiumPdfClient';
import { useToast } from '@/components/common/Toast';
import type { SajuInput } from '@/types/saju';
// Stage 2C-2: 합·충·형 시각용 (relations.ts 활용 — 데이터 0 변경)
import { analyzeRelations } from '@/services/saju/relations';

/* #61 · PDF profile 헬퍼 — SajuInput 의 분리된 birthYear/Month/Day → 'YYYY-MM-DD' */
function formatBirthDate(input?: SajuInput): string | undefined {
  if (!input) return undefined;
  const y = String(input.birthYear).padStart(4, '0');
  const m = String(input.birthMonth).padStart(2, '0');
  const d = String(input.birthDay).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatBirthTime(input?: SajuInput): string | undefined {
  if (!input?.hasBirthTime) return undefined;
  // 2026-06-02 — 밴드 입력(분 X)이라 "12:00" 대신 시(時) 이름. 분 있으면 정확 시각.
  const hh = input.birthHour ?? 0;
  const mm = input.birthMinute ?? 0;
  if (mm > 0) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  return getHourBranch(hh, 0)?.ko ?? `${hh}시`;
}

/* ══════════════════════════════════════════════════════════════════
 * SSOT 토큰 (D1 정렬)
 * ═════════════════════════════════════════════════════════════════ */
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  goldLine: 'rgba(184,150,90,0.40)',
  line: '#E5DFD0',
  surface: '#FFFFFF',
} as const;

const OHENG_TO_ELEM: Record<OhengType, ElemKey> = {
  목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water',
};

/* ══════════════════════════════════════════════════════════════════
 * 용신 라이프스타일 매핑 (목업 v2 §4 — 색/방위/계절/취미)
 * ═════════════════════════════════════════════════════════════════ */
interface LifestyleSet {
  color: string;
  direction: string;
  season: string;
  hobby: string;
  time: string;
  food: string;
  item: string;
  people: string;
}
const OHENG_LIFESTYLE: Record<OhengType, LifestyleSet> = {
  목: {
    color: '녹색, 청록, 밝은 베이지',
    direction: '동쪽',
    season: '봄',
    hobby: '산책과 식물 가꾸기, 서예, 필사',
    time: '인시(03~05시), 묘시(05~07시), 봄철 새벽',
    food: '신맛 약간, 푸른 잎채소, 녹차, 식초, 매실',
    item: '나무 가구, 관엽식물, 녹색 노트와 만년필',
    people: '일간 甲 乙(木) 또는 壬 癸(水) 인 사람이 결을 살려줍니다',
  },
  화: {
    color: '빨강과 주황 포인트',
    direction: '남쪽',
    season: '여름',
    hobby: '유산소 운동과 사교 활동, 요리, 발표',
    time: '오시(11~13시), 여름 정오, 한낮',
    food: '쓴맛 약간, 커피와 매운 양념과 붉은 과일',
    item: '캔들과 붉은 인테리어와 태양 모티프 액자',
    people: '일간 丙 丁(火) 또는 甲 乙(木) 인 사람이 결을 받쳐줍니다',
  },
  토: {
    color: '황토색과 도자기 톤과 베이지',
    direction: '중앙과 서남쪽',
    season: '환절기',
    hobby: '명상, 정원, 도자기, 텃밭, 요가',
    time: '진시(07~09시), 미시(13~15시), 술시(19~21시)',
    food: '단맛 약간, 잡곡, 고구마, 꿀, 건과류',
    item: '도자기 컵과 테라코타 화분과 황토 매트',
    people: '일간 戊 己(土) 또는 丙 丁(火) 인 사람이 안정감을 줍니다',
  },
  금: {
    color: '흰색, 은색, 검정',
    direction: '서쪽과 북서쪽',
    season: '가을',
    hobby: '미니멀 정리, 서예, 검도, 호흡 운동과 요리(칼)',
    time: '신시(15~17시), 유시(17~19시), 가을 늦은 오후',
    food: '매운맛 약간, 흰살 생선, 견과류, 마늘, 생강',
    item: '은반지와 금속 시계와 검정 만년필과 미니멀 가구',
    people: '일간 庚 辛(金) 또는 戊 己(土) 인 사람이 결을 다듬어줍니다',
  },
  수: {
    color: '검정과 짙은 청색과 남색',
    direction: '북쪽',
    season: '겨울',
    hobby: '수영, 반신욕, 낚시, 명상, 독서',
    time: '해시(21~23시), 자시(23~01시), 겨울 새벽',
    food: '짠맛 약간, 해산물, 검정콩, 미역, 물 충분히',
    item: '유리 컵, 아쿠아리움, 푸른 그림과 블루투스 이어폰',
    people: '일간 壬 癸(水) 또는 庚 辛(金) 인 사람이 회복을 도와줍니다',
  },
};

/** 일간 한자 → 시적 상징 한 줄 (목업 v2 §1 패턴: "甲은 봄 새벽에 곧게 뻗는 큰 나무의 상(象)") */
const ILGAN_SYMBOL: Record<string, string> = {
  甲: '봄 새벽에 곧게 뻗는 큰 나무의 상(象). 흔들리지 않으려 뿌리부터 다잡는 결',
  乙: '바람에 휘는 작은 풀과 덩굴의 상. 부드럽되 끈질긴 결',
  丙: '한낮 정오의 태양. 가리지 않고 비추는 너른 빛의 결',
  丁: '저녁 등불과 촛불의 상. 어둠 속에서도 또렷하게 길을 비추는 결',
  戊: '높은 산과 너른 들의 상. 묵직하게 자리 잡고 바뀌지 않는 결',
  己: '논과 밭의 상. 작게 받아들이고 길러내는 부드러운 결',
  庚: '광물과 도끼날의 상. 정확하고 단단하게 끊어내는 결',
  辛: '보석과 세공된 금속의 상. 섬세하고 빛나는 결',
  壬: '큰 강과 바다의 상. 넓고 깊게 흐르는 결',
  癸: '가는 빗줄기와 이슬의 상. 조용히 스며들어 모든 것을 적시는 결',
};

/** 신강·신약 + 일간 오행 → 용신 후보 도출 (analysisBase 우선, fallback) */
/** 한자/한글 혼용 → OhengType 정규화 (火 → 화, '나무' → 목 등) */
function normalizeOheng(raw: unknown, fallback: OhengType): OhengType {
  if (!raw || typeof raw !== 'string') return fallback;
  const c = raw.trim().charAt(0);
  const HAN_MAP: Record<string, OhengType> = {
    '木': '목', '火': '화', '土': '토', '金': '금', '水': '수',
    '목': '목', '화': '화', '토': '토', '금': '금', '수': '수',
    '나': '목', '불': '화', '흙': '토', '쇠': '금', '물': '수',
  };
  return HAN_MAP[c] || fallback;
}

function deriveYongsin(
  analysisBase: any,
  dayOheng: OhengType,
): { primary: OhengType; secondary?: OhengType; reason: string } {
  // 일간 오행별 보완 매핑 (fallback 및 secondary dup 가드용)
  const COMPLEMENT: Record<OhengType, [OhengType, OhengType, string]> = {
    목: ['수', '금', '木 일간을 길러주는 水와 가다듬는 金의 결'],
    화: ['목', '수', '火 일간을 살려주는 木과 식혀주는 水의 결'],
    토: ['화', '목', '土 일간을 데워주는 火와 풀어주는 木의 결'],
    금: ['토', '수', '金 일간을 만드는 土와 다듬어주는 水의 결'],
    수: ['금', '목', '水 일간을 흐르게 하는 金과 끌어주는 木의 결'],
  };
  if (analysisBase?.용신) {
    const primary = normalizeOheng(analysisBase.용신, dayOheng);
    let secondary = analysisBase.희신 ? normalizeOheng(analysisBase.희신, dayOheng) : undefined;
    // 🚨 2026-05-05 dup 가드 (준기 지적) — primary === secondary 면 명리학적 의미 없음
    // AI 가 용신·희신 같은 오행으로 응답하는 경우 (이혜지 케이스: 둘 다 화) 발생
    // → 보완 매핑의 두 후보 중 primary 와 다른 것으로 자동 보정
    if (secondary === primary || !secondary) {
      const [c1, c2] = COMPLEMENT[dayOheng];
      secondary = c1 !== primary ? c1 : c2;
    }
    // reason 도 dayOheng·primary·secondary 글자 인용으로 동적화
    const KR: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
    const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
    const reason = analysisBase.용신근거
      || `${HAN[dayOheng]}(${KR[dayOheng]}) 일간을 ${HAN[primary]}(${KR[primary]})이 가장 필요로 하는 결. ${secondary ? `${HAN[secondary]}(${KR[secondary]})이 보조로 받쳐줍니다.` : ''}`;
    return { primary, secondary, reason };
  }
  // fallback: 일간 오행 → 보완 오행 자동 추정 (이미 dayOheng 인용)
  const [p, s, reason] = COMPLEMENT[dayOheng];
  return { primary: p, secondary: s, reason };
}

/* ══════════════════════════════════════════════════════════════════
 * 십성 매핑 (오행 상생상극)
 * ═════════════════════════════════════════════════════════════════ */
const SANGSAENG: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
const SANGGEUK: Record<OhengType, OhengType> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };

function getSipsungCategory(dayOheng: OhengType, target: OhengType): string {
  if (target === dayOheng) return '비겁';
  if (SANGSAENG[dayOheng] === target) return '식상';
  if (SANGGEUK[dayOheng] === target) return '재성';
  if (SANGGEUK[target] === dayOheng) return '관성';
  if (SANGSAENG[target] === dayOheng) return '인성';
  return '기타';
}

interface SipDist {
  비겁: number;
  식상: number;
  재성: number;
  관성: number;
  인성: number;
}

function buildSipDist(sajuData: SajuData): SipDist {
  const dayOheng = (sajuData.pillars[2]?.천간오행 ?? '토') as OhengType;
  const dist: SipDist = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const p of sajuData.pillars) {
    if (!p.available) continue;
    const ganOh = p.천간오행 as OhengType;
    const jiOh = p.지지오행 as OhengType;
    const ganCat = getSipsungCategory(dayOheng, ganOh) as keyof SipDist;
    const jiCat = getSipsungCategory(dayOheng, jiOh) as keyof SipDist;
    if (ganCat in dist) dist[ganCat] += 1;
    if (jiCat in dist) dist[jiCat] += 1;
  }
  return dist;
}

const SIP_STORY: Record<keyof SipDist, string> = {
  비겁: '독립심과 경쟁심 영역. 자기 길을 개척하는 힘',
  식상: '표현, 창작, 소통 영역. 만들어내고 나누는 힘',
  재성: '재물과 실리 영역. 돈의 흐름과 자원 운용 능력',
  관성: '직장과 사회적 지위 영역. 책임과 명예의 영역',
  인성: '학문, 배움, 어머니 영역. 받아들이고 키우는 힘',
};

/* 목업 .divider 진본 — className 만 사용 (좌우 골드 그라디언트 + 한자 라벨 CSS) */
function SectionDivider({ label }: { label?: string }) {
  return (
    <div className="divider" aria-hidden>
      {label && <span className="han">{label}</span>}
    </div>
  );
}


/**
 * Section5Body — mockup §5 본문 4 paragraphs 진본 형식
 *  · 1: 현재 대운 천간 + 일간 → 십성 풀이
 *  · 2: 현재 대운 지지 + 일간 → 십성 풀이 + "내가 깎이는 느낌" 구조
 *  · 3: 다음 대운 — 식신/편재/관성 등 어떤 자리가 열리는지
 *  · 4: 그 다음 대운 또는 부족 오행 들어오는 시기
 *  · 사주별 동적 (current 기준 ±1, +2)
 */
function Section5Body({
  userName,
  v4Daeun,
  dayOheng,
  aiDaeun,
}: {
  userName: string;
  v4Daeun: V4Daeun[];
  dayOheng: OhengType;
  aiDaeun: string;
}) {
  if (aiDaeun && aiDaeun.length >= 80) {
    const paras = aiDaeun.split(/\n+/).filter((p) => p.trim().length > 0);
    return (
      <div style={{ marginTop: 14 }}>
        {paras.map((p, i) => (
          <p key={i} style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(autoEmphasize(p)) }} />
        ))}
      </div>
    );
  }
  const curIdx = v4Daeun.findIndex((d) => d.current);
  if (curIdx < 0) return null;
  const cur = v4Daeun[curIdx];
  const next1 = curIdx + 1 < v4Daeun.length ? v4Daeun[curIdx + 1] : null;
  const next2 = curIdx + 2 < v4Daeun.length ? v4Daeun[curIdx + 2] : null;
  const HAN_OH: Record<string, OhengType> = {
    甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토',
    庚: '금', 辛: '금', 壬: '수', 癸: '수',
    寅: '목', 卯: '목', 巳: '화', 午: '화', 辰: '토', 戌: '토', 丑: '토', 未: '토',
    申: '금', 酉: '금', 亥: '수', 子: '수',
  };
  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  const KR: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const SS: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const SG: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
  function getSipsung(target: OhengType | undefined): { name: string; effect: string } {
    if (!target) return { name: '', effect: '' };
    if (target === dayOheng) return { name: '비견과 겁재', effect: '같은 결의 자리. 동료, 파트너, 자기 사람의 자리' };
    if (SS[dayOheng] === target) return { name: '식신과 상관', effect: '드러내는 자리와 이름이 알려지는 자리' };
    if (SG[dayOheng] === target) return { name: '정재와 편재', effect: '실리와 자원이 손에 잡히는 자리' };
    if (SG[target] === dayOheng) return { name: '정관과 편관', effect: '책임과 평가가 들어오는 자리' };
    if (SS[target] === dayOheng) return { name: '정인과 편인', effect: '받아들이고 익히는 자리' };
    return { name: '', effect: '' };
  }
  const ganHan = cur.gz?.[0] || '';
  const jiHan = cur.gz?.[1] || '';
  const ganOh = HAN_OH[ganHan];
  const jiOh = HAN_OH[jiHan];
  const ganSip = getSipsung(ganOh);
  const jiSip = getSipsung(jiOh);
  const ageStart = cur.age?.split('~')[0] || '';

  const para1 = `${userName} 님은 지금 <strong>${cur.age} ${cur.gz}(${cur.kr || ''}) 대운</strong>의 한가운데에 있습니다. 천간의 <strong>${ganHan}</strong>${ganOh ? `은 ${KR[ganOh]}` : ''} — <strong>${ganSip.name}</strong>의 자리입니다. 그래서 이 시기에는 <strong>${ganSip.effect}</strong>가 강해집니다.`;

  const para2 = `지지의 <strong>${jiHan}(${cur.kr?.[1] || ''})</strong>는 ${jiOh ? `<strong>${HAN[jiOh]}(${KR[jiOh]})</strong>` : ''} — <strong>${jiSip.name}</strong>으로 ${jiSip.effect}. 작년부터 올해까지 어딘가에서 <strong>"내가 ${ganOh === dayOheng ? '단단해지는' : SG[ganOh as OhengType] === dayOheng ? '깎이는' : SS[ganOh as OhengType] === dayOheng ? '받쳐지는' : '눌리는'} 느낌"</strong>을 받은 적이 있다면, 운이 나쁜 것이 아니라 <strong>이 결이 작동하는 중</strong>입니다. 모양이 잡히는 시기는 본래 아픕니다.`;

  let para3 = '';
  if (next1) {
    const n1ganHan = next1.gz?.[0] || '';
    const n1ganOh = HAN_OH[n1ganHan];
    const n1Sip = getSipsung(n1ganOh);
    // 조사: 받침 있으면 '이', 없으면 '가'
    const n1NameLast = n1Sip.name.charCodeAt(n1Sip.name.length - 1);
    const n1Postp = (n1NameLast >= 0xAC00 && n1NameLast <= 0xD7A3 && (n1NameLast - 0xAC00) % 28 !== 0) ? '이' : '가';
    para3 = `다음 대운인 <strong>${next1.age} ${next1.gz}(${next1.kr || ''})</strong>은 큰 전환점입니다. <strong>${n1ganHan}</strong>${n1ganOh ? `은 ${KR[n1ganOh]}` : ''} — ${userName} 님 일간(${HAN[dayOheng]})에게는 <strong>${n1Sip.name}</strong>${n1Postp} 작용해 <strong>${n1Sip.effect}</strong>가 활짝 열립니다. ${ageStart}대에 깎인 모양이 ${next1.age?.split('~')[0]}대에 빛을 받습니다. 지금 무리해서 결과를 빨리 보려 하지 않아도 괜찮은 이유입니다.`;
  }

  let para4 = '';
  if (next2) {
    const n2ganHan = next2.gz?.[0] || '';
    const n2ganOh = HAN_OH[n2ganHan];
    const n2Sip = getSipsung(n2ganOh);
    para4 = `<strong>${next2.age} ${next2.gz}(${next2.kr || ''})</strong>는 ${userName} 님 사주에 <strong>${n2ganOh ? KR[n2ganOh] : ''}</strong>의 결이 더해지는 시기입니다. ${n2Sip.effect}가 또렷이 자리잡고, 명예와 이름이 자리잡은 뒤 마음의 결이 한 번 더 정리됩니다.`;
  }

  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para1 }} />
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para2 }} />
      {para3 && <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para3 }} />}
      {para4 && <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para4 }} />}
    </div>
  );
}

/**
 * ShinsalSummary — 신살 한 줄씩 정리 (가독성 보조)
 *  · 사주에 발현된 신살을 강·중·참고 별 1~2 단어 키워드로 압축
 *  · 사용자가 "어떻게 활용할지" 빨리 잡히게
 */
function ShinsalSummary({
  userName,
  gilsin,
  hyungsal,
  aiCards,
  sajuData,
  dayOheng,
}: {
  userName: string;
  gilsin: V4SinSal[];
  hyungsal: V4SinSal[];
  aiCards?: AiShinsalCard[];
  sajuData?: SajuData;
  dayOheng?: OhengType;
}) {
  // AI shinsalCards 우선
  const list: Array<{ kr: string; hanja: string; tier: string; tag: string }> = [];
  if (Array.isArray(aiCards) && aiCards.length > 0) {
    for (const c of aiCards) {
      list.push({
        kr: c.kr || '신살',
        hanja: c.hanja || '',
        tier: c.tier || '강',
        tag: tagOfShinsal(c.kr || c.hanja || ''),
      });
    }
  } else {
    const all = [...gilsin, ...hyungsal];
    all.slice(0, 5).forEach((s, i) => {
      list.push({
        kr: s.kr && /[가-힣]/.test(s.kr) ? s.kr : '신살',
        hanja: s.hanja,
        tier: i < 2 ? '강' : i < 4 ? '중' : '참고',
        tag: tagOfShinsal(s.kr || s.hanja),
      });
    });
  }
  if (list.length === 0) return null;
  function tagOfShinsal(name: string): string {
    if (/도화|桃花|홍염|紅艶/.test(name)) return '매력';
    if (/문창|文昌|학당|學堂/.test(name)) return '학문과 표현';
    if (/천을|天乙|월덕|月德/.test(name)) return '귀인';
    if (/역마|驛馬/.test(name)) return '이동과 변화';
    if (/화개|華蓋/.test(name)) return '예술과 연구';
    if (/백호|白虎/.test(name)) return '추진력, 건강 주의';
    if (/괴강|魁罡/.test(name)) return '결단';
    if (/양인|羊刃/.test(name)) return '결단과 양면';
    if (/공망|空亡/.test(name)) return '특정 해 활성';
    if (/원진|怨嗔/.test(name)) return '관계 갈등';
    if (/혈|血|사|死/.test(name)) return '건강 주의';
    return '본인 결';
  }

  // 2026-05-05 v3 동적 개인화 (준기 "보일러플레이트 절대 금지")
  // 강 신살의 실제 이름·hanja·dayGan 글자 직접 호명 → 사주 8글자 specific 출력
  const strongOnes = list.filter((s) => s.tier.includes('강'));
  const tags = [...new Set(strongOnes.map((s) => s.tag))].filter((t) => t !== '본인 결');

  // dayGan ref + 신살 이름 풀 (개수도 호명)
  const dayGan = sajuData?.pillars?.[2]?.천간 as string | undefined;
  const ganMeta = dayGan && GAN_KO[dayGan] ? GAN_KO[dayGan] : null;
  const ganRef = ganMeta ? `<b>${ganMeta.ko}(${dayGan})</b> 일간` : `${userName} 님`;
  const strongCount = strongOnes.length;
  const strongNames = strongOnes
    .slice(0, 3)
    .map((s) => `<b>${s.kr}${s.hanja ? `(${s.hanja})` : ''}</b>`)
    .join(', ');
  // dayOheng 별 마무리 격려 (5 가지 다른 결)
  const ohengEnding: Record<OhengType, string> = {
    목: '뻗어나가는 결을 살려주는 자리',
    화: '환히 비추는 결을 살려주는 자리',
    토: '품어 안는 결을 살려주는 자리',
    금: '단단히 다듬는 결을 살려주는 자리',
    수: '깊이 흘러가는 결을 살려주는 자리',
  };
  const closingPhrase = dayOheng
    ? `${ganRef}의 ${ohengEnding[dayOheng]}로 작동하면 강점이 또렷해집니다`
    : '의식적으로 살리면 강점이 또렷해집니다';

  // 종평 텍스트 — 신살 이름 + 개수 + dayGan 직접 호명 (변수 4축으로 매번 다른 출력)
  let summary: string;
  if (tags.length === 0) {
    summary = `${ganRef} 사주는 <u>강한 신살이 두드러지지 않은</u> 결이에요. <strong>한쪽으로 치우치지 않은 균형 잡힌 사주</strong>라 어느 자리에서도 적응이 좋다는 뜻이고, 위 카드의 실천을 의식적으로 따르면 사주의 결이 더 또렷하게 살아납니다.`;
  } else if (tags.length === 1) {
    summary = `${ganRef}에 또렷이 작동하는 신살은 ${strongNames} <u>${strongCount}개</u> — <strong>${tags[0]} 결</strong>이에요. 지금까지 살아오면서 이 결과 관련된 일이 자주 있었을 거예요. ${closingPhrase}.`;
  } else {
    summary = `${ganRef}에 또렷이 작동하는 신살은 ${strongNames} <u>${strongCount}개</u> — <strong>${tags.slice(0, 2).join(', ')} 결</strong>이에요. 지금까지 인생 곳곳에 영향을 줬을 결들이고, ${closingPhrase}.`;
  }

  return (
    <div
      style={{
        marginTop: 14,
        background: 'linear-gradient(135deg, #fff 0%, rgba(212,175,55,0.04) 100%)',
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: '16px 16px',
      }}
    >
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 12,
          fontWeight: 700,
          color: C.goldDeep,
          letterSpacing: '0.04em',
          marginBottom: 10,
        }}
      >
        ◇ 종합 — 그래서 어떻게 살아가면 될까요?
      </div>
      <p
        style={{
          fontSize: 13,
          color: C.ink,
          lineHeight: 1.75,
          margin: 0,
          wordBreak: 'keep-all',
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeAiText(autoEmphasize(summary)) }}
      />
    </div>
  );
}

/**
 * Unyoung12Grid — 12운성 4 pillar 표
 *  · 일간 기준 각 지지(년·월·일·시) 의 12운성 단계
 *  · 12단계: 장생·목욕·관대·건록·제왕·쇠·병·사·묘·절·태·양
 *  · 강도 색상 (제왕/건록 강·관대/장생 양·쇠/병/사/묘 약·절/태/양/목욕 변화)
 */
// 2026-05-04 12운성 컴포넌트 호출 제거 (준기 결단). 함수 정의는 보존 (Phase 2 재도입 가능성).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-expect-error preserved for future
function _Unyoung12Grid({ sajuData }: { sajuData: SajuData }) {
  // sajuData.unyoung12 → 일간 vs 각 지지(년·월·일·시) 의 12운성 단계
  const data = sajuData.unyoung12 || [];
  if (!Array.isArray(data) || data.length === 0) return null;

  // 한자(沐浴/胎/養) ↔ 한글(목욕/태/양) 양방향 정규화
  const HAN_TO_KR: Record<string, string> = {
    '長生': '장생', '沐浴': '목욕', '冠帶': '관대', '冠带': '관대',
    '臨官': '건록', '临官': '건록', '建祿': '건록', '建禄': '건록',
    '帝旺': '제왕', '衰': '쇠', '病': '병', '死': '사',
    '墓': '묘', '絶': '절', '絕': '절', '胎': '태', '養': '양',
  };
  const KR_TO_HAN: Record<string, string> = {
    장생: '長生', 목욕: '沐浴', 관대: '冠帶', 건록: '建祿', 제왕: '帝旺',
    쇠: '衰', 병: '病', 사: '死', 묘: '墓', 절: '絶', 태: '胎', 양: '養',
  };

  function normalize(raw: string): { kr: string; han: string } {
    if (!raw) return { kr: '', han: '' };
    if (HAN_TO_KR[raw]) return { kr: HAN_TO_KR[raw], han: raw };
    if (KR_TO_HAN[raw]) return { kr: raw, han: KR_TO_HAN[raw] };
    return { kr: raw, han: raw };
  }

  // 12 단계 메타 — 강도 (1~5) + 한 줄 정의 + 자리에 들어왔을 때 풀이
  // 사람들이 가장 좋아하는 파트라서 풍부하게 (단계마다 5~6 줄 분량)
  type StageMeta = {
    intensity: 5 | 4 | 3 | 2 | 1; // 5 정점 · 4 강 · 3 변화 · 2 약 · 1 끝
    kind: 'strong' | 'mid' | 'weak';
    short: string;          // 한 줄 정의 (카드 상단)
    everyday: string;       // 일상 비유 — 사주 모르는 사람용 (가이드 영역)
    pillarPhrase: (pos: string) => string; // "이 자리에 들어왔을 때" 풀이 + 일상 풀이
  };
  // 일상 비유 — 인생 어느 시기에 해당하는지 누구나 이해할 수 있게
  const STAGE: Record<string, StageMeta> = {
    장생: { intensity: 4, kind: 'strong', short: '새로 태어나는 결 — 시작과 배움',
      everyday: '갓 태어난 아기 — 호기심, 에너지, 배움이 가득',
      pillarPhrase: (p) => `${p}에 장생이면 — 그 자리에서 <strong>새로 시작하는 힘</strong>이 강합니다. 늦게 시작해도 탄력을 받는 결이라, 진로 전환과 새 분야 도전이 잘 풀려요.` },
    목욕: { intensity: 3, kind: 'mid', short: '씻고 가라앉는 결 — 정비와 변화',
      everyday: '사춘기 — 흔들리고 매력이 피어나는 시기',
      pillarPhrase: (p) => `${p}에 목욕이면 — <strong>변화, 이동, 매력</strong>이 두드러지는 자리. 한곳에 오래 머무는 게 답답하고, 사람들이 끌리는 결이 있습니다.` },
    관대: { intensity: 4, kind: 'strong', short: '옷 갖춰 입는 결 — 자리 잡음',
      everyday: '사회 첫 출근 — 자격, 옷, 이름값을 갖추는 시기',
      pillarPhrase: (p) => `${p}에 관대면 — <strong>형식, 자격, 이름값</strong>이 자리잡는 결. 자격증, 학위, 직함이 결을 살리는 자리예요.` },
    건록: { intensity: 5, kind: 'strong', short: '봉록을 받는 결 — 안정된 자리',
      everyday: '커리어 안정기 — 자기 발로 서서 월급 받는 시기',
      pillarPhrase: (p) => `${p}에 건록이면 — <strong>자기 발로 서는 가장 안정된 자리</strong>. 노력한 만큼 결실이 또렷하게 돌아옵니다.` },
    제왕: { intensity: 5, kind: 'strong', short: '정점에 오른 결 — 가장 강한 자리',
      everyday: '인생 정점 — 권력과 영향력이 가장 큰 시기',
      pillarPhrase: (p) => `${p}에 제왕이면 — 그 자리에서 <strong>정점</strong>입니다. 너무 강해서 옆 사람과 부딪히기 쉬우니 한 박자 양보하는 연습이 필요해요.` },
    쇠:   { intensity: 2, kind: 'weak',   short: '한풀 꺾이는 결 — 정리와 이양',
      everyday: '은퇴 직전 — 후임에게 자리를 물려주는 시기',
      pillarPhrase: (p) => `${p}에 쇠면 — <strong>결을 다듬고 다음 사람에게 넘기는</strong> 자리. 욕심내지 않으면 평탄하고, 멘토링과 후배 양성이 잘 풀립니다.` },
    병:   { intensity: 2, kind: 'weak',   short: '아픔을 겪는 결 — 회복과 돌봄',
      everyday: '몸이 아픈 시기 — 무리하지 말고 회복이 본업',
      pillarPhrase: (p) => `${p}에 병이면 — 본인이 <strong>돌봐야 하는 결</strong>. 무리하면 가장 먼저 탈이 나는 자리라, 건강과 휴식 우선순위를 높이세요.` },
    사:   { intensity: 1, kind: 'weak',   short: '저무는 결 — 거두고 매듭',
      everyday: '인생 마무리 — 거두고 정리하는 시기',
      pillarPhrase: (p) => `${p}에 사면 — <strong>끝맺음과 정리</strong>의 자리. 새로 벌이기보다 마무리와 완결이 본업. 종교, 연구, 기록 분야에 적합.` },
    묘:   { intensity: 2, kind: 'weak',   short: '저장하는 결 — 보존과 기다림',
      everyday: '창고 — 깊이 묻어두고 시간이 지나야 가치가 보임',
      pillarPhrase: (p) => `${p}에 묘면 — <strong>깊이 묻어두는</strong> 자리. 시간이 지나야 가치가 드러나는 결이라, 장기 자산, 연구, 콜렉션이 잘 어울립니다.` },
    절:   { intensity: 1, kind: 'weak',   short: '끊기는 결 — 끝과 분리',
      everyday: '단절과 이별 — 기존 결을 비우는 시기',
      pillarPhrase: (p) => `${p}에 절이면 — <strong>단절과 분리</strong>의 결. 기존 결을 비우고 새 결로 갈아타는 자리예요. 환경 변화 후에 진짜 본인 결이 드러납니다.` },
    태:   { intensity: 3, kind: 'mid',    short: '잉태하는 결 — 새 흐름의 씨앗',
      everyday: '뱃속 아기 — 새 결이 안에서 자라는 시기',
      pillarPhrase: (p) => `${p}에 태면 — <strong>새 결이 안에서 자라는</strong> 자리. 아직 밖에 드러나지 않은 잠재가 있어요. 늦게 피는 결.` },
    양:   { intensity: 3, kind: 'mid',    short: '품어 기르는 결 — 잠재기',
      everyday: '갓난아기 — 보호받으며 자라는 시기',
      pillarPhrase: (p) => `${p}에 양이면 — <strong>보호받으며 자라는 결</strong>. 지켜주는 환경(가족, 멘토, 조직)이 필요한 자리.` },
  };

  // 12운성 사이클 (전통 순서 — 장생 → 목욕 → 관대 → 건록 → 제왕 → 쇠 → 병 → 사 → 묘 → 절 → 태 → 양)
  const CYCLE_ORDER = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];

  // POS 순서로 정렬 — 시 → 일 → 월 → 년
  const POS_ORDER = ['시', '일', '월', '연', '년'];
  const sorted = [...data].sort((a, b) => {
    const ai = POS_ORDER.findIndex((p) => (a.position || '').startsWith(p));
    const bi = POS_ORDER.findIndex((p) => (b.position || '').startsWith(p));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // 가장 강한 자리·가장 약한 자리 추출 (해석 헤드라인용)
  const ranked = sorted.map((u) => ({
    pos: u.position || '',
    raw: u.운성 || '',
    ...normalize(u.운성 || ''),
  })).map((x) => ({ ...x, meta: STAGE[x.kr] }));

  const strongest = [...ranked].sort((a, b) => (b.meta?.intensity ?? 0) - (a.meta?.intensity ?? 0))[0];
  const weakest = [...ranked].sort((a, b) => (a.meta?.intensity ?? 5) - (b.meta?.intensity ?? 5))[0];

  // 인생 흐름 한 줄 — 시→일→월→년 강도 변화로 "초년→청년→중년→말년" 식 흐름 도출
  // (사주 명리: 년주=조상·초년, 월주=청년·30~50, 일주=중장년·50~, 시주=말년·자녀)
  // 표시는 시→일→월→년 인데, 인생 시간은 년→월→일→시 → reverse 해석
  const lifeArc = [...ranked].reverse(); // [년, 월, 일, 시] = [초년, 청년, 중년, 말년]
  const lifeArcLabels = ['초년', '청년', '중년', '말년'];
  function buildLifeArc(): string {
    if (lifeArc.length < 3) return '';
    const intensities = lifeArc.map((x) => x.meta?.intensity ?? 3);
    const start = intensities[0];
    const end = intensities[intensities.length - 1];
    if (start >= 4 && end >= 4) return '<strong>전반과 후반 모두 자리 잡는 결</strong>이 강합니다. 흐름이 끊기지 않는 사주.';
    if (start >= 4 && end <= 2) return '<strong>초년이 강하고 말년이 깊어지는 결</strong>. 화려함보다 정리와 보존의 마무리.';
    if (start <= 2 && end >= 4) return '<strong>늦게 피는 결</strong>입니다. 초와 중년이 단단하지 않아도 후반에 자리잡습니다.';
    if (start >= 4 && intensities[1] <= 2) return '<strong>이른 자리잡음 후 한 번 꺾이는 결</strong>. 중년의 정리 시기를 잘 통과해야 합니다.';
    if (intensities.every((v) => v <= 2)) return '<strong>잔잔하게 흐르는 결</strong>. 큰 부침보다 꾸준한 안정이 본업.';
    if (intensities.every((v) => v >= 4)) return '<strong>매 자리마다 강한 결</strong>. 흐름의 정점이 여러 번 옵니다.';
    return '<strong>오르고 내림이 또렷한 결</strong>. 시기마다 다른 결을 살려야 합니다.';
  }

  // 색상 — 강도별 그라데이션 (오행 색감과 톤 통일)
  function colorOf(kind: 'strong' | 'mid' | 'weak'): { c: string; bg: string; chip: string; chipBg: string; label: string } {
    if (kind === 'strong') return { c: '#4E7A57', bg: 'linear-gradient(135deg, #fff 0%, rgba(78,122,87,0.06) 100%)', chip: '#fff', chipBg: 'linear-gradient(135deg, #4FAE6D, #4E7A57)', label: '강' };
    if (kind === 'weak')   return { c: '#C62828', bg: 'linear-gradient(135deg, #fff 0%, rgba(198,40,40,0.05) 100%)', chip: '#fff', chipBg: 'linear-gradient(135deg, #EF5350, #C62828)', label: '약' };
    return { c: '#B8965A', bg: 'linear-gradient(135deg, #fff 0%, rgba(184,150,90,0.07) 100%)', chip: '#fff', chipBg: 'linear-gradient(135deg, #B8965A, #8B6F3D)', label: '변' };
  }

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px dashed ${C.line}` }}>
      {/* 헤더 — 도장 + 호기심 카피 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            background: 'linear-gradient(135deg, #B8965A 0%, #8B6F3D 100%)',
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 20,
            fontWeight: 900,
            boxShadow: '0 3px 8px rgba(184,150,90,0.36)',
            flexShrink: 0,
          }}
        >
          運
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 16,
              fontWeight: 800,
              color: C.ink,
              letterSpacing: '0.02em',
              lineHeight: 1.3,
            }}
          >
            12운성 <span style={{ color: C.goldDeep, fontWeight: 700, marginLeft: 2 }}>十二運星</span>
          </div>
          <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.5, marginTop: 2 }}>
            인생을 12단계로 나눠 — 어느 자리(시기)가 강하고 약한지 한 눈에 봅니다
          </div>
        </div>
      </div>

      {/* 처음 보는 사람을 위한 친절한 도입 — 일상 비유 */}
      <div
        style={{
          background: 'rgba(184,150,90,0.05)',
          border: '1px dashed rgba(184,150,90,0.32)',
          borderRadius: 10,
          padding: '11px 13px',
          marginBottom: 14,
          fontSize: 11.5,
          color: C.inkSoft,
          lineHeight: 1.7,
          wordBreak: 'keep-all',
        }}
      >
        <span style={{ fontWeight: 700, color: C.goldDeep, marginRight: 4 }}>이렇게 읽으세요</span>
        — 사람이 <strong style={{ color: C.ink }}>태어나(장생) → 자라고 → 정점(제왕) → 저물고(쇠, 병, 사) → 다시 씨앗이 되는(태와 양)</strong> 인생 사이클 12단계입니다.
        내 사주 4 자리(년, 월, 일, 시)가 각각 어느 단계에 해당하는지 보면, <strong style={{ color: C.ink }}>인생 어느 시기가 강하고 약한지</strong> 가늠할 수 있어요.
        <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: C.mute }}>
          • <strong style={{ color: '#4E7A57', fontWeight: 700 }}>녹색</strong>은 강한 자리, <strong style={{ color: '#C62828', fontWeight: 700 }}>빨강</strong>은 약한 자리, <strong style={{ color: '#B8965A', fontWeight: 700 }}>골드</strong>는 변화의 자리예요.
        </span>
      </div>

      {/* 인생 흐름 한 줄 (年→月→日→時) */}
      {lifeArc.length >= 3 && (
        <div
          style={{
            background: 'linear-gradient(135deg, #FFFEF8 0%, #FAF6EC 100%)',
            border: '1px solid rgba(184,150,90,0.32)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 14,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.goldDeep,
              letterSpacing: '0.12em',
              marginBottom: 8,
            }}
          >
            ◆ 인생 흐름 한 줄, 命途
          </div>
          {/* 4 stage 시각 timeline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }}>
            {lifeArc.map((x, i) => {
              const meta = x.meta;
              const c = colorOf(meta?.kind || 'mid');
              return (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: C.mute, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 3 }}>
                      {lifeArcLabels[i] || ''}
                    </span>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: c.chipBg,
                        color: c.chip,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Noto Serif KR', serif",
                        fontSize: 14,
                        fontWeight: 900,
                        boxShadow: `0 2px 6px ${c.c}33`,
                      }}
                    >
                      {x.han || x.kr.charAt(0)}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.c, marginTop: 3 }}>{x.kr}</span>
                  </div>
                  {i < lifeArc.length - 1 && (
                    <span style={{ fontSize: 14, color: C.mute, padding: '0 2px', fontWeight: 800 }}>›</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <p
            style={{ fontSize: 12, color: C.ink, lineHeight: 1.7, margin: 0, wordBreak: 'keep-all' }}
            dangerouslySetInnerHTML={{ __html: buildLifeArc() }}
          />
        </div>
      )}

      {/* 4 자리 카드 (시 · 일 · 월 · 년) — 풍부한 풀이 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {ranked.map((u, i) => {
          const meta = u.meta;
          const c = colorOf(meta?.kind || 'mid');
          const isStrongest = strongest && u === strongest && (meta?.intensity ?? 0) >= 4;
          const isWeakest = weakest && u === weakest && (meta?.intensity ?? 5) <= 2 && u !== strongest;
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                padding: '11px 8px 12px',
                background: c.bg,
                border: `1.5px solid ${c.c}40`,
                borderRadius: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                textAlign: 'center',
                boxShadow: isStrongest ? `0 0 0 2px ${c.c}, 0 4px 14px ${c.c}22` : 'none',
                minWidth: 0,
              }}
            >
              {/* 가장 강한 자리 도장 */}
              {isStrongest && (
                <span
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 11,
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #f4d166, #B8965A)',
                    color: '#1a1a1a',
                    padding: '2px 8px',
                    borderRadius: 99,
                    letterSpacing: '0.04em',
                    boxShadow: '0 2px 6px rgba(244,209,102,0.32)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  가장 강함
                </span>
              )}
              {isWeakest && (
                <span
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 11,
                    fontWeight: 800,
                    background: 'rgba(198,40,40,0.92)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 99,
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(198,40,40,0.32)',
                  }}
                >
                  가장 약함
                </span>
              )}
              {/* 강·중·약 칩 (우상단) */}
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 6,
                  fontSize: 8.5,
                  fontWeight: 800,
                  color: c.chip,
                  background: c.chipBg,
                  padding: '1px 5px',
                  borderRadius: 3,
                  letterSpacing: '0.02em',
                }}
              >
                {c.label}
              </span>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.mute, letterSpacing: '0.04em', marginTop: isStrongest || isWeakest ? 6 : 2 }}>
                {u.pos}
              </div>
              <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 26, fontWeight: 900, color: c.c, lineHeight: 1, margin: '4px 0 2px', textShadow: `0 2px 8px ${c.c}22` }}>
                {u.han || u.kr.charAt(0)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.c, letterSpacing: '0.02em' }}>
                {u.kr}
              </div>
              {/* 강도 5점 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 4 }}>
                {Array.from({ length: 5 }, (_, j) => (
                  <span
                    key={j}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: j < (meta?.intensity ?? 0) ? c.c : '#E5DFD0',
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.45, marginTop: 5, wordBreak: 'keep-all' }}>
                {meta?.short || ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* 가장 강한·가장 약한 자리 풀이 (각 자리 의미) */}
      {strongest && strongest.meta && (
        <div
          style={{
            // 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). border ring + 라벨 chip 컬러로 톤 표현.
            marginTop: 14,
            background: '#FFFFFF',
            border: '1px solid #E5DFD0',
            borderRadius: 8,
            padding: '11px 13px',
            fontSize: 12,
            color: C.ink,
            lineHeight: 1.7,
            wordBreak: 'keep-all',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 800,
              color: colorOf(strongest.meta.kind).c,
              background: `${colorOf(strongest.meta.kind).c}14`,
              padding: '2px 7px',
              borderRadius: 4,
              marginRight: 8,
              letterSpacing: '0.04em',
              verticalAlign: 'middle',
              whiteSpace: 'nowrap',
            }}
          >
            가장 강함
          </span>
          <span dangerouslySetInnerHTML={{ __html: strongest.meta.pillarPhrase(strongest.pos) }} />
          <div style={{ marginTop: 6, fontSize: 11, color: C.mute, fontStyle: 'italic' }}>
            ↳ {strongest.meta.everyday}
          </div>
        </div>
      )}
      {weakest && weakest.meta && weakest !== strongest && (
        <div
          style={{
            // 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). border ring + 라벨 chip 컬러로 톤 표현.
            marginTop: 8,
            background: '#FFFFFF',
            border: '1px solid #E5DFD0',
            borderRadius: 8,
            padding: '11px 13px',
            fontSize: 12,
            color: C.ink,
            lineHeight: 1.7,
            wordBreak: 'keep-all',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 800,
              color: colorOf(weakest.meta.kind).c,
              background: `${colorOf(weakest.meta.kind).c}14`,
              padding: '2px 7px',
              borderRadius: 4,
              marginRight: 8,
              letterSpacing: '0.04em',
              verticalAlign: 'middle',
              whiteSpace: 'nowrap',
            }}
          >
            가장 약함
          </span>
          <span dangerouslySetInnerHTML={{ __html: weakest.meta.pillarPhrase(weakest.pos) }} />
          <div style={{ marginTop: 6, fontSize: 11, color: C.mute, fontStyle: 'italic' }}>
            ↳ {weakest.meta.everyday}
          </div>
        </div>
      )}

      {/* 12 단계 사이클 미니 가이드 — 사주 모르는 사람용 */}
      <details
        style={{
          marginTop: 14,
          background: '#F8F5EE',
          border: '1px solid #E5DFD0',
          borderRadius: 10,
          padding: '10px 14px',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            color: C.goldDeep,
            letterSpacing: '0.04em',
            outline: 'none',
            listStyle: 'none',
          }}
        >
          12 단계 사이클이 뭐예요? <span style={{ color: C.mute, fontWeight: 500, marginLeft: 4 }}>+ 펼치기</span>
        </summary>
        <div style={{ marginTop: 10, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.7 }}>
          사람이 <strong style={{ color: C.ink }}>태어나(장생) → 자라고 → 정점(제왕) → 저물고(쇠, 병, 사) → 다시 씨앗이 되는(태와 양)</strong> 인생 사이클을 12 단계로 본 것입니다.
          내 일간이 사주 4 자리(년, 월, 일, 시)에서 어느 단계에 해당하는지 보면 — <strong style={{ color: C.ink }}>인생 어느 시기에 어떤 결</strong>이 작동하는지 보입니다.
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            {CYCLE_ORDER.map((stage, i) => {
              const m = STAGE[stage];
              const c = colorOf(m.kind);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    // 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). 한자 컬러로 톤 표현.
                    gap: 8,
                    fontSize: 11,
                    padding: '6px 8px',
                    background: i % 2 === 0 ? 'rgba(184,150,90,0.04)' : '#fff',
                    borderRadius: 5,
                  }}
                >
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 14, fontWeight: 900, color: c.c, minWidth: 20, textAlign: 'center', flexShrink: 0 }}>
                    {KR_TO_HAN[stage]}
                  </span>
                  <span style={{ fontWeight: 800, color: c.c, minWidth: 30, fontSize: 11, flexShrink: 0 }}>{stage}</span>
                  <span style={{ flex: 1, lineHeight: 1.55 }}>
                    <span style={{ color: C.ink, fontWeight: 600 }}>{m.everyday}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * SectionXConclusion — mockup 진본 형식 다크박스 결론
 *  · 핵심 키워드 골드 강조 (CSS .section-conclusion strong { color: #f4d166 })
 *  · 사주별 동적 본문 + AI 우선
 * ═════════════════════════════════════════════════════════════════ */

function Section1Conclusion({
  userName, sajuData, ilgan, ilganOheng, aiText,
}: {
  userName: string; sajuData: SajuData; ilgan: string; ilganOheng: string; aiText: string;
}) {
  if (aiText && aiText.length >= 30) {
    return <SectionConclusion label="이 섹션의 결론 — 한 줄로 요약하면">{aiText}</SectionConclusion>;
  }
  const e = sajuData.elements as Record<OhengType, number>;
  const counts: Array<[OhengType, number]> = (['목', '화', '토', '금', '수'] as OhengType[]).map((k) => [k, Number(e?.[k] ?? 0)]);
  const sortedDesc = [...counts].sort((a, b) => b[1] - a[1]);
  const sortedAsc = [...counts].sort((a, b) => a[1] - b[1]);
  const strong = sortedDesc[0][0];
  const weak1 = sortedAsc[0][0];
  const weak2 = sortedAsc[1][0];
  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  const KR: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const dayOh = (ilganOheng || '토') as OhengType;
  const html = `${userName} 님은 <strong>${ilgan}(${KR[dayOh]}) 일간</strong>으로, <strong>${HAN[strong]}(${KR[strong]})이 가장 두텁고 ${HAN[weak1]}, ${HAN[weak2]}이 부족한 결</strong>입니다. 재능과 표현력은 사주가 받쳐주지만, <strong>다듬는 칼(규율과 마감)과 뿌리에 물을 대는 쉼(${KR[weak1]}, ${KR[weak2]})</strong>은 본인이 구조로 설계해두어야 합니다. 재능보다 <strong>'브레이크'를 먼저 다는</strong> 사주입니다.`;
  return (
    <div className="section-conclusion">
      <div className="sc-label">이 섹션의 결론 — 한 줄로 요약하면</div>
      <p dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Section2Conclusion({
  userName, sajuData, ilgan, aiText,
}: {
  userName: string; sajuData: SajuData; ilgan: string; aiText: string;
}) {
  if (aiText && aiText.length >= 30) {
    return <SectionConclusion label="이 섹션의 결론 — 그래서 뭘 얻고 뭘 해야 하나">{aiText}</SectionConclusion>;
  }
  // sipsung 분포 기반 ① ② ③
  const dayOh = (sajuData.pillars[2]?.천간오행 ?? '토') as OhengType;
  const SS: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const SG: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
  const sipDist: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const p of sajuData.pillars) {
    if (!p.available) continue;
    [p.천간오행, p.지지오행].forEach((tgt) => {
      if (!tgt) return; const t = tgt as OhengType;
      if (t === dayOh) sipDist.비겁++;
      else if (SS[dayOh] === t) sipDist.식상++;
      else if (SG[dayOh] === t) sipDist.재성++;
      else if (SG[t] === dayOh) sipDist.관성++;
      else if (SS[t] === dayOh) sipDist.인성++;
    });
  }
  const top = (Object.entries(sipDist) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  const TOP_DESC: Record<string, string> = {
    비겁: `<strong>"내가 끌고 가야지"의 본능</strong>이 평생 작동합니다. <strong>책임져야 할 대상은 '한두 개'로 의도적으로 좁혀야</strong> 본인이 무너지지 않습니다.`,
    식상: `<strong>표현과 창작이 본인 결의 핵심</strong>입니다. <strong>본인 이름이 붙는 채널을 1년 이상</strong> 끊김 없이 굴려야 결과가 모입니다.`,
    재성: `<strong>실리와 자원을 다루는 결</strong>이 강합니다. 다만 <strong>한 자리에 너무 깊이 들어가면</strong> 빠르게 잃을 수 있어 분산이 평생 원칙입니다.`,
    관성: `<strong>책임과 평가의 결</strong>이 짙습니다. <strong>판단과 재량이 보장된 자리</strong>에서 가장 빛나며, 단단한 위계는 5년 이상 권하지 않습니다.`,
    인성: `<strong>받아들이고 익히는 결</strong>이 강합니다. 배움 안에서만 머물지 말고 <strong>배운 즉시 산출</strong>로 이어주세요.`,
  };
  const isStrong = ['甲', '丙', '戊', '庚', '壬'].includes(ilgan);
  const html =
    `<p><span class="sc-num">①</span> ${TOP_DESC[top[0]]}</p>` +
    `<p><span class="sc-num">②</span> ${userName} 님은 일간 <strong>${ilgan}</strong>의 ${isStrong ? '양적과 외향' : '음적과 내향'} 결을 평생 따라갑니다. <strong>본인 결을 거스르는 자리에 오래 두지 마세요</strong>.</p>` +
    `<p><span class="sc-num">③</span> 천간(마음)과 지지(행동)의 짜임이 <strong>${sajuData.pillars[2]?.천간오행 === sajuData.pillars[2]?.지지오행 ? '일치' : '미세하게 어긋'}</strong>합니다. ${sajuData.pillars[2]?.천간오행 === sajuData.pillars[2]?.지지오행 ? '본인 결과 행동이 자연스럽게 맞물리는 강점.' : '"보여지는 모습과 실제 행동이 다르다"는 결이 있어, 자기 일치도를 의식적으로 점검하세요.'}</p>`;
  return (
    <div className="section-conclusion">
      <div className="sc-label">이 섹션의 결론 — 그래서 뭘 얻고 뭘 해야 하나</div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Section3Conclusion({
  userName, sipDist, aiText,
}: {
  userName: string; sipDist: SipDist; aiText: string;
}) {
  // 2026-05-05 통일성 — 모든 §결론은 SectionConclusion 컴포넌트 통과 (다른 §과 동일 톤·강조 색상)
  if (aiText && aiText.length >= 30) {
    return <SectionConclusion label={`이 섹션의 결론 — 한 줄로 ${userName} 님은`}>{aiText}</SectionConclusion>;
  }
  // fallback — sipDist 기반 동적 한 줄 (① ② ③ 패턴으로 SectionConclusion 에 위임)
  const sorted = (Object.entries(sipDist) as [keyof SipDist, number][]).sort((a, b) => b[1] - a[1]);
  const top = sorted[0][0];
  const total = sorted.reduce((a, b) => a + b[1], 0) || 1;
  const pct = (k: keyof SipDist) => Math.round((sipDist[k] / total) * 100);
  const ONE_LINE: Record<keyof SipDist, string> = {
    비겁: '"자기 길을 개척하는 사람"',
    식상: '"만들고 드러내는 사람"',
    재성: '"실리와 자원을 다루는 사람"',
    관성: '"책임과 평가를 받쳐주는 사람"',
    인성: '"받아들이고 익히는 사람"',
  };
  // ① ② ③ 패턴으로 묶음 → SectionConclusion 의 numSplit 분기에서 동일 디자인 렌더
  const text = [
    `① <strong>${ONE_LINE[top]}</strong> — 본인이 <strong>${top}(${pct(top)}%)이 가장 두꺼운 결</strong>. 이 결을 살리는 자리에 가야 본인이 살아납니다.`,
    sipDist.식상 >= 2 && sipDist.관성 >= 1
      ? `② 직장 안에서 답답하다면 — 그건 <strong>상관견관(傷官見官) 구조</strong> 탓. 능력 부족이 아닙니다. <strong>1인 프로젝트와 사업</strong> 쪽이 사주에 더 맞아요.`
      : `② ${userName} 님 사주는 한쪽으로 치우치지 않은 <strong>균형 잡힌 결</strong>. 어느 자리에서도 적응하지만 본인 결정 권한을 의식적으로 잡아두세요.`,
    sipDist.비겁 >= 2 && sipDist.재성 >= 1
      ? `③ 돈을 가까운 사람과 섞지 마세요. <strong>겁재(${pct('비겁')}%)가 정재(${pct('재성')}%)를 밀어내는 구조</strong> — 동업과 지인 투자는 사주에 박힌 취약점입니다.`
      : ''
  ].filter(Boolean).join('\n');
  return <SectionConclusion label={`이 섹션의 결론 — 한 줄로 ${userName} 님은`}>{text}</SectionConclusion>;
}

function Section4Conclusion({
  userName, primary, lifestyle, aiText,
}: {
  userName: string; primary: OhengType; lifestyle: LifestyleSet; aiText: string;
}) {
  if (aiText && aiText.length >= 30) {
    return <SectionConclusion label="이 섹션의 결론 — 오늘부터 못 박을 것">{aiText}</SectionConclusion>;
  }
  void userName;
  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  const html =
    `<p>→ 책상을 <strong>${lifestyle.direction}</strong>으로 돌리세요. 이게 1번입니다.</p>` +
    `<p>→ 옷장에 <strong>${lifestyle.color} 비중을 50% 이상</strong>으로 맞추세요.</p>` +
    `<p>→ 결정, 계약, 발표는 <strong>${lifestyle.season}</strong>에 잡으세요. 같은 일도 흐름이 다릅니다.</p>` +
    `<p>→ 매일 <strong>${HAN[primary]}(${primary === '수' ? '물 2L' : primary === '화' ? '햇빛 1시간' : primary === '목' ? '식물과 나무 만지기' : primary === '금' ? '미니멀 정리' : '잡곡과 도자기 활용'})</strong>를 보급하세요. 의지가 아니라 보급입니다.</p>`;
  return (
    <div className="section-conclusion">
      <div className="sc-label">이 섹션의 결론 — 오늘부터 못 박을 것</div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Section5Conclusion({
  userName, v4Daeun, dayOheng, aiText,
}: {
  userName: string; v4Daeun: V4Daeun[]; dayOheng: OhengType; aiText: string;
}) {
  if (aiText && aiText.length >= 30) {
    return <SectionConclusion label="이 섹션의 결론 — 큰 강줄기 한 줄">{aiText}</SectionConclusion>;
  }
  const cur = v4Daeun.find((d) => d.current);
  const curIdx = v4Daeun.findIndex((d) => d.current);
  const next = curIdx >= 0 && curIdx + 1 < v4Daeun.length ? v4Daeun[curIdx + 1] : null;
  void dayOheng;
  if (!cur) return null;
  const html = `${userName} 님은 지금 <strong>${cur.gz}(${cur.kr || ''}) 대운 ${cur.age}</strong>의 한가운데 — <strong>${cur.label || '결과를 받을 그릇을 굽는'} 10년</strong>입니다. ${next ? `다음 <strong>${next.gz}(${next.kr || ''}) 대운 ${next.age}</strong>이 큰 전환점이니, 지금 무리해서 결과를 빨리 보려 하지 마세요.` : '지금의 결을 잘 굳히는 게 평생 자산입니다.'} <strong>"30대에 깎인 모양이 40대에 빛을 받는다"</strong> — 그게 ${userName} 님 사주의 큰 강줄기입니다.`;
  return (
    <div className="section-conclusion">
      <div className="sc-label">이 섹션의 결론 — 큰 강줄기 한 줄</div>
      <p dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/**
 * Section8Conclusion — mockup §8 결론 형식 (관계 한 줄 정리) — sipDist 기반 동적
 */
// 2026-05-05 dead code (준기 결단 · 다음 sprint 재도입 가능)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-expect-error preserved
function _Section8Conclusion({
  userName,
  sipDist,
  dayOheng,
}: {
  userName: string;
  sipDist: SipDist;
  dayOheng: OhengType;
}) {
  // 가장 두꺼운 관계 자리
  const sorted = (Object.entries(sipDist) as [keyof SipDist, number][]).sort((a, b) => b[1] - a[1]);
  const topSip = sorted[0][0];
  const TOP_REL: Record<keyof SipDist, string> = {
    비겁: '<strong>친구, 동료, 형제</strong>의 자리',
    식상: '<strong>자녀와 창작</strong>의 자리',
    재성: '<strong>배우자와 실리</strong>의 자리',
    관성: '<strong>상사와 평가</strong>의 자리',
    인성: '<strong>부모와 학습</strong>의 자리',
  };
  const dangerLine = sipDist.비겁 >= 2 && sipDist.재성 >= 1
    ? `${userName} 님 사주는 <strong>비겁이 재성을 침범하는 구조</strong>라 <strong>가까운 사람과 큰돈을 섞을 때</strong>가 가장 큰 위험점입니다.`
    : sipDist.식상 >= 2 && sipDist.관성 >= 1
    ? `${userName} 님 사주는 <strong>상관견관(傷官見官) 구조</strong>라 <strong>위계가 단단한 조직</strong>에서 답답함이 큰 자리입니다.`
    : '';
  const SS_REV: Record<OhengType, OhengType> = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
  const calmer = SS_REV[dayOheng];
  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  const KR: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const GAN_BY_OH: Record<OhengType, string> = { 목: '甲 乙', 화: '丙 丁', 토: '戊 己', 금: '庚 辛', 수: '壬 癸' };
  const partner = `<strong>${GAN_BY_OH[calmer]}(${HAN[calmer]}, ${KR[calmer]})</strong> 일간의 사람`;
  const html = `${userName} 님 인생의 가장 큰 자산은 ${TOP_REL[topSip]}입니다. ${dangerLine ? `동시에 가장 큰 위험도 거기 있습니다 — ${dangerLine} <strong>"가까이 두되 결정 권한과 돈은 분리한다"</strong>가 평생의 원칙이 되어야 합니다. ` : ''}${partner}을 곁에 두면 부족한 ${KR[calmer]}의 결을 채워줍니다.`;
  return (
    <div className="section-conclusion">
      <div className="sc-label">이 섹션의 결론 — 관계 한 줄 정리</div>
      <p dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/**
 * Section4Avoid — mockup §4 "절대 더 들어와서는 안 되는 글자" paragraph
 *  · 가장 두꺼운 오행 (이미 강함) → 더 들어오면 안 됨
 *  · 두번째 두꺼운 오행도 함께 경고 (있으면)
 *  · 사주별 동적
 */
function Section4Avoid({
  sajuData,
  dayOheng,
  aiText,
}: {
  sajuData: SajuData;
  dayOheng: OhengType;
  aiText: string;
}) {
  if (aiText && aiText.length >= 50) {
    return (
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '14px 0', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(autoEmphasize(aiText)) }} />
    );
  }
  const e = sajuData.elements as Record<OhengType, number>;
  const counts: Array<[OhengType, number]> = [
    ['목', Number(e?.목 ?? 0)], ['화', Number(e?.화 ?? 0)],
    ['토', Number(e?.토 ?? 0)], ['금', Number(e?.금 ?? 0)],
    ['수', Number(e?.수 ?? 0)],
  ];
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const second = sorted[1];
  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  const KR: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const SS_REV: Record<OhengType, OhengType> = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
  const burns = (a: OhengType, b: OhengType) => {
    // a 가 b를 태우는/소모하는 관계
    return SS_REV[a] === b ? `${KR[b]}을 ${a === '화' ? '태웁니다' : '메마르게 합니다'}` : '';
  };
  const topPhrase = `<strong>${HAN[top[0]]}(${KR[top[0]]})${top[0] === dayOheng ? '도' : '이'} 더 들어오면 안 됩니다.</strong> 이미 ${top[1]}자가 자리하고 있습니다.`;
  const secondPhrase = second[1] >= 2 ? `<strong>${HAN[second[0]]}(${KR[second[0]]})도 너무 많아지면</strong> ${burns(second[0], dayOheng) || `본인 결을 흔듭니다`}.` : '';
  return (
    <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '14px 0', wordBreak: 'keep-all' }}
       dangerouslySetInnerHTML={{ __html: `그리고 절대 더 들어와서는 안 되는 글자도 분명합니다. ${topPhrase} ${secondPhrase} 이 글자가 강해지는 시기에는 새 일을 벌이지 마세요.` }} />
  );
}

/**
 * Section3Body — mockup §3 본문 3 paragraphs 진본 형식
 *  · 1: 6개 글자 함께 있는 의미 — 다재다능 vs 매일 여러 욕망
 *  · 2: 상관견관 등 특수 구조 (식상+관성)
 *  · 3: 겁재 강한 사주 — 형제·친구·동업자 손실 패턴
 */
// 2026-05-04 §03 십성 중복 버그 수정 (준기 결단) — SipsungStory 와 통합. 정의는 보존.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-expect-error preserved
function _Section3Body({
  sajuData: _sajuData,
  userName,
  sipDist,
  aiSipsung,
}: {
  sajuData: SajuData;
  userName: string;
  sipDist: SipDist;
  aiSipsung: string;
}) {
  if (aiSipsung && aiSipsung.length >= 80) {
    const paras = aiSipsung.split(/\n+/).filter((p) => p.trim().length > 0);
    return (
      <div style={{ marginTop: 14 }}>
        {paras.map((p, i) => (
          <p key={i} style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(autoEmphasize(p)) }} />
        ))}
      </div>
    );
  }
  // Fallback — 사주별 sipDist 기반 동적
  const total = sipDist.비겁 + sipDist.식상 + sipDist.재성 + sipDist.관성 + sipDist.인성 || 1;
  const pct = (k: keyof SipDist) => Math.round((sipDist[k] / total) * 100);
  // 가장 두꺼운 무리
  const sorted = (Object.entries(sipDist) as [keyof SipDist, number][]).sort((a, b) => b[1] - a[1]);
  const top = sorted[0][0];
  const TOP_PROFILE: Record<keyof SipDist, string> = {
    비겁: `<strong>"내가 결정하고 내가 책임지는"</strong> 결의 사람 — 자기 길을 개척하는 자리에 가야 본인이 살아납니다.`,
    식상: `<strong>"창의적으로 일하면서 표현하고 싶은"</strong> 결 — 만들어내고 드러내는 자리에 가야 살아납니다.`,
    재성: `<strong>"실리를 다루고 자원을 갖추는"</strong> 결 — 본업 + 사이드 자산을 동시에 굴릴 때 본인이 살아납니다.`,
    관성: `<strong>"평가받고 책임지는"</strong> 결 — 사회적 자리, 타이틀, 역할이 또렷해질 때 본인이 살아납니다.`,
    인성: `<strong>"받아들이고 익히는"</strong> 결 — 학습, 돌봄, 연구 자리에서 본인이 살아납니다.`,
  };
  const para1 = `${userName} 님 사주에서 가장 두꺼운 무리는 <strong>${top}(${pct(top)}%)</strong>입니다. ${TOP_PROFILE[top]} 다른 무리들도 함께 자리해 ${userName} 님이 <strong>"매일 여러 욕망이 동시에 잡아당기는"</strong> 피곤함을 자주 느낄 수 있는데, 한쪽으로 치우치지 않으니 다재다능해 보이는 결입니다.`;

  // 상관견관 (식상 + 관성 동시 두꺼움)
  let para2 = '';
  if (sipDist.식상 >= 2 && sipDist.관성 >= 1) {
    para2 = `특히 <strong>상관과 정관이 같이 있는 구조</strong>는 명리에서 자주 다루어지는 자리입니다. 옛 책에서는 <strong>"상관견관(傷官見官)"</strong> — 표현하고 싶은 마음과 규율이 부딪히는 자리라 하였습니다. ${userName} 님이 직장 안에서 답답함을 자주 느낀다면, 능력 부족이 아니라 <strong>구조적으로 충돌이 짜여 있는</strong> 문제입니다. 이 글자가 도리어 본인의 사업이나 1인 프로젝트에서는 가장 큰 무기가 됩니다.`;
  } else if (sipDist.인성 >= 3) {
    para2 = `<strong>인성이 두꺼운 사주</strong>는 받아들이고 익히는 결이 강한데, 너무 두꺼우면 <strong>배움 안에서만 머물기 쉬운</strong> 자리이기도 합니다. 배운 즉시 글, 발표, 작품으로 산출하는 루틴을 두면 인성의 결이 진짜 자산이 됩니다.`;
  } else if (sipDist.관성 >= 3) {
    para2 = `<strong>관성이 두꺼운 사주</strong>는 사회적 평가와 책임의 결이 강합니다. 다만 위계가 단단한 조직에서 <strong>판단과 재량이 좁게 묶이면</strong> 답답해집니다. 본인 판단이 보장된 자리에서 가장 빛납니다.`;
  } else if (sipDist.재성 >= 3) {
    para2 = `<strong>재성이 두꺼운 사주</strong>는 실리와 자원을 다루는 결이 강합니다. 다만 너무 두꺼우면 <strong>"돈이 들어와도 다시 빠져나가는"</strong> 패턴이 있어, 자동이체와 고정 적립 같은 시스템 저축이 평생의 자산이 됩니다.`;
  } else {
    para2 = `${userName} 님 사주는 한쪽 무리가 압도적이지 않아 <strong>균형 잡힌 결</strong>입니다. 어느 자리에 가도 적응하는 강점이 있되, 본인 결정의 핵심 축을 의식적으로 잡아두는 게 평생 자산입니다.`;
  }

  // 겁재 강한 사주 — 금전 손실 패턴
  let para3 = '';
  if (sipDist.비겁 >= 2 && sipDist.재성 >= 1) {
    para3 = `<strong>겁재가 강한 사주</strong>의 특성도 짚어두겠습니다. 같은 결의 사람이 옆에 많아 든든해 보이지만, 정재(돈과 약속)를 빼앗아가는 자리이기도 합니다. <strong>형제, 친구, 동업자와 금전을 섞을 때 가장 큰 손실이 일어납니다. 이건 확률이 아니라 ${userName} 님 사주에 박힌 패턴입니다.</strong> 돈에 대해서는 한 발 떨어져 결정하는 습관이 평생의 자산이 됩니다.`;
  } else if (sipDist.비겁 >= 3) {
    para3 = `<strong>비겁이 매우 두꺼운 사주</strong>는 자기 결정권이 단단한 만큼, 같은 결의 사람과 협업할 때 의도가 서로 부딪히기 쉽습니다. <strong>역할과 지분을 시작 전에 명문화</strong>하는 것이 평생의 원칙이 되어야 합니다.`;
  } else if (sipDist.식상 >= 3) {
    para3 = `<strong>식상이 매우 두꺼운 사주</strong>는 표현과 창작 결이 핵심이라, 본인 이름이 붙는 채널 (글, 영상, 강의, 발표)을 1년 이상 끊김 없이 굴리면 <strong>다음 대운에서 큰 빛</strong>이 됩니다.`;
  } else if (sipDist.재성 >= 3) {
    para3 = `재성이 두꺼운 사주는 <strong>본업과 사이드 자산을 함께 굴리는</strong> 결이 강점입니다. 다만 한 자리에 너무 깊이 들어가면 빠르게 쌓아도 빠르게 잃을 수 있어, <strong>분산</strong>이 평생 원칙이 되어야 합니다.`;
  } else {
    para3 = `${userName} 님 사주는 십성 분포가 균형 잡혀 어느 영역에서도 무너지지 않습니다. 단, 한 영역의 결을 깊이 파는 의식적 노력이 없다면 <strong>"여러 가지를 조금씩"</strong> 패턴에 갇힐 수 있습니다.`;
  }

  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para1 }} />
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para2 }} />
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para3 }} />
    </div>
  );
}

/**
 * Section2Body — mockup §2 본문 4 paragraphs 진본 형식
 *  · 1: 천간 줄 (4글자) + 일간 위주 풀이 + 책임 본능
 *  · 2: 지지 줄 (4글자) + 일지·시지 흐름
 *  · 3: 연주 글자 — 외로이 떨어진 자리, 어릴적 환경
 *  · 4: 합·충·형 한 줄 결
 *  · 모두 사주 specific 동적
 */
function Section2Body({
  sajuData,
  userName,
  ilgan,
  ilganOheng,
  aiStructure,
}: {
  sajuData: SajuData;
  userName: string;
  ilgan: string;
  ilganOheng: string;
  aiStructure: string;
}) {
  if (aiStructure && aiStructure.length >= 80) {
    const paras = aiStructure.split(/\n+/).filter((p) => p.trim().length > 0);
    return (
      <div style={{ marginTop: 14 }}>
        {paras.map((p, i) => (
          <p key={i} style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(autoEmphasize(p)) }} />
        ))}
      </div>
    );
  }
  // Fallback — 사주 specific 동적
  const pillars = sajuData.pillars;
  if (pillars.length < 4) return null;
  // mockup 표시 순서: [시, 일, 월, 연] (역순)
  const ganChars = [3, 2, 1, 0].map((i) => pillars[i]?.천간).filter(Boolean);
  const jiChars = [3, 2, 1, 0].map((i) => pillars[i]?.지지).filter(Boolean);
  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  const KR_OH: Record<OhengType, string> = { 목: '목', 화: '화', 토: '토', 금: '금', 수: '수' };
  const ganOhengs = [3, 2, 1, 0]
    .map((i) => pillars[i]?.천간오행 ? KR_OH[pillars[i].천간오행 as OhengType] : '')
    .filter(Boolean)
    .join(', ');
  const jiOhengs = [3, 2, 1, 0]
    .map((i) => pillars[i]?.지지오행 ? KR_OH[pillars[i].지지오행 as OhengType] : '')
    .filter(Boolean)
    .join(', ');
  const dayOheng = (ilganOheng || '토') as OhengType;
  const yearJi = pillars[0]?.지지 || '';
  const yearJiOheng = pillars[0]?.지지오행 as OhengType | undefined;
  const dayJi = pillars[2]?.지지 || '';
  const timeJi = pillars[3]?.지지 || '';
  void dayOheng;

  // 천간 줄 풀이 — 일간 oheng 기준 다른 천간 분석
  const otherGans = [pillars[0]?.천간, pillars[1]?.천간, pillars[3]?.천간].filter(Boolean);
  const para1 = `${userName} 님 천간 줄은 <strong>${ganChars.join(' ')}</strong> — ${ganOhengs}입니다. <strong>${ilgan}(${KR_OH[dayOheng]})</strong>인 ${userName} 님이 가운데에 자리하고, 그 옆으로 ${otherGans.length > 0 ? `<strong>${otherGans.join(', ')}</strong>` : '다른 글자'}가 함께 있습니다. 천간에 어떤 글자가 가까이 와 있느냐가 본인이 본능적으로 <strong>곁에 두려 하는 마음의 결</strong>을 만듭니다.`;

  // 지지 줄 풀이 — 4 글자 흐름 + 강한 오행 카운트
  const jiOhengCounts: Record<OhengType, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const p of pillars) {
    if (p.지지오행) jiOhengCounts[p.지지오행 as OhengType]++;
  }
  const dominantJiOh = (Object.entries(jiOhengCounts) as [OhengType, number][])
    .sort((a, b) => b[1] - a[1])[0];
  const para2 = `지지 줄은 <strong>${jiChars.join(' ')}</strong> — ${jiOhengs}. 발밑이 ${userName} 님 행동의 무대입니다. ${dominantJiOh[1] >= 2 ? `<strong>${HAN[dominantJiOh[0]]}(${KR_OH[dominantJiOh[0]]})</strong>이 ${dominantJiOh[1]}자로 두텁게 깔려 있어, 본인 행동의 색깔이 ${dominantJiOh[0] === '화' ? '폭발적으로 드러나는' : dominantJiOh[0] === '수' ? '사색하고 깊이 가는' : dominantJiOh[0] === '목' ? '확장하고 자라는' : dominantJiOh[0] === '금' ? '다듬고 정리하는' : '쌓고 머무는'} 결이 됩니다.` : '한쪽으로 치우치지 않은 균형 잡힌 행동 결입니다.'} 일지 <strong>${dayJi}</strong>${timeJi ? `와 시지 <strong>${timeJi}</strong>` : ''}가 ${userName} 님 가까운 자리의 흐름을 만듭니다.`;

  // 연주 글자 — 어릴적 환경
  const yearJiKr = yearJiOheng ? KR_OH[yearJiOheng] : '';
  const para3 = yearJi
    ? `연주의 <strong>${yearJi}(${yearJiKr})</strong>는 ${userName} 님 어릴 적 환경에서 받은 자리입니다. 평소에는 멀리 있어 잊고 살지만, 진짜 지칠 때 <strong>본가, 고향, 오래된 인연</strong> 같은 곳에서 길어 마시는 한 모금이 되어 줍니다. 사주에서 가장 멀리 있으면서, 동시에 가장 귀한 자리입니다.`
    : '';

  // 합·충·형 한 줄 — 가장 도드라진 관계
  const rel = analyzeRelations(pillars, sajuData.gongmang);
  let kuncungInfo = '';
  if (rel.cheongan.length > 0 || rel.jijiHap.length > 0 || rel.jijiClash.length > 0) {
    const firstHap = rel.cheongan.find((x) => x.type === '천간합') || rel.jijiHap[0];
    const firstChung = rel.cheongan.find((x) => x.type === '천간충') || rel.jijiClash.find((x) => x.type === '지지충');
    const firstHyeong = rel.jijiClash.find((x) => x.type !== '지지충');
    if (firstHap) kuncungInfo = `<strong>${firstHap.chars.join('')}합</strong>이 결을 묶어주는 자리`;
    else if (firstChung) kuncungInfo = `<strong>${firstChung.chars.join('')}충</strong>이 부딪히는 자리`;
    else if (firstHyeong) kuncungInfo = `<strong>${firstHyeong.chars.join('')}${firstHyeong.type?.replace(/지지|천간/, '') || '형'}</strong>이 어긋나는 자리`;
  }
  const para4 = kuncungInfo
    ? `한 가지 더. 위 도식에 표시된 ${kuncungInfo}는 ${userName} 님 사주에 평생 작동하는 결입니다. 본인이 그 자리에서 어떤 마음과 행동을 자주 보였는지 곰곰이 떠올려보면, 사주가 가리키는 결이 또렷이 잡힐 것입니다.`
    : `천간과 지지 사이에 큰 충돌이 없어, ${userName} 님 사주는 마음과 행동이 자연스럽게 흐르는 결입니다. 큰 사건보다 잔잔히 자기 결을 다지는 흐름이 됩니다.`;

  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para1 }} />
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para2 }} />
      {para3 && (
        <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para3 }} />
      )}
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para4 }} />
    </div>
  );
}

/**
 * Section1Body — mockup §1 본문 3 paragraphs 진본 형식
 *  · 1: 일간 + 시적 상징 + 일간이 본인 결을 어떻게 만드는지
 *  · 2: 월지 + 계절 + 사주 흐름의 핵심 마음
 *  · 3: 오행 분포 (가장 두꺼운/얇은) + 평생 작동하는 결
 *  · 모두 사주 specific (일간 글자 / 월지 / 오행 카운트 / 사주 글자 호명) 동적
 *  · strong 태그로 핵심 키워드 강조 (mockup 진본 형식)
 */
function Section1Body({
  sajuData,
  userName,
  ilgan,
  ilganOheng,
  aiSummary,
}: {
  sajuData: SajuData;
  userName: string;
  ilgan: string;
  ilganOheng: string;
  aiSummary: string;
}) {
  // AI summary 가 충분히 길면 그것 우선 + paragraph split + strong 보강
  if (aiSummary && aiSummary.length >= 80) {
    const paras = aiSummary.split(/\n+/).filter((p) => p.trim().length > 0);
    return (
      <div style={{ marginTop: 18 }}>
        {paras.map((p, i) => (
          <p
            key={i}
            style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }}
            dangerouslySetInnerHTML={{ __html: sanitizeAiText(autoEmphasize(p)) }}
          />
        ))}
      </div>
    );
  }
  // Fallback — 사주 specific 동적 3 paragraphs
  const e = sajuData.elements as Record<OhengType, number>;
  const counts: Array<[OhengType, number]> = [
    ['목', Number(e?.목 ?? 0)], ['화', Number(e?.화 ?? 0)],
    ['토', Number(e?.토 ?? 0)], ['금', Number(e?.금 ?? 0)],
    ['수', Number(e?.수 ?? 0)],
  ];
  const sortedDesc = [...counts].sort((a, b) => b[1] - a[1]);
  const sortedAsc = [...counts].sort((a, b) => a[1] - b[1]);
  const strongest = sortedDesc[0];
  const weakest = sortedAsc[0];
  const second_weak = sortedAsc[1];
  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  const KR: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const dayOheng = (ilganOheng || '토') as OhengType;
  // 일간별 시적 상징
  const ILGAN_SYM: Record<OhengType, string> = {
    목: '봄 새벽에 곧게 뻗는 큰 나무의 상(象)',
    화: '한낮의 환한 불, 사방에 빛을 보내는 상',
    토: '깊고 단단한 들판, 모든 것이 자리잡는 상',
    금: '잘 다듬어진 칼날, 결단의 상',
    수: '깊고 흐르는 강물, 유연하게 길을 찾는 상',
  };
  const ilganLine = `<span class="han">${ilgan}</span>은 ${ILGAN_SYM[dayOheng]}입니다.`;
  // 월지 + 계절
  const monthZhi = sajuData.pillars[1]?.지지 || '';
  const monthRead = sajuData.pillars[1]?.지지읽기 || '';
  const SEASON: Record<string, { name: string; flow: string }> = {
    寅: { name: '늦은 겨울에서 봄으로 넘어가는 시기', flow: '새 시작과 추진력' },
    卯: { name: '봄의 한가운데', flow: '확장과 자기 결정권' },
    辰: { name: '봄의 끝자락', flow: '쌓이는 자산과 기반' },
    巳: { name: '한낮의 불기운이 밝게 깔린 초여름', flow: '드러내고 표현하려는 마음' },
    午: { name: '여름의 한가운데', flow: '뜨겁게 발현되는 표현력' },
    未: { name: '여름의 끝자락', flow: '결실을 받쳐주는 자리' },
    申: { name: '초가을의 서늘한 시기', flow: '다듬고 정리하는 자리' },
    酉: { name: '가을의 한가운데', flow: '결단과 명료함' },
    戌: { name: '가을의 끝자락', flow: '닫고 거두는 자리' },
    亥: { name: '초겨울의 차가운 시기', flow: '깊이 사색하고 회복하는 결' },
    子: { name: '한겨울의 깊은 밤', flow: '내면을 다지는 시기' },
    丑: { name: '겨울의 끝자락', flow: '응축된 자원과 새 봄을 준비하는 자리' },
  };
  const season = SEASON[monthZhi] || { name: '계절의 흐름', flow: '본인 결의 핵심 마음' };
  // 가장 두꺼운/얇은 오행
  // 조사 처리 (받침 유무): KR 마지막 글자에 받침 있으면 '이/이'/'은' 없으면 '가/는'
  const hasJongseong = (s: string): boolean => {
    if (!s) return false;
    const last = s.charCodeAt(s.length - 1);
    if (last < 0xAC00 || last > 0xD7A3) return false;
    return ((last - 0xAC00) % 28) !== 0;
  };
  const dominantSubject = `${HAN[strongest[0]]}(${KR[strongest[0]]})`;
  const weakestSubject = `${HAN[weakest[0]]}(${KR[weakest[0]]})`;
  const dominantPhrase = `<strong>${dominantSubject}${hasJongseong(KR[strongest[0]]) ? '이' : '가'} ${strongest[1]}자</strong>`;
  const weakestPhrase = weakest[1] !== second_weak[1]
    ? `<strong>${weakestSubject}${hasJongseong(KR[weakest[0]]) ? '이' : '가'} ${weakest[1]}자</strong>${second_weak[1] <= 1 ? `, ${HAN[second_weak[0]]}(${KR[second_weak[0]]})도 ${second_weak[1]}자` : ''}`
    : `<strong>${HAN[weakest[0]]}, ${HAN[second_weak[0]]}가 각 ${weakest[1]}자</strong>`;
  // 일간 오행과 같은 글자 호명
  const sameOhengChars = sajuData.pillars
    .flatMap((p) => p.available ? [
      p.천간오행 === dayOheng ? p.천간 : null,
      p.지지오행 === dayOheng ? p.지지 : null,
    ] : [])
    .filter(Boolean);

  const SANGSAENG_LOCAL: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const weakKr = KR[weakest[0]];
  const weakObj = `${weakKr}${hasJongseong(weakKr) ? '을' : '를'}`;
  const advice = strongest[0] === dayOheng
    ? `${userName} 님은 본인 일간 결이 단단해 <strong>"내가 끌고 가야지"</strong>의 본능이 강합니다. 그 힘을 살리되, 부족한 ${weakObj} 의식적으로 채우는 자리에 본인을 두세요.`
    : strongest[0] === weakest[0]
    ? `${userName} 님 사주는 ${dominantPhrase}로 한쪽이 매우 두텁습니다. 그 결을 활용하되 다른 영역도 의식적으로 만들어두는 게 평생 자산이 됩니다.`
    : `${userName} 님 일간은 ${HAN[dayOheng]}(${KR[dayOheng]})이고, 가장 두꺼운 ${HAN[strongest[0]]}(${KR[strongest[0]]})이 일간을 ${SANGSAENG_LOCAL[strongest[0]] === dayOheng ? '도와주는' : SANGSAENG_LOCAL[dayOheng] === strongest[0] ? '소모시키는' : '눌러내리는'} 결이라 ${weakObj} 채우는 일이 평생 작동하는 결입니다.`;

  const para1 = `${userName} 님의 일간은 <strong>${ilgan}(${KR[dayOheng]})</strong>입니다. ${ilganLine} 흔들리지 않으려 뿌리부터 다잡는 사람의 기운입니다. 크게 목소리를 내지 않아도 옆에 있는 사람이 <strong>"이 사람은 자기만의 결이 있구나"</strong> 하고 느끼게 만드는, 그런 결을 타고납니다.`;

  const flowTrim = season.flow.replace(/(이|가|은|는|을|를|로|으로)$/, '');
  const flowLastJong = (() => {
    const last = flowTrim.charCodeAt(flowTrim.length - 1);
    if (last < 0xAC00 || last > 0xD7A3) return false;
    return ((last - 0xAC00) % 28) !== 0;
  })();
  const para2 = `태어난 달이 <strong>${monthRead}월(${monthZhi}月)</strong>이라 발아래에는 <strong>${season.name}</strong>의 기운이 깔려 있습니다. <strong>${flowTrim}</strong>${flowLastJong ? '이' : '가'} ${userName} 님 사주 흐름의 핵심 마음으로 작동합니다.`;

  const para3 = `다만 한 가지 짚어두어야 할 점이 있습니다. 여덟 글자 중 ${dominantPhrase}로 가장 두텁고${sameOhengChars.length > 0 && strongest[0] === dayOheng ? ` (${sameOhengChars.join(', ')})` : ''}, ${weakestPhrase}로 가장 얇습니다. ${advice}`;

  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para1 }} />
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para2 }} />
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: para3 }} />
    </div>
  );
}
/**
 * Section10Intro — mockup §10 도입 paragraph 진본
 *  · "풀이가 길었습니다. 하지만 사주는 '알았다'에서 끝나면 종이 한 장입니다.
 *    OO 님 사주의 결을 가장 잘 살리는, 작지만 효과가 큰 실천 다섯 가지를 정리하겠습니다."
 *  · 사용자 이름 + 일간 오행 + 가장 약한 오행 기반 동적
 */
function Section10Intro({
  userName,
  sajuData,
  dayOheng,
  aiText,
}: {
  userName: string;
  sajuData: SajuData;
  dayOheng: OhengType;
  aiText?: string;
}) {
  if (aiText?.trim()) {
    return (
      <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }}>
        {stripMd(aiText)}
      </p>
    );
  }
  const e = sajuData.elements as Record<OhengType, number>;
  const counts: Array<[OhengType, number]> = [
    ['목', Number(e?.목 ?? 0)], ['화', Number(e?.화 ?? 0)],
    ['토', Number(e?.토 ?? 0)], ['금', Number(e?.금 ?? 0)],
    ['수', Number(e?.수 ?? 0)],
  ];
  const sortedAsc = [...counts].sort((a, b) => a[1] - b[1]);
  const weakest = sortedAsc[0][0];
  const KR: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };

  // 가장 두꺼운 오행도 추출 (사주별 차별화 강화)
  const sortedDesc = [...counts].sort((a, b) => b[1] - a[1]);
  const strongest = sortedDesc[0];
  const strongestCount = strongest[1];
  const weakestCount = sortedAsc[0][1];

  // 5갈래 도입 — 일간 오행 × 강약 분포 패턴별 분기 (모든 사주 동일 한 문장 X)
  // 강한 오행 자수와 약한 오행 자수 차이가 큰 사주는 더 강한 카피로 시작
  let opener = '';
  if (strongestCount >= 4) {
    opener = `${HAN[strongest[0]]}(${KR[strongest[0]]}) ${strongestCount}자 — 한쪽으로 무게가 또렷하게 실린 사주`;
  } else if (weakestCount === 0 && strongestCount >= 3) {
    opener = `${HAN[weakest]}(${KR[weakest]}) 0자 + ${HAN[strongest[0]]}(${KR[strongest[0]]}) ${strongestCount}자 — 비어있는 결과 두꺼운 결이 또렷한 사주`;
  } else if (weakestCount === 0) {
    opener = `${HAN[weakest]}(${KR[weakest]}) 0자 — 한 결이 통째로 비어 있는 사주`;
  } else {
    opener = `${HAN[dayOheng]}(${KR[dayOheng]}) 일간을 중심으로 ${HAN[weakest]}(${KR[weakest]})이 가장 얇은 결`;
  }

  // 2026-05-04 컴팩트 — 7건 → 5건 / 사주 분포 텍스트 너무 길어 제거
  const text = `${userName} 님은 <strong>${opener}</strong>입니다. <strong>'알았다'에서 끝나면 종이 한 장</strong>이지요. 아래 5건은 ${userName} 님 사주에 맞춰 짠, 작지만 효과가 큰 실천입니다.`;

  return (
    <p
      style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '0 0 14px', wordBreak: 'keep-all' }}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
}

/**
 * Section10ClosingQuote — mockup §10 끝 pullquote 진본
 *  · "같은 사주를 갖고 인생이 달라지는 것은, 결국 어느 자리에 앉느냐의 차이입니다."
 *  · 사용자 일간 + 현재 대운 기반 동적 (같은 일간/대운이 다르면 다른 본문)
 */
function Section10ClosingQuote({
  userName,
  sajuData,
  dayOheng,
  v4Daeun,
  aiQuote,
}: {
  userName: string;
  sajuData?: SajuData;
  dayOheng: OhengType;
  v4Daeun: V4Daeun[];
  aiQuote?: string;
}) {
  const cur = v4Daeun.find((d) => d.current);
  const KR: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };

  // 일지/월지 글자 호명 (대운 없을 때도 사주별 차별화 강화)
  const dayJi = sajuData?.pillars?.[2]?.지지 || '';
  const dayJiKr = sajuData?.pillars?.[2]?.지지읽기 || '';
  const monthJi = sajuData?.pillars?.[1]?.지지 || '';
  const monthJiKr = sajuData?.pillars?.[1]?.지지읽기 || '';
  const dayJiLabel = dayJi && dayJiKr ? `${dayJi}(${dayJiKr})` : '';
  const monthJiLabel = monthJi && monthJiKr ? `${monthJi}(${monthJiKr})` : '';

  let text = aiQuote?.trim() || '';
  if (!text) {
    if (cur) {
      text = `같은 ${HAN[dayOheng]}(${KR[dayOheng]}) 일간이라도 ${userName} 님이 지금 통과 중인 ${cur.gz}(${cur.kr || ''}) 대운에 어느 자리에 앉느냐가 결국 인생을 가른다.`;
    } else if (dayJiLabel && monthJiLabel) {
      text = `${userName} 님 사주의 핵심은 일지 ${dayJiLabel} 와 월지 ${monthJiLabel} 의 결. 같은 ${HAN[dayOheng]}(${KR[dayOheng]}) 일간이라도 이 두 자리를 어떻게 살리느냐가 결국 인생을 가른다.`;
    } else if (dayJiLabel) {
      text = `${userName} 님 사주의 본진은 일지 ${dayJiLabel}. 같은 ${HAN[dayOheng]}(${KR[dayOheng]}) 일간이라도 이 자리를 어떻게 살리느냐가 결국 인생을 가른다.`;
    } else {
      text = `${HAN[dayOheng]}(${KR[dayOheng]}) 일간 ${userName} 님 — 같은 사주를 갖고 인생이 달라지는 것은, 결국 어느 자리에 앉느냐의 차이입니다.`;
    }
  }
  return (
    <div className="pullquote">
      <p>{text}</p>
    </div>
  );
}

/**
 * Section1Pullquote — mockup §1 pullquote 진본
 *  · 일간 + 가장 두꺼운 오행 + 가장 얇은 오행 조합 → 사주별 동적 한 줄
 *  · 예: "곧게 자란 나무 한 그루. 빛은 충분한데 물과 칼이 부족해..."
 *  · AI summarySection1Quote 우선, 없으면 동적 생성
 */
function Section1Pullquote({
  sajuData,
  ilgan,
  ilganOheng,
  ilganSymbol,
  aiPullQuote,
}: {
  sajuData: SajuData;
  ilgan: string;
  ilganOheng: string;
  ilganSymbol: string;
  aiPullQuote?: string;
}) {
  const e = sajuData.elements as Record<OhengType, number>;
  const counts: Array<[OhengType, number]> = [
    ['목', Number(e?.목 ?? 0)], ['화', Number(e?.화 ?? 0)],
    ['토', Number(e?.토 ?? 0)], ['금', Number(e?.금 ?? 0)],
    ['수', Number(e?.수 ?? 0)],
  ];
  const sortedDesc = [...counts].sort((a, b) => b[1] - a[1]);
  const sortedAsc = [...counts].sort((a, b) => a[1] - b[1]);
  const strong = sortedDesc[0][0];
  const weak1 = sortedAsc[0][0];
  const weak2 = sortedAsc[1][0];

  // 일간 오행별 시적 상징 + 강약 풀이 한 줄 (사용자 사주별 동적)
  const KR: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  // 강한 오행 → 키워드
  const STRONG_KEY: Record<OhengType, string> = {
    목: '뿌리 깊은 자기 결정권', 화: '드러나는 표현력', 토: '단단히 쌓는 안정감',
    금: '가다듬는 원칙', 수: '깊이 있는 사색',
  };
  // 약한 오행 → 결핍감 키워드 ("○○과 ○○이 부족해")
  const WEAK_KEY: Record<OhengType, string> = {
    목: '시작', 화: '드러내는 빛', 토: '쌓이는 자리',
    금: '다듬는 칼', 수: '쉴 물',
  };
  // 일간 오행에 따른 도입 시적 표현
  const ILGAN_LEAD: Record<OhengType, string> = {
    목: '곧게 자란 나무 한 그루', 화: '한낮의 불 한 줌',
    토: '굳건히 자리잡은 흙 한 무리', 금: '가다듬어진 쇠 한 자루',
    수: '깊이 흐르는 물 한 줄기',
  };
  const dayOheng = (ilganOheng || '토') as OhengType;
  const lead = ILGAN_LEAD[dayOheng] || `${ilgan}(${KR[dayOheng]}) 일간`;
  const strongPhrase = STRONG_KEY[strong];
  const weakPhrase = `${WEAK_KEY[weak1]}, ${WEAK_KEY[weak2]}`;
  // 받침 처리
  const _hasJong = (s: string): boolean => {
    if (!s) return false;
    const last = s.charCodeAt(s.length - 1);
    if (last < 0xAC00 || last > 0xD7A3) return false;
    return ((last - 0xAC00) % 28) !== 0;
  };
  const strongPostp = _hasJong(strongPhrase) ? '이' : '가';
  const weakPostp = _hasJong(weakPhrase) ? '이' : '가';
  const krStrong = KR[strong];
  const krStrongObj = `${krStrong}${_hasJong(krStrong) ? '의' : '의'}`;
  // 동적 한 줄 — AI 우선
  const text = aiPullQuote?.trim()
    || `${lead}. ${strongPhrase}${strongPostp} 두텁지만 ${weakPhrase}${weakPostp} 얇아, ${dayOheng === strong ? '본인 결을 거스르지 않는 자리에서 가장 빛납니다.' : `${krStrongObj} 결을 살리는 자리에 가야 본인이 살아납니다.`}`;

  return (
    <div className="pullquote">
      <p>{text}</p>
      {/* 일간 시적 상징 — 본문 위 한 줄 (mockup §1 본문 도입 자리) */}
      {ilganSymbol && (
        <p
          style={{
            fontSize: 12.5,
            color: '#5C4A2E',
            marginTop: 8,
            fontWeight: 400,
            opacity: 0.85,
            fontStyle: 'italic',
          }}
        >
          — {ilganSymbol}
        </p>
      )}
    </div>
  );
}

/**
 * ShinsalFinePrint — mockup §7 끝 fine-print 진본
 *  · "※ 신살은 사주마다 0~10개 이상까지 차이가 납니다. ○○·○○ 등은 ○○ 님 사주에는
 *    성립하지 않아 표기하지 않았습니다." 동적 생성.
 *  · v4Gilsin/v4Hyungsal 또는 AI shinsalCards 에 없는 대표 신살을 추출.
 *  · 같은 사주 다른 사주는 미발현 신살 다르므로 자연스럽게 차별화.
 */
function ShinsalFinePrint({
  userName,
  gilsin,
  hyungsal,
  aiCards,
}: {
  userName: string;
  gilsin: V4SinSal[];
  hyungsal: V4SinSal[];
  aiCards?: AiShinsalCard[];
}) {
  const presentNames = new Set<string>();
  gilsin.forEach((s) => { if (s.kr) presentNames.add(s.kr); if (s.hanja) presentNames.add(s.hanja); });
  hyungsal.forEach((s) => { if (s.kr) presentNames.add(s.kr); if (s.hanja) presentNames.add(s.hanja); });
  if (Array.isArray(aiCards)) {
    aiCards.forEach((c) => { if (c?.kr) presentNames.add(c.kr); if (c?.hanja) presentNames.add(c.hanja); });
  }
  // 대표 신살 풀 — 사용자 사주에 없는 것만 노출
  const POOL: Array<{ kr: string; hanja: string }> = [
    { kr: '천을귀인', hanja: '天乙貴人' },
    { kr: '월덕귀인', hanja: '月德貴人' },
    { kr: '문창귀인', hanja: '文昌貴人' },
    { kr: '학당귀인', hanja: '學堂貴人' },
    { kr: '금여록', hanja: '金輿祿' },
    { kr: '도화살', hanja: '桃花殺' },
    { kr: '홍염살', hanja: '紅艶殺' },
    { kr: '화개살', hanja: '華蓋殺' },
    { kr: '역마살', hanja: '驛馬殺' },
    { kr: '백호살', hanja: '白虎殺' },
    { kr: '괴강살', hanja: '魁罡殺' },
    { kr: '양인살', hanja: '羊刃殺' },
  ];
  const missing = POOL.filter(
    (p) => !presentNames.has(p.kr) && !presentNames.has(p.hanja),
  ).slice(0, 5);
  if (missing.length === 0) return null;
  const total = gilsin.length + hyungsal.length + (Array.isArray(aiCards) ? aiCards.length : 0);
  return (
    <p
      style={{
        fontSize: 11.5,
        color: '#5C4A2E',
        margin: '14px 2px 0',
        lineHeight: 1.6,
      }}
    >
      ※ 신살은 사주마다 성립 여부가 달라 <strong>0~10개 이상</strong>까지 차이가 납니다.{' '}
      {missing.map((m) => m.kr).join(', ')} 등은 {userName} 님 사주에는 성립하지 않아 표기하지 않았습니다
      {total > 0 ? ` (현재 ${total}개 자리잡음)` : ''}.
    </p>
  );
}

/**
 * deriveTopicHook — 6 주제 hook 동적 composer (2026-05-05 audit P0 #1·#2 fix)
 *  - 보일러플레이트 박멸: 같은 점수대도 사주 8글자별로 다른 hook
 *  - 입력: topicKey, score, sipDist, dayGan
 *  - 출력: 사주 specific 한 줄 (십성 카운트·일간 글자 호명)
 */
function deriveTopicHook(
  topicKey: string,
  score: number,
  sipDist?: SipDist,
  dayGan?: string,
): string {
  const ganKo = dayGan && GAN_KO[dayGan] ? GAN_KO[dayGan].ko : '';
  const ganRef = ganKo ? `${ganKo}` : '본인';
  const sip = sipDist || ({ 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 } as SipDist);
  const tier = score >= 85 ? 'high' : score >= 65 ? 'mid' : 'low';

  // 주제별 specific 십성 매핑 → 카운트 호명
  switch (topicKey) {
    case 'career': {
      const n = sip.관성;
      if (tier === 'high') return `${ganRef} 일간에 관성 ${n}개 — 어디서 빛나는지와 언제 자리잡는지`;
      if (tier === 'mid')  return `관성 ${n}개의 활용 시기와 자리 선택`;
      return `관성 ${n}개 — 자리잡기 어려운 이유와 보강법`;
    }
    case 'love': {
      const n = sip.재성 + sip.관성;
      if (tier === 'high') return `${ganRef}이 끌어당기는 인연의 결과 시기`;
      if (tier === 'mid')  return `결혼 적정기 + 만남의 결 (관과 재 ${n}자리)`;
      return `인연이 얕은 이유 + 결을 채우는 법`;
    }
    case 'wealth': {
      const n = sip.재성;
      if (tier === 'high') return `재성 ${n}개 — 큰 돈 들어오는 시기와 결정의 결`;
      if (tier === 'mid')  return `재성 ${n}개의 재산 형성 결과 시기`;
      return `재성 ${n}개 — 돈이 머물지 않는 이유와 잡는 법`;
    }
    case 'social': {
      const n = sip.비겁;
      if (tier === 'high') return `비겁 ${n}개 — 결을 살리는 사람과 소모하는 사람`;
      if (tier === 'mid')  return `비겁 ${n}개의 관계 결과 거리감 조정`;
      return `비겁 ${n}개 — 관계가 얕은 이유와 깊이 가는 법`;
    }
    case 'health': {
      const n = sip.인성;
      if (tier === 'high') return `${ganRef} 일간의 지치지 않는 결과 회복 리듬`;
      if (tier === 'mid')  return `인성 ${n}개의 체력 관리 결`;
      return `${ganRef} 일간 — 약한 부위와 예방의 결`;
    }
    case 'potential': {
      const n = sip.인성;
      if (tier === 'high') return `인성 ${n}개 — 평생 흐름의 결과 도약 시점`;
      if (tier === 'mid')  return `${ganRef} 일간의 대운 흐름과 자리잡기`;
      return `${ganRef} 일간 — 늦게 피는 결의 시기`;
    }
    // 2026-09-17 — 추천 후보 10주제 확장분 (topicBaseScores 경로). 사주 십성 카운트 호명 유지.
    case 'exam': {
      const g = sip.관성;
      const i = sip.인성;
      if (tier === 'high') return `관성 ${g}, 인성 ${i}개 — 붙는 시기와 원서 넣을 달`;
      if (tier === 'mid')  return `관과 인 ${g + i}자리 — 시험과 이직 타이밍 고르기`;
      return `관과 인 ${g + i}자리 — 한 번에 안 풀리는 이유와 뚫는 시기`;
    }
    case 'business': {
      const s = sip.식상;
      const j = sip.재성;
      if (tier === 'high') return `식상 ${s}, 재성 ${j}개 — 내 일로 돈 버는 시기`;
      if (tier === 'mid')  return `식상과 재성 ${s + j}자리 — 창업 시기와 위험 관리`;
      return `식상과 재성 ${s + j}자리 — 혼자 벌기 전에 점검할 것`;
    }
    case 'study': {
      const n = sip.인성;
      if (tier === 'high') return `${ganRef} 일간에 인성 ${n}개 — 배움이 성과로 바뀌는 시기`;
      if (tier === 'mid')  return `인성 ${n}개의 집중 리듬과 공부 시기`;
      return `인성 ${n}개 — 집중이 흩어지는 이유와 공부법`;
    }
    case 'marriage': {
      const n = sip.재성 + sip.관성;
      if (tier === 'high') return `${ganRef} 일간의 배우자 자리와 인연 드는 해`;
      if (tier === 'mid')  return `관과 재 ${n}자리 — 결혼 적기와 배우자 성향`;
      return `관과 재 ${n}자리 — 인연이 늦는 이유와 시기`;
    }
    case 'reunion': {
      const n = sip.재성 + sip.관성;
      if (tier === 'high') return `관과 재 ${n}자리 — 다시 이어질 시기와 연락 타이밍`;
      if (tier === 'mid')  return `관과 재 ${n}자리 — 재회 가능성과 다가갈 방향`;
      return `관과 재 ${n}자리 — 붙잡기 전에 볼 흐름`;
    }
    default:
      // 기존 '1운에서 깊이 보기' — 3운 주제(연애·재물·재회)에서 가격 오표기 → 가격 없는 카피
      return '시기, 자리, 결정 포인트까지 깊이 보기';
  }
}

/* ══════════════════════════════════════════════════════════════════
 * 2026-09-17 · 주제 점수 SSOT (C-2) + 리포트 주인 프로필 (B-3)
 * ═════════════════════════════════════════════════════════════════ */
type TopicBaseScores = Partial<Record<TopicId, number>>;

/** 서버 claudePremium.computeTopicBaseScores 가 첨부한 주제 점수 — 주제분석 페이지가 쓰는
 *  computeTopicBaseScore 와 같은 함수·같은 사주라 '카드 점수 = 도착한 주제 페이지 점수'.
 *  구 리포트(필드 없음·손상)는 null → 기존 computeTopicScores 점수로 폴백. */
function readTopicBaseScores(aiResult: any): TopicBaseScores | null {
  const raw = aiResult?.topicBaseScores;
  if (!raw || typeof raw !== 'object') return null;
  const out: TopicBaseScores = {};
  for (const id of TOPIC_IDS) {
    const v = Number(raw[id]);
    if (Number.isFinite(v) && v > 0) out[id] = Math.round(v);
  }
  return Object.keys(out).length >= 3 ? out : null;
}

/** §09 영역 키(AI topicMini·scores 키) → 이어지는 판매 주제. 인간관계는 판매 주제 없음 → 표시만. */
const AREA_TOPIC: Record<string, TopicId | undefined> = {
  wealth: 'wealth',
  love: 'love',
  career: 'career',
  health: 'health',
  social: undefined,
  potential: 'study',
};

/** 영역 점수 — 주제 페이지로 이어지는 영역은 topicBaseScores 우선 (§09·사주대화 예시 질문이 같은 점수를 말하도록). */
function resolveAreaScores(scores: Record<string, number>, base: TopicBaseScores | null): Record<string, number> {
  if (!base) return scores;
  const out: Record<string, number> = { ...scores };
  for (const [area, topicId] of Object.entries(AREA_TOPIC)) {
    const v = topicId ? base[topicId] : undefined;
    if (typeof v === 'number') out[area] = v;
  }
  return out;
}

/** 추천 후보 — hookKey(deriveTopicHook 키) · topicId(라우팅·가격·메타) · score */
interface RecoItem { hookKey: string; topicId: TopicId; score: number }
// 연애·재회·결혼은 핵심 십성(재·관)이 같아 topicBaseScores 가 항상 동일 → 3칸 도배 방지용 1개 제한
const RELATION_TOPICS = new Set<TopicId>(['love', 'reunion', 'marriage']);

function pickTopRecommendations(scores: Record<string, number>, base: TopicBaseScores | null): RecoItem[] {
  if (base) {
    const sorted = TOPIC_IDS
      .map((id, order) => ({ hookKey: id as string, topicId: id, score: base[id], order }))
      .filter((it): it is { hookKey: string; topicId: TopicId; score: number; order: number } => typeof it.score === 'number')
      // 동점은 홈 노출 순서(연애·재회·결혼·재물·합격…) 우선
      .sort((a, b) => b.score - a.score || a.order - b.order);
    const picked: RecoItem[] = [];
    const skipped: RecoItem[] = [];
    let relationUsed = false;
    for (const it of sorted) {
      if (picked.length >= 3) break;
      const item = { hookKey: it.hookKey, topicId: it.topicId, score: it.score };
      if (RELATION_TOPICS.has(it.topicId)) {
        if (relationUsed) { skipped.push(item); continue; }
        relationUsed = true;
      }
      picked.push(item);
    }
    for (const it of skipped) { if (picked.length >= 3) break; picked.push(it); }
    return picked;
  }
  // 구 리포트 폴백 — 기존 5영역 (potential → 학업운)
  return (Object.entries(scores) as Array<[string, number]>)
    .filter(([k, v]) => AREA_TOPIC[k] && Number(v) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ hookKey: k, topicId: AREA_TOPIC[k] as TopicId, score: Number(v) }));
}

function sameBirthInput(a?: Partial<SajuInput> | null, b?: Partial<SajuInput> | null): boolean {
  if (!a || !b) return false;
  const time = (x: Partial<SajuInput>) => (x.hasBirthTime && x.birthHour != null ? `${Number(x.birthHour)}:${Number(x.birthMinute ?? 0)}` : '-');
  return Number(a.birthYear) === Number(b.birthYear)
    && Number(a.birthMonth) === Number(b.birthMonth)
    && Number(a.birthDay) === Number(b.birthDay)
    && (a.gender ?? '') === (b.gender ?? '')
    && (a.calendarType ?? 'solar') === (b.calendarType ?? 'solar')
    && time(a) === time(b);
}

/** 리포트 주인 프로필 — 가족 사주 종합사주에서 주제분석·사주대화로 넘어갈 때 기기의 '내 프로필'로
 *  바뀌던 문제(B-3) 방지. profileId 일치 → 이름+생년월일시 일치 → 생년월일시 일치 순.
 *  못 찾으면 profileId 없음(주제 페이지는 선택 화면) + 리포트 사주로 프로필 형태 합성(대화용). */
function resolveReportProfile(report: LocalReport, sajuData: SajuData): { profileId?: string; profile: SajuProfile } {
  const input = (report.input || (sajuData as any)?.input) as SajuInput | undefined;
  let matched: SajuProfile | undefined;
  try {
    const list = getProfiles();
    matched = (report.profileId ? list.find((p) => p.id === report.profileId) : undefined)
      || list.find((p) => sameBirthInput(p.input, input) && !!input?.name && p.name === input.name)
      || list.find((p) => sameBirthInput(p.input, input));
  } catch { /* noop — 합성 프로필로 진행 */ }
  if (matched) return { profileId: matched.id, profile: matched };
  return {
    profile: {
      id: report.id,
      name: report.name || input?.name || '나',
      input: input as SajuInput,
      sajuData,
      createdAt: report.createdAt,
    },
  };
}

/**
 * TopicTopRecommend — 사용자 점수 가장 높은 3 영역 동적 추천
 *  · 점수가 높을수록 "더 알아보고 싶어진다" 심리 유도 (CTA 효율 ↑)
 *  · 2026-05-05 hook 동적화 (sipDist + dayGan 호명)
 *  · 🚨 2026-09-17 (오너 결정 "합격운 같은 게 높으면 그걸로 추천") — C-0·C-2·C-3
 *    · 기존: 후보 5영역(직업·연애·재물·건강·학업) 고정 → 합격·이직/사업/결혼/재회 추천 불가 +
 *      카드 점수(클라 computeTopicScores) ≠ 도착한 주제 페이지 점수(서버 computeTopicBaseScore).
 *    · 수정: topicBaseScores(서버가 주제분석과 같은 함수로 산출·첨부) 있으면 10주제 중 상위 3 추천
 *      → 카드 점수 = 주제 페이지 점수. 구 리포트는 기존 5영역 점수 폴백.
 *    · 1위 '최강' 고정 라벨 제거(점수 구간 칩만) · 저점 헤더 "보강이 필요한"(실제 목록은 상위 3) 정정.
 */
function TopicTopRecommend({
  scores,
  topicBaseScores,
  sipDist,
  dayGan,
  profileId,
}: {
  scores: Record<string, number>;
  topicBaseScores: TopicBaseScores | null;
  sipDist?: SipDist;
  dayGan?: string;
  /** 리포트 주인 프로필 — 주제 페이지가 미리 선택 (가족 사주 리포트 대응) */
  profileId?: string;
}) {
  // 이모지 사용 X — 한자 + 컬러 칩만 (사주500 톤앤매너)
  const navigate = useNavigate();
  const top3 = pickTopRecommendations(scores, topicBaseScores);
  if (top3.length === 0) return null;
  const topScore = top3[0].score;
  const topMeta = TOPIC_REGISTRY[top3[0].topicId];
  // 가격 SSOT — top3 는 주제별 가격 혼재(love/wealth 3운 등) → 최저가 '주제당 N운부터' 표기
  const top3MinPrice = Math.min(...top3.map((t) => getTopicPrice(t.topicId).actualPrice));

  function getHook(score: number, key: string): string {
    return deriveTopicHook(key, score, sipDist, dayGan);
  }
  function getRank(score: number): { label: string; bg: string; color: string } {
    if (score >= 88) return { label: '최강', bg: 'rgba(78,122,87,0.14)', color: '#355A3E' };
    if (score >= 75) return { label: '강함', bg: 'rgba(78,122,87,0.10)', color: '#4E7A57' };
    if (score >= 60) return { label: '안정', bg: 'rgba(184,150,90,0.14)', color: '#8B6F3D' };
    if (score >= 45) return { label: '평탄', bg: 'rgba(122,114,105,0.14)', color: '#5C4A2E' };
    return { label: '주의', bg: 'rgba(198,40,40,0.10)', color: '#c62828' };
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 0,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2520 50%, #1d1812 100%)',
        border: '1.5px solid rgba(212,175,55,0.32)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 10px 28px rgba(20,15,8,0.22)',
      }}
    >
      {/* 헤더 — 골드 라벨 + 호기심 한 줄 */}
      <div
        style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(244,209,102,0.18)',
          background: 'radial-gradient(circle at top right, rgba(244,209,102,0.10) 0%, transparent 60%)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 11,
            fontWeight: 800,
            color: '#f4d166',
            letterSpacing: '0.18em',
            padding: '3px 10px',
            background: 'rgba(244,209,102,0.10)',
            border: '1px solid rgba(244,209,102,0.32)',
            borderRadius: 99,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 11 }}>◆</span>
          주제별로 깊이 보기, 深 度
        </div>
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 17,
            fontWeight: 800,
            color: '#F4ECD8',
            lineHeight: 1.45,
            letterSpacing: '-0.01em',
            marginBottom: 6,
          }}
        >
          {topScore >= 85
            ? <>이 사주에서 가장 빛나는 결은 <span style={{ color: '#f4d166' }}>{topMeta.label}({topMeta.kanji})</span> 입니다</>
            : topScore >= 60
            ? <>가장 깊게 풀어볼 만한 <span style={{ color: '#f4d166' }}>{top3.length} 영역</span></>
            : <>지금 흐름을 가장 살려볼 만한 <span style={{ color: '#f4d166' }}>{top3.length} 영역</span></>}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(244,236,216,0.66)', lineHeight: 1.6, letterSpacing: '0.01em' }}>
          점수가 가장 높은 {top3.length}갈래를 깊게 풀어드립니다 — 시기, 자리, 결정 포인트까지.
          {topicBaseScores && ' 카드 점수는 주제별 풀이에서도 같은 기준으로 이어져요.'}
        </div>
      </div>

      {/* 3 카드 그리드 — 1순위 강조 */}
      <div
        style={{
          padding: '16px 14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 9,
        }}
      >
        {top3.map(({ hookKey, topicId, score }, idx) => {
          const meta = TOPIC_REGISTRY[topicId];
          const isFirst = idx === 0;
          const rank = getRank(score);
          const hook = getHook(score, hookKey);
          const priceLabel = formatPriceLabel(getTopicPrice(topicId));
          return (
            <button
              key={topicId}
              onClick={() => navigate(meta.path, profileId ? { state: { profileId } } : undefined)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 6,
                padding: '14px 9px 12px',
                background: isFirst
                  ? `linear-gradient(180deg, ${meta.color}24 0%, ${meta.color}08 100%)`
                  : 'rgba(255,254,248,0.04)',
                border: isFirst
                  ? `1.5px solid ${meta.color}`
                  : '1px solid rgba(244,209,102,0.18)',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                color: '#F4ECD8',
                textAlign: 'center',
                fontFamily: 'inherit',
                outline: 'none',
                boxShadow: isFirst ? `0 0 0 2px ${meta.color}33, 0 4px 16px ${meta.color}1A` : 'none',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = isFirst
                  ? `0 0 0 2px ${meta.color}55, 0 8px 22px ${meta.color}2A`
                  : `0 6px 18px rgba(244,209,102,0.16)`;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isFirst ? `0 0 0 2px ${meta.color}33, 0 4px 16px ${meta.color}1A` : 'none';
              }}
            >
              {/* 순위 뱃지 — 1순위 만 골드 도장 */}
              {isFirst && (
                <span
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 11,
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #f4d166, #B8965A)',
                    color: '#1a1a1a',
                    padding: '2px 10px',
                    borderRadius: 99,
                    letterSpacing: '0.1em',
                    boxShadow: '0 2px 6px rgba(244,209,102,0.32)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  1순위
                </span>
              )}

              {/* 순위 +1 (소) */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'rgba(244,236,216,0.5)',
                  letterSpacing: '0.12em',
                  marginTop: isFirst ? 4 : 0,
                }}
              >
                {idx === 0 ? '가장 높음' : `${idx + 1}순위`}
              </span>

              {/* 거대 한자 */}
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: isFirst ? 38 : 32,
                  fontWeight: 900,
                  color: meta.color,
                  lineHeight: 1,
                  margin: '4px 0 2px',
                  textShadow: `0 2px 12px ${meta.color}44`,
                }}
              >
                {meta.kanji}
              </span>

              {/* 한글 라벨 */}
              <span style={{ fontSize: 12, fontWeight: 700, color: '#F4ECD8', letterSpacing: '0.02em' }}>
                {meta.label}
              </span>

              {/* 점수 + rank */}
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2 }}>
                <span
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 17,
                    fontWeight: 900,
                    color: meta.color,
                    lineHeight: 1,
                  }}
                >
                  {score}
                </span>
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    color: rank.color,
                    background: rank.bg,
                    padding: '2px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.04em',
                  }}
                >
                  {rank.label}
                </span>
              </span>

              {/* 호기심 한 줄 — "어디서 가장 빛나는지·언제 자리를 잡는지" */}
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(244,236,216,0.66)',
                  lineHeight: 1.5,
                  marginTop: 6,
                  paddingTop: 8,
                  borderTop: '1px dashed rgba(244,209,102,0.16)',
                  wordBreak: 'keep-all',
                  display: 'block',
                  minHeight: 30,
                }}
              >
                {hook}
              </span>

              {/* CTA 화살표 */}
              <span
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  color: meta.color,
                  letterSpacing: '0.06em',
                }}
              >
                {priceLabel}으로 보기 →
              </span>
            </button>
          );
        })}
      </div>

      {/* 푸터 — 가격 안내 */}
      <div
        style={{
          padding: '12px 18px 16px',
          borderTop: '1px solid rgba(244,209,102,0.14)',
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(244,236,216,0.56)',
          letterSpacing: '0.04em',
        }}
      >
        주제당 <strong style={{ color: '#f4d166', fontWeight: 800 }}>{top3MinPrice}운</strong>부터, 시기, 자리, 결정 포인트까지
      </div>
    </div>
  );
}

/**
 * PremiumResultFooter — mockup .result-footer 진본
 *  · 2-column grid: 친구에게 공유하고 운 받기 / PDF 파일 저장
 *  · 공유 클릭 → ShareModal 열기 (ContactsViral SDK 또는 Web Share API)
 *  · PDF 클릭 → generatePremiumPdf 호출 후 새 탭으로 다운로드
 */
/** 2026-07-08 완성판 검증 완료 → 노출 ON.
 *  근거: htmlTemplate 재작성(강조 3-tier 화이트리스트 + 앱 §01~10 8필드) + 전용 GCS 버킷 프로비저닝 +
 *  로컬/클라우드 e2e(A4 22p·한글폰트 임베딩·강조·서명URL·바이트 일치) + 프리프로덕션 적대적 리뷰 하드닝. */
const PDF_ENABLED = true;

function PremiumResultFooter({
  reportId,
  report,
  sajuData,
  aiResult,
}: {
  reportId: string;
  report: LocalReport;
  sajuData: SajuData;
  aiResult: any;
}) {
  void aiResult; void sajuData; // PdfDownloadButton 으로 위임 시 사용
  const toast = useToast();
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const profile: PdfProfile = {
    name: report.name,
    birthDate: formatBirthDate(report.input),
    birthTime: formatBirthTime(report.input),
    gender: report.input?.gender,
  };
  async function handlePdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const r = await generatePremiumPdf({ reportId, profile, sajuData, aiResult });
      if (r?.url) {
        // 2026-07-03 CS fix ("PDF 다운로드가 안 돼요") — 토스 웹뷰는 a[download] 무반응(다운로드 UI 없음).
        //   기존 '외부 브라우저 튕김 방지' a[download] 강등이 오히려 무동작이었음 → window.open 복원.
        const { isAppsInToss } = await import('@/services/payment/iapService');
        const inToss = isAppsInToss();
        // 2026-07-28 — 앱인토스는 SDK 네이티브 PDF 뷰어를 우선 시도한다. window.open 은 외부 브라우저가
        //   떠서 앱을 벗어나는 동작이라, 앱 안에서 바로 열리는 openPDFViewer 가 UX 상 우위.
        //   미지원(토스앱 5.261.0 미만)·대용량·fetch 실패 시 false 를 돌려주므로 아래 기존 경로로 폴백.
        if (inToss) {
          const { tryOpenNativePdf } = await import('@/services/pdf/nativePdfViewer');
          const fname = `사주500_${(report?.name || '내')}_종합사주.pdf`;
          if (await tryOpenNativePdf(r.url, fname, (r as any).bytes)) return; // 뷰어가 앱 안에서 열림
        }
        window.open(r.url, '_blank');
        toast.show(inToss ? '브라우저에서 PDF가 열려요. 저장해 주세요' : 'PDF 다운로드를 시작했어요', 'success');
      } else {
        toast.show('PDF 생성에 실패했어요', 'warning');
      }
    } catch (e: any) {
      toast.show(e?.message || 'PDF 생성 실패', 'warning');
    } finally {
      setPdfBusy(false);
    }
  }
  return (
    <>
      <div className="result-footer">
        <div
          className="btn"
          role="button"
          tabIndex={0}
          onClick={async () => {
            // 2026-05-28 PM 정책: 결과 페이지 공유 = OG 바이럴 (보상 X). type='premium'.
            const { shareResult } = await import('@/utils/share');
            await shareResult({
              type: 'premium',
              name: report?.name || '나',
              reportId: reportId || 'premium',
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShareOpen(true); // 키보드 접근성: 모달 fallback 유지
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx={18} cy={5} r={3} />
            <circle cx={6} cy={12} r={3} />
            <circle cx={18} cy={19} r={3} />
            <line x1={8.59} y1={13.51} x2={15.42} y2={17.49} />
            <line x1={15.41} y1={6.51} x2={8.59} y2={10.49} />
          </svg>
          <div className="ti">친구에게 공유하기</div>
          <div className="sb">결과 카드 송출</div>
        </div>
        {/* 2026-07-03 준기 결정 — PDF 버튼 비노출 ("완벽 아니면 없앤다").
            근거: 실검증 결과 ① 본문 강조 태그(<strong> 등)가 esc 되어 문자 그대로 노출(전 섹션 오염)
            ② 템플릿이 sections 텍스트만 담아 앱 §01~10 시각화·8필드 대비 얕음 ③ puppeteer A4 미검증.
            서버 파이프라인(인덱스·업로드·서명URL)은 살아있으므로, 템플릿 완성판 재작성 후 재노출. */}
        {PDF_ENABLED && (
        <div
          className="btn"
          role="button"
          tabIndex={0}
          onClick={handlePdf}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePdf(); } }}
          aria-disabled={pdfBusy}
          style={pdfBusy ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1={9} y1={15} x2={15} y2={15} />
            <line x1={9} y1={18} x2={13} y2={18} />
          </svg>
          <div className="ti">{pdfBusy ? 'PDF 생성 중…' : 'PDF 파일 저장'}</div>
          <div className="sb">A4 풀리포트</div>
        </div>
        )}
      </div>
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        name={report.name}
        reportId={reportId}
      />
    </>
  );
}

/**
 * TocSideIndicator — mockup §toc-side 진본
 *  · 데스크톱(>540px) 좌측 fixed dots 10개
 *  · 현재 보는 섹션 dot active (scale 1.5, opacity 1)
 *  · IntersectionObserver 로 스크롤 추적
 */
function TocSideIndicator({ count }: { count: number }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const handle = () => {
      const sections = document.querySelectorAll<HTMLElement>('section[data-section-step]');
      if (!sections.length) return;
      let active = 0;
      sections.forEach((s, i) => {
        const top = s.getBoundingClientRect().top;
        if (top < window.innerHeight / 2) active = i;
      });
      setActiveIdx(active);
    };
    handle();
    window.addEventListener('scroll', handle, { passive: true });
    return () => {
      window.removeEventListener('scroll', handle);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);
  return (
    <div className="toc-side" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`dot${i === activeIdx ? ' active' : ''}`} />
      ))}
    </div>
  );
}

/**
 * CollapsibleSection — mockup §섹션 아코디언 진본
 *  · .section-head-row (클릭 영역) + .sec-toggle pill 버튼 + .section-body
 *  · 첫 섹션만 defaultOpen=true, 나머지는 접힌 채 시작 (60대+ 사용성)
 *  · 키보드 (Enter/Space) 토글, aria-expanded 관리
 */
/** 2026-10-09 — 점진 표시 중 아직 안 온 섹션 자리 (shimmer). 내용 대신 '쓰는 중'만 — 나중에 글이 바뀌는 일 없음 */
function SectionPendingSkeleton() {
  return (
    <div aria-live="polite" style={{ padding: '4px 0 2px' }}>
      <style>{`@keyframes prem-shimmer{0%{background-position:-240px 0}100%{background-position:240px 0}}`}</style>
      <div style={{ fontSize: 12, color: '#8C6D3D', fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em' }}>
        이 섹션 풀이를 쓰고 있어요, 다 쓰는 대로 여기에 채워져요
      </div>
      {[100, 94, 97, 70].map((w, i) => (
        <div
          key={i}
          style={{
            height: 12, width: `${w}%`, borderRadius: 6, marginBottom: 9,
            background: 'linear-gradient(90deg, rgba(184,150,90,0.10) 0%, rgba(184,150,90,0.24) 50%, rgba(184,150,90,0.10) 100%)',
            backgroundSize: '480px 100%',
            animation: 'prem-shimmer 1.4s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

function CollapsibleSection({
  step,
  title,
  hanja,
  hint,
  defaultOpen = false,
  pending = false,
  pendingPreview,
  children,
}: {
  step: number;
  title: string;
  hanja: string;
  hint?: ReactNode;
  defaultOpen?: boolean;
  /** 이 섹션이 쓰는 생성 그룹이 아직 도착 전 — 본문 대신 스켈레톤 */
  pending?: boolean;
  /** 도착 전에도 보여줘도 되는 부분 (사주 원국 표처럼 AI 와 무관한 확정 데이터) */
  pendingPreview?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen((v) => !v);
  return (
    <section className="section" data-section-step={step}>
      <div
        className="section-head-row"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <div>
          <div className="section-num">{hanjaNum(step)}</div>
          <div className="section-title">
            {title} <span className="hanja">{hanja}</span>
            {pending && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#8C6D3D', background: 'rgba(184,150,90,0.14)', borderRadius: 999, padding: '2px 8px', verticalAlign: 'middle' }}>
                작성 중
              </span>
            )}
          </div>
          {hint && <div className="section-sub">{hint}</div>}
        </div>
        <div className={`sec-toggle${open ? '' : ' collapsed'}`} aria-hidden>
          <span className="chev">▼</span> {open ? '접기' : '펼치기'}
        </div>
      </div>
      <div className={`section-body${open ? '' : ' collapsed'}`}>
        {pending ? (
          <>
            {pendingPreview}
            <SectionPendingSkeleton />
          </>
        ) : children}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Premium Container — 스펙 §9 7섹션
 * ═════════════════════════════════════════════════════════════════ */
export interface PremiumResultProps {
  report: LocalReport;
  sajuData: SajuData;
  v4Pillars: V4Pillar[];
  v4Daeun: V4Daeun[];
  v4Gilsin: V4SinSal[];
  v4Hyungsal: V4SinSal[];
  scores: Record<string, number>;
  /** 2026-10-09 — 점진 표시: 아직 도착 안 한 생성 그룹 (A 원국·천간지지 / D 십성·용신 / B 대운·연운·신살 / C 본질·주제·실천) */
  pendingGroups?: Partial<Record<'A' | 'D' | 'B' | 'C', boolean>>;
}

export function PremiumResult({
  report,
  sajuData,
  v4Pillars,
  v4Daeun,
  v4Gilsin,
  v4Hyungsal,
  scores,
  pendingGroups,
}: PremiumResultProps) {
  const aiResult: any = report.aiResult ?? {};
  // 섹션이 읽는 그룹 중 하나라도 미도착이면 그 섹션은 스켈레톤 (§04 는 A 의 용신 판정도 씀)
  const pendingOf = (...gs: Array<'A' | 'D' | 'B' | 'C'>) => gs.some((g) => !!pendingGroups?.[g]);
  const anyPending = pendingOf('A', 'D', 'B', 'C');
  const dayOheng = (sajuData.pillars[2]?.천간오행 ?? '토') as OhengType;
  const ilgan = sajuData.pillars[2]?.천간 ?? '';
  const ilganKr = sajuData.pillars[2]?.천간읽기 ?? '';
  const ilganOheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
  const sipDist = buildSipDist(sajuData);
  // 2026-09-17 C-2 — 서버 주제 점수(주제 페이지와 동일) · 영역 표시 점수 · B-3 리포트 주인 프로필
  const topicBaseScores = readTopicBaseScores(aiResult);
  const areaScores = resolveAreaScores(scores, topicBaseScores);
  const reportProfile = React.useMemo(
    () => resolveReportProfile(report, sajuData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report.id, report.profileId, sajuData],
  );

  // 요약 카드 — Section1Body 가 사용 (보존용 grace, 향후 외부 호출처 가능성)
  // @ts-expect-error -- 보존용 (Section1Body 가 본문 처리)
  const _summarySentences: string[] = (() => {
    const aiSummary = aiResult.summary ?? aiResult.sections?.find((s: any) => s.id === 'summary')?.content;
    if (typeof aiSummary === 'string' && aiSummary.length > 0) {
      return stripMd(aiSummary)
        .split(/(?<=[.。!?])\s+/)
        .filter((s) => s.trim().length > 0)
        .slice(0, 3);
    }
    // fallback
    return [
      `${ilgan}(${ilganKr}) 일간으로 ${ilganOheng} 오행의 본질을 가진 사주예요.`,
      '오행의 균형과 십성의 분포에서 핵심 강점이 드러납니다.',
      '대운 흐름과 연운까지 함께 보면 시기별 전략이 또렷해져요.',
    ];
  })();

  void v4Daeun; // Section5Body 가 처리
  const analysisBase = aiResult.analysisBase;
  const yongsin = deriveYongsin(analysisBase, dayOheng);
  // Stage 7e-9 hotfix-6: 모든 lookup 가드 — 결과 페이지 회귀 방지
  const lifestyle = OHENG_LIFESTYLE[yongsin.primary] || OHENG_LIFESTYLE.토;
  const ilganSymbol = ILGAN_SYMBOL[ilgan] || `${ilganOheng || '토'} 일간 본연의 결`;

  // Phase D'-1 보강 (mockup v2 §section-conclusion 패턴)
  // AI 응답: 객체 형태 {wongug, structure, sipsung, yongsin, relation} (claudePremium.ts 신규 schema)
  //         또는 배열 형태 (구버전 호환)
  //         또는 sections[i].conclusion (구버전 호환)
  // 인덱스 매핑: 0=§01원국, 1=§02천간지지, 2=§03십성, 3=§04용신, 4=§05대운, 5=§06연운, 6=§07신살, 7=§08관계, 8=§09주제, 9=§10실천
  const sectionConclusions: string[] = (() => {
    const sc = aiResult.sectionConclusions;
    if (sc && typeof sc === 'object' && !Array.isArray(sc)) {
      // 객체 형태 — 키별 매핑
      const arr: string[] = new Array(10).fill('');
      if (sc.wongug)    arr[0] = sanitizeAiText(autoEmphasize(String(sc.wongug)));
      if (sc.structure) arr[1] = sanitizeAiText(autoEmphasize(String(sc.structure)));
      if (sc.sipsung)   arr[2] = sanitizeAiText(autoEmphasize(String(sc.sipsung)));
      if (sc.yongsin)   arr[3] = sanitizeAiText(autoEmphasize(String(sc.yongsin)));
      if (sc.relation)  arr[7] = sanitizeAiText(autoEmphasize(String(sc.relation)));
      // 추가 키 호환 (서버가 이후 확장 시)
      if (sc.daeun)     arr[4] = sanitizeAiText(autoEmphasize(String(sc.daeun)));
      if (sc.yearly)    arr[5] = sanitizeAiText(autoEmphasize(String(sc.yearly)));
      if (sc.shinsal)   arr[6] = sanitizeAiText(autoEmphasize(String(sc.shinsal)));
      if (sc.topic)     arr[8] = sanitizeAiText(autoEmphasize(String(sc.topic)));
      if (sc.practice)  arr[9] = sanitizeAiText(autoEmphasize(String(sc.practice)));
      return arr;
    }
    if (Array.isArray(sc)) {
      return sc.slice(0, 10).map((s: any) => sanitizeAiText(autoEmphasize(String(s ?? ''))));
    }
    if (Array.isArray(aiResult.sections)) {
      return aiResult.sections
        .slice(0, 10)
        .map((s: any) =>
          typeof s?.conclusion === 'string' ? sanitizeAiText(autoEmphasize(s.conclusion)) : '',
        );
    }
    return [];
  })();
  const conclusionAt = (i: number): string => sectionConclusions[i] || '';

  // Phase D'-1 보강 (mockup v2 §pullquote 패턴) — 02·07 섹션 사이 인용
  const aiPullQuote: string =
    typeof aiResult.pullQuote === 'string'
      ? stripMd(aiResult.pullQuote)
      : '';

  // ── HeroCard용 메타 (목업 §0 hero-card 진본)
  const ilganHan = ilgan || '土';
  const ilganOhengKr = ilganOheng || '토';
  const ilganYinYang =
    ilgan && ['甲', '丙', '戊', '庚', '壬'].includes(ilgan) ? '양' : '음';
  // 이모지 사용 X — 한자 도장으로 대체 (앱 정책)
  const ohengHan: Record<string, string> = {
    목: '木',
    화: '火',
    토: '土',
    금: '金',
    수: '水',
  };
  const ohengSymbol: Record<string, string> = {
    목: '큰 나무의 기운',
    화: '번지는 불의 기운',
    토: '굳건한 흙의 기운',
    금: '단단한 쇠의 기운',
    수: '흐르는 물의 기운',
  };
  const monthSeason: Record<string, string> = {
    寅: '입춘 무렵',
    卯: '봄의 한가운데',
    辰: '봄의 끝자락',
    巳: '초여름',
    午: '한여름',
    未: '여름의 끝자락',
    申: '초가을',
    酉: '가을의 한가운데',
    戌: '가을의 끝자락',
    亥: '초겨울',
    子: '한겨울',
    丑: '겨울의 끝자락',
  };
  const monthZhi = sajuData.pillars[1]?.지지 || '';
  const seasonText = monthSeason[monthZhi] || '계절의 흐름';
  // 풀이 일자 (오늘)
  const today = new Date();
  const reportDateText = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')} 풀이`;
  // 출생 정보
  const birthDateText = report.input
    ? `${report.input.birthYear}년 ${report.input.birthMonth}월 ${report.input.birthDay}일`
    : '';
  const calendarText =
    report.input?.calendarType === 'lunar' ||
    report.input?.calendarType === 'lunar_leap'
      ? '음력'
      : '양력';
  const hourBranchText = report.input?.hasBirthTime
    ? ((report.input.birthMinute ?? 0) > 0
        ? `${String(report.input.birthHour ?? 0).padStart(2, '0')}:${String(report.input.birthMinute ?? 0).padStart(2, '0')}`
        : (getHourBranch(report.input.birthHour ?? 0, 0)?.ko ?? `${report.input.birthHour ?? 0}시`))
    : '시간 미입력';

  // 일간 오행 → hero-card .ilgan 박스 컬러 (목업: 양목=녹색, 양화=빨강 등)
  const ilganBoxColor: Record<string, { fg: string; bg: string; border: string }> = {
    목: { fg: '#4E7A57', bg: 'rgba(78,122,87,0.08)', border: 'rgba(78,122,87,0.20)' },
    화: { fg: '#c62828', bg: 'rgba(198,40,40,0.08)', border: 'rgba(198,40,40,0.20)' },
    토: { fg: '#C18715', bg: 'rgba(176,127,56,0.10)', border: 'rgba(176,127,56,0.32)' },
    금: { fg: '#7D7870', bg: 'rgba(74,74,74,0.07)', border: 'rgba(74,74,74,0.28)' },
    수: { fg: '#3E5F82', bg: 'rgba(62,95,130,0.08)', border: 'rgba(62,95,130,0.20)' },
  };
  const ilBox = ilganBoxColor[ilganOhengKr] || ilganBoxColor.토;

  return (
    <div className="premium-mockup">
      {/* mockup 진본 CSS 주입 — selector 는 모두 .premium-mockup 안에서만 작동 */}
      <style dangerouslySetInnerHTML={{ __html: PREMIUM_MOCKUP_CSS }} />
      <div className="page-wrap">
      {/* ═════════════ §0 HeroCard — 목업 .hero .hero-card 진본 ═════════════ */}
      <LocalFadeIn>
        <section className="hero">
          <div className="hero-card">
            <div className="person">{report.name || '회원'}</div>
            <div className="birth">
              {birthDateText} ({calendarText}), {hourBranchText}
            </div>
            <div
              className="ilgan"
              style={{
                background: ilBox.bg,
                border: `1px solid ${ilBox.border}`,
              }}
            >
              <span className="hanja" style={{ color: ilBox.fg }}>
                {ilganHan}
              </span>
              <span className="label" style={{ color: ilBox.fg }}>
                일간 {ilganHan}({ilganKr || ''}), {ilganYinYang}
                {ilganOhengKr}
              </span>
            </div>
            <div className="meta">
              <span>
                <span style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 800,
                  color: ilBox.fg,
                  marginRight: 4,
                }}>
                  〔{ohengHan[ilganOhengKr] || '土'}〕
                </span>
                {ohengSymbol[ilganOhengKr] || '본연의 기운'}
              </span>
              <span>, </span>
              <span>{seasonText}</span>
              <span>, </span>
              <span>{reportDateText}</span>
            </div>
          </div>
        </section>
      </LocalFadeIn>

      <div className="content">

      {/* ═════════════ 01 원국 (原局) ═════════════ */}
      <LocalFadeIn>
        <CollapsibleSection
          step={1}
          pending={pendingOf('A')}
          pendingPreview={<><WongugTable v4Pillars={v4Pillars} sajuData={sajuData} sipDist={sipDist} /><OhaengRadarSVG elements={sajuData.elements} /></>}
          title="원국"
          hanja="原局"
          hint="태어난 순간 하늘과 땅이 그려낸 여덟 글자"
          defaultOpen
        >
          {/* 목업 §1 진본 — wongug-table (8글자 grid + 십성 tag) + ohaeng-chart (5 horizontal bars) */}
          <WongugTable v4Pillars={v4Pillars} sajuData={sajuData} sipDist={sipDist} />

          {/* 오행 5각 레이더 (mockup §1 ohaeng-radar 진본) */}
          <OhaengRadarSVG elements={sajuData.elements} />

          {/* §01 본문 — mockup §1 진본 형식 (3 paragraphs · strong + 한자 강조) */}
          <Section1Body
            sajuData={sajuData}
            userName={report.name || '회원'}
            ilgan={ilgan}
            ilganOheng={ilganOheng}
            aiSummary={typeof aiResult.summary === 'string' && aiResult.summary.length > 50 ? aiResult.summary : ''}
          />

          {/* §01 pullquote — mockup .pullquote 진본. 일간 + 가장 두꺼운/얇은 오행 기반 동적 한 줄 */}
          <Section1Pullquote
            sajuData={sajuData}
            ilgan={ilgan}
            ilganOheng={ilganOheng}
            ilganSymbol={ilganSymbol}
            aiPullQuote={typeof aiResult.summarySection1Quote === 'string' ? aiResult.summarySection1Quote : undefined}
          />

          {/* 2026-05-04 LifeEdgeList §01 → §02 이동 (준기 결단). 여기엔 §01 결론만 남김 */}

          <Section1Conclusion
            userName={report.name || '회원'}
            sajuData={sajuData}
            ilgan={ilgan}
            ilganOheng={ilganOheng}
            aiText={conclusionAt(0)}
          />
        </CollapsibleSection>
      </LocalFadeIn>

      <SectionDivider label="天 干 地 支" />

      {/* ═════════════ 02 천간지지 (天干地支) ═════════════ */}
      <LocalFadeIn delay={50}>
        <CollapsibleSection step={2} pending={pendingOf('A', 'D')} title="천간지지" hanja="天干地支" hint="위로 드러난 마음과 아래에 깔린 본능" defaultOpen>
          {/* mockup §2 도입 paragraph */}
          <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '14px 0', wordBreak: 'keep-all' }}>
            <strong>천간(天干)은 마음</strong>이고, <strong>지지(地支)는 행동</strong>입니다. 사람들에게 보여지는 모습과, 실제로 하루를 굴리는 본능이 서로 다른 자리에 놓입니다.
          </p>
          {/* Stage 2C-#1: ganji-flow 합·충·형 시각 (mockup ganji-flow 진본) */}
          <GanjiFlow sajuData={sajuData} />
          {/* §02 본문 4 paragraphs (mockup 진본 형식 — 천간 줄 / 지지 줄 / 연주 글자 / 합·충 한 줄) */}
          <Section2Body
            sajuData={sajuData}
            userName={report.name || '회원'}
            ilgan={ilgan}
            ilganOheng={ilganOheng}
            aiStructure={typeof aiResult.structure === 'string' && aiResult.structure.length > 50 ? aiResult.structure : (aiResult.sections?.find?.((s: any) => s.id === 'structure')?.content || '')}
          />
          <PillarMessages aiResult={aiResult} v4Pillars={v4Pillars} />

          {/* 2026-05-04 §01 → §02 이동 — 오행별 인생의 결 (LifeEdgeList) */}
          <h4
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 14,
              color: '#1a1a1a',
              fontWeight: 700,
              margin: '22px 0 4px',
              letterSpacing: '0.02em',
            }}
          >
            오행별 인생의 결 — 나에게 뭐가 있고 뭐가 비는가
          </h4>
          <p style={{ fontSize: 11.5, color: '#5C4A2E', margin: '0 0 10px', lineHeight: 1.55 }}>
            각 오행이 어떻게 작동하는지, <strong style={{ color: '#355A3E' }}>살릴 것</strong> /{' '}
            <strong style={{ color: '#8b1a1a' }}>조심할 것</strong>로 못 박아둡니다
          </p>
          <LifeEdgeList
            elements={sajuData.elements}
            userName={report.name || ''}
            ilganOheng={ilganOheng}
            aiCards={aiResult.lifeEdge}
            pillars={sajuData.pillars}
          />

          {/* 2026-05-04 12운성 제거 (준기 결단 — "12단계 사이클이 뭐에요" 같은 의문 차단) */}
          <Section2Conclusion
            userName={report.name || '회원'}
            sajuData={sajuData}
            ilgan={ilgan}
            aiText={conclusionAt(1)}
          />
        </CollapsibleSection>
      </LocalFadeIn>

      <SectionDivider label="十 神" />

      {/* ═════════════ 03 십성 (十神) ═════════════ */}
      <LocalFadeIn delay={50}>
        <CollapsibleSection step={3} pending={pendingOf('D')} title="십성" hanja="十神" hint="관계와 욕망을 그리는 열 개의 키">
          {/* mockup §3 도입 paragraph */}
          <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '14px 0', wordBreak: 'keep-all' }}>
            <strong>십성(十神)</strong>은 사주가 사람의 욕망과 관계를 풀어내는 언어입니다. 다섯 무리(<strong>비겁, 식상, 재성, 관성, 인성</strong>)로 묶이며, {report.name || '회원'} 님 사주에서는 가장 두꺼운 무리가 본인의 핵심 결을 만듭니다.
          </p>
          {/* Phase A2 · SipDonut — 십성 분포 도넛 (mockup §3 sip-donut 진본) */}
          <SipDonut sipDist={sipDist} />
          {/* Stage 2C-#3: sip-cluster 5분류 헤더 (mockup sip-cluster 진본) */}
          {/* 2026-06-13 — SipsungBars 제거: 도넛·5카드와 동일 데이터 3중복(AI 과잉도식화) → 5카드만 유지 */}
          <SipClusterHeader sipDist={sipDist} />
          {/* AI sipCluster — 5 클러스터별 head 본문 + 카드 (사주 specific) — AI 없으면 사주에서 직접 도출 */}
          <SipClusterDetails aiCluster={aiResult.sipCluster} sajuData={sajuData} />
          {/* 2026-05-04 critical: Section3Body 와 SipsungStory 가 같은 본문 두 번 렌더하던 중복 버그 →
              SipsungStory 만 유지 (AI fallback + top 십성 처리 둘 다 됨). */}
          <SipsungStory aiResult={aiResult} sipDist={sipDist} />
          <Section3Conclusion
            userName={report.name || '회원'}
            sipDist={sipDist}
            aiText={conclusionAt(2)}
          />
          {/* §03 끝 PullQuote (AI 응답 있을 때만) — collapsed 시 함께 접히도록 안에 배치 */}
          {aiPullQuote && (
            <PremiumPullQuote>{aiPullQuote}</PremiumPullQuote>
          )}
        </CollapsibleSection>
      </LocalFadeIn>

      <SectionDivider label="用 神 調 候" />

      {/* ═════════════ 04 용신·조후 (用神·調候) — 신규 ═════════════ */}
      <LocalFadeIn delay={50}>
        <CollapsibleSection step={4} pending={pendingOf('A', 'D')} title="용신과 조후" hanja="用神 調候" hint="사주가 가장 갈증을 느끼는 것 — 색, 방위, 계절, 물건, 습관까지">
          {/* mockup §4 도입 paragraph */}
          <p style={{ fontSize: 14.5, color: '#2a2520', lineHeight: 1.85, margin: '14px 0', wordBreak: 'keep-all' }}>
            사주 풀이의 진짜 가치는 여기서 나옵니다. 원국에서 무엇이 부족한지를 알아냈다면, 그것을 일상에서 어떻게 채울지가 다음 단계입니다. 명리에서 이 자리를 <strong>용신(用神)</strong>이라 부릅니다. {report.name || '회원'} 님 사주의 용신은 두 글자로 못 박을 수 있습니다.
          </p>
          {/* 용신 박스 (두 글자 강조) */}
          <YongsinBox
            primary={yongsin.primary}
            secondary={yongsin.secondary}
            reason={yongsin.reason}
            analysisBase={analysisBase}
            userName={report.name}
          />
          {/* §04 "절대 더 들어오면 안 되는 글자" paragraph (mockup 진본) */}
          <Section4Avoid sajuData={sajuData} dayOheng={dayOheng} aiText={typeof aiResult.yongsinAvoid === 'string' ? aiResult.yongsinAvoid : ''} />
          {/* mockup §4 일상 적용 8행 진본 — 색·방위·계절·시간대·음식·물건·취미·사람 */}
          <YongsinLifeTable primary={yongsin.primary} lifestyle={lifestyle} />
          {/* 2026-05-05 LifestyleAdvice 제거 (준기 지적) — YongsinLifeTable 8 카드와 중복.
              레이아웃 통일성 깨짐 + 같은 정보 두 번 노출 → 카드만 유지. */}
          <Section4Conclusion
            userName={report.name || '회원'}
            primary={yongsin.primary}
            lifestyle={lifestyle}
            aiText={conclusionAt(3)}
          />
        </CollapsibleSection>
      </LocalFadeIn>

      <SectionDivider label="大 運" />

      {/* ═════════════ 05 대운 (大運) ═════════════ */}
      <LocalFadeIn delay={50}>
        <CollapsibleSection step={5} pending={pendingOf('B')} title="대운" hanja="大運" hint="10년 단위로 흐르는 인생의 큰 강줄기">
          <DaeunTimeline v4Daeun={v4Daeun} />
          {/* Stage 2C-2#2: daewoon-scores 8 row (mockup daewoon-scores 진본 — 정점/현재 강조) */}
          <DaewoonScores v4Daeun={v4Daeun} dayOheng={dayOheng} />
          {/* Stage 2C-2#3: daewoon-line 60년 가로 시간선 (mockup daewoon-line 진본) */}
          <DaewoonLine60 v4Daeun={v4Daeun} sajuData={sajuData} />
          {/* 현재 대운 상세 카드 — mockup §5 now-daewoon 진본 (천간/지지 별 풀이 + 키 사건) */}
          <NowDaewoonCard v4Daeun={v4Daeun} dayOheng={dayOheng} />
          {/* Stage 2C-#6: 인생 단계 3 카드 (mockup life-stage-grid 진본 — 지난/지금/다음 10년) */}
          <LifeStageGrid v4Daeun={v4Daeun} dayOheng={dayOheng} />
          {/* §05 본문 4 paragraphs (mockup 진본 형식 — 현재 대운 / 지지 결 / 다음 대운 / 그 다음) */}
          <Section5Body
            userName={report.name || '회원'}
            v4Daeun={v4Daeun}
            dayOheng={dayOheng}
            aiDaeun={typeof aiResult.daeun === 'string' && aiResult.daeun.length > 50 ? aiResult.daeun : (aiResult.sections?.find?.((s: any) => s.id === 'daeun')?.content || '')}
          />
          <Section5Conclusion
            userName={report.name || '회원'}
            v4Daeun={v4Daeun}
            dayOheng={dayOheng}
            aiText={conclusionAt(4)}
          />
        </CollapsibleSection>
      </LocalFadeIn>

      <SectionDivider label="年 運" />

      {/* ═════════════ 06 연운 (年運) — 시기별 경고 카드 추가 ═════════════ */}
      <LocalFadeIn delay={50}>
        <CollapsibleSection step={6} pending={pendingOf('B')} title="연운" hanja="年運" hint={(() => {
          const y = new Date().getFullYear();
          const SIXTY = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未', '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑', '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];
          const HK: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계', 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
          const gz = SIXTY[(y - 1984 + 6000) % 60];
          const kr = (HK[gz[0]] || '') + (HK[gz[1]] || '');
          return `${y}년 ${kr}(${gz}) 해 — 올해의 흐름`;
        })()}>
          <YearlyForecast aiResult={aiResult} dayOheng={dayOheng} />
          {/* yeonun-chart SVG line — mockup §6 진본. 12개월 강제 + 점수 라벨 + 사주 fallback */}
          <YeonunLineChart aiResult={aiResult} sajuData={sajuData} dayOheng={dayOheng} />
          {/* Stage 2C-2#4+5: 12개월 인사이트 grid (3×4 — up/peak/warn/now 4 분류) — mockup month-insight-grid 진본 */}
          <MonthInsightGrid aiResult={aiResult} dayOheng={dayOheng} sajuData={sajuData} />
          {/* 시기별 경고 카드 (목업 v2 §6 — "9월 조심" 패턴) */}
          <MonthlyWarnings aiResult={aiResult} />
          {/* 관계 grid — mockup §6 relation-grid 진본. 일간 + 오행 카운트 기반 동적 */}
          <RelationCompassGrid sajuData={sajuData} dayOheng={dayOheng} userName={report.name || '회원'} />
          {conclusionAt(5) && (
            <SectionConclusion>{conclusionAt(5)}</SectionConclusion>
          )}
        </CollapsibleSection>
      </LocalFadeIn>

      <SectionDivider label="神 殺" />

      {/* ═════════════ 07 신살 (神殺) — 길신·흉살 ═════════════ */}
      <LocalFadeIn delay={50}>
        <CollapsibleSection step={7} pending={pendingOf('B')} title="신살" hanja="神殺" hint={(() => {
              const total = (v4Gilsin?.length ?? 0) + (v4Hyungsal?.length ?? 0);
              if (total === 0) return '강하게 발현된 신살이 없는 균형 잡힌 결';
              const aiCount = Array.isArray(aiResult.shinsalCards) ? aiResult.shinsalCards.length : 0;
              // 2026-06-02 fix — 헤드라인 개수와 (강·중·참고) 브레이크다운을 동일 n 에서 파생.
              //   기존: 헤드라인=aiCount(7) / 브레이크다운=total(10) → "7개 (강2·중2·참고6=10)" 불일치.
              const n = aiCount > 0 ? aiCount : total;
              const strong = Math.min(2, n);
              const mid = Math.min(2, Math.max(0, n - 2));
              const ref = Math.max(0, n - 4);
              const name = report.name || '회원';
              return `사주마다 0~10개까지 다릅니다, ${name} 님께는 ${n}개가 자리합니다 (강 ${strong}, 중 ${mid}, 참고 ${ref})`;
            })()}>
          {/* Stage 2C-#4: 신살 3 tier (강·중·참고) — mockup shinsal-3tier 진본
              AI shinsalCards 우선 + V4SinSal fallback */}
          <SinsalThreeTier gilsin={v4Gilsin} hyungsal={v4Hyungsal} aiCards={aiResult.shinsalCards} />
          {/* 신살 정리 — 가독성 위해 강·중·참고 한 줄 요약 */}
          <ShinsalSummary userName={report.name || '회원'} gilsin={v4Gilsin} hyungsal={v4Hyungsal} aiCards={aiResult.shinsalCards} sajuData={sajuData} dayOheng={dayOheng} />
          {/* 끝 fine-print — 미발현 신살 동적 안내 (mockup §7 ※ 라인 진본) */}
          <ShinsalFinePrint userName={report.name || '회원'} gilsin={v4Gilsin} hyungsal={v4Hyungsal} aiCards={aiResult.shinsalCards} />
          {conclusionAt(6) && (
            <SectionConclusion label="이 섹션의 결론 — 신살 한 줄 정리">{conclusionAt(6)}</SectionConclusion>
          )}
        </CollapsibleSection>
      </LocalFadeIn>

      <SectionDivider label="本 質" />

      {/* ═════════════ 08 내 사주의 결 (本質) — 한 줄 키워드 + 강점 3 + 함정 3 ═════════════
          2026-05-05 §08 관계의 결 (六親) 통째 교체 (준기 결단)
          - 이전: 부모·형제·배우자·자녀 6관계 — 형제/자녀/배우자 없는 사람도 있는데 모두 잘된다는 식 부적절
          - 이후: 본인 사주 통합 메타 (한 줄 키워드 + 강점·함정) — 모든 사람에게 의미 있음
          - AI schema 신규: lifeKeyword (한 줄) + strengths[3] + cautions[3] */}
      <LocalFadeIn delay={50}>
        <CollapsibleSection step={8} pending={pendingOf('C')} title="내 사주의 결" hanja="本質" hint="사주 8글자가 빚는 통합 한 줄 + 진짜 강점 3, 함정 3">
          <LifeKeywordHero aiResult={aiResult} userName={report.name || '회원'} sipDist={sipDist} dayOheng={dayOheng} sajuData={sajuData} />
          <StrengthsCautionsCards aiResult={aiResult} sipDist={sipDist} dayOheng={dayOheng} sajuData={sajuData} />
        </CollapsibleSection>
      </LocalFadeIn>

      <SectionDivider label="主 題" />

      {/* ═════════════ 09 여섯 영역 한눈에 (主題) — 재물·사랑·직업·건강·인간관계·잠재력 6 카드
          2026-05-05 6 카드 복원 (잠재력·인간관계 추가) → 제목 "주제별 한눈에" → "여섯 영역 한눈에"
          ═════════════ */}
      <LocalFadeIn delay={50}>
        <CollapsibleSection step={9} pending={pendingOf('C')} title="여섯 영역 한눈에" hanja="主題" hint="재물, 사랑, 직업, 건강, 인간관계, 학업잠재력 — 강과 약 점수와 주제별 깊이 보기">
          {/* Stage 2C-2#6: 여섯 영역 점수 topic-mini grid (mockup topic-mini 진본) */}
          <TopicMiniGrid scores={areaScores} aiTopics={aiResult.topicMini} sipDist={sipDist} dayGan={sajuData?.pillars?.[2]?.천간 as string | undefined} profileId={reportProfile.profileId} />
          {conclusionAt(8) && (
            <SectionConclusion>{conclusionAt(8)}</SectionConclusion>
          )}
        </CollapsibleSection>
      </LocalFadeIn>

      <SectionDivider label="實 踐" />

      {/* ═════════════ 10 실천 (實踐) — 분기별 손에 잡히는 액션 ═════════════ */}
      <LocalFadeIn delay={50}>
        <CollapsibleSection step={10} pending={pendingOf('C')} title="실천" hanja="實踐" hint="사주를 안 다음, 오늘부터 바꾸어볼 다섯 가지">
          {/* 도입 paragraph — 사주별 동적 (일간 + 가장 약한 오행 기반) */}
          <Section10Intro userName={report.name || '회원'} sajuData={sajuData} dayOheng={dayOheng} aiText={typeof aiResult.practiceIntro === 'string' ? aiResult.practiceIntro : undefined} />
          <PracticeChecklist aiResult={aiResult} scores={scores} sajuData={sajuData} sipDist={sipDist} />
          {/* 끝 pullquote — 사주별 동적 (일간 + 현재 대운 기반) */}
          <Section10ClosingQuote userName={report.name || '회원'} sajuData={sajuData} dayOheng={dayOheng} v4Daeun={v4Daeun} aiQuote={typeof aiResult.practiceQuote === 'string' ? aiResult.practiceQuote : undefined} />
          {conclusionAt(9) && (
            <SectionConclusion label="이 섹션의 결론 — 평생 가져갈 한 줄">
              {conclusionAt(9)}
            </SectionConclusion>
          )}
        </CollapsibleSection>
      </LocalFadeIn>

      {/* word-count 마커 (mockup §word-count 진본) — "完 · 10섹션 풀이 완료" */}
      {!anyPending && (
      <div className="word-count">
        <span className="han">完</span> 10섹션 풀이 완료
      </div>
      )}

      {!pendingOf('C') && (<>
      {/* "더 알아보기" 3 동적 카드 — 점수 가장 높은 3 영역으로 CTA */}
      <LocalFadeIn delay={50}>
        <TopicTopRecommend scores={scores} topicBaseScores={topicBaseScores} sipDist={sipDist} dayGan={sajuData?.pillars?.[2]?.천간 as string | undefined} profileId={reportProfile.profileId} />
      </LocalFadeIn>

      {/* ═════════════ Upsell — 사주대화 진입 CTA (목업 .upsell-card 진본) ═════════════ */}
      <LocalFadeIn delay={50}>
        <PremiumUpsellCard reportId={report.id} sajuData={sajuData} scores={areaScores} userName={report.name || '회원'} profile={reportProfile.profile} aiQuestions={Array.isArray(aiResult.chatQuestions) ? aiResult.chatQuestions.filter((q: unknown) => typeof q === 'string' && (q as string).trim()) : undefined} />
      </LocalFadeIn>
      </>)}

      {!anyPending && (<>
      {/* #61 · 프리미엄 PDF 다운로드 + 공유하기 — mockup .result-footer 2-column grid 진본 */}
      <LocalFadeIn delay={60}>
        <PremiumResultFooter
          reportId={(report as any).serverReportId ?? report.id}
          report={report}
          sajuData={sajuData}
          aiResult={aiResult}
        />
      </LocalFadeIn>
      </>)}

      {/* ═════════════ ReportSources — 지식 기반 fine-print (목업 .report-sources 진본) ═════════════ */}
      <ReportSources />

      </div>{/* /.content */}
      </div>{/* /.page-wrap */}

      {/* 좌측 인디케이터 — 데스크톱(>540px)에서만 보임 */}
      <TocSideIndicator count={10} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Phase D'-2 · PremiumUpsellCard — 사주대화 진입 CTA
 *  · mockup .upsell-card 진본 (다크 그라디언트 + 對 워터마크 + 골드 cta)
 * ═════════════════════════════════════════════════════════════════ */
function PremiumUpsellCard({
  reportId,
  sajuData,
  scores,
  userName,
  profile,
  aiQuestions,
}: {
  reportId: string;
  sajuData?: SajuData;
  scores?: Record<string, number>;
  userName?: string;
  /** 리포트 주인 프로필 — 사주대화가 이 사주로 답하도록 (가족 사주 리포트 대응 · B-3) */
  profile?: SajuProfile;
  /** 2026-10-09 — 이 풀이가 만든 맞춤 질문 (서버 C 그룹 chatQuestions) — 누르면 사주대화에서 바로 질문 */
  aiQuestions?: string[];
}) {
  const navigate = useNavigate();
  // 2026-05-29 H3 fix — 기존 <a href="/chat/new"> = 풀 페이지 리로드(앱인토스 정책 위반) + 컨텍스트 0.
  //   → SPA navigate + contentContext(type:'premium') 전달. buildContextPrompt 에 premium 분기 이미 존재.
  const handleChat = async (e: React.MouseEvent, question?: string) => {
    e.preventDefault();
    try {
      const [{ getReport }, { createChatRoom }] = await Promise.all([
        import('@/services/storage/localStore'),
        import('@/services/storage/chatStore'),
      ]);
      const rep = getReport(reportId);
      const ctx = { type: 'premium' as const, label: '종합사주', fullResult: rep?.aiResult };
      const room = createChatRoom(userName || '나', 'free', ctx);
      // 🚨 2026-09-17 B-3 — profile 미전달 시 ChatSessionPage 가 기기 '내 프로필'로 폴백 →
      //   가족 사주 종합사주에서 넘어가도 내 사주로 대화하던 버그. 리포트 주인 프로필을 state 로 전달.
      navigate(`/chat/${room.id}`, { state: { profile, contentContext: ctx, ...(question ? { autoAsk: question } : {}) } });
    } catch {
      navigate('/chat/new', profile ? { state: { profile } } : undefined);
    }
  };
  // 사주별 동적 질문 예시 — 점수 worst topic + 가까운 대운 변곡점 호명
  // (이전: "올해 9월" 하드코딩 → 자형(自刑) 9월 없는 사주에도 거짓 노출)
  function buildExamples(): { q1: string; q2: string } {
    // worst topic — 점수 가장 낮은 영역 (2026-05-28 social 제거 — SSOT 정렬)
    const TOPIC_KR: Record<string, string> = {
      career: '직업', love: '사랑', wealth: '재물',
      health: '건강', potential: '학업과 잠재력',
    };
    let worstKey = '';
    let worstScore = 101;
    if (scores) {
      for (const [k, v] of Object.entries(scores)) {
        const n = Number(v);
        if (n > 0 && n < worstScore && TOPIC_KR[k]) {
          worstScore = n;
          worstKey = k;
        }
      }
    }

    // 가까운 대운 변곡점 — 현재 대운 다음 시작 나이
    let nextDaeunAge = 0;
    if (sajuData?.daeun) {
      const list = sajuData.daeun;
      const curIdx = list.findIndex((d: any) => d.isCurrent || d.현재);
      if (curIdx >= 0 && curIdx + 1 < list.length) {
        nextDaeunAge = (list[curIdx + 1] as any).시작나이 || (list[curIdx + 1] as any).나이범위?.split?.('~')?.[0] || 0;
      }
    }

    // 일간 호명용
    const dayGan = sajuData?.pillars?.[2]?.천간 || '';
    const dayGanKr = sajuData?.pillars?.[2]?.천간읽기 || '';
    const dayGanLabel = dayGan && dayGanKr ? `${dayGan}(${dayGanKr})` : dayGan || '';

    // q1: worst topic 호명 → "내 ${가장 약한 영역}이 왜 약해?"
    const q1 = worstKey
      ? `"내 ${TOPIC_KR[worstKey]}운이 ${worstScore}점인데 왜 약한 거야? 어떻게 보강해?"`
      : userName
      ? `"${userName} 님 사주에서 가장 먼저 손볼 부분이 어디야?"`
      : '"내 사주에서 가장 먼저 손볼 부분이 어디야?"';

    // q2: 가까운 대운 변곡점 호명 → "내가 ${age}세에 들어가는 대운은 어떤 흐름이야?"
    const q2 = nextDaeunAge > 0
      ? `"내가 ${nextDaeunAge}세에 바뀌는 대운, 어떤 흐름이야?"`
      : dayGanLabel
      ? `"${dayGanLabel} 일간인 내 결을 살리는 사람은 어떤 일간이야?"`
      : '"내 결을 살리는 사람은 어떤 결의 사람이야?"';

    return { q1, q2 };
  }

  const { q1, q2 } = buildExamples();

  return (
    <div className="upsell-card">
      <div className="label">DEEPER, 더 들어가보기</div>
      <h3>이 풀이를 두고 직접 물어보세요</h3>
      {aiQuestions && aiQuestions.length >= 2 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0 14px' }}>
          {aiQuestions.slice(0, 3).map((q) => (
            <button
              key={q}
              type="button"
              onClick={(e) => handleChat(e, q)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', minHeight: 44,
                background: 'rgba(248,245,238,0.08)', border: '1px solid rgba(232,217,184,0.22)', borderRadius: 10,
                padding: '10px 12px', color: '#F8F5EE', fontSize: 13, lineHeight: 1.5, cursor: 'pointer', wordBreak: 'keep-all',
              }}
            >
              <span style={{ flex: 1 }}>“{q}”</span>
              <span aria-hidden style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#E8D9B8' }}>물어보기</span>
            </button>
          ))}
        </div>
      ) : (
        <p>{q1}, {q2} — 풀이를 보며 떠오른 질문을, 사주를 살피며 답해드려요.</p>
      )}
      <a href="/chat/new" onClick={handleChat} className="cta" style={{ textDecoration: 'none' }}>
        사주대화로 이어가기 →
      </a>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Phase D'-2 · ReportSources — 지식 기반 fine-print
 *  · mockup .report-sources 진본 (작은 글씨 출처 + 디스클레이머)
 * ═════════════════════════════════════════════════════════════════ */
function ReportSources() {
  return (
    <div
      style={{
        margin: '28px 2px 0',
        padding: '12px 0 0',
        borderTop: '1px solid rgba(138,125,95,0.16)',
        fontSize: 11,
        lineHeight: 1.72,
        color: '#a89c7f',
        letterSpacing: '0.005em',
        wordBreak: 'keep-all',
      }}
    >
      <p style={{ margin: 0 }}>
        본 리포트는{' '}
        <span style={{ fontFamily: "'Noto Serif KR', serif", color: '#7F6B4E' }}>
          『연해자평(淵海子平)』
        </span>
, 
        <span style={{ fontFamily: "'Noto Serif KR', serif", color: '#7F6B4E' }}>
          『자평진전(子平眞詮)』
        </span>
, 
        <span style={{ fontFamily: "'Noto Serif KR', serif", color: '#7F6B4E' }}>
          『적천수(滴天髓)』
        </span>
, 
        <span style={{ fontFamily: "'Noto Serif KR', serif", color: '#7F6B4E' }}>
          『궁통보감(窮通寶鑑)』
        </span>
, 
        <span style={{ fontFamily: "'Noto Serif KR', serif", color: '#7F6B4E' }}>
          『명리약언(命理約言)』
        </span>
, 
        <span style={{ fontFamily: "'Noto Serif KR', serif", color: '#7F6B4E' }}>
          『삼명통회(三命通會)』
        </span>
        를 비롯한 사주명리 6대 원전과 김만태 「한국 사주명리의 수용양상과 전개」(2011)를 포함한 현대 명리학 논문과 통계 자료를 지식 기반으로, 고성능 인공지능 응용 프로그램 인터페이스(API)가 당신의 원국, 대운, 연운에 맞춰 개인별로 생성한 풀이입니다.
      </p>
      <p style={{ margin: '8px 0 0', color: '#9A8B70', fontStyle: 'italic' }}>
        사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다. 의료, 법률, 재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 내부 서브컴포넌트
 * ═════════════════════════════════════════════════════════════════ */

/* ─────────── Phase D' 신규 컴포넌트 (목업 v2 정렬) ─────────── */

/** 용신 박스 — "두 글자로 못 박을 수 있습니다" (목업 v2 §4)
 *  · 한자 + 한글 병기 + 골드 그라데이션 헤더 + 처방전 스타일
 *  · primary(용신) + secondary(조후) 를 큰 한자 칩으로 강조
 */
function YongsinBox({
  primary,
  secondary,
  reason,
  analysisBase,
  userName,
}: {
  primary: OhengType;
  secondary?: OhengType;
  reason: string;
  analysisBase: any;
  userName?: string;
}) {
  // primary/secondary 가 유효 OhengType 이 아닐 때 가드
  const primaryKey = primary ? OHENG_TO_ELEM[primary] : undefined;
  const secondaryKey = secondary ? OHENG_TO_ELEM[secondary] : undefined;
  const primaryEc = (primaryKey && EC[primaryKey]) || EC.earth;
  const secondaryEc = secondaryKey ? EC[secondaryKey] || null : null;
  const primaryHanja = primaryKey ? EHAN[primaryKey] : '';
  const secondaryHanja = secondaryKey ? EHAN[secondaryKey] : '';

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #FFFEF8 0%, #FBF5E8 100%)',
        border: `1.5px solid ${C.goldLine}`,
        borderRadius: 16,
        padding: 0,
        marginBottom: 16,
        boxShadow: '0 4px 20px rgba(184,150,90,0.14)',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 — 골드 그라데이션 + 한자 라벨 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #B8965A 0%, #8B6F3D 100%)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 16,
              fontWeight: 800,
              color: '#FFFEF8',
              letterSpacing: '0.08em',
            }}
          >
            用神 處方
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,254,248,0.82)', letterSpacing: '0.06em', fontWeight: 600 }}>
            용신 처방
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255,254,248,0.7)',
            letterSpacing: '0.12em',
            fontWeight: 700,
          }}
        >
          PRESCRIPTION, 處方
        </span>
      </div>

      <div style={{ padding: '16px 18px 18px' }}>
        {/* 도입 문장 */}
        <p
          style={{
            fontSize: 12.5,
            color: C.inkSoft,
            margin: '0 0 14px',
            lineHeight: 1.7,
            textAlign: 'center',
          }}
        >
          {userName ? <strong style={{ color: C.ink }}>{userName} 님</strong> : ''} 사주가 가장 갈증을 느끼는 결을
          <br />
          <strong style={{ color: C.goldDeep }}>두 글자(二字)</strong>로 못 박았습니다.
        </p>

        {/* 용신 + 조후 칩 — 큰 한자 강조 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: secondary && secondaryEc ? '1fr 1fr' : '1fr',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <YongsinChip
            rank="1순위, 용신"
            rankHan="第一 用神"
            oheng={primary}
            hanja={primaryHanja}
            color={primaryEc.dark}
            bg={primaryEc.light}
            border={primaryEc.med}
          />
          {secondary && secondaryEc && (
            <YongsinChip
              rank="2순위, 조후"
              rankHan="第二 調候"
              oheng={secondary}
              hanja={secondaryHanja}
              color={secondaryEc.dark}
              bg={secondaryEc.light}
              border={secondaryEc.med}
            />
          )}
        </div>

        {/* reason — 한문 처방서 스타일 인용 박스 */}
        <div
          style={{
            // 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). border ring으로 톤 표현.
            position: 'relative',
            background: '#FFFFFF',
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: primaryEc.dark,
              letterSpacing: '0.1em',
              marginBottom: 6,
            }}
          >
            왜 이 결이 필요한가, 何以必須
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: C.ink,
              lineHeight: 1.78,
              margin: 0,
            }}
          >
            {reason}
          </p>
        </div>

        {/* 기신 — 위험 박스 */}
        {analysisBase?.기신 && (
          <div
            style={{
              marginTop: 10,
              background: 'rgba(156,36,36,0.04)',
              border: '1px dashed rgba(156,36,36,0.32)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#9C2424',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              忌
            </div>
            <p
              style={{
                fontSize: 11.5,
                color: '#9C2424',
                lineHeight: 1.65,
                margin: 0,
                flex: 1,
              }}
            >
              반대로 <strong>{analysisBase.기신}(기신, 忌神)</strong>이 강해지는 시기에는
              새 일을 벌이지 않는 편이 좋습니다. 결이 어긋나 힘이 빠지는 때입니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function YongsinChip({
  rank,
  rankHan,
  oheng,
  hanja,
  color,
  bg,
  border,
}: {
  rank: string;
  rankHan: string;
  oheng: OhengType;
  hanja: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 12,
        padding: '12px 10px 14px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* rank 라벨 */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: color,
          letterSpacing: '0.06em',
          marginBottom: 2,
        }}
      >
        {rank}
      </div>
      <div
        style={{
          fontSize: 8.5,
          fontWeight: 600,
          color: color,
          opacity: 0.7,
          letterSpacing: '0.08em',
          marginBottom: 8,
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        {rankHan}
      </div>
      {/* 큰 한자 — 도장처럼 */}
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 44,
          fontWeight: 900,
          color: color,
          lineHeight: 1,
          margin: '4px 0 6px',
          textShadow: `0 2px 8px ${border}`,
        }}
      >
        {hanja}
      </div>
      {/* 한글 + 오행 */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: color,
          fontFamily: "'Noto Serif KR', serif",
          letterSpacing: '0.04em',
        }}
      >
        {oheng}
        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.72, marginLeft: 4 }}>
          ({['목', '화', '토', '금', '수'].includes(oheng) ? oheng + '의 결' : ''})
        </span>
      </div>
    </div>
  );
}


/** 생활 행동 처방 — AI yongsin/lifestyle 응답 또는 fallback */
// 2026-05-05 dead code (준기 결단 · 다음 sprint 재도입 가능)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-expect-error preserved
function _LifestyleAdvice({
  aiResult,
  primary,
  lifestyle,
}: {
  aiResult: any;
  primary: OhengType;
  lifestyle: LifestyleSet;
}) {
  // Stage 7e-7: lifestyle undefined 가드
  if (!lifestyle) return null;
  const aiLifestyle =
    aiResult?.lifestyleAdvice ??
    aiResult?.sections?.find((s: any) => s.id === 'yongsin' || s.id === 'lifestyle')
      ?.content;
  if (typeof aiLifestyle === 'string' && aiLifestyle.length > 0) {
    // 2026-05-04 critical fix: stripMd 만 통과 + raw 텍스트 노출 → sanitizeAiText + dangerouslySetInnerHTML
    return (
      <p
        style={{
          fontSize: 13.5,
          color: C.ink,
          lineHeight: 1.8,
          margin: 0,
          whiteSpace: 'pre-line',
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeAiText(autoEmphasize(aiLifestyle)) }}
      />
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p
        style={{
          fontSize: 13.5,
          color: C.ink,
          lineHeight: 1.75,
          margin: 0,
        }}
      >
        옷장에 <strong style={{ color: C.goldDeep }}>{lifestyle.color}</strong> 비중을 의식적으로 올리세요.
        {' '}결정, 계약, 발표는 <strong style={{ color: C.goldDeep }}>{lifestyle.season}</strong>에
        {' '}몰아두면 같은 일도 흐름이 다릅니다.
      </p>
      <p
        style={{
          fontSize: 12.5,
          color: C.inkSoft,
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {primary} 오행의 결을 일상에 채우는 것이 사주 풀이의 진짜 가치입니다.
      </p>
    </div>
  );
}


/** 양력 y년 m월의 실제 월주 (각 달 15일 기준 · 절입 경계 회피). 실패 시 '' */
function realMonthGanzi(y: number, m: number): string {
  try { const ec = Solar.fromYmd(y, m, 15).getLunar().getEightChar(); return ec.getMonthGan() + ec.getMonthZhi(); } catch { return ''; }
}

/**
 * YeonunLineChart — §06 mockup yeonun-chart 진본
 *  · 12개월 활력 지수 SVG line + area + now/peak markers
 *  · monthlyInsight (label='상승'/'정점'/'주의'/'평탄'/'지금') 우선 → 점수 매핑
 *  · fallback: monthlyFortune 의 score 사용
 */
function YeonunLineChart({ aiResult, sajuData, dayOheng }: { aiResult: any; sajuData: SajuData; dayOheng: OhengType }) {
  const insight = Array.isArray(aiResult?.monthlyInsight) ? aiResult.monthlyInsight : null;
  const fortune = Array.isArray(aiResult?.monthlyFortune) ? aiResult.monthlyFortune : null;
  // 12개월 모두 강제 — AI 데이터 비어도 사주 기반 fallback
  const scores: Array<{ m: number; s: number; label?: string }> = [];
  const LABEL_TO_SCORE: Record<string, number> = { 정점: 92, 상승: 78, 지금: 70, 평탄: 60, 주의: 38 };

  // AI 우선
  if (insight && insight.length > 0) {
    for (let m = 1; m <= 12; m++) {
      const item = insight.find((i: any) => Number(i?.month) === m);
      if (item) {
        const s = LABEL_TO_SCORE[String(item.label ?? '평탄').trim()] ?? 60;
        scores.push({ m, s, label: item.label });
      }
    }
  } else if (fortune && fortune.length === 12) {
    fortune.forEach((f: any) => {
      scores.push({ m: Number(f.month) || 0, s: Number(f.score) || 50 });
    });
  }
  // 부족한 달 자동 채움 — 일간 vs 월지 오행 관계로 점수
  const HAN_OH: Record<string, OhengType> = {
    寅: '목', 卯: '목', 巳: '화', 午: '화', 辰: '토', 戌: '토', 丑: '토', 未: '토',
    申: '금', 酉: '금', 亥: '수', 子: '수',
  };
  const SS: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const SG: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
  const MONTH_ZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  // 일지 vs 월지 충 검사 (사주 specific 흔들림 감지)
  const dayJi = sajuData.pillars[2]?.지지 || '';
  const CHUNG: Record<string, string> = {
    子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
  };
  const lineYear = new Date().getFullYear();
  for (let m = 1; m <= 12; m++) {
    if (scores.find((s) => s.m === m)) continue;
    const monthZhi = realMonthGanzi(lineYear, m).slice(1) || MONTH_ZHI[(m - 1) % 12]; // 2026-10-04 실제 월지
    const monthOh = HAN_OH[monthZhi];
    let score = 60;
    let label = '평탄';
    if (CHUNG[dayJi] === monthZhi) { score = 38; label = '주의'; }
    else if (monthOh === dayOheng) { score = 78; label = '상승'; }
    else if (SS[monthOh] === dayOheng) { score = 75; label = '상승'; }
    else if (SG[dayOheng] === monthOh) { score = 80; label = '상승'; }
    else if (SG[monthOh] === dayOheng) { score = 50; label = '평탄'; }
    scores.push({ m, s: score, label });
  }
  scores.sort((a, b) => a.m - b.m);
  if (scores.length < 12) return null;

  const W = 320, H = 140, PAD_X = 12, TOP = 24, BOT = 100;
  const xOf = (i: number) => PAD_X + (i / Math.max(1, scores.length - 1)) * (W - PAD_X * 2);
  const yOf = (s: number) => TOP + (1 - Math.max(0, Math.min(100, s)) / 100) * (BOT - TOP);
  const points = scores.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.s).toFixed(1)}`);
  const linePath = 'M' + points.join(' L');
  const areaPath = `M${xOf(0).toFixed(1)},${BOT} L${points.join(' L')} L${xOf(scores.length - 1).toFixed(1)},${BOT} Z`;
  const peakIdx = scores.reduce((acc, p, i) => p.s > scores[acc].s ? i : acc, 0);
  const lowIdx = scores.reduce((acc, p, i) => p.s < scores[acc].s ? i : acc, 0);
  const currentMonth = new Date().getMonth() + 1;
  const nowIdx = scores.findIndex((p) => p.label === '지금' || p.m === currentMonth);

  return (
    <div style={{ marginTop: 14, marginBottom: 10 }}>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 12,
          fontWeight: 700,
          color: C.goldDeep,
          letterSpacing: '0.04em',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <span>월별 흐름 — 1~12월 활력 지수</span>
        <span style={{ fontSize: 11, color: C.mute, fontWeight: 500 }}>
          평탄 60 / 상승 75+ / 정점 90+ / 주의 40-
        </span>
      </div>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: '14px 10px 8px',
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 140 }}>
          <defs>
            <linearGradient id="ye-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#E8D9B8" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#E8D9B8" stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* 가이드라인 (50/75 점) */}
          <line x1={PAD_X} y1={yOf(50)} x2={W - PAD_X} y2={yOf(50)} stroke="#E5DFD0" strokeWidth={0.5} strokeDasharray="2 3" />
          <line x1={PAD_X} y1={yOf(75)} x2={W - PAD_X} y2={yOf(75)} stroke="#E5DFD0" strokeWidth={0.5} strokeDasharray="2 3" />
          <text x={PAD_X - 4} y={yOf(50) + 3} fontSize={7.5} fill="#a89c7f" textAnchor="end">50</text>
          <text x={PAD_X - 4} y={yOf(75) + 3} fontSize={7.5} fill="#a89c7f" textAnchor="end">75</text>
          <path d={areaPath} fill="url(#ye-grad)" />
          <path d={linePath} stroke="#B8965A" strokeWidth={2} fill="none" />
          {/* 모든 점에 점수 라벨 */}
          {scores.map((p, i) => {
            const isPeak = i === peakIdx;
            const isLow = i === lowIdx && p.s !== scores[peakIdx].s;
            const isNow = i === nowIdx;
            const x = xOf(i);
            const y = yOf(p.s);
            const labelY = y - 6;
            const fillColor = isPeak ? '#4E7A57' : isLow ? '#c62828' : isNow ? '#B8965A' : '#fff';
            const stroke = isPeak ? '#4E7A57' : isLow ? '#c62828' : '#B8965A';
            const r = isPeak || isLow || isNow ? 4 : 2.5;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={r} fill={fillColor} stroke={stroke} strokeWidth={isPeak || isLow || isNow ? 2 : 1} />
                <text
                  x={x}
                  y={labelY}
                  textAnchor="middle"
                  fontSize={isPeak || isLow || isNow ? 9 : 7.5}
                  fontWeight={isPeak || isLow || isNow ? 800 : 600}
                  fill={isPeak ? '#4E7A57' : isLow ? '#c62828' : isNow ? '#B8965A' : '#7F6B4E'}
                >
                  {p.s}
                </text>
              </g>
            );
          })}
          {/* NOW 텍스트 */}
          {nowIdx >= 0 && (
            <text x={xOf(nowIdx)} y={yOf(scores[nowIdx].s) + 14} textAnchor="middle" fontSize={8} fill="#B8965A" fontWeight={700}>
              NOW
            </text>
          )}
          {/* 모든 12개월 라벨 */}
          {scores.map((p, i) => (
            <text key={`m-${i}`} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize={8} fill="#7F6B4E" fontWeight={600}>
              {p.m}월
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

/**
 * RelationCompassGrid — §06 mockup §6 relation-grid 진본
 *  · 일간 오행 + 가장 약한 오행 + 가장 강한 오행을 기반으로 3 카드 동적 생성:
 *    1) 힘이 되는 사람 (가장 약한 오행 일간)
 *    2) 부딪히는 사람 (가장 강한 오행 일간 — 같은 결의 사람)
 *    3) 마음이 놓이는 사람 (일간 오행을 도와주는 오행)
 *  · 사주별 weakest/strongest 가 다르므로 자연스럽게 분기
 */
function RelationCompassGrid({
  sajuData,
  dayOheng,
  userName,
}: {
  sajuData: SajuData;
  dayOheng: OhengType;
  userName: string;
}) {
  const navigate = useNavigate();
  const e = sajuData.elements as Record<OhengType, number>;
  const counts: Array<[OhengType, number]> = [
    ['목', Number(e?.목 ?? 0)], ['화', Number(e?.화 ?? 0)],
    ['토', Number(e?.토 ?? 0)], ['금', Number(e?.금 ?? 0)],
    ['수', Number(e?.수 ?? 0)],
  ];
  // 일간을 생해주는 오행 (인성) — 마음이 놓이는 사람
  const SANGSAENG_REV: Record<OhengType, OhengType> = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
  let calmer = SANGSAENG_REV[dayOheng];
  // 가장 약한 오행 — calmer 와 dayOheng 제외한 오행 중 최약
  const sorted = [...counts].sort((a, b) => a[1] - b[1]);
  let weakest = (sorted.find(([k]) => k !== calmer && k !== dayOheng) ?? sorted[0])[0];
  // 가장 강한 오행 (일간 + 인성 제외) — 부딪히는 사람
  let strongest = ([...counts].sort((a, b) => b[1] - a[1])
    .find(([k]) => k !== calmer && k !== dayOheng && k !== weakest) ?? counts[0])[0];
  // 2026-10-07 — 용신·희신·기신 SSOT 우선 (오늘의 운세 '만나면 좋은 사람'과 같은 기준).
  //   개수 기반(최약=힘, 최강=부딪힘)은 결정론 용신 분석과 엇갈려, 두 콘텐츠를 산 고객에게 반대 말을 할 수 있었다.
  const ma = ((sajuData as any).myeongriAnalysis || {}) as Record<string, string>;
  const OH: OhengType[] = ['목', '화', '토', '금', '수'];
  const usesSsot = OH.includes(ma.용신 as OhengType) && OH.includes(ma.희신 as OhengType) && OH.includes(ma.기신 as OhengType);
  if (usesSsot) {
    weakest = ma.용신 as OhengType;   // 힘이 되는 사람 = 용신
    calmer = ma.희신 as OhengType;    // 마음이 놓이는 사람 = 희신
    strongest = ma.기신 as OhengType; // 부딪히는 사람 = 기신
  }
  // 천간 매핑
  const GAN_BY_OHENG: Record<OhengType, [string, string]> = {
    목: ['甲', '乙'], 화: ['丙', '丁'], 토: ['戊', '己'], 금: ['庚', '辛'], 수: ['壬', '癸'],
  };
  const HAN_BY_OHENG: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  const KR_BY_OHENG: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };

  // 카드 1: 힘이 되는 — weakest 오행 일간이 부족한 결을 채워줌
  const boostGan = GAN_BY_OHENG[weakest];
  const boostDesc = weakest === '수'
    ? `${HAN_BY_OHENG[weakest]}(${KR_BY_OHENG[weakest]}) 일간. 직관이 깊고 감정이 조용한 사람이 ${userName} 님의 부족한 ${KR_BY_OHENG[weakest]}을 채웁니다.`
    : weakest === '금'
    ? `${HAN_BY_OHENG[weakest]}(${KR_BY_OHENG[weakest]}) 일간. 단호하고 원칙이 또렷한 사람이 ${userName} 님 결을 다듬어줍니다.`
    : weakest === '화'
    ? `${HAN_BY_OHENG[weakest]}(${KR_BY_OHENG[weakest]}) 일간. 표현이 거침없고 따뜻한 사람이 ${userName} 님 결을 살려줍니다.`
    : weakest === '토'
    ? `${HAN_BY_OHENG[weakest]}(${KR_BY_OHENG[weakest]}) 일간. 안정과 실리에 강한 사람이 ${userName} 님 결을 받쳐줍니다.`
    : `${HAN_BY_OHENG[weakest]}(${KR_BY_OHENG[weakest]}) 일간. 자라남과 시작에 강한 사람이 ${userName} 님 결을 밀어줍니다.`;

  // 카드 2: 부딪히는 — strongest 오행 일간 (같은 결 과잉 또는 일간 충돌)
  const clashGan = GAN_BY_OHENG[strongest];
  const clashDesc = strongest === dayOheng
    ? `${HAN_BY_OHENG[strongest]}(${KR_BY_OHENG[strongest]}) 일간이 또 들어오면 같은 결이 겹쳐 ${userName} 님이 깎입니다. 적당한 거리가 좋습니다.`
    : `${HAN_BY_OHENG[strongest]}(${KR_BY_OHENG[strongest]}) 일간이 ${userName} 님 일간(${HAN_BY_OHENG[dayOheng]})과 결이 강하게 부딪힙니다. 큰 결정은 분리해서.`;

  // 카드 3: 마음이 놓이는 — 일간을 생하는 오행 (인성)
  const calmGan = GAN_BY_OHENG[calmer];
  const calmDesc = calmer === SANGSAENG_REV[dayOheng]
    ? `${HAN_BY_OHENG[calmer]}(${KR_BY_OHENG[calmer]}) 일간. ${userName} 님 일간 ${HAN_BY_OHENG[dayOheng]}을 받쳐주는 결로, 결정을 받아주고 기다려주는 사람입니다.`
    : `${HAN_BY_OHENG[calmer]}(${KR_BY_OHENG[calmer]}) 일간. ${userName} 님에게 꼭 필요한 기운을 북돋아 주는 사람이라, 함께 있으면 마음이 놓입니다.`;

  const cards = [
    { label: '힘이 되는 사람', glyph: `${boostGan[0]}, ${boostGan[1]}`, desc: boostDesc, color: '#4E7A57', bg: 'rgba(78,122,87,.06)' },
    { label: '부딪히는 사람', glyph: `${clashGan[0]}, ${clashGan[1]}`, desc: clashDesc, color: '#c62828', bg: 'rgba(198,40,40,.06)' },
    { label: '마음이 놓이는 사람', glyph: `${calmGan[0]}, ${calmGan[1]}`, desc: calmDesc, color: '#7F6B4E', bg: 'rgba(127,107,78,.06)' },
  ];

  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 13,
          fontWeight: 700,
          color: C.goldDeep,
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}
      >
        올해 인연의 결, 緣
      </div>
      <div style={{ fontSize: 11, color: C.mute, marginBottom: 10, lineHeight: 1.55 }}>
        주변 사람의 <strong style={{ color: C.ink }}>일간 천간(태어난 날의 글자)</strong>을 알면 {userName} 님과 어떤 결인지 한눈에 보입니다.
        {/* 2026-10-07 궁합 공개 — 특정 사람과의 관계는 궁합으로 연결 (09-17 lockdown 때 제거했던 안내 복구 · 가격 SSOT 1운) */}
        {' '}
        <button
          type="button"
          onClick={() => navigate('/compat')}
          style={{ color: C.goldDeep, fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', padding: 0, fontSize: 11, cursor: 'pointer' }}
        >
          특정 사람과는 궁합 보기(1운)
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {cards.map((c, i) => (
          <div
            key={i}
            style={{
              padding: '14px 10px 12px',
              background: c.bg,
              border: `1.5px solid ${c.color}40`,
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: c.color,
                letterSpacing: '0.05em',
                textAlign: 'center',
                background: `${c.color}14`,
                padding: '3px 6px',
                borderRadius: 100,
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 18,
                fontWeight: 800,
                color: c.color,
                textAlign: 'center',
                lineHeight: 1.1,
              }}
            >
              {c.glyph}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: c.color,
                textAlign: 'center',
                opacity: 0.85,
                marginTop: -3,
              }}
            >
              일간
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.55, textAlign: 'left', marginTop: 4 }}>
              {c.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 시기별 경고 카드 — 목업 v2 §6 ("9월 조심" 패턴) */
function MonthlyWarnings({ aiResult }: { aiResult: any }) {
  // AI 응답에 monthlyWarnings 또는 yearly 안에 cautions 있을 수 있음
  const aiWarnings: Array<{ month: string; title: string; desc: string }> =
    Array.isArray(aiResult?.monthlyWarnings)
      ? aiResult.monthlyWarnings.slice(0, 3)
      : [];

  if (aiWarnings.length === 0) {
    // fallback 생략 — AI 응답이 없으면 표시 안 함 (글자수 노출 방지 + over-fit 방지)
    return null;
  }

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#9C2424',
          margin: '0 0 4px',
          letterSpacing: '0.02em',
        }}
      >
        시기별로 조심할 자리
      </h4>
      {aiWarnings.map((w, i) => (
        <div
          key={i}
          style={{
            background: '#FFF4F0',
            border: '1px solid #F4C8C8',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#9C2424',
                background: '#FBE5E5',
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {w.month}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#9C2424' }}>
              {stripMd(w.title)}
            </span>
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: C.inkSoft,
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {stripMd(w.desc)}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─────────── 기존 컴포넌트 ─────────── */

/* mockup .section-conclusion 진본 — className 만 사용 */
function SectionConclusion({
  label = '이 섹션의 결론',
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  // children 이 string 인 경우 — 줄바꿈/번호 패턴 자동 인식 + sc-num 적용 (mockup 진본 형식)
  if (typeof children === 'string') {
    const text = children.trim();
    // ①②③ 또는 줄바꿈 + → 패턴 split
    const arrowSplit = text.split(/\n\s*→\s*/).map((s) => s.trim()).filter(Boolean);
    const numSplit = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (arrowSplit.length >= 2) {
      // → 패턴 (mockup §4 결론)
      const lead = arrowSplit[0];
      return (
        <div className="section-conclusion">
          <div className="sc-label">{label}</div>
          {!/^→/.test(lead) && lead.length < 250 && (
            <p dangerouslySetInnerHTML={{ __html: lead }} />
          )}
          {arrowSplit.slice(/^→/.test(lead) || lead.length >= 250 ? 0 : 1).map((s, i) => (
            <p key={i} className="sc-row" dangerouslySetInnerHTML={{ __html: '→ ' + s.replace(/^→\s*/, '') }} />
          ))}
        </div>
      );
    }
    if (numSplit.length >= 2) {
      // ① ② ③ 패턴 (mockup §2 결론)
      return (
        <div className="section-conclusion">
          <div className="sc-label">{label}</div>
          {numSplit.map((s, i) => {
            const nums = ['①', '②', '③', '④', '⑤'];
            const stripped = s.replace(/^[①②③④⑤]\s*/, '');
            return (
              <p key={i}>
                <span className="sc-num">{nums[i] || ', '}</span>
                <span dangerouslySetInnerHTML={{ __html: stripped }} />
              </p>
            );
          })}
        </div>
      );
    }
    // 한 문단 — 그냥 표시
    return (
      <div className="section-conclusion">
        <div className="sc-label">{label}</div>
        <p dangerouslySetInnerHTML={{ __html: text }} />
      </div>
    );
  }
  return (
    <div className="section-conclusion">
      <div className="sc-label">{label}</div>
      <p>{children}</p>
    </div>
  );
}

/* mockup .pullquote 진본 — string 일 때 <strong> 살리도록 sanitize + dangerouslySetInnerHTML */
function PremiumPullQuote({ children }: { children: ReactNode }) {
  if (typeof children === 'string') {
    return (
      <div className="pullquote">
        <p dangerouslySetInnerHTML={{ __html: sanitizeAiText(children) }} />
      </div>
    );
  }
  return (
    <div className="pullquote">
      <p>{children}</p>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════
 * 2026-05-05 §08 신규 — LifeKeywordHero + StrengthsCautionsCards
 *  · 관계의 결 (六親) 대체 — 본인 사주 통합 메타 (모든 사람에게 의미)
 *  · AI schema: lifeKeyword (한 줄) + strengths[3] + cautions[3]
 * ═════════════════════════════════════════════════════════════════ */

/**
 * §08 fallback 키워드 동적 composer (2026-05-05 준기 재재지시 — 보일러플레이트 절대 금지)
 *  - 같은 top·bot sipsung 이라도 일간 글자·계절·강약비율마다 다른 한 줄 출력
 *  - 다축 조합: top sipsung × top 개수 × bot sipsung × dayOheng × dayGan 글자 = 1000+ variation
 *  - 핵심 룰: 사주 8글자 중 가장 두드러진 글자(일간 천간) 직접 호명 → §01 dup 회피 + 개인화
 */
const SIP_TOP_FRAME: Record<keyof SipDist, { strong: string; gift: string }> = {
  비겁: { strong: '자기 결이 또렷하고 추진력 있는', gift: '자기 길을 끝까지 가는 결단력' },
  식상: { strong: '표현이 풍부하고 색깔이 분명한', gift: '본인 결을 자연스럽게 풀어내는 재능' },
  재성: { strong: '현실 감각이 또렷하고 실리에 밝은', gift: '결과까지 손에 잡히는 형태로 챙기는 힘' },
  관성: { strong: '책임감이 또렷하고 끝까지 가는', gift: '맡은 일을 신뢰감 있게 마무리하는 결' },
  인성: { strong: '안에 깊이 모으는 사색이 풍부한', gift: '한 번 본 것을 통찰로 쌓아 올리는 깊이' },
};

const SIP_BOT_GROW: Record<keyof SipDist, string> = {
  비겁: '본인 중심을 한 번씩 다지는 시간',
  식상: '한 줄씩 밖으로 풀어내는 표현 습관',
  재성: '결과로 옮기는 다리(돈, 지표, 마감)',
  관성: '책임과 체계를 받아들이는 한 자리',
  인성: '안에 모으고 배우는 시간',
};

const OHENG_PERSONA: Record<OhengType, string> = {
  목: '뻗어나가는 가지처럼',
  화: '환히 비추는 햇빛처럼',
  토: '흐름을 품어 안는 땅처럼',
  금: '단단히 다듬는 칼끝처럼',
  수: '깊이 흘러가는 물처럼',
};

const GAN_KO: Record<string, { ko: string; vibe: string }> = {
  甲: { ko: '갑목', vibe: '큰 나무처럼 곧게 자라는' },
  乙: { ko: '을목', vibe: '풀잎처럼 부드럽게 휘어지는' },
  丙: { ko: '병화', vibe: '한낮의 태양처럼 환한' },
  丁: { ko: '정화', vibe: '은은한 등불처럼 따뜻한' },
  戊: { ko: '무토', vibe: '큰 산처럼 든든한' },
  己: { ko: '기토', vibe: '기름진 밭흙처럼 포근한' },
  庚: { ko: '경금', vibe: '날 선 칼처럼 명확한' },
  辛: { ko: '신금', vibe: '잘 다듬은 보석처럼 정갈한' },
  壬: { ko: '임수', vibe: '큰 강처럼 깊게 흐르는' },
  癸: { ko: '계수', vibe: '맑은 빗물처럼 섬세한' },
};

function deriveLifeKeyword(sipDist?: SipDist, dayOheng?: OhengType, sajuData?: SajuData): string {
  if (!sipDist) return '<strong>본인의 결을 천천히 다지는 사람</strong>이에요.';

  const entries = Object.entries(sipDist) as Array<[keyof SipDist, number]>;
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[0];
  const topCount = sorted[0]?.[1] ?? 0;
  const bot = sorted[sorted.length - 1]?.[0];
  const botCount = sorted[sorted.length - 1]?.[1] ?? 0;

  // 일주 천간 (사주 8글자 중 가장 핵심 글자) — 직접 호명 → 개인화
  const dayGan = sajuData?.pillars?.[2]?.천간 as string | undefined;
  const ganMeta = dayGan && GAN_KO[dayGan] ? GAN_KO[dayGan] : null;
  const persona = dayOheng ? OHENG_PERSONA[dayOheng] : '본인 결을 천천히 다지는 자리에서';

  // 균형형 (top===bot 수 차이 적음)
  if (!top || !bot || top === bot || topCount - botCount <= 1) {
    const head = ganMeta
      ? `<b>${ganMeta.ko}(${dayGan})</b> 일간으로, ${ganMeta.vibe} <strong>균형 잡힌 결</strong>의 사주예요`
      : `<strong>어느 한쪽으로 치우치지 않은 균형 잡힌 결</strong>이에요`;
    return `${head}. ${persona} 상황에 맞춰 풀어가며, 본인만의 리듬으로 천천히 자기 자리를 다지는 사람입니다.`;
  }

  // 동적 조합 — top frame + bot grow + persona + gan reference
  const topFrame = SIP_TOP_FRAME[top];
  const grow = SIP_BOT_GROW[bot];

  // 1순위: dayGan 글자 호명 + 개수 명시 + tension 결합
  if (ganMeta) {
    return [
      `<b>${ganMeta.ko}(${dayGan})</b> 일간이 <u>${top} ${topCount}개</u>를 품은, <strong>${topFrame.strong} 사람</strong>이에요.`,
      `${ganMeta.vibe} 결로 ${topFrame.gift}이 또렷한데, ${grow}을 곁에 두면 ${persona} 깊이와 폭이 둘 다 살아나는 강한 사주입니다.`,
    ].join(' ');
  }

  // 2순위 (dayGan 없을 때): dayOheng + sipsung 개수
  return [
    `<u>${top} ${topCount}개</u>가 중심을 잡은, <strong>${topFrame.strong} 사람</strong>이에요.`,
    `${persona} ${topFrame.gift}이 살아 있는 결입니다. ${grow}을 더하면 더 단단해지는 사주예요.`,
  ].join(' ');
}

function LifeKeywordHero({
  aiResult,
  userName,
  sipDist,
  dayOheng,
  sajuData,
}: {
  aiResult: any;
  userName: string;
  sipDist?: SipDist;
  dayOheng?: OhengType;
  sajuData?: SajuData;
}) {
  const keyword = typeof aiResult?.lifeKeyword === 'string' ? sanitizeAiText(aiResult.lifeKeyword) : '';
  // 🚨 fallback (2026-05-05 v3 준기 재지시 — 보일러플레이트 절대 금지)
  // top·bot sipsung × dayOheng × dayGan 글자 다축 조합으로 1000+ variation 생성
  const derived = deriveLifeKeyword(sipDist, dayOheng, sajuData);
  const text = keyword || derived || `${userName} 님의 사주는 <strong>본인의 결을 천천히 다지는 사람</strong>이에요.`;
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #FFFEF8 0%, #FBF5E8 100%)',
        border: '1.5px solid rgba(184,150,90,0.40)',
        borderRadius: 16,
        padding: '20px 18px',
        marginBottom: 18,
        marginTop: 14,
        boxShadow: '0 4px 16px rgba(184,150,90,0.10)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -10,
          top: -10,
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 80,
          fontWeight: 900,
          color: 'rgba(184,150,90,0.07)',
          lineHeight: 1,
          pointerEvents: 'none',
          letterSpacing: '-0.05em',
        }}
      >
        本質
      </div>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 11,
          fontWeight: 700,
          color: '#8C6D3D',
          letterSpacing: '0.08em',
          marginBottom: 6,
          position: 'relative',
        }}
      >
        ◇ {userName} 님의 인생 한 줄
      </div>
      <p
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 17,
          fontWeight: 700,
          color: '#1A1A1A',
          lineHeight: 1.55,
          letterSpacing: '-0.01em',
          margin: 0,
          position: 'relative',
        }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}

interface StrengthCautionItem { title?: string; desc?: string }

/**
 * §08 강점·함정 동적 composer (2026-05-05 v3 준기 — 보일러플레이트 금지)
 *  - 다축 조합: top1/top2 sipsung × 개수 × dayOheng × dayGan = 변수마다 다른 출력
 *  - 강점 desc 에 사주 8글자 직접 호명 (개수·일간 글자) → 개인화
 *  - 함정 desc 도 약점 십성 + 강점 과잉 그림자 동적 결합
 */
function deriveStrengthsCautions(
  sipDist?: SipDist,
  dayOheng?: OhengType,
  sajuData?: SajuData,
): { strengths: StrengthCautionItem[]; cautions: StrengthCautionItem[] } {
  if (!sipDist) return { strengths: [], cautions: [] };
  const entries = Object.entries(sipDist) as Array<[keyof SipDist, number]>;
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const top1 = sorted[0]?.[0];
  const top1Count = sorted[0]?.[1] ?? 0;
  const top2 = sorted[1]?.[0];
  const top2Count = sorted[1]?.[1] ?? 0;
  const bot1 = sorted[sorted.length - 1]?.[0];
  const bot2 = sorted[sorted.length - 2]?.[0];

  const dayGan = sajuData?.pillars?.[2]?.천간 as string | undefined;
  const ganMeta = dayGan && GAN_KO[dayGan] ? GAN_KO[dayGan] : null;
  const ganRef = ganMeta ? `<b>${ganMeta.ko}(${dayGan})</b> 일간` : '본인 일간';

  // 개수에 따른 강도 어휘 — 동적 강도 표현 (1·2개=은은한, 3개=또렷한, 4개+=뚜렷한)
  const grade = (n: number) => (n >= 4 ? '뚜렷한' : n >= 3 ? '또렷한' : n >= 2 ? '단단한' : '은은한');

  // 강점 templates — 개수·gan 글자 호명으로 매번 다른 문장
  const strengthTemplate: Record<keyof SipDist, (count: number) => StrengthCautionItem> = {
    비겁: (n) => ({
      title: '결단력',
      desc: `${ganRef}에 <u>비겁 ${n}개</u>가 받쳐주는 ${grade(n)} 추진력입니다. <strong>한번 정한 길은 끝까지 밀어붙이는 결</strong>이라, 주변이 자연스럽게 따라옵니다.`,
    }),
    식상: (n) => ({
      title: '표현과 창의',
      desc: `${ganRef}이 <u>식상 ${n}개</u>로 풀어내는 ${grade(n)} 표현력이에요. <strong>본인 색을 자연스럽게 드러내는 결</strong>이라, 같은 일도 당신만의 톤으로 옮겨집니다.`,
    }),
    재성: (n) => ({
      title: '현실 감각',
      desc: `${ganRef}이 <u>재성 ${n}개</u>로 받는 ${grade(n)} 실리 감각입니다. <strong>큰 그림보다 손에 잡히는 결과로 증명하는 결</strong>이에요.`,
    }),
    관성: (n) => ({
      title: '책임감',
      desc: `${ganRef}이 <u>관성 ${n}개</u>를 품은 ${grade(n)} 책임감이에요. <strong>맡은 일을 끝까지 가져가는 결</strong>이라, 어려운 일이 자연스럽게 당신에게 옵니다.`,
    }),
    인성: (n) => ({
      title: '깊이 있는 통찰',
      desc: `${ganRef}이 <u>인성 ${n}개</u>로 받쳐주는 ${grade(n)} 사색의 깊이입니다. <strong>안에 모았다가 풀어내는 긴 호흡의 사고</strong>예요.`,
    }),
  };

  const cautionTemplate: Record<keyof SipDist, () => StrengthCautionItem> = {
    비겁: () => ({
      title: '주변 흘려듣기',
      desc: `자기 결이 너무 분명해 <strong>주변 의견을 흘려듣는 순간</strong>이 있어요. 큰 결정 전 ${ganMeta ? '가까운 한 사람' : '신뢰하는 한 사람'}에게 한 번 더 물어보는 습관이 약점을 메워줍니다.`,
    }),
    식상: () => ({
      title: '표현 앞서감',
      desc: `생각보다 표현이 빨라 <strong>말이 먼저 나가는 순간</strong>이 있습니다. 중요한 자리에서는 한 박자 늦춰 ${ganMeta ? `${ganMeta.ko} 결답게` : '본인답게'} 정리한 뒤 말하면 무게가 실립니다.`,
    }),
    재성: () => ({
      title: '결과 조급',
      desc: `결과를 빨리 보려다 <strong>과정을 깎아먹는 패턴</strong>이 있어요. ${ganMeta ? `${ganMeta.ko}` : '본인'} 사주의 천천히 쌓는 시기를 의식적으로 두면, 결과의 크기가 달라집니다.`,
    }),
    관성: () => ({
      title: '과부하',
      desc: `책임을 다 떠안다 <strong>혼자 무너지는 순간</strong>이 옵니다. ${ganMeta ? `${ganMeta.ko} 일간` : '당신'}답게 거절하는 연습이 약점을 강점으로 바꿉니다.`,
    }),
    인성: () => ({
      title: '실행 지연',
      desc: `깊이 모으느라 <strong>실행이 늦어지는 패턴</strong>이 반복됩니다. ${ganMeta ? `${ganMeta.ko}` : '본인'} 사주는 70% 준비되면 일단 첫발을 내딛는 게 결을 살리는 길이에요.`,
    }),
  };

  const strengths: StrengthCautionItem[] = [];
  if (top1) strengths.push(strengthTemplate[top1](top1Count));
  if (top2 && top2 !== top1 && top2Count > 0) strengths.push(strengthTemplate[top2](top2Count));

  // 3번째 강점 — dayOheng + dayGan 글자로 동적 (sipsung 매트릭스 dup 회피)
  if (dayOheng && strengths.length < 3) {
    const ohengStrength: Record<OhengType, StrengthCautionItem> = {
      목: { title: '성장 의지', desc: `${ganRef}의 뻗어나가려는 <strong>본능적 추진력</strong>이 있어요. 한 자리에 머무는 것보다 새 자리를 여는 결입니다.` },
      화: { title: '밝은 에너지', desc: `${ganRef}이 주변을 <strong>환하게 만드는 결</strong>이에요. 사람들이 당신 옆에서 기운을 얻습니다.` },
      토: { title: '안정감', desc: `${ganRef}이 주변에 <strong>믿고 기댈 수 있는 결</strong>을 만듭니다. 흔들리는 사람들에게 중심이 되는 사람이에요.` },
      금: { title: '정돈된 결', desc: `${ganRef} 특유의 <strong>깔끔하고 또렷한 결</strong>이 있어요. 디테일에서 신뢰를 얻는 사주입니다.` },
      수: { title: '깊은 사고', desc: `${ganRef}이 만드는 <strong>안에서 흘러가는 깊이</strong>가 있어요. 한 번 판단한 것은 쉽게 흔들리지 않습니다.` },
    };
    strengths.push(ohengStrength[dayOheng]);
  }

  const cautions: StrengthCautionItem[] = [];
  if (bot1) cautions.push(cautionTemplate[bot1]());
  if (bot2 && bot2 !== bot1) cautions.push(cautionTemplate[bot2]());
  // 강점 과잉 그림자 — top1 의 다른 면
  if (top1 && cautions.length < 3) cautions.push(cautionTemplate[top1]());

  return {
    strengths: strengths.slice(0, 3),
    cautions: cautions.slice(0, 3),
  };
}

function StrengthsCautionsCards({
  aiResult,
  sipDist,
  dayOheng,
  sajuData,
}: {
  aiResult: any;
  sipDist?: SipDist;
  dayOheng?: OhengType;
  sajuData?: SajuData;
}) {
  const aiStrengths: StrengthCautionItem[] = Array.isArray(aiResult?.strengths)
    ? aiResult.strengths.slice(0, 3).filter((s: any) => s?.title && s?.desc)
    : [];
  const aiCautions: StrengthCautionItem[] = Array.isArray(aiResult?.cautions)
    ? aiResult.cautions.slice(0, 3).filter((s: any) => s?.title && s?.desc)
    : [];
  // AI 응답 없으면 다축 동적 fallback (sipDist + 개수 + dayOheng + dayGan 글자 직접 호명)
  const fallback = (aiStrengths.length === 0 && aiCautions.length === 0)
    ? deriveStrengthsCautions(sipDist, dayOheng, sajuData)
    : { strengths: [] as StrengthCautionItem[], cautions: [] as StrengthCautionItem[] };
  const strengths = aiStrengths.length > 0 ? aiStrengths : fallback.strengths;
  const cautions = aiCautions.length > 0 ? aiCautions : fallback.cautions;
  if (strengths.length === 0 && cautions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 강점 3 카드 */}
      {strengths.length > 0 && (
        <div>
          <div
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 13,
              fontWeight: 800,
              color: '#355A3E',
              letterSpacing: '0.04em',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(78,122,87,0.10)',
                color: '#355A3E',
                letterSpacing: '0.06em',
              }}
            >
              長, 강점
            </span>
            <span style={{ color: '#3D3D3D', fontWeight: 600 }}>당신이 타고난 진짜 결</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {strengths.map((s, i) => (
              <div
                key={`s-${i}`}
                style={{
                  // 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). 그린 톤 배경만 유지.
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F8F2 100%)',
                  border: '1px solid rgba(78,122,87,0.30)',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 14.5,
                    fontWeight: 800,
                    color: '#1A1A1A',
                    marginBottom: 4,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {sanitizeAiText(s.title || '')}
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    color: '#3D3D3D',
                    lineHeight: 1.65,
                    margin: 0,
                    wordBreak: 'keep-all',
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeAiText(s.desc || '') }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 함정 3 카드 */}
      {cautions.length > 0 && (
        <div>
          <div
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 13,
              fontWeight: 800,
              color: '#8B1A1A',
              letterSpacing: '0.04em',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(198,40,40,0.10)',
                color: '#8B1A1A',
                letterSpacing: '0.06em',
              }}
            >
              短, 함정
            </span>
            <span style={{ color: '#3D3D3D', fontWeight: 600 }}>의식적으로 다뤄야 할 패턴</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cautions.map((c, i) => (
              <div
                key={`c-${i}`}
                style={{
                  // 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). 레드 톤 배경만 유지.
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #FCF3F3 100%)',
                  border: '1px solid rgba(198,40,40,0.25)',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 14.5,
                    fontWeight: 800,
                    color: '#1A1A1A',
                    marginBottom: 4,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {sanitizeAiText(c.title || '')}
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    color: '#3D3D3D',
                    lineHeight: 1.65,
                    margin: 0,
                    wordBreak: 'keep-all',
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeAiText(c.desc || '') }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PillarMessages({
  aiResult,
  v4Pillars,
}: {
  aiResult: any;
  v4Pillars: V4Pillar[];
}) {
  const msgs: Record<string, string> = aiResult?.pillarMessages ?? {};
  const keys = ['time', 'day', 'month', 'year']; // v4Pillars 순서: 시→일→월→년
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {v4Pillars.map((p, i) => {
        const m = msgs[keys[i]];
        if (!m) return null;
        return (
          <div
            key={i}
            style={{
              // 2026-05-28 — 좌측 strip 제거 (균일 list 안 AI 손톱 디자인 티). 골드 톤 배경만 유지.
              padding: '10px 14px',
              background: C.goldSoft,
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.goldDeep,
                marginBottom: 3,
              }}
            >
              {p.label}
            </div>
            <p
              style={{
                fontSize: 13,
                color: C.ink,
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {stripMd(m)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** AI sipCluster — 5 클러스터(비겁/식상/재성/관성/인성) 별 사주 specific 본문 + 카드 */
interface AiSipClusterCard { name?: string; hanja?: string; from?: string; desc?: string; strength?: number }
interface AiSipCluster {
  비겁?: { head?: string; cards?: AiSipClusterCard[] };
  식상?: { head?: string; cards?: AiSipClusterCard[] };
  재성?: { head?: string; cards?: AiSipClusterCard[] };
  관성?: { head?: string; cards?: AiSipClusterCard[] };
  인성?: { head?: string; cards?: AiSipClusterCard[] };
}
function SipClusterDetails({ aiCluster, sajuData }: { aiCluster?: AiSipCluster; sajuData?: SajuData }) {
  // mockup §3 sip-cluster 진본 — head ("食 傷 · 표현하고 산출하는 결") + sipseong-grid (2 col) + sip-card (strength dots 5 + s-label)
  const CLUSTER_META: Record<keyof AiSipCluster, { headHanja: string; tagline: string }> = {
    식상: { headHanja: '食 傷', tagline: '표현하고 산출하는 결' },
    비겁: { headHanja: '比 劫', tagline: '자기를 지키는 결' },
    재성: { headHanja: '財 星', tagline: '갖추는 결' },
    관성: { headHanja: '官 星', tagline: '평가받고 책임지는 결' },
    인성: { headHanja: '印 星', tagline: '받아들이고 익히는 결' },
  };
  const ORDER: Array<keyof AiSipCluster> = ['식상', '비겁', '재성', '관성', '인성'];

  // AI 가 채우지 않았을 때 — 사주 8글자에서 직접 십성 카드 도출 (fallback)
  // 명리학 정확도:
  //  · 같은 십성은 1 카드로 그룹핑 (정관 4자 → 카드 1개에 "월간 壬·일지 亥·시지 亥" 묶음)
  //  · 강도 = 위치별 가중치 합 / 5 (월지 +3 · 일지 +2 · 시지/년지/월간/시간 +1.5 · 년간 +1 · 천간 -0.3)
  //  · 같은 글자 자수 + 위치 가중치 → 정확한 강도 (1~5)
  function buildFallbackCluster(): AiSipCluster {
    if (!sajuData) return {};
    const dayOh = (sajuData.pillars[2]?.천간오행 ?? '토') as OhengType;
    const dayYY = sajuData.pillars[2]?.천간음양 || '양';
    const SS: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
    const SG: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
    function getSipsungOf(targetOh: OhengType, targetYY: string): { name: string; hanja: string; cluster: keyof AiSipCluster } {
      const same = targetYY === dayYY;
      if (targetOh === dayOh) return same ? { name: '비견', hanja: '比肩', cluster: '비겁' } : { name: '겁재', hanja: '劫財', cluster: '비겁' };
      if (SS[dayOh] === targetOh) return same ? { name: '식신', hanja: '食神', cluster: '식상' } : { name: '상관', hanja: '傷官', cluster: '식상' };
      if (SG[dayOh] === targetOh) return same ? { name: '편재', hanja: '偏財', cluster: '재성' } : { name: '정재', hanja: '正財', cluster: '재성' };
      if (SG[targetOh] === dayOh) return same ? { name: '편관', hanja: '偏官', cluster: '관성' } : { name: '정관', hanja: '正官', cluster: '관성' };
      if (SS[targetOh] === dayOh) return same ? { name: '편인', hanja: '偏印', cluster: '인성' } : { name: '정인', hanja: '正印', cluster: '인성' };
      return { name: '—', hanja: '—', cluster: '비겁' };
    }
    // 위치별 가중치 (명리학 정통: 월지>일지>시지/년지>월간/시간>년간; 천간보다 지지가 강함)
    const POS_WEIGHT_GAN: Record<number, number> = { 0: 1.0, 1: 1.5, 2: 0, 3: 1.5 }; // [년·월·일·시] / 일간 본인=0
    const POS_WEIGHT_ZHI: Record<number, number> = { 0: 1.5, 1: 3.0, 2: 2.0, 3: 1.5 }; // [년지·월지·일지·시지]
    const POS_GAN = ['연간', '월간', '일간', '시간'];
    const POS_ZHI = ['연지', '월지', '일지', '시지'];
    const SIP_DESC: Record<string, string> = {
      비견: '<strong>같은 결의 자리</strong>. 자기 결을 지키는 힘이자 동지가 되는 결.',
      겁재: '<strong>경쟁과 재물의 이탈</strong>로 이어지는 자리. 동업과 금전 거래에서 특히 주의.',
      식신: '<strong>지속, 전문성, 꾸준한 산출</strong>. 한 분야를 길게 파고드는 힘.',
      상관: '<strong>창의, 표현, 말의 힘</strong>. 위계 안에서는 종종 오해를 사기도.',
      편재: '<strong>큰 흐름의 재물</strong>. 사업, 투자, 유동 자산의 결.',
      정재: '<strong>꾸준한 수익과 내 사람과 약속</strong>. 가까이 자리해 든든하지만 무리하기 쉬움.',
      편관: '<strong>강한 압력과 돌발 책임</strong>. 큰일을 떠맡는 자리. 절제하면 추진력.',
      정관: '<strong>또렷한 규율, 체면, 평가</strong>. 타인이 평가하는 자리에 약간 예민한 편.',
      편인: '<strong>직관, 상상, 외부 지식</strong>. 책, 여행, 낯선 대화에서 영감.',
      정인: '<strong>학문, 돌봄, 받아들이는 결</strong>. 어머니와 전통적 학습과 인연이 깊음.',
    };
    // 1단계: 모든 글자 → 십성 + 위치 + 가중치 수집
    interface Found { sd: ReturnType<typeof getSipsungOf>; from: string; weight: number }
    const found: Found[] = [];
    sajuData.pillars.forEach((p, i) => {
      if (!p.available) return;
      if (i !== 2 && p.천간 && p.천간오행) {
        found.push({
          sd: getSipsungOf(p.천간오행 as OhengType, p.천간음양 || '양'),
          from: `${POS_GAN[i]} ${p.천간}(${p.천간읽기 || ''})`,
          weight: POS_WEIGHT_GAN[i] || 1,
        });
      }
      if (p.지지 && p.지지오행) {
        found.push({
          sd: getSipsungOf(p.지지오행 as OhengType, p.지지음양 || '양'),
          from: `${POS_ZHI[i]} ${p.지지}(${p.지지읽기 || ''})`,
          weight: POS_WEIGHT_ZHI[i] || 1,
        });
      }
    });
    // 2단계: 같은 십성(name) 그룹핑 → cluster 별 카드
    const result: AiSipCluster = {};
    const groupedByName: Record<string, { cluster: keyof AiSipCluster; hanja: string; froms: string[]; totalWeight: number }> = {};
    for (const f of found) {
      const key = f.sd.name;
      if (!groupedByName[key]) {
        groupedByName[key] = { cluster: f.sd.cluster, hanja: f.sd.hanja, froms: [], totalWeight: 0 };
      }
      groupedByName[key].froms.push(f.from);
      groupedByName[key].totalWeight += f.weight;
    }
    // 3단계: 각 그룹 → cluster 카드. strength = totalWeight 를 1~5 로 매핑
    //   monthZhi 1자만으로 weight 3 → strength 4
    //   여러 자리 누적 → 5
    //   year 만 weight 1.5 → strength 2
    //   매우 약한 1.0 → strength 1
    function weightToStrength(w: number): number {
      if (w >= 5) return 5;
      if (w >= 3.5) return 4;
      if (w >= 2) return 3;
      if (w >= 1.2) return 2;
      return 1;
    }
    Object.entries(groupedByName).forEach(([name, g]) => {
      const c = result[g.cluster] ?? { head: '', cards: [] };
      c.cards = c.cards || [];
      const fromList = g.froms.length > 1
        ? g.froms.join(', ')
        : g.froms[0];
      c.cards.push({
        name,
        hanja: g.hanja,
        from: fromList,
        desc: SIP_DESC[name] || '',
        strength: weightToStrength(g.totalWeight),
      });
      result[g.cluster] = c;
    });
    // 정렬: strength 내림차순
    (Object.keys(result) as Array<keyof AiSipCluster>).forEach((k) => {
      const c = result[k];
      if (!c?.cards) return;
      c.cards.sort((a, b) => Number(b.strength ?? 0) - Number(a.strength ?? 0));
    });
    return result;
  }

  const cluster = aiCluster && Object.keys(aiCluster).length > 0
    ? aiCluster
    : buildFallbackCluster();
  const items = ORDER
    .map((key) => ({ key, ...CLUSTER_META[key], data: cluster[key] }))
    .filter((it) => it.data?.head?.trim() || (Array.isArray(it.data?.cards) && it.data!.cards!.length > 0));
  if (items.length === 0) return null;

  function strengthLabel(s: number): string {
    if (s >= 5) return '매우 강함';
    if (s >= 4) return '강함';
    if (s >= 3) return '중상';
    if (s >= 2) return '약';
    return '미약';
  }

  return (
    <>
      {items.map((it) => (
        <div key={it.key} className="sip-cluster">
          <div className="sip-cluster-head">{it.headHanja}, {it.tagline}</div>
          {it.data?.head && (
            <p style={{ fontSize: 13, color: '#2a2520', lineHeight: 1.7, margin: '0 0 8px', wordBreak: 'keep-all' }}>
              {stripMd(String(it.data.head))}
            </p>
          )}
          {Array.isArray(it.data?.cards) && it.data!.cards!.length > 0 && (
            <div className="sipseong-grid">
              {it.data!.cards!.slice(0, 4).map((c, i) => {
                const s = Math.min(5, Math.max(0, Number(c.strength ?? 3)));
                return (
                  <div key={i} className="sip-card">
                    <div className="top">
                      <span className="name">{c.name}</span>
                      <span className="han">{c.hanja || ''}</span>
                    </div>
                    <div className="desc">
                      {c.from ? <strong>{c.from}. </strong> : null}
                      {c.desc}
                    </div>
                    <div className="strength">
                      {[0, 1, 2, 3, 4].map((i2) => (
                        <span key={i2} className={i2 < s ? 'on' : undefined} />
                      ))}
                    </div>
                    <div className="s-label">강도 {s} / 5, {strengthLabel(s)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function SipsungStory({
  aiResult,
  sipDist,
}: {
  aiResult: any;
  sipDist: SipDist;
}) {
  const aiStory = aiResult?.sipsungStory ?? aiResult?.sections?.find((s: any) => s.id === 'sipsung')?.content;
  const top = (Object.entries(sipDist) as [keyof SipDist, number][])
    .sort((a, b) => b[1] - a[1])[0];
  if (typeof aiStory === 'string' && aiStory.length > 0) {
    // <strong> 태그 강조 렌더 (AI 가 핵심 키워드에 <strong> 사용)
    return (
      <p
        style={{
          fontSize: 14,
          color: C.ink,
          lineHeight: 1.75,
          margin: 0,
          whiteSpace: 'pre-line',
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeAiText(autoEmphasize(aiStory)) }}
      />
    );
  }
  if (!top) return null;
  return (
    <div
      style={{
        padding: '12px 14px',
        background: C.goldSoft,
        borderRadius: 10,
        marginTop: 4,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.goldDeep,
          margin: '0 0 4px',
        }}
      >
        가장 짙은 영역
      </p>
      <p
        style={{
          fontSize: 13.5,
          color: C.ink,
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        <strong>{top[0]}</strong>, {SIP_STORY[top[0]]}
      </p>
    </div>
  );
}

/* mockup §5 .daewoon-timeline 진본 — 8 cells (gan/ji/age/label) */
function DaeunTimeline({ v4Daeun }: { v4Daeun: V4Daeun[] }) {
  const labels = ['유년', '학창', '진출', '현재', '전환', '결실', '정리', '관조'];
  return (
    <div className="daewoon-timeline" role="img" aria-label="대운 10년 단위 타임라인">
      <div className="daewoon-row">
        {v4Daeun.map((d, i) => {
          const isNow = d.current;
          const gan = d.gz?.[0] || '';
          const ji = d.gz?.[1] || '';
          return (
            <div key={i} className={`dw-cell${isNow ? ' now' : ''}`}>
              <div className="age">{d.age}</div>
              <div className="gan">{gan}</div>
              <div className="ji">{ji}</div>
              <div className="label">{labels[i] || ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearlyForecast({
  aiResult,
  dayOheng,
}: {
  aiResult: any;
  dayOheng: OhengType;
}) {
  const aiYearly = aiResult?.yearly ?? aiResult?.sections?.find(
    (s: any) => s.id === 'year2026' || s.id === 'yearly',
  )?.content;
  const thisYear = new Date().getFullYear();
  // 60갑자 — 1984년 갑자(甲子) 기준
  const SIXTY = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
    '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
    '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
    '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
    '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
    '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];
  const HAN_KR: Record<string, string> = {
    甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기',
    庚: '경', 辛: '신', 壬: '임', 癸: '계',
    子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
    午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
  };
  const yearGz = SIXTY[(thisYear - 1984 + 6000) % 60];
  const yearKr = (HAN_KR[yearGz[0]] || '') + (HAN_KR[yearGz[1]] || '');

  const baseText =
    typeof aiYearly === 'string' && aiYearly.length > 0
      ? sanitizeAiText(autoEmphasize(aiYearly))
      : `올해 ${thisYear}년은 ${yearKr}(${yearGz}) 해입니다. ${EHAN[OHENG_TO_ELEM[dayOheng]]}(${EKR[OHENG_TO_ELEM[dayOheng]]}) 일간을 기준으로 한 흐름이 12개월에 걸쳐 어떻게 작동하는지 아래에서 한 달씩 따라가세요.`;
  void dayOheng;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
      {/* 2026-05-04 fix: AI 가 보낸 <strong> 태그 raw text 노출 → dangerouslySetInnerHTML 통일 */}
      <p
        style={{
          fontSize: 14,
          color: C.ink,
          lineHeight: 1.75,
          margin: 0,
          whiteSpace: 'pre-line',
          wordBreak: 'keep-all',
        }}
        dangerouslySetInnerHTML={{ __html: baseText }}
      />
    </div>
  );
}


/**
 * 사주별 동적 7-건 액션 생성 (PracticeChecklist fallback)
 *
 * 입력: sajuData (오행/지장간/대운/일간), sipDist (5 클러스터 카운트)
 * 출력: 7-건 Action 배열 — 사주 분포에 따라 다른 카피
 *
 * 분기:
 *  1. 가장 약한 오행 보강 액션 (오행별 5 case)
 *  2. 가장 두꺼운 오행 절제 액션 (오행별 5 case)
 *  3. sipDist 약점 보강 (관성 0 / 비겁 0 / 재성 0 / 식상 0 / 인성 0 분기)
 *  4. sipDist 강점 활용 (가장 두꺼운 십성 살리기)
 *  5. 일간 오행별 라이프스타일 액션 (목/화/토/금/수)
 *  6. 가까운 대운 변곡점 준비
 *  7. 신살 기반 액션 (도화/문창/역마/괴강 등 핵심 신살 2~3개)
 */
function buildDynamicActions(sajuData?: SajuData, sipDist?: any): Array<{ title: string; desc: string }> {
  if (!sajuData) {
    // sajuData 없으면 (불가능에 가깝지만) 안전 fallback
    return [
      { title: '사주 데이터를 다시 불러오는 중', desc: '잠시 후 새로고침 해 주세요.' },
    ];
  }

  const elements = (sajuData.elements || {}) as Record<OhengType, number>;
  const dayOheng = (sajuData.pillars?.[2]?.천간오행 || '토') as OhengType;
  const dayGan = sajuData.pillars?.[2]?.천간 || '';
  const dayGanKr = sajuData.pillars?.[2]?.천간읽기 || '';
  const dayGanLabel = dayGan && dayGanKr ? `${dayGan}(${dayGanKr})` : dayGan;

  // 가장 두꺼운/얇은 오행
  const sortedByCount = (['목', '화', '토', '금', '수'] as OhengType[])
    .map((k) => ({ k, n: Number(elements[k] ?? 0) }))
    .sort((a, b) => b.n - a.n);
  const strongest = sortedByCount[0];
  const weakest = sortedByCount[sortedByCount.length - 1];

  // sipDist 분포 — 0 자인 십성 / 가장 많은 십성
  const sip = {
    비겁: Number(sipDist?.비겁 ?? 0),
    식상: Number(sipDist?.식상 ?? 0),
    재성: Number(sipDist?.재성 ?? 0),
    관성: Number(sipDist?.관성 ?? 0),
    인성: Number(sipDist?.인성 ?? 0),
  };
  const sipEntries = (Object.entries(sip) as Array<[keyof typeof sip, number]>)
    .sort((a, b) => b[1] - a[1]);
  const topSip = sipEntries[0];
  // 0자 인 십성 (필요 시 보강 액션)
  const zeroSip = sipEntries.find(([_, n]) => n === 0);

  // 가까운 대운 변곡점 나이
  const daeunList = sajuData.daeun || [];
  const curDaeun = daeunList.find((d: any) => d.isCurrent || d.현재);
  const curIdx = curDaeun ? daeunList.indexOf(curDaeun) : -1;
  const nextDaeun = curIdx >= 0 ? daeunList[curIdx + 1] : undefined;
  const nextDaeunAge = nextDaeun ? Number(nextDaeun.시작나이 ?? 0) : 0;
  const nextDaeunGZ = nextDaeun ? String(nextDaeun.간지 ?? '') : '';

  // 신살 보유 여부
  const allShinsal = [
    ...(sajuData.gilsin || []),
    ...(sajuData.hyungsal || []),
  ].map((s: any) => String(s.이름 ?? s.이름한자 ?? ''));
  const hasDohwa = allShinsal.some((n) => n.includes('도화살') || n.includes('홍염살'));
  const hasMunchang = allShinsal.some((n) => n.includes('문창귀인') || n.includes('학당귀인'));
  const hasYeokma = allShinsal.some((n) => n.includes('역마살'));
  const hasBaekho = allShinsal.some((n) => n.includes('백호살') || n.includes('괴강'));
  const hasCheonul = allShinsal.some((n) => n.includes('천을귀인'));

  const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };

  // 액션 1 — 가장 약한 오행 보강 (사주별 다름)
  // 2026-05-05 desc 동적화: 일간 호명 prefix
  const ilganPrefix = dayGanLabel ? `${dayGanLabel} 일간 + ` : '';
  const WEAK_FILL: Record<OhengType, { title: string; desc: string }> = {
    목: {
      title: `${HAN.목}(목) 결을 채우는 작은 산책`,
      desc: `${ilganPrefix}목(木) ${weakest.n}자라 자기 시작과 결정의 결이 얇은 사주. 새벽과 이른 아침 30분 산책, 푸른 잎 식물 한 그루, 신맛 음식(매실, 식초, 녹차)을 일상에 두면 결정력이 자랍니다.`,
    },
    화: {
      title: `${HAN.화}(화) 결을 채우는 표현 채널`,
      desc: `${ilganPrefix}화(火) ${weakest.n}자라 표현과 발표의 결이 약한 사주. 한낮 11~13시 햇볕 쬐기, 붉은 색 인테리어 한 곳, 매주 한 번 사람들 앞에 의견 내는 자리(미팅 발표와 후기 작성)를 의도적으로 만드세요.`,
    },
    토: {
      title: `${HAN.토}(토) 결을 채우는 진득함`,
      desc: `${ilganPrefix}토(土) ${weakest.n}자라 자리 잡는 힘이 얇은 사주. 한 자리와 한 가게와 한 사람에게 1년 이상 머무는 약속을 캘린더에 못 박으세요. 단맛(곡물과 꿀)과 황토색 물건이 결을 받쳐줍니다.`,
    },
    금: {
      title: `${HAN.금}(금) 결을 채우는 마감의 힘`,
      desc: `${ilganPrefix}금(金) ${weakest.n}자라 다듬고 끝내는 결이 얇은 사주. 시작한 일을 끝까지 마무리하는 체크리스트, 매운맛(마늘과 생강) 음식, 흰색과 은색 소품을 늘리면 결정력이 또렷해집니다.`,
    },
    수: {
      title: `${HAN.수}(수) 결을 채우는 침묵의 5분`,
      desc: `${ilganPrefix}수(水) ${weakest.n}자라 깊이 가라앉는 결이 얇은 사주. 하루 끝 5분 침묵, 반신욕, 검정 물잔, 짠맛 음식(미역과 해산물)을 더하세요. 결정 전 하룻밤 묵히는 습관이 한 해 점수를 올립니다.`,
    },
  };

  // 액션 2 — 가장 두꺼운 오행 절제 (반대 방향)
  // 2026-05-05 desc 동적화: 일간 호명 prefix
  const STRONG_RESTRAIN: Record<OhengType, { title: string; desc: string }> = {
    목: {
      title: `${HAN.목}(목) ${strongest.n}자 — 멈춤의 연습`,
      desc: `${ilganPrefix}목 ${strongest.n}자 — 시작 욕구가 강한 사주라 새 일을 한꺼번에 벌이기 쉽습니다. "한 분기에 새 프로젝트는 1개" 룰을 정하세요. 멈춰서 결과를 거두는 시간이 결을 살립니다.`,
    },
    화: {
      title: `${HAN.화}(화) ${strongest.n}자 — 한 박자 늦추기`,
      desc: `${ilganPrefix}화 ${strongest.n}자 — 즉각 표현과 결정 욕구가 강한 사주. 중요한 메시지, 계약, 답변은 "보내기 전 1시간 묵히기" 룰을 적용하세요. 식은 결정이 더 정확합니다.`,
    },
    토: {
      title: `${HAN.토}(토) ${strongest.n}자 — 떠나는 연습`,
      desc: `${ilganPrefix}토 ${strongest.n}자 — 머물려는 힘이 강한 사주라 변화를 미루기 쉽습니다. 분기마다 한 번은 새 환경(여행, 이사, 부서 이동) 노출을 캘린더에 못 박으세요. 결을 흔들어주는 자극이 필요합니다.`,
    },
    금: {
      title: `${HAN.금}(금) ${strongest.n}자 — 부드럽게 넘기기`,
      desc: `${ilganPrefix}금 ${strongest.n}자 — 정확, 원칙, 자르는 힘이 강한 사주라 사람을 깎기 쉽습니다. 비판하기 전 "긍정 한 줄 → 본론" 순서를 의식하세요. 칼은 칼집에 있을 때 가장 단단합니다.`,
    },
    수: {
      title: `${HAN.수}(수) ${strongest.n}자 — 표현으로 풀기`,
      desc: `${ilganPrefix}수 ${strongest.n}자 — 생각이 깊고 가라앉는 사주라 안에 쌓아두기 쉽습니다. 글, 일기, 짧은 음성 메모 — 무엇이든 매일 한 줄씩 풀어내세요. 풀지 않으면 무거워지는 결입니다.`,
    },
  };

  // 액션 3 — 0자 십성 보강 (또는 가장 얇은 십성)
  // 2026-05-05 desc 동적화: 일간 + 실제 카운트 호명
  const sipCountFor = (k: keyof typeof sip) => sip[k];
  const SIP_ZERO_FILL: Record<keyof typeof sip, { title: string; desc: string }> = {
    비겁: {
      title: '동료와 친구를 의식적으로 만들기',
      desc: `비겁 ${sipCountFor('비겁')}자 — ${dayGanLabel || dayGan} 일간을 함께 받쳐줄 동등한 결의 사람이 얇은 사주. 같은 분야 모임, 동호회, 스터디 한 군데를 1년 이상 꾸준히 다니세요. 만들지 않으면 외로워지는 결입니다.`,
    },
    식상: {
      title: '표현하는 한 채널 1년 이상',
      desc: `식상 ${sipCountFor('식상')}자 — ${dayGanLabel || dayGan} 일간이 만들어내고 표현하는 결이 얇은 사주. 글, 영상, 강의, SNS 형식은 자유, 한 채널만 1년 이상 끊김 없이 굴리세요. 이게 다음 대운의 빛이 됩니다.`,
    },
    재성: {
      title: '실리와 자원을 의식의 자리에',
      desc: `재성 ${sipCountFor('재성')}자 — 돈과 실리가 자연발생하지 않는 사주. 자동이체와 적립식 계좌와 고정비 축소 같은 시스템 저축을 의지가 아닌 구조로 설계하세요.`,
    },
    관성: {
      title: '책임과 자리를 의식적으로 받기',
      desc: `관성 ${sipCountFor('관성')}자 — 자리와 책임이 자연발생하지 않는 사주. 본인 판단과 재량이 보장되는 자리(1인 프로젝트, 창업, 임원, 핵심 PM)를 5년 단위로 의식적으로 설계하세요.`,
    },
    인성: {
      title: '학습과 기록을 평생 자산으로',
      desc: `인성 ${sipCountFor('인성')}자 — ${dayGanLabel || dayGan} 일간을 받쳐주는 결이 얇은 사주. 자격증, 학위, 전문 도서 — 무엇이든 매년 한 가지씩 쌓아두세요. 받침이 본인이 만들어야 하는 자리입니다.`,
    },
  };

  // 액션 5 — 일간 오행별 라이프스타일 (이미 §04 용신과 별개로 일간 본질)
  // 2026-05-05 desc 동적화: dayGanLabel + 현 대운 간지 추가 호명
  const curDaeunGZ = curDaeun ? String(curDaeun.간지 ?? '') : '';
  const curDaeunSuffix = curDaeunGZ ? ` 지금 ${curDaeunGZ} 대운에서 특히 의식적으로 챙길 자리.` : '';
  const ILGAN_LIFE: Record<OhengType, { title: string; desc: string }> = {
    목: {
      title: `${dayGanLabel || dayGan} 일간 — 봄 새벽의 결 살리기`,
      desc: `${dayGanLabel || dayGan} 일간은 곧게 뻗는 결이 강점이지만 부러지기도 쉬운 결. 매일 같은 시간과 같은 자리에서 5분 호흡으로 뿌리를 내리세요. 흔들릴 때 가장 먼저 다잡을 것은 자세입니다.${curDaeunSuffix}`,
    },
    화: {
      title: `${dayGanLabel || dayGan} 일간 — 한낮의 빛 다스리기`,
      desc: `${dayGanLabel || dayGan} 일간은 비추는 힘이 강점이지만 자기를 태우기도 쉬운 결. 식사와 수면 리듬이 무너지면 가장 먼저 무너집니다. 한 끼만이라도 같은 시간에.${curDaeunSuffix}`,
    },
    토: {
      title: `${dayGanLabel || dayGan} 일간 — 산과 들의 결 살리기`,
      desc: `${dayGanLabel || dayGan} 일간은 받아주는 결이 강점이지만 너무 머물러 굳기도 쉬운 결. 분기에 한 번은 새 환경에 본인을 노출하세요. 토는 흔들릴 때 비로소 새 씨앗을 받습니다.${curDaeunSuffix}`,
    },
    금: {
      title: `${dayGanLabel || dayGan} 일간 — 다듬어지는 결 살리기`,
      desc: `${dayGanLabel || dayGan} 일간은 단단함이 강점이지만 깎이는 게 두려워 도망치기도 쉬운 결. 본인보다 한 수 위인 사람 곁에 의도적으로 자리를 만드세요. 깎이지 않으면 모양이 잡히지 않습니다.${curDaeunSuffix}`,
    },
    수: {
      title: `${dayGanLabel || dayGan} 일간 — 흐르는 결 살리기`,
      desc: `${dayGanLabel || dayGan} 일간은 깊이가 강점이지만 한 자리에 머무는 게 답답한 결. 1년에 한 번은 새 분야와 새 도시와 새 사람에게 노출되는 일정을 잡으세요. 물은 흐를 때 맑습니다.${curDaeunSuffix}`,
    },
  };

  // 7건 조립
  const actions: Array<{ title: string; desc: string }> = [];

  // 1. 약한 오행 보강
  actions.push(WEAK_FILL[weakest.k]);
  // 2. 강한 오행 절제
  actions.push(STRONG_RESTRAIN[strongest.k]);
  // 3. 0자 십성 보강 (있을 때만 / 없으면 가장 약한 십성)
  if (zeroSip) {
    actions.push(SIP_ZERO_FILL[zeroSip[0]]);
  } else {
    const weakestSip = sipEntries[sipEntries.length - 1];
    actions.push(SIP_ZERO_FILL[weakestSip[0]]);
  }
  // 4. 가장 강한 십성 활용
  const TOP_SIP_ACTION: Record<keyof typeof sip, { title: string; desc: string }> = {
    비겁: { title: `비겁 ${topSip[1]}자 — 같은 결 사람과의 협업`, desc: '같은 분야 동료가 결을 살리는 사주. 단 금전 거래와 공동 투자는 시작 전 역할과 지분을 명문화한 뒤 시작하세요. 깨지면 크게 깨지는 자리입니다.' },
    식상: { title: `식상 ${topSip[1]}자 — 표현 채널 키우기`, desc: '만들어내는 힘이 강한 사주. 글, 영상, 강의, 요리, 디자인 — 무엇이든 한 분야를 1년 이상 끌고 가세요. 다음 대운에서 빛이 되는 자리입니다.' },
    재성: { title: `재성 ${topSip[1]}자 — 실리의 흐름 잡기`, desc: '돈과 자원이 손에 잡히는 사주. 큰 돈은 천천히 굴리는 자산(부동산과 장기 적립)으로, 빠른 회전은 작게. 재성이 두꺼우면 선택지가 너무 많아 결정을 미루는 함정.' },
    관성: { title: `관성 ${topSip[1]}자 — 책임 자리 받기`, desc: '책임과 평가가 따라오는 사주. 위계 조직보다는 본인 판단과 재량이 보장되는 자리(임원과 핵심 PM, 1인 프로젝트)에서 가장 빛납니다.' },
    인성: { title: `인성 ${topSip[1]}자 — 학습으로 결 다지기`, desc: '받아들이고 익히는 결이 강한 사주. 매년 자격증, 학위, 전문 도서 한 가지씩 쌓아두세요. 받침이 평생 자산이 되는 자리입니다.' },
  };
  actions.push(TOP_SIP_ACTION[topSip[0]]);
  // 5. 일간 오행 라이프스타일
  actions.push(ILGAN_LIFE[dayOheng]);
  // 6. 가까운 대운 변곡점 — 다음 대운 시기에 무엇을 준비할지
  if (nextDaeunAge > 0 && nextDaeunGZ) {
    actions.push({
      title: `${nextDaeunAge}세 ${nextDaeunGZ} 대운 — 미리 준비할 것`,
      desc: `이번 대운에서 ${nextDaeunAge}세 ${nextDaeunGZ} 대운으로 넘어가는 변곡점이 있습니다. 새 결로 갈아타기 전에 지금 시기 마무리할 것(미루던 정리와 매듭)을 분기별로 짚어두면 다음 대운에서 가볍게 출발합니다.`,
    });
  } else {
    // 대운 없을 때 fallback (어린 사주) — 일간 본질로 보강
    actions.push({
      title: '연 단위 결을 짚어두기',
      desc: `${dayGanLabel || dayGan} 일간 결을 매년 연말에 짧게 점검하는 습관을 들이세요. 1년에 5분만 본인 사주를 다시 펼쳐 보면, 다음 해 결정의 정확도가 달라집니다.`,
    });
  }
  // 7. 신살 기반 액션 — 핵심 신살 1개 호명
  if (hasDohwa) {
    actions.push({
      title: '도화와 홍염의 결 — 표현으로 살리기',
      desc: '도화살과 홍염살이 사주에 자리잡고 있습니다. 매력과 감각이 강한 결이라 가까운 사람과의 거리감 조절이 평생 과제. 표현, 예술, 콘텐츠 영역에서 빛나는 자리예요.',
    });
  } else if (hasMunchang) {
    actions.push({
      title: '문창귀인 — 글과 기록의 결 살리기',
      desc: '문창귀인이 사주에 자리잡고 있어 글, 연구, 시험, 자격 영역의 결이 강합니다. 매주 한 편 정리와 기록하는 자리를 의식적으로 만드세요. 결을 살리지 않으면 잠재로만 남습니다.',
    });
  } else if (hasYeokma) {
    actions.push({
      title: '역마의 결 — 이동과 새 환경에 노출',
      desc: '역마살이 사주에 자리잡고 있어 한 자리에 오래 머무는 결이 답답합니다. 분기에 한 번은 새 도시와 새 사람과 새 분야에 본인을 노출하는 일정을 잡으세요.',
    });
  } else if (hasBaekho) {
    actions.push({
      title: '백호와 괴강의 결 — 추진력 + 건강 점검',
      desc: '백호살과 괴강이 사주에 자리잡아 추진력이 강한 만큼 건강 부담도 따라옵니다. 매년 같은 달 종합검진을 캘린더에 고정하세요. 간 수치, 혈압, 심박 추적이 다음 대운의 정점을 받쳐줍니다.',
    });
  } else if (hasCheonul) {
    actions.push({
      title: '천을귀인 — 도와주는 사람 알아보기',
      desc: '천을귀인이 사주에 자리잡고 있어 결정적 순간 도와주는 사람이 등장하는 결입니다. 단 본인이 먼저 표시 내고 손 내밀어야 발현됩니다. 어려울 때 의식적으로 도움을 청하세요.',
    });
  } else {
    // 신살 없을 때 — 인연 시기 액션
    actions.push({
      title: '인연의 시기에 만난 사람의 메모를 챙기기',
      desc: '사주가 가리키는 강한 시기에 만난 사람은 한 해 내내 이어집니다. 식사 한 번 더, 메모 한 줄 더 — 작은 정성이 다음 운의 다리가 됩니다.',
    });
  }

  return actions;
}


/* mockup §10 .action-list / .action-card 진본 — 1~7 번호 카드 */
function PracticeChecklist({
  aiResult,
  sajuData,
  sipDist,
  scores: _scores,
}: {
  aiResult: any;
  sajuData?: SajuData;
  sipDist?: any;
  scores: Record<string, number>;
}) {
  // AI 응답에서 actionList (claudePremium.ts 신규 8 필드 중 하나) 또는 actions 배열 우선
  // 구조: [{ttl|title, desc|body}, ...]. 없으면 사주별 동적 fallback 7건.
  type Action = { title: string; desc: string };
  let actions: Action[] = [];
  const aiActionsRaw = (Array.isArray(aiResult?.actionList) && aiResult.actionList.length > 0)
    ? aiResult.actionList
    : (Array.isArray(aiResult?.actions) ? aiResult.actions : null);
  if (aiActionsRaw && aiActionsRaw.length > 0) {
    // 2026-05-04 컴팩트 — 7~9 → 5건만 (강조 디자인 + 핵심만)
    actions = aiActionsRaw
      .slice(0, 5)
      .map((a: any) => ({
        title: stripMd(String(a?.ttl ?? a?.title ?? '')),
        desc: stripMd(String(a?.desc ?? a?.body ?? '')),
      }))
      .filter((a: Action) => a.title || a.desc);
  }
  if (actions.length === 0) {
    // 사주별 동적 fallback 7건 — sipDist + 약한 오행 + 일간 + 대운 결합
    // (이전: "9월 자형(自刑)" 같은 거짓 정보 박혀있었음 → 모두 제거)
    actions = buildDynamicActions(sajuData, sipDist);
  }

  // mockup §10 .action-list / .action-card 진본 — 디자인 업그레이드 (마지막 임팩트 + 기억성)
  return (
    <div className="action-list">
      {actions.map((a, i) => (
        <div
          key={i}
          className="action-card"
          style={{
            // 첫 카드 + 마지막 카드 강조 (가장 핵심 액션 + 마무리 액션)
            ...(i === 0 ? {
              background: 'linear-gradient(135deg, rgba(232,217,184,0.22) 0%, rgba(184,150,90,0.08) 100%)',
              borderColor: '#B8965A',
              boxShadow: '0 4px 14px rgba(184,150,90,0.12)',
            } : {}),
            ...(i === actions.length - 1 ? {
              background: 'linear-gradient(135deg, rgba(78,122,87,0.06) 0%, rgba(78,122,87,0.03) 100%)',
              borderColor: 'rgba(78,122,87,0.3)',
            } : {}),
          }}
        >
          <div
            className="num"
            style={{
              ...(i === 0 ? {
                background: 'linear-gradient(135deg, #1a1a1a, #B8965A)',
                color: '#E8D9B8',
                width: 32,
                height: 32,
                fontSize: 16,
                boxShadow: '0 2px 8px rgba(184,150,90,0.4)',
              } : {}),
            }}
          >
            {i + 1}
          </div>
          <div className="body">
            <div
              className="ttl"
              style={{
                ...(i === 0 ? { fontSize: 15, color: '#1a1a1a' } : {}),
              }}
            >
              {a.title}
              {i === 0 && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: '#B8965A', background: 'rgba(184,150,90,0.14)', padding: '2px 6px', borderRadius: 4, verticalAlign: 'middle' }}>1순위</span>}
            </div>
            {/* 2026-05-04 fix: <strong> raw text → dangerouslySetInnerHTML */}
            <div className="desc" dangerouslySetInnerHTML={{ __html: sanitizeAiText(a.desc) }} />
          </div>
        </div>
      ))}
    </div>
  );
}



/* ══════════════════════════════════════════════════════════════════
 * Phase A1 · OhaengRadarSVG — 오행 5각 레이더 차트
 *  · mockup §1 ohaeng-radar 진본 (1374~1422줄)
 *  · 동심오각형 5개(1~5) + 축선 + 데이터 폴리곤 + 라벨
 *  · 바깥(r=88) = 5자 / 안쪽(r=0) = 0자
 * ═════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
 * 목업 §1 wongug-table 진본 — 사주 8글자 카드 + ohaeng-chart 5 horizontal bars
 *  · 5-column grid (60px 라벨 + 4 기둥)
 *  · 각 셀: sip-tag(상단 floating chip) + glyph(28px Noto Serif) + yum(9px)
 *  · 일주 셀: 녹색 그라디언트 + ilju 클래스
 * ═════════════════════════════════════════════════════════════════ */
/* mockup §1 .wongug 진본 — className 만 사용 (CSS 가 전체 styling) */
function WongugTable({
  v4Pillars: _v4Pillars,
  sajuData,
  sipDist: _sipDist,
}: {
  v4Pillars: V4Pillar[];
  sajuData: SajuData;
  sipDist: SipDist;
}) {
  const dayOheng = (sajuData.pillars[2]?.천간오행 ?? '토') as OhengType;
  // sajuData.pillars: [년, 월, 일, 시] / mockup 표시: [시, 일, 월, 연]
  const pillars = sajuData.pillars;
  const colHeaders = ['시주', '일주', '월주', '연주'];
  const order = [3, 2, 1, 0];
  const ohengToCls: Record<string, 'mok' | 'hwa' | 'to' | 'geum' | 'su'> = {
    목: 'mok', 화: 'hwa', 토: 'to', 금: 'geum', 수: 'su',
  };

  function getSipsung(targetOheng: string, isIlganGan: boolean): string {
    if (isIlganGan) return '일간';
    const cat = getSipsungCategory(dayOheng, targetOheng as OhengType);
    return cat === '기타' ? '—' : cat;
  }

  return (
    <div className="wongug">
      <div className="wongug-table">
        <div></div>
        {colHeaders.map((h) => (
          <div key={h} className="col-header">{h}</div>
        ))}

        {/* 천간 row */}
        <div className="row-label">천간</div>
        {order.map((idx) => {
          const p = pillars[idx];
          if (!p?.available) {
            return (
              <div key={`gan-${idx}`} className="wongug-cell" style={{ borderStyle: 'dashed', color: '#a89c7f' }}>
                <div className="yum">미입력</div>
              </div>
            );
          }
          const isIlju = idx === 2;
          const cls = ohengToCls[p.천간오행 || '토'] || 'to';
          const sip = getSipsung(p.천간오행 || '토', isIlju);
          return (
            <div key={`gan-${idx}`} className={`wongug-cell${isIlju ? ' ilju' : ''}`}>
              <div className="sip-tag">{sip}</div>
              <div className={`glyph ${cls}`}>{p.천간 || '?'}</div>
              <div className="yum">
                {p.천간읽기 || ''} / {p.천간음양 === '음' ? '음' : '양'}
                {cls === 'mok' ? '목' : cls === 'hwa' ? '화' : cls === 'to' ? '토' : cls === 'geum' ? '금' : '수'}
                {isIlju ? ' (나)' : ''}
              </div>
            </div>
          );
        })}

        {/* 지지 row */}
        <div className="row-label">지지</div>
        {order.map((idx) => {
          const p = pillars[idx];
          if (!p?.available) {
            return (
              <div key={`ji-${idx}`} className="wongug-cell" style={{ borderStyle: 'dashed', color: '#a89c7f' }}>
                <div className="yum">미입력</div>
              </div>
            );
          }
          const isIlju = idx === 2;
          const cls = ohengToCls[p.지지오행 || '토'] || 'to';
          const sip = getSipsung(p.지지오행 || '토', false);
          return (
            <div key={`ji-${idx}`} className={`wongug-cell${isIlju ? ' ilju' : ''}`}>
              <div className="sip-tag">{sip}</div>
              <div className={`glyph ${cls}`}>{p.지지 || '?'}</div>
              <div className="yum">
                {p.지지읽기 || ''} / {p.지지음양 === '음' ? '음' : '양'}
                {cls === 'mok' ? '목' : cls === 'hwa' ? '화' : cls === 'to' ? '토' : cls === 'geum' ? '금' : '수'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ohaeng-chart — 5 horizontal bars */}
      <OhaengHorizontalBars elements={sajuData.elements} />

      {/* mockup §1 .yin-yang-card 진본 — 음양 균형 split bar */}
      <YinYangCard pillars={sajuData.pillars} />

      {/* mockup §1 .ohaeng-diag 진본 — 5 카드 (太過/中/弱/未/未) */}
      <OhaengDiag elements={sajuData.elements} />
    </div>
  );
}

/* mockup §1 .yin-yang-card 진본 — className 만 사용 */
function YinYangCard({ pillars }: { pillars: SajuData['pillars'] }) {
  let yang = 0,
    yin = 0;
  for (const p of pillars) {
    if (!p.available) continue;
    if (p.천간음양 === '양') yang++;
    else yin++;
    if (p.지지음양 === '양') yang++;
    else yin++;
  }
  const total = yang + yin || 1;
  const yangPct = (yang / total) * 100;
  const yinPct = 100 - yangPct;
  // mockup 진본 caption (양 5 / 음 3 일 때 — 비율별 분기 카피)
  const caption =
    Math.abs(yang - yin) <= 1
      ? `양이 ${yang}, 음이 ${yin}. 움직이는 힘과 가라앉히는 힘이 균형 잡힌 구조입니다.`
      : yang > yin
        ? `양이 ${yang}, 음이 ${yin}. 움직이는 힘이 앞서고 가라앉히는 힘이 뒤따르는 구조입니다.`
        : `양이 ${yang}, 음이 ${yin}. 가라앉히는 힘이 앞서고 움직이는 힘이 뒤따르는 구조입니다.`;
  return (
    <div className="yin-yang-card">
      <div className="yy-title">음양 균형</div>
      <div className="yy-bar">
        {yangPct > 0 && (
          <div className="yang" style={{ width: `${yangPct}%` }}>
            양 {yang}
          </div>
        )}
        {yinPct > 0 && (
          <div className="yin" style={{ width: `${yinPct}%` }}>
            음 {yin}
          </div>
        )}
      </div>
      <div className="yy-caption">{caption}</div>
    </div>
  );
}

/* mockup §1 .ohaeng-diag 진본 — 5 카드 (태과/중/약/미) */
function OhaengDiag({ elements }: { elements: any }) {
  const counts: Record<OhengType, number> = {
    목: Number(elements?.목 ?? 0),
    화: Number(elements?.화 ?? 0),
    토: Number(elements?.토 ?? 0),
    금: Number(elements?.금 ?? 0),
    수: Number(elements?.수 ?? 0),
  };
  // 태과 (3+) / 중 (2) / 약 (1) / 미 (0)
  function tier(c: number): { cellCls: string; labelCls: string; label: string } {
    if (c >= 3) return { cellCls: 'strong', labelCls: 's', label: '태과' };
    if (c === 2) return { cellCls: '', labelCls: '', label: '중' };
    if (c === 1) return { cellCls: 'weak', labelCls: 'w', label: '약' };
    return { cellCls: 'weak', labelCls: 'w', label: '미' };
  }
  const ohengs: Array<{ key: OhengType; han: string; cls: 'mok' | 'hwa' | 'to' | 'geum' | 'su' }> = [
    { key: '목', han: '木', cls: 'mok' },
    { key: '화', han: '火', cls: 'hwa' },
    { key: '토', han: '土', cls: 'to' },
    { key: '금', han: '金', cls: 'geum' },
    { key: '수', han: '水', cls: 'su' },
  ];
  return (
    <div className="ohaeng-diag">
      {ohengs.map((o) => {
        const c = counts[o.key];
        const t = tier(c);
        return (
          <div key={o.key} className={`od-cell ${t.cellCls}`.trim()}>
            <div className={`od-han ${o.cls}`}>{o.han}</div>
            <div className="od-dots">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={i < c ? 'on' : ''} />
              ))}
            </div>
            <div className={`od-label ${t.labelCls}`.trim()}>{t.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* mockup .ohaeng-chart .ohaeng-bar 진본 — className 만 사용 */
function OhaengHorizontalBars({ elements }: { elements: any }) {
  const counts: Record<OhengType, number> = {
    목: Number(elements?.목 ?? 0),
    화: Number(elements?.화 ?? 0),
    토: Number(elements?.토 ?? 0),
    금: Number(elements?.금 ?? 0),
    수: Number(elements?.수 ?? 0),
  };
  const total =
    counts.목 + counts.화 + counts.토 + counts.금 + counts.수 || 1;
  const rows: Array<{ key: OhengType; han: string; cls: 'o-mok' | 'o-hwa' | 'o-to' | 'o-geum' | 'o-su' }> = [
    { key: '목', han: '木', cls: 'o-mok' },
    { key: '화', han: '火', cls: 'o-hwa' },
    { key: '토', han: '土', cls: 'o-to' },
    { key: '금', han: '金', cls: 'o-geum' },
    { key: '수', han: '水', cls: 'o-su' },
  ];
  return (
    <div className="ohaeng-chart">
      <div className="title">오행 분포 (8글자 기준)</div>
      {rows.map((r) => {
        const c = counts[r.key];
        const pct = (c / total) * 100;
        return (
          <div key={r.key} className={`ohaeng-bar ${r.cls}`}>
            <span className="o-label">{r.han}</span>
            <div className="o-track">
              <div className="o-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="o-count">{c}자</span>
          </div>
        );
      })}
    </div>
  );
}

function OhaengRadarSVG({ elements }: { elements: any }) {
  const counts: Record<OhengType, number> = {
    목: Number(elements?.목 ?? 0),
    화: Number(elements?.화 ?? 0),
    토: Number(elements?.토 ?? 0),
    금: Number(elements?.금 ?? 0),
    수: Number(elements?.수 ?? 0),
  };
  // 5 vertex unit vectors (목 top, 시계방향: 木→火→土→金→水)
  const cx = 130, cy = 128, R = 88;
  const dirs: Array<{ key: OhengType; dx: number; dy: number; han: string; color: string; lx: number; ly: number }> = [
    { key: '목', dx: 0,             dy: -1,            han: '木', color: '#4E7A57', lx: 130, ly: 28 },
    { key: '화', dx: 0.9511,        dy: -0.309,        han: '火', color: '#B04A38', lx: 225, ly: 103 },
    { key: '토', dx: 0.5878,        dy: 0.809,         han: '土', color: '#B07F38', lx: 190, ly: 218 },
    { key: '금', dx: -0.5878,       dy: 0.809,         han: '金', color: '#7D7870', lx: 70,  ly: 218 },
    { key: '수', dx: -0.9511,       dy: -0.309,        han: '水', color: '#3E5F82', lx: 35,  ly: 103 },
  ];
  // 5 grid pentagons (1~5 눈금)
  const gridPolys: string[] = [1, 2, 3, 4, 5].map((step) => {
    const r = (step / 5) * R;
    return dirs
      .map((d) => `${(cx + d.dx * r).toFixed(1)},${(cy + d.dy * r).toFixed(1)}`)
      .join(' ');
  });
  // Data polygon points + circle markers
  const dataPts = dirs.map((d) => {
    const c = Math.min(5, Math.max(0, counts[d.key]));
    const r = (c / 5) * R;
    const px = cx + d.dx * r;
    const py = cy + d.dy * r;
    return { x: px, y: py, count: c, color: d.color };
  });
  const dataPolyStr = dataPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // mockup .ohaeng-radar 진본 — className 만 사용
  return (
    <div className="ohaeng-radar">
      <div className="or-title">
        오행 레이더 — 한눈에 보는 균형도{' '}
        <span style={{ color: '#a08a5a', fontWeight: 400 }}>바깥 = 5자, 안쪽 = 0자</span>
      </div>
      <svg viewBox="0 0 260 240" xmlns="http://www.w3.org/2000/svg">
        {/* 동심오각형 */}
        <g fill="none" stroke="#E5DFD0" strokeWidth="1">
          {gridPolys.map((pts, i) => (
            <polygon key={i} points={pts} />
          ))}
        </g>
        {/* 축선 */}
        <g stroke="#E5DFD0" strokeWidth="0.8">
          {dirs.map((d, i) => (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={(cx + d.dx * R).toFixed(1)}
              y2={(cy + d.dy * R).toFixed(1)}
            />
          ))}
        </g>
        {/* 데이터 폴리곤 */}
        <polygon
          points={dataPolyStr}
          fill="rgba(212,175,55,0.18)"
          stroke="#E8D9B8"
          strokeWidth="1.6"
        />
        {/* 데이터 점 */}
        {dataPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={p.color} />
        ))}
        {/* 오행 한자 라벨 */}
        <g fontFamily="'Noto Serif KR', serif" fontSize="13" fontWeight="700">
          {dirs.map((d, i) => (
            <text key={i} x={d.lx} y={d.ly} textAnchor="middle" fill={d.color}>
              {d.han}
            </text>
          ))}
        </g>
        {/* 데이터 값 라벨 */}
        <g fontSize="9.5" fill="#a08a5a" fontWeight="700">
          {dataPts.map((p, i) => {
            const d = dirs[i];
            // 좌측 (금·수)는 dx -12, 우측 (화·토)는 dx +7, 상단 (목)은 dx +7
            const isLeft = d.dx < -0.3;
            const dx = isLeft ? -12 : 7;
            const dy = d.dy < -0.6 ? -3 : 0;
            return (
              <text key={i} x={p.x} y={p.y} dx={dx} dy={dy}>
                {p.count}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Phase A3 · LifeEdgeList — 오행별 인생의 결 5카드
 *  · mockup §1 life-edge-list 진본 (1443~1508줄)
 *  · 각 오행의 보유 자수 → tier(태과/중/약/미) → ✓살릴 것 / ⚠조심할 것
 *  · 일간 오행과 보유량 기반 컨디셔널 카피
 * ═════════════════════════════════════════════════════════════════ */
interface AiLifeEdgeCard { head?: string; save?: string; avoid?: string }
interface AiLifeEdge {
  목?: AiLifeEdgeCard; 화?: AiLifeEdgeCard; 토?: AiLifeEdgeCard;
  금?: AiLifeEdgeCard; 수?: AiLifeEdgeCard;
}
function LifeEdgeList({
  elements,
  userName,
  ilganOheng: _ilganOheng,
  aiCards,
  pillars,
}: {
  elements: any;
  userName: string;
  ilganOheng: string;
  aiCards?: AiLifeEdge;
  pillars?: SajuData['pillars'];
}) {
  const u = userName || '회원';
  const counts: Record<OhengType, number> = {
    목: Number(elements?.목 ?? 0),
    화: Number(elements?.화 ?? 0),
    토: Number(elements?.토 ?? 0),
    금: Number(elements?.금 ?? 0),
    수: Number(elements?.수 ?? 0),
  };
  // 사용자 사주에서 각 오행에 해당하는 글자 목록 추출 (직접 호명용)
  const charsByOheng: Record<OhengType, string[]> = { 목: [], 화: [], 토: [], 금: [], 수: [] };
  if (pillars) {
    for (const p of pillars) {
      if (!p?.available) continue;
      const ganOh = p.천간오행 as OhengType;
      const jiOh = p.지지오행 as OhengType;
      if (ganOh && p.천간 && charsByOheng[ganOh]) charsByOheng[ganOh].push(p.천간);
      if (jiOh && p.지지 && charsByOheng[jiOh]) charsByOheng[jiOh].push(p.지지);
    }
  }
  // 4-tier (mockup 라벨 정렬): 3+=태과(s), 2=중(default), 1=약(w), 0=미(w)
  function tierOf(c: number): { label: string; tag: 's' | '' | 'w' } {
    if (c >= 3) return { label: '태과', tag: 's' };
    if (c === 2) return { label: '중', tag: '' };
    if (c === 1) return { label: '약', tag: 'w' };
    return { label: '미', tag: 'w' };
  }

  // 오행별 카피 (3 tier — 태과 / 중 / 약·미) — 카운트별로 선택
  type CopyTier = 'strong' | 'mid' | 'weak';
  const copyOf = (c: number): CopyTier =>
    c >= 3 ? 'strong' : c === 2 ? 'mid' : 'weak';

  interface CardCopy {
    glyph: string;
    name: string;
    color: string;
    cls: 'mok' | 'hwa' | 'to' | 'geum' | 'su';
    bg: string;
    border: string;
    head: { strong: string; mid: string; weak: string };
    save: { strong: string; mid: string; weak: string };
    avoid: { strong: string; mid: string; weak: string };
  }
  const COPY: Record<OhengType, CardCopy> = {
    목: {
      glyph: '木', name: '나무 — 주체성, 성장 욕구', color: '#4E7A57', cls: 'mok',
      bg: 'rgba(78,122,87,.05)', border: '#4E7A57',
      head: {
        strong: `${u} 님은 "스스로 결정하고 스스로 걷는 사람"입니다. 같은 결의 글자가 여럿 모여 주체성이 남들보다 확실히 두껍습니다. 지금까지 살면서 "남이 시키는 대로 하는 게 가장 힘들었다"는 감각이 분명히 있었을 겁니다.`,
        mid: `${u} 님에게는 자기 결정권이 단단하게 잡혀 있습니다. 흔들리지 않는 줏대 — 살아오는 동안 본인이 가장 신뢰하는 자산이 됐을 거예요.`,
        weak: `${u} 님은 주변의 의견과 분위기를 흡수하면서 결정하는 결입니다. 부드러운 강함 — 다만 본인의 욕구를 자주 뒷자리에 두는 패턴이 있습니다.`,
      },
      save: {
        strong: '본인이 결정 주도권을 쥐는 자리. 1인 프로젝트, 창업, 프리랜서는 사주가 밀어줍니다.',
        mid: '본인 색깔이 분명히 묻어나는 자리. 의견 내는 회의와 기획 주도와 중간 리더 자리에서 강합니다.',
        weak: '주체성을 키우는 환경 — 1:1 코칭과 의사결정 훈련과 취미라도 "내가 고른다"는 감각을 자주 만들어두세요.',
      },
      avoid: {
        strong: '같은 결의 사람이 많아 동업과 공동창업은 반드시 지분과 의사결정 구조를 먼저 못 박아야 깨집니다. 그냥 하면 깨져요.',
        mid: '지나치게 "내가 맞다"는 자세로 굳어지면 옆이 떠납니다. 정기적으로 다른 시선을 들이는 루틴을 두세요.',
        weak: '결정의 책임을 남에게 미루는 패턴. "그냥 알아서 해줘"라는 말을 본인이 자주 하고 있다면 신호입니다.',
      },
    },
    화: {
      glyph: '火', name: '불 — 표현력, 드러나는 힘', color: '#c62828', cls: 'hwa',
      bg: 'rgba(198,40,40,.05)', border: '#c62828',
      head: {
        strong: `${u} 님의 가장 큰 무기입니다. 말, 글, 영상, 강의 — 드러내는 영역에서 같은 노력으로 남보다 2배의 효과가 납니다.`,
        mid: `${u} 님은 표현이 자연스럽게 풀리는 사람입니다. 본인의 생각을 말로 정리하면서 더 명확해지는 결.`,
        weak: `${u} 님은 안에 담아두는 결입니다. 표현이 부족한 게 아니라, 다듬어서 한 번에 내놓는 스타일.`,
      },
      save: {
        strong: '직업과 사업의 축에 반드시 "드러내는 채널"이 들어가 있어야 합니다. 뒷작업만 하는 자리에 가면 재능이 새요.',
        mid: '발표, 강의, 콘텐츠 — 본인 이름이 붙는 일에서 강합니다. 익명/뒷작업 비중이 너무 높으면 활기가 죽습니다.',
        weak: '표현 채널을 의식적으로 한두 개 굴려두세요. 글, 영상, 뉴스레터 — 드러나는 횟수 자체를 늘려야 자라납니다.',
      },
      avoid: {
        strong: '불이 많아 감정 기복이 또렷합니다. 화가 올라오는 날은 중요한 결정을 다음 날로 미루세요.',
        mid: '"말이 앞서고 행동이 따라가는" 패턴 주의. 발표/약속을 한 뒤에 일정과 여유를 다시 점검하세요.',
        weak: '본인의 감정과 의견을 너무 오래 묻어두면 어느 순간 한 번에 터집니다. 정기적으로 말로 풀어내는 자리를 만드세요.',
      },
    },
    토: {
      // 가독성 보강 (2026-05-04): #B07F38 (어두운 황토) → #F4D166 (밝은 금) — LifeEdgeList strong 텍스트 가독성
      glyph: '土', name: '흙 — 재물, 자리잡는 힘', color: '#F4D166', cls: 'to',
      bg: 'rgba(244,209,102,0.10)', border: '#F4D166',
      head: {
        strong: `${u} 님은 "쌓고 머무는 힘"이 강합니다. 한 자리에 진득하게 앉아 자산, 관계, 신뢰를 천천히 쌓아 올리는 결.`,
        mid: `${u} 님은 안정과 확장의 균형이 잡힌 결입니다. 무리하게 벌이지 않으면서도 흐름은 놓치지 않는 사람.`,
        weak: `돈이 "벌리는 재능"은 있는데 "쌓이는 자리"가 얇습니다. 벌어도 빠르게 빠져나가는 패턴을 이미 경험했을 겁니다.`,
      },
      save: {
        strong: '장기 자산, 부동산, 진득한 사업이 강점. 빠른 회전보다 천천히 굴리는 자산을 늘리세요.',
        mid: '저축과 투자, 안정과 도전을 분기별로 갈라 쓰세요. 한쪽에 치우치지 않는 게 강점입니다.',
        weak: '자동이체와 적립식 계좌와 고정비 축소 같은 "시스템 저축"을 반드시 설계하세요. 의지로 안 됩니다, 구조로만 됩니다.',
      },
      avoid: {
        strong: '머물려는 힘이 너무 강해 변화 시기를 놓칠 수 있어요. 5년에 한 번은 본인 자리를 점검하세요.',
        mid: '"이 정도면 됐다"는 안도감이 가장 위험합니다. 작은 도전을 끊지 않는 게 안정의 진짜 형태.',
        weak: '큰 부동산과 큰 투자를 미루는 편이 맞습니다. 흙이 두꺼워지는 대운을 만나면 그때 한 번에 굳히세요.',
      },
    },
    금: {
      glyph: '金', name: '쇠 — 다듬기, 절제, 원칙', color: '#7D7870', cls: 'geum',
      bg: 'rgba(74,74,74,0.05)', border: '#7D7870',
      head: {
        strong: `${u} 님은 원칙, 기준, 디테일에서 강합니다. 헐겁게 끝내는 걸 본인이 가장 못 견디는 사람.`,
        mid: `${u} 님은 필요할 때 단호해지는 결입니다. 평소엔 부드럽다가 결정의 순간엔 칼처럼 자르는 사람.`,
        weak: `이게 ${u} 님 사주의 약점이 될 수 있습니다. "일을 여러 개 동시에 벌여놓고 하나도 제대로 못 끝낸 적"이 있었다면 재능 문제가 아니라 이것 때문입니다.`,
      },
      save: {
        strong: '품질, 검수, 기획 다듬기가 본업의 무기. 거친 결과물을 정교하게 다듬는 자리에서 빛납니다.',
        mid: '본인이 "여기까지"라고 정한 선은 잘 지켜집니다. 큰 결정엔 본인의 직감을 믿으세요.',
        weak: '외부 규율(마감, 계약, 코치, 발표일)을 의도적으로 설치하세요. 스스로 짜는 마감은 거의 지켜지지 않습니다. 약속해버리면 됩니다.',
      },
      avoid: {
        strong: '"틀렸다와 안 된다"는 판단이 너무 빨라 사람이 떠납니다. 결정을 하루 미뤄보는 연습이 필요해요.',
        mid: '원칙주의가 본인을 옥죄는 순간이 있습니다. 한 분기에 한 번은 본인에게 "괜찮다"고 풀어주세요.',
        weak: '"하고 싶은 것"을 줄이는 게 평생 과제입니다. 하나를 끝낼 때까지 다음 것은 시작하지 마세요.',
      },
    },
    수: {
      glyph: '水', name: '물 — 쉼, 회복, 지혜', color: '#3E5F82', cls: 'su',
      bg: 'rgba(62,95,130,.05)', border: '#3E5F82',
      head: {
        strong: `${u} 님은 회복력과 통찰이 깊은 결입니다. 한 발 빠져 흐름을 보는 자리에서 가장 정확한 사람.`,
        mid: `${u} 님은 적당히 쉬고 적당히 움직이는 결입니다. 자기 페이스가 잡혀 있어 번아웃이 잘 오지 않는 편.`,
        weak: `가장 중요한 보급선인데 가장 얇습니다. 번아웃이 또렷하게 반복될 사주입니다. 이미 한두 번 크게 지쳐본 적이 있을 겁니다.`,
      },
      save: {
        strong: '관찰, 기획, 전략 — 한 발 떨어져서 판을 보는 자리에서 강합니다. 깊게 생각하는 시간을 자산으로 쓰세요.',
        mid: '쉼과 일의 리듬이 잡혀 있는 게 강점. 이 리듬을 무너뜨릴만한 일정은 의식적으로 거절하세요.',
        weak: '"안 하는 시간"을 캘린더에 먼저 박을 것. 분기마다 2박 이상의 온전한 휴식. 즉흥으로 두면 절대 만들어지지 않습니다.',
      },
      avoid: {
        strong: '생각이 깊어 행동을 미루는 패턴. 일정 시점엔 "분석 그만, 실행"으로 끊어주세요.',
        mid: '평정이 너무 커서 "괜찮다"고 넘어가는 일이 쌓이면 어느 날 한 번에 터집니다. 작은 불편도 그때그때 말하세요.',
        weak: '"괜찮다, 좀 더 할 수 있다"는 감각을 신뢰하지 마세요. 물이 얇은 사주는 본인이 고갈된 줄도 모르고 달려가다 한 번에 무너집니다.',
      },
    },
  };

  // mockup §1 .life-edge-list .life-edge-card 진본 — className 만 사용
  return (
    <div className="life-edge-list">
      {(['목', '화', '토', '금', '수'] as OhengType[]).map((key) => {
        const c = counts[key];
        const t = tierOf(c);
        const tier = copyOf(c);
        const card = COPY[key];
        const ai = aiCards?.[key];
        const userChars = [...new Set(charsByOheng[key] || [])];
        const charsHint = userChars.length > 0
          ? `(${u} 님 사주의 ${card.glyph} 글자: ${userChars.join(', ')})`
          : `(${u} 님 사주에 ${card.glyph} 글자가 비어있는 자리)`;
        // AI head 가 너무 짧으면 (50자 미만) mockup 진본 fallback 사용 — 풍부도 보장
        // 2026-05-04 sanitize: AI 응답에 <strong>/<b> 등 HTML 태그가 섞여 raw text 로 노출되는 버그 차단
        const aiHead = sanitizeAiText(ai?.head);
        const aiSave = sanitizeAiText(ai?.save);
        const aiAvoid = sanitizeAiText(ai?.avoid);
        const headText = aiHead && aiHead.length >= 50 ? aiHead : `${card.head[tier]} ${charsHint}`;
        const saveText = aiSave && aiSave.length >= 25 ? aiSave : card.save[tier];
        const avoidText = aiAvoid && aiAvoid.length >= 25 ? aiAvoid : card.avoid[tier];
        // headText 첫 문장만 색상 강조 (mockup 진본 형식 — 첫 문장 color-bold)
        const headFirstSentence = headText.match(/^[^.!?]+[.!?]/)?.[0] || headText.split(/[.!?]/)[0] + '.';
        const headRest = headText.slice(headFirstSentence.length).trim();
        return (
          <div key={key} className={`life-edge-card ${card.cls}`}>
            <div className="le-head">
              <span className="le-glyph">{card.glyph}</span>
              <span className="le-name">{card.name}</span>
              <span className={`le-tag ${t.tag}`.trim()}>{t.label}, {c}자</span>
            </div>
            <div className="le-desc">
              {/* 첫 문장 색강조 + 본문은 HTML 통과 (다른 41개 컴포넌트와 동일 패턴) */}
              <span
                style={{ color: card.color, fontSize: 13, fontWeight: 700 }}
                dangerouslySetInnerHTML={{ __html: headFirstSentence }}
              />
              {headRest && (
                <span
                  style={{ color: '#2a2520' }}
                  dangerouslySetInnerHTML={{ __html: ` ${headRest}` }}
                />
              )}
              <br /><br />
              <div style={{ marginBottom: 6 }}>
                <strong style={{ color: '#355A3E', display: 'inline-block', minWidth: 56, fontSize: 11, padding: '2px 6px', background: 'rgba(78,122,87,0.10)', borderRadius: 4, marginRight: 6 }}>살릴 것</strong>
                <span style={{ color: '#2a2520' }} dangerouslySetInnerHTML={{ __html: saveText }} />
              </div>
              <div>
                <strong style={{ color: '#8b1a1a', display: 'inline-block', minWidth: 56, fontSize: 11, padding: '2px 6px', background: 'rgba(198,40,40,0.10)', borderRadius: 4, marginRight: 6 }}>조심할 것</strong>
                <span style={{ color: '#2a2520' }} dangerouslySetInnerHTML={{ __html: avoidText }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Phase A2 · SipDonut — 십성 분포 도넛 차트
 *  · mockup §3 sip-donut 진본 (1597~1631줄)
 *  · 도넛 5조각 + legend (스와치 / 이름 / 막대 / 퍼센트)
 *  · circumference r=15.915 ≈ 100 → dasharray = percent 값 그대로
 * ═════════════════════════════════════════════════════════════════ */
function SipDonut({ sipDist }: { sipDist: SipDist }) {
  const ORDER: Array<{ key: keyof SipDist; label: string; color: string }> = [
    { key: '식상', label: '식상', color: '#c62828' },
    { key: '비겁', label: '비겁', color: '#4E7A57' },
    { key: '재성', label: '재성', color: '#7F6B4E' },
    { key: '관성', label: '관성', color: '#7D7870' },
    { key: '인성', label: '인성', color: '#3E5F82' },
  ];
  const total =
    sipDist.비겁 + sipDist.식상 + sipDist.재성 + sipDist.관성 + sipDist.인성 || 1;
  // percent 산출 + 누적 시작 offset 계산
  let cum = 0;
  const slices = ORDER.map((o) => {
    const raw = (sipDist[o.key] / total) * 100;
    const pct = Math.round(raw * 10) / 10;
    const start = cum;
    cum += pct;
    return { ...o, pct, start };
  });

  // mockup §3 .sip-donut 진본 — className 만 사용
  return (
    <div className="sip-donut">
      <svg className="sd-svg" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle cx={18} cy={18} r={15.915} fill="#fff" stroke="#E5DFD0" strokeWidth={3.6} />
        {slices.map((s, i) =>
          s.pct > 0 ? (
            <circle
              key={i}
              cx={18}
              cy={18}
              r={15.915}
              fill="transparent"
              stroke={s.color}
              strokeWidth={3.6}
              strokeDasharray={`${s.pct} ${100 - s.pct}`}
              strokeDashoffset={String(25 - s.start)}
            />
          ) : null,
        )}
        <text x={18} y={20} textAnchor="middle" fontSize={5} fill="#1a1a1a" fontWeight={700} fontFamily="'Noto Serif KR', serif">
          十神
        </text>
      </svg>
      <div className="sd-legend">
        {slices.map((s, i) => (
          <div key={i} className="sd-row">
            <span className="sd-swatch" style={{ background: s.color }} />
            <span className="sd-name">{s.label}</span>
            <span className="sd-bar">
              <span className="sd-fill" style={{ width: `${s.pct}%`, background: s.color, display: 'block' }} />
            </span>
            <span className="sd-pct">{sipDist[s.key]}자</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2C-#3 · SipClusterHeader — 십성 5분류 클러스터 헤더
 *  · 비겁/식상/재성/관성/인성 5 카드 가로 — 카운트 + 우세 클러스터 강조
 *  · mockup sip-cluster 진본 정렬
 * ═════════════════════════════════════════════════════════════════ */
function SipClusterHeader({ sipDist }: { sipDist: any }) {
  const clusters: Array<{ key: keyof typeof sipDist; label: string; hanja: string; color: string; meaning: string }> = [
    { key: '비겁', label: '비겁', hanja: '比劫', color: '#4E7A57', meaning: '자아와 경쟁' },
    { key: '식상', label: '식상', hanja: '食傷', color: '#B04A38', meaning: '표현과 창작' },
    { key: '재성', label: '재성', hanja: '財星', color: '#B07F38', meaning: '재물과 실리' },
    { key: '관성', label: '관성', hanja: '官星', color: '#3E5F82', meaning: '관계와 책임' },
    { key: '인성', label: '인성', hanja: '印星', color: '#7A5C7E', meaning: '학문과 배움' },
  ];
  const max = Math.max(...clusters.map((c) => Number(sipDist[c.key] ?? 0)));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 12 }}>
      {clusters.map((cl) => {
        const v = Number(sipDist[cl.key] ?? 0);
        const isPeak = v === max && v > 0;
        return (
          <div
            key={String(cl.key)}
            style={{
              padding: '8px 4px',
              background: isPeak ? `${cl.color}14` : C.surface,
              border: isPeak ? `2px solid ${cl.color}` : `1px solid ${C.line}`,
              borderRadius: 8,
              textAlign: 'center',
              boxShadow: isPeak ? `0 2px 6px ${cl.color}33` : 'none',
            }}
          >
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 12, fontWeight: 700, color: cl.color, lineHeight: 1 }}>
              {cl.hanja}
            </div>
            <div style={{ fontSize: 11, color: C.mute, marginTop: 2, fontWeight: 600 }}>{cl.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: cl.color, fontFeatureSettings: '"tnum"', marginTop: 4 }}>
              {v}
            </div>
            <div style={{ fontSize: 8, color: C.mute, marginTop: 2 }}>{cl.meaning}</div>
          </div>
        );
      })}
    </div>
  );
}

function YongsinLifeTable({ primary, lifestyle }: { primary: OhengType; lifestyle: any }) {
  // Stage 7e-7: lifestyle undefined 가드
  if (!lifestyle) return null;
  // mockup §4 진본 8행 — OHENG_LIFESTYLE 의 8 필드 모두 (사주별 동적)
  // 2026-05-05 hint 도 primary(용신 오행) 별 분기 — 보일러플레이트 박멸
  // 같은 색·방위 라벨도 용신이 목·화·토·금·수 마다 다른 의미
  const HINTS: Record<OhengType, Record<string, string>> = {
    목: {
      color: '초록과 연두 옷과 소품이 본인의 시작 결을 살립니다.',
      direction: '동쪽이 본인 결을 키우는 방향 — 책상과 침대를 돌리세요.',
      season: '봄철에 일이 풀리는 결 — 큰 결정은 이 시기로.',
      time: '아침 5~7시(卯時)가 가장 또렷한 결입니다.',
      food: '잎채소, 견과, 곡물이 결을 채워줍니다.',
      item: '식물과 나무 소재 가구와 연필이 결을 살립니다.',
      hobby: '등산, 정원, 식물 가꾸기가 갈증을 풀어줍니다.',
      people: '시작 의지가 또렷한 사람이 결을 채워줍니다.',
    },
    화: {
      color: '빨강, 주황, 핑크가 본인의 표현 결을 살립니다.',
      direction: '남쪽이 결을 키우는 방향 — 햇빛 쪽으로.',
      season: '여름에 일이 풀리는 결 — 큰 결정은 이 시기로.',
      time: '오전 11~13시(午時)가 가장 또렷한 결입니다.',
      food: '매운맛과 따뜻한 음식과 생강이 결을 채워줍니다.',
      item: '캔들, 조명, 붉은 소품이 결을 살립니다.',
      hobby: '운동, 댄스, 요가가 갈증을 풀어줍니다.',
      people: '밝고 에너지 있는 사람이 결을 채워줍니다.',
    },
    토: {
      color: '노랑, 베이지, 황토색이 본인의 안정 결을 살립니다.',
      direction: '중앙과 정중앙이 결을 키우는 자리.',
      season: '환절기(특히 늦여름)에 일이 풀립니다.',
      time: '아침 7~9시(辰時)가 가장 또렷한 결입니다.',
      food: '단맛, 곡물, 뿌리채소가 결을 채워줍니다.',
      item: '도자기, 테라코타, 황토 소품이 결을 살립니다.',
      hobby: '도예, 정원, 산책이 갈증을 풀어줍니다.',
      people: '신뢰감 있고 안정적인 사람이 결을 채워줍니다.',
    },
    금: {
      color: '흰색과 은색이 본인의 단정한 결을 살립니다.',
      direction: '서쪽이 결을 키우는 방향.',
      season: '가을에 일이 풀리는 결 — 큰 결정은 이 시기로.',
      time: '오후 5~7시(酉時)가 가장 또렷한 결입니다.',
      food: '매운맛, 견과, 하얀 음식이 결을 채워줍니다.',
      item: '금속 시계와 미니멀 정리가 결을 살립니다.',
      hobby: '서예, 미니멀, 정리가 갈증을 풀어줍니다.',
      people: '결단력 있고 정갈한 사람이 결을 채워줍니다.',
    },
    수: {
      color: '검정과 짙은 남색이 본인의 사색 결을 살립니다.',
      direction: '북쪽이 결을 키우는 방향.',
      season: '겨울에 일이 풀리는 결 — 큰 결정은 이 시기로.',
      time: '밤 11~1시(子時)가 가장 또렷한 결입니다.',
      food: '짠맛, 해산물, 검은 음식이 결을 채워줍니다.',
      item: '유리, 수정, 반신욕이 결을 살립니다.',
      hobby: '수영, 낚시, 독서가 갈증을 풀어줍니다.',
      people: '깊이 있고 차분한 사람이 결을 채워줍니다.',
    },
  };
  const h = HINTS[primary];
  const rows: Array<{ kr: string; han: string; val: string; hint: string }> = [
    { kr: '색',     han: '色', val: lifestyle.color || '',     hint: h.color },
    { kr: '방위',   han: '方', val: lifestyle.direction || '', hint: h.direction },
    { kr: '계절',   han: '季', val: lifestyle.season || '',    hint: h.season },
    { kr: '시간대', han: '時', val: lifestyle.time || '',      hint: h.time },
    { kr: '음식',   han: '食', val: lifestyle.food || '',      hint: h.food },
    { kr: '물건',   han: '物', val: lifestyle.item || '',      hint: h.item },
    { kr: '취미',   han: '好', val: lifestyle.hobby || '',     hint: h.hobby },
    { kr: '사람',   han: '人', val: lifestyle.people || '',    hint: h.people },
  ].filter((r) => Boolean(r.val));

  const ohengHex: Record<OhengType, string> = {
    목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82',
  };
  const ohengHan: Record<OhengType, string> = {
    목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
  };
  const accent = ohengHex[primary];
  const accentHan = ohengHan[primary];

  return (
    <div
      style={{
        marginTop: 16,
        background: '#FFFFFF',
        border: `1.5px solid ${accent}33`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: `0 3px 14px ${accent}1A`,
      }}
    >
      {/* 헤더 — 오행 컬러 그라데이션 + 용신 한자 도장 */}
      <div
        style={{
          padding: '12px 14px',
          background: `linear-gradient(135deg, ${accent}1A 0%, ${accent}08 100%)`,
          borderBottom: `1px solid ${accent}22`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* 도장형 한자 박스 */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            background: accent,
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 22,
            fontWeight: 900,
            boxShadow: `0 2px 8px ${accent}55`,
            flexShrink: 0,
          }}
        >
          {accentHan}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 13,
              fontWeight: 800,
              color: accent,
              letterSpacing: '0.04em',
              lineHeight: 1.3,
            }}
          >
            용신 일상 적용 8행, 用神 應用 八行
          </div>
          <div style={{ fontSize: 11, color: C.mute, marginTop: 2, lineHeight: 1.5 }}>
            오늘부터 일상 한 켠에 두면 결이 채워집니다 — 작게라도 매일.
          </div>
        </div>
      </div>

      {/* 8행 카드 그리드 — 2 컬럼 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 0,
        }}
      >
        {rows.map((r, i) => {
          const isRightCol = i % 2 === 1;
          const isLastRow = i >= rows.length - 2;
          return (
            <div
              key={i}
              style={{
                padding: '12px 12px 13px',
                borderBottom: isLastRow ? 'none' : `1px dotted ${C.line}`,
                borderRight: isRightCol ? 'none' : `1px dotted ${C.line}`,
                background: i % 4 === 0 || i % 4 === 3 ? '#FAFAF7' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 14,
                    fontWeight: 800,
                    color: accent,
                    width: 18,
                    textAlign: 'center',
                  }}
                >
                  {r.han}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.04em' }}>
                  {r.kr}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: C.ink,
                  lineHeight: 1.55,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {r.val}
              </div>
              <div style={{ fontSize: 11, color: C.mute, lineHeight: 1.5 }}>
                {r.hint}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2C-#6 · LifeStageGrid — 인생 단계 3 카드 (지난/지금/다음)
 *  · v4Daeun 의 current 기준 ±1 대운 → 3 카드
 *  · mockup life-stage-grid 진본 정렬
 * ═════════════════════════════════════════════════════════════════ */
/**
 * NowDaewoonCard — §05 mockup now-daewoon 진본
 *  · 현재 대운 천간/지지 글자별 풀이 + 키 사건 + 조심 (4 row)
 *  · 사용자 일간 + 현재 대운 천간·지지 → 십성 자동 매핑
 */
function NowDaewoonCard({ v4Daeun, dayOheng }: { v4Daeun: V4Daeun[]; dayOheng: OhengType }) {
  const cur = v4Daeun.find((d) => d.current);
  if (!cur || !cur.gz || cur.gz.length < 2) return null;
  const ganHan = cur.gz.charAt(0);
  const jiHan = cur.gz.charAt(1);
  // 천간 한자 → 오행
  const GAN_OHENG: Record<string, OhengType> = {
    甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토',
    庚: '금', 辛: '금', 壬: '수', 癸: '수',
  };
  const JI_OHENG: Record<string, OhengType> = {
    寅: '목', 卯: '목', 巳: '화', 午: '화', 辰: '토', 戌: '토', 丑: '토', 未: '토',
    申: '금', 酉: '금', 亥: '수', 子: '수',
  };
  const ganOheng = GAN_OHENG[ganHan];
  const jiOheng = JI_OHENG[jiHan];

  const SANGSAENG: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const SANGGEUK: Record<OhengType, OhengType> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
  function getSipsung(target: OhengType | undefined): string {
    if (!target) return '';
    if (target === dayOheng) return '비견과 겁재 — 같은 결의 자리';
    if (SANGSAENG[dayOheng] === target) return '식상 — 표현과 창작이 강해지는 자리';
    if (SANGGEUK[dayOheng] === target) return '재성 — 실리와 자원이 손에 잡히는 자리';
    if (SANGGEUK[target] === dayOheng) return '관성 — 책임과 평가가 들어오는 자리';
    if (SANGSAENG[target] === dayOheng) return '인성 — 받아들이고 익히는 자리';
    return '';
  }
  // 키 사건 — 간지 + 십성 조합으로 동적 한 줄
  const ganSip = getSipsung(ganOheng);
  const jiSip = getSipsung(jiOheng);
  const ageRange = cur.age || '';
  // 키 사건과 조심도 사주 specific 변동
  const isStrong = ganOheng === dayOheng || jiOheng === dayOheng;
  const keyEvents = isStrong
    ? `${ageRange.split('~')[0]}년 자기 결을 굳히는 시기. 중반에는 자리와 이름이 한 단계 자리잡습니다.`
    : ganSip.includes('재성') || jiSip.includes('재성')
    ? `${ageRange.split('~')[0]}년 재물과 실리의 첫 문이 열리고, 중반에 결실이 손에 잡힙니다.`
    : ganSip.includes('관성') || jiSip.includes('관성')
    ? `${ageRange.split('~')[0]}년 책임과 자리의 시기. 중반에 평가가 또렷해집니다.`
    : ganSip.includes('인성') || jiSip.includes('인성')
    ? `${ageRange.split('~')[0]}년 학습, 자격, 인연 정비의 시기.`
    : `${ageRange.split('~')[0]}년 표현과 창작이 결의 핵심.`;
  const cautions = isStrong
    ? `같은 결이 겹쳐 자기 결정권이 강해지는 만큼 옆 의견을 의식적으로 듣는 연습.`
    : ganSip.includes('관성')
    ? `위계와 평가가 까다로워지는 시기. 정면 충돌보다 시간차로 풀어내기.`
    : `흐름이 빨라질수록 한 박자 늦추는 룰을 본인 캘린더에 박아두세요.`;

  return (
    <div
      style={{
        // 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). 골드 톤 배경만 유지.
        background: 'linear-gradient(135deg, #fff 0%, rgba(212,175,55,.07) 100%)',
        border: '1px solid #E5DFD0',
        borderRadius: 10,
        padding: '14px 14px',
        margin: '14px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
          <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 24, fontWeight: 800, color: ganOheng ? (EC[OHENG_TO_ELEM[ganOheng]]?.dark || '#1a1a1a') : '#1a1a1a', lineHeight: 1 }}>
            {ganHan}
          </span>
          <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 24, fontWeight: 800, color: jiOheng ? (EC[OHENG_TO_ELEM[jiOheng]]?.dark || '#1a1a1a') : '#1a1a1a', lineHeight: 1, marginTop: 2 }}>
            {jiHan}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.mute, marginBottom: 2 }}>현재 대운, {cur.age}</div>
          <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
            {cur.gz}({cur.kr || ''}) — {cur.label || '진행 중'}의 10년
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ganSip && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.55 }}>
            <span style={{ fontWeight: 700, color: '#7F6B4E', minWidth: 50 }}>천간 {ganHan}</span>
            <span style={{ color: C.inkSoft, flex: 1 }}>{ganSip}</span>
          </div>
        )}
        {jiSip && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.55 }}>
            <span style={{ fontWeight: 700, color: '#7F6B4E', minWidth: 50 }}>지지 {jiHan}</span>
            <span style={{ color: C.inkSoft, flex: 1 }}>{jiSip}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.55 }}>
          <span style={{ fontWeight: 700, color: '#7F6B4E', minWidth: 50 }}>키 사건</span>
          <span style={{ color: C.inkSoft, flex: 1 }}>{keyEvents}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.55 }}>
          <span style={{ fontWeight: 700, color: '#7F6B4E', minWidth: 50 }}>조심</span>
          <span style={{ color: C.inkSoft, flex: 1 }}>{cautions}</span>
        </div>
      </div>
    </div>
  );
}

function LifeStageGrid({ v4Daeun, dayOheng }: { v4Daeun: V4Daeun[]; dayOheng?: OhengType }) {
  const currentIdx = v4Daeun.findIndex((d) => d.current);
  if (currentIdx < 0) return null;
  const past = currentIdx > 0 ? v4Daeun[currentIdx - 1] : null;
  const now = v4Daeun[currentIdx];
  const next = currentIdx + 1 < v4Daeun.length ? v4Daeun[currentIdx + 1] : null;

  // 2026-05-05 audit P0 #5 — sub 동적화
  // 대운 천간 오행 vs 일간 오행 관계 → 십성 분류 → 자리 의미 동적
  function ohengToSip(daeunOheng: OhengType | undefined, dGen: OhengType | undefined): string {
    if (!daeunOheng || !dGen) return '결을 다지는 자리';
    if (daeunOheng === dGen) return '자기 결을 굳히는 자리';
    if (SANGSAENG[dGen] === daeunOheng) return '본인을 풀어내는 자리';
    if (SANGGEUK[dGen] === daeunOheng) return '실리를 챙기는 자리';
    if (SANGGEUK[daeunOheng] === dGen) return '책임을 받는 자리';
    if (SANGSAENG[daeunOheng] === dGen) return '받쳐 배우는 자리';
    return '결을 다지는 자리';
  }
  // V4Daeun 의 천간 오행 추출 (gz 첫 글자 → 오행)
  const ganOhMap: Record<string, OhengType> = {
    甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토',
    庚: '금', 辛: '금', 壬: '수', 癸: '수',
  };
  const sub = (d: V4Daeun | null): string => {
    if (!d) return '—';
    const ganHan = d.gz?.charAt(0);
    const ohType = ganHan ? ganOhMap[ganHan] : undefined;
    return ohengToSip(ohType, dayOheng);
  };
  const stages: Array<{ label: string; data: V4Daeun | null; isNow: boolean; sub: string }> = [
    { label: '지난 10년', data: past, isNow: false, sub: past ? `되돌아본 ${sub(past)}` : '—' },
    { label: '지금', data: now, isNow: true, sub: `지금의 ${sub(now)}` },
    { label: '다음 10년', data: next, isNow: false, sub: next ? `다가오는 ${sub(next)}` : '—' },
  ];
  // mockup .life-stage-grid .life-stage-card 진본 — className 만 사용
  return (
    <div className="life-stage-grid">
      {stages.map((s, i) => (
        <div key={i} className={`life-stage-card${s.isNow ? ' now' : ''}`}>
          <div className="ls-tag">{s.label}</div>
          {s.data ? (
            <>
              <div className="ls-age">{s.data.age}</div>
              <div className="ls-glyph">{s.data.gz}</div>
              <div className="ls-key">{s.sub}</div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#7F6B4E', fontStyle: 'italic', padding: '12px 0' }}>—</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2C-#4 · SinsalThreeTier — 신살 3 tier (강·중·참고)
 *  · v4Gilsin / v4Hyungsal 을 강도별 분류
 *  · 강 (3+): 핵심 별
 *  · 중 (2): 작용
 *  · 참고 (1): 약함 / 시기성
 * ═════════════════════════════════════════════════════════════════ */
/** AI shinsalCards 구조 — server (claudePremium.ts) 신살 카드 schema */
interface AiShinsalCard {
  kr?: string; hanja?: string; tier?: string; from?: string;
  desc?: string; action?: string; strength?: number; when?: string;
}

/* mockup §7 .shinsal-card 진본 — 3-tier 카드 (강·중·참고) + adv 블록 */
function SinsalThreeTier({ gilsin, hyungsal, aiCards }: { gilsin: V4SinSal[]; hyungsal: V4SinSal[]; aiCards?: AiShinsalCard[] }) {
  if ((gilsin?.length ?? 0) + (hyungsal?.length ?? 0) === 0) {
    return (
      <p
        style={{
          fontSize: 12.5,
          color: '#5C4A2E',
          textAlign: 'center',
          margin: '20px 0',
          padding: 14,
          background: '#F8F5EE',
          borderRadius: 10,
          border: '1px dashed #E5DFD0',
        }}
      >
        이번 사주에는 강하게 발현된 핵심 신살이 없습니다.
        <br />
        균형 잡힌 결로 보아도 좋습니다.
      </p>
    );
  }

  // tier 분류: gilsin 첫 2개 = 강, 다음 2개 = 중, 나머지 + hyungsal = 참고
  const all = [...(gilsin ?? []), ...(hyungsal ?? [])];
  const strong = all.slice(0, 2);
  const mid = all.slice(2, 4);
  const ref = all.slice(4);

  // 신살별 실천 팁 (mockup 패턴 — 한 줄 액션)
  const ACTION_TIP: Record<string, string> = {
    도화살: '한 달에 하루는 약속 없이 혼자 보낼 것. 도화는 적당히 거리를 두는 사람에게 가장 강하게 작동합니다.',
    문창귀인: '"쓰는 채널" 한 곳을 5년 단위로 굴릴 것. 직업 선택 시 글과 강의가 들어가는 자리가 무조건 유리합니다.',
    천을귀인: '결정적 순간에 도와줄 사람이 나타납니다. 평소 인연을 가벼이 보지 마세요.',
    역마살: '3년 이상 같은 자리에 묶이지 않도록 의식적으로 영역을 넓힐 것. 한 회사에서도 직무 전환을 활용합니다.',
    홍염살: '결혼과 동거의 큰 결정은 36~38세에 안정됩니다. 그 전에는 강도보다 다양성을 경험하세요.',
    화개살: '예술, 연구, 종교성 — 한 분야를 깊이 파고드는 결을 살리세요.',
    학당귀인: '평생 학습 — 자격, 언어, 전문 분야 하나는 꾸준히 갱신.',
    백호살: '추진력은 강점, 건강은 부담. 매년 같은 달에 종합검진 예약.',
    공망: '辰 巳 해에는 새 사업과 큰 투자를 미루고 학습, 자격, 관계 정비에 시간을 투자하세요.',
    원진살: '특정 띠 사람과는 거리감 유지. 같은 일은 멀리서 다루는 편이 낫습니다.',
    양인살: '결단력의 양면 — 큰 결정 전 24시간 보류 룰을 두세요.',
  };

  // AI shinsalCards 우선 lookup (hanja/kr 매칭)
  const aiMap: Record<string, AiShinsalCard> = {};
  if (Array.isArray(aiCards)) {
    for (const c of aiCards) {
      if (c?.hanja) aiMap[c.hanja] = c;
      if (c?.kr) aiMap[c.kr] = c;
    }
  }
  // 한글 매핑이 없는 신살에 대한 일반 액션 — 신살 카테고리 + source 기준 동적
  function getDefaultAction(s: V4SinSal): string {
    const fromLabel = s.source ? `${s.source} 기준의 ` : '';
    if (/살|殺|煞/.test(s.hanja)) return `${fromLabel}강한 결이라 의식적으로 거리를 둘 자리. 큰 결정은 24시간 보류 룰을 두세요.`;
    if (/귀인|貴人|덕|德|희|喜|은|恩|생기|生氣|요안|要安|천을|天乙/.test(s.hanja)) return `${fromLabel}도와줄 인연과 기회가 들어오는 결. 어려울 때 주변에 먼저 손 내밀면 풀립니다.`;
    if (/공망|空亡/.test(s.hanja)) return `${fromLabel}해당 글자가 들어오는 해엔 새 일보다 학습, 자격, 관계 정비에 시간을 투자하세요.`;
    if (/사|死/.test(s.hanja)) return `${fromLabel}활기가 약해지는 자리. 충분한 휴식과 회복 루틴이 필요합니다.`;
    if (/효|孝|모|母/.test(s.hanja)) return `${fromLabel}돌봄, 양육, 후배 멘토링 자리에서 결이 살아납니다.`;
    return ''; // 2026-06-13 — 제네릭 필러('강점 살리고 약점 다루세요') 제거: 신살마다 동일 반복 = AI 템플릿 느낌. 액션 없으면 실천줄 미노출
  }

  // source 기준 prefix — 같은 신살이라도 일주/월주 기준마다 다른 작용
  function withFromPrefix(s: V4SinSal, baseAction: string): string {
    if (!s.source) return baseAction;
    return `${s.source} 기준 — ${baseAction}`;
  }

  function renderCard(s: V4SinSal, dots: number, when: string, isFull: boolean, whenClass: 'always' | 'dae' | 'year') {
    const ai = aiMap[s.hanja] || aiMap[s.kr];
    // AI action 우선 → ACTION_TIP[s.kr] (with from prefix) → getDefaultAction
    const baseAction = ai?.action?.trim() || (ACTION_TIP[s.kr] && withFromPrefix(s, ACTION_TIP[s.kr])) || getDefaultAction(s);
    const action = baseAction;
    const desc = ai?.desc?.trim() || s.desc;
    const fromText = ai?.from?.trim();
    const krLabel = s.kr && s.kr !== s.hanja && /[가-힣]/.test(s.kr) ? s.kr : '신살';
    return (
      <div key={`${s.kr}-${dots}`} className={`shinsal-card${isFull ? '' : ' mid'}`}>
        <div className="head">
          <span className="nm">{krLabel}</span>
          <span className="han">{s.hanja}</span>
          {fromText && <span className="han" style={{ fontSize: 11, color: '#7F6B4E' }}>, {fromText}</span>}
          <span className="tag">{isFull ? '강, 핵심' : '중, 작동'}</span>
        </div>
        {/* 2026-05-05: <strong> raw text 차단 */}
        <p dangerouslySetInnerHTML={{ __html: sanitizeAiText(desc) }} />
        <div className="shinsal-meta">
          <div className="sm-pulse" title="작동 강도">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={i < dots ? 'on' : undefined} />
            ))}
          </div>
          <span className={`sm-when ${whenClass}`}>{when}</span>
        </div>
        {action && action.trim() && (
          <div className="adv">
            <span className="adv-icon">!</span>
            {/* 2026-05-04 fix: action 안의 <strong> raw text → dangerouslySetInnerHTML */}
            <span className="adv-text" dangerouslySetInnerHTML={{ __html: `<strong>실천:</strong> ${sanitizeAiText(action)}` }} />
          </div>
        )}
      </div>
    );
  }

  // 2026-05-04 갈아엎기 (준기 결단) — 핵심('강') 신살만 깊이 카드, 중·참고는 한 줄 칩.
  // 중·참고 신살 한 줄 카드 (이름 + 한자 + 한 줄 의미 + 작동 시기 만)
  function renderMiniRow(s: V4SinSal, when: '상시' | '특정 시기') {
    const ai = aiMap[s.hanja] || aiMap[s.kr];
    const desc = (ai?.desc?.trim() && ai.desc.length <= 70) ? ai.desc : (s.desc.length <= 70 ? s.desc : s.desc.slice(0, 60) + '…');
    const krLabel = s.kr && s.kr !== s.hanja && /[가-힣]/.test(s.kr) ? s.kr : '신살';
    return (
      <div
        key={`${s.kr}-mini`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: '#FFFFFF',
          border: '1px solid #E5DFD0',
          borderRadius: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 14, fontWeight: 800, color: '#1A1A1A', minWidth: 36 }}>{krLabel}</span>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 12, color: '#7F6B4E', minWidth: 28 }}>{s.hanja}</span>
        {/* 2026-05-05: <strong> raw text 차단 */}
        <span style={{ flex: 1, fontSize: 12.5, color: '#3D3D3D', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(desc) }} />
        <span style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 999,
          background: when === '상시' ? 'rgba(78,122,87,0.10)' : 'rgba(184,150,90,0.14)',
          color: when === '상시' ? '#355A3E' : '#8C6D3D',
          letterSpacing: '0.04em',
        }}>{when}</span>
      </div>
    );
  }

  return (
    <>
      {/* 강 (핵심) — 큰 카드 (깊이 풀이 + 실천) */}
      {strong.length > 0 && (
        <>
          <h4 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 13, color: '#1A1A1A', fontWeight: 800, margin: '4px 0 8px', letterSpacing: '0.02em' }}>
            핵심 신살 <span style={{ fontSize: 11, color: '#8C6D3D', fontWeight: 700, marginLeft: 4 }}>본인 결의 중심</span>
          </h4>
          <div className="shinsal-list">
            {strong.map((s) => renderCard(s, 5, '상시 작동', true, 'always'))}
          </div>
        </>
      )}
      {/* 중 + 참고 — 한 줄 카드 (이름·한자·한 줄·작동 시기) */}
      {(mid.length > 0 || ref.length > 0) && (
        <>
          <h4 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 12.5, color: '#7A7269', fontWeight: 700, margin: '18px 0 8px', letterSpacing: '0.02em' }}>
            그 외 신살 <span style={{ fontSize: 11, color: '#A8A097', fontWeight: 600, marginLeft: 4 }}>부수적과 시기별 작동</span>
          </h4>
          <div>
            {mid.map((s) => renderMiniRow(s, '상시'))}
            {ref.map((s) => renderMiniRow(s, '특정 시기'))}
          </div>
        </>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2C-#5 · RelationSixCards — 관계의 결 6 카드 (六親)
 *  · 부모/형제/배우자/자녀/친구/상사 6개
 *  · 십성 매칭 자동 도출 + 한 줄 풀이 (✓ 살릴 것 / ⚠ 조심)
 *  · mockup rel6-list 진본 정렬
 * ═════════════════════════════════════════════════════════════════ */
/** AI rel6Cards 구조 — server (claudePremium.ts) 의 rel6Cards 와 정합 */
interface AiRel6Card { summary?: string; save?: string; avoid?: string; tag?: string }
interface AiRel6Cards {
  parent?: AiRel6Card; sibling?: AiRel6Card; spouse?: AiRel6Card;
  child?: AiRel6Card; friend?: AiRel6Card; boss?: AiRel6Card;
}
// 2026-05-05 dead code (준기 결단 · 다음 sprint 재도입 가능)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-expect-error preserved
function _RelationSixCards({ sipDist, aiCards }: { sipDist: any; aiCards?: AiRel6Cards }) {
  type RelKey = 'parent' | 'sibling' | 'spouse' | 'child' | 'friend' | 'boss';
  // 사주별 동적 — 십성 카운트별 summary 생성 함수
  const sip = {
    인성: Number(sipDist?.인성 ?? 0),
    비겁: Number(sipDist?.비겁 ?? 0),
    재성: Number(sipDist?.재성 ?? 0),
    식상: Number(sipDist?.식상 ?? 0),
    관성: Number(sipDist?.관성 ?? 0),
  };
  const summaries: Record<RelKey, string> = {
    parent:
      sip.인성 >= 3
        ? `<strong>인성 ${sip.인성}자</strong>로 부모 영향이 매우 깊은 결입니다. 정서, 습관, 진로 결정까지 부모의 결이 본인 안에 깊게 자리잡고 있습니다.`
        : sip.인성 >= 1
        ? `<strong>인성 ${sip.인성}자</strong>로 부모와의 결이 자연스럽게 연결됩니다. 받쳐주고 또 받치는 양방향 관계로 잘 풀립니다.`
        : `<strong>인성 0자</strong>로 어려서부터 자기 결로 길을 낸 자리입니다. 부모와는 정서적 의존보다 <strong>실용적 거리</strong>가 어울립니다.`,
    sibling:
      sip.비겁 >= 3
        ? `<strong>비겁 ${sip.비겁}자</strong>로 형제와 동기 결이 두텁습니다. 같은 결끼리 모이는 자리가 자주 만들어지지만, <strong>경쟁과 갈등의 결</strong>도 함께 따라옵니다.`
        : sip.비겁 >= 1
        ? `<strong>비겁 ${sip.비겁}자</strong>로 형제와 동기와 <strong>균형 잡힌 거리</strong>를 두는 결입니다. 기댈 한두 명은 있지만 의존하지는 않는 자리.`
        : `<strong>비겁 0자</strong>로 형제와 동기 결이 얇은 자리입니다. <strong>혼자 결정과 혼자 길을 내는 결</strong>이라, 깊은 친구 한두 명이 평생 자산이 됩니다.`,
    spouse:
      sip.재성 >= 3
        ? `<strong>재성 ${sip.재성}자</strong>로 배우자와 이성 결이 풍부합니다. <strong>안정된 결의 사람</strong>이 길게 가지만, 너무 많은 선택이 결정을 미루는 함정.`
        : sip.재성 >= 1
        ? `<strong>재성 ${sip.재성}자</strong>로 배우자 결이 안정적입니다. 일, 가정, 돈을 함께 그릴 수 있는 결의 사람이 어울립니다.`
        : `<strong>재성 0자</strong>로 배우자 결을 <strong>본인이 의식적으로 만들어가야</strong> 하는 자리. 자연발생보다 약속과 구조가 관계를 살립니다.`,
    child:
      sip.식상 >= 3
        ? `<strong>식상 ${sip.식상}자</strong>로 자녀 결이 두텁고 표현과 창의의 결을 자녀에게 그대로 물려주는 자리입니다. <strong>본인이 주는 만큼 자녀가 빛나는</strong> 결.`
        : sip.식상 >= 1
        ? `<strong>식상 ${sip.식상}자</strong>로 자녀의 표현과 창작을 자연스럽게 받쳐주는 결. 함께 무언가를 만드는 시간이 가장 깊은 정.`
        : `<strong>식상 0자</strong>로 자녀와의 결이 <strong>구조와 약속 중심</strong>으로 풀리는 자리. 감정 표현보다 일관된 환경이 더 큰 정.`,
    friend:
      sip.비겁 >= 3
        ? `<strong>비겁 ${sip.비겁}자</strong>로 친구와 동료 결이 두텁습니다. 모임의 중심이 자주 되지만, <strong>자기 결이 흐려지는 위험</strong>도 함께.`
        : sip.비겁 >= 1
        ? `<strong>비겁 ${sip.비겁}자</strong>로 친구와 동료 결이 균형 잡혀 있습니다. 폭은 넓지 않아도 깊이 있는 한두 명이 운의 다리.`
        : `<strong>비겁 0자</strong>로 친구와 동료 결이 얇은 자리. <strong>넓게보다 깊게</strong>가 사주의 답. 한두 명에 집중하면 평생 자산.`,
    boss:
      sip.관성 >= 3
        ? `<strong>관성 ${sip.관성}자</strong>로 상사와 권위 결이 매우 강한 자리. 자리와 평가가 빠르게 따라오지만, <strong>위에서 내려오는 압력</strong>도 그만큼 큽니다.`
        : sip.관성 >= 1
        ? `<strong>관성 ${sip.관성}자</strong>로 조직과 권위 결이 자리잡고 있습니다. 책임과 평가의 결이 본인을 단단하게 만듭니다.`
        : `<strong>관성 0자</strong>로 상사와 위계의 결이 얇은 자리. <strong>본인 판단과 재량이 보장되는 자리</strong>(1인 프로젝트, 창업, 임원)에서 가장 빛납니다.`,
  };

  // sixBase — 6 카드 메타 (한자/한글/sipsung/save/careful — 사주별 동적)
  const sixBase: Array<{
    relKey: RelKey;
    cls: string;
    name: string;
    label: string;
    sipsung: '비겁' | '식상' | '재성' | '관성' | '인성';
    save: string;
    careful: string;
    why: string;
  }> = [
    { relKey: 'parent', cls: 'c-parent', name: '父 母', label: '부모', sipsung: '인성',
      save: `<strong>주기적 안부 + 짧은 방문</strong>이 큰 자산입니다. 인성은 받는 자리라 ${sip.인성 >= 2 ? '연락 빈도가 곧 관계의 깊이' : '간격을 두되 정성을 모으는 방식'}이 어울립니다.`,
      careful: `${sip.인성 >= 3 ? '본가에서 큰 결정을 협의하지 마세요. <strong>결정은 본가 밖에서 내리고 결과만 공유</strong>하세요. 의견이 본인 결을 덮어버립니다.' : '효심으로 자립을 미루기 쉬운 자리. <strong>독립의 결단</strong>은 본인이 짚어야 합니다.'}`,
      why: `인성은 부모, 스승, 받는 자리. ${sip.인성}자 분포가 부모와의 거리감을 결정합니다.`,
    },
    { relKey: 'sibling', cls: 'c-sibling', name: '兄 弟', label: '형제와 동기', sipsung: '비겁',
      save: `${sip.비겁 >= 2 ? '같은 분야 협업은 폭발력이 큽니다. <strong>역할과 지분을 시작 전에 문서화</strong>해야 합니다.' : '<strong>깊은 한두 명</strong>에게 정성을 모으세요. 넓게 흩어지면 결이 얕아집니다.'}`,
      careful: `<strong>금전 거래와 공동 투자는 사주가 가장 약한 자리</strong>입니다. 비겁이 ${sip.비겁}자이면 한 번 깨지면 크게 깨집니다. 돈 주고받기는 ${sip.비겁 >= 2 ? '계약서와 이자' : '소액 한정'}으로.`,
      why: `비겁은 동기, 경쟁, 동등한 결의 자리. 이 결이 ${sip.비겁}자면 형제와 동료 관계의 채도가 그만큼 진해집니다.`,
    },
    { relKey: 'spouse', cls: 'c-spouse', name: '配 偶', label: '배우자와 연인', sipsung: '재성',
      save: `${sip.재성 >= 2 ? '<strong>꾸준한 결의 사람</strong>이 잘 어울립니다. 안정된 약속과 실리 기반의 관계가 가장 길게 갑니다.' : '<strong>먼저 표현하고 먼저 약속</strong>하는 자리. 자연발생을 기다리면 결이 흐려집니다.'}`,
      careful: `즉흥적과 강한 카리스마형은 흔들림이 큽니다. <strong>차분히 받쳐주는 결</strong>을 우선하세요. ${sip.재성 >= 3 ? '재성이 풍족할수록 선택지에 휘둘리기 쉽습니다.' : '재성이 적을수록 한 번 정한 결을 오래 가져가는 편이 안전합니다.'}`,
      why: `재성은 결혼, 이성, 돈의 자리. ${sip.재성}자 분포가 배우자 결의 두께를 결정합니다.`,
    },
    { relKey: 'child', cls: 'c-child', name: '子 女', label: '자녀', sipsung: '식상',
      save: `${sip.식상 >= 2 ? '자녀의 <strong>표현과 창작을 적극적으로 받아주는 부모</strong>가 됩니다. 함께 무언가를 만드는 시간이 자산.' : '자녀에게 <strong>일관된 환경과 예측 가능한 약속</strong>이 큰 정. 감정 표현보다 구조가 정을 만듭니다.'}`,
      careful: `${sip.식상 >= 2 ? '본인의 기준을 자녀에게 투영하기 쉽습니다. <strong>다른 결을 받아들이는 연습</strong>이 평생 과제입니다.' : '자녀의 표현 욕구를 자기 기준으로 누르지 않도록. <strong>침묵보다 한 줄의 인정</strong>이 결을 살립니다.'}`,
      why: `식상은 표현, 자녀, 내가 만들어내는 결의 자리. ${sip.식상}자 분포가 자녀 관계의 결을 결정합니다.`,
    },
    { relKey: 'friend', cls: 'c-friend', name: '朋 友', label: '친구와 동료', sipsung: '비겁',
      save: `${sip.비겁 >= 2 ? '<strong>인연의 달에 만난 사람</strong>은 한 해 내내 이어집니다. 작은 정성이 다음 운의 다리.' : '<strong>깊은 한두 명</strong>에게 정성을 모으세요. 넓게보다 깊게가 사주의 답.'}`,
      careful: `${sip.비겁 >= 3 ? '사람이 많아지면 자기 결을 잃기 쉽습니다. <strong>한 달에 하루는 약속 없는 날</strong>을 캘린더에 못 박으세요.' : '얕은 자리에 정성을 흩지 마세요. <strong>받기보다 주는 자리</strong>를 미리 정해두는 편이 안전합니다.'}`,
      why: `비겁은 친구, 동료, 동등한 결의 자리. ${sip.비겁}자 분포가 인연의 폭과 깊이를 결정합니다.`,
    },
    { relKey: 'boss', cls: 'c-boss', name: '上 司', label: '상사와 권위', sipsung: '관성',
      save: `${sip.관성 >= 2 ? '본인의 <strong>판단과 재량이 보장되는 자리</strong>(임원과 핵심 PM, 1인 프로젝트)에서 빛납니다.' : '본인의 <strong>판단과 재량이 보장되는 자리</strong>(1인 프로젝트와 창업)에서 가장 빛납니다.'}`,
      careful: `${sip.관성 >= 3 ? '책임이 몰리는 결. <strong>위에서 내려오는 평가에 자기 결을 잃지 않도록</strong> 분기마다 본인 우선순위 점검.' : '위계가 단단한 조직에서 오래 버티려 하면 본인 사주를 거스르는 일. <strong>5년 이상은 권하지 않습니다.</strong>'}`,
      why: `관성은 책임, 평가, 위계의 자리. ${sip.관성}자 분포가 조직 내 입지의 결을 결정합니다.`,
    },
  ];

  // tag 분류: AI 가 tag 제공하면 사용, 없으면 sipDist 기반 자동
  const tagOf = (key: '인성' | '비겁' | '재성' | '식상' | '관성', aiTag?: string): { cls: 't-warn' | 't-good' | 't-neut'; label: string } => {
    if (aiTag) {
      const cls = (aiTag === '태과' || aiTag === '긴장' || aiTag === '주의') ? 't-warn'
        : (aiTag === '안정' || aiTag === '풍족' || aiTag === '36~38 안정') ? 't-good'
        : 't-neut';
      return { cls, label: aiTag };
    }
    const c = Number(sipDist[key] ?? 0);
    if (c >= 3) return { cls: 't-warn', label: '태과' };
    if (c >= 2) return { cls: 't-good', label: '풍족' };
    if (c >= 1) return { cls: 't-neut', label: '보유' };
    return { cls: 't-warn', label: '얇음' };
  };

  return (
    <div className="rel6-list">
      {sixBase.map((r) => {
        const ai = aiCards?.[r.relKey];
        // 2026-05-04 sanitize: AI <strong>·HTML 태그 raw text 노출 차단
        const aiSummary = sanitizeAiText(ai?.summary);
        const aiSave = sanitizeAiText(ai?.save);
        const aiAvoid = sanitizeAiText(ai?.avoid);
        const summary = aiSummary.length >= 30 ? aiSummary : summaries[r.relKey];
        const save = aiSave.length >= 25 ? aiSave : r.save;
        const careful = aiAvoid.length >= 25 ? aiAvoid : r.careful;
        const tag = tagOf(r.sipsung, ai?.tag);
        return (
          <div key={r.relKey} className={`rel6-card ${r.cls}`}>
            <div className="rel6-head">
              <span className="rel6-name">{r.name}</span>
              <span className="rel6-label">{r.label}</span>
              <span className={`rel6-tag ${tag.cls}`}>{tag.label}</span>
            </div>
            <p className="rel6-summary" dangerouslySetInnerHTML={{ __html: summary }} />
            {/* 왜 이런 결인가 — sipDist 기반 메커니즘 한 줄 */}
            <p className="rel6-why">
              <span className="rel6-why-label">왜</span>
              <span dangerouslySetInnerHTML={{ __html: r.why }} />
            </p>
            <div className="rel6-actions">
              <div className="rel6-do">
                <span className="ic">살릴 것</span>
                <span className="txt" dangerouslySetInnerHTML={{ __html: save }} />
              </div>
              <div className="rel6-dont">
                <span className="ic">조심할 것</span>
                <span className="txt" dangerouslySetInnerHTML={{ __html: careful }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2C-2 #1 · GanjiFlow — 합·충·형·파·해·원진 시각 chip group
 *  · relations.ts 활용 (사주 8글자 간 관계 자동 도출)
 *  · 합 (녹) / 충 (빨) / 형·파·해·원진 (골드 경고)
 * ═════════════════════════════════════════════════════════════════ */
/* mockup §2 .ganji-flow 진본 — 4 rows (글자 ↔ 글자 · 설명 · tag) */
function GanjiFlow({ sajuData }: { sajuData: SajuData }) {
  const rel = useMemoLite(
    () => analyzeRelations(sajuData.pillars, sajuData.gongmang),
    [sajuData],
  );

  // 한자 → 오행 컬러 매핑
  const HAN_OHENG_COLOR: Record<string, string> = {
    甲: '#4E7A57', 乙: '#4E7A57', 寅: '#4E7A57', 卯: '#4E7A57',
    丙: '#c62828', 丁: '#c62828', 巳: '#c62828', 午: '#c62828',
    戊: '#B07F38', 己: '#B07F38', 辰: '#B07F38', 戌: '#B07F38', 丑: '#B07F38', 未: '#B07F38',
    庚: '#7D7870', 辛: '#7D7870', 申: '#7D7870', 酉: '#7D7870',
    壬: '#3E5F82', 癸: '#3E5F82', 亥: '#3E5F82', 子: '#3E5F82',
  };
  // 한자 → 한글 reading (사람들이 한자 못 읽을 때 보조)
  const HAN_TO_KR: Record<string, string> = {
    甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기',
    庚: '경', 辛: '신', 壬: '임', 癸: '계',
    子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
    午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
  };

  type Row = {
    char1: string;
    char2: string;
    arrow: string;
    desc: string;
    type: 'hap' | 'chung' | 'hyeong';
    label?: string; // 2026-06-13 — 배지 정확화 (형/파/해/원진/자형 구분 · 기존 무조건 '형' 버그 fix)
  };

  // dedupe key — A·B 정렬해서 unique pair + relation type
  const seen = new Set<string>();
  function pushOnce(row: Row, relSubtype: string) {
    const pair = [row.char1, row.char2].sort().join('-');
    const k = `${pair}::${relSubtype}`;
    if (seen.has(k)) return;
    seen.add(k);
    rows.push(row);
  }

  const rows: Row[] = [];

  // 합
  for (const r of rel.cheongan.filter((x) => x.type === '천간합')) {
    pushOnce({
      char1: r.chars[0],
      char2: r.chars[1],
      arrow: '↔',
      desc: r.resultOheng ? `서로 끌어당겨 ${r.resultOheng} 기운으로 뭉쳐요 — 협력과 시너지가 나는 짝` : '서로 끌어당겨 하나로 묶이는 짝',
      type: 'hap',
    }, '천간합');
  }
  for (const r of rel.jijiHap) {
    const isBan = r.type?.includes('반합');
    pushOnce({
      char1: r.chars[0],
      char2: r.chars[1],
      arrow: isBan ? '+' : '↔',
      desc: r.resultOheng ? `${isBan ? '반쯤 ' : ''}끌어당겨 ${r.resultOheng} 기운으로 뭉쳐요` : `${isBan ? '반쯤 ' : ''}끌어당기는 짝`,
      type: 'hap',
    }, isBan ? '지지반합' : '지지합');
  }
  // 충
  for (const r of rel.cheongan.filter((x) => x.type === '천간충')) {
    pushOnce({
      char1: r.chars[0],
      char2: r.chars[1],
      arrow: '↔',
      desc: '마음이 정면으로 부딪혀요 — 결단이 빠른 만큼 충돌도 잦아요',
      type: 'chung',
    }, '천간충');
  }
  for (const r of rel.jijiClash.filter((x) => x.type === '지지충')) {
    pushOnce({
      char1: r.chars[0],
      char2: r.chars[1],
      arrow: '↔',
      desc: '행동 방향이 엇갈려요 — 환경 변화가 잦은 자리',
      type: 'chung',
    }, '지지충');
  }
  // 형·파·해·원진 (각 type 별로 dedupe)
  for (const r of rel.jijiClash.filter((x) => x.type !== '지지충')) {
    const t = r.type || '';
    const subtype = t.includes('자형') ? '자형'
      : t.includes('형') ? '형'
      : t.includes('파') ? '파'
      : t.includes('해') ? '해'
      : t.includes('원진') ? '원진'
      : t;
    const arrow =
      t.includes('형') ? '↔' :
      t.includes('파') ? '/' :
      t.includes('해') ? '✕' :
      t.includes('원진') ? '↺' : '↔';
    pushOnce({
      char1: r.chars[0],
      char2: r.chars[1] || r.chars[0],
      arrow,
      desc:
        t.includes('자형') ? '스스로를 옥죄는 버릇 — 자기검열이 강한 편' :
        t.includes('형') ? '결이 어긋나요 — 가까울수록 신경전이 생겨요' :
        t.includes('파') ? '쌓은 게 흐트러지기 쉬워요 — 마무리 한 번 더 점검' :
        t.includes('해') ? '은근히 풀리지 않아요 — 손해 보는 관계는 거리두기' :
        t.includes('원진') ? '끌리면서도 미워지는 짝 — 애증이 교차해요' :
        '결이 어긋나는 자리',
      type: 'hyeong',
      label: subtype, // 자형/형/파/해/원진 — 배지에 그대로 노출
    }, subtype);
  }

  if (rows.length === 0) return null;

  // mockup §2 .ganji-flow 진본 — className 만 사용 + 한자 옆 한글 reading 추가
  return (
    <div className="ganji-flow">
      <div className="gf-title">사주에 새겨진 글자 간 관계</div>
      {rows.map((r, i) => {
        const tagLabel = r.label || (r.type === 'hap' ? '합' : r.type === 'chung' ? '충' : '형');
        const kr1 = HAN_TO_KR[r.char1] || '';
        const kr2 = HAN_TO_KR[r.char2] || '';
        return (
          <div key={i} className="gf-row">
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: 22 }}>
              <span className="gf-glyph" style={{ color: HAN_OHENG_COLOR[r.char1] || '#7F6B4E', lineHeight: 1 }}>
                {r.char1}
              </span>
              {kr1 && <span style={{ fontSize: 8.5, color: '#a08a5a', marginTop: 1 }}>{kr1}</span>}
            </span>
            <span className="gf-arrow">{r.arrow}</span>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: 22 }}>
              <span className="gf-glyph" style={{ color: HAN_OHENG_COLOR[r.char2] || '#7F6B4E', lineHeight: 1 }}>
                {r.char2}
              </span>
              {kr2 && <span style={{ fontSize: 8.5, color: '#a08a5a', marginTop: 1 }}>{kr2}</span>}
            </span>
            <span style={{ color: '#5C4A2E', flex: 1 }}>{r.desc}</span>
            <span className={`gf-type ${r.type}`}>{tagLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

/* useMemoLite — useMemo 대체 (이 파일은 useMemo import 안 됐으므로 inline 처리) */
function useMemoLite<T>(factory: () => T, _deps: any[]): T {
  // 단순 inline 호출 — react.useMemo 사용 위해 import 필요한데,
  // 본 파일은 가벼운 헬퍼 무관 (props 변동 적음)
  return factory();
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2C-2 #2 · DaewoonScores — 8 row 점수 막대 (정점/현재 강조)
 *  · v4Daeun 의 score 필드 활용 (또는 inline 산출)
 * ═════════════════════════════════════════════════════════════════ */
function DaewoonScores({ v4Daeun, dayOheng }: { v4Daeun: V4Daeun[]; dayOheng: OhengType }) {
  if (!v4Daeun || v4Daeun.length === 0) return null;
  // 2026-05-04 명리학 fallback (AI score 없을 때) — 일간 vs 대운 천간 관계 기반
  // 자연수 사용 (5의 배수 금지) + 8 대운 모두 다른 값 강제
  const ELEM_TO_OHENG: Record<string, OhengType> = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };
  const SS_LOCAL: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const SG_LOCAL: Record<OhengType, OhengType> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
  function calcDaeunScore(daeunOheng: OhengType): number {
    if (daeunOheng === dayOheng) return 71;             // 비겁
    if (SS_LOCAL[dayOheng] === daeunOheng) return 77;   // 식상 (내가 생함)
    if (SG_LOCAL[dayOheng] === daeunOheng) return 67;   // 재성 (내가 극함)
    if (SG_LOCAL[daeunOheng] === dayOheng) return 56;   // 관성 (나를 극함)
    if (SS_LOCAL[daeunOheng] === dayOheng) return 83;   // 인성 (나를 생함)
    return 64;
  }
  const usedScores = new Set<number>();
  const items = v4Daeun.slice(0, 8).map((d, idx) => {
    const aiScore = (d as any).score;
    if (typeof aiScore === 'number' && aiScore >= 0 && aiScore <= 100) {
      return { ...d, score: aiScore };
    }
    // fallback — 명리학 base + idx 별 자연 분산 (8개 모두 다른 자연수)
    const ganOheng = ELEM_TO_OHENG[String(d.elem)] || '토';
    let score = calcDaeunScore(ganOheng);
    // idx 별 미세 변동 — 인생 곡선 단조 X
    const microShifts = [-2, +1, +4, -1, +3, -3, +2, 0];
    score += microShifts[idx] ?? 0;
    // 5의 배수 회피
    if (score % 5 === 0) score += (idx % 2 === 0) ? 1 : -1;
    // 중복 점수 회피 — ±1 씩 조정
    while (usedScores.has(score)) score += 1;
    usedScores.add(score);
    return { ...d, score: Math.min(100, Math.max(40, score)) };
  });
  const peak = Math.max(...items.map((d) => d.score));
  // mockup .daewoon-scores 진본 — className 만 사용
  return (
    <div className="daewoon-scores">
      <div className="ds-title">대운 점수 추이 (8주기, 100점 만점)</div>
      {items.map((d, i) => {
        const isCurrent = d.current === true;
        const isPeak = d.score === peak && peak >= 70 && !isCurrent;
        const fillCls = isPeak ? 'ds-fill peak' : isCurrent ? 'ds-fill now' : 'ds-fill';
        return (
          <div key={i} className="ds-row">
            <span className="ds-age">{d.age}</span>
            <div className="ds-track">
              <div className={fillCls} style={{ width: `${d.score}%` }} />
            </div>
            <span className="ds-score">{d.score}</span>
          </div>
        );
      })}
      <div className="ds-caption">
        정점은 <strong style={{ color: '#4E7A57' }}>{items.find((d) => d.score === peak)?.age || ''} {items.find((d) => d.score === peak)?.gz || ''} 대운</strong>입니다.
        {items.find((d) => d.score === peak)?.scoreReason
          ? ` ${items.find((d) => d.score === peak)?.scoreReason}`
          : ' 지금 시기는 그 정점을 받아낼 그릇을 굽는 시기로 보면 됩니다.'}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2C-2 #3 · DaewoonLine60 — 60년 가로 시간선
 *  · 8 대운 가로 막대 + 시작 나이 마커 + 정점 별 + 현재 ring
 * ═════════════════════════════════════════════════════════════════ */
function DaewoonLine60({ v4Daeun, sajuData: _sajuData }: { v4Daeun: V4Daeun[]; sajuData: SajuData }) {
  if (!v4Daeun || v4Daeun.length === 0) return null;
  const items = v4Daeun.slice(0, 8);
  const startAges = items.map((d) => {
    const m = String(d.age).match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  const totalSpan = (startAges[startAges.length - 1] ?? 80) + 10;

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 12,
          fontWeight: 700,
          color: C.goldDeep,
          letterSpacing: '0.04em',
          marginBottom: 8,
        }}
      >
        60년 흐름, 一甲子
      </div>
      <div
        style={{
          position: 'relative',
          height: 64,
          background: C.surface,
          border: `1px solid ${C.goldLine}`,
          borderRadius: 10,
          padding: '6px 4px',
        }}
      >
        {/* 가로 baseline */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: 30,
            height: 2,
            background: 'rgba(184,150,90,0.20)',
            borderRadius: 1,
          }}
        />
        {items.map((d, i) => {
          const start = startAges[i];
          const next = startAges[i + 1] ?? start + 10;
          const leftPct = (start / totalSpan) * 100;
          const widthPct = ((next - start) / totalSpan) * 100;
          const isCurrent = d.current === true;
          const elemColor = EC[d.elem]?.dark || C.gold;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: 24,
                width: `${widthPct}%`,
                height: 14,
                background: elemColor,
                opacity: isCurrent ? 1 : 0.7,
                borderRadius: 3,
                border: isCurrent ? `2px solid ${C.gold}` : 'none',
                boxShadow: isCurrent ? `0 0 8px ${elemColor}88` : 'none',
              }}
              title={`${d.age}, ${d.gz}`}
            />
          );
        })}
        {/* 나이 라벨 */}
        {items.map((_d, i) => {
          const start = startAges[i];
          const leftPct = (start / totalSpan) * 100;
          return (
            <div
              key={`lbl-${i}`}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: 44,
                fontSize: 8,
                color: C.mute,
                fontWeight: 600,
                transform: 'translateX(-50%)',
              }}
            >
              {start}세
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2C-2 #4+5 · MonthInsightGrid — 12개월 인사이트 grid (3×4)
 *  · 4 분류: peak (정점 ★) / up (상승) / warn (주의) / now (현재 월)
 *  · monthlyFortune AI data 활용 + 자체 카테고라이즈
 * ═════════════════════════════════════════════════════════════════ */
/** 한자→한글 자동 보조 — 텍스트 안의 단일 한자에 (한글) 추가 */
function annotateHanja(text: string): string {
  if (!text) return text;
  const HK: Record<string, string> = {
    甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기',
    庚: '경', 辛: '신', 壬: '임', 癸: '계',
    子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
    午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
  };
  // 단일 한자 (글자 하나) 만 — 이미 (한글) 동반된 건 제외
  return text.replace(/([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])(?!\()/g, (_m, c) => `${c}(${HK[c] || ''})`);
}

function MonthInsightGrid({ aiResult, dayOheng, sajuData }: { aiResult: any; dayOheng: OhengType; sajuData?: SajuData }) {
  // mockup §6 .month-insight-grid — 2-column grid + .mi.up/peak/warn/now
  // monthlyInsight (label) 우선, fallback monthlyFortune (score), 둘 다 없을 때 12달 자동 fallback
  const insight = Array.isArray(aiResult?.monthlyInsight) ? aiResult.monthlyInsight : null;
  const fortune = Array.isArray(aiResult?.monthlyFortune) ? aiResult.monthlyFortune : null;
  type Cell = { month: number; ganzi: string; text: string; tag: string; cls: '' | 'up' | 'peak' | 'warn' | 'now' };
  // 12개월 빈 셀 시작
  const cells: Cell[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, ganzi: '', text: '', tag: '', cls: '' as Cell['cls'],
  }));
  // 60갑자 — 올해 + 월 간지
  const SIXTY = ['甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉','甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未','甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳','甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯','甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑','甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥'];
  const thisYear = new Date().getFullYear();
  const yearGz = SIXTY[(thisYear - 1984 + 6000) % 60];
  const yearGanIdx = '甲乙丙丁戊己庚辛壬癸'.indexOf(yearGz[0]);
  // 월간 = 5호둔법: 갑·기년 → 丙寅 시작 / 을·경년 → 戊寅 / 병·신 → 庚寅 / 정·임 → 壬寅 / 무·계 → 甲寅
  const MONTH_START_GAN = ['丙', '戊', '庚', '壬', '甲'][yearGanIdx % 5];
  const MONTH_ZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const ALL_GAN = '甲乙丙丁戊己庚辛壬癸';
  const startGanIdx = ALL_GAN.indexOf(MONTH_START_GAN);
  // m=1 (양력 1월) — 절기 기준으로는 12월에 해당 (대한); 단순화: m → MONTH_ZHI 인덱스 + offset
  // 사용자에게는 양력 1월=인월 (寅) 가정 — 사주명리 일반화
  const currentMonth = new Date().getMonth() + 1;
  // 2026-10-04 — '양력 1월=寅월' 단순화가 한 칸씩 밀려 있었음 (실제 1월=丑월, 寅월은 입춘 이후 2월).
  //   만세력(lunar) 실값 사용 — 실패 시에만 기존 근사치.
  for (let m = 1; m <= 12; m++) {
    const real = realMonthGanzi(thisYear, m);
    if (real) { cells[m - 1].ganzi = real; continue; }
    const monthIdx = (m - 1) % 12;
    const ganIdx = (startGanIdx + monthIdx) % 10;
    cells[m - 1].ganzi = ALL_GAN[ganIdx] + MONTH_ZHI[monthIdx];
  }
  // AI insight 적용
  if (insight) {
    for (const item of insight) {
      const m = Number(item?.month) || 0;
      if (m < 1 || m > 12) continue;
      const cell = cells[m - 1];
      const label = String(item.label ?? '').trim();
      cell.cls =
        label === '정점' ? 'peak' :
        label === '주의' ? 'warn' :
        label === '상승' ? 'up' :
        label === '지금' ? 'now' :
        '';
      if (item.ganzi) cell.ganzi = String(item.ganzi);
      if (item.text) cell.text = stripMd(String(item.text));
    }
  } else if (fortune && fortune.length === 12) {
    const peakScore = Math.max(...fortune.map((f: any) => Number(f.score) || 0));
    const minScore = Math.min(...fortune.map((f: any) => Number(f.score) || 0));
    fortune.forEach((f: any) => {
      const m = Number(f.month) || 0;
      if (m < 1 || m > 12) return;
      const cell = cells[m - 1];
      const score = Number(f.score) || 50;
      cell.cls =
        m === currentMonth ? 'now' :
        score === peakScore && peakScore >= 70 ? 'peak' :
        score === minScore && minScore <= 50 ? 'warn' :
        score >= 65 ? 'up' :
        '';
      cell.text = `점수 ${score}`;
    });
  }
  // 빈 cell 일반 한 줄 fallback (사주별 동적 — 일간 + 일지 충/합 + 월지 오행 결합)
  const HAN_OH: Record<string, OhengType> = {
    寅: '목', 卯: '목', 巳: '화', 午: '화', 辰: '토', 戌: '토', 丑: '토', 未: '토',
    申: '금', 酉: '금', 亥: '수', 子: '수',
  };
  const SS: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const SG: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };

  // 일지 충/합 매핑 — 일지가 그 달 지지와 충/합/형이면 추가 분기
  const dayJi = sajuData?.pillars?.[2]?.지지 || '';
  // 6충 (정면 충돌) - 子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥
  const SIX_CHUNG: Record<string, string> = {
    子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅',
    卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
  };
  // 6합 (육합) - 子丑, 寅亥, 卯戌, 辰酉, 巳申, 午未
  const SIX_HAP: Record<string, string> = {
    子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯',
    辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
  };
  // 3형 (삼형) - 寅巳申(無恩之刑), 丑戌未(持勢之刑), 子卯(無禮之刑)
  const SAM_HYEONG: Record<string, string[]> = {
    寅: ['巳', '申'], 巳: ['申', '寅'], 申: ['寅', '巳'],
    丑: ['戌', '未'], 戌: ['未', '丑'], 未: ['丑', '戌'],
    子: ['卯'], 卯: ['子'],
  };
  // 사주 모르는 사람도 "어떤 시기인지 / 뭘 하면 좋은지" 바로 잡히도록 한 줄 평이한 한글
  // 분기: 6 오행 관계 × 3 일지 관계(충/합/형/평) = 최대 24 갈래 (사주별 차별화 ↑)
  for (const cell of cells) {
    if (!cell.text) {
      const monthZhiHan = cell.ganzi[1];
      const monthOh = HAN_OH[monthZhiHan];

      // 일지 vs 그 달 지지 관계 식별
      const isChung = dayJi && SIX_CHUNG[dayJi] === monthZhiHan;
      const isHap = dayJi && SIX_HAP[dayJi] === monthZhiHan;
      const isHyeong = dayJi && SAM_HYEONG[dayJi]?.includes(monthZhiHan);
      const dayJiKr = sajuData?.pillars?.[2]?.지지읽기 || '';
      const dayJiLabel = dayJi && dayJiKr ? `${dayJi}(${dayJiKr})` : dayJi;

      let line = '';
      let tag = '';

      // 1단계: 일지 충/합/형이 있으면 우선 (강한 신호)
      if (isChung) {
        line = `<strong>일지 ${dayJiLabel} 와 부딪히는 달</strong> — 결정, 이동, 이별 같은 큰 변동이 일어나기 쉬운 자리입니다.`;
        tag = '부딪힘';
      } else if (isHap) {
        line = `<strong>일지 ${dayJiLabel} 와 결합하는 달</strong> — 인연, 계약, 합류 같은 묶이는 결이 강해지는 자리.`;
        tag = '결합';
      } else if (isHyeong) {
        line = `<strong>일지 ${dayJiLabel} 와 어긋나는 달</strong> — 안에서 갈등이 도드라지는 자리. 사람보다 일에 집중하세요.`;
        tag = '어긋남';
      }
      // 2단계: 충/합/형 없을 때 일간 vs 월지 오행 6갈래
      else if (monthOh === dayOheng) {
        line = '<strong>나에게 힘이 모이는 시기</strong> — 자기 결정과 결심에 좋습니다.';
        tag = '자기 결';
      } else if (SS[monthOh] === dayOheng) {
        line = '<strong>도움받는 시기</strong> — 학습, 정리, 회복에 무게중심을 두세요.';
        tag = '학습과 돌봄';
      } else if (SS[dayOheng] === monthOh) {
        line = '<strong>드러내는 시기</strong> — 발표, 콘텐츠, 소통이 잘 풀립니다.';
        tag = '표현과 창작';
      } else if (SG[dayOheng] === monthOh) {
        line = '<strong>실리가 손에 잡히는 시기</strong> — 협상, 계약, 금전 결정 유리.';
        tag = '실리와 자원';
      } else if (SG[monthOh] === dayOheng) {
        line = '<strong>평가받는 시기</strong> — 신중하게 마무리하고 큰 결정은 미루세요.';
        tag = '책임과 평가';
      } else {
        line = '<strong>한 박자 늦추는</strong> 평탄한 시기.';
        tag = '평탄';
      }
      cell.text = line;
      cell.tag = tag;
      // 충/형 달은 자동으로 warn 클래스
      if ((isChung || isHyeong) && !cell.cls) cell.cls = 'warn';
      // 합 달은 자동으로 up 클래스
      else if (isHap && !cell.cls) cell.cls = 'up';
      // 현재 달 강조
      if (cell.month === currentMonth && !cell.cls) cell.cls = 'now';
    } else {
      // AI 본문이 있을 때 — 명리학 용어 평이한 한글로 강하게 치환 + 한자 보조
      let t = cell.text;
      // 1차: 명리학 십성 용어
      // 🚨 2026-05-05 audit P0 — 글로벌 replace 가 사주 specific 호명 ("재성 N개", "관성 두 개") 무력화
      // → 카운트·자리 호명 패턴 (재성 N개, 관성 두 개, 인성 일지 등) 보존, 단독 등장 시만 일상어 풀이 추가
      // negative lookahead: 뒤에 숫자·"개"·자리 등 호명 토큰이 따라오면 치환 X (사주 specific 보존)
      t = t.replace(/재성(?![\s가-힣]*?(?:\d|[一二三四五]|개|두|세|네|다섯|에|의|이|은|는|월|일|시|년|자리|자수|글자|두 ?개|세 ?개))/g, '재성(실리와 자원)')
           .replace(/관성(?![\s가-힣]*?(?:\d|[一二三四五]|개|두|세|네|다섯|에|의|이|은|는|월|일|시|년|자리|글자|두 ?개|세 ?개))/g, '관성(책임과 평가)')
           .replace(/식상(?![\s가-힣]*?(?:\d|[一二三四五]|개|두|세|네|다섯|에|의|이|은|는|월|일|시|년|자리|글자|두 ?개|세 ?개))/g, '식상(표현과 창작)')
           .replace(/비겁(?![\s가-힣]*?(?:\d|[一二三四五]|개|두|세|네|다섯|에|의|이|은|는|월|일|시|년|자리|글자|두 ?개|세 ?개))/g, '비겁(자기 결)')
           .replace(/인성(?![\s가-힣]*?(?:\d|[一二三四五]|개|두|세|네|다섯|에|의|이|은|는|월|일|시|년|자리|글자|두 ?개|세 ?개))/g, '인성(학습과 돌봄)');
      // 2차: 충·합·형·파·해·생·극 (사주 호명 보존 룰 적용)
      // 2026-06-13 — 한자 형태만 치환 (沖/合/刑/破/害). 맨 한글 음절(충/합/형/파/해) 전역치환은
      //   일반 단어 파괴(올해→올엇갈림·균형→균어긋남·적합→적결합·충분→부딪힘분) → 한자/이미일상어만.
      t = t.replace(/정면\s*부딪힘|沖/g, '<strong>부딪힘</strong>')
           .replace(/合/g, '<strong>결합</strong>')
           .replace(/刑/g, '<strong>어긋남</strong>')
           .replace(/破/g, '깨짐')
           .replace(/害/g, '엇갈림')
           .replace(/생조/g, '받쳐줌')
           .replace(/극(?=[하받])/g, '눌림');
      // 3차: 활성·왕성·득세·실세·휴수 → 친절한 한국어
      t = t.replace(/활성(?:화)?/g, '활기')
           .replace(/왕성/g, '강해짐')
           .replace(/득세/g, '득세(힘 얻음)')
           .replace(/실세|휴수/g, '힘 빠짐')
           .replace(/묘\(묘\)|묘지|묘(?= )/g, '저장')
           .replace(/대운|세운/g, (m) => m === '대운' ? '큰 흐름' : '올해 흐름');
      // 4차: 자(子)·축(丑) 등 단일 한자 (한글) 자동 보조
      t = annotateHanja(t);
      // 5차: "본인 X(X)와" 같은 어색한 문장 정리
      t = t.replace(/본인\s+([子丑寅卯辰巳午未申酉戌亥])\(([가-힣]+)\)와?/g, '내 일지 $2($1)와')
           .replace(/내 일지\s+([가-힣]+)\(([子丑寅卯辰巳午未申酉戌亥])\)와\s+(부딪힘|결합)/g, (_m, _kr, _han, rel) => `일지와 ${rel}`)
           .replace(/^\s*본인\s+/g, '');
      // 6차: tag 추출 (첫 strong 키워드 또는 분류 라벨 기반)
      const tagMatch = t.match(/<strong>([^<]+)<\/strong>/);
      if (tagMatch) {
        const candidate = tagMatch[1].replace(/[—\-·]/g, ', ').slice(0, 14);
        if (cell.cls === 'peak') cell.tag = '정점';
        else if (cell.cls === 'warn') cell.tag = '주의';
        else if (cell.cls === 'up') cell.tag = '상승';
        else if (cell.cls === 'now') cell.tag = '지금';
        else cell.tag = candidate;
      }
      cell.text = t;
    }
    // tag 가 비어있으면 cls 기반 fallback
    if (!cell.tag) {
      cell.tag =
        cell.cls === 'peak' ? '정점' :
        cell.cls === 'warn' ? '주의' :
        cell.cls === 'up' ? '상승' :
        cell.cls === 'now' ? '지금' :
        '평탄';
    }
  }
  // 라벨 한자 매핑
  const BADGE_TEXT: Record<string, string> = {
    peak: '정점', up: '상승', warn: '주의', now: 'NOW',
  };
  return (
    <div className="month-insight-grid">
      {cells.map((c) => {
        const ganHan = c.ganzi.charAt(0);
        const jiHan = c.ganzi.charAt(1);
        const ganKr: Record<string, string> = {
          甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기',
          庚: '경', 辛: '신', 壬: '임', 癸: '계',
        };
        const jiKr: Record<string, string> = {
          子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
          午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
        };
        const ganziKr = `${ganKr[ganHan] || ''}${jiKr[jiHan] || ''}`;
        return (
          <div key={c.month} className={`mi${c.cls ? ' ' + c.cls : ''}`}>
            <div className="mi-head">
              <span className="mi-month">{c.month}월</span>
              <span className="mi-ganzi">{c.ganzi}{ganziKr ? ` (${ganziKr})` : ''}</span>
              {c.cls && BADGE_TEXT[c.cls] && (
                <span className="mi-badge">{BADGE_TEXT[c.cls]}</span>
              )}
            </div>
            <div className="mi-text" dangerouslySetInnerHTML={{ __html: c.text }} />
            {/* 2026-06-13 — 배지와 동일한 #태그 중복 제거 (상승 배지 + #상승 = AI 느낌). 배지와 다를 때만 노출 */}
            {c.tag && c.tag !== '평탄' && c.tag !== BADGE_TEXT[c.cls || ''] && <span className="mi-tag">#{c.tag}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2C-2 #6 · TopicMiniGrid — 여섯 영역 점수바 (mockup topic-mini 진본)
 *  · scores prop (wealth·love·career·health·social·potential) — resolveAreaScores 적용본
 *  · 6 영역 + 점수 + 막대 + AI 한 줄 + (판매 주제로 이어지는 영역만) CTA
 * ═════════════════════════════════════════════════════════════════ */
interface AiTopicMini { desc?: string; meaning?: string; keyword?: string; line?: string }
function TopicMiniGrid({
  scores,
  aiTopics,
  sipDist,
  dayGan,
  profileId,
}: {
  scores: Record<string, number>;
  aiTopics?: Record<string, AiTopicMini>;
  sipDist?: SipDist;
  dayGan?: string;
  /** 리포트 주인 프로필 — 주제 페이지가 미리 선택 (가족 사주 리포트 대응) */
  profileId?: string;
}) {
  const navigate = useNavigate();
  // 2026-05-05 hook 정적 → deriveTopicHook 동적화 (사주 8글자 호명)
  /* 🚨 2026-09-17 C-1 — "여섯 영역"인데 4칸만 보이던 회귀 fix.
   *   원인: dfd2b9f 가 카드 키를 study·business 로 바꿨으나 점수(computeTopicScores)·AI topicMini 는
   *   social·potential 키 → score 0 필터로 2칸 증발 + AI 인간관계·잠재력 풀이가 버려짐.
   *   수정: 카드 키 = AI/점수 키 6개(제목·힌트 "재물·사랑·직업·건강·인간관계·잠재력"과 일치).
   *   판매 주제로 이어지는 영역만 클릭·가격 CTA — 인간관계는 판매 주제가 없어 카드 안 표시만
   *   (AI 스키마 '외부 라우팅 X' 와 일치). 잠재력은 학업운으로 이어짐(점수도 학업운 기준 · resolveAreaScores). */
  type AreaMeta = { key: string; label: string };
  const topics: AreaMeta[] = [
    { key: 'wealth',    label: '재물' },
    { key: 'love',      label: '사랑' },
    { key: 'career',    label: '직업' },
    { key: 'health',    label: '건강' },
    { key: 'social',    label: '인간관계' },
    { key: 'potential', label: '학업과 잠재력' },
  ];

  // 2026-05-05 6 카드 → 2-col grid 균일 (마지막 .full 카드 제거)
  const items = topics
    .map((t) => {
      const ai = aiTopics?.[t.key];
      const aiDesc = ai?.desc?.trim() || ai?.line?.trim() || ai?.meaning?.trim();
      const score = Number(scores?.[t.key] ?? 0);
      const topicId = AREA_TOPIC[t.key];
      // 동적 hook — sipDist + dayGan 호명 (이어지는 주제가 있을 때만 — 판매 CTA 카피)
      const hook = topicId ? deriveTopicHook(t.key, score, sipDist, dayGan) : '';
      // 가격 SSOT — 주제별 actualPrice (love/wealth 3운 등)
      const price = topicId ? getTopicPrice(topicId).actualPrice : 0;
      return {
        ...t,
        topicId,
        topicLabel: topicId ? TOPIC_REGISTRY[topicId].label : '',
        route: topicId ? TOPIC_REGISTRY[topicId].path : '',
        score,
        desc: aiDesc,
        hook,
        price,
        isFull: false,
      };
    })
    .filter((t) => t.score > 0);
  if (items.length === 0) return null;

  // 점수 spread — 가장 높은/낮은 강조
  const sortedScores = [...items].map((t) => t.score).sort((a, b) => b - a);
  const peakScore = sortedScores[0];
  const lowScore = sortedScores[sortedScores.length - 1];

  // CTA 보강 텍스트 — 점수별 동적 (낮을 땐 "왜 낮은지", 높을 땐 "어디까지 갈 수 있는지")
  function getCtaLine(topicLabel: string, score: number, price: number): string {
    if (score >= 88) return `최강 ${score}점 — ${price}운으로 한계 확인`;
    if (score >= 75) return `${score}점 활용 시기 ${price}운에서`;
    if (score <= 50) return `약 ${score}점 — ${price}운으로 보강법`;
    return `${topicLabel} ${price}운에서 깊이 보기`;
  }

  // mockup §9 .topic-mini-grid 진본 — 2-column grid + 마지막 카드 .full
  return (
    <div className="topic-mini-grid">
      {items.map((t) => {
        const isPeak = t.score === peakScore && peakScore >= 85;
        const isLow = t.score === lowScore && lowScore <= 55 && t.score !== peakScore;
        // box-shadow 의 2px 외곽 ring 은 grid container 의 좁은 폭에서 잘림 → border 로 대체
        const cardStyle: React.CSSProperties = {
          cursor: 'pointer',
          ...(isPeak ? { border: '2px solid #4E7A57', boxShadow: '0 4px 14px rgba(78,122,87,0.14)' } : {}),
          ...(isLow ? { border: '2px solid #c62828', boxShadow: '0 4px 14px rgba(198,40,40,0.14)' } : {}),
        };
        // 2026-09-17 — 판매 주제로 이어지는 영역만 클릭 (인간관계는 표시만)
        const isClickable = !!t.topicId;
        const go = () => navigate(t.route, profileId ? { state: { profileId } } : undefined);
        return (
          <div
            key={t.key}
            className={`topic-mini${t.isFull ? ' full' : ''}`}
            role={isClickable ? 'link' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={isClickable ? go : undefined}
            onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } : undefined}
            style={{ ...cardStyle, cursor: isClickable ? 'pointer' : 'default' }}
          >
            <div className="tm-head">
              <span className="tm-ttl" style={isPeak ? { color: '#4E7A57' } : isLow ? { color: '#c62828' } : undefined}>
                {t.label}
                {isPeak && <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 800, color: '#4E7A57', background: 'rgba(78,122,87,0.12)', padding: '1px 5px', borderRadius: 4, verticalAlign: 'middle' }}>최강</span>}
                {isLow && <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 800, color: '#c62828', background: 'rgba(198,40,40,0.10)', padding: '1px 5px', borderRadius: 4, verticalAlign: 'middle' }}>주의</span>}
              </span>
              <span className="tm-score" style={isPeak ? { color: '#4E7A57' } : isLow ? { color: '#c62828' } : undefined}>
                {t.score}
              </span>
            </div>
            <div className="tm-bar">
              <div
                className="tm-fill"
                style={{
                  width: `${t.score}%`,
                  ...(isPeak ? { background: 'linear-gradient(90deg, #6E9776, #4E7A57)' } : {}),
                  ...(isLow ? { background: 'linear-gradient(90deg, #ef5350, #c62828)' } : {}),
                }}
              />
            </div>
            {/* AI 풀이 한 줄 — <strong> raw text 차단 (2026-05-04) */}
            {t.desc && <div className="tm-desc" dangerouslySetInnerHTML={{ __html: sanitizeAiText(t.desc) }} />}
            {/* 호기심 카피 — 점수별 분기 (CTA 효율 ↑) · 이어지는 주제가 있을 때만 */}
            {isClickable && t.hook && (
              <div className="tm-hook">
                <span className="tm-hook-label">{t.price}운으로 보면</span>
                {t.hook}
              </div>
            )}
            {isClickable && (
              <div
                className="tm-link"
                style={isPeak ? { color: '#4E7A57', fontWeight: 700 } : isLow ? { color: '#c62828', fontWeight: 700 } : undefined}
              >
                {getCtaLine(t.topicLabel, t.score, t.price)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
