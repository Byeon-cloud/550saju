# 사주500 — 이사 (移) 8 Archetype 매트릭스 v1

> **목적**: 이사·이동운 결과 페이지의 **사주 specific 다양성 + 위험 분석** 깊이 잡기.
> **작성**: 2026-05-08 (PD 결단: "수가 많으면 홍수나서 집이 떠내려간다거나, 불이 많으면 화재난다거나 그런거 있어야지")
> **상위 SSOT**: `사주500_UI개편_16_주제별_고유IA_v1.md` (이사 5섹션 IA — 위험 신호 카드 추가됨)
> **관련**: `사주500_UI개편_17_재물_archetype_매트릭스_v1.md` (재물 8 archetype spec)

---

## 0. 핵심 원칙

### 0.1 이사 archetype = 4 layer 매트릭스
이동 패턴만 (4종) → 부족. 진짜 명리학 이사 분석은 **4 layer × 8 archetype**:

| Layer | 의미 | 기준 |
|---|---|---|
| **A. 이동 패턴** | 사주 본래의 이동 본능 | 역마살·대운 변곡 |
| **B. 자연재해·하자** | 오행 太過 → 환경 위험 | 수·화·금 太過 / 토 강 |
| **C. 흉살** | 사주 흉살 활성 시기 | 충·형·해·도화 |
| **D. 시점** | 지금 옮겨야/기다려야 | 대운·세운 |

### 0.2 Primary + Modifier 조합
- **Primary** = Layer A (이동 패턴) — 1개 mandatory
- **Modifier** = Layer B/C/D — 0~2개 추가 (사주 specific)

예: 한지민 = `守 정착형` (primary, Layer A) + `鬱 답답 주의` (modifier, Layer B)

---

## 1. 8 Archetype 정의 (4 layer 통합)

| # | Archetype | 한자 | Layer | 사주 신호 | 메시지 |
|---|---|---|---|---|---|
| 1 | **動 이동형** | 動 | A | 역마살 多 (寅申巳亥 多) | "자주 옮기는 게 본인 결" |
| 2 | **守 정착형** | 守 | A | 토 강 + 역마약 | "한 자리에 깊게 — 잦은 이동 X" |
| 3 | **變 변동형** | 變 | A | 대운 변곡 큰 | "큰 이동 시기 미리 알기" |
| 4 | **浸 침수 주의형** | 浸 | B | 수 太過 (壬癸亥子 多) | "저층·반지하 X · 누수·곰팡이 위험" |
| 5 | **焰 화재 주의형** | 焰 | B | 화 太過 (丙丁巳午 多) | "전기·가스 점검 필수 · 노후 주택 X" |
| 6 | **崩 사고 주의형** | 崩 | B | 금 太過 + 충 (庚辛申酉 + 沖) | "도난·금속 사고 위험 · 보안 강화" |
| 7 | **鬱 답답형** | 鬱 | B | 토 太過 (戊己辰戌丑未 多) | "환기·통풍 1순위 · 곰팡이·습기 주의" |
| 8 | **沖 분쟁 주의형** | 沖 | C | 충·형 활성 月 | "특정 시기 계약·이웃 분쟁 위험" |

### 추가 보조 archetype (Layer D — 시점)
- **急 급이동형** — 현 거주지가 흉방위 + 대운 변곡 진입 → "지금 옮겨야 풀림"
- **待 기다림형** — 대운 변곡 1년 이내 → "지금 옮기면 손해, 더 기다려라"

---

## 2. Archetype × 5 섹션 매트릭스

### 2.1 §A 역마살 + 대운 변곡

| Archetype | 역마 점수 | 대운 변곡 시기 | 평생 이사 횟수 |
|---|:-:|---|:-:|
| 動 이동형 | 75 | 매 10년 | 5~7회 |
| 守 정착형 | 35 | 35세·65세 | 2~3회 |
| 變 변동형 | 60 | 25·45·65 (3회 큰 변곡) | 4~5회 |
| 浸/焰/崩/鬱 (B layer) | varies | varies | varies |
| 沖 분쟁형 | 50 | varies | varies |
| 急 급이동형 | 65 | 즉시 | varies |
| 待 기다림형 | 40 | 1년 후 | varies |

### 2.2 §B 위험 신호 카드 (NEW · 4 카드)

각 archetype마다 4 카드의 status 다름:

| Archetype | 浸 침수 | 焰 화재 | 鬱 답답 | 沖 분쟁 |
|---|---|---|---|---|
| 動 이동형 | 안전/보통 | 안전/보통 | 안전 | 시기 따라 |
| 守 정착형 (한지민) | **안전 (수 0%)** | **안전 (화 1%)** | **주의 (토 太過)** | 시기 주의 |
| 浸 침수형 | **높음 (수 太過)** | 안전 | 안전 | 보통 |
| 焰 화재형 | 안전 | **높음 (화 太過)** | 보통 | 보통 |
| 崩 사고형 | 보통 | 보통 | 보통 | **높음 (충 + 금)** |
| 鬱 답답형 | 안전 | 안전 | **높음 (토 太過)** | 보통 |
| 沖 분쟁형 | 보통 | 보통 | 보통 | **높음 (충 활성)** |

### 2.3 §C 8방위 컴퍼스 적합도 (best 자리는 archetype마다 다름)

| Archetype | 본인에게 best 방위 | 피할 방위 |
|---|---|---|
| 守 정착형 + 鬱 (한지민) | 동 (80) · 동남 (78) · 북 (75) | 서남 (40) · 동북 (45) |
| 動 이동형 (역마 강) | 본인 일간 + 조후 | 충 위치 방향 |
| 浸 침수형 | 양지·고지대 (남·서남 高) | 북·동북 (저지대 X) |
| 焰 화재형 | 북·서북 (수기 자리) | 남·동남 (화 자리) |
| 崩 사고형 | 동·동남 (목 강한 자리) | 서·서북 (금 강함 X) |
| 鬱 답답형 | 동·동남 (목·통풍) | 서남·중앙 (토 자리) |

### 2.4 §D 12개월 이사 적기 (peak/warn 시기)

| Archetype | Peak 月 | Warn 月 | Pattern |
|---|---|---|---|
| 守 정착형 (한지민) | 3·4·9월 | 6·7·12월 | 봄·가을 적기 |
| 動 이동형 | 1·5·8·11월 | 3·9월 | 사방 적기 (역마 활성) |
| 浸 침수형 | 가을 (9·10·11) | 여름 (6·7·8 장마) | 건조기 적기 |
| 焰 화재형 | 가을·겨울 | 봄·여름 | 화 약한 시기 |
| 沖 분쟁형 | 안정 月 | 충 활성 月 | 충 시기 절대 X |

### 2.5 §E 처방 + 결단

| Archetype | 처방 4-cell 한자 | 결단 한 줄 |
|---|---|---|
| 守 정착형 (한지민) | 東·春·久·水 | "한 자리에 5~10년" |
| 動 이동형 | 變·遠·新·會 | "변화가 본인 결" |
| 浸 침수형 | 高·乾·光·避 | "고지대·양지·건조" |
| 焰 화재형 | 北·濕·査·防 | "북쪽·전기 점검 필수" |
| 崩 사고형 | 鎖·防·新·驗 | "보안 강화·신축 우선" |
| 鬱 답답형 | 風·窓·空·清 | "환기·창 큰 자리 1순위" |
| 沖 분쟁형 | 待·穩·驗·書 | "충 시기 피해 계약" |
| 急 급이동형 | 速·新·吉·斷 | "지금 결단" |
| 待 기다림형 | 留·穩·觀·延 | "1년 더 머물기" |

---

## 3. AI Prompt Schema 분기

### 3.1 Archetype 자동 분류 의사코드

```typescript
function classifyMoveArchetype(saju: SajuPillars): MoveArchetype[] {
  const types: MoveArchetype[] = [];
  const yeokma = countYeokma(saju);     // 역마살 (寅申巳亥) 개수
  const oheng = calcOhengDistribution(saju);  // 5오행 분포
  const chung = analyzeChungSinsal(saju);     // 충·형·해

  // Layer A — Primary (1개 필수)
  if (yeokma >= 3) types.push('動');
  else if (oheng.to >= 40 && yeokma <= 1) types.push('守');
  else if (hasMajorDaeunChange(saju)) types.push('變');
  else types.push('守'); // 기본

  // Layer B — 자연재해 modifier (0~1개)
  if (oheng.su >= 40) types.push('浸');
  else if (oheng.hwa >= 45) types.push('焰');
  else if (oheng.geum >= 35 && chung.geum) types.push('崩');
  else if (oheng.to >= 45) types.push('鬱');

  // Layer C — 흉살 modifier (0~1개)
  if (chung.activeChung >= 2) types.push('沖');

  // Layer D — 시점 modifier (0~1개)
  if (isAtDaeunVergence(saju)) types.push('急');
  else if (isOneYearBeforeDaeun(saju)) types.push('待');

  return types; // 1~4 archetype
}
```

### 3.2 Output schema

```typescript
interface MoveResult {
  archetype: {
    primary: MoveArchetype;       // Layer A 결과
    modifiers: MoveArchetype[];   // Layer B/C/D
    glyph: string;                // primary 한자
    name: string;                 // "정착형 · 鬱 답답 주의"
    tag: string;                  // "토 강 + 역마 약 — 한 자리"
    description: string;
  };

  // §A
  yeokmaScore: number;
  daeunStrip: Array<{ ageRange: string; tag: string; isPeak?: boolean; isNow?: boolean }>;

  // §B (NEW · 위험 신호)
  riskCards: Array<{
    glyph: '浸'|'焰'|'崩'|'鬱'|'沖';
    title: string;
    sub: string;
    status: 'safe'|'caution'|'high';
    description: string;
  }>;

  // §C 8방위
  compass: {
    sectors: Array<{ direction: string; han: string; score: number; rank: 'best'|'good'|'mid'|'low' }>;
    paragraph: string;
  };

  // §D 12개월
  monthlyMove: {
    months: Array<{ num: number; tag: string; type: 'peak'|'stable'|'warn'|'default' }>;
    callPeak: string;
    callWarn: string;
  };

  // §E
  prescription: Array<{ glyph: string; label: string; description: string }>;
  verdict: { title: string; description: string };
  pullquote: string;
}
```

### 3.3 자극어·UX 가드 룰
- "위험·재앙·사고" 단어는 정보·예방 톤으로만 ("주의·점검·강화")
- 침수·화재 위험 = 사주 분석 + **일반 안전 가이드** 결합 (의료 disclaimer 비슷한 결)
- "급이동" 결단도 단정 X — "지금 결단이 필요한 자리예요" 부드러운 톤

---

## 4. 시각 시그니처

### 4.1 Layer 4종 시각 분리
- §B 위험 신호 카드 = **safe (초록 stripe) / caution (베이지) / high (테라코타)** 3 status
- §C 8방위 컴퍼스 = best/good/mid/low 4 색 (이미 락 SSOT)
- §D 12개월 = peak (슬레이트) / stable (골드) / warn (테라코타) 4-grid

### 4.2 한자 글리프 SSOT
- **Layer A**: 動·守·變
- **Layer B**: 浸·焰·崩·鬱
- **Layer C**: 沖·刑·害
- **Layer D**: 急·待

---

## 5. 다음 단계

### Phase 1 — 검증 (현재)
- [x] 정착형 + 鬱 (한지민) mockup 락 진본 = `_LOCKED/11_이사운_정착형_LOCKED.html`
- [x] 본 spec 작성 (file 18)

### Phase 2 — Variant mockup (시간 시)
- 浸 침수 archetype 검증용 (수 太過 페르소나)
- 焰 화재 archetype 검증용 (화 太過 페르소나)
- 沖 분쟁 archetype 검증용

### Phase 3 — AI Prompt 분기 구현
- `functions/src/ai/claudeTopic.ts` move topic schema 8 archetype 분기
- 사주 → archetype 자동 분류
- 위험 신호 카드 4 status 동적 결정

---

## 6. 참고

### 명리학 근거
- **역마살** = 寅·申·巳·亥 4지지 中 사주에 등장 시 활성 (자평진전·삼명통회)
- **양택풍수** = 집의 좌향·8방위 길흉 판단 (택일론·풍수지리)
- **조후** = 일간 강약 + 계절 부족 오행 보충 (궁통보감)
- **수 太過 → 침수·곰팡이·신장 부담** (음양오행 자연재해 매핑)
- **화 太過 → 화재·심장·전기** (동양 의학·풍수 결합)
- **토 太過 → 답답·습기·소화 부담** (운화·경기학)

### 한국 현대 풍수
- 김두규 (서울대) 양택풍수 8방위 길흉표
- 정대붕 사주명리학 + 풍수 결합론
- 박청화 신사주학 — 이사 적기 + 흉살 시기 매핑

### 관련 문서
- `사주500_UI개편_16_주제별_고유IA_v1.md` (이사 5섹션 IA — 위험 신호 카드 추가)
- `사주500_UI개편_17_재물_archetype_매트릭스_v1.md` (재물 archetype 패턴 참고)
- `_LOCKED/README.md` (락 진본 11개)
- `명리학_백과사전.md` 12운성·신살 (역마살 상세)
