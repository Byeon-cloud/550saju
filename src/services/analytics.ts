/**
 * 이벤트 추적 — GA4 (gtag) + Firestore 이벤트 로그 (어드민 대시보드용).
 *
 * 2026-05-29 — 어드민 대시보드(/admin)가 in-app 으로 퍼널·인기·체류를 보려면 쿼리 가능한
 *   데이터가 필요. GA4 는 외부(analytics.google.com)에서만 보이므로, 핵심 이벤트를
 *   Firestore `analytics/{autoId}` 에 경량 append (name, uid, sessionId, ts, props).
 *   비용: 이벤트당 1 write (출시 초기 저트래픽 OK). fire-and-forget — 실패해도 UX 영향 0.
 */
import { isAppintosBuild } from '@/lib/env';
import { inAppBrowserName } from '@/utils/inAppBrowser';
import { displayModeLabel } from '@/lib/displayMode';

/** GA4 (외부 대시보드용 — 유입경로·유저플로우·체류시간) */
/** 토스 자체 analytics(@apps-in-toss web-analytics)로 핵심 이벤트 미러 (2026-06-27 · D).
 *  토스 콘솔에 screen/click 네이티브 이벤트 전송 → 토스가 유입 컨텍스트(discovery/검색/추천)로 귀속.
 *  utm 으로 못 잡는 '토스 내부 유입' attribution 을 토스 콘솔에서 보기 위함. best-effort · 앱인토스에서만. */
// 2026-10-18 — 결과 도달, 사주 입력, 보내기를 더한다. 토스 추천 미니앱 평가(10-22 노출 정책)가 콘솔 '핵심 지표'의
//   전환 지표를 보는데, 토스에 오는 이벤트로만 지표를 만들 수 있어 '운세 결과 받은 사람'을 걸 수 없었다.
const TOSS_MIRROR = new Set(['page_view', 'cta_click', 'content_open', 'content_purchase', 'charge_complete', 'content_result', 'profile_created', 'share_complete']);
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

const AD_EVENTS = new Set(['page_view', 'profile_created', 'content_result', 'charge_open', 'charge_complete']);
const TOSS_PX_EVENTS = new Set(['page_view', 'content_open', 'charge_open', 'pay_sheet_open', 'charge_complete', 'profile_created', 'login_success']);

export function trackEvent(eventName: string, params?: Record<string, string | number>) {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', eventName, params);
  }
  // Firestore 경량 로그 (in-app 어드민용) — 핵심 이벤트만
  logToFirestore(eventName, params);
  // 토스 자체 analytics 미러 (D) — 앱인토스 콘솔 네이티브 유입/퍼널 (토스 내부 유입 attribution)
  mirrorToTossAnalytics(eventName, params);
  // 2026-10-19 웹 유료광고 전환 추적 (메타, 네이버, 구글) — 앱 빌드에서는 코드째 빠진다(빌드 상수), 번호가 없으면 아무것도 안 함
  if (import.meta.env.VITE_BUILD_TARGET !== 'appintos' && AD_EVENTS.has(eventName)) {
    import('@/services/ads/adPixels').then((m) => m.adEvent(eventName, params)).catch(() => {});
  }
  // 2026-10-22 토스애즈 전환 추적(토스 픽셀) — 앱 번들에서만, VITE_TOSS_PIXEL_CODE 가 있을 때만(tossPixel.ts)
  if (import.meta.env.VITE_BUILD_TARGET === 'appintos' && TOSS_PX_EVENTS.has(eventName)) {
    import('@/services/ads/tossPixel').then((m) => m.tossPixelEvent(eventName, params)).catch(() => {});
  }
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
  if (/^\/daily\/?$/.test(p)) return 'daily'; // 10-19 /daily/card(오늘 운세 한 장)는 열람으로 세지 않는다
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
        const ab = ageBandOfYear(Number(input.birthYear));
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
  'topic_preview_view', // {topic, ok: 1|0} — 주제운 결제 전 미리 보기(짚을 해, 앞으로 가장 좋은 달)를 불러 보였다 1, 못 불러 숨겼다 0 (2026-10-23 1.6.3 P1-6)
  'topic_start',        // {topic} — 주제운 입력 화면에서 '분석하기'를 눌렀다 (결제 확인 창 열기 전, topic_open 대비 시작 비율)
  'charge_open',        // 충전 페이지 진입
  'charge_view',        // {src, defaultPkg, firstPayer: 1|0} — 충전 화면 진입 한 번, 기본으로 골라 둔 묶음과 첫 결제 손님 여부 (2026-10-22 1.6.3 P1-1)
  'premium_late_done',  // {amount} — 웹 종합사주가 실패로 보인 뒤 늦게 도착해 결과를 주고 돌려준 운을 다시 거뒀다(2026-10-23)
  'welcome_un_claim',   // {ok, why} — 로그인 계정의 기본 1운을 서버에 한 번 넣어 달라고 했다
  'pay_sheet_open',     // {pg, amount, package} — 결제창을 실제로 여는 순간(앱 IAP 요청 직전, 웹 포트원 호출 직전, 2026-10-22)
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
  'login_fail',         // {provider, via: popup|redirect, code} — 웹 소셜 로그인 실패 (2026-10-19 모바일 리다이렉트 결과 유실 진단)
  'daily_offer_start',  // {} — 첫 오늘의 운세로 종합사주 반값 24시간이 열렸다 (2026-10-19 시험 E25)
  'daily_offer_view',   // {pos: top|end} — 반값 카드가 보였다
  'daily_offer_click',  // {pos, short} — 반값 카드를 눌렀다 (short=운이 모자람)
  'inquiry_sent',       // {category} — 웹 문의 양식으로 문의를 남겼다 (2026-10-19 웹 문의함)
  'charge_login_gate',  // {source} — 웹 결제 전 로그인 시트가 떴다 (2026-10-16 추가했으나 기록 목록에 없어 버려지던 것, 10-19)
  'insufficient_balance', // {type, needed} — 잔액부족 감지(충전 유도 직전 — 전환 모멘트)
  'share_view',         // {type} — 공유 받은 사람이 받은 화면을 열었다 (2026-10-17 궁합 보내기 E7)
  'mail_subscribe',     // {source} — 신년운세 마감 전 메일 알림 신청 (2026-10-17 시험 E14, 웹)
  'mail_signup_view',   // {source} — 아침 운세 메일 신청 칸이 화면에 보였다(한 화면 한 번, 2026-10-22 관리자 메일 판)
  'mail_signup_open',   // {source} — 홈의 한 줄짜리 신청 칸을 펼쳤다
  'mail_signup_submit', // {source, ad} — 신청 버튼을 눌렀다
  'mail_signup_fail',   // {source, why} — 신청이 실패했다(서버 오류 문구 앞부분)
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
  'cjoin_answer',       // {score} — 받은 궁합 초대장에 내 사주로 답했다 (2026-10-18 E21)
  'manse_view',         // {ok, cal, hour, rel | why} — 검색 페이지 /manse/ 입력 칸에서 바로 만세력을 펼쳤다 (2026-10-18 E22)
  'tojung_preview_view', // {y, v} — 신년운세 결제 전 무료 미리 보기가 보였다 (2026-10-17, 10일 48명 보고 0명 구매 대응)
  'web_intro_view',     // {} — 웹 첫 손님 소개 카드가 보였다 (2026-10-17, 웹 전용)
  // 2026-10-22 P1-2, P1-9 — 종합사주 고르기 화면과 사주 카드 다음 단계 (들어온 곳별 시작 누름 비율)
  'premium_view',       // {src, has: 0|1, ad?} — 종합사주 화면을 열었다 (has = 고를 사주가 있음)
  'premium_start_click', // {src, step: intro|select, enough: 0|1, ad?} — 종합사주 시작 버튼을 눌렀다
  'premium_free_first', // {src, from: intro|gate, ad?} — 종합사주 화면에서 무료 오늘의 운세 먼저를 골랐다
  'saju_next_view',     // {ad?} — 사주 카드 아래 다음 단계 칸이 화면에 보였다
  'saju_next_click',    // {to: daily|주제 id, ad?} — 다음 단계 칸에서 눌렀다
  'next_click',         // {from: daily|topic_주제|dream|..., to: 주제 id|chat, kind: topic|question, pos} — 결과 끝 '이어서 보면 좋은 것'(2026-10-27 한 이름으로)
  'charge_login_wait',  // {result: ok|fail|timeout, tapped?} — 웹 로그인하고 돌아와 확인을 기다린 결과 (2026-10-27 '또 로그인' 고리 수리)
  // 2026-10-23 1.6.3 P1-4 — 오늘의 운세 결과 끝 (결과가 다음 콘텐츠로 이어지는지)
  'bridge_click',       // {from: daily, to: premium|weekly|monthly|chat|주제 id|menu_묶음, pos: offer_top|offer_end|next_topic|next_chat|grid|grid_menu|upsell|upsell_sub|actions|month_picks} — 결과의 연결 카드를 눌렀다
  'daily_scroll',       // {pct: 25|50|75|100} — 오늘의 운세 결과 화면을 그만큼 내려 읽었다(결과 하나에 한 번씩)
  // 2026-10-23 1.6.3 P1-3 — 홈 순서(고민을 종합사주 위로, 위 두 개만) 2주 비교: 종합사주 누름과 주제운 누름
  'home_topic_click',   // {topic: 주제 id|compat, pos: top|grid(10-25까지 more), rank, gen: young|mid|senior|none, has: 0|1} — 홈 고민 블록에서 눌렀다
  'home_topics_more',   // {gen, has} — 홈 '고민 더 보기'를 펼쳤다 (10-26 버튼 없앰, 고민 전부 펼침. 옛 앱 번들 기록용으로 남김)
  'home_premium_click', // {pos: book|card|cta, has} — 홈 종합사주 책, 소개, 버튼 중 하나를 눌렀다
  // 2026-10-26 돈 흐름 감시 — 기기와 서버 잔액 어긋남, 종합사주 늦은 결과와 자동 환불
  'server_spend_short',            // {type: daily|dream|dreamUnlock|chat, amount} — 서버 잔액이 모자라 기기 운으로만 진행했다(막지 않음)
  'premium_auto_refund_reclaimed', // {amount} — 자동 환불 뒤 늦게 온 종합사주를 보여 주며 그 운을 다시 거뒀다
  'premium_auto_refund_kept',      // {amount} — 다시 거둘 운이 모자라 결과 대신 '이미 돌려드렸어요' 안내
  'premium_reload_recover',        // {found: 0|1} — 새로 열린 종합사주 화면이 서버에서 결과를 찾았는지
  // 2026-10-23 1.6.3 P1-10 — 사주대화 첫 화면 진입 대비 첫 질문, 띠 표에서 입력 시작(나이대별)
  'chat_view',          // {has: 0|1, rooms: 0|1, free: 0|1, gen} — 사주대화 첫 화면(/chat)을 열었다
  'chat_starter_click', // {i: 0|1|2, gen, has} — 첫 화면 질문 버튼을 눌렀다 (사주가 있으면 바로 보낸다)
  'tti_view',           // {src: hero|family, ab?} — 띠 표가 보였다 (ab = 고른 해로 본 연령대, demo.ab 와 같은 이름)
  // 2026-10-23 웹 홈 화면 추가(PWA). 모든 문서의 disp(standalone|browser)로 홈 화면 앱 손님을 따로 본다
  'a2hs_guide_open',    // {src: my|home|link, plat} — 홈 화면에 추가하는 법 안내 시트를 열었다
  'a2hs_card_view',     // {plat, days} — 홈의 홈 화면 추가 안내 칸이 보였다 (다시 온 손님, 한 화면 한 번)
  'a2hs_card_click',    // {plat, act: guide|prompt} — 그 칸에서 눌렀다
  'a2hs_card_close',    // {plat} — 그 칸을 닫았다 (30일 안 보임)
  'a2hs_prompt_result', // {outcome: accepted|dismissed|unavailable|error|installed, src, plat} — 크롬 설치 창 결과, installed 는 appinstalled
  'pwa_open',           // {first: 0|1, os} — 홈 화면 앱으로 열었다 (세션당 한 번, first = 이 저장 공간에서 처음)
  'pwa_login_notice',   // {act: view|login|close} — 아이폰 홈 화면 앱의 '로그인하면 이어져요' 안내 칸
]);

/** 출생 연도 → 연령대 이름 (demo.ab 와 같은 규칙: 10대, 20대, 30대, 40대, 50대, 60대+) */
export function ageBandOfYear(year: number): string | undefined {
  if (!(year > 1900 && year < 2030)) return undefined;
  const age = new Date().getFullYear() - year;
  return age < 20 ? '10대' : age < 30 ? '20대' : age < 40 ? '30대'
    : age < 50 ? '40대' : age < 60 ? '50대' : '60대+';
}

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

/* 2026-10-20 — 웹은 태그 없이 다시 온 방문도 30일 안의 마지막 태그 출처로 본다.
 *   광고로 처음 온 손님이 다음 날 바로 들어와 결제하면 '출처 없음'이 돼 광고 성과를 못 읽었다.
 *   앱(토스)은 토스 홈 유입(toss_app)과 섞이지 않게 넘기지 않는다. */
const UTM_LAST_KEY = 'saju500:utm_last';
const UTM_CARRY_MS = 30 * 24 * 60 * 60 * 1000;

function captureUtm(): void {
  try {
    if (sessionStorage.getItem(UTM_KEY)) return; // 세션 최초 1회만 (이후 내부 네비게이션은 무시)
    const q = new URLSearchParams(window.location.search);
    // 2026-10-16 — 토스가 광고 푸시, 프로모션 링크에 붙이는 referrer(예: 34866.181660.PUSH.TEXT_PUSH.-)도 출처로 (그전엔 전부 'toss_app' 하나로 뭉쳤다)
    const tref = parseTossReferrer(q.get('referrer'));
    const source = q.get('utm_source') || q.get('ref') || tref.source;
    const medium = q.get('utm_medium') || tref.medium;
    const campaign = q.get('utm_campaign') || tref.campaign;
    // 2026-10-20 — 광고 소재(utm_content)와 노출 위치(utm_term)도 남긴다 (소재별 판정용)
    const content = (q.get('utm_content') || '').slice(0, 60);
    const term = (q.get('utm_term') || q.get('n_keyword') || '').slice(0, 60); // n_keyword = 네이버 검색광고 자동 추적의 검색어
    if (!source && !medium && !campaign) {
      if (isAppintosBuild) return;
      const last = JSON.parse(localStorage.getItem(UTM_LAST_KEY) || 'null');
      if (last?.u?.source && Date.now() - Number(last.at || 0) < UTM_CARRY_MS) {
        sessionStorage.setItem(UTM_KEY, JSON.stringify({ ...last.u, carried: '1' }));
      }
      return;
    }
    const u = {
      ...(source ? { source } : {}),
      ...(medium ? { medium } : {}),
      ...(campaign ? { campaign } : {}),
      ...(content ? { content } : {}),
      ...(term ? { term } : {}),
    };
    sessionStorage.setItem(UTM_KEY, JSON.stringify(u));
    if (!isAppintosBuild && source) localStorage.setItem(UTM_LAST_KEY, JSON.stringify({ u, at: Date.now() }));
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

/** 2026-10-22 P1-9 — 이번 방문이 광고 꼬리표로 들어왔으면 그 출처 이름(meta, naver, tossads 등), 아니면 ''.
 *  웹의 30일 이어 보기로 붙은 출처도 광고 손님으로 본다. 화면 길을 고르고 이벤트에 붙이는 데 쓴다. */
export function adVisitSource(): string {
  const s = String(getUtm()?.source || '').toLowerCase();
  return AD_BOOT_SOURCES.has(s) ? s : '';
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
    const content = (q.get('utm_content') || '').slice(0, 60); // 2026-10-22 — 스킴으로 들어온 광고도 소재별로 읽게
    const term = (q.get('utm_term') || '').slice(0, 60);
    sessionStorage.setItem(UTM_KEY, JSON.stringify({
      ...existing,
      // utm 태그 있으면 그 출처, 없으면 'toss_app'(토스 내부 discovery/검색/추천 or 무태그 딥링크) — 웹 direct 와 구분
      source: source || 'toss_app',
      ...(medium ? { medium } : {}),
      ...(campaign ? { campaign } : {}),
      ...(content ? { content } : {}),
      ...(term ? { term } : {}),
    }));
    sendAdBoot();
  } catch { /* noop — 출처 캡처는 fire-and-forget */ }
}

/* 2026-10-22 — 광고로 들어와 몇 초 만에 나간 손님도 남긴다.
 *   logToFirestore 는 익명 로그인(최대 6초)을 기다린 뒤 저장해서, 토스애즈 E29 첫날 앱을 연 179명 중 105명이 기록에 없었다.
 *   광고 꼬리표가 있는 첫 진입 한 번만 로그인 없이 sendBeacon 으로 /api/seo-hit 에 보낸다(웹은 같은 주소, 앱은 saju500.app).
 *   받는 쪽은 functions/src/seo/seoHit.ts(kind 'boot' → 'ad_boot'). 경로, 꼬리표, 기기 ID 만 보낸다. */
// 2026-10-26 앱 빌드에는 앱으로 오는 출처만 둔다(네이버, 구글, 카카오 광고는 웹으로만 온다. 앱 번들에 그 이름이 남지 않게, 1.6.3 검수 반려 대응)
const AD_BOOT_SOURCES = new Set(import.meta.env.VITE_BUILD_TARGET === 'appintos'
  ? ['meta', 'tossads', 'instagram', 'facebook', 'creator', 'blog']
  : ['meta', 'naver', 'tossads', 'instagram', 'facebook', 'google', 'kakao', 'creator', 'blog']);
const AD_BOOT_KEY = 'saju500:ad_boot';
function sendAdBoot(): void {
  try {
    if (internalKind()) return;
    if (sessionStorage.getItem(AD_BOOT_KEY)) return;
    const u = getUtm();
    const source = String(u?.source || '').toLowerCase();
    if (!AD_BOOT_SOURCES.has(source) || u?.carried) return; // 30일 이어 보기로 붙은 출처는 새 광고 진입이 아님
    sessionStorage.setItem(AD_BOOT_KEY, '1');
    const body = JSON.stringify({
      kind: 'boot', plat: isAppintosBuild ? 'ait' : 'web', source,
      medium: u?.medium || '', campaign: u?.campaign || '', content: u?.content || '', term: u?.term || '',
      did: getLocalDeviceId(), path: window.location.pathname || '/',
    });
    const url = isAppintosBuild ? 'https://saju500.app/api/seo-hit' : '/api/seo-hit';
    const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
    if (!sent) fetch(url, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => { /* noop */ });
  } catch { /* noop */ }
}

// 모듈 init 시 1회 캡처 (SSR 안전 가드) + 전역 CTA 클릭 수집 시작
if (typeof window !== 'undefined') {
  captureUtm(); sendAdBoot(); captureTossSchemeUtm(); initCtaTracking();
  // 토스 픽셀은 첫 화면 보기보다 먼저 띄워 tcid 를 잡는다(앱 번들만, 코드가 없으면 아무것도 안 함)
  if (import.meta.env.VITE_BUILD_TARGET === 'appintos') import('@/services/ads/tossPixel').then((m) => m.initTossPixel()).catch(() => {});
}

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
    if (!isToss && (h === 'localhost' || h.startsWith('127.') || h.startsWith('192.168.') || h === '[::1]' || h === '::1')) return 'dev'; // [::1] 은 2026-10-18 시험용 새 손님 주소
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
      // 2026-10-21 — 웹 결제가 어디서 끊기는지 인스타그램, 카카오톡 같은 앱 안 브라우저별로 보려고 (앱 빌드는 기록 안 함)
      const iab = isAppintosBuild ? null : inAppBrowserName();
      await addDoc(collection(db, 'analytics'), {
        name: eventName,
        uid,
        sid: getSessionId(),
        did: getLocalDeviceId(),   // 기기 영속 ID (DAU 정확도 — 2026-06-12)
        props: params ?? {},
        ...(utm ? { utm } : {}), // 유입 채널 (있을 때만 — C5)
        ...(demo ? { demo } : {}), // 성별·연령대 (본인 프로필 파생 — 2026-06-12)
        ...(iab ? { iab } : {}), // 앱 안 브라우저 이름 (웹만, 2026-10-21)
        ...(internal === 'owner' ? { internal: true } : {}), // 오너 기기 — 집계 제외 마킹
        plat: await getPlat(), // 웹/토스앱 분리 (2026-06-12)
        disp: displayModeLabel(), // 홈 화면 앱(standalone)과 브라우저 분리 (2026-10-23, 토스 앱 안과 앱 빌드는 browser)
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
