---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/BlurView.md
---

# BlurView

`BlurView` 컴포넌트는 **iOS에서만 지원되는 블러(Blur) 효과**를 제공해요.\
배경을 흐리게 처리하거나, [Vibrancy 효과](https://developer.apple.com/documentation/uikit/uivibrancyeffect?language=objc)를 적용해 콘텐츠를 더 생동감 있게 표현할 수 있어요.\
Android에서는 블러 효과가 적용되지 않고 기본 [`View`](https://reactnative.dev/docs/0.72/view)가 렌더링돼요.

## 시그니처

```typescript
function BlurView({ blurType, blurAmount, reducedTransparencyFallbackColor, vibrancyEffect, ...viewProps }: BlurViewProps): import("react/jsx-runtime").JSX.Element;
```

### 파라미터

### 반환 값

::: tip 유의할 점
`BlurView`는 iOS 5.126.0 이상에서만 블러 효과를 지원해요.\
Android에서는 기본 `View`가 렌더링되며, 블러 효과가 적용되지 않아요.
:::

## 예제

### BlurView로 텍스트 블러 처리하기

아래 예시는 텍스트 위에 `BlurView`를 겹쳐 배경을 흐리게 처리하는 방법을 보여줘요.

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from '@granite-js/react-native';

function BlurViewExample() {
 return (
   <View style={styles.container}>
     <Text style={styles.absolute}>Blurred Text</Text>
     <BlurView style={styles.absolute} blurType="light" blurAmount={1} />
     <Text>Non Blurred Text</Text>
   </View>
 );
}

const styles = StyleSheet.create({
 container: {
   justifyContent: 'center',
   alignItems: 'center',
   width: '100%',
   height: 300,
 },
 absolute: {
   position: 'absolute',
   top: 0,
   left: 0,
   bottom: 0,
   right: 0,
 },
});
```

## 참고

* [iOS Vibrancy Effect Documentation](https://developer.apple.com/documentation/uikit/uivibrancyeffect)
* [Zeddios Blog 설명](https://zeddios.tistory.com/1140)
