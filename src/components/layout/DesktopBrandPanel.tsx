/**
 * DesktopBrandPanel — PC 웹 브랜드 셸 v2 (2026-06-12)
 *
 * 펫프렌즈 레이아웃 문법(좌 브랜드 임팩트 + 대각선 배경 + 우 폰 스트립)을 가져오되,
 * 내용은 사주500 차별성으로: 600년 원전 · 만세력 정밀 계산 · 매일 무료.
 *
 * - 1240px 미만 · 앱인토스 · /admin 에선 비표시 (CSS media + data-admin + 빌드 플래그)
 * - 스트립 정렬·스크롤은 globals.css 의 .app-container 폰프레임 규칙이 담당
 */
import { isAppintosBuild } from '@/lib/env';

const POINTS = [
  { emblem: '値', title: '처음부터 끝까지 한 권 분량', desc: '타고난 성격부터 10년 대운까지 차례대로 풀어 드려요' },
  { emblem: '典', title: '아무 말 운세가 아니에요', desc: '연해자평과 자평진전 등 600년 고전 원전 기반 풀이' },
  { emblem: '日', title: '매일 무료로 시작해요', desc: '오늘의 운세와 꿈해몽은 하루 한 번 무료예요' },
];

const KEYWORDS = ['오늘의 운세', '꿈해몽', '연애운', '재회운', '종합사주', '사주대화'];

export function DesktopBrandPanel() {
  if (isAppintosBuild) return null;
  return (
    <aside className="desktop-brand-panel" aria-hidden="true">
      {/* 배경 레이어 — 크림 + 잉크 대각 밴드 + 골드 라인 (2026-10-15 큰 한자 워터마크 命, 運 삭제 · v9 규칙) */}
      <div className="dbp-bg-base" />
      <div className="dbp-bg-ink" />
      <div className="dbp-bg-gold" />

      <div className="dbp-inner">
        <div className="dbp-brandrow">
          <img src="/logo.png" alt="" className="dbp-logo" />
          <span className="dbp-wordmark">사주<b>500</b></span>
        </div>

        <h1 className="dbp-title">
          내 사주,<br />
          <span className="dbp-title-gold">처음부터 끝까지</span> 읽어 드려요
        </h1>

        <div className="dbp-points">
          {POINTS.map((pt) => (
            <div key={pt.emblem} className="dbp-point">
              <span className="dbp-point-emblem">{pt.emblem}</span>
              <span>
                <div className="dbp-point-title">{pt.title}</div>
                <div className="dbp-point-desc">{pt.desc}</div>
              </span>
            </div>
          ))}
        </div>

        <div className="dbp-chips">
          {KEYWORDS.map((k) => (
            <span key={k} className="dbp-chip">{k}</span>
          ))}
        </div>

        <div className="dbp-cta">
          <span className="dbp-cta-emblem">運</span>
          <span>
            설치 없이 <b>오른쪽 화면에서 바로</b> 시작하세요<br />
            <span className="dbp-cta-sub">토스 앱에서 “사주500”을 검색해도 만날 수 있어요</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
