/**
 * Arena Construction Tests
 * 
 * Tests for Phase 1: Arena Construction from Deliberation
 * 
 * Covers:
 * - Address tree building
 * - Ramification computation
 * - Ludicability validation
 * - Arena adapter conversion
 * - Full arena construction flow
 * 
 * Note: Database-dependent functions (fetchDeliberationWithRelations) are
 * not tested here - use integration tests with a real database for those.
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  buildAddressTree,
  findRootClaims,
  treeToPositions,
  getAllAddresses,
  getNodeAtAddress,
  getChildNodes,
  isLeaf,
  getMaxDepth,
  type DeliberationInput,
  type AddressTree,
} from "../arena/deliberation-address";

import {
  validateLudicability,
  checkPrefixClosureProperty,
  checkDaimonClosureProperty,
  checkSaturationProperty,
  repairPrefixClosure,
  repairRamifications,
} from "../arena/ludicability";

import {
  buildArenaFromDeliberationSync,
  getArenaPosition,
  getChildPositions,
  getTerminalPositions,
  getPositionsByPolarity,
  serializeArena,
  deserializeArena,
} from "../arena/arena-construction";

import {
  deliberationArenaToUniversal,
  universalToDeliberationArena,
  addressToString,
  stringToAddress,
  positionToMove,
  moveToPosition,
  computeArenaStats,
} from "../adapters/arena-adapter";

import {
  addressToKey,
  keyToAddress,
  polarityAtAddress,
  ArenaPositionTheory,
} from "../types/ludics-theory";

// ============================================================================
// TEST DATA
// ============================================================================

/**
 * Simple deliberation: Single argument for a claim
 */
function createSimpleDeliberation(): DeliberationInput {
  return {
    id: "delib-simple",
    arguments: [
      {
        id: "arg-1",
        text: "Climate change is primarily caused by human activities",
        deliberationId: "delib-simple",
        conclusionClaimId: "claim-1",
        conclusion: {
          id: "claim-1",
          text: "Climate change is real",
          deliberationId: "delib-simple",
        },
        premises: [
          {
            argumentId: "arg-1",
            claimId: "claim-p1",
            isImplicit: false,
            claim: {
              id: "claim-p1",
              text: "CO2 levels have increased dramatically",
              deliberationId: "delib-simple",
            },
          },
        ],
        outgoingEdges: [],
        incomingEdges: [],
      },
    ],
    Claim: [
      {
        id: "claim-1",
        text: "Climate change is real",
        deliberationId: "delib-simple",
        asConclusion: [{ id: "arg-1" }],
        asPremiseOf: [],
      },
      {
        id: "claim-p1",
        text: "CO2 levels have increased dramatically",
        deliberationId: "delib-simple",
        asConclusion: [],
        asPremiseOf: [{ argumentId: "arg-1" }],
      },
    ],
    edges: [],
    ClaimEdge: [],
  };
}

/**
 * Complex deliberation: Arguments with attacks
 */
function createComplexDeliberation(): DeliberationInput {
  return {
    id: "delib-complex",
    arguments: [
      {
        id: "arg-1",
        text: "We should transition to renewable energy",
        deliberationId: "delib-complex",
        conclusionClaimId: "claim-1",
        conclusion: {
          id: "claim-1",
          text: "Renewable energy is better",
          deliberationId: "delib-complex",
        },
        premises: [],
        outgoingEdges: [],
        incomingEdges: [
          {
            id: "edge-1",
            fromArgumentId: "arg-2",
            toArgumentId: "arg-1",
            type: "ATTACK",
            attackType: "REBUTS",
            targetScope: "conclusion",
          },
        ],
      },
      {
        id: "arg-2",
        text: "Renewable energy is too expensive",
        deliberationId: "delib-complex",
        conclusionClaimId: "claim-2",
        conclusion: {
          id: "claim-2",
          text: "Fossil fuels are more economical",
          deliberationId: "delib-complex",
        },
        premises: [],
        outgoingEdges: [
          {
            id: "edge-1",
            fromArgumentId: "arg-2",
            toArgumentId: "arg-1",
            type: "ATTACK",
            attackType: "REBUTS",
            targetScope: "conclusion",
          },
        ],
        incomingEdges: [
          {
            id: "edge-2",
            fromArgumentId: "arg-3",
            toArgumentId: "arg-2",
            type: "ATTACK",
            attackType: "UNDERCUTS",
            targetScope: "inference",
          },
        ],
      },
      {
        id: "arg-3",
        text: "Renewable costs have dropped significantly",
        deliberationId: "delib-complex",
        conclusionClaimId: "claim-3",
        conclusion: {
          id: "claim-3",
          text: "Cost comparison is outdated",
          deliberationId: "delib-complex",
        },
        premises: [],
        outgoingEdges: [
          {
            id: "edge-2",
            fromArgumentId: "arg-3",
            toArgumentId: "arg-2",
            type: "ATTACK",
            attackType: "UNDERCUTS",
            targetScope: "inference",
          },
        ],
        incomingEdges: [],
      },
    ],
    Claim: [
      {
        id: "claim-1",
        text: "Renewable energy is better",
        deliberationId: "delib-complex",
        asConclusion: [{ id: "arg-1" }],
        asPremiseOf: [],
      },
      {
        id: "claim-2",
        text: "Fossil fuels are more economical",
        deliberationId: "delib-complex",
        asConclusion: [{ id: "arg-2" }],
        asPremiseOf: [],
      },
      {
        id: "claim-3",
        text: "Cost comparison is outdated",
        deliberationId: "delib-complex",
        asConclusion: [{ id: "arg-3" }],
        asPremiseOf: [],
      },
    ],
    edges: [
      {
        id: "edge-1",
        fromArgumentId: "arg-2",
        toArgumentId: "arg-1",
        type: "ATTACK",
        attackType: "REBUTS",
        targetScope: "conclusion",
      },
      {
        id: "edge-2",
        fromArgumentId: "arg-3",
        toArgumentId: "arg-2",
        type: "ATTACK",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
    ],
    ClaimEdge: [],
  };
}

/**
 * Empty deliberation
 */
function createEmptyDeliberation(): DeliberationInput {
  return {
    id: "delib-empty",
    arguments: [],
    Claim: [],
    edges: [],
    ClaimEdge: [],
  };
}

// ============================================================================
// ADDRESS TREE TESTS
// ============================================================================

describe("Address Tree Building", () => {
  describe("buildAddressTree", () => {
    it("should build tree from simple deliberation", () => {
      const delib = createSimpleDeliberation();
      const tree = buildAddressTree(delib);
      
      expect(tree.deliberationId).toBe("delib-simple");
      expect(tree.roots.length).toBeGreaterThan(0);
      expect(tree.nodes.size).toBeGreaterThan(0);
    });
    
    it("should build tree from complex deliberation", () => {
      const delib = createComplexDeliberation();
      const tree = buildAddressTree(delib);
      
      expect(tree.deliberationId).toBe("delib-complex");
      expect(tree.nodes.size).toBeGreaterThan(1);
    });
    
    it("should handle empty deliberation", () => {
      const delib = createEmptyDeliberation();
      const tree = buildAddressTree(delib);
      
      expect(tree.nodes.size).toBe(0);
      expect(tree.roots.length).toBe(0);
    });
    
    it("should respect maxDepth option", () => {
      const delib = createComplexDeliberation();
      const tree = buildAddressTree(delib, { maxDepth: 2 });
      
      for (const node of tree.nodes.values()) {
        expect(node.address.length).toBeLessThanOrEqual(2);
      }
    });
    
    it("should use specified root claim", () => {
      const delib = createComplexDeliberation();
      const tree = buildAddressTree(delib, { rootClaimId: "claim-2" });
      
      // Root should be the specified claim
      const rootNode = tree.nodes.get(addressToKey([]));
      if (rootNode) {
        expect(rootNode.sourceId).toBe("claim-2");
      }
    });
  });
  
  describe("findRootClaims", () => {
    it("should find root claims in deliberation", () => {
      const delib = createSimpleDeliberation();
      const argumentsByConclusion = new Map<string, typeof delib.arguments>();
      const claimById = new Map<string, NonNullable<typeof delib.Claim>[number]>();
      
      for (const arg of delib.arguments) {
        if (arg.conclusionClaimId) {
          const existing = argumentsByConclusion.get(arg.conclusionClaimId) || [];
          existing.push(arg);
          argumentsByConclusion.set(arg.conclusionClaimId, existing);
        }
      }
      
      for (const claim of delib.Claim || []) {
        claimById.set(claim.id, claim);
      }
      
      const roots = findRootClaims(delib, {
        argumentsByConclusion,
        claimById,
      });
      
      expect(roots.length).toBeGreaterThan(0);
    });
    
    it("should use specified root if provided", () => {
      const delib = createComplexDeliberation();
      const claimById = new Map<string, NonNullable<typeof delib.Claim>[number]>();
      
      for (const claim of delib.Claim || []) {
        claimById.set(claim.id, claim);
      }
      
      const roots = findRootClaims(delib, {
        argumentsByConclusion: new Map(),
        claimById,
        specifiedRootId: "claim-3",
      });
      
      expect(roots.length).toBe(1);
      expect(roots[0].id).toBe("claim-3");
    });
  });
  
  describe("Tree Query Utilities", () => {
    let tree: AddressTree;
    
    beforeEach(() => {
      tree = buildAddressTree(createComplexDeliberation());
    });
    
    it("getAllAddresses should return all addresses", () => {
      const addresses = getAllAddresses(tree);
      expect(addresses.length).toBe(tree.nodes.size);
    });
    
    it("getNodeAtAddress should return correct node", () => {
      // Find any existing node
      if (tree.nodes.size > 0) {
        const firstKey = Array.from(tree.nodes.keys())[0];
        const firstNode = tree.nodes.get(firstKey);
        if (firstNode) {
          const retrieved = getNodeAtAddress(tree, firstNode.address);
          expect(retrieved).toBeDefined();
          expect(retrieved?.address).toEqual(firstNode.address);
        }
      }
    });
    
    it("getChildNodes should return children", () => {
      const rootNode = getNodeAtAddress(tree, []);
      if (rootNode && rootNode.children.length > 0) {
        const children = getChildNodes(tree, []);
        expect(children.length).toBe(rootNode.children.length);
      }
    });
    
    it("isLeaf should identify terminal nodes", () => {
      // Find a leaf node
      for (const node of tree.nodes.values()) {
        if (node.children.length === 0) {
          expect(isLeaf(tree, node.address)).toBe(true);
          break;
        }
      }
    });
    
    it("getMaxDepth should return correct depth", () => {
      const maxDepth = getMaxDepth(tree);
      
      for (const node of tree.nodes.values()) {
        expect(node.address.length).toBeLessThanOrEqual(maxDepth);
      }
    });
  });
});

// ============================================================================
// LUDICABILITY VALIDATION TESTS
// ============================================================================

describe("Ludicability Validation", () => {
  describe("validateLudicability", () => {
    it("should validate valid structure", () => {
      const positions = new Map<string, ArenaPositionTheory>();
      
      // Create a valid structure
      positions.set(addressToKey([]), {
        address: [],
        content: "Root",
        type: "claim",
        ramification: [0, 1],
        polarity: "+",
      });
      
      positions.set(addressToKey([0]), {
        address: [0],
        content: "Child 0",
        type: "support",
        ramification: [],
        polarity: "-",
      });
      
      positions.set(addressToKey([1]), {
        address: [1],
        content: "Child 1",
        type: "attack",
        ramification: [],
        polarity: "-",
      });
      
      const result = validateLudicability(positions);
      
      expect(result.isPrefixClosed).toBe(true);
      expect(result.errors.filter(e => e.type === "missing-prefix")).toHaveLength(0);
    });
    
    it("should detect missing prefixes", () => {
      const positions = new Map<string, ArenaPositionTheory>();
      
      // Missing prefix: [0] exists but [] does not
      positions.set(addressToKey([0, 1, 2]), {
        address: [0, 1, 2],
        content: "Deep node",
        type: "claim",
        ramification: [],
        polarity: "-",
      });
      
      const result = validateLudicability(positions);
      
      expect(result.isPrefixClosed).toBe(false);
      expect(result.errors.some(e => e.type === "missing-prefix")).toBe(true);
    });
    
    it("should detect unsaturated positions", () => {
      const positions = new Map<string, ArenaPositionTheory>();
      
      // Root is positive (depth 0) and says ramification is [0, 1, 2] but only [0] exists
      // Saturation check: for positive positions, all ramification indices must have children
      positions.set(addressToKey([]), {
        address: [],
        content: "Root",
        type: "claim",
        ramification: [0, 1, 2], // Says children 0, 1, 2 exist
        polarity: "+",
      });
      
      // Only child 0 exists - children 1 and 2 are missing
      positions.set(addressToKey([0]), {
        address: [0],
        content: "Only child",
        type: "support",
        ramification: [],
        polarity: "-",
      });
      
      const result = validateLudicability(positions);
      
      // Root is positive and declares children 1,2 in ramification but they don't exist
      expect(result.isSaturated).toBe(false);
      expect(result.errors.some(e => e.type === "unsaturated")).toBe(true);
    });
  });
  
  describe("Repair Functions", () => {
    it("repairPrefixClosure should add missing prefixes", () => {
      const positions = new Map<string, ArenaPositionTheory>();
      
      // Only deep node exists
      positions.set(addressToKey([0, 1]), {
        address: [0, 1],
        content: "Deep",
        type: "claim",
        ramification: [],
        polarity: "+",
      });
      
      const added = repairPrefixClosure(positions);
      
      expect(added).toBeGreaterThan(0);
      expect(positions.has(addressToKey([]))).toBe(true);
      expect(positions.has(addressToKey([0]))).toBe(true);
    });
    
    it("repairRamifications should fix ramification arrays", () => {
      const positions = new Map<string, ArenaPositionTheory>();
      
      // Root has empty ramification but has children
      positions.set(addressToKey([]), {
        address: [],
        content: "Root",
        type: "claim",
        ramification: [], // Wrong!
        polarity: "+",
      });
      
      positions.set(addressToKey([0]), {
        address: [0],
        content: "Child",
        type: "support",
        ramification: [],
        polarity: "-",
      });
      
      const repaired = repairRamifications(positions);
      
      expect(repaired).toBe(1);
      const root = positions.get(addressToKey([]));
      expect(root?.ramification).toContain(0);
    });
  });
});

// ============================================================================
// ARENA CONSTRUCTION TESTS
// ============================================================================

describe("Arena Construction", () => {
  describe("buildArenaFromDeliberationSync", () => {
    it("should build arena from simple deliberation", () => {
      const delib = createSimpleDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      expect(result.success).toBe(true);
      expect(result.arena).toBeDefined();
      expect(result.stats.positionCount).toBeGreaterThan(0);
    });
    
    it("should build arena from complex deliberation", () => {
      const delib = createComplexDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      expect(result.success).toBe(true);
      expect(result.arena).toBeDefined();
      expect(result.stats.positionCount).toBeGreaterThan(1);
    });
    
    it("should handle empty deliberation", () => {
      const delib = createEmptyDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      expect(result.success).toBe(true);
      expect(result.stats.positionCount).toBe(0);
    });
    
    it("should validate arena when validate=true", () => {
      const delib = createSimpleDeliberation();
      const result = buildArenaFromDeliberationSync(delib, { validate: true });
      
      expect(result.validation).toBeDefined();
    });
    
    it("should repair arena when autoRepair=true", () => {
      const delib = createComplexDeliberation();
      const result = buildArenaFromDeliberationSync(delib, { autoRepair: true });
      
      expect(result.success).toBe(true);
      // After repair, should be valid
      if (result.validation) {
        expect(result.validation.isValid).toBe(true);
      }
    });
  });
  
  describe("Arena Query Utilities", () => {
    it("getArenaPosition should return position", () => {
      const delib = createSimpleDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      if (result.arena && result.arena.positions.size > 0) {
        const rootPos = getArenaPosition(result.arena, []);
        // Root may or may not exist depending on structure
        if (result.arena.positions.has(addressToKey([]))) {
          expect(rootPos).toBeDefined();
        }
      }
    });
    
    it("getTerminalPositions should return leaves", () => {
      const delib = createComplexDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      if (result.arena) {
        const terminals = getTerminalPositions(result.arena);
        
        for (const pos of terminals) {
          expect(pos.ramification.length).toBe(0);
        }
      }
    });
    
    it("getPositionsByPolarity should filter correctly", () => {
      const delib = createComplexDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      if (result.arena) {
        const pPositions = getPositionsByPolarity(result.arena, "P");
        const oPositions = getPositionsByPolarity(result.arena, "O");
        
        for (const pos of pPositions) {
          expect(pos.polarity).toBe("P");
        }
        
        for (const pos of oPositions) {
          expect(pos.polarity).toBe("O");
        }
      }
    });
  });
  
  describe("Serialization", () => {
    it("should serialize and deserialize arena", () => {
      const delib = createComplexDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      if (result.arena) {
        const serialized = serializeArena(result.arena);
        const deserialized = deserializeArena(serialized as any);
        
        expect(deserialized.deliberationId).toBe(result.arena.deliberationId);
        expect(deserialized.positions.size).toBe(result.arena.positions.size);
      }
    });
  });
});

// ============================================================================
// ARENA ADAPTER TESTS
// ============================================================================

describe("Arena Adapter", () => {
  describe("Address Conversion", () => {
    it("addressToString should convert array to string", () => {
      expect(addressToString([])).toBe("");
      expect(addressToString([0])).toBe("0");
      expect(addressToString([0, 1, 2])).toBe("012");
    });
    
    it("stringToAddress should convert string to array", () => {
      expect(stringToAddress("")).toEqual([]);
      expect(stringToAddress("0")).toEqual([0]);
      expect(stringToAddress("012")).toEqual([0, 1, 2]);
    });
    
    it("should round-trip correctly", () => {
      const addresses = [[], [0], [1, 2], [0, 1, 2, 3]];
      
      for (const addr of addresses) {
        expect(stringToAddress(addressToString(addr))).toEqual(addr);
      }
    });
  });
  
  describe("deliberationArenaToUniversal", () => {
    it("should convert deliberation arena to universal", () => {
      const delib = createComplexDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      if (result.arena) {
        const universal = deliberationArenaToUniversal(result.arena);
        
        expect(universal.id).toContain("arena-delib");
        expect(universal.moves.length).toBe(result.arena.positions.size);
        expect(universal.deliberationId).toBe(result.arena.deliberationId);
      }
    });
    
    it("should preserve metadata when includeMetadata=true", () => {
      const delib = createSimpleDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      if (result.arena && result.arena.positions.size > 0) {
        const universal = deliberationArenaToUniversal(result.arena, {
          includeMetadata: true,
        });
        
        // Check that at least some moves have metadata
        const movesWithMetadata = universal.moves.filter(
          m => m.metadata !== undefined
        );
        
        // When includeMetadata is true, all moves should have metadata
        expect(movesWithMetadata.length).toBe(universal.moves.length);
      }
    });
  });
  
  describe("universalToDeliberationArena", () => {
    it("should convert universal arena to deliberation arena", () => {
      const delib = createComplexDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      if (result.arena) {
        const universal = deliberationArenaToUniversal(result.arena);
        const backToDelib = universalToDeliberationArena(universal);
        
        expect(backToDelib.positions.size).toBe(result.arena.positions.size);
      }
    });
  });
  
  describe("positionToMove and moveToPosition", () => {
    it("should convert position to move", () => {
      const position: ArenaPositionTheory = {
        address: [0, 1],
        content: "Test position",
        type: "claim",
        ramification: [0, 1, 2],
        polarity: "+",
        sourceId: "claim-1",
        sourceType: "claim",
      };
      
      const move = positionToMove(position);
      
      expect(move.address).toBe("01");
      expect(move.ramification).toEqual([0, 1, 2]);
      // ArenaMove.player is determined by address parity, not polarity
      // Address "01" has length 2 (even) → player "P"
      expect(move.player).toBe("P");
    });
    
    it("should convert move to position", () => {
      const delib = createSimpleDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      if (result.arena) {
        const universal = deliberationArenaToUniversal(result.arena, {
          includeMetadata: true,
        });
        
        if (universal.moves.length > 0) {
          const position = moveToPosition(universal.moves[0]);
          
          expect(position.address).toBeDefined();
          expect(position.ramification).toBeDefined();
          expect(position.polarity).toBeDefined();
        }
      }
    });
  });
  
  describe("computeArenaStats", () => {
    it("should compute statistics", () => {
      const delib = createComplexDeliberation();
      const result = buildArenaFromDeliberationSync(delib);
      
      if (result.arena) {
        const stats = computeArenaStats(result.arena);
        
        expect(stats.positionCount).toBe(result.arena.positions.size);
        expect(stats.pPositions + stats.oPositions).toBe(stats.positionCount);
      }
    });
  });
});

// ============================================================================
// POLARITY TESTS
// ============================================================================

describe("Polarity", () => {
  it("polarityAtAddress should alternate", () => {
    expect(polarityAtAddress([])).toBe("+");      // depth 0 = + (P)
    expect(polarityAtAddress([0])).toBe("-");     // depth 1 = - (O)
    expect(polarityAtAddress([0, 1])).toBe("+");  // depth 2 = + (P)
    expect(polarityAtAddress([0, 1, 2])).toBe("-"); // depth 3 = - (O)
  });
  
  it("arena positions should have correct polarity", () => {
    const delib = createComplexDeliberation();
    const result = buildArenaFromDeliberationSync(delib);
    
    if (result.arena) {
      for (const position of result.arena.positions.values()) {
        const expectedPolarity = polarityAtAddress(position.address);
        expect(position.polarity).toBe(expectedPolarity);
      }
    }
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Integration", () => {
  it("full pipeline: deliberation → arena → universal → back", () => {
    const delib = createComplexDeliberation();
    
    // Build arena
    const result = buildArenaFromDeliberationSync(delib);
    expect(result.success).toBe(true);
    
    if (result.arena) {
      // Convert to universal
      const universal = deliberationArenaToUniversal(result.arena, {
        includeMetadata: true,
      });
      
      expect(universal.moves.length).toBe(result.arena.positions.size);
      
      // Convert back
      const backToDelib = universalToDeliberationArena(universal);
      
      expect(backToDelib.positions.size).toBe(result.arena.positions.size);
    }
  });
  
  it("validation after construction should pass", () => {
    const delib = createComplexDeliberation();
    const result = buildArenaFromDeliberationSync(delib, {
      autoRepair: true,
      validate: true,
    });
    
    expect(result.success).toBe(true);
    
    if (result.validation) {
      // After auto-repair, should be valid
      expect(result.validation.isPrefixClosed).toBe(true);
    }
  });
});
