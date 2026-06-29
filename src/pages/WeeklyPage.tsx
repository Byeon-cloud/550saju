import { useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { ShareModal } from '@/components/share/ShareModal';
import { getProfiles, spendBalance, refundBalance, saveReport, generateId, getReport, markPendingSpend, clearPendingSpendByType, type LocalReport } from '@/services/storage/localStore';
import { generateWeeklyFortune } from '@/services/ai/reportGenerator';
import { getWeeklyPrice } from '@/constants/pricing';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import { FooterCTA } from '@/components/common/FooterCTA';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Solar } from 'lunar-javascript';
import { CHEONGAN_KO, JIJI_KO } from '@/constants/oheng';
import type { WeeklyDetailResponse, WeeklyDay } from '@/types/report';
import { stripMd, sanitizeAiText } from '@/utils/format';
import {
  EXTENSION_THEME,
  ExtensionHero,
  ExtensionUpsellCard,
} from './extension/_chrome';

type Phase = 'select' | 'loading' | 'result';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 일진 간지(한자 '甲子') → 한글 읽기('갑자'). 매핑 없으면 '' (calculator SSOT 재사용). */
function ganjiToKo(ganji: string): string {
  if (!ganji || ganji.length < 2) return '';
  const gan = CHEONGAN_KO[ganji[0]];
  const ji = JIJI_KO[ganji[1]];
  if (!gan || !ji) return '';
  return `${gan}${ji}`;
}

/**
 * weekDays — 롤링 7일 (구매일 '오늘' 전날부터 7일).
 * i ∈ [-1..5] → 어제·오늘·내일·...(7개). 고정 월~일 절대 사용 안 함.
 * 예: 목요일 실행 → 수·목·금·토·일·월·화.
 * 각 일자의 일진 간지는 lunar-javascript: Solar.fromYmd(y,m,d).getLunar().getDayInGanZhi().
 */
function computeWeekDays(): { day: string; date: string; ganji: string; ganjiRead: string }[] {
  const base = new Date();
  const out: { day: string; date: string; ganji: string; ganjiRead: string }[] = [];
  for (let i = -1; i <= 5; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    let ganji = '';
    try {
      ganji = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate()).getLunar().getDayInGanZhi();
    } catch {
      ganji = '';
    }
    out.push({
      day: WEEKDAY_KO[d.getDay()],
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      ganji,
      ganjiRead: ganjiToKo(ganji),
    });
  }
  return out;
}

export function WeeklyPage() {
  usePageTitle('주간운세');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // 보관함에서 저장된 결과를 넘겨받은 경우
  const rawNavState = location.state as { savedResult?: WeeklyDetailResponse; savedReport?: LocalReport } | undefined;
  // URL ?reportId= 폴백 — state 손실(새로고침/strict mode) 대비.
  const [searchParams] = useSearchParams();
  const reportIdFromUrl = searchParams.get('reportId');
  const reportFromUrl = useMemo(() => {
    if (!reportIdFromUrl) return null;
    try { return getReport(reportIdFromUrl); } catch { return null; }
  }, [reportIdFromUrl]);
  const navState = rawNavState?.savedReport
    ? rawNavState
    : (reportFromUrl ? { savedResult: reportFromUrl.aiResult as WeeklyDetailResponse, savedReport: reportFromUrl } : undefined);

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  const [selected, setSelected] = useState<LocalReport | null>(navState?.savedReport || null);
  const [result, setResult] = useState<WeeklyDetailResponse | null>(navState?.savedResult || null);
  const [showShare, setShowShare] = useState(false);
  const [shareReportId, setShareReportId] = useState<string>(navState?.savedReport?.id || '');
  const isAnalyzingRef = useRef(false);

  const reports = useMemo(() => getProfiles(), []);

  async function startAnalysis() {
    if (!selected) return;
    if (isAnalyzingRef.current || phase === 'loading') return;
    isAnalyzingRef.current = true;

    // 캐시 미사용 — 주간 윈도우(어제부터 7일)가 매일 이동하므로 contentType-only 캐시는 stale(지난주 데이터).
    //   재조회는 보관함(저장본)으로. 생성은 항상 현재 주 기준 새로. (월운 단일월과 동일 정책)
    const price = getWeeklyPrice().actualPrice; // 2026-06-29 NEW — 주간운세 정가 5운 (SSOT)
    if (!spendBalance(price)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate(`/charge?need=${price}`, { state: { message: `주간운세에 ${price}운이 필요해요`, returnTo: '/weekly' } });
      isAnalyzingRef.current = false;
      return;
    }
    // 측정 — 운 차감 성공 직후 (fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'weekly', amount: price })).catch(() => {});
    // 머니세이프 — 생성 중 앱 종료로 결과 못 받으면 부팅 reconcile 이 자동환불.
    markPendingSpend('weekly', price);
    toast.show(`${price}운이 차감됐어요`, 'info');
    setPhase('loading');

    // 롤링 7일 일진 (어제부터 7일) 계산 → 서버로 전달
    const weekDays = computeWeekDays();

    try {
      const res = await generateWeeklyFortune(selected.sajuData, weekDays);
      setResult(res.content);
      const rid = res.reportId || generateId();
      saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'weekly', aiResult: res.content, createdAt: new Date().toISOString() });
      clearPendingSpendByType('weekly'); // 결과 저장 완료 → 자동환불 대상 제외
      setShareReportId(rid);
      setPhase('result');
    } catch (e: any) {
      console.error('주간운세 실패:', e);
      // AI 실패 시 클라이언트에서 즉시 환불
      refundBalance(price);
      clearPendingSpendByType('weekly'); // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
      setPhase('select');
      toast.show(`분석에 실패해서 ${price}운을 돌려드렸어요`, 'warning');
    } finally {
      isAnalyzingRef.current = false;
    }
  }

  // ─── 프로필 선택 ───
  if (phase === 'select') {
    if (reports.length === 0) {
      return (
        <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
          <Header title="주간운세" />
          <div className="px-5 pt-8 text-center space-y-4">
            <p className="text-h2 text-text-primary">먼저 사주를 분석해주세요</p>
            <p className="text-body-sm text-text-muted">사주 데이터가 있어야 주간운세를 볼 수 있어요.</p>
            <Button onClick={() => navigate('/input?from=home_body_weekly')} variant="gold" size="lg" fullWidth>사주 분석하러 가기</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="주간운세" />
        <FadeIn>
          <ExtensionHero
            theme={EXTENSION_THEME.weekly}
            sub="이번 주 7일 · 좋은 날과 조심할 날을 한눈에"
            rightLabel="週 · 이번 주의 흐름"
          />
        </FadeIn>
        <div className="px-5 pt-5 space-y-5">
          <FadeIn delay={0.05}>
            <ProfilePicker onSelect={p => setSelected(p as unknown as LocalReport)} onNew={() => navigate('/input?new=1')} title="누구의 주간운세를 볼까요?" />
          </FadeIn>
          {selected && (
            <FadeIn delay={0.1}>
              <div className="card-gold py-3 px-4 flex items-center justify-between">
                <p className="text-body-sm text-text-primary"><span className="font-bold">{selected.name}</span>님 선택됨</p>
                <button onClick={() => setSelected(null)} className="text-caption text-text-muted">변경</button>
              </div>
            </FadeIn>
          )}
        </div>
        {selected && (
          <div className="sticky-cta-bottom">
            <Button onClick={startAnalysis} variant="gold" size="lg" fullWidth>주간운세 보기 ({getWeeklyPrice().actualPrice}운)</Button>
          </div>
        )}
      </div>
    );
  }

  // ─── 로딩 ───
  if (phase === 'loading') {
    return <AILoading name={selected?.name} type="주간운세" sajuData={selected?.sajuData} steps={['이번 주 일진을 짚고 있어요', '요일별 운세 점수를 계산하고 있어요', '이번 주 핵심일을 찾고 있어요']} />;
  }

  // ─── 결과 ───
  if (!result) return null;

  const weeklyTheme = EXTENSION_THEME.weekly;
  const ACCENT = weeklyTheme.accentDark; // #C77D3A
  const ilganLabel =
    selected?.sajuData?.pillars?.[2]?.천간
      ? `${selected.sajuData.pillars[2].천간읽기 ?? ''}(${selected.sajuData.pillars[2].천간}) 일간`
      : undefined;

  const days = Array.isArray(result.dailyBreakdown) ? result.dailyBreakdown : [];
  const keyDays = Array.isArray(result.keyDays) ? result.keyDays : [];
  const periodLabel = days.length > 0 ? `${days[0].date} ~ ${days[days.length - 1].date}` : '';
  const chartData = days.map((d) => ({ name: d.day, 점수: Math.max(0, Math.min(100, Number(d.score) || 0)) }));

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="주간운세" />

      {/* ① Hero — 주간 후크 + 테마 + 기간 */}
      <FadeIn>
        <ExtensionHero
          theme={weeklyTheme}
          sub={`${ilganLabel ?? ''}${periodLabel ? (ilganLabel ? ' · ' : '') + periodLabel : ''}`}
          rightLabel="週 · 이번 주의 운"
        />
      </FadeIn>

      <div className="px-5 pt-4 space-y-5">

        {/* 큰 후크 + 이번 주 테마 */}
        <FadeIn delay={0.04}>
          <div className="card py-6 px-5">
            {result.keywords?.length ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {result.keywords.map((kw, i) => (
                  <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${ACCENT}1A`, color: ACCENT, border: `1px solid ${ACCENT}33` }}>
                    {kw}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="text-h2 text-text-primary mb-1" style={{ lineHeight: 1.4 }}>{stripMd(result.weekHeadline)}</p>
            {result.weekTheme && (
              <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.weekTheme) }} />
            )}
            {periodLabel && (
              <p className="text-[11px] text-text-hint mt-3">이번 주 {periodLabel}</p>
            )}
          </div>
        </FadeIn>

        {/* ② 주간 리듬 그래프 — 7일 score 추이 */}
        {chartData.length > 0 && (
          <FadeIn delay={0.06}>
            <div className="card">
              <p className="text-h3 text-text-primary mb-1">이번 주 흐름</p>
              <p className="text-[11px] text-text-hint mb-3">7일 점수 추이 (요일별)</p>
              <div className="h-36 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-hint)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-disabled)' }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="점수" stroke={ACCENT} strokeWidth={2}
                      fill="url(#weeklyGrad)"
                      dot={{ r: 2.5, fill: ACCENT, strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FadeIn>
        )}

        {/* ③ 핵심일 카드 — best/caution */}
        {keyDays.length > 0 && (
          <FadeIn delay={0.08}>
            <p className="text-h3 text-text-primary mb-1">이번 주 핵심일</p>
            <div className="grid grid-cols-1 gap-3 mt-2">
              {keyDays.map((k, i) => {
                const isCaution = k.type === 'caution';
                const color = isCaution ? '#D32F2F' : ACCENT;
                const bg = isCaution ? 'rgba(211,47,47,0.05)' : `${ACCENT}0D`;
                return (
                  <div key={i} className="card py-4 px-4" style={{ background: bg, border: `1px solid ${color}26` }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: color, color: '#fff' }}>
                        {isCaution ? '주의' : 'BEST'}
                      </span>
                      <span className="text-h3 font-bold" style={{ color }}>{k.day}</span>
                      {k.date && <span className="text-caption text-text-muted">{k.date}</span>}
                    </div>
                    <p className="text-body-sm text-text-secondary leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeAiText(k.reason) }} />
                  </div>
                );
              })}
            </div>
          </FadeIn>
        )}

        {/* ④ 7일 요일별 카드 */}
        <FadeIn delay={0.12}>
          <p className="text-h2 text-text-primary">요일별 상세</p>
        </FadeIn>
        {days.map((d, i) => (
          <FadeIn key={`${d.day}-${d.date}-${i}`} delay={0.15 + i * 0.02}>
            <WeekDayCard day={d} accent={ACCENT} isYesterday={i === 0} />
          </FadeIn>
        ))}

        {/* ⑤ 이번 주 교훈 */}
        {result.weekLesson && (
          <FadeIn delay={0.32}>
            <div className="card py-5 px-5" style={{ background: `${ACCENT}0A`, border: `1px solid ${ACCENT}26` }}>
              <p className="text-caption font-bold mb-1.5" style={{ color: ACCENT, letterSpacing: '0.06em' }}>이번 주 교훈</p>
              <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.weekLesson) }} />
            </div>
          </FadeIn>
        )}

        <FadeIn delay={0.4}>
          <Button onClick={() => setShowShare(true)} variant="gold" size="lg" fullWidth>결과 공유하기</Button>
        </FadeIn>

        {/* 단일 CTA — 종합사주 업셀 */}
        <FadeIn delay={0.42}>
          <ExtensionUpsellCard
            title="이번 주의 흐름을 사주 전체에서 풀어드립니다"
            desc="이번 주 7일의 결이 사주 원국의 어느 자리에서 비롯되는지, 평생의 운까지 한 번에."
            onTap={() => navigate('/charge?need=10')}
          />
        </FadeIn>

        {/* 출처 + 디스클레이머 */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반
          </p>
          <p className="text-[11px] italic" style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
            사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
            <br />
            의료·법률·재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
          </p>
        </div>

        {/* 3-part Footer CTA */}
        <FooterCTA pageKey="weekly" backTo="/" />
      </div>

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} name={selected?.name || ''} reportId={shareReportId || 'weekly'} />
    </div>
  );
}

function WeekDayCard({ day: d, accent, isYesterday }: { day: WeeklyDay; accent: string; isYesterday: boolean }) {
  const score = Math.max(0, Math.min(100, Number(d.score) || 0));
  const scoreColor = score >= 80 ? accent : score >= 60 ? '#2D8A4E' : score >= 40 ? '#8C6D3D' : '#D32F2F';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${scoreColor}14` }}>
            <span className="text-h3 font-black" style={{ color: scoreColor }}>{d.day}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-h3 text-text-primary">{d.date}</p>
              {d.ganji && (
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-hint)', fontFamily: "'Noto Serif KR', serif" }}>{d.ganji}</span>
              )}
              {isYesterday && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(122,114,105,0.12)', color: 'var(--text-muted)' }}>어제</span>
              )}
            </div>
            {d.tone && <p className="text-caption text-text-muted mt-0.5">{stripMd(d.tone)}</p>}
          </div>
        </div>
        <span className="text-h3 font-bold" style={{ color: scoreColor }}>{score}</span>
      </div>
      {d.body && (
        <p className="text-body-sm text-text-secondary leading-relaxed mt-1" dangerouslySetInnerHTML={{ __html: sanitizeAiText(d.body) }} />
      )}
      {d.action && (
        <div className="mt-3 py-2 px-3 rounded-lg" style={{ background: `${accent}0D` }}>
          <p className="text-caption font-semibold" style={{ color: accent }}>→ {stripMd(d.action)}</p>
        </div>
      )}
    </div>
  );
}
