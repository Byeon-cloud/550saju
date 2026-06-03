# 사주500 출시 버전 기록 (RELEASES)

> **버전 SSOT = `package.json` 의 `version`** — 빌드 시 vite define 으로 주입돼 `MyPage` 등에 자동 반영.
> 출시할 때마다 (1) `package.json` 버전 올리고 (2) 아래에 항목 추가 (3) ait 재빌드 + 토스 콘솔 업로드.

## 버전 규칙 (semver: MAJOR.MINOR.PATCH)
- **PATCH** (1.1.0 → 1.1.1): 버그 fix·문구·작은 조정만
- **MINOR** (1.1.0 → 1.2.0): 새 기능·새 콘텐츠·눈에 띄는 개선
- **MAJOR** (1.x → 2.0.0): 전면 개편·구조 변경

## 출시 체크리스트 (매번)
1. `package.json` version 올림
2. 이 파일에 변경 요약 추가
3. `npx tsc --noEmit` (클라) + `cd functions && npx tsc --noEmit` (서버) 0 에러
4. `firebase deploy --only hosting` (+ 서버 변경 시 `--only functions`, rules 변경 시 `--only firestore:rules`)
5. `npx ait build` → `saju-500.ait` → `D:\550saju\` 복사
6. 토스 콘솔에 ait 업로드 + 출시노트 작성
7. 출시 후: GCP 비용 그래프 · Anthropic 잔액 · 프로모션 지급 확인

---

## v1.1.0 — 2026-05-29 (재출시 · 출시 직후 안정화)
출시 직후 전수 감사로 발견한 고객 피해성 버그 전면 정리 + 강조/보안/리워드 보강.

### 돈·약속 (고객 피해 차단)
- 프리미엄(종합사주) SSE 실패 시 환불 누락 + AILoading 무한 멈춤 fix (환불 + 에러카드)
- 주제분석 60초 타임아웃 시 저장 누락·재분석 잠김 fix
- 7일 출석 완주 **100원** 리워드 — 토스앱 클라이언트 프로모션 방식으로 실작동 (인증서 불필요)
- 출시 3원 프로모션 — 무료 포함 첫 콘텐츠 결과 도달 시 자동 지급으로 확장
- 환불액 정확화: LoadingPage 프리미엄(10→세일가), 재회운(1→실제 차감액)
- 채팅 실패 시 대화권/무료패스 실제 복구
- saveReport 용량초과 가드 (돈 내고 결과 유실 방지)

### 보안
- 잔액 Firestore write 차단 (firestore.rules 금전필드 잠금) — 콘솔 무한충전 구멍 차단 (Phase 1)
- firestoreSync 가 localStorage 잔액을 서버에 업로드하던 것 차단

### 가독성·강조
- 결과 본문 `<strong>` raw 태그 노출 박멸 (엔티티 디코드)
- 종합사주 강조 시스템 적용 — 황금 형광펜(결론)·번트오렌지(주의)·골드 밑줄, autoEmphasize 자동 주입
- 오늘운세·주제분석·꿈해몽 `<em>` 경고색 + 스켈레톤 스캐폴드
- 내 정보 사주 카드 한자→한글 + 폰트 11px + 지장간·12운성
- 하단 탭 폰트 11px, 구 골드 #A08B6A → SSOT #B8965A

### 공유·UX
- 공유 카피 초대형 재작성 (남의 결과 열람 거짓약속 제거) + OG 폴백 + SPA 라우트 매칭
- AI 실패 시 영문 기술오류 → 친절 카피
- 충전 페이지 진입 컨텍스트 안내

### 인프라
- Cloud Functions 8개 minInstances:1→0 (월 ~₩9만 idle 비용 제거)
- 버전 SSOT = package.json (vite define 주입)

---

## v1.0.1 — 2026-05-28 이전 (최초 출시)
- 콘텐츠 9종 (오늘운세·꿈해몽·종합사주·주제 10종·사주대화)
- 가격 v3.1 (3-bucket 잔액·블러잠금·런칭 세일)
- 앱인토스 + 웹 동시
