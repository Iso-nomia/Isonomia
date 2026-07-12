/**
 * agents/synthesist-schema.ts
 *
 * Zod contract for the Phase-5 Synthesist / Crux-Finder — a single-shot
 * read-only agent that runs after Phase 4 is finalized. It consumes the
 * full dialectical record (Phase 1 topology, Phase 2 arguments from both
 * advocates, Phase 3 attacks from both, Phase 4 defenses + concession
 * tracker verdict, evidence corpus) and produces:
 *
 *   - `cruxes[]`            — identified disagreement points where the
 *                              dialectical state genuinely shifted, with a
 *                              characterization of *why* the two sides
 *                              still disagree (or why they no longer do).
 *   - `agreements[]`        — propositions both sides accept by end of
 *                              Phase 4, including ones the deliberation
 *                              *revealed* that weren't visible at Phase 1.
 *   - `originalContributions[]`
 *                           — arguments / decompositions / reference-class
 *                              shifts / methodological observations that
 *                              the deliberation produced and that aren't
 *                              just paraphrases of bound-corpus or web
 *                              sources. The point of the loosened run.
 *   - `openQuestions[]`     — what would actually resolve the remaining
 *                              cruxes (specific empirical tests,
 *                              theoretical clarifications, definitional
 *                              stipulations needed).
 *   - `epistemicShift`      — narrative on how the central claim's status
 *                              moved (or didn't), and a one-shot net
 *                              epistemic-value rating.
 *
 * The verdict is read-only: the Synthesist does not modify the platform
 * record or write platform-side artifacts. Its output is a JSON blob
 * (PHASE_5_COMPLETE.json) and a derived markdown report (SYNTHESIS.md).
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────
// Sub-shapes
// ─────────────────────────────────────────────────────────────────

const CruxStatusZ = z.enum([
  /** Both sides accept the empirical question as well-posed; they disagree
   *  on what the evidence shows. Resolvable in principle by better data. */
  "GENUINE_EMPIRICAL_DISPUTE",
  /** Disagreement traces to different operationalizations of a key term
   *  (e.g. "polarization" as affective vs. ideological vs. issue-attitude). */
  "DEFINITIONAL_AMBIGUITY",
  /** Both sides agree on the question and on what evidence would settle
   *  it; that evidence does not (yet) exist. */
  "EVIDENTIARY_GAP",
  /** Disagreement reduces to a value or weighting choice (e.g. how to trade
   *  off Type-I vs. Type-II error against the framing's ≥ 10% bar). */
  "VALUE_DISAGREEMENT",
  /** Both sides arrived at the same position by end of Phase 4 — what
   *  looked like a crux at Phase 1 turned out not to be one. */
  "RESOLVED_BY_DELIBERATION",
]);
export type CruxStatus = z.infer<typeof CruxStatusZ>;

const CruxZ = z.object({
  /** Sub-claim index from the Phase-1 topology this crux lives on,
   *  or null if the crux cuts across multiple sub-claims. */
  subClaimIndex: z.number().int().nonnegative().nullable(),
  /** Short label for the crux — 4-12 words, naming the disputed point. */
  label: z.string().min(8).max(140),
  /** What Advocate A maintains by end of Phase 4. Cite specific argumentIds
   *  in `keyArgumentIds`. 80-500 chars. */
  advocateAClaim: z.string().min(80).max(500),
  /** What Advocate B maintains by end of Phase 4. 80-500 chars. */
  advocateBClaim: z.string().min(80).max(500),
  /** Diagnosis of why the two positions differ — name the construct,
   *  reference class, methodological standard, or evidentiary gap that
   *  generates the disagreement. 120-800 chars. */
  whyTheyDisagree: z.string().min(120).max(800),
  status: CruxStatusZ,
  /** Phase-2/3/4 ids (argumentIds, rebuttalArgumentIds, response ids)
   *  whose dialectical movement made this crux visible. Must resolve. */
  keyArgumentIds: z.array(z.string().min(4)).min(1).max(20),
  /** Open-question indices (into the top-level `openQuestions[]`) that
   *  would resolve this crux if answered. Empty array allowed for
   *  RESOLVED_BY_DELIBERATION cruxes. */
  resolvedByOpenQuestions: z.array(z.number().int().nonnegative()).max(8).default([]),
});
export type Crux = z.infer<typeof CruxZ>;

const AgreementZ = z.object({
  /** Short label — 4-12 words. */
  label: z.string().min(8).max(140),
  /** Description of the proposition both sides now accept. 80-600 chars. */
  proposition: z.string().min(80).max(600),
  /** How the agreement was reached: */
  origin: z.enum([
    /** Both advocates' Phase-2 cases relied on this premise; never contested. */
    "STIPULATED_BACKGROUND",
    /** One side's Phase-2 argument was conceded (or effectively conceded
     *  per the tracker) by the other side in Phase 4. */
    "CONCEDED_IN_PHASE_4",
    /** Both sides argued for distinct positions but their Phase-3 / Phase-4
     *  exchanges revealed they are actually claiming the same thing in
     *  different vocabulary. */
    "REVEALED_BY_DIALECTIC",
    /** Both sides explicitly narrowed their original Phase-2 conclusions in
     *  Phase 4, and the narrowed conclusions are mutually consistent. */
    "MUTUAL_NARROWING",
  ]),
  /** Phase-2/3/4 ids that establish this agreement in the record. */
  basisInRecord: z.array(z.string().min(4)).min(1).max(15),
});
export type Agreement = z.infer<typeof AgreementZ>;

const OriginalContributionTypeZ = z.enum([
  /** Imports a reference class from outside the bound polarization-research
   *  literature (e.g. cable-news 1990s, talk-radio 1980s, yellow press 1890s). */
  "REFERENCE_CLASS_SHIFT",
  /** Decomposes the central claim or a sub-claim into a conjunction of
   *  factors, exposing where the chain holds or breaks. */
  "INTRODUCES_DECOMPOSITION",
  /** Bridges a literature the bound corpus didn't cover (e.g. media
   *  economics' creator-incentive channel, network science's contagion
   *  models, IO economics on platform competition). */
  "BRIDGES_LITERATURES",
  /** Distinguishes constructs that the bound corpus had been conflating
   *  (e.g. affective vs. ideological vs. issue-attitude polarization;
   *  outgroup animosity vs. ingroup solidarity). */
  "CONSTRUCT_DISAMBIGUATION",
  /** Provides a quantitative bound (an upper bound, lower bound, or
   *  power-against-bar calculation) the corpus did not state. */
  "PROVIDES_EFFECT_SIZE_BOUND",
  /** Reframes the question itself in a way both sides accept as more
   *  productive than the framing's original phrasing. */
  "REFRAMES_QUESTION",
  /** A methodological critique (instrumental-variable critique,
   *  selection-on-observables critique, replication-failure invocation,
   *  pre-registration objection) that genuinely changed argument standing. */
  "METHODOLOGICAL_INSIGHT",
]);
export type OriginalContributionType = z.infer<typeof OriginalContributionTypeZ>;

const OriginalContributionZ = z.object({
  /** Short label — 4-12 words. */
  label: z.string().min(8).max(140),
  /** Description — 100-800 chars — naming the contribution and what it
   *  unlocked dialectically. */
  description: z.string().min(100).max(800),
  type: OriginalContributionTypeZ,
  /** Which advocate(s) made the contribution, or "joint" if it emerged
   *  from the exchange itself (e.g. mutual narrowing producing a synthesis). */
  attribution: z.enum(["A", "B", "joint", "methodologist"]),
  /** Phase-2/3/4 ids that constitute or rely on this contribution. */
  contributingIds: z.array(z.string().min(4)).min(1).max(15),
  /** Citation tokens (corpus `src:*` / `block:*` or web `web:*`) supporting
   *  the contribution. May be empty if the contribution is purely
   *  inferential / structural (e.g. a decomposition argument). */
  evidenceTokens: z.array(z.string().min(2)).max(20).default([]),
  /** Single sentence on what makes this *original* relative to a
   *  surface-level literature review — the originality test from the
   *  loosened-mode prompts. 60-400 chars. */
  noveltyJustification: z.string().min(60).max(400),
});
export type OriginalContribution = z.infer<typeof OriginalContributionZ>;

const OpenQuestionZ = z.object({
  /** Phrased as a falsifiable empirical question or a stipulation request.
   *  60-400 chars. */
  question: z.string().min(60).max(400),
  /** What kind of resolution this question demands: */
  resolutionType: z.enum([
    "EMPIRICAL_STUDY",
    "META_ANALYSIS_OR_REPLICATION",
    "DEFINITIONAL_STIPULATION",
    "THEORETICAL_CLARIFICATION",
    "ACCESS_TO_PLATFORM_DATA",
  ]),
  /** Concrete sketch of the study / analysis / stipulation that would
   *  resolve it. 100-800 chars. */
  resolutionSketch: z.string().min(100).max(800),
  /** Crux indices (into top-level `cruxes[]`) this question, if answered,
   *  would resolve. */
  resolvesCruxIndices: z.array(z.number().int().nonnegative()).max(8).default([]),
});
export type OpenQuestion = z.infer<typeof OpenQuestionZ>;

const EpistemicShiftZ = z.object({
  /** Narrative on how the central-claim verdict relates to the Phase-1
   *  starting state — what the deliberation *did* to it. 200-1500 chars. */
  centralClaimMovementSummary: z.string().min(200).max(1500),
  /** Net assessment of the deliberation's epistemic value: */
  netEpistemicValue: z.enum([
    /** Produced original contributions that meaningfully change the state
     *  of analysis on the central claim. */
    "HIGH",
    /** Produced clarifications and concessions that materially update one
     *  or both sides' positions, but no genuinely original syntheses. */
    "MEDIUM",
    /** Litigated existing positions without producing concessions or
     *  original syntheses; would not change a careful reader's view. */
    "LOW",
    /** Produced conclusions less defensible than what the bound corpus
     *  alone supports (e.g. by overweighting low-quality web sources, or
     *  by collapsing under aggressive but methodologically thin attacks). */
    "NEGATIVE",
  ]),
  /** 100-600 chars. Cite specific contribution / crux / concession ids. */
  netEpistemicValueRationale: z.string().min(100).max(600),
});
export type EpistemicShift = z.infer<typeof EpistemicShiftZ>;

// ─────────────────────────────────────────────────────────────────
// Top-level shape
// ─────────────────────────────────────────────────────────────────

const SynthesistVerdictZ = z.object({
  phase: z.literal("5-synthesist"),
  cruxes: z.array(CruxZ).min(1).max(20),
  agreements: z.array(AgreementZ).max(20).default([]),
  originalContributions: z.array(OriginalContributionZ).max(25).default([]),
  openQuestions: z.array(OpenQuestionZ).max(20).default([]),
  epistemicShift: EpistemicShiftZ,
});
export type SynthesistVerdict = z.infer<typeof SynthesistVerdictZ>;

// ─────────────────────────────────────────────────────────────────
// Refusal
// ─────────────────────────────────────────────────────────────────

export const SynthesistRefusalZ = z.object({
  error: z.enum([
    /** Required input phase artifact missing or malformed. */
    "RECORD_INCOMPLETE",
    /** The Phase-3/4 exchange contains so few concessions, narrowings, or
     *  load-bearing rebuttals that there is nothing to synthesize beyond
     *  restating the Phase-2 positions. */
    "INSUFFICIENT_DIALECTICAL_MOVEMENT",
    /** Framing as written underdetermines what would count as an
     *  "original contribution" or "resolved crux" for this domain. */
    "FRAMING_AMBIGUOUS",
  ]),
  details: z.string().max(500),
});
export type SynthesistRefusal = z.infer<typeof SynthesistRefusalZ>;

export function isSynthesistRefusal(r: unknown): r is SynthesistRefusal {
  return (
    typeof (r as any)?.error === "string" &&
    !Array.isArray((r as any)?.cruxes)
  );
}

// ─────────────────────────────────────────────────────────────────
// Schema-binding inputs from the orchestrator
// ─────────────────────────────────────────────────────────────────

export interface SynthesistSchemaOpts {
  /** Phase-2 argumentIds known to the record (both advocates). */
  knownArgumentIds: ReadonlySet<string>;
  /** Phase-3 rebuttalArgumentIds known to the record (both advocates). */
  knownAttackIds: ReadonlySet<string>;
  /** Phase-4 synthesized response ids: `phase4-A-r{idx}`, `phase4-A-cq{idx}`,
   *  `phase4-B-r{idx}`, `phase4-B-cq{idx}`. */
  knownPhase4ResponseIds: ReadonlySet<string>;
  /** Number of sub-claims in the Phase-1 topology (validates subClaimIndex range). */
  subClaimCount: number;
  /** Citation tokens that resolve in the record — corpus + web combined. */
  knownCitationTokens: ReadonlySet<string>;
}

// ─────────────────────────────────────────────────────────────────
// Parameterized schema builder
// ─────────────────────────────────────────────────────────────────

export function buildSynthesistVerdictSchema(opts: SynthesistSchemaOpts) {
  const {
    knownArgumentIds,
    knownAttackIds,
    knownPhase4ResponseIds,
    subClaimCount,
    knownCitationTokens,
  } = opts;

  // A "known dialectical id" is anything from the record an id-array field
  // is allowed to reference.
  function isKnownDialecticalId(id: string): boolean {
    return (
      knownArgumentIds.has(id) ||
      knownAttackIds.has(id) ||
      knownPhase4ResponseIds.has(id)
    );
  }

  // Tolerant input mutation before strict validation. Caps lengths and
  // drops out-of-range openQuestion index references so the synthesist
  // doesn't have to be retried for purely mechanical bookkeeping issues.
  const Normalized = z.preprocess((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const data = raw as any;
    // Length caps on epistemicShift fields.
    const es = data.epistemicShift;
    if (es && typeof es === "object") {
      if (typeof es.centralClaimMovementSummary === "string" && es.centralClaimMovementSummary.length > 1500) {
        es.centralClaimMovementSummary = es.centralClaimMovementSummary.slice(0, 1497) + "...";
      }
      if (typeof es.netEpistemicValueRationale === "string" && es.netEpistemicValueRationale.length > 600) {
        es.netEpistemicValueRationale = es.netEpistemicValueRationale.slice(0, 597) + "...";
      }
    }
    // Drop out-of-range openQuestion index references in cruxes.
    const oqLen = Array.isArray(data.openQuestions) ? data.openQuestions.length : 0;
    if (Array.isArray(data.cruxes)) {
      for (const c of data.cruxes) {
        if (Array.isArray(c?.resolvedByOpenQuestions)) {
          c.resolvedByOpenQuestions = c.resolvedByOpenQuestions.filter(
            (i: unknown) => typeof i === "number" && i >= 0 && i < oqLen,
          );
        }
      }
    }
    // Drop out-of-range crux index references in openQuestions.
    const cruxLen = Array.isArray(data.cruxes) ? data.cruxes.length : 0;
    if (Array.isArray(data.openQuestions)) {
      for (const q of data.openQuestions) {
        if (Array.isArray(q?.resolvesCruxIndices)) {
          q.resolvesCruxIndices = q.resolvesCruxIndices.filter(
            (i: unknown) => typeof i === "number" && i >= 0 && i < cruxLen,
          );
        }
      }
    }
    return data;
  }, SynthesistVerdictZ);

  return Normalized.superRefine((data, ctx) => {
    // 1. cruxes[*].subClaimIndex range, keyArgumentIds resolution,
    //    resolvedByOpenQuestions index range.
    for (let i = 0; i < data.cruxes.length; i++) {
      const c = data.cruxes[i];
      if (c.subClaimIndex !== null) {
        if (c.subClaimIndex >= subClaimCount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `cruxes[${i}].subClaimIndex ${c.subClaimIndex} is out of range (topology has ${subClaimCount} sub-claims)`,
            path: ["cruxes", i, "subClaimIndex"],
          });
        }
      }
      for (let j = 0; j < c.keyArgumentIds.length; j++) {
        const id = c.keyArgumentIds[j];
        if (!isKnownDialecticalId(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `cruxes[${i}].keyArgumentIds[${j}] "${id}" is not a Phase-2 argumentId, Phase-3 rebuttalArgumentId, or Phase-4 response id from the record`,
            path: ["cruxes", i, "keyArgumentIds", j],
          });
        }
      }
      for (let j = 0; j < c.resolvedByOpenQuestions.length; j++) {
        const oqIdx = c.resolvedByOpenQuestions[j];
        if (oqIdx >= data.openQuestions.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `cruxes[${i}].resolvedByOpenQuestions[${j}] index ${oqIdx} is out of range (only ${data.openQuestions.length} open questions declared)`,
            path: ["cruxes", i, "resolvedByOpenQuestions", j],
          });
        }
      }
    }

    // 2. agreements[*].basisInRecord resolution.
    for (let i = 0; i < data.agreements.length; i++) {
      const a = data.agreements[i];
      for (let j = 0; j < a.basisInRecord.length; j++) {
        const id = a.basisInRecord[j];
        if (!isKnownDialecticalId(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `agreements[${i}].basisInRecord[${j}] "${id}" is not a Phase-2/3/4 id from the record`,
            path: ["agreements", i, "basisInRecord", j],
          });
        }
      }
    }

    // 3. originalContributions[*].contributingIds + evidenceTokens.
    for (let i = 0; i < data.originalContributions.length; i++) {
      const oc = data.originalContributions[i];
      for (let j = 0; j < oc.contributingIds.length; j++) {
        const id = oc.contributingIds[j];
        if (!isKnownDialecticalId(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `originalContributions[${i}].contributingIds[${j}] "${id}" is not a Phase-2/3/4 id from the record`,
            path: ["originalContributions", i, "contributingIds", j],
          });
        }
      }
      for (let j = 0; j < oc.evidenceTokens.length; j++) {
        const tok = oc.evidenceTokens[j];
        if (!knownCitationTokens.has(tok)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `originalContributions[${i}].evidenceTokens[${j}] "${tok}" is not a citation token used in the record (corpus or web)`,
            path: ["originalContributions", i, "evidenceTokens", j],
          });
        }
      }
    }

    // 4. openQuestions[*].resolvesCruxIndices range.
    for (let i = 0; i < data.openQuestions.length; i++) {
      const q = data.openQuestions[i];
      for (let j = 0; j < q.resolvesCruxIndices.length; j++) {
        const cIdx = q.resolvesCruxIndices[j];
        if (cIdx >= data.cruxes.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `openQuestions[${i}].resolvesCruxIndices[${j}] index ${cIdx} is out of range (only ${data.cruxes.length} cruxes declared)`,
            path: ["openQuestions", i, "resolvesCruxIndices", j],
          });
        }
      }
    }

    // 5. Mutual reachability: every crux marked RESOLVED_BY_DELIBERATION
    //    should have at least one supporting agreement OR contributingId
    //    that traces to a Phase-4 concession/narrowing — soft rule
    //    enforced via guidance.
    //    (Not validated mechanically — too easy to false-positive on
    //    legitimately under-supported claims.)
  });
}
