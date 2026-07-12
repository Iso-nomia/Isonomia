import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { getCurrentAuthor } from "../../../../../lib/auth";
import {
  ArtifactBodySchema,
  type ArtifactBody,
} from "../../../../../lib/artifact-types";

const AppendSchema = z.object({
  entryId: z.string().min(1),
  includeProvenance: z.boolean().default(true),
});

/**
 * POST /api/artifacts/:id/append-entry
 * Appends an entry block to the artifact's body. Used by the
 * "Send to artifact" affordance on /entry/[id]. Idempotent only by
 * client convention — duplicates are allowed since a writer might
 * intentionally repeat a quotation.
 */
export async function POST(
  request: Request,
  { params }: { params: { artifactId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = AppendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Author must own both the artifact and the entry.
  const [artifact, entry] = await Promise.all([
    prisma.artifact.findFirst({
      where: { id: params.artifactId, authorId: ctx.author.id },
    }),
    prisma.entry.findFirst({
      where: { id: parsed.data.entryId, authorId: ctx.author.id },
      select: { id: true },
    }),
  ]);
  if (!artifact)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!entry)
    return NextResponse.json({ error: "entry_not_found" }, { status: 404 });

  const bodyParsed = ArtifactBodySchema.safeParse(artifact.body);
  const body: ArtifactBody = bodyParsed.success
    ? bodyParsed.data
    : { blocks: [] };

  const nextBody: ArtifactBody = {
    blocks: [
      ...body.blocks,
      {
        kind: "entry",
        entryId: parsed.data.entryId,
        includeProvenance: parsed.data.includeProvenance,
      },
    ],
  };

  const updated = await prisma.artifact.update({
    where: { id: artifact.id },
    data: { body: nextBody as object },
    select: { id: true },
  });

  return NextResponse.json({ artifact: updated });
}
