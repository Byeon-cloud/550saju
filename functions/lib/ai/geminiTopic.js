"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPIC_CONFIGS = void 0;
exports.generateTopicAnalysisAI = generateTopicAnalysisAI;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        title: { type: generative_ai_1.SchemaType.STRING },
        grade: { type: generative_ai_1.SchemaType.STRING },
        gradeLabel: { type: generative_ai_1.SchemaType.STRING },
        overallScore: { type: generative_ai_1.SchemaType.NUMBER },
        summary: { type: generative_ai_1.SchemaType.STRING },
        sections: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    heading: { type: generative_ai_1.SchemaType.STRING },
                    content: { type: generative_ai_1.SchemaType.STRING },
                } } },
        timeline: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    period: { type: generative_ai_1.SchemaType.STRING },
                    score: { type: generative_ai_1.SchemaType.NUMBER },
                    description: { type: generative_ai_1.SchemaType.STRING },
                } } },
        luckyProfile: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                color: { type: generative_ai_1.SchemaType.STRING },
                direction: { type: generative_ai_1.SchemaType.STRING },
                number: { type: generative_ai_1.SchemaType.NUMBER },
                item: { type: generative_ai_1.SchemaType.STRING },
                bestMonth: { type: generative_ai_1.SchemaType.STRING },
            } },
        actionAdvice: { type: generative_ai_1.SchemaType.STRING },
    },
};
const TOPIC_CONFIGS = {
    love: {
        label: '연애운', emoji: '愛',
        sections: ['연애 스타일 분석', '이상형 프로필', '인연이 시작되는 시기', '연애 중 주의할 패턴', '올해 연애 흐름'],
        timelineLabel: '월별 연애 에너지',
        specificPrompt: `## 연애운 심층 분석 규칙
- 일지(배우자궁)의 오행+십성으로 이상형 구체 묘사 (직업, 성격, 외모 경향)
- 도화살(桃花殺) 유무 확인 → 매력의 원천 분석
- 현재 대운에서 연애 에너지가 강한 시기 특정 (월 단위)
- "첫 만남에서 이런 느낌이 들 사람이에요" 수준의 구체성
- 과거 연애 패턴 맞추기: "이전 연애에서 ~한 경험이 있었을 거예요"`,
    },
    wealth: {
        label: '재물운', emoji: '財',
        sections: ['돈 버는 스타일', '재물 흐름 분석', '투자 성향과 적기', '새는 돈 패턴', '올해 재물 전략'],
        timelineLabel: '월별 재물 흐름',
        specificPrompt: `## 재물운 심층 분석 규칙
- 재성(正財/偏財)의 위치와 강약으로 "정규직형 vs 사업형 vs 투자형" 판별
- 식신생재(食神生財) 구조 여부 → "내가 만든 것으로 돈을 버는" 패턴
- 겁재(劫財) 유무 → 돈이 새는 패턴 구체 묘사
- 월별 재물 점수 → "이 달에 큰 지출이 있을 수 있어요" 수준
- "통장 잔고가 이유 없이 줄어드는 느낌이 든다면..." 같은 소름 포인트`,
    },
    career: {
        label: '취업·이직운', emoji: '事',
        sections: ['적성 분석', '맞는 직종/업종', '이직 타이밍', '직장 내 인간관계', '올해 커리어 전략'],
        timelineLabel: '월별 커리어 에너지',
        specificPrompt: `## 취업·이직운 심층 분석 규칙
- 관성(正官/偏官)으로 직장 스타일 분석 (안정 vs 도전)
- 식상(食神/傷官)으로 표현력/창의력 평가 → 맞는 직종 5개 구체 제시
- 현재 대운이 이직에 유리한지 불리한지 명확히
- 면접 유리한 날짜/시간대까지 구체적으로
- "지금 직장에서 답답함을 느끼고 계시다면..." 같은 소름 포인트`,
    },
    marriage: {
        label: '결혼운', emoji: '婚',
        sections: ['결혼 적기 분석', '배우자 성향', '결혼 후 생활 패턴', '시댁/처가 관계', '결혼 준비 조언'],
        timelineLabel: '향후 3년 결혼 흐름',
        specificPrompt: `## 결혼운 심층 분석 규칙
- 일지(배우자궁) + 월지(부모궁) 관계로 시댁/처가 관계 예측
- 결혼 적기: 연도+시즌까지 ("2026년 가을~2027년 봄")
- 배우자 성향: 직업, 성격, 나이 차이 경향
- "결혼하면 경제권은 누가 쥘 가능성이 높아요"
- 이미 결혼했다면 → 관계 개선 포인트로 전환`,
    },
    business: {
        label: '사업운', emoji: '商',
        sections: ['사업가 기질 분석', '맞는 업종', '창업 타이밍', '동업 궁합', '사업 리스크 관리'],
        timelineLabel: '월별 사업 에너지',
        specificPrompt: `## 사업운 심층 분석 규칙
- 비겁(比肩/劫財) 강약 → 독립 사업 vs 프랜차이즈 vs 동업
- 식상생재 구조 → 콘텐츠/서비스업 적합도
- 관성이 약하면 → "자유로운 환경에서 빛나는 타입"
- 맞는 업종 5개 (구체적: "카페"가 아니라 "감성 브런치 카페, 위치는 역세권보다 골목상권")
- 창업 자금 운용 패턴: "초기 투자를 크게 vs 작게 시작"`,
    },
    health: {
        label: '건강운', emoji: '健',
        sections: ['오행별 취약 장기', '체질 분석', '올해 건강 주의 시기', '정신 건강 패턴', '건강 개선 전략'],
        timelineLabel: '월별 건강 에너지',
        specificPrompt: `## 건강운 심층 분석 규칙
- 오행 과다/부족 → 취약 장기 매핑 (목=간/눈, 화=심장/혈액, 토=위장/소화, 금=폐/피부, 수=신장/방광)
- 현재 대운에서 건강 주의 시기 월 단위로
- "최근 소화가 안 좋거나 피부 트러블이 있었다면..." 같은 소름 포인트
- 맞는 운동/식단/수면 패턴 (오행 기반)
- 정신 건강: 스트레스 패턴 + 해소법 (구체적)`,
    },
    reunion: {
        label: '재회운', emoji: '緣',
        sections: ['이별 원인 분석', '재회 가능성', '재회 적기', '재회 후 전망', '새 인연 vs 재회 비교'],
        timelineLabel: '향후 6개월 인연 흐름',
        specificPrompt: `## 재회운 심층 분석 규칙
- 일지의 형충파해 여부 → 이별의 사주적 원인
- 현재 대운이 과거 관계를 되살리는 에너지인지
- 재회 가능성을 % 수치로 (사주 근거 포함)
- "상대방도 비슷한 시기에 연락하고 싶은 충동을 느낄 수 있어요"
- 새 인연이 더 좋은 경우 솔직하게 안내 (단, 상처주지 않게)`,
    },
    study: {
        label: '학업·시험운', emoji: '學',
        sections: ['학습 스타일 분석', '집중력 패턴', '시험 합격 운', '공부 최적 시간대', '올해 학업 전략'],
        timelineLabel: '월별 학업 에너지',
        specificPrompt: `## 학업·시험운 심층 분석 규칙
- 인성(正印/偏印) 강약 → 학습 스타일 (암기형 vs 이해형 vs 응용형)
- 식상 강약 → 표현/발표 능력
- 시험 합격에 유리한 월/날짜 구체적으로
- "새벽 공부가 잘 되는 타입이에요" vs "저녁형" (사주 근거)
- 과목별 적성: "수리 영역이 강하고 언어 영역은 노력 필요"`,
    },
    social: {
        label: '대인관계운', emoji: '人',
        sections: ['관계 스타일 분석', '귀인운', '구설수 주의 시기', '인간관계 갈등 패턴', '올해 관계 전략'],
        timelineLabel: '월별 관계 에너지',
        specificPrompt: `## 대인관계운 심층 분석 규칙
- 비겁(比肩/劫財) → 친구/동료 관계 패턴
- 관성 → 윗사람/권위자와의 관계
- 귀인(天乙貴人 등) 유무 → 도움을 주는 사람의 특징
- "모임에서 항상 ~한 역할을 맡게 되시죠?" 같은 소름 포인트
- 올해 구설수/배신 주의 시기 월 단위로`,
    },
    moving: {
        label: '이사·이동운', emoji: '動',
        sections: ['이동 적기 분석', '좋은 방향', '이사/이직/유학 전망', '해외운', '올해 이동 전략'],
        timelineLabel: '월별 이동 에너지',
        specificPrompt: `## 이사·이동운 심층 분석 규칙
- 역마살(驛馬殺) 유무 → 이동이 잦은 명인지
- 현재 대운+올해 운에서 이동이 유리한 시기
- 방향: 오행 기반 좋은 방위 (목=동, 화=남, 금=서, 수=북)
- 이사/유학/해외취업 각각에 대한 구체적 조언
- "올해 안에 환경 변화가 있을 수 있어요" (시기 특정)`,
    },
};
exports.TOPIC_CONFIGS = TOPIC_CONFIGS;
async function generateTopicAnalysisAI(apiKey, topicId, sajuData) {
    const config = TOPIC_CONFIGS[topicId];
    if (!config)
        throw new Error(`알 수 없는 주제: ${topicId}`);
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 },
        thinkingConfig: { thinkingBudget: 0 },
    });
    const prompt = buildPrompt(config, sajuData);
    const r = await model.generateContent(prompt);
    return JSON.parse(r.response.text());
}
function buildPrompt(config, d) {
    const p = d.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((x, i) => {
        if (x.available !== false)
            pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`;
    });
    const el = d.elements || {};
    const sipsung = d.sipsung?.map((s) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
    const currentDaeun = d.daeun?.find((x) => x.isCurrent || x.현재);
    return `당신은 명리학 40년 대가입니다. "${config.label}" 심층 분석을 합니다.
"돈 주고 본 것 같아. 소름돋아." — 이 반응이 나올 정도로 구체적이고 개인화된 분석.

## 이 사람의 사주 원국
${pillarsText}일간(나): ${p[2]?.천간 || '미상'}

## 오행 분포
목(木): ${el.목 || 0}, 화(火): ${el.화 || 0}, 토(土): ${el.토 || 0}, 금(金): ${el.금 || 0}, 수(水): ${el.수 || 0}
${Object.entries(el).filter(([, v]) => v === 0).map(([k]) => `→ ${k} 없음 (주의)`).join('\n')}
${Object.entries(el).filter(([, v]) => v >= 3).map(([k, v]) => `→ ${k} ${v}개 과다`).join('\n')}

## 십성 배치
${sipsung || '미상'}

## 현재 대운
${currentDaeun ? `${currentDaeun.간지} (${currentDaeun.시작나이 || currentDaeun.나이범위 || ''}세~)` : '미상'}

## 기본 정보
이름: ${d.input?.name || '미상'}, 성별: ${d.input?.gender === 'male' ? '남' : '여'}

${config.specificPrompt}

## ⭐ 출력 규칙

### title
"${d.input?.name || ''}님의 ${config.label} 심층분석"

### grade & overallScore
- S(90+)/A(75+)/B(60+)/C(60미만)
- gradeLabel: "${config.label}" 맥락에 맞는 한줄 평가

### summary (200자 이상)
- 첫 문장에서 이 사람의 ${config.label} 핵심을 정의
- 소름 포인트 1개 포함 (일상 패턴 맞추기)
- 사주 근거를 자연스럽게 녹여서

### sections — ${config.sections.length}개 (각 content 150자 이상)
순서: ${config.sections.map((s, i) => `${i + 1}. "${s}"`).join(', ')}
- 각 섹션에서 사주 데이터 인용 (일간, 오행, 십성)
- 소름 포인트: 일상 행동 패턴 묘사 ("~하시는 편이시죠?")
- 구체적 조언: 날짜/시간/방향/색상 중 1개 이상

### timeline — ${config.timelineLabel}
- 6~12개 기간 (월 단위 또는 시즌 단위)
- 각 period: 시기 이름, score(1-10), 구체적 설명(60자+)
- 과거 기간: "~했을 가능성이 높습니다" (맞추기)
- 미래 기간: "~할 거예요" (구체적 예측)

### luckyProfile
- ${config.label}에 맞는 행운 아이템 (오행 기반 보충)

### actionAdvice (100자 이상)
- 지금 당장 할 수 있는 구체적 행동 1가지
- 오행 보충 방법 포함`;
}
//# sourceMappingURL=geminiTopic.js.map