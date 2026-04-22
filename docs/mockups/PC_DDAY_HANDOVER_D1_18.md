# PC Claude Code · D-1 18시 한 방 핸드오버

**작성:** 2026-04-21 D-1
**준기 → PC Claude Code에 그대로 복붙해서 던질 단일 메시지.**
**목표:** D-Day 00시 오픈 전까지 코드/회신 7건 완료. 18시 회신·22시 검증 완료.

---

준기가 복붙할 본문 시작 ↓↓↓

---

## 안녕. D-1 오후다. 18시까지 아래 7건 처리 부탁한다.

### 우선순위 1 — 코드 작업 4건 (오늘 18시까지 commit + 배포)

#### A. 토스페이 단일화 (앱인토스 빌드)
스펙 전문: `사주 500/PC_PATCH_A_TOSSPAY_SIMPLIFY.md`

요지:
- `src/lib/env.ts`에 `isAppintosBuild` 환경 감지 함수 추가 (`VITE_BUILD_TARGET=appintos` 또는 UA `InTossApp`)
- `/charge` 결제 옵션을 `isAppintosBuild`일 때 **토스페이 1개**, 웹앱일 때 **4종**으로 분기
- 라벨도 분기: 앱인토스 = "토스페이로 결제", 웹앱 = "결제"
- `/my/history/charge`에 provider="toss" 라벨 "토스페이" 노출
- `/charge` Notice에 환불 안내 1줄 추가

테스트:
- `VITE_BUILD_TARGET=appintos` 빌드 → 결제 옵션 1개만
- `VITE_BUILD_TARGET=webapp` 빌드 → 4개 그대로

#### B. 사주대화 Safety Guard
스펙 전문: `사주 500/PC_PATCH_B_CHAT_SAFETY_GUARD.md`

요지:
- `functions/src/prompts/chat.ts`에 §3 시스템 프롬프트 그대로 반영 (이미 완본 작성돼 있음)
- 서버에서 응답 첫 토큰 `[GUARD]` 감지 → 잔액 환원 + `guard_hits` Firestore 콜렉션 로깅
- 우회 10건 + 대조 3건 테스트 작성, 13건 모두 통과 확인 후 배포

핵심 코드:
```ts
const isGuarded = assistantText.trimStart().startsWith('[GUARD]');
if (isGuarded) {
  await logGuardHit(userId, userMessage, response.usage);
  return { text: assistantText.replace('[GUARD]', '').trim(), consumed: 0 };
}
await chargeCredit(userId, 1);
```

#### C. Safe Area + TopBar 분기 + 360 폭 패치
스펙 전문: `사주 500/audit_responsive_360x640.md`

요지:
- 전역 CSS `_safe-area.css` 한 장 만들고 `balance-bar`, `tabbar`, `checkout` 패딩에 `env(safe-area-inset-*)` 적용 (감사 §5-2 코드 그대로)
- `TopBar` 컴포넌트에 `showBack={!isAppintosBuild}` 분기 — 앱인토스 네이티브 뒤로가기와 중복 노출 방지
- 모든 `.phone` `.frame` 클래스에 `max-width: 100%` 추가 (목업 두 곳은 이미 패치 완료, 실제 React 컴포넌트도 동일하게)

#### D. 무료 결과 페이지 fine-print 출처 1줄
요지:
- `src/pages/Result/Free/TodayFortune.tsx` 와 `DreamMeaning.tsx` footer 위에:
  ```
  『적천수』·한국 명리학 문헌 기반
  ```
  fine-print 1줄 추가
- 디스클레이머 ("사주는 참고용이며 결정은 본인 몫") 는 이미 목업 v2에 있고, 실제 React 페이지에도 같은 문구 들어갔는지만 확인

---

### 우선순위 2 — 회신 5건 (18시까지 답만 줘도 됨)

`사주 500/audit_60_self_stamp_sheet.md`의 ⛔ 5건 해제용. 한 줄씩 답해 주면 된다.

```
1. localStorage 키 인벤토리 — 생년월일·이름·시간 0건인지 (4-06)
   답: [키 목록 또는 "민감정보 0건 확인"]

2. eval / new Function / setTimeout("string") grep 결과 — 빌드 산출물(dist/) 기준 (4-01)
   답: [count 또는 "0건"]

3. 토스페이 결제 한도 — SDK 디폴트 따르는지, 콘솔 별도 설정 필요한지 (1-13)
   답: [디폴트 / 콘솔 설정 X운/일]

4. Firestore 사주 데이터 — 추가 client-side 암호화 적용했는지, 안 했으면 Firebase encryption-at-rest로 검수 응답 가능한지 (1-08)
   답: [적용 X — 관리형 KMS 의존 / 적용 O]

5. 결제 → 잔액 갱신 → 결과 페이지 e2e — iPhone SE(375×667) 또는 Galaxy S10(360×760) 시뮬레이터에서 1회 통과 캡쳐 (3-09)
   답: [캡쳐 첨부 또는 "통과 확인"]
```

---

### 우선순위 3 — D-1 22시 검증

위 4건 commit·배포 후, prod에서 다음 확인:

```
[ ] 앱인토스 프리뷰 환경 (UA 시뮬) → /charge 토스페이 1종만 보임
[ ] 웹앱 → /charge 4종 그대로
[ ] /chat에서 우회 10건 입력 → 모두 [GUARD] 시작 + 잔액 0 소비
[ ] /chat 대조 3건 → 정상 응답 + 잔액 1 소비
[ ] /charge prod 토스페이 결제 1건 실측 (1만원 → 30운, 결제 후 환불)
[ ] DevTools 360×640 → 홈·결과·충전·이벤트 4페이지 가로 스크롤 0
[ ] 무료 결과 페이지 footer 위 fine-print 2줄 (디스클레이머 + 출처) 노출
```

22시까지 위 7개 모두 ✓ + ⛔ 5건 답변 완료 시 D-Day 오픈 진행. 미달이면 즉시 알려줘.

---

### 보조 — 시간 남으면 (P3)

- `guard_hits` Firestore 콜렉션 인덱스 (userId · at desc) 생성
- 무료 일일 할당 (오늘운세·꿈해몽 1일 1회) 카운터 동작 prod 1회 검증
- 충전 v2 갭리포트 (`사주500_UI개편_충전_갭리포트.md`) 미반영 항목 잔여 정리

---

부탁한다. 18시 회신, 22시 검증 완료 기준으로 D-Day 00시 오픈한다. 막히는 항목은 전체 보류 말고 그 항목만 빠르게 핑.

---

준기가 복붙할 본문 끝 ↑↑↑

---

## 메시지 전달 후 준기 동선

| 시각 | 준기 | PC |
|---|---|---|
| 지금~18시 | 메시지 던지고 다른 일 | 4건 코드 + 5건 회신 |
| 18시 | 회신 5건 받아서 `audit_60_self_stamp_sheet.md`에 ✅ 도장 | 코드 마무리 + 배포 |
| 22시 | 검증 7건 PC가 ✓ 보내주면 OK 회신 | prod 검증 |
| 23시 | D-1 카피 A1·A3 스레드/X 예약 등록 (`launch_copy_d1_dday_v1.md` §2) | — |
| 23:30 | 인스타 스토리 A4 게시 + 카운트다운 스티커 4시간 활성화 | 대기 |
| D-Day 00:00 | B1 스레드/X 게시 (복붙) | prod 모니터링 |
| 00:05 | B2 인스타 스토리 게시 | — |
