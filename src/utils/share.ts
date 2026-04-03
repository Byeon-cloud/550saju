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
  const text = `${name}님의 사주를 분석했어요. 나도 500원에 내 사주를 볼 수 있다는데?`;
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
 * 블러 처리 + 궁금증 유발
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
  ctx.fillStyle = 'rgba(201,169,110,0.06)';
  ctx.beginPath();
  ctx.arc(W - 150, 100, 200, 0, Math.PI * 2);
  ctx.fill();

  // 로고
  ctx.fillStyle = '#C9A96E';
  ctx.font = 'bold 24px Pretendard, sans-serif';
  ctx.fillText('사주500', 60, 60);

  // 메인
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 52px Pretendard, sans-serif';
  ctx.fillText(`${name}님의 사주 결과`, 60, 180);

  // 점수 배지
  if (topScore) {
    rr(ctx, 60, 210, 250, 48, 24);
    ctx.fillStyle = 'rgba(201,169,110,0.15)';
    ctx.fill();
    ctx.fillStyle = '#E8D5A8';
    ctx.font = 'bold 22px Pretendard, sans-serif';
    ctx.fillText(`${topScore.label} ${topScore.score}점`, 90, 242);
  }

  // 블러 영역
  const by = 300;
  rr(ctx, 60, by, W - 120, 180, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.04})`;
    rr(ctx, 90, by + 25 + i * 28, 200 + Math.random() * 500, 12, 6);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '500 18px Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('전체 12가지 분석 결과를 확인하세요', W / 2, by + 210);

  // 하단
  ctx.fillStyle = '#C9A96E';
  ctx.font = 'bold 20px Pretendard, sans-serif';
  ctx.fillText('사주500 — 500원에 만나는 정통 명리학', W / 2, H - 30);
  ctx.textAlign = 'left';

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
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
