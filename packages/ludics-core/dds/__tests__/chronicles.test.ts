/**
 * DDS Chronicles Module Tests
 * Tests for chronicle extraction (Proposition 3.6 from Faggian & Hyland)
 */

import {
  extractChronicles,
  extractAllChronicles,
  disputeToPosition,
  isPositiveChronicle,
  isNegativeChronicle,
  chronicleDepth,
  chronicleTipLocus,
  isChroniclePrefix,
  getPositiveChronicles,
  getNegativeChronicles,
  groupChroniclesByLocus,
} from "../chronicles";
import type { Dispute, Position, Chronicle } from "../types";

describe("Chronicle Extraction", () => {
  const createTestDispute = (): Dispute => ({
    id: "dispute-1",
    dialogueId: "dialogue-1",
    posDesignId: "design-p",
    negDesignId: "design-o",
    pairs: [
      { posActId: "p1", negActId: "o1", locusPath: "0", ts: 1 },
      { posActId: "p2", negActId: "o2", locusPath: "0.1", ts: 2 },
      { posActId: "p3", negActId: "o3", locusPath: "0.1.2", ts: 3 },
    ],
    status: "CONVERGENT",
    length: 3,
  });

  describe("disputeToPosition", () => {
    it("should convert dispute to position correctly", () => {
      const dispute = createTestDispute();
      const position = disputeToPosition(dispute);

      expect(position.id).toBe(dispute.id);
      expect(position.sequence.length).toBe(6); // 3 pairs × 2
      expect(position.sequence[0].polarity).toBe("P");
      expect(position.sequence[1].polarity).toBe("O");
    });

    it("should preserve locus paths", () => {
      const dispute = createTestDispute();
      const position = disputeToPosition(dispute);

      expect(position.sequence[0].focus).toBe("0");
      expect(position.sequence[2].focus).toBe("0.1");
      expect(position.sequence[4].focus).toBe("0.1.2");
    });
  });

  describe("extractChronicles", () => {
    it("should extract proponent chronicles", () => {
      const dispute = createTestDispute();
      const chronicles = extractChronicles(dispute, "P");

      expect(chronicles.length).toBeGreaterThan(0);
      expect(chronicles.every((c) => c.polarity === "P")).toBe(true);
    });

    it("should extract opponent chronicles", () => {
      const dispute = createTestDispute();
      const chronicles = extractChronicles(dispute, "O");

      expect(chronicles.length).toBeGreaterThan(0);
      expect(chronicles.every((c) => c.polarity === "O")).toBe(true);
    });

    it("should respect maxChronicles option", () => {
      const dispute = createTestDispute();
      const chronicles = extractChronicles(dispute, "P", { maxChronicles: 2 });

      expect(chronicles.length).toBeLessThanOrEqual(2);
    });

    it("should filter positive only when requested", () => {
      const dispute = createTestDispute();
      const chronicles = extractChronicles(dispute, "P", { onlyPositive: true });

      expect(chronicles.every((c) => c.isPositive)).toBe(true);
    });
  });

  describe("extractAllChronicles", () => {
    it("should extract chronicles for both players", () => {
      const dispute = createTestDispute();
      const position = disputeToPosition(dispute);
      const { proponent, opponent } = extractAllChronicles(position);

      expect(proponent.length).toBeGreaterThan(0);
      expect(opponent.length).toBeGreaterThan(0);
    });

    it("should not have duplicate chronicles within player set", () => {
      const dispute = createTestDispute();
      const position = disputeToPosition(dispute);
      const { proponent } = extractAllChronicles(position);

      // Use full chronicle key including focus, polarity, and ramification
      const keys = proponent.map((c) =>
        JSON.stringify(
          c.actions.map((a) => ({
            f: a.focus,
            p: a.polarity,
            r: a.ramification.sort(),
          }))
        )
      );
      const uniqueKeys = new Set(keys);

      expect(keys.length).toBe(uniqueKeys.size);
    });
  });
});

describe("Chronicle Utilities", () => {
  const createTestChronicle = (
    isPositive: boolean,
    depth: number
  ): Chronicle => ({
    id: `chronicle-${depth}`,
    designId: "design-1",
    actions: Array.from({ length: depth }, (_, i) => ({
      focus: `0${".1".repeat(i)}`,
      ramification: i < depth - 1 ? [1] : [],
      polarity: i % 2 === 0 ? "P" : "O",
    })),
    polarity: "P",
    isPositive,
  });

  describe("isPositiveChronicle", () => {
    it("should return true for positive chronicles", () => {
      const chronicle = createTestChronicle(true, 3);
      expect(isPositiveChronicle(chronicle)).toBe(true);
    });

    it("should return false for negative chronicles", () => {
      const chronicle = createTestChronicle(false, 2);
      // Set last action to opposite polarity
      chronicle.actions[chronicle.actions.length - 1].polarity = "O";
      expect(isPositiveChronicle(chronicle)).toBe(false);
    });

    it("should return false for empty chronicle", () => {
      const chronicle: Chronicle = {
        id: "empty",
        designId: "design-1",
        actions: [],
        polarity: "P",
        isPositive: false,
      };
      expect(isPositiveChronicle(chronicle)).toBe(false);
    });
  });

  describe("isNegativeChronicle", () => {
    it("should return true for negative chronicles", () => {
      const chronicle = createTestChronicle(true, 2);
      chronicle.actions[chronicle.actions.length - 1].polarity = "O";
      expect(isNegativeChronicle(chronicle)).toBe(true);
    });
  });

  describe("chronicleDepth", () => {
    it("should return correct depth", () => {
      expect(chronicleDepth(createTestChronicle(true, 1))).toBe(1);
      expect(chronicleDepth(createTestChronicle(true, 5))).toBe(5);
    });

    it("should return 0 for empty chronicle", () => {
      const chronicle: Chronicle = {
        id: "empty",
        designId: "design-1",
        actions: [],
        polarity: "P",
        isPositive: false,
      };
      expect(chronicleDepth(chronicle)).toBe(0);
    });
  });

  describe("chronicleTipLocus", () => {
    it("should return tip locus", () => {
      const chronicle = createTestChronicle(true, 3);
      const tip = chronicleTipLocus(chronicle);
      expect(tip).toBe(chronicle.actions[chronicle.actions.length - 1].focus);
    });

    it("should return undefined for empty chronicle", () => {
      const chronicle: Chronicle = {
        id: "empty",
        designId: "design-1",
        actions: [],
        polarity: "P",
        isPositive: false,
      };
      expect(chronicleTipLocus(chronicle)).toBeUndefined();
    });
  });

  describe("isChroniclePrefix", () => {
    it("should return true for valid prefix", () => {
      const prefix: Chronicle = {
        id: "prefix",
        designId: "d1",
        actions: [{ focus: "0", ramification: [1], polarity: "P" }],
        polarity: "P",
        isPositive: true,
      };

      const full: Chronicle = {
        id: "full",
        designId: "d1",
        actions: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      };

      expect(isChroniclePrefix(prefix, full)).toBe(true);
    });

    it("should return false if prefix is longer", () => {
      const prefix: Chronicle = {
        id: "prefix",
        designId: "d1",
        actions: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      };

      const full: Chronicle = {
        id: "full",
        designId: "d1",
        actions: [{ focus: "0", ramification: [1], polarity: "P" }],
        polarity: "P",
        isPositive: true,
      };

      expect(isChroniclePrefix(prefix, full)).toBe(false);
    });
  });

  describe("getPositiveChronicles / getNegativeChronicles", () => {
    it("should filter correctly", () => {
      const chronicles = [
        createTestChronicle(true, 1),
        createTestChronicle(false, 2),
        createTestChronicle(true, 3),
      ];

      const positive = getPositiveChronicles(chronicles);
      const negative = getNegativeChronicles(chronicles);

      expect(positive.length).toBe(2);
      expect(negative.length).toBe(1);
    });
  });

  describe("groupChroniclesByLocus", () => {
    it("should group chronicles by tip locus", () => {
      const c1: Chronicle = {
        id: "c1",
        designId: "d1",
        actions: [{ focus: "0.1", ramification: [], polarity: "P" }],
        polarity: "P",
        isPositive: true,
      };
      const c2: Chronicle = {
        id: "c2",
        designId: "d1",
        actions: [{ focus: "0.1", ramification: [], polarity: "O" }],
        polarity: "O",
        isPositive: false,
      };
      const c3: Chronicle = {
        id: "c3",
        designId: "d1",
        actions: [{ focus: "0.2", ramification: [], polarity: "P" }],
        polarity: "P",
        isPositive: true,
      };

      const groups = groupChroniclesByLocus([c1, c2, c3]);

      expect(groups.size).toBe(2);
      expect(groups.get("0.1")?.length).toBe(2);
      expect(groups.get("0.2")?.length).toBe(1);
    });
  });
});
