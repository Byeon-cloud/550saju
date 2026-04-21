# HomePage.tsx 전면 개편 스펙

**목적:** 첫 진입 3초 안에 "사주 500원 · 퀄리티 · 왜 여기인지"를 전달하고, 즉시 입력 or 체험으로 유도.
**적용 기준:** `design_system_v4_consolidated.md` 전면.
**전제:** 현재 HomePage는 "경쟁사 3사 공통 UI" 상태 추정 (handover 0 hit, 로컬 체감 "안 바뀐 것 같다"). 아래 스펙으로 **전면 교체**.
**작성일:** 2026-04-20.

---

## 레이아웃 (위→아래 섹션 순서)

```
1. 히어로 (첫 3초 승부처)
2. 오늘의 운세 — 항상 무료 · 영구 (카드 1)
3. 꿈해몽 입구 (카드 2, 블러잠금 미끼)
4. 신살 한줄 (브랜드 자산 전시)
5. 500원 · 5000원 상품 매트릭스 (2카드)
6. 후기 캐러셀 (5종 v1, 블러잠금 미포함 압축)
7. 왜 사주500인지 (해자 3요소 한 줄씩)
8. 하단 고정 CTA (항상 "내 사주 풀어보기 · 500원")
```

전체 페이지 스크롤 길이 타겟: **iPhone 15 Pro Max 기준 2.5 화면분량 (약 1600px)**. 너무 길면 탐색 피로.

---

## 섹션 1 — 히어로

### 구조
```tsx
<section className="relative pt-6 pb-8">
  <div className="mx-auto max-w-[428px] px-5">
    <span className="text-xs font-semibold text-gold-brown uppercase tracking-[0.12em]">
      한국 최저가 사주
    </span>

    <h1 className="mt-3 text-hero text-ink font-bold leading-[1.15]">
      내 사주, 500원에 제대로.
    </h1>

    <p className="mt-4 text-base text-gray-700 leading-[1.7]">
      한자만 던지지 않습니다. 도화살·화개살·천을귀인—<br/>
      왜 그게 내 얘기인지까지 풀어드립니다.
    </p>

    {/* KPI 3줄 — 신뢰 확보 */}
    <dl className="mt-6 grid grid-cols-3 gap-3">
      <KPICell label="평균가 대비" value="1.5%" />
      <KPICell label="풀이 분량" value="2,800자" />
      <KPICell label="시간 보정" value="±30분" />
    </dl>

    {/* 주 CTA 2개 */}
    <div className="mt-8 flex flex-col gap-3">
      <PrimaryCTA href="/input">내 사주 풀어보기</PrimaryCTA>
      <SecondaryCTA href="/today">오늘의 운세 먼저 보기</SecondaryCTA>
    </div>
  </div>
</section>
```

### 주요 디테일
- 배경: `bg-paper`, 상단 왼쪽에 미세한 골드브라운 점 그라디언트 (투명도 8%) 1개.
- `KPICell` 구조: `text-2xl font-bold text-ink` (숫자) + `text-xs text-gray-500` (라벨).
- "한자만 던지지 않습니다" 문장은 경쟁사 차별화 선언.
- 하단 CTA는 **2개만**. 3개 이상 금지 (결정 피로).

### 카피 대안 A/B
- A (기본): "내 사주, 500원에 제대로."
- B (회의론자): "사주 500원. 풀이는 10만원처럼."

**권장 A.** 단정·짧음·가격-품질 대비 한 번에.

---

## 섹션 2 — 오늘의 운세 (영구 무료)

### 구조
```tsx
<section className="py-8">
  <Heading level={2} eyebrow="매일 무료" title="오늘의 운세" />

  <Card tier="primary" className="mt-4">
    {/* 어제 본 사용자: 사주 미니카드 + 오늘 요약 3줄 */}
    {hasSaju ? (
      <>
        <SajuMiniCard compact />
        <p className="mt-4 text-base text-paper leading-[1.7]">
          {todayHeadline} {/* 예: "오늘은 관계에서 전환점이 오는 날입니다." */}
        </p>
        <button className="mt-5 w-full h-[52px] rounded-xl bg-gold-brown text-white font-semibold">
          오늘의 풀이 전체 보기
        </button>
      </>
    ) : (
      /* 신규: CTA 우선 */
      <>
        <p className="text-base text-paper leading-[1.7]">
          생년월일·시간만 넣으면, 매일 무료로 오늘의 운세를 풀어드립니다.
        </p>
        <button className="mt-5 w-full h-[52px] rounded-xl bg-gold-brown text-white font-semibold">
          내 사주 입력하고 시작
        </button>
      </>
    )}
  </Card>
</section>
```

### 원칙
- 오늘의 운세는 **절대 유료화 안 함** (pricing v3.1).
- 신규 유저에게도 "매일 무료"라는 점을 눈에 박음.
- 카드 tier primary (검정 배경, 한지 느낌 X).

---

## 섹션 3 — 꿈해몽 입구 (블러잠금 미끼)

### 구조
```tsx
<section className="py-8">
  <Heading
    level={2}
    eyebrow="꿈을 기록하면"
    title="당신의 사주로 풀어드립니다"
    description="같은 꿈도 사주가 다르면 뜻이 달라집니다."
  />

  <Card tier="secondary" className="mt-4">
    <div className="flex gap-4 items-start">
      <Icon name="Moon" className="w-10 h-10 text-gold-brown flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-gray-700 leading-[1.7]">
          어젯밤 물이 나오는 꿈을 꿨다면 · <br/>
          水 기운이 강한 일간에겐 재물, 木 일간에겐 감정의 흐름.
        </p>
        <div className="mt-3 h-2 rounded-full bg-gradient-to-r from-gold-brown-soft to-gray-200 overflow-hidden">
          <div className="h-full w-[38%] bg-gold-brown" />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          미리보기 2800자 중 일부만 공개
        </p>
      </div>
    </div>

    <button className="mt-5 w-full h-[52px] rounded-xl bg-white border border-ink text-ink font-semibold">
      내 꿈 풀어보기 · 무료
    </button>
  </Card>
</section>
```

### 원칙
- 꿈해몽 무료 티어 체험이 곧 블러잠금 Aha로 연결됨 — 전환 핵심 경로.
- 카드에 실제 미리보기 문장 1줄 박음. 추상적 설명 금지.

---

## 섹션 4 — 신살 한줄 (브랜드 자산 전시)

### 구조
```tsx
<section className="py-8">
  <Heading level={3} eyebrow="사주500의 언어" title="신살, 왜 내 얘기인지" />

  <ul className="mt-4 space-y-3">
    <SinsalRow name="도화살" short="인연 에너지가 과잉되는 시기" />
    <SinsalRow name="화개살" short="혼자 깊이 파는 시간" />
    <SinsalRow name="천을귀인" short="결정적 순간 들어오는 사람" />
    <SinsalRow name="관살 혼잡" short="직장에서 눈치 보는 이유" />
    <SinsalRow name="공망" short="노력이 비는 해" />
  </ul>

  <p className="mt-4 text-xs text-gray-500 leading-6">
    사주500은 한자만 던지지 않습니다. 왜 내 얘기인지까지 풀어드립니다.
  </p>
</section>
```

### SinsalRow 구조
```tsx
<li className="flex items-baseline gap-3 border-b border-gray-100 pb-3">
  <span className="text-base font-semibold text-ink min-w-[84px]">{name}</span>
  <span className="text-sm text-gray-700">{short}</span>
</li>
```

### 원칙
- 한자 병기는 `SinsalRow` 이름 우측에 작은 회색 글씨 (예: 도화살 <small>桃花</small>). 강제 노출 X, hover 시 등장 옵션.
- 신살 5개는 브랜드 자산 (feedback_shinsal_terms).

---

## 섹션 5 — 500원 · 5000원 상품 매트릭스

### 구조
```tsx
<section className="py-8">
  <Heading level={2} eyebrow="가격 구조" title="무료부터 5,000원까지" />

  <div className="mt-4 grid grid-cols-1 gap-3">
    <ProductCard
      tier="free"
      title="오늘의 운세"
      price="무료 · 영구"
      bullets={["매일 새로 풀이", "사주 기반 개인화"]}
      cta={{ label: "오늘 풀이", href: "/today" }}
    />
    <ProductCard
      tier="500"
      title="주제별 심층"
      price="500원 · 1운"
      bullets={["연애·재물·직장 등 주제 선택", "6대 원전 기반 딥 풀이", "2,800자 이상"]}
      cta={{ label: "500원 풀이", href: "/topic" }}
      highlight
    />
    <ProductCard
      tier="5000"
      title="프리미엄 종합 리포트"
      price="5,000원 · 10운"
      bullets={["대운 10년 리딩", "관계망 아카이브", "평생 열람"]}
      cta={{ label: "5,000원 리포트", href: "/report" }}
    />
  </div>
</section>
```

### ProductCard 디테일
- `tier="500"` + `highlight` 시 테두리 gold-brown + "지금 이 상품 1위" 뱃지.
- 가격 옆에 회색 취소선으로 **경쟁사 평균가 ₩32,400** 병기 (500원 상품에만).
- CTA 버튼은 52px, 주 상품은 `bg-gold-brown`, 나머지는 `bg-white border`.

---

## 섹션 6 — 후기 캐러셀

### 구조
```tsx
<section className="py-8">
  <Heading level={2} eyebrow="실제 사용자" title="블러잠금 후기 5종" />

  <div className="mt-4 -mx-5 overflow-x-auto snap-x snap-mandatory flex gap-3 px-5 pb-2">
    <ReviewCard persona="민지 27" stars={5} snippet="500원인데 10만원짜리..." />
    <ReviewCard persona="동현 33" stars={5} snippet="디자이너인데 UX에 감탄..." />
    <ReviewCard persona="수빈 29" stars={5} snippet="이직 전에 봤는데..." />
    <ReviewCard persona="재훈 31" stars={4.5} snippet="결혼 앞두고..." />
    <ReviewCard persona="은정 42" stars={5} snippet="자영업 10년 만에..." />
  </div>
</section>
```

### 원칙
- 후기 5종은 `blurred_reviews_seed_v1.md`에서 1줄 압축 스니펫만 홈에 노출.
- 전체 후기·블러 해제는 별도 `/reviews` 페이지.
- 5점 별점은 별 아이콘이지만 색상 gold-brown + 크기 16px (과시 금지).

---

## 섹션 7 — 왜 사주500 (해자 3요소)

### 구조
```tsx
<section className="py-8">
  <Heading level={2} eyebrow="왜 사주500인지" title="셋만 보세요" />

  <ul className="mt-4 space-y-4">
    <ReasonRow
      icon="Scale"
      title="한국 최저가"
      description="평균가 32,400원. 우리는 500원. 1.5%로 같은 전문성을."
    />
    <ReasonRow
      icon="BookOpen"
      title="6대 원전 기반"
      description="명리학 고전 6권을 근거로 풀이합니다. 감이 아니라 이론으로."
    />
    <ReasonRow
      icon="Clock"
      title="±30분 진태양시 보정"
      description="한국 출생자만 필요한 시간 보정. 경계 시간대 시주 오류 0."
    />
  </ul>
</section>
```

### ReasonRow 구조
```tsx
<li className="flex gap-4">
  <div className="w-10 h-10 rounded-full bg-gold-brown-soft/40 flex items-center justify-center flex-shrink-0">
    <Icon name={icon} className="w-5 h-5 text-gold-brown" />
  </div>
  <div>
    <h3 className="text-base font-semibold text-ink">{title}</h3>
    <p className="mt-1 text-sm text-gray-700 leading-[1.7]">{description}</p>
  </div>
</li>
```

---

## 섹션 8 — 하단 고정 CTA (sticky)

### 구조
```tsx
<div className="sticky bottom-0 inset-x-0 z-20 bg-paper/95 backdrop-blur-sm border-t border-gray-100 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
  <button className="w-full h-[52px] rounded-xl bg-gold-brown text-white text-base font-semibold">
    내 사주 풀어보기 · 500원
  </button>
</div>
```

### 원칙
- 스크롤 시 항상 노출, 유일한 "결정 유도" 구간.
- 라벨은 **가격 포함**. 가격 숨기면 유저 저항 증가.

---

## 로딩·에러·엠프티 상태

### 홈 최초 로드
- 각 섹션별 `<LoadingSkeleton variant="card" />` 1~2초.
- 사용자 사주 없음 → 섹션 2·3이 "신규" 버전으로 자동 스왑.

### 네트워크 에러
```tsx
<EmptyState
  icon={<Icon name="WifiOff" />}
  title="연결이 느립니다"
  description="네트워크 상태를 확인한 뒤 다시 시도해주세요."
  action={{ label: "다시 불러오기", onClick: retry }}
/>
```

### 데이터 엠프티 (오늘의 운세 생성 전)
```tsx
<EmptyState
  icon={<Icon name="Sparkles" />}
  title="오늘의 풀이가 준비되는 중입니다"
  description="매일 자정에 새로 만들어집니다. 잠시만 기다려주세요."
/>
```

---

## 인터랙션 & 애니메이션

- 첫 진입 시 섹션 1 히어로는 즉시 노출 (애니메이션 X).
- 섹션 2~7은 `IntersectionObserver` 기반 `opacity-0 → opacity-100 translate-y-2 → 0` 300ms 이내.
- 스크롤 시 상단 로고는 투명 배경 → 스크롤 40px 이후 `bg-paper/95 backdrop-blur-sm` 전환.
- `ProductCard` 탭 시 0.98 scale 1초 내 복귀 (tactile feedback).

---

## 접근성 (WCAG AA)

- 모든 섹션 `<section>` + `<h2>` 구조.
- CTA 버튼 `aria-label` 필수 (예: "내 사주 풀어보기, 500원에 풀이를 받습니다").
- 후기 캐러셀 좌우 버튼 추가 (키보드 네비게이션).
- 애니메이션 `prefers-reduced-motion: reduce` 존중.

---

## 구현 순서 (Claude Code 할 일)

1. 디자인 토큰을 `tailwind.config.ts`에 반영 (색상·폰트·간격·높이).
2. 신규 공용 컴포넌트 5종 구현: `Heading`, `CTABlock`, `EmptyState`, `Toast`, `LoadingSkeleton`, `AIProgressLoader`, `KPICell`, `SinsalRow`, `ProductCard`, `ReviewCard`, `ReasonRow`.
3. `HomePage.tsx` 전면 교체. 기존 코드는 `HomePage.legacy.tsx`로 백업.
4. 이미지/아이콘 자산: lucide 기본 + 오행 SVG 5개 추가.
5. 데이터 훅: `useTodayFortune`, `useUserSaju` 기존 재사용.
6. Storybook 추가 (없으면 생략, 추후 Phase 2).
7. E2E 테스트: Playwright 1건 — "신규 유저 → 입력 CTA 클릭 → 입력 페이지 진입".

**예상 작업량:** 집중 세션 4~6시간.
