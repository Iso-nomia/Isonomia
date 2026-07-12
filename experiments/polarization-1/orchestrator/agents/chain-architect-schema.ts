/**
 * agents/chain-architect-schema.ts
 *
 * Zod contract for the Phase-6 Chain-Architect — a single-shot read-only
 * agent that runs after Phase 5 is finalized. It consumes the full
 * dialectical record (topology, P2/P3/P4, tracker per-argument standings,
 * P5 synthesist verdict) and produces a structured plan describing one
 * `ArgumentChain` per hinge sub-claim, with nodes (argumentId + role +
 * epistemicStatus + dialecticalRole) and edges (sourceArgumentId →
 * targetArgumentId with edgeType + strength + description).
 *
 * The plan is not a write itself — the chain-mint translator consumes the
 * plan and posts to `POST /api/argument-chains`, then bulk POSTs nodes
 * and edges, mapping per-chain `argumentId → nodeId` so edges can be
 * created in a second pass.
 *
 * Contract notes:
 *   • All `argumentId` references must resolve in `knownArgumentIds` (P2,
 *     P3 rebuttals, P3-round2 rebuttals, or P4 defense/narrow-variant
 *     argument ids).
 *   • For each chain the same `argumentId` may appear at most once in the
 *     `nodes[]` array (matches `@@unique([chainId, argumentId])` on
 *     `ArgumentChainNode`).
 *   • Edges must reference argumentIds that appear in the same chain's
 *     `nodes[]`. Self-loops are rejected.
 *   • `chainType` is fixed to `TREE` per the Phase-6 product decision
 *     (one TREE per hinge sub-claim — see runtime/COMPARISON.md +
 *     copilot session notes).
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────
// Enum vocabularies (must mirror prisma `lib/models/schema.prisma`)
// ─────────────────────────────────────────────────────────────────

export const ChainNodeRoleZ = z.enum([
  "PREMISE",
  "EVIDENCE",
  "CONCLUSION",
  "OBJECTION",
  "REBUTTAL",
  "QUALIFIER",
  "COMMENT",
]);
export type ChainNodeRole = z.infer<typeof ChainNodeRoleZ>;

export const EpistemicStatusZ = z.enum([
  "ASSERTED",
  "HYPOTHETICAL",
  "COUNTERFACTUAL",
  "CONDITIONAL",
  "QUESTIONED",
  "DENIED",
  "SUSPENDED",
]);
export type EpistemicStatus = z.infer<typeof EpistemicStatusZ>;

export const DialecticalRoleZ = z.enum([
  "THESIS",
  "ANTITHESIS",
  "SYNTHESIS",
  "OBJECTION",
  "RESPONSE",
  "CONCESSION",
]);
export type DialecticalRole = z.infer<typeof DialecticalRoleZ>;

export const ArgumentChainEdgeTypeZ = z.enum([
  "SUPPORTS",
  "ENABLES",
  "PRESUPPOSES",
  "REFUTES",
  "QUALIFIES",
  "EXEMPLIFIES",
  "GENERALIZES",
  "REBUTS",
  "UNDERCUTS",
  "UNDERMINES",
]);
export type ArgumentChainEdgeType = z.infer<typeof ArgumentChainEdgeTypeZ>;

// ─────────────────────────────────────────────────────────────────
// Sub-shapes
// ─────────────────────────────────────────────────────────────────

const ChainNodePlanZ = z.object({
  argumentId: z.string().min(4),
  role: ChainNodeRoleZ,
  epistemicStatus: EpistemicStatusZ,
  dialecticalRole: DialecticalRoleZ.optional(),
  /** 50-300 char justification — name the tracker standing or P3/P4 move
   *  that warrants this node's role + epistemic status. */
  rationale: z.string().min(40).max(400),
});
export type ChainNodePlan = z.infer<typeof ChainNodePlanZ>;

const ChainEdgePlanZ = z.object({
  sourceArgumentId: z.string().min(4),
  targetArgumentId: z.string().min(4),
  edgeType: ArgumentChainEdgeTypeZ,
  strength: z.number().min(0).max(1),
  /** 30-300 char description — name the warrant or attack channel. */
  description: z.string().min(30).max(400),
});
export type ChainEdgePlan = z.infer<typeof ChainEdgePlanZ>;

const SingleChainPlanZ = z.object({
  hingeIndex: z.number().int().nonnegative(),
  /** ≤ 255 chars — DB constraint on `ArgumentChain.name`. */
  name: z.string().min(8).max(240),
  /** 80-1500 chars — what the chain represents. */
  description: z.string().min(80).max(1500),
  /** 60-800 chars — what the chain is FOR (interpretive purpose). */
  purpose: z.string().min(60).max(800),
  chainType: z.literal("TREE"),
  nodes: z.array(ChainNodePlanZ).min(2).max(40),
  edges: z.array(ChainEdgePlanZ).min(1).max(80),
  /** 200-1500 char narrative summary — used to render CHAINS.md. */
  chainSummary: z.string().min(200).max(1500),
});
export type SingleChainPlan = z.infer<typeof SingleChainPlanZ>;

// ─────────────────────────────────────────────────────────────────
// Top-level shape
// ─────────────────────────────────────────────────────────────────

const ChainArchitectPlanZ = z.object({
  phase: z.literal("6-chain-architect"),
  chains: z.array(SingleChainPlanZ).min(1).max(8),
});
export type ChainArchitectPlan = z.infer<typeof ChainArchitectPlanZ>;

// ─────────────────────────────────────────────────────────────────
// Refusal
// ─────────────────────────────────────────────────────────────────

export const ChainArchitectRefusalZ = z.object({
  error: z.enum([
    "RECORD_INCOMPLETE",
    "INSUFFICIENT_DIALECTICAL_MOVEMENT",
    "FRAMING_AMBIGUOUS",
  ]),
  details: z.string().max(500),
});
export type ChainArchitectRefusal = z.infer<typeof ChainArchitectRefusalZ>;

export function isChainArchitectRefusal(r: unknown): r is ChainArchitectRefusal {
  return (
    typeof (r as any)?.error === "string" &&
    !Array.isArray((r as any)?.chains)
  );
}

// ─────────────────────────────────────────────────────────────────
// Schema-binding inputs from the orchestrator
// ─────────────────────────────────────────────────────────────────

export interface ChainArchitectSchemaOpts {
  /** All argumentIds the architect may reference: P2 args (both sides),
   *  P3 rebuttals (both + methodologist), P3-round2 rebuttals when
   *  iter-3 multi-round, P4 defense and narrow-variant argumentIds. */
  knownArgumentIds: ReadonlySet<string>;
  /** Hinge sub-claim indices from the topology. Each `chains[].hingeIndex`
   *  must be in this set. */
  hingeIndices: ReadonlySet<number>;
}

// ─────────────────────────────────────────────────────────────────
// Parameterized schema builder (mirrors synthesist-schema pattern)
// ─────────────────────────────────────────────────────────────────

export function buildChainArchitectPlanSchema(opts: ChainArchitectSchemaOpts) {
  return ChainArchitectPlanZ.superRefine((plan, ctx) => {
    const seenHingeIndices = new Set<number>();
    plan.chains.forEach((chain, ci) => {
      // 1. Hinge index in scope.
      if (!opts.hingeIndices.has(chain.hingeIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chains", ci, "hingeIndex"],
          message: `hingeIndex ${chain.hingeIndex} is not a hinge sub-claim. Allowed: [${[...opts.hingeIndices].sort((a, b) => a - b).join(", ")}].`,
        });
      }
      // 2. One chain per hinge.
      if (seenHingeIndices.has(chain.hingeIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chains", ci, "hingeIndex"],
          message: `duplicate chain for hingeIndex ${chain.hingeIndex} — emit at most one chain per hinge.`,
        });
      }
      seenHingeIndices.add(chain.hingeIndex);

      // 3. Node argumentIds resolve and are unique per-chain.
      const seenNodeArgIds = new Set<string>();
      chain.nodes.forEach((node, ni) => {
        if (!opts.knownArgumentIds.has(node.argumentId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["chains", ci, "nodes", ni, "argumentId"],
            message: `argumentId "${node.argumentId}" not found in the deliberation record.`,
          });
        }
        if (seenNodeArgIds.has(node.argumentId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["chains", ci, "nodes", ni, "argumentId"],
            message: `argumentId "${node.argumentId}" appears more than once in this chain (chain nodes must be unique per argumentId).`,
          });
        }
        seenNodeArgIds.add(node.argumentId);
      });

      // 4. Edges reference nodes that exist in the chain; no self-loops.
      const chainArgIds = new Set(chain.nodes.map((n) => n.argumentId));
      chain.edges.forEach((edge, ei) => {
        if (edge.sourceArgumentId === edge.targetArgumentId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["chains", ci, "edges", ei],
            message: `edge sourceArgumentId === targetArgumentId; self-loops are rejected.`,
          });
        }
        if (!chainArgIds.has(edge.sourceArgumentId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["chains", ci, "edges", ei, "sourceArgumentId"],
            message: `sourceArgumentId "${edge.sourceArgumentId}" is not in this chain's nodes[].`,
          });
        }
        if (!chainArgIds.has(edge.targetArgumentId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["chains", ci, "edges", ei, "targetArgumentId"],
            message: `targetArgumentId "${edge.targetArgumentId}" is not in this chain's nodes[].`,
          });
        }
      });

      // 5. Edge uniqueness on (source, target) — matches DB unique index.
      const seenEdgePairs = new Set<string>();
      chain.edges.forEach((edge, ei) => {
        const key = `${edge.sourceArgumentId}→${edge.targetArgumentId}`;
        if (seenEdgePairs.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["chains", ci, "edges", ei],
            message: `duplicate edge ${key} — at most one edge per (source, target) pair.`,
          });
        }
        seenEdgePairs.add(key);
      });
    });
  });
}
