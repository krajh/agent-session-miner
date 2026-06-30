/**
 * The one interval algorithm.
 *
 * Sessions overlap when work runs in parallel (multiple agents) or when one
 * tool's session brackets another's. Summing durations overcounts that shared
 * wall-clock time; merging overlapping intervals recovers the real elapsed time.
 */

import type { TimeInterval } from "./types";

/** Merge overlapping/adjacent intervals into a minimal non-overlapping set. */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: TimeInterval[] = [{ ...sorted[0] }];

  for (const next of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (next.start <= last.end) {
      last.end = Math.max(last.end, next.end);
    } else {
      merged.push({ ...next });
    }
  }

  return merged;
}

/** Real elapsed time (ms) after collapsing overlaps. */
export function mergedDuration(intervals: TimeInterval[]): number {
  return mergeIntervals(intervals).reduce((sum, i) => sum + (i.end - i.start), 0);
}

/** Naive sum (ms) that double-counts parallel work — kept for comparison. */
export function simpleSum(intervals: TimeInterval[]): number {
  return intervals.reduce((sum, i) => sum + (i.end - i.start), 0);
}

export interface TimeSaved {
  simpleSum: number;
  merged: number;
  saved: number;
  percent: number;
}

export function timeSaved(intervals: TimeInterval[]): TimeSaved {
  const sum = simpleSum(intervals);
  const merged = mergedDuration(intervals);
  const saved = sum - merged;
  return { simpleSum: sum, merged, saved, percent: sum > 0 ? (saved / sum) * 100 : 0 };
}

export const intervalOf = (s: TimeInterval): TimeInterval => ({ start: s.start, end: s.end });

/** Human-readable duration from milliseconds: "4h 7m" or "37m". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
