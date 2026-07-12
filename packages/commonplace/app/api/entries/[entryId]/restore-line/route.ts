import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { getCurrentAuthor } from "../../../../../lib/auth";
import { extractPlainText } from "../../../../../lib/extract-plain-text";

const RestoreLineSchema = z.object({
  text: z.string().min(1),
});

type TiptapNode = {
  type?: string;
  content?: TiptapNode[];
  [key: string]: unknown;
};

/**
 * Cherry-pick a line from an old revision back into the working draft. Appends
 * the text as a new paragraph at the end of the poem and saves it as a draft
 * edit — no new version is committed, so the author can reposition and refine
 * before deciding to keep the change. Poems only.
 */
export async function POST(
  request: Request,
  { params }: { params: { entryId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = RestoreLineSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.entry.findFirst({
    where: { id: params.entryId, authorId: ctx.author.id },
    select: { id: true, genre: true, body: true },
  });
  if (!existing)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.genre !== "POEM")
    return NextResponse.json({ error: "not_a_poem" }, { status: 400 });

  const doc = normalizeDoc(existing.body);
  doc.content = [
    ...(doc.content ?? []),
    {
      type: "paragraph",
      content: [{ type: "text", text: parsed.data.text }],
    },
  ];

  const updated = await prisma.entry.update({
    where: { id: existing.id },
    data: { body: doc as object, plainText: extractPlainText(doc) },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, entryId: updated.id });
}

/**
 * Coerce a stored body into a Tiptap doc we can append to. Guards against a
 * missing/corrupt body so a restore never fails on shape alone.
 */
function normalizeDoc(body: unknown): TiptapNode & { content: TiptapNode[] } {
  if (body && typeof body === "object" && (body as TiptapNode).type === "doc") {
    const doc = body as TiptapNode;
    return { ...doc, content: Array.isArray(doc.content) ? doc.content : [] };
  }
  return { type: "doc", content: [] };
}
