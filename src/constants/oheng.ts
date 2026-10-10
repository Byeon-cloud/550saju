import type { OhengType } from '@/types/saju';

interface OhengInfo {
  name: OhengType;
  hanja: string;
  color: string;
  colorLight: string;
  colorDark: string;
  organ: string;
  direction: string;
  season: string;
}

export const OHENG_MAP: Record<OhengType, OhengInfo> = {
  목: {
    name: '목',
    hanja: '木',
    color: '#4E7A57',
    colorLight: '#E7EFE6',
    colorDark: '#355A3E',
    organ: '간/담낭',
    direction: '동',
    season: '봄',
  },
  화: {
    name: '화',
    hanja: '火',
    color: '#B04A38',
    colorLight: '#F6E5E0',
    colorDark: '#8A3326',
    organ: '심장/소장',
    direction: '남',
    season: '여름',
  },
  토: {
    name: '토',
    hanja: '土',
    color: '#B07F38',
    colorLight: '#F5EBD9',
    colorDark: '#8A6226',
    organ: '비장/위장',
    direction: '중앙',
    season: '환절기',
  },
  금: {
    name: '금',
    hanja: '金',
    color: '#7D7870',
    colorLight: '#EEECE8',
    colorDark: '#57534D',
    organ: '폐/대장',
    direction: '서',
    season: '가을',
  },
  수: {
    name: '수',
    hanja: '水',
    color: '#3E5F82',
    colorLight: '#E4EAF1',
    colorDark: '#2A4560',
    organ: '신장/방광',
    direction: '북',
    season: '겨울',
  },
};

/** 천간 → 오행 매핑 */
export const CHEONGAN_OHENG: Record<string, OhengType> = {
  甲: '목', 乙: '목',
  丙: '화', 丁: '화',
  戊: '토', 己: '토',
  庚: '금', 辛: '금',
  壬: '수', 癸: '수',
};

/** 지지 → 오행 매핑 */
export const JIJI_OHENG: Record<string, OhengType> = {
  寅: '목', 卯: '목',
  巳: '화', 午: '화',
  辰: '토', 戌: '토', 丑: '토', 未: '토',
  申: '금', 酉: '금',
  亥: '수', 子: '수',
};

/** 천간 한국어 읽기 */
export const CHEONGAN_KO: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};

/** 지지 한국어 읽기 */
export const JIJI_KO: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};

/** 천간 음양 */
export const CHEONGAN_EUMYANG: Record<string, '양' | '음'> = {
  甲: '양', 乙: '음', 丙: '양', 丁: '음', 戊: '양',
  己: '음', 庚: '양', 辛: '음', 壬: '양', 癸: '음',
};

/** 지지 음양 */
export const JIJI_EUMYANG: Record<string, '양' | '음'> = {
  子: '양', 丑: '음', 寅: '양', 卯: '음', 辰: '양', 巳: '음',
  午: '양', 未: '음', 申: '양', 酉: '음', 戌: '양', 亥: '음',
};
