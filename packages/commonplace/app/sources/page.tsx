import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { getCurrentAuthor } from "../../lib/auth";

/**
 * /sources — the bibliographic register.
 *
 * A list of every source the author has excerpted from. Each row is a
 * compact citation (title, author, year) with a count of excerpts.
 * Visibility is via the entry-author relation: a source appears here
 * iff the current author has at least one entry citing it.
 */
export default async function SourcesPage() {
  const ctx = await getCurrentAuthor();
  if (!ctx) redirect("/login?next=/sources");

  const sources = await prisma.source.findMany({
    where: { entries: { some: { authorId: ctx.author.id } } },
    orderBy: [{ author: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      author: true,
      year: true,
      _count: { select: { entries: true } },
    },
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-stone-900">Sources</h1>
        <p className="font-sans text-sm text-stone-500">
          Books and texts you have excerpted from.
        </p>
      </header>

      {sources.length === 0 ? (
        <p className="text-sm text-stone-500">
          No sources yet. They accumulate as you save excerpts.{" "}
          <Link href="/write" className="underline">
            Begin one.
          </Link>
        </p>
      ) : (
        <ul className="space-y-4">
          {sources.map((s: (typeof sources)[number]) => (
            <li
              key={s.id}
              className="border-b border-stone-100 pb-4 last:border-b-0"
            >
              <Link href={`/sources/${s.id}`} className="block group">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-serif italic text-stone-800 group-hover:underline">
                    {s.title}
                  </span>
                  <span className="font-sans text-xs text-stone-500">
                    {s._count.entries}{" "}
                    {s._count.entries === 1 ? "excerpt" : "excerpts"}
                  </span>
                </div>
                <p className="mt-1 font-sans text-xs text-stone-500">
                  {s.author ?? "—"}
                  {s.year && <span> · {s.year}</span>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
