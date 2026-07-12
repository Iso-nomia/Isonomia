/**
 * DDS Phase 5 - Part 1: Game Construction
 * 
 * Based on Faggian & Hyland (2002) - Section 6.2
 * 
 * Games are derived from behaviours, representing the playing structure
 * extracted from the design space.
 */

import type { DesignForCorrespondence, DesignAct } from "../correspondence/types";
import type { Strategy } from "../strategy/types";
import type {
  Behaviour,
  Game,
  Arena,
  Move,
  GamePosition,
  GameStrategy,
  ArenaLabel,
  GameConstructionOptions,
  createGame,
  createArena,
} from "./types";

/**
 * Default game construction options
 */
const DEFAULT_GAME_OPTIONS: Required<GameConstructionOptions> = {
  maxPositions: 1000,
  computeStrategies: true,
  validatePositions: true,
};

/**
 * Construct a game from a behaviour (Section 6.2)
 * 
 * The game represents the interactive structure inherent in the behaviour.
 */
export async function behaviourToGame(
  behaviour: Behaviour,
  designs: DesignForCorrespondence[],
  options?: GameConstructionOptions
): Promise<Game> {
  const opts = { ...DEFAULT_GAME_OPTIONS, ...options };

  // Filter to designs in this behaviour
  const behaviourDesigns = designs.filter((d) =>
    behaviour.closureDesignIds.includes(d.id)
  );

  // Extract arena from behaviour designs
  const arena = extractArena(behaviourDesigns);

  // Compute all legal positions
  const positions = await computeLegalPositions(
    behaviourDesigns,
    arena,
    opts.maxPositions,
    opts.validatePositions
  );

  // Extract moves from positions
  const moves = extractMoves(positions);

  // Compute strategies if requested
  const strategies = opts.computeStrategies
    ? await computeGameStrategies(behaviourDesigns)
    : [];

  return {
    id: `game-${behaviour.id}`,
    behaviourId: behaviour.id,
    arena,
    moves,
    positions,
    strategies,
  };
}

/**
 * Extract arena from behaviour designs
 * 
 * Arena = (Γ, Λ, λ) where:
 * - Γ is the set of addresses
 * - Λ is the set of legal positions
 * - λ is the labeling function
 */
function extractArena(designs: DesignForCorrespondence[]): Arena {
  const addressSet = new Set<string>();
  const labeling: Record<string, ArenaLabel> = {};

  // Collect all addresses and their labels from designs
  for (const design of designs) {
    // Add addresses from loci
    for (const locus of design.loci || []) {
      addressSet.add(locus.path);
    }

    // Add addresses from acts and build labeling
    for (const act of design.acts || []) {
      const addr = act.locusPath || "";
      if (addr) {
        addressSet.add(addr);

        // Build label if not already present
        if (!labeling[addr]) {
          labeling[addr] = {
            polarity: act.polarity === "P" ? "P" : "O",
            ramification: act.ramification.map((r) =>
              typeof r === "string" ? parseInt(r, 10) || 0 : r
            ),
            label: act.expression,
          };
        }
      }
    }
  }

  // Determine initial position (usually "0" or the first address)
  const addresses = Array.from(addressSet).sort();
  const initialPosition = addresses.includes("0")
    ? "0"
    : addresses[0] || undefined;

  return {
    addresses,
    legalPositionIds: [], // Will be populated by position computation
    labeling,
    initialPosition,
  };
}

/**
 * Compute all legal positions in the game
 */
async function computeLegalPositions(
  designs: DesignForCorrespondence[],
  arena: Arena,
  maxPositions: number,
  validate: boolean
): Promise<GamePosition[]> {
  const positions: GamePosition[] = [];
  const positionIdCounter = { value: 0 };

  // For each design, extract positions from its action sequences
  for (const design of designs) {
    const designPositions = extractPositionsFromDesign(
      design,
      arena,
      positionIdCounter,
      validate
    );

    for (const pos of designPositions) {
      // Check for duplicates based on sequence
      const isDuplicate = positions.some(
        (existing) =>
          sequencesEqual(existing.sequence, pos.sequence)
      );

      if (!isDuplicate) {
        positions.push(pos);

        if (positions.length >= maxPositions) {
          console.warn(
            `Reached max positions limit (${maxPositions}), stopping enumeration`
          );
          return positions;
        }
      }
    }
  }

  return positions;
}

/**
 * Extract positions from a single design
 */
function extractPositionsFromDesign(
  design: DesignForCorrespondence,
  arena: Arena,
  idCounter: { value: number },
  validate: boolean
): GamePosition[] {
  const positions: GamePosition[] = [];
  const acts = design.acts || [];

  // Build positions for each prefix of the action sequence
  for (let len = 0; len <= acts.length; len++) {
    const prefix = acts.slice(0, len);
    const sequence = prefix.map((act) => actToMove(act, idCounter));

    // Determine whose turn is next
    const lastAct = prefix[prefix.length - 1];
    const nextPlayer: "P" | "O" = lastAct
      ? lastAct.polarity === "P"
        ? "O"
        : "P"
      : "P"; // P starts

    // Check if terminal (daimon or no more moves)
    const isTerminal =
      lastAct?.kind === "DAIMON" ||
      (len === acts.length && acts.some((a) => a.kind === "DAIMON"));

    // Validate if requested
    const isLegal = validate ? validatePosition(sequence, arena) : true;

    positions.push({
      id: `pos-${design.id}-${idCounter.value++}`,
      gameId: "", // Will be set later
      sequence,
      isLegal,
      player: nextPlayer,
      isTerminal,
      winner: isTerminal
        ? lastAct?.polarity === "P"
          ? "P"
          : "O"
        : undefined,
    });
  }

  return positions;
}

/**
 * Convert a design act to a game move
 */
function actToMove(act: DesignAct, idCounter: { value: number }): Move {
  return {
    id: act.id || `move-${idCounter.value++}`,
    address: act.locusPath || "",
    polarity: act.polarity === "P" ? "P" : "O",
    justifier: undefined, // Could be computed from design structure
    ramification: act.ramification.map((r) =>
      typeof r === "string" ? parseInt(r, 10) || 0 : r
    ),
  };
}

/**
 * Validate a position against arena rules
 */
function validatePosition(sequence: Move[], arena: Arena): boolean {
  // Check all addresses are in arena
  for (const move of sequence) {
    if (!arena.addresses.includes(move.address)) {
      return false;
    }
  }

  // Check alternation
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i].polarity === sequence[i - 1].polarity) {
      return false;
    }
  }

  // Check linearity (no address repeated)
  const usedAddresses = new Set<string>();
  for (const move of sequence) {
    if (usedAddresses.has(move.address)) {
      return false;
    }
    usedAddresses.add(move.address);
  }

  return true;
}

/**
 * Check if two move sequences are equal
 */
function sequencesEqual(seq1: Move[], seq2: Move[]): boolean {
  if (seq1.length !== seq2.length) return false;

  for (let i = 0; i < seq1.length; i++) {
    if (
      seq1[i].address !== seq2[i].address ||
      seq1[i].polarity !== seq2[i].polarity
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Extract unique moves from all positions
 */
function extractMoves(positions: GamePosition[]): Move[] {
  const movesMap = new Map<string, Move>();

  for (const position of positions) {
    for (const move of position.sequence) {
      const key = `${move.address}-${move.polarity}`;
      if (!movesMap.has(key)) {
        movesMap.set(key, move);
      }
    }
  }

  return Array.from(movesMap.values());
}

/**
 * Compute strategies available in the game
 */
async function computeGameStrategies(
  designs: DesignForCorrespondence[]
): Promise<GameStrategy[]> {
  const strategies: GameStrategy[] = [];

  // Each design can correspond to a strategy
  for (const design of designs) {
    // Build response map from design acts
    const responseMap: Record<string, Move> = {};
    const acts = design.acts || [];

    for (let i = 0; i < acts.length; i++) {
      const act = acts[i];
      
      // Build position key from prior acts
      const priorActs = acts.slice(0, i);
      const positionKey = priorActs
        .map((a) => `${a.locusPath}:${a.polarity}`)
        .join("-");

      responseMap[positionKey] = {
        id: act.id || `move-${i}`,
        address: act.locusPath || "",
        polarity: act.polarity === "P" ? "P" : "O",
        ramification: act.ramification.map((r) =>
          typeof r === "string" ? parseInt(r, 10) || 0 : r
        ),
      };
    }

    strategies.push({
      strategyId: `strategy-${design.id}`,
      designId: design.id,
      isInnocent: true, // Assume innocent for now
      responseMap,
    });
  }

  return strategies;
}

/**
 * Check if a behaviour is a game
 * 
 * A behaviour is a game if it has proper game structure:
 * - Non-empty
 * - Has alternating moves
 * - Has deterministic positions
 */
export function isGame(behaviour: Behaviour): boolean {
  return behaviour.isGame;
}

/**
 * Check if game position is winning for a player
 */
export function isWinningPosition(
  position: GamePosition,
  player: "P" | "O"
): boolean {
  return position.isTerminal && position.winner === player;
}

/**
 * Get available moves from a position
 */
export function getAvailableMoves(
  position: GamePosition,
  game: Game
): Move[] {
  if (position.isTerminal) return [];

  // Find moves that extend this position
  const positionAddresses = new Set(position.sequence.map((m) => m.address));

  return game.moves.filter((move) => {
    // Move must be for current player
    if (move.polarity !== position.player) return false;

    // Move address must not already be used
    if (positionAddresses.has(move.address)) return false;

    // Move must be in arena
    if (!game.arena.addresses.includes(move.address)) return false;

    return true;
  });
}

/**
 * Apply a move to a position
 */
export function applyMove(
  position: GamePosition,
  move: Move,
  game: Game
): GamePosition | null {
  // Validate move
  if (move.polarity !== position.player) return null;
  if (position.isTerminal) return null;

  const newSequence = [...position.sequence, move];
  const nextPlayer: "P" | "O" = move.polarity === "P" ? "O" : "P";

  // Check if this creates a terminal position
  // (simplified: terminal if no more available moves)
  const newPosAddresses = new Set(newSequence.map((m) => m.address));
  const hasMoreMoves = game.moves.some(
    (m) =>
      m.polarity === nextPlayer && !newPosAddresses.has(m.address)
  );

  return {
    id: `${position.id}-${move.id}`,
    gameId: game.id,
    sequence: newSequence,
    isLegal: validatePosition(newSequence, game.arena),
    player: nextPlayer,
    isTerminal: !hasMoreMoves,
    winner: !hasMoreMoves ? move.polarity : undefined,
  };
}

/**
 * Find winning strategy in a game (if exists)
 */
export function findWinningStrategy(
  game: Game,
  player: "P" | "O"
): GameStrategy | null {
  // Check if any strategy is winning for the player
  for (const strategy of game.strategies) {
    if (isWinningStrategyFor(strategy, player, game)) {
      return strategy;
    }
  }

  return null;
}

/**
 * Check if a strategy is winning for a player
 */
function isWinningStrategyFor(
  strategy: GameStrategy,
  player: "P" | "O",
  game: Game
): boolean {
  // Simplified check: strategy is winning if all terminal positions
  // reachable by following the strategy are winning for player
  
  // Get initial position
  const initialPos = game.positions.find(
    (p) => p.sequence.length === 0
  );
  if (!initialPos) return false;

  // Simulate play following strategy
  return simulateStrategyWins(strategy, player, initialPos, game, new Set());
}

/**
 * Simulate strategy play to check if it wins
 */
function simulateStrategyWins(
  strategy: GameStrategy,
  player: "P" | "O",
  position: GamePosition,
  game: Game,
  visited: Set<string>
): boolean {
  // Avoid cycles
  const posKey = position.sequence.map((m) => m.id).join("-");
  if (visited.has(posKey)) return true; // Assume cycles are ok
  visited.add(posKey);

  // Terminal position
  if (position.isTerminal) {
    return position.winner === player;
  }

  if (position.player === player) {
    // Our turn - use strategy
    const positionKey = position.sequence
      .map((m) => `${m.address}:${m.polarity}`)
      .join("-");
    const move = strategy.responseMap[positionKey];

    if (!move) return false; // No response defined

    const nextPos = applyMove(position, move, game);
    if (!nextPos) return false;

    return simulateStrategyWins(strategy, player, nextPos, game, visited);
  } else {
    // Opponent's turn - must win against all opponent moves
    const opponentMoves = getAvailableMoves(position, game);

    if (opponentMoves.length === 0) {
      // No opponent moves - we win?
      return true;
    }

    // Must win against all opponent moves
    for (const oppMove of opponentMoves) {
      const nextPos = applyMove(position, oppMove, game);
      if (!nextPos) continue;

      if (!simulateStrategyWins(strategy, player, nextPos, game, visited)) {
        return false;
      }
    }

    return true;
  }
}
