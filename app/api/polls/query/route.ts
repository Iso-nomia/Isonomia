export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/server/getUser";

export async function POST(req: Request) {
  try {
    const { messageIds } = await req.json();
    const ids = Array.isArray(messageIds) ? messageIds.map((s: string) => BigInt(s)) : [];
    if (!ids.length) return NextResponse.json({ ok: true, items: [] });

    const me = await getUserFromCookies();
    const uid = me?.userId ? BigInt(me.userId) : null;

    const polls = await prisma.poll.findMany({
      where: { message_id: { in: ids } },
      orderBy: { created_at: "asc" },
    });

    const items = [];
    for (const p of polls) {
      let state: any = null;
      if (p.kind === "OPTIONS") {
        const rows = await prisma.pollVote.groupBy({
          by: ["option_idx"],
          where: { poll_id: p.id },
          _count: { _all: true },
        });
        const totals = new Array(p.options?.length ?? 0).fill(0);
        for (const r of rows) {
          const idx = r.option_idx ?? -1;
          if (idx >= 0 && idx < totals.length) totals[idx] = r._count._all;
        }
        const count = rows.reduce((a, r) => a + r._count._all, 0);
        state = { kind: "OPTIONS", pollId: String(p.id), totals, count };
      } else {
        const agg = await prisma.pollVote.aggregate({
          where: { poll_id: p.id, value: { not: null } },
          _avg: { value: true },
          _count: { _all: true },
        });
        state = {
          kind: "TEMP",
          pollId: String(p.id),
          avg: Math.round(agg._avg.value ?? 0),
          count: agg._count._all ?? 0,
        };
      }

      let my: any = null;
      if (uid) {
        const myRow = await prisma.pollVote.findUnique({
          where: { poll_id_user_id: { poll_id: p.id, user_id: uid } },
        });
        if (myRow) {
          my =
            p.kind === "OPTIONS"
              ? { kind: "OPTIONS", pollId: String(p.id), optionIdx: myRow.option_idx }
              : { kind: "TEMP", pollId: String(p.id), value: myRow.value };
        }
      }

      items.push({
        poll: {
          id: String(p.id),
          conversationId: String(p.conversation_id),
          messageId: String(p.message_id),
          createdById: String(p.created_by_id),
          kind: p.kind,
          options: p.options ?? undefined,
          maxOptions: p.max_options,
          closesAt: p.closes_at ? p.closes_at.toISOString() : null,
          anonymous: p.anonymous,
          createdAt: p.created_at.toISOString(),
        },
        state,
        my,
      });
    }

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
