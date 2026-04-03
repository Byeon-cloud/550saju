---
url: 'https://developers-apps-in-toss.toss.im/game-login/migration.md'
---
# 토스 로그인 마이그레이션

**토스 로그인(`userKey`)** 을 사용하는 미니앱을 **게임 로그인(`hash`)** 으로 전환하는 방법을 안내해요.

이 문서를 따라 하면, 현재 토스 로그인을 쓰는 유저를 점진적으로 게임 로그인으로 매핑하고,\
모든 유저가 이전되면 토스 로그인 의존성을 완전히 제거할 수 있어요.

## 언제 이 가이드를 사용하나요?

* 기존에 토스 로그인 `userKey` 로 사용자 식별을 하고 있어요.
* 앞으로는 게임 로그인 `hash`값을 표준 식별자로 쓰고 싶어요.
* 토스 로그인 과정에서의 이탈을 줄이고 싶어요.

::: tip 게임이라면 반드시 게임 로그인을 사용해주세요
토스 로그인은 약관 동의 과정에서 **이탈율이 높습니다.**\
게임 로그인으로 전환하면 사용자 접근성과 전환율을 크게 개선할 수 있어요.
:::

## 핵심 개념

* **게임 로그인 hash**: [`getUserKeyForGame()`](/bedrock/reference/framework/게임/getUserKeyForGame.html) 호출로 발급되는 게임용 고유 식별자
* **토스 로그인 userKey**: 기존 토스 로그인 기반 사용자 식별자
* **매핑**: 동일 사용자의 `userKey` 와 `hash` 값을 1:1로 연결한 상태

> ⚠️ 각 게임별로 `hash` 값은 상이합니다.

## 전체 전환 흐름

1. 클라이언트에서 `getUserKeyForGame()` 으로 게임 `hash` 값을 발급받아요.
2. `getIsTossLoginIntegratedService()` 으로 토스 로그인 연동 여부를 확인해요.
3. 파트너사 서버에 매핑 여부를 조회해요.
4. 매핑되지 않았다면 `appLogin()` 을 통해 토스 로그인을 진행하고, `hash` 값을 서버로 전송해요.
5. 서버에서 토스 로그인 `userKey` 와 게임 로그인 `hash` 값을 매핑 테이블에 저장해요.
6. 이후에는 `hash` 값만으로 사용자를 식별할 수 있어요. 모든 유저가 매핑되면 토스 로그인 의존성을 제거하세요.

## 사전 구현이 필요한 API

파트너사는 아래 두 가지 API를 **직접 구현해야 해요.**\
이 API들은 앱인토스에서 제공하지 않으며, 아래 예시를 참고해 파트너사 서버에서 자체적으로 개발해 주세요.

* **매핑 여부 조회**
  * `POST /api/auth/migration/status`
  * **Req**: `{ hash: string }`
  * **Res**: `{ isMapped: boolean }`

* **매핑 생성**
  * `POST /api/auth/migration/link`
  * **Req**: `{  hash: string; authorizationCode: string; referrer?: string }`
  * **Res**: `{ success: true }`

***

## 클라이언트 구현 단계

### 1. SDK 가져오기

```tsx
import { getUserKeyForGame, getIsTossLoginIntegratedService, appLogin } from '@apps-in-toss/web-framework';
```

### 2. 게임 hash 값 발급

```tsx
  const result = await getUserKeyForGame();
  if (!result) return console.warn('지원하지 않는 앱 버전이에요.');
  if (result === 'INVALID_CATEGORY') return console.error('게임 카테고리가 아닌 미니앱이에요.');
  if (result === 'ERROR') return console.error('사용자 키 조회 중 오류가 발생했어요.');
  if (result.type !== 'HASH') return console.error('알 수 없는 반환값입니다.');
  const { hash } = result;
```

### 3. 토스 로그인 연동 여부 확인

```tsx
  const status = await getIsTossLoginIntegratedService();
  if (status === 'INVALID_CLIENT') {
    console.log('토스 로그인이 연동되어 있지 않은 미니앱이에요.');
    return;
  }
```

자세한 내용은 [토스 로그인 연동 확인](/bedrock/reference/framework/로그인/getIsTossLoginIntegratedService.md) 문서를 확인해주세요.

### 4. 파트너사 서버에 매핑 여부 조회 및 매핑

```tsx
  if (status === true) { // 토스 로그인 연동된 유저
    const { isMapped } = await fetch('/api/auth/migration/status', { // 매핑 여부 확인
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash }),
    }).then((r) => r.json());

    if (!isMapped) {
      const { authorizationCode, referrer } = await appLogin(); // 미매핑이면 토스 로그인 후 매핑 생성
      await fetch('/api/auth/migration/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizationCode, referrer, hash }),
      });
    }

    console.log('매핑 완료 또는 이미 매핑된 사용자에요.');
    return;
  } 

  console.log ('토스 로그인 미연동 사용자에요.') // status === false
  
```

### 5. 게임 로그인 hash 사용

이제 사용자 식별은 게임 로그인 `hash`값을 기준으로 하면 됩니다.\
토스로그인 `userKey` 대신, `getUserKeyForGame()` 으로 발급받은 게임 `hash`값을 서버와 클라이언트 모두에서 사용자 식별자로 사용하세요.

## 전체 예시 코드

```tsx
import { getUserKeyForGame, getIsTossLoginIntegratedService, appLogin } from '@apps-in-toss/web-framework';

async function migrateIfNeeded() {
  const res = await getUserKeyForGame();
  if (!res) return console.warn('지원하지 않는 앱 버전이에요.');
  if (res === 'INVALID_CATEGORY') return console.error('게임 카테고리가 아닌 미니앱이에요.');
  if (res === 'ERROR') return console.error('사용자 키 조회 중 오류가 발생했어요.');
  if (res.type !== 'HASH') return console.error('알 수 없는 반환값입니다.');
  const { hash } = res;

  let status: boolean;
  try {
    status = await getIsTossLoginIntegratedService();
  } catch (error: any) {
    console.error('토스 로그인 연동 여부 확인 중 오류 발생:', error);
    return;
  }

  if (status === true) {
    // 매핑 여부 조회
    const { isMapped } = await fetch('/api/auth/migration/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash }),
    }).then((r) => r.json());

    if (!isMapped) {
      // 미매핑이면 토스 로그인 후 매핑 생성
      const { authorizationCode, referrer } = await appLogin();

      await fetch('/api/auth/migration/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizationCode, referrer, hash }),
      });
    }

    console.log('매핑 완료 또는 이미 매핑된 사용자입니다.');
    return;
  }

  // status === false : 토스 로그인 기능은 있으나 현재 유저는 미연동
  console.log('토스 로그인 미연동 사용자입니다.');
}

```

### ⚠️ 예외 처리

토스 로그인을 사용하지 않는 미니앱에서\
`getIsTossLoginIntegratedService()`를 호출하면 아래 예외가 발생할 수 있어요.

```tsx
@throw {message: "oauth2ClientId 설정이 필요합니다."}
```

> 이 경우 토스 로그인 기능이 없는 환경이므로 별도 처리가 필요하지 않습니다.
