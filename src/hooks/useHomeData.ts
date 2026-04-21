// v4.1 홈 데이터 훅 (P1-7 홈 v3용 재작성, 2026-04-21).
// 근거: 목업 "변준기 · 1995" ProfileSwitcher + 잔액·프로필 기반.

import { useEffect, useState } from 'react';
import { getProfiles, type SajuProfile, getMyProfile, getBalance } from '@/services/storage/localStore';

export interface HomeActiveProfile {
  profile: SajuProfile | null;
  name: string;
  birthYear?: number;
  hasProfile: boolean;
}

/** 현재 활성 프로필(본인 우선) + 존재 여부. */
export function useActiveProfile(): HomeActiveProfile {
  const [state, setState] = useState<HomeActiveProfile>({
    profile: null, name: '', hasProfile: false,
  });

  useEffect(() => {
    try {
      const my = getMyProfile();
      if (my) {
        setState({
          profile: my as unknown as SajuProfile,
          name: my.name || '사용자',
          birthYear: my.input?.birthYear,
          hasProfile: true,
        });
        return;
      }
      const ps = getProfiles();
      if (ps && ps.length > 0) {
        const p = ps[0];
        setState({ profile: p, name: p.name || '사용자', birthYear: p.input?.birthYear, hasProfile: true });
        return;
      }
      setState({ profile: null, name: '', hasProfile: false });
    } catch {
      setState({ profile: null, name: '', hasProfile: false });
    }
  }, []);

  return state;
}

/** 오늘의 운세 한마디 stub — TODO(Phase 2): generateDailyFortune 연결. */
export function useTodayHeadline(): string {
  // 요일·간지 기반 간단 변주. 실제 풀이는 /daily에서.
  const msgs = [
    '재물 기운이 천천히 움직이는 하루예요. 서두르지 말고 한 걸음씩 쌓아가세요.',
    '관계의 결이 부드러워지는 날. 오래 연락 안 한 이에게 한 줄 남겨보세요.',
    '결정보다 관찰이 이로운 자리예요. 오늘은 판단을 미루는 것도 방법입니다.',
    '작은 시도가 큰 흐름을 만드는 시점이에요. 준비만 오래 하던 일을 꺼내보세요.',
    '에너지가 안쪽으로 모이는 하루. 바깥보다 안을 정리하세요.',
  ];
  const idx = new Date().getDate() % msgs.length;
  return msgs[idx];
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
