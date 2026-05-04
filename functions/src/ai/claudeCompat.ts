import Anthropic from '@anthropic-ai/sdk';

/**
 * 두 사주 간 자동 관계 분석 (정통 명리학 산출 결과 주입)
 *
 * 천간 5합: 甲己, 乙庚, 丙辛, 丁壬, 戊癸 → 토·금·수·목·화
 * 천간 4충: 甲庚, 乙辛, 丙壬, 丁癸
 * 지지 6합: 子丑, 寅亥, 卯戌, 辰酉, 巳申, 午未
 * 지지 6충: 子午, 丑未, 寅申, 卯酉, 辰戌, 巳亥
 * 지지 삼합: 申子辰(水), 巳酉丑(金), 寅午戌(火), 亥卯未(木)
 * 지지 원진: 子未, 丑午, 寅酉, 卯申, 辰亥, 巳戌
 * 지지 귀문관살(鬼門關殺): 子酉, 丑午, 寅未, 卯申, 辰亥, 巳戌
 */
function computeCrossRelations(d1: any, d2: any): string {
  const ALL_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const GAN_HAP: Record<string, string> = {
    甲己: '토(土)', 己甲: '토(土)',
    乙庚: '금(金)', 庚乙: '금(金)',
    丙辛: '수(水)', 辛丙: '수(水)',
    丁壬: '목(木)', 壬丁: '목(木)',
    戊癸: '화(火)', 癸戊: '화(火)',
  };
  const GAN_CHUNG: Record<string, boolean> = {
    甲庚: true, 庚甲: true, 乙辛: true, 辛乙: true,
    丙壬: true, 壬丙: true, 丁癸: true, 癸丁: true,
  };
  const JI_HAP: Record<string, string> = {
    子丑: '土', 丑子: '土', 寅亥: '木', 亥寅: '木',
    卯戌: '火', 戌卯: '火', 辰酉: '金', 酉辰: '金',
    巳申: '水', 申巳: '水', 午未: '火/土', 未午: '火/土',
  };
  const JI_CHUNG: Record<string, boolean> = {
    子午: true, 午子: true, 丑未: true, 未丑: true,
    寅申: true, 申寅: true, 卯酉: true, 酉卯: true,
    辰戌: true, 戌辰: true, 巳亥: true, 亥巳: true,
  };
  const SAMHAP_GROUPS: Record<string, string[]> = {
    水局: ['申', '子', '辰'],
    金局: ['巳', '酉', '丑'],
    火局: ['寅', '午', '戌'],
    木局: ['亥', '卯', '未'],
  };
  const WONJIN: Record<string, boolean> = {
    子未: true, 未子: true, 丑午: true, 午丑: true,
    寅酉: true, 酉寅: true, 卯申: true, 申卯: true,
    辰亥: true, 亥辰: true, 巳戌: true, 戌巳: true,
  };
  const GWIMUN: Record<string, boolean> = {
    子酉: true, 酉子: true, 丑午: true, 午丑: true,
    寅未: true, 未寅: true, 卯申: true, 申卯: true,
    辰亥: true, 亥辰: true, 巳戌: true, 戌巳: true,
  };

  const labels = ['년주', '월주', '일주', '시주'];
  const findings: string[] = [];

  // 1. 일간 (day master) 관계 - 가장 중요
  const day1 = d1.pillars?.[2]?.천간 || '';
  const day2 = d2.pillars?.[2]?.천간 || '';
  if (day1 && day2) {
    const key = day1 + day2;
    if (GAN_HAP[key]) {
      findings.push(`★ 일간합: ${day1}+${day2} → ${GAN_HAP[key]} 화 (가장 강력한 결합 — 운명적 인연)`);
    } else if (GAN_CHUNG[key]) {
      findings.push(`⚠ 일간충: ${day1}↔${day2} (의견 충돌 잦음 — 다만 대체로 강한 인연)`);
    } else if (day1 === day2) {
      findings.push(`= 일간 동일: ${day1} (성향 비슷 · 다만 경쟁의 결도)`);
    }
  }

  // 2. 일지 (배우자궁) 관계
  const dayJi1 = d1.pillars?.[2]?.지지 || '';
  const dayJi2 = d2.pillars?.[2]?.지지 || '';
  if (dayJi1 && dayJi2) {
    const key = dayJi1 + dayJi2;
    if (JI_HAP[key]) {
      findings.push(`★ 일지합: ${dayJi1}+${dayJi2} → ${JI_HAP[key]} 화 (배우자궁 결합 — 깊은 정서적 연결)`);
    } else if (JI_CHUNG[key]) {
      findings.push(`⚠ 일지충: ${dayJi1}↔${dayJi2} (관계 변동·이별 가능성 — 거리 조절 필요)`);
    }
    if (WONJIN[key]) findings.push(`⚠ 일지원진: ${dayJi1}↔${dayJi2} (말 없는 미움 — 오해 누적 주의)`);
    if (GWIMUN[key]) findings.push(`⚠ 일지귀문: ${dayJi1}↔${dayJi2} (정신적 부담·감정 기복)`);
  }

  // 3. 8자 전체 cross 관계 (16 쌍)
  const cs1 = (d1.pillars || []).flatMap((p: any, i: number) => {
    if (p?.available === false) return [];
    return [{ ch: p.천간, label: labels[i], side: '천간' }, { ch: p.지지, label: labels[i], side: '지지' }];
  });
  const cs2 = (d2.pillars || []).flatMap((p: any, i: number) => {
    if (p?.available === false) return [];
    return [{ ch: p.천간, label: labels[i], side: '천간' }, { ch: p.지지, label: labels[i], side: '지지' }];
  });
  const ganHapCount: string[] = [];
  const ganChungCount: string[] = [];
  const jiHapCount: string[] = [];
  const jiChungCount: string[] = [];
  for (const a of cs1) {
    for (const b of cs2) {
      const key = a.ch + b.ch;
      if (a.side === '천간' && b.side === '천간') {
        if (GAN_HAP[key]) ganHapCount.push(`${a.label}-${b.label}(${a.ch}+${b.ch})`);
        else if (GAN_CHUNG[key]) ganChungCount.push(`${a.label}-${b.label}(${a.ch}↔${b.ch})`);
      } else if (a.side === '지지' && b.side === '지지') {
        if (JI_HAP[key]) jiHapCount.push(`${a.label}-${b.label}(${a.ch}+${b.ch})`);
        else if (JI_CHUNG[key]) jiChungCount.push(`${a.label}-${b.label}(${a.ch}↔${b.ch})`);
      }
    }
  }
  if (ganHapCount.length > 0) findings.push(`천간합: ${ganHapCount.join(', ')}`);
  if (ganChungCount.length > 0) findings.push(`천간충: ${ganChungCount.join(', ')}`);
  if (jiHapCount.length > 0) findings.push(`지지합: ${jiHapCount.join(', ')}`);
  if (jiChungCount.length > 0) findings.push(`지지충: ${jiChungCount.join(', ')}`);

  // 4. 두 사람 합쳐서 삼합 형성 가능성
  const allJi = [...cs1.filter((c: { side: string }) => c.side === '지지').map((c: { ch: string }) => c.ch), ...cs2.filter((c: { side: string }) => c.side === '지지').map((c: { ch: string }) => c.ch)];
  for (const [name, group] of Object.entries(SAMHAP_GROUPS)) {
    const has = group.filter((g) => allJi.includes(g));
    if (has.length === 3) findings.push(`★ 두 사람 합쳐서 삼합 ${name} (${has.join('+')}) 형성 — 강한 동반자 인연`);
    else if (has.length === 2) {
      // 어느 한쪽만 가졌는지 vs 양쪽이 다른 글자 가졌는지 체크
      const fromBoth = has.some((g) => cs1.some((c: { side: string; ch: string }) => c.side === '지지' && c.ch === g)) &&
                       has.some((g) => cs2.some((c: { side: string; ch: string }) => c.side === '지지' && c.ch === g));
      if (fromBoth) findings.push(`반합: 두 사람이 ${name} 의 ${has.join('+')} 보유 — 부분 결합`);
    }
  }

  // 5. 오행 보완 검사
  const e1 = d1.elements || {};
  const e2 = d2.elements || {};
  const lacking1 = (['목', '화', '토', '금', '수']).filter((k) => Number(e1[k] || 0) === 0);
  const lacking2 = (['목', '화', '토', '금', '수']).filter((k) => Number(e2[k] || 0) === 0);
  const complement1 = lacking1.filter((k) => Number(e2[k] || 0) >= 2);
  const complement2 = lacking2.filter((k) => Number(e1[k] || 0) >= 2);
  if (complement1.length > 0) findings.push(`★ 오행 보완: 사람1 부족한 ${complement1.join('·')} 을 사람2 가 채워줌`);
  if (complement2.length > 0) findings.push(`★ 오행 보완: 사람2 부족한 ${complement2.join('·')} 을 사람1 이 채워줌`);

  void ALL_GAN;
  return findings.length > 0
    ? findings.map((f) => `  - ${f}`).join('\n')
    : '  - 두 사주 간 합·충·삼합 모두 없음 (중성적 관계 — 적당한 거리)';
}

export async function generateCompatibilityAnalysis(apiKey: string, sajuData1: any, sajuData2: any, relation: string): Promise<any> {
  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt(sajuData1, sajuData2, relation);

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0.1, // 결정론적 — 같은 사주 = 같은 결과
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (msg.content[0] as any).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON 파싱 실패');
  return JSON.parse(jsonMatch[0]);
}

function personDetail(label: string, d: any): string {
  const p = d.pillars || [];
  const labels = ['년주', '월주', '일주', '시주'];
  let t = '';
  p.forEach((x: any, i: number) => { if (x.available !== false) t += `  ${labels[i]}: ${x.천간}(${x.천간읽기||''})${x.지지}(${x.지지읽기||''})\n`; });
  const el = d.elements || {};
  const sip = d.sipsung?.map((s: any) => `${s.위치}:${s.십성}`).join(', ') || '';
  return `### ${label}: ${d.input?.name||'미상'} (${d.input?.gender==='male'?'남':'여'})\n${t}  일간: ${p[2]?.천간||'미상'}\n  오행: 목${el.목||0} 화${el.화||0} 토${el.토||0} 금${el.금||0} 수${el.수||0}\n  십성: ${sip}`;
}

function buildPrompt(d1: any, d2: any, rel: string): string {
  const relLabels: Record<string, string> = { lover: '연인/배우자', friend: '친구', colleague: '직장동료', family: '가족', business: '사업파트너' };
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월`;

  // 정통 명리학 자동 산출 — AI 자유추론 X, 결정론적 입력
  const crossRelations = computeCrossRelations(d1, d2);

  return `명리학 40년 대가. "소름돋는" 궁합 분석.

⚠️ 현재 날짜: ${dateStr}
관계 유형: ${relLabels[rel] || rel || '두 사람'}

${personDetail('사람 1', d1)}

${personDetail('사람 2', d2)}

## ⚠️ 두 사주 간 정통 명리학 산출 결과 (반드시 이 결과를 근거로 분석)
${crossRelations}

## 위 자동 산출 결과 활용 규칙:
- ★ 표시 (합·삼합·오행보완): 강점·강한 인연으로 강조
- ⚠ 표시 (충·원진·귀문): 도전 과제 / 주의점으로 강조
- 일간/일지 합·충은 가장 무게 두기 (배우자궁·자아 본질)
- 산출 결과를 categories[].description 과 strengths/challenges 에 직접 반영
- AI 추가 해석은 위 결과 기반 — 임의 추론 금지

## ⭐ 소름 포인트 (각 카테고리 1개, 총 5개)
일상 패턴 묘사:
- "한 사람이 화나면 말을 안 하고, 다른 사람은 반대로 말이 많아지시죠?"
- "돈 쓰는 방식이 다를 거예요. 한 쪽은 저축형, 다른 쪽은 경험 투자형"
- "싸운 후 먼저 연락하는 사람이 항상 같은 쪽일 거예요"

## 출력 (JSON만, 코드블록 없이)
{
  "overallScore": 0-100,
  "relationshipType": "상호보완형/동지형/멘토형/열정형/안정형 중 하나",
  "keywords": ["#궁합키워드1","#키워드2","#키워드3"],
  "summary": "200자 이상. 두 사람의 관계 본질.",
  "categories": [
    {"id": "personality", "name": "성격 궁합", "score": 0-100, "description": "150자 이상"},
    {"id": "values", "name": "가치관 궁합", "score": 0-100, "description": "150자 이상"},
    {"id": "communication", "name": "소통 궁합", "score": 0-100, "description": "150자 이상"},
    {"id": "emotion", "name": "감정 궁합", "score": 0-100, "description": "150자 이상"},
    {"id": "future", "name": "미래 궁합", "score": 0-100, "description": "150자 이상"}
  ],
  "strengths": ["50자 이상씩 3개"],
  "challenges": ["50자 이상씩 3개"],
  "advice": "150자 이상. 실용적 조언.",
  "futureOutlook": "100자 이상. 향후 1~3년.",
  "ohengHarmony": {
    "person1Element": "오행", "person2Element": "오행",
    "relation": "상생/상극/비화", "description": "100자 이상"
  }
}

⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
}
