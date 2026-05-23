export type CsvValue = string | number | boolean | Date | null | undefined;

export function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  if (!/[",\r\n]/.test(raw)) return raw;
  return `"${raw.replaceAll('"', '""')}"`;
}

export function rowsToCsv(
  headers: string[],
  rows: Array<Record<string, CsvValue>>,
): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
