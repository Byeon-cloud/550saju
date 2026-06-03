/**
 * 60갑자 — 10천간 + 12지지 매핑 (2026-05-07)
 * 사주 mini 카드들에서 공유 — DailyMockupView, TopicSajuMini, 기타 만세력 표시
 */
import type { OhengType } from '@/types/saju';

/** 12지지 (지지 한자 → 한글 + 12동물 + 오행) */
export const BRANCH_INFO: Record<string, { reading: string; animal: string; oheng: OhengType }> = {
  子: { reading: '자', animal: '쥐',     oheng: '수' },
  丑: { reading: '축', animal: '소',     oheng: '토' },
  寅: { reading: '인', animal: '호랑이', oheng: '목' },
  卯: { reading: '묘', animal: '토끼',   oheng: '목' },
  辰: { reading: '진', animal: '용',     oheng: '토' },
  巳: { reading: '사', animal: '뱀',     oheng: '화' },
  午: { reading: '오', animal: '말',     oheng: '화' },
  未: { reading: '미', animal: '양',     oheng: '토' },
  申: { reading: '신', animal: '원숭이', oheng: '금' },
  酉: { reading: '유', animal: '닭',     oheng: '금' },
  戌: { reading: '술', animal: '개',     oheng: '토' },
  亥: { reading: '해', animal: '돼지',   oheng: '수' },
};

/** 10천간 (음양 + 오행 + 풀이 + 상징) */
export const STEM_INFO: Record<string, { reading: string; yinyang: '양' | '음'; oheng: OhengType; brief: string; symbol: string }> = {
  甲: { reading: '갑', yinyang: '양', oheng: '목', symbol: '큰 나무', brief: '큰 나무처럼 곧고 추진력 있는 기운' },
  乙: { reading: '을', yinyang: '음', oheng: '목', symbol: '풀잎',    brief: '풀잎처럼 유연하고 섬세한 기운' },
  丙: { reading: '병', yinyang: '양', oheng: '화', symbol: '태양',    brief: '한낮의 태양처럼 밝고 활달한 기운' },
  丁: { reading: '정', yinyang: '음', oheng: '화', symbol: '촛불',    brief: '촛불처럼 따뜻하고 집중력 있는 기운' },
  戊: { reading: '무', yinyang: '양', oheng: '토', symbol: '큰 산',   brief: '큰 산처럼 든든하고 안정적인 기운' },
  己: { reading: '기', yinyang: '음', oheng: '토', symbol: '밭',      brief: '비옥한 밭처럼 포용력 있는 기운' },
  庚: { reading: '경', yinyang: '양', oheng: '금', symbol: '강철',    brief: '단단한 강철처럼 결단력 있는 기운' },
  辛: { reading: '신', yinyang: '음', oheng: '금', symbol: '보석',    brief: '예리한 보석처럼 날카롭고 정교한 기운' },
  壬: { reading: '임', yinyang: '양', oheng: '수', symbol: '큰 강',   brief: '큰 강처럼 흐르고 변화하는 기운' },
  癸: { reading: '계', yinyang: '음', oheng: '수', symbol: '샘물',    brief: '맑은 샘물처럼 부드럽고 지혜로운 기운' },
};
