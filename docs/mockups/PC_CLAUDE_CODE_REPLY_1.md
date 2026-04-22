# PC Claude Code 답변 #1 — 충돌 4건 처리 + 4단계 진행

> **준기 사용법:** 파일 열기 → Ctrl+A → Ctrl+C → PC Claude Code에 Ctrl+V → Enter (1번)

---

# PC Claude Code에게

Q1~Q4 결정. 준기 위임받아 처리. 추가 질문 없이 아래대로 실행 → 충돌 해소 보고 → 4단계 자동 진행.

## Q1 — 디자인시스템 충돌 → A안 확정

- 신규 `docs/design_system_v4_consolidated.md`가 정본.
- 기존 `docs/prd/디자인시스템_v4.md` → `docs/prd/_archive/디자인시스템_v4.md`로 `git mv` 이동.
- 이동한 파일 맨 위 1줄 추가:
  ```
  > ⚠️ DEPRECATED — 이 문서는 2026-04-20부로 통합 정본 `/docs/design_system_v4_consolidated.md`로 대체됐습니다. 히스토리 참조용으로만 유지.
  ```

## Q2 — 8원칙 정본 + 히스토리 부록

- 8원칙 (v4.1 보정 포함)이 정본.
- 신규 `docs/design_system_v4_consolidated.md` **맨 끝**에 다음 섹션 추가:

```markdown
---

## 부록 A. 히스토리 — v3 → v4 → v4.1 전환 배경

### v3 (~2026-03)
- 보라핑크 + 그라디언트 + 명조체 혼용 → "AI 양산형" 피드백 다발.
- 결과 페이지만 디자인 적용, 홈·입력·결제 무관심.

### v4 (2026-04-19, 기존 디자인시스템_v4.md)
- 7원칙 정립 — 단색·Pretendard·52px CTA·한자 최소화 등.
- gold-brown 단색 채택 (이전 보라핑크 폐기).
- 결과 페이지에 우선 적용 (D1~D6).

### v4.1 (2026-04-20, 본 문서)
- 8원칙으로 보정 — 한자 이원화 룰 추가 (UI 한글 + 지정 위치만 한자).
- 면피체·점집 금지어 grep 항목 명문화.
- 신살 고유명사를 브랜드 자산으로 승격 (도화살·천을귀인 등).
- 5페이지 전면 적용 기준으로 확장 (홈·입력·결제·후기·결과).

### 다음 (v5 후보)
- 다크 모드.
- 영문판 (글로벌).
- 한자 hover 상호작용.
```

기존 디자인시스템_v4.md의 "v3→v4 전환 이유" 섹션이 더 길면 위 v4 항목에 1~2줄 더 흡수해라.

## Q3 — 디자인토큰.md 처리

1. `docs/prd/디자인토큰.md` 파일 존재 여부 확인. 없으면 이 항목 스킵.
2. 있으면 열어서 신규 `docs/design_system_v4_consolidated.md §1` 색상·폰트·간격 토큰과 **diff 비교**.
3. 처리 룰:
   - **신규에 없는 토큰이 있으면** → 신규 §1에 추가하고 어느 토큰이 추가됐는지 보고에 포함.
   - **신규와 값이 다르면** → 신규 값이 정본 (v4.1 보정 적용된 값). 차이만 보고에 명시.
   - **신규와 동일하면** → 그냥 archive 이동.
4. 처리 끝나면 `docs/prd/_archive/디자인토큰.md`로 이동 + DEPRECATED 주석 1줄.

## Q4 — UIUX 상세설계서 → A안 확정

- 기존 `docs/사주500_UIUX_상세설계서.md` 유지 (결과·대운·궁합·개인정보 등 다른 페이지 정본).
- 그 안의 **홈·입력·결제·후기 4개 페이지 섹션** 상단에 각각 한 줄 추가:

```markdown
> 🔄 이 페이지는 2026-04-20부로 신규 스펙으로 대체됐습니다 → `/docs/homepage_redesign_spec.md` (홈) / `/docs/input_payment_review_pages_spec.md` (입력·결제·후기)
```

각 섹션을 `grep -n "^## " docs/사주500_UIUX_상세설계서.md`로 찾아서 해당 섹션 헤더 바로 아래 위 주석 삽입. 본문 내용은 건드리지 않는다 (히스토리 보존).

---

# 충돌 해소 후 4단계 (Phase 1) 자동 착수

위 Q1~Q4 처리 완료되면 **별도 승인 없이** 바로 4단계 진행해라. 단계는 다음과 같다:

## 4단계 실행 순서

1. **`tailwind.config.ts`** 토큰 추가
   - 색상: gold-brown·gold-brown-dark·gold-brown-soft·ink·paper·gray-100~900·success·warning·error·info
   - 폰트: Pretendard Variable + sans fallback
   - 크기: text-hero (40px) 추가
   - 간격: 기존 spacing scale 유지하되 누락된 4의 배수 토큰 보완
   - **충돌 시 신규 토큰은 `brand-*` prefix** (예: `brand-gold-brown`). 기존 토큰 절대 덮어쓰기 금지.

2. **`src/components/ui/`** 공용 컴포넌트 11종 신규 생성
   - Heading.tsx
   - CTABlock.tsx
   - EmptyState.tsx
   - Toast.tsx
   - LoadingSkeleton.tsx
   - AIProgressLoader.tsx
   - KPICell.tsx
   - SinsalRow.tsx
   - ProductCard.tsx
   - ReviewCard.tsx
   - ReasonRow.tsx

   각 파일:
   - props TypeScript 타입 정의 (export type)
   - 디자인 토큰 사용 (Tailwind 클래스)
   - default props 또는 옵셔널 처리로 prop 없이도 미리보기 가능
   - 스토리북·테스트 Phase 2로 미룸

3. **검증 게이트**:
   - `npm run typecheck` PASS
   - `npm run build` PASS
   - 기존 컴포넌트와 이름 충돌 0건 (`grep -rn "Heading\|CTABlock\|..." src/components/`)
   - 실패 시 즉시 수정. 보고에 실패→수정 흐름 명시.

4. **1단계 완료 보고**:
   ```
   [PC Claude Code 1단계 완료 보고]
   - 충돌 해소: Q1~Q4 처리 결과 (이동된 파일·추가된 주석)
   - tailwind.config.ts: 추가/수정 토큰 diff 요약
   - src/components/ui/: 신규 파일 11개 리스트
   - 빌드: typecheck PASS / build PASS
   - 이름 충돌 검사: 0건
   - 다음 단계: HomePage.tsx 전면 교체 (5단계) 승인 대기
   ```

## 5단계 이상 자동 진행 금지

- 1단계 완료 보고 후 **반드시 멈춤**.
- 5단계 (HomePage 교체)는 준기가 별도 승인 paste 줄 때까지 대기.

---

# 절대 금지 (재확인)

- "UI 개편 완료"·"UX 라이팅 완료" 같은 과장 발언. **1단계는 토큰 + 컴포넌트까지만**.
- 기존 토큰·컴포넌트 덮어쓰기. 충돌 시 brand-* prefix.
- 준기 승인 없이 5단계 이상 진행.
- 준기한테 추가 질문하기 (Q1~Q4 답변 위로 다 결정됨).

---

# 시작해라

지금 바로 Q1 → Q2 → Q3 → Q4 → 4단계 순으로 실행. 보고 1번으로 충분하다.
