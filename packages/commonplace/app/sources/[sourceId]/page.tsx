import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { getCurrentAuthor } from "../../../lib/auth";

type Params = { sourceId: string };

const GENRE_LABEL: Record<string, string> = {
  FRAGMENT: "Fragment",
  EXCERPT: "Excerpt",
  OBSERVATION: "Observation",
  MEDITATION: "Meditation",
  DIALOGUE: "Dialogue",
  LETTER: "Letter",
  LIST: "List",
};

/**
 * /sources/[sourceId] — bibliographic header + every excerpt the
 * current author has drawn from this source, ordered by locator if
 * present (best-effort, lexicographic) else by creation order.
 */
export default async function SourceDetailPage({
  params,
}: {
  params: Params;
}) {
  const ctx = await getCurrentAuthor();
  if (!ctx) redirect(`/login?next=/sources/${params.sourceId}`);

  const source = await prisma.source.findFirst({
    where: {
      id: params.sourceId,
      entries: { some: { authorId: ctx.author.id } },
    },
    select: {
      id: true,
      title: true,
      author: true,
      year: true,
      publisher: true,
      isbn: true,
      url: true,
    },
  });

  if (!source) notFound();

  const entries = await prisma.entry.findMany({
    where: { sourceId: source.id, authorId: ctx.author.id },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      genre: true,
      plainText: true,
      locator: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-stone-900">{source.title}</h1>
        <div className="font-sans text-sm text-stone-600">
          {source.author ?? "—"}
          {source.year && <span> · {source.year}</span>}
        </div>
        {(source.publisher || source.isbn || source.url) && (
          <div className="font-sans text-xs text-stone-500 space-x-2">
            {source.publisher && <span>{source.publisher}</span>}
            {source.isbn && <span>· ISBN {source.isbn}</span>}
            {source.url && (
              <>
                <span>·</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-stone-900 hover:underline"
                >
                  link
                </a>
              </>
            )}
          </div>
        )}
      </header>

      <section className="space-y-4">
        <h2 className="font-sans text-sm font-medium text-stone-700">
          {entries.length} {entries.length === 1 ? "excerpt" : "excerpts"}
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-stone-500">
            No excerpts from this source yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {entries.map((e: (typeof entries)[number]) => (
              <li
                key={e.id}
                className="border-b border-stone-100 pb-4 last:border-b-0"
              >
                <Link href={`/entry/${e.id}`} className="block group">
                  <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-stone-500">
                    <span className="uppercase tracking-wide">
                      {GENRE_LABEL[e.genre] ?? e.genre.toLowerCase()}
                    </span>
                    {e.locator && (
                      <>
                        <span>·</span>
                        <span className="text-stone-700">{e.locator}</span>
                      </>
                    )}
                    <span>·</span>
                    <time>{e.createdAt.toLocaleDateString()}</time>
                  </div>
                  {e.plainText && (
                    <p className="mt-1 line-clamp-3 text-stone-800 group-hover:text-stone-900">
                      {e.plainText}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t border-stone-200 pt-6 font-sans text-sm">
        <Link href="/sources" className="text-stone-700 hover:underline">
          ← All sources
        </Link>
      </footer>
    </div>
  );
}
