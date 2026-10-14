// CumulativeReceivedCard — 블록 5. 누적 운 카드 (하단 CTA 교체)
// 스펙: 09_이벤트_v4.md §6 · 핸드오버 §1-C-7 block 5
//
// 2026-09-17 — 기기 보상 장부(dailyReward.getRewardLedger) 기준으로 재작성.
//   구 동작: 서버 users/{uid}/rewardClaims 집계 → 기기에서 실제로 지급된 운(0.1운·3일·공유/초대)은 서버에 없어 0 으로 보였고,
//   상세 조회는 인덱스 없는 where+orderBy 라 실패, 'etc' 타입은 서버에 존재하지 않았다.
//   장부는 이 기기에서 도입 이후 기록부터 쌓인다 (since 안내).

import { useEffect, useMemo, useState } from 'react';
import {
  getReceivedUnTotal,
  getRewardLedger,
  hasRewardRecords,
  REWARD_LEDGER_CHANGED_EVENT,
} from '@/services/storage/dailyReward';
import type { DeviceRewardType, RewardLedger } from '@/types/rewards';

const UN_ROWS: Array<{ type: DeviceRewardType; label: string }> = [
  { type: 'daily', label: '하루 첫 결과' },
  { type: 'streak3', label: '3일 연속 출석' },
  { type: 'invite', label: '친구 초대' },
  { type: 'share', label: '결과 공유' },
];

const TOSSPOINT_ROWS: Array<{ type: DeviceRewardType; label: string }> = [
  { type: 'attend7', label: '7일 연속 출석' },
  { type: 'launch_promo', label: '첫 콘텐츠 이용' },
];

const DETAIL_TITLE: Record<DeviceRewardType, string> = {
  daily: '하루 첫 결과',
  streak3: '3일 연속 출석',
  invite: '친구 초대',
  share: '결과 공유',
  launch_promo: '토스포인트, 첫 콘텐츠 이용',
  attend7: '토스포인트, 7일 연속 출석',
};

const isTossPoint = (t: DeviceRewardType) => t === 'attend7' || t === 'launch_promo';

/** 끝난 보상 (2026-10-14: 공유 보상, 첫 콘텐츠 50원 프로모) — 받은 기록이 있을 때만 줄을 보인다 */
const ENDED = new Set<DeviceRewardType>(['invite', 'share', 'launch_promo']);

/** 0.1 단위 운 표시 (정수면 소수점 없이) */
function fmtUn(n: number): string {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function fmtDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : date;
}

function statusCopy(total: number): string {
  if (total === 0) return '이벤트로 받은 운이 여기 쌓여요. 첫 운을 받아볼까요?';
  if (total <= 9) return '차곡차곡 쌓이고 있어요';
  if (total <= 49) return '꾸준함이 복을 불러요';
  return '귀인의 기운이 머물고 있어요';
}

export interface CumulativeReceivedCardProps {
  /** 토스포인트 줄 노출 (앱인토스) — 웹이어도 받은 기록이 있으면 노출 */
  showTossPoint?: boolean;
}

export function CumulativeReceivedCard({ showTossPoint = false }: CumulativeReceivedCardProps) {
  const [ledger, setLedger] = useState<RewardLedger>(() => getRewardLedger());
  const [detailType, setDetailType] = useState<DeviceRewardType | null>(null);

  useEffect(() => {
    const refresh = () => setLedger(getRewardLedger());
    refresh();
    window.addEventListener(REWARD_LEDGER_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(REWARD_LEDGER_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const total = useMemo(() => getReceivedUnTotal(ledger), [ledger]);
  const status = useMemo(() => statusCopy(total), [total]);
  const hasRecords = useMemo(() => hasRewardRecords(ledger), [ledger]);
  const tossPointCount = ledger.counts.attend7 + ledger.counts.launch_promo;
  const tossPointVisible = showTossPoint || tossPointCount > 0;

  const detailList = detailType ? ledger.recent[detailType] : [];
  const closeDetail = () => setDetailType(null);

  return (
    <>
      <section
        className="mx-4 mt-4 rounded-2xl p-6"
        style={{
          background: '#FFFDF8',
          border: '1px solid #EDEAE0',
          boxShadow: '0 1px 2px rgba(47,42,35,0.04), 0 8px 24px rgba(47,42,35,0.04)',
        }}
      >
        <p className="text-[13.5px] font-medium" style={{ color: '#8A7F6E' }}>지금까지 받은 운</p>

        <div className="mt-3 flex items-end gap-1.5">
          <span className="font-extrabold leading-none"
            style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 48, color: '#B8965A' }}>
            {fmtUn(total)}
          </span>
          <span className="text-[18px] font-semibold pb-1" style={{ color: '#1A1612' }}>운</span>
        </div>

        <p className="mt-2 text-[13.5px]" style={{ color: '#8A7F6E' }}>{status}</p>

        <div className="mt-5 pt-4 space-y-2" style={{ borderTop: '1px solid #EDEAE0' }}>
          {UN_ROWS.filter((row) => !ENDED.has(row.type) || ledger.totals[row.type] > 0).map((row) => (
            <Row
              key={row.type}
              label={row.label}
              amountText={`${fmtUn(ledger.totals[row.type])}운`}
              onInfo={() => setDetailType(row.type)}
            />
          ))}
        </div>

        {tossPointVisible ? (
          <div className="mt-4 pt-3 space-y-2" style={{ borderTop: '1px solid #EDEAE0' }}>
            <p className="text-[13.5px] font-medium" style={{ color: '#8A7F6E' }}>받은 토스포인트</p>
            {TOSSPOINT_ROWS.filter((row) => !ENDED.has(row.type) || ledger.counts[row.type] > 0).map((row) => (
              <Row
                key={row.type}
                label={row.label}
                amountText={ledger.counts[row.type] > 0
                  ? `${ledger.totals[row.type]}원, ${ledger.counts[row.type]}회`
                  : '0원'}
                highlight={ledger.counts[row.type] > 0}
                onInfo={() => setDetailType(row.type)}
              />
            ))}
          </div>
        ) : null}

        {hasRecords ? (
          <p className="mt-4 text-[13px]" style={{ color: '#8A7F6E', lineHeight: 1.5 }}>
            이 기기에 기록된 내역이에요, {fmtDate(ledger.since)}부터 쌓였어요
          </p>
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
          aria-label={`${DETAIL_TITLE[detailType]} 최근 10건`}
        >
          <div
            className="w-full max-w-[460px] rounded-t-3xl p-6 pb-10"
            style={{ background: '#FFFFFF' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: '#E5DFD0' }} />
            <h4 className="text-[16px] font-bold mb-3" style={{ color: '#1A1612', fontFamily: "'Noto Serif KR', serif" }}>
              {DETAIL_TITLE[detailType]} 최근 10건
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
                      {fmtDate(x.date)}
                    </span>
                    <span className="font-semibold" style={{ color: '#1A1A1A' }}>
                      {isTossPoint(detailType) ? `${x.amount}원` : `${fmtUn(x.amount)}운`}
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
  label, amountText, onInfo, highlight,
}: { label: string; amountText: string; onInfo: () => void; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px]" style={{ color: highlight ? '#1A1A1A' : '#6B5F4E', fontWeight: highlight ? 600 : 500 }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold" style={{ color: '#1A1A1A' }}>
          {amountText}
        </span>
        <button type="button" onClick={onInfo} aria-label={`${label} 최근 10건 보기`}
          className="w-5 h-5 rounded-full inline-flex items-center justify-center tap-pad"
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
