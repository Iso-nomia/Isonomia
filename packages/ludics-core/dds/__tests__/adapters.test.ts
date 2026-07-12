/**
 * Tests for Ludics Adapters
 * 
 * Validates conversion between:
 * - DialogueMove ↔ DialogueAct
 * - Prisma models ↔ Theory types
 * - Legacy DDS types ↔ Theory types
 */

import {
  // Dialogue Move Adapter
  buildAddressMap,
  buildReverseAddressMap,
  dialogueMoveToAct,
  actToDialogueMove,
  convertMovesToActs,
  mapMoveTypeToActType,
  mapActTypeToMoveType,
  validateRoundtrip,
  type DialogueMove,
} from "../adapters/dialogue-move-adapter";

import {
  // Prisma Adapter
  buildLocusPathMap,
  prismaToTheoryPolarity,
  theoryToPrismaPolarity,
  prismaActToTheory,
  prismaDesignToTheory,
  theoryActToPrisma,
  validatePrismaDesign,
  type PrismaLudicAct,
  type PrismaLudicDesign,
  type PrismaLudicLocus,
} from "../adapters/prisma-adapter";

import {
  // Legacy Adapter
  legacyToTheoryPolarity,
  theoryToLegacyPolarity,
  locusPathToAddress,
  addressToLocusPath,
  legacyActToTheory,
  theoryActToLegacy,
  legacyDesignToTheory,
  theoryDesignToLegacy,
  legacyMoveToPosition,
} from "../adapters/legacy-adapter";

import {
  addressToKey,
  createDialogueAct,
} from "../types/ludics-theory";

// ============================================================================
// Dialogue Move Adapter Tests
// ============================================================================

describe("Dialogue Move Adapter", () => {
  describe("buildAddressMap", () => {
    it("assigns root-level addresses to orphan moves", () => {
      const moves: DialogueMove[] = [
        { id: "m1", content: "First", type: "claim" },
        { id: "m2", content: "Second", type: "claim" },
      ];
      const map = buildAddressMap(moves);
      expect(map.get("m1")).toEqual([0]);
      expect(map.get("m2")).toEqual([1]);
    });

    it("assigns nested addresses based on parent", () => {
      const moves: DialogueMove[] = [
        { id: "m1", content: "Root", type: "claim" },
        { id: "m2", content: "Child", type: "support", parentId: "m1" },
        { id: "m3", content: "Grandchild", type: "attack", parentId: "m2" },
      ];
      const map = buildAddressMap(moves);
      expect(map.get("m1")).toEqual([0]);
      expect(map.get("m2")).toEqual([0, 0]);
      expect(map.get("m3")).toEqual([0, 0, 0]);
    });

    it("handles multiple children", () => {
      const moves: DialogueMove[] = [
        { id: "m1", content: "Root", type: "claim" },
        { id: "m2", content: "Child 1", type: "support", parentId: "m1" },
        { id: "m3", content: "Child 2", type: "attack", parentId: "m1" },
      ];
      const map = buildAddressMap(moves);
      expect(map.get("m2")).toEqual([0, 0]);
      expect(map.get("m3")).toEqual([0, 1]);
    });
  });

  describe("buildReverseAddressMap", () => {
    it("creates reverse mapping", () => {
      const moves: DialogueMove[] = [
        { id: "m1", content: "Root", type: "claim" },
        { id: "m2", content: "Child", type: "support", parentId: "m1" },
      ];
      const addressMap = buildAddressMap(moves);
      const reverseMap = buildReverseAddressMap(addressMap);
      expect(reverseMap.get("0")).toBe("m1");
      expect(reverseMap.get("0.0")).toBe("m2");
    });
  });

  describe("mapMoveTypeToActType", () => {
    it("maps correctly", () => {
      expect(mapMoveTypeToActType("claim")).toBe("claim");
      expect(mapMoveTypeToActType("support")).toBe("argue");
      expect(mapMoveTypeToActType("attack")).toBe("negate");
      expect(mapMoveTypeToActType("question")).toBe("ask");
      expect(mapMoveTypeToActType("concession")).toBe("concede");
      expect(mapMoveTypeToActType("withdraw")).toBe("daimon");
    });
  });

  describe("mapActTypeToMoveType", () => {
    it("maps correctly", () => {
      expect(mapActTypeToMoveType("claim")).toBe("claim");
      expect(mapActTypeToMoveType("argue")).toBe("support");
      expect(mapActTypeToMoveType("negate")).toBe("attack");
      expect(mapActTypeToMoveType("ask")).toBe("question");
      expect(mapActTypeToMoveType("concede")).toBe("concession");
      expect(mapActTypeToMoveType("daimon")).toBe("withdraw");
    });
  });

  describe("dialogueMoveToAct", () => {
    it("converts move to act", () => {
      const moves: DialogueMove[] = [
        { id: "m1", content: "Test claim", type: "claim", speakerRole: "proponent" },
      ];
      const addressMap = buildAddressMap(moves);
      const act = dialogueMoveToAct(moves[0], addressMap, []);
      
      expect(act.polarity).toBe("+");
      expect(act.focus).toEqual([0]);
      expect(act.expression).toBe("Test claim");
      expect(act.type).toBe("claim");
    });

    it("computes ramification from children", () => {
      const moves: DialogueMove[] = [
        { id: "m1", content: "Root", type: "claim" },
        { id: "m2", content: "Child 1", type: "support", parentId: "m1" },
        { id: "m3", content: "Child 2", type: "attack", parentId: "m1" },
      ];
      const addressMap = buildAddressMap(moves);
      const act = dialogueMoveToAct(moves[0], addressMap, moves);
      
      expect(act.ramification).toEqual([[0, 0], [0, 1]]);
    });
  });

  describe("validateRoundtrip", () => {
    it("validates successful roundtrip", () => {
      const moves: DialogueMove[] = [
        { id: "m1", content: "Test", type: "claim", speakerRole: "proponent" },
      ];
      const addressMap = buildAddressMap(moves);
      const result = validateRoundtrip(moves[0], addressMap, moves);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ============================================================================
// Prisma Adapter Tests
// ============================================================================

describe("Prisma Adapter", () => {
  describe("buildLocusPathMap", () => {
    it("builds map from loci", () => {
      const loci: PrismaLudicLocus[] = [
        { id: "l1", deliberationId: "d1", path: "0", parentId: null, depth: 0 },
        { id: "l2", deliberationId: "d1", path: "0.1", parentId: "l1", depth: 1 },
      ];
      const map = buildLocusPathMap(loci);
      
      expect(map.get("l1")).toEqual([]);
      expect(map.get("l2")).toEqual([0, 1]);
    });
  });

  describe("prismaToTheoryPolarity", () => {
    it("converts P to +", () => {
      expect(prismaToTheoryPolarity("P")).toBe("+");
      expect(prismaToTheoryPolarity("pos")).toBe("+");
    });

    it("converts O to -", () => {
      expect(prismaToTheoryPolarity("O")).toBe("-");
      expect(prismaToTheoryPolarity("neg")).toBe("-");
    });

    it("converts daimon to +", () => {
      expect(prismaToTheoryPolarity("daimon")).toBe("+");
    });
  });

  describe("theoryToPrismaPolarity", () => {
    it("converts + to P", () => {
      expect(theoryToPrismaPolarity("+")).toBe("P");
    });

    it("converts - to O", () => {
      expect(theoryToPrismaPolarity("-")).toBe("O");
    });
  });

  describe("prismaActToTheory", () => {
    it("converts proper act", () => {
      const loci: PrismaLudicLocus[] = [
        { id: "l1", deliberationId: "d1", path: "0.1", parentId: null, depth: 1 },
      ];
      const locusMap = buildLocusPathMap(loci);
      
      const prismaAct: PrismaLudicAct = {
        id: "a1",
        designId: "d1",
        kind: "PROPER",
        polarity: "P",
        locusId: "l1",
        ramification: ["0", "1"],
        expression: "Test",
        isAdditive: false,
        orderInDesign: 0,
      };
      
      const act = prismaActToTheory(prismaAct, locusMap);
      expect(act.polarity).toBe("+");
      expect(act.focus).toEqual([0, 1]);
      expect(act.expression).toBe("Test");
    });

    it("converts daimon act", () => {
      const locusMap = new Map();
      const prismaAct: PrismaLudicAct = {
        id: "a1",
        designId: "d1",
        kind: "DAIMON",
        polarity: "daimon",
        locusId: null,
        ramification: [],
        expression: "†",
        isAdditive: false,
        orderInDesign: 0,
      };
      
      const act = prismaActToTheory(prismaAct, locusMap);
      expect(act.type).toBe("daimon");
      expect(act.polarity).toBe("+");
    });
  });

  describe("validatePrismaDesign", () => {
    it("validates complete design", () => {
      const design: PrismaLudicDesign = {
        id: "d1",
        deliberationId: "del1",
        participantId: "p1",
        rootLocusId: "l1",
        semantics: "ludics-v1",
        hasDaimon: false,
        version: 1,
      };
      
      const result = validatePrismaDesign(design);
      expect(result.valid).toBe(true);
    });

    it("detects missing fields", () => {
      const design = {
        id: "",
        deliberationId: "",
        participantId: "p1",
        rootLocusId: "",
      } as PrismaLudicDesign;
      
      const result = validatePrismaDesign(design);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Legacy Adapter Tests
// ============================================================================

describe("Legacy Adapter", () => {
  describe("locusPathToAddress", () => {
    it("converts empty/0 to empty address", () => {
      expect(locusPathToAddress("")).toEqual([]);
      expect(locusPathToAddress("0")).toEqual([]);
    });

    it("converts path string to address", () => {
      expect(locusPathToAddress("0.1.2")).toEqual([0, 1, 2]);
      expect(locusPathToAddress("1.2.3")).toEqual([1, 2, 3]);
    });
  });

  describe("addressToLocusPath", () => {
    it("converts empty address to 0", () => {
      expect(addressToLocusPath([])).toBe("0");
    });

    it("converts address to path string", () => {
      expect(addressToLocusPath([0, 1, 2])).toBe("0.1.2");
    });
  });

  describe("legacyToTheoryPolarity", () => {
    it("converts P/pos to +", () => {
      expect(legacyToTheoryPolarity("P")).toBe("+");
      expect(legacyToTheoryPolarity("pos")).toBe("+");
    });

    it("converts O/neg to -", () => {
      expect(legacyToTheoryPolarity("O")).toBe("-");
      expect(legacyToTheoryPolarity("neg")).toBe("-");
    });
  });

  describe("legacyActToTheory", () => {
    it("converts legacy act", () => {
      const legacyAct = {
        kind: "PROPER",
        polarity: "P" as const,
        locusPath: "0.1",
        openings: ["0", "1"],
        expression: "Test",
        additive: false,
      };
      
      const act = legacyActToTheory(legacyAct);
      expect(act.polarity).toBe("+");
      expect(act.focus).toEqual([0, 1]);
      expect(act.expression).toBe("Test");
    });
  });

  describe("theoryActToLegacy", () => {
    it("converts theory act", () => {
      const act = createDialogueAct("+", [0, 1], [[0, 1, 0]], "Test", "claim");
      const legacy = theoryActToLegacy(act);
      
      expect(legacy.polarity).toBe("P");
      expect(legacy.locusPath).toBe("0.1");
      expect(legacy.expression).toBe("Test");
    });
  });

  describe("legacyDesignToTheory and back", () => {
    it("roundtrips design", () => {
      const legacyDesign = {
        id: "d1",
        base: ["0"],
        acts: [
          { kind: "PROPER", polarity: "P" as const, locusPath: "0", openings: ["0"], expression: "Test" },
        ],
      };
      
      const theory = legacyDesignToTheory(legacyDesign);
      expect(theory.id).toBe("d1");
      expect(theory.chronicles.length).toBe(1);
      
      const recovered = theoryDesignToLegacy(theory);
      expect(recovered.id).toBe("d1");
      expect(recovered.acts.length).toBe(1);
    });
  });
});
