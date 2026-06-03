"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGeneratePremiumPdf = handleGeneratePremiumPdf;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const htmlTemplate_1 = require("./htmlTemplate");
/** Signed URL 유효 시간 — 24시간 (#61 스펙) */
const SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * 프리미엄 결제 검증 — users/{uid}/payments 에 confirmed 5000원 결제 1건 이상.
 * 어뷰징 방지 (무료 사용자가 자기 사주를 PDF 추출하는 시도 차단).
 */
async function verifyPremiumPaid(db, uid) {
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
async function verifyReportOwnership(db, reportId, uid) {
    const reportDoc = await db.collection('reports').doc(reportId).get();
    if (!reportDoc.exists) {
        return { valid: false, reason: '리포트를 찾을 수 없습니다' };
    }
    const data = reportDoc.data() ?? {};
    if (data.uid !== uid) {
        return { valid: false, reason: '권한이 없습니다' };
    }
    // type 은 'basic' | 'premium' (서버 저장) 또는 'paid' (로컬) 다양성 허용
    const t = String(data.type ?? '');
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
function buildIssueId(reportId) {
    if (reportId && reportId.length >= 8) {
        return reportId.slice(-8).toUpperCase();
    }
    return Date.now().toString(36).slice(-8).toUpperCase();
}
/**
 * Puppeteer 동적 import — 모듈 미설치 시 graceful 503.
 * Cloud Functions 가 puppeteer-core + @sparticuz/chromium 을 번들했을 때만 동작.
 */
async function loadPuppeteer() {
    try {
        const [puppeteerCore, chromium] = await Promise.all([
            Promise.resolve(`${'puppeteer-core'}`).then(s => __importStar(require(s))),
            Promise.resolve(`${'@sparticuz/chromium'}`).then(s => __importStar(require(s))),
        ]);
        const chrome = chromium.default ?? chromium;
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
    }
    catch (err) {
        console.warn('[generatePremiumPdf] puppeteer-core / @sparticuz/chromium 미설치:', err?.message);
        return null;
    }
}
/**
 * HTML → PDF Buffer (puppeteer)
 *  - A4, 인쇄용 라이트 모드 강제
 *  - networkidle0 까지 대기 → Google Fonts 한자 글리프 임베딩 보장
 */
async function htmlToPdfBuffer(html) {
    const pup = await loadPuppeteer();
    if (!pup) {
        throw new https_1.HttpsError('unavailable', 'PDF 생성 엔진이 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
    const browser = await pup.launch();
    try {
        const page = await browser.newPage();
        await page.emulateMediaType('print');
        // Google Fonts CDN 폰트 페치까지 충분한 대기 — networkidle0
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
        // 폰트가 paint 될 때까지 한 호흡 더
        await page.evaluateHandle('document.fonts.ready');
        const pdfBuf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', right: '15mm', bottom: '18mm', left: '15mm' },
            preferCSSPageSize: true,
        });
        return pdfBuf;
    }
    finally {
        try {
            await browser.close();
        }
        catch { /* noop */ }
    }
}
/**
 * 핵심 핸들러 — onCall 진입점에서 호출.
 */
async function handleGeneratePremiumPdf(request, db) {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const { reportId, profile, sajuData, aiResult } = request.data ?? {};
    if (!profile?.name) {
        throw new https_1.HttpsError('invalid-argument', '이름 정보가 필요합니다');
    }
    if (!sajuData?.pillars) {
        throw new https_1.HttpsError('invalid-argument', '사주 데이터가 필요합니다');
    }
    if (!aiResult?.sections) {
        throw new https_1.HttpsError('invalid-argument', 'AI 분석 결과가 필요합니다');
    }
    // ── 1. ownership (reportId 제공 시) ──
    if (reportId) {
        const ownership = await verifyReportOwnership(db, reportId, uid);
        if (!ownership.valid) {
            throw new https_1.HttpsError('permission-denied', ownership.reason || '권한이 없습니다');
        }
    }
    // ── 2. 결제 검증 — 프리미엄 5000원 confirmed 1건 이상 (E13) ──
    const paid = await verifyPremiumPaid(db, uid);
    if (!paid) {
        throw new https_1.HttpsError('permission-denied', '프리미엄 결제 후 PDF 다운로드가 가능합니다');
    }
    // ── 3. HTML 빌드 ──
    const issuedAt = new Date().toISOString();
    const issueId = buildIssueId(reportId);
    const html = (0, htmlTemplate_1.buildPremiumPdfHtml)({
        profile,
        sajuData,
        aiResult,
        issuedAt,
        issueId,
    });
    // ── 4. PDF 생성 ──
    let pdfBuffer;
    try {
        pdfBuffer = await htmlToPdfBuffer(html);
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error('[generatePremiumPdf] PDF 생성 실패:', err);
        throw new https_1.HttpsError('internal', `PDF 생성 실패: ${err?.message || 'unknown'}`);
    }
    if (!pdfBuffer || pdfBuffer.length < 1024) {
        throw new https_1.HttpsError('internal', 'PDF 생성 결과가 비어있습니다');
    }
    // ── 5. Storage 업로드 ──
    const bucket = admin.storage().bucket();
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
    }
    catch (err) {
        console.error('[generatePremiumPdf] Storage 업로드 실패:', err);
        throw new https_1.HttpsError('internal', `PDF 저장 실패: ${err?.message || 'unknown'}`);
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
    }
    catch (err) {
        console.error('[generatePremiumPdf] signed URL 발급 실패:', err);
        throw new https_1.HttpsError('internal', `다운로드 링크 발급 실패: ${err?.message || 'unknown'}`);
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
    }
    catch (logErr) {
        // 로그 실패는 응답에 영향 없음 — 경고만
        console.warn('[generatePremiumPdf] 발급 로그 기록 실패:', logErr?.message);
    }
    return {
        url: signedUrl,
        expiresAt: new Date(expiresAtMs).toISOString(),
        issueId,
        bytes: pdfBuffer.length,
    };
}
//# sourceMappingURL=generatePremiumPdf.js.map