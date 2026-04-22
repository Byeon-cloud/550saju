# Claude Code 배포 핸드오프 — 사주500 런칭 전 빌드·배포·검증

> **작성일**: 2026-04-23
> **대상**: Claude Code (D:\550saju 로컬 저장소에서 직접 `firebase` / `npm` / `git` 실행 가능한 환경)
> **맥락**: Cowork 세션에서 PRD · 코드 · 문서 · CLAUDE.md 를 전부 정합화 완료. 배포 명령 실행권만 남겨둔 상태.
> **핵심 목표**: 2026-04-22 까지 확정된 Path E 4건 (E13·E32·E3·E40) + §7 P2 5건 + UI/톤앤매너 통일 + 10주제 SSOT + Opus 확정 상태를 **그대로 prod 에 올린다**. 과거 버전으로 회귀시키지 않는다.

---

## 0. 이 문서를 읽는 순서

1. **§1 — 회귀 방지 계약 (절대 해서는 안 되는 것들)**: 먼저 숙지. 배포 중 실수로 원복될 가능성 있는 항목.
2. **§2 — 베이스라인 상태 스냅샷**: 현재 HEAD 가 반영해야 하는 커밋·파일·상수. 다른 값이면 배포 금지, 준기에게 문의.
3. **§3 — Pre-deploy 체크리스트**: `tsc` / `vite build` / `functions build` 모두 0 에러 확인.
4. **§4 — 배포 순서 (고정)**: firestore rules → functions → hosting. 역순 절대 금지.
5. **§5 — Post-deploy QA**: E13 결제 4 시나리오 · E32 OG 3 봇 채널 · 라이트모드 · 10주제 cross-topic 모순.
6. **§6 — 롤백 절차**: git tag + firebase hosting:rollback + functions 이전 버전 복구.
7. **§7 — 장애 시 준기에게 보고하는 포맷**.

---

## 1. 회귀 방지 계약 — 절대 해서는 안 되는 것들

아래는 Claude Code 가 배포 과정에서 "어차피 의미 없으니 바꿔두자" 하기 쉬운 항목들이다. **전부 의도된 결정**이며 준기 명시 승인 없이 원복 금지.

### 1.1 AI 모델 할당 — 변경 금지
- **500원 리포트 `generateReport` = Opus 4.6** (`functions/src/ai/claudeReport.ts:18` `DEFAULT_REPORT_MODEL = 'claude-opus-4-6'`).
  - 2026-04-22 준기 "Opus로 가자" 지시로 확정. A/B 테스트 skip.
  - Sonnet 으로 내리지 말 것. 비용 계산 틀려서 어쩌구 제안도 금지.
- **확장 4종 (`claudeDaeun` · `claudeMonthly` · `claudeCompat` · `claudeTojung`) = Sonnet 4.6**.
  - 2026-04-23 영향분석 (`docs/audit/2026-04-23_Opus승격_영향분석.md`) 결과 Opus 승격은 건당 -101원 손실 → **Sonnet 유지 권고 확정**. 당분간 Opus 로 승격하지 말 것.
- **무료 퍼널 (`generateDailyFortune` · `generateChatAnswer` · `generateDream*`) = Gemini 2.5 Pro** 유지.
  - 단 `generateChatAnswer` 는 `project_model_assignment.md` 에 따라 Sonnet 4.6 로 전환이 예정되어 있으나, 아직 코드 상태가 Gemini 라면 **이번 배포 스코프 밖**. 준기 재확인 후 별도 티켓으로 처리.

### 1.2 SSOT 색상 — 수정 금지
- `--gold` **#B8965A** (프라이머리)
- `--gold-deep` **#8C6D3D** (호버/프레스)
- `--paper` **#F8F5EE** (크림 배경)
- `--ink` **#1A1A1A** (본문)
- `--mute` **#7A7269` (부가)
- **금지색**: #B8941F (머스타드 — 구 브랜드 잔재), #C9A96E · #D4A843 (구 골드).
- `src/styles/globals.css` 의 CSS 변수 + 하드코딩 39 파일이 이미 일괄 치환됨. `grep -rn "#B8941F\|#C9A96E\|#D4A843" src/` 결과가 **0건**이 정상.

### 1.3 10주제 한자 SSOT — 치환 금지
- **canonical**: 緣(love) · 復(reunion) · 婚(marriage) · 財(wealth) · 進(exam) · 業(business) · 壽(health) · 移(move) · 學(study) · 官(career)
- `src/constants/topics.ts` `TOPIC_REGISTRY` 가 유일한 진입점. 홈/FooterCTA/TopicAnalysisPage/서버 `claudeTopic.ts` 가 전부 여기서 읽음.
- legacy alias: `moving → move` · `reconciliation → reunion` · `job → career`. `normalizeTopicId` / `normalizeTopicIdServer` 로 해석. 직접 값을 건드리지 말고 alias 추가만 가능.

### 1.4 Firestore 보안 규칙 — 완화 금지
- `firestore.rules` 의 `payments/{payid}` `allow write: if false;` 는 **E13 결제 원자성의 핵심 방어선**. 절대 true 로 열지 말 것.
- 이벤트 탭 쓰기 (`attendance` · `streakAttendance` · `inviteEvents` · `shareEvents` · `rewardClaims`) 도 서버 전용. Cloud Function Admin SDK 만 기록.

### 1.5 Hosting rewrite 순서 — 바꾸지 말 것
- `firebase.json` 의 rewrites 는 반드시 아래 순서 유지:
  1. `{ "source": "/share/**", "function": "renderShareOg" }` — **먼저**
  2. `{ "source": "**", "destination": "/index.html" }` — **나중에**
- 순서 뒤집으면 SPA fallback 이 먼저 먹어서 E32 SSR 이 죽음 → 카카오톡 · Slack · Facebook unfurl 깨짐.

### 1.6 이모지 · 한자 정책
- 유저 노출 이모지 0건. `feedback_no_emoji_strict.md` 재강조 (2026-04-22). 강조는 SVG / 한자 / 컬러칩 / 텍스트 뱃지로만.
- UI 라이트 문구에 한자 금지. 리포트 본문 섹션당 한자 2~3개 이하.
- "✨ · 🎉 · 🟧 · 🕐" 같은 이모지가 UI/토스트/주석에서 발견되면 `時` 같은 한자 원형 뱃지 또는 `P0` 같은 텍스트로 치환.

### 1.7 페이지 모델 분리 — 통합 금지
- `SajuProfile` (보관함 프로필) 과 `LocalReport` (분석 결과) 는 **별개 테이블**. cascade delete 금지. `src/services/storage/localStore.ts` 의 `deleteReport` / `deleteProfile` 양쪽 NO-CASCADE 주석 유지.

---

## 2. 베이스라인 상태 스냅샷 (2026-04-22 23:59 KST 기준)

배포 시작 전 아래 사항이 HEAD 에 반영돼 있어야 한다. **한 줄이라도 어긋나면 준기에게 보고하고 중단**.

### 2.1 필수 파일 · 필수 경로
| 경로 | 상태 | 키 체크 |
|---|---|---|
| `src/pages/HomePage.tsx` | v4.1 포팅 완료 | `listTopics()` 에서 SSOT 소비. 인라인 TOPIC_COLORS 제거됨. |
| `src/pages/HomePageV5.tsx` | 신규 | `useUserPath` Path A~D 분기. `VITE_HOME_V5_ENABLED` env flag OFF 기본. |
| `src/hooks/useUserPath.ts` | 신규 | `usePathVariant` 는 `@deprecated` shim. |
| `src/constants/topics.ts` | `TOPIC_REGISTRY` 10건 | 緣 復 婚 財 進 業 壽 移 學 官 |
| `src/components/common/FooterCTA.tsx` | 3-part CTA | emblem + "전체로 보기" + "10운으로 시작" |
| `src/components/share/ShareModal.tsx` | 자물쇠+CTA 오버레이 | E32 P2-1 |
| `src/utils/share.ts` | `drawLockIcon` + 골드 CTA 배지 | 캔버스 네이티브 |
| `src/hooks/useInputDraft.ts` | 신규 | sessionStorage `saju500:input_draft:v1` · 500ms debounce · 24h TTL |
| `src/pages/InputPage.tsx` | 재진입 지원 | `editingProfileId` state + 연필 아이콘 44×44 |
| `src/pages/ChatPage.tsx` | 1운 연장 | `quotaExceeded` state + BuyCredits Modal |
| `src/pages/ResultPage.tsx` | 블러잠금 + FooterCTA | 5000원 premium 코드 0건 |
| `src/pages/DailyFortunePage.tsx` · `DreamPage.tsx` | Flippable 제거 | `LuckyColorCard` / `LuckyStatCard` 정적 |
| `src/services/storage/dailyReward.ts` | 신규 | `saju500:daily_reward:last` 월 30회 |
| `src/services/storage/compatRecents.ts` | 신규 | `saju500:compat_recents:v1` MRU 3명 |
| `functions/src/index.ts` | `confirmPayment` / `grantPurchase` 재작성 | E13 state machine |
| `functions/src/share/renderShareOg.ts` | 신규 | E32 SSR, bot/human UA 분기 |
| `firebase.json` | rewrite `/share/**` 먼저 | §1.5 참조 |
| `firestore.rules` | `payments` write:false | §1.4 참조 |

### 2.2 컴파일 검증 (배포 직전 필수)
```bash
# D:\550saju 에서
cd D:\550saju
npx tsc --noEmit -p tsconfig.json          # client, EXIT=0 이어야 함
cd functions
npx tsc --noEmit                           # functions, EXIT=0 이어야 함
cd ..
```
- 11회 누적 0 에러 상태로 Cowork 세션에서 확정됨. Claude Code 가 재확인만 하면 됨.
- 에러 발생 시 배포 중단 · 준기 보고.

### 2.3 시크릿 · 환경변수
- Cloud Functions 시크릿 이름 (`defineSecret`):
  - `ANTHROPIC_API_KEY` (Opus + Sonnet 양쪽)
  - `GOOGLE_API_KEY` (Gemini 2.5 Pro — 무료 퍼널)
  - `TOSS_SECRET_KEY` (토스페이먼츠 승인 API — `confirmPayment`)
- 배포 전 확인:
  ```bash
  firebase functions:secrets:access ANTHROPIC_API_KEY
  firebase functions:secrets:access GOOGLE_API_KEY
  firebase functions:secrets:access TOSS_SECRET_KEY
  ```
  3건 모두 응답이 오면 OK. 하나라도 missing 이면 **준기에게 secret 재주입 요청**. Claude Code 가 값 생성 금지.

### 2.4 Firebase 프로젝트
- 프로젝트 ID: `appintoss-saju` (hosting 도메인 `appintoss-saju.web.app`).
- 리전: `asia-northeast3` (functions).
- `firebase use appintoss-saju` 로 현재 프로젝트 확인 후 진행.

---

## 3. Pre-deploy 체크리스트

배포 30분 전, 아래 순서대로 실행. 모두 PASS 아니면 중단.

```bash
cd D:\550saju

# (1) git 상태 — 미커밋 변경 0건이 정상
git status
# → "nothing to commit, working tree clean" 기대

# (2) 현재 브랜치 + 최신화
git branch --show-current
# → main 또는 런칭 전용 브랜치 기대
git pull --rebase

# (3) 태그 체크포인트 (롤백용)
git tag -a "pre-launch-$(date +%Y%m%d-%H%M)" -m "pre-deploy checkpoint"

# (4) 클라이언트 tsc
npx tsc --noEmit -p tsconfig.json
echo "client tsc exit: $?"

# (5) 클라이언트 빌드
npm run build
# → dist/ 생성, 0 에러
ls -la dist/index.html dist/assets/ | head -5

# (6) functions tsc
cd functions
npx tsc --noEmit
echo "functions tsc exit: $?"

# (7) functions 빌드 (pre-deploy 훅과 동일 명령)
npm run build
# → functions/lib/ 생성
ls -la lib/index.js lib/share/renderShareOg.js
cd ..

# (8) Firestore rules 문법 체크
firebase deploy --only firestore:rules --dry-run
# → "compiled firestore rules" 메시지만 나오면 OK

# (9) functions 리스트 검증 (기대: 22개)
grep -E "^export const|^export \{" functions/src/index.ts | wc -l
# → 22 기대
```

모든 단계가 PASS 면 §4 배포 시작.

---

## 4. 배포 순서 — 절대 순서 고정

**순서: (1) Firestore rules → (2) Cloud Functions → (3) Hosting**

역순으로 하면 rules 가 느슨한 상태에서 새 클라이언트가 서빙되어 보안 구멍이 생긴다. 반드시 아래 명령 순서 유지.

### 4.1 Firestore rules 배포
```bash
firebase deploy --only firestore:rules --project appintoss-saju
```
- 기대 출력: `✔  firestore: released rules firestore.rules to cloud.firestore`
- 실패 시: §6 롤백 시작하지 말고 **rules 파일 재검토**. 파싱 에러면 콘솔 메시지로 라인번호 나옴.

### 4.2 Cloud Functions 배포
```bash
firebase deploy --only functions --project appintoss-saju
```
- 기대: 22개 함수 전부 `✔` 표시. 새로 추가된 `renderShareOg` (onRequest) 와 `confirmPayment` (재작성) · `grantPurchase` (재작성) 반드시 포함.
- 배포 시간: 대략 3~5분.
- 배포 중 일시적 5xx 가능 (기존 함수 스왑 순간). 사용자 영향 <5초.
- 실패 시:
  - 메모리/타임아웃 이슈 → 해당 함수 단일 재배포 `firebase deploy --only functions:generateReport`
  - 인증 만료 → `firebase login --reauth` 후 재시도.

### 4.3 Hosting 배포
```bash
firebase deploy --only hosting --project appintoss-saju
```
- 기대: `✔  hosting[appintoss-saju]: release complete`
- URL: https://appintoss-saju.web.app
- 배포 시간: ~1분.
- **주의**: hosting 배포 직후 CDN 캐시 전파까지 최대 5분. 즉시 구버전 보이면 당황하지 말고 incognito + cache busting (URL 끝에 `?v=1` 추가) 으로 재확인.

### 4.4 앱인토스 빌드 (별도 수동 — 준기 영역)
```bash
npm run build:ait   # 또는 ait build
```
- 토스 developer 콘솔 업로드는 준기 수동. Claude Code 는 빌드 산출물만 준비.
- 라이트모드 강제 (`<meta name="color-scheme" content="light only">` ) 확인. `index.html:9` 에 이미 반영됨.

---

## 5. Post-deploy QA — 10분 내 끝내는 4종

### 5.1 기본 sanity (2분)
- https://appintoss-saju.web.app 열기 (incognito).
- 홈 렌더링 정상 — 라이트모드 배경 크림, 골드 CTA.
- 상단 한자 로고 "사주500" 보임.
- 오늘의 운세 / 꿈해몽 카드 노출.
- 10 주제 카드 10개 (緣 復 婚 財 進 業 壽 移 學 官 한자 + 5 SSOT + 확장 4색) 모두 보임.
- console 에러 0건 (DevTools Network 200, Console 에러 없음).

### 5.2 E13 결제 원자성 4 시나리오 (3분 · 실결제는 0원 테스트 쿠폰 또는 준기 수동)
| 시나리오 | 기대 결과 |
|---|---|
| 정상 승인 | `payments/{orderId}` status=`confirmed` + `users/{uid}.balance.paid` 증가 · toast "충전 완료" |
| 유저 취소 | status=`failed` · 재시도 허용 · toast "결제가 취소됐어요" |
| Toss 승인 OK + DB write 실패 (DevTools offline 중간 차단 시뮬) | status=`needs_reconciliation` + `tossApprovedAt` 기록 · toast "고객센터 문의" |
| 같은 orderId 재요청 | 2번째는 `ALREADY_CONFIRMED` 반환 · 중복 지급 없음 |

실결제 테스트 어려우면 최소 **정상 승인** 1건만 실기 확인 후 나머지는 Firestore 콘솔에서 status 필드 존재 여부 확인.

### 5.3 E32 공유 OG SSR 3 채널 (3분)
- 공유 URL 예시: `https://appintoss-saju.web.app/share/{reportId}`
- 채널별 검증:
  1. **Facebook Sharing Debugger** (https://developers.facebook.com/tools/debug/)
     - URL 입력 · Scrape Again
     - og:title = "사주 결과 — 잠금 해제하고 전체 보기 →"
     - og:image = `/og-image.png` (또는 동적 생성된 것)
  2. **Slack** 개인 DM 에 URL 붙여넣기
     - Title/description/이미지 unfurl 정상
  3. **카카오톡** 본인 채팅방에 URL
     - 카드 형태 · 제목 · 설명 · 이미지 표기
- 크로울러 UA 로 curl 테스트 (선택):
  ```bash
  curl -A "facebookexternalhit/1.1" -s https://appintoss-saju.web.app/share/testId | grep "og:title"
  ```
  → `<meta property="og:title" content="사주 결과 ..."` 가 반환되면 SSR 작동 확인.

### 5.4 10주제 cross-topic 모순 체크 (2분)
- 동일 사주로 緣(love) 과 婚(marriage) 분석 2건 연속 실행.
- 두 결과가 **경계선 안에서만** 움직이는지 확인:
  - 연애 분석에서 "결혼" 타이밍 단정 0건
  - 결혼 분석에서 "연애 감정" 상세 묘사 0건
- 같은 검증을 進(exam) vs 官(career), 財(wealth) vs 業(business) 쌍으로도 1회씩.
- 모순 발견 시 `TOPIC_BOUNDARIES` 프롬프트에 excludes 항목 추가 필요 → 준기에게 보고.

### 5.5 라이트모드 강제 (30초)
- 크롬 DevTools → Rendering → Emulate CSS prefers-color-scheme = dark
- 그래도 라이트모드 배경 크림 유지되면 PASS. (index.html 의 `color-scheme: light only` + 앱인토스용)

---

## 6. 롤백 절차

장애 severity 기준:
- **S1 (즉시 롤백)**: 결제/환불 오류 · 500 에러 지속 · OG SSR 완전 미작동 · 컬러 깨짐 전 페이지.
- **S2 (hotfix 우선)**: 특정 페이지만 문제 · 스타일 미세 어긋남.

### 6.1 Hosting 롤백 (가장 빠름, ~30초)
```bash
firebase hosting:releases:list --project appintoss-saju
# 이전 release 확인

firebase hosting:rollback --project appintoss-saju
# 직전 release 로 자동 복구
```

### 6.2 Functions 롤백 (수동)
- Firebase 콘솔 → Functions → 문제 함수 선택 → "Revisions" 탭 → 이전 revision 에서 `...` → "Make default traffic".
- CLI 로는 `firebase functions:delete <name>` 후 이전 코드로 재배포. 시간 ~5분.

### 6.3 Firestore rules 롤백
```bash
# 이전 커밋 체크아웃해서 재배포
git checkout pre-launch-YYYYMMDD-HHMM -- firestore.rules
firebase deploy --only firestore:rules --project appintoss-saju
git checkout HEAD -- firestore.rules   # rules 원복은 별도 커밋
```

### 6.4 전체 원복
```bash
git reset --hard pre-launch-YYYYMMDD-HHMM
# dist/ 재빌드 후
firebase deploy --only firestore:rules,functions,hosting --project appintoss-saju
```
- 소요 ~8분. S1 상황에서만 사용.

---

## 7. 준기 보고 포맷

장애·이슈·의사결정 필요 시 아래 템플릿으로 보고:

```
[배포 상태] <OK / S1 / S2 / 중단>
[시점] 2026-04-23 HH:MM KST
[단계] <pre-deploy / rules / functions / hosting / QA>
[증상] <한 줄>
[영향 범위] <유저 % · 기능 · 페이지>
[로그] <console.log 요약 또는 stack trace 3줄>
[원인 추정> <가설 1~2개>
[롤백 필요 여부] <Y / N / 대기>
[준기 판단 필요 여부] <Y / N>
```

---

## 8. 배포 완료 후 후속 작업 (참고)

이번 배포 스코프 밖이지만 다음 배포 사이클에 반영할 것들:

- **P2 잔여** — 대부분 2026-04-22 에 완결됐으나 Phase 2 로 미뤄둔 항목:
  - E32 동적 OG PNG 생성 (리포트별 골드 프레임 + 이름)
  - 데일리 리워드 Cloud Function 이관 (어뷰징 방어)
  - 궁합 상대방 `users/{uid}/partners/{pid}` Firestore 이관
- **T-30 런칭 트래커** — `docs/audit/2026-04-23_런칭트래커_T30.xlsx` 의 11 시트 참조. 준기가 직접 상태 업데이트.
- **전략기획서 v3.1** — `사주500_전략기획서_v3.1.docx` (2026-04-23 생성). 투자·파트너십 자료로 사용.
- **Opus 승격 재검토 조건** — 월 호출량 임계 + blind A/B 60%+ Opus 선호 + 토큰 최적화 3조건 모두 성립 시 재검토. `docs/audit/2026-04-23_Opus승격_영향분석.md` §8.

---

## 9. 이 문서에서 다루지 않는 것

- **앱인토스 ait 빌드/토스 developer 심사**: 준기 수동. 이 문서는 웹 (Firebase Hosting) 만 커버.
- **Firebase CLI 인증**: 준기가 로컬 `firebase login` 완료된 상태를 전제. Claude Code 가 로그인 못하면 준기에게 브라우저 열어달라고 요청.
- **결제 실거래 테스트**: 준기 수동. 카드번호 · 토스 테스트 머니 필요.
- **앱스토어 · 플레이스토어**: 범위 밖.

---

## 10. 검증 서약 (Claude Code 가 배포 완료 후 기록할 것)

배포 완료 후 아래 항목을 모두 체크해 `docs/handoff/2026-04-23_배포결과.md` 에 기록:

- [ ] git tag `pre-launch-*` 생성됨
- [ ] 클라이언트 tsc EXIT=0
- [ ] functions tsc EXIT=0
- [ ] vite build 산출물 dist/ 생성
- [ ] functions/lib/ 생성 (특히 `share/renderShareOg.js`)
- [ ] Firestore rules 배포 완료 + payments write:false 유지
- [ ] 22개 함수 배포 완료 (`renderShareOg` 포함)
- [ ] Hosting 배포 완료 + `/share/**` rewrite 첫번째 순위
- [ ] 홈 렌더링 정상 + console 0 에러
- [ ] E13 정상 승인 1건 성공
- [ ] E32 Facebook Debugger OG 확인
- [ ] 10 주제 한자 (緣復婚財進業壽移學官) 모두 렌더
- [ ] SSOT 골드 `#B8965A` 단일, 머스타드 0건
- [ ] 라이트모드 강제 유지 (DevTools dark 모드에서도)

14건 중 하나라도 FAIL 이면 §6 롤백 또는 §7 준기 보고.

---

끝. 이 문서는 Claude Code 가 D:\550saju 환경에서 `firebase deploy` 를 "빈틈 없이" 실행하기 위한 단일 진입점이다. 이 문서에 없는 명령은 실행 금지. 새로운 케이스가 발견되면 준기 보고 후 이 문서에 추가한다.
