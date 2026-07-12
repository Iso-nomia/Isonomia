import { selectCandidates, type CandidateSchemeShape } from "@/lib/schemes/verifier/selectCandidates";

const make = (
  id: string,
  cqCount: number,
  clusterTag: string | null,
  vars: string[] = [],
): CandidateSchemeShape => ({
  id,
  key: id,
  name: id,
  clusterTag,
  premises: vars.length > 0 ? [{ id: "P1", type: "major", text: "", variables: vars }] : null,
  cqs: Array.from({ length: cqCount }, (_, i) => ({ cqKey: `cq${i}`, text: `q${i}` })),
});

describe("selectCandidates", () => {
  test("excludes self-id in edit mode", () => {
    const draft = { id: "x", clusterTag: "authority_family", cqs: [{ cqKey: "a" }] as any };
    const out = selectCandidates(draft, [make("x", 1, "authority_family")]);
    expect(out).toHaveLength(0);
  });

  test("includes catalogue rows with matching clusterTag", () => {
    const draft = { clusterTag: "authority_family", cqs: [{ cqKey: "a" }, { cqKey: "b" }] as any };
    const cat = [make("y", 2, "authority_family"), make("z", 2, "causal_family")];
    const out = selectCandidates(draft, cat);
    expect(out.map((c) => c.id)).toEqual(["y"]);
  });

  test("includes catalogue rows with null clusterTag (rule 1 fall-through)", () => {
    const draft = { clusterTag: "authority_family", cqs: [{ cqKey: "a" }] as any };
    const out = selectCandidates(draft, [make("y", 1, null)]);
    expect(out.map((c) => c.id)).toEqual(["y"]);
  });

  test("excludes rows outside the CQ-count window [max(1, n-2), n+2]", () => {
    const draft = { clusterTag: null, cqs: Array.from({ length: 5 }, (_, i) => ({ cqKey: `q${i}` })) as any };
    const cat = [
      make("low", 2, null), // 5 - 2 = 3, so 2 is outside
      make("ok-lo", 3, null),
      make("ok-hi", 7, null),
      make("hi", 8, null), // outside
    ];
    const out = selectCandidates(draft, cat).map((c) => c.id);
    expect(out).toEqual(["ok-lo", "ok-hi"]);
  });

  test("CQ-count window floors at 1 (so a draft with 1 CQ still admits 1-CQ candidates)", () => {
    const draft = { clusterTag: null, cqs: [{ cqKey: "a" }] as any };
    const out = selectCandidates(draft, [make("y", 1, null)]);
    expect(out.map((c) => c.id)).toEqual(["y"]);
  });

  test("requires premise-variable overlap when draft declares variables", () => {
    const draft = {
      clusterTag: null,
      cqs: [{ cqKey: "a" }] as any,
      premises: [{ id: "P1", type: "major", text: "", variables: ["E", "S"] }],
    };
    const cat = [
      make("disjoint", 1, null, ["X", "Y"]),
      make("overlap", 1, null, ["S", "Z"]),
    ];
    const out = selectCandidates(draft, cat).map((c) => c.id);
    expect(out).toEqual(["overlap"]);
  });

  test("falls back to include when draft has no declared variables", () => {
    const draft = { clusterTag: null, cqs: [{ cqKey: "a" }] as any };
    const out = selectCandidates(draft, [make("y", 1, null, ["E"])]);
    expect(out.map((c) => c.id)).toEqual(["y"]);
  });

  test("falls back to include when candidate has no declared variables", () => {
    const draft = {
      clusterTag: null,
      cqs: [{ cqKey: "a" }] as any,
      premises: [{ id: "P1", type: "major", text: "", variables: ["E"] }],
    };
    const out = selectCandidates(draft, [make("y", 1, null, [])]);
    expect(out.map((c) => c.id)).toEqual(["y"]);
  });
});
