/**
 * Facilitation — Metric service (C1.6)
 *
 * Pure orchestrator around `metrics/` calculators:
 *  - `computeWindow`     — load raw inputs once, run every calculator,
 *                          persist one EquityMetricSnapshot per kind.
 *  - `finalizeSession`   — write the `isFinal=true` snapshot per kind.
 *                          Guarded by partial unique index
 *                          `equity_metric_snapshot_final_unique`.
 *  - `getCurrentSnapshot`/`getHistory` — reads only.
 *
 * Storage policy: see roadmap §3.5 (every snapshot pins `metricVersion`,
 * intra-session retention is verbose, `isFinal` is pinned indefinitely).
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prismaclient";
import { EquityMetricKind, FacilitationSessionStatus } from "./types";
import { METRIC_REGISTRY } from "./metrics";
import type {
  ChallengeRecord,
  ContributionRecord,
  FacilitatorState,
  ReplyableRecord,
  WindowInputs,
} from "./metrics/types";

type Db = PrismaClient | Prisma.TransactionClient;

export interface ComputeWindowOptions {
  /** Override `now` for tests / replay. */
  now?: Date;
  /** Window length in seconds. Default 600s (10 min) per roadmap C1.6 cadence. */
  windowSeconds?: number;
  /**
   * For ATTENTION_DEFICIT we need to evaluate claims that may have been
   * posted before the metric window opened. Defaults to 6h.
   */
  replyableLookbackSeconds?: number;
  /** Pass `true` when invoked by `finalizeSession`. */
  isFinal?: boolean;
  /** Allow caller to supply pre-loaded inputs (skips DB read). */
  prebuiltInputs?: WindowInputs;
  prismaClient?: Db;
}

export interface ComputeWindowResult {
  sessionId: string;
  windowStart: Date;
  windowEnd: Date;
  snapshots: { id: string; metricKind: EquityMetricKind; value: number }[];
}

const DEFAULT_WINDOW = 600;
const DEFAULT_LOOKBACK = 6 * 60 * 60;

export async function computeWindow(
  sessionId: string,
  opts: ComputeWindowOptions = {},
): Promise<ComputeWindowResult> {
  const db = opts.prismaClient ?? defaultPrisma;
  const session = await db.facilitationSession.findUnique({
    where: { id: sessionId },
    select: { id: true, deliberationId: true, status: true, openedAt: true },
  });
  if (!session) throw new Error(`session not found: ${sessionId}`);

  const now = opts.now ?? new Date();
  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW;
  const windowStart = new Date(
    Math.max(now.getTime() - windowSeconds * 1000, session.openedAt.getTime()),
  );
  const windowEnd = now;
  const lookback = opts.replyableLookbackSeconds ?? DEFAULT_LOOKBACK;
  const replyableSince = new Date(now.getTime() - lookback * 1000);

  const inputs =
    opts.prebuiltInputs ??
    (await loadWindowInputs(db, {
      deliberationId: session.deliberationId,
      sessionId: session.id,
      windowStart,
      windowEnd,
      replyableSince,
    }));

  const created: ComputeWindowResult["snapshots"] = [];
  for (const calc of METRIC_REGISTRY) {
    const result = calc.compute(inputs);
    const row = await db.equityMetricSnapshot.create({
      data: {
        deliberationId: session.deliberationId,
        sessionId: session.id,
        windowStart,
        windowEnd,
        metricKind: calc.kind,
        metricVersion: calc.version,
        value: new Prisma.Decimal(formatDecimal(result.value)),
        breakdownJson: result.breakdown as Prisma.InputJsonValue,
        isFinal: opts.isFinal === true,
      },
      select: { id: true, metricKind: true, value: true },
    });
    created.push({
      id: row.id,
      metricKind: row.metricKind as unknown as EquityMetricKind,
      value: Number(row.value as unknown as string),
    });
  }

  return { sessionId: session.id, windowStart, windowEnd, snapshots: created };
}

export interface FinalizeOptions {
  now?: Date;
  prismaClient?: Db;
}

/**
 * Write the `isFinal=true` snapshot for each metric kind for this session.
 * Guarded by the partial unique index `equity_metric_snapshot_final_unique`
 * — calling twice raises `final snapshot already recorded`.
 *
 * Window: [openedAt, now]. The full session lifetime is the canonical
 * window for the official end-of-session value.
 */
export async function finalizeSession(
  sessionId: string,
  opts: FinalizeOptions = {},
): Promise<ComputeWindowResult> {
  const db = opts.prismaClient ?? defaultPrisma;
  const session = await db.facilitationSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      deliberationId: true,
      status: true,
      openedAt: true,
      closedAt: true,
    },
  });
  if (!session) throw new Error(`session not found: ${sessionId}`);
  if (session.status === FacilitationSessionStatus.OPEN) {
    throw new Error(`session still OPEN; finalize requires status != OPEN (id=${sessionId})`);
  }

  const existingFinal = await db.equityMetricSnapshot.count({
    where: { sessionId, isFinal: true },
  });
  if (existingFinal > 0) {
    throw new Error(`final snapshot already recorded for session ${sessionId}`);
  }

  const now = opts.now ?? session.closedAt ?? new Date();
  const windowSeconds = Math.max(
    1,
    Math.floor((now.getTime() - session.openedAt.getTime()) / 1000),
  );

  return computeWindow(sessionId, {
    now,
    windowSeconds,
    replyableLookbackSeconds: windowSeconds,
    isFinal: true,
    prismaClient: db,
  });
}

export async function getCurrentSnapshot(
  sessionId: string,
  metricKind: EquityMetricKind,
  opts: { prismaClient?: Db } = {},
) {
  const db = opts.prismaClient ?? defaultPrisma;
  return db.equityMetricSnapshot.findFirst({
    where: { sessionId, metricKind },
    orderBy: [{ windowEnd: "desc" }],
  });
}

export async function getHistory(
  sessionId: string,
  metricKind: EquityMetricKind,
  opts: { limit?: number; prismaClient?: Db } = {},
) {
  const db = opts.prismaClient ?? defaultPrisma;
  return db.equityMetricSnapshot.findMany({
    where: { sessionId, metricKind },
    orderBy: [{ windowEnd: "asc" }],
    take: opts.limit ?? 200,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Input loading. Pulled out so tests can stub via `prebuiltInputs`.
// ─────────────────────────────────────────────────────────────────────────────

interface LoadParams {
  deliberationId: string;
  sessionId: string;
  windowStart: Date;
  windowEnd: Date;
  replyableSince: Date;
}

export async function loadWindowInputs(db: Db, p: LoadParams): Promise<WindowInputs> {
  const [args, claims, conflicts, whyMoves, allMoves, openInterventions, lastAction] =
    await Promise.all([
      db.argument.findMany({
        where: {
          deliberationId: p.deliberationId,
          createdAt: { gte: p.windowStart, lte: p.windowEnd },
        },
        select: { id: true, authorId: true, createdAt: true },
      }),
      db.claim.findMany({
        where: {
          deliberationId: p.deliberationId,
          createdAt: { gte: p.replyableSince, lte: p.windowEnd },
        },
        select: { id: true, createdById: true, createdAt: true },
      }),
      db.conflictApplication.findMany({
        where: {
          deliberationId: p.deliberationId,
          createdAt: { gte: p.windowStart, lte: p.windowEnd },
        },
        select: { createdById: true, createdAt: true },
      }),
      db.dialogueMove.findMany({
        where: {
          deliberationId: p.deliberationId,
          kind: "WHY",
          createdAt: { gte: p.windowStart, lte: p.windowEnd },
        },
        select: { actorId: true, createdAt: true },
      }),
      db.dialogueMove.findMany({
        where: {
          deliberationId: p.deliberationId,
          createdAt: { gte: p.replyableSince, lte: p.windowEnd },
          targetType: { in: ["claim", "argument"] },
        },
        select: { targetType: true, targetId: true, createdAt: true, actorId: true },
        orderBy: { createdAt: "asc" },
      }),
      db.facilitationIntervention.count({
        where: { sessionId: p.sessionId, appliedAt: null, dismissedAt: null },
      }),
      db.facilitationIntervention.findFirst({
        where: {
          sessionId: p.sessionId,
          OR: [{ appliedAt: { not: null } }, { dismissedAt: { not: null } }],
        },
        orderBy: [{ appliedAt: "desc" }, { dismissedAt: "desc" }],
        select: { appliedAt: true, dismissedAt: true },
      }),
    ]);

  const enrolledAuthIds = Array.from(
    new Set([
      ...args.map((a) => a.authorId),
      ...claims.map((c) => c.createdById),
      ...allMoves.map((m) => m.actorId).filter((x): x is string => !!x),
    ]),
  );

  const contributions: ContributionRecord[] = [
    ...args.map((a) => ({
      authorId: a.authorId,
      createdAt: a.createdAt,
      source: "argument" as const,
    })),
    ...claims
      .filter((c) => c.createdAt >= p.windowStart)
      .map((c) => ({
        authorId: c.createdById,
        createdAt: c.createdAt,
        source: "claim" as const,
      })),
  ];

  const challenges: ChallengeRecord[] = [
    ...conflicts.map((c) => ({
      authorId: c.createdById,
      createdAt: c.createdAt,
      source: "conflict" as const,
    })),
    ...whyMoves
      .filter((m): m is typeof m & { actorId: string } => !!m.actorId)
      .map((m) => ({ authorId: m.actorId, createdAt: m.createdAt, source: "why" as const })),
  ];

  // First reply per (targetType, targetId) — `allMoves` is sorted asc.
  const firstReply = new Map<string, Date>();
  for (const m of allMoves) {
    const key = `${m.targetType}:${m.targetId}`;
    if (!firstReply.has(key)) firstReply.set(key, m.createdAt);
  }

  const replyables: ReplyableRecord[] = claims.map((c) => ({
    id: c.id,
    postedAt: c.createdAt,
    firstReplyAt: firstReply.get(`claim:${c.id}`) ?? null,
    weight: 1,
  }));

  const facilitator: FacilitatorState = {
    openInterventionCount: openInterventions,
    lastActionAt:
      lastAction == null
        ? null
        : (lastAction.appliedAt ?? lastAction.dismissedAt ?? null),
  };

  return {
    windowStart: p.windowStart,
    windowEnd: p.windowEnd,
    enrolledAuthIds,
    contributions,
    challenges,
    replyables,
    facilitator,
  };
}

// Decimal(12,6) — clamp/round so Prisma doesn't reject extreme values.
function formatDecimal(v: number): string {
  if (!Number.isFinite(v)) return "0.000000";
  const sign = v < 0 ? -1 : 1;
  const clamped = Math.min(Math.abs(v), 999999.999999) * sign;
  return clamped.toFixed(6);
}
