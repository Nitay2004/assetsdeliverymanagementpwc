/**
 * Parse an email received hour string and determine cutoff status + SLA start date.
 *
 * Rules:
 *  - 11:30 – 13:55 → "Within Cutoff", SLA start = same day
 *  - 14:01 – 17:30 → "After Cutoff", SLA start = next business day
 *  - Outside these windows → null (no auto-fill)
 */
export function calculateCutoff(emailReceivedHour: string): {
  cutOffStatus: string;
  slaStartDate: string; // ISO date string (YYYY-MM-DD)
} | null {
  const minutes = parseTimeToMinutes(emailReceivedHour);
  if (minutes === null) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Within cutoff: 11:30 (690 min) to 13:55 (835 min)
  if (minutes >= 690 && minutes <= 835) {
    return {
      cutOffStatus: "Within Cutoff",
      slaStartDate: formatDate(today),
    };
  }

  // After cutoff: 14:01 (841 min) to 17:30 (1050 min)
  if (minutes >= 841 && minutes <= 1050) {
    const nextDay = new Date(today);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      cutOffStatus: "After Cutoff",
      slaStartDate: formatDate(nextDay),
    };
  }

  return null;
}

function parseTimeToMinutes(time: string): number | null {
  if (!time || !time.trim()) return null;
  const cleaned = time.trim().toUpperCase();

  // Try HH:MM (24h) — e.g. "13:30"
  let match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m;
  }

  // Try HH:MM AM/PM — e.g. "2:30 PM", "11:30 AM"
  match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3];
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      if (period === "PM" && h !== 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return h * 60 + m;
    }
  }

  return null;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
