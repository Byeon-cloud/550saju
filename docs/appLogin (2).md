---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/로그인/appLogin.md
---

# 토스 로그인 (`appLogin`) - 인가 코드 받기

`appLogin`은 토스 앱의 인증 흐름을 사용해 로그인을 수행하고,\
로그인이 성공하면 **인가 코드(`authorizationCode`)** 를 반환해요.

::: tip 주의하세요
이 단계는 **클라이언트(미니앱)** 에서 인가 코드를 얻는 역할만 수행합니다.\
인가 코드를 받은 뒤의 **토큰 교환 / access token 발급 / 사용자 정보 조회**는 반드시 **서버**에서 처리해야 합니다.\
서버 연동 방법은 [토스 로그인의 "개발하기" 문서](/login/develop.md)를 참고하세요.
:::

## 시그니처

```typescript
function appLogin(): Promise<{
  authorizationCode: string;
  referrer: 'DEFAULT' | 'SANDBOX';
}>;
```

## 반환 값

## 주의사항

* `authorizationCode`는 **클라이언트에서 장기간 저장하지 마세요.** (유효시간: 10분)
* **반드시 서버로 전송**하여 서버에서 토큰 교환(API: `/api-partner/v1/apps-in-toss/user/oauth2/generate-token`)을 실행하세요.
* 인가 코드는 **일회성**이며, 재사용하면 실패합니다.
* 민감한 정보(`AccessToken`, `RefreshToken` 등)는 **서버에서 안전하게 보관하세요.**

## 예제 : 토스 인증을 통해 로그인을 하는 예제

::: code-group

```js [js]
import { appLogin } from '@apps-in-toss/web-framework';

async function handleLogin() {
  const { authorizationCode, referrer } = await appLogin();

  // 획득한 인가 코드(`authorizationCode`)와 `referrer`를 서버로 전달해요.
}
```

```tsx [React]
import { appLogin } from '@apps-in-toss/web-framework';
import { Button } from '@toss/tds-mobile';

function Page() {
  async function handleLogin() {
    const { authorizationCode, referrer } = await appLogin();

    // 획득한 인가 코드(`authorizationCode`)와 `referrer`를 서버로 전달해요.
  }

  return (
    <Button size="medium" onClick={handleLogin}>
      로그인
    </Button>
  );
}
```

```tsx [React Native]
import { appLogin } from '@apps-in-toss/framework';
import { Button } from '@toss/tds-react-native';

function Page() {
  async function handleLogin() {
    const { authorizationCode, referrer } = await appLogin();

    // 획득한 인가 코드(`authorizationCode`)와 `referrer`를 서버로 전달해요.
  }

  return <Button onPress={handleLogin}>로그인</Button>;
}
```

:::

### 예제 앱 체험하기

[apps-in-toss-examples](https://github.com/toss/apps-in-toss-examples) 저장소에서 [with-app-login](https://github.com/toss/apps-in-toss-examples/tree/main/with-app-login) 코드를 내려받아 체험해 보세요.
