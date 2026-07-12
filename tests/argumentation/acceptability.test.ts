// tests/argumentation/acceptability.test.ts
//
// Reading-C roadmap item 1 — the multi-semantics acceptability facade.
//
// Parity: `computeAcceptability` membership must equal the consolidated
// `lib/argumentation` engines (grounded / stable / preferred), exhaustively over
// every AF on n ≤ 3, plus the empty-stable edge case and the T4-anonymity guard.
//
// Spec: docs/READING_C_ITEM1_ACCEPTABILITY_SURFACE_DEV_SPEC.md
// Warrant: RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T015-additive-realizability-keystone.md

import { describe, it, expect } from "@jest/globals";

import {
  computeAcceptability,
  type AcceptabilityResult,
} from "@/lib/argumentation/acceptability";
import {
  groundedExtension,
  toDefeatGraphFromEdgeList,
} from "@/lib/argumentation/labelling";
import { stableExtensions, preferredExtensions } from "@/lib/argumentation/semantics";
import type { DefeatGraph } from "@/lib/argumentation/types";
import type { Anonymous } from "@/lib/ludics/anonymity";

// ─── T4 type-level guard ─────────────────────────────────────────────────────
type AssertNoParticipantId =
  "participantId" extends keyof Anonymous<AcceptabilityResult> ? never : true;
const _noParticipantId: AssertNoParticipantId = true;
void _noParticipantId;

// ─── AF family ───────────────────────────────────────────────────────────────
type Edge = [string, string];

function* allAFs(n: number): Generator<{ args: string[]; attacks: Edge[] }> {
  const args = Array.from({ length: n }, (_, i) => `a${i}`);
  const edges: Edge[] = [];
  for (const from of args) for (const to of args) edges.push([from, to]);
  const m = edges.length;
  for (let mask = 0; mask < 1 << m; mask++) {
    const attacks: Edge[] = [];
    for (let b = 0; b < m; b++) if (mask & (1 << b)) attacks.push(edges[b]);
    yield { args, attacks };
  }
}

const dgOf = (args: string[], attacks: Edge[]): DefeatGraph =>
  toDefeatGraphFromEdgeList(args, attacks);

// ─── Exhaustive parity ───────────────────────────────────────────────────────

describe("computeAcceptability — parity with the consolidated engines", () => {
  for (const n of [1, 2, 3]) {
    it(`membership + counts match grounded/stable/preferred (${n} arg)`, () => {
      let checked = 0;
      for (const af of allAFs(n)) {
        const dg = dgOf(af.args, af.attacks);
        const result = computeAcceptability(dg);

        const grounded = groundedExtension(dg);
        const stable = stableExtensions(dg);
        const preferred = preferredExtensions(dg);

        expect(result.extensionCounts.stable).toBe(stable.length);
        expect(result.extensionCounts.preferred).toBe(preferred.length);

        for (const a of af.args) {
          const acc = result.perArgument[a];
          expect(acc.grounded).toBe(grounded.has(a));
          expect(acc.stableCredulous).toBe(stable.some((E) => E.has(a)));
          expect(acc.stableSkeptical).toBe(
            stable.length > 0 && stable.every((E) => E.has(a))
          );
          expect(acc.preferredCredulous).toBe(preferred.some((E) => E.has(a)));
          expect(acc.preferredSkeptical).toBe(preferred.every((E) => E.has(a)));
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0);
    });
  }
});

// ─── Named edge cases ────────────────────────────────────────────────────────

describe("computeAcceptability — edge cases", () => {
  it("2-cycle a↔b + isolated c: credulous-stable a, skeptical-stable c", () => {
    const dg = dgOf(["a", "b", "c"], [["a", "b"], ["b", "a"]]);
    const r = computeAcceptability(dg);
    expect(r.extensionCounts.stable).toBe(2); // {a,c}, {b,c}
    expect(r.perArgument["a"].stableCredulous).toBe(true);
    expect(r.perArgument["a"].stableSkeptical).toBe(false); // {b,c} excludes a
    expect(r.perArgument["c"].stableSkeptical).toBe(true); // in both
    expect(r.perArgument["a"].grounded).toBe(false); // grounded is ∅
  });

  it("self-attacker: no stable extension ⇒ both stable flags false", () => {
    const dg = dgOf(["a"], [["a", "a"]]);
    const r = computeAcceptability(dg);
    expect(r.extensionCounts.stable).toBe(0);
    expect(r.perArgument["a"].stableCredulous).toBe(false);
    expect(r.perArgument["a"].stableSkeptical).toBe(false);
    // Preferred always exists (∅ admissible); `a` is in none of them.
    expect(r.extensionCounts.preferred).toBeGreaterThanOrEqual(1);
    expect(r.perArgument["a"].preferredCredulous).toBe(false);
  });

  it("unattacked argument is in every semantics", () => {
    const r = computeAcceptability(dgOf(["a"], []));
    expect(r.perArgument["a"]).toEqual({
      grounded: true,
      stableCredulous: true,
      stableSkeptical: true,
      preferredCredulous: true,
      preferredSkeptical: true,
    });
  });
});
