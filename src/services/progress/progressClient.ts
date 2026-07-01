/**
 * progressClient — 점진 로딩 클라측 구독 (2026-07-01)
 *
 * 🛡️ additive·무해 폴백 절대원칙:
 *  - progress/{progressId} 를 onSnapshot 구독 → 도착한 그룹만 onGroup 콜백(중복 방지).
 *  - 구독 자체 실패·미존재 doc·권한 거부 = onError 만 호출(무해) → 화면은 기존 로딩/완성본 경로로 폴백.
 *  - spend/refund/save 등 머니·영속 로직을 import 하지도 호출하지도 않음(순수 UX 가속 레이어).
 */
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';

export interface ProgressSubscription {
  unsubscribe: () => void;
}

interface ProgressHandlers {
  /** 새로 도착한 그룹 1개 (groupKey, 그룹 데이터, 현재까지 도착한 전체 groups) */
  onGroup: (groupKey: string, data: unknown, allGroups: Record<string, unknown>) => void;
  /** 구독 실패/권한거부 — 무해. 호출측은 기존 경로로 폴백만 하면 됨 */
  onError?: (e: unknown) => void;
}

/** 점진 좌표 id 가 없거나 플래그 OFF 면 호출측에서 이걸 안 부르면 됨 */
export function subscribeProgress(progressId: string, handlers: ProgressHandlers): ProgressSubscription {
  const seen = new Set<string>();
  let unsub: () => void = () => {};
  try {
    unsub = onSnapshot(
      doc(db, 'progress', progressId),
      (snap) => {
        const data = snap.data() as { groups?: Record<string, unknown> } | undefined;
        const groups = data?.groups || {};
        for (const key of Object.keys(groups)) {
          if (!seen.has(key)) {
            seen.add(key);
            try {
              handlers.onGroup(key, groups[key], groups);
            } catch {
              /* 콜백 예외는 구독 유지 — 무해 */
            }
          }
        }
      },
      (err) => {
        // 구독 실패(권한/네트워크) — 무해. 기존 경로 폴백.
        handlers.onError?.(err);
      },
    );
  } catch (e) {
    handlers.onError?.(e);
  }
  return {
    unsubscribe: () => {
      try {
        unsub();
      } catch {
        /* noop */
      }
    },
  };
}
