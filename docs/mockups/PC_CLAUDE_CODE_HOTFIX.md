# PC Claude Code 핫픽스 — HomePage 7종 결정적 버그 + 사전 컨텍스트 보고

> **준기 사용법:** 파일 열기 → Ctrl+A → Ctrl+C → PC Claude Code에 Ctrl+V → Enter

---

# PC Claude Code에게

준기 로컬 스크린샷 2장 확인. 시각 결함 5종 + 라우팅 결함 + BottomNav 통합 결함까지 총 **7종 버그**. 즉시 수정. 단 **0단계 (기존 앱 컨텍스트 보고)부터 먼저** 한다 — 컨텍스트 파악 없이 수정하면 또 깨짐.

---

## 0단계 (선행 필수) — 기존 앱 구조 보고

수정 들어가기 전에 5분 안에 아래 5개 항목 보고. 보고 받기 전엔 1단계 시작 금지.

### 0-1. 실제 등록된 라우트 목록
```bash
grep -rn "<Route\|<Routes" src/App.tsx src/router*
```
- 실제 등록된 path 전부 (`/`, `/input`, `/today`, ...)
- 각 path가 어느 컴포넌트에 매핑되는지

### 0-2. BottomNav 위치·구성
```bash
grep -rn "BottomNav\|bottom-nav\|TabBar" src/
```
- BottomNav 파일 경로
- 실제 노출되는 탭 5개 (스크린샷 확인: 홈·사주분석·사주대화·보관함·내정보) 각각 라벨·아이콘·route
- BottomNav가 어느 페이지에서 노출되고 어느 페이지에서 숨겨지는지

### 0-3. Layout wrapper
```bash
grep -rn "Layout\|<Outlet" src/
```
- Layout 컴포넌트 위치
- Header·BottomNav를 자동 감싸는지, 페이지가 직접 렌더하는지
- HomePage가 Layout 안에서 렌더되는지 밖에서 렌더되는지

### 0-4. 가격·상품 페이지 path 실제 여부
```bash
grep -rn "topic\|report\|today" src/App.tsx src/router* src/pages/
```
- 신규 HomePage CTA가 가리키는 `/topic`·`/report`·`/today`·`/input` 등이 실제 라우트로 등록되어 있는지
- 없으면 어떤 path가 살아 있고 어떤 페이지로 가야 하는지 (대체 path 후보)

### 0-5. tailwind safelist 점검
```bash
cat tailwind.config.js | grep -A 20 safelist
ls dist/assets/*.css 2>/dev/null && grep -E "\.bg-(ink|gold-brown|paper)" dist/assets/*.css | head -5
```
- safelist 설정 여부
- 빌드 산출 CSS에 `bg-ink`·`bg-gold-brown`·`text-paper` 클래스가 실제 존재하는지

### 보고 포맷
```
[PC 0단계 보고]
0-1 라우트 (전체):
  - / → HomePage
  - /input → InputPage
  - ...
0-2 BottomNav: src/components/BottomNav.tsx
  - 5탭: 홈(/) · 사주분석(/...) · 사주대화(/...) · 보관함(/...) · 내정보(/...)
  - 노출 페이지: 홈·... / 숨김: 입력·결제
0-3 Layout: src/layouts/Layout.tsx, <Outlet/> 안에 페이지 렌더, BottomNav 자동
0-4 신규 HomePage CTA path 실제 등록 여부:
  - /input ✓ 등록
  - /today ✗ 미등록 (대체 후보: ...)
  - /topic ✗ 미등록
  - /report ✗ 미등록
0-5 safelist: {있음/없음}
  빌드 CSS: bg-ink {존재/누락}, bg-gold-brown {존재/누락}
```

이 보고 받고 나서 1단계로 진행. 보고 없이 임의 수정 금지.

## 버그 1 — 카드 tier="primary" 검정 배경 미적용

- **위치:** HomePage.tsx 섹션 2 "오늘의 운세" 카드 (그 외 다른 카드도 평면화 의심)
- **현재:** 평면 한지색 배경. 위계 죽음.
- **기대:** `bg-ink` (#1A1A1A) + `text-paper` (#F8F5EE) + `rounded-2xl` + `shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)]`
- **확인:**
  - 카드 wrapper에 tier prop 분기 로직이 실제 className으로 매핑되는지
  - tailwind.config.js에 `ink: '#1A1A1A'`, `paper: '#F8F5EE'` 토큰이 잘 등록됐는지 (1단계에서 추가 보고함)
  - **Tailwind JIT 안전 클래스 화이트리스트** 확인 — 동적 className 조합 시 purge되는 경우 있음. `safelist`에 `bg-ink`, `text-paper`, `bg-gold-brown`, `bg-gold-brown-dark` 등록 필요할 수 있음.

## 버그 2 — Primary CTA 버튼 배경색 미적용

- **위치:** "내 사주 풀어보기" / "500원 풀이" / "오늘의 풀이 전체 보기" / "내 꿈 풀어보기 · 무료" 등 모든 PrimaryCTA + sticky 하단 CTA
- **현재:** 흰 글자 + 흰 배경 → 텍스트 안 보임 (스크린샷에서 KPI 박스에 가려진 것처럼 보이는 이유)
- **기대:** `bg-gold-brown text-white h-[52px] rounded-xl font-semibold`
- **확인:**
  - tailwind config에 `gold-brown` 색상 토큰이 객체 형태로 (`{ DEFAULT, dark, soft }`) 등록됐는지
  - JIT 빌드에서 `bg-gold-brown` 클래스가 실제 CSS로 산출되는지 (`npm run build` 산출물 dist/assets/*.css 안에 `.bg-gold-brown` 검색)
  - 산출 안 됐으면 safelist에 추가

## 버그 3 — 섹션 3 꿈해몽 카드 미리보기 텍스트 깨짐

- **위치:** 섹션 3 꿈해몽 입구 카드 안 미리보기 영역
- **현재:** "내 사주 풀어보기·500원" 잘못 박혀 있고 그 아래 "름." 한 글자만 노출
- **기대 텍스트 (스펙 그대로):**
  > "어젯밤 물이 나오는 꿈을 꿨다면 · 水 기운이 강한 일간에겐 재물, 木 일간에겐 감정의 흐름."
- **확인:**
  - HomePage.tsx 섹션 3 JSX 구조 — children 위치 또는 prop이 잘못 박혔을 가능성
  - "내 사주 풀어보기·500원" 문자열이 어디서 나오는지 grep — 만약 sticky CTA 텍스트가 카드 안에 잘못 렌더되는 거면 컴포넌트 wrapper 구조 오류
  - "름." 한 글자만 보이는 건 `text-overflow: ellipsis` 또는 `truncate` 클래스가 잘못 걸려서 가능

## 버그 4 — 신규 유저인데 "이혜지님" 가상 이름 노출

- **위치:** 섹션 2 오늘의 운세 카드 안
- **현재:** "이혜지님, 오늘의 기운이 준비되면 여기에 먼저 보여드립니다."
- **기대 (신규 유저, hasSaju=false):** "생년월일·시간만 넣으면, 매일 무료로 오늘의 운세를 풀어드립니다."
- **확인:**
  - useUserSaju 훅 (src/hooks/useHomeData.ts) — `localStore.getProfiles()` 가 신규에서도 가상 데이터 (이혜지)를 반환하는지
  - hasSaju 분기에서 신규 케이스가 잘못된 분기로 빠지는 듯. **localStorage 초기화** (DevTools Application → Local Storage clear) 후 재진입 테스트
  - 만약 dev seed 데이터가 박혀 있으면 그게 노출되는 것 — seed 코드 위치 확인 후 production 빌드에서는 미주입 처리

## 버그 5 — "한자만" → "한지단" 오타

- **위치:** 섹션 4 신살 한줄 마지막 줄
- **현재:** "사주500은 한지단 던지지 않습니다."
- **기대:** "사주500은 한자만 던지지 않습니다."
- **확인:**
  - HomePage.tsx에서 "한지단" 또는 "한자만" 직접 grep
  - 폰트 렌더링 문제일 가능성도 0은 아니지만, 실제 jsx 텍스트 오타일 확률 90%

## 버그 6 — 5000원 리포트 클릭 시 404 (라우팅 결함)

- **증상:** 홈에서 "5000원 정밀 리포트" 상품 카드 클릭 → 404 페이지
- **원인 추정:** 신규 HomePage ProductCard href가 `/report` 또는 `/premium` 등 **실제 등록되지 않은 경로**를 가리킴. 다른 CTA도 동일 위험 (`/topic`·`/today` 등).
- **복구 룰:**
  1. 0-4 보고에서 **실제 등록된 path**만 사용한다.
  2. 신규 스펙이 요구한 path인데 미등록이면 **라우트 먼저 등록 후 연결**. 단, 새 페이지 생성 금지 — 기존 페이지로 alias 연결 (예: `/report` → 기존 `/input?tier=premium` 리다이렉트).
  3. 임시 페이지(“준비 중”) 생성 금지. 준기 컨펌 없이 껍데기 페이지 만들지 않는다.
- **보고 의무:** 각 CTA·ProductCard의 `href`·`to` prop을 **라인 단위로** 보고. 수정 전/후 path 명시.
- **검증:** 홈에서 8개 CTA 전부 클릭 → 404 0건. 스크린샷 8장 첨부.

## 버그 7 — 기존 BottomNav 5탭과 신규 스펙 충돌

- **상황:** 기존 앱엔 이미 BottomNav 5탭(홈·사주분석·사주대화·보관함·내정보)이 존재. 신규 HomePage는 BottomNav를 고려하지 않고 sticky 하단 CTA를 깔아서 **BottomNav에 가려지거나 이중 바**가 생길 가능성 높음.
- **결정 룰 (준기 승인):**
  - 신규 HomePage는 **기존 BottomNav 그대로 사용**. 탭 5개 건드리지 않는다.
  - sticky 하단 CTA는 **BottomNav 위에 얹는 형태** (`bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))`).
  - BottomNav 높이 CSS 변수가 없으면 먼저 추가: `--bottom-nav-height: 56px` (실제 컴포넌트 높이 측정 후 값 지정).
  - sticky CTA와 BottomNav가 **겹치지 않는지** 428px·375px·1024px 3개 뷰포트에서 스크린샷으로 확인.
- **보고 의무:** BottomNav 파일 경로·현재 높이·CSS 변수 도입 여부·sticky CTA top 값 명시.

## 작업 순서

1. **버그 1·2·5 빠른 수정** (CSS·텍스트 위주, 30분)
   - tailwind 토큰·safelist 점검 → 빌드 산출 CSS에서 `.bg-ink`, `.bg-gold-brown` 클래스 존재 확인
   - 텍스트 오타 1건 수정
2. **버그 3·4 진단·수정** (JSX 구조 + 훅 로직, 1시간)
   - 꿈해몽 JSX 구조 grep → 깨진 부분 식별
   - useUserSaju localStorage 초기화 후 재테스트
3. **검증 게이트 (전부 PASS 필수):**
   - `npx tsc --noEmit` PASS
   - `npm run build` PASS
   - 빌드 산출 CSS에 `.bg-ink`, `.bg-gold-brown`, `.text-paper` 존재 확인 (`grep -E "\.bg-(ink|gold-brown)" dist/assets/*.css`)
   - localStorage 비우고 신규 진입 → 섹션 2가 신규 카피로 나오는지 확인
   - 모바일 뷰 (DevTools 428px·375px·1024px 3개) console error 0건
   - **스크린샷 첨부 의무화** (보고에 image path 또는 base64 첨부):
     1. 홈 첫 진입(localStorage clear 직후) — 428px
     2. 홈 첫 진입 — 375px
     3. 홈 데스크톱 — 1024px
     4. 8개 CTA 클릭 후 도착 페이지 (404 없음 증명)
     5. sticky CTA + BottomNav 동시 노출 영역 확대 컷
4. **보고:**
   ```
   [PC 핫픽스 보고]
   - 0단계 보고 결과 요약 (라우트·BottomNav·Layout·safelist)
   - 버그 1: {파일:라인} {수정 내용}
   - 버그 2: {파일:라인} {수정 내용} + safelist 추가 여부
   - 버그 3: {파일:라인} {수정 내용}
   - 버그 4: {파일:라인} {수정 내용} + localStorage 테스트 결과
   - 버그 5: {파일:라인} {수정 내용}
   - 버그 6: 각 CTA href 수정 전/후 표 + 8개 CTA 클릭 결과 (404 0건 증명)
   - 버그 7: BottomNav 통합 방식 + CSS 변수 도입 여부 + sticky CTA top 값
   - 빌드 CSS에 ink/gold-brown 클래스 존재: ✓/✗
   - typecheck PASS / build PASS
   - 스크린샷 5종 첨부
   - 다음 단계 대기 (준기 시각 컨펌 후 승인 paste 줌)
   ```

## 금지

- "다 고쳤어요" 한 줄 답변. 무엇을 어떻게 고쳤는지 라인 단위 설명 필수.
- 추가 시각 개선 (여백 64px·뱃지 색·캐러셀 인디케이터 등) 임의 진행. 이건 IA v2 재기획에서 일괄 처리.
- 5개 버그 외 영역 건드리기.

지금 바로 실행해라.
