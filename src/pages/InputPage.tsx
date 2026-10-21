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
import { hasNativeNavBack } from '@/lib/env';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { calculateSaju, lunarMonthDays, toSolarInput } from '@/services/saju/calculator';
import { previewSiji, bandCenterHourForDate } from '@/services/saju/sijiPreview';
import { useSajuContext } from '@/contexts/SajuContext';
import type { CalendarType, Gender, SajuInput } from '@/types/saju';
import type { Relation } from '@/types/user';
import { getPremiumPrice } from '@/constants/pricing';
import {
  generateId,
  getProfiles,
  saveProfileDirect,
  spendBalance,
  getBalance,
  setMyProfile,
  findExistingOwnerProfile,
  updateProfileRelation,
  deleteProfile,
  type LocalReport,
} from '@/services/storage/localStore';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { hasFreePass } from '@/services/storage/dailyFreePass';
import {
  useInputDraft,
  type InputDraftSnapshot,
} from '@/hooks/useInputDraft';

/* ══════════════════════════════════════════════════════════════════
 * SSOT 토큰 (D1 fix 정렬)
 * ═════════════════════════════════════════════════════════════════ */
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#6F6557',
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
 *  - range는 KR 진태양시 보정(-30분, 업계 표준 · 2026-07-14 확정) 적용된 사주 시간대 (스펙 §7-2)
 *  - 경계는 시계로 :30 정각 (진태양시 -30분 · 2026-07-14 기준 v2). calculateSaju 도 -30분이라
 *    라벨=계산 일치. 예: 인시는 시계 3:32부터 → 딱 3:30은 아직 축시(태양시 2:58).
 *    ※ 이전 :30 반올림 라벨은 3:30을 인시로 오표기했음(계산은 축시) → 2026-07 정정.
 *  - 태어난 지역이 동쪽(영남 등)이면 보정폭이 작아(-24분) 경계가 더 늦음 → 경계값은 근사치.
 *  - hour는 계산기가 기대하는 정수 '중앙' 시각 (보존 — 표시만 변경)
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
  // 2026-06-02 시주 fix — hour = 각 시(時)의 '중앙' 클럭값. 진태양시 -30분 보정 후에도
  //   선택한 시 안에 안착하도록 (예: 午 12:00 → 보정 11:30 → 午). 기존엔 시작값(午=11)이라
  //   보정 시 직전 시(巳)로 밀려 "午 선택 → 巳 계산" 모순 발생. 子(=0)는 이미 중앙(자정)이라 유지.
  { code: '자', hanja: '子', range: '23:30 ~ 01:29', hour: 0 },
  { code: '축', hanja: '丑', range: '01:30 ~ 03:29', hour: 2 },
  { code: '인', hanja: '寅', range: '03:30 ~ 05:29', hour: 4 },
  { code: '묘', hanja: '卯', range: '05:30 ~ 07:29', hour: 6 },
  { code: '진', hanja: '辰', range: '07:30 ~ 09:29', hour: 8 },
  { code: '사', hanja: '巳', range: '09:30 ~ 11:29', hour: 10 },
  { code: '오', hanja: '午', range: '11:30 ~ 13:29', hour: 12 },
  { code: '미', hanja: '未', range: '13:30 ~ 15:29', hour: 14 },
  { code: '신', hanja: '申', range: '15:30 ~ 17:29', hour: 16 },
  { code: '유', hanja: '酉', range: '17:30 ~ 19:29', hour: 18 },
  { code: '술', hanja: '戌', range: '19:30 ~ 21:29', hour: 20 },
  { code: '해', hanja: '亥', range: '21:30 ~ 23:29', hour: 22 },
];

// 시지(時支) 실시간 미리보기 → `@/services/saju/sijiPreview` SSOT (2026-07 — 상대방 입력과 공용화)

/** 12지지 fallback 선택 시 대표 시각(각 시의 중앙 클럭값) → 'HH:MM'
 *  birthDate('YYYY-MM-DD')가 있으면 서머타임 기간 +60분 앵커 보정 (bandCenterHourForDate 주석 참조) */
function hourCodeToTime(code: HourCode, birthDate?: string): string {
  const o = HOUR_OPTIONS.find((x) => x.code === code);
  if (o && birthDate) {
    const dm = birthDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dm) {
      const adj = bandCenterHourForDate(Number(dm[1]), Number(dm[2]), Number(dm[3]), o.hour);
      return `${String(adj).padStart(2, '0')}:00`;
    }
  }
  if (!o) return '';
  return `${String(o.hour).padStart(2, '0')}:00`;
}

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
  | 'home_body_tojung' /* TojungPage 빈상태 (lockdown) */
  | 'tojung' /* 신년운세 사람 고르기의 '새 사주 입력하기' (부모님 등) */
  | 'manse' /* 검색 페이지 /manse/ 무료 만세력 (2026-10-18) */
  | 'home_body_weekly' /* WeeklyPage 빈상태 */
  | 'home_body_monthly' /* MonthlyPage 빈상태 */
  | 'weekly'
  | 'monthly'
  | 'daily' /* 오늘의 운세 빈상태 */
  | 'dream' /* 꿈해몽 빈상태 */
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

/** 2026-09-17 — 스테일 from 값 정리.
 *  대운·궁합·토정은 출시 lockdown(라우트가 홈 redirect)이고 /topic/daewoon·/topic/tojeong 은 없는 주제라
 *  저장 후 엉뚱한 화면(홈 redirect·주제 404)에 떨어졌음 → 홈으로 명시 폴백.
 *  사주 저장만 하고 운은 차감하지 않으므로 버튼에 가격(1운) 표기도 뺌. */
const LOCKED_FALLBACK_INTENT: FromIntent = {
  hint: '사주 정보를 입력해주세요',
  submitLabel: '사주 저장하기',
  routeAfterSave: () => '/',
};

const FROM_INTENT: Record<Exclude<FromKey, ''>, FromIntent> = {
  home_pillar_daily: {
    hint: '오늘의 운세를 보려면 사주 정보가 필요해요',
    submitLabel: '오늘의 운세 보기',
    routeAfterSave: () => '/daily',
  },
  home_pillar_dream: {
    hint: '꿈을 사주와 함께 풀려면 사주 정보가 필요해요',
    submitLabel: '꿈해몽 시작하기',
    routeAfterSave: () => '/dream',
  },
  // 2026-09-17 — 콘텐츠 빈상태 → 입력 → 원래 콘텐츠로 복귀 (저장만 · 운 차감 없음)
  daily: {
    hint: '오늘의 운세를 보려면 사주 정보가 필요해요',
    submitLabel: '오늘의 운세 보기',
    // 2026-10-17 — 가족을 새로 넣으면 그 사람으로 열리게 (?profileId · DailyFortunePage 가 처리)
    routeAfterSave: (id) => `/daily?profileId=${encodeURIComponent(id)}`,
  },
  dream: {
    hint: '꿈을 사주와 함께 풀려면 사주 정보가 필요해요',
    submitLabel: '꿈해몽 시작하기',
    routeAfterSave: () => '/dream',
  },
  // 주간·월간은 방금 저장한 사주를 미리 선택해 둔 채로 복귀 (?profileId= · WeeklyPage/MonthlyPage 가 처리)
  weekly: {
    hint: '주간운세를 보려면 사주 정보가 필요해요',
    submitLabel: '주간운세 보러 가기',
    routeAfterSave: (id) => `/weekly?profileId=${encodeURIComponent(id)}`,
  },
  home_body_weekly: {
    hint: '주간운세를 보려면 사주 정보가 필요해요',
    submitLabel: '주간운세 보러 가기',
    routeAfterSave: (id) => `/weekly?profileId=${encodeURIComponent(id)}`,
  },
  monthly: {
    hint: '월운세를 보려면 사주 정보가 필요해요',
    submitLabel: '월운세 보러 가기',
    routeAfterSave: (id) => `/monthly?profileId=${encodeURIComponent(id)}`,
  },
  home_body_monthly: {
    hint: '월운세를 보려면 사주 정보가 필요해요',
    submitLabel: '월운세 보러 가기',
    routeAfterSave: (id) => `/monthly?profileId=${encodeURIComponent(id)}`,
  },
  home_body_premium: {
    hint: '종합사주를 보려면 정보를 넣어 주세요',
    submitLabel: `종합사주 시작하기 (${getPremiumPrice().actualPrice}운)`,
    // 잔액 확인은 handleSubmit 의 별도 로직에서 처리. home_body_premium 분기가 먼저 처리하므로 이 경로는 실사용 X.
    // 안전 fallback: Phase 4 (2026-05-27) 결과 페이지 직진 패턴 유지.
    routeAfterSave: (id) => `/result/${id}?fresh=1&type=premium`,
  },
  home_body_topic: {
    hint: '주제별 심층 풀이에 필요한 사주 정보예요',
    submitLabel: '주제 고르러 가기',
    routeAfterSave: () => '/topic',
  },
  // 대운·궁합·토정 — lockdown/없는 주제 → 홈 폴백 (LOCKED_FALLBACK_INTENT 주석 참고)
  home_body_daewoon: LOCKED_FALLBACK_INTENT,
  // 월운은 /monthly 로 출시됨 → 구 /topic/wolun(없는 주제) 대신 월별 운세로
  home_body_wolun: {
    hint: '월운세를 보려면 사주 정보가 필요해요',
    submitLabel: '월운세 보러 가기',
    routeAfterSave: (id) => `/monthly?profileId=${encodeURIComponent(id)}`,
  },
  home_body_gunghap: LOCKED_FALLBACK_INTENT,
  home_body_tojeong: LOCKED_FALLBACK_INTENT,
  home_body_tojung: { hint: '신년운세를 볼 사주 정보를 입력해주세요', submitLabel: '저장하고 신년운세 보러 가기', routeAfterSave: (id) => `/tojung?profileId=${encodeURIComponent(id)}` },
  // 2026-10-17 — '부모님 함께 보세요' 동선: 새 사주를 넣으면 신년운세로 돌아가 그 사람이 골라져 있게 (전엔 사주 카드로 갔다)
  tojung: { hint: '신년운세를 볼 분의 사주 정보를 넣어 주세요', submitLabel: '저장하고 신년운세 보러 가기', routeAfterSave: (id) => `/tojung?profileId=${encodeURIComponent(id)}` },
  // 2026-10-18 무료 만세력 검색 페이지 → 입력 → 사주 카드(만세력 한 장)
  manse: {
    hint: '생년월일과 태어난 시간을 넣으면 만세력이 바로 나와요',
    submitLabel: '내 만세력 보기',
    routeAfterSave: (id) => `/saju-card/${id}`,
  },
  storage: {
    hint: '새 사주를 넣어요',
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
    hint: '다른 분의 사주를 넣어요',
    submitLabel: '사주 카드 만들기',
    // Stage 7e-8: 사주풀이 폐기 — 미정의 fallback 도 사주카드 진입으로 통일
    routeAfterSave: (id) => `/saju-card/${id}`,
  },
  // 궁합 (2026-10-04 공개) — 상대방 사주 저장 후 궁합 화면으로 복귀 (새 프로필이 상대 칸에 자동 선택됨)
  compat: {
    hint: '궁합을 볼 상대의 사주 정보를 입력해주세요',
    submitLabel: '저장하고 궁합 보러 가기',
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
  // 2026-10-15 — 홈 띠 카드에서 고른 태어난 해(?y=1964) → 생년월일 앞 네 자리를 미리 채운다
  const prefillYear = (() => {
    const y = Number(searchParams.get('y'));
    return Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear() ? y : undefined;
  })();

  // 진입 의도 (IntentHint + SubmitBar 라벨)
  // 2026-10-17 — returnTo 로 들어오면(주제운의 '다른 사람 사주') 저장 뒤 그 화면으로 돌아가므로 버튼 글도 그렇게
  const returnToState = (location.state as any)?.returnTo as string | undefined;
  const intent = useMemo<FromIntent>(() => {
    const base = getIntent(fromRaw);
    // 2026-10-21 — 사주대화 광고('생일만 넣고 고민 하나 무료로 물어보세요')로 온 손님에게 약속한 말을 바로 보이게. 오늘 무료권이 있을 때만
    if (fromRaw === 'chat' && hasFreePass('chat')) return { ...base, hint: '생일을 넣으면 내 사주로 고민에 답해 드려요. 오늘 첫 질문은 무료예요', submitLabel: '무료로 첫 질문하기' };
    return returnToState && !fromRaw ? { ...base, hint: '풀이를 볼 분의 사주 정보를 넣어 주세요', submitLabel: '저장하고 돌아가기' } : base;
  }, [fromRaw, returnToState]);

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
  // 2026-05-28 — '기타' 선택 시 직접 입력 받기 (CompatibilityPage 패턴 동일)
  const [customRelation, setCustomRelation] = useState<string>(() => {
    if (!initFromProfile) return '';
    const r = initialProfile!.input.relation;
    // 저장된 relation 이 표준 5종 외 string 이면 customRelation 으로 복원
    const STANDARD: Relation[] = ['본인', '친구', '가족', '연인', '기타'];
    return (r && !STANDARD.includes(r as Relation)) ? r : '';
  });
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
  // 2026-07 — 30분 블록 → 분 단위 입력. birthTime('HH:MM') 단일 소스 + timeUnknown(모름).
  //   진태양시 보정은 calculateSaju(-30분)이 담당 → 여기선 시:분만 정확히 수집.
  const [birthTime, setBirthTime] = useState<string>(() => {
    if (!initFromProfile) return '';
    const i = initialProfile!.input;
    if (!i.hasBirthTime || i.birthHour === undefined) return '';
    return `${String(i.birthHour).padStart(2, '0')}:${String(i.birthMinute ?? 0).padStart(2, '0')}`;
  });
  const [timeUnknown, setTimeUnknown] = useState<boolean>(() => {
    if (!initFromProfile) return false;
    return !initialProfile!.input.hasBirthTime;
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
    if (!birthDate) out.birthDate = '생년월일 8자리를 넣어 주세요 (예: 19640315)';
    else if (birthDate > today)
      out.birthDate = '오늘 이후 날짜는 선택할 수 없어요';
    if (!timeUnknown && birthTime === '')
      out.hourCode = "태어난 시간을 입력해주세요 (모르면 '모름')";
    return out;
  }, [name, gender, birthDate, birthTime, timeUnknown, today]);
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
    return {
      name,
      relation,
      birthYear: by,
      birthMonth: bm,
      birthDay: bd,
      calendarType: calType,
      gender,
      birthTime: timeUnknown ? '' : birthTime,
      timeUnknown,
      step: 1, // E40 — 단일 화면이므로 의미 없음
    };
  }, [name, relation, birthDate, calendarSimple, isLeapMonth, gender, birthTime, timeUnknown]);

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
    if (d.timeUnknown) {
      setTimeUnknown(true);
      setBirthTime('');
    } else {
      setTimeUnknown(false);
      setBirthTime(d.birthTime || '');
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
    !name && !birthDate && !gender && birthTime === '' && !timeUnknown && !isLeapMonth;

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
        setTimeUnknown(false);
        setBirthTime(`${String(li.birthHour).padStart(2, '0')}:${String(li.birthMinute ?? 0).padStart(2, '0')}`);
      } else {
        setTimeUnknown(true);
        setBirthTime('');
      }
      toast.show('이전 입력값을 불러왔어요', 'info');
    } catch (e) {
      console.warn('[loadLastInput]', e);
    }
  }

  // ── 제출
  const isSubmittingRef = useRef(false);
  // 2026-10-17 입력을 끝내지 않고 나간 사람이 어느 칸까지 채웠는지 (입력 41% 이탈 진단, analytics input_leave)
  const leaveRef = useRef({ name: '', gender: '', birthDate: '', time: false });
  leaveRef.current = { name: name.trim(), gender: String(gender || ''), birthDate, time: timeUnknown || birthTime !== '' };
  useEffect(() => () => {
    if (isSubmittingRef.current) return;
    const f = leaveRef.current;
    const filled = [f.name && 'name', f.gender && 'gender', f.birthDate && 'birth', f.time && 'time'].filter(Boolean).join(',');
    import('@/services/analytics').then((a) => a.trackEvent('input_leave', { filled: filled || 'none' })).catch(() => {});
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 2026-05-28 PM — 본인 중복 modal state
  const [ownerDupModal, setOwnerDupModal] = useState<null | { existingName: string; existingId: string }>(null);
  // 본인 중복 처리 후 실제 저장 재진입 hook (resolveAction 호출 시 실행)
  const pendingSaveRef = useRef<null | (() => Promise<void>)>(null);

  function buildSajuInput(): SajuInput | null {
    const m = birthDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m || !gender) return null;
    const by = Number(m[1]);
    const bm = Number(m[2]);
    const bd = Number(m[3]);
    const calType: CalendarType =
      calendarSimple === 'lunar' && isLeapMonth ? 'lunar_leap' : calendarSimple;
    // 2026-05-28 — '기타' 선택 + customRelation 입력 시 사용자 입력값 우선 저장
    const effectiveRelation = (relation === '기타' && customRelation.trim().length > 0)
      ? (customRelation.trim() as Relation)
      : relation;
    const input: SajuInput = {
      name: name.trim(),
      relation: effectiveRelation,
      birthYear: by,
      birthMonth: bm,
      birthDay: bd,
      calendarType: calType,
      gender,
      hasBirthTime: !timeUnknown && birthTime !== '',
    };
    if (input.hasBirthTime) {
      const m2 = birthTime.match(/^(\d{1,2}):(\d{2})$/);
      if (m2) {
        input.birthHour = Number(m2[1]);   // 시계 시각 그대로 — 진태양시 보정은 calculateSaju 담당
        input.birthMinute = Number(m2[2]);
      } else {
        input.hasBirthTime = false; // 파싱 실패 방어 → 시주 제외
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
    if (!isValid) {
      // 2026-10-17 퍼널 실측: 입력 화면을 연 324명 중 132명만 끝냈다(41%). 예전엔 빈 칸이 있으면 버튼이 그냥 안 눌려
      //   무엇이 빠졌는지 몰랐다. 이제 첫 빈 칸으로 내려가고 알려 주며, 어떤 칸에서 막히는지 남긴다.
      const order: Array<[keyof typeof errors, string]> = [['name', 'input-name'], ['gender', 'input-gender'], ['birthDate', 'input-birth-date'], ['hourCode', 'input-hour']];
      const first = order.find(([k]) => errors[k]);
      if (first) {
        const el = document.getElementById(first[1]) || document.querySelector(`[data-field="${String(first[0])}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast.show(String(errors[first[0]] || '빠진 칸을 채워 주세요'), 'info');
      }
      import('@/services/analytics').then((a) => a.trackEvent('input_blocked', { missing: Object.keys(errors).join(',') })).catch(() => {});
      return;
    }

    // 2026-05-28 PM — 본인 중복 가드. relation === '본인' 이고 기존 본인이 있고, 수정 모드 X 일 때만.
    //   확인: 기존 본인 != 현재 입력자 (이름+생일 일치는 같은 사람으로 본다 → 그냥 진행).
    const tentativeInput = buildSajuInput();
    const isOwnerNew = tentativeInput && (!tentativeInput.relation || tentativeInput.relation === '본인');
    if (isOwnerNew && !editingProfileId) {
      const existing = findExistingOwnerProfile();
      const sameKey =
        existing &&
        tentativeInput &&
        existing.name === tentativeInput.name &&
        existing.input.birthYear === tentativeInput.birthYear &&
        existing.input.birthMonth === tentativeInput.birthMonth &&
        existing.input.birthDay === tentativeInput.birthDay;
      if (existing && !sameKey) {
        // Modal 띄움 + pendingSaveRef 에 실제 save 로직 보관
        pendingSaveRef.current = () => doSave({ replaceOwnerId: null });
        setOwnerDupModal({ existingName: existing.name, existingId: existing.id });
        return;
      }
    }

    await doSave({ replaceOwnerId: null });
  }

  /** 실제 사주 저장 + 라우팅 — handleSubmit 의 본문을 추출.
   *  options.replaceOwnerId: 기존 본인 사주를 삭제하고 새 사주로 교체할 때 사용. */
  async function doSave(options: { replaceOwnerId: string | null }) {
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const sajuInput = buildSajuInput();
      if (!sajuInput) throw new Error('입력 변환 실패');
      const data = calculateSaju(sajuInput);

      // 본인 중복 교체 옵션 — 기존 본인 프로필 삭제
      if (options.replaceOwnerId) {
        try {
          deleteProfile(options.replaceOwnerId);
        } catch { /* noop */ }
      }
      setInput(sajuInput);
      setSajuData(data);

      // P2-2 · 수정 모드 — 2026-10-17: 예전엔 deleteReport(editingProfileId) 로 같은 id 의 리포트를 서버까지 지웠다.
      //   복원으로 생긴 프로필은 id 가 리포트 id 와 같아서, 사주를 고치면 결제한 기록이 영구 삭제될 수 있었다.
      //   프로필 갱신은 saveProfileDirect 가 이름과 생일로 덮어쓰므로 리포트는 건드리지 않는다.
      if (editingProfileId) {
        setEditingProfileId(null);
      }

      // 2026-05-07 fix — 사주 등록만으로 보관함에 "종합사주 무료" 항목이 자동 생성되던 문제 수정.
      // 등록은 프로필만 저장 (saveProfileDirect). reports 는 실제 분석/결제 시점에만 추가.
      const reportId = generateId();
      saveProfileDirect({
        id: reportId,
        name: sajuInput.name || '이름 없음',
        input: sajuInput,
        sajuData: data,
        relation: sajuInput.relation,
        createdAt: new Date().toISOString(),
      });

      // 본인 사주면 myProfile 갱신
      if (!sajuInput.relation || sajuInput.relation === '본인') {
        setMyProfile(reportId);
      }

      // 2026-06-18 — 사주 프로필 생성 트래킹 (활성화 onboarding — 가입→프로필→첫콘텐츠 퍼널)
      import('@/services/analytics').then((a) => a.trackEvent('profile_created', {
        relation: sajuInput.relation || '본인',
        hourKnown: sajuInput.birthHour != null && sajuInput.birthHour >= 0 ? 1 : 0,
      })).catch(() => {});

      // lastInput 저장 (다음 진입 시 §8 LoadPreviousHint 활용)
      try {
        localStorage.setItem(LAST_INPUT_KEY, JSON.stringify(sajuInput));
      } catch {
        /* 무시 */
      }

      // E40 · draft 정리
      clearDraft();

      // audit 3 P0 E3 — returnTo state 처리 (TopicAnalysisPage 빈상태 → /input → 자동 복귀)
      const returnTo = (location.state as any)?.returnTo as string | undefined;
      if (returnTo) {
        toast.show('사주가 등록됐어요', 'success');
        // 2026-10-17 — 방금 넣은 사주를 미리 고른 채로 돌아간다 (주제운의 '다른 사람 사주 입력')
        navigate(returnTo, { replace: true, state: { profileId: reportId } });
        return;
      }

      // 진입 경로별 라우팅 (스펙 §10-3)
      // 종합 사주 (10운) 특별 분기: 잔액 검사 + 차감 + 결과 페이지 직진 (Phase 4 · 2026-05-27)
      // 구: /loading?type=premium (별도 로딩화면 30-60s 대기 후 결과로 이동)
      // 신: /result/{newId}?fresh=1&type=premium → ResultPage 가 직접 SSE 구동 + 점진 렌더
      //     (오늘의 운세 패턴 — 결과 페이지가 곧 로딩화면이고, 콘텐츠가 차오름)
      if (fromRaw === 'home_body_premium') {
        // 2026-05-28 PM — SSOT 가격 (10운 정가, 5운 세일 ~2026-06-15)
        const premiumPricing = getPremiumPrice();
        const premiumCost = premiumPricing.actualPrice;
        // 2026-10-21 — 처음인 손님은 바로 충전으로 보내지 않고 종합사주 화면의 갈림길(무료 오늘의 운세 먼저, 받으면 24시간 반값)로
        //   (광고 손님 9명이 생일을 넣자마자 5,000원 충전 화면으로 가서 아무도 결제하지 않았다)
        const offerGate = await import('@/services/offers/firstDailyOffer');
        if (getBalance() < premiumCost && offerGate.firstDailyOfferEligible()) {
          import('@/services/analytics').then((a) => a.trackEvent('insufficient_balance', { type: 'premium', needed: premiumCost, gate: 1 })).catch(() => {});
          navigate(`/premium?profileId=${encodeURIComponent(reportId)}&gate=1`, { replace: true });
          return;
        }
        if (!spendBalance(premiumCost)) {
          // 2026-06-18 — 잔액부족 = 충전 유도 직전(전환 모멘트) 트래킹
          import('@/services/analytics').then((a) => a.trackEvent('insufficient_balance', { type: 'premium', needed: premiumCost })).catch(() => {});
          toast.show(`${premiumCost}운이 부족해요. 충전 화면으로 갈게요`, 'warning');
          navigate(`/charge?need=${premiumCost}`, {
            state: { from: 'input', message: `종합사주에 ${premiumCost}운이 필요해요` },
          });
          return;
        }
        // 10-19 — 첫 오늘의 운세 반값으로 샀으면 표시 (services/offers/firstDailyOffer.ts)
        const offerMod = await import('@/services/offers/firstDailyOffer');
        const usedOffer = premiumCost === offerMod.OFFER.price && offerMod.firstDailyOfferActive();
        if (usedOffer) offerMod.markFirstDailyOfferUsed();
        // 측정 — 운 차감 성공 직후 (C1 · fire-and-forget)
        import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'premium', amount: premiumCost, ...(usedOffer ? { offer: offerMod.OFFER.id } : {}) })).catch(() => {});
        // P0 CS — 생성 중 앱 종료 시 운 소실 방지 (결과 저장/에러환불 시 해제, 미해제 시 부팅 자동환불)
        import('@/services/storage/localStore').then(m => m.markPendingSpend('premium', premiumCost)).catch(() => {});

        toast.show(`${premiumCost}운을 써서 종합사주를 시작해요`, 'success');
        const newId = generateId();
        navigate(`/result/${newId}?fresh=1&type=premium`, { replace: true });
        return;
      }

      const customRoute = intent.routeAfterSave?.(reportId);
      if (customRoute) {
        toast.show('사주가 저장됐어요', 'success');
        navigate(customRoute, { replace: false });
        return;
      }

      // 2026-05-07 fix — 1운 결과 페이지 컨셉이 처음부터 기획에 없었음.
      // 출시 모델: 무료 (오늘운세/꿈) + 10운 종합사주 + 10주제(각 1운) + 꿈 심층(1운).
      // 사주 등록만 한 경우 → 사주 카드(만세력)로 (결제 없이).
      toast.show('사주가 저장됐어요', 'success');
      navigate(`/saju-card/${reportId}`, { replace: false });
    } catch (e: any) {
      console.error('[InputPage submit]', e);
      toast.show('저장에 실패했어요. 다시 시도해주세요', 'warning');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  // 입력 시각 → 진태양시 보정 후 시지(時支) 실시간 미리보기
  const sijiPreview = useMemo(
    () => (timeUnknown || birthTime === '' ? null : previewSiji(birthDate, birthTime)),
    [birthDate, birthTime, timeUnknown],
  );

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
          customRelation={customRelation}
          onCustomRelationChange={setCustomRelation}
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
          prefillYear={initFromProfile ? undefined : prefillYear}
          error={touched.birthDate ? errors.birthDate : undefined}
        />

        {/* §7 BirthHourField — 분 단위 입력 + 실시간 시(時) 표시 */}
        <BirthHourField
          birthTime={birthTime}
          timeUnknown={timeUnknown}
          sijiPreview={sijiPreview}
          onTimeChange={(v) => {
            setBirthTime(v);
            setTimeUnknown(false);
            setTouched((t) => ({ ...t, hourCode: true }));
          }}
          onSetUnknown={() => {
            setTimeUnknown(true);
            setBirthTime('');
            setTouched((t) => ({ ...t, hourCode: true }));
          }}
          onOpenBlockSheet={() => setHourSheetOpen(true)}
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

      {/* §7-1 HourSheet — 시(時)만 아는 사람용 fallback (블록 → 대표 시각으로 변환) */}
      <HourSheet
        open={hourSheetOpen}
        currentCode={sijiPreview ? (HOUR_OPTIONS.find((o) => o.hanja === sijiPreview.hanja)?.code ?? '') : ''}
        onClose={() => setHourSheetOpen(false)}
        onSelect={(code) => {
          if (code === 'unknown') {
            setTimeUnknown(true);
            setBirthTime('');
          } else {
            setTimeUnknown(false);
            setBirthTime(hourCodeToTime(code, birthDate));
          }
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

      {/* 2026-05-28 PM — 본인 사주 중복 가드 Modal.
          user 이슈: 같은 사람이 본인 사주를 여러 개 등록할 수 있어 운 잔액·결제 내역이 헷갈림.
          해결: 명시적 confirm 으로 [교체] / [다른 관계로 변경] / [취소] 선택 강제. */}
      <Modal
        isOpen={!!ownerDupModal}
        onClose={() => { setOwnerDupModal(null); pendingSaveRef.current = null; }}
        title="본인 사주를 바꾸시는 건가요?"
      >
        {ownerDupModal && (
          <div className="space-y-4">
            <p className="text-body-sm text-text-muted leading-relaxed" style={{ wordBreak: 'keep-all' }}>
              이미 본인 사주로 <strong style={{ color: '#1A1A1A' }}>{ownerDupModal.existingName}</strong> 님이 저장되어 있어요.
              <br />
              본인 사주는 한 명만 둘 수 있어요. <strong style={{ color: '#1A1A1A' }}>운 잔액과 결제 내역은 그대로 남아요</strong>.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                variant="gold"
                fullWidth
                onClick={async () => {
                  const existingId = ownerDupModal.existingId;
                  setOwnerDupModal(null);
                  await doSave({ replaceOwnerId: existingId });
                  pendingSaveRef.current = null;
                }}
              >
                기존 {ownerDupModal.existingName} 사주 교체
              </Button>
              <Button
                size="lg"
                variant="ghost"
                fullWidth
                onClick={async () => {
                  const existingId = ownerDupModal.existingId;
                  try { updateProfileRelation(existingId, '가족'); } catch { /* noop */ }
                  setOwnerDupModal(null);
                  await doSave({ replaceOwnerId: null });
                  pendingSaveRef.current = null;
                }}
              >
                {ownerDupModal.existingName} 님을 가족으로 옮기기
              </Button>
              <Button
                size="lg"
                variant="ghost"
                fullWidth
                onClick={() => { setOwnerDupModal(null); pendingSaveRef.current = null; }}
              >
                취소
              </Button>
            </div>
          </div>
        )}
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
        <p style={{ fontSize: 13, color: C.inkSoft, margin: '2px 0 0' }}>
          잠깐이면 끝나요
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
  customRelation,
  onCustomRelationChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  relation: Relation;
  onRelationChange: (r: Relation) => void;
  customRelation?: string;
  onCustomRelationChange?: (v: string) => void;
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
          fontSize: 13.5,
          color: C.inkSoft,
          marginTop: 6,
        }}
      >
        내 사주 말고 친구와 가족 것도 별명으로 구분하면 좋아요
      </p>
      {error && (
        <p
          id="input-name-error"
          style={{ fontSize: 13.5, color: C.danger, marginTop: 6 }}
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
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      {/* 2026-05-28 — '기타/직접입력' 선택 시 자유 입력 칸 노출 (CompatibilityPage 패턴 동일) */}
      {relation === '기타' && onCustomRelationChange && (
        <input
          type="text"
          value={customRelation || ''}
          onChange={(e) => onCustomRelationChange(e.target.value)}
          placeholder="예: 동료, 선배, 지인…"
          maxLength={20}
          autoComplete="off"
          style={{
            width: '100%',
            marginTop: 10,
            height: 44,
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            padding: '0 14px',
            fontSize: 14,
            color: C.ink,
            outline: 'none',
          }}
        />
      )}
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
      <div id="input-gender" style={{ display: 'flex', gap: 8 }}>
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
        <p style={{ fontSize: 13.5, color: C.danger, marginTop: 6 }}>{error}</p>
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
  prefillYear,
  error,
}: {
  calendarSimple: 'solar' | 'lunar';
  onCalendarChange: (v: 'solar' | 'lunar') => void;
  isLeapMonth: boolean;
  onLeapChange: (v: boolean) => void;
  birthDate: string;
  onBirthDateChange: (v: string) => void;
  maxDate: string;
  prefillYear?: number;
  error?: string;
}) {
  /* 2026-10-15 — 휴대폰 날짜 선택기 → '생년월일 8자리' 숫자 입력.
   *   혜택탭 유입 50~60대(안드로이드 91%)가 날짜 선택기에서 60년을 거슬러 넘기다 나갔다.
   *   은행 앱처럼 숫자 여덟 개(19640315)면 끝, 음력 30일도 넣을 수 있다. 입력 중엔 오류를 띄우지 않는다. */
  const toDigits = (d: string) => d.replace(/-/g, '');
  const [digits, setDigits] = useState<string>(() => (birthDate ? toDigits(birthDate) : prefillYear ? String(prefillYear) : ''));
  const [focused, setFocused] = useState(false);
  /** 칸을 한 번 거쳐 간 뒤에만 '8자리' 안내 — 띠 카드에서 1964 를 채워 온 첫 화면에 빨간 글씨가 뜨지 않게 */
  const [blurred, setBlurred] = useState(false);
  const parsed = parseBirthDigits(digits, calendarSimple, maxDate, isLeapMonth);
  // 이어쓰기, 프로필 수정처럼 밖에서 날짜가 바뀌면 칸도 맞춘다
  useEffect(() => {
    if (birthDate && toDigits(birthDate) !== digits) setDigits(toDigits(birthDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthDate]);
  // 양력과 음력, 윤달을 바꾸면 같은 숫자를 다시 검사 (음력 2월 30일은 양력에선 없는 날)
  useEffect(() => {
    const next = parsed.iso;
    if (next !== birthDate) onBirthDateChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarSimple, isLeapMonth]);
  const onDigits = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 8);
    setDigits(v);
    const next = parseBirthDigits(v, calendarSimple, maxDate, isLeapMonth).iso;
    if (next !== birthDate) onBirthDateChange(next);
  };
  const shownError = focused ? '' : (digits.length === 8 && parsed.msg) ? parsed.msg : (blurred && digits.length > 0 && digits.length < 8) ? '생년월일 8자리를 넣어 주세요 (예: 19640315)' : error;
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
        생년월일 8자리
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
            fontSize: 13,
            color: C.inkSoft,
            margin: '0 0 10px',
          }}
        >
          음력은 사주 계산에 맞춰 변환해요
        </p>
      )}

      <input
        id="input-birth-date"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={8}
        placeholder="예: 19640315"
        value={digits}
        onChange={(e) => onDigits(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setBlurred(true); }}
        aria-invalid={!!shownError}
        aria-describedby={shownError ? 'input-birth-error' : parsed.iso ? 'input-birth-preview' : undefined}
        style={{
          width: '100%',
          height: 52,
          background: C.surface,
          border: `1px solid ${shownError ? C.danger : C.line}`,
          borderRadius: 12,
          padding: '0 16px',
          fontSize: 18,
          letterSpacing: '.06em',
          fontVariantNumeric: 'tabular-nums',
          color: C.ink,
          outline: 'none',
        }}
      />
      {parsed.iso && (
        <p id="input-birth-preview" style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, margin: '8px 2px 0' }}>
          {calendarSimple === 'lunar'
            ? <>{isLeapMonth ? '음력 윤달' : '음력'} {parsed.y}년 {parsed.m}월 {parsed.d}일{parsed.solar ? <span style={{ fontWeight: 500, color: C.inkSoft }}>, 양력으로 {parsed.solar}</span> : null}</>
            : <>양력 {parsed.y}년 {parsed.m}월 {parsed.d}일</>}
        </p>
      )}

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
          <span style={{ fontSize: 13, color: C.mute, marginLeft: 2 }}>
            (해당하는 달일 때만 체크)
          </span>
        </label>
      )}

      {shownError && (
        <p
          id="input-birth-error"
          style={{ fontSize: 13.5, color: C.danger, marginTop: 6 }}
        >
          {shownError}
        </p>
      )}
    </div>
  );
}

/** '19640315' → 날짜 검사. 8자리가 안 되면 iso '' (입력 중), 날짜가 틀리면 msg */
function parseBirthDigits(digits: string, cal: 'solar' | 'lunar', maxDate: string, leap = false): { iso: string; y?: number; m?: number; d?: number; msg?: string; solar?: string } {
  if (digits.length !== 8) return { iso: '' };
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  const maxY = Number(maxDate.slice(0, 4));
  if (y < 1900 || y > maxY) return { iso: '', msg: `태어난 해를 다시 확인해 주세요 (1900~${maxY})` };
  if (m < 1 || m > 12) return { iso: '', msg: '월은 01부터 12까지예요' };
  // 음력은 만세력의 그 달 날 수(29 또는 30)와 그해 윤달로 검사 (2026-10-15)
  const last = cal === 'lunar' ? lunarMonthDays(y, m, leap) : new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (last == null) return { iso: '', msg: `${y}년에는 윤${m}월이 없어요. 윤달 체크를 풀어 주세요` };
  if (d < 1 || d > last) return { iso: '', msg: cal === 'lunar' ? `음력 ${y}년 ${m}월은 ${last}일까지예요` : `${m}월은 ${last}일까지예요` };
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let solar: string | undefined;
  if (cal === 'lunar') {
    try {
      const s = toSolarInput({ birthYear: y, birthMonth: m, birthDay: d, calendarType: leap ? 'lunar_leap' : 'lunar' } as SajuInput);
      solar = `${s.birthYear}년 ${s.birthMonth}월 ${s.birthDay}일`;
      const sIso = `${s.birthYear}-${String(s.birthMonth).padStart(2, '0')}-${String(s.birthDay).padStart(2, '0')}`;
      if (sIso > maxDate) return { iso: '', msg: '오늘 이후 날짜는 넣을 수 없어요' };
    } catch { return { iso: '', msg: '날짜를 다시 확인해 주세요' }; }
  } else if (iso > maxDate) return { iso: '', msg: '오늘 이후 날짜는 넣을 수 없어요' };
  return { iso, y, m, d, solar };
}

/* ══════════════════════════════════════════════════════════════════
 * §7 BirthHourField — 시트 트리거 + KR 보정 안내 + 모름 경고
 * ═════════════════════════════════════════════════════════════════ */
function BirthHourField({
  birthTime,
  timeUnknown,
  sijiPreview,
  onTimeChange,
  onSetUnknown,
  onOpenBlockSheet,
  error,
}: {
  birthTime: string;
  timeUnknown: boolean;
  sijiPreview: { hanja: string; ko: string } | null;
  onTimeChange: (v: string) => void;
  onSetUnknown: () => void;
  onOpenBlockSheet: () => void;
  error?: string;
}) {
  const hasTime = !timeUnknown && birthTime !== '';
  return (
    <div id="input-hour" style={{ marginBottom: 24 }}>
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

      {/* 시:분 직접 입력 + 모름 토글 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="time"
          value={timeUnknown ? '' : birthTime}
          onChange={(e) => onTimeChange(e.target.value)}
          aria-invalid={!!error}
          aria-label="태어난 시각 (시:분)"
          style={{
            flex: 1,
            height: 52,
            background: C.surface,
            border: `1px solid ${error ? C.danger : hasTime ? C.goldLine : C.line}`,
            borderRadius: 12,
            padding: '0 16px',
            fontSize: 16,
            fontWeight: 600,
            color: timeUnknown ? C.mute : C.ink,
          }}
        />
        <button
          type="button"
          onClick={onSetUnknown}
          aria-pressed={timeUnknown}
          style={{
            flexShrink: 0,
            height: 52,
            padding: '0 18px',
            background: timeUnknown ? C.goldSoft : C.surface,
            border: `1px solid ${timeUnknown ? C.goldLine : C.line}`,
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            color: timeUnknown ? C.goldDeep : C.mute,
            cursor: 'pointer',
          }}
        >
          모름
        </button>
      </div>

      {/* 실시간 시(時) 표시 — 진태양시 자동 판정 결과를 눈으로 확인 */}
      {hasTime && sijiPreview && (
        <div
          role="note"
          style={{
            marginTop: 10,
            background: C.goldSoft,
            padding: '12px 14px',
            borderRadius: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: '50%',
              background: 'rgba(184,150,90,0.22)',
              color: C.goldDeep,
              fontSize: 15,
              fontWeight: 900,
              fontFamily: "'Noto Serif KR', serif",
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {sijiPreview.hanja}
          </span>
          <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, margin: 0 }}>
            진태양시(약 30분) 보정 후{' '}
            <strong style={{ color: C.goldDeep }}>
              {sijiPreview.ko}({sijiPreview.hanja})
            </strong>{' '}
            로 계산돼요.
            <br />
            표준시와 서머타임까지 사주500이 자동으로 맞췄어요.
            {/* 2026-07-14 기준 v2 · 경계 안내 (준기: "줏대 있게 가되 부가설명은 안내") —
                :28~:31 은 시(時) 경계 ±2분 창. 학파·만세력별로 앞뒤 시가 갈릴 수 있는 구간이라
                기준을 숨기지 않고 명시한다. 판정 자체는 대중 만세력과 동일한 '시계 30분' 경계로 확정. */}
            {(() => {
              const mi = parseInt(birthTime.split(':')[1] || '', 10);
              return mi >= 28 && mi <= 31 ? (
                <>
                  <br />
                  <span style={{ color: C.goldDeep, fontWeight: 600 }}>
                    이 시각은 시(時)의 경계 부근이에요. 만세력마다 앞뒤 시로 다르게 보기도 하는데,
                    사주500은 널리 쓰이는 &lsquo;30분 경계&rsquo; 기준으로 풀이해드려요.
                  </span>
                </>
              ) : null;
            })()}
          </p>
        </div>
      )}

      {/* 모름 경고 */}
      {timeUnknown && (
        <p
          style={{
            fontSize: 13.5,
            color: C.goldDeep,
            marginTop: 8,
            fontWeight: 500,
          }}
        >
          시주(시간 기둥) 부분만 빼고 풀이해드려요. 그 외엔 모두 분석돼요.
        </p>
      )}

      {/* 시(時)만 아는 사람용 fallback */}
      {!timeUnknown && (
        <button className="tap-pad"
          type="button"
          onClick={onOpenBlockSheet}
          style={{
            marginTop: 10,
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 13.5,
            fontWeight: 600,
            color: C.goldDeep,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            cursor: 'pointer',
          }}
        >
          시각은 모르고 태어난 시(時)만 아세요?
        </button>
      )}

      {error && (
        <p style={{ fontSize: 13.5, color: C.danger, marginTop: 6 }}>{error}</p>
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
            {/* 진태양시 보정 안내 — "왜 :30부터?" 혼동 + 경계 시각 선택 가이드 (2026-07 UX fix) */}
            <div
              style={{
                margin: '0 24px 14px',
                padding: '10px 12px',
                background: C.goldSoft,
                borderRadius: 12,
                fontSize: 13.5,
                lineHeight: 1.55,
                color: C.mute,
              }}
            >
              우리나라 표준시는 실제 태양 시간보다 약 30분 빨라요. 사주는 태양의 위치가 기준이라, 그만큼 앞당겨 보정한 시간대예요 (서울 기준).
              <br />
              시각이 <b style={{ color: C.goldDeep, fontWeight: 700 }}>경계에 딱 걸치면</b> 태어난 지역에 따라 앞뒤 시(時)로 갈릴 수 있어요.
            </div>
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
                          fontSize: 13.5,
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
                  <div style={{ fontSize: 13.5, color: C.mute, marginTop: 2 }}>
                    태어난 시를 빼고 풀어요
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
      <span style={{ fontSize: 13.5, color: C.inkSoft, flex: 1 }}>
        지난번 입력값이 있어요
      </span>
      <button className="tap-pad"
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
          fontSize: 13,
          color: C.mute,
          lineHeight: 1.75,
          margin: 0,
        }}
      >
        입력한 정보는 풀이를 만들고 보관하는 데만 써요. 자세한 처리는 개인정보처리방침에 있어요.
      </p>
      <p
        style={{
          fontSize: 13,
          color: C.mute,
          lineHeight: 1.75,
          margin: 0,
        }}
      >
        생년월일과 시간은 사주 풀이 품질에 직접 영향을 줘요. 가능한 한 정확히
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
        {/* 앱인토스: 토스 내비바 뒤로가기와 중복 → 숨김 (2026-09-16 심사 반려 · env.ts hasNativeNavBack) */}
        {!hasNativeNavBack && (
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
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
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
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1, // 2026-10-17 빈 칸이 있어도 눌린다 (눌러서 빠진 칸을 알려 준다)
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? '풀이를 준비하고 있어요...' : label}
        </button>
      </div>
    </div>
  );
}
