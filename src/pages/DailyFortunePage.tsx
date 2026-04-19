import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Solar } from 'lunar-javascript';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { LockedCard } from '@/components/common/LockedCard';
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
 * 오늘의 운세 v4 (2026-04-19)
 *   PRD: docs/prd/오늘의운세_v4_CTA확장.md + 디자인시스템_v4.md
 *   10섹션 + 결제 유도 4구간 (TopicCTAGrid / Weekly LockedCard / Lucky 3잠금 /
 *   풀 리포트 navy CTA).
 *   P0 인터랙션: IX-1(SajuMiniCard 플립) · IX-5(TopicCTAGrid)
 *   P1 인터랙션: IX-8(TimeSlotCarousel) · IX-9(CompassDrag) · IX-4(Flippable Lucky)
 *   Sonnet 4.6 v3: generateDailyFortune · generateWeeklyFortune
 *
 * 사주 없으면 /input 리디렉트 (PRD §5 원칙 — 일간·오행 없으면 분석 불가).
 */

/** v4 등급 팔레트 (§3.3) */
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

  const profile: SajuProfile | null = useMemo(
    () => getProfiles().find((p) => !p.relation || p.relation === '본인') || null,
    [],
  );
  const hasSaju = !!profile?.sajuData?.pillars?.length;

  const [phase, setPhase] = useState<Phase>(hasSaju ? 'select' : 'select');
  const [result, setResult] = useState<any>(null);
  const [apiError, setApiError] = useState('');
  const isAnalyzingRef = useRef(false);

  const today = useMemo(() => new Date(), []);
  const dateInfo = useMemo(() => buildTodayGanzi(today), [today]);

  /* ─── 오늘의 운세 호출 ─── */
  async function analyze() {
    if (!profile?.sajuData) return;
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setPhase('loading');
    setApiError('');

    try {
      const res = await generateDailyFortune({
        name: profile.name || '당신',
        sajuData: profile.sajuData,
        date: dateInfo.date,
        weekday: dateInfo.weekday,
        todayGanzi: dateInfo.ganzi,
      });
      setResult(res);
      setPhase('result');

      // 보관함 저장 — 일일 에페메럴 30일 롤링 (자동 GC 별도)
      try {
        saveReport({
          id: generateId(),
          name: profile.name,
          input: profile.input,
          sajuData: profile.sajuData,
          type: 'free',
          contentType: 'daily',
          aiResult: res,
          createdAt: new Date().toISOString(),
        });
      } catch {
        /* 실패 무시 */
      }
    } catch (e: any) {
      console.error('[DailyFortune] 실패:', e);
      setApiError(e?.message || 'AI 서버 연결에 실패했어요');
      setPhase('error');
    } finally {
      isAnalyzingRef.current = false;
    }
  }

  /* ─── 이번 주 흐름 (유료 1운, 2차 리뷰) ─── */
  async function startWeeklyAnalysis() {
    if (!profile?.sajuData) return;
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
        name: profile.name || '당신',
        sajuData: profile.sajuData,
        monday: formatDate(monday),
        weekdays,
      });
      // 보관함 저장 + 라우팅 없이 result 상태 유지 (PRD는 별도 Weekly 페이지 없음)
      try {
        saveReport({
          id: res?.reportId ?? generateId(),
          name: profile.name,
          input: profile.input,
          sajuData: profile.sajuData,
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
      // 환불은 서버 위임
      toast.show('분석에 실패했어요. 잔액은 자동으로 복구돼요.', 'warning');
      setPhase('result');
    }
  }

  /* ─── 무사주 리디렉트 ─── */
  if (!hasSaju) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
        <Header title="오늘의 운세" />
        <div className="px-5 pt-6 pb-[120px] mx-auto" style={{ maxWidth: 520 }}>
          <NoSajuView onInput={() => navigate('/input')} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <Header title="오늘의 운세" />
      <div className="px-5 pt-4 pb-[120px] mx-auto" style={{ maxWidth: 520 }}>
        <AnimatePresence mode="wait">
          {phase === 'select' && (
            <SelectView
              key="select"
              profile={profile!}
              dateLabel={dateInfo.label}
              onAnalyze={analyze}
            />
          )}

          {phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AILoading
                name={profile!.name}
                type="오늘의 운세"
                steps={[
                  '오늘 간지와 사주를 교차하고 있어요',
                  '4영역 점수를 계산하고 있어요',
                  '시간대별 흐름을 정리하고 있어요',
                ]}
              />
            </motion.div>
          )}

          {phase === 'error' && (
            <ErrorView key="error" apiError={apiError} onRetry={analyze} />
          )}

          {phase === 'result' && result && (
            <ResultView
              key="result"
              result={result}
              profile={profile!}
              dateInfo={dateInfo}
              onWeekly={startWeeklyAnalysis}
              onTopicTap={(tid) => navigate(`/topic/${tid}`)}
              onFullReport={() => navigate('/storage')}
              onRetry={analyze}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 무사주 진입 화면 — PRD §5
 * ═════════════════════════════════════════════════════════════════ */
function NoSajuView({ onInput }: { onInput: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <section className="card-navy-v4" style={{ padding: 28 }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(201,169,110,0.2)' }}
        >
          <Pictogram k="ui:lucky" size={28} color="#E8D5A8" />
        </div>
        <p className="sec-title-lg" style={{ color: '#F5EFE0', marginTop: 14 }}>
          오늘의 운세는 사주 기반이에요
        </p>
        <p className="text-body-md" style={{ color: 'rgba(245,239,224,0.7)', marginTop: 10 }}>
          생년월일만 있으면 1분. 일간(日干)과 오늘 간지의 작용을 분석해드려요. 무료입니다.
        </p>
      </section>
      <button className="cta-gold" onClick={onInput}>사주 무료 입력 →</button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 진입(select) — 날짜 프리뷰 + 분석 시작
 * ═════════════════════════════════════════════════════════════════ */
function SelectView({
  profile,
  dateLabel,
  onAnalyze,
}: {
  profile: SajuProfile;
  dateLabel: string;
  onAnalyze: () => void;
}) {
  const pillars = useMemo(() => buildPillars(profile), [profile]);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      <FadeIn>
        <section className="card-primary" style={{ padding: 24 }}>
          <p className="sec-meta">{dateLabel}</p>
          <h2 className="sec-title-lg" style={{ marginTop: 8 }}>
            {profile.name}님의<br />오늘 운세를 풀어드릴게요
          </h2>
          <p className="text-body-md" style={{ color: 'var(--text-muted)', marginTop: 10 }}>
            일간(日干)과 오늘의 간지가 어떻게 공명하는지 함께 살펴볼게요.
          </p>
        </section>
      </FadeIn>

      {pillars.length === 4 && (
        <FadeIn delay={0.04}>
          <section className="card-secondary">
            <p className="sec-title" style={{ marginBottom: 12 }}>내 사주 원국</p>
            <SajuMiniCard pillars={pillars} />
          </section>
        </FadeIn>
      )}

      <div className="sticky-cta-bottom">
        <button className="cta-gold" onClick={onAnalyze}>
          오늘의 운세 보기 (무료)
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 오류 화면
 * ═════════════════════════════════════════════════════════════════ */
function ErrorView({ apiError, onRetry }: { apiError: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <section className="card-navy-v4" style={{ padding: 28, textAlign: 'center' }}>
        <div
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: 'rgba(227,140,100,0.2)' }}
        >
          <Pictogram k="ui:lucky" size={28} color="#E8D5A8" />
        </div>
        <p className="sec-title-lg" style={{ color: '#F5EFE0', marginTop: 14 }}>
          분석에 실패했어요
        </p>
        <p className="text-body-sm" style={{ color: 'rgba(245,239,224,0.6)', marginTop: 8 }}>
          {apiError || 'AI 서버가 일시적으로 바빠요.'}
        </p>
      </section>
      <Button fullWidth size="lg" onClick={onRetry}>다시 시도하기</Button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 결과 화면 — 10 섹션 + 결제 유도 4구간
 * ═════════════════════════════════════════════════════════════════ */
function ResultView({
  result,
  profile,
  dateInfo,
  onWeekly,
  onTopicTap,
  onFullReport,
  onRetry,
}: {
  result: any;
  profile: SajuProfile;
  dateInfo: { date: string; weekday: string; ganzi: string; label: string };
  onWeekly: () => void;
  onTopicTap: (topicId: TopicKey) => void;
  onFullReport: () => void;
  onRetry: () => void;
}) {
  const score = clampScore(result?.score);
  const grade = String(result?.grade ?? 'B').toUpperCase();
  const gradeColor = GRADE_V4[grade] ?? '#A08B6A';
  const headline = stripMd(String(result?.headline ?? '오늘의 운세'));
  const summary = stripMd(String(result?.summary ?? ''));
  const keywords: string[] = Array.isArray(result?.keywords) ? result.keywords.slice(0, 5) : [];
  const sajuTone = stripMd(String(result?.sajuTone ?? ''));
  const ohengFlow = result?.ohengFlow;
  const scores = result?.scores;
  const timeSlots = Array.isArray(result?.timeSlots) ? result.timeSlots : [];
  const luckyDirection = result?.luckyDirection;
  const doList: string[] = Array.isArray(result?.doList) ? result.doList.slice(0, 3) : [];
  const dontList: string[] = Array.isArray(result?.dontList) ? result.dontList.slice(0, 3) : [];
  const dailyMessage = stripMd(String(result?.dailyMessage ?? ''));
  const luckyColor = result?.luckyProfile?.color;

  const pillars = useMemo(() => buildPillars(profile), [profile]);

  const tsSlots: TSSlot[] = useMemo(
    () =>
      (timeSlots as any[]).slice(0, 4).map((s) => ({
        slot: (String(s?.slot ?? '오전') as TSSlot['slot']),
        range: String(s?.range ?? ''),
        score: clampScore(s?.score),
        tip: stripMd(String(s?.tip ?? '')),
      })),
    [timeSlots],
  );

  const currentHour = useMemo(() => new Date().getHours(), []);

  const [showAllScores, setShowAllScores] = useState(false);
  useEffect(() => {
    if (!showAllScores) return;
    const t = setTimeout(() => setShowAllScores(true), 0);
    return () => clearTimeout(t);
  }, [showAllScores]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* S0 — 스티키 헤더의 날짜 */}
      <p className="sec-meta" style={{ marginBottom: -6 }}>{dateInfo.label}</p>

      {/* S1 판정 카드 */}
      <FadeIn>
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
              <p className="sec-title-lg" style={{ marginTop: 6 }}>{headline}</p>
            </div>
          </div>
          {summary && (
            <p className="text-body-lg" style={{ color: 'var(--text-secondary)', marginTop: 14 }}>
              {summary}
            </p>
          )}
          {keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {keywords.map((kw, i) => (
                <span key={i} className="chip-v4">{kw}</span>
              ))}
            </div>
          )}
        </section>
      </FadeIn>

      {/* S2 내 사주 미니 카드 (IX-1) */}
      {pillars.length === 4 && (
        <FadeIn delay={0.04}>
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

      {/* S3 사주 × 오늘 톤 (pull quote) */}
      {sajuTone && (
        <FadeIn delay={0.08}>
          <section className="card-accent">
            <p className="sec-meta" style={{ marginBottom: 6 }}>오늘의 톤</p>
            <p className="text-body-lg" style={{ color: 'var(--text-primary)' }}>
              {sajuTone}
            </p>
          </section>
        </FadeIn>
      )}

      {/* S4 오행 분포 + 오늘의 강세 */}
      {ohengFlow?.sajuDistribution && (
        <FadeIn delay={0.12}>
          <section className="card-secondary">
            <p className="sec-title" style={{ marginBottom: 6 }}>오늘의 오행 흐름</p>
            <p className="sec-caption" style={{ marginBottom: 14 }}>
              {stripMd(String(ohengFlow?.insight ?? ''))}
            </p>
            <OhengCompareBar
              primary={toOhengDist(ohengFlow.sajuDistribution)}
              primaryLabel="내 사주"
              todayEmphasis={normalizeOheng(ohengFlow.todayEmphasis)}
            />
          </section>
        </FadeIn>
      )}

      {/* S5 오늘의 점수 4영역 (IX-11 아코디언) */}
      {scores && (
        <FadeIn delay={0.16}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>오늘의 점수</p>
            <ScoreGrid scores={scores} />
          </section>
        </FadeIn>
      )}

      {/* S6 시간대별 흐름 (IX-8) */}
      {tsSlots.length === 4 && (
        <FadeIn delay={0.2}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 14 }}>시간대별 흐름</p>
            <TimeSlotCarousel slots={tsSlots} currentHour={currentHour} />
          </section>
        </FadeIn>
      )}

      {/* S7 행운의 방위 나침반 (IX-9) */}
      {luckyDirection?.direction && (
        <FadeIn delay={0.24}>
          <section className="card-secondary">
            <p className="sec-title" style={{ marginBottom: 12, textAlign: 'center' }}>
              오늘의 행운 방위
            </p>
            <CompassDrag
              direction={normalizeDirection(luckyDirection.direction)}
              desc={stripMd(String(luckyDirection?.desc ?? ''))}
            />
          </section>
        </FadeIn>
      )}

      {/* S8 해야 할 것 · 피해야 할 것 */}
      {(doList.length > 0 || dontList.length > 0) && (
        <FadeIn delay={0.28}>
          <section className="card-primary">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <p className="sec-meta" style={{ color: 'var(--brand-gold)', marginBottom: 8 }}>
                  해야 할 것
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
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
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
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

      {/* S9 개운 한 마디 */}
      {dailyMessage && (
        <FadeIn delay={0.32}>
          <section className="card-accent">
            <p className="sec-meta" style={{ marginBottom: 6 }}>오늘의 한 마디</p>
            <p className="text-body-lg" style={{ color: 'var(--text-primary)' }}>
              {dailyMessage}
            </p>
          </section>
        </FadeIn>
      )}

      {/* ═════════ S10 결제 유도 구간 4종 ═════════ */}

      {/* 4.1 TopicCTAGrid (IX-5) */}
      <FadeIn delay={0.36}>
        <TopicCTAGrid
          meta="더 깊이 알고 싶다면"
          title="주제별 심층 분석"
          topics={DAILY_TOPIC_ITEMS}
          onTopicTap={onTopicTap}
        />
      </FadeIn>

      {/* 4.2 이번 주 흐름 잠금 */}
      <FadeIn delay={0.4}>
        <LockedCard
          title="이번 주 7일 가이드"
          subtitle="매일 달라지는 컨디션·기회·주의"
          ctaText="이번 주 흐름 열기 (1운)"
          onUnlock={onWeekly}
        />
      </FadeIn>

      {/* 4.3 행운 프로필 (IX-4) — 색 공개 + 3잠금 */}
      <FadeIn delay={0.44}>
        <section className="card-primary">
          <p className="sec-title" style={{ marginBottom: 14 }}>오늘의 행운 프로필</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <LuckyColorCard color={luckyColor} />
            <LockedCard
              title="행운의 숫자"
              subtitle="오늘 당신에게 맞는 숫자"
              ctaText="숫자 열기 (1운)"
              onUnlock={onWeekly}
              height={144}
            />
            <LockedCard
              title="행운의 방위 상세"
              subtitle="어디로 향해야 할지 · 왜"
              ctaText="방위 심층 보기 (1운)"
              onUnlock={onWeekly}
              height={144}
            />
            <LockedCard
              title="보충 오행"
              subtitle="부족한 기운을 채우는 법"
              ctaText="오행 보기 (1운)"
              onUnlock={onWeekly}
              height={144}
            />
          </div>
        </section>
      </FadeIn>

      {/* 4.4 풀 리포트 CTA */}
      <FadeIn delay={0.48}>
        <section
          className="card-navy-v4"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(201,169,110,0.2)' }}
            >
              <Pictogram k="ui:lucky" size={22} color="#E8D5A8" />
            </div>
            <div>
              <p className="sec-title" style={{ color: '#F5EFE0' }}>
                아직 사주 리포트 안 받아보셨나요?
              </p>
              <p className="text-body-sm" style={{ color: 'rgba(245,239,224,0.7)', marginTop: 4 }}>
                오늘 운세보다 10배 깊은 분석. 10개 섹션 종합 리포트.
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
 * 작은 UI 파츠
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
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <span style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: '-0.03em' }}>{score}</span>
        <span className="sec-caption" style={{ fontSize: 10 }}>점</span>
      </div>
    </div>
  );
}

/** IX-11 아코디언 패턴 — 각 영역 탭 시 desc 펼침 */
function ScoreGrid({ scores }: { scores: any }) {
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
        const sc = clampScore(v?.score);
        const desc = stripMd(String(v?.desc ?? ''));
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
              <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand-gold)', letterSpacing: '-0.02em' }}>
                {sc}
              </p>
            </div>
            <AnimatePresence initial={false}>
              {open && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-body-sm"
                  style={{ color: 'var(--text-secondary)', marginTop: 8 }}
                >
                  {desc}
                </motion.p>
              )}
            </AnimatePresence>
            {!open && desc && (
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
      height={height ?? 144}
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

/* ══════════════════════════════════════════════════════════════════
 * 주제 CTA 4카드 (IX-5)
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
  const dow = d.getDay(); // 0=일, 1=월 ... 6=토
  const delta = dow === 0 ? -6 : 1 - dow; // 월요일 기준
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

function buildPillars(profile: SajuProfile): PillarData[] {
  const raw = profile.sajuData?.pillars ?? [];
  const labels: Array<'년' | '월' | '일' | '시'> = ['년', '월', '일', '시'];
  const ordered: PillarData[] = raw.map((p: any, i: number) => ({
    label: labels[i] ?? '년',
    gan: String(p?.천간 ?? ''),
    ji: String(p?.지지 ?? ''),
    ohengGan: (p?.천간오행 ?? '토') as OhengType,
    ohengJi: (p?.지지오행 ?? '토') as OhengType,
    shipsin: p?.십성 ?? undefined,
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
