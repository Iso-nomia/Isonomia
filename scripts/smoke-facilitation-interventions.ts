/**
 * Smoke test for C1.5: intervention service.
 *
 * Seeds two EquityMetricSnapshot rows directly (the snapshot worker lands
 * in C1.6), runs `recommendNext` twice to verify dedupe, then exercises
 * apply / dismiss with chain verification.
 *
 * Run: npx tsx scripts/smoke-facilitation-interventions.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { openSession, closeSession } from "../lib/facilitation/sessionService";
import {
  recommendNext,
  applyIntervention,
  dismissIntervention,
  listInterventions,
} from "../lib/facilitation/interventionService";
import { verifyFacilitationChain } from "../lib/facilitation/eventService";
import { EquityMetricKind, FacilitationDismissalTag } from "../lib/facilitation/types";

const prisma = new PrismaClient();
const createdSessionIds: string[] = [];
const createdSnapshotIds: string[] = [];
const createdInterventionIds: string[] = [];

async function cleanup() {
  await prisma.facilitationEvent.deleteMany({
    where: { sessionId: { in: createdSessionIds } },
  });
  await prisma.facilitationIntervention.deleteMany({
    where: { id: { in: createdInterventionIds } },
  });
  await prisma.facilitationIntervention.deleteMany({
    where: { sessionId: { in: createdSessionIds } },
  });
  await prisma.equityMetricSnapshot.deleteMany({
    where: { id: { in: createdSnapshotIds } },
  });
  await prisma.facilitationSession.deleteMany({
    where: { id: { in: createdSessionIds } },
  });
}

function ok(label: string, cond: boolean, detail?: string) {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${cond ? "" : ` — ${detail ?? ""}`}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const d = await prisma.deliberation.findFirst({ select: { id: true, createdById: true } });
  if (!d) {
    console.log("NO_DELIBERATION (skipping)");
    return;
  }
  const facilitator = d.createdById;

  const session = await openSession({ deliberationId: d.id, openedById: facilitator });
  createdSessionIds.push(session.id);

  // Seed two snapshots — high gini (fires unheardSpeaker, priority 5) and
  // high challenge concentration (fires challengeConcentration, priority 5).
  const now = new Date();
  const giniSnap = await prisma.equityMetricSnapshot.create({
    data: {
      deliberationId: d.id,
      sessionId: session.id,
      windowStart: new Date(now.getTime() - 600_000),
      windowEnd: now,
      metricKind: EquityMetricKind.PARTICIPATION_GINI,
      metricVersion: 1,
      value: new Prisma.Decimal("0.85"),
      breakdownJson: { silentEnrolled: 5, totalContributions: 47 },
    },
  });
  createdSnapshotIds.push(giniSnap.id);

  const challengeSnap = await prisma.equityMetricSnapshot.create({
    data: {
      deliberationId: d.id,
      sessionId: session.id,
      windowStart: new Date(now.getTime() - 600_000),
      windowEnd: now,
      metricKind: EquityMetricKind.CHALLENGE_CONCENTRATION,
      metricVersion: 1,
      value: new Prisma.Decimal("0.82"),
      breakdownJson: { topK: 1, windowAttackCount: 12 },
    },
  });
  createdSnapshotIds.push(challengeSnap.id);

  // Cycle 1: should produce two recommendations.
  const r1 = await recommendNext(session.id, {
    loadHighWeightClaims: async () => [
      {
        id: "c_evidence_1",
        text: "the policy reduces fare evasion",
        weight: 5,
        supportCount: 6,
        citationCount: 0,
        authorAuthId: "auth_x",
        lastActivityAt: null,
      },
    ],
  });
  for (const i of r1.recommended) createdInterventionIds.push(i.id);
  console.log(`  cycle1: recommended=${r1.recommended.length} noOp=${r1.noOpRules.join(",")} errors=${r1.ruleErrors.length}`);
  ok("cycle1.threeRecommendations", r1.recommended.length === 3);
  ok("cycle1.unheardP5", r1.recommended.some((i) => i.ruleName === "unheardSpeakerRule" && i.priority === 5));
  ok("cycle1.challengeP5", r1.recommended.some((i) => i.ruleName === "challengeConcentrationRule" && i.priority === 5));
  ok("cycle1.evidenceP4", r1.recommended.some((i) => i.ruleName === "evidenceGapRule" && i.priority === 4));

  // Cycle 2 (same context): all should be deduped → zero new rows.
  const r2 = await recommendNext(session.id, {
    loadHighWeightClaims: async () => [
      {
        id: "c_evidence_1",
        text: "the policy reduces fare evasion",
        weight: 5,
        supportCount: 6,
        citationCount: 0,
        authorAuthId: "auth_x",
        lastActivityAt: null,
      },
    ],
  });
  ok("cycle2.dedupedAllNew", r2.recommended.length === 0, `got=${r2.recommended.length}`);

  // Apply one, dismiss another, list to confirm filters.
  const toApply = r1.recommended.find((i) => i.ruleName === "unheardSpeakerRule")!;
  const toDismiss = r1.recommended.find((i) => i.ruleName === "challengeConcentrationRule")!;

  const applied = await applyIntervention({
    interventionId: toApply.id,
    appliedById: facilitator,
    noteText: "asked the room",
  });
  ok("apply.applied", applied.appliedAt != null && applied.appliedById === facilitator);

  const dismissed = await dismissIntervention({
    interventionId: toDismiss.id,
    dismissedById: facilitator,
    reasonText: "Already addressed during prior cycle.",
    reasonTag: FacilitationDismissalTag.already_addressed,
  });
  ok("dismiss.dismissed", dismissed.dismissedAt != null && dismissed.dismissedReasonText != null);

  // Defensive guard: empty reasonText rejected.
  let rejected = false;
  try {
    await dismissIntervention({
      interventionId: r1.recommended[2].id,
      dismissedById: facilitator,
      reasonText: "   ",
    });
  } catch {
    rejected = true;
  }
  ok("dismiss.rejectsBlankReason", rejected);

  // Re-apply same row should fail.
  let reapplyRejected = false;
  try {
    await applyIntervention({ interventionId: toApply.id, appliedById: facilitator });
  } catch {
    reapplyRejected = true;
  }
  ok("apply.idempotencyGuard", reapplyRejected);

  // Listing.
  const open = await listInterventions({ sessionId: session.id, status: "open" });
  const appliedList = await listInterventions({ sessionId: session.id, status: "applied" });
  const dismissedList = await listInterventions({ sessionId: session.id, status: "dismissed" });
  ok("list.openCount", open.interventions.length === 1);
  ok("list.appliedCount", appliedList.interventions.length === 1);
  ok("list.dismissedCount", dismissedList.interventions.length === 1);

  // Chain still verifies after all those events.
  const v = await verifyFacilitationChain(session.id);
  ok("chain.valid", v.valid, JSON.stringify(v));

  // Confirm dedupe override via short window: bump `now` past dedupe window.
  // unheardSpeaker has dedupe 600s; the *applied* row no longer counts as
  // open, so a fresh recommendation should land.
  const r3 = await recommendNext(session.id, {
    loadHighWeightClaims: async () => [],
  });
  for (const i of r3.recommended) createdInterventionIds.push(i.id);
  ok("cycle3.appliedRowDoesNotBlockNew", r3.recommended.some((i) => i.ruleName === "unheardSpeakerRule"));

  await closeSession({ sessionId: session.id, closedById: facilitator });
}

main()
  .catch((err) => {
    console.error("smoke-facilitation-interventions: failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log("cleaned up");
  });
