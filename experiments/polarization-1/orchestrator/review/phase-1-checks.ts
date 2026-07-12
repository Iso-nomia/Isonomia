/**
 * orchestrator/review/phase-1-checks.ts
 *
 * Soft-track validation for Phase 1 — emits `review_flag` events instead of
 * aborting. The author resolves each flag in `runtime/reviews/phase-1-review.md`.
 *
 * Stage-1 §3.8 + Stage-2 §4.4 specify three checks for Phase 1:
 *
 *   1. `no_established_restatement` — sub-claim text overlaps an item in
 *      FRAMING.md "Established within the framing."
 *      v1 implementation: token-Jaccard ≥ 0.55. We deliberately don't ship
 *      a cosine/embedding model here — Jaccard is cheap, deterministic,
 *      and produces a sensible flag rate. Author can tune the threshold.
 *
 *   2. `hinge_identified` — at least one sub-claim has ≥ 2 inbound
 *      `dependsOn` references.
 *
 *   3. `layer_balance` — no layer should account for > 60 % of sub-claims.
 */

import type { ClaimAnalystOutput, SubClaim } from "../agents/claim-analyst-schema";

export interface ReviewFlag {
  ruleId: string;
  severity: "info" | "warn";
  message: string;
  evidence?: unknown;
}

export interface SoftCheckOpts {
  output: ClaimAnalystOutput;
  framing: string;
  /** Token-Jaccard threshold for restatement; default 0.55. */
  restatementThreshold?: number;
}

export function runSoftReviewChecks(opts: SoftCheckOpts): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  flags.push(...checkNoEstablishedRestatement(opts));
  flags.push(...checkHingeIdentified(opts.output));
  flags.push(...checkLayerBalance(opts.output));
  return flags;
}

// ─────────────────────────────────────────────────────────────────
// 1. no_established_restatement
// ─────────────────────────────────────────────────────────────────

function checkNoEstablishedRestatement(opts: SoftCheckOpts): ReviewFlag[] {
  const items = extractEstablishedItems(opts.framing);
  if (items.length === 0) {
    return [{
      ruleId: "no_established_restatement:no-section",
      severity: "info",
      message: `FRAMING.md has no "Established within the framing" section — restatement check skipped.`,
    }];
  }
  const threshold = opts.restatementThreshold ?? 0.55;
  const flags: ReviewFlag[] = [];
  for (const sc of opts.output.subClaims) {
    const scTokens = tokenize(sc.text);
    let bestScore = 0;
    let bestItem = "";
    for (const item of items) {
      const itTokens = tokenize(item);
      const score = jaccard(scTokens, itTokens);
      if (score > bestScore) { bestScore = score; bestItem = item; }
    }
    if (bestScore >= threshold) {
      flags.push({
        ruleId: "no_established_restatement",
        severity: "warn",
        message: `Sub-claim #${sc.index} overlaps an established item (Jaccard ${bestScore.toFixed(2)} ≥ ${threshold}). Consider revising or removing.`,
        evidence: { subClaimIndex: sc.index, subClaimText: sc.text, establishedItem: bestItem, jaccard: bestScore },
      });
    }
  }
  return flags;
}

function extractEstablishedItems(framing: string): string[] {
  // Matches "### Established within the framing" through the next "### " or "## ".
  const m = framing.match(/^###\s+Established within the framing[^\n]*\n+([\s\S]*?)(?=^###\s|^##\s|(?![\s\S]))/im);
  if (!m) return [];
  // Bullet list items.
  return Array.from(m[1].matchAll(/^[-*]\s+(.+?)(?=\n[-*]\s|\n\n|(?![\s\S]))/gms))
    .map((g) => g[1].trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 0);
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const STOPWORDS = new Set([
  "with", "from", "have", "this", "that", "these", "those", "their", "them",
  "they", "between", "within", "across", "about", "would", "could", "should",
  "into", "such", "than", "more", "than", "most", "very", "been", "were",
  "will", "shall", "does", "doing", "done", "your", "yours", "ours", "also",
  "where", "which", "while", "when", "what", "whom", "whose", "after", "before",
]);

// ─────────────────────────────────────────────────────────────────
// 2. hinge_identified
// ─────────────────────────────────────────────────────────────────

function checkHingeIdentified(output: ClaimAnalystOutput): ReviewFlag[] {
  const inbound = new Map<number, number>();
  for (const sc of output.subClaims) {
    for (const dep of sc.dependsOn) {
      inbound.set(dep, (inbound.get(dep) ?? 0) + 1);
    }
  }
  const hinges = Array.from(inbound.entries()).filter(([, n]) => n >= 2);
  if (hinges.length === 0) {
    return [{
      ruleId: "hinge_identified",
      severity: "warn",
      message:
        `No sub-claim has ≥ 2 inbound dependsOn references. Topologies without a clear hinge tend to scatter Phase 2/3 effort. Consider whether one sub-claim should be the structural pivot.`,
      evidence: { inboundCounts: Object.fromEntries(inbound) },
    }];
  }
  return [{
    ruleId: "hinge_identified",
    severity: "info",
    message: `Hinge sub-claim(s) identified: ${hinges.map(([i, n]) => `#${i} (${n} inbound)`).join(", ")}.`,
    evidence: { hinges: hinges.map(([i, n]) => ({ index: i, inbound: n })) },
  }];
}

// ─────────────────────────────────────────────────────────────────
// 3. layer_balance
// ─────────────────────────────────────────────────────────────────

function checkLayerBalance(output: ClaimAnalystOutput): ReviewFlag[] {
  const counts = new Map<string, number>();
  for (const sc of output.subClaims) counts.set(sc.layer, (counts.get(sc.layer) ?? 0) + 1);
  const total = output.subClaims.length;
  const skewed: string[] = [];
  for (const [layer, n] of counts) {
    if (n / total > 0.6) skewed.push(`${layer} (${n}/${total})`);
  }
  if (skewed.length > 0) {
    return [{
      ruleId: "layer_balance",
      severity: "warn",
      message: `Layer distribution is skewed: ${skewed.join(", ")} accounts for > 60% of sub-claims. Consider whether the topology over-indexes on one layer.`,
      evidence: { distribution: Object.fromEntries(counts), total },
    }];
  }
  return [];
}
