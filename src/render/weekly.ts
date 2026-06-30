/**
 * Weekly summary renderer plus the performance-reflection note.
 *
 * The summary is regenerated each run. The reflection is seeded once from a
 * template and then left alone — it is a journal you fill in, not a derived
 * artifact, so we never overwrite an existing one.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { formatDuration } from "../intervals";

export interface WeekTotals {
  start: string;
  end: string;
  durationMs: number;
  sessionCount: number;
}

export function writeWeeklySummary(weeklyDir: string, week: WeekTotals): void {
  const content = [
    `# Week: ${week.start} to ${week.end}`,
    ``,
    `## Summary`,
    `- **Total Time**: ${formatDuration(week.durationMs)}`,
    `- **Sessions**: ${week.sessionCount}`,
    ``,
    `## Daily Notes`,
    ``,
    "```dataview",
    `LIST`,
    `FROM "Daily Notes"`,
    `WHERE file.name >= "${week.start}" AND file.name <= "${week.end}"`,
    `SORT file.name ASC`,
    "```",
    ``,
    `## Performance Reflection`,
    ``,
    `[[${week.start}_to_${week.end}_reflection|📊 Weekly Performance Reflection]]`,
    ``,
  ].join("\n");

  writeFileSync(join(weeklyDir, `${week.start}_to_${week.end}.md`), content, "utf-8");
}

export function writeWeeklyReflection(
  weeklyDir: string,
  week: WeekTotals,
  templatePath: string,
): void {
  const reflectionPath = join(weeklyDir, `${week.start}_to_${week.end}_reflection.md`);
  if (existsSync(reflectionPath) || !existsSync(templatePath)) return;

  const filled = readFileSync(templatePath, "utf-8")
    .replaceAll("{{date:YYYY-MM-DD}}", week.start)
    .replaceAll("{{date+6d:YYYY-MM-DD}}", week.end)
    .replace("**Total Time**: (auto-filled from weekly summary)", `**Total Time**: ${formatDuration(week.durationMs)}`)
    .replace("**Sessions**: (auto-filled from weekly summary)", `**Sessions**: ${week.sessionCount}`);

  writeFileSync(reflectionPath, filled, "utf-8");
}
