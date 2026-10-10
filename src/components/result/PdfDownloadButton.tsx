/**
 * #61 · PDF 다운로드 버튼 — PremiumResult 마운트용
 *
 * 표시 조건: 호출자가 paid + unlocked 상태에서만 마운트 (이 컴포넌트 자체는 게이트 X).
 *
 * 흐름:
 *   1. 클릭 → loading state → generatePremiumPdf({...}) 호출
 *   2. signed URL 받으면 새 탭으로 열어 다운로드 트리거
 *   3. 성공 시 toast · 실패 시 에러 메시지 toast
 *
 * 디자인 토큰: SSOT D1 (gold #B8965A · ink #1A1A1A · paper #F8F5EE · line #E5DFD0)
 *
 * 보존:
 *  - PremiumResult 의 _data/_atoms/_visuals 변경 X
 *  - report.aiResult / sajuData 그대로 페이로드로 전달 (서버는 trust + 결제 검증)
 */

import { useState } from 'react';
import { useToast } from '@/components/common/Toast';
import { generatePremiumPdf, type PdfProfile } from '@/services/pdf/premiumPdfClient';

const C = {
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.10)',
  goldLine: 'rgba(184,150,90,0.40)',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  paper: '#F8F5EE',
  line: '#E5DFD0',
  surface: '#FFFFFF',
} as const;

interface PdfDownloadButtonProps {
  /** Firestore reportId — 서버 ownership 검증용 (없으면 결제 검증으로만 통과) */
  reportId?: string;
  profile: PdfProfile;
  sajuData: any;
  aiResult: any;
}

export function PdfDownloadButton({
  reportId,
  profile,
  sajuData,
  aiResult,
}: PdfDownloadButtonProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await generatePremiumPdf({
        reportId,
        profile,
        sajuData,
        aiResult,
      });
      setIssuedUrl(result.url);
      // 다운로드 트리거 — 앱인토스 분기 (window.open 대신 a[download] 또는 토스 SDK)
      // 앱인토스 웹뷰는 window.open 시 외부 브라우저로 튕김 → a[download] 로 강등 (앱 내부 다운로드)
      const { isAppsInToss } = await import('@/services/payment/iapService');
      if (isAppsInToss()) {
        // 앱인토스: 토스 SDK 의 share 또는 navigate 로 처리 — fallback 으로 a[download]
        const a = document.createElement('a');
        a.href = result.url;
        a.download = `saju500-${reportId}.pdf`;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // 웹: 새 탭 (기존 동작)
        window.open(result.url, '_blank', 'noopener,noreferrer');
      }
      toast.show('PDF 다운로드를 시작합니다', 'success');
    } catch (err: any) {
      const code: string = err?.code || '';
      const msg: string = err?.message || '';
      if (code.includes('permission-denied')) {
        toast.show(msg || '종합 사주 결제 후 PDF 발급이 가능해요', 'warning');
      } else if (code.includes('unauthenticated')) {
        toast.show('로그인 후 다시 시도해주세요', 'warning');
      } else if (code.includes('unavailable')) {
        toast.show('PDF 엔진이 준비 중입니다. 잠시 후 다시 시도해주세요', 'warning');
      } else {
        toast.show('PDF 생성 중 오류가 발생했어요', 'warning');
        // eslint-disable-next-line no-console
        console.error('[PdfDownloadButton] failed:', err);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 28,
        padding: '20px 18px',
        background: C.surface,
        border: `1px solid ${C.goldLine}`,
        borderRadius: 14,
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 44,
          height: 44,
          margin: '0 auto 10px',
          borderRadius: 12,
          background: C.goldSoft,
          border: `1px solid ${C.goldLine}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6" />
          <path d="m9 15 3 3 3-3" />
        </svg>
      </div>

      <h3
        style={{
          fontFamily: '"Pretendard", system-ui, sans-serif',
          fontSize: 16,
          fontWeight: 700,
          color: C.ink,
          margin: '0 0 4px',
        }}
      >
        종합 사주 PDF 다운로드
      </h3>
      <p
        style={{
          fontSize: 12,
          color: C.mute,
          margin: '0 0 14px',
          lineHeight: 1.6,
        }}
      >
        7섹션 전체를 인쇄용 A4 PDF 로 받아보세요.
        <br />
        한자와 오행 컬러와 럭키 프로필까지 그대로.
      </p>

      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        style={{
          width: '100%',
          height: 48,
          borderRadius: 10,
          border: 'none',
          background: busy ? C.mute : C.goldDeep,
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.02em',
          cursor: busy ? 'wait' : 'pointer',
          transition: 'background 0.2s',
          opacity: busy ? 0.85 : 1,
        }}
        aria-busy={busy}
      >
        {busy ? '생성 중… (10~30초)' : 'PDF 다운로드'}
      </button>

      {issuedUrl && !busy && (
        <p style={{ fontSize: 11, color: C.mute, marginTop: 10, lineHeight: 1.5 }}>
          다운로드가 시작되지 않으면{' '}
          <a
            href={issuedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.goldDeep, textDecoration: 'underline' }}
          >
            여기를 클릭
          </a>
          하세요. (24시간 유효)
        </p>
      )}

      <p style={{ fontSize: 10, color: C.mute, marginTop: 10, opacity: 0.75 }}>
        ※ 서버에서 안전하게 생성된 PDF 입니다. 다운로드 링크는 24시간 유효합니다.
      </p>
    </div>
  );
}
