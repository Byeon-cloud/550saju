import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { getReports, getMyProfile, type LocalReport } from '@/services/storage/localStore';
import { spendBalance } from '@/services/storage/localStore';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CHEONGAN_OHENG } from '@/constants/oheng';

const RELATIONS = ['연인', '배우자', '썸', '이별', '친구', '동료', '부모-자녀', '형제·자매', '기타'] as const;

export function CompatibilityPage() {
  usePageTitle('궁합');
  const navigate = useNavigate();
  // 매 렌더링마다 최신 리포트 조회 (InputPage에서 돌아왔을 때 갱신)
  const [reports, setReports] = useState(() => getReports());

  const [person1, setPerson1] = useState<LocalReport | null>(getMyProfile() || reports[0] || null);
  const [person2, setPerson2] = useState<LocalReport | null>(null);
  const [relation, setRelation] = useState<string | null>(null);
  const toast = useToast();
  const [showPicker, setShowPicker] = useState<1 | 2 | null>(null);
  const [customRelation, setCustomRelation] = useState('');

  // InputPage에서 /compat으로 복귀 시 → 최신 리포트를 person2에 자동 선택
  useEffect(() => {
    const freshReports = getReports();
    setReports(freshReports);
    // person2가 비어있고, 방금 입력한 사주(reports[0])가 person1과 다르면 자동 선택
    if (!person2 && freshReports.length >= 2) {
      const latest = freshReports[0];
      if (latest && person1 && latest.id !== person1.id) {
        setPerson2(latest);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function getIlgan(r: LocalReport) {
    const ilgan = r.sajuData.pillars[2]?.천간 || '';
    const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
    return { ilgan, oheng };
  }

  function PersonCard({ person, slot }: { person: LocalReport | null; slot: 1 | 2 }) {
    if (!person) {
      return (
        <button
          onClick={() => reports.length > 0 ? setShowPicker(slot) : navigate('/input')}
          className="flex-1 rounded-2xl border-2 border-dashed border-border py-6 flex flex-col items-center justify-center gap-2"
          style={{ background: 'var(--bg-surface)' }}
        >
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-text-hint flex items-center justify-center">
            <span className="text-2xl text-text-hint">+</span>
          </div>
          <p className="text-caption text-text-muted">{slot === 1 ? '본인 선택' : '상대방 선택'}</p>
          {reports.length === 0 && (
            <p className="text-[10px] text-text-hint">사주 분석 먼저 필요</p>
          )}
        </button>
      );
    }

    const { ilgan, oheng } = getIlgan(person);
    return (
      <button
        onClick={() => setShowPicker(slot)}
        className="flex-1 card text-center py-5"
      >
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-2"
          style={{ background: 'rgba(27,42,74,0.06)' }}>
          <span className="text-h1 text-brand-navy">{person.name.charAt(0)}</span>
        </div>
        <p className="text-h3 text-text-primary">{person.name}</p>
        <p className="text-caption text-text-muted mt-0.5">
          {ilgan}({oheng}) 일간
        </p>
        <p className="text-[10px] text-text-hint mt-0.5">탭하여 변경</p>
      </button>
    );
  }

  const canSubmit = person1 && person2 && relation && person1.id !== person2.id
    && (relation !== '기타' || customRelation.trim().length > 0);

  return (
    <div className="min-h-screen bg-bg-page">
      <Header title="궁합" />
      <div className="px-5 pt-4 pb-[120px] space-y-6">

        <FadeIn>
          <h1 className="text-display text-text-primary leading-snug">
            두 사람의 사주로{'\n'}궁합을 확인해보세요
          </h1>
          <p className="text-body-sm text-text-muted mt-2">
            사주 원국의 오행 조합과 십성 관계를 분석해요
          </p>
        </FadeIn>

        {/* 프로필 선택 */}
        <FadeIn delay={0.05}>
          <div className="flex items-center gap-4">
            <PersonCard person={person1} slot={1} />

            <div className="flex-shrink-0">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="#C9A96E" fillOpacity="0.2" stroke="#C9A96E" strokeWidth="1.2" />
              </svg>
            </div>

            <PersonCard person={person2} slot={2} />
          </div>
        </FadeIn>

        {/* 관계 선택 */}
        <FadeIn delay={0.1}>
          <div>
            <p className="text-h3 text-text-primary mb-3">관계를 선택해주세요</p>
            <div className="flex flex-wrap gap-2">
              {RELATIONS.map((rel) => (
                <button
                  key={rel}
                  onClick={() => setRelation(rel)}
                  className={`chip ${relation === rel ? 'chip-active' : ''}`}
                >
                  {rel}
                </button>
              ))}
            </div>
            {/* 기타 선택 시 직접 입력 */}
            {relation === '기타' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
                <input
                  type="text"
                  value={customRelation}
                  onChange={(e) => setCustomRelation(e.target.value)}
                  placeholder="관계를 직접 입력해주세요 (예: 사업파트너)"
                  className="input-field w-full"
                  maxLength={20}
                />
              </motion.div>
            )}
          </div>
        </FadeIn>

        {/* 분석 포인트 미리보기 */}
        <FadeIn delay={0.15}>
          <div className="card space-y-3">
            <p className="text-label text-text-hint">궁합 분석에 포함되는 항목</p>
            {[
              { title: '오행 조화도', desc: '두 사람의 오행이 서로를 보완하는지 분석해요' },
              { title: '일간 관계', desc: '생(生)·극(剋)·합(合) 관계로 기본 궁합을 판단해요' },
              { title: '십성 시너지', desc: '서로에게 어떤 역할인지 (정관, 식신, 재성 등)' },
              { title: '시기별 궁합 변화', desc: '대운 흐름에 따라 관계가 어떻게 변하는지' },
              { title: '종합 궁합 점수', desc: '연애, 결혼, 직장 등 상황별 점수로 확인해요' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-2 flex-shrink-0" />
                <div>
                  <p className="text-label text-text-primary">{item.title}</p>
                  <p className="text-caption text-text-muted">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>

      {/* 하단 CTA */}
      <div className="sticky-cta-bottom">
        <Button
          fullWidth
          size="lg"
          variant={canSubmit ? 'gold' : 'secondary'}
          onClick={() => {
            if (!canSubmit) return;
            if (!spendBalance(1)) { toast.show('잔액이 부족해요', 'warning'); navigate('/charge', { state: { from: 'compat', message: '궁합 분석에 1운이 필요해요' } }); return; }
            toast.show('1운이 차감됐어요', 'info');
            const rel = relation === '기타' ? customRelation || '기타' : relation;
            navigate('/compat/result', { state: { person1, person2, relation: rel } });
          }}
        >
          궁합 보기 (1운)
        </Button>
        {!canSubmit && (
          <p className="text-center text-[10px] text-text-hint mt-2">
            {!person1 || !person2 ? '두 사람 모두 선택해주세요' : !relation ? '관계를 선택해주세요' : '같은 사람끼리는 궁합을 볼 수 없어요'}
          </p>
        )}
        {/* 향후 서비스 예고 — 확장 가능 구조 */}
        {/*
        <div className="mt-3 space-y-2">
          <p className="text-[10px] text-text-disabled text-center">추가 서비스 (준비 중)</p>
          <button disabled className="w-full card text-left py-3 px-4 opacity-50">
            <p className="text-label text-text-muted">재회운 분석</p>
            <p className="text-caption text-text-hint">이별 후 다시 만날 가능성을 분석해요</p>
          </button>
          <button disabled className="w-full card text-left py-3 px-4 opacity-50">
            <p className="text-label text-text-muted">결혼 시기 분석</p>
            <p className="text-caption text-text-hint">두 사람의 최적 결혼 시기를 알려드려요</p>
          </button>
        </div>
        */}
      </div>

      {/* 프로필 선택 바텀시트 */}
      {showPicker && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPicker(null)} />
          <motion.div
            className="relative w-full max-w-mobile mx-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="rounded-t-3xl px-5 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))]"
              style={{ background: 'var(--bg-card)' }}>
              <div className="w-10 h-1 rounded-full bg-border-light mx-auto mb-4" />
              <p className="text-h2 text-text-primary mb-4">
                {showPicker === 1 ? '본인' : '상대방'}을 선택하세요
              </p>

              {reports.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {reports.map((r) => {
                    const { ilgan, oheng } = getIlgan(r);
                    const isSelected = (showPicker === 1 ? person1?.id : person2?.id) === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          if (showPicker === 1) setPerson1(r);
                          else setPerson2(r);
                          setShowPicker(null);
                        }}
                        className={`w-full card text-left flex items-center gap-3 ${
                          isSelected ? 'border-2 border-brand-gold' : ''
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center">
                          <span className="text-h3 text-brand-navy">{r.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-h3 text-text-primary">{r.name}</p>
                          <p className="text-caption text-text-muted">
                            {r.input.birthYear}.{String(r.input.birthMonth).padStart(2,'0')}.{String(r.input.birthDay).padStart(2,'0')} · {ilgan}({oheng})
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-body-sm text-text-muted">분석한 사주가 없어요</p>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <Button fullWidth onClick={() => { setShowPicker(null); navigate('/input?new=1&from=compat'); }}>
                  새 사주 입력하기
                </Button>
                <button
                  onClick={() => setShowPicker(null)}
                  className="w-full py-2 text-caption text-text-muted text-center"
                >
                  닫기
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
