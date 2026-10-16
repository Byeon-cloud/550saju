import { Header } from '@/components/layout/Header';
import { usePageTitle } from '@/hooks/usePageTitle';

export function TermsPage() {
  usePageTitle('이용약관');
  return (
    <div className="min-h-screen bg-bg-page">
      <Header title="이용약관" />
      <div className="px-5 pt-4 pb-20 space-y-4">
        <div className="card">
          <h2 className="text-h2 text-text-primary mb-4">사주500 이용약관</h2>
          <div className="text-body-sm text-text-secondary leading-relaxed space-y-4">
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제1조 (목적)</p>
              <p>이 약관은 사주500(이하 "서비스")의 이용 조건 및 절차에 관한 사항을 규정하는 것을 목적으로 해요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제2조 (서비스 내용)</p>
              <p>서비스는 사주명리학에 기반한 사주 분석, 오늘의 운세, 꿈해몽, 궁합 분석, 사주 상담 등을 제공해요. 분석 결과는 참고용이며, 중요한 결정은 전문가와 상담해주세요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제3조 (운(運) 화폐)</p>
              <p>서비스 내 가상 화폐 "운(運)"은 서비스 이용에 사용돼요. 1운 = 500원(부가세 별도) 기준이며, 충전 패키지에 따라 보너스가 제공될 수 있어요.</p>
              <p className="mt-1">결제한 운은 환불이 가능하지만, 보너스 운과 리워드 운(공유/광고)은 환불 대상에서 제외돼요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제4조 (대화권)</p>
              <p>사주 대화 서비스는 1운으로 대화 3회를 이용할 수 있어요. 쓰지 않은 대화권 3개는 1운으로 다시 바꿀 수 있어요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제5조 (무료 서비스)</p>
              <p>오늘의 운세, 꿈해몽, 사주대화는 하루 1회 무료로 이용할 수 있고, 그 이후 이용에는 운(사주대화는 대화권)이 필요해요. 사주팔자 확인과 이미 받은 결과를 보관함에서 다시 보는 것은 언제나 무료예요.</p>
              <p className="mt-1">매일 자정(한국시간 00:00)에 무료 이용 횟수가 초기화돼요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제6조 (청약철회 및 환불)</p>
              <p>운(運)으로 제공되는 분석 콘텐츠는 디지털콘텐츠로, 분석 결과가 생성(제공 개시)되면 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항에 따라 해당 운에 대한 청약철회가 제한돼요.</p>
              <p className="mt-1">아직 분석에 사용하지 않은 미사용 운은 결제일로부터 7일 이내 청약철회(환불)를 요청할 수 있어요. 환불 요청 시 청약철회일로부터 3영업일 이내에 환급해 드려요. 웹에서 결제한 운의 환불은 화면 아래 '환불 요청' 또는 고객문의 메일(info@juulabel.com)로 요청할 수 있어요.</p>
              <p className="mt-1">사용한 운, 보너스 운, 리워드 운(공유와 광고 적립)은 환불 대상에서 제외돼요. 하루 1회 무료로 제공되는 오늘의 운세와 꿈해몽 등으로 서비스를 미리 체험하실 수 있어요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제7조 (면책)</p>
              <p>서비스의 분석 결과는 전통 명리학 이론에 기반한 참고 정보이며, 법적, 의학적, 재정적 조언을 대체하지 않아요. 중요한 결정은 반드시 해당 분야의 전문가와 상담해주세요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제8조 (저작권)</p>
              <p>서비스의 분석 결과물에 대한 저작권은 사주500에 있어요. 개인 용도의 공유는 허용되지만, 상업적 이용은 금지돼요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제9조 (결제 및 결제대행)</p>
              <p>웹에서 운(運)을 충전하는 결제는 포트원(주)의 결제 연동 서비스를 통해 카카오페이(주) 등 결제대행사가 처리해요. 결제 과정에서 필요한 정보는 결제대행사에 전달되며, 결제 승인과 취소는 결제대행사의 정책을 따라요. 앱(토스) 내 결제는 토스 인앱결제(IAP) 정책을 따라요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제10조 (이용 자격)</p>
              <p>본 서비스는 만 14세 이상만 가입과 이용할 수 있어요. 만 14세 미만은 가입할 수 없어요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제11조 (준거법 및 관할)</p>
              <p>이 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련한 분쟁에 대한 소송의 관할법원은 「민사소송법」에 따른 관할법원으로 해요.</p>
            </div>
            <div>
              <p className="text-label text-text-primary font-bold mb-1">제12조 (약관의 변경)</p>
              <p>약관을 바꿀 때는 바뀌는 내용과 시행일을 시행일 7일 전부터 서비스 화면에서 알려드려요. 이용자에게 불리하게 바뀌는 경우에는 시행일 30일 전부터 알려드려요.</p>
              <p className="mt-1">바뀐 약관에 동의하지 않으시면 이용을 멈추고 미사용 운의 환불을 요청할 수 있어요.</p>
            </div>
          </div>
          <p className="text-caption text-text-hint mt-6">시행일: 2026년 10월 16일 (개정: 제6조 환불 요청 방법 안내, 제9조 결제대행사 표기), 이전 약관 시행일: 2026년 10월 4일</p>
        </div>
      </div>
    </div>
  );
}
