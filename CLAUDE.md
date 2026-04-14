# CLAUDE.md — 사주500 프로젝트 컨텍스트

> 이 문서는 Claude Code가 프로젝트를 이해하기 위한 컨텍스트입니다.
> 웹 채팅(claude.ai)에서 설계한 내용을 여기서 이어서 개발합니다.

---

## 프로젝트 개요

- **서비스명**: 사주500
- **한 줄 정의**: 500원에 제공하는 극상 퀄리티 AI 사주 풀이 서비스
- **플랫폼**: 웹 (반응형) + 토스 앱인토스 동시
- **기술 스택**: React 18 + TypeScript + Vite + Tailwind CSS + Firebase + lunar-javascript
- **AI**: Claude API (Opus/Sonnet)
- **만세력**: lunar-javascript (npm: lunar-javascript)
- **결제**: 토스페이먼츠 (웹) + 토스 IAP (앱인토스)
- **앱인토스**: @apps-in-toss/web-framework + @toss/tds-mobile

---

## 가격 전략 "500 시리즈"

| 티어 | 가격 | 상품 |
|------|------|------|
| 무료 | 0원 | 오늘의 운세 (매일 1회) |
| 기본 | 500원 (1운) | AI 사주 리포트 10섹션 + 인포그래픽 |
| 프리미엄 | 5,000원 (10운) | 심층분석 + PDF + 월운 + 궁합 |
| 전문가 | 50,000원 | 명리학 전문가 1:1 (Phase 3) |

- 가상화폐: **운(運)**, 1운 = 500원
- 충전 패키지: 1운(500원) / 4운(1,500원) / 7운(2,500원) / 14운(5,000원)

---

## 톤앤매너

- 신비 + 고급 + 깔끔 + 모던 (무속인/점집 느낌 절대 아님)
- 캐릭터 없음 (미니멀 심볼 로고)
- 컬러: 크림/아이보리 기반, 골드브라운 포인트
  - Primary: #A08B6A (골드브라운)
  - Background: #F5F0E8 (크림)
  - Text: #3D3427 (다크브라운)
  - Surface: #FFFFFF
  - Border: #E8E0D4
- 오행 컬러: 목=#2D8A4E, 화=#D32F2F, 토=#F57F17, 금=#757575, 수=#1565C0
- 폰트: Pretendard

---

## 핵심 기술 결정사항

### 만세력 계산 (lunar-javascript)
```javascript
import { Solar } from 'lunar-javascript';

// 시간 있을 때
const solar = Solar.fromYmdHms(1998, 3, 3, 5, 0, 0);
// 시간 없을 때
const solar = Solar.fromYmd(1998, 3, 3);

const lunar = solar.getLunar();
const ec = lunar.getEightChar();

// 사주 원국
ec.getYear();     // 년주 간지
ec.getMonth();    // 월주 간지
ec.getDay();      // 일주 간지
ec.getTime();     // 시주 간지

// 십성
ec.getYearShiShenGan();  // 년간 십성
ec.getTimeShiShenZhi();  // 시지 십성

// 지장간
ec.getYearHideGan();     // ['甲', '丙', '戊']

// 12운성
ec.getDayDiShi();        // '长生'

// 납음
ec.getYearNaYin();       // '城头土'

// 대운
const yun = ec.getYun(1); // 1=남, 0=여
const daYuns = yun.getDaYun();

// 신살
lunar.getDayJiShen();    // 길신
lunar.getDayXiongSha();  // 흉살

// 공망
lunar.getYearXunKong();  // 년주 공망
lunar.getDayXunKong();   // 일주 공망
```

### AI 프롬프트 구조
- 시스템 프롬프트: 명리학 해석 규칙 (src/constants/prompts.ts)
- 유저 프롬프트: 사주 데이터 구조화 + 상황 질문 (src/services/saju/promptBuilder.ts)
- 출력: 10개 섹션 (총평/성격/대인/직업/재물/애정/건강/올해운세/과제/개운법)
- 각 섹션 300자 이상, 구체적 행동 패턴 묘사, "왜" 설명 포함

### 시간 미입력 처리
- 시주(時柱) 칸은 항상 4번째로 존재
- 미입력 시: 점선 테두리 + "출생시간 미입력" 오버레이
- 상단에 안내 배너 표시
- 상세풀이에서 시주 관련 해석 조건부 제외

---

## 폴더 구조

```
src/
├── pages/          # 페이지 (HomePage, InputPage, ResultPage, ...)
├── components/     # 재사용 컴포넌트
│   ├── common/     # Button, Modal, Loading, FadeIn
│   ├── saju/       # PillarCard, ElementRadar, ScoreRing, DaeunTimeline, ...
│   ├── input/      # DatePicker, TimePicker, SituationQ
│   └── payment/    # ChargeModal, PaymentButton
├── hooks/          # useAuth, useSaju, useBalance, usePageTracking
├── services/       # 비즈니스 로직
│   ├── saju/       # calculator, dataExtractor, promptBuilder
│   ├── ai/         # reportGenerator
│   ├── auth/       # firebase, authService
│   ├── payment/    # balanceService, tossPayments
│   └── firestore/  # userStore, reportStore, paymentStore
├── types/          # saju.ts, user.ts, payment.ts, report.ts
├── constants/      # oheng.ts, pricing.ts, prompts.ts
└── utils/          # format.ts, share.ts
```

---

## Firestore 컬렉션

```
users/{uid}                     - 유저 (balance, provider, ...)
users/{uid}/profiles/{pid}      - 프로필 (이름, 생년월일, 만세력 캐싱)
users/{uid}/reports/{rid}       - 리포트 (AI 생성 결과, 점수, 공유ID)
users/{uid}/payments/{payid}    - 결제내역 (충전/사용/환불)
users/{uid}/dailyFortune/{date} - 일일운세
users/{uid}/chats/{chatId}     - 채팅 기록
users/{uid}/shareLogs/{logId}  - 공유 리워드 로그
```

### 데이터 보관 정책

| 데이터 | 보관 기간 | 근거 |
|--------|-----------|------|
| 사주 리포트 (유료) | 영구 (계정 생존) | 핵심 가치, 비용 무시 가능 ($3/10만유저/월) |
| 유저 프로필 | 영구 | 재분석 필요 |
| 결제 기록 | 5년 | 전자상거래법 |
| 일일 운세 (무료) | 30일 롤링 | 에페메럴 콘텐츠 |
| 채팅 기록 | 90일 | 업계 표준 |
| 비활성 계정 | 1년 후 분리 보관, 3년 후 삭제 | 개인정보보호법 |
| 계정 삭제 후 | 5일 이내 삭제 | 개인정보보호법 |

### 멀티 플랫폼 계정 전략

```
앱인토스(토스 로그인) ─┐
                      ├→ Firebase Auth (provider link) → 하나의 uid
웹(카카오/구글/네이버) ─┘
```

- **서버는 하나** (Firebase Firestore + Functions + Auth)
- **프론트엔드만 분기** (isAppsInToss() 감지)
- **결제 분기**: 앱인토스=IAP, 웹=토스페이먼츠 PG
- **계정 통합**: 전화번호 기반 (Phase 2)
  - 같은 전화번호로 다른 provider 로그인 시 → 기존 계정에 link
  - Firebase Auth의 `linkWithCredential()` 사용
  - Phase 1에서는 플랫폼별 독립 계정 → Phase 2에서 통합

---

## 라우팅

```
/              - 메인 (랜딩)
/input         - 사주 입력
/loading       - AI 분석 중
/result/:id    - 결과 페이지
/daily         - 오늘의 무료운세
/compat        - 궁합
/storage       - 보관함
/charge        - 운 충전
/my            - 마이페이지
/share/:id     - 공유 링크 수신
```

---

## 개발 규칙

1. **모바일 퍼스트**: max-width 520px 기준, 데스크톱은 중앙 정렬
2. **앱인토스 규칙**: window.confirm()/alert() 금지, TDS 모달 사용 (52px 버튼, #3182F6)
3. **한자 + 한국어 항상 병기**: 모든 한자에 한국어 읽기+의미 동시 표기
4. **파일 단위 완성**: 점진적 패치보다 완성된 파일 선호
5. **빌드**: 앱인토스는 `ait build`, 웹은 `vite build`
6. **NODE_OPTIONS**: 빌드 시 `NODE_OPTIONS=--max-old-space-size=4096` 필요할 수 있음

---

## 참고 문서 (docs/ 폴더)

- **사주500_UIUX_상세설계서.md** — ⭐ 가장 중요! IA, 유저플로우, 디자인시스템, 컴포넌트, 스토리보드, 인터랙션, 반응형 규칙 전부 포함. 모든 화면 개발 시 반드시 이 문서 참조.
- 사주500_브랜딩_가이드.md — 컬러, 톤, 화폐, 포지셔닝
- 사주500_기술설계서_v1.md — 가격 전략, 데이터 모델, API 파이프라인, 개발 일정
- 사주500_프롬프트_v2.js — AI 시스템 프롬프트 + 유저 프롬프트 템플릿
- 사주500_리포트_v2_준기님.md — 리포트 샘플 (10개 섹션)

**개발 시 필수 읽기 순서:**
1. 이 CLAUDE.md (전체 개요)
2. UIUX 상세설계서 (디자인 규칙 — 이거 안 읽으면 디자인 불일치)
3. 기술설계서 (데이터모델/API)
4. 브랜딩 가이드 (컬러/톤)

---

## 현재 상태 (2026.04.03)

- [x] 사주아이 벤치마킹 완료
- [x] 만세력 라이브러리 (lunar-javascript) + 8글자 데이터 추출
- [x] AI 프롬프트 v2 (학술 기반 6대 원전 + 소름 포인트)
- [x] 브랜딩 확정 (Deep Navy + Gold, "사주500")
- [x] 가격 전략 확정 (1운=500원, 프리미엄 10운 준비)
- [x] 전체 12페이지 프론트엔드 구현 완료
- [x] 코드 스플리팅 (초기 로드 gzip ~100KB)
- [x] Cloud Functions 5개 (Claude/Gemini 연동 + IAP 지급 + 공유 리워드)
- [x] 앱인토스 정책 준수 (뒤로가기 금지, 라이트모드, TDS 52px, IAP)
- [x] 운(運) 잔액 3종 분리 (paid/bonus/reward) + 어뷰징 방지
- [x] 공유 리워드 시스템 (0.5운/회, 월 5운 한도)
- [x] 일일 무료 패스 (오늘운세/꿈해몽 무료, 사주대화 1일 1회)
- [x] 글로벌 BalanceBar + Toast + ShareModal
- [x] granite.config.ts + PWA manifest
- [ ] **다음: Firebase deploy + 실제 API 테스트 + 앱인토스 ait build**
