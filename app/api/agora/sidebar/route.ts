export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deliberationId = url.searchParams.get("deliberationId") || undefined;

  // recent receipts
  const receipts = ((await (prisma as any).ludicDecisionReceipt?.findMany?.({
    where: deliberationId ? { deliberationId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id:true, kind:true, subjectType:true, subjectId:true, deliberationId:true, rationale:true, createdAt:true },
  })) || []).map((r:any)=>({ ...r, createdAt: r.createdAt?.toISOString?.() }));

  // votes/calls: return empty for now (add when tables exist)
  const votes: any[] = []; // TODO: fill from your vote sessions
  const calls: any[] = []; // TODO: fill from your call table

  return NextResponse.json({ receipts, votes, calls });
}
