import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `당신은 40년 경력의 사주명리학 대가입니다. 한국 정통 명리학을 기반으로 사주를 풀이합니다.

## 학술 기반
적천수(滴天髓), 자평진전(子平眞詮), 삼명통회(三命通會), 궁통보감(窮通寶鑑), 연해자평(淵海子平), 명리정의(命理精義) 등 정통 명리학 원전에 기반합니다.
해석 중 적절한 경우 근거 원전을 자연스럽게 언급하세요.

## ⭐ "소름 포인트" 규칙 (가장 중요)
반드시 각 섹션의 첫 2~3문장에서, 이 사주를 가진 사람이 "어떻게 알았지?"라고 느낄 만큼 구체적인 행동 패턴이나 일상 습관을 묘사하세요.

## 해석 원칙
1. 일간 중심 해석
2. 오행 균형 분석
3. 십성 배치 해석 (년주=조상/사회, 월주=부모/직장, 일주=나/배우자, 시주=자녀/말년)
4. 지장간 분석 (겉과 속이 다른 부분)
5. 12운성 (에너지 상태)
6. 신살 (경향성, 미신 아님)
7. 대운/세운 (지금 시기)
8. 공망 (비어있는 에너지)
9. 납음 (근본 에너지)

## 해석 태도
- "~할 수 있습니다" 모호함 금지. 구체적 행동 묘사.
- "왜" 설명 필수.
- 부정적 해석에 반드시 보완법.
- 현재 대운/세운 반영.
- 한국인 현실 표현.
- 존댓말 + 따뜻한 톤.
- 각 섹션 400자 이상.

## 금기
- "죽음/큰 사고" 불안 조장 금지.
- 12운성 '사(死)' = "내면 수렴 단계".
- 흉살도 "주의 경향" + 활용법.

## 출력 형식
JSON만 출력하세요:
{
  "sections": [
    {"id": "summary", "title": "사주 총평", "content": "..."},
    {"id": "personality", "title": "타고난 성격과 기질", "content": "..."},
    {"id": "social", "title": "대인관계와 소통", "content": "..."},
    {"id": "career", "title": "직업운과 적성", "content": "..."},
    {"id": "wealth", "title": "재물운", "content": "..."},
    {"id": "love", "title": "애정운과 연애 스타일", "content": "..."},
    {"id": "health", "title": "건강 주의사항", "content": "..."},
    {"id": "year2026", "title": "2026년 운세", "content": "..."},
    {"id": "daeun", "title": "대운의 흐름", "content": "..."},
    {"id": "mission", "title": "인생의 핵심 과제", "content": "..."},
    {"id": "luck", "title": "개운법", "content": "..."},
    {"id": "luckyProfile", "title": "나만의 럭키 프로필", "content": "..."}
  ],
  "scores": {"career": 0-100, "love": 0-100, "wealth": 0-100, "social": 0-100, "health": 0-100, "potential": 0-100},
  "luckyProfile": {"colors": ["#HEX","#HEX","#HEX"], "colorNames": ["색1","색2","색3"], "numbers": [N,N,N], "direction": "방위", "day": "요일", "foods": ["음식1","음식2","음식3"], "element": "오행"},
  "careerFit": [{"job": "직종", "score": N}, ...5개],
  "monthlyFortune": [{"month": 1, "score": N}, ...12개],
  "relationshipMap": {"work": {"score": N, "keyword": "..."}, "friend": {"score": N, "keyword": "..."}, "lover": {"score": N, "keyword": "..."}},
  "wealthFlow": {"earning": {"score": N, "style": "..."}, "spending": {"score": N, "style": "..."}, "saving": {"score": N, "style": "..."}}
}`;

export async function generateSajuReport(
  apiKey: string,
  sajuData: any,
  situation: any,
  reportType: string,
): Promise<any> {
  const client = new Anthropic({ apiKey });

  const userPrompt = buildUserPrompt(sajuData, situation);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 8000,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = (message.content[0] as any).text;

  // JSON 파싱
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    content: {
      sections: parsed.sections,
      scores: parsed.scores,
      luckyProfile: parsed.luckyProfile,
      careerFit: parsed.careerFit,
      monthlyFortune: parsed.monthlyFortune,
      relationshipMap: parsed.relationshipMap,
      wealthFlow: parsed.wealthFlow,
      summary: parsed.sections[0]?.content?.slice(0, 100) + '...',
    },
  };
}

function buildUserPrompt(sajuData: any, situation?: any): string {
  const p = sajuData.pillars || [];
  let prompt = `## 기본 정보\n`;
  prompt += `- 생년월일: ${sajuData.input?.birthYear}년 ${sajuData.input?.birthMonth}월 ${sajuData.input?.birthDay}일\n`;
  prompt += `- 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n`;
  prompt += `- 출생시간: ${sajuData.input?.hasBirthTime ? sajuData.input.birthHour + '시' : '모름'}\n`;
  if (sajuData.띠) prompt += `- 띠: ${sajuData.띠}\n`;

  prompt += `\n## 사주 원국\n`;
  prompt += `| 기둥 | 천간 | 지지 |\n|---|---|---|\n`;
  const labels = ['년주', '월주', '일주', '시주'];
  p.forEach((pillar: any, i: number) => {
    if (pillar.available !== false) {
      prompt += `| ${labels[i]} | ${pillar.천간}(${pillar.천간읽기}) | ${pillar.지지}(${pillar.지지읽기}) |\n`;
    }
  });

  // 십성
  if (sajuData.sipsung?.length) {
    prompt += `\n## 십성 배치\n`;
    sajuData.sipsung.forEach((s: any) => {
      prompt += `- ${s.위치}: ${s.글자} (${s.십성})\n`;
    });
  }

  // 지장간
  if (sajuData.jijanggan?.length) {
    prompt += `\n## 지장간\n`;
    sajuData.jijanggan.forEach((j: any) => {
      prompt += `- ${j.지지}(${j.위치}): ${j.지장간.join(', ')}\n`;
    });
  }

  // 12운성
  if (sajuData.unyoung12?.length) {
    prompt += `\n## 12운성\n`;
    sajuData.unyoung12.forEach((u: any) => {
      prompt += `- ${u.위치}: ${u.운성}(${u.운성읽기})\n`;
    });
  }

  // 오행 분포
  if (sajuData.elements) {
    prompt += `\n## 오행 분포\n`;
    Object.entries(sajuData.elements).forEach(([k, v]) => {
      prompt += `- ${k}: ${v}\n`;
    });
  }

  // 대운
  if (sajuData.daeun?.length) {
    prompt += `\n## 현재 대운\n`;
    const current = sajuData.daeun.find((d: any) => d.현재);
    if (current) {
      prompt += `- ${current.간지}(${current.간지읽기}) ${current.나이범위}\n`;
    }
  }

  // 신살
  if (sajuData.gilsin?.length) {
    prompt += `\n## 길신\n`;
    sajuData.gilsin.forEach((g: any) => { prompt += `- ${g.이름}: ${g.설명 || ''}\n`; });
  }
  if (sajuData.hyungsal?.length) {
    prompt += `\n## 흉살\n`;
    sajuData.hyungsal.forEach((h: any) => { prompt += `- ${h.이름}: ${h.설명 || ''}\n`; });
  }

  // 상황 질문
  if (situation) {
    prompt += `\n## 사용자 상황\n`;
    if (situation.loveStatus) prompt += `- 연애: ${situation.loveStatus}\n`;
    if (situation.jobStatus) prompt += `- 직업: ${situation.jobStatus}\n`;
    if (situation.concern) prompt += `- 고민: ${situation.concern}\n`;
  }

  prompt += `\n위 데이터를 바탕으로 12개 섹션의 사주 풀이를 JSON으로 작성해주세요.`;
  return prompt;
}
