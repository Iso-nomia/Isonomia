import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { getCurrentAuthor } from "../../../lib/auth";

type Params = { threadId: string };

const GENRE_LABEL: Record<string, string> = {
  FRAGMENT: "fragment",
  EXCERPT: "excerpt",
  OBSERVATION: "observation",
  MEDITATION: "meditation",
  DIALOGUE: "dialogue",
  LETTER: "letter",
  LIST: "list",
};

export default async function ThreadPage({ params }: { params: Params }) {
  const ctx = await getCurrentAuthor();
  if (!ctx) notFound();

  const thread = await prisma.thread.findFirst({
    where: { id: params.threadId, authorId: ctx.author.id },
    include: {
      entries: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          genre: true,
          plainText: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { versions: true } },
        },
      },
    },
  });

  if (!thread) notFound();

  const genreCounts = thread.entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.genre] = (acc[e.genre] ?? 0) + 1;
    return acc;
  }, {});

  const lastActivity = thread.entries.reduce(
    (latest, e) => (e.updatedAt > latest ? e.updatedAt : latest),
    thread.createdAt,
  );
  const daysSince = Math.floor(
    (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
  );
  const dormancy =
    daysSince <= 14
      ? "active"
      : daysSince <= 90
        ? "warm"
        : daysSince <= 365
          ? "dormant"
          : "fallow";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-stone-900">
          {thread.name ?? "(unnamed thread)"}
        </h1>
        {thread.description && (
          <p className="text-stone-600">{thread.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-stone-500">
          <span>
            {thread.entries.length}{" "}
            {thread.entries.length === 1 ? "entry" : "entries"}
          </span>
          <span>·</span>
          <span>started {thread.createdAt.toLocaleDateString()}</span>
          <span>·</span>
          <span>
            last activity {lastActivity.toLocaleDateString()} ({dormancy})
          </span>
        </div>
        {Object.keys(genreCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 font-sans text-xs text-stone-500">
            {Object.entries(genreCounts).map(([g, n]) => (
              <span
                key={g}
                className="rounded bg-stone-100 px-2 py-0.5 uppercase tracking-wide text-stone-700"
              >
                {GENRE_LABEL[g] ?? g.toLowerCase()} · {n}
              </span>
            ))}
          </div>
        )}
      </header>

      {thread.entries.length === 0 ? (
        <p className="text-stone-500 text-sm">No entries yet in this thread.</p>
      ) : (
        <ol className="space-y-4">
          {thread.entries.map((e) => {
            const revisions = e._count.versions;
            return (
              <li key={e.id} className="border-b border-stone-100 pb-4">
                <Link href={`/entry/${e.id}`} className="block group">
                  <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-stone-500">
                    <span className="uppercase tracking-wide">
                      {GENRE_LABEL[e.genre] ?? e.genre.toLowerCase()}
                    </span>
                    <span>·</span>
                    <time>{e.createdAt.toLocaleDateString()}</time>
                    {revisions > 1 && (
                      <>
                        <span>·</span>
                        <span title={`${revisions} versions`}>
                          {revisions}× revised
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-3 text-stone-800 group-hover:text-stone-900">
                    {e.plainText || (
                      <em className="text-stone-400">(empty)</em>
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <Link href="/read" className="text-sm text-stone-700 hover:underline">
        ← All threads
      </Link>
    </div>
  );
}
