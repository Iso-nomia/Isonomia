/**
 * agents/advocate-schema.ts
 *
 * Zod contract for Advocate A and Advocate B Phase-2 output, plus the
 * per-call factory that binds the topology (sub-claim count, per-index
 * layer, hinge indices) and the resolved citation-token set into a
 * parameterized schema.
 *
 * Hard-validation rules mirror `prompts/2-advocate-a.md` §5 and the
 * identical block in `prompts/3-advocate-b.md` §5. Soft-track checks
 * (evidence fidelity LLM-judge, scheme appropriateness, padding,
 * critique-consistency) live in `review/phase-2-checks.ts`.
 *
 * Usage:
 *   const schema = buildAdvocateOutputSchema({
 *     advocateRole: "A",
 *     topology: { count: 9, layerByIndex: {...}, hingeIndices: [2,3,4] },
 *     allowedCitationTokens: new Set([...]),
 *   });
 *   const parsed = schema.safeParse(json);
 */

import { z } from "zod";
import { EXPERIMENT_SCHEME_KEYS, type ExperimentSchemeKey } from "../scheme-catalog";

// Layer enum mirrors claim-analyst-schema.ts. Re-declared (not imported) to
// keep this module loadable independently of Phase-1 code.
export const AdvocateLayerZ = z.enum(["definitional", "empirical", "causal", "normative"]);
export type AdvocateLayer = z.infer<typeof AdvocateLayerZ>;

// ─────────────────────────────────────────────────────────────────
// Scheme ↔ layer plausibility (prompt §5 constraint #8)
// ─────────────────────────────────────────────────────────────────

const EMPIRICAL_OR_CAUSAL_SCHEMES: ReadonlySet<ExperimentSchemeKey> = new Set([
  "cause_to_effect",
  "sign",
  "inference_to_best_explanation",
  "statistical_generalization",
  "expert_opinion",
  "argument_from_example",
  "analogy",
  "argument_from_lack_of_evidence",
  "methodological_critique",
]);

const NORMATIVE_SCHEMES: ReadonlySet<ExperimentSchemeKey> = new Set([
  "practical_reasoning",
  "positive_consequences",
  "negative_consequences",
  "analogy",
  "expert_opinion",
]);

export function isSchemeAllowedForLayer(
  scheme: ExperimentSchemeKey,
  layer: AdvocateLayer,
): boolean {
  if (layer === "empirical" || layer === "causal") return EMPIRICAL_OR_CAUSAL_SCHEMES.has(scheme);
  if (layer === "normative") return NORMATIVE_SCHEMES.has(scheme);
  // definitional: any scheme is allowed (definitional Phase-2 args are unusual but not forbidden)
  return true;
}

// ─────────────────────────────────────────────────────────────────
// Static (per-element) schemas
// ─────────────────────────────────────────────────────────────────

export const SchemeKeyZ = z.enum(EXPERIMENT_SCHEME_KEYS as unknown as [ExperimentSchemeKey, ...ExperimentSchemeKey[]]);

// Citation tokens are minted server-side and may use different prefixes
// (`src:`, `block:`, etc.) depending on the underlying corpus binding.
// We accept any lower-case-prefix:id token; ground-truth resolution is
// done by `allowedCitationTokens` lookup in argument-mint.
export const CitationTokenZ = z
  .string()
  .regex(/^[a-z]+:[A-Za-z0-9._-]+$/, "citationToken must match /^[a-z]+:[A-Za-z0-9._-]+$/");

const PremiseZ = z.object({
  text: z
    .string()
    .min(1)
    .max(400)
    .refine((s) => /^[A-Z(\u201c"\u2018']/.test(s.trim()), {
      message: "premise text must begin with a capital letter (declarative sentence)",
    })
    .refine((s) => /[.!?]\s*$/.test(s.trim()), {
      message: "premise text must end with a sentence-terminating punctuation mark",
    })
    .refine((s) => !/^(and|or|but|so|because|therefore|thus|hence)\b/i.test(s.trim()), {
      message: "premise text must not begin with a leading conjunction",
    })
    .refine((s) => !/\?\s*$/.test(s.trim()), {
      message: "premise text must be declarative, not a question",
    }),
  citationToken: CitationTokenZ.nullish().transform((v) => v ?? null),
});

const ArgumentZ = z.object({
  conclusionClaimIndex: z.number().int().positive(),
  premises: z.array(PremiseZ).min(1).max(6),
  schemeKey: SchemeKeyZ,
  warrant: z.string().min(1).max(300).nullable(),
});

export type AdvocateArgument = z.infer<typeof ArgumentZ>;

// ─────────────────────────────────────────────────────────────────
// Web citations (loosened mode)
// ─────────────────────────────────────────────────────────────────
//
// In loosened-mode runs the advocates may discover sources via web search
// that aren't in the bound corpus. Each such source is declared once in
// the top-level `webCitations` array of the output and referenced from
// premises by its `token` (e.g. `web:nyhan-2023-pnas`). The translator
// (argument-mint.ts → materializeWebCitations) lazily mints a Source +
// stack item for each web citation before attaching premise citations.
export const WebCitationZ = z.object({
  token: CitationTokenZ.refine((t) => t.startsWith("web:"), {
    message: "webCitations[].token must start with 'web:' (e.g. 'web:bail-2018-pnas')",
  }),
  url: z.string().url(),
  title: z.string().min(1).max(500),
  // Tolerate the common LLM mistake of returning a single string here;
  // coerce to a one-element array before validation.
  authors: z
    .preprocess(
      (v) => (typeof v === "string" ? [v] : v),
      z.array(z.string().min(1).max(200)).max(20),
    )
    .optional(),
  publishedAt: z.string().min(4).max(40).optional(),
  /** One-sentence characterization of what the source actually says, ≤ 500 chars. */
  snippet: z.string().min(1).max(500),
  /** Optional methodology tag — mirrors the corpus item shape. */
  methodology: z
    .preprocess(
      (v) => {
        if (typeof v !== "string") return v;
        const m = v.toLowerCase().trim();
        // Tolerate common LLM variants.
        const aliases: Record<string, string> = {
          "commentary": "expert-commentary",
          "expert commentary": "expert-commentary",
          "conceptual": "theoretical",
          "theory": "theoretical",
          "experiment": "experimental",
          "field experiment": "experimental",
          "rct": "experimental",
          "quasi experimental": "quasi-experimental",
          "quasi": "quasi-experimental",
          "natural experiment": "quasi-experimental",
          "review": "systematic-review",
          "meta analysis": "meta-analysis",
          "metaanalysis": "meta-analysis",
          "internal": "internal-data",
        };
        return aliases[m] ?? v;
      },
      z.enum([
        "experimental",
        "quasi-experimental",
        "observational",
        "meta-analysis",
        "systematic-review",
        "theoretical",
        "expert-commentary",
        "internal-data",
        "other",
      ]),
    )
    .optional(),
});

export type WebCitation = z.infer<typeof WebCitationZ>;

// ─────────────────────────────────────────────────────────────────
// Refusal schema (prompt §8) — identical for A and B
// ─────────────────────────────────────────────────────────────────

export const AdvocateRefusalZ = z.object({
  error: z.enum([
    "INSUFFICIENT_EVIDENCE_FOR_POSITION",
    "TOPOLOGY_ONE_SIDED",
    "FRAMING_BLOCKS_POSITION",
  ]),
  details: z.string().max(500),
  subClaimsAttempted: z.array(z.number().int().positive()).default([]),
});

export type AdvocateRefusal = z.infer<typeof AdvocateRefusalZ>;

export function isAdvocateRefusal(r: unknown): r is AdvocateRefusal {
  return typeof (r as any)?.error === "string";
}

// ─────────────────────────────────────────────────────────────────
// Topology binding & schema factory
// ─────────────────────────────────────────────────────────────────

export interface TopologyBinding {
  /** Number of sub-claims (indices are 1..count). */
  count: number;
  /** Layer for each sub-claim, keyed by 1-based index. */
  layerByIndex: Record<number, AdvocateLayer>;
  /** Indices of hinge sub-claims (≥ 2 inbound dependsOn edges). */
  hingeIndices: number[];
}

export interface AdvocateSchemaOpts {
  advocateRole: "A" | "B";
  topology: TopologyBinding;
  allowedCitationTokens: ReadonlySet<string>;
  /** Defaults from the prompt §5; override only for testing. */
  totalArgumentsMin?: number; // default 12
  totalArgumentsMax?: number; // default 60 (loosened from 30)
  perSubClaimMin?: number; // default 2 (loosened from 3)
  perSubClaimMax?: number; // default 10 (loosened from 5)
  minSubClaimsCovered?: number; // default 5
}

/**
 * Build the parameterized Zod schema for a Phase-2 advocate output.
 * Apply the result with `.safeParse(json)`. Failures contain the precise
 * §5 rule that fired in `error.issues[i].message`.
 */
export function buildAdvocateOutputSchema(opts: AdvocateSchemaOpts) {
  const {
    advocateRole,
    topology,
    allowedCitationTokens,
    totalArgumentsMin = 12,
    totalArgumentsMax = 60,
    perSubClaimMin = 2,
    perSubClaimMax = 10,
    minSubClaimsCovered = 5,
  } = opts;

  if (topology.count < 1) {
    throw new Error("buildAdvocateOutputSchema: topology.count must be >= 1");
  }

  return z
    .object({
      phase: z.literal("2"),
      advocateRole: z.literal(advocateRole),
      arguments: z.array(ArgumentZ).min(totalArgumentsMin).max(totalArgumentsMax),
      /**
       * Loosened-mode web sources discovered via web search. Optional;
       * empty/omitted when an output cites only the bound corpus.
       */
      webCitations: z.array(WebCitationZ).max(40).optional().default([]),
    })
    .superRefine((data, ctx) => {
      // Build set of legal citation tokens for THIS output: corpus ∪ web.
      const declaredWebTokens = new Set<string>(
        (data.webCitations ?? []).map((w) => w.token),
      );
      // Every webCitations[].token must be unique within the output.
      const seenWebTokens = new Set<string>();
      for (let i = 0; i < (data.webCitations ?? []).length; i++) {
        const t = data.webCitations![i].token;
        if (seenWebTokens.has(t)) {
          ctx.addIssue({
            code: "custom",
            message: `webCitations[${i}].token "${t}" is duplicated; each web citation must declare its token exactly once`,
            path: ["webCitations", i, "token"],
          });
        }
        seenWebTokens.add(t);
      }
      // Constraint #1 is enforced by .min/.max above.

      // Build per-sub-claim grouping for #2, #3.
      const perIndex = new Map<number, number>();
      for (let i = 0; i < data.arguments.length; i++) {
        const a = data.arguments[i];

        // Conclusion index range check.
        if (a.conclusionClaimIndex < 1 || a.conclusionClaimIndex > topology.count) {
          ctx.addIssue({
            code: "custom",
            message: `arguments[${i}].conclusionClaimIndex ${a.conclusionClaimIndex} is out of range [1, ${topology.count}]`,
            path: ["arguments", i, "conclusionClaimIndex"],
          });
          continue;
        }

        perIndex.set(a.conclusionClaimIndex, (perIndex.get(a.conclusionClaimIndex) ?? 0) + 1);

        // Constraint #7: citationToken resolves (corpus OR declared web citation).
        for (let p = 0; p < a.premises.length; p++) {
          const tok = a.premises[p].citationToken;
          if (tok != null && !allowedCitationTokens.has(tok) && !declaredWebTokens.has(tok)) {
            ctx.addIssue({
              code: "custom",
              message: `arguments[${i}].premises[${p}].citationToken "${tok}" does not resolve to a bound corpus item or to a declared webCitations[].token`,
              path: ["arguments", i, "premises", p, "citationToken"],
            });
          }
        }

        // Constraint #8: scheme-layer plausibility.
        const layer = topology.layerByIndex[a.conclusionClaimIndex];
        if (layer && !isSchemeAllowedForLayer(a.schemeKey, layer)) {
          ctx.addIssue({
            code: "custom",
            message: `arguments[${i}]: schemeKey "${a.schemeKey}" is not allowed for sub-claim #${a.conclusionClaimIndex} (layer="${layer}")`,
            path: ["arguments", i, "schemeKey"],
          });
        }
      }

      // Constraint #2: coverage — ≥ minSubClaimsCovered, includes all hinges.
      const covered = new Set(perIndex.keys());
      if (covered.size < minSubClaimsCovered) {
        ctx.addIssue({
          code: "custom",
          message: `must mount arguments on at least ${minSubClaimsCovered} sub-claims; covered ${covered.size} (${[...covered].sort((a, b) => a - b).join(",")})`,
          path: ["arguments"],
        });
      }
      const missingHinges = topology.hingeIndices.filter((h) => !covered.has(h));
      if (missingHinges.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `must include all hinge sub-claims [${topology.hingeIndices.join(",")}]; missing [${missingHinges.join(",")}]`,
          path: ["arguments"],
        });
      }

      // Constraint #3: per-sub-claim 3 ≤ count ≤ 5.
      for (const [idx, n] of perIndex.entries()) {
        if (n < perSubClaimMin || n > perSubClaimMax) {
          ctx.addIssue({
            code: "custom",
            message: `sub-claim #${idx} has ${n} arguments; must be in [${perSubClaimMin}, ${perSubClaimMax}]`,
            path: ["arguments"],
          });
        }
      }
    });
}

// Convenience aliases the orchestrator imports.
export type AdvocateOutputSchema = ReturnType<typeof buildAdvocateOutputSchema>;
export type AdvocateOutput = z.infer<AdvocateOutputSchema>;

/**
 * Build a discriminated union of (output | refusal) for `safeParse` callers
 * that want to handle both shapes uniformly.
 */
export function buildAdvocateResponseSchema(opts: AdvocateSchemaOpts) {
  return z.union([buildAdvocateOutputSchema(opts), AdvocateRefusalZ]);
}
