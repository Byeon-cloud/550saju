---
url: >-
  https://developers-apps-in-toss.toss.im/bedrock/reference/framework/overlay/useOverlay.md
---

# Overlay

오버레이 사용 방법을 안내해요.

오버레이(Overlay)는 **모달, 바텀시트, 다이얼로그 등 별도의 UI 레이어를 표시할 때** 사용하는 기능이에요.\
`useOverlay`와 `useOverlayBase` 훅을 사용하면 Overlay의 열림/닫힘 상태를 간단하고 안정적으로 제어할 수 있어요.

## 1. Overlay 제어하기 (`useOverlay`)

`useOverlay`는 Overlay의 열림(open)과 닫힘(close) 상태를 간단히 관리하는 훅이에요.\
뒤로가기 버튼으로 Overlay를 닫거나, 비동기적으로 Overlay를 제어하는 데 활용할 수 있어요.

### 시그니처

```typescript
function useOverlay(): {
    close: () => void;
    open: (overlayElement: CreateOverlayElement) => void;
};
```

### 반환 값

### 예제

```tsx
import { useOverlay } from '@apps-in-toss/framework';

 const overlay = useOverlay();

  const openBottomSheet = useCallback(() => {
    return new Promise<void>((resolve) => {
      overlay.open(({ isOpen, exit, close }) => {
        const handleClose = () => {
          close();
          resolve();
        };

        return (
          <BottomSheet
            open={isOpen}
            onClose={handleClose}
            onExited={exit}
            header={<BottomSheet.Header>BottomSheet V1 Header</BottomSheet.Header>}
            cta={<BottomSheet.CTA onPress={handleClose}>확인</BottomSheet.CTA>}
          >
            <View>
              <TextField size="classic" label="name" value="FOCUS ME" />
            </View>
          </BottomSheet>
        );
      });
    });
  }, []);
```

## 2. Overlay 생성·관리하기 (`useOverlayBase`)

`useOverlayBase`는 Dialog처럼 **선언형으로 Overlay를 관리**할 수 있는 훅이에요.
Promise 기반으로 동작해, Overlay의 닫힘 시점을 기준으로 이후 로직을 실행할 수 있어요.
이 훅을 사용하려면 `_app.tsx`에 `OverlayProvider`를 추가해야 해요.

### 시그니처

```typescript
function useOverlayBase({ exitOnUnmount }?: Options): {
    open: (overlayElement: CreateOverlayElement) => void;
    close: () => void;
};
```

### 파라미터

### 반환 값

### 예제

#### ① OverlayProvider 설정

`useOverlayBase`를 사용하기 전에 루트(App) 컴포넌트에 `OverlayProvider`를 등록해야 해요.

```tsx
// _app.tsx
import { OverlayProvider } from '@apps-in-toss/framework';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <OverlayProvider>
      <Component {...pageProps} />
    </OverlayProvider>
  )
}
```

#### ② Overlay 관리 예시

```tsx
// Page.tsx
import { useOverlayBase } from '@react-native-bedrock/core';

const overlay = useOverlayBase();
const openFooConfirmDialog = () => {
  return new Promise<boolean>(resolve => {
    overlay.open(({ isOpen, close }) => (
      <FooConfirmDialog
        open={isOpen}
        onClose={() => {
          resolve(false);
          close();
        }}
        onConfirm={() => {
          resolve(true);
          close();
        }}
      />
    ));
  });
};

await openFooConfirmDialog();
// ConfirmDialog의 confirmButton을 누르거나 onClose가 호출된 후
console.log('dialog closed');
```

## 참고사항

* `useOverlay`는 간단한 Overlay 제어용, `useOverlayBase`는 선언적 Overlay 관리용이에요.
* `OverlayProvider`를 루트(App) 컴포넌트에 추가해야 Overlay가 정상 동작해요.
* 여러 개의 Overlay를 동시에 다뤄야 한다면 `useOverlayBase`를 여러 번 호출하면 돼요.
* Overlay 종료 시에는 반드시 `close()` 또는 `exit()`로 명시적으로 처리해 주세요.
