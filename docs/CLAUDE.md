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
| 프리미엄 | 5,500원 (10운) | 심층분석 + PDF + 월운 + 궁합 |
| 전문가 | 55,000원 | 명리학 전문가 1:1 (Phase 3) |

- 가상화폐: **운(運)**, 1운 = 500원
- 충전 패키지: 1운(500원) / 4운(1,650원) / 7운(2,750원) / 14운(5,500원)

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
```

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

## 현재 상태 (2026.03.30)

- [x] 사주아이 벤치마킹 완료
- [x] 사업기획서 v1
- [x] 만세력 라이브러리 선정 (lunar-javascript)
- [x] 8글자 완전판 데이터 추출 성공
- [x] AI 프롬프트 v2 (전체 고급 데이터 포함)
- [x] 결과 페이지 v4 프로토타입 (4기둥/시간미입력/반응형/인포그래픽)
- [x] 브랜딩 가이드 확정
- [x] 가격 전략 확정 (500 시리즈)
- [x] 기술 설계서 완성 (폴더구조/데이터모델/API)
- [ ] **다음: 프로젝트 스캐폴딩 생성 + 개발 시작**
