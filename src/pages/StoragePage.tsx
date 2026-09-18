// StoragePage — #52 Sprint 2 UI 개편 (2026-04-24)
// 스펙: docs/mockups/사주500_UI개편_05_보관함.md §0-§12 · 핸드오프 §2-5
//
// 골격 (스펙 §1):
//   TopBar 제목 → Section A (사주팔자 정보) → Section B (이용 기록) → Section C (공유 리워드)
//
// 데이터 모델 분리 (스펙 §5-1, project_storage_data_model.md SSOT):
//   - saju500_profiles (SajuProfile) ← MyPage / HomePage / InputPage / 본 페이지가 관리
//   - saju500_reports  (LocalReport)  ← 본 페이지 + 결과 페이지가 관리
//   두 테이블은 완전히 독립이며 cascade delete 금지 (#29 Sprint 1 보존)
//   - 보관함에서 분석 1건 지워도 그 사람의 사주 프로필은 유지
//   - 마이/홈에서 프로필을 지워도 과거 분석 결과는 보관함에 그대로 남음
//   - 상호 참조는 name+birthYMD 키로만 (FK 없음). 프로필 삭제 후 매칭 안 되면 "(삭제된 사주)" 라벨
//
// 버그 체크 (스펙 §11):
//   - 버그 2: 사주 정보 삭제 — 스와이프 + 휴지통 양쪽 작동
//   - 버그 3: 이용기록 삭제 시 사주 정보 유지 (cascade 제거)
//   - 버그 4: "모두 삭제" 시 lastInput 동반 제거 (#storage-clear-lastinput 흡수)
//
// 흡수 티켓:
//   - #profile-edit-entry: 프로필 카드 연필 아이콘 → /input?profileId=xxx&edit=1
//   - #storage-clear-lastinput: 일괄 전체 삭제 시 saju500.lastInput localStorage 제거

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { useAuth } from '@/hooks/useAuth';
import { useSajuContext } from '@/contexts/SajuContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getHourBranch } from '@/utils/saju-format';
import { useToast } from '@/components/common/Toast';
import {
  getProfiles,
  saveProfileDirect,
  deleteProfile,
  getReports,
  deleteReport,
  type SajuProfile,
  type LocalReport,
  type ContentType,
} from '@/services/storage/localStore';
import {
  getChatRooms,
  deleteChatRoom,
  type ChatRoom,
} from '@/services/storage/chatStore';
import { getRemainingShareRewards } from '@/services/share/shareReward';
import { CHEONGAN_OHENG, OHENG_MAP } from '@/constants/oheng';
import { getTopicPrice } from '@/constants/pricing';
// Stage 7e-5: 보관함 카드에서 sajuData 즉시 계산 (모든 프로필 일주/오행 컬러 보장)
import { calculateSaju } from '@/services/saju/calculator';

/* ══════════════════════════════════════════════════════════════════
 * SSOT 토큰
 * ═════════════════════════════════════════════════════════════════ */
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  line: '#E5DFD0',
  surface: '#FFFFFF',
  danger: '#C0392B',
  dangerSoft: 'rgba(192,57,43,0.10)',
} as const;

const MAX_DAILY_SHARES = 3;
const SWIPE_THRESHOLD = 80; // px
const LAST_INPUT_KEY = 'saju500.lastInput';

/* ══════════════════════════════════════════════════════════════════
 * 필터 칩 (2026-05-05 PD 정정 — 실제 contentType 분류 그대로 노출)
 *  · 이전 4 탭 통합 (사주·궁합·기타) 은 분류 모호 → 사용자가 본 콘텐츠 정확히 못 찾음
 *  · 10 탭으로 확장 + 가로 스크롤 (overflow-x-auto 이미 적용)
 * ═════════════════════════════════════════════════════════════════ */
type FilterKey = 'all' | 'report' | 'topic' | 'compat' | 'daeun' | 'monthly' | 'weekly' | 'tojung' | 'daily' | 'dream' | 'chat';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: '전체' },
  { key: 'report',  label: '종합사주' },   // report (1운 + 10운)
  { key: 'topic',   label: '주제별' },     // topic (10주제)
  // 2026-06-29: 월운·주간 NEW 출시. 대운/궁합/토정은 출시 후 공개 (코드 보존)
  { key: 'monthly', label: '월운' },
  { key: 'weekly',  label: '주간' },
  // { key: 'compat',  label: '궁합' },
  // { key: 'daeun',   label: '대운' },
  // { key: 'tojung',  label: '토정비결' },
  { key: 'daily',   label: '오늘운세' },   // daily
  { key: 'dream',   label: '꿈해몽' },     // dream + deepDream 합침
  { key: 'chat',    label: '사주대화' },   // chatRooms
];

/** 분류 그룹 매핑 — filterTab → contentType[] (chat 은 chatRooms 별도) */
const TAB_TO_CONTENT_TYPES: Record<Exclude<FilterKey, 'all' | 'chat'>, ContentType[]> = {
  report:  ['report'],
  topic:   ['topic'],
  compat:  ['compat'],
  daeun:   ['daeun'],
  monthly: ['monthly'],
  weekly:  ['weekly'],
  tojung:  ['tojung'],
  daily:   ['daily'],
  dream:   ['dream', 'deepDream'],
};

const CONTENT_LABEL: Record<string, string> = {
  report: '종합 사주',           // 1운 또는 10운(프리미엄) — tier로 분기
  daily: '오늘의 운세',
  daeun: '대운',
  monthly: '월운',
  weekly: '주간운세',
  compat: '궁합',
  tojung: '토정비결',
  topic: '주제별 운세',          // 10주제 (연애·재물·취업·결혼·재회·학업·이사·건강·사업·인간관계)
  dream: '꿈해몽',
  deepDream: '꿈해몽 심층',
};

/** 운(運) 단위 — 콘텐츠별 결제 금액 (1운 = 500원 기준) */
const CONTENT_COST: Record<string, number> = {
  report: 1,        // basic 1운 (tier='premium' 이면 10으로 override)
  daily: 0,         // 무료
  daeun: 1,
  monthly: 7,   // 2026-06-29 NEW
  weekly: 5,    // 2026-06-29 NEW
  compat: 1,
  tojung: 1,
  topic: 1,
  dream: 0,         // 무료
  deepDream: 1,     // 유료 1운
};

/* ══════════════════════════════════════════════════════════════════
 * Page
 * ═════════════════════════════════════════════════════════════════ */
export function StoragePage() {
  usePageTitle('보관함');
  const navigate = useNavigate();
  const toast = useToast();
  const { setInput, setSajuData } = useSajuContext();
  useAuth();

  const [profiles, setProfiles] = useState<SajuProfile[]>([]);
  const [reports, setReports] = useState<LocalReport[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);

  const [filterTab, setFilterTab] = useState<FilterKey>('all');
  const [sortDesc, setSortDesc] = useState(true);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 삭제 시트 상태
  const [profileToDelete, setProfileToDelete] = useState<SajuProfile | null>(
    null,
  );
  const [reportToDelete, setReportToDelete] = useState<LocalReport | null>(
    null,
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // 공유 리워드
  const [remainingShares, setRemainingShares] = useState(() =>
    getRemainingShareRewards(),
  );

  function reloadAll() {
    setProfiles(getProfiles());
    setReports(getReports());
    setChatRooms(getChatRooms());
  }

  useEffect(() => {
    reloadAll();
    // 2026-06-19 — 보관함이 비어있으면 서버에서 자동 복원 (토스 웹뷰 데이터 비워진 고객 자동 회복).
    //   users/{uid}/reports 백업 + top-level reports 원본에서 내용까지 끌어와 채움.
    if (getReports().length === 0) {
      import('@/services/storage/firestoreSync')
        .then(({ restoreLibraryFromServer }) => restoreLibraryFromServer())
        .then((n) => { if (n > 0) { reloadAll(); toast.show(`${n}개 분석을 서버에서 복원했어요`, 'success'); } })
        .catch(() => { /* noop */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2026-05-07 fix — 보관함 필터:
  //   (1) 사주 등록만 한 placeholder (type=free + contentType=report + aiResult 없음)
  //   (2) 옛 1운 basic 종합사주 결과 (출시 모델에 1운 결과 페이지 컨셉 X — 종합사주는 10운 premium만)
  const cleanedReports = useMemo(() => {
    return reports.filter((r) => {
      const isAutoFreeReport =
        r.type === 'free' &&
        (!r.contentType || r.contentType === 'report') &&
        !r.aiResult;
      const isLegacyBasicReport =
        r.type === 'paid' &&
        (r.contentType ?? 'report') === 'report' &&
        !!r.aiResult &&
        ((r.aiResult as any)?.tier ?? 'basic') !== 'premium';
      return !isAutoFreeReport && !isLegacyBasicReport;
    });
  }, [reports]);

  // 정렬된 reports
  const sortedReports = useMemo(() => {
    const copy = [...cleanedReports];
    copy.sort((a, b) => {
      const at = +new Date(a.createdAt);
      const bt = +new Date(b.createdAt);
      return sortDesc ? bt - at : at - bt;
    });
    return copy;
  }, [cleanedReports, sortDesc]);

  // 2026-05-05 10 탭 분기 (실제 contentType 그대로 노출)
  const visibleReports = useMemo(() => {
    if (filterTab === 'all') return sortedReports;
    if (filterTab === 'chat') return []; // chat 은 reports 가 아니라 chatRooms 별도
    const allowedTypes = TAB_TO_CONTENT_TYPES[filterTab as Exclude<FilterKey, 'all' | 'chat'>];
    if (!allowedTypes) return sortedReports;
    return sortedReports.filter((r) => {
      const ct = (r.contentType ?? '') as ContentType;
      return allowedTypes.includes(ct);
    });
  }, [sortedReports, filterTab]);

  const visibleChatRooms = useMemo(() => {
    // 전체 + 사주대화 탭에서 chat 표시
    if (filterTab !== 'chat' && filterTab !== 'all') return [];
    if (filterTab === 'all') return chatRooms;
    const copy = [...chatRooms];
    copy.sort((a, b) =>
      sortDesc
        ? +new Date(b.updatedAt) - +new Date(a.updatedAt)
        : +new Date(a.updatedAt) - +new Date(b.updatedAt),
    );
    return copy;
  }, [chatRooms, filterTab, sortDesc]);

  // 프로필별 카운트 — name+birthYMD 매칭
  const profileCounts = useMemo(() => {
    const map = new Map<string, { reading: number; chat: number }>();
    for (const p of profiles) {
      const key = profileKey(p);
      map.set(key, { reading: 0, chat: 0 });
    }
    for (const r of reports) {
      if (!r.input?.birthYear || !r.name) continue;
      const key = `${r.name}_${r.input.birthYear}_${r.input.birthMonth}_${r.input.birthDay}`;
      const cnt = map.get(key);
      if (cnt) cnt.reading += 1;
    }
    for (const cr of chatRooms) {
      // chat은 name 기반 약매칭만 (profileId FK 없음)
      const matches = profiles.filter((p) => p.name === cr.name);
      if (matches.length === 1) {
        const key = profileKey(matches[0]);
        const cnt = map.get(key);
        if (cnt) cnt.chat += 1;
      }
    }
    return map;
  }, [profiles, reports, chatRooms]);

  /* ─── 프로필 네비게이션 ─── */
  function openProfile(profile: SajuProfile) {
    if (bulkMode) return;
    // 스펙 §2-2: 가장 최근 풀이 결과로 이동
    const matches = reports
      .filter(
        (r) =>
          r.name === profile.name &&
          r.input?.birthYear === profile.input.birthYear &&
          r.input?.birthMonth === profile.input.birthMonth &&
          r.input?.birthDay === profile.input.birthDay,
      )
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const latest = matches[0];
    if (latest && latest.sajuData) {
      setInput(latest.input);
      setSajuData(latest.sajuData);
      const route = routeForReport(latest);
      if (route) {
        navigate(route);
        return;
      }
    }
    // 풀이 기록 없음 → 사주 분석 진입 (`/input?profileId=...&from=storage`)
    navigate(`/input?profileId=${encodeURIComponent(profile.id)}&from=storage`);
  }

  /** P2-2 #profile-edit-entry — 연필 아이콘 → /input edit 모드 진입 */
  function editProfile(profile: SajuProfile) {
    if (bulkMode) return;
    navigate(
      `/input?profileId=${encodeURIComponent(profile.id)}&edit=1&from=storage`,
    );
  }

  /* ─── 프로필 삭제 (NO-CASCADE 보존) ─── */
  function confirmDeleteProfile() {
    if (!profileToDelete) return;
    deleteProfile(profileToDelete.id);
    toast.show('사주 정보가 삭제됐어요', 'info');
    setProfileToDelete(null);
    reloadAll();
  }

  /* ─── 리포트 ─── */
  function openReport(r: LocalReport) {
    if (bulkMode) {
      toggleSelect(r.id);
      return;
    }
    if (r.sajuData) {
      setInput(r.input);
      setSajuData(r.sajuData);
    }
    const route = routeForReport(r);
    if (route) {
      // 2026-05-28 — state + URL query 동시 전달. state 가 strict mode 등에서 손실되면 URL 폴백.
      //   Daily/Dream/Daeun/Monthly/Tojung/Compat 모두 ?reportId 로도 복원 가능 (페이지 자체 useEffect).
      const separator = route.includes('?') ? '&' : '?';
      const routeWithId = `${route}${separator}reportId=${encodeURIComponent(r.id)}`;
      navigate(routeWithId, { state: { savedResult: r.aiResult, savedReport: r } });
    } else if (LOCKDOWN_CONTENT.has(r.contentType as string)) {
      // 2026-05-28 — 출시 lockdown 4종은 페이지가 홈으로 redirect 됨. 안내 toast.
      toast.show('출시 후에 다시 열어볼 수 있어요', 'info');
    }
  }

  function confirmDeleteReport() {
    if (!reportToDelete) return;
    // 스펙 §11 버그 3 — cascade 금지: deleteReport는 reports 만 건드림
    deleteReport(reportToDelete.id);
    toast.show('이용 기록이 삭제됐어요', 'info');
    setReportToDelete(null);
    reloadAll();
  }

  /* ─── 채팅 ─── */
  function openChatRoom(room: ChatRoom) {
    if (bulkMode) {
      toggleSelect(room.id);
      return;
    }
    navigate(`/chat/${room.id}`);
  }

  /* ─── 일괄 모드 ─── */
  function enterBulkMode() {
    setBulkMode(true);
    setSelectedIds(new Set());
  }
  function exitBulkMode() {
    setBulkMode(false);
    setSelectedIds(new Set());
  }
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    const ids = new Set<string>();
    for (const r of visibleReports) ids.add(r.id);
    // 전체·사주대화 탭은 chat 도 포함
    if (filterTab === 'all' || filterTab === 'chat') {
      for (const cr of visibleChatRooms) ids.add(cr.id);
    }
    setSelectedIds(ids);
  }

  function bulkSelectionStats() {
    const totalVisible =
      filterTab === 'all' || filterTab === 'chat'
        ? visibleReports.length + visibleChatRooms.length
        : visibleReports.length;
    return { selected: selectedIds.size, total: totalVisible };
  }

  /** 일괄 삭제 — 모두 선택이면 lastInput 동반 제거 (#storage-clear-lastinput) */
  function confirmBulkDelete() {
    const { selected, total } = bulkSelectionStats();
    if (selected === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    // reports 삭제
    for (const id of selectedIds) {
      // chatRoom 인지 report 인지 ID로 분기
      const isChat = chatRooms.some((c) => c.id === id);
      if (isChat) deleteChatRoom(id);
      else deleteReport(id);
    }
    // 모두 선택 + 모든 데이터 삭제 → lastInput 동반 정리 (스펙 §5-4 / 버그 4)
    if (selected === total && selected > 0) {
      try {
        localStorage.removeItem(LAST_INPUT_KEY);
      } catch {
        /* 무시 */
      }
      toast.show('모든 기록이 삭제됐어요', 'info');
    } else {
      toast.show(`${selected}개의 기록이 삭제됐어요`, 'info');
    }
    setBulkDeleteOpen(false);
    exitBulkMode();
    reloadAll();
  }

  /* ─── 공유 리워드 — 전 앱 통합 (inviteFriendsViaToss SSOT) ─── */
  async function handleShare() {
    const { inviteFriendsViaToss } = await import('@/services/share/shareReward');
    await inviteFriendsViaToss({
      onReward: (earned) => {
        setRemainingShares(getRemainingShareRewards());
        toast.show(`공유 완료! ${earned}운이 적립됐어요`, 'success');
      },
      onShared: () => {
        setRemainingShares(getRemainingShareRewards());
        toast.show('오늘 공유 보상은 다 받았어요 (하루 3회)', 'info');
      },
      onCancel: () => toast.show('공유가 취소됐어요', 'info'),
    });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.paper,
        paddingBottom: bulkMode
          ? 'calc(120px + env(safe-area-inset-bottom))'
          : 'calc(64px + env(safe-area-inset-bottom))',
      }}
    >
      <Header title="보관함" />

      <div
        className="mx-auto"
        style={{ maxWidth: 520, padding: '12px 16px 0' }}
      >
        {/* ═══ Section A — 사주팔자 정보 ═══ */}
        <ProfilesSection
          profiles={profiles}
          profileCounts={profileCounts}
          onAdd={() => navigate('/input?from=storage&new=1')}
          onOpen={openProfile}
          onEdit={editProfile}
          onAskDelete={(p) => setProfileToDelete(p)}
        />

        {/* ═══ Section B — 이용 기록 ═══ */}
        <HistorySection
          filterTab={filterTab}
          onFilterChange={setFilterTab}
          sortDesc={sortDesc}
          onSortToggle={() => setSortDesc((v) => !v)}
          bulkMode={bulkMode}
          onEnterBulk={enterBulkMode}
          onExitBulk={exitBulkMode}
          visibleReports={visibleReports}
          visibleChatRooms={visibleChatRooms}
          profiles={profiles}
          selectedIds={selectedIds}
          onSelect={toggleSelect}
          onOpenReport={openReport}
          onAskDeleteReport={(r) => setReportToDelete(r)}
          onOpenChatRoom={openChatRoom}
        />

        {/* ═══ Section C — 친구 공유 리워드 ═══ */}
        <FadeIn delay={0.16}>
          <ShareRewardCard
            remaining={remainingShares}
            onShare={handleShare}
          />
        </FadeIn>
      </div>

      {/* ─── 일괄 액션 바 (sticky 56px) ─── */}
      <BulkActionBar
        open={bulkMode}
        stats={bulkSelectionStats()}
        onSelectAll={selectAllVisible}
        onCancel={exitBulkMode}
        onDelete={() => setBulkDeleteOpen(true)}
      />

      {/* ─── 프로필 삭제 시트 (스펙 §2-4 BottomSheet) ─── */}
      <DeleteProfileSheet
        profile={profileToDelete}
        counts={
          profileToDelete
            ? profileCounts.get(profileKey(profileToDelete)) ?? {
                reading: 0,
                chat: 0,
              }
            : { reading: 0, chat: 0 }
        }
        onClose={() => setProfileToDelete(null)}
        onConfirm={confirmDeleteProfile}
      />

      {/* ─── 단일 리포트 삭제 모달 ─── */}
      <SimpleConfirmModal
        open={!!reportToDelete}
        title="기록을 삭제할까요?"
        message="사주 정보는 그대로 유지됩니다. 삭제한 기록은 복구할 수 없어요."
        confirmLabel="삭제하기"
        confirmVariant="danger"
        onConfirm={confirmDeleteReport}
        onClose={() => setReportToDelete(null)}
      />

      {/* ─── 일괄 삭제 모달 ─── */}
      <SimpleConfirmModal
        open={bulkDeleteOpen}
        title={
          bulkSelectionStats().selected === bulkSelectionStats().total &&
          bulkSelectionStats().selected > 0
            ? '모든 기록을 삭제할까요?'
            : `${bulkSelectionStats().selected}개의 기록을 삭제할까요?`
        }
        message={
          bulkSelectionStats().selected === bulkSelectionStats().total &&
          bulkSelectionStats().selected > 0
            ? '사주 정보는 그대로 유지됩니다. 입력 캐시도 함께 정리돼요.'
            : '사주 정보는 그대로 유지됩니다.'
        }
        confirmLabel="삭제하기"
        confirmVariant="danger"
        onConfirm={confirmBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Section A — ProfilesSection (스펙 §2)
 * ═════════════════════════════════════════════════════════════════ */
function ProfilesSection({
  profiles,
  profileCounts,
  onAdd,
  onOpen,
  onEdit,
  onAskDelete,
}: {
  profiles: SajuProfile[];
  profileCounts: Map<string, { reading: number; chat: number }>;
  onAdd: () => void;
  onOpen: (p: SajuProfile) => void;
  onEdit: (p: SajuProfile) => void;
  onAskDelete: (p: SajuProfile) => void;
}) {
  return (
    <FadeIn>
      <section style={{ marginBottom: 24 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 0 8px',
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: C.ink,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            사주팔자 정보
          </h2>
          <button
            type="button"
            onClick={onAdd}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.goldDeep,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 4px',
            }}
          >
            + 새 사주 추가
          </button>
        </header>

        {profiles.length === 0 ? (
          <ProfileEmpty onAdd={onAdd} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profiles.map((p) => {
              const counts = profileCounts.get(profileKey(p)) ?? {
                reading: 0,
                chat: 0,
              };
              return (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  counts={counts}
                  onOpen={() => onOpen(p)}
                  onEdit={() => onEdit(p)}
                  onAskDelete={() => onAskDelete(p)}
                />
              );
            })}
          </div>
        )}
      </section>
    </FadeIn>
  );
}

function ProfileEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 20px',
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          margin: '0 auto 12px',
          background: C.goldSoft,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 30,
          fontWeight: 700,
          color: C.goldDeep,
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        命
      </div>
      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: C.ink,
          margin: '0 0 4px',
        }}
      >
        아직 등록된 사주가 없어요
      </p>
      <p
        style={{
          fontSize: 13,
          color: C.inkSoft,
          lineHeight: 1.55,
          margin: '0 0 16px',
        }}
      >
        생년월일과 시간을 입력하면 모든 풀이가 한곳에 모여요
      </p>
      <button
        type="button"
        onClick={onAdd}
        style={{
          minWidth: 240,
          height: 52,
          background: C.ink,
          color: C.paper,
          border: 'none',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        사주팔자 입력하기
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ProfileCard — 스와이프 + 휴지통 + 연필 (스펙 §2-2 / §2-3)
 * ═════════════════════════════════════════════════════════════════ */
function ProfileCard({
  profile,
  counts,
  onOpen,
  onEdit,
  onAskDelete,
}: {
  profile: SajuProfile;
  counts: { reading: number; chat: number };
  onOpen: () => void;
  onEdit: () => void;
  onAskDelete: () => void;
}) {
  // Stage 7e-4: counts/onOpen/onEdit prop 보존하지만 미사용 (본문 클릭 = 사주 카드 진입)
  void counts;
  void onOpen;
  void onEdit;
  const navigate = useNavigate();
  // Stage 7e-5: sajuData 가 없으면 input 으로 즉시 계산 (모든 프로필에 일주/오행 컬러 보장)
  const lazySajuData = useMemo(() => {
    if (profile.sajuData) return profile.sajuData;
    try { return calculateSaju(profile.input); } catch { return null; }
  }, [profile]);
  const ilgan = lazySajuData?.pillars?.[2]?.천간 || '';
  const ilji = lazySajuData?.pillars?.[2]?.지지 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
  const ohengColor = (oheng && OHENG_MAP[oheng]?.color) || C.goldDeep;
  const ohengHanja = (oheng && OHENG_MAP[oheng]?.hanja) || ' ';
  const relation = profile.relation || '본인';
  const isMe = relation === '본인' || relation === 'self';

  const cal = profile.input.calendarType || 'solar';
  const calLabel =
    cal === 'lunar' ? '음' : cal === 'lunar_leap' ? '윤' : '양';

  // Stage 7e-6: 시간 명확화 — 분 0 처리 ("5시 · 묘시" / "05:30 · 묘시")
  const hasTime = profile.input.hasBirthTime && profile.input.birthHour !== undefined;
  const hourLabel = (() => {
    if (!hasTime) return '시간 모름';
    const h = profile.input.birthHour ?? 0;
    const m = profile.input.birthMinute ?? 0;
    const branch = formatHourCode(h);
    // 2026-06-02 — 분 입력이 없으면 대표시각("11시") 숨기고 시(時)만 (밴드 입력이라 분은 오해 소지).
    return m > 0
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${branch}`
      : branch;
  })();

  // 스와이프 (drag x → 음수 방향)
  const draggedRef = useRef(false);
  return (
    <div
      style={{
        position: 'relative',
        height: 116,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* 뒤편 빨간 영역 (스펙 §2-3) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: C.danger,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 32,
        }}
      >
        <TrashIcon size={24} color="#FFFFFF" />
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={0.1}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -SWIPE_THRESHOLD) {
            onAskDelete();
          }
          // 0으로 다시 원위치 — framer가 자동 (constraints + transition)
          setTimeout(() => {
            draggedRef.current = false;
          }, 100);
        }}
        whileTap={{ scale: 0.99 }}
        style={{
          position: 'relative',
          height: 116,
          background: C.surface,
          border: `1px solid ${isMe ? C.gold : C.line}`,
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          cursor: 'grab',
        }}
      >
        {/* Stage 7e-5: 좌 일주 심볼 — 오행 컬러 배경 + 일주 한자 두 글자 (사용자별 포인트 컬러) */}
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            borderRadius: 12,
            background: ilgan ? ohengColor : `${C.goldDeep}22`,
            border: `2px solid ${ilgan ? ohengColor : 'rgba(184,150,90,0.40)'}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Noto Serif KR', serif",
            color: ilgan ? '#FFFFFF' : C.goldDeep,
            lineHeight: 0.96,
            boxShadow: `0 4px 10px ${ohengColor}33`,
            position: 'relative',
          }}
        >
          {ilgan ? (
            <>
              <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.02em' }}>
                {ilgan}
              </span>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.02em', marginTop: 1 }}>
                {ilji}
              </span>
              {/* 우상단 오행 한자 마이크로 라벨 */}
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -4,
                  fontSize: 9,
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: 999,
                  background: '#FFFFFF',
                  color: ohengColor,
                  border: `1.5px solid ${ohengColor}`,
                  lineHeight: 1.2,
                  letterSpacing: '0.04em',
                }}
              >
                {ohengHanja}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 22, fontWeight: 700 }}>{ohengHanja || '命'}</span>
          )}
        </div>

        {/* Stage 7e-4: 본문 클릭 = 사주 카드 진입 (사용자 결단 — onOpen 풀이 페이지 폐지) */}
        <button
          type="button"
          onClick={(e) => {
            if (draggedRef.current) {
              e.preventDefault();
              return;
            }
            navigate(`/saju-card/${encodeURIComponent(profile.id)}`);
          }}
          aria-label={`${profile.name} 사주 카드 보기`}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: C.ink,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.01em',
              }}
            >
              {profile.name}
            </span>
            {isMe && (
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  background: C.goldDeep,
                  color: C.paper,
                  letterSpacing: '0.04em',
                }}
              >
                본인
              </span>
            )}
            {!isMe && (
              <span
                style={{
                  fontSize: 10.5,
                  color: C.goldDeep,
                  fontWeight: 700,
                  padding: '1px 7px',
                  background: C.goldSoft,
                  borderRadius: 999,
                  letterSpacing: '0.02em',
                }}
              >
                {relation}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.5 }}>
            {profile.input.birthYear}.
            {String(profile.input.birthMonth).padStart(2, '0')}.
            {String(profile.input.birthDay).padStart(2, '0')} ({calLabel}) ·{' '}
            {hourLabel}
          </div>
          {ilgan && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.goldDeep,
                marginTop: 2,
                letterSpacing: '0.02em',
              }}
            >
              일간 {ilgan} · {oheng}
            </div>
          )}
        </button>

        {/* Stage 7e-4: 우상단 — 휴지통만 (사주 카드/수정 버튼 폐지) */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
          }}
        >
          <IconButton
            ariaLabel={`${profile.name} 사주 정보 삭제`}
            onClick={onAskDelete}
          >
            <TrashIcon size={18} color={C.mute} />
          </IconButton>
        </div>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Section B — HistorySection (스펙 §3)
 * ═════════════════════════════════════════════════════════════════ */
function HistorySection({
  filterTab,
  onFilterChange,
  sortDesc,
  onSortToggle,
  bulkMode,
  onEnterBulk,
  onExitBulk,
  visibleReports,
  visibleChatRooms,
  profiles,
  selectedIds,
  onSelect,
  onOpenReport,
  onAskDeleteReport,
  onOpenChatRoom,
}: {
  filterTab: FilterKey;
  onFilterChange: (k: FilterKey) => void;
  sortDesc: boolean;
  onSortToggle: () => void;
  bulkMode: boolean;
  onEnterBulk: () => void;
  onExitBulk: () => void;
  visibleReports: LocalReport[];
  visibleChatRooms: ChatRoom[];
  profiles: SajuProfile[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onOpenReport: (r: LocalReport) => void;
  onAskDeleteReport: (r: LocalReport) => void;
  onOpenChatRoom: (c: ChatRoom) => void;
}) {
  const total = visibleReports.length + visibleChatRooms.length;
  return (
    <FadeIn delay={0.04}>
      <section style={{ marginBottom: 24 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0 12px',
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: C.ink,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            이용 기록
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={onSortToggle}
              aria-label={sortDesc ? '오래된순으로 정렬' : '최신순으로 정렬'}
              style={{
                width: 36,
                height: 36,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: C.mute,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SortIcon flipped={!sortDesc} />
            </button>
            <button
              type="button"
              onClick={bulkMode ? onExitBulk : onEnterBulk}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: bulkMode ? C.danger : C.goldDeep,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
              }}
            >
              {bulkMode ? '취소' : '선택'}
            </button>
          </div>
        </header>

        {/* 4 칩 (스펙 §3-2) */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 8,
            scrollbarWidth: 'none',
          }}
        >
          {FILTER_TABS.map((t) => {
            const active = filterTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onFilterChange(t.key)}
                aria-pressed={active}
                style={{
                  flexShrink: 0,
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 999,
                  background: active ? C.ink : C.goldSoft,
                  color: active ? C.paper : C.ink,
                  border: `1px solid ${active ? C.ink : C.line}`,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* 카드 리스트 */}
        {total === 0 ? (
          <HistoryEmpty filterKey={filterTab} />
        ) : (
          <div
            style={{
              marginTop: 6,
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            {visibleReports.map((r, idx) => (
              <HistoryCard
                key={r.id}
                report={r}
                profiles={profiles}
                isLast={
                  idx === visibleReports.length - 1 &&
                  visibleChatRooms.length === 0
                }
                bulkMode={bulkMode}
                selected={selectedIds.has(r.id)}
                onToggleSelect={() => onSelect(r.id)}
                onOpen={() => onOpenReport(r)}
                onAskDelete={() => onAskDeleteReport(r)}
              />
            ))}
            {visibleChatRooms.map((cr, idx) => (
              <ChatRoomCard
                key={cr.id}
                room={cr}
                isLast={idx === visibleChatRooms.length - 1}
                bulkMode={bulkMode}
                selected={selectedIds.has(cr.id)}
                onToggleSelect={() => onSelect(cr.id)}
                onOpen={() => onOpenChatRoom(cr)}
              />
            ))}
          </div>
        )}
      </section>
    </FadeIn>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * HistoryCard (스펙 §3-3)
 * ═════════════════════════════════════════════════════════════════ */
function HistoryCard({
  report,
  profiles,
  isLast,
  bulkMode,
  selected,
  onToggleSelect,
  onOpen,
  onAskDelete,
}: {
  report: LocalReport;
  profiles: SajuProfile[];
  isLast: boolean;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onAskDelete: () => void;
}) {
  // 프로필 매칭 (이름 + birthYMD)
  const profileMatched = profiles.find(
    (p) =>
      p.name === report.name &&
      p.input.birthYear === report.input?.birthYear &&
      p.input.birthMonth === report.input?.birthMonth &&
      p.input.birthDay === report.input?.birthDay,
  );
  // 매칭 안 되면 "(삭제된 사주)" 라벨 (스펙 §2-4 / §5-2)
  const displayName = profileMatched ? report.name : '(삭제된 사주)';
  const isOrphan = !profileMatched;

  const ct = report.contentType ?? 'report';
  const baseLabel = CONTENT_LABEL[ct] ?? '종합 사주';
  // topic 세부 라벨
  const topicId = (report as any).aiResult?.topicId;
  const TOPIC_LABEL: Record<string, string> = {
    love: '연애운',
    wealth: '재물운',
    career: '취업운',
    marriage: '결혼운',
    business: '사업운',
    health: '건강운',
    reunion: '재회운',
    study: '학업운',
    social: '대인관계운', // 2026-05-28 — legacy 보존 (이미 결제한 user 보관함 라벨용 — 진입은 X)
    moving: '이사운',
    exam: '시험운',
    move: '이사운',
  };
  // 종합사주는 tier 로 1운/10운(프리미엄) 분기
  const aiTier = (report as any)?.aiResult?.tier;
  const isPremium = ct === 'report' && aiTier === 'premium';
  // 2026-09-17 — 꿈해몽은 CONTENT_COST 0(무료)이라 1운으로 잠금 해제·생성한 꿈도 '무료'로 표기되던 버그.
  //   type 'paid' 또는 aiResult.__unlocked 면 '전체 풀이' 라벨 + '1운 사용'.
  const isUnlockedDream = ct === 'dream'
    && (report.type === 'paid' || !!(report as any).aiResult?.__unlocked);
  const label = ct === 'topic'
    ? (TOPIC_LABEL[topicId] ?? '주제별 운세')
    : isPremium
    ? '종합 사주 · 프리미엄'
    : isUnlockedDream
    ? '꿈해몽 · 전체 풀이'
    : baseLabel;

  const dateStr = new Date(report.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // 운 사용 표기 — paid 면 실제 결제 가격(SSOT), free 면 "무료"
  // topic 콘텐츠는 getTopicPrice(topicId).actualPrice 가 진짜 가격(재물/연애/재회=3운, 나머지=1운).
  const actualCost = isPremium
    ? 10
    : ct === 'topic' && topicId
    ? getTopicPrice(topicId).actualPrice
    // 2026-09-17 — 오늘의 운세 '하루 1회 무료, 이후 1운': paid 기록은 CONTENT_COST 0(무료)이 아니라 1운
    : ct === 'daily'
    ? 1
    : (CONTENT_COST[ct] ?? 1);
  const unCost = isUnlockedDream
    ? '1운 사용'
    : report.type === 'paid'
    ? (actualCost === 0 ? '무료' : `${actualCost}운 사용`)
    : '무료';

  // 스와이프
  const draggedRef = useRef(false);
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* 뒤편 빨간 영역 */}
      {!bulkMode && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: C.danger,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 24,
          }}
        >
          <TrashIcon size={20} color="#FFFFFF" />
        </div>
      )}
      <motion.div
        drag={bulkMode ? false : 'x'}
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -SWIPE_THRESHOLD) onAskDelete();
          setTimeout(() => {
            draggedRef.current = false;
          }, 100);
        }}
        style={{
          position: 'relative',
          height: 80,
          background: bulkMode && selected ? C.goldSoft : C.surface,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: isLast ? 'none' : `1px solid ${C.line}`,
          cursor: bulkMode ? 'pointer' : 'grab',
        }}
        onClick={(e) => {
          if (draggedRef.current) {
            e.preventDefault();
            return;
          }
          if (bulkMode) onToggleSelect();
          else onOpen();
        }}
      >
        {/* 일괄 모드 체크박스 */}
        {bulkMode && (
          <div
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: `2px solid ${selected ? C.goldDeep : C.line}`,
              background: selected ? C.goldDeep : C.surface,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {selected && <CheckIcon size={12} color="#FFFFFF" />}
          </div>
        )}
        {/* 좌 콘텐츠 아이콘 */}
        <ContentIcon contentType={ct} />
        {/* 중 본문 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: isOrphan ? C.mute : C.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label} · <span style={{ fontWeight: 500 }}>{displayName}</span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: C.mute,
              marginTop: 2,
            }}
          >
            {dateStr} · {unCost}
          </div>
        </div>
        {/* 우 chevron 또는 일괄 모드 시 빈공간 */}
        {!bulkMode && <ChevronRightIcon />}
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ChatRoomCard
 * ═════════════════════════════════════════════════════════════════ */
function ChatRoomCard({
  room,
  isLast,
  bulkMode,
  selected,
  onToggleSelect,
  onOpen,
}: {
  room: ChatRoom;
  isLast: boolean;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const dateStr = new Date(room.updatedAt).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
  return (
    <div
      onClick={() => (bulkMode ? onToggleSelect() : onOpen())}
      style={{
        height: 80,
        background: bulkMode && selected ? C.goldSoft : C.surface,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: isLast ? 'none' : `1px solid ${C.line}`,
        cursor: 'pointer',
      }}
    >
      {bulkMode && (
        <div
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: `2px solid ${selected ? C.goldDeep : C.line}`,
            background: selected ? C.goldDeep : C.surface,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {selected && <CheckIcon size={12} color="#FFFFFF" />}
        </div>
      )}
      <ContentIcon contentType="chat" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: C.ink,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          대화 · {room.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.mute,
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {room.lastMessage || '대화를 시작해보세요'} · {dateStr}
        </div>
      </div>
      {!bulkMode && <ChevronRightIcon />}
    </div>
  );
}

function ContentIcon({ contentType }: { contentType: ContentType | 'chat' }) {
  // 콘텐츠별 lucide-스타일 한자/심볼 (스펙 §3-3 lucide 24)
  const map: Record<string, { hanja: string; color: string }> = {
    report: { hanja: '命', color: C.goldDeep },
    daily: { hanja: '日', color: '#A55F11' },
    daeun: { hanja: '運', color: C.goldDeep },
    monthly: { hanja: '月', color: '#0E4582' },
    weekly: { hanja: '週', color: '#C77D3A' },
    compat: { hanja: '合', color: '#9C2424' },
    tojung: { hanja: '占', color: '#1F6638' },
    topic: { hanja: '深', color: C.goldDeep },
    dream: { hanja: '夢', color: '#0E4582' },
    deepDream: { hanja: '夢', color: '#0E4582' },
    chat: { hanja: '言', color: C.goldDeep },
  };
  const item = map[contentType] ?? map.report;
  return (
    <div
      aria-hidden
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: 8,
        background: `${item.color}14`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: item.color,
        fontSize: 16,
        fontWeight: 700,
        fontFamily: "'Noto Serif KR', serif",
      }}
    >
      {item.hanja}
    </div>
  );
}

function HistoryEmpty({ filterKey }: { filterKey: FilterKey }) {
  // 2026-05-04 4 탭 매핑 (전체·사주·궁합·기타)
  const messages: Record<FilterKey, { title: string; sub: string }> = {
    all:     { title: '아직 풀이가 없어요',         sub: '오늘의 운세부터 가볍게 시작해보세요' },
    report:  { title: '종합사주 기록이 없어요',     sub: '500원 1운으로 본격 사주 풀이를 받아보세요' },
    topic:   { title: '주제별 분석 기록이 없어요', sub: '연애·재물·직업 등 궁금한 한 주제를 깊이 보세요' },
    compat:  { title: '궁합 기록이 없어요',         sub: '관심 있는 사람과의 궁합을 봐볼까요?' },
    daeun:   { title: '대운 기록이 없어요',         sub: '10년 단위 인생의 큰 흐름을 확인해보세요' },
    monthly: { title: '월운 기록이 없어요',         sub: '원하는 달을 골라 그 달을 깊이 풀어드려요' },
    weekly:  { title: '주간운세 기록이 없어요',     sub: '이번 주 7일의 흐름을 요일별로 짚어드려요' },
    tojung:  { title: '토정비결 기록이 없어요',     sub: '한 해의 흐름을 사주 전체에서 풀어드려요' },
    daily:   { title: '오늘운세 기록이 없어요',     sub: '오늘 하루를 사주로 가볍게 살펴보세요' },
    dream:   { title: '꿈해몽 기록이 없어요',       sub: '간밤에 꾼 꿈을 풀어보세요 (하루 1회 무료)' },
    chat:    { title: '사주대화 기록이 없어요',     sub: '사주에 대한 궁금증을 자유롭게 물어보세요' },
  };
  const m = messages[filterKey];
  return (
    <div
      style={{
        marginTop: 4,
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: '36px 20px',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          margin: '0 auto 10px',
          background: C.goldSoft,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.goldDeep,
          fontSize: 26,
          fontWeight: 700,
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        簿
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>
        {m.title}
      </p>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: 0 }}>{m.sub}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * BulkActionBar (스펙 §3-4)
 * ═════════════════════════════════════════════════════════════════ */
function BulkActionBar({
  open,
  stats,
  onSelectAll,
  onCancel,
  onDelete,
}: {
  open: boolean;
  stats: { selected: number; total: number };
  onSelectAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="bulk-bar"
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: C.ink,
            color: C.paper,
            padding: '12px 16px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
            zIndex: 80,
            boxShadow: '0 -2px 12px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              maxWidth: 520,
              margin: '0 auto',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
              {stats.selected}/{stats.total} 선택됨
            </span>
            <button
              type="button"
              onClick={onSelectAll}
              style={{
                height: 36,
                padding: '0 12px',
                background: 'transparent',
                color: C.paper,
                border: '1px solid rgba(248,245,238,0.4)',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              모두 선택
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                height: 36,
                padding: '0 12px',
                background: 'transparent',
                color: 'rgba(248,245,238,0.7)',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={stats.selected === 0}
              aria-disabled={stats.selected === 0}
              style={{
                height: 40,
                padding: '0 16px',
                background: stats.selected === 0 ? 'rgba(192,57,43,0.4)' : C.danger,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: stats.selected === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              삭제
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * DeleteProfileSheet (스펙 §2-4 BottomSheet)
 * ═════════════════════════════════════════════════════════════════ */
function DeleteProfileSheet({
  profile,
  counts,
  onClose,
  onConfirm,
}: {
  profile: SajuProfile | null;
  counts: { reading: number; chat: number };
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {profile && (
        <motion.div
          key="del-profile-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
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
        >
          <motion.div
            key="del-profile-panel"
            initial={{ y: 240 }}
            animate={{ y: 0 }}
            exit={{ y: 240 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: C.paper,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: '24px 24px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                background: C.line,
                margin: '0 auto 18px',
              }}
            />
            <h3
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: C.ink,
                margin: '0 0 8px',
              }}
            >
              {profile.name}님의 사주 정보를 삭제할까요?
            </h3>
            <p
              style={{
                fontSize: 13,
                color: C.inkSoft,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              사주 정보만 삭제됩니다. 지금까지 본{' '}
              <strong style={{ color: C.ink }}>풀이 {counts.reading}건</strong>
              과{' '}
              <strong style={{ color: C.ink }}>대화 {counts.chat}건</strong>은
              그대로 보관함에 남아있어요. (이름은 "(삭제된 사주)"로 표기돼요)
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                onClick={onConfirm}
                style={{
                  height: 52,
                  background: C.danger,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                삭제하기
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  height: 44,
                  background: 'transparent',
                  color: C.inkSoft,
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * SimpleConfirmModal (단일/일괄 삭제 공용)
 * ═════════════════════════════════════════════════════════════════ */
function SimpleConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmBg = confirmVariant === 'danger' ? C.danger : C.ink;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="simple-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(15,13,10,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            key="simple-panel"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 320,
              background: C.paper,
              borderRadius: 20,
              padding: '24px 24px 20px',
              textAlign: 'center',
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: C.ink,
                margin: '0 0 8px',
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: 13,
                color: C.inkSoft,
                lineHeight: 1.55,
                margin: '0 0 20px',
              }}
            >
              {message}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  height: 48,
                  background: C.surface,
                  color: C.inkSoft,
                  border: `1px solid ${C.line}`,
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirm}
                style={{
                  flex: 1,
                  height: 48,
                  background: confirmBg,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Section C — ShareRewardCard (스펙 §4)
 * ═════════════════════════════════════════════════════════════════ */
function ShareRewardCard({
  remaining,
  onShare,
}: {
  remaining: number;
  onShare: () => void;
}) {
  const used = MAX_DAILY_SHARES - remaining;
  return (
    <div
      style={{
        marginBottom: 24,
        height: 116,
        background: C.goldSoft,
        borderRadius: 16,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        border: '1px solid rgba(184,150,90,0.3)',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 999,
          background: C.gold,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontSize: 18,
          fontWeight: 800,
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        運
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: C.ink,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          공유하고 1운 받기
        </p>
        <p
          style={{
            fontSize: 12,
            color: C.inkSoft,
            margin: '3px 0 0',
          }}
        >
          오늘 {used}/{MAX_DAILY_SHARES}회 사용 (남은 {remaining}회)
        </p>
      </div>
      <button
        type="button"
        onClick={onShare}
        style={{
          height: 40,
          width: 80,
          background: C.ink,
          color: C.paper,
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        공유
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 아이콘
 * ═════════════════════════════════════════════════════════════════ */
function TrashIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={C.mute}
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function CheckIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function SortIcon({ flipped }: { flipped: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: flipped ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.2s',
      }}
    >
      <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 20V4" />
    </svg>
  );
}
function IconButton({
  ariaLabel,
  onClick,
  children,
  highlight,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
  /** Stage 7e — 사주 카드 아이콘 등 강조 (골드 배경 + 외곽선) */
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: 36,
        height: 36,
        background: highlight ? 'rgba(184,150,90,0.18)' : 'transparent',
        border: highlight ? '1px solid rgba(184,150,90,0.45)' : 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        boxShadow: highlight ? '0 1px 4px rgba(184,150,90,0.20)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 헬퍼
 * ═════════════════════════════════════════════════════════════════ */
function profileKey(p: SajuProfile): string {
  return `${p.name}_${p.input.birthYear}_${p.input.birthMonth}_${p.input.birthDay}`;
}

function formatHourCode(hour: number): string {
  // 2026-06-02 — range 기반 getHourBranch 사용 (구 band-start 11 / 신 중앙 12 모두 정확 매핑).
  const b = getHourBranch(hour, 0);
  return b ? b.ko : `${hour}시`;
}

/** 출시 lockdown 콘텐츠 — 라우트는 살아있으나 페이지가 홈으로 redirect 됨 (App.tsx) */
//  2026-06-29: 월운(monthly) NEW 출시로 lockdown 제외. 주간(weekly)도 공개. 대운/궁합/토정만 유지.
const LOCKDOWN_CONTENT = new Set(['compat', 'daeun', 'tojung']);

/** 콘텐츠 유형별 결과 페이지 라우트 (스펙 §3-3 탭 시 결과 이동) */
function routeForReport(r: LocalReport): string | null {
  const ct = r.contentType;
  if (ct === 'dream' || ct === 'deepDream') return '/dream';
  if (ct === 'daily') return '/daily';
  if (ct === 'monthly') return '/monthly'; // 2026-06-29 NEW — 재선택 시 캐시 복원
  if (ct === 'weekly') return '/weekly';   // 2026-06-29 NEW
  // 2026-05-28 — 출시 lockdown 4종 (compat/daeun/monthly/tojung) 은 페이지가 홈으로 redirect 됨.
  //   보관함에서 클릭 시 무한 redirect 사이클 방지 위해 null 반환. openReport 에서 안내 toast.
  if (LOCKDOWN_CONTENT.has(ct as string)) return null;
  if (ct === 'topic') {
    const topicId = (r as any).aiResult?.topicId || 'love';
    return `/topic/${topicId}`;
  }
  // 기본 사주 리포트
  if (r.sajuData?.pillars?.length) return `/result/${r.id}`;
  return '/input?from=storage';
}

// 사용하지 않는 import 보장 — saveProfileDirect 는 향후 동기화 정책 확장 시 사용 예정
void saveProfileDirect;
