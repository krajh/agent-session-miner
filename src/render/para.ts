/**
 * PARA organization: Projects, Areas, Resources, Archives.
 *
 * Project notes are derived from real session data (one note per repo, with a
 * source breakdown and a backlinks query). Area/Resource/Archive indexes are
 * lightweight scaffolding you curate by hand.
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { Session, SourceName } from "../types";
import { formatDuration, mergedDuration } from "../intervals";
import { localDay } from "../dates";
import { groupBy } from "../group";

const SOURCE_TAG: Record<SourceName, string> = { claude: "claude", opencode: "opencode" };

export function organizePara(vaultPath: string, sessions: Session[]): void {
  for (const dir of ["Projects", "Areas", join("Resources", "References"), "Archives"]) {
    mkdirSync(join(vaultPath, dir), { recursive: true });
  }

  const byProject = groupBy(sessions, (s) => s.project);
  writeProjectsIndex(vaultPath, byProject);
  for (const [project, projectSessions] of byProject) {
    writeProjectNote(vaultPath, project, projectSessions);
  }

  writeIndex(join(vaultPath, "Areas", "index.md"), "Areas", "Ongoing responsibilities and domains.");
  writeIndex(join(vaultPath, "Resources", "index.md"), "Resources", "Reference material and templates.");
  writeIndex(join(vaultPath, "Archives", "index.md"), "Archives", "Completed or inactive items.");
}

function writeProjectsIndex(vaultPath: string, byProject: Map<string, Session[]>): void {
  const ranked = [...byProject.entries()].sort(
    ([, a], [, b]) => mergedDuration(b) - mergedDuration(a),
  );

  const lines = ["# Projects", ""];
  for (const [project, sessions] of ranked) {
    lines.push(`- [[${project}]] — ${sessions.length} sessions, ${formatDuration(mergedDuration(sessions))}`);
  }
  writeFileSync(join(vaultPath, "Projects", "index.md"), `${lines.join("\n")}\n`, "utf-8");
}

function writeProjectNote(vaultPath: string, project: string, sessions: Session[]): void {
  const bySource = [...groupBy(sessions, (s) => s.source).entries()]
    .map(([source, group]) => `${SOURCE_TAG[source]} ${formatDuration(mergedDuration(group))}`)
    .join(" · ");

  const lines = [
    `# ${project}`,
    ``,
    `- **Total Sessions**: ${sessions.length}`,
    `- **Total Time**: ${formatDuration(mergedDuration(sessions))}`,
    `- **By Source**: ${bySource}`,
    ``,
    `## Sessions`,
    ``,
  ];

  for (const session of [...sessions].sort((a, b) => b.start - a.start)) {
    const minutes = ((session.end - session.start) / 60_000).toFixed(1);
    lines.push(`- ${localDay(session.start)} — **${session.title}** (${minutes}m · ${SOURCE_TAG[session.source]})`);
  }

  lines.push(``, `## Related Daily Notes`, ``, "```dataview", `LIST`, `FROM "Daily Notes"`, `WHERE contains(file.outlinks, this.file.link)`, `SORT file.name DESC`, "```", "");
  writeFileSync(join(vaultPath, "Projects", `${safeName(project)}.md`), lines.join("\n"), "utf-8");
}

function writeIndex(path: string, title: string, description: string): void {
  if (existsSync(path)) return; // curated by hand — don't clobber
  writeFileSync(path, `# ${title}\n\n${description}\n`, "utf-8");
}

function safeName(project: string): string {
  return project.replace(/[\/\\:*?"<>|]/g, "-");
}
