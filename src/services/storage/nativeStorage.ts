/**
 * 스토리지 추상화 — 앱인토스 Storage / 웹 localStorage 자동 분기
 *
 * 앱인토스: @apps-in-toss/web-framework의 Storage (네이티브, 앱 재시작 후에도 유지)
 * 웹: localStorage
 *
 * 현재: localStorage 직접 사용 (런칭 시 이 모듈로 마이그레이션)
 * Phase 2: Firestore로 서버 저장 (멀티 디바이스 동기화)
 */

import { isAppsInToss } from '@/services/payment/iapService';

export async function setItem(key: string, value: string): Promise<void> {
  if (isAppsInToss()) {
    try {
      const { Storage } = await import('@apps-in-toss/web-framework');
      await Storage.setItem(key, value);
      return;
    } catch { /* fallback to localStorage */ }
  }
  localStorage.setItem(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  if (isAppsInToss()) {
    try {
      const { Storage } = await import('@apps-in-toss/web-framework');
      return await Storage.getItem(key);
    } catch { /* fallback */ }
  }
  return localStorage.getItem(key);
}

export async function removeItem(key: string): Promise<void> {
  if (isAppsInToss()) {
    try {
      const { Storage } = await import('@apps-in-toss/web-framework');
      await Storage.removeItem(key);
      return;
    } catch { /* fallback */ }
  }
  localStorage.removeItem(key);
}
