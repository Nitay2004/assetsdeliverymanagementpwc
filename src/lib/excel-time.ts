/**
 * Excel stores a time-only cell (e.g. "13:31") as a fraction of a 24-hour day.
 * When SheetJS reads such a cell without `raw: false` it returns that fraction
 * as a number (e.g. 0.5631944444444444), not a formatted time. This converts a
 * pure day-fraction string back to a 24-hour "HH:MM" string.
 *
 * Anything that is not a fraction in [0, 1) is returned unchanged, so already
 * formatted times ("13:31", "1:31 PM") and free text are preserved as-is.
 */
export function formatExcelTime(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return value;
  const num = Number(trimmed);
  if (isNaN(num) || num < 0 || num >= 1) return value;
  const totalMinutes = Math.round(num * 24 * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
