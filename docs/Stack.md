---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/style-utils/Stack.md
---

# Stack

`Stack`은 자식 요소를 **가로 또는 세로 방향으로 일정 간격을 두고 배치**하는 레이아웃 컴포넌트예요.\
`direction` 속성으로 방향을 설정하고, `gutter` 속성으로 요소 간 간격을 조절할 수 있어요.\
가로 배치는 `Stack.Horizontal`, 세로 배치는 `Stack.Vertical`로 간편하게 사용할 수 있어요.

### 시그니처

```typescript
Stack: StackType
```

### 파라미터

### 예제 : 가로·세로 방향으로 배치하기

```tsx
import { Text } from 'react-native';
import { Stack } from '@granite-js/react-native';

function StackExample() {
  return (
    <>
      <Stack gutter={16} direction="horizontal">
        <Text>16간격을 두고 가로 방향으로 배치해요</Text>
        <Text>1</Text>
        <Text>2</Text>
        <Text>3</Text>
      </Stack>
      <Stack gutter={16} direction="vertical">
        <Text>16간격을 두고 세로 방향으로 배치해요</Text>
        <Text>1</Text>
        <Text>2</Text>
        <Text>3</Text>
      </Stack>
    </>
  );
}
```

## 가로로 배치하기 (`Stack.Horizontal`)

`Stack.Horizontal`은 자식 요소를 **가로 방향**으로 쌓아 배치해요.\
`gutter` 속성으로 간격을 설정해 일정한 가로 레이아웃을 유지할 수 있어요.

### 예제

```tsx
import { Stack } from '@granite-js/react-native';
import { View, Text } from 'react-native';

function StackHorizontalExample() {
  return (
       <Stack.Horizontal gutter={16}>
        <Text>16간격을 두고 가로 방향으로 배치해요</Text>
        <Text>1</Text>
        <Text>2</Text>
        <Text>3</Text>
      </Stack.Horizontal>
  );
}
```

## 세로로 배치하기 (`Stack.Vertical`)

`Stack.Vertical`은 자식 요소를 **세로 방향**으로 쌓아 배치해요.\
`gutter` 속성으로 요소 간의 간격을 쉽게 제어할 수 있어요.

### 예제

```tsx
import { Stack } from '@granite-js/react-native';
import { View, Text } from 'react-native';

function StackVerticalExample() {
  return (
       <Stack.Vertical gutter={16}>
        <Text>16간격을 두고 세로 방향으로 배치해요</Text>
        <Text>1</Text>
        <Text>2</Text>
        <Text>3</Text>
      </Stack.Vertical>
  );
}
```

## 참고사항

* Stack은 `Flexbox` 기반으로 구성되어 있어요.
* `gutter`를 통해 일정한 간격을 유지할 수 있고, React 컴포넌트를 전달해 커스텀 간격도 만들 수 있어요.
* `Stack.Horizontal`과 `Stack.Vertical`을 사용하면 가로·세로 레이아웃을 더 간결하게 구성할 수 있어요.
