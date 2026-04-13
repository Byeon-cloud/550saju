import Anthropic from '@anthropic-ai/sdk';

interface TopicConfig {
  label: string;
  sections: string[];
  specificPrompt: string;
}

const TOPIC_CONFIGS: Record<string, TopicConfig> = {
  love: {
    label: '연애운',
    sections: ['나의 연애 스타일', '끌리는 이상형 프로필', '인연이 시작되는 시기와 장소', '연애 중 반복되는 패턴', '올해 연애 흐름과 전략'],
    specificPrompt: `⭐ "와 진짜 내 얘기다" 반응이 나올 정도로 구체적으로.

- 일지 배우자궁 분석 → 이상형 구체 묘사: 직업군, 성격, MBTI 경향, 외모 스타일, 나이 차이까지
- 도화살 유무 → 매력의 원천: "당신은 ~할 때 가장 매력적이에요"
- 연애 킬러 패턴: "매번 ~한 사람에게 끌리는데, 사주적으로 그 이유는..."
- 과거 연애 소름 포인트: "이전 연애에서 ~한 일이 있었을 거예요. 사주에서 보여요"
- 현재 대운 + 월운 → 인연 시작 시기 (월 단위): "양력 O~O월이 가장 유력"
- 어디서 만날 가능성이 높은지: 직장/소개/앱/모임 중 사주적으로 유리한 채널
- 올해 연애 전략: 구체적 행동 3가지`,
  },
  wealth: {
    label: '재물운',
    sections: ['돈 버는 스타일', '재물 흐름 분석', '투자 성향과 적기', '새는 돈 패턴', '올해 재물 전략'],
    specificPrompt: `- 재성(正財/偏財) 위치와 강약으로 "정규직형 vs 사업형 vs 투자형" 판별
- 식신생재 구조 여부
- 겁재 유무 → 돈 새는 패턴
- 월별 재물 점수 + "이 달에 큰 지출이 있을 수 있어요"`,
  },
  career: {
    label: '취업·이직운',
    sections: ['타고난 직업 적성', '딱 맞는 직종 TOP 5', '이직/취업 최적 타이밍', '직장 내 인간관계 패턴', '올해 커리어 핵심 전략'],
    specificPrompt: `⭐ 구체적이고 실용적으로. "당장 내일부터 써먹을 수 있는" 조언.

- 관성(정관/편관) 강약 → 안정형 vs 도전형 vs 프리랜서형 판별 근거
- 식상 → 표현력/창의력 → 딱 맞는 직종 5개 (구체적 직무명까지: "UX 디자이너", "데이터 분석가" 등)
- 현재 대운이 이직에 유리한지 → 구체적 시기: "양력 O~O월 이직 시도가 가장 유리"
- 면접 유리한 요일/시간대: "화요일 오전, 목요일 오후가 사주적으로 유리"
- 직장 상사와의 관계 패턴: "~한 상사와 잘 맞고, ~한 타입과 충돌"
- 연봉 협상 적기 + 전략
- "혹시 이전 직장에서 ~한 경험이 있었나요?" 소름 포인트`,
  },
  marriage: {
    label: '결혼운',
    sections: ['결혼 적기 분석', '배우자 성향', '결혼 후 생활 패턴', '시댁/처가 관계', '결혼 준비 조언'],
    specificPrompt: `- 일지+월지 관계로 시댁/처가 관계 예측
- 결혼 적기: 연도+시즌까지
- 배우자 성향: 직업, 성격, 나이 차이 경향`,
  },
  business: {
    label: '사업운',
    sections: ['사업가 기질 분석', '맞는 업종', '창업 타이밍', '동업 궁합', '사업 리스크 관리'],
    specificPrompt: `- 비겁 강약 → 독립 vs 프랜차이즈 vs 동업
- 맞는 업종 5개 (구체적)
- 창업 자금 운용 패턴`,
  },
  health: {
    label: '건강운',
    sections: ['오행별 취약 장기', '체질 분석', '올해 건강 주의 시기', '정신 건강 패턴', '건강 개선 전략'],
    specificPrompt: `- 오행 과다/부족 → 취약 장기 매핑
- 맞는 운동/식단/수면 패턴
- 정신 건강: 스트레스 패턴 + 해소법`,
  },
  reunion: {
    label: '재회운',
    sections: ['이별의 진짜 원인', '상대방의 현재 마음', '재회 가능성과 시기', '재회 후 달라질 것들', '새 인연 vs 재회 — 솔직한 비교'],
    specificPrompt: `⭐ 이 분석은 "소름돋는" 수준이어야 합니다. 읽는 사람이 울컥할 정도로 구체적으로.

- 일지 형충파해 + 대운 흐름으로 이별의 사주적 원인을 구체적으로: "당시 ~한 상황에서 서로 ~했을 거예요"
- 상대방의 현재 감정 상태를 사주 관계론으로 추론: "지금 상대방은 ~한 감정을 느끼고 있을 가능성이 높아요"
- 재회 가능성을 % 수치 + 근거: "재회 가능성 67% — 이유는..."
- 재회 적기를 월 단위로: "양력 O월~O월 사이 연락이 올 수 있어요"
- 재회했을 때 반복될 패턴 vs 새로 달라질 부분 솔직하게
- 새 인연이 더 좋은 경우 솔직하게: "사주적으로 새 인연이 더 맞는 구조예요. 이유는..."
- 행동 조언: "지금 연락하면 안 되는 이유" 또는 "이렇게 다가가세요"
- "혹시 이별 직전에 ~한 일이 있었나요?" 형태의 소름 포인트 2~3개 필수`,
  },
  study: {
    label: '학업·시험운',
    sections: ['학습 스타일 분석', '집중력 패턴', '시험 합격 운', '공부 최적 시간대', '올해 학업 전략'],
    specificPrompt: `- 인성 강약 → 학습 스타일 (암기형 vs 이해형)
- 시험 합격에 유리한 월/날짜
- 과목별 적성`,
  },
  social: {
    label: '대인관계운',
    sections: ['관계 스타일 분석', '귀인운', '구설수 주의 시기', '인간관계 갈등 패턴', '올해 관계 전략'],
    specificPrompt: `- 비겁 → 친구/동료 관계
- 귀인 유무 → 도움 주는 사람 특징
- 올해 구설수/배신 주의 시기`,
  },
  moving: {
    label: '이사·이동운',
    sections: ['이동 적기 분석', '좋은 방향', '이사/이직/유학 전망', '해외운', '올해 이동 전략'],
    specificPrompt: `- 역마살 유무
- 방향: 오행 기반 좋은 방위
- 이사/유학/해외취업 각각 조언`,
  },
};

export async function generateTopicAnalysisAI(
  apiKey: string,
  topicId: string,
  sajuData: any,
): Promise<any> {
  const config = TOPIC_CONFIGS[topicId];
  if (!config) throw new Error(`알 수 없는 주제: ${topicId}`);

  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt(config, sajuData);

  // 연애/재회/취업은 Sonnet 4 (고퀄), 나머지는 Haiku (가성비)
  const premiumTopics = ['love', 'reunion', 'career', 'marriage'];
  const model = premiumTopics.includes(topicId) ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001';

  const msg = await anthropic.messages.create({
    model,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (msg.content[0] as any).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON 파싱 실패');
  return JSON.parse(jsonMatch[0]);
}

function buildPrompt(config: TopicConfig, d: any): string {
  const p = d.pillars || [];
  const labels = ['년주', '월주', '일주', '시주'];
  let pillarsText = '';
  p.forEach((x: any, i: number) => { if (x.available !== false) pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기||''})${x.지지}(${x.지지읽기||''})\n`; });
  const el = d.elements || {};
  const sipsung = d.sipsung?.map((s: any) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
  const currentDaeun = d.daeun?.find((x: any) => x.isCurrent || x.현재);
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월`;

  return `명리학 40년 대가. "${config.label}" 심층 분석. "소름돋는" 수준.

⚠️ 현재 날짜: ${dateStr} — 반드시 이 기준으로 과거/현재/미래 구분.

## 사주 원국
${pillarsText}일간: ${p[2]?.천간 || '미상'}

## 오행: 목${el.목||0} 화${el.화||0} 토${el.토||0} 금${el.금||0} 수${el.수||0}
${Object.entries(el).filter(([,v]) => v === 0).map(([k]) => `→ ${k} 없음`).join('\n')}

## 십성: ${sipsung || '미상'}
## 현재 대운: ${currentDaeun ? currentDaeun.간지 : '미상'}
## 이름: ${d.input?.name||'미상'}, ${d.input?.gender==='male'?'남':'여'}

## ${config.label} 분석 규칙
${config.specificPrompt}

## 출력 (JSON만, 코드블록 없이)
{
  "title": "${d.input?.name||''}님의 ${config.label} 심층분석",
  "grade": "S/A/B/C",
  "gradeLabel": "한줄 평가",
  "overallScore": 0-100,
  "summary": "200자 이상. 소름 포인트 포함.",
  "sections": [${config.sections.map(s => `{"heading": "${s}", "content": "150자 이상"}`).join(', ')}],
  "timeline": [{"period": "시기", "score": 1-10, "description": "60자 이상"}, ...6~12개],
  "luckyProfile": {"color": "색상", "direction": "방위", "number": 숫자, "item": "아이템", "bestMonth": "최적월"},
  "actionAdvice": "100자 이상. 지금 당장 할 수 있는 행동."
}`;
}

export { TOPIC_CONFIGS };
