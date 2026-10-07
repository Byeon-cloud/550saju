import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { getProfiles, getMyProfile, type LocalReport } from '@/services/storage/localStore';
import { spendBalance, markPendingSpend } from '@/services/storage/localStore';
import { addRecentPartner, getRecentPartnerIds } from '@/services/storage/compatRecents';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CHEONGAN_OHENG } from '@/constants/oheng';
// Phase D'-4 Bundle 2 (#54) — mockup 진본 시각 정렬
import { EXTENSION_THEME, ExtensionHero } from './extension/_chrome';

const RELATIONS = ['연인', '배우자', '썸', '이별', '친구', '동료', '부모-자녀', '형제·자매', '기타'] as const;

export function CompatibilityPage() {
  usePageTitle('궁합');
  const navigate = useNavigate();
  // 매 렌더링마다 최신 프로필 조회 (InputPage에서 돌아왔을 때 갱신)
  const [profiles, setProfilesList] = useState(() => getProfiles());

  const myProfile = getMyProfile();
  const [person1, setPerson1] = useState<LocalReport | null>(myProfile || (profiles[0] as any) || null);
  const [person2, setPerson2] = useState<LocalReport | null>(null);
  const [relation, setRelation] = useState<string | null>(null);
  const toast = useToast();
  const [showPicker, setShowPicker] = useState<1 | 2 | null>(null);
  const [customRelation, setCustomRelation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // InputPage에서 /compat으로 복귀 시 → 최신 프로필을 person2에 자동 선택
  useEffect(() => {
    const freshProfiles = getProfiles();
    setProfilesList(freshProfiles);
    // person2가 비어있고, 방금 입력한 사주가 person1과 다르면 자동 선택
    if (!person2 && freshProfiles.length >= 2) {
      const latest = freshProfiles[0] as any;
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
          onClick={() => profiles.length > 0 ? setShowPicker(slot) : navigate('/input?from=compat')}
          className="flex-1 rounded-2xl border-2 border-dashed border-border py-6 flex flex-col items-center justify-center gap-2"
          style={{ background: 'var(--bg-surface)' }}
        >
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-text-hint flex items-center justify-center">
            <span className="text-2xl text-text-hint">+</span>
          </div>
          <p className="text-caption text-text-muted">{slot === 1 ? '본인 선택' : '상대방 선택'}</p>
          {profiles.length === 0 && (
            <p className="text-[11px] text-text-hint">사주 분석 먼저 필요</p>
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
        <p className="text-[11px] text-text-hint mt-0.5">탭하여 변경</p>
      </button>
    );
  }

  const canSubmit = person1 && person2 && relation && person1.id !== person2.id
    && (relation !== '기타' || customRelation.trim().length > 0);

  function handleSubmit() {
    if (!canSubmit) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (!spendBalance(1)) {
        toast.show('잔액이 부족해요', 'warning');
        navigate('/charge', { state: { from: 'compat', message: '궁합 분석에 1운이 필요해요' } });
        return;
      }
      // 측정 — 운 차감 성공 직후 (C1 · fire-and-forget)
      import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'compat', amount: 1 })).catch(() => {});
      // 2026-06-18 머니세이프 — 결과 페이지 이동/생성 중 앱 종료 시 부팅 reconcile 이 5분 후 자동환불.
      //   (CompatResultPage 가 결과 저장/실패환불 시 clearPendingSpendByType('compat') 로 해제)
      markPendingSpend('compat', 1);
      toast.show('1운이 차감됐어요', 'info');
      const rel = relation === '기타' ? customRelation || '기타' : relation;
      // P2-3 · 궁합 상대방 최근 목록 기록 (person2 = 상대방). MRU 최상단.
      if (person2?.id) addRecentPartner(person2.id);
      navigate('/compat/result', { state: { person1, person2, relation: rel } });
    } finally {
      // 네비게이션 후 페이지 전환되므로 ref만 300ms 뒤 풀어줌 (뒤로 돌아올 때 재시도 가능)
      setTimeout(() => { isSubmittingRef.current = false; setIsSubmitting(false); }, 300);
    }
  }

  const compatTheme = EXTENSION_THEME.compat;

  return (
    <div className="min-h-screen bg-bg-page">
      <Header title="궁합" />

      {/* Phase D'-4 Bundle 2 — ExtensionHero (合 인장 + 자주 그라디언트) */}
      <FadeIn>
        <ExtensionHero
          theme={compatTheme}
          crumb="사주500 · 더 알아볼 주제 · 궁합"
          sub="생년월일·시 두 분의 자료를 5가지 관점에서 비교합니다."
          seal="合"
        />
      </FadeIn>

      <div className="px-5 pt-4 pb-[120px] space-y-6">

        <FadeIn delay={0.04}>
          <h1 className="text-display text-text-primary leading-snug">
            두 사람의 사주로{'\n'}궁합을 확인해보세요
          </h1>
          <p className="text-body-sm text-text-muted mt-2">
            두 사람의 결이 얼마나 잘 맞는지 살펴봐요
          </p>
        </FadeIn>

        {/* 프로필 선택 */}
        <FadeIn delay={0.05}>
          <div className="flex items-center gap-4">
            <PersonCard person={person1} slot={1} />

            <div className="flex-shrink-0">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="#B8965A" fillOpacity="0.2" stroke="#B8965A" strokeWidth="1.2" />
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
            {/* 2026-10-04 — 결과에 실제로 나오는 항목만 안내 (예전 '시기별 변화·상황별 점수'는 결과에 없었음) */}
            {[
              { title: '두 사람이 맞물리는 자리', desc: '두 사주 글자 사이의 합·충을 찾아 끌림과 부딪힘의 이유를 짚어요' },
              { title: '5가지 궁합 점수', desc: '성격 · 가치관 · 소통 · 감정 · 미래를 각각 점수로 보여드려요' },
              { title: '오행 조화', desc: '서로에게 없는 기운을 채워주는 사이인지 살펴봐요' },
              { title: '강점과 숙제', desc: '잘 맞는 점 3가지, 조심할 점 3가지와 구체적인 조언' },
              { title: '앞으로 1~3년', desc: '관계가 어떤 방향으로 흘러갈지 짚어드려요' },
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

      {/* P0-D · 출처 + 디스클레이머 — 하단 sticky 위가 아닌 본문 끝에 배치 (sticky bar 가 콘텐츠 가리는 문제 해결) */}
      <div className="px-5 pt-4 pb-[120px] mt-6">
        <div className="text-center space-y-1">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반
          </p>
          <p className="text-[11px] italic" style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
            사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
            <br />
            의료·법률·재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
          </p>
        </div>
      </div>

      {/* 하단 CTA — 다른 1운 페이지(대운/월운/토정비결)와 동일 구조 */}
      <div className="sticky-cta-bottom">
        <Button
          fullWidth
          size="lg"
          variant="gold"
          disabled={!canSubmit || isSubmitting}
          loading={isSubmitting}
          onClick={handleSubmit}
        >
          궁합 보기 (1운)
        </Button>
        {!canSubmit && (
          <p className="text-center text-[11px] text-text-hint mt-2">
            {!person1 || !person2 ? '두 사람 모두 선택해주세요' : !relation ? '관계를 선택해주세요' : '같은 사람끼리는 궁합을 볼 수 없어요'}
          </p>
        )}
        {/* 향후 서비스 예고 — 확장 가능 구조 */}
        {/*
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-text-disabled text-center">추가 서비스 (준비 중)</p>
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

              {/* P2-3 · 최근 궁합 상대방 quick-pick (slot 2 전용) */}
              {showPicker === 2 && (() => {
                const validIds = new Set(profiles.map((p) => p.id));
                const recentIds = getRecentPartnerIds(validIds);
                // 본인(slot 1)으로 선택된 프로필은 제외 — 동일인 궁합 방지
                const filtered = recentIds.filter((id) => id !== person1?.id);
                if (filtered.length === 0) return null;
                return (
                  <div className="mb-4">
                    <p className="text-label text-text-hint mb-2">최근 본 상대방</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {filtered.map((id) => {
                        const p = profiles.find((pr) => pr.id === id) as LocalReport | undefined;
                        if (!p) return null;
                        const { ilgan, oheng } = getIlgan(p);
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              setPerson2(p);
                              setShowPicker(null);
                            }}
                            className="flex-shrink-0 rounded-xl px-3 py-2 flex items-center gap-2"
                            style={{
                              background: 'rgba(184,150,90,0.08)',
                              border: '1px solid rgba(184,150,90,0.25)',
                            }}
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(184,150,90,0.15)' }}
                            >
                              <span className="text-label font-bold" style={{ color: '#8C6D3D' }}>
                                {p.name.charAt(0)}
                              </span>
                            </div>
                            <div className="text-left min-w-0">
                              <p className="text-caption font-bold text-text-primary leading-tight">
                                {p.name}
                              </p>
                              <p className="text-[11px] text-text-muted leading-tight">
                                {ilgan}({oheng})
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {profiles.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {profiles.map((r) => {
                    const { ilgan, oheng } = getIlgan(r as any);
                    const isSelected = (showPicker === 1 ? person1?.id : person2?.id) === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          if (showPicker === 1) setPerson1(r as any);
                          else setPerson2(r as any);
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
