import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { getCurrentAuthor } from "../../../lib/auth";
import {
  ArtifactBodySchema,
  EMPTY_BODY,
  type ArtifactBlock,
} from "../../../lib/artifact-types";
import PrintButton from "../_components/PrintButton";

/**
 * /artifact/[id] — typeset reading / print view of an artifact.
 *
 * Same author-only gate as the editor for now (no public sharing layer
 * yet). The page is intentionally chrome-light so that browser
 * Print → "Save as PDF" produces a clean print artifact via the
 * `print:` rules in globals.css.
 */
export default async function ArtifactReadPage({
  params,
}: {
  params: { artifactId: string };
}) {
  const ctx = await getCurrentAuthor();
  if (!ctx) redirect(`/login?next=/artifact/${params.artifactId}`);

  const artifact = await prisma.artifact.findFirst({
    where: { id: params.artifactId, authorId: ctx.author.id },
  });
  if (!artifact) notFound();

  const parsed = ArtifactBodySchema.safeParse(artifact.body);
  const body = parsed.success ? parsed.data : EMPTY_BODY;

  const entryIds = body.blocks
    .filter(
      (b): b is Extract<ArtifactBlock, { kind: "entry" }> => b.kind === "entry",
    )
    .map((b) => b.entryId);

  const entries = entryIds.length
    ? await prisma.entry.findMany({
        where: { id: { in: entryIds }, authorId: ctx.author.id },
        select: {
          id: true,
          genre: true,
          plainText: true,
          createdAt: true,
          locator: true,
          source: { select: { title: true, author: true, year: true } },
        },
      })
    : [];
  const resolvedEntries = entries as ResolvedEntry[];
  const entryMap = new Map(
    resolvedEntries.map((e: ResolvedEntry) => [e.id, e] as const),
  );

  return (
    <article className="artifact space-y-8">
      {/* Top bar — hidden in print. */}
      <div className="flex items-baseline justify-between font-sans text-xs text-stone-500 print:hidden">
        <Link
          href={`/compose/${artifact.id}`}
          className="hover:text-stone-900"
        >
          ← Back to editor
        </Link>
        <PrintButton />
      </div>

      <header className="space-y-2">
        <h1 className="font-display text-4xl text-stone-900">
          {artifact.title}
        </h1>
        {artifact.subtitle && (
          <p className="font-serif italic text-lg text-stone-600">
            {artifact.subtitle}
          </p>
        )}
        {artifact.publishedAt && (
          <p className="font-sans text-xs uppercase tracking-wide text-stone-400 print:text-stone-500">
            published{" "}
            {artifact.publishedAt.toISOString().slice(0, 10)}
          </p>
        )}
      </header>

      <div className="space-y-6">
        {body.blocks.length === 0 && (
          <p className="font-serif italic text-stone-500 print:hidden">
            (empty artifact)
          </p>
        )}
        {body.blocks.map((block, i) => (
          <BlockRender
            key={i}
            block={block}
            entry={
              block.kind === "entry"
                ? entryMap.get(block.entryId) ?? null
                : null
            }
          />
        ))}
      </div>
    </article>
  );
}

type ResolvedEntry = {
  id: string;
  genre: string;
  plainText: string;
  createdAt: Date;
  locator: string | null;
  source: { title: string; author: string | null; year: number | null } | null;
};

function BlockRender({
  block,
  entry,
}: {
  block: ArtifactBlock;
  entry: ResolvedEntry | null;
}) {
  if (block.kind === "heading") {
    if (block.level === 1)
      return (
        <h2 className="font-display text-2xl text-stone-900">{block.text}</h2>
      );
    if (block.level === 2)
      return (
        <h3 className="font-serif text-xl text-stone-900">{block.text}</h3>
      );
    return (
      <h4 className="font-serif text-lg text-stone-800">{block.text}</h4>
    );
  }

  if (block.kind === "prose") {
    return (
      <div className="space-y-3 font-serif text-base leading-relaxed text-stone-800">
        {block.text
          .split(/\n\s*\n/)
          .filter((p) => p.trim())
          .map((para, i) => (
            <p key={i}>{para}</p>
          ))}
      </div>
    );
  }

  // Entry block
  if (!entry) {
    return (
      <p className="font-serif italic text-stone-500">
        (entry no longer available)
      </p>
    );
  }

  const provenance: string[] = [];
  if (block.includeProvenance) {
    provenance.push(entry.genre.toLowerCase());
    provenance.push(entry.createdAt.toISOString().slice(0, 10));
    if (entry.source) {
      const src = [entry.source.author, entry.source.title]
        .filter(Boolean)
        .join(", ");
      if (src) provenance.push(src);
      if (entry.source.year) provenance.push(String(entry.source.year));
      if (entry.locator) provenance.push(entry.locator);
    }
  }

  return (
    <figure className="artifact-entry space-y-2">
      <blockquote className="border-l-2 border-stone-300 pl-4 font-serif text-base leading-relaxed text-stone-800">
        {entry.plainText.trim().split(/\n\s*\n/).map((para, i) => (
          <p key={i} className={i > 0 ? "mt-3" : undefined}>
            {para}
          </p>
        ))}
      </blockquote>
      {provenance.length > 0 && (
        <figcaption className="pl-4 font-sans text-xs text-stone-500">
          — {provenance.join(", ")}
        </figcaption>
      )}
    </figure>
  );
}
