# PC Claude Code 답변 #2 — 5단계 HomePage.tsx 전면 교체 승인

> **준기 사용법:** 파일 열기 → Ctrl+A → Ctrl+C → PC Claude Code에 Ctrl+V → Enter (1번)

---

# PC Claude Code에게

1단계 완료 보고 잘 받음. 깔끔히 처리됐다:
- Q1~Q4 충돌 해소 완료
- tailwind.config.js 기존 토큰 0건 덮어쓰기, 신규 brand v4.1 토큰 + 오행 5종 HEX + text-pillar 36px 추가
- src/components/ui/ 공용 컴포넌트 11종 + barrel export 완료
- typecheck PASS / build PASS
- EmptyState 이름 충돌은 모듈 경로 분리로 해결 OK

**5단계 착수 승인.** 바로 진행.

## 원칙 (5단계 내내 유지)

- EmptyState는 반드시 `@/components/ui/EmptyState`. 기존 `@/components/common/EmptyState`는 HomePage에서 쓰지 않는다. 혼용 방지.
- 공용 컴포넌트는 전부 `@/components/ui` barrel에서 import (`import { Heading, ProductCard, ReviewCard, ... } from '@/components/ui'`).
- 기존 공용 컴포넌트 (`SajuMiniCard`, `OhengCompareBar` 등)는 원래 경로 그대로 재사용. 신규 경로로 옮기지 않는다.

---

## 5단계 실행 순서

### 1. 기존 HomePage 백업

- `git mv src/pages/HomePage.tsx src/pages/HomePage.legacy.tsx`
- legacy 파일 맨 위 1줄 추가:
  ```
  // ⚠️ DEPRECATED — 2026-04-20부 v4.1 디자인으로 전면 교체됨. 참조용 백업.
  ```
- 라우터(`App.tsx` or `router.tsx`)에서 `/home` or `/` 경로는 **신규 HomePage**에 연결. legacy는 라우팅 대상 아님.

### 2. 신규 HomePage.tsx 작성

스펙 출처: `docs/homepage_redesign_spec.md` 그대로. 섹션 1~8 **순서 그대로 스킵 없이** 구현.

| 섹션 | 주요 컴포넌트 | 비고 |
|---|---|---|
| 1. 히어로 | `Heading` or 직접 JSX + `KPICell` x3 + PrimaryCTA/SecondaryCTA | "내 사주, 500원에 제대로." / KPI: 평균가 대비 1.5% · 풀이 분량 2,800자 · 시간 보정 ±30분 |
| 2. 오늘의 운세 | `Heading` + Card tier primary + `SajuMiniCard`(있을 때) | hasSaju 분기. 신규 유저는 CTA 우선. |
| 3. 꿈해몽 입구 | `Heading` + Card tier secondary + Icon Moon | 미리보기 2800자 중 38% 진행바 |
| 4. 신살 한줄 | `Heading` + `SinsalRow` x5 | 도화살·화개살·천을귀인·관살 혼잡·공망 |
| 5. 상품 매트릭스 | `Heading` + `ProductCard` x3 | 무료·500원(highlight)·5000원 |
| 6. 후기 캐러셀 | `Heading` + `ReviewCard` x5 (overflow-x-auto snap) | 민지27·동현33·수빈29·재훈31·은정42 |
| 7. 왜 사주500 | `Heading` + `ReasonRow` x3 | 한국 최저가 · 6대 원전 · ±30분 보정 |
| 8. 하단 sticky CTA | 직접 JSX (sticky + safe-area-inset-bottom) | "내 사주 풀어보기 · 500원" |

### 3. 데이터 훅

- `useTodayFortune` — 오늘의 운세 데이터 (`todayHeadline`, `loading`, `error`). 기존 있으면 재사용. 없으면 stub:
  ```tsx
  // TODO(Phase 2): 실데이터 연결. 현재는 stub.
  export function useTodayFortune() {
    return { todayHeadline: null, loading: false, error: null };
  }
  ```
- `useUserSaju` — 유저가 사주 입력했는지 여부 (`hasSaju: boolean`). 동일 룰.

### 4. 반응형 & 접근성

- 모바일: `max-w-[428px] mx-auto px-5` (iPhone 15 Pro Max 기준).
- 데스크톱 1024px+: 중앙 정렬 + 좌우 여백 + 앱 프레임 그림자.
- aria-label: 모든 CTA에 명시 (예: `aria-label="내 사주 풀어보기, 500원에 풀이를 받습니다"`).
- 후기 캐러셀에 키보드 네비 (←/→ 키 또는 좌우 버튼).
- `@media (prefers-reduced-motion: reduce)` 시 섹션 진입 애니메이션 disable.

### 5. 검증 게이트

```bash
npx tsc --noEmit
npm run build

# 금지어 grep — HomePage.tsx 파일 한정
grep -En "잠시만 기다려|곧 완료|할 수 있습니다|것입니다|가능성이 있|것처럼 보" src/pages/HomePage.tsx
grep -EnP "(점집|무속|부적|주술|귀신|액운|저주|재수없|불운)" src/pages/HomePage.tsx

# 이모지 grep (U+1F000~U+1FFFF 블록 체크)
grep -Pn "[\x{1F300}-\x{1FAFF}]" src/pages/HomePage.tsx

# 하드코딩 색상 — 토큰 미사용 감지
grep -En "#[0-9A-Fa-f]{3,6}" src/pages/HomePage.tsx
```

기준: 모든 grep 0건. 하드코딩 색상 발견 시 tailwind 토큰으로 교체.

### 6. 5단계 완료 보고 포맷

```
[PC Claude Code 5단계 완료 보고]
- HomePage.legacy.tsx 백업 (git mv 확인)
- 신규 HomePage.tsx: {총 라인수}줄, 섹션 1~8 구현 완료
- 공용 컴포넌트 사용: @/components/ui barrel에서 {X}개 import
- 데이터 훅: useTodayFortune ({신규 stub|기존 재사용}), useUserSaju ({신규 stub|기존 재사용})
- 라우터: /home (or /) 신규 HomePage 연결 완료
- 검증:
  · typecheck PASS
  · build PASS
  · 금지어 grep 0건
  · 이모지 grep 0건
  · 하드코딩 색상 grep 0건
- 다음 단계: InputPage·PayPage·ReviewPage 전면 교체 (6단계) 승인 대기
```

---

## 6단계 자동 진행 금지

- 5단계 완료 보고 후 **반드시 멈춤**.
- 준기가 로컬에서 홈 직접 확인 후 별도 승인 paste 줄 때까지 6단계 대기.

## 절대 금지

- "HomePage 완벽 구현"·"UI 개편 완료" 같은 과장 발언.
- 스펙에 없는 섹션 추가 (섹션 9 같은 것). 덜어내는 것도 금지.
- 색상·폰트·크기·간격 **하드코딩**. 반드시 tailwind 토큰 사용.
- 이모지를 본문 또는 라벨에 사용. 아이콘은 lucide-react 또는 오행 SVG만.
- "지금 이 상품 1위" 같은 지정된 뱃지 문구를 "베스트셀러" 등으로 변형.
- 금지어 (점집·무속·부적·주술·귀신·액운·저주·재수없다·운이 없다·불운하다).
- 면피체 (~할 수 있습니다, ~것입니다, ~가능성이 있습니다, ~것처럼 보입니다).

## 시작해라

지금 바로 5단계 실행. 완료 보고 1번.
