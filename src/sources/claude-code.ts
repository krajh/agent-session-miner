/**
 * Claude Code source: read sessions from `~/.claude/projects/<dir>/<id>.jsonl`.
 *
 * Each transcript is one event-stream. We collect its event timestamps, project,
 * and a title, then hand the timestamps to the shared activity segmenter (see
 * activity.ts) which splits idle gaps and attributes active time per local day.
 */

import { readdirSync, readFileSync } from "fs";
import { basename, join } from "path";
import type { MinerConfig, Session } from "../types";
import { repoNameFromPath } from "../projects";
import { sessionsFromActivity, type SessionMeta } from "../activity";

const TITLE_MAX = 80;

export function loadClaudeSessions(config: MinerConfig): Session[] {
  let projectDirs;
  try {
    projectDirs = readdirSync(config.claudeProjectsDir, { withFileTypes: true });
  } catch {
    console.warn(`  [skip] Claude projects dir not found: ${config.claudeProjectsDir}`);
    return [];
  }

  const sessions: Session[] = [];
  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) continue;
    const dirPath = join(config.claudeProjectsDir, projectDir.name);

    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;

      const transcript = parseTranscript(join(dirPath, entry.name), projectDir.name);
      if (!transcript) continue;

      const meta: SessionMeta = {
        id: transcript.id,
        source: "claude",
        project: transcript.project,
        title: transcript.title,
      };
      sessions.push(
        ...sessionsFromActivity(meta, transcript.timestamps, config.rangeStart, config.rangeEnd),
      );
    }
  }

  return sessions;
}

interface Transcript {
  id: string;
  project: string;
  title: string;
  timestamps: number[];
}

function parseTranscript(filePath: string, projectDirName: string): Transcript | null {
  let events: any[];
  try {
    events = readFileSync(filePath, "utf-8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch {
    return null;
  }

  const timestamps = events
    .map((e) => (e?.timestamp ? Date.parse(e.timestamp) : NaN))
    .filter((ms) => Number.isFinite(ms));
  if (timestamps.length === 0) return null;

  const cwd = events.find((e) => typeof e?.cwd === "string")?.cwd ?? null;
  const project =
    repoNameFromPath(cwd) ?? repoNameFromPath(projectDirName.replace(/-/g, "/")) ?? "unknown";

  return {
    id: basename(filePath, ".jsonl"),
    project,
    title: titleFromUserTexts(userTexts(events)),
    timestamps,
  };
}

/** First user message becomes the title — preferring the slash command if one drove the session. */
export function titleFromUserTexts(texts: string[]): string {
  for (const text of texts) {
    const command = text.match(/<command-name>\s*([^<]+?)\s*<\/command-name>/);
    if (command) return `/${command[1].trim().replace(/^\/+/, "")}`;

    const line = firstMeaningfulLine(text);
    if (line) return truncate(line, TITLE_MAX);
  }
  return "Untitled Claude session";
}

function userTexts(events: any[]): string[] {
  const texts: string[] = [];
  for (const event of events) {
    if (event?.type !== "user") continue;
    const content = event?.message?.content;
    if (typeof content === "string") {
      texts.push(content);
    } else if (Array.isArray(content)) {
      const text = content
        .filter((block) => block?.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      if (text) texts.push(text);
    }
  }
  return texts;
}

const NOISE_PREFIXES = ["base directory for this skill:", "caveat:"];

function firstMeaningfulLine(text: string): string | null {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("<")) continue;
    if (NOISE_PREFIXES.some((prefix) => line.toLowerCase().startsWith(prefix))) continue;
    return line;
  }
  return null;
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}
