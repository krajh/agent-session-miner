#!/usr/bin/env bun
/**
 * Session Miner — one entry point.
 *
 *   load (all sources) -> bucket by local day -> render notes -> summarize
 *
 * Flags reuse the same loaded data instead of re-opening sources:
 *   --calculate   print per-day / total time, write nothing
 *   --analyze     print the parallel-work savings table, write nothing
 */

import { mkdirSync } from "fs";
import { join } from "path";
import type { MinerConfig, Session, SourceName } from "./types";
import { loadAllSessions } from "./sources";
import { formatDuration, mergedDuration, timeSaved } from "./intervals";
import { localDay, daysInRange, weekRanges, startOfLocalDay, addDays } from "./dates";
import { groupBy } from "./group";
import { writeDailyNote } from "./render/daily";
import { writeWeeklySummary, writeWeeklyReflection, type WeekTotals } from "./render/weekly";
import { organizePara } from "./render/para";

const HOME = process.env.HOME ?? "";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ALL_SOURCES: SourceName[] = ["claude", "opencode"];

interface Args {
  start?: string;
  end?: string;
  days?: number;
  sources?: SourceName[];
  mode: "mine" | "calculate" | "analyze";
}

function parseArgs(argv: string[]): Args {
  const args: Args = { mode: "mine" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--calculate") args.mode = "calculate";
    else if (flag === "--analyze") args.mode = "analyze";
    else if (flag === "--start") args.start = argv[++i];
    else if (flag === "--end") args.end = argv[++i];
    else if (flag === "--days") args.days = parseInt(argv[++i], 10);
    else if (flag === "--sources") args.sources = argv[++i].split(",") as SourceName[];
  }
  return args;
}

function buildConfig(args: Args): MinerConfig {
  const now = Date.now();
  const days = args.days ?? (process.env.DAYS ? parseInt(process.env.DAYS, 10) : 30);
  const startDay = args.start ?? process.env.START_DATE ?? localDay(now - days * MS_PER_DAY);
  const endDay = args.end ?? process.env.END_DATE ?? localDay(now);

  const vaultPath = process.env.OBSIDIAN_VAULT_PATH ?? "";
  return {
    vaultPath,
    opencodeDbPath: process.env.OPENCODE_DB_PATH ?? join(HOME, ".local/share/opencode/opencode.db"),
    claudeProjectsDir: process.env.CLAUDE_PROJECTS_DIR ?? join(HOME, ".claude/projects"),
    sources: args.sources ?? (process.env.SOURCES?.split(",") as SourceName[]) ?? ALL_SOURCES,
    rangeStart: startOfLocalDay(startDay),
    rangeEnd: startOfLocalDay(addDays(endDay, 1)) - 1,
    performanceTemplatePath:
      process.env.PERFORMANCE_TEMPLATE_PATH ??
      join(vaultPath, "Templates", "Weekly Performance Reflection.md"),
  };
}

function weekTotals(start: string, end: string, byDay: Map<string, Session[]>): WeekTotals {
  const sessions = daysInRange(startOfLocalDay(start), startOfLocalDay(end)).flatMap(
    (day) => byDay.get(day) ?? [],
  );
  return { start, end, durationMs: mergedDuration(sessions), sessionCount: sessions.length };
}

function mine(config: MinerConfig, byDay: Map<string, Session[]>): void {
  const dailyDir = join(config.vaultPath, "Daily Notes");
  const weeklyDir = join(config.vaultPath, "Weekly Summaries");
  mkdirSync(dailyDir, { recursive: true });
  mkdirSync(weeklyDir, { recursive: true });

  const days = daysInRange(config.rangeStart, config.rangeEnd);

  console.log("\n[1/3] Daily notes");
  for (const day of days) {
    const sessions = byDay.get(day);
    if (!sessions?.length) continue;
    writeDailyNote(dailyDir, day, sessions);
    console.log(`  ${day}: ${sessions.length} sessions, ${formatDuration(mergedDuration(sessions))}`);
  }

  console.log("\n[2/3] Weekly summaries");
  for (const [start, end] of weekRanges(days)) {
    const totals = weekTotals(start, end, byDay);
    if (totals.sessionCount === 0) continue;
    writeWeeklySummary(weeklyDir, totals);
    writeWeeklyReflection(weeklyDir, totals, config.performanceTemplatePath);
    console.log(`  ${start}..${end}: ${totals.sessionCount} sessions, ${formatDuration(totals.durationMs)}`);
  }

  console.log("\n[3/3] PARA structure");
  organizePara(config.vaultPath, [...byDay.values()].flat());
}

function printDailyTable(byDay: Map<string, Session[]>, days: string[]): void {
  for (const day of days) {
    const sessions = byDay.get(day);
    if (!sessions?.length) continue;
    const { simpleSum, merged, percent } = timeSaved(sessions);
    console.log(
      `  ${day}  ${String(sessions.length).padStart(3)} sessions   ` +
        `simple ${formatDuration(simpleSum).padStart(8)}   merged ${formatDuration(merged).padStart(8)}   −${percent.toFixed(0)}%`,
    );
  }
}

function printSummary(sessions: Session[]): void {
  const { simpleSum, merged, saved, percent } = timeSaved(sessions);
  const bySource = [...groupBy(sessions, (s) => s.source).entries()]
    .map(([source, group]) => `${source} ${group.length} (${formatDuration(mergedDuration(group))})`)
    .join(" · ");

  console.log("\n" + "=".repeat(60));
  console.log(`Sessions: ${sessions.length}  [${bySource}]`);
  console.log(`Simple sum:   ${formatDuration(simpleSum)}`);
  console.log(`Merged time:  ${formatDuration(merged)}`);
  console.log(`Saved (parallel work): ${formatDuration(saved)} (${percent.toFixed(1)}%)`);
  console.log("=".repeat(60));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const config = buildConfig(args);

  console.log("=".repeat(60));
  console.log("Session Miner");
  console.log(`Sources: ${config.sources.join(", ")}`);
  console.log(`Range:   ${localDay(config.rangeStart)} .. ${localDay(config.rangeEnd)}`);
  if (args.mode === "mine") console.log(`Vault:   ${config.vaultPath || "(none)"}`);
  console.log("=".repeat(60));

  if (args.mode === "mine" && !config.vaultPath) {
    console.error("❌ OBSIDIAN_VAULT_PATH is required to write notes. Use --calculate or --analyze to inspect without writing.");
    process.exit(1);
  }

  const sessions = loadAllSessions(config);
  const byDay = groupBy(sessions, (s) => localDay(s.start));

  if (args.mode !== "mine") {
    printDailyTable(byDay, daysInRange(config.rangeStart, config.rangeEnd));
  } else {
    mine(config, byDay);
  }
  printSummary(sessions);
}

main();
