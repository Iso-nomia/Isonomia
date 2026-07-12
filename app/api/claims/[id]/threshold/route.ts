export const dynamic = "force-dynamic";

// app/api/claims/[id]/threshold/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const claimId = params.id;

  // CQ completeness
  const totalCQs = await prisma.cQStatus.count({ where: { targetType: "claim", targetId: claimId } });
  const doneCQs = await prisma.cQStatus.count({ where: { targetType: "claim", targetId: claimId, satisfied: true } });
  const cq = totalCQs ? doneCQs / totalCQs : 0;

  // “Credible sources”: quick default — at least 2 citations to any Source; tighten later (doi/platform/relevance)
  const cites = await prisma.citation.count({ where: { targetType: "claim", targetId: claimId } });

  const ok = cq >= 0.8 && cites >= 2;
  return NextResponse.json({ ok, cq, cites });
}
