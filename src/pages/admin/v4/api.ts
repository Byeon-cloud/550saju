/**
 * 관리자 v4 — 서버 부르기와 기간 합산 (2026-10-19)
 *   숫자는 서버의 하루 요약(statsDaily, functions/src/admin/stats.ts)에서 온다. 화면은 원본 기록을 직접 읽지 않는다.
 *   고객 찾기는 adminLookup, 운 넣기는 adminGrantCompensation.
 */
import { useCallback, useEffect, useState } from 'react';

export type Plat = 'app' | 'web';
export type PlatFilter = 'all' | Plat;

export interface Side {
  visitors: number; newDevices: number; opens: number; inputs: number; results: number; payTry: number; chargeOpen: number;
  loginGate: number; logins: number;
  payers: number; newPayers: number; orders: number; revenue: number; refunds: number; refundAmount: number;
  shares: number; notiAgree: number;
}
export interface ContentRow { opens: number; results: number; purchases: number; un: number }
export interface ChannelRow { plat: Plat; visitors: number; inputs: number; results: number; payers: number; revenue: number }
export interface DayStats {
  day: string; v: number; builtAt: number; partial?: boolean;
  app: Side; web: Side;
  content: Record<string, { app: ContentRow; web: ContentRow }>;
  channels: Record<string, ChannelRow>;
  ai: { calls: number; fail: number; costKrw: number; byType: Record<string, { calls: number; fail: number; costKrw: number; ms: number }> };
  aiFailures: { total: number; byType: Record<string, number> };
  cs: { granted: number; grantedUn: number; claimed: number; claimedUn: number };
  alerts: { total: number; byKind: Record<string, number> };
  packages: Record<string, number>;
}

export async function callAdmin<T = any>(name: string, data: Record<string, unknown>): Promise<T> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const { app } = await import('@/services/auth/firebase');
  const fn = httpsCallable(getFunctions(app, 'us-central1'), name, { timeout: 540000 });
  const r = await fn(data);
  return r.data as T;
}

export const SIDE_KEYS: (keyof Side)[] = [
  'visitors', 'newDevices', 'opens', 'inputs', 'results', 'payTry', 'chargeOpen', 'loginGate', 'logins',
  'payers', 'newPayers', 'orders', 'revenue', 'refunds', 'refundAmount', 'shares', 'notiAgree',
];
export const emptySide = (): Side => Object.fromEntries(SIDE_KEYS.map((k) => [k, 0])) as unknown as Side;

/** 하루의 앱, 웹, 또는 둘을 더한 값 */
export function sideOf(d: DayStats, f: PlatFilter): Side {
  if (f !== 'all') return d[f] || emptySide();
  const s = emptySide();
  for (const k of SIDE_KEYS) (s as any)[k] = (d.app?.[k] || 0) + (d.web?.[k] || 0);
  return s;
}

/** 여러 날을 더한다 (사람 수는 날마다 센 것을 더한 값 — 같은 사람이 이틀 오면 두 번) */
export function sumSides(days: DayStats[], f: PlatFilter): Side {
  const s = emptySide();
  for (const d of days) { const x = sideOf(d, f); for (const k of SIDE_KEYS) (s as any)[k] += x[k]; }
  return s;
}

export function useStats(days: number, enabled: boolean) {
  const [data, setData] = useState<DayStats[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builtNow, setBuiltNow] = useState(0);
  const load = useCallback(async () => {
    if (!enabled) return;
    setBusy(true); setError(null);
    try {
      const r = await callAdmin<{ days: DayStats[]; builtNow: number }>('adminStats', { action: 'range', days });
      setData(r.days); setBuiltNow(r.builtNow || 0);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally { setBusy(false); }
  }, [days, enabled]);
  useEffect(() => { load(); }, [load]);
  return { data, busy, error, reload: load, builtNow };
}

export const fmt = (n: number): string => Math.round(n).toLocaleString('ko-KR');
export const won = (n: number): string => `${Math.round(n).toLocaleString('ko-KR')}원`;
export const pct = (a: number, b: number): string => {
  if (!(b > 0)) return '-';
  const v = (a / b) * 100;
  return `${v > 0 && v < 1 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10}%`; // 1% 아래는 소수 둘째 자리까지
};
export const shortDay = (d: string): string => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
export const timeText = (ms: number): string => {
  if (!ms) return '-';
  const t = new Date(ms + 9 * 3600e3).toISOString();
  return `${t.slice(0, 10)} ${t.slice(11, 16)}`;
};

export const CONTENT_NAME: Record<string, string> = {
  daily: '오늘의 운세', dream: '꿈해몽', deepDream: '꿈해몽 깊은 풀이', topic: '주제운', premium: '종합사주', report: '종합사주',
  chat: '사주대화', daeun: '대운', monthly: '월운세', weekly: '주간운세', compat: '궁합', compatibility: '궁합', tojung: '신년운세',
  manse: '만세력', tti: '띠별 운세', etc: '기타',
};
/** 들어온 곳 이름 (utm_source 값 → 읽기 쉬운 말) */
export const SOURCE_NAME: Record<string, string> = {
  toss_app: '토스 앱 (출처 표시 없음)', '출처 없음': '출처 표시 없음', seo: '검색 페이지', share: '공유 링크', naver: '네이버 광고', meta: '메타 광고', instagram: '인스타그램',
  google: '구글 광고', kakao: '카카오 광고', threads: '스레드', mail: '메일', invite: '친구 초대',
};
export const AI_NAME: Record<string, string> = {
  ...CONTENT_NAME, dailyHead: '오늘의 운세 머리', ttiFortune: '띠별 운세', iljuDaily: '일주 아침 메일',
};
