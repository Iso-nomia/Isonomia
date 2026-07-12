// lib/schemes/cq-cross-references.ts
//
// Item 2 of the practical-reasoning enhancements
// (RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/11b-practical-reasoning-enhancements-2026-06-12.md):
// typed CQ → scheme cross-references.
//
// Some critical questions, when raised, are not bare challenges that terminate —
// they *open another argumentation scheme*. The canonical case (Macagno, Walton
// & Reed) is that Practical Reasoning's side-effects CQ (CQ5) *is* argument from
// negative consequences. This module declares those edges as **catalogue-level
// metadata** (a fact about the scheme catalogue, identical across every instance
// and room), so no per-row DB column and no migration is required.
//
// Two relation kinds:
//   • "opens"     — raising the CQ introduces an instance of `refScheme` whose own
//                CQs then apply (the CQ-of-CQ recursion edge). This is the edge
//                set relevant to Q-017 (CQ-of-CQ termination).
//   • "competes" — the CQ invites a *competing* instance of `refScheme` over the
//                same claim (e.g. "is there a better alternative?"). Relevant to
//                item 6 (alternatives as linked competing claims), NOT to
//                recursion depth — a competing instance does not nest the original
//                argument's CQs.
//
// TERMINOLOGY (deliberate): this `competes` relation is a *generative/constructive*
// affordance over the SAME scheme (PR.ALTERNATIVES → another `practical_reasoning`
// for a different action), and is NOT the programme's "scheme-rivalry" notion.
// C009 / Q-016 "scheme-rivalry" is a candidate fourth *attack* category between
// TWO DISTINCT schemes over one claim with disjoint behaviours (⟦S₁⟧ ∩ ⟦S₂⟧ = ∅) —
// an incoherence relation, the opposite direction from this constructive one.
// "rival"/"rivalry" is reserved for that C009 attack sense across the programme;
// this module uses "competes" to avoid the collision.
//
// Q-017 handle (the honest finding): the `opens`-graph over the production
// practical-reasoning family is **finite but NOT acyclic** — `positive_consequences`
// and `negative_consequences` form a 2-cycle (NC's "are there offsetting benefits?"
// → PC, and PC's "overlooked harms?" → NC). So CQ-of-CQ termination cannot rely on
// acyclicity; it relies on the graph being finite plus a visited-set over
// (scheme, claim) pairs (re-opening the same scheme over the same claim is a
// no-op, the CQ instance already exists). See `analyzeRecursionTermination`.

export type CqCrossRefRelation = "opens" | "competes";

export interface CqCrossReference {
  /** The scheme whose CQ carries the cross-reference. */
  fromScheme: string;
  /** The cqKey on `fromScheme` that carries it. */
  fromCq: string;
  /** The scheme the CQ points at. */
  refScheme: string;
  relation: CqCrossRefRelation;
  /** Why this edge exists (provenance for the catalogue fact). */
  rationale: string;
}

/**
 * The cross-reference edges for the practical-reasoning family.
 *
 * cqKeys are the canonical ones owned by scripts/seed.practical-reasoning.ts
 * (the reconciled source of truth — see 11b item 1). Only edges justified by the
 * canonical CQ text are declared.
 */
export const CQ_CROSS_REFERENCES: readonly CqCrossReference[] = [
  // Practical Reasoning
  {
    fromScheme: "practical_reasoning",
    fromCq: "PR.SIDE_EFFECTS",
    refScheme: "negative_consequences",
    relation: "opens",
    rationale:
      "Walton CQ5 (side-effects) IS argument from negative consequences: 'Do negative consequences of A outweigh achieving G?'",
  },
  {
    fromScheme: "practical_reasoning",
    fromCq: "PR.ALTERNATIVES",
    refScheme: "practical_reasoning",
    relation: "competes",
    rationale:
      "'Is there a better alternative than A to achieve G?' invites a competing practical-reasoning instance for the alternative action.",
  },

  // Positive Consequences
  {
    fromScheme: "positive_consequences",
    fromCq: "PC.NEG_SIDE",
    refScheme: "negative_consequences",
    relation: "opens",
    rationale:
      "'Are there overlooked negative side-effects outweighing the good?' opens an argument from negative consequences.",
  },

  // Negative Consequences
  {
    fromScheme: "negative_consequences",
    fromCq: "NC.TRADEOFFS",
    refScheme: "positive_consequences",
    relation: "opens",
    rationale:
      "'Are there benefits that outweigh the bad effects?' opens an argument from positive consequences.",
  },

  // Value-based Practical Reasoning
  {
    fromScheme: "value_based_pr",
    fromCq: "VB.CONFLICT",
    refScheme: "value_based_pr",
    relation: "competes",
    rationale:
      "'Is there a conflicting/weightier value overriding V?' invites a competing value-based instance over a different value.",
  },
] as const;

/** All cross-references carried by a given (schemeKey, cqKey). */
export function getCqCrossReferences(
  schemeKey: string,
  cqKey: string
): CqCrossReference[] {
  return CQ_CROSS_REFERENCES.filter(
    (e) => e.fromScheme === schemeKey && e.fromCq === cqKey
  );
}

/** All cross-references carried by any CQ of a given scheme. */
export function getSchemeCrossReferences(schemeKey: string): CqCrossReference[] {
  return CQ_CROSS_REFERENCES.filter((e) => e.fromScheme === schemeKey);
}

// ---------------------------------------------------------------------------
// Q-017 handle: recursion-termination analysis over the `opens`-graph.
// ---------------------------------------------------------------------------

export interface RecursionTerminationReport {
  /** Always true for the production catalogue (finite schemes × finite CQs). */
  finite: true;
  /** Whether the `opens`-graph is acyclic. */
  acyclic: boolean;
  /** Scheme-level cycles in the `opens`-graph, each as an ordered key list. */
  cycles: string[][];
  /**
   * The termination guarantee in force: "acyclic" when no cycles exist,
   * otherwise "visited-set" (finite graph + dedupe over (scheme, claim) pairs).
   */
  guarantee: "acyclic" | "visited-set";
  note: string;
}

/** Scheme-level adjacency restricted to `opens` edges (the recursion edges). */
export function buildOpensGraph(
  edges: readonly CqCrossReference[] = CQ_CROSS_REFERENCES
): Map<string, Set<string>> {
  const g = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.relation !== "opens") continue;    if (!g.has(e.fromScheme)) g.set(e.fromScheme, new Set());
    g.get(e.fromScheme)!.add(e.refScheme);
  }
  return g;
}

/**
 * Find scheme-level cycles in the `opens`-graph via Tarjan's strongly-connected
 * components (any SCC of size > 1, or a self-loop, is a cycle).
 */
export function findOpensCycles(
  edges: readonly CqCrossReference[] = CQ_CROSS_REFERENCES
): string[][] {
  const g = buildOpensGraph(edges);
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let counter = 0;

  const nodes = new Set<string>();
  for (const [from, tos] of g) {
    nodes.add(from);
    for (const to of tos) nodes.add(to);
  }

  const strongconnect = (v: string) => {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of g.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }

    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      // Report a component as a cycle if it has >1 node or a self-loop.
      const selfLoop = comp.length === 1 && (g.get(comp[0])?.has(comp[0]) ?? false);
      if (comp.length > 1 || selfLoop) sccs.push(comp.reverse());
    }
  };

  for (const v of nodes) if (!index.has(v)) strongconnect(v);
  return sccs;
}

/**
 * The Q-017 input: characterise whether CQ-of-CQ expansion over the cross-
 * reference graph terminates, and under what guarantee.
 */
export function analyzeRecursionTermination(
  edges: readonly CqCrossReference[] = CQ_CROSS_REFERENCES
): RecursionTerminationReport {
  const cycles = findOpensCycles(edges);
  const acyclic = cycles.length === 0;
  return {
    finite: true,
    acyclic,
    cycles,
    guarantee: acyclic ? "acyclic" : "visited-set",
    note: acyclic
      ? "opens-graph is a finite DAG; CQ-of-CQ expansion terminates by acyclicity."
      : "opens-graph is finite but contains a cycle; termination requires a visited-set over (scheme, claim) pairs (re-opening a scheme over the same claim is a no-op).",
  };
}
