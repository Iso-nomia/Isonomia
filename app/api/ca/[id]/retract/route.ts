export const dynamic = "force-dynamic";

// app/api/ca/[id]/retract/route.ts
//
// Author retract → WITHDRAWN (DEV_SPEC §5.3). Terminal, author-only. A WITHDRAWN
// CA is excluded by the §4 enforcement filter (so it stops counting as a defeat)
// and is barred from re-ratification (the ratify route 409s on WITHDRAWN).
//
// Distinct from DELETE /api/ca/[id]/ratify, which withdraws a single *sign-off*;
// this withdraws the *whole attack* and only its author may do so.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId().catch(() => null);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
  const me = String(uid);
  const caId = params.id;

  const ca = await prisma.conflictApplication.findUnique({
    where: { id: caId },
    select: { id: true, createdById: true, ratificationStatus: true },
  });
  if (!ca) return NextResponse.json({ error: "Conflict not found" }, { status: 404, ...NO_STORE });
  if (me !== ca.createdById)
    return NextResponse.json({ error: "Only the attack's author may retract it" }, { status: 403, ...NO_STORE });
  if (ca.ratificationStatus === "WITHDRAWN")
    return NextResponse.json({ ok: true, ratificationStatus: "WITHDRAWN" }, NO_STORE); // idempotent

  await prisma.conflictApplication.update({
    where: { id: caId },
    data: { ratificationStatus: "WITHDRAWN", ratifiedAt: null },
  });

  // Standing is on-demand (§6) — the next evaluation drops this CA via the §4 filter.
  return NextResponse.json({ ok: true, ratificationStatus: "WITHDRAWN" }, NO_STORE);
}
