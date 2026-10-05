/** Minimal RFC 4180 CSV writer. Pure, so it can be reused by any route handler. */

export type CsvValue = string | number | boolean | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => CsvValue;
};

/** Leading characters that make spreadsheet apps evaluate a cell as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escape one cell. Quotes values containing commas, quotes or line breaks (doubling inner quotes),
 * and neutralises formula injection in text cells by prefixing a single quote.
 * Numbers are written as-is so negative amounts stay numeric.
 */
export function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let text = value;
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialise rows to CSV with a header line. Lines end with CRLF, per RFC 4180. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCsvValue(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvValue(c.value(row))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
