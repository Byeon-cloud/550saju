/**
 * 이벤트 추적 — GA4 (gtag) + Firestore 이벤트 로그 (어드민 대시보드용).
 *
 * 2026-05-29 — 어드민 대시보드(/admin)가 in-app 으로 퍼널·인기·체류를 보려면 쿼리 가능한
 *   데이터가 필요. GA4 는 외부(analytics.google.com)에서만 보이므로, 핵심 이벤트를
 *   Firestore `analytics/{autoId}` 에 경량 append (name, uid, sessionId, ts, props).
 *   비용: 이벤트당 1 write (출시 초기 저트래픽 OK). fire-and-forget — 실패해도 UX 영향 0.
 */

/** GA4 (외부 대시보드용 — 유입경로·유저플로우·체류시간) */
/** 토스 자체 analytics(@apps-in-toss web-analytics)로 핵심 이벤트 미러 (2026-06-27 · D).
 *  토스 콘솔에 screen/click 네이티브 이벤트 전송 → 토스가 유입 컨텍스트(discovery/검색/추천)로 귀속.
 *  utm 으로 못 잡는 '토스 내부 유입' attribution 을 토스 콘솔에서 보기 위함. best-effort · 앱인토스에서만. */
const TOSS_MIRROR = new Set(['page_view', 'cta_click', 'content_open', 'content_purchase', 'charge_complete']);
function mirrorToTossAnalytics(eventName: string, params?: Record<string, string | number>): void {
  if (!TOSS_MIRROR.has(eventName)) return;
  try {
    import('@/lib/env').then(({ isAppintosBuild }) => {
      if (!isAppintosBuild) return;
      import('@apps-in-toss/web-framework').then((mod: any) => {
        const A = mod?.Analytics;
        if (!A) return;
        const logName = String(params?.page_path ?? params?.label ?? params?.type ?? eventName);
        if (eventName === 'page_view') A.screen?.({ log_name: logName });
        else A.click?.({ log_name: eventName, target: logName });
      }).catch(() => { /* noop */ });
    }).catch(() => { /* noop */ });
  } catch { /* noop */ }
}

export function trackEvent(eventName: string, params?: Record<string, string | number>) {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', eventName, params);
  }
  // Firestore 경량 로그 (in-app 어드민용) — 핵심 이벤트만
  logToFirestore(eventName, params);
  // 토스 자체 analytics 미러 (D) — 앱인토스 콘솔 네이티브 유입/퍼널 (토스 내부 유입 attribution)
  mirrorToTossAnalytics(eventName, params);
  // 2026-10-17 별점 요청 후보 (앱인토스만, 시험 E12) — 결과 도달과 운 차감 성공만 본다
  if (eventName === 'content_result' || eventName === 'content_purchase') {
    import('@/services/review/reviewPrompt').then((m) => m.noteReviewSignal(eventName, params)).catch(() => {});
  }
}

export function trackPageView(pagePath: string) {
  trackEvent('page_view', { page_path: pagePath });
  // 2026-05-29 — 경로에서 콘텐츠 진입/결과 자동 파생 (어드민 퍼널·인기 — 페이지 수정 0).
  const t = contentTypeFromPath(pagePath);
  if (t) trackEvent('content_open', { type: t });
  // 2026-06-12 — 주제별 진입 (어떤 운을 클릭했는지: /topic/love → topic_open {topic:'love'})
  const tm = pagePath.match(/^\/topic\/([a-z]+)/);
  if (tm) trackEvent('topic_open', { topic: tm[1] });
  if (/^\/result\b/.test(pagePath)) trackEvent('content_result', { type: 'premium' });
  if (/^\/charge\b/.test(pagePath)) trackEvent('charge_open', {});
}

function contentTypeFromPath(p: string): string | null {
  if (/^\/daily\b/.test(p)) return 'daily';
  if (/^\/dream\b/.test(p)) return 'dream';
  if (/^\/topic\b/.test(p)) return 'topic';
  if (/^\/premium\b/.test(p)) return 'premium';
  if (/^\/chat\b/.test(p)) return 'chat';
  return null;
}

/* ─── Firestore 이벤트 로그 (어드민 대시보드 소스) ─── */

// 세션 식별 (같은 방문 묶기) — sessionStorage
function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('saju500:sid');
    if (!sid) {
      sid = `${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
      sessionStorage.setItem('saju500:sid', sid);
    }
    return sid;
  } catch {
    return 'nosession';
  }
}

/* ─── 기기 식별 (2026-06-12 · DAU 정확도) ───
 *   sid 는 세션마다 바뀌어 익명 유저가 매 방문 '새 사람'으로 집계됨.
 *   localStorage 영속 deviceId 로 같은 기기 = 같은 방문자 보장. */
function getLocalDeviceId(): string {
  try {
    let did = localStorage.getItem('saju500:did');
    if (!did) {
      did = `d_${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
      localStorage.setItem('saju500:did', did);
    }
    return did;
  } catch {
    return 'nodevice';
  }
}

/* ─── 인구통계 (2026-06-12 · 성별/연령대) ───
 *   본인 사주 프로필(saju500_my_profile → saju500_profiles)에서 gender + birthYear 파생.
 *   이름·생일 원본은 절대 전송 X — {g: 'M'|'F', ab: '20대'} 만. 5분 캐시. */
let demoCache: { v: { g?: string; ab?: string } | null; at: number } | null = null;
function getDemo(): { g?: string; ab?: string } | null {
  if (demoCache && Date.now() - demoCache.at < 5 * 60 * 1000) return demoCache.v;
  let v: { g?: string; ab?: string } | null = null;
  try {
    const profiles = JSON.parse(localStorage.getItem('saju500_profiles') || '[]');
    if (Array.isArray(profiles) && profiles.length > 0) {
      const myId = localStorage.getItem('saju500_my_profile');
      const p = profiles.find((x: any) => x?.id === myId) ?? profiles[0];
      const input = p?.input;
      if (input) {
        const g = input.gender === 'male' ? 'M' : input.gender === 'female' ? 'F' : undefined;
        let ab: string | undefined;
        const year = Number(input.birthYear);
        if (year > 1900 && year < 2030) {
          const age = new Date().getFullYear() - year;
          ab = age < 20 ? '10대' : age < 30 ? '20대' : age < 40 ? '30대'
            : age < 50 ? '40대' : age < 60 ? '50대' : '60대+';
        }
        if (g || ab) v = { ...(g ? { g } : {}), ...(ab ? { ab } : {}) };
      }
    }
  } catch { /* noop */ }
  demoCache = { v, at: Date.now() };
  return v;
}

/* ─── 전역 CTA 클릭 수집 (2026-06-12) ───
 *   button / [role=button] / a 클릭을 문서 레벨에서 위임 수집 — 페이지별 wiring 0.
 *   label = aria-label 우선, 없으면 텍스트 40자. 같은 라벨 800ms 내 중복 무시. */
let lastCta = { label: '', at: 0 };
function initCtaTracking(): void {
  const w = window as unknown as { __saju500CtaInit?: boolean };
  if (w.__saju500CtaInit) return;
  w.__saju500CtaInit = true;
  document.addEventListener('click', (ev) => {
    try {
      const target = ev.target as HTMLElement | null;
      const el = target?.closest?.('button, [role="button"], a') as HTMLElement | null;
      if (!el) return;
      if (window.location.pathname.startsWith('/admin')) return; // 어드민 자체 클릭 제외
      const label = (el.getAttribute('aria-label') || el.textContent || '')
        .replace(/\s+/g, ' ').trim().slice(0, 24); // 카드 통째 텍스트 이어붙음 노이즈 컷 (2026-06-12)
      if (!label) return;
      const now = Date.now();
      if (label === lastCta.label && now - lastCta.at < 800) return;
      lastCta = { label, at: now };
      trackEvent('cta_click', { label, page: window.location.pathname });
    } catch { /* noop */ }
  }, { capture: true, passive: true });
}

// 어드민 집계에 의미있는 이벤트만 Firestore 에 기록 (노이즈·비용 절감)
const FIRESTORE_TRACKED = new Set<string>([
  'app_open',
  'page_view',
  'content_open',       // {type: daily|dream|topic|premium|chat}
  'content_result',     // {type} — 결과 도달 (퍼널)
  'topic_select',       // {topic} — 결제 확정 시
  'topic_open',         // {topic} — 주제 페이지 진입 (2026-06-12)
  'charge_open',        // 충전 페이지 진입
  'charge_complete',    // {amount, package}
  'share_click',        // {type, page, balance} — 공유 '시도' (버튼 클릭 시점)
  'share_complete',     // {type, method, rewarded} — 공유 '성사' (2026-07-03 바이럴 퍼널 — method: toss_viral|toss_share|web_share|clipboard|web_share_file)
  'reward_earned',      // {kind, amount}
  // 2026-10-15 띠별 오늘의 운세 (혜택탭 유입 → 입력 전환 측정)
  'tti_open',           // {tti, src: hero|family}
  'tti_year',           // {year, src}
  'tti_input',          // {src, step: grid|panel|card|family} — 띠 화면에서 생일 넣기
  'tti_newyear',        // {tti} — 내 운세 칸의 내년 띠 운 → 신년운세
  'tti_compat',         // {tti} — 가족 띠 칸의 나와 궁합
  // 대시보드 v2 (2026-06-10) — 콘텐츠 구매 + AI 품질 + 광고
  'content_purchase',   // {type, amount(운), topic?} — 운 차감 성공 직후
  'ai_done',            // {type, ms, mode: sse|callable}
  'ai_error',           // {type, mode}
  'ad_impression',      // {unit}
  'ad_click',           // {unit}
  'ad_nofill',          // {unit}
  'ad_fail',            // {unit}
  // 대시보드 v3 (2026-06-12) — CTA 클릭 (전역 위임 수집)
  'cta_click',          // {label, page}
  'noti_agree',         // {result: newAgreement|alreadyAgreed|agreementRejected} — 매일 운세 알림 동의 (2026-06-13)
  // 2026-06-18 데이터 정확성 감사 — 드롭 이벤트 복구 + 결제 퍼널 누락 보강
  'client_error',       // {msg, chunk, path} — 렌더/청크 에러 (화이트스크린 진단 비콘 — 기존 GA4 만 가고 드롭되던 것)
  'charge_failed',      // {pg, package?, amount?, reason} — 결제 실패/취소 (결제 퍼널 drop-off — 기존 미트래킹)
  // 2026-06-18 트래킹 커버리지 — 코호트·바이럴·활성화 핵심 행동
  'signup',             // {} — 기기 최초 부팅(신규 유저 first-seen — 정확한 코호트/신규 집계)
  'profile_created',    // {relation, hourKnown} — 사주 프로필 첫 생성 (활성화 onboarding)
  'invite_received',    // {granted, reason} — 공유링크 수신 전환 (바이럴 K-factor)
  'login_success',      // {provider} — 소셜/토스 로그인 성공
  'insufficient_balance', // {type, needed} — 잔액부족 감지(충전 유도 직전 — 전환 모멘트)
  'share_view',         // {type} — 공유 받은 사람이 받은 화면을 열었다 (2026-10-17 궁합 보내기 E7)
  'mail_subscribe',     // {source} — 신년운세 마감 전 메일 알림 신청 (2026-10-17 시험 E14, 웹)
  'charge_free_first',  // {} — 사주 없는 사람이 충전 화면에서 무료 오늘의 운세로 (2026-10-17)
  'input_leave',        // {filled} — 입력을 끝내지 않고 나감, 채운 칸 (2026-10-17)
  'input_blocked',      // {missing} — 입력 화면에서 빈 칸이 있는데 시작을 눌렀다 (2026-10-17 입력 41% 이탈 진단)
  'review_request',     // {result: shown|unsupported|error, n} — 토스 별점 창 요청 (2026-10-17 시험 E12)
  'month_picks_view',   // {n, day} — 월초 홈 '이번 달 좋은 날' 카드가 보였다 (2026-10-17 단골 장치)
  'month_picks_click',  // {day} — 그 카드에서 월운세로 (2026-10-17)
  'storage_full',       // {evicted, saved, kb} — 기기 저장 공간이 차서 옛 기록을 지웠다 (2026-10-17 보관함 점검)
  'birthday_card_view', // {m, ny} — 생일 달 카드가 보였다 (2026-10-17 단골 장치 2번)
  'birthday_card_click',// {to: tojung|premium} — 생일 달 카드에서 상품으로
  'suneung_card_view',  // {who: parent|student} — 수능 시즌 홈 카드가 보였다 (2026-10-17, 11/1~11/19)
  'suneung_card_click', // {who} — 수능 카드에서 합격이직운으로
  'inv_visit',          // {isNew, ok, manual?} — 친구 초대 링크로 들어온 기록이 서버에 남았다 (2026-10-18)
  'inv_complete',       // {status} — 초대받은 친구가 받기를 눌렀다 (granted, need_login, not_new 등)
  'inv_claim',          // {amount} — 적립 대기 운을 받아 잔액에 더했다
  'inv_page_view',      // {hasSaju} — 친구 초대 화면
  'inv_welcome_view',   // {hasSaju} — 초대받은 친구 카드가 보였다
  'inv_welcome_click',  // {app} — 초대받은 친구 카드 버튼
  'cjoin_answer',       // {score} — 받은 궁합 초대장에 내 사주로 답했다 (2026-10-18 E16)
  'tojung_preview_view', // {y, v} — 신년운세 결제 전 무료 미리 보기가 보였다 (2026-10-17, 10일 48명 보고 0명 구매 대응)
  'web_intro_view',     // {} — 웹 첫 손님 소개 카드가 보였다 (2026-10-17, 웹 전용)
]);

/* ─── UTM/유입 채널 (C5 · 2026-06-10) ───
 *   첫 진입 시 location.search 의 utm_source/utm_medium/utm_campaign + ref 를 sessionStorage 에
 *   저장 → 세션 내 모든 Firestore 이벤트에 utm 첨부 (있을 때만). fire-and-forget. */
const UTM_KEY = 'saju500:utm';

/** 토스 referrer 파싱 — '캠페인.소재.채널.형식.-' 꼴. 채널(PUSH 등)을 medium 으로, 원문을 campaign 으로 */
function parseTossReferrer(raw: string | null): { source: string; medium: string; campaign: string } {
  if (!raw) return { source: '', medium: '', campaign: '' };
  const parts = raw.split('.');
  const ch = (parts[2] || '').toLowerCase();
  return { source: 'toss_ref', medium: ch || 'unknown', campaign: raw.slice(0, 80) };
}

function captureUtm(): void {
  try {
    if (sessionStorage.getItem(UTM_KEY)) return; // 세션 최초 1회만 (이후 내부 네비게이션은 무시)
    const q = new URLSearchParams(window.location.search);
    // 2026-10-16 — 토스가 광고 푸시, 프로모션 링크에 붙이는 referrer(예: 34866.181660.PUSH.TEXT_PUSH.-)도 출처로 (그전엔 전부 'toss_app' 하나로 뭉쳤다)
    const tref = parseTossReferrer(q.get('referrer'));
    const source = q.get('utm_source') || q.get('ref') || tref.source;
    const medium = q.get('utm_medium') || tref.medium;
    const campaign = q.get('utm_campaign') || tref.campaign;
    if (!source && !medium && !campaign) return;
    sessionStorage.setItem(UTM_KEY, JSON.stringify({
      ...(source ? { source } : {}),
      ...(medium ? { medium } : {}),
      ...(campaign ? { campaign } : {}),
    }));
  } catch { /* noop */ }
}

function getUtm(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(UTM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/* ─── 앱인토스 진입 출처 캡처 (2026-06-27 · A) ───
 *   토스 딥링크(intoss://saju-500/path?utm_source=threads)가 query 를 webview location.search 로
 *   안 넘기는 경우, 토스 SDK getSchemeUri() = 실행 스킴 URI 통째 → 거기서 utm/ref 파싱.
 *   웹 utm(captureUtm)이 이미 source 를 잡았으면 스킵. best-effort, 웹 빌드선 early-return. */
async function captureTossSchemeUtm(): Promise<void> {
  try {
    const { isAppintosBuild } = await import('@/lib/env');
    if (!isAppintosBuild) return;
    const existing = getUtm() || {};
    if (existing.source) return; // 이미 출처 확보 시 스킵
    const mod: any = await import('@apps-in-toss/web-framework');
    const uri: string = typeof mod?.getSchemeUri === 'function' ? (mod.getSchemeUri() || '') : '';
    const qi = uri.indexOf('?');
    const q = new URLSearchParams(qi >= 0 ? uri.slice(qi + 1) : '');
    const tref = parseTossReferrer(q.get('referrer'));
    const source = q.get('utm_source') || q.get('ref') || tref.source;
    const medium = q.get('utm_medium') || tref.medium;
    const campaign = q.get('utm_campaign') || tref.campaign;
    sessionStorage.setItem(UTM_KEY, JSON.stringify({
      ...existing,
      // utm 태그 있으면 그 출처, 없으면 'toss_app'(토스 내부 discovery/검색/추천 or 무태그 딥링크) — 웹 direct 와 구분
      source: source || 'toss_app',
      ...(medium ? { medium } : {}),
      ...(campaign ? { campaign } : {}),
    }));
  } catch { /* noop — 출처 캡처는 fire-and-forget */ }
}

// 모듈 init 시 1회 캡처 (SSR 안전 가드) + 전역 CTA 클릭 수집 시작
if (typeof window !== 'undefined') { captureUtm(); captureTossSchemeUtm(); initCtaTracking(); }

/** 2026-06-12 P0 — 부팅 이벤트가 익명 로그인 완료 전에 발사되면 rules(auth 필수)에 막혀
 *  조용히 버려지던 레이스 fix. 첫 auth 상태 확정까지 최대 6초 대기 후 기록. */
function waitForAuth(auth: { currentUser: unknown; onAuthStateChanged: (cb: (u: unknown) => void) => () => void }): Promise<void> {
  if (auth.currentUser) return Promise.resolve();
  return new Promise((resolve) => {
    const to = setTimeout(() => { try { unsub(); } catch { /* noop */ } resolve(); }, 6000);
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) { clearTimeout(to); try { unsub(); } catch { /* noop */ } resolve(); }
    });
  });
}

/** 내부 트래픽 판정 (2026-06-12) — 가짜 데이터 원천 차단.
 *  localhost/127.* = 개발 → 기록 자체 skip. 오너 기기(/admin 방문 이력) = internal:true 마킹 → 집계 제외. */
function internalKind(): 'dev' | 'owner' | null {
  try {
    // 🚨 2026-06-23 CRITICAL — 토스 앱(앱인토스 webview)은 hostname 이 localhost-류여도 '실 트래픽'이므로
    //   dev 로 제외하면 안 됨. 기존: 토스 webview 가 localhost 면 dev 판정 → logToFirestore line 233 에서
    //   전 이벤트 드롭 → 어드민이 앱인토스 DAU 500·프로모(1040원/104건)를 0 으로 집계하던 근본원인.
    const isToss = (typeof navigator !== 'undefined' && /InTossApp/i.test(navigator.userAgent))
      || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BUILD_TARGET === 'appintos');
    const h = window.location.hostname;
    if (!isToss && (h === 'localhost' || h.startsWith('127.') || h.startsWith('192.168.'))) return 'dev';
    if (localStorage.getItem('saju500:internal') === '1') return 'owner';
  } catch { /* noop */ }
  return null;
}

/* 플랫폼 판별 (2026-06-12 · 어드민 웹/앱 분리) — 모듈 1회 캐시 */
let platCache: 'web' | 'ait' | null = null;
async function getPlat(): Promise<'web' | 'ait'> {
  if (platCache) return platCache;
  try {
    // SSOT 통일 (2026-06-24) — internalKind/env 는 InTossApp UA + 빌드플래그, iapService 는 TossApp UA 로
    //   토스 판정이 갈려 토스 이벤트가 plat:'web' 으로 잘못 라벨링되던 것 차단(어드민 '웹' 필터에 토스 이벤트
    //   오집계 — "웹에도 매출" 혼선 원인). 빌드플래그(가장 신뢰 — .ait 는 항상 appintos) 우선 + UA 양쪽 매칭.
    const { isAppintosBuild } = await import('@/lib/env');
    if (isAppintosBuild) { platCache = 'ait'; return platCache; }
    const { isAppsInToss } = await import('@/services/payment/iapService');
    platCache = isAppsInToss() ? 'ait' : 'web';
  } catch { platCache = 'web'; }
  return platCache;
}

function logToFirestore(eventName: string, params?: Record<string, string | number>) {
  if (!FIRESTORE_TRACKED.has(eventName)) return;
  const internal = internalKind();
  if (internal === 'dev') return; // 로컬 개발 — 아예 기록 안 함
  // 동적 import — analytics 가 firebase 를 직접 끌고 오지 않게 (번들 분리 + 실패 무해)
  import('@/services/auth/firebase')
    .then(async ({ db }) => {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      await waitForAuth(getAuth() as any); // 익명 로그인 레이스 해소 (rules: auth 필수)
      const uid = getAuth().currentUser?.uid ?? null;
      const utm = getUtm();
      const demo = getDemo();
      await addDoc(collection(db, 'analytics'), {
        name: eventName,
        uid,
        sid: getSessionId(),
        did: getLocalDeviceId(),   // 기기 영속 ID (DAU 정확도 — 2026-06-12)
        props: params ?? {},
        ...(utm ? { utm } : {}), // 유입 채널 (있을 때만 — C5)
        ...(demo ? { demo } : {}), // 성별·연령대 (본인 프로필 파생 — 2026-06-12)
        ...(internal === 'owner' ? { internal: true } : {}), // 오너 기기 — 집계 제외 마킹
        plat: await getPlat(), // 웹/토스앱 분리 (2026-06-12)
        ts: serverTimestamp(),
        // 날짜 버킷 (집계 쿼리 효율) — KST 기준 YYYY-MM-DD
        day: kstDay(),
      });
      const w = window as unknown as { __saju500EvOk?: boolean };
      if (!w.__saju500EvOk) { w.__saju500EvOk = true; try { console.info('[analytics] first event written:', eventName); } catch { /* noop */ } }
    })
    .catch((e) => {
      // fire-and-forget 이되, 드롭 원인은 콘솔로 노출 (2026-06-12 — 조용한 유실 디버깅)
      try { console.warn('[analytics] drop:', eventName, (e as any)?.code || (e as any)?.message || e); } catch { /* noop */ }
    });
}

function kstDay(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 콘텐츠 진입/결과 추적 헬퍼 (페이지에서 호출) */
export function trackContentOpen(type: string) { trackEvent('content_open', { type }); }
export function trackContentResult(type: string) { trackEvent('content_result', { type }); }
