import { Header } from '@/components/layout/Header';
import { usePageTitle } from '@/hooks/usePageTitle';
import { BUSINESS_INFO } from '@/constants/businessInfo';

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
              <p className="mt-1">필수: 이름, 생년월일, 성별, 출생시간(선택)</p>
              <p>자동 수집: 서비스 이용 기록, 결제 기록, 접속 로그, 쿠키, Google Analytics(GA4) 분석 데이터</p>
              <p>로그인 시: 소셜 계정(구글, 카카오, 네이버, 애플) 또는 토스 계정 식별자와 이메일</p>
              <p>결과지를 메일로 받을 때(요청한 경우만): 받을 메일 주소, 광고성 정보 수신 동의 여부(선택)</p>
              <p>신년운세 마감 알림을 신청할 때(웹, 신청한 경우만): 메일 주소, 광고성 정보 수신 동의 일자</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">2. 수집 목적</p>
              <p>사주 분석 서비스 제공</p>
              <p>운(運) 잔액 관리 및 결제 처리</p>
              <p>서비스 개선 및 통계 분석</p>
              <p>요청한 결과지(PDF)를 메일로 보내기, 수신에 동의한 경우에만 신년운세와 할인 소식 안내(수신 동의 확인 메일 포함)</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">3. 보유 기간</p>
              <p>사주 분석 결과: 계정 생존 기간 동안 보관</p>
              <p>결제 기록: 전자상거래법에 따라 5년</p>
              <p>채팅 기록: 90일 후 자동 삭제</p>
              <p>결과지와 알림 메일 주소: 계정 삭제 또는 수신 동의 철회 시까지 (수신 거부는 메일 안의 링크로 바로 처리)</p>
              <p>계정 삭제 시: 5일 이내 파기</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">3-1. 저장 방식, 암호화</p>
              <p>사주 데이터(이름, 생년월일, 시간)는 Google Cloud Firestore의 관리형 암호화(AES-256-GCM, Google 관리 키)로 저장돼요.</p>
              <p>빠른 재열람을 위해 분석 기록, 프로필, 운 잔액은 이용 기기의 브라우저 저장소(localStorage)에 캐시되며, 보관함과 기록 삭제 또는 브라우저 데이터 삭제 시 함께 제거돼요.</p>
              <p>모든 API 통신은 HTTPS(TLS 1.2 이상)로 암호화돼요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">4. 제3자 제공</p>
              <p>수집된 개인정보는 원칙적으로 제3자에게 제공하지 않아요. 다만 법령에 따른 요청이 있는 경우 예외적으로 제공할 수 있어요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">4-1. 처리위탁 및 국외 이전</p>
              <p>서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하며, 일부는 국외(미국)로 이전과 처리돼요. 이용자는 이에 동의하지 않을 수 있으나, 동의하지 않을 경우 AI 분석 서비스 이용이 제한돼요.</p>
              <p className="mt-1">Anthropic, PBC (미국): 사주 데이터 기반 AI 해석 생성, 이전 항목: 이름, 생년월일, 출생시간, 성별, 보유: 처리 후 즉시 파기(모델 학습 미사용).</p>
              <p>Google LLC (미국): 클라우드 인프라(Firebase, 데이터 저장과 서버 운영), 이전 항목: 위와 동일, 보유: 계정 생존 기간.</p>
              <p>포트원(주)(결제 연동 대행) 및 이를 통해 연동되는 카드사와 간편결제사: 웹 결제 처리, 이전 항목: 결제 정보.</p>
              <p>비바리퍼블리카(토스): 앱(앱인토스) 인앱결제 처리, 이전 항목: 결제 정보.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">4-2. 만 14세 미만 가입 제한</p>
              <p>본 서비스는 만 14세 이상만 가입과 이용할 수 있어요. 만 14세 미만 아동의 개인정보는 수집하지 않아요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">5. 이용자의 권리</p>
              <p>이용자는 언제든지 개인정보의 열람, 수정, 삭제를 요청할 수 있어요. 아래 연락처로 문의해주세요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">6. 개인정보 파기절차 및 방법</p>
              <p>보유기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기해요.</p>
              <p>회원탈퇴 시 사주 분석 기록, 프로필, 대화 기록 등 개인정보는 5일 이내 파기해요.</p>
              <p>다만 전자상거래법 등 관계 법령에 따라 보존이 필요한 결제 기록은 5년간 분리 보관 후 파기해요.</p>
              <p>전자적 파일은 복구할 수 없는 방법으로 영구 삭제하고, 출력물은 분쇄와 소각해요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">7. 개인정보 보호책임자</p>
              <p>개인정보 보호책임자: {BUSINESS_INFO.ceoName} ({BUSINESS_INFO.companyName})</p>
              <p>이메일: {BUSINESS_INFO.email}</p>
            </div>
          </div>
          <p className="text-caption text-text-hint mt-6">시행일: 2026년 10월 16일 (개정)</p>
        </div>
      </div>
    </div>
  );
}
