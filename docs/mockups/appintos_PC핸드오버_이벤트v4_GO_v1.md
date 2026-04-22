# PC 핸드오버 — 이벤트 탭 v4.1 Full GO (2026-04-21)

> **스탠스**: 직진. 후퇴 없음. 일정 없음. Full 8h v4 전부 구현.
> **전제**: 준기는 기획 → PC 코드 원칙. 이 문서가 기획 완결. PC는 아래 9파일 순서대로 작업.
> **컨텍스트 읽을 순서**: 이 문서 → 스펙 → 목업 → API 리서치 → 콘솔 체크리스트.

---

## 0. Q1~Q6 — 직진 답변

PC가 블로커로 올린 6개 질문에 대한 최종 답변. **후퇴·축소·지연 없음.**

### Q1. 토스 API 호출 방식 — 서버? 클라?

**답: 서버 API (executePromotion) + mTLS 인증서. 단 stub 모드로 먼저 배선.**

- SDK (`grantPromotionReward`)는 "1회 지급 100% 보장 불가" (공식 명시). 우리는 **1회 지급 보장이 절대조건**이라 쓰면 안 됨.
- 서버 API는 mTLS + idempotency 키로 중복 지급 방지.
- mTLS 인증서는 콘솔에서 즉시 발급 가능. 심사 무관.
- **핵심 트릭**: 환경변수 없으면 자동으로 STUB 목업 반환하는 클라이언트 어댑터로 구현. 심사 통과 후 Secrets 주입만으로 LIVE 전환.

상세: `appintos_토스포인트_API_리서치_v1.md` §3, §6.

---

### Q2. 공유 리워드 콜백 처리

**답: 기존 스펙 유지. `onShareRewardGranted` 이벤트 훅으로 1운 적립. 변동 없음.**

- 공유 CTA 클릭 → 앱인토스 SDK `share({rewardId})` → 성공 시 콜백 수신
- Cloud Function `onShareRewardGranted` 에서 `users/{uid}/shareEvents/{YYYY-MM-DD}` 생성 + `unBalance` +1
- 일 3회 서버 가드 (v3 기존 규칙 유지, v4에서 변경 없음)
- 이건 v4 변경 범위 밖. 기존 코드 그대로.

---

### Q3. onContentCompleted 트리거 — 출석 판정은 언제?

**답: 결과 페이지 렌더링 완료 직후. 한 번만. 그 날짜(KST) 최초 1회만.**

구현 상세:
```typescript
// ResultPage.tsx (무료·500원·5000원 공통)
useEffect(() => {
  if (isResultLoaded) {
    markAttendance(uid); // Cloud Function 호출
  }
}, [isResultLoaded]);
```

Cloud Function `markAttendance`:
- `attendance/{YYYY-MM-DD}` 문서 존재 체크 → 있으면 no-op (하루 1회만)
- 없으면 생성 + `streakAttendance/current` 업데이트 (이동윈도우 갱신)
- 7일 누적 체크 → 완주 시 `claimWeeklyTossPoint` 트리거

**무료·500원·5000원 구분 없음**. 콘텐츠 뷰 = 출석 1일. 사주 입력만으론 불인정(`project_event_tab_strategy.md` §34).

---

### Q4. Firestore 보안 규칙

**답: rewardClaims 서브컬렉션은 클라 읽기 허용·쓰기 금지. 쓰기는 Cloud Functions admin SDK만.**

```javascript
// firestore.rules
match /users/{uid}/rewardClaims/{claimId} {
  allow read: if request.auth.uid == uid;
  allow write: if false; // 서버만 기록
}

match /users/{uid}/streakAttendance/{docId} {
  allow read: if request.auth.uid == uid;
  allow write: if false;
}

match /users/{uid}/attendance/{date} {
  allow read: if request.auth.uid == uid;
  allow write: if false;
}

match /users/{uid}/inviteEvents/{date} {
  allow read: if request.auth.uid == uid;
  allow write: if false;
}

match /users/{uid}/shareEvents/{date} {
  allow read: if request.auth.uid == uid;
  allow write: if false;
}
```

---

### Q5. 시간·범위

**답: 일정 없음. Full 8h v4 전부.**

준기 원문: "일정같은거 없어. 계속 진행해."

"UI-only 4h 후퇴" 제안 **전면 기각**. 구현 범위는 `사주500_UI개편_09_이벤트_v4.md` 전체. 타협 없음.

우선순위 (의존성 기준 자연 정렬, 일정 아님):
1. Firestore 스키마 · 보안 규칙
2. Cloud Functions 4종 (`markAttendance`, `claimStreakReward`, `claimWeeklyTossPoint`, `onInviteReceived`)
3. 앱인토스 클라이언트 (STUB 모드)
4. EventsPage.tsx UI (streak 이동윈도우 + 누적 운 블록)
5. Tier A/B 연출
6. 테스트 — 이벤트 탭 단독 + 결과 페이지 연동

---

### Q6. 기존 v3 MVP와의 관계

**답: v3는 덮어쓰기. 아카이브 주석만 남기고 v4가 prod.**

- 기존 `EventsPage.tsx` → v4 사양으로 전면 재작성
- 기존 Firestore 문서들 (`attendance_daily/` 등) → 마이그레이션 불필요 (런칭 전이라 데이터 없음)
- 기존 v3 목업 `사주500_UI개편_목업_이벤트_v3.html` → 파일명에 `_deprecated` 추가 or 삭제
- 기존 스펙 `사주500_UI개편_09_이벤트_v3.md` → 맨 위에 `> DEPRECATED · v4로 이관됨` 주석 후 유지

**혼란 방지**: prod 브랜치에서 v3 파일 참조 금지. v4만.

---

## 1. 작업 파일 9종 (D:\550saju 기준)

### A. Firestore 규칙

**1. `firestore.rules`** (전면 수정)
- 위 Q4 답변의 규칙 그대로 추가
- 기존 유저 프로필·사주·결과 규칙은 건드리지 말 것

---

### B. Cloud Functions (신규 4종)

**2. `functions/src/attendance/markAttendance.ts`** (신규)
- callable. 인증 필요.
- 오늘(KST) `attendance/{YYYY-MM-DD}` 생성 (없을 때만)
- `streakAttendance/current` 업데이트:
  - 어제 출석 있으면 streak++, 없으면 streak=1
  - 3일 연속 달성 시 `claimStreakReward` 내부 호출
- 7일 누적 체크 (주월~일 기준) → 완주 시 `claimWeeklyTossPoint` 내부 호출

**3. `functions/src/attendance/claimStreakReward.ts`** (신규)
- 내부 함수 (직접 호출 X, `markAttendance` 경유)
- idempotency: `streak_{uid}_{streakStartDate}` 문서 체크
- 신규면 `unBalance` +1, `rewardClaims` 기록 (`type: "attendance_streak3"`)
- Tier A 토스트 트리거 (클라 리턴값)

**4. `functions/src/attendance/claimWeeklyTossPoint.ts`** (신규)
- 내부 함수
- idempotency: `tosspoint_week7_{uid}_{weekKey}` 문서 체크
- 7일 출석 재검증 (방어)
- `getUserKey` → `grantTossPoint` 호출
- 성공 시 `rewardClaims` 기록 (`type: "attendance_week7_tosspoint"`, `currency: "TOSSPOINT"`, `amount: 100`)
- 실패 3회 재시도 후 폴백: `unBalance` +2 + 백오피스 알림 (`type: "attendance_week7_fallback"`)
- Tier B 모달 트리거 (클라 리턴값)

**5. `functions/src/invite/onInviteReceived.ts`** (신규 or 기존 수정)
- 앱인토스 초대 콜백 수신
- 같은 날 `inviteEvents/{YYYY-MM-DD}` 체크 → `dailyCount >= 3` 이면 거절
- 통과 시 `unBalance` +1, `inviteEvents.dailyCount` 증가
- Tier A 토스트 트리거

**6. `functions/src/shared/appintosClient.ts`** (신규)
- `appintos_토스포인트_API_리서치_v1.md` §6 코드 그대로 복사
- STUB 모드 자동 폴백 (환경변수 부재 시)
- `grantTossPoint`, `getUserKey` export

---

### C. 프론트 UI (EventsPage.tsx)

**7. `src/pages/EventsPage.tsx`** (전면 재작성)
- 섹션 구조 (v4 목업 `사주500_UI개편_목업_이벤트_v4.html` 그대로):
  - Block 1: 히어로 — "오늘도 오셨군요" + streak 이동윈도우 (3칸 도트)
  - Block 2: 주간 체크 (월~일 7칸 + 7일 완주 보상 안내 "토스포인트 100원")
  - Block 3: 친구 초대 — 하루 3회 · 초대당 1운 (카운터 "오늘 0/3회")
  - Block 4: 공유 미션 — 하루 3회 · 공유당 1운
  - **Block 5: 누적 운 카드** (하단 CTA 교체) — 총 운 + 출처별 + 토스포인트 별도 라인
- streak 이동윈도우 라벨 로직 (3칸):
  - `streak ∈ {0, 1}`: `[오늘, 내일, 모레]`
  - `streak == 2`: `[어제, 오늘, 내일]`
  - `streak >= 3`: `[그제, 어제, 오늘]` (달성 후 리셋되며 Day 0로)
  - 끊김 상태: `[오늘, 내일, 모레]` + 안내문 "연속이 끊겼어요. 오늘 다시 시작해요"
- 누적 운 카드:
  - Firestore `users/{uid}/rewardClaims` where `currency != "TOSSPOINT"` 합산 → "지금까지 받은 운 147"
  - 출처별 내림차순 (출석 / 초대 / 공유 / 기타)
  - 토스포인트 별도 라인: "토스포인트 100원 × N회 수령"
- **하단 CTA 버튼 2개(오늘의운세/꿈해몽) 제거** — Block 5가 대체
- 이모지 0개. SVG 픽토그램만.

---

### D. 연출 컴포넌트

**8. `src/components/events/TierAToast.tsx`** (신규 or 재활용)
- 1.2초 자동 사라지는 상단 토스트
- 메시지 프롭: `"운 {n} 들어왔어요"` (streak·초대·공유 공통)
- 애니메이션: slide-in from top → fade out

**9. `src/components/events/TierBModal.tsx`** (신규)
- 풀스크린 모달
- 콘텐츠: 네잎클로버 SVG + 한자카드 `天乙貴人` + "토스포인트 100원 · 토스 앱에서 확인해주세요"
- 닫기 버튼 1개
- 7일 완주 시에만 등장

---

## 2. 구현 순서 (의존성 기반)

```
1. firestore.rules 갱신 + 배포
   ↓
2. shared/appintosClient.ts 작성 (STUB 모드)
   ↓
3. claimStreakReward · claimWeeklyTossPoint · onInviteReceived 작성
   ↓
4. markAttendance 작성 (위 3종 내부 호출)
   ↓
5. Functions 배포 (STUB 모드로 자동 동작)
   ↓
6. EventsPage.tsx 재작성 + 두 Tier 컴포넌트
   ↓
7. 결과 페이지 (ResultPage.tsx) 에 `markAttendance` 호출 훅 추가
   ↓
8. QA — 이벤트 탭 단독 시나리오 4개 (Day 0 → Day 7)
```

---

## 3. 검증 시나리오 (QA 자동화 or 수동)

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | Day 0 → Day 1: 결과 페이지 1회 뷰 | attendance 1건·streak=1·label `[오늘,내일,모레]` |
| 2 | Day 1 → Day 2 연속: 뷰 | streak=2·label `[어제,오늘,내일]` |
| 3 | Day 2 → Day 3 연속: 뷰 | streak=3 달성→Tier A 토스트 "운 1"·label `[그제,어제,오늘]`·다음날 리셋 |
| 4 | Day 0 → Day 2 (하루 빠짐) | streak=1·라벨 `[오늘,내일,모레]` + "연속이 끊겼어요" |
| 5 | Day 1 ~ Day 7 전부 출석 | 7일째 claimWeeklyTossPoint 호출 → Tier B 모달 + rewardClaims `tossTxId: "STUB_..."` |
| 6 | Day 7 재진입 | idempotency 히트 → 지급 안 됨·모달 없음 |
| 7 | 친구 초대 콜백 3회 | 3운 적립·4회째 거절 |
| 8 | 환경변수 미주입 상태 Firestore rewardClaims 확인 | `tossTxId: "STUB_..."` 기록·실포인트 지급 안 됨 |

---

## 4. 커밋 단위 제안

```
feat(events): add v4 Firestore rules + security for rewardClaims
feat(events): add appintosClient stub with mTLS adapter
feat(events): add markAttendance callable with streak window logic
feat(events): add claimStreakReward + claimWeeklyTossPoint idempotency
feat(events): add onInviteReceived with daily 3-count cap
feat(events): rewrite EventsPage with moving window streak + block5
feat(events): add TierA toast + TierB modal components
feat(events): hook markAttendance in ResultPage render
test(events): add integration test for 7-day completion flow
```

각 커밋 후 emulator 테스트 → `reference_local_validation_cycle.md` D4.5 절차 준수.

---

## 5. 기획자(준기) 측 동시 진행

준기는 `appintos_콘솔체크리스트_준기.md` 1~5번 진행. PC는 이 진행 상황에 블로킹되지 않고 STUB 모드로 구현·배포까지 완수.

준기 완료 신호: **"토스포인트 실지급 스위치 ON. Secrets 주입 완료. TEST_ 검증 OK."**

PC 수신 후:
1. Firebase Functions 재배포 (Secrets 바인딩)
2. STUB → LIVE 자동 전환 (환경변수 존재 여부로 분기)
3. 카나리 1건 실지급 → rewardClaims `tossTxId` 실제 키 확인
4. 전체 공개

---

## 6. 참고 파일 (읽기 순서)

1. **이 문서** — 한 눈 요약·답변·작업 리스트
2. `사주500_UI개편_09_이벤트_v4.md` — 스펙 완결본
3. `사주500_UI개편_목업_이벤트_v4.html` — UI 목업 4프레임
4. `appintos_토스포인트_API_리서치_v1.md` — API 풀스펙 + stub 패턴
5. `appintos_콘솔체크리스트_준기.md` — 준기 진행 (참고)
6. `appintos_출시전_테스트_플로우_v1.md` — Phase E 검증 시나리오

모두 Cowork 폴더 `C:\...\사주 500`에 있음. D:\550saju prod repo에 복사 필요시 작업 후 삭제.

---

## 7. 금지 사항 (PC 실수 방지)

- 이모지·emoji 문자 추가 금지. SVG만.
- 운 2 보상 시스템 **살려두지 말 것**. 7일 완주는 토스포인트 100원 고정. 폴백일 때만 운 2.
- v3 스펙·목업 참조 금지.
- 프로모션코드 하드코딩 금지. **반드시 환경변수**.
- mTLS 인증서 파일을 Git 커밋 금지 (`.gitignore` 확인).
- "주 1회 0.5운 초대" 같은 v3 스펙 재등장 금지. "하루 3회 · 1운/초대"가 v4.
- streak와 cumulative를 같은 7칸 바에 묶지 말 것. UI 블록 분리.
- 하단 CTA 2버튼 (오늘의운세/꿈해몽) **추가하지 말 것**. Block 5로 교체 완료.

---

## 8. 한 줄 요약 (PC에게 던질 메시지)

> **"이벤트 탭 v4.1 Full GO. 위 9파일 순서대로 구현. API는 STUB 모드로 먼저. 준기가 심사+인증서 준비 중. 후퇴·축소·일정 고려 없음. 결과 페이지 connectivity까지 완주하면 됨."**
