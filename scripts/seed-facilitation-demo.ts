/**
 * Seed a target deliberation with realistic facilitation demo data so the
 * Scope C demo page (`/test/facilitation-features`) lights up every tab.
 *
 * What gets created (idempotent — re-runs replace prior demo content):
 *   1. A *closed* historical session ~24h ago to populate the Report tab,
 *      analytics rollup, and canonical export inspector.
 *   2. An *open* current session with:
 *        - A draft (unlocked) question carrying CLARITY/BIAS check rows
 *          so the Question authoring tab shows real check chips.
 *        - 30 minutes of EquityMetricSnapshot rows per kind so the
 *          equity sparklines have movement.
 *        - 5 interventions across kinds in mixed states (pending /
 *          applied / dismissed) so the InterventionQueue tab is busy.
 *        - INTERVENTION_RECOMMENDED events for each, plus follow-up
 *          INTERVENTION_APPLIED / INTERVENTION_DISMISSED events.
 *
 * Auth model:
 *   - The deliberation's `createdById` (host) is used as actor for every
 *     event and write. Host implies facilitator via lib/pathways/auth, so
 *     no DeliberationRole insertion is required.
 *
 * Usage:
 *   npx tsx scripts/seed-facilitation-demo.ts <deliberationId>
 *   npx tsx scripts/seed-facilitation-demo.ts dds-test-deliberation-001
 *
 * Flags:
 *   --reset  Wipe prior facilitation rows for this deliberation before
 *            seeding. Required if you've already seeded once and want a
 *            clean slate (the script will exit with a clear error otherwise).
 */

import { PrismaClient, Prisma } from "@prisma/client";
import {
  openSession,
  closeSession,
} from "../lib/facilitation/sessionService";
import { authorQuestion } from "../lib/facilitation/questionService";
import { appendEvent } from "../lib/facilitation/eventService";
import {
  EquityMetricKind,
  FacilitationCheckKind,
  FacilitationCheckSeverity,
  FacilitationDismissalTag,
  FacilitationEventType,
  FacilitationFramingType,
  FacilitationInterventionKind,
  FacilitationInterventionTargetType,
  FacilitationSessionStatus,
} from "../lib/facilitation/types";

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const RESET = argv.includes("--reset");
const deliberationId = argv.find((a) => !a.startsWith("--"));

if (!deliberationId) {
  console.error(
    "Usage: npx tsx scripts/seed-facilitation-demo.ts <deliberationId> [--reset]",
  );
  process.exit(1);
}

function log(label: string, detail?: unknown) {
  console.log(`· ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
}

async function resetDeliberation(deliberationId: string) {
  const sessions = await prisma.facilitationSession.findMany({
    where: { deliberationId },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length) {
    await prisma.facilitationEvent.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await prisma.facilitationIntervention.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await prisma.equityMetricSnapshot.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await prisma.facilitationHandoff.deleteMany({
      where: { fromSessionId: { in: sessionIds } },
    });
    await prisma.facilitationSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
  }
  await prisma.facilitationQuestionCheck.deleteMany({
    where: { question: { deliberationId } },
  });
  await prisma.facilitationQuestion.deleteMany({ where: { deliberationId } });
  log("reset complete", { sessions: sessionIds.length });
}

// Decimal helper — `Decimal(12,6)` column expects a string or Prisma.Decimal.
const dec = (v: number) => new Prisma.Decimal(v.toFixed(6));

// Synthetic per-kind value series (length 6, ~5-min spacing). The shape
// makes the sparklines tell a small story:
//   - Gini drifts up (worsening participation balance)
//   - Challenge concentration is also rising
//   - Response latency is improving
//   - Attention deficit jitters
//   - Facilitator load builds
const SERIES: Record<EquityMetricKind, number[]> = {
  [EquityMetricKind.PARTICIPATION_GINI]: [0.21, 0.27, 0.31, 0.34, 0.38, 0.42],
  [EquityMetricKind.CHALLENGE_CONCENTRATION]: [0.29, 0.32, 0.36, 0.41, 0.45, 0.48],
  [EquityMetricKind.RESPONSE_LATENCY_P50]: [220, 198, 175, 162, 150, 140],
  [EquityMetricKind.ATTENTION_DEFICIT]: [0.12, 0.18, 0.23, 0.20, 0.27, 0.31],
  [EquityMetricKind.FACILITATOR_LOAD]: [0.30, 0.35, 0.42, 0.48, 0.55, 0.61],
};

const FINAL: Record<EquityMetricKind, number> = {
  [EquityMetricKind.PARTICIPATION_GINI]: 0.45,
  [EquityMetricKind.CHALLENGE_CONCENTRATION]: 0.50,
  [EquityMetricKind.RESPONSE_LATENCY_P50]: 132,
  [EquityMetricKind.ATTENTION_DEFICIT]: 0.34,
  [EquityMetricKind.FACILITATOR_LOAD]: 0.65,
};

async function seedMetricSeries(opts: {
  sessionId: string;
  deliberationId: string;
  windowsAgoMinutes: number; // start offset, e.g. 30 for last 30 minutes
}) {
  const stepMs = (opts.windowsAgoMinutes * 60_000) / SERIES.PARTICIPATION_GINI.length;
  const t0 = Date.now() - opts.windowsAgoMinutes * 60_000;
  let count = 0;
  for (let i = 0; i < SERIES.PARTICIPATION_GINI.length; i++) {
    const windowStart = new Date(t0 + i * stepMs);
    const windowEnd = new Date(t0 + (i + 1) * stepMs);
    for (const kind of Object.keys(SERIES) as EquityMetricKind[]) {
      const value = SERIES[kind][i];
      await prisma.equityMetricSnapshot.create({
        data: {
          deliberationId: opts.deliberationId,
          sessionId: opts.sessionId,
          metricKind: kind,
          metricVersion: 1,
          value: dec(value),
          windowStart,
          windowEnd,
          breakdownJson: breakdownFor(kind),
          isFinal: false,
        },
      });
      count++;
    }
  }
  return count;
}

async function seedFinalSnapshots(opts: {
  sessionId: string;
  deliberationId: string;
}) {
  const at = new Date();
  for (const kind of Object.keys(FINAL) as EquityMetricKind[]) {
    await prisma.equityMetricSnapshot.create({
      data: {
        deliberationId: opts.deliberationId,
        sessionId: opts.sessionId,
        metricKind: kind,
        metricVersion: 1,
        value: dec(FINAL[kind]),
        windowStart: new Date(at.getTime() - 15 * 60_000),
        windowEnd: at,
        breakdownJson: breakdownFor(kind),
        isFinal: true,
      },
    });
  }
}

function breakdownFor(kind: EquityMetricKind): Record<string, unknown> {
  switch (kind) {
    case EquityMetricKind.PARTICIPATION_GINI:
      return { speakerCount: 5, topSpeakerShare: 0.42 };
    case EquityMetricKind.CHALLENGE_CONCENTRATION:
      return { topKAuthorIds: ["demo-author-a", "demo-author-b"], k: 2 };
    case EquityMetricKind.RESPONSE_LATENCY_P50:
      return { samples: 12, p50Ms: 140, p90Ms: 320 };
    case EquityMetricKind.ATTENTION_DEFICIT:
      return {
        staleClaimIds: ["demo-claim-1", "demo-claim-2"],
        staleClaimCount: 2,
      };
    case EquityMetricKind.FACILITATOR_LOAD:
      return { activePromptCount: 3, openInterventions: 5 };
  }
}

interface SeededIntervention {
  kind: FacilitationInterventionKind;
  ruleName: string;
  targetType: FacilitationInterventionTargetType;
  targetId: string;
  priority: number;
  rationale: { headline: string; reason: string };
  state: "pending" | "applied" | "dismissed";
  triggeredByMetric?: EquityMetricKind;
  dismissReasonTag?: FacilitationDismissalTag;
  dismissReasonText?: string;
}

const CURRENT_INTERVENTIONS: SeededIntervention[] = [
  {
    kind: FacilitationInterventionKind.ELICIT_UNHEARD,
    ruleName: "unheardSpeakerRule",
    targetType: FacilitationInterventionTargetType.USER,
    targetId: "demo-author-c",
    priority: 4,
    rationale: {
      headline: "demo-author-c hasn't spoken in 18 minutes",
      reason: "Participation Gini at 0.42 with one author dominating the floor.",
    },
    state: "pending",
    triggeredByMetric: EquityMetricKind.PARTICIPATION_GINI,
  },
  {
    kind: FacilitationInterventionKind.REBALANCE_CHALLENGE,
    ruleName: "challengeBalanceRule",
    targetType: FacilitationInterventionTargetType.CLAIM,
    targetId: "demo-claim-1",
    priority: 3,
    rationale: {
      headline: "Claim has 4 challenges from the same author",
      reason: "Challenge concentration at 0.48 — diversify the rebuttal pool.",
    },
    state: "applied",
    triggeredByMetric: EquityMetricKind.CHALLENGE_CONCENTRATION,
  },
  {
    kind: FacilitationInterventionKind.PROMPT_EVIDENCE,
    ruleName: "evidenceGapRule",
    targetType: FacilitationInterventionTargetType.ARGUMENT,
    targetId: "demo-arg-7",
    priority: 2,
    rationale: {
      headline: "Argument 7 makes a quantitative claim with no source",
      reason: "Prompt the author for a citation before locking the question.",
    },
    state: "dismissed",
    dismissReasonTag: FacilitationDismissalTag.already_addressed,
    dismissReasonText: "Author cited the BLS series in chat at 14:02.",
  },
  {
    kind: FacilitationInterventionKind.INVITE_RESPONSE,
    ruleName: "attentionDeficitRule",
    targetType: FacilitationInterventionTargetType.CLAIM,
    targetId: "demo-claim-2",
    priority: 3,
    rationale: {
      headline: "Claim 2 has had no engagement in 22 minutes",
      reason: "Attention deficit at 0.31 — invite a named responder.",
    },
    state: "pending",
    triggeredByMetric: EquityMetricKind.ATTENTION_DEFICIT,
  },
  {
    kind: FacilitationInterventionKind.COOLDOWN,
    ruleName: "facilitatorLoadRule",
    targetType: FacilitationInterventionTargetType.ROOM,
    targetId: "demo-room",
    priority: 2,
    rationale: {
      headline: "Facilitator load at 0.61 — recommend a 90-second cooldown",
      reason: "Three open prompts and five pending interventions.",
    },
    state: "pending",
    triggeredByMetric: EquityMetricKind.FACILITATOR_LOAD,
  },
];

async function seedInterventions(opts: {
  sessionId: string;
  actorId: string;
  items: SeededIntervention[];
}) {
  // Pin every intervention to the most recent snapshot of its triggering kind
  // so the demo "click-through" UX (snapshot → intervention → event) works.
  const pinByKind = new Map<EquityMetricKind, string>();
  const pinned = await prisma.equityMetricSnapshot.findMany({
    where: { sessionId: opts.sessionId },
    orderBy: { windowEnd: "desc" },
  });
  for (const row of pinned) {
    if (!pinByKind.has(row.metricKind as EquityMetricKind)) {
      pinByKind.set(row.metricKind as EquityMetricKind, row.id);
    }
  }

  for (const item of opts.items) {
    const snapshotId = item.triggeredByMetric
      ? pinByKind.get(item.triggeredByMetric) ?? null
      : null;

    const created = await prisma.facilitationIntervention.create({
      data: {
        sessionId: opts.sessionId,
        kind: item.kind,
        targetType: item.targetType,
        targetId: item.targetId,
        priority: item.priority,
        ruleName: item.ruleName,
        ruleVersion: 1,
        rationaleJson: item.rationale,
        triggeredByMetric: item.triggeredByMetric ?? null,
        triggeredByMetricSnapshotId: snapshotId,
      },
    });

    await appendEvent({
      sessionId: opts.sessionId,
      eventType: FacilitationEventType.INTERVENTION_RECOMMENDED,
      actorId: "system",
      actorRole: "system",
      payloadJson: {
        interventionId: created.id,
        ruleName: item.ruleName,
        ruleVersion: 1,
        kind: item.kind,
        targetType: item.targetType,
        targetId: item.targetId,
        priority: item.priority,
        triggeredByMetric: item.triggeredByMetric ?? null,
        triggeredByMetricSnapshotId: snapshotId,
        headline: item.rationale.headline,
      },
      interventionId: created.id,
      metricSnapshotId: snapshotId,
    });

    if (item.state === "applied") {
      const appliedAt = new Date();
      await prisma.facilitationIntervention.update({
        where: { id: created.id },
        data: { appliedAt, appliedById: opts.actorId },
      });
      await appendEvent({
        sessionId: opts.sessionId,
        eventType: FacilitationEventType.INTERVENTION_APPLIED,
        actorId: opts.actorId,
        actorRole: "facilitator",
        payloadJson: {
          interventionId: created.id,
          appliedAt: appliedAt.toISOString(),
          noteText: "Asked demo-author-d and demo-author-e to weigh in.",
        },
        interventionId: created.id,
      });
    } else if (item.state === "dismissed") {
      const dismissedAt = new Date();
      await prisma.facilitationIntervention.update({
        where: { id: created.id },
        data: {
          dismissedAt,
          dismissedById: opts.actorId,
          dismissedReasonTag: item.dismissReasonTag ?? null,
          dismissedReasonText:
            item.dismissReasonText ?? "Not relevant to current question.",
        },
      });
      await appendEvent({
        sessionId: opts.sessionId,
        eventType: FacilitationEventType.INTERVENTION_DISMISSED,
        actorId: opts.actorId,
        actorRole: "facilitator",
        payloadJson: {
          interventionId: created.id,
          dismissedAt: dismissedAt.toISOString(),
          reasonText: item.dismissReasonText ?? "Not relevant.",
          reasonTag: item.dismissReasonTag ?? null,
        },
        interventionId: created.id,
      });
    }
  }
}

async function seedQuestionWithChecks(opts: {
  deliberationId: string;
  authorId: string;
  text: string;
  framing: FacilitationFramingType;
  checks: Array<{
    kind: FacilitationCheckKind;
    severity: FacilitationCheckSeverity;
    messageText: string;
  }>;
}) {
  const q = await authorQuestion({
    deliberationId: opts.deliberationId,
    authoredById: opts.authorId,
    text: opts.text,
    framingType: opts.framing,
  });
  const runId = "run_" + Math.random().toString(16).slice(2, 14);
  for (const c of opts.checks) {
    await prisma.facilitationQuestionCheck.create({
      data: {
        questionId: q.id,
        runId,
        kind: c.kind,
        severity: c.severity,
        messageText: c.messageText,
        evidenceJson: { source: "demo-seed" },
      },
    });
  }
  return q;
}

async function main() {
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, createdById: true, title: true },
  });
  if (!deliberation) {
    console.error(
      `Deliberation not found: ${deliberationId}. Pass a valid cuid (not a slug).`,
    );
    process.exit(2);
  }
  const actorId = deliberation.createdById;
  log("deliberation", { id: deliberation.id, host: actorId });

  // Refuse to clobber existing data unless --reset.
  if (!RESET) {
    const existing = await prisma.facilitationSession.count({
      where: { deliberationId: deliberation.id },
    });
    if (existing > 0) {
      console.error(
        `Deliberation already has ${existing} facilitation session(s). Re-run with --reset to wipe and re-seed.`,
      );
      process.exit(3);
    }
  } else {
    await resetDeliberation(deliberation.id);
  }

  // ── 1. Closed historical session (≈24h ago) ───────────────────────────
  const historical = await openSession({
    deliberationId: deliberation.id,
    openedById: actorId,
    isPublic: true,
    summary: "Yesterday's framing session — synthesis posted to chat.",
  });
  // Backdate timestamps for the report rollup.
  const histOpen = new Date(Date.now() - 26 * 60 * 60_000);
  const histClose = new Date(Date.now() - 24 * 60 * 60_000);
  await prisma.facilitationSession.update({
    where: { id: historical.id },
    data: { openedAt: histOpen },
  });
  await seedMetricSeries({
    sessionId: historical.id,
    deliberationId: deliberation.id,
    windowsAgoMinutes: 90,
  });
  await seedInterventions({
    sessionId: historical.id,
    actorId,
    items: CURRENT_INTERVENTIONS.slice(0, 3),
  });
  await closeSession({
    sessionId: historical.id,
    closedById: actorId,
    summary: "Three interventions logged; question reached lock.",
  });
  await prisma.facilitationSession.update({
    where: { id: historical.id },
    data: { closedAt: histClose },
  });
  await seedFinalSnapshots({
    sessionId: historical.id,
    deliberationId: deliberation.id,
  });
  log("historical session", { id: historical.id });

  // ── 2. Current OPEN session ──────────────────────────────────────────
  const current = await openSession({
    deliberationId: deliberation.id,
    openedById: actorId,
    isPublic: true,
    summary: "Active demo session.",
  });
  await prisma.facilitationSession.update({
    where: { id: current.id },
    data: { openedAt: new Date(Date.now() - 30 * 60_000) },
  });
  await seedQuestionWithChecks({
    deliberationId: deliberation.id,
    authorId: actorId,
    text:
      "Which transit modes deliver the best 5-year reduction in single-occupancy vehicle trips for the downtown core?",
    framing: FacilitationFramingType.evaluative,
    checks: [
      {
        kind: FacilitationCheckKind.CLARITY,
        severity: FacilitationCheckSeverity.INFO,
        messageText: "Question is concrete and time-bounded — clarity passes.",
      },
      {
        kind: FacilitationCheckKind.SCOPE,
        severity: FacilitationCheckSeverity.WARN,
        messageText:
          "Geographic scope ('downtown core') is undefined — consider attaching the boundary map.",
      },
      {
        kind: FacilitationCheckKind.LEADING,
        severity: FacilitationCheckSeverity.INFO,
        messageText: "No leading framing detected.",
      },
    ],
  });
  await seedMetricSeries({
    sessionId: current.id,
    deliberationId: deliberation.id,
    windowsAgoMinutes: 30,
  });
  await seedInterventions({
    sessionId: current.id,
    actorId,
    items: CURRENT_INTERVENTIONS,
  });
  log("current session", { id: current.id });

  console.log(
    `\n✅ Seeded. Visit /test/facilitation-features?deliberationId=${deliberation.id}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
