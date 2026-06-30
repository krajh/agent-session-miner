/**
 * OpenCode source: read sessions from the OpenCode SQLite database.
 *
 * A session's create/update window can span days (resumed sessions), so instead
 * of trusting that span we derive activity from per-message timestamps and run
 * them through the shared segmenter — the same treatment Claude transcripts get.
 */

import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import type { MinerConfig, Session } from "../types";
import { repoNameFromPath } from "../projects";
import { sessionsFromActivity, type SessionMeta } from "../activity";
import { groupBy } from "../group";

interface MetaRow {
  id: string;
  title: string | null;
  worktree: string | null;
  project_name: string | null;
}

export function loadOpencodeSessions(config: MinerConfig): Session[] {
  if (!existsSync(config.opencodeDbPath)) {
    console.warn(`  [skip] OpenCode DB not found: ${config.opencodeDbPath}`);
    return [];
  }

  const db = new Database(config.opencodeDbPath, { readonly: true });
  try {
    const messages = db
      .query(`SELECT session_id, time_created FROM message WHERE time_created BETWEEN ? AND ?`)
      .all(config.rangeStart, config.rangeEnd) as Array<{ session_id: string; time_created: number }>;

    const timestampsBySession = groupBy(messages, (m) => m.session_id);
    if (timestampsBySession.size === 0) return [];

    const metaById = loadMeta(db, [...timestampsBySession.keys()]);

    return [...timestampsBySession.entries()].flatMap(([sessionId, msgs]) => {
      const row = metaById.get(sessionId);
      if (!row) return [];
      const meta: SessionMeta = {
        id: sessionId,
        source: "opencode",
        project: repoNameFromPath(row.worktree) ?? row.project_name ?? "unknown",
        title: row.title || "Untitled session",
      };
      return sessionsFromActivity(meta, msgs.map((m) => m.time_created), config.rangeStart, config.rangeEnd);
    });
  } finally {
    db.close();
  }
}

function loadMeta(db: Database, sessionIds: string[]): Map<string, MetaRow> {
  const placeholders = sessionIds.map(() => "?").join(",");
  const rows = db
    .query(
      `SELECT s.id, s.title, p.worktree, p.name AS project_name
       FROM session s
       LEFT JOIN project p ON s.project_id = p.id
       WHERE s.id IN (${placeholders})`,
    )
    .all(...sessionIds) as MetaRow[];
  return new Map(rows.map((row) => [row.id, row]));
}
