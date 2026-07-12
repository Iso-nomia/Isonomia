/**
 * Facilitation — Intervention service (C1.5)
 *
 * Three responsibilities:
 *  1. `recommendNext(sessionId, opts)` — driver that loads the latest
 *     snapshot per metric kind for the session, runs the enabled rules,
 *     dedupes, persists `FacilitationIntervention` rows, and emits
 *     `INTERVENTION_RECOMMENDED` events on the session chain.
 *  2. `applyIntervention(...)` / `dismissIntervention(...)` — terminal
 *     transitions; idempotency-guarded; emit `INTERVENTION_APPLIED` /
 *     `INTERVENTION_DISMISSED` on the session chain.
 *  3. `listInterventions(...)` — cursor-paginated read for the cockpit.
 *
 * Locked decision #4: free-text reason is REQUIRED on dismiss; tag optional.
 * Schema-layer enforcement lives in `schemas/interventionSchemas.ts`; the
 * service additionally rejects whitespace-only reasonText to be defensive
 * for callers that bypass the zod schema.
 */

import { prisma } from "@/lib/prismaclient";
import type {
  Prisma,
  FacilitationIntervention as PrismaIntervention,
} from "@prisma/client";
import { appendEvent } from "./eventService";
import { enabledRules, type RuleDescriptor } from "./rules";
import type {
  ClaimSummary,
  MetricSnapshot,
  PairwiseTurn,
  RuleContext,
  RuleOutput,
} from "./rules/types";
import {
  EquityMetricKind,
  FacilitationDismissalTag,
  FacilitationEventType,
  FacilitationInterventionTargetType,
  FacilitationSessionStatus,
} from "./types";

type Tx = Prisma.TransactionClient;

const DEFAULT_DEDUPE_WINDOW_SECONDS = 600;

// ─────────────────────────────────────────────────────────
// Driver
// ─────────────────────────────────────────────────────────

export interface RecommendNextOptions {
  /** Override `now` for testing. */
  now?: Date;
  /** Per-rule per-deliberation thresholds. */
  thresholds?: Record<string, Record<string, number>>;
  /** Feature flag map: `{ ff_facilitation_rule_<name>: true|false }`. */
  featureFlags?: Record<string, boolean>;
  /**
   * Optional providers — when omitted, the corresponding rules will not
   * fire. Wired to real claim/turn collectors in C2.
   */
  loadHighWeightClaims?: (sessionId: string, deliberationId: string) => Promise<ClaimSummary[]>;
  loadPairwiseTurns?: (sessionId: string, deliberationId: string) => Promise<PairwiseTurn[]>;
  loadEnrolledAuthIds?: (deliberationId: string) => Promise<string[]>;
}

export interface RecommendNextResult {
  sessionId: string;
  ranAt: Date;
  recommended: PrismaIntervention[];
  /** Rules that produced no output (after dedupe). */
  noOpRules: string[];
  /** Rules that threw; logged + chain-recorded but did not crash the cycle. */
  ruleErrors: { ruleName: string; message: string }[];
}

export async function recommendNext(
  sessionId: string,
  opts: RecommendNextOptions = {},
): Promise<RecommendNextResult> {
  const session = await prisma.facilitationSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, deliberationId: true },
  });
  if (!session) throw new Error(`session not found: ${sessionId}`);
  if (session.status !== FacilitationSessionStatus.OPEN) {
    throw new Error(
      `session inactive (status=${session.status}); cannot recommend interventions on ${sessionId}`,
    );
  }

  const now = opts.now ?? new Date();
  const rules = enabledRules(opts.featureFlags ?? {});

  const [snapshots, openInterventions, claims, turns, enrolled] = await Promise.all([
    loadLatestSnapshotsBySession(session.id, session.deliberationId),
    loadOpenInterventions(session.id),
    opts.loadHighWeightClaims?.(session.id, session.deliberationId) ?? Promise.resolve(undefined),
    opts.loadPairwiseTurns?.(session.id, session.deliberationId) ?? Promise.resolve(undefined),
    opts.loadEnrolledAuthIds?.(session.deliberationId) ?? Promise.resolve([] as string[]),
  ]);

  const ctx: RuleContext = {
    sessionId: session.id,
    deliberationId: session.deliberationId,
    now,
    enrolledAuthIds: enrolled,
    snapshots,
    highWeightClaims: claims,
    pairwiseTurns: turns,
    openInterventions,
    thresholds: opts.thresholds,
  };

  const recommended: PrismaIntervention[] = [];
  const noOpRules: string[] = [];
  const ruleErrors: { ruleName: string; message: string }[] = [];

  for (const rule of rules) {
    let outputs: RuleOutput[];
    try {
      const raw = rule.run(ctx);
      outputs = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ruleErrors.push({ ruleName: rule.name, message });
      // Visibility — emit a chain entry so the cockpit can surface the failure.
      try {
        await appendEvent({
          sessionId: session.id,
          eventType: FacilitationEventType.METRIC_THRESHOLD_CROSSED,
          actorId: "system",
          actorRole: "system",
          payloadJson: {
            ruleError: true,
            ruleName: rule.name,
            ruleVersion: rule.version,
            message,
          },
        });
      } catch {
        /* swallow secondary errors */
      }
      continue;
    }

    if (outputs.length === 0) {
      noOpRules.push(rule.name);
      continue;
    }

    let persistedAny = false;
    for (const output of outputs) {
      const persisted = await persistRecommendation(rule, output, ctx, now);
      if (persisted) {
        recommended.push(persisted);
        // Refresh dedupe state for subsequent outputs in the same cycle.
        ctx.openInterventions.push({
          id: persisted.id,
          ruleName: persisted.ruleName,
          targetType: persisted.targetType as unknown as FacilitationInterventionTargetType,
          targetId: persisted.targetId,
          recommendedAt: persisted.recommendedAt,
        });
        persistedAny = true;
      }
    }
    if (!persistedAny) noOpRules.push(rule.name);
  }

  return { sessionId: session.id, ranAt: now, recommended, noOpRules, ruleErrors };
}

async function persistRecommendation(
  rule: RuleDescriptor,
  output: RuleOutput,
  ctx: RuleContext,
  now: Date,
): Promise<PrismaIntervention | null> {
  const dedupeSeconds =
    output.dedupeWindowSeconds ?? rule.dedupeWindowSeconds ?? DEFAULT_DEDUPE_WINDOW_SECONDS;
  const cutoff = new Date(now.getTime() - dedupeSeconds * 1000);

  // Cheap in-memory dedupe pass first.
  const memoryHit = ctx.openInterventions.find(
    (i) =>
      i.ruleName === rule.name &&
      i.targetType === (output.targetType as unknown as string) &&
      i.targetId === output.targetId &&
      i.recommendedAt >= cutoff,
  );
  if (memoryHit) return null;

  return prisma.$transaction(async (tx) => {
    // Authoritative DB-level dedupe — guards against parallel cycles.
    const dbHit = await tx.facilitationIntervention.findFirst({
      where: {
        sessionId: ctx.sessionId,
        ruleName: rule.name,
        targetType: output.targetType,
        targetId: output.targetId,
        appliedAt: null,
        dismissedAt: null,
        recommendedAt: { gte: cutoff },
      },
      select: { id: true },
    });
    if (dbHit) return null;

    const created = await tx.facilitationIntervention.create({
      data: {
        sessionId: ctx.sessionId,
        kind: output.kind,
        targetType: output.targetType,
        targetId: output.targetId,
        priority: output.priority,
        ruleName: rule.name,
        ruleVersion: rule.version,
        triggeredByMetric: output.triggeredByMetric ?? null,
        triggeredByMetricSnapshotId: output.triggeredByMetricSnapshotId ?? null,
        rationaleJson: {
          headline: output.rationale.headline,
          details: output.rationale.details,
          suggestedPhrasing: output.suggestedPhrasing,
        } as unknown as Prisma.InputJsonValue,
        recommendedAt: now,
      },
    });

    await appendEvent(
      {
        sessionId: ctx.sessionId,
        eventType: FacilitationEventType.INTERVENTION_RECOMMENDED,
        actorId: "system",
        actorRole: "system",
        payloadJson: {
          interventionId: created.id,
          ruleName: rule.name,
          ruleVersion: rule.version,
          kind: output.kind,
          targetType: output.targetType,
          targetId: output.targetId,
          priority: output.priority,
          triggeredByMetric: output.triggeredByMetric,
          triggeredByMetricSnapshotId: output.triggeredByMetricSnapshotId,
          headline: output.rationale.headline,
        },
        interventionId: created.id,
        metricSnapshotId: output.triggeredByMetricSnapshotId ?? null,
      },
      tx,
    );

    return created;
  });
}

// ─────────────────────────────────────────────────────────
// Snapshot loader
// ─────────────────────────────────────────────────────────

async function loadLatestSnapshotsBySession(
  sessionId: string,
  deliberationId: string,
): Promise<Partial<Record<EquityMetricKind, MetricSnapshot>>> {
  const kinds = Object.values(EquityMetricKind);
  const out: Partial<Record<EquityMetricKind, MetricSnapshot>> = {};
  for (const kind of kinds) {
    const row = await prisma.equityMetricSnapshot.findFirst({
      where: {
        OR: [{ sessionId }, { sessionId: null, deliberationId }],
        metricKind: kind,
      },
      orderBy: { windowEnd: "desc" },
    });
    if (!row) continue;
    out[kind] = {
      id: row.id,
      metricKind: row.metricKind as unknown as EquityMetricKind,
      metricVersion: row.metricVersion,
      value: Number(row.value as unknown as string),
      windowStart: row.windowStart,
      windowEnd: row.windowEnd,
      breakdown: row.breakdownJson as Record<string, unknown>,
      isFinal: row.isFinal,
    };
  }
  return out;
}

async function loadOpenInterventions(
  sessionId: string,
): Promise<RuleContext["openInterventions"]> {
  const rows = await prisma.facilitationIntervention.findMany({
    where: { sessionId, appliedAt: null, dismissedAt: null },
    select: {
      id: true,
      ruleName: true,
      targetType: true,
      targetId: true,
      recommendedAt: true,
    },
    orderBy: { recommendedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    ruleName: r.ruleName,
    targetType: r.targetType as unknown as string,
    targetId: r.targetId,
    recommendedAt: r.recommendedAt,
  })) as unknown as RuleContext["openInterventions"];
}

// ─────────────────────────────────────────────────────────
// Apply / Dismiss
// ─────────────────────────────────────────────────────────

export interface ApplyInterventionInput {
  interventionId: string;
  appliedById: string;
  noteText?: string | null;
}

export async function applyIntervention(
  input: ApplyInterventionInput,
): Promise<PrismaIntervention> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.facilitationIntervention.findUnique({
      where: { id: input.interventionId },
      select: {
        id: true,
        sessionId: true,
        kind: true,
        targetType: true,
        targetId: true,
        appliedAt: true,
        dismissedAt: true,
      },
    });
    if (!row) throw new Error(`intervention not found: ${input.interventionId}`);
    if (row.appliedAt) {
      throw new Error(
        `intervention already applied (id=${input.interventionId})`,
      );
    }
    if (row.dismissedAt) {
      throw new Error(
        `intervention already dismissed (id=${input.interventionId}); cannot apply`,
      );
    }

    const appliedAt = new Date();
    const updated = await tx.facilitationIntervention.update({
      where: { id: row.id },
      data: { appliedAt, appliedById: input.appliedById },
    });

    await appendEvent(
      {
        sessionId: row.sessionId,
        eventType: FacilitationEventType.INTERVENTION_APPLIED,
        actorId: input.appliedById,
        actorRole: "facilitator",
        payloadJson: {
          interventionId: row.id,
          appliedAt: appliedAt.toISOString(),
          noteText: input.noteText ?? null,
        },
        interventionId: row.id,
      },
      tx,
    );

    return updated;
  });
}

export interface DismissInterventionInput {
  interventionId: string;
  dismissedById: string;
  reasonText: string;
  reasonTag?: FacilitationDismissalTag | null;
}

export async function dismissIntervention(
  input: DismissInterventionInput,
): Promise<PrismaIntervention> {
  // Defensive: enforce the locked-decision-#4 invariant even if the caller
  // bypasses the zod schema.
  if (!input.reasonText || input.reasonText.trim().length === 0) {
    throw new Error("reasonText is required to dismiss an intervention");
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.facilitationIntervention.findUnique({
      where: { id: input.interventionId },
      select: {
        id: true,
        sessionId: true,
        appliedAt: true,
        dismissedAt: true,
      },
    });
    if (!row) throw new Error(`intervention not found: ${input.interventionId}`);
    if (row.dismissedAt) {
      throw new Error(
        `intervention already dismissed (id=${input.interventionId})`,
      );
    }
    if (row.appliedAt) {
      throw new Error(
        `intervention already applied (id=${input.interventionId}); cannot dismiss`,
      );
    }

    const dismissedAt = new Date();
    const updated = await tx.facilitationIntervention.update({
      where: { id: row.id },
      data: {
        dismissedAt,
        dismissedById: input.dismissedById,
        dismissedReasonText: input.reasonText,
        dismissedReasonTag: input.reasonTag ?? null,
      },
    });

    await appendEvent(
      {
        sessionId: row.sessionId,
        eventType: FacilitationEventType.INTERVENTION_DISMISSED,
        actorId: input.dismissedById,
        actorRole: "facilitator",
        payloadJson: {
          interventionId: row.id,
          dismissedAt: dismissedAt.toISOString(),
          reasonText: input.reasonText,
          reasonTag: input.reasonTag ?? null,
        },
        interventionId: row.id,
      },
      tx,
    );

    return updated;
  });
}

// ─────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────

export type InterventionListStatus = "open" | "applied" | "dismissed" | "all";

export interface ListInterventionsInput {
  sessionId: string;
  status?: InterventionListStatus;
  cursor?: string;
  limit?: number;
}

export interface ListInterventionsResult {
  interventions: PrismaIntervention[];
  nextCursor: string | null;
}

export async function listInterventions(
  input: ListInterventionsInput,
): Promise<ListInterventionsResult> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const status: InterventionListStatus = input.status ?? "all";

  const where: Prisma.FacilitationInterventionWhereInput = { sessionId: input.sessionId };
  if (status === "open") {
    where.appliedAt = null;
    where.dismissedAt = null;
  } else if (status === "applied") {
    where.appliedAt = { not: null };
  } else if (status === "dismissed") {
    where.dismissedAt = { not: null };
  }

  const rows = await prisma.facilitationIntervention.findMany({
    where,
    orderBy: [{ priority: "desc" }, { recommendedAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    interventions: slice,
    nextCursor: hasMore ? slice[slice.length - 1].id : null,
  };
}
