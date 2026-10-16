/**
 * DesktopBrandPanel — PC 웹 브랜드 셸 v3 (2026-10-16 v9 수묵)
 *
 * 좌 브랜드 + 우 폰 스트립. 먹 바탕과 정선 「인왕제색도」, 스토어 대표 이미지와 같은 제목.
 * 금빛 띠, 형광펜, 알약 칩, 근거 없는 '600년' 문구는 뺐다(v9 규칙, AI 결과물 티 금지 목록).
 *
 * - 1240px 미만 · 앱인토스 · /admin 에선 비표시 (CSS media + data-admin + 빌드 플래그)
 * - 스트립 정렬·스크롤은 globals.css 의 .app-container(틀) + .app-scroll(스크롤) 규칙이 담당
 */
import { isAppintosBuild } from '@/lib/env';

const POINTS = [
  { seal: '一', title: '종합사주 열 장', desc: '타고난 성격과 일, 재물, 연애, 건강, 10년 대운까지 차례대로 풀어 드려요' },
  { seal: '二', title: '궁금한 것만 골라서', desc: '연애운, 재물운, 합격이직운, 두 사람 궁합, 2027 신년운세를 따로 볼 수 있어요' },
  { seal: '三', title: '매일 무료로 시작해요', desc: '오늘의 운세와 꿈해몽은 하루 한 번 무료예요. 띠만 눌러도 오늘 운세가 보여요' },
];

export function DesktopBrandPanel() {
  if (isAppintosBuild) return null;
  return (
    <aside className="desktop-brand-panel" aria-hidden="true">
      <div className="dbp-bg-art" />

      <div className="dbp-inner">
        <div className="dbp-brandrow">
          <img src="/logo.png" alt="" className="dbp-logo" />
          <span className="dbp-wordmark">사주<b>500</b></span>
        </div>

        <h1 className="dbp-title">
          나도 몰랐던 나를,<br />
          사주가 알고 있었습니다
        </h1>
        <div className="dbp-rule" />

        <div className="dbp-points">
          {POINTS.map((pt) => (
            <div key={pt.seal} className="dbp-point">
              <span className="dbp-point-seal">{pt.seal}</span>
              <span>
                <div className="dbp-point-title">{pt.title}</div>
                <div className="dbp-point-desc">{pt.desc}</div>
              </span>
            </div>
          ))}
        </div>

        <div className="dbp-cta">
          설치 없이 <b>오른쪽 화면에서 바로</b> 시작하세요
          <span className="dbp-cta-sub">토스 앱에서 ‘사주500’을 검색해도 만날 수 있어요</span>
        </div>
      </div>
    </aside>
  );
}
