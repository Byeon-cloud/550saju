// Migrated from geminiTopic.ts on 2026-04-15 (commit a5f7473) + 2026-04-19 (promptsV3 통합).
// See docs/prd/AI프롬프트_v3_Sonnet4.6.md
// 2026-04-22 SSOT v1 정렬:
//   - 키 rename 'moving' → 'move' (client src/constants/topics.ts 와 정렬)
//   - 'exam' 신규 (합격·이직운 — client 가 이미 /topic/exam 로 호출 중)
//   - TOPIC_BOUNDARIES 인접 주제 경계 프롬프트 주입 (모순 방지)
//   - normalizeTopicIdServer() 로 legacy 호출 'moving'/'reconciliation'/'job' 등 호환

import Anthropic from '@anthropic-ai/sdk';
import { TOPIC_ANALYSIS_SYSTEM_V3, SELF_REVIEW_V3, parseJsonResponse, type ParseJsonMeta } from './promptsV3';

interface TopicConfig {
  label: string;
  sections: string[];
  specificPrompt: string;
  topicDataSchema: string; // topic-specific structured data for visualization
}

/**
 * 인접 주제 경계 (2026-04-22 SSOT v1)
 *
 * 근거: docs/prd/주제별심층_10종_일관성SSOT_v1.md §2
 * 목적: 같은 사주 → 10주제 결과 모순 방지 (예: 합격이직이 창업 얘기를 하거나,
 *       연애운이 결혼 timing 을 단정하는 drift 차단).
 *
 * 각 주제 프롬프트 끝에 "다루지 않는 것 + 다른 주제로 보낼 영역" 을 명시 주입.
 */
const TOPIC_BOUNDARIES: Record<string, { scope: string; excludes: string[] }> = {
  love:     { scope: '일반 만남·관계 흐름·매력 발산·연애 패턴',
              excludes: ['결혼 timing/배우자 결 단정 (→ 결혼운 영역)', '헤어진 특정인과의 재회 가능성 (→ 재회운 영역)'] },
  reunion:  { scope: '헤어진 사람과의 재결합 가능성·timing·접촉 방향',
              excludes: ['일반 새 만남 (→ 연애운)', '결혼 결정 (→ 결혼운)'] },
  marriage: { scope: '결혼 timing·배우자 결·결혼 후 생활 패턴',
              excludes: ['연애 일반/썸 (→ 연애운)', '재회 결정 (→ 재회운)'] },
  wealth:   { scope: '돈의 결·투자·현금흐름·재물 timing',
              excludes: ['사업 결정/창업 판단 (→ 사업운)', '직장 수입 구조/승진 (→ 직업운)'] },
  exam:     { scope: '시험·자격증·이직·전직 변동의 timing 과 방향',
              excludes: ['평생 직업 적성/정체성 (→ 직업운)', '창업·자영업 결정 (→ 사업운)'] },
  business: { scope: '자영업·창업의 결·재무 리스크·사업 timing',
              excludes: ['직장인 커리어/승진 (→ 직업운)', '단기 시험·이직 timing (→ 합격이직운)'] },
  health:   { scope: '체질·기운·올해 주의 시기·생활 습관',
              excludes: [] },
  move:     { scope: '주거 이전·이동·여행 timing 과 방향',
              excludes: ['직장 이직 (→ 합격이직운)'] },
  study:    { scope: '학업·집중력·지식 흡수·학습 패턴',
              excludes: ['시험 합격 timing 단정 (→ 합격이직운)', '평생 직업 결 (→ 직업운)'] },
  career:   { scope: '평생의 일의 결·적성·승진 흐름·조직 내 패턴',
              excludes: ['시험·이직 timing (→ 합격이직운)', '자영업·창업 (→ 사업운)'] },
};

/**
 * 서버 topicId 정규화 — 클라이언트 SSOT 와 정렬.
 * legacy alias 도 처리해 구 client 호출 (moving, job 등) 이 깨지지 않도록 유지.
 */
const SERVER_TOPIC_ALIASES: Record<string, string> = {
  moving: 'move',
  reconciliation: 'reunion',
  job: 'career',
  company: 'career',
  marry: 'marriage',
  test: 'exam',
  exam_job: 'exam',
};
function normalizeTopicIdServer(raw: string): string {
  const v = String(raw || '').toLowerCase().trim();
  if (TOPIC_CONFIGS[v]) return v;
  if (SERVER_TOPIC_ALIASES[v]) return SERVER_TOPIC_ALIASES[v];
  return v; // 못 찾으면 원본 — generateTopicAnalysisAI 에서 throw
}

const TOPIC_CONFIGS: Record<string, TopicConfig> = {
  love: {
    label: '연애운',
    sections: ['나의 연애 스타일', '사주 궁합이 잘 맞는 이성', '인연이 시작되는 시기와 장소', '연애 중 반복되는 패턴', '올해 연애 흐름과 전략'],
    specificPrompt: `⭐ "와 진짜 내 얘기다" 반응이 나올 정도로 구체적으로.

- 일지 배우자궁(일지 지지)의 오행/십성 관계를 기반으로 사주 궁합이 잘 맞는 이성의 성향 구체 묘사
- "이상형"이 아니라 "사주적으로 궁합이 잘 맞는 이성의 특징"으로 서술할 것. 사주 근거를 반드시 포함.
- 도화살 유무 → 매력의 원천: "당신은 ~할 때 가장 매력적이에요"
- 연애 킬러 패턴: "매번 ~한 사람에게 끌리는데, 사주적으로 그 이유는..."
- 과거 연애 소름 포인트: "이전 연애에서 ~한 일이 있었을 거예요. 사주에서 보여요"
- 현재 대운 + 월운 → 인연 시작 시기 (월 단위): "양력 O~O월이 가장 유력"
- 어디서 만날 가능성이 높은지: 직장/소개/앱/모임 중 사주적으로 유리한 채널
- 올해 연애 전략: 구체적 행동 3가지

⚠️ topicData "궁합이 잘 맞는 이성" 주의사항:
- "이상형"이 아니라 "사주 궁합" 관점에서 서술. 각 항목에 왜 그런지 사주 근거를 한마디 포함.
- 예: "성격" → "일지 정관이 있어 원칙적이고 안정적인 성격과 궁합이 좋아요"
- 나이 차이는 절대 한 방향으로 단정하지 마. "연상과 궁합이 좋지만 연하와도 균형 잡힌 관계가 가능해요"처럼 양쪽 가능성 모두 언급.
- 직업/외모도 사주 근거를 기반으로 하되, 폭넓은 범위로 서술. 특정 직업 하나가 아니라 오행 성향에 맞는 직업군으로.

## 연애 상태별 분석 분기
- 상대방 정보가 제공된 경우(연애중): 실제 상대방의 사주를 추론하여 두 사람의 연애 궁합을 교차 분석. idealType 대신 실제 상대방 데이터를 반영. partnerCompat 필드를 반드시 채울 것.
- 썸 상태: 관심 대상에 대한 기초 궁합 분석. partnerCompat 채우되 compatScore에 "아직 확정 전"이라는 뉘앙스.
- 상대방 정보가 없는 경우(솔로): 사주 원국에서 이상적 상대를 추론. partnerCompat은 null로.`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"매력발산","value":"0-100 정수"},{"axis":"소통능력","value":"0-100 정수"},{"axis":"감성깊이","value":"0-100 정수"},{"axis":"안정감","value":"0-100 정수"},{"axis":"인연운","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["연애 강점 25자","연애 강점2 25자"],
      "cautions": ["연애 주의점 25자","연애 주의점2 25자"],
      "idealType": {"personality": "궁합 좋은 성격 경향 + 사주 근거 한마디 (35자)", "job": "궁합 좋은 직업군 경향 + 오행 근거 (25자)", "ageGap": "나이차 경향 — 반드시 양쪽 가능성 언급 (25자)", "meetPlace": "만남 장소 경향 15자", "appearance": "외모/분위기 경향 20자"},
      "charmPoint": "나의 사주적 매력 포인트 — 사주 근거 포함 (40자)",
      "loveStyle": "연애 스타일 명칭 10자 (올인형/신중형/자유형 등)",
      "doHwaSal": true 또는 false,
      "attractionSource": "사주적 매력의 원천 — 오행/십성 근거 (25자)",
      "bestMeetMonth": "인연 시작 유력 시기 (예: 7~9월)",
      "partnerCompat": "상대방 정보가 있을 때만 채움. 없으면 null. 있으면 아래 구조:" 또는 null,
      "partnerCompat(상대방 있을 때)": {
        "partnerOheng": "상대방 추정 주 오행 (목/화/토/금/수)",
        "partnerIlgan": "상대방 추정 일간 한자 (甲/乙/丙/丁 등)",
        "compatScore": "0-100 정수 (연애 궁합 종합 점수)",
        "pillarComparison": {
          "myPillars": {
            "year": {"cheongan": "천간 한자", "jiji": "지지 한자", "oheng": "오행"},
            "month": {"cheongan": "천간 한자", "jiji": "지지 한자", "oheng": "오행"},
            "day": {"cheongan": "천간 한자", "jiji": "지지 한자", "oheng": "오행"}
          },
          "partnerPillars": {
            "year": {"cheongan": "천간 추론", "jiji": "지지 추론", "oheng": "오행"},
            "month": {"cheongan": "천간 추론", "jiji": "지지 추론", "oheng": "오행"},
            "day": {"cheongan": "천간 추론", "jiji": "지지 추론", "oheng": "오행"}
          },
          "interactions": [
            {"position": "년주/월주/일주", "type": "합/충/형/해/상생/상극", "desc": "의미 20자"}
          ]
        },
        "matchPoints": ["잘 맞는 점 + 사주 근거 30자", "잘 맞는 점2 30자"],
        "clashPoints": ["안 맞는 점 + 사주 근거 30자"],
        "loveChemistry": "두 사람의 연애 궁합 핵심 한 줄 35자",
        "partnerLoveStyle": "상대방의 연애 스타일/가치관 요약 25자"
      }
    }`,
  },
  wealth: {
    label: '재물운',
    sections: ['돈 버는 스타일', '재물 흐름 분석', '투자 성향과 적기', '새는 돈 패턴', '올해 재물 전략'],
    specificPrompt: `⭐ 돈에 대한 "소름돋는" 통찰. 읽는 사람이 "맞아, 나 그래..." 할 정도로.

- 재성(正財/偏財) 위치와 강약으로 "정규직형 vs 사업형 vs 투자형" 판별
- 식신생재 구조 여부 → 재능으로 돈 버는 구조인지
- 겁재 유무 → 돈 새는 패턴: "~에 충동적으로 돈을 쓰는 경향"
- 월별 재물 점수 + "이 달에 큰 지출이 있을 수 있어요"
- 투자 적기와 위험 시기 구체적으로
- "혹시 ~에 큰 돈을 쓴 적 있지 않나요?" 소름 포인트

🔥 **재물 구조 깊이 분석 (audit 1 P0-6 — 6대 원전 정통 룰)**:
- **재성 강약 × 일간 강약 4분면 분석** (필수 적용):
  · 신강 + 재성왕 = 재물 활용 능숙형 (가장 좋음 — 돈을 부리는 사람)
  · 신강 + 재성약 = 재성 보강 필요 (대운 재성 시기 기다림 — 큰 돈은 후반)
  · 신약 + 재성왕 = 재다신약(財多身弱) (돈에 짓눌림 — 인성 보강으로 일간 키워야)
  · 신약 + 재성약 = 그릇 작은 구조 (식상생재 보완 — 재능·기술로 점진 축적)
- **군겁쟁재(群劫爭財)**: 비겁 ≥ 3 + 재성 ≤ 1 이면 명시 → "재물을 동업·가족·친구와 나누게 되는 패턴. 단, 공동 사업·분산 명의로 전환하면 오히려 시너지 구조."
- **식신생재(食神生財)**: 식신/상관 + 재성 인접 시 → "재능·아이디어로 돈 버는 가장 좋은 구조 — 본업 외 부업·콘텐츠·강의 등 식상 발휘 채널이 핵심."
- **정재 vs 편재 구분**: 정재형(안정 수익·봉급·임대) vs 편재형(변동 수익·사업·투자·중개) — 어느 쪽이 더 큰지 명시.
- **조후용신**: 출생 월령(겨울/여름)별 재물 운용에 필요한 오행 명시 (한·습 사주는 火·土 가 재고용신 / 조·열 사주는 水·金 이 재고용신).
- **인용 — 적천수**: "재성왕(財星旺)이면 식신을 좋아하고 비겁을 꺼린다(財旺喜食神 忌比劫)" 자연스럽게 1회 인용 권장.
- **인용 — 자평진전**: "재격(財格)은 신강을 가장 좋아한다(財格最喜身強)" 등 1회 가능.`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"수익력","value":"0-100 정수"},{"axis":"저축력","value":"0-100 정수"},{"axis":"투자감각","value":"0-100 정수"},{"axis":"사업운","value":"0-100 정수"},{"axis":"횡재운","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["재물 강점 25자","재물 강점2 25자"],
      "cautions": ["재물 주의점 25자","재물 주의점2 25자"],
      "wealthType": "정규직형/사업형/투자형/재테크형 중 하나",
      "earningPower": 0-100 정수,
      "savingPower": 0-100 정수,
      "spendingRisk": 0-100 정수,
      "investStyle": "투자 성향 20자",
      "jaeseongType": "정재형/편재형/식신생재형/겁재과다형 중 하나",
      "jaeseongDesc": "재성 구조가 돈 버는 방식에 미치는 실질적 영향 40자",
      "wealthPeakPeriod": "재물 전성기 나이대 (예: 35~42세)",
      "bestInvestMonth": "올해 투자 적기 (예: 3~5월)",
      "dangerMonths": "지출 폭증/손실 주의 월 (예: 3월, 8월)",
      "moneyLeakTrap": "돈 새는 핵심 함정 20자",
      "moneyLeakDesc": "돈 새는 패턴의 구체적 설명 + 사주 근거 40자",
      "wealthFlow": "상반기강세/하반기강세/꾸준형/변동형 중 하나",
      "monthlyWealth": [
        {"month": "1월", "score": "0-100 정수"},
        {"month": "2월", "score": "0-100 정수"},
        {"month": "3월", "score": "0-100 정수"},
        {"month": "4월", "score": "0-100 정수"},
        {"month": "5월", "score": "0-100 정수"},
        {"month": "6월", "score": "0-100 정수"},
        {"month": "7월", "score": "0-100 정수"},
        {"month": "8월", "score": "0-100 정수"},
        {"month": "9월", "score": "0-100 정수"},
        {"month": "10월", "score": "0-100 정수"},
        {"month": "11월", "score": "0-100 정수"},
        {"month": "12월", "score": "0-100 정수"}
      ]
    }`,
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
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"직무적성","value":"0-100 정수"},{"axis":"대인관계","value":"0-100 정수"},{"axis":"리더십","value":"0-100 정수"},{"axis":"타이밍","value":"0-100 정수"},{"axis":"면접력","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["커리어 강점 25자","커리어 강점2 25자"],
      "cautions": ["커리어 주의점 25자","커리어 주의점2 25자"],
      "workStyle": "안정형/도전형/프리랜서형/창업형 중 하나",
      "careerFit": [{"job": "직종명", "fitPercent": 0-100}, {"job": "직종명", "fitPercent": 0-100}, {"job": "직종명", "fitPercent": 0-100}, {"job": "직종명", "fitPercent": 0-100}, {"job": "직종명", "fitPercent": 0-100}],
      "interviewTip": "면접 팁 30자",
      "interviewDay": "면접 유리 요일 (예: 화, 목)",
      "interviewTime": "면접 유리 시간대 (예: 오전 10~11시)",
      "salaryTiming": "연봉 협상 적기 (예: 4월, 9월)",
      "bossCompat": "잘 맞는 상사 유형 20자",
      "statusAnalysis": "현재 상태(학생/구직/재직)에 대한 사주 한마디 35자 (상태 정보 없으면 null)",
      "fieldFitScore": "관심 분야 사주 적합도 0-100 (분야 정보 없으면 null)",
      "fieldFitAnalysis": "관심 분야가 사주에 얼마나 맞는지 분석 35자 (분야 정보 없으면 null)",
      "jobChangeTiming": "이직 최적 시기 15자 (재직중일 때만, 아니면 null)"
    }`,
  },
  marriage: {
    label: '결혼운',
    sections: ['결혼 적기 분석', '배우자 성향', '결혼 후 생활 패턴', '시댁/처가 관계', '결혼 준비 조언'],
    specificPrompt: `⭐ 결혼을 고민하는 사람에게 "소름돋는" 수준의 구체적 조언.

- 일지+월지 관계로 시댁/처가 관계 예측: "~한 분위기의 가정"
- 결혼 적기: 연도+시즌까지 구체적으로
- 배우자 성향: 직업, 성격, 나이 차이 경향
- 결혼 후 갈등 패턴과 해결법
- "혹시 ~한 사람과 교제 중이거나 관심 있는 사람이 있나요?" 소름 포인트

## 연애 상태별 분석 분기
- 상대방 정보가 제공된 경우(연애중): 실제 상대방의 사주를 추론하여 두 사람의 궁합을 교차 분석. spouseProfile 대신 실제 상대방 데이터를 반영. partnerCompat 필드를 반드시 채울 것.
- 상대방 정보가 없는 경우(솔로): 사주 원국에서 배우자상을 추론. partnerCompat은 null로.`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"배우자복","value":"0-100 정수"},{"axis":"결혼시기","value":"0-100 정수"},{"axis":"가정안정","value":"0-100 정수"},{"axis":"시댁관계","value":"0-100 정수"},{"axis":"재물복","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["결혼 강점 25자","결혼 강점2 25자"],
      "cautions": ["결혼 주의점 25자","결혼 주의점2 25자"],
      "spouseProfile": {"personality": "성격 20자", "job": "직업군 15자", "ageGap": "나이차 10자", "meetStyle": "만남경로 10자"},
      "timing": {"bestPeriod": "최적시기 15자", "urgency": "높음/보통/여유 중 하나"},
      "marriageAge": "결혼 적령기 (예: 29~32세)",
      "conflictPattern": "부부 핵심 갈등 패턴 20자",
      "inlawsCompat": "좋음/보통/주의 중 하나",
      "weddingLuckMonth": "결혼식 유리 월 (예: 5월, 10월)",
      "partnerCompat": "상대방 정보가 있을 때만 채움. 없으면 null. 있으면 아래 구조:" 또는 null,
      "partnerCompat(상대방 있을 때)": {
        "partnerOheng": "상대방 추정 주 오행 (목/화/토/금/수)",
        "partnerIlgan": "상대방 추정 일간 한자 (甲/乙/丙/丁 등)",
        "compatScore": "0-100 정수 (궁합 종합 점수)",
        "pillarComparison": {
          "myPillars": {
            "year": {"cheongan": "천간 한자", "jiji": "지지 한자", "oheng": "오행"},
            "month": {"cheongan": "천간 한자", "jiji": "지지 한자", "oheng": "오행"},
            "day": {"cheongan": "천간 한자", "jiji": "지지 한자", "oheng": "오행"}
          },
          "partnerPillars": {
            "year": {"cheongan": "천간 추론", "jiji": "지지 추론", "oheng": "오행"},
            "month": {"cheongan": "천간 추론", "jiji": "지지 추론", "oheng": "오행"},
            "day": {"cheongan": "천간 추론", "jiji": "지지 추론", "oheng": "오행"}
          },
          "interactions": [
            {"position": "년주/월주/일주", "type": "합/충/형/해/상생/상극", "desc": "의미 20자"}
          ]
        },
        "matchPoints": ["잘 맞는 점 + 사주 근거 30자", "잘 맞는 점2 30자"],
        "clashPoints": ["안 맞는 점 + 사주 근거 30자"],
        "marriageChemistry": "두 사람의 결혼 궁합 핵심 한 줄 35자",
        "partnerMarriageStyle": "상대방의 결혼관/가치관 요약 25자"
      }
    }`,
  },
  business: {
    label: '사업운',
    sections: ['사업가 기질 분석', '맞는 업종', '창업 타이밍', '동업 궁합', '사업 리스크 관리'],
    specificPrompt: `⭐ 사업을 꿈꾸는 사람에게 현실적이고 구체적인 조언.

- 비겁 강약 → 독립 vs 프랜차이즈 vs 동업 판별
- 맞는 업종 5개 (구체적 업종명)
- 창업 자금 운용 패턴
- 동업 시 주의할 사주적 궁합
- 실패 리스크와 대비 전략`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"사업감각","value":"0-100 정수"},{"axis":"리더십","value":"0-100 정수"},{"axis":"자금운용","value":"0-100 정수"},{"axis":"네트워크","value":"0-100 정수"},{"axis":"위기대응","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["사업 강점 25자","사업 강점2 25자"],
      "cautions": ["사업 주의점 25자","사업 주의점2 25자"],
      "businessType": "독립창업/프랜차이즈/동업/투자형 중 하나",
      "fitIndustries": [{"name": "업종명", "fitPercent": 0-100}, {"name": "업종명", "fitPercent": 0-100}, {"name": "업종명", "fitPercent": 0-100}, {"name": "업종명", "fitPercent": 0-100}, {"name": "업종명", "fitPercent": 0-100}],
      "partnerAdvice": "동업 조언 30자",
      "startupReadiness": 0-100 정수,
      "riskLevel": "높음/보통/낮음 중 하나",
      "bestPartnerOheng": "동업자 맞는 오행 (예: 금, 수)",
      "bestStartMonth": "창업 최적 시기 (예: 3~5월)",
      "currentBizPhase": "성장기/안정기/전환기/위기기 중 하나 (운영중일 때만, 아니면 null)",
      "openingAnalysis": "개업 시점의 사주적 분석 40자 (개업 시기 있을 때만, 아니면 null)",
      "bizHealthScore": "현재 사업 건강도 0-100 (운영중일 때만, 아니면 null)",
      "nextPhaseAdvice": "다음 사업 단계 전략 조언 35자 (운영중일 때만, 아니면 null)"
    }`,
  },
  health: {
    label: '건강운',
    sections: ['오행별 취약 장기', '체질 분석', '올해 건강 주의 시기', '정신 건강 패턴', '건강 개선 전략'],
    specificPrompt: `⭐ 오행 분석을 통해 취약 장기를 구체적으로 매핑. "이거 진짜 맞아..." 반응.

- 오행 과다/부족 → 취약 장기 매핑 (목=간/담, 화=심장/소장, 토=위/비장, 금=폐/대장, 수=신장/방광)
- 각 장기별 위험도를 0-100 수치로 평가
- 맞는 운동/식단/수면 패턴
- 정신 건강: 스트레스 패턴 + 해소법
- "혹시 ~에 통증이나 불편함을 느끼지 않나요?" 소름 포인트`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"체력","value":"0-100 정수"},{"axis":"정신건강","value":"0-100 정수"},{"axis":"면역력","value":"0-100 정수"},{"axis":"회복력","value":"0-100 정수"},{"axis":"장수운","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["건강 강점 25자","건강 강점2 25자"],
      "cautions": ["건강 주의점 25자","건강 주의점2 25자"],
      "organStatus": [
        {"element": "목", "organ": "간/담", "status": "양호/주의/경고 중 하나", "risk": 0-100},
        {"element": "화", "organ": "심장/소장", "status": "양호/주의/경고 중 하나", "risk": 0-100},
        {"element": "토", "organ": "위/비장", "status": "양호/주의/경고 중 하나", "risk": 0-100},
        {"element": "금", "organ": "폐/대장", "status": "양호/주의/경고 중 하나", "risk": 0-100},
        {"element": "수", "organ": "신장/방광", "status": "양호/주의/경고 중 하나", "risk": 0-100}
      ],
      "bodyType": "체질명 15자",
      "bestExercise": "추천 운동 20자",
      "cautionMonths": "건강 주의 월 (예: 3월, 8월)",
      "bestSleepTime": "최적 수면 시간대 (예: 밤 10시~새벽 6시)",
      "mentalStressType": "스트레스 유형 15자 (예: 완벽주의형 과부하)",
      "dietAdvice": "체질별 식단 조언 20자"
    }`,
  },
  reunion: {
    label: '재회운',
    sections: [
      '이별의 사주적 원인 분석',
      '상대방의 사주 성향 분석',
      '두 사람의 오행 궁합 구조',
      '전통 연애 신살(神殺) 분석',
      '재회 가능성과 적기',
      '월별 재회 에너지 흐름',
      '재회 실전 전략',
      '재회 후 관계 변화 예측',
      '새 인연 vs 재회 — 냉정한 비교',
      '재회 성공을 위한 개운법',
    ],
    specificPrompt: `⭐ 이 분석은 "울컥할 정도로 소름돋는" 최고 퀄리티여야 합니다.
다른 주제 분석과 확연히 차이가 나는 깊이와 정교함이 필요합니다.

## 분석 원칙
- 명리학 전통 이론(형충파해, 원진, 삼합, 육합, 도화살, 홍염살 등)을 철저히 활용
- 상대방 사주를 생년월일 기반으로 추론하여 두 사주의 교차 분석 수행
- "혹시 ~하지 않았나요?" 형태의 소름 포인트 매 섹션마다 1개 이상 필수
- 사주 전문 용어(한자 병기)를 자연스럽게 포함하되, 쉽게 설명
- ⚠️ 각 섹션의 content는 핵심만 간결하게. 한 섹션 150~250자. 불필요한 반복/서론 금지.

## 섹션별 지침

1. "이별의 사주적 원인 분석"
- 일지 형충파해(刑沖破害) + 대운/세운 충돌로 이별의 사주적 필연성 분석
- 이별 시점의 대운 변화가 관계에 미친 영향
- 원진살(怨嗔殺) 해당 여부 → 감정적 소원함의 근본 원인
- 구체적 상황 묘사: "당시 서로 ~한 상황에서 ~했을 거예요"
- 헤어진 기간이 주어지면: 그 기간 동안의 에너지 변화도 분석

2. "상대방의 사주 성향 분석"
- 상대방의 생년월일로 일간/오행 경향 추론
- 연애/이별에서의 성격 패턴: "이 사람은 ~한 상황에서 ~하는 타입"
- 현재 감정 상태를 대운/세운 흐름으로 추론
- 상대방이 재회를 원하는 정도를 사주적으로 분석

3. "두 사람의 오행 궁합 구조"
- 두 사람의 오행 비율 비교 → 보완 관계인지 충돌 관계인지
- 천간합(天干合) 해당 여부 확인 → 끌림의 근거
- 지지합(地支合: 육합/삼합) 해당 여부 → 관계의 안정성
- 궁합 점수를 5개 축(오행 조화/성격 궁합/감정 교류/가치관 일치/미래 비전)으로 산출
- 점수마다 사주 근거 한마디씩

4. "전통 연애 신살(神殺) 분석"
- 도화살(桃花殺): 매력의 원천. 있으면 어떤 매력인지, 없으면 어떤 식으로 어필하는지
- 홍염살(紅艶殺): 강렬한 연애 에너지. 재회 관계에서의 영향
- 원진살(怨嗔殺): 원망/소원함의 구조. 두 사람 사이에 해당하는지
- 천을귀인(天乙貴人): 귀인의 도움으로 재회 가능성이 있는지
- 삼합(三合)/육합(六合): 지지 조합에서 화합 구조가 있는지
- 각 신살의 유무 + 구체적 영향 설명 (단순히 있다/없다가 아닌 관계에 미치는 영향)

🔥 **자리 호명 mandate (audit 1 P0-5)**:
- 각 신살이 "당신 사주 자리(년/월/일/시지)" + "상대방 사주 자리" 어느 글자 조합에서 성립하는지 명시.
- 예: "당신 일지 卯 + 상대 일지 酉 → 卯酉沖. 두 사람 핵심 갈등은 ~"
- 예: "당신 월지 子 + 상대 일지 卯 → 子卯刑. 감정 소모 패턴은 ~"
- 단순 "도화살이 있다" 가 아니라 "당신 일지 午 도화 + 상대 년지 戌 → 도화 작동 자리" 식 자리 명시.

5. "재회 가능성과 적기"
- 재회 가능성을 % 수치 + 3가지 이상 사주 근거
- 대운/세운에서 인성/식상이 오는 시기를 재회 적기로 분석
- 양력 월 단위: "양력 O월~O월 사이 연락이 올 수 있어요"
- 어떤 계기로 재회가 시작될지 구체적 시나리오

6. "월별 재회 에너지 흐름"
- 올해 12개월 동안의 나의 에너지/상대 에너지/재회 확률 변화를 수치로
- 에너지가 높은 달에 무엇을 해야 하는지
- 에너지가 낮은 달에 피해야 할 것
- 월운(月運) 기반 분석

7. "재회 실전 전략"
- 4~5단계 구체적 행동 전략 (시기/방법/주의사항 포함)
- 연락 방법: SNS/전화/만남 중 사주적으로 유리한 채널
- 첫 연락 문구 뉘앙스까지 조언
- "절대 하지 말아야 할 것" 경고

8. "재회 후 관계 변화 예측"
- 재회 시 반복될 패턴 vs 새롭게 달라질 부분
- 대운 변화로 인한 관계 개선 포인트
- 재회 후 3/6/12개월 시나리오

9. "새 인연 vs 재회 — 냉정한 비교"
- 감정을 배제한 사주 구조적 비교
- 재회의 장단점 3개씩 / 새 인연의 장단점 3개씩
- 새 인연이 더 좋은 경우 솔직하게 말하기
- 최종 판정(verdict) + 근거

10. "재회 성공을 위한 개운법"
- 오행 보완법: 부족한 오행을 채우는 구체적 방법
- 행운 색상/방위/숫자/아이템
- 연락하기 좋은 시간대(오행 기반)
- 만날 때 좋은 장소/방향
- 피해야 할 날짜/시간대`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"재회가능성","value":"0-100 정수"},{"axis":"상대마음","value":"0-100 정수"},{"axis":"궁합구조","value":"0-100 정수"},{"axis":"타이밍","value":"0-100 정수"},{"axis":"관계성장","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4","#키워드5"],
      "strengths": ["재회 긍정 요인 25자","긍정 요인2 25자","긍정 요인3 25자"],
      "cautions": ["재회 주의점 25자","주의점2 25자","주의점3 25자"],
      "reunionProb": "0-100 정수",
      "partnerFeeling": "상대 현재 감정 추론 30자",
      "bestTiming": "재회 적기 15자 (예: 7~9월)",
      "verdict": "재회 추천/새 인연 추천/상황에 따라 중 하나",
      "comparison": {
        "reunionPros": ["장점1 20자", "장점2 20자", "장점3 20자"],
        "reunionCons": ["단점1 20자", "단점2 20자"],
        "newLovePros": ["장점1 20자", "장점2 20자"],
        "newLoveCons": ["단점1 20자", "단점2 20자"]
      },
      "contactAdvice": "지금 연락하기/기다리기/새출발 중 하나",
      "bestContactMonth": "최적 연락 시기 (예: 5~6월)",
      "emotionCycle": "현재 감정 흐름: 상승기/하강기/정체기 중 하나",
      "breakupCause": "이별의 사주적 핵심 원인 30자",
      "partnerProfile": {
        "dominantOheng": "목/화/토/금/수 중 하나 (상대방 추정 주 오행)",
        "personality": "상대방 연애 성향 요약 25자",
        "currentEmotion": "현재 감정 상태 15자",
        "reunionDesire": "0-100 정수 (상대방의 재회 욕구 추정)",
        "loveStyle": "상대 연애 스타일 10자",
        "myVsPartner": "두 사람의 사주 핵심 비교 요약 35자 (예: '목 일간의 유연함이 금 일간의 단호함을 감싸는 상생 구조')",
        "matchPoints": ["잘 맞는 점 + 사주 근거 30자", "잘 맞는 점2 + 근거 30자", "잘 맞는 점3 + 근거 30자"],
        "clashPoints": ["안 맞는 점 + 사주 근거 30자", "안 맞는 점2 + 근거 30자"],
        "pillarComparison": {
          "myPillars": {
            "year": {"cheongan": "천간 한자", "jiji": "지지 한자", "oheng": "오행"},
            "month": {"cheongan": "천간 한자", "jiji": "지지 한자", "oheng": "오행"},
            "day": {"cheongan": "천간 한자", "jiji": "지지 한자", "oheng": "오행"}
          },
          "partnerPillars": {
            "year": {"cheongan": "천간 한자 (추론)", "jiji": "지지 한자 (추론)", "oheng": "오행"},
            "month": {"cheongan": "천간 한자 (추론)", "jiji": "지지 한자 (추론)", "oheng": "오행"},
            "day": {"cheongan": "천간 한자 (추론)", "jiji": "지지 한자 (추론)", "oheng": "오행"}
          },
          "interactions": [
            {"position": "년주/월주/일주 중 하나", "type": "합(合)/충(沖)/형(刑)/해(害)/상생/상극 중 하나", "desc": "이 관계가 의미하는 것 20자"}
          ]
        }
      },
      "compatAnalysis": {
        "totalScore": "0-100 정수 (궁합 종합 점수)",
        "axes": [
          {"axis": "오행 조화", "score": "0-100"},
          {"axis": "성격 궁합", "score": "0-100"},
          {"axis": "감정 교류", "score": "0-100"},
          {"axis": "가치관", "score": "0-100"},
          {"axis": "미래 비전", "score": "0-100"}
        ]
      },
      "monthlyEnergy": [
        {"month": "1월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "2월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "3월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "4월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "5월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "6월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "7월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "8월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "9월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "10월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "11월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"},
        {"month": "12월", "myEnergy": "0-100", "partnerEnergy": "0-100", "reunionChance": "0-100"}
      ],
      "sinsal": {
        "doHwaSal": {"have": "true/false", "desc": "사주 근거 간단히 15자 (예: 酉에 위치)", "meaning": "쉽게 말하면 이런 뜻이에요 — 사주 초보자가 바로 이해할 수 있는 설명 40자", "impact": "positive/negative/neutral", "advice": "이 사람에게 구체적으로 어떻게 작용하는지 + 어떻게 하면 좋은지 35자"},
        "hongYeomSal": {"have": "true/false", "desc": "사주 근거 15자", "meaning": "쉬운 설명 40자", "impact": "positive/negative/neutral", "advice": "구체적 작용 + 조언 35자"},
        "wonJinSal": {"have": "true/false", "desc": "사주 근거 15자", "meaning": "쉬운 설명 40자", "impact": "positive/negative/neutral", "advice": "구체적 작용 + 조언 35자"},
        "cheonEulGuiin": {"have": "true/false", "desc": "사주 근거 15자", "meaning": "쉬운 설명 40자", "impact": "positive/negative/neutral", "advice": "구체적 작용 + 조언 35자"},
        "samhap": {"have": "true/false", "desc": "사주 근거 15자", "meaning": "쉬운 설명 40자", "impact": "positive/negative/neutral", "advice": "구체적 작용 + 조언 35자"},
        "yukhap": {"have": "true/false", "desc": "사주 근거 15자", "meaning": "쉬운 설명 40자", "impact": "positive/negative/neutral", "advice": "구체적 작용 + 조언 35자"}
      },
      "reunionFactors": [
        {"factor": "사주 변수 이름 (한자 병기) 예: 천간합(天干合)", "impact": "0-100 정수 (재회에 미치는 영향력)", "favorable": true또는false, "desc": "이 요인이 재회에 미치는 구체적 영향 30자"},
        {"factor": "두번째 변수", "impact": "0-100", "favorable": true또는false, "desc": "30자"},
        {"factor": "세번째 변수", "impact": "0-100", "favorable": true또는false, "desc": "30자"},
        {"factor": "네번째 변수", "impact": "0-100", "favorable": true또는false, "desc": "30자"},
        {"factor": "다섯번째 변수", "impact": "0-100", "favorable": true또는false, "desc": "30자"}
      ],
      "greenFlags": ["긍정 신호 25자", "긍정 신호2 25자", "긍정 신호3 25자"],
      "redFlags": ["경고 신호 25자", "경고 신호2 25자", "경고 신호3 25자"],
      "breakupDuration": {
        "healingStage": "충격기/거부기/회복기/수용기/장기분리기 중 하나",
        "stageDesc": "현재 단계에 대한 설명 30자 (예: '감정 정리는 됐지만 미련이 남아있는 시기')",
        "optimalWait": "최적 대기 기간 15자",
        "reunionImpact": "이 기간이 재회 확률에 미치는 구체적 영향 40자",
        "emotionNow": "현재 양쪽 감정 상태 요약 20자 (예: '나는 미련, 상대는 무관심')",
        "phases": [
          {"name": "충격기", "period": "0~2개월", "desc": "이별 직후 감정 혼란기. 현실 부정과 슬픔이 교차하는 시기", "myState": "나의 상태 10자", "partnerState": "상대 상태 10자"},
          {"name": "거부기", "period": "2~6개월", "desc": "이별을 거부하며 연락 충동이 강한 시기. 분노와 그리움 반복", "myState": "나의 상태 10자", "partnerState": "상대 상태 10자"},
          {"name": "회복기", "period": "6~12개월", "desc": "감정 정리가 시작되며 일상 회복이 진행되는 시기", "myState": "나의 상태 10자", "partnerState": "상대 상태 10자"},
          {"name": "수용기", "period": "12~18개월", "desc": "이별을 받아들이고 객관적 시야가 생기는 시기. 재회 판단 가능", "myState": "나의 상태 10자", "partnerState": "상대 상태 10자"},
          {"name": "장기 분리기", "period": "18개월~", "desc": "감정 완전 정리 후 새 관계 or 성숙한 재회가 가능한 시기", "myState": "나의 상태 10자", "partnerState": "상대 상태 10자"}
        ],
        "currentPhaseIndex": "0~4 정수 (헤어진 기간 기준으로 정확히 매칭. 0=충격기 0~2개월, 1=거부기 2~6개월, 2=회복기 6~12개월, 3=수용기 12~18개월, 4=장기분리기 18개월+)"
      }
    }`,
  },
  study: {
    label: '학업·시험운',
    sections: ['나의 학습 체질 분석', '합격 가능성과 시기', '시험 당일 최적 전략', '슬럼프 극복법', '올해 합격 로드맵'],
    specificPrompt: `⭐ 시험/취업 준비생에게 "이거 보고 힘 얻었다" 반응이 나올 정도로 구체적으로.

- 인성(정인/편인) 강약 → 학습 체질: 암기형/이해형/직관형/반복형 판별 + 구체적 공부법
- 식상 → 시험장에서의 표현력: "서술형에 강한지, 객관식에 강한지"
- 합격 가능성을 사주적 근거와 함께: "인성이 ~해서 합격 기운이 ~합니다"
- 합격에 유리한 시기: 월 단위로 "양력 O~O월 시험이 가장 유리"
- 시험 당일 전략: 유리한 시간대, 좌석 방향(오행 방위), 행운 색상/아이템
- 집중력 패턴: "오전 vs 오후 vs 새벽 중 ~시간대가 사주적으로 최적"
- 슬럼프 시기 예측: "O월에 슬럼프가 올 수 있는데, 이때는 ~하세요"
- "혹시 시험 전날 잠을 못 자는 타입 아닌가요?" 같은 소름 포인트
- 같이 공부하면 좋은 사람의 사주적 특성`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"집중력","value":"0-100 정수"},{"axis":"이해력","value":"0-100 정수"},{"axis":"암기력","value":"0-100 정수"},{"axis":"시험운","value":"0-100 정수"},{"axis":"끈기","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["학업 강점 25자","학업 강점2 25자"],
      "cautions": ["학업 주의점 25자","학업 주의점2 25자"],
      "studyType": "암기형/이해형/직관형/반복형 중 하나",
      "bestStudyTime": "최적 공부 시간대 15자",
      "examStrength": "서술형/객관식/실기 중 강한 유형",
      "passRate": "높음/보통/보완필요 중 하나",
      "slumpPeriod": "슬럼프 예상 시기 10자",
      "focusPeakHour": "집중력 피크 시간대 (예: 오전 6~9시)",
      "examLuckMonth": "시험운 최강 월 (예: 6월, 11월)",
      "seatDirection": "유리한 좌석 방향 (예: 남향, 동향)",
      "studyPartnerType": "함께 공부하면 좋은 사람 유형 15자",
      "examFitScore": "해당 시험의 사주 적합도 0-100 (시험명 있을 때만, 아니면 null)",
      "examTimingVerdict": "시험 시기 판정: 최적/양호/주의 중 하나 (시험 예정일 있을 때만, 아니면 null)",
      "examTimingAnalysis": "시험 예정 시기의 사주 분석 35자 (시험 예정일 있을 때만, 아니면 null)",
      "examDayTips": "시험 당일 꿀팁 30자 (시험명 있을 때만, 아니면 null)"
    }`,
  },
  social: {
    label: '대인관계운',
    sections: ['관계 스타일 분석', '귀인운', '구설수 주의 시기', '인간관계 갈등 패턴', '올해 관계 전략'],
    specificPrompt: `⭐ 인간관계에 대한 깊은 통찰. "내 주변 사람들이 딱 이래..." 반응.

- 비겁 강약 → 친구/동료 관계 스타일
- 귀인 유무 → 도움 주는 사람의 구체적 특징 (나이, 직업, 성별)
- 올해 구설수/배신 주의 시기 (월 단위)
- 갈등 패턴: "~한 상황에서 갈등이 자주 생겨요"
- "혹시 가까운 사람과 ~한 갈등을 겪은 적 있나요?" 소름 포인트`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"사교력","value":"0-100 정수"},{"axis":"리더십","value":"0-100 정수"},{"axis":"신뢰도","value":"0-100 정수"},{"axis":"인맥운","value":"0-100 정수"},{"axis":"귀인운","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["대인관계 강점 25자","대인관계 강점2 25자"],
      "cautions": ["대인관계 주의점 25자","주의점2 25자"],
      "socialStyle": "관계 스타일명 15자",
      "guiinProfile": {"traits": "귀인 특성 20자", "when": "만남 시기 10자", "oheng": "귀인 오행 (목/화/토/금/수)"},
      "warningPeriod": "구설수 주의 시기 15자",
      "gossipMonth": "구설수 주의 월 (예: 4월, 9월)",
      "conflictTrigger": "갈등 핵심 트리거 20자",
      "bestAllyType": "가장 잘 맞는 동료/친구 유형 15자"
    }`,
  },
  exam: {
    label: '합격·이직운',
    sections: ['변동의 timing — 올해 합격·이직 기운', '합격·이직 유리 방향과 분야', '면접·자격시험 결정 시기', '이직 후 3개월 적응 전망', '올해 변동 실전 전략'],
    specificPrompt: `⭐ "이 시기에 움직여라/버텨라"를 사주 근거로 단정. 시험·자격증·이직·전직의 변동 timing 과 방향에 집중.
평생 직업 적성이나 창업은 다루지 않음 (→ 직업운 / 사업운 영역).

- 정관·편관 동향 → 조직 변동·직위 변동 에너지의 강약
- 문창·학당·태극귀인 등 시험 길성 유무 → 합격 기운
- 올해 세운·월운 + 현재 대운 교차 → 합격·이직 유리 월 (월 단위 구체 명시)
- 이직 후 3개월 적응 전망 (이직 시 일간 환경 변화 분석)
- 면접 유리 시간대·좌석 방향 (오행 방위 기반)
- "혹시 최근에 이직 제안을 받았거나 고민 중이지 않나요?" 소름 포인트
- ⚠️ 직업 정체성·평생 적성 (→ 직업운) 이나 창업 판단 (→ 사업운) 은 언급 금지. 이 섹션은 '변동 timing·방향'만.`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"합격운","value":"0-100 정수"},{"axis":"이직운","value":"0-100 정수"},{"axis":"변동 leverage","value":"0-100 정수"},{"axis":"면접운","value":"0-100 정수"},{"axis":"적응력","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["변동 강점 25자","변동 강점2 25자"],
      "cautions": ["변동 주의점 25자","변동 주의점2 25자"],
      "changeMode": "합격 우선/이직 우선/양방 중 하나",
      "examLuckLevel": "상/중/하 중 하나",
      "jobChangeLuckLevel": "상/중/하 중 하나",
      "bestChangeMonths": "유리한 월 배열 (예: ['4월','9월','11월'])",
      "avoidChangeMonths": "피할 월 배열 (예: ['2월','7월'])",
      "interviewTime": "면접 유리 시간대 (예: 오전 10~11시)",
      "interviewDirection": "면접장 좌석 유리 방향 (오행 방위, 예: 동향·남향)",
      "bestField": "유리한 분야 키워드 2개 (오행 근거, 예: 기획/마케팅 + 목·화 기운)",
      "changeDirection": "이직 방향 (동종업/이종업/프리랜서/공공/스타트업 중 하나 + 이유 20자)",
      "decisionUrgency": "결정 긴급도 (즉시/금년내/내년 중 하나)",
      "postChangeOutlook": "이직 후 3개월 적응 전망 35자",
      "luckyItemForExam": "시험/면접 행운 아이템 15자"
    }`,
  },
  move: {
    label: '이사·이동운',
    sections: ['이동 적기 분석', '좋은 방향', '이사/이직/유학 전망', '해외운', '올해 이동 전략'],
    specificPrompt: `⭐ 이사/이동을 고민하는 사람에게 구체적이고 실용적인 조언.

- 역마살 유무 → 이동 에너지가 강한 사주인지
- 방향: 오행 기반 좋은 방위 (동/서/남/북/중앙)
- 이사/유학/해외취업 각각의 적기와 유불리
- 현재 거주지와 이동 방향의 사주적 궁합`,
    topicDataSchema: `"topicData": {
      "subScores": [{"axis":"이동운","value":"0-100 정수"},{"axis":"방향운","value":"0-100 정수"},{"axis":"해외운","value":"0-100 정수"},{"axis":"정착운","value":"0-100 정수"},{"axis":"적응력","value":"0-100 정수"}],
      "keywords": ["#사주근거키워드1","#키워드2","#키워드3","#키워드4"],
      "strengths": ["이동 강점 25자","이동 강점2 25자"],
      "cautions": ["이동 주의점 25자","이동 주의점2 25자"],
      "hasYeokmasal": true 또는 false,
      "bestDirection": "좋은 방위와 이유 20자",
      "avoidDirection": "피할 방위와 이유 20자",
      "movingType": "이사/유학/해외취업 중 가장 유리한 것",
      "bestTiming": "최적 이동 시기 15자",
      "travelLuck": "해외운 수준: 높음/보통/낮음",
      "bestMoveMonth": "이사 최적 월 (예: 3~5월)",
      "ohengDirectionMap": "오행별 방위: 목=동, 화=남, 토=중앙, 금=서, 수=북 중 본인에게 유리한 것과 이유 30자",
      "planDateVerdict": "예정 시기 판정: 좋음/보통/주의 중 하나 (예정 시기 있을 때만, 아니면 null)",
      "planDateAnalysis": "예정 시기의 사주적 이동운 분석 40자 (예정 시기 있을 때만, 아니면 null)",
      "betterAlternative": "더 좋은 시기 제안 25자 (예정 시기 있고 보통/주의일 때만, 아니면 null)",
      "purposeAdvice": "이사 목적에 맞는 핵심 조언 35자 (목적 있을 때만, 아니면 null)"
    }`,
  },
};

export async function generateTopicAnalysisAI(
  apiKey: string,
  topicId: string,
  sajuData: any,
  baseScore?: number,
  partnerInfo?: { name: string; birthYear: number; birthMonth: number; birthDay: number; gender: string; birthHour?: number },
  extraInfo?: Record<string, any>,
): Promise<any> {
  // SSOT 정렬 (2026-04-22): client 는 'move'/'exam' 으로 호출. legacy 'moving'/'reconciliation' 등도 호환.
  const normalizedId = normalizeTopicIdServer(topicId);
  const config = TOPIC_CONFIGS[normalizedId];
  if (!config) throw new Error(`알 수 없는 주제: ${topicId} (정규화: ${normalizedId})`);
  if (normalizedId !== topicId) console.info(`[claudeTopic] topicId 정규화: ${topicId} → ${normalizedId}`);

  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt(config, normalizedId, sajuData, baseScore, partnerInfo, extraInfo);

  // 전 주제 Sonnet 4.6 통일 — 유료 1운 콘텐츠는 최소 Sonnet급 품질 유지 (운영 결정).
  // system 프롬프트는 promptsV3.TOPIC_ANALYSIS_SYSTEM_V3 (V3_BASE + 금지어·어조 공통 블록 + 주제 특화 규칙).
  // user 프롬프트는 이 파일의 buildPrompt 가 담당 (topicData 스키마·paritnerInfo·extraInfo 등 풍부한 주제별 특화 유지).
  const model = 'claude-sonnet-4-6';
  // 재회운 10섹션 + 풍부한 topicData → 16000, 나머지 5섹션 → 8192
  const maxTokens = normalizedId === 'reunion' ? 16000 : 8192;

  // 1차 생성 (파싱 실패 시 temperature 0.5 로 1회 재시도)
  let firstText: string;
  let firstJson: any;
  try {
    const meta1: ParseJsonMeta = { repairUsed: false };
    const first = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: 0.1,
      system: TOPIC_ANALYSIS_SYSTEM_V3,
      messages: [{ role: 'user', content: prompt }],
    });
    firstText = (first.content[0] as { type: string; text: string }).text;
    firstJson = parseJsonResponse(firstText, meta1);
    if (meta1.repairUsed) console.info(`[claudeTopic:${topicId}] 1차 jsonrepair 발동`);
  } catch (e1: any) {
    console.warn(`[claudeTopic:${topicId}] 1차 실패 → 재시도:`, e1?.message);
    const meta2: ParseJsonMeta = { repairUsed: false };
    const retry = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: 0.05,
      system: TOPIC_ANALYSIS_SYSTEM_V3,
      messages: [{ role: 'user', content: prompt }],
    });
    firstText = (retry.content[0] as { type: string; text: string }).text;
    firstJson = parseJsonResponse(firstText, meta2);
    console.info(`[claudeTopic:${topicId}] 2차 성공`, meta2.repairUsed ? '(jsonrepair 발동)' : '');
  }

  // 2차 자기 리뷰 — 고가치 유료 상품이므로 품질 보정 (AI프롬프트_v3 §8).
  const review = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0.1, // 결정론적
    system: TOPIC_ANALYSIS_SYSTEM_V3,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: firstText },
      { role: 'user', content: SELF_REVIEW_V3({ original: firstJson, kind: 'topic' }) },
    ],
  });
  const reviewText = (review.content[0] as { type: string; text: string }).text;
  try {
    return parseJsonResponse(reviewText);
  } catch {
    // 리뷰 파싱 실패 시 1차 결과 반환 (안전 fallback)
    return firstJson;
  }
}

function buildPrompt(
  config: TopicConfig,
  topicId: string,
  d: any,
  baseScore?: number,
  partnerInfo?: { name: string; birthYear: number; birthMonth: number; birthDay: number; gender: string; breakupYear?: number; breakupMonth?: number; birthHour?: number },
  extraInfo?: Record<string, any>,
): string {
  const p = d.pillars || [];
  const labels = ['년주', '월주', '일주', '시주'];
  let pillarsText = '';
  p.forEach((x: any, i: number) => { if (x.available !== false) pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기||''})${x.지지}(${x.지지읽기||''})\n`; });
  const el = d.elements || {};
  const sipsung = d.sipsung?.map((s: any) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
  const currentDaeun = d.daeun?.find((x: any) => x.isCurrent || x.현재);
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월`;

  // 🔥 P0-1 (audit 1) — 사주 데이터 underutilization 해소: myeongriAnalysis·jijanggan·gilsin·hyungsal·gongmang·yearlyUn 모두 prompt 에 주입
  const myeongri = d.myeongriAnalysis || {};
  const jijangganText = (d.jijanggan || []).map((j: any) => `${j.지지}(${(j.지장간 || []).join('·')})`).join(', ');
  const gilsinText = (d.gilsin || []).map((g: any) => g.이름 || g.name).filter(Boolean).join(', ');
  const hyungsalText = (d.hyungsal || []).map((h: any) => h.이름 || h.name).filter(Boolean).join(', ');
  const gongmangText = (d.gongmang || []).map((g: any) => `${g.기준 || ''}기준 공망: ${g.공망 || ''}`).filter((s: string) => s.trim() !== '기준 공망:').join(', ');
  const hyungchunghapText = (myeongri.형충합 || []).map((x: any) => x.desc).filter(Boolean).join(', ');
  const sipsungDist = myeongri.십성분포 || {};
  const yearlyUn = d.yearlyUn?.간지 || '';
  const gyeokguk = myeongri.격국 || '';     // P0-3 — calculator analyzeGyeokguk 결과
  const gyeokgukReason = myeongri.격국근거 || '';
  const yongsin = myeongri.용신 || d.yongsin || '';  // 조후/억부용신 (있으면)

  // 재회운/결혼운: 상대방 정보 추가
  let partnerSection = '';
  if (topicId === 'reunion' && partnerInfo) {
    const breakupInfo = (partnerInfo.breakupYear && partnerInfo.breakupMonth)
      ? `\n헤어진 시기: ${partnerInfo.breakupYear}년 ${partnerInfo.breakupMonth}월\n→ 현재까지 약 ${Math.max(0, (today.getFullYear() - partnerInfo.breakupYear) * 12 + (today.getMonth() + 1 - partnerInfo.breakupMonth))}개월 경과\n→ 헤어진 기간이 재회 가능성에 미치는 영향을 반드시 분석할 것. breakupDuration 필드에 반영.`
      : '';
    const birthHourStr = (partnerInfo.birthHour != null && partnerInfo.birthHour >= 0)
      ? `\n출생시간: ${partnerInfo.birthHour}시 → 시주(時柱) 분석 가능. 상대방의 시주까지 포함하여 4주(四柱) 완전 교차 분석.`
      : '\n출생시간: 미상 → 년주/월주/일주(3주)로 분석.';
    partnerSection = `
## 상대방 정보
이름: ${partnerInfo.name || '미상'}
생년월일: ${partnerInfo.birthYear}년 ${partnerInfo.birthMonth}월 ${partnerInfo.birthDay}일
성별: ${partnerInfo.gender === 'male' ? '남' : '여'}${birthHourStr}${breakupInfo}

→ 상대방의 생년월일${(partnerInfo.birthHour != null && partnerInfo.birthHour >= 0) ? '시' : ''}로 사주 원국을 산출하고, 두 사람의 사주를 교차 분석해주세요.
→ 상대방 이름을 자연스럽게 포함시키세요.
→ partnerProfile.pillarComparison에 나의 년주/월주/일주와 상대방의 년주/월주/일주(추론)를 채우고, interactions에 합/충/형/해/상생/상극 관계를 표시하세요.${(partnerInfo.birthHour != null && partnerInfo.birthHour >= 0) ? '\n→ 상대방 시주도 추론 가능하므로 시주 관계까지 분석하되, pillarComparison에는 년/월/일 3주만 표시.' : ''}
→ partnerProfile, compatAnalysis 필드에 상대방 분석 결과를 정확히 채우세요.
→ 두 사람의 천간합(天干合), 지지합(地支合), 원진(怨嗔) 관계를 분석하여 sinsal 필드에 반영하세요.
→ breakupDuration.currentPhaseIndex는 경과 개월 수에 정확히 대응시키세요: 0~2개월=0(충격기), 2~6개월=1(거부기), 6~12개월=2(회복기), 12~18개월=3(수용기), 18개월+=4(장기분리기).

🇰🇷 **상대방 사주 산출 — KR 진태양시 보정 mandate (audit 1 P0-5)**:
→ 상대방 사주 산출 시 한국 진태양시 보정을 고려하라 (출생시간 미상이면 시주 생략, 일주는 통상 KST 기준 사용).
→ 일주(일간)는 추론 시 ±1일 변동 가능성을 인지하고 가장 합리적인 1개로 확정 (불확정 표기 금지 — "甲(추정)" / "乙 또는 丙" 같은 표기 절대 X).
→ 출생시간 미상 시 시주를 강제로 추론하여 단정 X (시주 칸은 null 또는 생략).
`;
  } else if (topicId === 'marriage' && partnerInfo) {
    const birthHourStr = (partnerInfo.birthHour != null && partnerInfo.birthHour >= 0)
      ? `\n출생시간: ${partnerInfo.birthHour}시 → 시주(時柱) 분석 가능.`
      : '\n출생시간: 미상 → 년주/월주/일주(3주)로 분석.';
    partnerSection = `
## 현재 연애 상태: 연애 중
## 교제 상대방 정보
이름: ${partnerInfo.name || '미상'}
생년월일: ${partnerInfo.birthYear}년 ${partnerInfo.birthMonth}월 ${partnerInfo.birthDay}일
성별: ${partnerInfo.gender === 'male' ? '남' : '여'}${birthHourStr}

→ 이 사람은 현재 교제 중입니다. 상대방의 사주를 추론하여 두 사람의 결혼 궁합을 교차 분석하세요.
→ "사주로 본 배우자상"은 이미 상대방이 있으므로, spouseProfile에 실제 상대방 특성을 반영하세요.
→ partnerCompat 필드를 반드시 채우세요: pillarComparison(년주/월주/일주 비교), matchPoints/clashPoints, compatScore, marriageChemistry.
→ 상대방 이름을 자연스럽게 포함: "${partnerInfo.name}님과의 결혼 궁합은..."
→ 결혼 적기 분석에서 두 사람의 대운 교차 시점도 분석하세요.
→ 시댁/처가 관계도 상대방 사주 기반으로 더 구체적으로 분석하세요.
`;
  } else if (topicId === 'marriage' && !partnerInfo) {
    partnerSection = `
## 현재 연애 상태: 솔로
→ 솔로 상태이므로 사주 원국에서 배우자상을 추론하세요.
→ partnerCompat은 null로 설정하세요.
→ "어떤 사람을 만나야 결혼이 잘 풀리는지" 관점에서 배우자 프로필을 구체적으로 채우세요.
`;
  } else if (topicId === 'love' && partnerInfo) {
    const loveStatus = extraInfo?.loveStatus === 'some' ? '썸' : '연애중';
    const birthHourStr = (partnerInfo.birthHour != null && partnerInfo.birthHour >= 0)
      ? `\n출생시간: ${partnerInfo.birthHour}시 → 시주(時柱) 분석 가능.`
      : '\n출생시간: 미상 → 년주/월주/일주(3주)로 분석.';
    partnerSection = `
## 현재 연애 상태: ${loveStatus}
## ${loveStatus === '썸' ? '관심 상대' : '교제 상대'} 정보
이름: ${partnerInfo.name || '미상'}
생년월일: ${partnerInfo.birthYear}년 ${partnerInfo.birthMonth}월 ${partnerInfo.birthDay}일
성별: ${partnerInfo.gender === 'male' ? '남' : '여'}${birthHourStr}

→ 상대방의 사주를 추론하여 두 사람의 연애 궁합을 교차 분석하세요.
→ partnerCompat 필드를 반드시 채우세요: pillarComparison(년주/월주/일주 비교), matchPoints/clashPoints, compatScore, loveChemistry.
→ 상대방 이름을 자연스럽게 포함: "${partnerInfo.name}님과의 연애 궁합은..."
→ idealType은 실제 상대방 특성 기반으로 서술하세요.${loveStatus === '썸' ? '\n→ 아직 썸 단계이므로 "고백 적기", "상대방의 관심도를 사주적으로 분석" 내용을 포함하세요.' : '\n→ 연애 중이므로 "관계 안정기/위기기 시기", "장기적 전망" 내용을 포함하세요.'}
`;
  } else if (topicId === 'love' && !partnerInfo) {
    partnerSection = `
## 현재 연애 상태: 솔로
→ 솔로 상태이므로 사주 원국에서 궁합이 좋은 이성을 추론하세요.
→ partnerCompat은 null로 설정하세요.
→ 새 인연의 시작 시기와 만남 장소에 집중하세요.
`;
  }

  // 주제별 추가 정보 섹션
  let extraSection = '';
  if (extraInfo) {
    if (topicId === 'business' && extraInfo.bizStatus) {
      const statusLabel = extraInfo.bizStatus === 'running' ? '현재 사업 운영중' : '창업 준비중';
      const openInfo = extraInfo.bizStatus === 'running' && extraInfo.bizOpenYear
        ? `\n개업 시기: ${extraInfo.bizOpenYear}년 ${extraInfo.bizOpenMonth}월\n→ 개업 시점의 대운/세운과 현재 흐름의 변화를 분석. 사업이 잘되고 있는지, 전환이 필요한 시기인지 진단.`
        : '';
      extraSection = `
## 현재 상태: ${statusLabel}${openInfo}
→ ${extraInfo.bizStatus === 'running' ? '이미 운영 중이므로 사업 확장/축소/전환 시기, 현재 사업의 사주적 맞춤도를 분석하세요.' : '아직 시작 전이므로 최적 창업 시기, 맞는 업종, 준비해야 할 것에 집중하세요.'}
`;
    } else if (topicId === 'career' && extraInfo.jobStatus) {
      const statusMap: Record<string, string> = { student: '학생 (취업 준비)', jobseeking: '구직중', employed: '재직중 (이직 고민)' };
      const fieldInfo = extraInfo.targetField ? `\n관심 분야/직종: ${extraInfo.targetField}` : '';
      extraSection = `
## 현재 상태: ${statusMap[extraInfo.jobStatus] || '미상'}${fieldInfo}
→ ${extraInfo.jobStatus === 'employed' ? '이직 타이밍, 현 직장 적합도, 더 맞는 업종을 중점 분석하세요.' : extraInfo.jobStatus === 'student' ? '첫 취업 준비에 초점. 적성, 합격 시기, 유리한 산업을 분석하세요.' : '구직 성공 시기, 면접 유리 시점, 사주에 맞는 직종을 분석하세요.'}
`;
    } else if (topicId === 'move' && extraInfo.movePurpose) {
      const purposeMap: Record<string, string> = { house: '주거 이사', job: '직장 이동', study: '유학/학업', abroad: '해외 이주' };
      const planInfo = extraInfo.movePlanYear ? `\n이사 예정 시기: ${extraInfo.movePlanYear}년 ${extraInfo.movePlanMonth}월` : '';
      extraSection = `
## 이사 목적: ${purposeMap[extraInfo.movePurpose] || '미상'}${planInfo}
→ 예정 시기의 사주적 이동운을 분석하고, 더 좋은 시기가 있다면 제안하세요.
→ 목적에 맞는 방위, 주의사항, 이사 전 준비사항을 구체적으로 안내하세요.
`;
    } else if (topicId === 'study' && extraInfo.examName) {
      const examDate = extraInfo.examYear ? `\n시험 예정: ${extraInfo.examYear}년 ${extraInfo.examMonth}월` : '';
      extraSection = `
## 준비중인 시험: ${extraInfo.examName}${examDate}
→ 해당 시험 시기의 사주적 시험운을 집중 분석하세요.
→ 시험까지 남은 기간 동안의 학습 전략, 슬럼프 시기, 컨디션 관리법을 구체적으로 안내하세요.
→ 시험 당일 유리한 시간대, 좌석 방향, 행운 아이템도 빠짐없이.
`;
    }
  }

  // 인접 주제 경계 (2026-04-22 SSOT v1) — 모순 방지
  const boundary = TOPIC_BOUNDARIES[topicId];
  const boundaryBlock = boundary
    ? `\n## ⚠ 주제 경계 (같은 사주 → 10주제 결과 모순 금지)
이 섹션의 lens: ${boundary.scope}
다음 영역은 다른 주제가 다루므로 이 분석에서 한 줄도 언급하지 말 것:
${boundary.excludes.length ? boundary.excludes.map(x => `- ${x}`).join('\n') : '- (경계 없음 — 본 주제 단독 완결)'}
→ 같은 사주로 다른 주제를 돌렸을 때 결론이 모순되면 안 됨. 사주 원국의 기본 결(용신·일간 강약·주요 십성 배치)에 뿌리를 둔 판단만 하고, 인접 주제 영역의 단정은 피할 것.\n`
    : '';

  return `명리학 40년 대가. "${config.label}" 심층 분석. "소름돋는" 수준.

⚠️ 현재 날짜: ${dateStr} — 반드시 이 기준으로 과거/현재/미래 구분.

## 사주 원국
${pillarsText}일간: ${p[2]?.천간 || '미상'}

## 오행: 목${el.목||0} 화${el.화||0} 토${el.토||0} 금${el.금||0} 수${el.수||0}
${Object.entries(el).filter(([,v]) => v === 0).map(([k]) => `→ ${k} 없음`).join('\n')}

## 십성: ${sipsung || '미상'}
## 현재 대운: ${currentDaeun ? currentDaeun.간지 : '미상'}
## 이름: ${d.input?.name||'미상'}, ${d.input?.gender==='male'?'남':'여'}

## 🔥 명리학 구조 분석 (audit 1 P0-1 — 반드시 해석에 활용)
## 일간 강약: ${myeongri.일간강약 || '미산출'}${myeongri.강약근거 ? ` (${myeongri.강약근거})` : ''}
## 득령(月令): ${myeongri.득령 === true ? '득령(O)' : myeongri.득령 === false ? '실령(X)' : '미산출'}
## 십성 분포: 비겁${sipsungDist.비겁 || 0}·식상${sipsungDist.식상 || 0}·재성${sipsungDist.재성 || 0}·관성${sipsungDist.관성 || 0}·인성${sipsungDist.인성 || 0}
## 격국(格局): ${gyeokguk || '판정 보류'}${gyeokgukReason ? ` — ${gyeokgukReason}` : ''}
## 용신(用神): ${yongsin || '본 분석에서 추론 권장'}
## 형충합(刑沖合): ${hyungchunghapText || '없음'}
## 지장간: ${jijangganText || '없음'}
## 일주 길신(吉神): ${gilsinText || '없음'}
## 일주 흉살(凶殺): ${hyungsalText || '없음'}
## 공망(空亡): ${gongmangText || '없음'}
## 올해 세운(歲運): ${yearlyUn || `${today.getFullYear()}년`}

→ 위 18종 데이터(원국·오행·십성·강약·격국·용신·형충합·지장간·길신·흉살·공망·세운·대운 등) 중 **최소 5종**을 본문(sections·timeline·actionAdvice·sajuConnection·insightCards) 에 직접 호명. 단순 나열 금지, 해석의 근거로 활용.

${partnerSection}${extraSection}${boundaryBlock}
## ${config.label} 분석 규칙
${config.specificPrompt}

## ⚠️ 작성 규칙 (반드시 준수)
1. 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.
2. overallScore 산출:${baseScore ? ` 이 사람의 사주 리포트에서 ${config.label} 점수가 ${baseScore}점으로 산출됨. overallScore는 반드시 ${baseScore}점으로 설정하라. 절대 다른 점수를 매기지 마.` : ' 오행 균형(과다/부족)과 십성 배치를 정량적으로 분석하여 일관되게 매겨라. 같은 사주에 같은 주제면 항상 같은 점수가 나와야 한다. 감정이 아닌 구조 기반.'}
3. 각 section의 content는 단락을 나눠 가독성 있게 작성. 한 문단이 3줄을 넘지 않도록.
4. topicData의 각 필드를 정확한 형식으로 채워라. 시각화에 사용되므로 빠뜨리지 마.
   - pillarComparison의 cheongan/jiji는 반드시 한자 1글자만 (예: "甲", "寅"). "(추정)", "(추론)" 같은 주석을 절대 붙이지 마.
   - oheng도 "목", "화" 등 1글자만. "(추정)" 등 괄호 주석 금지.
5. subScores의 5개 축 value는 반드시 정수. overallScore와 논리적으로 일관되게.
6. keywords는 #으로 시작. 사주 용어(도화살/정관/편재 등)를 1개 이상 포함.
7. strengths/cautions는 구체적으로. "좋다/나쁘다"가 아니라 어떤 상황에서 어떻게인지.
8. 각 section의 highlight는 읽는 사람이 밑줄 칠만한 핵심 문장.
9. insightCards: 각 섹션마다 1~2개의 사주 인사이트 카드를 insightCards 배열에 생성.
   - label: 반드시 사주 전문 용어 + 한자 병기 (예: "도화살(桃花殺)", "편재(偏財) 구조", "월운(月運) 분석")
   - value: 해당 섹션의 핵심 인사이트를 데이터로. 구체적 수치/시기/판정 포함 (15~25자)
   - type: "info"(중립 사실), "accent"(긍정/기회), "warning"(주의/위험)
   - 예: {"label":"도화살(桃花殺)","value":"있음 — 자연스러운 매력 발산형","type":"accent"}
   - 예: {"label":"편재(偏財) 과다","value":"충동 지출 위험: 4~6월","type":"warning"}
   - 예: {"label":"면접 유리 시간(時)","value":"화요일 오전 10시, 목요일 오후 2시","type":"info"}
   - content에 이미 쓴 내용을 반복하지 말고, 핵심을 '카드 형태'로 데이터화한 것.

## 출력 (JSON만, 코드블록 없이)
⚠️ **점수 필드 룰 (2026-05-04 PD 결단)**: 모든 score (categoryScores·subScores·overallScore·monthlyScore·compatScore·careerScore 등) 는 **5의 배수만 반복 금지**. 65·70·75·80 같은 fake 신호 X. 67·73·81·88 같이 자연수로 출력. 같은 카테고리 안 점수가 모두 다른 값이어야 함.

🚨 **결정론 점수 산출 룰 (audit 1 P0-9 — 같은 사주 = 같은 점수)**:
- subScores 5축 산출 시 base 룰을 적용:
  · 매력발산/도화 관련 = 도화살 유무 + 식상 비중×0.5 + 일지 도화 십성 가중
  · 안정감/관성 관련 = 관성 비중 + 인성 가중 + 일간 강약 보정
  · 재물 관련 = 재성 비중 + 식상생재 구조 가중 - 비겁 견제(군겁쟁재 시 -)
  · 변동/이동 관련 = 역마살 + 충(沖) 발생 + 대운 변동 강도
  · 합격/시험 관련 = 정관 + 문창·학당·태극귀인 길성 + 인성 가중
- monthlyXxx 12배열 산출 시: 각 월 간지의 일간 십성 관계 + 원국 충/합 발생 여부 → 50점 base 에 +/-15 보정
- 같은 사주 두 번 분석 시 같은 점수 (±2 이내). 자유로운 점수 매김 절대 금지.
- 6개 영역 subScores 가 모두 다른 값 (균일분포 X · 사주 구조 반영).

🚨 **톤 룰 (2026-05-05 PD 결단 — 외계어 X · 일상어 O)**

사용자 피드백:
> '무슨 말인지 모르겠다. 한낮의 태양이다 / 겨울 한복판에 태어난 태양이다 / 형국이다 — 이게 뭔 뜻이냐.
>  사주는 알아듣기 편하게 말해줘서 돈 주고 보는 거지, 어렵고 모호한 표현이면 돈 안 낸다.'

❌ **절대 금지 패턴**:
1. 시적 비유 폭격: '한낮의 태양' '차가운 밤 호수' '장작을 대주는 자리' '~의 형국' — 비유가 풀이를 대체 X.
2. 문어체 단어 남발: '결' '자리' '형국' 한 문단 2회 이내.
3. 중의적·모호한 표현: '흐름이 풀리는 자리' → '30대 중반에 일이 잘 풀립니다'
   '준비된 결이 또렷' → '준비는 잘 되어 있어요' / '의식의 자리에 두십시오' → '꼭 신경 쓰세요'
4. 한자 폭격: 한자(丙火·신금·축미충 등) 첫 등장 1번만, 이후는 한글 또는 일상어.

📚 **"사주아이" 톤 레퍼 (참고 · 모방 X · 우리 특색 살림)**:
1. **각 섹션 시작 = 일상어 결론 한 줄** (제목 후크 톤)
   ✅ '겉으로는 차분해 보이지만 속에는 따뜻함을 찾는 마음이 늘 움직이는 분입니다'
2. **사주 근거는 두 번째 문장부터, 한자는 1회만** + 즉시 일상어 풀이
3. **공감 + 위로 + 행동 처방** (가장 강력)
   ✅ '<strong>본인에게는 가혹한 잣대를 들이대요</strong>. 이제는 본인 행복을 위해 그 섬세함을 써보세요. <strong>완벽하지 않아도 충분히 가치 있는 사람입니다</strong>.'
4. **마무리 = 응원 + 구체 행동** (행운 색·방위·시기 등 구체)

🚨 **한자 풀이 형식 강제 (2026-05-05 PD 결단 — '라는 뜻' 같은 회피 X)**:
한자 등장 시 괄호 안에 **실제 일상어 풀이 텍스트** 동반:
✅ '병화(丙火, 밝고 활달한 성격)' / '신금(辛金, 깔끔하고 단정한 사람)' / '축미충(丑未沖, 가치관이 자주 흔들리는 자리)'
✅ '정관(正官, 책임감과 규범을 중요시하는 결)' / '도화살(桃花殺, 사람을 끌어당기는 매력)'
❌ '병화(丙火)' 단독 — 풀이 X
❌ '병화(丙火, 라는 뜻)' / '병화(丙火, 한자 그대로)' — 추상적 회피 X. 진짜 풀이 텍스트.
검증법: 한자 (괄호) 부분만 빼고 일상어만 읽었을 때 자연스러운 한국어 문장이 되어야 함.


✨ **우리만의 차별화**:
- 6대 원전 학술 인용 1회 자연스럽게
- 결정론 (같은 사주 = 같은 결과)
- 한자 1회 등장 시 즉시 일상어 풀이 동반
- strong 강조는 유저 일상 결론에만
- 숫자·시기 또렷이 ('30대 후반' '9월~2월')


✅ **풀이 작성 규칙**:
- **첫 문장은 결론** ('{유저명} 님은 ~한 사람입니다')
- **비유는 한 번만, 즉시 결론 풀이** ('겨울에 태어난 태양 → 즉, ~한 사람')
- **한자 등장 직후 일상어 풀이 동반** ('병화(丙火) — 즉 밝고 활달한 성격')
- 단정 X / 모호 X / 중의 X — 그냥 직접 말하기.

✅ **변환 예시**:
- ❌ '도화살(桃花殺)이 강하게 작용합니다.'
- ✅ '<b>도화살(桃花殺)</b> — 즉 <strong>사람을 끌어당기는 매력</strong>이 강해요.'


🚨 **보일러플레이트 절대 금지 (2026-05-05 audit · 회귀 금지)**

동적 작용해야 하는 콘텐츠 = 사주 8글자마다 매번 다른 문장. 10주제 × 5섹션 × 50 필드 모두 적용.

❌ '${config.label}이 좋습니다' / 'X한 사람이에요' (근거 없는 일반론) — 같은 십성 분포면 누구나 똑같은 결과 금지.
❌ '재물 흐름이 좋다' / '연애운이 풀린다' (모호) — 어떤 글자 어떤 자리 때문에 그런지까지.
✅ 사주 글자 직접 호명 — '재성 두 개', '병화 일간', '도화살', '인성 0개', '식신생재 구조', '관성이 일지에 박혀있어'.
✅ 각 sections[].content / sections[].highlight / insightCards[].value / timeline[].description / actionAdvice 에 사주 8글자 중 specific 데이터(글자명·개수·자리·신살명·격국) 1회 이상 직접 호명 mandatory.
✅ sajuBasis 와 sajuConnection 은 이미 전문성 강제 — 하지만 sections·timeline·actionAdvice 도 동일 수준의 specific 호명.

🚨 **example 사용 룰 (회귀 금지)**:
프롬프트 예시의 사주 글자(병화·신금·축미충 등)는 example. 실제 사용자에게는 위 ## 사주 원국 의 진짜 8글자를 인용.
'{유저명}' placeholder 도 위 ## 이름 의 진짜 이름으로 치환.
같은 사주 = 같은 결과 (결정론) / 다른 사주 = 완전히 다른 어휘 (10주제 cross 도 모순 0).


{
  "title": "${d.input?.name||''}님의 ${config.label} 심층분석",
  "overallScore": ${baseScore ? baseScore : '"0-100 정수"'},
  "sajuBasis": "사주 근거 한 줄 (30~50자). 이 점수가 나온 사주적 이유를 십성/오행/신살 등으로 설명. 예: '재성(偏財)이 강하고 식신생재 구조로 재물 흐름이 원활한 사주입니다' / '관성이 약하고 비겁이 과다하여 조직 적응에 보완이 필요한 구조입니다'. 마크다운 금지.",
  "sajuConnection": "800자 이상 · 원국·대운·세운 교차 · 한자 5~8개 허용 · 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 중 최소 1곳 자연스러운 인용 필수. 형식 예시: '적천수에서 재성이 왕하면 관성으로 제압한다고 하였는데, 당신의 경우 ...' 금지: 원문 한자 나열, 번역체. 권장: 한국어 풀이에 녹여서 전달. 마크다운 금지.",
  "summary": "200자 이상. 소름 포인트 포함. 🚨 사주 8글자 specific 데이터 1회 이상 직접 호명 mandatory (보일러플레이트 금지). 마크다운 금지.",
  "sections": [${config.sections.map(s => `{"heading": "${s}", "content": "150자 이상. 🚨 사주 specific 호명 (개수·자리·신살) 1회 이상. 마크다운 금지.", "highlight": "이 섹션 핵심 한 줄 요약 30자 이내 · 🚨 사주 글자 1개 이상 호명 권장", "insightCards": [{"label": "사주용어(漢字)", "value": "핵심 데이터 15~25자 · 🚨 사주 specific 데이터", "type": "info 또는 accent 또는 warning"}]}`).join(', ')}],
  "timeline": [{"period": "시기", "score": 1-10, "description": "60자 이상 · 🚨 해당 시기 대운/세운 간지 + 원국 글자 충돌·합 직접 호명"}, ...6~12개],
  "luckyProfile": {"color": "색상", "direction": "방위", "number": "숫자", "item": "아이템", "bestMonth": "최적월"},
  "actionAdvice": "100자 이상. 지금 당장 할 수 있는 행동. 🚨 사주 specific 데이터(약한 오행·기신·일간 등) 1개 이상 직접 호명 mandatory. 마크다운 금지.",
  ${config.topicDataSchema}
}`;
}

export { TOPIC_CONFIGS };
