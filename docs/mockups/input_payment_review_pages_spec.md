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
1. 헤더 (뒤로 + 진행 표시 ● ● ○ / 3단계 중 2)
2. 섹션 타이틀 (eyebrow "사주 입력" + title "생년월일을 알려주세요")
3. 필드 그룹 (생년월일·성별·시간·시간보정 옵션)
4. 미니 설명 (왜 필요한지 1줄)
5. 하단 sticky CTA "다음"
```

### 필드 구조

```tsx
<Form>
  {/* 1. 성명 (선택) */}
  <Field label="이름 (선택)" placeholder="부르기 편한 이름" name="nickname" />

  {/* 2. 성별 */}
  <RadioGroup label="성별" name="gender">
    <Radio value="male">남성</Radio>
    <Radio value="female">여성</Radio>
  </RadioGroup>

  {/* 3. 생년월일 */}
  <DateField
    label="생년월일"
    calendarType="solar|lunar"     // 양력/음력 토글 기본 "양력"
    helper="양력·음력 둘 다 지원합니다"
    required
  />

  {/* 4. 시간 (핵심) */}
  <TimeField
    label="태어난 시간"
    variant="exact|range|unknown"
    helper="한국 출생자는 자동으로 ±30분 진태양시 보정이 적용됩니다"
    required
  />
  {/* variant:
      exact: HH:MM 직접 입력
      range: 6구간 선택 (새벽/아침/오전/오후/저녁/밤)
      unknown: "전혀 모름" → 큰 흐름 모드
  */}

  {/* 5. 출생지 (고급) */}
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

  {/* 앞 2문장 공개 */}
  <p className="mt-3 text-sm text-gray-700 leading-[1.7]">
    {review.preview}
  </p>

  {/* 나머지 블러 */}
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
