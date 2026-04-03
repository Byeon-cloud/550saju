---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Video.md
---

# Video

`Video` 컴포넌트는 앱 내에서 비디오를 재생할 수 있는 컴포넌트예요.\
앱이 백그라운드로 전환되면 자동으로 일시 정지되고,\
다른 앱에서 음악이 재생 중일 때 오디오 포커스를 적절히 제어해\
토스 앱이 그 음악을 중지시키지 않아요.

::: tip 참고하세요
`Video` 컴포넌트는 [`react-native-video` v6.0.0-alpha.6](https://github.com/TheWidlarzGroup/react-native-video/tree/v6.0.0-alpha.6)을 기반으로 동작해요.\
일부 타입이나 기능은 최신 버전과 호환되지 않을 수 있어요.
:::

## 시그니처

```typescript
Video: import("react").ForwardRefExoticComponent<Props & import("react").RefAttributes<VideoRef>>
```

### 파라미터

### 프로퍼티

### 반환 값

## 예제

### 비디오 자동 재생하기

아래 예시는 비디오를 자동 재생하는 간단한 예시예요.\
`muted`를 `true`로 설정하면 무음 상태에서 재생할 수 있어요.

```tsx
import { useRef } from 'react';
import { View } from 'react-native';
import { Video } from '@granite-js/react-native';

function VideoExample() {
  const videoRef = useRef(null);

  return (
    <View>
      <Video
        ref={videoRef}
        source={{ uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }}
        muted={true}
        paused={false}
        resizeMode="cover"
        style={{ width: 300, height: 200, borderWidth: 1 }}
      />
    </View>
  );
}
```

## 참고

* [react-native-video](https://github.com/react-native-video/react-native-video)\
  비디오 속성 및 이벤트에 대한 자세한 정보는 공식 문서를 참고해 주세요.
* [react-native-video-6.0.0-alpha.6](https://github.com/TheWidlarzGroup/react-native-video/releases/tag/v6.0.0-alpha.6)\
  현재 토스앱에 설치되어있는 버전의 소스코드에요.
