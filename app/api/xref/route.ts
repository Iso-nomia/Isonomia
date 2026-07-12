export const dynamic = "force-dynamic";

// app/api/xref/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { emitBus } from "@/lib/server/bus";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fromType = url.searchParams.get("fromType") || undefined;
  const fromId   = url.searchParams.get("fromId")   || undefined;
  const toType   = url.searchParams.get("toType")   || undefined;
  const toId     = url.searchParams.get("toId")     || undefined;
  const relation = url.searchParams.get("relation") || undefined;

  const where: any = {};
  if (fromType) where.fromType = fromType;
  if (fromId) where.fromId = fromId;
  if (toType) where.toType = toType;
  if (toId) where.toId = toId;
  if (relation) where.relation = relation;

  const items = await prisma.xRef.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { fromType, fromId, toType, toId, relation, meta } = await req.json();

  if (!fromType || !fromId || !toType || !toId || !relation) {
    return NextResponse.json({ error: "from*, to*, relation required" }, { status: 400 });
  }
  const row = await prisma.xRef.create({ data: { fromType, fromId, toType, toId, relation, metaJson: meta ?? {} } });
  emitBus("xref:changed", { id: row.id, fromType, fromId, toType, toId, relation });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.xRef.delete({ where: { id } }).catch(() => {});
  emitBus("xref:changed", { id, deleted: true });
  return NextResponse.json({ ok: true });
}
