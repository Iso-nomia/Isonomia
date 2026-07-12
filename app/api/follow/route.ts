export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || undefined; // optional
  const rows = await prisma.agoraFollow.findMany({ where: { userId: String(uid), ...(kind ? { kind } : {}) } });
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { kind, targetId } = await req.json();
  if (!kind || !targetId) return NextResponse.json({ error: "kind, targetId required" }, { status: 400 });
  await prisma.agoraFollow.upsert({
    where: { userId_kind_targetId: { userId: String(uid), kind, targetId } },
    update: {},
    create: { userId: String(uid), kind, targetId },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const targetId = url.searchParams.get("targetId");
  if (!kind || !targetId) return NextResponse.json({ error: "kind,targetId required" }, { status: 400 });

  await prisma.agoraFollow.delete({
    where: { userId_kind_targetId: { userId: String(uid), kind, targetId } },
  }).catch(()=>{});
  return NextResponse.json({ ok: true });
}
