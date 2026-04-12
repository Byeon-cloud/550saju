import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { getReports, saveReport, generateId, spendBalance, type LocalReport } from '@/services/storage/localStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/common/Toast';
import { generateTopicAnalysis } from '@/services/ai/reportGenerator';

/* ─── 주제 설정 ─── */
const TOPICS: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  love:     { label: '연애운',       icon: '愛', color: '#E91E63', desc: '인연의 시작, 이상형, 연애 흐름' },
  wealth:   { label: '재물운',       icon: '財', color: '#C9A96E', desc: '돈 흐름, 투자 적기, 새는 돈 패턴' },
  career:   { label: '취업·이직운', icon: '事', color: '#1565C0', desc: '적성, 이직 타이밍, 맞는 직종' },
  marriage: { label: '결혼운',       icon: '婚', color: '#E91E63', desc: '결혼 적기, 배우자 성향, 결혼 후 생활' },
  business: { label: '사업운',       icon: '商', color: '#2D8A4E', desc: '창업 타이밍, 맞는 업종, 동업 궁합' },
  health:   { label: '건강운',       icon: '健', color: '#2E7D32', desc: '취약 장기, 건강 주의 시기, 체질 분석' },
  reunion:  { label: '재회운',       icon: '緣', color: '#7B1FA2', desc: '재회 가능성, 적기, 새 인연 비교' },
  study:    { label: '학업·시험운', icon: '學', color: '#0288D1', desc: '학습 스타일, 합격 운, 공부 시간대' },
  social:   { label: '대인관계운',   icon: '人', color: '#F57F17', desc: '귀인운, 구설수 주의, 관계 패턴' },
  moving:   { label: '이사·이동운', icon: '動', color: '#757575', desc: '이동 적기, 좋은 방향, 해외운' },
};

type Phase = 'select' | 'loading' | 'result';

const LOADING_MSGS = [
  '사주 원국을 분석하고 있어요...',
  '오행의 흐름을 읽고 있어요...',
  '십성 배치를 확인하고 있어요...',
  '현재 대운과 연결하고 있어요...',
  '맞춤 분석을 정리하고 있어요...',
];

export function TopicAnalysisPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const topic = TOPICS[topicId || ''];
  const navigate = useNavigate();
  const toast = useToast();
  usePageTitle(topic?.label || '심층분석');

  const [phase, setPhase] = useState<Phase>('select');
  const [selected, setSelected] = useState<LocalReport | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loadingMsg, setLoadingMsg] = useState(0);

  // 프로필 목록
  const profiles = useMemo(() => {
    const all = getReports();
    const seen = new Map<string, LocalReport>();
    for (const r of all) {
      if (!r.sajuData?.pillars?.length) continue;
      const key = `${r.name}_${r.input?.birthYear}_${r.input?.birthMonth}_${r.input?.birthDay}`;
      if (!seen.has(key)) seen.set(key, r);
    }
    return Array.from(seen.values());
  }, []);

  // 이미 분석한 결과가 있는지 확인
  const existingResult = useMemo(() => {
    if (!selected || !topicId) return null;
    const key = `topic_${topicId}_${selected.id}`;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [selected, topicId]);

  useEffect(() => {
    if (existingResult) {
      setResult(existingResult);
      setPhase('result');
    }
  }, [existingResult]);

  // 단일 프로필이면 자동 선택
  useEffect(() => {
    if (profiles.length === 1 && !selected) {
      setSelected(profiles[0]);
    }
  }, [profiles, selected]);

  if (!topic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-page">
        <div className="text-center space-y-4">
          <p className="text-h2 text-text-primary">알 수 없는 주제예요</p>
          <Button onClick={() => navigate('/')}>홈으로</Button>
        </div>
      </div>
    );
  }

  async function analyze() {
    if (!selected) return;

    // 과금
    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: `${topic.label} 분석에 1운이 필요해요` } });
      return;
    }

    setPhase('loading');
    const interval = setInterval(() => setLoadingMsg(s => Math.min(s + 1, LOADING_MSGS.length - 1)), 3000);

    try {
      const res = await generateTopicAnalysis(topicId!, selected.sajuData);
      setResult(res.content);

      // localStorage 캐시
      const cacheKey = `topic_${topicId}_${selected.id}`;
      localStorage.setItem(cacheKey, JSON.stringify(res.content));

      // 보관함 저장
      saveReport({
        id: res.reportId || generateId(),
        name: selected.name,
        input: selected.input,
        sajuData: selected.sajuData,
        type: 'paid',
        contentType: 'topic',
        createdAt: new Date().toISOString(),
        aiResult: { topicId, ...res.content },
      });

      setPhase('result');
    } catch (e: any) {
      console.error('주제 분석 실패:', e);
      const { addRewardBalance } = await import('@/services/storage/localStore');
      addRewardBalance(1);
      toast.show('분석 실패 — 1운이 환불됐어요', 'warning');
      setPhase('select');
    } finally {
      clearInterval(interval);
    }
  }

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="px-5 pt-4 pb-8 space-y-5">

        {/* 헤더 */}
        <FadeIn>
          <div className="card-navy py-6 px-5 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.06]"
              style={{ background: `radial-gradient(circle, ${topic.color}, transparent 70%)` }} />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `${topic.color}20` }}>
                <span className="text-2xl font-black" style={{ color: topic.color }}>{topic.icon}</span>
              </div>
              <div>
                <h1 className="text-h1 text-white">{topic.label} 심층분석</h1>
                <p className="text-caption text-white/40">{topic.desc}</p>
              </div>
            </div>
            <p className="text-[10px] text-white/25">정통 명리학 기반 · 1운(500원)</p>
          </div>
        </FadeIn>

        <AnimatePresence mode="wait">
          {/* ====== 프로필 선택 ====== */}
          {phase === 'select' && (
            <motion.div key="select" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
              {profiles.length > 0 ? (
                <>
                  <p className="text-h3 text-text-primary">누구의 {topic.label}을 분석할까요?</p>
                  <div className="space-y-2">
                    {profiles.map((r) => {
                      const il = r.sajuData.pillars[2]?.천간 || '';
                      const oh = il ? CHEONGAN_OHENG[il] : '';
                      const isSelected = selected?.id === r.id;
                      return (
                        <motion.button key={r.id} whileTap={{ scale: 0.98 }}
                          onClick={() => setSelected(r)}
                          className={`card w-full text-left py-4 px-4 transition-all ${isSelected ? 'border-2 shadow-glow' : ''}`}
                          style={isSelected ? { borderColor: topic.color } : {}}>
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: `${topic.color}12` }}>
                              <span className="text-h3 font-bold" style={{ color: topic.color }}>{r.name.charAt(0)}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-h3 text-text-primary">{r.name}</p>
                              <p className="text-caption text-text-muted">{il ? `${il}(${oh}) 일간` : '사주 정보'}</p>
                            </div>
                            {isSelected && (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: topic.color }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                              </div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                  {selected && (
                    <Button fullWidth size="lg" variant="gold" onClick={analyze}>
                      {topic.label} 분석하기 (1운)
                    </Button>
                  )}
                </>
              ) : (
                <div className="card text-center py-10 space-y-3">
                  <p className="text-h2 text-text-primary">사주를 먼저 입력해주세요</p>
                  <p className="text-body-sm text-text-muted">생년월일시를 입력하면 {topic.label} 심층분석을 받을 수 있어요</p>
                  <Button variant="gold" onClick={() => navigate('/input')}>사주 입력하기</Button>
                </div>
              )}
            </motion.div>
          )}

          {/* ====== 로딩 ====== */}
          {phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative">
                <motion.div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: `${topic.color}15` }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}>
                  <span className="text-4xl font-black" style={{ color: topic.color }}>{topic.icon}</span>
                </motion.div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-h3 text-text-primary">{topic.label} 분석 중</p>
                <motion.p key={loadingMsg} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-body-sm text-text-muted">{LOADING_MSGS[loadingMsg]}</motion.p>
              </div>
            </motion.div>
          )}

          {/* ====== 결과 ====== */}
          {phase === 'result' && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* 등급 */}
              <div className="card text-center py-6">
                <motion.div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-2"
                  style={{ background: `${topic.color}20` }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}>
                  <span className="text-3xl font-black" style={{ color: topic.color }}>{result.grade || 'A'}</span>
                </motion.div>
                <p className="text-h2" style={{ color: topic.color }}>{result.gradeLabel || topic.label}</p>
                <p className="text-caption text-text-hint mt-1">종합점수 {result.overallScore || 75}점</p>
              </div>

              {/* 요약 */}
              <div className="card">
                <p className="text-body text-text-secondary leading-relaxed whitespace-pre-line">{result.summary}</p>
              </div>

              {/* 섹션들 */}
              {result.sections?.map((sec: any, i: number) => (
                <FadeIn key={i} delay={0.05 * i}>
                  <div className="card">
                    <p className="text-h3 text-text-primary mb-2">{sec.heading}</p>
                    <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{sec.content}</p>
                  </div>
                </FadeIn>
              ))}

              {/* 타임라인 */}
              {result.timeline?.length > 0 && (
                <FadeIn delay={0.1}>
                  <div className="card">
                    <p className="text-h3 text-text-primary mb-3">시기별 흐름</p>
                    <div className="space-y-2">
                      {result.timeline.map((t: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-2">
                          <span className="text-label w-16 flex-shrink-0 text-right" style={{ color: topic.color }}>{t.period}</span>
                          <div className="flex-1">
                            <div className="h-2 rounded-full bg-border-light overflow-hidden mb-1">
                              <motion.div className="h-full rounded-full" style={{ background: topic.color }}
                                initial={{ width: 0 }} animate={{ width: `${(t.score || 5) * 10}%` }}
                                transition={{ delay: 0.3 + i * 0.05, duration: 0.6 }} />
                            </div>
                            <p className="text-caption text-text-muted">{t.description}</p>
                          </div>
                          <span className="text-label text-text-primary w-6 text-right">{t.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 행운 프로필 */}
              {result.luckyProfile && (
                <FadeIn delay={0.15}>
                  <div className="card-gold">
                    <p className="text-h3 text-text-primary mb-3">{topic.label} 행운 아이템</p>
                    <div className="grid grid-cols-3 gap-y-3 gap-x-2">
                      {[
                        { label: '컬러', value: result.luckyProfile.color },
                        { label: '방위', value: result.luckyProfile.direction },
                        { label: '숫자', value: String(result.luckyProfile.number) },
                        { label: '아이템', value: result.luckyProfile.item },
                        { label: '최적월', value: result.luckyProfile.bestMonth },
                      ].filter(x => x.value).map((item) => (
                        <div key={item.label} className="text-center">
                          <p className="text-h3 text-text-primary">{item.value}</p>
                          <p className="text-tiny text-text-muted mt-0.5">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* 핵심 조언 */}
              {result.actionAdvice && (
                <FadeIn delay={0.2}>
                  <div className="card-emphasis">
                    <p className="text-label mb-2" style={{ color: topic.color }}>지금 바로 할 수 있는 것</p>
                    <p className="text-body text-text-primary leading-relaxed">{result.actionAdvice}</p>
                  </div>
                </FadeIn>
              )}

              {/* 다른 주제 CTA */}
              <div className="space-y-2 pt-2">
                <p className="text-label text-text-hint text-center">다른 운세도 궁금하다면</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TOPICS).filter(([id]) => id !== topicId).slice(0, 4).map(([id, t]) => (
                    <button key={id} onClick={() => { navigate(`/topic/${id}`); setPhase('select'); setResult(null); setSelected(profiles[0] || null); }}
                      className="card py-3 px-3 flex items-center gap-2">
                      <span className="text-[15px] font-black" style={{ color: t.color }}>{t.icon}</span>
                      <span className="text-caption font-semibold text-text-primary">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export { TOPICS };
