/** 사주500 열두 띠 동물 그림 (2026-10-19) — 그림 원본은 ttiAnimalSvg.ts (안의 고정 문자열만 그린다) */
import { ttiAnimalSvg } from './ttiAnimalSvg';

export function TtiAnimal({ ji, size = 40, ink, paper, accent, style }: {
  ji: string; size?: number; ink?: string; paper?: string; accent?: string; style?: React.CSSProperties;
}) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', width: size, height: size, lineHeight: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: ttiAnimalSvg(ji, size, ink, paper, accent) }} />
  );
}
