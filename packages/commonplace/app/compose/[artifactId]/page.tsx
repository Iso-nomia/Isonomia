import { redirect, notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { getCurrentAuthor } from "../../../lib/auth";
import { ArtifactBodySchema, type ArtifactBlock, type EntryBlock } from "../../../lib/artifact-types";
import ArtifactEditor from "../_components/ArtifactEditor";

export default async function ComposeArtifactPage({
  params,
}: {
  params: { artifactId: string };
}) {
  const ctx = await getCurrentAuthor();
  if (!ctx) redirect(`/login?next=/compose/${params.artifactId}`);

  const artifact = await prisma.artifact.findFirst({
    where: { id: params.artifactId, authorId: ctx.author.id },
  });
  if (!artifact) notFound();

  const parsed = ArtifactBodySchema.safeParse(artifact.body);
  const body = parsed.success ? parsed.data : { blocks: [] };

  // Resolve any referenced entries up front so the editor renders snippets
  // without an extra round trip on first paint.
  const entryIds = (body.blocks as ArtifactBlock[])
    .filter((b): b is EntryBlock => b.kind === "entry")
    .map((b: EntryBlock) => b.entryId);

  const initialEntries = entryIds.length
    ? await prisma.entry.findMany({
        where: { id: { in: entryIds }, authorId: ctx.author.id },
        select: {
          id: true,
          genre: true,
          plainText: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <ArtifactEditor
      artifactId={artifact.id}
      initialTitle={artifact.title}
      initialSubtitle={artifact.subtitle}
      initialBody={body}
      initialEntries={initialEntries.map((e) => ({
        id: e.id,
        genre: e.genre,
        plainText: e.plainText,
        createdAt: e.createdAt.toISOString(),
      }))}
      publishedAt={artifact.publishedAt?.toISOString() ?? null}
    />
  );
}
