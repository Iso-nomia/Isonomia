/**
 * experiments/R-blind-spot/csv.ts
 *
 * Minimal, correct CSV (RFC-4180-ish) read/write with no dependency. Used only
 * for SHORT human-input columns (id + verdict/label + short note); long item
 * text is read by the human from the generated markdown sheet, never round-
 * tripped through CSV — so multiline abstracts can't corrupt the parse.
 */

export function toCsv(rows: Record<string, string>[], columns: string[]): string {
  const esc = (v: string): string => {
    const s = v ?? "";
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c] ?? "")).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

export function fromCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((f) => f.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0];
  return nonEmpty.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h.trim()] = (r[i] ?? "").trim()));
    return o;
  });
}
