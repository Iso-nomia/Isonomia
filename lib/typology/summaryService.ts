/**
 * Typology — Summary service
 *
 * CRUD for `MetaConsensusSummary` rows. Lifecycle:
 *   draftSummary → editDraft → publishSummary (freezes snapshot) → retractSummary
 *
 * Publishing freezes:
 *   - `snapshotJson` — embeds every supporting tag with a claim/argument
 *     snapshot so the published summary is self-contained.
 *   - `snapshotHash` — sha256 of canonical(snapshotJson), pinned in the
 *     SUMMARY_PUBLISHED event payload.
 *
 * Edits to a published summary require a new version row pointing at
 * `parentSummaryId` (callers handle this by calling `draftSummary` with
 * `{ parentSummaryId }`; we auto-bump `version`).
 *
 * Status: B1 scaffold.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/prismaclient";
import { Prisma } from "@prisma/client";
import type {
  MetaConsensusSummary as PrismaSummary,
} from "@prisma/client";
import { canonicalJsonStringify } from "@/lib/pathways/canonicalJson";
import { appendEvent } from "./typologyEventService";
import {
  DisagreementAxisKey,
  DisagreementTagTargetType,
  MetaConsensusEventType,
  MetaConsensusSummaryStatus,
  type MetaConsensusSummaryBody,
} from "./types";
import type { DraftSummaryInput, EditDraftInput, SummaryBodyInput } from "./schemas";

export const SNAPSHOT_BYTE_CAP = 256 * 1024;

export class SummaryServiceError extends Error {
  constructor(
    public readonly code:
      | "CONFLICT_SUMMARY_NOT_DRAFT"
      | "CONFLICT_SUMMARY_NOT_PUBLISHED"
      | "CONFLICT_SUMMARY_NOT_FOUND"
      | "CONFLICT_SUMMARY_REFERENCES_RETRACTED_TAG"
      | "CONFLICT_SUMMARY_REFERENCES_UNKNOWN_TAG"
      | "CONFLICT_SUMMARY_PARENT_NOT_PUBLISHED"
      | "SNAPSHOT_TOO_LARGE",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SummaryServiceError";
  }
}

export interface DraftSummaryOptions extends DraftSummaryInput {
  deliberationId: string;
  authoredById: string;
}

export async function draftSummary(input: DraftSummaryOptions): Promise<PrismaSummary> {
  const sessionId = input.sessionId ?? null;

  // Compute next version: 1 if no parent; parent.version + 1 otherwise.
  let version = 1;
  if (input.parentSummaryId) {
    const parent = await prisma.metaConsensusSummary.findUnique({
      where: { id: input.parentSummaryId },
      select: { version: true, status: true, deliberationId: true },
    });
    if (!parent || parent.deliberationId !== input.deliberationId) {
      throw new SummaryServiceError(
        "CONFLICT_SUMMARY_NOT_FOUND",
        `parent summary not found in deliberation: ${input.parentSummaryId}`,
      );
    }
    if (parent.status !== "PUBLISHED") {
      throw new SummaryServiceError(
        "CONFLICT_SUMMARY_PARENT_NOT_PUBLISHED",
        `parent summary must be PUBLISHED to revise: ${input.parentSummaryId}`,
      );
    }
    version = parent.version + 1;
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.metaConsensusSummary.create({
      data: {
        deliberationId: input.deliberationId,
        sessionId,
        version,
        status: MetaConsensusSummaryStatus.DRAFT,
        authoredById: input.authoredById,
        parentSummaryId: input.parentSummaryId ?? null,
        bodyJson: input.bodyJson as unknown as Prisma.InputJsonValue,
        narrativeText: input.narrativeText ?? null,
      },
    });

    await appendEvent(
      {
        deliberationId: input.deliberationId,
        sessionId,
        eventType: MetaConsensusEventType.SUMMARY_DRAFTED,
        actorId: input.authoredById,
        actorRole: "facilitator",
        payloadJson: {
          summaryId: row.id,
          version,
          parentSummaryId: input.parentSummaryId ?? null,
        },
        summaryId: row.id,
      },
      tx,
    );

    return row;
  });
}

export async function editDraft(
  summaryId: string,
  input: EditDraftInput,
): Promise<PrismaSummary> {
  const existing = await prisma.metaConsensusSummary.findUnique({ where: { id: summaryId } });
  if (!existing) {
    throw new SummaryServiceError("CONFLICT_SUMMARY_NOT_FOUND", `summary not found: ${summaryId}`);
  }
  if (existing.status !== "DRAFT") {
    throw new SummaryServiceError(
      "CONFLICT_SUMMARY_NOT_DRAFT",
      `summary not in DRAFT status: ${summaryId}`,
    );
  }
  return prisma.metaConsensusSummary.update({
    where: { id: summaryId },
    data: {
      ...(input.bodyJson !== undefined
        ? { bodyJson: input.bodyJson as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.narrativeText !== undefined ? { narrativeText: input.narrativeText } : {}),
    },
  });
}

interface SnapshotTagEntry {
  tagId: string;
  axisKey: DisagreementAxisKey;
  axisVersion: number;
  confidence: string;
  evidenceText: string;
  targetType: DisagreementTagTargetType;
  targetId: string;
  authoredById: string;
  confirmedAt: string | null;
  claimSnapshot?: { id: string; text: string };
  argumentSnapshot?: { id: string; text: string };
}

interface SnapshotPayload {
  summaryId: string;
  publishedAt: string;
  tags: SnapshotTagEntry[];
}

export async function publishSummary(
  summaryId: string,
  publishedById: string,
): Promise<PrismaSummary> {
  const summary = await prisma.metaConsensusSummary.findUnique({ where: { id: summaryId } });
  if (!summary) {
    throw new SummaryServiceError("CONFLICT_SUMMARY_NOT_FOUND", `summary not found: ${summaryId}`);
  }
  if (summary.status !== "DRAFT") {
    throw new SummaryServiceError(
      "CONFLICT_SUMMARY_NOT_DRAFT",
      `summary not in DRAFT status: ${summaryId}`,
    );
  }

  const body = summary.bodyJson as unknown as MetaConsensusSummaryBody;
  const supportingTagIds = Array.from(
    new Set(body.disagreedOn.flatMap((d) => d.supportingTagIds ?? [])),
  );

  const tags = await prisma.disagreementTag.findMany({
    where: { id: { in: supportingTagIds } },
    include: { axis: true },
  });
  const found = new Set(tags.map((t) => t.id));
  const missing = supportingTagIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new SummaryServiceError(
      "CONFLICT_SUMMARY_REFERENCES_UNKNOWN_TAG",
      `summary references unknown tag(s): ${missing.join(", ")}`,
      { missingTagIds: missing },
    );
  }
  const retracted = tags.filter((t) => !!t.retractedAt);
  if (retracted.length > 0) {
    throw new SummaryServiceError(
      "CONFLICT_SUMMARY_REFERENCES_RETRACTED_TAG",
      `summary references retracted tag(s): ${retracted.map((t) => t.id).join(", ")}`,
      { retractedTagIds: retracted.map((t) => t.id) },
    );
  }

  // Resolve target snapshots in bulk.
  const claimIds = tags.filter((t) => t.targetType === "CLAIM").map((t) => t.targetId);
  const argumentIds = tags.filter((t) => t.targetType === "ARGUMENT").map((t) => t.targetId);
  const [claims, argumentsRows] = await Promise.all([
    claimIds.length
      ? prisma.claim.findMany({ where: { id: { in: claimIds } }, select: { id: true, text: true } })
      : Promise.resolve([] as { id: string; text: string }[]),
    argumentIds.length
      ? prisma.argument.findMany({
          where: { id: { in: argumentIds } },
          select: { id: true, text: true },
        })
      : Promise.resolve([] as { id: string; text: string }[]),
  ]);
  const claimMap = new Map(claims.map((c) => [c.id, c]));
  const argMap = new Map(argumentsRows.map((a) => [a.id, a]));

  const publishedAt = new Date();
  const entries: SnapshotTagEntry[] = tags.map((t) => {
    const entry: SnapshotTagEntry = {
      tagId: t.id,
      axisKey: t.axis.key as DisagreementAxisKey,
      axisVersion: t.axisVersion,
      confidence: t.confidence.toString(),
      evidenceText: t.evidenceText,
      targetType: t.targetType as DisagreementTagTargetType,
      targetId: t.targetId,
      authoredById: t.authoredById,
      confirmedAt: t.confirmedAt ? t.confirmedAt.toISOString() : null,
    };
    if (t.targetType === "CLAIM") {
      const c = claimMap.get(t.targetId);
      if (c) entry.claimSnapshot = { id: c.id, text: c.text };
    } else if (t.targetType === "ARGUMENT") {
      const a = argMap.get(t.targetId);
      if (a) entry.argumentSnapshot = { id: a.id, text: a.text };
    }
    return entry;
  });

  const snapshot: SnapshotPayload = {
    summaryId,
    publishedAt: publishedAt.toISOString(),
    tags: entries,
  };

  const canonical = canonicalJsonStringify(snapshot);
  const byteLength = Buffer.byteLength(canonical, "utf8");
  if (byteLength > SNAPSHOT_BYTE_CAP) {
    throw new SummaryServiceError(
      "SNAPSHOT_TOO_LARGE",
      `snapshot ${byteLength} bytes exceeds cap ${SNAPSHOT_BYTE_CAP}`,
      {
        byteLength,
        cap: SNAPSHOT_BYTE_CAP,
        heaviest: entries
          .map((e) => ({ tagId: e.tagId, evidenceLen: e.evidenceText.length }))
          .sort((a, b) => b.evidenceLen - a.evidenceLen)
          .slice(0, 5),
      },
    );
  }
  const snapshotHash = createHash("sha256").update(canonical).digest("hex");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.metaConsensusSummary.update({
      where: { id: summaryId },
      data: {
        status: MetaConsensusSummaryStatus.PUBLISHED,
        publishedAt,
        publishedById,
        snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
        snapshotHash,
      },
    });

    await appendEvent(
      {
        deliberationId: summary.deliberationId,
        sessionId: summary.sessionId,
        eventType: MetaConsensusEventType.SUMMARY_PUBLISHED,
        actorId: publishedById,
        actorRole: "facilitator",
        payloadJson: {
          summaryId,
          version: summary.version,
          tagCount: entries.length,
          byteLength,
          snapshotHash,
        },
        summaryId,
      },
      tx,
    );

    // Mirror to RoomLogbook when the deliberation is room-bound. Best-effort.
    try {
      const delib = await tx.deliberation.findUnique({
        where: { id: summary.deliberationId },
        select: { roomId: true },
      });
      if (delib?.roomId) {
        await tx.roomLogbook.create({
          data: {
            roomId: delib.roomId,
            entryType: "META_CONSENSUS_PUBLISHED",
            summary: `Meta-consensus summary v${summary.version} published`,
            payload: {
              summaryId,
              version: summary.version,
              snapshotHash,
              sessionId: summary.sessionId,
            } as Prisma.InputJsonValue,
          },
        });
      }
    } catch {
      // Best-effort mirror — never block publish.
    }

    return updated;
  });
}

export async function retractSummary(
  summaryId: string,
  retractedById: string,
  reasonText: string,
): Promise<PrismaSummary> {
  return prisma.$transaction(async (tx) => {
    const summary = await tx.metaConsensusSummary.findUnique({ where: { id: summaryId } });
    if (!summary) {
      throw new SummaryServiceError(
        "CONFLICT_SUMMARY_NOT_FOUND",
        `summary not found: ${summaryId}`,
      );
    }
    if (summary.status !== "PUBLISHED") {
      throw new SummaryServiceError(
        "CONFLICT_SUMMARY_NOT_PUBLISHED",
        `summary not in PUBLISHED status: ${summaryId}`,
      );
    }

    const updated = await tx.metaConsensusSummary.update({
      where: { id: summaryId },
      data: {
        status: MetaConsensusSummaryStatus.RETRACTED,
        retractedAt: new Date(),
        retractedById,
        retractedReasonText: reasonText,
      },
    });

    await appendEvent(
      {
        deliberationId: updated.deliberationId,
        sessionId: updated.sessionId,
        eventType: MetaConsensusEventType.SUMMARY_RETRACTED,
        actorId: retractedById,
        actorRole: "facilitator",
        payloadJson: {
          summaryId,
          version: updated.version,
          reasonText,
        },
        summaryId,
      },
      tx,
    );

    try {
      const delib = await tx.deliberation.findUnique({
        where: { id: updated.deliberationId },
        select: { roomId: true },
      });
      if (delib?.roomId) {
        await tx.roomLogbook.create({
          data: {
            roomId: delib.roomId,
            entryType: "META_CONSENSUS_RETRACTED",
            summary: `Meta-consensus summary v${updated.version} retracted`,
            payload: {
              summaryId,
              version: updated.version,
              reasonText,
            } as Prisma.InputJsonValue,
          },
        });
      }
    } catch {
      // Best-effort mirror.
    }

    return updated;
  });
}

export async function getSummary(summaryId: string): Promise<PrismaSummary | null> {
  return prisma.metaConsensusSummary.findUnique({ where: { id: summaryId } });
}

export interface ListSummariesOptions {
  sessionId?: string | null;
  status?: MetaConsensusSummaryStatus | MetaConsensusSummaryStatus[];
  limit?: number;
  cursor?: string;
}

export async function listSummaries(
  deliberationId: string,
  opts: ListSummariesOptions = {},
): Promise<PrismaSummary[]> {
  const { limit = 50, cursor } = opts;
  const status = Array.isArray(opts.status) ? { in: opts.status } : opts.status;
  return prisma.metaConsensusSummary.findMany({
    where: {
      deliberationId,
      ...(opts.sessionId !== undefined ? { sessionId: opts.sessionId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

/** Latest PUBLISHED summary for a deliberation (deliberation-level by default). */
export async function latestPublished(
  deliberationId: string,
  sessionId: string | null = null,
): Promise<PrismaSummary | null> {
  return prisma.metaConsensusSummary.findFirst({
    where: { deliberationId, sessionId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });
}

/**
 * Ignore unused-symbol lint in the type alias by re-exporting the body type.
 */
export type { SummaryBodyInput };
