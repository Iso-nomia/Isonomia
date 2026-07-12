import { notFound } from "next/navigation";
import Link from "next/link";
import { generateHTML } from "@tiptap/html";
import { prisma } from "../../../lib/prisma";
import { getCurrentAuthor } from "../../../lib/auth";
import { tiptapSharedExtensions } from "../../../lib/tiptap/shared";
import { extractPoemLines } from "../../../lib/poem-lines";
import Connections from "../../_components/Connections";
import SendToArtifact from "../../_components/SendToArtifact";
import PoemEvolution, {
  type PoemVersion,
} from "../../_components/PoemEvolution";

type Params = { entryId: string };

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

export default async function EntryPage({ params }: { params: Params }) {
  const ctx = await getCurrentAuthor();
  if (!ctx) notFound();

  const entry = await prisma.entry.findFirst({
    where: { id: params.entryId, authorId: ctx.author.id },
    include: {
      thread: { select: { id: true, name: true } },
      source: {
        select: {
          id: true,
          title: true,
          author: true,
          year: true,
          url: true,
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          changeType: true,
          changeNote: true,
          createdAt: true,
        },
      },
    },
  });

  if (!entry) notFound();

  // Sibling entries within the same thread, by creation order. Used for
  // the running-header position ("entry N of M") and the foot
  // navigation ("← previous · all N entries · next →"). Books have
  // page numbers; threads have entry numbers.
  let threadContext: {
    name: string | null;
    threadId: string;
    total: number;
    index: number; // 1-based
    prev: { id: string } | null;
    next: { id: string } | null;
  } | null = null;

  if (entry.thread) {
    const threadId = entry.thread.id;
    const [siblings, prev, next] = await Promise.all([
      prisma.entry.count({ where: { threadId, authorId: ctx.author.id } }),
      prisma.entry.findFirst({
        where: {
          threadId,
          authorId: ctx.author.id,
          createdAt: { lt: entry.createdAt },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
      prisma.entry.findFirst({
        where: {
          threadId,
          authorId: ctx.author.id,
          createdAt: { gt: entry.createdAt },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
    ]);
    const indexFromStart = await prisma.entry.count({
      where: {
        threadId,
        authorId: ctx.author.id,
        createdAt: { lte: entry.createdAt },
      },
    });
    threadContext = {
      name: entry.thread.name,
      threadId,
      total: siblings,
      index: indexFromStart,
      prev,
      next,
    };
  }

  let html = "";
  try {
    html = generateHTML(
      entry.body as Record<string, unknown>,
      tiptapSharedExtensions(),
    );
  } catch {
    html = `<pre>${escapeHtml(JSON.stringify(entry.body, null, 2))}</pre>`;
  }

  const isPoem = entry.genre === "POEM";

  // Poems carry a full line-level history so the evolution view can diff any
  // two committed revisions. Other genres only need the lightweight metadata
  // already loaded above.
  let poemVersions: PoemVersion[] = [];
  if (isPoem) {
    const fullVersions = await prisma.entryVersion.findMany({
      where: { entryId: entry.id },
      orderBy: { versionNumber: "desc" },
      select: {
        versionNumber: true,
        changeType: true,
        changeNote: true,
        createdAt: true,
        body: true,
      },
    });
    poemVersions = fullVersions.map((v) => ({
      versionNumber: v.versionNumber,
      changeType: v.changeType,
      changeNote: v.changeNote,
      createdAt: v.createdAt.toISOString(),
      lines: extractPoemLines(v.body),
    }));
  }

  return (
    <div className="space-y-5 border-t border-[#d19f93] pt-4">
      {threadContext && (
        <div className="font-sans text-xs text-stone-400">
          <Link
            href={`/read/${threadContext.threadId}`}
            className="hover:text-stone-600"
          >
            {threadContext.name ?? "(unnamed thread)"}
          </Link>
          <span> · entry {threadContext.index} of {threadContext.total}</span>
        </div>
      )}

      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 font-sans text-[15px] text-stone-500">
          <span className="rounded bg-orange-100 font-serif px-2 py-0.5 uppercase tracking-wide text-stone-700">
            {GENRE_LABEL[entry.genre] ?? entry.genre}
          </span>
          {entry.thread && !threadContext && (
            <>
              <span>·</span>
              <Link href={`/read/${entry.thread.id}`} className="hover:underline">
                {entry.thread.name ?? "(unnamed thread)"}
              </Link>
            </>
          )}
          <span className="font-serif">·</span>
          <time className="font-serif" dateTime={entry.createdAt.toISOString()}>
            {entry.createdAt.toLocaleDateString()}
          </time>
          {entry.updatedAt.getTime() !== entry.createdAt.getTime() && (
            <>
              <span className="font-serif">·</span>
              <span className="font-serif">revised {entry.updatedAt.toLocaleDateString()}</span>
            </>
          )}
          <span className="flex-1" />
          <Link
            href={`/entry/${entry.id}/edit`}
            className="text-stone-700 tracking-wide text-[18px] font-serif hover:underline"
          >
            Edit
          </Link>
        </div>
      </header>

      <article
        className={
          isPoem
            ? "poem-body prose font-semibold prose-stone max-w-none font-serif leading-[23px] [&_p]:whitespace-pre-wrap [&_p]:my-1"
            : "prose prose-stone max-w-none"
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {entry.source && (
        <figcaption className="font-serif text-sm text-stone-500 text-right">
          —{" "}
          {entry.source.author && (
            <span className="not-italic">{entry.source.author}, </span>
          )}
          <Link
            href={`/sources/${entry.source.id}`}
            className="italic text-stone-600 hover:text-stone-900 hover:underline"
          >
            {entry.source.title}
          </Link>
          {entry.source.year && (
            <span className="not-italic"> ({entry.source.year})</span>
          )}
          {entry.locator && (
            <span className="not-italic">, {entry.locator}</span>
          )}
          {entry.source.url && (
            <>
              {" · "}
              <a
                href={entry.source.url}
                target="_blank"
                rel="noreferrer"
                className="font-sans text-xs not-italic text-stone-400 hover:text-stone-700 hover:underline"
              >
                link
              </a>
            </>
          )}
        </figcaption>
      )}
{isPoem ? (
        <PoemEvolution versions={poemVersions} entryId={entry.id} />
      ) : (
        entry.versions.length > 0 && (
        <section className="border-t border-stone-500 pt-6">
          <h2 className="mb-3 font-sans text-sm font-medium text-stone-700">
            Revision history
          </h2>
          <ol className="space-y-2 font-sans text-sm text-stone-600">
            {entry.versions.map((v, i) => {
              const isLatest = i === 0;
              return (
                <li key={v.id} className="flex items-baseline gap-3">
                  {isLatest ? (
                    <span className="font-mono text-xs text-stone-700">
                      v{v.versionNumber}
                    </span>
                  ) : (
                    <Link
                      href={`/entry/${entry.id}/versions/${v.versionNumber}`}
                      className="font-mono text-xs text-stone-500 hover:text-stone-900 hover:underline"
                    >
                      v{v.versionNumber}
                    </Link>
                  )}
                  <span className="uppercase tracking-wide text-xs text-stone-500">
                    {CHANGE_LABEL[v.changeType] ?? v.changeType.toLowerCase()}
                  </span>
                  <time
                    dateTime={v.createdAt.toISOString()}
                    className="text-xs text-stone-400"
                  >
                    {v.createdAt.toLocaleDateString()}
                  </time>
                  {v.changeNote && (
                    <span className="text-stone-600">— {v.changeNote}</span>
                  )}
                  {isLatest && (
                    <span className="text-xs text-stone-400">(current)</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )
      )}

      <Connections entryId={entry.id} />
<SendToArtifact entryId={entry.id} />

      
      
      {threadContext ? (
        <nav className="grid grid-cols-3 items-baseline border-t border-stone-500 pt-6 font-sans text-sm">
          <div className="text-left">
            {threadContext.prev ? (
              <Link
                href={`/entry/${threadContext.prev.id}`}
                className="text-stone-700 hover:underline"
              >
                ← previous
              </Link>
            ) : (
              <span className="text-stone-400">← (first)</span>
            )}
          </div>
          <div className="text-center">
            <Link
              href={`/read/${threadContext.threadId}`}
              className="text-stone-500 hover:text-stone-900 hover:underline"
            >
              all {threadContext.total} entries
            </Link>
          </div>
          <div className="text-right">
            {threadContext.next ? (
              <Link
                href={`/entry/${threadContext.next.id}`}
                className="text-stone-700 hover:underline"
              >
                next →
              </Link>
            ) : (
              <span className="text-stone-400">(latest) →</span>
            )}
          </div>
        </nav>
      ) : (
        <footer className="flex gap-3 border-t border-stone-500 pt-6 font-sans text-sm">
          <Link href="/write" className="text-stone-700 hover:underline">
            ← Write another
          </Link>
          <Link href="/read" className="text-stone-700 hover:underline">
            Threads
          </Link>
        </footer>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
