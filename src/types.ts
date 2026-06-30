/**
 * Shared domain model.
 *
 * Every source (OpenCode, Claude Code, future harnesses) loads into the SAME
 * `Session` shape, so the analysis and rendering layers never learn where a
 * session came from. All timestamps are epoch milliseconds.
 */

export type SourceName = "claude" | "opencode";

export interface TimeInterval {
  start: number; // epoch ms
  end: number; // epoch ms
}

/** One unit of work, normalized across every source. */
export interface Session {
  id: string;
  source: SourceName;
  project: string; // display name, e.g. "CoinBurn"
  title: string;
  start: number; // epoch ms
  end: number; // epoch ms
}

export interface MinerConfig {
  vaultPath: string;
  opencodeDbPath: string;
  claudeProjectsDir: string;
  sources: SourceName[];
  rangeStart: number; // epoch ms, inclusive
  rangeEnd: number; // epoch ms, inclusive
  performanceTemplatePath: string;
}
