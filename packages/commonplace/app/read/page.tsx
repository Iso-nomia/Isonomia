import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getCurrentAuthor } from "../../lib/auth";
import { redirect } from "next/navigation";

function dormancyLabel(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 14) return "active";
  if (days <= 90) return "warm";
  if (days <= 365) return "dormant";
  return "fallow";
}

export default async function ReadPage() {
  const ctx = await getCurrentAuthor();
  if (!ctx) redirect("/login?next=/read");

  const [threads, recentEntries] = await Promise.all([
    prisma.thread.findMany({
      where: { authorId: ctx.author.id, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        updatedAt: true,
        _count: { select: { entries: true } },
        entries: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { plainText: true, updatedAt: true },
        },
      },
    }),
    prisma.entry.findMany({
      where: { authorId: ctx.author.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        genre: true,
        plainText: true,
        createdAt: true,
        thread: { select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="font-display text-3xl text-stone-900">Threads</h1>
        {threads.length === 0 ? (
          <p className="text-stone-500 text-sm">
            No named themes yet. Meditations will gather here as you write them.
          </p>
        ) : (
          <ul className="space-y-4">
            {threads.map((t: (typeof threads)[number]) => {
              const latest = t.entries[0];
              const lastDate = latest?.updatedAt ?? t.updatedAt;
              const dormancy = dormancyLabel(lastDate);
              return (
                <li
                  key={t.id}
                  className="border-b border-stone-100 pb-4 last:border-b-0"
                >
                  <Link href={`/read/${t.id}`} className="block group">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-stone-800 group-hover:underline">
                        {t.name ?? "(unnamed)"}
                      </span>
                      <span className="text-xs text-stone-500">
                        {t._count.entries} · {dormancy}
                      </span>
                    </div>
                    {latest?.plainText && (
                      <p className="mt-1 line-clamp-2 text-sm text-stone-600">
                        {latest.plainText}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-stone-400">
                      last activity {lastDate.toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-700">Recent entries</h2>
        {recentEntries.length === 0 ? (
          <p className="text-stone-500 text-sm">
            Nothing written yet.{" "}
            <Link href="/write" className="underline">
              Begin.
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {recentEntries.map((e: (typeof recentEntries)[number]) => (
              <li key={e.id} className="border-b border-stone-100 pb-3">
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
                    <time>{e.createdAt.toLocaleDateString()}</time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-stone-800 group-hover:text-stone-900">
                    {e.plainText || (
                      <em className="text-stone-400">(empty)</em>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
