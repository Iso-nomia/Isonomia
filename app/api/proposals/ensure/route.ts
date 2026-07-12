export const dynamic = "force-dynamic";

// app/api/proposals/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

const bodySchema = z.object({
  rootMessageId: z.union([z.string(), z.number(), z.bigint()]).transform((v) => BigInt(v)),
});

function snippet(t: string | null | undefined, n = 42) {
  if (!t) return "Proposal";
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export async function POST(req: NextRequest) {
  try {
    const me = await getUserFromCookies();
    if (!me?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const json = await req.json().catch(() => ({}));
    const { rootMessageId } = bodySchema.parse(json);

    // Load root + conversation for access keys/titling
    const root = await prisma.message.findUnique({
      where: { id: rootMessageId },
      select: { id: true, text: true, conversation_id: true },
    });
    if (!root) return NextResponse.json({ error: "Root message not found" }, { status: 404 });

    // Optional: ensure requester is a participant
    const part = await prisma.conversationParticipant.findFirst({
      where: { conversation_id: root.conversation_id, user_id: me.userId },
      select: { user_id: true },
    });
    if (!part) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // === One shared PROPOSAL drift per (conversation, root) ===
    // NOTE: relies on @@unique([conversation_id, root_message_id, kind]) in Prisma schema.
    // Prisma exposes compound unique as conversation_id_root_message_id_kind
    const drift = await prisma.drift.upsert({
      where: {
        conversation_id_root_message_id_kind: {
          conversation_id: root.conversation_id,
          root_message_id: root.id,
          kind: "PROPOSAL" as any,
        },
      } as any,
      update: {}, // no-op: we only need the existing row
      create: {
        conversation_id: root.conversation_id,
        root_message_id: root.id,
        kind: "PROPOSAL" as any,
        created_by: me.userId, // kept for attribution; doesn't affect uniqueness
        title: `Proposal: ${snippet(root.text, 42)}`,
      } as any,
    });

    // Normalize payload to your DriftUI shape (force UI kind to "DRIFT")
    const payload = {
      id: (drift as any).id?.toString?.() ?? "",
      title: (drift as any).title || "Proposal",
      isClosed: Boolean((drift as any).is_closed ?? (drift as any).isClosed ?? false),
      isArchived: Boolean((drift as any).is_archived ?? (drift as any).isArchived ?? false),
      kind: "DRIFT" as const, // UI union is "DRIFT" | "THREAD"
      conversationId: (drift as any).conversation_id?.toString?.() ?? "",
      rootMessageId: (drift as any).root_message_id?.toString?.() ?? "",
      messageCount: Number((drift as any).message_count ?? 0),
      lastMessageAt: (drift as any).last_message_at
        ? new Date((drift as any).last_message_at).toISOString()
        : null,
    };

    return NextResponse.json({ ok: true, drift: payload });
  } catch (err: any) {
    // If a race still slips through (rare), fall back to a find and return
    if (err?.code === "P2002") {
      const json = await req.json().catch(() => ({}));
      const { rootMessageId } = bodySchema.parse(json);
      const root = await prisma.message.findUnique({
        where: { id: rootMessageId },
        select: { id: true, conversation_id: true },
      });
      if (root) {
        const d = await prisma.drift.findFirst({
          where: { conversation_id: root.conversation_id, root_message_id: root.id, kind: "PROPOSAL" as any },
        });
        if (d) {
          return NextResponse.json({
            ok: true,
            drift: {
              id: d.id.toString(),
              title: (d as any).title || "Proposal",
              isClosed: Boolean((d as any).is_closed ?? false),
              isArchived: Boolean((d as any).is_archived ?? false),
              kind: "DRIFT" as const,
              conversationId: (d as any).conversation_id?.toString?.() ?? "",
              rootMessageId: (d as any).root_message_id?.toString?.() ?? "",
              messageCount: Number((d as any).message_count ?? 0),
              lastMessageAt: (d as any).last_message_at
                ? new Date((d as any).last_message_at).toISOString()
                : null,
            },
          });
        }
      }
    }
    console.error("[proposals/ensure] error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
