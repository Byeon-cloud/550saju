// ResultPagePremiumV2 — byte-perfect mockup 복제
// 출처: D:/550saju/docs/mockups/사주500_UI개편_목업_결과프리미엄_v2.html
// 방식: 전체 mockup HTML 을 template literal 로 embed
//   - iframe srcDoc 으로 isolated 렌더 (mockup 글로벌 CSS 가 앱 다른 부분에 영향 없음)
//   - 한 글자도 수정 안 함 (class / inline style / hex 색상 / 폰트 / 픽셀 그대로)

const MOCKUP_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>사주500 — 프리미엄 결과 페이지 목업 v2 (10운)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700;900&family=Pretendard:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  /* =========================================================
     사주500 — 프리미엄 결과 페이지 (10운, 변준기 샘플)
     - 실 카피 기반 퀄리티 증명용 목업
     - 7섹션: 원국 / 천간지지 / 십성 / 대운 / 연운 / 신살 / 실천
     - 분량: 7섹션 깊이 풀이 (실 카피)
     ========================================================= */
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  html, body {
    background: #0a0a0a;
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #1a1a1a;
    letter-spacing: -0.01em;
  }
  .page-wrap {
    max-width: 480px;
    margin: 0 auto;
    background: #F8F5EE;
    min-height: 100vh;
    position: relative;
    box-shadow: 0 0 80px rgba(0,0,0,.4);
  }

  /* ─── ResultHeader (상단 고정 헤더) ─────────────────────── */
  .header {
    position: sticky; top: 0; z-index: 50;
    background: linear-gradient(180deg, #1a1a1a 0%, #2a2520 100%);
    color: #fff;
    padding: 14px 20px 12px;
    display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid rgba(212,175,55,.3);
  }
  .header .back { font-size: 22px; cursor: pointer; opacity: .8; }
  .header .meta { flex: 1; }
  .header .meta .title { font-family: 'Noto Serif KR', serif; font-size: 15px; font-weight: 600; letter-spacing: 0; }
  .header .meta .sub { font-size: 11px; color: #E8D9B8; margin-top: 2px; letter-spacing: 0.05em; }
  .header .badge {
    background: linear-gradient(135deg, #E8D9B8 0%, #B8965A 100%);
    color: #1a1a1a;
    font-size: 10px; font-weight: 700;
    padding: 4px 10px; border-radius: 100px;
    letter-spacing: 0.08em;
  }

  /* ─── Hero (인물 정보 카드) ──────────────────────────── */
  .hero {
    background: linear-gradient(180deg, #1a1a1a 0%, #1a1a1a 60%, #F8F5EE 60%, #F8F5EE 100%);
    padding: 24px 20px 0;
    position: relative;
  }
  .hero-card {
    background: linear-gradient(135deg, #F8F5EE 0%, #F0E8D9 100%);
    border-radius: 16px;
    padding: 24px 22px;
    box-shadow: 0 12px 40px rgba(0,0,0,.25), 0 0 0 1px rgba(212,175,55,.4);
    position: relative;
    overflow: hidden;
  }
  .hero-card::before {
    content: '命';
    position: absolute;
    right: -10px; bottom: -30px;
    font-family: 'Noto Serif KR', serif;
    font-size: 180px; font-weight: 900;
    color: rgba(212,175,55,.08);
    line-height: 1;
  }
  .hero-card .person {
    font-family: 'Noto Serif KR', serif;
    font-size: 24px; font-weight: 700;
    color: #1a1a1a;
    letter-spacing: -0.02em;
  }
  .hero-card .birth {
    font-size: 13px; color: #5C4A2E; margin-top: 6px;
    font-feature-settings: 'tnum';
  }
  .hero-card .ilgan {
    margin-top: 16px;
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(46, 125, 50, 0.08);
    border: 1px solid rgba(46, 125, 50, 0.2);
    padding: 8px 14px; border-radius: 100px;
  }
  .hero-card .ilgan .hanja {
    font-family: 'Noto Serif KR', serif;
    font-size: 18px; font-weight: 700;
    color: #2e7d32;
  }
  .hero-card .ilgan .label {
    font-size: 12px; color: #2e7d32; font-weight: 500;
  }
  .hero-card .meta {
    margin-top: 14px;
    display: flex; gap: 12px; font-size: 11px; color: #7F6B4E;
    position: relative; z-index: 2;
  }
  .hero-card .meta span { display: inline-flex; align-items: center; gap: 4px; }

  /* ─── 섹션 공통 ──────────────────────────────────── */
  .content { padding: 0 20px 100px; background: #F8F5EE; }
  .section { margin-top: 32px; }
  .section-num {
    display: inline-block;
    font-family: 'Noto Serif KR', serif;
    font-size: 11px; font-weight: 600;
    color: #B8965A;
    letter-spacing: 0.2em;
    margin-bottom: 6px;
  }
  .section-title {
    font-family: 'Noto Serif KR', serif;
    font-size: 21px; font-weight: 700;
    color: #1a1a1a;
    letter-spacing: -0.01em;
    margin-bottom: 4px;
  }
  .section-title .hanja {
    color: #B8965A; font-weight: 500;
    margin-left: 6px; font-size: 17px;
  }
  .section-sub {
    font-size: 12px; color: #7F6B4E;
    margin-bottom: 18px;
  }
  .section p {
    font-size: 14.5px; line-height: 1.85;
    color: #2a2520;
    margin-bottom: 14px;
    word-break: keep-all;
  }
  .section p strong {
    font-weight: 600; color: #1a1a1a;
    background: linear-gradient(180deg, transparent 60%, rgba(212,175,55,.25) 60%);
    padding: 0 2px;
  }
  .section p .han {
    font-family: 'Noto Serif KR', serif;
    color: #5C4A2E;
    font-size: 13px;
    margin: 0 1px;
  }

  /* ─── 1. 원국 (사주 8글자 카드) ───────────────────────── */
  .wongug {
    background: linear-gradient(180deg, #fff 0%, #F8F5EE 100%);
    border-radius: 14px;
    padding: 18px 14px;
    border: 1px solid #E5DFD0;
    margin: 16px 0 18px;
    box-shadow: 0 4px 12px rgba(0,0,0,.04);
  }
  .wongug-table {
    display: grid;
    grid-template-columns: 60px repeat(4, 1fr);
    text-align: center;
    gap: 6px;
  }
  .wongug-table .row-label {
    font-size: 10px; color: #7F6B4E;
    align-self: center;
    text-align: right; padding-right: 4px;
    font-weight: 500;
  }
  .wongug-table .col-header {
    font-size: 10px; color: #B8965A;
    padding: 4px 0;
    font-weight: 600; letter-spacing: 0.1em;
  }
  .wongug-cell {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 8px;
    padding: 14px 4px 10px;
    position: relative;
  }
  .wongug-cell.ilju {
    background: linear-gradient(180deg, rgba(46,125,50,.08) 0%, rgba(46,125,50,.04) 100%);
    border-color: rgba(46,125,50,.3);
  }
  .wongug-cell .glyph {
    font-family: 'Noto Serif KR', serif;
    font-size: 28px; font-weight: 700;
    line-height: 1;
    margin-bottom: 4px;
  }
  .wongug-cell .glyph.mok { color: #2e7d32; }
  .wongug-cell .glyph.hwa { color: #c62828; }
  .wongug-cell .glyph.to  { color: #7F6B4E; }
  .wongug-cell .glyph.geum{ color: #757575; }
  .wongug-cell .glyph.su  { color: #1565c0; }
  .wongug-cell .yum {
    font-size: 9px; color: #7F6B4E; margin-top: 2px;
  }

  /* ─── 오행 밸런스 차트 ─────────────────────────── */
  .ohaeng-chart {
    margin-top: 14px;
    background: #F8F5EE;
    border-radius: 10px;
    padding: 14px 12px;
  }
  .ohaeng-chart .title {
    font-size: 11px; color: #5C4A2E;
    margin-bottom: 8px; font-weight: 500;
  }
  .ohaeng-bar {
    display: grid; grid-template-columns: 28px 1fr 30px;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 11px;
  }
  .ohaeng-bar .o-label {
    font-family: 'Noto Serif KR', serif;
    font-size: 13px; font-weight: 600;
  }
  .ohaeng-bar .o-track {
    background: #E5DFD0; height: 6px; border-radius: 100px; overflow: hidden;
  }
  .ohaeng-bar .o-fill {
    height: 100%; border-radius: 100px;
    transition: width .8s ease;
  }
  .ohaeng-bar .o-count {
    text-align: right; color: #7F6B4E; font-feature-settings: 'tnum';
  }
  .o-mok  .o-label { color: #2e7d32; } .o-mok  .o-fill { background: #2e7d32; }
  .o-hwa  .o-label { color: #c62828; } .o-hwa  .o-fill { background: #c62828; }
  .o-to   .o-label { color: #7F6B4E; } .o-to   .o-fill { background: #7F6B4E; }
  .o-geum .o-label { color: #757575; } .o-geum .o-fill { background: #757575; }
  .o-su   .o-label { color: #1565c0; } .o-su   .o-fill { background: #1565c0; }

  /* ─── 3. 십성 카드 그리드 ──────────────────────── */
  .sipseong-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px; margin: 14px 0;
  }
  .sip-card {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 10px;
    padding: 12px;
  }
  .sip-card .top {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 4px;
  }
  .sip-card .name {
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; font-weight: 600; color: #1a1a1a;
  }
  .sip-card .han { font-family: 'Noto Serif KR', serif; color: #B8965A; font-size: 12px; }
  .sip-card .desc { font-size: 11.5px; color: #5C4A2E; line-height: 1.6; }

  /* ─── 4. 대운 타임라인 ─────────────────────────── */
  .daewoon-timeline {
    background: linear-gradient(135deg, #fff 0%, #F8F5EE 100%);
    border-radius: 14px;
    padding: 18px 14px;
    border: 1px solid #E5DFD0;
    margin: 14px 0;
    overflow-x: auto;
  }
  .daewoon-row {
    display: grid; grid-template-columns: repeat(8, 70px);
    gap: 4px; min-width: 100%;
  }
  .dw-cell {
    text-align: center;
    background: #F8F5EE;
    border-radius: 8px;
    padding: 8px 4px;
    border: 1px solid transparent;
    position: relative;
  }
  .dw-cell.now {
    background: linear-gradient(180deg, rgba(212,175,55,.18) 0%, rgba(212,175,55,.08) 100%);
    border-color: #E8D9B8;
  }
  .dw-cell .age { font-size: 9px; color: #7F6B4E; }
  .dw-cell .gan { font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 700; margin-top: 4px; line-height: 1; }
  .dw-cell .ji  { font-family: 'Noto Serif KR', serif; font-size: 13px; color: #5C4A2E; line-height: 1.2; }
  .dw-cell .label { font-size: 8px; color: #B8965A; margin-top: 4px; font-weight: 600; }

  /* ─── 5. 연운 라인 차트 (점수 추이) ───────────── */
  .yeonun-chart {
    background: #fff;
    border-radius: 12px;
    padding: 16px 14px;
    border: 1px solid #E5DFD0;
    margin: 14px 0;
  }
  .yeonun-chart .ttl {
    font-size: 11px; color: #5C4A2E; margin-bottom: 10px; font-weight: 500;
  }
  .yeonun-svg { width: 100%; height: 120px; }

  /* ─── 6. 신살 카드 리스트 ────────────────────── */
  .shinsal-list { display: flex; flex-direction: column; gap: 8px; margin: 14px 0; }
  .shinsal-card {
    background: #fff;
    border-left: 3px solid #B8965A;
    border-radius: 0 10px 10px 0;
    padding: 12px 14px;
    box-shadow: 0 2px 6px rgba(0,0,0,.03);
  }
  .shinsal-card .head {
    display: flex; align-items: baseline; gap: 8px;
    margin-bottom: 6px;
  }
  .shinsal-card .nm {
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; font-weight: 700; color: #1a1a1a;
  }
  .shinsal-card .han { font-family: 'Noto Serif KR', serif; color: #B8965A; font-size: 12px; }
  .shinsal-card .tag {
    margin-left: auto;
    background: rgba(184,148,31,.1); color: #B8965A;
    font-size: 9.5px; padding: 2px 8px; border-radius: 100px; font-weight: 600;
  }
  .shinsal-card p { font-size: 12.5px; color: #2a2520; line-height: 1.7; margin: 0; }

  /* ─── 7. 실천 액션 카드 ─────────────────────── */
  .action-list { display: flex; flex-direction: column; gap: 10px; margin: 14px 0; }
  .action-card {
    background: linear-gradient(135deg, #fff 0%, #F8F5EE 100%);
    border-radius: 12px;
    padding: 14px 16px;
    border: 1px solid #E5DFD0;
    display: flex; gap: 12px; align-items: flex-start;
  }
  .action-card .num {
    width: 28px; height: 28px;
    background: linear-gradient(135deg, #E8D9B8, #B8965A);
    color: #1a1a1a;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; font-weight: 700;
    flex-shrink: 0;
  }
  .action-card .body { flex: 1; }
  .action-card .body .ttl { font-weight: 600; font-size: 14px; color: #1a1a1a; margin-bottom: 4px; }
  .action-card .body .desc { font-size: 12.5px; color: #5C4A2E; line-height: 1.65; }

  /* ─── Pull-quote (인용 강조 박스) ──────────────── */
  .pullquote {
    background: linear-gradient(135deg, rgba(46,125,50,.04) 0%, rgba(212,175,55,.04) 100%);
    border-radius: 12px;
    padding: 18px 18px 16px;
    margin: 18px 0;
    border-left: 3px solid #2e7d32;
    position: relative;
  }
  .pullquote::before {
    content: '"';
    position: absolute;
    top: -14px; left: 14px;
    font-family: 'Noto Serif KR', serif;
    font-size: 60px; color: rgba(46,125,50,.2);
    line-height: 1;
  }
  .pullquote p {
    font-family: 'Noto Serif KR', serif !important;
    font-size: 15px !important;
    line-height: 1.75 !important;
    color: #1a1a1a !important;
    margin: 0 !important;
    font-weight: 500;
  }

  /* ─── Divider ──────────────────────────────── */
  .divider {
    display: flex; align-items: center;
    margin: 28px 0;
    color: #B8965A;
    gap: 12px;
  }
  .divider::before, .divider::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, #E8D9B8, transparent);
  }
  .divider .han {
    font-family: 'Noto Serif KR', serif;
    font-size: 16px; font-weight: 500;
  }

  /* ─── Upsell 카드 (사주대화 / 관련 주제) ──────── */
  .upsell-card {
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2520 100%);
    color: #fff;
    border-radius: 14px;
    padding: 22px 20px;
    margin: 32px 0 20px;
    position: relative;
    overflow: hidden;
  }
  .upsell-card::before {
    content: '對';
    position: absolute;
    right: -10px; bottom: -30px;
    font-family: 'Noto Serif KR', serif;
    font-size: 140px; font-weight: 900;
    color: rgba(212,175,55,.08);
    line-height: 1;
  }
  .upsell-card .label {
    font-size: 10px; color: #E8D9B8;
    letter-spacing: 0.15em; font-weight: 600;
    margin-bottom: 8px;
  }
  .upsell-card h3 {
    font-family: 'Noto Serif KR', serif;
    font-size: 17px; font-weight: 700;
    margin-bottom: 6px;
    position: relative;
  }
  .upsell-card p {
    font-size: 12.5px; color: #c4baa0;
    margin-bottom: 14px; line-height: 1.6;
    position: relative;
  }
  .upsell-card .cta {
    display: inline-flex; align-items: center; gap: 6px;
    background: linear-gradient(135deg, #E8D9B8, #B8965A);
    color: #1a1a1a;
    padding: 10px 18px; border-radius: 100px;
    font-size: 13px; font-weight: 700;
    cursor: pointer; position: relative;
  }

  /* ─── Footer (공유 + PDF) — 다른 결과 페이지 .actions 와 통일 ─── */
  .result-footer {
    margin-top: 22px;
    padding: 18px 0 0;
    border-top: 1px solid #E5DFD0;
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  }
  .result-footer .btn {
    background: #fff; border: 1px solid #E5DFD0; border-radius: 12px;
    padding: 14px 8px;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: #1a1a1a; cursor: pointer; transition: .2s;
    text-align: center;
  }
  .result-footer .btn:hover { border-color: #B8965A; }
  .result-footer .btn svg { width: 22px; height: 22px; color: #B8965A; }
  .result-footer .btn .ti { font-size: 12.5px; font-weight: 600; }
  .result-footer .btn .sb { font-size: 10px; color: #7F6B4E; }

  /* ─── 리포트의 지식 기반 (fine print, 찾아 읽는 사람만) ─── */
  .report-sources {
    margin: 28px 2px 0;
    padding: 12px 0 0;
    border-top: 1px solid rgba(138,125,95,.16);
    font-size: 9.5px;
    line-height: 1.72;
    color: #a89c7f;
    letter-spacing: 0.005em;
    word-break: keep-all;
  }
  .report-sources p { margin: 0; }
  .report-sources p + p { margin-top: 8px; }
  .report-sources .notice-line { color: #9A8B70; font-style: italic; }
  .report-sources .book {
    font-family: 'Noto Serif KR', serif;
    color: #7F6B4E;
  }

  /* ─── 섹션 결론 박스 (다크) ──────────────── */
  /* \`.section p { color:#2a2520 }\` 가 dark BG에서 본문을 먹는 버그 → 클래스로 강제 */
  .section-conclusion {
    margin-top: 18px;
    padding: 16px;
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2520 100%);
    border-radius: 10px;
    border: 1px solid rgba(212,175,55,.18);
    color: #F0E8D9;
  }
  .section-conclusion .sc-label {
    font-family: 'Noto Serif KR', serif;
    font-size: 11px;
    color: #E8D9B8;
    letter-spacing: 0.1em;
    font-weight: 700;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(212,175,55,.15);
  }
  .section-conclusion p,
  .section-conclusion .sc-row {
    color: #F0E8D9 !important;
    font-size: 13px;
    line-height: 1.78;
    margin: 0 0 10px;
    font-weight: 400;
    word-break: keep-all;
  }
  .section-conclusion p:last-child,
  .section-conclusion .sc-row:last-child { margin-bottom: 0; }
  .section-conclusion strong {
    color: #f4d166 !important;
    background: none !important;
    font-weight: 700;
    padding: 0;
  }
  .section-conclusion .sc-num {
    display: inline-block;
    color: #E8D9B8;
    font-weight: 700;
    margin-right: 4px;
  }

  /* ─── 분량 & 메타 표시 (디버그용) ──────────── */
  .word-count {
    text-align: center;
    font-size: 10.5px;
    color: #7F6B4E;
    margin: 24px 0 12px;
    letter-spacing: 0.05em;
  }
  .word-count .han { font-family: 'Noto Serif KR', serif; color: #B8965A; }

  /* ─── 좌측 인디케이터 (현 위치 섹션) ────────── */
  .toc-side {
    position: fixed;
    left: max(8px, calc(50% - 270px));
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    display: flex; flex-direction: column; gap: 4px;
  }
  .toc-side .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #E8D9B8; opacity: .25;
  }
  .toc-side .dot.active { opacity: 1; transform: scale(1.5); transition: .3s; }
  @media (max-width: 540px) { .toc-side { display: none; } }

  /* ═══════════════ V2 추가 스타일 ═══════════════ */

  /* 원국 셀 위 십성 뱃지 */
  .wongug-cell .sip-tag {
    position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 100px;
    padding: 1px 7px;
    font-size: 9px; color: #7F6B4E;
    font-weight: 600; letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .wongug-cell.ilju .sip-tag {
    background: linear-gradient(135deg, #E8D9B8, #B8965A);
    color: #1a1a1a; border-color: transparent;
  }
  .wongug-cell .glyph.su  { color: #1565c0; }  /* 보강 */

  /* 음양 균형 도식 */
  .yin-yang-card {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 12px;
    padding: 14px 14px 10px;
    margin: 12px 0;
  }
  .yy-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 10px; font-weight: 500;
  }
  .yy-bar {
    display: flex; height: 24px; border-radius: 6px; overflow: hidden;
    border: 1px solid #E5DFD0; font-size: 11px; font-weight: 600;
  }
  .yy-bar .yang {
    background: linear-gradient(90deg, #c62828, #e57373);
    color: #fff; display: flex; align-items: center; justify-content: center;
  }
  .yy-bar .yin {
    background: linear-gradient(90deg, #37474f, #546e7a);
    color: #fff; display: flex; align-items: center; justify-content: center;
  }
  .yy-caption { font-size: 11px; color: #5C4A2E; margin-top: 6px; line-height: 1.55; }

  /* 오행 강·약 진단 도식 */
  .ohaeng-diag {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 6px; margin-top: 12px;
  }
  .ohaeng-diag .od-cell {
    border-radius: 10px;
    padding: 10px 4px 8px;
    text-align: center;
    border: 1px solid #E5DFD0;
    position: relative;
  }
  .ohaeng-diag .od-cell.strong { border-color: #2e7d32; background: rgba(46,125,50,.05); }
  .ohaeng-diag .od-cell.weak   { border-color: #c62828; background: rgba(198,40,40,.04); }
  .ohaeng-diag .od-han {
    font-family: 'Noto Serif KR', serif;
    font-size: 20px; font-weight: 700;
    line-height: 1;
  }
  .ohaeng-diag .od-han.mok  { color: #2e7d32; }
  .ohaeng-diag .od-han.hwa  { color: #c62828; }
  .ohaeng-diag .od-han.to   { color: #7F6B4E; }
  .ohaeng-diag .od-han.geum { color: #757575; }
  .ohaeng-diag .od-han.su   { color: #1565c0; }
  .ohaeng-diag .od-dots {
    margin-top: 6px; display: flex; justify-content: center; gap: 2px;
  }
  .ohaeng-diag .od-dots span {
    width: 5px; height: 5px; border-radius: 50%;
    background: #E5DFD0;
  }
  .ohaeng-diag .od-dots span.on { background: #B8965A; }
  .ohaeng-diag .od-label {
    font-size: 9px; color: #7F6B4E; margin-top: 4px;
    font-weight: 600; letter-spacing: 0.05em;
  }
  .ohaeng-diag .od-label.s { color: #2e7d32; }
  .ohaeng-diag .od-label.w { color: #c62828; }

  /* 천간-지지 합·충 도식 */
  .ganji-flow {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 12px;
    padding: 14px;
    margin: 12px 0;
  }
  .ganji-flow .gf-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 10px; font-weight: 500;
  }
  .ganji-flow .gf-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 0;
    border-top: 1px dashed #E5DFD0;
    font-size: 12px; color: #2a2520;
  }
  .ganji-flow .gf-row:first-of-type { border-top: 0; }
  .ganji-flow .gf-glyph {
    font-family: 'Noto Serif KR', serif;
    font-size: 15px; font-weight: 700;
  }
  .ganji-flow .gf-arrow { color: #B8965A; font-size: 11px; }
  .ganji-flow .gf-type {
    margin-left: auto; padding: 2px 8px; border-radius: 100px;
    font-size: 9.5px; font-weight: 600; letter-spacing: 0.05em;
  }
  .ganji-flow .gf-type.hap   { background: rgba(46,125,50,.1);  color: #2e7d32; }
  .ganji-flow .gf-type.chung { background: rgba(198,40,40,.1);  color: #c62828; }
  .ganji-flow .gf-type.hyeong{ background: rgba(184,148,31,.12); color: #B8965A; }

  /* 십성 카드 강도 막대 */
  .sip-card .strength {
    display: flex; gap: 3px; margin-top: 8px;
  }
  .sip-card .strength span {
    flex: 1; height: 4px; border-radius: 2px;
    background: #E5DFD0;
  }
  .sip-card .strength span.on { background: #B8965A; }
  .sip-card .s-label {
    font-size: 9.5px; color: #7F6B4E;
    margin-top: 4px; letter-spacing: 0.05em;
  }

  /* 대운 점수 막대 (60년) */
  .daewoon-scores {
    margin-top: 14px;
    background: #F8F5EE;
    border-radius: 10px;
    padding: 14px 12px 10px;
    border: 1px solid #E5DFD0;
  }
  .daewoon-scores .ds-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 10px; font-weight: 500;
  }
  .daewoon-scores .ds-row {
    display: grid;
    grid-template-columns: 58px 1fr 32px;
    align-items: center; gap: 8px;
    margin-bottom: 5px;
    font-size: 10.5px;
  }
  .daewoon-scores .ds-age { color: #7F6B4E; letter-spacing: 0.03em; }
  .daewoon-scores .ds-track { background: #E5DFD0; height: 8px; border-radius: 100px; position: relative; }
  .daewoon-scores .ds-fill {
    height: 100%; border-radius: 100px;
    background: linear-gradient(90deg, #E8D9B8, #B8965A);
  }
  .daewoon-scores .ds-fill.peak { background: linear-gradient(90deg, #2e7d32, #4caf50); }
  .daewoon-scores .ds-fill.now  {
    background: linear-gradient(90deg, #B8965A, #E8D9B8);
    box-shadow: 0 0 0 1px rgba(212,175,55,.4);
  }
  .daewoon-scores .ds-score { text-align: right; color: #1a1a1a; font-weight: 600; }
  .daewoon-scores .ds-caption {
    margin-top: 8px; font-size: 10.5px; color: #7F6B4E;
    padding-top: 8px; border-top: 1px dashed #E5DFD0; line-height: 1.6;
  }

  /* 신살 × 행동 카드 (v2 확장) */
  .shinsal-card .adv {
    margin-top: 8px; padding-top: 8px;
    border-top: 1px dashed #E5DFD0;
    display: flex; gap: 6px; align-items: flex-start;
  }
  .shinsal-card .adv .adv-icon {
    flex-shrink: 0; width: 18px; height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, #E8D9B8, #B8965A);
    color: #1a1a1a;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700;
  }
  .shinsal-card .adv .adv-text {
    font-size: 11.5px; color: #2a2520; line-height: 1.55;
  }

  /* 주제별 미니 카드 그리드 */
  .topic-mini-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px; margin: 14px 0;
  }
  .topic-mini {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #E5DFD0;
    padding: 12px 12px 10px;
    display: flex; flex-direction: column; gap: 6px;
    position: relative;
    overflow: hidden;
  }
  .topic-mini .tm-head {
    display: flex; align-items: center; justify-content: space-between;
  }
  .topic-mini .tm-ttl {
    font-family: 'Noto Serif KR', serif;
    font-size: 13px; font-weight: 700; color: #1a1a1a;
  }
  .topic-mini .tm-score {
    font-family: 'Noto Serif KR', serif;
    font-size: 16px; font-weight: 700; color: #B8965A;
    line-height: 1;
  }
  .topic-mini .tm-bar {
    height: 5px; background: #E5DFD0; border-radius: 100px;
  }
  .topic-mini .tm-fill {
    height: 100%; border-radius: 100px;
    background: linear-gradient(90deg, #E8D9B8, #B8965A);
  }
  .topic-mini .tm-desc {
    font-size: 11px; color: #5C4A2E; line-height: 1.55;
  }
  .topic-mini .tm-link {
    font-size: 10.5px; color: #B8965A;
    margin-top: 2px; font-weight: 600;
    display: inline-flex; align-items: center; gap: 3px;
    letter-spacing: 0.03em;
  }
  .topic-mini.full {
    grid-column: span 2;
    background: linear-gradient(135deg, rgba(212,175,55,.08), rgba(46,125,50,.04));
  }

  /* 아코디언 토글 — 헤더 전체가 클릭 영역 (60대+ 사용성) */
  .section-head-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    cursor: pointer;
    padding: 8px 4px;
    margin: 0 -4px;
    border-radius: 8px;
    user-select: none;
    -webkit-tap-highlight-color: rgba(212,175,55,.18);
    transition: background .15s ease;
  }
  .section-head-row:active {
    background: rgba(212,175,55,.06);
  }
  .section-head-row .section-num,
  .section-head-row .section-title,
  .section-head-row .section-sub {
    margin-bottom: 2px;
  }
  .sec-toggle {
    flex-shrink: 0;
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(212,175,55,.10);
    border: 1px solid rgba(212,175,55,.32);
    border-radius: 100px;
    color: #8a6e1f; font-size: 12px; font-weight: 600;
    padding: 8px 14px; letter-spacing: 0.04em;
    pointer-events: none; /* 헤더 row에 클릭 위임 */
    min-width: 76px; justify-content: center;
  }
  .sec-toggle .chev {
    display: inline-block; transition: transform .25s ease;
    font-size: 11px; line-height: 1;
  }
  .sec-toggle.collapsed .chev { transform: rotate(-90deg); }
  .section-body {
    overflow: hidden;
    transition: max-height .4s ease, opacity .3s ease;
    max-height: 10000px;
  }
  .section-body.collapsed {
    max-height: 0; opacity: 0;
  }

  /* 관계(인연) 도식 */
  .relation-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 8px; margin-top: 12px;
  }
  .rel-card {
    background: #fff; border-radius: 10px; padding: 10px 8px;
    border: 1px solid #E5DFD0; text-align: center;
  }
  .rel-card .rc-label { font-size: 9.5px; color: #7F6B4E; letter-spacing: 0.06em; font-weight: 600; }
  .rel-card .rc-glyph {
    font-family: 'Noto Serif KR', serif;
    font-size: 18px; font-weight: 700; margin: 4px 0;
  }
  .rel-card .rc-desc { font-size: 10.5px; color: #2a2520; line-height: 1.5; }
  .rel-card.boost .rc-glyph { color: #2e7d32; }
  .rel-card.clash .rc-glyph { color: #c62828; }
  .rel-card.calm  .rc-glyph { color: #1565c0; }

  /* 관계의 결 (六親) — 6카드 상세 */
  .rel6-list { display: flex; flex-direction: column; gap: 12px; margin: 14px 0; }
  .rel6-card {
    background: #fff; border: 1px solid #E5DFD0;
    border-left: 4px solid #7F6B4E;
    border-radius: 10px; padding: 14px 14px 12px;
  }
  .rel6-card.c-parent  { border-left-color: #1565c0; }
  .rel6-card.c-sibling { border-left-color: #2e7d32; }
  .rel6-card.c-spouse  { border-left-color: #c62828; }
  .rel6-card.c-child   { border-left-color: #7F6B4E; }
  .rel6-card.c-friend  { border-left-color: #757575; }
  .rel6-card.c-boss    { border-left-color: #5C4A2E; }

  .rel6-head {
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  }
  .rel6-name {
    font-family: 'Noto Serif KR', serif;
    font-size: 19px; font-weight: 700;
  }
  .rel6-card.c-parent  .rel6-name { color: #1565c0; }
  .rel6-card.c-sibling .rel6-name { color: #2e7d32; }
  .rel6-card.c-spouse  .rel6-name { color: #c62828; }
  .rel6-card.c-child   .rel6-name { color: #7F6B4E; }
  .rel6-card.c-friend  .rel6-name { color: #757575; }
  .rel6-card.c-boss    .rel6-name { color: #5C4A2E; }
  .rel6-label {
    font-size: 13px; color: #1a1a1a; font-weight: 600;
  }
  .rel6-tag {
    margin-left: auto;
    font-size: 10px; padding: 3px 10px;
    border-radius: 100px; font-weight: 600;
    letter-spacing: 0.02em;
  }
  .rel6-tag.t-warn  { background: rgba(198,40,40,.10); color: #c62828; }
  .rel6-tag.t-neut  { background: rgba(212,175,55,.16); color: #B8965A; }
  .rel6-tag.t-good  { background: rgba(46,125,50,.12); color: #2e7d32; }

  .rel6-summary {
    margin: 0 0 10px;
    font-size: 13px; color: #2a2520;
    line-height: 1.68; word-break: keep-all;
  }
  .rel6-summary strong {
    font-weight: 600; color: #1a1a1a;
    background: linear-gradient(180deg, transparent 62%, rgba(212,175,55,.22) 62%);
    padding: 0 2px;
  }

  .rel6-actions {
    display: flex; flex-direction: column; gap: 6px;
    margin-top: 10px;
    border-top: 1px dashed #E5DFD0;
    padding-top: 10px;
  }
  .rel6-do, .rel6-dont {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 8px 10px; border-radius: 8px;
    font-size: 12.5px; line-height: 1.58;
    color: #2a2520;
  }
  .rel6-do  { background: rgba(46,125,50,.07); }
  .rel6-dont{ background: rgba(198,40,40,.055); }
  .rel6-do .ic, .rel6-dont .ic {
    flex-shrink: 0; font-weight: 700;
    font-size: 11.5px; letter-spacing: 0.02em;
    padding: 1px 0;
  }
  .rel6-do   .ic { color: #2e7d32; }
  .rel6-dont .ic { color: #c62828; }
  .rel6-do   .txt strong,
  .rel6-dont .txt strong {
    font-weight: 700; color: #1a1a1a;
    background: none; padding: 0;
  }

  /* 10년 대운 카드 (현재 시기만 크게) */
  .now-daewoon {
    background: linear-gradient(135deg, rgba(212,175,55,.1), rgba(46,125,50,.04));
    border: 1px solid rgba(212,175,55,.35);
    border-radius: 12px;
    padding: 14px 14px 12px;
    margin: 12px 0 14px;
  }
  .now-daewoon .nd-head {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 10px;
  }
  .now-daewoon .nd-glyph {
    font-family: 'Noto Serif KR', serif;
    display: flex; flex-direction: column; align-items: center;
    padding: 8px 12px; border-radius: 10px;
    background: #fff; border: 1px solid rgba(212,175,55,.4);
    line-height: 1.1;
  }
  .now-daewoon .nd-glyph .g-gan { font-size: 20px; font-weight: 700; color: #2e7d32; }
  .now-daewoon .nd-glyph .g-ji  { font-size: 14px; color: #757575; }
  .now-daewoon .nd-info .nd-age { font-size: 11px; color: #B8965A; font-weight: 600; letter-spacing: 0.08em; }
  .now-daewoon .nd-info .nd-key { font-size: 14px; font-weight: 700; color: #1a1a1a; margin-top: 2px; font-family: 'Noto Serif KR', serif; }
  .now-daewoon .nd-row {
    display: grid; grid-template-columns: 70px 1fr;
    gap: 6px; font-size: 11.5px; padding: 4px 0;
    border-top: 1px dashed rgba(212,175,55,.3);
    color: #2a2520; line-height: 1.55;
  }
  .now-daewoon .nd-row .nd-label {
    color: #7F6B4E; font-weight: 500;
  }

  /* ═══════════════ V2.1 추가 ═══════════════ */

  /* 오행 레이더 차트 */
  .ohaeng-radar {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 12px;
    padding: 14px 12px 10px;
    margin: 12px 0;
    text-align: center;
  }
  .ohaeng-radar .or-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 4px; font-weight: 500; text-align: left;
  }
  .ohaeng-radar svg { width: 100%; max-width: 260px; height: 240px; }

  /* 오행별 인생의 결 카드 */
  .life-edge-list {
    display: flex; flex-direction: column;
    gap: 10px; margin: 14px 0;
  }
  .life-edge-card {
    border-radius: 12px;
    padding: 14px;
    border-left: 4px solid;
    background: linear-gradient(135deg, #fff 0%, #F8F5EE 100%);
  }
  .life-edge-card.mok  { border-left-color: #2e7d32; background: linear-gradient(135deg, #fff, rgba(46,125,50,.05)); }
  .life-edge-card.hwa  { border-left-color: #c62828; background: linear-gradient(135deg, #fff, rgba(198,40,40,.05)); }
  .life-edge-card.to   { border-left-color: #7F6B4E; background: linear-gradient(135deg, #fff, rgba(164,124,44,.06)); }
  .life-edge-card.geum { border-left-color: #757575; background: linear-gradient(135deg, #fff, rgba(117,117,117,.05)); }
  .life-edge-card.su   { border-left-color: #1565c0; background: linear-gradient(135deg, #fff, rgba(21,101,192,.05)); }
  .life-edge-card .le-head {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 6px;
  }
  .life-edge-card .le-glyph {
    font-family: 'Noto Serif KR', serif;
    font-size: 22px; font-weight: 700; line-height: 1;
  }
  .life-edge-card.mok .le-glyph  { color: #2e7d32; }
  .life-edge-card.hwa .le-glyph  { color: #c62828; }
  .life-edge-card.to  .le-glyph  { color: #7F6B4E; }
  .life-edge-card.geum .le-glyph { color: #757575; }
  .life-edge-card.su  .le-glyph  { color: #1565c0; }
  .life-edge-card .le-name {
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; font-weight: 700; color: #1a1a1a;
  }
  .life-edge-card .le-tag {
    margin-left: auto; font-size: 9.5px;
    padding: 2px 8px; border-radius: 100px;
    background: #E5DFD0; color: #5C4A2E; font-weight: 600;
  }
  .life-edge-card .le-tag.s { background: rgba(46,125,50,.12); color: #2e7d32; }
  .life-edge-card .le-tag.w { background: rgba(198,40,40,.10); color: #c62828; }
  .life-edge-card .le-desc {
    font-size: 12.5px; color: #2a2520; line-height: 1.65;
  }

  /* 십성 분류 헤더 */
  .sip-cluster {
    margin-top: 12px;
  }
  .sip-cluster-head {
    font-size: 10.5px; color: #B8965A;
    letter-spacing: 0.1em; font-weight: 700;
    margin: 12px 0 6px;
    padding-left: 6px;
    border-left: 2px solid #E8D9B8;
  }

  /* 십성 분포 도넛 */
  .sip-donut {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 12px;
    padding: 14px;
    margin: 12px 0;
    display: flex; align-items: center; gap: 16px;
  }
  .sip-donut .sd-svg { flex-shrink: 0; width: 100px; height: 100px; }
  .sip-donut .sd-legend {
    flex: 1; display: flex; flex-direction: column; gap: 4px;
    font-size: 11px;
  }
  .sip-donut .sd-row {
    display: grid; grid-template-columns: 12px 70px 1fr 28px;
    gap: 6px; align-items: center;
    color: #2a2520;
  }
  .sip-donut .sd-swatch {
    width: 10px; height: 10px; border-radius: 2px;
  }
  .sip-donut .sd-name { font-weight: 600; }
  .sip-donut .sd-bar { background: #E5DFD0; height: 4px; border-radius: 100px; }
  .sip-donut .sd-fill { height: 100%; border-radius: 100px; }
  .sip-donut .sd-pct { text-align: right; font-feature-settings: 'tnum'; color: #5C4A2E; }

  /* 대운 가로 시간선 */
  .daewoon-line {
    margin-top: 14px;
    background: #F8F5EE;
    border-radius: 10px;
    padding: 14px 14px 8px;
    border: 1px solid #E5DFD0;
    overflow: hidden;
  }
  .daewoon-line .dl-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 12px; font-weight: 500;
  }
  .daewoon-line .dl-bar {
    position: relative; height: 36px;
    background: linear-gradient(90deg,
      #cfd8dc 0%, #cfd8dc 12%,
      #E8D9B8 12%, #E8D9B8 25%,
      #2e7d32 50%, #2e7d32 62%,
      #E8D9B8 75%, #E8D9B8 87%,
      #cfd8dc 87%, #cfd8dc 100%);
    border-radius: 100px;
    margin: 14px 0 8px;
  }
  .daewoon-line .dl-mark {
    position: absolute; top: -10px;
    transform: translateX(-50%);
    background: #1a1a1a; color: #E8D9B8;
    padding: 3px 7px; border-radius: 100px;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.05em; white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0,0,0,.15);
  }
  .daewoon-line .dl-mark::after {
    content: ''; position: absolute;
    top: 100%; left: 50%; transform: translateX(-50%);
    border: 4px solid transparent; border-top-color: #1a1a1a;
  }
  .daewoon-line .dl-mark.peak { background: #2e7d32; color: #fff; }
  .daewoon-line .dl-mark.peak::after { border-top-color: #2e7d32; }
  .daewoon-line .dl-axis {
    display: flex; justify-content: space-between;
    font-size: 9px; color: #7F6B4E;
    padding: 0 2px;
  }

  /* 인생 단계 3카드 */
  .life-stage-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 6px; margin: 14px 0;
  }
  .life-stage-card {
    background: #fff; border-radius: 10px;
    padding: 12px 8px;
    border: 1px solid #E5DFD0;
    text-align: center;
    display: flex; flex-direction: column; gap: 4px;
  }
  .life-stage-card.now {
    background: linear-gradient(180deg, rgba(212,175,55,.12), rgba(212,175,55,.04));
    border-color: rgba(212,175,55,.4);
    box-shadow: 0 4px 10px rgba(212,175,55,.1);
  }
  .life-stage-card .ls-tag {
    font-size: 9px; color: #B8965A; font-weight: 700; letter-spacing: 0.1em;
  }
  .life-stage-card .ls-age {
    font-family: 'Noto Serif KR', serif;
    font-size: 13px; font-weight: 700; color: #1a1a1a;
  }
  .life-stage-card .ls-key {
    font-size: 10.5px; color: #2a2520; line-height: 1.45;
    margin-top: 2px;
  }
  .life-stage-card .ls-glyph {
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; color: #B8965A; margin-top: 2px;
  }

  /* 12개월 인사이트 */
  .month-insight-grid {
    margin-top: 12px;
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 12px;
    padding: 12px;
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    font-size: 10.5px;
  }
  .month-insight-grid .mi {
    padding: 8px 8px 7px;
    background: #F8F5EE; border-radius: 8px;
    border-left: 2px solid #E5DFD0;
    line-height: 1.45; color: #2a2520;
  }
  .month-insight-grid .mi .mi-num {
    display: block;
    font-family: 'Noto Serif KR', serif;
    font-size: 11px; font-weight: 700; color: #B8965A;
    margin-bottom: 2px;
  }
  .month-insight-grid .mi.up   { border-left-color: #2e7d32; }
  .month-insight-grid .mi.up .mi-num   { color: #2e7d32; }
  .month-insight-grid .mi.peak { border-left-color: #2e7d32; background: rgba(46,125,50,.06); }
  .month-insight-grid .mi.peak .mi-num { color: #2e7d32; }
  .month-insight-grid .mi.warn { border-left-color: #c62828; background: rgba(198,40,40,.05); }
  .month-insight-grid .mi.warn .mi-num { color: #c62828; }
  .month-insight-grid .mi.now  {
    border-left-color: #E8D9B8;
    background: rgba(212,175,55,.1);
  }
  .month-insight-grid .mi.now .mi-num  { color: #B8965A; }

  /* 신살 v2.1 — 강/중/참고 위계 */
  .shinsal-meta {
    display: flex; gap: 6px; align-items: center;
    margin-top: 6px;
  }
  .shinsal-meta .sm-pulse {
    display: inline-flex; gap: 2px;
  }
  .shinsal-meta .sm-pulse span {
    width: 4px; height: 10px; border-radius: 1px;
    background: #E5DFD0;
  }
  .shinsal-meta .sm-pulse span.on { background: #B8965A; }
  .shinsal-meta .sm-when {
    font-size: 9.5px; color: #7F6B4E;
    padding: 2px 7px; border-radius: 100px;
    background: #F8F5EE;
    border: 1px solid #E5DFD0;
    letter-spacing: 0.03em;
  }
  .shinsal-meta .sm-when.always { color: #2e7d32; border-color: rgba(46,125,50,.3); background: rgba(46,125,50,.06); }
  .shinsal-meta .sm-when.dae    { color: #B8965A; border-color: rgba(184,148,31,.4); background: rgba(184,148,31,.08); }
  .shinsal-meta .sm-when.year   { color: #1565c0; border-color: rgba(21,101,192,.3); background: rgba(21,101,192,.06); }
  .shinsal-meta .sm-when.dorm   { color: #5C4A2E; }

  /* 보조(중) 신살 카드 — 더 컴팩트 */
  .shinsal-card.mid { padding: 10px 12px; }
  .shinsal-card.mid p { font-size: 11.5px; }
  .shinsal-card.mid .adv { padding-top: 6px; margin-top: 6px; }

  /* 참고 신살 뱃지 */
  .shinsal-refs {
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-top: 12px;
    padding: 12px;
    background: #F8F5EE;
    border-radius: 10px;
    border: 1px dashed #E5DFD0;
  }
  .shinsal-refs .sr-title {
    width: 100%; font-size: 10.5px; color: #5C4A2E;
    font-weight: 600; letter-spacing: 0.05em;
    margin-bottom: 2px;
  }
  .shinsal-refs .sr-tag {
    font-size: 11px;
    padding: 4px 10px; border-radius: 100px;
    background: #fff; color: #2a2520;
    border: 1px solid #E5DFD0;
    display: inline-flex; gap: 6px; align-items: baseline;
  }
  .shinsal-refs .sr-tag .sr-han {
    font-family: 'Noto Serif KR', serif;
    font-size: 10px; color: #B8965A;
  }
  .shinsal-refs .sr-tag .sr-note {
    font-size: 9.5px; color: #7F6B4E;
  }
</style>
</head>
<body>
<div class="page-wrap">

  <!-- ═════════════ HEADER (Sticky) ═════════════ -->
  <header class="header">
    <div class="back">←</div>
    <div class="meta">
      <div class="title">변준기 님의 사주 풀이</div>
      <div class="sub">PREMIUM · 10섹션 종합 풀이</div>
    </div>
    <div class="badge">10운</div>
  </header>

  <!-- ═════════════ HERO 인물 카드 ═════════════ -->
  <section class="hero">
    <div class="hero-card">
      <div class="person">변준기</div>
      <div class="birth">1995년 5월 12일 (양력) · 묘시(05:30~07:30)</div>
      <div class="ilgan">
        <span class="hanja">甲</span>
        <span class="label">일간 갑(甲) · 양목(陽木)</span>
      </div>
      <div class="meta">
        <span>🌳 큰 나무의 기운</span>
        <span>·</span>
        <span>봄의 끝자락</span>
        <span>·</span>
        <span>2026.04.20 풀이</span>
      </div>
    </div>
  </section>

  <div class="content">

    <!-- ═════════════ 1. 원국 ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 01</div>
      <div class="section-title">원국 <span class="hanja">原局</span></div>
      <div class="section-sub">태어난 순간 하늘과 땅이 그려낸 여덟 글자</div>

      <div class="wongug">
        <div class="wongug-table">
          <div></div>
          <div class="col-header">시주</div>
          <div class="col-header">일주</div>
          <div class="col-header">월주</div>
          <div class="col-header">연주</div>

          <div class="row-label">천간</div>
          <div class="wongug-cell">
            <div class="sip-tag">정재</div>
            <div class="glyph to">己</div><div class="yum">기 / 음토</div>
          </div>
          <div class="wongug-cell ilju">
            <div class="sip-tag">일간</div>
            <div class="glyph mok">甲</div><div class="yum">갑 / 양목 (나)</div>
          </div>
          <div class="wongug-cell">
            <div class="sip-tag">정관</div>
            <div class="glyph geum">辛</div><div class="yum">신 / 음금</div>
          </div>
          <div class="wongug-cell">
            <div class="sip-tag">겁재</div>
            <div class="glyph mok">乙</div><div class="yum">을 / 음목</div>
          </div>

          <div class="row-label">지지</div>
          <div class="wongug-cell">
            <div class="sip-tag">겁재</div>
            <div class="glyph mok">卯</div><div class="yum">묘 / 음목</div>
          </div>
          <div class="wongug-cell ilju">
            <div class="sip-tag">상관</div>
            <div class="glyph hwa">午</div><div class="yum">오 / 양화</div>
          </div>
          <div class="wongug-cell">
            <div class="sip-tag">식신</div>
            <div class="glyph hwa">巳</div><div class="yum">사 / 양화</div>
          </div>
          <div class="wongug-cell">
            <div class="sip-tag">편인</div>
            <div class="glyph su">亥</div><div class="yum">해 / 음수</div>
          </div>
        </div>

        <div class="ohaeng-chart">
          <div class="title">오행 분포 (8글자 기준)</div>
          <div class="ohaeng-bar o-mok">
            <span class="o-label">木</span>
            <div class="o-track"><div class="o-fill" style="width: 37.5%"></div></div>
            <span class="o-count">3</span>
          </div>
          <div class="ohaeng-bar o-hwa">
            <span class="o-label">火</span>
            <div class="o-track"><div class="o-fill" style="width: 25%"></div></div>
            <span class="o-count">2</span>
          </div>
          <div class="ohaeng-bar o-to">
            <span class="o-label">土</span>
            <div class="o-track"><div class="o-fill" style="width: 12.5%"></div></div>
            <span class="o-count">1</span>
          </div>
          <div class="ohaeng-bar o-geum">
            <span class="o-label">金</span>
            <div class="o-track"><div class="o-fill" style="width: 12.5%"></div></div>
            <span class="o-count">1</span>
          </div>
          <div class="ohaeng-bar o-su">
            <span class="o-label">水</span>
            <div class="o-track"><div class="o-fill" style="width: 12.5%"></div></div>
            <span class="o-count">1</span>
          </div>
        </div>

        <div class="yin-yang-card">
          <div class="yy-title">음양 균형</div>
          <div class="yy-bar">
            <div class="yang" style="width: 62.5%">양 5</div>
            <div class="yin" style="width: 37.5%">음 3</div>
          </div>
          <div class="yy-caption">양이 다섯, 음이 셋. 움직이는 힘이 앞서고 가라앉히는 힘이 뒤따르는 구조입니다.</div>
        </div>

        <div class="ohaeng-diag">
          <div class="od-cell strong">
            <div class="od-han mok">木</div>
            <div class="od-dots"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span></div>
            <div class="od-label s">태과</div>
          </div>
          <div class="od-cell">
            <div class="od-han hwa">火</div>
            <div class="od-dots"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span></div>
            <div class="od-label">중</div>
          </div>
          <div class="od-cell weak">
            <div class="od-han to">土</div>
            <div class="od-dots"><span class="on"></span><span class="on"></span><span></span><span></span><span></span></div>
            <div class="od-label w">약</div>
          </div>
          <div class="od-cell weak">
            <div class="od-han geum">金</div>
            <div class="od-dots"><span class="on"></span><span></span><span></span><span></span><span></span></div>
            <div class="od-label w">미</div>
          </div>
          <div class="od-cell weak">
            <div class="od-han su">水</div>
            <div class="od-dots"><span class="on"></span><span></span><span></span><span></span><span></span></div>
            <div class="od-label w">미</div>
          </div>
        </div>

        <!-- 오행 레이더 차트 -->
        <div class="ohaeng-radar">
          <div class="or-title">오행 레이더 — 한눈에 보는 균형도 <span style="color:#a08a5a; font-weight:400;">· 바깥 = 5자 · 안쪽 = 0자</span></div>
          <svg viewBox="0 0 260 240" xmlns="http://www.w3.org/2000/svg">
            <!-- 동심오각형(1·2·3·4·5 눈금) -->
            <g fill="none" stroke="#E5DFD0" stroke-width="1">
              <polygon points="130,40 215,100 183,200 77,200 45,100" />
              <polygon points="130,57 198,111 172,191 88,191 62,111" />
              <polygon points="130,75 180,123 161,183 99,183 80,123" />
              <polygon points="130,93 163,134 150,174 110,174 97,134" />
              <polygon points="130,110 146,146 140,166 120,166 114,146" />
            </g>
            <!-- 축선(중심→꼭짓점) -->
            <g stroke="#E5DFD0" stroke-width="0.8">
              <line x1="130" y1="128" x2="130" y2="40" />
              <line x1="130" y1="128" x2="215" y2="100" />
              <line x1="130" y1="128" x2="183" y2="200" />
              <line x1="130" y1="128" x2="77"  y2="200" />
              <line x1="130" y1="128" x2="45"  y2="100" />
            </g>
            <!-- 데이터 폴리곤: 木3 火2 土1 金1 水1 (max=5, r_axis=88) -->
            <!-- 木 r=52.8, 火 r=35.2, 土 r=17.6, 金 r=17.6, 水 r=17.6 -->
            <polygon points="130,75.2 163.5,117.1 140.3,142.2 119.7,142.2 113.3,122.6"
                     fill="rgba(212,175,55,0.18)"
                     stroke="#E8D9B8" stroke-width="1.6"/>
            <!-- 데이터 점 -->
            <circle cx="130"   cy="75.2"  r="3.5" fill="#2e7d32"/>
            <circle cx="163.5" cy="117.1" r="3.5" fill="#c62828"/>
            <circle cx="140.3" cy="142.2" r="3.5" fill="#7F6B4E"/>
            <circle cx="119.7" cy="142.2" r="3.5" fill="#757575"/>
            <circle cx="113.3" cy="122.6" r="3.5" fill="#1565c0"/>
            <!-- 오행 라벨 -->
            <g font-family="'Noto Serif KR', serif" font-size="13" font-weight="700">
              <text x="130" y="28"  text-anchor="middle" fill="#2e7d32">木</text>
              <text x="225" y="103" text-anchor="middle" fill="#c62828">火</text>
              <text x="190" y="218" text-anchor="middle" fill="#7F6B4E">土</text>
              <text x="70"  y="218" text-anchor="middle" fill="#757575">金</text>
              <text x="35"  y="103" text-anchor="middle" fill="#1565c0">水</text>
            </g>
            <!-- 데이터 값 라벨 -->
            <g font-family="-apple-system, sans-serif" font-size="9.5" fill="#a08a5a" font-weight="700">
              <text x="130"   y="75.2"  dx="7"  dy="-3">3</text>
              <text x="163.5" y="117.1" dx="7"  dy="0">2</text>
              <text x="140.3" y="142.2" dx="6"  dy="0">1</text>
              <text x="119.7" y="142.2" dx="-12" dy="0">1</text>
              <text x="113.3" y="122.6" dx="-12" dy="0">1</text>
            </g>
          </svg>
        </div>
      </div>

      <p>
        준기 님의 일간은 <strong>갑(甲)</strong>입니다. <span class="han">甲</span>은 봄 새벽에 곧게 뻗는 큰 나무의 상(象)입니다. 흔들리지 않으려 뿌리부터 다잡는 사람의 기운. 크게 목소리를 내지 않아도 옆에 있는 사람이 "이 사람은 자기만의 결이 있구나" 하고 느끼게 만드는, 그런 결을 타고납니다.
      </p>
      <p>
        태어난 달이 <strong>사월(巳月)</strong>이라 발아래에는 한낮의 불기운이 밝게 깔려 있습니다. 나무가 봄에 잎을 펼치고 여름으로 성큼 들어가려는 시기. 그래서 준기 님 사주에는 <strong>"성장하고 싶다, 그리고 그 성장을 누가 알아주기를 바란다"</strong>는 마음이 강하게 흐릅니다. 묵묵히 일만 하는 유형이 아니라, 결과가 빛이 되어 되돌아오기를 바라는 사람입니다.
      </p>
      <p>
        다만 한 가지 짚어두어야 할 점이 있습니다. 여덟 글자에 <strong>나무가 세 개(甲·乙·卯)</strong>나 자리합니다. 같은 결의 존재들이 한 숲에 모여 있는 형국이라 든든한 동시에 답답할 수 있습니다. <span class="han">水</span>가 한 글자(亥)뿐이라 뿌리에 주는 물이 부족하고, <span class="han">金</span>도 한 글자라 가지를 다듬어줄 도구가 얇습니다. 그래서 준기 님은 <strong>혼자 다 짊어지려 하는 경향</strong>이 자연스럽게 생깁니다. 이 부분은 뒤 섹션에서 다시 다루겠습니다.
      </p>

      <div class="pullquote">
        <p>곧게 자란 나무 한 그루. 빛은 충분한데 물과 칼이 부족해, 키는 큰데 모양은 거칠게 자란다.</p>
      </div>

      <!-- 오행별 인생의 결 5카드 -->
      <h4 style="font-family: 'Noto Serif KR', serif; font-size: 14px; color: #1a1a1a; font-weight: 700; margin: 22px 0 4px; letter-spacing: 0.02em;">오행별 인생의 결 — 나에게 뭐가 있고 뭐가 비는가</h4>
      <p style="font-size: 11.5px; color: #5C4A2E; margin: 0 0 10px;">각 오행이 준기 님에게 어떻게 작동하는지 · <strong>✓ 살릴 것</strong> / <strong>⚠ 조심할 것</strong>로 못 박아둡니다</p>

      <div class="life-edge-list">
        <div class="life-edge-card mok">
          <div class="le-head">
            <span class="le-glyph">木</span>
            <span class="le-name">나무 — 주체성 · 성장 욕구</span>
            <span class="le-tag s">태과 · 3자</span>
          </div>
          <div class="le-desc">
            <strong style="color:#2e7d32;">준기 님은 "스스로 결정하고 스스로 걷는 사람"입니다.</strong> 甲·乙·卯 셋이 함께 서 있어 주체성이 남들보다 확실히 두껍습니다. 지금까지 살면서 <strong>"남이 시키는 대로 하는 게 가장 힘들었다"</strong>는 감각이 분명히 있었을 겁니다.<br><br>
            <strong style="color:#2e7d32;">✓ 살릴 것</strong> — 본인이 결정 주도권을 쥐는 자리. 1인 프로젝트·창업·프리랜서는 사주가 밀어줍니다.<br>
            <strong style="color:#c62828;">⚠ 조심할 것</strong> — 같은 결의 사람이 많아 <strong>동업·공동창업은 반드시 지분·의사결정 구조를 먼저 못 박아야</strong> 깨집니다. 그냥 하면 깨져요.
          </div>
        </div>

        <div class="life-edge-card hwa">
          <div class="le-head">
            <span class="le-glyph">火</span>
            <span class="le-name">불 — 표현력 · 드러나는 힘</span>
            <span class="le-tag">중 · 2자</span>
          </div>
          <div class="le-desc">
            <strong style="color:#c62828;">준기 님의 가장 큰 무기입니다.</strong> 巳·午가 일간 갑(甲)을 정면에서 비춥니다. 말·글·영상·강의 — 드러내는 영역에서 같은 노력으로 남보다 2배의 효과가 납니다.<br><br>
            <strong style="color:#2e7d32;">✓ 살릴 것</strong> — 직업·사업의 축에 반드시 "드러내는 채널"이 들어가 있어야 합니다. 뒷작업만 하는 자리에 가면 재능이 새요.<br>
            <strong style="color:#c62828;">⚠ 조심할 것</strong> — 불이 많아 <strong>감정 기복이 또렷</strong>합니다. 화가 올라오는 날은 중요한 결정을 다음 날로 미루세요.
          </div>
        </div>

        <div class="life-edge-card to">
          <div class="le-head">
            <span class="le-glyph">土</span>
            <span class="le-name">흙 — 재물 · 자리잡는 힘</span>
            <span class="le-tag w">약 · 1자</span>
          </div>
          <div class="le-desc">
            <strong style="color:#7F6B4E;">돈이 "벌리는 재능"은 있는데 "쌓이는 자리"가 얇습니다.</strong> 己 하나로 재물을 받치고 있어, 벌어도 빠르게 빠져나가는 패턴을 이미 경험했을 겁니다.<br><br>
            <strong style="color:#2e7d32;">✓ 살릴 것</strong> — <strong>자동이체·적립식 계좌·고정비 축소</strong> 같은 '시스템 저축'을 반드시 설계하세요. 의지로 안 됩니다, 구조로만 됩니다.<br>
            <strong style="color:#c62828;">⚠ 조심할 것</strong> — 30대에는 큰 부동산·큰 투자를 미루는 편이 맞습니다. 41~50세 병술(丙戌) 대운에 土가 두꺼워집니다. 그때 한 번에 굳히세요.
          </div>
        </div>

        <div class="life-edge-card geum">
          <div class="le-head">
            <span class="le-glyph">金</span>
            <span class="le-name">쇠 — 다듬기 · 절제 · 원칙</span>
            <span class="le-tag w">미 · 1자</span>
          </div>
          <div class="le-desc">
            <strong style="color:#757575;">이게 준기 님 사주의 가장 큰 약점입니다.</strong> 辛 하나 — 나무 셋을 다듬기엔 턱없이 부족한 칼입니다. <strong>"일을 여러 개 동시에 벌여놓고 하나도 제대로 못 끝낸 적"</strong>이 있었다면 재능 문제가 아니라 이것 때문입니다.<br><br>
            <strong style="color:#2e7d32;">✓ 살릴 것</strong> — <strong>외부 규율(마감·계약·코치·발표일)</strong>을 의도적으로 설치하세요. 스스로 짜는 마감은 거의 지켜지지 않습니다. 약속해버리면 됩니다.<br>
            <strong style="color:#c62828;">⚠ 조심할 것</strong> — "하고 싶은 것"을 줄이는 게 평생 과제입니다. 하나를 끝낼 때까지 다음 것은 시작하지 마세요.
          </div>
        </div>

        <div class="life-edge-card su">
          <div class="le-head">
            <span class="le-glyph">水</span>
            <span class="le-name">물 — 쉼 · 회복 · 지혜</span>
            <span class="le-tag w">미 · 1자</span>
          </div>
          <div class="le-desc">
            <strong style="color:#1565c0;">가장 중요한 보급선인데 가장 얇습니다.</strong> 亥 하나로 세 그루의 나무를 먹이고 있어, 번아웃이 또렷하게 반복될 사주입니다. 이미 한두 번 크게 지쳐본 적이 있을 겁니다.<br><br>
            <strong style="color:#2e7d32;">✓ 살릴 것</strong> — <strong>'안 하는 시간'을 캘린더에 먼저 박을 것.</strong> 분기마다 2박 이상의 온전한 휴식. 즉흥으로 두면 절대 만들어지지 않습니다.<br>
            <strong style="color:#c62828;">⚠ 조심할 것</strong> — "괜찮다, 좀 더 할 수 있다"는 감각을 신뢰하지 마세요. 물이 얇은 사주는 본인이 고갈된 줄도 모르고 달려가다 한 번에 무너집니다.
          </div>
        </div>
      </div>

      <!-- 원국 섹션 요약 (핵심 결론) -->
      <div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론</div>
        <p>
          준기 님은 <strong>목(木)이 많고 금(金)·수(水)가 부족한 "가지 많은 나무"</strong>입니다. 재능·주체성·표현력은 사주가 다 챙겨주지만, <strong>다듬는 칼(마감·규율)과 뿌리에 물을 대는 쉼</strong>은 본인이 구조로 설계해두어야 합니다. 재능보다 '브레이크'를 먼저 다는 사주입니다.
        </p>
      </div>
    </section>

    <div class="divider"><span class="han">天 干 地 支</span></div>

    <!-- ═════════════ 2. 천간지지 해석 ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 02</div>
      <div class="section-title">천간지지 <span class="hanja">天干地支</span></div>
      <div class="section-sub">위로 드러난 마음과 아래에 깔린 본능</div>

      <p>
        천간(天干)은 마음이고, 지지(地支)는 행동입니다. 사람들에게 보여지는 모습과, 실제로 하루를 굴리는 본능이 서로 다른 자리에 놓입니다.
      </p>

      <div class="ganji-flow">
        <div class="gf-title">사주에 새겨진 글자 간 관계</div>
        <div class="gf-row">
          <span class="gf-glyph" style="color:#7F6B4E">己</span>
          <span class="gf-arrow">↔</span>
          <span class="gf-glyph" style="color:#2e7d32">甲</span>
          <span style="color:#5C4A2E">갑기합(甲己合) — 정재가 가까이 붙은 자리</span>
          <span class="gf-type hap">합</span>
        </div>
        <div class="gf-row">
          <span class="gf-glyph" style="color:#c62828">巳</span>
          <span class="gf-arrow">↔</span>
          <span class="gf-glyph" style="color:#1565c0">亥</span>
          <span style="color:#5C4A2E">사해충(巳亥沖) — 빛과 물이 부딪히는 자리</span>
          <span class="gf-type chung">충</span>
        </div>
        <div class="gf-row">
          <span class="gf-glyph" style="color:#c62828">午</span>
          <span class="gf-arrow">↔</span>
          <span class="gf-glyph" style="color:#c62828">午</span>
          <span style="color:#5C4A2E">자형(自刑) — 자기 자신과 부딪히는 자리</span>
          <span class="gf-type hyeong">형</span>
        </div>
        <div class="gf-row">
          <span class="gf-glyph" style="color:#2e7d32">卯</span>
          <span class="gf-arrow">+</span>
          <span class="gf-glyph" style="color:#1565c0">亥</span>
          <span style="color:#5C4A2E">묘해(卯亥) 반합 — 멀리서 물이 나무에 닿는 자리</span>
          <span class="gf-type hap">합</span>
        </div>
      </div>

      <p>
        준기 님 천간 줄은 <strong>己 甲 辛 乙</strong> — 토·목·금·목입니다. 갑(甲)인 준기 님이 가운데에 자리하고, 그 옆으로 <strong>己(기)</strong>라는 작은 흙이 가까이 얹혀 있습니다. 명리에서 <strong>'갑기합(甲己合)'</strong>이라 부르는 자리. <span class="han">己</span>는 정재(正財), 즉 <strong>안정·약속·내 사람</strong>을 뜻하는 글자입니다. 천간에 짝이 가까이 와 있다는 것은, 준기 님이 본능적으로 <strong>책임지고 싶은 대상</strong>을 곁에 두려 한다는 신호입니다. 일이 됐든 사람이 됐든, "내가 끌고 가야지" 하고 손을 뻗는 사람입니다.
      </p>
      <p>
        지지 줄은 <strong>卯 午 巳 亥</strong>. 발밑이 봄 늦은 시각의 들판입니다. <strong>巳午(사오)</strong>가 나란히 붙어 한낮의 불이 강하게 타오르고, 시지의 <strong>卯(묘)</strong>가 그 불에 땔감을 계속 넣어주는 모양입니다. 행동력이 폭발적이지만, <strong>한 번 시작하면 멈추기 어려운 패턴</strong>이 여기서 비롯됩니다. 일주일을 몰아치고 주말에 무너지는 식의 리듬을 자주 겪는다면, 게으름이 아니라 사주 구조가 그렇게 짜여 있기 때문입니다.
      </p>
      <p>
        연주의 <strong>亥(해)</strong>는 외로이 떨어져 있는 한 줌의 물입니다. 어릴 적 환경에서 받은 <strong>물 한 컵</strong>이라 보아도 좋습니다. 멀리 있어 평소에는 잊고 살지만, 진짜 지칠 때 본가·고향·오래된 친구 같은 곳에서 길어 마시는 한 모금이 되어 줍니다. 사주에서 가장 약한 자리이면서, 동시에 가장 귀한 자리입니다.
      </p>
      <p>
        한 가지 더. 위 도식에 표시된 <strong>사해충(巳亥沖)</strong>은 월지와 연지가 마주 부딪히는 자리입니다. 명리 고서에서는 <strong>"멀리서 출발한 물이 한낮의 불에 닿는 형국"</strong>이라 풀이합니다. 본가·고향과 본인의 일터·일상이 자주 부딪히는 결을 의미합니다. 가족과 본인의 방향이 어긋난다고 느낀 적이 잦았다면, 이것이 그 글자입니다.
      </p>

      <!-- 천간지지 섹션 요약 -->
      <div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론 — 그래서 뭘 얻고 뭘 해야 하나</div>
        <p><span class="sc-num">①</span> <strong>"내가 끌고 가야지"의 본능</strong>(갑기합)이 평생 작동합니다. <strong>책임져야 할 대상은 '한두 개'로 의도적으로 좁혀야</strong> 본인이 무너지지 않습니다. 다 책임지려다 다 놓칩니다.</p>
        <p><span class="sc-num">②</span> <strong>몰아치고 무너지는 리듬</strong>(巳午+卯 땔감 구조)은 게으름이 아니라 사주 구조입니다. <strong>주 5일 풀가동 → 주말 방전 패턴을 바꿔 "6일 스프린트 + 1일 완전 오프" 리듬으로 재설계</strong>하세요.</p>
        <p><span class="sc-num">③</span> <strong>가족·본가와 일·일상이 부딪히는 결</strong>(사해충)이 원국에 박혀 있습니다. 이 갈등은 사라지지 않습니다. <strong>거리(물리적·대화 빈도)를 먼저 설계</strong>하고 중요한 결정은 본가와 분리해서 내리세요.</p>
      </div>
    </section>

    <div class="divider"><span class="han">十 神</span></div>

    <!-- ═════════════ 3. 십성 ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 03</div>
      <div class="section-title">십성 <span class="hanja">十神</span></div>
      <div class="section-sub">관계와 욕망을 그리는 열 개의 키</div>

      <p>
        십성(十神)은 사주가 사람의 욕망과 관계를 풀어내는 언어입니다. 다섯 무리(<strong>비겁·식상·재성·관성·인성</strong>)로 묶이며, 준기 님 사주에서는 <strong>식상</strong>이 가장 두텁습니다.
      </p>

      <!-- 십성 분포 도넛 -->
      <div class="sip-donut">
        <svg class="sd-svg" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <!-- 도넛 5조각: 식상 39 / 비겁 22 / 재성 17 / 관성 11 / 인성 11 -->
          <circle cx="18" cy="18" r="15.915" fill="#fff" stroke="#E5DFD0" stroke-width="3.6"/>
          <!-- 식상 39% (시작 0) -->
          <circle cx="18" cy="18" r="15.915" fill="transparent"
                  stroke="#c62828" stroke-width="3.6"
                  stroke-dasharray="39 61" stroke-dashoffset="25"/>
          <!-- 비겁 22% (시작 39) -->
          <circle cx="18" cy="18" r="15.915" fill="transparent"
                  stroke="#2e7d32" stroke-width="3.6"
                  stroke-dasharray="22 78" stroke-dashoffset="-14"/>
          <!-- 재성 17% (시작 61) -->
          <circle cx="18" cy="18" r="15.915" fill="transparent"
                  stroke="#7F6B4E" stroke-width="3.6"
                  stroke-dasharray="17 83" stroke-dashoffset="-36"/>
          <!-- 관성 11% (시작 78) -->
          <circle cx="18" cy="18" r="15.915" fill="transparent"
                  stroke="#757575" stroke-width="3.6"
                  stroke-dasharray="11 89" stroke-dashoffset="-53"/>
          <!-- 인성 11% (시작 89) -->
          <circle cx="18" cy="18" r="15.915" fill="transparent"
                  stroke="#1565c0" stroke-width="3.6"
                  stroke-dasharray="11 89" stroke-dashoffset="-64"/>
          <text x="18" y="20" text-anchor="middle" font-size="5" fill="#1a1a1a" font-weight="700" font-family="'Noto Serif KR', serif">十神</text>
        </svg>
        <div class="sd-legend">
          <div class="sd-row"><span class="sd-swatch" style="background:#c62828"></span><span class="sd-name">식상</span><span class="sd-bar"><span class="sd-fill" style="width:39%; background:#c62828; display:block;"></span></span><span class="sd-pct">39%</span></div>
          <div class="sd-row"><span class="sd-swatch" style="background:#2e7d32"></span><span class="sd-name">비겁</span><span class="sd-bar"><span class="sd-fill" style="width:22%; background:#2e7d32; display:block;"></span></span><span class="sd-pct">22%</span></div>
          <div class="sd-row"><span class="sd-swatch" style="background:#7F6B4E"></span><span class="sd-name">재성</span><span class="sd-bar"><span class="sd-fill" style="width:17%; background:#7F6B4E; display:block;"></span></span><span class="sd-pct">17%</span></div>
          <div class="sd-row"><span class="sd-swatch" style="background:#757575"></span><span class="sd-name">관성</span><span class="sd-bar"><span class="sd-fill" style="width:11%; background:#757575; display:block;"></span></span><span class="sd-pct">11%</span></div>
          <div class="sd-row"><span class="sd-swatch" style="background:#1565c0"></span><span class="sd-name">인성</span><span class="sd-bar"><span class="sd-fill" style="width:11%; background:#1565c0; display:block;"></span></span><span class="sd-pct">11%</span></div>
        </div>
      </div>

      <!-- 식상 — 가장 두꺼운 무리 -->
      <div class="sip-cluster">
        <div class="sip-cluster-head">食 傷 · 표현하고 산출하는 결</div>
        <div class="sipseong-grid">
          <div class="sip-card">
            <div class="top"><span class="name">상관</span><span class="han">傷官</span></div>
            <div class="desc">일지 오(午)에서 나옵니다. <strong>창의·표현·말의 힘</strong>. 직장이나 위계 안에서는 종종 잔소리처럼 들려 오해를 사기도 합니다.</div>
            <div class="strength"><span class="on"></span><span class="on"></span><span class="on"></span><span class="on"></span><span></span></div>
            <div class="s-label">강도 4 / 5 · 강함</div>
          </div>
          <div class="sip-card">
            <div class="top"><span class="name">식신</span><span class="han">食神</span></div>
            <div class="desc">월지 사(巳)에서 비롯합니다. <strong>지속·전문성·꾸준한 산출</strong>. 한 분야를 길게 파고드는 힘이 됩니다.</div>
            <div class="strength"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span></div>
            <div class="s-label">강도 3 / 5 · 중상</div>
          </div>
        </div>
      </div>

      <!-- 비겁 -->
      <div class="sip-cluster">
        <div class="sip-cluster-head">比 劫 · 자기를 지키는 결</div>
        <div class="sipseong-grid">
          <div class="sip-card">
            <div class="top"><span class="name">겁재</span><span class="han">劫財</span></div>
            <div class="desc">을(乙)과 묘(卯). <strong>자기 결을 지키는 힘</strong>이자 동시에 <strong>경쟁·재물의 이탈</strong>로 이어지는 자리입니다. 동업·금전 거래에서 특히 주의가 필요합니다.</div>
            <div class="strength"><span class="on"></span><span class="on"></span><span class="on"></span><span class="on"></span><span></span></div>
            <div class="s-label">강도 4 / 5 · 강함</div>
          </div>
        </div>
      </div>

      <!-- 재성 -->
      <div class="sip-cluster">
        <div class="sip-cluster-head">財 星 · 갖추는 결</div>
        <div class="sipseong-grid">
          <div class="sip-card">
            <div class="top"><span class="name">정재</span><span class="han">正財</span></div>
            <div class="desc">천간의 기(己). <strong>꾸준한 수익·내 사람·약속</strong>. 가까이에 자리해 든든하지만, 이를 지키려 무리하기 쉽습니다.</div>
            <div class="strength"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span></div>
            <div class="s-label">강도 3 / 5 · 중상</div>
          </div>
        </div>
      </div>

      <!-- 관성 -->
      <div class="sip-cluster">
        <div class="sip-cluster-head">官 星 · 평가받고 책임지는 결</div>
        <div class="sipseong-grid">
          <div class="sip-card">
            <div class="top"><span class="name">정관</span><span class="han">正官</span></div>
            <div class="desc">월간 신(辛). 작지만 또렷한 <strong>규율·체면·평가</strong>. 준기 님은 타인이 평가하는 자리에 약간 예민한 편입니다.</div>
            <div class="strength"><span class="on"></span><span class="on"></span><span></span><span></span><span></span></div>
            <div class="s-label">강도 2 / 5 · 약</div>
          </div>
        </div>
      </div>

      <!-- 인성 -->
      <div class="sip-cluster">
        <div class="sip-cluster-head">印 星 · 받아들이고 익히는 결</div>
        <div class="sipseong-grid">
          <div class="sip-card">
            <div class="top"><span class="name">편인</span><span class="han">偏印</span></div>
            <div class="desc">연지 해(亥). <strong>직관·상상·외부 지식</strong>의 글자. 책·여행·낯선 사람과의 대화에서 영감을 얻는 결입니다.</div>
            <div class="strength"><span class="on"></span><span class="on"></span><span></span><span></span><span></span></div>
            <div class="s-label">강도 2 / 5 · 약</div>
          </div>
        </div>
      </div>

      <p>
        이 여섯 글자가 한 사주 안에 같이 있다는 것은, 준기 님이 <strong>"창의적으로 일하면서도 평가받고 싶고, 책임지고 싶으면서도 자기 결은 지키고 싶은"</strong> 사람이라는 뜻입니다. 한쪽으로 치우치지 않으니 다재다능해 보이지만, 본인 입장에서는 <strong>매일 여러 욕망이 동시에 잡아당기는</strong> 피곤함이 있습니다.
      </p>
      <p>
        특히 <strong>상관과 정관이 같이 있는 구조</strong>는 명리에서 자주 다루어지는 자리입니다. 옛 책에서는 "상관견관(傷官見官)" — 표현하고 싶은 마음과 규율이 부딪히는 자리라 하였습니다. 준기 님이 직장 안에서 답답함을 자주 느낀다면, 능력 부족이 아니라 <strong>구조적으로 충돌이 짜여 있는</strong> 문제입니다. 이 글자가 도리어 본인의 사업이나 1인 프로젝트에서는 가장 큰 무기가 됩니다.
      </p>
      <p>
        <strong>겁재가 강한 사주</strong>의 특성도 짚어두겠습니다. 같은 결의 사람이 옆에 많아 든든해 보이지만, 정재(돈·약속)를 빼앗아가는 자리이기도 합니다. <strong>형제·친구·동업자와 금전을 섞을 때 가장 큰 손실이 일어납니다. 이건 확률이 아니라 준기 님 사주에 박힌 패턴입니다.</strong> 돈에 대해서는 한 발 떨어져 결정하는 습관이 평생의 자산이 됩니다.
      </p>

      <!-- 십성 섹션 요약 — "나는 이런 사람" -->
      <div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론 — 한 줄로 준기 님은</div>
        <p style="font-size:14px; font-weight:500; line-height:1.65;">
          "<strong>표현하고 싶고, 자기 결은 지키고 싶고, 평가는 신경 쓰는 — 그런데 규율은 얇은 사람</strong>"
        </p>
        <p>→ 본인이 <strong>만들고 드러내는 자리</strong>(식상 39%)에 가 있어야 살아납니다. 뒷작업만 하는 자리에 가면 재능이 막힙니다.</p>
        <p>→ 직장 안에서 답답한 건 <strong>상관견관(傷官見官) 구조</strong> 탓입니다. 능력 부족이 아닙니다. 1인 프로젝트·사업 쪽이 사주에 더 맞습니다.</p>
        <p>→ 돈을 가까운 사람과 섞지 마세요. <strong>겁재(22%)가 정재(17%)를 밀어내는 구조</strong>라 동업·지인 투자는 통계가 아니라 사주에 박힌 취약점입니다.</p>
      </div>
    </section>

    <div class="divider"><span class="han">用 神 · 調 候</span></div>

    <!-- ═════════════ 4. 용신·조후 (신규) ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 04</div>
      <div class="section-title">용신·조후 <span class="hanja">用神·調候</span></div>
      <div class="section-sub">사주가 가장 갈증을 느끼는 것 — 색·방위·계절·물건·습관까지</div>

      <p>
        사주 풀이의 진짜 가치는 여기서 나옵니다. 원국에서 무엇이 부족한지를 알아냈다면, 그것을 일상에서 어떻게 채울지가 다음 단계입니다. 명리에서 이 자리를 <strong>용신(用神)</strong>이라 부릅니다. 준기 님 사주의 용신은 두 글자로 못 박을 수 있습니다.
      </p>

      <!-- 용신 카드 -->
      <div style="display:flex; gap:8px; margin:14px 0;">
        <div style="flex:1; background:linear-gradient(135deg,#fff,rgba(117,117,117,.08)); border-left:4px solid #757575; border-radius:10px; padding:14px; text-align:center;">
          <div style="font-family:'Noto Serif KR',serif; font-size:32px; font-weight:700; color:#757575; line-height:1; margin-bottom:6px;">金</div>
          <div style="font-size:11px; color:#5C4A2E; font-weight:600;">1순위 용신</div>
          <div style="font-size:10.5px; color:#2a2520; margin-top:6px; line-height:1.5;">가지 많은 나무를 다듬는 칼. <strong>마감·규율·결단</strong>의 기운.</div>
        </div>
        <div style="flex:1; background:linear-gradient(135deg,#fff,rgba(21,101,192,.08)); border-left:4px solid #1565c0; border-radius:10px; padding:14px; text-align:center;">
          <div style="font-family:'Noto Serif KR',serif; font-size:32px; font-weight:700; color:#1565c0; line-height:1; margin-bottom:6px;">水</div>
          <div style="font-size:11px; color:#5C4A2E; font-weight:600;">2순위 용신·조후</div>
          <div style="font-size:10.5px; color:#2a2520; margin-top:6px; line-height:1.5;">巳월 한낮의 갑목 — 갈증이 큰 사주. <strong>쉼·물·사색</strong>의 기운.</div>
        </div>
      </div>

      <p>
        그리고 절대 더 들어와서는 안 되는 글자도 분명합니다. <strong>木(나무)이 더 들어오면 안 됩니다.</strong> 이미 셋이 있습니다. <strong>火(불)도 너무 많아지면</strong> 나무를 태웁니다. 이 두 글자가 강해지는 시기에는 새 일을 벌이지 마세요.
      </p>

      <!-- 일상 적용 표 -->
      <div style="margin:16px 0; background:#fff; border:1px solid #E5DFD0; border-radius:12px; padding:14px;">
        <div style="font-family:'Noto Serif KR',serif; font-size:13px; font-weight:700; color:#1a1a1a; margin-bottom:10px;">일상에서 金·水를 채우는 법</div>
        <div style="display:grid; grid-template-columns:80px 1fr; gap:8px 12px; font-size:11.5px; color:#2a2520; line-height:1.6;">
          <div style="font-weight:700; color:#757575;">색</div><div><strong>흰색·은색·짙은 청색·검정.</strong> 옷·가방·시계·노트북에 의도적으로 쓰세요. 빨강·녹색은 줄이세요.</div>
          <div style="font-weight:700; color:#757575;">방위</div><div><strong>서쪽(金)·북쪽(水).</strong> 책상이 서북쪽을 향하면 집중력이 올라갑니다. 자취·이사 시 우선순위.</div>
          <div style="font-weight:700; color:#757575;">계절</div><div><strong>가을·겨울에 일이 풀립니다.</strong> 큰 결정은 9월~2월에 몰아두면 흐름을 탑니다.</div>
          <div style="font-weight:700; color:#757575;">시간대</div><div><strong>유시(17~19시)·자시(23~01시).</strong> 결정·집필·복기는 이 시간대가 가장 또렷합니다.</div>
          <div style="font-weight:700; color:#757575;">음식</div><div><strong>짠맛·매운맛 약간.</strong> 흰살 생선·해산물·견과류·우유·물 충분히. 매운 음식은 절제하면서 김치·마늘 정도가 알맞습니다.</div>
          <div style="font-weight:700; color:#757575;">물건</div><div><strong>은반지·금속 시계·검정 만년필·유리 컵.</strong> 매일 손에 닿는 물건 한두 개를 금속·물로 두세요.</div>
          <div style="font-weight:700; color:#757575;">취미</div><div><strong>수영·반신욕·낚시·서예·캘리그라피·요리(칼 다루기).</strong> 칼과 물을 다루는 활동이 사주의 결을 채웁니다.</div>
          <div style="font-weight:700; color:#757575;">사람</div><div><strong>일간이 庚·辛(金)·壬·癸(水)인 사람</strong>이 곁에 있으면 결정이 부드러워집니다. 이름의 받침에 'ㅁ·ㅂ·ㅍ'(水)이 있는 사람도 긍정적.</div>
        </div>
      </div>

      <!-- 결론 -->
      <div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론 — 오늘부터 못 박을 것</div>
        <p>→ 책상을 <strong>서쪽 또는 북쪽 벽</strong>으로 돌리세요. 이게 1번입니다.</p>
        <p>→ 매일 <strong>물 2L</strong>를 마시세요. 의지가 아니라 보급입니다.</p>
        <p>→ 옷장에 <strong>검정·흰색·은색 비중을 70% 이상</strong>으로 맞추세요.</p>
        <p>→ 결정·계약·발표는 <strong>9월~2월, 17시 이후</strong>에 잡으세요. 같은 일도 흐름이 다릅니다.</p>
      </div>
    </section>

    <div class="divider"><span class="han">大 運</span></div>

    <!-- ═════════════ 5. 대운 ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 05</div>
      <div class="section-title">대운 <span class="hanja">大運</span></div>
      <div class="section-sub">10년 단위로 흐르는 인생의 큰 강줄기</div>

      <div class="daewoon-timeline">
        <div class="daewoon-row">
          <div class="dw-cell"><div class="age">1~10세</div><div class="gan">壬</div><div class="ji">午</div><div class="label">유년</div></div>
          <div class="dw-cell"><div class="age">11~20세</div><div class="gan">癸</div><div class="ji">未</div><div class="label">학창</div></div>
          <div class="dw-cell"><div class="age">21~30세</div><div class="gan">甲</div><div class="ji">申</div><div class="label">진출</div></div>
          <div class="dw-cell now"><div class="age">31~40세</div><div class="gan">乙</div><div class="ji">酉</div><div class="label">현재</div></div>
          <div class="dw-cell"><div class="age">41~50세</div><div class="gan">丙</div><div class="ji">戌</div><div class="label">전환</div></div>
          <div class="dw-cell"><div class="age">51~60세</div><div class="gan">丁</div><div class="ji">亥</div><div class="label">결실</div></div>
          <div class="dw-cell"><div class="age">61~70세</div><div class="gan">戊</div><div class="ji">子</div><div class="label">정리</div></div>
          <div class="dw-cell"><div class="age">71~80세</div><div class="gan">己</div><div class="ji">丑</div><div class="label">관조</div></div>
        </div>
      </div>

      <div class="daewoon-scores">
        <div class="ds-title">대운 점수 추이 (8주기, 100점 만점)</div>
        <div class="ds-row"><span class="ds-age">1~10세</span><div class="ds-track"><div class="ds-fill" style="width: 58%"></div></div><span class="ds-score">58</span></div>
        <div class="ds-row"><span class="ds-age">11~20세</span><div class="ds-track"><div class="ds-fill" style="width: 64%"></div></div><span class="ds-score">64</span></div>
        <div class="ds-row"><span class="ds-age">21~30세</span><div class="ds-track"><div class="ds-fill" style="width: 70%"></div></div><span class="ds-score">70</span></div>
        <div class="ds-row"><span class="ds-age">31~40세</span><div class="ds-track"><div class="ds-fill now" style="width: 75%"></div></div><span class="ds-score">75</span></div>
        <div class="ds-row"><span class="ds-age">41~50세</span><div class="ds-track"><div class="ds-fill peak" style="width: 89%"></div></div><span class="ds-score">89</span></div>
        <div class="ds-row"><span class="ds-age">51~60세</span><div class="ds-track"><div class="ds-fill" style="width: 82%"></div></div><span class="ds-score">82</span></div>
        <div class="ds-row"><span class="ds-age">61~70세</span><div class="ds-track"><div class="ds-fill" style="width: 71%"></div></div><span class="ds-score">71</span></div>
        <div class="ds-row"><span class="ds-age">71~80세</span><div class="ds-track"><div class="ds-fill" style="width: 65%"></div></div><span class="ds-score">65</span></div>
        <div class="ds-caption">정점은 <strong style="color:#2e7d32">41~50세 병술(丙戌) 대운</strong>. 식신(食神)·편재(偏財)가 동시에 작동해 이름이 알려지고 결실이 손에 잡히는 시기입니다. 지금 30대는 그 정점을 받아낼 그릇을 굽는 시기로 보면 됩니다.</div>
      </div>

      <!-- 대운 60년 가로 시간선 -->
      <div class="daewoon-line">
        <div class="dl-title">60년 가로 시간선 — 색이 진할수록 활력이 강한 시기</div>
        <div class="dl-bar">
          <div class="dl-mark" style="left: 16.67%;">20</div>
          <div class="dl-mark now" style="left: 41.67%;">현재 35</div>
          <div class="dl-mark peak" style="left: 58.33%;">정점 46</div>
          <div class="dl-mark" style="left: 83.33%;">70</div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:9.5px; color:#a08a5a; margin-top:4px; padding: 0 2px;">
          <span>축적기</span><span>준비기</span><span>다듬기</span><span style="color:#2e7d32; font-weight:700;">결실기</span><span>관조기</span>
        </div>
      </div>

      <div class="now-daewoon">
        <div class="nd-head">
          <div class="nd-glyph">
            <span class="g-gan">乙</span>
            <span class="g-ji">酉</span>
          </div>
          <div class="nd-info">
            <div class="nd-age">현재 대운 · 31~40세</div>
            <div class="nd-key">을유(乙酉) — 깎이고 다듬어지는 10년</div>
          </div>
        </div>
        <div class="nd-row"><span class="nd-label">천간 乙</span><span>비견·겁재. 동료·파트너·자기 사람의 자리</span></div>
        <div class="nd-row"><span class="nd-label">지지 酉</span><span>정관(辛). 평생 부족했던 칼이 들어와 모양을 잡습니다</span></div>
        <div class="nd-row"><span class="nd-label">키 사건</span><span>32세 동업·34세 큰 깎임·36세 첫 결실 신호</span></div>
        <div class="nd-row"><span class="nd-label">조심</span><span>33·37세는 새로운 시작보다 정리·복기에 무게중심</span></div>
      </div>

      <!-- 인생 단계 3카드 -->
      <div class="life-stage-grid">
        <div class="life-stage-card">
          <div class="ls-tag">지난 10년</div>
          <div class="ls-age">21~30세</div>
          <div class="ls-glyph">甲申</div>
          <div class="ls-key">진출 · 자리 찾기. 칼(金)을 처음 만나 모양을 잡기 시작한 시기.</div>
        </div>
        <div class="life-stage-card now">
          <div class="ls-tag">지금</div>
          <div class="ls-age">31~40세</div>
          <div class="ls-glyph">乙酉</div>
          <div class="ls-key">다듬는 10년 · 결과보다 그릇. 깎임 속에서 모양이 잡히는 중.</div>
        </div>
        <div class="life-stage-card">
          <div class="ls-tag">다음 10년</div>
          <div class="ls-age">41~50세</div>
          <div class="ls-glyph">丙戌</div>
          <div class="ls-key">결실기 · 이름이 알려지는 시기. 식신·편재 동시 발동.</div>
        </div>
      </div>

      <p>
        준기 님은 지금 <strong>31~40세 을유(乙酉) 대운</strong>의 한가운데에 있습니다. 천간의 <strong>乙</strong>은 갑(甲) 옆에서 같이 자라는 작은 나무 — <strong>비견·겁재</strong>의 자리입니다. 그래서 이 시기에는 <strong>동료·파트너·자기 사람</strong>이라는 키워드가 강해집니다. 같이 일할 사람을 만나거나, 본인이 누군가를 끌어주는 자리에 자주 서게 됩니다.
      </p>
      <p>
        지지의 <strong>酉(유)</strong>는 다듬어주는 <strong>금(金)</strong>. 평생 부족했던 '나무를 다듬는 칼'이 이 10년에 들어와 있다는 뜻입니다. 작년부터 올해까지 어딘가에서 <strong>"내가 깎이는 느낌"</strong>을 받은 적이 있다면, 운이 나쁜 것이 아니라 <strong>이 칼이 작동하는 중</strong>입니다. 모양이 잡히는 시기는 본래 아픕니다.
      </p>
      <p>
        다음 대운인 <strong>41~50세 병술(丙戌)</strong>은 큰 전환점입니다. <strong>丙</strong>은 한낮의 태양, 갑(甲)에게는 <strong>식신(食神)</strong>으로 작용해 <strong>드러내는 자리·이름이 알려지는 자리</strong>가 활짝 열립니다. 30대에 깎인 모양이 40대에 빛을 받습니다. 지금 무리해서 결과를 빨리 보려 하지 않아도 괜찮은 이유입니다.
      </p>
      <p>
        <strong>51~60세 정해(丁亥)</strong>는 준기 님 사주에 가장 부족했던 수(水)가 들어오는 시기입니다. 명예·이름이 이미 자리잡은 뒤 마음의 물기가 되돌아옵니다. 가족·스승의 자리가 다시 소중해지는 결입니다. 젊을 때 멀리 두었던 관계가 이 시기에 다시 가까워질 수 있습니다.
      </p>

      <div class="pullquote">
        <p>지금은 모양이 잡히는 10년. 결과를 보는 10년이 아니라, 결과를 받을 그릇을 굽는 10년이다.</p>
      </div>
    </section>

    <div class="divider"><span class="han">年 運</span></div>

    <!-- ═════════════ 5. 연운 ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 06</div>
      <div class="section-title">연운 <span class="hanja">年運</span> <span style="font-size:13px; color:#7F6B4E; font-weight:400;">2026 병오(丙午)</span></div>
      <div class="section-sub">올 한 해, 하늘이 보내는 손님</div>

      <div class="yeonun-chart">
        <div class="ttl">월별 흐름 (1~12월, 활력 지수)</div>
        <svg class="yeonun-svg" viewBox="0 0 320 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#E8D9B8" stop-opacity=".4"/>
              <stop offset="100%" stop-color="#E8D9B8" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <!-- area -->
          <path d="M0,80 L26,70 L53,50 L80,40 L106,55 L133,30 L160,25 L186,45 L213,60 L240,50 L266,65 L293,75 L320,60 L320,120 L0,120 Z" fill="url(#grad)"/>
          <!-- line -->
          <path d="M0,80 L26,70 L53,50 L80,40 L106,55 L133,30 L160,25 L186,45 L213,60 L240,50 L266,65 L293,75 L320,60" stroke="#B8965A" stroke-width="2" fill="none"/>
          <!-- now marker (4월) -->
          <circle cx="80" cy="40" r="5" fill="#fff" stroke="#B8965A" stroke-width="2"/>
          <text x="80" y="22" text-anchor="middle" font-size="9" fill="#B8965A" font-weight="600">NOW</text>
          <!-- peak marker (7월) -->
          <circle cx="160" cy="25" r="3" fill="#2e7d32"/>
          <!-- baseline labels -->
          <text x="0" y="115" font-size="8" fill="#7F6B4E">1월</text>
          <text x="80" y="115" font-size="8" fill="#7F6B4E">4월</text>
          <text x="160" y="115" font-size="8" fill="#7F6B4E">7월</text>
          <text x="240" y="115" font-size="8" fill="#7F6B4E">10월</text>
          <text x="305" y="115" font-size="8" fill="#7F6B4E">12월</text>
        </svg>
      </div>

      <p>
        2026년은 <strong>병오(丙午)</strong> 해입니다. 천간 <strong>丙</strong>은 갑(甲) 나무에게 가장 좋은 햇살이고, 지지 <strong>午</strong>는 한낮의 불입니다. 이 글자들이 준기 님 일주의 <strong>午</strong>를 만나 <strong>오오(午午) 자형(自刑)</strong>이라는 다소 거친 자리를 만들어냅니다. 자형이라 해서 무서운 것만은 아닙니다. <strong>자기 자신을 자기가 들들 볶는 한 해</strong>로 풀이됩니다.
      </p>
      <p>
        그래서 올해 준기 님의 키워드는 <strong>"보여주고 싶다, 그런데 마음대로 되지 않는다"</strong>입니다. 시작은 잘되는데 마무리에서 자기 자신에게 너무 엄격해지는 일이 잦습니다. <strong>4~7월</strong>은 햇살이 가장 좋아 결과가 빠르게 나오는 시기이지만, <strong>8~9월</strong>에는 일을 너무 벌여놓고 정리에서 막히는 패턴이 보입니다.
      </p>
      <p>
        재물 쪽은 <strong>3월·6월·11월</strong>이 좋은 자리입니다. 특히 <strong>6월</strong>에 새로운 수익 채널 하나가 손에 잡힐 가능성이 높습니다. 사람 쪽은 <strong>5월에 만나는 사람</strong>이 한 해 내내 이어지는 인연이 됩니다. 명함을 잘 챙기시길 바랍니다.
      </p>
      <p>
        조심할 자리는 <strong>9월</strong>입니다. 자기과신에서 비롯된 작은 사고·말실수가 한 해의 결을 흐트러뜨리는 자리입니다. 9월에는 <strong>새로운 일 시작보다 정리·휴식</strong> 쪽으로 무게중심을 두시길 바랍니다.
      </p>

      <!-- 12개월 미니 인사이트 -->
      <h4 style="font-family:'Noto Serif KR',serif; font-size:13px; color:#1a1a1a; font-weight:700; margin:18px 0 4px; letter-spacing:0.02em;">12개월 한 줄씩</h4>
      <p style="font-size:11px; color:#5C4A2E; margin:0 0 6px;">현재는 4월 — 녹색이 상승, 빨강이 주의, 금색이 현재</p>
      <div class="month-insight-grid">
        <div class="mi"><span class="mi-num">1월 庚寅</span>시동을 거는 달. 계획 2~3개 중 하나만 고르기.</div>
        <div class="mi up"><span class="mi-num">2월 辛卯</span>관계가 움직이는 달. 오래된 연락을 꺼내기 좋음.</div>
        <div class="mi up"><span class="mi-num">3월 壬辰</span>재물의 첫 문이 열림. 제안 하나가 구체화됨.</div>
        <div class="mi now"><span class="mi-num">4월 癸巳</span>지금. 시작한 일의 뼈대를 잡는 달. 서두르지 않기.</div>
        <div class="mi up"><span class="mi-num">5월 甲午</span>사람이 모이는 달. 이달의 인연이 한 해를 이어감.</div>
        <div class="mi peak"><span class="mi-num">6월 乙未</span>재물의 두 번째 문. 새로운 수익 채널 하나가 손에.</div>
        <div class="mi peak"><span class="mi-num">7월 丙申</span>정점의 달. 이름과 결과가 동시에 도드라짐.</div>
        <div class="mi warn"><span class="mi-num">8월 丁酉</span>일을 벌이다 막히기 쉬움. 마무리에 무게를 두기.</div>
        <div class="mi warn"><span class="mi-num">9월 戊戌</span>가장 조심할 달. 말실수·작은 사고의 자리.</div>
        <div class="mi"><span class="mi-num">10월 己亥</span>물(水)이 들어오는 달. 쉼·독서가 회복을 부름.</div>
        <div class="mi up"><span class="mi-num">11월 庚子</span>재물의 세 번째 문. 연말 정산의 시기.</div>
        <div class="mi"><span class="mi-num">12월 辛丑</span>한 해를 기록하는 달. 내년 한 줄을 미리 써두기.</div>
      </div>

      <div class="relation-grid">
        <div class="rel-card boost">
          <div class="rc-label">힘이 되는 사람</div>
          <div class="rc-glyph">壬 · 癸</div>
          <div class="rc-desc">수(水) 일간. 직관이 깊고 감정이 조용한 사람이 준기 님의 부족한 물을 채웁니다.</div>
        </div>
        <div class="rel-card clash">
          <div class="rc-label">부딪히는 사람</div>
          <div class="rc-glyph">庚 · 辛</div>
          <div class="rc-desc">금(金) 일간이 또 들어오면 과한 깎임. 올해는 적당한 거리가 좋습니다.</div>
        </div>
        <div class="rel-card calm">
          <div class="rc-label">마음이 놓이는 사람</div>
          <div class="rc-glyph">戊 · 己</div>
          <div class="rc-desc">토(土) 일간. 결정을 받아주고 기다려주는 결. 곁에 두면 다급함이 가라앉습니다.</div>
        </div>
      </div>
    </section>

    <div class="divider"><span class="han">神 殺</span></div>

    <!-- ═════════════ 6. 신살 ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 07</div>
      <div class="section-title">신살 <span class="hanja">神殺</span></div>
      <div class="section-sub">사주마다 성립 조건이 달라 0~10개까지 다릅니다 · 준기 님께는 <strong>5개</strong>가 자리합니다 (강 2 · 중 2 · 참고 1)</div>

      <!-- 강 — 큰 카드 (가장 강하게 작동하는 대표 신살) -->
      <div class="shinsal-list">
        <div class="shinsal-card">
          <div class="head">
            <span class="nm">도화살</span><span class="han">桃花殺</span>
            <span class="tag">매력 · 사람을 끄는 힘</span>
          </div>
          <p>지지의 <strong>卯</strong>가 도화살 자리입니다. 흔히 오해하는 이성운이 아니라, <strong>사람을 끌어당기는 매력</strong>입니다. 준기 님은 가만히 있어도 사람이 모이는 결을 갖습니다. 사업·콘텐츠·브랜드에 활용하면 탁월하지만, <strong>무리에 둘러싸여 자기 결을 잃기 쉬운 자리</strong>이기도 합니다.</p>
          <div class="shinsal-meta">
            <div class="sm-pulse" title="작동 강도"><span class="on"></span><span class="on"></span><span class="on"></span><span class="on"></span><span class="on"></span></div>
            <span class="sm-when always">상시 작동</span>
          </div>
          <div class="adv"><span class="adv-icon">!</span><span class="adv-text"><strong>실천:</strong> 한 달에 하루는 약속 없이 혼자 보낼 것. 도화는 적당히 거리를 두는 사람에게 가장 강하게 작동합니다.</span></div>
        </div>

        <div class="shinsal-card">
          <div class="head">
            <span class="nm">문창귀인</span><span class="han">文昌貴人</span>
            <span class="tag">길성 · 학문·표현</span>
          </div>
          <p>일간 갑(甲)에게 <strong>巳</strong>가 문창귀인 자리입니다. 월지 巳에 정확히 자리하므로 <strong>글·말·기획·교육</strong>으로 풀어내는 일에 특별히 강합니다. 준기 님이 정리해서 설명하면 사람들이 잘 받아들이는 이유가 여기에 있습니다.</p>
          <div class="shinsal-meta">
            <div class="sm-pulse" title="작동 강도"><span class="on"></span><span class="on"></span><span class="on"></span><span class="on"></span><span></span></div>
            <span class="sm-when always">상시 작동</span>
          </div>
          <div class="adv"><span class="adv-icon">!</span><span class="adv-text"><strong>실천:</strong> '쓰는 채널' 한 곳을 5년 단위로 굴릴 것. 직업 선택 시 글·강의가 들어가는 자리가 무조건 유리합니다.</span></div>
        </div>
      </div>

      <!-- 중 — 중간 카드 (특정 시기·영역에서 작동) -->
      <div class="shinsal-list" style="margin-top: 12px;">
        <div class="shinsal-card mid">
          <div class="head">
            <span class="nm">역마살</span><span class="han">驛馬殺</span>
            <span class="tag">이동 · 변화</span>
          </div>
          <p>연지 <strong>亥</strong>가 만들어내는 역마살입니다. 한자리에 오래 있는 것이 답답한 결이며, 이사·이직·해외 등 변화가 많을 수 있습니다. <strong>안정형보다 이동형</strong>으로 살 때 더 잘 풀립니다.</p>
          <div class="shinsal-meta">
            <div class="sm-pulse"><span class="on"></span><span class="on"></span><span class="on"></span><span class="on"></span><span></span></div>
            <span class="sm-when dae">41~50세 대운기 강화</span>
          </div>
          <div class="adv"><span class="adv-icon">!</span><span class="adv-text"><strong>실천:</strong> 3년 이상 같은 자리·같은 일에 묶이지 않도록 의식적으로 영역을 넓힐 것. 한 회사에서도 직무 전환을 활용합니다.</span></div>
        </div>

        <div class="shinsal-card mid">
          <div class="head">
            <span class="nm">홍염살</span><span class="han">紅艶殺</span>
            <span class="tag">매력 · 정서</span>
          </div>
          <p>일간 갑에게 <strong>오(午)</strong>가 홍염살 자리입니다. 도화살과 결이 다른 매력으로, <strong>정서적 깊이로 사람을 끄는 힘</strong>입니다. 글·예술·상담의 결로 흘러갈 때 가장 잘 발현됩니다.</p>
          <div class="shinsal-meta">
            <div class="sm-pulse"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span></div>
            <span class="sm-when always">상시 작동</span>
          </div>
          <div class="adv"><span class="adv-icon">!</span><span class="adv-text"><strong>실천:</strong> 결혼·동거의 큰 결정은 36~38세에 안정됩니다. 그 전에는 관계의 강도보다 다양성을 경험하는 편이 도움이 됩니다.</span></div>
        </div>
      </div>

      <!-- 참고 — 5번째 신살(공망)도 작은 카드로 -->
      <div class="shinsal-list" style="margin-top: 12px;">
        <div class="shinsal-card mid">
          <div class="head">
            <span class="nm">공망</span><span class="han">空亡</span>
            <span class="tag">참고 · 배경 조건</span>
          </div>
          <p>갑오 일주의 공망은 <strong>辰·巳</strong>. 월지 巳가 여기 닿아 <strong>월주 공망</strong>의 결입니다. 기존 틀에 얽매이지 않는 사회성으로 읽히며, 辰·巳 글자가 들어오는 해(<strong>2025 乙巳, 2036 丙辰</strong>)는 물질보다 정신·학습의 밀도가 오릅니다.</p>
          <div class="shinsal-meta">
            <div class="sm-pulse"><span class="on"></span><span class="on"></span><span></span><span></span><span></span></div>
            <span class="sm-when year">특정 해(辰·巳)에만 활성</span>
          </div>
          <div class="adv"><span class="adv-icon">!</span><span class="adv-text"><strong>실천:</strong> 辰·巳 해에는 새 사업·큰 투자를 미루고 학습·자격·관계 정비에 시간을 투자하세요.</span></div>
        </div>
      </div>

      <p style="font-size: 11.5px; color: #5C4A2E; margin: 14px 2px 0; line-height: 1.6;">※ 신살은 사주마다 성립 여부가 달라 <strong>0~10개 이상</strong>까지 차이가 납니다. 천을귀인·월덕귀인·금여록·화개살·백호살 등은 준기 님 사주에는 성립하지 않아 표기하지 않았습니다.</p>
    </section>

    <div class="divider"><span class="han">六 親</span></div>

    <!-- ═════════════ 8. 관계의 결 (신규) ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 08</div>
      <div class="section-title">관계의 결 <span class="hanja">六親</span></div>
      <div class="section-sub">사주가 그려놓은 부모·형제·배우자·자녀·친구·동료의 자리</div>

      <p>
        한 사람의 사주는 그 사람만 그리는 것이 아닙니다. 부모·형제·배우자·자녀·친구·동료까지 — 가까운 관계가 어떤 결로 짜여 있는지 함께 새겨져 있습니다. 준기 님 사주에는 다음 여섯 자리의 색이 또렷합니다.
      </p>

      <!-- 6관계 카드 (요약 / ✓ 살릴 것 / ⚠ 조심 3블록 분리) -->
      <div class="rel6-list">
        <!-- 부모 -->
        <div class="rel6-card c-parent">
          <div class="rel6-head">
            <span class="rel6-name">父 母</span>
            <span class="rel6-label">부모</span>
            <span class="rel6-tag t-warn">긴장</span>
          </div>
          <p class="rel6-summary">
            연주의 <strong>亥</strong>(편인)와 월주의 사해충(巳亥沖). <strong>본가와 본인의 방향이 자주 어긋나는 결이 사주에 박혀 있습니다.</strong> 이건 효심의 문제가 아니라 구조의 문제입니다.
          </p>
          <div class="rel6-actions">
            <div class="rel6-do"><span class="ic">✓ 살릴 것</span><span class="txt"><strong>연 2회 의도적인 본가 방문</strong>(명절 외 추가). 짧고 자주가 길고 드물게보다 낫습니다.</span></div>
            <div class="rel6-dont"><span class="ic">⚠ 조심할 것</span><span class="txt">본가에서 <strong>큰 결정을 협의하지 않습니다.</strong> 결정은 본가 밖에서 내리고 결과만 공유하세요.</span></div>
          </div>
        </div>

        <!-- 형제 -->
        <div class="rel6-card c-sibling">
          <div class="rel6-head">
            <span class="rel6-name">兄 弟</span>
            <span class="rel6-label">형제·동기</span>
            <span class="rel6-tag t-neut">유사</span>
          </div>
          <p class="rel6-summary">
            천간 <strong>乙</strong>·지지 <strong>卯</strong>의 겁재. <strong>형제·가까운 또래는 결이 비슷합니다.</strong> 닮아서 든든하지만 닮아서 부딪힙니다.
          </p>
          <div class="rel6-actions">
            <div class="rel6-do"><span class="ic">✓ 살릴 것</span><span class="txt">같은 분야에서 협업하면 폭발력이 큽니다. 단, <strong>역할·지분을 시작 전에 명문화</strong>해야 합니다.</span></div>
            <div class="rel6-dont"><span class="ic">⚠ 조심할 것</span><span class="txt"><strong>금전 거래·공동 투자는 사주가 가장 약한 자리</strong>입니다. 한 번은 큰 손실로 이어집니다.</span></div>
          </div>
        </div>

        <!-- 배우자 -->
        <div class="rel6-card c-spouse">
          <div class="rel6-head">
            <span class="rel6-name">配 偶</span>
            <span class="rel6-label">배우자·연인</span>
            <span class="rel6-tag t-good">36~38 안정</span>
          </div>
          <p class="rel6-summary">
            일지 <strong>午</strong> + 홍염살. 정서적 깊이와 표현력이 또렷한 결로 사람을 끕니다. <strong>배우자는 본인보다 차분하고 사색적인 사람</strong>이 어울립니다 — 일간 <strong>壬·癸(水)</strong>가 1순위.
          </p>
          <div class="rel6-actions">
            <div class="rel6-do"><span class="ic">✓ 살릴 것</span><span class="txt"><strong>36~38세에 결혼·동거 결정이 안정적으로 자리잡습니다.</strong> 35세 이전엔 강도보다 다양성을 경험하세요.</span></div>
            <div class="rel6-dont"><span class="ic">⚠ 조심할 것</span><span class="txt">일간 <strong>庚·辛(金)</strong>인 사람과 깊이 엮이면 깎임이 큽니다.</span></div>
          </div>
        </div>

        <!-- 자녀 -->
        <div class="rel6-card c-child">
          <div class="rel6-head">
            <span class="rel6-name">子 女</span>
            <span class="rel6-label">자녀</span>
            <span class="rel6-tag t-neut">강한 영향</span>
          </div>
          <p class="rel6-summary">
            식상이 39%로 두꺼운 사주는 <strong>자녀와의 관계가 인생의 큰 축</strong>이 됩니다. 자녀 1명에게 깊게 쏟는 결입니다.
          </p>
          <div class="rel6-actions">
            <div class="rel6-do"><span class="ic">✓ 살릴 것</span><span class="txt">자녀의 <strong>표현·창작을 적극적으로 받아주는 부모</strong>가 됩니다. 함께 무언가를 만드는 시간이 가족의 자산이 됩니다.</span></div>
            <div class="rel6-dont"><span class="ic">⚠ 조심할 것</span><span class="txt">본인의 기준을 자녀에게 투영하기 쉽습니다. <strong>자녀가 다른 결을 보일 때 받아들이는 연습</strong>이 평생 과제입니다.</span></div>
          </div>
        </div>

        <!-- 동료·친구 -->
        <div class="rel6-card c-friend">
          <div class="rel6-head">
            <span class="rel6-name">朋 友</span>
            <span class="rel6-label">친구·동료</span>
            <span class="rel6-tag t-neut">도화 작동</span>
          </div>
          <p class="rel6-summary">
            도화살(卯)이 작동해 <strong>가만히 있어도 사람이 모입니다.</strong> 동료·친구·팬·고객까지 다양한 결로 들어옵니다.
          </p>
          <div class="rel6-actions">
            <div class="rel6-do"><span class="ic">✓ 살릴 것</span><span class="txt"><strong>5월에 만나는 사람은 한 해 내내 이어지는 인연.</strong> 사람이 모이는 결을 사업·콘텐츠·커뮤니티로 풀어내면 강력합니다.</span></div>
            <div class="rel6-dont"><span class="ic">⚠ 조심할 것</span><span class="txt">사람이 많아지면 자기 결을 잃기 쉽습니다. <strong>한 달에 하루는 약속 없는 날을 캘린더에 못 박으세요.</strong></span></div>
          </div>
        </div>

        <!-- 직장 상사·권위 -->
        <div class="rel6-card c-boss">
          <div class="rel6-head">
            <span class="rel6-name">上 司</span>
            <span class="rel6-label">상사·권위</span>
            <span class="rel6-tag t-warn">상관견관</span>
          </div>
          <p class="rel6-summary">
            상관(4)이 정관(2)을 누르는 구조. <strong>위에서 시키는 일이 자주 답답하게 느껴집니다.</strong> 능력 부족이 아니라 사주가 그렇게 짜여 있습니다.
          </p>
          <div class="rel6-actions">
            <div class="rel6-do"><span class="ic">✓ 살릴 것</span><span class="txt">본인의 <strong>판단·재량이 보장되는 자리</strong>(1인 프로젝트·임원·창업)에서 가장 빛납니다.</span></div>
            <div class="rel6-dont"><span class="ic">⚠ 조심할 것</span><span class="txt">위계가 단단한 조직에서 오래 버티려 하면 본인 사주를 거스르는 일입니다. <strong>5년 이상은 권하지 않습니다.</strong></span></div>
          </div>
        </div>
      </div>

      <!-- 결론 -->
      <div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론 — 관계 한 줄 정리</div>
        <p>
          준기 님 인생의 가장 큰 자산은 <strong>사람</strong>입니다 — 도화·홍염·식상이 다 받쳐줍니다. 동시에 가장 큰 위험도 <strong>사람</strong>입니다 — 겁재가 정재를 밀어냅니다. <strong>"가까이 두되 돈은 섞지 않는다"</strong>가 평생의 원칙이 되어야 합니다. 그리고 <strong>壬·癸(水) 일간의 사람을 곁에 두세요.</strong> 부족한 물을 채워줍니다.
        </p>
      </div>
    </section>

    <div class="divider"><span class="han">主 題</span></div>

    <!-- ═════════════ 9. 주제별 한눈에 ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 09</div>
      <div class="section-title">주제별 한눈에 <span class="hanja">主題</span></div>
      <div class="section-sub">다섯 주제의 점수와 키워드 · 각 주제는 1운으로 깊게 볼 수 있습니다</div>

      <div class="topic-mini-grid">
        <div class="topic-mini">
          <div class="tm-head"><span class="tm-ttl">재물</span><span class="tm-score">72</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: 72%"></div></div>
          <div class="tm-desc">본업 5 : 사이드 2.5. 관계로 들어오는 돈이 강함. <strong>6월·11월</strong> 좋음.</div>
          <div class="tm-link">주제별 재물 1운에서 깊이 보기 →</div>
        </div>
        <div class="topic-mini">
          <div class="tm-head"><span class="tm-ttl">사랑</span><span class="tm-score">68</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: 68%"></div></div>
          <div class="tm-desc">홍염·도화 동시 작동. 36~38세 안정기. 壬癸 일간과 조화.</div>
          <div class="tm-link">주제별 사랑 1운에서 깊이 보기 →</div>
        </div>
        <div class="topic-mini">
          <div class="tm-head"><span class="tm-ttl">직업</span><span class="tm-score">81</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: 81%"></div></div>
          <div class="tm-desc">문창·상관 결합. 글·강의·기획이 들어간 자리에서 가장 강함.</div>
          <div class="tm-link">주제별 직업 1운에서 깊이 보기 →</div>
        </div>
        <div class="topic-mini">
          <div class="tm-head"><span class="tm-ttl">건강</span><span class="tm-score">64</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: 64%"></div></div>
          <div class="tm-desc">백호살. 심혈관·간 부담. 40대 종합검진 고정.</div>
          <div class="tm-link">주제별 건강 1운에서 깊이 보기 →</div>
        </div>
        <div class="topic-mini full">
          <div class="tm-head"><span class="tm-ttl">가족·관계</span><span class="tm-score">70</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: 70%"></div></div>
          <div class="tm-desc">사해충으로 본가와의 방향이 어긋나기 쉬움. 51~60세 정해(丁亥) 대운에 회복. 지금은 연 2회 의도적인 본가 방문이 자산.</div>
          <div class="tm-link">주제별 가족 1운에서 깊이 보기 →</div>
        </div>
      </div>

      <p style="font-size: 12.5px; color: #5C4A2E; margin-top: 6px;">
        종합 점수는 원국·대운·연운·신살을 합산해 산출합니다. 각 주제의 상세 풀이는 <strong>해당 주제의 1운 결과지</strong>에서 이어집니다. 위 그래프와 키워드는 1운에서 동일하게 등장하며, 1운에서는 여기에 12개월 타임라인·구체 액션·주변 인물 해석이 추가됩니다.
      </p>
    </section>

    <div class="divider"><span class="han">實 踐</span></div>

    <!-- ═════════════ 8. 실천 ═════════════ -->
    <section class="section">
      <div class="section-num">SECTION 10</div>
      <div class="section-title">실천 <span class="hanja">實踐</span></div>
      <div class="section-sub">사주를 안 다음, 오늘부터 바꾸어볼 다섯 가지</div>

      <p>
        풀이가 길었습니다. 하지만 사주는 <strong>'알았다'에서 끝나면 종이 한 장</strong>입니다. 준기 님 사주의 결을 가장 잘 살리는, 작지만 효과가 큰 실천 일곱 가지를 정리하겠습니다.
      </p>

      <div class="action-list">
        <div class="action-card">
          <div class="num">1</div>
          <div class="body">
            <div class="ttl">하루의 끝에 물 한 컵, 그리고 침묵</div>
            <div class="desc">사주에 수(水)가 부족합니다. 물을 자주 마시는 습관도 좋지만, 더 중요한 것은 <strong>하루 끝에 5분 침묵하는 시간</strong>입니다. 화(火)가 강한 사주는 끝까지 타다가 무너지기 쉽습니다. 침묵이 곧 내 안의 물을 길어 올리는 행위가 됩니다.</div>
          </div>
        </div>
        <div class="action-card">
          <div class="num">2</div>
          <div class="body">
            <div class="ttl">'잘하는 사람' 옆 깎이는 자리에 앉으세요</div>
            <div class="desc">현재 대운에 금(金)이 들어와 있습니다. 이는 곧 <strong>나를 다듬어줄 사람</strong>이 들어왔다는 신호입니다. 준기 님보다 한 수 위인 사람 곁에 의도적으로 자리를 만드시길 바랍니다. 사수·멘토·클라이언트 그 누구든. 깎이는 것이 아프다고 도망가면 모양이 잡히지 않습니다.</div>
          </div>
        </div>
        <div class="action-card">
          <div class="num">3</div>
          <div class="body">
            <div class="ttl">9월에는 새 일을 벌이지 않기</div>
            <div class="desc">2026년 9월은 자형(自刑)이 강하게 발동하는 시기입니다. 새 프로젝트, 큰 계약, 이사 같은 큰 결정은 8월 말까지 마무리하거나 10월 이후로 미루시길 바랍니다. 9월은 <strong>정리와 휴식의 한 달</strong>로 잡는 편이 한 해 전체의 점수를 올립니다.</div>
          </div>
        </div>
        <div class="action-card">
          <div class="num">4</div>
          <div class="body">
            <div class="ttl">'표현하는 한 채널'을 꾸준히 굴릴 것</div>
            <div class="desc">상관(傷官)과 문창귀인이 같이 있는 사주는 <strong>표현으로 풀려나가는 결</strong>입니다. 글·영상·강의·SNS 형식은 자유이나, <strong>한 채널을 1년 이상 끊김 없이</strong>. 이것이 다음 대운에서 빛이 됩니다.</div>
          </div>
        </div>
        <div class="action-card">
          <div class="num">5</div>
          <div class="body">
            <div class="ttl">5월에 만난 사람의 명함을 챙기기</div>
            <div class="desc">올해 연운에서 <strong>5월 인연</strong>이 1년 내내 이어집니다. 식사 한 번 더, 메모 한 줄 더. 작은 정성이 다음 운의 다리가 됩니다. 사주는 사람을 통해 작동하는 무늬입니다.</div>
          </div>
        </div>
        <div class="action-card">
          <div class="num">6</div>
          <div class="body">
            <div class="ttl">형제·친구와는 큰돈을 섞지 않기</div>
            <div class="desc">겁재가 강한 사주는 가까운 사람과 돈이 얽히는 순간 정재(正財)가 빠져나갑니다. 이는 신뢰의 문제가 아니라 <strong>구조의 문제</strong>입니다. 큰 금액은 반드시 문서와 중립 제3자를 통해 결정하시길 바랍니다.</div>
          </div>
        </div>
        <div class="action-card">
          <div class="num">7</div>
          <div class="body">
            <div class="ttl">40세 이후 종합검진을 달력에 고정</div>
            <div class="desc">백호살 일주는 추진력과 건강 부담이 동반됩니다. <strong>매년 같은 달</strong>에 종합검진을 예약해 두시길 바랍니다. 간 수치·혈압·심박을 별도로 추적하면 41~50세 병술 대운의 정점을 온전히 받을 수 있습니다.</div>
          </div>
        </div>
      </div>

      <div class="pullquote">
        <p>같은 사주를 갖고 인생이 달라지는 것은, 결국 어느 자리에 앉느냐의 차이입니다.</p>
      </div>
    </section>

    <div class="word-count">
      <span class="han">完</span> · 10섹션 풀이 완료
    </div>

    <!-- ═════════════ Upsell (사주대화) ═════════════ -->
    <div class="upsell-card">
      <div class="label">DEEPER · 더 들어가보기</div>
      <h3>이 풀이를 두고 직접 물어보세요</h3>
      <p>"올해 9월에 정확히 뭘 조심해야 해?", "파트너로 만난 사람이 어떤 사주인지 비교하고 싶어" — 풀이를 보며 떠오른 질문을, 사주를 살피며 답해드려요.</p>
      <div class="cta">사주대화로 이어가기 →</div>
    </div>

    <!-- ═════════════ Footer (공유 + PDF) — 다른 결과 페이지 .actions 와 통일 ═════════════ -->
    <div class="result-footer">
      <div class="btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <div class="ti">친구에게 공유하고 운 받기</div>
        <div class="sb">+1운</div>
      </div>
      <div class="btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="18" x2="13" y2="18"/></svg>
        <div class="ti">PDF 파일 저장</div>
        <div class="sb">A4 풀리포트</div>
      </div>
    </div>

    <!-- ═════════════ 리포트의 지식 기반 안내 (fine-print) ═════════════ -->
    <div class="report-sources">
      <p>
        본 리포트는 <span class="book">『적천수(滴天髓)』</span>를 비롯한 사주명리 고전, 김만태 「한국 사주명리의 수용양상과 전개」(2011)를 포함한 현대 명리학 논문·통계 자료, 박청화 <span class="book">『춘하추동 신사주학』</span>을 비롯한 국내 명리 연구서를 지식 기반으로, 고성능 인공지능 응용 프로그램 인터페이스(API)가 당신의 원국·대운·연운에 맞춰 개인별로 생성한 풀이입니다.
      </p>
      <p class="notice-line">사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다. 의료·법률·재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.</p>
    </div>

  </div><!-- /.content -->
</div><!-- /.page-wrap -->

<!-- 좌측 인디케이터 -->
<div class="toc-side">
  <div class="dot"></div>
  <div class="dot"></div>
  <div class="dot"></div>
  <div class="dot active"></div>
  <div class="dot"></div>
  <div class="dot"></div>
  <div class="dot"></div>
  <div class="dot"></div>
</div>

<script>
  // ── 1) 좌측 인디케이터 활성화
  const sections = document.querySelectorAll('.section');
  const dots = document.querySelectorAll('.toc-side .dot');
  window.addEventListener('scroll', () => {
    let active = 0;
    sections.forEach((s, i) => {
      const top = s.getBoundingClientRect().top;
      if (top < window.innerHeight / 2) active = i;
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === active));
  });

  // ── 2) 섹션 아코디언: 각 .section 헤더에 토글 버튼 자동 삽입
  document.querySelectorAll('.section').forEach((sec, idx) => {
    const titleEl = sec.querySelector('.section-title');
    if (!titleEl) return;

    // 헤더 row 래핑
    const num = sec.querySelector('.section-num');
    const sub = sec.querySelector('.section-sub');
    const headFrag = document.createElement('div');
    headFrag.className = 'section-head-row';

    const headLeft = document.createElement('div');
    if (num) headLeft.appendChild(num);
    headLeft.appendChild(titleEl);
    if (sub) headLeft.appendChild(sub);

    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'sec-toggle';
    toggleBtn.setAttribute('aria-hidden', 'true');
    // 첫 섹션만 펼침, 나머지는 접힘 상태로 시작
    const startCollapsed = idx > 0;
    toggleBtn.innerHTML = startCollapsed
      ? '<span class="chev">▼</span> 펼치기'
      : '<span class="chev">▼</span> 접기';
    if (startCollapsed) toggleBtn.classList.add('collapsed');

    headFrag.appendChild(headLeft);
    headFrag.appendChild(toggleBtn);
    headFrag.setAttribute('role', 'button');
    headFrag.setAttribute('tabindex', '0');
    headFrag.setAttribute('aria-expanded', startCollapsed ? 'false' : 'true');
    sec.insertBefore(headFrag, sec.firstChild);

    // body 영역 = 헤더를 제외한 나머지를 wrap
    const body = document.createElement('div');
    body.className = 'section-body';
    if (startCollapsed) body.classList.add('collapsed');
    while (sec.children.length > 1) {
      body.appendChild(sec.children[1]);
    }
    sec.appendChild(body);

    // 헤더 row 전체를 탭 영역으로 사용 (60대+ 사용성)
    const toggle = () => {
      const collapsed = body.classList.toggle('collapsed');
      toggleBtn.classList.toggle('collapsed', collapsed);
      toggleBtn.innerHTML = collapsed
        ? '<span class="chev">▼</span> 펼치기'
        : '<span class="chev">▼</span> 접기';
      headFrag.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    };
    headFrag.addEventListener('click', toggle);
    headFrag.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
</script>
</body>
</html>
`;

// ─────────────────────────────────────────────────────────────────
// 사용자 데이터 주입 — MOCKUP_HTML 안의 변준기 placeholder 를 실제 데이터로 치환
// 디자인은 byte-perfect 그대로 유지, 사용자 정보만 swap
// ─────────────────────────────────────────────────────────────────
import type { SajuData, SajuInput, OhengType } from '@/types/saju';
import type { V4Daeun, V4SinSal } from './_data';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { analyzeRelations } from '@/services/saju/relations';

interface PersonalizeInput {
  name?: string;
  input?: SajuInput;
  sajuData?: SajuData;
  v4Daeun?: V4Daeun[];
  v4Gilsin?: V4SinSal[];
  v4Hyungsal?: V4SinSal[];
  scores?: Record<string, number>;
  aiResult?: any;
}

const OHENG_HANJA_LABEL: Record<string, string> = {
  목: '陽木', 화: '陽火', 토: '陽土', 금: '陽金', 수: '陽水',
};
const OHENG_EMOJI: Record<string, string> = {
  목: '🌳', 화: '🔥', 토: '⛰️', 금: '⚒️', 수: '🌊',
};
const OHENG_SYMBOL: Record<string, string> = {
  목: '큰 나무의 기운',
  화: '번지는 불의 기운',
  토: '굳건한 흙의 기운',
  금: '단단한 쇠의 기운',
  수: '흐르는 물의 기운',
};
const MONTH_SEASON: Record<string, string> = {
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
const HOUR_BRANCH_LABEL: Record<string, string> = {
  子: '자시(23:30~01:30)',
  丑: '축시(01:30~03:30)',
  寅: '인시(03:30~05:30)',
  卯: '묘시(05:30~07:30)',
  辰: '진시(07:30~09:30)',
  巳: '사시(09:30~11:30)',
  午: '오시(11:30~13:30)',
  未: '미시(13:30~15:30)',
  申: '신시(15:30~17:30)',
  酉: '유시(17:30~19:30)',
  戌: '술시(19:30~21:30)',
  亥: '해시(21:30~23:30)',
};

function buildBirthLine(input?: SajuInput, sajuData?: SajuData): string {
  if (!input) return '1995년 5월 12일 (양력) · 묘시(05:30~07:30)';
  const cal =
    input.calendarType === 'lunar' || input.calendarType === 'lunar_leap'
      ? '음력'
      : '양력';
  const datePart = `${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일 (${cal})`;
  if (!input.hasBirthTime) return `${datePart} · 시간 미입력`;
  // 시지 구하기 (sajuData.pillars[3] = 시주)
  const sijiZhi = sajuData?.pillars?.[3]?.지지 || '';
  const hourLabel = HOUR_BRANCH_LABEL[sijiZhi] || `${String(input.birthHour ?? 0).padStart(2, '0')}:${String(input.birthMinute ?? 0).padStart(2, '0')}`;
  return `${datePart} · ${hourLabel}`;
}

function todayDateText(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} 풀이`;
}

/** mockup HTML 의 변준기 placeholder 를 실제 사용자 데이터로 치환 (전수조사 모드) */
function personalize(html: string, p: PersonalizeInput): string {
  const fullName = p.name || '회원';
  const shortName =
    fullName.length >= 3 ? fullName.substring(fullName.length - 2) : fullName;
  const ilgan = p.sajuData?.pillars?.[2]?.천간 || '甲';
  const ilganRead = p.sajuData?.pillars?.[2]?.천간읽기 || '갑';
  const ilganOheng = (ilgan ? CHEONGAN_OHENG[ilgan] : '목') as OhengType;
  const ohengLabel = OHENG_HANJA_LABEL[ilganOheng] || '陽木';
  const yinYangOhengKr =
    p.sajuData?.pillars?.[2]?.천간음양 === '음'
      ? `음${ilganOheng}`
      : `양${ilganOheng}`;
  const ohengEmoji = OHENG_EMOJI[ilganOheng] || '🌳';
  const ohengSymbol = OHENG_SYMBOL[ilganOheng] || '큰 나무의 기운';
  const monthZhi = p.sajuData?.pillars?.[1]?.지지 || '巳';
  const seasonText = MONTH_SEASON[monthZhi] || '봄의 끝자락';
  const birthLine = buildBirthLine(p.input, p.sajuData);
  const todayLine = todayDateText();
  // AI 응답을 함수 전체에서 사용하기 위해 최상단에 hoisting
  const ai = p.aiResult;

  let out = html;

  // ═════════════════ Phase 1: Header + Hero ═════════════════
  out = out.replace(
    '<div class="title">변준기 님의 사주 풀이</div>',
    `<div class="title">${fullName} 님의 사주 풀이</div>`,
  );
  out = out.replace(
    '<div class="person">변준기</div>',
    `<div class="person">${fullName}</div>`,
  );
  out = out.replace(
    '<div class="birth">1995년 5월 12일 (양력) · 묘시(05:30~07:30)</div>',
    `<div class="birth">${birthLine}</div>`,
  );
  out = out.replace(
    /<span class="hanja">甲<\/span>\s*<span class="label">일간 갑\(甲\) · 양목\(陽木\)<\/span>/,
    `<span class="hanja">${ilgan}</span>\n        <span class="label">일간 ${ilganRead}(${ilgan}) · ${yinYangOhengKr}(${ohengLabel})</span>`,
  );
  out = out.replace(
    '<span>🌳 큰 나무의 기운</span>',
    `<span>${ohengEmoji} ${ohengSymbol}</span>`,
  );
  out = out.replace('<span>봄의 끝자락</span>', `<span>${seasonText}</span>`);
  out = out.replace(
    '<span>2026.04.20 풀이</span>',
    `<span>${todayLine}</span>`,
  );

  // ═════════════════ Phase 2: Wongug 8글자 (시·일·월·연 천간/지지) ═════════════════
  // sajuData.pillars 순서: [년, 월, 일, 시] / mockup 표시 순서: [시, 일, 월, 연] = [3, 2, 1, 0]
  const pillars = p.sajuData?.pillars;
  if (pillars && pillars.length >= 4) {
    const order = [3, 2, 1, 0]; // 시, 일, 월, 연
    const newCells = order
      .map((idx) => {
        const pl = pillars[idx];
        if (!pl?.available) return null;
        return pl;
      })
      .filter(Boolean);

    if (newCells.length === 4) {
      const dayOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
      const ohengToCls: Record<string, string> = {
        목: 'mok', 화: 'hwa', 토: 'to', 금: 'geum', 수: 'su',
      };
      const sipsungOf = (target: OhengType, isIlganGan: boolean): string => {
        if (isIlganGan) return '일간';
        return getSipsungSimple(dayOheng, target);
      };
      // 천간 4 cells
      const ganCells = order
        .map((idx) => {
          const pl = pillars[idx];
          const isIlju = idx === 2;
          const cls = ohengToCls[pl.천간오행 || '토'] || 'to';
          const yumYY = pl.천간음양 === '음' ? '음' : '양';
          const yumOheng =
            cls === 'mok' ? '목'
              : cls === 'hwa' ? '화'
                : cls === 'to' ? '토'
                  : cls === 'geum' ? '금'
                    : '수';
          const sip = sipsungOf((pl.천간오행 || '토') as OhengType, isIlju);
          const yumSuffix = isIlju ? ' (나)' : '';
          return `<div class="wongug-cell${isIlju ? ' ilju' : ''}">
  <div class="sip-tag">${sip}</div>
  <div class="glyph ${cls}">${pl.천간 || '?'}</div><div class="yum">${pl.천간읽기 || ''} / ${yumYY}${yumOheng}${yumSuffix}</div>
</div>`;
        })
        .join('\n          ');

      // 지지 4 cells
      const jiCells = order
        .map((idx) => {
          const pl = pillars[idx];
          const isIlju = idx === 2;
          const cls = ohengToCls[pl.지지오행 || '토'] || 'to';
          const yumYY = pl.지지음양 === '음' ? '음' : '양';
          const yumOheng =
            cls === 'mok' ? '목'
              : cls === 'hwa' ? '화'
                : cls === 'to' ? '토'
                  : cls === 'geum' ? '금'
                    : '수';
          const sip = sipsungOf((pl.지지오행 || '토') as OhengType, false);
          return `<div class="wongug-cell${isIlju ? ' ilju' : ''}">
  <div class="sip-tag">${sip}</div>
  <div class="glyph ${cls}">${pl.지지 || '?'}</div><div class="yum">${pl.지지읽기 || ''} / ${yumYY}${yumOheng}</div>
</div>`;
        })
        .join('\n          ');

      // 8 cells block 통째 교체 — 천간 row 시작부터 마지막 cell 까지
      const wongugRe =
        /<div class="row-label">천간<\/div>[\s\S]*?<div class="wongug-cell">\s*<div class="sip-tag">편인<\/div>\s*<div class="glyph su">亥<\/div><div class="yum">해 \/ 음수<\/div>\s*<\/div>/;
      out = out.replace(
        wongugRe,
        `<div class="row-label">천간</div>
          ${ganCells}

          <div class="row-label">지지</div>
          ${jiCells}`,
      );
    }
  }

  // ═════════════════ Phase 3·4·5: 오행 분포 + 음양 + Ohaeng-diag — indexOf 기반 robust replace ═════════════════
  const elements = p.sajuData?.elements;
  if (elements) {
    const counts: Record<OhengType, number> = {
      목: Number(elements.목 ?? 0),
      화: Number(elements.화 ?? 0),
      토: Number(elements.토 ?? 0),
      금: Number(elements.금 ?? 0),
      수: Number(elements.수 ?? 0),
    };
    const total = counts.목 + counts.화 + counts.토 + counts.금 + counts.수 || 1;
    const pct = (k: OhengType) => ((counts[k] / total) * 100).toFixed(1);

    // 음양 카운트
    let yang = 0, yin = 0;
    for (const pl of pillars || []) {
      if (!pl.available) continue;
      if (pl.천간음양 === '양') yang++; else yin++;
      if (pl.지지음양 === '양') yang++; else yin++;
    }
    const yyTotal = yang + yin || 1;
    const yangPct = ((yang / yyTotal) * 100).toFixed(1);
    const yinPct = ((yin / yyTotal) * 100).toFixed(1);
    const yyCaption =
      Math.abs(yang - yin) <= 1
        ? `양이 ${yang}, 음이 ${yin}. 움직이는 힘과 가라앉히는 힘이 균형 잡힌 구조입니다.`
        : yang > yin
          ? `양이 ${yang}, 음이 ${yin}. 움직이는 힘이 앞서고 가라앉히는 힘이 뒤따르는 구조입니다.`
          : `양이 ${yang}, 음이 ${yin}. 가라앉히는 힘이 앞서고 움직이는 힘이 뒤따르는 구조입니다.`;

    // Ohaeng-diag tier
    const tier = (c: number) => {
      if (c >= 3) return { cellCls: ' strong', labelCls: ' s', label: '태과' };
      if (c === 2) return { cellCls: '', labelCls: '', label: '중' };
      if (c === 1) return { cellCls: ' weak', labelCls: ' w', label: '약' };
      return { cellCls: ' weak', labelCls: ' w', label: '미' };
    };
    const dotsHtml = (c: number) =>
      [0, 1, 2, 3, 4]
        .map((i) => (i < c ? '<span class="on"></span>' : '<span></span>'))
        .join('');
    const diagRow = (k: OhengType, han: string, cls: string) => {
      const c = counts[k];
      const t = tier(c);
      return `<div class="od-cell${t.cellCls}">
            <div class="od-han ${cls}">${han}</div>
            <div class="od-dots">${dotsHtml(c)}</div>
            <div class="od-label${t.labelCls}">${t.label}</div>
          </div>`;
    };

    // ─ Indexof 기반 슬라이스
    const startIdx = out.indexOf('<div class="ohaeng-chart">');
    const endIdx = out.indexOf('<!-- 오행 레이더 차트 -->');
    if (startIdx >= 0 && endIdx > startIdx) {
      const before = out.substring(0, startIdx);
      const after = out.substring(endIdx);
      const replaced = `<div class="ohaeng-chart">
          <div class="title">오행 분포 (8글자 기준)</div>
          <div class="ohaeng-bar o-mok">
            <span class="o-label">木</span>
            <div class="o-track"><div class="o-fill" style="width: ${pct('목')}%"></div></div>
            <span class="o-count">${counts.목}</span>
          </div>
          <div class="ohaeng-bar o-hwa">
            <span class="o-label">火</span>
            <div class="o-track"><div class="o-fill" style="width: ${pct('화')}%"></div></div>
            <span class="o-count">${counts.화}</span>
          </div>
          <div class="ohaeng-bar o-to">
            <span class="o-label">土</span>
            <div class="o-track"><div class="o-fill" style="width: ${pct('토')}%"></div></div>
            <span class="o-count">${counts.토}</span>
          </div>
          <div class="ohaeng-bar o-geum">
            <span class="o-label">金</span>
            <div class="o-track"><div class="o-fill" style="width: ${pct('금')}%"></div></div>
            <span class="o-count">${counts.금}</span>
          </div>
          <div class="ohaeng-bar o-su">
            <span class="o-label">水</span>
            <div class="o-track"><div class="o-fill" style="width: ${pct('수')}%"></div></div>
            <span class="o-count">${counts.수}</span>
          </div>
        </div>

        <div class="yin-yang-card">
          <div class="yy-title">음양 균형</div>
          <div class="yy-bar">
            <div class="yang" style="width: ${yangPct}%">양 ${yang}</div>
            <div class="yin" style="width: ${yinPct}%">음 ${yin}</div>
          </div>
          <div class="yy-caption">${yyCaption}</div>
        </div>

        <div class="ohaeng-diag">
          ${diagRow('목', '木', 'mok')}
          ${diagRow('화', '火', 'hwa')}
          ${diagRow('토', '土', 'to')}
          ${diagRow('금', '金', 'geum')}
          ${diagRow('수', '水', 'su')}
        </div>

        `;
      out = before + replaced + after;
    }
  }

  // ═════════════════ Phase 6: Ohaeng-radar SVG (5 vertex polygon + value labels) ═════════════════
  if (elements) {
    const counts: Record<OhengType, number> = {
      목: Number(elements.목 ?? 0),
      화: Number(elements.화 ?? 0),
      토: Number(elements.토 ?? 0),
      금: Number(elements.금 ?? 0),
      수: Number(elements.수 ?? 0),
    };
    // 5 vertex unit vectors (mockup 동일): 木 top, 火 top-right, 土 bottom-right, 金 bottom-left, 水 top-left
    // 중심 (130, 128), R=88
    const cx = 130, cy = 128, R = 88;
    const dirs: Array<{ key: OhengType; dx: number; dy: number; color: string }> = [
      { key: '목', dx: 0,        dy: -1,    color: '#2e7d32' },
      { key: '화', dx: 0.9511,   dy: -0.309, color: '#c62828' },
      { key: '토', dx: 0.5878,   dy: 0.809,  color: '#7F6B4E' },
      { key: '금', dx: -0.5878,  dy: 0.809,  color: '#757575' },
      { key: '수', dx: -0.9511,  dy: -0.309, color: '#1565c0' },
    ];
    const dataPts = dirs.map((d) => {
      const c = Math.min(5, Math.max(0, counts[d.key]));
      const r = (c / 5) * R;
      return { x: cx + d.dx * r, y: cy + d.dy * r, count: c, color: d.color, key: d.key };
    });
    const polyPoints = dataPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const circles = dataPts
      .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${p.color}"/>`)
      .join('\n            ');
    const valueLabels = dataPts
      .map((p, i) => {
        const d = dirs[i];
        const isLeft = d.dx < -0.3;
        const dx = isLeft ? -12 : 7;
        const dy = d.dy < -0.6 ? -3 : 0;
        return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" dx="${dx}" dy="${dy}">${p.count}</text>`;
      })
      .join('\n              ');

    // 데이터 폴리곤 + 점 + 값 라벨 통째 교체
    const radarRe =
      /<polygon points="130,75\.2 163\.5,117\.1 140\.3,142\.2 119\.7,142\.2 113\.3,122\.6"[\s\S]*?<text x="113\.3" y="122\.6" dx="-12" dy="0">1<\/text>/;
    const newRadarBlock = `<polygon points="${polyPoints}"
                     fill="rgba(212,175,55,0.18)"
                     stroke="#E8D9B8" stroke-width="1.6"/>
            <!-- 데이터 점 -->
            ${circles}
            <!-- 오행 라벨 -->
            <g font-family="'Noto Serif KR', serif" font-size="13" font-weight="700">
              <text x="130" y="28"  text-anchor="middle" fill="#2e7d32">木</text>
              <text x="225" y="103" text-anchor="middle" fill="#c62828">火</text>
              <text x="190" y="218" text-anchor="middle" fill="#7F6B4E">土</text>
              <text x="70"  y="218" text-anchor="middle" fill="#757575">金</text>
              <text x="35"  y="103" text-anchor="middle" fill="#1565c0">水</text>
            </g>
            <!-- 데이터 값 라벨 -->
            <g font-family="-apple-system, sans-serif" font-size="9.5" fill="#a08a5a" font-weight="700">
              ${valueLabels}`;
    out = out.replace(radarRe, newRadarBlock);
  }

  // ═════════════════ Phase 7: Daewoon-timeline 8 cells (gan/ji/age/label) ═════════════════
  const v4 = p.v4Daeun;
  if (v4 && v4.length >= 1) {
    const labels = ['유년', '학창', '진출', '현재', '전환', '결실', '정리', '관조'];
    const HAN_COLOR: Record<string, string> = {
      甲: '#2e7d32', 乙: '#2e7d32', 寅: '#2e7d32', 卯: '#2e7d32',
      丙: '#c62828', 丁: '#c62828', 巳: '#c62828', 午: '#c62828',
      戊: '#7F6B4E', 己: '#7F6B4E', 辰: '#7F6B4E', 戌: '#7F6B4E', 丑: '#7F6B4E', 未: '#7F6B4E',
      庚: '#757575', 辛: '#757575', 申: '#757575', 酉: '#757575',
      壬: '#1565c0', 癸: '#1565c0', 亥: '#1565c0', 子: '#1565c0',
    };
    const cells = labels
      .map((label, i) => {
        const d = v4[i];
        if (!d) return `<div class="dw-cell"><div class="age">—</div><div class="gan">·</div><div class="ji">·</div><div class="label">${label}</div></div>`;
        const gan = d.gz?.[0] || '';
        const ji = d.gz?.[1] || '';
        const ganColor = HAN_COLOR[gan] || '#7F6B4E';
        const jiColor = HAN_COLOR[ji] || '#5C4A2E';
        const isNow = d.current;
        return `<div class="dw-cell${isNow ? ' now' : ''}"><div class="age">${d.age || ''}</div><div class="gan" style="color: ${ganColor}">${gan}</div><div class="ji" style="color: ${jiColor}">${ji}</div><div class="label">${isNow ? '현재' : label}</div></div>`;
      })
      .join('');
    const dwRe =
      /<div class="daewoon-row">[\s\S]*?<div class="dw-cell"><div class="age">71~80세<\/div><div class="gan">己<\/div><div class="ji">丑<\/div><div class="label">관조<\/div><\/div>\s*<\/div>/;
    out = out.replace(
      dwRe,
      `<div class="daewoon-row">${cells}</div>`,
    );
  }

  // ═════════════════ Phase 8: Topic-mini-grid 5 cards (점수 + desc 모두 동적) ═════════════════
  const sc = p.scores;
  if (sc) {
    const wealth = Math.round(sc.wealth ?? 70);
    const love = Math.round(sc.love ?? 65);
    const career = Math.round(sc.career ?? 75);
    const health = Math.round(sc.health ?? 65);
    const social = Math.round(sc.social ?? 70);

    // AI topicMini desc 우선, 없으면 점수 기반 templated
    const aiTopicMini = ai?.topicMini as Record<string, { desc?: string }> | undefined;
    const descByScore = (k: 'wealth' | 'love' | 'career' | 'health' | 'social', score: number): string => {
      const FALLBACK: Record<string, { high: string; mid: string; low: string }> = {
        wealth: {
          high: `재성이 두꺼운 결. 흐름을 잘 잡으면 자산이 빠르게 쌓입니다.`,
          mid: `재물이 들고남이 균형 잡힌 결. 안정과 도전을 분기별로 나누세요.`,
          low: `벌리는 재능보다 쌓이는 자리가 얇은 결. 시스템 저축이 핵심.`,
        },
        love: {
          high: `사람을 끄는 결이 도드라집니다. 깊이 가는 인연이 ${shortName} 님에게 잘 옵니다.`,
          mid: `자연스럽게 흐르는 인연. 결정의 시기를 의식적으로 두세요.`,
          low: `안에 담아두는 결. 표현 채널을 의식적으로 굴려야 풀려요.`,
        },
        career: {
          high: `본인 색깔이 뚜렷한 결. 이름이 붙는 자리에서 빛납니다.`,
          mid: `여러 결을 다룰 수 있는 사주. 한 분야 깊이가 다음 단계.`,
          low: `현재 자리에서 한 발 더 들어가는 시간이 필요. 전문성을 한 줄로 좁히세요.`,
        },
        health: {
          high: `체력·회복력이 단단한 결. 무리하지 않으면 오래 갑니다.`,
          mid: `보통 체력. 정기 검진과 루틴이 자산입니다.`,
          low: `번아웃이 또렷한 결. 안 하는 시간을 캘린더에 먼저 박으세요.`,
        },
        social: {
          high: `관계 자리가 넓고 두꺼운 결. 인연이 자산이지만 거리 조절도 필요.`,
          mid: `관계의 균형이 잡힌 결. 본가·일·친구 간 거리를 의식적으로.`,
          low: `소수에 깊게 가는 결. 가까운 사람 한두 명과 길게 가세요.`,
        },
      };
      const tier = score >= 75 ? 'high' : score < 60 ? 'low' : 'mid';
      return FALLBACK[k][tier];
    };
    const descOf = (k: 'wealth' | 'love' | 'career' | 'health' | 'social', score: number): string =>
      aiTopicMini?.[k]?.desc?.trim() || descByScore(k, score);

    out = out.replace(
      /<div class="topic-mini">\s*<div class="tm-head"><span class="tm-ttl">재물<\/span><span class="tm-score">72<\/span><\/div>\s*<div class="tm-bar"><div class="tm-fill" style="width: 72%"><\/div><\/div>\s*<div class="tm-desc">[\s\S]*?<\/div>/,
      `<div class="topic-mini">
          <div class="tm-head"><span class="tm-ttl">재물</span><span class="tm-score">${wealth}</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: ${wealth}%"></div></div>
          <div class="tm-desc">${descOf('wealth', wealth)}</div>`,
    );
    out = out.replace(
      /<div class="topic-mini">\s*<div class="tm-head"><span class="tm-ttl">사랑<\/span><span class="tm-score">68<\/span><\/div>\s*<div class="tm-bar"><div class="tm-fill" style="width: 68%"><\/div><\/div>\s*<div class="tm-desc">[\s\S]*?<\/div>/,
      `<div class="topic-mini">
          <div class="tm-head"><span class="tm-ttl">사랑</span><span class="tm-score">${love}</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: ${love}%"></div></div>
          <div class="tm-desc">${descOf('love', love)}</div>`,
    );
    out = out.replace(
      /<div class="topic-mini">\s*<div class="tm-head"><span class="tm-ttl">직업<\/span><span class="tm-score">81<\/span><\/div>\s*<div class="tm-bar"><div class="tm-fill" style="width: 81%"><\/div><\/div>\s*<div class="tm-desc">[\s\S]*?<\/div>/,
      `<div class="topic-mini">
          <div class="tm-head"><span class="tm-ttl">직업</span><span class="tm-score">${career}</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: ${career}%"></div></div>
          <div class="tm-desc">${descOf('career', career)}</div>`,
    );
    out = out.replace(
      /<div class="topic-mini">\s*<div class="tm-head"><span class="tm-ttl">건강<\/span><span class="tm-score">64<\/span><\/div>\s*<div class="tm-bar"><div class="tm-fill" style="width: 64%"><\/div><\/div>\s*<div class="tm-desc">[\s\S]*?<\/div>/,
      `<div class="topic-mini">
          <div class="tm-head"><span class="tm-ttl">건강</span><span class="tm-score">${health}</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: ${health}%"></div></div>
          <div class="tm-desc">${descOf('health', health)}</div>`,
    );
    out = out.replace(
      /<div class="topic-mini full">\s*<div class="tm-head"><span class="tm-ttl">가족·관계<\/span><span class="tm-score">70<\/span><\/div>\s*<div class="tm-bar"><div class="tm-fill" style="width: 70%"><\/div><\/div>\s*<div class="tm-desc">[\s\S]*?<\/div>/,
      `<div class="topic-mini full">
          <div class="tm-head"><span class="tm-ttl">가족·관계</span><span class="tm-score">${social}</span></div>
          <div class="tm-bar"><div class="tm-fill" style="width: ${social}%"></div></div>
          <div class="tm-desc">${descOf('social', social)}</div>`,
    );
  }

  // ═════════════════ Phase 8a: §02 Ganji-flow — 사용자 합·충·형 관계 동적 ═════════════════
  if (pillars && pillars.length >= 4 && p.sajuData) {
    try {
      const rel = analyzeRelations(
        p.sajuData.pillars,
        (p.sajuData as any).gongmang,
      );
      const HAN_COLOR: Record<string, string> = {
        甲: '#2e7d32', 乙: '#2e7d32', 寅: '#2e7d32', 卯: '#2e7d32',
        丙: '#c62828', 丁: '#c62828', 巳: '#c62828', 午: '#c62828',
        戊: '#7F6B4E', 己: '#7F6B4E', 辰: '#7F6B4E', 戌: '#7F6B4E', 丑: '#7F6B4E', 未: '#7F6B4E',
        庚: '#757575', 辛: '#757575', 申: '#757575', 酉: '#757575',
        壬: '#1565c0', 癸: '#1565c0', 亥: '#1565c0', 子: '#1565c0',
      };
      type Row = {
        char1: string;
        char2: string;
        arrow: string;
        desc: string;
        type: 'hap' | 'chung' | 'hyeong';
      };
      const seen = new Set<string>();
      const rows: Row[] = [];
      const pushOnce = (row: Row, sub: string) => {
        const key = [row.char1, row.char2].sort().join('-') + '::' + sub;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(row);
      };
      for (const r of rel.cheongan.filter((x: any) => x.type === '천간합')) {
        pushOnce({
          char1: r.chars[0], char2: r.chars[1], arrow: '↔',
          desc: `${r.chars.join('')}합 — ${r.resultOheng ? `${r.resultOheng} 기운으로 묶이는 자리` : '결합되는 자리'}`,
          type: 'hap',
        }, '천간합');
      }
      for (const r of rel.jijiHap) {
        const isBan = r.type?.includes('반합');
        pushOnce({
          char1: r.chars[0], char2: r.chars[1], arrow: isBan ? '+' : '↔',
          desc: `${r.chars.join('')}${isBan ? ' 반합' : '합'}${r.resultOheng ? ` — ${r.resultOheng} 기운으로 묶이는 자리` : ''}`,
          type: 'hap',
        }, isBan ? '지지반합' : '지지합');
      }
      for (const r of rel.cheongan.filter((x: any) => x.type === '천간충')) {
        pushOnce({
          char1: r.chars[0], char2: r.chars[1], arrow: '↔',
          desc: `${r.chars.join('')}충 — 마음이 부딪히는 자리`,
          type: 'chung',
        }, '천간충');
      }
      for (const r of rel.jijiClash.filter((x: any) => x.type === '지지충')) {
        pushOnce({
          char1: r.chars[0], char2: r.chars[1], arrow: '↔',
          desc: `${r.chars.join('')}충 — 행동 방향이 부딪히는 자리`,
          type: 'chung',
        }, '지지충');
      }
      for (const r of rel.jijiClash.filter((x: any) => x.type !== '지지충')) {
        const t = r.type || '';
        const subtype = t.includes('자형') ? '자형'
          : t.includes('형') ? '형'
            : t.includes('파') ? '파'
              : t.includes('해') ? '해'
                : t.includes('원진') ? '원진' : t;
        const arrow = t.includes('형') ? '↔' : t.includes('파') ? '/' : t.includes('해') ? '✕' : t.includes('원진') ? '↺' : '↔';
        pushOnce({
          char1: r.chars[0], char2: r.chars[1] || r.chars[0], arrow,
          desc: t.includes('자형') ? '자형(自刑) — 자기 자신과 부딪히는 자리'
            : t.includes('형') ? `${r.chars.join('')}형 — 결이 어긋나는 자리`
              : t.includes('파') ? `${r.chars.join('')}파 — 흐트러지는 자리`
                : t.includes('해') ? `${r.chars.join('')}해 — 풀리지 않는 자리`
                  : t.includes('원진') ? `${r.chars.join('')}원진 — 잠재된 갈등의 자리`
                    : `${r.chars.join('')} — 결이 어긋나는 자리`,
          type: 'hyeong',
        }, subtype);
      }

      const tagOf = (t: 'hap' | 'chung' | 'hyeong') =>
        t === 'hap' ? { cls: 'hap', label: '합' }
          : t === 'chung' ? { cls: 'chung', label: '충' }
            : { cls: 'hyeong', label: '형' };

      const flowRowsHtml = rows.length > 0
        ? rows
          .map((r) => {
            const tag = tagOf(r.type);
            const c1 = HAN_COLOR[r.char1] || '#7F6B4E';
            const c2 = HAN_COLOR[r.char2] || '#7F6B4E';
            return `<div class="gf-row">
          <span class="gf-glyph" style="color:${c1}">${r.char1}</span>
          <span class="gf-arrow">${r.arrow}</span>
          <span class="gf-glyph" style="color:${c2}">${r.char2}</span>
          <span style="color:#5C4A2E">${r.desc}</span>
          <span class="gf-type ${tag.cls}">${tag.label}</span>
        </div>`;
          })
          .join('\n        ')
        : `<div class="gf-row"><span style="color:#7F6B4E; font-size:11.5px;">8글자 사이에 도드라진 합·충·형 관계는 약합니다 — 균형 잡힌 결.</span></div>`;

      const flowRe =
        /<div class="ganji-flow">[\s\S]*?<\/div>\s*<\/div>\s*<p>/;
      out = out.replace(
        flowRe,
        `<div class="ganji-flow">
        <div class="gf-title">사주에 새겨진 글자 간 관계</div>
        ${flowRowsHtml}
      </div>

      <p>`,
      );
    } catch (_e) {
      // analyzeRelations 실패 시 mockup fallback 유지
    }
  }

  // ═════════════════ Phase 8b: §03 Sip-donut + sip-cluster header — 사용자 십성 분포 ═════════════════
  if (pillars && pillars.length >= 4) {
    const dayOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const SIP_OF = (target: OhengType): string => getSipsungSimple(dayOheng, target);
    const dist = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 } as Record<string, number>;
    for (const pl of pillars) {
      if (!pl.available) continue;
      const ganCat = SIP_OF(pl.천간오행 as OhengType);
      const jiCat = SIP_OF(pl.지지오행 as OhengType);
      if (ganCat in dist) dist[ganCat]++;
      if (jiCat in dist) dist[jiCat]++;
    }
    const totalSip = dist.비겁 + dist.식상 + dist.재성 + dist.관성 + dist.인성 || 1;
    const pctOf = (k: string) => Math.round((dist[k] / totalSip) * 1000) / 10;

    // 가장 두꺼운 무리 추출
    const sipOrder = (Object.entries(dist) as [string, number][]).sort((a, b) => b[1] - a[1]);
    const dominantSip = sipOrder[0]?.[0] || '식상';

    // ─ Sip-donut 5 slices (stroke-dasharray)
    const SIP_COLORS: Record<string, string> = {
      식상: '#c62828',
      비겁: '#2e7d32',
      재성: '#7F6B4E',
      관성: '#757575',
      인성: '#1565c0',
    };
    const ORDER: Array<keyof typeof SIP_COLORS> = ['식상', '비겁', '재성', '관성', '인성'];
    let cum = 0;
    const slices = ORDER.map((k) => {
      const pct = pctOf(k);
      const start = cum;
      cum += pct;
      return { k, pct, start, color: SIP_COLORS[k] };
    });
    const slicesSvg = slices
      .filter((s) => s.pct > 0)
      .map(
        (s) =>
          `<circle cx="18" cy="18" r="15.915" fill="transparent" stroke="${s.color}" stroke-width="3.6" stroke-dasharray="${s.pct} ${100 - s.pct}" stroke-dashoffset="${(25 - s.start).toFixed(2)}"/>`,
      )
      .join('\n          ');
    const legendRows = slices
      .map(
        (s) =>
          `<div class="sd-row"><span class="sd-swatch" style="background:${s.color}"></span><span class="sd-name">${s.k}</span><span class="sd-bar"><span class="sd-fill" style="width:${s.pct}%; background:${s.color}; display:block;"></span></span><span class="sd-pct">${s.pct}%</span></div>`,
      )
      .join('\n          ');

    const donutRe =
      /<div class="sip-donut">[\s\S]*?<\/div>\s*<\/div>\s*<!-- 식상 — 가장 두꺼운 무리 -->/;
    const donutBlock = `<div class="sip-donut">
        <svg class="sd-svg" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="15.915" fill="#fff" stroke="#E5DFD0" stroke-width="3.6"/>
          ${slicesSvg}
          <text x="18" y="20" text-anchor="middle" font-size="5" fill="#1a1a1a" font-weight="700" font-family="'Noto Serif KR', serif">十神</text>
        </svg>
        <div class="sd-legend">
          ${legendRows}
        </div>
      </div>

      <!-- 십성 분포 카드 -->`;
    out = out.replace(donutRe, donutBlock);

    // ─ §03 첫 paragraph 의 "식상이 가장 두텁습니다" → 동적 클러스터
    out = out.replace(
      /다섯 무리\(<strong>비겁·식상·재성·관성·인성<\/strong>\)로 묶이며, 준기 님 사주에서는 <strong>식상<\/strong>이 가장 두텁습니다\./,
      `다섯 무리(<strong>비겁·식상·재성·관성·인성</strong>)로 묶이며, ${shortName} 님 사주에서는 <strong>${dominantSip}</strong>이 가장 두텁습니다.`,
    );
  }

  // ═════════════════ Phase 9: AI 섹션 본문 주입 (실제 분석 narrative) ═════════════════
  // premium AI 응답 (claudePremium.ts) 의 sections:
  //   summary(원국) / structure(천간지지) / sipsung(십성) / yongsin(용신·조후)
  //   daeun(대운) / yearly(연운) / practice(실천)
  // 각 섹션의 AI content 를 mockup paragraph 슬롯에 주입 → 사용자별 진짜 분석 본문
  const aiSections: Record<string, string> = {};
  if (ai?.sections && Array.isArray(ai.sections)) {
    for (const s of ai.sections) {
      if (s?.id && typeof s.content === 'string') {
        aiSections[s.id] = s.content;
      }
    }
  }
  // top-level summary 도 후보
  if (typeof ai?.summary === 'string' && !aiSections.summary) {
    aiSections.summary = ai.summary;
  }

  // 본문 → <p> 블록 (단락 분리: \n\n / \n / 문장 끝)
  const toParas = (text: string): string => {
    if (!text) return '';
    return text
      .split(/\n{2,}|\r\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => `<p>${s.replace(/\n/g, ' ')}</p>`)
      .join('\n      ');
  };

  // ─ 공통 helper: 같은 카운트 핸들링
  const ohHan: Record<string, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  const ohKr2: Record<string, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const monthSeason: Record<string, string> = {
    寅: '입춘 무렵', 卯: '봄의 한가운데', 辰: '봄의 끝자락',
    巳: '초여름', 午: '한여름', 未: '여름의 끝자락',
    申: '초가을', 酉: '가을의 한가운데', 戌: '가을의 끝자락',
    亥: '초겨울', 子: '한겨울', 丑: '겨울의 끝자락',
  };
  function getOhSummary() {
    if (!elements) return null;
    const cnt = {
      목: Number(elements.목 ?? 0), 화: Number(elements.화 ?? 0),
      토: Number(elements.토 ?? 0), 금: Number(elements.금 ?? 0),
      수: Number(elements.수 ?? 0),
    };
    const sorted = (Object.entries(cnt) as [OhengType, number][]).sort((a, b) => b[1] - a[1]);
    const maxC = sorted[0][1];
    const minC = sorted[sorted.length - 1][1];
    const tops = sorted.filter((s) => s[1] === maxC).map((s) => s[0]);
    const bottoms = sorted.filter((s) => s[1] === minC).map((s) => s[0]);
    const topsLabel = tops.map((k) => `${ohHan[k]}(${ohKr2[k]})`).join('·');
    const bottomsLabel = bottoms.map((k) => `${ohHan[k]}(${ohKr2[k]})`).join('·');
    return { cnt, sorted, maxC, minC, tops, bottoms, topsLabel, bottomsLabel };
  }

  // ─ Fallback templated narrative builder (AI 응답 없을 때 mockup 변준기 텍스트 대신)
  function buildSummaryFallback(): string {
    if (!pillars || pillars.length < 4 || !elements) return '';
    const oh = getOhSummary();
    if (!oh) return '';
    const monthZhi = pillars[1]?.지지 || '';
    const season = monthSeason[monthZhi] || '계절의 흐름';
    const monthRead = pillars[1]?.지지읽기 || '';
    const totalActive = pillars.filter((pl) => pl.available).length * 2; // 천간 + 지지

    // 같은 카운트 처리: 가장 많은/적은 오행이 여러 개일 수 있음
    const dominantPhrase = oh.tops.length === 1
      ? `${ohHan[oh.tops[0]]}(${ohKr2[oh.tops[0]]})이 ${oh.maxC}자`
      : `${oh.topsLabel}이 각각 ${oh.maxC}자씩 함께`;
    const weakestPhrase = oh.bottoms.length === 1
      ? `${ohHan[oh.bottoms[0]]}(${ohKr2[oh.bottoms[0]]})이 ${oh.minC}자`
      : `${oh.bottomsLabel}이 각각 ${oh.minC}자로 같이`;
    const advicePhrase = oh.minC === 0
      ? `이 오행이 비어있는 결입니다. 의식적으로 채우는 자리가 평생 자산이 됩니다.`
      : oh.maxC === oh.minC
        ? `오행이 균형 잡힌 결입니다. 한쪽으로 치우치지 않는 게 강점입니다.`
        : `강점을 살리는 자리에 본인을 두되, 부족한 결은 의식적으로 채우세요.`;

    return `<p>${shortName} 님의 일간은 <strong>${ilganRead}(${ilgan})</strong>입니다. 일간이 곧 본인의 색깔이고, 다른 ${totalActive - 1}글자가 그 색깔을 어떻게 살리느냐가 인생의 결을 만듭니다.</p>
      <p>태어난 달이 <strong>${monthRead}월(${monthZhi}月)</strong>이라 발아래에는 <strong>${season}</strong>의 기운이 깔려 있습니다. 일간 ${ilgan}이 그 기운 속에서 어떻게 작동하느냐가 본인의 핵심 결입니다.</p>
      <p>여덟 글자에 <strong>${dominantPhrase}</strong>로 가장 두텁고, <strong>${weakestPhrase}</strong> 가장 얇습니다. ${advicePhrase} ※ AI 본문이 비어있어 사주 구조 기반 약식 풀이로 표시됩니다 — 새 풀이를 받으면 AI 가 작성한 풀 본문이 들어옵니다.</p>`;
  }
  function buildStructureFallback(): string {
    if (!pillars || pillars.length < 4) return '';
    const ganChars = [3, 2, 1, 0].map((i) => pillars[i]?.천간).filter(Boolean).join(' ');
    const jiChars = [3, 2, 1, 0].map((i) => pillars[i]?.지지).filter(Boolean).join(' ');
    const ganOhengs = [3, 2, 1, 0].map((i) => pillars[i]?.천간오행).filter(Boolean).join('·');
    const jiOhengs = [3, 2, 1, 0].map((i) => pillars[i]?.지지오행).filter(Boolean).join('·');
    return `<p>천간(天干)은 <strong>마음·사고</strong>이고, 지지(地支)는 <strong>행동·본능</strong>입니다. ${shortName} 님 천간 줄은 <strong>${ganChars}</strong>(${ganOhengs}), 지지 줄은 <strong>${jiChars}</strong>(${jiOhengs}).</p>
      <p>일간 <strong>${ilgan}</strong>을 중심으로 둘레의 글자들이 어떻게 짜여 있느냐가 본인의 마음 결과 행동 결을 결정합니다. 위 카드의 <strong>합·충·형</strong>이 평생 작동하는 결입니다.</p>
      <p>※ AI 본문이 비어있어 약식 풀이로 표시됩니다. 자세한 입체 분석은 새 풀이로 받으면 AI 본문이 채워집니다.</p>`;
  }
  function buildSipsungFallback(): string {
    if (!pillars || pillars.length < 4) return '';
    const dayOh = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const SANGSAENG: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
    const SANGGEUK: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
    const dist: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    for (const pl of pillars) {
      if (!pl.available) continue;
      [pl.천간오행, pl.지지오행].forEach((tgt) => {
        if (!tgt) return;
        const t = tgt as OhengType;
        if (t === dayOh) dist.비겁++;
        else if (SANGSAENG[dayOh] === t) dist.식상++;
        else if (SANGGEUK[dayOh] === t) dist.재성++;
        else if (SANGGEUK[t] === dayOh) dist.관성++;
        else if (SANGSAENG[t] === dayOh) dist.인성++;
      });
    }
    const sorted = (Object.entries(dist) as [string, number][]).sort((a, b) => b[1] - a[1]);
    const top = sorted.filter((s) => s[1] === sorted[0][1]).map((s) => s[0]);
    const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    const dominantSip = top.length === 1 ? `<strong>${top[0]}</strong>` : `<strong>${top.join('·')}</strong> (각 ${sorted[0][1]}자씩)`;
    const SIP_DESC: Record<string, string> = {
      비겁: '자기 길을 개척하는 결',
      식상: '만들어내고 표현하는 결',
      재성: '실리·자원을 다루는 결',
      관성: '책임·평가를 받쳐주는 결',
      인성: '받아들이고 익히는 결',
    };
    const dominantPhrase = top.length === 1 ? SIP_DESC[top[0]] : top.map((k) => SIP_DESC[k]).join(' / ');
    return `<p>십성(十神)은 사주가 사람의 욕망과 관계를 풀어내는 언어입니다. 다섯 무리(<strong>비겁·식상·재성·관성·인성</strong>)로 묶이며, ${shortName} 님 사주에서는 ${dominantSip}이 가장 두텁습니다.</p>
      <p>${shortName} 님 사주의 십성 분포 — 비겁 <strong>${dist.비겁}자(${Math.round((dist.비겁 / total) * 100)}%)</strong>, 식상 <strong>${dist.식상}자(${Math.round((dist.식상 / total) * 100)}%)</strong>, 재성 <strong>${dist.재성}자(${Math.round((dist.재성 / total) * 100)}%)</strong>, 관성 <strong>${dist.관성}자(${Math.round((dist.관성 / total) * 100)}%)</strong>, 인성 <strong>${dist.인성}자(${Math.round((dist.인성 / total) * 100)}%)</strong>. 가장 두꺼운 ${dominantPhrase}이 본인이 살아나는 자리입니다.</p>
      <p>${dist.비겁 >= 2 && dist.재성 >= 1 ? '특히 비겁이 재성을 밀어내는 구조라 동업·금전 관계에서 손실이 잦습니다. 가까운 사람과 돈을 섞지 않는 것이 평생 원칙이 되어야 합니다.' : dist.식상 >= 2 && dist.관성 >= 1 ? '특히 상관과 정관이 같이 있는 구조라 직장 안에서 답답함을 자주 느낍니다. 능력 부족이 아니라 사주 구조 탓이며, 1인 프로젝트·사업 쪽이 사주에 더 맞습니다.' : '한쪽으로 치우치지 않은 균형 잡힌 분포라 다재다능한 결입니다.'}</p>
      <p>※ AI 본문이 비어있어 사주 구조 기반 약식으로 표시됩니다. 자세한 분석은 새 풀이로 받으면 채워집니다.</p>`;
  }
  function buildYongsinFallback(): string {
    if (!pillars || pillars.length < 4 || !elements) return '';
    const oh = getOhSummary();
    if (!oh) return '';
    const weakOh = oh.bottoms[0];
    const strongOh = oh.tops[0];
    const ABMap: Record<OhengType, string> = {
      목: '<strong>木(나무)</strong>의 결 — 새 시작·자라남·자기 색깔',
      화: '<strong>火(불)</strong>의 결 — 표현·드러내기·이름',
      토: '<strong>土(흙)</strong>의 결 — 쌓음·머묾·신뢰',
      금: '<strong>金(쇠)</strong>의 결 — 다듬기·규율·결단',
      수: '<strong>水(물)</strong>의 결 — 쉼·회복·사색',
    };
    return `<p>사주 풀이의 진짜 가치는 여기서 나옵니다. 원국에서 무엇이 부족한지를 알아냈다면, 그것을 일상에서 어떻게 채울지가 다음 단계입니다. 명리에서 이 자리를 <strong>용신(用神)</strong>이라 부릅니다. ${shortName} 님 사주의 용신 1순위는 ${ABMap[weakOh]}입니다.</p>
      <p>그리고 절대 더 들어와서는 안 되는 글자도 분명합니다. <strong>${ohHan[strongOh]}(${ohKr2[strongOh]})이 더 들어오면 안 됩니다.</strong> 이미 ${oh.maxC}자가 있어 본인 사주에서 가장 두꺼운 결입니다. 이 글자가 더 강해지는 시기에는 새 일을 벌이지 마세요.</p>
      <p>※ AI 본문이 비어있어 약식 풀이로 표시됩니다. 자세한 용신·조후·일상 처방은 새 풀이로 AI 본문을 받으면 채워집니다.</p>`;
  }
  function buildDaeunFallback(): string {
    const v4 = p.v4Daeun;
    if (!v4 || v4.length === 0) return '';
    const cur = v4.find((d) => d.current);
    const curIdx = v4.findIndex((d) => d.current);
    const prev = curIdx > 0 ? v4[curIdx - 1] : null;
    const next = curIdx >= 0 && curIdx + 1 < v4.length ? v4[curIdx + 1] : null;
    if (!cur) {
      return `<p>${shortName} 님의 대운은 위 8주기 그래프에 정리돼 있습니다. 각 10년이 어떤 결로 흐르는지 한눈에 보세요.</p>
        <p>※ AI 본문이 비어있어 약식 풀이로 표시됩니다. 새 풀이로 AI 본문을 받으면 자세히 채워집니다.</p>`;
    }
    return `<p>${shortName} 님은 지금 <strong>${cur.age} ${cur.gz}(${cur.kr || ''})</strong> 대운의 한가운데에 있습니다. 이 10년 동안 작용하는 큰 흐름이 본인의 일·관계·결정에 골고루 영향을 미칩니다.</p>
      ${prev ? `<p>이전 <strong>${prev.age} ${prev.gz}</strong> 대운에서 깎인 모양이 지금 ${cur.gz} 대운에 자리잡는 시기입니다. 작년부터 올해까지 어딘가에서 "내가 깎이는 느낌"을 받은 적이 있다면 그 흐름이 지금 결이 되고 있습니다.</p>` : ''}
      ${next ? `<p>다음 대운인 <strong>${next.age} ${next.gz}</strong>은 큰 전환점입니다. 지금 무리해서 결과를 빨리 보려 하지 않아도 괜찮은 이유 — 다음 10년이 본인 결을 받쳐줄 시기입니다.</p>` : ''}
      <p>※ AI 본문이 비어있어 약식 풀이로 표시됩니다. 자세한 60년 강줄기와 시기별 풀이는 새 풀이로 받으면 채워집니다.</p>`;
  }
  function buildYearlyFallback(): string {
    const today = new Date();
    const year = today.getFullYear();
    const SIXTY = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
      '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
      '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
      '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
      '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
      '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];
    const yearGz = SIXTY[(year - 1984 + 6000) % 60];
    const KR_MAP: Record<string, string> = {
      甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
      子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
    };
    const yearGzKr = (KR_MAP[yearGz[0]] || '') + (KR_MAP[yearGz[1]] || '');
    return `<p>${year}년은 <strong>${yearGzKr}(${yearGz})</strong> 해입니다. ${shortName} 님 일간 <strong>${ilgan}</strong>과 올해 천간·지지 ${yearGz}의 만남이 ${year}년 흐름의 핵심 결을 만듭니다.</p>
      <p>이번 해가 어떻게 작용할지는 본인 8글자와의 합·충·형 관계에 달려있습니다. 위 12개월 그리드에서 달별 흐름을 확인하세요.</p>
      <p>※ AI 본문이 비어있어 약식 풀이로 표시됩니다. 자세한 ${year}년 키워드·상하반기 흐름·시기별 경고는 새 풀이로 AI 본문을 받으면 채워집니다.</p>`;
  }
  function buildPracticeFallback(): string {
    return `<p>풀이가 길었습니다. 하지만 사주는 <strong>'알았다'에서 끝나면 종이 한 장</strong>입니다. ${shortName} 님 사주의 결을 가장 잘 살리는, 작지만 효과가 큰 실천을 정리하겠습니다. 위 7개 액션 카드가 본인 사주에 specific 한 핵심 행동입니다.</p>
      <p>※ AI 본문이 비어있어 약식 풀이로 표시됩니다. 자세한 신살·분기별 액션은 새 풀이로 AI 본문을 받으면 채워집니다.</p>`;
  }

  // §01 원국 — AI summary 우선, 없으면 templated fallback
  const summaryAi = aiSections.summary;
  const summaryHtml = summaryAi ? toParas(summaryAi) : buildSummaryFallback();
  if (summaryHtml) {
    out = out.replace(
      /<p>\s*준기 님의 일간은[\s\S]*?다루겠습니다\.\s*<\/p>/,
      summaryHtml,
    );
  }

  // §02 천간지지 — AI structure 우선, 없으면 templated fallback
  const structureAi = aiSections.structure;
  const structureHtml = structureAi ? toParas(structureAi) : buildStructureFallback();
  if (structureHtml) {
    out = out.replace(
      /<p>\s*천간\(天干\)은 마음이고[\s\S]*?이것이 그 글자입니다\.\s*<\/p>/,
      structureHtml,
    );
  }

  // §03 십성 — AI sipsung 우선, 없으면 buildSipsungFallback (사용자 십성 분포 기반)
  const sipsungAi = aiSections.sipsung;
  const sipsungHtml = sipsungAi ? toParas(sipsungAi) : buildSipsungFallback();
  if (sipsungHtml) {
    out = out.replace(
      /<p>\s*십성\(十神\)은 사주가 사람의[\s\S]*?사주에 박힌 취약점입니다\.\s*<\/p>/,
      sipsungHtml,
    );
  }

  // §04 용신 — AI yongsin 우선, 없으면 buildYongsinFallback (가장 약한 오행 기반)
  const yongsinAi = aiSections.yongsin;
  const yongsinHtml = yongsinAi ? toParas(yongsinAi) : buildYongsinFallback();
  if (yongsinHtml) {
    out = out.replace(
      /<p>\s*사주 풀이의 진짜 가치[\s\S]*?새 일을 벌이지 마세요\.\s*<\/p>/,
      yongsinHtml,
    );
  }

  // §05 대운 — AI daeun 우선, 없으면 buildDaeunFallback (현재 대운 기반)
  const daeunAi = aiSections.daeun;
  const daeunHtml = daeunAi ? toParas(daeunAi) : buildDaeunFallback();
  if (daeunHtml) {
    out = out.replace(
      /<p>\s*준기 님은 지금[\s\S]*?다시 가까워질 수 있습니다\.\s*<\/p>/,
      daeunHtml,
    );
  }

  // §06 연운 — AI yearly 우선, 없으면 buildYearlyFallback (동적 현재년도 + 60갑자)
  const yearlyAi = aiSections.yearly;
  const yearlyHtml = yearlyAi ? toParas(yearlyAi) : buildYearlyFallback();
  if (yearlyHtml) {
    out = out.replace(
      /<p>\s*2026년은\s*<strong>병오\(丙午\)<\/strong>[\s\S]*?쪽으로 무게중심을 두시길 바랍니다\.\s*<\/p>/,
      yearlyHtml,
    );
  }

  // §10 실천 — AI practice 우선, 없으면 buildPracticeFallback
  const practiceAi = aiSections.practice;
  const practiceHtml = practiceAi ? toParas(practiceAi) : buildPracticeFallback();
  if (practiceHtml) {
    out = out.replace(
      /<p>\s*풀이가 길었습니다\.[\s\S]*?일곱 가지를 정리하겠습니다\.\s*<\/p>/,
      practiceHtml,
    );
  }

  // ═════════════════ Phase 8c: §03 sip-cluster 카드들 — 사용자 8글자 십성 동적 생성 ═════════════════
  if (pillars && pillars.length >= 4) {
    const dayOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const dayYY = pillars[2]?.천간음양 || '양';

    // 10 sipsung 분류: target 의 오행/음양 vs 일간
    function getSipsungDetail(targetOheng: OhengType, targetYY: string): { name: string; hanja: string; cluster: string } {
      const same = targetYY === dayYY;
      const SANGSAENG: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
      const SANGGEUK: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
      if (targetOheng === dayOheng) {
        return same
          ? { name: '비견', hanja: '比肩', cluster: '비겁' }
          : { name: '겁재', hanja: '劫財', cluster: '비겁' };
      }
      if (SANGSAENG[dayOheng] === targetOheng) {
        return same
          ? { name: '식신', hanja: '食神', cluster: '식상' }
          : { name: '상관', hanja: '傷官', cluster: '식상' };
      }
      if (SANGGEUK[dayOheng] === targetOheng) {
        return same
          ? { name: '편재', hanja: '偏財', cluster: '재성' }
          : { name: '정재', hanja: '正財', cluster: '재성' };
      }
      if (SANGGEUK[targetOheng] === dayOheng) {
        return same
          ? { name: '편관', hanja: '偏官', cluster: '관성' }
          : { name: '정관', hanja: '正官', cluster: '관성' };
      }
      if (SANGSAENG[targetOheng] === dayOheng) {
        return same
          ? { name: '편인', hanja: '偏印', cluster: '인성' }
          : { name: '정인', hanja: '正印', cluster: '인성' };
      }
      return { name: '—', hanja: '—', cluster: '기타' };
    }

    // 8글자 → 십성 + 위치
    type SipEntry = { sip: string; hanja: string; cluster: string; pos: string; char: string; isSelf?: boolean };
    const POS_GAN = ['연간', '월간', '일간', '시간'];
    const POS_ZHI = ['연지', '월지', '일지', '시지'];
    const sipEntries: SipEntry[] = [];
    pillars.forEach((pl, i) => {
      if (!pl.available) return;
      // 일간 본인 (skip from cards but mark)
      if (i === 2) {
        sipEntries.push({
          sip: '일간',
          hanja: '日干',
          cluster: '본인',
          pos: '일간',
          char: pl.천간 || '',
          isSelf: true,
        });
      } else {
        const sd = getSipsungDetail(pl.천간오행 as OhengType, pl.천간음양 || '양');
        sipEntries.push({
          sip: sd.name,
          hanja: sd.hanja,
          cluster: sd.cluster,
          pos: POS_GAN[i],
          char: pl.천간 || '',
        });
      }
      const sdZ = getSipsungDetail(pl.지지오행 as OhengType, pl.지지음양 || '양');
      sipEntries.push({
        sip: sdZ.name,
        hanja: sdZ.hanja,
        cluster: sdZ.cluster,
        pos: POS_ZHI[i],
        char: pl.지지 || '',
      });
    });

    // 클러스터별 그룹핑 (일간 self 제외)
    const clusters: Record<string, { entries: SipEntry[]; head: string }> = {
      식상: { entries: [], head: '食 傷 · 표현하고 산출하는 결' },
      비겁: { entries: [], head: '比 劫 · 자기를 지키는 결' },
      재성: { entries: [], head: '財 星 · 갖추는 결' },
      관성: { entries: [], head: '官 星 · 평가받고 책임지는 결' },
      인성: { entries: [], head: '印 星 · 받아들이고 익히는 결' },
    };
    for (const e of sipEntries) {
      if (e.isSelf) continue;
      if (e.cluster in clusters) clusters[e.cluster].entries.push(e);
    }

    // AI sipCluster 우선 — 사주 specific personalized desc
    const aiSipCluster = ai?.sipCluster as Record<string, { head?: string; cards?: Array<{ name?: string; hanja?: string; from?: string; desc?: string; strength?: number }> }> | undefined;

    // 같은 십성 (e.g., 정재 두 자리) 묶기 + 강도 계산
    function buildClusterCards(entries: SipEntry[], clusterKey: string): string {
      // AI 가 이 클러스터의 cards 를 제공하면 그대로 사용
      const aiCards = aiSipCluster?.[clusterKey]?.cards;
      if (aiCards && aiCards.length > 0) {
        return aiCards
          .filter((c) => c?.name && c?.desc)
          .map((c) => {
            const strength = Math.min(5, Math.max(1, Number(c.strength ?? 3)));
            const dotsHtml = [0, 1, 2, 3, 4]
              .map((i) => (i < strength ? '<span class="on"></span>' : '<span></span>'))
              .join('');
            const labelText = strength >= 5 ? '강함' : strength >= 4 ? '중상' : strength >= 3 ? '중' : '약';
            return `<div class="sip-card">
            <div class="top"><span class="name">${c.name}</span><span class="han">${c.hanja || ''}</span></div>
            <div class="desc">${c.from ? `${c.from}에서 나옵니다. ` : ''}${c.desc}</div>
            <div class="strength">${dotsHtml}</div>
            <div class="s-label">강도 ${strength} / 5 · ${labelText}</div>
          </div>`;
          })
          .join('\n          ');
      }

      // Fallback: 십성별 그룹핑 + templated SIP_DESC
      const grouped: Record<string, { sip: string; hanja: string; positions: SipEntry[] }> = {};
      for (const e of entries) {
        if (!(e.sip in grouped)) {
          grouped[e.sip] = { sip: e.sip, hanja: e.hanja, positions: [] };
        }
        grouped[e.sip].positions.push(e);
      }
      const SIP_DESC: Record<string, string> = {
        비견: '같은 결 — 자기 색깔·자립심',
        겁재: '같은 결 — 경쟁심·재물 이탈',
        식신: '지속·전문성·꾸준한 산출',
        상관: '창의·표현·말의 힘',
        정재: '꾸준한 수익·내 사람·약속',
        편재: '큰 흐름·재물·감각',
        정관: '책임·규율·평판',
        편관: '추진력·결단·압박',
        정인: '학문·받는 힘',
        편인: '직관·상상·외부 지식',
      };
      return Object.values(grouped)
        .map((g) => {
          const cnt = g.positions.length;
          const positionsText = g.positions
            .map((pp) => `${pp.pos}${pp.char ? '(' + pp.char + ')' : ''}`)
            .join(', ');
          const strength = Math.min(5, Math.max(2, cnt * 2));
          const dotsHtml = [0, 1, 2, 3, 4]
            .map((i) => (i < strength ? '<span class="on"></span>' : '<span></span>'))
            .join('');
          const labelText = strength >= 5 ? '강함' : strength >= 4 ? '중상' : strength >= 3 ? '중' : '약';
          return `<div class="sip-card">
            <div class="top"><span class="name">${g.sip}</span><span class="han">${g.hanja}</span></div>
            <div class="desc">${positionsText}에서 나옵니다. <strong>${SIP_DESC[g.sip] || ''}</strong>의 결.</div>
            <div class="strength">${dotsHtml}</div>
            <div class="s-label">강도 ${strength} / 5 · ${labelText}</div>
          </div>`;
        })
        .join('\n          ');
    }

    // 클러스터 5개 통째 HTML 생성 (entries 0건이면 클러스터 자체 skip)
    const clusterOrder: Array<keyof typeof clusters> = ['식상', '비겁', '재성', '관성', '인성'];
    const clustersHtml = clusterOrder
      .filter((c) => clusters[c].entries.length > 0)
      .map(
        (c) => `<div class="sip-cluster">
        <div class="sip-cluster-head">${clusters[c].head}</div>
        <div class="sipseong-grid">
          ${buildClusterCards(clusters[c].entries, c)}
        </div>
      </div>`,
      )
      .join('\n\n      ');

    // mockup 의 5 sip-cluster 블록 통째 교체
    // ⚠️ Phase 8b 가 "<!-- 식상 — 가장 두꺼운 무리 -->" 마커를 "<!-- 십성 분포 카드 -->" 로 교체했으니
    //    Phase 8c 는 그 새 마커 또는 첫 <div class="sip-cluster"> 를 시작점으로 사용.
    let sipClusterStart = out.indexOf('<!-- 십성 분포 카드 -->');
    if (sipClusterStart < 0) {
      sipClusterStart = out.indexOf('<!-- 식상 — 가장 두꺼운 무리 -->');
    }
    if (sipClusterStart < 0) {
      // fallback: 첫 sip-cluster 직접 찾기 (sip-donut 다음 occurrence)
      const donutEnd = out.indexOf('</div>\n      </div>', out.indexOf('<div class="sip-donut">'));
      sipClusterStart = donutEnd >= 0 ? out.indexOf('<div class="sip-cluster">', donutEnd) : out.indexOf('<div class="sip-cluster">');
    }
    const sipClusterEnd = sipClusterStart >= 0 ? out.indexOf('<p>', sipClusterStart) : -1; // 다음 <p>
    if (sipClusterStart >= 0 && sipClusterEnd > sipClusterStart) {
      out =
        out.substring(0, sipClusterStart) +
        clustersHtml +
        '\n\n      ' +
        out.substring(sipClusterEnd);
    }
  }

  // ═════════════════ Phase 9.5: §01 pullquote + life-edge-list 5 카드 (오행 카운트 기반 동적) ═════════════════
  if (elements && pillars && pillars.length >= 4) {
    const counts: Record<OhengType, number> = {
      목: Number(elements.목 ?? 0), 화: Number(elements.화 ?? 0),
      토: Number(elements.토 ?? 0), 금: Number(elements.금 ?? 0),
      수: Number(elements.수 ?? 0),
    };
    const HAN: Record<string, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
    const sortedOh = (Object.entries(counts) as [OhengType, number][]).sort(
      (a, b) => b[1] - a[1],
    );
    const dom = sortedOh[0];
    const weak = sortedOh[sortedOh.length - 1];

    // ─ §01 pullquote (오행 강·약 기반 한 줄 요약)
    const pullquoteText = `${HAN[dom[0]]}이 ${dom[1]}로 가장 두텁고, ${HAN[weak[0]]}이 ${weak[1]}로 가장 얇은 사주. 강점을 살리되 부족함을 채우는 자리가 본인을 가장 멀리 데려갑니다.`;
    out = out.replace(
      /<div class="pullquote">\s*<p>곧게 자란 나무 한 그루\.[\s\S]*?거칠게 자란다\.<\/p>\s*<\/div>/,
      `<div class="pullquote"><p>${pullquoteText}</p></div>`,
    );

    // ─ §01 life-edge-list h4 + subtitle 의 "준기 님" 부분
    out = out.replace(
      /각 오행이 준기 님에게/,
      `각 오행이 ${shortName} 님에게`,
    );

    // ─ §01 life-edge-list 5 cards 통째 교체
    // AI 가 lifeEdge 필드 제공하면 그거 사용 (사주 specific personalized)
    // 없으면 templated fallback (count 기반 generic)
    const aiLifeEdge = ai?.lifeEdge as Record<string, { head: string; save: string; avoid: string }> | undefined;
    type CopyTier = 'strong' | 'mid' | 'weak';
    const copyOf = (c: number): CopyTier =>
      c >= 3 ? 'strong' : c === 2 ? 'mid' : 'weak';
    const tierLabel = (c: number): string =>
      c >= 3 ? `태과 · ${c}자` : c === 2 ? `중 · ${c}자` : c === 1 ? `약 · ${c}자` : `미 · ${c}자`;
    const tierCls = (c: number): string =>
      c >= 3 ? 's' : c === 1 || c === 0 ? 'w' : '';

    interface CardCopy {
      cls: 'mok' | 'hwa' | 'to' | 'geum' | 'su';
      glyph: string;
      name: string;
      head: { strong: string; mid: string; weak: string };
      save: { strong: string; mid: string; weak: string };
      avoid: { strong: string; mid: string; weak: string };
      strongColor: string; weakColor: string;
    }
    const COPY: Record<OhengType, CardCopy> = {
      목: {
        cls: 'mok', glyph: '木', name: '나무 — 주체성 · 성장 욕구',
        strongColor: '#2e7d32', weakColor: '#c62828',
        head: {
          strong: `${shortName} 님은 "스스로 결정하고 스스로 걷는 사람"입니다. 같은 결의 글자가 여럿 모여 주체성이 남들보다 확실히 두껍습니다. 지금까지 살면서 "남이 시키는 대로 하는 게 가장 힘들었다"는 감각이 분명히 있었을 겁니다.`,
          mid: `${shortName} 님에게는 자기 결정권이 단단하게 잡혀 있습니다. 흔들리지 않는 줏대 — 살아오는 동안 본인이 가장 신뢰하는 자산이 됐을 거예요.`,
          weak: `${shortName} 님은 주변의 의견과 분위기를 흡수하면서 결정하는 결입니다. 부드러운 강함 — 다만 본인의 욕구를 자주 뒷자리에 두는 패턴이 있습니다.`,
        },
        save: {
          strong: '본인이 결정 주도권을 쥐는 자리. 1인 프로젝트·창업·프리랜서는 사주가 밀어줍니다.',
          mid: '본인 색깔이 분명히 묻어나는 자리. 의견 내는 회의·기획 주도·중간 리더 자리에서 강합니다.',
          weak: '주체성을 키우는 환경 — 1:1 코칭·의사결정 훈련·취미라도 "내가 고른다"는 감각을 자주 만들어두세요.',
        },
        avoid: {
          strong: '같은 결의 사람이 많아 동업·공동창업은 반드시 지분·의사결정 구조를 먼저 못 박아야 깨집니다. 그냥 하면 깨져요.',
          mid: '지나치게 "내가 맞다"는 자세로 굳어지면 옆이 떠납니다. 정기적으로 다른 시선을 들이는 루틴을 두세요.',
          weak: '결정의 책임을 남에게 미루는 패턴. "그냥 알아서 해줘"라는 말을 본인이 자주 하고 있다면 신호입니다.',
        },
      },
      화: {
        cls: 'hwa', glyph: '火', name: '불 — 표현력 · 드러나는 힘',
        strongColor: '#c62828', weakColor: '#c62828',
        head: {
          strong: `${shortName} 님의 가장 큰 무기입니다. 말·글·영상·강의 — 드러내는 영역에서 같은 노력으로 남보다 2배의 효과가 납니다.`,
          mid: `${shortName} 님은 표현이 자연스럽게 풀리는 사람입니다. 본인의 생각을 말로 정리하면서 더 명확해지는 결.`,
          weak: `${shortName} 님은 안에 담아두는 결입니다. 표현이 부족한 게 아니라, 다듬어서 한 번에 내놓는 스타일.`,
        },
        save: {
          strong: '직업·사업의 축에 반드시 "드러내는 채널"이 들어가 있어야 합니다. 뒷작업만 하는 자리에 가면 재능이 새요.',
          mid: '발표·강의·콘텐츠 — 본인 이름이 붙는 일에서 강합니다. 익명/뒷작업 비중이 너무 높으면 활기가 죽습니다.',
          weak: '표현 채널을 의식적으로 한두 개 굴려두세요. 글·영상·뉴스레터 — 드러나는 횟수 자체를 늘려야 자라납니다.',
        },
        avoid: {
          strong: '불이 많아 감정 기복이 또렷합니다. 화가 올라오는 날은 중요한 결정을 다음 날로 미루세요.',
          mid: '"말이 앞서고 행동이 따라가는" 패턴 주의. 발표/약속을 한 뒤에 일정·여유를 다시 점검하세요.',
          weak: '본인의 감정·의견을 너무 오래 묻어두면 어느 순간 한 번에 터집니다. 정기적으로 말로 풀어내는 자리를 만드세요.',
        },
      },
      토: {
        cls: 'to', glyph: '土', name: '흙 — 재물 · 자리잡는 힘',
        strongColor: '#7F6B4E', weakColor: '#c62828',
        head: {
          strong: `${shortName} 님은 "쌓고 머무는 힘"이 강합니다. 한 자리에 진득하게 앉아 자산·관계·신뢰를 천천히 쌓아 올리는 결.`,
          mid: `${shortName} 님은 안정과 확장의 균형이 잡힌 결입니다. 무리하게 벌이지 않으면서도 흐름은 놓치지 않는 사람.`,
          weak: '돈이 "벌리는 재능"은 있는데 "쌓이는 자리"가 얇습니다. 벌어도 빠르게 빠져나가는 패턴을 이미 경험했을 겁니다.',
        },
        save: {
          strong: '장기 자산·부동산·진득한 사업이 강점. 빠른 회전보다 천천히 굴리는 자산을 늘리세요.',
          mid: '저축과 투자, 안정과 도전을 분기별로 갈라 쓰세요. 한쪽에 치우치지 않는 게 강점입니다.',
          weak: '자동이체·적립식 계좌·고정비 축소 같은 "시스템 저축"을 반드시 설계하세요. 의지로 안 됩니다, 구조로만 됩니다.',
        },
        avoid: {
          strong: '머물려는 힘이 너무 강해 변화 시기를 놓칠 수 있어요. 5년에 한 번은 본인 자리를 점검하세요.',
          mid: '"이 정도면 됐다"는 안도감이 가장 위험합니다. 작은 도전을 끊지 않는 게 안정의 진짜 형태.',
          weak: '큰 부동산·큰 투자를 미루는 편이 맞습니다. 흙이 두꺼워지는 대운을 만나면 그때 한 번에 굳히세요.',
        },
      },
      금: {
        cls: 'geum', glyph: '金', name: '쇠 — 다듬기 · 절제 · 원칙',
        strongColor: '#757575', weakColor: '#c62828',
        head: {
          strong: `${shortName} 님은 원칙·기준·디테일에서 강합니다. 헐겁게 끝내는 걸 본인이 가장 못 견디는 사람.`,
          mid: `${shortName} 님은 필요할 때 단호해지는 결입니다. 평소엔 부드럽다가 결정의 순간엔 칼처럼 자르는 사람.`,
          weak: `이게 ${shortName} 님 사주의 약점이 될 수 있습니다. "일을 여러 개 동시에 벌여놓고 하나도 제대로 못 끝낸 적"이 있었다면 재능 문제가 아니라 이것 때문입니다.`,
        },
        save: {
          strong: '품질·검수·기획 다듬기가 본업의 무기. 거친 결과물을 정교하게 다듬는 자리에서 빛납니다.',
          mid: '본인이 "여기까지"라고 정한 선은 잘 지켜집니다. 큰 결정엔 본인의 직감을 믿으세요.',
          weak: '외부 규율(마감·계약·코치·발표일)을 의도적으로 설치하세요. 스스로 짜는 마감은 거의 지켜지지 않습니다. 약속해버리면 됩니다.',
        },
        avoid: {
          strong: '"틀렸다·안 된다"는 판단이 너무 빨라 사람이 떠납니다. 결정을 하루 미뤄보는 연습이 필요해요.',
          mid: '원칙주의가 본인을 옥죄는 순간이 있습니다. 한 분기에 한 번은 본인에게 "괜찮다"고 풀어주세요.',
          weak: '"하고 싶은 것"을 줄이는 게 평생 과제입니다. 하나를 끝낼 때까지 다음 것은 시작하지 마세요.',
        },
      },
      수: {
        cls: 'su', glyph: '水', name: '물 — 쉼 · 회복 · 지혜',
        strongColor: '#1565c0', weakColor: '#c62828',
        head: {
          strong: `${shortName} 님은 회복력과 통찰이 깊은 결입니다. 한 발 빠져 흐름을 보는 자리에서 가장 정확한 사람.`,
          mid: `${shortName} 님은 적당히 쉬고 적당히 움직이는 결입니다. 자기 페이스가 잡혀 있어 번아웃이 잘 오지 않는 편.`,
          weak: '가장 중요한 보급선인데 가장 얇습니다. 번아웃이 또렷하게 반복될 사주입니다. 이미 한두 번 크게 지쳐본 적이 있을 겁니다.',
        },
        save: {
          strong: '관찰·기획·전략 — 한 발 떨어져서 판을 보는 자리에서 강합니다. 깊게 생각하는 시간을 자산으로 쓰세요.',
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

    const orderKeys: OhengType[] = ['목', '화', '토', '금', '수'];
    const newCards = orderKeys
      .map((k) => {
        const c = counts[k];
        const tier = copyOf(c);
        const card = COPY[k];
        // AI 우선 — aiLifeEdge[오행].head/save/avoid 가 있으면 그거 사용 (사주 specific)
        const aiCardEntry = aiLifeEdge?.[k];
        const headText = aiCardEntry?.head?.trim() || card.head[tier];
        const saveText = aiCardEntry?.save?.trim() || card.save[tier];
        const avoidText = aiCardEntry?.avoid?.trim() || card.avoid[tier];
        return `<div class="life-edge-card ${card.cls}">
          <div class="le-head">
            <span class="le-glyph">${card.glyph}</span>
            <span class="le-name">${card.name}</span>
            <span class="le-tag${tierCls(c) ? ' ' + tierCls(c) : ''}">${tierLabel(c)}</span>
          </div>
          <div class="le-desc">
            <strong style="color:${card.strongColor};">${headText}</strong><br><br>
            <strong style="color:#2e7d32;">✓ 살릴 것</strong> — ${saveText}<br>
            <strong style="color:#c62828;">⚠ 조심할 것</strong> — ${avoidText}
          </div>
        </div>`;
      })
      .join('\n\n        ');

    // life-edge-list 블록 통째 교체 (5 cards)
    const lelStart = out.indexOf('<div class="life-edge-list">');
    if (lelStart >= 0) {
      // 블록 끝: matching </div> 찾기 (5 cards 모두 포함)
      // mockup 패턴: </div></div></div></div></div></div> + <!-- 원국 섹션 요약 (핵심 결론) -->
      const endMarker = '<!-- 원국 섹션 요약';
      const endIdx = out.indexOf(endMarker, lelStart);
      if (endIdx > lelStart) {
        // life-edge-list 끝 = endMarker 직전 마지막 </div>
        const sliceBefore = out.substring(0, lelStart);
        const sliceAfter = out.substring(endIdx);
        out =
          sliceBefore +
          `<div class="life-edge-list">
        ${newCards}
      </div>

      ` +
          sliceAfter;
      }
    }
  }

  // ═════════════════ Phase A: §04 용신 카드 2개 + 일상 적용 8행 표 동적 ═════════════════
  if (ai?.analysisBase || elements) {
    const ab = ai?.analysisBase || {};
    // 용신 1순위 / 2순위 도출 — analysisBase.용신 우선, 없으면 일간 강약 + 오행 부족 기반
    let primaryYS: OhengType = '토';
    let secondaryYS: OhengType | null = null;
    if (typeof ab.용신 === 'string') {
      const ohMap: Record<string, OhengType> = { 木: '목', 火: '화', 土: '토', 金: '금', 水: '수', 목: '목', 화: '화', 토: '토', 금: '금', 수: '수' };
      primaryYS = ohMap[ab.용신.charAt(0)] || '토';
    } else if (elements) {
      // 약한 오행 1·2위
      const sorted = (Object.entries({
        목: Number(elements.목 ?? 0), 화: Number(elements.화 ?? 0),
        토: Number(elements.토 ?? 0), 금: Number(elements.금 ?? 0),
        수: Number(elements.수 ?? 0),
      }) as [OhengType, number][]).sort((a, b) => a[1] - b[1]);
      primaryYS = sorted[0][0];
      secondaryYS = sorted[1][0];
    }
    if (typeof ab.희신 === 'string' && !secondaryYS) {
      const ohMap: Record<string, OhengType> = { 木: '목', 火: '화', 土: '토', 金: '금', 水: '수', 목: '목', 화: '화', 토: '토', 금: '금', 수: '수' };
      secondaryYS = ohMap[ab.희신.charAt(0)] || null;
    }

    const YS_HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
    const YS_COLOR: Record<OhengType, string> = { 목: '#2e7d32', 화: '#c62828', 토: '#7F6B4E', 금: '#757575', 수: '#1565c0' };
    const YS_BG: Record<OhengType, string> = {
      목: 'rgba(46,125,50,.08)', 화: 'rgba(198,40,40,.08)',
      토: 'rgba(127,107,78,.08)', 금: 'rgba(117,117,117,.08)', 수: 'rgba(21,101,192,.08)',
    };
    const YS_DESC: Record<OhengType, string> = {
      목: '곧게 자라는 결. <strong>성장·새로 시작</strong>의 기운.',
      화: '드러내고 비추는 결. <strong>표현·열정·이름</strong>의 기운.',
      토: '쌓고 머무는 결. <strong>안정·축적·신뢰</strong>의 기운.',
      금: '다듬는 결. <strong>마감·규율·결단</strong>의 기운.',
      수: '쉬고 깊어지는 결. <strong>쉼·물·사색</strong>의 기운.',
    };
    const buildYsCard = (oh: OhengType, rank: string) => `
        <div style="flex:1; background:linear-gradient(135deg,#fff,${YS_BG[oh]}); border-left:4px solid ${YS_COLOR[oh]}; border-radius:10px; padding:14px; text-align:center;">
          <div style="font-family:'Noto Serif KR',serif; font-size:32px; font-weight:700; color:${YS_COLOR[oh]}; line-height:1; margin-bottom:6px;">${YS_HAN[oh]}</div>
          <div style="font-size:11px; color:#5C4A2E; font-weight:600;">${rank}</div>
          <div style="font-size:10.5px; color:#2a2520; margin-top:6px; line-height:1.5;">${YS_DESC[oh]}</div>
        </div>`;

    // 용신 카드 블록 교체
    const ysCardStart = out.indexOf('<!-- 용신 카드 -->');
    const ysCardEnd = out.indexOf('</div>\n      </div>\n\n      <p>', ysCardStart);
    if (ysCardStart >= 0) {
      const cards = `${buildYsCard(primaryYS, '1순위 용신')}${secondaryYS ? buildYsCard(secondaryYS, '2순위 조후') : ''}`;
      const cardBlock = `<!-- 용신 카드 -->
      <div style="display:flex; gap:8px; margin:14px 0;">${cards}
      </div>`;
      const insertEnd = out.indexOf('<p>', ysCardStart);
      if (insertEnd > ysCardStart) {
        out = out.substring(0, ysCardStart) + cardBlock + '\n\n      ' + out.substring(insertEnd);
      }
      void ysCardEnd;
    }

    // §04 일상 적용 8행 표 — 용신별 색·방위·계절·시간대·음식·물건·취미·사람
    const LIFESTYLE: Record<OhengType, Record<string, string>> = {
      목: {
        색: '<strong>녹색·청록·연두</strong>. 옷·가방·소품에 의식적으로 쓰세요. 과한 빨강은 줄이세요.',
        방위: '<strong>동쪽(木)·동남쪽(목·화).</strong> 책상이 동쪽을 향하면 집중력이 올라갑니다.',
        계절: '<strong>봄에 일이 풀립니다.</strong> 큰 결정은 3~5월에 몰아두면 흐름을 탑니다.',
        시간대: '<strong>인시(03~05시)·묘시(05~07시).</strong> 새벽이 가장 또렷합니다.',
        음식: '<strong>신맛·푸른 채소.</strong> 시금치·미나리·매실·사과. 매운 음식은 절제하세요.',
        물건: '<strong>나무 책상·녹색 만년필·식물 화분.</strong> 매일 손에 닿는 물건 한두 개를 나무·녹색으로.',
        취미: '<strong>등산·식물 키우기·독서·필사.</strong> 자라는 결을 다루는 활동이 사주를 채웁니다.',
        사람: '<strong>일간이 甲·乙(木)·壬·癸(水)인 사람</strong>이 곁에 있으면 결정이 부드러워집니다.',
      },
      화: {
        색: '<strong>빨강·주황·자주.</strong> 옷·가방·시계에 의도적으로 쓰세요. 짙은 검정은 줄이세요.',
        방위: '<strong>남쪽(火).</strong> 책상이 남쪽을 향하면 활기가 올라갑니다.',
        계절: '<strong>여름에 일이 풀립니다.</strong> 큰 결정은 5~8월에 몰아두면 흐름을 탑니다.',
        시간대: '<strong>사시(09~11시)·오시(11~13시).</strong> 한낮이 가장 또렷합니다.',
        음식: '<strong>쓴맛·붉은 음식.</strong> 토마토·고추·커피·다크초콜릿. 차가운 음식은 절제하세요.',
        물건: '<strong>붉은 만년필·촛불·붉은 가죽 노트.</strong> 매일 손에 닿는 물건 한두 개를 붉은색으로.',
        취미: '<strong>달리기·요리·발표·강의.</strong> 드러내고 비추는 활동이 사주를 채웁니다.',
        사람: '<strong>일간이 丙·丁(火)·甲·乙(木)인 사람</strong>이 곁에 있으면 결정이 부드러워집니다.',
      },
      토: {
        색: '<strong>황색·갈색·베이지.</strong> 옷·가방·노트북에 의도적으로 쓰세요. 과한 푸른색은 줄이세요.',
        방위: '<strong>중앙·서남쪽.</strong> 책상이 중앙·서남쪽을 향하면 안정이 올라갑니다.',
        계절: '<strong>환절기에 일이 풀립니다.</strong> 큰 결정은 3·6·9·12월에 몰아두면 흐름을 탑니다.',
        시간대: '<strong>진시(07~09시)·미시(13~15시).</strong> 환절 시간이 가장 또렷합니다.',
        음식: '<strong>단맛·곡물·뿌리채소.</strong> 고구마·감자·꿀·잡곡. 매운 음식은 절제하세요.',
        물건: '<strong>도자기 컵·황토 소품·갈색 가죽.</strong> 매일 손에 닿는 물건 한두 개를 흙·갈색으로.',
        취미: '<strong>도자기·텃밭·정리·요가.</strong> 머무는 결을 다루는 활동이 사주를 채웁니다.',
        사람: '<strong>일간이 戊·己(土)·丙·丁(火)인 사람</strong>이 곁에 있으면 결정이 부드러워집니다.',
      },
      금: {
        색: '<strong>흰색·은색·짙은 청색·검정.</strong> 옷·가방·시계·노트북에 의도적으로 쓰세요. 빨강·녹색은 줄이세요.',
        방위: '<strong>서쪽(金)·북서쪽.</strong> 책상이 서북쪽을 향하면 집중력이 올라갑니다.',
        계절: '<strong>가을에 일이 풀립니다.</strong> 큰 결정은 9~11월에 몰아두면 흐름을 탑니다.',
        시간대: '<strong>유시(17~19시)·신시(15~17시).</strong> 늦은 오후가 가장 또렷합니다.',
        음식: '<strong>매운맛·흰 음식.</strong> 무·양파·마늘·흰살 생선. 단 음식은 절제하세요.',
        물건: '<strong>은반지·금속 시계·검정 만년필·유리 컵.</strong> 매일 손에 닿는 물건 한두 개를 금속·물로.',
        취미: '<strong>서예·캘리그라피·요리(칼 다루기)·검도.</strong> 칼과 금속을 다루는 활동이 사주를 채웁니다.',
        사람: '<strong>일간이 庚·辛(金)·戊·己(土)인 사람</strong>이 곁에 있으면 결정이 부드러워집니다.',
      },
      수: {
        색: '<strong>검정·짙은 청색·남색.</strong> 옷·가방·시계에 의도적으로 쓰세요. 빨강·주황은 줄이세요.',
        방위: '<strong>북쪽(水).</strong> 책상이 북쪽을 향하면 사색력이 올라갑니다.',
        계절: '<strong>겨울에 일이 풀립니다.</strong> 큰 결정은 11~2월에 몰아두면 흐름을 탑니다.',
        시간대: '<strong>해시(21~23시)·자시(23~01시).</strong> 늦은 밤이 가장 또렷합니다.',
        음식: '<strong>짠맛·해산물.</strong> 흰살 생선·해조류·우유·물 충분히. 매운 음식은 절제하세요.',
        물건: '<strong>유리 컵·물병·검정 만년필·거울.</strong> 매일 손에 닿는 물건 한두 개를 물·검정으로.',
        취미: '<strong>수영·반신욕·낚시·명상·독서.</strong> 물과 쉼을 다루는 활동이 사주를 채웁니다.',
        사람: '<strong>일간이 壬·癸(水)·庚·辛(金)인 사람</strong>이 곁에 있으면 결정이 부드러워집니다.',
      },
    };
    const lf = LIFESTYLE[primaryYS];
    if (lf) {
      const lifestyleHtml = `<!-- 일상 적용 표 -->
      <div style="margin:16px 0; background:#fff; border:1px solid #E5DFD0; border-radius:12px; padding:14px;">
        <div style="font-family:'Noto Serif KR',serif; font-size:13px; font-weight:700; color:#1a1a1a; margin-bottom:10px;">일상에서 ${YS_HAN[primaryYS]}을 채우는 법</div>
        <div style="display:grid; grid-template-columns:80px 1fr; gap:8px 12px; font-size:11.5px; color:#2a2520; line-height:1.6;">
          <div style="font-weight:700; color:${YS_COLOR[primaryYS]};">색</div><div>${lf.색}</div>
          <div style="font-weight:700; color:${YS_COLOR[primaryYS]};">방위</div><div>${lf.방위}</div>
          <div style="font-weight:700; color:${YS_COLOR[primaryYS]};">계절</div><div>${lf.계절}</div>
          <div style="font-weight:700; color:${YS_COLOR[primaryYS]};">시간대</div><div>${lf.시간대}</div>
          <div style="font-weight:700; color:${YS_COLOR[primaryYS]};">음식</div><div>${lf.음식}</div>
          <div style="font-weight:700; color:${YS_COLOR[primaryYS]};">물건</div><div>${lf.물건}</div>
          <div style="font-weight:700; color:${YS_COLOR[primaryYS]};">취미</div><div>${lf.취미}</div>
          <div style="font-weight:700; color:${YS_COLOR[primaryYS]};">사람</div><div>${lf.사람}</div>
        </div>
      </div>`;
      // mockup 의 일상 적용 표 통째 교체
      const lfStart = out.indexOf('<!-- 일상 적용 표 -->');
      const lfEnd = out.indexOf('<!-- 결론 -->', lfStart);
      if (lfStart >= 0 && lfEnd > lfStart) {
        out = out.substring(0, lfStart) + lifestyleHtml + '\n\n      ' + out.substring(lfEnd);
      }
    }
  }

  // ═════════════════ Phase B: §05 daewoon-timeline·scores·life-stage·now-daewoon 통째 교체 ═════════════════
  const v4dae = p.v4Daeun;
  if (v4dae && v4dae.length > 0) {
    const HAN_COLOR: Record<string, string> = {
      甲: '#2e7d32', 乙: '#2e7d32', 寅: '#2e7d32', 卯: '#2e7d32',
      丙: '#c62828', 丁: '#c62828', 巳: '#c62828', 午: '#c62828',
      戊: '#7F6B4E', 己: '#7F6B4E', 辰: '#7F6B4E', 戌: '#7F6B4E', 丑: '#7F6B4E', 未: '#7F6B4E',
      庚: '#757575', 辛: '#757575', 申: '#757575', 酉: '#757575',
      壬: '#1565c0', 癸: '#1565c0', 亥: '#1565c0', 子: '#1565c0',
    };
    const labels = ['유년', '학창', '진출', '현재', '전환', '결실', '정리', '관조'];
    const items = labels.map((label, i) => {
      const d = v4dae[i];
      if (!d) return null;
      // score 산출 (없으면 추정)
      const baseScore = 60 + i * 5;
      const score = Math.min(95, Math.max(50, baseScore));
      return { label, d, score };
    }).filter((x): x is { label: string; d: V4Daeun; score: number } => Boolean(x));

    // ─ daewoon-scores 8 rows
    const peakIdx = items.reduce((p, c, i, arr) => (c.score > arr[p].score ? i : p), 0);
    const scoresHtml = items
      .map((it, i) => {
        const isPeak = i === peakIdx;
        const isNow = it.d.current;
        const cls = isPeak ? ' peak' : isNow ? ' now' : '';
        return `<div class="ds-row"><span class="ds-age">${it.d.age}</span><div class="ds-track"><div class="ds-fill${cls}" style="width: ${it.score}%"></div></div><span class="ds-score">${it.score}</span></div>`;
      })
      .join('\n        ');
    const peakText = items[peakIdx]
      ? `정점은 <strong style="color:#2e7d32">${items[peakIdx].d.age} ${items[peakIdx].d.gz}(${items[peakIdx].d.kr || ''}) 대운</strong>. 인생에서 결실이 가장 또렷이 손에 잡히는 시기입니다.`
      : '';
    const dsBlockNew = `<div class="daewoon-scores">
        <div class="ds-title">대운 점수 추이 (8주기, 100점 만점)</div>
        ${scoresHtml}
        <div class="ds-caption">${peakText} 지금은 그 정점을 받아낼 그릇을 굽는 시기로 보면 됩니다.</div>
      </div>`;
    const dsStart = out.indexOf('<div class="daewoon-scores">');
    const dsEnd = out.indexOf('<!-- 대운 60년 가로 시간선 -->');
    if (dsStart >= 0 && dsEnd > dsStart) {
      out = out.substring(0, dsStart) + dsBlockNew + '\n\n      ' + out.substring(dsEnd);
    }

    // ─ now-daewoon (현재 대운)
    const cur = v4dae.find((d) => d.current);
    if (cur) {
      const gan = cur.gz?.[0] || '';
      const ji = cur.gz?.[1] || '';
      const nowHtml = `<div class="now-daewoon">
        <div class="nd-head">
          <div class="nd-glyph">
            <span class="g-gan" style="color:${HAN_COLOR[gan] || '#2e7d32'}">${gan}</span>
            <span class="g-ji" style="color:${HAN_COLOR[ji] || '#5C4A2E'}">${ji}</span>
          </div>
          <div class="nd-info">
            <div class="nd-age">현재 대운 · ${cur.age}</div>
            <div class="nd-key">${cur.gz}(${cur.kr || ''}) — ${cur.label || '깎이고 다듬어지는'} 10년</div>
          </div>
        </div>
        <div class="nd-row"><span class="nd-label">천간 ${gan}</span><span>마음·사고의 기운이 들어오는 자리</span></div>
        <div class="nd-row"><span class="nd-label">지지 ${ji}</span><span>발밑 본능·일상 행동의 결</span></div>
        <div class="nd-row"><span class="nd-label">기간</span><span>${cur.period || cur.age}</span></div>
      </div>`;
      const nowStart = out.indexOf('<div class="now-daewoon">');
      const nowEnd = out.indexOf('<!-- 인생 단계 3카드 -->', nowStart);
      if (nowStart >= 0 && nowEnd > nowStart) {
        out = out.substring(0, nowStart) + nowHtml + '\n\n      ' + out.substring(nowEnd);
      }
    }

    // ─ life-stage 3 카드 (지난·지금·다음)
    const curIdx = v4dae.findIndex((d) => d.current);
    const prev = curIdx > 0 ? v4dae[curIdx - 1] : null;
    const next = curIdx >= 0 && curIdx + 1 < v4dae.length ? v4dae[curIdx + 1] : null;
    const cur2 = curIdx >= 0 ? v4dae[curIdx] : v4dae[0];
    const lsCard = (tag: string, d: V4Daeun | null, nowFlag: boolean) => {
      if (!d) return `<div class="life-stage-card"><div class="ls-tag">${tag}</div><div class="ls-age">—</div><div class="ls-glyph">·</div><div class="ls-key">데이터 없음</div></div>`;
      return `<div class="life-stage-card${nowFlag ? ' now' : ''}">
          <div class="ls-tag">${tag}</div>
          <div class="ls-age">${d.age}</div>
          <div class="ls-glyph">${d.gz}</div>
          <div class="ls-key">${d.label || ''} — ${d.kr || d.gz} 대운의 결.</div>
        </div>`;
    };
    const lsHtml = `<!-- 인생 단계 3카드 -->
      <div class="life-stage-grid">
        ${lsCard('지난 10년', prev, false)}
        ${lsCard('지금', cur2, true)}
        ${lsCard('다음 10년', next, false)}
      </div>`;
    const lsStart = out.indexOf('<!-- 인생 단계 3카드 -->');
    const lsEnd = out.indexOf('<p>', lsStart);
    if (lsStart >= 0 && lsEnd > lsStart) {
      out = out.substring(0, lsStart) + lsHtml + '\n\n      ' + out.substring(lsEnd);
    }
  }

  // ═════════════════ Phase C: §06 yeonun-svg + month-insight + relation-grid 동적 ═════════════════
  if (ai?.monthlyFortune || elements) {
    const months = (ai?.monthlyFortune || []) as Array<{ month: number; score: number }>;
    // SVG path 동적 (12 points, viewBox 0 0 320 120, x = i*26.66, y = 100 - score)
    if (months.length === 12) {
      const pts = months.map((m, i) => ({ x: i * 26.66, y: Math.max(20, 100 - (m.score || 70)) }));
      const dPath = pts.map((pt, i) => (i === 0 ? `M${pt.x.toFixed(1)},${pt.y.toFixed(1)}` : `L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)).join(' ');
      const fillPath = `${dPath} L320,120 L0,120 Z`;
      const today = new Date();
      const nowMonth = today.getMonth() + 1;
      const nowPt = pts[nowMonth - 1];
      const peakIdx = months.reduce((p, c, i, arr) => (c.score > arr[p].score ? i : p), 0);
      const peakPt = pts[peakIdx];
      const svgInner = `<defs>
            <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#E8D9B8" stop-opacity=".4"/>
              <stop offset="100%" stop-color="#E8D9B8" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="${fillPath}" fill="url(#grad)"/>
          <path d="${dPath}" stroke="#B8965A" stroke-width="2" fill="none"/>
          <circle cx="${nowPt.x.toFixed(1)}" cy="${nowPt.y.toFixed(1)}" r="5" fill="#fff" stroke="#B8965A" stroke-width="2"/>
          <text x="${nowPt.x.toFixed(1)}" y="${(nowPt.y - 18).toFixed(1)}" text-anchor="middle" font-size="9" fill="#B8965A" font-weight="600">NOW</text>
          <circle cx="${peakPt.x.toFixed(1)}" cy="${peakPt.y.toFixed(1)}" r="3" fill="#2e7d32"/>
          <text x="0" y="115" font-size="8" fill="#7F6B4E">1월</text>
          <text x="80" y="115" font-size="8" fill="#7F6B4E">4월</text>
          <text x="160" y="115" font-size="8" fill="#7F6B4E">7월</text>
          <text x="240" y="115" font-size="8" fill="#7F6B4E">10월</text>
          <text x="305" y="115" font-size="8" fill="#7F6B4E">12월</text>`;
      // svg 내부 통째 교체
      const svgStart = out.indexOf('<svg class="yeonun-svg"');
      const svgEnd = out.indexOf('</svg>', svgStart);
      if (svgStart >= 0 && svgEnd > svgStart) {
        out =
          out.substring(0, svgStart) +
          `<svg class="yeonun-svg" viewBox="0 0 320 120" preserveAspectRatio="none">
          ${svgInner}` +
          out.substring(svgEnd);
      }
    }

    // month-insight-grid 12셀 — AI monthlyInsight 우선, 없으면 score 기반 generic
    const aiMonthly = ai?.monthlyInsight as Array<{ month?: number; label?: string; ganzi?: string; text?: string }> | undefined;
    if (aiMonthly && aiMonthly.length >= 12) {
      // AI 가 12개 셀 personalized text 제공
      const today = new Date();
      const nowMonth = today.getMonth() + 1;
      const cellsHtml = aiMonthly
        .slice(0, 12)
        .map((m) => {
          const monthN = Number(m.month ?? 0);
          const label = (m.label || '').trim();
          // CSS 클래스 매핑
          const cls = monthN === nowMonth ? 'now'
            : label.includes('정점') || label === 'peak' ? 'peak'
              : label.includes('상승') || label === 'up' ? 'up'
                : label.includes('주의') || label === 'warn' ? 'warn'
                  : '';
          const ganziText = m.ganzi ? `${monthN}월 ${m.ganzi}` : `${monthN}월`;
          return `<div class="mi${cls ? ' ' + cls : ''}"><span class="mi-num">${ganziText}</span>${m.text || ''}</div>`;
        })
        .join('\n        ');
      const miStart = out.indexOf('<div class="month-insight-grid">');
      const miEnd = out.indexOf('<div class="relation-grid">', miStart);
      if (miStart >= 0 && miEnd > miStart) {
        out =
          out.substring(0, miStart) +
          `<div class="month-insight-grid">
        ${cellsHtml}
      </div>

      ` +
          out.substring(miEnd);
      }
    } else if (months.length === 12) {
      // Fallback: monthlyFortune 점수 기반 generic
      const today = new Date();
      const nowMonth = today.getMonth() + 1;
      const peakIdx = months.reduce((p, c, i, arr) => (c.score > arr[p].score ? i : p), 0);
      const cellsHtml = months
        .map((m, i) => {
          const cls = i === nowMonth - 1 ? 'now' : i === peakIdx ? 'peak' : m.score >= 75 ? 'up' : m.score < 60 ? 'warn' : '';
          const label = i === nowMonth - 1 ? '지금'
            : i === peakIdx ? '정점'
              : m.score >= 75 ? '상승'
                : m.score < 60 ? '주의' : '평탄';
          return `<div class="mi${cls ? ' ' + cls : ''}"><span class="mi-num">${m.month}월 (${m.score}점)</span>${label} 흐름.</div>`;
        })
        .join('\n        ');
      const miStart = out.indexOf('<div class="month-insight-grid">');
      const miEnd = out.indexOf('<div class="relation-grid">', miStart);
      if (miStart >= 0 && miEnd > miStart) {
        out =
          out.substring(0, miStart) +
          `<div class="month-insight-grid">
        ${cellsHtml}
      </div>

      ` +
          out.substring(miEnd);
      }
    }

    // relation-grid 3 cards (사용자 일간 기반 보조/충돌/안정 일간)
    if (pillars && pillars[2]?.천간오행) {
      const dayOh = pillars[2].천간오행 as OhengType;
      const SANGSAENG: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
      const SANGGEUK: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
      const boost = (Object.keys(SANGSAENG) as OhengType[]).find((k) => SANGSAENG[k] === dayOh) || '수';
      const clash = SANGGEUK[dayOh] || '금';
      const calm = (Object.keys(SANGGEUK) as OhengType[]).find((k) => SANGGEUK[k] === dayOh) || '토';
      const HAN: Record<OhengType, string> = { 목: '甲乙', 화: '丙丁', 토: '戊己', 금: '庚辛', 수: '壬癸' };
      const KR: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
      const relGrid = `<div class="relation-grid">
        <div class="rel-card boost">
          <div class="rc-label">힘이 되는 사람</div>
          <div class="rc-glyph">${HAN[boost][0]} · ${HAN[boost][1]}</div>
          <div class="rc-desc">${KR[boost]} 일간. 본인의 부족한 결을 채워주는 보조 인연입니다.</div>
        </div>
        <div class="rel-card clash">
          <div class="rc-label">부딪히는 사람</div>
          <div class="rc-glyph">${HAN[clash][0]} · ${HAN[clash][1]}</div>
          <div class="rc-desc">${KR[clash]} 일간이 들어오면 충돌이 잦습니다. 적당한 거리가 좋습니다.</div>
        </div>
        <div class="rel-card calm">
          <div class="rc-label">마음이 놓이는 사람</div>
          <div class="rc-glyph">${HAN[calm][0]} · ${HAN[calm][1]}</div>
          <div class="rc-desc">${KR[calm]} 일간. 결정을 받아주고 기다려주는 결. 곁에 두면 다급함이 가라앉습니다.</div>
        </div>
      </div>`;
      const rgStart = out.indexOf('<div class="relation-grid">');
      const rgEnd = out.indexOf('</section>', rgStart);
      if (rgStart >= 0 && rgEnd > rgStart) {
        out = out.substring(0, rgStart) + relGrid + '\n    ' + out.substring(rgEnd);
      }
    }
  }

  // ═════════════════ Phase D: §07 신살 카드 — AI shinsalCards 우선, 없으면 v4Gilsin/v4Hyungsal 동적 ═════════════════
  const gilsin = p.v4Gilsin || [];
  const hyungsal = p.v4Hyungsal || [];
  const allSinSal = [...gilsin, ...hyungsal];

  // AI shinsalCards 우선 (사주 specific personalized)
  const aiShinsalCards = ai?.shinsalCards as Array<{ kr?: string; hanja?: string; tier?: string; from?: string; desc?: string; action?: string; strength?: number; when?: string }> | undefined;
  if (aiShinsalCards && aiShinsalCards.length > 0) {
    const buildAiCard = (c: typeof aiShinsalCards[0]) => {
      const tier = (c.tier || '강').replace(/[^강중참고]/g, '');
      const isMid = tier !== '강';
      const strength = Math.min(5, Math.max(1, Number(c.strength ?? (tier === '강' ? 5 : tier === '중' ? 4 : 3))));
      const dotsHtml = [0, 1, 2, 3, 4].map((i) => (i < strength ? '<span class="on"></span>' : '<span></span>')).join('');
      const when = c.when || (tier === '강' ? '상시 작동' : tier === '중' ? '상시 작동' : '특정 시기 활성');
      return `<div class="shinsal-card${isMid ? ' mid' : ''}">
          <div class="head">
            <span class="nm">${c.kr || ''}</span><span class="han">${c.hanja || ''}</span>
            <span class="tag">${tier === '강' ? '강 · 핵심' : tier === '중' ? '중 · 작동' : '참고'}</span>
          </div>
          <p>${c.from ? `${c.from}에서 발현됩니다. ` : ''}${c.desc || ''}</p>
          <div class="shinsal-meta">
            <div class="sm-pulse">${dotsHtml}</div>
            <span class="sm-when ${tier === '강' || tier === '중' ? 'always' : 'dae'}">${when}</span>
          </div>
          ${c.action ? `<div class="adv"><span class="adv-icon">!</span><span class="adv-text"><strong>실천:</strong> ${c.action}</span></div>` : ''}
        </div>`;
    };
    const groups = { 강: [] as string[], 중: [] as string[], 참고: [] as string[] };
    for (const c of aiShinsalCards) {
      const t = (c.tier || '강').includes('강') ? '강' : (c.tier || '').includes('중') ? '중' : '참고';
      groups[t as keyof typeof groups].push(buildAiCard(c));
    }
    const shinsalHtml = `${groups.강.length > 0 ? `<div class="shinsal-list">\n${groups.강.join('\n        ')}\n      </div>\n` : ''}
      ${groups.중.length > 0 ? `<div class="shinsal-list" style="margin-top: 12px;">\n${groups.중.join('\n        ')}\n      </div>\n` : ''}
      ${groups.참고.length > 0 ? `<div class="shinsal-list" style="margin-top: 12px;">\n${groups.참고.join('\n        ')}\n      </div>` : ''}`;
    const ssStart = out.indexOf('<!-- 강 — 큰 카드');
    const ssEnd = out.indexOf('<p style="font-size: 11.5px;', ssStart);
    if (ssStart >= 0 && ssEnd > ssStart) {
      out = out.substring(0, ssStart) + shinsalHtml + '\n\n      ' + out.substring(ssEnd);
    }
  } else if (allSinSal.length > 0 || true) {
    // Fallback: v4Gilsin/v4Hyungsal templated
    const buildSinsalCard = (s: V4SinSal, dotsCount: number, when: string, tier: '강' | '중' | '참고') => {
      const dotsHtml = [0, 1, 2, 3, 4].map((i) => (i < dotsCount ? '<span class="on"></span>' : '<span></span>')).join('');
      // 한글 매핑이 없으면 (kr === hanja), 한자만 표기하고 nm은 '신살' 일반 라벨 사용
      const hasKr = s.kr && s.kr !== s.hanja && /[가-힣]/.test(s.kr);
      const nmText = hasKr ? s.kr : '신살';
      const hanText = s.hanja || s.kr;
      return `<div class="shinsal-card${tier !== '강' ? ' mid' : ''}">
          <div class="head">
            <span class="nm">${nmText}</span><span class="han">${hanText}</span>
            <span class="tag">${tier === '강' ? '강 · 핵심' : tier === '중' ? '중 · 작동' : '참고'}</span>
          </div>
          <p>${s.desc || '본인 사주에 자리잡은 결입니다.'}</p>
          <div class="shinsal-meta">
            <div class="sm-pulse">${dotsHtml}</div>
            <span class="sm-when ${tier === '강' ? 'always' : 'dae'}">${when}</span>
          </div>
        </div>`;
    };
    const strong = allSinSal.slice(0, 2).map((s) => buildSinsalCard(s, 5, '상시 작동', '강')).join('\n        ');
    const mid = allSinSal.slice(2, 4).map((s) => buildSinsalCard(s, 4, '상시 작동', '중')).join('\n        ');
    const ref = allSinSal.slice(4).map((s) => buildSinsalCard(s, 3, '특정 시기 활성', '참고')).join('\n        ');

    const shinsalHtml = allSinSal.length > 0
      ? `${strong ? `<div class="shinsal-list">${strong}</div>\n` : ''}
      ${mid ? `<div class="shinsal-list" style="margin-top: 12px;">${mid}</div>\n` : ''}
      ${ref ? `<div class="shinsal-list" style="margin-top: 12px;">${ref}</div>` : ''}`
      : `<p style="font-size: 12.5px; color: #5C4A2E; padding: 14px; background: #F8F5EE; border-radius: 10px; border: 1px dashed #E5DFD0; text-align: center;">이번 사주에는 강하게 발현된 핵심 신살이 없습니다 — 균형 잡힌 결로 보아도 좋습니다.</p>`;

    const ssStart = out.indexOf('<!-- 강 — 큰 카드');
    const ssEnd = out.indexOf('<p style="font-size: 11.5px;', ssStart);
    if (ssStart >= 0 && ssEnd > ssStart) {
      out = out.substring(0, ssStart) + shinsalHtml + '\n\n      ' + out.substring(ssEnd);
    }
  }

  // ═════════════════ Phase E: §08 6관계 카드 (부모/형제/배우자/자녀/친구/상사) — 사용자 십성 분포 기반 ═════════════════
  if (pillars && pillars[2]?.천간오행) {
    const dayOh = pillars[2].천간오행 as OhengType;
    const dayYY = pillars[2].천간음양 || '양';
    // 십성 분포
    const SANGSAENG: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
    const SANGGEUK: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
    const sipDist: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    for (const pl of pillars) {
      if (!pl.available) continue;
      [pl.천간오행, pl.지지오행].forEach((tgt) => {
        if (!tgt) return;
        const t = tgt as OhengType;
        if (t === dayOh) sipDist.비겁++;
        else if (SANGSAENG[dayOh] === t) sipDist.식상++;
        else if (SANGGEUK[dayOh] === t) sipDist.재성++;
        else if (SANGGEUK[t] === dayOh) sipDist.관성++;
        else if (SANGSAENG[t] === dayOh) sipDist.인성++;
      });
    }
    void dayYY;
    const tagOf = (key: '인성' | '비겁' | '재성' | '식상' | '관성') => {
      const c = sipDist[key];
      return c >= 3 ? { cls: 't-warn', label: '태과' } : c >= 2 ? { cls: 't-good', label: '풍족' } : c >= 1 ? { cls: 't-neut', label: '보유' } : { cls: 't-warn', label: '얇음' };
    };
    // AI rel6Cards 우선 — 사주 specific personalized
    const aiRel6 = ai?.rel6Cards as Record<string, { summary: string; save: string; avoid: string; tag?: string }> | undefined;
    const aiCard = (k: 'parent' | 'sibling' | 'spouse' | 'child' | 'friend' | 'boss', fb: { summary: string; save: string; avoid: string }) => {
      const v = aiRel6?.[k];
      return {
        summary: v?.summary?.trim() || fb.summary,
        save: v?.save?.trim() || fb.save,
        avoid: v?.avoid?.trim() || fb.avoid,
        aiTag: v?.tag,
      };
    };
    // sipDist 카운트 별 분기 — 풍부한 변동성 확보
    const inseong = sipDist.인성, bigeop = sipDist.비겁, jaeseong = sipDist.재성, sigsang = sipDist.식상, gwanseong = sipDist.관성;
    const _parent = aiCard('parent', {
      summary: inseong >= 3
        ? `인성 ${inseong}자로 두텁습니다. 부모·본가의 영향이 평생 깊게 작용하는 결입니다 — 의지 자산이자 동시에 의존 패턴이 될 수 있는 자리.`
        : inseong >= 1
        ? `인성 ${inseong}자. 받아들이고 익히는 결로, ${shortName} 님이 본가·부모와 적당한 거리를 두며 자기 결을 키우는 자리입니다.`
        : `인성이 0자 — 부모·정규교육보다 ${shortName} 님 스스로 길을 찾아내는 결입니다. 독학·실전이 더 빛납니다.`,
      save: inseong >= 3
        ? `<strong>주기적 안부·짧고 잦은 방문</strong>으로 적당한 거리감을 유지. 정서적 분리가 자립의 첫 단계.`
        : inseong >= 1
        ? `<strong>주기적인 안부와 짧은 방문</strong>이 자산. 연락 빈도가 곧 관계의 깊이입니다.`
        : `명절·기념일 알림을 캘린더에 못 박아두세요. 인성이 얇으면 일부러 만들지 않으면 채워지지 않습니다.`,
      avoid: inseong >= 3
        ? `큰 결정을 부모에게 의탁하지 마세요. <strong>결정 권한이 본인에게 있는 영역을 매년 늘리는</strong> 연습이 필요합니다.`
        : `본가에서 큰 결정을 협의하지 마세요. <strong>결정은 본가 밖에서 내리고 결과만 공유</strong>하세요.`,
    });
    const _sibling = aiCard('sibling', {
      summary: bigeop >= 3
        ? `비겁 ${bigeop}자로 매우 두텁습니다. 형제·동료와 닮아서 든든하지만 같은 자원을 두고 부딪히기 쉬운 구조.`
        : bigeop >= 2
        ? `비겁 ${bigeop}자. 같은 결의 사람들과의 관계 자리 — 닮아서 든든하지만 닮아서 부딪힙니다.`
        : `비겁 ${bigeop}자로 얇습니다. 협력보다 ${shortName} 님 스스로 길을 여는 결이 강합니다.`,
      save: bigeop >= 3
        ? `같은 분야 협업의 폭발력은 크지만, <strong>역할·지분·의사결정 구조를 시작 전 100% 명문화</strong>해야 안전합니다.`
        : bigeop >= 2
        ? `같은 분야 협업은 폭발력이 큽니다. <strong>역할·지분을 시작 전에 명문화</strong>해야 합니다.`
        : `소수의 깊은 동료 한두 명이 평생 자산. 넓게보다 <strong>좁고 깊게</strong> 가는 편이 잘 맞습니다.`,
      avoid: jaeseong >= 1 && bigeop >= 2
        ? `<strong>겁재가 정재를 치는 구조</strong>. 가까운 사람과 큰 금액을 섞으면 한 번은 크게 깨집니다.`
        : `<strong>금전 거래·공동 투자는 사주가 가장 약한 자리</strong>. 한 번 깨지면 크게 깨집니다.`,
    });
    const _spouse = aiCard('spouse', {
      summary: jaeseong >= 3
        ? `재성 ${jaeseong}자로 두텁습니다. 깊은 관계가 빠르게 이뤄지는 결 — 단, 강한 자극보다 안정에 무게를 둘 때 길게 갑니다.`
        : jaeseong >= 1
        ? `재성 ${jaeseong}자. ${shortName} 님이 어떤 결의 사람과 깊어지는지 보이는 자리.`
        : `재성 0자 — 결혼·연애가 의도적으로 만들어가야 하는 결입니다. 자연스레 따라오기 어렵습니다.`,
      save: jaeseong >= 3
        ? `여러 결의 사람을 만나본 뒤 <strong>차분한 결</strong>을 선택하세요. 강한 자극은 짧고 안정은 깁니다.`
        : jaeseong >= 1
        ? `<strong>꾸준한 결의 사람</strong>이 잘 어울립니다. 안정된 약속·실리 기반 관계가 길게 갑니다.`
        : `의도적 만남(소개·동호회·취미모임)을 늘리세요. 자연스레는 인연이 잘 들어오지 않습니다.`,
      avoid: bigeop >= 2 && jaeseong >= 1
        ? `<strong>비겁이 재성을 치는 구조</strong>로, 친구·지인이 관계를 흔들기 쉽습니다. 가까운 사람의 평가를 그대로 받지 마세요.`
        : `즉흥적·강한 카리스마형은 흔들림이 큽니다. <strong>차분히 받쳐주는 결</strong>을 우선하세요.`,
    });
    const _child = aiCard('child', {
      summary: sigsang >= 3
        ? `식상 ${sigsang}자로 두텁습니다. 자녀가 ${shortName} 님의 표현 욕구를 발현시키는 결 — 가르치기보다 함께 만드는 부모가 됩니다.`
        : sigsang >= 1
        ? `식상 ${sigsang}자. 자녀와의 관계가 ${sigsang >= 2 ? '깊이 작용하는' : '얇지만 또렷한'} 자리.`
        : `식상 0자 — 자녀를 통해 표현·창작 결을 ${shortName} 님이 새로 발견하는 자리가 됩니다.`,
      save: sigsang >= 3
        ? `자녀의 <strong>표현·창작을 적극 지지</strong>하되, 본인의 기대가 압박이 되지 않도록 거리를 두세요.`
        : `자녀의 <strong>표현·창작을 적극적으로 받아주는 부모</strong>가 됩니다. 함께 무언가를 만드는 시간이 자산.`,
      avoid: gwanseong >= 2
        ? `<strong>관성이 두꺼워 자녀에게 규율을 강하게 적용</strong>하기 쉽습니다. 한 발 떨어져 보는 연습이 필요합니다.`
        : `본인의 기준을 자녀에게 투영하기 쉽습니다. <strong>다른 결을 받아들이는 연습</strong>이 평생 과제입니다.`,
    });
    const _friend = aiCard('friend', {
      summary: bigeop >= 3
        ? `비겁 ${bigeop}자 — 가만히 있어도 사람이 모이는 결. 단, 결을 잃기 쉬운 자리이기도 합니다.`
        : bigeop >= 1
        ? `비겁 ${bigeop}자. 필요할 때 사람이 자연스럽게 들어오는 결.`
        : `비겁 0자 — 사람을 모으기보다 깊은 한두 명에 집중하는 결이 자연스럽습니다.`,
      save: bigeop >= 3
        ? `사람의 결을 사업·콘텐츠·커뮤니티로 풀면 폭발력이 큽니다. <strong>모임·강연·SNS 자리</strong>에 본인을 두세요.`
        : `<strong>인연의 달에 만난 사람</strong>은 한 해 내내 이어집니다. 작은 정성이 다음 운의 다리.`,
      avoid: bigeop >= 3
        ? `사람이 많아지면 자기 결을 잃기 쉽습니다. <strong>한 달에 하루는 약속 없는 날</strong>을 캘린더에 못 박으세요.`
        : `좁은 인맥은 강점이지만, 모임·외부 자리도 분기에 한 번은 의도적으로 만드세요.`,
    });
    const _boss = aiCard('boss', {
      summary: gwanseong >= 3
        ? `관성 ${gwanseong}자로 매우 두텁습니다. 위계가 부담스럽고 윗사람과 마찰이 잦은 자리 — 1인·임원·창업 쪽이 정답.`
        : gwanseong >= 2
        ? `관성 ${gwanseong}자. 위계 안에서 필요한 만큼은 받쳐주는 결.`
        : gwanseong >= 1
        ? `관성 ${gwanseong}자로 얇습니다. 위계가 답답하게 느껴지는 자리 — 작은 조직·1인 자리가 더 잘 맞습니다.`
        : `관성 0자 — 조직 안에서 본인 결을 살리기 어렵습니다. <strong>1인 프로젝트·창업·자유 직군</strong>이 정답.`,
      save: gwanseong >= 3
        ? `위계 안에 머무르되 <strong>판단·재량이 보장된 자리</strong>(임원·팀장·전문직)로 단계적으로 올라가세요.`
        : `본인의 <strong>판단·재량이 보장되는 자리</strong>(1인 프로젝트·임원·창업)에서 가장 빛납니다.`,
      avoid: gwanseong <= 1
        ? `위계가 단단한 조직은 ${shortName} 님 사주를 거스릅니다. <strong>5년 이상 머무르지 마세요.</strong>`
        : sigsang >= 2
        ? `<strong>상관견관(傷官見官) 구조</strong>로 윗사람과 부딪힐 가능성이 큽니다. 정면 충돌은 피하세요.`
        : `위계가 단단한 조직에서 오래 버티려 하면 본인 사주를 거스르는 일. <strong>5년 이상은 권하지 않습니다.</strong>`,
    });
    const REL6: Array<{ cls: string; name: string; label: string; key: '인성' | '비겁' | '재성' | '식상' | '관성'; summary: string; save: string; avoid: string; aiTag?: string }> = [
      {
        cls: 'c-parent', name: '父 母', label: '부모', key: '인성',
        ..._parent,
      },
      { cls: 'c-sibling', name: '兄 弟', label: '형제·동기', key: '비겁', ..._sibling },
      { cls: 'c-spouse',  name: '配 偶', label: '배우자·연인', key: '재성', ..._spouse },
      { cls: 'c-child',   name: '子 女', label: '자녀', key: '식상', ..._child },
      { cls: 'c-friend',  name: '朋 友', label: '친구·동료', key: '비겁', ..._friend },
      { cls: 'c-boss',    name: '上 司', label: '상사·권위', key: '관성', ..._boss },
    ];
    const rel6Html = REL6
      .map((r) => {
        const tag = tagOf(r.key);
        // AI tag 가 있으면 그거 사용, 없으면 templated tag
        const tagLabel = r.aiTag || tag.label;
        const tagCls = r.aiTag
          ? (r.aiTag === '태과' || r.aiTag === '긴장' ? 't-warn'
            : r.aiTag === '풍족' || r.aiTag === '안정' || r.aiTag === '36~38 안정' ? 't-good'
            : 't-neut')
          : tag.cls;
        return `<div class="rel6-card ${r.cls}">
          <div class="rel6-head">
            <span class="rel6-name">${r.name}</span>
            <span class="rel6-label">${r.label}</span>
            <span class="rel6-tag ${tagCls}">${tagLabel}</span>
          </div>
          <p class="rel6-summary">${r.summary}</p>
          <div class="rel6-actions">
            <div class="rel6-do"><span class="ic">✓ 살릴 것</span><span class="txt">${r.save}</span></div>
            <div class="rel6-dont"><span class="ic">⚠ 조심할 것</span><span class="txt">${r.avoid}</span></div>
          </div>
        </div>`;
      })
      .join('\n        ');
    const rel6Start = out.indexOf('<!-- 6관계 카드');
    const rel6End = out.indexOf('<!-- 결론 -->', rel6Start);
    if (rel6Start >= 0 && rel6End > rel6Start) {
      out =
        out.substring(0, rel6Start) +
        `<!-- 6관계 카드 (요약 / ✓ 살릴 것 / ⚠ 조심 3블록 분리) -->
      <div class="rel6-list">
        ${rel6Html}
      </div>

      ` +
        out.substring(rel6End);
    }
  }

  // ═════════════════ Phase F: §10 action-list 7 카드 ═════════════════
  if (true) {
    // AI practice 본문 또는 기본 7 액션 (오행 강·약 기반 일부 분기)
    const cnt: Record<OhengType, number> = elements ? {
      목: Number(elements.목 ?? 0), 화: Number(elements.화 ?? 0),
      토: Number(elements.토 ?? 0), 금: Number(elements.금 ?? 0),
      수: Number(elements.수 ?? 0),
    } : { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    const sortedCnt = (Object.entries(cnt) as [OhengType, number][]).sort((a, b) => a[1] - b[1]);
    const weakest = sortedCnt[0][0]; // 가장 약한 오행
    const dominant = sortedCnt[sortedCnt.length - 1][0]; // 가장 강한 오행
    const ACTION_BY_WEAK: Record<OhengType, { ttl: string; desc: string }> = {
      목: { ttl: '"새 시작·자라남"을 의식적으로 일정에 박아두기', desc: `${shortName} 님 사주는 木이 얇습니다. 분기마다 한 번 새 프로젝트·새 학습·새 만남을 캘린더에 먼저 박아두세요. 木의 결은 일부러 만들어두지 않으면 채워지지 않습니다.` },
      화: { ttl: '하루 한 번 "드러내는 채널" 굴리기', desc: `${shortName} 님 사주는 火가 얇습니다. 글·영상·발표 — 본인 이름이 붙는 채널 하나를 1년 이상 끊김 없이 굴리세요. 火의 결은 드러나는 횟수만큼 자라납니다.` },
      토: { ttl: '"시스템 저축"을 구조로 설계하기', desc: `${shortName} 님 사주는 土가 얇습니다. 자동이체·적립식 계좌·고정비 축소 같은 시스템 저축을 의지가 아닌 구조로 박으세요. 土의 결은 의지로 안 됩니다, 구조로만 됩니다.` },
      금: { ttl: '외부 규율(마감·계약)을 의도적으로 설치', desc: `${shortName} 님 사주는 金이 얇습니다. 스스로 짜는 마감은 거의 지켜지지 않습니다. 발표일·계약일·코치 약속 — 외부 규율을 의도적으로 설치하세요.` },
      수: { ttl: '"안 하는 시간"을 캘린더에 먼저 박을 것', desc: `${shortName} 님 사주는 水가 얇습니다. 분기마다 2박 이상의 온전한 휴식을 즉흥이 아닌 캘린더에 먼저 박으세요. 水의 결은 비워둔 시간만큼 회복됩니다.` },
    };
    const ACTION_BY_DOMINANT: Record<OhengType, { ttl: string; desc: string }> = {
      목: { ttl: '동업·공동창업은 시작 전에 지분 못 박기', desc: `${shortName} 님은 木이 강해 같은 결의 사람과 부딪히기 쉽습니다. 동업·공동창업은 시작 전에 지분·의사결정 구조를 반드시 명문화하세요.` },
      화: { ttl: '감정 기복이 또렷한 날 결정 미루기', desc: `${shortName} 님은 火가 강해 감정 기복이 또렷합니다. 화가 올라오는 날은 중요한 결정을 다음 날로 미루세요.` },
      토: { ttl: '5년에 한 번 본인 자리를 점검', desc: `${shortName} 님은 土가 강해 머물려는 힘이 큽니다. 5년에 한 번은 본인 자리를 점검하고 변화 시기를 놓치지 마세요.` },
      금: { ttl: '결정을 하루 미뤄보는 연습', desc: `${shortName} 님은 金이 강해 "틀렸다·안 된다" 판단이 너무 빠릅니다. 결정을 하루 미뤄보는 연습이 필요합니다.` },
      수: { ttl: '"분석 그만, 실행"으로 끊어주기', desc: `${shortName} 님은 水가 강해 생각이 깊어 행동을 미루는 패턴이 있습니다. 일정 시점엔 "분석 그만, 실행"으로 끊어주세요.` },
    };
    // AI actionList 우선 — 사주 specific personalized
    const aiActions = ai?.actionList as Array<{ ttl: string; desc: string }> | undefined;

    // 사용자 십성 분포 계산 — 액션 변동성 추가용
    const dayOhAct = (pillars?.[2]?.천간오행 ?? '토') as OhengType;
    const SS_AC: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
    const SG_AC: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
    const sipAct: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    if (pillars) for (const pl of pillars) {
      if (!pl.available) continue;
      [pl.천간오행, pl.지지오행].forEach((tgt) => {
        if (!tgt) return;
        const t = tgt as OhengType;
        if (t === dayOhAct) sipAct.비겁++;
        else if (SS_AC[dayOhAct] === t) sipAct.식상++;
        else if (SG_AC[dayOhAct] === t) sipAct.재성++;
        else if (SG_AC[t] === dayOhAct) sipAct.관성++;
        else if (SS_AC[t] === dayOhAct) sipAct.인성++;
      });
    }

    // 십성 기반 액션 (사용자 분포에 따라 분기)
    const moneyAction = sipAct.비겁 >= 2 && sipAct.재성 >= 1
      ? { ttl: '가까운 사람과는 큰돈을 섞지 않기', desc: `${shortName} 님 사주는 <strong>비겁이 재성을 치는 구조</strong>(비겁 ${sipAct.비겁}자 vs 재성 ${sipAct.재성}자). 가족·친구와 큰 금액이 얽히면 한 번은 크게 깨집니다. 문서와 중립 제3자 없이 진행하지 마세요.` }
      : sipAct.재성 === 0
      ? { ttl: '"의도적 재물 시스템"을 구조로 박을 것', desc: `${shortName} 님 사주는 재성이 0자로 비어있는 결입니다. 자동이체·고정 적립·자산 분리 같은 시스템을 의지가 아닌 구조로 박아두세요. 의지로는 절대 안 채워집니다.` }
      : { ttl: '큰 지출은 24시간 보류 룰', desc: `재성 ${sipAct.재성}자. 충동 결정이 가장 큰 손실로 이어지는 자리입니다. 일정 금액 이상은 반드시 하루 묵혔다 결정하는 룰을 본인 캘린더에 박으세요.` };

    const careerAction = sipAct.식상 >= 2 && sipAct.관성 >= 1
      ? { ttl: '직장보다 1인 프로젝트·전문직으로', desc: `${shortName} 님 사주는 <strong>상관견관(傷官見官)</strong>(식상 ${sipAct.식상} · 관성 ${sipAct.관성}). 직장 안에서 답답한 건 능력이 아니라 사주 구조 탓입니다. 5년 이상 위계 단단한 조직에 머물지 마세요.` }
      : sipAct.관성 === 0
      ? { ttl: '외부 마감·계약을 의도적으로 설치', desc: `관성 0자 — 스스로 짜는 마감은 잘 지키지 않습니다. 발표일·계약일·코치 약속 같은 외부 규율을 의도적으로 끌어와야 결과가 나옵니다.` }
      : sipAct.관성 >= 3
      ? { ttl: '"내가 책임지는 자리"를 점진적으로 늘릴 것', desc: `관성 ${sipAct.관성}자로 두텁습니다. 위계 안에서 단계적으로 책임 자리(팀장·임원·전문직)로 올라가는 결이 자연스럽습니다.` }
      : { ttl: '본인 이름이 붙는 한 채널을 1년 이상', desc: `글·영상·강의·SNS — 본인 이름이 붙는 채널을 1년 이상 끊김 없이 굴리면 다음 대운에서 빛이 됩니다.` };

    const expressionAction = sipAct.식상 >= 2
      ? { ttl: '"표현하는 채널"을 1년 이상 굴리기', desc: `식상 ${sipAct.식상}자. 표현·창작이 본인 사주의 핵심 강점. 글·영상·강의 — 한 채널을 멈추지 말고 굴리면 평생 자산이 됩니다.` }
      : sipAct.식상 === 0
      ? { ttl: '의도적 표현 자리 분기에 한 번 만들기', desc: `식상 0자 — 자연스레 표현이 안 나오는 결입니다. 분기에 한 번 발표·기고·소셜 포스팅 같은 자리를 캘린더에 먼저 박아두세요.` }
      : { ttl: '꾸준한 표현으로 결을 다지기', desc: `식상 ${sipAct.식상}자. 표현 결이 약하지 않습니다 — 꾸준히 한 채널만 굴려도 차근차근 자산이 쌓입니다.` };

    const learnAction = sipAct.인성 >= 3
      ? { ttl: '"배우기"보다 "산출하기"로 무게 이동', desc: `인성 ${sipAct.인성}자로 두텁습니다. 학습 결은 강하지만 자칫 "배움 안에서만" 머물기 쉬운 자리입니다. 배운 즉시 산출(글·발표·작품)로 이어주세요.` }
      : sipAct.인성 === 0
      ? { ttl: '독학·실전으로 익히는 시스템 구축', desc: `인성 0자 — 정규교육보다 독학·실전이 더 빛나는 결입니다. 자격·언어·전문 분야 하나는 ${shortName} 님 만의 방식으로 갱신하세요.` }
      : { ttl: '평생 학습의 한 분야 못 박기', desc: `자격·언어·전문 분야 하나는 평생 갱신. 5년 단위로 깊이를 쌓는 결이 늘 자산이 됩니다.` };

    const peopleAction = sipAct.비겁 >= 3
      ? { ttl: '"잘하는 사람" 옆 깎이는 자리에 앉기', desc: `비겁 ${sipAct.비겁}자로 두텁습니다. 같은 결의 사람들과만 있으면 결이 굳어집니다. 한 수 위인 사람 곁에 의도적으로 자리를 만드세요.` }
      : sipAct.비겁 === 0
      ? { ttl: '깊은 동료 한두 명을 평생 자산으로', desc: `비겁 0자 — 인맥 폭발보다 깊은 한두 명에 집중. 만난 사람을 분기마다 한 번은 챙기는 루틴을 만드세요.` }
      : { ttl: '필요할 때 손 내미는 동료 키우기', desc: `평소에 챙기지 않으면 위급할 때 도와줄 사람이 사라집니다. 분기에 한 번은 의도적 식사·만남.` };

    const restAction = elements && Number(elements.수 ?? 0) <= 1
      ? { ttl: '"안 하는 시간"을 캘린더에 먼저 박을 것', desc: `${shortName} 님 사주는 水(물)가 얇습니다. 분기마다 2박 이상 온전한 휴식을 즉흥이 아니라 캘린더에 먼저 박으세요. 水의 결은 비워둔 시간만큼 회복됩니다.` }
      : { ttl: '하루의 끝에 5분 침묵', desc: `${shortName} 님 사주의 결을 가장 작게 다루는 행위. 끝까지 타다 무너지는 패턴은 침묵이 자기 안의 물을 길어 올리는 행위로 풀립니다.` };

    const healthAction = elements && (Number(elements.화 ?? 0) >= 3 || Number(elements.목 ?? 0) >= 3)
      ? { ttl: '매년 같은 달 종합검진 + 간·심혈관 추적', desc: `${shortName} 님 사주는 ${Number(elements.화 ?? 0) >= 3 ? '火가 두꺼워 심혈관·혈압' : '木이 두꺼워 간·근골'} 부담이 큰 결입니다. 매년 같은 달에 종합검진을 예약해 두세요.` }
      : { ttl: '40세 이후 종합검진을 달력에 고정', desc: `매년 같은 달에 종합검진을 예약. 본인 사주의 약한 결을 별도로 추적하면 다음 대운의 정점을 온전히 받을 수 있습니다.` };

    const actions: Array<{ ttl: string; desc: string }> = (aiActions && aiActions.length > 0)
      ? aiActions.slice(0, 9).filter((a) => a?.ttl && a?.desc)
      : [
          ACTION_BY_WEAK[weakest],
          ACTION_BY_DOMINANT[dominant],
          moneyAction,
          careerAction,
          expressionAction,
          learnAction,
          peopleAction,
          restAction,
          healthAction,
        ];
    const actionHtml = actions
      .map((a, i) => `<div class="action-card">
          <div class="num">${i + 1}</div>
          <div class="body">
            <div class="ttl">${a.ttl}</div>
            <div class="desc">${a.desc}</div>
          </div>
        </div>`)
      .join('\n        ');
    const alStart = out.indexOf('<div class="action-list">');
    const alEnd = out.indexOf('</div>\n\n      <div class="pullquote">', alStart);
    if (alStart >= 0 && alEnd > alStart) {
      out =
        out.substring(0, alStart) +
        `<div class="action-list">
        ${actionHtml}
      ` +
        out.substring(alEnd);
    }
  }

  // ═════════════════ Phase G: section-conclusion 다크 박스들 — AI sectionConclusions 우선, 없으면 templated ═════════════════
  // AI 가 sectionConclusions 필드 (wongug/structure/sipsung/yongsin/relation) 제공하면 그거 사용
  const aiConcl = ai?.sectionConclusions as Record<string, string> | undefined;
  if (pillars && pillars.length >= 4 && elements) {
    const dayOh = pillars[2]?.천간오행 as OhengType;
    const HAN: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
    const ohKr: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
    const cnt: Record<OhengType, number> = {
      목: Number(elements.목 ?? 0), 화: Number(elements.화 ?? 0),
      토: Number(elements.토 ?? 0), 금: Number(elements.금 ?? 0),
      수: Number(elements.수 ?? 0),
    };
    const sortedOh = (Object.entries(cnt) as [OhengType, number][]).sort((a, b) => b[1] - a[1]);
    const dom = sortedOh[0][0];
    const weak = sortedOh[sortedOh.length - 1][0];

    // ─ §01 section-conclusion (AI 우선)
    const concl01Text = aiConcl?.wongug?.trim()
      || `${shortName} 님은 <strong>${HAN[dayOh]}(${ohKr[dayOh]}) 일간으로, ${HAN[dom]}이 가장 두텁고 ${HAN[weak]}이 가장 얇은 사주</strong>입니다. 강점을 살리되 부족함을 채우는 결이 평생 작동합니다. ${weak === dayOh ? '특히 본인 일간 오행도 얇아 자기 결을 자주 잃기 쉬운 사주' : '본인 일간 결은 단단합니다'} — ${ohKr[weak]}의 결을 의식적으로 채우는 자리가 인생을 가장 멀리 데려갑니다.`;
    const concl01 = `<div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론 — 한 줄로 요약하면</div>
        <p>
          ${concl01Text}
        </p>
      </div>`;
    out = out.replace(
      /<!-- 원국 섹션 요약 \(핵심 결론\) -->\s*<div class="section-conclusion">[\s\S]*?재능보다 '브레이크'를[\s\S]*?<\/div>/,
      `<!-- 원국 섹션 요약 (핵심 결론) -->\n      ${concl01}`,
    );

    // ─ §02 section-conclusion (AI 우선)
    const concl02Body = aiConcl?.structure?.trim()
      ? aiConcl.structure.split(/\n+/).filter((s) => s.trim()).map((s, i) => `<p><span class="sc-num">${['①', '②', '③', '④', '⑤'][i] || ''}</span> ${s.trim()}</p>`).join('\n        ')
      : `<p><span class="sc-num">①</span> 일간 <strong>${HAN[dayOh]}(${ohKr[dayOh]})</strong>의 결을 평생 따라가게 됩니다. 본인 결을 거스르는 자리에 오래 두지 마세요.</p>
        <p><span class="sc-num">②</span> 천간(마음)과 지지(행동)의 짜임이 일치할수록 자연스럽고, 어긋날수록 "보여지는 모습과 실제 행동이 다르다"는 결이 강해집니다.</p>
        <p><span class="sc-num">③</span> 자세한 합·충·형은 위 카드를 참조하세요. 본인에게 도드라진 관계가 평생 작동하는 결입니다.</p>`;
    const concl02 = `<div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론 — 그래서 뭘 얻고 뭘 해야 하나</div>
        ${concl02Body}
      </div>`;
    out = out.replace(
      /<div class="section-conclusion">\s*<div class="sc-label">이 섹션의 결론 — 그래서 뭘 얻고 뭘 해야 하나<\/div>\s*<p><span class="sc-num">①<\/span> <strong>"내가 끌고 가야지"의 본능<\/strong>[\s\S]*?<\/div>/,
      concl02,
    );

    // ─ §03 section-conclusion (사용자 십성 분포 기반)
    const SANGSAENG: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
    const SANGGEUK: Record<OhengType, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
    const sipDist03: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    for (const pl of pillars) {
      if (!pl.available) continue;
      [pl.천간오행, pl.지지오행].forEach((tgt) => {
        if (!tgt) return;
        const t = tgt as OhengType;
        if (t === dayOh) sipDist03.비겁++;
        else if (SANGSAENG[dayOh] === t) sipDist03.식상++;
        else if (SANGGEUK[dayOh] === t) sipDist03.재성++;
        else if (SANGGEUK[t] === dayOh) sipDist03.관성++;
        else if (SANGSAENG[t] === dayOh) sipDist03.인성++;
      });
    }
    const sipTotal = sipDist03.비겁 + sipDist03.식상 + sipDist03.재성 + sipDist03.관성 + sipDist03.인성 || 1;
    const sipPct = (k: string) => Math.round((sipDist03[k] / sipTotal) * 100);
    const dominantSip03 = (Object.entries(sipDist03) as [string, number][]).sort((a, b) => b[1] - a[1])[0][0];
    // §03 section-conclusion (AI 우선)
    const concl03Body = aiConcl?.sipsung?.trim()
      ? aiConcl.sipsung.split(/\n+/).filter((s) => s.trim()).map((s) => `<p>${s.trim()}</p>`).join('\n        ')
      : `<p style="font-size:14px; font-weight:500; line-height:1.65;">
          "<strong>${dominantSip03}이 가장 두꺼운 결로, ${dominantSip03 === '비겁' ? '자기 길을 개척하는' : dominantSip03 === '식상' ? '만들어내고 표현하는' : dominantSip03 === '재성' ? '실리·자원을 다루는' : dominantSip03 === '관성' ? '책임·평가를 받쳐주는' : '받아들이고 익히는'} 사람</strong>"
        </p>
        <p>→ 본인의 ${dominantSip03}(${sipPct(dominantSip03)}%)이 강점입니다. 이 결을 살리는 자리에 가야 본인이 살아납니다.</p>
        <p>→ <strong>${sipDist03.비겁 >= 2 && sipDist03.재성 >= 1 ? '겁재가 정재를 밀어내는 구조' : sipDist03.식상 >= 2 && sipDist03.관성 >= 1 ? '상관견관(傷官見官) 구조' : '균형 잡힌 십성 분포'}</strong>가 보입니다. ${sipDist03.비겁 >= 2 && sipDist03.재성 >= 1 ? '돈을 가까운 사람과 섞지 마세요. 동업·지인 투자는 통계가 아니라 사주에 박힌 취약점입니다.' : sipDist03.식상 >= 2 && sipDist03.관성 >= 1 ? '직장 안에서 답답한 건 능력 부족이 아니라 사주 구조 탓. 1인 프로젝트·사업 쪽이 사주에 더 맞습니다.' : '한쪽으로 치우치지 않으니 다재다능한 결입니다.'}</p>`;
    const concl03 = `<div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론 — 한 줄로 ${shortName} 님은</div>
        ${concl03Body}
      </div>`;
    out = out.replace(
      /<!-- 십성 섹션 요약 — "나는 이런 사람" -->\s*<div class="section-conclusion">[\s\S]*?사주에 박힌 취약점입니다\.<\/strong><\/p>\s*<\/div>/,
      `<!-- 십성 섹션 요약 -->\n      ${concl03}`,
    );

    // ─ §04 section-conclusion (용신 기반)
    let primaryYS04: OhengType = '토';
    if (typeof ai?.analysisBase?.용신 === 'string') {
      const ohMap: Record<string, OhengType> = { 木: '목', 火: '화', 土: '토', 金: '금', 水: '수', 목: '목', 화: '화', 토: '토', 금: '금', 수: '수' };
      primaryYS04 = ohMap[ai.analysisBase.용신.charAt(0)] || '토';
    } else {
      primaryYS04 = sortedOh[sortedOh.length - 1][0]; // 가장 약한 오행
    }
    const YONGSIN_ACTIONS: Record<OhengType, string[]> = {
      목: ['책상을 <strong>동쪽</strong>으로 돌리세요. 이게 1번입니다.', '옷장에 <strong>녹색·청록 비중을 50% 이상</strong>으로.', '결정·계약·발표는 <strong>3~5월, 새벽~오전</strong>에 잡으세요.', '<strong>등산·식물 키우기·필사</strong>를 정기 루틴으로.'],
      화: ['책상을 <strong>남쪽</strong>으로 돌리세요. 이게 1번입니다.', '옷장에 <strong>빨강·주황 비중을 30% 이상</strong>으로.', '결정·계약·발표는 <strong>5~8월, 한낮</strong>에 잡으세요.', '<strong>달리기·요리·발표</strong>를 정기 루틴으로.'],
      토: ['책상을 <strong>중앙·서남쪽</strong>으로 돌리세요. 이게 1번입니다.', '옷장에 <strong>황색·갈색·베이지 비중을 50% 이상</strong>으로.', '결정·계약·발표는 <strong>환절기 7·8시 / 13·14시</strong>에 잡으세요.', '<strong>도자기·텃밭·요가</strong>를 정기 루틴으로.'],
      금: ['책상을 <strong>서쪽 또는 북서쪽</strong>으로 돌리세요. 이게 1번입니다.', '옷장에 <strong>검정·흰색·은색 비중을 70% 이상</strong>으로.', '결정·계약·발표는 <strong>9~11월, 17시 이후</strong>에 잡으세요.', '<strong>서예·검도·요리(칼)</strong>를 정기 루틴으로.'],
      수: ['책상을 <strong>북쪽</strong>으로 돌리세요. 이게 1번입니다.', '매일 <strong>물 2L</strong>를 마시세요. 의지가 아니라 보급입니다.', '결정·계약·발표는 <strong>11~2월, 23시 이후</strong>에 잡으세요.', '<strong>수영·반신욕·명상</strong>을 정기 루틴으로.'],
    };
    // §04 section-conclusion (AI 우선)
    const concl04Body = aiConcl?.yongsin?.trim()
      ? aiConcl.yongsin.split(/\n+/).filter((s) => s.trim()).map((s) => `<p>→ ${s.trim().replace(/^[→·\-]\s*/, '')}</p>`).join('\n        ')
      : YONGSIN_ACTIONS[primaryYS04].map((s) => `<p>→ ${s}</p>`).join('\n        ');
    const concl04 = `<div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론 — 오늘부터 못 박을 것</div>
        ${concl04Body}
      </div>`;
    out = out.replace(
      /<!-- 결론 -->\s*<div class="section-conclusion">\s*<div class="sc-label">이 섹션의 결론 — 오늘부터 못 박을 것<\/div>[\s\S]*?같은 일도 흐름이 다릅니다\.\s*<\/p>\s*<\/div>/,
      `<!-- 결론 -->\n      ${concl04}`,
    );

    // ─ §08 section-conclusion (관계 한 줄)
    // §08 section-conclusion (AI 우선)
    const concl08Body = aiConcl?.relation?.trim()
      || `${shortName} 님 인생의 가장 큰 자산은 <strong>관계</strong>입니다. 동시에 가장 큰 위험도 <strong>관계</strong>입니다 — ${sipDist03.비겁 >= sipDist03.재성 ? '비겁이 재성을 밀어내는 구조라' : '관계 자리가 두꺼워'} <strong>"가까이 두되 돈은 섞지 않는다"</strong>가 평생의 원칙이 되어야 합니다. 그리고 <strong>${primaryYS04 === '수' ? '壬·癸(水)' : primaryYS04 === '목' ? '甲·乙(木)' : primaryYS04 === '화' ? '丙·丁(火)' : primaryYS04 === '토' ? '戊·己(土)' : '庚·辛(金)'} 일간의 사람</strong>을 곁에 두세요. 부족한 ${HAN[primaryYS04]}을 채워줍니다.`;
    const concl08 = `<div class="section-conclusion">
        <div class="sc-label">이 섹션의 결론 — 관계 한 줄 정리</div>
        <p>
          ${concl08Body}
        </p>
      </div>`;
    out = out.replace(
      /<!-- 결론 -->\s*<div class="section-conclusion">\s*<div class="sc-label">이 섹션의 결론 — 관계 한 줄 정리<\/div>[\s\S]*?부족한 물을 채워줍니다\.\s*<\/p>\s*<\/div>/,
      `<!-- 결론 -->\n      ${concl08}`,
    );
  }

  // ═════════════════ Phase H: §06 section-title sub "2026 병오(丙午)" — 현재 연도 + 동적 간지 ═════════════════
  {
    const today = new Date();
    const year = today.getFullYear();
    // 60갑자 — 1984년 갑자(甲子) 기준
    const SIXTY = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
      '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
      '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
      '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
      '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
      '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];
    const yearGz = SIXTY[(year - 1984 + 6000) % 60];
    const SIXTY_KR_MAP: Record<string, string> = {
      甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
      子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
    };
    const yearGzKr = (SIXTY_KR_MAP[yearGz[0]] || '') + (SIXTY_KR_MAP[yearGz[1]] || '');
    out = out.replace(
      /<span style="font-size:13px; color:#7F6B4E; font-weight:400;">2026 병오\(丙午\)<\/span>/,
      `<span style="font-size:13px; color:#7F6B4E; font-weight:400;">${year} ${yearGzKr}(${yearGz})</span>`,
    );
  }

  // ═════════════════ Phase I: §07 section-sub "5개가 자리합니다" — 실제 신살 count ═════════════════
  {
    const totalSinSal = (p.v4Gilsin?.length || 0) + (p.v4Hyungsal?.length || 0);
    const strongCount = Math.min(2, totalSinSal);
    const midCount = Math.min(2, Math.max(0, totalSinSal - 2));
    const refCount = Math.max(0, totalSinSal - 4);
    const sinsalSubText = totalSinSal > 0
      ? `사주마다 성립 조건이 달라 0~10개까지 다릅니다 · ${shortName} 님께는 <strong>${totalSinSal}개</strong>가 자리합니다 (강 ${strongCount} · 중 ${midCount} · 참고 ${refCount})`
      : `사주마다 성립 조건이 달라 0~10개까지 다릅니다 · ${shortName} 님께는 강하게 발현된 신살이 없어 균형 잡힌 결입니다`;
    out = out.replace(
      /사주마다 성립 조건이 달라 0~10개까지 다릅니다 · 준기 님께는 <strong>5개<\/strong>가 자리합니다 \(강 2 · 중 2 · 참고 1\)/,
      sinsalSubText,
    );
  }

  // ═════════════════ Phase J: §07 신살 카드 안 'adv' (실천) 블록 추가 ═════════════════
  // 이전 Phase D 가 head + p + meta 만 그렸지 adv 블록을 빼먹음 — 추가
  {
    const ACTION_TIP: Record<string, string> = {
      도화살: '한 달에 하루는 약속 없이 혼자 보낼 것. 도화는 적당히 거리를 두는 사람에게 가장 강하게 작동합니다.',
      도화: '한 달에 하루는 약속 없이 혼자 보낼 것. 도화는 적당히 거리를 두는 사람에게 가장 강하게 작동합니다.',
      문창귀인: '"쓰는 채널" 한 곳을 5년 단위로 굴릴 것. 직업 선택 시 글·강의가 들어가는 자리가 무조건 유리합니다.',
      천을귀인: '결정적 순간에 도와줄 사람이 나타납니다. 평소 인연을 가벼이 보지 마세요.',
      역마살: '3년 이상 같은 자리에 묶이지 않도록 의식적으로 영역을 넓힐 것. 한 회사에서도 직무 전환을 활용합니다.',
      역마: '3년 이상 같은 자리에 묶이지 않도록 의식적으로 영역을 넓힐 것. 한 회사에서도 직무 전환을 활용합니다.',
      홍염살: '결혼·동거의 큰 결정은 36~38세에 안정됩니다. 그 전에는 강도보다 다양성을 경험하세요.',
      홍염: '결혼·동거의 큰 결정은 36~38세에 안정됩니다. 그 전에는 강도보다 다양성을 경험하세요.',
      화개살: '예술·연구·종교성 — 한 분야를 깊이 파고드는 결을 살리세요.',
      화개: '예술·연구·종교성 — 한 분야를 깊이 파고드는 결을 살리세요.',
      학당귀인: '평생 학습 — 자격·언어·전문 분야 하나는 꾸준히 갱신.',
      백호살: '추진력은 강점, 건강은 부담. 매년 같은 달에 종합검진 예약.',
      백호: '추진력은 강점, 건강은 부담. 매년 같은 달에 종합검진 예약.',
      공망: '공망 글자가 들어오는 해에는 새 사업·큰 투자를 미루고 학습·자격·관계 정비에 시간을 투자하세요.',
      원진살: '특정 띠 사람과는 거리감 유지. 같은 일은 멀리서 다루는 편이 낫습니다.',
      원진: '특정 띠 사람과는 거리감 유지. 같은 일은 멀리서 다루는 편이 낫습니다.',
      양인살: '결단력의 양면 — 큰 결정 전 24시간 보류 룰을 두세요.',
      양인: '결단력의 양면 — 큰 결정 전 24시간 보류 룰을 두세요.',
      괴강: '강한 결단력은 강점이지만, 양보가 부족하면 충돌이 큽니다. 큰 결정 전 한 사람의 의견은 꼭 듣고 가세요.',
      괴강살: '강한 결단력은 강점이지만, 양보가 부족하면 충돌이 큽니다. 큰 결정 전 한 사람의 의견은 꼭 듣고 가세요.',
      장성: '리더 자리가 잘 맞습니다. 작은 모임이라도 의도적으로 모임장을 자처해 보세요.',
      반안: '안정·승진의 기운. 직장 안에서 차근차근 쌓는 결을 살리세요.',
      탕화: '뜨거운 자리·갈등 자리에서 본인이 데이기 쉽습니다. 한 박자 늦추는 연습이 필요합니다.',
      탕화살: '뜨거운 자리·갈등 자리에서 본인이 데이기 쉽습니다. 한 박자 늦추는 연습이 필요합니다.',
      금여: '윗사람·배우자의 도움이 큰 자산. 평소에 인사·관계 관리를 가벼이 보지 마세요.',
      금여록: '윗사람·배우자의 도움이 큰 자산. 평소에 인사·관계 관리를 가벼이 보지 마세요.',
      귀문: '예민한 직감이 강점이자 약점. 사람·상황을 너무 깊이 파지 말고 거리를 두세요.',
      귀문살: '예민한 직감이 강점이자 약점. 사람·상황을 너무 깊이 파지 말고 거리를 두세요.',
      혈기: '정기 건강검진을 매년 같은 달에 예약. 특히 혈액검사·심혈관 체크가 우선.',
      귀기: '여행·출장 후엔 충분히 쉬어야 컨디션이 회복됩니다. 무리한 일정은 피하세요.',
      혈지: '날카로운 도구·운전·운동 시 안전에 더 신경. 작은 부주의가 큰 사고로 이어집니다.',
    };
    // shinsal-card 의 close </div> 직전에 adv 블록 한 번에 삽입
    // shinsal-card 패턴: <div class="shinsal-card[ mid]?"> ... </div>
    out = out.replace(
      /<div class="shinsal-card([^"]*)">([\s\S]*?<span class="nm">([^<]+)<\/span>[\s\S]*?<div class="shinsal-meta">[\s\S]*?<\/div>)\s*<\/div>/g,
      (_m, cls, body, name) => {
        const tip = ACTION_TIP[name] || '본인의 결을 살리는 자리를 의도적으로 선택하세요.';
        return `<div class="shinsal-card${cls}">${body}\n          <div class="adv"><span class="adv-icon">!</span><span class="adv-text"><strong>실천:</strong> ${tip}</span></div>\n        </div>`;
      },
    );
  }

  // ═════════════════ Phase K: §05 마지막 pullquote — "지금은 모양이 잡히는 10년" 일반화 ═════════════════
  if (v4dae && v4dae.length > 0) {
    const cur = v4dae.find((d) => d.current);
    if (cur) {
      const newQuote = `지금은 ${cur.gz}(${cur.kr || ''}) 대운의 한가운데. ${cur.label || '준비'}의 10년이며, 결과를 받을 그릇을 굽는 시기입니다.`;
      out = out.replace(
        /<div class="pullquote">\s*<p>지금은 모양이 잡히는 10년[\s\S]*?받을 그릇을 굽는 10년이다\.<\/p>\s*<\/div>/,
        `<div class="pullquote"><p>${newQuote}</p></div>`,
      );
    }
  }

  // ═════════════════ Phase 10: Name sweep — narrative 본문의 모든 "변준기" / "준기" 치환 ═════════════════
  // 변준기 (full) → fullName
  out = out.split('변준기').join(fullName);
  // 준기 (short, narrative) → shortName
  // 단어 경계 보장: "준기 님" / "준기 사주" 같은 패턴만 — 이미 변준기 처리한 후라 안전
  out = out.split('준기').join(shortName);

  return out;
}

/** 사주 십성 — 일간 오행 + 대상 오행 → 비겁/식상/재성/관성/인성 */
function getSipsungSimple(dayOheng: OhengType, target: OhengType): string {
  const SANGSAENG: Record<OhengType, OhengType> = {
    목: '화', 화: '토', 토: '금', 금: '수', 수: '목',
  };
  const SANGGEUK: Record<OhengType, OhengType> = {
    목: '토', 화: '금', 토: '수', 금: '목', 수: '화',
  };
  if (target === dayOheng) return '비겁';
  if (SANGSAENG[dayOheng] === target) return '식상';
  if (SANGGEUK[dayOheng] === target) return '재성';
  if (SANGGEUK[target] === dayOheng) return '관성';
  if (SANGSAENG[target] === dayOheng) return '인성';
  return '—';
}

// ─────────────────────────────────────────────────────────────────
// Component — props 받아서 personalize 후 iframe 렌더
// ─────────────────────────────────────────────────────────────────
export interface ResultPagePremiumV2Props {
  name?: string;
  input?: SajuInput;
  sajuData?: SajuData;
  v4Daeun?: V4Daeun[];
  v4Gilsin?: V4SinSal[];
  v4Hyungsal?: V4SinSal[];
  scores?: Record<string, number>;
  aiResult?: any;
}

export function ResultPagePremiumV2(props: ResultPagePremiumV2Props = {}) {
  const html = personalize(MOCKUP_HTML, props);
  return (
    <iframe
      srcDoc={html}
      title="사주500 — 프리미엄 결과"
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        display: 'block',
        margin: 0,
        padding: 0,
      }}
    />
  );
}
