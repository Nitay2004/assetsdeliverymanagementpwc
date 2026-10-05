/**
 * SheetJS `sheet_to_json(sheet, { header: 1 })` returns sparse arrays when a
 * worksheet contains blank stub cells (`t: "z"`), which real Excel exports
 * produce for every empty cell inside the used range. `Array.prototype.map`
 * skips holes, so a `cell => String(cell ?? "")` guard never runs for them and
 * the hole survives as `undefined`, crashing the first `.trim()` downstream.
 * Rebuilding the row by index closes those holes.
 */
export function toDenseRow(row: unknown[] | undefined | null): string[] {
  const length = row?.length ?? 0;
  const dense: string[] = new Array(length);
  for (let i = 0; i < length; i++) {
    const cell = row![i];
    dense[i] = cell === null || cell === undefined ? "" : String(cell);
  }
  return dense;
}

export function toDenseRows(rows: unknown[][] | undefined | null): string[][] {
  if (!Array.isArray(rows)) return [];
  const dense: string[][] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    dense[i] = toDenseRow(rows[i]);
  }
  return dense;
}