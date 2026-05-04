# CLAUDE.md — 사주500 프로젝트 컨텍스트

> 이 문서는 Claude Code가 프로젝트를 이해하기 위한 **진입점**입니다.
> 웹 채팅(claude.ai)에서 설계한 내용을 여기서 이어서 개발합니다.
> **최종 업데이트: 2026-04-23 PM** (Sprint 2 핸드오프 v2 + 준기 결정 4건 D1/D2/D3/D∞ 반영)

---

## 🛡️ 프리미엄 결과페이지 architecture 결정 (2026-05-03)

**진본**: `src/pages/result/types/PremiumResult.tsx` (props 기반 React JSX, 3,984+ 줄)
- `<style dangerouslySetInnerHTML={{ __html: PREMIUM_MOCKUP_CSS }} />` 로 mockup CSS 만 분리
- 모든 데이터(이름·8글자·오행·십성·신살·대운·6관계·실천 등)는 props 기반 동적 렌더
- AI 응답 신규 8 필드 wired: `lifeEdge`, `sipCluster`, `shinsalCards`, `rel6Cards`, `actionList`, `monthlyInsight`, `sectionConclusions`, `topicMini`

**폐기**: `src/pages/result/_archive_/ResultPagePremiumV2.tsx` (4,765 줄)
- 패턴: iframe `srcDoc` + 거대 `MOCKUP_HTML` template literal + `personalize()` regex string-replace + 7개 `buildXxxFallback`
- 함정: regex 매칭 영역과 mockup 정적 영역이 충돌 → fallback 추가할수록 도식화 div 잘림

**회귀 금지** (다음 5가지 패턴 다시 도입 X):
1. iframe `srcDoc` 으로 mockup HTML 전체 embed
2. regex string replacement 로 부분 치환
3. 거대 `MOCKUP_HTML` template literal
4. 클라이언트 `buildXxxFallback` 류 (AI 응답 빌 때 채우는 함수)
5. mockup HTML 하드코딩 (특정 이름·연도·간지 등)

**보존 자산**:
- `functions/src/ai/claudePremium.ts` 신규 8 필드 schema + "사주 글자 직접 호명" mandate 프롬프트
- `src/pages/result/_data.ts` SINSAL_KR 27개 매핑 (12신살·귀인·흉살)

**컴포넌트 매핑**: §01 LifeEdgeList ← lifeEdge / §03 SipClusterDetails ← sipCluster / §06 MonthlyInsightList ← monthlyInsight / §07 SinsalDist ← shinsalCards / §08 RelationSixCards ← rel6Cards / §09 TopicMiniGrid ← topicMini / §10 PracticeChecklist ← actionList / 전체 sectionConclusions ← sectionConclusions{}

---

## ⚡ 2026-04-23 Sprint 2 진입 시 첫 명령 (Claude Code 시작용)

> **Cowork ↔ Claude Code 동기화 정책**: Cowork (`/sessions/busy-compassionate-knuth/mnt/550saju/`) 와 Claude Code (`D:\550saju\`) 는 **같은 디렉터리**. 코드 · `docs/` · `CLAUDE.md` 모두 공유. 단 Cowork 의 `.auto-memory/` 와 태스크 시스템은 Cowork 전용 → **모든 결정은 이 CLAUDE.md + `docs/handoff/` 에 미러링**.

**Sprint 2 시작 시 Claude Code 가 정독해야 할 문서 (순서대로):**

1. **이 CLAUDE.md** (지금 읽고 있는 문서) — 아래 §Sprint 2 결정 4건 (D1/D2/D3/D∞) + §최상위 원칙 5가지
2. **`docs/handoff/2026-04-23_Sprint2_UI개편_핸드오프.md`** ⭐ (Sprint 2 SSOT · 12 티켓 + Phase 분할 + 회귀 방지 계약 + 17 서약)
3. `docs/prd/PC_인수인계_2026_04_21_단일본.md` (디자인 토큰 SSOT)
4. 작업 대상 mockup (`docs/mockups/사주500_UI개편_NN_xxx.md`)

**Sprint 2 Phase 1 부터 진행** (실행 순서는 핸드오프 §13 참조).

---

## 🚨 Sprint 2 준기 결정 4건 (2026-04-23 · 출시 직전 모드)

핸드오프 문서 §최상단의 D1/D2/D3/D∞ 와 동일. **충돌 시 이 결정이 모든 PRD/mockup 보다 우선**.

### D1 — 목업 토큰 SSOT 일괄 치환 (유효)
> 준기: "옛날건 다 새롭게 개편한걸로 통일하고싶네"

mockup/코드의 구 토큰 → 현 SSOT 일괄 치환:
- `#A08B6A` / `#F5F0E8` / `#F0E8D9` / `#7F6B4E` / `#C9A96E` / `#D4A843` / `#B8941F`(머스타드) → `#B8965A` / `#F8F5EE` / `#1A1A1A` / `#7A7269` / `#8C6D3D`
- mockup 의 토큰 이름(`gold-brown-soft` 등) 은 유지하되 **값만** SSOT 로.
- 머스타드 `#B8941F` 는 전 페이지 0건 유지.

### D2 — ~~Tier C 5층 한자 레이어 풀스펙~~ → **철회 (2026-04-23 PM)**
> 오전: "간소화는 없어. 다 제대로 해."
> 오후 재결정: "로딩화면은 그대로 나둬도될듯. 각 섹션 항목마다 시간 지나면서 현 진행상황을 유저가 객관적으로 딱 알수있게 '아 이번에는 이거작업하는구나' 느낄 수 있겠더라 그거 좋더라."

- **현행 LoadingPage v2** (REPORT_SECTIONS 12섹션 progressive 인디케이터 + 회전 카피 + 팁 카드 17) **유지**.
- L0~L5 6레이어 한자 mandala/halo/particles 신규 구현 **보류**.
- 작업 범위: D1 SSOT 토큰 sweep 만.
- 향후 트래픽·체감속도 데이터 기반 재논의 가능.

### D3 — Top 5 실시간 랭킹 정식 구현 (유효)
> 준기: "임시구현같은건 없어 제대로 확실하게 구현해. 바로 출시해야하니까."

- Phase 1 localStorage 스튜브 **금지**. 첫 배포부터 정식 구현.
- Cloud Functions Scheduled Function 1시간 주기 + Firestore `topicViewCounts/{topicId}` 24h aggregation + `cache/topicTop5` 캐시 + uid+topicId 24h 쿨다운 어뷰징 방어.
- 상세: 핸드오프 §2-11.

### D∞ — 기본 규칙 (유효 · 모든 티켓 공통)
> 준기: "다시는 누락된거없어야하고 웬만하면 다 이미 만들어져있고 작업됐던것들인데. 최대한 다 구현해보고 참고해보되, 정말 없잖아? 그럼 너가 중요도가 높은것들은 알아서 만들어버려."

1. 스펙·목업 우선 탐색 — 작업 전 반드시 `docs/mockups/` + `docs/prd/` 전수 grep. "이미 만들어져 있다" 가정.
2. 없을 때만 자체 제작 — 중요도 높은 기능은 자체 판단 OK. 단 핸드오프 §7 "자체 결정" 항목에 근거 명시.
3. 누락·임시·간소화 3금 — "Phase 1 localStorage", "MVP 버전", "일단 이 정도만" 류 제안 금지.
4. **D∞ 적용 사례** (Sprint 2 핸드오프에 반영됨):
   - `docs/mockups/사주500_UI개편_09_PDF서버엔드포인트.md` 스펙 발견 → `generatePremiumPdf` 코드 0 hit → **#61 신규 티켓 자체 신설**
   - `docs/mockups/사주500_UI개편_09_이벤트_v4.md` → 이미 구현 완료 확인 → **#62 QA-only 티켓**

---

## TL;DR — 30초 요약

- **사주500** = 500원 AI 사주 풀이 서비스 (웹 + 앱인토스).
- **가격 v3.1**: 무료 (0원, 재미형) · 500원 (1운, 본격형 · 블러잠금 후기) · 5,000원 (10운, 프리미엄).
- **핵심 차별점**: 6대 원전 기반 명리학 백과사전 → AI 프롬프트 학술 기반 해석 + "AI같지 않은" UX.
- **톤**: 신비 + 고급 + 깔끔 + 모던. 점집/무속 느낌 절대 금지.
- **한자 이원화 원칙**: 내부 참고서는 한자 풍부, 유저 출력물은 쉬운 한국어 + 한자는 상징·프레임으로만.
- **1인 오너**: 준기. 냅다 코드 수정 금지, 기획·분석 먼저.

---

## 프로젝트 개요

- **서비스명**: 사주500
- **한 줄 정의**: 500원에 제공하는 극상 퀄리티 AI 사주 풀이 서비스
- **플랫폼**: 웹 (반응형) + 토스 앱인토스 동시 (계정/서버 통합, 프론트만 분기)
- **기술 스택**: React 18 + TypeScript + Vite + Tailwind CSS + Firebase + lunar-javascript
- **AI 모델 할당**:
  - **Opus 4.6**: 유료 핵심 리포트 (`generateReport`, 10섹션)
  - **Sonnet 4.6**: 유료 1운 전문 콘텐츠 (`generateDaeun`/`Monthly`/`Compatibility`/`Tojung`/`TopicAnalysis`)
  - **Gemini 2.5 Pro**: 무료·맛보기 퍼널 (`generateDailyFortune`/`ChatAnswer`/`Dream` 무료·심층 둘 다)
  - **Haiku 4.5**: 현재 미사용 (향후 경량 챗봇 용도 보류)
- **만세력**: lunar-javascript (npm), ±30분 KR 진태양시 보정 커스텀 래퍼
- **결제**: 토스페이먼츠 (웹) + 토스 IAP (앱인토스)
- **앱인토스**: @apps-in-toss/web-framework + @toss/tds-mobile
- **저장**: Firebase Auth + Firestore + Functions + Storage

---

## 가격 전략 "500 시리즈" (v3.1)

| 층 | 가격 | 상품 | 목적 |
|----|------|------|------|
| 무료 | 0원 | 오늘의 운세 · 꿈해몽 · 사주대화(1일 1회) | 획득·체험 |
| 본격 | **500원 (1운)** | AI 사주 리포트 10섹션 + 인포그래픽 + 블러잠금 후기 | 본격 전환 |
| 프리미엄 | 5,000원 (10운) | 심층분석 + PDF + 월운 + 궁합 | LTV |
| 전문가 | 50,000원 | 명리학 전문가 1:1 (Phase 3) | 미래 옵션 |

- 가상화폐: **운(運)**, 1운 = 500원
- 충전 패키지: 1운(500원) / 4운(1,500원) / 7운(2,500원) / 14운(5,000원)
- 3-bucket 잔액: **paid · bonus · reward** (소비 우선순위 reward → bonus → paid, 환불은 paid만)
- **런칭 프로모 "3원 리워드"**: `가격_상품구조.md` + `런칭프로모_3원리워드.md` 참조
- **블러잠금**: CSS blur + 노이즈 + 서버 차단 3층 방어 (`프리미엄_티저블러.md`)

상세: `docs/prd/가격_상품구조.md`

---

## 톤앤매너

- **키워드**: 신비 + 고급 + 깔끔 + 모던 (무속인/점집 느낌 **절대 아님**)
- **캐릭터 없음**: 미니멀 심볼 로고 (태극)
- **컬러 SSOT** — `PC_인수인계_2026_04_21_단일본.md` §5 (2026-04-22 기준 최신):
  - `--gold` #B8965A (골드 · 프라이머리 CTA)
  - `--gold-deep` #8C6D3D (호버/프레스)
  - `--paper` #F8F5EE (크림 배경)
  - `--ink` #1A1A1A (본문)
  - `--mute` #7A7269 (부가 텍스트)
  - **주제 5색** — 연애 #C88A95, 재물 #B8965A, 직업 #5A7CA8, 건강 #6FA08C, 공부 #9C5A8A
  - **확장 4색** — 대운 #3B7A4B, 월운 #B5441F, 궁합 #9C5A8A, 토정비결 #2F4B7C
  - **금지색** — 머스타드 #B8941F (구 브랜드 잔재)
- **오행 컬러**: 목=#2D8A4E · 화=#D32F2F · 토=#F57F17 · 금=#757575 · 수=#1565C0
- **폰트**: Pretendard

> ⚠ **디자인토큰 드리프트 주의**: 구버전 CLAUDE.md 는 Primary #A08B6A · Bg #F5F0E8 등 을 명시했으나, **2026-04-22 PC 인수인계 §5 가 SSOT** 입니다. 코드 기준(`src/pages/HomePage.tsx` 20행 `C.gold='#B8965A'`)도 인수인계와 일치. `docs/prd/디자인토큰.md` 는 추후 일괄 동기화 예정.

상세: `docs/prd/PC_인수인계_2026_04_21_단일본.md` §5 (SSOT) · `docs/prd/디자인토큰.md` (갱신 대기) · `docs/prd/브랜드스토리텔링.md` · `docs/prd/컴포넌트_라이브러리.md`

---

## ⚠ 최상위 원칙 5가지 (준기 지시 — 모든 결정의 기준)

1. **기획·분석 먼저, 코드 나중** — 냅다 구현 금지. 영향 분석 후 진행.
2. **한자·전문성 이원화** — 내부 참고서는 자유, 유저 출력물은 쉬운 한국어 + 한자는 상징·프레임만.
3. **퀄리티 다운그레이드 절대 불가** — Opus→Sonnet 등 모델 변경은 반드시 A/B 비교 후.
4. **AI같지 않은 퀄리티 바** — 디자인·UX라이팅·섹션 리듬·지식 기반 모두 "손이 탄 느낌".
5. **이모지 마음대로 넣지 말 것** — 한자 유지가 기본. 변경은 반드시 사전 확인.

상세: `docs/prd/콘텐츠퀄리티가이드.md` · `docs/prd/한자노출_정책.md` · `docs/prd/사람손떼_체크리스트.md`

---

## 지식 백본 — 명리학 백과사전

`docs/prd/명리학_백과사전.md` (60KB · 8권 · 3부록) 이 **플랫폼 해석의 기틀**.

- **8권 구성**: 역사·간지론·십신론·격국론·용신론·12운성/신살·대운/세운·학파
- **3부록**: 60갑자 전체 · 일간별 십성 완전표 · 조후용신 120조합 매트릭스
- **6대 원전 기반**: 연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회
- **학파 매핑**: 자평진전파·적천수파·궁통보감파·맹파·新派 + 한국 학자 7인
- **용신 5취용법**: 扶抑·調候·病藥·通關·專旺

**사용 원칙**: 프롬프트에 원문 주입 금지 (백과사전은 내부용). 프롬프트에는 **정리된 규칙**만 주입 (`프롬프트템플릿_v2.1.md`).

---

## 핵심 기술 결정사항

### 만세력 계산 (lunar-javascript + KR 시간 보정)

```javascript
import { Solar } from 'lunar-javascript';
import { correctKoreanSolarTime } from '@/services/saju/timeCorrection';

// KR 진태양시 보정 (127.5° vs 135°) + 서머타임 필수
const corrected = correctKoreanSolarTime(1998, 3, 3, 5, 0);
const solar = Solar.fromYmdHms(...corrected);

// 시간 없을 때
const solar = Solar.fromYmd(1998, 3, 3);

const lunar = solar.getLunar();
const ec = lunar.getEightChar();

ec.getYear();            // 년주 간지
ec.getMonth();           // 월주
ec.getDay();             // 일주
ec.getTime();            // 시주
ec.getYearShiShenGan();  // 십성
ec.getYearHideGan();     // 지장간 ['甲','丙','戊']
ec.getDayDiShi();        // 12운성
ec.getYearNaYin();       // 납음
const yun = ec.getYun(1); yun.getDaYun();  // 대운
lunar.getDayJiShen();    // 길신
lunar.getDayXiongSha();  // 흉살
lunar.getYearXunKong();  // 공망
```

- **±30분 KR 보정 필수** — 127.5°(서울) vs 135°(표준). 홍성민 등 현직 학자 공통 지적.
- **서머타임 반영**: 1948~1951, 1955~1961
- **夜子時/早子時 분리** — 23시 이후는 다음날 子時 아닌가 확인 옵션
- **시간 미입력** 시 시주 칸은 4번째 칸으로 유지 + 점선 테두리 + "출생시간 미입력" 오버레이. 시주 관련 해석 조건부 제외.

상세: `docs/prd/만세력_30분보정.md` · `docs/prd/만세력_TC30_확장.md` (30 TC)

### AI 프롬프트 구조 (v2.1)

- **시스템 프롬프트**: 명리학 해석 규칙 + 한자 이원화 규칙 + 톤 지침 (`src/constants/prompts.ts`)
- **유저 프롬프트**: 사주 8글자 + 원국 · 십신 · 지장간 · 대운 · 용신 · 신살 구조화 + 상황 질문 (`src/services/saju/promptBuilder.ts`)
- **출력**: 10개 섹션 (총평/성격/대인/직업/재물/애정/건강/올해운세/과제/개운법)
- **각 섹션 300자 이상**, 구체적 행동 패턴 묘사, "왜" 설명 포함
- **2차 자기 리뷰 호출**: 톤 일관성 + 한자 초과 체크 + 누락 요소 보강

상세: `docs/prd/프롬프트템플릿_v2.1.md`

### 한자·전문성 이원화 (필수 정책)

| 구분 | 한자 허용량 | 대상 문서 |
|------|------------|----------|
| 내부 참고서 | 자유 (풍부) | 명리학 백과사전, 레퍼런스풀 |
| AI 프롬프트 | 원문/용어 다수 OK | 프롬프트템플릿 |
| **유저 출력물** | **섹션당 2~3개 이하** | 리포트, 일일운세, 사주대화, 푸시 |
| UI 라이트 문구 | **한자 금지 기본** | 버튼, 메뉴, 라벨, 에러 |

- 한자 등장 시 **풀이가 문장에 녹아있어야** 함 ("식신격은 '여유로 사는 그릇'이에요" 식).
- 중요 대목에서만 인장처럼 살짝 노출. 점집 한문투·번역체 금지.
- 전문가 만족용 "마이크로 디테일"은 카드 푸터 `*[전문: 정관격/수용신]*` 식으로 별도.

상세: `docs/prd/한자노출_정책.md`

### 멀티 플랫폼 계정 전략

```
앱인토스(토스 로그인)  ─┐
                       ├→ Firebase Auth (provider link) → 하나의 uid
웹(카카오/구글/네이버) ─┘
```

- **서버는 하나** (Firebase Firestore + Functions + Auth)
- **프론트만 분기** (`isAppsInToss()` 감지)
- **결제 분기**: 앱인토스 = IAP, 웹 = 토스페이먼츠 PG
- **계정 통합 Phase 2**: 전화번호 기반 `linkWithCredential()` 으로 통합

상세: `docs/prd/로그인전략.md`

---

## 폴더 구조

```
src/
├── pages/          # HomePage, InputPage, LoadingPage, ResultPage, DailyPage, CompatPage,
│                   # StoragePage, ChargePage, MyPage, SharePage, DreamPage, TopicAnalysisPage
├── components/
│   ├── common/     # Button, Modal, Loading, FadeIn, BalanceBar, Toast, ShareModal
│   ├── saju/       # PillarCard, ElementRadar, ScoreRing, DaeunTimeline
│   ├── input/      # DatePicker, TimePicker, SituationQ
│   └── payment/    # ChargeModal, PaymentButton
├── hooks/          # useAuth, useSaju, useBalance, usePageTracking
├── services/
│   ├── saju/       # calculator, dataExtractor, promptBuilder, timeCorrection
│   ├── ai/         # reportGenerator, claudeReport, geminiReport
│   ├── auth/       # firebase, authService
│   ├── payment/    # balanceService, tossPayments, iapService
│   └── firestore/  # userStore, reportStore, paymentStore, chatStore
├── types/          # saju, user, payment, report, chat
├── constants/      # oheng, pricing, prompts
└── utils/          # format, share, logger
```

---

## Firestore 컬렉션

```
users/{uid}                      - 유저 (balance{paid,bonus,reward}, provider, ...)
users/{uid}/profiles/{pid}       - 프로필 (이름, 생년월일, 만세력 캐싱)
users/{uid}/reports/{rid}        - 리포트 (AI 생성 결과, 점수, 공유ID)
users/{uid}/payments/{payid}     - 결제내역 (충전/사용/환불)
users/{uid}/dailyFortune/{date}  - 일일운세
users/{uid}/chats/{chatId}       - 사주대화 기록
users/{uid}/shareLogs/{logId}    - 공유 리워드 로그
```

### 데이터 보관 정책

| 데이터 | 보관 기간 | 근거 |
|--------|-----------|------|
| 사주 리포트 (유료) | 영구 (계정 생존) | 핵심 가치, 비용 무시 가능 |
| 유저 프로필 | 영구 | 재분석 필요 |
| 결제 기록 | 5년 | 전자상거래법 |
| 일일 운세 (무료) | 30일 롤링 | 에페메럴 콘텐츠 |
| 채팅 기록 | 90일 | 업계 표준 |
| 비활성 계정 | 1년 분리 보관, 3년 후 삭제 | 개인정보보호법 |
| 계정 삭제 후 | 5일 이내 삭제 | 개인정보보호법 |

---

## 라우팅

```
/              - 메인 랜딩
/input         - 사주 입력
/loading       - AI 분석 중
/result/:id    - 결과 페이지 (블러잠금 후기 포함)
/daily         - 오늘의 무료운세
/dream         - 꿈해몽
/topic         - 주제 분석
/compat        - 궁합
/storage       - 보관함
/charge        - 운 충전
/my            - 마이페이지
/share/:id     - 공유 링크 수신
```

---

## 개발 규칙

1. **모바일 퍼스트**: max-width 520px 기준, 데스크톱은 중앙 정렬
2. **앱인토스 규칙**: `window.confirm()/alert()` 금지, TDS 모달 사용 (52px 버튼, #3182F6), 라이트모드 강제
3. **한자 + 한국어 병기는 유저 출력물에서만** (UI 문구는 한자 금지 기본)
4. **파일 단위 완성** — 점진적 패치보다 완성된 파일 선호
5. **빌드**: 앱인토스 `ait build`, 웹 `vite build`. 메모리 부족 시 `NODE_OPTIONS=--max-old-space-size=4096`
6. **수용기준** — `docs/prd/수용기준_체크리스트.md` 를 기준으로 PR 검증
7. **접근성** — WCAG 2.1 AA 준수 (대비 4.5:1, 터치 44×44, 키보드 포커스)

---

## 📚 PRD 카탈로그 (`docs/prd/` — 총 29종)

### 🟢 Category A — 제품/UX/퀄리티 (16종)

| 문서 | 내용 |
|------|------|
| `가격_상품구조.md` | 가격 v3.1, 3-bucket 잔액, 충전 패키지, 환불 정책 |
| `런칭프로모_3원리워드.md` | 런칭 프로모션 3원 리워드 구조 |
| `블러잠금_3층보안.md`* → `프리미엄_티저블러.md` | 블러잠금 CSS + 노이즈 + 서버 차단 |
| `소셜프루프.md` | 후기·별점·SNS 공유 배치 |
| `섹션_아코디언.md` | 결과 페이지 섹션 아코디언 UX |
| `로딩전략.md` | AI 분석 중 로딩 UX (체감속도 단축) |
| `결제CTA심리학.md` | 결제 CTA 문구·색상·위치 전략 |
| `공유이미지.md` | OG 이미지 자동 생성 |
| `로그인전략.md` | 멀티 플랫폼 계정 통합 |
| `리텐션_저널관계망.md` | 재방문 리텐션 훅 |
| `사주대화_상담UX.md` | 사주대화 채팅 UX |
| `디자인토큰.md` | 컬러·폰트·간격·radius 토큰 |
| `컴포넌트_라이브러리.md` | 재사용 컴포넌트 명세 |
| `인포그래픽_카탈로그.md` | 원국판·오행 레이더·점수링 등 |
| `브랜드스토리텔링.md` | 카피라이팅 원형, 태그라인 |
| `UX라이팅_가이드.md` | 마이크로카피 규칙 |

### 🔵 Category A — 지식/품질 (6종)

| 문서 | 내용 |
|------|------|
| `명리학_백과사전.md` ⭐ | 8권 3부록 플랫폼 지식 백본 |
| `명리학_레퍼런스풀.md` | 인용·학설·사례 풀 |
| `콘텐츠퀄리티가이드.md` | AI같지 않은 퀄리티 바 4축 |
| `한자노출_정책.md` ⭐ | 내부 vs 유저 이원화 원칙 |
| `사람손떼_체크리스트.md` | 사람 손이 탄 느낌 체크 |
| `프롬프트템플릿_v2.1.md` ⭐ | 시스템/유저 프롬프트 v2.1 |

### 🟡 Category B — QA/운영 (7종)

| 문서 | 내용 |
|------|------|
| `용어집.md` | 모든 PRD 공통 용어 SSOT |
| `수용기준_체크리스트.md` | 기능별 Acceptance Criteria |
| `런칭_체크리스트.md` | T-30 ~ T+14 런칭 전과정 체크 |
| `페이지감사_체크리스트.md` | 12 페이지 × 0.1~0.8 공통 항목 |
| `만세력_30분보정.md` | KR 진태양시 보정 로직 |
| `만세력_TC30_확장.md` | 만세력 30 테스트 케이스 |
| `업계벤치마크_디테일.md` | 한국·일본·중국·서구 경쟁사 심층 분석 |

### 🔴 필수 읽기 순서 (신규 세션 시)

1. **이 CLAUDE.md** (전체 개요 + TL;DR)
2. **`docs/prd/PC_인수인계_2026_04_21_단일본.md`** ⭐ (2026-04-22 SSOT — Path / 토큰 / P0~P2 / Path E)
3. **`docs/prd/홈v5_Path분기_레이아웃diff.md`** (v3 완전체 — Path A~D 스택 + 14 render fn + 적천수 실측 + 5 결정)
4. `docs/prd/용어집.md` (모든 용어 정렬)
5. `docs/prd/명리학_백과사전.md` (지식 백본 — 지식 질문 시)
6. `docs/prd/한자노출_정책.md` (모든 콘텐츠 작업 전)
7. `docs/prd/콘텐츠퀄리티가이드.md` (퀄리티 바)
8. `docs/prd/수용기준_체크리스트.md` (PR 체크용)
9. 구현 대상 페이지 해당 PRD

### 🆕 2026-04-22 추가 SSOT 문서 (홈 v5 관련)
| 문서 | 내용 |
|------|------|
| `PC_인수인계_2026_04_21_단일본.md` ⭐ | 듀얼폴더 · Path 판별 · 토큰 · 우선순위 SSOT |
| `홈v5_Path분기_레이아웃diff.md` (v3) | Path A~D 스택 + 구현 스케치 + 적천수 18건 + 5 결정 |
| `9종mockup_meta태그_스니펫.md` (v3) | 9 mockup 파일 Path 주입 자동화 |
| `_archive/홈v5_Path분기_9종mockup_라벨링_번들_20260421_PREHANDOFF.md` | 인수인계 이전 초안 (참조만) |

### 기존 설계서 (PRD 이전 세대 문서 — 참고만)
- `docs/사주500_UIUX_상세설계서.md` — IA, 유저플로우 (핵심은 PRD로 분리 완료)
- `docs/사주500_브랜딩_가이드.md` — 컬러/톤 (디자인토큰.md로 흡수)
- `docs/사주500_기술설계서_v1.md` — 데이터 모델/API
- `docs/사주500_프롬프트_v2.js` — 프롬프트 원본 (v2.1로 업데이트됨)
- `docs/사주500_리포트_v2_준기님.md` — 리포트 샘플

---

## 현재 상태 (2026-04-22)

### 🆕 2026-04-22 인수인계 이후 추가분

- [x] **PC 인수인계 SSOT 등재** — `docs/prd/PC_인수인계_2026_04_21_단일본.md` (§1 듀얼폴더 / §3 Path 판별 / §4 Path별 스택 / §5 디자인토큰 / §7 P2 잔여 / §8 P0~P1 우선순위)
- [x] **훅 SSOT 정렬** — `usePathVariant` → `useUserPath` 로 리네임 (`@deprecated` shim 유지, 구 import 호환). 
  - 신규 타입: `UserPath = 'A'|'B'|'C'|'D'`, `UserPathState{ path, hasSaju, hasPaidAny, hasPaid5000, ready }`
  - Path 판별: `!hasSaju → A`, `!hasPaidAny → B`, `!hasPaid5000 → C`, 그 외 `D`
  - 500원급: `contentType ∈ {report, topic, deepDream}` + type='paid'
  - 5000원급: `contentType ∈ {daeun, monthly, compat, tojung}` (프리미엄 확장)
- [x] **Path 분기 설계서 v3 (완전체)** — `docs/prd/홈v5_Path분기_레이아웃diff.md` (§0 12 gap 교정표 / §2 Path A~D 스택 SSOT / §6 Footer CTA 3-part 패턴 / §7 구현 스케치 14 render fn / §8 적천수 파일 실측 18건 / §9 §7 P2 + Path E 4종 / §10 6 phase · 4.5h / §11 준기 결정 5건)
- [x] **9종 mockup meta 스니펫 v3** — `docs/prd/9종mockup_meta태그_스니펫.md` (파일명 교정: 재물만 v2 / 나머지 v1, Path 값: 홈 v4=A, 5 topics=B·C, 3 확장=C·D, 토정비결=D)
- [x] **Pre-handoff 번들 아카이브** — `docs/prd/_archive/홈v5_Path분기_9종mockup_라벨링_번들_20260421_PREHANDOFF.md`
- [x] **디자인토큰 SSOT 일원화** — 인수인계 §5 기준. 구 `CLAUDE.md` Primary #A08B6A 는 스테일, 위 §톤앤매너 블록에 드리프트 경고 추가.
- [x] **적천수 출처 A안 일괄 치환** — src 사용자 노출 4파일 (`AILoading.tsx` L45, `LoadingPage.tsx` L35, `DailyFortunePage.tsx` L270, `DreamPage.tsx` L346) 을 "출처 검토 중 · 한국 명리학 문헌 기반" 또는 "명리(命理)" 일반론으로 치환. `academicReferences.ts` · `prompts.ts` 는 내부 참고서·프롬프트라 유지. Cowork C:\ 6 mockup 은 준기 수동 영역.
- [x] **Footer 3-part CTA 통일** — `src/components/common/FooterCTA.tsx` 신규 (emblem + 전체로 보기 + 10운으로 시작). 적용 6페이지: `ResultPage` (命) · `TopicAnalysisPage` (桃/財/官/壽/印/盟/業/緣/人/移 · topicId 동적) · `DaeunPage` (運) · `MonthlyPage` (月) · `CompatResultPage` (合) · `TojungPage` (歲).
- [x] **HomePageV5 신규 + env flag 배포 체계** — `src/pages/HomePageV5.tsx` Path A/B/C/D 분기 13 블록 렌더 fn (useUserPath + stack useMemo). `App.tsx` 에 `VITE_HOME_V5_ENABLED` env flag 추가 (기본 OFF, 준기 승인 후 1% ramp). v4 HomePage 는 유지. 자체 결정 3건: env flag OFF / price-intro = 미니멀 텍스트 / Storage-Chat = inline card. 준기 override 대기.
- [x] **P2 · Path E 티켓 트래커** — `docs/prd/P2_Path_E_티켓_트래커.md` (E13 결제 원자성 · E32 공유 OG · E3 NotFound · E40 입력 임시저장 + §7 P2 5건, 합 ~13.5h)
- [x] **E3 · NotFound 보강 완료 (2026-04-22)** — `src/App.tsx` NotFoundPage `<a href>` → `useNavigate('/', {replace:true})` 전환 (SPA 이동 · 히스토리 오염 방지). SSOT 컬러 `#B8965A` 단색 통일 (구 `#C9A96E→#D4A843` gradient 제거). `ResultRouteGuard` 신규 — `/result/:id` base36 `[a-z0-9]{4,32}` 형식 검증 · invalid 시 `/` replace redirect. 근거: 인수인계 §7.3.
- [x] **E40 · 입력 임시저장 완료 (2026-04-22)** — `src/hooks/useInputDraft.ts` 신규 (sessionStorage `saju500:input_draft:v1` · 500ms 디바운스 · 24h TTL · schemaVersion 1). `src/pages/InputPage.tsx` 이어쓰기/새로 작성 Modal 배선 + Step5 진입 시 `clearDraft()`. `selectedProfile` (보관함 진입) · `?new=1` (강제 새입력) 경로는 Modal 비활성. 근거: 인수인계 §7.4.
- [x] **P2-2 · /input 재진입 플로우 완료 (2026-04-22)** — `src/pages/InputPage.tsx` 에 `editingProfileId` state 도입. Step 0 프로필 카드 구조 변경: motion.button → div wrapper + (선택 버튼 + 연필 아이콘 수정 버튼 44×44, aria-label="수정"). 수정 클릭 시 해당 프로필 pre-fill + Header 타이틀 "사주 수정" 으로 전환. Step 5 진입 시 `editingProfileId` 있으면 기존 report `deleteReport()` 후 새 reportId 생성. `saveProfileDirect` 의 name+birth 키 기반 자동 dedup 으로 동일 프로필 덮어쓰기 보장. `handleBack` (Step 1→0) · `handleSelect` · "+ 새 사주 입력하기" 에서 `editingProfileId` clear. 근거: 인수인계 §7.P2-2.
- [x] **P2-5 · 데일리 리워드 UI 완료 (2026-04-22)** — `src/services/storage/dailyReward.ts` 신규 (Phase 1 localStorage 기반, 키 `saju500:daily_reward:last` / `saju500:daily_reward:month`, 월 자동 리셋). `getDailyRewardState()` / `claimDailyReward()` — 일 1회 + 월 30회 제한, 성공 시 `addRewardBalance(0.1)`. `src/components/common/DailyRewardBadge.tsx` 신규 — 3-state 배지 (미수령 CTA / 수령완료 / 월 한도 초과), SSOT `#B8965A` + rgba 배경, 44×44 터치 영역, aria-live/aria-label. `DailyFortunePage.tsx` Header 아래 배치 (`hasAnyProfile && <DailyRewardBadge />`). 수령 성공 시 Toast "+0.1운이 지갑에 들어왔어요 ✨". **단위 결정 (자체, 준기 override 가능)**: 인수인계 원문 "3원" 과 런칭 프로모 PRD "3원 KRW" 의 명칭 충돌 해소 — 데일리 배지는 "0.1운 (=50원 상당)" 로 구현, 런칭 3원 프로모는 별도 `launchReward` 모델로 분리. TODO(server): Phase 2 Cloud Functions 로 이관 (어뷰징 방어). 근거: 인수인계 §7.P2-5 · `런칭프로모_3원리워드.md`.
- [x] **P2-4 · /chat 요금 정책 완료 (2026-04-22)** — `src/pages/ChatPage.tsx` ChatView 에 `quotaExceeded` state 추가. `sendMessage` 가 `userMsgCount > 0 && credits === 0` 조건에서 `setQuotaExceeded(true)` + `setShowBuyCredits(true)`. BuyCredits Modal 카피 분기 — 한도 초과 시 "오늘 무료 한도를 다 썼어요 · 1운으로 대화 3회를 이어갈 수 있어요. 아니면 내일 다시 만나요." / 자발적 탭 시 "대화권 충전". 취소 버튼 카피도 분기 ("내일 다시 올게요" / "취소"). 컬러 SSOT `#B8965A` 단색 적용. TODO(E13): `spendBalance(1) + addChatCredits(3)` 원자화 주석 삽입. 근거: 인수인계 §7.P2-4.
- [x] **P2-3 · 궁합 상대방 저장 완료 (2026-04-22)** — `src/services/storage/compatRecents.ts` 신규 (Phase 1 localStorage, 키 `saju500:compat_recents:v1`, MRU 최대 3명). API: `getRecentPartnerIds(validIds?)` / `addRecentPartner(id)` / `removeRecentPartner(id)`. `validIds` 넘기면 삭제된 프로필 자동 필터 + 저장소 정리. CompatibilityPage `handleSubmit` 에 `addRecentPartner(person2.id)` 배선. 프로필 picker bottom sheet slot 2 전용 상단에 "최근 본 상대방" chips row 추가 (rgba `#B8965A` + 이름/일간/오행 미니 카드, person1 선택자는 제외). **스코프 판단**: `saveProfileDirect` 가 이미 상대방 입력 시 자동 저장하므로 체크박스 대신 재사용 접근성 (최근 3명) 해결이 실제 UX 병목. TODO: Phase 2 `users/{uid}/partners/{pid}` Firestore 이관. 근거: 인수인계 §7.P2-3.
- [x] **P2-1 · 블러 공유 경계 완료 (2026-04-22)** — `src/utils/share.ts` `generateOgImage` 개선 — 블러 필드 위에 `drawLockIcon` 자물쇠 (좌상단) + 골드 CTA 배지 "잠금 해제하고 전체 보기 →" (중앙하단) 캔버스 네이티브 렌더. 컬러 SSOT `#C9A96E→#B8965A` 정렬. `shareResult` text 고정 "{이름}님의 사주 — 잠금 해제하고 전체 보기 →". `src/components/share/ShareModal.tsx` 프리뷰 카드에 동일한 자물쇠 SVG + CTA 오버레이. TODO: Phase 2 Cloud Function SSR OG (E32 와 묶음) · `shareResult(locked?: boolean)` 파라미터 추가해 paid 유저 분기 지원. 근거: 인수인계 §7.P2-1 · `프리미엄_티저블러.md`.
- [x] **E13 · 결제 원자성 완료 (2026-04-22)** — `functions/src/index.ts` `confirmPayment` (웹 토스페이먼츠) + `grantPurchase` (IAP) 둘 다 재작성. `payments/{orderId}` 에 **status 전이** 도입: `pending → confirmed | failed | needs_reconciliation`. 핵심 플로우 — (1) pending 선기록 → (2) Toss 승인 API (confirmPayment 만) → (3) 성공 시 transaction 으로 balance 증가 + `status:'confirmed'` / Toss 승인 실패 시 `status:'failed'` (재시도 허용) / Toss 승인 + DB 실패 시 `status:'needs_reconciliation'` + `tossApprovedAt` (수동 복구 유도). 중복 지급 방지는 `status==='confirmed'` 만 차단 (pending/failed 는 재시도 허용). `src/pages/ChargePage.tsx` catch 분기 **유형별 토스트** — "결제 승인 실패" (유저 취소) / "이미 처리된 결제" / "고객센터 문의" (needs_reconciliation) / 범용 폴백. 런칭 전 수동 QA 4건 필요 (정상/실패/재시도/중복). 근거: 인수인계 §7.1 · E13 트래커.
- [x] **E32 · 공유 비회원 OG SSR 완료 (2026-04-22)** — `functions/src/share/renderShareOg.ts` 신규 (113 lines, onRequest Gen 2). UA 분기: 봇 UA (facebookexternalhit, twitterbot, slackbot, kakaotalk, telegrambot, discordbot, whatsapp, linkedinbot, google, bing 등) → SSR OG HTML (og:title "사주 결과 — 잠금 해제하고 전체 보기 →" + og:description + og:image `/og-image.png` + 카카오톡·Twitter 확장 태그) / 사람 UA → `/index.html` self-fetch 후 SPA 전달. 리포트 ID regex `[A-Za-z0-9_-]{4,64}` 검증, 형식 불일치 404. 캐시 정책 — 봇 5분 CDN (public, max-age=300, s-maxage=600) · 사람 no-store. `firebase.json` rewrite `{ "source": "/share/**", "function": "renderShareOg" }` SPA 폴백보다 앞에 배치. `index.ts` `export { renderShareOg }` 배선. Phase 2 TODO: 리포트별 동적 OG PNG (Storage 캐싱) · `shareResult(locked?: boolean)` paid 유저 분기 · self-fetch ~200ms 최적화. 근거: 인수인계 §7.2 · `프리미엄_티저블러.md`.
- [x] **컴파일 검증 (6회)** — `npx tsc --noEmit` (client + functions) 0 에러 (E3 + E40 + P2-2 + P2-5 + P2-4 + P2-3 + P2-1 + E13 + E32 누적). **Path E 4종 + §7 P2 5건 전건 완결**. 남은 건 준기 배포 승인 + 수동 QA (Facebook Sharing Debugger · Slack unfurl · 카카오톡 · DevTools offline throttle) + Firestore rules `status` 필드 쓰기 차단.

### 🆕 2026-04-22 · UI/톤앤매너 통일 (오후 세션)

> 준기 지시: "UI 통일·톤앤매너 통일 · 다 반영 → 내가 QA"

- [x] **HomePage v4.1 포팅** — `src/pages/HomePage.tsx` (322→448L). 10-section IA: Profile→Daily(火)→Dream(夢)→Premium(命)→Extensions4→Topics5→Chat(問)→Philosophy→Reviews→Hashtags22→Footer. Premium 카피: "처음부터 끝까지 읽어드립니다" (가격액·"1만 4천 자" 제거). HASHTAGS 22개 (가격·AI 키워드 0). 구 v3 14 gap 일괄 해소.
- [x] **reviews.ts UX 라이팅 정렬** — `src/constants/reviews.ts` "광고는 있지만…" 부정문 제거, 50/60대 맘카페 어투(`~^^`, "처음해. 봤는대요" 패턴) 추가.
- [x] **SSOT 컬러 일괄 통일** — `src/styles/globals.css` 변수(`--brand-gold` `#C9A96E→#B8965A`, `--brand-gold-vivid` `#D4A843→#8C6D3D`) + `sed` 39 파일 하드코딩 골드 일괄 치환. 머스타드 #B8941F 잔재 0건. (deprecated 주석 의미 보존)
- [x] **적천수 NOTE 정리 4파일** — `LoadingPage.tsx` L35, `AILoading.tsx` L45, `DreamPage.tsx` L344-352, `DailyFortunePage.tsx` L271-279. 임시 placeholder "출처 검토 중" → 정상 attribution "한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반".
- [x] **MyPage 앱인토스 분기** — `src/pages/MyPage.tsx` `isAppsInToss()` 감지 + **MENU_ITEMS_AIT** (운충전·결제내역·이용약관·개인정보·고객문의 5개; 분석기록·로그아웃·회원탈퇴 제거) vs **MENU_ITEMS_WEB** 분기. 결제/사용 내역 항목 신규(`/charge?tab=history`). 정책: `project_appintos_webapp_split.md`.
- [x] **StoragePage cascade NO-OP 명시** — `src/services/storage/localStore.ts` `deleteReport`/`deleteProfile` 양 함수 NO-CASCADE 주석 + `StoragePage.tsx` 헤더에 SajuProfile vs LocalReport 분리 모델 명시. "보관함에서 분석 1건을 지워도 사주 프로필은 유지" / "프로필 지워도 결제한 분석 결과는 보관함에 남는다" 명문화. 정책: `project_storage_data_model.md`.
- [x] **LoadingPage v2 의식형 3-tier** — `src/pages/LoadingPage.tsx` (192→308L). PRD `로딩전략.md` §2.1 준수: ① 만세력 추출 카드(입력 시각 → 진태양시 보정), ② 사주 4기둥 즉시 노출(干/支 오행 컬러 분리, 일주 골드 강조), ③ `REPORT_SECTIONS` 12 섹션 스켈레톤(점진 채움). 단계 인디케이터 + 회전 카피 6 풀 + 팁 카드 17개. 스트리밍 미적용(서버 generateReport 단일 호출 한계).
- [x] **10주제 SSOT 정렬 end-to-end (2026-04-22 PM)** — 홈→URL→페이지→라우터→서버 AI 프롬프트 5계층 일괄 정렬.
  - **HomePage**: 인라인 TOPIC_COLORS / 10-topic 배열 제거 → `listTopics()` from `src/constants/topics.ts` SSOT 소비. 키만 바꿔도 홈 카드가 자동 반영되는 구조.
  - **TopicAnalysisPage**: URL param `useParams` 직후 `normalizeTopicId()` 통과 (legacy `moving`/`reconciliation`/`job` 등 SSOT canonical 로 매핑). TOPICS map 에 `exam` 신규 + `move` canonical + `moving` legacy alias. TopicViz switch 분기 + topicExtra 배열 갱신.
  - **FooterCTA**: SSOT v1 한자 정렬 — `topic:love` 桃→**緣**, `topic:study` 印→**學**, `topic:marriage` 盟→**婚**, `topic:reunion` 緣→**復**. `topic:exam` (進) + `topic:move` (移) 신규, `topic:moving` legacy alias 보존. emblemColor 도 SSOT 5색+확장 4색 기준.
  - **TopicIcons**: `TOPIC_ICONS` 매핑에 `exam: IconTopicStudy` (전용 픽토그램 준비 전 study 재사용) + `move: IconTopicMoving` canonical 추가.
  - **서버 claudeTopic.ts**: ① `moving` 키 → `move` 리네임 (canonical 일치) ② `exam` TopicConfig 신규 (5 sections + specificPrompt 정관·편관·문창·학당·태극귀인 길성 반영 + topicData schema: subScores·changeMode·bestChangeMonths·interviewTime·bestField 등) ③ `SERVER_TOPIC_ALIASES` (moving/reconciliation/job/company/marry/test/exam_job → canonical) + `normalizeTopicIdServer()` ④ `TOPIC_BOUNDARIES` 10주제 × {scope, excludes} 상수 + `boundaryBlock` 프롬프트 주입 ("같은 사주 → 10주제 결과 모순 절대 금지" 강제, 인접 주제 영역 한 줄도 언급 금지). reunion 16k tokens·기타 8k maxTokens 정책 유지.
  - **SSOT v1 canonical**: 緣(love)·復(reunion)·婚(marriage)·財(wealth)·進(exam)·業(business)·壽(health)·移(move)·學(study)·官(career) 10한자.
  - 효과: 같은 사주로 10주제 분석 시 cross-topic 모순 (연애에서 결혼 timing 단정·시험에서 직업 평생 적성 단정 등) 프롬프트 레벨에서 차단. 향후 주제 추가는 `topics.ts` + 서버 `TOPIC_CONFIGS`/`TOPIC_BOUNDARIES` 만 손대면 되도록 단일 진입점화.
- [x] **컴파일 검증 (UI/톤 통일 + SSOT 10주제 정렬, 9회 누적)** — `npx tsc --noEmit -p tsconfig.json` (client) + `cd functions && npx tsc --noEmit` 양쪽 EXIT=0. 변경 0 에러.
- [x] **DailyFortune·Dream Flippable 제거 v2 (2026-04-22 PM)** — 두 페이지의 `LuckyColorCard` / `LuckyStatCard` 정적화. 탭-숨김 패턴 폐기 (앞면=라벨/값 + 뒷면=이유 → 한 카드 안에 라벨+값+이유 인라인 노출).
  - **이유**: 모바일에서 "탭해서 이유 보기" 발견율 낮음. 운세 콘텐츠는 "왜" 가 가장 신뢰감 주는 정보라 숨길 이유 없음. 양쪽 페이지 동일 컴포넌트 시그니처 유지 (`LuckyStatCard {title, value, reason}`) — 호출부 무수정.
  - **DailyFortunePage.tsx**: `Flippable` import 제거 (주석 보존). `LuckyColorCard` (160→정적, height prop 옵셔널 유지하지만 미사용), `LuckyStatCard` (160→정적). `TimeSlotCarousel` 은 carousel 그대로 유지 (시간대 시각화 정당).
  - **DreamPage.tsx**: 동일 패턴. `Flippable` import 제거. `LuckyColorCard` / `LuckyStatCard` 양쪽 정적화 + DailyFortunePage 와 톤 통일 (sec-meta `--brand-gold` · sec-title 15px · text-body-sm 12px `--text-secondary` line-height 1.5).
  - **SajuMiniCard.tsx 의 Flippable 은 보존** — 4기둥 본정보(干支) 와 별도의 꿈·오늘 연결 해석을 두 layer 로 명확히 분리하는 의도된 인터랙션. LuckyCard 의 "단일 값+이유" 패턴과 성격이 다름.
  - **Result premium v2/v3 는 #40 으로 분리** — ResultPage 에 premium/blur/잠금 코드 0건 (1운 전용, 5000원은 Daeun/Monthly/Compat/Tojung 별도 페이지). 이미 v4 수준 visualization 12+ 풍부 (3420L). "premium v2/v3" 의 페이지·디자인 스코프 모호 → 준기 결정 대기.
  - **컴파일 검증 (10회 누적)** — client + functions tsc EXIT=0.
- [x] **통일성 최종 sweep — SSOT·이모지·하드코딩 정렬 (2026-04-22 PM 종결)** — Task #41. Daily/Dream 페이지의 cross-page 모순 해소 + 유저 노출 이모지 잔재 박멸 + 가격 노출 정책 정렬.
  - **DailyFortunePage·DreamPage 의 `DAILY_TOPIC_ITEMS` / `DREAM_TOPIC_ITEMS` → SSOT 소비 전환** — 두 페이지 모두 인라인 하드코딩 컬러 (`#E91E63` 핑크 · `#1565C0` 블루 · `#2D8A4E` 그린) 와 혼합 라벨 ("연애·결혼" 등) 을 갖고 있어, 같은 사주가 페이지마다 다른 색·다른 주제로 보이는 cross-page drift 발생. `import { TOPIC_REGISTRY } from '@/constants/topics';` 추가 후 `{id, title, desc, price, color}` 모두 `TOPIC_REGISTRY[id].label / .color` 에서 직접 소비. 이로써 SSOT v1 한자·SSOT 5색 단일 진입점 보장 → 홈/Daily/Dream/TopicAnalysis 4페이지가 같은 주제 = 같은 색 = 같은 한자.
  - **가격 표기 "1운 (500원)" → "1운"** — `project_pricing_hide_amount.md` (UI엔 운 단위, 원화는 ChargePage 만) 정책 정렬. Daily/Dream 주제 카드 4종 모두 적용.
  - **유저 노출 이모지 3건 박멸 (`feedback_no_emoji_strict.md` 재강조)**:
    - `InputPage.tsx` L726 — 출생시간 안내 배지의 `🕐` → `時` 한자 원형 뱃지 (18×18 · `rgba(184,150,90,0.20)` 배경 · `#7F6B4E` 텍스트 · Noto Serif KR · 900 weight). 한자노출_정책에 부합하는 "상징·프레임" 사용.
    - `DailyRewardBadge.tsx` — toast 카피 `+0.1운이 지갑에 들어왔어요 ✨` → `+0.1운이 지갑에 들어왔어요` (✨ 제거). 헤더 docstring 도 ✨/🎉 잔재 정리 + "이모지 절대 금지 (2026-04-22 준기 재확인 · SVG/한자/컬러칩만 허용)" 원칙 명문화.
    - `App.tsx` L63 — NotFoundPage 주석 내 `🟧` → `P0` 텍스트.
  - **`Flippable` 컴포넌트 자체는 유지** — `SajuMiniCard.tsx` 의 4기둥 본정보(干支) ↔ 꿈·오늘 연결 해석 2-layer 분리는 의도된 인터랙션이므로 보존. 단일 값+이유의 LuckyCard 패턴과 성격이 다름.
  - **컴파일 검증 (11회 누적)** — `npx tsc --noEmit -p tsconfig.json` (client) + `cd functions && npx tsc --noEmit` 양쪽 EXIT=0.

### ✅ 기존 완료
- [x] 사주아이 등 경쟁사 벤치마킹 (한국 3사 + 일본 2사 + 중국 2사 + 서구 2사)
- [x] 만세력 라이브러리 + KR 진태양시 보정 + 30 TC
- [x] AI 프롬프트 v2.1 (6대 원전 기반 + 2차 자기 리뷰)
- [x] 브랜딩 확정 (Deep Navy + Gold + 크림, "사주500")
- [x] 가격 전략 v3.1 (3-bucket · 블러잠금 · 3원 리워드 · 후기)
- [x] 12페이지 프론트엔드 구현
- [x] 코드 스플리팅 (초기 로드 gzip ~100KB)
- [x] Cloud Functions 5개 (Claude/Gemini + IAP + 공유 리워드)
- [x] 앱인토스 정책 준수 (뒤로가기/라이트모드/TDS 52px/IAP)
- [x] 운(運) 3-bucket + 어뷰징 방지
- [x] 공유 리워드 (0.5운/회, 월 5운 한도)
- [x] 일일 무료 패스 (오늘운세/꿈해몽 무료, 사주대화 1일 1회)
- [x] BalanceBar + Toast + ShareModal
- [x] granite.config.ts + PWA manifest
- [x] **PRD 29종 작성 완료** (Category A + Category B)
- [x] **명리학 백과사전 8권 3부록** 구축
- [x] **한자 이원화 정책** 정립 + 5개 PRD 역전파
- [x] 전략기획서 v2 작성 (`사주500_전략기획서_v2.docx`)
- [x] 로고 PNG 600x600 2버전 (navy/cream)

### ⚠ 미승인 코드 변경 (반드시 준기 확인 후 적용)
- `claudeReport.ts`: 시스템/유저 프롬프트 분리 + JSON 파싱 개선
- `InputPage.tsx`: 더블클릭 방지 로직
- `InputPage.tsx`: 천간 성격 플래시 카드 (미승인)
- `DreamPage/TopicAnalysisPage/DailyFortunePage`: 한자→이모지 (미승인 — 이모지 넣지 말라고 함)
- `LoadingPage.tsx`: 클라이언트 환불 로직 제거 (보안 수정, OK)

### 🔜 다음 할 일 (우선순위 — 2026-04-22 재정렬)

**P0 — 인수인계 직결 (런칭 경로)**
1. **HomePage.tsx v5 Path 분기 구현** — `diff v3 §2/§7` 대로 A/B/C/D 스택 렌더. 준기 결정 3건 필요:
   - (a) env flag `VITE_HOME_V5_ENABLED` 기본값 (on/off/1% ramp)
   - (b) price-intro 블록 존재/디자인 (Path B·C 상단 배치)
   - (c) Storage-Chat 강화 scope (Path D 사이드바 vs inline)
2. **9 mockup → 프로덕션 페이지 5종(주제) + 4종(확장) 포팅** — `diff v3 §4/§5` SSOT
3. **Result 페이지 Footer 3-part CTA 통일** — `[page_emblem] + [XX 전체로 보기] + [10운으로 시작]` (`diff v3 §6`)
4. **적천수 출처 치환** — src 6파일 (AILoading, academicReferences, prompts.ts, DailyFortunePage:271, DreamPage:347, LoadingPage:35) + docs 6파일 (내부만) + Cowork 6 mockup (준기 수동). A안 "출처 검토 중" 일괄.
5. **Path E 4종** — ~~E3 NotFound~~ ✅ · ~~E40 입력 임시저장~~ ✅ · ~~E13 결제 원자성~~ ✅ · ~~E32 공유 비회원 OG SSR~~ ✅ **전건 완결 (2026-04-22)**. 런칭 전 남은 건: (a) `firebase deploy --only functions,hosting` (b) Facebook Sharing Debugger · Slack unfurl · 카카오톡 링크공유 3종 E32 검증 (c) DevTools offline throttle 로 E13 결제 실패 시나리오 QA 4건 (정상/실패/재시도/중복) (d) Firestore rules 에서 `payments.status` 쓰기 차단 (Cloud Function only).
6. **P2 §7 5건** — ~~/input 재진입~~ ✅ · ~~데일리 리워드~~ ✅ · ~~블러 공유 경계~~ ✅ · ~~궁합 상대방 저장~~ ✅ · ~~/chat 요금~~ ✅ **전건 완결 (2026-04-22)**.

**P0 — 기존 런칭 전 필수**
7. 전략기획서 v3.1 갱신 (29 PRD 반영 통합 문서)
8. ~~Opus vs Sonnet A/B 비교 테스트~~ ✅ **close out (2026-04-22 준기 "Opus로 가자" 지시)** — 500원 리포트 Opus 4.6 확정, A/B skip. `project_model_decision_opus_confirmed.md` 참조.
9. Firebase deploy + 실제 API 테스트 (준기 수동 — Firebase CLI 인증 필요)
10. 앱인토스 ait build + 테스트 (준기 수동 — 토스 developer 승인 경로)
11. `수용기준_체크리스트` × 12페이지 전수 감사 (Claude 자동 감사 가능 — 요청 시 착수)
12. `런칭_체크리스트` T-30 시점 착수 (준기 트리거 대기)

**P1 — 런칭 직후**
13. 인스타/스레드 계정 + 콘텐츠 5개 선제작
14. SEO 타겟 키워드 + 블로그 1편
15. 3원 리워드 프로모션 캠페인
16. 블러잠금 후기 수집 파이프라인

**P2 — 성장**
17. 인플루언서 3~5명 리스트업
18. Phase 2: 전화번호 계정 통합
19. 궁합/월운 프리미엄 10운 상품 전환

### 산출물 파일
- `사주500_전략기획서_v2.docx` — 경쟁사·차별화·마케팅·해외·로드맵 (v3.1 갱신 대기)
- `logo_navy_600x600.png` · `logo_cream_600x600.png`
- `docs/prd/` — PRD 29종 (Category A 22개 + Category B 7개)

---

## 작업 시 체크리스트

코드 수정/생성 전:
- [ ] 관련 PRD 읽었는가?
- [ ] 한자 이원화 원칙 위반 없는가? (UI 라이트는 한자 금지)
- [ ] 수용기준 확인했는가?
- [ ] 퀄리티 바 4축 (디자인·라이팅·리듬·지식) 통과?
- [ ] 앱인토스 규칙 (TDS·라이트모드·IAP) 위반 없는가?
- [ ] 미승인 변경을 배포에 섞지 않았는가?

PR/배포 전:
- [ ] `수용기준_체크리스트` 해당 섹션 통과
- [ ] `페이지감사_체크리스트` 해당 페이지 통과
- [ ] `사람손떼_체크리스트` 통과
- [ ] A/B 비교 결과 기록 (모델 변경 시)
