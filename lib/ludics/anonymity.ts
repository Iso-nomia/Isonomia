// lib/ludics/anonymity.ts
//
// The T4 non-attribution primitive (Reading-C roadmap item 3).
//
// Reading C makes the Opponent a *behaviour*, not a person; a Ludics acceptability
// verdict is therefore a property of POSITIONS, not PEOPLE (T012). The T4
// separation says the **person** identity (`participantId` / `authorId`, a user id
// stored on `LudicDesign` / `WitnessRecord`) must never appear on a default
// dialectical-layer read — it is surfaced only through an explicit
// `includeIdentity: true` opt-in on the witnessing layer.
//
// This module extracts the established anonymous-by-default convention (see
// server/ludics/witnessRecord.ts: `WitnessRecordPublic` vs.
// `WitnessRecordWithIdentity` + `toPublic`) into one reusable primitive so the new
// Reading-C acceptability surfaces (roadmap items 1/2/4) inherit the discipline by
// construction rather than re-implementing the projection by hand.
//
// Spec: docs/READING_C_ITEM3_ANONYMISATION_DEV_SPEC.md
//
// LOAD-BEARING DISTINCTION. T4 strips the *person* id only. It does NOT strip the
// *role* polarity label `"Proponent" | "Opponent"` (e.g.
// `StepCoreResult.endedAtDaimonForParticipantId`) — that is part of the dialectical
// verdict, not an identity. `stripIdentity` removes only the exact keys
// `participantId` / `authorId`; sibling fields whose names merely *contain*
// "ParticipantId" (the role attribution) are preserved.

/** A person identity (a user id). Stored internally; never on a default read. */
export type PersonId = string;

/** The exact fields a default dialectical read must never carry. */
export type PersonIdentityField = "participantId" | "authorId";

/**
 * A shape guaranteed free of person-identity fields on a default read. The
 * compile-time T4 guard: `"participantId" extends keyof Anonymous<T>` is always
 * `false`, so a leak fails the build.
 */
export type Anonymous<T> = Omit<T, PersonIdentityField>;

/** Opt-in identity flag, mirroring the witnessing-layer reads (`get_witnesses`). */
export type IdentityOpt = { includeIdentity?: boolean };

/**
 * Drop the person-identity fields (`participantId`, `authorId`) from a row before
 * it enters a default dialectical read. Shallow by design — it is applied at the
 * read boundary, once, to each row. The `"Proponent" | "Opponent"` role label and
 * any `endedAtDaimonForParticipantId`-style sibling survive (different keys).
 */
export function stripIdentity<T extends object>(row: T): Anonymous<T> {
  const { participantId: _p, authorId: _a, ...rest } = row as T &
    Partial<Record<PersonIdentityField, unknown>>;
  void _p;
  void _a;
  return rest as Anonymous<T>;
}

/** Map `stripIdentity` over a list of rows. */
export function stripIdentityAll<T extends object>(rows: readonly T[]): Anonymous<T>[] {
  return rows.map(stripIdentity);
}
