---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/style-utils/padding.md
---

# padding

`padding`은 컴포넌트의 **안쪽 여백**을 간결하게 지정하는 유틸이에요.\
가로(`x`), 세로(`y`), 개별 방향(`top`, `right`, `bottom`, `left`)으로 숫자 값을 줄 수 있고,\
자주 쓰는 고정 값 프리셋(`x8`, `y16` 등)도 바로 사용할 수 있어요.

## 시그니처

```typescript
padding: BoxSpacing
```

## 프로퍼티

아래 항목들은 모두 스타일 객체를 반환하며, 컴포넌트의 style에 그대로 전달해 사용해요.
숫자 단위는 React Native의 일반적인 숫자 단위(dp)를 따릅니다.

## 프리셋

동일 패턴의 **고정 값 프리셋**을 제공해요. (지원 값 예: `4 | 8 | 12 | 16 | 24 | 32`)

* `padding.x8` → `{ paddingHorizontal: 8 }`
* `padding.y16` → `{ paddingVertical: 16 }`
* `padding.top24`, `padding.right4`, `padding.bottom12`, `padding.left32` 등

## 예제

#### 가로·세로 프리셋 + 임의 값 혼합 사용

```tsx
import { View, Text } from 'react-native';
import { padding } from '@granite-js/react-native';

function Component() {
  return (
    <View>
      <View style={padding.x8}>
        <Text>가로 안쪽 여백이 있어요</Text>
      </View>

      <View style={padding.y8}>
        <Text>세로 안쪽 여백이 있어요</Text>
      </View>

      <View style={padding.bottom(100)}>
        <Text>아래에 100만큼의 안쪽 여백이 있어요</Text>
      </View>
    </View>
  );
}
```

#### StyleSheet와 함께 쓰기

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { padding } from '@granite-js/react-native';

const styles = StyleSheet.create({
  card: {
    ...padding.y16,          // 세로 16
    ...padding.x12,          // 가로 12
  },
  footer: {
    ...padding.top24,        // 위 24
    ...padding.left8,        // 왼 8
  },
});

function Card() {
  return (
    <View style={styles.card}>
      <Text>콘텐츠</Text>
      <View style={styles.footer}>
        <Text>푸터</Text>
      </View>
    </View>
  );
}
```

## 참고사항

* `padding.*`은 `React Native`의 `padding*` 스타일을 **얇게 감싼 헬퍼**예요.
* 프리셋은 팀 내 디자인 간격 체계를 빠르게 일관 적용하기 좋고,\
  함수형(`padding.top(6)`)은 비정형 간격이 필요할 때 유용해요.
