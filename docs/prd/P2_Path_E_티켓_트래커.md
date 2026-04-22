# P2 잔여 · Path E 티켓 트래커

**최종 업데이트**: 2026-04-22 (Path E 4종 + §7 P2 5건 **전건 완결** — E13 결제 원자성 + E32 공유 OG SSR 추가 완료. 런칭 배포 검증·인프라 설정 단계로 이행.)
**근거**:
- `PC_인수인계_2026_04_21_단일본.md` §7 (P2 잔여 5건)
- `홈v5_Path분기_레이아웃diff.md` v3 §9 (Path E 4종 + §7 P2 5건 통합)

---

## 📌 상태 기호

- ✅ **완료** — 구현 + tsc 통과
- 🟥 **블로커** — 앱인토스 심사 · 결제 무결성 직결 (런칭 직전 필수)
- 🟧 **런칭 경로** — UX · 회귀 방어 · 재진입 안정성
- 🟨 **관찰** — 스코프 정의 필요 or 릴리스 후 추적

---

## 🅴 Path E 4종 (앱인토스 심사 직결)

> Path E 는 홈 분기가 아니라 **예외 처리 경로**. useUserPath 미포함. 각 페이지·플로우 단위로 개별 구현.

### E13 · 결제 원자성 ✅ (2026-04-22 완료)
- **문제**: 토스 IAP / 토스페이먼츠 결제 성공 → Firestore 잔액 반영 중간 실패 시 "돈은 빠지고 운은 안 들어옴" 위험.
- **완료 내역**:
  1. ✅ `payments/{orderId}` 에 **status 전이** 도입 — `pending → confirmed | failed | needs_reconciliation`
  2. ✅ `confirmPayment` (웹 토스페이먼츠) 재작성 — pending 선기록 → Toss 승인 API → 승인 성공 시 transaction 으로 balance 증가 + `status: 'confirmed'` → 실패 시 `status: 'failed'` (재시도 허용) → Toss 승인 + DB 실패 시 `status: 'needs_reconciliation'` (수동 복구 대상) + `tossApprovedAt` 기록
  3. ✅ `grantPurchase` (IAP) 동일 패턴 적용 — pending 선기록 → transaction → confirmed/needs_reconciliation
  4. ✅ **중복 지급 방지 강화** — `status === 'confirmed'` 만 차단, pending/failed 는 재시도 허용. `needs_reconciliation` 은 자동 재시도 금지 (고객센터 유도)
  5. ✅ `ChargePage.tsx` 에러 토스트 **유형별 분기** — "결제 승인 실패" (유저 취소) / "이미 처리된 결제" / "고객센터 문의" (needs_reconciliation) / 범용 폴백
- **구현 위치**:
  - `functions/src/index.ts` L593-730 (grantPurchase) · L855-1005 (confirmPayment)
  - `src/pages/ChargePage.tsx` L47-81 (confirmTossPayment catch 분기)
- **검증**: `npx tsc --noEmit` (functions + client) 0 에러 · `tsc --noEmit` 통과. 수동 QA 항목(런칭 직전):
  - (a) 정상 결제 → `status: 'confirmed'` 기록 확인
  - (b) Toss confirm API fail 강제 → `status: 'failed'` + 토스트 "결제가 취소되었습니다"
  - (c) 같은 orderId 재시도 → 정상 지급 (pending → confirmed 전이)
  - (d) 중복 confirmed 시도 → "이미 처리된 결제" 응답
- **잔여**: Firestore rules 에서 `status` 필드 직접 수정 차단 (Cloud Function only) — 런칭 직전 rules 점검 시 포함
- **근거**: 인수인계 §7.1

### E32 · 공유 비회원 OG SSR ✅ (2026-04-22 완료)
- **문제**: 로그인 안 된 유저가 공유 링크 `/share/:id` 수신 시 OG 이미지 생성·스케폴딩 실패 가능. 카카오톡 unfurl / Twitter Card 스크랩 시 일반 랜딩 OG 만 노출.
- **완료 내역**:
  1. ✅ `functions/src/share/renderShareOg.ts` 신규 — onRequest Gen 2 Cloud Function
  2. ✅ **UA 분기** — 봇 UA (facebookexternalhit, twitterbot, slackbot, kakaotalk, telegrambot, discordbot, whatsapp, linkedinbot, google, bing 등) → SSR OG HTML 반환. 사람 UA → `/index.html` self-fetch 후 SPA 전달
  3. ✅ **SSR OG 콘텐츠** — og:title "사주 결과 — 잠금 해제하고 전체 보기 →" · og:description "500원에 만나는 정통 명리학. 잠금 해제하면 12개 섹션 전체를 볼 수 있어요." · og:image 정적 `/og-image.png` (Phase 2 동적 OG PNG 로 전환 예정)
  4. ✅ **Firebase Hosting rewrite** — `firebase.json` 에 `{ "source": "/share/**", "function": "renderShareOg" }` 추가 (SPA 폴백 `**` → `/index.html` 보다 먼저)
  5. ✅ **리포트 ID 검증** — `/^\/share\/([A-Za-z0-9_-]{4,64})\/?$/` regex, 형식 불일치 시 404
  6. ✅ **캐시 정책** — 봇 응답 5분 CDN 캐시 (public, max-age=300, s-maxage=600) · 사람 응답 no-store
  7. ✅ `index.ts` 에서 `export { renderShareOg }` 배선
- **구현 위치**:
  - `functions/src/share/renderShareOg.ts` (신규, 113 lines)
  - `functions/src/index.ts` 말미 (E32 섹션)
  - `firebase.json` rewrites
- **검증**: `npx tsc --noEmit` (functions) 0 에러. 런칭 전 수동 QA:
  - (a) Facebook Sharing Debugger 로 `/share/:validId` 조회 → OG 타이틀·이미지·설명 모두 노출
  - (b) Slack unfurl → 블러 티저 카피 노출 확인
  - (c) 카카오톡 링크 공유 → 티저 OG 렌더 확인
  - (d) 일반 브라우저 (Chrome) 에서 `/share/:id` 접속 → SPA 가 정상 로드 (자체 fetch 성공)
- **잔여 (Phase 2)**:
  - 리포트별 **동적 OG PNG** — Storage 에 생성·캐싱 (현재는 정적 `/og-image.png` 공용)
  - `shareResult(locked?: boolean)` 파라미터 — paid 유저 공유 시 잠금 해제된 OG 분기
  - Cloud Functions SSR self-fetch 레이턴시 최적화 (현재 ~200ms 오버헤드)
- **근거**: 인수인계 §7.2 · `프리미엄_티저블러.md`

### E3 · NotFound (404 / 잘못된 경로) ✅ (2026-04-22 완료)
- **현재**: `App.tsx` NotFoundPage 구현 존재.
- **완료 내역**:
  1. ✅ `<a href="/">` → `useNavigate('/', {replace:true})` 전환 (SPA 이동, 히스토리 오염 방지)
  2. ✅ `/result/:id` id 형식 검증 → `ResultRouteGuard` (base36 [a-z0-9]{4,32}) invalid 시 `/` replace redirect
  3. ✅ SSOT 컬러 통일 — 구 gradient `#C9A96E→#D4A843` 제거, `#B8965A` 단색 (+ `rgba(184,150,90,0.10)` 배경)
- **구현 위치**: `src/App.tsx` (NotFoundPage · ResultRouteGuard · RESULT_ID_RE)
- **근거**: 인수인계 §7.3
- **검증**: `npx tsc --noEmit` 0 에러

### E40 · 입력 임시저장 (복귀) ✅ (2026-04-22 완료)
- **문제**: InputPage 에서 네트워크 재시작 · 앱인토스 백그라운드 복귀 시 입력 내용 휘발.
- **완료 내역**:
  1. ✅ `useInputDraft` 훅 — `src/hooks/useInputDraft.ts` 신규. 입력 snapshot 을 `sessionStorage` `saju500:input_draft:v1` 에 저장
  2. ✅ 마운트 시 draft 있으면 "이어쓰기 / 새로 작성" Modal (InputPage 내 `Modal` 컴포넌트 활용)
  3. ✅ 저장 500ms 디바운스 (과도한 write 방지)
  4. ✅ 24h TTL — 오래된 draft 는 `readStored` 시 자동 정리
  5. ✅ Step5(사주팔자 확인) 진입 시 `clearDraft()` 호출 → 입력 완결 후 draft 제거
  6. ✅ `selectedProfile` (보관함 진입) / `?new=1` 경로에서는 Modal 트리거 안 함
- **구현 위치**: `src/hooks/useInputDraft.ts` (신규) · `src/pages/InputPage.tsx` (Modal + 훅 배선)
- **근거**: 인수인계 §7.4
- **검증**: `npx tsc --noEmit` 0 에러

---

## §7 P2 5건 (인수인계 §7 원문)

### P2-1 · 블러 공유 경계 ✅ (2026-04-22 완료)
- **문제**: 블러잠금 상태에서 공유 버튼 → OG 이미지에 블러 그대로 노출 시 티저 가치 떨어짐.
- **스코프 판단**: 공유 수신자 기본 맥락은 블러잠금 (`/share/:id` 비회원/미결제) 이므로 OG 이미지는 기본값으로 "블러 + 자물쇠 + 잠금 해제 CTA" 레이아웃을 렌더. 수신자가 본인인지 3자인지 구분하려면 서버 세션이 필요 → Phase 2 로 분리.
- **완료 내역**:
  1. ✅ `generateOgImage` 개선 — 블러 필드 위에 `drawLockIcon` 자물쇠 아이콘 (좌상단) + 골드 배경 CTA 배지 "잠금 해제하고 전체 보기 →" (중앙하단) 캔버스 네이티브 렌더
  2. ✅ 컬러 SSOT 정렬 — 구 `#C9A96E / rgba(201,169,110,...)` → `#B8965A / rgba(184,150,90,...)` (인수인계 §5)
  3. ✅ 공유 텍스트 고정 — 구 "나도 500원에 내 사주를 볼 수 있다는데?" → "{이름}님의 사주 — 잠금 해제하고 전체 보기 →" (Web Share API text 파라미터)
  4. ✅ ShareModal 프리뷰 카드 동기화 — 블러 필드 위에 자물쇠 SVG + "잠금 해제하고 전체 보기 →" 오버레이 배치. OG 이미지와 톤/카피 통일
  5. ⚠️ Phase 2 TODO: (a) Cloud Function SSR OG 생성 (E32 와 묶어서) — 클라이언트 canvas 렌더는 공유 순간에만 동작, 링크 unfurling 시에는 미생성. (b) paid 유저의 "내가 구매한 내 결과 공유" 시에도 동일 OG 렌더 결정 (현재는 공통). (c) `shareResult` 에 `locked?: boolean` 파라미터 추가해 두 layout 분리 지원
- **구현 위치**: `src/utils/share.ts` (generateOgImage · drawLockIcon · shareResult text) · `src/components/share/ShareModal.tsx` (프리뷰 카드 자물쇠 오버레이)
- **근거**: 인수인계 §7.P2-1 · `프리미엄_티저블러.md`
- **검증**: `npx tsc --noEmit` 0 에러

### P2-2 · /input 재진입 플로우 ✅ (2026-04-22 완료)
- **문제**: 이미 입력된 유저가 `/input` 재방문 시 덮어쓰기 vs 새 프로필 추가 명확하지 않음.
- **완료 내역**:
  1. ✅ Step 0 프로필 카드 구조 변경 — motion.button → div wrapper + (선택 버튼 + 수정 아이콘 버튼 44×44). 연필 SVG 아이콘 + aria-label "수정"
  2. ✅ 수정 모드: `editingProfileId` state 도입. 수정 클릭 시 해당 프로필로 pre-fill + Header 타이틀 "사주 수정" 으로 전환
  3. ✅ Step 5 (완료) 진입 시 `editingProfileId` 있으면 기존 report 삭제 후 새 reportId 생성. `saveProfileDirect` 는 name+birth 키로 자동 dedup → 동일 프로필 덮어쓰기
  4. ✅ `handleBack` (Step 1→0) / `handleSelect` / "+ 새 사주 입력하기" 에서 `editingProfileId` clear
  5. ✅ 새 프로필 추가는 기존 "+ 새 사주 입력하기" CTA 그대로 유지 (이중 입력 플로우 혼선 방지)
- **구현 위치**: `src/pages/InputPage.tsx` (editingProfileId + Step 0 카드 재구성 + Step 5 deleteReport 분기)
- **근거**: 인수인계 §7.P2-2
- **검증**: `npx tsc --noEmit` 0 에러

### P2-3 · 궁합 상대방 저장 ✅ (2026-04-22 완료)
- **문제**: 궁합 상대방 정보 매번 입력. 재활용 안 됨.
- **스코프 판단**: 기존 `saveProfileDirect` 가 상대방 입력 시 자동으로 profiles 배열에 저장됨 (새 사주 입력 → /input?new=1&from=compat 경로). 즉 **저장 자체는 이미 되고 있음** — 진짜 UX 병목은 "재사용 접근성". → 체크박스 추가 대신 **최근 3명 quick-pick** 으로 해결.
- **완료 내역**:
  1. ✅ `src/services/storage/compatRecents.ts` 신규 — Phase 1 localStorage 기반. 키 `saju500:compat_recents:v1`, schemaVersion 1. MRU 최대 3명
  2. ✅ API: `getRecentPartnerIds(validIds?)` / `addRecentPartner(id)` / `removeRecentPartner(id)`. `validIds` 넘기면 삭제된 프로필 자동 필터 + 저장소 정리
  3. ✅ CompatibilityPage `handleSubmit` 에 `addRecentPartner(person2.id)` 배선 — 궁합 분석 제출 시 MRU 최상단으로 이동
  4. ✅ 프로필 picker bottom sheet (slot 2 전용) 상단에 "최근 본 상대방" chips row 추가 — `#B8965A` rgba 배경 + 이름/일간/오행 미니 카드. 탭 한 번에 선택
  5. ✅ person1(본인) 으로 선택된 프로필은 recents 에서 제외 (동일인 궁합 방지)
  6. ⚠️ TODO: Phase 2 `users/{uid}/partners/{pid}` Firestore 컬렉션 이관 — 멀티 디바이스 동기화 + Relation 태그 (연인/썸/이별 등)
- **구현 위치**: `src/services/storage/compatRecents.ts` (신규) · `src/pages/CompatibilityPage.tsx` (import · handleSubmit · picker 상단 section)
- **근거**: 인수인계 §7.P2-3
- **검증**: `npx tsc --noEmit` 0 에러

### P2-4 · /chat 요금 정책 ✅ (2026-04-22 완료)
- **문제**: 사주대화(/chat) 무료 1일 1회 한도 초과 시 요금 안내 흐름 미정.
- **완료 내역**:
  1. ✅ `quotaExceeded` state 도입 — `userMsgCount > 0` (오늘 무료 패스 이미 사용) + 크레딧 0 에서 발화 시도 시 `true`. 충전 아이콘 자발적 탭 시 `false`
  2. ✅ BuyCredits Modal 타이틀/서브카피 분기:
     - 한도 초과: "오늘 무료 한도를 다 썼어요 · 1운으로 대화 3회를 이어갈 수 있어요. 아니면 내일 다시 만나요."
     - 자발적: "대화권 충전 · 1운으로 대화 3회를 추가할 수 있어요"
  3. ✅ 취소 버튼 카피 분기: 한도 초과 시 "내일 다시 올게요" (퇴장 존중) / 자발적 시 "취소"
  4. ✅ 1운 = 대화 3회 유지 (spec §2 "1회 연장" 의 업계 최소단위 UX 관점. 3회 단위가 잔액 구조 정합성 ↑. 준기 override 가능)
  5. ✅ 컬러 SSOT 적용 — 구 `#C9A96E→#D4A843` gradient → `#B8965A` 단색 (모달 내부만, 공용 헤더 등 추가 치환은 별도 이슈)
  6. ⚠️ TODO(E13): Phase 2 `spendBalance(1) + addChatCredits(3)` 을 Cloud Function 트랜잭션으로 원자화. 코드 주석 삽입
- **구현 위치**: `src/pages/ChatPage.tsx` (ChatView quotaExceeded state · sendMessage 분기 · showBuyCredits Modal 카피/버튼)
- **근거**: 인수인계 §7.P2-4
- **검증**: `npx tsc --noEmit` 0 에러

### P2-5 · 데일리 리워드 UI ✅ (2026-04-22 완료)
- **문제**: 런칭 프로모 3원 리워드 `런칭프로모_3원리워드.md` SSOT 있으나 UI 노출 지점 미확정.
- **단위 결정 (자체 · 준기 override 가능)**: 인수인계 원문 "3원" 은 런칭 프로모 PRD (1회성 3원 KRW) 와 명칭 충돌. 현재 balance 시스템은 "운(運)" 단위 (1운=500원, 최소 0.1). → 데일리 배지는 **"0.1운 (= 50원 상당) 리워드"** 로 구현, UI 문구는 "데일리 리워드" 로 교체. 런칭 3원 프로모는 별도 `launchReward` 모델 (본 유틸과 분리).
- **완료 내역**:
  1. ✅ `src/services/storage/dailyReward.ts` 신규 — Phase 1 localStorage 기반. 키: `saju500:daily_reward:last` (YYYY-MM-DD), `saju500:daily_reward:month` ({ym, count}). 월 넘어가면 자동 리셋
  2. ✅ `getDailyRewardState()` / `claimDailyReward()` — 일 1회 + 월 30회 제한. 성공 시 `addRewardBalance(0.1)` 호출
  3. ✅ `DailyRewardBadge.tsx` 신규 — 3-state 배지 (미수령 CTA / 수령완료 / 월 한도 초과). SSOT `#B8965A` + rgba 배경. 44×44 터치 영역. `aria-live="polite"` / `aria-label`
  4. ✅ DailyFortunePage 상단 통합 — `hasAnyProfile && <DailyRewardBadge />`. Header 아래 / AnimatePresence 위 배치
  5. ✅ 수령 성공 시 Toast "+0.1운이 지갑에 들어왔어요 ✨" (success tone)
  6. ⚠️ TODO(server): Phase 2 Cloud Functions 로 이관 — 어뷰징 방어 (기기 fingerprint + 토스 CI)
- **구현 위치**: `src/services/storage/dailyReward.ts` (신규) · `src/components/common/DailyRewardBadge.tsx` (신규) · `src/pages/DailyFortunePage.tsx` (배지 배치)
- **근거**: 인수인계 §7.P2-5 · `런칭프로모_3원리워드.md`
- **검증**: `npx tsc --noEmit` 0 에러

---

## 🗓 우선순위

| 우선 | 티켓 | ETA | 블로커 여부 | 상태 |
|------|------|------|------------|------|
| P0-E1 | E13 결제 원자성   | 3h  | 🟥 앱인토스 심사 | ✅ 완료 (2026-04-22) |
| P0-E2 | E32 공유 비회원 OG | 2h | 🟥 앱인토스 심사 | ✅ 완료 (2026-04-22) |
| P1-E3 | E3 NotFound 보강  | 0.5h | 🟧 UX | ✅ 완료 (2026-04-22) |
| P1-E4 | E40 입력 임시저장 | 1.5h | 🟧 재진입 | ✅ 완료 (2026-04-22) |
| P2-1  | 블러 공유         | 1h  | 🟨 | ✅ 완료 (2026-04-22) |
| P2-2  | /input 재진입     | 1.5h | 🟧 | ✅ 완료 (2026-04-22) |
| P2-3  | 궁합 저장         | 2h  | 🟧 | ✅ 완료 (2026-04-22) |
| P2-4  | /chat 요금        | 1h  | 🟨 | ✅ 완료 (2026-04-22) |
| P2-5  | 데일리 리워드 UI  | 1h  | 🟧 | ✅ 완료 (2026-04-22) |

합계 ~13.5h · **완료 ~13.5h · 잔여 0h** (Path E 4종 + §7 P2 5건 모두 완결). 런칭 전 남은 작업: **(1)** `firebase deploy` 로 E13/E32 Cloud Functions 배포 + **(2)** Facebook Sharing Debugger · Slack unfurl · 카카오톡 공유 3종 E32 수동 검증 + **(3)** DevTools offline throttle 로 E13 결제 실패 시나리오 QA (a~d 4건) + **(4)** Firestore rules 에서 `status` 필드 직접 수정 차단 (Cloud Function only). 인프라 결정은 전부 끝 — 기능 구현은 준기 배포 승인 대기.

---

## 검증 체크리스트

각 티켓 완료 시:
- [ ] 해당 섹션 근거 링크 갱신
- [ ] `수용기준_체크리스트.md` 대응 AC 통과
- [ ] 접근성 (WCAG 2.1 AA): 대비 4.5:1 · 터치 44×44 · 키보드 포커스
- [ ] 앱인토스 규칙: 라이트모드 강제 · TDS 버튼 52px · IAP 분기
- [ ] tsc --noEmit 0 에러
