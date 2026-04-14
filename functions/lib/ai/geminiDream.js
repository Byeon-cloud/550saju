"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDreamInterpretation = generateDreamInterpretation;
exports.generateDeepDreamInterpretation = generateDeepDreamInterpretation;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        title: { type: generative_ai_1.SchemaType.STRING },
        interpretation: { type: generative_ai_1.SchemaType.STRING },
        luckyAction: { type: generative_ai_1.SchemaType.STRING },
        category: { type: generative_ai_1.SchemaType.STRING },
        verdict: { type: generative_ai_1.SchemaType.STRING },
        verdictScore: { type: generative_ai_1.SchemaType.NUMBER },
    },
};
/**
 * 꿈해몽 — Gemini 2.5 Flash (핵심 필드만 스키마)
 */
async function generateDreamInterpretation(apiKey, category, dreamText, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 },
    });
    const today = new Date();
    const month = today.getMonth() + 1;
    const dateStr = `${today.getFullYear()}년 ${month}월 ${today.getDate()}일`;
    const season = month <= 2 || month === 12 ? '겨울' : month <= 5 ? '봄' : month <= 8 ? '여름' : '가을';
    let sajuContext = '';
    if (sajuData?.pillars) {
        const p = sajuData.pillars;
        const el = sajuData.elements || {};
        const sipsung = sajuData.sipsung?.map((s) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
        const currentDaeun = sajuData.daeun?.find((d) => d.isCurrent || d.현재);
        const missing = Object.entries(el).filter(([, v]) => v === 0).map(([k]) => k);
        const excess = Object.entries(el).filter(([, v]) => v >= 3).map(([k, v]) => `${k}(${v}개)`);
        sajuContext = `## 이 사람의 사주 정보 (반드시 해석에 연결!)
이름: ${sajuData.input?.name || '미상'}, 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}
일간: ${p[2]?.천간 || '미상'}(${p[2]?.천간읽기 || ''})
오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
${missing.length ? `부족한 오행: ${missing.join(', ')} → 무의식이 꿈으로 보충하려 할 수 있음` : ''}
${excess.length ? `과다한 오행: ${excess.join(', ')} → 꿈에서 강렬하게 표현될 수 있음` : ''}
십성: ${sipsung || '미상'}
현재 대운: ${currentDaeun ? `${currentDaeun.간지}` : '미상'}`;
    }
    const prompt = `당신은 명리학 + 꿈 해석 40년 경력의 전문가입니다.

⚠️ 현재 날짜: ${dateStr} (${season})
→ "지금 이 시기에 이 꿈을 꾸셨다는 것은..." 형태로 시점을 반영하여 해석하세요.
→ 현재 계절/월운의 기운과 꿈의 상징을 연결하세요.

## 사용자 입력
- 카테고리: ${category}
- 꿈 내용: "${dreamText || '(카테고리 기반으로 해석)'}"

${sajuContext}

## 절대 규칙
- 사용자가 적은 꿈 내용의 키워드를 반드시 인용하면서 해석
- "돼지 꿈"이면 돼지에 대해 해석. 다른 상징으로 바꾸지 말 것
- 꿈 내용이 없으면 카테고리의 가장 흔한 꿈을 풍성하게 해석

## 길흉 판단 규칙 (무조건 길몽 금지!)
- 꿈의 상징은 맥락에 따라 길몽일 수도, 흉몽일 수도 있음. 균형 잡힌 해석 필수.
- interpretation 2단락에서 "다만, ~한 상황이었다면 주의가 필요해요" 형태로 흉몽 가능성 1가지 반드시 언급.
- 예시: "꿈에서 뱀이 도망갔다면 재물이 빠져나갈 수 있다는 경고입니다"
- 예시: "물이 탁했다면 감정적 혼란이나 건강 주의 신호일 수 있어요"
- 예시: "돼지가 아팠거나 다쳤다면 기대한 일이 지연될 수 있어요"
- verdictScore: 50 미만이면 "주의가 필요한 꿈", 30 미만이면 "경고의 꿈"으로 솔직하게 판정
- 전체 꿈이 불안하거나 공포스러운 내용이면 verdictScore를 30~50으로 설정하고 솔직하게 해석

## 각 필드 규칙

title: 6~12글자. 꿈의 핵심을 감성적으로 압축. 사용자 입력 키워드 포함.

interpretation: 반드시 600자 이상! 3단락으로 작성. 줄바꿈(\\n\\n)으로 구분.
  1단락(200자+): 꿈의 핵심 상징 해석. "꿈에서 보신 OO은..." 으로 시작. 명리학 오행 관점 분석.
  2단락(200자+): 현실 연결 + 소름 포인트. "혹시 요즘 ~한 상황이 아니신가요?" 형태 1~2개. ${sajuContext ? '사주 오행과 연결.' : ''} 현재 ${month}월(${season}) 시기의 기운과 연결.
  3단락(200자+): 이 꿈의 메시지. "지금 ${month}월은 ~한 시기이므로, 이 꿈은 ~를 의미합니다." 구체적 시점 언급. "앞으로 2~3주 내 변화가 올 수 있어요."

luckyAction: 80자 이상. 구체적 행동 1가지 + 오행 보충(색상, 방향, 시간대 중 2가지).
  예: "오늘 파란색 옷을 입고 동쪽으로 산책하세요. 수(水) 기운을 보충합니다."

category: 재물/기회, 관계/내면, 전환/성장, 경고/조심, 건강/에너지 중 1개

verdict: 20~30자. 한 줄 판정. 길흉 균형있게. 예: "재물과 기회가 찾아오는 길몽" / "전환기를 알리는 주의몽" / "내면의 경고를 담은 흉몽"

verdictScore: 1~100. 꿈 내용과 맥락에 따라 정직하게. 90+대길몽, 70-89길몽, 50-69보통, 30-49주의, 0-29흉몽. 무조건 높은 점수 금지!

⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log('[geminiDream] Response length:', text.length);
        const parsed = JSON.parse(text);
        // 빈 interpretation 방어
        if (!parsed.interpretation || parsed.interpretation.length < 50) {
            console.warn('[geminiDream] interpretation too short, using fallback');
            parsed.interpretation = `"${dreamText || category}" 꿈은 무의식에서 중요한 메시지를 보내고 있습니다.\n\n이 꿈의 상징은 현재 당신의 삶에서 전환이 필요한 영역을 가리키고 있어요. 명리학에서 꿈은 오행의 흐름이 무의식을 통해 표현되는 것으로 봅니다. 꿈에서 느꼈던 감정이 현실의 어떤 상황과 연결되는지 떠올려보세요.\n\n앞으로 2~3주 내에 이 꿈과 관련된 변화의 신호가 올 수 있습니다. 마음을 열고 주변을 관찰해보세요. 이 꿈은 끝이 아니라 새로운 시작을 알리는 신호입니다.`;
        }
        if (!parsed.luckyAction || parsed.luckyAction.length < 20) {
            parsed.luckyAction = '오늘은 자신의 내면에 집중하는 시간을 가져보세요. 조용한 곳에서 10분간 명상하면 꿈의 메시지를 더 선명하게 이해할 수 있어요.';
        }
        return parsed;
    }
    catch (err) {
        console.error('[geminiDream] Failed:', err.message);
        return {
            title: category,
            interpretation: `"${dreamText || category}" 꿈은 무의식에서 중요한 메시지를 보내고 있습니다.\n\n이 꿈의 상징은 현재 당신의 삶에서 전환이 필요한 영역을 가리키고 있어요. 명리학에서 꿈은 오행의 흐름이 무의식을 통해 표현되는 것으로 봅니다.\n\n앞으로 2~3주 내에 이 꿈과 관련된 변화의 신호가 올 수 있습니다. 마음을 열고 주변을 관찰해보세요.`,
            luckyAction: '오늘은 자신의 내면에 집중하는 시간을 가져보세요. 조용한 곳에서 10분간 명상하면 꿈의 메시지를 더 선명하게 이해할 수 있어요.',
            category: '전환/성장',
            verdict: '변화를 알리는 꿈',
            verdictScore: 65,
        };
    }
}
// ─────────────────────────────────────────────────────────
// 사주 연계 심층 해몽 (유료 1운) — 완전히 다른 프리미엄 분석
// ─────────────────────────────────────────────────────────
const deepResponseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        title: { type: generative_ai_1.SchemaType.STRING },
        overallScore: { type: generative_ai_1.SchemaType.NUMBER },
        grade: { type: generative_ai_1.SchemaType.STRING },
        verdict: { type: generative_ai_1.SchemaType.STRING },
        verdictScore: { type: generative_ai_1.SchemaType.NUMBER },
        keywords: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
        subScores: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                재물운: { type: generative_ai_1.SchemaType.NUMBER },
                애정운: { type: generative_ai_1.SchemaType.NUMBER },
                건강운: { type: generative_ai_1.SchemaType.NUMBER },
                성장운: { type: generative_ai_1.SchemaType.NUMBER },
                경고신호: { type: generative_ai_1.SchemaType.NUMBER },
            } },
        interpretation: { type: generative_ai_1.SchemaType.STRING },
        sajuConnection: { type: generative_ai_1.SchemaType.STRING },
        symbols: { type: generative_ai_1.SchemaType.ARRAY, items: {
                type: generative_ai_1.SchemaType.OBJECT,
                properties: {
                    keyword: { type: generative_ai_1.SchemaType.STRING },
                    oheng: { type: generative_ai_1.SchemaType.STRING },
                    meaning: { type: generative_ai_1.SchemaType.STRING },
                },
            } },
        ohengMessage: { type: generative_ai_1.SchemaType.STRING },
        timeline: { type: generative_ai_1.SchemaType.STRING },
        luckyAction: { type: generative_ai_1.SchemaType.STRING },
        luckyProfile: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                color: { type: generative_ai_1.SchemaType.STRING },
                colorHex: { type: generative_ai_1.SchemaType.STRING },
                number: { type: generative_ai_1.SchemaType.NUMBER },
                direction: { type: generative_ai_1.SchemaType.STRING },
                element: { type: generative_ai_1.SchemaType.STRING },
            } },
        category: { type: generative_ai_1.SchemaType.STRING },
    },
};
async function generateDeepDreamInterpretation(apiKey, category, dreamText, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: { responseMimeType: 'application/json', responseSchema: deepResponseSchema, maxOutputTokens: 65536 },
    });
    const today = new Date();
    const month = today.getMonth() + 1;
    const dateStr = `${today.getFullYear()}년 ${month}월 ${today.getDate()}일`;
    const season = month <= 2 || month === 12 ? '겨울' : month <= 5 ? '봄' : month <= 8 ? '여름' : '가을';
    // 사주 컨텍스트 (심층 — 더 풍부하게)
    const p = sajuData.pillars || [];
    const el = sajuData.elements || {};
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((x, i) => {
        if (x.available !== false)
            pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`;
    });
    const sipsung = sajuData.sipsung?.map((s) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
    const currentDaeun = sajuData.daeun?.find((d) => d.isCurrent || d.현재);
    const missing = Object.entries(el).filter(([, v]) => v === 0).map(([k]) => k);
    const excess = Object.entries(el).filter(([, v]) => v >= 3).map(([k, v]) => `${k}(${v}개)`);
    const prompt = `당신은 명리학 + 꿈 해석 40년 경력의 최고 전문가입니다.
이 분석은 유료(1운) 심층 해몽으로, 사주 원국과 꿈의 상징을 정밀하게 교차 분석해야 합니다.
무료 해몽과 확연히 다른, "돈 주고 본 보람 있다" 수준의 프리미엄 퀄리티를 제공하세요.

⚠️ 현재 날짜: ${dateStr} (${season})
→ 현재 계절/월운의 기운과 꿈의 상징을 연결하세요.

## 사용자의 꿈
- 카테고리: ${category}
- 꿈 내용: "${dreamText || '(카테고리 기반으로 해석)'}"

## 사주 원국 (핵심 — 반드시 꿈과 교차 분석!)
이름: ${sajuData.input?.name || '미상'}, 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}
${pillarsText}일간(나): ${p[2]?.천간 || '미상'}(${p[2]?.천간읽기 || ''})

오행 분포: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
${missing.length ? `부족한 오행: ${missing.join(', ')} → 무의식이 꿈으로 보충하려 할 수 있음` : ''}
${excess.length ? `과다한 오행: ${excess.join(', ')} → 꿈에서 강렬하게 표현될 수 있음` : ''}
십성 배치: ${sipsung || '미상'}
현재 대운: ${currentDaeun ? `${currentDaeun.간지} (${currentDaeun.시작나이 || currentDaeun.나이범위 || ''}세~)` : '미상'}

## 분석 규칙
1. 꿈의 모든 상징을 오행으로 분류 (뱀→화/금, 물→수, 나무→목, 불→화, 흙/돌→토 등)
2. 사주에서 부족하거나 과다한 오행이 꿈에서 어떻게 표현되었는지 정밀 분석
3. 현재 대운/월운이 꿈의 메시지에 어떤 영향을 미치는지 구체적으로
4. 일간의 성격 특성과 꿈의 감정이 어떻게 연결되는지
5. 길흉 판단은 반드시 균형있게 — 무조건 길몽 금지!

## 출력 필드 규칙

title: 8~15자. 사주 키워드 포함. "${p[2]?.천간읽기 || ''}일간이 꾸는 OO의 꿈" 같은 형태.

overallScore: 1-100. 사주 조화도 + 꿈의 길흉을 종합 평가.

grade: S(90+)/A(75-89)/B(60-74)/C(40-59)/D(39-)

verdict: 25~35자. 사주 연계 판정. "일간 ${p[2]?.천간읽기 || ''}에게 OO 기운 보충의 길몽" 형태.

keywords: 사주 기반 키워드 4개. ["#OO보충", "#재물신호", "#OO의봄", "#대운전환기"] 같은 형태.

subScores: 각 0-100. 이 꿈이 각 운세 영역에 대해 보내는 신호 강도.
  재물운: 재물/경제 관련 신호.
  애정운: 인간관계/연애 관련 신호.
  건강운: 건강/활력 관련 신호.
  성장운: 성장/기회/도전 관련 신호.
  경고신호: 주의/경계 신호 (높을수록 주의 필요).

interpretation: 800자 이상! 4단락. 줄바꿈(\\n\\n)으로 구분.
  1단락(200자+): 꿈 상징의 오행 분석. "꿈에서 보신 OO은 오행으로 OO에 해당하며..." 시작.
  2단락(200자+): 사주 원국과의 연결. "당신의 사주에서 OO이 N개로 (부족/과다)한데, 꿈에서 OO이 나타난 것은..." 소름 포인트 필수.
  3단락(200자+): 현재 대운/시기와 연결. "지금 ${month}월(${season})은 OO의 기운이 강한 시기이므로..."
  4단락(200자+): 종합 메시지 + 구체적 전망. "앞으로 2~3주 내 OO 분야에서..."

sajuConnection: 300자 이상. "당신의 사주에서 OO이 N개로 (과다/부족)한데, 꿈에서 OO이 나타난 것은..." 형태. 사주와 꿈의 직접적 인과관계를 명확히.

symbols: 3~5개 배열. 각 { keyword: "뱀", oheng: "화", meaning: "30자 이상 — 이 상징이 이 사주에게 의미하는 것" }.

ohengMessage: 100자 이상. "이 꿈은 당신의 부족한 OO(O) 기운이 무의식을 통해 보충을 요구하는 신호입니다. OO일간으로서..." 형태.

timeline: 150자 이상. "앞으로 2~3주 내 OO 분야에서 변화가..." 구체적 시기와 영역 명시.

luckyAction: 100자 이상. 사주 기반 구체적 행동 2가지 + 오행 보충법. "OO색 옷을 입고 OO 방향으로..."

luckyProfile: { color: "색상 한국어명", colorHex: "#hex", number: 1-99, direction: "동/서/남/북/동남 등", element: "보충할 오행 한 글자" }

category: 재물/기회, 관계/내면, 전환/성장, 경고/조심, 건강/에너지 중 1개

⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log('[geminiDream:deep] Response length:', text.length);
        const parsed = JSON.parse(text);
        // 필수 필드 방어
        if (!parsed.interpretation || parsed.interpretation.length < 100) {
            parsed.interpretation = `"${dreamText || category}" 꿈을 사주와 연계하여 분석합니다.\n\n이 꿈의 상징은 당신의 오행 분포와 깊은 관계가 있어요. 명리학에서 꿈은 오행의 흐름이 무의식을 통해 표현되는 것으로 봅니다.\n\n현재 대운의 기운과 맞물려 이 꿈은 중요한 전환의 신호를 보내고 있어요.\n\n앞으로 2~3주 내에 이 꿈과 관련된 변화의 신호가 올 수 있습니다.`;
        }
        if (!parsed.sajuConnection || parsed.sajuConnection.length < 50) {
            parsed.sajuConnection = '당신의 사주 원국과 이 꿈의 상징은 깊은 연관이 있습니다. 오행의 흐름이 무의식에서 꿈으로 표현되고 있어요.';
        }
        if (!parsed.symbols || parsed.symbols.length === 0) {
            parsed.symbols = [{ keyword: category, oheng: '토', meaning: '안정과 중심을 찾으려는 무의식의 표현' }];
        }
        if (!parsed.ohengMessage || parsed.ohengMessage.length < 30) {
            parsed.ohengMessage = '이 꿈은 현재 오행 에너지의 변화를 반영하고 있습니다.';
        }
        if (!parsed.timeline || parsed.timeline.length < 30) {
            parsed.timeline = '앞으로 2~3주 내에 이 꿈과 관련된 변화의 신호가 나타날 수 있습니다.';
        }
        if (!parsed.luckyProfile) {
            parsed.luckyProfile = { color: '노란색', colorHex: '#F5C518', number: 8, direction: '남', element: '토' };
        }
        return parsed;
    }
    catch (err) {
        console.error('[geminiDream:deep] Failed:', err.message);
        throw err; // 유료이므로 폴백 대신 에러 전파 → 프론트에서 환불 처리
    }
}
//# sourceMappingURL=geminiDream.js.map