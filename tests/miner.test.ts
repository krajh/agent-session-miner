import { describe, expect, test } from "bun:test";
import { mergeIntervals, mergedDuration, formatDuration } from "../src/intervals";
import { repoNameFromPath } from "../src/projects";
import { localDay, startOfLocalDay, weekRanges, addDays } from "../src/dates";
import { dailyActiveWindows } from "../src/activity";
import { titleFromUserTexts } from "../src/sources/claude-code";

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("interval merging", () => {
  test("merges overlapping intervals", () => {
    const merged = mergeIntervals([
      { start: 0, end: 100 },
      { start: 50, end: 150 },
    ]);
    expect(merged).toEqual([{ start: 0, end: 150 }]);
  });

  test("keeps disjoint intervals", () => {
    const merged = mergeIntervals([
      { start: 0, end: 100 },
      { start: 200, end: 300 },
    ]);
    expect(merged.length).toBe(2);
  });

  test("three parallel hours collapse to one", () => {
    const intervals = [
      { start: 0, end: HOUR },
      { start: 0, end: HOUR },
      { start: 0, end: HOUR },
    ];
    expect(mergedDuration(intervals)).toBe(HOUR);
  });

  test("formats duration", () => {
    expect(formatDuration(4 * HOUR + 7 * MIN)).toBe("4h 7m");
    expect(formatDuration(37 * MIN)).toBe("37m");
  });
});

describe("repo name from path", () => {
  test("collapses worktrees and subdirs to the repo", () => {
    expect(repoNameFromPath("/Users/k/dev/CoinBurn/.worktrees/dreamy-dhawan")).toBe("CoinBurn");
    expect(repoNameFromPath("/Users/k/dev/CoinBurn/main")).toBe("CoinBurn");
    expect(repoNameFromPath("/Users/k/kai/grimoire")).toBe("grimoire");
    expect(repoNameFromPath(null)).toBeNull();
  });
});

describe("dates", () => {
  test("localDay round-trips through startOfLocalDay", () => {
    const ms = startOfLocalDay("2026-06-15") + 3 * HOUR;
    expect(localDay(ms)).toBe("2026-06-15");
  });

  test("addDays and weekRanges", () => {
    expect(addDays("2026-06-01", 6)).toBe("2026-06-07");
    const weeks = weekRanges(["2026-06-01", "2026-06-05", "2026-06-09", "2026-06-12"]);
    expect(weeks[0]).toEqual(["2026-06-01", "2026-06-07"]);
    expect(weeks[1]).toEqual(["2026-06-08", "2026-06-12"]);
  });
});

describe("claude gap segmentation", () => {
  const base = startOfLocalDay("2026-06-01");

  test("groups close events into one active window", () => {
    const windows = dailyActiveWindows([base, base + 10 * MIN, base + 20 * MIN]);
    expect(windows.length).toBe(1);
    expect(windows[0].activeMs).toBe(20 * MIN);
  });

  test("excludes idle gaps over the threshold", () => {
    const windows = dailyActiveWindows([base, base + 10 * MIN, base + 45 * MIN, base + 50 * MIN]);
    expect(windows.length).toBe(1);
    expect(windows[0].activeMs).toBe(15 * MIN); // 10m + 5m, the 35m gap dropped
  });

  test("splits work across days", () => {
    const day2 = startOfLocalDay("2026-06-02");
    const windows = dailyActiveWindows([base, base + 30 * MIN, day2, day2 + 15 * MIN]);
    expect(windows.map((w) => w.day)).toEqual(["2026-06-01", "2026-06-02"]);
    expect(windows[1].activeMs).toBe(15 * MIN);
  });
});

describe("claude title extraction", () => {
  test("prefers the slash command that drove the session", () => {
    expect(titleFromUserTexts(["<command-message>x</command-message>\n<command-name>review</command-name>"])).toBe("/review");
  });

  test("falls back to first meaningful human line", () => {
    expect(titleFromUserTexts(["<system-reminder>noise</system-reminder>\nFix the login redirect bug"])).toBe("Fix the login redirect bug");
  });

  test("skips noise-only messages", () => {
    expect(titleFromUserTexts(["Base directory for this skill: /x", "Refactor the parser"])).toBe("Refactor the parser");
  });

  test("defaults when nothing usable", () => {
    expect(titleFromUserTexts([])).toBe("Untitled Claude session");
  });
});
