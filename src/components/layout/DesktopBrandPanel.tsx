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
  { emblem: '典', title: '600년 원전으로 풀이해요', desc: '연해자평·자평진전 등 6대 고전 기반 — 광고식 운세가 아니에요' },
  { emblem: '曆', title: '만세력부터 정확하게', desc: '진태양시 ±30분 보정까지 — 점집에서도 놓치는 계산' },
  { emblem: '日', title: '매일 무료로 시작해요', desc: '오늘의 운세·꿈해몽은 돈 안 들어요' },
];

const KEYWORDS = ['오늘의 운세', '꿈해몽', '연애운', '재회운', '종합사주', '사주 상담'];

export function DesktopBrandPanel() {
  if (isAppintosBuild) return null;
  return (
    <aside className="desktop-brand-panel" aria-hidden="true">
      {/* 배경 레이어 — 크림 + 잉크 대각 밴드 + 골드 라인 + 한자 워터마크 */}
      <div className="dbp-bg-base" />
      <span className="dbp-watermark">命</span>
      <div className="dbp-bg-ink" />
      <div className="dbp-bg-gold" />
      <span className="dbp-watermark dbp-watermark--ink">運</span>

      <div className="dbp-inner">
        <div className="dbp-brandrow">
          <img src="/logo.png" alt="" className="dbp-logo" />
          <span className="dbp-wordmark">사주<b>500</b></span>
        </div>

        <h1 className="dbp-title">
          당신의 사주,<br />
          <span className="dbp-title-gold">처음부터 끝까지</span> 읽어드립니다
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
            <b>토스 앱</b>에서 <b>“사주 500”</b> 검색 —<br />
            <span className="dbp-cta-sub">앱에서 더 편하게 보실 수 있어요</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
