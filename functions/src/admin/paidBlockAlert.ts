/**
 * 돈을 낸 손님이 막히면 바로 알린다 (2026-10-23, 오너 '고객이 돈 내고 본다는데 왜 막냐, 두 번 생기게 하지 말자')
 *
 *   10-23 새벽 웹 손님 둘이 결제하고도 풀이가 막히거나 같은 종합사주를 두 번 샀는데 문의는 0건이었다(카카오 로그인이라 메일도 없음).
 *   막히는 곳(서버 '운이 부족합니다')이 17군데라 하나하나 고치는 대신, 10분마다 화면 기록을 훑어 돈을 낸 적 있는 손님이
 *   - 유료 풀이에서 '운이 부족합니다'로 막혔거나(ai_error reason)
 *   - 웹 종합사주가 실패로 보였다가 늦게 도착했거나(premium_late_done)
 *   - 화면이 '풀이를 만들지 못했어요'로 운을 돌려준 뒤 같은 풀이를 다시 샀으면(content_purchase 같은 종류 10분 안 두 번)
 *   backofficeAlerts(kind paid_user_blocked, 하루 손님당 한 번)에 남기고 오너 메일로 보낸다. 보상 지급은 오너 확인 뒤.
 */
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { MAIL_APP_PASSWORD, FROM_ADDR, mailTransport } from '../pdf/mailPdf';
import { OWNER_EMAILS, OWNER_UIDS } from './owner';

const kstDay = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const kstTime = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(11, 16);
const tsMs = (v: any): number => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'string' ? Date.parse(v) || 0 : 0);

export const alertPaidBlocked = onSchedule(
  { schedule: 'every 10 minutes', timeZone: 'Asia/Seoul', secrets: [MAIL_APP_PASSWORD], timeoutSeconds: 120, memory: '256MiB', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const since = now - 15 * 60 * 1000; // 10분 주기 + 여유
    const day = kstDay(now);
    const days = kstDay(since) === day ? [day] : [kstDay(since), day];
    const rows: any[] = [];
    for (const d of days) {
      const snap = await db.collection('analytics').where('day', '==', d)
        .where('name', 'in', ['ai_error', 'premium_late_done', 'content_purchase']).get();
      snap.forEach((s) => rows.push(s.data()));
    }
    const recent = rows.filter((e) => !e.internal && e.uid && tsMs(e.ts) >= since);
    const byUid = new Map<string, string[]>();
    const note = (uid: string, why: string) => { const a = byUid.get(uid) || []; if (!a.includes(why)) a.push(why); byUid.set(uid, a); };
    for (const e of recent) {
      if (OWNER_UIDS.includes(e.uid)) continue;
      const t = kstTime(tsMs(e.ts));
      if (e.name === 'ai_error' && /운이 부족/.test(String(e.props?.reason || ''))) note(e.uid, `${t} ${e.props?.type || '?'} 풀이가 '운이 부족합니다'로 막힘`);
      if (e.name === 'premium_late_done') note(e.uid, `${t} 웹 종합사주가 실패로 보였다가 늦게 도착(${e.props?.amount || '?'}운 다시 거둠)`);
    }
    // 같은 종류를 10분 안에 두 번 산 손님(실패로 보여 다시 산 경우)
    const buys = rows.filter((e) => !e.internal && e.uid && e.name === 'content_purchase').sort((a, b) => tsMs(a.ts) - tsMs(b.ts));
    for (let i = 1; i < buys.length; i++) {
      const a = buys[i - 1]; const b = buys[i];
      // 2026-10-26 — 주제운은 같은 주제일 때만(10-24 연애운 뒤 재회운을 산 손님이 경보로 잡힘, 두 풀이 다 정상)
      const sameTopic = a.props?.type !== 'topic' || (a.props?.topic || '') === (b.props?.topic || '');
      if (a.uid === b.uid && a.props?.type === b.props?.type && sameTopic && a.props?.type !== 'chat' && tsMs(b.ts) >= since && tsMs(b.ts) - tsMs(a.ts) < 10 * 60 * 1000 && !OWNER_UIDS.includes(b.uid)) {
        note(b.uid, `${kstTime(tsMs(b.ts))} ${b.props?.type} 를 ${Math.round((tsMs(b.ts) - tsMs(a.ts)) / 60000)}분 안에 두 번 삼(${a.props?.amount}운, ${b.props?.amount}운)`);
      }
    }
    if (!byUid.size) return;

    const lines: string[] = [];
    for (const [uid, whys] of byUid) {
      const u = await db.doc(`users/${uid}`).get();
      const charged = Number(u.data()?.totalCharged || 0);
      if (!(charged > 0)) continue; // 돈을 낸 적 있는 손님만
      const ref = db.collection('backofficeAlerts').doc(`paid_blocked_${day}_${uid}`);
      const prev = await ref.get();
      const prevWhys: string[] = prev.exists ? (prev.data()?.whys || []) : [];
      const fresh = whys.filter((w) => !prevWhys.includes(w));
      if (!fresh.length) continue;
      const bal = u.data()?.balance;
      const balText = typeof bal === 'number' ? `${bal}운` : bal ? `유료 ${bal.paid || 0} 보너스 ${bal.bonus || 0} 리워드 ${bal.reward || 0}` : '없음';
      await ref.set({ kind: 'paid_user_blocked', uid, day, whys: [...prevWhys, ...fresh], totalCharged: charged, balance: balText, at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      // 2026-10-23 — 연락 메일(카카오 account_email 선택 동의, 구글, 네이버). 오너 메일함으로만 보낸다
      let contact = '연락 메일 없음';
      try {
        const au = await admin.auth().getUser(uid);
        const mail = au.email || au.providerData.map((p) => p.email).find(Boolean);
        if (mail) contact = `연락 메일 ${mail}`;
      } catch { /* noop */ }
      lines.push(`회원 ID ${uid.slice(0, 8)}… (누적 결제 ${charged}운, 서버 잔액 ${balText}, ${contact})\n  - ${fresh.join('\n  - ')}`);
    }
    if (!lines.length) return;
    try {
      await mailTransport().sendMail({
        from: `"사주500 경보" <${FROM_ADDR}>`,
        to: [...OWNER_EMAILS, FROM_ADDR].join(','),
        subject: `[사주500 경보] 돈을 낸 손님이 막혔어요 (${lines.length}명)`,
        text: `${lines.join('\n\n')}\n\n관리자 '고객 찾기와 운 넣기'에서 회원 ID 로 찾아 결제 장부와 보관함을 보고 보상을 정해 주세요.\n기록: backofficeAlerts paid_blocked_${day}_{회원 ID}`,
      });
    } catch (e: any) {
      console.error('[alertPaidBlocked] 메일 실패', e?.message || e);
    }
    console.warn('[alertPaidBlocked]', lines.length);
  },
);
