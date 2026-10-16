/**
 * #61 · 프리미엄 PDF 클라이언트 — Cloud Function 호출 래퍼
 *
 * 호출: generatePremiumPdf({ reportId, profile, sajuData, aiResult })
 * 응답: { url, expiresAt, issueId, bytes }
 *
 * timeout: 150s — puppeteer cold start (chromium 추출 + 폰트 페치) 흡수.
 */

import { httpsCallable } from 'firebase/functions';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';

export interface PdfProfile {
  name: string;
  birthDate?: string;
  birthTime?: string;
  gender?: 'male' | 'female';
}

export interface GeneratePdfArgs {
  reportId?: string;
  profile: PdfProfile;
  sajuData: any;
  aiResult: any;
  /** 2026-10-16 — 주면 서버가 PDF 를 이 주소로 첨부해 보낸다 */
  email?: string;
  /** 광고성 안내 메일 수신 동의 (선택) */
  marketingConsent?: boolean;
}

export interface GeneratePdfResult {
  url: string;
  expiresAt: string;
  issueId: string;
  bytes: number;
  emailed?: boolean;
}

export async function generatePremiumPdf(args: GeneratePdfArgs): Promise<GeneratePdfResult> {
  await ensureFunctionsTarget();
  const fn = httpsCallable<GeneratePdfArgs, GeneratePdfResult>(
    functions,
    'generatePremiumPdf',
    { timeout: 150000 }, // 2.5분
  );
  const res = await fn(args);
  return res.data;
}
