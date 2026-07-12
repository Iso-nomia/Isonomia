// app/api/discussions/[discussionId]/forum/[commentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { facetToPlainText } from "@/lib/text/mentions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function toPlainText(x: any): string {
  try {
    if (typeof x === "string") return x;
    return facetToPlainText(x);
  } catch {
    return typeof x === "string" ? x : "";
  }
}

function S(x: any): string | null {
  if (x == null) return null;
  return String(x);
}

function serializeComment(row: any) {
  return {
    id: S(row.id)!,
    discussionId: row.discussionId,
    parentId: row.parentId != null ? S(row.parentId) : null,
    authorId: row.authorId,
    body: row.body,
    bodyText: row.bodyText,
    sourceMessageId: row.sourceMessageId ?? null,
    score: row.score ?? 0,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

// ---------- PATCH: edit a comment (author-only for now)
export async function PATCH(req: NextRequest, { params }: { params: { discussionId: string; commentId: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const id = BigInt(params.commentId);
  const existing = await prisma.forumComment.findUnique({
    where: { id },
    select: { id: true, authorId: true, discussionId: true },
  });
  if (!existing || existing.discussionId !== params.discussionId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (String(existing.authorId) !== String(uid)) {
    // TODO: allow MOD/ADMIN here if you wish
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { content } = body ?? {};
  const bodyText = toPlainText(content).slice(0, 5000);

  const updated = await prisma.forumComment.update({
    where: { id },
    data: {
      body: content ?? { type: "paragraph", content: [{ type: "text", text: "" }] },
      bodyText,
    },
    select: {
      id: true, authorId: true, body: true, bodyText: true,
      createdAt: true, score: true, sourceMessageId: true, parentId: true,
      discussionId: true,
    },
  });

  return NextResponse.json({ comment: serializeComment(updated) });
}

// ---------- DELETE: soft delete (tombstone) - author-only for now
export async function DELETE(_req: NextRequest, { params }: { params: { discussionId: string; commentId: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const id = BigInt(params.commentId);
  const existing = await prisma.forumComment.findUnique({
    where: { id },
    select: { id: true, authorId: true, discussionId: true },
  });
  if (!existing || existing.discussionId !== params.discussionId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (String(existing.authorId) !== String(uid)) {
    // TODO: allow MOD/ADMIN here if you wish
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft delete: keep structure for replies
  const tomb = { type: "paragraph", content: [{ type: "text", text: "[deleted]" }] };
  await prisma.forumComment.update({
    where: { id },
    data: { body: tomb as any, bodyText: "[deleted]" },
  });

  return NextResponse.json({ ok: true });
}
