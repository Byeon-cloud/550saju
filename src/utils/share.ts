/** 공유 링크 생성 */
export function createShareUrl(shareId: string): string {
  const base = window.location.origin;
  return `${base}/share/${shareId}`;
}

/** 웹 공유 API 호출 */
export async function shareResult(title: string, url: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return true;
    } catch {
      return false;
    }
  }

  // 클립보드 폴백
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
