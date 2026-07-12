/**
 * Phase 1f: Unit Tests for ASPIC+ Conflict Helpers
 * 
 * Tests lib/aspic/conflictHelpers.ts functions:
 * - computeAspicConflictMetadata
 * - extractAspicMetadataFromMove
 * - checkDefeatStatus
 */

import {
  computeAspicConflictMetadata,
  extractAspicMetadataFromMove,
  checkDefeatStatus,
  type AttackContext,
} from "@/lib/aspic/conflictHelpers";

describe("computeAspicConflictMetadata", () => {
  it("should compute metadata for undermining attack from context", () => {
    const context: AttackContext = {
      attackType: "UNDERMINES",
      targetScope: "premise",
      cqKey: "CQ_PREMISE_ACCEPTABILITY",
      cqText: "Is this premise acceptable?",
      schemeKey: "modus-ponens",
    };

    const result = computeAspicConflictMetadata(
      null,
      context,
      "arg_A",
      "arg_B"
    );

    expect(result.aspicAttackType).toBe("undermining");
    expect(result.aspicDefeatStatus).toBe(false); // Legacy attack without computation
    expect(result.aspicMetadata).toBeDefined();
    if (result.aspicMetadata) {
      expect(result.aspicMetadata.cqKey).toBe("CQ_PREMISE_ACCEPTABILITY");
      expect(result.aspicMetadata.targetScope).toBe("premise");
      expect(result.aspicMetadata.attackerId).toBe("arg_A");
      expect(result.aspicMetadata.defenderId).toBe("arg_B");
      expect(result.aspicMetadata.source).toBe("legacy-attack-mapping");
    }
  });

  it("should compute metadata for undercutting attack from context", () => {
    const context: AttackContext = {
      attackType: "UNDERCUTS",
      targetScope: "inference",
      cqKey: "CQ_EXCEPTIONAL_CASE",
      cqText: "Is there an exceptional case?",
    };

    const result = computeAspicConflictMetadata(
      null,
      context,
      "arg_A",
      "arg_B"
    );

    expect(result.aspicAttackType).toBe("undercutting");
    expect(result.aspicDefeatStatus).toBe(false);
    if (result.aspicMetadata) {
      expect(result.aspicMetadata.targetScope).toBe("inference");
      expect(result.aspicMetadata.cqKey).toBe("CQ_EXCEPTIONAL_CASE");
    }
  });

  it("should compute metadata for rebutting attack from context", () => {
    const context: AttackContext = {
      attackType: "REBUTS",
      targetScope: "conclusion",
      cqKey: "CQ_ALTERNATIVE_CONCLUSION",
    };

    const result = computeAspicConflictMetadata(
      null,
      context,
      "arg_A",
      "arg_B"
    );

    expect(result.aspicAttackType).toBe("rebutting");
    expect(result.aspicDefeatStatus).toBe(false);
    if (result.aspicMetadata) {
      expect(result.aspicMetadata.targetScope).toBe("conclusion");
    }
  });

  it("should handle full ASPIC+ attack computation", () => {
    const attackResult = {
      attack: {
        type: "UNDERMINES",
        attacker: { id: "arg_A", conc: "p1" },
        attacked: { id: "arg_B", conc: "p2" },
      } as any,
      reason: "Premise p2 is undermined by p1",
    };

    const context: AttackContext = {
      attackType: "UNDERMINES",
      targetScope: "premise",
      cqKey: "CQ_TEST",
    };

    const result = computeAspicConflictMetadata(attackResult, context);

    expect(result.aspicAttackType).toBe("undermines");
    expect(result.aspicDefeatStatus).toBe(true);
    if (result.aspicMetadata) {
      expect(result.aspicMetadata.source).toBe("full-aspic-computation");
      expect(result.aspicMetadata.computationReason).toBe("Premise p2 is undermined by p1");
      expect(result.aspicMetadata.defeatStatus).toBe(true);
    }
  });

  it("should handle missing attack information gracefully", () => {
    const context: AttackContext = {
      attackType: "UNDERMINES",
      targetScope: "premise",
    };

    // With context but no attackResult, should return legacy mapping
    const result1 = computeAspicConflictMetadata(null, context);
    expect(result1.aspicAttackType).toBe("undermining");
    expect(result1.aspicMetadata).toBeDefined();

    // Without attackType in context, should return null
    const emptyContext: AttackContext = {
      attackType: "" as any,
      targetScope: "premise",
    };
    const result2 = computeAspicConflictMetadata(null, emptyContext);
    expect(result2.aspicAttackType).toBeNull();
    expect(result2.aspicMetadata).toBeNull();
  });

  it("should include timestamp in metadata", () => {
    const context: AttackContext = {
      attackType: "UNDERMINES",
      targetScope: "premise",
    };

    const before = new Date();
    const result = computeAspicConflictMetadata(null, context, "arg_A", "arg_B");
    const after = new Date();

    if (result.aspicMetadata) {
      expect(result.aspicMetadata.timestamp).toBeDefined();
      const timestamp = new Date(result.aspicMetadata.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    }
  });

  it("should include all context fields in metadata", () => {
    const context: AttackContext = {
      attackType: "UNDERCUTS",
      targetScope: "inference",
      cqKey: "CQ_EXCEPTIONAL_CASE",
      cqText: "Is there an exception?",
      schemeKey: "practical-reasoning",
      aspicMapping: { rule: "r1", exceptions: ["e1", "e2"] },
    };

    const result = computeAspicConflictMetadata(null, context, "arg_X", "arg_Y");

    if (result.aspicMetadata) {
      expect(result.aspicMetadata.cqKey).toBe("CQ_EXCEPTIONAL_CASE");
      expect(result.aspicMetadata.cqText).toBe("Is there an exception?");
      expect(result.aspicMetadata.schemeKey).toBe("practical-reasoning");
      expect(result.aspicMetadata.aspicMapping).toEqual({ rule: "r1", exceptions: ["e1", "e2"] });
    }
  });
});

describe("extractAspicMetadataFromMove", () => {
  it("should extract ASPIC metadata from DialogueMove payload", () => {
    const payload = {
      cqId: "cq_123",
      cqKey: "CQ_EXCEPTIONAL_CASE",
      cqText: "Is there an exceptional case?",
      aspicAttack: {
        type: "UNDERCUTS",
        attackerId: "arg_A",
        defenderId: "arg_B",
        succeeded: true,
      },
      aspicMetadata: {
        targetScope: "inference",
        reason: "Rule may not apply in this case",
      },
    };

    const result = extractAspicMetadataFromMove(payload);

    expect(result).not.toBeNull();
    expect(result?.attackType).toBe("UNDERCUTS");
    expect(result?.attackerId).toBe("arg_A");
    expect(result?.defenderId).toBe("arg_B");
    expect(result?.succeeded).toBe(true);
    expect(result?.targetScope).toBe("inference");
    expect(result?.cqKey).toBe("CQ_EXCEPTIONAL_CASE");
    expect(result?.cqText).toBe("Is there an exceptional case?");
    expect(result?.reason).toBe("Rule may not apply in this case");
  });

  it("should return null when no ASPIC attack present", () => {
    const payload = {
      cqId: "cq_123",
      cqKey: "CQ_PREMISE_ACCEPTABILITY",
    };

    const result = extractAspicMetadataFromMove(payload);
    expect(result).toBeNull();
  });

  it("should return null for empty payload", () => {
    const result = extractAspicMetadataFromMove({});
    expect(result).toBeNull();
  });

  it("should return null for null payload", () => {
    const result = extractAspicMetadataFromMove(null);
    expect(result).toBeNull();
  });

  it("should extract all available fields", () => {
    const payload = {
      cqId: "cq_456",
      cqKey: "CQ_PREMISE_ACCEPTABILITY",
      cqText: "Is premise P1 true?",
      aspicAttack: {
        type: "UNDERMINES",
        attackerId: "arg_X",
        defenderId: "arg_Y",
        succeeded: false,
      },
      aspicMetadata: {
        targetScope: "premise",
        reason: "Lacks supporting evidence",
        schemeKey: "expert-opinion",
      },
    };

    const result = extractAspicMetadataFromMove(payload);

    expect(result).toEqual({
      attackType: "UNDERMINES",
      attackerId: "arg_X",
      defenderId: "arg_Y",
      succeeded: false,
      targetScope: "premise",
      cqKey: "CQ_PREMISE_ACCEPTABILITY",
      cqText: "Is premise P1 true?",
      reason: "Lacks supporting evidence",
    });
  });
});

describe("checkDefeatStatus", () => {
  it("should return true when no preferences provided", () => {
    const attack = {
      type: "UNDERMINES",
      attacker: {
        id: "arg_A",
        conc: "c1",
      },
      attacked: {
        id: "arg_B",
        conc: "c2",
      },
    } as any;

    const result = checkDefeatStatus(attack);
    expect(result).toBe(true);
  });

  it("should return true when preferences are empty", () => {
    const attack = {
      type: "UNDERCUTS",
      attacker: { id: "arg_A", conc: "c1" },
      attacked: { id: "arg_B", conc: "c2" },
    } as any;

    const preferences = {
      premisePreferences: [],
      rulePreferences: [],
    };

    const result = checkDefeatStatus(attack, preferences);
    expect(result).toBe(true);
  });

  it("should handle preferences with undefined fields", () => {
    const attack = {
      type: "REBUTS",
      attacker: { id: "arg_A", conc: "c1" },
      attacked: { id: "arg_B", conc: "c2" },
    } as any;

    const preferences = {
      premisePreferences: undefined,
      rulePreferences: undefined,
    };

    const result = checkDefeatStatus(attack, preferences);
    expect(result).toBe(true);
  });

  // Note: Full preference checking would require more complex
  // ASPIC+ theory implementation. These tests verify the basic
  // structure is correct.
});

describe("Edge Cases", () => {
  it("should handle empty attack context", () => {
    const emptyContext: AttackContext = {
      attackType: "" as any,
      targetScope: "premise",
    };

    const result = computeAspicConflictMetadata(null, emptyContext, "arg_A", "arg_B");

    expect(result.aspicAttackType).toBeNull();
    expect(result.aspicDefeatStatus).toBe(false);
    expect(result.aspicMetadata).toBeNull();
  });

  it("should handle minimal attack context", () => {
    const minimalContext: AttackContext = {
      attackType: "UNDERMINES",
      targetScope: "premise",
    };

    const result = computeAspicConflictMetadata(null, minimalContext);

    expect(result.aspicAttackType).toBe("undermining");
    if (result.aspicMetadata) {
      expect(result.aspicMetadata.attackType).toBe("UNDERMINES");
      expect(result.aspicMetadata.targetScope).toBe("premise");
    }
  });

  it("should preserve optional context fields when provided", () => {
    const fullContext: AttackContext = {
      attackType: "UNDERCUTS",
      targetScope: "inference",
      cqKey: "CQ_TEST",
      cqText: "Test question?",
      schemeKey: "test-scheme",
      aspicMapping: { data: "test" },
    };

    const result = computeAspicConflictMetadata(null, fullContext, "arg_X", "arg_Y");

    if (result.aspicMetadata) {
      expect(result.aspicMetadata.cqKey).toBe("CQ_TEST");
      expect(result.aspicMetadata.cqText).toBe("Test question?");
      expect(result.aspicMetadata.schemeKey).toBe("test-scheme");
      expect(result.aspicMetadata.aspicMapping).toEqual({ data: "test" });
    }
  });
});
