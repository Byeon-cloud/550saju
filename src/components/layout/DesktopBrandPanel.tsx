/**
 * DesktopBrandPanel — PC 웹 브랜드 셸 (2026-06-12)
 *
 * 배경: PC 로 saju500.app 접속 시 빈 화면에 모바일 스트립만 덜렁 떠 있던 것 →
 *   펫프렌즈류 "모바일 퍼스트 서비스의 PC 랜딩" 패턴 적용:
 *   좌측 브랜드 패널(로고·태그라인·키워드·앱 안내) + 우측 앱 스트립 + 브랜드 배경.
 *
 * - 1180px 미만·앱인토스에선 렌더 자체 안 함 (CSS media + 빌드 플래그 이중 가드)
 * - 앱 스트립(.app-container)의 데스크톱 시프트는 globals.css @media 에서 처리
 */
import { isAppintosBuild } from '@/lib/env';

const KEYWORDS = ['오늘의 운세 무료', '꿈해몽', '연애운', '재회운', '종합사주', '사주 상담'];

export function DesktopBrandPanel() {
  if (isAppintosBuild) return null;
  return (
    <aside className="desktop-brand-panel" aria-hidden="true">
      {/* 거대 한자 워터마크 */}
      <span className="dbp-watermark">命</span>

      <div className="dbp-inner">
        <img src="/logo.png" alt="" className="dbp-logo" />
        <h1 className="dbp-title">
          사주<span className="dbp-title-gold">500</span>
        </h1>
        <p className="dbp-tagline">
          당신의 사주,<br />처음부터 끝까지 읽어드립니다
        </p>
        <p className="dbp-sub">
          600년 명리학 원전 기반 — 만세력 계산부터 풀이까지
        </p>

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
