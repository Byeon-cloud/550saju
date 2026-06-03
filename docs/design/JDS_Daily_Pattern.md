# JDS — Daily Pattern (오늘의 운세 디자인 시스템)

> **출처**: `src/pages/daily/DailyMockupView.tsx` + `docs/mockups/사주500_UI개편_목업_무료_오늘의운세_v2.html`
> **작성**: 2026-05-07 — 10주제 운세 페이지 개편 기준
> **목적**: Daily 의 분위기·컬러감·내용전개·도식화·톤앤매너를 다른 콘텐츠(주제 10개)에도 동일하게 적용

---

## 0. 디자인 철학

### 0.1 핵심 5원칙

1. **검정·골드·크림 SSOT** — 모든 페이지의 base. 주제별 색은 **액센트로만** 사용 (hero stripe, 한자 워터마크, chip 등)
2. **한자 = 상징** — 본문엔 풀이 함께 (예: "병화(丙火, 밝고 활달한 기운)"), 절대 한자 단독 노출 X
3. **카드 단위 정보 캡슐화** — 흰 surface + gold-line border. 카드 안에 sec-num + sec-title + chevron 헤더 패턴
4. **단정형 톤** — "~될 수 있습니다" ❌ → "~됩니다" ✅. 면피체 금지
5. **자동 강조 위계 3-tier** — `<strong>` 골드 형광펜 / `<u>` 골드 밑줄 / `<b>` 검정 볼드

### 0.2 회귀 방지

- 자유 hex 금지 (CSS 변수 `--c-*` 만)
- 머스타드 #B8941F · 구 골드 #C9A96E · 구 비비드 #D4A843 사용 금지
- 이모지 0건 (한자/SVG/컬러칩만 허용)
- text-[10px] 미만 금지 (60대 가독)
- mockup hardcoded HTML embed 금지 (props 기반 React JSX 진본 패턴)

---

## 1. 컬러 토큰 (SSOT)

### 1.1 Brand · Neutral

```css
--c-paper:        #F8F5EE;  /* 크림 배경 */
--c-surface:      #FFFFFF;  /* 카드 배경 */
--c-ink:          #1A1A1A;  /* 본문 텍스트 */
--c-ink-soft:     #3D3D3D;  /* 부속 본문 */
--c-mute:         #7A7269;  /* 부가 텍스트 */
--c-line:         #E5DFD0;  /* 구분선 */

--c-gold:         #B8965A;  /* 프라이머리 골드 */
--c-gold-deep:    #8C6D3D;  /* 호버/강조 */
--c-gold-soft:    rgba(184,150,90,0.10);  /* 골드 배경 (10%) */
--c-gold-line:    rgba(184,150,90,0.40);  /* 골드 라인 (40%) */
--c-card-line:    rgba(184,150,90,0.18);  /* 카드 border (18%) */
```

### 1.2 오행 5색 (SajuCard 와 100% 동기화)

| 오행 | 색 | soft (배경) | 의미 |
|---|---|---|---|
| 목 (木) | `#2D8A4E` | `rgba(45,138,78,0.10)` | 봄·시작·성장 |
| 화 (火) | `#D32F2F` | `rgba(211,47,47,0.10)` | 여름·열정·확장 |
| 토 (土) | `#E8B82A` | `rgba(232,184,42,0.10)` | 중심·균형·신뢰 |
| 금 (金) | `#4A4A4A` | `rgba(74,74,74,0.10)` | 가을·결단·정제 |
| 수 (水) | `#1565E0` | `rgba(21,101,224,0.10)` | 겨울·지혜·흐름 |

```css
--c-mok: #2D8A4E;  --c-hwa: #D32F2F;  --c-to: #E8B82A;
--c-geum: #4A4A4A;  --c-su: #1565E0;
--c-mok-soft: rgba(45,138,78,0.10);   /* ... */
```

### 1.3 10주제 색 (Hero stripe + 한자 워터마크 액센트만)

| 주제 | 한자 | 색 | 비고 |
|---|---|---|---|
| love (연애) | 緣 | `#C88A95` | 부드러운 핑크 |
| reunion (재회) | 復 | `#D89A8A` | 살구색 |
| marriage (결혼) | 婚 | `#C97B95` | 진한 분홍 |
| wealth (재물) | 財 | `#B8965A` | 골드 (브랜드) |
| exam (시험) | 進 | `#5A6FA8` | 파랑 |
| business (사업) | 業 | `#A37A2E` | 진한 골드 |
| career (직업) | 官 | `#5A7CA8` | 진한 파랑 |
| health (건강) | 壽 | `#6FA08C` | 청록 |
| move (이사) | 移 | `#4F8A8B` | 짙은 청록 |
| study (공부) | 學 | `#9C5A8A` | 자주 |

> **사용 규칙**: 주제색은 **단색만** 등장 — Hero 의 좌측 stripe (3px), 한자 워터마크 (opacity 0.10), chip (soft 14% bg) 만. 그라디언트 풀화면 금지. 본문 검정·골드 SSOT 유지.

---

## 2. 타이포그래피

### 2.1 Font Stack

```css
font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
letter-spacing: -0.01em;
-webkit-font-smoothing: antialiased;
```

**한자 전용**: `'Noto Serif KR', serif` (사주 한자, H1 hero)

### 2.2 사이즈 시스템

| 토큰 | 사이즈 | 사용처 |
|---|---|---|
| Display | 26-32px / weight 700 / Noto Serif KR | Hero H1 |
| H1 | 22-24px / 700 | 결과 페이지 메인 제목 |
| H2 (sec-title) | 17-18px / 700 / Noto Serif KR | 섹션 제목 (sec-num 옆) |
| Body | 14.5px / 400-500 / line-height 1.75 | 본문 |
| Body-sm | 13px | 카드 본문 |
| Caption | 11-12px | 부가 설명, lead |
| Label (sec-num) | 10.5-11px / 700 / letter-spacing 0.15em | 섹션 번호 |
| Tiny | 9.5-10px | tag, badge |

**최소 폰트**: 11px (60대+ 가독 floor)

### 2.3 자동 강조 위계 (autoEmphasize)

본문 렌더링 시 `dangerouslySetInnerHTML + sanitizeAiText` 거쳐서 다음 태그만 보존 + CSS 적용:

| 태그 | 효과 | CSS |
|---|---|---|
| `<strong>` | 황금 형광펜 (한 문단 1~2회) | `background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,0.32) 55%); padding: 0 3px;` |
| `<u>` | 황금 밑줄 (시간·숫자·색·방위) | `text-decoration-color: #B8965A; text-decoration-thickness: 2px; text-underline-offset: 2px;` |
| `<b>` | 검정 볼드 (한자 첫 등장) | `font-weight: 600; color: #1a1a1a;` |

**자동 주입 규칙** (`autoEmphasize` 함수):
- 시간 패턴 → `<u>` (예: "오후 2~5시", "저녁 7시 이후")
- 방위 → `<u>` (예: "동남쪽", "서북방")
- 색상 → `<u>` (예: "짙은 파란색", "남보라")
- 결론 phrase → `<strong>` (8~30자, 종결형 — "~날입니다", "~하세요", "~중요해요")

---

## 3. 컴포넌트 패턴

### 3.1 Hero (.hd) — 페이지 인장

```
┌─────────────────────────────────────┐  ← 배경: linear-gradient(135deg, 주제색-0% → -60% → -100%)
│ [배지] · [닉네임]      [무료 1회 ▸] │  ← top row · 11-12px
│                                  火 │  ← 한자 워터마크 (200px, alpha 0.06, 우하단)
│ 페이지 H1 (Noto Serif 26px)         │
│ 부타이틀: 2026년 5월 7일 · 신일(辛巳)│  ← 12px opacity 0.8
│ ⏱ [시간 chip] · 부설명               │  ← optional · 결과 시점 안내
└─────────────────────────────────────┘
```

**색 규칙**:
- Daily: 빨강 그라디언트 `#c62828 → #8b1a1a → #5a0f0f` + 火 워터마크
- 주제별: **`linear-gradient(135deg, #1A1A1A 0%, ${주제색}DD 50%, #1D1812 100%)`** + 주제 한자 워터마크
- 종합사주(10운): `linear-gradient(135deg, #1a1a1a, #2a2520, #1d1812)` 검정 base + 골드 액센트

### 3.2 사주 4기둥 미니 카드 (.my-saju)

```
┌─────────────────────────────────────┐ background: white, border: 1px solid gold-line
│ 내 사주 — 변준기                    │ ttl: 10.5px · gold · letter-spacing 0.15em
├──────┬──────┬──────┬──────────────┤
│  시  │ 일(나)│  월  │  연          │ lab: 8.5px
│  壬  │  己  │  甲  │  戊          │ 천간 (24px Noto Serif · 오행 컬러 솔리드)
│  임  │  기  │  갑  │  무          │ 한글 (12px)
│ 큰강 │  밭  │큰나무 │ 큰산         │ 의미 (10px)
│  申  │  酉  │  寅  │  寅          │ 지지 (큰 색 블록)
│  신  │  유  │  인  │  인          │
│원숭이│  닭  │호랑이│ 호랑이        │ 동물
└──────┴──────┴──────┴──────────────┘
```

**일주(나) 셀**: 골드 2px border + goldSoft bg + box-shadow

### 3.3 오행 균형 (.ohaeng-row)

```
┌─────────────────────────────────────┐
│ 내 사주 오행 + 오늘의 보충          │
│ 사주 5기운 균형 + 오늘 일진의 추가  │ lead 12px mute
│                                     │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐         │
│ │木3│ │火0│ │土2│ │金2│ │水1│         │ glyph 16px + dot 8px + qty
│ └──┘ │부족│ └──┘ │+1│ └──┘         │ lack: opacity 0.6 + 부족 9px
│                                     │
│ 💬 오늘 신(辛) 기운이 들어와서 금  │ 보충 안내 (gold-soft bg, gold border-left)
│    자리에 +1 보충됩니다.            │
└─────────────────────────────────────┘
```

### 3.4 섹션 (.section)

```
┌─────────────────────────────────────┐ surface: white · gold-line border
│ 01  핵심 결                    ▾    │ ← section-header (sec-num 11px · sec-title 17px Noto Serif · chevron)
├─────────────────────────────────────┤ 펼침 시 1px dashed gold-line
│  [본문 카드들 (펼침 시만 표시)]     │
└─────────────────────────────────────┘

접힘 (default): section-header 외 자식 모두 display:none
펼침 (.open): chevron 180도 회전 + 자식 표시
```

**규칙**: §01 default open, §02-§07 default closed (사용자 탐색)

### 3.5 Topic Grid (.topic-grid · 2x2)

```
┌────────────────┬────────────────┐
│ 재물        財 │ 관계        緣 │
│ 73점           │ 65점           │
│ 한 줄 설명     │ 한 줄 설명     │
│ 1운으로 깊이 → │ 1운으로 깊이 → │
└────────────────┴────────────────┘
```

각 카드: 좌측 strip (3px topic 색) + 한자 (gold) + 점수 (큰 글자) + 한 줄 + 유료 진입

### 3.6 Meet Stack (.meet) — boost / clash / calm

```
┌─────────────────────────────────────┐ ← boost: 좌측 3px solid mok
│ ◯  김지현 (직장 동료) [도움]        │ ← orb (52px) + 이름 + tag
│    천간 신(辛)이 본인 일간 기(己)와 │
│    상생 ─ 정관 자리에서 든든히 받침 │
└─────────────────────────────────────┘

3 variant:
  boost (도움): 木 색 (#2D8A4E)
  clash (충돌): 火 색 (#D32F2F)
  calm  (평온): 골드 (#B8965A)
```

---

## 4. 섹션 흐름 (Information Architecture)

### 4.1 Daily 진본 흐름 (현재)

```
01. Hero (변준기 님의 오늘 + 火 + 시간 chip)
02. 내 사주 4기둥 (8글자 + 일주 강조)
03. 오행 균형 + 오늘의 보충
04. 오늘의 기운과 내 기운의 만남 (干支 비교)
05. 한 줄 결론 박스 (paper bg · 골드 stripe · 큰 결론)
06. 본문 (todayNarrative · 1000자 이상 · 단정형)
07. 4영역 점수 카드 (재물/관계/직업/건강)
08. 시간대 그래프 (4 slot · 오전/오후/저녁/심야)
09. 인연 카드 (boost/clash/calm)
10. 행동 처방 (Do/Don't 2col)
11. 럭키 6 그리드 (색·방위·시간·숫자·옷·음식)
12. PullQuote (인용문 한 줄 결론)
13. 내일 미리보기 카드
14. (앱인토스만) 광고 슬롯
15. 월운 업셀 (PREMIUM 10운)
16. 액션 버튼 (공유 / 대화)
```

### 4.2 주제별 운세 적용 흐름 (제안)

10주제는 Daily의 7섹션 골격을 따르되 **주제 specific** 으로 재구성:

```
01. Hero (주제별 색 + 한자 워터마크 + H1 "변준기 님의 연애운")
02. 내 사주 4기둥 (Daily 동일 — 진본 패턴)
03. 주제 specific 십성 분포
    ├─ love: 재성·관성·정인·식상 4축
    ├─ wealth: 재성·식상·관성·인성
    ├─ career: 관성·인성·식상·재성
    └─ ...
04. 한 줄 결론 (주제 인장 한자 + 단정형 결론)
05. 본문 (1000자+ · 사주 8글자 호명 + 십성 인용)
06. 점수 ring + sub-score 4축
07. 시기별 흐름 (12개월 grid 또는 3-stage timeline)
08. 인연/적/조력자 카드 (주제별 역할)
09. 행동 처방 (Do/Don't · 주제별 구체 행동)
10. 럭키 (색/방위/숫자 — 주제 강화 방향)
11. 다른 주제 cross-sell (DEEP DIVE)
12. 종합사주 업셀 (PREMIUM 10운)
```

---

## 5. 톤 & 매너

### 5.1 단정형 강제

- ❌ "~할 수 있습니다", "~될 가능성이 있어요"
- ✅ "~합니다", "~됩니다", "~하세요"

### 5.2 사주 호명 mandatory

- ❌ "오늘은 좋은 하루"
- ✅ "병화(丙火) 일간인 변준기 님은 신사(辛巳) 일진을 만나..."

### 5.3 보일러플레이트 박멸

- prompt 안 사람 실명 0건 (일반화)
- 사주 specific 호명 1회+ ('일간 기토', '재성 3개', '축미충')
- 동일 사주에 매번 다른 출력 (AI mandate)

### 5.4 출처 표시 0건

- ❌ "자평진전 §10에 따르면", "박청화 기준"
- ✅ "이런 사주는 ~한 결로 풀어낼 수 있어요"
- 학술 출처는 결과 페이지·홈 footer에 별도 표시

### 5.5 강조 위계 mandate

prompt에서 AI에게:
- `<strong>` 한 문단 1~2회 — 일상 결론
- `<u>` 한 문단 0~2회 — 시기·숫자·색·방위
- `<b>` 한자 첫 등장에만

자동 주입 (autoEmphasize) 으로 안전망.

---

## 6. 10주제 적용 가이드

### 6.1 주제별 변경 영역 (4가지)

| 영역 | Daily 기본 | 주제별 차이 |
|---|---|---|
| **Hero stripe + 한자** | 火 빨강 | 주제 색 + 주제 한자 (緣 復 婚 財 進 業 官 壽 移 學) |
| **오행 보충 안내** | 오늘 일진 +1 | 주제별 강조 오행 |
| **십성 분포 (§03)** | 4축 generic | 주제별 4축 (예: love = 재·관·정인·식상) |
| **본문 prompt** | "오늘 하루" | 주제별 — "올해 연애 흐름", "재물 결" |

### 6.2 공통 유지 (변경 X)

- 사주 4기둥 미니 카드 (Daily 진본 그대로)
- 색상 SSOT (`--c-*`)
- 강조 위계 (`<strong>`, `<u>`, `<b>`)
- 섹션 헤더 패턴 (sec-num + sec-title + chevron)
- 톤 & 매너 (단정형 · 사주 호명 · 보일러플레이트 박멸)

### 6.3 적용 순서 (제안)

1. **Phase 1**: TopicMockupView 컴포넌트 신규 — DailyMockupView 코드를 props 기반 generic화
2. **Phase 2**: 10 주제 prompt 재작성 — 주제별 IA 흐름 + 십성 매트릭스
3. **Phase 3**: TopicAnalysisPage 의 result phase 를 TopicMockupView 로 교체
4. **Phase 4**: cross-sell + 종합사주 업셀 통합

---

## 7. 회귀 방지 체크리스트

페이지 개편 시 다음 항목 확인:

- [ ] 색상 자유 hex 0건 (CSS 변수 `--c-*` 만)
- [ ] 머스타드 #B8941F · 구 골드 #C9A96E · 구 비비드 #D4A843 0건
- [ ] 한자 단독 노출 0건 (풀이 함께)
- [ ] 사주 호명 1회+ ('일간', '재성 N개', '축미충')
- [ ] `<strong>` 한 문단 1~2회 / `<u>` 0~2회 / `<b>` 한자 첫 등장
- [ ] 출처 mention 0건 ("자평진전" 등)
- [ ] 단정형 강제 ("~될 수 있어요" 0건)
- [ ] 이모지 0건 (한자/SVG/컬러칩만)
- [ ] text-[10px] 미만 0건
- [ ] AI prompt boilerplate 0건 (사람 실명, 정적 한 줄)

---

## 8. 참고 파일

- **mockup HTML 진본**: `docs/mockups/사주500_UI개편_목업_무료_오늘의운세_v2.html` (586줄)
- **DailyMockupView 구현**: `src/pages/daily/DailyMockupView.tsx` (1,512줄)
- **CSS SSOT 토큰**: `MOCKUP_CSS` 상수 안 `:root` 변수 (line 148~170)
- **autoEmphasize 함수**: `src/pages/daily/DailyMockupView.tsx` (line 34~120)
- **safeHtml / stripAll**: `src/utils/format.ts` (sanitizeAiText / stripMd)
- **SajuCard 색 동기화**: `src/pages/saju-card/_chrome.tsx` (C·OHENG_THEME)

---

## 9. 다음 작업 (10주제 개편)

1. `docs/design/JDS_Topic_IA.md` 작성 — 10주제별 §03 십성 분포 매트릭스 + §05 본문 prompt
2. `src/pages/topic/TopicMockupView.tsx` 신규 (Daily 진본 generic 화)
3. AI prompt 재작성 — 주제별 IA 흐름 반영
4. TopicAnalysisPage result phase → TopicMockupView 교체
