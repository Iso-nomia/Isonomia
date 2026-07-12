/**
 * Unit tests for `lib/deliberation/topology.ts` — the Phase 1
 * structural-shape signals.
 *
 * Tests target the pure helpers (`buildHubs`, `buildAmbiguity`,
 * `buildSizeTier`, `classifySize`). The Prisma-backed
 * `computeLoadBearingPremises` and `computeDeliberationTopology`
 * are exercised end-to-end by `scripts/verify-ai-epi-pt4.ts`.
 */

import {
  buildHubs,
  buildAmbiguity,
  buildSizeTier,
  classifySize,
  type LoadBearingPremise,
} from "@/lib/deliberation/topology";

describe("topology.classifySize", () => {
  it("classifies sizes against the four-tier degradation model", () => {
    expect(classifySize(0)).toBe("small");
    expect(classifySize(20)).toBe("small");
    expect(classifySize(21)).toBe("medium");
    expect(classifySize(80)).toBe("medium");
    expect(classifySize(81)).toBe("large");
    expect(classifySize(250)).toBe("large");
    expect(classifySize(251)).toBe("very-large");
    expect(classifySize(10000)).toBe("very-large");
  });
});

describe("topology.buildSizeTier", () => {
  it("emits no disclosure below very-large", () => {
    const small = buildSizeTier(10);
    expect(small.tier).toBe("small");
    expect(small.hierarchicalMode).toBe(false);
    expect(small.disclosure).toBeNull();
  });

  it("emits an honest disclosure at very-large", () => {
    const xl = buildSizeTier(500);
    expect(xl.tier).toBe("very-large");
    expect(xl.hierarchicalMode).toBe(true);
    expect(xl.disclosure).toBeTruthy();
    expect(xl.disclosure).toContain("500 arguments");
    expect(xl.disclosure).toContain("get_argument");
  });
});

describe("topology.buildHubs", () => {
  it("returns shape='empty' on no arguments", () => {
    const h = buildHubs({});
    expect(h.shape).toBe("empty");
    expect(h.set).toEqual([]);
  });

  it("returns shape='empty' when no argument has positive load-bearingness", () => {
    const h = buildHubs({ a: 0, b: -1 });
    expect(h.shape).toBe("empty");
    expect(h.set).toEqual([]);
  });

  it("returns shape='single-dominant' when one argument clearly leads", () => {
    const h = buildHubs({ a: 10, b: 1, c: 0 });
    expect(h.shape).toBe("single-dominant");
    expect(h.set.length).toBe(1);
    expect(h.set[0]?.argumentId).toBe("a");
  });

  it("returns shape='co-equal-cluster' when 2-5 args are within the threshold", () => {
    // top score 10, threshold = max(1, ceil(0.2 * 10)) = 2, cutoff = 8
    const h = buildHubs({ a: 10, b: 9, c: 8, d: 5 });
    expect(h.shape).toBe("co-equal-cluster");
    expect(h.set.map((s) => s.argumentId)).toEqual(["a", "b", "c"]);
    expect(h.coequalThreshold).toBe(2);
  });

  it("returns shape='diffuse' when more than 5 args are co-equal", () => {
    // top score 10, threshold 2, cutoff 8 → 6 hubs at scores 10,10,9,9,8,8
    const h = buildHubs({
      a: 10,
      b: 10,
      c: 9,
      d: 9,
      e: 8,
      f: 8,
      g: 1,
    });
    expect(h.shape).toBe("diffuse");
    expect(h.set.length).toBe(6);
  });

  it("orders the hub set by score descending", () => {
    const h = buildHubs({ a: 8, b: 10, c: 9 });
    expect(h.set.map((s) => s.argumentId)).toEqual(["b", "c", "a"]);
  });
});

describe("topology.buildAmbiguity", () => {
  const noPremises: LoadBearingPremise[] = [];

  it("emits no cautions for single-dominant hub + no load-bearing premises", () => {
    const hubs = buildHubs({ a: 10, b: 0 });
    const amb = buildAmbiguity(hubs, noPremises);
    expect(amb.hubAmbiguity).toBe("none");
    expect(amb.premiseConcentration).toBe("none");
    expect(amb.cautions).toEqual([]);
  });

  it("emits a 'do not name a single hub' caution for co-equal hubs", () => {
    const hubs = buildHubs({ a: 10, b: 9 });
    const amb = buildAmbiguity(hubs, noPremises);
    expect(amb.hubAmbiguity).toBe("low");
    expect(amb.cautions.length).toBeGreaterThanOrEqual(1);
    expect(amb.cautions.join(" ")).toMatch(/co-equal|hub/i);
  });

  it("escalates hubAmbiguity to 'medium' for 3-5 co-equal hubs", () => {
    const hubs = buildHubs({ a: 10, b: 10, c: 9 });
    const amb = buildAmbiguity(hubs, noPremises);
    expect(amb.hubAmbiguity).toBe("medium");
  });

  it("escalates hubAmbiguity to 'high' for diffuse topology", () => {
    const hubs = buildHubs({
      a: 10,
      b: 10,
      c: 10,
      d: 9,
      e: 9,
      f: 9,
      g: 9,
    });
    const amb = buildAmbiguity(hubs, noPremises);
    expect(amb.hubAmbiguity).toBe("high");
    expect(amb.cautions.join(" ")).toMatch(/diffuse/i);
  });

  it("classifies premiseConcentration by load-bearing-premise count", () => {
    const hubs = buildHubs({ a: 10 });
    const fakePremise = (i: number): LoadBearingPremise => ({
      claimId: `c${i}`,
      claimText: `premise ${i}`,
      usingArgumentCount: 3,
      cascadeScore: 6,
      usingArgumentIds: [`a${i}`, `b${i}`, `c${i}`],
    });
    expect(
      buildAmbiguity(hubs, []).premiseConcentration,
    ).toBe("none");
    expect(
      buildAmbiguity(hubs, [fakePremise(1)]).premiseConcentration,
    ).toBe("low");
    expect(
      buildAmbiguity(hubs, [fakePremise(1), fakePremise(2)])
        .premiseConcentration,
    ).toBe("medium");
    expect(
      buildAmbiguity(
        hubs,
        [fakePremise(1), fakePremise(2), fakePremise(3), fakePremise(4)],
      ).premiseConcentration,
    ).toBe("high");
  });

  it("emits a premise-concentration caution at 'high'", () => {
    const hubs = buildHubs({ a: 10 });
    const fakePremise = (i: number): LoadBearingPremise => ({
      claimId: `c${i}`,
      claimText: null,
      usingArgumentCount: 2,
      cascadeScore: 4,
      usingArgumentIds: [`a${i}`, `b${i}`],
    });
    const amb = buildAmbiguity(
      hubs,
      [fakePremise(1), fakePremise(2), fakePremise(3), fakePremise(4)],
    );
    expect(amb.cautions.join(" ")).toMatch(/cascade|premises share/i);
  });
});

describe("topology module shape (compile-time smoke check)", () => {
  it("exposes computeDeliberationTopology", async () => {
    const mod = await import("@/lib/deliberation/topology");
    expect(typeof mod.computeDeliberationTopology).toBe("function");
  });
});
