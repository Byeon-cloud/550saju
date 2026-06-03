# JDS — 컴포넌트 스펙 (Figma 1:1 매핑용)

> 70+ 코드 컴포넌트 → Figma 컴포넌트 props/variants 매핑
> 사장님이 Figma에서 디자인할 때 props 그대로 따라 만드시면 코드 자동 sync 가능

---

## Tier 1 — Atom (기본 빌딩 블록)

### Button
- **Variants:** `gold` / `secondary` / `ghost` / `danger`
- **Sizes:** `sm` (32h) / `md` (44h) / `lg` (52h)
- **Props:** `fullWidth`, `disabled`, `loading`
- **Touch target:** 44×44 minimum (WCAG)
- **Radius:** `lg` (8px)
- **States:** default / hover / pressed / disabled / loading

### Logo
- **변형:** navy (배경 dark용) / cream (배경 light용)
- **Size:** 20px / 24px / 600px (export)
- **SVG**: 태극 심볼 (앱 진입점)

### Pictogram (한자/심볼 시스템)
- **카테고리:** topic / oheng / extension / ui / concern
- **개별 키:** love(緣) / wealth(財) / 命 / 火 / 月 / 合 / 歲 / 業 / 進 / 緣 / 復 / 移 등
- **render method:** SVG path (이모지 X — 정책)

---

## Tier 2 — Molecule

### Modal
- **Sizes:** `sm` / `md` / `lg`
- **Header / Body / Footer** 슬롯
- **Footer 버튼 변형:** 1버튼 / 2버튼 (취소+확인) / 3버튼
- **앱인토스 강제:** 52px height 버튼, 토스 블루 #3182F6

### Toast
- **Variants:** `info` / `success` / `warning` / `error`
- **위치:** bottom-center (안전영역 위)
- **자동 dismiss:** 3초

### LockedCard
- **State:** locked / unlocked
- **잠금 시:** blur 6px + 자물쇠 SVG + CTA "잠금 해제하고 전체 보기"
- **사용:** ResultPage basic / SharePage / blur잠금 후기

### EmptyState
- **Variants:** profile / report / chat / general
- **구조:** 아이콘 + 타이틀 + 부타이틀 + CTA 버튼

### ErrorState
- **Variants:** network / ai / permission / generic
- **CTA:** "다시 시도" / "홈으로"

### TopicCTAGrid
- **5 carded** — 주제 카드 5개 (love/wealth/career/health/study)
- **각 카드:** TopicIcon + 한자 + label + score(옵션)

### Flippable
- **양면 카드** — 4기둥 본정보 ↔ 꿈/오늘 연결 해석
- **사용:** SajuMiniCard만 (LuckyCard에선 정적화 — 회귀 금지)

### ProfileSelector / ProfilePicker
- **Selector:** 인라인 가로 스크롤 (DailyFortunePage)
- **Picker:** Bottom sheet 모달 (Compat 2슬롯)

### DailyRewardBadge
- **3-state:** 미수령 (CTA) / 수령완료 / 월 한도 초과
- **Reward:** +0.1운 (=50원 상당)
- **위치:** DailyFortunePage 헤더 아래

---

## Tier 3 — Organism (사주 시각화)

### PillarCard (4기둥 카드)
- **Props:** `position` (year/month/day/time), `gan`, `ji`, `반전`(일주 본인 강조)
- **구조:**
  ```
  ┌──────────┐
  │ 천간(한자) │ ← 천간오행 컬러 블록
  │   "갑"    │ ← 한글 읽기
  │   큰 나무  │ ← 의미 풀이
  ├──────────┤
  │ 지지(한자) │
  │   "자"    │
  │   쥐      │
  └──────────┘
  ```
- **일주(나) 강조:** 골드 2px border + goldSoft 배경 + box-shadow

### SajuMiniCard (4기둥 미니)
- **2026-05-04 통일:** Daily/Topic/Daeun/Monthly/Compat 모든 페이지 동일 디자인
- **사용처:** 결과 페이지 모든 진입점에서 사주 8글자 보여줄 때

### ScoreRing
- **Props:** `score` (0-100), `color`, `size`, `label`
- **사용:** 종합 점수, 주제별 score

### ElementBar / OhengCompareBar
- **5칸 — 목/화/토/금/수**
- **Props:** counts (배열) + 부족·과잉 highlight

### OhengFlow
- **Pentagon 5각형** — 오행 상생/상극 시각화
- **Props:** strengths object

### JijangganVis
- **지지 안의 천간** 시각화 (3겹 레이어)

### DaeunTimeline
- **Props:** daeun 배열, currentAge
- **표시:** 10년 단위 갑자 + 현재 위치 마커

### MonthlyFortune
- **12개월 grid** — 강조 월 + 주의 월
- **Props:** months[12]

### TojungMonthCard
- **개별 월 카드** — TojungMonthCard 12장

### WealthFlow / HealthVis / GaewoonVis
- **주제별 전용 시각화** (재물/건강/개운)

### SinsalCard / SinsalRow
- **신살 chip + 풀이**

### RelationshipMap
- **6관계 카드** (부모/배우자/자식/형제/친구/직장)

### LuckyProfile
- **럭키 프로필** (색·방위·시간대·숫자·음식)

### ReportSection
- **재사용 섹션 컨테이너**
- **Props:** 번호(01~10), title, han(한자 emblem), conclusion(strong)

### CompatProfilePair / CompatScoreBar
- **두 사람 PillarCard 좌우 + 점수바**

---

## Tier 4 — Layout

### Header
- **back / title / right-action** 슬롯
- **Sticky top, 56px height**

### TabBar (5탭)
- **위치:** sticky bottom + safe-area
- **5칸:** 홈 / 이벤트 / **사주대화(중앙·강조)** / 보관함 / 내정보
- **Active state:** 골드 underline + bold

### BalanceBar
- **상단 mini bar** — 잔액 표시 + 충전 진입

### FooterCTA (3-part)
- **구조:** [emblem 한자] + [페이지 전체 보기] + [10운으로 시작]
- **사용:** ResultPage / TopicAnalysisPage(10주제별) / DaeunPage / MonthlyPage / CompatResultPage / TojungPage
- **emblem 매핑:**
  - report = 命 / love = 緣 / reunion = 復 / marriage = 婚 / wealth = 財
  - exam = 進 / business = 業 / career = 官 / health = 壽 / move = 移 / study = 學
  - daeun = 運 / monthly = 月 / compat = 合 / tojung = 歲

### ExtensionHero
- **5,000원 확장 페이지 hero** (대운/월운/궁합/토정 + Premium)
- **Props:** seal(한자 인장), crumb(breadcrumb), sub(서브타이틀)

---

## Tier 5 — AI 로딩 / 에러

### AILoading
- **Phase:** 만세력 → 사주 원국 → AI 해석 (3단계)
- **Props:** name, type, sajuData, steps
- **사용:** DaeunPage, MonthlyPage, CompatResultPage, TojungPage, TopicAnalysisPage

### AIProgressLoader
- **종합사주 12 sections progressive**

---

## Tier 6 — 공유 / 이벤트

### ShareModal
- **Props:** isOpen, onClose, name, **reportId (동적)**, topScore?
- **버튼:** 카톡 / 링크 복사 / 이미지 다운로드
- **2026-05-07 fix:** 정적 reportId 금지 — 실제 saved id 사용

### SajuCardExport
- **만세력 카드 export** (PNG / OG)
- **사용:** SajuCardPage

### StreakWidget / TierBModal / HeroBadge / CumulativeReceivedCard
- **이벤트 페이지 컴포넌트**

---

## Tier 7 — 광고 (앱인토스 free tier 만)

### AdSlot / BannerAd
- **조건부 노출:** `build === 'appintos' && tier === 'free'` 만
- **위치:** DailyFortunePage 결과 하단 (단일)

---

# 📐 피그마 컴포넌트 작성 가이드

## 1. Variants 작성 규칙
- Boolean props → `prop=true / false`
- Enum props → `variant=gold / secondary / ghost`
- Size → `size=sm / md / lg`

## 2. Auto Layout 필수
- 모든 카드 / 모달 / 리스트는 Auto Layout
- Padding은 token spacing 사용 (`spacing.4` = 16px)

## 3. Constraints
- 모바일 max 520px 기준
- 데스크톱은 중앙 정렬

## 4. 컴포넌트 description 필수
- 각 컴포넌트 우측 패널 description에 다음 작성:
  - **사용처:** 어느 페이지에서 사용
  - **Props:** 모든 props 명시
  - **2026-05-07 변경 주의사항** (있을 시)
