/**
 * Phase 1 (issue A) of PA_NODE_PREFERENCE_INTEGRATION_ROADMAP.
 *
 * The bug: `populateKBPreferencesFromAIF` keyed rule preferences by `scheme.id`,
 * but argument construction keys defeasible rules by the RA-node id
 * `RA:<argumentId>`. The two key spaces never met, so every stored rule
 * preference was silently inert and never affected evaluation.
 *
 * Test A locks the cross-layer KEY AGREEMENT (the actual fix): the rule keys
 * emitted from the DB match the rule ids the translation assigns.
 * Test B proves an RA-keyed rule preference actually flips grounded-extension
 * membership (standing) — the end-to-end effect that was missing.
 */
import { describe, test, expect } from "@jest/globals";

const mockPAFindMany = jest.fn();
const mockArgFindUnique = jest.fn(async ({ where }: any) => ({ id: where.id }));
const mockClaimFindUnique = jest.fn(async ({ where }: any) =>
  where.id === "claimP" ? { text: "Preferred claim text" } : { text: "Dispreferred claim text" },
);

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    preferenceApplication: { findMany: (a: any) => mockPAFindMany(a) },
    argument: { findUnique: (a: any) => mockArgFindUnique(a) },
    claim: { findUnique: (a: any) => mockClaimFindUnique(a) },
  },
}));

import { populateKBPreferencesFromAIF } from "@/lib/aspic/translation/aifToASPIC";
import { aifToASPIC, computeAspicSemantics } from "@/lib/aif/translation/aifToAspic";

describe("Test A — rule-preference key agreement (issue A)", () => {
  test("DB rule preferences are keyed by RA:<argId>, matching the translation's rule ids", async () => {
    // A PA preferring argument argA over argB.
    mockPAFindMany.mockResolvedValue([
      {
        id: "pa-rule",
        preferredArgumentId: "argA",
        dispreferredArgumentId: "argB",
        preferredClaimId: null,
        dispreferredClaimId: null,
        preferredSchemeId: null,
        dispreferredSchemeId: null,
      },
    ]);

    const { rulePreferences } = await populateKBPreferencesFromAIF("delib-1");

    expect(rulePreferences).toEqual([{ preferred: "RA:argA", dispreferred: "RA:argB" }]);

    // The translation assigns defeasible-rule ids of the same RA:<argId> form.
    const graph = {
      nodes: [
        { id: "I:p", nodeType: "I", content: "p" },
        { id: "I:c", nodeType: "I", content: "c" },
        { id: "RA:argA", nodeType: "RA", content: "arg a" },
      ],
      edges: [
        { id: "e1", sourceId: "I:p", targetId: "RA:argA", edgeType: "premise" },
        { id: "e2", sourceId: "RA:argA", targetId: "I:c", edgeType: "conclusion" },
      ],
    };
    const theory = aifToASPIC(graph as any);
    const ruleIds = theory.defeasibleRules.map((r) => r.id);

    expect(ruleIds).toContain("RA:argA"); // same key space as the preference above
  });

  test("claim preferences are keyed by claim text (disjoint from rule keys)", async () => {
    mockPAFindMany.mockResolvedValue([
      {
        id: "pa-claim",
        preferredArgumentId: null,
        dispreferredArgumentId: null,
        preferredClaimId: "claimP",
        dispreferredClaimId: "claimD",
        preferredSchemeId: null,
        dispreferredSchemeId: null,
      },
    ]);

    const { premisePreferences, rulePreferences } = await populateKBPreferencesFromAIF("delib-1");

    expect(rulePreferences).toHaveLength(0);
    expect(premisePreferences).toEqual([
      { preferred: "Preferred claim text", dispreferred: "Dispreferred claim text" },
    ]);
  });
});

describe("Test B — RA-keyed rule preference flips grounded-extension standing", () => {
  // Two defeasible rules with contradictory conclusions (c vs ¬c) that rebut.
  const baseTheory = () => ({
    language: new Set(["p", "q", "c", "¬c"]),
    contraries: new Map([
      ["c", new Set(["¬c"])],
      ["¬c", new Set(["c"])],
    ]),
    strictRules: [],
    defeasibleRules: [
      { id: "RA:argA", antecedents: ["p"], consequent: "c", type: "defeasible" as const },
      { id: "RA:argB", antecedents: ["q"], consequent: "¬c", type: "defeasible" as const },
    ],
    axioms: new Set<string>(),
    premises: new Set(["p", "q"]),
    assumptions: new Set<string>(),
    preferences: [] as Array<{ preferred: string; dispreferred: string }>,
  });

  const statusOf = (sem: any, conclusion: string, ruleId: string) => {
    const arg = sem.arguments.find(
      (a: any) => a.conclusion === conclusion && a.topRule?.ruleId === ruleId,
    );
    return arg ? sem.justificationStatus.get(arg.id) : undefined;
  };

  test("without preference: mutual rebut leaves both undecided", () => {
    const sem = computeAspicSemantics(baseTheory() as any);
    expect(statusOf(sem, "c", "RA:argA")).toBe("undec");
    expect(statusOf(sem, "¬c", "RA:argB")).toBe("undec");
  });

  test("with RA:argA > RA:argB: argA is IN, argB is OUT", () => {
    const theory = baseTheory();
    theory.preferences = [{ preferred: "RA:argA", dispreferred: "RA:argB" }];

    const sem = computeAspicSemantics(theory as any);
    expect(statusOf(sem, "c", "RA:argA")).toBe("in");
    expect(statusOf(sem, "¬c", "RA:argB")).toBe("out");
  });
});
