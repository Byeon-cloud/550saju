# D7 — generateDream wrapper redirect 결정

**결정일:** 2026-04-20
**안:** A안 (wrapper redirect + 2주 grace)

## 배경
- prod에 `generateDream` 호출자 12개 존재 (grep 확인).
- 신규 엔드포인트 `generateDreamFree`, `generateDreamDeepV3` 배포 완료.
- 구함수 하드 삭제 시 prod 전체 꿈해몽 기능 blackout 위험.

## 확정 방침
1. `functions/src/generateDream.ts`를 얇은 wrapper로 변환.
2. 입력 payload의 `tier` 또는 결제 상태 기반으로:
   - 무료 경로 → `generateDreamFree` redirect
   - 심층 경로 → `generateDreamDeepV3` redirect
3. wrapper 진입 시 `console.warn('deprecated_endpoint:generateDream')` 1회.
4. Sentry breadcrumb tag `deprecated_endpoint:generateDream` 발행.
5. 2주 grace: 2026-04-20 ~ 2026-05-04.
6. 호출자 12개 순차 교체 (PR 분리, 1개씩).
7. grace 만료 후 Sentry 호출 0 확인 → `generateDream` 하드 삭제.

## 모니터링
- 매일 Sentry 태그 카운트 확인.
- 교체 진행도 checklist (12/12 달성 시 조기 삭제 가능).
