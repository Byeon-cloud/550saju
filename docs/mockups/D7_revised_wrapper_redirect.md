# D7 수정판 — Wrapper Redirect + 2주 Grace Period (A안)

**배경:** D7-1 호출자 전수 조사 결과 `generateDream` endpoint에 최근 7일 12건 실호출 확인. 캐시된 구 client로 추정. 즉시 삭제는 결제 유저 환불 리스크.

**전략:** 하드 삭제 대신 wrapper를 **최신 `generateDreamFree`/`generateDreamDeepV3`로 내부 리다이렉트**하여 구 client도 최신 품질 받게 함. 2주 모니터링 후 호출 0건 근사치 확인 시 최종 삭제.

---

## PC Claude Code에 그대로 붙여넣기

```
[D7-A — Wrapper Redirect + Grace Period]

목표: generateDream / generateDeepDream endpoint를 최신 v3 로직으로 내부 리다이렉트. 구 client 유저 경험 업그레이드 + 경로 실측 로깅. 2주 grace 후 최종 삭제 판단.

전제: D6 commit 56e7210 + D7-1 impact 보고. 구 client 호출 12건/7일 존재.

[D7-A-1] Wrapper 재구현

1. functions/src/ai/claudeDream.ts (또는 관련 함수 파일)의 기존 wrapper 함수:
   - generateDream → generateDreamFree 로직으로 내부 리다이렉트
   - generateDeepDream (있다면) → generateDreamDeepV3 로직으로 내부 리다이렉트
   - 이미 배포된 최신 promptsV3 사용 → 구 client도 D6 품질 수혜

2. Wrapper 본체에 관측 로깅 추가 (console.info/firebase-functions/logger 아무거나):
   - timestamp
   - request.rawRequest?.headers?.['user-agent']
   - request.rawRequest?.headers?.['referer']
   - request.auth?.uid (존재 시만, 해시 권장)
   - body.path (deep 여부 플래그가 있으면)
   - 로그 태그: "deprecated_wrapper_hit" (검색 쉽게)

3. response는 최신 함수 결과 그대로 passthrough. 응답 schema 호환 유지 (구 client 파싱 실패 없게).

4. ⚠ 수정 금지:
   - generateDreamFree / generateDreamDeepV3 / Daily / Weekly / Topic 함수 로직
   - promptsV3.ts
   - temperature / max_tokens

[D7-A-2] 검증

1. cd functions && npx tsc --noEmit → PASS
2. emulator 재기동
3. emulator 스모크:
   - 구 endpoint(generateDream) 직접 호출 2회 — HTTP 200, 응답 스키마 구 client와 호환
   - 최신 endpoint(generateDreamFree/DeepV3) 1회씩 — 기존 동작 유지 확인
4. 로그 확인: "deprecated_wrapper_hit" 태그 로그가 구 endpoint 호출 시 2건 찍히는지 확인. 로깅 실패 시 조정.
5. 응답 본문 diff:
   - 구 endpoint 응답 vs 최신 endpoint 응답
   - 필드 구조 동일해야 (구 client 파싱 안 깨짐)
   - 차이 있으면 wrapper 내부에서 key remap 추가

[D7-A-3] 배포

1. git add -A
2. git commit -m "refactor(ai): redirect deprecated generateDream* wrappers to v3 endpoints + telemetry

   - 하드 삭제 대신 wrapper 내부 리다이렉트 → 구 client 캐시도 D6 품질 수혜
   - deprecated_wrapper_hit 로깅 추가 (user-agent/referer/uid)
   - D7-1 impact: 최근 7일 12건 호출 확인, 결제 유저 환불 리스크 회피
   - 2주 grace 후 호출 추이 재점검 예정"

3. git push origin feat/reunion-upgrade
4. firebase deploy --only functions --project appintoss-saju
5. prod 스모크: 구 endpoint 2회 + 최신 endpoint 각 1회
   - 구: HTTP 200 + 최신 품질 응답 (1000자+ / 1500자+)
   - 최신: 기존 품질 유지

[D7-A-4] 모니터링 셋업 (2주 grace)

1. docs/ops/D7_grace_monitoring.md 생성. 내용:
   - 시작일: YYYY-MM-DD (오늘)
   - 재점검일: +14일
   - 관찰 지표:
     · generateDream / generateDeepDream 일별 호출 건수
     · user-agent 분포 (앱인토스 WebView / Firebase Hosting / 기타)
     · 응답 코드 분포
   - 임계치:
     · 일 < 0.5건 평균 = 최종 삭제 진행 (D7-B)
     · 일 1~3건 = client 재배포 재점검 + grace 1주 연장
     · 일 > 3건 = 미확인 경로 있음 → 추가 조사

2. Firebase Hosting 캐시 정책 확인:
   - 현재 index.html / main.*.js Cache-Control 헤더 점검
   - 구 번들이 강하게 캐시되어 있는지 (max-age·immutable 여부)
   - 필요 시 ETag 갱신 또는 hosting 재배포 스케줄

3. 앱인토스 WebView 쪽은 toss 검수 주기 고려. 재배포 요청 기한 포함 타임라인 별도 문서.

[D7-A-5] 보고

- wrapper redirect 구현 파일/라인
- emulator 구/최신 endpoint 스모크 결과
- prod 스모크 결과
- deprecated_wrapper_hit 로그 첫 발생 캡처
- 최종 커밋 해시
- grace 모니터링 문서 링크

⚠ 실패 대응:
- 스키마 diff 발견 → wrapper 안 key remap. 못 맞추면 stop + 보고 (B안 client 재배포 선행 필요)
- prod 구 endpoint 호출이 wrapper 리다이렉트 후 에러 증가 → 즉시 56e7210으로 revert + 보고
- 로깅이 비용 경고 발생 → 로그 빈도 down-sample (10% 샘플링)
```

---

## D7-B 최종 삭제 조건 (2주 후)

재점검 시 아래 중 **모두** 만족 시 D7-B(최종 삭제) 진행:

- [ ] 일별 호출 평균 < 0.5건 (14일 합산 < 7건)
- [ ] 앱인토스 client 재배포 완료 및 구 번들 캐시 만료 기간 경과
- [ ] Firebase Hosting 구 번들 캐시 만료
- [ ] deprecated_wrapper_hit 로그에 결제 유저(uid 있는 호출) 부재 7일 이상

조건 하나라도 미달이면 grace 1주 연장 + 원인 조사.

---

## 리스크

| 리스크 | 완화 |
|---|---|
| wrapper redirect 후 응답 스키마 구 client와 미호환 | 스모크 diff 점검 + key remap |
| 로깅 비용 증가 | 10% 샘플링 옵션 준비 |
| grace 연장이 반복되어 기술 부채 남음 | 4주 상한 — 4주 후에는 하드 삭제 + 구 client 에러 공지 |
| wrapper가 최신 함수 호출 시 오케스트레이션 오버헤드 | 지연 +50ms 미만 예상, 허용치 내 |
