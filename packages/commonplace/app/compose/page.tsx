import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { getCurrentAuthor } from "../../lib/auth";
import NewArtifactButton from "./_components/NewArtifactButton";

/**
 * /compose — list of artifacts. Drafts grouped above published.
 */
export default async function ComposePage() {
  const ctx = await getCurrentAuthor();
  if (!ctx) redirect("/login?next=/compose");

  const artifacts = await prisma.artifact.findMany({
    where: { authorId: ctx.author.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      subtitle: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  type ArtifactListItem = (typeof artifacts)[number];
  const drafts = artifacts.filter((a: ArtifactListItem) => !a.publishedAt);
  const published = artifacts.filter((a: ArtifactListItem) => a.publishedAt);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-stone-900">Compose</h1>
        <p className="font-sans text-sm text-stone-500">
          Arrange entries into a finished document. Provenance is preserved
          by reference — re-export to pick up later revisions.
        </p>
      </header>

      <NewArtifactButton />

      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-sans text-xs uppercase tracking-wide text-stone-500">
            Drafts
          </h2>
          <ul className="space-y-3">
            {drafts.map((a: ArtifactListItem) => (
              <li key={a.id}>
                <Link
                  href={`/compose/${a.id}`}
                  className="block space-y-0.5 hover:text-stone-900"
                >
                  <div className="font-serif text-base text-stone-800">
                    {a.title || "Untitled"}
                  </div>
                  {a.subtitle && (
                    <div className="font-serif italic text-sm text-stone-500">
                      {a.subtitle}
                    </div>
                  )}
                  <div className="font-sans text-xs text-stone-400">
                    edited {a.updatedAt.toISOString().slice(0, 10)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {published.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-sans text-xs uppercase tracking-wide text-stone-500">
            Published
          </h2>
          <ul className="space-y-3">
            {published.map((a: ArtifactListItem) => (
              <li key={a.id}>
                <Link
                  href={`/compose/${a.id}`}
                  className="block space-y-0.5 hover:text-stone-900"
                >
                  <div className="font-serif text-base text-stone-800">
                    {a.title || "Untitled"}
                  </div>
                  {a.subtitle && (
                    <div className="font-serif italic text-sm text-stone-500">
                      {a.subtitle}
                    </div>
                  )}
                  <div className="font-sans text-xs text-stone-400">
                    published{" "}
                    {a.publishedAt!.toISOString().slice(0, 10)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {artifacts.length === 0 && (
        <p className="font-serif italic text-stone-500">
          No artifacts yet. Begin one above.
        </p>
      )}
    </div>
  );
}
