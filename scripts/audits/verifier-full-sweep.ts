/**
 * Spec 4 phase 4a — extended verifier sweep across the full argument-scheme
 * catalogue (Phase 2 step 8b, extension of step 8).
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md
 *
 * Procedure:
 *   1. Load every `kind='argument-scheme'` row + its CQs.
 *   2. Compute the behaviour fingerprint of each; group fingerprint collisions
 *      (cheap upper bound on `equal` candidates).
 *   3. Run `verifyBehaviourEquality` over every within-family pair (same
 *      `clusterTag`) — the corpus where duplicates are operationally most
 *      likely.
 *   4. Additionally run the verifier over any cross-family fingerprint
 *      collision pair (must be tiny; cheap to handle).
 *   5. Write audits/verifier-full-sweep-<YYYYMMDD>.{json,md} with the verdict
 *      matrix and step-9 implications.
 */

import { prisma } from "@/lib/prismaclient";
import {
  verifyBehaviourEquality,
  computeBehaviourFingerprint,
  type SchemeWithCqs,
  type VerifierVerdict,
} from "@/lib/schemes/verifier";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

type PairResult = {
  leftKey: string;
  rightKey: string;
  clusterTag: string | "cross-family";
  leftCqs: number;
  rightCqs: number;
  leftFingerprint: string;
  rightFingerprint: string;
  fingerprintsAgree: boolean;
  verdict: VerifierVerdict;
};

function todayStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function loadAll(): Promise<SchemeWithCqs[]> {
  const rows = await prisma.argumentScheme.findMany({
    where: { kind: "argument-scheme" as any } as any,
    include: { cqs: true },
    orderBy: { key: "asc" },
  });
  return rows as unknown as SchemeWithCqs[];
}

function groupByClusterTag(schemes: SchemeWithCqs[]): Map<string, SchemeWithCqs[]> {
  const m = new Map<string, SchemeWithCqs[]>();
  for (const s of schemes) {
    const tag = (s as any).clusterTag ?? "<no-cluster>";
    if (!m.has(tag)) m.set(tag, []);
    m.get(tag)!.push(s);
  }
  return m;
}

function groupByFingerprint(
  schemes: SchemeWithCqs[],
  fps: Map<string, string>,
): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const s of schemes) {
    const fp = fps.get(s.key)!;
    if (!m.has(fp)) m.set(fp, []);
    m.get(fp)!.push(s.key);
  }
  return m;
}

function describeVerdict(v: VerifierVerdict): string {
  if (v.kind === "equal") return "equal";
  if (v.kind === "subset") return `subset:${v.certificate.direction}`;
  if (v.kind === "incomparable") return "incomparable";
  return `inconclusive:${v.reason}`;
}

function renderMd(opts: {
  schemes: SchemeWithCqs[];
  fingerprints: Map<string, string>;
  families: Map<string, SchemeWithCqs[]>;
  results: PairResult[];
  fpCollisions: Array<{ fingerprint: string; keys: string[] }>;
}): string {
  const { schemes, fingerprints, families, results, fpCollisions } = opts;
  const equals = results.filter((r) => r.verdict.kind === "equal");
  const subsets = results.filter((r) => r.verdict.kind === "subset");
  const incomparables = results.filter((r) => r.verdict.kind === "incomparable");
  const inconclusives = results.filter((r) => r.verdict.kind === "inconclusive");

  const lines: string[] = [];
  lines.push("# Full-catalogue verifier sweep — argument-scheme rows");
  lines.push("");
  lines.push(`- **generated at:** ${new Date().toISOString()}`);
  lines.push(`- **plan step:** Phase 2 step 8 (extended sweep)`);
  lines.push(`- **schemes considered:** ${schemes.length} (kind='argument-scheme')`);
  lines.push(`- **families:** ${families.size}`);
  lines.push(`- **pairs verified:** ${results.length}`);
  lines.push(
    `- **verdict totals:** equal=${equals.length}, subset=${subsets.length}, incomparable=${incomparables.length}, inconclusive=${inconclusives.length}`,
  );
  lines.push("");

  lines.push("## Families");
  lines.push("");
  lines.push("| clusterTag | members |");
  lines.push("|---|---|");
  for (const [tag, members] of [...families.entries()].sort()) {
    lines.push(
      `| \`${tag}\` | ${members.length === 0 ? "—" : members.map((m) => `\`${m.key}\``).join(", ")} |`,
    );
  }
  lines.push("");

  lines.push("## Fingerprint collisions (upper bound on `equal` candidates)");
  lines.push("");
  if (fpCollisions.length === 0) {
    lines.push("None — every scheme has a unique behaviour fingerprint.");
  } else {
    lines.push("| fingerprint | keys |");
    lines.push("|---|---|");
    for (const c of fpCollisions) {
      lines.push(`| \`${c.fingerprint.slice(0, 16)}…\` | ${c.keys.map((k) => `\`${k}\``).join(", ")} |`);
    }
  }
  lines.push("");

  lines.push("## Equal verdicts");
  lines.push("");
  if (equals.length === 0) {
    lines.push("None.");
  } else {
    lines.push("| left | right | family | cq mapping |");
    lines.push("|---|---|---|---|");
    for (const r of equals) {
      const cm =
        r.verdict.kind === "equal"
          ? r.verdict.certificate.cqMapping
              .map((m) => `\`${m.leftCqKey}\`↔\`${m.rightCqKey}\``)
              .join(", ")
          : "";
      lines.push(`| \`${r.leftKey}\` | \`${r.rightKey}\` | \`${r.clusterTag}\` | ${cm} |`);
    }
  }
  lines.push("");

  lines.push("## Subset verdicts");
  lines.push("");
  if (subsets.length === 0) {
    lines.push("None.");
  } else {
    lines.push("| left | right | family | direction | extra CQs (subset side on ⟦·⟧) |");
    lines.push("|---|---|---|---|---|");
    for (const r of subsets) {
      if (r.verdict.kind !== "subset") continue;
      lines.push(
        `| \`${r.leftKey}\` | \`${r.rightKey}\` | \`${r.clusterTag}\` | ${r.verdict.certificate.direction} | ${r.verdict.certificate.extraCqs.map((k) => `\`${k}\``).join(", ")} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Inconclusive verdicts");
  lines.push("");
  if (inconclusives.length === 0) {
    lines.push("None.");
  } else {
    lines.push("| left | right | family | reason |");
    lines.push("|---|---|---|---|");
    for (const r of inconclusives) {
      if (r.verdict.kind !== "inconclusive") continue;
      lines.push(`| \`${r.leftKey}\` | \`${r.rightKey}\` | \`${r.clusterTag}\` | ${r.verdict.reason} |`);
    }
  }
  lines.push("");

  lines.push("## Per-family verdict counts");
  lines.push("");
  lines.push("| family | pairs | equal | subset | incomparable | inconclusive |");
  lines.push("|---|---|---|---|---|---|");
  const perFamily = new Map<string, { pairs: number; eq: number; sub: number; inc: number; und: number }>();
  for (const r of results) {
    const k = r.clusterTag;
    const cur = perFamily.get(k) ?? { pairs: 0, eq: 0, sub: 0, inc: 0, und: 0 };
    cur.pairs += 1;
    if (r.verdict.kind === "equal") cur.eq += 1;
    else if (r.verdict.kind === "subset") cur.sub += 1;
    else if (r.verdict.kind === "incomparable") cur.inc += 1;
    else cur.und += 1;
    perFamily.set(k, cur);
  }
  for (const [k, v] of [...perFamily.entries()].sort()) {
    lines.push(`| \`${k}\` | ${v.pairs} | ${v.eq} | ${v.sub} | ${v.inc} | ${v.und} |`);
  }
  lines.push("");

  lines.push("## Implications for step 9 (catalogue de-duplication)");
  lines.push("");
  if (equals.length === 0) {
    lines.push(
      "**No `equal` verdicts across the full catalogue.** Step 9's retire-or-merge migration has nothing to repoint; the de-duplication phase reduces to a no-op recorded in the migration log.",
    );
  } else {
    lines.push(
      `**${equals.length} equal pair(s) found.** Step 9 must retire the duplicate side of each (or relink as a \`SchemeVariant\`) and repoint downstream argument/instance rows. Pairs:`,
    );
    for (const e of equals) {
      lines.push(`- \`${e.leftKey}\` × \`${e.rightKey}\` (family \`${e.clusterTag}\`)`);
    }
  }
  if (subsets.length > 0) {
    lines.push("");
    lines.push(
      `**${subsets.length} subset pair(s) found** — not duplicates but one strictly refines the other; surface in step 10's non-redundancy panel as a justification axis ("retained because the broader CQ list captures attacks the subset cannot").`,
    );
  }
  lines.push("");

  lines.push("## Appendix: fingerprints");
  lines.push("");
  lines.push("| key | family | cqs | fingerprint |");
  lines.push("|---|---|---|---|");
  for (const s of schemes) {
    const fp = fingerprints.get(s.key)!;
    lines.push(
      `| \`${s.key}\` | \`${(s as any).clusterTag ?? "<no-cluster>"}\` | ${s.cqs.length} | \`${fp}\` |`,
    );
  }
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  console.log("=== Full-catalogue verifier sweep ===");
  const schemes = await loadAll();
  console.log(`loaded ${schemes.length} argument-scheme rows`);

  const fingerprints = new Map<string, string>();
  for (const s of schemes) fingerprints.set(s.key, computeBehaviourFingerprint(s as any));

  const families = groupByClusterTag(schemes);
  console.log(`families: ${families.size}`);
  for (const [tag, members] of [...families.entries()].sort()) {
    console.log(`  ${tag}: ${members.length}`);
  }

  const fpGroups = groupByFingerprint(schemes, fingerprints);
  const fpCollisions = [...fpGroups.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([fingerprint, keys]) => ({ fingerprint, keys }));
  console.log(`fingerprint collisions: ${fpCollisions.length}`);

  // Build verification pair set: within-family ∪ cross-family fp-collision.
  const seen = new Set<string>();
  const pairsToCheck: Array<{ left: SchemeWithCqs; right: SchemeWithCqs; clusterTag: string | "cross-family" }> = [];

  for (const [tag, members] of families) {
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const a = members[i];
        const b = members[j];
        const sig = `${a.key}|${b.key}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        pairsToCheck.push({ left: a, right: b, clusterTag: tag });
      }
    }
  }

  // Cross-family fingerprint collisions (rare; cheap to add).
  for (const { keys } of fpCollisions) {
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        const a = schemes.find((s) => s.key === keys[i])!;
        const b = schemes.find((s) => s.key === keys[j])!;
        if ((a as any).clusterTag === (b as any).clusterTag) continue; // already in within-family set
        const sig = `${a.key}|${b.key}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        pairsToCheck.push({ left: a, right: b, clusterTag: "cross-family" });
      }
    }
  }

  console.log(`pairs to verify: ${pairsToCheck.length}`);
  const results: PairResult[] = [];
  for (const { left, right, clusterTag } of pairsToCheck) {
    const verdict = await verifyBehaviourEquality(left, right);
    const r: PairResult = {
      leftKey: left.key,
      rightKey: right.key,
      clusterTag,
      leftCqs: left.cqs.length,
      rightCqs: right.cqs.length,
      leftFingerprint: fingerprints.get(left.key)!,
      rightFingerprint: fingerprints.get(right.key)!,
      fingerprintsAgree: fingerprints.get(left.key) === fingerprints.get(right.key),
      verdict,
    };
    results.push(r);
    if (verdict.kind !== "incomparable") {
      console.log(`  ${left.key} × ${right.key}  [${clusterTag}]  → ${describeVerdict(verdict)}`);
    }
  }
  const eq = results.filter((r) => r.verdict.kind === "equal").length;
  const sub = results.filter((r) => r.verdict.kind === "subset").length;
  const inc = results.filter((r) => r.verdict.kind === "incomparable").length;
  const und = results.filter((r) => r.verdict.kind === "inconclusive").length;
  console.log(`totals: equal=${eq} subset=${sub} incomparable=${inc} inconclusive=${und}`);

  const stamp = todayStamp();
  const jsonPath = join(process.cwd(), "audits", `verifier-full-sweep-${stamp}.json`);
  const mdPath = join(process.cwd(), "audits", `verifier-full-sweep-${stamp}.md`);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAtIso: new Date().toISOString(),
        planStep: "Phase 2 step 8 (extended sweep)",
        schemes: schemes.map((s) => ({
          key: s.key,
          clusterTag: (s as any).clusterTag ?? null,
          cqCount: s.cqs.length,
          fingerprint: fingerprints.get(s.key),
        })),
        families: [...families.entries()].map(([tag, members]) => ({
          clusterTag: tag,
          keys: members.map((m) => m.key),
        })),
        fingerprintCollisions: fpCollisions,
        pairs: results,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  writeFileSync(mdPath, renderMd({ schemes, fingerprints, families, results, fpCollisions }), "utf8");
  console.log(`[wrote] ${jsonPath}`);
  console.log(`[wrote] ${mdPath}`);

  await prisma.$disconnect();
  console.log("=== done ===");
}

main().catch(async (e) => {
  console.error("[full-sweep] failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
