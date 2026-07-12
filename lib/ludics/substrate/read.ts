/**
 * lib/ludics/substrate/read.ts
 *
 * H2 keystone — the *single* substrate read path. Per
 * `Development and Ideation Documents/ARCHITECTURE/LUDICS_HARMONIZATION_PASS_2_SPRINT_LIST.md`
 * §H2, every substrate-level question (behaviours, designs, incarnations,
 * witnesses, exposure) is answered through this façade. No other module
 * reads `LudicDesign` / `LudicAct` / `LudicChronicle` / `LudicChronicleCache`
 * to compute substrate facts.
 *
 * **T4 contract.** Every function on this surface returns
 * `participantId`-stripped data by default. The only knob that exposes
 * identity is `getWitnesses(_, { includeIdentity: true })`, which is
 * forwarded verbatim to the canonical witness reader and used by
 * `get_witnesses` / `get_fossil_record` only.
 *
 * **Invariant I-No-Legacy-Read** is enforced by
 * `scripts/lint-no-legacy-ludics-read.ts` and
 * `__tests__/invariants/h2-no-legacy-read.test.ts`: any file under
 * `lib/ludics/substrate/**` or `lib/ludics/chronicles/**` that imports
 * `prisma.ludicDesign|ludicAct|ludicChronicle|ludicChronicleCache` fails
 * the lint.
 *
 * **Forward-compat (FQ-substrate-v1 → BF substrate-v2).** Per Pass 1 §9
 * this façade survives a v2 BF migration unchanged at the API level; the
 * underlying readers may relax their `LudicMove` keys to include
 * `(moveType, repetitionTag)`, which the return types here do not assume.
 *
 * @see scripts/lint-no-legacy-ludics-read.ts
 * @see __tests__/invariants/h2-no-legacy-read.test.ts
 * @see lib/ludics/chronicles/reconstruct.ts (the chronicle counterpart)
 */

import { prisma } from "@/lib/prismaclient";
import {
  findMinimalIncarnations,
  type DesignSummary,
  type FindMinimalIncarnationsResult,
} from "@/server/ludics/articulationLattice";
import {
  computeExposureMap,
  type ExposureMapOptions,
  type ExposureMapResult,
} from "@/server/ludics/exposureMap";
import {
  findByLudicMoveId,
  type WitnessRecordPublic,
  type WitnessRecordWithIdentity,
} from "@/server/ludics/witnessRecord";

// ─── Behaviour ───────────────────────────────────────────────────────────────

export interface BehaviourRecord {
  id: string;
  deliberationId: string;
  rootLocus: string;
  createdAt: Date;
}

/**
 * Look up a single Behaviour container by id. T4-clean: Behaviour rows
 * carry no `participantId`, so this is just a typed `findUnique`.
 */
export async function getBehaviour(
  behaviourId: string,
): Promise<BehaviourRecord | null> {
  return prisma.behaviour.findUnique({
    where: { id: behaviourId },
    select: {
      id: true,
      deliberationId: true,
      rootLocus: true,
      createdAt: true,
    },
  });
}

// ─── Design ──────────────────────────────────────────────────────────────────

export interface DesignRecord {
  id: string;
  behaviourId: string;
  deliberationId: string;
  loci: string[];
  premiseClaimIds: string[];
  biorthoClass: string;
  derivedBy: string | null;
  createdAt: Date;
}

/**
 * Look up a single Design row by id. T4-clean: Designs carry no
 * `participantId`. Use `getIncarnations(behaviourId)` for the
 * antichain `Inc(B)` and the cone-decomposed lattice.
 */
export async function getDesign(
  designId: string,
): Promise<DesignRecord | null> {
  return prisma.design.findUnique({
    where: { id: designId },
    select: {
      id: true,
      behaviourId: true,
      deliberationId: true,
      loci: true,
      premiseClaimIds: true,
      biorthoClass: true,
      derivedBy: true,
      createdAt: true,
    },
  });
}

// ─── Inc(B) ──────────────────────────────────────────────────────────────────

/**
 * Return the antichain `Inc(B)` for a behaviour (one Design per cone,
 * post-OQ-JSL Phase 2e). Forwards verbatim to the canonical
 * `findMinimalIncarnations` which is already T4-clean.
 *
 * The full lattice (with edges + cone summaries) is available via
 * `getArticulationLattice` in `@/server/ludics/articulationLattice` —
 * not re-exported here because it is not part of the H2 narrow read
 * surface; callers that need it should depend on the lattice module
 * directly.
 */
export async function getIncarnations(
  behaviourId: string,
): Promise<DesignSummary[]> {
  const result: FindMinimalIncarnationsResult = await findMinimalIncarnations(
    behaviourId,
  );
  return result.incarnations;
}

// ─── Witnesses ───────────────────────────────────────────────────────────────

/**
 * Return the active (`fossilizedAt = null`) witness records for a
 * `LudicMove`. T4-default: no `participantId` unless
 * `includeIdentity: true` is passed (in which case the underlying
 * reader returns the identity-bearing shape).
 */
export async function getWitnesses(
  ludicMoveId: string,
  options?: { includeIdentity?: false },
): Promise<WitnessRecordPublic[]>;
export async function getWitnesses(
  ludicMoveId: string,
  options: { includeIdentity: true },
): Promise<WitnessRecordWithIdentity[]>;
export async function getWitnesses(
  ludicMoveId: string,
  options?: { includeIdentity?: boolean },
): Promise<WitnessRecordPublic[] | WitnessRecordWithIdentity[]> {
  if (options?.includeIdentity) {
    return findByLudicMoveId(ludicMoveId, { includeIdentity: true });
  }
  return findByLudicMoveId(ludicMoveId);
}

// ─── Exposure map ────────────────────────────────────────────────────────────

/**
 * Compute the stratified opposition space `E(D_P)` for a deliberation.
 * Forwards to the canonical `computeExposureMap`, which is T4-clean
 * by construction (it never reads or returns `participantId`).
 */
export async function getExposureMap(
  deliberationId: string,
  options?: ExposureMapOptions,
): Promise<ExposureMapResult> {
  return computeExposureMap(deliberationId, options);
}

// ─── Re-exports of public types ──────────────────────────────────────────────

export type {
  DesignSummary,
  ExposureMapOptions,
  ExposureMapResult,
  WitnessRecordPublic,
  WitnessRecordWithIdentity,
};
