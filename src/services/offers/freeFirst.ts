/**
 * 종합사주 결제 전 '무료 오늘의 운세 먼저' 갈림길 규칙 (2026-10-22 P1-9, 10-21 갈림길을 한 곳으로)
 *
 *   왜: 광고 손님이 생일을 넣자마자 5,000원 충전 화면으로 가서 아무도 결제하지 않았다(풀이를 한 줄도 못 봄, 10-21 9명,
 *       메타 E24 입력 18 충전 화면 10 결제 0). 10-21 에 반값 혜택(firstDailyOffer)이 열릴 수 있는 기기에 갈림길을 넣었다.
 *   더한 것: 반값 혜택이 꺼져 있거나 열릴 수 없어도, 광고로 들어와 아직 풀이를 하나도 받지 않은 손님은 충전으로 바로 보내지 않는다.
 *   쓰는 곳: InputPage(종합사주로 들어와 생일을 넣은 직후), PremiumSelectPage(gate=1, 시작 누름, 사주 없는 첫 화면).
 */
import { adVisitSource } from '@/services/analytics';
import { getReports } from '@/services/storage/localStore';
import { firstDailyOfferEligible } from './firstDailyOffer';

/** 광고로 들어와 이 기기에서 아직 풀이(오늘의 운세, 꿈해몽, 주제운 등)를 하나도 받지 않았으면 광고 출처 이름, 아니면 '' */
export function freshAdSource(): string {
  const src = adVisitSource();
  if (!src) return '';
  try {
    const seen = getReports().some((r) => r?.aiResult && !(r.aiResult as { __partial?: boolean }).__partial);
    return seen ? '' : src;
  } catch {
    return src;
  }
}

/** 운이 모자란 손님에게 갈림길을 보일 이유. 'offer' = 오늘의 운세를 받으면 24시간 반값이 열린다, 'ad' = 풀이를 아직 못 본 광고 손님 */
export function freeFirstReason(): 'offer' | 'ad' | null {
  if (firstDailyOfferEligible()) return 'offer';
  return freshAdSource() ? 'ad' : null;
}
