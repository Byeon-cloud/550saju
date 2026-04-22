# PC · Sprint 1 통합 핸드오버 v1 (2026-04-21)

> **대상**: PC (Claude Code @ D:\550saju)
> **기간**: D+0~D+3 (3일 내 완료)
> **우선순위**: 🔥 P0 5건 전부. 이 출하가 런칭의 블로킹 포인트.
> **단일 소스**: 이 문서 하나만 보면 됨. 질문 있으면 끝에 "막힘 체크리스트" 사용.

---

## 사전 확인 (시작 전 필독)

**참조 문서 (Cowork에서 공유됨 · `C:\Users\quswn\OneDrive\Documents\Claude\Projects\사주 500\`)**:

- `마스터_갭리포트_v1_2026-04-21.md` — 전체 컨텍스트
- `사주500_UI개편_00_마스터.md` — 디자인 토큰
- `사주500_UI개편_03_결과.md` — 결과 페이지 공통 골격
- `사주500_UI개편_14_주제별심층_5종_통일스펙_v1.md` — 주제별 5종 통일
- `사주500_UI개편_16_홈_구조재배치_v4.md` — 홈 IA v4
- `사주500_UI개편_11_로딩UX_스펙.md` — 로딩 Tier C
- `사주500_UI개편_05_보관함.md` — 보관함 2탭 분리
- `Track_A_홈_카피덱_v1.md` — 홈 카피 16개 후기 포함

**목업 HTML 참조**:
- `사주500_UI개편_목업_무료_오늘의운세_v2.html`
- `사주500_UI개편_목업_무료_꿈해몽_v2.html`
- `사주500_UI개편_목업_1운_주제별재물_v2.html`
- `사주500_UI개편_목업_결과프리미엄_v2.html`
- `사주500_UI개편_목업_로딩_v1.html`

---

## Task P0-1. 데이터 스키마 꼬임 진단·수정 (Day 0, 30분~2시간)

### 준기 증언
"사주 정보가 이상하게 연결되어있어. 이용기록 데이터랑 사주팔자 정보가 뭐가 이상하게 꼬여있다."

### 진단 체크리스트 (PC 회신 필수 · 30분)

Firestore Console → `users/{TEST_UID}/` 아래 컬렉션 리스트를 확인.

```
[ ] 현재 컬렉션 구조가 아래 중 어디인가?
    (A) users/{uid}/profiles — 사주·이용기록 단일 테이블 혼재
    (B) users/{uid}/sajuProfiles + users/{uid}/usage — 분리되어 있음
    (C) users/{uid}/profiles + users/{uid}/resultHistory — 분리되어 있음 (표기 다름)
    (D) 기타 (구체 경로 회신)

[ ] 결과 문서 (/daily, /dream, /topic, /premium 결과)는 어디 저장되나?
[ ] 결과 문서에 profileId FK 필드가 있나?
[ ] 보관함 삭제 버튼을 누르면 실제 어떤 문서가 삭제되나?
    - 코드 경로: src/pages/StoragePage.tsx (해당 함수 30줄 회신)
```

### 예상 수정안 (진단 회신 후 확정)

**메모리 `project_storage_data_model.md` 기준 올바른 구조**:

```
users/{uid}/
  sajuProfiles/{profileId}         ← 사주 정보 (삭제 가능)
    - name, birth, gender, timeType
  resultHistory/{resultId}         ← 이용 기록 (삭제 불가 · 자동 생성)
    - profileId (FK · 삭제된 profile도 id 유지)
    - contentType: daily | dream | topic | premium | daewoon | wolun | gunghap | tojeong
    - createdAt, result (전문), charge (1운|2운|...)
  rewardClaims/{claimId}           ← 결제·리워드 기록 (삭제 절대 불가)
    - type: purchase | attendance_streak | attendance_week7_tosspoint | invite | share
    - amount (운 단위) or tossTxId
  settings, preferences ...
```

**삭제 정책**:
- sajuProfiles 삭제 시: 해당 profileId 문서만 삭제. resultHistory는 profileId FK만 남고 결과는 그대로.
- resultHistory는 삭제 UI 제공 X. "보관함"에서 안 보이게만 숨김 처리.
- rewardClaims 삭제는 불가능 (관리자 도구에서만).

**백필 스크립트 (단일 테이블 → 분리)**:
```ts
// functions/src/scripts/migrate_storage_v1.ts
import { getFirestore } from 'firebase-admin/firestore';

export async function migrate(uid: string) {
  const db = getFirestore();
  const profiles = await db.collection(`users/${uid}/profiles`).get();
  
  for (const doc of profiles.docs) {
    const data = doc.data();
    
    if (data.type === 'saju') {
      // → sajuProfiles
      await db.doc(`users/${uid}/sajuProfiles/${doc.id}`).set(data);
    } else if (data.resultContent) {
      // → resultHistory
      await db.doc(`users/${uid}/resultHistory/${doc.id}`).set({
        ...data,
        profileId: data.profileId || 'legacy_unknown',
      });
    }
    
    await doc.ref.delete();
  }
}
```

### 완료 기준
- [ ] Firestore 2개 컬렉션 분리 (`sajuProfiles`, `resultHistory`)
- [ ] 삭제 플로우: 사주 삭제 시 resultHistory 유지 실기기 확인
- [ ] 기존 사용자 데이터 백필 스크립트 실행 후 검증

---

## Task P0-2. 결과 페이지 4종 v2 prod 반영 (Day 1~2)

### 목표
`/사주 500/` 폴더의 4개 목업 HTML을 **시각적으로 그대로** React 컴포넌트로 옮긴다.

### 공통 컴포넌트 추출

**신규 파일**:
```
src/components/result/
  ResultHeader.tsx      ← 140px · 오행 그라디언트 + 프로필 뱃지 + 제목
  ResultBody.tsx        ← L1~L4 layer 렌더 + 블러 잠금
  ResultLayer.tsx       ← L1/L2/L3/L4 개별 레이어 (props.level)
  PaywallBar.tsx        ← 무료만 · sticky 하단
  ResultActions.tsx     ← 공유·저장·대화 3버튼
  UpsellCard.tsx        ← 유료만 · 1개만 표시
  AdBanner.tsx          ← 무료만 · tier !== 'free' 시 null
  FooterLinks.tsx       ← 기존 활용 가능
```

**Props 단일 규칙**:
```tsx
<ResultPage
  tier={'free' | 'paid'}
  locked={boolean}  // L3~L4 블러 여부
  profileId={string}
  resultId={string}
  contentType={'daily' | 'dream' | 'topic' | 'premium'}
/>
```

### 4개 페이지 교체

| 페이지 | 파일 | 목업 참조 | tier | locked |
|---|---|---|---|---|
| 오늘의 운세 | `src/pages/DailyFortunePage.tsx` | `목업_무료_오늘의운세_v2.html` | free | false |
| 꿈해몽 무료 | `src/pages/DreamPage.tsx?mode=free` | `목업_무료_꿈해몽_v2.html` | free | false |
| 주제별 재물 | `src/pages/TopicResultPage.tsx` | `목업_1운_주제별재물_v2.html` | paid | false |
| 프리미엄 종합 | `src/pages/PremiumResultPage.tsx` | `목업_결과프리미엄_v2.html` | paid | false |

### 중요 구현 포인트

**1) 원국 첫 화면 (오늘의 운세 리플로우)**
준기 지적: "오늘의 운세 플로우 재설계 - 원국 만세력 첫 페이지, card flip 제거"

현재 플로우 (추정):
```
/daily/:id 진입 → 카드 뒤집기 애니 → 결과
```

변경:
```
/daily/:id 진입 → ResultHeader (원국 4주 한자 + 일간 표시) → L1 요약 즉시 → L2~L4 스크롤
```

원국 표시:
```
┌─────────────────────────────┐
│ 연주  월주  일주  시주        │
│ 甲   乙   丙   丁            │
│ 子   丑   寅   卯            │
│                              │
│ 일간: 丙火 (병화)             │
└─────────────────────────────┘
```

**2) 프리미엄 PDF 저장**
- 메모리: "프리미엄 PDF 다운로드 = 서버 Puppeteer + Storage"
- 클라이언트 html2canvas X (길이 문제)
- 버튼 누르면 `generatePremiumPDF` Cloud Function 호출 → Storage 업로드 → 다운로드 링크 반환
- 기존 엔드포인트: `사주500_UI개편_09_PDF서버엔드포인트.md` 참조

**3) 블러 잠금**
`ResultLayer` 컴포넌트 내부:
```tsx
<div style={{
  filter: locked && (level === 3 || level === 4) ? 'blur(6px)' : 'none',
  pointerEvents: locked && (level === 3 || level === 4) ? 'none' : 'auto',
}}>
  {content}
</div>
{locked && level === 3 && <LockOverlay />}
```

### 완료 기준
- [ ] 4 페이지 모두 목업 v2와 픽셀 수준 근접 (±4px 오차 허용)
- [ ] 공통 컴포넌트 8개 추출 · 중복 코드 0
- [ ] 원국 첫 화면 적용 (오늘의 운세) · card flip 제거
- [ ] 블러 잠금 무료 결과에서만 작동
- [ ] 광고 배너 무료에만 표시 · 유료 0건
- [ ] 프리미엄 PDF 저장 버튼 클릭 → 서버 엔드포인트 호출
- [ ] footer 통일 ("공유하고 1운 받기" 기본 + 프리미엄만 PDF)

---

## Task P0-3. 로딩 Tier C prod 반영 (Day 1, 병행)

### 현재 상태
준기 증언: "로딩화면도 예전버전. 스켈레톤이니 한자니 뭐니 했는데 안 나옴. 그냥 원 나오고 뱅글뱅글 도는 것만 보임"

### 목표
`/사주 500/사주500_UI개편_목업_로딩_v1.html` 그대로 React 컴포넌트화.

### 3 Tier 전체

| Tier | 트리거 | 컴포넌트 | 지속 |
|---|---|---|---|
| A | 홈 카드 탭 | SkeletonLoader | 0.5~1s |
| B | 스트리밍 결과 | StreamingText | 진행 중 |
| C | 결과 생성 | FullscreenLoading | 10~30s |

### Tier C FullscreenLoading 스펙

```tsx
// src/components/loading/FullscreenLoading.tsx
export function FullscreenLoading() {
  const messages = [
    '만세력을 계산하고 있습니다',
    '일간을 해석하고 있습니다',
    '신살을 배치하고 있습니다',
    '대운의 흐름을 읽고 있습니다',
    '결론을 다듬고 있습니다',
  ];
  // 6초마다 메시지 교체
  // 상단에 오행 한자 카드 (느린 회전)
  // 중앙 H3 현재 메시지
  // 하단 "시간이 좀 걸려도 정성껏 풀어드립니다" Body-sm
}
```

**배치 구조**:
```
┌────────────────────────────┐
│ [paper 배경 풀스크린]        │
│                            │
│   [한자 카드 · 天乙貴人]     │  ← 72px · 느린 회전 8s
│                            │
│   만세력을 계산하고 있습니다  │  ← H3 18/700
│                            │
│   ───  ───  ───            │  ← 진행 도트 (현재 섹션만 ink)
│                            │
│   시간이 좀 걸려도           │  ← Body-sm · gray-500
│   정성껏 풀어드립니다         │
│                            │
└────────────────────────────┘
```

### 적용 대상
- generateTodayFortune 호출 시
- generateDreamInterpretation 호출 시
- generateTopicResult 호출 시
- generatePremiumResult 호출 시
- generateDaewoon, generateWolun, generateGunghap, generateTojeong (Sprint 2~3 후)

### 완료 기준
- [ ] `FullscreenLoading` 컴포넌트 파일 생성
- [ ] spinner 전면 폐기 (`<Spinner />` grep 후 제거)
- [ ] 5단계 메시지 순환 구현
- [ ] 한자 카드 8s 회전 애니 (CSS keyframes)
- [ ] 결과 생성 경로 5개 전부 호환

---

## Task P0-4. 홈 14포인트 반영 (Day 2~3)

### 참조 문서
- `사주500_UI개편_16_홈_구조재배치_v4.md` — 10 섹션 IA
- `Track_A_홈_카피덱_v1.md` — 카피 전부

### 구현 순서

**Step 1. 카운트다운 제거 (5분)**
```bash
grep -rn "LaunchCountdown\|countdown\|런칭까지" src/
```
찾아서 HomePage.tsx에서 import + 렌더 제거.

**Step 2. 카드 네이밍 교체 (30분)**
`Track_A §A1` 8개 카드 타이틀 전부 교체:
```
오늘의 운세 → 오늘의 하루, 한눈에
꿈해몽 → 어젯밤 꿈, 해석해드립니다
1운 주제별 해석 → 오늘 제일 궁금한 한 가지
5000원 프리미엄 종합 → 올해 내 삶, 한 권의 명리
AI 사주대화 → 물어보고 싶은 만큼, 귀인처럼
내 보관함 → 지금까지의 해석, 차곡히
이벤트 → 오늘 받을 복
내정보 → 내 사주·기록
```

**Step 3. 10 섹션 순서 적용 (2시간)**
`사주500_UI개편_16_홈_구조재배치_v4.md §1` 매트릭스대로 HomePage.tsx 재구성.

각 섹션은 별도 컴포넌트로 분리 (§8 파일 리스트).

**Step 4. 후기 16건 교체 (30분)**
`Track_A §A9` 16건 JSON으로:
```json
// src/data/reviews.json
[
  { "age": "20대", "gender": "여", "text": "퇴근길에 뽑아봤는데 진짜 오늘 일진 맞았음" },
  { "age": "20대", "gender": "여", "text": "화개살이라고 하길래 검색해봤는데 MBTI보다 정확해서 놀람" },
  ...
]
```

**"광고 거슬릴 정도는 아닙니다" 제거**:
```bash
grep -rn "광고" src/data/
grep -rn "광고" src/components/home/
```
찾은 후 삭제.

**Step 5. 금지어 grep (15분)**
```bash
grep -rn "AI" src/pages/HomePage.tsx src/components/home/
grep -rn "GPT\|챗GPT\|모델" src/pages/HomePage.tsx src/components/home/
grep -rn "500원\|5000원" src/pages/HomePage.tsx src/components/home/
# 이모지 유니코드
grep -rEn "[\\x{1F300}-\\x{1FAFF}\\x{2600}-\\x{27BF}]" src/pages/HomePage.tsx src/components/home/
```
발견 시 교체.

**Step 6. "왜 사주 500" 철학 블록 (30분)**
`Track_A §A7` 카피 그대로 · 세리프 폰트 (Noto Serif KR) · 베이지 그라디언트.

**Step 7. 해시태그 22개 (30분)**
`16_홈_구조재배치 §2 [09]` 22개 pill 추가.

**Step 8. ? FAB z-index (10분)**
```css
.fab-help {
  position: fixed;
  bottom: calc(64px + env(safe-area-inset-bottom) + 16px);  /* TabBar 위 */
  right: 16px;
  z-index: 100;
  pointer-events: auto;
}
```

### 완료 기준
- [ ] 10 섹션 순서 일치
- [ ] 카드 가치명 8개 반영
- [ ] 후기 16건 교체 · "광고 거슬림" 문자열 0건
- [ ] AI/GPT/챗 0건 · 이모지 0건 · 원화 노출 0건
- [ ] 카운트다운 제거
- [ ] 철학 블록 추가
- [ ] 해시태그 22개 추가
- [ ] FAB 스크롤 걸림 해소

---

## Task P0-5. 보관함 2탭 분리 (Day 3)

### 참조 문서
`사주500_UI개편_05_보관함.md` 전체 + 메모리 `project_storage_data_model.md`

### 핵심 UI

```
┌─────────────────────────────┐
│ BalanceBar                  │
├─────────────────────────────┤
│ [사주 정보] [이용 기록]      │  ← Top tab
├─────────────────────────────┤
│  (사주 정보 탭)              │
│  ┌──────────────────────┐   │
│  │ 변준기 · 1995.5.12    │   │
│  │ [삭제]                │   │
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │ + 새 사주 추가         │   │
│  └──────────────────────┘   │
└─────────────────────────────┘
```

### 탭별 데이터 · 액션

**사주 정보 탭**:
- 표시: `users/{uid}/sajuProfiles` 리스트
- 액션: 삭제 · 추가 · 이름 수정
- 삭제 시 확인 모달: "이 사주를 삭제해도 지난 해석은 보관함에 남아 있어요"

**이용 기록 탭**:
- 표시: `users/{uid}/resultHistory` 리스트 (최근 순)
- 그룹: 날짜별 (오늘 · 이번 주 · 이번 달 · 그 전)
- 액션: 결과 재열람 · 숨기기 (삭제 아님)
- 삭제 버튼 없음. "숨기기" 토글로 표시 제어

### 완료 기준
- [ ] 2탭 UI · 스위치 정상
- [ ] 사주 삭제 후 이용 기록 유지 실기기 확인
- [ ] "+ 새 사주 추가" 진입점 동작
- [ ] 이용 기록 탭에 삭제 버튼 없음

---

## 공통 배포 · 검증

### 배포 명령
```powershell
cd D:\550saju
# Functions
firebase deploy --only functions
# Hosting
npm run build
firebase deploy --only hosting
```

### 배포 전 자가 검증
```powershell
# 1. 빌드 에러 없음
npm run build

# 2. 타입 체크
npm run typecheck

# 3. 이모지 grep
grep -rEn "[\\x{1F300}-\\x{1FAFF}]" src/

# 4. 원화 grep (홈·결과)
grep -rn "원" src/pages/HomePage.tsx src/pages/Daily*.tsx src/pages/Topic*.tsx

# 5. AI/GPT grep
grep -rn "GPT\|챗GPT" src/
```

### 배포 후 준기 검증 (물리 기기)
- [ ] 홈 10 섹션 순서
- [ ] 결과 4종 v2 시각
- [ ] 로딩 Tier C 풀스크린
- [ ] 보관함 2탭
- [ ] 사주 삭제 후 이용 기록 유지

---

## 막힘 체크리스트 (PC 회신용)

문제 발생 시 이 포맷으로 Cowork에 회신:

```
[P0-{번호}] 막힘 지점
- 증상: (한 줄)
- 시도한 것: (한 줄)
- 질문: (구체 질문 1개)
- 에러 로그: (있다면 20줄)
```

---

## 완료 보고 포맷

Sprint 1 종료 시 이 포맷으로 Cowork에 회신:

```
[Sprint 1 완료 보고 · 2026-04-{DD}]

P0-1 데이터 스키마: ✅ / ⚠️ / ❌
  - 상세: ...

P0-2 결과 4종 v2: ✅ / ⚠️ / ❌
  - 4페이지 커밋 해시: ...
  - 물리 기기 검증: OK / 이슈 N건

P0-3 로딩 Tier C: ✅ / ⚠️ / ❌

P0-4 홈 14포인트: ✅ / ⚠️ / ❌
  - 14항 각 상태: 1. OK / 2. OK / ...

P0-5 보관함 2탭: ✅ / ⚠️ / ❌

잔여 이슈 리스트:
1. ...
2. ...

준기 실기기 검증 스샷: (첨부)
```

---

**Owner**: Claude (Cowork) · **Receiver**: Claude Code (PC) · **Approver**: 준기 (물리 기기 검증)
