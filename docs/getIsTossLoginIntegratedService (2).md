---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/로그인/getIsTossLoginIntegratedService.md
---

# 토스 로그인 연동 확인 (`getIsTossLoginIntegratedService`)

`getIsTossLoginIntegratedService`는 **현재 유저가 토스 로그인과 연동된 유저인지 여부를 확인하는 API**예요.

이 함수는 주로 **토스 로그인 → 게임 로그인으로 마이그레이션하는 과정**에서 사용돼요.\
기존 토스 로그인 유저인지 여부에 따라,\
로그인 플로우나 데이터 이전 처리를 분기할 때 활용할 수 있어요.

## 시그니처

```tsx
function getIsTossLoginIntegratedService(): Promise<boolean>;
```

| 반환 타입          | 설명                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| `Promise<boolean>` | 현재 서비스가 토스 로그인과 연동되어 있다면 `true`, 아니면 `false`를 반환합니다. |

## 주의사항

* 이 API는 토스 로그인 기능을 사용하는(또는 사용했던) 미니앱에서만 의미가 있어요.
* 토스 로그인을 전혀 사용하지 않는 미니앱에서 호출하면 아래와 같은 예외가 발생할 수 있어요.

```tsx
@throw { message: 'oauth2ClientId 설정이 필요합니다.' }
```

## 예제 : 토스 로그인 연동 여부 확인하기

아래 예제는 유저가 토스 로그인 연동 유저인지 확인한 뒤,
상태에 따라 서로 다른 처리를 하는 기본적인 흐름을 보여줘요.

::: code-group

```js [js]
import { getIsTossLoginIntegratedService } from '@apps-in-toss/web-framework';

async function handleGetIsTossLoginIntegratedService() {
  try {
    const result = await getIsTossLoginIntegratedService();

    if (result === undefined) {
      console.warn('지원하지 않는 앱 버전이에요.');
      return;
    }
    if (result === true) {
      console.log('토스 로그인이 연동된 유저에요.');
      // 여기에서 토스 로그인 연동 유저에 대한 처리를 할 수 있어요.
    }
    if (result === false) {
      console.log('토스 로그인이 연동되지 않은 유저에요.');
      // 여기에서 토스 로그인 연동 유저가 아닌 경우에 대한 처리를 할 수 있어요.
    }
  } catch (error) {
    console.error(error);
  }
}
```

```tsx [React]
import { getIsTossLoginIntegratedService } from '@apps-in-toss/web-framework';

function GetIsTossLoginIntegratedServiceButton() {
  async function handleClick() {
    try {
      const result = await getIsTossLoginIntegratedService();

      if (result === undefined) {
        console.warn('지원하지 않는 앱 버전이에요.');
        return;
      }
      if (result === true) {
        console.log('토스 로그인이 연동된 유저에요.');
        // 여기에서 토스 로그인 연동 유저에 대한 처리를 할 수 있어요.
      }
      if (result === false) {
        console.log('토스 로그인이 연동되지 않은 유저에요.');
        // 여기에서 토스 로그인 연동 유저가 아닌 경우에 대한 처리를 할 수 있어요.
      }
    } catch (error) {
      console.error(error);
    }
  }

  return <button onClick={handleClick}>토스 로그인 통합 서비스 여부 확인</button>;
}
```

```tsx [React Native]
import { Button } from 'react-native';
import { getIsTossLoginIntegratedService } from '@apps-in-toss/framework';

function GetIsTossLoginIntegratedServiceButton() {
  async function handlePress() {
    try {
      const result = await getIsTossLoginIntegratedService();

      if (result === undefined) {
        console.warn('지원하지 않는 앱 버전이에요.');
        return;
      }
      if (result === true) {
        console.log('토스 로그인이 연동된 유저에요.');
        // 여기에서 토스 로그인 연동 유저에 대한 처리를 할 수 있어요.
      }
      if (result === false) {
        console.log('토스 로그인이 연동되지 않은 유저에요.');
        // 여기에서 토스 로그인 연동 유저가 아닌 경우에 대한 처리를 할 수 있어요.
      }
    } catch (error) {
      console.error(error);
    }
  }

  return <Button onPress={handlePress} title="토스 로그인 통합 서비스 여부 확인" />;
}
```

:::

## 언제 사용하면 좋을까요?

* 토스 로그인 기반 서비스에서 **게임 로그인으로 전환(마이그레이션)** 할 때
* 기존 유저와 신규 유저를 구분해 **데이터 이전/보상 처리**를 해아 할 때
* 토스 로그인 연동 여부에 따라 **서로 다른 UX를 제공**해야 할 때

## 참고사항

* `getIsTossLoginIntegratedService`는 마이그레이션 보조 API예요.
* 인증/로그인 기능은 아래를 참고하세요.
  * [토스 로그인 (`appLogin`)](/bedrock/reference/framework/로그인/appLogin.md)
  * [게임 로그인 (`getUserKeyForGame`)](/bedrock/reference/framework/게임/getUserKeyForGame.md)
