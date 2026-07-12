/**
 * verify-mode-B v1b — source→claim backing assessment (C4, the hollow-citation check).
 *
 * "Does the cited source actually back the claim?" — the essay's C4. `shapeVerdict`
 * is the pure, tested core that answers Q-056's second half: the verdict carries
 * its OWN confidence (never laundered into certainty), and *unverifiable*
 * (couldn't retrieve source text) is a first-class state distinct from *unrelated*
 * (source retrieved, doesn't address the claim). Abstract-only backing is capped
 * and flagged — you cannot fully certify backing from an abstract.
 *
 * `assessBacking` is the impure LLM-judge (OpenAI, consistent with the codebase's
 * extraction pipeline). It is one implementation of the assessor interface Q-056
 * weighs; a hosted NLI model could be swapped behind the same shape.
 */
import OpenAI from "openai";

export type BackingRelation = "entails" | "contradicts" | "neutral";
export type SourceKind = "body" | "abstract" | "none";
export type BackingStatus = "backs" | "contradicts" | "unrelated" | "unverifiable";

export interface BackingAssessment {
  relation: BackingRelation;
  /** The assessor's own confidence in the relation, 0..1. */
  confidence: number;
  rationale?: string;
}

export interface BackingVerdict {
  status: BackingStatus;
  /** The check's OWN confidence, 0..1 — NOT a claim about the claim's truth. */
  confidence: number;
  sourceKind: SourceKind;
  note?: string;
  rationale?: string;
}

const ABSTRACT_CONFIDENCE_CAP = 0.6;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Map an assessment + the kind of source text it was based on into a verdict.
 * Pure. This is where the honesty budget is enforced.
 */
export function shapeVerdict(
  assessment: BackingAssessment | null,
  sourceKind: SourceKind,
): BackingVerdict {
  if (sourceKind === "none" || !assessment) {
    return {
      status: "unverifiable",
      confidence: 0,
      sourceKind,
      note:
        sourceKind === "none"
          ? "source text could not be retrieved (paywall, PDF, or fetch failure) — not evidence the claim is unsupported"
          : "no assessment available",
    };
  }

  const statusOf: Record<BackingRelation, BackingStatus> = {
    entails: "backs",
    contradicts: "contradicts",
    neutral: "unrelated",
  };

  let confidence = clamp01(assessment.confidence);
  let note: string | undefined;
  if (sourceKind === "abstract") {
    confidence = Math.min(confidence, ABSTRACT_CONFIDENCE_CAP);
    note = "assessed from the source abstract only, not full text";
  }

  return {
    status: statusOf[assessment.relation],
    confidence,
    sourceKind,
    note,
    rationale: assessment.rationale,
  };
}

function normalizeRelation(v: unknown): BackingRelation {
  const s = String(v).toLowerCase();
  if (s.startsWith("entail") || s === "supports" || s === "support") return "entails";
  if (s.startsWith("contradict") || s === "refutes" || s === "refute") return "contradicts";
  return "neutral";
}

const JUDGE_SYSTEM =
  "You assess ONLY whether a SOURCE passage supports a CLAIM by entailment. You are not judging whether the claim is true in the world — only whether THIS source backs it. " +
  "Return 'entails' if the source's content supports the claim, 'contradicts' if it argues against it, 'neutral' if the source does not address the claim (this is the hollow-citation case). " +
  "Be calibrated: report lower confidence when the source is tangential or the match is loose. Respond as strict JSON: " +
  '{"relation":"entails"|"contradicts"|"neutral","confidence":<0..1>,"rationale":"<one sentence>"}.';

/**
 * LLM-judge backing assessment. Impure (OpenAI). Throws if no key is configured;
 * the caller degrades that to an `unverifiable` verdict via `shapeVerdict(null, …)`.
 */
export async function assessBacking(input: {
  sourceText: string;
  claim: string;
}): Promise<BackingAssessment> {
  const client = new OpenAI();
  const model = process.env.VERIFY_BACKING_MODEL ?? "gpt-4o-mini";
  const res = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: JUDGE_SYSTEM },
      {
        role: "user",
        content: `SOURCE:\n"""${input.sourceText.slice(0, 8_000)}"""\n\nCLAIM:\n"""${input.claim.slice(0, 1_000)}"""\n\nDoes the SOURCE back the CLAIM?`,
      },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* fall through to neutral/low */
  }
  return {
    relation: normalizeRelation(parsed.relation),
    confidence: clamp01(Number(parsed.confidence)),
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 400) : undefined,
  };
}
