// 어드민 대시보드 — CSV 생성·다운로드 유틸 (2026-06-10)
//   UTF-8 BOM 포함 → 엑셀에서 한글 깨짐 없이 바로 열림.

export type CsvCell = string | number | null | undefined;

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // 콤마·따옴표·개행 포함 시 따옴표 감싸기
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** headers + rows → CSV 문자열 (CRLF — 엑셀 호환) */
export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCell).join(','));
  return lines.join('\r\n');
}

/** CSV 다운로드 — UTF-8 BOM 선두 부착 (엑셀 한글 호환) */
export function downloadCsv(filename: string, csv: string): void {
  const BOM = String.fromCharCode(0xfeff); // U+FEFF — 엑셀 한글 호환 BOM (리터럴 대신 명시 코드)
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 파일명에 날짜 범위 붙이기 — saju500_revenue_2026-06-01_2026-06-10.csv */
export function csvFilename(base: string, fromDay: string, toDay: string): string {
  return `saju500_${base}_${fromDay}_${toDay}.csv`;
}
