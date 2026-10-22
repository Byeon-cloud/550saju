/**
 * #saju-card-share · 만세력 카드 페이지 (Develop 통합 버전)
 *
 * 라우트: /saju-card/:profileId
 * 진입점: StoragePage 프로필 카드의 "사주 카드" 아이콘
 *
 * 디자인 (2026-04-27 디벨롭 — chrome 패턴 통일):
 *   §1. SajuCardHero (풀폭 gradient + 일주 한자 워터마크 + 별명 + 시적 hint) — _chrome.tsx
 *   §2. 출생 정보 (양/음력 + 시간 + KR 진태양시 보정 라벨)
 *   §3. 4 기둥 8글자 그리드 (오행 컬러칩 · 일주 골드 강조)
 *   §4. 십성·지장간·운성·신살 — **4 별도 카드 분리** (잘림 0건) · _chrome SajuCardLabelRow
 *   §5. 다이어그램 3종 — _diagrams.tsx (오행 5각 radar / 십성 도넛 / 4기둥 계절 띠)
 *   §6. 신살 (길성·중성·흉살 톤별)
 *   §7. 합·충·형·공망 chip list
 *   §8. 푸터 (로고 + CTA + 디스클레이머)
 *
 * 보존 (절대 무수정):
 *   - iljuAnimal.ts / sinsal.ts / relations.ts / calculator.ts
 *   - lunar-javascript KR 진태양시 보정
 *   - 이모지 0건 (정책 (b) 100% — 한자 + 컬러칩만)
 *   - SSOT 토큰 + Phase 누락 보강 2 패턴 디스클레이머
 *
 * Export 모드 (Develop 작업 5):
 *   - "이미지 저장" 버튼 → 모드 시트 (페이지 그대로 / 1×1 / 9×16)
 *   - "공유하기" 버튼 → 자동 1200×630 (카톡 호환)
 *   - export-only DOM (offscreen) — _export-layout.tsx
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import '@/styles/hanji.css';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Solar } from 'lunar-javascript';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/components/common/Toast';
import { HJ, SERIF as HJ_SERIF, GoldCta, GhostButton } from '@/components/hanji/Hanji';
import { isAppsInToss } from '@/services/payment/iapService';
import { isAppintosBuild } from '@/lib/env';
import { CalcNote, ShareRow, FlowNow, NextSteps, TodayNextStep } from './_manse_extras';
// Stage 4: OHENG_MAP — IdentityCard 가 자체 OHENG_ACCENT 매핑 사용, 미사용
// import { OHENG_MAP } from '@/constants/oheng';
import { getIljuAnimal } from '@/constants/iljuAnimal';
import { calculateSaju } from '@/services/saju/calculator';
import { analyzeSinsal, type SinsalHit } from '@/services/saju/sinsal';
import { analyzeRelations } from '@/services/saju/relations';
import type { SajuData, OhengType } from '@/types/saju';
import type { SajuProfile } from '@/services/storage/localStore';
// 2026-05-29 — 종합사주 가격 SSOT (런칭 세일 10운→5운 반영). 하드코딩 "10운" 박멸.
import { getPremiumPrice } from '@/constants/pricing';
import {
  captureSajuCardAsBlob,
  downloadBlob,
  shareSajuCardImage,
  shareSajuCardViaToss,
  buildSajuCardFilename,
  buildShareTextAndUrl,
} from '@/components/saju-card/SajuCardExport';
// Develop — 통일 chrome (Stage 7e — SajuCardSection / FooterCard / FlowTablesGroup 모두 폐지)
import { OHENG_THEME } from './_chrome';
// Stage 4 ⭐ — 정체성 카드 (1 화면 fit, SSOT 보존)
import { IdentityCard } from './_identity_card';
// Stage 7e — 자세히 영역에는 12운성 사이클만 (신살은 IdentityCard 안에 흡수, 운의 흐름/Section05 폐지)
import { Component12UnseongSection } from './_visual_section';
// Stage 4-3: 기존 다이어그램 / SajuCardLabelRow / DiagramHeader 등 helper 들은
// SajuDetailsTable 이 흡수했으므로 미사용. 코드 정리 위해 import 제거.
// Round 2 — Export 전용 layout
import { SajuCardExportLayout, EXPORT_SCALE, type ExportMode } from './_export-layout';
// Round 2 ⭐ — 천을귀인 인장 (시그니처 시각 자산)
// Stage 4: GwiinSealCard — IdentityCard 안에 인장이 통합돼서 미사용 (pickPrimaryGwiin 만 사용)
import { pickPrimaryGwiin } from './_gwiin_seal';
// Stage 4-3: lookupSipsung — SajuDetailsTable 가 흡수, 미사용

const PROFILES_KEY = 'saju500_profiles';

/* ══════════════════════════════════════════════════════════════════
 * SSOT 토큰 (D1)
 * ═════════════════════════════════════════════════════════════════ */
const C = {
  paper: '#F8F5EE',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#6F6557',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.10)',
  goldLine: 'rgba(184,150,90,0.40)',
  cardLine: 'rgba(184,150,90,0.18)',
  line: '#E5DFD0',
  danger: '#C04D4D',
} as const;

const SERIF = "'Noto Serif KR', 'Apple SD Gothic Neo', serif";

/* 시지 한국어 (자시·축시·...) */
const HOUR_KO_MAP: Record<number, string> = {
  0: '자시', 1: '축시', 3: '인시', 5: '묘시', 7: '진시', 9: '사시',
  11: '오시', 13: '미시', 15: '신시', 17: '유시', 19: '술시', 21: '해시',
};
function formatHourKo(hour?: number): string {
  if (hour === undefined) return '';
  return HOUR_KO_MAP[hour] ?? `${hour}시`;
}

/* ══════════════════════════════════════════════════════════════════
 * 페이지
 * ═════════════════════════════════════════════════════════════════ */
export function SajuCardPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const profile = useMemo(() => loadProfile(profileId), [profileId]);

  const sajuData: SajuData | null = useMemo(() => {
    if (!profile) return null;
    if (profile.sajuData) return profile.sajuData;
    try { return calculateSaju(profile.input); } catch { return null; }
  }, [profile]);

  const sinsalAnalysis = useMemo(
    () => (sajuData ? analyzeSinsal(sajuData.pillars) : null),
    [sajuData],
  );
  // Stage 7b: relationsAnalysis 미사용 (합충형공망 매트릭스 폐지). Solar/Lunar 라벨도 인장 카드로 흡수.
  void Solar;
  void analyzeRelations;

  const [exportBusy, setExportBusy] = useState<'save' | 'share' | null>(null);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const exportLayoutRef = useRef<HTMLDivElement | null>(null);
  const [renderedExportMode, setRenderedExportMode] = useState<ExportMode | null>(null);

  useEffect(() => {
    if (!profileId) navigate('/storage', { replace: true });
  }, [profileId, navigate]);

  if (!profile) {
    // 2026-10-15 — 공유 링크로 들어온 사람은 그 프로필이 기기에 없다. 막다른 '프로필을 찾을 수 없어요' 대신 안내와 다음 행동.
    const q = new URLSearchParams(location.search);
    const shared = q.has('i') || q.get('ref') === 'share';
    return (
      <NotFoundView
        shared={shared}
        ilju={(q.get('i') || '').slice(0, 2)}
        onInput={() => navigate('/input?new=1')}
        onHome={() => navigate('/', { replace: true })}
        onStorage={() => navigate('/storage')}
      />
    );
  }
  if (!sajuData) {
    return (
      <div style={{ background: C.paper, minHeight: '100vh' }}>
        <Header title="사주 카드" />
        <div style={{ padding: 40, textAlign: 'center', color: C.mute }}>
          사주 데이터를 계산할 수 없어요.
        </div>
      </div>
    );
  }

  /* ─── 데이터 도출 ─── */
  const ilgan = sajuData.pillars[2]?.천간 || '';
  const ilji = sajuData.pillars[2]?.지지 || '';
  const ilju = ilgan + ilji;
  const animal = getIljuAnimal(ilju);
  const dayOheng = (sajuData.pillars[2]?.천간오행 || '토') as OhengType;
  // Stage 7e: theme 미사용 (자세히 영역 SajuCardSection 폐지)
  void OHENG_THEME[dayOheng];

  /* ─── 캡처 헬퍼 ─── */
  async function captureBlob(element?: HTMLElement | null): Promise<Blob | null> {
    try {
      return await captureSajuCardAsBlob({
        element: element ?? undefined,
        scale: element ? EXPORT_SCALE : 2, // 2026-10-15 공유 이미지 v2 — 폰 크기(360)로 짜고 3배로 찍어 1080. 페이지 그대로는 2x
        backgroundColor: C.paper,
      });
    } catch (err: any) {
      console.error('[SajuCard] capture failed:', err);
      // 2026-10-15 — 원본 오류 문구(영문)는 로그로만
      toast.show('이미지를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요', 'warning');
      return null;
    }
  }

  /** Export 모드별 캡처 + 다운로드 — offscreen DOM 마운트 → 1프레임 대기 → 캡처 */
  async function exportInMode(mode: 'page' | ExportMode) {
    if (!profile) return;
    setExportBusy('save');
    setShowExportSheet(false);
    try {
      let blob: Blob | null;
      let suffix = '';
      if (mode === 'page') {
        blob = await captureBlob();
      } else {
        // 1. export-only DOM 렌더 트리거
        setRenderedExportMode(mode);
        // 2. paint 대기 (1 RAF + 폰트 ready)
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if ((document as any).fonts?.ready) {
          try { await (document as any).fonts.ready; } catch { /* noop */ }
        }
        await new Promise((r) => setTimeout(r, 60));
        // 3. 캡처
        blob = await captureBlob(exportLayoutRef.current);
        suffix = `_${mode}`;
      }
      if (!blob) return;
      const birthDate = `${profile.input.birthYear}${String(profile.input.birthMonth).padStart(2, '0')}${String(profile.input.birthDay).padStart(2, '0')}`;
      const filename = buildSajuCardFilename(profile.name + suffix, birthDate);
      downloadBlob(blob, filename);
      toast.show('이미지가 저장됐어요', 'success');
    } finally {
      setExportBusy(null);
      // export DOM 은 다음 캡처 빠른 응답 위해 유지 (메모리 무시 가능)
    }
  }

  /** 공유하기 — 카톡 호환 1200×630 export DOM 사용 */
  async function handleShare() {
    if (exportBusy) return;
    if (!profile) return;
    setExportBusy('share');
    // 2026-10-15 — 앱(토스)에서는 다른 결과 공유처럼 토스 공유(공유 링크 + 공유 시트). 웹 방식(navigator.share,
    //   클립보드, 강제 다운로드)을 앱에서 쓰면 미니앱 주소가 박힌 링크가 나갔다. 카드 이미지는 '이미지 저장'으로.
    if (isAppsInToss()) {
      try {
        const ok = await shareSajuCardViaToss(profile.id, ilju || undefined);
        if (!ok) toast.show('공유를 열지 못했어요. 잠시 뒤 다시 시도해 주세요', 'warning');
      } finally {
        setExportBusy(null);
      }
      return;
    }
    try {
      // 카톡 호환 사이즈 export DOM 렌더
      setRenderedExportMode('kakao-share');
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if ((document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch { /* noop */ }
      }
      await new Promise((r) => setTimeout(r, 60));

      const blob = await captureBlob(exportLayoutRef.current);
      if (!blob) return;

      const birthDate = `${profile.input.birthYear}${String(profile.input.birthMonth).padStart(2, '0')}${String(profile.input.birthDay).padStart(2, '0')}`;
      const filename = buildSajuCardFilename(profile.name, birthDate);
      const { text, url } = buildShareTextAndUrl(profile.name, profile.id, ilju || undefined);
      const result = await shareSajuCardImage(blob, filename, text, url);
      if (result.via === 'canceled') toast.show(result.message, 'info');
      else if (result.ok) toast.show(result.message, 'success');
      else toast.show(result.message, 'warning');
    } finally {
      setExportBusy(null);
    }
  }

  /* ─── Round 2 Export 데이터 ─── */
  const primaryGwiin = sinsalAnalysis ? pickPrimaryGwiin(sinsalAnalysis.gilsongGwiin) : null;
  const keySinsals: SinsalHit[] = (() => {
    if (!sinsalAnalysis) return [];
    const out: SinsalHit[] = [];
    // 우선순위: 길성 (귀인 제외 이미 인장으로 노출) → 12신살 길성 → 흉살 1개
    const otherGil = sinsalAnalysis.gilsongGwiin.filter((h) => h !== primaryGwiin);
    if (otherGil.length > 0) out.push(otherGil[0]);
    const shipiGil = sinsalAnalysis.shipiSinsal.find((h) => h.category === 'gilsin');
    if (shipiGil && out.length < 2) out.push(shipiGil);
    const hyung = sinsalAnalysis.shipiSinsal.find((h) => h.category === 'hyungsal');
    if (hyung && out.length < 3) out.push(hyung);
    return out;
  })();

  const i = profile.input;
  const calLabel =
    i.calendarType === 'lunar' ? '음력'
    : i.calendarType === 'lunar_leap' ? '음력(윤달)'
    : '양력';
  const birthLabel = `${calLabel} ${i.birthYear}.${String(i.birthMonth).padStart(2, '0')}.${String(i.birthDay).padStart(2, '0')}${i.hasBirthTime ? ` ${formatHourKo(i.birthHour)}` : ''}`;

  const iljuKo = animal?.ko || '';

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>
      <Header title="사주 카드" />

      {/* ── 캡처 대상 (페이지 그대로 모드용) ── */}
      <div
        id="saju-card-export"
        data-saju-card-export
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '0 0 24px',
          background: C.paper,
          fontFamily: SERIF,
        }}
      >
        {/* Stage 7b ⭐ — L1 인장 (Hero) — 출생정보/CTA/카테고리 라벨 통합 */}
        <IdentityCard
          name={profile.name}
          ilju={ilju || '命'}
          iljuKo={iljuKo}
          animal={animal}
          dayOheng={dayOheng}
          sajuData={sajuData}
          primaryGwiin={sinsalAnalysis ? pickPrimaryGwiin(sinsalAnalysis.gilsongGwiin) : null}
          sinsalAnalysis={sinsalAnalysis}
          birthLabel={birthLabel}
          birthYear={profile.input.birthYear}
          birthMonth={profile.input.birthMonth}
          birthDay={profile.input.birthDay}
          birthHour={profile.input.birthHour}
          birthMinute={profile.input.birthMinute}
          hasBirthTime={profile.input.hasBirthTime}
          isLunar={profile.input.calendarType === 'lunar' || profile.input.calendarType === 'lunar_leap'}
          onPremiumCta={() => navigate('/premium')}
          onMoreDetails={() => {
            const el = document.getElementById('saju-card-details');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />

        {/* 2026-10-18 무료 만세력 디벨롭 — 계산 근거, 보내기, 운의 흐름(대운, 올해, 내년) */}
        <div style={{ padding: '0 18px' }}>
          <CalcNote input={profile.input} />
          <ShareRow onShare={handleShare} onSave={() => setShowExportSheet(true)} busy={exportBusy !== null} />
          <FlowNow sajuData={sajuData} />
          {/* 2026-10-22 P1-9 다음 단계 한 칸 — 카드와 운의 흐름 아래에만 (첫 화면 위 X, 캡처 제외) */}
          <TodayNextStep profileId={profile.id} name={profile.name} sajuData={sajuData} />
        </div>

        {/* ═════ Stage 7e — 자세히 영역 슬림화 ═════
             · 핵심 신살 → IdentityCard 안으로 이동 (키워드 자리)
             · 운의 흐름 (FlowTables / UnFlowEntryLinks) 폐지
             · Section 05 (FooterCard) 폐지
             · 12운성 → CTA → 디스클레이머 순 (CTA 맨 밑) */}
        <div id="saju-card-details" style={{ padding: '0 18px', marginTop: 4 }}>
          {/* 1. 12운성 사이클 */}
          <div style={{ marginTop: 16 }}>
            <Component12UnseongSection name={profile.name} sajuData={sajuData} />
          </div>

          {/* 2026-10-18 무료로 이어 보기 (유료 종합사주보다 먼저) */}
          <NextSteps ilju={ilju || ''} web={!isAppintosBuild && !isAppsInToss()} />

          {/* 2. CTA — 종합 사주 풀이 받기 (Stage 7e: 페이지 맨 밑으로 이동) */}
          <div style={{ marginTop: 24 }}>
            {/* 10-22 — 이 사람을 미리 골라 둔 채로 (종합사주 화면에 이 사람 이야기와 目次가 바로 보이게, 운이 모자란 처음 손님은 무료 먼저 갈림길) */}
            <button
              type="button"
              className="hj-cta"
              onClick={() => navigate(`/premium?profileId=${encodeURIComponent(profile.id)}`)}
            >
              <span>종합사주 풀이 받기</span>
              {(() => {
                const pp = getPremiumPrice();
                return (
                  <small>
                    {pp.isOnSale && pp.salePrice != null ? (
                      <>
                        <span style={{ textDecoration: 'line-through', opacity: 0.65, marginRight: 4 }}>{pp.regularPrice}운</span>
                        {pp.salePrice}운
                      </>
                    ) : (
                      `${pp.regularPrice}운`
                    )}
                  </small>
                );
              })()}
            </button>
          </div>

          {/* 3. 디스클레이머 (참고용, 가장 아래) */}
          <div
            style={{
              marginTop: 16,
              padding: '14px 4px 8px',
              fontSize: 13,
              color: C.mute,
              lineHeight: 1.7,
              textAlign: 'center',
              fontStyle: 'normal',
              letterSpacing: '0.02em',
            }}
          >
            한국 명리학 6대 원전(연해자평, 자평진전, 적천수, 궁통보감, 명리약언, 삼명통회) 기반
            <br />
            사주 풀이는 삶의 기운을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
          </div>
        </div>
      </div>

      {/* ── 액션 바 (sticky) ── */}
      <div
        style={{
          background: C.paper,
          borderTop: `1px solid ${C.line}`,
          padding: '20px 16px calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={exportBusy !== null}
            onClick={() => setShowExportSheet(true)}
            data-stage3-action="save-image"
            aria-busy={exportBusy === 'save'}
            style={{
              flex: 1, height: 48, borderRadius: 12,
              border: '1.5px solid #1A1612',
              background: 'transparent', color: '#1A1612',
              fontSize: 15.5, fontWeight: 800,
              cursor: exportBusy ? 'wait' : 'pointer',
              opacity: exportBusy ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {exportBusy === 'save' ? '저장 중…' : '이미지 저장'}
          </button>
          <button
            type="button"
            disabled={exportBusy !== null}
            onClick={handleShare}
            data-stage3-action="share"
            aria-busy={exportBusy === 'share'}
            style={{
              flex: 1, height: 48, borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(180deg, #D2B477 0%, #B8965A 100%)', color: '#17110A',
              fontSize: 15.5, fontWeight: 800,
              cursor: exportBusy ? 'wait' : 'pointer',
              opacity: exportBusy ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {exportBusy === 'share' ? '준비 중…' : '공유하기'}
          </button>
        </div>
      </div>

      {/* ── Export 모드 시트 ── */}
      <AnimatePresence>
        {showExportSheet && (
          <ExportModeSheet
            onSelect={(m) => exportInMode(m)}
            onClose={() => setShowExportSheet(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Offscreen export DOM (캡처 전용) ── */}
      {renderedExportMode && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            top: -99999,
            left: -99999,
            pointerEvents: 'none',
          }}
        >
          <div ref={exportLayoutRef}>
            <SajuCardExportLayout
              mode={renderedExportMode}
              name={profile.name}
              ilju={ilju}
              iljuKo={iljuKo}
              animal={animal}
              dayOheng={dayOheng}
              sajuData={sajuData}
              input={profile.input}
              primaryGwiin={primaryGwiin}
              keySinsals={keySinsals}
              birthLabel={birthLabel}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* Stage 4-3 — BirthInfoTable / Row 등 helper 들 SajuDetailsTable 로 흡수.
 * 코드 정리 위해 orphan 정의 제거. (필요 시 git history 에서 복원) */


/* Round 3 — 일주 기준 공망 추출 + 천을귀인 발현 위치 헬퍼는 Stage 4 에서 IdentityCard 가 흡수.
 * SajuMetaRow 가 미사용이라 호출처 0 → 헬퍼 자체 제거 (코드 청결). 필요 시 git history 에서 복원. */

/** Round 2 — 4 별도 카드 안의 sub-intro 한 줄 */


/* ══════════════════════════════════════════════════════════════════
 * Sub: ExportModeSheet — 모드 선택 바텀시트
 * ═════════════════════════════════════════════════════════════════ */
function ExportModeSheet({
  onSelect,
  onClose,
}: {
  onSelect: (mode: 'page' | ExportMode) => void;
  onClose: () => void;
}) {
  const options: Array<{
    id: 'page' | ExportMode;
    title: string;
    desc: string;
    spec: string;
  }> = [
    { id: 'instagram-1x1', title: '한 장 카드',          desc: '핵심만 정사각형: 인스타 피드용',     spec: '1080 × 1080' },
    { id: 'instagram-9x16', title: '스토리',             desc: '인스타와 카톡 스토리 세로 풀화면',       spec: '1080 × 1920' },
    { id: 'page',           title: '전체 보관용',         desc: '모든 정보 풍부하게, PDF 같은 톤',     spec: '~520 × ~1820' },
  ];

  return (
    <>
      <motion.div
        key="export-dim"
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        key="export-sheet"
        className="fixed bottom-0 inset-x-0 z-50"
        style={{
          background: C.paper,
          borderRadius: '20px 20px 0 0',
          maxWidth: 520,
          margin: '0 auto',
          padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      >
        <div
          style={{
            fontFamily: SERIF, fontSize: 16, fontWeight: 700,
            color: C.ink, marginBottom: 4,
          }}
        >
          어디에 공유하실래요?
        </div>
        <div style={{ fontSize: 13, color: C.mute, marginBottom: 14 }}>
          용도에 맞게 핵심만 골라 자동 정리해드려요
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                background: C.surface,
                border: `1px solid ${C.cardLine}`,
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 2,
                  }}
                >
                  {opt.title}
                </div>
                <div style={{ fontSize: 13, color: C.mute }}>{opt.desc}</div>
              </div>
              <div
                style={{
                  fontSize: 13, color: C.goldDeep, fontWeight: 600,
                  letterSpacing: '0.04em', flexShrink: 0,
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {opt.spec}
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', height: 44, marginTop: 12,
            background: 'transparent', border: 'none',
            fontSize: 13, color: C.mute, cursor: 'pointer',
          }}
        >
          취소
        </button>
      </motion.div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Sub: NotFoundView
 * ═════════════════════════════════════════════════════════════════ */
function NotFoundView({ shared, ilju, onInput, onHome, onStorage }: {
  /** 공유 링크로 들어왔는지 (?i= 또는 ?ref=share) */
  shared: boolean;
  /** 보낸 사람 일주 한자 두 글자 (공유 링크에 있을 때만) */
  ilju: string;
  onInput: () => void;
  onHome: () => void;
  onStorage: () => void;
}) {
  const animal = shared && ilju ? getIljuAnimal(ilju) : null;
  return (
    <div style={{ background: HJ.paper, minHeight: '100vh' }}>
      <Header title="사주 카드" />
      <div style={{ padding: '40px 20px', maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: HJ_SERIF, fontSize: 21, fontWeight: 700, color: HJ.ink, lineHeight: 1.45 }}>
          {shared ? '공유받은 사주 카드예요' : '이 사주 카드를 찾을 수 없어요'}
        </h2>
        {animal && (
          <p style={{ fontSize: 15, color: HJ.ink2, marginTop: 10 }}>
            보낸 분은 {animal.ko}({animal.hanja}) 일주예요.
          </p>
        )}
        <p style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2, marginTop: 12 }}>
          {shared
            ? '사주 카드는 만든 사람 기기에만 저장돼 있어서 여기서는 열리지 않아요. 내 생년월일을 넣으면 내 사주 카드를 바로 볼 수 있어요.'
            : '보관함에서 이 사주를 지웠을 수 있어요. 보관함에서 다른 사주를 고르거나 새로 넣어 주세요.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          <GoldCta onClick={onInput} sub="무료">생년월일 넣고 내 사주 보기</GoldCta>
          <GhostButton onClick={shared ? onHome : onStorage}>{shared ? '홈으로' : '보관함으로'}</GhostButton>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 프로필 로드
 * ═════════════════════════════════════════════════════════════════ */
function loadProfile(profileId?: string): SajuProfile | null {
  if (!profileId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY);
    if (!raw) return null;
    const list: SajuProfile[] = JSON.parse(raw);
    return list.find((p) => p.id === profileId) ?? null;
  } catch {
    return null;
  }
}
