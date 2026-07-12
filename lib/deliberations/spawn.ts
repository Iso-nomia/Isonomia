// app/api/deliberations/spawn/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { emitBus } from "@/lib/server/bus";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { hostType, hostId } = await req.json();
  if (!hostType || !hostId) return NextResponse.json({ error: "hostType & hostId required" }, { status: 400 });

  const existing = await prisma.deliberation.findFirst({ where: { hostType, hostId } });
  if (existing) return NextResponse.json({ deliberationId: existing.id });

  const d = await prisma.deliberation.create({
    data: { hostType, hostId, createdById: String(userId) },
    select: { id: true },
  });
  emitBus("deliberations:created", { hostType, hostId, deliberationId: d.id });
  return NextResponse.json({ deliberationId: d.id });
}
