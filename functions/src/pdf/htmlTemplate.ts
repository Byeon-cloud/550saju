/**
 * #61 · 프리미엄 PDF — HTML 템플릿 v2 (서버 사이드 puppeteer 입력용)
 *
 * 2026-07-05 완성판 재작성 (준기 결정 "완벽 아니면 없앤다" 해제 조건):
 *   ① AI 본문 강조 태그를 이스케이프하지 않고 화이트리스트 변환 (앱 강조 3-tier SSOT 동일)
 *      - <strong> 황금볼드(#A37A2E) + 형광펜 rgba(244,209,102,.55) — 유저 일상 결론 (앱 SSOT)
 *      - <u>      골드 밑줄 #B8965A — 시기·숫자·색·방위
 *      - <b>      검정 볼드 — 한자 첫 등장
 *      - 그 외 태그는 제거, 나머지 텍스트는 전부 이스케이프 (XSS 방어 유지)
 *   ② claudePremium 스키마 전면 반영 — 앱 §01~10 구성 미러 (PremiumResult.tsx)
 *      lifeEdge · sipCluster · shinsalCards · lifeKeyword/strengths/cautions(구 rel6Cards)
 *      · actionList · monthlyInsight · sectionConclusions · topicMini
 *      + pillarMessages · analysisBase · daeunPeriods · monthlyWarnings · scores · lifestyleAdvice
 *   ③ 서버 현재시각 KST (kstNow) — UTC 함정 회피 (연운 간지·발급일)
 *
 * 입력: claudePremium.ts 병합 결과 (sections 7개: summary/structure/sipsung/yongsin/daeun/yearly/practice)
 *      + sajuData (pillars · elements) + profile (이름 · 생년월일 · 성별)
 * 출력: 단일 HTML 문자열 (A4 인쇄용 · 표지 + §01~10 + 푸터 디스클레이머)
 *
 * 한자 폰트 fallback 위험 0 — Noto Serif KR (Google Fonts CDN) 임베딩
 *   puppeteer 가 페이지 로드 시 외부 폰트 페치 → PDF 안에 글리프 임베디드.
 *
 * 브랜드 토큰 (D1 SSOT):
 *   gold #B8965A · gold-deep #8C6D3D · ink #1A1A1A · paper #F8F5EE · line #E5DFD0
 *   본문 strong #A37A2E · 결론박스 strong #F4D166 (다크 배경)
 */

import { kstNow } from '../utils/kstTime';

export interface PdfTemplateInput {
  profile: {
    name: string;
    birthDate?: string;   // 'YYYY-MM-DD'
    birthTime?: string;   // 'HH:mm' | undefined
    gender?: 'male' | 'female';
  };
  sajuData: any;
  aiResult: any;
  /** 서버 발급 시각 (ISO 8601) */
  issuedAt: string;
  /** 발급 일련번호 (reportId 마지막 8자 등) */
  issueId: string;
}

/* ══════════════════════════════════════════════════════════════════
 * 안전 이스케이프 (XSS · HTML injection 방어)
 * ═════════════════════════════════════════════════════════════════ */
function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** HTML 엔티티 디코드 — AI 가 &lt;strong&gt; 로 이스케이프해 보내는 케이스 복원 (클라 sanitizeAiText 와 동일 순서) */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

/**
 * 제어문자 제거 — C0/C1 컨트롤(탭·개행·CR 제외).
 *  · richText 는 태그 자리표시자로 NUL(U+0000) 을 쓰므로, 입력에 섞인 NUL 이 자리표시자와
 *    충돌해 강조 태그가 어긋나거나(포맷 블리드) puppeteer 로 흘러가 대체글리프(U+FFFD)로 찍히는 것을 원천 차단.
 *  · \t(\x09)·\n(\x0a)·\r(\x0d) 는 문단 분리에 필요하므로 보존.
 */
function stripControls(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

/** 마크다운 서식 제거 (태그는 건드리지 않음) */
function stripMdMarks(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/(?<!\w)\*(?!\*)/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`/g, '');
}

/** plain text 생산기 — 모든 태그 제거 + md 제거 (표 셀·타이틀 등 강조 불필요 자리) */
function plainText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return stripMdMarks(
    decodeEntities(stripControls(String(v))).replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^<>]*>/g, ''),
  ).trim();
}

/** plain + escape — 템플릿 삽입용 한 방 헬퍼 */
function txt(v: unknown): string {
  return esc(plainText(v));
}

const ALLOWED_TAGS = /^(strong|b|u|em|br)$/;

/**
 * AI 본문 → 안전한 강조 HTML (앱 3-tier SSOT 화이트리스트)
 *  - strong/b/u/em/br 만 통과 (속성 전부 제거 → onclick 류 주입 차단)
 *  - 그 외 태그 제거, 남은 텍스트 전부 esc (raw <, > 방어)
 *  - 밸런스 보정: 짝 없는 닫는 태그 drop · 안 닫힌 태그 끝에서 닫기 (A4 레이아웃 오염 방지)
 */
function richText(v: unknown): string {
  if (v === null || v === undefined) return '';
  const raw = stripMdMarks(decodeEntities(stripControls(String(v)))).trim();
  if (!raw) return '';

  type Tok = { close: boolean; tag: string };
  const toks: Tok[] = [];
  let s = raw.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g, (_m, slash, rawTag) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED_TAGS.test(tag)) return '';
    toks.push({ close: slash === '/', tag });
    return `\u0000${toks.length - 1}\u0000`;
  });

  s = esc(s); // placeholder(\u0000 N \u0000) 는 esc 대상 문자 없음 — 안전

  const out: string[] = new Array(toks.length).fill('');
  const stack: number[] = [];
  toks.forEach((t, i) => {
    if (t.tag === 'br') { out[i] = '<br/>'; return; }
    if (!t.close) { stack.push(i); out[i] = `<${t.tag}>`; return; }
    let found = -1;
    for (let j = stack.length - 1; j >= 0; j--) {
      if (toks[stack[j]].tag === t.tag) { found = j; break; }
    }
    if (found === -1) { out[i] = ''; return; } // 짝 없는 닫는 태그 drop
    // 잘못 중첩된 안쪽 태그 먼저 닫기 (AI 는 중첩을 안 쓰지만 방어)
    let closing = '';
    for (let j = stack.length - 1; j > found; j--) closing += `</${toks[stack[j]].tag}>`;
    stack.length = found;
    out[i] = closing + `</${t.tag}>`;
  });
  let tail = '';
  for (let j = stack.length - 1; j >= 0; j--) tail += `</${toks[stack[j]].tag}>`;

  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i) => out[Number(i)]);
  return s + tail;
}

/** 본문 문단 렌더 — 줄 단위 분리 후 각 문단 richText */
function paragraphs(text: unknown): string {
  if (text === null || text === undefined || text === '') return '';
  return String(text)
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => `<p>${richText(p)}</p>`)
    .join('');
}

/* ══════════════════════════════════════════════════════════════════
 * 사주 파일 추출 헬퍼 — sajuData 가 pillar 객체 / 기본값 둘 다 지원
 * ═════════════════════════════════════════════════════════════════ */
function pillarSlot(sajuData: any, idx: number): { gan: string; ji: string; ganRead: string; jiRead: string; ganOheng: string; jiOheng: string; available: boolean } {
  const p = sajuData?.pillars?.[idx] ?? {};
  return {
    gan: p.천간 ?? '',
    ji: p.지지 ?? '',
    ganRead: p.천간읽기 ?? '',
    jiRead: p.지지읽기 ?? '',
    ganOheng: p.천간오행 ?? '',
    jiOheng: p.지지오행 ?? '',
    available: p.available !== false,
  };
}

const OHENG_COLOR: Record<string, string> = {
  목: '#2D8A4E', 화: '#D32F2F', 토: '#F57F17', 금: '#757575', 수: '#1565C0',
};
const OHENG_HANJA: Record<string, string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};

/* ══════════════════════════════════════════════════════════════════
 * 섹션 콘텐츠 추출 — AI sections 배열에서 id 별 content 가져오기
 * ═════════════════════════════════════════════════════════════════ */
function getSection(aiResult: any, ids: string[]): string {
  const sections = aiResult?.sections ?? [];
  for (const id of ids) {
    const found = sections.find((s: any) => s?.id === id);
    if (found?.content) return String(found.content);
  }
  return '';
}

/* ══════════════════════════════════════════════════════════════════
 * 공통 조립 헬퍼
 * ═════════════════════════════════════════════════════════════════ */

/** 섹션 헤더 — SECTION NN + 타이틀 + 한자 + 힌트 */
function sectionHead(step: number, title: string, hanja: string, hint: string): string {
  return `
  <div class="section-head">
    <span class="section-step">SECTION ${String(step).padStart(2, '0')}</span>
    <h2 class="section-title">${esc(title)}</h2>
    <span class="section-hanja">${esc(hanja)}</span>
  </div>
  <div class="section-hint">${esc(hint)}</div>`;
}

/** 서브 블록 (제목 + 내용) */
function subBlock(title: string, innerHtml: string): string {
  if (!innerHtml) return '';
  return `<div class="sub-block"><div class="sub-title">${esc(title)}</div>${innerHtml}</div>`;
}

/**
 * 섹션 결론 다크박스 — 앱 .section-conclusion 진본 미러
 *  ① ② ③ 패턴은 raw 단계에서 줄 분리 (분리 후 각 줄 richText → 태그 밸런스 보장)
 */
function conclusionBox(raw: unknown, label = '이 섹션의 결론'): string {
  const s = plainKeepTags(raw);
  if (!s) return '';
  const rows = s.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/).map((r) => r.trim()).filter(Boolean);
  const body = rows
    .map((r) => {
      const m = r.match(/^([①②③④⑤⑥⑦⑧⑨⑩])\s*/);
      const rest = m ? r.slice(m[0].length) : r;
      const num = m ? `<span class="sc-num">${m[1]}</span>` : '';
      return `<p class="sc-row">${num}${richText(rest)}</p>`;
    })
    .join('');
  return `
  <div class="conclusion">
    <div class="sc-label">${esc(label)}</div>
    ${body}
  </div>`;
}

/** 태그는 유지한 채 문자열화만 (conclusionBox 전처리용) */
function plainKeepTags(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** 강도 1~5 도트 (이모지 X — CSS 원형) */
function strengthDots(n: unknown): string {
  const k = Math.max(0, Math.min(5, Number(n) || 0));
  let dots = '';
  for (let i = 1; i <= 5; i++) dots += `<i class="dt${i <= k ? ' on' : ''}"></i>`;
  return `<span class="dots">${dots}</span>`;
}

/* ══════════════════════════════════════════════════════════════════
 * 메인 빌더
 * ═════════════════════════════════════════════════════════════════ */
export function buildPremiumPdfHtml(input: PdfTemplateInput): string {
  const { profile, sajuData, aiResult, issuedAt, issueId } = input;
  const now = kstNow(); // ⚠ 서버 UTC 함정 — 연운 간지·현재 대운 판정은 KST 기준

  const year = pillarSlot(sajuData, 0);
  const month = pillarSlot(sajuData, 1);
  const day = pillarSlot(sajuData, 2);
  const time = pillarSlot(sajuData, 3);

  const ilgan = day.gan;
  const ilganRead = day.ganRead;
  const ilganOheng = day.ganOheng;

  const analysisBase = aiResult?.analysisBase ?? {};
  // 문자열 가드 — 비정상 shape(객체/배열/숫자)이 [object Object] 등으로 새는 것 방지 (lifeKeyword/lifestyleAdvice 형제 필드와 동일 정책)
  const asStr = (v: unknown): string => (typeof v === 'string' ? v : '');
  const gyeokguk = asStr(analysisBase.격국);
  const gangyak = asStr(analysisBase.일간강약);
  const yongsin = asStr(analysisBase.용신);
  const yongsinReason = asStr(analysisBase.용신근거);
  const huisin = asStr(analysisBase.희신);
  const gisin = asStr(analysisBase.기신);

  const elements = sajuData?.elements ?? {};
  const totalEl = Math.max(
    1,
    Object.values(elements).reduce((a: number, v) => a + (typeof v === 'number' ? v : 0), 0) as number,
  );

  // ── 섹션 본문 (claudePremium 7 sections · 구버전 id 호환 fallback 포함) ──
  const secSummary = getSection(aiResult, ['summary']) || (typeof aiResult?.summary === 'string' ? aiResult.summary : '');
  const secStructure = getSection(aiResult, ['structure']);
  const secSipsung = getSection(aiResult, ['sipsung']);
  const secYongsin = getSection(aiResult, ['yongsin']);
  const secDaeun = getSection(aiResult, ['daeun']);
  const secYearly = getSection(aiResult, ['yearly', `year${now.year}`, 'year2026', 'year2025']);
  const secPractice = getSection(aiResult, ['practice']);

  // ── 결론 다크박스 (sectionConclusions — 객체/배열 양쪽 호환, 앱 인덱스 매핑 동일) ──
  const sc = aiResult?.sectionConclusions;
  const conclusion = (key: string, idx: number): string => {
    if (sc && typeof sc === 'object' && !Array.isArray(sc)) return typeof sc[key] === 'string' ? sc[key] : '';
    if (Array.isArray(sc)) return typeof sc[idx] === 'string' ? sc[idx] : '';
    return '';
  };

  // ── 발급 일자 (KST 표기) — 잘못된 issuedAt 이면 'NaN년…' 대신 빈 문자열 (방어) ──
  const issuedMs = new Date(issuedAt).getTime();
  const issuedFmt = Number.isNaN(issuedMs)
    ? ''
    : (() => {
        const k = new Date(issuedMs + 9 * 3600e3);
        return `${k.getUTCFullYear()}년 ${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
      })();

  // ── 올해 간지 (연운 힌트 — 앱 §06 hint 진본과 동일 산식) ──
  const SIXTY = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未', '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑', '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];
  const HANJA_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계', 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
  const yearGz = SIXTY[(now.year - 1984 + 6000) % 60];
  const yearGzKo = (HANJA_KO[yearGz[0]] || '') + (HANJA_KO[yearGz[1]] || '');

  // ═════════════ 표지 조각 ═════════════
  const pillars = [
    { label: '時 시주', slot: time },
    { label: '日 일주', slot: day },
    { label: '月 월주', slot: month },
    { label: '年 년주', slot: year },
  ];
  const pillarCardsHtml = pillars.map((p) => {
    if (!p.slot.available) {
      return `
        <div class="pillar-card pillar-empty">
          <div class="pillar-label">${esc(p.label)}</div>
          <div class="pillar-stem">—</div>
          <div class="pillar-branch">—</div>
          <div class="pillar-empty-msg">시간 미입력</div>
        </div>`;
    }
    const ganColor = OHENG_COLOR[p.slot.ganOheng] || '#1A1A1A';
    const jiColor = OHENG_COLOR[p.slot.jiOheng] || '#1A1A1A';
    return `
      <div class="pillar-card">
        <div class="pillar-label">${esc(p.label)}</div>
        <div class="pillar-stem" style="color:${ganColor}">${esc(p.slot.gan)}</div>
        <div class="pillar-stem-read">${esc(p.slot.ganRead)}</div>
        <div class="pillar-branch" style="color:${jiColor}">${esc(p.slot.ji)}</div>
        <div class="pillar-branch-read">${esc(p.slot.jiRead)}</div>
        <div class="pillar-oheng">${esc(p.slot.ganOheng)}, ${esc(p.slot.jiOheng)}</div>
      </div>`;
  }).join('');

  const ohengBars = ['목', '화', '토', '금', '수'].map((k) => {
    const count = Number(elements[k] ?? 0);
    const pct = Math.round((count / totalEl) * 100);
    const color = OHENG_COLOR[k] || '#999';
    return `
      <div class="oheng-row">
        <div class="oheng-name">${esc(OHENG_HANJA[k])} ${esc(k)} <span class="oheng-count">${count}</span></div>
        <div class="oheng-track">
          <div class="oheng-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }).join('');

  /* ═════════════ §02 조각 — pillarMessages + lifeEdge ═════════════ */
  const pm = aiResult?.pillarMessages ?? {};
  const pmRows = [
    { key: 'year', label: '年 년주', sub: '초년, 뿌리' },
    { key: 'month', label: '月 월주', sub: '청년, 사회' },
    { key: 'day', label: '日 일주', sub: '나, 배우자' },
    { key: 'hour', label: '時 시주', sub: '말년, 자녀' },
  ].filter((r) => typeof pm[r.key] === 'string' && pm[r.key].trim());
  const pillarMessagesHtml = pmRows.length > 0
    ? `<table class="pm-table"><tbody>${
        pmRows.map((r) => `
          <tr>
            <th>${esc(r.label)}<div class="pm-sub">${esc(r.sub)}</div></th>
            <td>${richText(pm[r.key])}</td>
          </tr>`).join('')
      }</tbody></table>`
    : '';

  const lifeEdge = aiResult?.lifeEdge ?? {};
  const lifeEdgeCards = ['목', '화', '토', '금', '수']
    .filter((k) => lifeEdge[k] && (lifeEdge[k].head || lifeEdge[k].save || lifeEdge[k].avoid))
    .map((k) => {
      const c = lifeEdge[k];
      const color = OHENG_COLOR[k] || '#999';
      const count = Number(elements[k] ?? 0);
      return `
      <div class="edge-card">
        <div class="edge-head">
          <span class="edge-el" style="color:${color};border-color:${color}">${esc(OHENG_HANJA[k])}</span>
          <span class="edge-name">${esc(k)} <span class="edge-count">${count}개</span></span>
        </div>
        ${c.head ? `<p class="edge-body">${richText(c.head)}</p>` : ''}
        ${c.save ? `<div class="edge-row save"><span class="edge-tag">살릴 것</span><span>${richText(c.save)}</span></div>` : ''}
        ${c.avoid ? `<div class="edge-row avoid"><span class="edge-tag">조심할 것</span><span>${richText(c.avoid)}</span></div>` : ''}
      </div>`;
    }).join('');

  /* ═════════════ §03 조각 — sipCluster 5 클러스터 ═════════════ */
  const CLUSTER_META: Array<{ key: string; hanja: string }> = [
    { key: '비겁', hanja: '比劫' },
    { key: '식상', hanja: '食傷' },
    { key: '재성', hanja: '財星' },
    { key: '관성', hanja: '官星' },
    { key: '인성', hanja: '印星' },
  ];
  const sipCluster = aiResult?.sipCluster ?? {};
  const sipClusterHtml = CLUSTER_META
    .filter((m) => sipCluster[m.key] && (sipCluster[m.key].head || (Array.isArray(sipCluster[m.key].cards) && sipCluster[m.key].cards.length)))
    .map((m) => {
      const c = sipCluster[m.key];
      const cards = Array.isArray(c.cards) ? c.cards : [];
      const cardsHtml = cards.map((card: any) => `
        <div class="sip-card">
          <div class="sip-card-head">
            <span class="sip-name">${txt(card.name)}</span>
            ${card.hanja ? `<span class="sip-hanja">${txt(card.hanja)}</span>` : ''}
            ${strengthDots(card.strength)}
          </div>
          ${card.from ? `<div class="sip-from">${txt(card.from)}</div>` : ''}
          ${card.desc ? `<p class="sip-desc">${richText(card.desc)}</p>` : ''}
        </div>`).join('');
      return `
      <div class="cluster-block">
        <div class="cluster-head"><span class="cluster-hanja">${esc(m.hanja)}</span> ${esc(m.key)}</div>
        ${c.head ? `<p class="cluster-body">${richText(c.head)}</p>` : ''}
        ${cardsHtml}
      </div>`;
    }).join('');

  /* ═════════════ §05 조각 — daeunPeriods 8 대운 점수 ═════════════ */
  const daeunPeriods = Array.isArray(aiResult?.daeunPeriods) ? aiResult.daeunPeriods : [];
  // 현재 대운 마커 — 세는나이 (lunar 대운나이 = 세는나이 · 연나이 비교 금지)
  const birthYear = profile.birthDate ? Number(String(profile.birthDate).slice(0, 4)) : NaN;
  const seneunAge = Number.isFinite(birthYear) ? now.year - birthYear + 1 : NaN;
  const daeunHtml = daeunPeriods.length > 0
    ? `<table class="daeun-table"><thead><tr><th>시기</th><th>흐름</th><th>풀이</th></tr></thead><tbody>${
        daeunPeriods.map((d: any) => {
          const score = Math.max(0, Math.min(100, Number(d.score) || 0));
          let isNow = false;
          const m = String(d.age ?? '').match(/(\d+)\s*[~∼-]\s*(\d+)/);
          if (m && Number.isFinite(seneunAge)) {
            isNow = seneunAge >= Number(m[1]) && seneunAge <= Number(m[2]);
          }
          return `
          <tr${isNow ? ' class="now"' : ''}>
            <td class="da-age">${txt(d.age)}${isNow ? '<span class="da-now">지금</span>' : ''}</td>
            <td class="da-score">
              <div class="da-track"><div class="da-fill" style="width:${score}%"></div></div>
              <span class="da-num">${score}</span>
            </td>
            <td>${richText(d.reason)}</td>
          </tr>`;
        }).join('')
      }</tbody></table>`
    : '';

  /* ═════════════ §06 조각 — monthlyInsight 12 그리드 + monthlyWarnings ═════════════ */
  const LABEL_CLASS: Record<string, string> = { 상승: 'up', 정점: 'peak', 주의: 'warn', 평탄: 'flat', 지금: 'nowm' };
  const monthlyInsight = Array.isArray(aiResult?.monthlyInsight) ? aiResult.monthlyInsight : [];
  const monthlyHtml = monthlyInsight.length > 0
    ? `<div class="mi-grid">${
        monthlyInsight.map((mi: any, idx: number) => {
          const cls = LABEL_CLASS[String(mi.label ?? '').trim()] || 'flat';
          // month: 0/누락/범위밖(13 등) 방어 — 유효(1~12)면 그대로, 아니면 배열 인덱스+1 로 대체
          const rawM = Math.round(Number(mi.month));
          const m = Number.isFinite(rawM) && rawM >= 1 && rawM <= 12 ? rawM : idx + 1;
          return `
          <div class="mi-cell ${cls}">
            <div class="mi-top">
              <span class="mi-month">${m}월</span>
              ${mi.ganzi ? `<span class="mi-ganzi">${txt(mi.ganzi)}</span>` : ''}
              ${mi.label ? `<span class="mi-label">${txt(mi.label)}</span>` : ''}
            </div>
            ${mi.text ? `<div class="mi-text">${richText(mi.text)}</div>` : ''}
          </div>`;
        }).join('')
      }</div>`
    : '';

  const monthlyWarnings = Array.isArray(aiResult?.monthlyWarnings) ? aiResult.monthlyWarnings : [];
  const warningsHtml = monthlyWarnings
    .filter((w: any) => w && (w.title || w.desc))
    .map((w: any) => `
      <div class="warn-card">
        <div class="warn-head">${txt(w.month)} ${txt(w.title)}</div>
        ${w.desc ? `<p class="warn-body">${richText(w.desc)}</p>` : ''}
      </div>`).join('');

  /* ═════════════ §07 조각 — shinsalCards 3-tier ═════════════ */
  const shinsalCards = Array.isArray(aiResult?.shinsalCards) ? aiResult.shinsalCards : [];
  const tierOf = (c: any): string => {
    const t = String(c?.tier ?? '').trim();
    if (t === '강' || t === '중' || t === '참고') return t;
    const s = Number(c?.strength) || 0;
    return s >= 4 ? '강' : s >= 2 ? '중' : '참고';
  };
  const strongShinsal = shinsalCards.filter((c: any) => tierOf(c) === '강');
  const midShinsal = shinsalCards.filter((c: any) => tierOf(c) === '중');
  const refShinsal = shinsalCards.filter((c: any) => tierOf(c) === '참고');

  const strongShinsalHtml = strongShinsal.map((c: any) => `
    <div class="ss-card strong">
      <div class="ss-head">
        <span class="ss-tier t-strong">강</span>
        <span class="ss-name">${txt(c.kr)}</span>
        ${c.hanja ? `<span class="ss-hanja">${txt(c.hanja)}</span>` : ''}
        ${strengthDots(c.strength)}
      </div>
      ${c.from ? `<div class="ss-from">${txt(c.from)}</div>` : ''}
      ${c.desc ? `<p class="ss-desc">${richText(c.desc)}</p>` : ''}
      ${c.action ? `<div class="ss-action"><span class="ss-action-tag">이렇게</span>${richText(c.action)}</div>` : ''}
      ${c.when ? `<div class="ss-when">${txt(c.when)}</div>` : ''}
    </div>`).join('');

  const midShinsalHtml = midShinsal.map((c: any) => `
    <div class="ss-card mid">
      <div class="ss-head">
        <span class="ss-tier t-mid">중</span>
        <span class="ss-name">${txt(c.kr)}</span>
        ${c.hanja ? `<span class="ss-hanja">${txt(c.hanja)}</span>` : ''}
      </div>
      ${c.desc ? `<p class="ss-desc">${richText(c.desc)}</p>` : ''}
      ${c.when ? `<div class="ss-when">${txt(c.when)}</div>` : ''}
    </div>`).join('');

  const refShinsalHtml = refShinsal.length > 0
    ? `<div class="ss-ref-list">${
        refShinsal.map((c: any) => `
        <div class="ss-ref">
          <span class="ss-tier t-ref">참고</span>
          <span class="ss-name">${txt(c.kr)}</span>
          ${c.hanja ? `<span class="ss-hanja">${txt(c.hanja)}</span>` : ''}
          ${c.desc ? `<span class="ss-ref-desc">${txt(c.desc)}</span>` : ''}
          ${c.when ? `<span class="ss-when">${txt(c.when)}</span>` : ''}
        </div>`).join('')
      }</div>`
    : '';

  /* ═════════════ §08 조각 — 내 사주의 결 (lifeKeyword + strengths/cautions · 구 rel6Cards 호환) ═════════════ */
  const lifeKeyword = typeof aiResult?.lifeKeyword === 'string' ? aiResult.lifeKeyword : '';
  const strengths = Array.isArray(aiResult?.strengths) ? aiResult.strengths : [];
  const cautions = Array.isArray(aiResult?.cautions) ? aiResult.cautions : [];

  const lifeKeywordHtml = lifeKeyword
    ? `
    <div class="keyword-hero">
      <div class="kh-label">◇ ${esc(profile.name)} 님의 인생 한 줄</div>
      <p class="kh-text">${richText(lifeKeyword)}</p>
    </div>`
    : '';

  const scCards = (items: any[], kind: 'st' | 'ca') => items
    .filter((it: any) => it && (it.title || it.desc))
    .slice(0, 3)
    .map((it: any) => `
      <div class="sc-card ${kind}">
        <div class="sc-ttl">${txt(it.title)}</div>
        ${it.desc ? `<p class="sc-desc">${richText(it.desc)}</p>` : ''}
      </div>`).join('');
  const strengthsHtml = scCards(strengths, 'st');
  const cautionsHtml = scCards(cautions, 'ca');

  // 레거시 rel6Cards (2026-05-05 이전 저장본) — lifeKeyword 계열 없을 때만 fallback 렌더
  const rel6 = aiResult?.rel6Cards ?? {};
  const REL6_META: Array<{ key: string; label: string }> = [
    { key: 'parent', label: '부모' }, { key: 'sibling', label: '형제와 동기' }, { key: 'spouse', label: '배우자' },
    { key: 'child', label: '자녀' }, { key: 'friend', label: '친구' }, { key: 'boss', label: '윗사람' },
  ];
  const rel6Html = (!lifeKeyword && strengths.length === 0 && rel6 && typeof rel6 === 'object')
    ? REL6_META
        .filter((m) => rel6[m.key] && (rel6[m.key].summary || rel6[m.key].save || rel6[m.key].avoid))
        .map((m) => {
          const c = rel6[m.key];
          return `
          <div class="edge-card">
            <div class="edge-head"><span class="edge-name">${esc(m.label)}</span>${c.tag ? `<span class="edge-count">${txt(c.tag)}</span>` : ''}</div>
            ${c.summary ? `<p class="edge-body">${richText(c.summary)}</p>` : ''}
            ${c.save ? `<div class="edge-row save"><span class="edge-tag">살릴 것</span><span>${richText(c.save)}</span></div>` : ''}
            ${c.avoid ? `<div class="edge-row avoid"><span class="edge-tag">조심할 것</span><span>${richText(c.avoid)}</span></div>` : ''}
          </div>`;
        }).join('')
    : '';

  /* ═════════════ §09 조각 — topicMini 6 카드 + scores ═════════════ */
  const TOPIC_META: Array<{ key: string; label: string }> = [
    { key: 'wealth', label: '재물' }, { key: 'love', label: '사랑' }, { key: 'career', label: '직업' },
    { key: 'health', label: '건강' }, { key: 'social', label: '인간관계' }, { key: 'potential', label: '잠재력' },
  ];
  const topicMini = aiResult?.topicMini ?? {};
  const scores = aiResult?.scores ?? {};
  const topicItems = TOPIC_META
    .map((m) => {
      const ai = topicMini[m.key] ?? {};
      const desc = typeof ai.desc === 'string' && ai.desc.trim() ? ai.desc
        : typeof ai.line === 'string' && ai.line.trim() ? ai.line : '';
      const score = Math.max(0, Math.min(100, Number(scores[m.key]) || 0));
      return { ...m, desc, score };
    })
    .filter((t) => t.desc || t.score > 0);
  const topicScores = topicItems.map((t) => t.score).filter((s) => s > 0);
  const peakScore = topicScores.length ? Math.max(...topicScores) : 0;
  const lowScore = topicScores.length ? Math.min(...topicScores) : 0;
  const topicHtml = topicItems.length > 0
    ? `<div class="topic-grid">${
        topicItems.map((t) => {
          const isPeak = t.score === peakScore && peakScore >= 85;
          const isLow = !isPeak && t.score === lowScore && lowScore > 0 && lowScore <= 55;
          const cls = isPeak ? ' peak' : isLow ? ' low' : '';
          return `
          <div class="topic-cell${cls}">
            <div class="topic-head">
              <span class="topic-ttl">${esc(t.label)}${isPeak ? '<span class="topic-badge pk">최강</span>' : ''}${isLow ? '<span class="topic-badge lw">주의</span>' : ''}</span>
              ${t.score > 0 ? `<span class="topic-score">${t.score}</span>` : ''}
            </div>
            ${t.score > 0 ? `<div class="topic-track"><div class="topic-fill" style="width:${t.score}%"></div></div>` : ''}
            ${t.desc ? `<p class="topic-desc">${richText(t.desc)}</p>` : ''}
          </div>`;
        }).join('')
      }</div>`
    : '';

  /* ═════════════ §10 조각 — actionList ═════════════ */
  const actionList = Array.isArray(aiResult?.actionList) ? aiResult.actionList
    : Array.isArray(aiResult?.actions) ? aiResult.actions : [];
  const actionHtml = actionList
    .filter((a: any) => a && (a.ttl || a.title || a.desc))
    .map((a: any, i: number) => `
      <div class="action-item">
        <span class="action-num">${i + 1}</span>
        <div class="action-body">
          <div class="action-ttl">${txt(a.ttl || a.title)}</div>
          ${a.desc ? `<p class="action-desc">${richText(a.desc)}</p>` : ''}
        </div>
      </div>`).join('');

  /* ═════════════ §04 조각 — 용신 박스 + lifestyleAdvice ═════════════ */
  const yongsinBoxHtml = yongsin
    ? `
    <div class="yongsin-box">
      <div class="yb-label">用神 — 이 사주가 가장 반기는 기운</div>
      <div class="yb-main">
        <span class="yb-el" style="color:${OHENG_COLOR[String(yongsin).slice(0, 1)] || '#8C6D3D'}">${esc(String(yongsin))}</span>
        ${huisin ? `<span class="yb-sub">희신(喜神) ${esc(huisin)}</span>` : ''}
        ${gisin ? `<span class="yb-sub warn">기신(忌神) ${esc(gisin)}</span>` : ''}
      </div>
      ${yongsinReason ? `<p class="yb-reason">${richText(yongsinReason)}</p>` : ''}
    </div>`
    : '';
  const lifestyleAdvice = typeof aiResult?.lifestyleAdvice === 'string' ? aiResult.lifestyleAdvice : '';

  // ── 디스클레이머 (DailyFortune/Dream/PremiumResult 통일 패턴) ──
  const disclaimer = `
    <p class="disclaimer-source">
      한국 명리학 6대 원전(연해자평, 자평진전, 적천수, 궁통보감, 명리약언, 삼명통회) 기반
    </p>
    <p class="disclaimer-body">
      사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.<br/>
      의료, 법률, 재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
    </p>`;

  // ═════════════ 섹션 블록 조립 (내용 있는 섹션만 — 빈 섹션 0 정책) ═════════════
  const sections: string[] = [];

  // §01 원국
  sections.push(`
<div class="section">
  ${sectionHead(1, '원국', '原局', '태어난 순간 하늘과 땅이 그려낸 여덟 글자')}
  ${subBlock('사주 4기둥', `<div class="cover-pillars" style="margin-top:0">${pillarCardsHtml}</div>`)}
  ${subBlock('오행 분포 (五行 分布)', ohengBars)}
  ${secSummary ? subBlock('종합 진단', `<div class="body-text">${paragraphs(secSummary)}</div>`) : ''}
  ${conclusionBox(conclusion('wongug', 0))}
</div>`);

  // §02 천간지지
  if (secStructure || pillarMessagesHtml || lifeEdgeCards) {
    sections.push(`
<div class="section">
  ${sectionHead(2, '천간지지', '天干地支', '위로 드러난 마음과 아래에 깔린 본능')}
  ${secStructure ? `<div class="body-text">${paragraphs(secStructure)}</div>` : ''}
  ${subBlock('4기둥이 각각 말하는 것', pillarMessagesHtml)}
  ${lifeEdgeCards ? subBlock('오행별 인생의 결 — 나에게 뭐가 있고 뭐가 비는가', lifeEdgeCards) : ''}
  ${conclusionBox(conclusion('structure', 1))}
</div>`);
  }

  // §03 십성
  if (secSipsung || sipClusterHtml) {
    sections.push(`
<div class="section">
  ${sectionHead(3, '십성', '十神', '관계와 욕망을 그리는 열 개의 키')}
  ${sipClusterHtml ? subBlock('다섯 무리 — 비겁, 식상, 재성, 관성, 인성', sipClusterHtml) : ''}
  ${secSipsung ? `<div class="body-text">${paragraphs(secSipsung)}</div>` : ''}
  ${conclusionBox(conclusion('sipsung', 2))}
</div>`);
  }

  // §04 용신·조후
  if (yongsinBoxHtml || secYongsin || lifestyleAdvice) {
    sections.push(`
<div class="section">
  ${sectionHead(4, '용신과 조후', '用神 調候', '사주가 가장 갈증을 느끼는 것 — 색, 방위, 계절, 물건, 습관까지')}
  ${yongsinBoxHtml}
  ${gyeokguk || gangyak ? `<div class="base-row-line">${gyeokguk ? `격국(格局) <b>${txt(gyeokguk)}</b>` : ''}${gyeokguk && gangyak ? ', ' : ''}${gangyak ? `일간 강약 <b>${txt(gangyak)}</b>` : ''}</div>` : ''}
  ${secYongsin ? `<div class="body-text">${paragraphs(secYongsin)}</div>` : ''}
  ${lifestyleAdvice ? subBlock('일상 처방 — 용신 기반 라이프스타일', `<div class="body-text">${paragraphs(lifestyleAdvice)}</div>`) : ''}
  ${conclusionBox(conclusion('yongsin', 3))}
</div>`);
  }

  // §05 대운
  if (secDaeun || daeunHtml) {
    sections.push(`
<div class="section">
  ${sectionHead(5, '대운', '大運', '10년 단위로 흐르는 인생의 큰 강줄기')}
  ${daeunHtml ? subBlock('평생 대운 흐름', daeunHtml) : ''}
  ${secDaeun ? `<div class="body-text">${paragraphs(secDaeun)}</div>` : ''}
  ${conclusionBox(conclusion('daeun', 4))}
</div>`);
  }

  // §06 연운
  if (secYearly || monthlyHtml || warningsHtml) {
    sections.push(`
<div class="section">
  ${sectionHead(6, '연운', '年運', `${now.year}년 ${yearGzKo}(${yearGz}) 해 — 올해의 흐름`)}
  ${secYearly ? `<div class="body-text">${paragraphs(secYearly)}</div>` : ''}
  ${monthlyHtml ? subBlock('12개월 흐름', monthlyHtml) : ''}
  ${warningsHtml ? subBlock('시기별 주의', warningsHtml) : ''}
  ${conclusionBox(conclusion('yearly', 5))}
</div>`);
  }

  // §07 신살
  if (shinsalCards.length > 0) {
    sections.push(`
<div class="section">
  ${sectionHead(7, '신살', '神殺', `사주에 자리한 길신과 흉살 — ${shinsalCards.length}개 (강 ${strongShinsal.length}, 중 ${midShinsal.length}, 참고 ${refShinsal.length})`)}
  ${strongShinsalHtml}
  ${midShinsalHtml}
  ${refShinsalHtml ? subBlock('참고 — 명목상 자리만 잡은 신살', refShinsalHtml) : ''}
  ${conclusionBox(conclusion('shinsal', 6))}
</div>`);
  }

  // §08 내 사주의 결 (本質) — lifeKeyword/strengths/cautions · 레거시 rel6Cards 호환
  if (lifeKeywordHtml || strengthsHtml || cautionsHtml || rel6Html) {
    sections.push(`
<div class="section">
  ${sectionHead(8, '내 사주의 결', '本質', '사주 8글자가 빚는 통합 한 줄 + 진짜 강점 3, 함정 3')}
  ${lifeKeywordHtml}
  ${strengthsHtml ? subBlock('진짜 강점 3', strengthsHtml) : ''}
  ${cautionsHtml ? subBlock('의식할 함정 3', cautionsHtml) : ''}
  ${rel6Html ? subBlock('여섯 관계의 결', rel6Html) : ''}
  ${conclusionBox(conclusion('relation', 7))}
</div>`);
  }

  // §09 여섯 영역 한눈에 (主題)
  if (topicHtml) {
    sections.push(`
<div class="section">
  ${sectionHead(9, '여섯 영역 한눈에', '主題', '재물, 사랑, 직업, 건강, 인간관계, 잠재력 — 강과 약 점수')}
  ${topicHtml}
  ${conclusionBox(conclusion('topic', 8))}
</div>`);
  }

  // §10 실천 (實踐)
  if (secPractice || actionHtml) {
    sections.push(`
<div class="section">
  ${sectionHead(10, '실천', '實踐', '사주를 안 다음, 오늘부터 바꾸어볼 것들')}
  ${secPractice ? `<div class="body-text">${paragraphs(secPractice)}</div>` : ''}
  ${actionHtml ? subBlock('오늘부터의 실천', actionHtml) : ''}
  ${conclusionBox(conclusion('practice', 9), '이 섹션의 결론 — 평생 가져갈 한 줄')}
</div>`);
  }

  // ─────────────────── HTML ───────────────────
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>사주500 프리미엄 — ${esc(profile.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700;900&family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  /* ══════ A4 인쇄 기본 ══════ */
  @page {
    size: A4;
    margin: 15mm 15mm 18mm 15mm;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    color: #1A1A1A;
    font-family: 'Noto Sans KR', system-ui, -apple-system, sans-serif;
    font-size: 10.5pt;
    line-height: 1.7;
    word-break: keep-all;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4 { font-family: 'Noto Serif KR', serif; font-weight: 600; color: #1A1A1A; margin: 0; }
  p { margin: 0 0 0.6em; }

  /* ══════ 강조 3-tier (앱 SSOT 미러 — _premiumMockupStyle.ts) ══════ */
  .body-text strong, .edge-card strong, .sip-card strong, .ss-card strong, .warn-card strong,
  .topic-cell strong, .action-item strong, .keyword-hero strong, .sc-card strong,
  .mi-cell strong, .pm-table strong, .daeun-table strong, .yongsin-box strong, .cluster-block strong {
    font-weight: 800;
    color: #A37A2E;
    /* 앱 SSOT(_premiumMockupStyle.ts) 와 동일 — #F4D166 형광펜 @0.55 (구 #B8965A@0.32 → 톤 일치) */
    background: linear-gradient(180deg, transparent 60%, rgba(244,209,102,0.55) 60%);
    padding: 0 2px;
    border-radius: 1px;
  }
  .body-text b, .edge-card b, .sip-card b, .ss-card b, .warn-card b,
  .topic-cell b, .action-item b, .keyword-hero b, .sc-card b,
  .mi-cell b, .pm-table b, .daeun-table b, .yongsin-box b, .cluster-block b, .base-row-line b {
    font-weight: 800;
    color: #1A1A1A;
    background: none;
    padding: 0;
  }
  u {
    text-decoration: underline;
    text-decoration-color: #B8965A;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
    color: inherit;
  }
  em {
    font-style: normal;
    font-weight: 700;
    color: #B5441F;
    background: linear-gradient(180deg, transparent 56%, rgba(181,68,31,0.15) 56%);
    padding: 0 2px;
    border-radius: 2px;
  }

  /* ══════ 표지 (A4 1장 안에 반드시 수납 — 오버플로 시 분석 기반 박스가 2페이지로 찢어짐) ══════ */
  .cover {
    page-break-after: always;
    padding: 14mm 0 0;
    text-align: center;
  }
  .cover-logo {
    font-family: 'Noto Serif KR', serif;
    font-weight: 700;
    font-size: 14pt;
    color: #B8965A;
    letter-spacing: 0.3em;
    margin-bottom: 6mm;
  }
  .cover-title {
    font-family: 'Noto Serif KR', serif;
    font-size: 28pt;
    font-weight: 700;
    color: #1A1A1A;
    margin-bottom: 4mm;
  }
  .cover-sub {
    font-size: 11pt;
    color: #7A7269;
    margin-bottom: 10mm;
  }
  .cover-name-block {
    border-top: 1px solid #E5DFD0;
    border-bottom: 1px solid #E5DFD0;
    padding: 5mm 0;
    margin: 0 30mm 8mm;
  }
  .cover-name {
    font-family: 'Noto Serif KR', serif;
    font-size: 18pt;
    font-weight: 600;
    color: #1A1A1A;
    margin-bottom: 2mm;
  }
  .cover-birth {
    font-size: 10.5pt;
    color: #3D3D3D;
  }
  .cover-pillars {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4mm;
    margin: 6mm 0;
  }
  .pillar-card {
    border: 1px solid #E5DFD0;
    border-radius: 8px;
    padding: 5mm 2mm;
    background: #F8F5EE;
    text-align: center;
    page-break-inside: avoid;
  }
  .pillar-empty { background: #FAFAFA; border-style: dashed; }
  .pillar-label { font-size: 8pt; color: #7A7269; margin-bottom: 2.5mm; letter-spacing: 0.05em; }
  .pillar-stem { font-family: 'Noto Serif KR', serif; font-size: 21pt; font-weight: 700; line-height: 1.1; }
  .pillar-stem-read { font-size: 8.5pt; color: #7A7269; margin-bottom: 2.5mm; }
  .pillar-branch { font-family: 'Noto Serif KR', serif; font-size: 21pt; font-weight: 700; line-height: 1.1; }
  .pillar-branch-read { font-size: 8.5pt; color: #7A7269; margin-bottom: 2mm; }
  .pillar-oheng { font-size: 8pt; color: #B8965A; font-weight: 600; }
  .pillar-empty-msg { font-size: 7.5pt; color: #999; margin-top: 4mm; }

  .cover-base {
    margin: 6mm 15mm 4mm;
    padding: 5mm 7mm;
    background: rgba(184,150,90,0.06);
    border: 1px solid rgba(184,150,90,0.3);
    border-radius: 6px;
    text-align: left;
    page-break-inside: avoid;
  }
  .cover-base-title {
    font-family: 'Noto Serif KR', serif;
    font-size: 11pt;
    font-weight: 700;
    color: #8C6D3D;
    margin-bottom: 3mm;
  }
  .cover-base-row { font-size: 10pt; color: #1A1A1A; margin: 1.5mm 0; }
  .cover-base-row .k { color: #8C6D3D; font-weight: 700; display: inline-block; min-width: 24mm; }

  .cover-issued {
    margin-top: 8mm;
    font-size: 9pt;
    color: #999;
    letter-spacing: 0.05em;
  }

  /* ══════ 섹션 공통 ══════ */
  .section { page-break-before: always; }
  .section-head {
    display: flex;
    align-items: baseline;
    gap: 4mm;
    border-bottom: 1px solid #E5DFD0;
    padding-bottom: 3mm;
    margin-bottom: 3mm;
  }
  .section-step {
    font-family: 'Noto Serif KR', serif;
    font-weight: 700;
    font-size: 10pt;
    color: #B8965A;
    letter-spacing: 0.15em;
  }
  .section-title {
    font-family: 'Noto Serif KR', serif;
    font-size: 17pt;
    font-weight: 700;
    color: #1A1A1A;
  }
  .section-hanja {
    font-family: 'Noto Serif KR', serif;
    font-size: 12pt;
    color: #8C6D3D;
    margin-left: 1mm;
  }
  .section-hint {
    font-size: 9.5pt;
    color: #7A7269;
    margin-bottom: 5mm;
    font-style: italic;
  }
  .body-text p {
    text-align: justify;
    color: #1A1A1A;
    line-height: 1.85;
    margin-bottom: 0.8em;
  }
  .sub-block { margin: 5mm 0; }
  .sub-title {
    font-family: 'Noto Serif KR', serif;
    font-size: 12pt;
    font-weight: 600;
    color: #8C6D3D;
    margin-bottom: 3mm;
    padding-bottom: 1mm;
    border-bottom: 1px dotted #E5DFD0;
  }
  .base-row-line { font-size: 10pt; color: #3D3D3D; margin: 2mm 0 4mm; }

  /* ══════ 결론 다크박스 (앱 .section-conclusion 진본 미러) ══════ */
  .conclusion {
    margin-top: 6mm;
    padding: 6mm 7mm;
    background: linear-gradient(135deg, #161310 0%, #2a2520 55%, #1d1812 100%);
    border-radius: 12px;
    border: 1.5px solid rgba(212,175,55,0.32);
    color: #F4ECD8;
    page-break-inside: avoid;
  }
  .conclusion .sc-label {
    font-size: 8.5pt;
    color: #f4d166;
    font-weight: 800;
    letter-spacing: 0.12em;
    margin-bottom: 3mm;
    padding-bottom: 2mm;
    border-bottom: 1px solid rgba(244,209,102,0.32);
  }
  .conclusion .sc-label::before { content: '◇  '; opacity: 0.7; }
  .conclusion .sc-row {
    color: #F4ECD8;
    font-size: 10pt;
    line-height: 1.85;
    margin: 0 0 2.5mm;
  }
  .conclusion .sc-row:last-child { margin-bottom: 0; }
  .conclusion .sc-num {
    display: inline-block;
    color: #f4d166;
    font-family: 'Noto Serif KR', serif;
    font-weight: 800;
    margin-right: 2mm;
  }
  .conclusion strong {
    color: #f4d166 !important;
    background: linear-gradient(180deg, transparent 65%, rgba(244,209,102,0.18) 65%) !important;
    font-weight: 800;
    padding: 0 2px;
    border-radius: 2px;
  }
  .conclusion b { color: #FFFDF5 !important; font-weight: 800; }
  .conclusion u { text-decoration-color: #f4d166; }
  .conclusion em { color: #E8D9B8; background: none; font-weight: 500; }

  /* ══════ 오행 막대 ══════ */
  .oheng-row { display: flex; align-items: center; gap: 4mm; margin: 2mm 0; }
  .oheng-name { font-family: 'Noto Serif KR', serif; font-size: 10.5pt; font-weight: 600; width: 22mm; }
  .oheng-count { font-size: 9pt; color: #7A7269; font-weight: 400; margin-left: 1mm; }
  .oheng-track { flex: 1; height: 5mm; background: #F0ECE1; border-radius: 3px; overflow: hidden; }
  .oheng-fill { height: 100%; }

  /* ══════ 표 공통 ══════ */
  table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 10pt; }
  th, td { text-align: left; padding: 2.5mm 3mm; border-bottom: 1px solid #E5DFD0; vertical-align: top; }
  th { background: #F8F5EE; color: #8C6D3D; font-weight: 700; font-size: 9.5pt; }

  /* pillarMessages */
  .pm-table th { width: 26mm; }
  .pm-table .pm-sub { font-size: 8pt; color: #A99C86; font-weight: 400; }
  .pm-table tr { page-break-inside: avoid; }

  /* ══════ lifeEdge / rel6 카드 ══════ */
  .edge-card {
    border: 1px solid #E5DFD0;
    border-radius: 10px;
    padding: 4mm 5mm;
    margin: 0 0 3mm;
    background: #FFFFFF;
    page-break-inside: avoid;
  }
  .edge-head { display: flex; align-items: center; gap: 2.5mm; margin-bottom: 2mm; }
  .edge-el {
    font-family: 'Noto Serif KR', serif;
    font-weight: 900;
    font-size: 12pt;
    border: 1.5px solid;
    border-radius: 6px;
    width: 8mm; height: 8mm;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .edge-name { font-family: 'Noto Serif KR', serif; font-weight: 700; font-size: 11pt; }
  .edge-count { font-size: 9pt; color: #7A7269; }
  .edge-body { font-size: 9.5pt; line-height: 1.8; margin: 0 0 2mm; text-align: justify; }
  .edge-row { display: flex; gap: 2.5mm; font-size: 9.5pt; line-height: 1.7; margin-top: 1.5mm; }
  .edge-tag {
    flex: 0 0 auto;
    font-size: 8pt; font-weight: 800;
    padding: 0.5mm 2mm; border-radius: 4px;
    align-self: flex-start; margin-top: 0.6mm;
    white-space: nowrap;
  }
  .edge-row.save .edge-tag { color: #1b5e20; background: rgba(46,125,50,0.10); }
  .edge-row.avoid .edge-tag { color: #8b1a1a; background: rgba(198,40,40,0.10); }

  /* ══════ 십성 클러스터 ══════ */
  .cluster-block { margin: 0 0 4mm; }
  .cluster-head {
    font-family: 'Noto Serif KR', serif;
    font-size: 11.5pt; font-weight: 700;
    color: #1A1A1A;
    margin-bottom: 1.5mm;
  }
  .cluster-hanja { color: #B8965A; margin-right: 1mm; }
  .cluster-body { font-size: 9.5pt; line-height: 1.8; margin: 0 0 2mm; text-align: justify; }
  .sip-card {
    border: 1px solid #E5DFD0;
    border-left: 3px solid #B8965A;
    border-radius: 8px;
    padding: 3mm 4mm;
    margin: 0 0 2.5mm;
    background: #FDFCF8;
    page-break-inside: avoid;
  }
  .sip-card-head { display: flex; align-items: center; gap: 2mm; margin-bottom: 1mm; }
  .sip-name { font-weight: 800; font-size: 10pt; }
  .sip-hanja { font-family: 'Noto Serif KR', serif; color: #B8965A; font-size: 9.5pt; }
  .sip-from { font-size: 8.5pt; color: #8C6D3D; margin-bottom: 1mm; }
  .sip-desc { font-size: 9.5pt; line-height: 1.75; margin: 0; text-align: justify; }

  /* 강도 도트 */
  .dots { display: inline-flex; gap: 1mm; margin-left: auto; }
  .dt { width: 2.2mm; height: 2.2mm; border-radius: 50%; background: #E5DFD0; display: inline-block; }
  .dt.on { background: #B8965A; }

  /* ══════ 용신 박스 ══════ */
  .yongsin-box {
    background: rgba(184,150,90,0.06);
    border: 1.5px solid rgba(184,150,90,0.4);
    border-radius: 10px;
    padding: 5mm 6mm;
    margin: 2mm 0 4mm;
    page-break-inside: avoid;
  }
  .yb-label { font-size: 9pt; font-weight: 800; color: #8C6D3D; letter-spacing: 0.08em; margin-bottom: 2mm; }
  .yb-main { display: flex; align-items: baseline; gap: 4mm; margin-bottom: 2mm; }
  .yb-el { font-family: 'Noto Serif KR', serif; font-size: 20pt; font-weight: 900; }
  .yb-sub { font-size: 9.5pt; color: #3D3D3D; }
  .yb-sub.warn { color: #8b1a1a; }
  .yb-reason { font-size: 9.5pt; line-height: 1.75; margin: 0; }

  /* ══════ 대운 표 ══════ */
  .daeun-table td { font-size: 9.5pt; }
  .daeun-table tr { page-break-inside: avoid; }
  .daeun-table tr.now td { background: rgba(184,150,90,0.08); }
  .da-age { white-space: nowrap; font-weight: 700; width: 22mm; }
  .da-now {
    display: inline-block; margin-left: 1.5mm;
    font-size: 7.5pt; font-weight: 800; color: #fff;
    background: #B8965A; border-radius: 4px; padding: 0 1.5mm;
    vertical-align: middle;
  }
  .da-score { width: 34mm; }
  .da-track { display: inline-block; width: 22mm; height: 3mm; background: #F0ECE1; border-radius: 2px; overflow: hidden; vertical-align: middle; }
  .da-fill { height: 100%; background: linear-gradient(90deg, #E8D9B8, #B8965A); }
  .da-num { font-size: 9pt; font-weight: 700; color: #8C6D3D; margin-left: 1.5mm; }

  /* ══════ 12개월 그리드 ══════ */
  .mi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; }
  .mi-cell {
    border: 1px solid #E5DFD0;
    border-radius: 8px;
    padding: 2.5mm 3mm;
    page-break-inside: avoid;
  }
  .mi-top { display: flex; align-items: baseline; gap: 1.5mm; margin-bottom: 1mm; }
  .mi-month { font-family: 'Noto Serif KR', serif; font-weight: 800; font-size: 10.5pt; }
  .mi-ganzi { font-family: 'Noto Serif KR', serif; font-size: 8.5pt; color: #8C6D3D; }
  .mi-label {
    margin-left: auto;
    font-size: 7.5pt; font-weight: 800;
    padding: 0.3mm 1.8mm; border-radius: 4px;
    background: #F0ECE1; color: #7A7269;
  }
  .mi-cell.peak .mi-label { background: rgba(46,125,50,0.12); color: #1b5e20; }
  .mi-cell.up .mi-label { background: rgba(46,125,50,0.08); color: #2e7d32; }
  .mi-cell.warn .mi-label { background: rgba(198,40,40,0.10); color: #c62828; }
  .mi-cell.nowm .mi-label { background: rgba(184,150,90,0.18); color: #8C6D3D; }
  .mi-cell.peak { border-color: rgba(46,125,50,0.45); }
  .mi-cell.warn { border-color: rgba(198,40,40,0.40); }
  .mi-cell.nowm { border-color: rgba(184,150,90,0.55); background: rgba(184,150,90,0.05); }
  .mi-text { font-size: 8.5pt; line-height: 1.6; color: #3D3D3D; }

  /* ══════ 시기별 경고 카드 ══════ */
  .warn-card {
    border: 1px solid rgba(198,40,40,0.35);
    border-left: 3px solid #c62828;
    border-radius: 8px;
    padding: 3mm 4mm;
    margin: 0 0 2.5mm;
    background: rgba(198,40,40,0.03);
    page-break-inside: avoid;
  }
  .warn-head { font-weight: 800; font-size: 10pt; color: #8b1a1a; margin-bottom: 1mm; }
  .warn-body { font-size: 9.5pt; line-height: 1.7; margin: 0; }

  /* ══════ 신살 3-tier ══════ */
  .ss-card {
    border: 1px solid #E5DFD0;
    border-radius: 10px;
    padding: 4mm 5mm;
    margin: 0 0 3mm;
    page-break-inside: avoid;
  }
  .ss-card.strong { border: 1.5px solid rgba(184,150,90,0.55); background: #FDFBF4; }
  .ss-card.mid { background: #FFFFFF; }
  .ss-head { display: flex; align-items: center; gap: 2.5mm; margin-bottom: 1.5mm; }
  .ss-tier {
    font-size: 8pt; font-weight: 800;
    padding: 0.5mm 2mm; border-radius: 4px;
    white-space: nowrap;
  }
  .ss-tier.t-strong { background: #B8965A; color: #fff; }
  .ss-tier.t-mid { background: rgba(184,150,90,0.15); color: #8C6D3D; }
  .ss-tier.t-ref { background: #F0ECE1; color: #7A7269; }
  .ss-name { font-family: 'Noto Serif KR', serif; font-weight: 800; font-size: 11pt; }
  .ss-hanja { font-family: 'Noto Serif KR', serif; color: #B8965A; font-size: 9.5pt; }
  .ss-from { font-size: 8.5pt; color: #8C6D3D; margin-bottom: 1.5mm; }
  .ss-desc { font-size: 9.5pt; line-height: 1.8; margin: 0 0 1.5mm; text-align: justify; }
  .ss-action { font-size: 9.5pt; line-height: 1.7; margin: 1mm 0; }
  .ss-action-tag {
    font-size: 8pt; font-weight: 800; color: #1b5e20;
    background: rgba(46,125,50,0.10);
    padding: 0.5mm 2mm; border-radius: 4px; margin-right: 2mm;
  }
  .ss-when { font-size: 8.5pt; color: #7A7269; }
  .ss-ref-list { display: block; }
  .ss-ref {
    display: flex; align-items: baseline; gap: 2mm; flex-wrap: wrap;
    font-size: 9.5pt;
    padding: 1.5mm 0;
    border-bottom: 1px dotted #E5DFD0;
  }
  .ss-ref .ss-name { font-size: 9.5pt; }
  .ss-ref-desc { color: #3D3D3D; }
  .ss-ref .ss-when { margin-left: auto; }

  /* ══════ §08 키워드 히어로 + 강점/함정 ══════ */
  .keyword-hero {
    background: linear-gradient(135deg, #FFFEF8 0%, #FBF5E8 100%);
    border: 1.5px solid rgba(184,150,90,0.40);
    border-radius: 12px;
    padding: 6mm 7mm;
    margin: 2mm 0 5mm;
    page-break-inside: avoid;
  }
  .kh-label {
    font-family: 'Noto Serif KR', serif;
    font-size: 9pt; font-weight: 700; color: #8C6D3D;
    letter-spacing: 0.08em; margin-bottom: 2mm;
  }
  .kh-text {
    font-family: 'Noto Serif KR', serif;
    font-size: 13pt; font-weight: 700; color: #1A1A1A;
    line-height: 1.6; margin: 0;
  }
  .sc-card {
    border: 1px solid #E5DFD0;
    border-radius: 10px;
    padding: 3.5mm 4.5mm;
    margin: 0 0 2.5mm;
    page-break-inside: avoid;
  }
  .sc-card.st { border-left: 3px solid #2e7d32; }
  .sc-card.ca { border-left: 3px solid #c62828; }
  .sc-card .sc-ttl { font-weight: 800; font-size: 10.5pt; margin-bottom: 1mm; }
  .sc-card.st .sc-ttl { color: #1b5e20; }
  .sc-card.ca .sc-ttl { color: #8b1a1a; }
  .sc-card .sc-desc { font-size: 9.5pt; line-height: 1.75; margin: 0; text-align: justify; }

  /* ══════ §09 여섯 영역 ══════ */
  .topic-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; }
  .topic-cell {
    border: 1px solid #E5DFD0;
    border-radius: 10px;
    padding: 3.5mm 4.5mm;
    page-break-inside: avoid;
  }
  .topic-cell.peak { border: 2px solid #2e7d32; }
  .topic-cell.low { border: 2px solid #c62828; }
  .topic-head { display: flex; align-items: baseline; margin-bottom: 1.5mm; }
  .topic-ttl { font-family: 'Noto Serif KR', serif; font-weight: 800; font-size: 11pt; }
  .topic-badge {
    margin-left: 2mm; font-size: 7.5pt; font-weight: 800;
    padding: 0.3mm 1.8mm; border-radius: 4px; vertical-align: middle;
  }
  .topic-badge.pk { color: #1b5e20; background: rgba(46,125,50,0.12); }
  .topic-badge.lw { color: #c62828; background: rgba(198,40,40,0.10); }
  .topic-score { margin-left: auto; font-weight: 800; font-size: 12pt; color: #8C6D3D; }
  .topic-cell.peak .topic-score { color: #1b5e20; }
  .topic-cell.low .topic-score { color: #c62828; }
  .topic-track { height: 2.5mm; background: #F0ECE1; border-radius: 2px; overflow: hidden; margin-bottom: 2mm; }
  .topic-fill { height: 100%; background: linear-gradient(90deg, #E8D9B8, #B8965A); }
  .topic-cell.peak .topic-fill { background: linear-gradient(90deg, #4caf50, #2e7d32); }
  .topic-cell.low .topic-fill { background: linear-gradient(90deg, #ef5350, #c62828); }
  .topic-desc { font-size: 9pt; line-height: 1.7; margin: 0; color: #3D3D3D; }

  /* ══════ §10 실천 ══════ */
  .action-item {
    display: flex; gap: 3.5mm;
    border: 1px solid #E5DFD0;
    border-radius: 10px;
    padding: 3.5mm 4.5mm;
    margin: 0 0 2.5mm;
    page-break-inside: avoid;
  }
  .action-num {
    flex: 0 0 auto;
    width: 7mm; height: 7mm;
    border-radius: 50%;
    background: #B8965A; color: #fff;
    font-weight: 800; font-size: 10pt;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .action-body { flex: 1; }
  .action-ttl { font-weight: 800; font-size: 10.5pt; margin-bottom: 1mm; }
  .action-desc { font-size: 9.5pt; line-height: 1.75; margin: 0; text-align: justify; }

  /* ══════ 디스클레이머 ══════ */
  .disclaimer {
    page-break-before: always;
    margin-top: 30mm;
    padding-top: 6mm;
    border-top: 1px solid #E5DFD0;
    text-align: center;
  }
  .disclaimer-source { font-size: 9pt; color: #7A7269; margin-bottom: 3mm; }
  .disclaimer-body {
    font-size: 8.5pt;
    color: #7A7269;
    font-style: italic;
    line-height: 1.7;
  }
  .footer-meta {
    margin-top: 10mm;
    font-size: 7.5pt;
    color: #B8965A;
    letter-spacing: 0.1em;
  }
</style>
</head>
<body>

<!-- ─────────── 표지 ─────────── -->
<div class="cover">
  <div class="cover-logo">사주500, SAJU500</div>
  <h1 class="cover-title">프리미엄 명리 분석</h1>
  <div class="cover-sub">한국 명리학 6대 원전 기반 정통 풀이</div>

  <div class="cover-name-block">
    <div class="cover-name">${esc(profile.name)}</div>
    <div class="cover-birth">
      ${esc(profile.birthDate || '')}${profile.birthTime ? ' ' + esc(profile.birthTime) : ''}${profile.gender ? ', ' + (profile.gender === 'male' ? '남' : '여') : ''}
    </div>
  </div>

  <div class="cover-pillars">
    ${pillarCardsHtml}
  </div>

  <div class="cover-base">
    <div class="cover-base-title">분석 기반 (命理 核心)</div>
    <div class="cover-base-row"><span class="k">일간(日干)</span>${esc(ilgan)}${ilganRead ? ` (${esc(ilganRead)})` : ''}${ilganOheng ? ` ${esc(ilganOheng)} 오행` : ''}</div>
    ${gyeokguk ? `<div class="cover-base-row"><span class="k">격국(格局)</span>${txt(gyeokguk)}</div>` : ''}
    ${gangyak ? `<div class="cover-base-row"><span class="k">일간 강약</span>${txt(gangyak)}</div>` : ''}
    ${yongsin ? `<div class="cover-base-row"><span class="k">용신(用神)</span>${txt(yongsin)}${yongsinReason ? ` — ${txt(yongsinReason)}` : ''}</div>` : ''}
    ${huisin ? `<div class="cover-base-row"><span class="k">희신(喜神)</span>${txt(huisin)}</div>` : ''}
    ${gisin ? `<div class="cover-base-row"><span class="k">기신(忌神)</span>${txt(gisin)}</div>` : ''}
  </div>

  <div class="cover-issued">
    발급일 ${esc(issuedFmt)}, 발급번호 ${esc(issueId)}
  </div>
</div>

${sections.join('\n')}

<!-- ─────────── 디스클레이머 ─────────── -->
<div class="disclaimer">
  ${disclaimer}
  <div class="footer-meta">
    SAJU500, ${esc(profile.name)}, 발급 ${esc(issuedFmt)}, No.${esc(issueId)}
  </div>
</div>

</body>
</html>`;
}
