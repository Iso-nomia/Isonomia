export const dynamic = "force-dynamic";

// app/api/arguments/[id]/aif-cqs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const arg = await prisma.argument.findUnique({
    where: { id: params.id },
    include: {
      scheme: { include: { cqs: true } },
    },
  });
  if (!arg || !arg.scheme) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const statuses = await prisma.cQStatus.findMany({
    where: { argumentId: arg.id },
  });
  const byKey = new Map(statuses.map(s => [s.cqKey, { id: s.id, status: s.status }]));

  const items = arg.scheme.cqs.map((cq) => {
    const statusData = byKey.get(cq.cqKey ?? "");
    return {
      id: statusData?.id, // Include CQStatus ID for Phase 3 components
      cqKey: cq.cqKey,
      text: cq.text,
      attackType: cq.attackType,
      targetScope: cq.targetScope,
      status: statusData?.status ?? "open",
    };
  });

  return NextResponse.json({ ok: true, items });
}
