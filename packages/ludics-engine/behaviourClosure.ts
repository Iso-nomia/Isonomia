// packages/ludics-engine/behaviourClosure.ts
//
// CANONICAL bi-orthogonal closure for Ludics behaviours.
//
// Phase 0 / D0.3 of the foundational-bridge plan
// (`RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/02-foundational-bridge-dung-ludics-2026-06-02.md`).
//
// WHY THIS MODULE EXISTS
// ----------------------
// `packages/ludics-core/dds/landscape/behaviour-computer.ts` already exports
// `computeOrthogonal` / `computeBiorthogonalClosure`, but those are built on the
// in-memory `converges` heuristic (predicate "A"). The Phase-0 audit (§0b of the
// session doc) showed A is NOT equivalent to the production orthogonality
// relation: it follows only `ramification[0]` (one linear path), has a dead loop
// guard, can short-circuit on the `hasDaimon` flag, and knows nothing of
// additives / directory collisions / consensus draws. A agrees with the
// canonical predicate only on the linear, daimon-terminated, additive-free
// fragment.
//
// The canonical orthogonality relation (D0.1) is the one decided by
// `stepInteraction` over the *persisted* substrate:
//
//     D ⊥ E   ⟺   stepInteraction(D, E).status === 'CONVERGENT'.
//
// This module re-founds the closure on that predicate. It operates over
// persisted design ids within a single dialogue and never touches the in-memory
// heuristic.
//
// TOTALITY (D0.2)
// ---------------
// The step result is genuinely three-valued. We do NOT silently fold `ONGOING`
// (fuel exhaustion / phase gate) into "not orthogonal". `CONVERGENT` ⇒
// orthogonal; `DIVERGENT | STUCK` ⇒ non-orthogonal; `ONGOING` ⇒ *undecided*,
// which makes every closure operation raise an `UndecidedOrthogonalityError`
// rather than return a wrong set. Callers must widen `maxPairs`, restrict the
// fragment, or handle the partiality — never guess.
//
// NOTE on persistence: `stepInteraction` persists `STUCK` to the DB trace row as
// `ONGOING` (the trace enum has no STUCK), but the *returned* in-memory `status`
// still distinguishes them. We read the return value, never the persisted enum.

import { stepInteraction } from './stepper';
import type { StepResult } from 'packages/ludics-core/types';

// ============================================================================
// ORTHOGONALITY ORACLE
// ============================================================================

/** Three-valued orthogonality verdict (D0.2 — `undecided` is first-class). */
export type Orthogonality = 'orthogonal' | 'non-orthogonal' | 'undecided';

/**
 * An orthogonality oracle decides `a ⊥ b` for two persisted design ids. It must
 * resolve polarity/orientation internally (i.e. order the pair into the
 * positive / negative slots `stepInteraction` expects).
 */
export type OrthogonalityOracle = (a: string, b: string) => Promise<Orthogonality>;

/** Raised when the canonical predicate returns `ONGOING` (fuel/phase gate). */
export class UndecidedOrthogonalityError extends Error {
  constructor(public readonly a: string, public readonly b: string) {
    super(
      `Orthogonality of designs ${a} and ${b} is UNDECIDED ` +
        `(stepInteraction returned ONGOING). Per D0.2 this is not folded into ` +
        `a verdict; widen maxPairs or restrict the fragment.`
    );
    this.name = 'UndecidedOrthogonalityError';
  }
}

/** Map a `stepInteraction` status to a three-valued orthogonality verdict. */
export function classifyStatus(status: StepResult['status']): Orthogonality {
  switch (status) {
    case 'CONVERGENT':
      return 'orthogonal';
    case 'DIVERGENT':
    case 'STUCK':
      return 'non-orthogonal';
    case 'ONGOING':
    default:
      return 'undecided';
  }
}

/**
 * Build the canonical orthogonality oracle for a dialogue (D0.1).
 *
 * Orthogonality is directional in `stepInteraction` (positive vs negative
 * design), so the caller supplies `polarityOf` to orient each pair. Two designs
 * of the *same* polarity cannot interact on dual bases and are reported
 * `non-orthogonal` (they can never converge). Results are memoised per
 * unordered pair for the lifetime of the oracle.
 */
export function makeCanonicalOracle(opts: {
  dialogueId: string;
  /** Resolve a design id to its interaction polarity. */
  polarityOf: (designId: string) => 'pos' | 'neg';
  maxPairs?: number;
  phase?: 'focus-P' | 'focus-O' | 'neutral';
}): OrthogonalityOracle {
  const { dialogueId, polarityOf, maxPairs = 10_000, phase = 'neutral' } = opts;
  const cache = new Map<string, Orthogonality>();

  return async (a, b) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const pa = polarityOf(a);
    const pb = polarityOf(b);

    let verdict: Orthogonality;
    if (pa === pb) {
      // Same polarity → no dual interaction is possible.
      verdict = 'non-orthogonal';
    } else {
      const posDesignId = pa === 'pos' ? a : b;
      const negDesignId = pa === 'pos' ? b : a;
      const res = await stepInteraction({
        dialogueId,
        posDesignId,
        negDesignId,
        maxPairs,
        phase,
      });
      verdict = classifyStatus(res.status);
    }

    cache.set(key, verdict);
    return verdict;
  };
}

// ============================================================================
// SET ALGEBRA (closure operations over a fixed candidate universe)
// ============================================================================
//
// Ludics behaviours live in an infinite design space, so a literal G⊥ is not
// enumerable. As in `behaviour-computer.ts`, we work relative to a finite
// candidate `universe` (the pool of designs we actually have — e.g. the designs
// compiled for a dialogue). All closures below are intersected with `universe`.

/**
 * Orthogonal set within a universe: `{ c ∈ universe | ∀ g ∈ G. c ⊥ g }`.
 *
 * Raises `UndecidedOrthogonalityError` if any required test is undecided (D0.2).
 * Short-circuits per candidate on the first non-orthogonal member of G.
 */
export async function orthogonalSet(
  G: readonly string[],
  universe: readonly string[],
  ortho: OrthogonalityOracle
): Promise<string[]> {
  const result: string[] = [];
  for (const c of universe) {
    let orthogonalToAll = true;
    for (const g of G) {
      const v = await ortho(c, g);
      if (v === 'undecided') throw new UndecidedOrthogonalityError(c, g);
      if (v === 'non-orthogonal') {
        orthogonalToAll = false;
        break;
      }
    }
    if (orthogonalToAll) result.push(c);
  }
  return result;
}

/**
 * Bi-orthogonal closure within a universe: `G⊥⊥ ∩ universe`.
 *
 * Computes `G⊥` (relative to `universe`) then `(G⊥)⊥` (relative to `universe`).
 * The closure is monotone and `G ⊆ G⊥⊥`, so the result always contains every
 * member of `G` that lies in `universe`.
 */
export async function biorthogonalClosure(
  G: readonly string[],
  universe: readonly string[],
  ortho: OrthogonalityOracle
): Promise<string[]> {
  const orth = await orthogonalSet(G, universe, ortho);
  const biorth = await orthogonalSet(orth, universe, ortho);

  // Union with G ∩ universe (closure is extensive), preserving universe order.
  const inClosure = new Set(biorth);
  const inUniverse = new Set(universe);
  for (const g of G) if (inUniverse.has(g)) inClosure.add(g);
  return universe.filter((d) => inClosure.has(d));
}

/**
 * Is `G` a behaviour relative to `universe`? — i.e. `G = G⊥⊥ ∩ universe`.
 *
 * This is the operational form of the §1 bridge conjecture's right-hand side:
 * "the acceptable arguments form a set closed under B = B⊥⊥".
 */
export async function isBehaviour(
  G: readonly string[],
  universe: readonly string[],
  ortho: OrthogonalityOracle
): Promise<boolean> {
  const closure = await biorthogonalClosure(G, universe, ortho);
  const a = new Set(G);
  const b = new Set(closure);
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// ============================================================================
// CONVENIENCE: closure over a dialogue's persisted designs
// ============================================================================

/**
 * Canonical bi-orthogonal closure over persisted design ids in a dialogue.
 *
 * Thin wrapper that wires `makeCanonicalOracle` to `biorthogonalClosure`. This
 * is the canonical replacement for
 * `computeBiorthogonalClosure` in `behaviour-computer.ts` (D0.3).
 */
export async function biorthogonalClosureForDialogue(opts: {
  dialogueId: string;
  G: readonly string[];
  universe: readonly string[];
  polarityOf: (designId: string) => 'pos' | 'neg';
  maxPairs?: number;
  phase?: 'focus-P' | 'focus-O' | 'neutral';
}): Promise<string[]> {
  const { dialogueId, G, universe, polarityOf, maxPairs, phase } = opts;
  const ortho = makeCanonicalOracle({ dialogueId, polarityOf, maxPairs, phase });
  return biorthogonalClosure(G, universe, ortho);
}
