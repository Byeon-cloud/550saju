import { Header } from '@/components/layout/Header';
import { usePageTitle } from '@/hooks/usePageTitle';

export function PrivacyPage() {
  usePageTitle('개인정보처리방침');
  return (
    <div className="min-h-screen bg-bg-page">
      <Header title="개인정보처리방침" />
      <div className="px-5 pt-4 pb-20 space-y-4">
        <div className="card">
          <h2 className="text-h2 text-text-primary mb-4">개인정보처리방침</h2>
          <div className="text-body-sm text-text-secondary leading-relaxed space-y-4">
            <div>
              <p className="text-label text-text-primary font-bold mb-1">1. 수집하는 개인정보</p>
              <p>서비스 이용을 위해 다음 정보를 수집해요:</p>
              <p className="mt-1">· 필수: 이름, 생년월일, 성별, 출생시간(선택)</p>
              <p>· 자동 수집: 서비스 이용 기록, 결제 기록</p>
              <p>· 토스 로그인 시: 토스 계정 식별자</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">2. 수집 목적</p>
              <p>· 사주 분석 서비스 제공</p>
              <p>· 운(運) 잔액 관리 및 결제 처리</p>
              <p>· 서비스 개선 및 통계 분석</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">3. 보유 기간</p>
              <p>· 사주 분석 결과: 계정 생존 기간 동안 보관</p>
              <p>· 결제 기록: 전자상거래법에 따라 5년</p>
              <p>· 채팅 기록: 90일 후 자동 삭제</p>
              <p>· 계정 삭제 시: 5일 이내 파기</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">4. 제3자 제공</p>
              <p>수집된 개인정보는 원칙적으로 제3자에게 제공하지 않아요. 다만 법령에 따른 요청이 있는 경우 예외적으로 제공할 수 있어요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">5. 이용자의 권리</p>
              <p>이용자는 언제든지 개인정보의 열람, 수정, 삭제를 요청할 수 있어요. 아래 연락처로 문의해주세요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">6. 개인정보 보호책임자</p>
              <p>· 이메일: saju500help@gmail.com</p>
            </div>
          </div>
          <p className="text-caption text-text-hint mt-6">시행일: 2026년 4월 1일</p>
        </div>
      </div>
    </div>
  );
}
