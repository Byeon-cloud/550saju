/**
 * 관리자 v4 — 고객 찾기와 운 넣기 (2026-10-19)
 *   무엇이든 넣는다: 회원 ID(문의 메일 제목 '회원ID:…' 통째로 붙여도 됨), 토스 기기 ID(토스 CS 콘솔), 이메일, 결제번호,
 *   초대 코드, 토스 회원 번호. 서버 adminLookup 이 계정 카드를 돌려준다.
 *
 *   운 넣는 기준 (CS 원칙, 메모리 feedback_cs_reply_rules):
 *     결제 누락 = 그 결제의 운(보너스 포함) / 풀이 실패 = 쓴 운 + 사과 2운 / 기록 유실 = 복구되면 10운, 안 되면 15운 /
 *     불편 사과 = 2운. 현금 환불 대신 운으로, 넉넉하게. 넣은 운은 고객이 앱이나 웹을 다시 열 때 자동으로 들어간다.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { callAdmin, fmt, won, timeText, CONTENT_NAME } from './api';
import { Box, Table, K } from './ui';

interface Pay { id: string; plat: string; amount: number; status: string; un: number; at: number; refundedAt: number; recovered: boolean; fail: string }
interface Lib { id: string; type: string; topic: string; un: number; at: number; name: string }
interface CardData {
  uid: string; login: string; email: string; createdAt: number; lastSignInAt: number; lastSeenDay: string; plats: string[]; firstSource: string;
  status: string; serverTotals: { charged: number; spent: number } | null;
  deviceBalance: { paid: number; bonus: number; reward: number; at: number } | null;
  devices: string[]; payments: Pay[]; library: Lib[];
  generated: { id: string; type: string; topic: string; at: number; recovery: boolean }[];
  aiFails: { day: string; type: string; stage: string; message: string }[];
  compensations: { key: string; amount: number; claimed: boolean; note: string; reason: string; at: number; claimedAt: number }[];
  grantLog: { at: number; amount: number; reason: string; note: string; target: string }[];
  referralCode: string;
  recent: { day: string; at: number; name: string; plat: string; detail: string }[];
}
interface LookupResult { q: string; kind: string; devices: string[]; note: string; cards: CardData[] }

const STATUS: Record<string, string> = { confirmed: '확정', refunded: '환불', failed: '실패', pending: '확인 전', needs_reconciliation: '확인 필요', partial_refund_review: '부분 환불 확인 필요' };
const REASONS = [
  { v: 'pay_missing', label: '결제했는데 운이 안 들어옴', hint: '그 결제의 운(보너스 포함)' },
  { v: 'ai_fail', label: '풀이가 안 나옴, 깨짐', hint: '쓴 운 + 사과 2운' },
  { v: 'lost_restored', label: '기록 유실, 복구됨', hint: '10운' },
  { v: 'lost_unrestored', label: '기록 유실, 복구 안 됨', hint: '15운' },
  { v: 'apology', label: '불편 사과', hint: '2운' },
  { v: 'other', label: '기타', hint: '직접 정하기' },
] as const;
type Reason = typeof REASONS[number]['v'];
// 예전 화면에 있던 기능: 잘못 만들어진 주제 결과를 보상과 함께 고객 기기에서 지운다(받아 갈 때 같이 처리)
const TOPICS = [
  { k: 'love', l: '연애운' }, { k: 'reunion', l: '재회운' }, { k: 'marriage', l: '결혼운' }, { k: 'wealth', l: '재물운' }, { k: 'exam', l: '합격이직운' },
  { k: 'business', l: '사업운' }, { k: 'health', l: '건강운' }, { k: 'move', l: '이사운' }, { k: 'study', l: '공부운' }, { k: 'career', l: '직업운' },
];
const EVENT_NAME: Record<string, string> = {
  app_open: '열기', page_view: '화면', content_open: '콘텐츠 열기', content_result: '결과 받음', content_purchase: '운 사용', charge_open: '충전 화면',
  charge_complete: '충전 완료', charge_failed: '충전 실패', insufficient_balance: '운 모자람', profile_created: '사주 입력', login_success: '로그인', login_fail: '로그인 실패',
  share_complete: '보내기', cta_click: '누름', client_error: '화면 오류', ai_error: 'AI 오류', signup: '첫 방문', charge_login_gate: '결제 전 로그인 창',
};

const input: CSSProperties = { padding: '10px 12px', borderRadius: 10, border: `1px solid ${K.line}`, background: K.surface, fontSize: 14.5, color: K.ink, outline: 'none', boxSizing: 'border-box' };
const btn = (on: boolean): CSSProperties => ({ padding: '10px 16px', borderRadius: 10, border: 0, fontSize: 14.5, fontWeight: 800, cursor: on ? 'pointer' : 'not-allowed', background: on ? K.ink : K.line, color: '#F4EFE4' });

export function Customer() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<LookupResult | null>(null);
  const [err, setErr] = useState('');
  const search = async (value = q) => {
    if (!value.trim() || busy) return;
    setBusy(true); setErr('');
    try { setRes(await callAdmin<LookupResult>('adminLookup', { q: value.trim() })); }
    catch (e: any) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <Box title="고객 찾기" note="회원 ID, 문의 메일 제목 통째로, 토스 기기 ID(토스 CS 콘솔), 이메일, 결제번호, 초대 코드, 토스 회원 번호 중 아무거나 넣으면 돼요. 내 정보 맨 아래 '고객센터 코드'가 회원 ID예요.">
        <form onSubmit={(e) => { e.preventDefault(); search(); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...input, flex: '1 1 320px', fontFamily: 'monospace' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 사주500 문의 [회원ID:abc…] 또는 기기 ID" />
          <button type="submit" style={btn(!!q.trim() && !busy)} disabled={!q.trim() || busy}>{busy ? '찾는 중…' : '찾기'}</button>
        </form>
        {err && <p style={{ color: K.red, fontSize: 13.5, marginTop: 8 }}>{err}</p>}
      </Box>

      {res && (
        <div>
          {res.note && <p style={{ fontSize: 14, color: K.ink2, background: K.surface, border: `1px solid ${K.line}`, borderRadius: 10, padding: '10px 12px' }}>{res.note}</p>}
          {res.cards.length === 0 && (
            <div style={{ background: K.surface, border: `1px solid ${K.line}`, borderRadius: 12, padding: 14, fontSize: 14 }}>
              찾은 계정이 없어요.
              {res.kind === 'device' && res.devices[0] && <GrantForm target={res.devices[0]} targetLabel="토스 기기 ID" card={null} onDone={() => search(res.q)} />}
            </div>
          )}
          {res.cards.map((c) => <CustomerCard key={c.uid} c={c} devices={res.kind === 'device' ? res.devices : c.devices} onRefresh={() => search(res.q)} />)}
        </div>
      )}
    </div>
  );
}

function CustomerCard({ c, devices, onRefresh }: { c: CardData; devices: string[]; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);
  const pendingComp = c.compensations.filter((x) => !x.claimed);
  const bal = c.deviceBalance;
  return (
    <div style={{ background: K.paper, border: `1px solid ${K.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: K.ink }}>{c.plats.join(', ') || '기록 없음'} 회원, {c.login}</div>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(c.uid).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
            style={{ marginTop: 4, padding: 0, border: 0, background: 'none', fontFamily: 'monospace', fontSize: 13.5, color: K.goldDeep, cursor: 'pointer' }}>
            {c.uid} {copied ? '(복사됨)' : '(누르면 복사)'}
          </button>
        </div>
        <div style={{ fontSize: 13.5, color: K.mute, textAlign: 'right', lineHeight: 1.6 }}>
          가입 {timeText(c.createdAt)}<br />마지막 활동 {c.lastSeenDay || '-'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 10, fontSize: 13.5, color: K.ink2 }}>
        <Fact k="이메일" v={c.email || '-'} />
        <Fact k="처음 들어온 곳" v={c.firstSource || '-'} />
        <Fact k="기기 잔액(기기가 알려 준 값)" v={bal ? `${fmt(bal.paid + bal.bonus + bal.reward)}운 (충전 ${fmt(bal.paid)}, 보너스 ${fmt(bal.bonus)}, 리워드 ${fmt(bal.reward)})` : '-'} />
        <Fact k="서버 누적" v={c.serverTotals ? `충전 ${fmt(c.serverTotals.charged)}운, 사용 ${fmt(c.serverTotals.spent)}운` : '-'} />
        <Fact k="토스 기기" v={devices.length ? devices.map((d) => `${d.slice(0, 10)}…`).join(', ') : '-'} />
        <Fact k="초대 코드" v={c.referralCode || '-'} />
        {c.status && <Fact k="계정 상태" v={c.status} />}
      </div>
      {pendingComp.length > 0 && (
        <p style={{ fontSize: 14, color: K.red, marginTop: 10, fontWeight: 700 }}>아직 안 받아 간 보상 {fmt(pendingComp.reduce((s, x) => s + x.amount, 0))}운이 있어요. 고객이 앱이나 웹을 다시 열면 들어가요.</p>
      )}

      <h3 style={h3}>결제</h3>
      <Table head={['언제', '앱/웹', '금액', '운', '상태', '메모']} align={['l', 'l', 'r', 'r', 'l', 'l']}
        rows={c.payments.map((p) => [timeText(p.at), p.plat, won(p.amount), fmt(p.un), STATUS[p.status] || p.status, [p.recovered ? '결제이력 복구' : '', p.refundedAt ? `환불 ${timeText(p.refundedAt)}` : '', p.fail].filter(Boolean).join(', ')])} />

      <h3 style={h3}>쓴 운과 풀이 (보관함)</h3>
      <Table head={['언제', '콘텐츠', '주제', '쓴 운', '이름']} align={['l', 'l', 'l', 'r', 'l']}
        rows={c.library.slice(0, 15).map((r) => [timeText(r.at), CONTENT_NAME[r.type] || r.type, r.topic, r.un ? fmt(r.un) : '', r.name])} />

      {c.aiFails.length > 0 && (<>
        <h3 style={h3}>AI 실패</h3>
        <Table head={['날짜', '콘텐츠', '단계', '내용']} rows={c.aiFails.slice(0, 10).map((f) => [f.day, CONTENT_NAME[f.type] || f.type, f.stage, f.message.slice(0, 90)])} />
      </>)}

      <h3 style={h3}>보상 내역</h3>
      <Table head={['언제', '운', '사유', '받았나']} align={['l', 'r', 'l', 'l']}
        rows={[
          ...c.grantLog.map((g) => [timeText(g.at), fmt(g.amount), g.note || g.reason, '']),
          ...c.compensations.map((x) => [timeText(x.at), fmt(x.amount), x.note || x.reason, x.claimed ? `받음 ${timeText(x.claimedAt)}` : '아직']),
        ]} />

      <GrantForm target={c.uid} targetLabel="회원 ID" card={c} onDone={onRefresh} devices={devices} />

      <h3 style={h3}>최근 행동</h3>
      <Table head={['언제', '앱/웹', '행동', '내용']}
        rows={c.recent.slice(0, 20).map((e) => [timeText(e.at), e.plat, EVENT_NAME[e.name] || e.name, e.detail])} />
    </div>
  );
}

const h3: CSSProperties = { fontSize: 14.5, fontWeight: 800, color: K.ink, margin: '16px 0 6px' };
function Fact({ k, v }: { k: string; v: string }) {
  return <div style={{ background: K.surface, border: `1px solid ${K.line}`, borderRadius: 10, padding: '8px 10px', minWidth: 0 }}><div style={{ fontSize: 12.5, color: K.mute }}>{k}</div><div style={{ wordBreak: 'break-all' }}>{v}</div></div>;
}

function suggest(reason: Reason, card: CardData | null, payId: string): number {
  if (reason === 'lost_restored') return 10;
  if (reason === 'lost_unrestored') return 15;
  if (reason === 'apology') return 2;
  if (reason === 'pay_missing') return card?.payments.find((p) => p.id === payId)?.un || card?.payments[0]?.un || 0;
  if (reason === 'ai_fail') { const last = card?.library.find((r) => r.un > 0); return (last?.un || 0) + 2; }
  return 0;
}

function GrantForm({ target, targetLabel, card, onDone, devices = [] }: { target: string; targetLabel: string; card: CardData | null; onDone: () => void; devices?: string[] }) {
  const [to, setTo] = useState(target);
  const [reason, setReason] = useState<Reason>('apology');
  const [payId, setPayId] = useState(card?.payments[0]?.id || '');
  const [amount, setAmount] = useState(String(suggest('apology', card, '')));
  const [note, setNote] = useState('');
  const [wipe, setWipe] = useState<string[]>([]);
  const [step, setStep] = useState<'edit' | 'confirm' | 'busy'>('edit');
  const [msg, setMsg] = useState('');
  const n = Math.round(Number(amount) || 0);
  const ok = n >= 1 && n <= 100;
  const pick = (r: Reason) => { setReason(r); const s = suggest(r, card, payId); if (s) setAmount(String(s)); };
  const submit = async () => {
    setStep('busy'); setMsg('');
    try {
      const r = await callAdmin<{ totalPending: number; accumulated: boolean }>('adminGrantCompensation', { action: 'grant', target: to, amount: n, reason, note, wipeTopics: wipe, uids: card ? [card.uid] : [] });
      setMsg(`넣었어요. 받을 운 ${r.totalPending}운${r.accumulated ? '(아직 안 받은 것과 합쳐서)' : ''}. 고객이 다시 열면 들어가요.`);
      setStep('edit'); setNote(''); setWipe([]);
      setTimeout(onDone, 600);
    } catch (e: any) { setMsg(`실패: ${e?.message || e}`); setStep('edit'); }
  };
  return (
    <div style={{ background: K.surface, border: `1px solid ${K.gold}`, borderRadius: 12, padding: 12, marginTop: 14 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: K.ink, marginBottom: 8 }}>운 넣기</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {REASONS.map((r) => (
          <button key={r.v} type="button" onClick={() => pick(r.v)}
            style={{ padding: '7px 10px', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${reason === r.v ? K.ink : K.line}`, background: reason === r.v ? K.ink : K.surface, color: reason === r.v ? '#F4EFE4' : K.ink2 }}>
            {r.label} <span style={{ fontWeight: 500, opacity: 0.75 }}>({r.hint})</span>
          </button>
        ))}
      </div>
      {reason === 'pay_missing' && card && card.payments.length > 0 && (
        <select value={payId} onChange={(e) => { setPayId(e.target.value); setAmount(String(suggest('pay_missing', card, e.target.value))); }} style={{ ...input, width: '100%', marginBottom: 8 }}>
          {card.payments.map((p) => <option key={p.id} value={p.id}>{timeText(p.at)} {p.plat} {won(p.amount)} {fmt(p.un)}운 ({STATUS[p.status] || p.status})</option>)}
        </select>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
        <input style={input} type="number" min={1} max={100} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="운" />
        <input style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모 (고객에게 안 보여요). 예: 10/19 신년운세 실패" />
      </div>
      {reason === 'ai_fail' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: K.mute }}>잘못 만들어진 주제 결과도 지우기(선택)</span>
          {TOPICS.map((t) => (
            <button key={t.k} type="button" onClick={() => setWipe((w) => (w.includes(t.k) ? w.filter((x) => x !== t.k) : [...w, t.k]))}
              style={{ padding: '4px 8px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: `1px solid ${wipe.includes(t.k) ? K.ink : K.line}`, background: wipe.includes(t.k) ? K.ink : K.surface, color: wipe.includes(t.k) ? '#F4EFE4' : K.ink2 }}>{t.l}</button>
          ))}
        </div>
      )}
      <div style={{ fontSize: 13.5, color: K.mute, margin: '8px 0' }}>
        받는 곳: {targetLabel}{devices.length > 0 && card && (
          <select value={to} onChange={(e) => setTo(e.target.value)} style={{ ...input, padding: '4px 8px', marginLeft: 6, fontSize: 13 }}>
            <option value={card.uid}>회원 ID (앱, 웹 모두 받음)</option>
            {devices.map((d) => <option key={d} value={d}>토스 기기 {d.slice(0, 10)}… (그 기기에서 받음)</option>)}
          </select>
        )}
      </div>
      {step === 'confirm' ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{n}운을 넣을까요?</span>
          <button type="button" style={btn(true)} onClick={submit}>넣기</button>
          <button type="button" style={{ ...btn(true), background: K.surface, color: K.ink, border: `1px solid ${K.line}` }} onClick={() => setStep('edit')}>취소</button>
        </div>
      ) : (
        <button type="button" style={btn(ok && step === 'edit')} disabled={!ok || step !== 'edit'} onClick={() => setStep('confirm')}>{step === 'busy' ? '넣는 중…' : `${ok ? n : ''}운 넣기`}</button>
      )}
      {msg && <p style={{ fontSize: 14, marginTop: 8, color: msg.startsWith('실패') ? K.red : K.green, fontWeight: 700 }}>{msg}</p>}
    </div>
  );
}
