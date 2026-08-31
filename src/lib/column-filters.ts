export interface ColumnFilterValue {
  value: string;
  count: number;
}

export function parseColumnFilters(
  searchParams: Record<string, string | string[] | undefined>,
  keys: string[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const key of keys) {
    const raw = typeof searchParams[key] === "string" ? searchParams[key] : undefined;
    if (raw) {
      const vals = raw.split(",").map(v => v.trim()).filter(Boolean);
      if (vals.length) out[key] = vals;
    }
  }
  return out;
}

export function computeDistinctValues<T>(
  rows: T[],
  getters: Record<string, (row: T) => string | number | null | undefined>
): Record<string, ColumnFilterValue[]> {
  const map: Record<string, Map<string, number>> = {};
  for (const row of rows) {
    for (const key of Object.keys(getters)) {
      const v = getters[key](row);
      const s = v === null || v === undefined || String(v).trim() === "" ? "(Blank)" : String(v);
      const m = (map[key] ??= new Map());
      m.set(s, (m.get(s) ?? 0) + 1);
    }
  }
  const out: Record<string, ColumnFilterValue[]> = {};
  for (const [k, m] of Object.entries(map)) {
    out[k] = [...m.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }
  return out;
}