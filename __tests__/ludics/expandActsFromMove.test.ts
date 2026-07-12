/**
 * Phase 1f: Unit Tests for Ludics ASPIC+ Integration
 * 
 * Tests expandActsFromMove function in compileFromMoves.ts
 * Verifies ASPIC+ metadata extraction from DialogueMoves
 */

import { expandActsFromMove, type Move } from "@/packages/ludics-engine/compileFromMoves";

describe("expandActsFromMove - ASPIC+ Integration", () => {
  describe("ASPIC+ Metadata Extraction", () => {
    it("should extract ASPIC+ metadata from WHY move", () => {
      const move: Move = {
        id: "move_123",
        kind: "WHY",
        payload: {
          acts: [
            {
              polarity: "neg" as const,
              locusPath: "0.1",
              expression: "Why is this true?",
              openings: [],
              additive: false,
            },
          ],
          cqKey: "CQ_PREMISE_ACCEPTABILITY",
          cqText: "Is premise P1 acceptable?",
          aspicAttack: {
            type: "UNDERMINES",
            attackerId: "arg_A",
            defenderId: "arg_B",
            succeeded: true,
          },
          aspicMetadata: {
            targetScope: "premise",
            reason: "Premise lacks evidence",
          },
        },
        targetType: "argument",
        targetId: "arg_B",
        actorId: "user_123",
      };

      const acts = expandActsFromMove(move);

      expect(acts).toHaveLength(1);
      expect(acts[0].aspic).toBeDefined();
      expect(acts[0].aspic?.attackType).toBe("UNDERMINES");
      expect(acts[0].aspic?.attackerId).toBe("arg_A");
      expect(acts[0].aspic?.defenderId).toBe("arg_B");
      expect(acts[0].aspic?.succeeded).toBe(true);
      expect(acts[0].aspic?.targetScope).toBe("premise");
      expect(acts[0].aspic?.cqKey).toBe("CQ_PREMISE_ACCEPTABILITY");
      expect(acts[0].aspic?.cqText).toBe("Is premise P1 acceptable?");
      expect(acts[0].aspic?.reason).toBe("Premise lacks evidence");
    });

    it("should handle moves without ASPIC metadata", () => {
      const move: Move = {
        id: "move_456",
        kind: "ASSERT",
        payload: {
          acts: [
            {
              polarity: "pos" as const,
              locusPath: "0",
              expression: "Climate change is real",
              openings: ["1"],
              additive: false,
            },
          ],
        },
        targetType: "claim",
        targetId: "claim_X",
        actorId: "user_123",
      };

      const acts = expandActsFromMove(move);

      expect(acts).toHaveLength(1);
      expect(acts[0].aspic).toBeNull();
    });

    it("should extract ASPIC+ for undercutting attacks", () => {
      const move: Move = {
        id: "move_789",
        kind: "WHY",
        payload: {
          acts: [
            {
              polarity: "neg" as const,
              locusPath: "0.2.1",
              expression: "Is there an exceptional case?",
              openings: [],
            },
          ],
          cqKey: "CQ_EXCEPTIONAL_CASE",
          cqText: "Are there exceptions to this rule?",
          aspicAttack: {
            type: "UNDERCUTS",
            attackerId: "arg_C",
            defenderId: "arg_D",
            succeeded: true,
          },
          aspicMetadata: {
            targetScope: "inference",
            reason: "Rule may not apply universally",
          },
        },
        targetType: "argument",
        targetId: "arg_D",
        actorId: "user_456",
      };

      const acts = expandActsFromMove(move);

      expect(acts).toHaveLength(1);
      expect(acts[0].aspic?.attackType).toBe("UNDERCUTS");
      expect(acts[0].aspic?.targetScope).toBe("inference");
    });

    it("should extract ASPIC+ for rebutting attacks", () => {
      const move: Move = {
        id: "move_012",
        kind: "ATTACK",
        payload: {
          acts: [
            {
              polarity: "neg" as const,
              locusPath: "0.3",
              expression: "Actually, the opposite is true",
              openings: [],
            },
          ],
          cqKey: "CQ_ALTERNATIVE_CONCLUSION",
          aspicAttack: {
            type: "REBUTS",
            attackerId: "arg_E",
            defenderId: "arg_F",
            succeeded: false,
          },
          aspicMetadata: {
            targetScope: "conclusion",
          },
        },
        targetType: "argument",
        targetId: "arg_F",
        actorId: "user_789",
      };

      const acts = expandActsFromMove(move);

      expect(acts).toHaveLength(1);
      expect(acts[0].aspic?.attackType).toBe("REBUTS");
      expect(acts[0].aspic?.targetScope).toBe("conclusion");
      expect(acts[0].aspic?.succeeded).toBe(false);
    });
  });

  describe("Multi-Act Moves", () => {
    it("should extract ASPIC+ for moves with multiple acts", () => {
      const move: Move = {
        id: "move_multi",
        kind: "THEREFORE",
        payload: {
          acts: [
            {
              polarity: "pos" as const,
              locusPath: "0.4",
              expression: "Premise 1",
              openings: [],
            },
            {
              polarity: "pos" as const,
              locusPath: "0.4.1",
              expression: "Premise 2",
              openings: [],
            },
            {
              polarity: "pos" as const,
              locusPath: "0.4.2",
              expression: "Therefore, conclusion",
              openings: [],
            },
          ],
          aspicAttack: {
            type: "UNDERMINES",
            attackerId: "arg_synthesized",
            defenderId: "arg_target",
            succeeded: true,
          },
        },
        targetType: "argument",
        targetId: "arg_target",
        actorId: "user_999",
      };

      const acts = expandActsFromMove(move);

      expect(acts).toHaveLength(3);
      
      // All acts should have same ASPIC metadata
      acts.forEach((act) => {
        expect(act.aspic?.attackType).toBe("UNDERMINES");
        expect(act.aspic?.attackerId).toBe("arg_synthesized");
        expect(act.aspic?.defenderId).toBe("arg_target");
      });
    });
  });

  describe("Metadata Preservation", () => {
    it("should preserve all DialogueMove fields in act", () => {
      const move: Move = {
        id: "move_preserve",
        kind: "WHY",
        payload: {
          acts: [
            {
              polarity: "neg" as const,
              locusPath: "0.5",
              expression: "Why?",
              openings: [],
            },
          ],
          cqId: "cq_full_test",
          cqKey: "CQ_TEST",
          cqText: "Test CQ?",
          aspicAttack: {
            type: "UNDERMINES",
            attackerId: "arg_G",
            defenderId: "arg_H",
            succeeded: true,
          },
          aspicMetadata: {
            targetScope: "premise",
            reason: "Test reason",
            schemeKey: "test-scheme",
          },
        },
        targetType: "argument",
        targetId: "arg_H",
        actorId: "user_test",
      };

      const acts = expandActsFromMove(move);

      expect(acts).toHaveLength(1);
      const act = acts[0];

      // Verify move metadata
      expect(act.moveId).toBe("move_preserve");
      expect(act.targetType).toBe("argument");
      expect(act.targetId).toBe("arg_H");
      expect(act.actorId).toBe("user_test");

      // Verify ASPIC metadata
      expect(act.aspic).toBeDefined();
      expect(act.aspic?.attackType).toBe("UNDERMINES");
      expect(act.aspic?.attackerId).toBe("arg_G");
      expect(act.aspic?.defenderId).toBe("arg_H");
      expect(act.aspic?.targetScope).toBe("premise");
      expect(act.aspic?.reason).toBe("Test reason");
    });

    it("should handle moves with empty payload", () => {
      const move: Move = {
        id: "move_empty",
        kind: "ASSERT",
        payload: {},
        targetType: "claim",
        targetId: "claim_empty",
        actorId: "user_empty",
      };

      const acts = expandActsFromMove(move);

      // Should return empty array if no acts in payload
      expect(acts).toEqual([]);
    });

    it("should handle moves with undefined payload", () => {
      const move: Move = {
        id: "move_no_payload",
        kind: "ASSERT",
        targetType: "claim",
        targetId: "claim_no_payload",
        actorId: "user_no_payload",
      };

      const acts = expandActsFromMove(move);

      expect(acts).toEqual([]);
    });
  });

  describe("Act Fields", () => {
    it("should populate all act fields correctly", () => {
      const move: Move = {
        id: "move_fields",
        kind: "ASSERT",
        payload: {
          acts: [
            {
              polarity: "pos" as const,
              locusPath: "0.6",
              expression: "Test expression",
              openings: ["1", "2"],
              additive: true,
            },
          ],
        },
        targetType: "claim",
        targetId: "claim_fields",
        actorId: "user_fields",
      };

      const acts = expandActsFromMove(move);

      expect(acts).toHaveLength(1);
      const act = acts[0];

      expect(act.polarity).toBe("pos");
      expect(act.locusPath).toBe("0.6");
      expect(act.expression).toBe("Test expression");
      expect(act.openings).toEqual(["1", "2"]);
      expect(act.isAdditive).toBe(true);
      expect(act.moveId).toBe("move_fields");
      expect(act.targetType).toBe("claim");
      expect(act.targetId).toBe("claim_fields");
      expect(act.actorId).toBe("user_fields");
    });

    it("should provide default values for missing act fields", () => {
      const move: Move = {
        id: "move_defaults",
        kind: "ASSERT",
        payload: {
          acts: [
            {
              polarity: "pos" as const,
              // Missing locusPath, openings, expression, additive
            } as any,
          ],
        },
        targetType: "claim",
        targetId: "claim_defaults",
        actorId: "user_defaults",
      };

      const acts = expandActsFromMove(move);

      expect(acts).toHaveLength(1);
      const act = acts[0];

      expect(act.locusPath).toBe("0"); // Default
      expect(act.openings).toEqual([]); // Default
      expect(act.expression).toBe(""); // Default
      expect(act.isAdditive).toBe(false); // Default (!!undefined)
    });
  });
});
