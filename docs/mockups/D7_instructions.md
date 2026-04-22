# D7 — Dead Code 제거: generateDream wrapper + endpoint

**목표:** `generateDream` wrapper 함수와 해당 endpoint를 완전 제거. 호출자 0건 재확인 + 배포.

**전제:** D6 완료 상태 (commit 56e7210). promptsV3.ts는 D6 최종 상태 유지.

---

## PC Claude Code에 그대로 붙여넣기

```
[D7 — Dead Code 제거: generateDream wrapper + endpoint]

목표: 구 generateDream wrapper 함수와 해당 endpoint 완전 제거.
전제: D6 commit 56e7210 기준, promptsV3.ts는 수정 금지.

[D7-1] 영향 분석 (삭제 전 반드시)

1. grep로 wrapper 호출자 전수 조사:
   rg -n "generateDream[^A-Za-z]" functions/src/ client/ docs/ app/
   rg -n "'/generateDream'" functions/ client/ app/
   rg -n "httpsCallable.*generateDream[^A-Za-z]" client/ app/
   → Free/Deep suffix는 제외. wrapper만 필터.

2. Firebase console에서 최근 7일 해당 endpoint 호출 횟수 확인.
   - 0건 → 진행.
   - 1건 이상 → stop + 보고 (호출 경로 재분석).

3. 분석 결과를 docs/prd/D7_deadcode_dream_IMPACT.md 로 기록:
   - grep 결과 파일:라인 리스트
   - Firebase 호출 횟수 (스크린샷 또는 수치)
   - 삭제 대상 확정 리스트

[D7-2] 제거

1. functions/src/ai/claudeDream.ts — wrapper 함수 삭제.
2. functions/src/index.ts (또는 functions export 등록 파일) — wrapper endpoint export 제거.
3. 관련 타입/인터페이스/주석/import 정리.

⚠ 건드리지 말 것:
- generateDreamFree / generateDreamDeep 로직과 endpoint
- promptsV3.ts (D6 최종 상태)
- claudeFortune/Weekly/Topic

[D7-3] 검증

1. cd functions && npx tsc --noEmit → PASS
2. emulator 재기동
3. emulator 스모크:
   - Dream Free 2회 — HTTP 200, interpretation ≥1500자, 면피체 0건
   - Dream Deep 1회 — HTTP 200, 분량 floor 통과, 면피체 0건
4. 기준 미달 → stop, revert, 보고.
5. 통과 시:
   git add -A
   git commit -m "refactor(ai): remove deprecated generateDream wrapper + endpoint

   - wrapper 호출자 0건 확인 (docs/prd/D7_deadcode_dream_IMPACT.md 참조)
   - 유지: generateDreamFree, generateDreamDeep
   - 기능 영향 0"

6. git push origin feat/reunion-upgrade
7. firebase deploy --only functions --project appintoss-saju
8. prod 스모크:
   - Dream Free 2회 + Dream Deep 1회
   - 기준: HTTP 200, 분량 floor, 면피체 0건

[D7-4] 보고 표

- 삭제된 파일/라인 수
- 호출자 0건 증빙 (IMPACT.md 링크)
- emulator 결과 (3회)
- prod 결과 (3회)
- 최종 커밋 해시
- 남은 백로그 (있으면)

⚠ 금지:
- generateDreamFree/Deep 로직 수정 금지
- promptsV3.ts 수정 금지
- temperature/max_tokens 변경 금지

⚠ 실패 대응:
- grep에서 client/app 호출자 발견 → stop + 보고
- Firebase endpoint 호출 > 0 → stop + 보고
- 스모크 어느 항목이든 미달 → 즉시 56e7210 유지 상태로 revert + 보고
```

---

## 예상 소요

- 영향 분석 + 제거 + tsc: 10분
- emulator 스모크 (3회): 7분
- 커밋 + 배포 + prod 스모크: 10분
- **합계: 약 30분**

## 실패 시 상태

- 직전 안정 커밋: `56e7210` (D6 완료 상태)
- revert 즉시 가능.
