/**
 * 기기 출석 운을 로그인 계정의 서버 장부에도 (2026-10-18) — 서버: functions/src/referral/referral.ts creditLocalReward
 *
 *   로그인한 계정(웹 소셜 로그인)은 서버가 users/{uid}.balance 에서 운을 깎는다. 출석 0.1운과 3일 연속 1운은 기기 잔액에만
 *   들어가서, 그 운으로 콘텐츠를 열면 '운이 부족합니다'가 났다. 기기에서 줄 때 여기에 적어 두고, 로그인 계정이면 서버에 알린다.
 *   서버가 하루 한 번, 서버 출석 기록으로 3일 연속을 직접 확인한 만큼만 넣는다. 익명 계정은 아무것도 하지 않는다.
 */
import { kstToday } from '@/utils/kstDate';

const KEY = 'saju500:reward_mirror_pending';
type Kind = 'daily' | 'streak3';
type Item = { kind: Kind; day: string; tries: number };

function read(): Item[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function write(list: Item[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-10))); } catch { /* noop */ }
}

export function queueServerReward(kind: Kind): void {
  const day = kstToday();
  const list = read().filter((x) => !(x.kind === kind && x.day === day));
  list.push({ kind, day, tries: 0 });
  write(list);
  flushServerRewards().catch(() => {});
}

let running = false;
export async function flushServerRewards(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const today = kstToday();
    let list = read().filter((x) => x.day === today && x.tries < 6); // 서버는 오늘 날짜로 판정 → 지난 날 몫은 버린다
    if (!list.length) { write([]); return; }
    const { auth } = await import('@/services/auth/firebase');
    if (!auth.currentUser || auth.currentUser.isAnonymous) { write(list); return; }
    const [{ httpsCallable }, { functions, ensureFunctionsTarget }] = await Promise.all([import('firebase/functions'), import('@/services/firebase/functionsClient')]);
    await ensureFunctionsTarget();
    const fn = httpsCallable<{ kind: Kind }, { ok: boolean; reason?: string }>(functions, 'creditLocalReward', { timeout: 15000 });
    const keep: Item[] = [];
    for (const it of list) {
      try {
        const r = (await fn({ kind: it.kind })).data;
        if (!r?.ok && r?.reason === 'not_yet') keep.push({ ...it, tries: it.tries + 1 }); // 서버 출석 기록이 아직 → 다음에 다시
      } catch {
        keep.push({ ...it, tries: it.tries + 1 });
      }
    }
    list = keep;
    write(list);
  } finally {
    running = false;
  }
}
