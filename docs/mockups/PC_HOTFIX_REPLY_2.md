# PC 핫픽스 답변 #2 — 섹션 4.5 신규 추가 (기존 기능 입구 복구)

> **준기 사용법:** 파일 열기 → Ctrl+A → Ctrl+C → PC CC에 Ctrl+V → Enter

---

# PC Claude Code에게

1차 핫픽스 diff 잘 받았다. 검증도 PASS. 준기 로컬 확인 결과:
- ✓ 섹션 2 검정 카드 + 크림 글씨 정상
- ✓ 골드브라운 CTA 버튼 정상
- ✓ 꿈해몽 카드 텍스트 정상
- ✓ 섹션 2 카피 "변준기님"(본인 이름) 정상 — 이혜지 사라짐
- ✓ sticky CTA 제거
- (5000원 클릭 → /charge 이동은 별도 확인 예정)

**치명적 누락 발견.** 기존 홈에 있던 **대운·월운·궁합·토정비결·주제별 분석** 입구가 신규 HomePage에서 전부 사라졌다. 각 페이지(`/daeun`·`/monthly`·`/compat`·`/tojung`·`/topic`)는 라우트 등록돼 있지만 홈에서 도달할 경로가 막힘. 내(준기 기획 위임받은 Cowork 쪽) 스펙 작성 누락. 즉시 복구.

---

## 수정 지시 — 섹션 4.5 신규 추가

### 1. 위치

- 섹션 4 (신살 한줄) 직후, 섹션 5 (상품 매트릭스) 직전 사이에 삽입.
- 섹션 번호를 4.5로 두되 코드 주석엔 `{/* ─── 섹션 4.5 · 다른 풀이 입구 ─── */}`.

### 2. 구조

```tsx
<SectionReveal className="py-8">
  <Heading
    level={2}
    eyebrow="사주500이 풀 수 있는 것"
    title="다른 풀이도 준비되어 있습니다"
    description="오늘만이 아니라, 10년의 흐름과 관계·시기까지."
  />
  <div className="mt-4 grid grid-cols-2 gap-3">
    {OTHER_READINGS.map((r) => (
      <button
        key={r.path}
        onClick={() => navigate(r.path)}
        className="flex flex-col items-start gap-1 rounded-xl border border-gray-100 bg-paper p-4 text-left hover:border-gold-brown/40 transition-colors"
        aria-label={`${r.title} 풀이 보러가기`}
      >
        <span className="text-base font-semibold text-ink">{r.title}</span>
        <span className="text-xs text-gray-500 leading-snug">{r.desc}</span>
      </button>
    ))}
  </div>
</SectionReveal>
```

### 3. 데이터

```tsx
const OTHER_READINGS = [
  { path: '/daeun',   title: '대운 흐름',   desc: '10년 단위 인생 흐름' },
  { path: '/monthly', title: '월운',        desc: '이번 달 기운 풀이' },
  { path: '/compat',  title: '궁합',        desc: '상대와의 인연 분석' },
  { path: '/tojung',  title: '토정비결',    desc: '신년 운세 풀이' },
  { path: '/topic',   title: '주제별 분석', desc: '연애·재물·직장 집중' },
];
```

- 카드 5개 → 2×2 grid + 마지막 1개는 단독 행 (2열 grid에서 자연스럽게 처리됨)
- **새 컴포넌트 만들지 말 것** — 인라인 JSX로 처리. 재사용 컴포넌트화는 IA v3에서.

### 4. 룰

- 아이콘 추가 금지 (응급 단계. IA v3에서 오행·기호 아이콘 할당).
- 색상·간격은 전부 tailwind 토큰 (`bg-paper`, `text-ink`, `text-gray-500`, `border-gold-brown/40`). 하드코딩 금지.
- 라우트는 0단계 보고의 22개 목록에만 등록된 path만 사용. 등록되지 않은 path 추가 금지.
- hover·focus 상태 기본만. 애니메이션 추가 금지.

### 5. 검증 게이트

```bash
npx tsc --noEmit            # PASS
npm run build               # PASS
grep -En "/daeun|/monthly|/compat|/tojung|/topic" src/pages/HomePage.tsx
# → 5건 발견 필수
```

### 6. 보고 포맷

```
[PC 핫픽스 2차 보고]
- 섹션 4.5 추가: HomePage.tsx:{삽입 라인}~{끝 라인} ({추가 라인수}줄)
- 5개 카드 path 등록 확인: /daeun ✓ /monthly ✓ /compat ✓ /tojung ✓ /topic ✓
- OTHER_READINGS 상수 정의 위치: HomePage.tsx:{라인}
- typecheck PASS / build PASS
- 준기 시각 확인 대기
```

## 금지

- 섹션 4.5를 제외한 다른 섹션 건드리지 말 것.
- 카드 레이아웃 2×2 → 3×2 또는 1×5 변경 금지. 2열 grid 고정.
- 카피 변경 금지 ("사주500이 풀 수 있는 것" / "다른 풀이도 준비되어 있습니다" / 설명 5종 그대로).
- 아이콘·뱃지·캐러셀 추가 금지. 응급 복구 단계.

지금 바로 진행. 작업 완료 후 멈춤. 준기 시각 확인 paste 기다려라.
