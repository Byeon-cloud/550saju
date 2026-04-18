# CLAUDE.md — 사주500 프로젝트 컨텍스트

> 이 문서는 Claude Code가 프로젝트를 이해하기 위한 **진입점**입니다.
> 웹 채팅(claude.ai)에서 설계한 내용을 여기서 이어서 개발합니다.
> **최종 업데이트: 2026-04-18** (Category A+B PRD 29종 반영)

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
- **컬러** (Deep Navy + Gold 계열 + 크림 배경):
  - Primary: #A08B6A (골드브라운)
  - Background: #F5F0E8 (크림)
  - Text: #3D3427 (다크브라운)
  - Surface: #FFFFFF
  - Border: #E8E0D4
- **오행 컬러**: 목=#2D8A4E · 화=#D32F2F · 토=#F57F17 · 금=#757575 · 수=#1565C0
- **폰트**: Pretendard

상세: `docs/prd/디자인토큰.md` · `docs/prd/브랜드스토리텔링.md` · `docs/prd/컴포넌트_라이브러리.md`

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
2. `docs/prd/용어집.md` (모든 용어 정렬)
3. `docs/prd/명리학_백과사전.md` (지식 백본 — 지식 질문 시)
4. `docs/prd/한자노출_정책.md` (모든 콘텐츠 작업 전)
5. `docs/prd/콘텐츠퀄리티가이드.md` (퀄리티 바)
6. `docs/prd/수용기준_체크리스트.md` (PR 체크용)
7. 구현 대상 페이지 해당 PRD

### 기존 설계서 (PRD 이전 세대 문서 — 참고만)
- `docs/사주500_UIUX_상세설계서.md` — IA, 유저플로우 (핵심은 PRD로 분리 완료)
- `docs/사주500_브랜딩_가이드.md` — 컬러/톤 (디자인토큰.md로 흡수)
- `docs/사주500_기술설계서_v1.md` — 데이터 모델/API
- `docs/사주500_프롬프트_v2.js` — 프롬프트 원본 (v2.1로 업데이트됨)
- `docs/사주500_리포트_v2_준기님.md` — 리포트 샘플

---

## 현재 상태 (2026-04-19)

### ✅ 완료
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

### 🔜 다음 할 일 (우선순위)

**P0 — 런칭 전 필수**
1. 전략기획서 v3.1 갱신 (29 PRD 반영 통합 문서)
2. Opus vs Sonnet A/B 비교 테스트 (3개 사주 데이터)
3. Firebase deploy + 실제 API 테스트
4. 앱인토스 ait build + 테스트
5. `수용기준_체크리스트` × 12페이지 전수 감사
6. `런칭_체크리스트` T-30 시점 착수

**P1 — 런칭 직후**
7. 인스타/스레드 계정 + 콘텐츠 5개 선제작
8. SEO 타겟 키워드 + 블로그 1편
9. 3원 리워드 프로모션 캠페인
10. 블러잠금 후기 수집 파이프라인

**P2 — 성장**
11. 인플루언서 3~5명 리스트업
12. Phase 2: 전화번호 계정 통합
13. 궁합/월운 프리미엄 10운 상품 전환

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
