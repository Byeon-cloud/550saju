"use strict";
/**
 * #61 · 프리미엄 PDF — HTML 템플릿 (서버 사이드 puppeteer 입력용)
 *
 * 입력: AI 응답 (claudeReport.ts 12 sections + analysisBase + scores + luckyProfile)
 *      + sajuData (pillars · elements · myeongriAnalysis)
 *      + profile (이름 · 생년월일 · 성별)
 *
 * 출력: 단일 HTML 문자열 (A4 인쇄용 · 표지 + 7섹션 + 푸터 디스클레이머)
 *
 * 한자 폰트 fallback 위험 0 — Noto Serif KR (Google Fonts CDN) 임베딩
 *   puppeteer 가 페이지 로드 시 외부 폰트 페치 → PDF 안에 글리프 임베디드.
 *   네트워크 차단 시 Cloud Functions 자체 fallback (system-ui / serif).
 *
 * 브랜드 토큰 (D1 SSOT):
 *   gold #B8965A · ink #1A1A1A · paper #F8F5EE · line #E5DFD0
 *
 * 7섹션 매핑 (PremiumResult.tsx 와 일치):
 *   01 원국 · 02 천간지지 · 03 십성 · 04 용신·조후 · 05 대운 · 06 연운 · 07 실천
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPremiumPdfHtml = buildPremiumPdfHtml;
/* ══════════════════════════════════════════════════════════════════
 * 안전 이스케이프 (XSS · HTML injection 방어)
 * ═════════════════════════════════════════════════════════════════ */
function esc(v) {
    if (v === null || v === undefined)
        return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/** 마크다운 굵기/이탤릭/헤딩/코드 제거 — 본문 텍스트 정화 */
function stripMd(text) {
    if (!text)
        return '';
    return String(text)
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .trim();
}
function paragraphs(text) {
    const cleaned = stripMd(text);
    if (!cleaned)
        return '';
    return cleaned
        .split(/\n{2,}|\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((p) => `<p>${esc(p)}</p>`)
        .join('');
}
/* ══════════════════════════════════════════════════════════════════
 * 사주 파일 추출 헬퍼 — sajuData 가 pillar 객체 / 기본값 둘 다 지원
 * ═════════════════════════════════════════════════════════════════ */
function pillarSlot(sajuData, idx) {
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
const OHENG_COLOR = {
    목: '#2D8A4E', 화: '#D32F2F', 토: '#F57F17', 금: '#757575', 수: '#1565C0',
};
/* ══════════════════════════════════════════════════════════════════
 * 섹션 콘텐츠 추출 — AI sections 배열에서 id 별 content 가져오기
 * ═════════════════════════════════════════════════════════════════ */
function getSection(aiResult, ids) {
    const sections = aiResult?.sections ?? [];
    for (const id of ids) {
        const found = sections.find((s) => s?.id === id);
        if (found?.content)
            return String(found.content);
    }
    return '';
}
function getSectionTitle(aiResult, ids, fallback) {
    const sections = aiResult?.sections ?? [];
    for (const id of ids) {
        const found = sections.find((s) => s?.id === id);
        if (found?.title)
            return String(found.title);
    }
    return fallback;
}
function getKeyInsight(aiResult, ids) {
    const sections = aiResult?.sections ?? [];
    for (const id of ids) {
        const found = sections.find((s) => s?.id === id);
        if (found?.keyInsight)
            return String(found.keyInsight);
    }
    return '';
}
/* ══════════════════════════════════════════════════════════════════
 * 메인 빌더
 * ═════════════════════════════════════════════════════════════════ */
function buildPremiumPdfHtml(input) {
    const { profile, sajuData, aiResult, issuedAt, issueId } = input;
    const year = pillarSlot(sajuData, 0);
    const month = pillarSlot(sajuData, 1);
    const day = pillarSlot(sajuData, 2);
    const time = pillarSlot(sajuData, 3);
    const ilgan = day.gan;
    const ilganRead = day.ganRead;
    const ilganOheng = day.ganOheng;
    const analysisBase = aiResult?.analysisBase ?? {};
    const gyeokguk = analysisBase.격국 ?? '';
    const gangyak = analysisBase.일간강약 ?? '';
    const yongsin = analysisBase.용신 ?? '';
    const yongsinReason = analysisBase.용신근거 ?? '';
    const huisin = analysisBase.희신 ?? '';
    const gisin = analysisBase.기신 ?? '';
    const elements = sajuData?.elements ?? {};
    const totalEl = Math.max(1, Object.values(elements).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0));
    // 섹션 텍스트
    const summary = getSection(aiResult, ['summary']);
    const structure = getSection(aiResult, ['structure', 'personality']);
    const personality = getSection(aiResult, ['personality']);
    const social = getSection(aiResult, ['social']);
    const career = getSection(aiResult, ['career']);
    const wealth = getSection(aiResult, ['wealth']);
    const love = getSection(aiResult, ['love']);
    const health = getSection(aiResult, ['health']);
    const yearFortune = getSection(aiResult, [
        `year${new Date().getFullYear()}`,
        'year2026',
        'year2025',
    ]);
    const daeun = getSection(aiResult, ['daeun']);
    const mission = getSection(aiResult, ['mission']);
    const luck = getSection(aiResult, ['luck']);
    const summaryKI = getKeyInsight(aiResult, ['summary']);
    const careerKI = getKeyInsight(aiResult, ['career']);
    const wealthKI = getKeyInsight(aiResult, ['wealth']);
    const loveKI = getKeyInsight(aiResult, ['love']);
    const yearKI = getKeyInsight(aiResult, [
        `year${new Date().getFullYear()}`, 'year2026', 'year2025',
    ]);
    const daeunKI = getKeyInsight(aiResult, ['daeun']);
    const luckKI = getKeyInsight(aiResult, ['luck']);
    // 발급 일자 (한국 시간대 표기)
    const issuedDate = new Date(issuedAt);
    const issuedFmt = `${issuedDate.getFullYear()}년 ${issuedDate.getMonth() + 1}월 ${issuedDate.getDate()}일`;
    // 사주 4기둥 카드 HTML
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
        </div>
      `;
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
        <div class="pillar-oheng">${esc(p.slot.ganOheng)} · ${esc(p.slot.jiOheng)}</div>
      </div>
    `;
    }).join('');
    // 오행 분포 막대
    const ohengBars = ['목', '화', '토', '금', '수'].map((k) => {
        const count = Number(elements[k] ?? 0);
        const pct = Math.round((count / totalEl) * 100);
        const color = OHENG_COLOR[k] || '#999';
        return `
      <div class="oheng-row">
        <div class="oheng-name">${esc(k)} <span class="oheng-count">${count}</span></div>
        <div class="oheng-track">
          <div class="oheng-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
    `;
    }).join('');
    // 직업 적합도 (careerFit)
    const careerFit = Array.isArray(aiResult?.careerFit) ? aiResult.careerFit.slice(0, 5) : [];
    const careerFitHtml = careerFit.length > 0
        ? `<table class="career-table"><thead><tr><th>직업</th><th>적합도</th><th>근거</th></tr></thead><tbody>${careerFit.map((c) => `
          <tr>
            <td><strong>${esc(c.job)}</strong></td>
            <td><span class="score-pill">${esc(c.score)}</span></td>
            <td>${esc(c.reason)}</td>
          </tr>
        `).join('')}</tbody></table>`
        : '';
    // 럭키 프로필
    const lucky = aiResult?.luckyProfile ?? {};
    const luckyHtml = `
    <table class="lucky-table">
      <tr><th>색상</th><td>${esc((lucky.colorNames || []).join(' · '))}</td></tr>
      <tr><th>방위</th><td>${esc(lucky.direction || '—')}</td></tr>
      <tr><th>요일</th><td>${esc(lucky.day || '—')}</td></tr>
      <tr><th>음식</th><td>${esc((lucky.foods || []).join(' · '))}</td></tr>
      <tr><th>숫자</th><td>${esc((lucky.numbers || []).join(' · '))}</td></tr>
      <tr><th>중심 오행</th><td>${esc(lucky.element || yongsin || '—')}</td></tr>
    </table>
  `;
    // 12개월 운세
    const monthly = Array.isArray(aiResult?.monthlyFortune) ? aiResult.monthlyFortune : [];
    const monthlyHtml = monthly.length === 12
        ? `<div class="monthly-grid">${monthly.map((m) => `
          <div class="monthly-cell">
            <div class="monthly-month">${esc(m.month)}월</div>
            <div class="monthly-score" style="background:linear-gradient(90deg,#B8965A ${esc(m.score)}%,#E5DFD0 ${esc(m.score)}%)">${esc(m.score)}</div>
          </div>
        `).join('')}</div>`
        : '';
    // ── 디스클레이머 (DailyFortune/Dream/PremiumResult 통일 패턴) ──
    const disclaimer = `
    <p class="disclaimer-source">
      한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반
    </p>
    <p class="disclaimer-body">
      사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.<br/>
      의료·법률·재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
    </p>
  `;
    // ─────────────────── HTML ───────────────────
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>사주500 프리미엄 — ${esc(profile.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
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
    font-size: 11pt;
    line-height: 1.7;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4 { font-family: 'Noto Serif KR', serif; font-weight: 600; color: #1A1A1A; margin: 0; }
  p { margin: 0 0 0.6em; }

  /* ══════ 표지 ══════ */
  .cover {
    page-break-after: always;
    padding: 40mm 0 0;
    text-align: center;
  }
  .cover-logo {
    font-family: 'Noto Serif KR', serif;
    font-weight: 700;
    font-size: 14pt;
    color: #B8965A;
    letter-spacing: 0.3em;
    margin-bottom: 8mm;
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
    margin-bottom: 18mm;
  }
  .cover-name-block {
    border-top: 1px solid #E5DFD0;
    border-bottom: 1px solid #E5DFD0;
    padding: 8mm 0;
    margin: 0 30mm 15mm;
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
    margin: 10mm 0;
  }
  .pillar-card {
    border: 1px solid #E5DFD0;
    border-radius: 8px;
    padding: 6mm 2mm;
    background: #F8F5EE;
    text-align: center;
  }
  .pillar-empty { background: #FAFAFA; border-style: dashed; }
  .pillar-label { font-size: 8pt; color: #7A7269; margin-bottom: 3mm; letter-spacing: 0.05em; }
  .pillar-stem { font-family: 'Noto Serif KR', serif; font-size: 22pt; font-weight: 700; line-height: 1.1; }
  .pillar-stem-read { font-size: 8.5pt; color: #7A7269; margin-bottom: 3mm; }
  .pillar-branch { font-family: 'Noto Serif KR', serif; font-size: 22pt; font-weight: 700; line-height: 1.1; }
  .pillar-branch-read { font-size: 8.5pt; color: #7A7269; margin-bottom: 2mm; }
  .pillar-oheng { font-size: 8pt; color: #B8965A; font-weight: 600; }
  .pillar-empty-msg { font-size: 7.5pt; color: #999; margin-top: 4mm; }

  .cover-base {
    margin: 12mm 20mm 8mm;
    padding: 6mm 8mm;
    background: rgba(184,150,90,0.06);
    border: 1px solid rgba(184,150,90,0.3);
    border-radius: 6px;
    text-align: left;
  }
  .cover-base-title {
    font-family: 'Noto Serif KR', serif;
    font-size: 11pt;
    font-weight: 700;
    color: #8C6D3D;
    margin-bottom: 3mm;
  }
  .cover-base-row { font-size: 10pt; color: #1A1A1A; margin: 1.5mm 0; }
  .cover-base-row strong { color: #8C6D3D; display: inline-block; min-width: 22mm; }

  .cover-issued {
    margin-top: 14mm;
    font-size: 9pt;
    color: #999;
    letter-spacing: 0.05em;
  }

  /* ══════ 섹션 공통 ══════ */
  .section {
    page-break-before: always;
    page-break-inside: avoid;
  }
  .section-head {
    display: flex;
    align-items: baseline;
    gap: 4mm;
    border-bottom: 1px solid #E5DFD0;
    padding-bottom: 3mm;
    margin-bottom: 6mm;
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
    font-size: 18pt;
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
    margin-bottom: 6mm;
    font-style: italic;
  }
  .key-insight {
    margin: 0 0 5mm;
    padding: 4mm 5mm;
    background: rgba(184,150,90,0.08);
    border-left: 3px solid #B8965A;
    font-family: 'Noto Serif KR', serif;
    font-size: 11.5pt;
    color: #1A1A1A;
    font-weight: 500;
    line-height: 1.6;
  }
  .body-text p {
    text-align: justify;
    text-indent: 0;
    color: #1A1A1A;
    line-height: 1.85;
    margin-bottom: 0.8em;
  }
  .sub-block {
    margin: 6mm 0;
    page-break-inside: avoid;
  }
  .sub-title {
    font-family: 'Noto Serif KR', serif;
    font-size: 12pt;
    font-weight: 600;
    color: #8C6D3D;
    margin-bottom: 3mm;
    padding-bottom: 1mm;
    border-bottom: 1px dotted #E5DFD0;
  }

  /* ══════ 오행 막대 ══════ */
  .oheng-row {
    display: flex;
    align-items: center;
    gap: 4mm;
    margin: 2mm 0;
  }
  .oheng-name {
    font-family: 'Noto Serif KR', serif;
    font-size: 10.5pt;
    font-weight: 600;
    width: 16mm;
  }
  .oheng-count {
    font-size: 9pt;
    color: #7A7269;
    font-weight: 400;
    margin-left: 1mm;
  }
  .oheng-track {
    flex: 1;
    height: 5mm;
    background: #F0ECE1;
    border-radius: 3px;
    overflow: hidden;
  }
  .oheng-fill { height: 100%; }

  /* ══════ 표 ══════ */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 2mm 0 6mm;
    font-size: 10pt;
  }
  th, td {
    text-align: left;
    padding: 2.5mm 3mm;
    border-bottom: 1px solid #E5DFD0;
    vertical-align: top;
  }
  th {
    background: #F8F5EE;
    color: #8C6D3D;
    font-weight: 700;
    font-size: 9.5pt;
  }
  .lucky-table th { width: 25mm; }
  .career-table th:nth-child(2),
  .career-table td:nth-child(2) { width: 18mm; text-align: center; }
  .score-pill {
    display: inline-block;
    background: #B8965A;
    color: #fff;
    font-weight: 700;
    padding: 0.5mm 2mm;
    border-radius: 8px;
    font-size: 9pt;
  }

  /* ══════ 12개월 그리드 ══════ */
  .monthly-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2mm;
  }
  .monthly-cell {
    border: 1px solid #E5DFD0;
    border-radius: 4px;
    padding: 2mm 3mm;
    text-align: center;
  }
  .monthly-month {
    font-family: 'Noto Serif KR', serif;
    font-weight: 700;
    font-size: 10pt;
    color: #1A1A1A;
    margin-bottom: 1.5mm;
  }
  .monthly-score {
    font-size: 9pt;
    font-weight: 600;
    color: #1A1A1A;
    padding: 0.8mm 0;
    border-radius: 2px;
    background: #F0ECE1;
  }

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
  <div class="cover-logo">사주500 · SAJU500</div>
  <h1 class="cover-title">프리미엄 명리 분석</h1>
  <div class="cover-sub">한국 명리학 6대 원전 기반 정통 풀이</div>

  <div class="cover-name-block">
    <div class="cover-name">${esc(profile.name)}</div>
    <div class="cover-birth">
      ${esc(profile.birthDate || '')}${profile.birthTime ? ' ' + esc(profile.birthTime) : ''}${profile.gender ? ' · ' + (profile.gender === 'male' ? '남' : '여') : ''}
    </div>
  </div>

  <div class="cover-pillars">
    ${pillarCardsHtml}
  </div>

  <div class="cover-base">
    <div class="cover-base-title">분석 기반 (命理 核心)</div>
    <div class="cover-base-row"><strong>일간(日干)</strong>${esc(ilgan)}${ilganRead ? ` (${esc(ilganRead)})` : ''}${ilganOheng ? ` · ${esc(ilganOheng)} 오행` : ''}</div>
    ${gyeokguk ? `<div class="cover-base-row"><strong>격국(格局)</strong>${esc(gyeokguk)}</div>` : ''}
    ${gangyak ? `<div class="cover-base-row"><strong>일간 강약</strong>${esc(gangyak)}</div>` : ''}
    ${yongsin ? `<div class="cover-base-row"><strong>용신(用神)</strong>${esc(yongsin)}${yongsinReason ? ` — ${esc(yongsinReason)}` : ''}</div>` : ''}
    ${huisin ? `<div class="cover-base-row"><strong>희신(喜神)</strong>${esc(huisin)}</div>` : ''}
    ${gisin ? `<div class="cover-base-row"><strong>기신(忌神)</strong>${esc(gisin)}</div>` : ''}
  </div>

  <div class="cover-issued">
    발급일 ${esc(issuedFmt)} · 발급번호 ${esc(issueId)}
  </div>
</div>

<!-- ─────────── 01 원국 (原局) ─────────── -->
<div class="section">
  <div class="section-head">
    <span class="section-step">SECTION 01</span>
    <h2 class="section-title">원국</h2>
    <span class="section-hanja">原局</span>
  </div>
  <div class="section-hint">태어난 순간 하늘과 땅이 그려낸 여덟 글자</div>
  ${summaryKI ? `<div class="key-insight">${esc(summaryKI)}</div>` : ''}

  <div class="sub-block">
    <div class="sub-title">사주 4기둥</div>
    <div class="cover-pillars" style="margin-top:0">${pillarCardsHtml}</div>
  </div>

  <div class="sub-block">
    <div class="sub-title">오행 분포 (五行 分布)</div>
    ${ohengBars}
  </div>

  ${summary ? `<div class="sub-block"><div class="sub-title">종합 진단</div><div class="body-text">${paragraphs(summary)}</div></div>` : ''}
</div>

<!-- ─────────── 02 천간지지 (天干地支) ─────────── -->
<div class="section">
  <div class="section-head">
    <span class="section-step">SECTION 02</span>
    <h2 class="section-title">천간지지</h2>
    <span class="section-hanja">天干地支</span>
  </div>
  <div class="section-hint">위로 드러난 마음과 아래에 깔린 본능</div>

  ${structure ? `<div class="body-text">${paragraphs(structure)}</div>` : ''}
  ${personality && personality !== structure ? `
    <div class="sub-block">
      <div class="sub-title">${esc(getSectionTitle(aiResult, ['personality'], '성격과 기질'))}</div>
      <div class="body-text">${paragraphs(personality)}</div>
    </div>` : ''}
</div>

<!-- ─────────── 03 십성 (十神) ─────────── -->
<div class="section">
  <div class="section-head">
    <span class="section-step">SECTION 03</span>
    <h2 class="section-title">십성</h2>
    <span class="section-hanja">十神</span>
  </div>
  <div class="section-hint">관계와 욕망을 그리는 열 개의 키</div>

  ${social ? `
    <div class="sub-block">
      <div class="sub-title">${esc(getSectionTitle(aiResult, ['social'], '대인관계'))}</div>
      <div class="body-text">${paragraphs(social)}</div>
    </div>` : ''}

  ${career ? `
    <div class="sub-block">
      <div class="sub-title">${esc(getSectionTitle(aiResult, ['career'], '직업과 적성'))}</div>
      ${careerKI ? `<div class="key-insight">${esc(careerKI)}</div>` : ''}
      <div class="body-text">${paragraphs(career)}</div>
      ${careerFitHtml ? `<div class="sub-block"><div class="sub-title">직업 적합도</div>${careerFitHtml}</div>` : ''}
    </div>` : ''}

  ${wealth ? `
    <div class="sub-block">
      <div class="sub-title">${esc(getSectionTitle(aiResult, ['wealth'], '재물운'))}</div>
      ${wealthKI ? `<div class="key-insight">${esc(wealthKI)}</div>` : ''}
      <div class="body-text">${paragraphs(wealth)}</div>
    </div>` : ''}

  ${love ? `
    <div class="sub-block">
      <div class="sub-title">${esc(getSectionTitle(aiResult, ['love'], '애정운'))}</div>
      ${loveKI ? `<div class="key-insight">${esc(loveKI)}</div>` : ''}
      <div class="body-text">${paragraphs(love)}</div>
    </div>` : ''}
</div>

<!-- ─────────── 04 용신·조후 (用神·調候) ─────────── -->
<div class="section">
  <div class="section-head">
    <span class="section-step">SECTION 04</span>
    <h2 class="section-title">용신·조후</h2>
    <span class="section-hanja">用神·調候</span>
  </div>
  <div class="section-hint">사주가 가장 갈증을 느끼는 것 — 색·방위·계절·물건·습관</div>

  ${yongsin ? `
    <div class="key-insight">
      이 사주의 용신은 <strong>${esc(yongsin)}</strong>입니다.${yongsinReason ? ` ${esc(yongsinReason)}` : ''}
    </div>` : ''}

  <div class="sub-block">
    <div class="sub-title">럭키 프로필 — 용신 기반 라이프스타일</div>
    ${luckyHtml}
  </div>

  ${health ? `
    <div class="sub-block">
      <div class="sub-title">${esc(getSectionTitle(aiResult, ['health'], '건강운'))}</div>
      <div class="body-text">${paragraphs(health)}</div>
    </div>` : ''}
</div>

<!-- ─────────── 05 대운 (大運) ─────────── -->
<div class="section">
  <div class="section-head">
    <span class="section-step">SECTION 05</span>
    <h2 class="section-title">대운</h2>
    <span class="section-hanja">大運</span>
  </div>
  <div class="section-hint">10년 단위로 흐르는 인생의 큰 강줄기</div>
  ${daeunKI ? `<div class="key-insight">${esc(daeunKI)}</div>` : ''}
  ${daeun ? `<div class="body-text">${paragraphs(daeun)}</div>` : ''}
</div>

<!-- ─────────── 06 연운 (年運) ─────────── -->
<div class="section">
  <div class="section-head">
    <span class="section-step">SECTION 06</span>
    <h2 class="section-title">연운</h2>
    <span class="section-hanja">年運</span>
  </div>
  <div class="section-hint">올해의 흐름 + 시기별 경고</div>
  ${yearKI ? `<div class="key-insight">${esc(yearKI)}</div>` : ''}
  ${yearFortune ? `<div class="body-text">${paragraphs(yearFortune)}</div>` : ''}
  ${monthlyHtml ? `<div class="sub-block"><div class="sub-title">12개월 흐름</div>${monthlyHtml}</div>` : ''}
</div>

<!-- ─────────── 07 실천 ─────────── -->
<div class="section">
  <div class="section-head">
    <span class="section-step">SECTION 07</span>
    <h2 class="section-title">실천</h2>
    <span class="section-hanja">行</span>
  </div>
  <div class="section-hint">신살의 결을 살리고, 분기별로 손에 잡히는 액션으로</div>

  ${mission ? `
    <div class="sub-block">
      <div class="sub-title">${esc(getSectionTitle(aiResult, ['mission'], '인생 과제'))}</div>
      <div class="body-text">${paragraphs(mission)}</div>
    </div>` : ''}

  ${luck ? `
    <div class="sub-block">
      <div class="sub-title">${esc(getSectionTitle(aiResult, ['luck'], '개운법'))}</div>
      ${luckKI ? `<div class="key-insight">${esc(luckKI)}</div>` : ''}
      <div class="body-text">${paragraphs(luck)}</div>
    </div>` : ''}
</div>

<!-- ─────────── 디스클레이머 ─────────── -->
<div class="disclaimer">
  ${disclaimer}
  <div class="footer-meta">
    SAJU500 · ${esc(profile.name)} · 발급 ${esc(issuedFmt)} · No.${esc(issueId)}
  </div>
</div>

</body>
</html>`;
}
//# sourceMappingURL=htmlTemplate.js.map