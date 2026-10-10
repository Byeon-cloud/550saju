/**
 * 사주500 학술 근거 데이터
 * 사주명리학(四柱命理學)의 고전 원전, 학술 기반, 이론 체계를 정리한 레퍼런스
 *
 * 용도: 앱 내 "학술적 근거" 섹션, 신뢰도 표시, About 페이지 등
 */

// ============================================================
// 1. 고전 원전 (Classical Texts / 古典原典)
// ============================================================

export interface ClassicalText {
  id: string;
  /** 한국어 제목 */
  titleKo: string;
  /** 한자 제목 */
  titleHanja: string;
  /** 중국어 병음 (참고용) */
  titlePinyin: string;
  /** 저자/편찬자 */
  author: string;
  /** 저자 한자 */
  authorHanja: string;
  /** 시대 */
  era: string;
  /** 대략적 연도 (정렬/표시용) */
  yearApprox: string;
  /** 한 줄 설명 */
  description: string;
  /** 명리학에서의 위상/역할 */
  significance: string;
  /** 핵심 주제 태그 */
  tags: string[];
}

export const CLASSICAL_TEXTS: ClassicalText[] = [
  // ── 선진~수당: 기초 이론 형성기 ──
  {
    id: 'yijing',
    titleKo: '주역',
    titleHanja: '周易',
    titlePinyin: 'Zhōu Yì',
    author: '전통적으로 복희, 문왕, 주공, 공자에 귀속',
    authorHanja: '伏羲 文王 周公 孔子',
    era: '서주~전국시대',
    yearApprox: 'BC 1000~BC 300',
    description: '음양(陰陽) 사상과 64괘 체계를 담은 동양 철학의 최고 원전',
    significance: '명리학의 철학적 뿌리. 음양론, 변화론, 상수학의 원천',
    tags: ['음양론', '상수학', '원류'],
  },
  {
    id: 'wuxingdayi',
    titleKo: '오행대의',
    titleHanja: '五行大義',
    titlePinyin: 'Wǔ Xíng Dà Yì',
    author: '소길',
    authorHanja: '蕭吉',
    era: '수(隋)나라',
    yearApprox: '약 594년',
    description: '오행(五行)에 관한 거의 모든 고대 자료를 발췌와 집대성한 백과사전적 저작',
    significance: '오행론의 종합 정리서. 목, 화, 토, 금, 수의 생극제화 이론 체계화',
    tags: ['오행론', '기초이론', '집대성'],
  },

  // ── 당·송: 사주명리학 성립기 ──
  {
    id: 'lizhongming',
    titleKo: '이허중명서',
    titleHanja: '李虛中命書',
    titlePinyin: 'Lǐ Xū Zhōng Mìng Shū',
    author: '이허중',
    authorHanja: '李虛中',
    era: '당(唐)나라',
    yearApprox: '약 800년',
    description: '연, 월, 일 3주(三柱)로 인간의 운명을 분석한 최초의 체계적 명리서',
    significance: '명리학의 시조. 간지(干支)로 운명을 논하는 체계의 최초 확립자',
    tags: ['삼주법', '명리학 시원', '당사주'],
  },
  {
    id: 'yuanhaiziping',
    titleKo: '연해자평',
    titleHanja: '淵海子平',
    titlePinyin: 'Yuān Hǎi Zǐ Píng',
    author: '서승(편찬), 서자평(이론 원류)',
    authorHanja: '徐升(編), 徐子平(原)',
    era: '남송(南宋)',
    yearApprox: '약 1234년',
    description: '서자평의 사주 이론을 집대성한 최초의 자평명리학 교과서',
    significance: '일간(日干) 중심 해석법을 확립. 시주(時柱)를 추가하여 사주(四柱) 체계를 완성한 혁신적 저작',
    tags: ['자평학 원류', '사주 체계', '일간 중심', '격국론'],
  },

  // ── 명: 이론 확장기 ──
  {
    id: 'ditian sui',
    titleKo: '적천수',
    titleHanja: '滴天髓',
    titlePinyin: 'Dī Tiān Suǐ',
    author: '경도(원저), 유기/유백온(주석 — 저자 논쟁 있음)',
    authorHanja: '京圖(原著), 劉基/劉伯溫(撰註)',
    era: '송말~명초',
    yearApprox: '약 1300~1368년',
    description: '7언 운문 형식으로 천간, 지지, 체용, 강약 등 명리 핵심 원리를 압축한 최고봉 이론서',
    significance: '명리학 3대 고전 중 하나. "기운과 흐름"의 관점에서 사주를 해석하는 방법론의 원전',
    tags: ['3대 고전', '체용론', '강약론', '기운 흐름'],
  },
  {
    id: 'sanmingtunghui',
    titleKo: '삼명통회',
    titleHanja: '三命通會',
    titlePinyin: 'Sān Mìng Tōng Huì',
    author: '만민영',
    authorHanja: '萬民英',
    era: '명(明)나라',
    yearApprox: '약 1550년',
    description: '이전의 모든 명리 이론과 산발적 고서를 집대성한 명리학의 백과사전',
    significance: '200여 년의 팔자학 역사를 총정리. 납음, 신살, 격국 등 전 영역을 망라한 최대 규모 저작',
    tags: ['집대성', '백과사전', '납음', '신살', '격국론'],
  },
  {
    id: 'mingli-zhengzong',
    titleKo: '명리약언 / 신봉통고',
    titleHanja: '命理正宗 / 神峰通考',
    titlePinyin: 'Mìng Lǐ Zhèng Zōng / Shén Fēng Tōng Kǎo',
    author: '장남(장신봉)',
    authorHanja: '張楠(張神峰)',
    era: '명(明)나라',
    yearApprox: '약 1580년',
    description: '병, 사, 묘, 절(病死墓絶) 등 12운성의 실전 적용과 격국 분석을 정리한 실전서',
    significance: '12운성 해석법의 정립. 격국 판단의 실전적 기준을 제시',
    tags: ['12운성', '격국론', '실전'],
  },

  // ── 청: 이론 정밀화기 ──
  {
    id: 'gungtonbogam',
    titleKo: '궁통보감 (원명: 난강망)',
    titleHanja: '窮通寶鑑 (欄江網)',
    titlePinyin: 'Qióng Tōng Bǎo Jiàn (Lán Jiāng Wǎng)',
    author: '원저 미상(명대), 여춘태(청대 재편찬)',
    authorHanja: '原著未詳(明代), 余春台(清代 整理)',
    era: '명~청',
    yearApprox: '청 가경연간 (약 1796~1820)',
    description: '월령(月令)별 일간의 조후(調候) 용신을 체계적으로 정리한 조후론의 핵심 원전',
    significance: '명리학 3대 고전 중 하나. "환경과 조화"의 관점에서 계절과 기후에 따른 오행 배합을 논함',
    tags: ['3대 고전', '조후론', '월령', '용신'],
  },
  {
    id: 'zipingzhenquan',
    titleKo: '자평진전',
    titleHanja: '子平眞詮',
    titlePinyin: 'Zǐ Píng Zhēn Quán',
    author: '심효첨',
    authorHanja: '沈孝瞻',
    era: '청(清)나라 건륭연간',
    yearApprox: '약 1750년',
    description: '격국(格局)과 용신(用神)을 월령에서 구하는 이론을 48장으로 체계화한 정통 격국론 교과서',
    significance: '명리학 3대 고전 중 하나. "구조와 틀"의 관점에서 격국용신론을 가장 정밀하게 정리',
    tags: ['3대 고전', '격국론', '용신론', '월령격'],
  },
  {
    id: 'mingliyaoyan',
    titleKo: '명리약언',
    titleHanja: '命理約言',
    titlePinyin: 'Mìng Lǐ Yuē Yán',
    author: '진소암(진지린)',
    authorHanja: '陳素庵(陳之遴)',
    era: '청(清)나라 초기',
    yearApprox: '약 1650년',
    description: '간명법 48장, 부 20장, 논 48장, 잡론 24칙의 4권 구성으로 명리 요점을 간결하게 정리',
    significance: '고전 격국과 신살 이론의 오류를 비판적으로 검토한 선구적 저작',
    tags: ['비판적 검토', '간명법', '격국론'],
  },

  // ── 청 후기~근대: 주석·재해석기 ──
  {
    id: 'ditian-sui-chanwei',
    titleKo: '적천수천미',
    titleHanja: '滴天髓闡微',
    titlePinyin: 'Dī Tiān Suǐ Chǎn Wēi',
    author: '임철초(주석)',
    authorHanja: '任鐵樵(註)',
    era: '청(清)나라 후기',
    yearApprox: '1848년 주석, 1933년 출판',
    description: '적천수 원문에 실전 사례와 심층 주석을 붙인 명리학 최고의 주석서',
    significance: '적천수의 추상적 이론을 실전 사례로 풀어낸 결정판. 현대 명리학의 교과서적 위상',
    tags: ['적천수 주석', '실전 사례', '체용론'],
  },
  {
    id: 'ditian-sui-zhengyi',
    titleKo: '적천수징의',
    titleHanja: '滴天髓徵義',
    titlePinyin: 'Dī Tiān Suǐ Zhēng Yì',
    author: '서락오',
    authorHanja: '徐樂吾',
    era: '중화민국 초기',
    yearApprox: '1934년',
    description: '적천수에 대한 서락오의 독자적 주석서. 논리적 체계화에 기여',
    significance: '근대 명리학의 논리적 체계 확립에 큰 영향. 한국 명리학계에도 깊은 영향',
    tags: ['적천수 주석', '근대 체계화', '서락오'],
  },
  {
    id: 'zipingzhenquan-pingzhu',
    titleKo: '자평진전평주',
    titleHanja: '子平眞詮評註',
    titlePinyin: 'Zǐ Píng Zhēn Quán Píng Zhù',
    author: '서락오(평주)',
    authorHanja: '徐樂吾(評註)',
    era: '중화민국',
    yearApprox: '약 1930년대',
    description: '자평진전 원문에 서락오가 평론과 주석을 더한 근대 명리학의 중요 참고서',
    significance: '격국용신론을 근대적 논리로 재정리. 현대 한, 중, 일 명리학의 기본 교재',
    tags: ['자평진전 주석', '격국론', '서락오'],
  },
];

// ============================================================
// 2. 핵심 이론 체계 (Theoretical Frameworks)
// ============================================================

export interface TheoreticalFramework {
  id: string;
  /** 이론명 (한국어) */
  nameKo: string;
  /** 이론명 (한자) */
  nameHanja: string;
  /** 한 줄 설명 */
  description: string;
  /** 상세 설명 */
  detail: string;
  /** 근거 고전 */
  sourceTexts: string[];
  /** 사주500에서의 활용 */
  applicationInApp: string;
}

export const THEORETICAL_FRAMEWORKS: TheoreticalFramework[] = [
  {
    id: 'eumyang',
    nameKo: '음양론',
    nameHanja: '陰陽論',
    description: '만물을 음(陰)과 양(陽)의 대립과 조화로 설명하는 동양 철학의 근본 원리',
    detail:
      '천간 10자와 지지 12자 각각에 음양을 배속하여, 사주 원국의 음양 균형과 편중을 분석합니다. 양이 강하면 외향적과 능동적, 음이 강하면 내향적과 수렴적 성향으로 해석합니다.',
    sourceTexts: ['주역(周易)', '오행대의(五行大義)'],
    applicationInApp: '사주 원국의 음양 비율 분석, 성격 기질 판단의 기초',
  },
  {
    id: 'oheng',
    nameKo: '오행론',
    nameHanja: '五行論',
    description: '목(木), 화(火), 토(土), 금(金), 수(水) 다섯 가지 기운의 상생과 상극 관계 체계',
    detail:
      '오행의 생(生), 극(剋), 제(制), 화(化) 관계를 통해 사주 원국의 에너지 흐름과 균형을 파악합니다. 상생은 돕는 관계(목생화, 화생토 등), 상극은 제어하는 관계(목극토, 토극수 등)입니다.',
    sourceTexts: ['오행대의(五行大義)', '연해자평(淵海子平)', '삼명통회(三命通會)'],
    applicationInApp: '오행 분포도(레이더 차트), 보충 오행 추천, 개운법 산출',
  },
  {
    id: 'sipsung',
    nameKo: '십성론',
    nameHanja: '十星論 / 十神論',
    description: '일간을 기준으로 다른 7글자와의 관계를 10가지 유형으로 분류하는 체계',
    detail:
      '비견, 겁재, 식신, 상관, 편재, 정재, 편관, 정관, 편인, 정인의 10가지 관계를 통해 성격, 직업적성, 대인관계, 재물운 등을 해석합니다. 일간이 "나"이고, 나와 같은 오행은 비겁, 내가 생하는 오행은 식상, 내가 극하는 오행은 재성 등으로 분류합니다.',
    sourceTexts: ['연해자평(淵海子平)', '자평진전(子平眞詮)', '적천수(滴天髓)'],
    applicationInApp: '성격 분석, 직업적성 매칭, 대인관계 유형 판단, 재물운 해석',
  },
  {
    id: 'gyeokguk',
    nameKo: '격국론',
    nameHanja: '格局論',
    description: '월령(月令)의 지장간을 기준으로 사주의 구조적 유형(격국)을 판별하는 이론',
    detail:
      '정격 8격(정관격, 편관격, 정인격, 편인격, 정재격, 편재격, 식신격, 상관격)과 특별격(종격과 화격 등)으로 사주의 근본 구조를 분류합니다. 격국은 사주의 "설계도"에 해당하며, 어떤 방향으로 인생이 전개될지의 큰 틀을 보여줍니다.',
    sourceTexts: ['자평진전(子平眞詮)', '연해자평(淵海子平)', '삼명통회(三命通會)'],
    applicationInApp: '사주 구조 분석, 직업운과 재물운의 방향성 판단',
  },
  {
    id: 'yongsin',
    nameKo: '용신론',
    nameHanja: '用神論',
    description: '사주 원국에서 가장 필요한 글자(용신)를 찾아 길흉을 판단하는 핵심 이론',
    detail:
      '용신(用神)은 사주의 균형을 잡아주는 가장 중요한 글자입니다. 억부법(강한 것은 억제, 약한 것은 보강), 조후법(계절에 따른 한난조습 조절), 통관법(상극 관계를 중재), 병약법(병이 있으면 약을 찾음) 등의 방법론이 있습니다.',
    sourceTexts: [
      '자평진전(子平眞詮)',
      '궁통보감(窮通寶鑑)',
      '적천수(滴天髓)',
      '적천수천미(滴天髓闡微)',
    ],
    applicationInApp: '개운법 산출, 행운 프로필(색상, 방위, 숫자) 추천의 근거',
  },
  {
    id: 'johu',
    nameKo: '조후론',
    nameHanja: '調候論',
    description: '태어난 계절(월령)의 한난조습(寒暖燥濕)에 따라 필요한 오행을 판단하는 이론',
    detail:
      '겨울에 태어난 사주는 화(火)의 따뜻함이 필요하고, 여름에 태어난 사주는 수(水)의 시원함이 필요하다는 원리입니다. 궁통보감이 이 이론의 핵심 원전이며, 월령별로 각 일간에 필요한 조후 용신을 체계적으로 정리하고 있습니다.',
    sourceTexts: ['궁통보감(窮通寶鑑)', '적천수(滴天髓)'],
    applicationInApp: '계절별 운세 분석, 보충 오행 추천, 건강 주의사항',
  },
  {
    id: 'ukbu',
    nameKo: '억부론',
    nameHanja: '抑扶論',
    description: '일간의 강약을 판단하여, 강하면 억제(抑)하고 약하면 부조(扶)하는 균형 이론',
    detail:
      '일간이 강하면(인성과 비겁이 많으면) 식상, 재성, 관성으로 설기시켜 균형을 맞추고, 일간이 약하면(관살과 재성이 많으면) 인성과 비겁으로 보강합니다. 현대 명리학에서 가장 보편적으로 사용되는 용신 판단법입니다.',
    sourceTexts: ['적천수(滴天髓)', '적천수천미(滴天髓闡微)', '자평진전(子平眞詮)'],
    applicationInApp: '일간 강약 판단, 용신과 희신 산출, 대운 길흉 분석',
  },
  {
    id: 'daeun',
    nameKo: '대운론 / 행운론',
    nameHanja: '大運論 / 行運論',
    description: '10년 단위의 대운(大運)과 매년의 세운(歲運)으로 시간적 운세 변화를 분석하는 이론',
    detail:
      '대운은 월주를 기점으로 순행 또는 역행하며 10년 단위로 바뀝니다. 대운의 천간과 지지가 사주 원국과 어떤 관계를 맺느냐에 따라 해당 시기의 길흉이 결정됩니다. 세운(년운)은 매년 바뀌는 운으로, 대운과 함께 복합적으로 작용합니다.',
    sourceTexts: ['연해자평(淵海子平)', '적천수(滴天髓)', '삼명통회(三命通會)'],
    applicationInApp: '대운 타임라인, 올해 운세, 월운 차트',
  },
  {
    id: 'jichanggan',
    nameKo: '지장간론',
    nameHanja: '支藏干論',
    description: '지지(地支) 속에 숨어 있는 천간(天干)을 분석하여 내면의 작용을 파악하는 이론',
    detail:
      '12지지 각각에는 1~3개의 천간이 숨어 있습니다(여기, 중기, 본기). 이 지장간들이 사주 원국에서 어떤 십성 역할을 하는지 분석하면, 겉으로 드러나지 않는 내면의 성향과 잠재력을 파악할 수 있습니다.',
    sourceTexts: ['연해자평(淵海子平)', '삼명통회(三命通會)', '자평진전(子平眞詮)'],
    applicationInApp: '숨은 성향 분석, 내면 에너지 파악, 잠재력 발굴',
  },
  {
    id: 'sibiunsung',
    nameKo: '12운성론',
    nameHanja: '十二運星論',
    description: '천간이 12지지를 만나 거치는 12단계 에너지 순환 과정을 분석하는 이론',
    detail:
      '장생, 목욕, 관대, 건록, 제왕, 쇠, 병, 사, 묘, 절, 태, 양의 12단계로 에너지 상태를 파악합니다. 이것은 생물학적 "죽음"이 아니라 에너지의 순환과 변화를 상징합니다. 제왕은 에너지의 정점, 절은 새로운 시작 직전의 준비 단계입니다.',
    sourceTexts: ['연해자평(淵海子平)', '삼명통회(三命通會)', '명리약언(命理正宗)'],
    applicationInApp: '에너지 상태 표시, 현재 인생 단계 해석',
  },
  {
    id: 'sinsal',
    nameKo: '신살론',
    nameHanja: '神煞論',
    description: '특정 간지 조합에서 나타나는 길신(吉神)과 흉살(凶煞)을 분석하는 보조 이론',
    detail:
      '천을귀인, 문창귀인, 역마, 도화, 화개 등의 길신과, 양인, 공망, 겁살 등의 흉살이 있습니다. 현대 명리학에서는 신살을 절대적 길흉이 아닌 "경향성"으로 해석하며, 보조적 참고 자료로 활용합니다.',
    sourceTexts: ['삼명통회(三命通會)', '연해자평(淵海子平)'],
    applicationInApp: '경향성 분석(보조), 재능과 주의사항 보충 설명',
  },
  {
    id: 'napeum',
    nameKo: '납음론',
    nameHanja: '納音論',
    description: '60갑자 각각에 배속된 고유 오행(납음오행)으로 근본 에너지 성질을 파악하는 이론',
    detail:
      '해중금(海中金), 노중화(爐中火), 대림목(大林木) 등 60갑자의 납음은 단순한 오행보다 구체적인 에너지 속성을 나타냅니다. 예를 들어 같은 금(金)이라도 "바다 속의 금"과 "검 위의 금"은 성질이 다릅니다.',
    sourceTexts: ['삼명통회(三命通會)', '연해자평(淵海子平)', '오행대의(五行大義)'],
    applicationInApp: '납음 오행 표시, 근본 에너지 성질 해석',
  },
];

// ============================================================
// 3. 역대 핵심 명리학자 (Key Historical Scholars)
// ============================================================

export interface HistoricalScholar {
  id: string;
  nameKo: string;
  nameHanja: string;
  era: string;
  yearApprox: string;
  /** 주요 업적/공헌 */
  contribution: string;
  /** 대표 저작 */
  majorWorks: string[];
}

export const HISTORICAL_SCHOLARS: HistoricalScholar[] = [
  {
    id: 'li-xuzhong',
    nameKo: '이허중',
    nameHanja: '李虛中',
    era: '당(唐)나라',
    yearApprox: '약 761~813',
    contribution: '연, 월, 일 3주(三柱)를 사용한 명리학의 창시자. "당사주(唐四柱)"의 원류',
    majorWorks: ['이허중명서(李虛中命書)'],
  },
  {
    id: 'xu-ziping',
    nameKo: '서자평',
    nameHanja: '徐子平',
    era: '북송(北宋)',
    yearApprox: '약 907~960',
    contribution: '시주(時柱)를 추가하여 사주(四柱) 체계를 확립하고, 일간(日干) 중심 해석법을 정립. 자평명리학(子平命理學)의 창시자',
    majorWorks: ['낙록자삼명소식부주(珞琭子三命消息賦注)'],
  },
  {
    id: 'xu-sheng',
    nameKo: '서승',
    nameHanja: '徐升',
    era: '남송(南宋)',
    yearApprox: '약 1200년대',
    contribution: '서자평의 이론을 정리와 편찬하여 연해자평을 엮음',
    majorWorks: ['연해자평(淵海子平)'],
  },
  {
    id: 'jingtu',
    nameKo: '경도',
    nameHanja: '京圖',
    era: '송말~원초',
    yearApprox: '약 1200~1300',
    contribution: '적천수(滴天髓) 원문의 저자로 전해짐 (저자 논쟁 존재)',
    majorWorks: ['적천수(滴天髓) 원문'],
  },
  {
    id: 'liu-bowen',
    nameKo: '유기(유백온)',
    nameHanja: '劉基(劉伯溫)',
    era: '원말~명초',
    yearApprox: '1311~1375',
    contribution: '명나라 개국공신. 적천수의 주석자로 전해짐. 명리학의 이론적 체계를 확장',
    majorWorks: ['적천수(滴天髓) 주석'],
  },
  {
    id: 'wan-minying',
    nameKo: '만민영',
    nameHanja: '萬民英',
    era: '명(明)나라',
    yearApprox: '약 1500년대',
    contribution: '이전의 모든 명리 이론과 고서를 집대성하여 삼명통회를 편찬. 명리학의 백과사전을 완성',
    majorWorks: ['삼명통회(三命通會)'],
  },
  {
    id: 'zhang-nan',
    nameKo: '장남(장신봉)',
    nameHanja: '張楠(張神峰)',
    era: '명(明)나라',
    yearApprox: '약 1500년대 후반',
    contribution: '12운성의 실전 적용법과 격국 판단 기준을 정립',
    majorWorks: ['명리약언(命理正宗)', '신봉통고(神峰通考)'],
  },
  {
    id: 'chen-suoan',
    nameKo: '진소암(진지린)',
    nameHanja: '陳素庵(陳之遴)',
    era: '청(清)나라 초기',
    yearApprox: '1605~1666',
    contribution: '명리약언을 통해 기존 격국과 신살 이론의 오류를 비판적으로 검토한 선구자',
    majorWorks: ['명리약언(命理約言)'],
  },
  {
    id: 'shen-xiaoyu',
    nameKo: '심효첨',
    nameHanja: '沈孝瞻',
    era: '청(清)나라 건륭연간',
    yearApprox: '약 1700년대',
    contribution: '격국과 용신을 월령에서 구하는 이론을 48장으로 체계화. 격국용신론의 완성자',
    majorWorks: ['자평진전(子平眞詮)'],
  },
  {
    id: 'ren-tieqiao',
    nameKo: '임철초',
    nameHanja: '任鐵樵',
    era: '청(清)나라 후기',
    yearApprox: '1773~?',
    contribution: '적천수 원문에 실전 사례와 심층 주석을 붙여 적천수천미를 완성. 현대 명리학의 교과서적 위상 확립',
    majorWorks: ['적천수천미(滴天髓闡微)'],
  },
  {
    id: 'xu-lewu',
    nameKo: '서락오',
    nameHanja: '徐樂吾',
    era: '중화민국 초기',
    yearApprox: '1886~1948',
    contribution: '적천수징의와 자평진전평주 등 다수의 주석서를 통해 명리학의 논리적 체계를 근대적으로 정립. 한, 중, 일 현대 명리학에 지대한 영향',
    majorWorks: [
      '적천수징의(滴天髓徵義)',
      '자평진전평주(子平眞詮評註)',
      '궁통보감평주(窮通寶鑑評註)',
      '적천수보주(滴天髓補註)',
    ],
  },
];

// ============================================================
// 4. 한국 학술 기반 (Korean Academic Foundation)
// ============================================================

export interface KoreanAcademicInfo {
  category: string;
  items: {
    name: string;
    detail: string;
    url?: string;
  }[];
}

export const KOREAN_ACADEMIC_INFO: KoreanAcademicInfo[] = [
  {
    category: '대학 교육과정',
    items: [
      {
        name: '원광대학교 동양학대학원 동양철학전공',
        detail:
          '석사와 박사과정. 명리학, 풍수, 주역, 음양오행론, 술수학, 동양천문학 등 개설. 문학석사/문학박사 수여',
        url: 'https://orient.wku.ac.kr/',
      },
      {
        name: '원광디지털대학교 동양학과',
        detail:
          '고전 명리 이론과 현대 사회 응용 명리 실관 교육. 온라인 학사과정',
        url: 'https://www.wdu.ac.kr/introductionM/culture/orient01.do',
      },
      {
        name: '동방대학원대학교',
        detail: '평생교육원 명리학 전문가과정 운영',
      },
      {
        name: '울산대학교 철학과 상담학과',
        detail: '사주명리학 자격검정시험 연계 교육',
      },
      {
        name: '연세대학교 미래교육원',
        detail: '고전명리학 사례연구 강좌 개설',
        url: 'https://go.yonsei.ac.kr/',
      },
    ],
  },
  {
    category: '학술 단체',
    items: [
      {
        name: '한국명리학회 (K-MRA)',
        detail:
          '사주명리학과 관상학 연구. 자평명리학 이론 정립 및 학술자료 발간',
        url: 'https://www.k-mra.com/',
      },
      {
        name: '대한동의명학회',
        detail: '동의명리학(東醫命理學) 연구. 명리학과 한의학의 융합 연구',
      },
      {
        name: '한국철학회',
        detail: '동양철학 분과에서 음양오행론과 역학 관련 논문 게재',
        url: 'https://hanchul.org/',
      },
    ],
  },
  {
    category: '학술 논문 DB',
    items: [
      {
        name: 'KCI (한국학술지인용색인)',
        detail:
          '2006~2024년 기준 사주명리학 관련 학술 논문 205편 이상 수록. 철학, 상담학, 교육학 분야 학제적 연구 활발',
        url: 'https://www.kci.go.kr/',
      },
      {
        name: 'DBpia',
        detail: '명리학 관련 학술지 논문 검색. 실천민속학연구 등 관련 학술지 수록',
        url: 'https://www.dbpia.co.kr/',
      },
      {
        name: 'KISS (한국학술정보)',
        detail: '동양철학과 명리학 관련 논문 검색',
        url: 'https://kiss.kstudy.com/',
      },
    ],
  },
  {
    category: '주요 연구 분야 (2006~2024 논문 기준)',
    items: [
      {
        name: '철학적 연구',
        detail: '명리학의 음양오행론적 기초, 고전 해석, 이론사 연구',
      },
      {
        name: '사회문화적 연구',
        detail: '한국 사회에서의 명리 문화, 상담 현장 연구',
      },
      {
        name: '심리학과 상담학 융합',
        detail: 'MBTI와 사주명리의 연관성, 명리심리상담 방법론',
      },
      {
        name: '건축과 주거 연구',
        detail: '사주명리학을 활용한 거주자 평가 방법',
      },
    ],
  },
];

// ============================================================
// 5. 앱 표시용 요약 데이터
// ============================================================

/** 3대 고전 (앱에서 자주 인용) */
export const TOP_3_CLASSICS = CLASSICAL_TEXTS.filter((t) =>
  t.tags.includes('3대 고전')
);

/** 이론 체계 요약 (앱 About 페이지용) */
export const METHODOLOGY_SUMMARY = {
  title: '사주500의 해석 방법론',
  subtitle: '천 년의 학술적 전통에 기반한 AI 명리 분석',
  description:
    '사주500은 당나라 이허중(李虛中, 8세기)의 삼주법에서 시작하여 송나라 서자평(徐子平)이 확립한 자평명리학을 기반으로, 적천수, 자평진전, 궁통보감 등 명리학 3대 고전의 이론 체계를 AI가 종합적으로 분석합니다.',
  coreMethodologies: [
    '음양오행론(陰陽五行論): 주역과 오행대의에 근거한 에너지 균형 분석',
    '십성론(十神論): 연해자평에서 확립된 10가지 인간관계 유형 분석',
    '격국론(格局論): 자평진전의 월령 중심 사주 구조 분류 체계',
    '용신론(用神論): 적천수와 궁통보감의 억부와 조후법에 의한 핵심 기운 산출',
    '대운론(大運論): 10년 주기의 운세 변화 흐름 분석',
  ],
  historicalDepth: '약 1,200년의 학술적 전통 (당 이허중 ~ 현대)',
  classicalTextsCount: CLASSICAL_TEXTS.length,
  scholarsCount: HISTORICAL_SCHOLARS.length,
};

/** 학술 근거 배지 (결과 페이지 하단 표시용) */
export const CREDIBILITY_BADGES = [
  {
    icon: 'book',
    label: '고전 원전',
    value: `${CLASSICAL_TEXTS.length}권`,
    description: '적천수, 자평진전, 궁통보감 등',
  },
  {
    icon: 'history',
    label: '학술 역사',
    value: '1,200년+',
    description: '당나라(8C)~현대',
  },
  {
    icon: 'theory',
    label: '이론 체계',
    value: `${THEORETICAL_FRAMEWORKS.length}개`,
    description: '음양오행, 십성, 격국, 용신 등',
  },
  {
    icon: 'scholar',
    label: '역대 학자',
    value: `${HISTORICAL_SCHOLARS.length}인`,
    description: '이허중, 서자평, 임철초, 서락오 등',
  },
  {
    icon: 'paper',
    label: 'KCI 논문',
    value: '205편+',
    description: '2006~2024 한국학술지인용색인',
  },
];
