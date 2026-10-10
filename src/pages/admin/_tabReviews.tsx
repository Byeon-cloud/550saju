// 어드민 — 후기 승인 탭 (2026-10-10)
//   결과 화면 끝 ReviewAsk 로 들어온 후기(reviews 컬렉션)를 보고 승인/숨김. 홈에는 '승인 + 공개 동의 + 글 있음'만 노출.
//   규칙: 오너만 읽기 전체·status 변경 가능 (firestore.rules reviews). 삭제는 없음 — 숨김으로 처리.
import { useEffect, useState } from 'react';
import { C, Section, Empty } from './_components';
import { adminListReviews, adminSetReviewStatus, type AdminReview } from '@/services/reviews';

const STATUS_LABEL: Record<string, string> = { pending: '대기', approved: '공개 중', hidden: '숨김' };

export function TabReviews() {
  const [rows, setRows] = useState<AdminReview[] | null>(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = () => {
    setErr('');
    adminListReviews().then(setRows).catch((e) => { setRows([]); setErr(String(e?.message || e)); });
  };
  useEffect(load, []);

  const setStatus = async (id: string, status: 'approved' | 'hidden') => {
    setBusyId(id);
    try {
      await adminSetReviewStatus(id, status);
      setRows((rs) => (rs || []).map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e: any) { setErr(String(e?.message || e)); }
    setBusyId('');
  };

  const pending = (rows || []).filter((r) => r.status === 'pending').length;
  const avg = rows && rows.length ? (rows.reduce((a, r) => a + r.rating, 0) / rows.length).toFixed(2) : '-';

  return (
    <div>
      <Section title={`후기 ${rows ? rows.length : '…'}건 · 대기 ${pending} · 평균 ★${avg}`}
        right={<button type="button" onClick={load} style={{ fontSize: 12, color: C.goldDeep, fontWeight: 700 }}>새로고침</button>}
        caption="공개 승인은 '홈 공개 동의' + 글이 있는 후기만 가능해요. 숨김은 언제든 되돌릴 수 있어요(승인 다시 누르기).">
        {err && <p style={{ fontSize: 12, color: C.down, marginBottom: 8 }}>{err}</p>}
        {rows == null ? <Empty text="불러오는 중…" /> : rows.length === 0 ? <Empty text="아직 들어온 후기가 없어요" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r) => {
              const canPublic = r.consentPublic && r.text.trim().length >= 8;
              return (
                <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.mute }}>
                    <span>{r.contentLabel || r.contentType} · {r.createdAtMs ? new Date(r.createdAtMs).toLocaleString('ko-KR') : '-'}</span>
                    <span style={{ fontWeight: 700, color: r.status === 'approved' ? C.up : r.status === 'hidden' ? C.down : C.goldDeep }}>{STATUS_LABEL[r.status] || r.status}</span>
                  </div>
                  <div style={{ fontSize: 14, color: C.gold, marginTop: 4 }}>{'★'.repeat(r.rating)}<span style={{ color: C.line }}>{'★'.repeat(5 - r.rating)}</span></div>
                  <p style={{ fontSize: 14, color: C.ink, marginTop: 4, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.text || <span style={{ color: C.mute }}>(글 없음 · 별점만)</span>}</p>
                  <div style={{ fontSize: 11.5, color: C.mute, marginTop: 4 }}>홈 공개 동의: {r.consentPublic ? '예' : '아니오'}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button type="button" disabled={!canPublic || busyId === r.id || r.status === 'approved'} onClick={() => setStatus(r.id, 'approved')}
                      style={{ flex: 1, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 700, background: canPublic && r.status !== 'approved' ? C.ink : C.line, color: canPublic && r.status !== 'approved' ? '#fff' : C.mute }}>
                      홈에 공개
                    </button>
                    <button type="button" disabled={busyId === r.id || r.status === 'hidden'} onClick={() => setStatus(r.id, 'hidden')}
                      style={{ flex: 1, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${C.line}`, color: r.status === 'hidden' ? C.mute : C.ink, background: '#fff' }}>
                      숨김
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
