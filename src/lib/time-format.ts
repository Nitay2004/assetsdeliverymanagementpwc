/**
 * The app records times in 24-hour "HH:MM" (e.g. "14:30"), which is what the
 * cutoff/SLA rules are written against. Excel imports and older rows, however,
 * can carry 12-hour strings such as "1:31 PM", so every boundary normalises
 * through here.
 *
 * Accepted inputs:
 *   - "14:30", "9:05"          → zero-padded 24-hour
 *   - "14:30:00"               → seconds dropped
 *   - "1:31 PM", "01:31pm"     → converted to 24-hour
 *
 * Anything that cannot be parsed is returned untouched, so free text is never
 * silently destroyed.
 */
export function formatTime24(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (!trimmed) return value;

  const twelveHour = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP])\.?\s*M\.?$/i);
  if (twelveHour) {
    let hours = parseInt(twelveHour[1], 10);
    const minutes = parseInt(twelveHour[2], 10);
    const period = twelveHour[3].toUpperCase();

    if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (period === "P" && hours !== 12) hours += 12;
      if (period === "A" && hours === 12) hours = 0;
      return `${pad(hours)}:${pad(minutes)}`;
    }
  }

  const twentyFourHour = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourHour) {
    const hours = parseInt(twentyFourHour[1], 10);
    const minutes = parseInt(twentyFourHour[2], 10);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${pad(hours)}:${pad(minutes)}`;
    }
  }

  return value;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
