/**
 * Project-name derivation, shared by every source.
 *
 * Both OpenCode and Claude Code identify work by a filesystem path. We collapse
 * worktrees and sub-directories to the repository name so the same project
 * aggregates regardless of which tool or worktree it was touched from:
 *
 *   ~/dev/CoinBurn/.worktrees/dreamy-dhawan-160470 -> CoinBurn
 *   ~/dev/CoinBurn/main                            -> CoinBurn
 *   ~/kai/grimoire                                 -> grimoire
 */
export function repoNameFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const devIndex = segments.indexOf("dev");
  if (devIndex >= 0 && segments[devIndex + 1]) {
    return segments[devIndex + 1];
  }
  return segments[segments.length - 1];
}
