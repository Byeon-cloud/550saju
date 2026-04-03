---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/style-utils/Spacing.md
---

# Spacing

`Spacing`은 빈 공간을 차지해 **가로 또는 세로 방향으로 여백을 추가**하는 컴포넌트예요.\
화면 요소 사이의 간격을 일정하게 맞추거나, 시각적인 구분을 줄 때 사용해요.

## 시그니처

```typescript
Spacing: import("react").NamedExoticComponent<Props>
```

## 파라미터

## 예제

#### 세로 방향으로 여백 추가하기

```tsx
import { View, Text } from 'react-native';
import { Spacing } from '@granite-js/react-native';

function VerticalSpacingExample() {
  return (
    <View>
      <Text>Top</Text>
      <Spacing size={16} direction="vertical" style={{ backgroundColor: 'red', width: 5 }} />
      <Text>Bottom — 세로 여백만큼 아래에 위치해요</Text>
    </View>
  );
}
```

#### 가로 방향으로 여백 추가하기

```tsx
import { View, Text } from 'react-native';
import { Spacing } from '@granite-js/react-native';

function HorizontalSpacingExample() {
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text>Left</Text>
      <Spacing size={16} direction="horizontal" style={{ backgroundColor: 'red', height: 5 }} />
      <Text>Right — 가로 여백만큼 옆에 위치해요</Text>
    </View>
  );
}
```

## 참고사항

* `Spacing`은 `margin`이나 `padding` 대신 명시적으로 간격을 줄 때 유용해요.
* `direction` 속성을 통해 한쪽 방향의 여백만 적용할 수 있어요.
* `size` 값은 숫자(px 단위)로 지정하며, 반응형 간격이 필요할 경우 `StyleSheet`와 함께 사용할 수 있어요.
