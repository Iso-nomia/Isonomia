import { redirect } from "next/navigation";
import { getCurrentAuthor } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import HorizonNav from "./HorizonNav";
import WeekHorizon from "./WeekHorizon";
import HalfYearHorizon from "./HalfYearHorizon";
import YearsHorizon from "./YearsHorizon";

type Horizon = "week" | "halfyear" | "years";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: { horizon?: string };
}) {
  const ctx = await getCurrentAuthor();
  if (!ctx) redirect("/login?next=/archive");

  const horizon: Horizon =
    searchParams.horizon === "halfyear"
      ? "halfyear"
      : searchParams.horizon === "years"
        ? "years"
        : "week";

  const oldestEntry = await prisma.entry.findFirst({
    where: { authorId: ctx.author.id },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-stone-900">Archive</h1>
        <p className="text-sm text-stone-500">
          Three horizons onto the same body of writing.
        </p>
        <HorizonNav active={horizon} />
      </header>

      {!oldestEntry ? (
        <p className="text-sm text-stone-500">
          The archive is empty. Once you have written for a while, this page
          will show the long view.
        </p>
      ) : horizon === "week" ? (
        <WeekHorizon authorId={ctx.author.id} />
      ) : horizon === "halfyear" ? (
        <HalfYearHorizon authorId={ctx.author.id} />
      ) : (
        <YearsHorizon
          authorId={ctx.author.id}
          firstEntryAt={oldestEntry.createdAt}
        />
      )}
    </div>
  );
}
