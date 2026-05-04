// DailyFortunePage — #57 Sprint 2 UI 개편 (2026-04-24)
// 스펙: docs/mockups/사주500_UI개편_03_결과.md §10 (오늘운세 고유 레이아웃) · §6 (UpsellCard) · §7 (AdBanner)
// 핸드오프: §2-10
//
// 결과 구조 (§10):
//   - 상단 day-tile 96px 풀폭 · 좌 "M/D" Display 40 · 우 일주(60갑자) 한자
//   - L1 요약 (한자 32px + 점수 + 3~5문장)
//   - L2 본문 (오늘의 톤 + 시간대 흐름 압축)
//   - L3 심층 [축소] 1문단 (4영역 mini grid + reason)
//   - L4 "오늘 해볼 3가지" 고정 (체크리스트 3개 + 한 줄)
//   - AdBanner — build === 'appintos' && tier === 'free' 만
//   - UpsellCard 프리미엄 10운 (§6 단일, 과잉 금지)
//
// 보존 (절대 삭제 금지):
//   - DailyRewardBadge (P2-5)
//   - SSOT 토큰 (#41 sweep + D1 fix)
//   - Flippable 정적화 (#39) — 결과 phase에서 SajuMiniCard 제거 (day-tile로 대체) · 재플립 추가 금지

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Solar } from 'lunar-javascript';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { ErrorState } from '@/components/common/ErrorState';
import { ProfileSelector } from '@/components/common/ProfileSelector';
import { SajuMiniCard, type PillarData } from '@/components/saju/SajuMiniCard';
import { DailyRewardBadge } from '@/components/common/DailyRewardBadge';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/common/Toast';
import {
  getProfiles,
  saveReport,
  generateId,
  type SajuProfile,
} from '@/services/storage/localStore';
import { generateDailyFortune } from '@/services/ai/reportGenerator';
import { stripMd } from '@/utils/format';
import type { OhengType } from '@/types/saju';
// Phase D'-3 Bundle 2 (#54) — mockup 진본 시각 정렬
import {
  TodayRelationCard,
  TodayOhengRow,
  TodayTopicGrid,
  TodayMeetStack,
  FreeUpsellCard,
  type OhengItem,
  type TodayTopicCard,
  type TodayMeetItem,
} from './free/_chrome';
import { TOPIC_REGISTRY } from '@/constants/topics';
import { isAppintosBuild } from '@/lib/env';
import { AD_BANNER_GROUP_ID } from '@/constants/config';
import { AdSlot } from '@/components/ads/AdSlot';

/* ══════════════════════════════════════════════════════════════════
 * 토큰 / 매핑
 * ═════════════════════════════════════════════════════════════════ */

/** v4 등급 팔레트 — D1 fix: A를 SSOT gold(#B8965A), C를 SSOT gold-deep(#8C6D3D)로 정렬 */
const GRADE_V4: Record<string, string> = {
  S: '#B8965A',
  A: '#B8965A', // (D1 fix 2026-04-24: was #A08B6A)
  B: '#2D4470',
  C: '#8C6D3D', // (D1 fix 2026-04-24: was #8F6B4E)
  D: '#8F1F1C',
};

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

/** 천간(10간) → 오행 */
const STEM_TO_OHENG: Record<string, OhengType> = {
  甲: '목', 乙: '목',
  丙: '화', 丁: '화',
  戊: '토', 己: '토',
  庚: '금', 辛: '금',
  壬: '수', 癸: '수',
};

/** 오행 → day-tile 그라디언트 배경 (옅은 톤, paper 위에 자연스럽게) */
const OHENG_GRAD_BG: Record<OhengType, string> = {
  목: 'linear-gradient(135deg, #EDF6EF 0%, #C8E0CE 100%)',
  화: 'linear-gradient(135deg, #FBE9E9 0%, #F0C8C8 100%)',
  토: 'linear-gradient(135deg, #FBEFD9 0%, #F0DAB0 100%)',
  금: 'linear-gradient(135deg, #ECECEC 0%, #D6D6D6 100%)',
  수: 'linear-gradient(135deg, #E0EAF4 0%, #B8CDE3 100%)',
};

/** 오행 → 한자 강조 색 (day-tile 우측 일주 한자, L1 한자 심볼) */
const OHENG_INK: Record<OhengType, string> = {
  목: '#1F6638',
  화: '#9C2424',
  토: '#A55F11',
  금: '#4A4A4A',
  수: '#0E4582',
};

type Phase = 'select' | 'loading' | 'result' | 'error';

interface DateInfo {
  date: string;
  weekday: string;
  ganzi: string;
  label: string;
}

/* ══════════════════════════════════════════════════════════════════
 * Page
 * ═════════════════════════════════════════════════════════════════ */
export function DailyFortunePage() {
  usePageTitle('오늘의 운세');
  const navigate = useNavigate();
  const toast = useToast();
  const { mark } = useAttendanceOnResult();

  const profiles: SajuProfile[] = useMemo(() => getProfiles(), []);
  const hasAnyProfile = profiles.length > 0;

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
      // Stage 7e-8: Anthropic API 일시 500 에러 대비 — 1초 대기 후 1회 재시도
      let res;
      try {
        res = await generateDailyFortune({
          name: selectedProfile.name || '당신',
          sajuData: selectedProfile.sajuData,
          date: dateInfo.date,
          weekday: dateInfo.weekday,
          todayGanzi: dateInfo.ganzi,
        });
      } catch (retryErr: any) {
        const msg = String(retryErr?.message || '');
        const is500 = msg.includes('500') || msg.includes('Internal server error') || msg.includes('api_error');
        if (is500) {
          console.warn('[DailyFortune] Anthropic 일시 500 → 1초 후 재시도');
          await new Promise((r) => setTimeout(r, 1000));
          res = await generateDailyFortune({
            name: selectedProfile.name || '당신',
            sajuData: selectedProfile.sajuData,
            date: dateInfo.date,
            weekday: dateInfo.weekday,
            todayGanzi: dateInfo.ganzi,
          });
        } else {
          throw retryErr;
        }
      }

      // PRD §11.1 — 0점/B등급 fallback 금지 (필수 필드 누락 시 에러)
      if (
        !res ||
        typeof res !== 'object' ||
        (!('overallScore' in res) && !('score' in res))
      ) {
        throw new Error('응답 데이터 형식이 올바르지 않아요');
      }

      setResult(res);
      setPhase('result');

      // 이벤트 v4 출석 마커 (KST 당일 1회) — 보존
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <Header title="오늘의 운세" />
      <div className="px-5 pt-4 pb-[120px] mx-auto" style={{ maxWidth: 520 }}>
        {/* P2-5 · 데일리 리워드 배지 (보존) */}
        {hasAnyProfile && <DailyRewardBadge className="mb-4" />}

        <AnimatePresence mode="wait">
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
              <p
                className="text-body-sm"
                style={{ color: 'var(--text-muted)', textAlign: 'center' }}
              >
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
              dateInfo={dateInfo}
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
              onPremiumUpsell={() => {
                // 프리미엄 10운 — 2026-04-27 4 패키지 정정 (10본 + 5보너스 = 5,000원)
                toast.show('종합 사주를 위해 10운 충전 페이지로 이동해요', 'info');
                navigate('/charge?need=10');
              }}
              onRetry={analyze}
            />
          )}
        </AnimatePresence>

        {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) */}
        <div className="mt-10 text-center space-y-1">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반
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
 * SelectView — 진입 화면 (프로필 선택 + 분석 시작)
 * ═════════════════════════════════════════════════════════════════ */
function SelectView({
  profiles,
  selectedProfileId,
  onProfileChange,
  onCreateNew,
  profile,
  dateInfo,
  onAnalyze,
}: {
  profiles: SajuProfile[];
  selectedProfileId: string | null;
  onProfileChange: (id: string) => void;
  onCreateNew: () => void;
  profile: SajuProfile | null;
  dateInfo: DateInfo;
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
          <p className="sec-meta">{dateInfo.label}</p>
          <h2 className="sec-title-lg" style={{ marginTop: 8 }}>
            {profile?.name ?? '당신'}님의<br />오늘 운세를 풀어드릴게요
          </h2>
          <p
            className="text-body-md"
            style={{ color: 'var(--text-muted)', marginTop: 10 }}
          >
            일주와 오늘 간지의 작용, 용신·대운 흐름까지 함께 살펴볼게요.
          </p>
        </section>
      </FadeIn>

      {/* 사주 원국 미리보기 — 정적 SajuMiniCard (Flippable 정적화 #39 보존) */}
      {hasSajuData && (
        <FadeIn delay={0.1}>
          <section className="card-secondary">
            <p className="sec-title" style={{ marginBottom: 12 }}>내 사주 원국</p>
            <SajuMiniCard pillars={pillars} />
          </section>
        </FadeIn>
      )}

      <div className="sticky-cta-bottom">
        <button className="cta-gold" onClick={onAnalyze} disabled={!hasSajuData}>
          오늘의 운세 보기 (무료)
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ResultView — 새 §10 레이아웃 (day-tile + L1~L4 축소형 + Ad + Upsell)
 * ═════════════════════════════════════════════════════════════════ */
function ResultView({
  result,
  profile,
  profiles,
  selectedProfileId,
  onProfileChange,
  onCreateNew,
  dateInfo,
  onPremiumUpsell,
  onRetry,
}: {
  result: any;
  profile: SajuProfile;
  profiles: SajuProfile[];
  selectedProfileId: string | null;
  onProfileChange: (id: string) => void;
  onCreateNew: () => void;
  dateInfo: DateInfo;
  onPremiumUpsell: () => void;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  // ── 스키마 파싱 (v4.1 + 레거시 호환)
  const score = clampScore(result?.overallScore ?? result?.score);
  const grade = String(result?.grade ?? 'B').toUpperCase();
  const gradeColor = GRADE_V4[grade] ?? '#B8965A';
  const title = stripMd(String(result?.title ?? result?.headline ?? '오늘의 운세'));
  const todayNarrative = stripMd(String(result?.todayNarrative ?? result?.summary ?? ''));
  const keywords: string[] = Array.isArray(result?.keywords) ? result.keywords.slice(0, 5) : [];
  const sajuTone = stripMd(String(result?.sajuTone ?? ''));
  const subScores = result?.subScores ?? result?.scores;
  const subScoreReasons = result?.subScoreReasons;
  const timeSlots: any[] = Array.isArray(result?.timeSlots) ? result.timeSlots : [];
  const doList: string[] = Array.isArray(result?.doList) ? result.doList.slice(0, 3) : [];
  const oneLiner = stripMd(String(result?.oneLiner ?? result?.dailyMessage ?? ''));

  // ── day-tile 색상 (오늘 일간 오행)
  const dayOheng: OhengType = useMemo(
    () => getDayOheng(dateInfo.ganzi),
    [dateInfo.ganzi],
  );

  // ── L1 한자 심볼 = 오늘 일간 (예: 癸亥 → 癸)
  const dayStem = dateInfo.ganzi?.[0] ?? '';

  // ── Phase D'-3 Bundle 2 · 내 일간 vs 오늘 일진 관계 (TodayRelationCard용)
  const myGan = profile?.sajuData?.pillars?.[2]?.천간 || '';
  const myGanReading = profile?.sajuData?.pillars?.[2]?.천간읽기 || '';
  const myOhengKr = profile?.sajuData?.pillars?.[2]?.천간오행 || '';
  const todayGanReading = useMemo(() => {
    // 천간 한자 → 한글 읽기 (한자→한글)
    const map: Record<string, string> = {
      甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
      己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
    };
    return map[dayStem] || '';
  }, [dayStem]);
  const todayOhengKr: OhengType = dayOheng;
  // 관계 라벨 (생/극 매핑)
  const relationLabel = useMemo(() => {
    if (!myOhengKr || !todayOhengKr) return '오행 만남';
    const sangsaeng: Record<string, string> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
    const sanggeuk: Record<string, string> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
    if (myOhengKr === todayOhengKr) return `${myOhengKr}·${todayOhengKr} 비화`;
    if (sangsaeng[myOhengKr] === todayOhengKr) return `${myOhengKr}생${todayOhengKr}`;
    if (sangsaeng[todayOhengKr] === myOhengKr) return `${todayOhengKr}생${myOhengKr}`;
    if (sanggeuk[myOhengKr] === todayOhengKr) return `${myOhengKr}극${todayOhengKr}`;
    if (sanggeuk[todayOhengKr] === myOhengKr) return `${todayOhengKr}극${myOhengKr}`;
    return `${myOhengKr}·${todayOhengKr} 만남`;
  }, [myOhengKr, todayOhengKr]);

  // ── Phase D'-3 Bundle 2 · 5오행 분포 (TodayOhengRow용)
  const ohengItems: OhengItem[] = useMemo(() => {
    const elems = profile?.sajuData?.elements ?? {};
    const order: Array<'목' | '화' | '토' | '금' | '수'> = ['목', '화', '토', '금', '수'];
    return order.map((k) => {
      const qty = Number(elems[k] ?? 0);
      const todayBonus = k === todayOhengKr ? '+1' : undefined;
      return {
        oheng: k,
        qty,
        todayBonus,
        lack: qty === 0,
      };
    });
  }, [profile, todayOhengKr]);

  // ── Phase D'-3 Bundle 2 · 끌어주는/부딪히는 사람 (AI result.meet 있을 때만)
  const meetItems: TodayMeetItem[] | null = useMemo(() => {
    const aiMeet = result?.meet;
    if (!aiMeet || !Array.isArray(aiMeet) || aiMeet.length === 0) return null;
    return aiMeet.slice(0, 2).map((m: any) => ({
      variant: m.variant === 'clash' ? 'clash' : 'boost',
      ganChars: String(m.ganChars || m.gan || ''),
      title: stripMd(String(m.title || '')),
      tag: String(m.tag || (m.variant === 'clash' ? '− 충돌' : '+ 보완')),
      body: stripMd(String(m.body || m.desc || '')),
    }));
  }, [result]);

  // ── L2 시간대 grid + 현재 슬롯 tip
  const currentHour = useMemo(() => new Date().getHours(), []);
  const slotsCompact = useMemo(
    () =>
      timeSlots.slice(0, 4).map((s) => ({
        slot: String(s?.slot ?? '오전'),
        range: String(s?.range ?? ''),
        score: clampScore(s?.score),
        tip: stripMd(String(s?.message ?? s?.tip ?? '')),
      })),
    [timeSlots],
  );
  const currentSlotIdx = useMemo(() => {
    if (currentHour < 6) return 3; // 새벽 → 밤 슬롯에 매핑 (24h wrap)
    if (currentHour < 12) return 0;
    if (currentHour < 18) return 1;
    if (currentHour < 22) return 2;
    return 3;
  }, [currentHour]);
  const currentSlot = slotsCompact[currentSlotIdx];

  // ── L3 1문단 (subScoreReasons 중 최고점 reason 또는 첫 비어있지 않은 값)
  const l3Paragraph = useMemo(
    () => pickL3Paragraph(subScores, subScoreReasons),
    [subScores, subScoreReasons],
  );

  // ── 광고 노출 조건 (스펙 §7) — /daily는 항상 free, blur 없음
  const showAd = isAppintosBuild;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* S0 프로필 선택 (보존) */}
      <FadeIn>
        <ProfileSelector
          profiles={profiles}
          selectedId={selectedProfileId}
          onChange={onProfileChange}
          onCreateNew={onCreateNew}
        />
      </FadeIn>

      {/* ─── §10. day-tile (96px 풀폭 · M/D + 일주 한자) ─── */}
      <FadeIn delay={0.04}>
        <DayTile
          dateInfo={dateInfo}
          profileName={profile.name || '당신'}
          dayOheng={dayOheng}
        />
      </FadeIn>

      {/* ─── L1 — 요약 (Hook · 한자 심볼 + 점수 + 3-5문장) ─── */}
      <FadeIn delay={0.08}>
        <section className="card-primary" style={{ padding: 20 }}>
          {/* 한자 심볼 32px (오늘 일간) */}
          {dayStem && (
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: OHENG_INK[dayOheng],
                fontFamily: "'Noto Serif KR', serif",
                lineHeight: 1,
                marginBottom: 12,
                letterSpacing: '0.02em',
              }}
              aria-label={`오늘의 일간 ${dayStem} (${dayOheng})`}
            >
              {dayStem}
            </div>
          )}
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

          {todayNarrative && (
            <p
              className="text-body-md"
              style={{
                marginTop: 14,
                lineHeight: 1.75,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-line',
              }}
            >
              {/* 3~5문장: 320자 + 자연 문장 끊기 */}
              {truncate(todayNarrative, 320)}
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

      {/* ─── L2 — 본문 (Expansion · 오늘의 톤 + 시간대 흐름) ─── */}
      {sajuTone && (
        <FadeIn delay={0.12}>
          <section className="card-primary">
            <p className="sec-meta" style={{ marginBottom: 8, color: '#8C6D3D' }}>
              오늘의 톤
            </p>
            <p
              className="text-body-md"
              style={{
                whiteSpace: 'pre-line',
                lineHeight: 1.75,
                color: 'var(--text-primary)',
              }}
            >
              {sajuTone}
            </p>
          </section>
        </FadeIn>
      )}

      {slotsCompact.length === 4 && (
        <FadeIn delay={0.16}>
          <section className="card-primary">
            <p className="sec-meta" style={{ marginBottom: 10, color: '#8C6D3D' }}>
              시간대별 흐름
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
              }}
            >
              {slotsCompact.map((s, i) => {
                const active = i === currentSlotIdx;
                return (
                  <div
                    key={i}
                    style={{
                      padding: '10px 6px',
                      textAlign: 'center',
                      background: active ? 'rgba(184,150,90,0.14)' : '#F8F5EE',
                      borderRadius: 10,
                      border: active
                        ? '2px solid #B8965A'
                        : '1px solid var(--border-light)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: active ? '#8C6D3D' : 'var(--text-muted)',
                      }}
                    >
                      {s.slot}
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: active ? '#8C6D3D' : '#1A1A1A',
                        marginTop: 4,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {s.score}
                    </div>
                  </div>
                );
              })}
            </div>
            {currentSlot?.tip && (
              <p
                className="text-body-sm"
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  background: 'rgba(184,150,90,0.08)',
                  borderRadius: 10,
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: '#8C6D3D', marginRight: 4 }}>
                  지금 ({currentSlot.slot})
                </strong>
                {currentSlot.tip}
              </p>
            )}
          </section>
        </FadeIn>
      )}

      {/* ─── Phase D'-3 Bundle 2 · TodayRelationCard (내 일간 vs 오늘 일진) ─── */}
      {myGan && dayStem && (
        <FadeIn delay={0.18}>
          <div style={{ margin: '0 -20px' }}>
            <TodayRelationCard
              myGan={myGan}
              myGanName={`${myGanReading}(${myGan}) · ${myOhengKr}`}
              todayGan={dayStem}
              todayGanName={`${todayGanReading}(${dayStem}) · ${todayOhengKr}`}
              relationLabel={relationLabel}
              explain={(() => {
                // AI 응답 우선 → 없을 때 사주 일간 글자 직접 호명한 동적 풀이
                const aiExplain = String((result as any)?.relationExplain ?? '').trim();
                if (aiExplain.length >= 12) return stripMd(aiExplain);
                // 사주별 차별화 — 일간 한자 + 오늘 일진 한자 직접 호명
                const myLabel = `${myGan}(${myGanReading})`;
                const todayLabel = `${dayStem}(${todayGanReading})`;
                if (myOhengKr === todayOhengKr) {
                  return `오늘 ${todayLabel} 와 내 일간 ${myLabel} 이 같은 ${myOhengKr}(${myOhengKr === '목' ? '木' : myOhengKr === '화' ? '火' : myOhengKr === '토' ? '土' : myOhengKr === '금' ? '金' : '水'}) 결로 만나는 자리. 익숙한 결을 더 진하게 쓰는 하루 — 결정·실행은 빠르되, 의견은 한 결로 쏠릴 위험.`;
                }
                if (relationLabel.includes('생')) {
                  return `오늘 ${todayLabel}(${todayOhengKr}) 가 내 일간 ${myLabel}(${myOhengKr}) 을 살려주는 흐름. 평소보다 받치는 결이 또렷한 하루 — 도움 청하기·학습·정비에 좋습니다.`;
                }
                if (relationLabel.includes('극')) {
                  return `오늘 ${todayLabel}(${todayOhengKr}) 와 내 일간 ${myLabel}(${myOhengKr}) 이 부딪히는 자리. 한 박자 늦추는 하루 — 큰 결정·민감한 대화·계약은 다음 날로 미루는 편이 안전.`;
                }
                if (relationLabel.includes('재') || relationLabel.includes('관')) {
                  return `오늘 ${todayLabel}(${todayOhengKr}) 가 내 일간 ${myLabel}(${myOhengKr}) 에 ${relationLabel} 으로 작동. 실리·책임의 결이 따라오는 하루 — 받을 것 받고, 정리할 것 정리하기 좋습니다.`;
                }
                if (relationLabel.includes('식') || relationLabel.includes('상')) {
                  return `오늘 ${todayLabel}(${todayOhengKr}) 가 내 일간 ${myLabel}(${myOhengKr}) 에 ${relationLabel} 으로 작동. 표현·창작의 결이 살아나는 하루 — 발표·콘텐츠·소통이 잘 풀립니다.`;
                }
                return `오늘 ${todayLabel}(${todayOhengKr}) 와 내 일간 ${myLabel}(${myOhengKr}) — ${relationLabel} 의 자리. 결의 방향을 살펴보는 하루.`;
              })()}
            />
          </div>
        </FadeIn>
      )}

      {/* ─── Phase D'-3 Bundle 2 · TodayOhengRow (5오행 분포 + 오늘 보충) ─── */}
      {ohengItems.length === 5 && (
        <FadeIn delay={0.19}>
          <div style={{ margin: '0 -20px' }}>
            <TodayOhengRow items={ohengItems} />
          </div>
        </FadeIn>
      )}

      {/* ─── L3 — 심층 [축소: 1문단] · 4영역 mini grid + reason ─── */}
      {(subScores || l3Paragraph) && (
        <FadeIn delay={0.2}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 10 }}>오늘의 결</p>
            {subScores && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 6,
                  marginBottom: l3Paragraph ? 12 : 0,
                }}
              >
                {[
                  { k: '재물운', label: '재물' },
                  { k: '애정운', label: '애정' },
                  { k: '건강운', label: '건강' },
                  { k: '성장운', label: '성장' },
                ].map(({ k, label }) => {
                  const v = subScores?.[k];
                  const sc =
                    typeof v === 'number' ? clampScore(v) : clampScore(v?.score);
                  return (
                    <div
                      key={k}
                      style={{
                        textAlign: 'center',
                        padding: '10px 4px',
                        background: '#F8F5EE',
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: '#B8965A',
                          marginTop: 3,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {sc}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {l3Paragraph && (
              <p
                className="text-body-md"
                style={{
                  lineHeight: 1.75,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-line',
                }}
              >
                {l3Paragraph}
              </p>
            )}
          </section>
        </FadeIn>
      )}

      {/* ─── L4 — "오늘 해볼 3가지" 고정 ─── */}
      <FadeIn delay={0.24}>
        <section className="card-primary">
          <p className="sec-title" style={{ marginBottom: 12 }}>
            오늘 해볼 3가지
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
            {Array.from({ length: 3 }).map((_, i) => {
              const item = doList[i];
              return (
                <li
                  key={i}
                  className="text-body-md flex items-start gap-3"
                  style={{ lineHeight: 1.6 }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      background: 'rgba(184,150,90,0.14)',
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#8C6D3D',
                      fontWeight: 800,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: item ? '#1A1A1A' : 'var(--text-muted)' }}>
                    {item ? stripMd(item) : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
          {oneLiner && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--border-light)',
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  fontStyle: 'italic',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  paddingLeft: 12,
                  borderLeft: '2px solid #B8965A',
                  margin: 0,
                }}
              >
                {oneLiner}
              </p>
            </div>
          )}
        </section>
      </FadeIn>

      {/* ─── Phase D'-3 Bundle 2 · TodayMeetStack (AI result.meet 있을 때만) ─── */}
      {meetItems && meetItems.length > 0 && (
        <FadeIn delay={0.26}>
          <section className="card-primary">
            <p className="sec-title" style={{ marginBottom: 12 }}>오늘 만나는 사람</p>
            <TodayMeetStack items={meetItems} />
          </section>
        </FadeIn>
      )}

      {/* ─── Phase D'-3 Bundle 2 · TodayTopicGrid (4 토픽 cross-discover · TOPIC_REGISTRY consume) ─── */}
      <FadeIn delay={0.27}>
        <section className="card-primary">
          <p className="sec-title" style={{ marginBottom: 12 }}>주제별로 더 깊게</p>
          <TodayTopicGrid
            cards={(() => {
              // 사주별 동적 oneLiner — 점수 + AI 응답의 topicHints 우선, 없으면 점수 분기
              // (이전: 4 카드 모두 모든 사용자에게 동일한 정적 카피 박혀있었음)
              const aiHints = (result as any)?.topicHints || {};
              function dynLine(key: 'wealth' | 'love' | 'career' | 'health', score: number): string {
                // AI 응답 우선
                const aiH = String(aiHints?.[key] ?? '').trim();
                if (aiH.length >= 8) return stripMd(aiH);
                // 점수 분기 — 사주별 점수가 다르므로 카피도 자연 분화
                const s = Number(score) || 0;
                const lines: Record<typeof key, [string, string, string]> = {
                  wealth: ['오늘은 돈의 흐름이 걷히는 자리.', '들어올 돈은 잡고, 새는 자리는 막을 하루.', '큰 돈 결정은 미루고 받을 돈 챙기는 하루.'],
                  love:   ['오늘은 인연이 또렷해지는 자리.', '있는 관계 한 번 더 챙기면 결이 깊어집니다.', '먼저 다가가지 말고 거리 두는 하루.'],
                  career: ['오늘은 자리·이름이 자라는 결.', '쌓아온 결을 보여줄 한 자리가 생깁니다.', '결과보다 과정에 무게를 두는 하루.'],
                  health: ['오늘은 몸의 결이 또렷한 자리.', '평소보다 한 박자 천천히 — 회복이 본업.', '무리하지 말고 기본기로 돌아가는 하루.'],
                };
                const [strong, mid, weak] = lines[key];
                if (s >= 7) return strong;
                if (s >= 5) return mid;
                return weak;
              }
              const wealthScore = clampScore(subScores?.['재물운']?.score ?? subScores?.['재물운'] ?? 0) / 10;
              const loveScore = clampScore(subScores?.['애정운']?.score ?? subScores?.['애정운'] ?? 0) / 10;
              const careerScore = clampScore(subScores?.['성장운']?.score ?? subScores?.['성장운'] ?? 0) / 10;
              const healthScore = clampScore(subScores?.['건강운']?.score ?? subScores?.['건강운'] ?? 0) / 10;
              return [
                {
                  key: 'money',
                  label: TOPIC_REGISTRY.wealth.label,
                  hanja: TOPIC_REGISTRY.wealth.kanji,
                  score: wealthScore,
                  oneLiner: dynLine('wealth', wealthScore),
                  ctaText: '재물운 한 달치 더 보기',
                  onTap: () => navigate('/topic/wealth'),
                },
                {
                  key: 'rel',
                  label: TOPIC_REGISTRY.love.label,
                  hanja: TOPIC_REGISTRY.love.kanji,
                  score: loveScore,
                  oneLiner: dynLine('love', loveScore),
                  ctaText: '관계·연애운 깊이 보기',
                  onTap: () => navigate('/topic/love'),
                },
                {
                  key: 'work',
                  label: TOPIC_REGISTRY.career.label,
                  hanja: TOPIC_REGISTRY.career.kanji,
                  score: careerScore,
                  oneLiner: dynLine('career', careerScore),
                  ctaText: '직업·진로운 깊이 보기',
                  onTap: () => navigate('/topic/career'),
                },
                {
                  key: 'health',
                  label: TOPIC_REGISTRY.health.label,
                  hanja: TOPIC_REGISTRY.health.kanji,
                  score: healthScore,
                  oneLiner: dynLine('health', healthScore),
                  ctaText: '건강·체질운 깊이 보기',
                  onTap: () => navigate('/topic/health'),
                },
              ] as TodayTopicCard[];
            })()}
          />
        </section>
      </FadeIn>

      {/* ─── §7. AdBanner — L4 바로 아래 (build === 'appintos' && tier === 'free' 만)
              #ad-sdk-wire: AdSlot (TossAds SDK) 정식 연결 — 실패 시 silent fallback ─── */}
      {showAd && (
        <FadeIn delay={0.28}>
          <AdSlot unit={AD_BANNER_GROUP_ID} minHeight={90} />
        </FadeIn>
      )}

      {/* ─── §6. UpsellCard — Phase D'-3 Bundle 2 정렬: FreeUpsellCard (단일 CTA) ─── */}
      <FadeIn delay={0.32}>
        <FreeUpsellCard
          title="사주 전체로 더 깊이 풀어드릴까요"
          desc="대운별 흐름·평생의 결·관계·재물·건강까지. 사주 전체에서 한 번에 풀어냅니다."
          onTap={onPremiumUpsell}
        />
      </FadeIn>

      {/* 다시 분석하기 */}
      <button
        className="cta-ghost"
        onClick={onRetry}
        style={{ marginTop: 6 }}
      >
        다시 분석하기
      </button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * DayTile — 96px 풀폭 · M/D + 일주 한자 + 일간 오행 그라디언트
 * ═════════════════════════════════════════════════════════════════ */
function DayTile({
  dateInfo,
  profileName,
  dayOheng,
}: {
  dateInfo: DateInfo;
  profileName: string;
  dayOheng: OhengType;
}) {
  // dateInfo.label = "M월 D일 요일요일" 형식 → "M/D" 추출
  const m = dateInfo.label.match(/(\d+)월\s*(\d+)일/);
  const md = m ? `${m[1]}/${m[2]}` : '-/-';
  const ganzi = dateInfo.ganzi || '——';
  const accent = OHENG_INK[dayOheng];
  return (
    <div
      role="banner"
      aria-label={`${md} ${dateInfo.weekday}요일 · 일주 ${ganzi}`}
      style={{
        width: '100%',
        height: 96,
        background: OHENG_GRAD_BG[dayOheng],
        borderRadius: 16,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        border: `1px solid ${accent}28`,
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset',
      }}
    >
      {/* 좌: M/D Display 40 + 부속 캡션 */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            lineHeight: 1,
            color: '#1A1A1A',
            letterSpacing: '-0.04em',
          }}
        >
          {md}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            fontWeight: 600,
            color: accent,
            letterSpacing: '0.02em',
          }}
        >
          {dateInfo.weekday}요일 · {profileName}님의 오늘
        </div>
      </div>
      {/* 우: 일주(60갑자) 한자 — Noto Serif */}
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: accent,
          fontFamily: "'Noto Serif KR', serif",
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}
        aria-hidden
      >
        {ganzi}
      </div>
    </div>
  );
}

/* Phase D'-3 Bundle 2 — UpsellCard 인라인 정의 제거. FreeUpsellCard (free/_chrome.tsx) 로 통합. */
/* Phase 4 #ad-sdk-wire — AdBannerPlaceholder 인라인 정의 제거. AdSlot (components/ads/AdSlot.tsx) 로 통합. */

/* ══════════════════════════════════════════════════════════════════
 * ScoreDonut
 * ═════════════════════════════════════════════════════════════════ */
function ScoreDonut({ score, color }: { score: number; color: string }) {
  const size = 88;
  const strokeWidth = 8;
  const r = size / 2 - strokeWidth;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div
      style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(27,42,74,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
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
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
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
        <span
          style={{
            fontSize: 24,
            fontWeight: 900,
            color,
            letterSpacing: '-0.03em',
          }}
        >
          {score}
        </span>
        <span className="sec-caption" style={{ fontSize: 10 }}>점</span>
      </div>
    </div>
  );
}

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

function buildTodayGanzi(d: Date): DateInfo {
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

function getDayOheng(ganzi: string): OhengType {
  const stem = ganzi?.[0] ?? '';
  return STEM_TO_OHENG[stem] ?? '토';
}

/** L1 narrative 자연 문장 끊기 truncate */
function truncate(s: string, max: number): string {
  if (!s) return '';
  if (s.length <= max) return s;
  const tail = s.slice(0, max);
  const candidates = [
    tail.lastIndexOf('. '),
    tail.lastIndexOf('.\n'),
    tail.lastIndexOf('。'),
    tail.lastIndexOf('? '),
    tail.lastIndexOf('! '),
  ];
  const cut = Math.max(...candidates);
  if (cut > max * 0.5) return s.slice(0, cut + 1).trim();
  return s.slice(0, max).trim() + '…';
}

/** L3 1문단 — 최고점 영역 reason 우선, 없으면 첫 비어있지 않은 reason */
function pickL3Paragraph(subScores: any, reasons: any): string {
  if (!reasons || typeof reasons !== 'object') return '';
  if (subScores && typeof subScores === 'object') {
    const entries = Object.entries(subScores)
      .map(([k, v]: any) => {
        const sc = typeof v === 'number' ? v : v?.score ?? 0;
        return [k, Number(sc) || 0] as [string, number];
      })
      .sort((a, b) => b[1] - a[1]);
    const topKey = entries[0]?.[0];
    if (topKey && reasons[topKey]) {
      return stripMd(String(reasons[topKey]));
    }
  }
  const firstReason = Object.values(reasons).find(
    (r) => r && typeof r === 'string',
  );
  return firstReason ? stripMd(String(firstReason)) : '';
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
