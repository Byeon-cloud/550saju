// v4.1 홈 데이터 훅 (P1-7 홈 v3용 재작성, 2026-04-21).
// 근거: 목업 "변준기 · 1995" ProfileSwitcher + 잔액·프로필 기반.

import { useEffect, useState } from 'react';
import { getProfiles, type SajuProfile, getMyProfile, getBalance, getReports, PROFILES_CHANGED_EVENT } from '@/services/storage/localStore';
import { buildTodayHeadline, dayPillarOf } from '@/services/saju/todayHeadline';
import { kstToday } from '@/utils/kstDate';

export interface HomeActiveProfile {
  profile: SajuProfile | null;
  name: string;
  birthYear?: number;
  hasProfile: boolean;
}

function readActiveProfile(): HomeActiveProfile {
  try {
    const my = getMyProfile();
    if (my) {
      return { profile: my as unknown as SajuProfile, name: my.name || '사용자', birthYear: my.input?.birthYear, hasProfile: true };
    }
    const ps = getProfiles();
    if (ps && ps.length > 0) {
      const p = ps[0];
      return { profile: p, name: p.name || '사용자', birthYear: p.input?.birthYear, hasProfile: true };
    }
  } catch { /* noop */ }
  return { profile: null, name: '', hasProfile: false };
}

/** 현재 활성 프로필(본인 우선) + 존재 여부.
 *  2026-10-14 — 첫 화면부터 바로 읽고(예전엔 빈 상태로 한 번 그린 뒤 채움), 부팅 뒤 복원이나 다른 화면에서
 *  사주를 넣으면 다시 읽는다. 예전엔 화면이 열릴 때 한 번만 읽어서, 기기 여권이 사주를 복원해도 홈이
 *  '내 사주 넣기'에 머물렀다. */
export function useActiveProfile(): HomeActiveProfile {
  const [state, setState] = useState<HomeActiveProfile>(readActiveProfile);

  useEffect(() => {
    const refresh = () => setState((prev) => {
      const next = readActiveProfile();
      const same = prev.hasProfile === next.hasProfile && prev.profile?.id === next.profile?.id && prev.name === next.name
        && (prev.profile as any)?.sajuData?.pillars?.[2]?.천간 === (next.profile as any)?.sajuData?.pillars?.[2]?.천간;
      return same ? prev : next;
    });
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener(PROFILES_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', onVisible);
    refresh();
    return () => {
      window.removeEventListener(PROFILES_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return state;
}

/**
 * 홈 '오늘의 운세' 한 줄 (2026-10-03 — 날짜로 돌리던 고정 5문장 stub 교체).
 *   ① 오늘 이 사람의 오늘의 운세를 이미 받았으면 그 AI 결과 한 줄(scoreHeadline)
 *   ② 아니면 오늘 일진 × 이 사람 일간의 십성(+일지 충)으로 고른 결정론 문장
 *   ③ 사주 정보가 없으면 오늘 일진만 알려주는 문장
 */
export function useTodayHeadline(profile?: SajuProfile | null, name?: string): string {
  const today = kstToday();
  const todayGanzi = dayPillarOf(today);
  const pillars = (profile?.sajuData as any)?.pillars;
  const dayGan: string = pillars?.[2]?.천간 || '';
  const dayJi: string | undefined = pillars?.[2]?.지지 || undefined;
  const pid = profile?.id;
  const birthKey = profile?.input ? `${profile.name}_${profile.input.birthYear}_${profile.input.birthMonth}_${profile.input.birthDay}` : '';

  // ① 오늘 받은 운세가 있으면 그 결과의 한 줄이 가장 정확하다
  try {
    const rec = getReports().find((r: any) => {
      if (r?.contentType !== 'daily' || r?.aiResult?.__partial) return false;
      const fd = r?.aiResult?.__fortuneDate;
      if (fd !== today) return false;
      if (pid && r.profileId === pid) return true;
      return !!birthKey && `${r.name}_${r.input?.birthYear}_${r.input?.birthMonth}_${r.input?.birthDay}` === birthKey;
    }) as any;
    const h = String(rec?.aiResult?.scoreHeadline || '').replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
    if (h) return h;
  } catch { /* 기본 문장으로 */ }

  // ② 사주 기반 결정론
  const line = buildTodayHeadline(dayGan, dayJi, todayGanzi, name || profile?.name || '');
  if (line) return line;

  // ③ 사주 정보 없음 — 오늘 일진만
  return todayGanzi
    ? `오늘은 ${todayGanzi}일이에요. 내 일간과 오늘 기운이 어떻게 만나는지 풀어드릴게요.`
    : '오늘 내 사주에 들어오는 기운을 풀어드릴게요.';
}

/** 현재 운 잔액 (paid + bonus + reward 합). */
export function useBalance(): number {
  const [bal, setBal] = useState<number>(0);
  useEffect(() => {
    try {
      setBal(getBalance());
    } catch {
      setBal(0);
    }
  }, []);
  return bal;
}
