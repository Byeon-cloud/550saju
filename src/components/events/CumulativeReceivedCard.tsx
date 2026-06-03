// CumulativeReceivedCard — 블록 5. 누적 운 카드 (하단 CTA 교체)
// 스펙: 09_이벤트_v4.md §6 · 핸드오버 §1-C-7 block 5
// Firestore `users/{uid}/rewardClaims` 를 클라이언트에서 집계 (rules read:본인만)

import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, limit as fsLimit, orderBy } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import { useAuth } from '@/hooks/useAuth';

interface Aggregate {
  total: number;
  byType: {
    attendance_streak3: number;
    invite: number;
    share: number;
    etc: number;
  };
  tosspointCount: number;
  tosspointAmount: number;
}

const ZERO: Aggregate = {
  total: 0,
  byType: { attendance_streak3: 0, invite: 0, share: 0, etc: 0 },
  tosspointCount: 0,
  tosspointAmount: 0,
};

function statusCopy(total: number): string {
  if (total === 0) return '이벤트 탭에서 받은 운이 여기 쌓여요 · 첫 운을 받아볼까요';
  if (total <= 9) return '차곡차곡 쌓이고 있어요';
  if (total <= 49) return '꾸준함이 복을 불러요';
  return '귀인의 기운이 머물고 있어요';
}

export function CumulativeReceivedCard() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [agg, setAgg] = useState<Aggregate>(ZERO);
  const [loading, setLoading] = useState(true);
  const [detailType, setDetailType] = useState<string | null>(null);
  const [detailList, setDetailList] = useState<Array<{ id: string; amount: number; grantedAt?: any; cycle?: string }>>([]);

  useEffect(() => {
    if (!uid) {
      setAgg(ZERO);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const snap = await getDocs(collection(db, `users/${uid}/rewardClaims`));
        const next: Aggregate = { total: 0, byType: { attendance_streak3: 0, invite: 0, share: 0, etc: 0 }, tosspointCount: 0, tosspointAmount: 0 };
        snap.forEach((doc) => {
          const d = doc.data() as any;
          const t = d?.type as string;
          const amount = Number(d?.amount ?? 0);
          if (t === 'attendance_week7_tosspoint') {
            // 토스포인트는 별도 집계 (운 합산에서 제외)
            next.tosspointCount += 1;
            next.tosspointAmount += amount;
            return;
          }
          if (t === 'attendance_week7_fallback' || t === 'attendance_week7_pending') {
            // pending은 합산 제외 · fallback(운 2)은 etc로 분류
            if (t === 'attendance_week7_fallback') next.byType.etc += amount;
            return;
          }
          // UN 계열
          next.total += amount;
          if (t === 'attendance_streak3') next.byType.attendance_streak3 += amount;
          else if (t === 'invite') next.byType.invite += amount;
          else if (t === 'share') next.byType.share += amount;
          else next.byType.etc += amount;
        });
        setAgg(next);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CumulativeReceivedCard] aggregate failed', e);
        setAgg(ZERO);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const status = useMemo(() => statusCopy(agg.total), [agg.total]);

  const openDetail = async (type: string) => {
    if (!uid) return;
    setDetailType(type);
    try {
      const q = query(
        collection(db, `users/${uid}/rewardClaims`),
        where('type', '==', type),
        orderBy('grantedAt', 'desc'),
        fsLimit(10),
      );
      const snap = await getDocs(q);
      setDetailList(
        snap.docs.map((d) => ({
          id: d.id,
          amount: (d.data() as any)?.amount ?? 0,
          grantedAt: (d.data() as any)?.grantedAt,
          cycle: (d.data() as any)?.cycle,
        })),
      );
    } catch (e) {
      setDetailList([]);
    }
  };

  const closeDetail = () => setDetailType(null);

  return (
    <>
      <section
        className="mx-4 mt-4 rounded-2xl p-6"
        style={{
          background: 'linear-gradient(180deg, #FFFFFF 0%, #F8F5EE 100%)',
          border: '1px solid #EDEAE0',
          boxShadow: '0 1px 2px rgba(47,42,35,0.04), 0 8px 24px rgba(47,42,35,0.04)',
        }}
      >
        <p className="text-[12px] font-medium" style={{ color: '#8A7F6E' }}>지금까지 받은 운</p>

        <div className="mt-3 flex items-end gap-1.5">
          <span className="font-extrabold leading-none"
            style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 48, color: '#B8965A' }}>
            {loading ? '—' : agg.total}
          </span>
          <span className="text-[18px] font-semibold pb-1" style={{ color: '#1D2D4A' }}>운</span>
        </div>

        <p className="mt-2 text-[12px]" style={{ color: '#8A7F6E' }}>{status}</p>

        <div className="mt-5 pt-4 space-y-2" style={{ borderTop: '1px solid #EDEAE0' }}>
          <Row label="출석 3일 연속" amount={agg.byType.attendance_streak3} onInfo={() => openDetail('attendance_streak3')} />
          <Row label="친구 초대"       amount={agg.byType.invite} onInfo={() => openDetail('invite')} />
          <Row label="공유"             amount={agg.byType.share} onInfo={() => openDetail('share')} />
          <Row label="기타"             amount={agg.byType.etc} onInfo={() => openDetail('etc')} />
        </div>

        {agg.tosspointCount > 0 ? (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid #EDEAE0' }}>
            <Row
              label="토스포인트 (7일 완주)"
              amountText={`${agg.tosspointAmount}원 · ${agg.tosspointCount}회 수령`}
              highlight
              onInfo={() => openDetail('attendance_week7_tosspoint')}
            />
          </div>
        ) : null}
      </section>

      {/* 상세 바텀시트 (최근 10건) */}
      {detailType ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={closeDetail}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-[460px] rounded-t-3xl p-6 pb-10"
            style={{ background: '#FFFFFF' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: '#E5DFD0' }} />
            <h4 className="text-[16px] font-bold mb-3" style={{ color: '#1D2D4A', fontFamily: "'Noto Serif KR', serif" }}>
              최근 10건
            </h4>
            {detailList.length === 0 ? (
              <p className="text-[13px] py-6 text-center" style={{ color: '#8A7F6E' }}>
                아직 내역이 없어요
              </p>
            ) : (
              <ul className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                {detailList.map((x) => (
                  <li key={x.id} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#6B5F4E' }}>
                      {x.cycle ?? '—'}
                    </span>
                    <span className="font-semibold" style={{ color: '#1A1A1A' }}>
                      {detailType === 'attendance_week7_tosspoint' ? `${x.amount}원` : `운 ${x.amount}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={closeDetail}
              className="mt-5 w-full h-11 rounded-xl font-semibold text-[13px]"
              style={{ background: '#1A1A1A', color: '#F8F5EE' }}>
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Row({
  label, amount, amountText, onInfo, highlight,
}: { label: string; amount?: number; amountText?: string; onInfo: () => void; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px]" style={{ color: highlight ? '#1A1A1A' : '#6B5F4E', fontWeight: highlight ? 600 : 500 }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold" style={{ color: '#1A1A1A' }}>
          {amountText ?? `운 ${amount ?? 0}`}
        </span>
        <button type="button" onClick={onInfo} aria-label={`${label} 최근 10건 보기`}
          className="w-5 h-5 rounded-full inline-flex items-center justify-center"
          style={{ border: '1px solid #E5DFD0', background: '#FFFFFF', color: '#8A7F6E' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-5" />
            <circle cx="12" cy="8.5" r="0.8" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default CumulativeReceivedCard;
