// lib/bridge/types.ts
//
// Foundational-bridge (direction 1) — Phase 2 prototype types.
// Translation ⟦·⟧ : abstract AF → Ludics designs, and the pure design model the
// faithful interaction runs over.
//
// See the spec:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/02b-translation-spec-af-to-designs-2026-06-02.md
//
// ⚠️ Research prototype. This is the EMPIRICAL (test-first) half of the bridge:
// it exists to check, over random AFs, whether the §2 conjecture holds for a
// concrete first-pass encoding — NOT to ship. Nothing here is canonical.

export type ArgId = string;

/** Attack edge: `[from, to]` means `from` attacks `to`. */
export type Attack = [ArgId, ArgId];

/** Abstract argumentation framework (Dung). */
export interface AF {
  args: ArgId[];
  attacks: Attack[];
}

// ---------------------------------------------------------------------------
// Pure design model (multiplicative, additive-free fragment)
// ---------------------------------------------------------------------------
//
// The abstract-AF translation only ever emits the multiplicative, additive-free
// fragment of Ludics, on which the canonical predicate (`stepInteraction`
// CONVERGENT) reduces to a locus-matched alternating daimon traversal. These
// types model exactly that fragment so the interaction can run purely (no DB).

export type ActPolarity = "P" | "O";

/** A single act in a design (a move at a locus). */
export interface BridgeAct {
  polarity: ActPolarity;
  /** Dot-path locus, e.g. "0.a.c". The path encodes the dispute line. */
  locusPath: string;
  /** PROPER move advances an argument; DAIMON (†) closes a line (convergence). */
  kind: "PROPER" | "DAIMON";
  /** The argument advanced by this act (undefined for †). */
  arg?: ArgId;
  /** Child loci opened by this act (the opponent's reply options). */
  ramification: string[];
  /**
   * Additive-opener marker (session 21, `⟦·⟧₊`). When set, this act's
   * `ramification` is an **additive superposition** — the children are
   * mutually-exclusive alternatives, not a multiplicative conjunction. The
   * grounded emitter (`buildDisputeDesign`) never sets it; only the additive
   * emitter (`buildAdditiveDisputeDesign`) does, at game branch points. Mirrors
   * `LudicAct.isAdditive` (the kernel's exclusive-choice flag — see
   * `packages/ludics-engine/stepCore.ts`). Optional + defaulting to falsy keeps
   * the multiplicative, additive-free grounded surface (T005) unchanged.
   */
  isAdditive?: boolean;
}

/**
 * A design as an inspectable dispute tree (for documentation / debugging).
 * The interaction itself uses the strategy-map form in `dispute.ts`; this is the
 * "actual design structure" artifact the Phase-1 spec calls for.
 */
export interface DisputeDesign {
  /** "Proponent" asserts; "Opponent" attacks. */
  role: "Proponent" | "Opponent";
  rootArg: ArgId;
  /** The acts of this design, keyed by locus path. */
  acts: BridgeAct[];
}

/** Result of interacting two resolved strategies (canonical-predicate shape). */
export type InteractionStatus = "CONVERGENT" | "DIVERGENT" | "ONGOING";
