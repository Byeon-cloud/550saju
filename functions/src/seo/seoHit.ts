/**
 * 검색용 정적 페이지의 광고 방문 기록 (2026-10-21)
 *
 *   /manse/, /unse/2027/ 같은 정적 페이지(scripts/seo/build-seo-pages.mjs)에는 앱 기록 코드가 없다. 그래서 광고로 와서
 *   그 페이지에서 바로 나간 손님은 판정 숫자에 보이지 않았다(네이버 광고비의 약 27%, 메타 V6_30min 이 이 페이지로 간다).
 *   광고 꼬리표가 붙은 방문만 받아 analytics 에 'seo_view' 한 줄을 남긴다. 기기 ID 는 앱과 같은 localStorage saju500:did 라
 *   이후 앱 화면 기록과 이어진다. 받는 값은 경로, 꼬리표, 기기 ID 뿐이다(이름, 생일 같은 개인정보는 받지 않는다).
 *   hosting rewrite /api/seo-hit → 이 함수(같은 주소라 CORS 없음).
 */
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

const AD_SOURCES = new Set(['meta', 'naver', 'tossads', 'instagram', 'facebook', 'google', 'kakao', 'creator', 'blog']);
const clip = (v: unknown, n = 60) => String(v ?? '').replace(/[^\w가-힣.\-:/ ]/g, '').slice(0, n);

export const seoHit = onRequest({ memory: '256MiB', timeoutSeconds: 10, maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const source = clip(b.source, 30).toLowerCase();
    const did = String(b.did || '');
    const path = String(b.path || '');
    // 광고로 온 방문만, 앱과 같은 모양의 기기 ID 만, 우리 사이트 경로만
    if (!AD_SOURCES.has(source) || !/^d_[a-z0-9]{6,30}$/.test(did) || !/^\/[\w\-/%.]{0,120}$/.test(path)) { res.status(204).end(); return; }
    const utm: Record<string, string> = { source };
    for (const k of ['medium', 'campaign', 'content', 'term'] as const) { const v = clip(b[k]); if (v) utm[k] = v; }
    await admin.firestore().collection('analytics').add({
      name: 'seo_view',
      uid: null,
      sid: 'static',
      did,
      props: { page_path: path, src: 'static' },
      utm,
      plat: 'web',
      ts: admin.firestore.FieldValue.serverTimestamp(),
      day: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
    });
    res.status(204).end();
  } catch {
    res.status(204).end();
  }
});
