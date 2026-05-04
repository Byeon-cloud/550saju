// InputPage — #50 Sprint 2 UI 개편 (2026-04-24)
// 스펙: docs/mockups/사주500_UI개편_08_사주분석입력.md §1-§18 · 핸드오프 §2-3
//
// 골격 (스펙 §1, 단일 화면 스크롤):
//   TopBar 56 → IntentHint 48 → NameField → GenderSelector → BirthDateField
//   → BirthHourField (12지지 + 모름 시트) → LoadPreviousHint(조건부) → Notice → SubmitBar 80(sticky)
//
// 버그 체크 (§16):
//   - 진입 시 빈 폼 (lastInput 자동 prefill 금지)
//   - "불러오기" 버튼 통해서만 lastInput 복원
//   - ?profileId= 있을 때만 prefill (+ ?edit=1 → 수정 모드)
//
// 보존 (절대 삭제 금지):
//   - P2-2 프로필 수정(덮어쓰기) 로직 — editingProfileId, deleteReport
//   - E40 useInputDraft sessionStorage 이어쓰기 Modal
//   - 광고 0건 (입력 페이지 = 블랙리스트, BannerAdStep5 제거)

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { calculateSaju } from '@/services/saju/calculator';
import { useSajuContext } from '@/contexts/SajuContext';
import type { CalendarType, Gender, SajuInput } from '@/types/saju';
import type { Relation } from '@/types/user';
import {
  saveReport,
  generateId,
  getProfiles,
  saveProfileDirect,
  spendBalance,
  setMyProfile,
  deleteReport,
  type LocalReport,
} from '@/services/storage/localStore';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  useInputDraft,
  type InputDraftSnapshot,
} from '@/hooks/useInputDraft';
import {
  triggerPromotionEvent,
  PROMO_EVENTS,
} from '@/services/toss/tossPromotion';

/* ══════════════════════════════════════════════════════════════════
 * SSOT 토큰 (D1 fix 정렬)
 * ═════════════════════════════════════════════════════════════════ */
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  goldLine: 'rgba(184,150,90,0.40)',
  line: '#E5DFD0',
  surface: '#FFFFFF',
  danger: '#C0392B',
  noteBeige: '#F0ECE1', // §7-2 KR 보정 안내 배경 (스펙 명시)
} as const;

/* ══════════════════════════════════════════════════════════════════
 * 12지지 + 모름 (스펙 §7-1)
 *  - range는 KR ±30분 보정 적용된 사주 시간대 (스펙 §7-2)
 *  - hour는 계산기(`calculateSaju`)가 기대하는 정수 시각 (보존)
 * ═════════════════════════════════════════════════════════════════ */
type HourCode =
  | '자' | '축' | '인' | '묘' | '진' | '사'
  | '오' | '미' | '신' | '유' | '술' | '해'
  | 'unknown' | '';

const HOUR_OPTIONS: Array<{
  code: Exclude<HourCode, '' | 'unknown'>;
  hanja: string;
  range: string;
  hour: number;
}> = [
  { code: '자', hanja: '子', range: '23:30 ~ 01:30', hour: 0 },
  { code: '축', hanja: '丑', range: '01:30 ~ 03:30', hour: 1 },
  { code: '인', hanja: '寅', range: '03:30 ~ 05:30', hour: 3 },
  { code: '묘', hanja: '卯', range: '05:30 ~ 07:30', hour: 5 },
  { code: '진', hanja: '辰', range: '07:30 ~ 09:30', hour: 7 },
  { code: '사', hanja: '巳', range: '09:30 ~ 11:30', hour: 9 },
  { code: '오', hanja: '午', range: '11:30 ~ 13:30', hour: 11 },
  { code: '미', hanja: '未', range: '13:30 ~ 15:30', hour: 13 },
  { code: '신', hanja: '申', range: '15:30 ~ 17:30', hour: 15 },
  { code: '유', hanja: '酉', range: '17:30 ~ 19:30', hour: 17 },
  { code: '술', hanja: '戌', range: '19:30 ~ 21:30', hour: 19 },
  { code: '해', hanja: '亥', range: '21:30 ~ 23:30', hour: 21 },
];

const SHIJU_HOURS = HOUR_OPTIONS.map((o) => o.hour);

const RELATIONS: { value: Relation; label: string }[] = [
  { value: '본인', label: '본인' },
  { value: '친구', label: '친구' },
  { value: '가족', label: '가족' },
  { value: '연인', label: '연인' },
  { value: '기타', label: '직접입력' },
];

/* ══════════════════════════════════════════════════════════════════
 * 진입 경로 매핑 — 스펙 §3 IntentHint(6) + §10-2 SubmitBar(8)
 *  routeAfterSave 부재 시 → 기본 분석 흐름 (1운 차감 + /loading)
 * ═════════════════════════════════════════════════════════════════ */
type FromKey =
  | 'home_pillar_daily'
  | 'home_pillar_dream'
  | 'home_body_premium'
  | 'home_body_topic'
  | 'home_body_daewoon'
  | 'home_body_wolun'
  | 'home_body_gunghap'
  | 'home_body_tojeong'
  | 'storage'
  | 'chat'
  | 'my' /* Stage 7e-5: 내 정보에서 사주 입력 → 사주 카드로 진입 (운 차감 X) */
  | 'saju-card'
  | 'result_other'
  | 'compat' /* 레거시 */
  | '';

interface FromIntent {
  hint: string;
  submitLabel: string;
  routeAfterSave?: (newId: string) => string;
}

const FROM_INTENT: Record<Exclude<FromKey, ''>, FromIntent> = {
  home_pillar_daily: {
    hint: '오늘의 운세를 보려면 사주 정보가 필요해요',
    submitLabel: '오늘의 운세 보기',
    routeAfterSave: () => '/daily',
  },
  home_pillar_dream: {
    hint: '오늘의 운세를 보려면 사주 정보가 필요해요',
    submitLabel: '꿈해몽 시작하기',
    routeAfterSave: () => '/dream',
  },
  home_body_premium: {
    hint: '종합 사주를 위해 정보를 입력해주세요',
    submitLabel: '종합 사주 시작하기 (10운)',
    // 잔액 확인은 handleSubmit 의 별도 로직에서 처리 (10운 ≥ → /loading?type=premium, 부족 → /charge?need=10)
    // routeAfterSave 는 handleSubmit 에서 사용하지 않고 SajuContext set 후 분기
    routeAfterSave: () => '/loading?type=premium',
  },
  home_body_topic: {
    hint: '주제별 심층 풀이에 필요한 사주 정보예요',
    submitLabel: '주제 고르러 가기',
    routeAfterSave: () => '/topic',
  },
  home_body_daewoon: {
    hint: '주제별 심층 풀이에 필요한 사주 정보예요',
    submitLabel: '대운 풀이 시작 (1운)',
    routeAfterSave: () => '/topic/daewoon',
  },
  home_body_wolun: {
    hint: '주제별 심층 풀이에 필요한 사주 정보예요',
    submitLabel: '월운 풀이 시작 (1운)',
    routeAfterSave: () => '/topic/wolun',
  },
  home_body_gunghap: {
    hint: '주제별 심층 풀이에 필요한 사주 정보예요',
    submitLabel: '궁합 풀이 시작 (1운)',
    routeAfterSave: () => '/compat',
  },
  home_body_tojeong: {
    hint: '주제별 심층 풀이에 필요한 사주 정보예요',
    submitLabel: '토정비결 풀이 시작 (1운)',
    routeAfterSave: () => '/topic/tojeong',
  },
  storage: {
    hint: '새로운 사주를 등록합니다',
    submitLabel: '사주 저장하기',
    routeAfterSave: () => '/storage',
  },
  // Stage 7e-5: 내 정보에서 진입 — 입력 후 사주 카드로 (운 차감 0)
  my: {
    hint: '본인의 사주 정보를 입력해주세요',
    submitLabel: '내 사주 카드 만들기',
    routeAfterSave: (id) => `/saju-card/${id}`,
  },
  // 사주 카드에서 다른 사람 추가 — 동일 흐름
  'saju-card': {
    hint: '사주 정보를 입력해주세요',
    submitLabel: '사주 카드 만들기',
    routeAfterSave: (id) => `/saju-card/${id}`,
  },
  chat: {
    hint: '대화할 사주의 정보를 입력해주세요',
    submitLabel: '이 사주로 대화 시작하기',
    routeAfterSave: (id) => `/chat?profileId=${id}`,
  },
  result_other: {
    hint: '또 다른 분의 사주를 등록합니다',
    submitLabel: '사주 카드 만들기',
    // Stage 7e-8: 사주풀이 폐기 — 미정의 fallback 도 사주카드 진입으로 통일
    routeAfterSave: (id) => `/saju-card/${id}`,
  },
  compat: {
    hint: '궁합 분석할 분의 사주를 입력해주세요',
    submitLabel: '궁합 풀이 시작 (1운)',
    routeAfterSave: () => '/compat',
  },
};

// Stage 7e-8: 사주풀이 폐기 — DEFAULT_INTENT 도 사주카드 진입으로 통일
//   (1운 차감 + /loading 흐름 = 옛 1운 사주풀이 제품, 현재 미사용)
const DEFAULT_INTENT: FromIntent = {
  hint: '사주 정보를 입력해주세요',
  submitLabel: '사주 카드 만들기',
  routeAfterSave: (id) => `/saju-card/${id}`,
};

function getIntent(from: FromKey): FromIntent {
  if (from && FROM_INTENT[from]) return FROM_INTENT[from];
  return DEFAULT_INTENT;
}

/** "saju500.lastInput" — 스펙 §8 명시 키 */
const LAST_INPUT_KEY = 'saju500.lastInput';

/* ══════════════════════════════════════════════════════════════════
 * Page
 * ═════════════════════════════════════════════════════════════════ */
export function InputPage() {
  usePageTitle('사주 입력');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { setInput, setSajuData } = useSajuContext();

  // ── URL 파라미터
  const fromRaw = (searchParams.get('from') ?? '') as FromKey;
  const profileIdParam = searchParams.get('profileId');
  const editParam = searchParams.get('edit') === '1';
  const isForceNew = searchParams.get('new') === '1';

  // 진입 의도 (IntentHint + SubmitBar 라벨)
  const intent = useMemo(() => getIntent(fromRaw), [fromRaw]);

  // 레거시: 보관함이 location.state로 프로필 전달
  const stateProfile = (location.state as any)?.selectedProfile as
    | LocalReport
    | undefined;

  // ── 명시 prefill 소스 — ?profileId= 또는 location.state
  const allProfiles = useMemo(() => getProfiles(), []);
  const initialProfile: LocalReport | null = useMemo(() => {
    if (isForceNew) return null;
    if (stateProfile) return stateProfile;
    if (profileIdParam) {
      return allProfiles.find((p) => p.id === profileIdParam) ?? null;
    }
    return null;
  }, [stateProfile, profileIdParam, allProfiles, isForceNew]);

  // P2-2 · 수정 모드 (보존) — ?profileId=xxx&edit=1 조합으로 활성
  const [editingProfileId, setEditingProfileId] = useState<string | null>(
    editParam && initialProfile ? initialProfile.id : null,
  );

  // ── 폼 상태 (스펙 §16: profileId 없으면 빈 폼)
  const initFromProfile = !!initialProfile;
  const [name, setName] = useState(
    initFromProfile ? initialProfile!.name : '',
  );
  const [relation, setRelation] = useState<Relation>(
    initFromProfile
      ? ((initialProfile!.input.relation as Relation) || '본인')
      : '본인',
  );
  const [gender, setGender] = useState<Gender | null>(
    initFromProfile ? initialProfile!.input.gender : null,
  );
  const [calendarSimple, setCalendarSimple] = useState<'solar' | 'lunar'>(
    initFromProfile &&
      String(initialProfile!.input.calendarType ?? '').startsWith('lunar')
      ? 'lunar'
      : 'solar',
  );
  const [isLeapMonth, setIsLeapMonth] = useState<boolean>(
    initFromProfile
      ? initialProfile!.input.calendarType === 'lunar_leap'
      : false,
  );
  const [birthDate, setBirthDate] = useState<string>(() => {
    if (!initFromProfile) return '';
    const i = initialProfile!.input;
    return `${i.birthYear}-${String(i.birthMonth).padStart(2, '0')}-${String(
      i.birthDay,
    ).padStart(2, '0')}`;
  });
  const [hourCode, setHourCode] = useState<HourCode>(() => {
    if (!initFromProfile) return '';
    const i = initialProfile!.input;
    if (!i.hasBirthTime || i.birthHour === undefined) return 'unknown';
    const o = HOUR_OPTIONS.find((o) => o.hour === i.birthHour);
    return o ? o.code : 'unknown';
  });

  // 시트
  const [hourSheetOpen, setHourSheetOpen] = useState(false);

  // 오늘 (max date)
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // 유효성
  const errors = useMemo(() => {
    const out: {
      name?: string;
      gender?: string;
      birthDate?: string;
      hourCode?: string;
    } = {};
    const trimmed = name.trim();
    if (!trimmed) out.name = '이름을 입력해주세요';
    else if (trimmed.length > 12) out.name = '이름은 12자 이내로 입력해주세요';
    if (!gender) out.gender = '성별을 선택해주세요';
    if (!birthDate) out.birthDate = '생년월일을 선택해주세요';
    else if (birthDate > today)
      out.birthDate = '오늘 이후 날짜는 선택할 수 없어요';
    if (hourCode === '')
      out.hourCode = "태어난 시간을 선택해주세요 (모르면 '모름')";
    return out;
  }, [name, gender, birthDate, hourCode, today]);
  const isValid = Object.keys(errors).length === 0;

  /**
   * T4 · Pre-warming · 폼이 valid 가 되는 순간 generateReport 인스턴스 깨우기
   *  · idempotent · 사용자 인터렉션 없는 백그라운드 ping
   *  · 콜드스타트 1~3s 완전 제거 효과 — 실제 제출 시점에 instance 이미 warm
   *  · 한 세션에서 1번만 호출 (warmupFiredRef 가드)
   *  · functionsClient (us-central1) 와 동일 region 사용
   */
  const warmupFiredRef = useRef(false);
  useEffect(() => {
    if (!isValid || warmupFiredRef.current) return;
    warmupFiredRef.current = true;
    // dynamic import — Firebase functions SDK 가 InputPage 번들에 포함 안되도록
    (async () => {
      try {
        const [{ httpsCallable }, { functions, ensureFunctionsTarget }] = await Promise.all([
          import('firebase/functions'),
          import('@/services/firebase/functionsClient'),
        ]);
        await ensureFunctionsTarget();
        const warmup = httpsCallable(functions, 'warmupGenerateReport');
        await warmup({});
      } catch {
        // silent — warmup 실패해도 사용자 경험에 영향 없음
      }
    })();
  }, [isValid]);

  // touched 추적 (제출 시도 전엔 에러 숨김)
  const [touched, setTouched] = useState<{
    name?: boolean;
    gender?: boolean;
    birthDate?: boolean;
    hourCode?: boolean;
  }>({});

  // ── E40 · 임시저장 (보존)
  const draftEnabled = !initFromProfile;
  const draftSnapshot: InputDraftSnapshot = useMemo(() => {
    const m = birthDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const by = m?.[1] ?? '';
    const bm = m ? String(Number(m[2])) : '';
    const bd = m ? String(Number(m[3])) : '';
    const calType: CalendarType =
      calendarSimple === 'lunar' && isLeapMonth ? 'lunar_leap' : calendarSimple;
    let timeIndex: number | null = null;
    let knowsTime: boolean | null = null;
    if (hourCode === 'unknown') knowsTime = false;
    else if (hourCode === '') knowsTime = null;
    else {
      knowsTime = true;
      const o = HOUR_OPTIONS.find((o) => o.code === hourCode);
      if (o) {
        const idx = SHIJU_HOURS.indexOf(o.hour);
        if (idx >= 0) timeIndex = idx;
      }
    }
    return {
      name,
      relation,
      birthYear: by,
      birthMonth: bm,
      birthDay: bd,
      calendarType: calType,
      gender,
      knowsTime,
      timeIndex,
      step: 1, // E40 v1 호환 — 단일 화면이므로 의미 없음
    };
  }, [name, relation, birthDate, calendarSimple, isLeapMonth, gender, hourCode]);

  const { hasInitialDraft, loadDraft, clearDraft } = useInputDraft({
    enabled: draftEnabled,
    snapshot: draftSnapshot,
  });
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  useEffect(() => {
    if (hasInitialDraft && draftEnabled && !isForceNew)
      setDraftModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDraftContinue() {
    const d = loadDraft();
    if (!d) {
      setDraftModalOpen(false);
      return;
    }
    setName(d.name);
    setRelation(d.relation);
    if (d.birthYear && d.birthMonth && d.birthDay) {
      setBirthDate(
        `${d.birthYear}-${String(d.birthMonth).padStart(2, '0')}-${String(
          d.birthDay,
        ).padStart(2, '0')}`,
      );
    }
    setCalendarSimple(
      d.calendarType?.startsWith('lunar') ? 'lunar' : 'solar',
    );
    setIsLeapMonth(d.calendarType === 'lunar_leap');
    setGender(d.gender);
    if (d.knowsTime === false) setHourCode('unknown');
    else if (d.knowsTime === true && d.timeIndex !== null) {
      const o = HOUR_OPTIONS[d.timeIndex];
      setHourCode(o ? o.code : '');
    } else {
      setHourCode('');
    }
    setDraftModalOpen(false);
  }

  function handleDraftDiscard() {
    clearDraft();
    setDraftModalOpen(false);
  }

  // ── 이전 입력값 (lastInput) — 스펙 §8: 명시 액션만 (자동 prefill 금지)
  const [hasLastInput, setHasLastInput] = useState<boolean>(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_INPUT_KEY);
      if (raw && JSON.parse(raw)) setHasLastInput(true);
    } catch {
      /* 무시 */
    }
  }, []);
  const isFormEmpty =
    !name && !birthDate && !gender && !hourCode && !isLeapMonth;

  function loadLastInput() {
    try {
      const raw = localStorage.getItem(LAST_INPUT_KEY);
      if (!raw) return;
      const li = JSON.parse(raw) as Partial<SajuInput>;
      if (li.name) setName(li.name);
      if (li.relation) setRelation(li.relation as Relation);
      if (li.gender) setGender(li.gender);
      if (li.birthYear && li.birthMonth && li.birthDay) {
        setBirthDate(
          `${li.birthYear}-${String(li.birthMonth).padStart(2, '0')}-${String(
            li.birthDay,
          ).padStart(2, '0')}`,
        );
      }
      const ct = (li.calendarType ?? 'solar') as CalendarType;
      setCalendarSimple(ct.startsWith('lunar') ? 'lunar' : 'solar');
      setIsLeapMonth(ct === 'lunar_leap');
      if (li.hasBirthTime && li.birthHour !== undefined) {
        const o = HOUR_OPTIONS.find((o) => o.hour === li.birthHour);
        setHourCode(o ? o.code : 'unknown');
      } else {
        setHourCode('unknown');
      }
      toast.show('이전 입력값을 불러왔어요', 'info');
    } catch (e) {
      console.warn('[loadLastInput]', e);
    }
  }

  // ── 제출
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function buildSajuInput(): SajuInput | null {
    const m = birthDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m || !gender) return null;
    const by = Number(m[1]);
    const bm = Number(m[2]);
    const bd = Number(m[3]);
    const calType: CalendarType =
      calendarSimple === 'lunar' && isLeapMonth ? 'lunar_leap' : calendarSimple;
    const input: SajuInput = {
      name: name.trim(),
      relation,
      birthYear: by,
      birthMonth: bm,
      birthDay: bd,
      calendarType: calType,
      gender,
      hasBirthTime: hourCode !== 'unknown' && hourCode !== '',
    };
    if (input.hasBirthTime) {
      const o = HOUR_OPTIONS.find((o) => o.code === hourCode);
      if (o) {
        input.birthHour = o.hour;
        input.birthMinute = 0;
      }
    }
    return input;
  }

  async function handleSubmit() {
    if (isSubmittingRef.current) return;
    setTouched({
      name: true,
      gender: true,
      birthDate: true,
      hourCode: true,
    });
    if (!isValid) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const sajuInput = buildSajuInput();
      if (!sajuInput) throw new Error('입력 변환 실패');
      const data = calculateSaju(sajuInput);
      setInput(sajuInput);
      setSajuData(data);

      // P2-2 · 수정 모드 — 기존 report 삭제 후 신규 ID로 재저장 (보존)
      if (editingProfileId) {
        deleteReport(editingProfileId);
        setEditingProfileId(null);
      }

      const reportId = generateId();
      const report: LocalReport = {
        id: reportId,
        name: sajuInput.name || '이름 없음',
        input: sajuInput,
        sajuData: data,
        createdAt: new Date().toISOString(),
        type: 'free',
      };
      saveReport(report);
      saveProfileDirect({
        id: reportId,
        name: report.name,
        input: sajuInput,
        sajuData: data,
        relation: sajuInput.relation,
        createdAt: report.createdAt,
      });

      // 본인 사주면 myProfile 갱신
      if (!sajuInput.relation || sajuInput.relation === '본인') {
        setMyProfile(reportId);
      }

      // lastInput 저장 (다음 진입 시 §8 LoadPreviousHint 활용)
      try {
        localStorage.setItem(LAST_INPUT_KEY, JSON.stringify(sajuInput));
      } catch {
        /* 무시 */
      }

      // E40 · draft 정리
      clearDraft();

      // 진입 경로별 라우팅 (스펙 §10-3)
      // 종합 사주 (10운) 특별 분기: routeAfterSave='/loading?type=premium' 일 때 잔액 검사 + 차감
      if (fromRaw === 'home_body_premium') {
        if (!spendBalance(10)) {
          toast.show('10운이 부족해요. 충전 페이지로 이동합니다', 'warning');
          navigate('/charge?need=10', {
            state: { from: 'input', message: '종합 사주에 10운이 필요해요' },
          });
          return;
        }
        triggerPromotionEvent(PROMO_EVENTS.FIRST_SAJU);
        toast.show('10운 차감 — 종합 사주 시작', 'success');
        navigate('/loading?type=premium');
        return;
      }

      const customRoute = intent.routeAfterSave?.(reportId);
      if (customRoute) {
        toast.show('사주가 저장됐어요', 'success');
        navigate(customRoute, { replace: false });
        return;
      }

      // 기본 / result_other → 1운 차감 + /loading
      if (!spendBalance(1)) {
        toast.show('잔액이 부족해요. 충전이 필요해요', 'warning');
        navigate('/charge?need=1', {
          state: { from: 'input', message: '종합 사주에 1운이 필요해요' },
        });
        return;
      }
      triggerPromotionEvent(PROMO_EVENTS.FIRST_SAJU);
      navigate('/loading');
    } catch (e: any) {
      console.error('[InputPage submit]', e);
      toast.show('저장에 실패했어요. 다시 시도해주세요', 'warning');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  // 시간 표시 라벨
  const hourDisplayLabel = useMemo(() => {
    if (hourCode === '') return '시간 선택';
    if (hourCode === 'unknown') return '모름 — 시주 제외 풀이';
    const o = HOUR_OPTIONS.find((o) => o.code === hourCode);
    return o ? `${o.code}시 (${o.range})` : '시간 선택';
  }, [hourCode]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.paper,
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
      }}
    >
      {/* §2 TopBar (Header 컴포넌트 위임) */}
      <Header title={editingProfileId ? '사주 수정' : '사주 입력'} />

      {/* §3 IntentHint */}
      <IntentHintBlock hint={intent.hint} />

      <div
        className="mx-auto"
        style={{ maxWidth: 520, padding: '20px 16px 0' }}
      >
        {/* §4 NameField + 관계 칩 (보존) */}
        <NameField
          value={name}
          onChange={setName}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          relation={relation}
          onRelationChange={setRelation}
          error={touched.name ? errors.name : undefined}
        />

        {/* §5 GenderSelector */}
        <GenderSelector
          value={gender}
          onChange={(g) => {
            setGender(g);
            setTouched((t) => ({ ...t, gender: true }));
          }}
          error={touched.gender ? errors.gender : undefined}
        />

        {/* §6 BirthDateField */}
        <BirthDateField
          calendarSimple={calendarSimple}
          onCalendarChange={setCalendarSimple}
          isLeapMonth={isLeapMonth}
          onLeapChange={setIsLeapMonth}
          birthDate={birthDate}
          onBirthDateChange={(v) => {
            setBirthDate(v);
            setTouched((t) => ({ ...t, birthDate: true }));
          }}
          maxDate={today}
          error={touched.birthDate ? errors.birthDate : undefined}
        />

        {/* §7 BirthHourField */}
        <BirthHourField
          hourCode={hourCode}
          displayLabel={hourDisplayLabel}
          onOpenSheet={() => setHourSheetOpen(true)}
          error={touched.hourCode ? errors.hourCode : undefined}
        />

        {/* §8 LoadPreviousHint — 명시 액션만 */}
        {hasLastInput && isFormEmpty && (
          <LoadPreviousHint onLoad={loadLastInput} />
        )}

        {/* §9 Notice */}
        <NoticeBlock />
      </div>

      {/* §10 SubmitBar (sticky 80px) */}
      <SubmitBar
        label={intent.submitLabel}
        loading={isSubmitting}
        disabled={!isValid}
        onSubmit={handleSubmit}
        onBack={() => navigate(-1)}
      />

      {/* §7-1 HourSheet bottom sheet */}
      <HourSheet
        open={hourSheetOpen}
        currentCode={hourCode}
        onClose={() => setHourSheetOpen(false)}
        onSelect={(code) => {
          setHourCode(code);
          setTouched((t) => ({ ...t, hourCode: true }));
          setHourSheetOpen(false);
        }}
      />

      {/* E40 이어쓰기 Modal (보존) */}
      <Modal
        isOpen={draftModalOpen}
        onClose={handleDraftDiscard}
        title="이어쓰기 하시겠어요?"
      >
        <div className="space-y-4">
          <p className="text-body-sm text-text-muted leading-relaxed">
            이전에 입력하던 내용이 있어요. 이어서 마저 작성할까요?
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="lg"
              onClick={handleDraftDiscard}
              className="flex-1"
            >
              새로 작성
            </Button>
            <Button
              size="lg"
              onClick={handleDraftContinue}
              className="flex-1"
            >
              이어쓰기
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §3 IntentHintBlock
 * ═════════════════════════════════════════════════════════════════ */
function IntentHintBlock({ hint }: { hint: string }) {
  return (
    <div
      style={{
        background: C.goldSoft,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: `1px solid ${C.goldLine}`,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={C.goldDeep}
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
        style={{ flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: C.ink, fontWeight: 500, margin: 0 }}>
          {hint}
        </p>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
          3분이면 끝나요
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §4 NameField + 관계 칩
 * ═════════════════════════════════════════════════════════════════ */
function NameField({
  value,
  onChange,
  onBlur,
  relation,
  onRelationChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  relation: Relation;
  onRelationChange: (r: Relation) => void;
  error?: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label
        htmlFor="input-name"
        style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: C.ink,
          marginBottom: 8,
        }}
      >
        성함 또는 별명
      </label>
      <input
        id="input-name"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="성함을 입력해주세요"
        maxLength={12}
        autoComplete="off"
        aria-invalid={!!error}
        aria-describedby={error ? 'input-name-error' : undefined}
        style={{
          width: '100%',
          height: 52,
          background: C.surface,
          border: `1px solid ${error ? C.danger : C.line}`,
          borderRadius: 12,
          padding: '0 16px',
          fontSize: 17,
          fontWeight: 600,
          color: C.ink,
          outline: 'none',
        }}
      />
      <p
        style={{
          fontSize: 12,
          color: C.inkSoft,
          marginTop: 6,
        }}
      >
        내 사주 말고 친구·가족 것도 별명으로 구분하면 좋아요
      </p>
      {error && (
        <p
          id="input-name-error"
          style={{ fontSize: 12, color: C.danger, marginTop: 6 }}
        >
          {error}
        </p>
      )}
      {/* 관계 칩 (P2-2 보존: 본인/친구/가족/연인/기타) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 10,
        }}
      >
        {RELATIONS.map((r) => {
          const active = relation === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onRelationChange(r.value)}
              aria-pressed={active}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 999,
                background: active ? C.ink : C.surface,
                color: active ? C.paper : C.inkSoft,
                border: `1px solid ${active ? C.ink : C.line}`,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §5 GenderSelector
 * ═════════════════════════════════════════════════════════════════ */
function GenderSelector({
  value,
  onChange,
  error,
}: {
  value: Gender | null;
  onChange: (v: Gender) => void;
  error?: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label
        style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: C.ink,
          marginBottom: 8,
        }}
      >
        성별
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        {(
          [
            { value: 'female' as Gender, label: '여성', hanja: '坤' },
            { value: 'male' as Gender, label: '남성', hanja: '乾' },
          ] as const
        ).map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              style={{
                flex: 1,
                height: 52,
                background: active ? C.ink : C.surface,
                color: active ? C.paper : C.inkSoft,
                border: `1px solid ${active ? C.ink : C.line}`,
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span
                aria-hidden
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 13,
                  opacity: active ? 0.85 : 0.55,
                }}
              >
                {opt.hanja}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{error}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §6 BirthDateField — 양력/음력 토글 + native date + 윤달
 * ═════════════════════════════════════════════════════════════════ */
function BirthDateField({
  calendarSimple,
  onCalendarChange,
  isLeapMonth,
  onLeapChange,
  birthDate,
  onBirthDateChange,
  maxDate,
  error,
}: {
  calendarSimple: 'solar' | 'lunar';
  onCalendarChange: (v: 'solar' | 'lunar') => void;
  isLeapMonth: boolean;
  onLeapChange: (v: boolean) => void;
  birthDate: string;
  onBirthDateChange: (v: string) => void;
  maxDate: string;
  error?: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label
        htmlFor="input-birth-date"
        style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: C.ink,
          marginBottom: 8,
        }}
      >
        생년월일
      </label>

      {/* 양력/음력 토글 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {(
          [
            { v: 'solar' as const, label: '양력' },
            { v: 'lunar' as const, label: '음력' },
          ] as const
        ).map((opt) => {
          const active = calendarSimple === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => onCalendarChange(opt.v)}
              aria-pressed={active}
              style={{
                width: 120,
                height: 40,
                borderRadius: 999,
                background: active ? C.ink : C.surface,
                color: active ? C.paper : C.inkSoft,
                border: `1px solid ${active ? C.ink : C.line}`,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {calendarSimple === 'lunar' && (
        <p
          style={{
            fontSize: 11,
            color: C.inkSoft,
            margin: '0 0 10px',
          }}
        >
          음력은 사주 계산에 맞춰 변환해요
        </p>
      )}

      {/* native HTML5 date picker (스펙 §6-2) */}
      <input
        id="input-birth-date"
        type="date"
        value={birthDate}
        max={maxDate}
        min="1900-01-01"
        onChange={(e) => onBirthDateChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? 'input-birth-error' : undefined}
        style={{
          width: '100%',
          height: 52,
          background: C.surface,
          border: `1px solid ${error ? C.danger : C.line}`,
          borderRadius: 12,
          padding: '0 16px',
          fontSize: 16,
          color: C.ink,
          outline: 'none',
        }}
      />

      {/* 윤달 체크박스 — 음력일 때만 (스펙 §6-3) */}
      {calendarSimple === 'lunar' && (
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
            fontSize: 13,
            color: C.ink,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={isLeapMonth}
            onChange={(e) => onLeapChange(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: C.gold }}
          />
          윤달
          <span style={{ fontSize: 11, color: C.mute, marginLeft: 2 }}>
            (해당하는 달일 때만 체크)
          </span>
        </label>
      )}

      {error && (
        <p
          id="input-birth-error"
          style={{ fontSize: 12, color: C.danger, marginTop: 6 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §7 BirthHourField — 시트 트리거 + KR 보정 안내 + 모름 경고
 * ═════════════════════════════════════════════════════════════════ */
function BirthHourField({
  hourCode,
  displayLabel,
  onOpenSheet,
  error,
}: {
  hourCode: HourCode;
  displayLabel: string;
  onOpenSheet: () => void;
  error?: string;
}) {
  const isUnknown = hourCode === 'unknown';
  const isEmpty = hourCode === '';
  return (
    <div style={{ marginBottom: 24 }}>
      <label
        style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: C.ink,
          marginBottom: 8,
        }}
      >
        태어난 시간
      </label>
      <button
        type="button"
        onClick={onOpenSheet}
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-invalid={!!error}
        style={{
          width: '100%',
          height: 52,
          background: C.surface,
          border: `1px solid ${error ? C.danger : C.line}`,
          borderRadius: 12,
          padding: '0 16px',
          fontSize: 15,
          fontWeight: 600,
          color: isEmpty ? C.mute : C.ink,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {displayLabel}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.mute}
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* §7-2 KR 보정 안내 — 시간 선택 후에만 */}
      {!isEmpty && !isUnknown && (
        <div
          role="note"
          style={{
            marginTop: 10,
            background: C.noteBeige,
            padding: '14px 16px',
            borderRadius: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              flexShrink: 0,
              borderRadius: '50%',
              background: 'rgba(184,150,90,0.20)',
              color: C.goldDeep,
              fontSize: 12,
              fontWeight: 900,
              fontFamily: "'Noto Serif KR', serif",
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            時
          </span>
          <p
            style={{
              fontSize: 12.5,
              color: C.ink,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            한국에서 태어나셨다면, 실제 사주 시간은 시계 시간보다 약{' '}
            <strong>30분 빨라요</strong>. 사주500은 이 보정을 자동으로
            적용해요.
          </p>
        </div>
      )}

      {/* §7-3 모름 경고 */}
      {isUnknown && (
        <p
          style={{
            fontSize: 12,
            color: C.goldDeep,
            marginTop: 8,
            fontWeight: 500,
          }}
        >
          시주 없이도 풀이는 가능하지만, 일부 해석이 간소화돼요 (약 20% 분량 ↓)
        </p>
      )}

      {error && (
        <p style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{error}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §7-1 HourSheet — 12지지 + 모름 바텀시트
 * ═════════════════════════════════════════════════════════════════ */
function HourSheet({
  open,
  currentCode,
  onClose,
  onSelect,
}: {
  open: boolean;
  currentCode: HourCode;
  onClose: () => void;
  onSelect: (code: HourCode) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="hoursheet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: 'rgba(15,13,10,0.6)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          aria-modal="true"
          role="dialog"
          aria-label="태어난 시간 선택"
        >
          <motion.div
            key="hoursheet-panel"
            initial={{ y: 240 }}
            animate={{ y: 0 }}
            exit={{ y: 240 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="listbox"
            aria-label="태어난 시간"
            style={{
              width: '100%',
              maxWidth: 520,
              background: C.paper,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: '20px 0',
              maxHeight: '78vh',
              overflowY: 'auto',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                background: C.line,
                margin: '0 auto 16px',
              }}
              aria-hidden
            />
            <h3
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: C.ink,
                padding: '0 24px',
                margin: '0 0 12px',
              }}
            >
              태어난 시간
            </h3>
            <div style={{ padding: '4px 8px 0' }}>
              {HOUR_OPTIONS.map((o) => {
                const active = currentCode === o.code;
                return (
                  <button
                    key={o.code}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(o.code)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: active ? C.goldSoft : 'transparent',
                      border: 'none',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: C.goldDeep,
                        fontFamily: "'Noto Serif KR', serif",
                        width: 32,
                      }}
                    >
                      {o.hanja}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: C.ink,
                        }}
                      >
                        {o.code}시
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: C.mute,
                          marginTop: 2,
                        }}
                      >
                        {o.range}
                      </div>
                    </div>
                    {active && (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={C.goldDeep}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M5 12l5 5 9-9" />
                      </svg>
                    )}
                  </button>
                );
              })}
              {/* 모름 옵션 */}
              <button
                type="button"
                role="option"
                aria-selected={currentCode === 'unknown'}
                onClick={() => onSelect('unknown')}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background:
                    currentCode === 'unknown' ? C.goldSoft : 'transparent',
                  border: `1px dashed ${C.line}`,
                  borderRadius: 12,
                  margin: '8px 0 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: C.mute,
                    width: 32,
                    textAlign: 'center',
                  }}
                >
                  —
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 15, fontWeight: 600, color: C.ink }}
                  >
                    모름
                  </div>
                  <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>
                    시주 제외 풀이 (약 20% 간소화)
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §8 LoadPreviousHint — 명시 액션만 (자동 prefill 금지)
 * ═════════════════════════════════════════════════════════════════ */
function LoadPreviousHint({ onLoad }: { onLoad: () => void }) {
  return (
    <div
      style={{
        marginBottom: 16,
        background: C.goldSoft,
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={C.goldDeep}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ flexShrink: 0 }}
      >
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 4v4h4" />
      </svg>
      <span style={{ fontSize: 12, color: C.inkSoft, flex: 1 }}>
        지난번 입력값이 있어요
      </span>
      <button
        type="button"
        onClick={onLoad}
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.goldDeep,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 8,
        }}
      >
        불러오기
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §9 NoticeBlock
 * ═════════════════════════════════════════════════════════════════ */
function NoticeBlock() {
  return (
    <div style={{ padding: '16px 4px 8px' }}>
      <p
        style={{
          fontSize: 11,
          color: C.mute,
          lineHeight: 1.75,
          margin: 0,
        }}
      >
        · 입력한 정보는 풀이·저장에만 사용되며 외부 공유되지 않아요.
      </p>
      <p
        style={{
          fontSize: 11,
          color: C.mute,
          lineHeight: 1.75,
          margin: 0,
        }}
      >
        · 생년월일·시간은 사주 풀이 품질에 직접 영향을 줘요. 가능한 한 정확히
        입력해주세요.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §10 SubmitBar — sticky 80px (이전 + 제출)
 * ═════════════════════════════════════════════════════════════════ */
function SubmitBar({
  label,
  loading,
  disabled,
  onSubmit,
  onBack,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const blocked = disabled || loading;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: C.paper,
        borderTop: `1px solid ${C.line}`,
        padding: '14px 16px',
        paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
        zIndex: 50,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          maxWidth: 520,
          margin: '0 auto',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          style={{
            width: 52,
            height: 52,
            background: C.surface,
            color: C.inkSoft,
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          이전
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={blocked}
          aria-disabled={blocked}
          style={{
            flex: 1,
            height: 52,
            background: disabled ? 'rgba(26,26,26,0.4)' : C.ink,
            color: C.paper,
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: blocked ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? '풀이를 준비하고 있어요...' : label}
        </button>
      </div>
    </div>
  );
}
