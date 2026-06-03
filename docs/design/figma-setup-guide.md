# Figma 셋업 가이드 — JDS (Joon Design System)

## 사장님이 할 것 (5단계 · 약 10분)

### Step 1. 새 Figma 파일
1. https://figma.com 접속
2. 우측 상단 **+** → **Design file**
3. 파일명: **`사주500 — JDS (Joon Design System)`**

### Step 2. 플러그인 설치 (3가지 옵션 중 1개)

**옵션 A — Cursor Talk to Figma (가장 안정적, 추천)**
1. Figma 상단 **Resources** → **Plugins**
2. 검색: `Cursor Talk to Figma MCP`
3. **Run** 클릭

**옵션 B — Figma 내장 검색**
1. `Plugins & widgets` 검색창에:
   - `Talk to Figma`
   - `MCP Bridge`
   - `Claude Bridge`
2. 검색 결과에서 위 셋 중 하나 선택

**옵션 C — 직접 가져오기 (개발자 모드)**
1. https://github.com/sonnylazuardi/cursor-talk-to-figma-mcp 의 plugin 폴더
2. Figma → `Plugins` → `Development` → `Import plugin from manifest`
3. `manifest.json` 선택

### Step 3. 플러그인 실행
1. 좌측 메뉴 또는 `Cmd/Ctrl+/` → **Plugins**
2. 설치한 플러그인 클릭
3. 우측에 패널 뜸

### Step 4. 채널 ID 받기
1. 플러그인 패널의 **"Connect"** 또는 **"Start MCP Server"** 클릭
2. **5자리 채널 ID** 표시됨 (예: `7g2k9`)
3. **이 ID를 저(Claude)한테 복붙**

### Step 5. 권한 허용
- "이 플러그인이 파일을 수정할 수 있게 하시겠습니까?" → **허용**

---

## 채널 ID 받으면 제가 자동 생성하는 것

### Page 1: 🎨 Foundation (토큰)
- Color Variables 5 컬렉션 (Brand / Neutral / Oheng / Topic / Extension)
- Text Styles (display / h1~h3 / body / label / caption)
- Effect Styles (radius lg/xl/2xl/full / shadow card/modal)
- Token Naming: `color/brand/gold` 같은 구조

### Page 2: 🧩 Components (70+)
- Button (모든 variant)
- Modal / Toast / LockedCard / EmptyState
- PillarCard / SajuMiniCard / ScoreRing / DaeunTimeline 등 사주 시각화 17종
- Header / TabBar / BalanceBar / FooterCTA
- 컴포넌트 description에 props/사용처 자동 작성

### Page 3: 📱 Pages (25 frames)
- 모바일 max-width 520px frame
- 페이지별 phase 별도 frame (예: Topic의 5 phase = 5 frame)
- frame 옆 sticky note에 description (스토리보드)

### Page 4: 🗺 Flowchart
- 25 페이지 frame들 사이 화살표 연결
- Cross-link 매트릭스 시각화
- Path A/B/C/D 분기 색깔별 그룹

### Page 5: 📖 Storyboard
- 페이지별 sticky note (유저 상태 / 보이는 것 / 다음 액션)
- AI 모델 + 비용 표시
- 회귀 방지 SSOT 체크리스트

---

## 채널 ID 못 받았을 때 대안

플러그인 셋업이 안 되면 다음 파일들로 수동 import:

### 1. tokens.json → Tokens Studio 플러그인으로 import
1. Figma에 **Tokens Studio for Figma** 플러그인 설치
2. 플러그인 실행 → Settings → File → JSON
3. `docs/design/jds-tokens.json` 업로드
4. **모든 토큰이 Variables로 자동 변환됨**

### 2. 컴포넌트 SVG 자동 캡처 (제가 puppeteer로)
- localhost:3000 의 모든 컴포넌트 → SVG/PNG export
- Figma에 drag & drop

### 3. IA HTML → SVG export
- Mermaid 다이어그램을 SVG로 export
- Figma에 import

---

## 셋업 완료 체크리스트

- [ ] Figma 파일 생성됨
- [ ] 플러그인 설치됨
- [ ] 플러그인 실행 중
- [ ] 채널 ID 받음
- [ ] Claude한테 채널 ID 전달
- [ ] (선택) Tokens Studio 플러그인도 설치 (대안용)

---

## 트러블슈팅

### "ECONNREFUSED 127.0.0.1:3055"
- WebSocket 서버가 안 켜진 상태
- 플러그인 안의 "Connect" 또는 "Start" 버튼 다시 누르기

### 채널 ID가 안 보임
- 플러그인 패널 닫혔다 다시 열기
- Figma 파일 새로고침 (`F5`)

### 플러그인 검색이 안 됨
- 옵션 C (직접 import) 사용
- 또는 Tokens Studio 만으로 시작 (토큰만 sync)
