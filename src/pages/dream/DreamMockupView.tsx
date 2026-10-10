/**
 * DreamMockupView — 무료 꿈해몽 v2 (mockup HTML 1:1 픽셀-퍼펙트 React port)
 *
 * 진본 출처: D:/550saju/docs/mockups/사주500_UI개편_목업_무료_꿈해몽_v2.html
 * 2026-05-27 — mockup HTML 그대로 처음부터 재작성. 아코디언/스켈레톤 X (mockup 진본 매칭).
 *
 * 구조:
 *  - header.hd (다크 그라디언트 + 夢 워터마크 + badge + h1)
 *  - input-stack (3-part: topic/dream/worry)
 *  - main.body (무료 4섹션: §01 첫인상 / §02 꿈속상징 / §03 문장인용 / §04 요새고민)
 *  - locked-header (DEEPER 진입)
 *  - locked-stack (§05~§09 잠금 5섹션 + 도식화 + 블러)
 *  - paid-cta (1운 결제)
 *  - ad-slot
 *  - topic-rec (꿈 종류 → 주제 추천 카드 · 2026-09-17)
 *  - actions (공유 + 사주대화)
 */

import { useMemo, useState, type ReactNode } from 'react';
import type { SajuProfile } from '@/services/storage/localStore';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { getDreamTopicRec } from './dreamTopicRec';

/** AI 본문 강약 자동 보강 — 사주용어 b 태그 + 시간/방위/숫자 u 밑줄 + 결론 strong 형광펜 (꿈해몽 톤 확장) */
function autoEmphasize(input: string): string {
  if (!input) return input;
  let text = String(input);

  // 1) 사주 용어 자동 <b> (이미 안에 들어있으면 skip) — 한 단어당 첫 출현만
  const sajuTerms = [
    '재성(財星)', '정재(正財)', '편재(偏財)', '관성(官星)', '정관(正官)', '편관(偏官)',
    '식상(食傷)', '식신(食神)', '상관(傷官)', '인성(印星)', '정인(正印)', '편인(偏印)',
    '비겁(比劫)', '비견(比肩)', '겁재(劫財)',
    '식신생재(食神生財)', '재격(財格)',
    '대운', '세운', '월운', '일주', '일간', '월령', '용신', '격국',
    '통근(通根)', '투간(透干)', '조후(調候)',
    '도화살(桃花殺)', '천을귀인(天乙貴人)', '문창귀인(文昌貴人)', '학당귀인(學堂貴人)',
    '자평진전', '적천수', '궁통보감', '명리약언', '삼명통회', '연해자평',
  ];
  const usedB = new Set<string>();
  for (const term of sajuTerms) {
    if (usedB.has(term)) continue;
    const re = new RegExp(`(?<!<b>)(?<!<strong>)${term.replace(/[()]/g, '\\$&')}`, 'g');
    if (re.test(text)) {
      text = text.replace(re, `<b>${term}</b>`);
      usedB.add(term);
    }
  }

  // 2) 시간/방위/색상/기간 → <u> 골드 밑줄
  if (!/<u>/i.test(text)) {
    text = text.replace(/(?<!<u>)(오전|오후|저녁|밤|새벽|아침)\s*\d+(?:\s*[~∼-]\s*\d+)?\s*시(?:\s*이후)?/g, '<u>$&</u>');
    text = text.replace(/(?<!<u>)(?<!\d)\d{1,2}\s*[~∼-]\s*\d{1,2}\s*시/g, '<u>$&</u>');
    text = text.replace(/(?<!<u>)(동남쪽|동북쪽|서남쪽|서북쪽|동쪽|서쪽|남쪽|북쪽|동남방|동북방|서남방|서북방)/g, '<u>$1</u>');
    text = text.replace(/(?<!<u>)(짙은 파란색|진한 파란색|연한 녹색|밝은 빨강|짙은 검은색|남보라|보라색|주황색|연두색|검은색|검정색|파란색|초록색|노란색|갈색|남색|회색|빨강|파랑|초록|노랑|검정|흰색|은색|금색)/g, '<u>$1</u>');
    text = text.replace(/(?<!<u>)(\d{4}년\s*\d{1,2}월|\d{1,2}월\s*[~∼-]?\s*\d{1,2}월|\d{1,2}월(?!\s*월))/g, '<u>$1</u>');
    text = text.replace(/(?<!<u>)(20대|30대|40대|50대|60대)\s*(초반|중반|후반)/g, '<u>$1 $2</u>');
  }

  // 2.5) 주의/경고 절 → <em> 번트오렌지 (2026-05-29 — Daily/Topic 와 1:1 동기화). 최대 2회.
  if (!/<em>/i.test(text)) {
    const cautionTrigger = /주의|조심|피하|삼가|위험|긴장|갈등|충돌|불안|악화|심화|예민|상처|마찰|소진|과부하|무리|경계|흉/;
    const sentences = text.split(/(?<=[다요네][.!?])\s+/);
    let emCount = 0;
    const emPhrases: string[] = [];
    for (const s of sentences) {
      if (emCount >= 2) break;
      if (!cautionTrigger.test(s)) continue;
      const clean = s.trim().replace(/[.!?]+$/, '');
      const lastComma = clean.lastIndexOf(',');
      let seg = lastComma !== -1 ? clean.slice(lastComma + 1).trim() : clean;
      if (!cautionTrigger.test(seg) || seg.length < 8 || seg.length > 46) {
        if (clean.length >= 8 && clean.length <= 46 && cautionTrigger.test(clean)) seg = clean;
        else continue;
      }
      if (/[<>]/.test(seg)) continue;
      emPhrases.push(seg);
      emCount++;
    }
    for (const p of emPhrases) {
      const idx = text.lastIndexOf(p);
      if (idx === -1) continue;
      const before = text.slice(Math.max(0, idx - 12), idx);
      if (/<(strong|u|em|b)>[^<]*$/.test(before)) continue;
      text = text.slice(0, idx) + `<em>${p}</em>` + text.slice(idx + p.length);
    }
  }

  // 3) 결론 phrase → <strong> 황금 형광펜 (적극 주입 — AI 가 안 넣어도 클라가 보강)
  //    기존 strong 갯수와 무관하게 최대 maxStrong 까지 추가 보강.
  if (text.length >= 50) {
    const existingStrong = (text.match(/<strong>/gi) || []).length;
    const targetStrong = 3; // 한 필드당 최소 3개 강조 목표
    const need = Math.max(0, targetStrong - existingStrong);
    if (need > 0) {
      const sentences = text.split(/(?<=[다요네][.!?])\s+/);
      const endings = [
        // 명사+종결 (확장)
        '(?:날|시간|자리|결|순간|것|점|곳|쪽|무기|핵심|정답|답|이유|방법|시점|구간|기회|신호|중심|기준|기억|감각|선택|순서|뜻|증거|징조|예고|선언|메시지|표현|상징|의미|시기|장면|이미지|징표|결과|구조|이야기|초점|기점|돌파구|전환점|기로|단서|약속|준비|반증|반박|확신|확률|징후|토대|기반|관문)\\s*(?:이에요|예요|입니다|이다|네요)',
        // 동사 명령형 (확장)
        '(?:하세요|미루세요|집중하세요|정리하세요|만나세요|배치하세요|챙기세요|준비하세요|확인하세요|시도하세요|체크하세요|넘기세요|놓치지 마세요|유지하세요|시작하세요|마무리하세요|머물러 보세요|꺼내세요|살펴보세요|믿으세요|들어보세요|읽으세요|기억하세요|받아들이세요|움직이세요|결정하세요|꺼내 보세요|밀고 나가세요)',
        // 단정형 동사 (확장)
        '(?:겹칩니다|일치합니다|적용됩니다|올라옵니다|드러납니다|채워줍니다|보강됩니다|활성화됩니다|확장됩니다|연결됩니다|증폭됩니다|순환합니다|발복합니다|체감됩니다|작용합니다|해당합니다|해석됩니다|움직이기 시작했다는 증거입니다|보내고 있습니다|기다리고 있습니다|허락하는 방향입니다|풀리는 시기입니다|시작되는 시기입니다|들어선 신호입니다|다가오고 있습니다|준비된 자리입니다)',
        // 종결 강조 (확장)
        '(?:게 좋아요|필수예요|필요해요|중요해요|좋습니다|중요합니다|필요합니다|효율적입니다|적절합니다|좋은 자리예요|어울려요|터뜨린 것입니다|준비됐다는 뜻입니다|준비가 되었다는 뜻입니다|살아있습니다|돌파의 전조입니다|결단의 시점입니다|받아들일 때입니다)',
      ];
      const conclusionPattern = new RegExp(`([가-힣\\sA-Za-z0-9~()<>/'\"-]{8,50}(?:${endings.join('|')}))[.!?]?$`);
      let added = 0;
      const replacements: Array<{ phrase: string }> = [];
      for (const sentence of sentences) {
        if (added >= need) break;
        const clean = sentence.trim().replace(/[.!?]+$/, '');
        // 이미 strong/em 들어있는 문장은 skip (중복·중첩 방지)
        if (/<(strong|em)>/i.test(clean)) continue;
        const lastCommaIdx = clean.lastIndexOf(',');
        const segment = lastCommaIdx !== -1 ? clean.slice(lastCommaIdx + 1).trim() : clean;
        const m = segment.match(conclusionPattern);
        if (m && m[1].length >= 8 && m[1].length <= 50) {
          replacements.push({ phrase: m[1].trim() });
          added++;
        }
      }
      for (const r of replacements) {
        const idx = text.lastIndexOf(r.phrase);
        if (idx === -1) continue;
        const before = text.slice(Math.max(0, idx - 10), idx);
        if (/<strong>$/.test(before)) continue;
        text = text.slice(0, idx) + `<strong>${r.phrase}</strong>` + text.slice(idx + r.phrase.length);
      }
    }
  }
  return text;
}

/** AI 가 종종 <strong> 대신 &lt;strong&gt; (HTML entity) 로 출력 → 디코드 */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** safeHtml + autoEmphasize 결합 — AI 본문에 강조 자동 보강 */
const safeHtml = (text: any): { __html: string } => ({
  __html: sanitizeAiText(autoEmphasize(decodeHtmlEntities(String(text ?? '')))),
});

interface DreamMockupViewProps {
  result: any;
  profile: SajuProfile | null;
  hasSaju: boolean;
  category: string;
  dreamText: string;
  concern: string;
  unlocked?: boolean;
  /** AI 스트리밍 중 — 데이터 미도착 섹션은 skeleton 표시 · 잠금 해제 CTA 비활성 */
  isStreaming?: boolean;
  /** 결과 생성일 (보관함 저장본 createdAt) — 없으면 오늘 날짜 */
  createdAt?: string | number;
  /** 꿈 카테고리 id (DREAM_CATEGORIES) — 주제 추천 카드 매핑용 */
  categoryId?: string | null;
  onUnlock: () => void;
  onShare: () => void;
  onChat: () => void;
  /** 주제 추천 카드 탭 → 주제 분석 이동 (없으면 카드 미노출) */
  onTopic?: (topicId: string) => void;
}

/** 아코디언 + skeleton 지원 섹션 래퍼 (무료 = defaultOpen false, 잠금 = true) */
function DreamSection({
  num,
  title,
  han,
  defaultOpen = false,
  locked = false,
  lockIconSlot,
  hasData,
  isStreaming: _isStreaming = false,
  skeletonLines = 4,
  children,
}: {
  num: string;
  title: ReactNode;
  han?: string;
  defaultOpen?: boolean;
  locked?: boolean;
  lockIconSlot?: ReactNode;
  hasData: boolean;
  isStreaming?: boolean;
  skeletonLines?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = locked ? true : open;
  return (
    <section className={`${locked ? 'lk-sec' : 'section'}${isOpen && !locked ? ' is-open' : ''}`}>
      <button
        type="button"
        className="acc-head"
        onClick={() => !locked && setOpen((o) => !o)}
        aria-expanded={isOpen}
        disabled={locked}
      >
        <div className="sec-num">{num}</div>
        <div className="sec-title">
          <span className="title-flex">
            {title}
            {han && <span className="han">{han}</span>}
          </span>
          {lockIconSlot}
          {!locked && <span className={`acc-caret${isOpen ? ' open' : ''}`} aria-hidden="true">▾</span>}
        </div>
      </button>
      {isOpen && (
        <div className="acc-body">
          {hasData ? children : (
            <div className="skel-stack">
              {Array.from({ length: skeletonLines }).map((_, i) => {
                const widths = ['w-60', 'w-full', 'w-80', 'w-90', 'w-full'];
                return <div key={i} className={`skel-line ${widths[i % widths.length]}`} />;
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const MOCKUP_CSS = `
.dream-mockup * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
.dream-mockup { font-family: 'Pretendard', sans-serif; color: #1a1a1a; letter-spacing: -0.01em; }
.dream-mockup .page { max-width: 480px; margin: 0 auto; background: #F8F5EE; }

/* Header */
.dream-mockup .hd {
  background: linear-gradient(180deg, rgba(26,22,18,.55) 0%, rgba(26,22,18,.82) 45%, #1A1612 100%), url('/art/inwang.webp') 30% 35% / cover no-repeat, #1A1612; /* 2026-10-10 v9 먹 머리 */
  color: #fff; padding: 18px 20px 28px; position: relative; overflow: hidden;
}
.dream-mockup .hd::before { display: none; content: '夢'; position: absolute; right: -20px; bottom: -40px; font-family: 'Noto Serif KR', serif; font-size: 220px; font-weight: 900; color: rgba(255,255,255,.05); line-height: 1; }
.dream-mockup .hd::after { display: none; content: ''; position: absolute; top: 10px; right: 30px; width: 40px; height: 40px; background: radial-gradient(circle, rgba(212,175,55,.3), transparent 70%); border-radius: 50%; }
.dream-mockup .hd .top { display: flex; gap: 8px; font-size: 12px; opacity: .95; flex-wrap: wrap; align-items: center; }
.dream-mockup .hd .badge { background: rgba(255,255,255,.15); padding: 3px 10px; border-radius: 100px; font-size: 11px; }
.dream-mockup .hd .badge.free { background: rgba(212,175,55,.22); color: #f2d678; }
/* 2026-09-17 — 잠금 해제(1운) 결과 헤더: 무료 뱃지 대신 그린 톤 '잠금 해제' */
.dream-mockup .hd .badge.open { background: rgba(140,109,61,.28); color: #cfe8dc; }
.dream-mockup .hd h1 { font-family: 'Noto Serif KR', serif; font-size: 23px; font-weight: 700; margin-top: 14px; letter-spacing: -0.02em; line-height: 1.4; position: relative; }
.dream-mockup .hd .date { font-size: 12px; opacity: .7; margin-top: 6px; font-feature-settings: 'tnum'; position: relative; }

/* 3-part input */
.dream-mockup .input-stack { margin: 16px 20px 0; display: flex; flex-direction: column; gap: 10px; }
/* 2026-05-28 — 3카드 좌측 컬러 strip 제거 (AI grid 디자인 티). 톤은 .lb 의 dot + 컬러 텍스트로 표현. */
.dream-mockup .ic { background: #fff; border-radius: 12px; padding: 12px 14px; box-shadow: 0 3px 10px rgba(0,0,0,.05); border: 1px solid rgba(0,0,0,0.04); }
.dream-mockup .ic .lb { font-size: 11px; color: #7F6B4E; letter-spacing: 0.18em; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.dream-mockup .ic.topic .lb { color: #B8965A; }
.dream-mockup .ic.dream .lb { color: #1A1612; }
.dream-mockup .ic .lb .dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.dream-mockup .ic .tx { font-size: 13px; line-height: 1.7; color: #2a2520; margin-top: 6px; word-break: keep-all; }
.dream-mockup .ic.topic .tx { font-weight: 600; font-family: 'Noto Serif KR', serif; font-size: 14.5px; }
.dream-mockup .ic.dream .tx { font-style: italic; }

/* Body */
.dream-mockup .body { padding: 18px 20px 0; }
.dream-mockup .section { margin-top: 24px; }
.dream-mockup .sec-num { display: inline-block; font-family: 'Noto Serif KR', serif; font-size: 17px; font-weight: 900; color: #A23A2A; letter-spacing: 0; margin-bottom: 4px; } /* 2026-10-10 v9 — SECTION 01 → 一 */
.dream-mockup .sec-title { font-family: 'Noto Serif KR', serif; font-size: 18px; font-weight: 700; color: #1a1a1a; }
.dream-mockup .sec-title .han { color: #B8965A; font-weight: 500; margin-left: 6px; font-size: 14px; }
.dream-mockup .sec-lead { font-size: 12px; color: #7F6B4E; margin-top: 4px; line-height: 1.55; }
.dream-mockup .body p { font-size: 14.5px; line-height: 1.85; color: #2a2520; margin: 10px 0 0; word-break: keep-all; }
.dream-mockup .body p strong { font-weight: 600; background: linear-gradient(180deg, transparent 60%, rgba(184,150,90,.32) 60%); padding: 0 2px; color: #1a1a1a; }
/* <em> = 주의와 경고 (번트오렌지) — 2026-05-29. font-style normal (한글 가독). */
.dream-mockup .body p em, .dream-mockup .body em { font-style: normal; font-weight: 700; color: #A23A2A; background: linear-gradient(180deg, transparent 56%, rgba(162,58,42,.15) 56%); padding: 0 2px; border-radius: 2px; }

/* Symbol grid (§02) */
.dream-mockup .symbol-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin: 14px 0 0; } /* 2026-10-10 v9 가독성 — 긴 설명을 좁은 두 칸에 넣지 않음 */
.dream-mockup .sym { background: #fff; border: 1px solid #E5DFD0; border-radius: 12px; padding: 14px; text-align: left; display: grid; grid-template-columns: 54px 1fr; column-gap: 14px; align-items: start; } /* 2026-10-10 v9 한 칸 가로형 — 그림 왼쪽과 글 오른쪽 */
.dream-mockup .sym > *:not(.pic) { grid-column: 2; }
.dream-mockup .sym > .pic { grid-row: 1 / span 4; }
.dream-mockup .sym .pic { width: 54px; height: 54px; margin: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #F0E8D9, #E5DFD0); border-radius: 50%; color: #1A1612; font-family: 'Noto Serif KR', serif; font-size: 22px; font-weight: 700; }
.dream-mockup .sym .pic svg { width: 30px; height: 30px; }
.dream-mockup .sym .pic.water { background: linear-gradient(135deg, #dbe7f4, #a8c5e6); color: #3E5F82; }
.dream-mockup .sym .pic.foot { background: linear-gradient(135deg, #F0E8D9, #d4c789); color: #5C4A2E; }
.dream-mockup .sym .pic.ripple { background: linear-gradient(135deg, #dbe7f4, #bfd3ea); color: #1A1612; }
.dream-mockup .sym .pic.shadow { background: linear-gradient(135deg, #2a2520, #1a1a1a); color: #E8D9B8; }
.dream-mockup .sym .pic.fire { background: linear-gradient(135deg, #F6E5E0, #E8C3B9); color: #B04A38; }
.dream-mockup .sym .pic.metal { background: linear-gradient(135deg, #ececec, #c8c8c8); color: #555; }
.dream-mockup .sym .pic.leaf { background: linear-gradient(135deg, #e0eed5, #b8d99c); color: #4E7A57; }
.dream-mockup .sym .pic.mountain { background: linear-gradient(135deg, #efe5d4, #d8c89e); color: #7F6B4E; }
.dream-mockup .sym .hd2 { display: flex; justify-content: flex-start; align-items: baseline; gap: 6px; }
.dream-mockup .sym .nm { font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700; color: #1a1a1a; }
.dream-mockup .sym .han { font-family: 'Noto Serif KR', serif; color: #B8965A; font-size: 12px; }
.dream-mockup .sym .dc { font-size: 13.5px; color: #1a1a1a; line-height: 1.75; margin-top: 10px; text-align: left; word-break: keep-all; }
.dream-mockup .sym .dc strong { font-weight: 700; background: linear-gradient(180deg, transparent 58%, rgba(184,150,90,.32) 58%); padding: 1px 3px; color: #1a1a1a; border-radius: 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.dream-mockup .sym .dc u { text-decoration: none; border-bottom: 2px solid #B8965A; padding-bottom: 1px; color: #5C4A2E; font-weight: 600; }
.dream-mockup .sym .dc b { color: #5C4A2E; font-weight: 700; font-family: 'Noto Serif KR', serif; background: rgba(184,150,90,0.10); padding: 1px 4px; border-radius: 3px; font-size: 0.96em; }

/* Quote (§03) */
.dream-mockup .quote-stack { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
.dream-mockup .qc { background: #fff; border: 1px solid #E5DFD0; border-radius: 12px; padding: 14px 14px 14px 40px; position: relative; }
.dream-mockup .qc::before { content: '"'; position: absolute; left: 14px; top: 8px; font-family: 'Noto Serif KR', serif; font-size: 42px; font-weight: 900; color: #1A1612; line-height: 1; }
.dream-mockup .qc .src { font-family: 'Noto Serif KR', serif; font-size: 13.5px; line-height: 1.6; color: #1A1612; font-style: italic; font-weight: 500; word-break: keep-all; }
.dream-mockup .qc .src .hl { background: linear-gradient(180deg, transparent 60%, rgba(184,150,90,.32) 60%); padding: 0 2px; font-weight: 600; }
.dream-mockup .qc .interp { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #E5DFD0; font-size: 12.5px; line-height: 1.7; color: #2a2520; word-break: keep-all; }
.dream-mockup .qc .interp .tag { display: inline-block; font-size: 11px; letter-spacing: 0.1em; font-weight: 600; color: #B8965A; background: rgba(184,150,90,.12); padding: 2px 7px; border-radius: 100px; margin-right: 6px; }
.dream-mockup .qc .interp strong { color: #1a1a1a; font-weight: 600; background: linear-gradient(180deg, transparent 60%, rgba(184,150,90,.32) 60%); padding: 0 2px; }

/* Worry link (§04) */
.dream-mockup .worry-link { margin-top: 14px; background: linear-gradient(135deg, rgba(106,93,63,.06), rgba(26,22,18,.04)); border: 1px solid #E5DFD0; border-radius: 12px; padding: 14px 16px; }
.dream-mockup .worry-link .h { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.dream-mockup .worry-link .h .lab { font-size: 11px; letter-spacing: 0.15em; color: #5C4A2E; font-weight: 600; }
.dream-mockup .worry-link .h .arrow { color: #B8965A; font-size: 12px; }
.dream-mockup .worry-link .h .lab.dream { color: #1A1612; }
.dream-mockup .worry-link p { font-size: 13px; line-height: 1.75; color: #2a2520; margin: 0; word-break: keep-all; }
.dream-mockup .worry-link p strong { color: #1a1a1a; font-weight: 600; background: linear-gradient(180deg, transparent 60%, rgba(26,22,18,.15) 60%); padding: 0 2px; }
/* 2026-05-28 — 좌측 컬러 strip 제거. 그라데이션 배경 + 큰 따옴표(typography)로 인용 표현. */
.dream-mockup .pullq { background: linear-gradient(135deg, rgba(26,22,18,.06), rgba(212,175,55,.07)); border-radius: 10px; padding: 30px 20px 16px; margin: 16px 0 0; font-family: 'Noto Serif KR', serif; font-size: 14.5px; line-height: 1.75; color: #1a1a1a; font-weight: 500; word-break: keep-all; position: relative; }
.dream-mockup .pullq::before { content: '"'; position: absolute; top: 6px; left: 14px; font-family: 'Noto Serif KR', serif; font-size: 42px; line-height: 1; color: rgba(26,22,18,0.22); font-weight: 700; }

/* 잠금 진입 헤더 */
.dream-mockup .locked-header { margin: 28px 20px 0; padding: 14px 16px; background: linear-gradient(135deg, #1A1612 0%, #0F0C09 100%); color: #fff; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 10px; }
.dream-mockup .locked-header svg { width: 18px; height: 18px; color: #E8D9B8; flex-shrink: 0; }
.dream-mockup .locked-header .title-col { flex: 1; }
.dream-mockup .locked-header .lab { font-size: 11px; color: #E8D9B8; letter-spacing: 0.15em; font-weight: 600; }
.dream-mockup .locked-header .ttl { font-family: 'Noto Serif KR', serif; font-size: 14.5px; font-weight: 600; margin-top: 2px; }

/* 잠금 섹션 스택 */
.dream-mockup .locked-stack { margin: 0 20px; background: #fff; border: 1px solid #E5DFD0; border-top: 0; border-radius: 0 0 12px 12px; overflow: hidden; position: relative; }
.dream-mockup .locked-stack::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 0%, rgba(250,248,243,.3) 80%, rgba(250,248,243,.85) 100%); pointer-events: none; transition: opacity .55s ease; }
.dream-mockup.unlocked .locked-stack::after { opacity: 0; }
.dream-mockup .lk-sec { padding: 16px 18px; border-bottom: 1px solid #F0E8D9; position: relative; }
.dream-mockup .lk-sec:last-child { border-bottom: 0; }
.dream-mockup .lk-sec .sec-num { color: #A23A2A; opacity: .75; }
.dream-mockup .lk-sec .sec-title { font-size: 16.5px; display: flex; align-items: center; gap: 8px; }
.dream-mockup .lk-sec .lock-icon { width: 14px; height: 14px; color: #B8965A; flex-shrink: 0; transition: opacity .55s ease; }
.dream-mockup.unlocked .lk-sec .lock-icon { display: none; }

/* 티저 — clear 문장 / 블러 문장 */
.dream-mockup .lk-body { margin-top: 10px; }
.dream-mockup .lk-teaser { font-size: 13.5px; line-height: 1.75; color: #2a2520; margin: 0; word-break: keep-all; font-weight: 500; }
.dream-mockup .lk-teaser strong { font-weight: 600; background: linear-gradient(180deg, transparent 60%, rgba(184,150,90,.32) 60%); padding: 0 2px; }
.dream-mockup .lk-blurred { margin-top: 6px; filter: blur(4.5px); user-select: none; pointer-events: none; transition: filter .55s ease; }
.dream-mockup .lk-blurred p { font-size: 13px; line-height: 1.7; color: #2a2520; margin: 0 0 6px; }
.dream-mockup.unlocked .lk-blurred { filter: none; user-select: text; pointer-events: auto; }
.dream-mockup .lk-full { display: none; margin-top: 8px; font-size: 13.5px; line-height: 1.8; color: #2a2520; word-break: keep-all; }
.dream-mockup .lk-full strong { font-weight: 600; background: linear-gradient(180deg, transparent 60%, rgba(184,150,90,.32) 60%); padding: 0 2px; color: #1a1a1a; }
.dream-mockup.unlocked .lk-full { display: block; animation: lkReveal .5s ease both; }
.dream-mockup.unlocked .lk-blurred { display: none; }
@keyframes lkReveal { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* 도식화 */
.dream-mockup .lk-diag { margin-top: 10px; border-radius: 8px; background: #F8F5EE; padding: 12px; position: relative; }
.dream-mockup .lk-diag.pie-teaser { display: grid; grid-template-columns: 80px 1fr; gap: 14px; align-items: center; }
.dream-mockup .lk-diag.pie-teaser .pie { width: 80px; height: 80px; border-radius: 50%; position: relative; }
.dream-mockup .lk-diag.pie-teaser .pie::after { content: ''; position: absolute; inset: 18%; background: #F8F5EE; border-radius: 50%; }
.dream-mockup .lk-diag.pie-teaser .legend { font-size: 11px; color: #5C4A2E; line-height: 1.6; }
.dream-mockup .lk-diag.pie-teaser .legend .row { display: flex; align-items: center; gap: 5px; margin-bottom: 2px; }
.dream-mockup .lk-diag.pie-teaser .legend .sw { width: 8px; height: 8px; border-radius: 2px; }

/* 타임라인 */
.dream-mockup .lk-diag.timeline { padding: 10px 12px; }
.dream-mockup .lk-diag.timeline .tl-months { display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; }
.dream-mockup .lk-diag.timeline .tl-cell { height: 22px; background: #E5DFD0; border-radius: 2px; position: relative; }
.dream-mockup .lk-diag.timeline .tl-cell.mark { background: #B8965A; }
.dream-mockup .lk-diag.timeline .tl-cell.mark.strong { background: #c62828; }
.dream-mockup .lk-diag.timeline .tl-lbls { display: flex; justify-content: space-between; font-size: 11px; color: #7F6B4E; margin-top: 4px; font-feature-settings: 'tnum'; }
.dream-mockup .lk-diag.timeline .tl-cap { font-size: 11px; color: #5C4A2E; margin-top: 6px; }
.dream-mockup .lk-diag.timeline .tl-cap strong { color: #c62828; font-weight: 600; }

/* Warn list */
.dream-mockup .warn-list { list-style: none; padding: 0; margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
/* 2026-05-28 — 균일 list 좌측 strip 제거. 배경만으로 warn 톤 표현. */
.dream-mockup .warn-list li { background: rgba(198,40,40,.05); border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.65; color: #2a2520; word-break: keep-all; transition: filter .55s ease; }
.dream-mockup .warn-list li strong { color: #c62828; font-weight: 600; }
.dream-mockup .warn-list li.locked { filter: blur(4.5px); user-select: none; pointer-events: none; }
.dream-mockup.unlocked .warn-list li.locked { filter: none; user-select: text; pointer-events: auto; }

/* Dual blind */
.dream-mockup .dual-blind { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.dream-mockup .db-col { background: #F8F5EE; border-radius: 8px; padding: 10px 12px; border: 1px solid #E5DFD0; }
/* 2026-05-28 — 상단 컬러 strip 제거. .ch 라벨 컬러로 톤 표현. */
.dream-mockup .db-col .ch { font-family: 'Noto Serif KR', serif; font-size: 12px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
.dream-mockup .db-col.go .ch { color: #4E7A57; }
.dream-mockup .db-col.no .ch { color: #c62828; }
.dream-mockup .db-col .lines { display: flex; flex-direction: column; gap: 6px; filter: blur(4.5px); transition: filter .55s ease; }
.dream-mockup .db-col .line { height: 8px; background: #E5DFD0; border-radius: 2px; }
.dream-mockup .db-col .line.short { width: 65%; }
.dream-mockup .db-col .line.mid { width: 82%; }
.dream-mockup.unlocked .db-col .lines { display: none; }
.dream-mockup .db-list { display: none; list-style: none; padding: 0; margin: 0; flex-direction: column; gap: 6px; }
.dream-mockup.unlocked .db-list { display: flex; }
.dream-mockup .db-list li { font-size: 12px; line-height: 1.6; color: #2a2520; word-break: keep-all; }

/* Big CTA */
.dream-mockup .paid-cta { margin: 0 20px; margin-top: -28px; background: linear-gradient(135deg, #1a1a1a, #2a2520); color: #fff; border-radius: 14px; padding: 22px 20px 20px; position: relative; overflow: hidden; z-index: 2; box-shadow: 0 8px 30px rgba(26,22,18,.22); transition: opacity .4s ease, transform .4s ease; }
.dream-mockup.unlocked .paid-cta { display: none; }
.dream-mockup .paid-cta::before { display: none; content: '解'; position: absolute; right: -10px; bottom: -30px; font-family: 'Noto Serif KR', serif; font-size: 140px; font-weight: 900; color: rgba(212,175,55,.08); line-height: 1; }
.dream-mockup .paid-cta .lab { font-size: 11px; color: #E8D9B8; letter-spacing: 0.2em; font-weight: 600; margin-bottom: 6px; position: relative; }
.dream-mockup .paid-cta h3 { font-family: 'Noto Serif KR', serif; font-size: 18px; font-weight: 700; margin-bottom: 8px; position: relative; line-height: 1.45; }
.dream-mockup .paid-cta .hook { font-size: 13px; color: #c4baa0; line-height: 1.7; position: relative; margin-bottom: 14px; word-break: keep-all; }
.dream-mockup .paid-cta .hook strong { color: #f2d678; font-weight: 600; }
.dream-mockup .paid-cta .cta-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #E8D9B8, #B8965A); color: #1a1a1a; padding: 13px 18px; border-radius: 100px; font-size: 14px; font-weight: 700; cursor: pointer; position: relative; text-align: center; border: none; width: 100%; }
.dream-mockup .paid-cta .cta-btn .cost { background: rgba(26,26,26,.12); padding: 3px 10px; border-radius: 100px; font-size: 11.5px; font-weight: 700; }
/* 2026-09-17 — 스트리밍 중 결제 race 차단: 잠금 풀이가 다 쓰일 때까지 CTA 비활성 */
.dream-mockup .paid-cta .cta-btn:disabled { opacity: .55; cursor: default; }
.dream-mockup .paid-cta .sub { font-size: 11px; color: #7F6B4E; text-align: center; margin-top: 8px; position: relative; }

/* Actions */
.dream-mockup .actions { margin: 22px 20px 0; padding: 18px 0; border-top: 1px solid #E5DFD0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dream-mockup .actions .btn { background: #fff; border: 1px solid #E5DFD0; border-radius: 12px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: #1a1a1a; cursor: pointer; transition: .2s; }
.dream-mockup .actions .btn:hover { border-color: #B8965A; }
.dream-mockup .actions .btn svg { width: 22px; height: 22px; color: #B8965A; }
.dream-mockup .actions .btn .ti { font-size: 12.5px; font-weight: 600; }
.dream-mockup .actions .btn .sb { font-size: 11px; color: #7F6B4E; }

/* 꿈 종류 → 주제 추천 (2026-09-17) — 카드 1장 + 보조 링크 */
.dream-mockup .topic-rec { margin: 22px 20px 0; }
.dream-mockup .topic-rec .tr-lab { font-size: 11px; color: #7F6B4E; letter-spacing: 0.15em; font-weight: 600; margin-bottom: 8px; }
.dream-mockup .topic-rec .tr-card { all: unset; box-sizing: border-box; width: 100%; min-height: 44px; display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #E5DFD0; border-radius: 16px; padding: 14px 14px 14px 16px; cursor: pointer; transition: border-color .2s ease, box-shadow .2s ease; }
.dream-mockup .topic-rec .tr-card:hover { border-color: #B8965A; box-shadow: 0 4px 12px rgba(184,150,90,.12); }
.dream-mockup .topic-rec .tr-card:focus-visible, .dream-mockup .topic-rec .tr-sub:focus-visible { outline: 2px solid #B8965A; outline-offset: 2px; }
.dream-mockup .topic-rec .tr-kanji { flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Noto Serif KR', serif; font-size: 20px; font-weight: 700; }
.dream-mockup .topic-rec .tr-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.dream-mockup .topic-rec .tr-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dream-mockup .topic-rec .tr-name { font-family: 'Noto Serif KR', serif; font-size: 15px; font-weight: 700; color: #1a1a1a; }
.dream-mockup .topic-rec .tr-price { font-size: 11px; font-weight: 700; color: #8C6D3D; background: rgba(184,150,90,.12); padding: 2px 8px; border-radius: 100px; }
.dream-mockup .topic-rec .tr-copy { font-size: 12.5px; line-height: 1.65; color: #2a2520; word-break: keep-all; }
.dream-mockup .topic-rec .tr-arrow { flex-shrink: 0; font-size: 20px; color: #B8965A; line-height: 1; }
.dream-mockup .topic-rec .tr-sub { all: unset; box-sizing: border-box; display: block; width: 100%; min-height: 44px; margin-top: 6px; padding: 12px 4px; font-size: 12px; color: #7F6B4E; text-align: center; cursor: pointer; word-break: keep-all; }
.dream-mockup .topic-rec .tr-sub .tr-sub-name { color: #5C4A2E; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }

/* Notice */
.dream-mockup .service-notice { margin: 22px 20px 0; padding: 14px 18px; border-top: 1px dashed #E5DFD0; font-size: 11px; line-height: 1.65; color: #9A8B70; text-align: center; }
.dream-mockup .service-notice p { margin: 0; }
.dream-mockup .spacer { height: 80px; }

/* 아코디언 헤드 (무료 §01~§04 만 클릭 토글) */
.dream-mockup .acc-head { all: unset; display: block; width: 100%; cursor: pointer; padding: 4px 0; }
.dream-mockup .lk-sec .acc-head { cursor: default; }
.dream-mockup .acc-head:hover .sec-title .title-flex { color: #5C4A2E; }
.dream-mockup .acc-head .sec-title { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.dream-mockup .acc-head .sec-title .title-flex { display: flex; align-items: baseline; gap: 6px; flex: 1; }
.dream-mockup .acc-caret { font-size: 14px; color: #B8965A; transition: transform .25s ease; transform: rotate(-90deg); }
.dream-mockup .acc-caret.open { transform: rotate(0); }
.dream-mockup .acc-body { margin-top: 4px; }

/* Skeleton (점진 로딩 표시) */
.dream-mockup .skel-stack { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.dream-mockup .skel-line { height: 14px; border-radius: 4px; background: linear-gradient(90deg, #F0E8D9 0%, #F8F2E5 50%, #F0E8D9 100%); background-size: 200% 100%; animation: dream-skel 1.4s ease-in-out infinite; margin-top: 6px; display: block; }
.dream-mockup .skel-line:first-child { margin-top: 0; }
.dream-mockup .skel-line.w-50 { width: 50%; height: 12px; margin: 0 auto; }
.dream-mockup .skel-line.w-60 { width: 60%; }
.dream-mockup .skel-line.w-80 { width: 80%; }
.dream-mockup .skel-line.w-90 { width: 90%; }
.dream-mockup .skel-line.w-full { width: 100%; }
@keyframes dream-skel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* §02 symbol skeleton card (실 카드와 동일 레이아웃 유지 — UX 어색함 X) */
.dream-mockup .sym.sym-skel { opacity: 0.85; }
.dream-mockup .sym .pic.skel-circle { background: linear-gradient(90deg, #F0E8D9 0%, #F8F2E5 50%, #F0E8D9 100%); background-size: 200% 100%; animation: dream-skel 1.4s ease-in-out infinite; color: transparent; }
.dream-mockup .sym.sym-skel .dc { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.dream-mockup .sym.sym-skel .dc .skel-line { height: 10px; }

/* 강조 위계 3-tier — 형광펜, 밑줄, 볼드 (전 본문 적용) */
.dream-mockup p strong, .dream-mockup .lk-teaser strong, .dream-mockup .lk-full strong, .dream-mockup .qc .interp strong, .dream-mockup .worry-link p strong, .dream-mockup .warn-list li strong, .dream-mockup .sym .dc strong {
  font-weight: 700;
  background: linear-gradient(180deg, transparent 58%, rgba(184,150,90,.32) 58%, rgba(184,150,90,.32) 95%, transparent 100%);
  padding: 1px 3px;
  color: #1a1a1a;
  border-radius: 2px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.dream-mockup p u, .dream-mockup .lk-teaser u, .dream-mockup .lk-full u, .dream-mockup .qc .interp u, .dream-mockup .worry-link p u {
  text-decoration: none;
  border-bottom: 2px solid #B8965A;
  padding-bottom: 1px;
  color: #5C4A2E;
  font-weight: 600;
}
.dream-mockup p b, .dream-mockup .lk-teaser b, .dream-mockup .lk-full b, .dream-mockup .qc .interp b, .dream-mockup .sym .dc b, .dream-mockup .worry-link p b, .dream-mockup .warn-list li b {
  color: #5C4A2E;
  font-weight: 700;
  font-family: 'Noto Serif KR', serif;
  background: rgba(184,150,90,0.08);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.96em;
}
.dream-mockup p b strong, .dream-mockup p strong b { background: linear-gradient(180deg, transparent 58%, rgba(184,150,90,.32) 58%); color: #1a1a1a; padding: 1px 4px; }

/* 섹션 시각 위계 — 무료 (open 상태에서 좌측 골드 라인), 잠금 (다크 헤더) */
.dream-mockup .section { padding-left: 0; border-left: 0; transition: padding .2s ease; }
.dream-mockup .section .acc-head { padding: 14px 0 8px; }
.dream-mockup .section.is-open { padding-left: 12px; border-left: 3px solid rgba(184,150,90,.55); margin-left: -4px; }
.dream-mockup .section .sec-num { color: #A23A2A; font-weight: 900; }
.dream-mockup .section + .section { border-top: 1px solid #EEE5D2; margin-top: 16px; }

/* §02 symbol 카드 hover 미세 강조 */
.dream-mockup .sym { transition: transform .2s ease, box-shadow .2s ease; }
.dream-mockup .sym:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(184,150,90,.12); }
`;

const SYMBOL_PIC_CLASS: Record<string, string> = {
  'ui:water': 'water',
  'ui:foot': 'foot',
  'ui:ripple': 'ripple',
  'ui:shadow': 'shadow',
  'ui:fire': 'fire',
  'ui:metal': 'metal',
  'ui:leaf': 'leaf',
  'ui:mountain': 'mountain',
};

const OHENG_KANJI: Record<string, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
const OHENG_COLOR: Record<string, string> = { 수: '#3E5F82', 토: '#7F6B4E', 목: '#4E7A57', 화: '#c62828', 금: '#7D7870' };

export function DreamMockupView(props: DreamMockupViewProps) {
  const { result: raw, profile, hasSaju, category, dreamText, concern, unlocked = false, isStreaming = false, createdAt, categoryId, onUnlock, onShare, onChat, onTopic } = props;

  // 스키마 어댑터 — AI V3 schema (narrative/sajuTone/todayConnection/verdict/symbols.meaningWithSaju) →
  //   View v5 (firstImpression/worryConnection/quoteInterpretations/dreamQuote/symbols.meaning) 매핑.
  const result: any = useMemo(() => {
    if (!raw || typeof raw !== 'object') return {};
    const r: any = { ...raw };
    if (!r.firstImpression && typeof r.narrative === 'string' && r.narrative.length > 0) {
      r.firstImpression = { narrative: r.narrative, strongImages: Array.isArray(r.keywords) ? r.keywords.slice(0, 2) : [] };
    }
    if (!r.worryConnection && typeof r.todayConnection === 'string' && r.todayConnection.length > 0) {
      r.worryConnection = { narrative: r.todayConnection };
    }
    if (!r.dreamQuote && typeof r.verdict === 'string' && r.verdict.length > 0) {
      r.dreamQuote = r.verdict;
    }
    // 2026-05-27 — §03 sajuTone → quoteInterpretations 합성 제거 (할루시네이션 — title 을 user quote 처럼 노출).
    //   V3 prompt 가 quoteInterpretations 출력 X 라면 §03 자체 hide (조건부 렌더). prompt V5 업그레이드 후 정상 노출.
    if (Array.isArray(r.symbols)) {
      r.symbols = r.symbols.map((s: any) => ({
        ...s,
        meaning: s?.meaning || s?.meaningWithSaju || '',
        kanji: s?.kanji || (s?.oheng ? OHENG_KANJI[s.oheng] : ''),
      }));
    }
    return r;
  }, [raw]);

  const title = stripMd(String(result?.title || '꿈 해석'));
  // 2026-09-17 fix — 보관함에서 다시 연 꿈도 '오늘' 날짜로 찍히던 문제 → 저장본은 생성일(createdAt) 기준
  const fmtDate = (d: Date) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const createdDate = createdAt != null ? new Date(createdAt) : null;
  const dateLabel = fmtDate(createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate : new Date());
  const isTodayRecord = dateLabel === fmtDate(new Date());
  // 꿈 종류 → 주제 추천 (SSOT 파생 · 카테고리 없으면 기본 규칙)
  const topicRec = useMemo(() => getDreamTopicRec(categoryId), [categoryId]);
  const ilganLabel = profile?.sajuData?.pillars?.[2]?.천간 ? ` ${profile.sajuData.pillars[2].천간}${profile.sajuData.pillars[2].천간오행 || ''} 일간` : '';

  const firstImpression = result.firstImpression;
  const symbols: any[] = Array.isArray(result.symbols)
    ? result.symbols.filter((s: any) => s && typeof s.meaning === 'string' && s.meaning.length >= 30).slice(0, 4)
    : [];
  const quotes: any[] = Array.isArray(result.quoteInterpretations) ? result.quoteInterpretations.slice(0, 3) : [];
  const worry = result.worryConnection;
  const dreamQuote = stripMd(String(result.dreamQuote || ''));
  const lockedDayganRead = result.lockedDayganRead;
  const lockedOhengFlow = result.lockedOhengFlow;
  const lockedWarnList = result.lockedWarnList;
  const lockedTimeline = result.lockedTimeline;
  const lockedAction = result.lockedAction;
  const hasAnyLocked = lockedDayganRead || lockedOhengFlow || lockedWarnList || lockedTimeline || lockedAction;
  // 2026-05-27 — streaming 중엔 locked stack 항상 노출 (skeleton 으로 진행감)
  const showLockedStack = hasAnyLocked || isStreaming;

  // pie conic-gradient
  const piePercents = lockedOhengFlow?.ohengPercent;
  const pieGradient = (() => {
    if (!piePercents) return null;
    let acc = 0;
    const order: Array<'수' | '토' | '목' | '화' | '금'> = ['수', '토', '목', '화', '금'];
    const stops: string[] = [];
    order.forEach((k) => {
      const pct = Number(piePercents[k] ?? 0);
      if (pct <= 0) return;
      stops.push(`${OHENG_COLOR[k]} ${acc}% ${acc + pct}%`);
      acc += pct;
    });
    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  })();

  // Highlight quote text
  const renderQuoteSrc = (quote: string, highlight: string) => {
    if (!highlight || !quote.includes(highlight)) return <span>{quote}</span>;
    const [pre, post] = quote.split(highlight);
    return <>{pre}<span className="hl">{highlight}</span>{post}</>;
  };

  return (
    <div className={`dream-mockup${unlocked ? ' unlocked' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: MOCKUP_CSS }} />
      <div className="page">
        {/* Header */}
        <header className="hd">
          <div className="top">
            {/* 2026-09-17 fix — 1운으로 연(해제·유료) 결과에도 '무료 · 오늘 1회 무료' 가 붙던 문제 */}
            {unlocked ? (
              <>
                <span className="badge">꿈해몽, 전체 풀이</span>
                <span className="badge open">잠금 해제</span>
              </>
            ) : (
              <>
                <span className="badge">무료 꿈해몽</span>
                {isTodayRecord && <span className="badge free">오늘 1회 무료</span>}
              </>
            )}
            <span>{profile?.name || '당신'} 님</span>
          </div>
          <h1>{title}</h1>
          <div className="date">{dateLabel}{ilganLabel}</div>
        </header>

        {/* 3-part 입력 */}
        <div className="input-stack">
          <div className="ic topic">
            <div className="lb"><span className="dot" />꿈 주제</div>
            <div className="tx">{category}</div>
          </div>
          {dreamText && (
            <div className="ic dream">
              <div className="lb"><span className="dot" />꿈 내용</div>
              <div className="tx">"{dreamText}"</div>
            </div>
          )}
          {concern && (
            <div className="ic worry">
              <div className="lb"><span className="dot" />요새 고민</div>
              <div className="tx">{concern}</div>
            </div>
          )}
        </div>

        <main className="body">
          {/* §01 첫 인상 (default 펼침 — 진입 시 가장 먼저 읽힘) */}
          <DreamSection
            num="一"
            title="첫 인상"
            han="初相"
            defaultOpen={true}
            hasData={!!firstImpression?.narrative}
            isStreaming={isStreaming}
            skeletonLines={5}
          >
            {firstImpression?.narrative && (
              <>
                {Array.isArray(firstImpression.strongImages) && firstImpression.strongImages.length >= 1 && (
                  <p style={{ marginTop: 6, fontSize: 12, color: '#7F6B4E' }}>
                    가장 세게 남은 이미지: {firstImpression.strongImages.slice(0, 2).map((s: string) => `"${s}"`).join(', ')}
                  </p>
                )}
                {String(firstImpression.narrative).split('\n').filter(Boolean).map((para: string, i: number) => (
                  <p key={i} dangerouslySetInnerHTML={safeHtml(para)} />
                ))}
              </>
            )}
          </DreamSection>

          {/* §02 꿈 속 상징 (default 펼침 — 스트리밍 중 항상 4 슬롯 / 종료 시 실 카드 개수만) */}
          <DreamSection
            num="二"
            title="꿈 속 상징"
            han="象徵"
            defaultOpen={true}
            hasData={isStreaming || symbols.length > 0}
            isStreaming={isStreaming}
            skeletonLines={4}
          >
            <div className="symbol-grid">
              {Array.from({ length: isStreaming ? 4 : symbols.length }).map((_, i) => {
                const s = symbols[i];
                // 데이터 있는 카드 = 본문 / 없으면 skeleton card (shimmer placeholder)
                if (s) {
                  const picClass = SYMBOL_PIC_CLASS[String(s?.pictogram || '')] || '';
                  return (
                    <div key={i} className="sym">
                      <div className={`pic ${picClass}`}>
                        {s?.kanji || ''}
                      </div>
                      <div className="hd2">
                        <span className="nm">{stripMd(String(s?.keyword || ''))}</span>
                        {s?.kanji && <span className="han">{s.kanji}</span>}
                      </div>
                      <div className="dc" dangerouslySetInnerHTML={safeHtml(String(s?.meaning || s?.meaningWithSaju || ''))} />
                    </div>
                  );
                }
                // skeleton card — sym 동일 레이아웃 + shimmer 라인들
                return (
                  <div key={i} className="sym sym-skel" aria-busy="true" aria-label="상징 카드 로딩 중">
                    <div className="pic skel-circle" />
                    <div className="hd2">
                      <span className="skel-line w-50" style={{ width: 50, display: 'inline-block' }} />
                    </div>
                    <div className="dc">
                      <div className="skel-line w-full" />
                      <div className="skel-line w-90" />
                      <div className="skel-line w-80" />
                      <div className="skel-line w-full" />
                      <div className="skel-line w-60" />
                    </div>
                  </div>
                );
              })}
            </div>
          </DreamSection>

          {/* §03 사용자 문장 인용 — V3 prompt 가 quoteInterpretations 출력 X.
              prompt V5 업그레이드 후 정상 노출. 임시로 quotes 있을 때만 렌더. */}
          {quotes.length > 0 && (
            <DreamSection
              num="三"
              title={`${profile?.name ? `${profile.name} 님` : '내가'} 쓴 문장이 말하는 것`}
              han="文解"
              defaultOpen={false}
              hasData={quotes.length > 0}
            >
              <p className="sec-lead">꿈을 적을 때 쓴 문장 안에 이미 해석이 반쯤 담겨 있습니다.</p>
              <div className="quote-stack">
                {quotes.map((q, i) => (
                  <div key={i} className="qc">
                    <div className="src">{renderQuoteSrc(stripMd(String(q?.quote || '')), stripMd(String(q?.highlight || '')))}</div>
                    <div className="interp">
                      {q?.tag && <span className="tag">{stripMd(String(q.tag))}</span>}
                      <span dangerouslySetInnerHTML={safeHtml(q?.interp || '')} />
                    </div>
                  </div>
                ))}
              </div>
            </DreamSection>
          )}

          {/* §04 요새 고민과 이 꿈 */}
          <DreamSection
            num="四"
            title="요새 고민과 이 꿈"
            han="應夢"
            defaultOpen={false}
            hasData={!!(worry?.narrative || dreamQuote)}
            isStreaming={isStreaming}
            skeletonLines={4}
          >
            {worry?.narrative && (
              <>
                <p className="sec-lead">적어주신 고민과 꿈의 장면이 어떻게 맞물리는지 짚습니다.</p>
                <div className="worry-link">
                  <div className="h">
                    <span className="lab">요새 고민</span>
                    <span className="arrow">→</span>
                    <span className="lab dream">꿈 속 장면</span>
                  </div>
                  <p dangerouslySetInnerHTML={safeHtml(worry.narrative || '')} />
                </div>
              </>
            )}
            {dreamQuote && <div className="pullq">{dreamQuote}</div>}
          </DreamSection>
        </main>

        {/* 잠금 진입 */}
        {showLockedStack && (
          <>
            <div className="locked-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div className="title-col">
                <div className="lab">{unlocked ? 'UNLOCKED, 사주 연동 심층 풀이' : 'DEEPER, 사주 연동 심층 풀이'}</div>
                <div className="ttl">
                  {unlocked
                    ? `${profile?.name ?? '당신'} 님 사주와 꿈을 함께 읽은 심층 풀이`
                    : `이 아래는 ${profile?.name ?? '당신'} 님 사주와 꿈을 함께 읽습니다`}
                </div>
              </div>
            </div>

            <div className="locked-stack">
              {/* §05 일간 연동 */}
              {(lockedDayganRead?.teaser || isStreaming) && (
                <div className="lk-sec">
                  <div className="sec-num">五</div>
                  <div className="sec-title">
                    {stripMd(String(lockedDayganRead?.title || '일간으로 보는 이 꿈'))}
                    <svg className="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </div>
                  <div className="lk-body">
                    {lockedDayganRead?.teaser ? (
                      <>
                        <p className="lk-teaser" dangerouslySetInnerHTML={safeHtml(lockedDayganRead.teaser)} />
                        <div className="lk-blurred">
                          <p>일간이 갖는 고유한 의미를 깊이 풀어드립니다. 결정적인 풀이는 잠금 해제 후에 보여드립니다.</p>
                          <p>월간과 연간 배치와 어떻게 맞물려 지금의 머뭇거림을 만드는지 이어서 풀이합니다.</p>
                        </div>
                        {lockedDayganRead.full && <div className="lk-full" dangerouslySetInnerHTML={safeHtml(lockedDayganRead.full)} />}
                      </>
                    ) : (
                      <div className="skel-stack">
                        <div className="skel-line w-90" /><div className="skel-line w-full" /><div className="skel-line w-80" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* §06 오행 흐름 */}
              {(lockedOhengFlow?.teaser || isStreaming) && (
                <div className="lk-sec">
                  <div className="sec-num">六</div>
                  <div className="sec-title">
                    {stripMd(String(lockedOhengFlow?.title || '꿈이 드러낸 오행 흐름'))}
                    <svg className="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </div>
                  <div className="lk-body">
                    {lockedOhengFlow?.teaser ? (
                      <>
                        {pieGradient && piePercents && (
                          <div className="lk-diag pie-teaser">
                            <div className="pie" style={{ background: pieGradient }} />
                            <div className="legend">
                              {(['수', '토', '목', '화', '금'] as const).map((k) => {
                                const pct = Number(piePercents[k] ?? 0);
                                if (pct <= 0) return null;
                                return (
                                  <div key={k} className="row">
                                    <span className="sw" style={{ background: OHENG_COLOR[k] }} />
                                    {OHENG_KANJI[k]} {pct}% {lockedOhengFlow.dominantOheng === k && '(강)'}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <p className="lk-teaser" style={{ marginTop: 10 }} dangerouslySetInnerHTML={safeHtml(lockedOhengFlow.teaser)} />
                        <div className="lk-blurred">
                          <p>이 오행 분포가 사주 원국과 현재 운세와 어떻게 맞물리는지를 이어서 풀이합니다.</p>
                        </div>
                        {lockedOhengFlow.full && <div className="lk-full" dangerouslySetInnerHTML={safeHtml(lockedOhengFlow.full)} />}
                      </>
                    ) : (
                      <div className="skel-stack">
                        <div className="skel-line w-90" /><div className="skel-line w-full" /><div className="skel-line w-80" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* §07 경고 */}
              {(lockedWarnList?.intro || isStreaming) && (
                <div className="lk-sec">
                  <div className="sec-num">七</div>
                  <div className="sec-title">
                    {stripMd(String(lockedWarnList?.title || '이 꿈이 경고하는 것'))} <span className="han">忌</span>
                    <svg className="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </div>
                  <div className="lk-body">
                    {lockedWarnList?.intro ? (
                      <>
                        <p className="lk-teaser" dangerouslySetInnerHTML={safeHtml(lockedWarnList.intro)} />
                        <ul className="warn-list">
                          {Array.isArray(lockedWarnList.warns) && lockedWarnList.warns.slice(0, 3).map((w: any, i: number) => (
                            <li key={i} className={i === 0 ? '' : 'locked'}>
                              {w?.label && <><strong>{String(i + 1).padStart(2, '0')}. {stripMd(String(w.label))}.</strong> </>}
                              {/* i=0 은 무료 teaser(detail 노출), i≥1 은 잠금(summary). 결제(unlocked) 시 전부 detail 노출 —
                                  CSS 블러만 풀고 본문은 summary 그대로 두던 버그 fix (2026-06-13): 유료 detail 150자가 누락되던 것 */}
                              <span dangerouslySetInnerHTML={safeHtml((i === 0 || unlocked) ? (w?.detail || w?.summary || '') : (w?.summary || ''))} />
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <div className="skel-stack">
                        <div className="skel-line w-80" /><div className="skel-line w-full" /><div className="skel-line w-90" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* §08 시기 */}
              {(lockedTimeline?.teaser || isStreaming) && (
                <div className="lk-sec">
                  <div className="sec-num">八</div>
                  <div className="sec-title">
                    {stripMd(String(lockedTimeline?.title || '이 꿈이 예고하는 시기'))}
                    <svg className="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </div>
                  <div className="lk-body">
                    {lockedTimeline?.teaser ? (
                      <>
                        {Array.isArray(lockedTimeline.monthMarks) && (
                          <div className="lk-diag timeline">
                            <div className="tl-months">
                              {(lockedTimeline.monthMarks as number[]).slice(0, 12).map((m, i) => {
                                const cls = m === 2 ? 'tl-cell mark strong' : (m === 1 ? 'tl-cell mark' : 'tl-cell');
                                return <div key={i} className={cls} />;
                              })}
                            </div>
                            <div className="tl-lbls"><span>1월</span><span>6월</span><span>12월</span></div>
                            <div className="tl-cap">표시된 달이 이 꿈이 예고하는 <strong>결정의 시기</strong>입니다.</div>
                          </div>
                        )}
                        <p className="lk-teaser" style={{ marginTop: 10 }} dangerouslySetInnerHTML={safeHtml(lockedTimeline.teaser)} />
                        <div className="lk-blurred">
                          <p>이 시기가 사주 대운과 어떻게 맞물려 있는지를 이어서 풀이합니다.</p>
                        </div>
                        {lockedTimeline.full && <div className="lk-full" dangerouslySetInnerHTML={safeHtml(lockedTimeline.full)} />}
                      </>
                    ) : (
                      <div className="skel-stack">
                        <div className="skel-line w-full" /><div className="skel-line w-80" /><div className="skel-line w-90" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* §09 처방 */}
              {(lockedAction?.teaser || isStreaming) && (
                <div className="lk-sec">
                  <div className="sec-num">九</div>
                  <div className="sec-title">
                    {stripMd(String(lockedAction?.title || '구체 실천 처방'))} <span className="han">處方</span>
                    <svg className="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </div>
                  <div className="lk-body">
                    {lockedAction?.teaser ? (
                      <>
                        <p className="lk-teaser" dangerouslySetInnerHTML={safeHtml(lockedAction.teaser)} />
                        <div className="dual-blind">
                          <div className="db-col go">
                            <div className="ch">✓ 해야 할 것 3</div>
                            <div className="lines">
                              <div className="line" /><div className="line mid" /><div className="line short" />
                            </div>
                            {Array.isArray(lockedAction.doList) && (
                              <ul className="db-list">
                                {(lockedAction.doList as string[]).slice(0, 3).map((d, i) => <li key={i}>{stripMd(d)}</li>)}
                              </ul>
                            )}
                          </div>
                          <div className="db-col no">
                            <div className="ch">✕ 피할 것 3</div>
                            <div className="lines">
                              <div className="line mid" /><div className="line" /><div className="line short" />
                            </div>
                            {Array.isArray(lockedAction.dontList) && (
                              <ul className="db-list">
                                {(lockedAction.dontList as string[]).slice(0, 3).map((d, i) => <li key={i}>{stripMd(d)}</li>)}
                              </ul>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="skel-stack">
                        <div className="skel-line w-90" /><div className="skel-line w-full" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Big CTA */}
            {!unlocked && (
              <div className="paid-cta">
                <div className="lab">UNLOCK, 사주 연동 심층 풀이</div>
                <h3>같은 꿈도 사주 일간에 따라<br />의미가 달라집니다.</h3>
                <p className="hook">
                  {profile?.name ?? '당신'} 님은 <strong>{profile?.sajuData?.pillars?.[2]?.천간 || ''}{profile?.sajuData?.pillars?.[2]?.천간오행 ? `(${profile.sajuData.pillars[2].천간오행})` : ''}</strong> 일간입니다. 위 다섯 섹션(일간 연동, 오행 흐름, 꿈의 경고, 예고 시기, 실천 처방)을 전부 열어드립니다.
                </p>
                {/* 2026-09-17 — 스트리밍 중 결제 race 차단 (잠금 본문이 다 쓰이기 전 1운 차감 → 해제 저장 누락·자동환불 꼬임) */}
                <button
                  type="button"
                  className="cta-btn"
                  onClick={onUnlock}
                  disabled={isStreaming}
                  aria-busy={isStreaming || undefined}
                >
                  {isStreaming ? '풀이를 마무리하는 중이에요' : '내 사주 연동 심층 풀이 열기'}
                  {!isStreaming && <span className="cost">1운</span>}
                </button>
                <div className="sub">
                  {isStreaming
                    ? '잠금 풀이까지 다 쓰이면 바로 열 수 있어요'
                    : '풀이는 즉시 열립니다, 결과는 보관함에 자동 저장'}
                </div>
              </div>
            )}
          </>
        )}

        {/* 꿈 종류 → 주제 추천 (2026-09-17 · 잠금 해제 여부 무관 노출) */}
        {onTopic && (
          <section className="topic-rec" aria-label="이 꿈과 이어서 볼 주제">
            <div className="tr-lab">이 꿈과 이어서 보면 좋은 풀이</div>
            <button type="button" className="tr-card" onClick={() => onTopic(topicRec.id)}>
              <span
                className="tr-kanji"
                aria-hidden="true"
                style={{ color: topicRec.color, background: `${topicRec.color}1F` }}
              >
                {topicRec.kanji}
              </span>
              <span className="tr-main">
                <span className="tr-head">
                  <span className="tr-name">{topicRec.label}</span>
                  <span className="tr-price">{topicRec.price}</span>
                </span>
                <span className="tr-copy">{topicRec.copy}</span>
              </span>
              <span className="tr-arrow" aria-hidden="true">›</span>
            </button>
            {topicRec.secondary && (
              <button
                type="button"
                className="tr-sub"
                onClick={() => topicRec.secondary && onTopic(topicRec.secondary.id)}
              >
                {topicRec.secondary.lead} <span className="tr-sub-name">{topicRec.secondary.label} 보기</span>, {topicRec.secondary.price}
              </button>
            )}
          </section>
        )}

        {/* Actions */}
        <div className="actions">
          <div className="btn" onClick={onShare} role="button" tabIndex={0}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <div className="ti">친구에게 공유하기</div>
            <div className="sb">결과 카드 송출</div>
          </div>
          <div className="btn" onClick={onChat} role="button" tabIndex={0}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <div className="ti">이 꿈으로 상담 이어가기</div>
            <div className="sb">사주대화</div>
          </div>
        </div>

        {/* Service notice */}
        <div className="service-notice">
          <p>꿈 풀이는 상징 해석에 기반한 참고 자료이며, 모든 결정은 본인의 몫입니다.</p>
        </div>

        <div className="spacer" />
        {/* hasSaju 미사용 가드 (props 호환) */}
        {hasSaju && null}
      </div>
    </div>
  );
}
