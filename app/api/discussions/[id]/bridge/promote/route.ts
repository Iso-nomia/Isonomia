// app/api/discussions/[id]/bridge/promote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export const runtime = "nodejs";

function toPlainText(m: any): string {
  const t = (m?.text ?? "").toString();
  return t.replace(/\s+/g, " ").trim().slice(0, 8000);
}

// Avoid hardcoding base URL in dev/prod
function getBaseUrl(req: NextRequest) {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  if (!host) throw new Error("Cannot determine base URL — no Host header");
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { messageId, parentId } = await req.json().catch(() => ({}));
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  // hydrate message body from your existing endpoint
  const baseUrl = getBaseUrl(req);
  const res = await fetch(`${baseUrl}/api/sheaf/messages?messageId=${encodeURIComponent(messageId)}`, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: "Failed to load message" }, { status: 400 });

  const detail = await res.json();
  const msg = detail?.messages?.[0] ?? detail?.message ?? null;
  if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const content = {
    type: "blockquote",
    attrs: { source: { kind: "chat", messageId } },
    content: [{ type: "paragraph", content: [{ type: "text", text: toPlainText(msg) }]}],
  };

  try {
    const created = await prisma.forumComment.create({
      data: {
        discussionId: params.id,
        parentId: parentId ? BigInt(parentId) : null,
        authorId: String(uid),
        body: content as any,
        bodyText: toPlainText(msg).slice(0, 3000),
        sourceMessageId: Number(messageId),
        sourceConversationId: Number(msg.conversationId ?? msg.conversation_id ?? 0) || null,
      },
      select: { id: true, discussionId: true, createdAt: true },
    });
    return NextResponse.json({ comment: created }, { status: 201 });
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      const existing = await prisma.forumComment.findFirst({
        where: { discussionId: params.id, sourceMessageId: Number(messageId) },
        select: { id: true, discussionId: true, createdAt: true },
      });
      return NextResponse.json({ comment: existing, idempotent: true }, { status: 200 });
    }
    throw e;
  }
}
