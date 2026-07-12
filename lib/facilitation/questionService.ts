/**
 * Facilitation — Question service (C1.4)
 *
 * Versioned questions per deliberation, with a deterministic check runner
 * and lock-time enforcement of BLOCK / WARN gates per
 * docs/facilitation/QUESTION_CHECKS.md.
 *
 * Versioning model:
 *   - First author creates version=1.
 *   - reviseQuestion creates a new row with version = max(existing) + 1
 *     and parentQuestionId pointing back to the prior row.
 *   - Locking the latest version is allowed; locking older versions is rejected.
 *   - Reopen sets lockedAt=null (and lockedById=null) on a locked question
 *     and is logged as a QUESTION_REOPENED event on the active session
 *     (when one exists).
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prismaclient";
import type { Prisma, FacilitationQuestion as PrismaQuestion } from "@prisma/client";
import { appendEvent } from "./eventService";
import { runAllChecks, type CheckRunResult } from "./checks/runner";
import type { CheckContext } from "./checks/types";
import {
  FacilitationCheckSeverity,
  FacilitationEventType,
  FacilitationFramingType,
  FacilitationSessionStatus,
} from "./types";

function newRunId(): string {
  return "run_" + randomUUID().replace(/-/g, "").slice(0, 24);
}

// ─────────────────────────────────────────────────────────
// Author / Revise
// ─────────────────────────────────────────────────────────

export interface AuthorQuestionInput {
  deliberationId: string;
  authoredById: string;
  text: string;
  framingType: FacilitationFramingType;
}

export async function authorQuestion(input: AuthorQuestionInput): Promise<PrismaQuestion> {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.facilitationQuestion.findFirst({
      where: { deliberationId: input.deliberationId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    return tx.facilitationQuestion.create({
      data: {
        deliberationId: input.deliberationId,
        version: nextVersion,
        text: input.text,
        framingType: input.framingType,
        authoredById: input.authoredById,
      },
    });
  });
}

export interface ReviseQuestionInput {
  questionId: string;
  authoredById: string;
  text: string;
  framingType?: FacilitationFramingType;
}

export async function reviseQuestion(input: ReviseQuestionInput): Promise<PrismaQuestion> {
  return prisma.$transaction(async (tx) => {
    const parent = await tx.facilitationQuestion.findUnique({
      where: { id: input.questionId },
      select: { id: true, deliberationId: true, framingType: true },
    });
    if (!parent) throw new Error(`question not found: ${input.questionId}`);

    const latest = await tx.facilitationQuestion.findFirst({
      where: { deliberationId: parent.deliberationId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    return tx.facilitationQuestion.create({
      data: {
        deliberationId: parent.deliberationId,
        version: nextVersion,
        text: input.text,
        framingType: input.framingType ?? parent.framingType,
        authoredById: input.authoredById,
        parentQuestionId: parent.id,
      },
    });
  });
}

// ─────────────────────────────────────────────────────────
// Run checks
// ─────────────────────────────────────────────────────────

export interface RunChecksInput {
  questionId: string;
  /** Optional CheckContext overrides; usually derived from deliberation config. */
  language?: string;
  lexiconOverrideKey?: string;
  severityCeilings?: CheckContext["severityCeilings"];
  readabilityBlockGrade?: number;
}

export interface RunChecksOutput {
  runId: string;
  ranAt: Date;
  result: CheckRunResult;
}

export async function runChecks(input: RunChecksInput): Promise<RunChecksOutput> {
  const question = await prisma.facilitationQuestion.findUnique({
    where: { id: input.questionId },
    select: { id: true, text: true, framingType: true, lockedAt: true },
  });
  if (!question) throw new Error(`question not found: ${input.questionId}`);
  if (question.lockedAt) {
    throw new Error(
      `question locked (id=${input.questionId}); reopen before running checks`,
    );
  }

  const ctx: CheckContext = {
    framingType: question.framingType as unknown as FacilitationFramingType,
    language: input.language ?? "en",
    lexiconOverrideKey: input.lexiconOverrideKey,
    severityCeilings: input.severityCeilings,
    readabilityBlockGrade: input.readabilityBlockGrade,
  };

  const result = runAllChecks(question.text, ctx);
  const runId = newRunId();
  const ranAt = new Date();

  if (result.checks.length > 0) {
    await prisma.facilitationQuestionCheck.createMany({
      data: result.checks.map((c) => ({
        questionId: question.id,
        runId,
        kind: c.kind,
        severity: c.severity,
        messageText: c.messageText,
        evidenceJson: (c.evidence ?? null) as unknown as Prisma.InputJsonValue,
      })),
    });
  }

  return { runId, ranAt, result };
}

// ─────────────────────────────────────────────────────────
// Lock / Reopen
// ─────────────────────────────────────────────────────────

export type LockGateCode = "NO_CHECKS_RUN" | "BLOCK_SEVERITY_UNRESOLVED" | "WARN_NOT_ACKNOWLEDGED";

export class LockGateError extends Error {
  readonly code: LockGateCode;
  readonly offendingCheckIds: string[];
  constructor(code: LockGateCode, message: string, offendingCheckIds: string[] = []) {
    super(message);
    this.name = "LockGateError";
    this.code = code;
    this.offendingCheckIds = offendingCheckIds;
  }
}

export interface LockQuestionInput {
  questionId: string;
  lockedById: string;
  acknowledgedCheckIds: string[];
}

export async function lockQuestion(input: LockQuestionInput): Promise<PrismaQuestion> {
  return prisma.$transaction(async (tx) => {
    const question = await tx.facilitationQuestion.findUnique({
      where: { id: input.questionId },
      select: { id: true, deliberationId: true, version: true, lockedAt: true },
    });
    if (!question) throw new Error(`question not found: ${input.questionId}`);
    if (question.lockedAt) {
      throw new Error(`question already locked (id=${input.questionId})`);
    }

    // Lock-only-latest invariant.
    const latest = await tx.facilitationQuestion.findFirst({
      where: { deliberationId: question.deliberationId },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });
    if (!latest || latest.id !== question.id) {
      throw new Error(
        `question superseded (id=${input.questionId}, latestVersion=${latest?.version ?? "?"}); revise then lock the latest version`,
      );
    }

    // Find the most recent run for this question.
    const lastCheck = await tx.facilitationQuestionCheck.findFirst({
      where: { questionId: question.id },
      orderBy: { createdAt: "desc" },
      select: { runId: true },
    });
    if (!lastCheck) {
      throw new LockGateError("NO_CHECKS_RUN", "No quality checks have been run for this question.");
    }

    const runRows = await tx.facilitationQuestionCheck.findMany({
      where: { questionId: question.id, runId: lastCheck.runId },
      select: { id: true, severity: true, kind: true, messageText: true },
    });

    const blocks = runRows.filter((r) => r.severity === FacilitationCheckSeverity.BLOCK);
    if (blocks.length > 0) {
      throw new LockGateError(
        "BLOCK_SEVERITY_UNRESOLVED",
        `Cannot lock: ${blocks.length} BLOCK-severity check(s) unresolved`,
        blocks.map((b) => b.id),
      );
    }

    const warns = runRows.filter((r) => r.severity === FacilitationCheckSeverity.WARN);
    const ackSet = new Set(input.acknowledgedCheckIds);
    const missingAck = warns.filter((w) => !ackSet.has(w.id));
    if (missingAck.length > 0) {
      throw new LockGateError(
        "WARN_NOT_ACKNOWLEDGED",
        `Cannot lock: ${missingAck.length} WARN-severity check(s) require acknowledgement`,
        missingAck.map((m) => m.id),
      );
    }

    const lockedAt = new Date();

    if (warns.length > 0) {
      await tx.facilitationQuestionCheck.updateMany({
        where: { id: { in: warns.map((w) => w.id) } },
        data: { acknowledgedAt: lockedAt, acknowledgedById: input.lockedById },
      });
    }

    const summary = {
      runId: lastCheck.runId,
      info: runRows.filter((r) => r.severity === FacilitationCheckSeverity.INFO).length,
      warn: warns.length,
      block: 0,
      byKind: runRows.reduce<Record<string, number>>((acc, r) => {
        acc[r.kind] = (acc[r.kind] ?? 0) + 1;
        return acc;
      }, {}),
      acknowledgedCheckIds: input.acknowledgedCheckIds,
    };

    return tx.facilitationQuestion.update({
      where: { id: question.id },
      data: {
        lockedAt,
        lockedById: input.lockedById,
        qualityReportJson: summary as unknown as Prisma.InputJsonValue,
      },
    });
  });
}

export interface ReopenQuestionInput {
  questionId: string;
  reopenedById: string;
  reasonText: string;
  /** When provided, a QUESTION_REOPENED event is appended on this session's chain. */
  sessionId?: string;
}

export async function reopenQuestion(input: ReopenQuestionInput): Promise<PrismaQuestion> {
  return prisma.$transaction(async (tx) => {
    const question = await tx.facilitationQuestion.findUnique({
      where: { id: input.questionId },
      select: { id: true, deliberationId: true, lockedAt: true },
    });
    if (!question) throw new Error(`question not found: ${input.questionId}`);
    if (!question.lockedAt) {
      throw new Error(`question not locked (id=${input.questionId}); cannot reopen`);
    }

    const updated = await tx.facilitationQuestion.update({
      where: { id: question.id },
      data: { lockedAt: null, lockedById: null },
    });

    if (input.sessionId) {
      const session = await tx.facilitationSession.findUnique({
        where: { id: input.sessionId },
        select: { id: true, status: true, deliberationId: true },
      });
      if (
        session &&
        session.deliberationId === question.deliberationId &&
        session.status === FacilitationSessionStatus.OPEN
      ) {
        await appendEvent(
          {
            sessionId: session.id,
            eventType: FacilitationEventType.QUESTION_REOPENED,
            actorId: input.reopenedById,
            actorRole: "facilitator",
            payloadJson: {
              questionId: question.id,
              reasonText: input.reasonText,
            },
          },
          tx,
        );
      }
    }

    return updated;
  });
}
