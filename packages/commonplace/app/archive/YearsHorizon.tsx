import Link from "next/link";
import { prisma } from "../../lib/prisma";

const GENRE_LABEL: Record<string, string> = {
  FRAGMENT: "fragment",
  EXCERPT: "excerpt",
  OBSERVATION: "observation",
  MEDITATION: "meditation",
  DIALOGUE: "dialogue",
  LETTER: "letter",
  LIST: "list",
  POEM: "poem",
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function YearsHorizon({
  authorId,
  firstEntryAt,
}: {
  authorId: string;
  firstEntryAt: Date;
}) {
  const [entries, threads] = await Promise.all([
    prisma.entry.findMany({
      where: { authorId },
      select: { id: true, genre: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.thread.findMany({
      where: { authorId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Build month buckets from first entry month -> current month.
  const start = startOfMonth(firstEntryAt);
  const now = startOfMonth(new Date());
  const months: {
    start: Date;
    count: number;
    genres: Record<string, number>;
  }[] = [];
  let cursor = start;
  while (cursor.getTime() <= now.getTime()) {
    months.push({ start: cursor, count: 0, genres: {} });
    cursor = addMonths(cursor, 1);
  }
  const monthIndex = new Map(months.map((m, i) => [monthKey(m.start), i]));
  for (const e of entries) {
    const i = monthIndex.get(monthKey(e.createdAt));
    if (i === undefined) continue;
    months[i].count++;
    months[i].genres[e.genre] = (months[i].genres[e.genre] ?? 0) + 1;
  }

  // Years summary.
  const years = new Map<number, number>();
  for (const m of months) {
    years.set(m.start.getFullYear(), (years.get(m.start.getFullYear()) ?? 0) + m.count);
  }

  const totalEntries = entries.length;
  const monthsActive = months.filter((m) => m.count > 0).length;
  const peakMonth = months.reduce(
    (max, m) => (m.count > max.count ? m : max),
    months[0],
  );

  return (
    <div className="space-y-10">
      <section className="space-y-1 text-sm text-stone-600">
        <p>
          {totalEntries} {totalEntries === 1 ? "entry" : "entries"} since{" "}
          {firstEntryAt.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}{" "}
          · {monthsActive} of {months.length} months active
        </p>
        {peakMonth.count > 0 && (
          <p className="text-xs text-stone-500">
            Most prolific month:{" "}
            {peakMonth.start.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}{" "}
            · {peakMonth.count} entries
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-stone-700">Monthly timeline</h2>
        <ol className="space-y-2 text-sm">
          {months
            .slice()
            .reverse()
            .map((m) => {
              const dominantGenre = Object.entries(m.genres).sort(
                (a, b) => b[1] - a[1],
              )[0];
              return (
                <li
                  key={m.start.toISOString()}
                  className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-1"
                >
                  <span className="font-mono text-xs text-stone-500">
                    {m.start.toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="flex-1 text-stone-700">
                    {m.count === 0 ? (
                      <em className="text-stone-400">—</em>
                    ) : (
                      <>
                        {m.count} {m.count === 1 ? "entry" : "entries"}
                        {dominantGenre && (
                          <span className="ml-2 text-xs uppercase tracking-wide text-stone-500">
                            mostly{" "}
                            {GENRE_LABEL[dominantGenre[0]] ??
                              dominantGenre[0].toLowerCase()}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-stone-700">Thread lifecycles</h2>
        {threads.length === 0 ? (
          <p className="text-xs italic text-stone-400">No threads yet.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {threads.map((t) => {
              const lifespanDays = Math.max(
                1,
                Math.round(
                  (t.updatedAt.getTime() - t.createdAt.getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              );
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b border-stone-100 pb-1"
                >
                  <Link
                    href={`/read/${t.id}`}
                    className="text-stone-800 hover:underline"
                  >
                    {t.name ?? "(unnamed)"}
                    {t.archivedAt && (
                      <span className="ml-2 text-xs uppercase tracking-wide text-stone-500">
                        archived
                      </span>
                    )}
                  </Link>
                  <span className="text-xs text-stone-500">
                    {t._count.entries} entries · {lifespanDays}d span ·{" "}
                    {t.createdAt.toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                    →
                    {t.updatedAt.toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
