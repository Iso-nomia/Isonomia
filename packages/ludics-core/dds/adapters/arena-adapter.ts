/**
 * Arena Adapters
 * 
 * Bidirectional conversion between:
 * - DeliberationArena (new theory-aligned type)
 * - UniversalArena (existing game engine type)
 * 
 * This ensures backward compatibility with the existing DDS game engine
 * while allowing the new deliberation-based arena construction to work.
 * 
 * @module
 */

import type {
  UniversalArena,
  ArenaMove,
  EnablingEdge,
} from "../arena/types";

import {
  DeliberationArena,
  ArenaPositionTheory,
  LudicAddress,
  Polarity,
  addressToKey,
  keyToAddress,
} from "../types/ludics-theory";

import {
  createArenaMove,
} from "../arena/types";

// ============================================================================
// LOCAL TYPES & POLARITY MAPPING
// ============================================================================

/**
 * DeliberationArena extended with the ludicability/validation metadata that the
 * arena-construction pipeline attaches at runtime. These fields are not part of
 * the core `DeliberationArena` interface but are produced/consumed by adapters.
 */
type DeliberationArenaExt = DeliberationArena & {
  isLudicable?: boolean;
  validationErrors?: Array<{
    type: string;
    address?: LudicAddress;
    message: string;
    severity: string;
  }>;
  metadata?: Record<string, unknown>;
};

/** Game-engine player ("P"/"O") for a ludics polarity ("+"/"-"). */
function polarityToPlayer(polarity: Polarity): "P" | "O" {
  return polarity === "+" ? "P" : "O";
}

/** Ludics polarity ("+"/"-") for a game-engine player ("P"/"O"). */
function playerToPolarity(player: "P" | "O"): Polarity {
  return player === "P" ? "+" : "-";
}

// ============================================================================
// DELIBERATION ARENA → UNIVERSAL ARENA
// ============================================================================

/**
 * Convert a DeliberationArena to UniversalArena
 * 
 * This allows arenas built from deliberations to be used with
 * the existing game engine.
 * 
 * @param delibArena The deliberation arena to convert
 * @param options Conversion options
 * @returns UniversalArena compatible with game engine
 */
export function deliberationArenaToUniversal(
  delibArena: DeliberationArena,
  options?: {
    /** Custom arena ID (default: auto-generated) */
    arenaId?: string;
    /** Include position metadata in move metadata */
    includeMetadata?: boolean;
  }
): UniversalArena {
  const arenaId = options?.arenaId ?? `arena-delib-${delibArena.deliberationId}-${Date.now()}`;
  const moves: ArenaMove[] = [];
  const enabling: EnablingEdge[] = [];
  
  // Convert each position to an ArenaMove
  for (const [key, position] of delibArena.positions) {
    const move = createArenaMove(
      addressToString(position.address),
      position.ramification,
      {
        id: `move-${key}`,
        player: polarityToPlayer(position.polarity),
        metadata: options?.includeMetadata ? {
          content: position.content,
          type: position.type,
          sourceId: position.sourceId,
          sourceType: position.sourceType,
        } : undefined,
      }
    );
    
    moves.push(move);
  }
  
  // Build enabling relation from address structure
  for (const move of moves) {
    if (move.address.length === 0) continue; // Root has no parent
    
    // Find parent address
    const addressParts = move.address.split("").map(Number);
    const parentAddress = addressParts.slice(0, -1);
    const parentAddressStr = parentAddress.join("");
    const childIndex = addressParts[addressParts.length - 1];
    
    // Find parent move
    const parentMove = moves.find(m => m.address === parentAddressStr);
    if (parentMove && parentMove.ramification.includes(childIndex)) {
      enabling.push({
        justifierId: parentMove.id,
        enabledId: move.id,
        index: childIndex,
      });
      
      // Update move's justifier
      move.justifierId = parentMove.id;
      move.isInitial = false;
    }
  }
  
  return {
    id: arenaId,
    base: "",
    moves,
    enablingRelation: enabling,
    isUniversal: true,
    createdAt: new Date(),
    deliberationId: delibArena.deliberationId,
  };
}

// ============================================================================
// UNIVERSAL ARENA → DELIBERATION ARENA
// ============================================================================

/**
 * Convert a UniversalArena to DeliberationArena
 * 
 * Useful for wrapping existing arenas with the new type system.
 * 
 * @param universal The universal arena to convert
 * @returns DeliberationArena with positions map
 */
export function universalToDeliberationArena(
  universal: UniversalArena
): DeliberationArenaExt {
  const positions = new Map<string, ArenaPositionTheory>();
  
  for (const move of universal.moves) {
    const address = stringToAddress(move.address);
    const key = addressToKey(address);
    
    // Extract metadata if present
    const metadata = move.metadata as {
      content?: string;
      type?: string;
      sourceId?: string;
      sourceType?: string;
    } | undefined;
    
    positions.set(key, {
      address,
      content: metadata?.content ?? (move.address || "(root)"),
      type: mapMoveType(metadata?.type),
      ramification: [...move.ramification],
      polarity: playerToPolarity(move.player),
      sourceId: metadata?.sourceId,
      sourceType: metadata?.sourceType as "claim" | "argument" | undefined,
    });
  }

  return {
    deliberationId: universal.deliberationId ?? universal.id,
    rootAddress: [],
    positions,
    availableDesigns: [],
    isLudicable: true, // Assume valid since it exists
    validationErrors: [],
    metadata: {
      convertedFromUniversal: true,
      originalArenaId: universal.id,
    },
  };
}

// ============================================================================
// POSITION ↔ MOVE CONVERSION
// ============================================================================

/**
 * Convert a single ArenaPositionTheory to ArenaMove
 */
export function positionToMove(
  position: ArenaPositionTheory,
  options?: {
    id?: string;
    includeMetadata?: boolean;
  }
): ArenaMove {
  return createArenaMove(
    addressToString(position.address),
    position.ramification,
    {
      id: options?.id ?? `move-${addressToKey(position.address)}`,
      player: polarityToPlayer(position.polarity),
      metadata: options?.includeMetadata ? {
        content: position.content,
        type: position.type,
        sourceId: position.sourceId,
        sourceType: position.sourceType,
      } : undefined,
    }
  );
}

/**
 * Convert a single ArenaMove to ArenaPositionTheory
 */
export function moveToPosition(
  move: ArenaMove
): ArenaPositionTheory {
  const address = stringToAddress(move.address);
  const metadata = move.metadata as {
    content?: string;
    type?: string;
    sourceId?: string;
    sourceType?: string;
  } | undefined;
  
  return {
    address,
    content: metadata?.content ?? (move.address || "(root)"),
    type: mapMoveType(metadata?.type),
    ramification: [...move.ramification],
    polarity: playerToPolarity(move.player),
    sourceId: metadata?.sourceId,
    sourceType: metadata?.sourceType as "claim" | "argument" | undefined,
  };
}

// ============================================================================
// ADDRESS CONVERSION
// ============================================================================

/**
 * Convert LudicAddress (number[]) to string address
 * 
 * Examples:
 * - [] → ""
 * - [0] → "0"
 * - [0, 1, 2] → "012"
 */
export function addressToString(address: LudicAddress): string {
  return address.join("");
}

/**
 * Convert string address to LudicAddress (number[])
 * 
 * Examples:
 * - "" → []
 * - "0" → [0]
 * - "012" → [0, 1, 2]
 */
export function stringToAddress(str: string): LudicAddress {
  if (!str || str.length === 0) return [];
  return str.split("").map(Number);
}

/**
 * Convert dot-separated path to LudicAddress
 * 
 * Examples:
 * - "" → []
 * - "0" → [0]
 * - "0.1.2" → [0, 1, 2]
 */
export function pathToAddress(path: string): LudicAddress {
  if (!path || path.length === 0) return [];
  return path.split(".").filter(Boolean).map(Number);
}

/**
 * Convert LudicAddress to dot-separated path
 * 
 * Examples:
 * - [] → ""
 * - [0] → "0"
 * - [0, 1, 2] → "0.1.2"
 */
export function addressToPath(address: LudicAddress): string {
  return address.join(".");
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map string type to position type
 */
function mapMoveType(
  type?: string
): "claim" | "support" | "attack" | "question" {
  switch (type) {
    case "support":
    case "argue":
      return "support";
    case "attack":
    case "rebut":
    case "challenge":
      return "attack";
    case "question":
    case "query":
      return "question";
    default:
      return "claim";
  }
}

// ============================================================================
// ARENA MERGE & TRANSFORM
// ============================================================================

/**
 * Merge two deliberation arenas
 * 
 * Creates a new arena with positions from both, prefixed to avoid collisions.
 * 
 * @param arena1 First arena (positions at [0, ...])
 * @param arena2 Second arena (positions at [1, ...])
 * @returns Merged arena with both position sets
 */
export function mergeArenas(
  arena1: DeliberationArenaExt,
  arena2: DeliberationArenaExt
): DeliberationArenaExt {
  const positions = new Map<string, ArenaPositionTheory>();

  // Add root position
  positions.set(addressToKey([]), {
    address: [],
    content: "Merged deliberation root",
    type: "claim",
    ramification: [0, 1],
    polarity: "+",
  });
  
  // Add arena1 positions with [0, ...] prefix
  for (const [key, position] of arena1.positions) {
    const newAddress: LudicAddress = [0, ...position.address];
    const newKey = addressToKey(newAddress);
    
    positions.set(newKey, {
      ...position,
      address: newAddress,
      ramification: [...position.ramification],
    });
  }
  
  // Add arena2 positions with [1, ...] prefix
  for (const [key, position] of arena2.positions) {
    const newAddress: LudicAddress = [1, ...position.address];
    const newKey = addressToKey(newAddress);
    
    positions.set(newKey, {
      ...position,
      address: newAddress,
      ramification: [...position.ramification],
    });
  }
  
  return {
    deliberationId: `merged-${arena1.deliberationId}-${arena2.deliberationId}`,
    rootAddress: [],
    positions,
    availableDesigns: [],
    isLudicable: (arena1.isLudicable ?? true) && (arena2.isLudicable ?? true),
    validationErrors: [
      ...(arena1.validationErrors ?? []),
      ...(arena2.validationErrors ?? []),
    ],
    metadata: {
      merged: true,
      sourceArenas: [arena1.deliberationId, arena2.deliberationId],
    },
  };
}

/**
 * Extract a sub-arena rooted at a specific address
 * 
 * @param arena Source arena
 * @param rootAddress Address to use as new root
 * @returns Sub-arena with positions relative to new root
 */
export function extractSubArena(
  arena: DeliberationArenaExt,
  rootAddress: LudicAddress
): DeliberationArenaExt {
  const positions = new Map<string, ArenaPositionTheory>();
  const rootKey = addressToKey(rootAddress);
  
  // Check if root exists
  if (!arena.positions.has(rootKey)) {
    return {
      deliberationId: arena.deliberationId,
      rootAddress: [],
      positions,
      availableDesigns: [],
      isLudicable: false,
      validationErrors: [{
        type: "missing-prefix",
        address: rootAddress,
        message: `Root address [${rootAddress.join(",")}] not found in arena`,
        severity: "error",
      }],
    };
  }
  
  // Extract positions that have rootAddress as prefix
  for (const [key, position] of arena.positions) {
    // Check if this position starts with rootAddress
    const isChild = rootAddress.every((v, i) => position.address[i] === v);
    
    if (isChild) {
      // Create new address relative to root
      const newAddress = position.address.slice(rootAddress.length);
      const newKey = addressToKey(newAddress);
      
      positions.set(newKey, {
        ...position,
        address: newAddress,
        ramification: [...position.ramification],
      });
    }
  }
  
  return {
    deliberationId: `${arena.deliberationId}-sub-${rootKey}`,
    rootAddress: [],
    positions,
    availableDesigns: [],
    isLudicable: arena.isLudicable ?? true,
    validationErrors: [],
    metadata: {
      extractedFrom: arena.deliberationId,
      originalRootAddress: rootAddress,
    },
  };
}

// ============================================================================
// ARENA STATISTICS
// ============================================================================

/**
 * Compute statistics about an arena
 */
export function computeArenaStats(arena: DeliberationArena): {
  positionCount: number;
  maxDepth: number;
  terminalCount: number;
  branchingFactor: number;
  pPositions: number;
  oPositions: number;
  claimCount: number;
  supportCount: number;
  attackCount: number;
} {
  let maxDepth = 0;
  let terminalCount = 0;
  let pPositions = 0;
  let oPositions = 0;
  let claimCount = 0;
  let supportCount = 0;
  let attackCount = 0;
  let totalRamification = 0;
  let nonTerminalCount = 0;
  
  for (const position of arena.positions.values()) {
    // Depth
    if (position.address.length > maxDepth) {
      maxDepth = position.address.length;
    }
    
    // Terminal
    if (position.ramification.length === 0) {
      terminalCount++;
    } else {
      nonTerminalCount++;
      totalRamification += position.ramification.length;
    }
    
    // Polarity
    if (position.polarity === "+") {
      pPositions++;
    } else {
      oPositions++;
    }
    
    // Type
    switch (position.type) {
      case "claim":
        claimCount++;
        break;
      case "support":
        supportCount++;
        break;
      case "attack":
        attackCount++;
        break;
    }
  }
  
  return {
    positionCount: arena.positions.size,
    maxDepth,
    terminalCount,
    branchingFactor: nonTerminalCount > 0 ? totalRamification / nonTerminalCount : 0,
    pPositions,
    oPositions,
    claimCount,
    supportCount,
    attackCount,
  };
}
