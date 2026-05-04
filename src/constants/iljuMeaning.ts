/**
 * #saju-card-share Stage 6 · 60갑자 일주 풀이 (재정비)
 *
 * 변경 (Stage 5 → Stage 6 CDO 결단):
 *   - 삭제: subtitle (별명: "노란 닭" / "쇠와 닭의 결합" 등 민속 표현)
 *   - 삭제: meaning (단일 문장, identity + description 으로 분리)
 *   - 추가: identity (22pt hero 한 줄, 정체성 노운구) — "가을 들녘의 단단한 흙"
 *   - 추가: description (16pt 2줄, 성격/행동 풀이) — "정밀한 손길로 한 알씩\n결실을 쌓아가는 사람"
 *   - 유지: personality (요약 키워드 — "꾸준함·정밀·결실")
 *   - 유지: hanja (간지 한자)
 *
 * 톤:
 *   - 학술 + 시적 30%, 명료 70%
 *   - identity: 6~14자 노운구 (자연/사물/공간 메타포)
 *   - description: 18~28자 인물/행동 메타포 (가능 시 \n 으로 2 줄 분리)
 *   - 별명·동물 표현 0건 ("노란 닭", "황계", "검은 토끼" 등 폐기)
 *
 * 60갑자 = 10 천간 × 12 지지 (음양 조합으로 60종, 일주별 고유)
 */

export interface IljuMeaning {
  /** 일주 한자 (예: "己酉") */
  hanja: string;
  /** 정체성 한 줄 (22pt 노운구, 예: "가을 들녘의 단단한 흙") */
  identity: string;
  /** 풀이 (16pt 2줄, 예: "정밀한 손길로 한 알씩\n결실을 쌓아가는 사람") */
  description: string;
  /** 사람 유형 키워드 (예: "꾸준함·정밀·결실") */
  personality: string;
}

/* ══════════════════════════════════════════════════════════════════
 * 60갑자 일주 풀이 (identity + description 분리형)
 * ═════════════════════════════════════════════════════════════════ */

export const ILJU_MEANING: Record<string, IljuMeaning> = {
  // 甲 (큰 나무) — 곧음·성장·시작
  甲子: { hanja: '甲子', identity: '새벽을 향해 뻗는 거목',           description: '곧게 뿌리내려\n첫 시도에 강한 사람',           personality: '리더십·첫 시도·꾸준함' },
  甲寅: { hanja: '甲寅', identity: '산 정상에 우뚝 선 거목',           description: '권위와 자기 주도로\n결단을 내리는 사람',         personality: '카리스마·독립·직진형' },
  甲辰: { hanja: '甲辰', identity: '용이 머무는 못 옆 거목',           description: '단단한 뿌리 위에서\n야망을 키우는 사람',         personality: '야심·통솔·깊은 신념' },
  甲午: { hanja: '甲午', identity: '한낮 햇빛에 곧게 자란 나무',       description: '활동력 강하고\n표현이 명료한 사람',             personality: '추진력·표현·열정' },
  甲申: { hanja: '甲申', identity: '서리 내린 산을 견뎌낸 나무',       description: '단단함과 유연함을\n조화롭게 갖춘 사람',         personality: '인내·기지·균형' },
  甲戌: { hanja: '甲戌', identity: '늦가을 단단해진 고목',             description: '의리와 약속을 지키며\n신뢰를 쌓는 사람',         personality: '신뢰·지조·책임감' },

  // 乙 (작은 풀·덩굴) — 부드러움·끈기·적응
  乙丑: { hanja: '乙丑', identity: '얼은 흙을 뚫는 새싹',               description: '부드럽지만 우직하게\n끝까지 가는 사람',         personality: '인내·온화·꾸준함' },
  乙卯: { hanja: '乙卯', identity: '봄바람에 흔들리는 어린 풀',         description: '섬세한 감각과 영민함을\n함께 지닌 사람',         personality: '감수성·재주·민첩' },
  乙巳: { hanja: '乙巳', identity: '햇빛에 활짝 피는 꽃',               description: '매력과 통찰로\n사람을 끌어모으는 사람',           personality: '매력·직관·표현력' },
  乙未: { hanja: '乙未', identity: '한여름 들녘 고개 숙인 곡식',         description: '평화로운 결실로\n사람을 화합시키는 사람',         personality: '온유·인정·중재' },
  乙酉: { hanja: '乙酉', identity: '서리 맞은 가을 풀',                 description: '부드러움과 정확함으로\n섬세히 다듬는 사람',     personality: '정밀·끈기·완성도' },
  乙亥: { hanja: '乙亥', identity: '겨울 강가에 흔들리는 갈대',         description: '흐름 따라 살되\n끝까지 가는 사람',               personality: '유연·여유·지속력' },

  // 丙 (태양) — 열정·밝음·표현
  丙子: { hanja: '丙子', identity: '한밤에도 빛 잃지 않는 별',           description: '어둠 속에서도\n자기 길 보이는 사람',             personality: '의지·통찰·광채' },
  丙寅: { hanja: '丙寅', identity: '동트는 새벽의 첫 햇살',             description: '시작에 강하고 따뜻한\n권위를 가진 사람',         personality: '리더·따뜻함·열정' },
  丙辰: { hanja: '丙辰', identity: '봄 들판을 데우는 정오 햇살',         description: '야심과 따뜻함으로\n사람을 모으는 사람',           personality: '인복·야심·통솔' },
  丙午: { hanja: '丙午', identity: '한낮의 가장 강렬한 태양',           description: '열정과 추진력으로\n멈추지 않는 사람',             personality: '열정·돌파·강한 자아' },
  丙申: { hanja: '丙申', identity: '석양에 길게 드리우는 햇살',         description: '재치와 빛으로\n영리하게 빛나는 사람',             personality: '재기·표현·기지' },
  丙戌: { hanja: '丙戌', identity: '저물녘 능선을 물들이는 노을',       description: '따뜻함과 의리로\n사람을 비추는 사람',             personality: '온정·신뢰·헌신' },

  // 丁 (촛불·등불) — 정밀·따뜻함·세밀함
  丁丑: { hanja: '丁丑', identity: '겨울밤 마구간을 비추는 등불',         description: '우직함과 따뜻함으로\n묵묵히 빛 내는 사람',         personality: '성실·따뜻함·인내' },
  丁卯: { hanja: '丁卯', identity: '봄밤 정원의 작은 촛불',             description: '섬세함과 정밀함으로\n깊이 다듬는 사람',           personality: '섬세·예민·미적 감각' },
  丁巳: { hanja: '丁巳', identity: '여름 저녁 촛불 곁의 빛',             description: '매력과 통찰로\n사람을 끄는 사람',                 personality: '매력·지혜·표현' },
  丁未: { hanja: '丁未', identity: '여름밤 길을 인도하는 등불',         description: '온화하고 정밀하게\n길을 비추는 사람',             personality: '안내·중재·따뜻함' },
  丁酉: { hanja: '丁酉', identity: '가을 서재를 밝히는 깊은 촛불',       description: '학문과 정밀함으로\n깊이 파고드는 사람',           personality: '학문·정밀·집중' },
  丁亥: { hanja: '丁亥', identity: '겨울 밤바다의 작은 등대',           description: '풍요와 정밀로\n어두운 자리 비추는 사람',         personality: '인정·통찰·헌신' },

  // 戊 (높은 산·들) — 묵직·안정·중심
  戊子: { hanja: '戊子', identity: '얼은 강 옆 묵직한 언덕',             description: '안정과 영민함으로\n흔들리지 않는 사람',           personality: '중심·이성·안정' },
  戊寅: { hanja: '戊寅', identity: '봄 산 정상의 너른 평원',             description: '안정된 권위로\n자리를 차지하는 사람',             personality: '권위·중후·리더' },
  戊辰: { hanja: '戊辰', identity: '봄비 머금은 비옥한 밭',             description: '야망과 안정으로\n큰 그릇을 키우는 사람',         personality: '큰 그릇·야심·축적' },
  戊午: { hanja: '戊午', identity: '여름 햇살의 황금빛 들판',           description: '추진과 안정으로\n결실을 만드는 사람',             personality: '추진·결실·안정' },
  戊申: { hanja: '戊申', identity: '가을을 품은 견고한 산허리',         description: '묵직함과 재치로\n안정 위에 영민한 사람',         personality: '관록·기지·안정' },
  戊戌: { hanja: '戊戌', identity: '늦가을 황톳빛 익은 대지',           description: '의리와 결실로\n신뢰를 쌓는 사람',                 personality: '신뢰·결실·중후' },

  // 己 (논과 밭) — 부드러운 흙·양육
  己丑: { hanja: '己丑', identity: '봄을 품은 겨울 들녘',               description: '인내와 양육으로\n묵묵히 키우는 사람',             personality: '양육·헌신·인내' },
  己卯: { hanja: '己卯', identity: '봄에 깨어난 부드러운 텃밭',         description: '양육과 영민함으로\n섬세히 키우는 사람',           personality: '양육·섬세·다정' },
  己巳: { hanja: '己巳', identity: '여름 햇살에 키우는 따뜻한 밭',       description: '결실과 통찰로\n길러내는 사람',                   personality: '결실·지혜·인복' },
  己未: { hanja: '己未', identity: '한여름 무르익은 농토',               description: '풍요와 화합으로\n사람을 모으는 사람',             personality: '인복·화합·풍요' },
  己酉: { hanja: '己酉', identity: '가을 들녘의 단단한 흙',             description: '정밀한 손길로 한 알씩\n결실을 쌓아가는 사람',     personality: '꾸준함·정밀·결실' },
  己亥: { hanja: '己亥', identity: '겨울잠 전 결실 품은 흙',             description: '양육과 풍요로\n따뜻하게 품는 사람',               personality: '인정·풍요·여유' },

  // 庚 (도끼·광물) — 결단·강함·정확
  庚子: { hanja: '庚子', identity: '얼음을 가르는 차가운 칼날',         description: '결단과 영민함으로\n정확하게 끊는 사람',           personality: '결단·정밀·이성' },
  庚寅: { hanja: '庚寅', identity: '봄나무를 다듬는 정밀한 도끼',       description: '권위와 결단으로\n과감히 잘라내는 사람',           personality: '권위·결단·돌파' },
  庚辰: { hanja: '庚辰', identity: '용을 품은 광맥의 단단함',           description: '야심과 강함으로\n큰 자리를 노리는 사람',         personality: '야심·통솔·결단' },
  庚午: { hanja: '庚午', identity: '한여름에 단련된 강철',               description: '추진과 단단함으로\n멈추지 않는 사람',             personality: '추진·강건·돌파' },
  庚申: { hanja: '庚申', identity: '단단함의 절정에 이른 광물',         description: '결단과 재치로\n영리하게 끊는 사람',               personality: '결단·기지·완성도' },
  庚戌: { hanja: '庚戌', identity: '서리 내린 가을밤 빛나는 칼날',       description: '의리와 결단으로\n약속을 지키는 사람',             personality: '의리·신뢰·강건' },

  // 辛 (보석·정련된 금속) — 섬세·빛남·세련
  辛丑: { hanja: '辛丑', identity: '얼음 속에서 빛나는 보석',           description: '우직하고 섬세하게\n차분히 빛나는 사람',           personality: '섬세·인내·완성도' },
  辛卯: { hanja: '辛卯', identity: '봄 햇살에 영롱한 세공된 옥',         description: '영민함과 섬세함으로\n작은 빛도 살리는 사람',     personality: '예민·세련·미감' },
  辛巳: { hanja: '辛巳', identity: '여름 빛에 광채 더한 정련된 은',     description: '매력과 통찰로\n빛나는 직관의 사람',               personality: '매력·통찰·재기' },
  辛未: { hanja: '辛未', identity: '여름 흙 위에 박힌 보석',             description: '풍요와 섬세함으로\n부드럽게 빛나는 사람',         personality: '온유·섬세·인정' },
  辛酉: { hanja: '辛酉', identity: '맑은 가을 하늘의 빛나는 정수',       description: '정확과 빛으로\n완성도를 높이는 사람',             personality: '정밀·완성·결실' },
  辛亥: { hanja: '辛亥', identity: '겨울 밤하늘 차갑게 빛나는 별',       description: '풍요와 섬세함으로\n깊이 있는 빛 가진 사람',     personality: '직관·풍요·세련' },

  // 壬 (큰 강·바다) — 흐름·깊이·지혜
  壬子: { hanja: '壬子', identity: '깊은 겨울밤 흐르는 검은 강',         description: '영민함과 깊이로\n흐름을 읽는 사람',               personality: '직관·깊이·통찰' },
  壬寅: { hanja: '壬寅', identity: '봄 산을 휘감아 내려오는 강',         description: '권위와 흐름으로\n큰 그림을 그리는 사람',         personality: '비전·권위·흐름' },
  壬辰: { hanja: '壬辰', identity: '용이 사는 깊은 호수',                 description: '야심과 깊이로\n큰 일을 노리는 사람',             personality: '야심·깊이·통솔' },
  壬午: { hanja: '壬午', identity: '한여름 햇빛에 반짝이는 바다',         description: '추진과 흐름으로\n활발히 지혜를 펼치는 사람',     personality: '추진·표현·흐름' },
  壬申: { hanja: '壬申', identity: '가을 절벽을 두드리는 거센 파도',     description: '재치와 강함으로\n영리하게 돌파하는 사람',         personality: '재기·돌파·기지' },
  壬戌: { hanja: '壬戌', identity: '늦가을 안개 낀 깊은 강',             description: '의리와 깊이로\n묵묵히 사람을 지키는 사람',       personality: '신뢰·깊이·헌신' },

  // 癸 (이슬·빗줄기) — 스며듦·지혜·섬세
  癸丑: { hanja: '癸丑', identity: '겨울 흙에 스며드는 차가운 이슬',     description: '우직하고 섬세하게\n조용히 적시는 사람',           personality: '인내·섬세·헌신' },
  癸卯: { hanja: '癸卯', identity: '봄 새벽 잎 끝에 맺힌 이슬',           description: '영민함과 섬세함으로\n작은 것을 살리는 사람',     personality: '예민·감수성·재주' },
  癸巳: { hanja: '癸巳', identity: '여름 풀잎을 적시는 가는 빗줄기',     description: '통찰과 섬세함으로\n깊이 스며드는 사람',           personality: '통찰·매력·표현' },
  癸未: { hanja: '癸未', identity: '메마른 땅에 떨어지는 단비',           description: '풍요와 화합으로\n사람을 살리는 사람',             personality: '인정·중재·섬세' },
  癸酉: { hanja: '癸酉', identity: '가을 안개처럼 내려앉는 비',           description: '정밀과 섬세함으로\n완성을 향해 가는 사람',       personality: '정밀·섬세·완성' },
  癸亥: { hanja: '癸亥', identity: '깊은 겨울밤 끝없이 내리는 비',       description: '풍요와 깊이로\n끝까지 가는 사람',                 personality: '깊이·인정·지속력' },
};

/** 일주 한자 → IljuMeaning 조회 (60갑자 모두) */
export function getIljuMeaning(ilju: string): IljuMeaning | null {
  return ILJU_MEANING[ilju] ?? null;
}
