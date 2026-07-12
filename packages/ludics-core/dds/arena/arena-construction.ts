/**
 * Arena Construction from Deliberation
 * 
 * Main entry point for building ludic arenas from deliberation structure.
 * 
 * This implements Phase 1 of the Ludics-Deliberation Integration:
 * **Deliberation → DeliberationArena**
 * 
 * ## Theoretical Foundation
 * 
 * In ludics (Girard 2001, Faggian-Hyland 2002):
 * - An **arena** is the space of all possible interactions
 * - A **design** is a partial strategy within the arena
 * - **Addresses** locate positions in the interaction tree
 * - **Ramification** defines available responses at each position
 * 
 * In deliberation:
 * - Claims are propositions under debate
 * - Arguments provide structured reasoning (premises → conclusion)
 * - Attacks/supports create the dialectical structure
 * 
 * This module maps deliberation → ludics:
 * - Claims/Arguments → Addresses (positions in interaction)
 * - Attack relations → Available responses (ramification)
 * - Argument structure → Tree depth (polarity alternation)
 * 
 * @module
 */

import {
  DeliberationArena,
  ArenaPositionTheory,
  LudicAddress,
  Polarity,
  addressToKey,
  keyToAddress,
} from "../types/ludics-theory";

import {
  buildAddressTree,
  treeToPositions,
  AddressTree,
  DeliberationInput,
} from "./deliberation-address";

import {
  validateLudicability,
  repairPrefixClosure,
  repairRamifications,
  LudicabilityResult,
  LudicabilityError,
} from "./ludicability";

// Note: deliberation-queries is imported dynamically in buildArenaFromDeliberation
// to avoid issues in test environments where Prisma may not be available.
// For synchronous usage, use buildArenaFromDeliberationSync with raw data.

// ============================================================================
// TYPES
// ============================================================================

/**
 * Deliberation data structure (mirrors what fetchDeliberationWithRelations returns)
 * This is a type alias so we don't need to import from deliberation-queries at compile time.
 */
export type DeliberationWithRelationsData = {
  id: string;
  arguments: Array<{
    id: string;
    text: string;
    deliberationId: string;
    conclusionClaimId?: string | null;
    conclusion?: {
      id: string;
      text: string;
      deliberationId?: string | null;
      edgesFrom?: Array<{ toClaimId: string; type: string }>;
      edgesTo?: Array<{ fromClaimId: string; type: string }>;
    } | null;
    premises?: Array<{
      argumentId: string;
      claimId: string;
      isImplicit: boolean;
      isAxiom?: boolean;
      claim?: { id: string; text: string; deliberationId?: string | null };
    }>;
    outgoingEdges?: Array<{
      id: string;
      fromArgumentId: string;
      toArgumentId: string;
      type: string;
      attackType?: string | null;
      targetScope?: string;
      targetPremiseId?: string | null;
    }>;
    incomingEdges?: Array<{
      id: string;
      fromArgumentId: string;
      toArgumentId: string;
      type: string;
      attackType?: string | null;
      targetScope?: string;
      targetPremiseId?: string | null;
    }>;
    schemeId?: string | null;
  }>;
  Claim?: Array<{
    id: string;
    text: string;
    deliberationId?: string | null;
    edgesFrom?: Array<{ toClaimId: string; type: string }>;
    edgesTo?: Array<{ fromClaimId: string; type: string }>;
    asPremiseOf?: Array<{ argumentId: string }>;
    asConclusion?: Array<{ id: string }>;
  }>;
  edges?: Array<{
    id: string;
    fromArgumentId: string;
    toArgumentId: string;
    type: string;
    attackType?: string | null;
    targetScope?: string;
    targetPremiseId?: string | null;
  }>;
  ClaimEdge?: Array<{
    id: string;
    fromClaimId: string;
    toClaimId: string;
    type: string;
  }>;
};

/**
 * Options for building arena from deliberation
 */
export interface BuildArenaOptions {
  /** Deliberation ID to build arena from */
  deliberationId: string;
  
  /** Optional: Specify root claim (otherwise auto-detected) */
  rootClaimId?: string;
  
  /** Maximum tree depth (default: 10) */
  maxDepth?: number;
  
  /** Include implicit premises as positions (default: false) */
  includeImplicitPremises?: boolean;
  
  /** Auto-repair invalid structures (default: true) */
  autoRepair?: boolean;
  
  /** Validate ludicability (default: true) */
  validate?: boolean;
  
  /** Skip database fetch if deliberation data provided */
  deliberationData?: DeliberationWithRelationsData;
}

/**
 * Result of arena construction
 */
export interface BuildArenaResult {
  /** Whether construction succeeded */
  success: boolean;
  
  /** The constructed arena (if successful) */
  arena?: DeliberationArena;
  
  /** Address tree used to build arena */
  addressTree?: AddressTree;
  
  /** Validation result */
  validation?: LudicabilityResult;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Construction statistics */
  stats: {
    buildTimeMs: number;
    positionCount: number;
    maxDepth: number;
    repairsMade: number;
  };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Build a ludic arena from a deliberation
 * 
 * This is the main entry point for Phase 1 arena construction.
 * 
 * @example
 * ```typescript
 * const result = await buildArenaFromDeliberation({
 *   deliberationId: "delib-123",
 *   maxDepth: 8,
 *   autoRepair: true
 * });
 * 
 * if (result.success) {
 *   console.log(`Built arena with ${result.stats.positionCount} positions`);
 *   console.log(result.arena);
 * }
 * ```
 */
export async function buildArenaFromDeliberation(
  options: BuildArenaOptions
): Promise<BuildArenaResult> {
  const startTime = Date.now();
  let repairsMade = 0;
  
  try {
    // Dynamically import database queries to avoid Prisma issues in test environments
    const { fetchDeliberationWithRelations, toDeliberationInput } = 
      await import("./deliberation-queries");
    
    // 1. Fetch deliberation data
    const deliberation = options.deliberationData ??
      await fetchDeliberationWithRelations(options.deliberationId);
    
    if (!deliberation) {
      return {
        success: false,
        error: `Deliberation not found: ${options.deliberationId}`,
        stats: {
          buildTimeMs: Date.now() - startTime,
          positionCount: 0,
          maxDepth: 0,
          repairsMade: 0,
        },
      };
    }
    
    // 2. Convert to input format
    // The locally-declared DeliberationWithRelationsData is a loose mirror of the
    // Prisma payload type expected by toDeliberationInput; cast through the
    // imported parameter type to bridge the two compatible shapes.
    const deliberationInput = toDeliberationInput(
      deliberation as Parameters<typeof toDeliberationInput>[0]
    );
    
    // 3. Build address tree
    const addressTree = buildAddressTree(deliberationInput, {
      rootClaimId: options.rootClaimId,
      maxDepth: options.maxDepth ?? 10,
    });
    
    // 4. Convert to positions
    const positions = treeToPositions(addressTree);
    
    // 5. Auto-repair if enabled
    if (options.autoRepair !== false) {
      repairsMade += repairPrefixClosure(positions);
      repairsMade += repairRamifications(positions);
    }
    
    // 6. Validate if enabled
    let validation: LudicabilityResult | undefined;
    if (options.validate !== false) {
      validation = validateLudicability(positions);
    }
    
    // 7. Compute stats
    let maxDepth = 0;
    for (const position of positions.values()) {
      if (position.address.length > maxDepth) {
        maxDepth = position.address.length;
      }
    }

    // 8. Build the arena
    const arena: DeliberationArena = {
      deliberationId: options.deliberationId,
      rootAddress: addressTree.roots[0] ?? [],
      positions,
      availableDesigns: [],
      statistics: {
        positionCount: positions.size,
        maxDepth,
        branchingFactor: 0,
        terminalCount: 0,
        designCount: 0,
      },
    };

    return {
      success: true,
      arena,
      addressTree,
      validation,
      stats: {
        buildTimeMs: Date.now() - startTime,
        positionCount: positions.size,
        maxDepth,
        repairsMade,
      },
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stats: {
        buildTimeMs: Date.now() - startTime,
        positionCount: 0,
        maxDepth: 0,
        repairsMade: 0,
      },
    };
  }
}

// ============================================================================
// SYNCHRONOUS BUILD (for testing without database)
// ============================================================================

/**
 * Build arena from raw deliberation input (no database fetch)
 * 
 * Useful for testing and when you already have the deliberation data.
 */
export function buildArenaFromDeliberationSync(
  deliberationInput: DeliberationInput,
  options?: Omit<BuildArenaOptions, "deliberationId" | "deliberationData">
): BuildArenaResult {
  const startTime = Date.now();
  let repairsMade = 0;
  
  try {
    // 1. Build address tree
    const addressTree = buildAddressTree(deliberationInput, {
      rootClaimId: options?.rootClaimId,
      maxDepth: options?.maxDepth ?? 10,
    });
    
    // 2. Convert to positions
    const positions = treeToPositions(addressTree);
    
    // 3. Auto-repair if enabled
    if (options?.autoRepair !== false) {
      repairsMade += repairPrefixClosure(positions);
      repairsMade += repairRamifications(positions);
    }
    
    // 4. Validate if enabled
    let validation: LudicabilityResult | undefined;
    if (options?.validate !== false) {
      validation = validateLudicability(positions);
    }
    
    // 5. Compute stats
    let maxDepth = 0;
    for (const position of positions.values()) {
      if (position.address.length > maxDepth) {
        maxDepth = position.address.length;
      }
    }

    // 6. Build the arena
    const arena: DeliberationArena = {
      deliberationId: deliberationInput.id,
      rootAddress: addressTree.roots[0] ?? [],
      positions,
      availableDesigns: [],
      statistics: {
        positionCount: positions.size,
        maxDepth,
        branchingFactor: 0,
        terminalCount: 0,
        designCount: 0,
      },
    };

    return {
      success: true,
      arena,
      addressTree,
      validation,
      stats: {
        buildTimeMs: Date.now() - startTime,
        positionCount: positions.size,
        maxDepth,
        repairsMade,
      },
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stats: {
        buildTimeMs: Date.now() - startTime,
        positionCount: 0,
        maxDepth: 0,
        repairsMade: 0,
      },
    };
  }
}

// ============================================================================
// ARENA QUERY UTILITIES
// ============================================================================

/**
 * Get position at address in arena
 */
export function getArenaPosition(
  arena: DeliberationArena,
  address: LudicAddress
): ArenaPositionTheory | undefined {
  return arena.positions.get(addressToKey(address));
}

/**
 * Get all positions at a given depth
 */
export function getPositionsAtDepth(
  arena: DeliberationArena,
  depth: number
): ArenaPositionTheory[] {
  const result: ArenaPositionTheory[] = [];
  
  for (const position of arena.positions.values()) {
    if (position.address.length === depth) {
      result.push(position);
    }
  }
  
  return result;
}

/**
 * Get children of a position
 */
export function getChildPositions(
  arena: DeliberationArena,
  address: LudicAddress
): ArenaPositionTheory[] {
  const result: ArenaPositionTheory[] = [];
  const position = arena.positions.get(addressToKey(address));
  
  if (!position) return result;
  
  for (const index of position.ramification) {
    const childAddress: LudicAddress = [...address, index];
    const child = arena.positions.get(addressToKey(childAddress));
    if (child) result.push(child);
  }
  
  return result;
}

/**
 * Get parent position
 */
export function getParentPosition(
  arena: DeliberationArena,
  address: LudicAddress
): ArenaPositionTheory | undefined {
  if (address.length === 0) return undefined;
  
  const parentAddress = address.slice(0, -1);
  return arena.positions.get(addressToKey(parentAddress));
}

/**
 * Check if position is terminal (leaf)
 */
export function isTerminalPosition(
  arena: DeliberationArena,
  address: LudicAddress
): boolean {
  const position = arena.positions.get(addressToKey(address));
  return position ? position.ramification.length === 0 : true;
}

/**
 * Get all terminal positions
 */
export function getTerminalPositions(
  arena: DeliberationArena
): ArenaPositionTheory[] {
  const result: ArenaPositionTheory[] = [];
  
  for (const position of arena.positions.values()) {
    if (position.ramification.length === 0) {
      result.push(position);
    }
  }
  
  return result;
}

/**
 * Get positions by polarity
 */
export function getPositionsByPolarity(
  arena: DeliberationArena,
  polarity: "P" | "O"
): ArenaPositionTheory[] {
  const result: ArenaPositionTheory[] = [];

  // ArenaPositionTheory uses Girard-style polarity ("+"/"-"); map the
  // Player/Opponent convention used by this query onto it (P → "+", O → "-").
  const target: Polarity = polarity === "P" ? "+" : "-";

  for (const position of arena.positions.values()) {
    if (position.polarity === target) {
      result.push(position);
    }
  }

  return result;
}

/**
 * Get positions by type
 */
export function getPositionsByType(
  arena: DeliberationArena,
  type: "claim" | "support" | "attack" | "question"
): ArenaPositionTheory[] {
  const result: ArenaPositionTheory[] = [];
  
  for (const position of arena.positions.values()) {
    if (position.type === type) {
      result.push(position);
    }
  }
  
  return result;
}

// ============================================================================
// ARENA SERIALIZATION
// ============================================================================

/**
 * Serialize arena to JSON-safe format
 */
export function serializeArena(arena: DeliberationArena): object {
  return {
    deliberationId: arena.deliberationId,
    rootAddress: arena.rootAddress,
    positions: Array.from(arena.positions.entries()).map(([key, pos]) => ({
      key,
      ...pos,
    })),
    availableDesigns: arena.availableDesigns,
    statistics: arena.statistics,
    id: arena.id,
  };
}

/**
 * Deserialize arena from JSON
 */
export function deserializeArena(data: {
  deliberationId: string;
  rootAddress: LudicAddress;
  positions: Array<{ key: string } & ArenaPositionTheory>;
  availableDesigns?: DeliberationArena["availableDesigns"];
  statistics?: DeliberationArena["statistics"];
  id?: string;
}): DeliberationArena {
  const positions = new Map<string, ArenaPositionTheory>();

  for (const pos of data.positions) {
    const { key, ...position } = pos;
    positions.set(key, position);
  }

  return {
    deliberationId: data.deliberationId,
    rootAddress: data.rootAddress,
    positions,
    availableDesigns: data.availableDesigns ?? [],
    statistics: data.statistics,
    id: data.id,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // From deliberation-address
  buildAddressTree,
  treeToPositions,
  findRootClaims,
  getAllAddresses,
  getNodeAtAddress,
  getChildNodes,
  getParentNode,
  isLeaf,
  getDepth,
  getMaxDepth,
} from "./deliberation-address";

export {
  // From ludicability
  validateLudicability,
  checkPrefixClosureProperty,
  checkDaimonClosureProperty,
  checkSaturationProperty,
  repairPrefixClosure,
  repairRamifications,
} from "./ludicability";

export type {
  AddressTree,
  AddressTreeNode,
  DeliberationInput,
} from "./deliberation-address";

export type {
  LudicabilityResult,
  LudicabilityError,
  ValidationOptions,
} from "./ludicability";
