// lib/argumentation/__tests__/instantiate.test.ts
//
// Phase 2 tests: the ASPIC+ instantiation contract.
//
// These lock the property that the structured (ASPIC+) and abstract (Dung)
// layers share ONE defeat graph: a preference-resolved `Defeat[]` relation,
// once instantiated, yields the same grounded extension as `lib/aspic`'s
// `computeGroundedExtension`, AND now also flows into preferred / stable /
// semi-stable (which preferences previously never reached).

import {
  instantiateDefeatGraph,
  groundedExtensionDG,
  preferredExtensionsDG,
  stableExtensions,
  type InstantiableArgument,
  type InstantiableDefeat,
} from "@/lib/argumentation";
import { computeGroundedExtension } from "@/lib/aspic/semantics";
import type { Argument, Defeat } from "@/lib/aspic/types";

// ---- tiny ASPIC+ argument/defeat builders ----------------------------------

const arg = (id: string): Argument =>
  ({
    id,
    premises: new Set<string>(),
    conclusion: id,
    subArguments: [],
    defeasibleRules: new Set<string>(),
    structure: { type: "premise", formula: id, source: "premise" },
  } as Argument);

const defeat = (defeater: Argument, defeated: Argument): Defeat =>
  ({
    defeater,
    defeated,
    attack: {
      attacker: defeater,
      attacked: defeated,
      type: "rebutting",
      target: {},
    },
    preferenceApplied: false,
  } as Defeat);

const ids = (s: Set<string>): string[] => [...s].sort();
const family = (fam: Set<string>[]): string[][] =>
  fam.map(ids).sort((a, b) => a.join("|").localeCompare(b.join("|")));

describe("Phase 2 — ASPIC+ instantiation contract", () => {
  it("instantiated grounded agrees with computeGroundedExtension (a defeats b)", () => {
    const a = arg("a");
    const b = arg("b");
    const args = [a, b];
    const defeats = [defeat(a, b)];

    const dg = instantiateDefeatGraph(args, defeats);
    const dgGrounded = ids(groundedExtensionDG(dg));

    const aspic = computeGroundedExtension(args, defeats);
    expect(dgGrounded).toEqual(ids(aspic.inArguments));
    expect(dgGrounded).toEqual(["a"]);
  });

  it("instantiated grounded agrees on a defense chain a→b→c", () => {
    const a = arg("a");
    const b = arg("b");
    const c = arg("c");
    const args = [a, b, c];
    const defeats = [defeat(a, b), defeat(b, c)];

    const dg = instantiateDefeatGraph(args, defeats);
    const aspic = computeGroundedExtension(args, defeats);

    expect(ids(groundedExtensionDG(dg))).toEqual(["a", "c"]);
    expect(ids(aspic.inArguments)).toEqual(["a", "c"]);
    expect(ids(aspic.outArguments)).toEqual(["b"]);
  });

  it("mutual defeat a⇄b: grounded leaves both UNDEC but preferred/stable see both resolutions", () => {
    const a = arg("a");
    const b = arg("b");
    const args = [a, b];
    const defeats = [defeat(a, b), defeat(b, a)];

    const dg = instantiateDefeatGraph(args, defeats);
    const aspic = computeGroundedExtension(args, defeats);

    // ASPIC+ grounded (= shared core grounded): both undecided.
    expect(ids(aspic.inArguments)).toEqual([]);
    expect(ids(aspic.undecidedArguments)).toEqual(["a", "b"]);
    expect(ids(groundedExtensionDG(dg))).toEqual([]);

    // The instantiation now reaches preferred/stable — the thing preferences
    // previously could never influence.
    expect(family(preferredExtensionsDG(dg))).toEqual([["a"], ["b"]]);
    expect(family(stableExtensions(dg))).toEqual([["a"], ["b"]]);
  });

  it("preference resolution shows up as an asymmetric defeat → preferred picks the winner", () => {
    // Two conflicting arguments where preference resolved the conflict so that
    // only a defeats b (b's counter-attack did not survive as a defeat).
    const a = arg("a");
    const b = arg("b");
    const args = [a, b];
    const defeats = [defeat(a, b)]; // asymmetric: preference let a win

    const dg = instantiateDefeatGraph(args, defeats);
    expect(family(preferredExtensionsDG(dg))).toEqual([["a"]]);
    expect(family(stableExtensions(dg))).toEqual([["a"]]);
  });

  it("ignores defeats that reference unknown arguments", () => {
    const a = arg("a");
    const b = arg("b");
    const ghost = arg("ghost");
    const args: InstantiableArgument[] = [a, b];
    const defeats: InstantiableDefeat[] = [defeat(a, b), defeat(ghost, a)];

    const dg = instantiateDefeatGraph(args, defeats);
    expect(dg.args.sort()).toEqual(["a", "b"]);
    expect(ids(groundedExtensionDG(dg))).toEqual(["a"]); // ghost defeat dropped
  });
});
