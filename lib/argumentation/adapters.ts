// lib/argumentation/adapters.ts
//
// Representation adapters for the consolidated Dung engine. Two legacy surface
// shapes are supported on top of the labelling-based core (`./labelling`,
// `./semantics`):
//
//   • attack-map  — `Map<NodeID, Set<NodeID>>`
//   • edge-list   — `Array<[string, string]>`  (bipolar `AFNode`/`AFEdge`)
//
// Both delegate their semantics to the exact core (commitments C1/C2); these
// adapters only translate between the surface shapes and `DefeatGraph`. This
// file replaces the former `lib/deepdive/af.ts` and `lib/argumentation/afEngine.ts`
// (consolidation roadmap Phase 4c).

import {
  toDefeatGraphFromEdgeList,
  toDefeatGraphFromAttackMap,
  groundedExtension as groundedExtensionCore,
} from "@/lib/argumentation/labelling";
import { preferredExtensions as preferredExtensionsCore } from "@/lib/argumentation/semantics";

// ============================================================================
// Attack-map representation (Map<NodeID, Set<NodeID>>)
// ============================================================================

export type NodeID = string;

export type Edge = {
  from: NodeID;
  to: NodeID;
  type: "rebut" | "undercut" | "support";
};

/**
 * Build an attack graph (Dung AF) from edges. `rebut` and `undercut` are
 * treated as attacks; `support` is ignored for conflict.
 */
export function buildAttackGraph(nodes: NodeID[], edges: Edge[]): Map<NodeID, Set<NodeID>> {
  const attackMap = new Map<NodeID, Set<NodeID>>();
  for (const n of nodes) attackMap.set(n, new Set());
  for (const e of edges) {
    if (e.type === "rebut" || e.type === "undercut") {
      attackMap.get(e.from)?.add(e.to);
    }
  }
  return attackMap;
}

/**
 * Preferred extensions (⊆-maximal admissible sets) over the attack-map
 * representation. Exact for all framework sizes via the labelling core.
 */
export function preferredExtensions(
  nodes: NodeID[],
  attackMap: Map<NodeID, Set<NodeID>>
): Set<NodeID>[] {
  return preferredExtensionsCore(toDefeatGraphFromAttackMap(nodes, attackMap));
}

// ============================================================================
// Edge-list representation (Array<[string, string]>) — bipolar projection
// ============================================================================

export type EdgeType = "support" | "rebut" | "undercut" | "attack";

export type AFNode = { id: string; label?: string; text?: string };
export type AFEdge = { from: string; to: string; type: EdgeType };

export type AF = { A: string[]; R: Array<[string, string]> };

export type BuildOptions = {
  /** If true, propagate support as defense: s→b and x→b induce s→x. */
  supportDefensePropagation?: boolean;
  /** If true, take transitive closure over supports before propagation. */
  supportClosure?: boolean;
};

const asAttack = (t: EdgeType) => t === "attack" || t === "rebut" || t === "undercut";

/** Project a bipolar graph to a plain AF (Dung): only attacks R ⊆ A×A. */
export function projectToAF(nodes: AFNode[], edges: AFEdge[], opts: BuildOptions = {}): AF {
  const A = nodes.map((n) => n.id);
  const idSet = new Set(A);

  const attacks: Array<[string, string]> = [];
  const supportsByTarget = new Map<string, Set<string>>();
  const supportOut = new Map<string, Set<string>>();

  for (const e of edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    if (asAttack(e.type)) attacks.push([e.from, e.to]);
    if (e.type === "support") {
      if (!supportsByTarget.has(e.to)) supportsByTarget.set(e.to, new Set());
      supportsByTarget.get(e.to)!.add(e.from);
      if (!supportOut.has(e.from)) supportOut.set(e.from, new Set());
      supportOut.get(e.from)!.add(e.to);
    }
  }

  // Optional: support transitive closure (s1 supports s2 supports b ⇒ s1 supports b)
  let supportClosure: Map<string, Set<string>> | undefined;
  if (opts.supportClosure) {
    supportClosure = new Map();
    for (const s of supportOut.keys()) {
      const seen = new Set<string>();
      const q = [s];
      while (q.length) {
        const cur = q.shift()!;
        const outs = supportOut.get(cur);
        if (!outs) continue;
        for (const t of outs) {
          if (!seen.has(t)) {
            seen.add(t);
            q.push(t);
          }
        }
      }
      supportClosure.set(s, seen);
    }
  }

  if (opts.supportDefensePropagation) {
    const add = (a: string, b: string) => {
      for (const [x, y] of attacks) if (x === a && y === b) return;
      attacks.push([a, b]);
    };
    for (const [x, b] of attacks.slice()) {
      const supporters = new Set<string>();
      const direct = supportsByTarget.get(b);
      if (direct) direct.forEach((s) => supporters.add(s));
      if (supportClosure) {
        for (const s of supportClosure.keys()) {
          if (supportClosure.get(s)!.has(b)) supporters.add(s);
        }
      }
      supporters.forEach((s) => add(s, x));
    }
  }

  const R = attacks.filter(([x, y]) => x !== y);
  return { A, R };
}

/* ---------- Dung semantics (edge-list helpers) ---------- */

function attackersOf(a: string, R: Array<[string, string]>): string[] {
  const arr: string[] = [];
  for (const [x, y] of R) if (y === a) arr.push(x);
  return arr;
}
function attacks(S: Set<string>, b: string, R: Array<[string, string]>): boolean {
  for (const s of S) for (const [x, y] of R) if (x === s && y === b) return true;
  return false;
}
export function conflictFree(S: Set<string>, R: Array<[string, string]>): boolean {
  for (const [x, y] of R) if (S.has(x) && S.has(y)) return false;
  return true;
}
export function defends(S: Set<string>, a: string, R: Array<[string, string]>): boolean {
  for (const b of attackersOf(a, R)) {
    if (!attacks(S, b, R)) return false;
  }
  return true;
}
export function characteristicF(A: string[], R: Array<[string, string]>, S: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const a of A) if (defends(S, a, R)) out.add(a);
  return out;
}

/** Grounded extension — delegates to the exact labelling core (C1). */
export function grounded(A: string[], R: Array<[string, string]>): Set<string> {
  return groundedExtensionCore(toDefeatGraphFromEdgeList(A, R));
}

/** Admissibility: conflict-free and defends all its members. */
export function isAdmissible(A: string[], R: Array<[string, string]>, S: Set<string>): boolean {
  if (!conflictFree(S, R)) return false;
  for (const a of S) if (!defends(S, a, R)) return false;
  return true;
}

/**
 * Preferred extensions — ⊆-maximal admissible sets. Exact for all sizes via the
 * labelling core (C2). `_maxExplore` is retained for backward signature
 * compatibility and ignored.
 */
export function preferred(
  A: string[],
  R: Array<[string, string]>,
  _maxExplore = 20000
): Array<Set<string>> {
  return preferredExtensionsCore(toDefeatGraphFromEdgeList(A, R));
}

/** Labeling from one extension: IN = E; OUT = attacked by E; UNDEC = rest. */
export function labelingFromExtension(A: string[], R: Array<[string, string]>, E: Set<string>) {
  const IN = new Set(E);
  const OUT = new Set<string>();
  for (const [x, y] of R) if (IN.has(x)) OUT.add(y);
  const UNDEC = new Set<string>();
  for (const a of A) if (!IN.has(a) && !OUT.has(a)) UNDEC.add(a);
  return { IN, OUT, UNDEC };
}
