# 360×640 해상도 목업 구조 감사 (실기기 대체)

**작성:** 2026-04-21 · D-1
**근거:** 앱인토스 검수 §2-1 — "세로 논리 해상도 360×640 ~ 420×740. 트래픽 70~80% 집중."
**방식:** 목업 HTML의 CSS 규칙을 정적 분석 + 360 폭 기준 깨짐 가능 지점 추출.
**한계:** 실기기·에뮬레이터 렌더링 미포함. Claude Code가 PC에서 DevTools 360×640으로 재검증 필요.

---

## 1. 요약 판정

| 목업 | 프레임 폭 | 반응형 | 360 위험도 | 수정 필요 |
|---|---|---|---|---|
| 홈 v3 | `width:428px; max-width:100%` | △ | 🟡 중 | 컴포넌트 내부 고정폭 점검 |
| 홈 v2 | `width:428px` (max-width 없음) | ✗ | 🔴 고 | **제출 전 max-width:100% 추가 필수** |
| 입력 v1 | `width:428px; max-width:100%` | △ | 🟡 중 | 시간 입력 56px 2개 + label OK |
| 충전 v2 | `width:428px; max-width:100%` | △ | 🟡 중 | CheckoutBar min-width:132px × 2열 의심 |
| 이벤트 v3 | `width:428px; height:900px` (max-width 없음) | ✗ | 🔴 고 | **max-width:100% 추가 필수** |
| 결과 4종 | `max-width:480px` | ○ | 🟢 낮 | 통과 (max-width만 있음) |
| 사주대화 | `max-width:480px; flex column` | ○ | 🟢 낮 | 통과 |
| 홈 v1 | `width:428px` (legacy) | ✗ | 🟠 상 | v3로 대체 확정이라 비적용 |

## 2. 🔴 고위험 항목 — 제출 전 수정 필수

### 2-1. 홈 v2 — `width:428px` 고정 + max-width 없음
**위치:** `사주500_UI개편_목업_홈_v2.html` L47
**증상:** 360 폭에서 가로 스크롤 발생
**수정:** `width:428px; max-width:100%;` 또는 아예 v3로 통일 (v3는 max-width:100% 있음)
**비고:** 홈은 v3 확정이므로 v2 파일은 프로덕션 미배포 확인 필요

### 2-2. 이벤트 v3 — 고정 폭 + max-width 없음
**위치:** `사주500_UI개편_목업_이벤트_v3.html` L43, L340
**증상:** 360 폭에서 프레임 자체가 뷰포트 밖으로 밀림
**수정:**
```css
.frame { width: 428px; max-width: 100%; height: 900px; ... }
```
두 군데 모두 패치.

## 3. 🟡 중위험 — Claude Code 실기기 재검증 대상

### 3-1. 홈 v3 리뷰 캐러셀 카드
**위치:** `목업_홈_v3.html` L157 `.review-card{min-width:280px; max-width:280px;}`
**이슈:** 360 폭에서 좌우 padding 16px × 2 = 32px 제외 → 328px 여유. 280px 카드 + 피크 24px = 304px OK. 하지만 스크롤 스냅 간격이 타이트할 수 있음.
**권장:** 360×640 실기기에서 한 카드 풀뷰 vs 옆 카드 티저 간격 확인. 카드 padding 16→12로 줄여도 무방.

### 3-2. 충전 v2 CheckoutBar 2열 그리드
**위치:** `목업_충전_v2.html` L163 `.checkout .btn-pay{min-width:132px;}`
**이슈:** 360 폭 - 사이드 padding 16 × 2 = 328 → 2열 그리드에서 132 × 2 = 264 + gap 12 = 276 OK. 단 요약 블록 옆에 붙으면 overflow.
**권장:** PC에서 잔액 + CTA 붙는 시점 360 기준 와이드 확인.

### 3-3. 입력 v1 시간 입력
**위치:** `목업_입력_v1.html` L249·251 `input max-width:56px`
**이슈:** HH:MM 두 개 + ":" + 보조 라벨 동일 행 → 360 폭 여유 있음
**판정:** 통과. 기기 키보드 올라왔을 때 CTA overlap만 체크.

## 4. 🟢 통과 — 결과 4종

`max-width:480px; margin:0 auto;` 구조라 360 폭에서 좌우 여백 0 + 내용 그대로 축소. 이슈 없음.

프리미엄 v2의 `toc-side`는 `@media (max-width:540px) { display:none }` 규칙 있어 360 자동 숨김. 통과.

## 5. Safe Area 대응

검수 §2-1 "노치·카메라홀·Dynamic Island 대응 필수".

### 5-1. 점검 결과
```bash
grep -l "env(safe-area-inset" 목업*.html
```
**결과:** 현재 목업 파일 전부 `env(safe-area-inset-*)` 사용 **0건**.

### 5-2. 권장 패치 (전역)
모든 목업의 sticky BalanceBar / BottomCTA / TabBar에 적용:
```css
.balance-bar { padding-top: calc(8px + env(safe-area-inset-top)); }
.tabbar      { padding-bottom: calc(8px + env(safe-area-inset-bottom)); }
.checkout    { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
```
- 실제 앱인토스 웹뷰에서 노치가 침범하는지는 기기 확인 필요
- PC 빌드에서 전역 CSS `_safe-area.css` 한 장 만들어 import 권장

## 6. 터치 타겟 최소 44×44pt

검수 §2-2 TDS 요구사항.

### 6-1. 점검
목업 주요 버튼 크기 stamp 추출:
| 컴포넌트 | 높이 | 판정 |
|---|---|---|
| 결과 `.actions .btn` | padding 12·8 + ti/sb 2줄 ≈ 62px | ✓ |
| 충전 `.btn-pay` | height:48px | ✓ (폭 min-width 132) |
| 홈 v3 primary CTA | height 56 추정 | ✓ |
| 캐러셀 dot | 8px | ✗ (보조 요소라 허용) |
| 아코디언 헤더 | 48+ | ✓ |

**위반 0건.** dot은 인터랙션 대상 아니라 허용 범위.

## 7. 뒤로가기 중복 노출 — 실기기 필수

**체크리스트 §3-2:** 앱인토스 네이티브 뒤로가기 + 앱 TopBar 뒤로가기 동시 노출 금지.

### 7-1. 현재 목업 상태
- `/charge` 스펙상 TopBar 있음 (07_운충전.md L47)
- `/chat`, `/result/:id`, `/my`, `/events` 모두 TopBar 있음

### 7-2. 권장 처리
앱인토스 빌드에서 다음 조건에 따라 `<TopBar showBack={!isAppintos}>` 분기:
```tsx
const isAppintos = isAppintosBuild || /InTossApp/i.test(navigator.userAgent);
<TopBar title={title} showBack={!isAppintos} />
```

**PC 작업:** `src/components/TopBar.tsx`에 `hideBack` prop 또는 env 기반 자동 판정.

## 8. 즉시 조치 리스트 (D-1)

| # | 항목 | 담당 | 소요 |
|---|---|---|---|
| 1 | 홈 v2 `max-width:100%` 추가 또는 v3로 통일 확인 | Claude | 5분 |
| 2 | 이벤트 v3 `max-width:100%` 추가 (2곳) | Claude | 5분 |
| 3 | Safe Area env() 전역 CSS 작성·PC에 반영 | PC | 20분 |
| 4 | TopBar 앱인토스 분기 | PC | 20분 |
| 5 | 360×640 DevTools로 홈·결과·충전·이벤트 실측 캡쳐 | PC | 40분 |

## 9. 한계 선언

이 감사는 **정적 CSS 분석**이다. 아래 항목은 실기기 없이 판정 불가:

- 키보드 올라왔을 때 CTA overlap
- 스크롤 탄성·스냅 버릇
- 웹뷰 사파리 vs 크롬 렌더링 차이
- 앱인토스 네이티브 탑바 실제 높이
- 가속도 센서/네트워크 상태 기반 인터랙션

위 항목은 Claude Code가 DevTools/BrowserStack로 추가 검증 필수.
