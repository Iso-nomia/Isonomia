import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getCurrentAuthor } from "../../../../lib/auth";

const PatchSourceSchema = z.object({
  title: z.string().trim().min(1).optional(),
  author: z.string().trim().nullish(),
  url: z.string().trim().url().nullish().or(z.literal("")),
  isbn: z.string().trim().nullish(),
  publisher: z.string().trim().nullish(),
  year: z.number().int().nullish(),
});

export async function GET(
  _request: Request,
  { params }: { params: { sourceId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Source must have at least one entry by this author to be visible.
  const source = await prisma.source.findFirst({
    where: {
      id: params.sourceId,
      entries: { some: { authorId: ctx.author.id } },
    },
  });
  if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ source });
}

export async function PATCH(
  request: Request,
  { params }: { params: { sourceId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Authorization: same visibility rule as GET.
  const existing = await prisma.source.findFirst({
    where: {
      id: params.sourceId,
      entries: { some: { authorId: ctx.author.id } },
    },
    select: { id: true },
  });
  if (!existing)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await request.json().catch(() => null);
  const parsed = PatchSourceSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const source = await prisma.source.update({
    where: { id: existing.id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.author !== undefined ? { author: data.author ?? null } : {}),
      ...(data.url !== undefined ? { url: data.url || null } : {}),
      ...(data.isbn !== undefined ? { isbn: data.isbn ?? null } : {}),
      ...(data.publisher !== undefined
        ? { publisher: data.publisher ?? null }
        : {}),
      ...(data.year !== undefined ? { year: data.year ?? null } : {}),
    },
  });

  return NextResponse.json({ source });
}
