// tests/aif-aspic-semantics.test.ts
import {
  aifToASPIC,
  computeAspicSemantics,
  aifToAspicWithSemantics,
  aspicToAif,
  evaluateAifWithAspic,
} from "@/lib/aif/translation/aifToAspic";
import type { AIFGraph } from "@/lib/aif/types";

describe("AIF ↔ ASPIC+ Semantic Integration", () => {
  describe("computeAspicSemantics", () => {
    it("should compute complete semantics from theory", () => {
      const graph: AIFGraph = {
        nodes: [
          { id: "I:1", nodeType: "I", content: "p", claimText: "p", debateId: "test" },
          { id: "I:2", nodeType: "I", content: "q", claimText: "q", debateId: "test" },
          { id: "RA:1", nodeType: "RA", content: "r1", schemeType: "deductive", inferenceType: "modus_ponens", debateId: "test" },
          { id: "I:3", nodeType: "I", content: "r", claimText: "r", debateId: "test" },
        ],
        edges: [
          { id: "E:1", sourceId: "I:1", targetId: "RA:1", edgeType: "premise", debateId: "test" },
          { id: "E:2", sourceId: "I:2", targetId: "RA:1", edgeType: "premise", debateId: "test" },
          { id: "E:3", sourceId: "RA:1", targetId: "I:3", edgeType: "conclusion", debateId: "test" },
        ],
      };

      const theory = aifToASPIC(graph);
      const semantics = computeAspicSemantics(theory);

      expect(semantics.arguments).toBeDefined();
      expect(Array.isArray(semantics.arguments)).toBe(true);
      expect(semantics.attacks).toBeDefined();
      expect(Array.isArray(semantics.attacks)).toBe(true);
      expect(semantics.defeats).toBeDefined();
      expect(Array.isArray(semantics.defeats)).toBe(true);
      expect(semantics.groundedExtension).toBeInstanceOf(Set);
      expect(semantics.justificationStatus).toBeInstanceOf(Map);
    });

    it("should compute grounded extension correctly", () => {
      const graph: AIFGraph = {
        nodes: [
          { id: "I:1", nodeType: "I", content: "a", claimText: "a", debateId: "test" },
        ],
        edges: [],
      };

      const theory = aifToASPIC(graph);
      const semantics = computeAspicSemantics(theory);

      // Single premise should be in grounded extension
      expect(semantics.arguments.length).toBeGreaterThan(0);
      const premiseArg = semantics.arguments.find(arg => arg.conclusion === "a");
      expect(premiseArg).toBeDefined();
      if (premiseArg) {
        expect(semantics.groundedExtension.has(premiseArg.id)).toBe(true);
        expect(semantics.justificationStatus.get(premiseArg.id)).toBe("in");
      }
    });
  });

  describe("aifToAspicWithSemantics", () => {
    it("should return only theory when computeSemantics=false", () => {
      const graph: AIFGraph = {
        nodes: [
          { id: "I:1", nodeType: "I", content: "p", claimText: "p", debateId: "test" },
        ],
        edges: [],
      };

      const result = aifToAspicWithSemantics(graph, false);

      expect(result.theory).toBeDefined();
      expect(result.semantics).toBeUndefined();
    });

    it("should return both theory and semantics when computeSemantics=true", () => {
      const graph: AIFGraph = {
        nodes: [
          { id: "I:1", nodeType: "I", content: "p", claimText: "p", debateId: "test" },
        ],
        edges: [],
      };

      const result = aifToAspicWithSemantics(graph, true);

      expect(result.theory).toBeDefined();
      expect(result.semantics).toBeDefined();
      expect(result.semantics?.arguments).toBeDefined();
      expect(result.semantics?.groundedExtension).toBeInstanceOf(Set);
    });
  });

  describe("aspicToAif", () => {
    it("should create I-nodes for premises and conclusions", () => {
      const graph: AIFGraph = {
        nodes: [
          { id: "I:1", nodeType: "I", content: "p", claimText: "p", debateId: "test" },
          { id: "I:2", nodeType: "I", content: "q", claimText: "q", debateId: "test" },
        ],
        edges: [],
      };

      const theory = aifToASPIC(graph);
      const semantics = computeAspicSemantics(theory);

      const outputGraph = aspicToAif(
        semantics.arguments,
        semantics.attacks,
        semantics.defeats,
        "test"
      );

      expect(outputGraph.nodes.length).toBeGreaterThan(0);
      expect(outputGraph.edges.length).toBeGreaterThanOrEqual(0);

      // Should have I-nodes for premises
      const iNodes = outputGraph.nodes.filter(n => n.nodeType === "I");
      expect(iNodes.length).toBeGreaterThan(0);
    });

    it("should create CA-nodes for defeats", () => {
      const graph: AIFGraph = {
        nodes: [
          { id: "I:1", nodeType: "I", content: "p", claimText: "p", debateId: "test" },
          { id: "I:2", nodeType: "I", content: "¬p", claimText: "¬p", debateId: "test" },
          { id: "CA:1", nodeType: "CA", content: "conflict", conflictType: "rebut", debateId: "test" },
        ],
        edges: [
          { id: "E:1", sourceId: "I:1", targetId: "CA:1", edgeType: "conflicting", debateId: "test" },
          { id: "E:2", sourceId: "CA:1", targetId: "I:2", edgeType: "conflicted", debateId: "test" },
        ],
      };

      const theory = aifToASPIC(graph);
      
      // Add contrariness for testing
      theory.contraries.set("p", new Set(["¬p"]));
      theory.contraries.set("¬p", new Set(["p"]));

      const semantics = computeAspicSemantics(theory);

      const outputGraph = aspicToAif(
        semantics.arguments,
        semantics.attacks,
        semantics.defeats,
        "test"
      );

      // If there are defeats, should have CA-nodes
      if (semantics.defeats.length > 0) {
        const caNodes = outputGraph.nodes.filter(n => n.nodeType === "CA");
        expect(caNodes.length).toBeGreaterThan(0);
      }
    });
  });

  describe("evaluateAifWithAspic", () => {
    it("should perform full evaluation pipeline", () => {
      const inputGraph: AIFGraph = {
        nodes: [
          { id: "I:1", nodeType: "I", content: "p", claimText: "p", debateId: "test" },
          { id: "I:2", nodeType: "I", content: "q", claimText: "q", debateId: "test" },
          { id: "RA:1", nodeType: "RA", content: "r1", schemeType: "deductive", inferenceType: "modus_ponens", debateId: "test" },
          { id: "I:3", nodeType: "I", content: "r", claimText: "r", debateId: "test" },
        ],
        edges: [
          { id: "E:1", sourceId: "I:1", targetId: "RA:1", edgeType: "premise", debateId: "test" },
          { id: "E:2", sourceId: "I:2", targetId: "RA:1", edgeType: "premise", debateId: "test" },
          { id: "E:3", sourceId: "RA:1", targetId: "I:3", edgeType: "conclusion", debateId: "test" },
        ],
      };

      const result = evaluateAifWithAspic(inputGraph, "test");

      expect(result.outputGraph).toBeDefined();
      expect(result.semantics).toBeDefined();
      expect(result.outputGraph.nodes.length).toBeGreaterThan(0);
      expect(result.semantics.arguments.length).toBeGreaterThan(0);
      expect(result.semantics.groundedExtension.size).toBeGreaterThan(0);
    });

    it("should preserve debate ID in output graph", () => {
      const inputGraph: AIFGraph = {
        nodes: [
          { id: "I:1", nodeType: "I", content: "p", claimText: "p", debateId: "original" },
        ],
        edges: [],
      };

      const result = evaluateAifWithAspic(inputGraph, "custom-debate-id");

      const allNodesHaveDebateId = result.outputGraph.nodes.every(
        n => n.debateId === "custom-debate-id"
      );
      expect(allNodesHaveDebateId).toBe(true);
    });
  });

  describe("Round-trip integrity", () => {
    it("should preserve premise structure in round-trip", () => {
      const inputGraph: AIFGraph = {
        nodes: [
          { id: "I:1", nodeType: "I", content: "premise1", claimText: "premise1", debateId: "test" },
          { id: "I:2", nodeType: "I", content: "premise2", claimText: "premise2", debateId: "test" },
        ],
        edges: [],
      };

      const theory = aifToASPIC(inputGraph);
      const semantics = computeAspicSemantics(theory);
      const outputGraph = aspicToAif(
        semantics.arguments,
        semantics.attacks,
        semantics.defeats,
        "test"
      );

      // Original premises should appear in output
      const outputContents = new Set(
        outputGraph.nodes
          .filter(n => n.nodeType === "I")
          .map(n => n.content)
      );

      expect(outputContents.has("premise1")).toBe(true);
      expect(outputContents.has("premise2")).toBe(true);
    });
  });
});
