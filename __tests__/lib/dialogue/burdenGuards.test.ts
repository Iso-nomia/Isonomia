// __tests__/lib/dialogue/burdenGuards.test.ts
import {
  canPostWhy,
  canPostGrounds,
  canConcede,
  canRetract,
  canPostMove,
  requiresEvidenceFromActor,
  disabledTooltip,
  premiseTypeHeader,
} from "../../../lib/dialogue/burdenGuards";
import type { BurdenOfProof } from "@prisma/client";

const BURDENS: BurdenOfProof[] = ["PROPONENT", "CHALLENGER", "OPPONENT"];

describe("burdenGuards — legality table (spec §4.1)", () => {
  // WHY: always challenger
  for (const b of BURDENS) {
    test(`WHY: burden=${b}, isProponent=true  → false`, () => {
      expect(canPostWhy(b, true)).toBe(false);
    });
    test(`WHY: burden=${b}, isProponent=false → true`, () => {
      expect(canPostWhy(b, false)).toBe(true);
    });
  }

  // GROUNDS / CONCEDE / RETRACT — burdened party only
  const variants = [
    { name: "GROUNDS", fn: canPostGrounds },
    { name: "CONCEDE", fn: canConcede },
    { name: "RETRACT", fn: canRetract },
  ];
  for (const { name, fn } of variants) {
    test(`${name}: PROPONENT burden + isProponent=true  → true`, () => {
      expect(fn("PROPONENT", true)).toBe(true);
    });
    test(`${name}: PROPONENT burden + isProponent=false → false`, () => {
      expect(fn("PROPONENT", false)).toBe(false);
    });
    test(`${name}: CHALLENGER burden + isProponent=true  → false`, () => {
      expect(fn("CHALLENGER", true)).toBe(false);
    });
    test(`${name}: CHALLENGER burden + isProponent=false → true`, () => {
      expect(fn("CHALLENGER", false)).toBe(true);
    });
    test(`${name}: OPPONENT burden behaves like CHALLENGER`, () => {
      expect(fn("OPPONENT", false)).toBe(true);
      expect(fn("OPPONENT", true)).toBe(false);
    });
  }
});

describe("burdenGuards — canPostMove dispatch", () => {
  test("dispatches WHY/GROUNDS/CONCEDE/RETRACT correctly", () => {
    expect(canPostMove("WHY", "PROPONENT", false)).toBe(true);
    expect(canPostMove("GROUNDS", "PROPONENT", true)).toBe(true);
    expect(canPostMove("CONCEDE", "CHALLENGER", false)).toBe(true);
    expect(canPostMove("RETRACT", "CHALLENGER", true)).toBe(false);
  });
});

describe("burdenGuards — requiresEvidenceFromActor", () => {
  test("short-circuits to false when requiresEvidence=false", () => {
    expect(
      requiresEvidenceFromActor({ burdenOfProof: "PROPONENT", requiresEvidence: false }, true)
    ).toBe(false);
    expect(
      requiresEvidenceFromActor({ burdenOfProof: "CHALLENGER", requiresEvidence: false }, false)
    ).toBe(false);
  });

  test("true when actor carries the burden", () => {
    expect(
      requiresEvidenceFromActor({ burdenOfProof: "PROPONENT", requiresEvidence: true }, true)
    ).toBe(true);
    expect(
      requiresEvidenceFromActor({ burdenOfProof: "CHALLENGER", requiresEvidence: true }, false)
    ).toBe(true);
    expect(
      requiresEvidenceFromActor({ burdenOfProof: "OPPONENT", requiresEvidence: true }, false)
    ).toBe(true);
  });

  test("false when burden is on the other party", () => {
    expect(
      requiresEvidenceFromActor({ burdenOfProof: "PROPONENT", requiresEvidence: true }, false)
    ).toBe(false);
    expect(
      requiresEvidenceFromActor({ burdenOfProof: "CHALLENGER", requiresEvidence: true }, true)
    ).toBe(false);
  });
});

describe("burdenGuards — disabledTooltip copy", () => {
  test("WHY tooltip mentions challenger", () => {
    expect(disabledTooltip("WHY", "PROPONENT")).toMatch(/challenger/i);
  });
  test("GROUNDS tooltip names the burdened party", () => {
    expect(disabledTooltip("GROUNDS", "PROPONENT")).toMatch(/proponent/i);
    expect(disabledTooltip("GROUNDS", "CHALLENGER")).toMatch(/challenger/i);
  });
});

describe("burdenGuards — premiseTypeHeader (spec §4.3)", () => {
  test("ORDINARY → null", () => {
    expect(premiseTypeHeader("ORDINARY")).toEqual({ text: null, borderClass: null });
  });
  test("null → null", () => {
    expect(premiseTypeHeader(null)).toEqual({ text: null, borderClass: null });
  });
  test("ASSUMPTION → sky tint", () => {
    const h = premiseTypeHeader("ASSUMPTION");
    expect(h.text).toMatch(/assumption/i);
    expect(h.borderClass).toMatch(/sky/);
  });
  test("EXCEPTION → amber tint with challenger copy", () => {
    const h = premiseTypeHeader("EXCEPTION");
    expect(h.text).toMatch(/exception/i);
    expect(h.text).toMatch(/challenger/i);
    expect(h.borderClass).toMatch(/amber/);
  });
});
