import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type LearningOutcome = {
  kind: "sent" | "killed" | "human_label" | "vault_note";
  note?: string;
};

export function proposalPath(packId: string, date: string, root = process.cwd()): string {
  return join(root, "packs", packId, "proposals", `${date}.md`);
}

export function renderProposal(date: string, packId: string, outcomes: LearningOutcome[]): string {
  const lines = [
    `# Proposal ${date}`,
    "",
    `Pack: ${packId}`,
    "",
    "Fail-closed. Copy into directives.md yourself. This job never auto-merges.",
    "",
  ];
  if (outcomes.length === 0) {
    lines.push("No outcomes today.");
  } else {
    for (const row of outcomes) {
      lines.push(`- ${row.kind}: ${row.note ?? ""}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function writeProposal(input: {
  packId: string;
  date: string;
  outcomes: LearningOutcome[];
  root?: string;
}): { path: string; wroteDirectives: false } {
  const file = proposalPath(input.packId, input.date, input.root);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderProposal(input.date, input.packId, input.outcomes), "utf8");
  return { path: file, wroteDirectives: false };
}

export function directivesUntouched(root: string, packId: string, before: string | undefined): boolean {
  const file = join(root, "packs", packId, "directives.md");
  if (!existsSync(file)) {
    return true;
  }
  return readFileSync(file, "utf8") === (before ?? readFileSync(file, "utf8"));
}
