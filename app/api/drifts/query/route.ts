export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { jsonSafe } from "@/lib/bigintjson";

export async function POST(req: NextRequest) {
  try {
    const me = await getUserFromCookies();
    if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });

    const { anchorMessageIds } = await req.json();
    if (!Array.isArray(anchorMessageIds) || anchorMessageIds.length === 0) {
      return NextResponse.json({ ok: true, items: [] }, { status: 200 });
    }

    const anchors = await prisma.message.findMany({
      where: { id: { in: anchorMessageIds.map((s: string) => BigInt(s)) } },
      select: { id: true, conversation_id: true, meta: true },
    });

    const anchorIdToDriftId = anchors
      .filter(a => (a.meta as any)?.kind === "DRIFT_ANCHOR")
      .reduce<Record<string, string>>((acc, a) => {
        const driftId = (a.meta as any)?.driftId;
        if (driftId) acc[a.id.toString()] = String(driftId);
        return acc;
      }, {});

    const driftIds = Object.values(anchorIdToDriftId);
    if (driftIds.length === 0) {
      return NextResponse.json({ ok: true, items: [] }, { status: 200 });
    }

    const drifts = await prisma.drift.findMany({
      where: { id: { in: driftIds.map((s) => BigInt(s)) } },
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
    });

    // Member prefs (optional; defaults otherwise)
    const members = await prisma.driftMember.findMany({
      where: { drift_id: { in: drifts.map(d => d.id) }, user_id: me.userId },
    });
    const myByDrift = new Map<string, { collapsed: boolean; pinned: boolean; muted: boolean; lastReadAt: string | null }>();
    for (const m of members) {
      myByDrift.set(m.drift_id.toString(), {
        collapsed: m.collapsed,
        pinned: m.pinned,
        muted: m.muted,
        lastReadAt: m.last_read_at ? m.last_read_at.toISOString() : null,
      });
    }

    const items = drifts.map(d => ({
      anchorMessageId: d.anchor_message_id ? d.anchor_message_id.toString() : null,
      drift: {
        id: d.id.toString(),
        conversationId: d.conversation_id.toString(),
        title: d.title,
        isClosed: d.is_closed,
        isArchived: d.is_archived,
        messageCount: d.message_count,
        lastMessageAt: d.last_message_at ? d.last_message_at.toISOString() : null,
        anchorMessageId: d.anchor_message_id ? d.anchor_message_id.toString() : null,
        kind: d.kind,
        rootMessageId: d.root_message_id ? d.root_message_id.toString() : null,
      },
      my: myByDrift.get(d.id.toString()) ?? { collapsed: true, pinned: false, muted: false, lastReadAt: null },
    }));

    return NextResponse.json(jsonSafe({ ok: true, items }), { status: 200 });
  } catch (e: any) {
    console.error("[POST /api/drifts/query] error", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
