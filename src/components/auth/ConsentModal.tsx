/**
 * ConsentModal — 첫 로그인 개인정보 동의 모달 (웹 단독 출시 전용)
 *
 * 근거: docs/법적요건_웹출시.md §3 (개인정보보호법 제15조)
 *   - 필수: 이용약관 동의 / 개인정보 수집·이용 동의
 *   - 선택: 마케팅 정보 수신 동의 (별도)
 *   - 수집·이용 4요소 고지: ①목적 ②항목 ③보유기간 ④거부권+거부 시 불이익
 *   - 체크박스 명시 동의 (기존 "간주 동의" 강화)
 *
 * 앱인토스(토스 동의 우산)에서는 노출하지 않음 — 호출부에서 `!isAppsInToss()` 게이팅.
 * 동의 시 Firestore `users/{uid}.consent` 저장 + localStorage 플래그.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#6F6557',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.12)',
  line: '#E5DFD0',
} as const;
const SERIF = "'Noto Serif KR', serif";

export interface ConsentResult {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
}

interface ConsentModalProps {
  open: boolean;
  /** 필수 2개 동의 완료 시 호출 (marketing 선택값 포함) */
  onAgree: (result: ConsentResult) => void;
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: 6,
        border: `1.8px solid ${checked ? C.gold : C.line}`,
        background: checked ? C.gold : '#FFFFFF',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l4 4L19 7" />
        </svg>
      )}
    </span>
  );
}

export function ConsentModal({ open, onAgree }: ConsentModalProps) {
  const navigate = useNavigate();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const allChecked = terms && privacy && marketing;
  const requiredOk = terms && privacy;

  const toggleAll = () => {
    const next = !allChecked;
    setTerms(next);
    setPrivacy(next);
    setMarketing(next);
  };

  const handleAgree = () => {
    if (!requiredOk) return;
    onAgree({ terms, privacy, marketing });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="consent-dim"
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            key="consent-sheet"
            className="fixed bottom-0 inset-x-0 z-[61] flex flex-col"
            style={{
              background: C.paper,
              borderRadius: '24px 24px 0 0',
              maxWidth: 520,
              margin: '0 auto',
              padding: '24px 22px 36px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-label="개인정보 수집과 이용 동의"
          >
            {/* 헤더 */}
            <h2
              className="text-center mb-2"
              style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 800, color: C.ink }}
            >
              서비스 이용 동의
            </h2>
            <p className="text-center mb-5" style={{ fontSize: 13, color: C.mute, lineHeight: 1.6 }}>
              사주500 이용을 위해 아래 약관에 동의해 주세요.
            </p>

            {/* 전체 동의 */}
            <button
              type="button"
              onClick={toggleAll}
              className="w-full flex items-center gap-3 mb-3"
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: allChecked ? C.goldSoft : '#FFFFFF',
                border: `1.5px solid ${allChecked ? C.gold : C.line}`,
                cursor: 'pointer',
              }}
            >
              <CheckBox checked={allChecked} />
              <span style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>전체 동의</span>
            </button>

            {/* 개별 항목 */}
            <div
              className="flex flex-col"
              style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: '#FFFFFF' }}
            >
              {/* 필수 — 이용약관 */}
              <button
                type="button"
                onClick={() => setTerms((v) => !v)}
                className="w-full flex items-center gap-3"
                style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              >
                <CheckBox checked={terms} />
                <span className="flex-1" style={{ fontSize: 14, color: C.inkSoft }}>
                  <b style={{ color: C.goldDeep, fontWeight: 800 }}>[필수]</b> 이용약관 동의
                </span>
                <span
                  onClick={(e) => { e.stopPropagation(); navigate('/terms'); }}
                  style={{ fontSize: 13.5, color: C.mute, textDecoration: 'underline', cursor: 'pointer' }}
                >
                  보기
                </span>
              </button>

              {/* 필수 — 개인정보 수집·이용 */}
              <button
                type="button"
                onClick={() => setPrivacy((v) => !v)}
                className="w-full flex items-start gap-3"
                style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              >
                <CheckBox checked={privacy} />
                <span className="flex-1">
                  <span className="flex items-center justify-between">
                    <span style={{ fontSize: 14, color: C.inkSoft }}>
                      <b style={{ color: C.goldDeep, fontWeight: 800 }}>[필수]</b> 개인정보 수집과 이용 동의
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); navigate('/privacy'); }}
                      style={{ fontSize: 13.5, color: C.mute, textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      보기
                    </span>
                  </span>
                  {/* 4요소 고지 */}
                  <span
                    className="block mt-2"
                    style={{ fontSize: 13, color: C.mute, lineHeight: 1.7, fontWeight: 400 }}
                  >
                    목적: 사주 분석 서비스 제공, 운 잔액 관리, 결제 처리<br />
                    항목: 이름, 생년월일시, 결제정보<br />
                    보유기간: 계정 유지 동안 (결제 기록은 전자상거래법에 따라 5년)<br />
                    AI 분석을 위해 일부 정보가 국외(미국, Anthropic, Google)로 이전과 처리됩니다. (처리 후 즉시 파기)<br />
                    만 14세 이상만 가입할 수 있으며, 동의를 거부할 수 있으나 거부 시 서비스 이용이 제한됩니다.
                  </span>
                </span>
              </button>

              {/* 선택 — 마케팅 */}
              <button
                type="button"
                onClick={() => setMarketing((v) => !v)}
                className="w-full flex items-center gap-3"
                style={{ padding: '14px 16px', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              >
                <CheckBox checked={marketing} />
                <span className="flex-1" style={{ fontSize: 14, color: C.inkSoft }}>
                  <span style={{ color: C.mute, fontWeight: 700 }}>[선택]</span> 마케팅 정보 수신 동의
                  <span className="block" style={{ fontSize: 13, color: C.mute, fontWeight: 400, marginTop: 2 }}>
                    이벤트와 혜택 소식을 이메일로 받아요. 미동의해도 서비스 이용에 제한이 없어요.
                  </span>
                </span>
              </button>
            </div>

            {/* 동의 버튼 */}
            <button
              type="button"
              onClick={handleAgree}
              disabled={!requiredOk}
              className="w-full mt-5"
              style={{
                height: 52,
                borderRadius: 14,
                background: requiredOk ? C.goldDeep : C.line,
                color: requiredOk ? C.paper : C.mute,
                fontSize: 16,
                fontWeight: 800,
                border: 'none',
                cursor: requiredOk ? 'pointer' : 'not-allowed',
              }}
            >
              동의하고 시작
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ConsentModal;
