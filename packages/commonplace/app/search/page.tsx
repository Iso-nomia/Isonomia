import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { getCurrentAuthor } from "../../lib/auth";
import SearchForm from "./SearchForm";

const GENRES = [
  "FRAGMENT",
  "EXCERPT",
  "OBSERVATION",
  "MEDITATION",
  "DIALOGUE",
  "LETTER",
  "LIST",
  "POEM",
] as const;
type Genre = (typeof GENRES)[number];

type SearchParams = {
  q?: string;
  genre?: string;
  threadId?: string;
};

const PAGE_SIZE = 50;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getCurrentAuthor();
  if (!ctx) redirect("/login?next=/search");

  const q = (searchParams.q ?? "").trim();
  const genreParam = (searchParams.genre ?? "").toUpperCase();
  const genre =
    (GENRES as readonly string[]).includes(genreParam) ? (genreParam as Genre) : undefined;
  const threadId = searchParams.threadId || undefined;

  const threads = await prisma.thread.findMany({
    where: { authorId: ctx.author.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });

  const entries = q
    ? await prisma.entry.findMany({
        where: {
          authorId: ctx.author.id,
          plainText: { contains: q, mode: "insensitive" },
          ...(genre ? { genre } : {}),
          ...(threadId ? { threadId } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: PAGE_SIZE,
        select: {
          id: true,
          genre: true,
          plainText: true,
          createdAt: true,
          updatedAt: true,
          thread: { select: { id: true, name: true } },
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-stone-900">Search</h1>
        <p className="text-sm text-stone-500">
          Plain-text search across the entire archive.
        </p>
      </header>

      <SearchForm
        initialQuery={q}
        initialGenre={genre ?? ""}
        initialThreadId={threadId ?? ""}
        threads={threads}
      />

      {q && (
        <section className="space-y-3">
          <p className="text-xs text-stone-500">
            {entries.length === 0
              ? "No matches."
              : `${entries.length} result${entries.length === 1 ? "" : "s"}${entries.length === PAGE_SIZE ? " (showing first " + PAGE_SIZE + ")" : ""}`}
          </p>
          <ul className="space-y-4">
            {entries.map((e: (typeof entries)[number]) => (
              <li key={e.id} className="border-b border-stone-100 pb-4">
                <Link href={`/entry/${e.id}`} className="block group">
                  <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-stone-500">
                    <span className="uppercase tracking-wide">
                      {e.genre.toLowerCase()}
                    </span>
                    {e.thread && (
                      <>
                        <span>·</span>
                        <span>{e.thread.name ?? "(unnamed thread)"}</span>
                      </>
                    )}
                    <span>·</span>
                    <time>{e.updatedAt.toLocaleDateString()}</time>
                  </div>
                  <p className="mt-1 text-stone-800 group-hover:text-stone-900">
                    {highlightSnippet(e.plainText, q)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function highlightSnippet(text: string, q: string): React.ReactNode {
  if (!text) return <em className="text-stone-400">(empty)</em>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) {
    return text.length > 240 ? text.slice(0, 240) + "…" : text;
  }
  const radius = 110;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + needle.length + radius);
  const before = (start > 0 ? "…" : "") + text.slice(start, idx);
  const match = text.slice(idx, idx + needle.length);
  const after = text.slice(idx + needle.length, end) + (end < text.length ? "…" : "");
  return (
    <>
      {before}
      <mark className="rounded-sm bg-amber-100 px-0.5 text-stone-900">
        {match}
      </mark>
      {after}
    </>
  );
}
