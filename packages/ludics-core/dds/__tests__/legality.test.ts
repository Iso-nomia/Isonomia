/**
 * DDS Legality Module Tests
 * Tests for legal position validation (Definition 3.7 from Faggian & Hyland)
 */

import {
  validateLegality,
  isLegal,
  createPosition,
  extendPosition,
  getValidNextAddresses,
} from "../legality";
import type { Position, Action, LegalityOptions } from "../types";

describe("Legal Position Validation", () => {
  describe("validateLegality", () => {
    it("should validate a legal position", () => {
      const position: Position = {
        id: "test",
        sequence: [
          { focus: "0", ramification: [1, 2], polarity: "P" },
          { focus: "0.1", ramification: [3], polarity: "O" },
          { focus: "0.1.3", ramification: [], polarity: "P" },
        ],
        player: "O",
        isLinear: true,
        isLegal: true,
      };

      const check = validateLegality(position);

      expect(check.isLinear).toBe(true);
      expect(check.isParity).toBe(true);
      expect(check.errors.length).toBe(0);
    });

    it("should detect linearity violation (duplicate address)", () => {
      const position: Position = {
        id: "test",
        sequence: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
          { focus: "0", ramification: [2], polarity: "P" }, // Duplicate!
        ],
        player: "O",
        isLinear: true,
        isLegal: true,
      };

      const check = validateLegality(position);

      expect(check.isLinear).toBe(false);
      expect(check.errors.some((e) => e.includes("Linearity"))).toBe(true);
    });

    it("should detect parity violation (same polarity twice)", () => {
      const position: Position = {
        id: "test",
        sequence: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "P" }, // Should be O!
        ],
        player: "O",
        isLinear: true,
        isLegal: true,
      };

      const check = validateLegality(position);

      expect(check.isParity).toBe(false);
      expect(check.errors.some((e) => e.includes("Parity"))).toBe(true);
    });

    it("should accept empty position as legal", () => {
      const position: Position = {
        id: "test",
        sequence: [],
        player: "P",
        isLinear: true,
        isLegal: true,
      };

      const check = validateLegality(position);

      expect(check.isLinear).toBe(true);
      expect(check.isParity).toBe(true);
      expect(check.errors.length).toBe(0);
    });

    it("should accept single action as legal", () => {
      const position: Position = {
        id: "test",
        sequence: [{ focus: "0", ramification: [1], polarity: "P" }],
        player: "O",
        isLinear: true,
        isLegal: true,
      };

      const check = validateLegality(position);

      expect(check.isLinear).toBe(true);
      expect(check.isParity).toBe(true);
    });
  });

  describe("isLegal", () => {
    it("should return true for legal position", () => {
      const position: Position = {
        id: "test",
        sequence: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        player: "P",
        isLinear: true,
        isLegal: true,
      };

      expect(isLegal(position)).toBe(true);
    });

    it("should return false for illegal position", () => {
      const position: Position = {
        id: "test",
        sequence: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0", ramification: [], polarity: "O" }, // Duplicate
        ],
        player: "P",
        isLinear: true,
        isLegal: true,
      };

      expect(isLegal(position)).toBe(false);
    });
  });

  describe("createPosition", () => {
    it("should create position with validation", () => {
      const sequence: Action[] = [
        { focus: "0", ramification: [1, 2], polarity: "P" },
        { focus: "0.1", ramification: [], polarity: "O" },
      ];

      const result = createPosition("test", sequence, "P");

      expect(result.id).toBe("test");
      expect(result.sequence).toEqual(sequence);
      expect(result.player).toBe("P");
      expect(result.isLinear).toBe(true);
      expect(result.validationResult).toBeDefined();
    });

    it("should mark illegal position as not legal", () => {
      const sequence: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
        { focus: "0", ramification: [], polarity: "O" }, // Duplicate
      ];

      const result = createPosition("test", sequence, "P");

      expect(result.isLinear).toBe(false);
      expect(result.isLegal).toBe(false);
    });
  });

  describe("extendPosition", () => {
    it("should extend position with valid action", () => {
      const position: Position = {
        id: "test",
        sequence: [{ focus: "0", ramification: [1, 2], polarity: "P" }],
        player: "O",
        isLinear: true,
        isLegal: true,
      };

      const newAction: Action = {
        focus: "0.1",
        ramification: [],
        polarity: "O",
      };

      const { position: extended, isValid, check } = extendPosition(
        position,
        newAction
      );

      expect(extended.sequence.length).toBe(2);
      expect(extended.player).toBe("P"); // Next player
      expect(isValid).toBe(true);
    });

    it("should detect invalid extension (parity violation)", () => {
      const position: Position = {
        id: "test",
        sequence: [{ focus: "0", ramification: [1], polarity: "P" }],
        player: "O",
        isLinear: true,
        isLegal: true,
      };

      const newAction: Action = {
        focus: "0.1",
        ramification: [],
        polarity: "P", // Should be O!
      };

      const { isValid, check } = extendPosition(position, newAction);

      expect(isValid).toBe(false);
      expect(check.isParity).toBe(false);
    });
  });

  describe("getValidNextAddresses", () => {
    it("should return root for empty position", () => {
      const position: Position = {
        id: "test",
        sequence: [],
        player: "P",
        isLinear: true,
        isLegal: true,
      };

      const addresses = getValidNextAddresses(position);

      expect(addresses).toContain("0");
    });

    it("should return opened addresses", () => {
      const position: Position = {
        id: "test",
        sequence: [{ focus: "0", ramification: [1, 2, 3], polarity: "P" }],
        player: "O",
        isLinear: true,
        isLegal: true,
      };

      const addresses = getValidNextAddresses(position);

      expect(addresses).toContain("0.1");
      expect(addresses).toContain("0.2");
      expect(addresses).toContain("0.3");
    });

    it("should exclude already used addresses", () => {
      const position: Position = {
        id: "test",
        sequence: [
          { focus: "0", ramification: [1, 2], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        player: "P",
        isLinear: true,
        isLegal: true,
      };

      const addresses = getValidNextAddresses(position);

      expect(addresses).not.toContain("0");
      expect(addresses).not.toContain("0.1");
      expect(addresses).toContain("0.2");
    });
  });
});

describe("Justification Validation", () => {
  const options: LegalityOptions = {
    validateJustification: true,
    validateVisibility: false, // Test justification in isolation
  };

  it("should pass justification for properly justified moves", () => {
    const position: Position = {
      id: "test",
      sequence: [
        { focus: "0", ramification: [1], polarity: "P" },
        { focus: "0.1", ramification: [], polarity: "O" },
      ],
      player: "P",
      isLinear: true,
      isLegal: true,
    };

    const check = validateLegality(position, options);

    expect(check.isJustified).toBe(true);
  });

  it("should fail justification for unjustified moves", () => {
    const position: Position = {
      id: "test",
      sequence: [
        { focus: "0", ramification: [1], polarity: "P" }, // Opens only 1
        { focus: "0.2", ramification: [], polarity: "O" }, // Plays at 2 (not opened!)
      ],
      player: "P",
      isLinear: true,
      isLegal: true,
    };

    const check = validateLegality(position, options);

    expect(check.isJustified).toBe(false);
    expect(check.errors.some((e) => e.includes("Justification"))).toBe(true);
  });
});
