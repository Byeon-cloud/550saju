import { useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { TojungMonthCard } from '@/components/saju/TojungMonthCard';
import { ShareModal } from '@/components/share/ShareModal';
import { getProfiles, spendBalance, saveReport, generateId, getCachedResult, type LocalReport } from '@/services/storage/localStore';
import { generateTojungBigyeol } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import { FooterCTA } from '@/components/common/FooterCTA';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import type { TojungResponse } from '@/types/report';
import { stripMd, sanitizeAiText } from '@/utils/format';
// Phase D'-4 Bundle 2 (#54) — mockup 진본 시각 정렬
import {
  EXTENSION_THEME,
  ExtensionHero,
  ExtensionUpsellCard,
  TojungHexagramCard,
  TojungFourBox,
  type TojungFourItem,
} from './extension/_chrome';

type Phase = 'select' | 'loading' | 'result';

const LOADING_STEPS = [
  '올해의 상괘를 뽑고 있어요...',
  '월별 괘를 배치하고 있어요...',
  '전통 해석을 현대어로 풀고 있어요...',
  '개운 조언을 작성하고 있어요...',
];

const CATEGORY_ICONS: Record<string, string> = {
  총운: '總', 금전운: '財', 건강운: '健', 직장운: '職', 애정운: '愛', 결혼운: '婚',
};
const CATEGORY_COLORS: Record<string, string> = {
  총운: '#B8965A', 금전운: '#E8B82A', 건강운: '#2D8A4E', 직장운: '#1565E0', 애정운: '#E91E63', 결혼운: '#7B1FA2',
};

export function TojungPage() {
  usePageTitle('토정비결');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // 보관함에서 저장된 결과를 넘겨받은 경우
  const navState = location.state as { savedResult?: TojungResponse; savedReport?: LocalReport } | undefined;

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  const [selected, setSelected] = useState<LocalReport | null>(navState?.savedReport || null);
  const [result, setResult] = useState<TojungResponse | null>(navState?.savedResult || null);
  const [, setLoadingStep] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const isAnalyzingRef = useRef(false);

  const reports = useMemo(() => getProfiles(), []);

  async function startAnalysis() {
    if (!selected) return;
    if (isAnalyzingRef.current || phase === 'loading') return;
    isAnalyzingRef.current = true;

    // 캐시 확인 — 이전에 분석한 적 있으면 무료로 바로 보여줌
    const cached = getCachedResult(selected.name, selected.input.birthYear, selected.input.birthMonth, selected.input.birthDay, 'tojung');
    if (cached?.aiResult) {
      setResult(cached.aiResult);
      setPhase('result');
      toast.show('이전 분석 결과를 불러왔어요', 'info');
      isAnalyzingRef.current = false;
      return;
    }

    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '토정비결에 1운이 필요해요' } });
      isAnalyzingRef.current = false;
      return;
    }
    toast.show('1운이 차감됐어요', 'info');
    setPhase('loading');
    setLoadingStep(0);
    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 3000);

    try {
      const res = await generateTojungBigyeol(selected.sajuData);
      setResult(res.content);
      // aiResult에 결과 저장 → 같은 사람이면 다음에 캐시로 반환
      saveReport({ id: res.reportId || generateId(), name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'tojung', aiResult: res.content, createdAt: new Date().toISOString() });
      setPhase('result');
    } catch (e: any) {
      console.error('토정비결 실패:', e);
      // 환불은 서버(Cloud Function) 트랜잭션 롤백에 위임 — 클라이언트 직접 환불 금지 (보안)
      setPhase('select');
      toast.show('분석에 실패했어요. 잔액은 자동으로 복구돼요.', 'warning');
    } finally {
      clearInterval(interval);
      isAnalyzingRef.current = false;
    }
  }

  // ─── 프로필 선택 ───
  if (phase === 'select') {
    if (reports.length === 0) {
      return (
        <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
          <Header title="토정비결" />
          <div className="px-5 pt-8 text-center space-y-4">
            <p className="text-h2 text-text-primary">먼저 사주를 분석해주세요</p>
            <p className="text-body-sm text-text-muted">사주 데이터가 있어야 토정비결을 볼 수 있어요.</p>
            <Button onClick={() => navigate('/input?from=home_body_tojung')} variant="gold" size="lg" fullWidth>사주 분석하러 가기</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="토정비결" />
        {/* 2026-05-04 ExtensionHero 통일 (select phase 부터 적용) */}
        <FadeIn>
          <ExtensionHero
            theme={EXTENSION_THEME.tojung}
            sub="조선시대 이토정 선생의 전통 운세법 · 주역 64괘로 12개월"
            rightLabel="歲 · 한 해의 결"
          />
        </FadeIn>
        <div className="px-5 pt-5 space-y-5">
          <FadeIn delay={0.05}>
            <ProfilePicker onSelect={p => setSelected(p as unknown as LocalReport)} onNew={() => navigate('/input?new=1')} title="누구의 토정비결을 볼까요?" />
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
            <Button onClick={startAnalysis} variant="gold" size="lg" fullWidth>토정비결 보기 (1운)</Button>
          </div>
        )}
      </div>
    );
  }

  // ─── 로딩 ───
  if (phase === 'loading') {
    return <AILoading name={selected?.name} type="토정비결" sajuData={selected?.sajuData} steps={['올해의 괘를 뽑고 있어요', '월별 괘를 배치하고 있어요', '전통 해석을 현대어로 풀고 있어요']} />;
  }

  // ─── 결과 ───
  if (!result) return null;

  const categories = Object.entries(result.yearOverview) as [string, string][];

  // Phase D'-4 Bundle 2 — chrome theme + AI hexagram/fourBox (over-fit 방지: 응답 있을 때만)
  const tojungTheme = EXTENSION_THEME.tojung;
  const aiHex = (result as any)?.hexagram;
  const aiFourBox: TojungFourItem[] | null = Array.isArray((result as any)?.fourBox)
    ? ((result as any).fourBox as TojungFourItem[])
    : null;

  return (
    <div className="min-h-screen pb-20" style={{ background: 'linear-gradient(180deg, #F5F0E8 0%, #FFFFFF 30%)' }}>
      <Header title="토정비결" />

      {/* Phase D'-4 Bundle 2 — ExtensionHero (歲 인장 + 네이비 그라디언트) */}
      <FadeIn>
        <ExtensionHero
          theme={tojungTheme}
          crumb="사주 500 · 더 알아볼 주제 · 토정비결"
          sub="토정 이지함 선생의 풀이법으로 한 해를 열두 달로 나눠 봅니다."
          seal="歲"
        />
      </FadeIn>

      {/* Phase D'-4 Bundle 2 — TojungHexagramCard (本卦 + glyph + pull, AI 응답 있을 때만) */}
      {aiHex && (
        <FadeIn delay={0.04}>
          <TojungHexagramCard
            yearLabel={String(aiHex.yearLabel ?? '2026 병오년 · 본괘')}
            glyph={String(aiHex.glyph ?? '')}
            name={String(aiHex.name ?? '')}
            oneLine={stripMd(String(aiHex.oneLine ?? aiHex.summary ?? ''))}
            pullQuote={aiHex.pullQuote ? String(aiHex.pullQuote) : undefined}
          />
        </FadeIn>
      )}

      {/* Phase D'-4 Bundle 2 — TojungFourBox (상반기/하반기/길월/주의월, AI 응답 있을 때만) */}
      {aiFourBox && aiFourBox.length === 4 && (
        <FadeIn delay={0.06}>
          <TojungFourBox items={aiFourBox} />
        </FadeIn>
      )}

      <div className="px-5 pt-4 space-y-5">

        {/* 헤더 */}
        <FadeIn>
          <div className="text-center py-4">
            <p className="text-caption text-brand-gold font-semibold">2026년 토정비결</p>
            <p className="text-display text-text-primary">{selected?.name}님</p>
          </div>
        </FadeIn>

        {/* 키워드 태그 */}
        {(result as any).keywords?.length > 0 && (
          <FadeIn delay={0.03}>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {(result as any).keywords.map((kw: string, i: number) => (
                <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(184,150,90,0.1)', color: '#8C6D3D', border: '1px solid rgba(184,150,90,0.2)' }}>
                  {kw}
                </span>
              ))}
            </div>
          </FadeIn>
        )}

        {/* 6대 카테고리 그리드 */}
        <FadeIn delay={0.05}>
          <div className="grid grid-cols-2 gap-3">
            {categories.map(([key, value], i) => {
              const catColor = CATEGORY_COLORS[key] || '#B8965A';
              const catScore = (result as any).categoryScores?.[key];
              return (
                <motion.div
                  key={key}
                  className="card py-4 px-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${catColor}12` }}>
                      <span className="text-[12px] font-black" style={{ color: catColor }}>{CATEGORY_ICONS[key] || '總'}</span>
                    </div>
                    <p className="text-label text-text-primary font-bold flex-1">{key}</p>
                    {catScore != null && (
                      <span className="text-[12px] font-black" style={{ color: catColor }}>{catScore}</span>
                    )}
                  </div>
                  {catScore != null && (
                    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: `${catColor}10` }}>
                      <motion.div className="h-full rounded-full" style={{ background: catColor }}
                        initial={{ width: 0 }} animate={{ width: `${Math.min(catScore, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }} />
                    </div>
                  )}
                  <p className="text-caption text-text-secondary leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeAiText(value) }} />
                </motion.div>
              );
            })}
          </div>
        </FadeIn>

        {/* 12개월 점수 흐름 */}
        <FadeIn delay={0.25}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">월별 운세 흐름</p>
            <p className="text-[10px] text-text-hint mb-3">12개월 점수 추이</p>
            <div className="h-36 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.months.map((m: any) => ({ name: `${m.month}월`, 점수: m.score || 5 }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tojungGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B8965A" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#B8965A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-hint)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: 'var(--text-disabled)' }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="점수" stroke="#B8965A" strokeWidth={2}
                    fill="url(#tojungGrad)"
                    dot={{ r: 2.5, fill: '#B8965A', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeIn>

        {/* 12개월 상세 */}
        <FadeIn delay={0.3}>
          <p className="text-h2 text-text-primary">월별 토정비결</p>
          <p className="text-caption text-text-muted">각 달을 눌러 전통 괘와 현대어 풀이를 확인하세요</p>
        </FadeIn>

        <div className="space-y-3">
          {result.months.map((m, i) => (
            <TojungMonthCard
              key={m.month}
              month={m.month}
              괘={m.괘}
              괘의미={m.괘의미}
              전통해석={m.전통해석}
              현대해석={m.현대해석}
              score={m.score}
              keyword={m.keyword}
              delay={0.35 + i * 0.03}
            />
          ))}
        </div>

        {/* 개운 조언 */}
        <FadeIn delay={0.7}>
          <div className="py-5 px-5 rounded-2xl" style={{ background: 'rgba(184,150,90,0.06)', border: '1px solid rgba(184,150,90,0.15)' }}>
            <p className="text-h3 text-text-primary mb-2">올해의 개운 조언</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.luckyAdvice) }} />
          </div>
        </FadeIn>

        <FadeIn delay={0.75}>
          <Button onClick={() => setShowShare(true)} variant="gold" size="lg" fullWidth>결과 공유하기</Button>
        </FadeIn>

        {/* Phase D'-4 Bundle 2 — ExtensionUpsellCard (단일 CTA) */}
        <FadeIn delay={0.78}>
          <ExtensionUpsellCard
            title="한 해의 흐름을 사주 전체에서 풀어드립니다"
            desc="토정비결 12절이 사주 원국과 어떻게 맞물리는지, 평생의 결까지 한 번에."
            onTap={() => navigate('/charge?need=10')}
          />
        </FadeIn>

        {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) — Phase 누락 보강 2 패턴 */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) + 토정 이지함『토정비결』기반
          </p>
          <p className="text-[11px] italic" style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
            사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
            <br />
            의료·법률·재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
          </p>
        </div>

        {/* 3-part Footer CTA (diff v3 §6) */}
        <FooterCTA pageKey="tojung" backTo="/" />
      </div>

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} name={selected?.name || ''} reportId="tojung" />
    </div>
  );
}
