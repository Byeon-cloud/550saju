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

  // 2026-10-11 — 이 기기에서 html2canvas 가 글자를 얼마나 아래로 밀어 그리는지 글꼴별로 먼저 잰다 (아래 measureTextShift)
  const shifts = new Map<string, number>();
  for (const fam of collectTextFamilies(target)) {
    shifts.set(fam, await measureTextShift(html2canvas as unknown as H2C, fam));
  }

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
    // 2026-10-11 — 글자가 아래로 밀려 아래 칸을 덮거나 둥근 칸 밖으로 잘리던 문제 보정 (사본에서만, 화면은 그대로)
    onclone: (_doc: Document, el: HTMLElement) => prepareCloneForCapture(el, shifts),
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

type H2C = (el: HTMLElement, o: Record<string, unknown>) => Promise<HTMLCanvasElement>;

/** 캡처 대상 안에서 글자에 쓰인 글꼴 목록 */
function collectTextFamilies(root: HTMLElement): Set<string> {
  const fams = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!(n.textContent || '').trim() || !n.parentElement) continue;
    fams.add(getComputedStyle(n.parentElement).fontFamily);
  }
  return fams;
}

const shiftCache = new Map<string, number>();
/**
 * html2canvas 1.4 는 글꼴 기준선을 잘못 재서 모든 글자를 일정 비율 아래로 밀어 그린다
 * (2026-10-11 측정: 명조 0.34em, 고딕 0.41em — 줄 높이와 무관, 기기 글꼴에 따라 달라짐).
 * 그래서 이 기기에서 시험 글자 하나를 html2canvas 와 캔버스 fillText 로 각각 그려 잉크 윗선 차이를 잰다.
 */
async function measureTextShift(h2c: H2C, family: string): Promise<number> {
  const hit = shiftCache.get(family);
  if (hit != null) return hit;
  const FS = 100;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;width:320px;padding:40px 0;margin:0;background:#fff;pointer-events:none;';
  const t = document.createElement('div');
  t.style.cssText = `font-family:${family};font-size:${FS}px;line-height:1.5;font-weight:700;color:#000;margin:0;padding:0;white-space:nowrap;`;
  t.appendChild(document.createTextNode('가甲'));
  const mark = document.createElement('span');
  mark.style.cssText = 'display:inline-block;width:1px;height:0;vertical-align:baseline;';
  t.appendChild(mark);
  box.appendChild(t);
  document.body.appendChild(box);
  let ratio = 0;
  try {
    const br = box.getBoundingClientRect();
    const base = mark.getBoundingClientRect().top - br.top;
    const inkTop = (c: HTMLCanvasElement): number => {
      const g = c.getContext('2d');
      if (!g) return -1;
      const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4] < 128) return y;
      return -1;
    };
    const cv = await h2c(box, { scale: 1, backgroundColor: '#ffffff', logging: false });
    const ref = document.createElement('canvas');
    ref.width = Math.ceil(br.width);
    ref.height = Math.ceil(br.height);
    const g = ref.getContext('2d');
    if (g) {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, ref.width, ref.height);
      g.fillStyle = '#000000';
      g.font = `700 ${FS}px ${family}`;
      g.textBaseline = 'alphabetic';
      g.fillText('가甲', 0, base);
    }
    const a = inkTop(cv);
    const b = inkTop(ref);
    if (a >= 0 && b >= 0) ratio = (a - b) / FS;
  } catch {
    ratio = 0;
  } finally {
    box.remove();
  }
  if (!(ratio > -0.2 && ratio < 0.8)) ratio = 0; // 이상값이면 보정하지 않는다
  shiftCache.set(family, ratio);
  return ratio;
}

/**
 * 캡처용 사본 손질 (화면 자체는 그대로)
 *  1) 흐린 그림자는 html2canvas 가 상자 위에 덮어 그려 테두리가 이중으로 보인다 → 빼고, 고리형(0 0 0 1px)은 얇은 테두리로
 *  2) 글자만 위 측정값만큼 위로 올린다 — 글자 조각을 span 으로 감싸 relative top (상자, 배경은 제자리)
 */
function prepareCloneForCapture(root: HTMLElement, shifts: Map<string, number>): void {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return;
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const shadow = win.getComputedStyle(el).boxShadow;
    if (shadow && shadow !== 'none') {
      const ring = shadow.match(/(rgba?\([^)]*\))\s+0px\s+0px\s+0px\s+1px(?!\s*inset)/);
      el.style.boxShadow = 'none';
      if (ring && win.getComputedStyle(el).borderStyle === 'none') el.style.border = `1px solid ${ring[1]}`;
    }
  });
  const texts: Text[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.textContent || '').trim() && n.parentElement) texts.push(n as Text);
  }
  for (const tn of texts) {
    const pe = tn.parentElement;
    if (!pe) continue;
    const cs = win.getComputedStyle(pe);
    const ratio = shifts.get(cs.fontFamily) ?? 0;
    const dy = ratio * parseFloat(cs.fontSize);
    if (!(dy > 0.5)) continue;
    const span = doc.createElement('span');
    span.style.position = 'relative';
    span.style.top = `${(-dy).toFixed(1)}px`;
    pe.insertBefore(span, tn);
    span.appendChild(tn);
  }
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

  const text = `${name} 님의 사주 카드, 사주500에서 풀이 받아 보세요`;
  return { text, url };
}
