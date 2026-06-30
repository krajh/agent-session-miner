/**
 * Source registry. Claude Code is the primary source and leads the registry;
 * OpenCode follows. Adding a harness (pi, hermes, ...) is one entry here plus
 * one loader file — nothing downstream changes, because every loader returns
 * the same `Session[]` contract.
 */

import type { MinerConfig, Session, SourceName } from "../types";
import { loadClaudeSessions } from "./claude-code";
import { loadOpencodeSessions } from "./opencode";

const LOADERS: Record<SourceName, (config: MinerConfig) => Session[]> = {
  claude: loadClaudeSessions,
  opencode: loadOpencodeSessions,
};

export function loadAllSessions(config: MinerConfig): Session[] {
  return config.sources.flatMap((source) => LOADERS[source](config));
}
