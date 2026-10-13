import type { WealthFlow as WealthFlowType } from '@/types/report';

interface Props {
  data: WealthFlowType;
  /** 일간 한자 (예: '갑'·'을'·'丙'). 사주 specific 인용에 사용 */
  dayGan?: string;
  /** 재성 카운트 (원국 8글자 중 재성 십성 개수) */
  jaeCount?: number;
  /** 식상 카운트 */
  sikCount?: number;
  /** 비겁 카운트 */
  biCount?: number;
}

/* ─── 일간 한자 → 한글 음 매핑 ─── */
const GAN_TO_KR: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};

function ganRefStr(dayGan?: string): string {
  if (!dayGan) return '본인';
  const kr = GAN_TO_KR[dayGan] || dayGan;
  // 이미 한글이면 한자 표기 생략
  return /[一-鿿]/.test(dayGan) ? `${kr}(${dayGan}) 일간` : `${kr} 일간`;
}

/* ─── 점수 해석 밴드 ─── */
interface ScoreBand {
  label: string;
  color: string;
  bg: string;
}

function getScoreBand(score: number): ScoreBand {
  if (score >= 80) return { label: '매우 강함', color: '#4E7A57', bg: '#E7EFE6' };
  if (score >= 65) return { label: '양호', color: '#3B7DD8', bg: '#E3F0FF' };
  if (score >= 50) return { label: '보통', color: '#B8965A', bg: '#F5EBD9' };
  if (score >= 35) return { label: '보완 필요', color: '#E08A3C', bg: '#FFF3E0' };
  return { label: '매우 약함', color: '#C75050', bg: '#F6E5E0' };
}

/* ─── 벌기 해석 ─── */
function getEarningInterpretation(score: number, dayGan?: string, jaeCount?: number): string {
  const ganRef = ganRefStr(dayGan);
  const jaeRef = jaeCount !== undefined ? `, 재성 ${jaeCount}개` : '';
  if (score >= 80) return `${ganRef}이 재물을 끌어당기는 힘이 아주 강한 사주예요${jaeRef}. 돈이 들어오는 흐름이 분명해요. 여러 통로에서 자연스럽게 재물이 들어와요.`;
  if (score >= 65) return `${ganRef} 사주에 안정적인 수입 구조가 갖춰져 있어요${jaeRef}. 꾸준한 노력이 수입으로 이어지고, 본업에서의 성과가 재물로 연결돼요.`;
  if (score >= 50) return `${ganRef}의 수입 흐름은 평균 정도예요${jaeRef}. 큰 변동 없이 일정한 수입이 유지되지만, 부수입을 만들려면 따로 노력이 필요해요.`;
  if (score >= 35) return `${ganRef} 사주의 수입 흐름이 좀 약한 편이에요${jaeRef}. 돈이 들어오는 길이 좁거나 불규칙해요. 안정적인 수입원을 만드는 게 과제예요.`;
  return `${ganRef}의 수입 기운이 약한 사주예요${jaeRef}. 돈이 잘 들어오지 않아서, 기초부터 천천히 만들어야 해요.`;
}

function getEarningAction(score: number, dayGan?: string): string {
  const ganRef = ganRefStr(dayGan);
  if (score >= 80) return `${ganRef}의 강한 수입 흐름을 살려서, 지금 수입원을 유지하며 투자나 부업으로 자산을 불려보세요.`;
  if (score >= 65) return `본업에 집중하되, ${ganRef} 특유의 전문성을 높여 단가를 올리는 방향으로 가는 게 좋아요.`;
  if (score >= 50) return `부수입원 하나를 새로 만들어보세요. ${ganRef} 사주에는 작더라도 두 번째 파이프라인이 안정감을 줘요.`;
  if (score >= 35) return `무리한 투자보다 안정적인 수입원 만들기에 집중하세요. ${ganRef}에는 실력 기반의 수입이 잘 맞아요.`;
  return `${ganRef}이라면 당장의 큰돈보다 작은 수입이라도 꾸준히 들어오는 구조를 먼저 만드세요. 기술이나 자격증 공부가 먼 길로 보여도 가장 확실해요.`;
}

/* ─── 쓰기 해석 ─── */
function getSpendingInterpretation(score: number, dayGan?: string, biCount?: number): string {
  const ganRef = ganRefStr(dayGan);
  const biRef = biCount !== undefined ? `, 비겁 ${biCount}개` : '';
  if (score >= 80) return `${ganRef}의 소비 관리 능력이 아주 뛰어나요${biRef}. 불필요한 지출을 잘 걸러내고, 돈을 쓸 때도 가치를 따져 쓰는 사람이에요.`;
  if (score >= 65) return `${ganRef}은 전반적으로 건전한 소비 습관이에요${biRef}. 가끔 충동 소비가 있을 수 있지만, 큰 틀에서 균형 잡힌 지출을 하고 있어요.`;
  if (score >= 50) return `${ganRef}의 소비는 평균 정도예요${biRef}. 의식적으로 지출을 관리하면 문제없지만, 방심하면 새어나가는 돈이 생길 수 있어요.`;
  if (score >= 35) return `${ganRef} 사주에 지출 관리 보완이 필요해요${biRef}. 감정적 소비나 관계 유지를 위한 지출이 많아지는 경향이 있어요.`;
  return `${ganRef}의 소비 기운이 강해요${biRef}. 돈이 들어와도 빠르게 나가는 흐름이라, 지출 관리가 재물운의 핵심 과제예요.`;
}

function getSpendingAction(score: number, dayGan?: string): string {
  const ganRef = ganRefStr(dayGan);
  if (score >= 80) return `지금 습관을 유지하되, ${ganRef}이라면 너무 아끼다 기회를 놓치지 않도록 가치 있는 소비도 해보세요.`;
  if (score >= 65) return `월 예산을 정해두고, ${ganRef}답게 큰 지출은 48시간 규칙을 적용해보세요.`;
  if (score >= 50) return `${ganRef} 사주에는 고정비 재점검이 잘 맞아요. 구독 서비스나 정기 지출 중 불필요한 항목을 정리하면 효과가 커요.`;
  if (score >= 35) return `가계부 쓰기가 ${ganRef}에게 가장 잘 맞아요. 일주일만 모든 지출을 기록해보면 경향이 보여요.`;
  return `${ganRef}이라면 자동이체로 저축을 먼저 빼고, 남은 금액 안에서만 쓰는 습관이 꼭 필요해요. 카드 대신 현금이나 체크카드를 써보세요.`;
}

/* ─── 모으기 해석 ─── */
function getSavingInterpretation(score: number, dayGan?: string, sikCount?: number): string {
  const ganRef = ganRefStr(dayGan);
  const sikRef = sikCount !== undefined ? `, 식상 ${sikCount}개` : '';
  if (score >= 80) return `${ganRef}의 돈을 모으는 힘이 매우 강해요${sikRef}. 재물이 한번 들어오면 잘 쌓이는 흐름이며, 시간이 지날수록 자산이 불어나는 사주예요.`;
  if (score >= 65) return `${ganRef}은 저축과 자산 형성에 유리한 사주예요${sikRef}. 장기적인 계획을 세우면 꾸준히 자산을 늘릴 수 있습니다.`;
  if (score >= 50) return `${ganRef}의 돈을 모으는 힘은 보통이에요${sikRef}. 의지를 갖고 시스템을 만들면 충분히 모을 수 있지만, 자동으로 쌓이진 않습니다.`;
  if (score >= 35) return `${ganRef} 사주는 자산이 쌓이기 어려운 흐름이에요${sikRef}. 돈이 들어와도 각종 지출로 빠져나가기 쉬워, 강제 저축 장치가 필요합니다.`;
  return `${ganRef}의 돈을 모으는 힘이 약한 편이에요${sikRef}. 모으는 것보다 흘러보내는 기운이 강하므로, 시스템적인 자산 관리가 반드시 필요합니다.`;
}

function getSavingAction(score: number, dayGan?: string): string {
  const ganRef = ganRefStr(dayGan);
  if (score >= 80) return `${ganRef}의 강한 축적력을 활용해 적극적인 자산 운용을 시작하세요. 저축만 하기보다 투자를 병행하면 복리 효과가 극대화됩니다.`;
  if (score >= 65) return `${ganRef}답게 비상금 3~6개월치를 먼저 확보하고, 나머지는 장기 투자에 배분하세요.`;
  if (score >= 50) return `${ganRef}이라면 월급날 자동이체 저축을 설정하세요. 30% 저축이 부담되면 10%부터 시작해도 좋습니다.`;
  if (score >= 35) return `${ganRef} 사주는 적금이나 펀드 자동이체처럼 강제 저축 장치를 반드시 마련하세요. 손에 남겨두면 사라집니다.`;
  return `${ganRef}이라면 급여 통장과 소비 통장을 분리하고, 급여일에 바로 저축분이 빠지도록 하세요. 목표 금액을 작게 잡되 절대 깨지 않는 것이 중요합니다.`;
}

/* ─── 재물 체질 타입 분류 ─── */
interface WealthType {
  name: string;
  description: string;
  advice: string;
}

function getWealthType(earning: number, spending: number, saving: number): WealthType {
  const avg = (earning + spending + saving) / 3;

  // 축적형: 모으기가 가장 높고 65 이상
  if (saving >= 65 && saving >= earning && saving >= spending) {
    return {
      name: '축적형',
      description: '돈을 잘 모으고 지키는 사람이에요. 한번 들어온 재물이 빠져나가지 않으며, 시간이 자산을 불려주는 편이에요.',
      advice: '저축에 강하니 이제 "불리기"에 집중할 때입니다. 안전한 투자 상품부터 시작해 자산 증식 속도를 높여보세요.',
    };
  }

  // 소비형: 쓰기 점수가 가장 낮고(=소비 통제력 약함) 45 미만
  if (spending < 45 && spending <= earning && spending <= saving) {
    return {
      name: '소비형',
      description: '돈을 쓰는 데 거리낌이 적은 사람이에요. 벌어도 빠르게 소비로 이어져, 수입 대비 자산 축적이 느린 편입니다.',
      advice: '지출 관리가 재물운의 열쇠입니다. 원하는 것과 필요한 것을 구분하는 습관, 그리고 강제 저축 시스템이 꼭 필요합니다.',
    };
  }

  // 투자형: 벌기가 높고 모으기도 일정 수준 이상
  if (earning >= 65 && saving >= 50 && earning >= spending) {
    return {
      name: '투자형',
      description: '돈을 벌고 굴리는 감각이 있는 사람이에요. 적극적인 재테크와 사업 확장에 유리한 재물 구조를 가지고 있습니다.',
      advice: '리스크 관리만 잘하면 큰 자산을 만들 수 있습니다. 분산 투자 원칙을 지키고, 한 곳에 올인하지 마세요.',
    };
  }

  // 수성형(지키기형): 쓰기 통제력 높고, 벌기/모으기 보통
  if (spending >= 65 && earning < 65 && saving >= 50) {
    return {
      name: '수성형',
      description: '있는 것을 잘 지키는 사람이에요. 큰돈을 벌기보다 가진 자산을 안정적으로 유지하는 데 강점이 있습니다.',
      advice: '수입을 늘리는 데 기운을 투자하세요. 지키는 능력은 이미 갖추고 있으니, 벌기 쪽만 보강하면 자산이 크게 늘어납니다.',
    };
  }

  // 유동형: 벌기가 높지만 모으기가 낮음
  if (earning >= 60 && saving < 50) {
    return {
      name: '유동형',
      description: '돈이 잘 들어오지만 나가는 것도 빠른 사람이에요. 재물의 흐름이 활발하여 현금 회전은 좋지만, 잔고가 쌓이기 어렵습니다.',
      advice: '수입의 일정 비율을 "절대로 건드리지 않는 통장"에 자동이체하세요. 흐름은 좋으니 파이프 하나만 막으면 됩니다.',
    };
  }

  // 잠재형: 전체 점수가 낮거나 고르게 낮을 때
  if (avg < 50) {
    return {
      name: '잠재형',
      description: '아직 재물 기운이 완전히 발현되지 않은 상태입니다. 시기와 노력에 따라 큰 변화가 가능한 잠재력을 품고 있습니다.',
      advice: '지금은 실력과 기반을 다지는 시기입니다. 작은 성공 경험을 쌓으며 수입 구조를 만들어가세요. 때가 되면 빠르게 성장합니다.',
    };
  }

  // 균형형: 세 점수가 비교적 고른 경우 (기본)
  return {
    name: '균형형',
    description: '벌고, 쓰고, 모으는 균형이 잡힌 사람이에요. 극단적으로 치우치지 않아 안정적인 재물 관리가 가능합니다.',
    advice: '균형이 강점이니 이 흐름을 유지하세요. 가장 높은 항목을 더 강화하면 전체 재물운이 한 단계 올라갑니다.',
  };
}

/* ─── 흐름 패턴 진단 ─── */
function getFlowDiagnosis(earning: number, spending: number, saving: number): string {
  const diff_es = earning - saving; // 벌기와 모으기 차이

  // 벌기 >> 모으기: 새는 구조
  if (diff_es > 25 && saving < 55) {
    return `수입(${earning}점) 대비 축적(${saving}점)이 크게 낮습니다. 돈은 잘 벌지만 중간에 새어나가는 구조입니다. 지출 경로를 점검하고 자동 저축을 설정하면 자산이 빠르게 늘어날 수 있습니다.`;
  }

  // 모으기 >> 벌기: 알뜰하지만 성장이 느림
  if (saving > earning + 15) {
    return `축적 능력(${saving}점)은 뛰어나지만, 수입(${earning}점)이 이를 따라가지 못합니다. 아끼는 것만으로는 한계가 있으니, 수입을 늘리는 데 투자하면 자산 성장이 가속됩니다.`;
  }

  // 쓰기 통제력 낮음(점수 낮음 = 소비 과다)
  if (spending < 40 && earning >= 55) {
    return `벌이(${earning}점)는 괜찮지만 소비 통제력(${spending}점)이 약해서, 들어오는 만큼 나가는 흐름입니다. 지출 습관 개선이 재물운 상승의 핵심 열쇠입니다.`;
  }

  // 전체적으로 높은 경우
  if (earning >= 65 && spending >= 65 && saving >= 65) {
    return `벌기(${earning}점), 소비 관리(${spending}점), 축적(${saving}점) 모두 우수합니다. 재물의 선순환 구조가 잘 갖춰져 있어, 시간이 지날수록 자산이 자연스럽게 늘어나는 흐름입니다.`;
  }

  // 전체적으로 낮은 경우
  if (earning < 45 && spending < 45 && saving < 45) {
    return `세 영역 모두 보강이 필요한 시기입니다. 한 번에 모든 것을 바꾸려 하기보다, 수입 기반 확보부터 차근히 시작하세요. 기반이 잡히면 나머지도 자연스럽게 따라옵니다.`;
  }

  // 벌기와 모으기 모두 양호
  if (earning >= 55 && saving >= 55 && spending >= 50) {
    return `벌기(${earning}점)와 모으기(${saving}점)가 균형 잡혀 있고, 소비 관리(${spending}점)도 안정적입니다. 현재 흐름을 유지하면서 가장 높은 영역을 더 강화하면 재물운이 한 단계 올라갑니다.`;
  }

  // 기본 케이스
  const strongest = earning >= spending && earning >= saving ? '수입'
    : spending >= earning && spending >= saving ? '소비 관리' : '축적';
  const weakest = earning <= spending && earning <= saving ? '수입'
    : spending <= earning && spending <= saving ? '소비 관리' : '축적';
  return `${strongest} 쪽이 상대적으로 강하고, ${weakest} 쪽이 보완 포인트입니다. ${weakest} 영역에 집중하면 전체 재물 흐름이 크게 개선됩니다.`;
}

/* ─── 점수 원형 ─── */
function ScoreCircle({ score, size = 48 }: { score: number; size?: number }) {
  const band = getScoreBand(score);
  const r = (size - 6) / 2;
  const c = Math.PI * 2 * r;
  const offset = c * (1 - score / 100);

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#e8e0d4" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={band.color} strokeWidth={3}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size > 40 ? 16 : 13, fontWeight: 800, color: band.color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

/* ─── 비교 바 시각화 ─── */
function ComparisonBars({ data }: { data: WealthFlowType }) {
  const stages = [
    { key: 'earning' as const, label: '벌기', icon: 'IN' },
    { key: 'spending' as const, label: '소비관리', icon: 'CTL' },
    { key: 'saving' as const, label: '모으기', icon: 'OUT' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stages.map(({ key, label }) => {
        const score = data[key].score;
        const band = getScoreBand(score);
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 52, fontSize: 13, fontWeight: 700, color: '#6b5b47',
              textAlign: 'right', flexShrink: 0,
            }}>
              {label}
            </span>
            <div style={{
              flex: 1, height: 14, borderRadius: 7,
              background: '#e8e0d4', overflow: 'hidden',
            }}>
              <div style={{
                width: `${score}%`, height: '100%', borderRadius: 7,
                background: `linear-gradient(90deg, ${band.color}88, ${band.color})`,
                transition: 'width 0.8s ease',
              }} />
            </div>
            <span style={{
              width: 28, fontSize: 13.5, fontWeight: 800, color: band.color,
              textAlign: 'right', flexShrink: 0,
            }}>
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── 스테이지 카드 ─── */
const STAGE_META = {
  earning: { label: '벌기', sub: '수입 기운', themeColor: '#B8965A' },
  spending: { label: '소비관리', sub: '지출 통제력', themeColor: '#7A8BA0' },
  saving: { label: '모으기', sub: '돈 모으는 힘', themeColor: '#4E7A57' },
} as const;

function StageCard({ stageKey, score, style, interpretation, action, dayGan, jaeCount, sikCount, biCount }: {
  stageKey: 'earning' | 'spending' | 'saving';
  score: number;
  style: string;
  /** AI 응답에서 직접 온 해석 (있으면 fallback 함수 대체) */
  interpretation?: string;
  /** AI 응답에서 직접 온 실천 조언 */
  action?: string;
  dayGan?: string;
  jaeCount?: number;
  sikCount?: number;
  biCount?: number;
}) {
  const meta = STAGE_META[stageKey];
  const band = getScoreBand(score);

  // AI 응답 우선, 없으면 사주 specific fallback
  const interpretationText = interpretation && interpretation.trim().length > 0
    ? interpretation
    : stageKey === 'earning' ? getEarningInterpretation(score, dayGan, jaeCount)
    : stageKey === 'spending' ? getSpendingInterpretation(score, dayGan, biCount)
    : getSavingInterpretation(score, dayGan, sikCount);

  const actionText = action && action.trim().length > 0
    ? action
    : stageKey === 'earning' ? getEarningAction(score, dayGan)
    : stageKey === 'spending' ? getSpendingAction(score, dayGan)
    : getSavingAction(score, dayGan);

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8e0d4',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px 12px',
        background: `linear-gradient(135deg, ${meta.themeColor}08, ${meta.themeColor}15)`,
        borderBottom: '1px solid #e8e0d420',
      }}>
        <ScoreCircle score={score} size={48} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#3D3427' }}>
              {meta.label}
            </span>
            <span style={{
              fontSize: 13, color: '#a0937f', fontWeight: 500,
            }}>
              {meta.sub}
            </span>
          </div>
          <div style={{
            display: 'inline-block', marginTop: 4,
            padding: '2px 8px', borderRadius: 6,
            background: band.bg, fontSize: 13, fontWeight: 700, color: band.color,
          }}>
            {band.label}
          </div>
        </div>
      </div>

      {/* AI 스타일 설명 (프롬프트에서 온 데이터) */}
      {style && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid #f0ebe3',
        }}>
          <p style={{
            fontSize: 13, fontWeight: 700, color: '#B8965A',
            marginBottom: 3, letterSpacing: 0.3,
          }}>
            사주 분석
          </p>
          <p style={{ fontSize: 13, color: '#5a4d3e', lineHeight: 1.7 }}>
            {style}
          </p>
        </div>
      )}

      {/* 점수 해석 */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #f0ebe3',
      }}>
        <p style={{
          fontSize: 13, fontWeight: 700, color: '#B8965A',
          marginBottom: 3, letterSpacing: 0.3,
        }}>
          이 점수의 의미
        </p>
        <p style={{ fontSize: 13, color: '#5a4d3e', lineHeight: 1.7 }}>
          {interpretationText}
        </p>
      </div>

      {/* 실천 조언 */}
      <div style={{
        padding: '10px 16px 14px',
        background: '#faf7f2',
      }}>
        <p style={{
          fontSize: 13, fontWeight: 700, color: meta.themeColor,
          marginBottom: 3, letterSpacing: 0.3,
        }}>
          실천 조언
        </p>
        <p style={{ fontSize: 13, color: '#5a4d3e', lineHeight: 1.7 }}>
          {actionText}
        </p>
      </div>
    </div>
  );
}

/* ─── 메인 컴포넌트 ─── */
export function WealthFlow({ data, dayGan, jaeCount, sikCount, biCount }: Props) {
  const { earning, spending, saving } = data;
  const wealthType = getWealthType(earning.score, spending.score, saving.score);
  const flowDiagnosis = getFlowDiagnosis(earning.score, spending.score, saving.score);

  // AI 응답이 추가 필드(interpretation/action)를 포함할 수 있도록 우회 캐스팅
  // 기존 schema 는 {score, style} 만이지만 향후 확장 호환
  const earningExt = earning as { score: number; style: string; interpretation?: string; action?: string };
  const spendingExt = spending as { score: number; style: string; interpretation?: string; action?: string };
  const savingExt = saving as { score: number; style: string; interpretation?: string; action?: string };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h4 className="text-h3 text-text-primary">재물 흐름</h4>

      {/* ━━━ 재물 체질 타입 ━━━ */}
      <div style={{
        background: 'linear-gradient(135deg, #B8965A12, #B8965A22)',
        border: '1px solid #B8965A30',
        borderRadius: 14,
        padding: '16px 18px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #B8965A, #B8965A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13.5, fontWeight: 900, color: '#fff' }}>
              {wealthType.name.charAt(0)}
            </span>
          </div>
          <div>
            <p style={{
              fontSize: 13, color: '#B8965A', fontWeight: 600,
              marginBottom: 1,
            }}>
              나의 재물 체질
            </p>
            <p style={{ fontSize: 15, fontWeight: 900, color: '#3D3427' }}>
              {wealthType.name}
            </p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#5a4d3e', lineHeight: 1.75, marginBottom: 8 }}>
          {wealthType.description}
        </p>
        <div style={{
          background: '#ffffff80',
          borderRadius: 10,
          padding: '10px 12px',
          border: '1px solid #B8965A18',
        }}>
          <p style={{
            fontSize: 13, fontWeight: 700, color: '#B8965A',
            marginBottom: 3,
          }}>
            핵심 전략
          </p>
          <p style={{ fontSize: 13, color: '#5a4d3e', lineHeight: 1.7 }}>
            {wealthType.advice}
          </p>
        </div>
      </div>

      {/* ━━━ 점수 비교 시각화 ━━━ */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e8e0d4',
        borderRadius: 14,
        padding: '14px 16px 16px',
      }}>
        <p style={{
          fontSize: 13, fontWeight: 700, color: '#3D3427',
          marginBottom: 12,
        }}>
          재물 흐름 한눈에 보기
        </p>
        <ComparisonBars data={data} />
      </div>

      {/* ━━━ 흐름 패턴 진단 ━━━ */}
      <div style={{
        background: '#faf7f2',
        border: '1px solid #e8e0d4',
        borderRadius: 14,
        padding: '14px 16px',
      }}>
        <p style={{
          fontSize: 13, fontWeight: 700, color: '#B8965A',
          marginBottom: 6,
        }}>
          세 영역의 관계 분석
        </p>
        <p style={{ fontSize: 13, color: '#5a4d3e', lineHeight: 1.8 }}>
          {flowDiagnosis}
        </p>
      </div>

      {/* ━━━ 3단계 상세 카드 ━━━ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StageCard
          stageKey="earning" score={earning.score} style={earning.style}
          interpretation={earningExt.interpretation} action={earningExt.action}
          dayGan={dayGan} jaeCount={jaeCount} sikCount={sikCount} biCount={biCount}
        />

        {/* 흐름 연결선 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 0',
        }}>
          <div style={{
            width: 2, height: 16, borderRadius: 1,
            background: 'linear-gradient(180deg, #B8965A40, #7A8BA040)',
          }} />
        </div>

        <StageCard
          stageKey="spending" score={spending.score} style={spending.style}
          interpretation={spendingExt.interpretation} action={spendingExt.action}
          dayGan={dayGan} jaeCount={jaeCount} sikCount={sikCount} biCount={biCount}
        />

        {/* 흐름 연결선 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 0',
        }}>
          <div style={{
            width: 2, height: 16, borderRadius: 1,
            background: '#4E7A5726',
          }} />
        </div>

        <StageCard
          stageKey="saving" score={saving.score} style={saving.style}
          interpretation={savingExt.interpretation} action={savingExt.action}
          dayGan={dayGan} jaeCount={jaeCount} sikCount={sikCount} biCount={biCount}
        />
      </div>
    </div>
  );
}
