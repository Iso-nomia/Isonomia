// tests/aif-aspic-translation.test.ts
import { aifToASPIC } from "@/lib/aif/translation/aifToAspic";
import type { AIFGraph } from "@/lib/aif/types";

describe("AIF → ASPIC+ Translation", () => {
  it("should extract premises from I-nodes with no incoming edges", () => {
    const graph: AIFGraph = {
      nodes: [
        { id: "I:1", nodeType: "I", content: "All humans are mortal", claimText: "All humans are mortal", debateId: "test" },
        { id: "I:2", nodeType: "I", content: "Socrates is human", claimText: "Socrates is human", debateId: "test" },
        { id: "I:3", nodeType: "I", content: "Socrates is mortal", claimText: "Socrates is mortal", debateId: "test" },
        { id: "RA:1", nodeType: "RA", content: "", inferenceType: "modus_ponens", debateId: "test" },
      ],
      edges: [
        { id: "E:1", sourceId: "I:1", targetId: "RA:1", edgeType: "premise", debateId: "test" },
        { id: "E:2", sourceId: "I:2", targetId: "RA:1", edgeType: "premise", debateId: "test" },
        { id: "E:3", sourceId: "RA:1", targetId: "I:3", edgeType: "conclusion", debateId: "test" },
      ],
    };

    const theory = aifToASPIC(graph);

    expect(theory.premises.size).toBe(2);
    expect(theory.premises.has("All humans are mortal")).toBe(true);
    expect(theory.premises.has("Socrates is human")).toBe(true);
    expect(theory.premises.has("Socrates is mortal")).toBe(false); // conclusion, not premise
  });

  it("should populate assumptions from presumption edges", () => {
    const graph: AIFGraph = {
      nodes: [
        { id: "I:1", nodeType: "I", content: "Birds typically fly", claimText: "Birds typically fly", debateId: "test" },
        { id: "I:2", nodeType: "I", content: "Tweety is a bird", claimText: "Tweety is a bird", debateId: "test" },
        { id: "I:3", nodeType: "I", content: "Tweety flies", claimText: "Tweety flies", debateId: "test" },
        { id: "RA:1", nodeType: "RA", content: "", schemeType: "defeasible", inferenceType: "sign", debateId: "test" },
        { id: "I:4", nodeType: "I", content: "Flying is the default for birds", claimText: "Flying is the default for birds", debateId: "test" },
      ],
      edges: [
        { id: "E:1", sourceId: "I:1", targetId: "RA:1", edgeType: "premise", debateId: "test" },
        { id: "E:2", sourceId: "I:2", targetId: "RA:1", edgeType: "premise", debateId: "test" },
        { id: "E:3", sourceId: "RA:1", targetId: "I:3", edgeType: "conclusion", debateId: "test" },
        { id: "E:4", sourceId: "I:4", targetId: "RA:1", edgeType: "presumption", debateId: "test" },
      ],
    };

    const theory = aifToASPIC(graph);

    // Verify assumptions are populated
    expect(theory.assumptions.size).toBe(1);
    expect(theory.assumptions.has("Flying is the default for birds")).toBe(true);

    // Verify premises (includes the presumption node since it has no incoming edges)
    expect(theory.premises.size).toBe(3); // I:1, I:2, and I:4 (presumption)
    expect(theory.premises.has("Birds typically fly")).toBe(true);
    expect(theory.premises.has("Tweety is a bird")).toBe(true);
    expect(theory.premises.has("Flying is the default for birds")).toBe(true); // Also in premises

    // Verify rules extracted
    expect(theory.defeasibleRules.length).toBe(1);
    expect(theory.defeasibleRules[0].antecedents).toEqual([
      "Birds typically fly",
      "Tweety is a bird",
    ]);
    expect(theory.defeasibleRules[0].consequent).toBe("Tweety flies");
  });

  it("should handle multiple assumptions on the same argument", () => {
    const graph: AIFGraph = {
      nodes: [
        { id: "I:1", nodeType: "I", content: "Expert testimony", claimText: "Expert testimony", debateId: "test" },
        { id: "I:2", nodeType: "I", content: "Conclusion from expert", claimText: "Conclusion from expert", debateId: "test" },
        { id: "RA:1", nodeType: "RA", content: "", inferenceType: "expert_opinion", debateId: "test" },
        { id: "I:3", nodeType: "I", content: "Expert is reliable", claimText: "Expert is reliable", debateId: "test" },
        { id: "I:4", nodeType: "I", content: "Expert has no bias", claimText: "Expert has no bias", debateId: "test" },
      ],
      edges: [
        { id: "E:1", sourceId: "I:1", targetId: "RA:1", edgeType: "premise", debateId: "test" },
        { id: "E:2", sourceId: "RA:1", targetId: "I:2", edgeType: "conclusion", debateId: "test" },
        { id: "E:3", sourceId: "I:3", targetId: "RA:1", edgeType: "presumption", debateId: "test" },
        { id: "E:4", sourceId: "I:4", targetId: "RA:1", edgeType: "presumption", debateId: "test" },
      ],
    };

    const theory = aifToASPIC(graph);

    expect(theory.assumptions.size).toBe(2);
    expect(theory.assumptions.has("Expert is reliable")).toBe(true);
    expect(theory.assumptions.has("Expert has no bias")).toBe(true);
  });

  it("should handle exceptions (alternative presumption edge type)", () => {
    const graph: AIFGraph = {
      nodes: [
        { id: "I:1", nodeType: "I", content: "This is a penguin", claimText: "This is a penguin", debateId: "test" },
        { id: "I:2", nodeType: "I", content: "Penguins don't fly", claimText: "Penguins don't fly", debateId: "test" },
        { id: "RA:1", nodeType: "RA", content: "", inferenceType: "sign", debateId: "test" },
        { id: "I:3", nodeType: "I", content: "Being a penguin is an exception", claimText: "Being a penguin is an exception", debateId: "test" },
      ],
      edges: [
        { id: "E:1", sourceId: "I:1", targetId: "RA:1", edgeType: "premise", debateId: "test" },
        { id: "E:2", sourceId: "RA:1", targetId: "I:2", edgeType: "conclusion", debateId: "test" },
        { id: "E:3", sourceId: "I:3", targetId: "RA:1", edgeType: "presumption", debateId: "test" },
      ],
    };

    const theory = aifToASPIC(graph);

    expect(theory.assumptions.size).toBe(1);
    expect(theory.assumptions.has("Being a penguin is an exception")).toBe(true);
  });

  it("should not add non-I-nodes as assumptions", () => {
    const graph: AIFGraph = {
      nodes: [
        { id: "I:1", nodeType: "I", content: "Premise", claimText: "Premise", debateId: "test" },
        { id: "I:2", nodeType: "I", content: "Conclusion", claimText: "Conclusion", debateId: "test" },
        { id: "RA:1", nodeType: "RA", content: "", inferenceType: "modus_ponens", debateId: "test" },
        { id: "RA:2", nodeType: "RA", content: "", inferenceType: "modus_ponens", debateId: "test" },
      ],
      edges: [
        { id: "E:1", sourceId: "I:1", targetId: "RA:1", edgeType: "premise", debateId: "test" },
        { id: "E:2", sourceId: "RA:1", targetId: "I:2", edgeType: "conclusion", debateId: "test" },
        { id: "E:3", sourceId: "RA:2", targetId: "RA:1", edgeType: "presumption", debateId: "test" },
      ],
    };

    const theory = aifToASPIC(graph);

    // Should not add RA:2 to assumptions (only I-nodes allowed)
    expect(theory.assumptions.size).toBe(0);
  });

  it("should extract preferences from PA-nodes", () => {
    const graph: AIFGraph = {
      nodes: [
        { id: "I:1", nodeType: "I", content: "Claim A", claimText: "Claim A", debateId: "test" },
        { id: "I:2", nodeType: "I", content: "Claim B", claimText: "Claim B", debateId: "test" },
        { id: "PA:1", nodeType: "PA", content: "", preferenceType: "argument", debateId: "test" },
      ],
      edges: [
        { id: "E:1", sourceId: "I:1", targetId: "PA:1", edgeType: "preferred", debateId: "test" },
        { id: "E:2", sourceId: "PA:1", targetId: "I:2", edgeType: "dispreferred", debateId: "test" },
      ],
    };

    const theory = aifToASPIC(graph);

    expect(theory.preferences.length).toBe(1);
    expect(theory.preferences[0]).toEqual({
      preferred: "Claim A",
      dispreferred: "Claim B",
    });
  });
});
