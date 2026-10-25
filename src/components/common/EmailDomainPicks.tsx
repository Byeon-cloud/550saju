/**
 * 메일 주소 뒷부분 빠른 선택 (2026-10-17) — 오너: 대부분 네이버 메일로 넣는다. 40~60대가 '@naver.com' 을 치기 어렵다.
 *   아이디를 치면 아래에 자주 쓰는 메일 뒷부분이 나오고, 누르면 '@' 뒤를 그것으로 바꾼다. 다 맞게 쳤으면 숨는다.
 *   쓰는 곳: PdfMailSheet, DeadlineMailSignup, DailyMailSignup.
 */
// 2026-10-26 메일 칸은 웹 전용이라 앱 빌드에서는 빈 목록(앱 번들에 네이버, 카카오 같은 이름이 남지 않게, 1.6.3 검수 반려 대응)
const DOMAINS = import.meta.env.VITE_BUILD_TARGET === 'appintos' ? [] : ['naver.com', 'gmail.com', 'daum.net', 'hanmail.net', 'kakao.com', 'nate.com'];

export function EmailDomainPicks({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const v = value.trim();
  if (!v) return null;
  const at = v.indexOf('@');
  const local = at >= 0 ? v.slice(0, at) : v;
  const dom = at >= 0 ? v.slice(at + 1).toLowerCase() : '';
  if (!local || DOMAINS.includes(dom)) return null;
  const list = dom ? DOMAINS.filter((d) => d.startsWith(dom)) : DOMAINS;
  if (!list.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }} aria-label="메일 주소 뒷부분 고르기">
      {list.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onPick(`${local}@${d}`)}
          style={{ minHeight: 36, padding: '0 10px', borderRadius: 10, border: '1px solid #E1D7C4', background: '#FFFDF8', color: '#1A1612', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
        >
          @{d}
        </button>
      ))}
    </div>
  );
}
