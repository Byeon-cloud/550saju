import { GoogleGenerativeAI } from '@google/generative-ai';
import { safeParseJson } from './parseJson';

const SYSTEM_PROMPT = `당신은 사주명리학 대가이며 세운/월운 분석 전문가입니다.
2026년(丙午年) 12개월을 각각 분석하세요. 구체적 행동 묘사, 모호함 금지.

반드시 JSON만 출력하세요. 코드블록(\`\`\`) 사용 금지. {로 바로 시작하세요.
출력 형식:
{"yearOverview":"2026년 전체 운세 개요 200자","bestMonth":3,"worstMonth":8,"months":[{"month":1,"score":75,"theme":"새해 시작의 기운","advice":"이달의 핵심 조언 100자","luckyDay":"15일, 23일","luckyItem":"은 액세서리","career":"직업운 한줄","love":"애정운 한줄","wealth":"재물운 한줄","caution":"주의할 점 50자"}]}`;

export async function generateMonthlyFortune(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro', generationConfig: { maxOutputTokens: 8192 } });
  const userPrompt = buildMonthlyPrompt(sajuData);
  for (let attempt = 0; attempt < 2; attempt++) { try { const result = await model.generateContent(SYSTEM_PROMPT + '\n\n' + userPrompt);
  return safeParseJson(result.response.text()); } catch (retryErr) { if (attempt === 1) throw retryErr; await new Promise(r => setTimeout(r, 1000)); } } throw new Error("재시도 실패");
}

function buildMonthlyPrompt(sajuData: any): string {
  const p = sajuData.pillars || [];
  let prompt = `이름: ${sajuData.input?.name || '미상'}, 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n사주: `;
  const labels = ['년', '월', '일', '시'];
  p.forEach((pillar: any, i: number) => {
    if (pillar.available !== false) prompt += `${labels[i]}주:${pillar.천간}${pillar.지지} `;
  });
  if (sajuData.elements) prompt += `\n오행: 목${sajuData.elements.목} 화${sajuData.elements.화} 토${sajuData.elements.토} 금${sajuData.elements.금} 수${sajuData.elements.수}`;
  const cd = sajuData.daeun?.find((d: any) => d.isCurrent || d.현재);
  if (cd) prompt += `\n현재 대운: ${cd.간지}`;
  prompt += `\n\n2026년 12개월 월별 운세를 분석해주세요.`;
  return prompt;
}
