/**
 * 현재 대운 판정 SSOT (2026-07 — 유저 제보 "기축대운인데 무자대운으로 표시" fix)
 *
 * 버그 근원: lunar-javascript 의 대운 시작나이/끝나이는 **세는나이(虚岁)** 기준인데
 *   기존 판정이 연나이(현재연도-출생연도)로 비교 → 한 살 어긋나 **대운 첫 해의 모든
 *   유저(~10%)가 이전 대운으로 표시**됐음.
 *
 * 판정 규칙:
 *   ① 시작년도/끝년도(실제 연도, DaYun.getStartYear) 우선 — 나이 규약 자체와 무관해 가장 정확.
 *   ② 구 저장본(연도 필드 없음) fallback — 세는나이(연도차+1)로 비교.
 *
 * ⚠️ lunar-javascript(300KB+) 무의존 순수 모듈 — localStore·reportGenerator 등
 *   메인 경로에서 안심하고 import (번들 영향 0).
 */
import type { DaeUn, SajuData } from '@/types/saju';

/** 현재 대운 판정 — isCurrent 플래그 전체 리셋 후 재설정 (저장 데이터의 stale 플래그 방어) */
export function findCurrentDaeun(daeunList: DaeUn[], birthYear: number): DaeUn | undefined {
  const nowYear = new Date().getFullYear();
  const koreanAge = nowYear - birthYear + 1; // 세는나이 (虚岁)
  for (const d of daeunList) {
    d.isCurrent = false;
    // 레거시 '현재' 키 방어 — 서버 프롬프트가 isCurrent || 현재 로 읽으므로 같이 리셋
    if ((d as unknown as Record<string, unknown>)['현재'] !== undefined) {
      (d as unknown as Record<string, unknown>)['현재'] = false;
    }
  }
  const found = daeunList.find(d =>
    d.시작년도 !== undefined && d.끝년도 !== undefined
      ? nowYear >= d.시작년도 && nowYear <= d.끝년도
      : koreanAge >= d.시작나이 && koreanAge <= d.끝나이,
  );
  if (found) found.isCurrent = true;
  return found;
}

/**
 * 저장된 sajuData 의 stale 현재대운을 오늘 기준으로 재계산 (in-place · 방어적).
 * 프로필/리포트가 저장 시점 플래그를 영구 신뢰하는 문제 차단 —
 * getProfiles/getReport 로드 시점 + AI 페이로드 전송 직전에 호출.
 */
export function refreshCurrentDaeun(sajuData: SajuData | null | undefined): void {
  try {
    if (!sajuData?.daeun?.length || !sajuData.input?.birthYear) return;
    const cur = findCurrentDaeun(sajuData.daeun, sajuData.input.birthYear);
    if (cur) sajuData.currentDaeun = cur;
  } catch {
    // 방어적 no-op — 재계산 실패해도 기존 데이터 유지 (렌더/생성은 계속)
  }
}
