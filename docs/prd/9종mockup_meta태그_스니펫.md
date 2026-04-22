# 10종 mockup · Path Meta 태그 스니펫 (v3 · 완전체)

> **2026-04-22 완전체 재작성.**
> 원본 SSOT: `docs/prd/PC_인수인계_2026_04_21_단일본.md` §2 (mockup 인벤토리) · §3 (Path 정의) · §6 (결정 ①)
> **v2 → v3 주요 교정**: 파일명 v2 일괄 가정 → 실제 인벤토리는 **재물만 v2, 나머지 4 주제 v1** 로 재확인.

**대상 폴더**: `C:\Users\quswn\OneDrive\Documents\Claude\Projects\사주 500\` (Cowork-side · 읽기 only from PC)
**사용 방법**: Cowork 측에서 각 HTML `<head>` 안에 `<title>` 직후로 스니펫 붙여넣기. PC 는 이 문서를 스펙으로만 참조.
**원칙**: "Cowork에서 mockup 만들면 PC는 그걸 React 컴포넌트로 옮긴다. 거꾸로 PC에서 임의로 mockup 안 고친다." (인수인계 §1)

---

## §0. 공통 구조

```html
<!-- ━━━ 사주500 Path 메타 (홈 v5 분기 근거, 2026-04-22) ━━━ -->
<meta name="saju-path" content="__PATH__">
<meta name="saju-path-rationale" content="__WHY__">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
<!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
```

---

## §1. 10종 파일 × Path 라벨 (인수인계 §2 SSOT)

| # | 실제 파일명 (Cowork) | Path 값 | 근거 |
|---|---|---|---|
| 1 | `사주500_UI개편_목업_홈_v4.html` | `A` | G1 갭. v5 재작성 필요. 현 v4 는 A 전용 정적 IA 로 존속 |
| 2 | `사주500_UI개편_목업_1운_주제별연애_v1.html` | `B,C` | 桃 #C88A95 · Path B 그리드 + C 미탐험 강조 |
| 3 | `사주500_UI개편_목업_1운_주제별재물_v2.html` | `B,C` | 財 #B8965A · **유일한 v2** · Path B 그리드 + C |
| 4 | `사주500_UI개편_목업_1운_주제별직업_v1.html` | `B,C` | 官 #5A7CA8 |
| 5 | `사주500_UI개편_목업_1운_주제별건강_v1.html` | `B,C` | 壽 #6FA08C |
| 6 | `사주500_UI개편_목업_1운_주제별공부_v1.html` | `B,C` | 印 #9C5A8A |
| 7 | `사주500_UI개편_목업_확장_대운흐름_v1.html` | `C,D` | 運 #3B7A4B · **2운** (1000원) · C 미리보기 + D 섹션4.5 |
| 8 | `사주500_UI개편_목업_확장_월운_v1.html` | `C,D` | 月 #B5441F · **1운** (500원) · C 미리보기 + D 섹션4.5 |
| 9 | `사주500_UI개편_목업_확장_궁합_v1.html` | `C,D` | 合 #9C5A8A · **3운** (1500원) · C 업셀 + D 섹션4.5 |
| 10 | `사주500_UI개편_목업_확장_토정비결_v1.html` | `D` | 歲 #2F4B7C · **2운** · **D 재방문 anchor** (연 1회) |

**주의**: 
- 파일명에 `주제별` 뒤 **underscore 없음** (예: `주제별연애_v1`, `주제별_연애_v1` ❌ · Cowork 실파일 확인 필요)
- 확장 4종 가격은 5000원급이 아니라 **1~3운 (500~1500원)**. 5000원 = 10운 **충전 패키지** 가격 (`가격_상품구조.md`). "hasPaid5000" 은 10운 **충전** 여부이고 extension 소비와 별개.
- 토정비결은 `D` 전용 (연말 anchor). 나머지 확장 3종은 `C,D` 이중 경로.

---

## §2. 파일별 스니펫

### §2.1. `사주500_UI개편_목업_홈_v4.html`

```html
<meta name="saju-path" content="A">
<meta name="saju-path-rationale" content="홈 v4 는 G1 갭 (5 Path 분기 미반영 정적 IA). v5 로 재작성 시까지 Path A 전용 레퍼런스로 존속. B/C/D 는 v5 분기 로직으로 처리.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

### §2.2. `사주500_UI개편_목업_1운_주제별연애_v1.html`

```html
<meta name="saju-path" content="B,C">
<meta name="saju-path-rationale" content="500원 주제 교차판매. Path B 5종 그리드 진입. Path C 미탐험 pulse 강조. 2030 여성 비중 높음.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

### §2.3. `사주500_UI개편_목업_1운_주제별재물_v2.html`

```html
<meta name="saju-path" content="B,C">
<meta name="saju-path-rationale" content="500원 주제 Top-2. 30대 남성 비중 높음. 유일한 v2. 브랜드 골드 #B8965A anchor 카드.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

### §2.4. `사주500_UI개편_목업_1운_주제별직업_v1.html`

```html
<meta name="saju-path" content="B,C">
<meta name="saju-path-rationale" content="500원 주제 Top-3. 20대 후반~30대 초반 이직·커리어 고민 시점. 관(官) 네이비.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

### §2.5. `사주500_UI개편_목업_1운_주제별건강_v1.html`

```html
<meta name="saju-path" content="B,C">
<meta name="saju-path-rationale" content="500원 주제. 40대+ 유저 비중. 시즌성 약함. 수(壽) 틸.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

### §2.6. `사주500_UI개편_목업_1운_주제별공부_v1.html`

```html
<meta name="saju-path" content="B,C">
<meta name="saju-path-rationale" content="500원 주제. 10대 후반~20대 초반 · 학부모 대리 결제. 5종 그리드 대칭 유지.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

### §2.7. `사주500_UI개편_목업_확장_대운흐름_v1.html`

```html
<meta name="saju-path" content="C,D">
<meta name="saju-path-rationale" content="2운 (1000원). 섹션 4.5 구성원. Path C 에선 미리보기, Path D 에선 최상단 격상. 10년 주기 재방문.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

### §2.8. `사주500_UI개편_목업_확장_월운_v1.html`

```html
<meta name="saju-path" content="C,D">
<meta name="saju-path-rationale" content="1운 (500원). 섹션 4.5. 월 1회 재소비 가능 → 리텐션 훅 핵심. 월 1회 푸시 연계.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

### §2.9. `사주500_UI개편_목업_확장_궁합_v1.html`

```html
<meta name="saju-path" content="C,D">
<meta name="saju-path-rationale" content="3운 (1500원). Path C 업셀 (상대방 사주 입력), Path D 섹션 4.5 기본.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

### §2.10. `사주500_UI개편_목업_확장_토정비결_v1.html`

```html
<meta name="saju-path" content="D">
<meta name="saju-path-rationale" content="2운 (1000원). Path D 재방문 핵심 anchor. 연 1회 콘텐츠라 충성 유저에 강력. 11~2월 시즌 시 홈 강조, 나머지 월은 섹션 4.5 내 유지.">
<meta name="saju-bundle-ref" content="docs/prd/PC_인수인계_2026_04_21_단일본.md#3">
```

---

## §3. 일괄 주입 스크립트 (Cowork 측에서 실행)

**파일**: `C:\Users\quswn\OneDrive\Documents\Claude\Projects\사주 500\scripts\inject-path-meta.mjs`

```javascript
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'C:\\Users\\quswn\\OneDrive\\Documents\\Claude\\Projects\\사주 500';
const META_REF = 'docs/prd/PC_인수인계_2026_04_21_단일본.md#3';

const files = [
  { name: '사주500_UI개편_목업_홈_v4.html', path: 'A', why: '홈 v4 G1 갭. Path A 레퍼런스로 존속' },
  { name: '사주500_UI개편_목업_1운_주제별연애_v1.html', path: 'B,C', why: '500원 주제 교차판매' },
  { name: '사주500_UI개편_목업_1운_주제별재물_v2.html', path: 'B,C', why: '500원 주제 Top-2 · 유일 v2' },
  { name: '사주500_UI개편_목업_1운_주제별직업_v1.html', path: 'B,C', why: '500원 주제 Top-3' },
  { name: '사주500_UI개편_목업_1운_주제별건강_v1.html', path: 'B,C', why: '500원 주제 · 40대+' },
  { name: '사주500_UI개편_목업_1운_주제별공부_v1.html', path: 'B,C', why: '500원 주제 · 10~20대' },
  { name: '사주500_UI개편_목업_확장_대운흐름_v1.html', path: 'C,D', why: '2운 · 섹션 4.5 · D 격상' },
  { name: '사주500_UI개편_목업_확장_월운_v1.html', path: 'C,D', why: '1운 · 월 1회 리텐션' },
  { name: '사주500_UI개편_목업_확장_궁합_v1.html', path: 'C,D', why: '3운 · C 업셀 + D 기본' },
  { name: '사주500_UI개편_목업_확장_토정비결_v1.html', path: 'D', why: 'D 연말 anchor · 2운' },
];

const INJECT_START = '<!-- ━━━ 사주500 Path 메타';

function inject(file) {
  const full = join(BASE, file.name);
  if (!existsSync(full)) {
    console.error(`[ERR] ${file.name} not found — 파일명 재확인 필요`);
    return;
  }
  const html = readFileSync(full, 'utf8');
  if (html.includes(INJECT_START)) {
    console.log(`[skip] ${file.name} already has meta`);
    return;
  }
  const block = `  <!-- ━━━ 사주500 Path 메타 (홈 v5 분기 근거, 2026-04-22) ━━━ -->
  <meta name="saju-path" content="${file.path}">
  <meta name="saju-path-rationale" content="${file.why}">
  <meta name="saju-bundle-ref" content="${META_REF}">
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->`;
  const injected = html.replace(/<\/title>/, (m) => `${m}\n${block}`);
  writeFileSync(full, injected, 'utf8');
  console.log(`[ok] ${file.name} · path=${file.path}`);
}

files.forEach(inject);
console.log('\n=== 완료 ===');
console.log('다음 검증: grep -h "saju-path" *.html | grep -v "rationale\\|bundle-ref" → 10줄 확인');
```

**실행**: `cd "C:\Users\quswn\OneDrive\Documents\Claude\Projects\사주 500" && node scripts\inject-path-meta.mjs`

---

## §4. 10종 체크리스트 (주입 후 수동 검증)

- [ ] 홈 v4 · Path=A
- [ ] 연애 v1 · Path=B,C
- [ ] 재물 v2 · Path=B,C
- [ ] 직업 v1 · Path=B,C
- [ ] 건강 v1 · Path=B,C
- [ ] 공부 v1 · Path=B,C
- [ ] 대운흐름 v1 · Path=C,D
- [ ] 월운 v1 · Path=C,D
- [ ] 궁합 v1 · Path=C,D
- [ ] 토정비결 v1 · Path=D

---

## §5. 변경 이력

| 일자 | ver | 변경 |
|------|-----|------|
| 2026-04-21 | v1 | 9종 권고 (토정비결 제외) |
| 2026-04-22 am | v2 | 10종 전량 + `D-seasonal` 라벨 |
| 2026-04-22 pm | **v3 (현재)** | **파일명 실물 재확인 (재물만 v2·나머지 v1)** · **Path 값 재설정 (B,C / C,D / D)** · 확장 4종 실가격 (1~3운) 반영 · 인수인계 §2 SSOT 일치 |

---

**— 끝.**
