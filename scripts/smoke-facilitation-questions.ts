/**
 * Smoke test for C1.4: question lifecycle — author, revise, runChecks, lock
 * gates (NO_CHECKS_RUN, BLOCK_SEVERITY_UNRESOLVED, WARN_NOT_ACKNOWLEDGED,
 * success), reopen with QUESTION_REOPENED event.
 *
 * Run: npx tsx scripts/smoke-facilitation-questions.ts
 */

import { PrismaClient } from "@prisma/client";
import {
  authorQuestion,
  reviseQuestion,
  runChecks,
  lockQuestion,
  reopenQuestion,
  LockGateError,
} from "../lib/facilitation/questionService";
import { openSession, closeSession } from "../lib/facilitation/sessionService";
import { verifyFacilitationChain } from "../lib/facilitation/eventService";
import { FacilitationFramingType } from "../lib/facilitation/types";

const prisma = new PrismaClient();
const createdQuestionIds: string[] = [];
const createdSessionIds: string[] = [];

async function cleanup() {
  if (createdQuestionIds.length === 0 && createdSessionIds.length === 0) return;
  await prisma.facilitationQuestionCheck.deleteMany({
    where: { questionId: { in: createdQuestionIds } },
  });
  // Delete revisions first (children) by repeatedly nulling parent refs.
  await prisma.facilitationQuestion.updateMany({
    where: { id: { in: createdQuestionIds } },
    data: { parentQuestionId: null },
  });
  await prisma.facilitationQuestion.deleteMany({
    where: { id: { in: createdQuestionIds } },
  });
  await prisma.facilitationEvent.deleteMany({
    where: { sessionId: { in: createdSessionIds } },
  });
  await prisma.facilitationSession.deleteMany({
    where: { id: { in: createdSessionIds } },
  });
}

function assert(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` — ${detail ?? ""}`}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const d = await prisma.deliberation.findFirst({ select: { id: true, createdById: true } });
  if (!d) {
    console.log("NO_DELIBERATION (skipping)");
    return;
  }
  const author = d.createdById;

  // 1. Author v1
  const q1 = await authorQuestion({
    deliberationId: d.id,
    authoredById: author,
    text: "Should the city restore weekend bus service or keep the current schedule?",
    framingType: FacilitationFramingType.choice,
  });
  createdQuestionIds.push(q1.id);
  assert("author.v1", q1.version === 1);

  // 2. Lock without checks → NO_CHECKS_RUN
  let gate: LockGateError | null = null;
  try {
    await lockQuestion({ questionId: q1.id, lockedById: author, acknowledgedCheckIds: [] });
  } catch (e) {
    if (e instanceof LockGateError) gate = e;
    else throw e;
  }
  assert("lock.noChecksRun", gate?.code === "NO_CHECKS_RUN");

  // 3. Run checks — clean question. Expect WARN-only (long-ish, balanced choice).
  const run1 = await runChecks({ questionId: q1.id });
  console.log(`  run1: info=${run1.result.summary.info} warn=${run1.result.summary.warn} block=${run1.result.summary.block}`);
  assert("runChecks.someRows", run1.result.checks.length > 0);

  // 4. Revise to inject a BLOCK (presupposition + multiple questions).
  const q2 = await reviseQuestion({
    questionId: q1.id,
    authoredById: author,
    text: "Don't you think we should restore service? Why now?",
    framingType: FacilitationFramingType.choice,
  });
  createdQuestionIds.push(q2.id);
  assert("revise.v2", q2.version === 2 && q2.parentQuestionId === q1.id);

  // 5. Lock the OLD version → superseded.
  let supersededErr = false;
  try {
    await lockQuestion({ questionId: q1.id, lockedById: author, acknowledgedCheckIds: run1.result.checks.map((_, i) => `unused_${i}`) });
  } catch (e) {
    supersededErr = (e as Error).message.includes("superseded");
  }
  assert("lock.supersededRejected", supersededErr);

  const run2 = await runChecks({ questionId: q2.id });
  console.log(`  run2: info=${run2.result.summary.info} warn=${run2.result.summary.warn} block=${run2.result.summary.block}`);
  assert("runChecks.v2HasBlock", run2.result.summary.block > 0);

  // 6. Lock v2 with no acks → BLOCK_SEVERITY_UNRESOLVED
  let blockGate: LockGateError | null = null;
  try {
    await lockQuestion({ questionId: q2.id, lockedById: author, acknowledgedCheckIds: [] });
  } catch (e) {
    if (e instanceof LockGateError) blockGate = e;
    else throw e;
  }
  assert("lock.blockUnresolved", blockGate?.code === "BLOCK_SEVERITY_UNRESOLVED");

  // 7. Revise to remove BLOCK; should produce WARNs only.
  const q3 = await reviseQuestion({
    questionId: q2.id,
    authoredById: author,
    text: "Should the city obviously restore weekend bus service or keep the current schedule?",
    framingType: FacilitationFramingType.choice,
  });
  createdQuestionIds.push(q3.id);
  const run3 = await runChecks({ questionId: q3.id });
  console.log(`  run3: info=${run3.result.summary.info} warn=${run3.result.summary.warn} block=${run3.result.summary.block}`);
  assert("runChecks.v3NoBlock", run3.result.summary.block === 0);
  assert("runChecks.v3HasWarn", run3.result.summary.warn > 0);

  // 8. Lock v3 without acks → WARN_NOT_ACKNOWLEDGED
  let warnGate: LockGateError | null = null;
  try {
    await lockQuestion({ questionId: q3.id, lockedById: author, acknowledgedCheckIds: [] });
  } catch (e) {
    if (e instanceof LockGateError) warnGate = e;
    else throw e;
  }
  assert("lock.warnUnacknowledged", warnGate?.code === "WARN_NOT_ACKNOWLEDGED");

  // 9. Lock v3 with all WARN ids acknowledged → success.
  const warnIds = warnGate?.offendingCheckIds ?? [];
  const locked = await lockQuestion({ questionId: q3.id, lockedById: author, acknowledgedCheckIds: warnIds });
  assert("lock.success", locked.lockedAt != null && locked.lockedById === author);
  assert("lock.qualityReportPersisted", locked.qualityReportJson != null);

  // 10. Reopen with active session → QUESTION_REOPENED event lands and chain still verifies.
  const session = await openSession({ deliberationId: d.id, openedById: author });
  createdSessionIds.push(session.id);
  await reopenQuestion({
    questionId: q3.id,
    reopenedById: author,
    reasonText: "Need to revisit framing after equity review.",
    sessionId: session.id,
  });
  const reopened = await prisma.facilitationQuestion.findUnique({ where: { id: q3.id } });
  assert("reopen.lockedCleared", reopened?.lockedAt == null);
  const events = await prisma.facilitationEvent.findMany({
    where: { sessionId: session.id, eventType: "QUESTION_REOPENED" },
  });
  assert("reopen.eventAppended", events.length === 1);
  const v = await verifyFacilitationChain(session.id);
  assert("reopen.chainValid", v.valid);
  await closeSession({ sessionId: session.id, closedById: author });
}

main()
  .catch((err) => {
    console.error("smoke-facilitation-questions: failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log("cleaned up");
  });
