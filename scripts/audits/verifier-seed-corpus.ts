/**
 * Spec 4 phase 4a — Q-018 §3.1 seed-corpus verifier run.
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md
 *   §Phase 2 step 8.
 *
 * Runs `verifyBehaviourEquality` over the three duplicate-candidate pairs
 * surfaced by audits/q018-ontoclean-20260528.md §3.1 and writes the verdicts
 * to audits/verifier-seed-corpus-<YYYYMMDD>.json (+ .md).
 *
 * Exit criterion: each pair has a recorded verdict; `equal` pairs trigger
 * retire-or-merge in step 9.
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

const PAIRS: Array<[string, string]> = [
  ["expert_opinion", "expert-opinion"],
  ["positive_consequences", "good_consequences"],
  ["causal", "cause_to_effect"],
];

type PairReport = {
  leftKey: string;
  rightKey: string;
  leftFound: boolean;
  rightFound: boolean;
  leftFingerprint?: string;
  rightFingerprint?: string;
  fingerprintsAgree?: boolean;
  verdict?: VerifierVerdict;
  leftCqCount?: number;
  rightCqCount?: number;
};

function todayStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function loadScheme(key: string): Promise<SchemeWithCqs | null> {
  const row = await prisma.argumentScheme.findUnique({
    where: { key },
    include: { cqs: true },
  });
  return row as SchemeWithCqs | null;
}

function renderMd(reports: PairReport[]): string {
  const lines: string[] = [];
  lines.push(`# Verifier seed-corpus run — Q-018 §3.1`);
  lines.push("");
  lines.push(`- **generated at:** ${new Date().toISOString()}`);
  lines.push(`- **plan step:** Phase 2 step 8`);
  lines.push(`- **source pairs:** audits/q018-ontoclean-20260528.md §3.1`);
  lines.push(`- **verifier module:** lib/schemes/verifier/`);
  lines.push("");
  lines.push("## Verdict table");
  lines.push("");
  lines.push("| left | right | left CQs | right CQs | fingerprint match | verdict |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of reports) {
    const v =
      r.verdict?.kind ??
      (!r.leftFound || !r.rightFound ? "missing" : "n/a");
    const fpa = r.fingerprintsAgree === undefined ? "—" : r.fingerprintsAgree ? "yes" : "no";
    lines.push(
      `| \`${r.leftKey}\` | \`${r.rightKey}\` | ${r.leftCqCount ?? "—"} | ${r.rightCqCount ?? "—"} | ${fpa} | \`${v}\` |`,
    );
  }
  lines.push("");
  lines.push("## Per-pair detail");
  for (const r of reports) {
    lines.push("");
    lines.push(`### \`${r.leftKey}\` × \`${r.rightKey}\``);
    if (!r.leftFound || !r.rightFound) {
      lines.push(`- **status:** one or both rows missing in production catalogue.`);
      lines.push(`  - leftFound=${r.leftFound}, rightFound=${r.rightFound}`);
      continue;
    }
    lines.push(`- **left fingerprint:** \`${r.leftFingerprint}\``);
    lines.push(`- **right fingerprint:** \`${r.rightFingerprint}\``);
    lines.push(`- **verdict:** \`${r.verdict?.kind}\``);
    if (r.verdict?.kind === "equal") {
      lines.push(
        `- **cq mapping:** ${r.verdict.certificate.cqMapping
          .map((m) => `\`${m.leftCqKey}\`↔\`${m.rightCqKey}\``)
          .join(", ")}`,
      );
      lines.push(
        `- **action:** retire or merge as \`SchemeVariant\` of canonical (step 9).`,
      );
    } else if (r.verdict?.kind === "subset") {
      lines.push(
        `- **direction:** ${r.verdict.certificate.direction}`,
      );
      lines.push(
        `- **extra CQs (subset side on ⟦·⟧):** ${r.verdict.certificate.extraCqs.map((k) => `\`${k}\``).join(", ")}`,
      );
    } else if (r.verdict?.kind === "incomparable") {
      const c = r.verdict.certificate;
      if (c.conflictingCqs?.length) {
        lines.push(
          `- **conflicts:** ${c.conflictingCqs
            .map((x) => `\`${x.leftCqKey}\`/\`${x.rightCqKey}\` → ${x.conflict}`)
            .join("; ")}`,
        );
      }
      if (c.discriminatingCqOnLeft) {
        lines.push(
          `- **discriminating on left:** \`${c.discriminatingCqOnLeft.cqKey}\` — ${c.discriminatingCqOnLeft.rationale}`,
        );
      }
      if (c.discriminatingCqOnRight) {
        lines.push(
          `- **discriminating on right:** \`${c.discriminatingCqOnRight.cqKey}\` — ${c.discriminatingCqOnRight.rationale}`,
        );
      }
    } else if (r.verdict?.kind === "inconclusive") {
      lines.push(`- **reason:** ${r.verdict.reason}`);
    }
  }
  lines.push("");
  lines.push("## Implications for step 9 (catalogue de-duplication)");
  lines.push("");
  const equals = reports.filter((r) => r.verdict?.kind === "equal");
  if (equals.length === 0) {
    lines.push(
      "No `equal` verdicts. The folksonomy framing from Q-018 §3.1 ('plausibly redundant') is **not** confirmed by behaviour-equality on these pairs; the verifier finds at least one structural distinction per pair. Step 9's retire-or-merge work has nothing to do on this corpus.",
    );
  } else {
    lines.push(
      `${equals.length} of ${reports.length} pair(s) returned \`equal\`. Step 9 should retire or relink as \`SchemeVariant\`:`,
    );
    for (const e of equals) {
      lines.push(`- \`${e.leftKey}\` × \`${e.rightKey}\``);
    }
  }
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  console.log("=== Spec 4 phase 4a — Q-018 §3.1 seed-corpus run ===");
  const reports: PairReport[] = [];

  for (const [leftKey, rightKey] of PAIRS) {
    console.log(`\n[pair] ${leftKey} × ${rightKey}`);
    const [L, R] = await Promise.all([loadScheme(leftKey), loadScheme(rightKey)]);
    const report: PairReport = {
      leftKey,
      rightKey,
      leftFound: L !== null,
      rightFound: R !== null,
    };
    if (!L || !R) {
      console.log(`  ⚠ missing: leftFound=${!!L}, rightFound=${!!R}`);
      reports.push(report);
      continue;
    }
    report.leftCqCount = L.cqs.length;
    report.rightCqCount = R.cqs.length;
    report.leftFingerprint = computeBehaviourFingerprint(L as any);
    report.rightFingerprint = computeBehaviourFingerprint(R as any);
    report.fingerprintsAgree = report.leftFingerprint === report.rightFingerprint;
    console.log(`  left CQs=${report.leftCqCount}  right CQs=${report.rightCqCount}`);
    console.log(`  fingerprint match: ${report.fingerprintsAgree}`);

    const verdict = await verifyBehaviourEquality(L, R);
    report.verdict = verdict;
    console.log(`  verdict: ${verdict.kind}${verdict.kind === "inconclusive" ? ` (${verdict.reason})` : ""}`);
    reports.push(report);
  }

  const stamp = todayStamp();
  const jsonPath = join(process.cwd(), "audits", `verifier-seed-corpus-${stamp}.json`);
  const mdPath = join(process.cwd(), "audits", `verifier-seed-corpus-${stamp}.md`);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAtIso: new Date().toISOString(),
        planStep: "Phase 2 step 8",
        sourceAudit: "audits/q018-ontoclean-20260528.md §3.1",
        pairs: reports,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  writeFileSync(mdPath, renderMd(reports), "utf8");
  console.log(`\n[wrote] ${jsonPath}`);
  console.log(`[wrote] ${mdPath}`);

  await prisma.$disconnect();
  console.log("\n=== done ===");
}

main().catch(async (e) => {
  console.error("[seed-corpus] failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
