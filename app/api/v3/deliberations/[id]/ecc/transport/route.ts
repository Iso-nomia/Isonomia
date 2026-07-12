/**
 * GET /api/v3/deliberations/[id]/ecc/transport
 * GET /api/v3/deliberations/[id]/ecc/transport?fromRoomId=...
 *
 * Sprint E1 — read materialized `RoomTransportSnapshot` rows landing in
 * this deliberation. When `fromRoomId` is supplied, returns the single
 * pair snapshot; otherwise returns every snapshot whose `toRoomId`
 * matches the deliberation.
 *
 * Honest-empty: a deliberation with no inbound functors returns
 * `{ ok: true, snapshots: [] }`. The MCP tool description must say so.
 *
 * NOTE (ECC plan §4 row 2): one-hop only. There is no chained transport
 * (A→B→C). The MCP tool description repeats this contract.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: deliberationId } = await ctx.params;
  const fromRoomId = new URL(req.url).searchParams.get("fromRoomId") ?? undefined;

  const rows = await prisma.roomTransportSnapshot.findMany({
    where: { toRoomId: deliberationId, ...(fromRoomId ? { fromRoomId } : {}) },
    select: {
      id: true,
      fromRoomId: true,
      toRoomId: true,
      claimMapHash: true,
      payloadJson: true,
      computedAt: true,
    },
    orderBy: { computedAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    deliberationId,
    fromRoomId: fromRoomId ?? null,
    snapshots: rows,
    note:
      "One-hop transport only (ECC plan \u00a74 row 2). Chained transport (A\u2192B\u2192C) is not supported.",
  });
}
