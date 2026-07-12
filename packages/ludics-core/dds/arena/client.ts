/**
 * DDS Phase 5 - Arena Module Client-Safe Index
 * 
 * This module exports only the functions and types that are safe to use
 * on the client side (no Prisma dependencies).
 * 
 * For server-side code that needs Prisma queries, import from "./index"
 * or directly from "./deliberation-queries".
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

// Arena operations (no Prisma)
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

// Position operations (no Prisma)
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

// Arena Construction types only (functions may have Prisma in some paths)
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

// Non-Prisma arena construction utilities
export {
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
