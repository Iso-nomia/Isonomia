import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { jsonSafe } from "@/lib/bigintjson";

// Strongly disable caching to avoid stale lists
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromCookies();
    if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json({ ok: false, error: "conversationId required" }, { status: 400 });
    }
    const convoId = BigInt(conversationId);

    // Ensure participant
    const member = await prisma.conversationParticipant.findFirst({
      where: { conversation_id: convoId, user_id: me.userId },
      select: { id: true },
    });
    if (!member) return new NextResponse("Forbidden", { status: 403 });

    // 1) Fetch drifts (both DRIFT and THREAD) – scalars only
    const drifts = await prisma.drift.findMany({
      where: { conversation_id: convoId },
      select: {
        id: true,
        conversation_id: true,
        title: true,
        is_closed: true,
        is_archived: true,
        message_count: true,
        last_message_at: true,
        anchor_message_id: true,
        kind: true,
        root_message_id: true,
      },
      orderBy: { updated_at: "desc" },
    });

    // Early return if none
    if (drifts.length === 0) {
      return NextResponse.json(
        jsonSafe({
          ok: true,
          items: [],
        }),
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // 2) Fetch my per-drift prefs in one shot
    const myPrefs = await prisma.driftMember.findMany({
      where: { user_id: me.userId, drift_id: { in: drifts.map((d) => d.id) } },
      select: {
        drift_id: true,
        collapsed: true,
        pinned: true,
        muted: true,
        last_read_at: true,
      },
    });
    const myById = new Map(
      myPrefs.map((m) => [
        m.drift_id.toString(),
        {
          collapsed: m.collapsed,
          pinned: m.pinned,
          muted: m.muted,
          lastReadAt: m.last_read_at ? m.last_read_at.toISOString() : null,
        },
      ])
    );

    // 3) Map to client shape (camelCase DTO)
    const items = drifts.map((d) => ({
      drift: {
        id: d.id.toString(),
        conversationId: d.conversation_id.toString(),
        title: d.title,
        isClosed: d.is_closed,
        isArchived: d.is_archived,
        messageCount: d.message_count,
        lastMessageAt: d.last_message_at ? d.last_message_at.toISOString() : null,
        anchorMessageId: d.anchor_message_id ? d.anchor_message_id.toString() : null,
        kind: d.kind, // "DRIFT" | "THREAD"
        rootMessageId: d.root_message_id ? d.root_message_id.toString() : null,
      },
      my:
        myById.get(d.id.toString()) ??
        { collapsed: true, pinned: false, muted: false, lastReadAt: null },
    }));

    return NextResponse.json(
      jsonSafe({ ok: true, items }),
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (e: any) {
    console.error("[GET /api/drifts/list] error", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
