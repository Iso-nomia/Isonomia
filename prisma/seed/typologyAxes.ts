/**
 * Typology axis registry seed.
 *
 * Status: B0 deliverable (April 23, 2026).
 * Source roadmap: docs/DelibDemocracyScopeB_Roadmap.md §3.1, §9 decision #1.
 *
 * Idempotent. Run after the Scope B migration lands. Safe to re-run; it upserts
 * by `key` and bumps `version` only when `description` or `interventionHint`
 * actually change. Existing `DisagreementTag` rows pin their `axisVersion` at
 * proposal time, so a registry version bump never silently mutates historical
 * tags.
 *
 * Usage:
 *   npx tsx prisma/seed/typologyAxes.ts
 *
 * Wired by callers (one of):
 *   - `prisma/seed/index.ts` after the migration that creates `DisagreementAxis`.
 *   - A one-shot script in `scripts/` invoked by the deploy pipeline.
 *
 * Conventions: matches `prisma/brief-seed.ts` and `prisma/sheaf-seed.ts`.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * v1 axis catalogue. Locked at B0 (decision #1).
 *
 * `colorToken` matches Tailwind palette tokens consumed by the UI badges.
 * `interventionHint` is short prose surfaced to facilitators when this axis is
 * selected in the tagger; the longer `description` shows in tooltips and the
 * axis legend on the demo page.
 *
 * `version` MUST be bumped manually when `description` or `interventionHint`
 * change. The seed compares the existing row and bumps automatically.
 */
const AXES = [
  {
    key: "VALUE" as const,
    displayName: "Value",
    description:
      "Parties weigh competing values differently (e.g. equity vs efficiency, liberty vs security). Value disagreements may be irreducible and are best surfaced and acknowledged rather than resolved by more evidence.",
    colorToken: "amber-500",
    interventionHint:
      "Surface the values at stake; consider a values-clarification round before pressing for resolution.",
  },
  {
    key: "EMPIRICAL" as const,
    displayName: "Empirical",
    description:
      "Parties disagree about facts or causal claims (e.g. whether a policy will produce the predicted effect). Empirical disagreements are typically tractable with shared evidence; flag any contested study, dataset, or measurement.",
    colorToken: "sky-500",
    interventionHint:
      "Ask for evidence; suggest a fact-finding interlude or a synthesis brief from a neutral source.",
  },
  {
    key: "FRAMING" as const,
    displayName: "Framing",
    description:
      "Parties are talking about different aspects of the same problem, or using different frames that make the same evidence appear to support different conclusions. Reframing exercises often reveal hidden agreement.",
    colorToken: "violet-500",
    interventionHint:
      "Reframe the question; surface the implicit framing each party brings and try a steelman exchange.",
  },
  {
    key: "INTEREST" as const,
    displayName: "Interest",
    description:
      "Parties hold conflicting material stakes (financial, professional, communal) that bias their position regardless of values or evidence. Interest disagreements call for explicit disclosure rather than disguise as value or empirical disputes.",
    colorToken: "rose-500",
    interventionHint:
      "Disclose stakes; consider a structured interest declaration round so the conversation proceeds with stakes on the table.",
  },
];

async function seedTypologyAxes(): Promise<{ created: number; updated: number; unchanged: number }> {
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const axis of AXES) {
    const existing = await prisma.disagreementAxis.findUnique({ where: { key: axis.key } });

    if (!existing) {
      await prisma.disagreementAxis.create({
        data: {
          key: axis.key,
          displayName: axis.displayName,
          description: axis.description,
          colorToken: axis.colorToken,
          interventionHint: axis.interventionHint,
          version: 1,
          isActive: true,
        },
      });
      created += 1;
      continue;
    }

    const descriptionChanged = existing.description !== axis.description;
    const hintChanged = existing.interventionHint !== axis.interventionHint;
    const cosmeticChanged =
      existing.displayName !== axis.displayName || existing.colorToken !== axis.colorToken;

    if (descriptionChanged || hintChanged) {
      // Bump version: existing tags retain their axisVersion pin.
      await prisma.disagreementAxis.update({
        where: { key: axis.key },
        data: {
          displayName: axis.displayName,
          description: axis.description,
          colorToken: axis.colorToken,
          interventionHint: axis.interventionHint,
          version: existing.version + 1,
        },
      });
      updated += 1;
    } else if (cosmeticChanged) {
      // Cosmetic-only update: do not bump version.
      await prisma.disagreementAxis.update({
        where: { key: axis.key },
        data: {
          displayName: axis.displayName,
          colorToken: axis.colorToken,
        },
      });
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  return { created, updated, unchanged };
}

async function main() {
  const result = await seedTypologyAxes();
  console.log(
    `[typology] axis registry seeded: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`,
  );
}

main()
  .catch((err) => {
    console.error("[typology] axis registry seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { AXES, seedTypologyAxes };
