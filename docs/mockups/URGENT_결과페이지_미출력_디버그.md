# URGENT — 결과 페이지 미출력 디버그 (오늘운세·꿈해몽·전체)

**상황 (2026-04-21):** Anthropic/Gemini API 크레딧 충전 완료했음에도 오늘의 운세·꿈해몽·주제별·프리미엄 **전부 결과 미출력**. 즉 billing 문제가 아니라 다른 원인이 섞여 있을 가능성 큼.

**우선순위 — P-1 (β 모드 외 최우선).** 결과가 안 나오면 나머지 UI/이벤트/검수는 전부 무의미.

---

## 1. 60초 안에 먼저 확인할 것 (5가지 — 순서대로)

### ① Functions 배포 반영 상태
```bash
cd D:\550saju\functions
firebase functions:list
firebase functions:log --only generateTodayFortune --limit 50
firebase functions:log --only generateDreamInterpretation --limit 50
firebase functions:log --only generateChatAnswer --limit 50
```

- **보는 포인트 1**: 최근 로그에 `401` / `403` / `invalid_api_key` / `authentication_error` 있는지
- **보는 포인트 2**: `429 rate_limit` / `insufficient_quota` 있는지 (크레딧 충전 반영 지연일 수 있음)
- **보는 포인트 3**: `model not found` / `404` — 모델 이름 오타 (예: `claude-sonnet-4-6` vs `claude-sonnet-4.6`)
- **보는 포인트 4**: `timeout` / `cold start` — 60s 초과
- **보는 포인트 5**: `responseSchema validation failed` — 스키마 변경 영향

### ② 환경변수 실제 반영
```bash
firebase functions:config:get
# 또는 v2면
firebase functions:secrets:access ANTHROPIC_API_KEY
firebase functions:secrets:access GEMINI_API_KEY
```

- **공백·개행 들어갔는지** 체크 (`sk-ant-…` 뒤 개행 하나 있으면 전부 401)
- 키 변경했으면 **함수 재배포 필수** — secret 로테이트 후 재배포 안 하면 이전 키 그대로 사용됨:
  ```bash
  firebase deploy --only functions:generateTodayFortune,functions:generateDreamInterpretation,functions:generateChatAnswer
  ```

### ③ 브라우저 Network 탭 실측
- 결과 페이지 진입 → F12 → Network → `/generate*` 호출 상태 코드
- **Request payload**: 사주 8자 · 생년월일 포함됐는지
- **Response**: 빈 문자열? JSON 오류? CORS preflight 실패?

### ④ Firestore 로그·사용량 확인
- `guard_hits` 콜렉션에 최근 1시간 엔트리 급증 → Layer 1 키워드가 잘못 걸리고 있는 것 (예: 정상 질문도 regex에 걸림)
- `usage/{YYYY-MM-DD}` · 에러 카운트
- Firestore rules 변경 여부 (읽기 거부 → 결과 저장 실패 → 렌더 안 됨)

### ⑤ 프론트 에러
- 콘솔에 `Failed to parse response` / `unexpected token` / `Cannot read properties of undefined` 있는지
- 결과 페이지 React 렌더에서 `result.sections` 등이 undefined일 때 전체 크래시 → 흰 화면
- Sentry/Firebase Crashlytics 있으면 그쪽 먼저 확인

---

## 2. 후보 원인 빠른 배제표

| 원인 후보 | 검증 방법 | 조치 |
|---|---|---|
| A. API 키 만료/오타 | Functions 로그 401 | secret 재발급 → 재배포 |
| B. 모델 이름 오타 | 로그 404/model_not_found | `claude-sonnet-4-5-20250929` 등 공식 ID 확인 · 배포 |
| C. 크레딧 반영 지연 | Anthropic Console 잔액 확인 | 10분 대기 후 재시도 · 안 되면 Anthropic 지원 문의 |
| D. 재배포 누락 | functions:log 에 구버전 코드 흔적 | 전체 재배포 |
| E. responseSchema 변경 후 파싱 실패 | 로그 `validation_error` | 스키마와 프롬프트 재정합 |
| F. CORS | Network 탭 preflight 실패 | `functions.region('asia-northeast3')` · cors 미들웨어 |
| G. Firestore rules | 결과 저장 403 | rules 롤백 또는 수정 |
| H. Guard Layer 1 오탐 | guard_hits 급증 | 정규식 FP 검증 (5건 샘플) |
| I. 프론트 크래시 | 콘솔 undefined read | 디펜시브 렌더링 (`?.` · null 체크) |

---

## 3. PC가 해야 할 것 — 15분 내 회신

다음 5개 체크리스트 결과를 한 번에 회신해줘:

```
[1] firebase functions:log --only <3개 함수> 마지막 50줄 요약 (어떤 에러 코드가 있나)
[2] Anthropic Console 크레딧 잔액 스크린샷 또는 수치
[3] 브라우저 F12 Network 탭에서 /generate 호출 상태 코드
[4] guard_hits 콜렉션 최근 1시간 엔트리 수
[5] 현재 배포된 함수 버전 (firebase functions:list 에 표시된 update 시각)
```

회신 받으면 원인 특정 후 핫픽스 즉시 던짐.

---

## 4. 핫픽스 템플릿 (원인별)

### 원인 A (API 키 401)
```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
# 프롬프트에 새 키 입력 (개행 없이)
firebase deploy --only functions
```

### 원인 B (모델 이름)
`functions/src/ai/*.ts` 에서 model 문자열 확인:
- Anthropic: `claude-sonnet-4-5-20250929`, `claude-opus-4-5`, `claude-haiku-4-5`
- Gemini (사주대화 β 모드 잔존): `gemini-2.0-flash-exp` 또는 사용 중인 ID

### 원인 D (재배포 누락)
```bash
firebase deploy --only functions --force
```

### 원인 H (Guard 오탐)
`functions/src/ai/geminiChat.ts` GUARD_KEYWORDS regex 중 사주 도메인 단어 단독 매칭 있는지 확인:
- `단명` 단독 매칭 → FP. `단명.*(편한|나아|좋|차라리|어차피)` 로만 매칭해야
- `죽음` 단독 매칭 → FP. 의도결합형 필요

---

## 5. 회피 옵션 (핫픽스 전)

만약 원인 특정까지 시간 걸리면:
- **임시 서킷 브레이커**: 결과 페이지 진입 시 "지금 AI가 과부하 상태입니다. 운이 소비되지 않았으니 잠시 후 다시 시도해주세요." 안내 + consumed=0 보장
- 이미 consumed 된 1건은 Firestore에서 수동 복구 (`rewardClaims` 역전표)

---

**핵심: β UI 작업·이벤트 v4·프로모션 테스트 전부 중단하지 말고, 결과 출력 복구는 최우선 **병렬**로 처리. 결과 안 나오는 상태로는 앱인토스 검수 제출 절대 불가.**
