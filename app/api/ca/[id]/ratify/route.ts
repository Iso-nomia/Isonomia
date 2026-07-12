export const dynamic = "force-dynamic";

// app/api/ca/[id]/ratify/route.ts
//
// Attack-ratification sign-off (DEV_SPEC §5.1/§5.2). POST = sign off; DELETE =
// withdraw a sign-off. A CA becomes EFFECTIVE once live non-author sign-offs
// reach the policy threshold, and demotes back to PROPOSED if withdrawal drops
// below it. Guards: auth, no self-ratification, no AI/system ratifiers (D4).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { resolveRatificationPolicy, ratificationThreshold } from "@/lib/aspic/ratification/policy";
import { createRatificationClearedNotif } from "@/lib/actions/notification.actions";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

// v1 heuristic AI/system-actor exclusion (D4: human-only ratifiers). Richer
// authorKind-based detection is a deferred refinement.
const NON_HUMAN_ACTORS = new Set(["mcp-bot", "importer", "system"]);

async function liveSignoffs(conflictApplicationId: string) {
  return prisma.conflictRatification.count({
    where: { conflictApplicationId, withdrawnAt: null },
  });
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId().catch(() => null);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
  const me = String(uid);
  const caId = params.id;

  const ca = await prisma.conflictApplication.findUnique({
    where: { id: caId },
    select: { id: true, deliberationId: true, createdById: true, ratificationStatus: true },
  });
  if (!ca) return NextResponse.json({ error: "Conflict not found" }, { status: 404, ...NO_STORE });
  if (ca.ratificationStatus === "WITHDRAWN")
    return NextResponse.json({ error: "Conflict has been withdrawn" }, { status: 409, ...NO_STORE });
  if (me === ca.createdById)
    return NextResponse.json({ error: "You cannot ratify your own attack" }, { status: 403, ...NO_STORE });
  if (NON_HUMAN_ACTORS.has(me))
    return NextResponse.json({ error: "AI/system actors cannot ratify" }, { status: 403, ...NO_STORE });

  // Record (or revive a withdrawn) sign-off.
  await prisma.conflictRatification.upsert({
    where: { conflictApplicationId_ratifierId: { conflictApplicationId: caId, ratifierId: me } },
    update: { withdrawnAt: null },
    create: { conflictApplicationId: caId, ratifierId: me },
  });

  const policy = await resolveRatificationPolicy(ca.deliberationId);
  const threshold = ratificationThreshold(policy);
  const signoffs = await liveSignoffs(caId);

  let ratificationStatus = ca.ratificationStatus;
  if (signoffs >= threshold && ratificationStatus === "PROPOSED") {
    await prisma.conflictApplication.update({
      where: { id: caId },
      data: { ratificationStatus: "EFFECTIVE", ratifiedAt: new Date() },
    });
    ratificationStatus = "EFFECTIVE";

    // §7.2: the attack now counts as a defeat — tell its author. Best-effort;
    // a notification failure must not roll back the ratification.
    if (ca.createdById) {
      try {
        await createRatificationClearedNotif({
          recipientUserId: ca.createdById,
          actorUserId: me,
          deliberationId: ca.deliberationId,
          conflictApplicationId: caId,
        });
      } catch (err) {
        console.error("[ca/ratify] Failed to send ratification-cleared notification:", err);
      }
    }
  }

  // §6: ASPIC standing is on-demand — the next evaluation reflects this. No
  // recompute job; recomputeGroundedForDelib is the separate CEG path (D5).
  return NextResponse.json({ ok: true, ratificationStatus, signoffs, threshold }, NO_STORE);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId().catch(() => null);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
  const me = String(uid);
  const caId = params.id;

  const ca = await prisma.conflictApplication.findUnique({
    where: { id: caId },
    select: { id: true, deliberationId: true, ratificationStatus: true },
  });
  if (!ca) return NextResponse.json({ error: "Conflict not found" }, { status: 404, ...NO_STORE });

  // Withdrawal is recorded, never deleted (D8).
  await prisma.conflictRatification.updateMany({
    where: { conflictApplicationId: caId, ratifierId: me, withdrawnAt: null },
    data: { withdrawnAt: new Date() },
  });

  const policy = await resolveRatificationPolicy(ca.deliberationId);
  const threshold = ratificationThreshold(policy);
  const signoffs = await liveSignoffs(caId);

  let ratificationStatus = ca.ratificationStatus;
  if (signoffs < threshold && ratificationStatus === "EFFECTIVE") {
    await prisma.conflictApplication.update({
      where: { id: caId },
      data: { ratificationStatus: "PROPOSED", ratifiedAt: null },
    });
    ratificationStatus = "PROPOSED";
  }

  return NextResponse.json({ ok: true, ratificationStatus, signoffs, threshold }, NO_STORE);
}
