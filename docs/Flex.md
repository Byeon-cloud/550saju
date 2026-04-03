---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/style-utils/Flex.md
---

# Flex

`Flex`는 자식 요소를 **Flexbox 레이아웃** 기반으로 배치하는 레이아웃 컴포넌트예요.\
가로와 세로 방향 배치, 정렬, 중앙 정렬을 간편하게 구성할 수 있어요.\
또한, `Flex.Center`, `Flex.CenterVertical`, `Flex.CenterHorizontal` 컴포넌트를 제공해요.

### 시그니처

```typescript
Flex: FlexType
```

### 파라미터

### 예제 : 가로, 세로 방향으로 요소를 배치하기

```tsx
import { Flex } from '@granite-js/react-native';
import { Text } from 'react-native';

function FlexExample() {
  return (
    <>
      <Flex direction="column">
        <Text>세로로 배치해요</Text>
        <Text>1</Text>
        <Text>2</Text>
        <Text>3</Text>
      </Flex>
      <Flex direction="row">
        <Text>가로로 배치해요</Text>
        <Text>1</Text>
        <Text>2</Text>
        <Text>3</Text>
      </Flex>
    </>
  );
}
```

## 가로와 세로 모두 중앙 정렬하기 (`Flex.Center`)

`Flex.Center`는 자식 요소를 **가로와 세로 모두 중앙**에 배치하는 컴포넌트예요.\
내부적으로 `justifyContent: 'center'`, `alignItems: 'center'` 를 설정해요.

### 예제

```tsx
import { Flex } from '@granite-js/react-native';
import { Text } from 'react-native';

function FlexCenterExample() {
  return (
    <Flex.Center style={{ width: '100%', height: 100, borderWidth: 1 }}>
      <Text>정 중앙에 배치해요</Text>
    </Flex.Center>
  );
}
```

## 가로 방향으로 중앙 정렬하기 (`Flex.CenterHorizontal`)

`Flex.CenterHorizontal`은 자식 요소를 가로 방향 중앙에 배치하는 컴포넌트예요.\
`alignItems: 'center'`가 기본으로 적용돼요.

### 예제

```tsx
import { Flex } from '@granite-js/react-native';
import { Text } from 'react-native';

function FlexCenterHorizontalExample() {
  return (
    <Flex.CenterHorizontal style={{ width: '100%', height: 100, borderWidth: 1 }}>
      <Text>가로 중앙에 배치해요</Text>
    </Flex.CenterHorizontal>
  );
}
```

## 세로 방향으로 중앙 정렬하기 (`Flex.CenterVertical`)

`Flex.CenterVertical`은 자식 요소를 세로 방향 중앙에 배치하는 컴포넌트예요.\
`justifyContent: 'center'`가 기본으로 적용돼요.

### 예제

```tsx
import { Flex } from '@granite-js/react-native';
import { Text } from 'react-native';

function FlexCenterVerticalExample() {
  return (
    <Flex.CenterVertical style={{ width: '100%', height: 100, borderWidth: 1 }}>
      <Text>세로 중앙에 배치해요</Text>
    </Flex.CenterVertical>
  );
}
```

## 참고사항

* `Flex` 계열 컴포넌트는 `React Native` 의 `Flexbox` 속성을 간결하게 감싸 제공해요.
* Flex.Center 계열 컴포넌트를 사용하면 반복적인 중앙 정렬 코드를 단순화할 수 있어요.
* `direction`, `align`, `justify` 속성으로 세밀한 레이아웃 조정도 가능해요.
