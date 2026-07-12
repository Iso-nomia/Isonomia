import { NextResponse } from "next/server";
import { getCurrentAuthor } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

/**
 * /api/graph
 *
 * Returns the citation/connection graph for the current author.
 * Nodes are entries; edges are of two kinds:
 *
 *   • "link"   — explicit EntryLink rows (the writer's own
 *                cross-references). Solid hairlines in the UI.
 *   • "thread" — implicit chronological links between consecutive
 *                entries within the same thread. Dashed hairlines.
 *
 * Sources and threads are returned as side-tables for tooltip /
 * legend rendering, not as nodes — keeping the visual register
 * monochromatic and intelligible at low node counts.
 */

export async function GET() {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [entries, links] = await Promise.all([
    prisma.entry.findMany({
      where: { authorId: ctx.author.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        genre: true,
        plainText: true,
        createdAt: true,
        threadId: true,
        sourceId: true,
      },
    }),
    prisma.entryLink.findMany({
      where: { from: { authorId: ctx.author.id } },
      select: { id: true, fromId: true, toId: true, type: true },
    }),
  ]);

  // Implicit thread edges: connect each entry in a thread to the next
  // chronological entry in the same thread. This visualizes thread
  // continuity without requiring the writer to draw it explicitly.
  const byThread = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!e.threadId) continue;
    const arr = byThread.get(e.threadId) ?? [];
    arr.push(e);
    byThread.set(e.threadId, arr);
  }
  const threadEdges: { fromId: string; toId: string }[] = [];
  for (const arr of byThread.values()) {
    for (let i = 1; i < arr.length; i++) {
      threadEdges.push({ fromId: arr[i - 1].id, toId: arr[i].id });
    }
  }

  // Trim plainText for tooltip; the full text is one click away.
  const nodes = entries.map((e: (typeof entries)[number]) => ({
    id: e.id,
    genre: e.genre,
    threadId: e.threadId,
    sourceId: e.sourceId,
    snippet: (e.plainText ?? "").trim().replace(/\s+/g, " ").slice(0, 140),
    createdAt: e.createdAt,
  }));

  return NextResponse.json({
    nodes,
    edges: {
      links: links.map((l: (typeof links)[number]) => ({
        id: l.id,
        from: l.fromId,
        to: l.toId,
        type: l.type,
      })),
      threads: threadEdges,
    },
  });
}
