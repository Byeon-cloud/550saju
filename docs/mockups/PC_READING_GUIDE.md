# PC Claude Code · 폴더 읽기 가이드 (β 모드 · 18~24h 풀 반영)

**준기 → PC에 이 파일 경로 + "이 파일 그대로 따라가" 한 줄로 전달.**

---

## 0. 두 폴더 — 역할 분리

| 폴더 | 경로 | 역할 | PC 권한 |
|---|---|---|---|
| **스펙 폴더** | `C:\Users\quswn\OneDrive\Documents\Claude\Projects\사주 500` | 기획·스펙·목업·UX라이팅 MD 모음. 코드 0줄 | **읽기 전용** |
| **prod 저장소** | `D:\550saju` | 실제 React/TS/Firebase 소스코드. git repo | **읽기 + 수정 + 커밋** |

### 동선

```
1. 읽기:  C:\Users\quswn\OneDrive\Documents\Claude\Projects\사주 500  (스펙)
2. 수정:  D:\550saju                                                   (코드)
3. 커밋:  D:\550saju 안에서 git commit + push
```

### 주의
- **C 드라이브 스펙 폴더는 절대 수정하지 마라.** OneDrive 실시간 동기화 중이고 Cowork(Claude)가 동시에 파일 생성·수정 중일 수 있음. 충돌 발생 시 스펙 원본 유실 가능
- PC가 스펙에 대해 피드백·수정 제안하고 싶으면 repo 안(D:\550saju) 어딘가에 `feedback_to_cowork.md` 같은 파일로 남겨라. 준기가 그걸 Cowork에 전달한다
- 모든 신규 파일 생성은 D:\550saju 안에서만

---

## 1. 읽는 순서 (먼저 읽어야 나머지가 이해됨)

### 1단계 — 전체 지도 (15분)

```
1. 사주500_UI개편_00_마스터.md        ← 전체 14개 문서 인덱스. 여기서 뭐가 있는지 먼저 본다
2. pre_launch_total_audit_v1.md       ← 지금 상황 전수조사 (P0 24건)
3. audit_60_self_stamp_sheet.md       ← 검수 60항목 상태
4. 사주500_UI개편_08_앱인토스검수체크리스트.md  ← 검수 원본 기준
```

### 2단계 — 현재 prod와 갭 측정 (30분 — PC가 먼저 해야 할 작업)

PC가 구현 들어가기 전 반드시:

```
A. repo의 현재 UI 스냅샷 파악
   - 홈·입력·결과·충전·이벤트·내정보·보관함·사주대화 각 페이지 현재 상태
B. 이 폴더의 목업과 대조
   - 목업 HTML 8개를 보고 각 페이지가 얼마나 다른지 판정
C. 갭 리스트 준기에게 회신 (30분)
   - "홈: v3 목업 기준으로 XX% 교체 필요 / 충전: v2 목업 기준 대부분 교체 / ..."
```

이 회신 받고 준기가 β 반영 범위를 최종 조정한다.

---

## 2. 오늘 β 모드 구현 순서 (18~24h)

우선순위 P0 → P1 → P2 순. 각 단계 완료 후 커밋 1개씩.

### P0 — 검수 필수 (반드시 오늘 안, 4~5h)

| 순 | 작업 | 참조 파일 | 예상 |
|---|---|---|---|
| 1 | localStorage → sessionStorage 민감 필드 마이그레이션 | PC_PASTE_BUNDLE_specs.md 결정 1 | 30m |
| 2 | 토스페이 단일화 (앱인토스 빌드) | PC_PATCH_A_TOSSPAY_SIMPLIFY.md | 45m |
| 3 | 사주대화 Safety Guard + 13건 테스트 | PC_PATCH_B_CHAT_SAFETY_GUARD.md | 90m |
| 4 | Safe Area 전역 CSS + TopBar 분기 + `max-width:100%` | audit_responsive_360x640.md §5~§7 | 30m |
| 5 | 결과 페이지 footer 디스클레이머·출처 (4종 React 반영) | 사주500_UI개편_03_결과.md + 목업 4종 | 30m |
| 6 | 개인정보처리방침 문구 업데이트 (sessionStorage 명시) | PC_PASTE_BUNDLE_specs.md 결정 1 | 15m |

### P1 — UI 개편 전면 반영 (β 모드 핵심, 10~14h)

| 순 | 작업 | 스펙 문서 | 목업 HTML | 예상 |
|---|---|---|---|---|
| 7 | 홈 v3 전면 교체 (듀얼 메인 + 후기 캐러셀) | 사주500_UI개편_01_홈.md | 사주500_UI개편_목업_홈_v3.html | 2h |
| 8 | 입력 페이지 v1 (KR 시간 보정 ±30분) | 사주500_UI개편_08_사주분석입력.md · kr_time_correction_ux_copy_v2.md | 사주500_UI개편_목업_입력_v1.html | 2h |
| 9 | 충전 v2 (CheckoutBar·환율 노출·HeroBar) | 사주500_UI개편_07_운충전.md · 사주500_UI개편_충전_갭리포트.md | 사주500_UI개편_목업_충전_v2.html | 2h |
| 10 | 결과 4종 v2 (오늘운세·꿈해몽·1운·프리미엄) | 사주500_UI개편_03_결과.md | 목업_무료_오늘의운세_v2 · 꿈해몽_v2 · 1운_주제별재물_v2 · 결과프리미엄_v2 | 2.5h |
| 11 | 이벤트 탭 v3 (주간 누적 4일·7일) | 사주500_UI개편_09_이벤트.md | 사주500_UI개편_목업_이벤트_v3.html | 1.5h |
| 12 | 사주대화 페이지 UI (격식체 60%·한자 3개 이내) | 사주500_UI개편_06_사주대화.md | 사주500_UI개편_목업_사주대화.html | 1h |
| 13 | 내정보 / 보관함 / 후기 16개 | 사주500_UI개편_04_내정보.md · 05_보관함.md · 02_후기16개.md | — (필요 시 디자인 결정) | 1.5h |
| 14 | 로딩 UX 3티어 (스켈레톤·스트리밍·풀스크린) | 사주500_UI개편_11_로딩UX_스펙.md | 사주500_UI개편_목업_로딩_v1.html | 1h |

### P2 — 검증 + 출시 준비 (2~3h)

| 순 | 작업 | 예상 |
|---|---|---|
| 15 | Playwright 설치 + e2e 1트랙 (입력→무료결과→공유→결제→유료결과) | 30m |
| 16 | 360×640 DevTools 수동 스캔 — 홈·입력·충전·결과·이벤트 | 30m |
| 17 | 전체 prod 빌드 + Firebase deploy | 30m |
| 18 | prod smoke test — 결제 1건 실측 / 사주대화 1턴 / 공유 리워드 1건 | 30m |
| 19 | 커밋 3개 분리 + push (1단계 디자인토큰 / 5단계 HomePage / 신규 UI 개편) | 30m |

---

## 3. 참조 문서 맵 (작업할 때 옆에 펼쳐둘 것)

### 브랜드·디자인
- `design_system_v4_consolidated.md` — 토큰·팔레트·타이포 (#B8965A / #1D2D4A / #F8F5EE / Noto Serif KR)
- `ux_writing_global_copy_book.md` — 글로벌 카피·금지어

### 콘텐츠·톤
- `사주500_UI개편_10_UX라이팅_자가심사.md` — 톤 체크 기준
- `사주500_UI개편_12_콘텐츠퀄리티_심사기준_v1.md` — 결과 콘텐츠 퀄리티 바
- `blurred_reviews_seed_v1.md` — 후기 16개 시드 (이름 제거·연령/성별만)

### 검수·법무
- `사주500_UI개편_08_앱인토스검수체크리스트.md` — 검수 원본 기준
- `사주500_UI개편_13_앱인토스메타_콘솔등록.md` — 메타값 확정
- `audit_60_self_stamp_sheet.md` — 60항목 현재 상태

### 정책·기능
- `사주500_UI개편_09_PDF서버엔드포인트.md` — 5000원 결과 PDF 스펙
- `사주500_appintos_IA_v1.md` — 5탭 IA
- `사주500_flowchart_userflow.html` — 유저 플로우

### 전략·벤치마크 (읽지 않아도 구현은 가능, 참고용)
- `strategy_5tracks_handover.md`
- `사주500_트랙1_한국3사_매트릭스_v1.md`
- `사주500_트랙2_일본중국_경쟁사_v1.md`
- `사주500_트랙4_해자_5층_심화_v1.md`

---

## 4. 무시해도 되는 파일 (읽지 말 것)

런칭 후 마케팅 영역이라 오늘 코드 작업에 무관:

```
launch_compressed_2026_04_22.md
launch_copy_d1_dday_v1.md
launch_countdown_promo_v1.md
instagram_threads_hooks_v1.md
사주500_appintos_UAC_프로모션_초안_v1.md
사주500_IA_dashboard.html
사주500_sitemap.html
사주500_콘텐츠심사_v1.xlsx
사주500_콘텐츠심사_v3_리포트.md
사주500_트랙벤치마킹_반영리스트_v1.md
quality_audit_pre_appintoss.md
homepage_IA_v2.md
homepage_redesign_spec.md
```

이전에 받은 PC 회신 파일 (이미 처리 완료된 기록):

```
PC_CLAUDE_CODE_HOTFIX.md
PC_CLAUDE_CODE_PASTE_THIS.md
PC_CLAUDE_CODE_REPLY_1.md
PC_CLAUDE_CODE_REPLY_2.md
PC_CLAUDE_CODE_콘텐츠프롬프트_업데이트.md
PC_HOTFIX_REPLY_1.md
PC_HOTFIX_REPLY_2.md
PC_BUGLIST_APPINTOS.md
PC_DDAY_HANDOVER_D1_18.md  ← 이 파일은 PC_PASTE_BUNDLE_specs.md로 대체됨
D7_instructions.md
D7_revised_wrapper_redirect.md
```

아이콘 에셋 (이미 콘솔 등록 완료):

```
appintos_icon_*.png  (7개)
```

---

## 5. 진행 방식 — 준기·Claude(Cowork)·PC 3자 협업 프로토콜

- PC가 **단계 완료할 때마다** 준기에게 한 줄 핑: `[P0-1 완료 / P0-2 시작]`
- 막히는 지점 생기면 **작업 중단하지 말고** 진행 중인 항목 표시 + 준기에게 질문 핑
- Claude(Cowork)에게 설계 질문 있으면 **준기 통해 전달** — Claude가 결정해서 회신
- 커밋은 P0 완료 후 1번, P1 완료 후 1번, P2 완료 후 최종 1번 — 총 3개
- push는 P2 smoke test 통과 후 한 번만

---

## 6. 예상 마일스톤

현재 시각 15:30 기준 (2026-04-21 화 D-1):

```
15:30 ~ 16:00  폴더 읽기 + 현재 prod 갭 스냅샷 (PC)
16:00 ~ 16:15  갭 리스트 준기 회신 → 준기 조정 결정
16:15 ~ 20:30  P0 검수 필수 6건 (localStorage · 토스페이 · 가드 · Safe Area · 디스클레이머 · 처방)
20:30 ~ 04:30  P1 UI 개편 8건 (홈·입력·충전·결과·이벤트·대화·내정보·로딩)
04:30 ~ 07:00  P2 검증 + 빌드 + deploy + smoke test
07:00 ~ 09:00  준기 prod 직접 체험 1회 + 추가 핫픽스 대응 여유
09:00          공개·홍보 게시 준비 완료
```

막히면 β 범위에서 P1 일부 항목 D+1로 밀림 — 그때 다시 조정.

---

## 7. 오늘의 최종 질문 — PC가 준기에게 꼭 확인해야 할 것

```
Q1. (해결) 폴더 경로 위 §0 참조
Q2. 현재 prod repo 루트 경로 + 브랜치 상태 알려줘
Q3. HomePage 핫픽스 검증 스크린샷은 지금 가능한 상태야?
Q4. 앱인토스 검수 회신 왔어? 아직이면 β 완료 후 기다리는 걸로 OK?
Q5. 만약 P1 일부가 24h 안에 못 끝나면 어떤 항목을 D+1로 미룰지 미리 결정 — 아마 "로딩 UX 3티어" "내정보·보관함·후기 16개" 이 두 개가 첫 미룸 후보
```

Q2~Q5 답 먼저 받고 시작하면 시행착오 최소화.
