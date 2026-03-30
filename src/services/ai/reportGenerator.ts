import type { SajuData, Situation } from '@/types/saju';
import type { ReportSection } from '@/types/report';
import { buildPrompt } from '@/services/saju/promptBuilder';

interface GenerateReportParams {
  sajuData: SajuData;
  situation?: Situation;
  reportType: 'basic' | 'premium';
}

interface GenerateReportResult {
  sections: ReportSection[];
  scores: Record<string, number>;
  summary: string;
}

/**
 * Firebase Function을 호출하여 AI 사주 리포트를 생성합니다.
 * 실제 AI 호출은 서버(Firebase Functions)에서 처리합니다.
 */
export async function generateReport(params: GenerateReportParams): Promise<GenerateReportResult> {
  const { sajuData, situation, reportType } = params;
  const prompt = buildPrompt(sajuData, situation);

  // TODO: Firebase Function 연동
  // const generateReportFn = httpsCallable(functions, 'generateReport');
  // const result = await generateReportFn({ prompt, reportType, sajuData });

  // 임시 목업 — Firebase Function 연동 시 교체
  console.log('[reportGenerator] prompt built:', {
    systemPromptLength: prompt.systemPrompt.length,
    userPromptLength: prompt.userPrompt.length,
    reportType,
  });

  throw new Error('Firebase Function 연동이 필요합니다. functions/src/generateReport.ts를 구현하세요.');
}

/**
 * AI 응답 JSON을 파싱하여 ReportSection[] 으로 변환합니다.
 */
export function parseAIResponse(raw: string): GenerateReportResult {
  const sections: ReportSection[] = JSON.parse(raw).map((s: { id: string; title: string; content: string; score?: number }) => ({
    id: s.id,
    icon: '',
    title: s.title,
    content: s.content,
    score: s.score,
  }));

  const scores: Record<string, number> = {};
  for (const s of sections) {
    if ('score' in s) {
      scores[s.id] = (s as ReportSection & { score?: number }).score ?? 0;
    }
  }

  return {
    sections,
    scores,
    summary: sections[0]?.content.slice(0, 200) ?? '',
  };
}
