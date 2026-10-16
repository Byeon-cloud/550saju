/**
 * 웹 환불 요청 (2026-10-16) — 웹(포트원) 결제 전용. 앱인토스는 토스 IAP 환불 경로라 쓰지 않는다.
 *
 * 약관 제6조: 미사용 운은 결제일로부터 7일 안에 환불을 요청할 수 있다. 요청할 곳이 화면에 없었다(오너 지적).
 * 눈에 띄지 않게 작은 글자 링크(사업자 정보 줄, 충전 화면 환불 안내)로만 두고, 누르면 결제 번호가 채워진 메일이 열린다.
 * 처리: 오너가 포트원 콘솔에서 결제 취소 → 서버 결제 기록 정리와 운 회수.
 */
import { BUSINESS_INFO } from '@/constants/businessInfo';

const KEY = 'saju500:web_payments';

export interface WebPaymentMemo { id: string; amount: number; at: number }

/** 결제 성공 때 결제 번호를 이 기기에 적어 둔다 (환불 메일에 채우려고, 최근 10건) */
export function rememberWebPayment(id: string, amount: number): void {
  try {
    const list: WebPaymentMemo[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (list.some((x) => x.id === id)) return;
    list.unshift({ id, amount, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
  } catch { /* 저장 실패는 무시 — 메일에 회원 ID 는 들어간다 */ }
}

function recentPayments(): WebPaymentMemo[] {
  try {
    const list: WebPaymentMemo[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    const weekAgo = Date.now() - 8 * 864e5; // 7일 안 결제만 (하루 여유)
    return list.filter((x) => x.at >= weekAgo);
  } catch { return []; }
}

const fmt = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 환불 요청 메일 열기 */
export async function openRefundRequest(): Promise<void> {
  let uid = '';
  try {
    const { auth } = await import('@/services/auth/firebase');
    uid = auth.currentUser?.uid || '';
  } catch { /* noop */ }
  const pays = recentPayments();
  const payLines = pays.length
    ? pays.map((p) => `결제 번호: ${p.id} (${fmt(p.at)}, ${p.amount.toLocaleString()}원)`).join('\n')
    : '결제 번호: (결제한 날짜와 금액을 적어 주세요)';
  const body = [
    '환불을 요청해요.',
    '',
    `회원 ID: ${uid || '(모름)'}`,
    payLines,
    '',
    '환불받을 결제를 남겨 주세요. 아직 쓰지 않은 운만 결제일로부터 7일 안에 환불돼요.',
    '환불 사유(선택):',
  ].join('\n');
  const subject = `[사주500 환불 요청]${uid ? ` 회원ID:${uid.slice(0, 8)}` : ''}`;
  window.location.href = `mailto:${BUSINESS_INFO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
