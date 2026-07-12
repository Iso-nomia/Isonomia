/**
 * Translator tests for explicit ClaimContrary -> ASPIC theory.contraries
 *
 * Regression coverage for two specific bugs:
 *   1. Symmetric rows must populate both directions in `contraries`.
 *   2. The translator must reject (or at least no-op on) the legacy
 *      `{[claimId]: contraryId[]}` map shape that previously got passed in
 *      from `app/api/aspic/transposition/generate/route.ts`.
 */

import { describe, test, expect } from "@jest/globals";
import { aifToASPIC } from "@/lib/aif/translation/aifToAspic";
import type { AIFGraph } from "@/lib/aif/types";

function emptyGraph(): AIFGraph {
  return { nodes: [], edges: [] };
}

describe("aifToASPIC — explicit ClaimContrary handling", () => {
  test("symmetric contrary populates both directions in contraries map", () => {
    const rows = [
      {
        claimId: "c1",
        contraryId: "c2",
        isSymmetric: true,
        claim: { text: "P" },
        contrary: { text: "not P" },
      },
    ];

    const theory = aifToASPIC(emptyGraph(), rows);

    expect(theory.language.has("P")).toBe(true);
    expect(theory.language.has("not P")).toBe(true);
    expect(theory.contraries.get("P")?.has("not P")).toBe(true);
    expect(theory.contraries.get("not P")?.has("P")).toBe(true);
  });

  test("asymmetric contrary populates only the forward direction", () => {
    const rows = [
      {
        claimId: "c1",
        contraryId: "c2",
        isSymmetric: false,
        claim: { text: "A" },
        contrary: { text: "B" },
      },
    ];

    const theory = aifToASPIC(emptyGraph(), rows);

    expect(theory.contraries.get("A")?.has("B")).toBe(true);
    // Reverse direction must NOT exist for an asymmetric row
    expect(theory.contraries.get("B")?.has("A") ?? false).toBe(false);
  });

  test("multiple rows accumulate without overwriting prior entries", () => {
    const rows = [
      {
        claimId: "c1",
        contraryId: "c2",
        isSymmetric: false,
        claim: { text: "A" },
        contrary: { text: "B" },
      },
      {
        claimId: "c1",
        contraryId: "c3",
        isSymmetric: false,
        claim: { text: "A" },
        contrary: { text: "C" },
      },
    ];

    const theory = aifToASPIC(emptyGraph(), rows);

    const aContraries = theory.contraries.get("A");
    expect(aContraries?.has("B")).toBe(true);
    expect(aContraries?.has("C")).toBe(true);
    expect(aContraries?.size).toBe(2);
  });

  test("undefined / empty contraries argument is a no-op", () => {
    const t1 = aifToASPIC(emptyGraph(), undefined);
    expect(t1.contraries.size).toBe(0);

    const t2 = aifToASPIC(emptyGraph(), []);
    expect(t2.contraries.size).toBe(0);
  });

  test("regression: legacy map shape silently produces no contraries", () => {
    // Prior to the Task 2 fix, the transposition route built this object
    // and cast it to `any`. The translator's `for…of` on an object iterates
    // nothing, so nothing was added. We assert that exact behavior here so
    // any future code path that accidentally passes a map gets a clear
    // failure when it expects contraries to populate.
    const legacyMap = { c1: ["c2"], c2: ["c1"] } as any;
    const theory = aifToASPIC(emptyGraph(), legacyMap);
    expect(theory.contraries.size).toBe(0);
  });
});
