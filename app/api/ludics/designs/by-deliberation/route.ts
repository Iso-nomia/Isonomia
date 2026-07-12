//app/api/ludics/designs/by-deliberation/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const deliberationId = u.searchParams.get("deliberationId") || "";
  if (!deliberationId) return NextResponse.json({ error: "deliberationId required" }, { status: 400 });

  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    select: {
      id: true,
      participantId: true,            // 👈 add
      extJson: true,
      rootLocusId: true,
      hasDaimon: true,
      version: true,
    },
  });

  let proId: string | null = null;
  let oppId: string | null = null;
  for (const d of designs) {
       const role = (d.extJson as any)?.role
      ?? (d.participantId === 'Proponent' ? 'pro'
         : d.participantId === 'Opponent'  ? 'opp'
         : null);                        // 👈 fallback
    if (role === 'pro') proId = d.id;
    if (role === 'opp') oppId = d.id;
  }

  return NextResponse.json({ ok: true, proId, oppId, count: designs.length }, { headers: { "Cache-Control": "no-store" } });
}
