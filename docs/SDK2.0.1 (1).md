---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/시작하기/SDK2.0.1.md
---
# SDK 2.0.1 마이그레이션

SDK 2.0.1은 React Native 0.84 및 React 19 대응을 포함하는 메이저 업데이트예요.\
토스앱의 React Native 업데이트가 예정되어 있어 **SDK 1.x를 사용하는 경우 향후 정상 동작을 보장할 수 없어요.**

앱인토스 파트너사는 **SDK 2.0.1 으로 반드시 마이그레이션해 주세요.**

::: tip 주의하세요
2026년 3월 23일 이후에는 SDK 1.x로 빌드한 앱 번들을 콘솔에 업로드할 수 없어요.\
1.x 기반 프로젝트는 신규 배포 및 업데이트가 제한돼요.

기한 내 업데이트가 되지 않을 경우, 별도 연락 및 서비스 운영이 중단될 수 있어요.
:::

***

## 왜 마이그레이션이 필요한가요?

* React Native 0.72는 보안 패치와 유지보수가 종료되었어요.
* 2026년 3월 30일 토스앱이 RN 0.84 기반으로 업데이트돼요.
* 런타임 및 브리지 레벨에서 하위 버전과의 호환이 보장되지 않아요.
* 안정성과 보안을 위해 최신 버전 사용이 필요해요.

***

## 적용 대상

다음에 해당하면 마이그레이션이 필요해요:

* `@apps-in-toss/framework` 1.x 사용 프로젝트
* `@apps-in-toss/web-framework` 1.x 사용 프로젝트
* `granite build` 커맨드를 사용 중인 프로젝트

***

## 변경 사항 요약

### 1. 빌드 커맨드가 변경돼요

| 기존            | 변경        |
| --------------- | ----------- |
| `granite build` | `ait build` |

### 2. React / React Native 버전이 업데이트돼요

| 항목         | 변경 전 | 변경 후 |
| ------------ | ------- | ------- |
| React        | 18.x    | 19.2.3  |
| React Native | 0.72.x  | 0.84.0  |
| Types        | 18.x    | 19.2.3  |

### 3. 의존성 구조가 변경돼요

SDK 2.0.1에서는 React 및 React Native 버전이 업데이트되고, Granite 기반 패키지 구조가 새롭게 적용돼요.\
자동 마이그레이션 명령어를 실행하면 아래 변경 사항이 함께 반영돼요.

#### 주요 패키지 변경 내역

| 패키지              | 변경 전 | 변경 후 |
| ------------------- | ------- | ------- |
| react               | 18.x    | 19.2.3  |
| react-dom           | 18.x    | 19.2.3  |
| react-native        | 0.72.x  | 0.84.0  |
| @types/react        | 18.x    | 19.2.3  |
| @types/react-dom    | 18.x    | 19.2.3  |
| react-test-renderer | 18.x    | 19.2.3  |

#### Granite 관련 패키지

| 패키지                            | 변경 전 | 변경 후 |
| --------------------------------- | ------- | ------- |
| @granite-js/react-native          | -       | 1.0.4   |
| @granite-js/native                | -       | 1.0.4   |
| @granite-js/plugin-core           | -       | 1.0.4   |
| @granite-js/plugin-env            | -       | 1.0.4   |
| @granite-js/plugin-hermes         | -       | 1.0.4   |
| @granite-js/plugin-router         | -       | 1.0.4   |
| @granite-js/plugin-micro-frontend | -       | 1.0.4   |
| @granite-js/plugin-sentry         | -       | 1.0.4   |
| babel-preset-granite              | -       | 1.0.3   |
| @toss/tds-react-native            | -       | 2.0.1   |
| brick-module                      | -       | 0.5.0   |

***

## WebView 마이그레이션

### 1. 프레임워크를 2.0.1으로 업데이트해 주세요

`@apps-in-toss/web-framework`의 버전을 **2.0.1**으로 업데이트해 주세요.

```bash
# yarn
yarn add @apps-in-toss/web-framework@2.0.1

# pnpm
pnpm add @apps-in-toss/web-framework@2.0.1
```

### 2. 빌드 커맨드를 변경해 주세요

| 기존            | 변경        |
| --------------- | ----------- |
| `granite build` | `ait build` |

***

## React Native 마이그레이션

### 1. 프레임워크를 2.0.1으로 업데이트해 주세요

`@apps-in-toss/framework`의 버전을 **2.0.1**으로 업데이트해 주세요.

```bash
# yarn
yarn add @apps-in-toss/framework@2.0.1

# pnpm
pnpm add @apps-in-toss/framework@2.0.1
```

### 2. 자동 마이그레이션을 실행해 주세요

```bash
# yarn
yarn ait migrate react-native-0-84-0

# npx
npx ait migrate react-native-0-84-0

# pnpm
pnpm ait migrate react-native-0-84-0
```

다음 항목이 자동으로 반영돼요:

* `package.json` 의존성 버전 업데이트
* `babel.config.js` 설정 업데이트
* `granite build` → `ait build` 변경

### 3. 타입 오류를 확인해 주세요

React 19 및 React Native 0.84로 업그레이드로 일부 타입 정의가 변경되었어요.

마이그레이션 이후 아래 항목을 꼭 확인해 주세요:

* `React.FC` 관련 타입 오류
* `children` 타입 정의 변경
* React 19 신규 API와의 충돌 여부
* Strict Mode 관련 경고

[React 19 업그레이드 가이드 문서](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)를 참고해 주세요.

***

## 테스트 안내

* RN 0.84 대응을 위해 **2026년 3월 6일 업로드된 최신 샌드박스 앱이 배포되었어요.**
* 반드시 **3월 6일 업로드 버전 이상의 샌드박스 앱으로 테스트해 주세요.**

[최신 샌드박스 앱 다운로드 받기](/development/test/sandbox.html)

> 현재 토스앱 환경에서는 RN 0.84 대응 테스트가 불가해요.\
> 반드시 샌드박스 앱에서 테스트해 주세요.

구버전 샌드박스 앱에서는 RN 0.84 환경 검증이 정상적으로 이루어지지 않을 수 있어요.\
테스트 전 샌드박스 앱 버전을 꼭 확인해 주세요.

::: tip 참고하세요
미니앱 런칭 전 내부 검수 단계에서는 RN 0.84가 적용된 토스앱 환경에서 별도 테스트가 진행될 예정이에요.
:::

***

## 마이그레이션 체크리스트

* &#x20;SDK 2.0.1 으로 업데이트했어요
* &#x20;`ait migrate react-native-0-84-0`를 실행했어요
* &#x20;타입 오류를 모두 수정했어요
* &#x20;`ait build`로 빌드가 정상 동작해요
* &#x20;최신 샌드박스 환경에서 테스트를 완료했어요

***

## 자주 묻는 질문

### Q. SDK 1.x를 계속 사용하면 어떻게 되나요?

토스앱 RN 0.84 업데이트 이후 정상 동작을 보장할 수 없어요.\
2026년 3월 23일 이후에는 1.x로 빌드한 번들을 콘솔에 업로드할 수 없어요.

기한을 지키지 않을 경우 별도 연락 및 서비스 운영이 중단될 수 있어요.

### Q. 자동 마이그레이션 후에도 오류가 발생해요.

React 19 및 RN 0.84 변경으로 인해 일부 수동 수정이 필요할 수 있어요.\
빌드 로그를 확인해 타입 및 의존성 충돌을 해결해 주세요.

***

## 문의

마이그레이션 관련 문의는 채널톡 또는 커뮤니티를 통해 문의해 주세요.
