/**
 * Legacy Adapter
 * 
 * Converts between existing DDS types (types.ts, arena/types.ts, game/types.ts)
 * and the new theory-aligned types.
 * 
 * This adapter ensures backward compatibility while we migrate to the
 * theory-aligned type system.
 */

import type {
  DialogueAct as TheoryDialogueAct,
  Chronicle as TheoryChronicle,
  LudicDesignTheory,
  LudicAddress,
  Polarity as TheoryPolarity,
  ArenaPositionTheory,
  DeliberationArena,
} from "../types/ludics-theory";
import {
  addressToKey,
  keyToAddress,
  polarityAtAddress,
  createDialogueAct,
  createDaimon,
} from "../types/ludics-theory";

// Import legacy types
import type {
  DialogueAct as LegacyDialogueAct,
  LudicDesign as LegacyLudicDesign,
  Polarity as LegacyPolarity,
} from "../../types";
import type {
  Action as LegacyAction,
  Chronicle as LegacyChronicle,
} from "../types";
import type {
  UniversalArena as LegacyUniversalArena,
  ArenaMove as LegacyArenaMove,
  LegalPosition as LegacyLegalPosition,
} from "../arena/types";

// ============================================================================
// Polarity Conversion
// ============================================================================

/**
 * Convert legacy polarity to theory polarity
 */
export function legacyToTheoryPolarity(polarity: LegacyPolarity): TheoryPolarity {
  if (polarity === "P" || polarity === "pos") return "+";
  if (polarity === "O" || polarity === "neg") return "-";
  // Daimon maps to positive (the act of giving up is positive)
  return "+";
}

/**
 * Convert theory polarity to legacy polarity
 */
export function theoryToLegacyPolarity(polarity: TheoryPolarity): LegacyPolarity {
  return polarity === "+" ? "P" : "O";
}

// ============================================================================
// Address Conversion
// ============================================================================

/**
 * Convert legacy locus path (string like "0.1.2") to theory address
 */
export function locusPathToAddress(locusPath: string): LudicAddress {
  if (!locusPath || locusPath === "" || locusPath === "0") return [];
  return locusPath.split(".").map((s) => parseInt(s, 10));
}

/**
 * Convert theory address to legacy locus path
 */
export function addressToLocusPath(address: LudicAddress): string {
  if (address.length === 0) return "0";
  return address.join(".");
}

// ============================================================================
// Action/Act Conversion
// ============================================================================

/**
 * Convert legacy DialogueAct to theory DialogueAct
 */
export function legacyActToTheory(act: LegacyDialogueAct): TheoryDialogueAct {
  const focus = locusPathToAddress(act.locusPath ?? act.locus ?? "");
  
  // Parse ramification/openings
  const ramification: LudicAddress[] = (act.openings ?? act.ramification ?? [])
    .map((o) => {
      if (typeof o === "string") {
        // Could be suffix or full path
        if (o.includes(".")) {
          return locusPathToAddress(o);
        }
        // Suffix - append to focus
        return [...focus, parseInt(o, 10)];
      }
      return [...focus, o];
    });

  // Determine type from kind or polarity
  const isDaimon = act.kind === "DAIMON" || act.polarity === "daimon";
  
  return {
    polarity: isDaimon ? "+" : legacyToTheoryPolarity(act.polarity ?? "P"),
    focus,
    ramification,
    expression: act.expression ?? "",
    type: isDaimon ? "daimon" : "claim",
  };
}

/**
 * Convert theory DialogueAct to legacy DialogueAct
 */
export function theoryActToLegacy(act: TheoryDialogueAct): LegacyDialogueAct {
  return {
    kind: act.type === "daimon" ? "DAIMON" : "PROPER",
    polarity: act.type === "daimon" ? "daimon" : theoryToLegacyPolarity(act.polarity),
    locus: addressToLocusPath(act.focus),
    locusPath: addressToLocusPath(act.focus),
    ramification: act.ramification.map((r) => addressToLocusPath(r)),
    openings: act.ramification.map((r) => addressToLocusPath(r)),
    expression: act.expression,
    additive: false,
  };
}

/**
 * Convert legacy Action (DDS types.ts) to theory DialogueAct
 */
export function legacyActionToTheory(action: LegacyAction): TheoryDialogueAct {
  const focus = locusPathToAddress(action.focus);
  const ramification = action.ramification.map((i) => [...focus, i]);
  
  return createDialogueAct(
    legacyToTheoryPolarity(action.polarity),
    focus,
    ramification,
    action.expression ?? "",
    "claim"
  );
}

/**
 * Convert theory DialogueAct to legacy Action
 */
export function theoryActionToLegacy(act: TheoryDialogueAct): LegacyAction {
  // Extract ramification indices (last element of each ramification address)
  const ramification = act.ramification.map((r) => r[r.length - 1] ?? 0);
  
  return {
    focus: addressToLocusPath(act.focus),
    ramification,
    polarity: theoryToLegacyPolarity(act.polarity) as "P" | "O",
    expression: act.expression,
    ts: act.timestamp,
  };
}

// ============================================================================
// Chronicle Conversion
// ============================================================================

/**
 * Convert legacy Chronicle to theory Chronicle
 */
export function legacyChronicleToTheory(chronicle: LegacyChronicle): TheoryChronicle {
  const actions = chronicle.actions.map(legacyActionToTheory);
  const hasDaimon = actions.some((a) => a.type === "daimon");
  const lastAction = actions[actions.length - 1];
  
  return {
    id: chronicle.id,
    actions,
    isComplete: hasDaimon || (lastAction?.ramification.length === 0),
  };
}

/**
 * Convert theory Chronicle to legacy Chronicle
 */
export function theoryChronicleToLegacy(
  chronicle: TheoryChronicle,
  designId: string
): LegacyChronicle {
  const actions = chronicle.actions.map(theoryActionToLegacy);
  
  return {
    id: chronicle.id ?? `chr_${designId}`,
    designId,
    actions,
    polarity: actions[0]?.polarity ?? "P",
    isPositive: actions[actions.length - 1]?.polarity === "P",
  };
}

// ============================================================================
// Design Conversion
// ============================================================================

/**
 * Convert legacy LudicDesign to theory LudicDesignTheory
 */
export function legacyDesignToTheory(design: LegacyLudicDesign): LudicDesignTheory {
  const acts = design.acts.map(legacyActToTheory);
  
  // Build a single chronicle from the acts
  const hasDaimon = acts.some((a) => a.type === "daimon");
  const chronicles: TheoryChronicle[] = acts.length > 0
    ? [{
        actions: acts,
        isComplete: hasDaimon || acts[acts.length - 1]?.ramification.length === 0,
      }]
    : [];
  
  // Parse base
  const base = (design.base ?? ["0"]).map(locusPathToAddress);
  
  return {
    id: design.id ?? `design_${Date.now()}`,
    base,
    polarity: acts[0]?.polarity ?? "+",
    chronicles,
    hasDaimon,
    isWinning: !hasDaimon,
  };
}

/**
 * Convert theory LudicDesignTheory to legacy LudicDesign
 */
export function theoryDesignToLegacy(design: LudicDesignTheory): LegacyLudicDesign {
  // Flatten chronicles to acts
  const acts: LegacyDialogueAct[] = design.chronicles
    .flatMap((c) => c.actions)
    .map(theoryActToLegacy);
  
  return {
    id: design.id,
    base: design.base.map(addressToLocusPath),
    acts,
  };
}

// ============================================================================
// Arena Conversion
// ============================================================================

/**
 * Convert legacy ArenaMove to theory ArenaPositionTheory
 */
export function legacyMoveToPosition(move: LegacyArenaMove): ArenaPositionTheory {
  const address = locusPathToAddress(move.address);
  // Theory ramification is the list of sub-address indices (number[])
  const ramification: number[] = [...move.ramification];

  return {
    address,
    content: move.label ?? "",
    type: "claim", // Default type
    ramification,
    polarity: move.player === "P" ? "+" : "-",
    depth: address.length,
    sourceId: move.id,
  };
}

/**
 * Convert theory ArenaPositionTheory to legacy ArenaMove
 */
export function theoryPositionToMove(
  position: ArenaPositionTheory,
  id: string
): LegacyArenaMove {
  // Theory ramification is already a list of indices (number[])
  const ramification: number[] = [...position.ramification];

  return {
    id,
    address: addressToLocusPath(position.address),
    ramification,
    player: position.polarity === "+" ? "P" : "O",
    isInitial: position.address.length === 0,
    label: position.content,
  };
}

/**
 * Convert legacy UniversalArena to theory DeliberationArena
 */
export function legacyArenaToTheory(
  arena: LegacyUniversalArena,
  deliberationId: string
): DeliberationArena {
  const positions = new Map<string, ArenaPositionTheory>();
  
  for (const move of arena.moves) {
    const position = legacyMoveToPosition(move);
    positions.set(addressToKey(position.address), position);
  }
  
  return {
    id: arena.id,
    deliberationId,
    rootAddress: [],
    positions,
    availableDesigns: [],
    statistics: {
      positionCount: positions.size,
      maxDepth: Math.max(0, ...Array.from(positions.values()).map((p) => p.depth ?? p.address.length)),
      branchingFactor: arena.moves.length > 0 
        ? arena.moves.reduce((sum, m) => sum + m.ramification.length, 0) / arena.moves.length
        : 0,
      terminalCount: Array.from(positions.values()).filter((p) => p.ramification.length === 0).length,
      designCount: 0,
    },
  };
}

/**
 * Convert theory DeliberationArena to legacy UniversalArena
 */
export function theoryArenaToLegacy(arena: DeliberationArena): LegacyUniversalArena {
  const moves: LegacyArenaMove[] = [];
  const enablingRelation: Array<{ justifierId: string; enabledId: string; index: number }> = [];
  
  let moveIndex = 0;
  for (const [key, position] of Array.from(arena.positions.entries())) {
    const moveId = `move_${moveIndex++}`;
    moves.push(theoryPositionToMove(position, moveId));
    
    // Build enabling relation
    if (position.address.length > 0) {
      const parentAddr = position.address.slice(0, -1);
      const parentKey = addressToKey(parentAddr);
      const parentMove = moves.find((m) => m.address === addressToLocusPath(parentAddr));
      if (parentMove) {
        enablingRelation.push({
          justifierId: parentMove.id,
          enabledId: moveId,
          index: position.address[position.address.length - 1],
        });
      }
    }
  }
  
  return {
    id: arena.id ?? `arena_${arena.deliberationId}`,
    base: "",
    moves,
    enablingRelation,
    isUniversal: true,
    deliberationId: arena.deliberationId,
  };
}

// ============================================================================
// Batch Conversion Helpers
// ============================================================================

/**
 * Convert multiple legacy acts to theory acts
 */
export function convertLegacyActs(acts: LegacyDialogueAct[]): TheoryDialogueAct[] {
  return acts.map(legacyActToTheory);
}

/**
 * Convert multiple theory acts to legacy acts
 */
export function convertTheoryActs(acts: TheoryDialogueAct[]): LegacyDialogueAct[] {
  return acts.map(theoryActToLegacy);
}

/**
 * Convert multiple legacy actions to theory acts
 */
export function convertLegacyActions(actions: LegacyAction[]): TheoryDialogueAct[] {
  return actions.map(legacyActionToTheory);
}

/**
 * Convert multiple theory acts to legacy actions
 */
export function convertTheoryActsToActions(acts: TheoryDialogueAct[]): LegacyAction[] {
  return acts.map(theoryActionToLegacy);
}
