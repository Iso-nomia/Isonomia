/**
 * agents/claim-analyst-schema.ts
 *
 * Zod contract for the Claim Analyst's structured output, plus the graph
 * helpers (`computeMaxDepth`, `hasCycle`) referenced by the schema's
 * `superRefine` block.
 *
 * The hard-validation pass enforces every constraint listed in
 * `prompts/1-claim-analyst.md` §5. Soft-track checks (cosine restatement,
 * hinge identification, layer balance) live in `phases/phase-1-topology.ts`
 * because they emit `review_flag` events rather than aborting the run.
 */

import { z } from "zod";

// Mirror lib/models/schema.prisma's AcademicClaimType. No DEFINITIONAL.
export const AcademicClaimTypeZ = z.enum([
  "EMPIRICAL",
  "NORMATIVE",
  "CONCEPTUAL",
  "CAUSAL",
  "METHODOLOGICAL",
  "INTERPRETIVE",
  "HISTORICAL",
  "COMPARATIVE",
  "META",
  "THESIS",
]);

export const LayerZ = z.enum(["definitional", "empirical", "causal", "normative"]);

const LAYER_TO_ALLOWED_CLAIM_TYPES: Record<z.infer<typeof LayerZ>, z.infer<typeof AcademicClaimTypeZ>[]> = {
  definitional: ["CONCEPTUAL"],
  empirical: ["EMPIRICAL", "HISTORICAL", "COMPARATIVE", "METHODOLOGICAL"],
  causal: ["CAUSAL"],
  normative: ["NORMATIVE", "INTERPRETIVE"],
};

const SubClaimZ = z.object({
  index: z.number().int().positive(),
  text: z.string().min(20).max(500),
  claimType: AcademicClaimTypeZ,
  layer: LayerZ,
  tags: z.array(z.string()).max(8).default([]),
  dependsOn: z.array(z.number().int().positive()).max(2).default([]),
  rationale: z.string().min(20).max(300),
});

export type SubClaim = z.infer<typeof SubClaimZ>;

export const ClaimAnalystOutputZ = z
  .object({
    phase: z.literal("1"),
    centralClaim: z.string().min(20).max(1000),
    subClaims: z.array(SubClaimZ).min(6).max(10),
  })
  .superRefine((data, ctx) => {
    const indices = data.subClaims.map((s) => s.index).sort((a, b) => a - b);

    // Sequential 1..N, no duplicates, no gaps.
    indices.forEach((idx, i) => {
      if (idx !== i + 1) {
        ctx.addIssue({
          code: "custom",
          message: `subClaims indices must be 1..N sequential with no duplicates; got [${indices.join(",")}]`,
          path: ["subClaims"],
        });
      }
    });

    const valid = new Set(indices);

    // dependsOn → no self-deps, references existing indices.
    for (const sc of data.subClaims) {
      for (const dep of sc.dependsOn) {
        if (dep === sc.index) {
          ctx.addIssue({
            code: "custom",
            message: `subClaim #${sc.index} depends on itself`,
            path: ["subClaims"],
          });
        } else if (!valid.has(dep)) {
          ctx.addIssue({
            code: "custom",
            message: `subClaim #${sc.index} depends on missing index ${dep}`,
            path: ["subClaims"],
          });
        }
      }
    }

    // No cycles.
    if (hasCycle(data.subClaims)) {
      ctx.addIssue({
        code: "custom",
        message: `dependency graph contains a cycle`,
        path: ["subClaims"],
      });
    }

    // Depth ≤ 6.
    const depth = computeMaxDepth(data.subClaims);
    if (depth > 6) {
      ctx.addIssue({
        code: "custom",
        message: `dependency graph depth ${depth} exceeds 6`,
        path: ["subClaims"],
      });
    }

    // claimType ↔ layer.
    for (const sc of data.subClaims) {
      const allowed = LAYER_TO_ALLOWED_CLAIM_TYPES[sc.layer];
      if (!allowed.includes(sc.claimType)) {
        ctx.addIssue({
          code: "custom",
          message: `subClaim #${sc.index}: claimType "${sc.claimType}" not allowed in layer "${sc.layer}". Allowed: ${allowed.join(", ")}`,
          path: ["subClaims"],
        });
      }
    }

    // All four layers covered.
    const layers = new Set(data.subClaims.map((s) => s.layer));
    for (const required of ["definitional", "empirical", "causal", "normative"] as const) {
      if (!layers.has(required)) {
        ctx.addIssue({
          code: "custom",
          message: `layer "${required}" has no sub-claim — every layer must be covered`,
          path: ["subClaims"],
        });
      }
    }

    // No evidence citations in text/rationale (DOI / src: / URL / author-year).
    const banned = /(doi:|https?:\/\/|src:[a-f0-9]{6,})/i;
    for (const sc of data.subClaims) {
      if (banned.test(sc.text) || banned.test(sc.rationale)) {
        ctx.addIssue({
          code: "custom",
          message: `subClaim #${sc.index} contains an evidence citation (URL/DOI/src token); citations belong in Phase 2`,
          path: ["subClaims"],
        });
      }
    }
  });

export type ClaimAnalystOutput = z.infer<typeof ClaimAnalystOutputZ>;

export const ClaimAnalystRefusalZ = z.object({
  error: z.enum([
    "FRAMING_AMBIGUOUS",
    "CENTRAL_CLAIM_PRESUPPOSES_CONTESTED_DEFINITION",
    "INSUFFICIENT_EVIDENCE_DOMAINS",
  ]),
  details: z.string().max(500),
  suggestedFraming: z.string().nullable().optional(),
});

export type ClaimAnalystRefusal = z.infer<typeof ClaimAnalystRefusalZ>;

export const ClaimAnalystResponseZ = z.union([ClaimAnalystOutputZ, ClaimAnalystRefusalZ]);
export type ClaimAnalystResponse = z.infer<typeof ClaimAnalystResponseZ>;

export function isRefusal(r: ClaimAnalystResponse): r is ClaimAnalystRefusal {
  return typeof (r as any)?.error === "string";
}

// ─────────────────────────────────────────────────────────────────
// Graph helpers
// ─────────────────────────────────────────────────────────────────

/** DFS cycle detection on the dependsOn graph. */
export function hasCycle(subClaims: Array<{ index: number; dependsOn: number[] }>): boolean {
  const adj = new Map<number, number[]>();
  for (const sc of subClaims) adj.set(sc.index, sc.dependsOn);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<number, number>();
  for (const sc of subClaims) color.set(sc.index, WHITE);
  const dfs = (n: number): boolean => {
    color.set(n, GRAY);
    for (const m of adj.get(n) ?? []) {
      const c = color.get(m) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE && dfs(m)) return true;
    }
    color.set(n, BLACK);
    return false;
  };
  for (const sc of subClaims) {
    if ((color.get(sc.index) ?? WHITE) === WHITE && dfs(sc.index)) return true;
  }
  return false;
}

/**
 * Longest path length in the dependsOn DAG (counting nodes — depth 1 = leaf,
 * depth 2 = leaf with one upstream, etc.). Returns Infinity if a cycle is
 * present (caller should run `hasCycle` first to surface the friendlier
 * error message).
 */
export function computeMaxDepth(subClaims: Array<{ index: number; dependsOn: number[] }>): number {
  const adj = new Map<number, number[]>();
  for (const sc of subClaims) adj.set(sc.index, sc.dependsOn);
  const memo = new Map<number, number>();
  const onStack = new Set<number>();
  const depth = (n: number): number => {
    if (onStack.has(n)) return Infinity;
    const cached = memo.get(n);
    if (cached !== undefined) return cached;
    onStack.add(n);
    const ups = adj.get(n) ?? [];
    let d = 1;
    for (const u of ups) d = Math.max(d, 1 + depth(u));
    onStack.delete(n);
    memo.set(n, d);
    return d;
  };
  let max = 0;
  for (const sc of subClaims) max = Math.max(max, depth(sc.index));
  return max;
}
