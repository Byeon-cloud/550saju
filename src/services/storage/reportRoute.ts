/**
 * 보관함 기록 열기 (2026-10-27 StoragePage 에서 옮김 — 내 정보 '최근 본 풀이'도 같은 길로 연다)
 *   기록 종류마다 다시 여는 화면과 이름. 화면은 state(savedResult, savedReport) 와 ?reportId 둘 다로 복원한다.
 */
import { TOPIC_REGISTRY, normalizeTopicId } from '@/constants/topics';
import type { LocalReport } from './localStore';

/** 지금 열 수 없는 기록 (비공개 콘텐츠). 2026-10-04 궁합, 10-07 신년운세 공개 */
export const LOCKDOWN_CONTENT = new Set(['daeun']);

export function routeForReport(r: LocalReport): string | null {
  const ct = r.contentType;
  if (ct === 'dream' || ct === 'deepDream') return '/dream';
  if (ct === 'daily') return '/daily';
  if (ct === 'monthly') return '/monthly'; // 2026-06-29 NEW — 재선택 시 캐시 복원
  if (ct === 'weekly') return '/weekly';   // 2026-06-29 NEW
  if (ct === 'compat') return '/compat/result'; // 2026-10-04 공개 — savedResult/savedReport state + ?reportId 로 재열람
  if (ct === 'tojung') return '/tojung';        // 2026-10-07 신년운세 — 같은 방식으로 재열람
  // 2026-05-28 — 출시 lockdown 콘텐츠는 페이지가 홈으로 redirect 됨.
  //   보관함에서 클릭 시 무한 redirect 사이클 방지 위해 null 반환. openReport 에서 안내 toast.
  if (LOCKDOWN_CONTENT.has(ct as string)) return null;
  if (ct === 'topic') {
    const topicId = (r as any).aiResult?.topicId;
    return topicId ? `/topic/${topicId}` : null; // 2026-10-17 'love' 기본값 제거 — 주제를 모르면 열지 않는다
  }
  // 기본 사주 리포트
  if (r.sajuData?.pillars?.length) return `/result/${r.id}`;
  return '/input?from=storage';
}

const CONTENT_NAME: Record<string, string> = {
  report: '종합사주', daily: '오늘의 운세', daeun: '대운', monthly: '월운세', weekly: '주간운세',
  compat: '궁합', tojung: '신년운세', topic: '주제별 운세', dream: '꿈해몽', deepDream: '꿈해몽 전체 풀이',
};

/** 기록 이름 — 보관함 카드와 같은 규칙(주제운은 상품명, 옛 1운 풀이는 '사주 풀이') */
export function reportName(r: LocalReport): string {
  const ct = r.contentType ?? 'report';
  if (ct === 'topic') {
    const raw = (r as any).aiResult?.topicId as string | undefined;
    if (raw === 'social') return '대인관계운';
    const id = raw ? normalizeTopicId(raw) : null;
    return (id && TOPIC_REGISTRY[id]?.label) || '주제별 운세';
  }
  if (ct === 'report') return (r as any).aiResult?.tier === 'premium' ? '종합사주' : '사주 풀이';
  if (ct === 'dream' && (r.type === 'paid' || (r as any).aiResult?.__unlocked)) return '꿈해몽 전체 풀이';
  return CONTENT_NAME[ct] ?? '종합사주';
}
