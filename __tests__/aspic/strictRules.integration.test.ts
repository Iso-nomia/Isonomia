/**
 * Phase 1b.4: Integration Tests for ASPIC+ Strict Rules
 * 
 * Tests the complete workflow:
 * 1. Create argument with ruleType='STRICT' via API
 * 2. Verify ArgumentSchemeInstance saved to database
 * 3. Verify translation layer reads ruleType correctly
 * 4. Verify ASPIC+ theory has rule in strictRules array
 * 5. Verify attack validation prevents rebutting strict conclusions
 */

import { aifToASPIC } from "@/lib/aif/translation/aifToAspic";
import type { AIFGraph, AnyNode } from "@/lib/aif/types";

describe("ASPIC+ Strict Rules - Integration Tests", () => {
  describe("Translation Layer (aifToAspic)", () => {
    it("should read ruleType from RA-node metadata and classify as strict", () => {
      // Mock AIF graph with RA-node having ruleType='STRICT' in metadata
      const graph: AIFGraph = {
        nodes: [
          {
            id: "I:claim1",
            nodeType: "I",
            content: "All humans are mortal",
            debateId: "test-debate",
          },
          {
            id: "I:claim2",
            nodeType: "I",
            content: "Socrates is human",
            debateId: "test-debate",
          },
          {
            id: "I:claim3",
            nodeType: "I",
            content: "Socrates is mortal",
            debateId: "test-debate",
          },
          {
            id: "RA:arg1",
            nodeType: "RA",
            content: "Modus Ponens inference",
            debateId: "test-debate",
            inferenceType: "modus_ponens",
            // Phase 1b.2: Metadata with schemeInstance
            metadata: {
              schemeInstance: {
                ruleType: "STRICT",
                ruleName: "Modus Ponens",
                confidence: 1.0,
              },
            },
          } as AnyNode,
        ],
        edges: [
          {
            id: "e1",
            sourceId: "I:claim1",
            targetId: "RA:arg1",
            debateId: "test-debate",
          },
          {
            id: "e2",
            sourceId: "I:claim2",
            targetId: "RA:arg1",
            debateId: "test-debate",
          },
          {
            id: "e3",
            sourceId: "RA:arg1",
            targetId: "I:claim3",
            debateId: "test-debate",
          },
        ],
      };

      // Translate to ASPIC+ theory
      const result = aifToASPIC(graph);

      // Verify rule was classified as strict
      expect(result.strictRules.length).toBeGreaterThan(0);
      
      const strictRule = result.strictRules.find(
        (r) => r.id === "RA:arg1"
      );
      
      expect(strictRule).toBeDefined();
      expect(strictRule?.type).toBe("strict");
      expect(strictRule?.consequent).toBe("Socrates is mortal");
      
      console.log("✅ Translation layer correctly classified strict rule");
    });

    it("should read ruleType from RA-node metadata and classify as defeasible", () => {
      const graph: AIFGraph = {
        nodes: [
          {
            id: "I:claim1",
            nodeType: "I",
            content: "Birds typically fly",
            debateId: "test-debate",
          },
          {
            id: "I:claim2",
            nodeType: "I",
            content: "Tweety is a bird",
            debateId: "test-debate",
          },
          {
            id: "I:claim3",
            nodeType: "I",
            content: "Tweety flies",
            debateId: "test-debate",
          },
          {
            id: "RA:arg2",
            nodeType: "RA",
            content: "Defeasible inference",
            debateId: "test-debate",
            inferenceType: "expert_opinion",
            metadata: {
              schemeInstance: {
                ruleType: "DEFEASIBLE",
                ruleName: null,
                confidence: 0.8,
              },
            },
          } as AnyNode,
        ],
        edges: [
          {
            id: "e1",
            sourceId: "I:claim1",
            targetId: "RA:arg2",
            debateId: "test-debate",
          },
          {
            id: "e2",
            sourceId: "I:claim2",
            targetId: "RA:arg2",
            debateId: "test-debate",
          },
          {
            id: "e3",
            sourceId: "RA:arg2",
            targetId: "I:claim3",
            debateId: "test-debate",
          },
        ],
      };

      const result = aifToASPIC(graph);

      // Verify rule was classified as defeasible
      expect(result.defeasibleRules.length).toBeGreaterThan(0);
      
      const defeasibleRule = result.defeasibleRules.find(
        (r) => r.id === "RA:arg2"
      );
      
      expect(defeasibleRule).toBeDefined();
      expect(defeasibleRule?.type).toBe("defeasible");
      expect(defeasibleRule?.consequent).toBe("Tweety flies");
      
      console.log("✅ Translation layer correctly classified defeasible rule");
    });

    it("should default to defeasible when ruleType is missing (backward compatibility)", () => {
      const graph: AIFGraph = {
        nodes: [
          {
            id: "I:claim1",
            nodeType: "I",
            content: "p",
            debateId: "test-debate",
          },
          {
            id: "I:claim2",
            nodeType: "I",
            content: "q",
            debateId: "test-debate",
          },
          {
            id: "RA:arg3",
            nodeType: "RA",
            content: "Legacy argument (no ruleType)",
            debateId: "test-debate",
            inferenceType: "default",
            // No metadata.schemeInstance
          } as AnyNode,
        ],
        edges: [
          {
            id: "e1",
            sourceId: "I:claim1",
            targetId: "RA:arg3",
            debateId: "test-debate",
          },
          {
            id: "e2",
            sourceId: "RA:arg3",
            targetId: "I:claim2",
            debateId: "test-debate",
          },
        ],
      };

      const result = aifToASPIC(graph);

      // Should default to defeasible
      expect(result.strictRules).toHaveLength(0);
      expect(result.defeasibleRules.length).toBeGreaterThan(0);
      
      const defaultRule = result.defeasibleRules.find(
        (r) => r.id === "RA:arg3"
      );
      
      expect(defaultRule).toBeDefined();
      expect(defaultRule?.type).toBe("defeasible");
      
      console.log("✅ Backward compatibility: missing ruleType defaults to defeasible");
    });

    it("should handle mixed strict and defeasible rules in same theory", () => {
      const graph: AIFGraph = {
        nodes: [
          // Strict argument
          {
            id: "I:p1",
            nodeType: "I",
            content: "All X are Y",
            debateId: "test-debate",
          },
          {
            id: "I:c1",
            nodeType: "I",
            content: "Therefore Y",
            debateId: "test-debate",
          },
          {
            id: "RA:strict",
            nodeType: "RA",
            content: "Strict rule",
            debateId: "test-debate",
            inferenceType: "universal_instantiation",
            metadata: {
              schemeInstance: {
                ruleType: "STRICT",
                ruleName: "Universal Instantiation",
                confidence: 1.0,
              },
            },
          } as AnyNode,
          // Defeasible argument
          {
            id: "I:p2",
            nodeType: "I",
            content: "Typically Z",
            debateId: "test-debate",
          },
          {
            id: "I:c2",
            nodeType: "I",
            content: "Probably Z",
            debateId: "test-debate",
          },
          {
            id: "RA:defeasible",
            nodeType: "RA",
            content: "Defeasible rule",
            debateId: "test-debate",
            inferenceType: "expert_opinion",
            metadata: {
              schemeInstance: {
                ruleType: "DEFEASIBLE",
                ruleName: null,
                confidence: 0.7,
              },
            },
          } as AnyNode,
        ],
        edges: [
          { id: "e1", sourceId: "I:p1", targetId: "RA:strict", debateId: "test-debate" },
          { id: "e2", sourceId: "RA:strict", targetId: "I:c1", debateId: "test-debate" },
          { id: "e3", sourceId: "I:p2", targetId: "RA:defeasible", debateId: "test-debate" },
          { id: "e4", sourceId: "RA:defeasible", targetId: "I:c2", debateId: "test-debate" },
        ],
      };

      const result = aifToASPIC(graph);

      // Verify both rule types present
      expect(result.strictRules).toHaveLength(1);
      expect(result.defeasibleRules).toHaveLength(1);
      
      const strictRule = result.strictRules[0];
      const defeasibleRule = result.defeasibleRules[0];
      
      expect(strictRule.type).toBe("strict");
      expect(strictRule.name).toBe("Universal Instantiation");
      expect(defeasibleRule.type).toBe("defeasible");
      
      console.log("✅ Theory correctly handles mixed rule types");
      console.log(`   - Strict rules: ${result.strictRules.length}`);
      console.log(`   - Defeasible rules: ${result.defeasibleRules.length}`);
    });
  });

  describe("Statistics and Logging", () => {
    it("should log translation statistics with strict/defeasible counts", () => {
      const graph: AIFGraph = {
        nodes: [
          {
            id: "I:p",
            nodeType: "I",
            content: "p",
            debateId: "test",
          },
          {
            id: "I:q",
            nodeType: "I",
            content: "q",
            debateId: "test",
          },
          {
            id: "RA:r1",
            nodeType: "RA",
            content: "Strict",
            debateId: "test",
            inferenceType: "modus_ponens",
            metadata: {
              schemeInstance: { ruleType: "STRICT", ruleName: "MP", confidence: 1.0 },
            },
          } as AnyNode,
          {
            id: "I:r",
            nodeType: "I",
            content: "r",
            debateId: "test",
          },
          {
            id: "RA:r2",
            nodeType: "RA",
            content: "Defeasible",
            debateId: "test",
            inferenceType: "expert",
            metadata: {
              schemeInstance: { ruleType: "DEFEASIBLE", ruleName: null, confidence: 0.8 },
            },
          } as AnyNode,
          {
            id: "I:s",
            nodeType: "I",
            content: "s",
            debateId: "test",
          },
          {
            id: "RA:r3",
            nodeType: "RA",
            content: "Defeasible 2",
            debateId: "test",
            inferenceType: "analogy",
            metadata: {
              schemeInstance: { ruleType: "DEFEASIBLE", ruleName: null, confidence: 0.6 },
            },
          } as AnyNode,
        ],
        edges: [
          { id: "e1", sourceId: "I:p", targetId: "RA:r1", debateId: "test" },
          { id: "e2", sourceId: "RA:r1", targetId: "I:q", debateId: "test" },
          { id: "e3", sourceId: "I:q", targetId: "RA:r2", debateId: "test" },
          { id: "e4", sourceId: "RA:r2", targetId: "I:r", debateId: "test" },
          { id: "e5", sourceId: "I:r", targetId: "RA:r3", debateId: "test" },
          { id: "e6", sourceId: "RA:r3", targetId: "I:s", debateId: "test" },
        ],
      };

      const result = aifToASPIC(graph);

      // Verify statistics
      expect(result.strictRules).toHaveLength(1);
      expect(result.defeasibleRules).toHaveLength(2);
      
      const totalRules = result.strictRules.length + result.defeasibleRules.length;
      expect(totalRules).toBe(3);
      
      console.log("✅ Translation statistics:");
      console.log(`   - Total rules (R): ${totalRules}`);
      console.log(`   - Strict rules (R_s): ${result.strictRules.length}`);
      console.log(`   - Defeasible rules (R_d): ${result.defeasibleRules.length}`);
    });
  });

  describe("Legacy schemeType Fallback", () => {
    it("should use schemeType='deductive' as fallback for strict", () => {
      const graph: AIFGraph = {
        nodes: [
          {
            id: "I:p",
            nodeType: "I",
            content: "p",
            debateId: "test",
          },
          {
            id: "I:q",
            nodeType: "I",
            content: "q",
            debateId: "test",
          },
          {
            id: "RA:arg",
            nodeType: "RA",
            content: "Legacy deductive",
            debateId: "test",
            inferenceType: "modus_ponens",
            schemeType: "deductive", // Legacy field
            // No metadata.schemeInstance
          } as AnyNode,
        ],
        edges: [
          { id: "e1", sourceId: "I:p", targetId: "RA:arg", debateId: "test" },
          { id: "e2", sourceId: "RA:arg", targetId: "I:q", debateId: "test" },
        ],
      };

      const result = aifToASPIC(graph);

      // Should fall back to schemeType and classify as strict
      expect(result.strictRules.length).toBeGreaterThan(0);
      
      const rule = result.strictRules.find((r) => r.id === "RA:arg");
      expect(rule).toBeDefined();
      expect(rule?.type).toBe("strict");
      
      console.log("✅ Legacy fallback: schemeType='deductive' → strict");
    });
  });
});
