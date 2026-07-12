/**
 * DDS Phase 5 - Arena Module Index
 * 
 * Exports all arena-related types and functions.
 */

// Types
export type {
  UniversalArena,
  ArenaMove,
  EnablingEdge,
  ArenaLabel,
  LegalPosition,
  PositionValidity,
  PlayerView,
  LudicsGame,
  GameStrategy,
  GamePlayState,
  MoveLogEntry,
  EncodedGameState,
  EncodedArena,
} from "./types";

// Type factory functions
export {
  createArenaMove,
  getPlayerFromAddress,
  createInitialPosition,
  createPositionValidity,
  serializePosition,
  serializeMove,
} from "./types";

// Arena operations
export {
  createUniversalArena,
  createArenaFromDesigns,
  delocateArena,
  getMoveById,
  getMovesAtAddress,
  getInitialMoves,
  getMovesForPlayer,
  checkEnabling,
  getEnabledMoves,
  getJustifier,
  getAncestors,
  getDescendants,
  encodeArena,
  decodeArena,
  validateArena,
  getArenaStats,
} from "./arena";

// Position operations
export {
  validatePosition,
  computeView,
  computeViewForSequence,
  computePView,
  computeOView,
  getAvailableMoves,
  applyMove,
  isTerminalPosition,
  getWinner,
  PositionCache,
  enumerateLegalPositions,
} from "./positions";

// Arena Construction from Deliberation (Phase 1)
export {
  buildArenaFromDeliberation,
  buildArenaFromDeliberationSync,
  getArenaPosition,
  getPositionsAtDepth,
  getChildPositions,
  getParentPosition,
  isTerminalPosition as isTerminalArenaPosition,
  getTerminalPositions,
  getPositionsByPolarity,
  getPositionsByType,
  serializeArena,
  deserializeArena,
  // Re-exports from sub-modules
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
  validateLudicability,
  checkPrefixClosureProperty,
  checkDaimonClosureProperty,
  checkSaturationProperty,
  repairPrefixClosure,
  repairRamifications,
} from "./arena-construction";

export type {
  BuildArenaOptions,
  BuildArenaResult,
  AddressTree,
  AddressTreeNode,
  DeliberationInput,
  LudicabilityResult,
  LudicabilityError,
  ValidationOptions,
} from "./arena-construction";

// Deliberation queries
export {
  fetchDeliberationWithRelations,
  fetchDeliberationsWithRelations,
  fetchDeliberationBasic,
  fetchArgumentEdges,
  fetchClaimEdges,
  countDeliberationElements,
  deliberationExists,
  resolveDeliberationId,
  toDeliberationInput,
  deliberationWithRelationsInclude,
} from "./deliberation-queries";

export type {
  DeliberationWithRelations,
  ArgumentWithRelations,
  ClaimWithRelations,
} from "./deliberation-queries";
