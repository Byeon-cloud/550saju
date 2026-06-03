# JDS — Topic IA Matrix (10주제 운세 정보 아키텍처)

> **목적**: 종합사주(PremiumResult) + 오늘의운세(DailyMockupView) 의 디자인·톤·IA를 통합해서 **10주제 운세 (각 1운)** 페이지 개편의 기준 매트릭스
> **작성**: 2026-05-07
> **참조**: `JDS_Daily_Pattern.md` (디자인 시스템) + `사주500_UI개편_목업_무료_오늘의운세_v2.html` (mockup 진본)

---

## 0. 두 진본 디자인 비교

### 0.1 종합사주 (PremiumResult · /result premium)

| § | 한자 | 제목 | 핵심 내용 |
|---|---|---|---|
| 01 | — | 원국 | 사주 8글자 + 오행 균형 + 일간 역량 |
| 02 | 天干地支 | 천간지지 | 위로 드러난 마음 / 아래 깔린 본능 |
| 03 | 十神 | 십성 | 관계와 욕망의 10개 키 |
| 04 | 用神·調候 | 용신·조후 | 갈증 — 색·방위·계절·물건·습관 |
| 05 | 大運 | 대운 | 10년 단위 큰 강줄기 |
| 06 | 年運 | 연운 | 올해 흐름 |
| 07 | 神殺 | 신살 | 타고난 별 |
| 08 | 本質 | 내 사주의 결 | 통합 한 줄 + 강점 3·함정 3 |
| 09 | 主題 | 여섯 영역 | 재물·사랑·직업·건강·인간관계·잠재력 |
| 10 | 實踐 | 실천 | 오늘부터 바꿔볼 5가지 |

### 0.2 오늘의 운세 (DailyMockupView · /daily)

| § | 한자 | 제목 | 핵심 |
|---|---|---|---|
| 01 | 日柱 | 오늘의 결 | 일진 vs 일간 만남 |
| 02 | 時運 | 오늘의 시간 흐름 | 4 시간대 + 그래프 |
| 03 | 人緣 | 오늘 만나는 사람 | boost/clash/calm |
| 04 | 處方 | 오늘의 행동 처방 | Do/Don't |
| 05 | 吉物 | 오늘의 럭키 | 색·방위·숫자 등 |
| 06 | 日箴 | 오늘의 한 문장 | PullQuote |
| 07 | 四運 | 오늘 4개의 결 | 재물·연애·직업·건강 + 내일 |

### 0.3 두 디자인의 공통 골격

```
┌ Hero (검정/주제색 그라디언트 + 한자 워터마크 + H1 + 배지) ┐
│
├ 사주 4기둥 미니 카드 (8글자 + 일주 강조)                   │
│
├ §01 default open · 핵심 결론 (한 줄 + 본문 1000자)         │
├ §02~ collapsible (sec-num + sec-title + 한자 + chevron)   │
│   각 섹션: lead + 카드들 + 강조 본문                       │
│
└ Footer 3-part CTA (한자 emblem + 전체 보기 + 10운 시작)    ┘
```

---

## 1. 10주제 IA 매트릭스 (8섹션 generic)

### 1.1 공통 8섹션 골격

10 주제 모두 다음 8섹션으로 통일 (Daily 7섹션 + 종합사주 일부 흡수):

| § | 한자 | 제목 (주제별 변형) | 내용 |
|---|---|---|---|
| **01** | 主柱 | "{주제} 핵심 결" — default open | 한 줄 결론 + 본문 1000자 + 사주 호명 |
| **02** | 八字 | 내 사주 4기둥 + 주제 specific 인용 | 사주 8글자 + 주제 핵심 글자 강조 (예: 재성/정관 등) |
| **03** | 十神 | 주제별 십성 분포 | 4축 막대 + 강점/약점 chip |
| **04** | 時運 | 시기별 흐름 | 12개월 grid 또는 3-stage timeline |
| **05** | 人緣 | 인연/조력자/충돌 (주제별 변형) | boost/clash/calm 카드 |
| **06** | 處方 | 행동 처방 | Do/Don't 2col + 시기·방위 |
| **07** | 吉物 | 럭키 6 | 색·방위·숫자·시간·단어·물건 |
| **08** | 日箴 | 한 문장 + 다음 단계 CTA | PullQuote + 종합사주 업셀 |

### 1.2 주제별 §01 핵심 결 패턴

| 주제 | §01 한자 | 제목 | §01 핵심 분석 축 |
|---|---|---|---|
| **love (緣)** | 桃花 | "연애운 핵심 결" | 일지 배우자궁 + 도화살 + 재성/관성 |
| **reunion (復)** | 復縁 | "재회운 핵심 결" | 합·충 + 재성·정관 + 대운 변곡 |
| **marriage (婚)** | 婚姻 | "결혼운 핵심 결" | 일지 + 정관·정인 + 합/충 |
| **wealth (財)** | 財星 | "재물운 핵심 결" | 재성 강약 + 식상 (재물 생성기) + 대운 |
| **exam (進)** | 進就 | "시험운 핵심 결" | 정관·문창귀인·학당귀인 + 인성 |
| **business (業)** | 創業 | "사업운 핵심 결" | 편재·식신 + 통변 + 합·충 |
| **career (官)** | 官星 | "직업운 핵심 결" | 정관·편관 + 인성 + 식상 (관계 충) |
| **health (壽)** | 壽元 | "건강운 핵심 결" | 일간 강약 + 조후용신 + 충극 |
| **move (移)** | 移動 | "이사운 핵심 결" | 역마살 + 대운 천간지지 변곡 |
| **study (學)** | 學業 | "공부운 핵심 결" | 인성·식상·문창·학당귀인 |

---

## 2. §03 주제별 십성 4축 매트릭스

각 주제는 **4개의 핵심 십성** 으로 분포 시각화 (막대 + 점수). 십성 SSOT (정관·편관·정인·편인·정재·편재·식신·상관·비견·겁재) 중 주제별 4개 선택.

### 2.1 매트릭스

| 주제 | 1축 (메인) | 2축 (상생) | 3축 (저항) | 4축 (보조) |
|---|---|---|---|---|
| love (연애) | 재성 (財星) | 정관 (관계 안정) | 정인 (자기 보호) | 식상 (표현) |
| reunion (재회) | 합·충 (관계 변동) | 재성 (인연) | 정관 (책임감) | 식상 (소통) |
| marriage (결혼) | 정관 (배우자) | 정인 (가족) | 일지 (배우자궁) | 합·충 |
| wealth (재물) | 정재 (꾸준한 돈) | 편재 (큰 돈) | 식상 (생성) | 비겁 (경쟁) |
| exam (시험) | 정관 (책임) | 정인 (학습) | 문창귀인 | 식상 (사고력) |
| business (사업) | 편재 (큰 돈) | 식신 (생성) | 정관 (조직) | 비겁 (동업) |
| career (직업) | 정관 (조직) | 정인 (인정) | 식상 (역량) | 재성 (보상) |
| health (건강) | 일간 강약 | 조후용신 | 충극 (위험) | 식상 (소진) |
| move (이사) | 역마살 | 대운 변곡 | 충 (변동) | 토 (안정) |
| study (공부) | 정인 (학습) | 식신 (사고력) | 문창귀인 | 학당귀인 |

### 2.2 시각화 (DailyMockupView 오행 균형 패턴 응용)

```
┌─────────────────────────────────────┐
│ 03  나의 연애 십성 분포      ▾      │ section-header
│  연애운에 직접 영향을 주는 4축      │ lead
│                                     │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│ │재성 3│ │정관 1│ │정인 2│ │식상 0││ glyph + 카운트 + dot
│ │강함  │ │보통  │ │보통  │ │부족  ││ 강도 (4단계: 강함/보통/약함/부족)
│ └──────┘ └──────┘ └──────┘ └──────┘│
│                                     │
│ 💬 재성이 강해서 인연에 적극적이지만│ 사주 specific 해석 (gold-soft bg)
│    식상이 부족해 표현이 어색해요.   │
└─────────────────────────────────────┘
```

---

## 3. §04 시기별 흐름 — 주제별 패턴

| 주제 | 흐름 단위 | 시각화 | 핵심 |
|---|---|---|---|
| love | 12개월 grid | 월별 점수 + 연애 가능성 | 도화 들어오는 월 강조 |
| reunion | 3-stage timeline | 시작·전환·결판 | 합/충 변곡점 |
| marriage | 12개월 + 대운 | 결혼 적기 strip | 정관 들어오는 시기 |
| wealth | 12개월 grid | 월별 재성 흐름 | 재성 강한 월 |
| exam | 시험 일정 timeline | 합격 가능성 | 정관·문창 시기 |
| business | 사업 단계 | 창업·확장·정리 | 편재·식신 들어오는 시기 |
| career | 12개월 + 대운 | 이직·승진 시기 | 관성 변곡 |
| health | 12개월 grid | 건강 주의 월 | 충극 시기 |
| move | 12개월 grid | 이사 적기 | 역마 활성 월 |
| study | 학기 단위 | 집중·정체·도약 | 인성 시기 |

---

## 4. §05 인연/조력자/충돌 — 주제별 변형

DailyMockupView 의 boost/clash/calm 카드 패턴을 주제별로 의미 변경:

| 주제 | boost (도움) | clash (충돌) | calm (평온) |
|---|---|---|---|
| love | 인연 끌어오는 사람 | 관계 깨는 사람 | 친구로 좋은 사람 |
| reunion | 다시 연결되는 매개 | 재회 막는 사람 | 미련 없이 정리할 사람 |
| marriage | 결혼 도와주는 인맥 | 결혼 막는 가족 | 중립적인 가족 |
| wealth | 돈 들어오게 하는 인맥 | 돈 새는 사람 | 안정적인 동료 |
| exam | 멘토·합격 도움 | 방해되는 사람 | 같이 공부하는 사람 |
| business | 동업·투자자 | 경쟁자 | 직원·고객 |
| career | 상사·멘토 | 라이벌 | 동료 |
| health | 건강 도와주는 사람 | 스트레스 주는 사람 | 평온한 사람 |
| move | 이사 도와주는 사람 | 이사 반대 가족 | 새 동네 사람 |
| study | 같이 공부하는 사람 | 방해되는 사람 | 응원해주는 사람 |

---

## 5. §06 행동 처방 (Do / Don't) — 주제별 톤

각 주제마다 Do/Don't 4-6 항목. 단정형 강제, 시기·방위·구체 행동 포함.

**예시 — love**:
```
✅ Do (해야 할 것)
  · 동남쪽 카페에서 만나기 — 재성 활성 방위
  · 오후 2~5시 약속 잡기 — 도화 시간대
  · 따뜻한 색 옷 입기 — 화기 보충
  · 먼저 연락하기 — 식상 부족 보완

❌ Don't (피할 것)
  · 깊은 대화 미루지 마세요 — 식상 약함 표 남
  · 비교하지 마세요 — 비겁 견제
  · 이상형 고집하지 마세요 — 정관 막힘
```

**시기 예시**: "5월 14일~17일 사이 만남 적극적으로", "7월 충돌기엔 결정 미루세요"

---

## 6. §07 럭키 6 — 주제별 강화 방향

각 주제별로 **부족한 오행을 보충하거나 강한 오행을 활용** 하는 방향으로 럭키 6:

| 항목 | 설명 |
|---|---|
| 색 | 부족 오행 보충 색 (예: 화 부족 → 빨강·주황) |
| 방위 | 강한 오행 활용 방위 (예: 재성 → 동남) |
| 시간대 | 일진과 어울리는 시간 |
| 숫자 | 사주 일간/주제 매핑 (예: 1·6 = 수) |
| 단어 | 일간 호명 강화 단어 |
| 음식 | 오행 보충 음식 |

---

## 7. §08 한 문장 + CTA

**PullQuote 한 줄 결론** (Daily의 §06 日箴 패턴):
- 사주 호명 ("일간 기토 입장에서…")
- 단정형 강조
- 시기 또는 방위 1회

**다음 단계 CTA**:
```
"이 결을 평생 사주 전체로 보면 어떻게 변할까요?"
[종합사주 10운으로 시작 →]
```

---

## 8. AI 응답 schema 매트릭스

```typescript
interface TopicResultV2 {
  topicId: 'love' | 'reunion' | 'marriage' | 'wealth' | 'exam' | 'business' | 'career' | 'health' | 'move' | 'study';

  // §01 핵심 결
  title: string;                    // 20자 — "{주제} 핵심 결"
  oneLineConclusion: string;        // 한 줄 결론 (사주 호명 필수)
  conclusionSajuRef: string;        // "일간 기토(己土)가..." 인용
  narrative: string;                // 1000자+ · <strong>·<u>·<b> 자동 주입

  // §02 사주 4기둥 + 주제 인용
  sajuHighlights: string[];         // 주제 specific 글자 (예: "재성 X3, 정관 X1")

  // §03 십성 분포
  topicSipsung: {
    main: { name: string; count: number; level: '강함'|'보통'|'약함'|'부족' };
    secondary: { ... };
    resistance: { ... };
    aux: { ... };
    interpretation: string;         // 200자+ 사주 specific
  };

  // §04 시기별 흐름
  timeline: {
    type: '12months' | '3stage' | 'semester';
    items: Array<{ slot: string; score: number; message: string }>;
  };

  // §05 인연
  meet: {
    boost: { name?: string; who: string; why: string };
    clash: { name?: string; who: string; why: string };
    calm:  { name?: string; who: string; why: string };
  };

  // §06 행동 처방
  doList: Array<{ title: string; when?: string; detail: string }>;
  dontList: Array<{ title: string; when?: string; detail: string }>;

  // §07 럭키 6
  lucky: {
    color: { value: string; reason: string };
    direction: { value: string; reason: string };
    hour: { value: string; reason: string };
    number: { value: string; reason: string };
    word: { value: string; reason: string };
    food: { value: string; reason: string };
  };

  // §08 한 문장
  pullQuote: string;                // 80자+ · 사주 호명 필수
  upsellHint: string;               // 다음 단계 안내
}
```

---

## 9. 톤 & 매너 (재확인)

### 9.1 단정형 mandatory

❌ "~할 수 있어요", "~될 가능성이 있어요"
✅ "~합니다", "~됩니다", "~하세요"

### 9.2 사주 호명 mandatory (1회+/섹션)

❌ "오늘은 좋은 하루"
✅ "병화(丙火) 일간인 변준기 님은 신사(辛巳) 일진을 만나..."

### 9.3 출처 mention 0건

❌ "자평진전 §10에 따르면"
✅ "이런 사주는 ~한 결로 풀어낼 수 있어요"

### 9.4 강조 위계 3-tier

- `<strong>` 한 문단 1~2회 — 일상 결론
- `<u>` 한 문단 0~2회 — 시기·숫자·색·방위
- `<b>` 한자 첫 등장에만

자동 주입 (`autoEmphasize` 함수) — AI 출력 톤에 의존하지 않고 강조 보장.

---

## 10. 코드 구현 계획

### 10.1 Phase 1 — TopicMockupView 신규

```
src/pages/topic/TopicMockupView.tsx (신규 — DailyMockupView generic화)
  Props:
    - topicId: TopicKey
    - profile: SajuProfile
    - result: TopicResultV2
    - chrome: TopicChromeTheme (한자/색/IA)
    - onShare, onChat, onUpsell
```

### 10.2 Phase 2 — Theme 정의

```
src/pages/topic/_topic_themes.ts (신규)
  TOPIC_THEMES: Record<TopicKey, {
    hanja: string;        // 緣 復 婚 ...
    accent: string;       // #C88A95 ...
    accentSoft: string;
    sec01Hanja: string;   // 桃花 復縁 婚姻 ...
    sec01Title: string;   // "연애운 핵심 결"
    sipsungAxes: [string, string, string, string]; // ['재성', '정관', '정인', '식상']
    timelineType: '12months' | '3stage' | 'semester';
    meetLabels: { boost: string; clash: string; calm: string };
  }>
```

### 10.3 Phase 3 — AI Prompt 재작성

```
functions/src/ai/promptsV3.ts
  TOPIC_USER_V3_v2(topicId, sajuData, ...): string
    - 8섹션 schema mandate
    - 주제별 sipsungAxes 기반
    - 단정형 강제 + 사주 호명 mandate
    - <strong>·<u>·<b> mandate
```

### 10.4 Phase 4 — TopicAnalysisPage 교체

```
src/pages/TopicAnalysisPage.tsx
  result phase 의 모든 카드들 → <TopicMockupView /> 단일 호출
  (기존 inline 카드들 dead-code-elimination)
```

---

## 11. 작업 우선순위

1. **JDS_Daily_Pattern.md** ✅ (작성 완료)
2. **JDS_Topic_IA.md** ✅ (이 문서)
3. **TopicMockupView 골격** — DailyMockupView copy + Props 인터페이스
4. **\_topic_themes.ts** — 10 주제 테마 SSOT
5. **AI prompt 재작성** — 8섹션 schema mandate
6. **TopicAnalysisPage 교체** — result phase only
7. **테스트 + tuning**

각 phase 약 30분-1시간 예상. 전체 4-6시간 작업.
