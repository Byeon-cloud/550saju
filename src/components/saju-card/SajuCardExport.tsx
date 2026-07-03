/**
 * #saju-card-share Stage 3 — 사주 카드 PNG 캡처 + 공유
 *
 * 본 모듈은 UI 0 — 순수 utility 함수만 export.
 * SajuCardPage 의 액션 바가 이 함수를 호출.
 *
 * 흐름:
 *   1. captureSajuCardAsBlob() — html2canvas 로 #saju-card-export DOM → PNG Blob
 *   2. downloadBlob() — <a download> 로 파일 저장
 *   3. shareSajuCardImage() — Web Share API → Clipboard → 다운로드 3단 폴백
 *
 * 한자 폰트 fallback 위험 0:
 *   - document.fonts.ready 대기 → Noto Serif KR 글리프 paint 완료 보장
 *   - useCORS true · allowTaint false → tainted canvas 차단 (오염 시 toBlob 실패)
 *   - foreignObjectRendering false (호환성 — Safari/iOS WebView 에서 SVG fO 렌더 불안정)
 *
 * 캡처 사이즈 (scale 2 기준):
 *   - 카드 max-width 520 → 2x = 1040 (인스타 1080 유사 호환)
 *   - 세로는 컨텐츠 길이에 따라 동적 (대략 1640~1820)
 *
 * 공유 폴백 3단:
 *   1차 Web Share API (navigator.share + canShare files) — iOS/Android 네이티브
 *   2차 Clipboard API (ClipboardItem image/png) — 데스크톱 카톡 붙여넣기
 *   3차 강제 다운로드 — 모든 폴백 실패 시 갤러리 저장 후 수동 공유
 */

export interface CaptureOptions {
  /** 캡처할 DOM 요소 — 미지정 시 document.getElementById('saju-card-export') */
  element?: HTMLElement | null;
  /** 캡처 배율 — 기본 2 (HiDPI / 인스타 호환) */
  scale?: number;
  /** 배경색 — 기본 SSOT paper #F8F5EE (transparent 비추천: 카톡 다크모드 호환) */
  backgroundColor?: string;
}

export async function captureSajuCardAsBlob(opts: CaptureOptions = {}): Promise<Blob> {
  const target =
    opts.element ??
    (typeof document !== 'undefined'
      ? document.getElementById('saju-card-export')
      : null);

  if (!target) {
    throw new Error('사주 카드 영역을 찾을 수 없어요');
  }

  // 폰트 paint 완료 대기 — Noto Serif KR 한자 글리프 임베딩 보장
  if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch {
      /* noop — 폰트 ready 실패해도 캡처는 시도 */
    }
  }

  // html2canvas 동적 import — 초기 번들 영향 0 (lazy chunk)
  const mod = await import('html2canvas');
  const html2canvas = mod.default;

  const canvas = await html2canvas(target, {
    scale: opts.scale ?? 2,
    backgroundColor: opts.backgroundColor ?? '#F8F5EE',
    useCORS: true,
    allowTaint: false,
    foreignObjectRendering: false, // Safari/WebView 호환성 — SVG fO 렌더 불안정
    logging: false,
    // 큰 카드(세로 ~1820px @scale 2) 캡처 시간 고려 — windowWidth 명시
    windowWidth: target.scrollWidth,
    windowHeight: target.scrollHeight,
  });

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG 변환에 실패했어요'));
      },
      'image/png',
      0.95,
    );
  });
}

/**
 * Blob 강제 다운로드 — <a download> 트리거.
 * iOS Safari 는 download 속성 무시 → 새 탭 열림 (사용자가 "이미지 저장" 길게 눌러야 함).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  // iOS Safari 대응 — 새 탭 (download 무시 방지)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export type ShareVia =
  | 'web-share'
  | 'clipboard'
  | 'download'
  | 'canceled'
  | 'error';

export interface ShareResult {
  ok: boolean;
  via: ShareVia;
  message: string;
}

/**
 * PNG Blob 공유 — 3단 폴백.
 * 우선순위: Web Share API (files) → Clipboard (ClipboardItem) → 강제 다운로드.
 *
 * @param blob     - 공유할 PNG
 * @param filename - 파일명 (확장자 .png 포함)
 * @param text     - 공유 텍스트 (Web Share API 의 text 필드)
 * @param url      - 공유 URL (Web Share API 의 url 필드)
 */
export async function shareSajuCardImage(
  blob: Blob,
  filename: string,
  text: string,
  url: string,
): Promise<ShareResult> {
  // 2026-07-03 바이럴 퍼널 — 사주 카드 이미지 공유도 시도/성사 계측 (기존 미트래킹 → 유령이었음)
  import('@/services/analytics').then((a) => a.trackEvent('share_click', {
    type: 'card',
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  })).catch(() => {});
  const trackCardComplete = (method: string) => {
    import('@/services/analytics').then((a) => a.trackEvent('share_complete', {
      type: 'card', method, rewarded: 0,
    })).catch(() => {});
  };
  // File 객체 (Web Share API 가 File 만 허용)
  const file = (() => {
    try {
      return new File([blob], filename, { type: 'image/png' });
    } catch {
      return null;
    }
  })();

  // 1차: Web Share API + files
  if (
    file &&
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).canShare === 'function'
  ) {
    const canShareFiles = (() => {
      try {
        return (navigator as any).canShare({ files: [file] });
      } catch {
        return false;
      }
    })();

    if (canShareFiles && typeof (navigator as any).share === 'function') {
      try {
        await (navigator as any).share({
          title: '사주500',
          text,
          url,
          files: [file],
        });
        trackCardComplete('web_share_file');
        return {
          ok: true,
          via: 'web-share',
          message: '공유가 완료됐어요',
        };
      } catch (err: any) {
        const name: string = err?.name || '';
        if (name === 'AbortError' || /canceled|cancel/i.test(err?.message || '')) {
          return {
            ok: false,
            via: 'canceled',
            message: '공유가 취소됐어요',
          };
        }
        // 그 외 실패 — 폴백으로 진행
      }
    }
  }

  // 2차: Clipboard API (image/png 직접 복사)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof (window as any).ClipboardItem === 'function'
  ) {
    try {
      const ClipboardItemCtor = (window as any).ClipboardItem;
      await navigator.clipboard.write([
        new ClipboardItemCtor({ 'image/png': blob }),
      ]);
      trackCardComplete('clipboard');
      return {
        ok: true,
        via: 'clipboard',
        message: '이미지가 복사됐어요. 카카오톡에 붙여넣기 해보세요',
      };
    } catch {
      // fall through
    }
  }

  // 3차: 강제 다운로드 (모든 폴백 실패 — 갤러리 저장 후 수동 공유)
  try {
    downloadBlob(blob, filename);
    trackCardComplete('download');
    return {
      ok: true,
      via: 'download',
      message: '이미지가 저장됐어요. 갤러리에서 카카오톡으로 보내세요',
    };
  } catch {
    return {
      ok: false,
      via: 'error',
      message: '공유에 실패했어요. 다시 시도해주세요',
    };
  }
}

/**
 * 파일명 헬퍼 — 한글/특수문자 안전 처리 (URL/파일시스템 호환).
 *  · 사용자 이름 + 생년월일 → "사주카드_{name}_{YYYYMMDD}.png"
 *  · 이름 미상 시 "사주카드_{YYYYMMDD}.png"
 *  · 특수문자 / 공백 → '_' 치환 (Windows/Mac/iOS 모두 안전)
 */
export function buildSajuCardFilename(name: string, birthDate?: string): string {
  const safe = (s: string) =>
    s.replace(/[^\p{L}\p{N}\-_]/gu, '_').slice(0, 40) || '사용자';
  const dateStr = birthDate ? birthDate.replace(/[^0-9]/g, '') : '';
  const namePart = safe(name || '사용자');
  return dateStr
    ? `사주카드_${namePart}_${dateStr}.png`
    : `사주카드_${namePart}.png`;
}

/**
 * 공유 텍스트 빌더.
 *  - 호스트 도메인 (Firebase Hosting): https://saju500.app
 *  - profileId 가 있으면 /saju-card/{id} 딥링크
 *  - Stage 4 OG: name + ilju 한자를 query string 으로 전달 → 서버 SSR OG 가 동적 미리보기 PNG 생성
 *
 * @param name      - 사용자 이름 (필수)
 * @param profileId - localStorage 프로필 UUID (없으면 홈 link)
 * @param ilju      - 일주 한자 2글자 (예: "辛亥") — OG 이미지 personalization
 */
export function buildShareTextAndUrl(
  name: string,
  profileId?: string,
  ilju?: string,
): { text: string; url: string } {
  const origin =
    (typeof window !== 'undefined' && window.location?.origin) ||
    'https://saju500.app';
  const basePath = profileId ? `/saju-card/${encodeURIComponent(profileId)}` : '';

  // Stage 4 OG personalization query — 서버 renderSajuCardOg/renderSajuCardOgImage 가 읽음
  const params = new URLSearchParams();
  if (name) params.set('n', name);
  if (ilju) params.set('i', ilju);
  const qs = params.toString();
  const url = `${origin}${basePath}${qs ? '?' + qs : ''}`;

  const text = `${name}님의 사주 카드 — 사주500 에서 풀이 받기 (500원~)`;
  return { text, url };
}
