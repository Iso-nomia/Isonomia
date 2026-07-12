/**
 * Smoke test for C1.3: open → close, and full handoff lifecycle (initiate +
 * accept, initiate + decline, initiate + cancel). Verifies every chain at
 * the end and cleans up.
 *
 * Run: npx tsx scripts/smoke-facilitation-handoff.ts
 */

import { PrismaClient } from "@prisma/client";
import { openSession, closeSession } from "../lib/facilitation/sessionService";
import {
  initiateHandoff,
  acceptHandoff,
  declineHandoff,
  cancelHandoff,
} from "../lib/facilitation/handoffService";
import { verifyFacilitationChain } from "../lib/facilitation/eventService";
import {
  FacilitationHandoffStatus,
  FacilitationSessionStatus,
} from "../lib/facilitation/types";

const prisma = new PrismaClient();

let createdSessionIds: string[] = [];
let createdHandoffIds: string[] = [];

async function cleanup() {
  if (createdSessionIds.length === 0) return;
  await prisma.facilitationEvent.deleteMany({
    where: { sessionId: { in: createdSessionIds } },
  });
  await prisma.facilitationHandoff.deleteMany({
    where: { id: { in: createdHandoffIds } },
  });
  await prisma.facilitationSession.deleteMany({
    where: { id: { in: createdSessionIds } },
  });
}

function assertEq<T>(label: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "PASS" : "FAIL"} ${label} ${ok ? "" : `(got=${JSON.stringify(got)} want=${JSON.stringify(want)})`}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const d = await prisma.deliberation.findFirst({ select: { id: true, createdById: true } });
  if (!d) {
    console.log("NO_DELIBERATION (skipping)");
    return;
  }

  const facilitatorA = d.createdById;
  const facilitatorB = `${facilitatorA}_handoff_target`;

  // Path 1: open → close.
  {
    const s = await openSession({ deliberationId: d.id, openedById: facilitatorA });
    createdSessionIds.push(s.id);
    const closed = await closeSession({ sessionId: s.id, closedById: facilitatorA, summary: "smoke" });
    assertEq("close.status", closed.status, FacilitationSessionStatus.CLOSED);
    const v = await verifyFacilitationChain(s.id);
    assertEq("close.chainValid", v.valid, true);
  }

  // Path 2: open → initiate → accept (atomic close + open).
  {
    const s = await openSession({ deliberationId: d.id, openedById: facilitatorA });
    createdSessionIds.push(s.id);
    const h = await initiateHandoff({
      fromSessionId: s.id,
      initiatedById: facilitatorA,
      toUserId: facilitatorB,
      notesText: "please take over",
    });
    createdHandoffIds.push(h.id);
    assertEq("initiate.status", h.status, FacilitationHandoffStatus.PENDING);

    const { handoff: accepted, successor } = await acceptHandoff({
      handoffId: h.id,
      acceptedById: facilitatorB,
      notesText: "got it",
    });
    createdSessionIds.push(successor.id);
    assertEq("accept.status", accepted.status, FacilitationHandoffStatus.ACCEPTED);
    assertEq("accept.successorOpenedBy", successor.openedById, facilitatorB);
    assertEq("accept.successorIsOpen", successor.status, FacilitationSessionStatus.OPEN);

    const sourceAfter = await prisma.facilitationSession.findUnique({ where: { id: s.id } });
    assertEq("accept.sourceHandedOff", sourceAfter?.status, FacilitationSessionStatus.HANDED_OFF);

    const v1 = await verifyFacilitationChain(s.id);
    assertEq("accept.sourceChainValid", v1.valid, true);
    const v2 = await verifyFacilitationChain(successor.id);
    assertEq("accept.successorChainValid", v2.valid, true);

    // Close the successor so we can re-open in the same deliberation.
    await closeSession({ sessionId: successor.id, closedById: facilitatorB });
  }

  // Path 3: open → initiate → decline (source remains OPEN).
  {
    const s = await openSession({ deliberationId: d.id, openedById: facilitatorA });
    createdSessionIds.push(s.id);
    const h = await initiateHandoff({
      fromSessionId: s.id,
      initiatedById: facilitatorA,
      toUserId: facilitatorB,
    });
    createdHandoffIds.push(h.id);
    const d1 = await declineHandoff({ handoffId: h.id, actorId: facilitatorB, notesText: "no" });
    assertEq("decline.status", d1.status, FacilitationHandoffStatus.DECLINED);
    const sourceAfter = await prisma.facilitationSession.findUnique({ where: { id: s.id } });
    assertEq("decline.sourceStillOpen", sourceAfter?.status, FacilitationSessionStatus.OPEN);
    const v = await verifyFacilitationChain(s.id);
    assertEq("decline.chainValid", v.valid, true);
    await closeSession({ sessionId: s.id, closedById: facilitatorA });
  }

  // Path 4: open → initiate → cancel (initiator withdraws).
  {
    const s = await openSession({ deliberationId: d.id, openedById: facilitatorA });
    createdSessionIds.push(s.id);
    const h = await initiateHandoff({
      fromSessionId: s.id,
      initiatedById: facilitatorA,
      toUserId: facilitatorB,
    });
    createdHandoffIds.push(h.id);
    const c1 = await cancelHandoff({ handoffId: h.id, actorId: facilitatorA });
    assertEq("cancel.status", c1.status, FacilitationHandoffStatus.CANCELED);
    const sourceAfter = await prisma.facilitationSession.findUnique({ where: { id: s.id } });
    assertEq("cancel.sourceStillOpen", sourceAfter?.status, FacilitationSessionStatus.OPEN);
    const v = await verifyFacilitationChain(s.id);
    assertEq("cancel.chainValid", v.valid, true);
    await closeSession({ sessionId: s.id, closedById: facilitatorA });
  }

  // Path 5: confirm partial unique index — opening a second session while one
  // is OPEN should fail.
  {
    const s = await openSession({ deliberationId: d.id, openedById: facilitatorA });
    createdSessionIds.push(s.id);
    let threw = false;
    try {
      const s2 = await openSession({ deliberationId: d.id, openedById: facilitatorA });
      createdSessionIds.push(s2.id);
    } catch {
      threw = true;
    }
    assertEq("doubleOpen.rejected", threw, true);
    await closeSession({ sessionId: s.id, closedById: facilitatorA });
  }

  // Path 6: confirm decline-then-cancel attempt rejects (handoff terminal).
  {
    const s = await openSession({ deliberationId: d.id, openedById: facilitatorA });
    createdSessionIds.push(s.id);
    const h = await initiateHandoff({
      fromSessionId: s.id,
      initiatedById: facilitatorA,
      toUserId: facilitatorB,
    });
    createdHandoffIds.push(h.id);
    await declineHandoff({ handoffId: h.id, actorId: facilitatorB });
    let threw = false;
    try {
      await cancelHandoff({ handoffId: h.id, actorId: facilitatorA });
    } catch {
      threw = true;
    }
    assertEq("terminalHandoff.rejected", threw, true);
    await closeSession({ sessionId: s.id, closedById: facilitatorA });
  }
}

main()
  .catch((err) => {
    console.error("smoke-facilitation-handoff: failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log("cleaned up");
  });
