// packages/ludics-engine/stepCore.ts
//
// PURE traversal kernel of `stepInteraction` — zero I/O, no prisma, no Hooks,
// no persistence. This is the locus-matched alternating interaction loop that
// decides CONVERGENT / DIVERGENT / STUCK / ONGOING on the multiplicative
// (and additive) fragment.
//
// WHY THIS MODULE EXISTS
// ----------------------
// `stepInteraction` (./stepper.ts) is DB-coupled: it resolves designs, loci and
// prior traces through prisma, runs this loop, then persists a trace and
// computes hints / endorsement / decisive indices. That coupling made the loop
// untestable in isolation and unreachable from the foundational-bridge work
// (T005, `lib/bridge/`), whose pure `interact` re-implementation had no way to
// be confronted with the *real* engine semantics.
//
// `stepCore` is the loop, lifted out verbatim (same finders, same cursors, same
// daimon/additive/phase rules, same `StepResult` status/reason vocabulary).
// `stepInteraction` now delegates to it. The engine's existing integration tests
// witness `stepInteraction == stepCore` end-to-end; pure unit tests (and the
// bridge differential test, T005 Future-work item 2) can drive `stepCore`
// directly with hand-built act lists and no database.

import type { StepResult } from 'packages/ludics-core/types';

/** The act fields the traversal reads (a structural subset of a `LudicAct`). */
export type CoreAct = {
  id?: string | null;
  kind: 'PROPER' | 'DAIMON' | string;
  polarity: 'P' | 'O' | 'daimon' | string;
  locusId?: string | null;
  isAdditive?: boolean | null;
};

export type StepCoreInput = {
  posActs: CoreAct[];
  negActs: CoreAct[];
  /** locusId → path (e.g. "0.1.2"). */
  pathById: Map<string, string>;
  /** path → locusId (inverse of `pathById`). */
  idByPath: Map<string, string>;
  posParticipantId?: 'Proponent' | 'Opponent' | string;
  negParticipantId?: 'Proponent' | 'Opponent' | string;
  /** Step budget; the loop runs `for steps < fuel`. */
  fuel?: number;
  phase?: 'focus-P' | 'focus-O' | 'neutral';
  focusAt?: string | null;
  /** Loci paths at which a virtual O-act is synthesized (consensus testers). */
  virtualNegPaths?: string[];
  /** Loci paths where an unanswered positive is a consensus draw, not incoherent. */
  drawAtPaths?: string[];
  /** Prior additive choices (parentPath → chosen child suffix). */
  usedAdditive?: Record<string, string>;
};

export type StepCoreResult = {
  status: StepResult['status'];
  reason?: StepResult['reason'];
  pairs: { posActId?: string; negActId?: string; locusPath: string; ts: number }[];
  endedAtDaimonForParticipantId?: 'Proponent' | 'Opponent';
  usedAdditive: Record<string, string>;
  /**
   * First-divergence address (path, e.g. "0.1.2") — the locus of the offending
   * positive act at the moment the alternating loop broke `DIVERGENT`. This is
   * the warm-up object E0 of C012 / Q-040 (separation / locus of disagreement):
   * the deterministic run's *first unmatched positive*. Populated only on the
   * `DIVERGENT` branches (additive-violation, consensus-draw, incoherent-move);
   * `undefined` for CONVERGENT / STUCK / ONGOING and where no offending act
   * carries a resolvable locus. Extraction only — the decision logic is
   * byte-for-byte unchanged.
   */
  divergenceLocus?: string;
};

/**
 * Phase gate. In a focused phase only a PROPER P-act of the matching additivity
 * may fire; in `neutral`/undefined everything is allowed. (Unchanged from the
 * original in-line definition in `stepper.ts`.)
 */
export function allowInPhase(
  phase: 'focus-P' | 'focus-O' | 'neutral' | undefined,
  nextPosAct: any
): boolean {
  if (!phase || phase === 'neutral') return true;
  if (phase === 'focus-P') {
    return nextPosAct?.kind === 'PROPER' && nextPosAct?.polarity === 'P' && !!nextPosAct?.isAdditive;
  }
  if (phase === 'focus-O') {
    return nextPosAct?.kind === 'PROPER' && nextPosAct?.polarity === 'P' && !nextPosAct?.isAdditive;
  }
  return true;
}

/**
 * The pure interaction loop. Alternates sides A (pos) / B (neg), matching the
 * next positive act against a dual O-act at the same locus, until a daimon
 * (CONVERGENT), an unmatched positive (DIVERGENT), exhausted positives (STUCK),
 * a phase gate (ONGOING) or fuel exhaustion (ONGOING) ends the run.
 */
export function stepCore(input: StepCoreInput): StepCoreResult {
  const {
    posActs,
    negActs,
    pathById,
    idByPath,
    posParticipantId,
    negParticipantId,
    phase,
    focusAt,
    virtualNegPaths = [],
    drawAtPaths = [],
  } = input;

  const fuel = Math.max(1, Math.min(input.fuel ?? 10_000, 10_000));
  const virtualNegByPath = new Set(virtualNegPaths);
  const drawAt = new Set(drawAtPaths);
  const usedAdditive: Record<string, string> = { ...(input.usedAdditive ?? {}) };

  // -- views over designs
  const A = { participantId: posParticipantId, acts: posActs };
  const B = { participantId: negParticipantId, acts: negActs };

  // -- finders
  const findNextPositive = (acts: CoreAct[], from: number) => {
    for (let i = from; i < acts.length; i++) {
      const a = acts[i];
      if (focusAt) {
        // skip positives that are not under focusAt prefix
        const p = a.locusId ? pathById.get(a.locusId) : undefined;
        if (!p || !(p === focusAt || p.startsWith(focusAt + '.'))) continue;
      }
      if (a.kind === 'DAIMON') return { idx: i, act: a };
      if (a.kind === 'PROPER' && a.polarity === 'P') return { idx: i, act: a };
    }
    return null;
  };

  // Track which O-acts have been used in pairs to avoid reusing them
  const usedNegActIds = new Set<string>();

  const findNextNegativeAtLocus = (acts: CoreAct[], _from: number, locusId: string) => {
    // Search ALL acts for a matching O-act at this locus (not just from cursor)
    // This handles dialogues where acts were appended out of order (e.g., concessions)
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      if (a.kind === 'PROPER' && a.polarity === 'O' && a.locusId === locusId) {
        // Skip if already used in a previous pair
        if (a.id && usedNegActIds.has(a.id)) continue;
        return { idx: i, act: a };
      }
    }
    // virtual negative synthesized by tester
    const p = pathById.get(locusId);
    if (p && virtualNegByPath.has(p)) {
      return { idx: _from, act: { id: undefined, kind: 'PROPER', polarity: 'O', locusId } as CoreAct };
    }
    return null;
  };

  // -- additive parent detector
  const isAdditiveParent = (childPath?: string | null) => {
    if (!childPath || childPath.indexOf('.') < 0) return null;
    const parentPath = childPath.split('.').slice(0, -1).join('.');
    const parentId = idByPath.get(parentPath);
    if (!parentId) return null;
    const parentAdd =
      A.acts.some((a) => a.locusId === parentId && a.isAdditive) ||
      B.acts.some((a) => a.locusId === parentId && a.isAdditive);
    return parentAdd ? parentPath : null;
  };
  const childSuffixOf = (path: string) => path.split('.').slice(-1)[0];

  // -- traversal
  let cursorA = 0,
    cursorB = 0;
  let side: 'A' | 'B' = 'A';
  const pairs: { posActId?: string; negActId?: string; locusPath: string; ts: number }[] = [];
  let status: StepResult['status'] = 'ONGOING';
  let reason: StepResult['reason'] | undefined;
  let endedAtDaimonForParticipantId: 'Proponent' | 'Opponent' | undefined;
  // First-divergence address (E0): the path of the offending positive at the
  // DIVERGENT break. Recorded alongside the existing decision, never affecting it.
  let divergenceLocus: string | undefined;

  for (let steps = 0; steps < fuel; steps++) {
    const posSide = side === 'A' ? A : B;
    const negSide = side === 'A' ? B : A;
    const posCursor = side === 'A' ? cursorA : cursorB;
    const negCursor = side === 'A' ? cursorB : cursorA;

    const nextPos = findNextPositive(posSide.acts, posCursor);
    if (!nextPos) {
      status = 'STUCK';
      reason = 'no-response';
      break;
    }

    if (!allowInPhase(phase, nextPos.act)) {
      status = 'ONGOING';
      break;
    }

    if (nextPos.act.kind === 'DAIMON') {
      status = 'CONVERGENT';
      endedAtDaimonForParticipantId = posSide.participantId as any;
      break;
    }

    const locusPath = nextPos.act.locusId ? pathById.get(nextPos.act.locusId) : undefined;
    const parentPath = isAdditiveParent(locusPath);
    if (parentPath) {
      const chosen = childSuffixOf(locusPath!);
      const prev = usedAdditive[parentPath];
      if (prev && prev !== chosen) {
        status = 'DIVERGENT';
        reason = 'additive-violation';
        divergenceLocus = locusPath;
        break;
      }
      usedAdditive[parentPath] = chosen;
    }

    let dual = findNextNegativeAtLocus(negSide.acts, negCursor, nextPos.act.locusId!);
    if (!dual) {
      const p = nextPos.act.locusId ? pathById.get(nextPos.act.locusId) : undefined;
      if (p && virtualNegByPath.has(p)) {
        // synthesize a "virtual" O at this locus to continue the run
        dual = {
          idx: negCursor,
          act: { id: `virt:${p}:${Date.now()}`, kind: 'PROPER', polarity: 'O', locusId: nextPos.act.locusId } as CoreAct,
        };
      }
    }
    if (!dual) {
      const p = nextPos.act.locusId ? pathById.get(nextPos.act.locusId) : undefined;
      if (p && drawAt.has(p)) {
        status = 'DIVERGENT';
        reason = 'consensus-draw';
      } else {
        status = 'DIVERGENT';
        reason = reason ?? 'incoherent-move';
      }
      divergenceLocus = p;
      break;
    }

    // Mark this O-act as used so it won't be matched again
    if (dual.act.id) {
      usedNegActIds.add(dual.act.id);
    }

    pairs.push({
      posActId: nextPos.act.id ?? undefined,
      negActId: dual.act.id ?? undefined,
      locusPath: locusPath ?? '0',
      ts: Date.now(),
    });

    if (side === 'A') {
      cursorA = nextPos.idx + 1;
      cursorB = dual.idx + 1;
      side = 'B';
    } else {
      cursorB = nextPos.idx + 1;
      cursorA = dual.idx + 1;
      side = 'A';
    }
  }

  return { status, reason, pairs, endedAtDaimonForParticipantId, usedAdditive, divergenceLocus };
}

/**
 * Thin pure projection of {@link stepCore}: the first-divergence address (E0).
 * Returns the path of the first unmatched positive when `⟨pos ∣ neg⟩` diverges,
 * else `undefined`. Keeps the locus-extraction usable without reading the rest
 * of the {@link StepCoreResult}; carries the same zero-I/O guarantee.
 */
export function divergenceLocusOf(input: StepCoreInput): string | undefined {
  return stepCore(input).divergenceLocus;
}
