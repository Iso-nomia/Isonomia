import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { getCurrentAuthor } from "../../lib/auth";
import Graph from "../_components/Graph";

/**
 * /graph — the citation map.
 *
 * Server component: fetches the author's entries, explicit links, and
 * derives implicit thread-membership edges. Hands the result to the
 * client `Graph` for layout and rendering.
 */
export default async function GraphPage() {
  const ctx = await getCurrentAuthor();
  if (!ctx) redirect("/login?next=/graph");

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

  // Implicit thread chains: chronological adjacency within each thread.
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

  // Orphan = no thread, no source, no incoming/outgoing link.
  // Surfacing these is the graph's distinctive contribution: the
  // seeds that haven't yet found their place in the larger work.
  const linked = new Set<string>();
  for (const l of links) {
    linked.add(l.fromId);
    linked.add(l.toId);
  }
  const orphanIds = new Set<string>(
    entries
      .filter((e) => !e.threadId && !e.sourceId && !linked.has(e.id))
      .map((e) => e.id),
  );

  const nodes = entries.map((e) => ({
    id: e.id,
    genre: e.genre,
    threadId: e.threadId,
    sourceId: e.sourceId,
    snippet: (e.plainText ?? "").trim().replace(/\s+/g, " ").slice(0, 140),
    createdAt: e.createdAt.toISOString(),
    isOrphan: orphanIds.has(e.id),
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-stone-900">Graph</h1>
        <p className="font-sans text-sm text-stone-500">
          A map of your entries across time. Arcs above are
          cross-references you have drawn; arcs below are thread
          continuity. Open dots are orphans — entries that have not
          yet found their place.
        </p>
        <p className="font-serif italic text-sm text-stone-500">
          Shift-click two entries to draw a connection.
        </p>
      </header>

      <Graph
        nodes={nodes}
        links={links.map((l) => ({
          id: l.id,
          from: l.fromId,
          to: l.toId,
          type: l.type,
        }))}
        threads={threadEdges}
      />
    </div>
  );
}
