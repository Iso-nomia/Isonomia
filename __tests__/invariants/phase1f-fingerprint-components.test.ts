/**
 * Phase 1f / B5 invariant tests — component hash vector.
 *
 * The four-way component digest {hubs, frontier, refusal, witnessing}
 * is a disjoint partition of MaterialFields. We pin:
 *
 *   1. Determinism: same fields ⇒ same components.
 *   2. Scope: each component changes iff its scope fields change,
 *      and only its scope fields. (disjointness)
 *   3. Diff: diffComponents reports exactly the changed names.
 *   4. Consistency: contentHash change ⇒ ≥1 component change.
 *   5. Short-circuit: evaluateStalenessRules returns null when given
 *      identical component vectors, even with mismatching field values
 *      (verifies the fast-path actually skips the field scan).
 *   6. Rule attribution scope: when the fields differ but the owning
 *      component digest is forced unchanged, the rule is suppressed.
 */

import {
  computeComponentHashes,
  diffComponents,
  evaluateStalenessRules,
  type MaterialFields,
  type ComponentHashVector,
} from "@/server/ludics/briefingFingerprint";
import { createHash } from "crypto";

function sha256(s: string) {
  return "sha256:" + createHash("sha256").update(s).digest("hex");
}

function baseFields(overrides: Partial<MaterialFields> = {}): MaterialFields {
  return {
    hubSet: ["arg-hub-1"],
    hubShape: "single-dominant",
    loadBearingRankingTop10: [
      "arg-1", "arg-2", "arg-3", "arg-4", "arg-5",
      "arg-6", "arg-7", "arg-8", "arg-9", "arg-10",
    ],
    refusalCount: 2,
    refusalConclusionIds: ["claim-A", "claim-B"],
    openExposurePoints: 8,
    prioritizedCqTop15: ["arg-1::CQ1", "arg-2::CQ2"],
    ...overrides,
  };
}

describe("computeComponentHashes (B5)", () => {
  it("is deterministic for identical fields", () => {
    const a = computeComponentHashes(baseFields());
    const b = computeComponentHashes(baseFields());
    expect(a).toEqual(b);
  });

  it("emits four sha256:<hex> digests", () => {
    const c = computeComponentHashes(baseFields());
    for (const name of ["hubs", "frontier", "refusal", "witnessing"] as const) {
      expect(c[name]).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("is hubSet-order independent (sorted before hashing)", () => {
    const a = computeComponentHashes(baseFields({ hubSet: ["b", "a", "c"] }));
    const b = computeComponentHashes(baseFields({ hubSet: ["a", "b", "c"] }));
    expect(a.hubs).toBe(b.hubs);
  });

  it("is refusalConclusionIds-order independent (sorted before hashing)", () => {
    const a = computeComponentHashes(
      baseFields({ refusalConclusionIds: ["claim-B", "claim-A"] }),
    );
    const b = computeComponentHashes(
      baseFields({ refusalConclusionIds: ["claim-A", "claim-B"] }),
    );
    expect(a.refusal).toBe(b.refusal);
  });
});

// ── Scope pinning: each component digest = function of disjoint slice ───────

describe("component scope (B5 disjointness)", () => {
  const base = computeComponentHashes(baseFields());

  it("hubs changes when hubSet changes; nothing else does", () => {
    const next = computeComponentHashes(
      baseFields({ hubSet: ["arg-hub-2"] }),
    );
    expect(next.hubs).not.toBe(base.hubs);
    expect(next.frontier).toBe(base.frontier);
    expect(next.refusal).toBe(base.refusal);
    expect(next.witnessing).toBe(base.witnessing);
  });

  it("hubs changes when hubShape changes; nothing else does", () => {
    const next = computeComponentHashes(
      baseFields({ hubShape: "diffuse" }),
    );
    expect(next.hubs).not.toBe(base.hubs);
    expect(next.frontier).toBe(base.frontier);
    expect(next.refusal).toBe(base.refusal);
    expect(next.witnessing).toBe(base.witnessing);
  });

  it("frontier changes when loadBearingRankingTop10 changes; nothing else does", () => {
    const next = computeComponentHashes(
      baseFields({
        loadBearingRankingTop10: [
          "arg-10", "arg-9", "arg-8", "arg-7", "arg-6",
          "arg-5", "arg-4", "arg-3", "arg-2", "arg-1",
        ],
      }),
    );
    expect(next.frontier).not.toBe(base.frontier);
    expect(next.hubs).toBe(base.hubs);
    expect(next.refusal).toBe(base.refusal);
    expect(next.witnessing).toBe(base.witnessing);
  });

  it("frontier changes when prioritizedCqTop15 changes; nothing else does", () => {
    const next = computeComponentHashes(
      baseFields({ prioritizedCqTop15: ["arg-99::CQX"] }),
    );
    expect(next.frontier).not.toBe(base.frontier);
    expect(next.hubs).toBe(base.hubs);
    expect(next.refusal).toBe(base.refusal);
    expect(next.witnessing).toBe(base.witnessing);
  });

  it("refusal changes when refusalConclusionIds changes; nothing else does", () => {
    const next = computeComponentHashes(
      baseFields({ refusalConclusionIds: ["claim-A", "claim-B", "claim-C"] }),
    );
    expect(next.refusal).not.toBe(base.refusal);
    expect(next.hubs).toBe(base.hubs);
    expect(next.frontier).toBe(base.frontier);
    expect(next.witnessing).toBe(base.witnessing);
  });

  it("witnessing changes when openExposurePoints changes; nothing else does", () => {
    const next = computeComponentHashes(
      baseFields({ openExposurePoints: 42 }),
    );
    expect(next.witnessing).not.toBe(base.witnessing);
    expect(next.hubs).toBe(base.hubs);
    expect(next.frontier).toBe(base.frontier);
    expect(next.refusal).toBe(base.refusal);
  });

  it("refusalCount is NOT in any component scope (derivable from refusalConclusionIds)", () => {
    // Bumping refusalCount alone (without changing the id list) must not
    // toggle any component, because count is derivable from the id set.
    const next = computeComponentHashes(baseFields({ refusalCount: 999 }));
    expect(next).toEqual(base);
  });
});

// ── diffComponents ──────────────────────────────────────────────────────────

describe("diffComponents (B5)", () => {
  it("returns empty set when components are identical", () => {
    const a = computeComponentHashes(baseFields());
    const b = computeComponentHashes(baseFields());
    expect(diffComponents(a, b).size).toBe(0);
  });

  it("reports exactly the components whose scope fields differ", () => {
    const prev = computeComponentHashes(baseFields());
    const curr = computeComponentHashes(
      baseFields({
        hubSet: ["arg-hub-2"],
        openExposurePoints: 42,
      }),
    );
    const changed = diffComponents(prev, curr);
    expect(changed).toEqual(new Set(["hubs", "witnessing"]));
  });
});

// ── Consistency invariant: combined hash change ⇒ ≥1 component change ───────

describe("contentHash ↔ components consistency (B5)", () => {
  it("flipping a single material field toggles ≥1 component", () => {
    // We don't import computeHash; just enumerate every field
    // mutation and confirm at least one component digest moves.
    const base = baseFields();
    const baseComponents = computeComponentHashes(base);

    const mutations: Array<Partial<MaterialFields>> = [
      { hubSet: ["arg-hub-2"] },
      { hubShape: "diffuse" },
      { loadBearingRankingTop10: [
          "arg-x", "arg-2", "arg-3", "arg-4", "arg-5",
          "arg-6", "arg-7", "arg-8", "arg-9", "arg-10",
        ] },
      { refusalConclusionIds: ["claim-A", "claim-Z"] },
      { openExposurePoints: 99 },
      { prioritizedCqTop15: ["arg-x::CQ1"] },
    ];

    for (const m of mutations) {
      const next = computeComponentHashes(baseFields(m));
      const changed = diffComponents(baseComponents, next);
      expect(changed.size).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Fast-path: evaluateStalenessRules short-circuits on unchanged comps ─────

describe("evaluateStalenessRules component fast-path (B5)", () => {
  it("returns null when component vectors are identical, regardless of fields", () => {
    // Pathological: fields differ wildly, but caller asserts components
    // match. The function MUST trust the component contract and skip
    // every rule. This pins the short-circuit behavior.
    const prev = baseFields();
    const curr = baseFields({
      hubSet: ["totally-different-hub"],
      openExposurePoints: 99,
      refusalConclusionIds: ["claim-X", "claim-Y", "claim-Z"],
    });
    const stubComponents: ComponentHashVector = {
      hubs: sha256("stub"),
      frontier: sha256("stub"),
      refusal: sha256("stub"),
      witnessing: sha256("stub"),
    };
    const rule = evaluateStalenessRules(
      prev,
      curr,
      stubComponents,
      stubComponents,
    );
    expect(rule).toBeNull();
  });

  it("suppresses R5 when witnessing component is unchanged (scope guard)", () => {
    // Without component hints, an openExposurePoints jump of ≥10 trips R5.
    // With matching witnessing digest, R5 must NOT fire.
    const prev = baseFields({ openExposurePoints: 0 });
    const curr = baseFields({ openExposurePoints: 50 });
    const prevC = computeComponentHashes(prev);
    // Force witnessing equal even though the field differs:
    const currC: ComponentHashVector = {
      ...computeComponentHashes(curr),
      witnessing: prevC.witnessing,
    };
    expect(evaluateStalenessRules(prev, curr, prevC, currC)).toBeNull();
    // Sanity: without the override, R5 fires.
    expect(evaluateStalenessRules(prev, curr)).toBe("R5");
  });

  it("fires the correct rule when only one component changes", () => {
    // hubs-only change ⇒ R1
    const prev = baseFields();
    const curr = baseFields({ hubSet: ["arg-hub-2"], hubShape: "diffuse" });
    const prevC = computeComponentHashes(prev);
    const currC = computeComponentHashes(curr);
    expect(diffComponents(prevC, currC)).toEqual(new Set(["hubs"]));
    expect(evaluateStalenessRules(prev, curr, prevC, currC)).toBe("R1");

    // refusal-only change ⇒ R2
    const prev2 = baseFields();
    const curr2 = baseFields({
      refusalConclusionIds: ["claim-A", "claim-B", "claim-NEW"],
    });
    const prev2C = computeComponentHashes(prev2);
    const curr2C = computeComponentHashes(curr2);
    expect(diffComponents(prev2C, curr2C)).toEqual(new Set(["refusal"]));
    expect(evaluateStalenessRules(prev2, curr2, prev2C, curr2C)).toBe("R2");

    // witnessing-only change ⇒ R5
    const prev3 = baseFields({ openExposurePoints: 0 });
    const curr3 = baseFields({ openExposurePoints: 100 });
    const prev3C = computeComponentHashes(prev3);
    const curr3C = computeComponentHashes(curr3);
    expect(diffComponents(prev3C, curr3C)).toEqual(new Set(["witnessing"]));
    expect(evaluateStalenessRules(prev3, curr3, prev3C, curr3C)).toBe("R5");
  });
});
