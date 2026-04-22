/**
 * useInputDraft — 사주 입력 중 임시저장 (E40)
 *
 * 근거: `docs/prd/P2_Path_E_티켓_트래커.md` E40 · 입력 임시저장
 *
 * 기능:
 *   - InputPage 의 입력 값을 `sessionStorage` 에 저장 (앱인토스 백그라운드 복귀 / 네트워크 재시작 대비)
 *   - 500ms 디바운스 — 입력 중 과도한 저장 방지
 *   - 24h TTL — 오래된 draft 는 자동 무효화
 *   - 마운트 시 draft 존재 여부를 알려주고, 불러오기 / 삭제 API 제공
 *
 * Scope:
 *   - localStorage 가 아닌 sessionStorage — 세션 종료 시 자동 정리, 민감 정보 보관 최소화
 *   - 저장 키: `saju500:input_draft:v1`
 *   - ready 플래그가 true 일 때만 저장 — 페이지 최초 마운트 시 빈 snapshot 저장 방지
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarType, Gender } from '@/types/saju';
import type { Relation } from '@/types/user';

const STORAGE_KEY = 'saju500:input_draft:v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEBOUNCE_MS = 500;

export interface InputDraftSnapshot {
  name: string;
  relation: Relation;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType: CalendarType;
  gender: Gender | null;
  knowsTime: boolean | null;
  timeIndex: number | null;
  /** 현재 도달한 step (0~5) */
  step: number;
}

interface StoredDraft extends InputDraftSnapshot {
  savedAt: number;
  schemaVersion: 1;
}

function isMeaningful(snapshot: InputDraftSnapshot): boolean {
  // 아무 입력도 없으면 저장 의미 없음 (Step0 또는 초기 진입)
  return (
    snapshot.name.trim().length > 0 ||
    snapshot.birthYear !== '' ||
    snapshot.birthMonth !== '' ||
    snapshot.birthDay !== '' ||
    snapshot.gender !== null ||
    snapshot.knowsTime !== null
  );
}

function readStored(): StoredDraft | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (parsed.schemaVersion !== 1) return null;
    if (typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      // TTL 초과 → 자동 정리
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface UseInputDraftOptions {
  /** true 일 때만 draft 저장 — 마운트 직후 / 이어쓰기 모달 응답 전에는 false 권장 */
  enabled: boolean;
  /** 현재 입력 상태 스냅샷 — 변경될 때마다 저장 트리거 */
  snapshot: InputDraftSnapshot;
}

export interface UseInputDraftResult {
  /** 마운트 시 유효한 draft 가 있었는지 — 이어쓰기 모달 트리거용 */
  hasInitialDraft: boolean;
  /** 저장된 draft 스냅샷 로드 (없으면 null) */
  loadDraft: () => InputDraftSnapshot | null;
  /** draft 삭제 — "새로 작성" 선택 시 호출 */
  clearDraft: () => void;
}

export function useInputDraft({ enabled, snapshot }: UseInputDraftOptions): UseInputDraftResult {
  // 마운트 시 1회만 draft 존재 여부 판정 — 이후 상태 변경에 영향 받지 않음
  const [initial] = useState<StoredDraft | null>(() => readStored());
  const timerRef = useRef<number | null>(null);

  // 디바운스 저장
  useEffect(() => {
    if (!enabled) return;
    if (!isMeaningful(snapshot)) return;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      try {
        const payload: StoredDraft = {
          ...snapshot,
          savedAt: Date.now(),
          schemaVersion: 1,
        };
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // sessionStorage quota / private mode — 조용히 무시
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, snapshot]);

  const loadDraft = useCallback((): InputDraftSnapshot | null => {
    const stored = readStored();
    if (!stored) return null;
    const { savedAt: _s, schemaVersion: _v, ...rest } = stored;
    return rest;
  }, []);

  const clearDraft = useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  return {
    hasInitialDraft: initial !== null,
    loadDraft,
    clearDraft,
  };
}
