# 월운세 · 주간운세 NEW 콘텐츠 기획서 (SSOT)

> 2026-06-30 출시. 본 문서는 구현 완료본의 **진본 스펙**이다. 향후 수정 시 이 문서와 코드를 함께 갱신.
> 커밋: `e5c818d`(콘텐츠) · `b234aaf`(타임존 KST). 함수: `generateMonthly`/`generateWeekly` (v2 callable, us-central1).

---

## 0. TL;DR — 시간 운세 4층 레이어링

가격은 "시간 해상도"로 칼같이 분리 → 콘텐츠 카니발 0, 자연스러운 업셀 사다리.

| 콘텐츠 | 가격 | 시간 해상도 | 핵심 질문 | 갱신 |
|---|---|---|---|---|
| 오늘의 운세 | 무료 | 하루(오늘 1일) | "오늘 컨디션·조심할 것" | 매일 |
| **주간운세** | **5운** | **구매 전날부터 7일** | "이번 주 언제 움직일까" | 생성 시점 기준 |
| **월운세** | **7운** | **선택한 1개 달** | "그 달 어떻게 흘러갈까" | 월 선택 |
| 종합사주 | 10운 | 평생·올해 전반 | "나라는 사람의 큰 틀" | 1회 |

명리 위계: 원국(종합) ⊃ 세운(년) → **월운(월령)** → **주운(7일 일진)** → 일운(오늘).

---

## 1. 월운세 (月運 · 7운)

### 1-1. 개요
- 사용자가 **이번 달 포함 앞으로 12개월 중 1개 달**을 골라, 그 달을 깊게 본다.
- 기존 "2026 전체 12개월"을 폐기한 이유: 연말로 갈수록 미래 달이 줄어 가치↓ + 2027 되면 stale.
- 월 선택이라 **7/31에 사도 8월을 고르면 손해 0** (준기 결정).

### 1-2. 명리학 근거 (정확성 핵심)
- **선택월의 월간지·세운간지를 클라(WeeklyPage 와 동일하게 lunar-javascript)가 정확 계산해 서버에 주입** → 서버가 간지를 추측하지 않음(만세력 정확성).
- 월주는 절기(節氣) 기준이므로 그 달 **15일**로 산출(절기 경계 안전):
  ```ts
  const s = Solar.fromYmd(year, month, 15).getLunar();
  wolGanji = s.getMonthInGanZhi();   // 월간지
  yearGanji = s.getYearInGanZhi();   // 세운(입춘 기준 자동 전환)
  ```
- 프롬프트는 이 월간지·세운간지 × **원국 일간**의 충/합·생극을 직접 호명(보일러플레이트 금지).
- **원국(연·월·일·시주)은 유저 생년월일 입력 + 진태양시(-32분) 보정** → 타임존 무관, 안전.
- 시제(과거/이번달/미래)는 서버 `kstNow()`로 KST 기준 판정(UTC 밀림 차단).

### 1-3. 콘텐츠 구조 (`MonthlyDetailResponse` · `claudeMonthly.ts`)
- 모델 Sonnet 4.6 · temp 0.1(결정론) · max_tokens 10000 · **1차 생성 → 2차 자기리뷰**(체크리스트 자가 보정).

| 필드 | 내용 | floor |
|---|---|---|
| `year`, `month` | 선택 연·월 | — |
| `headline` | 그 달을 한 줄로(일상어 결론+후크) | — |
| `theme` | 그 달 핵심 테마(왜 이런 달인지) | — |
| `periods[3]` | **상순·중순·하순** {phase, dateRange, score, body} | body 120자+ |
| `wealth`·`love`·`career`·`health` | 4영역 {score, body} | body 80자+ |
| `luckyDays[2~3]` | 길일 {date, reason} (그 달 안 실제 날짜) | — |
| `cautionDays[2~3]` | 주의일 {date, reason} | — |
| `gaewoon` | 개운 처방(명령형) | 120자+ |
| `keywords[]` | 핵심 키워드 | — |

### 1-4. UIUX (화면별 · `MonthlyPage.tsx`)
- **select**: `ExtensionHero`(月 테마 #B5441F) → `ProfilePicker` → **월 선택 그리드**(12개월 3-col chip, 기본=이번 달, "이번 달" 배지) → 하단 sticky CTA "월별 운세 보기 (7운)"
- **loading**: `AILoading`(type=월별 운세, sajuData 미니카드, 3-step 카피)
- **result**: Hero(headline+theme+선택월 라벨) → **상·중·하순 3 타임라인 카드** → **4영역 카드**(재물·애정·직업·건강 score바+body) → **길일·주의일 노트** → **개운 처방 박스** → 공유/업셀/디스클레이머/`FooterCTA(月)` + `ShareModal`
- 톤: 이모지 X(한자/SVG/컬러칩), 본문 11px+ floor, 색/radius MonthlyPage 톤 통일.

---

## 2. 주간운세 (週運 · 5운)

### 2-1. 개요
- **구매 전날부터 롤링 7일** (달력주 월~일 아님). 언제 사든 그 시점 기준으로 어제부터 앞으로 7일.
- 예: 목요일 구매 → 수(어제)·목·금·토·일·월·화 (다음주 화까지, 총 7일).

### 2-2. 명리학 근거
- **7일 각 일진(日辰) 간지를 클라가 lunar-javascript로 정확 계산**해 서버 주입:
  ```ts
  ganji = Solar.fromYmd(y, m, d).getLunar().getDayInGanZhi(); // '甲戌' → ganjiToKo '갑술'
  // i = -1..+5 (어제~+5일) = 7일
  ```
- 7일 각 일진 간지 × **원국 일간**의 충/합·생극을 요일별로 직접 호명.
- 오늘운세(1일)·월운(거시)과 시간 해상도로 분리 → 카니발 없음.

### 2-3. 콘텐츠 구조 (`WeeklyDetailResponse` · `claudeWeekly.ts`)
- 모델 Sonnet 4.6 · temp 0.1 · max_tokens 12000 · **1차 생성 → 2차 자기리뷰**.

| 필드 | 내용 | floor |
|---|---|---|
| `weekHeadline` | 이번 주 한 줄(일상어+후크) | 25자 이내 |
| `weekTheme` | 주 핵심 테마(왜 이런 주인지=주간 일진 흐름) | 180자+ |
| `bestDay`·`cautionDay` | 가장 좋은/조심할 요일 | — |
| `keyDays[2~3]` | 핵심일 {day, date, type(best/caution), reason} | reason 80자+ |
| `dailyBreakdown[7]` | 7일 {day, date, ganji, score, tone, body, action} (첫=어제) | body 150자+ |
| `weekLesson` | 이번 주 교훈+실천(명령형) | 150자+ |
| `keywords[]` | 키워드 | — |

### 2-4. UIUX (화면별 · `WeeklyPage.tsx`)
- **select**: `ExtensionHero`(週 테마 #C77D3A) → `ProfilePicker` → CTA "주간운세 보기 (5운)"
- **loading**: `AILoading`(type=주간운세, 3-step)
- **result**: Hero(weekHeadline+weekTheme+기간) → **주간 리듬 그래프**(7일 score recharts AreaChart, #C77D3A) → **핵심일 카드**(caution=주의색/best=골드) → **7일 요일별 카드**(day/date/ganji/score/tone/body/action, 첫 카드 "어제" 칩) → **이번 주 교훈** → `FooterCTA(週)` + `ShareModal`

---

## 3. 공통 생성 플로우 (월·주 동일)

```
[홈 NEW 카드(週 5운 / 月 7운)]
        ↓
[페이지 진입]  ──→  (월: 프로필 + 월 선택 / 주: 프로필)
        ↓
[CTA 탭] → spendBalance(price)   ── 잔액부족 → /charge?need=N (returnTo)
        ↓ (성공)
[로딩 · AILoading] → 클라가 간지(월간지·세운 / 7일 일진) lunar 계산 → 서버 generateXxx(monthInfo|weekDays)
        ↓
[서버] computeBalanceDeduction(7|5) · 1차 생성 → 2차 자기리뷰 → reports 저장
        ↓ (실패 시)  refundBalance(price) + clearPendingSpendByType  → select 복귀
        ↓ (성공)
[결과 렌더] + saveReport(contentType: monthly|weekly) + clearPendingSpend
        ↓
[보관함 저장]  +  [FooterCTA 업셀(종합 10운)]
```

- **머니세이프**: 클라 차감(주 5/월 7) ↔ 서버 `computeBalanceDeduction` 동일 값. 생성 중 종료 시 `markPendingSpend` → 부팅 reconcile 자동환불.
- **캐시 미사용**: 월(선택월 구분)·주(윈도우 매일 이동)라 contentType-only 캐시는 stale → 제거. 재조회는 **보관함 저장본**으로.

---

## 4. 타임존·정확성 (준기 최우선 원칙)

| 구분 | 기준 | 비고 |
|---|---|---|
| 원국 연/월/일/시주 | **유저 입력 + 진태양시(-32분) 보정** | 현재시각 무관, 미국시간 0% |
| 월간지·세운·일진 | **클라 lunar-javascript(기기=KST) 계산 → 서버 주입** | 서버 추측 금지 |
| "오늘/이번 달/올해" framing | 서버 **`kstNow()`** (`functions/src/utils/kstTime.ts`) | Cloud Functions UTC 밀림 차단 |

> 🚨 회귀 금지: 서버(functions)에서 현재시각은 **절대 `new Date()` 직접 쓰지 말 것**. 반드시 `kstNow()`/`kstNowDate()`. (UTC라 KST 0~9시에 하루·한 달·한 해 밀림.) 단 `new Date(year,month,0)` 류 "특정 달 일수계산"은 고정날짜라 예외.

---

## 5. 연동 파일 맵 (SSOT 참조)

- 가격: `src/constants/pricing.ts` — `getMonthlyPrice()`(7) · `getWeeklyPrice()`(5) · `PRODUCT_COST` · `PREMIUM_PRICING_RAW`(하반기 세일)
- 라우트: `src/App.tsx` — `/monthly` · `/weekly` (대운/궁합/토정은 lockdown 유지)
- 홈: `src/pages/HomePage.tsx` — [05a] NEW 시간운세 2카드
- 페이지: `src/pages/MonthlyPage.tsx` · `src/pages/WeeklyPage.tsx`
- 서버: `functions/src/index.ts`(generateMonthly/Weekly) · `functions/src/ai/claudeMonthly.ts` · `claudeWeekly.ts`
- 타입: `src/types/report.ts` — `MonthlyDetailResponse`/`MonthlyPeriod`/`MonthlyDomain`/`MonthlyDayNote` · `WeeklyDetailResponse`/`WeeklyDay`/`WeeklyKeyDay`
- 클라 호출: `src/services/ai/reportGenerator.ts` — `generateMonthlyFortune2026(sajuData, monthInfo)` · `generateWeeklyFortune(sajuData, weekDays)`
- 보관함: `src/pages/StoragePage.tsx` — FilterKey/탭/라벨/CONTENT_COST(월7·주5)/아이콘/빈상태/routeForReport/LOCKDOWN(월 제외)
- 테마/CTA: `src/pages/extension/_chrome.tsx`(weekly 테마) · `src/components/common/FooterCTA.tsx`(週)
- 어드민: `src/pages/admin/_tabContent.tsx`(weekly 라벨)
- 타임존: `functions/src/utils/kstTime.ts`
