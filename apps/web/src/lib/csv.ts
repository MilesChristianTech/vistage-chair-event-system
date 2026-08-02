/** Minimal, dependency-free CSV writer - quotes any field containing a
 * comma, quote, or newline, and doubles internal quotes per RFC 4180. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined): string => {
    const str = value == null ? '' : String(value);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))];

  // Leading UTF-8 BOM so Excel (Windows in particular) renders accented
  // names correctly instead of guessing the wrong encoding.
  return '﻿' + lines.join('\r\n');
}
