import Anthropic from '@anthropic-ai/sdk';

interface TopicConfig {
  label: string;
  sections: string[];
  specificPrompt: string;
  topicDataSchema: string; // topic-specific structured data for visualization
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
- "혹시 ~에 큰 돈을 쓴 적 있지 않나요?" 소름 포인트`,
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
      "wealthPeakPeriod": "재물 전성기 나이대 (예: 35~42세)",
      "bestInvestMonth": "올해 투자 적기 (예: 3~5월)",
      "moneyLeakTrap": "돈 새는 핵심 함정 20자"
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
  moving: {
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
  const config = TOPIC_CONFIGS[topicId];
  if (!config) throw new Error(`알 수 없는 주제: ${topicId}`);

  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt(config, topicId, sajuData, baseScore, partnerInfo, extraInfo);

  // 전 주제 Haiku 4.5 통일 — 프롬프트가 충분히 정교하므로 퀄리티 유지, 속도 2~3배 향상
  // Sonnet 4 ~50tok/s → Haiku 4.5 ~150tok/s (3배 빠름)
  const model = 'claude-haiku-4-5-20251001';
  // 재회운 10섹션 + 풍부한 topicData → 12000, 나머지 5섹션 → 6000
  const maxTokens = topicId === 'reunion' ? 12000 : 6000;

  const msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (msg.content[0] as any).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON 파싱 실패');
  return JSON.parse(jsonMatch[0]);
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
    } else if (topicId === 'moving' && extraInfo.movePurpose) {
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

  return `명리학 40년 대가. "${config.label}" 심층 분석. "소름돋는" 수준.

⚠️ 현재 날짜: ${dateStr} — 반드시 이 기준으로 과거/현재/미래 구분.

## 사주 원국
${pillarsText}일간: ${p[2]?.천간 || '미상'}

## 오행: 목${el.목||0} 화${el.화||0} 토${el.토||0} 금${el.금||0} 수${el.수||0}
${Object.entries(el).filter(([,v]) => v === 0).map(([k]) => `→ ${k} 없음`).join('\n')}

## 십성: ${sipsung || '미상'}
## 현재 대운: ${currentDaeun ? currentDaeun.간지 : '미상'}
## 이름: ${d.input?.name||'미상'}, ${d.input?.gender==='male'?'남':'여'}
${partnerSection}${extraSection}
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
{
  "title": "${d.input?.name||''}님의 ${config.label} 심층분석",
  "overallScore": ${baseScore ? baseScore : '"0-100 정수"'},
  "sajuBasis": "사주 근거 한 줄 (30~50자). 이 점수가 나온 사주적 이유를 십성/오행/신살 등으로 설명. 예: '재성(偏財)이 강하고 식신생재 구조로 재물 흐름이 원활한 사주입니다' / '관성이 약하고 비겁이 과다하여 조직 적응에 보완이 필요한 구조입니다'. 마크다운 금지.",
  "summary": "200자 이상. 소름 포인트 포함. 마크다운 금지.",
  "sections": [${config.sections.map(s => `{"heading": "${s}", "content": "150자 이상. 마크다운 금지.", "highlight": "이 섹션 핵심 한 줄 요약 30자 이내", "insightCards": [{"label": "사주용어(漢字)", "value": "핵심 데이터 15~25자", "type": "info 또는 accent 또는 warning"}]}`).join(', ')}],
  "timeline": [{"period": "시기", "score": 1-10, "description": "60자 이상"}, ...6~12개],
  "luckyProfile": {"color": "색상", "direction": "방위", "number": "숫자", "item": "아이템", "bestMonth": "최적월"},
  "actionAdvice": "100자 이상. 지금 당장 할 수 있는 행동. 마크다운 금지.",
  ${config.topicDataSchema}
}`;
}

export { TOPIC_CONFIGS };
