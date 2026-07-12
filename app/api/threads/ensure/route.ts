export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { jsonSafe } from "@/lib/bigintjson";

export async function POST(req: NextRequest) {
  try {
    const me = await getUserFromCookies();
    if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });

    const { rootMessageId } = await req.json();
    if (!rootMessageId) {
      return NextResponse.json({ ok: false, error: "rootMessageId required" }, { status: 400 });
    }
    const rootId = BigInt(rootMessageId);

    // Load the root message to resolve conversation + auth
    const root = await prisma.message.findUnique({
      where: { id: rootId },
      select: { id: true, conversation_id: true },
    });
    if (!root) return NextResponse.json({ ok: false, error: "Root message not found" }, { status: 404 });

    // Ensure membership
    const member = await prisma.conversationParticipant.findFirst({
      where: { conversation_id: root.conversation_id, user_id: me.userId },
      select: { id: true },
    });
    if (!member) return new NextResponse("Forbidden", { status: 403 });

    // Try to find existing THREAD drift for this root
    const existing = await prisma.drift.findFirst({
      where: { conversation_id: root.conversation_id, root_message_id: root.id, kind: "THREAD" as any },
    });
    if (existing) {
      return NextResponse.json(jsonSafe({
        ok: true,
        drift: {
          id: existing.id.toString(),
          conversationId: existing.conversation_id.toString(),
          title: existing.title,
          isClosed: existing.is_closed,
          isArchived: existing.is_archived,
          messageCount: existing.message_count,
          lastMessageAt: existing.last_message_at ? existing.last_message_at.toISOString() : null,
          anchorMessageId: existing.anchor_message_id ? existing.anchor_message_id.toString() : null,
          kind: "THREAD",
          rootMessageId: existing.root_message_id?.toString() ?? null,
        },
      }), { status: 200 });
    }

    const created = await prisma.drift.create({
        data: {
          conversation_id: root.conversation_id, // ✅ snake_case matches your model
          created_by:      me.userId,
          title:           "Thread",
          kind:            "THREAD",
          root_message_id: root.id,
          anchor_message_id: null,                // ✅ now allowed
        },
      });

    // (No anchor broadcast; thread pane appears when the user opens it.)
    // Counters will be broadcast on first reply (see §5).

    return NextResponse.json(jsonSafe({
      ok: true,
      drift: {
        id: created.id.toString(),
        conversationId: created.conversation_id.toString(),
        title: created.title,
        isClosed: created.is_closed,
        isArchived: created.is_archived,
        messageCount: created.message_count,
        lastMessageAt: created.last_message_at ? created.last_message_at.toISOString() : null,
        anchorMessageId: created.anchor_message_id ? created.anchor_message_id.toString() : null,
        kind: "THREAD",
        rootMessageId: created.root_message_id?.toString() ?? null,
      },
    }), { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/threads/ensure] error", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
