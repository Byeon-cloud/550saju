// 사주500 프리미엄 결과 페이지 — mockup 진본 CSS 1:1 포팅
// 출처: docs/mockups/사주500_UI개편_목업_결과프리미엄_v2.html (CSS 7~1220줄)
// 주입 방식: <style dangerouslySetInnerHTML={{ __html: PREMIUM_MOCKUP_CSS }} />
// 충돌 방지: 모든 selector 는 .premium-mockup 부모 안에서만 작동

export const PREMIUM_MOCKUP_CSS = `/* =========================================================
     사주500 — 프리미엄 결과 페이지 (10운, 변준기 샘플)
     - 실 카피 기반 퀄리티 증명용 목업
     - 7섹션: 원국 / 천간지지 / 십성 / 대운 / 연운 / 신살 / 실천
     - 분량: 7섹션 깊이 풀이 (실 카피)
     ========================================================= */  
  .premium-mockup .page-wrap {
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    background: #F4EFE4;
    min-height: 100vh;
    position: relative;
    box-shadow: 0 0 80px rgba(0,0,0,.4);
    /* 가로 오버플로우 차단 — 내부 nowrap/고정폭 요소가 페이지를 뷰포트 밖으로
       밀어 전체가 옆으로 스크롤되던 버그 fix. clip = scroll container 안 만듦
       → sticky 헤더·내부 overflow-x:auto 스크롤 영역 정상 유지. */
    overflow-x: clip;
    box-sizing: border-box;
  }
  /* clip 미지원 구형 WebView 폴백 */
  @supports not (overflow: clip) {
    .premium-mockup .page-wrap { overflow-x: hidden; }
  }/* ─── ResultHeader (상단 고정 헤더) ─────────────────────── */

  
  .premium-mockup .header {
    position: sticky; top: 0; z-index: 50;
    background: linear-gradient(180deg, #1a1a1a 0%, #2a2520 100%);
    color: #fff;
    padding: 14px 20px 12px;
    display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid rgba(212,175,55,.3);
  }
  .premium-mockup .header .back { font-size: 22px; cursor: pointer; opacity: .8; }
  .premium-mockup .header .meta { flex: 1; }
  .premium-mockup .header .meta .title { font-family: 'Noto Serif KR', serif; font-size: 15px; font-weight: 600; letter-spacing: 0; }
  .premium-mockup .header .meta .sub { font-size: 11px; color: #E8D9B8; margin-top: 2px; letter-spacing: 0.05em; }
  .premium-mockup .header .badge {
    background: linear-gradient(135deg, #E8D9B8 0%, #B8965A 100%);
    color: #1a1a1a;
    font-size: 11px; font-weight: 700;
    padding: 4px 10px; border-radius: 100px;
    letter-spacing: 0.08em;
  }/* ─── Hero (인물 정보 카드) ──────────────────────────── */

  
  .premium-mockup .hero {
    background: linear-gradient(180deg, #1a1a1a 0%, #1a1a1a 60%, #F4EFE4 60%, #F4EFE4 100%);
    padding: 24px 20px 0;
    position: relative;
  }
  .premium-mockup .hero-card {
    background: linear-gradient(135deg, #F4EFE4 0%, #F0E8D9 100%);
    border-radius: 16px;
    padding: 24px 22px;
    box-shadow: 0 12px 40px rgba(0,0,0,.25), 0 0 0 1px rgba(212,175,55,.4);
    position: relative;
    overflow: hidden;
  }
  .premium-mockup .hero-card::before {
    display: none; /* 2026-10-10 v9 워터마크 제거 */
    content: '命';
    position: absolute;
    right: -10px; bottom: -30px;
    font-family: 'Noto Serif KR', serif;
    font-size: 180px; font-weight: 900;
    color: rgba(212,175,55,.08);
    line-height: 1;
  }
  .premium-mockup .hero-card .person {
    font-family: 'Noto Serif KR', serif;
    font-size: 24px; font-weight: 700;
    color: #1a1a1a;
    letter-spacing: -0.02em;
  }
  .premium-mockup .hero-card .birth {
    font-size: 13px; color: #5C4A2E; margin-top: 6px;
    font-feature-settings: 'tnum';
  }
  .premium-mockup .hero-card .ilgan {
    margin-top: 16px;
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(46, 125, 50, 0.08);
    border: 1px solid rgba(46, 125, 50, 0.2);
    padding: 8px 14px; border-radius: 100px;
  }
  .premium-mockup .hero-card .ilgan .hanja {
    font-family: 'Noto Serif KR', serif;
    font-size: 18px; font-weight: 700;
    color: #4E7A57;
  }
  .premium-mockup .hero-card .ilgan .label {
    font-size: 12px; color: #4E7A57; font-weight: 500;
  }
  .premium-mockup .hero-card .meta {
    margin-top: 14px;
    display: flex; gap: 12px; font-size: 11px; color: #7F6B4E;
    position: relative; z-index: 2;
  }
  .premium-mockup .hero-card .meta span { display: inline-flex; align-items: center; gap: 4px; }/* ─── 섹션 공통 ──────────────────────────────────── */

  
  .premium-mockup .content { padding: 0 20px 100px; background: #F4EFE4; }
  .premium-mockup .section { margin-top: 32px; }
  .premium-mockup .section-num {
    /* 2026-10-10 v9 — 'SECTION 01' 영문 머리 → 一 二 三 (붉은 낙관색 · 전 콘텐츠 같은 섹션 머리) */
    display: inline-block;
    font-family: 'Noto Serif KR', serif;
    font-size: 17px; font-weight: 900;
    color: #A23A2A;
    letter-spacing: 0;
    margin-bottom: 4px;
  }
  .premium-mockup .section-title {
    font-family: 'Noto Serif KR', serif;
    font-size: 21px; font-weight: 700;
    color: #1a1a1a;
    letter-spacing: -0.01em;
    margin-bottom: 4px;
  }
  .premium-mockup .section-title .hanja {
    color: #B8965A; font-weight: 500;
    margin-left: 6px; font-size: 17px;
  }
  .premium-mockup .section-sub {
    font-size: 12px; color: #7F6B4E;
    margin-bottom: 18px;
  }
  .premium-mockup .section p {
    font-size: 14.5px; line-height: 1.85;
    color: #2a2520;
    margin-bottom: 14px;
    word-break: keep-all;
  }
  /* 강조 시스템 (2026-05) — 3단계 위계
   *  · <strong> = 가장 중요 (황금 볼드 + 황금 밑줄) — 핵심 키워드 (사주 글자, 격국, 용신)
   *  · <b>      = 적당히 중요 (검정 볼드) — 진단 단어
   *  · <u>      = 황금 밑줄 (강조 X 볼드 X)  — 부가 정보 표시
   */
  /* 2026-05-29 — 셀렉터를 .premium-mockup p 로 확장. 기존엔 .section/.section-body 안에서만 황금 형광펜이라,
     DaeunSection 등 일반 div 안의 본문 strong 은 밋밋한 기본 볼드였음. 모든 본문 강조 = 확실히 황금 형광펜. */
  .premium-mockup p strong,
  .premium-mockup .section p strong,
  .premium-mockup .section-body p strong {
    font-weight: 800;
    /* 2026-05-04 준기 결단: 본문 줄글 strong 색 가독성 보강 (#8C6D3D → #A37A2E)
     * + 다크박스 안 #f4d166 톤과 어울리도록 형광펜 더 진하게 (alpha 0.32 → 0.55) */
    color: #A37A2E;
    background: linear-gradient(180deg, transparent 60%, rgba(244,209,102,0.55) 60%);
    padding: 0 2px;
    border-radius: 1px;
    letter-spacing: 0.005em;
  }
  .premium-mockup p b,
  .premium-mockup .section p b,
  .premium-mockup .section-body p b {
    font-weight: 800;
    color: #1a1a1a;  /* 검정 볼드 — 진단 단어 */
    background: none;
    padding: 0;
  }
  .premium-mockup p u,
  .premium-mockup .section p u,
  .premium-mockup .section-body p u {
    text-decoration: underline;
    text-decoration-color: #B8965A;  /* 황금 밑줄 */
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
    color: inherit;
  }
  /* <em> = 주의·경고 (번트오렌지) — Daily/Topic 와 톤 통일. font-style normal (한글 가독). */
  .premium-mockup p em,
  .premium-mockup .section p em,
  .premium-mockup .section-body p em {
    font-style: normal;
    font-weight: 700;
    color: #B5441F;
    background: linear-gradient(180deg, transparent 56%, rgba(181,68,31,0.15) 56%);
    padding: 0 2px;
    border-radius: 2px;
  }
  /* 한자(漢字) 강조 변형 — 2026-05-04 가독성 보강: #5C4A2E → #8C6D3D */
  .premium-mockup .section p strong:has(span.han),
  .premium-mockup .section-body p strong:has(span.han) {
    color: #8C6D3D;
  }
  .premium-mockup .section p .han {
    font-family: 'Noto Serif KR', serif;
    color: #8C6D3D;
    font-size: 13px;
    margin: 0 1px;
  }/* ─── 1. 원국 (사주 8글자 카드) ───────────────────────── */

  
  .premium-mockup .wongug {
    background: linear-gradient(180deg, #fff 0%, #F4EFE4 100%);
    border-radius: 14px;
    padding: 20px 12px 18px;
    border: 1px solid #E5DFD0;
    margin: 16px 0 18px;
    box-shadow: 0 4px 12px rgba(0,0,0,.04);
  }
  .premium-mockup .wongug-table {
    display: grid;
    /* row-label 36px (좁힘) + 4 셀 균등 — 가운데 정렬 효과 */
    grid-template-columns: 36px repeat(4, 1fr);
    text-align: center;
    gap: 8px;
    width: 100%;
    max-width: 100%;
    justify-items: center;
    align-items: center;
  }
  .premium-mockup .wongug-table .row-label {
    font-size: 11px; color: #7F6B4E;
    align-self: center;
    justify-self: center;
    text-align: center;
    font-weight: 600;
    width: 100%;
  }
  .premium-mockup .wongug-table .col-header {
    font-size: 11px; color: #B8965A;
    padding: 4px 0;
    font-weight: 700; letter-spacing: 0.08em;
  }
  /* 4기둥 셀 — saju-card OHENG_BOX 스타일 (앱 전체 통일 SSOT, 2026-05) */
  .premium-mockup .wongug-cell {
    background: #fff;
    border: 1.5px solid #E5DFD0;
    border-radius: 10px;
    padding: 12px 4px 10px;
    position: relative;
    overflow: visible;  /* glyph 박스가 잘리지 않도록 */
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  /* 일주(나) 강조 — 골드 외곽 + 그라데이션 */
  .premium-mockup .wongug-cell.ilju {
    background: linear-gradient(180deg, rgba(184,150,90,0.18) 0%, rgba(184,150,90,0.08) 100%);
    border-color: #B8965A;
    border-width: 2px;
  }
  .premium-mockup .wongug-cell .glyph {
    font-family: 'Noto Serif KR', serif;
    /* 좁은 화면(< 390px) 에서 4셀 합이 뷰포트 초과 → 연주(우측) 짤림 fix.
       clamp(최소 48px, 동적 14vw, 최대 64px) — 시각 임팩트 유지하면서 폭 보장. */
    font-size: clamp(24px, 8vw, 32px);
    font-weight: 800;
    margin: 4px auto 8px;
    /* 박스 형태 — 진한 배경 + 흰 글씨 (saju-card OHENG_BOX 통일) */
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(48px, 14vw, 64px);
    height: clamp(48px, 14vw, 64px);
    border-radius: 10px;
    border: 1.5px solid;
    box-sizing: border-box;
    flex-shrink: 0;
  }
  /* 5 오행 박스 — 배경 색 + 흰 글씨 (금만 흰 배경 + 검은 글씨) */
  .premium-mockup .wongug-cell .glyph.mok {
    background: #4E7A57; color: #fff; border-color: #1B5E2C;
    text-shadow: 0 1px 2px rgba(0,0,0,0.15);
  }
  .premium-mockup .wongug-cell .glyph.hwa {
    background: #B04A38; color: #fff; border-color: #9B1B1B;
    text-shadow: 0 1px 2px rgba(0,0,0,0.15);
  }
  .premium-mockup .wongug-cell .glyph.to {
    background: #B07F38; color: #fff; border-color: #C9A030;
    text-shadow: 0 1px 2px rgba(0,0,0,0.15);
  }
  .premium-mockup .wongug-cell .glyph.geum {
    background: #FFFFFF; color: #1A1A1A; border-color: #9C9C9C;
  }
  .premium-mockup .wongug-cell .glyph.su {
    background: #1A1A1A; color: #fff; border-color: #3D3D3D;
  }
  .premium-mockup .wongug-cell .yum {
    font-size: 11px; color: #7F6B4E; margin-top: 6px; font-weight: 500;
  }/* ─── 오행 밸런스 차트 ─────────────────────────── */

  
  .premium-mockup .ohaeng-chart {
    margin-top: 14px;
    background: #F4EFE4;
    border-radius: 10px;
    padding: 14px 12px;
  }
  .premium-mockup .ohaeng-chart .title {
    font-size: 11px; color: #5C4A2E;
    margin-bottom: 8px; font-weight: 500;
  }
  .premium-mockup .ohaeng-bar {
    display: grid; grid-template-columns: 28px 1fr 30px;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 11px;
  }
  .premium-mockup .ohaeng-bar .o-label {
    font-family: 'Noto Serif KR', serif;
    font-size: 13px; font-weight: 600;
  }
  .premium-mockup .ohaeng-bar .o-track {
    background: #E5DFD0; height: 6px; border-radius: 100px; overflow: hidden;
  }
  .premium-mockup .ohaeng-bar .o-fill {
    height: 100%; border-radius: 100px;
    transition: width .8s ease;
  }
  .premium-mockup .ohaeng-bar .o-count {
    text-align: right; color: #7F6B4E; font-feature-settings: 'tnum';
  }
  /* 오행 5색 — 전통 명리학 컨벤션 + 시인성 ↑ 5색 모두 명확 구분 (2026-05-04 v2 색감 통일)
     · 木 짙은녹  · 火 적색  · 土 진한 황색  · 金 무채 차콜 (메탈릭 실버)  · 水 깊은 남색
     · 金/水 분리 핵심: 金 hue=0° (무채) · 水 hue=215° (남색) — 절대 겹치지 않음 */
  .premium-mockup .o-mok  .o-label { color: #4E7A57; } .premium-mockup .o-mok  .o-fill { background: linear-gradient(90deg, #4FAE6D, #4E7A57); }
  .premium-mockup .o-hwa  .o-label { color: #B04A38; } .premium-mockup .o-hwa  .o-fill { background: linear-gradient(90deg, #EF5350, #B04A38); }
  .premium-mockup .o-to   .o-label { color: #B07F38; } .premium-mockup .o-to   .o-fill { background: linear-gradient(90deg, #F9C849, #B07F38); }
  .premium-mockup .o-geum .o-label { color: #7D7870; } .premium-mockup .o-geum .o-fill { background: linear-gradient(90deg, #BDBDBD, #7D7870); }
  .premium-mockup .o-su   .o-label { color: #3E5F82; } .premium-mockup .o-su   .o-fill { background: linear-gradient(90deg, #2196F3, #3E5F82); }
  /* ─── 3. 십성 카드 그리드 ──────────────────────── */

  
  .premium-mockup .sipseong-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px; margin: 14px 0;
  }
  .premium-mockup .sip-card {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 10px;
    padding: 12px;
  }
  .premium-mockup .sip-card .top {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 4px;
  }
  .premium-mockup .sip-card .name {
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; font-weight: 600; color: #1a1a1a;
  }
  .premium-mockup .sip-card .han { font-family: 'Noto Serif KR', serif; color: #B8965A; font-size: 12px; }
  .premium-mockup .sip-card .desc { font-size: 11.5px; color: #5C4A2E; line-height: 1.6; }/* ─── 4. 대운 타임라인 ─────────────────────────── */

  
  .premium-mockup .daewoon-timeline {
    background: linear-gradient(135deg, #fff 0%, #F4EFE4 100%);
    border-radius: 14px;
    padding: 18px 14px;
    border: 1px solid #E5DFD0;
    margin: 14px 0;
    overflow-x: auto;
  }
  .premium-mockup .daewoon-row {
    display: grid; grid-template-columns: repeat(8, 70px);
    gap: 4px; min-width: 100%;
  }
  .premium-mockup .dw-cell {
    text-align: center;
    background: #F4EFE4;
    border-radius: 8px;
    padding: 8px 4px;
    border: 1px solid transparent;
    position: relative;
  }
  .premium-mockup .dw-cell.now {
    background: linear-gradient(180deg, rgba(212,175,55,.18) 0%, rgba(212,175,55,.08) 100%);
    border-color: #E8D9B8;
  }
  .premium-mockup .dw-cell .age { font-size: 11px; color: #7F6B4E; }
  .premium-mockup .dw-cell .gan { font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 700; margin-top: 4px; line-height: 1; }
  .premium-mockup .dw-cell .ji  { font-family: 'Noto Serif KR', serif; font-size: 13px; color: #5C4A2E; line-height: 1.2; }
  .premium-mockup .dw-cell .label { font-size: 11px; color: #B8965A; margin-top: 4px; font-weight: 600; letter-spacing: -0.02em; }/* ─── 5. 연운 라인 차트 (점수 추이) ───────────── */

  
  .premium-mockup .yeonun-chart {
    background: #fff;
    border-radius: 12px;
    padding: 16px 14px;
    border: 1px solid #E5DFD0;
    margin: 14px 0;
  }
  .premium-mockup .yeonun-chart .ttl {
    font-size: 11px; color: #5C4A2E; margin-bottom: 10px; font-weight: 500;
  }
  .premium-mockup .yeonun-svg { width: 100%; height: 120px; }/* ─── 6. 신살 카드 리스트 ────────────────────── */

  
  .premium-mockup .shinsal-list { display: flex; flex-direction: column; gap: 8px; margin: 14px 0; }
  /* 2026-05-28 — 균일 list 좌측 strip 제거 (AI 손톱 디자인). border-radius 통일. */
  .premium-mockup .shinsal-card {
    background: #fff;
    border: 1px solid rgba(184,150,90,0.15);
    border-radius: 10px;
    padding: 12px 14px;
    box-shadow: 0 2px 6px rgba(0,0,0,.03);
  }
  .premium-mockup .shinsal-card .head {
    display: flex; align-items: baseline; gap: 8px;
    margin-bottom: 6px;
  }
  .premium-mockup .shinsal-card .nm {
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; font-weight: 700; color: #1a1a1a;
  }
  .premium-mockup .shinsal-card .han { font-family: 'Noto Serif KR', serif; color: #B8965A; font-size: 12px; }
  .premium-mockup .shinsal-card .tag {
    margin-left: auto;
    background: rgba(184,150,90,.1); color: #B8965A;
    font-size: 11px; padding: 2px 8px; border-radius: 100px; font-weight: 600;
  }
  .premium-mockup .shinsal-card p { font-size: 12.5px; color: #2a2520; line-height: 1.7; margin: 0; }/* ─── 7. 실천 액션 카드 ─────────────────────── */

  
  .premium-mockup .action-list { display: flex; flex-direction: column; gap: 10px; margin: 14px 0; }
  .premium-mockup .action-card {
    background: linear-gradient(135deg, #fff 0%, #F4EFE4 100%);
    border-radius: 12px;
    padding: 14px 16px;
    border: 1px solid #E5DFD0;
    display: flex; gap: 12px; align-items: flex-start;
  }
  .premium-mockup .action-card .num {
    width: 28px; height: 28px;
    background: linear-gradient(135deg, #E8D9B8, #B8965A);
    color: #1a1a1a;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; font-weight: 700;
    flex-shrink: 0;
  }
  .premium-mockup .action-card .body { flex: 1; }
  .premium-mockup .action-card .body .ttl { font-weight: 600; font-size: 14px; color: #1a1a1a; margin-bottom: 4px; }
  .premium-mockup .action-card .body .desc { font-size: 12.5px; color: #5C4A2E; line-height: 1.65; }/* ─── Pull-quote (인용 강조 박스) ──────────────── */

  
  /* 2026-05-28 — 좌측 strip 제거. 그라데이션 + 큰 따옴표(::before)로 인용 표현. */
  .premium-mockup .pullquote {
    background: linear-gradient(135deg, rgba(78,122,87,.05) 0%, rgba(212,175,55,.06) 100%);
    border-radius: 12px;
    padding: 26px 20px 18px;
    margin: 18px 0;
    position: relative;
  }
  .premium-mockup .pullquote::before {
    content: '"';
    position: absolute;
    top: -14px; left: 14px;
    font-family: 'Noto Serif KR', serif;
    font-size: 60px; color: rgba(78,122,87,.2);
    line-height: 1;
  }
  .premium-mockup .pullquote p {
    font-family: 'Noto Serif KR', serif !important;
    font-size: 15px !important;
    line-height: 1.75 !important;
    color: #1a1a1a !important;
    margin: 0 !important;
    font-weight: 500;
  }/* ─── Divider ──────────────────────────────── */

  
  .premium-mockup .divider {
    display: flex; align-items: center;
    margin: 28px 0;
    color: #B8965A;
    gap: 12px;
  }
  .premium-mockup .divider::before,
  .premium-mockup .divider::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, #E8D9B8, transparent);
  }
  .premium-mockup .divider .han {
    font-family: 'Noto Serif KR', serif;
    font-size: 16px; font-weight: 500;
  }/* ─── Upsell 카드 (사주대화 / 관련 주제) ──────── */

  
  .premium-mockup .upsell-card {
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2520 100%);
    color: #fff;
    border-radius: 14px;
    padding: 22px 20px;
    margin: 32px 0 20px;
    position: relative;
    overflow: hidden;
  }
  .premium-mockup .upsell-card::before {
    display: none;
    content: '對';
    position: absolute;
    right: -10px; bottom: -30px;
    font-family: 'Noto Serif KR', serif;
    font-size: 140px; font-weight: 900;
    color: rgba(212,175,55,.08);
    line-height: 1;
  }
  .premium-mockup .upsell-card .label {
    font-size: 11px; color: #E8D9B8;
    letter-spacing: 0.15em; font-weight: 600;
    margin-bottom: 8px;
  }
  .premium-mockup .upsell-card h3 {
    font-family: 'Noto Serif KR', serif;
    font-size: 17px; font-weight: 700;
    margin-bottom: 6px;
    position: relative;
  }
  .premium-mockup .upsell-card p {
    font-size: 12.5px; color: #c4baa0;
    margin-bottom: 14px; line-height: 1.6;
    position: relative;
  }
  .premium-mockup .upsell-card .cta {
    display: inline-flex; align-items: center; gap: 6px;
    background: linear-gradient(135deg, #E8D9B8, #B8965A);
    color: #1a1a1a;
    padding: 10px 18px; border-radius: 100px;
    font-size: 13px; font-weight: 700;
    cursor: pointer; position: relative;
  }/* ─── Footer (공유 + PDF) — 다른 결과 페이지 .actions 와 통일 ─── */

  
  .premium-mockup .result-footer {
    margin-top: 22px;
    padding: 18px 0 0;
    border-top: 1px solid #E5DFD0;
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  }
  .premium-mockup .result-footer .btn {
    background: #fff; border: 1px solid #E5DFD0; border-radius: 12px;
    padding: 14px 8px;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: #1a1a1a; cursor: pointer; transition: .2s;
    text-align: center;
  }
  .premium-mockup .result-footer .btn:hover { border-color: #B8965A; }
  .premium-mockup .result-footer .btn svg { width: 22px; height: 22px; color: #B8965A; }
  .premium-mockup .result-footer .btn .ti { font-size: 12.5px; font-weight: 600; }
  .premium-mockup .result-footer .btn .sb { font-size: 11px; color: #7F6B4E; }/* ─── 리포트의 지식 기반 (fine print, 찾아 읽는 사람만) ─── */

  
  .premium-mockup .report-sources {
    margin: 28px 2px 0;
    padding: 12px 0 0;
    border-top: 1px solid rgba(138,125,95,.16);
    font-size: 11px;
    line-height: 1.72;
    color: #a89c7f;
    letter-spacing: 0.005em;
    word-break: keep-all;
  }
  .premium-mockup .report-sources p { margin: 0; }
  .premium-mockup .report-sources p + p { margin-top: 8px; }
  .premium-mockup .report-sources .notice-line { color: #9A8B70; font-style: italic; }
  .premium-mockup .report-sources .book {
    font-family: 'Noto Serif KR', serif;
    color: #7F6B4E;
  }/* ─── 섹션 결론 박스 (다크) ──────────────── *//* \`.section p { color:#2a2520 }\` 가 dark BG에서 본문을 먹는 버그 → 클래스로 강제 */

  
  
  .premium-mockup .section-conclusion {
    position: relative;
    margin-top: 22px;
    padding: 22px 22px 22px 24px;
    background:
      radial-gradient(circle at top right, rgba(244,209,102,0.10) 0%, transparent 55%),
      linear-gradient(135deg, #161310 0%, #2a2520 55%, #1d1812 100%);
    border-radius: 14px;
    border: 1.5px solid rgba(212,175,55,.32);
    color: #F0E8D9;
    box-shadow:
      0 8px 28px rgba(20,15,8,0.22),
      inset 0 1px 0 rgba(244,209,102,0.10);
    overflow: hidden;
  }
  /* 2026-05-28 — 좌측 골드 strip 제거 (균일 결론박스마다 동일 strip = AI 손톱 디자인 티).
     ::after 한자 인장만으로 결론박스 톤 충분히 표현. */
  /* 우상단 한자 인장 */
  .premium-mockup .section-conclusion::after {
    content: '結';
    position: absolute;
    top: 14px; right: 18px;
    font-family: 'Noto Serif KR', serif;
    font-size: 28px;
    font-weight: 900;
    color: rgba(244,209,102,0.14);
    letter-spacing: 0;
    line-height: 1;
    pointer-events: none;
  }
  .premium-mockup .section-conclusion .sc-label {
    position: relative;
    display: inline-block;
    font-family: 'Noto Serif KR', serif;
    font-size: 11px;
    color: #f4d166;
    letter-spacing: 0.16em;
    font-weight: 800;
    margin-bottom: 14px;
    padding: 4px 10px 4px 0;
    border-bottom: 1px solid rgba(244,209,102,.32);
    text-transform: uppercase;
  }
  .premium-mockup .section-conclusion .sc-label::before {
    content: '◇  ';
    color: #f4d166;
    opacity: 0.7;
    font-size: 11px;
    margin-right: 4px;
  }
  .premium-mockup .section-conclusion p,
  .premium-mockup .section-conclusion .sc-row {
    color: #F4ECD8 !important;
    font-size: 13.5px;
    line-height: 1.85;
    margin: 0 0 12px;
    font-weight: 400;
    word-break: keep-all;
    letter-spacing: 0.005em;
  }
  .premium-mockup .section-conclusion p:last-child,
  .premium-mockup .section-conclusion .sc-row:last-child { margin-bottom: 0; }
  .premium-mockup .section-conclusion strong {
    color: #f4d166 !important;
    background: linear-gradient(180deg, transparent 65%, rgba(244,209,102,0.18) 65%) !important;
    font-weight: 800 !important;
    padding: 0 2px;
    border-radius: 2px;
    letter-spacing: 0.01em;
  }
  .premium-mockup .section-conclusion em {
    color: #E8D9B8;
    font-style: normal;
    font-weight: 500;
    border-bottom: 1px dotted rgba(232,217,184,0.45);
    padding-bottom: 1px;
  }
  .premium-mockup .section-conclusion .sc-num {
    display: inline-block;
    color: #f4d166;
    font-family: 'Noto Serif KR', serif;
    font-weight: 800;
    margin-right: 6px;
    font-size: 14px;
  }
  /* 결론 박스 마지막 한 줄 — 인용·도장 */
  .premium-mockup .section-conclusion .sc-stamp {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px dashed rgba(244,209,102,0.18);
    font-family: 'Noto Serif KR', serif;
    font-size: 11px;
    color: rgba(244,209,102,0.62);
    letter-spacing: 0.08em;
    text-align: right;
  }/* ─── 분량 & 메타 표시 (디버그용) ──────────── */

  
  .premium-mockup .word-count {
    text-align: center;
    font-size: 11px;
    color: #7F6B4E;
    margin: 24px 0 12px;
    letter-spacing: 0.05em;
  }
  .premium-mockup .word-count .han { font-family: 'Noto Serif KR', serif; color: #B8965A; }/* ─── 좌측 인디케이터 (현 위치 섹션) ────────── */

  
  .premium-mockup .toc-side {
    position: fixed;
    left: max(8px, calc(50% - 270px));
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    display: flex; flex-direction: column; gap: 4px;
  }
  .premium-mockup .toc-side .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #E8D9B8; opacity: .25;
  }
  .premium-mockup .toc-side .dot.active { opacity: 1; transform: scale(1.5); transition: .3s; }
  @media (max-width: 540px) { .premium-mockup .toc-side { display: none; } }/* ═══════════════ V2 추가 스타일 ═══════════════ *//* 원국 셀 위 십성 뱃지 */

  

  
  .premium-mockup .wongug-cell .sip-tag {
    position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 100px;
    padding: 1px 7px;
    font-size: 11px; color: #7F6B4E;
    font-weight: 600; letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .premium-mockup .wongug-cell.ilju .sip-tag {
    background: linear-gradient(135deg, #E8D9B8, #B8965A);
    color: #1a1a1a; border-color: transparent;
  }
  /* 음양 균형 도식 */

  
  .premium-mockup .yin-yang-card {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 12px;
    padding: 14px 14px 10px;
    margin: 12px 0;
  }
  .premium-mockup .yy-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 10px; font-weight: 500;
  }
  .premium-mockup .yy-bar {
    display: flex; height: 24px; border-radius: 6px; overflow: hidden;
    border: 1px solid #E5DFD0; font-size: 11px; font-weight: 600;
  }
  .premium-mockup .yy-bar .yang {
    background: linear-gradient(90deg, #c62828, #e57373);
    color: #fff; display: flex; align-items: center; justify-content: center;
  }
  .premium-mockup .yy-bar .yin {
    background: linear-gradient(90deg, #37474f, #546e7a);
    color: #fff; display: flex; align-items: center; justify-content: center;
  }
  .premium-mockup .yy-caption { font-size: 11px; color: #5C4A2E; margin-top: 6px; line-height: 1.55; }/* 오행 강·약 진단 도식 */

  
  .premium-mockup .ohaeng-diag {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 6px; margin-top: 12px;
  }
  .premium-mockup .ohaeng-diag .od-cell {
    border-radius: 10px;
    padding: 10px 4px 8px;
    text-align: center;
    border: 1px solid #E5DFD0;
    position: relative;
  }
  .premium-mockup .ohaeng-diag .od-cell.strong { border-color: #4E7A57; background: rgba(78,122,87,.05); }
  .premium-mockup .ohaeng-diag .od-cell.weak   { border-color: #c62828; background: rgba(198,40,40,.04); }
  .premium-mockup .ohaeng-diag .od-han {
    font-family: 'Noto Serif KR', serif;
    font-size: 20px; font-weight: 700;
    line-height: 1;
  }
  .premium-mockup .ohaeng-diag .od-han.mok  { color: #4E7A57; }
  .premium-mockup .ohaeng-diag .od-han.hwa  { color: #B04A38; }
  .premium-mockup .ohaeng-diag .od-han.to   { color: #B07F38; }
  .premium-mockup .ohaeng-diag .od-han.geum { color: #7D7870; }
  .premium-mockup .ohaeng-diag .od-han.su   { color: #3E5F82; }
  .premium-mockup .ohaeng-diag .od-dots {
    margin-top: 6px; display: flex; justify-content: center; gap: 2px;
  }
  .premium-mockup .ohaeng-diag .od-dots span {
    width: 5px; height: 5px; border-radius: 50%;
    background: #E5DFD0;
  }
  .premium-mockup .ohaeng-diag .od-dots span.on { background: #B8965A; }
  .premium-mockup .ohaeng-diag .od-label {
    font-size: 11px; color: #7F6B4E; margin-top: 4px;
    font-weight: 600; letter-spacing: 0.05em;
  }
  .premium-mockup .ohaeng-diag .od-label.s { color: #4E7A57; }
  .premium-mockup .ohaeng-diag .od-label.w { color: #c62828; }/* 천간-지지 합·충 도식 */

  
  .premium-mockup .ganji-flow {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 12px;
    padding: 14px;
    margin: 12px 0;
  }
  .premium-mockup .ganji-flow .gf-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 10px; font-weight: 500;
  }
  .premium-mockup .ganji-flow .gf-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 0;
    border-top: 1px dashed #E5DFD0;
    font-size: 12px; color: #2a2520;
  }
  .premium-mockup .ganji-flow .gf-row:first-of-type { border-top: 0; }
  .premium-mockup .ganji-flow .gf-glyph {
    font-family: 'Noto Serif KR', serif;
    font-size: 15px; font-weight: 700;
  }
  .premium-mockup .ganji-flow .gf-arrow { color: #B8965A; font-size: 11px; }
  .premium-mockup .ganji-flow .gf-type {
    margin-left: auto; padding: 2px 8px; border-radius: 100px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
  }
  .premium-mockup .ganji-flow .gf-type.hap   { background: rgba(78,122,87,.1);  color: #4E7A57; }
  .premium-mockup .ganji-flow .gf-type.chung { background: rgba(198,40,40,.1);  color: #c62828; }
  .premium-mockup .ganji-flow .gf-type.hyeong{ background: rgba(184,150,90,.12); color: #B8965A; }/* 십성 카드 강도 막대 */

  
  .premium-mockup .sip-card .strength {
    display: flex; gap: 3px; margin-top: 8px;
  }
  .premium-mockup .sip-card .strength span {
    flex: 1; height: 4px; border-radius: 2px;
    background: #E5DFD0;
  }
  .premium-mockup .sip-card .strength span.on { background: #B8965A; }
  .premium-mockup .sip-card .s-label {
    font-size: 11px; color: #7F6B4E;
    margin-top: 4px; letter-spacing: 0.05em;
  }/* 대운 점수 막대 (60년) */

  
  .premium-mockup .daewoon-scores {
    margin-top: 14px;
    background: #F4EFE4;
    border-radius: 10px;
    padding: 14px 12px 10px;
    border: 1px solid #E5DFD0;
  }
  .premium-mockup .daewoon-scores .ds-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 10px; font-weight: 500;
  }
  .premium-mockup .daewoon-scores .ds-row {
    display: grid;
    grid-template-columns: 58px 1fr 32px;
    align-items: center; gap: 8px;
    margin-bottom: 5px;
    font-size: 11px;
  }
  .premium-mockup .daewoon-scores .ds-age { color: #7F6B4E; letter-spacing: 0.03em; }
  .premium-mockup .daewoon-scores .ds-track { background: #E5DFD0; height: 8px; border-radius: 100px; position: relative; }
  .premium-mockup .daewoon-scores .ds-fill {
    height: 100%; border-radius: 100px;
    background: linear-gradient(90deg, #E8D9B8, #B8965A);
  }
  .premium-mockup .daewoon-scores .ds-fill.peak { background: linear-gradient(90deg, #4E7A57, #4caf50); }
  .premium-mockup .daewoon-scores .ds-fill.now  {
    background: linear-gradient(90deg, #B8965A, #E8D9B8);
    box-shadow: 0 0 0 1px rgba(212,175,55,.4);
  }
  .premium-mockup .daewoon-scores .ds-score { text-align: right; color: #1a1a1a; font-weight: 600; }
  .premium-mockup .daewoon-scores .ds-caption {
    margin-top: 8px; font-size: 11px; color: #7F6B4E;
    padding-top: 8px; border-top: 1px dashed #E5DFD0; line-height: 1.6;
  }/* 신살 × 행동 카드 (v2 확장) */

  
  .premium-mockup .shinsal-card .adv {
    margin-top: 8px; padding-top: 8px;
    border-top: 1px dashed #E5DFD0;
    display: flex; gap: 6px; align-items: flex-start;
  }
  .premium-mockup .shinsal-card .adv .adv-icon {
    flex-shrink: 0; width: 18px; height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, #E8D9B8, #B8965A);
    color: #1a1a1a;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
  }
  .premium-mockup .shinsal-card .adv .adv-text {
    font-size: 11.5px; color: #2a2520; line-height: 1.55;
  }/* 주제별 미니 카드 그리드 */

  
  .premium-mockup .topic-mini-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 10px; margin: 14px 0;
    align-items: stretch;
    /* 카드 외곽 border + box-shadow 가 grid edge 에 잘리지 않도록 padding 확보 */
    padding: 2px;
  }
  .premium-mockup .topic-mini {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #E5DFD0;
    padding: 14px 13px 12px;
    display: flex; flex-direction: column; gap: 7px;
    position: relative;
    overflow: hidden;
    height: 100%;
    min-height: 220px;  /* hook 영역 추가로 높이 확장 */
    min-width: 0;  /* grid item 이 콘텐츠 width 로 밀려서 잘리는 것 방지 */
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-sizing: border-box;
  }
  .premium-mockup .topic-mini:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(20,15,8,0.10);
  }
  .premium-mockup .topic-mini .tm-head {
    display: flex; align-items: center; justify-content: space-between;
    min-height: 22px;
  }
  .premium-mockup .topic-mini .tm-ttl {
    font-family: 'Noto Serif KR', serif;
    font-size: 13px; font-weight: 700; color: #1a1a1a;
    display: inline-flex; align-items: center; gap: 5px;
    line-height: 1.3;
  }
  .premium-mockup .topic-mini .tm-score {
    font-family: 'Noto Serif KR', serif;
    font-size: 18px; font-weight: 800; color: #B8965A;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .premium-mockup .topic-mini .tm-bar {
    height: 6px; background: #F0EAD9; border-radius: 100px;
    overflow: hidden;
  }
  .premium-mockup .topic-mini .tm-fill {
    height: 100%; border-radius: 100px;
    background: linear-gradient(90deg, #E8D9B8, #B8965A);
    transition: width 0.4s ease;
  }
  .premium-mockup .topic-mini .tm-desc {
    font-size: 11.5px; color: #5C4A2E; line-height: 1.6;
    word-break: keep-all;
    margin-bottom: 4px;
  }
  /* 호기심 hook — "1운으로 보면 ◇◇·◇◇" CTA 유도 */
  /* 2026-05-28 — 좌측 strip 제거 (균일 list 안 AI 디자인 티). */
  .premium-mockup .topic-mini .tm-hook {
    flex: 1;
    margin-top: 2px;
    padding: 7px 9px;
    background: rgba(184,150,90,0.06);
    border-radius: 6px;
    font-size: 11px;
    color: #5C4A2E;
    line-height: 1.5;
    word-break: keep-all;
    font-weight: 600;
  }
  .premium-mockup .topic-mini .tm-hook .tm-hook-label {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    color: #B8965A;
    background: #fff;
    padding: 1px 6px;
    border-radius: 3px;
    letter-spacing: 0.06em;
    margin-right: 5px;
    margin-bottom: 2px;
    border: 1px solid rgba(184,150,90,0.28);
    line-height: 1.5;
  }
  /* peak 카드는 그린 톤 hook */
  .premium-mockup .topic-mini[style*="rgb(46, 125, 50)"] .tm-hook,
  .premium-mockup .topic-mini[style*="#4E7A57"] .tm-hook {
    background: rgba(78,122,87,0.06);
    border-left-color: rgba(78,122,87,0.42);
    color: #355A3E;
  }
  .premium-mockup .topic-mini[style*="rgb(46, 125, 50)"] .tm-hook .tm-hook-label,
  .premium-mockup .topic-mini[style*="#4E7A57"] .tm-hook .tm-hook-label {
    color: #4E7A57;
    border-color: rgba(78,122,87,0.32);
  }
  /* low 카드는 레드 톤 hook */
  .premium-mockup .topic-mini[style*="rgb(198, 40, 40)"] .tm-hook,
  .premium-mockup .topic-mini[style*="#c62828"] .tm-hook {
    background: rgba(198,40,40,0.05);
    border-left-color: rgba(198,40,40,0.42);
    color: #8b1a1a;
  }
  .premium-mockup .topic-mini[style*="rgb(198, 40, 40)"] .tm-hook .tm-hook-label,
  .premium-mockup .topic-mini[style*="#c62828"] .tm-hook .tm-hook-label {
    color: #c62828;
    border-color: rgba(198,40,40,0.32);
  }
  .premium-mockup .topic-mini .tm-link {
    margin-top: auto;
    padding-top: 6px;
    border-top: 1px dashed #E5DFD0;
    font-size: 11px; color: #B8965A;
    font-weight: 700;
    display: flex; align-items: center; justify-content: space-between;
    gap: 6px;
    letter-spacing: 0.02em;
    line-height: 1.5;
  }
  .premium-mockup .topic-mini .tm-link::after {
    content: '→';
    font-size: 13px;
    font-weight: 800;
    color: inherit;
    transition: transform 0.15s ease;
  }
  .premium-mockup .topic-mini:hover .tm-link::after {
    transform: translateX(2px);
  }
  .premium-mockup .topic-mini.full {
    grid-column: span 2;
    min-height: 132px;
    background: linear-gradient(135deg, rgba(212,175,55,.08), rgba(78,122,87,.04));
  }/* 아코디언 토글 — 헤더 전체가 클릭 영역 (60대+ 사용성) */

  
  .premium-mockup .section-head-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    cursor: pointer;
    padding: 8px 4px;
    margin: 0 -4px;
    border-radius: 8px;
    user-select: none;
    -webkit-tap-highlight-color: rgba(212,175,55,.18);
    transition: background .15s ease;
  }
  .premium-mockup .section-head-row:active {
    background: rgba(212,175,55,.06);
  }
  .premium-mockup .section-head-row .section-num,
  .premium-mockup .section-head-row .section-title,
  .premium-mockup .section-head-row .section-sub {
    margin-bottom: 2px;
  }
  .premium-mockup .sec-toggle {/* 헤더 row에 클릭 위임 */
    flex-shrink: 0;
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(212,175,55,.10);
    border: 1px solid rgba(212,175,55,.32);
    border-radius: 100px;
    color: #8a6e1f; font-size: 12px; font-weight: 600;
    padding: 8px 14px; letter-spacing: 0.04em;
    pointer-events: none; 
    min-width: 76px; justify-content: center;
  }
  .premium-mockup .sec-toggle .chev {
    display: inline-block; transition: transform .25s ease;
    font-size: 11px; line-height: 1;
  }
  .premium-mockup .sec-toggle.collapsed .chev { transform: rotate(-90deg); }
  .premium-mockup .section-body {
    overflow: hidden;
    transition: max-height .4s ease, opacity .3s ease;
    max-height: 10000px;
  }
  .premium-mockup .section-body.collapsed {
    max-height: 0; opacity: 0;
  }/* 관계(인연) 도식 */

  
  .premium-mockup .relation-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 8px; margin-top: 12px;
  }
  .premium-mockup .rel-card {
    background: #fff; border-radius: 10px; padding: 10px 8px;
    border: 1px solid #E5DFD0; text-align: center;
  }
  .premium-mockup .rel-card .rc-label { font-size: 11px; color: #7F6B4E; letter-spacing: 0.06em; font-weight: 600; }
  .premium-mockup .rel-card .rc-glyph {
    font-family: 'Noto Serif KR', serif;
    font-size: 18px; font-weight: 700; margin: 4px 0;
  }
  .premium-mockup .rel-card .rc-desc { font-size: 11px; color: #2a2520; line-height: 1.5; }
  .premium-mockup .rel-card.boost .rc-glyph { color: #4E7A57; }
  .premium-mockup .rel-card.clash .rc-glyph { color: #c62828; }
  .premium-mockup .rel-card.calm  .rc-glyph { color: #3E5F82; }/* 관계의 결 (六親) — 6카드 상세 */

  
  /* 2026-05-28 — 6카드 균일 좌측 strip 제거 (AI 손톱 디자인 티). 톤은 rel6-name(::after dot) 으로 표현. */
  .premium-mockup .rel6-list { display: flex; flex-direction: column; gap: 12px; margin: 14px 0; }
  .premium-mockup .rel6-card {
    background: #fff; border: 1px solid #E5DFD0;
    border-radius: 10px; padding: 14px 14px 12px;
    position: relative;
  }
  .premium-mockup .rel6-card::before {
    content: ''; position: absolute; top: 14px; right: 14px;
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--rel6-dot, #7F6B4E);
  }
  .premium-mockup .rel6-card.c-parent  { --rel6-dot: #3E5F82; }
  .premium-mockup .rel6-card.c-sibling { --rel6-dot: #4E7A57; }
  .premium-mockup .rel6-card.c-spouse  { --rel6-dot: #c62828; }
  .premium-mockup .rel6-card.c-child   { --rel6-dot: #7F6B4E; }
  .premium-mockup .rel6-card.c-friend  { --rel6-dot: #7D7870; }
  .premium-mockup .rel6-card.c-boss    { --rel6-dot: #5C4A2E; }

  .premium-mockup .rel6-head {
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  }
  .premium-mockup .rel6-name {
    font-family: 'Noto Serif KR', serif;
    font-size: 19px; font-weight: 700;
  }
  .premium-mockup .rel6-card.c-parent  .rel6-name { color: #3E5F82; }
  .premium-mockup .rel6-card.c-sibling .rel6-name { color: #4E7A57; }
  .premium-mockup .rel6-card.c-spouse  .rel6-name { color: #c62828; }
  .premium-mockup .rel6-card.c-child   .rel6-name { color: #7F6B4E; }
  .premium-mockup .rel6-card.c-friend  .rel6-name { color: #7D7870; }
  .premium-mockup .rel6-card.c-boss    .rel6-name { color: #5C4A2E; }
  .premium-mockup .rel6-label {
    font-size: 13px; color: #1a1a1a; font-weight: 600;
  }
  .premium-mockup .rel6-tag {
    margin-left: auto;
    font-size: 11px; padding: 3px 10px;
    border-radius: 100px; font-weight: 600;
    letter-spacing: 0.02em;
  }
  .premium-mockup .rel6-tag.t-warn  { background: rgba(198,40,40,.10); color: #c62828; }
  .premium-mockup .rel6-tag.t-neut  { background: rgba(212,175,55,.16); color: #B8965A; }
  .premium-mockup .rel6-tag.t-good  { background: rgba(78,122,87,.12); color: #4E7A57; }

  .premium-mockup .rel6-summary {
    margin: 0 0 8px;
    font-size: 13.5px; color: #2a2520;
    line-height: 1.72; word-break: keep-all;
  }
  .premium-mockup .rel6-summary strong {
    font-weight: 700; color: #1a1a1a;
    background: linear-gradient(180deg, transparent 62%, rgba(212,175,55,.28) 62%);
    padding: 0 2px;
  }
  /* 왜 이런 결인가 — 메커니즘 한 줄 */
  /* 2026-05-28 — 좌측 strip 제거. 배경 그라데이션만으로 callout 표현. */
  .premium-mockup .rel6-why {
    display: flex; align-items: flex-start; gap: 8px;
    margin: 0 0 10px;
    padding: 8px 10px;
    background: linear-gradient(180deg, #FAF6EC 0%, #F4ECD8 100%);
    border-radius: 6px;
    font-size: 11.5px;
    color: #5C4A2E;
    line-height: 1.6;
    word-break: keep-all;
  }
  .premium-mockup .rel6-why-label {
    flex-shrink: 0;
    display: inline-block;
    font-family: 'Noto Serif KR', serif;
    font-size: 11px; font-weight: 800;
    color: #B8965A;
    background: #fff;
    padding: 1px 6px;
    border-radius: 3px;
    letter-spacing: 0.06em;
    line-height: 1.5;
    border: 1px solid rgba(184,150,90,0.32);
  }

  .premium-mockup .rel6-actions {
    display: flex; flex-direction: column; gap: 7px;
    margin-top: 12px;
    border-top: 1px dashed #E5DFD0;
    padding-top: 12px;
  }
  .premium-mockup .rel6-do,
  .premium-mockup .rel6-dont {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border-radius: 8px;
    font-size: 12.5px; line-height: 1.62;
    color: #2a2520;
    word-break: keep-all;
  }
  /* 2026-05-28 — do/dont 좌측 strip 제거. 배경 그라데이션 + 라벨 컬러로 톤 표현. */
  .premium-mockup .rel6-do  {
    background: linear-gradient(135deg, rgba(78,122,87,.10) 0%, rgba(78,122,87,.02) 100%);
  }
  .premium-mockup .rel6-dont{
    background: linear-gradient(135deg, rgba(198,40,40,.09) 0%, rgba(198,40,40,.02) 100%);
  }
  .premium-mockup .rel6-do .ic,
  .premium-mockup .rel6-dont .ic {
    flex-shrink: 0;
    font-family: 'Noto Serif KR', serif;
    font-weight: 800;
    font-size: 11px; letter-spacing: 0.06em;
    padding: 2px 8px;
    border-radius: 4px;
    line-height: 1.5;
  }
  .premium-mockup .rel6-do   .ic {
    color: #fff;
    background: linear-gradient(135deg, #4caf50, #4E7A57);
  }
  .premium-mockup .rel6-dont .ic {
    color: #fff;
    background: linear-gradient(135deg, #ef5350, #c62828);
  }
  .premium-mockup .rel6-do   .txt,
  .premium-mockup .rel6-dont .txt {
    flex: 1;
  }
  .premium-mockup .rel6-do   .txt strong,
  .premium-mockup .rel6-dont .txt strong {
    font-weight: 700; color: #1a1a1a;
    background: none; padding: 0;
  }
  .premium-mockup .rel6-do   .txt strong { color: #355A3E; }
  .premium-mockup .rel6-dont .txt strong { color: #8b1a1a; }/* 10년 대운 카드 (현재 시기만 크게) */

  
  .premium-mockup .now-daewoon {
    background: linear-gradient(135deg, rgba(212,175,55,.1), rgba(78,122,87,.04));
    border: 1px solid rgba(212,175,55,.35);
    border-radius: 12px;
    padding: 14px 14px 12px;
    margin: 12px 0 14px;
  }
  .premium-mockup .now-daewoon .nd-head {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 10px;
  }
  .premium-mockup .now-daewoon .nd-glyph {
    font-family: 'Noto Serif KR', serif;
    display: flex; flex-direction: column; align-items: center;
    padding: 8px 12px; border-radius: 10px;
    background: #fff; border: 1px solid rgba(212,175,55,.4);
    line-height: 1.1;
  }
  .premium-mockup .now-daewoon .nd-glyph .g-gan { font-size: 20px; font-weight: 700; color: #4E7A57; }
  .premium-mockup .now-daewoon .nd-glyph .g-ji  { font-size: 14px; color: #7D7870; }
  .premium-mockup .now-daewoon .nd-info .nd-age { font-size: 11px; color: #B8965A; font-weight: 600; letter-spacing: 0.08em; }
  .premium-mockup .now-daewoon .nd-info .nd-key { font-size: 14px; font-weight: 700; color: #1a1a1a; margin-top: 2px; font-family: 'Noto Serif KR', serif; }
  .premium-mockup .now-daewoon .nd-row {
    display: grid; grid-template-columns: 70px 1fr;
    gap: 6px; font-size: 11.5px; padding: 4px 0;
    border-top: 1px dashed rgba(212,175,55,.3);
    color: #2a2520; line-height: 1.55;
  }
  .premium-mockup .now-daewoon .nd-row .nd-label {
    color: #7F6B4E; font-weight: 500;
  }/* ═══════════════ V2.1 추가 ═══════════════ *//* 오행 레이더 차트 */

  

  
  .premium-mockup .ohaeng-radar {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 12px;
    padding: 14px 12px 10px;
    margin: 12px 0;
    text-align: center;
  }
  .premium-mockup .ohaeng-radar .or-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 4px; font-weight: 500; text-align: left;
  }
  .premium-mockup .ohaeng-radar svg { width: 100%; max-width: 260px; height: 240px; display: block; margin: 0 auto; }/* 오행별 인생의 결 카드 */

  
  .premium-mockup .life-edge-list {
    display: flex; flex-direction: column;
    gap: 10px; margin: 14px 0;
  }
  /* 2026-05-28 — 5카드 균일 좌측 strip 제거 (AI 손톱 디자인 티). 배경 그라데이션 + le-glyph 컬러로 톤 표현. */
  .premium-mockup .life-edge-card {
    border-radius: 12px;
    padding: 14px;
    border: 1px solid rgba(0,0,0,0.04);
    background: linear-gradient(135deg, #fff 0%, #F4EFE4 100%);
  }
  .premium-mockup .life-edge-card.mok  { background: linear-gradient(135deg, #fff, rgba(78,122,87,.06)); }
  .premium-mockup .life-edge-card.hwa  { background: linear-gradient(135deg, #fff, rgba(198,40,40,.06)); }
  .premium-mockup .life-edge-card.to   { background: linear-gradient(135deg, #fff, rgba(176,127,56,.08)); }
  .premium-mockup .life-edge-card.geum { background: linear-gradient(135deg, #fff, rgba(74,74,74,.06)); }
  .premium-mockup .life-edge-card.su   { background: linear-gradient(135deg, #fff, rgba(62,95,130,.07)); }
  .premium-mockup .life-edge-card .le-head {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 6px;
  }
  .premium-mockup .life-edge-card .le-glyph {
    font-family: 'Noto Serif KR', serif;
    font-size: 22px; font-weight: 700; line-height: 1;
  }
  .premium-mockup .life-edge-card.mok .le-glyph  { color: #4E7A57; }
  .premium-mockup .life-edge-card.hwa .le-glyph  { color: #B04A38; }
  .premium-mockup .life-edge-card.to  .le-glyph  { color: #B07F38; }
  .premium-mockup .life-edge-card.geum .le-glyph { color: #7D7870; }
  .premium-mockup .life-edge-card.su  .le-glyph  { color: #3E5F82; }
  .premium-mockup .life-edge-card .le-name {
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; font-weight: 700; color: #1a1a1a;
  }
  .premium-mockup .life-edge-card .le-tag {
    margin-left: auto; font-size: 11px;
    padding: 2px 8px; border-radius: 100px;
    background: #E5DFD0; color: #5C4A2E; font-weight: 600;
  }
  .premium-mockup .life-edge-card .le-tag.s { background: rgba(78,122,87,.12); color: #4E7A57; }
  .premium-mockup .life-edge-card .le-tag.w { background: rgba(198,40,40,.10); color: #c62828; }
  .premium-mockup .life-edge-card .le-desc {
    font-size: 12.5px; color: #2a2520; line-height: 1.65;
  }/* 십성 분류 헤더 */

  
  .premium-mockup .sip-cluster {
    margin-top: 12px;
  }
  /* 2026-05-28 — sub-header 좌측 strip 제거. 컬러 텍스트만으로 라벨 표현. */
  .premium-mockup .sip-cluster-head {
    font-size: 11px; color: #B8965A;
    letter-spacing: 0.1em; font-weight: 700;
    margin: 12px 0 6px;
  }/* 십성 분포 도넛 */

  
  .premium-mockup .sip-donut {
    background: #fff;
    border: 1px solid #E5DFD0;
    border-radius: 12px;
    padding: 14px;
    margin: 12px 0;
    display: flex; align-items: center; gap: 16px;
  }
  .premium-mockup .sip-donut .sd-svg { flex-shrink: 0; width: 100px; height: 100px; }
  .premium-mockup .sip-donut .sd-legend {
    flex: 1; display: flex; flex-direction: column; gap: 4px;
    font-size: 11px;
  }
  .premium-mockup .sip-donut .sd-row {
    display: grid; grid-template-columns: 12px 70px 1fr 28px;
    gap: 6px; align-items: center;
    color: #2a2520;
  }
  .premium-mockup .sip-donut .sd-swatch {
    width: 10px; height: 10px; border-radius: 2px;
  }
  .premium-mockup .sip-donut .sd-name { font-weight: 600; }
  .premium-mockup .sip-donut .sd-bar { background: #E5DFD0; height: 4px; border-radius: 100px; }
  .premium-mockup .sip-donut .sd-fill { height: 100%; border-radius: 100px; }
  .premium-mockup .sip-donut .sd-pct { text-align: right; font-feature-settings: 'tnum'; color: #5C4A2E; }/* 대운 가로 시간선 */

  
  .premium-mockup .daewoon-line {
    margin-top: 14px;
    background: #F4EFE4;
    border-radius: 10px;
    padding: 14px 14px 8px;
    border: 1px solid #E5DFD0;
    overflow: hidden;
  }
  .premium-mockup .daewoon-line .dl-title {
    font-size: 11px; color: #5C4A2E; margin-bottom: 12px; font-weight: 500;
  }
  .premium-mockup .daewoon-line .dl-bar {
    position: relative; height: 36px;
    background: linear-gradient(90deg,
      #cfd8dc 0%, #cfd8dc 12%,
      #E8D9B8 12%, #E8D9B8 25%,
      #4E7A57 50%, #4E7A57 62%,
      #E8D9B8 75%, #E8D9B8 87%,
      #cfd8dc 87%, #cfd8dc 100%);
    border-radius: 100px;
    margin: 14px 0 8px;
  }
  .premium-mockup .daewoon-line .dl-mark {
    position: absolute; top: -10px;
    transform: translateX(-50%);
    background: #1a1a1a; color: #E8D9B8;
    padding: 3px 7px; border-radius: 100px;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.05em; white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0,0,0,.15);
  }
  .premium-mockup .daewoon-line .dl-mark::after {
    content: ''; position: absolute;
    top: 100%; left: 50%; transform: translateX(-50%);
    border: 4px solid transparent; border-top-color: #1a1a1a;
  }
  .premium-mockup .daewoon-line .dl-mark.peak { background: #4E7A57; color: #fff; }
  .premium-mockup .daewoon-line .dl-mark.peak::after { border-top-color: #4E7A57; }
  .premium-mockup .daewoon-line .dl-axis {
    display: flex; justify-content: space-between;
    font-size: 11px; color: #7F6B4E;
    padding: 0 2px;
  }/* 인생 단계 3카드 */

  
  .premium-mockup .life-stage-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 6px; margin: 14px 0;
  }
  .premium-mockup .life-stage-card {
    background: #fff; border-radius: 10px;
    padding: 12px 8px;
    border: 1px solid #E5DFD0;
    text-align: center;
    display: flex; flex-direction: column; gap: 4px;
  }
  .premium-mockup .life-stage-card.now {
    background: linear-gradient(180deg, rgba(212,175,55,.12), rgba(212,175,55,.04));
    border-color: rgba(212,175,55,.4);
    box-shadow: 0 4px 10px rgba(212,175,55,.1);
  }
  .premium-mockup .life-stage-card .ls-tag {
    font-size: 11px; color: #B8965A; font-weight: 700; letter-spacing: 0.1em;
  }
  .premium-mockup .life-stage-card .ls-age {
    font-family: 'Noto Serif KR', serif;
    font-size: 13px; font-weight: 700; color: #1a1a1a;
  }
  .premium-mockup .life-stage-card .ls-key {
    font-size: 11px; color: #2a2520; line-height: 1.45;
    margin-top: 2px;
  }
  .premium-mockup .life-stage-card .ls-glyph {
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; color: #B8965A; margin-top: 2px;
  }/* 12개월 인사이트 */

  
  .premium-mockup .month-insight-grid {
    margin-top: 14px;
    background: linear-gradient(180deg, #FFFEF8 0%, #FAF6EC 100%);
    border: 1.5px solid rgba(184,150,90,.28);
    border-radius: 14px;
    padding: 14px;
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 9px;
    font-size: 12px;
    box-shadow: 0 3px 14px rgba(184,150,90,0.10);
  }
  .premium-mockup .month-insight-grid .mi {
    position: relative;
    padding: 12px 12px 13px 14px;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #E5DFD0;
    box-shadow: 0 1px 4px rgba(20,15,8,0.04);
    line-height: 1.55;
    color: #2a2520;
    overflow: hidden;
    display: flex; flex-direction: column; gap: 5px;
  }
  /* 2026-05-28 — 12개월 카드 좌측 strip 제거 (균일 grid 동일 strip = AI 손톱 디자인 티).
     up/peak/warn/now 타입별 톤은 .mi-month·.mi-badge 컬러로 충분히 표현. */
  /* 헤더 줄 — 월·간지·라벨 */
  .premium-mockup .month-insight-grid .mi .mi-head {
    display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 7px;
    margin-bottom: 3px;
  }
  .premium-mockup .month-insight-grid .mi .mi-month {
    font-family: 'Noto Serif KR', serif;
    font-size: 14px; font-weight: 800; color: #1a1a1a;
    letter-spacing: 0.02em;
    line-height: 1.2; white-space: nowrap;
  }
  .premium-mockup .month-insight-grid .mi .mi-ganzi {
    font-family: 'Noto Serif KR', serif;
    font-size: 12px; font-weight: 700;
    color: #8B6F3D;
    letter-spacing: 0.02em;
    line-height: 1.2; white-space: nowrap;
  }
  .premium-mockup .month-insight-grid .mi .mi-badge {
    margin-left: auto;
    font-size: 11px; font-weight: 800;
    padding: 2px 7px;
    border-radius: 99px;
    letter-spacing: 0.06em;
    background: #F4EFE4;
    color: #7A7269;
    border: 1px solid #E5DFD0;
    line-height: 1.5;
  }
  .premium-mockup .month-insight-grid .mi .mi-text {
    font-size: 11.5px;
    color: #2a2520;
    line-height: 1.6;
    word-break: keep-all;
  }
  .premium-mockup .month-insight-grid .mi .mi-text strong {
    color: #8B6F3D; font-weight: 700;
  }
  /* 키워드 뱃지 영역 */
  .premium-mockup .month-insight-grid .mi .mi-tag {
    display: inline-block;
    margin-top: 4px;
    font-size: 11px;
    color: #7A7269;
    background: rgba(184,150,90,0.08);
    padding: 1px 6px;
    border-radius: 4px;
    letter-spacing: 0.04em;
  }
  /* up — 상승 (그린) */
  .premium-mockup .month-insight-grid .mi.up .mi-month  { color: #4E7A57; }
  .premium-mockup .month-insight-grid .mi.up .mi-badge  { background: rgba(78,122,87,0.10); color: #4E7A57; border-color: rgba(78,122,87,0.32); }
  /* peak — 정점 (그린 + 강조) */
  .premium-mockup .month-insight-grid .mi.peak {
    background: linear-gradient(135deg, #fff 0%, rgba(78,122,87,0.05) 100%);
    border-color: rgba(78,122,87,0.42);
    box-shadow: 0 0 0 2px rgba(78,122,87,0.18), 0 2px 8px rgba(78,122,87,0.10);
  }
  .premium-mockup .month-insight-grid .mi.peak .mi-month { color: #355A3E; }
  .premium-mockup .month-insight-grid .mi.peak .mi-badge {
    background: linear-gradient(135deg, #4E7A57, #355A3E);
    color: #fff; border-color: transparent;
  }
  .premium-mockup .month-insight-grid .mi.peak .mi-text strong { color: #355A3E; }
  /* warn — 주의 (레드) */
  .premium-mockup .month-insight-grid .mi.warn {
    background: linear-gradient(135deg, #fff 0%, rgba(198,40,40,0.04) 100%);
    border-color: rgba(198,40,40,0.32);
  }
  .premium-mockup .month-insight-grid .mi.warn .mi-month  { color: #c62828; }
  .premium-mockup .month-insight-grid .mi.warn .mi-badge  { background: rgba(198,40,40,0.10); color: #c62828; border-color: rgba(198,40,40,0.32); }
  .premium-mockup .month-insight-grid .mi.warn .mi-text strong { color: #c62828; }
  /* now — 지금 (골드) */
  .premium-mockup .month-insight-grid .mi.now {
    background: linear-gradient(135deg, #fff 0%, rgba(184,150,90,0.10) 100%);
    border-color: rgba(184,150,90,0.50);
    box-shadow: 0 0 0 2px rgba(184,150,90,0.18), 0 2px 8px rgba(184,150,90,0.12);
  }
  .premium-mockup .month-insight-grid .mi.now .mi-month  { color: #B8965A; }
  .premium-mockup .month-insight-grid .mi.now .mi-badge  {
    background: linear-gradient(135deg, #B8965A, #8B6F3D);
    color: #fff; border-color: transparent;
  }
  .premium-mockup .month-insight-grid .mi.now .mi-text strong { color: #8B6F3D; }/* 신살 v2.1 — 강/중/참고 위계 */

  
  .premium-mockup .shinsal-meta {
    display: flex; gap: 6px; align-items: center;
    margin-top: 6px;
  }
  .premium-mockup .shinsal-meta .sm-pulse {
    display: inline-flex; gap: 2px;
  }
  .premium-mockup .shinsal-meta .sm-pulse span {
    width: 4px; height: 10px; border-radius: 1px;
    background: #E5DFD0;
  }
  .premium-mockup .shinsal-meta .sm-pulse span.on { background: #B8965A; }
  .premium-mockup .shinsal-meta .sm-when {
    font-size: 11px; color: #7F6B4E;
    padding: 2px 7px; border-radius: 100px;
    background: #F4EFE4;
    border: 1px solid #E5DFD0;
    letter-spacing: 0.03em;
  }
  .premium-mockup .shinsal-meta .sm-when.always { color: #4E7A57; border-color: rgba(78,122,87,.3); background: rgba(78,122,87,.06); }
  .premium-mockup .shinsal-meta .sm-when.dae    { color: #B8965A; border-color: rgba(184,150,90,.4); background: rgba(184,150,90,.08); }
  .premium-mockup .shinsal-meta .sm-when.year   { color: #3E5F82; border-color: rgba(62,95,130,.3); background: rgba(62,95,130,.06); }
  .premium-mockup .shinsal-meta .sm-when.dorm   { color: #5C4A2E; }/* 보조(중) 신살 카드 — 더 컴팩트 */

  
  .premium-mockup .shinsal-card.mid { padding: 10px 12px; }
  .premium-mockup .shinsal-card.mid p { font-size: 11.5px; }
  .premium-mockup .shinsal-card.mid .adv { padding-top: 6px; margin-top: 6px; }/* 참고 신살 뱃지 */

  
  .premium-mockup .shinsal-refs {
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-top: 12px;
    padding: 12px;
    background: #F4EFE4;
    border-radius: 10px;
    border: 1px dashed #E5DFD0;
  }
  .premium-mockup .shinsal-refs .sr-title {
    width: 100%; font-size: 11px; color: #5C4A2E;
    font-weight: 600; letter-spacing: 0.05em;
    margin-bottom: 2px;
  }
  .premium-mockup .shinsal-refs .sr-tag {
    font-size: 11px;
    padding: 4px 10px; border-radius: 100px;
    background: #fff; color: #2a2520;
    border: 1px solid #E5DFD0;
    display: inline-flex; gap: 6px; align-items: baseline;
  }
  .premium-mockup .shinsal-refs .sr-tag .sr-han {
    font-family: 'Noto Serif KR', serif;
    font-size: 11px; color: #B8965A;
  }
  .premium-mockup .shinsal-refs .sr-tag .sr-note {
    font-size: 11px; color: #7F6B4E;
  }
`;
