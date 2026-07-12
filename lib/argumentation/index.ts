// lib/argumentation/index.ts
//
// Single public surface for the Dung abstract-argumentation (AF) engine.
//
// Phase 0 (consolidation) of the argumentation-semantics roadmap:
// `Development and Ideation Documents/ARCHITECTURE/ARGUMENTATION_SEMANTICS_CONSOLIDATION_ROADMAP.md`.
//
// Historically, grounded/preferred/labelling were reimplemented in ≥ 3 places
// and inline copies in app/api/.../route.ts. This module is the engine of
// record: all call sites import from `@/lib/argumentation` and the duplicate
// engines have been removed (Phase 4c).
//
// Two graph representations coexist (both re-exported here):
//   • attack-map  — `Map<NodeID, Set<NodeID>>`
//   • edge-list   — `Array<[string, string]>`
//
// Both surface shapes are translated to the labelling-based core in
// `./adapters`; the former standalone `lib/deepdive/af.ts` and
// `lib/argumentation/afEngine.ts` engines were removed in Phase 4c.

// ----------------------------------------------------------------------------
// Attack-map representation (Map<NodeID, Set<NodeID>>)
// ----------------------------------------------------------------------------

import type { NodeID } from "@/lib/argumentation/adapters";
import { preferredExtensions as preferredExtensionsImpl } from "@/lib/argumentation/adapters";

export type { NodeID, Edge } from "@/lib/argumentation/adapters";
export { buildAttackGraph, preferredExtensions } from "@/lib/argumentation/adapters";

/**
 * Grounded extension over the attack-map representation — the least fixpoint of
 * Dung's characteristic function F(S) = { a | every attacker of a is attacked
 * by S }, starting from ∅.
 *
 * This is the canonical copy. It replaces the byte-identical inline definitions
 * previously carried in `app/api/deliberations/[id]/dialectic/route.ts` and
 * `app/api/sheets/[id]/route.ts`.
 *
 * Exact and poly-time; terminates in ≤ |nodes| iterations (the acceptability
 * computation is a finite Knaster–Tarski fixpoint — see the cyclic-defeat
 * closure, Q-031).
 */
export function groundedExtension(
  nodes: NodeID[],
  attackMap: Map<NodeID, Set<NodeID>>
): Set<NodeID> {
  const attackersOf = (x: NodeID): Set<NodeID> => {
    const res = new Set<NodeID>();
    for (const [a, tos] of attackMap) if (tos.has(x)) res.add(a);
    return res;
  };
  const sAttacks = (S: Set<NodeID>, y: NodeID): boolean => {
    for (const a of S) if (attackMap.get(a)?.has(y)) return true;
    return false;
  };

  let S = new Set<NodeID>(); // start from ∅
  for (;;) {
    const F = new Set<NodeID>();
    for (const a of nodes) {
      const atks = attackersOf(a);
      const defended = [...atks].every((b) => sAttacks(S, b));
      if (defended) F.add(a);
    }
    if (F.size === S.size && [...F].every((x) => S.has(x))) return F; // fixpoint
    S = F;
  }
}

/**
 * IN/OUT/UNDEC labelling derived from a single extension over the attack-map
 * representation. IN = E; OUT = attacked by E; UNDEC = everything else.
 */
export function labelingFromAttackMap(
  nodes: NodeID[],
  attackMap: Map<NodeID, Set<NodeID>>,
  extension: Set<NodeID>
): { IN: Set<NodeID>; OUT: Set<NodeID>; UNDEC: Set<NodeID> } {
  const IN = new Set(extension);
  const OUT = new Set<NodeID>();
  for (const [att, tos] of attackMap) {
    if (IN.has(att)) for (const t of tos) if (!IN.has(t)) OUT.add(t);
  }
  const UNDEC = new Set<NodeID>();
  for (const n of nodes) if (!IN.has(n) && !OUT.has(n)) UNDEC.add(n);
  return { IN, OUT, UNDEC };
}

/**
 * Skeptical acceptance under preferred semantics over the attack-map
 * representation: the arguments in *every* preferred extension.
 */
export function skepticalPreferred(
  nodes: NodeID[],
  attackMap: Map<NodeID, Set<NodeID>>,
  extensions?: Set<NodeID>[]
): Set<NodeID> {
  const exts: Set<NodeID>[] = extensions ?? preferredExtensionsImpl(nodes, attackMap) ?? [];
  const inAll = new Set<NodeID>();
  if (exts.length > 0) {
    for (const n of exts[0]) if (exts.every((s) => s.has(n))) inAll.add(n);
  }
  return inAll;
}

// ----------------------------------------------------------------------------
// Edge-list representation (Array<[string, string]>)
// ----------------------------------------------------------------------------

export type { AFNode, AFEdge, AF, EdgeType, BuildOptions } from "@/lib/argumentation/adapters";
export {
  projectToAF,
  conflictFree,
  defends,
  characteristicF,
  isAdmissible,
  grounded,
  preferred,
  labelingFromExtension,
} from "@/lib/argumentation/adapters";

// ----------------------------------------------------------------------------
// Labelling core (Phase 1) — the engine of record's exact, semantics-complete
// surface. Operates on the representation-neutral `DefeatGraph`; build one with
// `toDefeatGraphFromEdgeList` / `toDefeatGraphFromAttackMap`.
// ----------------------------------------------------------------------------

export type { Label, ArgId, Labelling, DefeatGraph } from "@/lib/argumentation/types";
export {
  toDefeatGraphFromEdgeList,
  toDefeatGraphFromAttackMap,
  groundedLabelling,
  groundedExtension as groundedExtensionDG,
  labellingOf,
  labellingToSets,
} from "@/lib/argumentation/labelling";
export {
  completeExtensions,
  preferredExtensions as preferredExtensionsDG,
  stableExtensions,
  semiStableExtensions,
} from "@/lib/argumentation/semantics";

// ----------------------------------------------------------------------------
// ASPIC+ instantiation contract (Phase 2) — structured layer → shared core.
// ----------------------------------------------------------------------------

export type { InstantiableArgument, InstantiableDefeat } from "@/lib/argumentation/instantiate";
export { instantiateDefeatGraph } from "@/lib/argumentation/instantiate";
export { groundedLabellingDetailed } from "@/lib/argumentation/labelling";

// ----------------------------------------------------------------------------
// Typed bridge (Phase 3) — level separation (C4) + provenance (C3).
// ----------------------------------------------------------------------------

export type { Provenance, Preference } from "@/lib/argumentation/types";
export type { FiniteArgumentSet } from "@/lib/argumentation/acceptability";
export {
  liftToPowerSet,
  joinArgumentSets,
  joinAll,
  nodesOf,
  acceptability,
  provenanceOf,
  unverifiedArguments,
  isCanonicalPersistable,
  assertCanonicalPersistable,
  partitionByProvenance,
} from "@/lib/argumentation/acceptability";

// ----------------------------------------------------------------------------
// Performance & policy (Phase 4) — incremental relabelling + semantics policy.
// ----------------------------------------------------------------------------

export type { IncrementalResult } from "@/lib/argumentation/incremental";
export {
  relabelOnExtend,
  relabelFrom,
  dirtySeed,
  affectedRegion,
} from "@/lib/argumentation/incremental";

export type { SemanticsPolicy } from "@/lib/argumentation/policy";
export {
  SEMANTICS_POLICIES,
  DEFAULT_SEMANTICS_POLICY,
  isSemanticsPolicy,
  resolveSemanticsPolicy,
  policyLabelling,
} from "@/lib/argumentation/policy";
