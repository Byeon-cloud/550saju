/**
 * 공유 카드 이미지 생성 — Canvas API
 * 인스타 스토리 사이즈 (1080x1920) 또는 정사각형 (1080x1080)
 */

interface ShareCardData {
  name: string;
  birthDate: string;
  ilgan: string;
  ilganOheng: string;
  scores: {
    career: number;
    love: number;
    wealth: number;
    social: number;
    health: number;
    potential: number;
  };
  luckyColors?: string[];
  luckyNumber?: number;
}

const NAVY = '#1B2A4A';
const GOLD = '#B8965A';
const BG = '#F4F5F8';
const TEXT_SEC = '#4A5568';

export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 배경
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // 상단 네이비 영역
  const grad = ctx.createLinearGradient(0, 0, W, 400);
  grad.addColorStop(0, '#243656');
  grad.addColorStop(1, NAVY);
  ctx.fillStyle = grad;
  roundRect(ctx, 40, 40, W - 80, 360, 40);
  ctx.fill();

  // 로고
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 32px Pretendard, sans-serif';
  ctx.fillText('사주500', 80, 100);

  // 이름
  ctx.fillStyle = '#FFF';
  ctx.font = '900 64px Pretendard, sans-serif';
  ctx.fillText(`${data.name}님의 사주`, 80, 200);

  // 생년월일
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '400 28px Pretendard, sans-serif';
  ctx.fillText(`${data.birthDate} · ${data.ilgan}(${data.ilganOheng}) 일간`, 80, 260);

  // 뱃지
  ctx.fillStyle = GOLD;
  roundRect(ctx, 80, 300, 220, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = '700 22px Pretendard, sans-serif';
  ctx.fillText('사주 분석 리포트', 110, 332);

  // 점수 5개 (1x5 그리드) — 2026-05-28 social(대인운) 제거 (SSOT 정렬)
  const scoreItems = [
    { label: '직업운', score: data.scores.career, color: '#2D4470' },
    { label: '애정운', score: data.scores.love, color: GOLD },
    { label: '재물운', score: data.scores.wealth, color: '#8C6D3D' },
    { label: '건강운', score: data.scores.health, color: '#2E7D32' },
    { label: '잠재력', score: data.scores.potential, color: '#D32F2F' },
  ];

  const gridX = 80;
  const gridY = 460;
  const cellW = (W - 160 - 40) / 3;
  const cellH = 200;

  scoreItems.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = gridX + col * (cellW + 20);
    const y = gridY + row * (cellH + 20);

    // 카드 배경
    ctx.fillStyle = '#FFF';
    roundRect(ctx, x, y, cellW, cellH, 24);
    ctx.fill();
    ctx.strokeStyle = '#E2E5EC';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, cellW, cellH, 24);
    ctx.stroke();

    // 점수
    ctx.fillStyle = item.color;
    ctx.font = '900 48px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(item.score), x + cellW / 2, y + 100);

    // 라벨
    ctx.fillStyle = TEXT_SEC;
    ctx.font = '500 24px Pretendard, sans-serif';
    ctx.fillText(item.label, x + cellW / 2, y + 150);
    ctx.textAlign = 'left';
  });

  // 하단 안내
  ctx.fillStyle = TEXT_SEC;
  ctx.font = '400 24px Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('500원에 만나는 정통 명리학 사주 풀이', W / 2, H - 80);
  ctx.fillStyle = GOLD;
  ctx.font = '700 28px Pretendard, sans-serif';
  ctx.fillText('saju500.com', W / 2, H - 40);
  ctx.textAlign = 'left';

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

/** Blob → 다운로드 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Blob → Web Share (모바일) */
export async function shareBlobImage(blob: Blob, title: string): Promise<boolean> {
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], 'saju500-result.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title, files: [file] });
        return true;
      } catch {
        // 사용자 취소
      }
    }
  }
  // fallback: 다운로드
  downloadBlob(blob, 'saju500-result.png');
  return true;
}
