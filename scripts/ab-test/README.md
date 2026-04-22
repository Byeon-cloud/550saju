# Opus 4.6 vs Sonnet 4.6 A/B 비교 러너

## 배경

CLAUDE.md 최상위 원칙 #3 — **퀄리티 다운그레이드 절대 불가**.
`claudeReport.ts` 의 메인 모델은 `claude-opus-4-6` 고정. 비용 최적화를 위한 Sonnet 전환을 검토하려면 반드시 이 러너로 A/B 벤치를 돌려 품질 근사 여부를 객관적으로 확인해야 함.

## 구성

```
scripts/ab-test/
├── fixtures.ts   # 3종 사주 원국 샘플 (신강/신약/중화 × 식상/편관/정재)
├── run.ts        # 러너 본체 (6회 호출, 품질 메트릭 자동 계산)
├── out/          # 실행 결과 (자동 생성)
│   ├── {fixture}_{model}.json
│   └── report.md
└── README.md
```

## 실행

```bash
cd 550saju
ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/ab-test/run.ts
```

요구 사항:
- `tsx` (`npm i -D tsx` 또는 이미 devDep에 존재)
- `@anthropic-ai/sdk` (functions/ 하위에 이미 설치됨 — 루트에서 돌릴 경우 설치 필요)
- 실 API 비용 발생 (Opus 3회 + Sonnet 3회 = 약 $2~4 예상)

## 자동 평가 메트릭

| 메트릭 | 목표 | 의미 |
|---|---|---|
| totalChars | 섹션 합 5000+ | 본체 분량 |
| avgSectionLen | 400+ | 섹션당 평균 |
| minSectionLen | 300+ | 최단 섹션 (균형) |
| hanjaRatio | ≤5% | 한자 이원화 원칙 준수 |
| markdownCount | 0 | **볼드** # 헤딩 금지 |
| emojiCount | 0 | 이모지 금지 |
| structureComplete | true | analysisBase+scores+luckyProfile 모두 존재 |
| evidencePhrases | 12+ | "때문에/니까" 근거 마커 |
| soreumPoints | 6+ | "하시죠/실 거예요" 소름 어투 |
| latencyMs | <180s | 타임아웃 안전 마진 |
| estCostUSD | 참고 | 공식 가격 × 실 토큰 |

## 자동 판정 로직

fixture 당 Opus vs Sonnet:
- **품질 근사** = |글자수 차이| < 500 AND |근거 차이| ≤ 2
- **Opus 우위** = Opus 글자수↑ OR 근거 차이 > 2
- **Sonnet 우위** = 그 외 (Opus 열세)

## 운영 규칙

1. 3 케이스 모두 "품질 근사" 판정 시에만 Sonnet 전환 후보
2. 그 경우에도 **사람 리뷰 필수** — 특히:
   - 용신 → luckyProfile 파생 일관성
   - 소름 포인트 구체성 (단순 "리더십" 류 금지)
   - 한자 문장 녹임 ("정관격(正官格)" 식 괄호 병기)
3. 판정 근거는 `out/report.md` 아카이브. 상품 정책 변경 시 재벤치.

## 런타임 오버라이드

Cloud Function 배포된 상태에서 Sonnet으로 일시 전환하려면:
```bash
firebase functions:config:set saju.report_model="claude-sonnet-4-6"
```
또는 `SAJU_REPORT_MODEL` 환경변수. `claudeReport.ts` 가 이 값을 우선 사용.

**기본 정책: Opus 4.6 유지. (2026-04-18 결정)**
