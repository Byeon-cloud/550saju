---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경
  확인/getServerTime.md
---

# 서버 시간 가져오기 (`getServerTime`)

`getServerTime` 함수는 토스 앱 서버 기준의 현재 시간을 가져오는 API예요.\
디바이스 시간이 아닌 **서버 시간(Server Time)** 을 반환하기 때문에,\
클라이언트 시간 조작으로 발생할 수 있는 보상 중복 수령이나 치팅을 방지하는 데 유용해요.

출석 체크, 이벤트 기간 검증, 보상 수령 가능 여부 판단 등 **시간 신뢰도가 중요한 로직**에서 활용할 수 있어요.

::: tip 참고하세요

* 반환되는 시간은 **Unix timestamp (밀리초 단위)** 형식이에요.
* 지원하지 않는 앱 버전에서는 `undefined`가 반환될 수 있어요.
* 사용 전 `getServerTime.isSupported()`로 **버전 지원 여부를 먼저 확인하는 것을 권장**해요.

:::

## 시그니처

```typescript
function getServerTime(): Promise<number | undefined>;
```

## 반환 값

## 예제

:::code-group

```tsx[React]
import { getServerTime } from '@apps-in-toss/web-framework';

async function checkRewardEligibility() {
  // 버전 체크를 먼저 수행하는 것을 권장해요
  if (!getServerTime.isSupported()) {
    console.log('이 기능은 지원되지 않는 버전입니다.');
    return;
  }

  const serverTime = await getServerTime();
  const rewardDeadline = 1705200000000;

  if (serverTime && serverTime > rewardDeadline) {
    console.log('보상 수령 기간이 지났습니다.');
  }
}
```

```tsx[React Native]
import { getServerTime } from '@apps-in-toss/framework';

async function checkRewardEligibility() {
  // 버전 체크를 먼저 수행하는 것을 권장해요
  if (!getServerTime.isSupported()) {
    console.log('이 기능은 지원되지 않는 버전입니다.');
    return;
  }

  const serverTime = await getServerTime();
  const rewardDeadline = 1705200000000;

  if (serverTime && serverTime > rewardDeadline) {
    console.log('보상 수령 기간이 지났습니다.');
  }
}
```

:::
