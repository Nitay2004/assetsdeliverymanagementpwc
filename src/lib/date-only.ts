// Helpers for the `@db.Date` (date-only) columns in this schema.
//
// Prisma writes a JavaScript `Date` into a DATE column by taking its UTC year,
// month and day. Building such a Date from local midnight (or from a UTC
// timestamp that happens to be late in the day) shifts the stored calendar day
// for a server east of UTC — India is +05:30, so a delivery stamped
// "2026-08-21 00:30 IST" would otherwise be saved as 2026-08-20. Every
// date-only value must therefore be normalised to UTC midnight of the intended
// calendar day before it is written.

/** UTC midnight for a YYYY-MM-DD string, or null when it is not a real date. */
export function parseDateOnlyUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    return null;
  }
  return date;
}

/**
 * UTC midnight of the given instant as seen in a fixed offset (default IST,
 * +05:30). Use this to turn a courier's timezone-less timestamp into the
 * calendar day that should land in a DATE column.
 */
export function dateOnlyInOffset(date: Date, offsetMinutes = 330): Date {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** UTC midnight of "today" (in UTC) — for a DATE column defaulting to now. */
export function todayDateOnlyUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
