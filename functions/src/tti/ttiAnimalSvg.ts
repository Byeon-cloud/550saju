// 2026-10-19 원본은 src/components/tti/ttiAnimalSvg.ts — 함수는 src 를 못 읽어서 같은 내용을 둔다(그림을 바꾸면 둘 다 고친다)
/**
 * 사주500 열두 띠 동물 (2026-10-19) — 오너: "고퀄리티 말고 누가 봐도 그 동물이라고 알 수 있게, 우리 앱 스타일로"
 *   수묵 고서 스타일: 먹 한 색(ink) 얼굴 실루엣 + 종이색(paper) 눈, 주둥이. 닭 볏과 뱀 혀만 낙관 빨강(accent).
 *   viewBox 0 0 64 64. 화면(TtiAnimal)과 공유 그림 생성 스크립트가 같은 문자열을 쓴다 — 그림을 바꾸려면 여기만.
 *   {I} = 먹, {P} = 종이, {A} = 낙관 빨강 으로 바꿔 쓴다.
 */
const EYE = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="2.9" fill="{P}"/><circle cx="${x + 0.4}" cy="${y + 0.3}" r="1.5" fill="{I}"/>`;

export const TTI_ANIMAL_SVG: Record<string, string> = {
  // 쥐 — 큰 동그란 귀, 뾰족한 얼굴, 수염
  子: `<circle cx="17" cy="20" r="10" fill="{I}"/><circle cx="47" cy="20" r="10" fill="{I}"/>
<circle cx="17" cy="20" r="5" fill="{P}"/><circle cx="47" cy="20" r="5" fill="{P}"/>
<path d="M13 34 Q13 22 32 22 Q51 22 51 34 Q51 45 32 55 Q13 45 13 34Z" fill="{I}"/>
${EYE(25, 35)}${EYE(39, 35)}<circle cx="32" cy="50" r="2.6" fill="{P}"/>
<path d="M22 46 L7 43 M22 49 L8 51 M42 46 L57 43 M42 49 L56 51" stroke="{I}" stroke-width="1.6" stroke-linecap="round"/>`,
  // 소 — 위로 휜 뿔, 옆으로 난 귀, 넓은 코
  丑: `<path d="M18 22 Q5 18 7 5 Q12 15 23 17Z" fill="{I}"/><path d="M46 22 Q59 18 57 5 Q52 15 41 17Z" fill="{I}"/>
<ellipse cx="11" cy="29" rx="8" ry="4.2" transform="rotate(-18 11 29)" fill="{I}"/><ellipse cx="53" cy="29" rx="8" ry="4.2" transform="rotate(18 53 29)" fill="{I}"/>
<rect x="16" y="17" width="32" height="39" rx="15" fill="{I}"/>
${EYE(25, 31)}${EYE(39, 31)}<ellipse cx="32" cy="47" rx="13" ry="8" fill="{P}"/>
<ellipse cx="27" cy="47" rx="2.2" ry="2.8" fill="{I}"/><ellipse cx="37" cy="47" rx="2.2" ry="2.8" fill="{I}"/>`,
  // 호랑이 — 둥근 귀, 이마의 王, 뺨 줄무늬
  寅: `<circle cx="16" cy="18" r="7.5" fill="{I}"/><circle cx="48" cy="18" r="7.5" fill="{I}"/>
<circle cx="16" cy="18" r="3.4" fill="{P}"/><circle cx="48" cy="18" r="3.4" fill="{P}"/>
<circle cx="32" cy="36" r="21" fill="{I}"/>
<path d="M26.5 21.5 H37.5 M27.5 26 H36.5 M26.5 30.5 H37.5 M32 21.5 V30.5" stroke="{P}" stroke-width="2.3" stroke-linecap="round"/>
<path d="M11.5 36 H18 M12 41 H18.5 M52.5 36 H46 M52 41 H45.5" stroke="{P}" stroke-width="2.2" stroke-linecap="round"/>
${EYE(25, 36)}${EYE(39, 36)}<ellipse cx="32" cy="46.5" rx="9.5" ry="6.5" fill="{P}"/><path d="M29 42.5 H35 L32 46Z" fill="{I}"/>`,
  // 토끼 — 길게 선 두 귀
  卯: `<ellipse cx="24" cy="17" rx="5.5" ry="15" fill="{I}"/><ellipse cx="40" cy="17" rx="5.5" ry="15" fill="{I}"/>
<ellipse cx="24" cy="18" rx="2.3" ry="10" fill="{P}"/><ellipse cx="40" cy="18" rx="2.3" ry="10" fill="{P}"/>
<circle cx="32" cy="43" r="17" fill="{I}"/>
${EYE(25.5, 41)}${EYE(38.5, 41)}<ellipse cx="32" cy="48" rx="2.4" ry="1.8" fill="{P}"/>
<path d="M28.5 51 Q32 53.5 35.5 51" stroke="{P}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  // 용 — 사슴뿔 같은 뿔, 갈기, 길게 늘어진 수염
  辰: `<path d="M22 19 L17 4 M18.5 9.5 L11 6.5 M42 19 L47 4 M45.5 9.5 L53 6.5" stroke="{I}" stroke-width="3.4" stroke-linecap="round" fill="none"/>
<path d="M15 27 L5 22 L14 34Z M14 36 L4 38 L15 43Z M49 27 L59 22 L50 34Z M50 36 L60 38 L49 43Z" fill="{I}"/>
<path d="M14 30 Q14 15 32 15 Q50 15 50 30 L50 41 Q50 56 32 56 Q14 56 14 41Z" fill="{I}"/>
<path d="M19 24 L24 21 L29 24 M35 24 L40 21 L45 24" stroke="{P}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="24" cy="29" r="4" fill="{P}"/><circle cx="24.5" cy="29.5" r="2.1" fill="{I}"/><circle cx="40" cy="29" r="4" fill="{P}"/><circle cx="40.5" cy="29.5" r="2.1" fill="{I}"/>
<circle cx="27" cy="40" r="3.6" fill="{P}"/><circle cx="37" cy="40" r="3.6" fill="{P}"/><circle cx="27" cy="40.5" r="1.7" fill="{I}"/><circle cx="37" cy="40.5" r="1.7" fill="{I}"/>
<path d="M23 48 Q32 52 41 48" stroke="{P}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M26 49 L27.5 53 L29 49.8 M38 49 L36.5 53 L35 49.8" fill="{P}"/>
<path d="M20 42 Q8 44 6 59 M44 42 Q56 44 58 59" stroke="{I}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
  // 뱀 — S자로 선 몸, 갈라진 혀
  巳: `<path d="M16 57 Q42 58 43 47 Q44 37 27 35 Q12 33 18 23 Q23 15 37 17" stroke="{I}" stroke-width="9" stroke-linecap="round" fill="none"/>
<ellipse cx="41" cy="16" rx="8" ry="6" fill="{I}"/>${EYE(42, 14.5)}
<path d="M48.5 17 L54 17 M54 17 L57 14.5 M54 17 L57 19.5" stroke="{A}" stroke-width="1.6" stroke-linecap="round"/>`,
  // 말 — 긴 얼굴, 뾰족한 귀, 이마 갈기
  午: `<path d="M20 20 L21 7 L27.5 16Z" fill="{I}"/><path d="M44 20 L43 7 L36.5 16Z" fill="{I}"/>
<rect x="19" y="14" width="26" height="45" rx="13" fill="{I}"/>
<path d="M25 16 Q28 7 32 12 Q36 7 39 16 Q32 21 25 16Z" fill="{I}"/>
${EYE(24, 31)}${EYE(40, 31)}<ellipse cx="32" cy="51" rx="11" ry="7" fill="{P}"/>
<ellipse cx="28" cy="51" rx="1.8" ry="2.5" fill="{I}"/><ellipse cx="36" cy="51" rx="1.8" ry="2.5" fill="{I}"/>`,
  // 양 — 몽글몽글한 털, 말린 뿔
  未: `<circle cx="20" cy="22" r="8.5" fill="{I}"/><circle cx="32" cy="17" r="9.5" fill="{I}"/><circle cx="44" cy="22" r="8.5" fill="{I}"/>
<path d="M16 26 Q4 26 5 38 Q7 48 16 44 Q21 41 17 37 Q14 35 13 39" stroke="{I}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
<path d="M48 26 Q60 26 59 38 Q57 48 48 44 Q43 41 47 37 Q50 35 51 39" stroke="{I}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
<ellipse cx="32" cy="39" rx="12.5" ry="16" fill="{P}" stroke="{I}" stroke-width="2.6"/>
<circle cx="27" cy="37" r="2.1" fill="{I}"/><circle cx="37" cy="37" r="2.1" fill="{I}"/>
<path d="M29.5 47 Q32 49.5 34.5 47" stroke="{I}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  // 원숭이 — 큰 옆귀, 하트 모양 얼굴
  申: `<circle cx="10" cy="34" r="8.5" fill="{I}"/><circle cx="54" cy="34" r="8.5" fill="{I}"/>
<circle cx="10" cy="34" r="4" fill="{P}"/><circle cx="54" cy="34" r="4" fill="{P}"/>
<circle cx="32" cy="33" r="20" fill="{I}"/>
<circle cx="26" cy="31" r="8" fill="{P}"/><circle cx="38" cy="31" r="8" fill="{P}"/><ellipse cx="32" cy="43" rx="13" ry="9" fill="{P}"/>
<circle cx="26" cy="31" r="2.3" fill="{I}"/><circle cx="38" cy="31" r="2.3" fill="{I}"/>
<circle cx="30" cy="41" r="1.2" fill="{I}"/><circle cx="34" cy="41" r="1.2" fill="{I}"/>
<path d="M27 46 Q32 49.5 37 46" stroke="{I}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  // 닭 — 붉은 볏과 턱볏, 부리
  酉: `<path d="M19 22 Q19 8 25 14 Q28 3 33 13 Q38 5 40 16 Q46 12 43 23Z" fill="{A}"/>
<circle cx="31" cy="31" r="14" fill="{I}"/>
<path d="M20 38 Q15 57 32 59 Q50 58 44 37Z" fill="{I}"/>
<path d="M44 27 L57 31.5 L44 35.5Z" fill="{I}"/>
<ellipse cx="44.5" cy="41" rx="3.4" ry="5.5" fill="{A}"/>${EYE(35, 28)}`,
  // 개 — 늘어진 귀, 큰 코
  戌: `<ellipse cx="13" cy="33" rx="7.5" ry="14" transform="rotate(18 13 33)" fill="{I}"/><ellipse cx="51" cy="33" rx="7.5" ry="14" transform="rotate(-18 51 33)" fill="{I}"/>
<ellipse cx="32" cy="34" rx="16.5" ry="18" fill="{I}"/>
${EYE(25.5, 30)}${EYE(38.5, 30)}<ellipse cx="32" cy="44" rx="9.5" ry="7.5" fill="{P}"/>
<ellipse cx="32" cy="40.5" rx="3.8" ry="2.8" fill="{I}"/><path d="M32 43 V46 M28.5 47.5 Q32 49.5 35.5 47.5" stroke="{I}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  // 돼지 — 세모 귀, 큰 코에 콧구멍 둘
  亥: `<circle cx="32" cy="37" r="20" fill="{I}"/>
<path d="M12 14 Q25 13 27 25 Q19 28 12 14Z" fill="{I}" stroke="{P}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M52 14 Q39 13 37 25 Q45 28 52 14Z" fill="{I}" stroke="{P}" stroke-width="1.6" stroke-linejoin="round"/>
${EYE(23.5, 33)}${EYE(40.5, 33)}<ellipse cx="32" cy="45" rx="12.5" ry="8.5" fill="{P}"/>
<ellipse cx="27.5" cy="45" rx="2.4" ry="3.6" fill="{I}"/><ellipse cx="36.5" cy="45" rx="2.4" ry="3.6" fill="{I}"/>`,
};

export function ttiAnimalSvg(ji: string, size: number, ink = '#2A231C', paper = '#FFFDF8', accent = '#A23A2A'): string {
  const body = (TTI_ANIMAL_SVG[ji] || '').replace(/\{I\}/g, ink).replace(/\{P\}/g, paper).replace(/\{A\}/g, accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
