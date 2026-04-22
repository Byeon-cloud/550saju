/**
 * 공유 유틸 — 앱인토스 / 웹 자동 분기
 *
 * 앱인토스: getTossShareLink() → share() (네이티브 공유 시트)
 * 웹: Web Share API → 클립보드 복사 폴백
 *
 * OG 이미지: 1200x600px (앱인토스 가이드라인)
 * 딥링크: intoss://saju500/result/:id
 */

import { isAppsInToss } from '@/services/payment/iapService';

interface ShareParams {
  name: string;
  reportId: string;
  topScore?: { label: string; score: number };
  ogImageUrl?: string;
}

/** 결과 공유 실행 */
export async function shareResult(params: ShareParams): Promise<boolean> {
  const { name, reportId } = params;
  const title = `${name}님의 사주 결과 — 사주500`;
  /**
   * P2-1 · 블러 공유 경계
   * 공유 수신자는 기본적으로 블러잠금 상태로 `/share/:id` 랜딩.
   * 공유 텍스트는 "잠금 해제 → 전체 보기" 티저 고정.
   * 근거: docs/prd/P2_Path_E_티켓_트래커.md P2-1 · 프리미엄_티저블러.md
   */
  const text = `${name}님의 사주 — 잠금 해제하고 전체 보기 →`;
  const webUrl = `${window.location.origin}/share/${reportId}`;
  const deepLinkPath = `/result/${reportId}`;

  if (isAppsInToss()) {
    return shareViaToss(deepLinkPath, params.ogImageUrl);
  }
  return shareViaWeb(title, text, webUrl);
}

/** 공유 링크 생성 (레거시 호환) */
export function createShareUrl(shareId: string): string {
  return `${window.location.origin}/share/${shareId}`;
}

async function shareViaToss(deepLinkPath: string, ogImageUrl?: string): Promise<boolean> {
  try {
    const sdkName = '@apps-in-toss/' + 'web-framework';
    const { share, getTossShareLink } = await import(/* @vite-ignore */ sdkName);
    const tossLink = await getTossShareLink(
      `intoss://saju500${deepLinkPath}`,
      ogImageUrl,
    );
    await share({ message: tossLink });
    return true;
  } catch {
    return false;
  }
}

async function shareViaWeb(title: string, text: string, url: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch { return false; }
  }
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch { return false; }
}

/**
 * OG 이미지 생성 — 1200x600px (앱인토스 가이드라인)
 *
 * P2-1 · 블러 공유 경계 (2026-04-22 개정)
 * 공유 수신자 기본 맥락 = 블러잠금. OG 이미지는 블러 필드 위에 **잠금 아이콘 + 잠금 해제 CTA** 를
 * 명확히 노출해 "티저 → 구매" 의도를 정렬. 근거: `docs/prd/P2_Path_E_티켓_트래커.md` P2-1 ·
 * `프리미엄_티저블러.md`.
 */
export async function generateOgImage(name: string, topScore?: { label: string; score: number }): Promise<Blob> {
  const W = 1200, H = 600;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 배경 — 딥네이비
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1B2A4A');
  grad.addColorStop(1, '#243656');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 골드 장식
  ctx.fillStyle = 'rgba(184,150,90,0.08)';
  ctx.beginPath();
  ctx.arc(W - 150, 100, 200, 0, Math.PI * 2);
  ctx.fill();

  // 로고
  ctx.fillStyle = '#B8965A';
  ctx.font = 'bold 24px Pretendard, sans-serif';
  ctx.fillText('사주500', 60, 60);

  // 메인
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 52px Pretendard, sans-serif';
  ctx.fillText(`${name}님의 사주 결과`, 60, 180);

  // 점수 배지
  if (topScore) {
    rr(ctx, 60, 210, 250, 48, 24);
    ctx.fillStyle = 'rgba(184,150,90,0.18)';
    ctx.fill();
    ctx.fillStyle = '#E8D5A8';
    ctx.font = 'bold 22px Pretendard, sans-serif';
    ctx.fillText(`${topScore.label} ${topScore.score}점`, 90, 242);
  }

  // 블러 영역 (티저 바디)
  const by = 300;
  rr(ctx, 60, by, W - 120, 180, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.04})`;
    rr(ctx, 90, by + 25 + i * 28, 200 + Math.random() * 500, 12, 6);
    ctx.fill();
  }

  // P2-1 · 잠금 아이콘 (블러 필드 좌상단)
  drawLockIcon(ctx, 90, by + 28, 36, '#E8D5A8');

  // P2-1 · "잠금 해제하고 전체 보기 →" CTA 배지 (블러 필드 하단 중앙)
  ctx.textAlign = 'center';
  const ctaText = '잠금 해제하고 전체 보기 →';
  ctx.font = 'bold 22px Pretendard, sans-serif';
  const ctaMetrics = ctx.measureText(ctaText);
  const ctaW = ctaMetrics.width + 56;
  const ctaH = 52;
  const ctaX = (W - ctaW) / 2;
  const ctaY = by + 180 - ctaH / 2 - 4;
  rr(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2);
  ctx.fillStyle = '#B8965A';
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(ctaText, W / 2, ctaY + 33);

  // 하단 — 브랜드 라인
  ctx.fillStyle = '#B8965A';
  ctx.font = 'bold 20px Pretendard, sans-serif';
  ctx.fillText('사주500 — 500원에 만나는 정통 명리학', W / 2, H - 30);
  ctx.textAlign = 'left';

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

/**
 * P2-1 보조 — 자물쇠 아이콘 (canvas 네이티브 stroke).
 * cx, cy = 좌상단 기준점. size = 아이콘 전체 높이.
 */
function drawLockIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  const bodyW = size * 0.78;
  const bodyH = size * 0.58;
  const shackleR = bodyW * 0.36;
  const bodyX = cx;
  const bodyY = cy + (size - bodyH);
  const shackleCx = bodyX + bodyW / 2;
  const shackleCy = bodyY;

  // shackle (U자)
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(shackleCx, shackleCy, shackleR, Math.PI, 0, false);
  ctx.stroke();

  // body (사각형)
  rr(ctx, bodyX, bodyY, bodyW, bodyH, bodyH * 0.18);
  ctx.fillStyle = color;
  ctx.fill();

  // key hole (점 + 짧은 선)
  ctx.fillStyle = '#1B2A4A';
  ctx.beginPath();
  ctx.arc(bodyX + bodyW / 2, bodyY + bodyH * 0.4, bodyH * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(bodyX + bodyW / 2 - bodyH * 0.04, bodyY + bodyH * 0.4, bodyH * 0.08, bodyH * 0.24);
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
