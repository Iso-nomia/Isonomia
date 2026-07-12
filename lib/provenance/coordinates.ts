/**
 * lib/provenance/coordinates.ts
 *
 * Shared capture helpers for the decorrelated-gating NO-REGRET tier.
 * See docs/"NO-REGRET Capture — Implementation Roadmap (N-1, N-2, N-3).md".
 *
 * These record RAW independence coordinates at write time. Correlation between
 * checkers is derived DOWNSTREAM from these facts — nothing here encodes a
 * correlation model (per task-1 doctrine, so the schema never needs migrating
 * when the correlation model changes).
 *
 * Coordinates are self-reported by the calling agent/harness: the server cannot
 * know a caller's model family or context lineage, so the MCP client supplies
 * them. They are recorded as facts, not trusted claims — anti-spoofing is a
 * later (task-6 / assignment-control) concern, deliberately out of scope here.
 * The one urgent coordinate is `contextLineageId`: agents forked from a single
 * context share it, and it is unrecoverable if not captured now.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prismaclient";

/** A prisma client OR an interactive-transaction client. */
type Db = PrismaClient | Prisma.TransactionClient | typeof defaultPrisma;

export type AuthorKindStr = "HUMAN" | "AI" | "HYBRID";
export type CapturedVia = "mcp" | "ui" | "internal" | "ai-draft";

/** The independence-coordinate bundle threaded through every write path. */
export interface IndependenceCoordinates {
  authorKind?: AuthorKindStr;
  modelFamily?: string | null;
  modelVersion?: string | null;
  harnessId?: string | null;
  sessionId?: string | null;
  /** Ancestry: agents forked from one context share this. Unrecoverable later. */
  contextLineageId?: string | null;
  capturedVia?: CapturedVia;
  /** Any coordinate not yet promoted to a column → coordinatesJson. */
  extra?: Record<string, unknown> | null;
}

export type ActSubjectType =
  | "dialogue_move"
  | "argument"
  | "conflict_application"
  | "cq_response"
  | "claim_attack";

export type ExposureSubjectType = "argument" | "claim" | "dialogue_move";
export type ActLaneStr = "CONFIRM" | "CONTEST";
export type ExposureOutcomeStr = "PENDING" | "ACTED" | "DECLINED";

/**
 * Normalise a loosely-typed coordinate bundle (e.g. off a request body) into
 * the strict shape, coercing an unknown authorKind to undefined so the column
 * default applies rather than throwing.
 */
export function normalizeCoordinates(
  raw: unknown,
): IndependenceCoordinates | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const authorKind =
    c.authorKind === "AI" || c.authorKind === "HYBRID" || c.authorKind === "HUMAN"
      ? (c.authorKind as AuthorKindStr)
      : undefined;
  const str = (v: unknown): string | null | undefined =>
    v == null ? (v as null | undefined) : typeof v === "string" ? v : String(v);
  return {
    authorKind,
    modelFamily: str(c.modelFamily),
    modelVersion: str(c.modelVersion),
    harnessId: str(c.harnessId),
    sessionId: str(c.sessionId),
    contextLineageId: str(c.contextLineageId),
    capturedVia:
      c.capturedVia === "mcp" ||
      c.capturedVia === "ui" ||
      c.capturedVia === "internal" ||
      c.capturedVia === "ai-draft"
        ? (c.capturedVia as CapturedVia)
        : undefined,
    extra:
      c.extra && typeof c.extra === "object"
        ? (c.extra as Record<string, unknown>)
        : undefined,
  };
}

/**
 * Pure builder for the ActProvenance column values. Exposed so the transactional
 * dialogue-move seam can write coordinates atomically (inline, failures roll back
 * the move) while route-level callers use writeActProvenance (best-effort).
 */
export function actProvenanceFields(
  coords: IndependenceCoordinates | undefined,
  capturedViaDefault: CapturedVia = "mcp",
) {
  const c = coords ?? {};
  return {
    authorKind: (c.authorKind ?? "HUMAN") as AuthorKindStr,
    modelFamily: c.modelFamily ?? null,
    modelVersion: c.modelVersion ?? null,
    harnessId: c.harnessId ?? null,
    sessionId: c.sessionId ?? null,
    contextLineageId: c.contextLineageId ?? null,
    capturedVia: c.capturedVia ?? capturedViaDefault,
    coordinatesJson: (c.extra ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

/**
 * N-1: record independence coordinates for a single authoring/checking act.
 * Idempotent on (subjectType, subjectId) via upsert, so replays and the seam's
 * own retry path do not duplicate. Never throws into the caller's critical
 * path — capture must not break a healthy write (mirrors the AIF-sync
 * convention in createDialogueMove). Use this from route-level callers where the
 * target act is already committed; inside a live transaction use
 * `actProvenanceFields` + an inline upsert so a failure rolls back atomically.
 */
export async function writeActProvenance(
  db: Db,
  subjectType: ActSubjectType,
  subjectId: string,
  coords: IndependenceCoordinates | undefined,
  capturedViaDefault: CapturedVia = "mcp",
): Promise<void> {
  const data = actProvenanceFields(coords, capturedViaDefault);
  try {
    await (db as PrismaClient).actProvenance.upsert({
      where: { subjectType_subjectId: { subjectType, subjectId } },
      create: { subjectType, subjectId, ...data },
      update: data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[writeActProvenance] capture failed:", msg);
  }
}

export interface CheckExposureInput {
  deliberationId?: string | null;
  subjectType: ExposureSubjectType;
  subjectId: string;
  lane: ActLaneStr;
  outcome?: ExposureOutcomeStr;
  agentId?: string | null;
  coords?: IndependenceCoordinates;
  resultActType?: string | null;
  resultActId?: string | null;
  assignmentSource?: "self" | "system";
  overlapGroupId?: string | null;
  declineReason?: string | null;
}

/**
 * N-2 (capture-only) + N-3: record that an agent was exposed/assigned to a
 * subject and what became of it. CONTEST + DECLINED is the non-attack
 * denominator; CONTEST + ACTED links the produced attack; CONFIRM captures the
 * ratifying side. Never throws into the caller's critical path.
 */
export async function writeCheckExposure(
  db: Db,
  input: CheckExposureInput,
): Promise<void> {
  const c = input.coords ?? {};
  const acted = input.outcome === "ACTED" || input.outcome === "DECLINED";
  try {
    await (db as PrismaClient).checkExposure.create({
      data: {
        deliberationId: input.deliberationId ?? null,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        lane: input.lane,
        outcome: input.outcome ?? "PENDING",
        agentId: input.agentId ?? null,
        authorKind: (c.authorKind ?? "HUMAN") as AuthorKindStr,
        modelFamily: c.modelFamily ?? null,
        modelVersion: c.modelVersion ?? null,
        harnessId: c.harnessId ?? null,
        sessionId: c.sessionId ?? null,
        contextLineageId: c.contextLineageId ?? null,
        resultActType: input.resultActType ?? null,
        resultActId: input.resultActId ?? null,
        assignmentSource: input.assignmentSource ?? "self",
        overlapGroupId: input.overlapGroupId ?? null,
        respondedAt: acted ? new Date() : null,
        declineReason: input.declineReason ?? null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[writeCheckExposure] capture failed:", msg);
  }
}
