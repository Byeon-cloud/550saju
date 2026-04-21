// EventsPage v3 MVP (2026-04-21 P1-11)
// 사양: 사주500_UI개편_09_이벤트.md + 목업 사주500_UI개편_목업_이벤트_v3.html
// MVP 범위:
//   - 주간 출석 7칸 (월~일, 0시 리셋)
//   - 4일 마일스톤 (1운) · 7일 마일스톤 (2운)
//   - 단일 공유 버튼
// 확률박스·토스포인트 UAC는 정책에 따라 스킵.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/components/common/Toast';

const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkMute: '#8A7F6E',
  gold: '#B8965A',
  goldSoft: '#F0E8D9',
  goldDeep: '#5C4A2E',
  paper2: '#EFE9DA',
  white: '#FFFFFF',
} as const;

const SERIF = "'Noto Serif KR', serif";
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const ATTENDANCE_KEY = 'saju500_events_attendance';
const SHARE_DONE_KEY = 'saju500_events_share_weekly';

/** 이번 주 월요일 00:00의 타임스탬프 (출석·공유 리셋 기준) */
function getWeekStart(): number {
  const d = new Date();
  const day = d.getDay(); // 0(일)~6(토)
  const diff = (day === 0 ? -6 : 1 - day); // 월요일까지
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getTodayIndex(): number {
  // 0(월)~6(일)
  const d = new Date();
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

interface Attendance {
  weekStart: number;
  days: boolean[]; // length 7
  milestone4Claimed?: boolean;
  milestone7Claimed?: boolean;
}

function loadAttendance(): Attendance {
  const ws = getWeekStart();
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Attendance;
      if (parsed.weekStart === ws && Array.isArray(parsed.days) && parsed.days.length === 7) {
        return parsed;
      }
    }
  } catch {/* ignore */}
  return { weekStart: ws, days: [false, false, false, false, false, false, false] };
}

function saveAttendance(a: Attendance): void {
  try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(a)); } catch {/* ignore */}
}

function loadShareDone(): boolean {
  const ws = getWeekStart();
  try {
    const raw = localStorage.getItem(SHARE_DONE_KEY);
    if (raw) {
      const { weekStart, done } = JSON.parse(raw);
      return weekStart === ws && done === true;
    }
  } catch {/* ignore */}
  return false;
}

function saveShareDone(): void {
  try {
    localStorage.setItem(SHARE_DONE_KEY, JSON.stringify({ weekStart: getWeekStart(), done: true }));
  } catch {/* ignore */}
}

export function EventsPage() {
  usePageTitle('이벤트');
  const navigate = useNavigate();
  const toast = useToast();
  const [attendance, setAttendance] = useState<Attendance>(loadAttendance);
  const [shareDone, setShareDone] = useState<boolean>(loadShareDone);
  const todayIdx = useMemo(() => getTodayIndex(), []);

  useEffect(() => {
    // 페이지 진입 시 오늘 출석 자동 표시 (MVP — 추후 "콘텐츠 본 후" 조건으로 강화)
    setAttendance((prev) => {
      if (prev.days[todayIdx]) return prev;
      const next: Attendance = { ...prev, days: [...prev.days] };
      next.days[todayIdx] = true;
      saveAttendance(next);
      return next;
    });
  }, [todayIdx]);

  const daysDone = attendance.days.filter(Boolean).length;
  const progressPct = Math.min(100, (daysDone / 7) * 100);
  const milestone4 = daysDone >= 4;
  const milestone7 = daysDone >= 7;

  const onShare = async () => {
    if (shareDone) {
      toast.show('이번 주 공유는 이미 완료했어요', 'info');
      return;
    }
    const text = '사주500 — 500원에 풀어보는 내 사주. 한 번 보면 멈출 수 없어요.';
    try {
      if (navigator.share) {
        await navigator.share({ title: '사주500', text, url: window.location.origin });
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.origin}`);
      }
      saveShareDone();
      setShareDone(true);
      toast.show('공유 완료 · 0.5운이 곧 들어와요', 'success');
    } catch {
      // 유저 취소는 무시
    }
  };

  return (
    <div style={{ background: C.paper, minHeight: '100vh', paddingBottom: 96 }}>
      <Header title="이벤트" />

      <div className="mx-auto" style={{ maxWidth: 460 }}>
        {/* 런칭 프로모 배너 */}
        <div className="mx-4 mt-3 rounded-2xl px-[18px] py-3.5 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(184,150,90,0.14) 0%, rgba(184,150,90,0.04) 100%)',
            border: '1px solid rgba(184,150,90,0.22)',
          }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={C.gold} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12l3-8h10l3 8" />
            <path d="M2 12h20l-2 7H4z" />
            <path d="M12 4v15" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-[1.4]" style={{ color: C.ink }}>
              런칭 첫 주 한정 · 7일 출석 시 2운 추가
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: C.inkMute }}>
              이번 주 월~일 모두 출석하면 자동 지급
            </p>
          </div>
        </div>

        {/* 출석 카드 */}
        <section className="mx-4 mt-4 rounded-[20px] p-5"
          style={{ background: C.white, border: '1px solid rgba(184,150,90,0.08)',
            boxShadow: '0 1px 2px rgba(47,42,35,0.04), 0 8px 24px rgba(47,42,35,0.04)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={C.gold} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 9h18" />
              <path d="M8 3v4M16 3v4" />
              <path d="M8 14h2M8 17h2M14 14h2M14 17h2" />
            </svg>
            <h3 className="text-[17px] font-medium" style={{ color: C.ink, fontFamily: SERIF, letterSpacing: '0.02em' }}>
              이번 주 출석
            </h3>
          </div>
          <p className="text-[12px] leading-[1.55] mb-[18px]" style={{ color: C.inkMute }}>
            콘텐츠 하나를 보면 오늘 출석이 올라갑니다. 매주 월요일 0시 다시 시작돼요.
          </p>

          {/* 주간 7칸 */}
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {WEEKDAYS.map((w, i) => {
              const done = attendance.days[i];
              const isToday = i === todayIdx;
              const bg = done ? C.gold : isToday ? C.white : C.paper2;
              return (
                <div key={w} className="flex flex-col items-center gap-1.5 py-1.5">
                  <span className="text-[11px] font-medium"
                    style={{ color: done ? C.ink : isToday ? C.goldDeep : C.inkMute,
                      fontWeight: isToday ? 600 : 500 }}>
                    {w}
                  </span>
                  <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center"
                    style={{ background: bg, boxShadow: isToday && !done ? `inset 0 0 0 2px ${C.gold}` : 'none' }}>
                    {done && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                        stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M2 6.5l2.5 2.5L10 3.5" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 진행바 */}
          <div className="mb-4">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: C.paper2 }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, background: C.gold }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px]" style={{ color: C.inkMute }}>
              <span>0일</span>
              <span style={{ marginLeft: '28%' }}>4일</span>
              <span>7일</span>
            </div>
            <p className="text-[12px] mt-2" style={{ color: C.inkMute }}>
              <strong style={{ color: C.ink }}>이번 주 {daysDone}일 출석</strong>
              {daysDone < 4 && ` · 4일까지 ${4 - daysDone}일 남았어요`}
              {daysDone >= 4 && daysDone < 7 && ` · 7일까지 ${7 - daysDone}일 남았어요`}
              {daysDone >= 7 && ' · 완주 감사합니다'}
            </p>
          </div>

          {/* 마일스톤 */}
          <div className="space-y-2.5">
            <MilestoneRow active={milestone4} title="이번 주 4일 출석" meta="운 1을 드려요" />
            <MilestoneRow active={milestone7} title="이번 주 7일 모두 출석" meta="운 2를 드려요" />
          </div>
        </section>

        {/* 공유 카드 */}
        <section className="mx-4 mt-4 rounded-[20px] p-5"
          style={{ background: C.white, border: '1px solid rgba(184,150,90,0.08)',
            boxShadow: '0 1px 2px rgba(47,42,35,0.04), 0 8px 24px rgba(47,42,35,0.04)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={C.gold} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <path d="M8.5 10.5l7-3.5M8.5 13.5l7 3.5" />
            </svg>
            <h3 className="text-[17px] font-medium" style={{ color: C.ink, fontFamily: SERIF, letterSpacing: '0.02em' }}>
              공유하고 운 받기
            </h3>
          </div>
          <p className="text-[12px] leading-[1.55] mb-4" style={{ color: C.inkMute }}>
            한 주에 한 번, 친구에게 사주500을 소개하면 0.5운을 드려요.
          </p>
          <button type="button" onClick={onShare}
            className="w-full flex items-center justify-center gap-2.5 py-[18px] rounded-[14px] font-semibold text-[16px] transition"
            style={{
              background: shareDone ? C.paper2 : C.gold,
              color: shareDone ? C.inkMute : C.white,
              boxShadow: shareDone ? 'none' : '0 2px 6px rgba(184,150,90,0.3)',
              cursor: shareDone ? 'default' : 'pointer',
            }}
            disabled={shareDone}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={shareDone ? C.inkMute : C.white} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>{shareDone ? '이번 주 공유 완료' : '친구에게 공유하기'}</span>
          </button>
          <p className="text-[12px] text-center mt-3 leading-[1.5]" style={{ color: C.inkMute }}>
            이번 주 {shareDone ? '1' : '0'}/1회 진행 · 주 1회 제한
          </p>
        </section>

        {/* 바로가기 버튼 */}
        <div className="mx-4 mt-5 grid grid-cols-2 gap-2.5">
          <button onClick={() => navigate('/daily')} className="rounded-xl py-3 text-[13px] font-semibold"
            style={{ background: C.paper2, color: C.ink }}>
            오늘의 운세
          </button>
          <button onClick={() => navigate('/dream')} className="rounded-xl py-3 text-[13px] font-semibold"
            style={{ background: C.paper2, color: C.ink }}>
            꿈해몽
          </button>
        </div>
      </div>
    </div>
  );
}

function MilestoneRow({ active, title, meta }: { active: boolean; title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: active ? C.gold : C.paper2 }}>
        {active ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 6.5l2.5 2.5L10 3.5" />
          </svg>
        ) : null}
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-medium" style={{ color: C.ink }}>{title}</p>
        <p className="text-[12px] mt-0.5" style={{ color: C.inkMute }}>{meta}</p>
      </div>
      <span className="text-[11px] px-2.5 py-1 rounded-full"
        style={{ background: active ? C.gold : C.paper2, color: active ? C.white : C.inkMute, fontWeight: 500 }}>
        {active ? '달성' : '진행 중'}
      </span>
    </div>
  );
}

export default EventsPage;
