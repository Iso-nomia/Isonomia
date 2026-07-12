// tests/composerEnthymemeCheck.test.ts
// Sprint D3 — adapter tests for the composer enthymeme checker.

import { checkComposerEnthymemes } from "@/lib/argumentation/composerEnthymemeCheck";

describe("checkComposerEnthymemes", () => {
  test("no scheme key ⇒ no nudges", () => {
    expect(
      checkComposerEnthymemes({
        argumentId: "a1",
        schemeKey: "",
        requiredRoles: ["warrant"],
        rolesPresent: [],
      })
    ).toEqual([]);
  });

  test("empty required roles ⇒ no nudges", () => {
    expect(
      checkComposerEnthymemes({
        argumentId: "a1",
        schemeKey: "practical_reasoning",
        requiredRoles: [],
        rolesPresent: ["goal"],
      })
    ).toEqual([]);
  });

  test("subset present ⇒ no nudges", () => {
    expect(
      checkComposerEnthymemes({
        argumentId: "a1",
        schemeKey: "practical_reasoning",
        requiredRoles: ["goal", "means"],
        rolesPresent: ["goal", "means", "context"],
      })
    ).toEqual([]);
  });

  test("missing roles ⇒ a single nudge naming them", () => {
    const nudges = checkComposerEnthymemes({
      argumentId: "a1",
      schemeKey: "practical_reasoning",
      requiredRoles: ["goal", "means", "warrant"],
      rolesPresent: ["goal"],
    });
    expect(nudges).toHaveLength(1);
    expect(nudges[0].schemeKey).toBe("practical_reasoning");
    expect(nudges[0].argumentId).toBe("a1");
    expect(nudges[0].missingPremiseRoles.sort()).toEqual(["means", "warrant"]);
  });

  test("idempotent on the same input", () => {
    const input = {
      argumentId: "a1",
      schemeKey: "practical_reasoning",
      requiredRoles: ["goal", "warrant"],
      rolesPresent: ["goal"],
    };
    const a = checkComposerEnthymemes(input);
    const b = checkComposerEnthymemes(input);
    expect(a).toEqual(b);
  });
});
