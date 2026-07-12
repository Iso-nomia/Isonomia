/**
 * Tests for Ludics Theory Types
 * 
 * Validates the utility functions and type behaviors
 * defined in ludics-theory.ts
 */

import {
  // Types
  type LudicAddress,
  type Polarity,
  type DialogueAct,
  type Chronicle,
  type LudicDesignTheory,
  
  // Utility functions
  addressToKey,
  keyToAddress,
  addressEquals,
  isAddressPrefix,
  getParentAddress,
  getChildAddress,
  polarityAtAddress,
  createDaimon,
  isDaimon,
  createDialogueAct,
  flipPolarity,
  isPositiveChronicle,
  chronicleHasDaimon,
  chronicleDepth,
  validatePolairtyAlternation,
  extractAddresses,
} from "../types/ludics-theory";

describe("LudicAddress utilities", () => {
  describe("addressToKey", () => {
    it("converts empty address to empty string", () => {
      expect(addressToKey([])).toBe("");
    });

    it("converts single element address", () => {
      expect(addressToKey([0])).toBe("0");
      expect(addressToKey([5])).toBe("5");
    });

    it("converts multi-element address", () => {
      expect(addressToKey([0, 1, 2])).toBe("0.1.2");
      expect(addressToKey([2, 0, 3, 1])).toBe("2.0.3.1");
    });
  });

  describe("keyToAddress", () => {
    it("converts empty string to empty address", () => {
      expect(keyToAddress("")).toEqual([]);
    });

    it("converts single element key", () => {
      expect(keyToAddress("0")).toEqual([0]);
      expect(keyToAddress("5")).toEqual([5]);
    });

    it("converts multi-element key", () => {
      expect(keyToAddress("0.1.2")).toEqual([0, 1, 2]);
      expect(keyToAddress("2.0.3.1")).toEqual([2, 0, 3, 1]);
    });

    it("roundtrips correctly", () => {
      const addresses: LudicAddress[] = [[], [0], [1, 2], [0, 1, 2, 3]];
      for (const addr of addresses) {
        expect(keyToAddress(addressToKey(addr))).toEqual(addr);
      }
    });
  });

  describe("addressEquals", () => {
    it("returns true for equal addresses", () => {
      expect(addressEquals([], [])).toBe(true);
      expect(addressEquals([0], [0])).toBe(true);
      expect(addressEquals([0, 1, 2], [0, 1, 2])).toBe(true);
    });

    it("returns false for different addresses", () => {
      expect(addressEquals([], [0])).toBe(false);
      expect(addressEquals([0], [1])).toBe(false);
      expect(addressEquals([0, 1], [0, 2])).toBe(false);
      expect(addressEquals([0, 1], [0, 1, 2])).toBe(false);
    });
  });

  describe("isAddressPrefix", () => {
    it("empty address is prefix of everything", () => {
      expect(isAddressPrefix([], [])).toBe(true);
      expect(isAddressPrefix([], [0])).toBe(true);
      expect(isAddressPrefix([], [0, 1, 2])).toBe(true);
    });

    it("address is prefix of itself", () => {
      expect(isAddressPrefix([0], [0])).toBe(true);
      expect(isAddressPrefix([0, 1], [0, 1])).toBe(true);
    });

    it("detects valid prefixes", () => {
      expect(isAddressPrefix([0], [0, 1])).toBe(true);
      expect(isAddressPrefix([0], [0, 1, 2])).toBe(true);
      expect(isAddressPrefix([0, 1], [0, 1, 2])).toBe(true);
    });

    it("rejects non-prefixes", () => {
      expect(isAddressPrefix([1], [0, 1])).toBe(false);
      expect(isAddressPrefix([0, 2], [0, 1, 2])).toBe(false);
      expect(isAddressPrefix([0, 1, 2], [0, 1])).toBe(false);
    });
  });

  describe("getParentAddress", () => {
    it("returns empty for empty address", () => {
      expect(getParentAddress([])).toEqual([]);
    });

    it("returns empty for single element", () => {
      expect(getParentAddress([0])).toEqual([]);
    });

    it("removes last element", () => {
      expect(getParentAddress([0, 1])).toEqual([0]);
      expect(getParentAddress([0, 1, 2])).toEqual([0, 1]);
    });
  });

  describe("getChildAddress", () => {
    it("appends to empty address", () => {
      expect(getChildAddress([], 0)).toEqual([0]);
      expect(getChildAddress([], 5)).toEqual([5]);
    });

    it("appends to existing address", () => {
      expect(getChildAddress([0], 1)).toEqual([0, 1]);
      expect(getChildAddress([0, 1], 2)).toEqual([0, 1, 2]);
    });
  });
});

describe("Polarity utilities", () => {
  describe("polarityAtAddress", () => {
    it("root (empty) address is positive", () => {
      expect(polarityAtAddress([])).toBe("+");
    });

    it("even-depth addresses are positive", () => {
      expect(polarityAtAddress([0, 1])).toBe("+");
      expect(polarityAtAddress([1, 2, 3, 4])).toBe("+");
    });

    it("odd-depth addresses are negative", () => {
      expect(polarityAtAddress([0])).toBe("-");
      expect(polarityAtAddress([0, 1, 2])).toBe("-");
      expect(polarityAtAddress([1, 2, 3])).toBe("-");
    });
  });

  describe("flipPolarity", () => {
    it("flips positive to negative", () => {
      expect(flipPolarity("+")).toBe("-");
    });

    it("flips negative to positive", () => {
      expect(flipPolarity("-")).toBe("+");
    });
  });
});

describe("DialogueAct utilities", () => {
  describe("createDaimon", () => {
    it("creates daimon at address", () => {
      const daimon = createDaimon([0, 1]);
      expect(daimon.type).toBe("daimon");
      expect(daimon.polarity).toBe("+");
      expect(daimon.focus).toEqual([0, 1]);
      expect(daimon.ramification).toEqual([]);
      expect(daimon.expression).toBe("†");
    });

    it("allows custom expression", () => {
      const daimon = createDaimon([0], "I give up");
      expect(daimon.expression).toBe("I give up");
    });
  });

  describe("isDaimon", () => {
    it("returns true for daimon acts", () => {
      const daimon = createDaimon([0]);
      expect(isDaimon(daimon)).toBe(true);
    });

    it("returns false for proper acts", () => {
      const act = createDialogueAct("+", [0], [[0, 1]], "claim", "claim");
      expect(isDaimon(act)).toBe(false);
    });
  });

  describe("createDialogueAct", () => {
    it("creates proper dialogue act", () => {
      const act = createDialogueAct(
        "+",
        [0],
        [[0, 1], [0, 2]],
        "Test claim",
        "claim"
      );
      expect(act.polarity).toBe("+");
      expect(act.focus).toEqual([0]);
      expect(act.ramification).toEqual([[0, 1], [0, 2]]);
      expect(act.expression).toBe("Test claim");
      expect(act.type).toBe("claim");
    });
  });
});

describe("Chronicle utilities", () => {
  const makeAct = (polarity: Polarity, type: DialogueAct["type"] = "claim"): DialogueAct => ({
    polarity,
    focus: [],
    ramification: [],
    expression: "",
    type,
  });

  describe("isPositiveChronicle", () => {
    it("returns false for empty chronicle", () => {
      const chronicle: Chronicle = { actions: [], isComplete: false };
      expect(isPositiveChronicle(chronicle)).toBe(false);
    });

    it("returns true when last action is positive", () => {
      const chronicle: Chronicle = {
        actions: [makeAct("+"), makeAct("-"), makeAct("+")],
        isComplete: false,
      };
      expect(isPositiveChronicle(chronicle)).toBe(true);
    });

    it("returns false when last action is negative", () => {
      const chronicle: Chronicle = {
        actions: [makeAct("+"), makeAct("-")],
        isComplete: false,
      };
      expect(isPositiveChronicle(chronicle)).toBe(false);
    });
  });

  describe("chronicleHasDaimon", () => {
    it("returns false for chronicle without daimon", () => {
      const chronicle: Chronicle = {
        actions: [makeAct("+"), makeAct("-")],
        isComplete: false,
      };
      expect(chronicleHasDaimon(chronicle)).toBe(false);
    });

    it("returns true for chronicle with daimon", () => {
      const chronicle: Chronicle = {
        actions: [makeAct("+"), createDaimon([])],
        isComplete: true,
      };
      expect(chronicleHasDaimon(chronicle)).toBe(true);
    });
  });

  describe("chronicleDepth", () => {
    it("returns 0 for empty chronicle", () => {
      const chronicle: Chronicle = { actions: [], isComplete: false };
      expect(chronicleDepth(chronicle)).toBe(0);
    });

    it("returns action count", () => {
      const chronicle: Chronicle = {
        actions: [makeAct("+"), makeAct("-"), makeAct("+")],
        isComplete: false,
      };
      expect(chronicleDepth(chronicle)).toBe(3);
    });
  });

  describe("validatePolairtyAlternation", () => {
    it("returns true for empty sequence", () => {
      expect(validatePolairtyAlternation([])).toBe(true);
    });

    it("returns true for alternating sequence", () => {
      const acts = [makeAct("+"), makeAct("-"), makeAct("+"), makeAct("-")];
      expect(validatePolairtyAlternation(acts)).toBe(true);
    });

    it("returns false for non-alternating sequence", () => {
      const acts = [makeAct("+"), makeAct("+"), makeAct("-")];
      expect(validatePolairtyAlternation(acts)).toBe(false);
    });

    it("allows daimon to follow any polarity", () => {
      const acts = [makeAct("+"), createDaimon([])];
      expect(validatePolairtyAlternation(acts)).toBe(true);
    });
  });
});

describe("extractAddresses", () => {
  it("returns empty set for empty actions", () => {
    const result = extractAddresses([]);
    expect(result.size).toBe(0);
  });

  it("extracts focus addresses", () => {
    const acts: DialogueAct[] = [
      createDialogueAct("+", [0], [], "a", "claim"),
      createDialogueAct("-", [0, 1], [], "b", "claim"),
    ];
    const result = extractAddresses(acts);
    expect(result.has("0")).toBe(true);
    expect(result.has("0.1")).toBe(true);
  });

  it("extracts ramification addresses", () => {
    const acts: DialogueAct[] = [
      createDialogueAct("+", [0], [[0, 1], [0, 2]], "a", "claim"),
    ];
    const result = extractAddresses(acts);
    expect(result.has("0")).toBe(true);
    expect(result.has("0.1")).toBe(true);
    expect(result.has("0.2")).toBe(true);
  });
});
