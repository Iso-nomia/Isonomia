/**
 * Dialogue Move Adapter
 * 
 * Converts between application-level DialogueMove and
 * theory-level DialogueAct types.
 * 
 * This adapter bridges the gap between:
 * - DialogueMove: Used in the application layer (compile-step, deliberation UI)
 * - DialogueAct: Based on Fouqueré & Quatrini's formalization
 */

import type {
  DialogueAct,
  DialogueActType,
  LudicAddress,
  Polarity,
} from "../types/ludics-theory";
import {
  addressToKey,
  keyToAddress,
  createDialogueAct,
  createDaimon,
} from "../types/ludics-theory";

// ============================================================================
// Application-level DialogueMove type (as used in deliberation)
// ============================================================================

/**
 * DialogueMove as used in the application layer
 * 
 * This is the format that comes from the deliberation system,
 * typically representing a move in a dialogue or argument.
 */
export interface DialogueMove {
  id: string;
  /** Target of this move (what it's responding to) */
  targetId?: string;
  /** Content of the move */
  content: string;
  /** Type of move */
  type: "claim" | "support" | "attack" | "question" | "concession" | "withdraw";
  /** Speaker/participant ID */
  speakerId?: string;
  /** Role in the dialogue */
  speakerRole?: "proponent" | "opponent";
  /** Timestamp */
  timestamp?: number;
  /** Parent move ID */
  parentId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Address Mapping
// ============================================================================

/**
 * Address Map: Maps source IDs (argument IDs, move IDs) to ludic addresses
 */
export type AddressMap = Map<string, LudicAddress>;

/**
 * Reverse Address Map: Maps ludic addresses to source IDs
 */
export type ReverseAddressMap = Map<string, string>;

/**
 * Build address map from a tree of moves
 * 
 * @param moves - All moves in the deliberation
 * @param rootId - ID of the root move (or null for moves without parent)
 */
export function buildAddressMap(
  moves: DialogueMove[],
  rootId?: string
): AddressMap {
  const addressMap: AddressMap = new Map();
  const childIndices: Map<string, number> = new Map();

  // Find root moves (no parent or parent is rootId)
  const rootMoves = moves.filter(
    (m) => !m.parentId || m.parentId === rootId
  );

  // Assign root-level addresses
  rootMoves.forEach((move, index) => {
    addressMap.set(move.id, [index]);
    childIndices.set(move.id, 0);
  });

  // Build tree recursively
  const assignChildAddresses = (parentId: string) => {
    const parentAddr = addressMap.get(parentId);
    if (!parentAddr) return;

    const children = moves.filter((m) => m.parentId === parentId);
    children.forEach((child, index) => {
      const childAddr: LudicAddress = [...parentAddr, index];
      addressMap.set(child.id, childAddr);
      childIndices.set(child.id, 0);
      assignChildAddresses(child.id);
    });
  };

  // Assign all child addresses
  rootMoves.forEach((move) => assignChildAddresses(move.id));

  return addressMap;
}

/**
 * Build reverse address map from address map
 */
export function buildReverseAddressMap(addressMap: AddressMap): ReverseAddressMap {
  const reverseMap: ReverseAddressMap = new Map();
  for (const [id, addr] of Array.from(addressMap.entries())) {
    reverseMap.set(addressToKey(addr), id);
  }
  return reverseMap;
}

// ============================================================================
// Type Mapping
// ============================================================================

/**
 * Map move type to dialogue act type
 */
export function mapMoveTypeToActType(
  moveType: DialogueMove["type"]
): DialogueActType {
  switch (moveType) {
    case "claim":
      return "claim";
    case "support":
      return "argue";
    case "attack":
      return "negate";
    case "question":
      return "ask";
    case "concession":
      return "concede";
    case "withdraw":
      return "daimon";
    default:
      return "claim";
  }
}

/**
 * Map dialogue act type back to move type
 */
export function mapActTypeToMoveType(
  actType: DialogueActType
): DialogueMove["type"] {
  switch (actType) {
    case "claim":
      return "claim";
    case "argue":
      return "support";
    case "negate":
      return "attack";
    case "ask":
      return "question";
    case "concede":
      return "concession";
    case "daimon":
      return "withdraw";
    default:
      return "claim";
  }
}

/**
 * Map speaker role to polarity
 */
export function mapRoleToPolarity(
  role: "proponent" | "opponent" | undefined
): Polarity {
  return role === "opponent" ? "-" : "+";
}

/**
 * Map polarity to speaker role
 */
export function mapPolarityToRole(
  polarity: Polarity
): "proponent" | "opponent" {
  return polarity === "+" ? "proponent" : "opponent";
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert DialogueMove to DialogueAct
 * 
 * @param move - The application-level move
 * @param addressMap - Map from move IDs to ludic addresses
 * @param childMoves - Child moves (to compute ramification)
 */
export function dialogueMoveToAct(
  move: DialogueMove,
  addressMap: AddressMap,
  childMoves: DialogueMove[] = []
): DialogueAct {
  const focus = addressMap.get(move.id) ?? [];
  
  // Compute ramification from child moves
  const ramification: LudicAddress[] = childMoves
    .filter((c) => c.parentId === move.id)
    .map((c) => addressMap.get(c.id) ?? [])
    .filter((addr) => addr.length > 0);

  // Handle withdrawal as daimon
  if (move.type === "withdraw") {
    return createDaimon(focus, move.content || "†");
  }

  return createDialogueAct(
    mapRoleToPolarity(move.speakerRole),
    focus,
    ramification,
    move.content,
    mapMoveTypeToActType(move.type)
  );
}

/**
 * Convert DialogueAct to DialogueMove
 * 
 * @param act - The theory-level dialogue act
 * @param reverseAddressMap - Map from ludic addresses to move IDs
 * @param speakerId - Speaker/participant ID
 */
export function actToDialogueMove(
  act: DialogueAct,
  reverseAddressMap: ReverseAddressMap,
  speakerId?: string
): DialogueMove {
  const focusKey = addressToKey(act.focus);
  const id = reverseAddressMap.get(focusKey) ?? `act_${focusKey}`;
  
  // Find parent from focus
  const parentAddr = act.focus.slice(0, -1);
  const parentKey = addressToKey(parentAddr);
  const parentId = parentAddr.length > 0 
    ? reverseAddressMap.get(parentKey) 
    : undefined;

  return {
    id,
    targetId: parentId,
    content: act.expression,
    type: mapActTypeToMoveType(act.type),
    speakerId,
    speakerRole: mapPolarityToRole(act.polarity),
    timestamp: act.timestamp,
    parentId,
  };
}

/**
 * Convert a sequence of DialogueMoves to DialogueActs
 */
export function convertMovesToActs(
  moves: DialogueMove[],
  addressMap?: AddressMap
): DialogueAct[] {
  const map = addressMap ?? buildAddressMap(moves);
  
  return moves.map((move) => {
    const childMoves = moves.filter((m) => m.parentId === move.id);
    return dialogueMoveToAct(move, map, childMoves);
  });
}

/**
 * Convert a sequence of DialogueActs to DialogueMoves
 */
export function convertActsToMoves(
  acts: DialogueAct[],
  reverseAddressMap: ReverseAddressMap,
  speakerId?: string
): DialogueMove[] {
  return acts.map((act) => actToDialogueMove(act, reverseAddressMap, speakerId));
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate roundtrip conversion preserves essential data
 */
export function validateRoundtrip(
  move: DialogueMove,
  addressMap: AddressMap,
  allMoves: DialogueMove[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const childMoves = allMoves.filter((m) => m.parentId === move.id);
  
  // Convert to act
  const act = dialogueMoveToAct(move, addressMap, childMoves);
  
  // Convert back
  const reverseMap = buildReverseAddressMap(addressMap);
  const recovered = actToDialogueMove(act, reverseMap, move.speakerId);
  
  // Check essential fields
  if (recovered.content !== move.content) {
    errors.push(`Content mismatch: "${recovered.content}" vs "${move.content}"`);
  }
  if (recovered.type !== move.type) {
    errors.push(`Type mismatch: ${recovered.type} vs ${move.type}`);
  }
  if (recovered.speakerRole !== move.speakerRole) {
    errors.push(`Role mismatch: ${recovered.speakerRole} vs ${move.speakerRole}`);
  }
  
  return { valid: errors.length === 0, errors };
}
