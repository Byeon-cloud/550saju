/**
 * 주제운 결제 전 미리 보기 (2026-10-23, 1.6.3 P1-6) — 서버 callable topicPreview 를 부른다(AI 0원).
 *   짚을 해(topicHookPick)와 앞으로 가장 좋은 달(topicBestMonth)은 서버 계산이라 클라 사본을 두지 않는다.
 *   유료 풀이(claudeTopic)가 같은 해, 같은 달을 쓰므로 결제 뒤 결과와 어긋나지 않는다.
 *   callable 이 아직 배포되지 않았거나 실패하면 null → 화면은 칸을 숨기고 예전처럼 동작한다.
 *   보내는 값은 계산에 쓰는 칸만(기둥 간지, 태어난 해와 달과 날, 성별, 용신 희신 기신). 이름과 시각은 보내지 않는다.
 */
import type { SajuData } from '@/types/saju';
import { kstToday } from '@/utils/kstDate';

export interface TopicPreview {
  hook: { y: number; gz: string; place: string } | null;
  month: { y: number; m: number; noPartnerOnly: boolean } | null;
}

const KEY = 'saju500:topic_preview:v1';

function slim(sd: SajuData): Record<string, unknown> {
  const ma: any = (sd as any)?.myeongriAnalysis || {};
  return {
    pillars: (sd?.pillars || []).slice(0, 4).map((p: any) => ({ 천간: p?.천간 || '', 지지: p?.지지 || '', available: p?.available !== false })),
    input: { birthYear: sd?.input?.birthYear, birthMonth: sd?.input?.birthMonth, birthDay: sd?.input?.birthDay, gender: sd?.input?.gender },
    myeongriAnalysis: { 용신: ma.용신, 희신: ma.희신, 기신: ma.기신 },
  };
}

function cacheKey(topicId: string, body: Record<string, unknown>): string {
  return `${KEY}:${topicId}:${kstToday()}:${JSON.stringify(body)}`;
}

/** 실패, 빈 응답은 null. 같은 날 같은 사주와 주제는 세션 안에서 한 번만 부른다 */
export async function fetchTopicPreview(topicId: string, sd: SajuData | null | undefined): Promise<TopicPreview | null> {
  if (!sd || !Array.isArray(sd.pillars) || !sd.input?.birthYear) return null;
  const body = slim(sd);
  const ck = cacheKey(topicId, body);
  try {
    const hit = sessionStorage.getItem(ck);
    if (hit) return JSON.parse(hit) as TopicPreview;
  } catch { /* noop */ }
  try {
    const [{ getFunctions, httpsCallable }, { app }, { ensureAuth }] = await Promise.all([
      import('firebase/functions'), import('@/services/auth/firebase'), import('@/services/auth/authService'),
    ]);
    await ensureAuth();
    const r: any = await httpsCallable(getFunctions(app, 'us-central1'), 'topicPreview', { timeout: 8000 })({ topicId, sajuData: body });
    const d = r?.data;
    if (!d?.ok) return null;
    const hook = d.hook && Number.isFinite(d.hook.y) && typeof d.hook.place === 'string' && d.hook.place
      ? { y: Number(d.hook.y), gz: String(d.hook.gz || ''), place: String(d.hook.place) } : null;
    const month = d.month && Number.isFinite(d.month.y) && d.month.m >= 1 && d.month.m <= 12
      ? { y: Number(d.month.y), m: Number(d.month.m), noPartnerOnly: !!d.month.noPartnerOnly } : null;
    if (!hook && !month) return null;
    const out: TopicPreview = { hook, month };
    try { sessionStorage.setItem(ck, JSON.stringify(out)); } catch { /* noop */ }
    return out;
  } catch {
    return null;
  }
}
