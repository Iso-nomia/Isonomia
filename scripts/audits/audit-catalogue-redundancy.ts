/**
 * Spec 4 §5 Phase 4d — one-shot catalogue-redundancy audit.
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/SCHEMES_IMPL_VERIFIER.md
 *       Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md (step 18)
 *
 * Procedure:
 *   1. Load every `kind='argument-scheme'` row + its CQs.
 *   2. Compute the behaviour fingerprint of each.
 *   3. Run `verifyBehaviourEquality` over EVERY pair (cross-family included;
 *      O(N²) but bounded — at N=25 that is 300 calls, each ≪ 100ms).
 *   4. Emit:
 *      - audits/catalogue-redundancy-<YYYYMMDD>.json    (full verdict matrix)
 *      - audits/catalogue-redundancy-<YYYYMMDD>.md      (human summary)
 *      The MD lists every `equal` and `subset` pair so the schemes-track
 *      maintainer can file follow-on Q-NNN issues per pair.
 *
 * Acceptance (Spec 4 §6 Phase 4d):
 *   - script lands; output committed.
 *   - follow-on Q-NNN / impl issue per identified pair (filed externally).
 *   - markdown summary committed with the same shape as the Spec 5 audits.
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
  leftClusterTag: string | null;
  rightClusterTag: string | null;
  sameFamily: boolean;
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

function describeVerdict(v: VerifierVerdict): string {
  if (v.kind === "equal") return "equal";
  if (v.kind === "subset") return `subset:${v.certificate.direction}`;
  if (v.kind === "incomparable") return "incomparable";
  return `inconclusive:${v.reason}`;
}

async function loadAll(): Promise<SchemeWithCqs[]> {
  const rows = await prisma.argumentScheme.findMany({
    where: { kind: "argument-scheme" as any } as any,
    include: { cqs: true },
    orderBy: { key: "asc" },
  });
  return rows as unknown as SchemeWithCqs[];
}

function renderMd(opts: {
  schemes: SchemeWithCqs[];
  fingerprints: Map<string, string>;
  results: PairResult[];
}): string {
  const { schemes, fingerprints, results } = opts;
  const equals = results.filter((r) => r.verdict.kind === "equal");
  const subsets = results.filter((r) => r.verdict.kind === "subset");
  const incomparables = results.filter((r) => r.verdict.kind === "incomparable");
  const inconclusives = results.filter((r) => r.verdict.kind === "inconclusive");

  const lines: string[] = [];
  lines.push("# Catalogue-redundancy audit — argument-scheme rows");
  lines.push("");
  lines.push(`- **generated at:** ${new Date().toISOString()}`);
  lines.push("- **spec:** SCHEMES_IMPL_VERIFIER.md §5 Phase 4d");
  lines.push("- **roadmap step:** FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md step 18");
  lines.push(`- **schemes considered:** ${schemes.length} (kind='argument-scheme')`);
  lines.push(`- **pairs verified:** ${results.length} (all-pairs, cross-family included)`);
  lines.push(
    `- **verdict totals:** equal=${equals.length}, subset=${subsets.length}, incomparable=${incomparables.length}, inconclusive=${inconclusives.length}`,
  );
  lines.push("");

  lines.push("## Equal pairs (require follow-on issue per pair)");
  lines.push("");
  if (equals.length === 0) {
    lines.push("None. Catalogue is `equal`-clean at this snapshot.");
  } else {
    lines.push("| left | right | left family | right family | cq mapping |");
    lines.push("|---|---|---|---|---|");
    for (const r of equals) {
      const cm =
        r.verdict.kind === "equal"
          ? r.verdict.certificate.cqMapping
              .map((m) => `\`${m.leftCqKey}\`↔\`${m.rightCqKey}\``)
              .join(", ")
          : "";
      lines.push(
        `| \`${r.leftKey}\` | \`${r.rightKey}\` | \`${r.leftClusterTag ?? "—"}\` | \`${r.rightClusterTag ?? "—"}\` | ${cm} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Subset pairs (require follow-on issue per pair)");
  lines.push("");
  if (subsets.length === 0) {
    lines.push("None.");
  } else {
    lines.push("| left | right | left family | right family | direction | extra CQs |");
    lines.push("|---|---|---|---|---|---|");
    for (const r of subsets) {
      if (r.verdict.kind !== "subset") continue;
      lines.push(
        `| \`${r.leftKey}\` | \`${r.rightKey}\` | \`${r.leftClusterTag ?? "—"}\` | \`${r.rightClusterTag ?? "—"}\` | ${r.verdict.certificate.direction} | ${r.verdict.certificate.extraCqs.map((k) => `\`${k}\``).join(", ")} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Inconclusive pairs");
  lines.push("");
  if (inconclusives.length === 0) {
    lines.push("None.");
  } else {
    lines.push("| left | right | reason |");
    lines.push("|---|---|---|");
    for (const r of inconclusives) {
      if (r.verdict.kind !== "inconclusive") continue;
      lines.push(`| \`${r.leftKey}\` | \`${r.rightKey}\` | ${r.verdict.reason} |`);
    }
  }
  lines.push("");

  lines.push("## Cross-family vs within-family breakdown");
  lines.push("");
  const within = results.filter((r) => r.sameFamily);
  const cross = results.filter((r) => !r.sameFamily);
  lines.push("| scope | pairs | equal | subset | incomparable | inconclusive |");
  lines.push("|---|---|---|---|---|---|");
  for (const [scope, set] of [["within-family", within], ["cross-family", cross]] as const) {
    const eq = set.filter((r) => r.verdict.kind === "equal").length;
    const sb = set.filter((r) => r.verdict.kind === "subset").length;
    const ic = set.filter((r) => r.verdict.kind === "incomparable").length;
    const un = set.filter((r) => r.verdict.kind === "inconclusive").length;
    lines.push(`| ${scope} | ${set.length} | ${eq} | ${sb} | ${ic} | ${un} |`);
  }
  lines.push("");

  lines.push("## Follow-on issues");
  lines.push("");
  const followups = [...equals, ...subsets];
  if (followups.length === 0) {
    lines.push(
      "No follow-ons required at this snapshot. Re-run after each batch of catalogue additions (or wire into CI per §5 risk R5).",
    );
  } else {
    lines.push(
      `${followups.length} pair(s) require a Q-NNN or implementation issue to be filed against the schemes-track maintainer.`,
    );
    for (const r of followups) {
      lines.push(
        `- \`${r.leftKey}\` × \`${r.rightKey}\` — verdict: \`${describeVerdict(r.verdict)}\``,
      );
    }
  }
  lines.push("");

  lines.push("## Appendix: fingerprints");
  lines.push("");
  lines.push("| key | family | cqs | fingerprint |");
  lines.push("|---|---|---|---|");
  for (const s of schemes) {
    lines.push(
      `| \`${s.key}\` | \`${(s as any).clusterTag ?? "<no-cluster>"}\` | ${s.cqs.length} | \`${fingerprints.get(s.key)}\` |`,
    );
  }
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  console.log("=== Phase 4d — catalogue-redundancy audit ===");
  const schemes = await loadAll();
  console.log(`loaded ${schemes.length} argument-scheme rows`);

  const fingerprints = new Map<string, string>();
  for (const s of schemes) fingerprints.set(s.key, computeBehaviourFingerprint(s as any));

  const totalPairs = (schemes.length * (schemes.length - 1)) / 2;
  console.log(`verifying ${totalPairs} pairs (all-pairs)`);

  const results: PairResult[] = [];
  for (let i = 0; i < schemes.length; i += 1) {
    for (let j = i + 1; j < schemes.length; j += 1) {
      const left = schemes[i];
      const right = schemes[j];
      const verdict = await verifyBehaviourEquality(left, right);
      const leftTag = (left as any).clusterTag ?? null;
      const rightTag = (right as any).clusterTag ?? null;
      const r: PairResult = {
        leftKey: left.key,
        rightKey: right.key,
        leftClusterTag: leftTag,
        rightClusterTag: rightTag,
        sameFamily: !!leftTag && leftTag === rightTag,
        leftCqs: left.cqs.length,
        rightCqs: right.cqs.length,
        leftFingerprint: fingerprints.get(left.key)!,
        rightFingerprint: fingerprints.get(right.key)!,
        fingerprintsAgree: fingerprints.get(left.key) === fingerprints.get(right.key),
        verdict,
      };
      results.push(r);
      if (verdict.kind === "equal" || verdict.kind === "subset") {
        console.log(`  ${left.key} × ${right.key} → ${describeVerdict(verdict)}`);
      }
    }
  }

  const eq = results.filter((r) => r.verdict.kind === "equal").length;
  const sub = results.filter((r) => r.verdict.kind === "subset").length;
  const inc = results.filter((r) => r.verdict.kind === "incomparable").length;
  const und = results.filter((r) => r.verdict.kind === "inconclusive").length;
  console.log(`totals: equal=${eq} subset=${sub} incomparable=${inc} inconclusive=${und}`);

  const stamp = todayStamp();
  const jsonPath = join(process.cwd(), "audits", `catalogue-redundancy-${stamp}.json`);
  const mdPath = join(process.cwd(), "audits", `catalogue-redundancy-${stamp}.md`);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAtIso: new Date().toISOString(),
        spec: "SCHEMES_IMPL_VERIFIER.md §5 Phase 4d",
        roadmapStep: "FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md step 18",
        schemes: schemes.map((s) => ({
          key: s.key,
          clusterTag: (s as any).clusterTag ?? null,
          cqCount: s.cqs.length,
          fingerprint: fingerprints.get(s.key),
        })),
        totals: { pairs: results.length, equal: eq, subset: sub, incomparable: inc, inconclusive: und },
        pairs: results,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(mdPath, renderMd({ schemes, fingerprints, results }));
  console.log(`wrote ${jsonPath}`);
  console.log(`wrote ${mdPath}`);

  console.log("=== PASS — Phase 4d catalogue-redundancy audit emitted ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
