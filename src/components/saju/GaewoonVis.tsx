import type { OhengDistribution, OhengType } from '@/types/saju';
import { OHENG_MAP } from '@/constants/oheng';

interface GaewoonVisProps {
  elements: OhengDistribution;
}

interface Tip {
  oheng: OhengType;
  category: string;
  emoji: string;
  items: string[];
}

function getGaewoonTips(elements: OhengDistribution): Tip[] {
  const tips: Tip[] = [];
  const weak = (Object.entries(elements) as [OhengType, number][])
    .filter(([, v]) => v <= 1)
    .map(([k]) => k);

  const tipMap: Record<OhengType, Tip> = {
    목: { oheng: '목', category: '색상·방향', emoji: '🌳', items: ['초록색 소품 활용', '동쪽 방향 책상 배치', '아침 산책·등산'] },
    화: { oheng: '화', category: '활동·에너지', emoji: '🔥', items: ['빨간색·보라색 포인트', '남쪽 방향', '열정적 운동 (달리기, 댄스)'] },
    토: { oheng: '토', category: '안정·균형', emoji: '⛰️', items: ['노랑·베이지 계열', '규칙적 식사·수면', '정원 가꾸기·흙 만지기'] },
    금: { oheng: '금', category: '호흡·정리', emoji: '⚔️', items: ['흰색·은색·금색 소품', '서쪽 방향', '깊은 호흡·명상·정리정돈'] },
    수: { oheng: '수', category: '유연·지혜', emoji: '💧', items: ['검정·남색 계열', '북쪽 방향', '수영·요가·충분한 수분 섭취'] },
  };

  for (const key of weak) {
    tips.push(tipMap[key]);
  }
  if (tips.length === 0) {
    tips.push(tipMap['수']); // 기본 추천
  }
  return tips;
}

export function GaewoonVis({ elements }: GaewoonVisProps) {
  const tips = getGaewoonTips(elements);

  return (
    <div className="space-y-3">
      {tips.map((tip) => {
        const info = OHENG_MAP[tip.oheng];
        return (
          <div key={tip.oheng} className="rounded-brand-lg p-4"
            style={{ background: `${info.colorLight}60`, border: `1px solid ${info.colorLight}` }}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[18px]">{tip.emoji}</span>
              <div>
                <p className="text-[12px] font-bold" style={{ color: info.colorDark }}>
                  {info.hanja}{tip.oheng} 보충 — {tip.category}
                </p>
              </div>
            </div>
            <ul className="space-y-1.5 pl-1">
              {tip.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]"
                  style={{ color: 'var(--text-secondary)' }}>
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: info.color }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
