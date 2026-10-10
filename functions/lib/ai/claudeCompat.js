"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCompatibilityAnalysis = generateCompatibilityAnalysis;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const promptsV3_1 = require("./promptsV3");
const promptsV3_2 = require("./promptsV3");
const kstTime_1 = require("../utils/kstTime");
const lunar_javascript_1 = require("lunar-javascript");
const sajuFacts_1 = require("./sajuFacts");
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
function computeCrossRelations(d1, d2) {
    const ALL_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const GAN_HAP = {
        甲己: '토(土)', 己甲: '토(土)',
        乙庚: '금(金)', 庚乙: '금(金)',
        丙辛: '수(水)', 辛丙: '수(水)',
        丁壬: '목(木)', 壬丁: '목(木)',
        戊癸: '화(火)', 癸戊: '화(火)',
    };
    const GAN_CHUNG = {
        甲庚: true, 庚甲: true, 乙辛: true, 辛乙: true,
        丙壬: true, 壬丙: true, 丁癸: true, 癸丁: true,
    };
    const JI_HAP = {
        子丑: '土', 丑子: '土', 寅亥: '木', 亥寅: '木',
        卯戌: '火', 戌卯: '火', 辰酉: '金', 酉辰: '金',
        巳申: '水', 申巳: '水', 午未: '火/土', 未午: '火/土',
    };
    const JI_CHUNG = {
        子午: true, 午子: true, 丑未: true, 未丑: true,
        寅申: true, 申寅: true, 卯酉: true, 酉卯: true,
        辰戌: true, 戌辰: true, 巳亥: true, 亥巳: true,
    };
    const SAMHAP_GROUPS = {
        水局: ['申', '子', '辰'],
        金局: ['巳', '酉', '丑'],
        火局: ['寅', '午', '戌'],
        木局: ['亥', '卯', '未'],
    };
    const WONJIN = {
        子未: true, 未子: true, 丑午: true, 午丑: true,
        寅酉: true, 酉寅: true, 卯申: true, 申卯: true,
        辰亥: true, 亥辰: true, 巳戌: true, 戌巳: true,
    };
    const GWIMUN = {
        子酉: true, 酉子: true, 丑午: true, 午丑: true,
        寅未: true, 未寅: true, 卯申: true, 申卯: true,
        辰亥: true, 亥辰: true, 巳戌: true, 戌巳: true,
    };
    const labels = ['년주', '월주', '일주', '시주'];
    const findings = [];
    // 1. 일간 (day master) 관계 - 가장 중요
    const day1 = d1.pillars?.[2]?.천간 || '';
    const day2 = d2.pillars?.[2]?.천간 || '';
    if (day1 && day2) {
        const key = day1 + day2;
        if (GAN_HAP[key]) {
            findings.push(`★ 일간합: ${day1}+${day2} → ${GAN_HAP[key]} 화 (가장 강력한 결합 — 운명적 인연)`);
        }
        else if (GAN_CHUNG[key]) {
            findings.push(`⚠ 일간충: ${day1}↔${day2} (의견 충돌 잦음 — 다만 대체로 강한 인연)`);
        }
        else if (day1 === day2) {
            findings.push(`= 일간 동일: ${day1} (성향 비슷, 다만 경쟁의 결도)`);
        }
    }
    // 2. 일지 (배우자궁) 관계
    const dayJi1 = d1.pillars?.[2]?.지지 || '';
    const dayJi2 = d2.pillars?.[2]?.지지 || '';
    if (dayJi1 && dayJi2) {
        const key = dayJi1 + dayJi2;
        if (JI_HAP[key]) {
            findings.push(`★ 일지합: ${dayJi1}+${dayJi2} → ${JI_HAP[key]} 화 (배우자궁 결합 — 깊은 정서적 연결)`);
        }
        else if (JI_CHUNG[key]) {
            findings.push(`⚠ 일지충: ${dayJi1}↔${dayJi2} (관계 변동과 이별 가능성 — 거리 조절 필요)`);
        }
        if (WONJIN[key])
            findings.push(`⚠ 일지원진: ${dayJi1}↔${dayJi2} (말 없는 미움 — 오해 누적 주의)`);
        if (GWIMUN[key])
            findings.push(`⚠ 일지귀문: ${dayJi1}↔${dayJi2} (정신적 부담과 감정 기복)`);
    }
    // 3. 8자 전체 cross 관계 (16 쌍)
    const cs1 = (d1.pillars || []).flatMap((p, i) => {
        if (p?.available === false)
            return [];
        return [{ ch: p.천간, label: labels[i], side: '천간' }, { ch: p.지지, label: labels[i], side: '지지' }];
    });
    const cs2 = (d2.pillars || []).flatMap((p, i) => {
        if (p?.available === false)
            return [];
        return [{ ch: p.천간, label: labels[i], side: '천간' }, { ch: p.지지, label: labels[i], side: '지지' }];
    });
    const ganHapCount = [];
    const ganChungCount = [];
    const jiHapCount = [];
    const jiChungCount = [];
    for (const a of cs1) {
        for (const b of cs2) {
            const key = a.ch + b.ch;
            if (a.side === '천간' && b.side === '천간') {
                if (GAN_HAP[key])
                    ganHapCount.push(`${a.label}-${b.label}(${a.ch}+${b.ch})`);
                else if (GAN_CHUNG[key])
                    ganChungCount.push(`${a.label}-${b.label}(${a.ch}↔${b.ch})`);
            }
            else if (a.side === '지지' && b.side === '지지') {
                if (JI_HAP[key])
                    jiHapCount.push(`${a.label}-${b.label}(${a.ch}+${b.ch})`);
                else if (JI_CHUNG[key])
                    jiChungCount.push(`${a.label}-${b.label}(${a.ch}↔${b.ch})`);
            }
        }
    }
    if (ganHapCount.length > 0)
        findings.push(`천간합: ${ganHapCount.join(', ')}`);
    if (ganChungCount.length > 0)
        findings.push(`천간충: ${ganChungCount.join(', ')}`);
    if (jiHapCount.length > 0)
        findings.push(`지지합: ${jiHapCount.join(', ')}`);
    if (jiChungCount.length > 0)
        findings.push(`지지충: ${jiChungCount.join(', ')}`);
    // 4. 두 사람 합쳐서 삼합 형성 가능성
    const allJi = [...cs1.filter((c) => c.side === '지지').map((c) => c.ch), ...cs2.filter((c) => c.side === '지지').map((c) => c.ch)];
    for (const [name, group] of Object.entries(SAMHAP_GROUPS)) {
        const has = group.filter((g) => allJi.includes(g));
        if (has.length === 3)
            findings.push(`★ 두 사람 합쳐서 삼합 ${name} (${has.join('+')}) 형성 — 강한 동반자 인연`);
        else if (has.length === 2) {
            // 어느 한쪽만 가졌는지 vs 양쪽이 다른 글자 가졌는지 체크
            const fromBoth = has.some((g) => cs1.some((c) => c.side === '지지' && c.ch === g)) &&
                has.some((g) => cs2.some((c) => c.side === '지지' && c.ch === g));
            if (fromBoth)
                findings.push(`반합: 두 사람이 ${name} 의 ${has.join('+')} 보유 — 부분 결합`);
        }
    }
    // 5. 오행 보완 검사
    const e1 = d1.elements || {};
    const e2 = d2.elements || {};
    const lacking1 = (['목', '화', '토', '금', '수']).filter((k) => Number(e1[k] || 0) === 0);
    const lacking2 = (['목', '화', '토', '금', '수']).filter((k) => Number(e2[k] || 0) === 0);
    const complement1 = lacking1.filter((k) => Number(e2[k] || 0) >= 2);
    const complement2 = lacking2.filter((k) => Number(e1[k] || 0) >= 2);
    if (complement1.length > 0)
        findings.push(`★ 오행 보완: 사람1 부족한 ${complement1.join(', ')} 을 사람2 가 채워줌`);
    if (complement2.length > 0)
        findings.push(`★ 오행 보완: 사람2 부족한 ${complement2.join(', ')} 을 사람1 이 채워줌`);
    void ALL_GAN;
    return findings.length > 0
        ? findings.map((f) => `  - ${f}`).join('\n')
        : '  - 두 사주 간 합, 충, 삼합 모두 없음 (중성적 관계 — 적당한 거리)';
}
async function generateCompatibilityAnalysis(apiKey, sajuData1, sajuData2, relation) {
    const anthropic = new sdk_1.default({ apiKey });
    const prompt = buildPrompt(sajuData1, sajuData2, relation);
    const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000, // 2026-09-16 — 8192 는 잘림 위험 구간(대운이 동일 값에서 파손). 천장만 상향(내용 불변).
        temperature: 0.1, // 결정론적 — 같은 사주 = 같은 결과
        messages: [{ role: 'user', content: prompt + promptsV3_1.TONE_FINAL_CHECK }],
    });
    const text = msg.content[0].text;
    // 2026-10-04 궁합 공개 — 공용 파서(코드블록·잘린 JSON 복구) + 출처·오기 한자·시간 표기 정리
    return (0, sajuFacts_1.sanitizeAiOutput)((0, promptsV3_2.parseJsonResponse)(text));
}
function personDetail(label, d) {
    const p = d.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let t = '';
    p.forEach((x, i) => { if (x.available !== false)
        t += `  ${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`; });
    const el = d.elements || {};
    const sip = d.sipsung?.map((s) => `${s.위치}:${s.십성}`).join(', ') || '';
    return `### ${label}: ${d.input?.name || '미상'} (${d.input?.gender === 'male' ? '남' : '여'})\n${t}  일간: ${p[2]?.천간 || '미상'}\n  오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}\n  십성: ${sip}`;
}
function buildPrompt(d1, d2, rel) {
    const relLabels = { lover: '연인/배우자', friend: '친구', colleague: '직장동료', family: '가족', business: '사업파트너' };
    const now = (0, kstTime_1.kstNow)();
    const dateStr = `${now.year}년 ${now.month}월`;
    // 정통 명리학 자동 산출 — AI 자유추론 X, 결정론적 입력
    const crossRelations = computeCrossRelations(d1, d2);
    // 2026-10-04 — futureOutlook '향후 1~3년' 의 연도 간지를 모델이 계산하지 않게 (주제분석 내년 월건 날조와 같은 위험)
    const yearsText = [0, 1, 2, 3].map((i) => {
        const y = now.year + i;
        try {
            return `${y}년 ${lunar_javascript_1.Solar.fromYmd(y, 6, 1).getLunar().getEightChar().getYear()}`;
        }
        catch {
            return `${y}년`;
        }
    }).join(', ');
    const relKo = relLabels[rel] || rel || '';
    const relLens = /이별/.test(relKo) ? '헤어진 사이 — 왜 엇갈렸는지(충과 원진 근거)와 다시 만난다면 서로 무엇이 달라져야 하는지. 재회 가능성과 시기 단정은 하지 말 것(재회운 영역).'
        : /썸/.test(relKo) ? '아직 시작 전인 사이 — 서로 끌리는 지점과 관계로 발전할 때 부딪힐 지점, 다가가는 방식.'
            : /연인/.test(relKo) ? '연인 — 끌림, 감정, 생활, 미래의 궁합.'
                : /배우자/.test(relKo) ? '부부 — 생활, 돈, 가족 역할에서의 궁합과 오래 함께하는 법.'
                    : /부모|자녀|형제|자매|가족/.test(relKo) ? '가족 — 연애 궁합 표현(인연과 끌림) 금지. 서로의 역할과 말이 통하는 방식과 서운함이 쌓이는 지점.'
                        : /친구/.test(relKo) ? '친구 — 연애 표현 금지. 함께 있을 때의 편안함과 서로 채워주는 점과 멀어지기 쉬운 지점.'
                            : /동료|사업/.test(relKo) ? '일로 만난 사이 — 연애 표현 금지. 일하는 방식과 역할 분담과 의견 충돌 시 푸는 법.'
                                : '연인 — 끌림, 감정, 생활, 미래의 궁합.';
    return `당신은 사주500 명리학 해석가. ${promptsV3_2.MYEONGRI_GROUNDS_BLOCK}

궁합 깊이 있는 분석 — 두 사주 글자에서 추출한 진짜 근거.

⚠️ 현재 날짜: ${dateStr}
관계 유형: ${relKo || '두 사람'}
관계 관점 (이 관점으로 5개 카테고리를 쓴다): ${relLens}
앞으로의 연도 간지 (futureOutlook 에서 연도를 쓸 땐 이 값만, 직접 계산 금지): ${yearsText}
🚨 성별 기준 (연인, 배우자, 썸, 이별일 때): 여성에게 연인과 남편의 별은 관성(일간을 극하는 오행), 남성에게 연인과 아내의 별은 재성(일간이 극하는 오행). 반대 성별 기준 풀이 금지.

${personDetail('사람 1', d1)}

${personDetail('사람 2', d2)}

## ⚠️ 두 사주 간 정통 명리학 산출 결과 (반드시 이 결과를 근거로 분석)
${crossRelations}

## 위 자동 산출 결과 활용 규칙:
- ★ 표시 (합, 삼합, 오행보완): 강점과 강한 인연으로 강조
- ⚠ 표시 (충, 원진, 귀문): 도전 과제 / 주의점으로 강조
- 일간/일지 합과 충은 가장 무게 두기 (배우자궁과 자아 본질)
- 산출 결과를 categories[].description 과 strengths/challenges 에 직접 반영
- AI 추가 해석은 위 결과 기반 — 임의 추론 금지

## ⭐ 소름 포인트 (각 카테고리 1개, 총 5개)
🚨 아래 예시 문장을 그대로 쓰지 말 것 — 형식만 참고하고, 두 사람의 실제 글자(위 산출 결과)에서 새 장면을 만든다. '항상과 언제나' 같은 절대 표현 금지.
일상 패턴 묘사 (형식 예시):
- "한 사람이 화나면 말을 안 하고, 다른 사람은 반대로 말이 많아지시죠?"
- "돈 쓰는 방식이 다를 거예요. 한 쪽은 저축형, 다른 쪽은 경험 투자형"
- "싸운 후 먼저 연락하는 사람이 항상 같은 쪽일 거예요"

## 출력 (JSON만, 코드블록 없이)
⚠️ **점수 필드 룰 (2026-05-04 PD 결단)**: 모든 score (categoryScores, subScores, overallScore, monthlyScore, compatScore, careerScore 등) 는 **5의 배수만 반복 금지**. 65, 70, 75, 80 같은 fake 신호 X. 67, 73, 81, 88 같이 자연수로 출력. 같은 카테고리 안 점수가 모두 다른 값이어야 함.

🚨 **톤 룰 (2026-05-05 PD 결단 — 외계어 X, 일상어 O)**

사용자 피드백:
> '무슨 말인지 모르겠다. 한낮의 태양이다 / 겨울 한복판에 태어난 태양이다 / 형국이다 — 이게 뭔 뜻이냐.
>  사주는 알아듣기 편하게 말해줘서 돈 주고 보는 거지, 어렵고 모호한 표현이면 돈 안 낸다.'

❌ **절대 금지 패턴**:
1. 시적 비유 폭격: '한낮의 태양' '차가운 밤 호수' '장작을 대주는 자리' '~의 형국' — 비유가 풀이를 대체 X.
2. 문어체 단어 남발: '결' '자리' '형국' 한 문단 2회 이내.
3. 중의적과 모호한 표현: '흐름이 풀리는 자리' → '30대 중반에 일이 잘 풀립니다'
   '준비된 결이 또렷' → '준비는 잘 되어 있어요' / '의식의 자리에 두십시오' → '꼭 신경 쓰세요'
4. 한자 폭격: 한자(丙火, 신금, 축미충 등) 첫 등장 1번만, 이후는 한글 또는 일상어.

📚 **"사주아이" 톤 레퍼 (참고, 모방 X, 우리 특색 살림)**:
1. **각 섹션 시작 = 일상어 결론 한 줄** (제목 후크 톤)
   ✅ '겉으로는 차분해 보이지만 속에는 따뜻함을 찾는 마음이 늘 움직이는 분입니다'
2. **사주 근거는 두 번째 문장부터, 한자는 1회만** + 즉시 일상어 풀이
3. **공감 + 위로 + 행동 처방** (가장 강력)
   ✅ '<strong>본인에게는 가혹한 잣대를 들이대요</strong>. 이제는 본인 행복을 위해 그 섬세함을 써보세요. <strong>완벽하지 않아도 충분히 가치 있는 사람입니다</strong>.'
4. **마무리 = 응원 + 구체 행동** (행운 색, 방위, 시기 등 구체)

🚨 **한자 풀이 형식 강제 (2026-05-05 PD 결단 — '라는 뜻' 같은 회피 X)**:
한자 등장 시 괄호 안에 **실제 일상어 풀이 텍스트** 동반:
✅ '병화(丙火, 밝고 활달한 성격)' / '신금(辛金, 깔끔하고 단정한 사람)' / '축미충(丑未沖, 가치관이 자주 흔들리는 자리)'
✅ '정관(正官, 책임감과 규범을 중요시하는 결)' / '도화살(桃花殺, 사람을 끌어당기는 매력)'
❌ '병화(丙火)' 단독 — 풀이 X
❌ '병화(丙火, 라는 뜻)' / '병화(丙火, 한자 그대로)' — 추상적 회피 X. 진짜 풀이 텍스트.
검증법: 한자 (괄호) 부분만 빼고 일상어만 읽었을 때 자연스러운 한국어 문장이 되어야 함.


✨ **우리만의 차별화**:
- 고전 근거는 내부 판단용 — 본문에 책 이름, 학파, '고서에 따르면' 언급 금지
- 결정론 (같은 사주 = 같은 결과)
- 한자 1회 등장 시 즉시 일상어 풀이 동반
- strong 강조는 유저 일상 결론에만
- 숫자와 시기 또렷이 ('30대 후반' '9월~2월')


🚨 **어조 (2026-10-08)**: "~할 수 있어요 / ~하기 쉬워요 / ~인 편이에요 / ~경향 / ~것 같아요" 금지 — 두 사주에 보이는 대로 단호하게.
   ❌ "말다툼이 생기기 쉬워요" → ✅ "돈 얘기만 나오면 두 사람 목소리가 높아집니다. 큰 지출은 하루 묵혔다 정하세요." (겁주기와 이별 단정 금지)

✅ **풀이 작성 규칙**:
- **첫 문장은 결론** ('{유저명} 님은 ~한 사람입니다')
- **비유는 한 번만, 즉시 결론 풀이** ('겨울에 태어난 태양 → 즉, ~한 사람')
- **한자 등장 직후 일상어 풀이 동반** ('병화(丙火) — 즉 밝고 활달한 성격')
- 단정 X / 모호 X / 중의 X — 그냥 직접 말하기.

✅ **변환 예시**:
- ❌ '도화살(桃花殺)이 강하게 작용합니다.'
- ✅ '<b>도화살(桃花殺)</b> — 즉 <strong>사람을 끌어당기는 매력</strong>이 강해요.'


🚨 **보일러플레이트 절대 금지 (2026-05-05 audit, 회귀 금지)**

동적 작용해야 하는 콘텐츠 = 두 사주 16글자마다 매번 다른 문장.

❌ 'X한 궁합입니다' / '서로 잘 맞아요' (근거 없는 일반론).
✅ 두 사주 cross-relations 직접 호명 — '갑목 일간 + 기토 일간 = 갑기합 토', '두 사람 일지 모두 인목 (성향 비슷)', '오미합 + 자축충'.
✅ 각 category.description / strengths / challenges 에 위 ## 정통 명리학 산출 결과 의 ★/⚠ 항목 또는 두 사람 8글자 중 specific 데이터(글자명, 일간, 일지, 오행보완) 1회 이상 직접 호명 mandatory.

🚨 **example 사용 룰 (회귀 금지)**:
프롬프트 예시의 사주 글자(병화, 신금, 축미충 등)는 example. 실제 사용자에게는 위 ## 사람 1 / ## 사람 2 의 진짜 16글자를 인용.
'{유저명}' placeholder 도 위 두 사람의 진짜 이름으로 치환.
같은 두 사주 = 같은 결과 (결정론) / 다른 두 사주 = 완전히 다른 어휘.


{
  "overallScore": 0-100,
  "relationshipType": "상호보완형/동지형/멘토형/열정형/안정형 중 하나",
  "keywords": ["#궁합키워드1","#키워드2","#키워드3"],
  "summary": "200자 이상. 두 사람의 관계 본질. 🚨 두 사주 cross-relations 1개 이상 직접 호명 mandatory.",
  "categories": [
    {"id": "personality", "name": "성격 궁합", "score": 0-100, "description": "150자 이상, 🚨 두 사람 일간/일지/십성 직접 호명"},
    {"id": "values", "name": "가치관 궁합", "score": 0-100, "description": "150자 이상, 🚨 두 사주 specific 호명"},
    {"id": "communication", "name": "소통 궁합", "score": 0-100, "description": "150자 이상, 🚨 두 사주 specific 호명"},
    {"id": "emotion", "name": "감정 궁합", "score": 0-100, "description": "150자 이상, 🚨 두 사주 specific 호명"},
    {"id": "future", "name": "미래 궁합", "score": 0-100, "description": "150자 이상, 🚨 두 사주 specific 호명"}
  ],
  "strengths": ["50자 이상씩 3개, 🚨 cross-relations ★ 항목 직접 호명"],
  "challenges": ["50자 이상씩 3개, 🚨 cross-relations ⚠ 항목 직접 호명"],
  "advice": "150자 이상. 실용적 조언.",
  "futureOutlook": "100자 이상. 향후 1~3년.",
  "ohengHarmony": {
    "person1Element": "오행", "person2Element": "오행",
    "relation": "상생/상극/비화", "description": "100자 이상"
  }
}

⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
}
//# sourceMappingURL=claudeCompat.js.map