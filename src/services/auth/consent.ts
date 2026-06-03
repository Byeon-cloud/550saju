/**
 * consent — 웹 단독 출시 개인정보 동의 이력 (개인정보보호법 제15조)
 *
 * 근거: docs/법적요건_웹출시.md §3
 *   - 로그인 직후(웹) 동의 이력이 없으면 ConsentModal 노출.
 *   - 동의 시 Firestore `users/{uid}.consent` + localStorage 플래그(빠른 게이팅) 저장.
 *   - 앱인토스(토스 동의 우산)에서는 사용하지 않음 — 호출부 `!isAppsInToss()` 게이팅.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import type { ConsentResult } from '@/components/auth/ConsentModal';

const LS_PREFIX = 'saju500:consent:v1:'; // + uid → '1'

/** localStorage 빠른 게이팅 — true 면 이미 동의(서버 조회 생략 가능). */
export function hasLocalConsent(uid: string): boolean {
  if (!uid) return false;
  try {
    return window.localStorage.getItem(LS_PREFIX + uid) === '1';
  } catch {
    return false;
  }
}

/** Firestore 동의 이력 확인 — localStorage 미스 시 서버 확인. */
export async function hasConsentRecord(uid: string): Promise<boolean> {
  if (!uid) return false;
  if (hasLocalConsent(uid)) return true;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const consent = snap.exists() ? (snap.data() as any)?.consent : null;
    const agreed = !!(consent && consent.terms === true && consent.privacy === true);
    if (agreed) {
      try { window.localStorage.setItem(LS_PREFIX + uid, '1'); } catch { /* noop */ }
    }
    return agreed;
  } catch {
    // 네트워크 실패 시 false → 동의 모달 재노출 (이미 동의했다면 재동의해도 무해)
    return false;
  }
}

/** 동의 저장 — Firestore merge + localStorage 플래그. */
export async function saveConsent(uid: string, result: ConsentResult): Promise<void> {
  if (!uid) return;
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        consent: {
          agreedAt: serverTimestamp(),
          terms: result.terms,
          privacy: result.privacy,
          marketing: result.marketing,
        },
      },
      { merge: true },
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[consent] Firestore 저장 실패:', e);
  }
  try { window.localStorage.setItem(LS_PREFIX + uid, '1'); } catch { /* noop */ }
}
