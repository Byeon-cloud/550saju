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
              <p className="text-label text-text-primary font-bold mb-1">3-1. 저장 방식 · 암호화</p>
              <p>· 사주 데이터(이름·생년월일·시간)는 Google Cloud Firestore의 관리형 암호화(AES-256-GCM, Google 관리 키)로 저장돼요.</p>
              <p>· 브라우저 캐시는 세션 단위(sessionStorage)로만 보관되어 브라우저 종료 시 즉시 삭제돼요.</p>
              <p>· localStorage에는 운 잔액·이용 기록 등 민감정보 외 운영 데이터만 저장해요.</p>
              <p>· 모든 API 통신은 HTTPS(TLS 1.2 이상)로 암호화돼요.</p>
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
              <p className="text-label text-text-primary font-bold mb-1">6. 개인정보 파기절차 및 방법</p>
              <p>· 보유기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기해요.</p>
              <p>· 회원탈퇴 시 사주 분석 기록·프로필·대화 기록 등 개인정보는 5일 이내 파기해요.</p>
              <p>· 다만 전자상거래법 등 관계 법령에 따라 보존이 필요한 결제 기록은 5년간 분리 보관 후 파기해요.</p>
              <p>· 전자적 파일은 복구할 수 없는 방법으로 영구 삭제하고, 출력물은 분쇄·소각해요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">7. 개인정보 보호책임자</p>
              <p>· 이메일: info@juulabel.com</p>
            </div>
          </div>
          <p className="text-caption text-text-hint mt-6">시행일: 2026년 4월 1일</p>
        </div>
      </div>
    </div>
  );
}
