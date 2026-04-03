---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/속성
  제어/webview-props.md
---

# WebView의 속성 제어하기

웹으로 개발한 미니앱은 내부적으로 **WebView 환경에서 실행**돼요.\
이 문서에서는 WebView의 동작 방식을 제어하기 위해\
`granite.config.ts`에서 설정할 수 있는 `webViewProps` 옵션들을 설명해요.

스크롤 동작, 미디어 재생 방식, 제스처 사용 여부 등\
**사용자 경험에 직접적인 영향을 주는 WebView 속성**을 상황에 맞게 조정할 수 있어요.

## WebView 속성 설정 방법

WebView 속성은 `granite.config.ts` 파일의 `webViewProps` 항목에서 설정해요.

```ts
export default defineConfig({
  webViewProps: {
    // WebView 동작 관련 옵션
  },
});
```

## 사용 가능한 WebView 속성

아래는 `webViewProps`에서 설정할 수 있는 주요 옵션들이에요.

### 인라인 미디어 재생 허용 (`allowsInlineMediaPlayback`)

HTML5 비디오를 **전체 화면이 아닌 WebView 내부에서 인라인으로 재생할지** 여부를 설정해요.\
iOS 전용 속성이며, `true`로 설정한 뒤 `<video>` 태그에 `webkit-playsinline` 속성이 있어야 인라인 재생이 가능해요.

* **타입**: `boolean`
* **기본값**: `false`
* **플랫폼**: iOS

### 스크롤 바운스 효과 사용 (`bounces`)

스크롤 영역의 끝에 도달했을 때 **튕기는 바운스 효과**를 사용할지 설정해요.\
iOS 전용 속성이며 기본값은 `true`예요.

* **타입**: `boolean`
* **기본값**: `true`
* **플랫폼**: iOS

### 당겨서 새로고침 활성화 (`pullToRefreshEnabled`)

아래로 당겨서 새로고침하는 **Pull-to-Refresh 동작**을 활성화할지 설정해요.\
iOS 전용 옵션이며, 기본값은 `true`예요.

이 값을 `true`로 설정하면 `bounces` 옵션도 자동으로 `true`로 설정돼요.

* **타입**: `boolean`
* **기본값**: `true`
* **플랫폼**: iOS

### 오버스크롤 동작 방식 설정 (`overScrollMode`)

스크롤 콘텐츠의 끝에 도달했을 때 Android에서 **오버스크롤(over-scroll) 효과를 어떻게 처리할지** 설정해요.

* **타입**: `'never'` | `'always'` | `'auto'`
* **기본값**: `'always'`
* **플랫폼**: Android
* **참고 문서**: [Android 공식 문서](https://developer.android.com/reference/android/view/View#OVER_SCROLL_NEVER)

### 미디어 자동 재생 제한 (`mediaPlaybackRequiresUserAction`)

오디오 또는 비디오가 **자동으로 재생되지 않도록 제한**할지 설정해요.\
이 값을 `true`로 설정하면 사용자가 직접 탭해야 미디어가 재생돼요.

Android에서는 **버전 17 이상**에서만 이 옵션이 적용돼요.

* **타입**: `boolean`
* **기본값**: `true`
* **플랫폼**: iOS, Android
* **참고 문서**: [react-native-webview mediaPlaybackRequiresUserAction](https://github.com/react-native-webview/react-native-webview/blob/v13.6.2/docs/Reference.md#mediaplaybackrequiresuseraction)

### 스와이프 뒤로가기/앞으로가기 허용 (`allowsBackForwardNavigationGestures`)

좌우 스와이프 제스처로 **뒤로 가기 / 앞으로 가기 탐색**을 허용할지 설정해요.\
이 값을 `false`로 설정하면 사용자가 스와이프 제스처로 페이지 이동을 할 수 없어요.

* **타입**: `boolean`
* **기본값**: `true`
* **플랫폼**: iOS
* **참고 문서**: [react-native-webview allowsBackForwardNavigationGestures](https://github.com/react-native-webview/react-native-webview/blob/v13.6.2/docs/Reference.md#allowsBackForwardNavigationGestures)

## 설정 예시

아래 예시는 WebView의 스크롤 동작과 미디어 재생 방식을 함께 설정한 예시예요.

```tsx
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 기타 설정
  webViewProps: {
    bounces: true,
    pullToRefreshEnabled: true,
    allowsInlineMediaPlayback: false,
    overScrollMode: 'never',
  },
});
```

## 참고사항

* 일부 WebView 속성은 **iOS 또는 Android 전용**이에요. 플랫폼별 동작 차이를 꼭 확인하세요.
* 사용자 경험에 영향을 크게 주는 옵션(스크롤, 제스처, 자동 재생)은 서비스 성격(게임/비게임, 콘텐츠 소비/입력 중심)에 맞춰 신중히 설정하는 것을 권장해요.
* WebView 속성은 런타임이 아닌 **설정 단계에서만 적용**돼요.
