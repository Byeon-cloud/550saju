/**
 * 웹 문의 양식 (2026-10-19) — 고객문의에서 '여기에 바로 남기기'. 웹 전용(앱은 토스 고객센터가 기기를 알려 준다).
 *   무슨 일인지 고르고, 한두 줄 적고, 답장 받을 메일(선택)을 남기면 회원 ID 와 보던 화면이 같이 간다 → 관리자 문의함.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HJ, SERIF, GoldCta } from '@/components/hanji/Hanji';
import { INQUIRY_CATEGORIES, sendInquiry, type InquiryCategory } from '@/services/support/inquiry';

export function InquirySheet({ open, onClose, initialCategory, reportId }: {
  open: boolean;
  onClose: () => void;
  initialCategory?: InquiryCategory;
  reportId?: string;
}) {
  const [category, setCategory] = useState<InquiryCategory | null>(initialCategory || null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setCategory(initialCategory || null); setDone(false); setErr('');
    // 로그인한 계정 메일이 있으면 답장 메일로 미리 채운다
    import('@/services/auth/firebase').then(({ auth }) => { const m = auth.currentUser?.email; if (m) setEmail((v) => v || m); }).catch(() => {});
  }, [open, initialCategory]);

  const submit = async () => {
    if (!category || message.trim().length < 5 || busy) return;
    setBusy(true); setErr('');
    const r = await sendInquiry({ category, message: message.trim(), email: email.trim(), reportId });
    setBusy(false);
    if (r.ok) { setDone(true); setMessage(''); } else setErr(r.message);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="inq-dim" className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div key="inq-sheet" className="fixed bottom-0 inset-x-0 z-50"
            style={{ background: HJ.paper, borderRadius: '20px 20px 0 0', maxWidth: 520, margin: '0 auto', padding: '22px 20px 36px', maxHeight: '88vh', overflowY: 'auto' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
            {done ? (
              <div style={{ textAlign: 'center', padding: '18px 4px' }}>
                <p style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: HJ.ink }}>문의를 받았어요</p>
                <p style={{ fontSize: 15, color: HJ.ink2, lineHeight: 1.7, marginTop: 8 }}>
                  {email ? '남겨 주신 메일로 답해 드릴게요. 보통 하루 안에 답해요.' : '보통 하루 안에 확인해요. 답장을 받으려면 메일 주소를 남겨 주세요.'}
                  <br />보던 화면과 회원 번호가 같이 와서 다시 설명하지 않으셔도 돼요.
                </p>
                <GoldCta style={{ marginTop: 18 }} onClick={onClose}>닫기</GoldCta>
              </div>
            ) : (
              <>
                <h3 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: HJ.ink, margin: 0 }}>무슨 일이 있었나요?</h3>
                <p style={{ fontSize: 14, color: HJ.mute, margin: '6px 0 14px', lineHeight: 1.6 }}>보던 화면과 회원 번호가 같이 와요. 생일 같은 사주 정보는 보내지 않아요.</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {INQUIRY_CATEGORIES.map((c) => (
                    <button key={c.v} type="button" onClick={() => setCategory(c.v)}
                      style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${category === c.v ? HJ.ink : HJ.line}`, background: category === c.v ? HJ.ink : '#FFFFFF', color: category === c.v ? '#F4EFE4' : HJ.ink }}>
                      {c.label}
                    </button>
                  ))}
                </div>
                {category && (
                  <>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1000))} rows={4}
                      placeholder={category === 'pay_missing' ? '언제 몇 원을 결제했는지 적어 주세요' : category === 'ai_fail' ? '어떤 풀이에서 어떻게 됐는지 적어 주세요' : '한두 줄이면 충분해요'}
                      style={{ width: '100%', marginTop: 14, padding: '12px 13px', borderRadius: 10, border: `1px solid ${HJ.line}`, background: '#FFFFFF', fontSize: 16, lineHeight: 1.6, color: HJ.ink, resize: 'none', boxSizing: 'border-box' }} />
                    <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 120))} placeholder="답장 받을 메일 (선택)"
                      style={{ width: '100%', marginTop: 8, padding: '12px 13px', borderRadius: 10, border: `1px solid ${HJ.line}`, background: '#FFFFFF', fontSize: 16, color: HJ.ink, boxSizing: 'border-box' }} />
                    <p style={{ fontSize: 13, color: HJ.mute, marginTop: 6, lineHeight: 1.6 }}>메일은 이 문의에 답하는 데만 써요.</p>
                    <GoldCta style={{ marginTop: 12 }} onClick={submit} disabled={busy || message.trim().length < 5}>{busy ? '보내는 중…' : '문의 남기기'}</GoldCta>
                    {err && <p style={{ fontSize: 14, color: HJ.seal, textAlign: 'center', marginTop: 8 }}>{err}</p>}
                  </>
                )}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
