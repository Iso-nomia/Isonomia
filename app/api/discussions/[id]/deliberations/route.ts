// app/api/discussions/[id]/deliberations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { emitBus } from "@/lib/server/bus";
import {
  listableDeliberationWhere,
  normalizeUserId,
} from "@/lib/deliberations/visibility";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  deliberationId: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "deliberationId required" }, { status: 400 });
  }
  const { deliberationId } = parsed.data;

  // Ensure both sides exist (avoid FK 500s) and (optionally) that user can write
  const [discussion, deliberation] = await prisma.$transaction([
    prisma.discussion.findUnique({ where: { id: params.id }, select: { id: true } }),
    prisma.deliberation.findUnique({ where: { id: deliberationId }, select: { id: true } }),
  ]);

  if (!discussion) return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
  if (!deliberation) return NextResponse.json({ error: "Deliberation not found" }, { status: 404 });

  // Optional: gate by membership/ownership (uncomment if you want write guards)
  // const canWrite = await prisma.discussionParticipant.findFirst({
  //   where: { discussionId: params.id, userId: String(uid) },
  //   select: { id: true },
  // });
  // if (!canWrite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Idempotent link
  const existing = await prisma.discussionDeliberation.findUnique({
    where: { discussionId_deliberationId: { discussionId: params.id, deliberationId } },
    select: { discussionId: true, deliberationId: true, createdAt: true, createdById: true },
  });

  if (existing) {
    emitBus("discussions:changed" as any, { id: params.id, op: "link-exists", deliberationId });
    return NextResponse.json({ link: existing, ok: true }, { status: 200 });
  }

  const link = await prisma.discussionDeliberation.create({
    data: { discussionId: params.id, deliberationId, createdById: String(uid) },
    select: { discussionId: true, deliberationId: true, createdAt: true, createdById: true },
  });

  emitBus("discussions:changed" as any, { id: params.id, op: "link", deliberationId });
  return NextResponse.json({ link, ok: true }, { status: 201 });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const include = (url.searchParams.get("include") || "").split(",").filter(Boolean);
  const includeDelib = include.includes("deliberation");

  // Visibility: only surface links to deliberations the viewer may list.
  const userId = normalizeUserId(await getCurrentUserId().catch(() => null));
  const items = await prisma.discussionDeliberation.findMany({
    where: {
      discussionId: params.id,
      deliberation: { is: listableDeliberationWhere(userId) },
    },
    orderBy: [{ createdAt: "desc" }, { deliberationId: "asc" }],
    ...(includeDelib && {
      include: {
        deliberation: {
          select: { id: true, hostType: true, hostId: true, createdAt: true, updatedAt: true },
        },
      },
    }),
  } as any);

  return NextResponse.json({ items });
}
