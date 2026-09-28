/**
 * CSV for spreadsheet downloads.
 *
 * Every cell here can carry someone's own free text (a display name, a suburb),
 * and Excel and Sheets run a cell that starts with = + - @ (or a tab / CR) as a
 * formula. The leading apostrophe makes it literal text; the quote rules are
 * RFC 4180.
 */
export function csvCell(value: string): string {
  const literal = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(literal) ? `"${literal.replace(/"/g, '""')}"` : literal;
}

/** Rows to a CSV body. The BOM is what makes Excel read UTF-8 names correctly. */
export function toCsv(rows: string[][]): string {
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
