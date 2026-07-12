/**
 * Declarative spec for a deliberation graph that the snapshot capture
 * pipeline will materialize via Prisma, run through
 * `computeSyntheticReadout`, and serialize to a corpus-v2 fixture.
 *
 * Local string ids (e.g. `"a1"`, `"c-main"`) are *spec-local* — the
 * seed builder maps them to real DB ids on insertion. Use the same
 * local id consistently within a spec.
 */

import type { AdversarialGate } from "../types";

export interface SpecClaim {
  /** Spec-local id, e.g. "c-main". */
  id: string;
  /** Claim text. */
  text: string;
}

export interface SpecScheme {
  /**
   * Scheme key. Schemes are upserted by key (idempotent across runs),
   * so reuse standard keys ("expert-opinion", "cause-to-effect", etc.)
   * where possible.
   */
  key: string;
  name: string;
  summary: string;
  /** Critical questions exposed by this scheme. */
  cqs: Array<{ cqKey: string; text: string }>;
}

export interface SpecArgument {
  /** Spec-local id, e.g. "a1". */
  id: string;
  /** Argument text. */
  text: string;
  /** Spec-local claim id this argument concludes (optional). */
  conclusionClaimId?: string;
  /** Spec-local claim ids used as premises. Empty array if none. */
  premiseClaimIds: string[];
  /**
   * Optional scheme attached to this argument (creates an
   * `ArgumentSchemeInstance` with `isPrimary=true`). Required for any
   * argument whose CQs you want to surface in the readout.
   */
  scheme?: SpecScheme;
}

export interface SpecEdge {
  /** Spec-local source argument id. */
  from: string;
  /** Spec-local target argument id. */
  to: string;
  type: "support" | "rebut" | "undercut";
  /**
   * Spec-local premise claim id (for `rebut` against a specific premise,
   * i.e. an undermine). Optional.
   */
  targetPremiseClaimId?: string;
  /** Optional CQ key being raised by this edge. */
  cqKey?: string;
}

export interface SpecCqStatus {
  /** Spec-local target argument id. */
  targetArgumentId: string;
  /** Scheme key (matches a SpecScheme.key referenced elsewhere). */
  schemeKey: string;
  /** CQ key within that scheme. */
  cqKey: string;
  /** "OPEN" leaves the CQ as unanswered in the frontier. */
  status: "OPEN" | "SATISFIED" | "DISPUTED";
}

export interface DeliberationSpec {
  /**
   * Discriminator. Defaults to "seed" when omitted (back-compat).
   * Seed specs materialize a brand-new deliberation via Prisma.
   */
  kind?: "seed";
  /**
   * Stable slug; becomes the fixture id and the filename
   * (`corpus/v2/fixtures/<slug>.json`).
   */
  slug: string;
  description: string;
  /**
   * Adversarial gates to record on the captured fixture. The capture
   * script copies these into the output JSON; the scorecard uses them
   * unchanged.
   */
  adversarialGates: AdversarialGate[];
  claims: SpecClaim[];
  arguments: SpecArgument[];
  edges: SpecEdge[];
  cqStatuses: SpecCqStatus[];
}

/**
 * Spec that snapshots an *already existing* deliberation in the
 * database. Use this when seeding a topology would be too expensive
 * (e.g. real large-tier graphs with hundreds of arguments). The
 * capture pipeline reads the graph read-only and runs a NO-OP cleanup.
 *
 * Fixture stability comes from `stabilizeReadout`, which substitutes
 * every db cuid with a deterministic, lexically-ordered placeholder.
 */
export interface FromExistingSpec {
  kind: "from-existing";
  slug: string;
  description: string;
  adversarialGates: AdversarialGate[];
  /** Real Prisma `Deliberation.id` to snapshot. */
  deliberationId: string;
}

/**
 * Union of all spec kinds the capture pipeline understands.
 */
export type CaptureSpec = DeliberationSpec | FromExistingSpec;

/**
 * Returned by `seedDeliberation`. The id maps let the caller relate
 * spec-local ids back to real DB ids (useful for assertions, but
 * snapshots don't need them).
 */
export interface SeededDeliberation {
  deliberationId: string;
  /** Spec-local argument id → real DB id. */
  argumentIds: Record<string, string>;
  /** Spec-local claim id → real DB id. */
  claimIds: Record<string, string>;
  /** Scheme key → real DB id (idempotent, so usually the existing row). */
  schemeIds: Record<string, string>;
  /** Cleanup function: deletes everything created by this seed. */
  cleanup: () => Promise<void>;
}
