export const dynamic = "force-dynamic";

// app/api/thesis/[id]/snapshots/[snapshotId]/route.ts
//
// Living Thesis — Phase 5.2: snapshot retrieve endpoint.
//
// GET /api/thesis/[id]/snapshots/[snapshotId] — frozen state.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status, ...NO_STORE });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; snapshotId: string } },
) {
  try {
    const authId = await getCurrentUserAuthId();
    if (!authId) return bad(401, "Unauthorized");

    const snapshot = await prisma.thesisSnapshot.findUnique({
      where: { id: params.snapshotId },
      select: {
        id: true,
        thesisId: true,
        label: true,
        createdAt: true,
        createdById: true,
        parentSnapshotId: true,
        contentJson: true,
        statsSnapshot: true,
        confidenceSnapshot: true,
        attacksSnapshot: true,
      },
    });
    if (!snapshot) return bad(404, "Snapshot not found");
    if (snapshot.thesisId !== params.id) {
      return bad(404, "Snapshot does not belong to this thesis");
    }

    return NextResponse.json({ snapshot }, NO_STORE);
  } catch (err) {
    console.error("[thesis/snapshots/:id GET] error:", err);
    return bad(500, "Internal error");
  }
}
