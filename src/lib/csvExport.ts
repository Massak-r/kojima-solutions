/**
 * Generic CSV export utility.
 * Uses semicolon delimiter for French Excel compatibility.
 */

interface CsvColumn {
  key: string;
  label: string;
}

function escapeCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  // Wrap in quotes if the value contains semicolons, quotes, or newlines
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function downloadCSV(
  rows: Record<string, string | number | null | undefined>[],
  columns: CsvColumn[],
  filename: string,
): void {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const SEP = ";";

  const header = columns.map((c) => escapeCell(c.label)).join(SEP);
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(SEP),
  );
  const csv = BOM + [header, ...body].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
