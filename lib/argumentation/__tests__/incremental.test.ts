// lib/argumentation/__tests__/incremental.test.ts
//
// Phase 4a gate: incremental grounded relabelling must be *exact* — bit-for-bit
// identical to a full recompute — on arbitrary graph extensions.

import type { ArgId, DefeatGraph, Labelling } from "@/lib/argumentation/types";
import { groundedLabelling } from "@/lib/argumentation/labelling";
import {
  affectedRegion,
  dirtySeed,
  relabelFrom,
  relabelOnExtend,
} from "@/lib/argumentation/incremental";

function graph(args: string[], edges: Array<[string, string]>): DefeatGraph {
  const attacks = new Map<string, Set<string>>();
  for (const a of args) attacks.set(a, new Set());
  for (const [from, to] of edges) {
    if (!attacks.has(from)) attacks.set(from, new Set());
    if (!attacks.has(to)) attacks.set(to, new Set());
    attacks.get(from)!.add(to);
  }
  return { args: [...args], attacks };
}

function labEqual(a: Labelling, b: Labelling): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

describe("Phase 4a — incremental grounded relabelling", () => {
  test("extending a chain a→b with b→c relabels only the downstream", () => {
    const prev = graph(["a", "b"], [["a", "b"]]); // a IN, b OUT
    const prevLab = groundedLabelling(prev);
    const next = graph(["a", "b", "c"], [["a", "b"], ["b", "c"]]); // c IN (b is OUT)

    const { labelling, affected } = relabelOnExtend(prev, prevLab, next);
    expect(labelling.get("a")).toBe("IN");
    expect(labelling.get("b")).toBe("OUT");
    expect(labelling.get("c")).toBe("IN");
    // a is untouched; only c is new and b's attackers are unchanged.
    expect(affected.has("a")).toBe(false);
    expect(affected.has("c")).toBe(true);
    expect(labEqual(labelling, groundedLabelling(next))).toBe(true);
  });

  test("adding a new attacker flips a previously-IN argument and propagates", () => {
    const prev = graph(["a", "b"], [["a", "b"]]); // a IN, b OUT
    const prevLab = groundedLabelling(prev);
    // New c attacks a; a's attacker set changed → a, then b, are affected.
    const next = graph(["a", "b", "c"], [["a", "b"], ["c", "a"]]);

    const seed = dirtySeed(prev, next);
    expect(seed.has("a")).toBe(true); // attacker set changed
    expect(seed.has("c")).toBe(true); // new
    const affected = affectedRegion(next, seed);
    expect(affected.has("b")).toBe(true); // downstream of a

    const { labelling } = relabelOnExtend(prev, prevLab, next);
    // c unattacked → IN; a attacked by IN c → OUT; b attacked by OUT a → IN.
    expect(labelling.get("c")).toBe("IN");
    expect(labelling.get("a")).toBe("OUT");
    expect(labelling.get("b")).toBe("IN");
    expect(labEqual(labelling, groundedLabelling(next))).toBe(true);
  });

  test("introducing an even cycle leaves both undecided", () => {
    const prev = graph(["a"], []);
    const prevLab = groundedLabelling(prev);
    const next = graph(["a", "b"], [["a", "b"], ["b", "a"]]);
    const { labelling } = relabelOnExtend(prev, prevLab, next);
    expect(labelling.get("a")).toBe("UNDEC");
    expect(labelling.get("b")).toBe("UNDEC");
    expect(labEqual(labelling, groundedLabelling(next))).toBe(true);
  });

  test("matches full recompute on randomised extensions", () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const mkGraph = (n: number, density: number): DefeatGraph => {
      const args = Array.from({ length: n }, (_, i) => `x${i}`);
      const edges: Array<[string, string]> = [];
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i !== j && rand() < density) edges.push([args[i], args[j]]);
        }
      }
      return graph(args, edges);
    };

    for (let trial = 0; trial < 40; trial++) {
      const base = 4 + Math.floor(rand() * 6);
      const prev = mkGraph(base, 0.18);
      const prevLab = groundedLabelling(prev);
      // Extend: keep prev's args+edges, add a few new args and edges.
      const extraArgs = 1 + Math.floor(rand() * 4);
      const nextArgs = [
        ...prev.args,
        ...Array.from({ length: extraArgs }, (_, i) => `y${trial}_${i}`),
      ];
      const nextEdges: Array<[string, string]> = [];
      for (const [a, tos] of prev.attacks) for (const b of tos) nextEdges.push([a, b]);
      for (let k = 0; k < extraArgs * 2; k++) {
        const from = nextArgs[Math.floor(rand() * nextArgs.length)];
        const to = nextArgs[Math.floor(rand() * nextArgs.length)];
        if (from !== to) nextEdges.push([from, to]);
      }
      const next = graph(nextArgs, nextEdges);

      const inc = relabelOnExtend(prev, prevLab, next);
      const full = groundedLabelling(next);
      expect(labEqual(inc.labelling, full)).toBe(true);
    }
  });

  test("relabelFrom is a convenience wrapper equal to a full recompute", () => {
    const prev = graph(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
    const next = graph(
      ["a", "b", "c", "d"],
      [["a", "b"], ["b", "c"], ["c", "d"]]
    );
    const { labelling } = relabelFrom(prev, next);
    expect(labEqual(labelling, groundedLabelling(next))).toBe(true);
  });
});
