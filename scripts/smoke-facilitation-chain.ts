/**
 * Throwaway smoke test for C1.2: open a facilitation session, append two
 * events, verify the chain, then clean up.
 *
 * Run: npx tsx scripts/smoke-facilitation-chain.ts
 */

import { PrismaClient } from "@prisma/client";
import { appendEvent, verifyFacilitationChain } from "../lib/facilitation/eventService";
import { FacilitationEventType } from "../lib/facilitation/types";

const prisma = new PrismaClient();

async function main() {
  const d = await prisma.deliberation.findFirst({ select: { id: true, createdById: true } });
  if (!d) {
    console.log("NO_DELIBERATION (skipping)");
    return;
  }

  const session = await prisma.facilitationSession.create({
    data: { deliberationId: d.id, openedById: d.createdById, isPublic: false },
  });
  console.log("opened session", session.id);

  try {
    await appendEvent({
      sessionId: session.id,
      eventType: FacilitationEventType.SESSION_OPENED,
      actorId: d.createdById,
      actorRole: "facilitator",
      payloadJson: { deliberationId: d.id, isPublic: false },
    });
    await appendEvent({
      sessionId: session.id,
      eventType: FacilitationEventType.MANUAL_NUDGE,
      actorId: d.createdById,
      actorRole: "facilitator",
      payloadJson: { note: "smoke test" },
    });
    const result = await verifyFacilitationChain(session.id);
    console.log("verify", JSON.stringify(result));
    if (!result.valid) process.exitCode = 1;
  } finally {
    await prisma.facilitationEvent.deleteMany({ where: { sessionId: session.id } });
    await prisma.facilitationSession.delete({ where: { id: session.id } });
    console.log("cleaned up");
  }
}

main()
  .catch((err) => {
    console.error("smoke-facilitation-chain: failed", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
