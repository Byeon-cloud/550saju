// 어드민 대시보드 — 데이터 fetch + 기간별 집계 훅 (2026-06-10)
//   기간(7/14/30일) + 직전 동일 기간을 한 번에 fetch → 모든 KPI 증감 델타 산출.
//   ⚠️ 읽기 전용 — 오너 게이팅·firestore.rules 보안 모델 변경 없음. 쿼리 패턴(day >= X, orderBy day)도 기존과 동일 (신규 인덱스 불필요).
import { useCallback, useEffect, useState } from 'react';
import { db } from '@/services/auth/firebase';
import { OWNER_UIDS } from '@/services/admin/adminConfig';
import {
  collection, getDocs, query, where, orderBy, limit, collectionGroup, startAfter,
} from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';

export type RangeDays = 7 | 14 | 30;

// ─── AI 토큰 단가 (어드민 추정용 상수 · 캐시 할인 미반영) ───
export const USD_KRW = 1400;
export const TOKEN_PRICE_PER_M: Record<string, { in: number; out: number }> = {
  opus: { in: 5, out: 25 },
  sonnet: { in: 3, out: 15 },
  haiku: { in: 1, out: 5 },     // 2026-06-12 — 누락돼 오늘운세(Haiku)가 0원 또는 Sonnet 단가로 오계산되던 것
  gemini: { in: 0.15, out: 0.6 }, // Flash 급 근사 — 무시 가능 수준이지만 0 보다는 정직
};

// ─── KST 날짜 유틸 ───
export function kstDayFromMs(ms: number): string {
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function kstDay(offset = 0): string {
  return kstDayFromMs(Date.now() + offset * 86400000);
}

// ─── 타입 ───
export type PlatFilter = 'all' | 'web' | 'ait';

export interface RawEvent {
  day: string; name: string; uid: string; sid: string; props: any; utm?: any;
  plat?: string;                                   // web | ait (2026-06-12 · 미기록 구이벤트 = web 취급)
  did?: string;                                    // 기기 영속 ID (2026-06-12)
  demo?: { g?: string; ab?: string };              // 성별·연령대 (본인 프로필 파생)
}

export interface AiTypeAgg {
  done: number; errors: number; totalMs: number; maxMs: number;
  modes: Record<string, { done: number; errors: number; totalMs: number }>;
}

export interface AiUsageAgg {
  calls: number; inTok: number; outTok: number; costKrw: number; ok: number; fail: number;
}

export interface PeriodAgg {
  days: string[];                                  // 기간 내 KST day 배열 (오름차순)
  // 매출 (payments confirmed — 2026-10-03 부터 고유 주문(orderId) 기준 · 복구 지급 중복 제외)
  revenue: number;
  revenueByDay: number[];
  packageDist: Record<string, number>;             // 충전 금액(₩) → 고유 주문 건수
  payOrders: number;                               // 결제 건수 — 고유 주문(orderId) 기준
  // 충전 이벤트 (analytics — 진입경로·utm 귀속용. 결제 건수·결제 유저는 payments 장부 기준)
  chargeOpen: number;
  chargeComplete: number;                          // charge_complete 이벤트 수 (참고용 — 결제 건수는 payOrders)
  chargeAmount: number;                            // charge_complete props.amount 합 (₩)
  // 결제 유저 — payments 장부 기준. 같은 주문으로 이어진 uid(회전 전후)는 1명
  payingUsers: number;
  repeatPayingUsers: number;                       // 기간 내 결제 2회+
  payingUserKeys: string[];                        // 결제 유저 키 (uid 묶음 대표)
  newPayingUsers: number;                          // 기간 내 첫 결제 유저 (전체 결제 이력 기준)
  recovery: { count: number; amount: number; excluded: number; excludedAmount: number }; // 기간 내 처리된 결제이력 복구 지급 (처리일 기준) — excluded = 원결제와 중복이라 매출 제외분
  // 방문
  pageViews: number;
  visitors: number;                                // 고유 uid|sid
  visitorKeys: string[];                           // 신규/재방문 방문자 산출용 (cur vs prev 비교 — payingUserKeys 패턴)
  appOpens: number;
  dauByDay: number[];
  dauAvg: number;
  // 콘텐츠
  contentOpen: Record<string, number>;
  contentResult: Record<string, number>;
  contentPurchase: Record<string, { count: number; un: number }>; // key: type 또는 topic:xxx
  contentOpenTotal: number;
  contentResultTotal: number;
  contentPurchaseTotal: number;
  contentPurchaseUn: number;                       // 운 차감 합계
  topicSelect: Record<string, number>;
  topicOpen: Record<string, number>;               // 주제 페이지 진입 (2026-06-12)
  bounceRate: number | null;                       // 이탈률 = 1 pv 세션 / 전체 세션 (2026-06-12)
  // 공유·리워드
  shareClicks: number;
  shareByDay: number[];
  purchasesByDay: number[];                         // 콘텐츠구매 일별 (폭증 타임라인 2026-06-27)
  chargesByDay: number[];                           // 충전결제 일별 — payments 장부 고유 주문 (2026-10-03)
  shareByPage: Record<string, number>;             // 공유 클릭 페이지별 — 어느 화면에서 공유 최다 (2026-06-24)
  shareByBalanceBand: Record<string, number>;      // 공유자 운 잔액대별 ('0'|'1-3'|'4-9'|'10+')
  sharerCount: number;                             // 공유한 고유 유저 수
  sharesPerUser: number;                           // 한명당 평균 공유 횟수
  // 바이럴 퍼널 v2 (2026-07-03) — 시도(share_click)→성사(share_complete)→리워드→수신(invite_received)
  shareClickByType: Record<string, number>;        // 시도 종류별 — invite(친구초대·리워드형) vs 콘텐츠(result/topic/daily/card…)
  shareCompletes: number;                          // 공유 성사 총계
  shareCompleteByDay: number[];                    // 성사 일별 (추이 차트 완료 라인)
  shareCompleteByMethod: Record<string, number>;   // 성사 경로 — toss_viral(토스 SDK 친구초대)|toss_share|web_share|clipboard|web_share_file|download
  shareCompleteByType: Record<string, number>;     // 성사 종류별
  shareCompleteRewarded: number;                   // 성사 중 리워드 적립분 (일3회 한도 내)
  inviteReceived: number;                          // 공유링크 수신 진입 (invite_received — 바이럴 K-factor 분자)
  chargeBySource: Record<string, number>;          // 결제 유발 콘텐츠(진입경로)별 — charge_complete source (2026-06-24)
  rewardByKind: Record<string, { count: number; amount: number }>;
  rewardKindByDay: Record<string, number[]>;       // kind → 일별 건수
  rewardTotal: number;
  // 광고
  adStats: { impression: number; click: number; nofill: number; fail: number };
  // AI 품질 (analytics ai_done/ai_error)
  ai: Record<string, AiTypeAgg>;
  // AI 원가 (aiUsage 컬렉션)
  aiUsage: Record<string, AiUsageAgg>;             // type → 집계
  aiUsageTotal: { calls: number; inTok: number; outTok: number; costKrw: number };
  // 유저 행동
  visitFreq: { once: number; few: number; many: number }; // 1회 / 2-3회 / 4회+ (방문일수 기준)
  retention: { d1Rate: number | null; d7Rate: number | null; cohortD1: number; cohortD7: number };
  // 유입
  utm: Record<string, { visits: number; contentOpens: number; charges: number }>;
  // 과거 활동 복원 (2026-06-12) — reports.generatedAt + payments 로 역산 (행동로그 수집 이전 기간 포함)
  genByDay: number[];                              // 일별 콘텐츠 생성 건수
  genUsersByDay: number[];                         // 일별 활동 유저 (생성+결제 고유 uid)
  genTotal: number;
  genByDayType: Record<string, number[]>;          // type → 일별 생성
  topicGen: Record<string, number>;                // 기간 내 주제별 생성 (topicId 기준 · DB 복원)
  // CTA 클릭 (2026-06-12 · 전역 위임 수집)
  cta: Record<string, number>;                     // label → 클릭 수
  ctaTotal: number;
  // 인구통계 (2026-06-12 · 본인 프로필 파생 — 고유 방문자 기준)
  demoGender: Record<string, number>;              // 'M'|'F' → 고유 유저 수
  demoAge: Record<string, number>;                 // '20대' 등 → 고유 유저 수
  payingGender: Record<string, number>;            // 결제 유저의 성별 분포
}

// 결제 건강 + LTV (2026-06-18) — payments 컬렉션 전수 집계 (전 기간). status='confirmed' 외 실패/환불도 노출.
//   2026-10-03 — 모든 건수·금액은 고유 주문(orderId) 기준. 복구 지급·이관 사본은 아래 보조지표로 분리.
export interface PayHealth {
  confirmed: number;             // 충전 성공 건수 (고유 주문)
  failed: number;                // 결제 실패(취소 포함)
  needsReconciliation: number;   // 승인됐으나 적립 미완 — 수동 복구 대상 (P0 모니터링)
  pending: number;               // 미확정
  refundCount: number;           // 환불 건수
  refundAmount: number;          // 환불액 합(₩)
  byPg: Record<string, number>;  // pgProvider(iap/toss/…) → 매출(₩)
  payerCount: number;            // 결제 고유 유저 수 (같은 주문으로 이어진 uid 는 1명)
  avgLtv: number;                // 1인당 누적 결제액(₩) = 총매출 ÷ 결제유저
  docCount: number;              // 충전 결제 문서 수 (오너 제외·플랫폼 필터 후)
  orderCount: number;            // 고유 주문 수
  recoveredDupCount: number;     // 결제이력 복구 지급 중 원결제 기록과 겹친 것 → 매출 제외
  recoveredDupAmount: number;
  recoveredOnlyCount: number;    // 결제이력 복구 지급인데 원결제 기록이 없는 것 → 실결제라 원결제일 매출로 반영
  recoveredOnlyAmount: number;
  dupCopyCount: number;          // 그 밖의 같은 주문 사본 (uid 이관 사본 등) → 매출 제외
  dupCopyAmount: number;
}

export interface AdminData {
  totalUsers: number;
  payHealth: PayHealth;
  topicDistAll: Record<string, { count: number; users: number }>; // 10주제 분포 — 전 기간 (DB 복원)
  topicSubAll: Record<string, Record<string, number>>;            // 주제 소분류 분포 (솔로/썸/연애중 등)
  contentDistAll: Record<string, { count: number; users: number | null }>; // 전 콘텐츠 분포 (users null = 집계불가)
  totalRevenue: number;                            // 누적 (전 기간 · 고유 주문 기준)
  todayRevenue: number;
  reportsByType: Record<string, number>;           // 콘텐츠 생성 누적
  cur: PeriodAgg;
  prev: PeriodAgg;
  rawEvents: RawEvent[];                           // 현 기간 원본 이벤트 (CSV)
  fetchedAt: Date;
}

// ─── 빈 집계 버킷 ───
function emptyAgg(days: string[]): PeriodAgg {
  return {
    days,
    revenue: 0, revenueByDay: days.map(() => 0), packageDist: {}, payOrders: 0,
    chargeOpen: 0, chargeComplete: 0, chargeAmount: 0, payingUsers: 0, repeatPayingUsers: 0, payingUserKeys: [],
    newPayingUsers: 0, recovery: { count: 0, amount: 0, excluded: 0, excludedAmount: 0 },
    pageViews: 0, visitors: 0, visitorKeys: [], appOpens: 0, dauByDay: days.map(() => 0), dauAvg: 0,
    contentOpen: {}, contentResult: {}, contentPurchase: {},
    contentOpenTotal: 0, contentResultTotal: 0, contentPurchaseTotal: 0, contentPurchaseUn: 0,
    topicSelect: {}, topicOpen: {}, bounceRate: null,
    shareClicks: 0, shareByDay: days.map(() => 0), purchasesByDay: days.map(() => 0), chargesByDay: days.map(() => 0),
    shareByPage: {}, shareByBalanceBand: {}, sharerCount: 0, sharesPerUser: 0, chargeBySource: {},
    shareClickByType: {}, shareCompletes: 0, shareCompleteByDay: days.map(() => 0),
    shareCompleteByMethod: {}, shareCompleteByType: {}, shareCompleteRewarded: 0, inviteReceived: 0,
    rewardByKind: {}, rewardKindByDay: {}, rewardTotal: 0,
    adStats: { impression: 0, click: 0, nofill: 0, fail: 0 },
    ai: {},
    aiUsage: {}, aiUsageTotal: { calls: 0, inTok: 0, outTok: 0, costKrw: 0 },
    visitFreq: { once: 0, few: 0, many: 0 },
    retention: { d1Rate: null, d7Rate: null, cohortD1: 0, cohortD7: 0 },
    utm: {},
    genByDay: days.map(() => 0), genUsersByDay: days.map(() => 0), genTotal: 0, genByDayType: {}, topicGen: {},
    cta: {}, ctaTotal: 0,
    demoGender: {}, demoAge: {}, payingGender: {},
  };
}

function addDays(day: string, n: number): string {
  const dt = new Date(day + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** payments 문서의 결제 day (KST) — confirmedAt 우선, createdAt 폴백. Timestamp/string/number 모두 처리 */
function paymentDay(p: any): string {
  const v = p.confirmedAt ?? p.createdAt;
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (typeof v?.toDate === 'function') return kstDayFromMs(v.toDate().getTime());
  if (typeof v === 'number') return kstDayFromMs(v);
  if (typeof v?.seconds === 'number') return kstDayFromMs(v.seconds * 1000);
  return '';
}

/** Timestamp/string/number → epoch ms (없으면 0) */
function tsMs(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isNaN(t) ? 0 : t; }
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  return 0;
}

/** 토스 IAP 주문일(orderDate) → KST day. 오프셋 없는 'YYYY-MM-DDTHH:mm:ss' 는 KST 현지시각(실측 — 원결제 confirmedAt 과 9시간 차),
 *  Z/오프셋이 붙어 오면 변환. 형식이 아니면 '' (→ 복구 처리일로 폴백) */
function orderDateDay(v: any): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return '';
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(v)) { const t = Date.parse(v); return Number.isNaN(t) ? '' : kstDayFromMs(t); }
  return v.slice(0, 10);
}

// ─── 결제 장부 (2026-10-03 · 매출 이중집계 fix) ───
interface PayRow {
  uid: string; amt: number; status: string;
  recovered: boolean;   // recoveredFromIapHistory — 결제이력 복구 지급 (functions/src/payment/recoverIapOrders.ts)
  migrated: boolean;    // migratedFromUid — uid 이관 사본
  ms: number;           // 확정 시각 (정본 선택용)
  day: string;          // 매출 귀속일 KST (확정일 · 원결제 기록 없는 복구분은 원결제일)
  orderDay: string;     // 토스 주문일 KST (복구 문서에만 기록됨)
  pg: string;
}
const PAY_STATUS_RANK: Record<string, number> = { confirmed: 4, completed: 4, needs_reconciliation: 3, pending: 2, failed: 1 };
const isPaidStatus = (s: string): boolean => s === 'confirmed' || s === 'completed';

/** analytics 이벤트 1건을 해당 기간 버킷에 누적 */
// 내부 트래픽 제외 (2026-06-12) — 오너 기기/로컬 테스트 이벤트는 집계에서 빼서 '가짜 데이터' 차단
function isInternalEvent(e: any): boolean {
  return e?.internal === true;
}

function accumulateEvent(agg: PeriodAgg, e: RawEvent, dayIdx: number, scratch: PeriodScratch): void {
  const t = e.props?.type as string | undefined;
  // 2026-06-12 — did(기기 영속) 우선: 익명 유저가 세션마다 새 사람으로 집계되던 것 fix
  const userKey = e.uid || e.did || e.sid || 'anon';
  const dauKey = e.did || e.uid || e.sid || 'anon';
  const utmSource = (e.utm?.source as string | undefined) || 'direct';
  const utmSlot = (agg.utm[utmSource] ??= { visits: 0, contentOpens: 0, charges: 0 });

  // 인구통계 — 어떤 이벤트든 demo 첨부돼 있으면 최신값 기록 (고유 유저 기준 마감 시 집계)
  if (e.demo && (e.demo.g || e.demo.ab)) scratch.demoByUser[userKey] = e.demo;

  switch (e.name) {
    case 'page_view': {
      agg.pageViews += 1;
      scratch.pvBySession[e.sid || dauKey] = (scratch.pvBySession[e.sid || dauKey] ?? 0) + 1;
      scratch.visitorSet.add(userKey);
      (scratch.dauSets[dayIdx] ??= new Set()).add(dauKey);
      (scratch.visitDays[userKey] ??= new Set()).add(e.day);
      (scratch.utmVisitSets[utmSource] ??= new Set()).add(dauKey);
      break;
    }
    case 'cta_click': {
      const label = (e.props?.label as string | undefined) || '';
      if (label) { agg.cta[label] = (agg.cta[label] ?? 0) + 1; agg.ctaTotal += 1; }
      break;
    }
    case 'app_open': agg.appOpens += 1; break;
    case 'content_open':
      if (t) { agg.contentOpen[t] = (agg.contentOpen[t] ?? 0) + 1; agg.contentOpenTotal += 1; utmSlot.contentOpens += 1; }
      break;
    case 'content_result':
      if (t) { agg.contentResult[t] = (agg.contentResult[t] ?? 0) + 1; agg.contentResultTotal += 1; }
      break;
    case 'content_purchase': {
      if (!t) break;
      const key = t === 'topic' && e.props?.topic ? `topic:${e.props.topic}` : t;
      const slot = (agg.contentPurchase[key] ??= { count: 0, un: 0 });
      const un = Number(e.props?.amount) || 0;
      slot.count += 1; slot.un += un;
      agg.contentPurchaseTotal += 1; agg.contentPurchaseUn += un;
      if (dayIdx >= 0) agg.purchasesByDay[dayIdx] += 1;
      break;
    }
    case 'charge_open': agg.chargeOpen += 1; break;
    case 'charge_complete': {
      // 2026-10-03 — 결제 건수·결제 유저·일별 충전은 payments 장부(고유 주문)로 이관. 이벤트는 진입경로·utm 귀속만.
      agg.chargeComplete += 1;
      agg.chargeAmount += Number(e.props?.amount) || 0;
      // 2026-06-24 — 결제 유발 콘텐츠(진입경로): 어떤 콘텐츠에서 결제를 결심했나.
      const src = (e.props?.source as string | undefined) || 'direct';
      agg.chargeBySource[src] = (agg.chargeBySource[src] ?? 0) + 1;
      utmSlot.charges += 1;
      break;
    }
    case 'topic_select': {
      const topic = e.props?.topic as string | undefined;
      if (topic) agg.topicSelect[topic] = (agg.topicSelect[topic] ?? 0) + 1;
      break;
    }
    case 'topic_open': {
      const topic = e.props?.topic as string | undefined;
      if (topic) agg.topicOpen[topic] = (agg.topicOpen[topic] ?? 0) + 1;
      break;
    }
    case 'share_click': {
      agg.shareClicks += 1;
      if (dayIdx >= 0) agg.shareByDay[dayIdx] += 1;
      // 2026-07-03 바이럴 퍼널 — 종류별 분해 (invite=친구초대 리워드형 / result·topic·card…=콘텐츠 공유)
      const clickType = (e.props?.type as string | undefined) || '(unknown)';
      agg.shareClickByType[clickType] = (agg.shareClickByType[clickType] ?? 0) + 1;
      // 2026-06-24 — 마케팅 분해: 어느 화면(page)에서 공유 최다 + 공유자 운 잔액대 + 고유 공유자 수.
      const page = (e.props?.page as string | undefined) || '(unknown)';
      agg.shareByPage[page] = (agg.shareByPage[page] ?? 0) + 1;
      const bal = Number(e.props?.balance);
      if (!Number.isNaN(bal)) {
        const band = bal <= 0 ? '0' : bal <= 3 ? '1-3운' : bal <= 9 ? '4-9운' : '10운+';
        agg.shareByBalanceBand[band] = (agg.shareByBalanceBand[band] ?? 0) + 1;
      }
      scratch.sharerByUser[userKey] = (scratch.sharerByUser[userKey] ?? 0) + 1;
      break;
    }
    case 'share_complete': {
      // 2026-07-03 바이럴 퍼널 — 공유 '성사' (시도-성사 델타 = 취소율. 토스 SDK 일3회 한도 초과 성사 포함)
      agg.shareCompletes += 1;
      if (dayIdx >= 0) agg.shareCompleteByDay[dayIdx] += 1;
      const method = (e.props?.method as string | undefined) || '(unknown)';
      agg.shareCompleteByMethod[method] = (agg.shareCompleteByMethod[method] ?? 0) + 1;
      const cType = (e.props?.type as string | undefined) || '(unknown)';
      agg.shareCompleteByType[cType] = (agg.shareCompleteByType[cType] ?? 0) + 1;
      if (Number(e.props?.rewarded) === 1) agg.shareCompleteRewarded += 1;
      break;
    }
    case 'invite_received': {
      // 2026-07-03 — 공유링크 수신 진입 (기록만 되고 어드민 미집계였던 것 복구 — K-factor 분자)
      agg.inviteReceived += 1;
      break;
    }
    case 'reward_earned': {
      const kind = (e.props?.kind as string | undefined) || 'unknown';
      if (kind === 'auto_refund') break; // 환불(생성중단 자동환불)은 리워드 아님 — 리워드 집계 제외 (정확성)
      const slot = (agg.rewardByKind[kind] ??= { count: 0, amount: 0 });
      slot.count += 1;
      slot.amount += Number(e.props?.amount) || 0;
      agg.rewardTotal += 1;
      if (dayIdx >= 0) {
        (agg.rewardKindByDay[kind] ??= agg.days.map(() => 0))[dayIdx] += 1;
      }
      break;
    }
    case 'ad_impression': agg.adStats.impression += 1; break;
    case 'ad_click': agg.adStats.click += 1; break;
    case 'ad_nofill': agg.adStats.nofill += 1; break;
    case 'ad_fail': agg.adStats.fail += 1; break;
    case 'ai_done': {
      if (!t) break;
      const slot = (agg.ai[t] ??= { done: 0, errors: 0, totalMs: 0, maxMs: 0, modes: {} });
      const ms = Number(e.props?.ms) || 0;
      slot.done += 1; slot.totalMs += ms; if (ms > slot.maxMs) slot.maxMs = ms;
      const mode = (e.props?.mode as string | undefined) || 'callable';
      const mslot = (slot.modes[mode] ??= { done: 0, errors: 0, totalMs: 0 });
      mslot.done += 1; mslot.totalMs += ms;
      break;
    }
    case 'ai_error': {
      if (!t) break;
      const slot = (agg.ai[t] ??= { done: 0, errors: 0, totalMs: 0, maxMs: 0, modes: {} });
      slot.errors += 1;
      const mode = (e.props?.mode as string | undefined) || 'callable';
      const mslot = (slot.modes[mode] ??= { done: 0, errors: 0, totalMs: 0 });
      mslot.errors += 1;
      break;
    }
  }
}

interface PeriodScratch {
  visitorSet: Set<string>;
  dauSets: Record<number, Set<string>>;
  visitDays: Record<string, Set<string>>;
  utmVisitSets: Record<string, Set<string>>;
  demoByUser: Record<string, { g?: string; ab?: string }>;  // 2026-06-12 인구통계
  pvBySession: Record<string, number>;                       // 이탈률용 (sid → pv 수)
  sharerByUser: Record<string, number>;                      // 공유 고유 유저 (2026-06-24)
}

/** scratch → 최종 집계 마감 (방문자·DAU·리텐션·재구매·방문빈도·utm visits) */
function finalizeAgg(agg: PeriodAgg, scratch: PeriodScratch): void {
  agg.visitors = scratch.visitorSet.size;
  agg.visitorKeys = Array.from(scratch.visitorSet); // 신규/재방문 산출용 (cur vs prev)
  agg.dauByDay = agg.days.map((_, i) => scratch.dauSets[i]?.size ?? 0);
  const activeDays = agg.dauByDay.filter((n) => n > 0);
  agg.dauAvg = activeDays.length > 0
    ? Math.round(agg.dauByDay.reduce((a, b) => a + b, 0) / agg.days.length)
    : 0;

  // 방문빈도 분포 (기간 내 방문 일수 기준)
  Object.values(scratch.visitDays).forEach((days) => {
    const n = days.size;
    if (n <= 1) agg.visitFreq.once += 1;
    else if (n <= 3) agg.visitFreq.few += 1;
    else agg.visitFreq.many += 1;
  });

  // 리텐션 근사 — 기간 윈도우 내 첫 방문일 기준 D1/D7 재방문
  const lastDay = agg.days[agg.days.length - 1] || kstDay();
  let d1E = 0, d1R = 0, d7E = 0, d7R = 0;
  Object.values(scratch.visitDays).forEach((days) => {
    const first = Array.from(days).sort()[0];
    if (!first) return;
    if (addDays(first, 1) <= lastDay) {
      d1E += 1;
      if (days.has(addDays(first, 1))) d1R += 1;
    }
    if (addDays(first, 7) <= lastDay) {
      d7E += 1;
      if (days.has(addDays(first, 7))) d7R += 1;
    }
  });
  agg.retention = {
    d1Rate: d1E > 0 ? Math.round((d1R / d1E) * 100) : null,
    d7Rate: d7E > 0 ? Math.round((d7R / d7E) * 100) : null,
    cohortD1: d1E, cohortD7: d7E,
  };

  // 결제 유저·재구매 — payments 장부 집계 후 applyPayers() 에서 채움 (2026-10-03)

  // 공유 분해 마감 (2026-06-24) — 고유 공유자 수 + 한명당 평균 공유
  agg.sharerCount = Object.keys(scratch.sharerByUser).length;
  agg.sharesPerUser = agg.sharerCount > 0
    ? Math.round((agg.shareClicks / agg.sharerCount) * 10) / 10
    : 0;

  // utm visits
  Object.entries(scratch.utmVisitSets).forEach(([source, set]) => {
    (agg.utm[source] ??= { visits: 0, contentOpens: 0, charges: 0 }).visits = set.size;
  });

  // 이탈률 (2026-06-12) — 페이지 1개만 보고 떠난 세션 비율
  const sessions = Object.values(scratch.pvBySession);
  agg.bounceRate = sessions.length > 0
    ? Math.round((sessions.filter((n) => n === 1).length / sessions.length) * 100)
    : null;

  // 인구통계 마감 (2026-06-12) — 고유 유저 기준 성별·연령 분포 (결제 유저 성별은 applyPayers)
  Object.values(scratch.demoByUser).forEach((demo) => {
    if (demo.g) agg.demoGender[demo.g] = (agg.demoGender[demo.g] ?? 0) + 1;
    if (demo.ab) agg.demoAge[demo.ab] = (agg.demoAge[demo.ab] ?? 0) + 1;
  });
}

/** 결제 유저 지표 마감 (2026-10-03) — payments 장부 기준. payers: 대표 uid → 기간 내 고유 주문 수 */
function applyPayers(
  agg: PeriodAgg, payers: Map<string, number>, firstPayDay: Map<string, string>,
  scratch: PeriodScratch, rootUid: (u: string) => string,
): void {
  agg.payingUserKeys = Array.from(payers.keys());
  agg.payingUsers = payers.size;
  agg.repeatPayingUsers = Array.from(payers.values()).filter((n) => n >= 2).length;
  const start = agg.days[0] || '';
  agg.newPayingUsers = agg.payingUserKeys.filter((k) => {
    const f = firstPayDay.get(k);
    return !!f && f >= start;
  }).length;
  // 결제자 성별 — 이벤트 demo(본인 프로필) 중 결제 유저만, 같은 사람(uid 묶음)은 1회
  agg.payingGender = {};
  const seen = new Set<string>();
  Object.entries(scratch.demoByUser).forEach(([userKey, demo]) => {
    if (!demo.g) return;
    const k = rootUid(userKey);
    if (!payers.has(k) || seen.has(k)) return;
    seen.add(k);
    agg.payingGender[demo.g] = (agg.payingGender[demo.g] ?? 0) + 1;
  });
}

/** aiUsage 1건 누적 */
function accumulateUsage(agg: PeriodAgg, u: any): void {
  const type = String(u.type || 'unknown');
  const model = String(u.model || '');
  const i = Number(u.inputTokens) || 0;
  const o = Number(u.outputTokens) || 0;
  const price = model.includes('opus') ? TOKEN_PRICE_PER_M.opus
    : model.includes('sonnet') ? TOKEN_PRICE_PER_M.sonnet
    : model.includes('haiku') ? TOKEN_PRICE_PER_M.haiku
    : model.includes('gemini') ? TOKEN_PRICE_PER_M.gemini
    : null;
  const krw = price ? ((i * price.in + o * price.out) / 1_000_000) * USD_KRW : 0;
  const slot = (agg.aiUsage[type] ??= { calls: 0, inTok: 0, outTok: 0, costKrw: 0, ok: 0, fail: 0 });
  slot.calls += 1; slot.inTok += i; slot.outTok += o; slot.costKrw += krw;
  if (u.ok === false) slot.fail += 1; else slot.ok += 1;
  agg.aiUsageTotal.calls += 1;
  agg.aiUsageTotal.inTok += i;
  agg.aiUsageTotal.outTok += o;
  agg.aiUsageTotal.costKrw += krw;
}

// ─────────────────────────────────────────────────────────
// 훅 — 기간 선택 시 현 기간 + 직전 동일 기간 동시 집계
// ─────────────────────────────────────────────────────────
export function useAdminData(range: RangeDays, enabled: boolean, plat: PlatFilter = 'all') {
  const [data, setData] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const today = kstDay();
        const curDays = Array.from({ length: range }, (_, i) => kstDay(-(range - 1) + i));
        const prevDays = Array.from({ length: range }, (_, i) => kstDay(-(2 * range - 1) + i));
        const fetchStart = prevDays[0];
        const curStart = curDays[0];

        const cur = emptyAgg(curDays);
        const prev = emptyAgg(prevDays);
        const curScratch: PeriodScratch = { visitorSet: new Set(), dauSets: {}, visitDays: {}, utmVisitSets: {}, demoByUser: {}, pvBySession: {}, sharerByUser: {} };
        const prevScratch: PeriodScratch = { visitorSet: new Set(), dauSets: {}, visitDays: {}, utmVisitSets: {}, demoByUser: {}, pvBySession: {}, sharerByUser: {} };
        const rawEvents: RawEvent[] = [];
        // 2026-06-18 더미 제거 — 오너(본인 테스트) 데이터 전 collectionGroup 에서 제외.
        //   OWNER_UIDS(고정) + internal:true 이벤트를 낸 모든 uid(쿠키 초기화로 바뀐 익명 오너 기기 포함).
        //   → reports/payments/dailyFortune/users 가 이 uid 들을 건너뜀 = 실유저 수치만 남음.
        const ownerUidSet = new Set<string>(OWNER_UIDS);

        // 1) analytics — 현+전 기간 (최대 60일) 페이지 단위 전수 fetch
        //    🚨 2026-10-03 — 기존 limit(10000) 단일 쿼리는 day 오름차순이라, 30일 보기(60일치 ≈ 1.3만 건)에서
        //    최근 며칠이 통째로 잘려 현 기간 방문·퍼널이 과소 집계됐다. startAfter 커서로 끝까지 읽는다.
        const evRows: any[] = [];
        const EV_PAGE = 10000;
        let evCursor: QueryDocumentSnapshot<DocumentData> | null = null;
        for (let page = 0; page < 20; page++) { // 안전 상한 20만 건
          const evSnap: QuerySnapshot<DocumentData> = await getDocs(evCursor
            ? query(collection(db, 'analytics'), where('day', '>=', fetchStart), orderBy('day'), startAfter(evCursor), limit(EV_PAGE))
            : query(collection(db, 'analytics'), where('day', '>=', fetchStart), orderBy('day'), limit(EV_PAGE)));
          evSnap.forEach((doc) => { evRows.push(doc.data()); });
          if (evSnap.size < EV_PAGE) break;
          evCursor = evSnap.docs[evSnap.docs.length - 1];
        }
        // 오너 판정 1차 패스 (2026-10-03) — internal 마킹 이벤트의 uid·기기(did)를 먼저 모은 뒤, 같은 uid/기기의
        //   마킹 안 된 이벤트(어드민 첫 방문 전 기록)까지 제외. 기존엔 마킹된 이벤트만 빠졌다 (실측 6월 73건 누수).
        const ownerDidSet = new Set<string>();
        evRows.forEach((e) => {
          if (!isInternalEvent(e)) return;
          if (e.uid) ownerUidSet.add(String(e.uid));
          if (typeof e.did === 'string' && e.did.startsWith('d_')) ownerDidSet.add(e.did); // 'nodevice' 폴백은 제외
        });
        evRows.forEach((e) => {
          if (isInternalEvent(e)) return; // 오너·로컬 트래픽 제외
          if (e.uid && ownerUidSet.has(String(e.uid))) return;
          if (e.did && ownerDidSet.has(String(e.did))) return;
          // 플랫폼 필터 (2026-06-12) — plat 미기록 구이벤트는 web 취급 (구 토스앱 번들엔 추적코드 자체가 없었음)
          if (plat !== 'all' && ((e.plat as string) || 'web') !== plat) return;
          const ev: RawEvent = {
            day: e.day || '', name: e.name || '', uid: e.uid || '', sid: e.sid || '',
            props: e.props, utm: e.utm, did: e.did || '', demo: e.demo,
          };
          if (ev.day >= curStart) {
            const idx = curDays.indexOf(ev.day);
            accumulateEvent(cur, ev, idx, curScratch);
            rawEvents.push(ev);
          } else if (ev.day >= fetchStart) {
            const idx = prevDays.indexOf(ev.day);
            accumulateEvent(prev, ev, idx, prevScratch);
          }
        });
        finalizeAgg(cur, curScratch);
        finalizeAgg(prev, prevScratch);

        // 2) payments — 고유 주문(orderId) 장부 (2026-10-03 매출 이중집계 fix)
        //    🚨 같은 orderId 가 서로 다른 uid 아래 두 번 기록된다 — uid 회전(기기 초기화·재설치) 후
        //    recoverIapOrders 가 토스 결제이력으로 새 uid 에 재지급하며 `recoveredFromIapHistory:true` 문서를
        //    남기기 때문. 문서 단위로 더하면 재지급이 매출로 또 잡힌다 (실측 14주문·₩37,000 과대 · 9월 31,500→24,000).
        //    규칙 ① 주문당 매출 1건 — 정본 = 원결제 문서(복구·이관 사본 아님) 중 가장 이른 것.
        //         ② 원결제 문서가 아예 없는 복구분(결제 직후 지급 기록 실패 → 이력복구로만 남은 실결제)은
        //            매출로 인정하되 원결제일(orderDate)로 귀속.   ③ 복구 지급은 보조지표로 따로 노출.
        //         ④ 결제 유저 = 같은 주문으로 이어진 uid 들(회전 전후)을 1명으로 묶음.
        //    collectionGroup 전체 fetch — 저트래픽 운영 전제. 플랫폼 = pgProvider('iap'=앱인토스, 그 외=웹 · 2026-06-23).
        let totalRevenue = 0, todayRevenue = 0;
        const ph: PayHealth = {
          confirmed: 0, failed: 0, needsReconciliation: 0, pending: 0, refundCount: 0, refundAmount: 0, byPg: {},
          payerCount: 0, avgLtv: 0, docCount: 0, orderCount: 0,
          recoveredDupCount: 0, recoveredDupAmount: 0, recoveredOnlyCount: 0, recoveredOnlyAmount: 0,
          dupCopyCount: 0, dupCopyAmount: 0,
        };
        // uid 묶음 (union-find) — 같은 주문이 걸린 uid = 같은 토스 계정
        const uidLink = new Map<string, string>();
        const rootUid = (u: string): string => {
          let r = u;
          while (uidLink.has(r) && uidLink.get(r) !== r) r = uidLink.get(r)!;
          let c = u;
          while (c !== r) { const n = uidLink.get(c)!; uidLink.set(c, r); c = n; }
          return r;
        };
        const payerRoots = new Set<string>();
        const curPayers = new Map<string, number>();   // 대표 uid → 기간 내 고유 주문 수
        const prevPayers = new Map<string, number>();
        const firstPayDay = new Map<string, string>(); // 대표 uid → 전체 이력상 첫 결제일
        try {
          const paySnap = await getDocs(collectionGroup(db, 'payments'));
          const orders = new Map<string, PayRow[]>();
          const refunds = new Map<string, number>();
          paySnap.forEach((doc) => {
            const p = doc.data() as any;
            const puid = doc.ref.parent.parent?.id || '';
            if (ownerUidSet.has(puid)) return; // 오너 테스트 결제 제외 (더미)
            const payPlat = String(p.pgProvider || '') === 'iap' ? 'ait' : 'web';
            if (plat !== 'all' && payPlat !== plat) return; // 플랫폼 필터 (매출·결제건강 일관 적용)
            const ptype = String(p.type ?? 'charge');
            if (ptype === 'use') return; // 운 차감 기록 — 결제 아님
            const oid = String(p.orderId || doc.id);
            const amt = Number(p.amount) || 0;
            if (ptype === 'refund') { if (!refunds.has(oid)) refunds.set(oid, amt); return; }
            ph.docCount += 1;
            const row: PayRow = {
              uid: puid, amt,
              status: String(p.status ?? 'confirmed'),
              recovered: p.recoveredFromIapHistory === true,
              migrated: !!p.migratedFromUid,
              ms: tsMs(p.confirmedAt ?? p.createdAt),
              day: paymentDay(p),
              orderDay: orderDateDay(p.orderDate),
              pg: String(p.pgProvider || 'unknown'),
            };
            const arr = orders.get(oid);
            if (arr) arr.push(row); else orders.set(oid, [row]);
          });
          refunds.forEach((amt) => { ph.refundCount += 1; ph.refundAmount += amt; });

          // 주문 단위 판정
          const revenueRows: PayRow[] = [];
          const earliest = (xs: PayRow[]): PayRow => xs.reduce((a, b) => ((b.ms || Infinity) < (a.ms || Infinity) ? b : a));
          orders.forEach((rows) => {
            ph.orderCount += 1;
            for (let i = 1; i < rows.length; i++) { // 같은 주문의 uid 들 = 같은 사람
              const a = rootUid(rows[0].uid), b = rootUid(rows[i].uid);
              if (a && b && a !== b) uidLink.set(b, a);
            }
            // 결제 건강 — 주문의 최종 상태 1개 (confirmed > needs_reconciliation > pending > failed)
            const best = rows.reduce((b, r) => ((PAY_STATUS_RANK[r.status] ?? 0) > (PAY_STATUS_RANK[b.status] ?? 0) ? r : b));
            if (isPaidStatus(best.status)) ph.confirmed += 1;
            else if (best.status === 'failed') ph.failed += 1;
            else if (best.status === 'needs_reconciliation') ph.needsReconciliation += 1;
            else if (best.status === 'pending') ph.pending += 1;

            const paid = rows.filter((r) => isPaidStatus(r.status) && r.amt > 0);
            if (paid.length === 0) return;
            const originals = paid.filter((r) => !r.recovered && !r.migrated);
            const nonRecovered = paid.filter((r) => !r.recovered);
            const canon = originals.length ? earliest(originals) : nonRecovered.length ? earliest(nonRecovered) : earliest(paid);
            paid.forEach((r) => {
              if (r.recovered) {
                const isDup = r !== canon;
                if (isDup) { ph.recoveredDupCount += 1; ph.recoveredDupAmount += r.amt; }
                else { ph.recoveredOnlyCount += 1; ph.recoveredOnlyAmount += r.amt; }
                const ragg = curDays.includes(r.day) ? cur : prevDays.includes(r.day) ? prev : null; // 복구 처리일 기준
                if (ragg) {
                  ragg.recovery.count += 1; ragg.recovery.amount += r.amt;
                  if (isDup) { ragg.recovery.excluded += 1; ragg.recovery.excludedAmount += r.amt; }
                }
              } else if (r !== canon) {
                ph.dupCopyCount += 1; ph.dupCopyAmount += r.amt; // uid 이관 사본 등
              }
            });
            // 원결제 기록 없는 복구분 → 원결제일 귀속 (orderDate 없으면 복구일)
            revenueRows.push(canon.recovered && canon.orderDay ? { ...canon, day: canon.orderDay } : canon);
          });

          revenueRows.forEach((o) => {
            const amt = o.amt;
            const payer = o.uid ? rootUid(o.uid) : '';
            totalRevenue += amt;
            ph.byPg[o.pg] = (ph.byPg[o.pg] ?? 0) + amt;
            if (payer) {
              payerRoots.add(payer);
              const f = firstPayDay.get(payer);
              if (o.day && (!f || o.day < f)) firstPayDay.set(payer, o.day);
            }
            if (o.day === today) todayRevenue += amt;
            const ci = curDays.indexOf(o.day);
            const pi = ci >= 0 ? -1 : prevDays.indexOf(o.day);
            const agg = ci >= 0 ? cur : pi >= 0 ? prev : null;
            if (!agg) return;
            const idx = ci >= 0 ? ci : pi;
            agg.revenue += amt;
            agg.revenueByDay[idx] += amt;
            agg.packageDist[String(amt)] = (agg.packageDist[String(amt)] ?? 0) + 1;
            agg.payOrders += 1;
            agg.chargesByDay[idx] += 1;
            if (payer) {
              const m = ci >= 0 ? curPayers : prevPayers;
              m.set(payer, (m.get(payer) ?? 0) + 1);
            }
          });
        } catch { /* collectionGroup 인덱스 필요 시 0 — noop */ }
        ph.payerCount = payerRoots.size;
        ph.avgLtv = payerRoots.size > 0 ? Math.round(totalRevenue / payerRoots.size) : 0;
        const payHealth = ph;
        // 기간별 결제 유저·재구매·신규·결제자 성별 — 장부 기준 (analytics 이벤트 기준 폐기)
        applyPayers(cur, curPayers, firstPayDay, curScratch, rootUid);
        applyPayers(prev, prevPayers, firstPayDay, prevScratch, rootUid);

        // 3) aiUsage — 현+전 기간 토큰 원가
        try {
          const usageSnap = await getDocs(
            query(collection(db, 'aiUsage'), where('day', '>=', fetchStart), orderBy('day'), limit(10000)),
          );
          usageSnap.forEach((doc) => {
            const u = doc.data() as any;
            const uday = String(u.day || '');
            if (uday >= curStart) accumulateUsage(cur, u);
            else if (uday >= fetchStart) accumulateUsage(prev, u);
          });
        } catch { /* aiUsage 미배포/권한 전 — noop */ }

        // 4) reports 누적 (콘텐츠 생성) + 과거 활동 복원 (2026-06-12)
        //    행동로그(analytics) 수집 이전 기간도 generatedAt 타임스탬프로 일별 생성·활동유저 역산.
        const reportsByType: Record<string, number> = {};
        const genUserSetsCur: Record<number, Set<string>> = {};
        const genUserSetsPrev: Record<number, Set<string>> = {};
        const topicDistAll: Record<string, { count: number; userSet: Set<string> }> = {};
        const typeUserSets: Record<string, Set<string>> = {};
        const topicSubAll: Record<string, Record<string, number>> = {};
        const subOf = (tid: string, r: any): string | null => {
          // 미래 문서: inputMeta 우선 / 과거 문서: 저장된 결과 필드로 역산
          const meta = r.inputMeta || {};
          const td = r.topicData || {};
          if (tid === 'love') {
            if (meta.loveStatus === 'solo') return '솔로';
            if (meta.loveStatus === 'some') return '썸';
            if (meta.loveStatus === 'dating') return '연애중';
            return !td.partnerCompat ? '솔로' : (td.confessionTiming ? '썸' : '연애중');
          }
          if (tid === 'marriage') return (meta.hasPartner || td.partnerCompat || td.partnerProfile) ? '연애중' : '솔로';
          if (tid === 'business') {
            if (meta.bizStatus === 'preparing') return '창업 준비';
            if (meta.bizStatus === 'running') return '운영 중';
            return null;
          }
          return null;
        };
        try {
          const repSnap = await getDocs(collectionGroup(db, 'reports'));
          // twin 잉여 지문 pre-pass (2026-08-13) — 과거 restoreLibrary 버그로 같은 리포트가
          //   base36 정본 + auto-id 사본 두 문서로 남은 유저가 74명. base36 이 있는 (uid·종류·분) 조합을
          //   기록해두고, 본 집계에서 같은 조합의 auto-id 문서를 건너뛴다.
          const twinFp = new Set<string>();
          repSnap.forEach((doc) => {
            if (!doc.ref.parent.parent) return;
            if (!/^m[a-z0-9]{9,16}$/.test(doc.id)) return;
            const r = doc.data() as any;
            const iso = typeof r.createdAt === 'string' ? r.createdAt : (r.createdAt?.toDate?.()?.toISOString?.() ?? '');
            if (iso) twinFp.add(`${doc.ref.parent.parent.id}|${r.contentType ?? 'report'}|${iso.slice(0, 16)}`);
          });
          const seenReportIds = new Set<string>(); // 같은 리포트 id 가 여러 uid 미러에 남은 잔여 사본 (2026-10-03)
          repSnap.forEach((doc) => {
            const r = doc.data() as any;
            // 🚨 이중 카운트 fix (2026-08-13) — collectionGroup('reports') 는 top-level 생성원본과
            //   users/{uid}/reports 백업 미러를 **둘 다** 세서 유료 생성 지표가 ~55% 과대였다 (실측).
            //   유저가 보는 보관함 = users 하위 미러가 전체 집합(무료 포함)이므로 그것만 센다.
            if (!doc.ref.parent.parent) return; // top-level 원본 제외 (미러와 중복)
            // uid 회전 자동이관 사본 제외 — 같은 리포트가 옛/새 uid 양쪽에 존재 (원본 uid 쪽만 집계)
            if (r.migratedFromUid) return;
            // twin 잉여 사본 제외 (auto-id 이고 같은 분에 base36 정본 존재)
            if (/^[A-Za-z0-9]{20}$/.test(doc.id)) {
              const iso = typeof r.createdAt === 'string' ? r.createdAt : (r.createdAt?.toDate?.()?.toISOString?.() ?? '');
              if (iso && twinFp.has(`${doc.ref.parent.parent.id}|${r.contentType ?? 'report'}|${iso.slice(0, 16)}`)) return;
            }
            const ruid = r.uid || doc.ref.parent.parent?.id || '';
            if (ownerUidSet.has(ruid)) return; // 오너 테스트 생성물 제외 (더미 — 전수감사 등)
            // 이관 플래그 없이 두 uid 에 남은 같은 리포트(CS 복원 등 · 실측 5건) — 1회만 집계
            if (seenReportIds.has(doc.id)) return;
            seenReportIds.add(doc.id);
            const t = r.contentType || r.type || 'report'; // 서버 문서는 type 필드 (premium/basic/...)
            reportsByType[t] = (reportsByType[t] ?? 0) + 1;
            const rday = paymentDay({ confirmedAt: r.generatedAt ?? r.createdAt });
            if (ruid) (typeUserSets[t] ??= new Set()).add(ruid);
            // 10주제 분포 (2026-06-12) — topicId 가 전 기록에 저장돼 있어 과거 전체 분해 가능
            const tid = t === 'topic' ? String(r.topicId || 'unknown') : null;
            if (tid) {
              const slot = (topicDistAll[tid] ??= { count: 0, userSet: new Set() });
              slot.count += 1;
              if (ruid) slot.userSet.add(ruid);
              const sub = subOf(tid, r);
              if (sub) {
                (topicSubAll[tid] ??= {})[sub] = (topicSubAll[tid][sub] ?? 0) + 1;
              }
              const ci2 = curDays.indexOf(rday);
              if (ci2 >= 0) cur.topicGen[tid] = (cur.topicGen[tid] ?? 0) + 1;
              else if (prevDays.indexOf(rday) >= 0) prev.topicGen[tid] = (prev.topicGen[tid] ?? 0) + 1;
            }
            const ci = curDays.indexOf(rday);
            if (ci >= 0) {
              cur.genByDay[ci] += 1; cur.genTotal += 1;
              (cur.genByDayType[t] ??= curDays.map(() => 0))[ci] += 1;
              if (ruid) (genUserSetsCur[ci] ??= new Set()).add(ruid);
            } else {
              const pi = prevDays.indexOf(rday);
              if (pi >= 0) {
                prev.genByDay[pi] += 1; prev.genTotal += 1;
                (prev.genByDayType[t] ??= prevDays.map(() => 0))[pi] += 1;
                if (ruid) (genUserSetsPrev[pi] ??= new Set()).add(ruid);
              }
            }
          });
        } catch { /* noop */ }
        // 4-b) 오늘운세 — users/*/dailyFortune/{YYYY-MM-DD} collectionGroup (docId = 날짜 → 과거 전체 복원)
        const dailyDist = { count: 0, userSet: new Set<string>() };
        const dailySeen = new Set<string>(); // uid+day 중복 제거 (plain date 마커 + legacy date_v6 캐시 공존)
        try {
          const dfSnap = await getDocs(collectionGroup(db, 'dailyFortune'));
          dfSnap.forEach((doc) => {
            const dday = doc.id.slice(0, 10); // 'YYYY-MM-DD' 또는 'YYYY-MM-DD_v6' → 날짜만
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dday)) return;
            const duid = doc.ref.parent.parent?.id || '';
            if (ownerUidSet.has(duid)) return; // 오너 테스트 제외 (더미)
            const dedupeKey = `${duid}|${dday}`;
            if (dailySeen.has(dedupeKey)) return;
            dailySeen.add(dedupeKey);
            dailyDist.count += 1;
            if (duid) dailyDist.userSet.add(duid);
            const ci = curDays.indexOf(dday);
            if (ci >= 0) {
              cur.genByDay[ci] += 1; cur.genTotal += 1;
              (cur.genByDayType['daily'] ??= curDays.map(() => 0))[ci] += 1;
              if (duid) (genUserSetsCur[ci] ??= new Set()).add(duid);
            } else {
              const pi = prevDays.indexOf(dday);
              if (pi >= 0) {
                prev.genByDay[pi] += 1; prev.genTotal += 1;
                (prev.genByDayType['daily'] ??= prevDays.map(() => 0))[pi] += 1;
                if (duid) (genUserSetsPrev[pi] ??= new Set()).add(duid);
              }
            }
          });
        } catch { /* rules 배포 전 — noop */ }
        cur.genUsersByDay = curDays.map((_, i) => genUserSetsCur[i]?.size ?? 0);
        prev.genUsersByDay = prevDays.map((_, i) => genUserSetsPrev[i]?.size ?? 0);

        // 4-c) 꿈해몽 무료·사주대화 — aiUsage 전수 (uid 미기록 → 호출 수만 · 2026-06-10 부터)
        const aiCallDist: Record<string, number> = {};
        try {
          const allUsage = await getDocs(query(collection(db, 'aiUsage'), limit(10000)));
          allUsage.forEach((doc) => {
            const u = doc.data() as any;
            if (u.ok === false) return;
            const ut = String(u.type || '');
            aiCallDist[ut] = (aiCallDist[ut] ?? 0) + 1;
          });
        } catch { /* noop */ }

        // 5) 유저 수 (오너 테스트 계정 제외)
        let totalUsers = 0;
        try {
          const uSnap = await getDocs(collection(db, 'users'));
          uSnap.forEach((u) => { if (!ownerUidSet.has(u.id)) totalUsers += 1; });
        } catch { /* noop */ }

        if (!cancelled) {
          const topicDistFinal: Record<string, { count: number; users: number }> = {};
          Object.entries(topicDistAll).forEach(([k, v]) => { topicDistFinal[k] = { count: v.count, users: v.userSet.size }; });
          // 전 콘텐츠 분포 — reports(유저셋 有) + 오늘운세(CG) + aiUsage(꿈무료·대화: 호출 수만)
          const contentDistAll: Record<string, { count: number; users: number | null }> = {};
          Object.entries(reportsByType).forEach(([t, n]) => {
            contentDistAll[t] = { count: n, users: typeUserSets[t]?.size ?? 0 };
          });
          // 오늘운세 — 마커 도입(6/12) 이전 스트림 사용은 기록이 없어 aiUsage 호출 수로 폴백 보정
        contentDistAll['daily'] = dailyDist.count >= (aiCallDist['daily'] ?? 0)
          ? { count: dailyDist.count, users: dailyDist.userSet.size }
          : { count: aiCallDist['daily'] ?? 0, users: null };
          if (aiCallDist['dream']) contentDistAll['dreamFree'] = { count: aiCallDist['dream'], users: null };
          if (aiCallDist['chat']) contentDistAll['chat'] = { count: aiCallDist['chat'], users: null };
          setData({ totalUsers, payHealth, topicDistAll: topicDistFinal, topicSubAll, contentDistAll, totalRevenue, todayRevenue, reportsByType, cur, prev, rawEvents, fetchedAt: new Date() });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '데이터를 불러오지 못했어요');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, range, reloadKey, plat]);

  return { data, busy, error, reload };
}
