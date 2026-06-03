# 사주500 — 재물 (財) 8 Archetype 매트릭스 v1

> **목적**: 재물운 결과 페이지가 **사주에 따라 진짜 다양해 보이도록** archetype별 데이터·카피·시각 spec 정의.
> **작성**: 2026-05-08 (PD 결단: "재물운 다양성이 핵심")
> **상위 SSOT**: `사주500_UI개편_16_주제별_고유IA_v1.md` (재물 6섹션 IA)
> **하위 산출물**: AI prompt schema 분기 로직 + 코드 동적 렌더링

---

## 0. 핵심 원칙

### 0.1 IA 는 동일, 데이터·카피·시각만 분기
- **6섹션 구조 고정** (§A 재성 분포 / §B 돈 출처 / §C 12개월 / §D 함정 / §E 평생 + 자리 / §F 결단)
- **archetype 뱃지 = 페이지 정체성** (헤더 직후 노출)
- 각 섹션의 **데이터·색·카피만 archetype 별로 다름** — 구조는 그대로

### 0.2 archetype 분류 = AI 자동 진단
- 사주 8글자 → 십성 분포 + 일간 강약 + 시주·년주·월주 재성 분포 → 8 archetype 매핑
- 일부 사주는 2 archetype 겹침 가능 (예: "안정형 + 말년부" / "사업형 + 식신생재") — 카피로 결합 표현

### 0.3 검증 mockup 2개 (락 진본 후보)
- **안정형 (변준기)** = `사주500_UI개편_목업_1운_주제별_재물_v3.html`
- **사업형 (김민지)** = `사주500_UI개편_목업_1운_주제별_재물_v3_사업형.html`
- IA flex 입증 완료 → 나머지 6 archetype 은 코드/AI 단계에서 동일 패턴으로

---

## 1. 8 Archetype 정의

| # | Archetype | 한자 글리프 | 사주 신호 | 핵심 메시지 | 페르소나 예시 |
|---|---|---|---|---|---|
| 1 | **안정형 (직장형)** | 安 | 정재 우세 + 일간 강 | "정직하게 쌓아두면 자연스럽게" | 30대 직장인 |
| 2 | **사업형 (변동·식신생재)** | 業 | 편재 우세 + 식신 강 | "흐름 타세요. 변동이 결" | 자영업자·창업가 |
| 3 | **재다신약 (보고도 못 잡음)** | 急 | 재성 多 + 일간 弱 | "혼자 다 잡으려 마세요" | 욕심많은 젊은 사장 |
| 4 | **벌이 약형** | 弱 | 재성 약 + 식상 강 | "본인이 만들어야 풀려요" | 학생·창작자 진입 |
| 5 | **말년부 (시주 재성)** | 末 | 시주 재성 강 | "30대 후반부터 본격" | 늦은 성공형 |
| 6 | **초년부 (년·월 재성)** | 早 | 년주·월주 재성 강 | "지금이 황금기 — 놓치지 말고" | 20대 신흥 부자 |
| 7 | **양다리형 (직+사업)** | 兩 | 정관 + 편재 균형 | "둘 다 잡아도 돼요" | 본업+부업 균형 |
| 8 | **비겁누수형** | 劫 | 비겁 多 (3개 이상) | "동업·형제 누수 주의" | 형제 많은 가정·동업가 |

### 추가 보조 (특수 케이스)
- **창작·식상생재형 (藝)** — 식상 매우 강 + 편재 매핑. 콘텐츠·창작·서비스. 사업형의 sub-type.

---

## 2. Archetype × 6 섹션 매트릭스

### 2.1 §A 재성 분포 (십성 5축 + 점수 ring)

| Archetype | 정재 | 편재 | 식상 | 비겁 | 인성 | 점수 | 라벨 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| 安 안정형 | 35 | 12 | 22 | 15 | 16 | 72 | 정재 우세 — 안정 수입형 |
| 業 사업형 | 8 | 42 | 25 | 15 | 10 | 78 | 편재 우세 — 변동·사업형 |
| 急 재다신약 | 25 | 35 | 12 | 18 | 10 | 58 | 재성 강하나 일간 약함 — 잡기 어려운 결 |
| 弱 벌이 약형 | 10 | 8 | 32 | 18 | 32 | 50 | 재성 약 + 본인 만들어야 |
| 末 말년부 | 30 | 15 | 18 | 17 | 20 | 70 | 시주 재성 — 말년 본격 |
| 早 초년부 | 28 | 20 | 22 | 15 | 15 | 75 | 년·월 재성 — 황금 적기 진행중 |
| 兩 양다리 | 25 | 25 | 22 | 13 | 15 | 76 | 정관 + 편재 균형 |
| 劫 비겁누수 | 18 | 17 | 18 | 30 | 17 | 60 | 비겁 多 — 동업·형제 누수 |

**점수 산출 룰**:
- 기본 60 + 재성 합 (정재+편재) × 0.4 + 일간 강도 × 0.2 + 식상 × 0.15 - 비겁 누수 × 0.3
- 0~100 범위 클립

---

### 2.2 §B 돈 출처 4분면

| Archetype | 본업 | 사이드 | 관계 | 투자 | 핵심 카피 |
|---|:-:|:-:|:-:|:-:|---|
| 安 안정형 | **60** | 15 | 15 | 10 | "본업이 정직하게 받쳐줍니다" |
| 業 사업형 | 25 | **50** | 15 | 10 | "본인이 만든 자리에서 절반 풀려요" |
| 急 재다신약 | 35 | 30 | 25 | 10 | "관계가 매출 핵심 — 다만 누수도 큼" |
| 弱 벌이 약형 | 30 | 35 | 20 | 15 | "사이드(콘텐츠·서비스)가 다음 자리" |
| 末 말년부 | 60 | 15 | 15 | 10 | "본업이 노년 자리에서 풀려요" (안정형과 비슷) |
| 早 초년부 | 50 | 25 | 15 | 10 | "본업·사이드 동시 — 지금이 적기" |
| 兩 양다리 | 40 | 35 | 15 | 10 | "본업+사이드 균형 — 둘 다 받침" |
| 劫 비겁누수 | 45 | 20 | 25 | 10 | "관계 비중 큼 — 동업·형제 누수 주의" |

---

### 2.3 §C 12개월 재성 흐름

| Archetype | 진폭 | Peak 월 | Warn 월 | 곡선 모양 |
|---|:-:|---|---|---|
| 安 안정형 | ±20 | 2·8·11 | 7 | 부드러운 흐름 |
| 業 사업형 | **±50** | 2·4·9 | 7·11 | 큰 변동 (산-골 반복) |
| 急 재다신약 | ±35 | 3·9 | 5·12 | 큰 매출 후 큰 누수 |
| 弱 벌이 약형 | ±15 | 6·10 | 4·8 | 평탄·낮은 진폭 |
| 末 말년부 | ±20 | 8·11·12 | 5·6 | 후반기 강 |
| 早 초년부 | ±30 | 1·3·5·7·9·11 | 12 | 전반기 강 |
| 兩 양다리 | ±25 | 2·5·8·11 | 6·12 | 4계절 분산 |
| 劫 비겁누수 | ±25 | 4·10 | 3·9 | 매출월 다음 누수월 |

---

### 2.4 §D 소비 패턴 + 함정

| Archetype | 소비 카테고리 (% 비중) | 함정 3가지 |
|---|---|---|
| 安 안정형 | 필수 45·취미 25·관계 18·투자 12 | 관계 누수 / 7·12월 감정 / 단기 투자 |
| 業 사업형 | **사업 운영 42**·필수 25·VIP 18·재투자 15 | 확장 욕심 / VIP 누수 / 신용 외상 |
| 急 재다신약 | 필수 35·관계 30·투자 20·취미 15 | 잡으려다 다 놓침 / 감정 결정 / 동업 분쟁 |
| 弱 벌이 약형 | 필수 60·취미 20·관계 12·투자 8 | 본업 매달리기 / 사이드 시작 두려움 / 자기계발 무리 |
| 末 말년부 | 필수 50·취미 22·관계 18·투자 10 | 빨리 보려 조급 / 30대 초 무리 / 노년 적기 놓침 |
| 早 초년부 | 필수 40·취미 30·관계 18·투자 12 | 황금기 안일 / 30대 중후반 흐름 단절 / 사치 |
| 兩 양다리 | 필수 40·관계 25·취미 20·투자 15 | 본업·사이드 시간 분배 / 어느 쪽 집중 결정 못 함 |
| 劫 비겁누수 | 필수 40·관계 30·투자 18·취미 12 | 동업 분쟁 / 형제 도와주다 누수 / 보증 |

---

### 2.5 §E 평생 흐름 3-stage + 추상 자리 4-cell

| Archetype | 1단계 | 2단계 | 3단계 | 추상 자리 4-cell |
|---|---|---|---|---|
| 安 안정형 | ~30대 중반 (기초) | 30대 후반~40대 중반 (적기 ★) | 50대~ (유지) | 朝·水·秋·耕 |
| 業 사업형 | 20대 후반~30대 초 (1차 ★) | 30대 중반~40대 초 (변곡) | 40대 후반~50대 중반 (2차 ★★) | 火·風·商·動 |
| 急 재다신약 | ~30대 (조심) | 30대 후반 (집중력 키우기) | 40대 후반~ (현실적 적기) | 慎·焦·選·控 |
| 弱 벌이 약형 | ~30대 초 (식상 키우기) | 30대 중반~40대 (사이드 본격) | 40대 후반~ (적기) | 種·植·育·結 |
| 末 말년부 | ~30대 후반 (느린 시작) | **40대~50대 중반 (적기 ★★)** | 60대~ (수확) | 晩·熟·豊·穩 |
| 早 초년부 | **20대~30대 초 (황금기 ★★)** | 30대 중반~40대 (유지) | 50대~ (보존) | 早·盛·光·華 |
| 兩 양다리 | 20대 후반~30대 (양립 시도) | 30대 중반~40대 중반 (적기 ★) | 50대~ (집중) | 雙·岐·均·續 |
| 劫 비겁누수 | ~30대 (조심·동업 X) | 30대 후반~40대 (단독 적기 ★) | 50대~ (자산 보존) | 獨·守·別·防 |

---

### 2.6 §F 결단 한 줄 + pullquote 핵심

| Archetype | 결단 한 줄 (verdict-card ti) | pullquote 핵심 |
|---|---|---|
| 安 안정형 | "큰돈은 한 번에 안 들어와요. 30대 후반부터 천천히" | "본업 + 정직한 흐름 + 길게 보는 안목" |
| 業 사업형 | "흐름을 두려워 마세요. 1차는 학습, 2차가 진짜 적기" | "만들어서 + 흐름 타고 + 변곡 견디기" |
| 急 재다신약 | "혼자 다 잡으려 마세요. 일간 키우는 게 먼저" | "받을 그릇부터 + 한 자리 집중 + 욕심 줄이기" |
| 弱 벌이 약형 | "본인이 만들어야 풀려요. 식상부터 활성" | "본인 만들기 + 느려도 꾸준히 + 사이드 길게" |
| 末 말년부 | "조급해 마세요. 진짜 적기는 40대 이후" | "느린 시작 + 노년 자리 풀림 + 길게 보는 흐름" |
| 早 초년부 | "지금이 황금기 — 놓치지 말고 자산화" | "황금기 잡기 + 30대 중반 전환 준비 + 보존" |
| 兩 양다리 | "둘 다 잡아도 돼요. 본업+사이드 균형이 결" | "양립 가능 + 집중 결단은 40대 + 균형이 결" |
| 劫 비겁누수 | "동업·보증 X. 단독으로 가야 풀립니다" | "단독 흐름 + 보증 회피 + 형제 분리" |

---

## 3. AI Prompt Schema 분기 로직

### 3.1 Archetype 자동 분류 알고리즘

```typescript
function classifyWealthArchetype(saju: SajuPillars): WealthArchetype[] {
  const sipsung = calcSipsungDistribution(saju); // 정재·편재·식상·비겁·인성 비중
  const ilganStrength = calcIlganStrength(saju); // 일간 강약
  const jaeseongPosition = locateJaeseong(saju); // 시·일·월·년주 중 어디?
  const bigeobCount = countBigeob(saju); // 비겁 개수

  const types: WealthArchetype[] = [];

  // Primary archetype (필수 1개)
  if (sipsung.jeongJae > sipsung.pyeonJae * 2 && ilganStrength === 'strong') {
    types.push('safe'); // 安 안정형
  } else if (sipsung.pyeonJae > sipsung.jeongJae * 2 && sipsung.sikSang > 20) {
    types.push('biz'); // 業 사업형
  } else if (sipsung.jeongJae + sipsung.pyeonJae > 50 && ilganStrength === 'weak') {
    types.push('overflow'); // 急 재다신약
  } else if (sipsung.jeongJae + sipsung.pyeonJae < 20) {
    types.push('weak_income'); // 弱 벌이 약형
  } else if (Math.abs(sipsung.jeongJae - sipsung.pyeonJae) < 8) {
    types.push('balanced'); // 兩 양다리형
  }

  // Secondary modifier (시기 차별 0~1개)
  if (jaeseongPosition === 'siju') types.push('late_bloom'); // 末 말년부
  if (jaeseongPosition === 'nyeonju' || jaeseongPosition === 'wolju') types.push('early_bloom'); // 早 초년부

  // Special modifier (위험 신호 0~1개)
  if (bigeobCount >= 3) types.push('bigeob_leak'); // 劫 비겁누수

  return types; // 1~3 archetype (예: ['safe', 'late_bloom'] = 안정형 + 말년부)
}
```

### 3.2 Prompt schema 출력 구조

```typescript
interface WealthResult {
  archetype: {
    primary: WealthArchetype;       // 'safe' | 'biz' | ...
    modifiers: WealthArchetype[];   // 부가 archetype
    glyph: string;                  // 한자 글리프
    name: string;                   // "안정형 · 말년부"
    tag: string;                    // "정재 우세 + 노년 자리 재물 강함"
    description: string;            // 결 한 단락 설명
  };

  // §A
  sipsungDist: {
    jeongJae: number; pyeonJae: number; sikSang: number; bigeob: number; insung: number;
    score: number; gradeLabel: string; gradeDesc: string;
  };

  // §B
  sourceQuad: {
    main: number; side: number; relation: number; investment: number;
    paragraphs: [string, string]; // 본문 2단락
  };

  // §C
  monthlyFlow: {
    points: number[];    // 12개 score (10=평균선, 100=최저)
    peakMonths: number[];
    warnMonths: number[];
    callPeakDesc: string;
    callWarnDesc: string;
    paragraphs: [string, string];
  };

  // §D
  spending: {
    categories: Array<{ name: string; sub: string; pct: number; warn?: boolean }>;
    traps: Array<{ title: string; description: string }>;
  };

  // §E
  lifeFlow: {
    stages: Array<{ when: string; duration: string; isPeak: boolean; title: string; description: string }>;
    spotCells: Array<{ glyph: string; label: string; description: string }>;
    paragraph: string;
  };

  // §F
  verdict: {
    title: string;       // verdict-card ti (단정 한 줄)
    description: string; // verdict-card ds
    pullquote: string;   // 골드 pullquote
  };

  // Cross-topic CTA (archetype별 자연 페어)
  crossTopic: {
    target: 'wealth' | 'business' | 'career';
    title: string;
    description: string;
  };
}
```

### 3.3 Cross-topic 룰 (archetype별)

| Archetype | Cross-topic | 이유 |
|---|---|---|
| 安 안정형 | → 사업운 | "사이드로 키우려면" |
| 業 사업형 | → 사업운 (강력) | 1차/2차 사이클 분석 자연 페어 |
| 急 재다신약 | → 건강운 OR 사업운 | "그릇 키우기" 측면 |
| 弱 벌이 약형 | → 직업운 | "본업 결단" 자연 |
| 末 말년부 | → 사업운 (말년 적기) | 노년 자리 활용법 |
| 早 초년부 | → 사업운 (황금기 활용) | 빨리 자산화 |
| 兩 양다리 | → 직업운 OR 사업운 | "어느 쪽 집중" |
| 劫 비겁누수 | → 종합사주 (cross-topic 없음) | 동업 회피 결단 — 단독 |

---

## 4. 시각 시그니처 점검 (archetype별 차별)

### 4.1 §A 점수 ring 색
- 모든 archetype: 골드 그라데이션 (브랜드 통일)
- score 값만 다름 (50~78)

### 4.2 §B 4분면 막대 색
- 4 색상 SSOT (모든 archetype 동일):
  - 본업 골드 / 사이드 초록 / 관계 분홍 / 투자 파랑
- 비중 % 만 archetype별 다름 → 비교 시 한눈에 차이 보임

### 4.3 §C area chart 진폭
- 곡선 path 의 y 좌표만 archetype 별 다름
- 진폭이 시각 핵심 (안정형 좁음 vs 사업형 넓음)

### 4.4 §E 추상 자리 한자 4-cell
- archetype별 한자 4글자 완전 다름 (가장 큰 시각 차별)
- 안정형: 朝·水·秋·耕 (느린 결)
- 사업형: 火·風·商·動 (변동 결)
- 재다신약: 慎·焦·選·控 (조심)
- 벌이약형: 種·植·育·結 (씨앗→결실)
- 말년부: 晩·熟·豊·穩 (느린 결실)
- 초년부: 早·盛·光·華 (황금기)
- 양다리: 雙·岐·均·續 (양립)
- 비겁누수: 獨·守·別·防 (단독)

---

## 5. 다음 단계

### Phase 1 — 검증 (현재)
- [x] 안정형 mockup (변준기 락 진본 후보)
- [x] 사업형 mockup (김민지 IA flex 검증)
- [x] 본 매트릭스 v1 작성

### Phase 2 — 락 진본 등재 (PD 컨펌 후)
- 안정형 = `_LOCKED/06_재물운_안정형_LOCKED.html` 후보
- 사업형 = `_LOCKED/07_재물운_사업형_LOCKED.html` 후보
- 또는 통합 1개 락 + archetype 동적 변환 코드

### Phase 3 — 코드 분기 구현
- `src/pages/topic/types/WealthResult.tsx` (or PremiumResult 안 wealth 섹션)
- archetype 분류 함수 (`classifyWealthArchetype`)
- 8 archetype × 6섹션 = 48 templates 동적 렌더

### Phase 4 — AI Prompt schema 작성
- `functions/src/ai/claudeTopic.ts` 의 wealth schema 신규 8 archetype 분기
- 사주 진단 → archetype 자동 매핑 → 동적 카피 생성
- 보일러플레이트 박멸 (5의 배수 점수 X · 단정 mandate · 한자 풀이 mandate)

---

## 6. 참고

### 명리학 근거
- **재성 (정재·편재)** = 일간이 극하는 오행 (자평진전·적천수)
- **식상생재** = 식신·상관이 재성을 만들어내는 흐름 (궁통보감)
- **재다신약** = 재성 多 + 일간 弱 → 돈 보고도 못 잡음 (적천수)
- **비겁쟁재** = 비겁 多 → 형제·동업이 재성을 두고 다툼 (자평진전)

### 학파별 관점
- 자평진전파: 격국론 기반 archetype (정관격·편재격·식신격 등)
- 적천수파: 강약·중화 기반 (일간 강약 + 재성 균형)
- 한국 현대학자 (박청화·정대붕·홍성민): 시주 재성 활용·현대 직업 매핑

### 관련 문서
- `사주500_UI개편_16_주제별_고유IA_v1.md` (10주제 통합 IA SSOT)
- `_LOCKED/README.md` (락 진본 5개 등재)
- `명리학_백과사전.md` 8권 3부록 (지식 백본)
