/**
 * Seed a target deliberation with realistic typology / meta-consensus demo
 * data so the Scope B demo page (`/test/typology-features`) lights up every
 * tab.
 *
 * What gets created (idempotent — rerunning is safe but does not "reset"):
 *   1. Up to 4 confirmed disagreement tags spread across the four axes,
 *      each attached to the first available Claim or Argument in the
 *      deliberation.
 *   2. A handful of pending typology candidates against the most recent
 *      open facilitation session (one per axis).
 *   3. A published meta-consensus summary that references the seeded tags.
 *
 * Pre-requisites:
 *   - The deliberation already has at least one Claim or Argument.
 *   - The deliberation already has at least one OPEN facilitation session
 *     (use scripts/seed-facilitation-demo.ts first if needed).
 *
 * Usage:
 *   npx tsx scripts/seed-typology-demo.ts <deliberationId>
 */

import { PrismaClient } from "@prisma/client";
import { proposeTag, confirmTag } from "../lib/typology/tagService";
import { enqueueCandidate } from "../lib/typology/candidateService";
import { draftSummary, publishSummary } from "../lib/typology/summaryService";
import {
  DisagreementAxisKey,
  DisagreementTagAuthorRole,
  DisagreementTagSeedSource,
  DisagreementTagTargetType,
} from "../lib/typology/types";

const prisma = new PrismaClient();

const deliberationId = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!deliberationId) {
  console.error("Usage: npx tsx scripts/seed-typology-demo.ts <deliberationId>");
  process.exit(1);
}

const log = (msg: string, detail?: unknown) =>
  console.log(`· ${msg}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);

async function main() {
  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, createdById: true },
  });
  if (!delib) throw new Error(`Deliberation ${deliberationId} not found`);
  const actor = delib.createdById;

  // Pick targets: prefer claims, fall back to arguments.
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true },
    take: 4,
  });
  const args = await prisma.argument.findMany({
    where: { deliberationId },
    select: { id: true },
    take: 4,
  });
  const targets: Array<{ targetType: DisagreementTagTargetType; targetId: string }> = [
    ...claims.map((c) => ({
      targetType: DisagreementTagTargetType.CLAIM,
      targetId: c.id,
    })),
    ...args.map((a) => ({
      targetType: DisagreementTagTargetType.ARGUMENT,
      targetId: a.id,
    })),
  ];
  if (!targets.length) {
    throw new Error("No claims or arguments in deliberation; cannot tag.");
  }

  // Open session for candidate seeding (auto-create one if none exists so the
  // demo page can showcase candidates without a separate seeder run).
  let openSession = await prisma.facilitationSession.findFirst({
    where: { deliberationId, status: "OPEN" },
    select: { id: true },
    orderBy: { openedAt: "desc" },
  });
  if (!openSession) {
    const created = await prisma.facilitationSession.create({
      data: {
        deliberationId,
        openedById: actor,
        status: "OPEN",
        isPublic: false,
        summary: "Auto-opened by scripts/seed-typology-demo.ts",
      },
      select: { id: true },
    });
    openSession = created;
    log("opened facilitation session", { id: created.id });
  }

  // ─── 1) Confirmed tags, one per axis ─────────────────────────────────
  const axes: DisagreementAxisKey[] = [
    DisagreementAxisKey.VALUE,
    DisagreementAxisKey.EMPIRICAL,
    DisagreementAxisKey.FRAMING,
    DisagreementAxisKey.INTEREST,
  ];
  const evidenceByAxis: Record<DisagreementAxisKey, string> = {
    [DisagreementAxisKey.VALUE]:
      "Authors prioritize different end values (fairness vs efficiency).",
    [DisagreementAxisKey.EMPIRICAL]:
      "Both sides cite incompatible studies on baseline rates.",
    [DisagreementAxisKey.FRAMING]:
      "Disagreement appears to be about scope, not the underlying claim.",
    [DisagreementAxisKey.INTEREST]:
      "Stakeholder groups have asymmetric exposure to the outcome.",
  };

  const tagIds: string[] = [];
  for (let i = 0; i < axes.length && i < targets.length; i++) {
    const t = targets[i];
    const axis = axes[i];
    const { tag } = await proposeTag({
      deliberationId,
      targetType: t.targetType,
      targetId: t.targetId,
      axisKey: axis,
      confidence: 0.65 + i * 0.05,
      evidenceText: evidenceByAxis[axis],
      authoredById: actor,
      authoredRole: DisagreementTagAuthorRole.FACILITATOR,
      seedSource: DisagreementTagSeedSource.MANUAL,
    });
    if (!tag.confirmedAt) {
      await confirmTag(tag.id, actor);
    }
    tagIds.push(tag.id);
    log(`tag ${axis}`, { id: tag.id, target: t.targetId });
  }

  // ─── 2) Pending candidates, one per axis ─────────────────────────────
  for (let i = 0; i < axes.length; i++) {
    const axis = axes[i];
    try {
      const { candidate } = await enqueueCandidate({
        deliberationId,
        sessionId: openSession.id,
        targetType: targets[i % targets.length].targetType,
        targetId: targets[i % targets.length].targetId,
        suggestedAxisKey: axis,
        seedSource: DisagreementTagSeedSource.METRIC_SEED,
        seedReferenceJson: { demo: true, axis, slot: i },
        rationaleText: `Seeded ${axis} candidate (#${i + 1}) for demo.`,
        priority: 5 - i,
        ruleName: "demo-seed",
        ruleVersion: 1,
      });
      log(`candidate ${axis}`, { id: candidate.id });
    } catch (e) {
      log(`candidate ${axis} skipped`, (e as Error).message);
    }
  }

  // ─── 3) Published meta-consensus summary ─────────────────────────────
  const summary = await draftSummary({
    deliberationId,
    sessionId: null,
    bodyJson: {
      agreedOn: ["The problem space matters and warrants careful framing."],
      disagreedOn: tagIds.slice(0, 3).map((id, i) => ({
        axisKey: axes[i],
        summary: `Open ${axes[i].toLowerCase()} disagreement (demo).`,
        supportingTagIds: [id],
      })),
      blockers: ["Insufficient shared evidence base."],
      nextSteps: ["Schedule a clarifying session focused on framing."],
    },
    narrativeText:
      "Demo meta-consensus summary generated by scripts/seed-typology-demo.ts.",
    authoredById: actor,
  });
  log("draft summary", { id: summary.id });
  const published = await publishSummary(summary.id, actor);
  log("published summary", { id: published.id, version: published.version });

  console.log("\n✓ Typology demo seeded.");
  console.log(`Open: /test/typology-features?deliberationId=${deliberationId}`);
  if (openSession) {
    console.log(`     &sessionId=${openSession.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
