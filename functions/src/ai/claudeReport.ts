import { GoogleGenerativeAI } from '@google/generative-ai';
import { safeParseJson } from './parseJson';

const SYSTEM_PROMPT = `당신은 40년 경력의 사주명리학 대가입니다. 적천수, 자평진전, 삼명통회 등 정통 명리학 원전에 기반합니다.

⭐ 소름 포인트: 각 섹션 첫 2~3문장에서 이 사주를 가진 사람이 "어떻게 알았지?" 할 정도로 구체적 행동 패턴을 묘사하세요.
구체적 행동 묘사, "~할 수 있습니다" 모호함 금지, 부정적 해석에 반드시 보완법, 존댓말.
각 섹션 200자 이상.

출력 (JSON만):
{"sections":[{"id":"summary","title":"사주 총평","content":"..."},{"id":"personality","title":"타고난 성격과 기질","content":"..."},{"id":"social","title":"대인관계와 소통","content":"..."},{"id":"career","title":"직업운과 적성","content":"..."},{"id":"wealth","title":"재물운","content":"..."},{"id":"love","title":"애정운과 연애 스타일","content":"..."},{"id":"health","title":"건강 주의사항","content":"..."},{"id":"year2026","title":"2026년 운세","content":"..."},{"id":"daeun","title":"대운의 흐름","content":"..."},{"id":"mission","title":"인생의 핵심 과제","content":"..."},{"id":"luck","title":"개운법","content":"..."},{"id":"luckyProfile","title":"나만의 럭키 프로필","content":"..."}],"scores":{"career":0,"love":0,"wealth":0,"social":0,"health":0,"potential":0},"luckyProfile":{"colors":["#HEX"],"colorNames":["색"],"numbers":[1],"direction":"방위","day":"요일","foods":["음식"],"element":"오행"},"careerFit":[{"job":"직종","score":80}],"monthlyFortune":[{"month":1,"score":75}],"relationshipMap":{"work":{"score":80,"keyword":""},"friend":{"score":80,"keyword":""},"lover":{"score":80,"keyword":""}},"wealthFlow":{"earning":{"score":80,"style":""},"spending":{"score":80,"style":""},"saving":{"score":80,"style":""}}}`;

export async function generateSajuReport(apiKey: string, sajuData: any, situation: any, reportType: string): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { maxOutputTokens: 8192 } });
  const userPrompt = buildUserPrompt(sajuData, situation);
  const result = await model.generateContent(SYSTEM_PROMPT + '\n\n' + userPrompt);
  const parsed = safeParseJson(result.response.text());
  return {
    content: {
      sections: parsed.sections,
      scores: parsed.scores,
      luckyProfile: parsed.luckyProfile,
      careerFit: parsed.careerFit,
      monthlyFortune: parsed.monthlyFortune,
      relationshipMap: parsed.relationshipMap,
      wealthFlow: parsed.wealthFlow,
      summary: parsed.sections?.[0]?.content?.slice(0, 100) + '...',
    },
  };
}

function buildUserPrompt(sajuData: any, situation?: any): string {
  const p = sajuData.pillars || [];
  let prompt = `## 기본 정보\n- 생년월일: ${sajuData.input?.birthYear}년 ${sajuData.input?.birthMonth}월 ${sajuData.input?.birthDay}일\n- 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n`;
  if (sajuData.띠) prompt += `- 띠: ${sajuData.띠}\n`;
  prompt += `\n## 사주 원국\n`;
  const labels = ['년주', '월주', '일주', '시주'];
  p.forEach((pillar: any, i: number) => {
    if (pillar.available !== false) prompt += `${labels[i]}: ${pillar.천간}(${pillar.천간읽기})${pillar.지지}(${pillar.지지읽기})\n`;
  });
  if (sajuData.sipsung?.length) {
    prompt += `\n## 십성\n`;
    sajuData.sipsung.forEach((s: any) => { prompt += `${s.위치}: ${s.글자}(${s.십성})\n`; });
  }
  if (sajuData.elements) {
    prompt += `\n## 오행 분포\n`;
    Object.entries(sajuData.elements).forEach(([k, v]) => { prompt += `${k}: ${v}\n`; });
  }
  if (sajuData.daeun?.length) {
    const current = sajuData.daeun.find((d: any) => d.현재 || d.isCurrent);
    if (current) prompt += `\n## 현재 대운: ${current.간지}\n`;
  }
  if (situation) {
    prompt += `\n## 사용자 상황\n`;
    if (situation.loveStatus) prompt += `- 연애: ${situation.loveStatus}\n`;
    if (situation.jobStatus) prompt += `- 직업: ${situation.jobStatus}\n`;
    if (situation.concern) prompt += `- 고민: ${situation.concern}\n`;
  }
  prompt += `\n위 데이터를 바탕으로 12개 섹션의 사주 풀이를 JSON으로 작성해주세요.`;
  return prompt;
}
