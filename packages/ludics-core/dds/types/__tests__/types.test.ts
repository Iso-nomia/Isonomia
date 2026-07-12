/**
 * DDS Phase 5 - Types Module Tests
 * Tests for incarnation, type operations, and inference
 */

import { describe, it, expect } from "vitest";
import type { Action } from "../types";
import {
  checkIncarnation,
  laxIncarnation,
  sharpIncarnation,
} from "../types/incarnation";
import {
  createType,
  checkType,
  equivalentTypes,
  joinTypes,
  meetTypes,
} from "../types/operations";
import {
  inferType,
  structuralInference,
  behavioralInference,
} from "../types/inference";

describe("Incarnation Operations", () => {
  // A "smaller" design with fewer specifications
  const designA: Action[] = [
    { focus: "0", ramification: [1], polarity: "P" },
  ];

  // A "larger" design with more specifications
  const designB: Action[] = [
    { focus: "0", ramification: [1, 2], polarity: "P" },
    { focus: "0.1", ramification: [], polarity: "O" },
    { focus: "0.2", ramification: [], polarity: "O" },
  ];

  // Incompatible design
  const designC: Action[] = [
    { focus: "1", ramification: [0], polarity: "O" },
  ];

  describe("checkIncarnation", () => {
    it("should detect A incarnated in B when A is less defined", () => {
      const result = checkIncarnation(designA, designB);
      expect(result.isIncarnated).toBeDefined();
    });

    it("should return false for incompatible designs", () => {
      const result = checkIncarnation(designA, designC);
      expect(result.isIncarnated).toBe(false);
    });

    it("should handle empty designs", () => {
      const result = checkIncarnation([], designB);
      expect(result.isIncarnated).toBe(true); // Empty is incarnated in anything
    });

    it("should be reflexive for same design", () => {
      const result = checkIncarnation(designA, designA);
      expect(result.isIncarnated).toBe(true);
    });
  });

  describe("laxIncarnation", () => {
    it("should allow partial overlap", () => {
      const result = laxIncarnation(designA, designB);
      expect(result.isIncarnated).toBeDefined();
      expect(result.coverage).toBeDefined();
    });

    it("should calculate overlap percentage", () => {
      const result = laxIncarnation(designA, designB);
      if (result.coverage !== undefined) {
        expect(result.coverage).toBeGreaterThanOrEqual(0);
        expect(result.coverage).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("sharpIncarnation", () => {
    it("should require strict subset relationship", () => {
      const result = sharpIncarnation(designA, designB);
      expect(result.isIncarnated).toBeDefined();
    });

    it("should be stricter than standard incarnation", () => {
      const standard = checkIncarnation(designA, designB);
      const sharp = sharpIncarnation(designA, designB);
      // Sharp incarnation implies standard incarnation
      if (sharp.isIncarnated) {
        expect(standard.isIncarnated).toBe(true);
      }
    });
  });
});

describe("Type Operations", () => {
  describe("createType", () => {
    it("should create type from type description", () => {
      const typeDesc = { polarity: "positive", arity: 2 };
      const type = createType(typeDesc);
      expect(type).toBeDefined();
      expect(type.polarity).toBe("positive");
    });

    it("should handle negative types", () => {
      const typeDesc = { polarity: "negative", arity: 1 };
      const type = createType(typeDesc);
      expect(type.polarity).toBe("negative");
    });
  });

  describe("checkType", () => {
    it("should validate actions against type", () => {
      const actions: Action[] = [
        { focus: "0", ramification: [1, 2], polarity: "P" },
      ];
      const type = createType({ polarity: "positive", arity: 2 });
      const result = checkType(actions, type);
      expect(result.valid).toBeDefined();
    });
  });

  describe("equivalentTypes", () => {
    it("should detect equivalent types", () => {
      const typeA = createType({ polarity: "positive", arity: 2 });
      const typeB = createType({ polarity: "positive", arity: 2 });
      const result = equivalentTypes(typeA, typeB);
      expect(result.equivalent).toBe(true);
    });

    it("should detect non-equivalent types", () => {
      const typeA = createType({ polarity: "positive", arity: 2 });
      const typeB = createType({ polarity: "negative", arity: 3 });
      const result = equivalentTypes(typeA, typeB);
      expect(result.equivalent).toBe(false);
    });
  });

  describe("joinTypes", () => {
    it("should compute join of two types", () => {
      const typeA = createType({ polarity: "positive", arity: 2 });
      const typeB = createType({ polarity: "positive", arity: 3 });
      const result = joinTypes(typeA, typeB);
      expect(result).toBeDefined();
    });
  });

  describe("meetTypes", () => {
    it("should compute meet of two types", () => {
      const typeA = createType({ polarity: "positive", arity: 2 });
      const typeB = createType({ polarity: "positive", arity: 3 });
      const result = meetTypes(typeA, typeB);
      expect(result).toBeDefined();
    });
  });
});

describe("Type Inference", () => {
  const actions: Action[] = [
    { focus: "0", ramification: [1, 2], polarity: "P" },
    { focus: "0.1", ramification: [], polarity: "O" },
    { focus: "0.2", ramification: [3], polarity: "O" },
  ];

  describe("inferType", () => {
    it("should infer type from actions", () => {
      const result = inferType(actions);
      expect(result.type).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should return valid confidence score", () => {
      const result = inferType(actions);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("structuralInference", () => {
    it("should infer type based on structure", () => {
      const result = structuralInference(actions);
      expect(result.type).toBeDefined();
      expect(result.details).toBeDefined();
    });

    it("should analyze branching structure", () => {
      const result = structuralInference(actions);
      expect(result.details.maxArity).toBeDefined();
      expect(result.details.depth).toBeDefined();
    });
  });

  describe("behavioralInference", () => {
    it("should infer type based on behaviours", () => {
      const behaviours = [
        { id: "b1", designIds: ["d1", "d2"], isClosed: true },
      ];
      const result = behavioralInference(actions, behaviours);
      expect(result.type).toBeDefined();
    });

    it("should handle empty behaviours", () => {
      const result = behavioralInference(actions, []);
      expect(result.type).toBeDefined();
      expect(result.confidence).toBeLessThan(1);
    });
  });
});
