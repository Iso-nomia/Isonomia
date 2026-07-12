// app/api/discussions/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export const runtime = "nodejs";

/**
 * Body:
 * {
 *   attachedToType: "article" | "comment" | ...,
 *   attachedToId: string,
 *   title?: string,
 *   description?: string | null,
 *   createConversation?: boolean,   // default true
 *   forceNew?: boolean              // default false → open existing if present
 * }
 */
export async function POST(req: NextRequest) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    attachedToType,
    attachedToId,
    title = "Discussion",
    description = null,
    createConversation = true,
    forceNew = false,
  } = body ?? {};

  if (!attachedToType || !attachedToId) {
    return NextResponse.json({ error: "attachedToType and attachedToId required" }, { status: 400 });
  }

  if (!forceNew) {
    // open the most recently updated existing discussion, if any
    const existing = await prisma.discussion.findFirst({
      where: { attachedToType, attachedToId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ discussion: existing, created: false }, { status: 200 });
  }

  // create new
  const discussion = await prisma.$transaction(async (tx) => {
    let conversationId: number | null = null;
    if (createConversation) {
      const conv = await tx.conversation.create({ data: {} });
      conversationId = Number(conv.id);
    }
    return tx.discussion.create({
      data: {
        title,
        description,
        createdById: String(uid),
        attachedToType,
        attachedToId,
        conversationId,
      },
      select: { id: true },
    });
  });

  return NextResponse.json({ discussion, created: true }, { status: 201 });
}
