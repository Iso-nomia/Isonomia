/**
 * lib/ludics/chronicles/reconstruct.ts
 *
 * H2 helper — `reconstructChronicle(designId)` rebuilds the chronicle of
 * a `LudicDesign` on demand from the persisted `LudicAct` rows, ordered
 * by `orderInDesign`. Per
 * `Development and Ideation Documents/ARCHITECTURE/LUDICS_HARMONIZATION_PASS_2_SPRINT_LIST.md`
 * §H2 this is the seam every current `LudicChronicle` reader migrates
 * to *before* H7 drops `LudicChronicle` + `LudicChronicleCache`.
 *
 * The output shape is intentionally compatible with what existing
 * readers consume from `prisma.ludicChronicle.findMany({ where: { designId } })`:
 * a list of `{ actId, order }` rows in design-order. Callers that hydrate
 * the act detail can do so via a separate `prisma.ludicAct.findMany`
 * lookup keyed by `actId`.
 *
 * Why this is *not* under `lib/ludics/substrate/**`. The substrate
 * read path forbids reading legacy `LudicDesign` / `LudicAct` /
 * `LudicChronicle*` (invariant `I-No-Legacy-Read`, enforced by
 * `scripts/lint-no-legacy-ludics-read.ts`). This file is the deliberate
 * escape hatch: it reads exactly one legacy table (`LudicAct`) and
 * exists *only* to give legacy chronicle-readers a single, drop-in
 * replacement for the row they currently fetch from
 * `LudicChronicle`. After H7 drops `LudicChronicle`, this helper still
 * works because `LudicAct` is *not* on the H7 retirement list.
 *
 * Forward-compat (FQ-substrate-v1 → BF substrate-v2). Per Pass 1 §9
 * the `reconstructChronicle` helper survives a v2 BF migration
 * unchanged at the API level. Under BF, an act may visit the same
 * locus multiple times; the `{ actId, order }` row shape preserves
 * that already because each visit is its own `LudicAct` row.
 *
 * @see lib/ludics/substrate/read.ts (the substrate counterpart)
 * @see __tests__/invariants/h2-reconstruct-chronicle-parity.test.ts
 */

import { prisma } from "@/lib/prismaclient";

export interface ReconstructedChronicleEntry {
  /** `LudicAct.id`. */
  actId: string;
  /** `LudicAct.orderInDesign` — the canonical chronicle ordering. */
  order: number;
}

/**
 * Reconstruct the chronicle of a legacy `LudicDesign` as a list of
 * `{ actId, order }` entries in canonical order. Drop-in replacement
 * for the row-set returned by
 * `prisma.ludicChronicle.findMany({ where: { designId }, orderBy: { order: "asc" } })`.
 *
 * Returns `[]` for designs with no acts (rather than throwing) so
 * callers can branch on length without a try/catch.
 */
export async function reconstructChronicle(
  designId: string,
): Promise<ReconstructedChronicleEntry[]> {
  const acts = await prisma.ludicAct.findMany({
    where: { designId },
    orderBy: { orderInDesign: "asc" },
    select: { id: true, orderInDesign: true },
  });
  return acts.map((a) => ({ actId: a.id, order: a.orderInDesign }));
}
