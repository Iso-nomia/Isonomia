import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getCurrentAuthor } from "../../../../lib/auth";
import { ArtifactBodySchema } from "../../../../lib/artifact-types";

const PatchArtifactSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  subtitle: z.string().trim().max(300).nullish(),
  body: ArtifactBodySchema.optional(),
  publish: z.boolean().optional(),
  unpublish: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { artifactId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const artifact = await prisma.artifact.findFirst({
    where: { id: params.artifactId, authorId: ctx.author.id },
  });
  if (!artifact)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ artifact });
}

export async function PATCH(
  request: Request,
  { params }: { params: { artifactId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const existing = await prisma.artifact.findFirst({
    where: { id: params.artifactId, authorId: ctx.author.id },
    select: { id: true },
  });
  if (!existing)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await request.json().catch(() => null);
  const parsed = PatchArtifactSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const artifact = await prisma.artifact.update({
    where: { id: existing.id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.subtitle !== undefined
        ? { subtitle: data.subtitle ?? null }
        : {}),
      ...(data.body !== undefined ? { body: data.body as object } : {}),
      ...(data.publish ? { publishedAt: new Date() } : {}),
      ...(data.unpublish ? { publishedAt: null } : {}),
    },
  });

  return NextResponse.json({ artifact });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { artifactId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const existing = await prisma.artifact.findFirst({
    where: { id: params.artifactId, authorId: ctx.author.id },
    select: { id: true },
  });
  if (!existing)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.artifact.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
