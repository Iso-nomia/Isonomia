/**
 * Chain topology resolver — PART 4 (CHAIN_TOPOLOGY_OVER_MCP_SPEC.md §4).
 *
 * Pure, side-effect-free functions that turn a chain's link count plus an
 * optional declared edge set into:
 *   - a resolved, validated edge set (in link-index space),
 *   - a `chainType` DERIVED from the support sub-graph (the no-lying-label
 *     guard, §4.3 — the stored type can never disagree with the wires),
 *   - a DAG / acyclicity verdict over the support sub-graph (§4.4),
 *   - the support-root index, and any advisory warnings.
 *
 * The route maps link indices → real `ArgumentChainNode` ids after creating the
 * nodes; this module never touches the database.
 *
 * Step 1 scope: support / inference edges + type derivation + DAG validation.
 * Attack authoring (`attacksNode` / `attacksEdge`, `targetType = EDGE`) lands in
 * Steps 3–4; attack edge types are already admitted here and are excluded from
 * the support sub-graph the derivation and DAG check operate over.
 */

export const CHAIN_EDGE_TYPES = [
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
] as const;

export type ChainEdgeType = (typeof CHAIN_EDGE_TYPES)[number];

export type DerivedChainType =
  | "SERIAL"
  | "CONVERGENT"
  | "DIVERGENT"
  | "TREE"
  | "GRAPH";

/** Edges that carry inferential support (and thread claims). Attack edges are
 * dialectical and are excluded from the support sub-graph. */
const SUPPORT_EDGE_TYPES = new Set<ChainEdgeType>([
  "SUPPORTS",
  "ENABLES",
  "PRESUPPOSES",
]);

export function isSupportEdgeType(t: ChainEdgeType): boolean {
  return SUPPORT_EDGE_TYPES.has(t);
}

export interface TopologyEdgeInput {
  from: number;
  to: number;
  edgeType?: ChainEdgeType;
  strength?: number;
  description?: string;
}

export interface ResolvedEdge {
  from: number;
  to: number;
  edgeType: ChainEdgeType;
  strength: number;
  description?: string;
}

export interface TopologyWarning {
  code: string;
  detail: string;
}

export type TopologyResult =
  | {
      ok: true;
      resolvedEdges: ResolvedEdge[];
      derivedChainType: DerivedChainType;
      rootIndex: number;
      supportEdgeCount: number;
      attackEdgeCount: number;
      warnings: TopologyWarning[];
    }
  | {
      ok: false;
      code:
        | "CHAIN_EDGE_INVALID_INDEX"
        | "CHAIN_CYCLE_DETECTED"
        | "CHAIN_TYPE_MISMATCH";
      detail: string;
      derivedChainType?: DerivedChainType;
    };

/**
 * Resolve and validate a chain's topology.
 *
 * @param linkCount number of links (nodes), indexed 0..linkCount-1
 * @param edges     optional declared edge set; omitted ⇒ serial SUPPORTS spine
 * @param expectChainType optional caller pin; mismatch ⇒ CHAIN_TYPE_MISMATCH
 */
export function resolveChainTopology(
  linkCount: number,
  edges: TopologyEdgeInput[] | undefined,
  expectChainType?: DerivedChainType,
): TopologyResult {
  const warnings: TopologyWarning[] = [];

  // 1. Resolve the edge set. Omitted ⇒ the PART-3 serial SUPPORTS spine
  //    (0→1→…→N-1), so every legacy payload keeps its exact meaning.
  let resolved: ResolvedEdge[];
  if (!edges || edges.length === 0) {
    resolved = [];
    for (let i = 0; i < linkCount - 1; i++) {
      resolved.push({ from: i, to: i + 1, edgeType: "SUPPORTS", strength: 1.0 });
    }
  } else {
    // Validate indices, reject self-edges, dedup directed pairs (the DB unique
    // key is [chainId, sourceNodeId, targetNodeId], so a directed pair is
    // unique — the first declaration of a pair wins).
    const seenPairs = new Set<string>();
    resolved = [];
    for (const e of edges) {
      if (
        !Number.isInteger(e.from) ||
        !Number.isInteger(e.to) ||
        e.from < 0 ||
        e.to < 0 ||
        e.from >= linkCount ||
        e.to >= linkCount
      ) {
        return {
          ok: false,
          code: "CHAIN_EDGE_INVALID_INDEX",
          detail: `Edge (${e.from} → ${e.to}) references a link index outside the range 0..${linkCount - 1}.`,
        };
      }
      if (e.from === e.to) {
        return {
          ok: false,
          code: "CHAIN_EDGE_INVALID_INDEX",
          detail: `Edge (${e.from} → ${e.to}) is a self-loop; a link cannot support itself.`,
        };
      }
      const key = `${e.from}->${e.to}`;
      if (seenPairs.has(key)) continue; // dedup; first wins
      seenPairs.add(key);
      resolved.push({
        from: e.from,
        to: e.to,
        edgeType: e.edgeType ?? "SUPPORTS",
        strength: typeof e.strength === "number" ? e.strength : 1.0,
        description: e.description,
      });
    }
  }

  const supportEdges = resolved.filter((e) => isSupportEdgeType(e.edgeType));
  const attackEdges = resolved.filter((e) => !isSupportEdgeType(e.edgeType));

  // 2. DAG / acyclicity over the support sub-graph (Kahn). Attack edges are
  //    excluded — a rebuttal pointing back at an earlier node is legitimate.
  const cycle = detectSupportCycle(linkCount, supportEdges);
  if (cycle) {
    return {
      ok: false,
      code: "CHAIN_CYCLE_DETECTED",
      detail: `The support sub-graph contains a cycle (${cycle.join(" → ")}); argument support must be acyclic.`,
    };
  }

  // 3. Derive the chain type from the support sub-graph (§4.3).
  const { derivedChainType, rootIndex, multipleRoots } = deriveChainType(
    linkCount,
    supportEdges,
  );

  if (multipleRoots) {
    warnings.push({
      code: "chain_multiple_roots",
      detail: `The support sub-graph has more than one root (in-degree-0 node); link ${rootIndex + 1} was chosen as the chain root.`,
    });
  }

  // 4. The no-lying-label guard: a caller pin must match the wires.
  if (expectChainType && expectChainType !== derivedChainType) {
    return {
      ok: false,
      code: "CHAIN_TYPE_MISMATCH",
      detail: `Declared chainType '${expectChainType}' disagrees with the structure of the declared edges (derived '${derivedChainType}'). Correct the edges or the expected type.`,
      derivedChainType,
    };
  }

  return {
    ok: true,
    resolvedEdges: resolved,
    derivedChainType,
    rootIndex,
    supportEdgeCount: supportEdges.length,
    attackEdgeCount: attackEdges.length,
    warnings,
  };
}

/** Kahn topological sort over support edges; returns a cycle node-path if one
 * exists, else null. */
function detectSupportCycle(
  linkCount: number,
  supportEdges: ResolvedEdge[],
): number[] | null {
  const inDeg = new Array(linkCount).fill(0);
  const adj: number[][] = Array.from({ length: linkCount }, () => []);
  for (const e of supportEdges) {
    adj[e.from].push(e.to);
    inDeg[e.to]++;
  }
  const queue: number[] = [];
  for (let i = 0; i < linkCount; i++) if (inDeg[i] === 0) queue.push(i);
  let visited = 0;
  const localIn = [...inDeg];
  while (queue.length > 0) {
    const n = queue.shift()!;
    visited++;
    for (const m of adj[n]) {
      localIn[m]--;
      if (localIn[m] === 0) queue.push(m);
    }
  }
  if (visited === linkCount) return null;

  // A cycle exists among the nodes never drained to in-degree 0. Recover one
  // for the error message via DFS over the residual sub-graph.
  const inCycleCandidate = new Array(linkCount).fill(false);
  for (let i = 0; i < linkCount; i++) if (localIn[i] > 0) inCycleCandidate[i] = true;
  const stack: number[] = [];
  const onStack = new Array(linkCount).fill(false);
  const seen = new Array(linkCount).fill(false);
  const dfs = (u: number): number[] | null => {
    seen[u] = true;
    onStack[u] = true;
    stack.push(u);
    for (const v of adj[u]) {
      if (!inCycleCandidate[v]) continue;
      if (onStack[v]) {
        const idx = stack.indexOf(v);
        return [...stack.slice(idx), v];
      }
      if (!seen[v]) {
        const found = dfs(v);
        if (found) return found;
      }
    }
    onStack[u] = false;
    stack.pop();
    return null;
  };
  for (let i = 0; i < linkCount; i++) {
    if (inCycleCandidate[i] && !seen[i]) {
      const found = dfs(i);
      if (found) return found;
    }
  }
  return [0]; // unreachable in practice; defensive
}

/** Classify the support sub-graph into a chain type (§4.3). */
function deriveChainType(
  linkCount: number,
  supportEdges: ResolvedEdge[],
): { derivedChainType: DerivedChainType; rootIndex: number; multipleRoots: boolean } {
  const inDeg = new Array(linkCount).fill(0);
  const outDeg = new Array(linkCount).fill(0);
  for (const e of supportEdges) {
    outDeg[e.from]++;
    inDeg[e.to]++;
  }

  const roots: number[] = [];
  for (let i = 0; i < linkCount; i++) if (inDeg[i] === 0) roots.push(i);
  const rootIndex = roots.length > 0 ? roots[0] : 0;
  const multipleRoots = roots.length > 1;

  if (supportEdges.length === 0) {
    return { derivedChainType: "SERIAL", rootIndex, multipleRoots: false };
  }

  const maxIn = Math.max(...inDeg);
  const maxOut = Math.max(...outDeg);
  const multiIn = inDeg.filter((d) => d >= 2).length;
  const multiOut = outDeg.filter((d) => d >= 2).length;

  // No branching at all → a (possibly multi-segment) linear spine.
  if (maxIn <= 1 && maxOut <= 1) {
    return { derivedChainType: "SERIAL", rootIndex, multipleRoots };
  }
  // Both fan-in and fan-out → a general DAG.
  if (multiIn > 0 && multiOut > 0) {
    return { derivedChainType: "GRAPH", rootIndex, multipleRoots };
  }
  // Fan-in only → multiple premises feeding shared conclusions.
  if (multiIn > 0) {
    return { derivedChainType: "CONVERGENT", rootIndex, multipleRoots };
  }
  // Fan-out only (maxIn ≤ 1): one branching node ⇒ DIVERGENT; several branching
  // nodes ⇒ a hierarchical TREE.
  if (multiOut === 1) {
    return { derivedChainType: "DIVERGENT", rootIndex, multipleRoots };
  }
  return { derivedChainType: "TREE", rootIndex, multipleRoots };
}

// ─── Recursive attacks (PART 4 §4.2, Steps 3–4) ──────────────────────────────
// Attacks are dialectical, not inferential: they never thread claims and are
// excluded from the support sub-graph the type-derivation and DAG check operate
// over (resolveChainTopology already does this). This resolver is pure — it
// validates the per-link attack declarations against the resolved edge set in
// link-index space; the route maps indices → real node/edge ids after creation.

/** The canonical attack edge types: REBUTS (contradicts a conclusion) and
 * UNDERMINES (attacks a premise) target a NODE; UNDERCUTS targets an inference
 * EDGE. */
export type AttackEdgeType = "REBUTS" | "UNDERMINES" | "UNDERCUTS";

export interface AttackEdgeRef {
  from: number;
  to: number;
}

/** Per-link attack declaration. A link attacks at most one target. */
export interface AttackLinkInput {
  /** Attack a node (its conclusion via REBUTS, or a premise via UNDERMINES). */
  attacksNode?: number;
  /** Attack an inference edge (UNDERCUTS); references a declared support edge. */
  attacksEdge?: AttackEdgeRef;
  /** Node-attack flavour; default REBUTS. Ignored for edge attacks. */
  attackType?: "REBUTS" | "UNDERMINES";
}

export interface ResolvedAttack {
  /** The link doing the attacking (its node is the attacker). */
  attackerIndex: number;
  targetType: "NODE" | "EDGE";
  /** Set when targetType === "NODE". */
  targetNodeIndex: number | null;
  /** Set when targetType === "EDGE" (the attacked edge, in link-index space). */
  targetEdge: AttackEdgeRef | null;
  edgeType: AttackEdgeType;
}

export type AttackResult =
  | { ok: true; attacks: ResolvedAttack[]; warnings: TopologyWarning[] }
  | {
      ok: false;
      code:
        | "CHAIN_EDGE_INVALID_INDEX"
        | "CHAIN_ATTACK_TARGET_NOT_FOUND"
        | "CHAIN_ATTACK_ON_ATTACK";
      detail: string;
      linkIndex?: number;
    };

/**
 * Resolve and validate the per-link attack declarations (§4.2, §8).
 *
 * @param linkCount     number of links (attacker/target indices live in 0..N-1)
 * @param resolvedEdges the materialised edge set from resolveChainTopology
 * @param attackLinks   per-link attack declarations, indexed by link
 */
export function resolveChainAttacks(
  linkCount: number,
  resolvedEdges: ResolvedEdge[],
  attackLinks: Array<AttackLinkInput | undefined>,
): AttackResult {
  const attacks: ResolvedAttack[] = [];
  const warnings: TopologyWarning[] = [];

  const inRange = (n: unknown): n is number =>
    Number.isInteger(n) && (n as number) >= 0 && (n as number) < linkCount;

  for (let i = 0; i < attackLinks.length; i++) {
    const a = attackLinks[i];
    if (!a) continue;
    const hasNode = a.attacksNode !== undefined;
    const hasEdge = a.attacksEdge !== undefined;
    if (!hasNode && !hasEdge) continue;

    // At most one target per link (§8 — a link is a support thread XOR an attack).
    if (hasNode && hasEdge) {
      return {
        ok: false,
        code: "CHAIN_EDGE_INVALID_INDEX",
        detail: `Link ${i} declares both attacksNode and attacksEdge; a link may attack at most one target.`,
        linkIndex: i,
      };
    }

    if (hasNode) {
      if (!inRange(a.attacksNode)) {
        return {
          ok: false,
          code: "CHAIN_EDGE_INVALID_INDEX",
          detail: `Link ${i} attacksNode ${a.attacksNode} is outside the range 0..${linkCount - 1}.`,
          linkIndex: i,
        };
      }
      if (a.attacksNode === i) {
        return {
          ok: false,
          code: "CHAIN_EDGE_INVALID_INDEX",
          detail: `Link ${i} cannot attack itself.`,
          linkIndex: i,
        };
      }
      attacks.push({
        attackerIndex: i,
        targetType: "NODE",
        targetNodeIndex: a.attacksNode!,
        targetEdge: null,
        edgeType: a.attackType ?? "REBUTS",
      });
      continue;
    }

    // Edge attack (UNDERCUTS the inference).
    const ref = a.attacksEdge!;
    if (!inRange(ref.from) || !inRange(ref.to)) {
      return {
        ok: false,
        code: "CHAIN_EDGE_INVALID_INDEX",
        detail: `Link ${i} attacksEdge (${ref.from} → ${ref.to}) references a link index outside the range 0..${linkCount - 1}.`,
        linkIndex: i,
      };
    }
    const target = resolvedEdges.find(
      (e) => e.from === ref.from && e.to === ref.to,
    );
    if (!target) {
      return {
        ok: false,
        code: "CHAIN_ATTACK_TARGET_NOT_FOUND",
        detail: `Link ${i} attacksEdge (${ref.from} → ${ref.to}) names a pair with no declared edge.`,
        linkIndex: i,
      };
    }
    // Depth-1 cap (§2.2): a node may undercut an inference (a support edge), but
    // not an attack edge (that would be a 2nd-order edge-on-edge attack).
    if (!isSupportEdgeType(target.edgeType)) {
      return {
        ok: false,
        code: "CHAIN_ATTACK_ON_ATTACK",
        detail: `Link ${i} attacksEdge (${ref.from} → ${ref.to}) targets a ${target.edgeType} attack edge; 2nd-order edge attacks are out of scope (depth-1 cap).`,
        linkIndex: i,
      };
    }
    attacks.push({
      attackerIndex: i,
      targetType: "EDGE",
      targetNodeIndex: null,
      targetEdge: { from: ref.from, to: ref.to },
      edgeType: "UNDERCUTS",
    });
  }

  return { ok: true, attacks, warnings };
}
