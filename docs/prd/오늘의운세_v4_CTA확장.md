# 오늘의 운세 v4 — 재설계 + 유료 CTA 확장

> DailyFortunePage 재작성. 무료 퀄리티 ↑ + 결과 하단 결제 전환 구간 신설.
> **최종 업데이트: 2026-04-19**

---

## 1. 목표

### 1.1 비즈니스
- 일일 재방문 훅 (앱 리텐션 핵심 페이지)
- 무료 이용 중에도 **주제별 심층·주간 흐름·행운 디테일** 결제 전환 구간 항시 노출
- 사주 리포트(500원)로 연결되는 풀 퍼널

### 1.2 퀄리티 바
- 무료 출력 ≥ 1800자 (현재 ~800자의 2배)
- 시간대별 흐름 스와이프
- 하단 CTA 구간 필수 (주제 4카드 + 주간 + 행운 일부잠금)
- 사주 미니 원국 시각화

---

## 2. 유저 플로우

```
홈 → 오늘의 운세 탭
  ↓
[사주 없음] 사주 입력 CTA 먼저
[사주 있음] → 프로필 선택 (1개 이상 있으면)
  ↓
[AI 분석 중 로딩]
  ↓
[결과 페이지]
  ├─ 무료 결과 10섹션
  ├─ 하단 결제 유도 구간 4종
  └─ 재방문 훅 (내일 다시)
```

---

## 3. 결과 페이지 구조 — 무료 증강 (v4.1)

**무료 티어 총 글자수 하한: 2800~3200자.**
무료만으로도 "이건 달라" 체감 → 주제별/주간 흐름 유료 전환.

### S0. 스티키 헤더 + 프로필 선택
- 뒤로가기 · "오늘의 운세" · 공유
- 상단 날짜: "4월 19일 일요일" (한글만, 한자 0)
- `ProfileSelector` 컴포넌트 (본인 기본, 복수 프로필 시 드롭다운)

### S1. 오늘의 판정 카드
```
[.card-primary]
  [점수 도넛 대형 · strokeDashoffset 애니]
  [등급 뱃지]
  [sec-title-lg "창의성이 빛나는 날"]     ← AI headline 20자
  [본문 3~4문장 · 180~240자 · text-body-lg]
  [키워드 칩 5개 · .chip-v4]
```
- 등급 ↔ 점수 연동 엄격: S=85+, A=70-84, B=55-69, C=40-54, D=0-39

### S-narrative. 오늘의 서사 (신규 · 판정 카드 바로 아래)
```
[.card-primary]
  [sec-meta "오늘의 서사"]
  [text-body-lg 본문 1000자+ · 3~4단락]
  첫 문장: "[일간]이 [오늘 간지]와 만나는 오늘,..." 같이
           사주 직접 인용으로 시작 필수.
  단락 간 빈 줄 1개. 드롭캡 금지.
```
- AI 필드: `todayNarrative` (1000자+)
- 진부한 도입 금지 (AI프롬프트_v3 V3_BASE_SYSTEM 품질 규칙)

### S2. 내 사주 미니 카드 (IX-1 4기둥 플립)
- `SajuMiniCard` 재사용 (꿈해몽 S2와 동일)
- 뒷면 메시지: AI 응답 `pillarMessages.{year|month|day|hour}` 사용 (각 150~200자+)
- 일주는 200자+, 나머지 기둥 150자+ 강제

### S3. 사주 × 오늘 연결 톤 (pull quote)
```
[.card-accent]  ← 골드 좌변
  [sec-meta "오늘의 톤"]
  [본문 300자+ / text-body-lg]
  AI 필드: sajuTone (300자+)
```
- 평범한 격언 금지. 일간/용신/대운 중 최소 2회 직접 호출.

### S4. 오행 분포 + 오늘의 강세 오행
```
[.card-secondary]
  [sec-title "오늘의 오행 흐름"]
  [OhengCompareBar primary + todayEmphasis 하이라이트]
  [해석 2~3줄 · AI: ohengFlow.insight]
```

### S5. 오늘의 점수 4영역 (IX-11 아코디언 P1 승격)
```
[.card-primary]
  [sec-title "오늘의 점수"]
  [2x2 그리드]
    재물운 78  애정운 62
    건강운 85  성장운 71
  [각 카드 탭 → 아코디언 펼침]
  [펼침 내용: AI subScoreReasons.{재물|애정|건강|성장} · 각 200자+]
```
- 아코디언 **P2 → P1 승격**: 펼침이 무료 콘텐츠의 핵심 분량.

### S6. 시간대별 흐름 (IX-8 P0 승격)
```
[.card-primary]
  [sec-title "시간대별 흐름"]
  [가로 carousel 4구간 · 현재 시각 자동 포커스]

  ┌─────────┬─────────┬─────────┬─────────┐
  │ 05~11시 │ 11~17시 │ 17~23시 │ 23~05시 │
  │ 점수 N  │ 점수 N  │ 점수 N  │ 점수 N  │
  │ 메시지  │ 메시지  │ 메시지  │ 메시지  │
  └─────────┴─────────┴─────────┴─────────┘
```
- 각 구간 `message` **80자+** 강제 (기존 2줄 → 80자+)
- IX-8 **P1 → P0 승격** (무료 필수 구현)
- 지나간 시간 opacity 0.6

### S-warn. 오늘 주의 3가지 (신규)
```
[.card-primary]
  [sec-title "오늘 주의할 것 3가지"]
  [세로 3항목]
    [sec-meta 제목 10자] (예: "오후 충동 지출")
    [본문 150자+ · 왜 주의인지 사주·오늘 간지 근거]
```
- AI 필드: `warnings: [{title, detail}] × 3` (각 detail 150자+)

### S-op. 오늘 기회 3가지 (신규)
```
[.card-primary]
  [sec-title "오늘 놓치면 아쉬운 것 3가지"]
  [세로 3항목]
    [sec-meta 제목 10자] (예: "오전 중요 대화")
    [본문 150자+ · 구체 행동·시간대·맥락]
```
- AI 필드: `opportunities: [{title, detail}] × 3`

### S-lucky. 오늘의 행운 프로필 (전부 무료)
```
[.card-primary]
  [sec-title "오늘의 행운 프로필"]
  [2x2 그리드, 4카드 · Flippable 전부 공개]

    [행운의 색]         [행운의 숫자]
    name·hex·reason     N(1~9)·reason
    (reason 100자+)     (reason 100자+)

    [행운의 방위]       [보충 오행]
    8방위·reason        오행·reason
    (reason 100자+)     (reason 100자+)

  [하단: CompassDrag — 행운의 방위 시각화 (IX-9 P1)]
```
- **4개 모두 무료 공개** — 기존 1공개+3잠금 삭제
- AI 필드: `luckyProfile.{color|number|numberReason|direction|directionReason|element|elementReason}`
- 각 reason **100자+** 강제
- IX-9 나침반은 이 섹션 내부에 배치 (기존 독립 S7 제거)

### S-donts. 해야 할 것 / 피해야 할 것
```
[.card-primary]
  [2열 그리드]
    좌: 해야 할 것 3개 · 각 50자+
    우: 피해야 할 것 3개 · 각 50자+
```
- AI 필드: `doList[3]`, `dontList[3]` (각 50자+ 강제, 기존 50자 이내 → 50자+)

### S-oneliner. 오늘 한 줄
```
[.card-accent]
  [sec-meta "오늘 한 줄"]
  [인용구 50자]
```
- AI 필드: `oneLiner` (50자 내외)

---

## 4. 결제 유도 구간 (S10 하위 2구간 — v4.1 축소)

**v4 → v4.1 변경**: 4 CTA → 2 CTA. 풀 리포트는 페이지 맨 하단 1회 별도.

### 4.1 주제별 심층 4카드 (IX-5 P0)

```
[.card-secondary 배경]
  [sec-title-lg "더 깊이 알고 싶다면"]
  [sec-caption "주제별로 사주 × 오늘 심층 분석"]

  [2x2 그리드]
  ┌──────────────────┬──────────────────┐
  │ 연애·결혼         │ 재물·투자         │
  │ 만남·고백 타이밍 │ 돈 움직이는 날    │
  │ 1운 (500원)      │ 1운 (500원)      │
  ├──────────────────┼──────────────────┤
  │ 취업·커리어       │ 건강·활력         │
  │ 승진·이직 흐름   │ 컨디션 포인트    │
  │ 1운 (500원)      │ 1운 (500원)      │
  └──────────────────┴──────────────────┘
```
- 꿈해몽과 동일 `TopicCTAGrid` 컴포넌트
- 탭 → `TopicAnalysisPage` 라우팅 + 결제 플로우
- AI: `generateTopicAnalysis` (Sonnet 4.6)

### 4.2 이번 주 흐름 잠금 카드

```
[.card-locked]
  [공개 제목: "이번 주 7일 가이드"]
  [공개 서브: "매일 달라지는 컨디션·기회·주의"]
  [블러 영역: 7개 요일 카드 미리보기 블러]
  [cta: "이번 주 흐름 열기 (1운)"]
```
- 결제 상품 = `generateWeeklyFortune` (Sonnet 4.6 + 2차 리뷰)

### 4.end 사주 리포트 풀 CTA (페이지 맨 하단 1회)

```
[.card-navy-v4]
  [아이콘: 사주 픽토그램]
  [sec-title "아직 사주 리포트 안 받아보셨나요?"]
  [본문 "오늘 운세보다 10배 깊은 분석. 10개 섹션 종합 리포트."]
  [cta-gold "사주 리포트 받기 (500원/1운)"]
```
- 이미 리포트 구매한 유저에게는 숨기기 (Firestore `users/{uid}/reports/` 체크)
- **화면당 card-navy-v4 1회 원칙** 준수: S-lucky·S-warn 등은 card-primary 로 통일

### 삭제 — v4 → v4.1

- ~~4.3 행운 프로필 부분잠금 (숫자·방위·오행 잠금)~~ → S-lucky 로 전부 무료 이동
- ~~4.4 풀 리포트 CTA 독립 섹션~~ → 4.end 로 단일화 (페이지 맨 하단)

---

## 5. 사주 없음 유저 플로우

오늘의 운세는 **사주 없으면 작동 불가** (일간·오행 계산이 본질).
→ 진입 시 **인풋 유도 페이지**로 리디렉트:

```
[.card-navy-v4 전체 화면]
  [sec-title-lg "오늘의 운세는 사주 기반이에요"]
  [본문 "생년월일만 있으면 1분. 무료입니다."]
  [cta-gold "사주 무료 입력 →"]
  [cta-ghost "나중에 할게요 → 일반 오늘 운세"]
```

일반 오늘 운세(사주 없이) = 간소화 버전 — 띠·별자리 기반. 이건 v4 범위 밖 (차후 고려).

---

## 6. 인터랙션 요약 (v4.1)

| ID | 인터랙션 | 페이지 위치 | 우선순위 |
|---|---|---|---|
| IX-1 | 4기둥 플립 + pillarMessages | S2 | P0 |
| IX-4 | 행운 프로필 4카드 플립 (전부 무료) | S-lucky | P0 |
| IX-5 | 주제 4카드 스와이프 | S10.1 | P0 |
| IX-8 | 시간대 carousel (현재시각 포커스) | S6 | **P0 승격** |
| IX-11 | 점수 4영역 아코디언 (reason 펼침) | S5 | **P1 승격** |
| IX-9 | 나침반 드래그 | S-lucky 내부 | P1 |

---

## 7. AI 출력 JSON 스키마 v4.1 — 오늘의 운세 (사주 있음)

**서버 SSOT**: `functions/src/ai/promptsV3.ts · DAILY_FORTUNE_USER_V3`
**총 글자수 하한 2800자+** 강제.

```typescript
interface DailyFortuneResult {
  date: string                 // "2026-04-19"
  title: string                // 오늘 운세 제목 20자
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  overallScore: number         // 0-100, grade 와 엄격 연동:
                               // S=85+, A=70-84, B=55-69, C=40-54, D=0-39
  keywords: string[]           // 5개

  todayNarrative: string       // 1000자+, 3~4단락
                               // 첫 문장: "[일간]이 [오늘 간지]와 만나는 오늘," 강제
                               // 대운·용신 최소 2회 · 신살 고유명사 권장

  sajuTone: string             // 300자+, 평범한 격언 금지

  pillarMessages: {
    year: string               // 150자+
    month: string              // 150자+
    day: string                // 200자+  ← 가장 강조
    hour: string | null        // 150자+ (시주 없으면 null)
  }

  ohengDistribution: {
    목: number; 화: number; 토: number; 금: number; 수: number
  }
  todayOhengEmphasis: '목' | '화' | '토' | '금' | '수'

  subScores: {
    재물운: number; 애정운: number; 건강운: number; 성장운: number
  }
  subScoreReasons: {
    재물운: string             // 200자+ · 사주·대운·오늘 간지 근거
    애정운: string             // 200자+
    건강운: string             // 200자+
    성장운: string             // 200자+
  }

  timeSlots: Array<{
    slot: '05~11시' | '11~17시' | '17~23시' | '23~05시'
    score: number
    message: string            // 80자+
  }>  // 4개

  warnings: Array<{
    title: string              // 10자
    detail: string             // 150자+
  }>  // 3개

  opportunities: Array<{
    title: string              // 10자
    detail: string             // 150자+
  }>  // 3개

  luckyProfile: {              // 전부 무료
    color: {
      name: string
      hex: string
      reason: string           // 100자+
    }
    number: number             // 1~9
    numberReason: string       // 100자+
    direction: '동' | '서' | '남' | '북' | '동남' | '동북' | '서남' | '서북'
    directionReason: string    // 100자+
    element: '목' | '화' | '토' | '금' | '수'
    elementReason: string      // 100자+
  }

  doList: string[]             // 3개, 각 50자+
  dontList: string[]           // 3개, 각 50자+

  oneLiner: string             // 50자 내외
}
```

### 7.1 구버전(v4) 삭제/이동 필드
- ~~`score`~~ → `overallScore` 로 변경
- ~~`headline`~~ → `title` 로 변경
- ~~`summary`~~ → `todayNarrative` 로 확장 (200자 → 1000자+)
- ~~`ohengFlow.insight`~~ → `ohengDistribution` + `todayOhengEmphasis` 로 분리
- ~~`scores.desc`~~ → `subScoreReasons` 별도 필드 (200자+)
- ~~`timeSlots[].tip`~~ → `timeSlots[].message` (80자+ 강제)
- ~~`luckyDirection.desc`~~ → `luckyProfile.directionReason` 로 통합
- ~~`dailyMessage`~~ → `oneLiner` 로 변경 (150자 → 50자, 압축)
- **신규**: `pillarMessages` / `warnings[3]` / `opportunities[3]` / `luckyProfile.{number,direction,element}` + 각 reason

---

## 8. 컴포넌트 계약

### 8.1 재사용 (꿈해몽과 공유)
- `SajuMiniCard` (4기둥 플립)
- `Flippable` (범용 플립 카드)
- `LockedCard` (블러 잠금)
- `TopicCTAGrid` (주제 4카드)
- `OhengCompareBar` — 오늘의 운세에서는 **1개 바**만 사용 (내 사주 분포 + 오늘 강세 포인트 표시)

### 8.2 신규
```
src/components/common/TimeSlotCarousel.tsx
  - props: { slots: TimeSlot[4], currentHour: number }
  - drag="x" + 스냅, 현재 시각 자동 포커스

src/components/common/CompassDrag.tsx
  - props: { direction: Direction, desc: string, draggable?: boolean }
  - SVG 나침반, 드래그 후 스프링 복귀

src/components/common/ScoreAccordion.tsx (P2)
  - props: { scores: Score[] }
  - 탭 시 펼침
```

### 8.3 수정 대상
```
src/pages/DailyFortunePage.tsx        — 전면 재작성
src/services/ai/dailyFortune.ts       — Sonnet 4.6 전환
functions/src/index.ts                — generateWeeklyFortune 신규
src/constants/prompts.ts              — v3 프롬프트
```

---

## 9. 어뷰징 · 쿼터

### 9.1 오늘의 운세 (무료)
- 일 1회 (무제한 아님). 기존 정책 유지
- Firestore: `users/{uid}/dailyFortune/{YYYY-MM-DD}` 캐싱
- 당일 재진입 시 캐시 반환 → 비용 절감

### 9.2 신규 상품 (v4.1 축소)
- 주제별 심층: 1운 (500원) / 건당 — `generateTopicAnalysis`
- 이번 주 흐름: 1운 (500원) / 주 1회 — `generateWeeklyFortune`
- ~~행운 프로필 상세~~: **무료 통합** — AI 응답에 전부 포함
- 풀 리포트: 1운 (500원) — `generateReport` (페이지 맨 하단 CTA 1회)

---

## 10. 에러 화면 공통 스펙 (꿈해몽과 동일)

`ErrorState` 컴포넌트 (`src/components/common/ErrorState.tsx`) 공용.

```
[.card-primary 중앙 정렬]
  [상단: 심플 아이콘 · ui:alert 또는 ui:retry]
  [sec-title-lg "해석을 가져오지 못했어요"]
  [text-body-md "잠시 후 다시 시도해주세요"]
  [text-body-sm "운은 차감되지 않았습니다" · 서버 트랜잭션 롤백 확인 안내]
  [cta-gold "다시 시도" · 52px]
  [cta-ghost "뒤로가기" · 52px]
```

**금지**:
- `card-navy-v4` 에러 배경 금지 (위압감 · 상업적 느낌)
- `Pictogram k="dream:empty"` 식 도메인 특화 픽토그램 금지 — 공용 ui:alert 또는 ui:retry
- 0점/A등급 fallback 렌더 금지 — 반드시 이 에러 화면으로

**로직**:
- AI 호출 실패 시 운 차감 없음 (서버 트랜잭션 롤백 · 클라 환불 금지)
- 재시도 버튼 = 같은 엔드포인트 재호출
- 뒤로가기 = 프로필 선택 화면 or 홈

---

## 11. 인수 기준 (v4.1)

Claude Code PR 체크리스트:

### 11.1 기능
- [ ] 사주 있는 유저 모든 신규 섹션(S-narrative / S-warn / S-op / S-lucky / S-donts / S-oneliner) 정상
- [ ] 일 1회 서버 캐싱 작동 (Firestore `users/{uid}/dailyFortune/{YYYY-MM-DD}`)
- [ ] 주제별 4카드 결제 플로우 정상
- [ ] 주간 흐름 잠금 → 결제 → `generateWeeklyFortune` 호출
- [ ] 풀 리포트 CTA 구매 이력에 따라 숨김 처리
- [ ] 에러 화면은 `ErrorState` 사용 (card-navy-v4 0건)

### 11.2 인터랙션
- P0: IX-1 (4기둥 플립 + pillarMessages) · IX-4 (Lucky 4카드 플립) · IX-5 (주제 4카드) · IX-8 (시간대 carousel)
- P1: IX-11 (점수 4영역 아코디언) · IX-9 (나침반 드래그)

### 11.3 디자인
- [ ] 디자인시스템_v4 체크리스트 전부 통과
- [ ] UI 라벨·섹션 헤더 한자 0%
- [ ] 등급 컬러 v4 (S 골드 / A 딥골드 / B 네이비 / C 브라운 / D 딥레드)
- [ ] `card-navy-v4` 화면당 1회만 (풀 리포트 CTA 4.end 전용)

### 11.4 콘텐츠 — 무료 총 분량 하한 **2800~3200자**
- [ ] `todayNarrative` ≥ 1000자
- [ ] `sajuTone` ≥ 300자
- [ ] `pillarMessages.day` ≥ 200자 / 나머지 기둥 각 ≥ 150자
- [ ] `subScoreReasons.{재물|애정|건강|성장}` 각 ≥ 200자
- [ ] `timeSlots[].message` 각 ≥ 80자 (4구간 × 80 = 320자+)
- [ ] `warnings[].detail` · `opportunities[].detail` 각 ≥ 150자 (6항목 × 150 = 900자+)
- [ ] `luckyProfile.{color|number|direction|element}.reason` 각 ≥ 100자 (4 × 100 = 400자+)
- [ ] `doList` · `dontList` 각 50자+ (6 × 50 = 300자+)

### 11.5 품질 (AI프롬프트 v3 BASE 규칙)
- [ ] 진부한 도입 금지어 0건 (예: "양의 기운이 충만한", "~에 집중하세요")
- [ ] 일간/용신/대운 직접 호출 최소 3회 이상
- [ ] 일반론 금지 — "이 문장이 다른 누구에게도 쓸 수 있는가?" 테스트 통과
- [ ] SELF_REVIEW_V3 2차 리뷰 통과

---

## 11. 관련 PRD

- `디자인시스템_v4.md`
- `꿈해몽_v4_재설계.md`
- `AI프롬프트_v3_Sonnet4.6.md`
- `프리미엄_티저블러.md`
- `한자노출_정책.md`

---

**🔚 오늘의 운세 v4 스펙 확정. 꿈해몽과 컴포넌트 공유로 개발 효율 ↑.**
