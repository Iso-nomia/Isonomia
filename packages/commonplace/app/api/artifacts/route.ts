import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { getCurrentAuthor } from "../../../lib/auth";
import { ArtifactBodySchema, EMPTY_BODY } from "../../../lib/artifact-types";

const CreateArtifactSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  subtitle: z.string().trim().max(300).nullish(),
  body: ArtifactBodySchema.optional(),
});

/**
 * GET /api/artifacts — list the current author's artifacts, drafts first
 * (most-recently edited), then published.
 */
export async function GET() {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const artifacts = await prisma.artifact.findMany({
    where: { authorId: ctx.author.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      subtitle: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ artifacts });
}

export async function POST(request: Request) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => ({}));
  const parsed = CreateArtifactSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const artifact = await prisma.artifact.create({
    data: {
      title: parsed.data.title ?? "Untitled",
      subtitle: parsed.data.subtitle ?? null,
      body: (parsed.data.body ?? EMPTY_BODY) as object,
      authorId: ctx.author.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ artifact }, { status: 201 });
}
