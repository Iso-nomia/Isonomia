/**
 * Q-019 formatter — renders the latest q019-inherit-cqs-false-*.json
 * (or a date-pinned file) into a human-readable markdown sibling.
 *
 * Spec: ../Development and Ideation Documents/ARCHITECTURE/SCHEMES_IMPL_AUDIT_PROTOCOLS.md §3 (Q-019)
 * Output: audits/q019-inherit-cqs-false-<YYYYMMDD>.md
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Intent =
  | "sibling-misuse"
  | "workaround"
  | "genuine-child-different-cqs"
  | "unknown";

type InheritFalseRow = {
  id: string;
  key: string;
  name: string | null;
  parentSchemeId: string | null;
  parentKey: string | null;
  clusterTag: string | null;
  parentClusterTag: string | null;
  ownCqCount: number;
  parentCqCount: number;
  cqKeyOverlap: string[];
  cqKeysSuppressed: string[];
  cqKeysAdded: string[];
  usageCount: number;
  intent: Intent;
  classifierNotes: string;
};

type Q019Output = {
  generatedAtIso: string;
  totalCount: number;
  totalCatalogueSize: number;
  fraction: number;
  rows: InheritFalseRow[];
  byIntent: Record<Intent, number>;
};

function pickInputPath(): string {
  const dir = join(process.cwd(), "audits");
  const arg = process.argv[2];
  if (arg) return arg.startsWith("/") ? arg : join(dir, arg);
  const files = readdirSync(dir)
    .filter((f) => /^q019-inherit-cqs-false-\d{8}\.json$/.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error(
      "No q019-inherit-cqs-false-*.json under audits/. Run `yarn audit:q019` first.",
    );
  }
  return join(dir, files[files.length - 1]);
}

function recomputeByIntent(rows: InheritFalseRow[]): Record<Intent, number> {
  const acc: Record<Intent, number> = {
    "sibling-misuse": 0,
    workaround: 0,
    "genuine-child-different-cqs": 0,
    unknown: 0,
  };
  for (const r of rows) acc[r.intent] = (acc[r.intent] ?? 0) + 1;
  return acc;
}

function renderRow(r: InheritFalseRow): string {
  const fmtKeys = (ks: string[]) =>
    ks.length === 0 ? "_none_" : ks.map((k) => `\`${k}\``).join(", ");
  return [
    `### \`${r.key}\` — ${r.name ?? "_(no name)_"}`,
    "",
    `- **id:** \`${r.id}\``,
    `- **parent:** ${r.parentKey ? `\`${r.parentKey}\` (\`${r.parentSchemeId}\`)` : "_(none)_"}`,
    `- **cluster:** ${r.clusterTag ?? "_(none)_"}${r.parentClusterTag ? ` (parent: ${r.parentClusterTag})` : ""}`,
    `- **CQ counts:** own=${r.ownCqCount}, parent=${r.parentCqCount}`,
    `- **CQ overlap:** ${fmtKeys(r.cqKeyOverlap)}`,
    `- **CQ suppressed (parent → not in child):** ${fmtKeys(r.cqKeysSuppressed)}`,
    `- **CQ added (child → not in parent):** ${fmtKeys(r.cqKeysAdded)}`,
    `- **usageCount:** ${r.usageCount}`,
    `- **intent:** \`${r.intent}\``,
    `- **classifier notes:** ${r.classifierNotes || "_(none)_"}`,
    "",
  ].join("\n");
}

function main(): void {
  const inPath = pickInputPath();
  const raw = readFileSync(inPath, "utf8");
  const data = JSON.parse(raw) as Q019Output;

  // recompute byIntent in case the analyst edited rows but not the summary
  const byIntent = recomputeByIntent(data.rows);

  const outPath = inPath.replace(/\.json$/, ".md");

  const lines: string[] = [];
  lines.push(`# Q-019 — \`inheritCQs: false\` audit`);
  lines.push("");
  lines.push(`- **generated at:** ${data.generatedAtIso}`);
  lines.push(`- **source:** \`${inPath.split("/").slice(-2).join("/")}\``);
  lines.push(
    `- **total rows with \`inheritCQs: false\`:** ${data.totalCount} / ${data.totalCatalogueSize} (${(data.fraction * 100).toFixed(2)}%)`,
  );
  lines.push("");
  lines.push("## Intent breakdown");
  lines.push("");
  lines.push("| Intent | Count |");
  lines.push("|---|---|");
  for (const k of [
    "sibling-misuse",
    "workaround",
    "genuine-child-different-cqs",
    "unknown",
  ] as Intent[]) {
    lines.push(`| \`${k}\` | ${byIntent[k]} |`);
  }
  lines.push("");

  const siblingNav = byIntent["sibling-misuse"];
  lines.push("## Decision implications");
  lines.push("");
  lines.push(
    `**Spec 2 phase 2c shape choice:** ${
      data.totalCount === 0
        ? "no `inheritCQs: false` rows in production — **Shape A (retirement) is trivially safe**; phase 2c-A can ship without migration concerns."
        : siblingNav === 0 && byIntent.unknown === 0
          ? "all rows are classified and none are `sibling-misuse` — **Shape A (retirement) is viable** if `workaround` and `genuine-child-different-cqs` rows can be hand-migrated; spec author should review."
          : siblingNav > 0
            ? `**${siblingNav} sibling-navigational rows exist** — **Shape B (\`siblingOf\` reclassification) is required**. Phase 2c-B becomes a prerequisite for the WF3 severity flip in phase 2b per the IMPLEMENTATION_TRACKS phase-ordering constraint.`
            : `**${byIntent.unknown} unclassified rows remain** — re-run the formatter after classification is complete to get a definitive recommendation.`
    }`,
  );
  lines.push("");
  lines.push(
    `**WF3 severity flip (Spec 2 phase 2b):** ${
      siblingNav === 0 && byIntent.unknown === 0
        ? "**safe to flip WF3 to error** on the original phase-2b schedule (no sibling-navigational rows in production)."
        : "**hold WF3 at warn-only** until classification completes and (if any sibling-navigational rows exist) Shape B ships."
    }`,
  );
  lines.push("");

  lines.push("## Rows");
  lines.push("");
  if (data.rows.length === 0) {
    lines.push("_No rows. The `inheritCQs: false` value is unused in production._");
    lines.push("");
  } else {
    for (const r of data.rows) lines.push(renderRow(r));
  }

  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`[q019:format] wrote ${outPath}`);
}

main();
