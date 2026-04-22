# PC 패치 A — 토스페이 결제 단일화 (앱인토스 빌드)

**작성:** 2026-04-21 · D-1
**근거:** 앱인토스 검수 §3-1 — "외부 결제 모듈 사용 불가. 토스페이 또는 인앱결제만 허용."
**범위:** 앱인토스 빌드에 한정. 웹앱 빌드는 기존 3종(카카오·네이버·카드) 유지.
**담당:** PC Claude Code

---

## 1. 빌드 분기 전략

```
환경변수: VITE_BUILD_TARGET = "appintos" | "webapp"
```

- `appintos` 빌드: 결제 수단 = 토스페이 1종
- `webapp` 빌드: 결제 수단 = 카카오페이 · 네이버페이 · 토스페이 · 카드 선택

## 2. 코드 변경 포인트

### 2-1. `/charge` (CheckoutFlow 또는 PaymentOptions)

**Before**
```tsx
<PayOption provider="toss"  label="토스페이" />
<PayOption provider="kakao" label="카카오페이" />
<PayOption provider="naver" label="네이버페이" />
<PayOption provider="card"  label="신용카드" />
```

**After**
```tsx
{isAppintosBuild ? (
  <PayOption provider="toss" label="토스페이" selected defaultChecked />
) : (
  <>
    <PayOption provider="toss"  label="토스페이" />
    <PayOption provider="kakao" label="카카오페이" />
    <PayOption provider="naver" label="네이버페이" />
    <PayOption provider="card"  label="신용카드" />
  </>
)}
```

### 2-2. 앱인토스 빌드에서 결제수단 선택 UI 전면 숨김 권장

앱인토스 단일 결제 모듈이라 "선택" 자체가 불필요. "토스페이로 결제" 한 줄 CTA만 노출.

```tsx
{isAppintosBuild ? (
  <button className="pay-cta">토스페이로 결제</button>
) : (
  <PayOptionList />
)}
```

### 2-3. CheckoutButton 라벨

- 앱인토스: **"토스페이로 결제"**
- 웹앱: **"결제"** (선택한 수단은 배지로 표기)

## 3. 로그·내역 표기

`/my/history/charge` 탭에서 앱인토스 빌드 유저에게는 "토스페이 · +10운" 고정 노출. DB에는 provider field 그대로 `toss` 저장.

## 4. 환불 정책 문구

`/charge` Notice 블록 — 현재 "구매한 운은 환불되지 않음" 유지. 추가 토스페이 환불 프로세스 안내 1줄:

> 환불은 토스페이 결제 취소 정책을 따르며, 결제 후 7일 이내 미사용 운에 한해 고객센터(info@juulabel.com)로 문의 시 심사 후 처리합니다.

## 5. flowchart·다이어그램 스펙 업데이트

- `사주500_flowchart_userflow.html` L282: `토스페이먼츠 등` → `토스페이(앱인토스)`로 변경
- `input_payment_review_pages_spec.md` L117·142·143: appintos 분기 코멘트 추가

## 6. PC 테스트 체크리스트

- [ ] `VITE_BUILD_TARGET=appintos` 빌드 → 결제 옵션 토스페이 1개만 노출
- [ ] `VITE_BUILD_TARGET=webapp` 빌드 → 4개 결제 옵션 전부 노출
- [ ] 토스페이 결제 → 성공 콜백 → `/charge?redirect=&need=N` 정상 복귀
- [ ] 토스페이 결제 실패 → 에러 모달 → 재시도 가능
- [ ] 결제 내역(`/my/history/charge`) provider 라벨 "토스페이" 확인
- [ ] 앱인토스 프리뷰 환경에서 웹뷰 충돌 없음

## 7. 환경 감지 코드 (참고)

```ts
// src/lib/env.ts
export const isAppintosBuild =
  import.meta.env.VITE_BUILD_TARGET === 'appintos' ||
  /InTossApp/i.test(navigator.userAgent); // 런타임 fallback

// 또는 앱인토스 SDK 제공 API가 있으면 우선 사용
```

## 8. 영향 받는 파일 추정

- `src/pages/Charge/PaymentOptions.tsx`
- `src/pages/Charge/CheckoutFlow.tsx`
- `src/components/PayOption.tsx`
- `src/lib/env.ts` (신규)
- `src/pages/My/History.tsx`

## 9. 배포 전 문서 갱신

- [x] `사주500_UI개편_07_운충전.md` L185·L319 반영 완료
- [x] `사주500_UI개편_04_내정보.md` L199 반영 완료
- [ ] `input_payment_review_pages_spec.md` 패치 후 반영
- [ ] `PC_CLAUDE_CODE_PASTE_THIS.md` L772~798 패치 후 반영 (선택. 이 문서가 최신 기준)
