import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { calculateSaju } from '@/services/saju/calculator';
import { useSajuContext } from '@/contexts/SajuContext';
import { CHEONGAN_OHENG, OHENG_MAP } from '@/constants/oheng';
import type { CalendarType, Gender, SajuInput, Pillar } from '@/types/saju';
import type { Relation } from '@/types/user';
import { saveReport, generateId, getProfiles, saveProfileDirect, spendBalance, setMyProfile, deleteReport } from '@/services/storage/localStore';
import type { LocalReport } from '@/services/storage/localStore';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useInputDraft, type InputDraftSnapshot } from '@/hooks/useInputDraft';
import { triggerPromotionEvent, PROMO_EVENTS } from '@/services/toss/tossPromotion';
import { BannerAd as BannerAdStep5 } from '@/components/ads/BannerAd';

const TOTAL_STEPS = 5;

const RELATIONS: { value: Relation; label: string }[] = [
  { value: '본인', label: '본인' },
  { value: '친구', label: '친구' },
  { value: '가족', label: '가족' },
  { value: '연인', label: '연인' },
  { value: '기타', label: '직접입력' },
];

const SHIJU_OPTIONS = [
  { label: '밤 11시 ~ 새벽 1시', sub: '자시', hour: 0 },
  { label: '새벽 1시 ~ 3시', sub: '축시', hour: 1 },
  { label: '새벽 3시 ~ 5시', sub: '인시', hour: 3 },
  { label: '아침 5시 ~ 7시', sub: '묘시', hour: 5 },
  { label: '아침 7시 ~ 9시', sub: '진시', hour: 7 },
  { label: '오전 9시 ~ 11시', sub: '사시', hour: 9 },
  { label: '낮 11시 ~ 오후 1시', sub: '오시', hour: 11 },
  { label: '오후 1시 ~ 3시', sub: '미시', hour: 13 },
  { label: '오후 3시 ~ 5시', sub: '신시', hour: 15 },
  { label: '저녁 5시 ~ 7시', sub: '유시', hour: 17 },
  { label: '저녁 7시 ~ 9시', sub: '술시', hour: 19 },
  { label: '밤 9시 ~ 11시', sub: '해시', hour: 21 },
];
const SHIJU_HOURS = SHIJU_OPTIONS.map(o => o.hour);

export function InputPage() {
  usePageTitle('사주 입력');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { setInput, setSajuData } = useSajuContext();

  // ?new=1 파라미터 있으면 Step 0 건너뛰고 바로 새 입력
  const isForceNew = window.location.search.includes('new=1');

  // 보관함에서 프로필 선택하여 진입한 경우
  const selectedProfile = (location.state as any)?.selectedProfile as LocalReport | undefined;

  const existingProfiles = useMemo(() => getProfiles(), []);

  const [step, setStep] = useState(
    selectedProfile ? 5 : isForceNew ? 1 : existingProfiles.length > 0 ? 0 : 1
  );

  /**
   * P2-2 · /input 재진입 — 기존 프로필 "수정" 모드
   *   근거: 인수인계 §7.P2-2 "덮어쓰기 vs 새 프로필 추가 명확하지 않음"
   *   수정 진입 시 원래 reportId 를 기억 → Step5 진입 시 기존 report 삭제 후 새 ID 로 재저장
   *   (saveProfileDirect 는 이름+생일 키로 dedup 내장, 자동 덮어쓰기)
   */
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const [name, setName] = useState(selectedProfile?.name || '');
  const [relation, setRelation] = useState<Relation>((selectedProfile?.input?.relation as Relation) || '본인');
  const [birthYear, setBirthYear] = useState(selectedProfile ? String(selectedProfile.input.birthYear) : '');
  const [birthMonth, setBirthMonth] = useState(selectedProfile ? String(selectedProfile.input.birthMonth) : '');
  const [birthDay, setBirthDay] = useState(selectedProfile ? String(selectedProfile.input.birthDay) : '');
  const [calendarType, setCalendarType] = useState<CalendarType>(selectedProfile?.input?.calendarType || 'solar');
  const [gender, setGender] = useState<Gender | null>(selectedProfile?.input?.gender || null);
  const [knowsTime, setKnowsTime] = useState<boolean | null>(() => {
    if (selectedProfile) {
      return selectedProfile.input.hasBirthTime ? true : false;
    }
    return null;
  });
  const [timeIndex, setTimeIndex] = useState<number | null>(() => {
    if (selectedProfile?.input?.hasBirthTime && selectedProfile.input.birthHour !== undefined) {
      const idx = SHIJU_HOURS.indexOf(selectedProfile.input.birthHour);
      return idx >= 0 ? idx : null;
    }
    return null;
  });
  // Step6 제거됨 — 상황질문은 상세분석 시 선택적

  const canNext = (() => {
    switch (step) {
      case 0: return true; // 프로필 선택 화면
      case 1: return name.trim().length > 0;
      case 2: return birthYear && birthMonth && birthDay;
      case 3: return gender !== null;
      case 4: return knowsTime !== null && (knowsTime === false || timeIndex !== null);
      case 5: return true;
      default: return false;
    }
  })();

  const sajuInput: SajuInput | null = useMemo(() => {
    if (!birthYear || !birthMonth || !birthDay || !gender) return null;
    const input: SajuInput = {
      name,
      relation,
      birthYear: Number(birthYear),
      birthMonth: Number(birthMonth),
      birthDay: Number(birthDay),
      calendarType,
      gender,
      hasBirthTime: knowsTime === true && timeIndex !== null,
    };
    if (input.hasBirthTime && timeIndex !== null) {
      input.birthHour = SHIJU_HOURS[timeIndex];
      input.birthMinute = 0;
    }
    return input;
  }, [name, birthYear, birthMonth, birthDay, calendarType, gender, knowsTime, timeIndex]);

  const sajuData = useMemo(() => {
    if (!sajuInput || step < 5) return null;
    try {
      return calculateSaju(sajuInput);
    } catch {
      return null;
    }
  }, [sajuInput, step]);

  /** 더블클릭 방지 — 분석 시작 후 재클릭 차단 */
  const isAnalyzingRef = useRef(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  /**
   * E40 · 입력 임시저장 (draft)
   *   근거: docs/prd/P2_Path_E_티켓_트래커.md E40
   *   - selectedProfile / force new 경로는 draft 무관 → enabled=false
   *   - 마운트 시 draft 있으면 "이어쓰기/새로 작성" Modal
   */
  const draftEnabled = !selectedProfile;
  const draftSnapshot: InputDraftSnapshot = useMemo(
    () => ({ name, relation, birthYear, birthMonth, birthDay, calendarType, gender, knowsTime, timeIndex, step }),
    [name, relation, birthYear, birthMonth, birthDay, calendarType, gender, knowsTime, timeIndex, step],
  );
  const { hasInitialDraft, loadDraft, clearDraft } = useInputDraft({
    enabled: draftEnabled,
    snapshot: draftSnapshot,
  });
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  useEffect(() => {
    // 마운트 시 draft 있고 selectedProfile 없을 때만 한 번 제시
    if (hasInitialDraft && draftEnabled && !isForceNew) {
      setDraftModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDraftContinue() {
    const d = loadDraft();
    if (!d) { setDraftModalOpen(false); return; }
    setName(d.name);
    setRelation(d.relation);
    setBirthYear(d.birthYear);
    setBirthMonth(d.birthMonth);
    setBirthDay(d.birthDay);
    setCalendarType(d.calendarType);
    setGender(d.gender);
    setKnowsTime(d.knowsTime);
    setTimeIndex(d.timeIndex);
    // step 복원 — Step5 미도달 구간까지만 복원 (사주 계산은 필요 데이터 갖춘 시점에만 수행)
    const restoreStep = Math.min(Math.max(d.step, 1), 4);
    setStep(restoreStep);
    setDraftModalOpen(false);
  }

  function handleDraftDiscard() {
    clearDraft();
    setDraftModalOpen(false);
  }

  /** 상세 분석 시작 — 1운 차감 + 로딩 */
  function startAnalysis() {
    // 더블클릭 방지: ref (즉시 차단) + state (UI 반영)
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    if (!spendBalance(1)) {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      toast.show('잔액이 부족해요. 충전이 필요해요', 'warning');
      navigate('/charge', { state: { from: 'input', message: '상세 분석에 1운이 필요해요' } });
      return;
    }
    // 사주 데이터는 Step5 진입 시 이미 저장됨 (handleNext)
    // 여기서는 Context 설정 + 로딩 이동만
    if (sajuData && sajuInput) {
      setInput(sajuInput);
      setSajuData(sajuData);
      triggerPromotionEvent(PROMO_EVENTS.FIRST_SAJU);
      navigate('/loading');
    } else {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }

  function handleNext() {
    if (step < TOTAL_STEPS) {
      const nextStep = step + 1;
      setStep(nextStep);

      // Step5(사주팔자 확인) 진입 시 — 무료 결과를 로컬에 저장
      if (nextStep === TOTAL_STEPS && sajuInput) {
        const data = calculateSaju(sajuInput);
        setInput(sajuInput);
        setSajuData(data);
        // P2-2 · 수정 모드면 기존 report 제거 후 새 ID 로 재저장
        if (editingProfileId) {
          deleteReport(editingProfileId);
          setEditingProfileId(null);
        }
        const reportId = generateId();
        const report: LocalReport = {
          id: reportId,
          name: name || '이름 없음',
          input: sajuInput,
          sajuData: data,
          createdAt: new Date().toISOString(),
          type: 'free', // 무료 사주팔자 확인
        };
        saveReport(report);
        // 프로필도 독립 저장 (리포트 삭제해도 프로필 유지)
        saveProfileDirect({
          id: reportId,
          name: name || '이름 없음',
          input: sajuInput,
          sajuData: data,
          relation: sajuInput.relation,
          createdAt: new Date().toISOString(),
        });
        // 본인 사주면 "내 프로필"로 고정
        if (!sajuInput.relation || sajuInput.relation === '본인') {
          setMyProfile(report.id);
        }

        // E40 · 입력 완결 → 임시저장 정리
        clearDraft();

        // 궁합에서 왔으면 사주 저장 후 궁합으로 복귀
        const fromParam = new URLSearchParams(window.location.search).get('from');
        if (fromParam === 'compat') {
          navigate('/compat', { replace: true });
          return;
        }
      }
    }
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
    else if (step === 1 && existingProfiles.length > 0) {
      // Step1 → Step0 복귀 시 수정 세션 종료 (P2-2)
      setEditingProfileId(null);
      setStep(0);
    }
    else navigate(-1);
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-page relative overflow-hidden">
      {/* 배경 장식 — 미묘한 태극 무늬 */}
      <div className="absolute top-20 -right-16 w-64 h-64 rounded-full opacity-[0.02] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #B8965A, transparent 70%)' }} />
      <div className="absolute bottom-40 -left-20 w-48 h-48 rounded-full opacity-[0.015] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #1B2A4A, transparent 70%)' }} />

      <Header title={editingProfileId ? '사주 수정' : '사주 입력'} />

      {/* Step Indicator — Figma 6바 */}
      <div className="flex items-center gap-1 px-4 py-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? 'bg-brand-primary' : 'bg-border-light'
            }`}
          />
        ))}
      </div>

      {/* 콘텐츠 — 하단 CTA 높이(100px) + 여유(20px) 확보 */}
      <div className="flex-1 px-4 pt-6 pb-[180px] overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: step === 0 ? 0 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {/* Step 0: 기존 프로필 선택 */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-display text-text-primary">누구의 사주를{'\n'}볼까요?</h2>
                <p className="text-body-sm text-text-muted">이전에 입력한 정보를 선택하거나, 새로 입력할 수 있어요.</p>

                <div className="space-y-2">
                  {existingProfiles.map((r) => {
                    const il = r.sajuData.pillars[2]?.천간 || '';
                    const oh = il ? CHEONGAN_OHENG[il] : '';
                    const rel = r.input.relation || '본인';

                    /** 프로필 선택 — 기존 데이터 pre-fill 후 Step5 (사주팔자 확인) */
                    const handleSelect = () => {
                      setEditingProfileId(null); // 수정 세션 흔적 정리
                      setName(r.name);
                      setRelation(r.input.relation as any || '본인');
                      setBirthYear(String(r.input.birthYear));
                      setBirthMonth(String(r.input.birthMonth));
                      setBirthDay(String(r.input.birthDay));
                      setGender(r.input.gender);
                      if (r.input.hasBirthTime && r.input.birthHour !== undefined) {
                        setKnowsTime(true);
                        const idx = SHIJU_HOURS.indexOf(r.input.birthHour);
                        setTimeIndex(idx >= 0 ? idx : null);
                      } else {
                        setKnowsTime(false);
                      }
                      // 궁합에서 왔으면 사주 저장 후 궁합으로 복귀
                      const fromParam = new URLSearchParams(window.location.search).get('from');
                      if (fromParam === 'compat') {
                        navigate('/compat', { replace: true });
                        return;
                      }
                      setStep(5);
                    };

                    /**
                     * P2-2 · 수정 — pre-fill 후 Step1 부터 재입력
                     *   editingProfileId 설정 → Step5 진입 시 기존 report 교체
                     */
                    const handleEdit = () => {
                      setName(r.name);
                      setRelation(r.input.relation as any || '본인');
                      setBirthYear(String(r.input.birthYear));
                      setBirthMonth(String(r.input.birthMonth));
                      setBirthDay(String(r.input.birthDay));
                      setCalendarType(r.input.calendarType || 'solar');
                      setGender(r.input.gender);
                      if (r.input.hasBirthTime && r.input.birthHour !== undefined) {
                        setKnowsTime(true);
                        const idx = SHIJU_HOURS.indexOf(r.input.birthHour);
                        setTimeIndex(idx >= 0 ? idx : null);
                      } else {
                        setKnowsTime(false);
                        setTimeIndex(null);
                      }
                      setEditingProfileId(r.id);
                      setStep(1);
                    };

                    return (
                      <div key={r.id} className="card w-full py-4 px-4">
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSelect}
                            className="flex items-center gap-3 flex-1 text-left min-w-0"
                          >
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: rel === '본인' ? 'rgba(27,42,74,0.08)' : 'rgba(184,150,90,0.10)' }}>
                              <span className="text-h2 font-bold" style={{ color: rel === '본인' ? '#1B2A4A' : '#B8965A' }}>
                                {r.name.charAt(0)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-h2 text-text-primary truncate">{r.name}</p>
                                <span className="text-caption text-text-hint flex-shrink-0">{rel}</span>
                              </div>
                              <p className="text-body-sm text-text-muted mt-0.5 truncate">
                                {r.input.birthYear}.{String(r.input.birthMonth).padStart(2,'0')}.{String(r.input.birthDay).padStart(2,'0')}
                                {il ? ` · ${il}(${oh})` : ''}
                              </p>
                            </div>
                          </motion.button>
                          {/* P2-2 · 수정 entry point — 44x44 최소 터치 영역 (WCAG) */}
                          <button
                            type="button"
                            onClick={handleEdit}
                            aria-label={`${r.name} 프로필 수정`}
                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                            style={{ background: 'rgba(184,150,90,0.08)' }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8965A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    // 새 입력 진입 — 수정 세션 및 필드 초기화
                    setEditingProfileId(null);
                    setName('');
                    setBirthYear(''); setBirthMonth(''); setBirthDay('');
                    setGender(null);
                    setKnowsTime(null); setTimeIndex(null);
                    setStep(1);
                  }}
                  className="w-full card text-center py-5 border-2 border-dashed border-border"
                >
                  <p className="text-h3 text-text-primary">+ 새 사주 입력하기</p>
                  <p className="text-caption text-text-muted mt-1">새로운 사람의 사주를 입력해요</p>
                </button>
              </div>
            )}
            {step === 1 && <Step1 name={name} setName={setName} relation={relation} setRelation={setRelation} onAutoNext={() => {}} />}
            {step === 2 && <Step2 birthYear={birthYear} setBirthYear={setBirthYear} birthMonth={birthMonth} setBirthMonth={setBirthMonth} birthDay={birthDay} setBirthDay={setBirthDay} calendarType={calendarType} setCalendarType={setCalendarType} />}
            {step === 3 && <Step3 gender={gender} setGender={setGender} onAutoNext={() => setStep(4)} />}
            {step === 4 && <Step4 knowsTime={knowsTime} setKnowsTime={setKnowsTime} timeIndex={timeIndex} setTimeIndex={setTimeIndex} />}
            {step === 5 && sajuData && sajuInput && (
              <div id="step5-content">
                <Step5 sajuData={sajuData} name={name} input={sajuInput} />
                {/* 배너 광고 — 앱인토스에서만 */}
                <div className="mt-4"><BannerAdStep5 /></div>
              </div>
            )}
            {/* Step6 제거 — 상황질문은 상세분석 시작 후 로딩 중에 물어볼 수 있음 */}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* E40 · 이어쓰기 Modal — 마운트 시 draft 존재하면 1회 제시 */}
      <Modal isOpen={draftModalOpen} onClose={handleDraftDiscard} title="이어쓰기 하시겠어요?">
        <div className="space-y-4">
          <p className="text-body-sm text-text-muted leading-relaxed">
            이전에 입력하던 내용이 있어요. 이어서 마저 작성할까요?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" onClick={handleDraftDiscard} className="flex-1">
              새로 작성
            </Button>
            <Button size="lg" onClick={handleDraftContinue} className="flex-1">
              이어쓰기
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bottom CTA — step 0(프로필 선택)에서는 숨김 */}
      {step > 0 && (
      <div className="sticky-cta-bottom">
        {step < TOTAL_STEPS ? (
          /* Step 1~4: 일반 다음 버튼 */
          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="ghost" size="lg" onClick={handleBack} className="w-20">이전</Button>
            )}
            <Button fullWidth size="lg" onClick={handleNext} disabled={!canNext}>
              {step === 1 ? '다음으로' : step === 2 ? '생년월일 입력 완료' : step === 3 ? '다음으로' : '다음으로'}
            </Button>
          </div>
        ) : (
          /* Step 5: 사주팔자 결과 — 상세분석 + 공유 + 사진저장 */
          <div className="space-y-2">
            <Button fullWidth size="lg" variant="gold" onClick={startAnalysis} disabled={isAnalyzing}>
              {isAnalyzing ? '분석 준비 중...' : '상세 분석 받기 (1운)'}
            </Button>
            <p className="text-center text-[10px] text-text-hint">
              성격, 직업, 연애, 재물, 건강 등 12가지 심층 분석
            </p>
            <div className="flex gap-2 mt-1">
              <button
                onClick={async () => {
                  try {
                    const { shareResult } = await import('@/utils/share');
                    await shareResult({ name: name || '사주팔자', reportId: 'free' });
                  } catch {
                    toast.show('공유에 실패했어요', 'warning');
                  }
                }}
                className="flex-1 py-3 rounded-xl text-caption font-bold text-white"
                style={{ background: '#B8965A' }}
              >
                친구에게 공유하고 1운 받기
              </button>
              <button
                onClick={async () => {
                  try {
                    const html2canvas = (await import('html2canvas')).default;
                    const target = document.getElementById('step5-content') as HTMLElement;
                    if (!target) { toast.show('캡처 영역을 찾을 수 없어요', 'warning'); return; }
                    toast.show('이미지를 준비하고 있어요...', 'info');
                    const canvas = await html2canvas(target, { backgroundColor: '#F4F5F8', scale: 2, useCORS: true });
                    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
                      canvas.toBlob(async (blob) => {
                        if (!blob) return;
                        const file = new File([blob], `사주500_${name || '사주팔자'}.png`, { type: 'image/png' });
                        try {
                          await navigator.share({ files: [file], title: '내 사주팔자 — 사주500' });
                          toast.show('공유시트에서 "이미지 저장"을 눌러주세요', 'info');
                        } catch { /* 취소 */ }
                      }, 'image/png');
                    } else {
                      const link = document.createElement('a');
                      link.download = `사주500_${name || '사주팔자'}.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                      toast.show('사진이 저장됐어요!', 'success');
                    }
                  } catch {
                    toast.show('화면을 길게 눌러서 저장해주세요', 'info');
                  }
                }}
                className="w-20 py-3 rounded-xl text-caption font-semibold text-text-muted bg-bg-surface border border-border-light"
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function StepTitle({ stepNum, title, sub }: { stepNum: number; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < stepNum ? 'bg-brand-gold' : 'bg-border-light'}`} />
          ))}
        </div>
        <span className="text-caption text-text-hint">{stepNum}/{TOTAL_STEPS}</span>
      </div>
      <h2 className="text-display text-text-primary whitespace-pre-line leading-snug">{title}</h2>
      {sub && <p className="text-body-sm text-text-muted mt-2 leading-relaxed">{sub}</p>}
    </div>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`chip ${selected ? 'chip-active' : ''}`}>
      {label}
    </button>
  );
}

function Step1({ name, setName, relation, setRelation, onAutoNext }: {
  name: string; setName: (v: string) => void; relation: Relation; setRelation: (v: Relation) => void; onAutoNext: () => void;
}) {
  function selectRelation(v: Relation) {
    setRelation(v);
    // 이름이 이미 입력된 상태라면 관계 선택 시 자동으로 다음 스텝
    if (name.trim().length > 0) {
      setTimeout(() => onAutoNext(), 200);
    }
  }

  return (
    <>
      <StepTitle stepNum={1} title="이름을 알려주세요" sub="사주 분석 결과에 표시될 이름이에요." />
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력해주세요" autoFocus
        className="w-full h-[52px] px-5 rounded-xl input-field text-h3 transition-colors"
      />
      <p className="text-label text-text-secondary mt-6 mb-3 font-bold">누구의 사주를 볼까요?</p>
      <div className="flex flex-wrap gap-2">
        {RELATIONS.map((r) => <Chip key={r.value} label={r.label} selected={relation === r.value} onClick={() => selectRelation(r.value)} />)}
      </div>
    </>
  );
}

function Step2({ birthYear, setBirthYear, birthMonth, setBirthMonth, birthDay, setBirthDay, calendarType, setCalendarType }: {
  birthYear: string; setBirthYear: (v: string) => void; birthMonth: string; setBirthMonth: (v: string) => void;
  birthDay: string; setBirthDay: (v: string) => void; calendarType: CalendarType; setCalendarType: (v: CalendarType) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <>
      <StepTitle stepNum={2} title="생년월일을 알려주세요" sub="양력 기준으로 선택해주세요. 음력이라면 아래에서 변경할 수 있어요." />

      {/* 양력/음력 선택 */}
      <div className="flex gap-2 mb-6">
        {(['solar', 'lunar', 'lunar_leap'] as CalendarType[]).map((ct) => (
          <Chip key={ct} label={ct === 'solar' ? '양력' : ct === 'lunar' ? '음력' : '윤달'} selected={calendarType === ct} onClick={() => setCalendarType(ct)} />
        ))}
      </div>

      {/* 드롭다운 3개 — 년/월/일 */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-caption text-text-muted mb-1.5 block font-semibold">출생 년도</label>
          <select
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="input-field w-full h-[52px] text-h3 text-center appearance-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238892A4\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
          >
            <option value="">년도</option>
            {years.map((y) => <option key={y} value={String(y)}>{y}년</option>)}
          </select>
        </div>
        <div className="w-[90px]">
          <label className="text-caption text-text-muted mb-1.5 block font-semibold">월</label>
          <select
            value={birthMonth}
            onChange={(e) => setBirthMonth(e.target.value)}
            className="input-field w-full h-[52px] text-h3 text-center appearance-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238892A4\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
          >
            <option value="">월</option>
            {months.map((m) => <option key={m} value={String(m)}>{m}월</option>)}
          </select>
        </div>
        <div className="w-[90px]">
          <label className="text-caption text-text-muted mb-1.5 block font-semibold">일</label>
          <select
            value={birthDay}
            onChange={(e) => setBirthDay(e.target.value)}
            className="input-field w-full h-[52px] text-h3 text-center appearance-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238892A4\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
          >
            <option value="">일</option>
            {days.map((d) => <option key={d} value={String(d)}>{d}일</option>)}
          </select>
        </div>
      </div>
    </>
  );
}

function Step3({ gender, setGender, onAutoNext }: { gender: Gender | null; setGender: (v: Gender) => void; onAutoNext: () => void }) {
  return (
    <>
      <StepTitle stepNum={3} title="성별을 알려주세요" sub="사주에서 대운의 방향이 성별에 따라 달라져요." />
      <div className="flex gap-3">
        {([['male', '남성'], ['female', '여성']] as const).map(([val, label]) => (
          <button key={val} onClick={() => { setGender(val as Gender); setTimeout(onAutoNext, 200); }}
            className={`flex-1 select-card ${gender === val ? 'select-card-active' : ''}`}>
            <div className="w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center"
              style={{ background: val === 'male' ? 'rgba(27,42,74,0.08)' : 'rgba(184,150,90,0.1)' }}>
              <span className="text-[14px] font-black" style={{ color: val === 'male' ? '#1B2A4A' : '#B8965A' }}>
                {val === 'male' ? '乾' : '坤'}
              </span>
            </div>
            <span className="text-h2 text-text-primary">{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Step4({ knowsTime, setKnowsTime, timeIndex, setTimeIndex }: {
  knowsTime: boolean | null; setKnowsTime: (v: boolean) => void; timeIndex: number | null; setTimeIndex: (v: number | null) => void;
}) {
  const [tipOpen, setTipOpen] = useState(false);
  return (
    <>
      <StepTitle stepNum={4} title="출생시간을 알고 계신가요?" sub="시간 모르면 하루의 큰 흐름까지는 정확히 풀립니다. 시(時)까지 있으면 개인별 미세 조율이 더해져요." />
      <div className="flex gap-3 mb-6">
        <button onClick={() => setKnowsTime(true)}
          className={`flex-1 select-card ${knowsTime === true ? 'select-card-active' : ''}`}>
          <span className="text-[14px] font-black text-brand-navy">時</span>
          <span className="text-h3 text-text-primary">알아요</span>
          <span className="text-tiny text-text-muted">12섹션 · 개인 미세 조율</span>
        </button>
        <button onClick={() => { setKnowsTime(false); setTimeIndex(null); }}
          className={`flex-1 select-card ${knowsTime === false ? 'select-card-active' : ''}`}>
          <span className="text-[14px] font-bold text-text-hint">--</span>
          <span className="text-h3 text-text-primary">몰라요</span>
          <span className="text-tiny text-text-muted">10섹션 · 큰 흐름</span>
        </button>
      </div>
      {knowsTime && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }}>
          <p className="text-label text-text-primary font-bold mb-3">출생 시간대를 선택해주세요</p>
          <div className="grid grid-cols-2 gap-2">
            {SHIJU_OPTIONS.map((opt, i) => (
              <button key={i} onClick={() => { setTimeIndex(i); }}
                className={`text-left px-4 py-3 rounded-xl transition-all ${
                  timeIndex === i
                    ? 'bg-brand-navy text-white border-2 border-brand-gold'
                    : 'bg-white border border-border-light'
                }`}>
                <p className={`text-body-sm font-semibold ${timeIndex === i ? 'text-white' : 'text-text-primary'}`}>
                  {opt.label}
                </p>
                <p className={`text-[10px] mt-0.5 ${timeIndex === i ? 'text-white/50' : 'text-text-hint'}`}>
                  {opt.sub}
                </p>
              </button>
            ))}
          </div>
          {timeIndex !== null && (
            <>
              <p className="text-caption text-text-muted mt-3 text-center">
                선택: <span className="font-semibold text-text-primary">{SHIJU_OPTIONS[timeIndex].label}</span>
                <span className="text-text-hint ml-1">({SHIJU_OPTIONS[timeIndex].sub})</span>
              </p>
              {/* P1-8 · 한국 기준시 ±30분 보정 안내 배너 */}
              <div className="mt-3 rounded-xl p-3 flex items-start gap-2"
                style={{ background: 'rgba(184,150,90,0.10)', border: '1px solid rgba(184,150,90,0.25)' }}>
                {/* 2026-04-22: 시계 이모지(🕐) → 한자 時 로 교체 (이모지 금지 원칙) */}
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'rgba(184,150,90,0.20)',
                    color: '#7F6B4E',
                    fontSize: 11,
                    fontWeight: 900,
                    fontFamily: "'Noto Serif KR', serif",
                    lineHeight: 1,
                  }}
                >時</span>
                <p className="text-[12px] leading-[1.6]" style={{ color: '#3D3D3D' }}>
                  한국은 1961년부터 일본 표준시(UTC+9)를 사용해
                  <strong> 실제 태양시와 약 ±30분 차이</strong>가 납니다.
                  사주500은 이를 <strong>자동으로 보정</strong>해서 계산해요.
                </p>
              </div>
            </>
          )}
        </motion.div>
      )}
      {/* 팁 토글 — 왜 시간까지 필요한가 */}
      <div className="mt-5 rounded-xl border border-border-light bg-white overflow-hidden">
        <button type="button" onClick={() => setTipOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left">
          <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[14px] font-black"
            style={{ background: 'rgba(184,150,90,0.18)', color: '#7F6B4E', fontFamily: "'Noto Serif KR', serif" }}>時</span>
          <span className="flex-1 text-body-sm font-bold text-text-primary">왜 태어난 시간까지 필요한가요?</span>
          <span className="text-text-hint" style={{ transform: tipOpen ? 'rotate(180deg)' : 'none', transition: '.2s' }}>▼</span>
        </button>
        {tipOpen && (
          <div className="px-4 pb-4 pt-3 border-t border-border-light text-body-sm leading-[1.7] text-text-secondary space-y-2">
            <p>
              사주는 <strong>연·월·일·시</strong> 네 기둥으로 이루어집니다. 그중 <strong>시주(時柱)</strong>는 개인의{' '}
              <strong>직업 성향·말년 운·잠재력</strong>을 읽는 축입니다. 시주가 없어도 하루의 큰 흐름은 정확히 풀리지만,
              시주가 있으면 개인별 미세 결까지 읽어드립니다.
            </p>
            <p>
              출생 시를 정확히 기억하지 못하시면 어머님께 여쭙거나, 출생증명서의 시각을 확인해 주세요.
              대략 <strong>두 시간 범위 안</strong>만 알아도 시주 추정이 가능합니다.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

const PILLAR_LABELS: Record<string, { ko: string; hanja: string }> = {
  year: { ko: '년주', hanja: '年柱' },
  month: { ko: '월주', hanja: '月柱' },
  day: { ko: '일주', hanja: '日柱' },
  time: { ko: '시주', hanja: '時柱' },
};

function MiniPillarCard({ pillar }: { pillar: Pillar }) {
  const oheng = CHEONGAN_OHENG[pillar.천간];
  const info = oheng ? OHENG_MAP[oheng] : null;
  const label = PILLAR_LABELS[pillar.position] || { ko: '', hanja: '' };
  const isDayPillar = pillar.position === 'day';

  if (!pillar.available) {
    return (
      <div className="flex-1 rounded-xl border-2 border-dashed border-border bg-bg-surface flex flex-col items-center justify-center py-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-bg-surface/60 flex flex-col items-center justify-center">
          <span className="text-[10px] text-text-hint">{label.ko}</span>
          <span className="text-tiny text-text-muted mt-1">미입력</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 card-emphasis flex flex-col items-center py-3 gap-1 ${isDayPillar ? 'ring-2 ring-brand-gold/40' : ''}`}>
      <span className="text-[10px] font-bold text-text-hint">{label.ko}<span className="text-text-disabled ml-0.5">{label.hanja}</span></span>
      <span className="text-2xl font-black" style={{ color: info?.colorDark }}>{pillar.천간}</span>
      <span className="text-tiny font-bold" style={{ color: info?.color }}>{pillar.천간읽기} · {oheng}</span>
      <div className="w-full h-px bg-gradient-to-r from-transparent via-brand-secondary to-transparent my-1" />
      <span className="text-2xl font-black" style={{ color: OHENG_MAP[pillar.지지오행]?.colorDark }}>{pillar.지지}</span>
      <span className="text-tiny font-bold" style={{ color: OHENG_MAP[pillar.지지오행]?.color }}>{pillar.지지읽기} · {pillar.지지오행}</span>
    </div>
  );
}

// 천간 성격 플래시카드 / 오행 인사이트 — 미승인 피쳐로 제거됨 (2026-04-18, 준기 결정)
//   사유: 스펙에 없는 추가 기능. 무료 aha moment 가치는 인정하나,
//         별도 PRD 없이 InputPage 내부에 임베드되어 있어 Brand voice/톤 검증 미통과.
//         재도입 시 별도 PRD(브랜드 컴포넌트로 컴포넌트화 + 한자/카피 조화 적용) 필요.

function Step5({ sajuData, name, input }: { sajuData: import('@/types/saju').SajuData; name: string; input: SajuInput }) {
  const yearStr = `${input.birthYear}.${String(input.birthMonth).padStart(2, '0')}.${String(input.birthDay).padStart(2, '0')}`;
  const elements = sajuData.elements;
  const total = Object.values(elements).reduce((a: number, b: number) => a + b, 0) || 1;
  const ilgan = sajuData.pillars[2]?.천간 || '';
  const ilganKr = sajuData.pillars[2]?.천간읽기 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';

  // 오행별 과부족 판단
  const ohengStatus = (Object.entries(elements) as [string, number][]).map(([key, val]) => {
    const pct = Math.round((val / total) * 100);
    const status = val === 0 ? '없음' : val >= 4 ? '과다' : val >= 2 ? '보통' : '부족';
    return { key, val, pct, status };
  });

  return (
    <>
      <StepTitle stepNum={5} title={'내 사주팔자를\n확인해보세요'} sub="입력하신 정보를 바탕으로 사주 원국을 계산했어요." />

      {/* 프로필 요약 */}
      <div className="card-navy py-4 px-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-h2 text-white">{name}님</p>
            <p className="text-caption text-white/50 mt-0.5">{yearStr} · {input.gender === 'male' ? '남' : '여'}{sajuData.띠 ? ` · ${sajuData.띠}띠` : ''}</p>
          </div>
          <div className="text-right">
            <p className="text-display text-brand-gold-light">{ilgan}</p>
            <p className="text-[10px] text-white/40">{ilganKr}({oheng}) 일간</p>
          </div>
        </div>
      </div>

      {/* 사주팔자 4기둥 — 전통 순서: 시일월년 */}
      <div className="flex gap-2 mb-4">
        {[...sajuData.pillars].reverse().map((p, i) => <MiniPillarCard key={i} pillar={p} />)}
      </div>

      {/* 천간 성격 플래시카드 블록은 미승인 피쳐로 제거됨 (2026-04-18).
          필요 시 별도 PRD 후 재도입. */}

      {/* 오행 분포 — 한눈에 */}
      <div className="card">
        <p className="text-label text-text-primary font-bold mb-3">오행 분포</p>
        <div className="space-y-2">
          {ohengStatus.map(({ key, val, pct, status }) => {
            const info = OHENG_MAP[key as keyof typeof OHENG_MAP];
            if (!info) return null;
            return (
              <div key={key} className="flex items-center gap-2">
                <div className="w-10 text-center flex items-center justify-center gap-0.5">
                  <span className="text-caption font-black" style={{ color: info.color }}>{info.hanja}</span>
                  <span className="text-[10px] text-text-hint">{key}</span>
                </div>
                <div className="flex-1 h-2 rounded-full overflow-hidden bg-border-light">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 3)}%`, background: info.color }} />
                </div>
                <span className="w-6 text-right text-caption font-bold" style={{ color: val === 0 ? '#D32F2F' : info.color }}>{val}</span>
                <span className={`text-[10px] w-8 ${status === '없음' ? 'text-func-danger font-bold' : status === '과다' ? 'text-func-warning font-bold' : 'text-text-hint'}`}>{status}</span>
              </div>
            );
          })}
        </div>
        {ohengStatus.some(o => o.val === 0) && (
          <p className="text-caption text-func-danger mt-3">
            {ohengStatus.filter(o => o.val === 0).map(o => OHENG_MAP[o.key as keyof typeof OHENG_MAP]?.hanja + '(' + o.key + ')').join(', ')}이 없어요 — 분석에서 보충 방법을 알려드릴게요
          </p>
        )}
      </div>
    </>
  );
}

// Step6 제거됨 — 5단계로 축소 (사주팔자 무료 확인이 마지막)
