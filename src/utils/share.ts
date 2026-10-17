/**
 * 공유 유틸 — 앱인토스 / 웹 자동 분기
 *
 * 2026-05-28 PM v3 — type-aware 재작성
 *   · 콘텐츠별 카피 분리 (daily/dream/topic/premium) — generic "잠금 해제" 박멸
 *   · URL 에 type 정보 포함 → 서버 SSR OG 가 콘텐츠별 메타 생성
 *   · UX 카피: commercial 톤 → 명리학적·정직·궁금증 유도
 *
 * 앱인토스: getTossShareLink() → share() (네이티브 공유 시트)
 * 웹: Web Share API → 클립보드 복사 폴백
 *
 * OG 이미지: 1200x600px. 현재 콘텐츠별 정적 이미지 4종 (/og-{type}.png) 사용.
 *   Phase 2: 사용자별 동적 OG PNG (Storage 캐싱) — TODO
 * 딥링크: intoss://saju-500/{type}/:id
 */

import { isAppsInToss } from '@/services/payment/iapService';
import { getBalance } from '@/services/storage/localStore';

export type ShareContentType = 'daily' | 'dream' | 'topic' | 'premium';

interface ShareParams {
  /** 콘텐츠 타입 — 카피·OG·URL 분기 SSOT */
  type?: ShareContentType;
  name: string;
  reportId: string;
  /** topic 일 때 라벨 (예: "연애운", "재물운") */
  topicLabel?: string;
  /** topic 일 때 ID (예: "love", "wealth") — URL 에 포함 */
  topicId?: string;
  /** OG 이미지 URL (Phase 2 — 동적 생성 시) */
  ogImageUrl?: string;
  /** 레거시 — ShareModal 호환. 향후 generateOgImage 분리 시 제거. */
  topScore?: { label: string; score: number };
}

interface ShareCopy {
  /** Native share sheet title */
  title: string;
  /** Share message body */
  text: string;
  /** URL suffix (예: "daily" / "topic/love") */
  urlPath: string;
}

/**
 * 콘텐츠별 공유 카피 SSOT.
 *
 * 2026-05-29 전면 재작성 (초대형 — 정직):
 *   ⚠️ 받는 사람은 "공유자의 결과"를 열람하지 못함 (오늘운세·꿈해몽은 개인·계정 귀속,
 *      SharePage 는 비회원에게 "나도 내 사주 알아보기" 초대 CTA 만 노출).
 *   기존 "○○님 하루를 풀어드렸어요 · 보고 가세요" 는 거짓 약속(남의 결과 열람 불가) → 박멸.
 *   신규 톤: "나는 봤다 → 너도 네 사주로 봐라" 초대형. 공유자 이름 노출 X (받는 사람 본인 사주가 주인공).
 */
function getShareCopy(params: ShareParams): ShareCopy {
  const { type, topicLabel, topicId, reportId } = params;

  switch (type) {
    case 'daily':
      return {
        title: '오늘의 운세 — 사주500',
        text: '오늘의 운세를 사주로 받아봤어요. 내 오늘도 무료로 확인해보세요',
        urlPath: `daily/${reportId}`,
      };
    case 'dream':
      return {
        title: '꿈해몽 — 사주500',
        text: '간밤의 꿈을 사주로 풀어봤어요. 내 꿈도 무료로 해몽받아보세요',
        urlPath: `dream/${reportId}`,
      };
    case 'topic': {
      const tl = topicLabel || '주제 분석';
      return {
        title: `${tl} — 사주500`,
        text: `내 ${tl}을 사주로 깊이 있게 봤어요. 내 ${tl}도 사주로 확인해보세요`,
        urlPath: `topic/${topicId || 'love'}/${reportId}`,
      };
    }
    case 'premium':
      return {
        title: '종합사주 — 사주500',
        text: '평생 사주를 정통 명리학으로 풀어봤어요. 내 사주도 만나보세요',
        urlPath: `premium/${reportId}`,
      };
    default:
      // 후방 호환 (type 없이 호출)
      return {
        title: '사주500 정통 사주 풀이',
        text: '500원에 만나는 정통 사주 풀이. 내 사주도 받아보세요',
        urlPath: `result/${reportId}`,
      };
  }
}

/** 결과 공유 실행 — 콘텐츠 타입별 카피 + URL 자동 분기 */
export async function shareResult(params: ShareParams): Promise<boolean> {
  // 측정 — 공유 시도 (C2 · fire-and-forget)
  //   2026-06-24 마케팅 차원 보강 — page(어느 페이지에서 공유?) + balance(잔액대별 공유 성향) 첨부.
  //   getBalance() 는 모든 버킷 합산 총잔액(number) — 정수로 반올림해 카디널리티 억제.
  import('@/services/analytics').then((a) => a.trackEvent('share_click', {
    type: params.type || 'result',
    page: window.location.pathname,
    balance: Math.round(getBalance()),
  })).catch(() => {});
  const copy = getShareCopy(params);
  // 2026-06-22 마케팅 측정 — 공유 URL 에 ref=share 부착. 수신자 진입 시 captureUtm 이 utm.source='share' 로
  //   태깅 + App 부팅이 invite_received 발화 → "공유가 신규 방문/전환을 데려오는지(바이럴 K-factor)" 측정.
  const webUrl = `${window.location.origin}/share/${copy.urlPath}?ref=share`;
  // 2026-07-03 CS fix ("공유 링크가 시스템 에러") — 토스 딥링크가 /share/ 프리픽스 없이 결과 페이지로
  //   직행 → 수신자 기기엔 그 리포트가 없어 에러. 웹과 동일하게 공유 수신 페이지(SharePage: 미리보기+초대 CTA)로.
  const deepLinkPath = `/share/${copy.urlPath}?ref=share`;

  // 2026-05-29 — 토스 공유 시 ogImageUrl 미전달 → 토스 기본 OG 노출 버그 fix.
  //   현재 정적 OG 1종(og-image.png)만 존재 → 기본값으로 항상 전달. (Phase 2: 콘텐츠별 동적 OG)
  // 2026-10-17 — 앱 안에서는 origin 이 토스 미니앱 주소라 그 /og-image.png 를 카카오톡이 못 읽어 미리보기 그림이 비었다 → 공개 웹 주소로
  const ogImage = params.ogImageUrl || OG_IMAGE;
  // 2026-07-03 바이럴 퍼널 — 공유 '성사' 측정 (share_click=시도와 짝. method 로 경로 분해)
  const trackComplete = (method: string) => {
    import('@/services/analytics').then((a) => a.trackEvent('share_complete', {
      type: params.type || 'result',
      method,
      rewarded: 0, // 공유 보상 없음 (2026-10-14 앱인토스 공유 리워드 종료)
    })).catch(() => {});
  };
  if (isAppsInToss()) {
    const ok = await shareViaToss(deepLinkPath, copy.text, ogImage);
    if (ok) trackComplete('toss_share');
    return ok;
  }
  const via = await shareViaWeb(copy.title, copy.text, webUrl);
  if (via) trackComplete(via);
  return via !== null;
}

/** 공유 미리보기 그림 — 공개 웹 주소 (앱 안 origin 은 카카오톡이 못 읽는다, 2026-10-17 오너 캡처) */
const OG_IMAGE = 'https://saju500.app/og-image.png';
/** 2026-10-17 콘텐츠별 공유 그림 (public/og/*.jpg, scripts/og/make-og.cjs) */
const ogFor = (kind: 'dream' | 'compat' | 'daily' | 'premium' | 'tojung' | 'monthly' | 'weekly' | 'tti') => `https://saju500.app/og/${kind}.jpg`;

/** 꿈해몽 보내기 (2026-10-17) — 받는 사람이 꿈 풀이 첫 장을 직접 열어 보는 링크 (/share/dream/{id}) */
export async function shareDreamLink(p: { id: string; title: string }): Promise<'toss_share' | 'web_share' | 'clipboard' | null> {
  import('@/services/analytics').then((a) => a.trackEvent('share_click', { type: 'dream', page: window.location.pathname, balance: Math.round(getBalance()) })).catch(() => {});
  const text = `간밤 꿈을 사주로 풀어 봤어요. ${p.title ? `'${p.title}' ` : ''}풀이를 열어 보세요`;
  const path = `/share/dream/${p.id}?ref=share`;
  const done = (method: string) => {
    import('@/services/analytics').then((a) => a.trackEvent('share_complete', { type: 'dream', method, rewarded: 0 })).catch(() => {});
  };
  if (isAppsInToss()) {
    const ok = await shareViaToss(path, text, ogFor('dream'));
    if (ok) done('toss_share');
    return ok ? 'toss_share' : null;
  }
  const via = await shareViaWeb('꿈해몽 | 사주500', text, `https://saju500.app${path}`);
  if (via) done(via);
  return via;
}

/** 궁합 보내기 (2026-10-17, 시험 E7) — 받는 사람이 점수와 총평을 직접 열어 보는 링크 (/share/compat/{id}).
 *  링크 id 는 services/share/compatShare.ts 의 createCompatShareId 가 서버에 만든다.
 *  @returns 성사 여부 ('clipboard' 면 화면에서 '복사했어요'를 알린다) */
export async function shareCompatLink(p: { id: string; n1: string; n2: string }): Promise<'toss_share' | 'web_share' | 'clipboard' | null> {
  import('@/services/analytics').then((a) => a.trackEvent('share_click', { type: 'compat', page: window.location.pathname, balance: Math.round(getBalance()) })).catch(() => {});
  const text = `${p.n1} 님과 ${p.n2} 님의 궁합을 사주로 봤어요. 점수와 총평을 열어 보세요`;
  const path = `/share/compat/${p.id}?ref=share`;
  const done = (method: string) => {
    import('@/services/analytics').then((a) => a.trackEvent('share_complete', { type: 'compat', method, rewarded: 0 })).catch(() => {});
  };
  if (isAppsInToss()) {
    const ok = await shareViaToss(path, text, ogFor('compat'));
    if (ok) done('toss_share');
    return ok ? 'toss_share' : null;
  }
  const via = await shareViaWeb('궁합 | 사주500', text, `https://saju500.app${path}`);
  if (via) done(via);
  return via;
}

/** 신년운세 미리 보기 보내기 (2026-10-18) — 받는 사람이 그 사람의 새해 미리 보기를 열어 보는 링크 (/share/newyear/{id}) */
export async function shareNewYearLink(p: { id: string; name: string; year: number }): Promise<'toss_share' | 'web_share' | 'clipboard' | null> {
  import('@/services/analytics').then((a) => a.trackEvent('share_click', { type: 'newyear', page: window.location.pathname, balance: Math.round(getBalance()) })).catch(() => {});
  const text = `${p.name} 님의 ${p.year}년을 사주로 미리 봤어요. 힘을 줄 달과 쉬어 갈 달을 열어 보세요`;
  const path = `/share/newyear/${p.id}?ref=share`;
  const done = (method: string) => {
    import('@/services/analytics').then((a) => a.trackEvent('share_complete', { type: 'newyear', method, rewarded: 0 })).catch(() => {});
  };
  if (isAppsInToss()) {
    const ok = await shareViaToss(path, text, ogFor('tojung'));
    if (ok) done('toss_share');
    return ok ? 'toss_share' : null;
  }
  const via = await shareViaWeb(`${p.year} 신년운세 미리 보기 | 사주500`, text, `https://saju500.app${path}`);
  if (via) done(via);
  return via;
}

/** 공유 링크 생성 (레거시 호환 — type 없이 호출 시 result/) */
export function createShareUrl(shareId: string, type?: ShareContentType, topicId?: string): string {
  const prefix = type === 'topic' && topicId ? `topic/${topicId}` : (type || 'result');
  return `${window.location.origin}/share/${prefix}/${shareId}`;
}

async function shareViaToss(deepLinkPath: string, message: string, ogImageUrl?: string): Promise<boolean> {
  try {
    const { share, getTossShareLink } = await import('@apps-in-toss/web-framework');
    const tossLink = await getTossShareLink(
      `intoss://saju-500${deepLinkPath}`,
      ogImageUrl,
    );
    // 2026-05-28 PM — 토스 공유 시 메시지 본문 + 링크 함께 전달 (콘텐츠별 카피 보존)
    await share({ message: `${message}\n${tossLink}` });
    return true;
  } catch {
    return false;
  }
}

/** @returns 성사 경로 ('web_share' | 'clipboard') 또는 null (취소/실패) — share_complete method 분해용 */
async function shareViaWeb(title: string, text: string, url: string): Promise<'web_share' | 'clipboard' | null> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'web_share';
    } catch { return null; }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'clipboard';
  } catch { return null; }
}

/**
 * OG 이미지 생성 — 1200x600px (앱인토스 가이드라인)
 *
 * 2026-05-28 PM — type-aware 분기. type 에 따라 다른 배경·아이콘·카피.
 *   - daily: 화 火 + 붉은 그라데이션
 *   - dream: 夢 + 검은 별
 *   - topic: 토픽 한자 + 토픽 컬러
 *   - premium: 命 + 골드 그라데이션
 *
 * 사용처: 현재 클라이언트가 직접 호출하지 않음 (서버 SSR OG 가 정적 이미지 사용).
 * 향후 Phase 2: 사용자별 동적 OG PNG 캐싱 시 활성화.
 */
export async function generateOgImage(params: {
  type?: ShareContentType;
  name: string;
  topicLabel?: string;
  topScore?: { label: string; score: number };
}): Promise<Blob> {
  const W = 1200, H = 600;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // type 별 색·한자·키 라인
  const theme = getOgTheme(params.type);

  // 배경 그라데이션
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.bgFrom);
  grad.addColorStop(1, theme.bgTo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 한자 워터마크
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.font = '900 280px "Noto Serif KR", serif';
  ctx.textAlign = 'right';
  ctx.fillText(theme.hanja, W - 60, H - 80);
  ctx.textAlign = 'left';

  // 로고
  ctx.fillStyle = theme.accent;
  ctx.font = 'bold 28px Pretendard, sans-serif';
  ctx.fillText('사주500', 60, 70);

  // 메인 제목 (사람 이름 + 콘텐츠)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 60px Pretendard, sans-serif';
  const personPart = params.name && params.name !== '나' ? `${params.name} 님의` : '';
  if (personPart) ctx.fillText(personPart, 60, 200);
  ctx.font = '800 64px "Noto Serif KR", serif';
  ctx.fillText(theme.headline(params.topicLabel), 60, 280);

  // 점수 배지 (있을 때만)
  if (params.topScore) {
    const tx = 60, ty = 320;
    rr(ctx, tx, ty, 260, 56, 28);
    ctx.fillStyle = `${theme.accent}33`;
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 24px Pretendard, sans-serif';
    ctx.fillText(`${params.topScore.label} ${params.topScore.score}점`, tx + 28, ty + 38);
  }

  // 하단 — 정직한 카피 (commercial 톤 박멸)
  ctx.fillStyle = '#FFFFFFAA';
  ctx.font = 'bold 22px Pretendard, sans-serif';
  ctx.fillText(theme.tagline, 60, H - 50);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

interface OgTheme {
  bgFrom: string;
  bgTo: string;
  accent: string;
  hanja: string;
  headline: (topicLabel?: string) => string;
  tagline: string;
}

function getOgTheme(type?: ShareContentType): OgTheme {
  switch (type) {
    case 'daily':
      return {
        bgFrom: '#A23A2A', bgTo: '#7B2E15', accent: '#F4D166', hanja: '火',
        headline: () => '오늘 운세',
        tagline: '500원에 만나는 정통 명리학: 매일 무료',
      };
    case 'dream':
      return {
        bgFrom: '#1A1A1A', bgTo: '#2A2520', accent: '#E8D5A8', hanja: '夢',
        headline: () => '간밤의 꿈, 사주로 풀어드릴게요',
        tagline: '500원에 만나는 정통 명리학',
      };
    case 'topic':
      return {
        bgFrom: '#1A1612', bgTo: '#2A231C', accent: '#E8D5A8', hanja: '命',
        headline: (tl) => tl || '주제 분석',
        tagline: '500원에 만나는 정통 명리학: 깊이 있는 한 가지',
      };
    case 'premium':
      return {
        bgFrom: '#1A1A1A', bgTo: '#2A2520', accent: '#F4D166', hanja: '命',
        headline: () => '평생 사주, 한 권의 깊이로',
        tagline: '정통 명리학 6대 원전 기반 — 사주500',
      };
    default:
      return {
        bgFrom: '#1A1612', bgTo: '#2A231C', accent: '#B8965A', hanja: '命',
        headline: () => '사주 결과',
        tagline: '500원에 만나는 정통 명리학',
      };
  }
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
