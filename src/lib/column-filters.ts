export interface ColumnFilterValue {
  value: string;
  count: number;
}

export const BLANK_TOKEN = "(Blank)";

/**
 * Filter dropdowns offer "(Blank)" so rows where nothing was recorded can be
 * found. Prisma cannot match that token literally and rejects `in: [..., null]`,
 * so a blank selection is translated into "is null" plus "is an empty string"
 * and OR-ed together with the real values of that one column.
 *
 * The flat conditions are meant to be wrapped in `{ OR: ... }` — use
 * `blankTokenCondition` for that, or `andFilterConditions` to AND a whole set of
 * columns into a where clause at once.
 */
export function blankTokenConditions(
  field: string,
  selected: string[],
  options?: { emptyString?: boolean },
): Record<string, unknown>[] {
  const values = selected.filter(value => value !== BLANK_TOKEN);
  const conditions: Record<string, unknown>[] = [];
  if (values.length > 0) conditions.push({ [field]: { in: values } });
  if (values.length !== selected.length) {
    conditions.push({ [field]: null });
    if (options?.emptyString !== false) conditions.push({ [field]: "" });
  }
  return conditions;
}

/** One column's blank-aware selection as a ready-to-use `{ OR: [...] }` group. */
export function blankTokenCondition(
  field: string,
  selected: string[],
  options?: { emptyString?: boolean },
): Record<string, unknown> {
  return { OR: blankTokenConditions(field, selected, options) };
}

/**
 * One group per filtered column, so filtering on Employee *and* Location stays
 * "employee matches AND location matches" instead of collapsing into a single OR.
 */
export function collectBlankTokenConditions(
  selected: Record<string, string[]>,
  fields: Record<string, string>,
  options?: { emptyString?: boolean },
): Record<string, unknown>[] {
  const groups: Record<string, unknown>[] = [];
  for (const [key, field] of Object.entries(fields)) {
    const values = selected[key];
    if (values?.length) groups.push(blankTokenCondition(field, values, options));
  }
  return groups;
}

/**
 * ANDs the blank-aware groups into a where clause. They go into `AND` because
 * `OR` is already taken by the free-text search on every list page.
 */
export function andFilterConditions<T extends object>(where: T, groups: Record<string, unknown>[]): T {
  if (groups.length === 0) return where;
  const target = where as Record<string, unknown>;
  const existing = Array.isArray(target.AND) ? (target.AND as unknown[]) : [];
  target.AND = [...existing, ...groups];
  return where;
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