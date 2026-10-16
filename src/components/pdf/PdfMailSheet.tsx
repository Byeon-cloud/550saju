/**
 * PDF 메일로 받기 시트 (2026-10-16) — 종합사주 결과 PDF 를 입력한 메일 주소로 보낸다.
 *   서버 generatePremiumPdf 에 email 을 주면 PDF 를 만들어 첨부해 보낸다(functions/src/pdf/mailPdf.ts).
 *   필수 동의: 결과지를 보내려고 메일 주소를 받는다. 선택 동의: 운세 소식과 혜택 안내(광고성 정보, 기본 꺼짐).
 *   토스 앱은 PDF 내려받기가 브라우저로 넘어가 불편해서, 메일이 보관하기 쉬운 길이다.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HJ, SERIF } from '@/components/hanji/Hanji';

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;

export function PdfMailSheet({ open, onClose, onSend, busy }: {
  open: boolean;
  onClose: () => void;
  onSend: (email: string, marketingConsent: boolean) => void;
  busy: boolean;
}) {
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const valid = EMAIL_RE.test(email.trim());
  const canSend = valid && agree && !busy;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="pdfmail-dim" className="fixed inset-0" style={{ background: 'rgba(26,22,18,0.45)', zIndex: 80 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={busy ? undefined : onClose} />
          <motion.div key="pdfmail-sheet" role="dialog" aria-modal="true" aria-labelledby="pdfmail-title"
            className="fixed bottom-0 inset-x-0" style={{ zIndex: 81, maxWidth: 520, margin: '0 auto', background: HJ.card, borderRadius: '20px 20px 0 0', padding: '22px 20px calc(22px + env(safe-area-inset-bottom))' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
            <h2 id="pdfmail-title" style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: HJ.ink }}>PDF를 메일로 받기</h2>
            <p style={{ fontSize: 15, color: HJ.ink2, lineHeight: 1.6, marginTop: 6 }}>종합사주 풀이 전체를 PDF로 만들어 아래 주소로 보내 드려요. 만드는 데 1분쯤 걸려요.</p>
            <label htmlFor="pdfmail-email" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: HJ.ink, marginTop: 16 }}>받을 메일 주소</label>
            <input id="pdfmail-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com" disabled={busy}
              style={{ width: '100%', marginTop: 6, height: 50, borderRadius: 12, border: `1.5px solid ${email && !valid ? HJ.seal : HJ.line}`, padding: '0 14px', fontSize: 16, background: '#fff', color: HJ.ink }} />
            {email && !valid && <p style={{ fontSize: 13, color: HJ.seal, marginTop: 6 }}>메일 주소를 다시 확인해 주세요</p>}
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 14, color: HJ.ink, lineHeight: 1.55, cursor: 'pointer' }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={busy} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
              <span>(필수) 결과지를 보내려고 메일 주소를 받는 데 동의해요. 탈퇴하면 함께 지워져요.</span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 10, fontSize: 14, color: HJ.ink2, lineHeight: 1.55, cursor: 'pointer' }}>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} disabled={busy} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
              <span>(선택) 신년운세와 할인 소식을 메일로 받을래요. 언제든 메일 안의 안내로 그만 받을 수 있어요.</span>
            </label>
            <button type="button" className="hj-cta" disabled={!canSend} onClick={() => onSend(email.trim(), marketing)}
              style={{ marginTop: 18, opacity: canSend ? 1 : 0.5 }}>
              {busy ? 'PDF 만드는 중…' : '메일로 보내기'}
            </button>
            <button type="button" onClick={onClose} disabled={busy}
              style={{ width: '100%', marginTop: 8, padding: 12, background: 'transparent', border: 0, fontSize: 15, fontWeight: 700, color: HJ.ink2 }}>
              닫기
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
