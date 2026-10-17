"""한국 음력 표 만들기 (2026-10-17)

lunar-javascript 는 중국 음력이라 한국 음력과 1930~2050년 1,496달 중 54달이 하루 어긋나고
2012, 2017년은 윤달 자리가 다르다. 한국천문연구원 자료로 만든 korean_lunar_calendar(PyPI)에서
1900~2050년 음력 해마다 [설날 양력 날짜, 윤달, 달 길이 비트]를 뽑아 TS 파일 두 곳에 같게 쓴다.

  pip install korean-lunar-calendar
  python scripts/saju/gen_korean_lunar.py
"""
import datetime, pathlib
from korean_lunar_calendar import KoreanLunarCalendar

ROOT = pathlib.Path(__file__).resolve().parents[2]
c = KoreanLunarCalendar()
rows = []
for y in range(1900, 2051):
    if not c.setLunarDate(y, 1, 1, False):
        continue
    ny = datetime.date.fromisoformat(c.SolarIsoFormat())
    leap = 0
    for m in range(1, 13):
        if c.setLunarDate(y, m, 1, True):
            leap = m
    order = []
    for m in range(1, 13):
        order.append((m, False))
        if leap == m:
            order.append((m, True))
    bits = 0
    ok = True
    for i, (m, lp) in enumerate(order):
        if not c.setLunarDate(y, m, 1, lp):
            ok = False
            break
        if c.setLunarDate(y, m, 30, lp):
            bits |= 1 << i
    if not ok:
        continue
    days = (ny - datetime.date(1970, 1, 1)).days
    rows.append((y, days, leap, bits))

first, last = rows[0][0], rows[-1][0]
body = ',\n'.join(f'  [{d}, {l}, {b}]' for (_, d, l, b) in rows)
ts = f'''/**
 * 한국 음력 (2026-10-17) — 한국천문연구원 자료 기반 표로 음력과 양력을 바꾼다.
 *
 *   lunar-javascript 는 중국 음력이라 한국 음력과 1930~2050년 1,496달 중 54달이 하루 어긋나고
 *   2012, 2017년은 윤달 자리가 다르다(한국 윤3월, 윤5월). 음력 생일은 반드시 이 파일로 바꾼다.
 *   표 범위({first}~{last}년) 밖이면 null 을 돌려주고, 부르는 쪽이 lunar-javascript 로 대신한다.
 *
 *   자동 생성 파일: scripts/saju/gen_korean_lunar.py (src/services/saju 와 functions/src/shared 두 곳에 같은 내용)
 */

/** 음력 해마다 [설날의 1970-01-01 기준 날 수, 윤달(없으면 0), 달 길이 비트(순서대로 1=30일)] */
const FIRST_YEAR = {first};
const TABLE: ReadonlyArray<readonly [number, number, number]> = [
{body},
];

function row(year: number) {{
  const r = TABLE[year - FIRST_YEAR];
  return r ? {{ day0: r[0], leap: r[1], bits: r[2] }} : null;
}}

/** 그해 달 순서: 1월, (윤달), 2월 … */
function monthIndex(leap: number, month: number, isLeap: boolean): number {{
  if (isLeap) return leap === month ? month : -1;
  return leap && month > leap ? month : month - 1;
}}

/** 한국 음력 해에 그 윤달이 있는지 (표 밖이면 null) */
export function krLeapMonth(year: number): number | null {{
  const r = row(year);
  return r ? r.leap : null;
}}

/** 한국 음력 달의 날 수 29 또는 30. 그해에 없는 윤달이면 0, 표 밖이면 null */
export function krLunarMonthDays(year: number, month: number, isLeap: boolean): number | null {{
  const r = row(year);
  if (!r) return null;
  const i = monthIndex(r.leap, month, isLeap);
  if (i < 0) return 0;
  return (r.bits >> i) & 1 ? 30 : 29;
}}

/** 한국 음력 → 양력. 없는 날이면 0 이 아닌 null, 표 밖이어도 null */
export function krLunarToSolar(year: number, month: number, day: number, isLeap: boolean): {{ year: number; month: number; day: number }} | null {{
  const r = row(year);
  if (!r || month < 1 || month > 12 || day < 1) return null;
  const i = monthIndex(r.leap, month, isLeap);
  if (i < 0) return null;
  const len = (r.bits >> i) & 1 ? 30 : 29;
  if (day > len) return null;
  let n = r.day0;
  for (let k = 0; k < i; k++) n += (r.bits >> k) & 1 ? 30 : 29;
  const t = new Date((n + day - 1) * 86400000);
  return {{ year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }};
}}

/** 양력 → 한국 음력 (표 밖이면 null) */
export function krSolarToLunar(year: number, month: number, day: number): {{ year: number; month: number; day: number; isLeap: boolean }} | null {{
  const n = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  for (let y = year; y >= year - 1; y--) {{
    const r = row(y);
    if (!r || n < r.day0) continue;
    let start = r.day0;
    const count = r.leap ? 13 : 12;
    for (let i = 0; i < count; i++) {{
      const len = (r.bits >> i) & 1 ? 30 : 29;
      if (n < start + len) {{
        const isLeap = !!r.leap && i === r.leap;
        const m = r.leap && i >= r.leap ? i : i + 1;
        return {{ year: y, month: m, day: n - start + 1, isLeap }};
      }}
      start += len;
    }}
  }}
  return null;
}}
'''
for p in [ROOT / 'src/services/saju/koreanLunar.ts', ROOT / 'functions/src/shared/koreanLunar.ts']:
    p.write_text(ts, encoding='utf-8')
print('years', first, last, len(rows))
