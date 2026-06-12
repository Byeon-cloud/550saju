// 어드민 — CS 지급 탭 (2026-06-12)
//   디바이스 ID + 운 수량 입력 → adminGrantCompensation callable → compensations 장부 기록.
//   고객이 앱을 열면 기존 claimCompensation 파이프가 자동 적립 (배포 불필요).
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { C, Section } from './_components';

const TOPIC_OPTS: { key: string; label: string }[] = [
  { key: 'love', label: '연애운' }, { key: 'reunion', label: '재회운' }, { key: 'marriage', label: '결혼운' },
  { key: 'wealth', label: '재물운' }, { key: 'exam', label: '합격이직운' }, { key: 'business', label: '사업운' },
  { key: 'health', label: '건강운' }, { key: 'move', label: '이사운' }, { key: 'study', label: '학업운' },
  { key: 'career', label: '직업운' },
];

async function callGrant(payload: Record<string, unknown>): Promise<any> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const { app } = await import('@/services/auth/firebase');
  const fn = httpsCallable(getFunctions(app, 'us-central1'), 'adminGrantCompensation');
  const r = await fn(payload);
  return r.data;
}

export function TabCsGrant() {
  const [deviceId, setDeviceId] = useState('');
  const [amount, setAmount] = useState('5');
  const [note, setNote] = useState('');
  const [wipe, setWipe] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const did = deviceId.trim().toLowerCase();
  const didValid = /^[0-9a-f]{32,128}$/.test(did);

  const toggleWipe = (k: string) => setWipe((s) => {
    const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n;
  });

  const grant = async () => {
    if (!didValid || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await callGrant({ action: 'grant', deviceId: did, amount: Number(amount) || 0, note, wipeTopics: Array.from(wipe) });
      setMsg({ kind: 'ok', text: `지급 등록 완료 — 대기 중 합계 ${r.totalPending}운${r.accumulated ? ' (기존 미수령분에 누적)' : ''}. 고객이 앱을 열면 자동 적립돼요.` });
      setWipe(new Set()); setNote('');
    } catch (e: any) {
      setMsg({ kind: 'err', text: `실패: ${e?.message || e}` });
    } finally { setBusy(false); }
  };

  const checkStatus = async () => {
    if (!didValid || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await callGrant({ action: 'status', deviceId: did });
      if (!r.exists) setMsg({ kind: 'info', text: '이 디바이스 ID 로 등록된 지급 내역이 없어요.' });
      else if (r.claimed) setMsg({ kind: 'ok', text: `수령 완료 — ${r.amount}운 (수령 ${r.claimedAt ? new Date(r.claimedAt).toLocaleString('ko-KR') : '-'})${r.note ? ` · 사유: ${r.note}` : ''}` });
      else setMsg({ kind: 'info', text: `대기 중 — ${r.amount}운 미수령 (고객이 아직 앱을 안 열었어요)${r.note ? ` · 사유: ${r.note}` : ''}` });
    } catch (e: any) {
      setMsg({ kind: 'err', text: `실패: ${e?.message || e}` });
    } finally { setBusy(false); }
  };

  const inputStyle: CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.line}`,
    background: C.surface, fontSize: 13, color: C.ink, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: C.ink, display: 'block', marginBottom: 6 };

  return (
    <div>
      <Section
        title="CS 운 지급 (디바이스 ID)"
        caption="· 앱인토스 CS 콘솔의 문의자 디바이스 ID 또는 내정보 하단 '고객센터 코드' — 등록 즉시 장부에 기록되고, 고객이 앱을 여는 순간 자동 적립 + 토스트 안내 (배포 불필요)"
      >
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, display: 'grid', gap: 14, maxWidth: 560 }}>
          <div>
            <label style={labelStyle}>디바이스 ID (hex 32~128자)</label>
            <input style={{ ...inputStyle, fontFamily: 'monospace', borderColor: did && !didValid ? '#C0392B' : C.line }}
              value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="4c7f87e8..." />
            {did && !didValid && <p style={{ fontSize: 11, color: '#C0392B', marginTop: 4 }}>형식이 아니에요 — 소문자 hex 32~128자</p>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>지급 운</label>
              <input style={inputStyle} type="number" min={1} max={100} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>사유 메모 (내부용 — 고객 노출 안 됨)</label>
              <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 6/12 결제 누락 보상" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>잘못 생성된 주제 결과 동반 삭제 (선택)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TOPIC_OPTS.map((t) => (
                <button key={t.key} onClick={() => toggleWipe(t.key)} style={{
                  padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${wipe.has(t.key) ? C.goldDeep : C.line}`,
                  background: wipe.has(t.key) ? 'rgba(184,150,90,0.15)' : C.surface,
                  color: wipe.has(t.key) ? C.goldDeep : C.mute,
                }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={grant} disabled={!didValid || busy} style={{
              flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: didValid && !busy ? 'pointer' : 'not-allowed',
              background: didValid && !busy ? C.gold : C.line, color: '#fff', fontSize: 14, fontWeight: 800,
            }}>{busy ? '처리 중...' : '운 지급 등록'}</button>
            <button onClick={checkStatus} disabled={!didValid || busy} style={{
              padding: '12px 18px', borderRadius: 10, cursor: didValid && !busy ? 'pointer' : 'not-allowed',
              border: `1px solid ${C.line}`, background: C.surface, color: C.ink, fontSize: 13, fontWeight: 700,
            }}>상태 확인</button>
          </div>
          {msg && (
            <p style={{
              fontSize: 13, fontWeight: 600, margin: 0, padding: '10px 12px', borderRadius: 10,
              background: msg.kind === 'err' ? 'rgba(192,57,43,0.08)' : 'rgba(184,150,90,0.10)',
              color: msg.kind === 'err' ? '#C0392B' : msg.kind === 'ok' ? C.goldDeep : C.ink,
            }}>{msg.text}</p>
          )}
          <p style={{ fontSize: 11, color: C.mute, margin: 0, lineHeight: 1.6 }}>
            · 같은 ID 에 미수령 장부가 있으면 누적돼요 (대기 합계 최대 100운)<br />
            · 수령 여부는 "상태 확인"으로 추적 — 수령 완료로 바뀌면 고객 지갑에 들어간 거예요
          </p>
        </div>
      </Section>
    </div>
  );
}
