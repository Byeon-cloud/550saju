# Daily Fortune — Locked Items (회귀 방지 체크리스트)

> **규칙**: 모든 항목은 **LOCKED**. 변경 시 사용자 명시 동의 필요.
> **변경 전**: 이 문서 읽기 mandatory.
> **변경 후**: 모든 LOCKED 항목 verify mandatory.
> **회귀 발견**: 즉시 추가하고 재수정.

마지막 갱신: 2026-05-07

---

## 1. SajuCard 토큰 SSOT (절대 회귀 금지)

`src/pages/saju-card/_chrome.tsx` 의 `C` + `OHENG_THEME` 와 100% 일치.

**색상**:
- `--c-paper: #F8F5EE`
- `--c-surface: #FFFFFF`
- `--c-ink: #1A1A1A`
- `--c-ink-soft: #3D3D3D`
- `--c-mute: #7A7269`
- `--c-gold: #B8965A`
- `--c-gold-deep: #8C6D3D`
- `--c-gold-soft: rgba(184,150,90,0.10)`
- `--c-gold-line: rgba(184,150,90,0.40)`
- `--c-card-line: rgba(184,150,90,0.18)` ← **모든 카드 보더**
- `--c-line: #E5DFD0` (legacy, 폐기 예정)

**5 오행** (사주카드 OHENG_THEME 정식):
- 목: `#2D8A4E` (구 #2e7d32 폐기)
- 화: `#D32F2F` (구 #c62828 폐기)
- 토: `#E8B82A` (구 #7F6B4E 갈색 폐기)
- 금: `#4A4A4A` (구 #757575 폐기)
- 수: `#1565E0` (구 #1565c0 폐기)

**Verify**: `MOCKUP_CSS` 의 `:root` CSS 변수 정의 확인. 다른 hex 컬러 직접 사용 금지.

---

## 2. 강조 위계 (PremiumResult 패턴)

**`<strong>`** = 골드볼드 (gold-deep `#8C6D3D` 텍스트 + gold 32% 형광펜 배경)
- 일상 결론 / 삶의 의미만
- 한자에 절대 사용 금지

**`<u>`** = 골드 밑줄 (gold #B8965A 2px text-decoration)
- 시기·숫자·색·방위·시간대

**`<b>`** = 검정볼드 (ink #1A1A1A + Noto Serif KR)
- 한자 첫 등장 시각 인식만 (강조 효과 X)

**자동 주입 (autoEmphasize)**:
- `<u>` — 시간 (오후 2~5시), 방위 (북쪽), 색상 (검은색·파란색 등 긴 단어 먼저 매칭)
- `<strong>` — 마지막 문장이 결론 동사 (하세요·시작·미루·집중 등) 또는 결론문 패턴

**Verify**: 본문 4단락 각각에 형광펜 + 밑줄 보임. "검은색" 통째로 매칭 (부분매칭 X).

---

## 3. 섹션 접기/펼치기

**§01 default open**, §02~§07 default 닫힘.

**구조**:
```jsx
<section className={`section ${isOpen('0X') ? 'open' : ''}`}>
  <SectionHeader num="0X" title="..." han="..." id="0X" />
  ...content...
</section>
```

**CSS** (specificity 보장):
- `.section:not(.open) > *:not(.section-header) { display: none !important; }` ← `!important` 필수
- 다른 컴포넌트가 `display: block` 으로 override 못 함

**Verify**: §06 닫혀있을 때 tomorrow 카드 + dailyQuote 모두 hidden.

---

## 4. 섹션 순서 (사용자 결정 2026-05-06)

1. SECTION 01 — 오늘의 결 (본문 4단락) ← default open
2. SECTION 02 — 오늘의 시간 흐름
3. SECTION 03 — 오늘 만나는 사람
4. SECTION 04 — 오늘의 행동 처방
5. SECTION 05 — 오늘의 럭키
6. SECTION 06 — 오늘의 한 문장 + 내일 미리보기
7. SECTION 07 — 오늘 4개의 결 (CTA — 마지막)
8. (footer) closing-note → 월운 업셀 → actions → service-notice

**Verify**: 4영역 점수 카드가 §07 위치 (closing-note 위, upsell 위).

---

## 5. 카드 디자인 — 사주카드 패턴

**4기둥 사주 카드** (my-saju):
- 천간/지지 큰 색 블록 (24px/20px hanja, 흰 글자, 오행 색 배경)
- 일주(나) 셀: 골드 2px solid + goldSoft bg + box-shadow
- 토(土) 노랑 배경에 검정 글자 (대비 가독)
- 금(金) 흰 배경 + 회색 글자 + cardLine border
- 수(水) 검정 #1A1A1A 배경 + 흰 글자

**오행 chip row** (ohaeng-bal):
- 5개 pill chip (가로 스크롤 X, flex wrap)
- 각 오행 색 soft bg + 1.5px 오행 색 border
- bonus chip (오늘 보충): 골드 2px + box-shadow (일주와 같은 강조 패턴)

**일간 만남 카드** (relation-card):
- 좌측: 내 일간 (큰 색 블록 + 풀이 + 음양/상징)
- 화살표 + 카테고리 chip (일상어: "재물·기회 자리" 등 — 한자 X)
- 우측: 오늘 일간 (큰 색 블록 + 풀이)
- 하단 풀이 박스: meaning + 좋은 점 / 조심할 점

**Verify**: 천간/지지 색 블록 솔리드 fill. orb (3D 원형) 디자인 절대 X.

---

## 6. 명리 술어 차단 룰 (Prompt + 클라이언트)

**본문 노출 금지 술어** (todayNarrative 외 모든 짧은 필드):
- 자오충·계묘·일지·시지·월지·년지·정재·정관·식상·식신·상관·편재·편관·인성·정인·편인·관성·재성·비견·겁재·일주·월령·대운·세운·공망·지장간·삼합·반합·육합·형·충·파·해

**금지 표현**:
- ❌ "오늘 경진(庚辰)일을 맞이합니다"
- ❌ "병화 일간이 오늘 경진을 만나는 자리"
- ✅ "오늘은 ~한 결의 날이에요"

**Verify**: §05 doList/dontList reason, §03 timeSlots message, §04 meetPeople desc 에 위 술어 0개.

---

## 7. 모델 + Endpoint 설정

- **무료 오늘운세**: Haiku 4.5 단일 호출 + 1h TTL 캐싱 + Sonnet fallback (JSON parse 실패 시)
- **유료 종합사주**: Opus 4.6 (절대 변경 X)
- **다른 유료 (Daeun·Monthly·Compat·Tojung)**: Sonnet 4.6
- **Cache key**: `sharedDailyFortune/{사주8글자}_{date}_v6` (uid 무관)

**Verify**: 새 호출이 15~25초, 캐시 히트는 <1초.

---

## 8. 라우팅 + UX

**§02 4영역 카드 클릭** (현재 §07 위치):
- 재물 → `/topic/wealth`
- 관계 → `/topic/love`
- 일 → `/topic/career`
- 건강 → `/topic/health`

**§06 월운 업셀 버튼**: `/monthly` (이전 `/charge?need=10` 버그 fix)

**Verify**: 버튼/카드 클릭 시 토스트 없이 정확한 경로 이동.

---

## 9. UI 컴포넌트 표시/숨김 (result phase)

**숨김** (중복):
- DailyRewardBadge (DarkHeader 아래)
- ProfileSelector (DailyResultView 내부)

**표시**:
- DarkHeader (이혜찌 님의 오늘의 운세)
- 빨간 헤더 배너 (title + 날짜)
- saju 4기둥 → 오행 chip → 일간 만남 → §01~§07 → closing → upsell → actions

**Verify**: 결과 페이지 진입 시 다크헤더 직후 빨간 배너 (중간 카드 0).

---

## 10. 풀 width (result phase)

```jsx
<div className={isResultPhase ? 'pb-[120px] mx-auto' : 'px-5 pt-4 pb-[120px] mx-auto'} 
     style={{ maxWidth: 520 }}>
```

`px-5 pt-4` (외곽 padding) result phase 에서 제거. daily-mockup 자체 padding 만 사용.

**Verify**: 빨간 헤더가 좌우 끝까지 닿음. 위 공백 0.

---

## 변경 프로세스 (mandatory)

```
1. 사용자 요청 받음
2. 이 문서 정독 → 영향 받는 LOCKED 항목 식별
3. 변경 시작
4. 변경 후 LOCKED 체크리스트 mental walkthrough
5. 미회귀 verify 시점:
   - 본문 강조 (§01 4단락 strong + u)
   - 섹션 접기 (§02~§07 닫힘 default)
   - 4영역 카드 클릭 가능
   - 모든 카드 골드 토큰 일관
6. 사용자에게 "회귀 없음 확인" 명시 후 deploy
7. 회귀 발견 시 이 문서에 추가
```
