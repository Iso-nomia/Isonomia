/**
 * writingConstraints — Pre-rendered compliance contract for synthesis clients.
 *
 * Motivates: Claude cold-start eval (May 2026) found that consumers correctly
 * read `refusalSurface` / `standing` / `standingDepth` in the abstract but
 * failed to translate them into output rules — Essay/Brief views asserted
 * conclusions the graph would not license, free agents hedged inconsistently.
 *
 * This module turns interpretation into substitution: every field is a
 * pre-rendered string the consumer can drop into output verbatim, or a
 * structured target paired with a `suggestedFraming` they can splice in.
 *
 * No LLM. No prose generation. Pure deterministic fold over the readout.
 */

import type {
  SyntheticReadout,
  RefusalSurfaceEntry,
  TopArgumentSummary,
  ContestedArgumentSummary,
} from "@/lib/deliberation/syntheticReadout";

export type DeliberationStage = "articulation" | "deliberation" | "matured";

export interface WritingConstraintsHedgeEntry {
  /** What the agent is being asked to hedge. */
  target: { kind: "argument"; id: string };
  /** Standing label, e.g. "tested-undermined". */
  standing: string;
  /** Depth tier backing the standing. */
  depthTier: "thin" | "moderate" | "dense";
  /** Pre-rendered phrase the agent can splice into prose. */
  suggestedFraming: string;
}

export interface WritingConstraintsMustNotAssertEntry {
  claimMoid: string;
  claimTextPreview: string;   // ≤160 chars
  reason: string;             // pre-rendered
  blockerIds: string[];
}

export interface WritingConstraints {
  /** Things the agent's output MUST include verbatim or by reference. */
  mustInclude: {
    /** Drop this sentence into output verbatim. */
    honestyLine: string;
    /** Pre-rendered refusal caveat; null when the graph licenses every
     *  conclusion it has been asked about. */
    refusalNotice: string | null;
    /**
     * Topology cautions surfaced from `readout.topology.ambiguity`.
     * Each entry is a deterministic, pre-rendered sentence covering a
     * structural-shape hazard (multiple co-equal hubs, diffuse hub
     * structure, premise cascade-concentration, no load-bearing
     * structure). Empty when the topology is unambiguous. Consumers
     * must include these verbatim when synthesising — otherwise the
     * resulting prose lies about a structured field.
     */
    structuralCautions: string[];
    /**
     * Honest disclosure for hierarchical-mode briefings (very-large
     * deliberations whose sub-region detail is omitted). `null` when
     * the briefing is fully hydrated.
     */
    sizeDisclosure: string | null;
  };
  /** Conclusions the agent MUST NOT assert as established.
   *  Derived from `refusalSurface.cannotConcludeBecause`. */
  mustNotAssert: WritingConstraintsMustNotAssertEntry[];
  /** Arguments the agent MUST hedge when discussing.
   *  Derived from arguments at tested-undermined / tested-attacked, plus
   *  arguments at any standing with thin depth. Capped at 25. */
  shouldHedge: WritingConstraintsHedgeEntry[];
  /** Whole-deliberation framing the agent should adopt. */
  framing: {
    stage: DeliberationStage;
    advisoryNote: string;
  };
}

const HEDGE_CAP = 25;

function classifyStage(input: {
  argumentCount: number;
  thinCount: number;
  denseCount: number;
}): DeliberationStage {
  if (input.argumentCount === 0) return "articulation";
  const thinRatio = input.thinCount / input.argumentCount;
  const denseRatio = input.denseCount / input.argumentCount;
  if (denseRatio > 0.3) return "matured";
  if (thinRatio > 0.5) return "articulation";
  return "deliberation";
}

function stageNote(stage: DeliberationStage): string {
  switch (stage) {
    case "articulation":
      return "depthDistribution.thin dominant — frame as articulation-stage, not deliberation-stage. Standing labels are about which arguments have been registered, not which have been tested.";
    case "deliberation":
      return "Mixed depth — standings are meaningful but most positions have not seen dense challenge. Qualify confidence claims by depthTier.";
    case "matured":
      return "depthDistribution.dense non-trivial — standings reflect substantive challenge. Treat tested-survived (dense) as the strongest available signal in the graph.";
  }
}

function refusalReason(entry: RefusalSurfaceEntry): string {
  const n = entry.blockerIds.length;
  const firstSummary =
    entry.blockerSummaries.find((s) => s && s.length > 0) ?? "";
  switch (entry.blockedBy) {
    case "unanswered-undercut": {
      const tail = firstSummary
        ? ` First blocker: "${firstSummary}"`
        : "";
      return `Blocked by ${n} unanswered undercut${n === 1 ? "" : "s"} on supporting argument(s).${tail}`;
    }
    case "unanswered-undermine": {
      const tail = firstSummary
        ? ` First blocker: "${firstSummary}"`
        : "";
      return `Blocked by ${n} unanswered undermine${n === 1 ? "" : "s"} against supporting premise(s).${tail}`;
    }
    case "scheme-incompatibility":
      return "Blocked by a scheme incompatibility recorded in the graph.";
    case "depth-thin":
      return "Deliberation-wide thin depth — every argument is at thin depth tier; no conclusion has been tested enough to license closure.";
  }
}

function hedgeFraming(args: {
  standing: string;
  depthTier: "thin" | "moderate" | "dense";
  challengerCount: number;
  unansweredAttackCount?: number;
}): string {
  const depthQual =
    args.depthTier === "thin"
      ? " (thin depth — only one challenger has engaged)"
      : args.depthTier === "moderate"
        ? " (moderate depth)"
        : " (dense depth)";
  const attackCount = args.unansweredAttackCount ?? 0;

  switch (args.standing) {
    case "tested-undermined":
      return attackCount > 0
        ? `this argument is currently undermined by ${attackCount} unanswered objection${attackCount === 1 ? "" : "s"}${depthQual} — do not cite as evidence for its conclusion`
        : `this argument is currently undermined and the attack has not been answered${depthQual} — do not cite as evidence for its conclusion`;
    case "tested-attacked":
      return attackCount > 0
        ? `this argument is under active challenge (${attackCount} unanswered attack${attackCount === 1 ? "" : "s"})${depthQual} — present the dispute, do not pick a winner`
        : `this argument is under active challenge with no resolution yet${depthQual} — hedge any reliance on it`;
    case "tested-survived":
      return args.depthTier === "thin"
        ? `this argument has survived challenge but only at thin depth (${args.challengerCount} challenger) — do not over-rely on it`
        : `this argument has survived challenge at ${args.depthTier} depth — may cite, but flag the depth tier`;
    case "untested-supported":
      return `this argument has supports but has not been challenged${depthQual} — frame as articulated, not tested`;
    case "untested-default":
    default:
      return `this argument has not been challenged${depthQual} — frame as articulated, not tested`;
  }
}

/**
 * Build the writing-constraints contract for a fully-computed readout.
 * Pure function over the readout's already-materialized fields.
 */
export function buildWritingConstraints(
  readout: SyntheticReadout,
): WritingConstraints {
  // ── mustInclude ────────────────────────────────────────────
  const refusals = readout.refusalSurface.cannotConcludeBecause;
  const claimRefusalCount = refusals.filter(
    (r) => r.blockedBy !== "depth-thin",
  ).length;
  const hasDepthThin = refusals.some((r) => r.blockedBy === "depth-thin");

  let refusalNotice: string | null = null;
  if (refusals.length > 0) {
    const parts: string[] = [];
    if (claimRefusalCount > 0) {
      parts.push(
        `This deliberation has ${claimRefusalCount} blocked conclusion${claimRefusalCount === 1 ? "" : "s"} that the graph cannot currently license.`,
      );
    }
    if (hasDepthThin) {
      parts.push(
        "The deliberation is at thin depth across the board — no conclusion has been tested enough to license closure.",
      );
    }
    refusalNotice = parts.join(" ");
  }

  // ── mustNotAssert ──────────────────────────────────────────
  const TRUNC = 160;
  const mustNotAssert: WritingConstraintsMustNotAssertEntry[] = refusals
    .filter((r) => r.blockedBy !== "depth-thin" && r.conclusionClaimId)
    .map((r) => {
      const txt = r.attemptedConclusion ?? "";
      const preview =
        txt.length > TRUNC ? txt.slice(0, TRUNC) + "…" : txt;
      return {
        claimMoid: r.conclusionClaimId,
        claimTextPreview: preview,
        reason: refusalReason(r),
        blockerIds: r.blockerIds,
      };
    });

  // ── shouldHedge ────────────────────────────────────────────
  // Union of contested + thin-depth arguments, deduped by id,
  // ordered with mostContested first, then topArguments fillers,
  // capped at HEDGE_CAP.
  const contestedAttackCount = new Map<string, number>();
  for (const c of readout.mostContested) {
    contestedAttackCount.set(c.id, c.unansweredAttackCount);
  }

  const hedgeCandidates: Array<TopArgumentSummary | ContestedArgumentSummary> =
    [];
  // Seed: mostContested first (these are by definition active disputes).
  for (const c of readout.mostContested) hedgeCandidates.push(c);
  // Fill: topArguments at undermined/attacked/thin standing.
  for (const t of readout.topArguments) hedgeCandidates.push(t);

  const seen = new Set<string>();
  const shouldHedge: WritingConstraintsHedgeEntry[] = [];
  for (const cand of hedgeCandidates) {
    if (shouldHedge.length >= HEDGE_CAP) break;
    if (seen.has(cand.id)) continue;
    const isContestedStanding =
      cand.standing === "tested-undermined" ||
      cand.standing === "tested-attacked";
    const isThinDepth = cand.standingDepth === "thin";
    if (!isContestedStanding && !isThinDepth) continue;
    // Skip pure thin-depth at untested-default unless the deliberation is
    // small — those are noise.
    if (
      cand.standing === "untested-default" &&
      cand.standingDepth === "thin" &&
      readout.fingerprint.argumentCount > 20
    ) {
      continue;
    }
    seen.add(cand.id);
    shouldHedge.push({
      target: { kind: "argument", id: cand.id },
      standing: cand.standing,
      depthTier: cand.standingDepth,
      suggestedFraming: hedgeFraming({
        standing: cand.standing,
        depthTier: cand.standingDepth,
        challengerCount: cand.challengerCount,
        unansweredAttackCount: contestedAttackCount.get(cand.id),
      }),
    });
  }

  // ── framing ────────────────────────────────────────────────
  const dist = readout.fingerprint.depthDistribution;
  const stage = classifyStage({
    argumentCount: readout.fingerprint.argumentCount,
    thinCount: dist.thin ?? 0,
    denseCount: dist.dense ?? 0,
  });

  return {
    mustInclude: {
      honestyLine: readout.honestyLine,
      refusalNotice,
      structuralCautions: readout.topology?.ambiguity?.cautions ?? [],
      sizeDisclosure: readout.topology?.sizeTier?.disclosure ?? null,
    },
    mustNotAssert,
    shouldHedge,
    framing: {
      stage,
      advisoryNote: stageNote(stage),
    },
  };
}
