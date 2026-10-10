/**
 * 주제분석 반쪽 결과(__partial) 자가치유 — 2026-10-04
 *
 * 배경 (운영 실측 2026-10-03 · 보관함 미러 __partial 14건, 재회운 11건):
 *   ① 클라 마감 150초 < 재회운 생성 ~222초(출력 13.6~14.7K 토큰) → 150초에 반쪽을 박제.
 *      서버는 그 뒤 61~94초 만에 완성본을 reports 에 저장했고 같은 SSE 연결로 done 까지 보냈지만,
 *      클라는 이미 resolve 된 Promise 라 완성본을 그대로 버렸다.
 *   ② 재진입 자가치유(recoverTopicResult)는 '주제 선택 화면' 에서만 돌고 서버 창이 1시간이라,
 *      보관함에서 반쪽 기록을 열거나 1시간 뒤에 돌아온 사용자는 영영 치유되지 않았다 (10/14건).
 *      치유돼도 새 id 로 저장 + 반쪽 로컬 삭제라 서버 미러에 반쪽이 남았다 (4/14건).
 *   ③ '최근 1건' 을 그대로 믿어, 같은 주제를 연달아 돌린 사용자는 다른 시도(다른 상대방) 결과로
 *      덮일 위험이 있었다 (실측: 125초 간격 재회운 2회 — 상대방 유/무).
 *
 * 해결: 반쪽과 완성본이 '같은 생성(같은 토큰 스트림)' 인지 본문 지문으로 판정한 뒤
 *   같은 레코드 id 를 유지한 채 본문만 교체한다 (결제 재차감 0 · 보관함 중복 0 · 서버 미러도 덮어씀).
 *   지문 검증(실데이터): 반쪽 14건 중 13건 정확히 1:1 매칭(125초 간격 2회 시도도 각자 자기 완성본),
 *   완성본 153건 상호 교차 오탐 0건. 본문이 거의 없는 반쪽 1건은 판정불가 → 치유하지 않음(환불 경로).
 *
 * 호출 지점: 주제 화면 진입 / 보관함에서 반쪽 기록 열기 / 생성 직후 늦은 완성본 / (요청) 앱 부팅·보관함 진입.
 */
import {
  getReports, saveReport, deleteReport, getPendingSpends, clearPendingSpend, type LocalReport,
} from '@/services/storage/localStore';

/* ─── 스트림 마감 정책 ───────────────────────────────────────────── */

/** 재회운 마감 — 실측 생성 ~222초(최대 ~244초) + 여유. 서버 함수 timeoutSeconds 300 과 정렬. */
const REUNION_DEADLINE_MS = 300_000;
/** 그 외 주제 마감 — 실측 60~130초. 청크가 계속 들어오면 아래 규칙으로 연장. */
const DEFAULT_DEADLINE_MS = 150_000;
/** 마감 시점에 이 시간 안에 청크가 왔으면 '진행 중' 으로 보고 끊지 않는다. */
export const TOPIC_STREAM_IDLE_MS = 20_000;
/** 진행 중이어도 이 이상은 기다리지 않는다 (서버 timeoutSeconds 상향 여지 포함 · 이후는 늦은 완성본 승격이 처리). */
export const TOPIC_STREAM_ABSOLUTE_CAP_MS = 600_000;

export function topicStreamDeadlineMs(topicId: string): number {
  return topicId === 'reunion' ? REUNION_DEADLINE_MS : DEFAULT_DEADLINE_MS;
}

/** SSE 가 네트워크 단에서 끊겼을 때 서버 스트림 완성본을 기다리는 한도 (스트림 시작 시각 기준). */
export function topicAdoptWaitMs(topicId: string): number {
  return topicId === 'reunion' ? 330_000 : 200_000;
}

/* ─── 같은 생성 판정 (본문 지문) ─────────────────────────────────── */

/** 클라가 덧붙이거나 서버가 사후 보정하는 필드 — 지문에서 제외 */
const FP_SKIP_KEYS = new Set(['partnerName', 'topicId', 'overallScore']);
/** 이 글자 수 미만이면 판정 불가(null) — 같은 사주·같은 주제는 앞부분이 비슷하게 나올 수 있다 */
const FP_MIN_CHARS = 120;

const norm = (s: string) => String(s).replace(/\s+/g, ' ').trim();

type Leaf = [Array<string | number>, string];

function collectLeaves(node: unknown, path: Array<string | number>, out: Leaf[]): void {
  if (typeof node === 'string') {
    const n = norm(node);
    if (n) out.push([path, n]);
    return;
  }
  if (Array.isArray(node)) { node.forEach((x, i) => collectLeaves(x, path.concat(i), out)); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k.startsWith('__') || FP_SKIP_KEYS.has(k)) continue;
      collectLeaves(v, path.concat(k), out);
    }
  }
}

function valueAt(obj: unknown, path: Array<string | number>): unknown {
  let cur: any = obj;
  for (const k of path) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

/**
 * partial(스트림 도중 스냅샷)이 full(완성본)과 같은 생성에서 나왔는가.
 *   반쪽의 문자열 필드는 전부 완성본과 같아야 하고, 스트리밍 도중 잘린 마지막 1개 필드만 접두 일치 허용.
 *   true = 같은 생성 / false = 다른 생성 / null = 비교할 본문이 부족해 판정 불가.
 */
export function isSameTopicGeneration(partial: any, full: any): boolean | null {
  if (!partial || typeof partial !== 'object' || !full || typeof full !== 'object' || full.__partial) return null;
  const leaves: Leaf[] = [];
  collectLeaves(partial, [], leaves);
  let total = 0;
  let truncated = 0;
  for (const [path, p] of leaves) {
    const fv = valueAt(full, path);
    if (typeof fv !== 'string') return false;
    const f = norm(fv);
    if (f === p) { total += p.length; continue; }
    const head = p.slice(0, Math.max(0, p.length - 3)); // 잘린 꼬리(이스케이프 중간 등) 3자 여유
    if (head.length > 0 && f.startsWith(head)) {
      truncated++;
      total += head.length;
      if (truncated > 1) return false;
      continue;
    }
    return false;
  }
  return total >= FP_MIN_CHARS ? true : null;
}

/** 지문으로 쓸 만큼 본문이 쌓였는가 (폴백 전 서버 완성본 대기 여부 판단용) */
export function hasTopicFingerprint(partial: any): boolean {
  if (!partial || typeof partial !== 'object') return false;
  const leaves: Leaf[] = [];
  collectLeaves(partial, [], leaves);
  return leaves.reduce((s, [, v]) => s + v.length, 0) >= FP_MIN_CHARS + 3;
}

/* ─── 시도 장부 (pending ↔ 프로필·상대방) · 진행 중 표시 ─────────────── */

const ATTEMPTS_KEY = 'saju500:topic_attempts';
interface TopicAttempt { topicId: string; profileId: string; partnerName?: string; ts: number }

function readAttempts(): Record<string, TopicAttempt> {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}') || {}; } catch { return {}; }
}

/** analyze 시작 시 pending id 에 대상 프로필·상대방을 기록 — 앱 종료 후 복구가 엉뚱한 프로필에 붙지 않게 */
export function recordTopicAttempt(pendingId: string, a: Omit<TopicAttempt, 'ts'>): void {
  try {
    const now = Date.now();
    const all = readAttempts();
    all[pendingId] = { ...a, ts: now };
    const kept = Object.entries(all)
      .filter(([, v]) => v && now - (v.ts || 0) < 24 * 60 * 60 * 1000)
      .sort((x, y) => y[1].ts - x[1].ts)
      .slice(0, 20);
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch { /* noop */ }
}

/** 이 JS 세션에서 아직 생성(또는 서버 완성본 대기)이 진행 중인 pending — 재진입 복구가 가로채지 않게 */
const inFlight = new Set<string>();
export function markTopicInFlight(pendingId: string): void { inFlight.add(pendingId); }
export function unmarkTopicInFlight(pendingId: string): void { inFlight.delete(pendingId); }

/* ─── 서버 조회 ──────────────────────────────────────────────────── */

async function callFn(name: string, data: unknown, timeout: number): Promise<any> {
  const [{ getFunctions, httpsCallable }, { app }, { ensureAuth }] = await Promise.all([
    import('firebase/functions'), import('@/services/auth/firebase'), import('@/services/auth/authService'),
  ]);
  await ensureAuth();
  const r: any = await httpsCallable(getFunctions(app, 'us-central1'), name, { timeout })(data);
  return r?.data;
}

/** 서버 top-level reports 의 이 uid·주제 최신 완성본 (서버 창 1시간) */
async function fetchLatestServerTopic(topicId: string): Promise<{ reportId: string; content: any } | null> {
  try {
    const d = await callFn('recoverTopicResult', { topicId }, 20_000);
    if (d?.found && d.content && typeof d.content === 'object') return { reportId: String(d.reportId || ''), content: d.content };
  } catch { /* noop */ }
  return null;
}

/** 서버의 이 uid 주제 완성본 전체 (restoreLibrary — 1시간 창 없음 · 생성 시각 포함 · 읽기 전용). 실패 시 null */
async function fetchAllServerTopics(): Promise<Array<{ id: string; createdAt: number; ai: any }> | null> {
  try {
    const d = await callFn('restoreLibrary', {}, 45_000);
    const list: any[] = Array.isArray(d?.reports) ? d.reports : [];
    return list
      .filter((r) => r && r.contentType === 'topic' && r.aiResult && typeof r.aiResult === 'object' && !r.aiResult.__partial)
      .map((r) => ({ id: String(r.id || ''), createdAt: toMs(r.createdAt), ai: r.aiResult }));
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
function toMs(v: unknown): number {
  if (typeof v === 'number') return v;
  const t = Date.parse(String(v ?? ''));
  return Number.isFinite(t) ? t : 0;
}

/**
 * SSE 가 네트워크 단에서 끊긴 뒤(iOS 'Load failed' 등) — 서버 스트림이 끝까지 돌아 저장할 완성본을 기다려 채택.
 *   바로 callable 을 부르면 같은 결과를 한 번 더 생성(토큰 2배 · 서버 차감 2회)한다 (실측 topic 8~17%).
 *   반쪽 지문과 일치하는 완성본만 채택 → 못 찾으면 null (호출부가 callable 폴백).
 */
export async function waitForServerTopicResult(
  topicId: string,
  partial: any,
  opts: { deadlineAt: number; intervalMs?: number },
): Promise<{ reportId: string; content: any } | null> {
  if (!hasTopicFingerprint(partial)) return null;
  const interval = opts.intervalMs ?? 10_000;
  for (;;) {
    const r = await fetchLatestServerTopic(topicId);
    if (r && isSameTopicGeneration(partial, r.content) === true) return r;
    if (Date.now() + interval > opts.deadlineAt) return null;
    await sleep(interval);
  }
}

/* ─── 레코드 승격 (같은 id 유지) ─────────────────────────────────── */

/**
 * 반쪽 레코드를 완성본으로 교체 — 같은 id·createdAt·profileId 유지, 결제 재차감 없음.
 *   saveReport(같은 id) → 서버 미러(users/{uid}/reports/{id})도 완성본으로 덮어써진다.
 *   레코드가 없으면(사용자가 지움) 되살리지 않는다. 이미 완성본이면 그대로 반환.
 */
export function upgradePartialTopicRecord(
  recordId: string,
  fullContent: any,
  opts: { serverReportId?: string; pendingId?: string } = {},
): LocalReport | null {
  if (!fullContent || typeof fullContent !== 'object' || fullContent.__partial) return null;
  const rec = getReports().find((r) => r.id === recordId);
  if (!rec || rec.contentType !== 'topic') return null;
  const prev: any = rec.aiResult || {};
  if (!prev.__partial) return rec; // 이미 치유됨 (중복 호출 무해)
  const {
    topicId: _t, partnerName: _p, __partial: _x, __serverReportId: _s, ...content
  } = fullContent as Record<string, unknown>;
  const topicId: string = prev.topicId;
  const partnerName: string | undefined = prev.partnerName;
  const healedContent: Record<string, unknown> = partnerName ? { ...content, partnerName } : { ...content };
  const healed: LocalReport = {
    ...rec,
    aiResult: {
      topicId,
      ...healedContent,
      ...(opts.serverReportId ? { __serverReportId: opts.serverReportId } : {}),
    },
  };
  try { saveReport(healed); } catch (e) { console.warn('[topicHeal] 저장 실패:', e); return null; }

  // 결과 캐시 — 같은 키가 비었거나 반쪽일 때만 교체 (그 뒤에 새로 받은 완성본은 건드리지 않음)
  if (rec.profileId && topicId) {
    const key = partnerName ? `topic_${topicId}_${rec.profileId}_${partnerName}` : `topic_${topicId}_${rec.profileId}`;
    try {
      const raw = localStorage.getItem(key);
      const cur = raw ? JSON.parse(raw) : null;
      if (!cur || cur.__partial) localStorage.setItem(key, JSON.stringify(healedContent));
    } catch { /* noop */ }
  }

  // pending 해제 — 완성본이 전달됐으니 자동환불 대상에서 뺀다 (이미 환불됐으면 no-op · 재차감은 하지 않음)
  try {
    if (opts.pendingId) {
      clearPendingSpend(opts.pendingId);
    } else if (topicId) {
      const created = toMs(rec.createdAt);
      const pend = getPendingSpends()
        .filter((p) => p.type === `topic:${topicId}` && !inFlight.has(p.id) && p.ts <= created + 5_000 && p.ts >= created - 15 * 60 * 1000)
        .sort((a, b) => b.ts - a.ts)[0];
      if (pend) clearPendingSpend(pend.id);
    }
  } catch { /* noop */ }
  console.info(`[topicHeal] 반쪽 → 완성본 승격 (${topicId}, ${recordId})`);
  return healed;
}

/* ─── 생성 직후 후속 재시도 (늦은 done 을 못 받은 경우) ──────────────── */

const retryScheduled = new Set<string>();
const RETRY_OFFSETS_MS = [15_000, 40_000, 80_000, 140_000, 220_000, 320_000];

/** 반쪽 저장 직후 — 서버 완성본이 생기는 대로(서버 창 1시간 내) 같은 레코드로 승격. 화면 전환과 무관하게 진행. */
export function scheduleTopicHealRetries(recordId: string, opts: { onHealed?: (rec: LocalReport) => void } = {}): void {
  if (retryScheduled.has(recordId)) return;
  retryScheduled.add(recordId);
  const run = async (i: number): Promise<void> => {
    const rec = getReports().find((r) => r.id === recordId);
    if (!rec || !rec.aiResult?.__partial) { retryScheduled.delete(recordId); return; } // 치유됨/삭제됨
    const r = await fetchLatestServerTopic(rec.aiResult.topicId);
    if (r && isSameTopicGeneration(rec.aiResult, r.content) === true) {
      const healed = upgradePartialTopicRecord(recordId, r.content, { serverReportId: r.reportId });
      retryScheduled.delete(recordId);
      if (healed) opts.onHealed?.(healed);
      return;
    }
    if (i + 1 < RETRY_OFFSETS_MS.length) {
      setTimeout(() => { run(i + 1).catch(() => {}); }, RETRY_OFFSETS_MS[i + 1] - RETRY_OFFSETS_MS[i]);
    } else {
      retryScheduled.delete(recordId);
    }
  };
  setTimeout(() => { run(0).catch(() => {}); }, RETRY_OFFSETS_MS[0]);
}

/* ─── 보관함 전수 치유 (부팅·보관함·주제 화면 진입) ─────────────────── */

const HEAL_LOG_KEY = 'saju500:topic_heal_attempts';
const HEAL_MAX_TRIES = 8;
const HEAL_BACKOFF_MS = 10 * 60 * 1000;
let sweepRunning: Promise<LocalReport[]> | null = null;
let sweepRunningIsFull = false;

function readHealLog(): Record<string, { n: number; ts: number }> {
  try { return JSON.parse(localStorage.getItem(HEAL_LOG_KEY) || '{}') || {}; } catch { return {}; }
}
function writeHealLog(log: Record<string, { n: number; ts: number }>): void {
  try {
    const live = new Set(getReports().map((r) => r.id));
    const pruned = Object.fromEntries(Object.entries(log).filter(([id]) => live.has(id)));
    localStorage.setItem(HEAL_LOG_KEY, JSON.stringify(pruned));
  } catch { /* noop */ }
}

/**
 * 이미 같은 생성의 완성본이 보관함에 따로 있는 반쪽 (구 복구 경로가 새 id 로 저장 + 서버 미러에 반쪽이 남아
 * 복원 때 함께 되살아난 경우 · 실측 4/14건) — 승격하면 보관함 중복이 되므로 반쪽만 지운다.
 * deleteReport 가 주제 결과 캐시까지 지우므로, 반쪽이 아닌 캐시 값은 되돌려 놓는다.
 */
function removeSupersededPartial(t: LocalReport): void {
  const topicId = String(t.aiResult?.topicId || '');
  const keep: Array<[string, string]> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`topic_${topicId}_`)) continue;
      const v = localStorage.getItem(k);
      try { if (v && !JSON.parse(v)?.__partial) keep.push([k, v]); } catch { /* noop */ }
    }
  } catch { /* noop */ }
  try { deleteReport(t.id); } catch { /* noop */ }
  for (const [k, v] of keep) { try { localStorage.setItem(k, v); } catch { /* noop */ } }
  console.info(`[topicHeal] 완성본이 이미 있는 반쪽 정리 (${topicId}, ${t.id})`);
}

/**
 * 로컬 보관함의 __partial 주제 기록을 서버 완성본으로 치유 (같은 id 유지).
 *   반환: 치유된 레코드들 (이미 따로 있던 완성본으로 대체된 반쪽은 그 완성본 레코드 — id 가 다름).
 *   onlyIds — 특정 기록만 (보관함에서 연 기록) / force — 재시도 간격 무시.
 *   네트워크는 치유 대상이 있을 때만 1회 (restoreLibrary — 1시간 창 없이 생성 시각 포함 전체, 서버 쓰기 없음).
 */
export function healPartialTopicReports(opts: { onlyIds?: string[]; force?: boolean } = {}): Promise<LocalReport[]> {
  if (sweepRunning && sweepRunningIsFull && !opts.onlyIds) return sweepRunning; // 전수 치유 진행 중이면 합류
  const prev = sweepRunning;
  const p = (async (): Promise<LocalReport[]> => {
    if (prev) { try { await prev; } catch { /* noop */ } }
    const now = Date.now();
    const log = readHealLog();
    const healed: LocalReport[] = [];
    const targets = getReports().filter((r) =>
      r.contentType === 'topic' && r.aiResult?.__partial === true && !!r.aiResult?.topicId
      && (!opts.onlyIds || opts.onlyIds.includes(r.id))
      && (opts.force || !log[r.id] || (log[r.id].n < HEAL_MAX_TRIES && now - log[r.id].ts > HEAL_BACKOFF_MS)))
      .filter((t) => {
        // 같은 생성의 완성본이 보관함에 이미 있으면 승격(=중복) 대신 반쪽 정리 (네트워크 불필요)
        const dup = getReports().find((r) => r.id !== t.id && r.contentType === 'topic' && !r.aiResult?.__partial
          && r.aiResult?.topicId === t.aiResult.topicId && isSameTopicGeneration(t.aiResult, r.aiResult) === true);
        if (!dup) return true;
        removeSupersededPartial(t);
        delete log[t.id];
        healed.push(dup);
        return false;
      });
    if (targets.length === 0) { writeHealLog(log); return healed; }

    let cands = await fetchAllServerTopics();
    if (!cands) {
      // restoreLibrary 실패 시 — 주제별 최신 1건(서버 1시간 창)으로라도
      cands = [];
      for (const tid of [...new Set(targets.map((t) => String(t.aiResult.topicId)))]) {
        const r = await fetchLatestServerTopic(tid);
        if (r) cands.push({ id: r.reportId, createdAt: 0, ai: { topicId: tid, ...r.content } });
      }
    }

    for (const t of targets) {
      const created = toMs(t.createdAt);
      const matches = cands.filter((c) =>
        c.ai.topicId === t.aiResult.topicId
        && (c.createdAt === 0 || c.createdAt >= created - 10 * 60 * 1000)
        && isSameTopicGeneration(t.aiResult, c.ai) === true);
      if (matches.length === 0) {
        log[t.id] = { n: (log[t.id]?.n || 0) + 1, ts: now };
        continue;
      }
      matches.sort((a, b) => Math.abs(a.createdAt - created) - Math.abs(b.createdAt - created));
      const best = matches[0];
      const rec = upgradePartialTopicRecord(t.id, best.ai, { serverReportId: best.id });
      if (rec) { healed.push(rec); delete log[t.id]; }
    }
    writeHealLog(log);
    return healed;
  })();
  sweepRunning = p;
  sweepRunningIsFull = !opts.onlyIds;
  p.then(() => undefined, () => undefined).then(() => { if (sweepRunning === p) sweepRunning = null; });
  return p;
}

/* ─── 반쪽조차 저장 못 하고 앱이 닫힌 경우 (pending 만 남음) ──────────── */

/**
 * 미해결 pending 의 서버 완성본을 새 기록으로 복원 (기존 2026-06-17 복구 경로의 안전판).
 *   · 이 세션에서 진행 중인 시도 / 반쪽 기록이 소유한 pending 은 건드리지 않는다.
 *   · 시도 장부의 프로필이 지금 프로필과 다르면 복원하지 않는다 (엉뚱한 사람 보관함 방지).
 *   · 서버 '최신' 이 이미 보관함에 있는 결과(같은 생성)면 이 pending 의 결과가 아니다 → 복원 X (환불 경로 유지).
 */
export async function recoverPendingTopic(args: {
  topicId: string;
  profile: { id: string; name: string; input: any; sajuData: any };
  newId: () => string;
}): Promise<LocalReport | null> {
  const { topicId, profile } = args;
  const reports = getReports();
  const attempts = readAttempts();
  const pend = getPendingSpends()
    .filter((p) => p.type === `topic:${topicId}` && !inFlight.has(p.id))
    .filter((p) => !reports.some((r) => r.contentType === 'topic' && r.aiResult?.topicId === topicId
      && r.aiResult?.__partial === true && toMs(r.createdAt) >= p.ts))
    .filter((p) => { const a = attempts[p.id]; return !a?.profileId || a.profileId === profile.id; })
    .sort((a, b) => b.ts - a.ts)[0];
  if (!pend) return null;

  const r = await fetchLatestServerTopic(topicId);
  if (!r) return null;
  const already = getReports().some((x) => x.contentType === 'topic' && x.aiResult?.topicId === topicId && (
    x.id === r.reportId
    || x.aiResult?.__serverReportId === r.reportId
    || (!x.aiResult?.__partial && isSameTopicGeneration(x.aiResult, r.content) === true)));
  if (already) return null;

  const partnerName = attempts[pend.id]?.partnerName;
  const content = partnerName ? { ...r.content, partnerName } : r.content;
  const rec: LocalReport = {
    id: r.reportId || args.newId(),
    name: profile.name, input: profile.input, sajuData: profile.sajuData,
    type: 'paid', contentType: 'topic', createdAt: new Date().toISOString(),
    aiResult: { topicId, ...content }, profileId: profile.id,
  };
  try { saveReport(rec); } catch { return null; }
  try {
    const key = partnerName ? `topic_${topicId}_${profile.id}_${partnerName}` : `topic_${topicId}_${profile.id}`;
    localStorage.setItem(key, JSON.stringify(content));
  } catch { /* noop */ }
  clearPendingSpend(pend.id); // 결과 전달 → 환불 대신
  return rec;
}
