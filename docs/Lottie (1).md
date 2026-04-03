---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Lottie.md
---

# Lottie

`Lottie` 컴포넌트를 사용하면 Lottie JSON 파일을 불러와 애니메이션을 재생할 수 있어요.\
높이를 필수로 지정해야 레이아웃 시프트(Layout Shift)를 방지할 수 있어요.

## 시그니처

```typescript
function Lottie({ width, maxWidth, height, src, autoPlay, speed, style, onAnimationFailure, ...props }: Props): import("react/jsx-runtime").JSX.Element;
```

### 파라미터

### 반환 값

## 예제

### Lottie 애니메이션 렌더링하기

아래 예시는 Lottie 애니메이션을 불러와 재생하고,\
애니메이션 로드 실패 및 종료 시 각각 로그를 출력하는 방법을 보여줘요.

```tsx
import { Lottie } from '@granite-js/react-native';

function LottieExample() {
 return (
   <Lottie
     height={100}
     src="https://my-lottie-animation-url.com"
     autoPlay={true}
     loop={false}
     onAnimationFailure={() => {
       console.log('Animation Failed');
     }}
     onAnimationFinish={() => {
       console.log('Animation Finished');
     }}
   />
 );
```

## 참고사항

* `height`는 반드시 지정해야 레이아웃 시프트가 발생하지 않아요.
* 애니메이션이 정상적으로 동작하지 않으면 `onAnimationFailure` 콜백을 통해 에러 로그를 확인할 수 있어요.
