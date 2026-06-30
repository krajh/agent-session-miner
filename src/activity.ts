/**
 * The shared activity model.
 *
 * Every source reduces to the same thing: a session plus the timestamps of when
 * it was actually active. A session's events can span many days and sit idle for
 * hours (a long-lived OpenCode session, a resumed Claude transcript), so we
 * segment the timestamps into bursts — a gap over IDLE_GAP_MS ends a burst — and
 * attribute the active time to the local day it happened. The result is one
 * `Session` record per (session x day), which feeds the interval merger.
 *
 * This is the same anti-overcounting principle the merger applies to parallel
 * work, applied here to wall-clock idle.
 */

import { localDay } from "./dates";
import type { Session, SourceName } from "./types";

const IDLE_GAP_MS = 30 * 60 * 1000;

export interface ActiveWindow {
  day: string;
  start: number; // epoch ms, earliest activity that day
  activeMs: number; // gap-excluded active time that day
}

export interface SessionMeta {
  id: string;
  source: SourceName;
  project: string;
  title: string;
}

/** Segment timestamps into activity bursts, then total active time per local day. */
export function dailyActiveWindows(
  timestamps: number[],
  idleGapMs: number = IDLE_GAP_MS,
): ActiveWindow[] {
  const sorted = [...timestamps].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const byDay = new Map<string, { start: number; activeMs: number }>();
  const record = (burstStart: number, burstEnd: number) => {
    const day = localDay(burstStart);
    const existing = byDay.get(day) ?? { start: burstStart, activeMs: 0 };
    existing.start = Math.min(existing.start, burstStart);
    existing.activeMs += burstEnd - burstStart;
    byDay.set(day, existing);
  };

  let burstStart = sorted[0];
  let prev = sorted[0];
  for (const ts of sorted.slice(1)) {
    if (ts - prev > idleGapMs) {
      record(burstStart, prev);
      burstStart = ts;
    }
    prev = ts;
  }
  record(burstStart, prev);

  return [...byDay.entries()]
    .map(([day, { start, activeMs }]) => ({ day, start, activeMs }))
    .sort((a, b) => a.start - b.start);
}

/** Expand one session's activity into per-day `Session` records within range. */
export function sessionsFromActivity(
  meta: SessionMeta,
  timestamps: number[],
  rangeStart: number,
  rangeEnd: number,
): Session[] {
  const sessions: Session[] = [];
  for (const window of dailyActiveWindows(timestamps)) {
    if (window.activeMs === 0) continue; // single-event burst — no measurable work
    const end = window.start + window.activeMs;
    if (end < rangeStart || window.start > rangeEnd) continue;
    sessions.push({ ...meta, start: window.start, end });
  }
  return sessions;
}
