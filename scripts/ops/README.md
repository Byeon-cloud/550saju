# 운영 확인 스크립트 (읽기만)

firebase-tools 로그인 세션으로 Firestore 를 읽기만 한다. 쓰기 호출 없음.

| 파일 | 하는 일 | 사용 |
|---|---|---|
| `campaign_funnel.cjs` | 혜택탭 캠페인 시험 판정. 띠 운세 연 사람 → 태어난 해 → 생일 넣기 → 오늘의 운세 받음, 알림 동의, 운 사용, 충전 (기기 수, 오너 기기 제외) | `node scripts/ops/campaign_funnel.cjs 2026-10-17 2026-10-19` |
| `ai_spend.cjs` | 최근 7일 AI 사용액(aiUsage 토큰 x price.json 단가)과 남은 크레딧으로 버틸 날 | `node scripts/ops/ai_spend.cjs` |
| `fs.cjs` | 위 둘이 쓰는 읽기 도우미 | |

- 캠페인 판정 기준(10-15 오너 합의): 띠 운세를 연 사람 중 오늘의 운세를 받은 사람 10% 이상이면 계속, 3% 미만이면 중단.
- 기준선(1.5.6 전, 10-12~14 캠페인 사흘): 앱 연 기기 2,989, 오늘의 운세 받음 53(1.8%), 운 사용 6, 충전 1.
- `fs.cjs` 의 firebase-tools 경로는 이 PC(npm 전역 설치) 기준이다.
