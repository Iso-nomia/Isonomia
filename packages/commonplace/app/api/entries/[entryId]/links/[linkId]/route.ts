import { NextResponse } from "next/server";
import { getCurrentAuthor } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";

/**
 * DELETE /api/entries/[entryId]/links/[linkId]
 *
 * Removes a cross-reference. Authorization: the link's `from` entry
 * must belong to the current author. (Owning the source endpoint is
 * sufficient; the link is "yours" because you wrote the connection.)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { entryId: string; linkId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const link = await prisma.entryLink.findFirst({
    where: {
      id: params.linkId,
      fromId: params.entryId,
      from: { authorId: ctx.author.id },
    },
    select: { id: true },
  });
  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.entryLink.delete({ where: { id: link.id } });
  return NextResponse.json({ ok: true });
}
