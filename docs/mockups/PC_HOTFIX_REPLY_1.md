# PC 핫픽스 답변 #1 — Q1~Q5 결정 + 준기 직접 검증 결과

> **준기 사용법:** 파일 열기 → Ctrl+A → Ctrl+C → PC Claude Code에 Ctrl+V → Enter

---

# PC Claude Code에게

0단계 보고 잘 받았다. 진단 깔끔. 핵심 발견 정리:
- 빌드 CSS에 `.bg-ink`·`.bg-gold-brown` 정상 존재 → tailwind purge 아님 → **HMR stale 캐시 의심**
- `/report` 미등록 확정 (버그 6)
- Layout 없음, App.tsx 직접 BalanceBar + Routes + TabBar 구조
- TabBar 5탭 (홈·사주분석·사주대화·보관함·내정보), 홈에서 노출
- HomePage가 사용한 `/today`는 자동으로 `/daily`로 매핑돼 있음 (영리한 적응)

---

## Q1 답 — A 채택 (/report → /charge alias)

- **방식:** 라우트 신규 등록 안 함. 신규 페이지 생성 안 함.
- **수정:** ProductCard 5000원 항목의 `href` (또는 `to`) prop을 `/report` → `/charge`로 변경.
- **이유:** 5000원 = 10운 충전 흐름과 일치. 결제 후 자연스럽게 결과 페이지로 이어짐.
- **확인:** 같은 5000원 CTA가 다른 곳 (sticky·후기 카드 등)에도 박혀 있으면 전부 동일 변경.

## Q2·Q3·Q4 답 — 준기가 직접 검증 중. 결과 받은 후 코드 수정 분기

준기가 지금 PC 앞에서 다음 2가지를 직접 실행 중:

1. **dev 서버 재시작** — `Ctrl+C` → `npm run dev` 후 홈 새로고침
2. **localStorage 완전 clear** — DevTools → Application → Local Storage → saju500 도메인의 모든 키 삭제 → 홈 새로고침

준기가 결과 스크린샷을 다음 paste로 가져온다. 그동안 PC는:

### PC가 지금 할 일 (준기 결과 기다리는 동안)

**A. Q4 진단 코드 미리 보고:** `src/hooks/useHomeData.ts`의 `useUserSaju` 함수 전문 + `localStore.getProfiles()` 전문을 그대로 출력해라. 신규 유저 (profiles 빈배열)에서 어떻게 분기되는지 라인 단위로 설명. 만약 `profiles[0]`을 무조건 가져오는 코드가 있으면 가드 추가 필요 (`profiles.length === 0 → hasSaju=false` 강제).

**B. Q3 진단 코드 미리 보고:** HomePage.tsx의 섹션 3 (꿈해몽 카드) JSX 구조 그대로 출력. "어젯밤 물이 나오는 꿈" 텍스트가 어느 prop·children 위치에 있는지, sticky CTA 라벨 ("내 사주 풀어보기·500원") 문자열이 코드 어디에서 나오는지 grep 결과 같이 첨부.

**C. 코드 수정은 멈춤.** 준기 검증 결과 받기 전엔 아무것도 고치지 마라. 진단 보고만.

## Q5 답 — c 채택 (sticky CTA 제거)

- **이유:** 
  - TabBar의 "사주분석" 탭(`/input`)이 신규 유저 1순위 행동과 동일. 홈 sticky CTA가 중복.
  - UX 라이팅 카피북에 sticky CTA 룰 명시 없음. 메모리상 "TabBar = 5탭 고정"이 컨벤션.
  - sticky + TabBar 2단 깔면 본문 가시 영역이 80px+ 잘림.
- **수정:** HomePage.tsx의 sticky 하단 CTA 블록 전체 제거. 본문 하단 `pb-[96px]` → `pb-[24px]` 정도로 축소 (TabBar 자체 높이 영역만 확보).
- **대체 안내 카피:** 본문 마지막 (섹션 7 "왜 사주500" 직후)에 작은 텍스트 1줄: "준비됐으면 하단 ‘사주분석’ 탭에서 시작하세요." (선택, IA v3 단계에서 재정리)

---

## 정리 — PC 작업 순서

1. Q1 (`/report` → `/charge` href 교체) **즉시 수정**. diff 보고.
2. Q5 (sticky CTA 제거 + pb 축소) **즉시 수정**. diff 보고.
3. Q4·Q3 **진단 보고만** (위 A·B). 수정 대기.
4. 버그 5 ("한지단" → "한자만") **즉시 수정**. diff 보고.
5. 위 1·2·5 끝나면 typecheck + build PASS 확인 후 **여기서 일단 멈춤**.
6. 준기 검증 결과 (dev 재시작 + localStorage clear 후 스크린샷) 받으면 두 번째 paste로 Q2·Q3·Q4 마무리.

## 보고 포맷

```
[PC 핫픽스 1차 보고]
- Q1: ProductCard.tsx:{라인} href '/report' → '/charge' 교체. 다른 위치 0건/N건.
- Q5: HomePage.tsx:{라인} sticky CTA 블록 제거 (-{라인수}줄). pb-[96px] → pb-[24px].
- 버그 5: HomePage.tsx:{라인} "한지단" → "한자만".
- Q4 진단: useUserSaju 전문 출력 + 신규 유저 분기 흐름 설명. 가드 필요 여부.
- Q3 진단: HomePage.tsx 섹션 3 JSX 구조 + sticky CTA 라벨 grep 결과.
- typecheck PASS / build PASS
- 준기 검증 결과 대기
```

지금 1·2·4번 진행해라.
