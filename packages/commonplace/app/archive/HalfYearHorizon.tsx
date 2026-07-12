import Link from "next/link";
import { prisma } from "../../lib/prisma";

const DAY_MS = 1000 * 60 * 60 * 24;
const WEEKS = 26;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Monday-anchored week start.
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}

function intensityClass(count: number): string {
  if (count === 0) return "bg-stone-100";
  if (count <= 2) return "bg-amber-200";
  if (count <= 5) return "bg-amber-400";
  if (count <= 10) return "bg-amber-600";
  return "bg-amber-800";
}

export default async function HalfYearHorizon({
  authorId,
}: {
  authorId: string;
}) {
  const today = startOfDay(new Date());
  const windowStart = startOfWeek(
    new Date(today.getTime() - (WEEKS - 1) * 7 * DAY_MS),
  );

  type EntryRow = { createdAt: Date; threadId: string | null };
  type ThreadRow = {
    id: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { entries: number };
  };

  // The commonplace package has its own Prisma client (with `entry`/`thread`
  // models) that differs from the root client picked up by the monorepo build,
  // so the model accessors are typed loosely here while the result rows stay
  // strongly typed.
  const db = prisma as unknown as {
    entry: { findMany: (args: unknown) => Promise<EntryRow[]> };
    thread: { findMany: (args: unknown) => Promise<ThreadRow[]> };
  };

  const [entries, threads] = await Promise.all([
    db.entry.findMany({
      where: { authorId, createdAt: { gte: windowStart } },
      select: { createdAt: true, threadId: true },
    }),
    db.thread.findMany({
      where: { authorId, archivedAt: null },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { entries: true } },
      },
    }),
  ]);

  // Weekly buckets (oldest -> newest).
  const weeks: { start: Date; count: number }[] = [];
  for (let i = 0; i < WEEKS; i++) {
    weeks.push({
      start: new Date(windowStart.getTime() + i * 7 * DAY_MS),
      count: 0,
    });
  }
  for (const e of entries) {
    const idx = Math.floor(
      (startOfWeek(e.createdAt).getTime() - windowStart.getTime()) /
        (7 * DAY_MS),
    );
    if (idx >= 0 && idx < weeks.length) weeks[idx].count++;
  }

  const totalEntries = entries.length;
  const activeWeeks = weeks.filter((w) => w.count > 0).length;

  // Thread classification within the half-year window.
  const fourWeeksAgo = new Date(today.getTime() - 28 * DAY_MS);

  const emerging = threads
    .filter((t) => t.createdAt >= fourWeeksAgo)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const active = threads
    .filter(
      (t) =>
        t.createdAt < fourWeeksAgo &&
        t.updatedAt >= windowStart &&
        t._count.entries > 0,
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const dormant = threads
    .filter((t) => t.updatedAt < windowStart && t._count.entries > 0)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-stone-700">
            Weekly activity
          </h2>
          <span className="text-xs text-stone-500">
            {totalEntries} entries across {activeWeeks} of {WEEKS} weeks
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {weeks.map((w) => (
            <span
              key={w.start.toISOString()}
              title={`${w.start.toLocaleDateString()} — ${w.count} ${w.count === 1 ? "entry" : "entries"}`}
              className={`h-5 w-5 rounded-sm ${intensityClass(w.count)}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <span>quiet</span>
          <span className="h-3 w-3 rounded-sm bg-stone-100" />
          <span className="h-3 w-3 rounded-sm bg-amber-200" />
          <span className="h-3 w-3 rounded-sm bg-amber-400" />
          <span className="h-3 w-3 rounded-sm bg-amber-600" />
          <span className="h-3 w-3 rounded-sm bg-amber-800" />
          <span>busy</span>
        </div>
      </section>

      <ThreadGroup title="Emerging" threads={emerging} emptyHint="No new threads in the last four weeks." />
      <ThreadGroup title="Active" threads={active} emptyHint="No ongoing threads in the last six months." />
      <ThreadGroup title="Dormant" threads={dormant} emptyHint="No dormant threads — everything is current." />
    </div>
  );
}

function ThreadGroup({
  title,
  threads,
  emptyHint,
}: {
  title: string;
  threads: {
    id: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { entries: number };
  }[];
  emptyHint: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-stone-700">{title}</h2>
      {threads.length === 0 ? (
        <p className="text-xs italic text-stone-400">{emptyHint}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                href={`/read/${t.id}`}
                className="flex items-baseline justify-between gap-3 text-stone-800 hover:underline"
              >
                <span>{t.name ?? "(unnamed)"}</span>
                <span className="text-xs text-stone-500">
                  {t._count.entries} · {t.updatedAt.toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
