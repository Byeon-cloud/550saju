import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Solar } from 'lunar-javascript';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { LockedCard } from '@/components/common/LockedCard';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import { ErrorState } from '@/components/common/ErrorState';
import { ProfileSelector } from '@/components/common/ProfileSelector';
import { TimeSlotCarousel, type TimeSlot as TSSlot } from '@/components/common/TimeSlotCarousel';
import { CompassDrag } from '@/components/common/CompassDrag';
import { Flippable } from '@/components/common/Flippable';
import { TopicCTAGrid, type TopicItem } from '@/components/common/TopicCTAGrid';
import { SajuMiniCard, type PillarData } from '@/components/saju/SajuMiniCard';
import { OhengCompareBar } from '@/components/saju/OhengCompareBar';
import { Pictogram, type TopicKey } from '@/components/brand/PictogramRegistry';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/common/Toast';
import {
  getProfiles,
  spendBalance,
  saveReport,
  generateId,
  type SajuProfile,
} from '@/services/storage/localStore';
import {
  generateDailyFortune,
  generateWeeklyFortune,
} from '@/services/ai/reportGenerator';
import { stripMd } from '@/utils/format';
import type { OhengType } from '@/types/saju';

/**
 * 오늘의 운세 v4.1 (2026-04-19)
 *   PRD: docs/prd/오늘의운세_v4_CTA확장.md (v4.1 업데이트)
 *   - 무료 티어 증강 (신규 섹션 5종, 총 2800자+)
 *   - 결제 CTA 4 → 2 축소 (행운 프로필 전부 무료로 이동)
 *   - ProfileSelector 통합 (본인/가족 프로필 전환)
 *   - ErrorState 공용 컴포넌트 (card-navy-v4 금지)
 *   - 0점/B등급 fallback 렌더 제거 (PRD §11.1 요건)
 */

/** v4 등급 팔레트 */
const GRADE_V4: Record<string, string> = {
  S: '#C9A96E',
  A: '#A08B6A',
  B: '#2D4470',
  C: '#8F6B4E',
  D: '#8F1F1C',
};

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

type Phase = 'select' | 'loading' | 'result' | 'error';

export function DailyFortunePage() {
  usePageTitle('오늘의 운세');
  const navigate = useNavigate();
  const toast = useToast();
  const { mark } = useAttendanceOnResult();

  const profiles: SajuProfile[] = useMemo(() => getProfiles(), []);
  const hasAnyProfile = profiles.length > 0;

  // 기본 선택: relation '본인' 또는 undefined 인 프로필. 없으면 첫 번째.
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => {
    const self = profiles.find((p) => !p.relation || p.relation === '본인');
    return (self ?? profiles[0])?.id ?? null;
  });
  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  const [phase, setPhase] = useState<Phase>('select');
  const [result, setResult] = useState<any>(null);
  const [apiError, setApiError] = useState('');
  const isAnalyzingRef = useRef(false);

  // 프로필 전환 시 결과 초기화
  useEffect(() => {
    setResult(null);
    setPhase('select');
    setApiError('');
  }, [selectedProfileId]);

  const today = useMemo(() => new Date(), []);
  const dateInfo = useMemo(() => buildTodayGanzi(today), [today]);

  /* ─── 오늘의 운세 호출 ─── */
  async function analyze() {
    if (!selectedProfile?.sajuData) return;
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setPhase('loading');
    setApiError('');

    try {
      const res = await generateDailyFortune({
        name: selectedProfile.name || '당신',
        sajuData: selectedProfile.sajuData,
        date: dateInfo.date,
        weekday: dateInfo.weekday,
        todayGanzi: dateInfo.ganzi,
      });

      // 필수 필드 누락 시 에러 처리 (0점/B등급 fallback 금지 · PRD §11.1)
      if (!res || typeof res !== 'object' || !('overallScore' in res) && !('score' in res)) {
        throw new Error('응답 데이터 형식이 올바르지 않아요');
      }

      setResult(res);
      setPhase('result');

      // 이벤트 v4 · 출석 마커 (KST 당일 1회)
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
      setApiError(e?.message || 'AI 서버 연결에 실패했어요');
      setPhase('error');
    } finally {
      isAnalyzingRef.current = false;
    }
  }

  /* ─── 이번 주 흐름 (유료 1운 · 2차 리뷰) ─── */
  async function startWeeklyAnalysis() {
    if (!selectedProfile?.sajuData) return;
    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '이번 주 흐름에 1운이 필요해요' } });
      return;
    }
    toast.show('1운이 차감됐어요', 'info');
    setPhase('loading');

    try {
      const monday = mondayOf(today);
      const weekdays = buildWeekGanzi(monday);
      const res = await generateWeeklyFortune({
        name: selectedProfile.name || '당신',
        sajuData: selectedProfile.sajuData,
        monday: formatDate(monday),
        weekdays,
      });
      try {
        saveReport({
          id: res?.reportId ?? generateId(),
          name: selectedProfile.name,
          input: selectedProfile.input,
          sajuData: selectedProfile.sajuData,
          type: 'paid',
          contentType: 'daily',
          aiResult: res?.content ?? res,
          createdAt: new Date().toISOString(),
        });
      } catch {
        /* 무시 */
      }
      toast.show('이번 주 흐름이 보관함에 저장됐어요', 'info');
      setPhase('result');
    } catch (e: any) {
      console.error('[WeeklyFortune] 실패:', e);
      toast.show('분석에 실패했어요. 잔액은 자동으로 복구돼요.', 'warning');
      setPhase('result');
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <Header title="오늘의 운세" />
      <div className="px-5 pt-4 pb-[120px] mx-auto" style={{ maxWidth: 520 }}>
        <AnimatePresence mode="wait">
          {/* 프로필 없음 → 입력 CTA */}
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
              <p className="text-body-sm" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
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
              dateLabel={dateInfo.label}
              onAnalyze={analyze}
            />
          )}

          {hasAnyProfile && phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AILoading
                name={selectedProfile?.name ?? '당신'}
                type="오늘의 운세"
                steps={[
                  '오늘 간지와 사주를 교차하고 있어요',
                  '4영역 점수를 계산하고 있어요',
                  '시간대별 흐름을 정리하고 있어요',
                ]}
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
              onWeekly={startWeeklyAnalysis}
              onTopicTap={(tid) => navigate(`/topic/${tid}`)}
              onFullReport={() => navigate('/storage')}
              onRetry={analyze}
            />
          )}
        </AnimatePresence>

        {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) */}
        <div className="mt-10 text-center space-y-1">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            『적천수』·한국 명리학 문헌 기반
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
 * 진입 화면 (select) — 프로필 선택 + 날짜 프리뷰 + 분석 시작
 * ═════════════════════════════════════════════════════════════════ */
function SelectView({
  profiles,
  selectedProfileId,
  onProfileChange,
  onCreateNew,
  profile,
  dateLabel,
  onAnalyze,
}: {
  profiles: SajuProfile[];
  selectedProfileId: string | null;
  onProfileChange: (id: string) => void;
  onCreateNew: () => void;
  profile: SajuProfile | null;
  dateLabel: string;
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

      <FadeIn delay={0.05}>
        <section className="card-primary" style={{ padding: 24 }}>
          <p className="sec-meta">{dateLabel}</p>
          <h2 className="sec-title-lg" style={{ marginTop: 8 }}>
            {profile?.name ?? '당신'}님의<br />오늘 운세를 풀어드릴게요
          </h2>
          <p className="text-body-md" style={{ color: 'var(--text-muted)', marginTop: 10 }}>
            일주와 오늘 간지의 작용, 용신·대운 흐름까지 함께 살펴볼게요.
          </p>
        </section>
      </FadeIn>

      {hasSajuData && (
        <FadeIn delay={0.1}>
          <section className="card-secondary">
            <p className="sec-title" style={{ marginBottom: 12 }}>내 사주 원국</p>
            <SajuMiniCard pillars={pillars} />
          </section>
        </FadeIn>
      )}

      <div className="sticky-cta-bottom">
        <button
          className="cta-gold"
          onClick={onAnalyze}
          disabled={!hasSajuData}
        >
          오늘의 운세 보기 (무료)
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 결과 화면 — v4.1 신규 섹션 + 2 결제 CTA + 하단 풀리포트
 * ═════════════════════════════════════════════════════════════════ */
function ResultView({
  result,
  profile,
  profiles,
  selectedProfileId,
  onProfileChange,
  onCreateNew,
  dateInfo,
  onWeekly,
  onTopicTap,
  onFullReport,
  onRetry,
}: {
  result: any;
  profile: SajuProfile;
  profiles: SajuProfile[];
  selectedProfileId: string | null;
  onProfileChange: (id: string) => void;
  onCreateNew: () => void;
  dateInfo: { date: string; weekday: string; ganzi: string; label: string };
  onWeekly: () => void;
  onTopicTap: (topicId: TopicKey) => void;
  onFullReport: () => void;
  onRetry: () => void;
}) {
  // v4.1 스키마 파싱 — 레거시 호환도 겸함
  const score = clampScore(result?.overallScore ?? result?.score);
  const grade = String(result?.grade ?? 'B').toUpperCase();
  const gradeColor = GRADE_V4[grade] ?? '#A08B6A';
  const title = stripMd(String(result?.title ?? result?.headline ?? '오늘의 운세'));
  const todayNarrative = stripMd(String(result?.todayNarrative ?? result?.summary ?? ''));
  const keywords: string[] = Array.isArray(result?.keywords) ? result.keywords.slice(0, 5) : [];
  const sajuTone = stripMd(String(result?.sajuTone ?? ''));
  const pillarMessages = result?.pillarMessages;
  const ohengDistribution = result?.ohengDistribution ?? result?.ohengFlow?.sajuDistribution;
  const todayOhengEmphasis = result?.todayOhengEmphasis ?? result?.ohengFlow?.todayEmphasis;
  const subScores = result?.subScores ?? result?.scores;
  const subScoreReasons = result?.subScoreReasons;
  const timeSlots = Array.isArray(result?.timeSlots) ? result.timeSlots : [];
  const warnings = Array.isArray(result?.warnings) ? result.warnings.slice(0, 3) : [];
  const opportunities = Array.isArray(result?.opportunities) ? result.opportunities.slice(0, 3) : [];
  const luckyProfile = result?.luckyProfile;
  const doList: string[] = Array.isArray(result?.doList) ? result.doList.slice(0, 3) : [];
  const dontList: string[] = Array.isArray(result?.dontList) ? result.dontList.slice(0, 3) : [];
  const oneLiner = stripMd(String(result?.oneLiner ?? result?.dailyMessage ?? ''));

  const pillars = useMemo(() => buildPillars(profile, pillarMessages), [profile, pillarMessages]);

  const tsSlots: TSSlot[] = useMemo(
    () =>
      (timeSlots as any[]).slice(0, 4).map((s) => ({
        slot: (String(s?.slot ?? '오전') as TSSlot['slot']),
        range: String(s?.range ?? ''),
        score: clampScore(s?.score),
        tip: stripMd(String(s?.message ?? s?.tip ?? '')),
      })),
    [timeSlots],
  );

  const currentHour = useMemo(() => new Date().getHours(), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* S0 프로필 + 날짜 */}
      <FadeIn>
        <ProfileSelector
          profiles={profiles}
          selectedId={selectedProfileId}
          onChange={onProfileChange}
          onCreateNew={onCreateNew}
        />
      </FadeIn>
      <p className="sec-meta" style={{ marginBottom: -4 }}>{dateInfo.label}</p>

      {/* S1 판정 카드 */}
      <FadeIn delay={0.04}>
        <section className="card-primary" style={{ padding: 24 }}>
          <div className="flex items-center gap-4">
            <ScoreDonut score={score} color={gradeColor} />
            <div className="flex-1 min-w-0">
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: `${gradeColor}18`,
                  color: gradeColor,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                오늘 · {grade}등급
              </div>
              <p className="sec-title-lg" style={{ marginTop: 6 }}>{title}</p>
            </div>
          </div>
          {keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {keywords.map((kw, i) => (
                <span key={i} className="chip-v4">{kw}</span>
              ))}
            </div>
          )}
        </section>
      </FadeIn>

      {/* S-narrative (1000자+) */}
      {todayNarrative && (
        <FadeIn delay={0.08}>
          <section className="card-primary">
            <p className="sec-meta" style={{ marginBottom: 8 }}>오늘의 서사</p>
            <p
              className="text-body-lg"
              style={{
                color: 'var(--text-primary)',
                whiteSpace: 'pre-line',
                lineHeight: 1.75,
              }}
            >
              {todayNarrative}
            </p>
          </section>
        </FadeIn>
      )}

      {/* S2 SajuMiniCard — pillarMessages 플립 */}
      {pillars.length === 4 && (
        <FadeIn delay={0.12}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 4 }}>
              {profile.name}님의 사주 × 오늘
            </p>
            <p className="sec-caption" style={{ marginBottom: 14 }}>
              각 기둥을 탭하면 오늘 하루에 어떻게 작용하는지 보여요
            </p>
            <SajuMiniCard pillars={pillars} />
          </section>
        </FadeIn>
      )}

      {/* S3 sajuTone pull quote */}
      {sajuTone && (
        <FadeIn delay={0.16}>
          <section className="card-accent">
            <p className="sec-meta" style={{ marginBottom: 6 }}>오늘의 톤</p>
            <p
              className="text-body-lg"
              style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}
            >
              {sajuTone}
            </p>
          </section>
        </FadeIn>
      )}

      {/* S4 오행 분포 + 오늘 강세 */}
      {ohengDistribution && (
        <FadeIn delay={0.2}>
          <section className="card-secondary">
            <p className="sec-title" style={{ marginBottom: 14 }}>오늘의 오행 흐름</p>
            <OhengCompareBar
              primary={toOhengDist(ohengDistribution)}
              primaryLabel="내 사주"
              todayEmphasis={normalizeOheng(todayOhengEmphasis)}
            />
          </section>
        </FadeIn>
      )}

      {/* S5 4영역 점수 + reason 아코디언 */}
      {subScores && (
        <FadeIn delay={0.24}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>오늘의 점수</p>
            <ScoreGrid scores={subScores} reasons={subScoreReasons} />
          </section>
        </FadeIn>
      )}

      {/* S6 TimeSlotCarousel */}
      {tsSlots.length === 4 && (
        <FadeIn delay={0.28}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>시간대별 흐름</p>
            <TimeSlotCarousel slots={tsSlots} currentHour={currentHour} />
          </section>
        </FadeIn>
      )}

      {/* S-warn 오늘 주의 3가지 */}
      {warnings.length > 0 && (
        <FadeIn delay={0.32}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>오늘 주의할 것 3가지</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {warnings.map((w: any, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: 'rgba(143,31,28,0.05)',
                    borderLeft: '3px solid #8F1F1C',
                  }}
                >
                  <p
                    className="sec-meta"
                    style={{ color: '#8F1F1C', marginBottom: 4 }}
                  >
                    {stripMd(String(w?.title ?? `주의 ${i + 1}`))}
                  </p>
                  <p className="text-body-md" style={{ color: 'var(--text-primary)' }}>
                    {stripMd(String(w?.detail ?? ''))}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </FadeIn>
      )}

      {/* S-op 오늘 기회 3가지 */}
      {opportunities.length > 0 && (
        <FadeIn delay={0.36}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>오늘 놓치면 아쉬운 것 3가지</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {opportunities.map((o: any, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: 'rgba(201,169,110,0.08)',
                    borderLeft: '3px solid var(--brand-gold)',
                  }}
                >
                  <p
                    className="sec-meta"
                    style={{ color: 'var(--brand-gold)', marginBottom: 4 }}
                  >
                    {stripMd(String(o?.title ?? `기회 ${i + 1}`))}
                  </p>
                  <p className="text-body-md" style={{ color: 'var(--text-primary)' }}>
                    {stripMd(String(o?.detail ?? ''))}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </FadeIn>
      )}

      {/* S-lucky 행운 프로필 4카드 전부 무료 + 나침반 */}
      {luckyProfile && (
        <FadeIn delay={0.4}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>오늘의 행운 프로필</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <LuckyColorCard color={luckyProfile?.color} />
              <LuckyStatCard
                title="행운의 숫자"
                value={String(luckyProfile?.number ?? '-')}
                reason={stripMd(String(luckyProfile?.numberReason ?? ''))}
              />
              <LuckyStatCard
                title="행운의 방위"
                value={String(luckyProfile?.direction ?? '-')}
                reason={stripMd(String(luckyProfile?.directionReason ?? ''))}
              />
              <LuckyStatCard
                title="보충 오행"
                value={String(luckyProfile?.element ?? '-')}
                reason={stripMd(String(luckyProfile?.elementReason ?? ''))}
              />
            </div>

            {/* 나침반 (IX-9) — S-lucky 내부 */}
            {luckyProfile?.direction && (
              <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border-light)' }}>
                <CompassDrag
                  direction={normalizeDirection(luckyProfile.direction)}
                  desc={stripMd(String(luckyProfile?.directionReason ?? ''))}
                />
              </div>
            )}
          </section>
        </FadeIn>
      )}

      {/* S-donts Do/Dont 리스트 */}
      {(doList.length > 0 || dontList.length > 0) && (
        <FadeIn delay={0.44}>
          <section className="card-primary">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <p className="sec-meta" style={{ color: 'var(--brand-gold)', marginBottom: 8 }}>
                  해야 할 것
                </p>
                <ul
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                  }}
                >
                  {doList.map((d, i) => (
                    <li key={i} className="text-body-sm flex items-start gap-2">
                      <span style={{ color: 'var(--brand-gold)', fontWeight: 900, flexShrink: 0 }}>✓</span>
                      <span style={{ color: 'var(--text-primary)' }}>{stripMd(d)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="sec-meta" style={{ color: 'var(--brand-navy)', marginBottom: 8 }}>
                  피해야 할 것
                </p>
                <ul
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                  }}
                >
                  {dontList.map((d, i) => (
                    <li key={i} className="text-body-sm flex items-start gap-2">
                      <span style={{ color: 'var(--brand-navy)', fontWeight: 900, flexShrink: 0 }}>×</span>
                      <span style={{ color: 'var(--text-primary)' }}>{stripMd(d)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      {/* S-oneliner 한 줄 */}
      {oneLiner && (
        <FadeIn delay={0.48}>
          <section className="card-accent">
            <p className="sec-meta" style={{ marginBottom: 6 }}>오늘 한 줄</p>
            <p className="text-body-lg" style={{ color: 'var(--text-primary)' }}>{oneLiner}</p>
          </section>
        </FadeIn>
      )}

      {/* ═════════ 결제 유도 2구간 (v4.1) ═════════ */}

      {/* S10.1 TopicCTAGrid */}
      <FadeIn delay={0.52}>
        <TopicCTAGrid
          meta="더 깊이 알고 싶다면"
          title="주제별 심층 분석"
          topics={DAILY_TOPIC_ITEMS}
          onTopicTap={onTopicTap}
        />
      </FadeIn>

      {/* S10.2 이번 주 흐름 잠금 */}
      <FadeIn delay={0.56}>
        <LockedCard
          title="이번 주 7일 가이드"
          subtitle="매일 달라지는 컨디션·기회·주의"
          ctaText="이번 주 흐름 열기 (1운)"
          onUnlock={onWeekly}
        />
      </FadeIn>

      {/* S10.end 풀 리포트 CTA (맨 하단 1회) */}
      <FadeIn delay={0.6}>
        <section
          className="card-navy-v4"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(201,169,110,0.2)' }}
            >
              <Pictogram k="ui:saju" size={22} color="#E8D5A8" />
            </div>
            <div>
              <p className="sec-title" style={{ color: '#F5EFE0' }}>
                사주 리포트 10섹션 종합
              </p>
              <p
                className="text-body-sm"
                style={{ color: 'rgba(245,239,224,0.7)', marginTop: 4 }}
              >
                오늘 운세보다 깊은 분석. 성격·대인·직업·재물·애정·건강까지.
              </p>
            </div>
          </div>
          <button className="cta-gold" onClick={onFullReport}>
            사주 리포트 받기 (500원)
          </button>
        </section>
      </FadeIn>

      <button className="cta-ghost" onClick={onRetry} style={{ marginTop: 6 }}>
        다시 분석하기
      </button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * UI 파츠
 * ═════════════════════════════════════════════════════════════════ */

function ScoreDonut({ score, color }: { score: number; color: string }) {
  const size = 88;
  const strokeWidth = 8;
  const r = size / 2 - strokeWidth;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(27,42,74,0.06)" strokeWidth={strokeWidth} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: '-0.03em' }}>
          {score}
        </span>
        <span className="sec-caption" style={{ fontSize: 10 }}>점</span>
      </div>
    </div>
  );
}

function ScoreGrid({
  scores,
  reasons,
}: {
  scores: any;
  reasons?: Record<string, string>;
}) {
  const keys: Array<{ k: string; label: string }> = [
    { k: '재물운', label: '재물운' },
    { k: '애정운', label: '애정운' },
    { k: '건강운', label: '건강운' },
    { k: '성장운', label: '성장운' },
  ];
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {keys.map(({ k, label }) => {
        const v = scores?.[k] ?? {};
        // 신규 스키마 subScores 는 { 재물운: 0-100 } 직접, 레거시는 { 재물운: { score, desc } }
        const sc = typeof v === 'number' ? clampScore(v) : clampScore(v?.score);
        const reason = reasons?.[k] ?? (typeof v === 'object' ? stripMd(String(v?.desc ?? '')) : '');
        const open = openKey === k;
        return (
          <motion.button
            key={k}
            whileTap={{ scale: 0.98 }}
            onClick={() => setOpenKey(open ? null : k)}
            className="card-primary"
            style={{
              padding: 14,
              border: open ? '2px solid var(--brand-gold)' : '0.5px solid var(--border-default)',
              textAlign: 'left',
              cursor: 'pointer',
              minHeight: 104,
            }}
            aria-expanded={open}
            aria-label={`${label} 점수 ${sc} — 탭하여 설명`}
          >
            <div className="flex items-baseline justify-between">
              <p className="sec-meta" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'var(--brand-gold)',
                  letterSpacing: '-0.02em',
                }}
              >
                {sc}
              </p>
            </div>
            <AnimatePresence initial={false}>
              {open && reason && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-body-sm"
                  style={{ color: 'var(--text-secondary)', marginTop: 8, whiteSpace: 'pre-line' }}
                >
                  {reason}
                </motion.p>
              )}
            </AnimatePresence>
            {!open && reason && (
              <p className="sec-caption" style={{ marginTop: 6, fontSize: 10 }}>
                탭하여 자세히
              </p>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function LuckyColorCard({ color, height }: { color: any; height?: number }) {
  const hex = typeof color?.hex === 'string' ? color.hex : '#C9A96E';
  const name = typeof color?.name === 'string' ? color.name : '골드';
  const reason = typeof color?.reason === 'string' ? stripMd(color.reason) : '';
  return (
    <Flippable
      height={height ?? 160}
      ariaLabel={`행운의 색 — ${name}`}
      front={
        <div
          style={{
            height: '100%',
            padding: 14,
            borderRadius: 14,
            background: '#FFFFFF',
            border: '0.5px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <p className="sec-meta" style={{ color: 'var(--brand-gold)' }}>행운의 색</p>
          <div
            style={{
              width: '100%',
              height: 44,
              borderRadius: 8,
              background: hex,
              border: '0.5px solid rgba(27,42,74,0.1)',
            }}
          />
          <p className="sec-title" style={{ fontSize: 15 }}>{name}</p>
          <p className="sec-caption" style={{ fontSize: 10 }}>탭해서 이유 보기</p>
        </div>
      }
      back={
        <div
          style={{
            height: '100%',
            padding: 14,
            borderRadius: 14,
            background: 'var(--bg-cream)',
            border: '0.5px solid rgba(201,169,110,0.25)',
            overflowY: 'auto',
          }}
        >
          <p className="sec-meta" style={{ color: 'var(--brand-gold)', marginBottom: 6 }}>
            왜 이 색인가
          </p>
          <p className="text-body-sm" style={{ color: 'var(--text-primary)' }}>
            {reason || '오늘 당신의 흐름과 가장 공명하는 색입니다.'}
          </p>
        </div>
      }
    />
  );
}

function LuckyStatCard({
  title,
  value,
  reason,
}: {
  title: string;
  value: string;
  reason: string;
}) {
  return (
    <Flippable
      height={160}
      ariaLabel={`${title} — ${value}`}
      front={
        <div
          style={{
            height: '100%',
            padding: 14,
            borderRadius: 14,
            background: '#FFFFFF',
            border: '0.5px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <p className="sec-meta" style={{ color: 'var(--brand-gold)' }}>{title}</p>
          <p
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: 'var(--text-primary)',
              marginTop: 4,
            }}
          >
            {value}
          </p>
          <p className="sec-caption" style={{ fontSize: 10, marginTop: 'auto' }}>
            탭해서 이유 보기
          </p>
        </div>
      }
      back={
        <div
          style={{
            height: '100%',
            padding: 14,
            borderRadius: 14,
            background: 'var(--bg-cream)',
            border: '0.5px solid rgba(201,169,110,0.25)',
            overflowY: 'auto',
          }}
        >
          <p className="sec-meta" style={{ color: 'var(--brand-gold)', marginBottom: 6 }}>
            {title}의 이유
          </p>
          <p className="text-body-sm" style={{ color: 'var(--text-primary)' }}>
            {reason || '사주와 오늘 흐름이 공명하는 지점입니다.'}
          </p>
        </div>
      }
    />
  );
}

/* ══════════════════════════════════════════════════════════════════
 * TopicCTAGrid 아이템 (무변경)
 * ═════════════════════════════════════════════════════════════════ */
const DAILY_TOPIC_ITEMS: TopicItem[] = [
  { id: 'love', title: '연애·결혼', desc: '만남·고백 타이밍', price: '1운 (500원)', color: '#E91E63' },
  { id: 'wealth', title: '재물·투자', desc: '돈 움직이는 날', price: '1운 (500원)', color: '#C9A96E' },
  { id: 'career', title: '취업·커리어', desc: '승진·이직 흐름', price: '1운 (500원)', color: '#1565C0' },
  { id: 'health', title: '건강·활력', desc: '컨디션 포인트', price: '1운 (500원)', color: '#2D8A4E' },
];

/* ══════════════════════════════════════════════════════════════════
 * 헬퍼
 * ═════════════════════════════════════════════════════════════════ */

function clampScore(v: any): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function buildTodayGanzi(d: Date): {
  date: string;
  weekday: string;
  ganzi: string;
  label: string;
} {
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

function mondayOf(d: Date): Date {
  const dow = d.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  const m = new Date(d);
  m.setDate(d.getDate() + delta);
  m.setHours(0, 0, 0, 0);
  return m;
}

function buildWeekGanzi(monday: Date): Array<{ date: string; weekday: string; ganzi: string }> {
  const out: Array<{ date: string; weekday: string; ganzi: string }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = formatDate(d);
    const weekday = WEEKDAY_KR[d.getDay()] ?? '';
    let ganzi = '';
    try {
      const solar = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const ec2 = solar.getLunar().getEightChar();
      ganzi = `${ec2.getDayGan()}${ec2.getDayZhi()}`;
    } catch {
      ganzi = '';
    }
    out.push({ date, weekday, ganzi });
  }
  return out;
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
    shipsin: p?.십성 ?? undefined,
    connection: pillarMessages?.[messageKeys[i]]
      ? stripMd(String(pillarMessages[messageKeys[i]]))
      : undefined,
    unavailable: p?.available === false,
  }));
  return [...ordered].reverse();
}

function toOhengDist(d: any): Record<OhengType, number> {
  const safe = (v: any) => Math.max(0, Number(v ?? 0));
  return {
    목: safe(d?.목),
    화: safe(d?.화),
    토: safe(d?.토),
    금: safe(d?.금),
    수: safe(d?.수),
  };
}

function normalizeOheng(v: any): OhengType | undefined {
  const s = String(v ?? '').trim();
  if (s === '목' || s === '화' || s === '토' || s === '금' || s === '수') return s;
  return undefined;
}

type Direction = '동' | '서' | '남' | '북' | '동남' | '동북' | '서남' | '서북';
function normalizeDirection(v: any): Direction {
  const s = String(v ?? '').trim();
  const valid: Direction[] = ['동', '서', '남', '북', '동남', '동북', '서남', '서북'];
  if (valid.includes(s as Direction)) return s as Direction;
  return '동';
}
