/**
 * Local-timezone date helpers.
 *
 * Daily notes are a personal journal, so every day boundary is the user's
 * local midnight — not UTC. Keeping one convention here avoids the off-by-a-day
 * bucketing bug you get from mixing `toISOString()` with local `new Date(str)`.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" for the local calendar day containing `ms`. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Epoch ms for local midnight at the start of a "YYYY-MM-DD" day. */
export function startOfLocalDay(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).getTime();
}

/** Inclusive list of local day strings from `startMs` to `endMs`. */
export function daysInRange(startMs: number, endMs: number): string[] {
  const days: string[] = [];
  let cursor = startOfLocalDay(localDay(startMs));
  while (cursor <= endMs) {
    days.push(localDay(cursor));
    cursor += MS_PER_DAY;
  }
  return days;
}

/** Shift a "YYYY-MM-DD" day string by N days (local). */
export function addDays(day: string, n: number): string {
  return localDay(startOfLocalDay(day) + n * MS_PER_DAY);
}

/** Split a sorted list of day strings into consecutive 7-day [start, end] weeks. */
export function weekRanges(days: string[]): Array<[string, string]> {
  if (days.length === 0) return [];
  const weeks: Array<[string, string]> = [];
  const last = days[days.length - 1];
  let weekStart = days[0];
  while (weekStart <= last) {
    const weekEnd = addDays(weekStart, 6);
    weeks.push([weekStart, weekEnd > last ? last : weekEnd]);
    weekStart = addDays(weekStart, 7);
  }
  return weeks;
}
