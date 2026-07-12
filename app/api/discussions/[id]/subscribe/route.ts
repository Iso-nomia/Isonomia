// app/api/discussions/[id]/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const discussion = await prisma.discussion.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  
  if (!discussion) {
    return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
  }

  // Idempotent subscription
  const subscription = await prisma.discussionSubscription.upsert({
    where: {
      discussionId_userId: {
        discussionId: params.id,
        userId: String(uid),
      },
    },
    create: {
      discussionId: params.id,
      userId: String(uid),
    },
    update: {},
    select: {
      id: true,
      discussionId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ subscription, subscribed: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  await prisma.discussionSubscription.deleteMany({
    where: {
      discussionId: params.id,
      userId: String(uid),
    },
  });

  return NextResponse.json({ subscribed: false });
}

// GET - check subscription status
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ subscribed: false });

  const sub = await prisma.discussionSubscription.findUnique({
    where: {
      discussionId_userId: {
        discussionId: params.id,
        userId: String(uid),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ subscribed: !!sub });
}