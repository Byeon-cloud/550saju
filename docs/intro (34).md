---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/시작하기/intro.md
description: 앱인토스 Granite에 대해 소개하고 있습니다.
---

# 개요

::: tip 마이그레이션 필수 안내
앱인토스 파트너사는 **SDK 2.0.1으로 반드시 마이그레이션해 주세요.**\
SDK 2.0.1은 React Native 0.84 및 React 19를 대응하며, 2026년 3월 23일 이후에는 SDK 1.x로 빌드한 번들을 콘솔에 업로드할 수 없어요.\
RN 0.84 테스트는 **2026년 3월 6일 업로드된 최신 샌드박스 앱**에서 진행해 주세요.\
자세한 마이그레이션 방법은 [SDK 2.0.1 마이그레이션 가이드](/bedrock/reference/framework/시작하기/SDK2.0.1.html)을 참고해 주세요.
:::

앱인토스 SDK는 **토스 앱 내에서 미니앱을 빠르게 구축하기 위한 WebView 및 React Native용 런타임 프레임워크**예요.\
SDK의 코어는 `Granite`이며, 앱 실행 환경을 초기화하고 토스 앱과의 통신을 담당하는 **공통 런타임 레이어**예요.

현재 앱인토스 SDK는 **WebView SDK**와 **React Native SDK** 두 가지 형태로 제공돼요.\
이 문서에서는 `Granite`의 핵심 구성요소인 `AppsInToss`와,\
앱이 실행될 때 네이티브(Android / iOS)에서 전달되는 초기 데이터(`InitialProps`)를 중심으로 설명해요.

## 시그니처

### `AppsInToss`

```typescript
AppsInToss: {
    registerApp(
      AppContainer: ComponentType<PropsWithChildren<InitialProps>>,
      { appName, context, router }: BedrockProps
    ): (initialProps: InitialProps) => JSX.Element;
    readonly appName: string;
}
```

### `InitialProps`

```typescript
type InitialProps = AndroidInitialProps | IOSInitialProps;
```

## AppsInToss

`AppsInToss.registerApp`은 서비스의 기본 환경을 설정하고, 복잡한 초기 구성 없이 개발을 빠르게 시작하도록 도와줘요.\
**`appName`만 전달해도** 파일 기반 라우팅, 쿼리 파라미터 처리, 뒤로 가기, 화면 가시성 감지 등 핵심 기능을 즉시 사용할 수 있어요.

### 제공 기능

* **파일 기반 라우팅**: Next.js처럼 경로와 URL이 자동 매핑돼요.
  * `/my-service/pages/home.ts` → `intoss://my-service/home`
* **쿼리 파라미터 처리**: URL 스킴 파라미터(referrer 등)를 바로 사용 가능
* **뒤로 가기 제어**: 뒤로 가기 이벤트를 가로채 다이얼로그 표시나 화면 닫기 처리 가능
* **화면 가시성 감지**: 화면이 보이거나 가려지는 이벤트에 맞춰 동작 제어 가능

### 프로퍼티

### 예제: 앱 등록하기

```tsx
import { AppsInToss } from '@apps-in-toss/framework';
import { PropsWithChildren } from 'react';
import { InitialProps } from '@granite-js/react-native';
import { context } from '../require.context';

function AppContainer({ children }: PropsWithChildren<InitialProps>) {
  return <>{children}</>;
}

// 앱 이름과 context만 전달하면 기본 설정이 완료돼요.
export default AppsInToss.registerApp(AppContainer, { context });
```

## InitialProps

React Native 앱에서 사용자가 특정 화면으로 진입할 때, 네이티브(Android/iOS)가 앱으로 전달하는 **초기 데이터 타입**이에요.\
플랫폼별 구조가 다르고, 초기 렌더링과 상태 설정에 필요한 핵심 정보가 포함돼요.

* Android: `AndroidInitialProps`
* iOS: `IOSInitialProps`

### 프로퍼티

### 예제: 초기 데이터 활용하기

```tsx
import { AppsInToss } from '@apps-in-toss/framework';
import { PropsWithChildren } from 'react';
import { InitialProps } from '@granite-js/react-native';
import { context } from '../require.context';

function AppContainer({ children, ...initialProps }: PropsWithChildren<InitialProps>) {
  // 화면 진입 시 네이티브가 내려준 초기값을 활용할 수 있어요
  console.log({ initialProps });
  return <>{children}</>;
}

export default AppsInToss.registerApp(AppContainer, { context });
```
