import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/server/getUser";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const row = await prisma.blockManifest.findUnique({
    where: { id: params.id },
    select: { id: true, component: true, props: true, ownerId: true, thumbnail: true },
  });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Optional auth check
    const user = await getUserFromCookies().catch(() => null);
    const row = await prisma.blockManifest.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true },
    });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    // If you want strict ownership enforcement in prod:
    // if (!user?.id || BigInt(user.id) !== row.ownerId) {
    //   return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    // }

    await prisma.blockManifest.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
