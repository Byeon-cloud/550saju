# PC Claude Code에 한 번에 붙여넣을 지시문

> **사용법 (준기용):**
> 1. 이 파일을 연다 (VSCode/메모장 아무거나).
> 2. **Ctrl+A → Ctrl+C** 전체 복사.
> 3. PC의 Claude Code 창에 **Ctrl+V → Enter** 한 번.
> 4. 끝. 나머지는 PC Claude Code가 알아서 파일 만들고, 충돌 스캔하고, 1단계 실행함.

---

# PC CLAUDE CODE에게 — 이 아래 전부가 지시문

아래 순서대로 **전부 네가 직접 실행**한다. 준기한테 "파일 복사해주세요" 같은 부탁 금지.

## 0단계 — 컨텍스트 확인

- 작업 브랜치: 현재 브랜치 그대로. 새 브랜치 필요하면 `redesign/v4-consolidated` 생성.
- 현재 repo 루트 확인: `pwd` 출력.
- `docs/` 디렉토리 존재 확인: 없으면 `mkdir -p docs` 먼저.

## 1단계 — 아래 4개 스펙 파일을 `docs/`에 직접 write

`Write` 툴로 아래 4개 파일을 그대로 (코드펜스 내부 내용만) `docs/` 경로에 생성해라. 각 파일은 `===== FILE: ... =====` 로 시작하고 `===== END FILE =====` 로 끝난다. 사이에 있는 내용 전체를 해당 파일명으로 저장.

===== FILE: docs/design_system_v4_consolidated.md =====
# 디자인 시스템 v4 통합 — 사주500 전체 적용 기준

**목적:** 홈·입력·결제·후기·결과 5페이지 전체 적용할 단일 기준표. 기존 `docs/prd/디자인시스템_v4.md`와 이 세션의 8원칙·한자 이원화·금지어·v4.1 보정을 **단일화**.
**적용 범위:** 모든 페이지·모든 컴포넌트. "결과 페이지만 반영되고 홈은 안 반영됨" 같은 갭 재발 금지.
**작성일:** 2026-04-20.

---

## 1. 디자인 토큰 (Tailwind config 기준)

### 색상
```
주 컬러 1개:
- gold-brown:      #A08B6A   (사주500 브랜드 주 컬러)
- gold-brown-dark: #7A6648   (호버·활성)
- gold-brown-soft: #D4C4A8   (소프트 강조·배경 하이라이트)

중립 2개:
- ink:    #1A1A1A   (배경 · 한자풍 먹빛)
- paper:  #F8F5EE   (본문 배경 · 한지풍 아이보리)

중립 보조:
- gray-900: #2A2A2A (카드 배경·다크)
- gray-700: #4A4A4A
- gray-500: #8A8A8A (본문 보조)
- gray-300: #C8C8C8 (구분선)
- gray-100: #F0EDE5 (소프트 배경)

시스템 색:
- success: #5E8C5A (묵록)
- warning: #B08950
- error:   #8B4A3A (묵적)
- info:    #5A7A8C
```

**규칙:** 보라핑크·네온·파스텔 금지. 그라디언트 금지 (필요 시 `#A08B6A → #7A6648` 매우 미세하게만). 이모지는 본문에 안 쓴다 — 아이콘은 lucide-react로 통일.

### 폰트
```
폰트 패밀리:
- font-sans: "Pretendard Variable", "AppleSDGothic", sans-serif
- font-serif: (사용 안 함 · 명조체 금지)

크기 (본문 16~17px 기준):
- text-xs: 12px / leading-5   (캡션·뱃지)
- text-sm: 14px / leading-6   (보조)
- text-base: 16px / leading-[1.7]  (본문 기본)
- text-lg: 17px / leading-[1.7]   (본문 큰 문단)
- text-xl: 20px / leading-8       (서브헤드)
- text-2xl: 24px / leading-9      (섹션 타이틀)
- text-3xl: 32px / leading-10     (페이지 타이틀)
- text-hero: 40px / leading-[1.2] (히어로)

웨이트 3단 이내:
- font-normal (400)  — 본문
- font-semibold (600) — 강조·뱃지·버튼
- font-bold (700)    — 타이틀

자간: tracking-normal (0)
```

### 간격 (4의 배수)
```
gap/padding: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64
섹션 간 세로 여백: 기본 py-8 (32px), 큰 구분 py-12 (48px), 최대 py-16 (64px)
카드 내부 padding: p-5 (20px) or p-6 (24px)
```

### 카드 위계 3단
```
주요 카드 (page-hero·결과 판정):
- bg-ink text-paper rounded-2xl p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)]

보조 카드 (섹션 아이템):
- bg-paper border border-gray-100 rounded-xl p-5

강조 카드 (한 섹션 안에서 포인트 1개):
- bg-gold-brown-soft/60 border-l-4 border-gold-brown rounded-lg p-5
```

### 버튼 (토스 52px 표준, 앱인토스 강제)
```
Primary CTA (결제·핵심 액션):
- h-[52px] px-6 rounded-xl bg-gold-brown text-white text-base font-semibold
- hover: bg-gold-brown-dark
- disabled: bg-gray-300 text-gray-500

Secondary CTA (보조):
- h-[52px] px-6 rounded-xl bg-white border border-ink text-ink text-base font-semibold
- hover: bg-gray-100

Tertiary (텍스트 링크):
- text-sm font-semibold text-gold-brown underline underline-offset-4
- hover: text-gold-brown-dark

버튼 최소 터치 영역 44x44px 보장 (WCAG).
버튼은 반드시 **동사형** ("풀어보기", "결제하기" O / "보기", "확인" X 권장 안 함).
```

### 입력 필드
```
Input base:
- h-[52px] px-4 rounded-xl bg-paper border border-gray-300
- focus: border-gold-brown ring-2 ring-gold-brown/20
- placeholder: text-gray-500
- 에러: border-error bg-error/5

label: text-sm font-semibold text-ink mb-2
helper: text-xs text-gray-500 mt-2
```

### 접근성 (WCAG AA 필수)
- 본문 ink(#1A1A1A) on paper(#F8F5EE) = 대비 16.1:1 통과
- gold-brown(#A08B6A) on paper = 대비 3.2:1 → **본문 금지**, **18px 이상 + 600 굵기**에서만 사용
- gold-brown on ink = 대비 5.9:1 통과 (본문 가능)
- 모든 이미지 alt, 모든 버튼 accessible name

---

## 2. 컴포넌트 규칙

### 공용 컴포넌트 (이미 존재)
`SajuMiniCard`, `OhengCompareBar`, `Flippable`, `LockedCard`, `TimelineSwipe`, `TopicCTAGrid`, `SymbolDragMap`, `TimeSlotCarousel`, `CompassDrag` — 결과 페이지에 구현됨. 다른 페이지에서도 재사용 기본.

### 신규 공용 컴포넌트 (이 문서에서 정의, Claude Code로 구현)

**`Heading`** — 페이지·섹션 타이틀 일관화
```tsx
<Heading level={1|2|3} eyebrow="무료 풀이" title="..." description="..." />
// level 1: text-3xl / level 2: text-2xl / level 3: text-xl
// eyebrow: text-xs font-semibold text-gold-brown uppercase tracking-[0.12em]
```

**`CTABlock`** — 결제 CTA 블록 표준
```tsx
<CTABlock
  variant="primary|soft"
  eyebrow="500원"
  title="전체 풀이 해금하기"
  bullets={["11섹션 전부 공개", "2800자 이상", "평생 열람"]}
  onPay={...}
/>
```

**`EmptyState`** — 빈 상태 일관화
```tsx
<EmptyState icon={<Icon />} title="..." description="..." action={...} />
```

**`Toast`** — 토스트 일관화
```tsx
<Toast type="info|success|warning|error" title="..." description="..." />
// 3~5초 자동 소멸, 스와이프 dismiss
```

**`LoadingSkeleton`** — 모든 화면의 로딩 상태 통일
```tsx
<LoadingSkeleton variant="text|card|hero" />
// AI 로딩은 <AIProgressLoader />로 별도 (아래 3번 참조)
```

**`AIProgressLoader`** — AI 생성 대기 전용
```tsx
<AIProgressLoader stage="analyze|synthesize|compose|refine" />
// 단계마다 카피 변환, 검정 배경 + 골드브라운 파티클 1개
```

---

## 3. 로딩 UX — 퀄리티 > 속도 원칙 하 UX 우회

**원칙:** 로딩 자체를 줄이지 않는다. **기다림을 의미 있게** 만든다.

### 무료 Aha (10~30s 예상) — `<AIProgressLoader />`
단계별 카피 (3~5초 간격 변환):
1. `사주 원국을 읽는 중` — 0~5s
2. `오행과 신살을 정돈하는 중` — 5~12s
3. `당신의 오늘과 잇는 중` — 12~20s
4. `풀이를 다듬는 중` — 20~30s

### 꿈해몽 심층 Opus (20~60s, 결제 직후)
1. `결제를 확인했어요` — 0~3s (success 체크)
2. `6대 원전을 펼치는 중` — 3~15s
3. `당신의 사주와 꿈을 엮는 중` — 15~40s
4. `정성 풀이로 다듬는 중` — 40~60s

### 백그라운드 완료 통지
로딩 중 이탈해도 백그라운드 계속 → 완료 시 인앱 토스트 + 푸시 (앱인토스 푸시 API 확인 필요).

**금지 카피:** "잠시만 기다려주세요", "곧 완료됩니다" — 면피체 패턴. 의미 있는 단계 카피로 대체.

---

## 4. 한자·전문 용어 이원화 (UI 적용 룰)

**UI 출력물 기본:** 한글로 쉽게 풀어쓴다.

**예외 — 한자 상징 허용 위치:**
- `SajuMiniCard` 4기둥 내부 (甲寅·丙戌 등) — 카드 고유 표기
- 섹션 헤더 부제 (`오행 / 五行` 식 작은 병기)
- 신살 이름 첫 등장 (`도화살(桃花)`) + 즉시 풀이 1줄

**신살 용어 (브랜드 자산, 적극 사용):**
도화살 · 화개살 · 역마살 · 겁재살 · 양인살 · 천을귀인 · 문창귀인 · 공망

**대중 한자어 (그대로 사용):**
흉 · 재 · 화 · 운 · 복 · 덕 · 살 · 기 · 정 · 편
관용: "흉한 기운이 감돈다", "재물을 부른다", "기운이 트인다"

**금지어 (UI 전면):**
점집, 무속, 부적, 주술, 귀신, 액운, 저주, "재수없다", "운이 없다", "불운하다"

**면피체 금지 (카피 전체):**
"~할 수 있습니다" · "~일 것입니다" · "~것처럼 보입니다" · "~일 가능성이 있습니다"
→ 대체: "~합니다" · "~입니다" · "~합니다만 조심하세요"

---

## 5. 아이콘 규칙

- 라이브러리: **lucide-react** 통일 (ui-ink 24px 기본).
- 사주 특화 아이콘: 오행 5종(木火土金水)은 자체 SVG 5개만 사용. 컬러는 ink + gold-brown 2톤.
- 장식 일러스트 금지 (별·달·수정구 등 "AI 양산형"). 아이콘 = 의미 전달 + 2톤 이내.
- 애니메이션: 60fps 기본, 트랜지션 `transition duration-200 ease-out`.

---

## 6. 페이지 공통 레이아웃

```
<Page>
  <Header />           // 로고 + 메뉴 (결과 페이지는 + 돌아가기)
  <main className="mx-auto max-w-[428px] px-5">
    ...sections...
  </main>
  <BottomNav />        // 홈/꿈/운세/내정보 4탭 (홈·결과 페이지에만)
</Page>
```

- 모바일 우선 max-w-[428px] (iPhone 15 Pro Max).
- 데스크톱 1024px+에서는 중앙 정렬 + 좌우 여백 + 그림자 있는 앱 프레임 (웹앱 단계).
- 하단 safe-area-inset 고려, BottomNav 56px.

---

## 7. 일관성 체크리스트 (페이지 추가·수정 시 필수 통과)

- [ ] 색상: 주 1 + 중립 2~3 외 사용 0
- [ ] 폰트: Pretendard 1종, 웨이트 3단 이내
- [ ] 본문 크기 16~17px, 행간 1.7
- [ ] CTA 버튼 높이 52px
- [ ] 터치 영역 44x44px 이상
- [ ] 로딩·에러·엠프티 상태 모두 구현
- [ ] 접근성: 명도 대비 4.5:1 이상, alt 필수
- [ ] 한자: 정책 준수 (한글 중심 + 지정 위치만 한자 병기)
- [ ] 금지어·면피체 grep 0건
- [ ] 이모지 · 보라핑크 · 그라디언트 · 양산형 일러스트 0건
- [ ] 동사형 버튼 라벨
- [ ] BottomNav 활성 상태 정확히 반영

이 체크리스트는 모든 신규·개편 페이지 PR 머지 전 리뷰 항목.
===== END FILE =====

===== FILE: docs/homepage_redesign_spec.md =====
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
===== END FILE =====

===== FILE: docs/input_payment_review_pages_spec.md =====
# 입력·결제·후기 3페이지 개편 스펙

**목적:** 홈 개편과 동시에 적용할 주변 3페이지. 디자인 통일감 + UX 라이팅 통일.
**적용 기준:** `design_system_v4_consolidated.md` + `kr_time_correction_ux_copy_v2.md`.
**작성일:** 2026-04-20.

---

## A. 입력 페이지 (`/input` — `InputPage.tsx`)

### 목표
신규 유저의 최대 이탈 구간. 생년월일·시간 5필드를 30초 이내 완주.

### 레이아웃

```
1. 헤더 (뒤로 + 진행 표시 / 3단계 중 2)
2. 섹션 타이틀 (eyebrow "사주 입력" + title "생년월일을 알려주세요")
3. 필드 그룹 (생년월일·성별·시간·시간보정 옵션)
4. 미니 설명 (왜 필요한지 1줄)
5. 하단 sticky CTA "다음"
```

### 필드 구조

```tsx
<Form>
  <Field label="이름 (선택)" placeholder="부르기 편한 이름" name="nickname" />

  <RadioGroup label="성별" name="gender">
    <Radio value="male">남성</Radio>
    <Radio value="female">여성</Radio>
  </RadioGroup>

  <DateField
    label="생년월일"
    calendarType="solar|lunar"
    helper="양력·음력 둘 다 지원합니다"
    required
  />

  <TimeField
    label="태어난 시간"
    variant="exact|range|unknown"
    helper="한국 출생자는 자동으로 ±30분 진태양시 보정이 적용됩니다"
    required
  />

  <CollapsibleField label="출생지 (선택 · 정밀도 향상)">
    <Select options={[...주요 도시 목록]} defaultValue="서울" />
    <HelperText>지역별 경도 차이를 반영합니다</HelperText>
  </CollapsibleField>
</Form>
```

### 입력 페이지 핵심 카피

| 위치 | 카피 |
|---|---|
| 페이지 타이틀 | "생년월일을 알려주세요" |
| 페이지 서브 | "시간까지 있으면 더 정밀해집니다" |
| 양력/음력 토글 | "양력 기준" / "음력 기준" |
| 음력 선택 시 헬퍼 | "윤달 여부는 저희가 자동으로 판별합니다" |
| 시간 모름 버튼 | "시간을 모름" |
| 시간 모름 상세 | "하루의 큰 흐름은 시간 없이도 정확히 풀립니다. 시(時)까지 있으면 개인별 미세 조율이 더해집니다." |
| 6구간 라벨 | 새벽 (03~05시) · 아침 (05~09시) · 오전~정오 (09~12시) · 오후 (12~18시) · 저녁 (18~22시) · 밤 (22~03시) |
| 하단 CTA | "다음" (1단계) / "풀이 시작" (최종 단계) |

### 검증 규칙
- 성별 미선택 · 생년월일 미입력 → 하단 CTA 비활성화 (gray-300).
- 생년월일만 있으면 통과, 시간은 선택이지만 권장 헬퍼 노출.
- 에러 메시지는 필드 **바로 아래**, text-xs text-error, 1초 뒤 첫 터치 시 소거.

### 에러 카피

| 케이스 | 카피 |
|---|---|
| 생년월일 미래 | "오늘 이후 날짜는 선택할 수 없어요" |
| 시간 형식 오류 | "시간은 00:00 ~ 23:59 사이로 입력해주세요" |
| 필수 미입력 | "생년월일을 입력해야 풀이가 시작됩니다" |

### 로딩 · 엠프티
- 입력 페이지 자체는 로딩 없음.
- "다음" 클릭 후 → 로딩 페이지 전환 → `<AIProgressLoader stage="analyze" />`.

### 인터랙션
- 필드 focus 시 라벨 위로 살짝 이동 (material-style), 200ms.
- 날짜 피커는 iOS/Android 네이티브 style, 접근성 우선.

### 접근성
- 모든 라벨 `<label htmlFor>` 연결.
- `aria-required="true"` 필수 필드.
- 에러 시 `aria-invalid="true"` + `aria-describedby` → 에러 메시지.

---

## B. 결제 페이지 (`/pay` — `PayPage.tsx`)

### 목표
블러잠금 CTA 클릭 → 결제 완료까지 20초 이내. 결제 중단 복구 완벽.

### 레이아웃

```
1. 헤더 (뒤로 + "결제")
2. 상품 요약 카드
3. 결제 수단 선택 (토스페이·카카오페이 2개만)
4. 주문 정보 미니 (이메일 · 환불 정책 링크)
5. 하단 sticky CTA "500원 결제하기"
```

### 상품 요약 카드
```tsx
<Card tier="primary">
  <p className="text-xs font-semibold text-gold-brown uppercase tracking-[0.12em]">
    선택한 풀이
  </p>
  <h2 className="mt-2 text-2xl font-bold text-paper">주제별 심층 · 연애</h2>
  <p className="mt-2 text-sm text-paper/80 leading-[1.7]">
    2,800자 이상 · 6대 원전 기반 · 개인 사주 기반
  </p>
  <div className="mt-4 pt-4 border-t border-paper/20 flex items-baseline justify-between">
    <span className="text-sm text-paper/80">결제 금액</span>
    <span className="text-2xl font-bold text-gold-brown-soft">500원</span>
  </div>
</Card>
```

### 결제 수단 UI
```tsx
<div className="mt-6 space-y-3">
  <PayOption provider="toss" logo="/toss.svg" label="토스페이" />
  <PayOption provider="kakao" logo="/kakao.svg" label="카카오페이" />
</div>
```

**제약:** 신용카드 직결제는 1차 제외 (앱인토스 정책 확인 필요). 간편결제 2개만.

### 결제 페이지 핵심 카피

| 위치 | 카피 |
|---|---|
| 페이지 타이틀 | "결제" |
| 상품 요약 타이틀 | (선택 상품명) 그대로 |
| 결제 수단 헤더 | "결제 수단 선택" |
| CTA | "500원 결제하기" (상품 금액 그대로) |
| 환불 정책 링크 | "환불·결제 정책" |
| 환불 미니 설명 | "결제 후 풀이 열람 전까지 7일 내 전액 환불됩니다" |

### 결제 완료 페이지
```tsx
<div className="flex flex-col items-center py-16">
  <Icon name="CheckCircle" className="w-16 h-16 text-success" />
  <h1 className="mt-6 text-2xl font-bold">결제가 완료되었습니다</h1>
  <p className="mt-2 text-sm text-gray-600">풀이를 준비하는 중입니다.</p>
  <AIProgressLoader stage="synthesize" className="mt-8" />
  <p className="mt-6 text-xs text-gray-500">
    창을 닫아도 풀이는 백그라운드에서 계속 진행됩니다.
  </p>
</div>
```

### 결제 실패 페이지
```tsx
<EmptyState
  icon={<Icon name="AlertCircle" className="text-error" />}
  title="결제가 완료되지 않았습니다"
  description="금액은 청구되지 않았습니다. 다른 결제 수단을 선택해주세요."
  action={{ label: "다시 결제하기", onClick: retry }}
/>
```

### 결제 중단 복구
- 유저가 뒤로가기 → 결제 수단 선택 화면으로 복귀 (상품 선택은 유지).
- 결제 진행 중 앱 종료 → 재진입 시 "결제 중이던 주문이 있습니다" 토스트 + 재개 버튼.
- 결제 완료 콜백 중 네트워크 실패 → 30초 폴링 후 "결제 확인 중" → 최대 2분 후 CS 안내.

---

## C. 후기 페이지 (`/reviews` — `ReviewPage.tsx`)

### 목표
홈 후기 캐러셀의 전체 보기. 블러잠금 후기 5종 + 실제 결제 후기 누적 뷰.

### 레이아웃

```
1. 헤더 (뒤로 + "후기")
2. 필터 바 (전체 · 연애 · 재물 · 직장 · 결혼)
3. 블러잠금 후기 5종 (시드 v1)
4. 실제 결제 후기 리스트 (누적)
5. 후기 남기기 CTA (결제 완료 유저만)
```

### 블러잠금 후기 카드
```tsx
<Card tier="secondary">
  <div className="flex items-start gap-3">
    <Avatar persona={review.persona} />
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">{review.persona}</span>
        <span className="text-xs text-gray-500">{review.context}</span>
      </div>
      <Stars value={review.stars} className="mt-1" />
    </div>
  </div>

  <p className="mt-3 text-sm text-gray-700 leading-[1.7]">
    {review.preview}
  </p>

  <div className="relative mt-2">
    <div className="blur-sm select-none text-sm text-gray-500 leading-[1.7]">
      {review.lockedContent}
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <button className="h-[44px] px-5 rounded-lg bg-white border border-ink text-sm font-semibold">
        전체 읽기 · 500원
      </button>
    </div>
  </div>
</Card>
```

### 실제 결제 후기 리스트
```tsx
<ul className="mt-6 space-y-4">
  {realReviews.map(r => (
    <Card tier="secondary" key={r.id}>
      <header className="flex items-center gap-2">
        <span className="text-sm font-semibold">{r.nickname}</span>
        <span className="text-xs text-gray-500">{r.topic}</span>
        <span className="text-xs text-gray-400 ml-auto">{r.relativeTime}</span>
      </header>
      <Stars value={r.stars} className="mt-1" size="sm" />
      <p className="mt-2 text-sm text-gray-700 leading-[1.7]">{r.body}</p>
    </Card>
  ))}
</ul>
```

### 후기 페이지 핵심 카피

| 위치 | 카피 |
|---|---|
| 페이지 타이틀 | "후기" |
| 빈 상태 | "첫 후기를 기다리고 있어요" |
| 결제 유저 후기 작성 CTA | "내 후기 남기기" |
| 별점 없는 경우 | "별점 대신 솔직한 한 줄 부탁드려요" |
| 신고 버튼 | "부적절한 후기 신고" |

### 후기 작성 폼
- 별점 `0.5` 단위.
- 본문 최소 40자 (짧은 후기 방지), 최대 500자.
- 이모지 입력 자체는 허용 (유저 자유), 단 UI는 가공 없이 그대로 표시.
- 욕설 · 금지어 필터 = 클라이언트 기본 + 서버 2차.

### 후기 전환 로직
- 블러잠금 "전체 읽기" → `/pay?topic=review-unlock` → 결제 후 해당 후기 풀뷰 + 본인의 풀 리포트도 같이 해금 (단일 500원으로 2가지).

---

## 공통 마지막 체크 (3페이지 모두 해당)

- [ ] `design_system_v4_consolidated.md` 토큰 적용
- [ ] CTA 52px, 동사형, 가격 포함
- [ ] 로딩·에러·엠프티 3상태 모두 구현
- [ ] 금지어·면피체 grep 0
- [ ] 이모지·보라핑크·그라디언트 0
- [ ] 접근성: label·aria·키보드 네비
- [ ] BottomNav: 입력은 비노출, 결제·후기는 노출 (선택 탭 그대로 유지)
- [ ] 뒤로가기 파괴 없음: 결제 중단·후기 중단 복구 테스트

---

## 구현 순서 (Claude Code 할 일)

1. **InputPage.tsx** 먼저. 신규 유저 진입점이라 파급 가장 큼.
2. **PayPage.tsx** — 결제 중단·복구 시나리오까지 테스트.
3. **ReviewPage.tsx** — 블러잠금 후기 5종 데이터는 `blurred_reviews_seed_v1.md` 그대로.
4. 공통 컴포넌트 (Form·Field·DateField·TimeField·RadioGroup·CollapsibleField·Avatar·Stars·PayOption)는 InputPage 진행 중 동시 생성.
5. E2E 테스트: 입력 → 결과 → 블러잠금 → 결제 → 풀 리포트 전 플로우 1건.

**예상 작업량:** 각 페이지 3~4시간 × 3 = 9~12시간.
===== END FILE =====

===== FILE: docs/ux_writing_global_copy_book.md =====
# 전체 앱 UX 라이팅 카피북 — microcopy 단일화

**목적:** 앱 전체의 버튼·토스트·에러·엠프티·placeholder·모달·알림 문구를 **한 문서에** 모아 단일화. 페이지별로 다르게 써지는 드리프트 차단.
**적용 기준:** `design_system_v4_consolidated.md` 5장 (한자 이원화) + 4가지 금지 (면피체·점집·무속·양산형).
**작성일:** 2026-04-20.

---

## 0. 원칙

1. **동사형** — 버튼은 항상 동사로 끝낸다. "풀어보기" O / "풀이" X.
2. **가격 명시** — 결제 CTA는 가격을 버튼에 박는다. "500원 결제하기".
3. **면피체 금지** — "~할 수 있습니다", "~것입니다", "~것처럼 보입니다", "~가능성이 있습니다".
4. **점집 금지어** — 점집·무속·부적·주술·귀신·액운·저주·재수없다·운이 없다·불운하다.
5. **수치는 근거 있을 때만** — "75% 품질" 같은 근거 없는 수치 금지. 문장형으로 대체.
6. **이모지 본문 사용 금지** — 아이콘 컴포넌트로 대체.
7. **한자 노출은 지정 위치에만** — 카드 내부 기둥 표기·신살 첫 등장 병기 외 금지.

---

## 1. 버튼 라벨

### Primary CTA (결제·핵심 액션)
| 상황 | 라벨 |
|---|---|
| 홈 하단 sticky | "내 사주 풀어보기 · 500원" |
| 신규 입력 시작 | "내 사주 입력하고 시작" |
| 입력 다음 단계 | "다음" |
| 입력 최종 제출 | "풀이 시작" |
| 블러잠금 풀 리포트 | "전체 풀이 해금 · 500원" |
| 블러잠금 1운 | "이 주제 풀이 · 500원" |
| 결제 실행 | "500원 결제하기" |
| 프리미엄 5000원 | "종합 리포트 · 5,000원" |
| 오늘의 운세 보기 | "오늘의 풀이 전체 보기" |
| 꿈해몽 시작 (무료) | "내 꿈 풀어보기 · 무료" |
| 꿈해몽 심층 | "심층 풀이 · 500원" |
| 결과 공유 | "풀이 공유하기" |
| 다음 풀이 보기 | "다른 주제 풀어보기" |

### Secondary CTA
| 상황 | 라벨 |
|---|---|
| 홈 대안 CTA | "오늘의 운세 먼저 보기" |
| 입력 중단 | "나중에 할래요" |
| 결제 중단 | "결제 중단" |
| 풀 리포트 저장 | "리포트 저장" |
| 이전 풀이 보기 | "지난 풀이 보기" |
| 가족 추가 | "가족 사주 추가" |
| 시간 재설정 | "시간 다시 설정" |

### Tertiary (텍스트 링크)
| 상황 | 라벨 |
|---|---|
| 환불 정책 | "환불·결제 정책" |
| 이용 약관 | "이용 약관" |
| 개인정보 처리 | "개인정보 처리방침" |
| CS 문의 | "문의하기" |
| 자주 묻는 질문 | "자주 묻는 질문" |

### 금지 버튼 라벨 (사용하지 말 것)
- "확인" — 너무 모호. 대신 "저장", "닫기", "계속" 등 구체 동사.
- "시작" 단독 — "풀이 시작", "입력 시작" 등 목적 명시.
- "보기" — "풀이 보기", "후기 보기" 등 명사 붙이기.
- "취소" — "돌아가기", "결제 중단" 등 구체화.

---

## 2. 토스트

### 성공
| 상황 | 카피 |
|---|---|
| 풀이 생성 완료 | "풀이가 준비됐습니다" |
| 결제 성공 | "결제가 완료됐습니다" |
| 후기 저장 | "후기를 등록했습니다" |
| 시간 보정 적용 | "±30분 보정을 적용했습니다" |
| 공유 링크 복사 | "링크를 복사했습니다" |
| 리포트 저장 | "내 풀이함에 저장했습니다" |

### 정보
| 상황 | 카피 |
|---|---|
| 결제 재개 | "결제 중이던 주문이 있습니다" + [재개] 버튼 |
| 백그라운드 로딩 | "풀이는 백그라운드에서 계속 만들어집니다" |
| 시간 미입력 모드 | "시(時) 없이 큰 흐름으로 풀어드립니다" |

### 경고
| 상황 | 카피 |
|---|---|
| 화면 캡처 감지 | "풀이는 공유 버튼으로 나눠주세요" |
| 무료 한도 임박 | "무료 꿈해몽 1회 남았습니다" |
| 시간 재계산 1회 소진 | "이번 세션에선 더 재계산할 수 없습니다" |

### 에러
| 상황 | 카피 |
|---|---|
| 네트워크 끊김 | "연결이 끊겼습니다. 잠시 후 다시 시도해주세요" |
| 서버 지연 | "풀이를 불러오는 중입니다" (30초 이상 지속 시 "오래 걸리네요. 백그라운드로 전환합니다") |
| 결제 실패 | "결제가 완료되지 않았습니다. 금액은 청구되지 않았습니다" |
| 입력 부족 | "생년월일을 먼저 입력해주세요" |

---

## 3. 에러 메시지 (필드 단위)

| 필드 | 에러 | 카피 |
|---|---|---|
| 생년월일 | 미래 | "오늘 이후 날짜는 선택할 수 없어요" |
| 생년월일 | 미입력 | "생년월일을 입력해야 풀이가 시작됩니다" |
| 생년월일 | 너무 이름 | "1900년 이후로 입력해주세요" |
| 시간 | 형식 오류 | "시간은 00:00 ~ 23:59 사이로 입력해주세요" |
| 이메일 | 형식 오류 | "이메일 형식이 맞지 않습니다" |
| 후기 본문 | 너무 짧음 | "후기는 40자 이상이어야 등록됩니다" |
| 후기 본문 | 욕설 감지 | "부적절한 표현이 감지됐습니다" |
| 결제 | 수단 미선택 | "결제 수단을 선택해주세요" |

---

## 4. 엠프티 상태

| 화면 | 카피 | CTA |
|---|---|---|
| 사주 없음 (홈) | "생년월일만 넣으면 오늘의 풀이가 시작됩니다" | "내 사주 입력하고 시작" |
| 지난 풀이 없음 | "아직 저장된 풀이가 없습니다" | "첫 풀이 시작하기" |
| 후기 없음 | "첫 후기를 기다리고 있어요" | "후기 남기기" (결제 유저만) |
| 꿈 기록 없음 | "어젯밤 꿈을 기록해보세요" | "꿈 풀어보기" |
| 가족 사주 없음 | "가족 사주를 더하면 궁합을 풀어드립니다" | "가족 사주 추가" |
| 알림 없음 | "새로운 알림이 없습니다" | (없음) |

---

## 5. 모달

### 확인 모달
| 상황 | 제목 | 본문 | 주 버튼 | 보조 |
|---|---|---|---|---|
| 입력 중단 확인 | "입력을 멈출까요?" | "지금까지 입력한 내용은 저장되지 않습니다." | "나가기" | "계속 입력" |
| 결제 취소 확인 | "결제를 중단할까요?" | "금액은 청구되지 않습니다." | "결제 중단" | "계속 결제" |
| 후기 삭제 | "후기를 삭제할까요?" | "삭제한 후기는 되돌릴 수 없습니다." | "삭제" | "취소" |
| 로그아웃 | "로그아웃할까요?" | "다시 로그인할 때까지 알림이 오지 않습니다." | "로그아웃" | "머무르기" |

### 정보 모달
| 상황 | 제목 | 본문 |
|---|---|---|
| 시간 모름 상세 | "시간을 모르시나요?" | "하루의 큰 흐름은 시간 없이도 정확히 풀립니다. 시(時)까지 있으면 개인별 미세 조율이 더해집니다." |
| ±30분 보정 설명 | "한국 사주 시간 보정" | "한국은 시대에 따라 실제 태양시가 ±30분 차이났습니다. 경계 시간대에서 시주가 달라질 수 있어 저희가 자동으로 보정해드립니다." |
| 블러잠금 이유 | "왜 일부는 가려지나요?" | "풀이 전체는 500원 · 프리미엄 종합은 5,000원입니다. 먼저 맛보신 뒤 필요한 부분만 선택해 해금할 수 있습니다." |
| 6대 원전이란 | "6대 원전" | "사주 명리학의 고전 여섯 권을 말합니다. 자평진전·궁통보감·적천수·삼명통회·명리약언·자평진전평주. 사주500은 이 여섯 권의 관점을 교차시켜 풀이합니다." |

---

## 6. placeholder

| 필드 | placeholder |
|---|---|
| 이름 | "부르기 편한 이름" |
| 이메일 | "example@saju500.com" |
| 꿈 기록 | "간밤에 꾼 꿈을 자유롭게 적어주세요" |
| 후기 본문 | "솔직한 한 줄이면 충분합니다" |
| 가족 이름 | "어머니, 배우자 등" |
| 주제 검색 | "연애 · 재물 · 이직 등" |

---

## 7. 알림 (푸시·인앱)

### 푸시 알림
| 시점 | 제목 | 본문 |
|---|---|---|
| 매일 아침 6시 | "오늘의 운세가 준비됐습니다" | "{이름}님, 오늘은 {키워드} 기운이 돕니다" |
| 결제 완료 | "풀이가 준비됐습니다" | "지금 바로 열어보세요" |
| 심층 풀이 완료 | "심층 풀이가 완성됐습니다" | "{주제}에 대한 풀이를 확인해주세요" |
| 대운 전환 90일 전 | "대운 전환이 다가옵니다" | "10년 주기가 바뀌는 해입니다" |
| 24절기 (입춘 등) | "{절기}, 당신의 사주엔" | "오늘부터 기운이 바뀝니다" |

**원칙:** 푸시 제목 24자, 본문 60자 이내. 이모지 금지. 받는 사람 이름·키워드 개인화 필수.

### 인앱 알림
| 시점 | 카피 |
|---|---|
| 새 후기 10개 누적 | "새 후기 10개가 도착했습니다" |
| 무료 꿈 월 한도 도달 | "이번 달 무료 꿈해몽을 모두 썼습니다. 다음 달 1일에 초기화됩니다" |
| 친구 초대 보상 | "친구 {이름}이 가입했습니다" |

---

## 8. 로딩 카피 (AIProgressLoader 단계)

### 무료 Aha (10~30s)
1. "사주 원국을 읽는 중"
2. "오행과 신살을 정돈하는 중"
3. "당신의 오늘과 잇는 중"
4. "풀이를 다듬는 중"

### 꿈해몽 심층 Opus (20~60s)
1. "결제를 확인했어요"
2. "6대 원전을 펼치는 중"
3. "당신의 사주와 꿈을 엮는 중"
4. "정성 풀이로 다듬는 중"

### 오늘의 운세 (3~10s)
1. "오늘의 기운을 읽는 중"
2. "당신의 사주에 맞춰 다듬는 중"

### 주제별 심층 500원 (15~40s)
1. "결제를 확인했어요"
2. "{주제} 풀이를 시작합니다"
3. "6대 원전에서 근거를 모으는 중"
4. "개인 사주에 맞춰 다듬는 중"

**금지:** "잠시만 기다려주세요" · "곧 완료됩니다" · "분석 중입니다" · "로딩 중".

---

## 9. 마케팅·CRM 메일

### 결제 영수증
```
제목: [사주500] 결제 영수증 · 500원

{이름}님, 결제를 확인했습니다.

상품: {주제별 심층 · 연애}
금액: 500원
결제 수단: {토스페이}
주문 번호: {ORD-2026-04-22-XXXX}

풀이는 앱에서 언제든 다시 볼 수 있습니다.
[풀이 다시 보기]

문의: contact@saju500.com
환불·결제 정책: saju500.com/policy

사주500
```

### 신규 가입 환영 메일
```
제목: [사주500] 오신 걸 환영합니다

{이름}님, 사주500에 오신 걸 환영합니다.

- 매일 오전 6시에 오늘의 운세가 도착합니다.
- 500원이면 주제별 심층 풀이를 받을 수 있습니다.
- 6대 원전 기반 · ±30분 시간 보정이 기본입니다.

처음 오셨다면 입력부터 시작해주세요.
[사주 입력하기]

사주500
```

---

## 10. 법적 문구

### 결제 정책 미니 (결제 페이지 하단)
```
결제 후 풀이 열람 전까지 7일 내 전액 환불됩니다.
풀이 열람 후에는 디지털 상품 특성상 환불이 불가합니다.
```

### 공지 (필수 노출)
- "사주500은 명리학 기반 해석 서비스이며, 의학·법률·재무 조언을 대체하지 않습니다."
- 위 문구는 결과 페이지 하단·프리미엄 리포트 첫 페이지에 회색 10px로 1회 노출.

### 개인정보 처리 요약 (온보딩 체크박스)
```
[ ] (필수) 이용 약관에 동의합니다
[ ] (필수) 개인정보 처리방침에 동의합니다
[ ] (선택) 마케팅 알림 수신에 동의합니다
```

---

## 금지어 grep 체크 (배포 전 필수)

```bash
grep -rn "할 수 있습니다" src/
grep -rn "것입니다" src/
grep -rn "가능성이 있" src/
grep -rn "것처럼 보" src/

grep -rnE "(점집|무속|부적|주술|귀신|액운|저주|재수없|불운)" src/

grep -rn "잠시만 기다려" src/
grep -rn "곧 완료" src/

grep -rnE "[0-9]+%\s*(품질|정확도|확률)" src/
```

위 grep 결과가 모두 0건이 되어야 배포 가능.

---

## 구현 순서 (Claude Code 할 일)

1. `src/i18n/ko.ts` 또는 `src/copy/` 디렉토리에 이 카피북의 모든 문자열을 **한 파일로 통합**.
2. 기존 하드코딩된 문자열을 모두 `copy.xxx.yyy` 형태로 참조.
3. 금지어 grep 스크립트를 `scripts/check-copy.ts`로 추가, CI에서 자동 실행.
4. 새 페이지 추가 시 반드시 이 카피북 먼저 확인 후 새 라벨 추가.

**예상 작업량:** 통합 2~3시간 + 기존 하드코딩 교체 3~4시간 = 5~7시간.
===== END FILE =====

---

## 2단계 — D7 A안 확정 사항 기록

Cowork 세션에서 D7에 대한 결정이 내려졌다:

**D7 A안 확정 — wrapper redirect + 2주 grace**

- `generateDream` 구함수는 **삭제 금지**. 호출자 12개가 prod에서 여전히 쓰고 있음.
- `generateDream`을 얇은 wrapper로 변환: 입력에 따라 `generateDreamFree` or `generateDreamDeepV3`으로 **redirect** (500ms 오버헤드 안쪽).
- wrapper에 `console.warn` 1회 + Sentry tag `deprecated_endpoint:generateDream` 발행.
- 2주 grace 기간 동안 호출자 12개 순차적으로 직접 v3 엔드포인트 호출로 교체.
- 2주 후 호출 0건 확인 시 `generateDream` 하드 삭제 + deploy.

**근거 메모:** `feedback_dead_code_removal_pattern` — 호출자 있으면 하드 삭제 금지, wrapper redirect + 2주 grace 룰.

이 결정을 `docs/D7_wrapper_redirect_decision.md`로 기록해라. 내용:

```markdown
# D7 — generateDream wrapper redirect 결정

**결정일:** 2026-04-20
**안:** A안 (wrapper redirect + 2주 grace)

## 배경
- prod에 `generateDream` 호출자 12개 존재 (grep 확인).
- 신규 엔드포인트 `generateDreamFree`, `generateDreamDeepV3` 배포 완료.
- 구함수 하드 삭제 시 prod 전체 꿈해몽 기능 blackout 위험.

## 확정 방침
1. `functions/src/generateDream.ts`를 얇은 wrapper로 변환.
2. 입력 payload의 `tier` 또는 결제 상태 기반으로:
   - 무료 경로 → `generateDreamFree` redirect
   - 심층 경로 → `generateDreamDeepV3` redirect
3. wrapper 진입 시 `console.warn('deprecated_endpoint:generateDream')` 1회.
4. Sentry breadcrumb tag `deprecated_endpoint:generateDream` 발행.
5. 2주 grace: 2026-04-20 ~ 2026-05-04.
6. 호출자 12개 순차 교체 (PR 분리, 1개씩).
7. grace 만료 후 Sentry 호출 0 확인 → `generateDream` 하드 삭제.

## 모니터링
- 매일 Sentry 태그 카운트 확인.
- 교체 진행도 checklist (12/12 달성 시 조기 삭제 가능).
```

## 3단계 — 기존 docs 충돌 스캔

네가 직접 repo의 `docs/` 및 `docs/prd/` 아래 아래 키워드들을 grep해라:

```bash
grep -rn "디자인시스템" docs/
grep -rn "design system" docs/
grep -rn "HomePage" docs/
grep -rn "홈페이지" docs/
grep -rn "ux 라이팅" docs/
grep -rn "ux writing" docs/
grep -rn "copy book" docs/
grep -rn "카피북" docs/
grep -rn "입력 페이지" docs/
grep -rn "결제 페이지" docs/
grep -rn "후기 페이지" docs/
```

결과를 준기한테 보고해라. 특히:
- `docs/prd/디자인시스템_v4.md` 존재 여부
- 위 파일이 있으면, 내가 방금 쓴 `docs/design_system_v4_consolidated.md`와 **어느 쪽이 정본인지** 준기한테 물어야 한다 (내 추천: `design_system_v4_consolidated.md`가 정본, 구 v4는 `docs/prd/_archive/`로 이동).
- 기타 HomePage/입력/결제/후기 관련 기존 스펙이 있으면 각각 **deprecate 표시** 후 통합 정본으로 연결.

**충돌 해결 원칙:**
- 새 스펙이 정본. 구 스펙은 `_archive/` 로 이동 + 파일 맨 앞에 `> ⚠️ DEPRECATED — see {new_path}` 주석 1줄.
- 구 스펙에만 있는 내용 중 **새 스펙이 놓친 것**이 있으면 준기한테 보고 후 병합.

## 4단계 — 1단계 구현 착수 (Phase 1: 디자인 토큰 + 공용 컴포넌트)

충돌 스캔 완료 후 준기 승인 받고 시작해라. **승인 전엔 착수 금지**.

승인되면 이 순서:

1. **`tailwind.config.ts`** 색상·폰트·간격 토큰 추가. 기존 값은 보존, **덮어쓰기 금지**. 충돌 시 신규 토큰은 `brand-*` prefix.
2. **`src/components/ui/`** 신규 공용 컴포넌트 11종 구현:
   - Heading, CTABlock, EmptyState, Toast, LoadingSkeleton, AIProgressLoader, KPICell, SinsalRow, ProductCard, ReviewCard, ReasonRow
   - 각 컴포넌트 파일: `.tsx` + 간단 props 타입. 스토리북·테스트는 Phase 2로.
3. **단위 검증:** `npm run build` + `npm run typecheck` 통과. 실패 시 즉시 수정.
4. **1단계 완료 보고:** 파일 리스트 + 빌드 성공 로그를 준기한테 그대로 보고. "UI 개편 완료"나 "UX 라이팅 완료" 같은 말은 **절대 금지** — 1단계는 토큰 + 컴포넌트까지만이다.

## 5단계 (다음 단계) — HomePage.tsx 전면 교체

1단계 승인 후에만 시작. 기존 `HomePage.tsx`는 `HomePage.legacy.tsx`로 리네임 백업. 새 파일은 `docs/homepage_redesign_spec.md`에 따라 작성.

## 6단계 (그 다음) — InputPage.tsx / PayPage.tsx / ReviewPage.tsx

`docs/input_payment_review_pages_spec.md`에 따라.

## 7단계 (마지막) — UX 라이팅 통합

`docs/ux_writing_global_copy_book.md`의 `src/copy/` 통합 + 기존 하드코딩 교체 + CI grep 스크립트.

---

# 지금 당장 해야 할 것 (우선순위)

1. 1단계: 위 4개 파일 `docs/`에 Write. (필수)
2. 2단계: `docs/D7_wrapper_redirect_decision.md` Write. (필수)
3. 3단계: 충돌 스캔 + 결과 보고. (필수, 준기 승인 대기)
4. 4단계 이후는 준기 승인 후 착수.

보고 포맷: 1·2·3단계 완료 후 준기한테 이렇게 보고:

```
[PC Claude Code 보고]
- 1단계: docs/에 스펙 4개 write 완료 (파일명 4개)
- 2단계: docs/D7_wrapper_redirect_decision.md write 완료
- 3단계 스캔 결과:
  - 기존 {파일명}: {간단 요약} → 처리안 {이동/병합}
  - ...
- 질문: 충돌 해결안 {X/Y/Z} 중 선택 부탁드립니다.
- 4단계 착수 대기 중.
```

**금지:** 준기 승인 없이 4단계 이상 착수. "UI 개편 완료" 같은 과장 발언.
