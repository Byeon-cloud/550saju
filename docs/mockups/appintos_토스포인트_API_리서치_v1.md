# 앱인토스 토스포인트 API 리서치 v1 (2026-04-21)

> **목적**: 이벤트 탭 v4.1 "7일 완주 토스포인트 100원" 지급 구현을 위한 API 풀스펙.
> **출처**: developers-apps-in-toss.toss.im 공식 문서 + techchat 커뮤니티 검증.
> **대상**: PC (Claude Code, prod repo D:\550saju).
> **원칙**: prod 배포 전 stub 모드로 1차 구현 → 심사 통과 후 실 프로모션코드로 스위치.

---

## 1. 두 가지 지급 경로 비교

| 축 | SDK (grantPromotionReward) | 서버 API (executePromotion) |
|---|---|---|
| 호출 위치 | 웹뷰 클라이언트(React) | Cloud Functions (서버) |
| 인증 | 토스 로그인 세션(userKey) | mTLS 클라이언트 인증서 |
| 1회 보장 | 클라 방어로직(100% 보장 불가) | 서버 idempotency 키로 보장 |
| 사전 준비 | SDK 설치만 | mTLS 인증서 발급·서버 배포 |
| D-Day 가능성 | ○ 즉시 가능 | △ 인증서 승인 리드타임 |

**결정: 서버 API(executePromotion) 우선. 단 stub 모드로 먼저 배선.**

이유:
1. **1회 지급 보장 필수** — "7일 완주 1건만 지급" 조건 위반 시 비즈월렛 소진·정산 악몽.
2. **클라 SDK는 공식 문서가 "1회 지급 100% 보장 불가"로 명시** (techchat #3537).
3. **idempotency 키 = `tosspoint_week7_{uid}_{weekKey}`** — 이미 스펙에 박아둠.
4. **mTLS 인증서 발급은 콘솔에서 즉시 가능** (리드타임 없음, 재심사 무관).

SDK 방식은 폴백으로도 안 쓴다. 서버 API 3회 재시도 실패 시 → **운 2 폴백 + 백오피스 알림** (`project_event_tab_strategy.md` v4.1 §63).

---

## 2. SDK — grantPromotionReward (폴백 없음, 참고용)

```typescript
// 웹뷰
import { grantPromotionReward } from '@apps-in-toss/web-framework';
// 리액트 네이티브
import { grantPromotionReward } from '@apps-in-toss/framework';

function grantPromotionReward({
  params,
}: {
  params: {
    promotionCode: string;  // 콘솔 등록 프로모션 ID
    amount: number;         // 지급 포인트
  };
}): Promise<
  | { key: string }                           // 성공
  | { errorCode: string; message: string }    // 실패
  | undefined                                 // 앱 버전 < 5.232.0
  | 'ERROR'                                   // 알 수 없는 에러
>;
```

### 에러 코드

| 코드 | 의미 | 대응 |
|---|---|---|
| `4100` | 프로모션 정보 없음 | 콘솔 프로모션코드 확인 |
| `4109` | 실행중 아님 (예산 소진 or 기간) | 비즈월렛 잔액·종료일 점검 |
| `4110` | 리워드 지급/회수 실패 | 재시도 |
| `4111` | 지급내역 없음 | 키 검증 실패 — 재지급 금지 |
| `4112` | 프로모션 머니 부족 | 비즈월렛 충전 |
| `4114` | 1회 지급 한도 초과 | 콘솔 설정 확인 |
| `4116` | 전체 예산 초과 | 비즈월렛 충전 |
| `undefined` | 토스앱 버전 < 5.232.0 | 업데이트 안내 |
| `ERROR` | 알 수 없는 에러 | 로그 후 폴백 |

### 요구사항
- **토스앱 5.232.0+** (이전 버전은 `undefined` 반환)
- **SDK 버전 2.0.8+**
- **토스 로그인 필수** (userKey 세션)
- **런칭 전 TEST_ 코드로 최소 1회 호출 필수** (심사 조건)

---

## 3. 서버 API — executePromotion (메인 경로)

### 베이스 URL

| 환경 | 도메인 |
|---|---|
| 일반 API (프로모션·포인트·메시징) | `https://apps-in-toss-api.toss.im` |
| 결제 API | `https://pay-apps-in-toss-api.toss.im` |

→ 이벤트 탭은 **`https://apps-in-toss-api.toss.im`** 사용.

### 인증: mTLS 필수

| 항목 | 값 |
|---|---|
| 방식 | Mutual TLS (클라이언트 + 서버 상호 인증) |
| 발급처 | 앱인토스 콘솔 → 앱 선택 → `mTLS 인증서` → `+ 발급받기` |
| 형식 | PEM (client-cert.pem, client-key.pem) |
| 만료 | 갱신 필요 (정확한 기간 미공개, 발급 후 확인) |
| 동시 등록 | 복수 인증서 동시 등록 가능 (무중단 교체) |

### Rate Limit

- **기본 3,000 QPM** (초당 50건)
- 상향은 비즈 사유 + 예상 트래픽 기재 후 고객 지원 요청
- 7일 완주 지급은 하루 최대 = 전체 DAU * 1/7 → 런칭 초기 전혀 문제 없음

### 응답 구조 (공통)

```json
{
  "resultType": "SUCCESS" | "FAILURE",
  "success": { /* 성공 데이터 */ },
  "error": {
    "errorCode": "string",
    "reason": "string"
  }
}
```

### 엔드포인트 3종

| 메소드 | 용도 |
|---|---|
| `executePromotion` | 프로모션 지급 실행 |
| `getExecutionResult` | 지급 결과 조회 (비동기 확인용) |
| `getKey` | userKey 조회 (로그인 토큰 → 영구 키) |

**상세 페이로드 스펙은 공식 API 레퍼런스 페이지가 빈 응답** — 실제 구현 시 `getKey` 먼저 확인해 userKey 수취 경로를 노드 SDK 예제(Kotlin/Python/Node.js 중 하나)로 뽑아와야 한다.

---

## 4. 프로모션코드 라이프사이클

### 콘솔 등록 플로우
```
대표 관리자 로그인
  → 워크스페이스 선택
  → 미니앱 선택
  → [프로모션] 탭
  → [+ 등록하기]
  → 폼 작성 (이름·종료일·혜택탭 노출·미션 이름·지급 방식·이동 URL·예산)
  → 심사 제출 (2~3 영업일)
  → 승인 시 실 프로모션코드 발급
```

### 지급 방식 옵션
| 방식 | 설명 | 사주500 선택 |
|---|---|---|
| **고정형** | 지정 금액 1회 지급 (ex: 100원) | ○ 7일 완주 100원 고정 |
| 최대형 | 상한 내 랜덤 지급 | × 랜덤 금지 정책 |

### 테스트 코드
- 심사 전 `TEST_` 프리픽스 코드로 기능 검증
- 현재 보유: `TEST_01KN9V82GYJZ5C1S3KP4HQA6AY` (기존 발급분 메모리 확인)
- 심사 화면의 **"테스트하기"** 버튼으로 TEST_ 코드 활성화
- 실 QR 코드로 토스앱에서 호출 검증 (샌드박스 아님)

---

## 5. 비즈월렛 (예산)

| 항목 | 내용 |
|---|---|
| 충전 방법 | 콘솔 → 비즈월렛 → 충전 (가상계좌 or 법인카드) |
| 알림 | 예산 80% 소진 시 자동 이메일 |
| 소진 시 | `errorCode 4109` / `4112` 반환, 지급 실패 |
| 런칭 초기 충전 목표 | 10만원 (1000명 × 7일 완주 100원, 여유 포함) |

**보수적 계산**:
- 런칭 1개월 DAU 500 × 7일 완주율 15% 예상 × 100원 = 7,500원/월
- 초기 **3만원 충전**으로 시작 → 알림 오면 리필

---

## 6. 구현 스텁 패턴 (mTLS 인증서 발급 전 단계)

PC가 prod 배포할 때 **mTLS 인증서 아직 없어도 스펙 전체 배선**하고, 인증서 준비 후 환경변수만 주입하는 구조.

### functions/src/attendance/claimWeeklyTossPoint.ts

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { grantTossPoint } from '../shared/appintosClient';

export const claimWeeklyTossPoint = functions
  .region('asia-northeast3')
  .runWith({ secrets: ['APPINTOS_MTLS_CERT', 'APPINTOS_MTLS_KEY', 'APPINTOS_PROMOTION_CODE'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '로그인 필요');
    const uid = context.auth.uid;
    const weekKey = getWeekKey(); // "YYYY-Www"

    // idempotency 체크
    const claimRef = admin.firestore().doc(
      `users/${uid}/rewardClaims/tosspoint_week7_${uid}_${weekKey}`
    );
    const existing = await claimRef.get();
    if (existing.exists) {
      return { status: 'already_claimed', key: existing.data()?.tossTxId };
    }

    // 7일 완주 검증 (별도 함수)
    const done = await verifyWeekAttendance(uid, weekKey);
    if (!done) throw new functions.https.HttpsError('failed-precondition', '7일 미완주');

    // 토스포인트 지급
    const userKey = await getUserKey(uid); // getKey API
    const result = await grantTossPoint({
      userKey,
      promotionCode: process.env.APPINTOS_PROMOTION_CODE!,
      amount: 100,
      idempotencyKey: `tosspoint_week7_${uid}_${weekKey}`,
    });

    if (result.resultType === 'SUCCESS') {
      await claimRef.set({
        type: 'attendance_week7_tosspoint',
        cycle: weekKey,
        amount: 100,
        currency: 'TOSSPOINT',
        tossTxId: result.success.key,
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: 'granted', key: result.success.key };
    }

    // 3회 재시도 실패 → 운 2 폴백
    if (result.error.errorCode in ['4110', '4112', '4116']) {
      await retryOrFallback(uid, weekKey, result.error);
    }
    throw new functions.https.HttpsError('internal', result.error.reason);
  });
```

### functions/src/shared/appintosClient.ts

```typescript
import https from 'https';
import axios, { AxiosInstance } from 'axios';

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (client) return client;
  const cert = process.env.APPINTOS_MTLS_CERT; // PEM 본문
  const key = process.env.APPINTOS_MTLS_KEY;   // PEM 본문

  // STUB 모드: 인증서 미주입 시 목업 반환
  if (!cert || !key) {
    client = axios.create({
      baseURL: 'stub://appintos',
      adapter: async (config) => ({
        data: {
          resultType: 'SUCCESS',
          success: { key: `STUB_${Date.now()}` },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }),
    } as any);
    return client;
  }

  client = axios.create({
    baseURL: 'https://apps-in-toss-api.toss.im',
    httpsAgent: new https.Agent({ cert, key, rejectUnauthorized: true }),
    headers: { 'Content-Type': 'application/json' },
  });
  return client;
}

export async function grantTossPoint(params: {
  userKey: string;
  promotionCode: string;
  amount: number;
  idempotencyKey: string;
}) {
  const res = await getClient().post('/promotion/execute', {
    userKey: params.userKey,
    promotionCode: params.promotionCode,
    amount: params.amount,
    idempotencyKey: params.idempotencyKey,
  });
  return res.data;
}

export async function getUserKey(uid: string): Promise<string> {
  // TODO: 토스 로그인 세션 → userKey 매핑. 심사 통과 후 구현.
  if (!process.env.APPINTOS_MTLS_CERT) return `STUB_USERKEY_${uid}`;
  const res = await getClient().post('/user/getKey', { uid });
  return res.data.success.userKey;
}
```

### STUB 모드 동작 검증
- 환경변수 `APPINTOS_MTLS_CERT` / `APPINTOS_MTLS_KEY` 부재 시 → 목업 응답
- 실 prod에서 7일 출석 시: Firestore `rewardClaims`에 `tossTxId: "STUB_..."` 기록만 남음
- 유저 토스 앱에는 포인트 안 들어감 (인증서 주입 전)
- UI는 "토스포인트 100원 지급됐어요"까지 동일 (Tier B 모달)
- **→ 심사 통과 + 인증서 발급 후 환경변수만 주입하면 실지급 시작**

---

## 7. STUB → LIVE 스위치 체크리스트

| 단계 | 액션 | 담당 |
|---|---|---|
| 1 | 앱인토스 콘솔에서 프로모션 등록·심사 제출 | 준기 |
| 2 | 심사 통과 후 실 프로모션코드 수령 | 준기 |
| 3 | `mTLS 인증서` 탭에서 클라이언트 인증서 발급·다운로드 | 준기 |
| 4 | Firebase Functions Secret에 주입: `firebase functions:secrets:set APPINTOS_MTLS_CERT` `APPINTOS_MTLS_KEY` `APPINTOS_PROMOTION_CODE` | 준기 (PC 가이드 동반) |
| 5 | Functions 재배포 (Secrets 바인딩) | PC |
| 6 | TEST_ 코드로 사전 호출 검증 (토스앱 QR) | 준기 |
| 7 | 실 프로모션코드로 스위치·카나리 1건 | PC |
| 8 | rewardClaims 문서에 실 tossTxId 확인 | 준기 |

---

## 8. 미해결 항목 (블로킹 아님)

- **executePromotion 정확한 Request Body 스키마** — 공식 문서 빈 페이지. 실 구현 시 콘솔 `API 사용하기` 탭의 Node.js 예제 복사 권장. 위 스텁 코드는 추정 구조.
- **getUserKey 파라미터** — 토스 로그인 세션에서 userKey 뽑는 경로 미공개. 콘솔 API 레퍼런스에서 확인.
- **만료 기간** — mTLS 인증서 유효기간 미공개. 발급 시 확인 후 갱신 캘린더 등록.

이 3건은 **인증서 발급과 동시에 자동 해결**되는 항목이라 v4 구현 시작을 막지 않는다.

---

## 9. 참고 자료

- [비게임 프로모션(토스포인트) SDK](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/비게임/promotion.md)
- [API 개요](https://developers-apps-in-toss.toss.im/api/overview.html)
- [통신 설정 (mTLS)](https://developers-apps-in-toss.toss.im/development/integration-process.md)
- [프로모션 QA 가이드](https://developers-apps-in-toss.toss.im/promotion/qa.md)
- [techchat — 1회 지급 보장 한계](https://techchat-apps-in-toss.toss.im/t/topic/3537)
- [techchat — 테스트 통과 조건](https://techchat-apps-in-toss.toss.im/t/topic/3214)
