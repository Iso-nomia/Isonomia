export const dynamic = "force-dynamic";


 import { NextRequest, NextResponse } from "next/server";
 import { z } from "zod";
 import { prisma } from "@/lib/prismaclient";
 
 const q = z.object({
   rootMessageId: z.union([z.string(), z.number(), z.bigint()]).transform(v => BigInt(v as any)),
 });
 
 export async function GET(req: NextRequest) {
   const { rootMessageId } = q.parse(Object.fromEntries(req.nextUrl.searchParams));
 
   // Proposals live in DRIFT(kind=PROPOSAL) and each created a facet; we’ll read facets via your existing join if available.
   // For MVP, return counts by facet_id from ProposalSignal.
   const signals = await prisma.proposalSignal.findMany({
     where: { message_id: rootMessageId },
     select: { facet_id: true, kind: true },
   });
   const counts: Record<string, { approve: number; block: number }> = {};
   for (const s of signals) {
    counts[s.facet_id] ??= { approve: 0, block: 0 };
    if (s.kind === "APPROVE") counts[s.facet_id].approve++;
    if (s.kind === "BLOCK") counts[s.facet_id].block++;
  }

  // If you track proposals elsewhere (e.g., facets table), stitch titles/snippets here.
  // Return a thin list so UI can show ✅/⛔ counts per candidate.
  return NextResponse.json({ ok: true, counts });
}
