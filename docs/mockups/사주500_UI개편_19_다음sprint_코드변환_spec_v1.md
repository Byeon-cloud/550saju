# 사주500 — 다음 Sprint Spec: Mockup → React 코드 변환 v1

> **목적**: 락 진본 14 mockup을 production React 컴포넌트로 변환.
> **작성**: 2026-05-08 (현 sprint 종료 시점)
> **상위 SSOT**:
>   - `_LOCKED/01~14*.html` (14개 락 진본)
>   - `사주500_UI개편_16~18.md` (IA + archetype 매트릭스)
> **목표**: production `/topic/:id` 가 락 mockup 디자인 그대로 노출되도록.

---

## 0. 현재 상태 (2026-05-08 sprint 종료 시점)

### ✅ 완료된 것
| 영역 | 산출물 | 상태 |
|---|---|---|
| 14 Mockup 락 진본 | `_LOCKED/01~14*.html` | 100% |
| IA 매트릭스 spec | `16_주제별_고유IA_v1.md` | 100% |
| Archetype 매트릭스 | `17_재물_8archetype` + `18_이사_8archetype` | 100% |
| Production SSOT sync | 13건 (이름·색·chip 정렬) | 100% |
| Production 코드 수정 | `TopicAnalysisPage.tsx` (move chip 3, marriage 미혼/기혼) | 100% |
| AI prompt 라벨 정렬 | `claudeTopic.ts` (career·study label) | 100% |
| AI prompt archetype mandate | Universal 4 layer 룰 추가 | 100% |

### ❌ 남은 것 — 본 sprint 의 작업 범위
| 영역 | 현재 상태 | 작업 |
|---|---|---|
| **결과 페이지 React 코드** | `TopicMockupView.tsx` 912줄 generic 8섹션 | 14 mockup별 topic-specific 컴포넌트로 분기 |
| **AI prompt schema 2nd phase** | Universal mandate 만 | topicDataSchema 11개 archetype 필드 명시 |
| **TopicResultV2 type 확장** | 8섹션 generic schema | 14 mockup별 visualization 데이터 schema |

---

## 1. 결과 페이지 변환 — 핵심 작업

### 1.1 현재 vs 새 구조

**현재 구조** (`TopicMockupView.tsx`):
```
TopicMockupView (912줄)
  ├─ 8섹션 generic (主柱·八字·十神·時運·人緣·處方·吉物·日箴)
  ├─ TopicResultV2 schema 입력
  └─ 모든 10주제 동일 렌더
```

**새 구조** (14 mockup 진본 따라):
```
src/pages/topic/types/
  ├─ LoveSoloResult.tsx     (mockup 02)
  ├─ LoveSomeResult.tsx     (mockup 03)
  ├─ LoveDatingResult.tsx   (mockup 04)
  ├─ ReunionResult.tsx      (mockup 05)
  ├─ WealthResult.tsx       (mockup 06 — 8 archetype)
  ├─ ExamResult.tsx         (mockup 07 — 4 archetype)
  ├─ BusinessResult.tsx     (mockup 08 — 4 archetype)
  ├─ CareerResult.tsx       (mockup 09 — 4 archetype)
  ├─ HealthResult.tsx       (mockup 10 — 4 archetype)
  ├─ MoveResult.tsx         (mockup 11 — 8 archetype 4 layer)
  ├─ StudyResult.tsx        (mockup 12 — 8 archetype 4 layer)
  ├─ MarriageSingleResult.tsx (mockup 13 — 6 archetype)
  └─ MarriageMarriedResult.tsx (mockup 14 — 7 archetype)

TopicMockupView (entry router)
  └─ switch (topicId, branch) → renders specific component
```

### 1.2 시그니처 컴포넌트 목록 (재사용 SSOT)

각 컴포넌트가 갖는 고유 시각화:

| Mockup | 고유 시각화 |
|---|---|
| love | 도화 캘린더·5오행 매칭 / 둘 사주 + 합 강도 / 12개월 안정·위기 grid |
| reunion | 3축 점수 (연애·결혼·재회) + 헤어진 시기 timeline |
| wealth | 정재vs편재 막대 + 4분면 도넛 + 12개월 area chart |
| exam | 길성 4 슬롯 + D-day 게이지 + 4축 시험 유형 강약 |
| business | **3-stage 큐브** + **동업 트라이앵글 SVG** + 12개월 4-grid |
| career | **3축 radar** + 5오행 직무 매핑 6-cell + 인연 3 카드 |
| health | **5장기 인체 다이얼 SVG** + 12개월 health timeline |
| move | **8방위 컴퍼스 SVG** + 위험 신호 4 카드 + 평생 5단계 strip |
| study | **24h 집중 곡선 SVG** + 학습 4 phase + 약점 4 카드 |
| marriage 미혼 | **평생 path 5단계 timeline** + Pentagon 다이얼 |
| marriage 기혼 | **자녀 timeline 큰 년도 박스** + family tree grid |

### 1.3 SSOT 컴포넌트 (14 mockup 공유)

추출할 공유 컴포넌트:
```
src/components/topic/
  ├─ TopicHero.tsx          (다크 헤더 + 한자 워터마크 + chip)
  ├─ MySajuMiniCard.tsx     (사주 8글자 미니 카드 — 모든 결과 페이지)
  ├─ ConclusionBox.tsx      (◇ 한 줄 결론 + ref)
  ├─ ArchetypeCard.tsx      (active hero + 6 chip alternative)
  ├─ SectionAccordion.tsx   (섹션 헤더 + chevron + collapse)
  ├─ ScoreRing.tsx          (반원형 게이지 78/100)
  ├─ MonthlyGrid12.tsx      (12개월 4-grid 통일 패턴)
  ├─ DarkVerdictCard.tsx    (다크 결단박스 + pullquote)
  ├─ FooterActions.tsx      (Cross-topic CTA + Premium upsell + Actions)
  └─ DisclaimerCard.tsx     (의료 진단 X 같은 윤리 가드)
```

### 1.4 작업 순서 (우선순위)

**Phase 1 — SSOT 컴포넌트 추출** (1일)
1. TopicHero, MySajuMiniCard, ConclusionBox, ArchetypeCard 등 공통 8개 컴포넌트
2. design tokens 정리 (각 주제 액센트 색 SSOT)
3. autoEmphasize·sanitizeAiText 재사용

**Phase 2 — 1차 주제 변환** (3일)
- 우선 5 핵심 (재물·합격·사업·직업·건강) — 결제 funnel 큰 주제부터
- 시각화 SVG 컴포넌트 신규 작성 (8방위·5장기·3축·트라이앵글·3-stage 큐브)

**Phase 3 — 2차 주제 변환** (2일)
- 이사·학업·marriage 미혼/기혼·재회

**Phase 4 — 연애 3분기 변환** (2일)
- love 솔로/썸/연애중 — 분기 logic + chip 입력 데이터 활용

**Phase 5 — AI Schema 2nd phase** (1일)
- topicDataSchema 11개에 archetype 필드 명시
- 12 branches별 prompt 분리 (필요시)

**총 작업 시간 예상: 약 9일 (1.5주 sprint)**

---

## 2. AI Schema 2nd phase — topicDataSchema 보강

각 주제 topicDataSchema 끝에 archetype 필드 추가:

```typescript
"archetype": {
  "primary": "Layer A 한자",
  "modifier": "Layer B/C/D 보조 한자",
  "name": "한국어 archetype 이름",
  "tag": "사주 신호 한 줄",
  "description": "사주 specific 결단 1문장 (사주 글자 호명)"
}
```

### 주제별 archetype 매핑 (mockup 매트릭스 v17·v18 SSOT)

| Topic | Layer A | Layer B (위험) | Layer C (시기) | Layer D (환경) |
|---|---|---|---|---|
| wealth | 安·業·急·弱·末·早·兩·劫 | - | - | - |
| exam | 合·勞·勝·面 | - | - | - |
| business | 起·守·急·同 | - | - | - |
| career | 官·印·食·動 | - | - | - |
| health | 强·衡·弱·偏 | - | - | - |
| **move** | **動·守·變** | **浸·焰·崩·鬱** | **沖** | **急·待** |
| **study** | **印·食·文** | **雜·偏** | **急·待** | **靜** |
| marriage 미혼 | 平·早·晩 | 衝·桃 | 急·待 | - |
| marriage 기혼 | 合·衝·平 | 多·少 | - | 親·獨 |
| love·reunion | (archetype 없음 — 분기 chip만) | - | - | - |

---

## 3. TypeScript Type Schema (TopicResultV2 → TopicResult Union)

```typescript
// 현재: src/pages/topic/_topic_themes.ts
export type TopicResultV2 = {
  // generic 8섹션
  ...
};

// 새: union of 14 specific types
export type TopicResult =
  | LoveSoloResult
  | LoveSomeResult
  | LoveDatingResult
  | ReunionResult
  | MarriageSingleResult
  | MarriageMarriedResult
  | WealthResult
  | ExamResult
  | BusinessResult
  | CareerResult
  | HealthResult
  | MoveResult
  | StudyResult;

interface WealthResult {
  topicId: 'wealth';
  archetype: WealthArchetype;
  // §A
  jaeseongDist: JaeseongDistribution; // 정재/편재/식상/비겁/인성 5축
  scoreRing: { score: number; gradeLabel: string; gradeDesc: string };
  // §B
  sourceQuad: { main: number; side: number; relation: number; investment: number };
  // §C
  monthlyArea: { points: number[]; peakMonths: number[]; warnMonths: number[] };
  // §D
  spending: { categories: Array<...>; traps: Array<{ title: string; description: string }> };
  // §E
  lifeStage3: Array<{ when: string; isPeak: boolean; title: string; description: string }>;
  spotCells: Array<{ glyph: string; label: string; description: string }>;
  // §F
  verdict: { title: string; description: string };
  pullquote: string;
}

// MoveResult, StudyResult 등 동일 패턴
```

---

## 4. 회귀 방지 룰

다음 sprint 작업 시 반드시 지킬 것:

1. **락 진본 SSOT 우선** — 14 mockup HTML 디자인 그대로 React로 변환. 임의 변경 금지.
2. **이름·색·chip 통일** — production SSOT (topics.ts) 따름.
3. **Archetype 분기 mandatory** — 7 주제 (wealth/exam/business/career/health/move/study) 는 archetype 분기 렌더.
4. **시각 시그니처 보존** — 8방위 컴퍼스·5장기 다이얼·24h 곡선 등 mockup 진본 그대로 SVG 변환.
5. **이모지 0건** — 한자·SVG·컬러칩만 사용.
6. **폰트 11px floor** — 60대 가독성.
7. **AI 호출 mandate 유지** — 보일러플레이트 박멸·5 배수 점수 박멸·한자 풀이 동반.

---

## 5. 다음 단계 결단 (PD 체크포인트)

다음 sprint 시작 전 확인할 것:

- [ ] **우선순위 합의** — Phase 1 (공통 컴포넌트) 먼저 vs 1 주제 pilot 변환 먼저?
- [ ] **시간 배분** — 9일 sprint or 분할 진행?
- [ ] **결과 페이지 fallback** — 변환 진행 중 일부 주제는 기존 TopicMockupView 유지 OK?
- [ ] **테스트 전략** — 1 주제 변환 후 QA → 다음 주제 진행 (incremental) vs 모든 주제 변환 후 일괄 QA

---

## 6. 산출물 파일 (참조)

### 락 진본 14개
- `_LOCKED/01_오늘의운세_LOCKED.html`
- `_LOCKED/02~04_연애운_*_LOCKED.html` (3 분기)
- `_LOCKED/05_재회운_LOCKED.html`
- `_LOCKED/06_재물운_안정형_LOCKED.html`
- `_LOCKED/07_시험운_합격형_LOCKED.html` (라벨 = 합격·이직운)
- `_LOCKED/08_사업운_창업형_LOCKED.html`
- `_LOCKED/09_직업운_조직형_LOCKED.html`
- `_LOCKED/10_건강운_강건형_LOCKED.html`
- `_LOCKED/11_이사운_정착형_LOCKED.html` (라벨 = 이사·이동운)
- `_LOCKED/12_공부운_흡수형_LOCKED.html` (라벨 = 학업운)
- `_LOCKED/13_결혼운_미혼_적기형_LOCKED.html`
- `_LOCKED/14_결혼운_기혼_안정형_LOCKED.html`

### Spec 문서 3개
- `사주500_UI개편_16_주제별_고유IA_v1.md`
- `사주500_UI개편_17_재물_archetype_매트릭스_v1.md`
- `사주500_UI개편_18_이사_archetype_매트릭스_v1.md`
- `사주500_UI개편_19_다음sprint_코드변환_spec_v1.md` (본 문서)

### Production 코드 (sync 완료)
- `src/pages/TopicAnalysisPage.tsx` (move chip 3 + marriage 미혼/기혼)
- `src/constants/topics.ts` (10 주제 SSOT)
- `functions/src/ai/claudeTopic.ts` (라벨 정렬 + archetype mandate)

### 참고 variant (락 X)
- `사주500_UI개편_목업_1운_주제별_재물_v3_사업형.html` (IA flex 검증용)

---

## 끝.

이 문서는 다음 sprint 시작 시점의 SSOT. 14 mockup 디자인은 락이라 임의 변경 X · 코드 변환은 본 spec 따라.
