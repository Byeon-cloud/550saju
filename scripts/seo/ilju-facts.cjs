/* 60일주 확정표 (2026-10-17, 검색 페이지 /ilju/{slug}/) — 계산만 한다. 글은 gen-ilju.cjs 가 이 표를 근거로 만든다.
 *   12운성은 일간 기준(양간 순행, 음간 역행), 지장간은 여기, 중기, 본기 순, 신살은 일주로 정해지는 것만
 *   (괴강, 백호, 양인, 간여지동). 천지합 짝은 천간합 + 지지육합이 함께 맞는 일주(일주마다 하나). */
const { tenGodOf } = (() => {
  const OH = { 甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수' };
  const YANG = new Set(['甲', '丙', '戊', '庚', '壬']);
  const GEN = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const CTRL = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
  function tenGodOf(day, other) {
    const d = OH[day]; const o = OH[other]; const same = YANG.has(day) === YANG.has(other);
    if (d === o) return same ? '비견' : '겁재';
    if (GEN[d] === o) return same ? '식신' : '상관';
    if (CTRL[d] === o) return same ? '편재' : '정재';
    if (CTRL[o] === d) return same ? '편관' : '정관';
    if (GEN[o] === d) return same ? '편인' : '정인';
    return '';
  }
  return { tenGodOf };
})();

const GAN = '甲乙丙丁戊己庚辛壬癸'.split('');
const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
const GAN_KO = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const GAN_RO = { 甲: 'gap', 乙: 'eul', 丙: 'byeong', 丁: 'jeong', 戊: 'mu', 己: 'gi', 庚: 'gyeong', 辛: 'sin', 壬: 'im', 癸: 'gye' };
const ZHI_RO = { 子: 'ja', 丑: 'chuk', 寅: 'in', 卯: 'myo', 辰: 'jin', 巳: 'sa', 午: 'o', 未: 'mi', 申: 'sin', 酉: 'yu', 戌: 'sul', 亥: 'hae' };
const GAN_OH = { 甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수' };
const ZHI_OH = { 子: '수', 丑: '토', 寅: '목', 卯: '목', 辰: '토', 巳: '화', 午: '화', 未: '토', 申: '금', 酉: '금', 戌: '토', 亥: '수' };
const OH_PLAIN = { 목: '나무(목)', 화: '불(화)', 토: '흙(토)', 금: '쇠(금)', 수: '물(수)' };
const JIJANGGAN = { 子: ['壬', '癸'], 丑: ['癸', '辛', '己'], 寅: ['戊', '丙', '甲'], 卯: ['甲', '乙'], 辰: ['乙', '癸', '戊'], 巳: ['戊', '庚', '丙'], 午: ['丙', '己', '丁'], 未: ['丁', '乙', '己'], 申: ['戊', '壬', '庚'], 酉: ['庚', '辛'], 戌: ['辛', '丁', '戊'], 亥: ['戊', '甲', '壬'] };
const STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
const STAGE_PLAIN = { 장생: '막 태어나 자라는 힘', 목욕: '씻고 꾸미며 흔들리는 힘', 관대: '옷을 갖춰 입고 나서는 힘', 건록: '제 힘으로 서는 힘', 제왕: '가장 세게 차오른 힘', 쇠: '한풀 꺾여 노련해진 힘', 병: '약해져 섬세해진 힘', 사: '멈춰 깊어지는 힘', 묘: '거두어 갈무리하는 힘', 절: '끊기고 새로 시작하는 힘', 태: '새로 잉태되는 힘', 양: '품 안에서 길러지는 힘' };
const CHANGSAENG = { 甲: '亥', 丙: '寅', 戊: '寅', 庚: '巳', 壬: '申', 乙: '午', 丁: '酉', 己: '酉', 辛: '子', 癸: '卯' };
const YANG_GAN = new Set(['甲', '丙', '戊', '庚', '壬']);
const GAN_HAP = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
const HAP6 = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const CHUNG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const GOEGANG = new Set(['庚辰', '庚戌', '壬辰', '壬戌', '戊戌']);
const BAEKHO = new Set(['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑']);
const YANGIN = new Set(['丙午', '戊午', '壬子']);
const GANYEOJIDONG = new Set(['甲寅', '乙卯', '丙午', '丁巳', '戊辰', '戊戌', '己丑', '己未', '庚申', '辛酉', '壬子', '癸亥']);

const GAPJA = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);
const ko = (gz) => GAN_KO[gz[0]] + ZHI_KO[gz[1]];
const slugOf = (gz) => `${GAN_RO[gz[0]]}-${ZHI_RO[gz[1]]}`;

function stageOf(gan, zhi) {
  const start = ZHI.indexOf(CHANGSAENG[gan]);
  const idx = ZHI.indexOf(zhi);
  const step = YANG_GAN.has(gan) ? (idx - start + 12) % 12 : (start - idx + 12) % 12;
  return STAGES[step];
}

function iljuFacts(gz) {
  const g = gz[0]; const z = gz[1];
  const bongi = JIJANGGAN[z][JIJANGGAN[z].length - 1];
  const spouseSip = tenGodOf(g, bongi);
  const hidden = JIJANGGAN[z].map((h) => `${h}(${GAN_KO[h]}, ${tenGodOf(g, h)})`);
  const stage = stageOf(g, z);
  const sinsal = [GOEGANG.has(gz) && '괴강', BAEKHO.has(gz) && '백호', YANGIN.has(gz) && '양인', GANYEOJIDONG.has(gz) && '간여지동'].filter(Boolean);
  const hapPartner = GAN_HAP[g] + HAP6[z];
  const chungZhi = CHUNG[z];
  return {
    gz, ko: ko(gz), slug: slugOf(gz),
    ganOh: GAN_OH[g], zhiOh: ZHI_OH[z], yang: YANG_GAN.has(g),
    spouseSip, hidden, stage, stagePlain: STAGE_PLAIN[stage], sinsal,
    hapPartner, hapPartnerKo: ko(hapPartner), chungZhi, chungZhiKo: ZHI_KO[chungZhi],
  };
}

function factsText(f) {
  return [
    `일주: ${f.gz}(${f.ko}), 일간 ${f.gz[0]}(${GAN_KO[f.gz[0]]})은 ${f.yang ? '양' : '음'}의 ${OH_PLAIN[f.ganOh]}, 일지 ${f.gz[1]}(${ZHI_KO[f.gz[1]]})는 ${OH_PLAIN[f.zhiOh]}`,
    `일지(배우자 자리)의 본기 십성: ${f.spouseSip}`,
    `일지 지장간(여기, 중기, 본기): ${f.hidden.join(', ')}`,
    `일간이 일지에서 받는 12운성: ${f.stage} (${f.stagePlain})`,
    `일주 신살: ${f.sinsal.length ? f.sinsal.join(', ') : '없음'}`,
    `천지합 짝 일주(천간합과 지지육합이 함께 맞음): ${f.hapPartner}(${f.hapPartnerKo})`,
    `일지와 정면으로 부딪히는 지지: ${f.chungZhi}(${f.chungZhiKo})`,
  ].join('\n');
}

module.exports = { GAPJA, iljuFacts, factsText, ko, slugOf, OH_PLAIN, GAN_KO, ZHI_KO };
