/**
 * DDS Phase 5 - Arena Operations
 * 
 * Based on Faggian & Hyland (2002) - Definition 3.1 (Universal Arena)
 * 
 * Core arena creation, manipulation, and query functions.
 */

import type {
  UniversalArena,
  ArenaMove,
  EnablingEdge,
  EncodedArena,
} from "./types";
import {
  createArenaMove,
  getPlayerFromAddress,
} from "./types";

// ============================================================================
// Arena Creation
// ============================================================================

/**
 * Create Universal Arena
 * 
 * The universal arena has base "" (empty address) and includes
 * all possible moves up to a specified depth.
 */
export function createUniversalArena(
  options?: {
    id?: string;
    maxDepth?: number;
    maxRamification?: number;
    deliberationId?: string;
  }
): UniversalArena {
  const id = options?.id ?? `arena-${Date.now()}`;
  const maxDepth = options?.maxDepth ?? 3;
  const maxRam = options?.maxRamification ?? 3;
  
  const moves: ArenaMove[] = [];
  const enablingRelation: EnablingEdge[] = [];
  
  // Generate moves recursively up to maxDepth
  generateMoves("", maxDepth, maxRam, moves, enablingRelation, null);
  
  return {
    id,
    base: "",
    moves,
    enablingRelation,
    isUniversal: true,
    createdAt: new Date(),
    deliberationId: options?.deliberationId,
  };
}

/**
 * Recursively generate moves for arena
 */
function generateMoves(
  address: string,
  remainingDepth: number,
  maxRamification: number,
  moves: ArenaMove[],
  enabling: EnablingEdge[],
  parentId: string | null
): void {
  if (remainingDepth <= 0) return;
  
  // Generate moves with different ramifications at this address
  // For simplicity, generate a single move per address with full ramification
  const ramification = Array.from({ length: maxRamification }, (_, i) => i);
  
  const move = createArenaMove(address, ramification, {
    id: `move-${address || "root"}-${moves.length}`,
    justifierId: parentId ?? undefined,
  });
  
  moves.push(move);
  
  // Add enabling edge if has parent
  if (parentId) {
    // Find parent's ramification index that leads to this address
    const parentAddress = address.slice(0, -1);
    const index = parseInt(address[address.length - 1], 10);
    
    enabling.push({
      justifierId: parentId,
      enabledId: move.id,
      index,
    });
  }
  
  // Generate child moves for each ramification index
  for (const idx of ramification) {
    const childAddress = `${address}${idx}`;
    generateMoves(
      childAddress,
      remainingDepth - 1,
      maxRamification,
      moves,
      enabling,
      move.id
    );
  }
}

/**
 * Create arena from existing designs/behaviours
 * 
 * Extracts the arena structure from a set of designs.
 */
export function createArenaFromDesigns(
  designs: Array<{
    id: string;
    acts: Array<{
      id: string;
      locusPath: string;
      ramification: number[];
      polarity: string;
    }>;
  }>,
  options?: {
    id?: string;
    deliberationId?: string;
  }
): UniversalArena {
  const id = options?.id ?? `arena-${Date.now()}`;
  const movesMap = new Map<string, ArenaMove>();
  const enabling: EnablingEdge[] = [];
  
  // Extract moves from all designs
  for (const design of designs) {
    for (const act of design.acts || []) {
      const address = act.locusPath || "";
      const key = `${address}:${act.ramification.join(",")}`;
      
      if (!movesMap.has(key)) {
        const move = createArenaMove(address, act.ramification, {
          id: act.id || `move-${address}-${movesMap.size}`,
        });
        movesMap.set(key, move);
      }
    }
  }
  
  // Build enabling relation from address structure
  const moves = Array.from(movesMap.values());
  buildEnablingRelation(moves, enabling);
  
  return {
    id,
    base: "",
    moves,
    enablingRelation: enabling,
    isUniversal: true,
    createdAt: new Date(),
    deliberationId: options?.deliberationId,
  };
}

/**
 * Build enabling relation from moves based on address structure
 */
function buildEnablingRelation(
  moves: ArenaMove[],
  enabling: EnablingEdge[]
): void {
  // Index moves by address for lookup
  const movesByAddress = new Map<string, ArenaMove[]>();
  for (const move of moves) {
    const existing = movesByAddress.get(move.address) || [];
    existing.push(move);
    movesByAddress.set(move.address, existing);
  }
  
  // For each non-initial move, find its justifier
  for (const move of moves) {
    if (move.address.length === 0) continue; // Initial move
    
    const parentAddress = move.address.slice(0, -1);
    const index = parseInt(move.address[move.address.length - 1], 10);
    
    const parentMoves = movesByAddress.get(parentAddress) || [];
    
    for (const parent of parentMoves) {
      // Check if parent's ramification includes this index
      if (parent.ramification.includes(index)) {
        enabling.push({
          justifierId: parent.id,
          enabledId: move.id,
          index,
        });
        
        // Update move's justifier reference
        move.justifierId = parent.id;
        move.isInitial = false;
      }
    }
  }
}

// ============================================================================
// Arena Delocalization
// ============================================================================

/**
 * Delocate arena to a specific address
 * 
 * Creates an "atomic arena" by shifting all addresses to start from
 * the given base address.
 * 
 * @param arena - Original arena
 * @param baseAddress - New base address (e.g., "0", "01")
 */
export function delocateArena(
  arena: UniversalArena,
  baseAddress: string
): UniversalArena {
  if (!baseAddress) return arena;
  
  const newMoves: ArenaMove[] = arena.moves.map(move => ({
    ...move,
    id: `${move.id}-at-${baseAddress}`,
    address: baseAddress + move.address,
    player: getPlayerFromAddress(baseAddress + move.address),
    isInitial: move.address === "",
  }));
  
  const newEnabling: EnablingEdge[] = arena.enablingRelation.map(edge => ({
    justifierId: `${edge.justifierId}-at-${baseAddress}`,
    enabledId: `${edge.enabledId}-at-${baseAddress}`,
    index: edge.index,
  }));
  
  return {
    ...arena,
    id: `${arena.id}-at-${baseAddress}`,
    base: baseAddress,
    moves: newMoves,
    enablingRelation: newEnabling,
    isUniversal: false,
    delocalizationAddress: baseAddress,
  };
}

// ============================================================================
// Arena Queries
// ============================================================================

/**
 * Get move by ID
 */
export function getMoveById(
  arena: UniversalArena,
  moveId: string
): ArenaMove | undefined {
  return arena.moves.find(m => m.id === moveId);
}

/**
 * Get moves at a specific address
 */
export function getMovesAtAddress(
  arena: UniversalArena,
  address: string
): ArenaMove[] {
  return arena.moves.filter(m => m.address === address);
}

/**
 * Get initial moves (moves at base address)
 */
export function getInitialMoves(arena: UniversalArena): ArenaMove[] {
  return arena.moves.filter(m => m.isInitial);
}

/**
 * Get moves for a specific player
 */
export function getMovesForPlayer(
  arena: UniversalArena,
  player: "P" | "O"
): ArenaMove[] {
  return arena.moves.filter(m => m.player === player);
}

/**
 * Check if move A enables move B (enabling relation)
 * 
 * (ξ, I) justifies (ξi, J) if i ∈ I
 */
export function checkEnabling(
  justifier: ArenaMove,
  enabled: ArenaMove
): boolean {
  // Enabled address must be child of justifier address
  if (!enabled.address.startsWith(justifier.address)) return false;
  if (enabled.address.length !== justifier.address.length + 1) return false;
  
  // Get the index that extends the address
  const index = parseInt(
    enabled.address[enabled.address.length - 1],
    10
  );
  
  // Check if justifier's ramification includes this index
  return justifier.ramification.includes(index);
}

/**
 * Get all moves enabled by a given move
 */
export function getEnabledMoves(
  arena: UniversalArena,
  move: ArenaMove
): ArenaMove[] {
  return arena.moves.filter(m => checkEnabling(move, m));
}

/**
 * Get the justifier of a move
 */
export function getJustifier(
  arena: UniversalArena,
  move: ArenaMove
): ArenaMove | undefined {
  if (move.isInitial || !move.justifierId) return undefined;
  return arena.moves.find(m => m.id === move.justifierId);
}

/**
 * Get all ancestors of a move (justification chain)
 */
export function getAncestors(
  arena: UniversalArena,
  move: ArenaMove
): ArenaMove[] {
  const ancestors: ArenaMove[] = [];
  let current = move;
  
  while (current.justifierId) {
    const parent = arena.moves.find(m => m.id === current.justifierId);
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }
  
  return ancestors;
}

/**
 * Get all descendants of a move (enabled tree)
 */
export function getDescendants(
  arena: UniversalArena,
  move: ArenaMove
): ArenaMove[] {
  const descendants: ArenaMove[] = [];
  const queue = [move];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = getEnabledMoves(arena, current);
    
    for (const child of children) {
      descendants.push(child);
      queue.push(child);
    }
  }
  
  return descendants;
}

// ============================================================================
// Arena Encoding/Decoding (for compact storage)
// ============================================================================

/**
 * Encode arena to compact format for storage
 */
export function encodeArena(arena: UniversalArena): EncodedArena {
  return {
    v: 1,
    id: arena.id,
    b: arena.base,
    m: arena.moves
      .map(m => `${m.address}:${m.ramification.join(",")}`)
      .join("|"),
    e: arena.enablingRelation
      .map(e => `${e.justifierId}>${e.enabledId}:${e.index}`)
      .join("|"),
  };
}

/**
 * Decode arena from compact format
 */
export function decodeArena(encoded: EncodedArena): UniversalArena {
  const moves: ArenaMove[] = encoded.m.split("|").filter(Boolean).map((moveStr, idx) => {
    const [address, ramStr] = moveStr.split(":");
    const ramification = ramStr ? ramStr.split(",").map(Number).filter(n => !isNaN(n)) : [];
    
    return createArenaMove(address || "", ramification, {
      id: `move-${address || "root"}-${idx}`,
    });
  });
  
  // Build move ID lookup
  const moveIdLookup = new Map<string, string>();
  moves.forEach(m => {
    const key = `${m.address}:${m.ramification.join(",")}`;
    moveIdLookup.set(key, m.id);
  });
  
  const enablingRelation: EnablingEdge[] = encoded.e.split("|").filter(Boolean).map(edgeStr => {
    const [ids, indexStr] = edgeStr.split(":");
    const [justifierId, enabledId] = ids.split(">");
    return {
      justifierId,
      enabledId,
      index: parseInt(indexStr, 10),
    };
  });
  
  return {
    id: encoded.id,
    base: encoded.b,
    moves,
    enablingRelation,
    isUniversal: encoded.b === "",
    delocalizationAddress: encoded.b || undefined,
    createdAt: new Date(),
  };
}

// ============================================================================
// Arena Validation
// ============================================================================

/**
 * Validate arena structure
 */
export function validateArena(arena: UniversalArena): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check all moves have valid player assignment
  for (const move of arena.moves) {
    const expectedPlayer = getPlayerFromAddress(move.address);
    if (move.player !== expectedPlayer) {
      errors.push(
        `Move ${move.id} has incorrect player: expected ${expectedPlayer}, got ${move.player}`
      );
    }
  }
  
  // Check enabling edges reference valid moves
  const moveIds = new Set(arena.moves.map(m => m.id));
  for (const edge of arena.enablingRelation) {
    if (!moveIds.has(edge.justifierId)) {
      errors.push(`Enabling edge references unknown justifier: ${edge.justifierId}`);
    }
    if (!moveIds.has(edge.enabledId)) {
      errors.push(`Enabling edge references unknown enabled move: ${edge.enabledId}`);
    }
  }
  
  // Check non-initial moves have justifiers
  for (const move of arena.moves) {
    if (!move.isInitial && !move.justifierId) {
      errors.push(`Non-initial move ${move.id} has no justifier`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get arena statistics
 */
export function getArenaStats(arena: UniversalArena): {
  moveCount: number;
  maxDepth: number;
  pMoves: number;
  oMoves: number;
  initialMoves: number;
  enablingEdges: number;
} {
  let maxDepth = 0;
  let pMoves = 0;
  let oMoves = 0;
  let initialMoves = 0;
  
  for (const move of arena.moves) {
    maxDepth = Math.max(maxDepth, move.address.length);
    if (move.player === "P") pMoves++;
    else oMoves++;
    if (move.isInitial) initialMoves++;
  }
  
  return {
    moveCount: arena.moves.length,
    maxDepth,
    pMoves,
    oMoves,
    initialMoves,
    enablingEdges: arena.enablingRelation.length,
  };
}
