---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/환경
  변수/env.md
---

# 환경 변수 설정 (React Native)

`plugin-env`는 **React Native 미니앱에서 빌드 시점에 환경 변수를 주입**하고,\
`import.meta.env` 형태로 손쉽게 접근할 수 있도록 도와주는 플러그인이에요.

API 키, 환경 구분 값(staging / production)처럼\
**코드에 직접 노출되면 안 되는 값이나 환경별로 달라지는 값**을 관리할 때 사용해요.

이 플러그인은 **React Native 환경에서만 사용 가능**하며,\
`@granite-js/react-native` 기반의 설정 파일(`granite.config.ts`)에서만 설정할 수 있어요.

## 설치하기

패키지 매니저에 따라 아래 명령어 중 하나를 실행해 설치할 수 있어요.

```bash
# npm을 사용하는 경우
npm install '@granite-js/plugin-env';

# yarn을 사용하는 경우
yarn add '@granite-js/plugin-env';

# pnpm을 사용하는 경우
pnpm add '@granite-js/plugin-env';
```

## 사용 예시

아래는 `plugin-env`를 사용해 React Native 프로젝트에서 환경 변수를 등록하고 사용하는 예제예요.

```tsx [React Native]
// granite config
import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';
import { env } from '@granite-js/plugin-env';

export default defineConfig({
  scheme: 'intoss',
  appName: 'my-granite-app',
  plugins: [
    appsInToss({
      brand: {
        displayName: 'my-granite-app', // 화면에 노출될 앱의 한글 이름으로 바꿔주세요.
        primaryColor: '#3182F6', // 화면에 노출될 앱의 기본 색상으로 바꿔주세요.
        icon: '', // 화면에 노출될 앱의 아이콘 이미지 주소로 바꿔주세요.
      },
      permissions: [],
    }),
    env({ MY_ENV_VAR: 'Hello, World!' }),
  ],
});

// service
import.meta.env.MY_ENV_VAR; // 'Hello, World!'
```

## 참고사항

* 환경 변수는 런타임이 아닌 **빌드 시점에 고정**돼요.
* 여러 환경(`staging`, `production`)을 구분해야 한다면\
  `env()`에 환경별 객체를 전달하거나 `.env` 파일과 함께 사용하는 방식을 권장해요.
