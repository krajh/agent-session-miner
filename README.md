# Agent Session Miner

Turn your AI coding sessions into an Obsidian journal. Mines **Claude Code** and
**OpenCode** sessions, calculates how much time you *actually* spent (accounting
for parallel agents and idle gaps), and writes daily notes, weekly summaries, and
per-project pages into your vault.

> Repo history note: this started as an OpenCode-only tool. It was rewritten to be
> multi-source with Claude Code as the primary source — see `package.json` name
> `agent-session-miner`.

## What you get

```
your-vault/
  Daily Notes/2026-06-30.md        # metrics + what you worked on (your own notes preserved)
  Weekly Summaries/                # weekly rollups + performance-reflection notes
  Projects/                        # per-repo pages with time + source breakdown
  Areas/  Resources/  Archives/    # PARA scaffolding you curate by hand
```

Each session is tagged by source (`claude` / `opencode`) and grouped by project.

## How time is calculated

The headline metric is **honest elapsed time**, not a naive sum:

- **Parallel work** — three agents running for an hour in parallel is 1 hour of
  wall-clock, not 3. Overlapping intervals are merged.
- **Idle gaps** — a session open for 4 days isn't 96 hours of work. Every source
  reduces to per-event timestamps, which are segmented into activity bursts (a gap
  over 30 minutes ends a burst) and attributed to the local day they happened.

Both sources flow through the same model (`src/activity.ts` → `src/intervals.ts`),
so adding a new harness is one file in `src/sources/`.

## Quick start

```bash
bun install
cp .env.example .env      # then edit paths
bun run mine
```

### Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `OBSIDIAN_VAULT_PATH` | _(required)_ | where notes are written |
| `CLAUDE_PROJECTS_DIR` | `~/.claude/projects` | Claude Code transcripts |
| `OPENCODE_DB_PATH` | `~/.local/share/opencode/opencode.db` | OpenCode database |
| `SOURCES` | `claude,opencode` | which sources to mine |
| `DAYS` | `30` | look-back window |

## Commands

```bash
bun run mine                       # write notes for the last 30 days
bun run mine --days=7              # last 7 days
bun run mine --start=2026-06-01 --end=2026-06-30
bun run mine --sources=claude     # one source only
bun run calculate                 # print per-day / total time, write nothing
bun run analyze                   # same table, framed as parallel-work savings
bun test                          # run the test suite
```

## Automation

On **macOS**, schedule a weekly refresh as a Claude Code routine (it runs locally,
where your files live):

> Ask Claude: *"set up a weekly routine to run the session miner"* — or manage it
> from the **Scheduled** section of the Claude desktop app.

The `scripts/setup-cron.sh` helper is legacy Linux/WSL cron and is not used on macOS.

## Architecture

```
src/
  types.ts          Session (one model), MinerConfig
  intervals.ts      merge / total / format — the one interval algorithm
  activity.ts       timestamps -> per-day active windows (the shared segmenter)
  dates.ts          local-timezone day & week helpers
  projects.ts       path -> repo name (collapses worktrees)
  group.ts          groupBy helper
  sources/
    claude-code.ts  ~/.claude/projects/**/*.jsonl  -> Session[]
    opencode.ts     OpenCode SQLite message timestamps -> Session[]
    index.ts        source registry (claude first)
  render/
    daily.ts  weekly.ts  para.ts     Session[] -> markdown
  mine.ts           the one entry point
```

## License

MIT
