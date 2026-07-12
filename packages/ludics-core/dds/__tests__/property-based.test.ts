/**
 * ============================================
 * PROPERTY-BASED TESTS
 * ============================================
 * 
 * Phase 7: Property-based testing using fast-check
 * 
 * Tests validate theoretical invariants:
 * 1. Biorthogonal closure is idempotent
 * 2. Visitable paths are prefix-closed
 * 3. Incarnation preserves essentials
 * 4. Polarity alternation is consistent
 * 5. Address operations are well-behaved
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import type {
  LudicAddress,
  DialogueAct,
  Chronicle,
  LudicDesignTheory,
  VisitablePath,
  LudicBehaviourTheory,
} from "../types/ludics-theory";

import {
  addressToKey,
  keyToAddress,
  addressEquals,
  isAddressPrefix,
  polarityAtAddress,
  createDaimon,
} from "../types/ludics-theory";

import {
  computeOrthogonal,
  computeBiorthogonalClosure,
  converges,
} from "../landscape/behaviour-computer";

import {
  extractPath,
  extractAllPaths,
  validatePath,
} from "../extraction/path-extractor";

import {
  computeIncarnation,
  isEssentialAction,
} from "../extraction/incarnation";

// ============================================================================
// ARBITRARIES (Test Data Generators)
// ============================================================================

/**
 * Generate a valid ludic address (array of non-negative integers)
 */
const arbitraryAddress: fc.Arbitrary<LudicAddress> = fc
  .array(fc.nat({ max: 5 }), { minLength: 0, maxLength: 6 })
  .map((arr) => arr);

/**
 * Generate a polarity
 */
const arbitraryPolarity: fc.Arbitrary<"+" | "-"> = fc.constantFrom("+", "-");

/**
 * Generate a dialogue act with valid structure
 */
const arbitraryDialogueAct = (depth: number): fc.Arbitrary<DialogueAct> => {
  const polarity = depth % 2 === 0 ? "+" : "-";
  
  return fc.record({
    polarity: fc.constant(polarity as "+" | "-"),
    focus: fc.constant(Array.from({ length: depth }, (_, i) => i % 3)),
    ramification: fc.array(
      fc.array(fc.nat({ max: 3 }), { minLength: depth + 1, maxLength: depth + 1 }),
      { minLength: 0, maxLength: 3 }
    ),
    expression: fc.string({ minLength: 1, maxLength: 20 }),
    type: fc.constantFrom("claim", "attack", "support", "question") as fc.Arbitrary<DialogueAct["type"]>,
  });
};

/**
 * Generate a chronicle with alternating polarities
 */
const arbitraryChronicle: fc.Arbitrary<Chronicle> = fc
  .integer({ min: 1, max: 5 })
  .chain((length) => {
    const actions: DialogueAct[] = [];
    for (let i = 0; i < length; i++) {
      const polarity = i % 2 === 0 ? "+" : "-";
      const focus = Array.from({ length: i }, (_, j) => j % 3);
      actions.push({
        polarity: polarity as "+" | "-",
        focus,
        ramification: i < length - 1 
          ? [[...focus, 0]] 
          : [],
        expression: `Action ${i}`,
        type: "claim",
      });
    }
    return fc.constant({
      id: `chronicle-${Date.now()}`,
      actions,
      isComplete: true,
    });
  });

/**
 * Generate a design with valid chronicles
 */
const arbitraryDesign: fc.Arbitrary<LudicDesignTheory> = fc
  .array(arbitraryChronicle, { minLength: 1, maxLength: 3 })
  .map((chronicles) => ({
    id: `design-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    base: [],
    polarity: "+",
    chronicles,
    hasDaimon: false,
  }));

/**
 * Generate a set of designs
 */
const arbitraryDesignSet: fc.Arbitrary<LudicDesignTheory[]> = fc.array(
  arbitraryDesign,
  { minLength: 1, maxLength: 4 }
);

/**
 * Generate a visitable path with valid structure
 */
const arbitraryVisitablePath: fc.Arbitrary<VisitablePath> = fc
  .integer({ min: 1, max: 6 })
  .chain((length) => {
    const actions: DialogueAct[] = [];
    for (let i = 0; i < length; i++) {
      const polarity = i % 2 === 0 ? "+" : "-";
      const focus = Array.from({ length: i }, (_, j) => j % 3);
      actions.push({
        polarity: polarity as "+" | "-",
        focus,
        ramification: i < length - 1 ? [[...focus, 0]] : [],
        expression: `Step ${i}`,
        type: "claim",
      });
    }
    return fc.constant({
      id: `path-${Date.now()}`,
      actions,
      outcome: "convergent" as const,
      winner: length % 2 === 0 ? "O" : "P",
      incarnation: [],
      isComplete: true,
    });
  });

// ============================================================================
// ADDRESS PROPERTIES
// ============================================================================

describe("Address Properties", () => {
  describe("addressToKey/keyToAddress roundtrip", () => {
    it("roundtrips for any valid address", () => {
      fc.assert(
        fc.property(arbitraryAddress, (address) => {
          const key = addressToKey(address);
          const back = keyToAddress(key);
          return addressEquals(address, back);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("addressEquals reflexivity", () => {
    it("address equals itself", () => {
      fc.assert(
        fc.property(arbitraryAddress, (address) => {
          return addressEquals(address, address);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("addressEquals symmetry", () => {
    it("equals is symmetric", () => {
      fc.assert(
        fc.property(arbitraryAddress, arbitraryAddress, (a, b) => {
          return addressEquals(a, b) === addressEquals(b, a);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("isAddressPrefix reflexivity", () => {
    it("address is prefix of itself", () => {
      fc.assert(
        fc.property(arbitraryAddress, (address) => {
          return isAddressPrefix(address, address);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("isAddressPrefix transitivity", () => {
    it("prefix relation is transitive", () => {
      fc.assert(
        fc.property(
          arbitraryAddress,
          fc.nat({ max: 3 }),
          fc.nat({ max: 3 }),
          (base, ext1, ext2) => {
            const a = base;
            const b = [...base, ext1];
            const c = [...base, ext1, ext2];
            
            // If a is prefix of b and b is prefix of c, then a is prefix of c
            if (isAddressPrefix(a, b) && isAddressPrefix(b, c)) {
              return isAddressPrefix(a, c);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("empty address is universal prefix", () => {
    it("empty is prefix of any address", () => {
      fc.assert(
        fc.property(arbitraryAddress, (address) => {
          return isAddressPrefix([], address);
        }),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// POLARITY PROPERTIES
// ============================================================================

describe("Polarity Properties", () => {
  describe("polarity alternates with depth", () => {
    it("adjacent depths have opposite polarity", () => {
      fc.assert(
        fc.property(arbitraryAddress, (address) => {
          if (address.length === 0) return true;
          
          const parentAddr = address.slice(0, -1);
          const parentPol = polarityAtAddress(parentAddr);
          const childPol = polarityAtAddress(address);
          
          return parentPol !== childPol;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("polarity is deterministic", () => {
    it("same address always has same polarity", () => {
      fc.assert(
        fc.property(arbitraryAddress, (address) => {
          const pol1 = polarityAtAddress(address);
          const pol2 = polarityAtAddress([...address]);
          return pol1 === pol2;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("root has positive polarity", () => {
    it("empty address is positive", () => {
      expect(polarityAtAddress([])).toBe("+");
    });
  });
});

// ============================================================================
// PATH PROPERTIES
// ============================================================================

describe("Path Properties", () => {
  describe("path polarities alternate", () => {
    it("consecutive actions have opposite polarity", () => {
      fc.assert(
        fc.property(arbitraryVisitablePath, (path) => {
          for (let i = 1; i < path.actions.length; i++) {
            if (path.actions[i - 1].polarity === path.actions[i].polarity) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("path validation consistency", () => {
    it("well-formed paths pass validation", () => {
      fc.assert(
        fc.property(arbitraryVisitablePath, (path) => {
          const result = validatePath(path);
          return result.valid;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("paths are prefix-closed (conceptually)", () => {
    it("any prefix of a valid path is valid", () => {
      fc.assert(
        fc.property(
          arbitraryVisitablePath,
          fc.nat({ max: 10 }),
          (path, prefixLen) => {
            if (prefixLen >= path.actions.length) return true;
            if (prefixLen === 0) return true;
            
            const prefix: VisitablePath = {
              ...path,
              actions: path.actions.slice(0, prefixLen),
              isComplete: false,
            };
            
            const result = validatePath(prefix);
            return result.valid;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

// ============================================================================
// INCARNATION PROPERTIES
// ============================================================================

describe("Incarnation Properties", () => {
  describe("incarnation is subset of original", () => {
    it("incarnation length <= original length", () => {
      fc.assert(
        fc.property(arbitraryVisitablePath, (path) => {
          const incarnation = computeIncarnation(path);
          return incarnation.length <= path.actions.length;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("incarnation preserves first and last", () => {
    it("non-empty incarnation starts with first action", () => {
      fc.assert(
        fc.property(arbitraryVisitablePath, (path) => {
          if (path.actions.length === 0) return true;
          
          const incarnation = computeIncarnation(path);
          if (incarnation.length === 0) return true;
          
          // First action should typically be preserved
          return addressEquals(incarnation[0].focus, path.actions[0].focus);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("incarnation is idempotent", () => {
    it("computing incarnation twice gives same result", () => {
      fc.assert(
        fc.property(arbitraryVisitablePath, (path) => {
          const inc1 = computeIncarnation(path);
          
          // Create a path from incarnation
          const incPath: VisitablePath = {
            ...path,
            actions: inc1,
          };
          
          const inc2 = computeIncarnation(incPath);
          
          // Second incarnation should equal first
          if (inc1.length !== inc2.length) return false;
          for (let i = 0; i < inc1.length; i++) {
            if (!addressEquals(inc1[i].focus, inc2[i].focus)) return false;
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });
});

// ============================================================================
// BEHAVIOUR PROPERTIES (Orthogonality)
// ============================================================================

describe("Behaviour Properties", () => {
  describe("orthogonal flips polarity", () => {
    it("orthogonal of positive designs has negative base polarity", () => {
      fc.assert(
        fc.property(arbitraryDesign, (design) => {
          // Skip if design has no chronicles
          if (design.chronicles.length === 0) return true;
          
          const ortho = computeOrthogonal([design]);
          
          // Orthogonal designs should have opposite polarity
          if (ortho.length === 0) return true;
          return ortho[0].polarity !== design.polarity;
        }),
        { numRuns: 30 }
      );
    });
  });

  describe("biorthogonal closure properties", () => {
    it("biorthogonal expands or preserves design set", () => {
      fc.assert(
        fc.property(arbitraryDesignSet, (designs) => {
          if (designs.length === 0) return true;
          
          const closure = computeBiorthogonalClosure(designs);
          
          // Closure should have at least as many designs
          return closure.length >= designs.length;
        }),
        { numRuns: 20 }
      );
    });

    it("biorthogonal closure is idempotent", () => {
      fc.assert(
        fc.property(arbitraryDesignSet, (designs) => {
          if (designs.length === 0) return true;
          
          const closure1 = computeBiorthogonalClosure(designs);
          const closure2 = computeBiorthogonalClosure(closure1);
          
          // Applying closure twice should give same result
          // (closure of closure equals closure)
          return closure1.length === closure2.length;
        }),
        { numRuns: 20 }
      );
    });
  });

  describe("convergence symmetry", () => {
    it("convergence is symmetric", () => {
      fc.assert(
        fc.property(arbitraryDesign, arbitraryDesign, (d1, d2) => {
          // If d1 converges with d2, then d2 converges with d1
          const conv1 = converges(d1, d2);
          const conv2 = converges(d2, d1);
          return conv1 === conv2;
        }),
        { numRuns: 30 }
      );
    });
  });
});

// ============================================================================
// CHRONICLE PROPERTIES
// ============================================================================

describe("Chronicle Properties", () => {
  describe("chronicle alternation", () => {
    it("chronicles have strictly alternating polarity", () => {
      fc.assert(
        fc.property(arbitraryChronicle, (chronicle) => {
          for (let i = 1; i < chronicle.actions.length; i++) {
            if (chronicle.actions[i].polarity === chronicle.actions[i - 1].polarity) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("chronicle focus progression", () => {
    it("focus extends or changes at each step", () => {
      fc.assert(
        fc.property(arbitraryChronicle, (chronicle) => {
          for (let i = 1; i < chronicle.actions.length; i++) {
            const prevFocus = chronicle.actions[i - 1].focus;
            const currFocus = chronicle.actions[i].focus;
            
            // Current focus should be related to previous ramification
            // or be a valid response
            const prevRam = chronicle.actions[i - 1].ramification;
            
            // Either focus extends, or it's in previous ramification
            const isExtension = currFocus.length >= prevFocus.length;
            const inRamification = prevRam.some((r) => addressEquals(r, currFocus));
            
            if (!isExtension && !inRamification && prevRam.length > 0) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });
});

// ============================================================================
// DAIMON PROPERTIES
// ============================================================================

describe("Daimon Properties", () => {
  describe("daimon is always positive polarity", () => {
    it("daimon has positive polarity regardless of focus", () => {
      fc.assert(
        fc.property(arbitraryAddress, (address) => {
          const daimon = createDaimon(address);
          return daimon.polarity === "+";
        }),
        { numRuns: 20 }
      );
    });
  });

  describe("daimon has empty ramification", () => {
    it("daimon opens no new positions", () => {
      fc.assert(
        fc.property(arbitraryAddress, (address) => {
          const daimon = createDaimon(address);
          return daimon.ramification.length === 0;
        }),
        { numRuns: 20 }
      );
    });
  });

  describe("daimon is marked by type", () => {
    it("daimon has type='daimon'", () => {
      fc.assert(
        fc.property(arbitraryAddress, (address) => {
          const daimon = createDaimon(address);
          return daimon.type === "daimon";
        }),
        { numRuns: 20 }
      );
    });
  });
});
