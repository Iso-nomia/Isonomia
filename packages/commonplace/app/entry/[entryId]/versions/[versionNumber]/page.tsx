import { notFound } from "next/navigation";
import Link from "next/link";
import { generateHTML } from "@tiptap/html";
import { prisma } from "../../../../../lib/prisma";
import { getCurrentAuthor } from "../../../../../lib/auth";
import { tiptapSharedExtensions } from "../../../../../lib/tiptap/shared";

type Params = { entryId: string; versionNumber: string };

const GENRE_LABEL: Record<string, string> = {
  FRAGMENT: "Fragment",
  EXCERPT: "Excerpt",
  OBSERVATION: "Observation",
  MEDITATION: "Meditation",
  DIALOGUE: "Dialogue",
  LETTER: "Letter",
  LIST: "List",
  POEM: "Poem",
};

const CHANGE_LABEL: Record<string, string> = {
  CREATED: "created",
  REVISED: "revised",
  REFINED: "refined",
  CORRECTED: "corrected",
  RECLASSIFIED: "reclassified",
};

export default async function VersionPage({ params }: { params: Params }) {
  const ctx = await getCurrentAuthor();
  if (!ctx) notFound();

  const versionNumber = Number(params.versionNumber);
  if (!Number.isFinite(versionNumber) || versionNumber < 1) notFound();

  const entry = await prisma.entry.findFirst({
    where: { id: params.entryId, authorId: ctx.author.id },
    select: { id: true, thread: { select: { id: true, name: true } } },
  });
  if (!entry) notFound();

  const version = await prisma.entryVersion.findFirst({
    where: { entryId: entry.id, versionNumber },
  });
  if (!version) notFound();

  // Adjacent versions for navigation.
  const [prev, next] = await Promise.all([
    prisma.entryVersion.findFirst({
      where: { entryId: entry.id, versionNumber: { lt: versionNumber } },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    }),
    prisma.entryVersion.findFirst({
      where: { entryId: entry.id, versionNumber: { gt: versionNumber } },
      orderBy: { versionNumber: "asc" },
      select: { versionNumber: true },
    }),
  ]);

  let html = "";
  try {
    html = generateHTML(
      version.body as Record<string, unknown>,
      tiptapSharedExtensions(),
    );
  } catch {
    html = `<pre>${escapeHtml(JSON.stringify(version.body, null, 2))}</pre>`;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="font-sans text-xs uppercase tracking-wide text-amber-700">
          Viewing historical version
        </div>
        <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-stone-500">
          <span className="font-mono text-stone-700">
            v{version.versionNumber}
          </span>
          <span>·</span>
          <span className="rounded bg-stone-100 px-2 py-0.5 uppercase tracking-wide text-stone-700">
            {GENRE_LABEL[version.genre] ?? version.genre}
          </span>
          <span>·</span>
          <span className="uppercase tracking-wide">
            {CHANGE_LABEL[version.changeType] ?? version.changeType}
          </span>
          <span>·</span>
          <time dateTime={version.createdAt.toISOString()}>
            {version.createdAt.toLocaleDateString()}
          </time>
        </div>
        {version.changeNote && (
          <p className="text-sm italic text-stone-600">— {version.changeNote}</p>
        )}
      </header>

      <article
        className={
          version.genre === "POEM"
            ? "poem-body prose prose-stone max-w-none border-l-2 border-amber-300 pl-6 font-serif leading-relaxed [&_p]:whitespace-pre-wrap [&_p]:my-1"
            : "prose prose-stone max-w-none border-l-2 border-amber-300 pl-6"
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <nav className="flex items-center justify-between border-t border-stone-200 pt-6 text-sm">
        <div>
          {prev ? (
            <Link
              href={`/entry/${entry.id}/versions/${prev.versionNumber}`}
              className="text-stone-700 hover:underline"
            >
              ← v{prev.versionNumber}
            </Link>
          ) : (
            <span className="text-stone-400">← (oldest)</span>
          )}
        </div>
        <Link
          href={`/entry/${entry.id}`}
          className="text-stone-700 hover:underline"
        >
          Back to current
        </Link>
        <div>
          {next ? (
            <Link
              href={`/entry/${entry.id}/versions/${next.versionNumber}`}
              className="text-stone-700 hover:underline"
            >
              v{next.versionNumber} →
            </Link>
          ) : (
            <span className="text-stone-400">(latest) →</span>
          )}
        </div>
      </nav>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
