# JDS — 사주500 스토리보드

> Joon Design System · 2026-05-07
> 25 routes × phase별 description · 피그마 frame 옆에 sticky note로 붙일 내용

---

## 🏠 / Home — HomePage / HomePageV5

**유저 상태:** 앱 진입 직후 또는 TabBar 홈 클릭

**보이는 것:**
- 상단: BalanceBar (잔액 ●N운)
- 본문: ProfileCard → DailyHero(火) → DreamHero(夢) → PremiumHero(命) → Extensions4 → Topics5 → ChatHero(問) → Reviews → Hashtags22 → Footer
- 하단: TabBar 5탭

**Path 분기 (useUserPath):**
- **Path A** (사주 X) — 5색 도식 체험형
- **Path B** (결제 X) — 가격 인트로
- **Path C** (500원만) — 5,000원 업셀
- **Path D** (5,000원) — 리텐션 사이드바

**다음 액션:**
- 모든 콘텐츠 진입의 hub
- 25 페이지 어디로든 이동 가능

---

## 📥 /input — InputPage

**유저 상태:** 사주 입력 시작

**Phase:**
1. **step 0** — 기존 프로필 선택 또는 + 새로 입력
2. **step 1** — 이름
3. **step 2** — 생년월일 (양력/음력)
4. **step 3** — 시간 (옵션, 모르면 skip)
5. **step 4** — 성별
6. **step 5** — 결제 확인 (10운 또는 1운)

**Modal:**
- "이어쓰기 / 새로 작성" — sessionStorage draft 24h TTL 발견 시
- 잔액 부족 — `/charge?need=10`

**Query 패턴:**
- `?profileId=&edit=1` (수정 모드)
- `?new=1&from=storage` (강제 새 입력)
- `?from=compat|chat|home_body_*|my`

**다음 액션:** `/loading?type=premium` 또는 `/charge`

---

## ⏳ /loading — LoadingPage

**유저 상태:** AI가 사주를 풀고 있음 (40~120초)

**Phase (12 sections progressive):**
1. **stage 1** — 만세력 추출 (입력 시각 → 진태양시 보정)
2. **stage 2** — 사주 4기둥 즉시 노출 (干/支 오행 컬러)
3. **stage 3** — REPORT_SECTIONS 12 섹션 스켈레톤 (점진 채움)

**보이는 것:**
- 12 섹션 진행 인디케이터
- 회전 카피 6개
- 팁 카드 17개

**실패 시 (2026-05-07 fix):**
- `refundBalance(reportType === 'premium' ? 10 : 1)`
- "분석에 실패해서 N운을 돌려드렸어요" 안내

**다음 액션:** `/result/{id}` (성공) 또는 `/input` (실패 후)

---

## 💎 /result/:id — ResultPage

**유저 상태:** 사주 결과 받음

**2가지 tier:**
- **Basic (1운)** — 본문 일부 노출 + blur 잠금 영역 + 잠금 해제 CTA
- **Premium (10운)** — 10섹션 + 12+ 인포그래픽 + PDF 다운로드

**핵심 구조 (Premium):**
```
01. 인생의 결 (LifeEdgeList)
02. 성격
03. 십성 클러스터 (SipClusterDetails)
04. 직업
05. 재물
06. 월별 인사이트 (MonthlyInsightList)
07. 신살 분포 (SinsalDist)
08. 6관계 카드 (RelationSixCards)
09. 주제 미니 그리드 (TopicMiniGrid)
10. 실천 체크리스트 (PracticeChecklist)
```

**Footer 3-part CTA:**
- 命 emblem + "전체로 보기" + "10운으로 시작"

**다음 액션:** 공유 / 궁합 / 대운 추천 / 다른 주제 4종

---

## ☀ /daily — DailyFortunePage

**유저 상태:** 오늘 무료 운세

**Phase:**
- **select** — 프로필 픽 (본인 또는 다른 사람)
- **loading** — 짧은 AI 호출
- **result** — day-tile + L1~L4 4영역 + 시간대 흐름
- **error** — 재시도 CTA

**2026-05-07 fix:** `navState.savedResult` → 보관함 진입 시 즉시 result phase

**Sub-picker (모달):**
- 관계 → `/topic/love`
- 일 → `/topic/career`
- 건강 → `/topic/health`
- 재물 → `/topic/wealth`

**캐시:** sharedCache/{8글자+date} (글로벌 — 첫 사용자 외 0원)

**Reward:** DailyRewardBadge (P2-5) — 일 1회 +0.1운

---

## 🌙 /dream — DreamPage

**유저 상태:** 꿈 입력 후 해석

**Phase:**
1. **category** — DreamCategory 선택 (사람/동물/자연 등)
2. **detail** — 꿈 텍스트 입력 + 고민(선택)
3. **result (라이트)** — 무료 해석 + SymbolDragMap
4. **deepLoading** — 1운 차감 후 심층 분석
5. **deepResult** — 사주 연계 심층 (deepDream 콘텐츠 타입)

**2026-05-07 fix:** navState.savedResult + deepDream 분기 → 보관함 재열람

**Modal:** 잔액 부족 → `/charge`

---

## 🎯 /topic/:topicId — TopicAnalysisPage

**유저 상태:** 10주제 중 1개 분석 (1운)

**Phase:**
1. **select** — 프로필 + (해당 시) 상대방 정보
2. **partner-info** — love(연애중)·marriage(연애중)·reunion 만
3. **confirm-modal** — 1운 차감 동의
4. **insufficient-modal** — 잔액 부족
5. **loading**
6. **result** — 주제별 고유 시각화

**10주제 SSOT:**
- love(緣) · reunion(復) · marriage(婚) · wealth(財) · exam(進)
- business(業) · career(官) · health(壽) · move(移) · study(學)

**서버 boundaryBlock:** cross-topic 모순 차단 (연애에서 결혼 단정 X)

**실패 시 (fix):** `refundBalance(1)`

---

## 💠 /premium — PremiumSelectPage

**유저 상태:** 5,000원 종합사주 시작 직전

**Phase:**
- **profile-pick** — 본인 사주 확인
- **preview** — 10섹션 미리보기

**진입로:**
- 홈 PremiumHero
- SajuCardPage CTA (2곳)
- MyPage 메뉴
- Path D 사이드바
- ResultPage Footer

**잔액 ≥ 10:** `/input?from=home_body_premium`
**잔액 부족:** `/charge?need=10`

---

## 📈 /daeun — DaeunPage

**유저 상태:** 50년 대운 흐름 (1운)

**Phase:** select → loading → result

**보이는 것:**
- DaeunHeatGrid (10년 단위 색)
- DaeunTimeline (운 강도 라인)
- AreaChart (recharts 분기별)
- 강조 시기 chip

**2026-05-07 fix:**
- `refundBalance(1)` AI 실패 시
- shareReportId 동적 (이전: `reportId="daeun"` 모든 사용자 동일)
- navState 재열람

---

## 📅 /monthly — MonthlyPage

**유저 상태:** 12개월 월운

**Phase:** select → loading → result

**보이는 것:**
- MonthlyFortune (12개월 grid)
- 강조 월 chip + 주의 월 chip

**fix:** refundBalance + 동적 reportId + navState 재열람

---

## 💕 /compat → /compat/result — CompatibilityPage / CompatResultPage

**유저 상태:** 두 사람 궁합 (1운)

**CompatibilityPage Phase:**
- profile-pick — 2 슬롯
- relation-pick — 연인/배우자/친구/가족/직장/짝사랑

**최근 상대 MRU 3명** (compat_recents:v1)

**CompatResultPage 2가지 진입 (2026-05-07 fix):**
1. `/compat` 입력 후 → AI 호출 → result
2. `/storage` 클릭 → savedResult/savedReport 즉시 result

**보이는 것:**
- CompatProfilePair (양쪽 PillarCard)
- CompatScoreBar 점수
- RadarChart (5축)
- Timeline 단계 (compat 전용)

**fix:** refundBalance + 동적 reportId + partner 정보 보존

---

## 📜 /tojung — TojungPage

**유저 상태:** 토정비결 (1운)

**Phase:** select → loading → result

**보이는 것:** TojungMonthCard 12개월 카드

**fix:** refundBalance + 동적 reportId + navState 재열람

---

## 💬 /chat (3-route) — ChatListPage / ChatNewPage / ChatSessionPage

**Sprint 2 분리** (이전 ChatPage.tsx 단일 파일 → 3개로)

**/chat (List):** 대화방 목록 + "새 대화" CTA

**/chat/new:** 프로필 선택 → createChatRoom → /chat/{id}

**/chat/:sessionId (Session):**
- 1일 1턴 무료 (dailyFreePass)
- 한도 초과 → BuyCredits Modal ("1운 = 3회")
- chat_credit localStorage 카운트

**모든 페이지 진입 가능:** TabBar 중앙 (모든 페이지에서)

**AI:** generateChatAnswer · Sonnet 4.6 · max 2,048

---

## 📦 /storage — StoragePage

**유저 상태:** 보관함 (모든 콘텐츠 영구 저장)

**Phase:**
- 10탭 가로 스크롤
- bulk 모드 (다중 선택 + 삭제)

**10탭:** 전체·종합사주·주제별·궁합·대운·월운·토정비결·오늘운세·꿈해몽·사주대화

**2026-05-07 fix:**
- routeForReport 라우팅 정상화 (daeun → /daeun 등)
- openReport → navState로 savedResult/savedReport 전달 → 모든 페이지 즉시 result phase 재현

**NO-CASCADE 정책:** 프로필 삭제해도 리포트 유지, 역도 동일

**프로필 카드 인터랙션:**
- 클릭 → 최근 결과
- 연필 → 수정 (`/input?profileId=&edit=1`)
- 휴지통 → 삭제 모달
- 사주카드 → `/saju-card/:profileId`

---

## 💰 /charge — ChargePage

**유저 상태:** 운 충전

**Phase:**
- 패키지 선택 (4종): 1운(500) · 4운(1500) · 7운(2500) · 14운(5000)
- 결제 진행 (웹 토스페이먼츠 / 앱인토스 IAP)
- 완료/실패/needs_recon

**Query/State:**
- `?need=N` — N운 이상 충전되는 가장 작은 패키지 자동 선택
- `?redirect=/path` — 결제 후 자동 복귀
- `state.returnTo` (2026-05-07 fix) — 다른 페이지에서 navigate 시 일관성

**3 결과 카피:**
- 정상: "+N운이 충전됐어요"
- 실패: "결제 승인 실패"
- 미해결: "고객센터 문의" (needs_reconciliation)

**ShareRewardCard:** 3회/일 공유 → +0.5운

---

## 👤 /my — MyPage

**유저 상태:** 마이페이지

**WEB 메뉴:**
- 분석 기록 / 운 충전 / 결제 내역 / 약관 / 개인정보 / 고객문의 / 로그아웃 / 회원탈퇴

**앱인토스 메뉴 (정책상 분기):**
- 운 충전 / 결제 내역 / 약관 / 개인정보 / 고객문의
- 로그아웃·회원탈퇴 제거 (토스 정책)

**핵심 액션:**
- 사주 카드 → `/saju-card/:profileId` (+ 본인 프로필)

---

## 🔗 /share/:id — SharePage

**유저 상태:** 비회원, 친구가 공유한 링크 클릭

**Phase (2026-05-07 fix · 동적화 + 보일러플레이트 박멸):**

**시도 1:** `getReport(shareId)` 로컬 매치
- 자기 링크를 자기가 누른 경우 또는 같은 기기
- → 사주 owner 호명 + 일간(日干) 표시
- → 정확한 콘텐츠 타입 라벨 (사주분석/주제분석/대운/...)

**시도 2 (미래):** Firestore publicReports SSR

**Fallback:** generic CTA — 정적 더미 텍스트 X

**SSR:** renderShareOg Cloud Function (봇 UA 분기)

**다음 액션:** "나도 내 사주 알아보기" → `/input`

---

## 🃏 /saju-card/:profileId — SajuCardPage

**유저 상태:** 만세력 카드 (프로필 단위 영구 카드)

**보이는 것:**
- SajuCardExport (큰 카드 디자인)
- 다운로드 / 공유 버튼

**OG 이미지 동적 SSR:** renderSajuCardOgImage

**CTA:** /premium (10운 시작) — 2곳

---

## 🎁 /events — EventsPage

**유저 상태:** TabBar 2번째 — 동적 reward 허브

**보이는 것:**
- StreakWidget (출석 연속)
- HeroBadge (리워드 뱃지)
- CumulativeReceivedCard (누적 받은 운)
- TierBModal (스트릭 보상 받기)

**Cloud Functions:**
- markAttendance (출석 체크)
- claimStreakReward (7/14/30일)
- claimWeeklyTossPoint
- onInviteReceived (초대 코드)

---

## 📄 /terms · /privacy

**정적 페이지** — TermsPage / PrivacyPage

진입로: MyPage 메뉴 / Footer / 회원가입 동의 화면

---

## ❌ NotFoundPage

**유저 상태:** 잘못된 URL

**보이는 것:** 골드 ? 아이콘 + "페이지를 찾을 수 없어요"
**다음 액션:** "홈으로 돌아가기" (replace navigate)

ResultRouteGuard: `/result/:id` regex 검증 `[a-z0-9]{4,32}`

---

# 📋 메타 정보

## 회귀 방지 SSOT (CLAUDE.md 핵심 13개)
1. Result Premium 5 안티패턴 금지
2. 명리학 출처 mention 0건
3. 보일러플레이트 박멸 (실명·정적 더미)
4. 컬러 SSOT (머스타드 0건)
5. 이모지 0건 (한자/SVG/컬러칩만)
6. 폰트 floor 11px
7. 결제 원자성 (server only write)
8. 데이터 보관 (영구/30일/90일/5년)
9. radius 3-tier
10. NO-CASCADE 삭제
11. 모든 콘텐츠 보관함 영구
12. AI 실패 시 클라이언트 즉시 환불
13. 동적 reportId
