/**
 * LIVE BEST 클라이언트 (2026-06-02 · D3 정식 구현)
 *  · recordTopicView(topicId) — 결과 페이지 도달 시 1회 호출 (fire&forget · non-blocking).
 *      클라 24h 디듀프(localStorage)로 불필요한 함수 호출 억제. 서버도 uid+topicId 24h 쿨다운(이중 방어).
 *  · getTopicTop5() — liveBestCache/top5 캐시 읽기. 데이터 부족 시 null → HomePage 가 폴백.
 */

import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import { ensureAuth } from '@/services/auth/authService';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';

const VIEW_DEDUPE_PREFIX = 'saju500:lb_view:'; // + topicId → 마지막 기록 ms
const DAY_MS = 24 * 60 * 60 * 1000;

/** 결과 페이지 도달 시 1회 호출. 클라 24h 디듀프 통과분만 서버로. 실패는 조용히 무시. */
export async function recordTopicView(topicId: string): Promise<void> {
  if (!topicId) return;
  try {
    const key = VIEW_DEDUPE_PREFIX + topicId;
    const last = Number(window.localStorage.getItem(key) || 0);
    if (Date.now() - last < DAY_MS) return; // 24h 내 이미 기록 → skip
    window.localStorage.setItem(key, String(Date.now()));
  } catch { /* localStorage 불가 시 그냥 진행 */ }

  try {
    await ensureFunctionsTarget();
    await ensureAuth();
    const fn = httpsCallable<{ topicId: string }, { counted: boolean }>(functions, 'recordTopicView', { timeout: 10000 });
    await fn({ topicId });
  } catch (e) {
    // non-blocking — 조회 기록 실패가 UX 를 막지 않음
    // eslint-disable-next-line no-console
    console.warn('[recordTopicView] non-blocking fail:', e);
  }
}

export interface TopicTop5Cache {
  ids: string[];
  counts: Record<string, number>;
  totalViews: number;
}

/** liveBestCache/top5 읽기. 없거나 데이터 빈약(총 조회 < MIN)하면 null → 폴백 사용. */
export async function getTopicTop5(minTotalViews = 1): Promise<TopicTop5Cache | null> {
  try {
    const snap = await getDoc(doc(db, 'liveBestCache', 'top5'));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    const ids: string[] = Array.isArray(data?.ids) ? data.ids.filter((x: any) => typeof x === 'string') : [];
    const totalViews = Number(data?.totalViews) || 0;
    if (ids.length === 0 || totalViews < minTotalViews) return null;
    return { ids, counts: data?.counts || {}, totalViews };
  } catch {
    return null;
  }
}
