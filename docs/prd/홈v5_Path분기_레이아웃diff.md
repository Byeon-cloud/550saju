# 홈 v5 Path 분기 — 레이아웃 Diff 스펙 (v3 · 완전체)

> **2026-04-22 pm 완전체 재작성.**
> 원본 SSOT: `docs/prd/PC_인수인계_2026_04_21_단일본.md` 전 섹션 재독 후 12 gap 교정.
> 본 문서 1장 + 인수인계 단일본 2장 = **홈 v5 SSOT 전부**. 다른 문서 참조 불필요 (토큰 절약).

**대상 파일**: `src/pages/HomePage.tsx` (현 v3 · 322줄)
**선행 훅**: `src/hooks/useUserPath.ts` (2026-04-22 작성 완료)
**상태**: 준기 승인 대기 (상위원칙 #1 — 냅다 구현 금지)

---

## §0. v2 → v3 교정 12 gap

| # | v2 상태 | v3 교정 |
|---|--------|--------|
| 1 | Path D 스택 #5 = `daily` | **`tojung` (토정비결 anchor)** — 인수인계 §4-D #5 |
| 2 | sec-premium-10un 를 Path B·C 공용 | **Path B = 500원 카드 · Path C = 5000원 업셀 카드** — 별도 블록 |
| 3 | 결과 footer copy "10운으로 시작" 단건 만 기록 | **3-파트 패턴 `[합/歲/命 emblem] + [XX 전체로 보기] + [10운으로 시작]`** |
| 4 | 확장 4종 = 5000원급 | **확장 = 1~3운 (500~1500원), 10운=5000원은 별도 충전 패키지** |
| 5 | Playwright 4 시나리오 | **4 Path × 핵심 섹션 = 16 캡처 + 6 수동 시나리오 (A/B/C/D + E.13 + E.40)** |
| 6 | 적천수 7 페이지 (숫자만) | **src 6 파일 + docs 6 파일 + Cowork mockup 6 개 = 실측 분리 리스트 §8** |
| 7 | Path E 미언급 | **Path E 4종 (E13·E32·E3·E40) 앱인토스 심사 직결 — §9 등재** |
| 8 | §7 P2 5건 누락 | **블러공유 / /input재진입 / 궁합상대방저장 / /chat요금 / 데일리3원UI — §9 등재** |
| 9 | Topic 색 토큰 불언급 | **§5 토픽별 HEX (연애 #C88A95 등) — §7 참조** |
| 10 | 디자인 토큰 CLAUDE.md vs 인수인계 §5 혼재 | **인수인계 §5 가 SSOT. CLAUDE.md 는 2026-04-18 기준 구본 (Primary #A08B6A→ 실제 #B8965A)** |
| 11 | mockup 파일명 v2 일괄 | **재물만 v2, 나머지 4 주제 v1 (meta 스니펫 §1 교정)** |
| 12 | 검증 grep 5건 누락 | **자동 grep 5항목 (원/머스타드/적천수/footer/HTML 밸런스) — §10** |

---

## §1. 현 v3 HomePage 구조 매핑 (line 기준)

| 현 v3 블록 | 라인 | v5 섹션 ID | 유지·숨김·교체 |
|------------|------|------------|---------------|
| ProfileSwitcher | 49–63 | `sec-profile-switcher` | All Path 유지 |
| Pillar 1 · 오늘의 운세 | 66–97 | `sec-daily` | **A 숨김** · B/C/D 유지 + path별 보강 |
| Pillar 2 · 꿈해몽 | 100–129 | `sec-dream` | **A 숨김** · B/C/D 유지 |
| Premium 10운 (132-187) | 132–187 | `sec-10un-upsell` | **A·B 숨김** · C 업셀 · D 숨김. **Path B 에선 신규 `sec-500-entry` 로 교체** |
| 주제별 1운 | 190–215 | `sec-topic-5` | **A 숨김** · **B/C 5개 노출** · D 재배치 |
| Why 3카드 | 218–243 | `sec-moat` | **C·D 숨김** · A·B 유지 |
| Caption 4카드 | 246–276 | `sec-extensions-4` | **A·B 숨김** · C 미리보기 · **D 최상단 격상** |
| Review carousel | 279–297 | `sec-reviews` | **C·D 숨김** · A **2순위 격상** · B 간소화 |
| Footer | 300–302 | `sec-footer` | All 유지 |

**현 v3 대비 신규 블록 4종**:
- `sec-price-intro` (A 전용 가격 소개 블록 — Hero 통합 또는 독립 선택 미결정)
- `sec-input-cta` (A 전용 메인 액션)
- `sec-500-entry` (B 전용 500원 진입 카드 — Premium10 과 별도)
- `sec-event-tab` (D 전용 이벤트 탭 · streak·토스포인트 — 이미 prod `e827766` 반영됨, 홈에서도 노출 강화)

---

## §2. 인수인계 §4 Path IA SSOT

### Path A (Cold · `!hasSaju`) — 5 블록
```
1. Hero
2. Reviews 캐러셀 (신뢰)
3. Price 소개
4. Input CTA  ← 메인 액션
5. Why (차별화)
```
**숨김**: Daily · Dream · Topic5 · Extensions4 · 10un-upsell · 500-entry · event-tab · storage · chat

### Path B (Warm · `hasSaju && !hasPaidAny`) — 6 블록
```
1. Hero (간소화)
2. Daily         ← hasSaju 분기 노출
3. Dream
4. 500-entry     ← 500원 진입 카드 (신규 · 10운과 별도)
5. Topic5        ← 1운 주제 5종 그리드
6. Reviews (간소화)
```
**숨김**: 10un-upsell · Extensions4 · Moat (Why 축약) · event-tab · storage · chat

### Path C (Hot · `hasPaidAny && !hasPaid5000`) — 6 블록
```
1. Hero (최소)
2. Daily (간소화)
3. Dream
4. Topic5 (격상 · "미탐험" pulse)
5. 10un-upsell   ← 5000원 업셀 메인
6. Extensions4 (미리보기)
```
**숨김**: Reviews · Moat · 500-entry · event-tab · storage · chat

### Path D (Loyal · `hasPaid5000`) — 6 블록
```
1. Extensions4 (섹션 4.5 최상단 격상 · 미열람 강조)
2. Storage + Chat 노출 강화 (TabBar 배지·뉴 indicator)
3. event-tab (streak·토스포인트)
4. Daily (재방문 후크)
5. Tojung       ← 토정비결 독립 anchor (연 1회 · D 핵심)
6. (Reviews·Moat 숨김)
```
**숨김**: Reviews · Moat · 10un-upsell (이미 구매) · 500-entry · Topic5 (재배치 · 섹션4.5 통해 진입)

### Path E (예외) — 홈 분기 아님
라우트 가드·에러 핸들러에서 처리. §9 의 4 서브케이스 (E13·E32·E3·E40).

---

## §3. `sec-daily` Path별 분기

| Path | 노출 | 보강 copy |
|------|------|-----------|
| A | **숨김** | — |
| B | 표시 | 하단 골드 배지 "주제별로 더 깊게 →" (`/topic` CTA) |
| C | 표시 (간소화) | 배지 톤 "오늘 1회 무료" → **"오늘도 열려있어요"** (재방문자 톤) |
| D | 표시 | 하단 페이퍼 배지 "오늘 한 줄 기록 →" (저널 훅) |

---

## §4. `sec-topic-5` Path별 분기 (인수인계 §6 ③)

현 v3 grid 는 3개 (love·wealth·career). **v5 에서 5개 전체 복구**:

| id | label | HEX | 현 v3 | v5 Path B | v5 Path C |
|----|-------|-----|------|----------|----------|
| love | 연애 | `#C88A95` (桃) | ✅ | ✅ | ✅ + dim/pulse |
| wealth | 재물 | `#B8965A` (財·브랜드) | ✅ | ✅ | ✅ + dim/pulse |
| career | 직업 | `#5A7CA8` (官) | ✅ | ✅ | ✅ + dim/pulse |
| health | 건강 | `#6FA08C` (壽) | ❌ → **신규** | ✅ | ✅ + dim/pulse |
| study | 공부 | `#9C5A8A` (印) | ❌ → **신규** | ✅ | ✅ + dim/pulse |

**Path C 고유**: `getReports().filter(r => r.contentType === 'topic')` 로 소비한 topic 은 dim, 미소비는 "미탐험" pulse 배지.

---

## §5. `sec-extensions-4` Path별 분기 (인수인계 §2 / §4 SSOT)

4장 카드 실제 가격 — `5000원 프리미엄` 묶음이 아니라 각 `1~3운` 개별 구매:

| id | label | HEX | 운 | 원화 | Path C | Path D |
|----|-------|-----|----|----|-------|-------|
| monthly | 월운 | `#B5441F` (月) | 1운 | 500원 | 미리보기 | 섹션4.5 #1 |
| daeun | 대운흐름 | `#3B7A4B` (運) | 2운 | 1000원 | 미리보기 | 섹션4.5 #2 |
| compat | 궁합 | `#9C5A8A` (合) | 3운 | 1500원 | **업셀** | 섹션4.5 #3 |
| tojung | 토정비결 | `#2F4B7C` (歲) | 2운 | 1000원 | 미리보기 | **독립 anchor** (D 스택 #5) |

**Path D 에서 토정비결 특별취급**: `sec-extensions-4` 의 1 카드로 포함되면서 + 별도 `sec-tojung-anchor` 로 스택 #5 에 재노출. 연말 (11~2월) 시즌엔 더 크게.

---

## §6. 결과 페이지 footer CTA 패턴 (P0-3 · 인수인계 §6 ②)

**3-파트 고정 패턴**:
```
[page_emblem] + "XX 전체로 보기" + "10운으로 시작"
```

| 페이지 | emblem | XX |
|--------|--------|----|
| 궁합 결과 | `合` | 궁합 |
| 토정비결 결과 | `歲` | 토정비결 |
| 대운흐름 결과 | `運` | 대운 |
| 월운 결과 | `月` | 월운 |
| 1운 주제 결과 × 5 | 해당 한자 (桃·財·官·壽·印) | 주제명 |
| 10운 리포트 결과 | `命` | 전체 사주 |

**금지 copy**:
- "30운으로 시작" (묶음 할인) — 충전 페이지에서만
- "50운 추천" — 충전 페이지 전용
- 할인율·% 표기 전면 금지

---

## §7. 구현 스케치 (단일 파일 · `HomePage.tsx`)

```tsx
import { useMemo } from 'react';
import { useUserPath } from '@/hooks/useUserPath';
// ... 기존 imports

// 토큰: HomePage line 20 `const C = { ink, paper, gold, goldShimmer, ... }` 를 useMemo 바깥으로 유지
// 기존 HEX · 애니메이션 · copy 100% 보존 (퀄리티 다운그레이드 금지)

export default function HomePage() {
  const { path, ready } = useUserPath();

  // 블록 렌더 맵 — 기존 블록 함수로 추출 + 신규 4종 추가
  const BLOCKS = useMemo(() => ({
    'hero': renderHero,
    'daily': renderDaily,
    'dream': renderDream,
    '10un-upsell': render10unUpsell,
    '500-entry': render500Entry,          // ★ 신규 (Path B)
    'topic-5': renderTopic5,               // 기존 topic-3 → 5 확장
    'moat': renderMoat,                    // Why
    'extensions-4': renderExtensions4,    // Caption-4
    'reviews': renderReviews,
    'price-intro': renderPriceIntro,      // ★ 신규 (Path A)
    'input-cta': renderInputCTA,          // ★ 신규 (Path A)
    'event-tab': renderEventTab,          // ★ 이미 prod
    'storage-chat': renderStorageChat,    // ★ D 배지·뉴 indicator
    'tojung-anchor': renderTojungAnchor,  // ★ 신규 (Path D 스택 #5)
  }), []);

  // Path별 스택 — 인수인계 §4 SSOT
  const stack = useMemo<string[]>(() => {
    switch (path) {
      case 'A':
        return ['hero', 'reviews', 'price-intro', 'input-cta', 'moat'];
      case 'B':
        return ['hero', 'daily', 'dream', '500-entry', 'topic-5', 'reviews'];
      case 'C':
        return ['hero', 'daily', 'dream', 'topic-5', '10un-upsell', 'extensions-4'];
      case 'D':
        return ['extensions-4', 'storage-chat', 'event-tab', 'daily', 'tojung-anchor'];
    }
  }, [path]);

  if (!ready) return <HomeSkeleton />;

  return (
    <div style={{ background: C.paper, minHeight: '100vh', paddingBottom: 24 }}>
      <ProfileSwitcher />
      {stack.map(id => <div key={id}>{BLOCKS[id]()}</div>)}
      <Footer />
    </div>
  );
}
```

**롤백**: env flag `VITE_HOME_PATH_VARIANT_ENABLED=false` 시 기존 v3 렌더 그대로.

---

## §8. 적천수 sed 타겟 실측 리스트 (P1-5)

### src/ 6 파일
| 파일 | 라인 | 현재 copy | 치환 |
|------|------|----------|------|
| `src/components/common/AILoading.tsx` | TBD | 적천수 인용 | "출처 검토 중" |
| `src/constants/academicReferences.ts` | TBD | 적천수 항목 | 주석 처리 또는 comment 변경 |
| `src/constants/prompts.ts` | TBD | 적천수 원문 | 주의: 프롬프트 변경은 AI 품질 영향 → **일단 보류, 프롬프트 별 이슈로** |
| `src/pages/DailyFortunePage.tsx` | 271 | `『적천수』·한국 명리학 문헌 기반` | `한국 명리학 문헌 기반` 또는 "출처 검토 중" |
| `src/pages/DreamPage.tsx` | 347 | 동일 | 동일 |
| `src/pages/LoadingPage.tsx` | 35 | `'적천수(滴天髓)는 "하늘의 정수가 한 방울씩 떨어진다"는 뜻이에요. 명리학의 바이블입니다.'` | 교육용 tip 배열 — **삭제가 아닌 "한 항목만 덜어내기" 가능** |

### docs/ 6 파일 (참조용 · 사용자 노출 없음)
`AI프롬프트_v3_Sonnet4.6.md`, `명리학_레퍼런스풀.md`, `명리학_백과사전.md`, `브랜드스토리텔링.md`, `사주대화_상담UX.md`, `콘텐츠퀄리티가이드.md`, `프롬프트템플릿_v2.1.md`
→ **내부용, 한자·원문 자유** (CLAUDE.md 한자 이원화 정책). **치환 불필요.**

### Cowork mockup 6 파일 (인수인계 §7)
`연애 v1`, `직업 v1`, `건강 v1`, `공부 v1`, `대운흐름 v1`, `월운 v1` — **PC 측 sed 권한 없음** → 준기가 Cowork 에서 직접 치환.

**합계 실제 수정 타겟**: src 3~4 파일 (prompts.ts 는 보류) + Cowork 6 mockup.

---

## §9. 미등재 (구 timeline 누락 · P2 또는 런칭 직전 격상)

### 인수인계 §8 P2 · §7 5 unknown
1. 블러 공유 정책 (결과 페이지 공유 이미지 블러 유지 여부)
2. `/input` 재진입 시 프로필 동기화
3. 궁합 상대방 사주 저장 정책
4. `/chat` 요금 부과 구조
5. 데일리 3원 리워드 UI

### 인수인계 §9 앱인토스 심사 직결 · Path E 4종
1. **E13** — 결제 성공·풀이 생성 실패 원자성 (트랜잭션·롤백). **런칭 차단 요인**
2. **E32** — 공유링크 비회원 진입 시 OG 카드 정상화
3. **E3** — NotFoundPage 브랜드 일관성
4. **E40** — 입력 도중 뒤로가기 → 임시저장 + 동의 UI

이 4 건은 P2 에 등재됐으나 **앱인토스 심사 시 발견되면 탈락**. 런칭 직전 P1 격상 권장.

---

## §10. 구현 단계 (준기 승인 후)

### Phase 1 — 훅 연결 + 토큰 확인 (20분)
- [ ] `HomePage.tsx` 상단 `useUserPath` import + `ready=false` skeleton
- [ ] `C` 토큰 object 에 누락 HEX 추가 (연애·건강·공부 등 주제 색)

### Phase 2 — 블록 함수 추출 (40분)
- [ ] 기존 9 블록 → 함수로 분리 (copy·HEX·애니 100% 보존)
- [ ] 신규 4 블록 stub: `render500Entry`, `renderPriceIntro`, `renderInputCTA`, `renderTojungAnchor`, `renderStorageChat`

### Phase 3 — Path 스택 분기 (30분)
- [ ] `stack` useMemo + `BLOCKS[id]()` 렌더
- [ ] env flag 체크

### Phase 4 — 카피 변주 + topic 5 확장 (40분)
- [ ] `sec-daily` B/C/D 보강 (§3)
- [ ] `sec-topic-5` B/C 5개 + C "미탐험" pulse (§4)

### Phase 5 — 결과 footer 통일 (P0-3 · 60분)
- [ ] 9 결과 페이지 footer `[emblem + XX 전체로 보기 + 10운으로 시작]` 패턴 (§6)

### Phase 6 — QA (90분)
- [ ] 자동 grep 5: 원 표기 / #b8941f / 적천수 raw / footer 패턴 / HTML 밸런스
- [ ] 수동 6 시나리오: Path A / B / C / D / E.13 / E.40
- [ ] **16 캡처**: 4 Path × 핵심 섹션
- [ ] `design_system_v4_consolidated.md` 준수

**합계 추정**: 약 4.5 시간 (E2E 포함).

---

## §11. 미결정 (준기 콜)

| # | 이슈 | 기본값 제안 |
|---|------|------------|
| 1 | `VITE_HOME_PATH_VARIANT_ENABLED` flag 기본값 | 개발 `true` · 런칭 `true` (점진 롤아웃은 쿼리스트링) |
| 2 | `sec-price-intro` 독립 블록 vs Hero 통합 | Hero 통합 (새 컴포넌트 최소화) |
| 3 | Path D `Storage·Chat 강화` 구체 범위 | 재배치·배지만 (인수인계 §6 ③ "신규 spec X") |
| 4 | `prompts.ts` 적천수 치환 여부 | **보류** — AI 품질 A/B 비교 후 결정 (CLAUDE.md 원칙 #3) |
| 5 | CLAUDE.md 디자인 토큰 업데이트 | §-1 addendum 추가 · 인수인계 §5 SSOT 반영 |

---

## §12. 변경 이력

| 일자 | ver | 변경 |
|------|-----|------|
| 2026-04-21 | v1 | 초안 · Path A 에서 Daily/Dream 유지 |
| 2026-04-22 am | v2 | 인수인계 §4 반영 (Daily/Dream A 숨김, D 최상단) |
| 2026-04-22 pm | **v3 (현재)** | **원본 재독 12 gap 교정 · 500-entry vs 10un-upsell 분리 · footer 3-파트 패턴 · topic 5 색 · 적천수 실측 · P2 §7·Path E 등재 · 16 캡처 시나리오** |

---

**— 끝.**
