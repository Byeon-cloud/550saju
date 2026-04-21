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

오행 컬러 (사주 시각화 전용 · 순서·매칭 고정):
- wood  (목 木): #2D8A4E (녹)
- fire  (화 火): #D32F2F (적)
- earth (토 土): #F57F17 (황금)
- metal (금 金): #757575 (은회)
- water (수 水): #1565C0 (청)

오행 배경 버전 (차트·인포그래픽용, 20% 톤):
- wood-bg:  #E8F5EC
- fire-bg:  #FDECEA
- earth-bg: #FFF4E5
- metal-bg: #EEEEEE
- water-bg: #E6EEF7
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
- text-pillar: 36px / leading-none / tracking-normal (사주 4기둥 한자 표기 전용)

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

---

## 부록 A. 히스토리 — v3 → v4 → v4.1 전환 배경

### v3 (~2026-03)
- 보라핑크 + 그라디언트 + 명조체(Noto Serif KR) 혼용 → "AI 양산형" 피드백 다발.
- 낙관·세로한자·한지 노이즈 같은 "포스터·출판 문법"을 앱에 강행 → 모바일 가독성 붕괴.
- 결과 페이지만 디자인 적용, 홈·입력·결제 무관심. 페이지별 톤 드리프트.

### v4 (2026-04-19, 구 `docs/prd/디자인시스템_v4.md` — 현재 `_archive`)
- 7원칙 정립 — 단색·Pretendard·52px CTA·한자 최소화 등.
- 벤치마크: 토스(52px CTA·흑백+파랑·Pretendard) · 카카오뱅크(중립+단일 포인트 컬러) ·
  당근(여백·친근 본문) · 점신/포스텔러(큰 아이콘·카드형).
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
