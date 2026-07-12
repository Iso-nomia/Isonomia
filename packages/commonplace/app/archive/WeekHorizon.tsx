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

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export default async function WeekHorizon({ authorId }: { authorId: string }) {
  const today = startOfDay(new Date());
  const start = new Date(today.getTime() - 6 * DAY_MS);

  const entries = await prisma.entry.findMany({
    where: { authorId, createdAt: { gte: start } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      genre: true,
      plainText: true,
      createdAt: true,
      thread: { select: { id: true, name: true } },
    },
  });

  // Bucket by day, oldest -> newest.
  const days: { date: Date; entries: typeof entries }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    days.push({ date: d, entries: [] });
  }
  for (const e of entries) {
    const dayStart = startOfDay(e.createdAt).getTime();
    const idx = Math.round((dayStart - start.getTime()) / DAY_MS);
    if (days[idx]) days[idx].entries.push(e);
  }

  const totalEntries = entries.length;
  const activeDays = days.filter((d) => d.entries.length > 0).length;

  return (
    <div className="space-y-8">
      <div className="font-sans text-xs text-stone-500">
        {totalEntries} {totalEntries === 1 ? "entry" : "entries"} across{" "}
        {activeDays} of the last 7 days
      </div>

      <ol className="space-y-6">
        {days
          .slice()
          .reverse()
          .map((day) => {
            const isToday = day.date.getTime() === today.getTime();
            const weekday = day.date.toLocaleDateString(undefined, {
              weekday: "long",
            });
            return (
              <li key={day.date.toISOString()} className="space-y-2">
                <div className="flex items-baseline justify-between border-b border-stone-200 pb-1">
                  <h2 className="font-sans text-sm font-medium text-stone-700">
                    {isToday ? "Today" : weekday}
                  </h2>
                  <span className="font-sans text-xs text-stone-400">
                    {day.date.toLocaleDateString()}
                  </span>
                </div>
                {day.entries.length === 0 ? (
                  <p className="text-xs italic text-stone-400">—</p>
                ) : (
                  <ul className="space-y-3">
                    {day.entries.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/entry/${e.id}`}
                          className="block group"
                        >
                          <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-stone-500">
                            <span className="uppercase tracking-wide">
                              {GENRE_LABEL[e.genre] ?? e.genre.toLowerCase()}
                            </span>
                            {e.thread && (
                              <>
                                <span>·</span>
                                <span>
                                  {e.thread.name ?? "(unnamed thread)"}
                                </span>
                              </>
                            )}
                            <span>·</span>
                            <time>
                              {e.createdAt.toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </time>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-stone-800 group-hover:text-stone-900">
                            {e.plainText || (
                              <em className="text-stone-400">(empty)</em>
                            )}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
      </ol>
    </div>
  );
}
