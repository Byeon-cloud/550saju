/**
 * 앱인토스 네이티브 PDF 뷰어 (2026-07-28 신설)
 *
 * 배경: 앱인토스 웹뷰는 `a[download]` 가 무반응(다운로드 UI 자체가 없음)이라
 *   2026-07-03 CS("PDF 다운로드가 안 돼요") 대응으로 `window.open(url)` 로 되돌렸는데,
 *   그건 **외부 브라우저가 뜨면서 앱을 벗어나는** 동작이라 UX 가 좋지 않다.
 *   토스 SDK `openPDFViewer` 는 Base64 PDF 를 **앱 안 네이티브 뷰어**로 띄운다.
 *
 * 정책: 시도 → 실패하면 조용히 false 를 돌려주고 호출부가 기존 window.open 으로 폴백.
 *   따라서 어떤 이유로 막혀도 기존 동작 이하로 나빠지지 않는다.
 *
 * 막히는 경우(전부 폴백):
 *   · 앱인토스가 아님 / SDK 에 openPDFViewer 없음
 *   · 토스앱 5.261.0 미만 (UNSUPPORTED_APP_VERSION)
 *   · PDF 가 너무 큼 — Base64 는 원본의 약 1.34배라 브릿지 페이로드가 과대해진다
 *   · signed URL fetch 실패 (GCS 버킷 CORS 미설정 등)
 *
 * @see https://developers-apps-in-toss.toss.im (PDF 뷰어 · openPDFViewer)
 */
import { isAppsInToss } from '@/services/payment/iapService';

/** 네이티브 뷰어로 넘길 원본 PDF 크기 상한 (Base64 팽창 1.34배 감안) */
const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB → base64 약 10.7MB

/** openPDFViewer 최소 토스앱 버전 (공식 문서 기준) */
const MIN_TOSS_APP = '5.261.0' as const;

/** ArrayBuffer → Base64. 큰 버퍼에서 스택 오버플로가 나지 않도록 청크 단위로 처리. */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000; // 32KB — apply 인자 수 한계 회피
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * 네이티브 PDF 뷰어로 열기 시도.
 * @returns 성공 시 true (뷰어가 떴다가 닫힘) / 불가·실패 시 false → 호출부에서 폴백할 것
 */
export async function tryOpenNativePdf(
  url: string,
  filename: string,
  bytes?: number,
): Promise<boolean> {
  try {
    if (!isAppsInToss()) return false;
    // 크기 게이트 — 서버가 준 bytes 로 사전 차단 (모르면 fetch 후 재확인)
    if (typeof bytes === 'number' && bytes > MAX_PDF_BYTES) return false;

    const mod: any = await import('@apps-in-toss/web-framework');
    if (typeof mod.openPDFViewer !== 'function') return false;

    // 토스앱 버전 게이트 — 미달이면 브릿지가 UNSUPPORTED_APP_VERSION 을 던지므로 미리 걸러낸다
    if (typeof mod.isMinVersionSupported === 'function') {
      const ok = mod.isMinVersionSupported({ android: MIN_TOSS_APP, ios: MIN_TOSS_APP });
      if (!ok) return false;
    }

    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_PDF_BYTES) return false;

    await mod.openPDFViewer({ data: toBase64(buf), filename });
    return true; // 'CLOSE' 반환(=유저가 뷰어를 닫음) 또는 정상 종료
  } catch {
    // 브릿지 에러(INVALID_DATA·PDF_VIEWER_ERROR 등) 포함 — 전부 폴백 처리
    return false;
  }
}
