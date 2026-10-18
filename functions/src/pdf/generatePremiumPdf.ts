/**
 * #61 · 프리미엄 PDF 생성 Cloud Function
 *
 * 핵심 흐름:
 *   1. 클라이언트 호출: callable function generatePremiumPdf({ reportId, profile, sajuData, aiResult })
 *   2. 서버 검증:
 *      - request.auth.uid 존재 (로그인 필요)
 *      - reportId 가 있으면 reports/{reportId} doc 의 uid 가 auth.uid 와 일치 + type 이 premium 계열
 *      - users/{uid}/payments 에 status === 'confirmed' && amount >= 5000 결제 1건 이상 (E13)
 *        ※ 무료 사용자가 자기 사주를 PDF 추출하는 것 차단 — 프리미엄 결제자만 발급 가능
 *   3. 서버 렌더: htmlTemplate.ts → puppeteer → A4 PDF Buffer
 *   4. Storage 업로드: bucket/premium-pdfs/{uid}/{reportId-or-issueId}-{ts}.pdf
 *   5. 24h Signed URL 반환
 *
 * 메모리 1GiB · timeout 120s · region asia-northeast3 (서울)
 *
 * 의존성:
 *   - puppeteer-core ^23 (Chrome 제어 라이브러리)
 *   - @sparticuz/chromium ^131 (Cloud Functions 환경용 chromium 바이너리)
 *
 * Storage 정책:
 *   - 기본 버킷 (firebase-admin getStorage().bucket())
 *   - 객체 경로: premium-pdfs/{uid}/{issueId}.pdf
 *   - lifecycle: 7일 후 자동 삭제 권장 (별도 Storage Rules · 본 코드에서는 미관리)
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { buildPremiumPdfHtml, type PdfTemplateInput } from './htmlTemplate';
import { normalizeEmail, sendPremiumPdfMail } from './mailPdf';

interface GeneratePdfRequest {
  reportId?: string;
  profile?: PdfTemplateInput['profile'];
  sajuData?: any;
  aiResult?: any;
  /** 2026-10-16 — 주면 PDF 를 이 주소로 첨부해 보낸다 (mailPdf.ts) */
  email?: string;
  /** 광고성 안내 메일 수신 동의 (선택, 기본 아니오) */
  marketingConsent?: boolean;
}

interface GeneratePdfResponse {
  url: string;
  expiresAt: string;   // ISO 8601
  issueId: string;
  bytes: number;
  /** 메일로 보냈으면 true */
  emailed?: boolean;
}

/** Signed URL 유효 시간 — 24시간 (#61 스펙) */
const SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * PDF 전용 버킷 (2026-07-07 프로비저닝).
 *  이 프로젝트는 Firebase Storage 기본 버킷이 미생성 상태라 admin.storage().bucket() (기본) 은
 *  존재하지 않는 버킷을 가리켜 404. PDF 는 서버 업로드 + 서명URL 로만 접근(클라이언트 접근 X)하므로
 *  전용 GCS 버킷(uniform access · public-access 차단 · 7일 lifecycle)을 명시 참조한다.
 *  런타임 SA(...-compute) 에 objectAdmin + signBlob(서명URL) 부여됨.
 */
const PREMIUM_PDF_BUCKET = 'appintoss-saju-premium-pdf';

/**
 * 프리미엄 결제 검증 — users/{uid}/payments 에 confirmed 5000원 결제 1건 이상.
 * 어뷰징 방지 (무료 사용자가 자기 사주를 PDF 추출하는 시도 차단).
 */
/** 이 계정이 서버에서 종합사주를 받은 적이 있는가 (generateReport, generatePremiumReportStream 이 reports 에 uid, type 'premium' 을 남긴다) */
async function hasPremiumReport(db: admin.firestore.Firestore, uid: string): Promise<boolean> {
  const snap = await db.collection('reports').where('uid', '==', uid).where('type', '==', 'premium').limit(1).get();
  return !snap.empty;
}

async function verifyPremiumPaid(db: admin.firestore.Firestore, uid: string): Promise<boolean> {
  const snap = await db.collection(`users/${uid}/payments`)
    .where('status', '==', 'confirmed')
    .where('amount', '>=', 5000)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * reportId 가 제공된 경우 ownership / type 검증.
 * reportId 미제공 시 skip (legacy / 클라이언트 단독 호출 허용 — 결제 검증으로 대체).
 */
async function verifyReportOwnership(
  db: admin.firestore.Firestore,
  reportId: string,
  uid: string,
): Promise<{ valid: boolean; reason?: string }> {
  const reportDoc = await db.collection('reports').doc(reportId).get();
  if (!reportDoc.exists) {
    return { valid: false, reason: '리포트를 찾을 수 없습니다' };
  }
  const data = reportDoc.data() ?? {};
  if (data.uid !== uid) {
    return { valid: false, reason: '권한이 없습니다' };
  }
  // type 은 'basic' | 'premium' (서버 저장) 또는 'paid' (로컬) 다양성 허용
  const t: string = String(data.type ?? '');
  const isPremium = t === 'premium' || t === 'paid';
  if (!isPremium) {
    return { valid: false, reason: '프리미엄 리포트만 PDF 발급이 가능합니다' };
  }
  return { valid: true };
}

/**
 * 짧은 issueId 생성 — 발급 일련번호 (PDF 표지/푸터에 노출)
 *  - reportId 가 있으면 마지막 8자
 *  - 없으면 timestamp 기반 base36 8자
 */
function buildIssueId(reportId?: string): string {
  if (reportId && reportId.length >= 8) {
    return reportId.slice(-8).toUpperCase();
  }
  return Date.now().toString(36).slice(-8).toUpperCase();
}

/**
 * Puppeteer 동적 import — 모듈 미설치 시 graceful 503.
 * Cloud Functions 가 puppeteer-core + @sparticuz/chromium 을 번들했을 때만 동작.
 */
async function loadPuppeteer(): Promise<{ launch: () => Promise<any> } | null> {
  try {
    const [puppeteerCore, chromium] = await Promise.all([
      import('puppeteer-core' as any),
      import('@sparticuz/chromium' as any),
    ]);
    const chrome = (chromium as any).default ?? chromium;
    const launch = async () => {
      const executablePath = await chrome.executablePath();
      return puppeteerCore.launch({
        args: chrome.args,
        defaultViewport: chrome.defaultViewport,
        executablePath,
        headless: 'shell',
      });
    };
    return { launch };
  } catch (err: any) {
    console.warn('[generatePremiumPdf] puppeteer-core / @sparticuz/chromium 미설치:', err?.message);
    return null;
  }
}

/**
 * HTML → PDF Buffer (puppeteer)
 *  - A4, 인쇄용 라이트 모드 강제
 *  - networkidle0 까지 대기 → Google Fonts 한자 글리프 임베딩 보장
 */
async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const pup = await loadPuppeteer();
  if (!pup) {
    throw new HttpsError(
      'unavailable',
      'PDF 생성 엔진이 준비되지 않았습니다. 잠시 후 다시 시도해주세요.',
    );
  }

  const browser = await pup.launch();
  try {
    const page = await browser.newPage();
    await page.emulateMediaType('print');
    // Google Fonts CDN 폰트 페치까지 충분한 대기 — networkidle0
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    // 폰트가 paint 될 때까지 한 호흡 더
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuf: Buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '18mm', left: '15mm' },
      preferCSSPageSize: true,
    });
    return Buffer.from(pdfBuf); // 2026-10-19 puppeteer 23 은 Uint8Array — 메일 첨부(nodemailer)는 Buffer 여야 안 깨진다
  } finally {
    try { await browser.close(); } catch { /* noop */ }
  }
}

/**
 * 핵심 핸들러 — onCall 진입점에서 호출.
 */
export async function handleGeneratePremiumPdf(
  request: { auth?: { uid?: string } | null; data: GeneratePdfRequest },
  db: admin.firestore.Firestore,
): Promise<GeneratePdfResponse> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다');
  }

  const { reportId, profile, sajuData, aiResult } = request.data ?? {};
  const wantEmail = request.data?.email != null && request.data.email !== '';
  const email = wantEmail ? normalizeEmail(request.data.email) : null;
  if (wantEmail && !email) {
    throw new HttpsError('invalid-argument', '메일 주소를 다시 확인해 주세요');
  }
  if (!profile?.name) {
    throw new HttpsError('invalid-argument', '이름 정보가 필요합니다');
  }
  if (!sajuData?.pillars) {
    throw new HttpsError('invalid-argument', '사주 데이터가 필요합니다');
  }
  if (!aiResult?.sections) {
    throw new HttpsError('invalid-argument', 'AI 분석 결과가 필요합니다');
  }

  // ── 1~2. 종합사주를 받은 계정인지 (2026-10-16 수리) ──
  //   화면은 자기 쪽 결과 번호(base36)를 보내는데 서버 reports 문서는 자동 번호라 '리포트를 찾을 수 없음'으로 늘 거절됐고,
  //   한 번에 5,000원 결제 기록이 있어야만 통과해 운을 나눠 충전했거나 보너스로 산 사람도 막혔다.
  //   → 서버 번호와 맞으면 그 결과의 주인인지, 아니면 이 계정이 서버에서 종합사주를 받은 적 있는지(reports uid+premium)로 본다.
  let allowed = false;
  if (reportId) {
    const exists = (await db.collection('reports').doc(reportId).get()).exists;
    if (exists) {
      const ownership = await verifyReportOwnership(db, reportId, uid);
      if (!ownership.valid) {
        throw new HttpsError('permission-denied', ownership.reason || '권한이 없습니다');
      }
      allowed = true;
    }
  }
  if (!allowed) allowed = (await hasPremiumReport(db, uid)) || (await verifyPremiumPaid(db, uid));
  if (!allowed) {
    throw new HttpsError('permission-denied', '종합사주를 받은 계정에서만 PDF를 만들 수 있어요');
  }

  // ── 3. HTML 빌드 ──
  const issuedAt = new Date().toISOString();
  const issueId = buildIssueId(reportId);
  const html = buildPremiumPdfHtml({
    profile,
    sajuData,
    aiResult,
    issuedAt,
    issueId,
  });

  // ── 4. PDF 생성 ──
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await htmlToPdfBuffer(html);
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    console.error('[generatePremiumPdf] PDF 생성 실패:', err);
    throw new HttpsError('internal', `PDF 생성 실패: ${err?.message || 'unknown'}`);
  }

  if (!pdfBuffer || pdfBuffer.length < 1024) {
    throw new HttpsError('internal', 'PDF 생성 결과가 비어있습니다');
  }

  // ── 5. Storage 업로드 ──
  const bucket = admin.storage().bucket(PREMIUM_PDF_BUCKET);
  const filename = `premium-pdfs/${uid}/${issueId}-${Date.now()}.pdf`;
  const file = bucket.file(filename);

  try {
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        cacheControl: 'private, max-age=86400',
        metadata: {
          uid,
          reportId: reportId ?? '',
          issueId,
          issuedAt,
        },
      },
    });
  } catch (err: any) {
    console.error('[generatePremiumPdf] Storage 업로드 실패:', err);
    throw new HttpsError('internal', `PDF 저장 실패: ${err?.message || 'unknown'}`);
  }

  // ── 6. Signed URL (24h) ──
  const expiresAtMs = Date.now() + SIGNED_URL_TTL_MS;
  let signedUrl = '';
  try {
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAtMs,
      responseDisposition: `attachment; filename="saju500-premium-${issueId}.pdf"`,
      responseType: 'application/pdf',
    });
    signedUrl = url;
  } catch (err: any) {
    console.error('[generatePremiumPdf] signed URL 발급 실패:', err);
    throw new HttpsError('internal', `다운로드 링크 발급 실패: ${err?.message || 'unknown'}`);
  }

  // ── 7. 발급 로그 (감사 추적) ──
  try {
    await db.collection(`users/${uid}/pdfIssuances`).add({
      issueId,
      reportId: reportId ?? null,
      filename,
      bytes: pdfBuffer.length,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(expiresAtMs),
    });
  } catch (logErr: any) {
    // 로그 실패는 응답에 영향 없음 — 경고만
    console.warn('[generatePremiumPdf] 발급 로그 기록 실패:', logErr?.message);
  }

  // ── 8. 메일로 보내기 (요청했을 때만) ──
  let emailed = false;
  if (email) {
    await sendPremiumPdfMail({ db, uid, email, name: profile.name, pdf: pdfBuffer, issueId, marketingConsent: !!request.data?.marketingConsent });
    emailed = true;
  }

  return {
    url: signedUrl,
    expiresAt: new Date(expiresAtMs).toISOString(),
    issueId,
    bytes: pdfBuffer.length,
    emailed,
  };
}
