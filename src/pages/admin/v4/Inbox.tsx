/**
 * 관리자 v4 — 웹 문의함 (2026-10-19)
 *   웹 고객문의 '여기에 바로 남기기'로 온 문의(inquiries). 문의마다 회원 번호, 보던 화면, 잔액이 붙어 있어
 *   '고객 카드 보기'로 바로 결제와 풀이를 확인하고 운을 넣는다. 처리 표시, 메모, 메일 답장.
 *   앱(토스 안) 문의는 토스 콘솔 고객센터로 온다 — 거기서 받은 기기 ID 나 회원 번호는 '고객 찾기'에 넣는다.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { callAdmin, timeText, fmt } from './api';
import { Box, K } from './ui';
import { CustomerCard } from './Customer';

interface Item {
  id: string; uid: string; category: string; categoryLabel: string; message: string; email: string; status: 'new' | 'doing' | 'done';
  note: string; replies: { at: number; text: string }[]; createdAt: number;
  meta: { did?: string; path?: string; history?: string[]; balance?: { paid: number; bonus: number; reward: number } | null; reportId?: string; browser?: string; inApp?: string; loggedIn?: boolean; utm?: string };
}
const STATUS_LABEL = { new: '새 문의', doing: '보는 중', done: '끝남' } as const;
const btn = (on = true): CSSProperties => ({ padding: '7px 12px', borderRadius: 8, border: `1px solid ${K.line}`, background: on ? K.surface : K.line, fontSize: 13.5, fontWeight: 700, color: K.ink, cursor: on ? 'pointer' : 'default' });

export function Inbox({ onCount }: { onCount?: (n: number) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const load = () => callAdmin<{ items: Item[] }>('adminInquiries', { action: 'list' })
    .then((r) => { setItems(r.items); onCount?.(r.items.filter((x) => x.status === 'new').length); })
    .catch((e) => setErr(String(e?.message || e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const list = (items || []).filter((x) => filter === 'all' || x.status !== 'done');
  return (
    <div>
      <Box title="웹 문의함" right={
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={{ ...btn(), background: filter === 'open' ? K.ink : K.surface, color: filter === 'open' ? '#F4EFE4' : K.ink }} onClick={() => setFilter('open')}>안 끝난 것</button>
          <button type="button" style={{ ...btn(), background: filter === 'all' ? K.ink : K.surface, color: filter === 'all' ? '#F4EFE4' : K.ink }} onClick={() => setFilter('all')}>전체</button>
        </div>
      } note="웹 고객문의의 '여기에 바로 남기기'로 온 문의예요. 새 문의는 info@juulabel.com 으로도 알림이 가요. 앱 문의는 토스 콘솔 고객센터로 오니, 거기서 받은 기기 ID 나 회원 번호를 '고객 찾기'에 넣어요.">
        {err && <p style={{ color: K.red, fontSize: 13.5 }}>{err}</p>}
        {!items && !err && <p style={{ fontSize: 14, color: K.mute }}>불러오는 중이에요</p>}
        {items && list.length === 0 && <p style={{ fontSize: 14, color: K.mute }}>{filter === 'open' ? '안 끝난 문의가 없어요' : '아직 문의가 없어요'}</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map((it) => <InquiryRow key={it.id} it={it} onChanged={load} />)}
        </div>
      </Box>
    </div>
  );
}

function InquiryRow({ it, onChanged }: { it: Item; onChanged: () => void }) {
  const [open, setOpen] = useState(it.status === 'new');
  const [card, setCard] = useState<any[] | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState(it.note || '');
  const [msg, setMsg] = useState('');
  const bal = it.meta.balance;
  const setStatus = async (status: Item['status']) => {
    try { await callAdmin('adminInquiries', { action: 'update', id: it.id, status, note }); onChanged(); } catch (e: any) { setMsg(String(e?.message || e)); }
  };
  const showCard = async () => {
    setCardBusy(true);
    try { const r = await callAdmin<{ cards: any[] }>('adminLookup', { q: it.uid }); setCard(r.cards); } catch (e: any) { setMsg(String(e?.message || e)); }
    finally { setCardBusy(false); }
    if (it.status === 'new') setStatus('doing');
  };
  const sendReply = async () => {
    if (reply.trim().length < 5) return;
    try { await callAdmin('adminInquiries', { action: 'reply', id: it.id, text: reply.trim() }); setReply(''); setMsg('답장을 보냈어요'); onChanged(); } catch (e: any) { setMsg(`실패: ${e?.message || e}`); }
  };
  return (
    <div style={{ background: K.surface, border: `1px solid ${it.status === 'new' ? K.ink : K.line}`, borderRadius: 12, padding: 12 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: K.ink }}>{it.categoryLabel}</span>
          <span style={{ fontSize: 13, color: it.status === 'new' ? K.red : K.mute, fontWeight: 700 }}>{STATUS_LABEL[it.status]}, {timeText(it.createdAt)}</span>
        </div>
        <p style={{ fontSize: 14, color: K.ink2, margin: '6px 0 0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{open ? it.message : `${it.message.slice(0, 80)}${it.message.length > 80 ? '…' : ''}`}</p>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6, fontSize: 13, color: K.ink2 }}>
            <span>회원 ID <code style={{ fontSize: 12 }}>{it.uid}</code>{it.meta.loggedIn ? ' (로그인)' : ' (익명)'}</span>
            <span>답장 메일 {it.email || '없음'}</span>
            <span>보던 화면 {it.meta.path || '-'}</span>
            <span>잔액(기기) {bal ? `${fmt(bal.paid + bal.bonus + bal.reward)}운` : '-'}</span>
            <span>브라우저 {it.meta.browser || '-'}{it.meta.inApp ? ` (${it.meta.inApp} 앱 안)` : ''}</span>
            {it.meta.reportId && <span>보던 결과 {it.meta.reportId}</span>}
            {it.meta.history && it.meta.history.length > 0 && <span style={{ gridColumn: '1 / -1' }}>최근 화면 {it.meta.history.join(' → ')}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" style={btn()} onClick={showCard} disabled={cardBusy}>{cardBusy ? '찾는 중…' : '고객 카드 보기 (결제, 풀이, 운 넣기)'}</button>
            {it.status !== 'done' && <button type="button" style={btn()} onClick={() => setStatus('done')}>끝남으로</button>}
            {it.status === 'done' && <button type="button" style={btn()} onClick={() => setStatus('doing')}>다시 열기</button>}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} onBlur={() => note !== it.note && setStatus(it.status)}
            placeholder="메모 (고객에게 안 보여요)" style={{ width: '100%', marginTop: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${K.line}`, fontSize: 13.5, boxSizing: 'border-box' }} />
          {it.replies.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 13.5, color: K.ink2 }}>
              {it.replies.map((r, i) => <p key={i} style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>보낸 답장 ({timeText(r.at)}): {r.text}</p>)}
            </div>
          )}
          {it.email && (
            <div style={{ marginTop: 8 }}>
              <textarea value={reply} onChange={(e) => setReply(e.target.value.slice(0, 2000))} rows={3} placeholder="메일 답장. 원인과 고친 것, 넣어 드린 운을 짧게 (CS 원칙)"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${K.line}`, fontSize: 14, lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical' }} />
              <button type="button" style={{ ...btn(reply.trim().length >= 5), marginTop: 6 }} onClick={sendReply} disabled={reply.trim().length < 5}>메일로 답장 보내기</button>
            </div>
          )}
          {msg && <p style={{ fontSize: 13.5, color: msg.startsWith('실패') ? K.red : K.green, marginTop: 6 }}>{msg}</p>}
          {card && card.length === 0 && <p style={{ fontSize: 13.5, color: K.mute, marginTop: 8 }}>이 회원 번호로 찾은 기록이 없어요.</p>}
          {card && card.map((c) => <div key={c.uid} style={{ marginTop: 10 }}><CustomerCard c={c} devices={c.devices || []} onRefresh={showCard} /></div>)}
        </div>
      )}
    </div>
  );
}
