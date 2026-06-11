// DailyFortunePage — #57 Sprint 2 UI 개편 (2026-04-24)
// 스펙: docs/mockups/사주500_UI개편_03_결과.md §10 (오늘운세 고유 레이아웃) · §6 (UpsellCard) · §7 (AdBanner)
// 핸드오프: §2-10
//
// 결과 구조 (§10):
//   - 상단 day-tile 96px 풀폭 · 좌 "M/D" Display 40 · 우 일주(60갑자) 한자
//   - L1 요약 (한자 32px + 점수 + 3~5문장)
//   - L2 본문 (오늘의 톤 + 시간대 흐름 압축)
//   - L3 심층 [축소] 1문단 (4영역 mini grid + reason)
//   - L4 "오늘 해볼 3가지" 고정 (체크리스트 3개 + 한 줄)
//   - AdBanner — build === 'appintos' && tier === 'free' 만
//   - UpsellCard 프리미엄 10운 (§6 단일, 과잉 금지)
//
// 보존 (절대 삭제 금지):
//   - DailyRewardBadge (P2-5)
//   - SSOT 토큰 (#41 sweep + D1 fix)
//   - Flippable 정적화 (#39) — 결과 phase에서 SajuMiniCard 제거 (day-tile로 대체) · 재플립 추가 금지

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Solar } from 'lunar-javascript';
import { Header } from '@/components/layout/Header';
import { AdSlot } from '@/components/ads/AdSlot';
import { DarkHeader } from '@/components/layout/DarkHeader';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { ErrorState } from '@/components/common/ErrorState';
import { ProfileSelector } from '@/components/common/ProfileSelector';
import { SajuMiniCard, type PillarData } from '@/components/saju/SajuMiniCard';
import { DailyRewardBadge } from '@/components/common/DailyRewardBadge';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import { useToast } from '@/components/common/Toast'; // 2026-05-27 — 공유 리워드 토스트용 재추가
import {
  getProfiles,
  getReport,
  saveReport,
  generateId,
  type SajuProfile,
} from '@/services/storage/localStore';
import { generateDailyFortune, generateDailyFortuneStream } from '@/services/ai/reportGenerator';
import { stripMd } from '@/utils/format';
import type { OhengType } from '@/types/saju';
// 점수 SSOT + AI 프롬프트 baseScores100 전달
import { computeDailyBase100 } from '@/utils/sajuScores';
// DailyMockupView 단일 호출 (legacy chrome 폐기 · 2026-05-06)
import { DailyMockupView } from './daily/DailyMockupView';

/* ══════════════════════════════════════════════════════════════════
 * 토큰 / 매핑
 * ═════════════════════════════════════════════════════════════════ */

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

/** 천간(10간) → 오행 */
const STEM_TO_OHENG: Record<string, OhengType> = {
  甲: '목', 乙: '목',
  丙: '화', 丁: '화',
  戊: '토', 己: '토',
  庚: '금', 辛: '금',
  壬: '수', 癸: '수',
};

type Phase = 'select' | 'loading' | 'result' | 'error';

interface DateInfo {
  date: string;
  weekday: string;
  ganzi: string;
  label: string;
}

/* ══════════════════════════════════════════════════════════════════
 * Page
 * ═════════════════════════════════════════════════════════════════ */
export function DailyFortunePage() {
  usePageTitle('오늘의 운세');
  useSeoMeta({
    description: '오늘의 운세를 명리학으로 무료로 풀이해드려요. 매일 보는 나의 운세, 사주500.',
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { mark } = useAttendanceOnResult();

  // 2026-05-07 fix — 보관함 → /daily 진입 시 location.state 로 savedResult/savedReport 전달
  // (Daeun/Monthly/Tojung/Compat 와 동일 패턴. 이전엔 ?reportId query 만 봐서 입력화면 떨어졌음)
  const navState = location.state as { savedResult?: any; savedReport?: any } | undefined;

  const profiles: SajuProfile[] = useMemo(() => getProfiles(), []);
  const hasAnyProfile = profiles.length > 0;

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => {
    // navState 의 savedReport 가 있으면 그 input 으로 매칭되는 프로필 우선
    if (navState?.savedReport?.input) {
      const r = navState.savedReport.input;
      const matched = profiles.find(
        (p) => p.input?.birthYear === r.birthYear &&
               p.input?.birthMonth === r.birthMonth &&
               p.input?.birthDay === r.birthDay,
      );
      if (matched) return matched.id;
    }
    const self = profiles.find((p) => !p.relation || p.relation === '본인');
    return (self ?? profiles[0])?.id ?? null;
  });
  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  // savedReport 가 있으면 (aiResult 비어도) result phase 강제 — 입력 화면 회귀 절대 차단
  const [phase, setPhase] = useState<Phase>(navState?.savedReport ? 'result' : 'select');
  const [result, setResult] = useState<any>(navState?.savedResult ?? null);
  const [apiError, setApiError] = useState('');
  // 2026-05-29 — 출시 프로모션 10원: 무료 오늘운세 결과 도달도 첫 콘텐츠로 인정 (코드 단위 dedupe · 앱인토스 only).
  useEffect(() => {
    if (phase === 'result') {
      import('@/services/toss/tossPromotion').then(m => m.grantLaunchPromotion());
      // 2026-06-02 — 출석 적립 + 일일/연속 보상 자동 지급 (콘텐츠 이용 시, 클라 잔액 적립)
      import('@/services/storage/dailyReward').then(m => m.processAttendanceRewards());
      // LIVE BEST 조회 기록 (24h 디듀프)
      import('@/services/liveBest').then(m => m.recordTopicView('daily')).catch(() => {});
    }
  }, [phase]);
  const [streamProgress, setStreamProgress] = useState<{ chunks: number; chars: number; elapsedMs: number } | null>(null);
  const isAnalyzingRef = useRef(false);

  // 프로필 전환 시 결과 초기화 (단, ?reportId 또는 navState.savedResult 진입 직후엔 복원 결과 보존)
  const reportIdFromUrl = searchParams.get('reportId');
  // 2026-05-07 fix — navState.savedReport 가 있으면 mount 시 cleanup 차단 (보관함 진입 보호)
  const restoreFromNavStateRef = useRef(!!navState?.savedReport);
  useEffect(() => {
    // ?reportId 가 있으면 이 effect 가 cleanup 하지 않음 (복원 effect 가 result 세팅)
    if (reportIdFromUrl) return;
    // navState.savedResult 로 mount 한 직후 (1회 limit) cleanup skip
    if (restoreFromNavStateRef.current) {
      restoreFromNavStateRef.current = false;
      return;
    }
    setResult(null);
    setPhase('select');
    setApiError('');
  }, [selectedProfileId, reportIdFromUrl]);

  /* P0 fix (2026-05-06 회귀 차단 #2) — 보관함 → 오늘의 운세 결과 복원
   * 변경: deps [reportIdFromUrl] (race condition 차단) + restoreOnceRef (1회 가드)
   * + r.aiResult 비어도 phase='result' 강제 (입력 페이지 회귀 절대 차단) */
  const restoreOnceRef = useRef(false);
  useEffect(() => {
    if (restoreOnceRef.current) return;
    if (!reportIdFromUrl) return;
    restoreOnceRef.current = true;
    try {
      const r = getReport(reportIdFromUrl);
      console.log('[DailyFortunePage] reportId 복원 시도:', reportIdFromUrl, '→', !!r, '/aiResult:', !!r?.aiResult);
      if (!r) return;
      // aiResult 비어도 phase 전이 (회귀 차단 — 입력 페이지로 절대 떨어지지 않게)
      if (r.aiResult) setResult(r.aiResult);
      setPhase('result');
      // 해당 리포트의 프로필로 selectedProfileId 도 정렬 (없으면 무시)
      const matchingProfile = profiles.find(
        (p) => p.input?.birthYear === r.input?.birthYear &&
               p.input?.birthMonth === r.input?.birthMonth &&
               p.input?.birthDay === r.input?.birthDay,
      );
      if (matchingProfile && matchingProfile.id !== selectedProfileId) {
        setSelectedProfileId(matchingProfile.id);
      }
    } catch (e) {
      console.error('[DailyFortunePage] reportId 복원 실패:', e);
    }
  }, [reportIdFromUrl]);

  const today = useMemo(() => new Date(), []);
  const dateInfo = useMemo(() => buildTodayGanzi(today), [today]);
  const tomorrowInfo = useMemo(() => buildTomorrowGanzi(today), [today]);

  /* ─── 오늘의 운세 호출 ─── */
  async function analyze() {
    if (!selectedProfile?.sajuData) return;
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setPhase('loading');
    setApiError('');

    try {
      // STEP 2A — 종합사주 base 점수 (subScores ±2 한도 강제용)
      const baseScores100 = computeDailyBase100(selectedProfile.sajuData);
      const callPayload = {
        name: selectedProfile.name || '당신',
        sajuData: selectedProfile.sajuData,
        date: dateInfo.date,
        weekday: dateInfo.weekday,
        todayGanzi: dateInfo.ganzi,
        baseScores100,
        tomorrowGanzi: tomorrowInfo.ganzi,
        tomorrowDate: tomorrowInfo.date,
      };

      // 2026-05-06 v2 — Streaming SSE + timeout 강제 + 자세한 로그
      // P0 fix: 로딩만 되고 결과 안 옴 → SSE Promise hang 시 90초 timeout + callable 폴백
      let res: any;
      let streamingDone = false;
      setStreamProgress(null);
      const sseStartedAt = Date.now();

      console.log('[DailyFortune] analyze() 시작');

      await new Promise<void>((resolve) => {
        let resolved = false;
        const finish = (reason: string) => {
          if (resolved) return;
          resolved = true;
          console.log(`[DailyFortune] SSE finish: ${reason} (${Date.now() - sseStartedAt}ms)`);
          resolve();
        };
        // 90초 timeout — SSE 가 결과 못 주면 강제 callable 폴백
        const timeoutId = setTimeout(() => {
          console.warn('[DailyFortune] SSE 90s timeout → callable 폴백');
          finish('timeout');
        }, 90_000);
        // 2026-06-11 P0 — 'done' 이벤트 유실 방어: A1·A2·B 3그룹이 모두 도착했으면
        //   결과는 이미 완전함. done 이 8초 내 안 오면 그룹 머지본으로 자체 완료
        //   (기존엔 90초 대기 후 callable 재생성 → 유저 90초+ 대기 + AI 비용 2배).
        let allGroupsGraceId: ReturnType<typeof setTimeout> | null = null;
        // 첫 chunk 30초 timeout — 첫 chunk 안 오면 streaming 안 작동 가정
        const firstChunkTimeoutId = setTimeout(() => {
          if (!resolved) {
            console.warn('[DailyFortune] SSE 30s 첫 chunk 미도달 → callable 폴백');
            finish('first-chunk-timeout');
          }
        }, 30_000);

        let phaseTransitioned = false;
        // v6.1 · 3 그룹 (A1/A2/B) 누적 머지 — A1 도착 시 첫 paint (~6s)
        const groupBuffer: Record<string, any> = { A1: null, A2: null, B: null, A: null };
        generateDailyFortuneStream(callPayload, {
          onStart: () => console.log('[DailyFortune] SSE start'),
          onPartial: ({ partial, totalChars, group }) => {
            // ⭐ Progressive Render — 3 그룹 머지된 partial 갱신
            try {
              clearTimeout(firstChunkTimeoutId);
              if (!partial || typeof partial !== 'object') return;
              setResult(partial);
              // Group A1 의 핵심 키 (title·subScores) 도달 시 즉시 전이
              const hasMinKeys =
                partial.title || partial.headline ||
                partial.scoreHeadline || partial.todayNarrative ||
                partial.subScores;
              if (!phaseTransitioned && hasMinKeys) {
                phaseTransitioned = true;
                setPhase('result');
                console.log('[DailyFortune] 첫 partial → phase=result 전이', { group, chars: totalChars });
              }
            } catch (err) {
              console.error('[DailyFortune] onPartial throw (가드됨):', err);
            }
          },
          onGroup: ({ group, data, elapsedMs }) => {
            // Group 완료 — partial 보다 정확한 fully-parsed 데이터.
            // A1·A2·B 어떤 순서로 도착해도 머지.
            try {
              clearTimeout(firstChunkTimeoutId);
              groupBuffer[group] = data;
              const merged: any = {
                ...(groupBuffer.A1 || {}),
                ...(groupBuffer.A2 || {}),
                ...(groupBuffer.B || {}),
                ...(groupBuffer.A || {}), // legacy fallback
              };
              setResult(merged);
              if (!phaseTransitioned) {
                phaseTransitioned = true;
                setPhase('result');
              }
              console.log(`[DailyFortune] Group ${group} 완료 (${elapsedMs}ms) → 머지 갱신`);
              // 3그룹 완비 → done 유실 대비 8초 유예 자체 완료
              if (groupBuffer.A1 && groupBuffer.A2 && groupBuffer.B && !resolved && !allGroupsGraceId) {
                allGroupsGraceId = setTimeout(() => {
                  if (resolved) return;
                  const full: any = { ...(groupBuffer.A1 || {}), ...(groupBuffer.A2 || {}), ...(groupBuffer.B || {}) };
                  console.warn('[DailyFortune] done 미수신 — 3그룹 머지본으로 자체 완료');
                  res = full;
                  streamingDone = true;
                  setResult(full);
                  if (!phaseTransitioned) { phaseTransitioned = true; setPhase('result'); }
                  clearTimeout(timeoutId);
                  finish('all-groups-grace');
                }, 8_000);
              }
            } catch (err) {
              console.error('[DailyFortune] onGroup throw (가드됨):', err);
            }
          },
          onProgress: (info) => {
            clearTimeout(firstChunkTimeoutId);
            setStreamProgress(info);
          },
          onDone: ({ result: streamResult, cached }) => {
            console.log('[DailyFortune] SSE done', { cached, hasResult: !!streamResult });
            clearTimeout(timeoutId);
            clearTimeout(firstChunkTimeoutId);
            if (allGroupsGraceId) clearTimeout(allGroupsGraceId);
            if (streamResult) {
              res = streamResult;
              streamingDone = true;
              // 완전한 결과로 갱신 (partial/group → final)
              setResult(streamResult);
              if (!phaseTransitioned) setPhase('result');
            }
            finish('done');
          },
          onError: (msg) => {
            console.warn('[DailyFortune] SSE error → callable 폴백:', msg);
            clearTimeout(timeoutId);
            clearTimeout(firstChunkTimeoutId);
            finish('sse-error');
          },
        }).catch((e) => {
          console.warn('[DailyFortune] SSE throw → callable 폴백:', e?.message);
          clearTimeout(timeoutId);
          clearTimeout(firstChunkTimeoutId);
          finish('sse-throw');
        });
      });

      // SSE 실패 시 callable 폴백
      if (!streamingDone) {
        console.log('[DailyFortune] callable 폴백 시작');
        try {
          res = await generateDailyFortune(callPayload);
          console.log('[DailyFortune] callable 응답 도달', { hasResult: !!res });
        } catch (retryErr: any) {
          const msg = String(retryErr?.message || '');
          const is500 = msg.includes('500') || msg.includes('Internal server error') || msg.includes('api_error');
          if (is500) {
            console.warn('[DailyFortune] callable 일시 500 → 1초 후 재시도');
            await new Promise((r) => setTimeout(r, 1000));
            res = await generateDailyFortune(callPayload);
          } else {
            throw retryErr;
          }
        }
      }
      console.log('[DailyFortune] analyze() 응답 확보', { hasResult: !!res, keys: res ? Object.keys(res).slice(0, 5) : [] });

      // 응답 검증 완화 (2026-05-06) — title 또는 todayNarrative 또는 subScores 중 하나라도 있으면 OK
      // 이전: overallScore/score 강제 → 누락 시 throw → "로딩만 됨" 버그 원인
      if (!res || typeof res !== 'object') {
        throw new Error('응답 데이터를 받지 못했어요');
      }
      const hasMinContent =
        ('title' in res) || ('headline' in res) ||
        ('todayNarrative' in res) || ('subScores' in res) ||
        ('overallScore' in res) || ('score' in res);
      if (!hasMinContent) {
        console.error('[DailyFortune] 응답 형식 미달:', Object.keys(res));
        throw new Error('응답 데이터가 비어있어요. 다시 시도해주세요.');
      }

      setResult(res);
      setPhase('result');

      // 이벤트 v4 출석 마커 (KST 당일 1회) — 보존
      mark().catch(() => {/* non-blocking */});

      try {
        saveReport({
          id: generateId(),
          name: selectedProfile.name,
          input: selectedProfile.input,
          sajuData: selectedProfile.sajuData,
          type: 'free',
          contentType: 'daily',
          aiResult: res,
          createdAt: new Date().toISOString(),
        });
      } catch {
        /* 무시 */
      }
    } catch (e: any) {
      console.error('[DailyFortune] 실패:', e);
      // 2026-05-29 — e.message(영문 기술오류) 노출 금지. 항상 친절 카피.
      setApiError('오늘의 운세를 살피는 데 잠시 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
      setPhase('error');
    } finally {
      isAnalyzingRef.current = false;
    }
  }

  // 결과 phase 일 때 DarkHeader (PremiumResult 패턴 통일), 그 외 기본 Header
  const isResultPhase = phase === 'result' && !!selectedProfile;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      {isResultPhase ? (
        <DarkHeader
          title={`${selectedProfile?.name || '내'} 님의 오늘의 운세`}
          subtitle="FREE · 7섹션 일일 풀이"
          chip="무료"
          chipVariant="free"
        />
      ) : (
        <Header title="오늘의 운세" />
      )}
      {/* result phase = 풀 width (daily-mockup 자체 padding 사용 · 종합사주 패턴) */}
      <div
        className={isResultPhase ? 'pb-[120px] mx-auto' : 'px-5 pt-4 pb-[120px] mx-auto'}
        style={{ maxWidth: 520 }}
      >
        {/* P2-5 · 데일리 리워드 배지 — result phase 에서는 숨김 (2026-05-06)
            DarkHeader 아래 중복 정보 제거. select phase 에서만 노출. */}
        {hasAnyProfile && !isResultPhase && <DailyRewardBadge className="mb-4" />}

        <AnimatePresence mode="wait">
          {!hasAnyProfile && (
            <motion.div
              key="no-profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <ProfileSelector
                profiles={profiles}
                selectedId={selectedProfileId}
                onChange={setSelectedProfileId}
                onCreateNew={() => navigate('/input')}
              />
              <p
                className="text-body-sm"
                style={{ color: 'var(--text-muted)', textAlign: 'center' }}
              >
                오늘의 운세는 사주 기반이에요. 생년월일만 입력하면 1분.
              </p>
            </motion.div>
          )}

          {hasAnyProfile && phase === 'select' && (
            <SelectView
              key="select"
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onProfileChange={setSelectedProfileId}
              onCreateNew={() => navigate('/input?new=1')}
              profile={selectedProfile}
              dateInfo={dateInfo}
              onAnalyze={analyze}
            />
          )}

          {hasAnyProfile && phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AILoading
                name={selectedProfile?.name ?? '당신'}
                type="오늘의 운세"
                sajuData={selectedProfile?.sajuData}
                steps={[
                  '오늘 간지와 사주를 교차하고 있어요',
                  '4영역 점수를 계산하고 있어요',
                  '시간대별 흐름을 정리하고 있어요',
                ]}
                streamProgress={streamProgress}
              />
            </motion.div>
          )}

          {hasAnyProfile && phase === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ErrorState
                title="해석을 가져오지 못했어요"
                subtitle={apiError || '잠시 후 다시 시도해주세요'}
                onRetry={analyze}
                onBack={() => setPhase('select')}
                showRefundNote={true}
              />
            </motion.div>
          )}

          {hasAnyProfile && phase === 'result' && result && selectedProfile && (
            <ResultView
              key="result"
              result={result}
              profile={selectedProfile}
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onProfileChange={setSelectedProfileId}
              onCreateNew={() => navigate('/input?new=1')}
              dateInfo={dateInfo}
              onPremiumUpsell={() => {
                // 2026-05-28 — 월운 미출시 → CTA 제거됨. 핸들러는 호출되지 않음 (dead code, prop 호환만 유지)
              }}
              onRetry={analyze}
            />
          )}
        </AnimatePresence>

        {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) */}
        <div className="mt-10 text-center space-y-1">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반
          </p>
          <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>
            사주는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * SelectView — 진입 화면 (프로필 선택 + 분석 시작)
 * ═════════════════════════════════════════════════════════════════ */
function SelectView({
  profiles,
  selectedProfileId,
  onProfileChange,
  onCreateNew,
  profile,
  dateInfo,
  onAnalyze,
}: {
  profiles: SajuProfile[];
  selectedProfileId: string | null;
  onProfileChange: (id: string) => void;
  onCreateNew: () => void;
  profile: SajuProfile | null;
  dateInfo: DateInfo;
  onAnalyze: () => void;
}) {
  const pillars = useMemo(() => (profile ? buildPillars(profile) : []), [profile]);
  const hasSajuData = pillars.length === 4 && !!profile?.sajuData;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <FadeIn>
        <ProfileSelector
          profiles={profiles}
          selectedId={selectedProfileId}
          onChange={onProfileChange}
          onCreateNew={onCreateNew}
        />
      </FadeIn>

      {/* Hero — ExtensionHero 패턴 통일 (gradient + 한자 워터마크 + seal + crumb + tier) */}
      <FadeIn delay={0.05}>
        <header
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '18px 20px 28px',
            color: '#FFFFFF',
            background: 'linear-gradient(135deg,#7A6347 0%,#54422E 60%,#332618 100%)',
            borderRadius: 16,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: -18,
              bottom: -40,
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 220,
              fontWeight: 900,
              color: 'rgba(255,255,255,0.07)',
              lineHeight: 1,
              pointerEvents: 'none',
              letterSpacing: '-0.05em',
            }}
          >
            日
          </span>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: 18,
              top: 18,
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.30)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 22,
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            日
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.78,
              marginBottom: 8,
              letterSpacing: '0.02em',
              position: 'relative',
            }}
          >
            사주500 · 오늘의 운세 · {dateInfo.label}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              fontSize: 12,
              opacity: 0.92,
              flexWrap: 'wrap',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <span style={{ background: 'rgba(255,255,255,0.22)', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
              일진 운세
            </span>
            <span style={{ background: 'rgba(255,255,255,0.14)', padding: '3px 10px', borderRadius: 100, fontSize: 10 }}>
              무료 · 1일 1회
            </span>
          </div>
          <h2
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 22,
              fontWeight: 700,
              marginTop: 14,
              letterSpacing: '-0.02em',
              lineHeight: 1.4,
              position: 'relative',
            }}
          >
            {profile?.name ?? '당신'}님의<br />
            오늘 운세를 풀어드릴게요
          </h2>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, position: 'relative' }}>
            일주와 오늘 간지의 작용, 용신·대운 흐름까지 함께 살펴볼게요.
          </div>
        </header>
      </FadeIn>

      {/* 만세력 미리보기 — 라벨 "내 만세력" + 부제 萬歲曆 (사주카드 톤 통일) */}
      {hasSajuData && (
        <FadeIn delay={0.1}>
          <section className="card-secondary">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <p className="sec-title" style={{ margin: 0 }}>내 만세력</p>
              <span style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--brand-gold)',
                letterSpacing: '0.06em',
              }}>
                萬歲曆
              </span>
            </div>
            <SajuMiniCard pillars={pillars} />
          </section>
        </FadeIn>
      )}

      <div className="sticky-cta-bottom">
        <button className="cta-gold" onClick={onAnalyze} disabled={!hasSajuData}>
          오늘의 운세 보기 (무료)
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ResultView — 새 §10 레이아웃 (day-tile + L1~L4 축소형 + Ad + Upsell)
 * ═════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
 * ResultView (v5 2026-05-06) — mockup HTML 진본 픽셀-퍼펙트 카피.
 *   ProfileSelector 만 보존 (다른 프로필 전환), 나머지는 DailyMockupView 단일 호출.
 *   legacy 카드/필드 (sajuTone·todayConnection·oneLiner·radarScores·ohengComparison·
 *   sajuConnection·interpretation·timeline·actionAdvice) 전수 삭제.
 * ═════════════════════════════════════════════════════════════════ */
function ResultView({
  result,
  profile,
  // ProfileSelector 제거 (2026-05-06) — 이하 props 미사용 (호출부 호환 위해 시그니처 유지)
  profiles: _profiles,
  selectedProfileId: _selectedProfileId,
  onProfileChange: _onProfileChange,
  onCreateNew: _onCreateNew,
  dateInfo,
  onPremiumUpsell,
  onRetry: _onRetry,
}: {
  result: any;
  profile: SajuProfile;
  profiles: SajuProfile[];
  selectedProfileId: string | null;
  onProfileChange: (id: string) => void;
  onCreateNew: () => void;
  dateInfo: DateInfo;
  onPremiumUpsell: () => void;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  // 2026-05-28 PM — toast 미사용 (공유는 shareResult 직접 호출 · 알림 자체 처리). useToast 호출 자체 보존 위해 void.
  void useToast;

  // 오늘 일진 → 한글 읽기 + 오행
  const dayStem = dateInfo.ganzi?.[0] ?? '';
  const todayOheng: OhengType = useMemo(() => getDayOheng(dateInfo.ganzi), [dateInfo.ganzi]);
  const todayGanReading = useMemo(() => {
    const map: Record<string, string> = {
      甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
      己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
    };
    return map[dayStem] || '';
  }, [dayStem]);

  // 내 일간
  const myGan = profile?.sajuData?.pillars?.[2]?.천간 || '';
  const myGanReading = profile?.sajuData?.pillars?.[2]?.천간읽기 || '';
  const myOheng: OhengType = (profile?.sajuData?.pillars?.[2]?.천간오행 as OhengType) || '토';

  // relationLabel 폐기 (2026-05-07) — DailyMockupView 가 getOhengRelation() 으로 직접 일상어 라벨 생성

  // 헤더 날짜 라벨 (예: "2026년 5월 6일 화요일 · 병진일(丙辰)")
  const dateLabel = useMemo(() => {
    try {
      const d = new Date((dateInfo?.date || '') + 'T00:00:00');
      if (isNaN(d.getTime())) return dateInfo?.label || '';
      const yy = d.getFullYear();
      const mm = d.getMonth() + 1;
      const dd = d.getDate();
      const ganziLabel = dateInfo?.ganzi ? ` · ${todayGanReading}일(${dateInfo.ganzi})` : '';
      return `${yy}년 ${mm}월 ${dd}일 ${dateInfo?.weekday || ''}요일${ganziLabel}`;
    } catch {
      return dateInfo?.label || '';
    }
  }, [dateInfo, todayGanReading]);

  // 공유 핸들러 — 결과 페이지 공유 = OG 바이럴 (앱 홍보용 · 보상 X).
  //   2026-05-28 PM 정책 분리: 결과 페이지 공유는 shareResult (OG 이미지 송출).
  //   공유 리워드 (1운 보상) 는 이벤트/보관함/충전 페이지 surface 만 사용 (inviteFriendsViaToss).
  const handleShare = async () => {
    const { shareResult } = await import('@/utils/share');
    await shareResult({
      type: 'daily',
      name: profile?.name || '나',
      reportId: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    });
  };

  // §07 4영역 카드 클릭 → 관계/일/건강 sub-picker bottom sheet (2026-05-07)
  const [topicPicker, setTopicPicker] = useState<'love' | 'career' | 'health' | null>(null);
  const closePicker = () => setTopicPicker(null);
  const SUB_TOPICS: Record<string, Array<{ id: string; label: string; desc: string }>> = {
    love: [
      { id: 'love', label: '연애운', desc: '지금 만나는 사람·새 인연·짝사랑' },
      { id: 'marriage', label: '결혼운', desc: '결혼 적기·배우자상' },
      { id: 'reunion', label: '재회운', desc: '헤어진 인연 재회 가능성' },
    ],
    career: [
      { id: 'career', label: '직업·진로운', desc: '커리어 방향·이직' },
      { id: 'exam', label: '시험·합격운', desc: '시험·면접·자격증' },
      { id: 'business', label: '사업운', desc: '창업·사업 확장' },
      // 2026-05-28 — 10주제 SSOT 누락 보강: 학업운(study) 추가.
      { id: 'study', label: '학업운', desc: '공부·집중력·지식 흡수' },
    ],
    health: [
      { id: 'health', label: '건강·체질운', desc: '체질·약한 자리·관리' },
      { id: 'move', label: '이사·환경운', desc: '이사·공간 변경' },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* ProfileSelector 제거 (2026-05-06) — DarkHeader 에 이미 "이혜찌 님" 표시,
          result phase 에서 프로필 전환 불필요 (전환은 home 으로 돌아가서). */}

      {/* §07 4영역 sub-picker bottom sheet */}
      <AnimatePresence>
        {topicPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePicker}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
              }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed', left: 0, right: 0, bottom: 0,
                background: '#fff',
                borderRadius: '20px 20px 0 0',
                padding: '20px 20px calc(28px + env(safe-area-inset-bottom))',
                zIndex: 1001,
                maxWidth: 520, margin: '0 auto',
                boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
              }}
            >
              <div style={{
                width: 36, height: 4, borderRadius: 2,
                background: '#E5DFD0', margin: '0 auto 16px',
              }} />
              <h3 style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 17, fontWeight: 700, color: '#1A1A1A',
                marginBottom: 4,
              }}>
                {topicPicker === 'love' ? '관계 — 어떤 부분이 궁금하세요?'
                  : topicPicker === 'career' ? '일 — 어떤 부분이 궁금하세요?'
                  : '건강 — 어떤 부분이 궁금하세요?'}
              </h3>
              <p style={{ fontSize: 12.5, color: '#7A7269', marginBottom: 16 }}>
                선택하신 주제로 1운 깊이 분석을 시작합니다.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUB_TOPICS[topicPicker]?.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { closePicker(); navigate(`/topic/${t.id}`); }}
                    style={{
                      background: '#FAF7EE',
                      border: '1px solid rgba(184,150,90,0.18)',
                      borderRadius: 12, padding: '14px 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', font: 'inherit', textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div>
                      <div style={{
                        fontFamily: "'Noto Serif KR', serif",
                        fontSize: 15, fontWeight: 700, color: '#1A1A1A',
                      }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: '#7A7269', marginTop: 2 }}>{t.desc}</div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#B8965A',
                      background: 'rgba(184,150,90,0.12)',
                      padding: '4px 10px', borderRadius: 100,
                    }}>1운</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={closePicker}
                style={{
                  marginTop: 12, width: '100%',
                  background: 'transparent', border: 'none',
                  fontSize: 13, color: '#7A7269', padding: 12,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* mockup 진본 픽셀-퍼펙트 카피 (DailyMockupView 단일 호출) */}
      <DailyMockupView
        result={result}
        profile={profile}
        dateLabel={dateLabel}
        todayGanzi={dateInfo.ganzi || ''}
        todayGanReading={todayGanReading}
        todayOheng={todayOheng}
        myGan={myGan}
        myGanReading={myGanReading}
        myOheng={myOheng}
        onUpsell={onPremiumUpsell}
        onShare={handleShare}
        onChat={async () => {
          // 2026-05-28 PM — contentContext 영구 저장 (보관함 재진입에도 복원)
          const { createChatRoom } = await import('@/services/storage/chatStore');
          const ctx = {
            type: 'daily' as const,
            label: '오늘의 운세',
            fullResult: result,
          };
          const room = createChatRoom(profile?.name || '나', 'free', ctx);
          navigate(`/chat/${room.id}`, {
            state: {
              profile,
              contentContext: ctx,
            },
          });
        }}
        onTopicClick={(topicId) => {
          // 4영역 클릭 → sub-picker (관계/일/건강) 또는 직접 (재물)
          // wealth: 직접 / love(관계): 연애·결혼·재회·궁합 / career(일): 직업·시험·사업 / health(건강): 체질·이사
          if (topicId === 'wealth') {
            navigate('/topic/wealth');
            return;
          }
          setTopicPicker(topicId);
        }}
      />
      {/* 2026-05-28 — 무료 콘텐츠 결과 페이지 하단 광고 (앱인토스 빌드 + tier='free' 자동 게이트) */}
      <div style={{ padding: '0 16px 24px' }}>
        <AdSlot />
      </div>
    </motion.div>
  );
}


function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function buildTodayGanzi(d: Date): DateInfo {
  const date = formatDate(d);
  const weekday = WEEKDAY_KR[d.getDay()] ?? '';
  let ganzi = '';
  try {
    const solar = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const ec = solar.getLunar().getEightChar();
    ganzi = `${ec.getDayGan()}${ec.getDayZhi()}`;
  } catch {
    ganzi = '';
  }
  const label = `${d.getMonth() + 1}월 ${d.getDate()}일 ${weekday}요일`;
  return { date, weekday, ganzi, label };
}

/** STEP 2A — 내일 일진 (mockup §07 tomorrow 카드용) */
function buildTomorrowGanzi(today: Date): { date: string; ganzi: string } {
  const tmr = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const date = formatDate(tmr);
  let ganzi = '';
  try {
    const solar = Solar.fromYmd(tmr.getFullYear(), tmr.getMonth() + 1, tmr.getDate());
    const ec = solar.getLunar().getEightChar();
    ganzi = `${ec.getDayGan()}${ec.getDayZhi()}`;
  } catch {
    ganzi = '';
  }
  return { date, ganzi };
}

function getDayOheng(ganzi: string): OhengType {
  const stem = ganzi?.[0] ?? '';
  return STEM_TO_OHENG[stem] ?? '토';
}

function buildPillars(
  profile: SajuProfile,
  pillarMessages?: Record<string, string | null>,
): PillarData[] {
  const raw = profile.sajuData?.pillars ?? [];
  const labels: Array<'년' | '월' | '일' | '시'> = ['년', '월', '일', '시'];
  const messageKeys = ['year', 'month', 'day', 'hour'];
  const ordered: PillarData[] = raw.map((p: any, i: number) => ({
    label: labels[i] ?? '년',
    gan: String(p?.천간 ?? ''),
    ji: String(p?.지지 ?? ''),
    ohengGan: (p?.천간오행 ?? '토') as OhengType,
    ohengJi: (p?.지지오행 ?? '토') as OhengType,
    ganRead: p?.천간읽기 ? String(p.천간읽기) : undefined,
    jiRead: p?.지지읽기 ? String(p.지지읽기) : undefined,
    shipsin: p?.십성 ?? undefined,
    connection: pillarMessages?.[messageKeys[i]]
      ? stripMd(String(pillarMessages[messageKeys[i]]))
      : undefined,
    unavailable: p?.available === false,
  }));
  return [...ordered].reverse();
}
